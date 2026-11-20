import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Room, RoomPlayer } from "../lib/api";
import { GreyboxMap } from "./components/GreyboxMap";
import { PlayerRig, type PlayerPose } from "./components/PlayerRig";
import { SpectatorRig } from "./components/SpectatorRig";
import { MouseLook } from "./MouseLook";
import { VirtualControls } from "./VirtualControls";
import { useGameStore } from "./store";

type RemoteState = {
  user_id?: string;
  username?: string;
  team?: string;
  alive?: boolean;
  is_spectator?: boolean;
  x?: number; y?: number; z?: number;
  yaw?: number; pitch?: number;
  mode?: string; locked?: boolean;
};

function RemoteHumanoid({ color, moving, locked, speed }: { color: string; moving: boolean; locked: boolean; speed: number }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * Math.PI * 2);
  useFrame((_, dt) => {
    t.current += dt;
    const speedFactor = THREE.MathUtils.clamp(speed / 4, 0.6, 1.8);
    const swing = moving && !locked ? Math.sin(t.current * (10.5 * speedFactor)) * 0.55 : 0;
    const idle = Math.sin(t.current * 2.2) * 0.03;
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.8;
    if (rArm.current) rArm.current.rotation.x = swing * 0.8;
    if (g.current) {
      g.current.position.y = locked ? 0 : idle * 0.4;
      const s = locked ? 1 + Math.sin(t.current * 2.5) * 0.012 : 1 + Math.sin(t.current * 1.8) * 0.004;
      g.current.scale.setScalar(s);
    }
  });
  if (locked) {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[0.82, 0.9, 0.82]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
        </mesh>
        <mesh castShadow position={[0, 1.08, 0]}>
          <boxGeometry args={[0.52, 0.18, 0.52]} />
          <meshStandardMaterial color="#14532d" />
        </mesh>
      </group>
    );
  }
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[0.5, 0.62, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 1.28, 0]}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshStandardMaterial color="#f1c27d" />
      </mesh>
      <mesh ref={lLeg} castShadow position={[-0.13, 0.32, 0]}>
        <boxGeometry args={[0.16, 0.46, 0.18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh ref={rLeg} castShadow position={[0.13, 0.32, 0]}>
        <boxGeometry args={[0.16, 0.46, 0.18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh ref={lArm} castShadow position={[-0.36, 0.82, 0]}>
        <boxGeometry args={[0.12, 0.42, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={rArm} castShadow position={[0.36, 0.82, 0]}>
        <boxGeometry args={[0.12, 0.42, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function RemotePlayer({ state, label }: { state: RemoteState; label: string }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(state.x ?? 0, state.y ?? 2, state.z ?? 20));
  const yaw = useRef(state.yaw ?? 0);
  const moving = useRef(false);
  const moveSpeed = useRef(0);
  const still = useRef(0);
  useEffect(() => {
    target.current.set(state.x ?? 0, state.y ?? 2, state.z ?? 20);
    yaw.current = state.yaw ?? 0;
  }, [state.x, state.y, state.z, state.yaw]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const k = 1 - Math.pow(0.0006, dt);
    const before = ref.current.position.clone();
    ref.current.position.lerp(target.current, k);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, yaw.current, k);
    const moved = before.distanceTo(ref.current.position);
    moveSpeed.current = moved / Math.max(dt, 0.0001);
    if (moved > 0.0015) { moving.current = true; still.current = 0; } else { still.current += dt; if (still.current > 0.14) moving.current = false; }
  });
  const isSpectator = state.is_spectator || state.team === "spectator" || state.alive === false;
  if (isSpectator) return null;
  const locked = !!state.locked && state.team !== "seeker";
  const color = state.team === "seeker" ? "#dc2626" : locked ? "#16a34a" : "#2563eb";
  return (
    <group ref={ref} position={[state.x ?? 0, state.y ?? 2, state.z ?? 20]}>
      <RemoteHumanoid color={color} moving={moving.current} locked={locked} speed={moveSpeed.current} />
      <Html position={[0, 1.7, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(15,23,42,0.78)", color: "#fff", padding: "2px 6px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap" }}>
          {label}{state.team === "seeker" ? " [S]" : ""}{locked ? " [camouflaged]" : ""}
        </div>
      </Html>
    </group>
  );
}

function TagDetector({ enabled, myPoseRef, remoteStates, players, bestRef, onBest }: {
  enabled: boolean;
  myPoseRef: React.MutableRefObject<PlayerPose | null>;
  remoteStates: Record<string, RemoteState>;
  players: RoomPlayer[];
  bestRef: React.MutableRefObject<string | null>;
  onBest?: (id: string | null) => void;
}) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.1) return;
    acc.current = 0;
    if (!enabled) { bestRef.current = null; onBest?.(null); return; }
    const me = myPoseRef.current;
    if (!me) { bestRef.current = null; onBest?.(null); return; }
    let best: string | null = null;
    let bestD = Infinity;
    for (const p of players) {
      if (p.team !== "hider" || p.alive === false) continue;
      const rs = remoteStates[p.user_id];
      if (!rs) continue;
      const dx = (rs.x ?? 0) - me.x; const dy = (rs.y ?? 0) - me.y; const dz = (rs.z ?? 0) - me.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 2.6 && d < bestD) { bestD = d; best = p.user_id; }
    }
    bestRef.current = best;
    onBest?.(best);
  });
  return null;
}

function ArenaScene({ room, meId, myPlayer, remoteStates, send, myPoseRef, bestTagRef, onBest }: {
  room: Room; meId: string; myPlayer: RoomPlayer | null; remoteStates: Record<string, RemoteState>;
  send: (t: string, p?: unknown) => void; myPoseRef: React.MutableRefObject<PlayerPose | null>; bestTagRef: React.MutableRefObject<string | null>;
  onBest: (id: string | null) => void;
}) {
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const mode = useGameStore((s) => s.cameraMode);
  const phase = room.phase || "lobby";
  const role = myPlayer?.team || (myPlayer?.is_spectator ? "spectator" : "hider");
  const alive = myPlayer?.alive !== false;
  const isPlayable = role !== "spectator" && alive;
  const canMove = isPlayable && !(phase === "hiding" && role === "seeker") && phase !== "ended";
  const seekerCanTag = role === "seeker" && phase === "seeking" && alive;

  useEffect(() => {
    if (!isPlayable && mode !== "spectator") {
      useGameStore.getState().setCameraMode("spectator");
    }
  }, [isPlayable, mode]);

  const spawn: [number, number, number] = role === "seeker" ? [0, 2, 24] : [0, 2, 16];
  const others = Object.values(remoteStates).filter((s) => s.user_id && s.user_id !== meId);

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[10, 20, 10]} intensity={1.1} castShadow />
      <Physics gravity={[0, -9.81, 0]}>
        <GreyboxMap />
        {isPlayable && (
          <PlayerRig
            yawRef={yawRef}
            pitchRef={pitchRef}
            canMove={canMove}
            allowJump={canMove}
            spawn={spawn}
            bodyColor={role === "seeker" ? "#dc2626" : "#2563eb"}
            lockedColor="#16a34a"
            onPose={(pose) => {
              myPoseRef.current = pose;
              send("player.state", pose);
            }}
          />
        )}
        {others.map((s) => (
          <RemotePlayer key={s.user_id || "remote"} state={s} label={s.username || (s.user_id || "?").slice(0, 6)} />
        ))}
        <TagDetector enabled={seekerCanTag} myPoseRef={myPoseRef} remoteStates={remoteStates} players={room.players} bestRef={bestTagRef} onBest={onBest} />
      </Physics>
      <MouseLook yawRef={yawRef} pitchRef={pitchRef} active={true} />
      {(mode === "spectator" || !isPlayable) && <SpectatorRig yawRef={yawRef} pitchRef={pitchRef} />}
      <color attach="background" args={["#dbeafe"]} />
      <fog attach="fog" args={["#dbeafe", 30, 120]} />
    </>
  );
}

function isTouchLikeEvent(e: React.PointerEvent | PointerEvent | unknown) {
  const pe = e as { pointerType?: string };
  if (pe?.pointerType === "touch") return true;
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function RoomArena({ room, meId, myPlayer, remoteStates, send }: {
  room: Room;
  meId: string;
  myPlayer: RoomPlayer | null;
  remoteStates: Record<string, RemoteState>;
  send: (type: string, payload?: unknown) => void;
}) {
  const myPoseRef = useRef<PlayerPose | null>(null);
  const bestTagRef = useRef<string | null>(null);
  const [eventMsg, setEventMsg] = useState<string | null>(null);
  const [canTagNow, setCanTagNow] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!eventMsg) return;
    const t = setTimeout(() => setEventMsg(null), 2500);
    return () => clearTimeout(t);
  }, [eventMsg]);

  const phase = room.phase || "lobby";
  const role = myPlayer?.team || "hider";
  const seekerCanTag = role === "seeker" && phase === "seeking" && myPlayer?.alive !== false;
  const ends = room.phase_ends_at ? new Date(room.phase_ends_at).getTime() : null;
  const remaining = ends ? Math.max(0, Math.ceil((ends - now) / 1000)) : null;
  const seekers = room.players.filter(p => p.team === "seeker").length;
  const hidersAlive = room.players.filter(p => p.team === "hider" && p.alive !== false).length;

  const doTag = () => {
    if (seekerCanTag && bestTagRef.current) {
      send("player.tag", { target_id: bestTagRef.current });
      setEventMsg("Tagged!");
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(".touch-ui, .game-panel, button, input, label, a")) return;
    if (!isTouchLikeEvent(e)) {
      const el = e.currentTarget.querySelector("canvas") as HTMLCanvasElement | null;
      if (el && document.pointerLockElement !== el) {
        try { el.requestPointerLock(); } catch { /* ignore */ }
      }
    }
    if (seekerCanTag) doTag();
  };

  const statusText = phase === "hiding" && role === "seeker" ? "Hiding phase: wait for seeking..."
    : phase === "hiding" && role === "hider" ? "Hide now! Lock/crouch to camouflage and stay still."
    : phase === "seeking" && role === "seeker" ? "Seek and tag hiders (click/tap Tag when in range)."
    : phase === "seeking" && role === "hider" ? "Avoid seekers! Blend in, crouch, and lock to hide."
    : phase === "ended" ? `Winner: ${room.winner_team || "-"}`
    : "Round lobby";

  const phaseClass = phase === "hiding" ? "hiding" : phase === "seeking" ? "seeking" : phase === "ended" ? "ended" : "";

  return (
    <div className="game-root arena-root" style={{ position: "relative", inset: 0, height: "100%" }} onPointerDown={onPointerDown}>
      <Canvas shadows camera={{ fov: 75, position: [0, 4, 24] }}>
        <ArenaScene room={room} meId={meId} myPlayer={myPlayer} remoteStates={remoteStates} send={send} myPoseRef={myPoseRef} bestTagRef={bestTagRef} onBest={(id) => setCanTagNow(!!id)} />
      </Canvas>
      <div className="game-overlay">
        <div className="game-topbar">
          <div className="arena-hud-stats">
            <strong>Room Arena</strong>
            <span className={`badge ${phase === "seeking" ? "live" : ""}`}>Phase: {phase}{remaining != null ? ` ${remaining}s` : ""}</span>
            <span className={`badge ${role === "seeker" ? "seeker" : role === "hider" ? "hider" : ""}`}>You: {role}{myPlayer?.alive === false ? " (out)" : ""}</span>
          </div>
          <div className="arena-hud-stats">
            <span className="stat-chip bad">Seekers: {seekers}</span>
            <span className="stat-chip good">Hiders alive: {hidersAlive}</span>
            {room.winner_team && <span className="stat-chip warn">Winner: {room.winner_team}</span>}
          </div>
          <div className={`phase-banner ${phaseClass}`} style={{ padding: "4px 10px", fontWeight: 600 }}>{statusText}</div>
        </div>
        {eventMsg && <div className="game-locked" style={{ top: 58 }}>{eventMsg}</div>}
        {canTagNow && seekerCanTag && <div className="game-locked pulse-danger" style={{ top: 58, background: "rgba(220,38,38,0.9)" }}>Target in range - tap/click to tag</div>}
        <div className="game-crosshair">+</div>
        <div className="game-panel arena-panel">
          <div className="small muted">Desktop: WASD move, mouse look, Space jump, Shift sprint, C crouch, 1/2/3 camera, L lock/pose, F spectator follow. Mobile: joystick, look pad, action buttons.</div>
          <div className="small muted">Meccha Chameleon-style tip: as a hider, stop moving, crouch, and press Lock to camouflage and blend with the arena.</div>
        </div>
      </div>
      <VirtualControls showTag={role === "seeker"} canTag={seekerCanTag && canTagNow} onTag={doTag} />
    </div>
  );
}

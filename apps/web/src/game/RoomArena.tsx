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
import { useGameStore, type HiderPose } from "./store";

type RemoteState = {
  user_id?: string;
  username?: string;
  team?: string;
  alive?: boolean;
  is_spectator?: boolean;
  x?: number; y?: number; z?: number;
  yaw?: number; pitch?: number;
  mode?: string; locked?: boolean;
  paintColor?: string;
  pose?: string;
};

const PALETTE = ["#f8fafc", "#facc15", "#fb7185", "#38bdf8", "#4ade80", "#a78bfa", "#f97316", "#64748b", "#92400e", "#16a34a"];

function CamouflageFormRemote({ pose, color, locked }: { pose: string; color: string; locked: boolean }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 10);
  useFrame((_, dt) => {
    t.current += dt;
    if (!g.current) return;
    const wobble = locked ? Math.sin(t.current * 2.2) * 0.008 : Math.sin(t.current * 1.8) * 0.015;
    g.current.scale.setScalar(1 + wobble);
  });
  const emissive = locked ? color : "#000000";
  const ei = locked ? 0.12 : 0;
  if (pose === "prone") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.22, 0]}><boxGeometry args={[1.1, 0.35, 1.1]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.85} /></mesh>
      </group>
    );
  }
  if (pose === "tuck") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.65, 0]}><cylinderGeometry args={[0.32, 0.38, 1.2, 12]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.8} /></mesh>
      </group>
    );
  }
  if (pose === "crouch") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.38, 0]}><boxGeometry args={[0.78, 0.68, 0.78]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.85} /></mesh>
      </group>
    );
  }
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.62, 0]}><boxGeometry args={[0.74, 1.05, 0.74]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.82} /></mesh>
    </group>
  );
}

function HunterRemote({ moving, speed }: { moving: boolean; speed: number }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * Math.PI * 2);
  useFrame((_, dt) => {
    t.current += dt;
    const sf = THREE.MathUtils.clamp(speed / 4, 0.6, 1.8);
    const swing = moving ? Math.sin(t.current * 10.5 * sf) * 0.5 : 0;
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.8;
    if (rArm.current) rArm.current.rotation.x = swing * 0.8;
    if (g.current) g.current.position.y = Math.sin(t.current * 2.2) * 0.02;
  });
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.82, 0]}><boxGeometry args={[0.56, 0.64, 0.36]} /><meshStandardMaterial color="#b91c1c" metalness={0.25} roughness={0.45} /></mesh>
      <mesh castShadow position={[0, 1.32, 0]}><boxGeometry args={[0.36, 0.34, 0.36]} /><meshStandardMaterial color="#7f1d1d" /></mesh>
      <mesh castShadow position={[0, 1.38, 0.19]}><boxGeometry args={[0.24, 0.1, 0.04]} /><meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.5} /></mesh>
      <mesh ref={lLeg} castShadow position={[-0.14, 0.33, 0]}><boxGeometry args={[0.17, 0.48, 0.19]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <mesh ref={rLeg} castShadow position={[0.14, 0.33, 0]}><boxGeometry args={[0.17, 0.48, 0.19]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <mesh ref={lArm} castShadow position={[-0.4, 0.84, 0]}><boxGeometry args={[0.13, 0.44, 0.15]} /><meshStandardMaterial color="#991b1b" /></mesh>
      <mesh ref={rArm} castShadow position={[0.4, 0.84, 0]}><boxGeometry args={[0.13, 0.44, 0.15]} /><meshStandardMaterial color="#991b1b" /></mesh>
    </group>
  );
}

function ChameleonRemote({ color, moving, speed }: { color: string; moving: boolean; speed: number }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * Math.PI * 2);
  useFrame((_, dt) => {
    t.current += dt;
    const sf = THREE.MathUtils.clamp(speed / 4, 0.6, 1.8);
    const swing = moving ? Math.sin(t.current * 10.2 * sf) * 0.45 : 0;
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.8;
    if (rArm.current) rArm.current.rotation.x = swing * 0.8;
    if (g.current) g.current.position.y = Math.sin(t.current * 2.1) * 0.02;
  });
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.78, 0]}><boxGeometry args={[0.48, 0.58, 0.32]} /><meshStandardMaterial color={color} roughness={0.55} /></mesh>
      <mesh castShadow position={[0, 1.24, 0.02]}><sphereGeometry args={[0.19, 16, 16]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
      <mesh ref={lLeg} castShadow position={[-0.13, 0.32, 0]}><boxGeometry args={[0.15, 0.44, 0.17]} /><meshStandardMaterial color="#334155" /></mesh>
      <mesh ref={rLeg} castShadow position={[0.13, 0.32, 0]}><boxGeometry args={[0.15, 0.44, 0.17]} /><meshStandardMaterial color="#334155" /></mesh>
      <mesh ref={lArm} castShadow position={[-0.34, 0.8, 0]}><boxGeometry args={[0.11, 0.4, 0.13]} /><meshStandardMaterial color={color} /></mesh>
      <mesh ref={rArm} castShadow position={[0.34, 0.8, 0]}><boxGeometry args={[0.11, 0.4, 0.13]} /><meshStandardMaterial color={color} /></mesh>
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
  const isSeeker = state.team === "seeker";
  const pose = (state.pose as string) || "stand";
  const paint = state.paintColor || "#94a3b8";
  const locked = !!state.locked && !isSeeker;
  const useCamouflage = !isSeeker && (locked || pose !== "stand");
  const tag = isSeeker ? " [Hunter]" : locked ? " [blended]" : (pose !== "stand" ? ` [${pose}]` : "");
  return (
    <group ref={ref} position={[state.x ?? 0, state.y ?? 2, state.z ?? 20]}>
      {isSeeker ? <HunterRemote moving={moving.current} speed={moveSpeed.current} /> : useCamouflage ? <CamouflageFormRemote pose={pose} color={paint} locked={locked} /> : <ChameleonRemote color={paint} moving={moving.current} speed={moveSpeed.current} />}
      <Html position={[0, 1.75, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(15,23,42,0.78)", color: "#fff", padding: "2px 6px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap", border: isSeeker ? "1px solid #ef4444" : "1px solid #22c55e" }}>
          {label}{tag}
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
      if (d < 2.7 && d < bestD) { bestD = d; best = p.user_id; }
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
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 20, 10]} intensity={1.15} castShadow />
      <hemisphereLight args={["#dbeafe", "#86a873", 0.35]} />
      <Physics gravity={[0, -9.81, 0]}>
        <GreyboxMap />
        {isPlayable && (
          <PlayerRig
            yawRef={yawRef}
            pitchRef={pitchRef}
            canMove={canMove}
            allowJump={canMove}
            spawn={spawn}
            isSeeker={role === "seeker"}
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
      <color attach="background" args={["#bfdbfe"]} />
      <fog attach="fog" args={["#bfdbfe", 25, 110]} />
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
  const paintColor = useGameStore((s) => s.paintColor);
  const setPaintColor = useGameStore((s) => s.setPaintColor);
  const pose = useGameStore((s) => s.pose);
  const setPose = useGameStore((s) => s.setPose);
  const locked = useGameStore((s) => s.locked);
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
      setEventMsg("Tagged a chameleon!");
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(".touch-ui, .game-panel, button, input, label, a, .camouflage-bar")) return;
    if (!isTouchLikeEvent(e)) {
      const el = e.currentTarget.querySelector("canvas") as HTMLCanvasElement | null;
      if (el && document.pointerLockElement !== el) {
        try { el.requestPointerLock(); } catch { /* ignore */ }
      }
    }
    if (seekerCanTag) doTag();
  };

  const statusText = phase === "hiding" && role === "seeker" ? "Hunters wait... chameleons are hiding!"
    : phase === "hiding" && role === "hider" ? "Hide & Blend! Paint, pick a pose, lock to camouflage."
    : phase === "seeking" && role === "seeker" ? "Hunt & Seek! Find painted chameleons and tag them."
    : phase === "seeking" && role === "hider" ? "Stay blended! Don't let hunters spot you."
    : phase === "ended" ? `Round over: ${room.winner_team === "seekers" ? "Hunters" : room.winner_team === "hiders" ? "Chameleons" : room.winner_team || "-"} win!`
    : "Hunt & Seek Lobby";

  const phaseClass = phase === "hiding" ? "hiding" : phase === "seeking" ? "seeking" : phase === "ended" ? "ended" : "";
  const poseOptions: { id: HiderPose; label: string }[] = [{ id: "stand", label: "Stand" }, { id: "crouch", label: "Box" }, { id: "prone", label: "Flat" }, { id: "tuck", label: "Tall" }];

  return (
    <div className="game-root arena-root huntseek-root" style={{ position: "relative", inset: 0, height: "100%" }} onPointerDown={onPointerDown}>
      <Canvas shadows camera={{ fov: 75, position: [0, 4, 24] }}>
        <ArenaScene room={room} meId={meId} myPlayer={myPlayer} remoteStates={remoteStates} send={send} myPoseRef={myPoseRef} bestTagRef={bestTagRef} onBest={(id) => setCanTagNow(!!id)} />
      </Canvas>
      <div className="game-overlay huntseek-overlay">
        <div className="game-topbar huntseek-topbar">
          <div className="arena-hud-stats">
            <strong className="brand-pill">Meccha Hunt & Seek</strong>
            <span className={`badge ${phase === "seeking" ? "live" : ""}`}>Phase: {phase}{remaining != null ? ` ${remaining}s` : ""}</span>
            <span className={`badge ${role === "seeker" ? "seeker" : role === "hider" ? "hider" : ""}`}>You: {role === "seeker" ? "Hunter" : role === "hider" ? "Chameleon" : role}{myPlayer?.alive === false ? " (caught)" : ""}</span>
          </div>
          <div className="arena-hud-stats">
            <span className="stat-chip bad">Hunters: {seekers}</span>
            <span className="stat-chip good">Chameleons: {hidersAlive}</span>
            {room.winner_team && <span className="stat-chip warn">Winner: {room.winner_team === "seekers" ? "Hunters" : "Chameleons"}</span>}
          </div>
          <div className={`phase-banner ${phaseClass}`}>{statusText}</div>
        </div>
        {eventMsg && <div className="game-locked" style={{ top: 86 }}>{eventMsg}</div>}
        {canTagNow && seekerCanTag && <div className="game-locked pulse-danger" style={{ top: 86, background: "rgba(220,38,38,0.92)" }}>Target spotted! Tap/click to TAG</div>}
        <div className="game-crosshair">+</div>

        {role === "hider" && myPlayer?.alive !== false && (
          <div className="camouflage-bar">
            <div className="camo-title">🎨 Paint & Blend {locked ? "(Locked)" : ""}</div>
            <div className="palette-row">
              {PALETTE.map((c) => (
                <button key={c} className={`swatch ${paintColor === c ? "active" : ""}`} style={{ background: c }} onClick={() => setPaintColor(c)} title={c} />
              ))}
              <input className="color-pick" type="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} title="Custom paint" />
            </div>
            <div className="pose-row">
              {poseOptions.map((p) => (
                <button key={p.id} className={`btn secondary pose-btn ${pose === p.id ? "active" : ""}`} onClick={() => setPose(p.id)}>{p.label}</button>
              ))}
            </div>
            <div className="small muted camo-hint">Pick a color to match props, choose a pose/form, then Lock to blend in.</div>
          </div>
        )}

        <div className="game-panel arena-panel huntseek-panel">
          <div className="small muted">Desktop: WASD move, mouse look, Space jump, Shift sprint, C crouch, 1/2/3 camera, L lock/blend, F spectator follow. Mobile: joystick, look pad, buttons.</div>
          <div className="small muted">Chameleons: paint yourself, pick a pose, stay still and Lock to camouflage. Hunters: spot anything odd and tag it!</div>
        </div>
      </div>
      <VirtualControls showTag={role === "seeker"} canTag={seekerCanTag && canTagNow} onTag={doTag} />
    </div>
  );
}

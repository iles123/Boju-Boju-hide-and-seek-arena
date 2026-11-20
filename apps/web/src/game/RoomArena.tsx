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

function RemoteHumanoid({ color, moving, locked }: { color: string; moving: boolean; locked: boolean }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * Math.PI * 2);
  useFrame((_, dt) => {
    t.current += dt;
    const swing = moving && !locked ? Math.sin(t.current * 11) * 0.55 : 0;
    const idle = Math.sin(t.current * 2.2) * 0.03;
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.8;
    if (rArm.current) rArm.current.rotation.x = swing * 0.8;
    if (g.current) {
      g.current.position.y = (locked ? 0 : idle) + 0;
      const s = locked ? 1 + Math.sin(t.current * 2.5) * 0.015 : 1;
      g.current.scale.setScalar(s);
    }
  });
  if (locked) {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[0.8, 0.9, 0.8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
        </mesh>
        <mesh castShadow position={[0, 1.08, 0]}>
          <boxGeometry args={[0.5, 0.18, 0.5]} />
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
  const last = useRef(new THREE.Vector3(state.x ?? 0, state.y ?? 2, state.z ?? 20));
  const moving = useRef(false);
  const still = useRef(0);
  useEffect(() => {
    target.current.set(state.x ?? 0, state.y ?? 2, state.z ?? 20);
    yaw.current = state.yaw ?? 0;
  }, [state.x, state.y, state.z, state.yaw]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const k = 1 - Math.pow(0.001, dt);
    const before = ref.current.position.clone();
    ref.current.position.lerp(target.current, k);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, yaw.current, k);
    const moved = before.distanceTo(ref.current.position);
    if (moved > 0.002) { moving.current = true; still.current = 0; } else { still.current += dt; if (still.current > 0.12) moving.current = false; }
    last.current.copy(ref.current.position);
  });
  const isSpectator = state.is_spectator || state.team === "spectator" || state.alive === false;
  if (isSpectator) return null;
  const locked = !!state.locked && state.team !== "seeker";
  const color = state.team === "seeker" ? "#dc2626" : locked ? "#16a34a" : "#2563eb";
  return (
    <group ref={ref} position={[state.x ?? 0, state.y ?? 2, state.z ?? 20]}>
      <RemoteHumanoid color={color} moving={moving.current} locked={locked} />
      <Html position={[0, 1.7, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(15,23,42,0.75)", color: "#fff", padding: "2px 6px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap" }}>
          {label}{state.team === "seeker" ? " [S]" : ""}
        </div>
      </Html>
    </group>
  );
}

function TagDetector({ enabled, myPoseRef, remoteStates, players, bestRef }: {
  enabled: boolean;
  myPoseRef: React.MutableRefObject<PlayerPose | null>;
  remoteStates: Record<string, RemoteState>;
  players: RoomPlayer[];
  bestRef: React.MutableRefObject<string | null>;
}) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.12) return;
    acc.current = 0;
    if (!enabled) { bestRef.current = null; return; }
    const me = myPoseRef.current;
    if (!me) { bestRef.current = null; return; }
    let best: string | null = null;
    let bestD = Infinity;
    for (const p of players) {
      if (p.team !== "hider" || p.alive === false) continue;
      const rs = remoteStates[p.user_id];
      if (!rs) continue;
      const dx = (rs.x ?? 0) - me.x; const dy = (rs.y ?? 0) - me.y; const dz = (rs.z ?? 0) - me.z;
      const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (d < 2.4 && d < bestD) { bestD = d; best = p.user_id; }
    }
    bestRef.current = best;
  });
  return null;
}

function ArenaScene({ room, meId, myPlayer, remoteStates, send, myPoseRef, bestTagRef }: {
  room: Room; meId: string; myPlayer: RoomPlayer | null; remoteStates: Record<string, RemoteState>;
  send: (t: string, p?: unknown) => void; myPoseRef: React.MutableRefObject<PlayerPose | null>; bestTagRef: React.MutableRefObject<string | null>;
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
        <TagDetector enabled={seekerCanTag} myPoseRef={myPoseRef} remoteStates={remoteStates} players={room.players} bestRef={bestTagRef} />
      </Physics>
      <MouseLook yawRef={yawRef} pitchRef={pitchRef} active={true} />
      {(mode === "spectator" || !isPlayable) && <SpectatorRig yawRef={yawRef} pitchRef={pitchRef} />}
      <color attach="background" args={["#dbeafe"]} />
      <fog attach="fog" args={["#dbeafe", 30, 120]} />
    </>
  );
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

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget.querySelector("canvas") as HTMLCanvasElement | null;
    if (el && document.pointerLockElement !== el) {
      try {
        el.requestPointerLock();
      } catch {
        // ignore pointer lock errors
      }
    }
    if (seekerCanTag && bestTagRef.current) {
      send("player.tag", { target_id: bestTagRef.current });
      setEventMsg("Tagged!");
    }
  };

  return (
    <div className="game-root" style={{ position: "relative", inset: 0, height: "100%" }} onClick={onClick}>
      <Canvas shadows camera={{ fov: 75, position: [0, 4, 24] }}>
        <ArenaScene room={room} meId={meId} myPlayer={myPlayer} remoteStates={remoteStates} send={send} myPoseRef={myPoseRef} bestTagRef={bestTagRef} />
      </Canvas>
      <div className="game-overlay">
        <div className="game-topbar">
          <div><strong>Room Arena</strong> | Phase: {phase}{remaining != null ? ` (${remaining}s)` : ""}</div>
          <div>You: {role}{myPlayer?.alive === false ? " (out)" : ""} | Seekers: {seekers} | Hiders alive: {hidersAlive}</div>
          <div>
            {phase === "hiding" && role === "seeker" ? "Hiding phase: wait for seeking..." :
             phase === "hiding" && role === "hider" ? "Hide now! (L to lock as prop)" :
             phase === "seeking" && role === "seeker" ? "Seek and click near hiders to tag" :
             phase === "seeking" && role === "hider" ? "Avoid seekers! Stay hidden/locked" :
             phase === "ended" ? `Winner: ${room.winner_team || "-"}` : "Round lobby"}
          </div>
        </div>
        {eventMsg && <div className="game-locked" style={{ top: 52 }}>{eventMsg}</div>}
        {bestTagRef.current && seekerCanTag && <div className="game-locked" style={{ top: 52, background: "rgba(220,38,38,0.85)" }}>Target in range - click to tag</div>}
        <div className="game-crosshair">+</div>
        <div className="game-panel">
          <div className="small muted">WASD move | Mouse look | Space jump | Shift sprint | C crouch | 1/2/3 camera | L lock prop | F spectator follow</div>
          {room.winner_team && <div><strong>Round winner:</strong> {room.winner_team}</div>}
        </div>
      </div>
    </div>
  );
}

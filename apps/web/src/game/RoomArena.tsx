import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Room, RoomPlayer } from "../lib/api";
import { ArenaMap, getMapDef, pickHiderSpawn } from "./components/maps";
import { CamouflageForm, ChameleonHumanoid, HunterGun, PlayerRig, type PaintFor, type PlayerMotion, type PlayerPose } from "./components/PlayerRig";

import { SpectatorRig } from "./components/SpectatorRig";
import { MouseLook } from "./MouseLook";
import { VirtualControls } from "./VirtualControls";
import { useGameStore, type HiderPose } from "./store";
import { camoLabel, canvasFromDataUrl, computeCamoScore, createRegionTextures, getPose, getSizeScale, POSES, SIZES, type HiderSize } from "./paint";
import { PaintPanel, EyedropperSampler } from "./PaintPanel";

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
  tintColor?: string;
  camoScore?: number;
  pose?: string;
  size?: string;
};

type Shot = { id: number; at: number; origin: number[]; direction: number[]; hit: boolean };
type DecoyState = { id?: string; owner_id?: string; username?: string; x?: number; y?: number; z?: number; yaw?: number; paintColor?: string; tintColor?: string; camoScore?: number; pose?: string; size?: string; locked?: boolean; dataUrl?: string };

const PALETTE = ["#f8fafc", "#facc15", "#fb7185", "#38bdf8", "#4ade80", "#a78bfa", "#f97316", "#64748b", "#92400e", "#16a34a"];

function useRemotePaintFor(dataUrl: string | undefined, fallbackColor: string, tintColor?: string): PaintFor {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!dataUrl) { setCanvas(null); return; }
    let alive = true;
    canvasFromDataUrl(dataUrl).then((c) => { if (alive) setCanvas(c); }).catch(() => { if (alive) setCanvas(null); });
    return () => { alive = false; };
  }, [dataUrl]);
  const textures = useMemo(() => canvas ? createRegionTextures(canvas) : null, [canvas]);
  useEffect(() => () => {
    if (textures) Object.values(textures).forEach((t) => t.dispose());
  }, [textures]);
  return useMemo(() => (region) => textures ? { map: textures[region], color: tintColor || "#ffffff" } : { color: tintColor || fallbackColor }, [textures, fallbackColor, tintColor]);
}

function poseOffset(pose: string) {
  const p = getPose(pose);
  return p.halfH + p.radius;
}

function CamouflageFormRemote({ pose, color, locked, camoScore = 0 }: { pose: string; color: string; locked: boolean; camoScore?: number }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 10);
  useFrame((_, dt) => {
    t.current += dt;
    if (!g.current) return;
    const wobble = locked ? Math.sin(t.current * 2.2) * (0.008 - camoScore / 22000) : Math.sin(t.current * 1.8) * 0.015;
    g.current.scale.setScalar(1 + wobble);
  });
  const emissive = locked ? color : "#000000";
  const ei = locked ? 0.12 : 0;
  const shape = getPose(pose).camoShape;
  if (shape === "prone") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.22, 0]}><boxGeometry args={[1.1, 0.35, 1.1]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.85} /></mesh>
      </group>
    );
  }
  if (shape === "tuck" || shape === "lean") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.65, 0]}><cylinderGeometry args={[0.32, 0.38, 1.2, 12]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.8} /></mesh>
      </group>
    );
  }
  if (shape === "crouch") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.38, 0]}><boxGeometry args={[0.78, 0.68, 0.78]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.85} /></mesh>
      </group>
    );
  }
  if (shape === "wide") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.62, 0]}><boxGeometry args={[1.05, 1.05, 0.7]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.82} /></mesh>
      </group>
    );
  }
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.62, 0]}><boxGeometry args={[0.74, 1.05, 0.74]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.82} /></mesh>
    </group>
  );
}

function HunterRemote({ motion }: { motion: React.MutableRefObject<PlayerMotion> }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * Math.PI * 2);
  useFrame((_, dt) => {
    t.current += dt;
    const { moving, speed } = motion.current;
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
      <group position={[0.4, 0.82, -0.24]}><HunterGun scale={0.8} /></group>
    </group>

  );
}

function ChameleonRemote({ color, motion }: { color: string; motion: React.MutableRefObject<PlayerMotion> }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * Math.PI * 2);
  useFrame((_, dt) => {
    t.current += dt;
    const { moving, speed } = motion.current;
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

function RemotePlayer({ state, label, paintTexture, shimmer, hideTag }: { state: RemoteState; label: string; paintTexture?: string; shimmer?: boolean; hideTag?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(state.x ?? 0, state.y ?? 2, state.z ?? 20));
  const yaw = useRef(state.yaw ?? 0);
  const motion = useRef<PlayerMotion>({ moving: false, grounded: true, speed: 0 });
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
    motion.current.speed = moved / Math.max(dt, 0.0001);
    if (moved > 0.0015) { motion.current.moving = true; still.current = 0; } else { still.current += dt; if (still.current > 0.14) motion.current.moving = false; }
  });
  const isSpectator = state.is_spectator || state.team === "spectator" || state.alive === false;
  const isSeeker = state.team === "seeker";
  const pose = (state.pose as string) || "stand";
  const paint = state.paintColor || "#f8fafc";
  const tint = state.tintColor || paint;
  const paintFor = useRemotePaintFor(paintTexture, paint, state.tintColor);
  if (isSpectator) return null;
  const locked = !!state.locked && !isSeeker;
  const useCamouflage = !isSeeker && (locked || pose !== "stand");
  const tag = isSeeker ? " [Hunter]" : locked ? " [blended]" : (pose !== "stand" ? ` [${pose}]` : "");
  const off = poseOffset(pose);
  return (
    <group ref={ref} position={[state.x ?? 0, state.y ?? 2, state.z ?? 20]}>
      <group position={[0, -off, 0]} scale={isSeeker ? 1 : getSizeScale(state.size)}>
        {isSeeker ? <HunterRemote motion={motion} />
          : paintTexture ? (useCamouflage
            ? <CamouflageForm pose={getPose(pose).id} paintColor={tint} paintFor={paintFor} locked={locked} camoScore={state.camoScore} />
            : <ChameleonHumanoid paintFor={paintFor} motion={motion} />)
          : useCamouflage ? <CamouflageFormRemote pose={pose} color={tint} locked={locked} camoScore={state.camoScore} /> : <ChameleonRemote color={tint} motion={motion} />}
      </group>
      {shimmer && (
        <mesh position={[0, -off + 0.75, 0]}>
          <sphereGeometry args={[0.78, 12, 10]} />
          <meshBasicMaterial color="#fb7185" wireframe transparent opacity={0.6} />
        </mesh>
      )}
      {!hideTag && (
        <Html position={[0, -off + 1.75, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div style={{ background: "rgba(15,23,42,0.78)", color: "#fff", padding: "2px 6px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap", border: isSeeker ? "1px solid #ef4444" : "1px solid #22c55e" }}>
            {label}{tag}
          </div>
        </Html>
      )}
    </group>
  );
}

function DecoyPlayer({ decoy, paintTexture }: { decoy: DecoyState; paintTexture?: string }) {
  const paintFor = useRemotePaintFor(paintTexture, decoy.paintColor || "#f8fafc", decoy.tintColor);
  const pose = decoy.pose || "stand";
  const off = poseOffset(pose);
  const color = decoy.tintColor || decoy.paintColor || "#f8fafc";
  return (
    <group position={[decoy.x ?? 0, decoy.y ?? 0, decoy.z ?? 0]} rotation={[0, decoy.yaw ?? 0, 0]}>
      <group position={[0, -off, 0]} scale={getSizeScale(decoy.size)}>
        {paintTexture
          ? <CamouflageForm pose={getPose(pose).id} paintColor={color} paintFor={paintFor} locked={true} camoScore={decoy.camoScore} />
          : <CamouflageFormRemote pose={pose} color={color} locked={true} camoScore={decoy.camoScore} />}
      </group>
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

function SeekerCombat({ enabled, send }: { enabled: boolean; send: (type: string, payload?: unknown) => void }) {
  const { camera, gl } = useThree();
  const sendRef = useRef(send);
  sendRef.current = send;
  const combatAction = useGameStore((s) => s.combatAction);
  const lastActionSeq = useRef(0);
  const fire = useCallback((spot: boolean) => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const payload = {
      origin: [camera.position.x, camera.position.y, camera.position.z],
      direction: [dir.x, dir.y, dir.z],
    };
    sendRef.current(spot ? "player.spot" : "player.shoot", payload);
  }, [camera]);
  useEffect(() => {
    if (!enabled || !combatAction || combatAction.seq === lastActionSeq.current) return;
    lastActionSeq.current = combatAction.seq;
    if (combatAction.type === "reload") sendRef.current("player.reload");
    else fire(combatAction.type === "spot");
  }, [enabled, combatAction, fire]);
  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) fire(false);
      if (e.button === 2) { e.preventDefault(); fire(true); }
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.code === "KeyR") sendRef.current("player.reload");
      if (e.code === "KeyQ") fire(true);
    };
    gl.domElement.addEventListener("pointerdown", onPointerDown);
    gl.domElement.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onPointerDown);
      gl.domElement.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, gl, fire]);
  return null;
}

function Tracer({ shot }: { shot: Shot }) {
  const geometry = useMemo(() => {
    const start = new THREE.Vector3(shot.origin[0], shot.origin[1], shot.origin[2]);
    const dir = new THREE.Vector3(shot.direction[0], shot.direction[1], shot.direction[2]).normalize();
    return new THREE.BufferGeometry().setFromPoints([start, start.clone().addScaledVector(dir, 60)]);
  }, [shot.origin, shot.direction]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={shot.hit ? "#fde68a" : "#7dd3fc"} transparent opacity={0.75} />
    </lineSegments>
  );
}

function ArenaScene({ room, meId, myPlayer, remoteStates, remotePaintTextures, decoys, shimmerIds, shots, send, myPoseRef, bestTagRef, onBest }: {
  room: Room; meId: string; myPlayer: RoomPlayer | null; remoteStates: Record<string, RemoteState>; remotePaintTextures: Record<string, string>;
  decoys: DecoyState[]; shimmerIds: Record<string, number>; shots: Shot[];
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

  const mapDef = useMemo(() => getMapDef(room.map_id), [room.map_id]);
  const myIndex = Math.max(0, room.players.filter(p => p.team === "hider" || (!p.is_spectator && p.team !== "seeker")).findIndex(p => p.user_id === meId));
  const spawn: [number, number, number] = role === "seeker" ? mapDef.seekerSpawn : pickHiderSpawn(mapDef, myIndex);
  const others = Object.values(remoteStates).filter((s) => s.user_id && s.user_id !== meId);

  return (
    <>
      <ambientLight intensity={mapDef.ambient} />
      <directionalLight position={mapDef.sun} intensity={1.15} castShadow />
      <hemisphereLight args={[mapDef.hemi[0], mapDef.hemi[1], mapDef.hemi[2]]} />
      <Physics gravity={[0, -9.81, 0]}>
        <ArenaMap mapId={room.map_id} />
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
        {others.map((s) => {
          const shimmer = (shimmerIds[s.user_id || ""] ?? 0) > Date.now();
          const blended = !!s.locked && (s.camoScore ?? 0) >= 62;
          return <RemotePlayer key={s.user_id || "remote"} state={s} label={s.username || (s.user_id || "?").slice(0, 6)} paintTexture={remotePaintTextures[s.user_id || ""]} shimmer={shimmer} hideTag={role === "seeker" && blended && !shimmer} />;
        })}
        {decoys.map((d) => <DecoyPlayer key={d.id || `${d.owner_id}-${d.x}-${d.z}`} decoy={d} paintTexture={d.dataUrl || (d.owner_id ? remotePaintTextures[d.owner_id] : undefined)} />)}
        <TagDetector enabled={seekerCanTag} myPoseRef={myPoseRef} remoteStates={remoteStates} players={room.players} bestRef={bestTagRef} onBest={onBest} />
        {shots.map((shot) => <Tracer key={shot.id} shot={shot} />)}
      </Physics>
      <SeekerCombat enabled={seekerCanTag} send={send} />
      <MouseLook yawRef={yawRef} pitchRef={pitchRef} active={true} />
      <EyedropperSampler enabled={role === "hider" && phase !== "seeking"} />
      {(mode === "spectator" || !isPlayable) && <SpectatorRig yawRef={yawRef} pitchRef={pitchRef} />}
      <color attach="background" args={[mapDef.sky]} />
      <fog attach="fog" args={[mapDef.fog[0], mapDef.fog[1], mapDef.fog[2]]} />
    </>
  );
}

function isTouchLikeEvent(e: React.PointerEvent | PointerEvent | unknown) {
  const pe = e as { pointerType?: string };
  return pe?.pointerType === "touch" || pe?.pointerType === "pen";
}

export function RoomArena({ room, meId, myPlayer, remoteStates, remotePaintTextures, decoys, scores, shimmerIds, shots, notice, send }: {
  room: Room;
  meId: string;
  myPlayer: RoomPlayer | null;
  remoteStates: Record<string, RemoteState>;
  remotePaintTextures: Record<string, string>;
  decoys: DecoyState[];
  scores: Record<string, number>;
  shimmerIds: Record<string, number>;
  shots: Shot[];
  notice?: string | null;
  send: (type: string, payload?: unknown) => void;
}) {
  const myPoseRef = useRef<PlayerPose | null>(null);
  const bestTagRef = useRef<string | null>(null);
  const paintUploadedRef = useRef(false);
  const [eventMsg, setEventMsg] = useState<string | null>(null);
  const [canTagNow, setCanTagNow] = useState(false);
  const [now, setNow] = useState(Date.now());
  const activeSheet = useGameStore((s) => s.activeSheet);
  const toggleSheet = useGameStore((s) => s.toggleSheet);
  const setActiveSheet = useGameStore((s) => s.setActiveSheet);
  const camoOpen = activeSheet === "camo";
  const hudOpen = activeSheet === "hud";

  const paintColor = useGameStore((s) => s.paintColor);
  const setPaintColor = useGameStore((s) => s.setPaintColor);
  const pose = useGameStore((s) => s.pose);
  const setPose = useGameStore((s) => s.setPose);
  const hiderSize = useGameStore((s) => s.hiderSize);
  const setHiderSize = useGameStore((s) => s.setHiderSize);
  const locked = useGameStore((s) => s.locked);
  const setLocked = useGameStore((s) => s.setLocked);
  const sampledWorldColor = useGameStore((s) => s.sampledWorldColor);
  const paintCompleteness = useGameStore((s) => s.paintCompleteness);
  const requestWorldSample = useGameStore((s) => s.requestWorldSample);
  const camoScore = computeCamoScore({ pose, size: hiderSize, locked, paintCompleteness, sampledWorldColor });
  const ammo = useGameStore((s) => s.ammo);
  const gunReloading = useGameStore((s) => s.gunReloading);
  const gunSlowRemaining = useGameStore((s) => s.gunSlowRemaining);
  const paintOpen = useGameStore((s) => s.paintOpen);
  const setPaintOpen = useGameStore((s) => s.setPaintOpen);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => () => useGameStore.getState().setActiveSheet(null), []);
  useEffect(() => { if (paintOpen) setActiveSheet(null); }, [paintOpen, setActiveSheet]);

  useEffect(() => {
    if (!eventMsg) return;
    const t = setTimeout(() => setEventMsg(null), 2500);
    return () => clearTimeout(t);
  }, [eventMsg]);

  const phase = room.phase || "lobby";
  const role = myPlayer?.team || "hider";
  useEffect(() => { setActiveSheet(null); }, [phase, role, setActiveSheet]);
  const seekerCanTag = role === "seeker" && phase === "seeking" && myPlayer?.alive !== false;
  const ends = room.phase_ends_at ? new Date(room.phase_ends_at).getTime() : null;
  const remaining = ends ? Math.max(0, Math.ceil((ends - now) / 1000)) : null;
  const seekers = room.players.filter(p => p.team === "seeker").length;
  const hidersAlive = room.players.filter(p => p.team === "hider" && p.alive !== false).length;
  const mapDef = getMapDef(room.map_id);

  useEffect(() => {
    if (phase === "hiding" || phase === "lobby") paintUploadedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (role !== "hider" || phase === "seeking" || phase === "ended") {
      if (useGameStore.getState().paintOpen) setPaintOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.code === "KeyF") setPaintOpen(!useGameStore.getState().paintOpen);
      if (e.code === "Escape" && useGameStore.getState().paintOpen) setPaintOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [role, phase, setPaintOpen]);

  useEffect(() => {
    if (role !== "hider" || myPlayer?.alive === false || phase === "ended") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.repeat) return;
      if (e.code === "KeyB") send("decoy.place", {});
      if (e.code === "KeyV") send("hider.whistle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [role, phase, myPlayer?.alive, send]);


  useEffect(() => {
    if (role !== "hider" || myPlayer?.alive === false || phase === "ended") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.repeat) return;
      const st = useGameStore.getState();
      if (e.code === "KeyL") st.setLocked(!st.locked);
      if (e.code === "Digit1") st.setCameraMode("first");
      if (e.code === "Digit2") st.setCameraMode("third");
      if (e.code === "Digit3") st.setCameraMode("spectator");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [role, phase, myPlayer?.alive]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(".touch-ui, .game-panel, button, input, label, a, .camouflage-bar")) return;
    if (isTouchLikeEvent(e)) {
      setActiveSheet(null);
      return;
    }
    const el = e.currentTarget.querySelector("canvas") as HTMLCanvasElement | null;
    if (el && document.pointerLockElement !== el) {
      try { el.requestPointerLock(); } catch { /* ignore */ }
    }
  };

  const statusText = phase === "hiding" && role === "seeker" ? "Hunters wait... chameleons are hiding!"
    : phase === "hiding" && role === "hider" ? "Hide & Blend! Paint, pick a pose, lock to camouflage."
    : phase === "seeking" && role === "seeker" ? "Hunt & Seek! Find painted chameleons and tag them."
    : phase === "seeking" && role === "hider" ? "Stay blended! Don't let hunters spot you."
    : phase === "ended" ? `Round over: ${room.winner_team === "seekers" ? "Hunters" : room.winner_team === "hiders" ? "Chameleons" : room.winner_team || "-"} win!`
    : "Hunt & Seek Lobby";

  const phaseClass = phase === "hiding" ? "hiding" : phase === "seeking" ? "seeking" : phase === "ended" ? "ended" : "";
  const poseOptions: { id: HiderPose; label: string }[] = POSES.map((p) => ({ id: p.id as HiderPose, label: p.label }));

  const handlePaintApply = (dataUrl: string, completeness: number) => {
    if (role !== "hider" || phase !== "hiding") {
      setEventMsg("Paint can only be uploaded during hiding.");
      return;
    }
    if (paintUploadedRef.current) {
      setEventMsg("Paint already uploaded for this round.");
      return;
    }
    paintUploadedRef.current = true;
    send("paint.upload", { dataUrl, completeness });
    setEventMsg("Paint uploaded — others see it when the hunt begins.");
  };

  return (
    <div className="game-root arena-root huntseek-root" style={{ position: "relative", inset: 0, height: "100%" }} onPointerDown={onPointerDown}>
      <Canvas shadows camera={{ fov: 75, position: [0, 4, 24] }}>
        <ArenaScene room={room} meId={meId} myPlayer={myPlayer} remoteStates={remoteStates} remotePaintTextures={remotePaintTextures} decoys={decoys} shimmerIds={shimmerIds} shots={shots} send={send} myPoseRef={myPoseRef} bestTagRef={bestTagRef} onBest={(id) => setCanTagNow(!!id)} />
      </Canvas>
      <div className="game-overlay huntseek-overlay">
        <button className={`mobile-sheet-toggle hud-toggle ${hudOpen ? "active" : ""}`} aria-expanded={hudOpen} onPointerDown={() => toggleSheet("hud")}>{hudOpen ? "Close" : "HUD"}</button>
        {role === "hider" && myPlayer?.alive !== false && <button className={`mobile-sheet-toggle camo-toggle ${camoOpen ? "active" : ""}`} aria-expanded={camoOpen} onPointerDown={() => toggleSheet("camo")}>{camoOpen ? "Close" : "Blend"}</button>}
        <div className={`game-topbar huntseek-topbar ${hudOpen ? "mobile-open" : ""}`}>

          <div className="arena-hud-stats">
            <strong className="brand-pill">Meccha Hunt & Seek</strong>
            <span className="badge">Map: {mapDef.name}</span>
            <span className={`badge ${phase === "seeking" ? "live" : ""}`}>Phase: {phase}{remaining != null ? ` ${remaining}s` : ""}</span>
            <span className={`badge ${role === "seeker" ? "seeker" : role === "hider" ? "hider" : ""}`}>You: {role === "seeker" ? "Hunter" : role === "hider" ? "Chameleon" : role}{myPlayer?.alive === false ? " (caught)" : ""}</span>
          </div>
          <div className="arena-hud-stats">
            <span className="stat-chip bad">Hunters: {seekers}</span>
            <span className="stat-chip good">Chameleons: {hidersAlive}</span>
            <span className="stat-chip">Score: {scores[meId] ?? 0}</span>
            {role === "seeker" && phase === "seeking" && (
              <>
                <span className={`stat-chip ${ammo <= 3 ? "bad" : ""}`}>Ammo: {ammo}/12</span>
                {gunReloading && <span className="stat-chip warn">Reloading...</span>}
                {gunSlowRemaining > 0 && <span className="stat-chip bad">Miss penalty</span>}
              </>
            )}
            {room.winner_team && <span className="stat-chip warn">Winner: {room.winner_team === "seekers" ? "Hunters" : "Chameleons"}</span>}
          </div>
          <div className={`phase-banner ${phaseClass}`}>{statusText}</div>
        </div>
        {(eventMsg || notice) && <div className="game-locked" style={{ top: 86 }}>{eventMsg || notice}</div>}
        {canTagNow && seekerCanTag && <div className="game-locked pulse-danger" style={{ top: 128, background: "rgba(220,38,38,0.92)" }}>Target nearby! Aim & fire (Q pings for your team)</div>}
        <div className="game-crosshair">+</div>

        {role === "hider" && myPlayer?.alive !== false && (
          <div className={`camouflage-bar ${camoOpen ? "mobile-open" : ""}`}>

            <div className="camo-title">Paint & Blend {locked ? "(Locked)" : ""}</div>
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
            <div className="pose-row">
              {SIZES.map((s) => (
                <button key={s.id} className={`btn secondary pose-btn ${hiderSize === s.id ? "active" : ""}`} onClick={() => setHiderSize(s.id as HiderSize)}>{s.label}</button>
              ))}
            </div>
            <div className="row">
              <button className={`btn ${locked ? "warn" : ""}`} onClick={() => setLocked(!locked)}>{locked ? "Unlock / Move (L)" : "Lock / Blend (L)"}</button>
              <button className="btn secondary" onClick={() => requestWorldSample()}>Sample surface</button>
              {sampledWorldColor && <span className="swatch sampled" style={{ background: sampledWorldColor }} title={sampledWorldColor} />}
              <span className={`stat-chip ${camoScore >= 62 ? "good" : camoScore >= 40 ? "warn" : "bad"}`}>Blend {camoScore} · {camoLabel(camoScore)}</span>
            </div>
            <div className="row">
              <button className="btn" onClick={() => setPaintOpen(true)}>Paint & Pose (F)</button>
              <span className="small muted camo-hint">Sample a nearby surface, paint, pick a prop-like pose, then Lock. High blend hides your tag and reduces shimmer.</span>
            </div>
          </div>
        )}

          <div className="game-panel arena-panel huntseek-panel">
            <div className="small muted">Desktop: WASD move, mouse look, Space jump, Shift sprint, C crouch, Z prone, 1/2/3 camera, L lock/blend, F paint, G spectator follow. Hunters: left click shoot, R reload, right click/Q spot ping.</div>
            <div className="small muted">Chameleons: F paint, B place painted decoy (max 3), V whistle to reset the forced-taunt timer. Hunters: spot anything odd, aim and shoot — missed shots cost ammo and slow you down; decoys waste ammo but are not hiders.</div>
          </div>
          <PaintPanel open={paintOpen && role === "hider" && phase !== "seeking"} onClose={() => setPaintOpen(false)} onApply={handlePaintApply} />
        </div>
        <VirtualControls layout={role === "seeker" ? "seeker" : "hider"} showCombat={role === "seeker" && seekerCanTag} showPaint={role === "hider" && phase !== "seeking" && myPlayer?.alive !== false} showTricks={role === "hider" && myPlayer?.alive !== false && phase !== "ended"} onDecoy={() => send("decoy.place", {})} onWhistle={() => send("hider.whistle")} />
      </div>
  );
}

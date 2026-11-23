import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, type RapierRigidBody, useRapier } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboardInput } from "../useKeyboardInput";
import { useGameStore, type HiderPose } from "../store";
import { canvasFromDataUrl, computeCamoScore, createRegionTextures, getPose, getSizeScale, type BodyRegionId, type RegionTextures } from "../paint";

export type PlayerPose = {
  x: number; y: number; z: number; yaw: number; pitch: number; mode: string; locked: boolean; paintColor: string; tintColor: string; camoScore: number; pose: string; size: string;
};

export type PaintMaterialProps = { map?: THREE.Texture; color?: string };
export type PaintFor = (region: BodyRegionId) => PaintMaterialProps;
export type PlayerMotion = { moving: boolean; grounded: boolean; speed: number };

function HunterModel({ motion }: { motion: React.MutableRefObject<PlayerMotion> }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    const { moving, speed, grounded } = motion.current;
    const sf = THREE.MathUtils.clamp(speed / 4.2, 0.5, 1.8);
    const swing = moving && grounded ? Math.sin(t.current * 9.5 * sf) * (0.45 + sf * 0.1) : 0;
    const idle = Math.sin(t.current * 2) * 0.02;
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.8;
    if (rArm.current) rArm.current.rotation.x = swing * 0.8;
    if (g.current) g.current.position.y = idle * 0.2;
  });
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.82, 0]}>
        <boxGeometry args={[0.56, 0.64, 0.36]} />
        <meshStandardMaterial color="#b91c1c" metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0, 1.32, 0]}>
        <boxGeometry args={[0.36, 0.34, 0.36]} />
        <meshStandardMaterial color="#7f1d1d" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 1.38, 0.19]}>
        <boxGeometry args={[0.24, 0.1, 0.04]} />
        <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={lLeg} castShadow position={[-0.14, 0.33, 0]}>
        <boxGeometry args={[0.17, 0.48, 0.19]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh ref={rLeg} castShadow position={[0.14, 0.33, 0]}>
        <boxGeometry args={[0.17, 0.48, 0.19]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh ref={lArm} castShadow position={[-0.4, 0.84, 0]}>
        <boxGeometry args={[0.13, 0.44, 0.15]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
      <mesh ref={rArm} castShadow position={[0.4, 0.84, 0]}>
        <boxGeometry args={[0.13, 0.44, 0.15]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
      <group position={[0.4, 0.82, -0.24]}>
        <HunterGun scale={0.8} />
      </group>
      <mesh castShadow position={[0, 0.92, -0.22]}>

        <boxGeometry args={[0.28, 0.34, 0.12]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
    </group>
  );
}

export function HunterGun({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh castShadow position={[0, 0, -0.18]}>
        <boxGeometry args={[0.12, 0.14, 0.55]} />
        <meshStandardMaterial color="#111827" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, 0.02, -0.53]}>
        <boxGeometry args={[0.06, 0.06, 0.26]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.22} />
      </mesh>
      <mesh castShadow position={[0, -0.14, 0.02]}>
        <boxGeometry args={[0.09, 0.2, 0.13]} />
        <meshStandardMaterial color="#1f2937" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.1, -0.2]}>
        <boxGeometry args={[0.035, 0.045, 0.16]} />
        <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

export function ChameleonHumanoid({ paintFor, motion }: { paintFor: PaintFor; motion: React.MutableRefObject<PlayerMotion> }) {

  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const tail = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    const { moving, speed, grounded } = motion.current;
    const sf = THREE.MathUtils.clamp(speed / 4.0, 0.5, 1.8);
    const swing = moving && grounded ? Math.sin(t.current * 9 * sf) * 0.42 : 0;
    const idle = Math.sin(t.current * 2.2) * 0.03;
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.8;
    if (rArm.current) rArm.current.rotation.x = swing * 0.8;
    if (tail.current) tail.current.rotation.z = Math.sin(t.current * 3) * 0.25 + 0.5;
    if (g.current) g.current.position.y = idle * 0.25;
  });
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[0.48, 0.58, 0.32]} />
        <meshStandardMaterial {...paintFor("torso")} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 1.24, 0.02]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial {...paintFor("head")} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.08, 1.27, 0.16]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh castShadow position={[-0.08, 1.27, 0.16]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh ref={lLeg} castShadow position={[-0.13, 0.32, 0]}>
        <boxGeometry args={[0.15, 0.44, 0.17]} />
        <meshStandardMaterial {...paintFor("leg_l")} roughness={0.7} />
      </mesh>
      <mesh ref={rLeg} castShadow position={[0.13, 0.32, 0]}>
        <boxGeometry args={[0.15, 0.44, 0.17]} />
        <meshStandardMaterial {...paintFor("leg_r")} roughness={0.7} />
      </mesh>
      <mesh ref={lArm} castShadow position={[-0.34, 0.8, 0]}>
        <boxGeometry args={[0.11, 0.4, 0.13]} />
        <meshStandardMaterial {...paintFor("arm_l")} roughness={0.6} />
      </mesh>
      <mesh ref={rArm} castShadow position={[0.34, 0.8, 0]}>
        <boxGeometry args={[0.11, 0.4, 0.13]} />
        <meshStandardMaterial {...paintFor("arm_r")} roughness={0.6} />
      </mesh>
      <mesh ref={tail} castShadow position={[0, 0.62, -0.22]}>
        <torusGeometry args={[0.12, 0.04, 8, 16, Math.PI * 1.3]} />
        <meshStandardMaterial {...paintFor("torso")} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function CamouflageForm({ pose, paintColor, paintFor, locked, camoScore = 0 }: { pose: HiderPose; paintColor: string; paintFor: PaintFor; locked: boolean; camoScore?: number }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 10);
  useFrame((_, dt) => {
    t.current += dt;
    if (!g.current) return;
    const wobble = locked ? Math.sin(t.current * 2.4) * 0.01 : Math.sin(t.current * 1.8) * 0.018;
    const s = 1 + wobble;
    g.current.scale.set(s, 1 + (locked ? Math.sin(t.current * 2.1) * 0.008 : wobble), s);
  });
  const emissive = locked ? paintColor : "#000000";
  const emissiveIntensity = locked ? 0.12 : 0;
  const ringOpacity = Math.max(0.04, 0.22 - camoScore / 620);
  const shape = getPose(pose).camoShape;
  if (shape === "prone") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.22, 0]}>
          <boxGeometry args={[1.1, 0.35, 1.1]} />
          <meshStandardMaterial {...paintFor("torso")} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0.15, 0.42, 0.1]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial {...paintFor("head")} roughness={0.7} />
        </mesh>
        {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.45, 0.65, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={ringOpacity} /></mesh>}
      </group>
    );
  }
  if (shape === "tuck" || shape === "lean") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.32, 0.38, 1.2, 12]} />
          <meshStandardMaterial {...paintFor("torso")} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 1.3, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial {...paintFor("head")} roughness={0.75} />
        </mesh>
        {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.3, 0.48, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={ringOpacity} /></mesh>}
      </group>
    );
  }
  if (shape === "crouch") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.38, 0]}>
          <boxGeometry args={[0.78, 0.68, 0.78]} />
          <meshStandardMaterial {...paintFor("torso")} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, 0.78, 0]}>
          <boxGeometry args={[0.45, 0.16, 0.45]} />
          <meshStandardMaterial {...paintFor("head")} roughness={0.8} />
        </mesh>
        {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.32, 0.5, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={ringOpacity} /></mesh>}
      </group>
    );
  }
  if (shape === "wide") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.62, 0]}>
          <boxGeometry args={[1.05, 1.05, 0.7]} />
          <meshStandardMaterial {...paintFor("torso")} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.82} />
        </mesh>
        <mesh castShadow position={[0, 1.22, 0.05]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial {...paintFor("head")} roughness={0.7} />
        </mesh>
        {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.4, 0.58, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={ringOpacity} /></mesh>}
      </group>
    );
  }
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.62, 0]}>
        <boxGeometry args={[0.74, 1.05, 0.74]} />
        <meshStandardMaterial {...paintFor("torso")} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 1.22, 0.05]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial {...paintFor("head")} roughness={0.7} />
      </mesh>
      {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.34, 0.52, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={ringOpacity} /></mesh>}
    </group>
  );
}

function dimsFor(pose: HiderPose, seeker: boolean) {
  if (seeker) {
    const p = getPose("stand");
    return { halfH: p.halfH, radius: p.radius, eye: p.eye, speedMul: 1, canJump: true, camoShape: p.camoShape };
  }
  const p = getPose(pose);
  return { halfH: p.halfH, radius: p.radius, eye: p.eye, speedMul: p.speedMul, canJump: p.canJump, camoShape: p.camoShape };
}

export function PlayerRig({
  yawRef,
  pitchRef,
  canMove = true,
  allowJump = true,
  spawn = [0, 3, 20],
  visibleInFirst = false,
  onPose,
  isSeeker = false,
}: {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
  canMove?: boolean;
  allowJump?: boolean;
  spawn?: [number, number, number];
  visibleInFirst?: boolean;
  onPose?: (pose: PlayerPose) => void;
  isSeeker?: boolean;
}) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const keys = useKeyboardInput();
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const { world, rapier } = useRapier();
  const { camera } = useThree();
  const mode = useGameStore((s) => s.cameraMode);
  const lockedProp = useGameStore((s) => s.locked);
  const fov = useGameStore((s) => s.fov);
  const headBobEnabled = useGameStore((s) => s.headBob);
  const paintColor = useGameStore((s) => s.paintColor);
  const sampledWorldColor = useGameStore((s) => s.sampledWorldColor);
  const paintCompleteness = useGameStore((s) => s.paintCompleteness);
  const hiderSize = useGameStore((s) => s.hiderSize);
  const paintTextureDataUrl = useGameStore((s) => s.paintTextureDataUrl);
  const poseSel = useGameStore((s) => s.pose);
  const [paintCanvas, setPaintCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!paintTextureDataUrl) {
      setPaintCanvas(null);
      return;
    }
    canvasFromDataUrl(paintTextureDataUrl).then((canvas) => {
      if (!cancelled) setPaintCanvas(canvas);
    }).catch(() => {
      if (!cancelled) setPaintCanvas(null);
    });
    return () => { cancelled = true; };
  }, [paintTextureDataUrl]);
  const regionTextures = useMemo<RegionTextures | null>(() => paintCanvas ? createRegionTextures(paintCanvas) : null, [paintCanvas]);
  useEffect(() => () => {
    if (regionTextures) Object.values(regionTextures).forEach((tex) => tex.dispose());
  }, [regionTextures]);
  const tintColor = sampledWorldColor || paintColor;
  const camoScore = computeCamoScore({ pose: poseSel, size: hiderSize, locked: lockedProp, paintCompleteness, sampledWorldColor });
  const paintFor: PaintFor = (region) => regionTextures ? { map: regionTextures[region], color: tintColor } : { color: tintColor };
  const bobTime = useRef(0);
  const poseAcc = useRef(0);
  const smoothEye = useRef(1.6);
  const smoothFootOffset = useRef(0.95);
  const smoothVel = useRef({ x: 0, z: 0 });
  const smoothFov = useRef(fov);
  const viewGun = useRef<THREE.Group>(null);
  const anim = useRef<PlayerMotion>({ moving: false, grounded: false, speed: 0 });


  useEffect(() => { smoothFov.current = fov; }, [fov]);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const k = keysRef.current;
    const pos = rb.translation();
    const vel = rb.linvel();
    if (visual.current) visual.current.rotation.y = yawRef.current;
    const rawPose: HiderPose = isSeeker ? "stand" : poseSel;
    let effPose: HiderPose = rawPose;
    if (!isSeeker && rawPose === "stand" && k.crouch) effPose = "crouch_ball";
    if (!isSeeker && rawPose === "stand" && k.prone) effPose = "flat_floor";
    const dims = dimsFor(effPose, isSeeker);
    const footOffset = dims.halfH + dims.radius;
    const eyeLerp = 1 - Math.pow(0.0012, dt);
    smoothEye.current = THREE.MathUtils.lerp(smoothEye.current, dims.eye, eyeLerp);
    smoothFootOffset.current = THREE.MathUtils.lerp(smoothFootOffset.current, footOffset, eyeLerp);
    const eye = smoothEye.current;
    const baseY = pos.y - smoothFootOffset.current;

    if (mode === "spectator") {
      rb.setLinvel({ x: 0, y: vel.y, z: 0 }, true);
      anim.current = { moving: false, grounded: true, speed: 0 };
      onPose?.({ x: pos.x, y: pos.y, z: pos.z, yaw: yawRef.current, pitch: pitchRef.current, mode, locked: lockedProp, paintColor, tintColor, camoScore, pose: effPose, size: hiderSize });
      return;
    }

    const movable = canMove && !lockedProp;
    let targetVx = 0;
    let targetVz = 0;
    let sprinting = false;
    if (movable) {
      const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
      const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));
      const dir = new THREE.Vector3();
      if (k.forward) dir.add(forward);
      if (k.backward) dir.sub(forward);
      if (k.left) dir.sub(right);
      if (k.right) dir.add(right);
      if (dir.lengthSq() > 0) dir.normalize();
      const canSprint = isSeeker ? !k.crouch : (effPose === "stand" && !k.crouch);
      sprinting = !!k.sprint && canSprint && dir.lengthSq() > 0;
      const baseSpeed = sprinting ? 7.4 : 4.3;
      const poseMul = isSeeker ? (k.crouch ? 0.56 : 1) : dims.speedMul;
      const slowMul = useGameStore.getState().gunSlowRemaining > 0 ? 0.55 : 1;
      const speed = baseSpeed * poseMul * slowMul;
      targetVx = dir.x * speed;
      targetVz = dir.z * speed;
    }

    const hasInput = movable && (Math.abs(targetVx) + Math.abs(targetVz) > 0.01);
    // ground check tuned per pose
    const rayOriginY = pos.y - footOffset + 0.12;
    const ray = new rapier.Ray({ x: pos.x, y: rayOriginY, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 0.35, true);
    const grounded = !!hit && hit.timeOfImpact < 0.22;

    const accel = hasInput ? (grounded ? 18 : 7) : (grounded ? 22 : 2.5);
    const velLerp = 1 - Math.exp(-accel * dt);
    smoothVel.current.x = THREE.MathUtils.lerp(smoothVel.current.x, targetVx, velLerp);
    smoothVel.current.z = THREE.MathUtils.lerp(smoothVel.current.z, targetVz, velLerp);
    if (!hasInput && Math.abs(smoothVel.current.x) < 0.03) smoothVel.current.x = 0;
    if (!hasInput && Math.abs(smoothVel.current.z) < 0.03) smoothVel.current.z = 0;
    const vx = smoothVel.current.x;
    const vz = smoothVel.current.z;
    rb.setLinvel({ x: vx, y: vel.y, z: vz }, true);

    if (k.jump && grounded && movable && allowJump && (isSeeker || dims.canJump)) {
      rb.setLinvel({ x: vx, y: 5.35, z: vz }, true);
    }

    const speedNow = Math.sqrt(vx * vx + vz * vz);
    const moving = speedNow > 0.12 && grounded;
    anim.current = { moving, grounded, speed: speedNow };
    bobTime.current += dt * (moving && mode === "first" && headBobEnabled ? 10.5 : 0);
    const bob = moving && mode === "first" && headBobEnabled ? Math.sin(bobTime.current) * 0.028 : 0;
    if (viewGun.current) {
      viewGun.current.position.y = 1.02 + bob * 1.8;
      viewGun.current.rotation.x = -pitchRef.current * 0.55 + bob * 0.5;
      viewGun.current.rotation.z = bob * 0.8;
    }

    const cam = camera as THREE.PerspectiveCamera;

    if ("fov" in cam) {
      const desiredFov = fov + (sprinting && moving ? 5 : 0);
      smoothFov.current = THREE.MathUtils.lerp(smoothFov.current, desiredFov, 1 - Math.pow(0.0015, dt));
      cam.fov = smoothFov.current;
      cam.updateProjectionMatrix();
    }

    if (mode === "first") {
      camera.position.set(pos.x, baseY + eye + bob, pos.z);
      const lookDir = new THREE.Vector3(
        -Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        Math.sin(pitchRef.current),
        -Math.cos(yawRef.current) * Math.cos(pitchRef.current),
      );
      camera.lookAt(camera.position.clone().add(lookDir));
    } else {
      const target = new THREE.Vector3(pos.x, baseY + Math.max(0.6, eye - 0.3), pos.z);
      const proneish = dims.camoShape === "prone";
      const dist = proneish ? 3.6 : 4.7;
      const dirCam = new THREE.Vector3(
        Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        -Math.sin(pitchRef.current),
        Math.cos(yawRef.current) * Math.cos(pitchRef.current),
      ).normalize();
      let desired = target.clone().add(dirCam.multiplyScalar(dist));
      const toDesired = desired.clone().sub(target);
      const len = toDesired.length();
      if (len > 0.001) {
        toDesired.normalize();
        const ray2 = new rapier.Ray(
          { x: target.x, y: target.y, z: target.z },
          { x: toDesired.x, y: toDesired.y, z: toDesired.z },
        );
        const hit2 = world.castRay(ray2, len, true);
        if (hit2) {
          desired = target.clone().add(toDesired.multiplyScalar(Math.max(0.55, hit2.timeOfImpact - 0.22)));
        }
      }
      const camLerp = 1 - Math.pow(0.00045, dt);
      camera.position.lerp(desired, camLerp);
      camera.lookAt(target);
    }

    poseAcc.current += dt;
    if (onPose && poseAcc.current >= 0.05) {
      poseAcc.current = 0;
      onPose({ x: pos.x, y: pos.y, z: pos.z, yaw: yawRef.current, pitch: pitchRef.current, mode, locked: lockedProp, paintColor, tintColor, camoScore, pose: effPose, size: hiderSize });
    }
  });

  const rawPose: HiderPose = isSeeker ? "stand" : poseSel;
  let effPose: HiderPose = rawPose;
  if (!isSeeker && rawPose === "stand" && keys.crouch) effPose = "crouch_ball";
  const dims = dimsFor(effPose, isSeeker);
  const footOffset = dims.halfH + dims.radius;
  const showBody = mode !== "first" || visibleInFirst;
  const useCamouflage = !isSeeker && (lockedProp || effPose !== "stand");

  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={1}
      position={spawn}
      enabledRotations={[false, false, false]}
      linearDamping={0.25}
      friction={1}
      canSleep={false}
    >
      <CapsuleCollider key={`${effPose}-${dims.halfH}-${dims.radius}`} args={[dims.halfH, dims.radius]} />
      <group ref={visual} position={[0, -footOffset, 0]}>
        <group scale={isSeeker ? 1 : getSizeScale(hiderSize)}>
          {showBody && (
            isSeeker ? (
              <HunterModel motion={anim} />
            ) : useCamouflage ? (
              <CamouflageForm pose={effPose} paintColor={tintColor} paintFor={paintFor} locked={lockedProp} camoScore={camoScore} />
            ) : (
              <ChameleonHumanoid paintFor={paintFor} motion={anim} />
            )
          )}
        </group>
        {mode === "first" && !visibleInFirst && isSeeker && (
          <group ref={viewGun} position={[0.28, 1.02, -0.42]} rotation={[0, -0.12, 0]}>
            <HunterGun scale={0.72} />
          </group>
        )}
        {mode === "first" && !visibleInFirst && !isSeeker && (
          <mesh position={[0.25, 1.2, -0.5]} castShadow>
            <boxGeometry args={[0.08, 0.08, 0.5]} />
            <meshStandardMaterial color={tintColor} />
          </mesh>
        )}

      </group>
    </RigidBody>
  );
}

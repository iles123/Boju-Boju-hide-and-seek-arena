import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, type RapierRigidBody, useRapier } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboardInput } from "../useKeyboardInput";
import { useGameStore, type HiderPose } from "../store";

export type PlayerPose = {
  x: number; y: number; z: number; yaw: number; pitch: number; mode: string; locked: boolean; paintColor: string; pose: string;
};

function HunterModel({ moving, speed, grounded }: { moving: boolean; speed: number; grounded: boolean }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
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
      <mesh castShadow position={[0, 0.92, -0.22]}>
        <boxGeometry args={[0.28, 0.34, 0.12]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
    </group>
  );
}

function ChameleonHumanoid({ paintColor, moving, speed, grounded }: { paintColor: string; moving: boolean; speed: number; grounded: boolean }) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const tail = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
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
        <meshStandardMaterial color={paintColor} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 1.24, 0.02]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial color={paintColor} roughness={0.5} />
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
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh ref={rLeg} castShadow position={[0.13, 0.32, 0]}>
        <boxGeometry args={[0.15, 0.44, 0.17]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh ref={lArm} castShadow position={[-0.34, 0.8, 0]}>
        <boxGeometry args={[0.11, 0.4, 0.13]} />
        <meshStandardMaterial color={paintColor} roughness={0.6} />
      </mesh>
      <mesh ref={rArm} castShadow position={[0.34, 0.8, 0]}>
        <boxGeometry args={[0.11, 0.4, 0.13]} />
        <meshStandardMaterial color={paintColor} roughness={0.6} />
      </mesh>
      <mesh ref={tail} castShadow position={[0, 0.62, -0.22]}>
        <torusGeometry args={[0.12, 0.04, 8, 16, Math.PI * 1.3]} />
        <meshStandardMaterial color={paintColor} roughness={0.6} />
      </mesh>
    </group>
  );
}

function CamouflageForm({ pose, paintColor, locked }: { pose: HiderPose; paintColor: string; locked: boolean }) {
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
  if (pose === "prone") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.22, 0]}>
          <boxGeometry args={[1.1, 0.35, 1.1]} />
          <meshStandardMaterial color={paintColor} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0.15, 0.42, 0.1]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color={paintColor} roughness={0.7} />
        </mesh>
        {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.45, 0.65, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={0.18} /></mesh>}
      </group>
    );
  }
  if (pose === "tuck") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.32, 0.38, 1.2, 12]} />
          <meshStandardMaterial color={paintColor} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 1.3, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial color={paintColor} roughness={0.75} />
        </mesh>
        {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.3, 0.48, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={0.18} /></mesh>}
      </group>
    );
  }
  if (pose === "crouch") {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.38, 0]}>
          <boxGeometry args={[0.78, 0.68, 0.78]} />
          <meshStandardMaterial color={paintColor} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, 0.78, 0]}>
          <boxGeometry args={[0.45, 0.16, 0.45]} />
          <meshStandardMaterial color={paintColor} roughness={0.8} />
        </mesh>
        {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.32, 0.5, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={0.18} /></mesh>}
      </group>
    );
  }
  // stand camouflage blob/prop form
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.62, 0]}>
        <boxGeometry args={[0.74, 1.05, 0.74]} />
        <meshStandardMaterial color={paintColor} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 1.22, 0.05]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color={paintColor} roughness={0.7} />
      </mesh>
      {locked && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.34, 0.52, 24]} /><meshBasicMaterial color={paintColor} transparent opacity={0.18} /></mesh>}
    </group>
  );
}

function poseDims(pose: HiderPose) {
  if (pose === "prone") return { halfH: 0.14, radius: 0.34, eye: 0.5, speedMul: 0.38, canJump: false };
  if (pose === "tuck") return { halfH: 0.42, radius: 0.28, eye: 1.25, speedMul: 0.5, canJump: false };
  if (pose === "crouch") return { halfH: 0.35, radius: 0.35, eye: 1.1, speedMul: 0.56, canJump: true };
  return { halfH: 0.6, radius: 0.35, eye: 1.6, speedMul: 1, canJump: true };
}

export function PlayerRig({
  yawRef,
  pitchRef,
  canMove = true,
  allowJump = true,
  spawn = [0, 2, 20],
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
  const poseSel = useGameStore((s) => s.pose);
  const bobTime = useRef(0);
  const poseAcc = useRef(0);
  const smoothEye = useRef(1.6);
  const smoothVel = useRef({ x: 0, z: 0 });
  const smoothFov = useRef(fov);
  const anim = useRef({ moving: false, grounded: false, speed: 0 });

  useEffect(() => { smoothFov.current = fov; }, [fov]);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const k = keysRef.current;
    const pos = rb.translation();
    const vel = rb.linvel();
    const rawPose: HiderPose = isSeeker ? "stand" : poseSel;
    const effPose: HiderPose = !isSeeker && rawPose === "stand" && k.crouch ? "crouch" : rawPose;
    const dims = isSeeker ? poseDims("stand") : poseDims(effPose);
    const targetEye = dims.eye;
    const eyeLerp = 1 - Math.pow(0.0008, dt);
    smoothEye.current = THREE.MathUtils.lerp(smoothEye.current, targetEye, eyeLerp);
    const eye = smoothEye.current;

    if (mode === "spectator") {
      rb.setLinvel({ x: 0, y: vel.y, z: 0 }, true);
      anim.current = { moving: false, grounded: true, speed: 0 };
      onPose?.({ x: pos.x, y: pos.y, z: pos.z, yaw: yawRef.current, pitch: pitchRef.current, mode, locked: lockedProp, paintColor, pose: effPose });
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
      const canSprint = !isSeeker ? effPose === "stand" : !k.crouch;
      sprinting = k.sprint && canSprint && (k.forward || k.backward || k.left || k.right);
      const baseSpeed = sprinting ? 7.4 : 4.3;
      const speed = baseSpeed * (isSeeker ? (k.crouch ? 0.56 : 1) : dims.speedMul);
      targetVx = dir.x * speed;
      targetVz = dir.z * speed;
    }
    const accel = movable && (Math.abs(targetVx) + Math.abs(targetVz) > 0.01) ? 15 : 20;
    const velLerp = 1 - Math.exp(-accel * dt);
    smoothVel.current.x = THREE.MathUtils.lerp(smoothVel.current.x, targetVx, velLerp);
    smoothVel.current.z = THREE.MathUtils.lerp(smoothVel.current.z, targetVz, velLerp);
    if (Math.abs(smoothVel.current.x) < 0.01 && Math.abs(targetVx) < 0.01) smoothVel.current.x = 0;
    if (Math.abs(smoothVel.current.z) < 0.01 && Math.abs(targetVz) < 0.01) smoothVel.current.z = 0;
    const vx = smoothVel.current.x;
    const vz = smoothVel.current.z;
    rb.setLinvel({ x: vx, y: vel.y, z: vz }, true);

    const ray = new rapier.Ray({ x: pos.x, y: pos.y + 0.1, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 1.4, true);
    const grounded = !!hit && hit.timeOfImpact < 1.22;
    if (k.jump && grounded && movable && allowJump && (isSeeker || dims.canJump)) {
      rb.setLinvel({ x: vx, y: 5.35, z: vz }, true);
    }

    const speedNow = Math.sqrt(vx * vx + vz * vz);
    const moving = speedNow > 0.15 && grounded;
    anim.current = { moving, grounded, speed: speedNow };
    bobTime.current += dt * (moving && mode === "first" && headBobEnabled ? 10.5 : 0);
    const bob = moving && mode === "first" && headBobEnabled ? Math.sin(bobTime.current) * 0.028 : 0;

    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const desiredFov = fov + (sprinting && moving ? 5 : 0);
      smoothFov.current = THREE.MathUtils.lerp(smoothFov.current, desiredFov, 1 - Math.pow(0.0015, dt));
      cam.fov = smoothFov.current;
      cam.updateProjectionMatrix();
    }

    if (mode === "first") {
      camera.position.set(pos.x, pos.y + eye + bob, pos.z);
      const lookDir = new THREE.Vector3(
        -Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        Math.sin(pitchRef.current),
        -Math.cos(yawRef.current) * Math.cos(pitchRef.current),
      );
      camera.lookAt(camera.position.clone().add(lookDir));
    } else {
      const target = new THREE.Vector3(pos.x, pos.y + Math.max(0.6, eye - 0.3), pos.z);
      const dist = effPose === "prone" ? 3.8 : 4.7;
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
          desired = target.clone().add(toDesired.multiplyScalar(Math.max(0.65, hit2.timeOfImpact - 0.22)));
        }
      }
      const camLerp = 1 - Math.pow(0.00045, dt);
      camera.position.lerp(desired, camLerp);
      camera.lookAt(target);
    }

    poseAcc.current += dt;
    if (onPose && poseAcc.current >= 0.05) {
      poseAcc.current = 0;
      onPose({ x: pos.x, y: pos.y, z: pos.z, yaw: yawRef.current, pitch: pitchRef.current, mode, locked: lockedProp, paintColor, pose: effPose });
    }
  });

  const rawPose: HiderPose = isSeeker ? "stand" : poseSel;
  const effPose: HiderPose = !isSeeker && rawPose === "stand" && keys.crouch ? "crouch" : rawPose;
  const dims = isSeeker ? poseDims("stand") : poseDims(effPose);
  const showBody = mode !== "first" || visibleInFirst;
  const useCamouflage = !isSeeker && (lockedProp || effPose !== "stand");
  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={1}
      position={spawn}
      enabledRotations={[false, false, false]}
      linearDamping={0.5}
      canSleep={false}
    >
      <CapsuleCollider key={`${effPose}-${dims.halfH}`} args={[dims.halfH, dims.radius]} />
      {showBody && (
        isSeeker ? (
          <HunterModel moving={anim.current.moving} speed={anim.current.speed} grounded={anim.current.grounded} />
        ) : useCamouflage ? (
          <CamouflageForm pose={effPose} paintColor={paintColor} locked={lockedProp} />
        ) : (
          <ChameleonHumanoid paintColor={paintColor} moving={anim.current.moving} speed={anim.current.speed} grounded={anim.current.grounded} />
        )
      )}
      {mode === "first" && !visibleInFirst && (
        <mesh position={[0.25, 0.9, -0.5]} castShadow>
          <boxGeometry args={[0.08, 0.08, 0.5]} />
          <meshStandardMaterial color={isSeeker ? "#7f1d1d" : paintColor} />
        </mesh>
      )}
    </RigidBody>
  );
}

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, type RapierRigidBody, useRapier } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboardInput } from "../useKeyboardInput";
import { useGameStore } from "../store";

export type PlayerPose = {
  x: number; y: number; z: number; yaw: number; pitch: number; mode: string; locked: boolean;
};

function HumanoidModel({
  color,
  moving,
  speed,
  grounded,
  locked,
  crouch,
}: {
  color: string;
  moving: boolean;
  speed: number;
  grounded: boolean;
  locked: boolean;
  crouch: boolean;
}) {
  const g = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    const time = t.current;
    const speedFactor = THREE.MathUtils.clamp(speed / 4.2, 0.45, 1.9);
    const swing = moving && grounded && !locked ? Math.sin(time * (9.2 * speedFactor)) * (0.45 + speedFactor * 0.12) : 0;
    const idle = Math.sin(time * 2.1) * 0.035;
    const breathe = 1 + (locked ? Math.sin(time * 1.8) * 0.01 : Math.sin(time * 1.6) * 0.005);
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.85;
    if (rArm.current) rArm.current.rotation.x = swing * 0.85;
    if (body.current) body.current.rotation.x = moving && grounded && !locked ? 0.04 + speedFactor * 0.03 : (crouch ? 0.08 : 0);
    if (head.current) {
      head.current.position.y = (crouch ? 1.02 : 1.28) + (locked ? Math.sin(time * 2.2) * 0.006 : idle * 0.45);
      head.current.rotation.z = locked ? 0 : Math.sin(time * 1.3) * 0.02;
      head.current.rotation.x = locked ? 0 : Math.sin(time * 0.9) * 0.015;
    }
    if (g.current) {
      g.current.rotation.z = locked ? 0 : Math.sin(time * 1.1) * 0.006;
      g.current.scale.set(breathe, locked ? 1 + Math.sin(time * 2.0) * 0.008 : breathe, breathe);
      g.current.position.y = THREE.MathUtils.lerp(g.current.position.y, crouch ? -0.12 : 0, 1 - Math.pow(0.0006, dt));
    }
  });

  if (locked) {
    return (
      <group ref={g}>
        <mesh castShadow position={[0, 0.56, 0]}>
          <boxGeometry args={[0.84, 0.9, 0.84]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} roughness={0.75} metalness={0.05} />
        </mesh>
        <mesh castShadow position={[0, 1.09, 0]}>
          <boxGeometry args={[0.54, 0.18, 0.54]} />
          <meshStandardMaterial color="#14532d" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.55, 24]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.18} />
        </mesh>
      </group>
    );
  }

  const legY = crouch ? 0.22 : 0.32;
  const torsoH = crouch ? 0.45 : 0.62;
  const torsoY = crouch ? 0.62 : 0.78;
  return (
    <group ref={g}>
      <mesh ref={body} castShadow position={[0, torsoY, 0]}>
        <boxGeometry args={[0.5, torsoH, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh ref={head} castShadow position={[0, crouch ? 1.02 : 1.28, 0]}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshStandardMaterial color="#f1c27d" roughness={0.5} />
      </mesh>
      <mesh ref={lLeg} castShadow position={[-0.13, legY, 0]}>
        <boxGeometry args={[0.16, 0.46, 0.18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh ref={rLeg} castShadow position={[0.13, legY, 0]}>
        <boxGeometry args={[0.16, 0.46, 0.18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh ref={lArm} castShadow position={[-0.36, crouch ? 0.6 : 0.82, 0]}>
        <boxGeometry args={[0.12, 0.42, 0.14]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh ref={rArm} castShadow position={[0.36, crouch ? 0.6 : 0.82, 0]}>
        <boxGeometry args={[0.12, 0.42, 0.14]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function PlayerRig({
  yawRef,
  pitchRef,
  canMove = true,
  allowJump = true,
  spawn = [0, 2, 20],
  bodyColor = "#2563eb",
  lockedColor = "#16a34a",
  visibleInFirst = false,
  onPose,
}: {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
  canMove?: boolean;
  allowJump?: boolean;
  spawn?: [number, number, number];
  bodyColor?: string;
  lockedColor?: string;
  visibleInFirst?: boolean;
  onPose?: (pose: PlayerPose) => void;
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
  const bobTime = useRef(0);
  const poseAcc = useRef(0);
  const smoothEye = useRef(1.6);
  const smoothVel = useRef({ x: 0, z: 0 });
  const smoothFov = useRef(fov);
  const anim = useRef({ moving: false, grounded: false, crouch: false, speed: 0 });

  useEffect(() => {
    smoothFov.current = fov;
  }, [fov]);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const k = keysRef.current;
    const pos = rb.translation();
    const vel = rb.linvel();
    const crouch = k.crouch;
    const targetEye = crouch ? 1.1 : 1.6;
    const eyeLerp = 1 - Math.pow(0.0008, dt);
    smoothEye.current = THREE.MathUtils.lerp(smoothEye.current, targetEye, eyeLerp);
    const eye = smoothEye.current;

    if (mode === "spectator") {
      rb.setLinvel({ x: 0, y: vel.y, z: 0 }, true);
      anim.current = { moving: false, grounded: true, crouch, speed: 0 };
      onPose?.({ x: pos.x, y: pos.y, z: pos.z, yaw: yawRef.current, pitch: pitchRef.current, mode, locked: lockedProp });
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
      sprinting = k.sprint && !crouch && (k.forward || k.backward || k.left || k.right);
      const baseSpeed = sprinting ? 7.4 : 4.3;
      const speed = baseSpeed * (crouch ? 0.56 : 1);
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
    const hit = world.castRay(ray, 1.35, true);
    const grounded = !!hit && hit.timeOfImpact < 1.18;
    if (k.jump && grounded && movable && allowJump) {
      rb.setLinvel({ x: vx, y: 5.45, z: vz }, true);
    }

    const speedNow = Math.sqrt(vx * vx + vz * vz);
    const moving = speedNow > 0.15 && grounded;
    anim.current = { moving, grounded, crouch, speed: speedNow };
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
      const target = new THREE.Vector3(pos.x, pos.y + (crouch ? 1.0 : 1.3), pos.z);
      const dist = 4.7;
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
      onPose({ x: pos.x, y: pos.y, z: pos.z, yaw: yawRef.current, pitch: pitchRef.current, mode, locked: lockedProp });
    }
  });

  const crouchNow = keys.crouch;
  const halfH = crouchNow ? 0.35 : 0.6;
  const radius = 0.35;
  const showBody = mode !== "first" || visibleInFirst;
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
      <CapsuleCollider key={crouchNow ? "crouch" : "stand"} args={[halfH, radius]} />
      {showBody && (
        <HumanoidModel
          color={lockedProp ? lockedColor : bodyColor}
          moving={anim.current.moving}
          speed={anim.current.speed}
          grounded={anim.current.grounded}
          locked={lockedProp}
          crouch={crouchNow}
        />
      )}
      {mode === "first" && !visibleInFirst && (
        <mesh position={[0.25, 0.9, -0.5]} castShadow>
          <boxGeometry args={[0.08, 0.08, 0.5]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      )}
    </RigidBody>
  );
}

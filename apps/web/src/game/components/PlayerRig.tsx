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
  grounded,
  locked,
  crouch,
}: {
  color: string;
  moving: boolean;
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
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    const time = t.current;
    const swing = moving && grounded && !locked ? Math.sin(time * 11) * 0.55 : 0;
    const idle = Math.sin(time * 2.2) * 0.03;
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.8;
    if (rArm.current) rArm.current.rotation.x = swing * 0.8;
    if (head.current) {
      head.current.position.y = (crouch ? 1.02 : 1.28) + (locked ? Math.sin(time * 3) * 0.01 : idle * 0.5);
      head.current.rotation.z = locked ? 0 : Math.sin(time * 1.4) * 0.03;
    }
    if (g.current) {
      g.current.rotation.z = locked ? 0 : Math.sin(time * 1.1) * 0.01;
      const s = locked ? 1 + Math.sin(time * 2.5) * 0.015 : 1;
      g.current.scale.setScalar(s);
      g.current.position.y = crouch ? -0.12 : 0;
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

  const legY = crouch ? 0.22 : 0.32;
  const torsoH = crouch ? 0.45 : 0.62;
  const torsoY = crouch ? 0.62 : 0.78;
  return (
    <group ref={g}>
      <mesh castShadow position={[0, torsoY, 0]}>
        <boxGeometry args={[0.5, torsoH, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={head} castShadow position={[0, crouch ? 1.02 : 1.28, 0]}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshStandardMaterial color="#f1c27d" />
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
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={rArm} castShadow position={[0.36, crouch ? 0.6 : 0.82, 0]}>
        <boxGeometry args={[0.12, 0.42, 0.14]} />
        <meshStandardMaterial color={color} />
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
  const anim = useRef({ moving: false, grounded: false, crouch: false });

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }, [fov, camera]);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const k = keysRef.current;
    const pos = rb.translation();
    const vel = rb.linvel();
    const crouch = k.crouch;
    const eye = crouch ? 1.1 : 1.6;

    if (mode === "spectator") {
      rb.setLinvel({ x: 0, y: vel.y, z: 0 }, true);
      anim.current = { moving: false, grounded: true, crouch };
      onPose?.({ x: pos.x, y: pos.y, z: pos.z, yaw: yawRef.current, pitch: pitchRef.current, mode, locked: lockedProp });
      return;
    }

    const movable = canMove && !lockedProp;
    let vx = 0;
    let vz = 0;
    if (movable) {
      const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
      const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));
      const dir = new THREE.Vector3();
      if (k.forward) dir.add(forward);
      if (k.backward) dir.sub(forward);
      if (k.left) dir.sub(right);
      if (k.right) dir.add(right);
      if (dir.lengthSq() > 0) dir.normalize();
      const speed = (k.sprint ? 7 : 4) * (crouch ? 0.55 : 1);
      vx = dir.x * speed;
      vz = dir.z * speed;
    }
    rb.setLinvel({ x: vx, y: vel.y, z: vz }, true);

    const ray = new rapier.Ray({ x: pos.x, y: pos.y + 0.1, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 1.3, true);
    const grounded = !!hit && hit.timeOfImpact < 1.15;
    if (k.jump && grounded && movable && allowJump) {
      rb.setLinvel({ x: vx, y: 5.2, z: vz }, true);
    }

    const moving = Math.abs(vx) + Math.abs(vz) > 0.1 && grounded;
    anim.current = { moving, grounded, crouch };
    bobTime.current += dt * (moving && mode === "first" && headBobEnabled ? 10 : 0);
    const bob = moving && mode === "first" && headBobEnabled ? Math.sin(bobTime.current) * 0.03 : 0;

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
      const dist = 4.5;
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
          desired = target.clone().add(toDesired.multiplyScalar(Math.max(0.6, hit2.timeOfImpact - 0.25)));
        }
      }
      camera.position.lerp(desired, 0.2);
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

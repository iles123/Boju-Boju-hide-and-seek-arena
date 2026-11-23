import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardInput } from "../useKeyboardInput";
import { useGameStore } from "../store";

export function SpectatorRig({
  yawRef,
  pitchRef,
}: {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
}) {
  const mode = useGameStore((s) => s.cameraMode);
  const keys = useKeyboardInput();
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 10, 30));
  const follow = useRef(false);

  useEffect(() => {
    if (mode === "spectator") {
      camera.position.copy(pos.current);
    }
  }, [mode, camera]);

  useFrame((_, dt) => {
    if (mode !== "spectator") return;
    const k = keysRef.current;
    const forward = new THREE.Vector3(
      -Math.sin(yawRef.current) * Math.cos(pitchRef.current),
      Math.sin(pitchRef.current),
      -Math.cos(yawRef.current) * Math.cos(pitchRef.current),
    );
    const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));
    const up = new THREE.Vector3(0, 1, 0);
    const accel = k.sprint ? 22 : 11;
    const move = new THREE.Vector3();
    if (!follow.current) {
      if (k.forward) move.add(forward);
      if (k.backward) move.sub(forward);
      if (k.left) move.sub(right);
      if (k.right) move.add(right);
      if (k.jump) move.add(up);
      if (k.crouch) move.sub(up);
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(accel * dt);
      pos.current.add(move);
    } else {
      const target = new THREE.Vector3(0, 6, 20);
      pos.current.lerp(target, 1 - Math.pow(0.001, dt));
    }
    camera.position.copy(pos.current);
    const lookAt = pos.current.clone().add(forward);
    camera.lookAt(lookAt);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyG") follow.current = !follow.current;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}

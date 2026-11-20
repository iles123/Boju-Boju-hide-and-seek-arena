import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { useGameStore } from "./store";

export function MouseLook({
  yawRef,
  pitchRef,
  active = true,
}: {
  yawRef: MutableRefObject<number>;
  pitchRef: MutableRefObject<number>;
  active?: boolean;
}) {
  const { sensitivity, invertY } = useGameStore();
  const { gl } = useThree();

  useEffect(() => {
    const onLockChange = () => {
      useGameStore.getState().setPointerLocked(document.pointerLockElement === gl.domElement);
    };
    const onMove = (e: MouseEvent) => {
      if (!active) return;
      if (document.pointerLockElement !== gl.domElement) return;
      yawRef.current -= e.movementX * sensitivity;
      const inv = invertY ? -1 : 1;
      pitchRef.current -= e.movementY * sensitivity * inv;
      const limit = (85 * Math.PI) / 180;
      pitchRef.current = Math.max(-limit, Math.min(limit, pitchRef.current));
    };
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("mousemove", onMove);
    onLockChange();
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMove);
    };
  }, [gl, sensitivity, invertY, active, yawRef, pitchRef]);

  useFrame(() => {
    if (!active) return;
    const { dx, dy } = useGameStore.getState().consumeLookDelta();
    if (dx === 0 && dy === 0) return;
    const s = useGameStore.getState().sensitivity;
    const inv = useGameStore.getState().invertY ? -1 : 1;
    // touch look: scale deltas to feel similar to mouse movement
    const scale = 1.2;
    yawRef.current -= dx * s * scale;
    pitchRef.current -= dy * s * inv * scale;
    const limit = (85 * Math.PI) / 180;
    pitchRef.current = Math.max(-limit, Math.min(limit, pitchRef.current));
  });

  return null;
}

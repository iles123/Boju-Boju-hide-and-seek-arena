import { create } from "zustand";

export type CameraMode = "first" | "third" | "spectator";

type GameState = {
  cameraMode: CameraMode;
  setCameraMode: (m: CameraMode) => void;
  locked: boolean;
  setLocked: (v: boolean) => void;
  pointerLocked: boolean;
  setPointerLocked: (v: boolean) => void;
  sensitivity: number;
  setSensitivity: (v: number) => void;
  fov: number;
  setFov: (v: number) => void;
  invertY: boolean;
  setInvertY: (v: boolean) => void;
  headBob: boolean;
  setHeadBob: (v: boolean) => void;
};

export const useGameStore = create<GameState>((set) => ({
  cameraMode: "first",
  setCameraMode: (cameraMode) => set({ cameraMode }),
  locked: false,
  setLocked: (locked) => set({ locked }),
  pointerLocked: false,
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  sensitivity: 0.002,
  setSensitivity: (sensitivity) => set({ sensitivity }),
  fov: 75,
  setFov: (fov) => set({ fov }),
  invertY: false,
  setInvertY: (invertY) => set({ invertY }),
  headBob: true,
  setHeadBob: (headBob) => set({ headBob }),
}));

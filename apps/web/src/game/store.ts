import { create } from "zustand";

export type CameraMode = "first" | "third" | "spectator";
export type HiderPose = "stand" | "crouch" | "prone" | "tuck";

export type VirtualInput = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
};

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
  virtual: VirtualInput;
  setVirtual: (patch: Partial<VirtualInput>) => void;
  resetVirtual: () => void;
  consumeLookDelta: () => { dx: number; dy: number };
  paintColor: string;
  setPaintColor: (c: string) => void;
  pose: HiderPose;
  setPose: (p: HiderPose) => void;
};

const emptyVirtual: VirtualInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  crouch: false,
  lookDeltaX: 0,
  lookDeltaY: 0,
};

export const useGameStore = create<GameState>((set, get) => ({
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
  virtual: { ...emptyVirtual },
  setVirtual: (patch) => set((s) => ({ virtual: { ...s.virtual, ...patch } })),
  resetVirtual: () => set({ virtual: { ...emptyVirtual } }),
  consumeLookDelta: () => {
    const v = get().virtual;
    const dx = v.lookDeltaX;
    const dy = v.lookDeltaY;
    if (dx !== 0 || dy !== 0) set((s) => ({ virtual: { ...s.virtual, lookDeltaX: 0, lookDeltaY: 0 } }));
    return { dx, dy };
  },
  paintColor: "#94a3b8",
  setPaintColor: (paintColor) => set({ paintColor }),
  pose: "stand",
  setPose: (pose) => set({ pose }),
}));

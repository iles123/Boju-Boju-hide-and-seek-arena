import { create } from "zustand";
import type { HiderSize, PoseId } from "./paint";

export type CameraMode = "first" | "third" | "spectator";
export type HiderPose = PoseId;

export type VirtualInput = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  prone: boolean;
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
  hiderSize: HiderSize;
  setHiderSize: (s: HiderSize) => void;
  paintOpen: boolean;
  setPaintOpen: (v: boolean) => void;
  paintTextureDataUrl: string | null;
  setPaintTextureDataUrl: (v: string | null) => void;
  paintCompleteness: number;
  setPaintCompleteness: (n: number) => void;
  holdUpHelper: boolean;
  setHoldUpHelper: (v: boolean) => void;
  sampledWorldColor: string | null;
  setSampledWorldColor: (v: string | null) => void;
  sampleRequest: number;
  requestWorldSample: () => void;

  ammo: number;
  setAmmo: (n: number) => void;
  gunReloading: boolean;
  gunReloadRemaining: number;
  gunSlowRemaining: number;
  gunCooldownRemaining: number;
  setGunState: (s: { ammo?: number; reloading?: boolean; reload_remaining?: number; slow_remaining?: number; cooldown_remaining?: number }) => void;
  score: number;
  setScore: (n: number) => void;
  roundPhase: string;
  setRoundPhase: (p: string) => void;
  combatAction: { type: "shoot" | "reload" | "spot"; seq: number } | null;
  triggerCombatAction: (type: "shoot" | "reload" | "spot") => void;
  sandboxMapId: string;
  setSandboxMapId: (id: string) => void;
};

const emptyVirtual: VirtualInput = {
  forward: false, backward: false, left: false, right: false,
  jump: false, sprint: false, crouch: false, prone: false, lookDeltaX: 0, lookDeltaY: 0,
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
    const dx = v.lookDeltaX, dy = v.lookDeltaY;
    if (dx !== 0 || dy !== 0) set((s) => ({ virtual: { ...s.virtual, lookDeltaX: 0, lookDeltaY: 0 } }));
    return { dx, dy };
  },
  paintColor: "#f8fafc",
  setPaintColor: (paintColor) => set({ paintColor }),
  pose: "stand",
  setPose: (pose) => set({ pose }),
  hiderSize: "normal",
  setHiderSize: (hiderSize) => set({ hiderSize }),
  paintOpen: false,
  setPaintOpen: (paintOpen) => set({ paintOpen }),
  paintTextureDataUrl: null,
  setPaintTextureDataUrl: (paintTextureDataUrl) => set({ paintTextureDataUrl }),
  paintCompleteness: 0,
  setPaintCompleteness: (paintCompleteness) => set({ paintCompleteness }),
  holdUpHelper: false,
  setHoldUpHelper: (holdUpHelper) => set({ holdUpHelper }),
  sampledWorldColor: null,
  setSampledWorldColor: (sampledWorldColor) => set({ sampledWorldColor }),
  sampleRequest: 0,
  requestWorldSample: () => set((s) => ({ sampleRequest: s.sampleRequest + 1 })),

  ammo: 12,
  setAmmo: (ammo) => set({ ammo }),
  gunReloading: false,
  gunReloadRemaining: 0,
  gunSlowRemaining: 0,
  gunCooldownRemaining: 0,
  setGunState: (s) => set((state) => ({
    ammo: typeof s.ammo === "number" ? s.ammo : state.ammo,
    gunReloading: typeof s.reloading === "boolean" ? s.reloading : state.gunReloading,
    gunReloadRemaining: typeof s.reload_remaining === "number" ? s.reload_remaining : state.gunReloadRemaining,
    gunSlowRemaining: typeof s.slow_remaining === "number" ? s.slow_remaining : state.gunSlowRemaining,
    gunCooldownRemaining: typeof s.cooldown_remaining === "number" ? s.cooldown_remaining : state.gunCooldownRemaining,
  })),
  score: 0,
  setScore: (score) => set({ score }),
  roundPhase: "lobby",
  setRoundPhase: (roundPhase) => set({ roundPhase }),
  combatAction: null,
  triggerCombatAction: (type) => set((s) => ({ combatAction: { type, seq: (s.combatAction?.seq ?? 0) + 1 } })),
  sandboxMapId: "market",
  setSandboxMapId: (sandboxMapId) => set({ sandboxMapId }),
}));

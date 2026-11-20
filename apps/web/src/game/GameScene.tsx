import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { GreyboxMap } from "./components/GreyboxMap";
import { PlayerRig } from "./components/PlayerRig";
import { SpectatorRig } from "./components/SpectatorRig";
import { MouseLook } from "./MouseLook";
import { GameHUD } from "./GameHUD";
import { VirtualControls } from "./VirtualControls";
import { useGameStore } from "./store";

function SceneContents() {
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const mode = useGameStore((s) => s.cameraMode);
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.1} castShadow />
      <Physics gravity={[0, -9.81, 0]}>
        <GreyboxMap />
        <PlayerRig yawRef={yawRef} pitchRef={pitchRef} />
      </Physics>
      <MouseLook yawRef={yawRef} pitchRef={pitchRef} active={true} />
      {mode === "spectator" && <SpectatorRig yawRef={yawRef} pitchRef={pitchRef} />}
      <color attach="background" args={["#dbeafe"]} />
      <fog attach="fog" args={["#dbeafe", 30, 120]} />
    </>
  );
}

function isTouchLikeEvent(e: unknown) {
  const pe = e as { pointerType?: string };
  return pe?.pointerType === "touch" || (typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0));
}

export function GameScene() {
  return (
    <div className="game-root">
      <Canvas shadows camera={{ fov: 75, position: [0, 4, 24] }} onPointerDown={(e) => {
        if (isTouchLikeEvent(e)) return;
        const el = e.target as HTMLElement;
        if (el?.requestPointerLock && document.pointerLockElement !== el) el.requestPointerLock();
      }}>
        <SceneContents />
      </Canvas>
      <GameHUD />
      <VirtualControls />
    </div>
  );
}

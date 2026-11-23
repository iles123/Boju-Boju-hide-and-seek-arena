import { useMemo, useRef } from "react";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { ArenaMap, getMapDef, MAPS } from "./components/maps";
import { PlayerRig } from "./components/PlayerRig";
import { SpectatorRig } from "./components/SpectatorRig";
import { MouseLook } from "./MouseLook";
import { GameHUD } from "./GameHUD";
import { VirtualControls } from "./VirtualControls";
import { PaintPanel, EyedropperSampler } from "./PaintPanel";
import { useGameStore } from "./store";

function SceneContents({ mapId }: { mapId: string }) {
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const mode = useGameStore((s) => s.cameraMode);
  const mapDef = useMemo(() => getMapDef(mapId), [mapId]);
  return (
    <>
      <ambientLight intensity={mapDef.ambient} />
      <directionalLight position={mapDef.sun} intensity={1.1} castShadow />
      <hemisphereLight args={[mapDef.hemi[0], mapDef.hemi[1], mapDef.hemi[2]]} />
      <Physics gravity={[0, -9.81, 0]}>
        <ArenaMap mapId={mapId} />
        <PlayerRig yawRef={yawRef} pitchRef={pitchRef} spawn={mapDef.seekerSpawn} />
      </Physics>
      <MouseLook yawRef={yawRef} pitchRef={pitchRef} active={true} />
      <EyedropperSampler enabled={true} />
      {mode === "spectator" && <SpectatorRig yawRef={yawRef} pitchRef={pitchRef} />}
      <color attach="background" args={[mapDef.sky]} />
      <fog attach="fog" args={[mapDef.fog[0], mapDef.fog[1], mapDef.fog[2]]} />
    </>
  );
}

function isTouchLikeEvent(e: unknown) {
  const pe = e as { pointerType?: string };
  return pe?.pointerType === "touch" || pe?.pointerType === "pen";
}

export function GameScene() {
  const mapId = useGameStore((s) => s.sandboxMapId || MAPS[0].id);
  const setSandbox = useGameStore((s) => s.setSandboxMapId);
  const paintOpen = useGameStore((s) => s.paintOpen);
  const setPaintOpen = useGameStore((s) => s.setPaintOpen);
  const activeSheet = useGameStore((s) => s.activeSheet);
  const toggleSheet = useGameStore((s) => s.toggleSheet);
  const setActiveSheet = useGameStore((s) => s.setActiveSheet);
  const mapsOpen = activeSheet === "map";
  return (
    <div className="game-root">
      <button className={`mobile-sheet-toggle map-toggle ${mapsOpen ? "active" : ""}`} aria-expanded={mapsOpen} onPointerDown={() => toggleSheet("map")}>{mapsOpen ? "Close" : "Maps"}</button>
      <div className={`practice-map-picker ${mapsOpen ? "mobile-open" : ""}`}>
        {MAPS.map((m) => (
          <button key={m.id} className={`btn secondary ${mapId === m.id ? "active" : ""}`} onClick={() => { setSandbox(m.id); setActiveSheet(null); }}>{m.name}</button>
        ))}
      </div>

      <Canvas shadows camera={{ fov: 75, position: [0, 4, 24] }} onPointerDown={(e) => {
        if (isTouchLikeEvent(e)) {
          setActiveSheet(null);
          return;
        }
        const el = e.target as HTMLElement;
        if (el?.requestPointerLock && document.pointerLockElement !== el) el.requestPointerLock();
      }}>
        <SceneContents mapId={mapId} />
      </Canvas>
      <GameHUD />
      <PaintPanel open={paintOpen} onClose={() => setPaintOpen(false)} />
      <VirtualControls layout="sandbox" showPaint />
    </div>
  );
}

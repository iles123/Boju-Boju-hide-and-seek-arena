import { useEffect } from "react";
import { useGameStore } from "./store";

export function GameHUD() {
  const {
    cameraMode,
    setCameraMode,
    locked,
    setLocked,
    pointerLocked,
    sensitivity,
    setSensitivity,
    fov,
    setFov,
    invertY,
    setInvertY,
    headBob,
    setHeadBob,
  } = useGameStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (e.code === "Digit1") setCameraMode("first");
      if (e.code === "Digit2") setCameraMode("third");
      if (e.code === "Digit3") setCameraMode("spectator");
      if (e.code === "KeyL") setLocked(!useGameStore.getState().locked);
      if (e.code === "Escape") document.exitPointerLock?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCameraMode, setLocked]);

  return (
    <div className="game-overlay">
      <div className="game-topbar">
        <div><strong>Greybox Sandbox</strong></div>
        <div>Mode: {cameraMode} {locked && cameraMode === "third" ? "· LOCKED" : ""}</div>
        <div>{pointerLocked ? "Mouse locked (Esc to unlock)" : "Click scene to lock mouse"}</div>
      </div>
      <div className="game-crosshair">+</div>
      {locked && cameraMode === "third" && <div className="game-locked">LOCKED AS PROP (camera free)</div>}
      <div className="game-panel">
        <div className="row">
          <button className={`btn secondary ${cameraMode==="first"?"active":""}`} onClick={() => setCameraMode("first")}>1P</button>
          <button className={`btn secondary ${cameraMode==="third"?"active":""}`} onClick={() => setCameraMode("third")}>3P</button>
          <button className={`btn secondary ${cameraMode==="spectator"?"active":""}`} onClick={() => setCameraMode("spectator")}>Spectator</button>
          <button className="btn secondary" onClick={() => setLocked(!locked)}>Toggle Lock (L)</button>
        </div>
        <div className="small muted">WASD move · Mouse look · Space jump · Shift sprint · C crouch · 1/2/3 camera · L lock prop · F spectator follow</div>
        <label className="small">Sensitivity {sensitivity.toFixed(3)}<input type="range" min={0.0005} max={0.006} step={0.0001} value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))} /></label>
        <label className="small">FOV {fov}<input type="range" min={60} max={100} step={1} value={fov} onChange={(e) => setFov(parseInt(e.target.value, 10))} /></label>
        <label className="small row"><input type="checkbox" checked={invertY} onChange={(e) => setInvertY(e.target.checked)} /> Invert Y</label>
        <label className="small row"><input type="checkbox" checked={headBob} onChange={(e) => setHeadBob(e.target.checked)} /> Head bob (1P)</label>
      </div>
    </div>
  );
}


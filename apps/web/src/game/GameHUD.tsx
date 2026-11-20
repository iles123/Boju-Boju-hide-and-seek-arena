import { useEffect } from "react";
import { useGameStore, type HiderPose } from "./store";

const PALETTE = ["#f8fafc", "#facc15", "#fb7185", "#38bdf8", "#4ade80", "#a78bfa", "#f97316", "#64748b", "#92400e", "#16a34a"];

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
    paintColor,
    setPaintColor,
    pose,
    setPose,
  } = useGameStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.code === "Digit1") setCameraMode("first");
      if (e.code === "Digit2") setCameraMode("third");
      if (e.code === "Digit3") setCameraMode("spectator");
      if (e.code === "KeyL") setLocked(!useGameStore.getState().locked);
      if (e.code === "Escape") document.exitPointerLock?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCameraMode, setLocked]);

  const poseOptions: { id: HiderPose; label: string }[] = [
    { id: "stand", label: "Stand" },
    { id: "crouch", label: "Box" },
    { id: "prone", label: "Flat" },
    { id: "tuck", label: "Tall" },
  ];

  return (
    <div className="game-overlay">
      <div className="game-topbar huntseek-topbar">
        <div><strong className="brand-pill">Hunt & Seek Practice</strong></div>
        <div>Mode: {cameraMode} {locked ? "- Blended" : ""}</div>
        <div>{pointerLocked ? "Mouse locked (Esc to unlock)" : "Desktop: click to lock mouse | Mobile: use on-screen controls"}</div>
      </div>
      <div className="game-crosshair">+</div>
      {locked && <div className="game-locked">BLENDED / CAMOUFLAGED</div>}
      <div className="game-panel">
        <div className="row">
          <button className={`btn secondary ${cameraMode === "first" ? "active" : ""}`} onClick={() => setCameraMode("first")}>1P</button>
          <button className={`btn secondary ${cameraMode === "third" ? "active" : ""}`} onClick={() => setCameraMode("third")}>3P</button>
          <button className={`btn secondary ${cameraMode === "spectator" ? "active" : ""}`} onClick={() => setCameraMode("spectator")}>Spectator</button>
          <button className="btn secondary" onClick={() => setLocked(!locked)}>Toggle Lock/Blend (L)</button>
        </div>
        <div className="small muted">Meccha Hunt & Seek practice: paint your chameleon, choose a pose/form, move into place, then Lock to blend in like a prop.</div>
        <div className="small" style={{ fontWeight: 600, marginTop: 4 }}>Paint & Blend</div>
        <div className="palette-row" style={{ margin: "4px 0" }}>
          {PALETTE.map((c) => (
            <button key={c} className={`swatch ${paintColor === c ? "active" : ""}`} style={{ background: c }} onClick={() => setPaintColor(c)} title={c} />
          ))}
          <input className="color-pick" type="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} title="Custom paint" />
        </div>
        <div className="pose-row" style={{ marginBottom: 6 }}>
          {poseOptions.map((p) => (
            <button key={p.id} className={`btn secondary pose-btn ${pose === p.id ? "active" : ""}`} onClick={() => setPose(p.id)}>{p.label}</button>
          ))}
        </div>
        <div className="small muted">Desktop: WASD move, mouse look, Space jump, Shift sprint, C crouch, 1/2/3 camera, L lock/blend, F spectator follow. Mobile: joystick + look pad + buttons.</div>
        <label className="small">Sensitivity {sensitivity.toFixed(3)}<input type="range" min={0.0005} max={0.006} step={0.0001} value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))} /></label>
        <label className="small">FOV {fov}<input type="range" min={60} max={100} step={1} value={fov} onChange={(e) => setFov(parseInt(e.target.value, 10))} /></label>
        <label className="small row"><input type="checkbox" checked={invertY} onChange={(e) => setInvertY(e.target.checked)} /> Invert Y</label>
        <label className="small row"><input type="checkbox" checked={headBob} onChange={(e) => setHeadBob(e.target.checked)} /> Head bob (1P)</label>
      </div>
    </div>
  );
}

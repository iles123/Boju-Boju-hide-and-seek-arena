import { useEffect, useRef, useState } from "react";
import { useGameStore } from "./store";

function isTouchLike() {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
}

export function VirtualControls({
  showTag,
  canTag,
  onTag,
}: {
  showTag?: boolean;
  canTag?: boolean;
  onTag?: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyId = useRef<number | null>(null);
  const joyOrigin = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setEnabled(isTouchLike());
  }, []);

  useEffect(() => {
    if (!enabled) useGameStore.getState().resetVirtual();
  }, [enabled]);

  if (!enabled) return null;

  const updateMove = (dx: number, dy: number) => {
    const max = 42;
    const mag = Math.hypot(dx, dy);
    const clampedMag = Math.min(mag, max);
    const nx = mag > 0 ? (dx / mag) * clampedMag : 0;
    const ny = mag > 0 ? (dy / mag) * clampedMag : 0;
    setKnob({ x: nx, y: ny });
    const dead = 10;
    const fx = mag < dead ? 0 : nx / max;
    const fy = mag < dead ? 0 : ny / max;
    const forward = fy < -0.25;
    const backward = fy > 0.25;
    const left = fx < -0.25;
    const right = fx > 0.25;
    useGameStore.getState().setVirtual({ forward, backward, left, right });
  };

  const endMove = () => {
    joyId.current = null;
    setKnob({ x: 0, y: 0 });
    useGameStore.getState().setVirtual({ forward: false, backward: false, left: false, right: false });
  };

  const onJoyDown = (e: React.PointerEvent) => {
    if (joyId.current != null) return;
    joyId.current = e.pointerId;
    const rect = joyRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : e.clientX;
    const cy = rect ? rect.top + rect.height / 2 : e.clientY;
    joyOrigin.current = { x: cx, y: cy };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateMove(e.clientX - cx, e.clientY - cy);
  };
  const onJoyMove = (e: React.PointerEvent) => {
    if (joyId.current !== e.pointerId) return;
    updateMove(e.clientX - joyOrigin.current.x, e.clientY - joyOrigin.current.y);
  };
  const onJoyUp = (e: React.PointerEvent) => {
    if (joyId.current !== e.pointerId) return;
    endMove();
  };

  const onLookDown = (e: React.PointerEvent) => {
    if (lookId.current != null) return;
    if (joyId.current === e.pointerId) return;
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onLookMove = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    const st = useGameStore.getState();
    st.setVirtual({ lookDeltaX: st.virtual.lookDeltaX + dx, lookDeltaY: st.virtual.lookDeltaY + dy });
  };
  const onLookUp = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    lookId.current = null;
  };

  return (
    <div className="touch-ui" aria-hidden="false">
      <div
        className="touch-look"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />
      <div className="touch-left">
        <div
          ref={joyRef}
          className="touch-joystick"
          onPointerDown={onJoyDown}
          onPointerMove={onJoyMove}
          onPointerUp={onJoyUp}
          onPointerCancel={onJoyUp}
        >
          <div className="touch-joystick-base" />
          <div className="touch-joystick-knob" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
      </div>
      <div className="touch-right">
        <div className="touch-actions">
          <button className="touch-btn" onPointerDown={() => useGameStore.getState().setVirtual({ jump: true })} onPointerUp={() => useGameStore.getState().setVirtual({ jump: false })} onPointerCancel={() => useGameStore.getState().setVirtual({ jump: false })} onPointerLeave={() => useGameStore.getState().setVirtual({ jump: false })}>Jump</button>
          <button className="touch-btn" onPointerDown={() => useGameStore.getState().setVirtual({ sprint: !useGameStore.getState().virtual.sprint })}>Sprint</button>
          <button className="touch-btn" onPointerDown={() => useGameStore.getState().setVirtual({ crouch: !useGameStore.getState().virtual.crouch })}>Crouch</button>
          <button className="touch-btn" onPointerDown={() => useGameStore.getState().setLocked(!useGameStore.getState().locked)}>Lock</button>
          <button className="touch-btn" onPointerDown={() => {
            const cur = useGameStore.getState().cameraMode;
            useGameStore.getState().setCameraMode(cur === "first" ? "third" : cur === "third" ? "spectator" : "first");
          }}>Cam</button>
          {showTag && <button className={`touch-btn ${canTag ? "accent" : ""}`} onPointerDown={() => { if (canTag) onTag?.(); }}>Tag</button>}
        </div>
        <div className="touch-hint">Drag right side to look | Joystick to move</div>
      </div>
    </div>
  );
}

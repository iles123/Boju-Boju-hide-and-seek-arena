import { useEffect, useRef, useState } from "react";
import { useGameStore, type HiderPose } from "./store";
import { POSES } from "./paint";

type TouchLayout = "hider" | "seeker" | "sandbox";

const POSE_CYCLE: HiderPose[] = POSES.map((p) => p.id);

function isTouchLike() {
  if (typeof window === "undefined") return false;
  return navigator.maxTouchPoints > 0 || window.matchMedia("(any-pointer: coarse)").matches;
}

export function VirtualControls({
  showTag,
  canTag,
  onTag,
  showCombat,
  showPaint,
  showTricks,
  onDecoy,
  onWhistle,
  layout = "sandbox",
}: {
  showTag?: boolean;
  canTag?: boolean;
  onTag?: () => void;
  showCombat?: boolean;
  showPaint?: boolean;
  showTricks?: boolean;
  onDecoy?: () => void;
  onWhistle?: () => void;
  layout?: TouchLayout;
}) {
  const [enabled, setEnabled] = useState(false);
  const sprintOn = useGameStore((s) => s.virtual.sprint);
  const crouchOn = useGameStore((s) => s.virtual.crouch);
  const proneOn = useGameStore((s) => s.virtual.prone);
  const lockedOn = useGameStore((s) => s.locked);
  const pose = useGameStore((s) => s.pose);
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyId = useRef<number | null>(null);
  const joyOrigin = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const update = () => setEnabled(isTouchLike());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) useGameStore.getState().resetVirtual();
  }, [enabled]);

  if (!enabled) return null;

  const hiderMode = layout === "hider" || (layout === "sandbox" && !!showPaint && !showCombat);
  const seekerMode = layout === "seeker" || (layout === "sandbox" && (!!showCombat || !!showTag));

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
    useGameStore.getState().setVirtual({
      forward: fy < -0.25,
      backward: fy > 0.25,
      left: fx < -0.25,
      right: fx > 0.25,
    });
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
    if (lookId.current != null || joyId.current === e.pointerId) return;
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

  const cyclePose = () => {
    const i = POSE_CYCLE.indexOf(pose);
    useGameStore.getState().setPose(POSE_CYCLE[(i + 1) % POSE_CYCLE.length]);
  };

  const cycleCamera = () => {
    const cur = useGameStore.getState().cameraMode;
    useGameStore.getState().setCameraMode(cur === "first" ? "third" : cur === "third" ? "spectator" : "first");
  };

  const stanceButtons = (
    <div className="touch-stance">
      <button
        className="touch-btn mini"
        onPointerDown={() => useGameStore.getState().setVirtual({ jump: true })}
        onPointerUp={() => useGameStore.getState().setVirtual({ jump: false })}
        onPointerCancel={() => useGameStore.getState().setVirtual({ jump: false })}
        onPointerLeave={() => useGameStore.getState().setVirtual({ jump: false })}
      >Jump</button>
      <button className={`touch-btn mini ${sprintOn ? "active" : ""}`} onPointerDown={() => useGameStore.getState().setVirtual({ sprint: !sprintOn })}>Sprint</button>
      <button className={`touch-btn mini ${crouchOn ? "active" : ""}`} onPointerDown={() => useGameStore.getState().setVirtual({ crouch: !crouchOn })}>Crouch</button>
      <button className={`touch-btn mini ${proneOn ? "active" : ""}`} onPointerDown={() => useGameStore.getState().setVirtual({ prone: !proneOn })}>Prone</button>
    </div>
  );

  return (
    <div className={`touch-ui ${hiderMode ? "hider-layout" : seekerMode ? "seeker-layout" : ""}`} aria-hidden="false">
      <div
        className="touch-look"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      >
        <span className="touch-look-label">DRAG TO LOOK</span>
      </div>
      <div className="touch-left">
        {stanceButtons}
        <div
          ref={joyRef}
          className="touch-joystick"
          onPointerDown={onJoyDown}
          onPointerMove={onJoyMove}
          onPointerUp={onJoyUp}
          onPointerCancel={onJoyUp}
        >
          <div className="touch-joystick-base" />
          <div className="touch-joystick-label">MOVE</div>
          <div className="touch-joystick-knob" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
      </div>
      <div className="touch-right">
        <div className="touch-actions">
          {hiderMode && showPaint && (
            <>
              <button className="touch-btn primary" onPointerDown={() => useGameStore.getState().setPaintOpen(!useGameStore.getState().paintOpen)}>Paint</button>
              <button className="touch-btn" onPointerDown={cyclePose}>Pose</button>
              <button className="touch-btn" onPointerDown={() => {
                useGameStore.getState().requestWorldSample();
                useGameStore.getState().setHoldUpHelper(true);
              }}>Sample</button>
              <button className={`touch-btn ${lockedOn ? "active" : ""}`} onPointerDown={() => useGameStore.getState().setLocked(!lockedOn)}>Lock</button>
            </>
          )}
          {hiderMode && showTricks && (
            <>
              <button className="touch-btn" onPointerDown={() => onDecoy?.()}>Decoy</button>
              <button className="touch-btn accent" onPointerDown={() => onWhistle?.()}>Taunt</button>
            </>
          )}
          {seekerMode && showCombat && (
            <>
              <button className="touch-btn fire primary" onPointerDown={() => useGameStore.getState().triggerCombatAction("shoot")}>Fire</button>
              <button className="touch-btn" onPointerDown={() => useGameStore.getState().triggerCombatAction("spot")}>Spot</button>
              <button className="touch-btn" onPointerDown={() => useGameStore.getState().triggerCombatAction("reload")}>Reload</button>
            </>
          )}
          {showTag && <button className={`touch-btn ${canTag ? "accent" : ""}`} onPointerDown={() => { if (canTag) onTag?.(); }}>Tag</button>}
          {!hiderMode && !seekerMode && (
            <>
              {showPaint && <button className="touch-btn" onPointerDown={() => useGameStore.getState().setPaintOpen(!useGameStore.getState().paintOpen)}>Paint</button>}
              {showTricks && <button className="touch-btn" onPointerDown={() => onDecoy?.()}>Decoy</button>}
              {showTricks && <button className="touch-btn" onPointerDown={() => onWhistle?.()}>Taunt</button>}
              {showCombat && <button className="touch-btn fire" onPointerDown={() => useGameStore.getState().triggerCombatAction("shoot")}>Fire</button>}
              {showCombat && <button className="touch-btn" onPointerDown={() => useGameStore.getState().triggerCombatAction("reload")}>Reload</button>}
              {showCombat && <button className="touch-btn" onPointerDown={() => useGameStore.getState().triggerCombatAction("spot")}>Spot</button>}
            </>
          )}
          <button className="touch-btn" onPointerDown={cycleCamera}>Cam</button>
        </div>
      </div>
    </div>
  );
}

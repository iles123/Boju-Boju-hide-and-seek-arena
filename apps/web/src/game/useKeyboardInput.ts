import { useEffect, useState } from "react";

export type InputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
};

const initial: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  crouch: false,
};

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function useKeyboardInput() {
  const [keys, setKeys] = useState<InputState>(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (isTypingTarget(e.target)) return;
      setKeys((prev) => {
        const next = { ...prev };
        switch (e.code) {
          case "KeyW": next.forward = down; break;
          case "KeyS": next.backward = down; break;
          case "KeyA": next.left = down; break;
          case "KeyD": next.right = down; break;
          case "Space": next.jump = down; break;
          case "ShiftLeft":
          case "ShiftRight": next.sprint = down; break;
          case "KeyC": next.crouch = down; break;
          default: return prev;
        }
        return next;
      });
    };
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    const blur = () => setKeys(initial);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return keys;
}

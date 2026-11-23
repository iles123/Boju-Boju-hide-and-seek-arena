import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "boju-boju-music";

export function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(STORAGE_KEY) === "on");
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.35;
    audio.loop = true;
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    if (enabled) {
      void audio.play().catch(() => setEnabled(false));
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [enabled]);

  return (
    <>
      <audio ref={audioRef} src="/audio/legacy.mp3" preload="none" loop />
      <button
        className={`music-toggle ${enabled ? "on" : ""}`}
        type="button"
        aria-pressed={enabled}
        aria-label={enabled ? "Turn music off" : "Turn music on"}
        onClick={() => setEnabled((value) => !value)}
      >
        <span className="music-mark">M</span>
        <span className="music-label">{enabled ? "MUSIC ON" : "MUSIC OFF"}</span>
      </button>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { Room as LiveKitRoom } from "livekit-client";
import { api, getVoiceConfig, type VoiceToken } from "../lib/api";

export function RoomVoice({ roomId, username }: { roomId: string; username?: string }) {
  const [enabled, setEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const roomRef = useRef<LiveKitRoom | null>(null);

  useEffect(() => {
    let active = true;
    void getVoiceConfig()
      .then((cfg) => { if (active) setEnabled(cfg.enabled); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => () => { void roomRef.current?.disconnect(); roomRef.current = null; }, []);

  async function join() {
    setMessage(null);
    try {
      const voice: VoiceToken = await api.voiceToken(roomId);
      const room = new LiveKitRoom({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      await room.connect(voice.url, voice.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setConnected(true);
      setMuted(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not join voice chat");
    }
  }

  async function leave() {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setConnected(false);
    setMuted(false);
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  if (!enabled) return null;

  return (
    <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span className="badge">{username ?? "You"} in voice</span>
      {connected ? (
        <>
          <span className="badge live">MIC {muted ? "OFF" : "ON"}</span>
          <button className="btn secondary" onClick={() => void toggleMute()}>{muted ? "Unmute" : "Mute"}</button>
          <button className="btn secondary" onClick={() => void leave()}>Leave voice</button>
        </>
      ) : (
        <button className="btn secondary" onClick={() => void join()}>Join voice chat</button>
      )}
      {message && <span className="muted small">{message}</span>}
    </div>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type RoomListItem } from "../lib/api";

export default function LobbyPage() {
  const nav = useNavigate();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("My Room");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [joinPassword, setJoinPassword] = useState("");

  async function refresh() {
    try {
      setError(null);
      const list = await api.listRooms();
      setRooms(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const room = await api.createRoom({ name, is_public: isPublic, password: password || null });
      nav(`/rooms/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  }

  async function onQuickMatch() {
    setBusy(true); setError(null);
    try {
      const res = await api.quickMatch();
      nav(`/rooms/${res.room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quick match failed");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(roomId: string, needsPassword: boolean) {
    setBusy(true); setError(null);
    try {
      await api.joinRoom(roomId, { password: needsPassword ? (joinPassword || null) : null, as_spectator: false });
      nav(`/rooms/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <section className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Lobby / Room Browser</h2>
          <div className="row">
            <button className="btn secondary" onClick={() => void refresh()} disabled={loading || busy}>Refresh</button>
            <button className="btn" onClick={() => void onQuickMatch()} disabled={busy}>Quick Match</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="grid-2" style={{ alignItems: "start" }}>
          <form className="card form" onSubmit={onCreate} style={{ margin: 0, maxWidth: "none" }}>
            <h3>Create Room</h3>
            <label>Room name<input value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={50} required /></label>
            <label className="row"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Public room</label>
            <label>Password (optional)<input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for no password" /></label>
            <button className="btn" type="submit" disabled={busy}>Create & Join</button>
          </form>
          <div className="card stack" style={{ margin: 0 }}>
            <h3>Public Rooms</h3>
            <label>Join password (for protected rooms)<input value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} placeholder="Password if required" /></label>
            {loading ? <p className="muted">Loading rooms...</p> : rooms.length === 0 ? <p className="muted">No public rooms yet.</p> : (
              <div className="stack">
                {rooms.map((r) => (
                  <div key={r.id} className="room-row">
                    <div>
                      <div><strong>{r.name}</strong> {r.has_password ? "🔒" : ""}</div>
                      <div className="muted small">{r.player_count}/{r.capacity} players | {r.status}{r.phase && r.phase !== "lobby" ? ` (${r.phase})` : ""}</div>
                    </div>
                    <button className="btn secondary" disabled={busy || r.player_count >= r.capacity} onClick={() => void onJoin(r.id, r.has_password)}>Join</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="muted small">Phases 2-4: rooms/presence + basic round phases (hiding/seeking), team roles, and networked arena prototype via room WebSocket.</p>
      </section>
    </div>
  );
}



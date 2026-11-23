import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type RoomListItem } from "../lib/api";

export default function LobbyPage() {
  const nav = useNavigate();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Hunt & Seek Squad");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinCodePassword, setJoinCodePassword] = useState("");

  async function refresh(silent = false) {
    try {
      if (!silent) setError(null);
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
    const t = setInterval(() => void refresh(true), 5000);
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

  async function onJoinByCode(e: FormEvent) {
    e.preventDefault();
    const raw = joinCode.trim();
    if (!raw) return;
    let code = raw;
    try {
      const u = new URL(raw);
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "rooms");
      if (idx >= 0 && parts[idx + 1]) code = parts[idx + 1];
    } catch {
      // not a URL, treat as code
    }
    code = code.split("?")[0].split("#")[0].trim();
    if (!code) { setError("Invalid room code/link"); return; }
    setBusy(true); setError(null);
    try {
      await api.joinRoom(code, { password: joinCodePassword || null, as_spectator: false });
      nav(`/rooms/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join by code (check code/password)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <section className="card stack huntseek-card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Hunt & Seek Lobby</h2>
          <div className="row">
            <button className="btn secondary" onClick={() => void refresh()} disabled={loading || busy}>Refresh</button>
            <button className="btn" onClick={() => void onQuickMatch()} disabled={busy}>Quick Match</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <p className="muted small"><strong>Play with friends:</strong> create a room, share the invite code/link so your group joins the same room, set preferred roles (Chameleon/Hunter) in the room, then start and play together against other players. Chameleons paint & blend in; Hunters seek & tag.</p>
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="stack">
            <form className="card form" onSubmit={onCreate} style={{ margin: 0, maxWidth: "none" }}>
              <h3>Create Hunt & Seek Room</h3>
              <label>Room name<input value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={50} required /></label>
              <label className="row"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Public room (friends + others can join)</label>
              <label>Password (optional)<input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for no password" /></label>
              <button className="btn" type="submit" disabled={busy}>Create & Join</button>
            </form>
            <form className="card form" onSubmit={onJoinByCode} style={{ margin: 0, maxWidth: "none" }}>
              <h3>Join by Code / Invite Link</h3>
              <label>Room code or invite link<input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Paste room code or link" /></label>
              <label>Password (if required)<input value={joinCodePassword} onChange={(e) => setJoinCodePassword(e.target.value)} placeholder="Room password" /></label>
              <button className="btn secondary" type="submit" disabled={busy || !joinCode.trim()}>Join Room</button>
            </form>
          </div>
          <div className="card stack" style={{ margin: 0 }}>
            <h3>Public Matches</h3>
            <label>Join password (for protected rooms)<input value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} placeholder="Password if required" /></label>
            {loading ? <p className="muted">Loading rooms...</p> : rooms.length === 0 ? <p className="muted">No public rooms yet. Create one or use Quick Match.</p> : (
              <div className="stack">
                {rooms.map((r) => (
                  <div key={r.id} className="room-row">
                    <div>
                      <div><strong>{r.name}</strong> {r.has_password ? "(protected)" : ""}</div>
                      <div className="muted small">Code: <span className="code">{r.id}</span> | {r.player_count}/{r.capacity} players | {r.status}{r.phase && r.phase !== "lobby" ? ` (${r.phase})` : ""}</div>
                    </div>
                    <button className="btn secondary" disabled={busy || r.player_count >= r.capacity} onClick={() => void onJoin(r.id, r.has_password)}>Join</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="muted small">Hunt & Seek: hiding/seeking rounds, Chameleon paint & pose camouflage, Hunter tagging, team preferences, networked arena, mobile/desktop controls.</p>
      </section>
    </div>
  );
}

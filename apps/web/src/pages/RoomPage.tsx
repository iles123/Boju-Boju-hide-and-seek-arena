import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, getWsBase, type Room } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { RoomArena } from "../game/RoomArena";

type WsMsg = { type?: string; roomId?: string; payload?: unknown };
type RemotePlayerState = { user_id?: string; username?: string; team?: string; alive?: boolean; is_spectator?: boolean; x?: number; y?: number; z?: number; yaw?: number; pitch?: number; mode?: string; locked?: boolean };

export default function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<string>("Preparing room...");
  const [error, setError] = useState<string | null>(null);
  const [inArena, setInArena] = useState(false);
  const [remoteStates, setRemoteStates] = useState<Record<string, RemotePlayerState>>({});
  const [roundEvent, setRoundEvent] = useState<string | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [joining, setJoining] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const closingRef = useRef(false);
  const mountedRef = useRef(true);

  const myPlayer = useMemo(() => room?.players.find((p) => p.user_id === user?.id) ?? null, [room, user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const closeWs = () => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }
  };

  const connectRoom = async (opts?: { password?: string | null; spectator?: boolean }) => {
    if (!roomId || !user) return;
    setJoining(true);
    setError(null);
    setStatus("Joining room...");
    closeWs();
    try {
      try {
        await api.joinRoom(roomId, { password: opts?.password ?? null, as_spectator: !!opts?.spectator });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // If already a member/reconnecting, continue to WS; otherwise surface important errors.
        if (msg.includes("Invalid room password") || msg.includes("Room not found") || msg.includes("Room is full") || msg.includes("Round already in progress") || msg.includes("User already in another room")) {
          throw e;
        }
      }
      if (!mountedRef.current) return;
      setStatus("Requesting ticket...");
      const { ticket } = await api.wsTicket();
      if (!mountedRef.current) return;
      const url = `${getWsBase()}/ws/rooms/${roomId}?ticket=${encodeURIComponent(ticket)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setStatus("Connecting WebSocket...");

      ws.onopen = () => {
        if (mountedRef.current) setStatus("Connected");
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as WsMsg;
          const payload = msg.payload as Record<string, unknown> | undefined;
          if (msg.type === "room.state" && payload) {
            const nextRoom = payload as unknown as Room;
            setRoom(nextRoom);
            const ph = nextRoom?.phase;
            if (ph === "hiding" || ph === "seeking") setInArena(true);
            if (ph === "lobby") setInArena(false);
          }
          if (msg.type === "player.snapshot") {
            const players = Array.isArray(payload?.players) ? (payload.players as RemotePlayerState[]) : [];
            const map: Record<string, RemotePlayerState> = {};
            for (const p of players) if (p?.user_id) map[p.user_id] = p;
            setRemoteStates(map);
          }
          if (msg.type === "player.state") {
            const p = payload as RemotePlayerState | undefined;
            if (p?.user_id) setRemoteStates((prev) => ({ ...prev, [p.user_id as string]: p }));
          }
          if (msg.type === "player.eliminated") {
            const t = typeof payload?.target_id === "string" ? payload.target_id : null;
            setRoundEvent(t === user.id ? "You were eliminated. You are now spectating." : "A hider was eliminated.");
            if (t) setRemoteStates((prev) => ({ ...prev, [t]: { ...(prev[t] || {}), team: "spectator", alive: false, is_spectator: true } }));
          }
          if (msg.type === "round.ended") {
            const w = typeof payload?.winner_team === "string" ? payload.winner_team : null;
            setRoundEvent(w ? `Round ended: ${w} win!` : "Round ended.");
          }
          if (msg.type === "round.phase") {
            const ph = typeof payload?.phase === "string" ? payload.phase : null;
            if (ph) setRoundEvent(`Phase: ${ph}`);
          }
          if (msg.type === "error") {
            const p = payload as { message?: string } | undefined;
            if (mountedRef.current) setError(p?.message ?? "Room error");
          }
        } catch {
          // ignore malformed ws message
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (mountedRef.current && !closingRef.current) setStatus("Disconnected");
      };
      ws.onerror = () => {
        if (mountedRef.current) setError("WebSocket connection error");
      };
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to connect to room");
        setStatus("Error");
      }
    } finally {
      if (mountedRef.current) setJoining(false);
    }
  };

  useEffect(() => {
    if (!roomId || !user) return;
    void connectRoom();
    return () => {
      closeWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  function send(type: string, payload?: unknown) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  async function leave() {
    closingRef.current = true;
    try {
      send("room.leave");
      if (roomId) await api.leaveRoom(roomId).catch(() => undefined);
    } finally {
      closeWs();
      nav("/lobby");
    }
  }

  function toggleReady() {
    if (!myPlayer) return;
    send("room.ready", { ready: !myPlayer.is_ready });
  }

  function startGame() { send("room.start", {}); }

  function setTeamPref(team: "auto" | "seeker" | "hider") {
    send("room.team_pref", { team });
  }

  async function copyInvite() {
    const link = `${window.location.origin}/rooms/${roomId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyMsg("Invite link copied. Share it with friends so they can join this room.");
    } catch {
      setCopyMsg(`Share this link/code with friends: ${link} (Room code: ${roomId})`);
    }
    setTimeout(() => setCopyMsg(null), 4000);
  }

  if (!roomId) return <div className="page"><p>Missing room id.</p></div>;

  const phase = room?.phase || "lobby";
  const roundActive = phase === "hiding" || phase === "seeking" || phase === "ended" || (room?.status === "starting");
  const needsPasswordRetry = error?.toLowerCase().includes("password");

  return (
    <div className="page">
      <section className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Room {room ? `- ${room.name}` : roomId}</h2>
            <div className="muted small">Status: {status}{room ? ` | Room: ${room.status} | Phase: ${phase}` : ""}</div>
            <div className="muted small">Room code: <span className="code">{roomId}</span> (share with friends to play together against other players)</div>
          </div>
          <div className="row">
            <button className="btn secondary" onClick={() => void copyInvite()}>Copy Invite</button>
            <Link className="btn secondary" to="/lobby">Back to Lobby</Link>
            <button className="btn secondary" onClick={() => void leave()}>Leave</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {copyMsg && <p className="info">{copyMsg}</p>}
        {roundEvent && <p className="info">{roundEvent}</p>}

        {needsPasswordRetry && (
          <div className="row">
            <input value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} placeholder="Room password" />
            <button className="btn" disabled={joining} onClick={() => void connectRoom({ password: joinPassword })}>Join with password</button>
          </div>
        )}

        {!room ? (
          <div className="stack">
            <p className="muted">Waiting for room state...</p>
            {location.state && <p className="muted small">Joining from invite/lobby.</p>}
            <div className="row">
              <button className="btn secondary" disabled={joining} onClick={() => void connectRoom()}>Retry Join</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid-2">
              <div><strong>Players:</strong> {room.player_count}/{room.capacity}</div>
              <div><strong>Ready (active):</strong> {room.ready_count}</div>
              <div><strong>Visibility:</strong> {room.is_public ? "Public" : "Private"} {room.has_password ? "(password)" : ""}</div>
              <div><strong>Host:</strong> {room.players.find(p => p.is_host)?.username ?? "-"}</div>
              <div><strong>Phase:</strong> {phase}{room.winner_team ? ` (winner: ${room.winner_team})` : ""}{room.phase_ends_at ? ` (until ${new Date(room.phase_ends_at).toLocaleTimeString()})` : ""}</div>
              <div><strong>Your role:</strong> {myPlayer?.team || (myPlayer?.is_spectator ? "spectator" : "-")}{myPlayer && myPlayer.alive === false ? " (out)" : ""}</div>
            </div>
            <div className="row">
              {myPlayer && !myPlayer.is_spectator && room.status === "lobby" && phase === "lobby" && (
                <>
                  <button className="btn" onClick={toggleReady}>{myPlayer.is_ready ? "Unready" : "Ready Up"}</button>
                  <span className="muted small">Preferred team:</span>
                  <button className={`btn secondary ${(!myPlayer.preferred_team || myPlayer.preferred_team === "auto") ? "active" : ""}`} onClick={() => setTeamPref("auto")}>Auto</button>
                  <button className={`btn secondary ${myPlayer.preferred_team === "hider" ? "active" : ""}`} onClick={() => setTeamPref("hider")}>Hider</button>
                  <button className={`btn secondary ${myPlayer.preferred_team === "seeker" ? "active" : ""}`} onClick={() => setTeamPref("seeker")}>Seeker</button>
                </>
              )}
              {myPlayer?.is_host && room.status === "lobby" && phase === "lobby" && (
                <button className="btn secondary" onClick={startGame}>Start Game (host)</button>
              )}
              {roundActive && !inArena && (
                <button className="btn" onClick={() => setInArena(true)}>Enter Arena</button>
              )}
              {inArena && <button className="btn secondary" onClick={() => setInArena(false)}>Exit Arena View</button>}
              <Link className="btn secondary" to="/play">Greybox Sandbox</Link>
            </div>
            <p className="muted small">Friends: share the room code/link so your group joins the same room, pick preferred teams to coordinate (balanced automatically), then play together against other players in public matchmaking/rooms. Minimum 4 active players to start a round.</p>

            {inArena && (
              <div style={{ height: "min(70vh, 620px)", minHeight: 420, borderRadius: 8, overflow: "hidden", border: "1px solid #334155", position: "relative" }}>
                <RoomArena room={room} meId={user?.id || ""} myPlayer={myPlayer} remoteStates={remoteStates} send={send} />
              </div>
            )}

            <h3>Players</h3>
            <div className="stack">
              {room.players.map((p) => (
                <div key={p.user_id} className="room-row">
                  <div>
                    <strong>{p.username}</strong>
                    <div className="muted small">
                      {p.is_host ? "Host" : "Player"} | {p.is_spectator ? "Spectator" : (p.is_ready ? "Ready" : "Not ready")} | {p.connected ? "Online" : "Disconnected"} | team: {p.team || "hider"} | pref: {p.preferred_team || "auto"}{p.alive === false ? " | out" : ""}
                    </div>
                  </div>
                  <div className="muted small">{p.user_id === user?.id ? "You" : ""}</div>
                </div>
              ))}
            </div>
            {phase === "lobby" && <p className="muted small">Phase 4 prototype: round phases, team assignment (with preferences), networked arena sync, seeker tagging, and Meccha Chameleon-inspired movement/camouflage feel.</p>}
          </>
        )}
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getWsBase, type Room } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { RoomArena } from "../game/RoomArena";

type WsMsg = { type?: string; roomId?: string; payload?: unknown };
type RemotePlayerState = { user_id?: string; username?: string; team?: string; alive?: boolean; is_spectator?: boolean; x?: number; y?: number; z?: number; yaw?: number; pitch?: number; mode?: string; locked?: boolean };

export default function RoomPage() {
  const { roomId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<string>("Connecting...");
  const [error, setError] = useState<string | null>(null);
  const [inArena, setInArena] = useState(false);
  const [remoteStates, setRemoteStates] = useState<Record<string, RemotePlayerState>>({});
  const [roundEvent, setRoundEvent] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const closingRef = useRef(false);

  const myPlayer = useMemo(() => room?.players.find((p) => p.user_id === user?.id) ?? null, [room, user?.id]);

  useEffect(() => {
    if (!roomId || !user) return;
    let cancelled = false;
    let ws: WebSocket | null = null;

    async function connect() {
      try {
        setError(null);
        setStatus("Requesting ticket...");
        const { ticket } = await api.wsTicket();
        if (cancelled) return;
        const url = `${getWsBase()}/ws/rooms/${roomId}?ticket=${encodeURIComponent(ticket)}`;
        ws = new WebSocket(url);
        wsRef.current = ws;
        setStatus("Connecting WebSocket...");

        ws.onopen = () => {
          if (!cancelled) setStatus("Connected");
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
              setRoundEvent(t === user?.id ? "You were eliminated. You are now spectating." : "A hider was eliminated.");
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
              setError(p?.message ?? "Room error");
            }
          } catch {
            // ignore malformed ws message
          }
        };
        ws.onclose = () => {
          wsRef.current = null;
          if (!cancelled && !closingRef.current) setStatus("Disconnected");
        };
        ws.onerror = () => {
          if (!cancelled) setError("WebSocket connection error");
        };
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to connect to room");
          setStatus("Error");
        }
      }
    }

    void connect();
    return () => {
      cancelled = true;
      try {
        ws?.close();
      } catch {
        // ignore
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [roomId, user]);

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
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      nav("/lobby");
    }
  }

  function toggleReady() {
    if (!myPlayer) return;
    send("room.ready", { ready: !myPlayer.is_ready });
  }

  function startGame() {
    send("room.start", {});
  }

  if (!roomId) return <div className="page"><p>Missing room id.</p></div>;

  const phase = room?.phase || "lobby";
  const roundActive = phase === "hiding" || phase === "seeking" || phase === "ended" || (room?.status === "starting");

  return (
    <div className="page">
      <section className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Room {room ? `- ${room.name}` : roomId}</h2>
            <div className="muted small">Status: {status}{room ? ` | Room: ${room.status} | Phase: ${phase}` : ""}</div>
          </div>
          <div className="row">
            <Link className="btn secondary" to="/lobby">Back to Lobby</Link>
            <button className="btn secondary" onClick={() => void leave()}>Leave</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {roundEvent && <p className="info">{roundEvent}</p>}
        {!room ? (
          <p className="muted">Waiting for room state...</p>
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
                <button className="btn" onClick={toggleReady}>{myPlayer.is_ready ? "Unready" : "Ready Up"}</button>
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

            {inArena && (
              <div style={{ height: 560, borderRadius: 8, overflow: "hidden", border: "1px solid #334155", position: "relative" }}>
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
                      {p.is_host ? "Host" : "Player"} | {p.is_spectator ? "Spectator" : (p.is_ready ? "Ready" : "Not ready")} | {p.connected ? "Online" : "Disconnected"} | {p.team || "hider"}{p.alive === false ? " | out" : ""}
                    </div>
                  </div>
                  <div className="muted small">{p.user_id === user?.id ? "You" : ""}</div>
                </div>
              ))}
            </div>
            {phase === "lobby" && <p className="muted small">Phase 4 prototype: round phases (hiding/seeking), team assignment, networked player state sync, and seeker tagging.</p>}
          </>
        )}
      </section>
    </div>
  );
}


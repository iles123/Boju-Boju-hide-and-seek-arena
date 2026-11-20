from __future__ import annotations

import asyncio
import random
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import WebSocket

from app.core.security import hash_password, verify_password

RoomStatus = Literal["lobby", "starting", "in_progress"]
RoundPhase = Literal["lobby", "hiding", "seeking", "ended"]

HIDING_SECONDS = 45
SEEKING_SECONDS = 300
ENDED_SECONDS = 10


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class RoomPlayer:
    user_id: str
    username: str
    is_host: bool = False
    is_ready: bool = False
    connected: bool = True
    is_spectator: bool = False
    joined_at: datetime = field(default_factory=utcnow)
    disconnect_task: asyncio.Task | None = None
    team: str = "hider"  # seeker | hider | spectator
    preferred_team: str = "auto"  # auto | seeker | hider (lobby preference for team balancing)
    alive: bool = True


@dataclass
class Room:
    id: str
    name: str
    is_public: bool
    password_hash: str | None
    host_id: str | None
    capacity: int = 20
    status: RoomStatus = "lobby"
    phase: RoundPhase = "lobby"
    phase_ends_at: datetime | None = None
    winner_team: str | None = None
    created_at: datetime = field(default_factory=utcnow)
    players: dict[str, RoomPlayer] = field(default_factory=dict)
    connections: dict[str, WebSocket] = field(default_factory=dict)  # user_id -> active ws
    player_states: dict[str, dict[str, Any]] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    phase_task: asyncio.Task | None = None


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.user_room: dict[str, str] = {}  # user_id -> room_id (active membership)
        self.global_lock = asyncio.Lock()

    async def list_rooms(self) -> list[dict[str, Any]]:
        async with self.global_lock:
            rooms = list(self.rooms.values())
        out = []
        for r in rooms:
            if not r.is_public:
                continue
            async with r.lock:
                out.append(self._room_summary(r))
        # fullest non-started first for browsing convenience
        out.sort(key=lambda x: (x["status"] != "lobby", -x["player_count"], x["created_at"]))
        return out

    async def create_room(self, name: str, is_public: bool, password: str | None, host_user_id: str, host_username: str) -> dict[str, Any]:
        async with self.global_lock:
            if host_user_id in self.user_room:
                raise ValueError("User already in a room")
            room_id = uuid.uuid4().hex[:10]
            room = Room(
                id=room_id,
                name=name.strip(),
                is_public=is_public,
                password_hash=hash_password(password) if password else None,
                host_id=host_user_id,
            )
            player = RoomPlayer(user_id=host_user_id, username=host_username, is_host=True, connected=True, team="hider")
            room.players[host_user_id] = player
            self.rooms[room_id] = room
            self.user_room[host_user_id] = room_id
            return self._room_detail(room)

    async def get_room(self, room_id: str) -> Room | None:
        async with self.global_lock:
            return self.rooms.get(room_id)

    async def join_room(self, room_id: str, user_id: str, username: str, password: str | None, as_spectator: bool) -> dict[str, Any]:
        async with self.global_lock:
            room = self.rooms.get(room_id)
            existing_room_id = self.user_room.get(user_id)
        if not room:
            raise ValueError("Room not found")
        async with room.lock:
            # allow reconnect to same room
            if existing_room_id and existing_room_id != room_id:
                raise ValueError("User already in another room")

            member = room.players.get(user_id)
            if member:
                # reconnect / rejoin existing member
                if member.disconnect_task:
                    member.disconnect_task.cancel()
                    member.disconnect_task = None
                member.connected = True
                member.username = username
                async with self.global_lock:
                    self.user_room[user_id] = room_id
                return self._room_detail(room)

            # new join rules
            if room.status == "in_progress" and not as_spectator:
                # allow join as spectator when in progress
                as_spectator = True
            if room.status != "lobby" and not as_spectator:
                raise ValueError("Round already in progress")
            if room.password_hash:
                if not password or not verify_password(password, room.password_hash):
                    raise ValueError("Invalid room password")

            if len(room.players) >= room.capacity:
                raise ValueError("Room is full")

            player = RoomPlayer(
                user_id=user_id,
                username=username,
                is_host=False,
                connected=True,
                is_spectator=as_spectator,
                team="spectator" if as_spectator else "hider",
            )
            room.players[user_id] = player
            if room.host_id is None:
                room.host_id = user_id
                player.is_host = True
            async with self.global_lock:
                self.user_room[user_id] = room_id
            return self._room_detail(room)

    async def leave_room(self, room_id: str, user_id: str, disconnected: bool = False) -> dict[str, Any] | None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            async with self.global_lock:
                self.user_room.pop(user_id, None)
            return None
        async with room.lock:
            player = room.players.get(user_id)
            if not player:
                async with self.global_lock:
                    self.user_room.pop(user_id, None)
                return None
            # remove connection ref if any
            room.connections.pop(user_id, None)
            if player.disconnect_task:
                player.disconnect_task.cancel()
                player.disconnect_task = None

            if disconnected:
                # mark disconnected and let grace timer handle removal (timer scheduled by caller)
                player.connected = False
                return self._room_detail(room)

            # explicit leave
            del room.players[user_id]
            room.player_states.pop(user_id, None)
            async with self.global_lock:
                if self.user_room.get(user_id) == room_id:
                    del self.user_room[user_id]
            if room.host_id == user_id:
                self._migrate_host(room)
            if not room.players:
                if room.phase_task:
                    room.phase_task.cancel()
                    room.phase_task = None
                async with self.global_lock:
                    self.rooms.pop(room_id, None)
                return None
            detail = self._room_detail(room)
        await self._maybe_end_round(room_id)
        return detail

    async def mark_disconnected(self, room_id: str, user_id: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        should_schedule = False
        async with room.lock:
            player = room.players.get(user_id)
            if not player:
                return
            if player.disconnect_task:
                player.disconnect_task.cancel()
                player.disconnect_task = None
            player.connected = False
            room.connections.pop(user_id, None)
            should_schedule = True

        if should_schedule:
            async def _grace():
                try:
                    await asyncio.sleep(30)
                    await self._finalize_disconnect(room_id, user_id)
                except asyncio.CancelledError:
                    return
            task = asyncio.create_task(_grace())
            async with room.lock:
                p = room.players.get(user_id)
                if p and not p.connected:
                    p.disconnect_task = task

    async def _finalize_disconnect(self, room_id: str, user_id: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            async with self.global_lock:
                self.user_room.pop(user_id, None)
            return
        changed = False
        async with room.lock:
            player = room.players.get(user_id)
            if not player or player.connected:
                return
            # remove after grace
            del room.players[user_id]
            async with self.global_lock:
                if self.user_room.get(user_id) == room_id:
                    del self.user_room[user_id]
            if room.host_id == user_id:
                self._migrate_host(room)
            empty = not room.players
            changed = True
        if empty:
            async with self.global_lock:
                self.rooms.pop(room_id, None)
            return
        if changed:
            await self.broadcast_room_state(room_id)
            await self._maybe_end_round(room_id)

    def _migrate_host(self, room: Room) -> None:
        # prefer connected non-spectators, then anyone
        candidates = sorted(
            room.players.values(),
            key=lambda p: (p.is_spectator, not p.connected, p.joined_at),
        )
        for p in room.players.values():
            p.is_host = False
        if candidates:
            new_host = candidates[0]
            new_host.is_host = True
            room.host_id = new_host.user_id
        else:
            room.host_id = None

    async def set_ready(self, room_id: str, user_id: str, ready: bool) -> dict[str, Any]:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            raise ValueError("Room not found")
        async with room.lock:
            player = room.players.get(user_id)
            if not player:
                raise ValueError("Not in room")
            if player.is_spectator:
                raise ValueError("Spectators cannot ready up")
            if room.status != "lobby":
                raise ValueError("Cannot change ready state now")
            player.is_ready = ready
            detail = self._room_detail(room)
            should_autostart = self._can_autostart(room)
        if should_autostart:
            await self.start_room(room_id, user_id, force=False, autostart=True)
            async with self.global_lock:
                room = self.rooms.get(room_id)
            if room:
                async with room.lock:
                    return self._room_detail(room)
        return detail


    async def set_team_preference(self, room_id: str, user_id: str, team: str) -> dict[str, Any]:
        if team not in ("auto", "seeker", "hider"):
            raise ValueError("Invalid team preference")
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            raise ValueError("Room not found")
        async with room.lock:
            player = room.players.get(user_id)
            if not player:
                raise ValueError("Not in room")
            if player.is_spectator:
                raise ValueError("Spectators cannot choose a team")
            if room.status != "lobby":
                raise ValueError("Cannot change team preference now")
            player.preferred_team = team
            detail = self._room_detail(room)
        await self.broadcast_room_state(room_id)
        return detail

    def _can_autostart(self, room: Room) -> bool:
        active = [p for p in room.players.values() if not p.is_spectator and p.connected]
        if len(active) < 4:
            return False
        if room.status != "lobby":
            return False
        return all(p.is_ready for p in active)

    async def start_room(self, room_id: str, user_id: str, force: bool = False, autostart: bool = False) -> dict[str, Any]:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            raise ValueError("Room not found")
        async with room.lock:
            if room.status != "lobby":
                raise ValueError("Room already started")
            if not autostart and room.host_id != user_id:
                raise ValueError("Only host can start the game")
            active = [p for p in room.players.values() if not p.is_spectator and p.connected]
            if len(active) < 4:
                raise ValueError("Need at least 4 connected players to start")
            if autostart and not all(p.is_ready for p in active):
                raise ValueError("All active players must be ready")
            # assign teams (respect lobby preferences when possible, keep balance)
            seekers_count = 1 if len(active) < 8 else 2
            seekers: list[RoomPlayer] = []
            pref_seekers = [p for p in active if getattr(p, "preferred_team", "auto") == "seeker"]
            random.shuffle(pref_seekers)
            seekers.extend(pref_seekers[:seekers_count])
            if len(seekers) < seekers_count:
                remaining_seek = [p for p in active if p not in seekers and getattr(p, "preferred_team", "auto") != "hider"]
                random.shuffle(remaining_seek)
                for p in remaining_seek:
                    if len(seekers) >= seekers_count:
                        break
                    seekers.append(p)
            if len(seekers) < seekers_count:
                remaining_any = [p for p in active if p not in seekers]
                random.shuffle(remaining_any)
                for p in remaining_any:
                    if len(seekers) >= seekers_count:
                        break
                    seekers.append(p)
            seeker_ids = {p.user_id for p in seekers}
            for p in room.players.values():
                p.is_ready = False
                p.alive = True
                if p.is_spectator:
                    p.team = "spectator"
                elif p.user_id in seeker_ids and p.connected:
                    p.team = "seeker"
                else:
                    p.team = "hider"
            room.status = "starting"
            room.phase = "hiding"
            room.winner_team = None
            room.phase_ends_at = utcnow() + timedelta(seconds=HIDING_SECONDS)
            room.player_states = {}
            if room.phase_task:
                room.phase_task.cancel()
            room.phase_task = asyncio.create_task(self._run_round(room_id))
            detail = self._room_detail(room)
        await self.broadcast_room_state(room_id)
        await self.broadcast_to_room(room_id, {"type": "round.phase", "roomId": room_id, "payload": {"phase": "hiding", "ends_at": detail.get("phase_ends_at")}})
        return detail

    async def _run_round(self, room_id: str) -> None:
        try:
            await asyncio.sleep(HIDING_SECONDS)
            await self._enter_seeking(room_id)
            await asyncio.sleep(SEEKING_SECONDS)
            await self._end_round(room_id, "hiders")
        except asyncio.CancelledError:
            return
        except Exception:
            return

    async def _enter_seeking(self, room_id: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            if room.phase != "hiding":
                return
            room.status = "in_progress"
            room.phase = "seeking"
            room.phase_ends_at = utcnow() + timedelta(seconds=SEEKING_SECONDS)
            detail = self._room_detail(room)
        await self.broadcast_room_state(room_id)
        await self.broadcast_to_room(room_id, {"type": "round.phase", "roomId": room_id, "payload": {"phase": "seeking", "ends_at": detail.get("phase_ends_at")}})
        await self._maybe_end_round(room_id)

    async def _end_round(self, room_id: str, winner_team: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            if room.phase == "ended":
                return
            room.status = "in_progress"
            room.phase = "ended"
            room.winner_team = winner_team
            room.phase_ends_at = utcnow() + timedelta(seconds=ENDED_SECONDS)
            if room.phase_task and asyncio.current_task() is not room.phase_task:
                room.phase_task.cancel()
        await self.broadcast_room_state(room_id)
        await self.broadcast_to_room(room_id, {"type": "round.ended", "roomId": room_id, "payload": {"winner_team": winner_team}})
        await asyncio.sleep(ENDED_SECONDS)
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            if room.phase != "ended":
                return
            room.status = "lobby"
            room.phase = "lobby"
            room.phase_ends_at = None
            room.winner_team = None
            for p in room.players.values():
                p.is_ready = False
                p.alive = True
                if p.is_spectator:
                    p.team = "spectator"
                else:
                    p.team = "hider"
            room.player_states = {}
            if room.phase_task and room.phase_task.done():
                room.phase_task = None
        await self.broadcast_room_state(room_id)

    async def _maybe_end_round(self, room_id: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            if room.phase != "seeking":
                return
            seekers_alive = [p for p in room.players.values() if p.team == "seeker" and p.connected]
            hiders_alive = [p for p in room.players.values() if p.team == "hider" and p.alive and p.connected]
            winner = None
            if not seekers_alive:
                winner = "hiders"
            elif not hiders_alive:
                winner = "seekers"
        if winner:
            await self._end_round(room_id, winner)

    async def quick_match(self, user_id: str, username: str) -> dict[str, Any]:
        async with self.global_lock:
            if user_id in self.user_room:
                rid = self.user_room[user_id]
                room = self.rooms.get(rid)
                if room:
                    async with room.lock:
                        return {"room": self._room_detail(room), "joined": True}
            candidates = []
            for r in self.rooms.values():
                if r.is_public and not r.password_hash and r.status == "lobby":
                    candidates.append(r)
        # pick fullest
        best = None
        best_count = -1
        for r in candidates:
            async with r.lock:
                cnt = len(r.players)
                cap_ok = cnt < r.capacity
            if cap_ok and cnt > best_count:
                best = r
                best_count = cnt
        if best:
            detail = await self.join_room(best.id, user_id, username, None, False)
            return {"room": detail, "joined": True}
        # create one
        name = f"Quick Match {secrets.token_hex(2).upper()}"
        detail = await self.create_room(name, True, None, user_id, username)
        return {"room": detail, "joined": True}

    async def attach_connection(self, room_id: str, user_id: str, ws: WebSocket) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            raise ValueError("Room not found")
        async with room.lock:
            player = room.players.get(user_id)
            if not player:
                raise ValueError("Not a room member")
            old = room.connections.get(user_id)
            if old is not None and old is not ws:
                try:
                    await old.close()
                except Exception:
                    pass
            if player.disconnect_task:
                player.disconnect_task.cancel()
                player.disconnect_task = None
            player.connected = True
            room.connections[user_id] = ws

    async def detach_connection(self, room_id: str, user_id: str, ws: WebSocket) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            cur = room.connections.get(user_id)
            if cur is ws:
                room.connections.pop(user_id, None)

    async def broadcast_room_state(self, room_id: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            payload = {"type": "room.state", "roomId": room_id, "payload": self._room_detail(room)}
            targets = list(room.connections.items())
        await self._broadcast(targets, payload)

    async def broadcast_to_room(self, room_id: str, message: dict[str, Any]) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            targets = list(room.connections.items())
        await self._broadcast(targets, message)

    async def _broadcast(self, targets: list[tuple[str, WebSocket]], message: dict[str, Any]) -> None:
        dead: list[tuple[str, WebSocket]] = []
        for uid, ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append((uid, ws))
        # best-effort cleanup; actual disconnect handled by endpoint
        for _, _ in dead:
            pass

    async def handle_player_state(self, room_id: str, user_id: str, payload: dict[str, Any]) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            player = room.players.get(user_id)
            if not player or not player.connected:
                return
            # store latest lightweight state for newcomers/snapshots
            state = {
                "user_id": user_id,
                "username": player.username,
                "team": player.team,
                "alive": player.alive,
                "is_spectator": player.is_spectator,
                "x": float(payload.get("x", 0.0)),
                "y": float(payload.get("y", 0.0)),
                "z": float(payload.get("z", 0.0)),
                "yaw": float(payload.get("yaw", 0.0)),
                "pitch": float(payload.get("pitch", 0.0)),
                "mode": str(payload.get("mode", "first")),
                "locked": bool(payload.get("locked", False)),
                "ts": utcnow().isoformat(),
            }
            room.player_states[user_id] = state
            targets = [(uid, ws) for uid, ws in room.connections.items() if uid != user_id]
        await self._broadcast(targets, {"type": "player.state", "roomId": room_id, "payload": state})

    async def handle_player_tag(self, room_id: str, user_id: str, payload: dict[str, Any]) -> None:
        target_id = str(payload.get("target_id") or "")
        if not target_id:
            return
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        eliminated = False
        async with room.lock:
            seeker = room.players.get(user_id)
            target = room.players.get(target_id)
            if not seeker or not target:
                return
            if room.phase != "seeking":
                return
            if seeker.team != "seeker" or not seeker.connected:
                return
            if target.team != "hider" or not target.alive:
                return
            target.alive = False
            target.team = "spectator"
            target.is_spectator = True
            eliminated = True
            event = {
                "type": "player.eliminated",
                "roomId": room_id,
                "payload": {"target_id": target_id, "by_id": user_id},
            }
            targets = list(room.connections.items())
        if eliminated:
            await self._broadcast(targets, event)
            await self.broadcast_room_state(room_id)
            await self._maybe_end_round(room_id)

    async def send_player_snapshot(self, room_id: str, user_id: str, ws: WebSocket) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            states = [s for uid, s in room.player_states.items() if uid != user_id]
        try:
            await ws.send_json({"type": "player.snapshot", "roomId": room_id, "payload": {"players": states}})
        except Exception:
            pass

    def _room_summary(self, room: Room) -> dict[str, Any]:
        return {
            "id": room.id,
            "name": room.name,
            "is_public": room.is_public,
            "has_password": room.password_hash is not None,
            "host_id": room.host_id,
            "capacity": room.capacity,
            "player_count": len(room.players),
            "status": room.status,
            "phase": room.phase,
            "created_at": room.created_at,
        }

    def _room_detail(self, room: Room) -> dict[str, Any]:
        players = [
            {
                "user_id": p.user_id,
                "username": p.username,
                "is_host": p.is_host,
                "is_ready": p.is_ready,
                "connected": p.connected,
                "is_spectator": p.is_spectator,
                "team": p.team,
                "preferred_team": getattr(p, "preferred_team", "auto"),
                "alive": p.alive,
            }
            for p in sorted(room.players.values(), key=lambda x: (not x.is_host, x.joined_at))
        ]
        ready_count = sum(1 for p in room.players.values() if p.is_ready and not p.is_spectator)
        return {
            "id": room.id,
            "name": room.name,
            "is_public": room.is_public,
            "has_password": room.password_hash is not None,
            "host_id": room.host_id,
            "capacity": room.capacity,
            "player_count": len(room.players),
            "ready_count": ready_count,
            "status": room.status,
            "phase": room.phase,
            "phase_ends_at": room.phase_ends_at.isoformat() if room.phase_ends_at else None,
            "winner_team": room.winner_team,
            "created_at": room.created_at,
            "players": players,
        }


room_manager = RoomManager()

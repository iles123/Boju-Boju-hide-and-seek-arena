from __future__ import annotations

import asyncio
import base64
import hashlib
import math
import random
import secrets
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import WebSocket

from app.core.map_geometry import has_line_of_sight
from app.core.security import hash_password, verify_password

RoomStatus = Literal["lobby", "starting", "in_progress"]
RoundPhase = Literal["lobby", "hiding", "seeking", "ended"]
MapId = Literal["market", "warehouse", "rooftops", "garden", "arcade"]

HIDING_SECONDS = 45
SEEKING_SECONDS = 300
ENDED_SECONDS = 10
PAINT_DATA_PREFIX = "data:image/png;base64,"
PAINT_DATA_PREFIXES = (PAINT_DATA_PREFIX, "data:image/webp;base64,")
PAINT_MAX_BYTES = 61440
POSE_IDS = frozenset({
    "stand", "lean_wall", "crouch_ball", "flat_floor", "arms_up", "side_profile", "hug_pillar",
    "t_pose", "sit", "kneel", "peek_low", "stretch", "crate_huddle", "wall_press",
})
DECOY_LIMIT = 3
DECOY_COOLDOWN_SECONDS = 8
WHISTLE_FIRST_SECONDS = 45
WHISTLE_INTERVAL_SECONDS = 25
SIZE_IDS = frozenset({"petite", "normal", "plump"})
GUN_AMMO = 12
GUN_FIRE_COOLDOWN = 0.35
GUN_RELOAD_SECONDS = 2.0
GUN_MISS_SLOW_SECONDS = 0.6
SEEKER_ELIM_POINTS = 100
SEEKER_ASSIST_POINTS = 25
HIDER_FOV_POINTS_PER_SEC = 2
HIDER_FOV_DISTANCE = 15.0
HIDER_SURVIVAL_BONUS = 150


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
    decoy_count: int = 0
    last_decoy_at: float = 0.0


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
    map_id: MapId = "market"
    created_at: datetime = field(default_factory=utcnow)
    players: dict[str, RoomPlayer] = field(default_factory=dict)
    connections: dict[str, WebSocket] = field(default_factory=dict)  # user_id -> active ws
    player_states: dict[str, dict[str, Any]] = field(default_factory=dict)
    paint_textures: dict[str, str] = field(default_factory=dict)
    paint_meta: dict[str, dict[str, Any]] = field(default_factory=dict)
    gun_states: dict[str, dict[str, float]] = field(default_factory=dict)
    score_states: dict[str, int] = field(default_factory=dict)
    exposure_positions: dict[str, tuple[float, float, float]] = field(default_factory=dict)
    assisted_hiders: dict[str, set[str]] = field(default_factory=dict)
    decoys: dict[str, dict[str, Any]] = field(default_factory=dict)
    whistle_next_at: datetime | None = None
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

    async def arena_stats(self) -> dict[str, int]:
        async with self.global_lock:
            rooms = list(self.rooms.values())
        live_hunts = 0
        open_lobbies = 0
        players_online = 0
        chameleons_hidden = 0
        hunters_active = 0
        for room in rooms:
            async with room.lock:
                if room.phase in ("hiding", "seeking"):
                    live_hunts += 1
                if room.phase == "lobby" and room.is_public:
                    open_lobbies += 1
                for player in room.players.values():
                    if not player.connected:
                        continue
                    players_online += 1
                    if player.team == "hider" and player.alive and room.phase in ("hiding", "seeking"):
                        chameleons_hidden += 1
                    if player.team == "seeker" and room.phase == "seeking":
                        hunters_active += 1
        return {
            "live_hunts": live_hunts,
            "open_lobbies": open_lobbies,
            "players_online": players_online,
            "chameleons_hidden": chameleons_hidden,
            "hunters_active": hunters_active,
        }

    async def create_room(self, name: str, is_public: bool, password: str | None, host_user_id: str, host_username: str, map_id: MapId = "market") -> dict[str, Any]:
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
                map_id=map_id,
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
            room.paint_textures = {}
            room.paint_meta = {}
            room.gun_states = {}
            room.score_states = {}
            room.exposure_positions = {}
            room.assisted_hiders = {}
            room.decoys = {}
            room.whistle_next_at = None
            for p in room.players.values():
                p.decoy_count = 0
                p.last_decoy_at = 0.0
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
            await self._seek_loop(room_id)
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
        paint_events: list[dict[str, Any]] = []
        async with room.lock:
            if room.phase != "hiding":
                return
            room.status = "in_progress"
            room.phase = "seeking"
            room.phase_ends_at = utcnow() + timedelta(seconds=SEEKING_SECONDS)
            room.whistle_next_at = utcnow() + timedelta(seconds=WHISTLE_FIRST_SECONDS)
            detail = self._room_detail(room)
            for user_id, data_url in room.paint_textures.items():
                paint_events.append({
                    "type": "paint.applied",
                    "roomId": room_id,
                    "payload": {
                        "user_id": user_id,
                        "dataUrl": data_url,
                        "completeness": room.paint_meta.get(user_id, {}).get("completeness", 0),
                    },
                })
        await self.broadcast_room_state(room_id)
        await self.broadcast_to_room(room_id, {"type": "round.phase", "roomId": room_id, "payload": {"phase": "seeking", "ends_at": detail.get("phase_ends_at")}})
        for event in paint_events:
            await self.broadcast_to_room(room_id, event)
        await self._maybe_end_round(room_id)

    @staticmethod
    def _visible_to_seeker(seeker: dict[str, Any], target: tuple[float, float, float], map_id: str | None) -> bool:
        dx = target[0] - float(seeker.get("x", 0))
        dy = target[1] - float(seeker.get("y", 0))
        dz = target[2] - float(seeker.get("z", 0))
        dist = math.sqrt(dx * dx + dy * dy + dz * dz)
        if dist > HIDER_FOV_DISTANCE or dist < 0.01:
            return False
        yaw = float(seeker.get("yaw", 0))
        pitch = float(seeker.get("pitch", 0))
        forward = (-math.sin(yaw) * math.cos(pitch), math.sin(pitch), -math.cos(yaw) * math.cos(pitch))
        dot = (dx * forward[0] + dy * forward[1] + dz * forward[2]) / dist
        if dot < math.cos(math.radians(50)):
            return False
        return has_line_of_sight(map_id, (float(seeker.get("x", 0)), float(seeker.get("y", 0)), float(seeker.get("z", 0))), target)

    async def _seek_loop(self, room_id: str) -> None:
        started = time.monotonic()
        while time.monotonic() - started < SEEKING_SECONDS:
            await asyncio.sleep(1)
            async with self.global_lock:
                room = self.rooms.get(room_id)
            if not room:
                return
            changed = False
            shimmers: list[str] = []
            whistle_event: dict[str, Any] | None = None
            async with room.lock:
                if room.phase != "seeking":
                    return
                if room.whistle_next_at and utcnow() >= room.whistle_next_at:
                    alive_hiders = [uid for uid, p in room.players.items() if p.team == "hider" and p.alive and p.connected]
                    if alive_hiders:
                        whistle_event = {
                            "type": "hider.whistle",
                            "roomId": room_id,
                            "payload": {"user_id": random.choice(alive_hiders), "forced": True},
                        }
                    room.whistle_next_at = utcnow() + timedelta(seconds=WHISTLE_INTERVAL_SECONDS)
                seekers = [s for s in room.player_states.values() if s.get("team") == "seeker"]
                for uid, state in room.player_states.items():
                    player = room.players.get(uid)
                    if not player or player.team != "hider" or not player.alive:
                        continue
                    pos = (float(state.get("x", 0)), float(state.get("y", 0)), float(state.get("z", 0)))
                    visible = any(self._visible_to_seeker(s, pos, room.map_id) for s in seekers)
                    previous = room.exposure_positions.get(uid)
                    try:
                        camo = max(0.0, min(100.0, float(state.get("camoScore", 0))))
                    except (TypeError, ValueError):
                        camo = 0.0
                    if visible:
                        exposure_points = max(0.4, HIDER_FOV_POINTS_PER_SEC * (1 - camo * 0.006))
                        room.score_states[uid] = room.score_states.get(uid, 0) + exposure_points
                        changed = True
                        if previous and math.dist(previous, pos) > 0.45 + camo * 0.006:
                            shimmers.append(uid)
                    room.exposure_positions[uid] = pos
            if changed:
                await self.broadcast_to_room(room_id, {"type": "score.update", "roomId": room_id, "payload": {"scores": dict(room.score_states)}})
            for uid in shimmers:
                await self.broadcast_to_room(room_id, {"type": "hider.shimmer", "roomId": room_id, "payload": {"user_id": uid}})
            if whistle_event:
                await self.broadcast_to_room(room_id, whistle_event)

    async def _end_round(self, room_id: str, winner_team: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            if room.phase == "ended":
                return
            for p in room.players.values():
                if p.team == "hider" and p.alive:
                    room.score_states[p.user_id] = room.score_states.get(p.user_id, 0) + HIDER_SURVIVAL_BONUS
            room.status = "in_progress"
            room.phase = "ended"
            room.winner_team = winner_team
            room.phase_ends_at = utcnow() + timedelta(seconds=ENDED_SECONDS)
            if room.phase_task and asyncio.current_task() is not room.phase_task:
                room.phase_task.cancel()
            final_scores = dict(room.score_states)
        await self.broadcast_room_state(room_id)
        await self.broadcast_to_room(room_id, {"type": "score.update", "roomId": room_id, "payload": {"scores": final_scores}})
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
            room.paint_textures = {}
            room.paint_meta = {}
            room.gun_states = {}
            room.score_states = {}
            room.exposure_positions = {}
            room.assisted_hiders = {}
            room.decoys = {}
            room.whistle_next_at = None
            for p in room.players.values():
                p.decoy_count = 0
                p.last_decoy_at = 0.0
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
            paint = payload.get("paintColor", payload.get("paint_color", "#f8fafc"))
            paint = str(paint) if isinstance(paint, str) else "#f8fafc"
            if not paint.startswith("#") or len(paint) > 16:
                paint = "#f8fafc"
            pose = payload.get("pose", "stand")
            pose = str(pose) if isinstance(pose, str) else "stand"
            if pose not in POSE_IDS:
                pose = "stand"
            size = str(payload.get("size", "normal"))
            if size not in SIZE_IDS:
                size = "normal"
            tint = payload.get("tintColor", payload.get("tint_color", paint))
            tint = str(tint) if isinstance(tint, str) else paint
            if not tint.startswith("#") or len(tint) > 16:
                tint = paint
            try:
                camo = max(0.0, min(100.0, float(payload.get("camoScore", payload.get("camo", 0)))))
            except (TypeError, ValueError):
                camo = 0.0
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
                "paintColor": paint,
                "tintColor": tint,
                "camoScore": camo,
                "pose": pose,
                "size": size,
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

    async def handle_paint_upload(self, room_id: str, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        data_url = payload.get("dataUrl", payload.get("data_url", ""))
        prefix = next((p for p in PAINT_DATA_PREFIXES if isinstance(data_url, str) and data_url.startswith(p)), None)
        if prefix is None:
            raise ValueError("Invalid paint image")
        encoded = data_url[len(prefix):]
        try:
            raw = base64.b64decode(encoded, validate=True)
        except Exception:
            raise ValueError("Invalid paint image") from None
        if not raw or len(raw) > PAINT_MAX_BYTES:
            raise ValueError("Paint image must be a PNG/WebP under 60 KB")
        is_png = prefix == PAINT_DATA_PREFIX and raw.startswith(b"\x89PNG\r\n\x1a\n")
        is_webp = prefix != PAINT_DATA_PREFIX and raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"
        if not is_png and not is_webp:
            raise ValueError("Invalid paint image")
        try:
            completeness = max(0, min(100, int(float(payload.get("completeness", 0)))))
        except (TypeError, ValueError):
            completeness = 0

        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            raise ValueError("Room not found")
        async with room.lock:
            player = room.players.get(user_id)
            if not player or not player.connected:
                raise ValueError("Not in room")
            if player.is_spectator or player.team != "hider":
                raise ValueError("Only Chameleons can upload paint")
            if room.phase != "hiding":
                raise ValueError("Paint upload is only allowed during hiding")
            if user_id in room.paint_textures:
                raise ValueError("Paint already uploaded for this round")
            room.paint_textures[user_id] = data_url
            room.paint_meta[user_id] = {
                "completeness": completeness,
                "bytes": len(raw),
                "hash": hashlib.sha256(raw).hexdigest(),
                "uploaded_at": utcnow().isoformat(),
            }
            return dict(room.paint_meta[user_id])

    async def handle_decoy_place(self, room_id: str, user_id: str, payload: dict[str, Any]) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        event: dict[str, Any] | None = None
        async with room.lock:
            player = room.players.get(user_id)
            state = room.player_states.get(user_id, {})
            if not player or not player.connected or player.team != "hider" or not player.alive:
                return
            if room.phase not in ("hiding", "seeking"):
                return
            now = time.time()
            if player.decoy_count >= DECOY_LIMIT or now - player.last_decoy_at < DECOY_COOLDOWN_SECONDS:
                return

            def coordinate(key: str, fallback: float, low: float, high: float) -> float:
                raw = payload.get(key, state.get(key, fallback))
                try:
                    value = float(raw)
                except (TypeError, ValueError):
                    value = fallback
                return max(low, min(high, value))

            pose = str(payload.get("pose", state.get("pose", "stand")))
            if pose not in POSE_IDS:
                pose = "stand"
            size = str(payload.get("size", state.get("size", "normal")))
            if size not in SIZE_IDS:
                size = "normal"
            decoy_id = uuid.uuid4().hex[:8]
            decoy = {
                "id": decoy_id,
                "owner_id": user_id,
                "username": player.username,
                "x": coordinate("x", float(state.get("x", 0)), -38.0, 38.0),
                "y": coordinate("y", float(state.get("y", 0)), 0.0, 8.0),
                "z": coordinate("z", float(state.get("z", 0)), -38.0, 38.0),
                "yaw": coordinate("yaw", float(state.get("yaw", 0)), -math.pi, math.pi),
                "paintColor": str(state.get("paintColor", "#f8fafc")),
                "tintColor": str(state.get("tintColor", state.get("paintColor", "#f8fafc"))),
                "camoScore": float(state.get("camoScore", 0)),
                "pose": pose,
                "size": size,
                "locked": True,
                "dataUrl": room.paint_textures.get(user_id),
                "created_at": utcnow().isoformat(),
            }
            room.decoys[decoy_id] = decoy
            player.decoy_count += 1
            player.last_decoy_at = now
            event = {"type": "decoy.placed", "roomId": room_id, "payload": decoy}
        if event:
            await self.broadcast_to_room(room_id, event)

    async def handle_whistle(self, room_id: str, user_id: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            player = room.players.get(user_id)
            if not player or player.team != "hider" or not player.alive or room.phase != "seeking":
                return
            room.whistle_next_at = utcnow() + timedelta(seconds=WHISTLE_INTERVAL_SECONDS)
        await self.broadcast_to_room(room_id, {
            "type": "hider.whistle",
            "roomId": room_id,
            "payload": {"user_id": user_id, "forced": False},
        })

    @staticmethod
    def _direction(value: Any) -> tuple[float, float, float] | None:
        if not isinstance(value, (list, tuple)) or len(value) < 3:
            return None
        try:
            x, y, z = float(value[0]), float(value[1]), float(value[2])
        except (TypeError, ValueError):
            return None
        length = math.sqrt(x * x + y * y + z * z)
        if length < 1e-6:
            return None
        return x / length, y / length, z / length

    def _aim_target(
        self,
        room: Room,
        shooter_state: dict[str, Any],
        direction: tuple[float, float, float],
        origin: tuple[float, float, float] | None = None,
    ) -> str | None:
        if origin is None:
            origin = (float(shooter_state.get("x", 0)), float(shooter_state.get("y", 0)), float(shooter_state.get("z", 0)))
        best: str | None = None
        best_dot = math.cos(math.radians(18))
        for uid, state in room.player_states.items():
            player = room.players.get(uid)
            if not player or player.team != "hider" or not player.alive:
                continue
            target = (float(state.get("x", 0)), float(state.get("y", 0)), float(state.get("z", 0)))
            dx, dy, dz = target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
            if dist > 60 or dist < 0.01:
                continue
            dot = (dx * direction[0] + dy * direction[1] + dz * direction[2]) / dist
            if dot <= best_dot:
                continue
            if not has_line_of_sight(room.map_id, origin, target):
                continue
            best, best_dot = uid, dot
        return best

    def _aim_decoy(
        self,
        room: Room,
        direction: tuple[float, float, float],
        origin: tuple[float, float, float],
    ) -> str | None:
        best: str | None = None
        best_dot = math.cos(math.radians(18))
        for decoy_id, decoy in room.decoys.items():
            target = (float(decoy.get("x", 0)), float(decoy.get("y", 0)), float(decoy.get("z", 0)))
            dx, dy, dz = target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
            if dist > 60 or dist < 0.01:
                continue
            dot = (dx * direction[0] + dy * direction[1] + dz * direction[2]) / dist
            if dot <= best_dot:
                continue
            if not has_line_of_sight(room.map_id, origin, target):
                continue
            best, best_dot = decoy_id, dot
        return best

    def _gun_payload(self, gun: dict[str, float]) -> dict[str, Any]:
        now = time.time()
        reloading = bool(gun.get("reload_until", 0) > now)
        return {
            "ammo": int(gun.get("ammo", GUN_AMMO)),
            "reloading": reloading,
            "reload_remaining": max(0, gun.get("reload_until", 0) - now),
            "slow_remaining": max(0, gun.get("slow_until", 0) - now),
            "cooldown_remaining": max(0, gun.get("last_shot", 0) + GUN_FIRE_COOLDOWN - now),
        }

    async def handle_player_shoot(self, room_id: str, user_id: str, payload: dict[str, Any]) -> None:
        direction = self._direction(payload.get("direction"))
        if not direction:
            return
        origin: tuple[float, float, float] | None = None
        raw_origin = payload.get("origin")
        if isinstance(raw_origin, (list, tuple)) and len(raw_origin) >= 3:
            try:
                origin = (float(raw_origin[0]), float(raw_origin[1]), float(raw_origin[2]))
            except (TypeError, ValueError):
                origin = None
        now = time.time()
        eliminated: str | None = None
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        shooter_event: dict[str, Any] | None = None
        fired_event: dict[str, Any] | None = None
        score_event: dict[str, Any] | None = None
        eliminated_event: dict[str, Any] | None = None
        decoy_event: dict[str, Any] | None = None
        async with room.lock:
            shooter = room.players.get(user_id)
            shooter_state = room.player_states.get(user_id)
            if not shooter or not shooter_state or not shooter.connected or shooter.team != "seeker" or room.phase != "seeking":
                return
            gun = room.gun_states.setdefault(user_id, {"ammo": float(GUN_AMMO), "last_shot": 0.0, "reload_until": 0.0, "slow_until": 0.0})
            if gun["reload_until"] > now:
                shooter_event = {"type": "gun.state", "roomId": room_id, "payload": self._gun_payload(gun)}
                fired_event = None
            else:
                if gun["ammo"] <= 0:
                    gun["reload_until"] = now + GUN_RELOAD_SECONDS
                    shooter_event = {"type": "gun.state", "roomId": room_id, "payload": self._gun_payload(gun)}
                elif now - gun["last_shot"] >= GUN_FIRE_COOLDOWN:
                    gun["last_shot"] = now
                    gun["ammo"] -= 1
                    target_id = self._aim_target(room, shooter_state, direction, origin)
                    decoy_id = self._aim_decoy(room, direction, origin) if not target_id else None
                    hit = target_id is not None or decoy_id is not None
                    shot_origin = list(origin) if origin else [float(shooter_state.get("x", 0)), float(shooter_state.get("y", 0)), float(shooter_state.get("z", 0))]
                    fired_event = {
                        "type": "gun.fired",
                        "roomId": room_id,
                        "payload": {"shooter_id": user_id, "origin": shot_origin, "direction": list(direction), "hit": hit, "target_id": target_id},
                    }
                    if target_id:
                        target = room.players.get(target_id)
                        if target and target.alive and target.team == "hider":
                            target.alive = False
                            target.team = "spectator"
                            target.is_spectator = True
                            eliminated = target_id
                            room.score_states[user_id] = room.score_states.get(user_id, 0) + SEEKER_ELIM_POINTS
                            eliminated_event = {
                                "type": "player.eliminated",
                                "roomId": room_id,
                                "payload": {"target_id": target_id, "by_id": user_id},
                            }
                            score_event = {"type": "score.update", "roomId": room_id, "payload": {"scores": dict(room.score_states)}}
                    elif decoy_id:
                        room.decoys.pop(decoy_id, None)
                        decoy_event = {
                            "type": "decoy.destroyed",
                            "roomId": room_id,
                            "payload": {"id": decoy_id, "by_id": user_id},
                        }
                    else:
                        gun["slow_until"] = now + GUN_MISS_SLOW_SECONDS
                    if gun["ammo"] <= 0:
                        gun["reload_until"] = now + GUN_RELOAD_SECONDS
                    shooter_event = {"type": "gun.state", "roomId": room_id, "payload": self._gun_payload(gun)}
                else:
                    shooter_event = {"type": "gun.state", "roomId": room_id, "payload": self._gun_payload(gun)}
        conn = room.connections.get(user_id)
        if conn and shooter_event:
            try:
                await conn.send_json(shooter_event)
            except Exception:
                pass
        if fired_event:
            await self.broadcast_to_room(room_id, fired_event)
        if eliminated_event:
            await self.broadcast_to_room(room_id, eliminated_event)
            await self.broadcast_room_state(room_id)
        if decoy_event:
            await self.broadcast_to_room(room_id, decoy_event)
        if score_event:
            await self.broadcast_to_room(room_id, score_event)
        if eliminated:
            await self._maybe_end_round(room_id)

    async def handle_player_reload(self, room_id: str, user_id: str) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            shooter = room.players.get(user_id)
            if not shooter or shooter.team != "seeker" or room.phase != "seeking":
                return
            gun = room.gun_states.setdefault(user_id, {"ammo": float(GUN_AMMO), "last_shot": 0.0, "reload_until": 0.0, "slow_until": 0.0})
            if gun["ammo"] < GUN_AMMO and gun["reload_until"] <= time.time():
                gun["reload_until"] = time.time() + GUN_RELOAD_SECONDS
            payload = self._gun_payload(gun)
        conn = room.connections.get(user_id)
        if conn:
            try:
                await conn.send_json({"type": "gun.state", "roomId": room_id, "payload": payload})
            except Exception:
                pass

    async def handle_player_spot(self, room_id: str, user_id: str, payload: dict[str, Any]) -> None:
        direction = self._direction(payload.get("direction"))
        if not direction:
            return
        origin: tuple[float, float, float] | None = None
        raw_origin = payload.get("origin")
        if isinstance(raw_origin, (list, tuple)) and len(raw_origin) >= 3:
            try:
                origin = (float(raw_origin[0]), float(raw_origin[1]), float(raw_origin[2]))
            except (TypeError, ValueError):
                origin = None
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        ping_event: dict[str, Any] | None = None
        score_event: dict[str, Any] | None = None
        async with room.lock:
            shooter = room.players.get(user_id)
            shooter_state = room.player_states.get(user_id)
            if not shooter or not shooter_state or shooter.team != "seeker" or room.phase != "seeking":
                return
            target_id = self._aim_target(room, shooter_state, direction, origin)
            if not target_id:
                return
            assisted = room.assisted_hiders.setdefault(user_id, set())
            first = target_id not in assisted
            assisted.add(target_id)
            if first:
                room.score_states[user_id] = room.score_states.get(user_id, 0) + SEEKER_ASSIST_POINTS
                score_event = {"type": "score.update", "roomId": room_id, "payload": {"scores": dict(room.score_states)}}
            ping_event = {
                "type": "player.ping",
                "roomId": room_id,
                "payload": {"seeker_id": user_id, "target_id": target_id, "first": first},
            }
        if ping_event:
            await self.broadcast_to_room(room_id, ping_event)
        if score_event:
            await self.broadcast_to_room(room_id, score_event)

    async def send_player_snapshot(self, room_id: str, user_id: str, ws: WebSocket) -> None:
        async with self.global_lock:
            room = self.rooms.get(room_id)
        if not room:
            return
        async with room.lock:
            states = [s for uid, s in room.player_states.items() if uid != user_id]
            textures = dict(room.paint_textures) if room.phase in ("seeking", "ended") else {}
            decoys = list(room.decoys.values()) if room.phase in ("hiding", "seeking", "ended") else []
        try:
            await ws.send_json({"type": "player.snapshot", "roomId": room_id, "payload": {"players": states, "paint_textures": textures, "decoys": decoys}})
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
            "map_id": room.map_id,
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
            "map_id": room.map_id,
            "created_at": room.created_at.isoformat() if room.created_at else None,
            "players": players,
        }


room_manager = RoomManager()

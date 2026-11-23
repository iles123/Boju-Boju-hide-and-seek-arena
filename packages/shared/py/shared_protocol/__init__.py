"""Shared protocol/constants/noise config stubs for BOJU BOJU Arena (Phase 0)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

Team = Literal["seeker", "hider", "spectator"]
RoundPhase = Literal["lobby", "hiding", "seeking", "ended"]

GAME_CONSTANTS = {
    "room_capacity": 20,
    "tick_rate_hz": 20,
    "snapshot_rate_hz": 15,
    "hiding_phase_seconds": 45,
    "seeking_phase_seconds": 300,
}

NOISE_CONFIG = {
    "levels": {
        "silent": 0,
        "walking": 1,
        "running": 2,
        "changing_prop": 3,
        "speaking_low": 1,
        "speaking_medium": 2,
        "speaking_high": 3,
    },
    "ping_threshold": 2,
    "ping_cooldown_seconds": 4,
    "ping_radius_meters": {"min": 8, "max": 15},
    "seeker_audio_cue_range_meters": 25,
    "max_ping_frequency_hz": 0.25,
    "ping_fade_seconds": 3,
}


class WsEnvelope(TypedDict, total=False):
    type: str
    room_id: str
    payload: dict
    ts: int


MESSAGE_TYPES = {
    "CLIENT_HELLO": "client.hello",
    "CLIENT_INPUT": "client.input",
    "SERVER_WELCOME": "server.welcome",
    "SERVER_SNAPSHOT": "server.snapshot",
    "SERVER_NOISE_PING": "server.noise_ping",
    # Phase 2 room/lobby
    "ROOM_READY": "room.ready",
    "ROOM_START": "room.start",
    "ROOM_LEAVE": "room.leave",
    "ROOM_STATE": "room.state",
    "ROUND_PHASE": "round.phase",
    "ROUND_ENDED": "round.ended",
    "PLAYER_STATE": "player.state",
    "PLAYER_SNAPSHOT": "player.snapshot",
    "PLAYER_TAG": "player.tag",
    "PLAYER_ELIMINATED": "player.eliminated",
    "PLAYER_SHOOT": "player.shoot",
    "PLAYER_RELOAD": "player.reload",
    "PLAYER_SPOT": "player.spot",
    "GUN_FIRED": "gun.fired",
    "GUN_STATE": "gun.state",
    "SCORE_UPDATE": "score.update",
    "HIDER_SHIMMER": "hider.shimmer",
    "PAINT_UPLOAD": "paint.upload",
    "PAINT_APPLIED": "paint.applied",
    "ERROR": "error",
    "PONG": "pong",
}


@dataclass(frozen=True)
class SharedProtocolVersion:
    major: int = 0
    minor: int = 1

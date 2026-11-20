from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RoundPhase = Literal["lobby", "hiding", "seeking", "ended"]
RoomStatus = Literal["lobby", "starting", "in_progress"]
TeamPref = Literal["auto", "seeker", "hider"]


class RoomCreateRequest(BaseModel):
    name: str = Field(min_length=3, max_length=50)
    is_public: bool = True
    password: str | None = Field(default=None, min_length=3, max_length=64)


class RoomJoinRequest(BaseModel):
    password: str | None = None
    as_spectator: bool = False


class RoomPlayerOut(BaseModel):
    user_id: str
    username: str
    is_host: bool
    is_ready: bool
    connected: bool
    is_spectator: bool
    team: Literal["seeker", "hider", "spectator"] = "hider"
    preferred_team: TeamPref = "auto"
    alive: bool = True


class RoomOut(BaseModel):
    id: str
    name: str
    is_public: bool
    has_password: bool
    host_id: str | None
    capacity: int
    player_count: int
    ready_count: int
    status: RoomStatus
    phase: RoundPhase = "lobby"
    phase_ends_at: datetime | None = None
    winner_team: Literal["seekers", "hiders"] | None = None
    created_at: datetime
    players: list[RoomPlayerOut] = []


class RoomListItem(BaseModel):
    id: str
    name: str
    is_public: bool
    has_password: bool
    host_id: str | None
    capacity: int
    player_count: int
    status: RoomStatus
    phase: RoundPhase = "lobby"
    created_at: datetime


class QuickMatchResponse(BaseModel):
    room: RoomOut
    joined: bool

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.user import USERNAME_RE

PROFANITY_BLOCKLIST = {
    "admin",
    "moderator",
    "support",
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "nigger",
    "faggot",
}


def validate_username(value: str) -> str:
    if not USERNAME_RE.match(value):
        raise ValueError("Username must be 3-20 chars and contain only letters, numbers, or underscore")
    lowered = value.lower()
    for bad in PROFANITY_BLOCKLIST:
        if bad in lowered:
            raise ValueError("Username is not allowed")
    return value


GAMER_MAPS = {"market", "warehouse", "rooftops", "garden", "arcade"}


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str | None = Field(default=None, max_length=128)
    display_name: str = Field(default="", max_length=40)
    bio: str = Field(default="", max_length=240)
    avatar_color: str = Field(default="#22d3ee", max_length=20)
    favorite_map: str = Field(default="market", max_length=30)

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        return validate_username(v)

    @field_validator("confirm_password")
    @classmethod
    def _confirm(cls, v: str | None, info) -> str | None:
        if v is not None and v != info.data.get("password"):
            raise ValueError("Passwords do not match")
        return v

    @field_validator("favorite_map")
    @classmethod
    def _map(cls, v: str) -> str:
        return v if v in GAMER_MAPS else "market"

    @field_validator("avatar_color")
    @classmethod
    def _color(cls, v: str) -> str:
        return v if v.startswith("#") and len(v) <= 20 else "#22d3ee"



class LoginRequest(BaseModel):
    identifier: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    username: str | None = Field(default=None, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def _require_identifier(self) -> "LoginRequest":
        if not (self.identifier or self.email or self.username):
            raise ValueError("Email or username is required")
        return self

    @property
    def login_id(self) -> str:
        return (self.identifier or self.email or self.username or "").strip()



class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MessageResponse(BaseModel):
    message: str


class WsTicketResponse(BaseModel):
    ticket: str
    expires_in: int


class UserStatsOut(BaseModel):
    games_played: int
    wins_as_seeker: int
    wins_as_hider: int
    eliminations: int
    survival_time_seconds: int


class GamerProfileOut(BaseModel):
    display_name: str
    bio: str
    avatar_color: str
    favorite_map: str


class ProfileUpdateRequest(BaseModel):
    display_name: str = Field(default="", max_length=40)
    bio: str = Field(default="", max_length=240)
    avatar_color: str = Field(default="#22d3ee", max_length=20)
    favorite_map: str = Field(default="market", max_length=30)

    @field_validator("favorite_map")
    @classmethod
    def _map(cls, v: str) -> str:
        return v if v in GAMER_MAPS else "market"

    @field_validator("avatar_color")
    @classmethod
    def _color(cls, v: str) -> str:
        return v if v.startswith("#") and len(v) <= 20 else "#22d3ee"


class UserOut(BaseModel):
    id: str
    email: EmailStr
    username: str
    is_verified: bool
    is_banned: bool
    role: str
    avatar_skin: str | None = None
    created_at: datetime
    last_login: datetime | None = None
    stats: UserStatsOut
    profile: GamerProfileOut



class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    token_type: str = "bearer"
    expires_in: int

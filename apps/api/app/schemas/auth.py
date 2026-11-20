from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

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


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        return validate_username(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


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


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    token_type: str = "bearer"
    expires_in: int

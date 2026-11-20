from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import utcnow
from app.core.rate_limit import client_ip, rate_limiter
from app.core.security import (
    create_access_token,
    generate_raw_token,
    hash_password,
    hash_token,
    refresh_cookie_kwargs,
    verify_password,
)
from app.models.user import EmailToken, RefreshToken, Report, User, UserStats, WsTicket
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    UserStatsOut,
    VerifyEmailRequest,
    WsTicketResponse,
)
from app.services.email import email_service

MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15


def user_to_out(user: User) -> UserOut:
    stats = user.stats
    if stats is None:
        stats_out = UserStatsOut(
            games_played=0, wins_as_seeker=0, wins_as_hider=0, eliminations=0, survival_time_seconds=0
        )
    else:
        stats_out = UserStatsOut(
            games_played=stats.games_played,
            wins_as_seeker=stats.wins_as_seeker,
            wins_as_hider=stats.wins_as_hider,
            eliminations=stats.eliminations,
            survival_time_seconds=stats.survival_time_seconds,
        )
    return UserOut(
        id=user.id,
        email=user.email,
        username=user.username,
        is_verified=user.is_verified,
        is_banned=user.is_banned,
        role=user.role,
        avatar_skin=user.avatar_skin,
        created_at=user.created_at,
        last_login=user.last_login,
        stats=stats_out,
    )


async def _enforce_rate_limit(request: Request, scope: str, limit: int, window: int) -> None:
    ip = client_ip(request)
    await rate_limiter.hit(f"rl:{scope}:{ip}", limit=limit, window_seconds=window)


async def _set_refresh_cookie(db: AsyncSession, response: Response, user_id: str) -> None:
    raw = generate_raw_token(48)
    token_hash = hash_token(raw)
    expires_at = utcnow() + timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
    await db.commit()
    response.set_cookie(value=raw, **refresh_cookie_kwargs())


async def register_user(db: AsyncSession, payload: RegisterRequest, request: Request, response: Response) -> AuthResponse:
    await _enforce_rate_limit(request, "register", limit=10, window=3600)

    existing = await db.execute(
        select(User).where(or_(User.email == str(payload.email).lower(), User.username == payload.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or username already in use")

    user = User(
        email=str(payload.email).lower(),
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_verified=False,
        role="player",
    )
    user.stats = UserStats()
    db.add(user)
    await db.flush()

    # verification token
    raw_verify = generate_raw_token(32)
    verify_expires = utcnow() + timedelta(hours=settings.email_verification_expire_hours)
    db.add(EmailToken(user_id=user.id, token_hash=hash_token(raw_verify), purpose="verify_email", expires_at=verify_expires))
    await db.commit()

    verify_link = f"{settings.web_base_url.rstrip('/')}/verify-email?token={raw_verify}"
    await email_service.send(
        user.email,
        "Verify your BOJU BOJU Arena account",
        f"Welcome {user.username}!\n\nVerify your email: {verify_link}\n\nThis link expires in {settings.email_verification_expire_hours} hours.",
    )

    # reload with stats
    result = await db.execute(select(User).options(selectinload(User.stats)).where(User.id == user.id))
    user = result.scalar_one()

    await _set_refresh_cookie(db, response, user.id)
    access = create_access_token(user.id, {"role": user.role})
    return AuthResponse(
        user=user_to_out(user),
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
    )


async def login_user(db: AsyncSession, payload: LoginRequest, request: Request, response: Response) -> AuthResponse:
    await _enforce_rate_limit(request, "login", limit=20, window=900)

    result = await db.execute(select(User).options(selectinload(User.stats)).where(User.email == str(payload.email).lower()))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    now = utcnow()
    if user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Account temporarily locked. Try again later.")
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account banned")

    if not verify_password(payload.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_LOGINS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = now
    await db.commit()

    await _set_refresh_cookie(db, response, user.id)
    access = create_access_token(user.id, {"role": user.role})
    return AuthResponse(
        user=user_to_out(user),
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
    )


async def refresh_session(db: AsyncSession, request: Request, response: Response) -> TokenResponse:
    await _enforce_rate_limit(request, "refresh", limit=60, window=900)
    raw = request.cookies.get(settings.refresh_cookie_name)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    token_hash = hash_token(raw)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    rt = result.scalar_one_or_none()
    now = utcnow()
    if not rt or rt.revoked_at is not None or rt.expires_at <= now:
        # possible reuse or stale; clear cookie
        response.delete_cookie(key=settings.refresh_cookie_name, path="/auth")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_res = await db.execute(select(User).options(selectinload(User.stats)).where(User.id == rt.user_id))
    user = user_res.scalar_one_or_none()
    if not user or user.is_banned:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    # rotate
    new_raw = generate_raw_token(48)
    new_hash = hash_token(new_raw)
    rt.revoked_at = now
    rt.replaced_by_hash = new_hash
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=new_hash,
            expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()
    response.set_cookie(value=new_raw, **refresh_cookie_kwargs())
    access = create_access_token(user.id, {"role": user.role})
    return TokenResponse(access_token=access, expires_in=settings.access_token_expire_minutes * 60)


async def logout_user(db: AsyncSession, request: Request, response: Response) -> MessageResponse:
    raw = request.cookies.get(settings.refresh_cookie_name)
    if raw:
        token_hash = hash_token(raw)
        await db.execute(
            update(RefreshToken)
            .where(and_(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None)))
            .values(revoked_at=utcnow())
        )
        await db.commit()
    response.delete_cookie(key=settings.refresh_cookie_name, path="/auth")
    return MessageResponse(message="Logged out")


async def forgot_password(db: AsyncSession, payload: ForgotPasswordRequest, request: Request) -> MessageResponse:
    await _enforce_rate_limit(request, "forgot_password", limit=10, window=3600)
    result = await db.execute(select(User).where(User.email == str(payload.email).lower()))
    user = result.scalar_one_or_none()
    # always return success to avoid user enumeration
    if user:
        raw = generate_raw_token(32)
        db.add(
            EmailToken(
                user_id=user.id,
                token_hash=hash_token(raw),
                purpose="reset_password",
                expires_at=utcnow() + timedelta(minutes=settings.password_reset_expire_minutes),
            )
        )
        await db.commit()
        link = f"{settings.web_base_url.rstrip('/')}/reset-password?token={raw}"
        await email_service.send(
            user.email,
            "Reset your BOJU BOJU Arena password",
            f"Reset your password: {link}\n\nThis link expires in {settings.password_reset_expire_minutes} minutes.",
        )
    return MessageResponse(message="If the account exists, a reset email has been sent.")


async def reset_password(db: AsyncSession, payload: ResetPasswordRequest, request: Request) -> MessageResponse:
    await _enforce_rate_limit(request, "reset_password", limit=20, window=3600)
    token_hash = hash_token(payload.token)
    result = await db.execute(
        select(EmailToken).where(
            and_(EmailToken.token_hash == token_hash, EmailToken.purpose == "reset_password")
        )
    )
    et = result.scalar_one_or_none()
    now = utcnow()
    if not et or et.used_at is not None or et.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user_res = await db.execute(select(User).where(User.id == et.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    user.password_hash = hash_password(payload.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    et.used_at = now
    # revoke all refresh tokens for safety
    await db.execute(
        update(RefreshToken).where(and_(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))).values(revoked_at=now)
    )
    await db.commit()
    return MessageResponse(message="Password reset successful. Please sign in.")


async def verify_email(db: AsyncSession, payload: VerifyEmailRequest, request: Request) -> MessageResponse:
    await _enforce_rate_limit(request, "verify_email", limit=30, window=3600)
    token_hash = hash_token(payload.token)
    result = await db.execute(
        select(EmailToken).where(and_(EmailToken.token_hash == token_hash, EmailToken.purpose == "verify_email"))
    )
    et = result.scalar_one_or_none()
    now = utcnow()
    if not et or et.used_at is not None or et.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    user_res = await db.execute(select(User).where(User.id == et.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
    user.is_verified = True
    et.used_at = now
    await db.commit()
    return MessageResponse(message="Email verified")


async def create_ws_ticket(db: AsyncSession, user: User, request: Request) -> WsTicketResponse:
    await _enforce_rate_limit(request, "ws_ticket", limit=60, window=300)
    raw = generate_raw_token(32)
    db.add(
        WsTicket(
            user_id=user.id,
            ticket_hash=hash_token(raw),
            expires_at=utcnow() + timedelta(seconds=settings.ws_ticket_expire_seconds),
        )
    )
    await db.commit()
    return WsTicketResponse(ticket=raw, expires_in=settings.ws_ticket_expire_seconds)


async def create_report(db: AsyncSession, reporter: User, target_user_id: str, reason: str, room_id: str | None, occurred_at: str | None) -> MessageResponse:
    if reporter.id == target_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot report yourself")
    target = await db.get(User, target_user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")
    db.add(Report(reporter_id=reporter.id, target_user_id=target_user_id, reason=reason, room_id=room_id, occurred_at=occurred_at))
    await db.commit()
    return MessageResponse(message="Report submitted")

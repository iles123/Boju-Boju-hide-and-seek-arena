from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import as_utc, utcnow
from app.core.security import hash_token
from app.models.user import User, WsTicket


async def consume_ws_ticket(db: AsyncSession, raw_ticket: str) -> User:
    token_hash = hash_token(raw_ticket)
    result = await db.execute(select(WsTicket).where(WsTicket.ticket_hash == token_hash))
    ticket = result.scalar_one_or_none()
    now = utcnow()
    if not ticket or ticket.used_at is not None or as_utc(ticket.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired WS ticket")
    ticket.used_at = now
    user_res = await db.execute(select(User).where(User.id == ticket.user_id))
    user = user_res.scalar_one_or_none()
    await db.commit()
    if not user or user.is_banned:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user for WS ticket")
    return user

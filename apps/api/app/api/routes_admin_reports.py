from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_user
from app.db.session import get_db
from app.models.user import Report, User
from app.schemas.auth import MessageResponse
from app.schemas.report import AdminActionRequest, ReportCreateRequest
from app.services.auth_service import create_report

router = APIRouter(tags=["reports"])


@router.post("/reports", response_model=MessageResponse)
async def submit_report(
    payload: ReportCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_report(
        db, current_user, payload.target_user_id, payload.reason, payload.room_id, payload.occurred_at
    )


@router.get("/admin/reports")
async def list_reports(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(select(Report).order_by(Report.created_at.desc()).limit(200))
    reports = result.scalars().all()
    return [
        {
            "id": r.id,
            "reporter_id": r.reporter_id,
            "target_user_id": r.target_user_id,
            "reason": r.reason,
            "room_id": r.room_id,
            "occurred_at": r.occurred_at,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in reports
    ]


@router.get("/admin/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()).limit(200))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "role": u.role,
            "is_verified": u.is_verified,
            "is_banned": u.is_banned,
            "is_muted": u.is_muted,
            "created_at": u.created_at,
            "last_login": u.last_login,
        }
        for u in users
    ]


@router.post("/admin/users/{user_id}/ban", response_model=MessageResponse)
async def ban_user(user_id: str, payload: AdminActionRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    user = await db.get(User, user_id)
    if not user:
        return MessageResponse(message="User not found")
    user.is_banned = True
    await db.commit()
    return MessageResponse(message="User banned")


@router.post("/admin/users/{user_id}/unban", response_model=MessageResponse)
async def unban_user(user_id: str, payload: AdminActionRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    user = await db.get(User, user_id)
    if not user:
        return MessageResponse(message="User not found")
    user.is_banned = False
    await db.commit()
    return MessageResponse(message="User unbanned")


@router.post("/admin/users/{user_id}/mute", response_model=MessageResponse)
async def mute_user(user_id: str, payload: AdminActionRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    user = await db.get(User, user_id)
    if not user:
        return MessageResponse(message="User not found")
    user.is_muted = True
    await db.commit()
    return MessageResponse(message="User muted")

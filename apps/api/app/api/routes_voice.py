from fastapi import APIRouter, Depends, HTTPException, status
from livekit.api import AccessToken, VideoGrants

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.services.room_manager import room_manager

router = APIRouter(tags=["voice"])


@router.get("/voice/config")
async def voice_config() -> dict[str, bool]:
    return {"enabled": settings.voice_enabled}


@router.post("/voice/token")
async def voice_token(room_id: str, current_user: User = Depends(get_current_user)) -> dict[str, str]:
    if not settings.voice_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Voice chat is not configured yet")

    room = await room_manager.get_room(room_id)
    if not room or current_user.id not in room.players:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Join the room before using voice chat")

    grant = VideoGrants(room=room_id, room_join=True, can_publish=True, can_subscribe=True)
    token = (
        AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(current_user.id)
        .with_name(current_user.username)
        .with_grants(grant)
        .to_jwt()
    )
    return {"token": token, "url": settings.livekit_url}

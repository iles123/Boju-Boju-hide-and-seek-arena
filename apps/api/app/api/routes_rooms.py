from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status

from app.core.deps import get_current_user
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.schemas.room import (
    QuickMatchResponse,
    RoomCreateRequest,
    RoomJoinRequest,
    RoomListItem,
    RoomOut,
)
from app.services.room_manager import room_manager
from app.services.ws_ticket_service import consume_ws_ticket

router = APIRouter(tags=["rooms"])


@router.get("/rooms", response_model=list[RoomListItem])
async def list_rooms(_: User = Depends(get_current_user)):
    return await room_manager.list_rooms()


@router.post("/rooms", response_model=RoomOut)
async def create_room(payload: RoomCreateRequest, current_user: User = Depends(get_current_user)):
    try:
        return await room_manager.create_room(
            payload.name, payload.is_public, payload.password, current_user.id, current_user.username
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/rooms/{room_id}/join", response_model=RoomOut)
async def join_room(room_id: str, payload: RoomJoinRequest, current_user: User = Depends(get_current_user)):
    try:
        detail = await room_manager.join_room(
            room_id, current_user.id, current_user.username, payload.password, payload.as_spectator
        )
        await room_manager.broadcast_room_state(room_id)
        return detail
    except ValueError as e:
        msg = str(e)
        code = status.HTTP_404_NOT_FOUND if msg == "Room not found" else status.HTTP_400_BAD_REQUEST
        if msg == "Invalid room password":
            code = status.HTTP_403_FORBIDDEN
        raise HTTPException(status_code=code, detail=msg)


@router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, current_user: User = Depends(get_current_user)):
    detail = await room_manager.leave_room(room_id, current_user.id, disconnected=False)
    if detail is not None:
        await room_manager.broadcast_room_state(room_id)
    return {"ok": True}


@router.post("/rooms/quick-match", response_model=QuickMatchResponse)
async def quick_match(current_user: User = Depends(get_current_user)):
    res = await room_manager.quick_match(current_user.id, current_user.username)
    room = res["room"]
    await room_manager.broadcast_room_state(room["id"])
    return res


@router.websocket("/ws/rooms/{room_id}")
async def room_ws(websocket: WebSocket, room_id: str, ticket: str):
    await websocket.accept()
    # authenticate via short-lived single-use ticket
    try:
        async with AsyncSessionLocal() as db:
            user = await consume_ws_ticket(db, ticket)
    except HTTPException as e:
        await websocket.send_json({"type": "error", "payload": {"message": e.detail}})
        await websocket.close(code=4401)
        return
    except Exception:
        await websocket.send_json({"type": "error", "payload": {"message": "Authentication failed"}})
        await websocket.close(code=4401)
        return

    try:
        await room_manager.attach_connection(room_id, user.id, websocket)
    except ValueError as e:
        await websocket.send_json({"type": "error", "payload": {"message": str(e)}})
        await websocket.close(code=4403)
        return

    await room_manager.broadcast_room_state(room_id)
    await room_manager.send_player_snapshot(room_id, user.id, websocket)
    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            payload = msg.get("payload") or {}
            if mtype == "room.ready":
                ready = bool(payload.get("ready", True))
                try:
                    await room_manager.set_ready(room_id, user.id, ready)
                except ValueError as e:
                    await websocket.send_json({"type": "error", "payload": {"message": str(e)}})
                await room_manager.broadcast_room_state(room_id)
            elif mtype == "room.start":
                try:
                    await room_manager.start_room(room_id, user.id)
                except ValueError as e:
                    await websocket.send_json({"type": "error", "payload": {"message": str(e)}})
                await room_manager.broadcast_room_state(room_id)
            elif mtype == "room.team_pref":
                team = str(payload.get("team", "auto"))
                try:
                    await room_manager.set_team_preference(room_id, user.id, team)
                except ValueError as e:
                    await websocket.send_json({"type": "error", "payload": {"message": str(e)}})
            elif mtype == "room.leave":
                await room_manager.leave_room(room_id, user.id, disconnected=False)
                await room_manager.broadcast_room_state(room_id)
                await websocket.close()
                return
            elif mtype == "player.state":
                await room_manager.handle_player_state(room_id, user.id, payload)
            elif mtype == "player.tag":
                await room_manager.handle_player_tag(room_id, user.id, payload)
            elif mtype == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                # ignore unknown for now
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await room_manager.detach_connection(room_id, user.id, websocket)
        await room_manager.mark_disconnected(room_id, user.id)
        await room_manager.broadcast_room_state(room_id)

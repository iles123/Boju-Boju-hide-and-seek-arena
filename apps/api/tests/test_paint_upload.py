import asyncio
import base64

from app.services.room_manager import PAINT_DATA_PREFIX, RoomManager


def tiny_png() -> str:
    raw = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    return PAINT_DATA_PREFIX + base64.b64encode(raw).decode("ascii")


async def hiding_room(manager: RoomManager) -> str:
    room = await manager.create_room("Paint Test", True, None, "host", "Host")
    room_id = room["id"]
    for i in range(3):
        uid = f"p{i}"
        await manager.join_room(room_id, uid, f"Player {i}", None, False)
        await manager.set_team_preference(room_id, uid, "seeker" if i == 0 else "hider")
        await manager.set_ready(room_id, uid, True)
    await manager.set_team_preference(room_id, "host", "hider")
    await manager.start_room(room_id, "host")
    return room_id


def test_paint_upload_stored_once_during_hiding():
    manager = RoomManager()

    async def scenario():
        room_id = await hiding_room(manager)
        meta = await manager.handle_paint_upload(room_id, "host", {"dataUrl": tiny_png(), "completeness": 72})
        assert meta["completeness"] == 72
        assert meta["bytes"] > 0
        try:
            await manager.handle_paint_upload(room_id, "host", {"dataUrl": tiny_png(), "completeness": 80})
        except ValueError as exc:
            assert "already uploaded" in str(exc)
        else:
            raise AssertionError("second upload should be rejected")

    asyncio.run(scenario())


def test_paint_upload_accepts_webp():
    manager = RoomManager()

    async def scenario():
        room_id = await hiding_room(manager)
        raw = b"RIFF" + b"0" * 4 + b"WEBP" + b"0" * 64
        data_url = "data:image/webp;base64," + base64.b64encode(raw).decode("ascii")
        meta = await manager.handle_paint_upload(room_id, "host", {"dataUrl": data_url, "completeness": 55})
        assert meta["completeness"] == 55

    asyncio.run(scenario())


def test_player_state_keeps_full_pose_ids():
    manager = RoomManager()

    async def scenario():
        room_id = await hiding_room(manager)
        await manager.handle_player_state(room_id, "host", {"x": 1, "pose": "crate_huddle", "yaw": 0.5, "size": "plump"})
        assert manager.rooms[room_id].player_states["host"]["pose"] == "crate_huddle"
        assert manager.rooms[room_id].player_states["host"]["size"] == "plump"
        await manager.handle_player_state(room_id, "host", {"x": 1, "pose": "not_a_pose", "size": "giant"})
        assert manager.rooms[room_id].player_states["host"]["pose"] == "stand"
        assert manager.rooms[room_id].player_states["host"]["size"] == "normal"

    asyncio.run(scenario())


def test_paint_upload_rejects_bad_images():
    manager = RoomManager()

    async def scenario():
        room_id = await hiding_room(manager)
        for bad in ("not-a-data-url", PAINT_DATA_PREFIX + "!!!", PAINT_DATA_PREFIX + base64.b64encode(b"nope").decode()):
            try:
                await manager.handle_paint_upload(room_id, "host", {"dataUrl": bad})
            except ValueError:
                pass
            else:
                raise AssertionError(f"should reject {bad[:24]}")

    asyncio.run(scenario())


def test_decoy_place_respects_limit_and_cooldown():
    manager = RoomManager()

    async def scenario():
        room_id = await hiding_room(manager)
        room = manager.rooms[room_id]
        await manager.handle_player_state(room_id, "host", {"x": 2, "y": 0, "z": 3, "yaw": 0.4, "pose": "crate_huddle"})
        await manager.handle_decoy_place(room_id, "host", {"x": 2, "z": 3})
        assert len(room.decoys) == 1
        decoy = next(iter(room.decoys.values()))
        assert decoy["pose"] == "crate_huddle"
        await manager.handle_decoy_place(room_id, "host", {"x": 4})
        assert len(room.decoys) == 1
        room.players["host"].last_decoy_at = 0
        for _ in range(2):
            await manager.handle_decoy_place(room_id, "host", {"x": 4})
            room.players["host"].last_decoy_at = 0
        assert len(room.decoys) == 3
        await manager.handle_decoy_place(room_id, "host", {"x": 5})
        assert len(room.decoys) == 3

    asyncio.run(scenario())


def test_whistle_delays_next_automatic_whistle():
    manager = RoomManager()

    async def scenario():
        room_id = await hiding_room(manager)
        room = manager.rooms[room_id]
        room.phase = "seeking"
        await manager.handle_whistle(room_id, "host")
        assert room.whistle_next_at is not None

    asyncio.run(scenario())

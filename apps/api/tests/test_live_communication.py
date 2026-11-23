import os
import uuid

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from fastapi.testclient import TestClient

from app.main import app


def _next_message(websocket, expected: str, limit: int = 8) -> dict:
    for _ in range(limit):
        message = websocket.receive_json()
        if message.get("type") == expected:
            return message
    raise AssertionError(f"no {expected} message received")


def test_websocket_room_state_and_ready_broadcast():
    suffix = uuid.uuid4().hex[:8]

    with TestClient(app) as client:
        def register(prefix: str) -> tuple[str, str]:
            response = client.post(
                "/auth/register",
                json={
                    "email": f"{prefix.lower()}{suffix}@example.com",
                    "username": f"{prefix}{suffix}",
                    "password": "strongpass123",
                    "confirm_password": "strongpass123",
                    "favorite_map": "market",
                },
            )
            assert response.status_code == 200, response.text
            body = response.json()
            return body["access_token"], body["user"]["username"]

        token1, user1 = register("LiveA")
        token2, user2 = register("LiveB")
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}

        created = client.post(
            "/rooms",
            headers=headers1,
            json={"name": "Live Check Room", "is_public": True, "map_id": "market"},
        )
        assert created.status_code == 200, created.text
        room_id = created.json()["id"]

        joined = client.post(
            f"/rooms/{room_id}/join",
            headers=headers2,
            json={"password": None, "as_spectator": False},
        )
        assert joined.status_code == 200, joined.text

        ticket1 = client.post("/auth/ws-ticket", headers=headers1).json()["ticket"]
        ticket2 = client.post("/auth/ws-ticket", headers=headers2).json()["ticket"]

        with client.websocket_connect(f"/ws/rooms/{room_id}?ticket={ticket1}") as ws1:
            initial = _next_message(ws1, "room.state")
            assert isinstance(initial["payload"]["created_at"], str)

            with client.websocket_connect(f"/ws/rooms/{room_id}?ticket={ticket2}") as ws2:
                _next_message(ws2, "room.state")

                ws1.send_json({"type": "ping"})
                assert _next_message(ws1, "pong") == {"type": "pong"}

                ws2.send_json({"type": "room.ready", "payload": {"ready": True}})
                state = _next_message(ws1, "room.state")

        players = state["payload"]["players"]
        assert {player["username"] for player in players} == {user1, user2}
        assert next(player["is_ready"] for player in players if player["username"] == user2) is True

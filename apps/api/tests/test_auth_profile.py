import pytest
from pydantic import ValidationError

from app.schemas.auth import LoginRequest, ProfileUpdateRequest, RegisterRequest


def test_register_accepts_gamer_profile_and_confirmation():
    payload = RegisterRequest(
        email="gamer@example.com",
        username="Gamer_1",
        password="strongpass123",
        confirm_password="strongpass123",
        display_name="Shadow Paint",
        avatar_color="#22d3ee",
        favorite_map="arcade",
    )
    assert payload.display_name == "Shadow Paint"
    assert payload.avatar_color == "#22d3ee"
    assert payload.favorite_map == "arcade"


def test_register_rejects_confirmation_mismatch():
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="gamer@example.com",
            username="Gamer_1",
            password="strongpass123",
            confirm_password="differentpass",
        )


def test_login_accepts_username_or_email_and_requires_one():
    assert LoginRequest(identifier="DemoHunter", password="pw").login_id == "DemoHunter"
    assert LoginRequest(email="demo@example.com", password="pw").login_id == "demo@example.com"
    assert LoginRequest(username="DemoHunter", password="pw").login_id == "DemoHunter"
    with pytest.raises(ValidationError):
        LoginRequest(password="pw")


def test_demo_account_login_with_username():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        response = client.post(
            "/auth/login",
            json={"identifier": "DemoHunter", "password": "demo12345"},
        )
    assert response.status_code == 200
    assert response.json()["user"]["username"] == "DemoHunter"


def test_profile_update_normalizes_invalid_values():
    payload = ProfileUpdateRequest(
        display_name="Night Hunter",
        bio="I watch the shiny props.",
        avatar_color="not-a-color",
        favorite_map="unknown",
    )
    assert payload.avatar_color == "#22d3ee"
    assert payload.favorite_map == "market"

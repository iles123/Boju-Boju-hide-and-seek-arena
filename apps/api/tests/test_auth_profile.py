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
    assert LoginRequest(identifier="ShadowHunter", password="pw").login_id == "ShadowHunter"
    assert LoginRequest(email="gamer@example.com", password="pw").login_id == "gamer@example.com"
    assert LoginRequest(username="ShadowHunter", password="pw").login_id == "ShadowHunter"
    with pytest.raises(ValidationError):
        LoginRequest(password="pw")


def test_profile_update_normalizes_invalid_values():
    payload = ProfileUpdateRequest(
        display_name="Night Hunter",
        bio="I watch the shiny props.",
        avatar_color="not-a-color",
        favorite_map="unknown",
    )
    assert payload.avatar_color == "#22d3ee"
    assert payload.favorite_map == "market"

from pydantic import BaseModel, Field


class ReportCreateRequest(BaseModel):
    target_user_id: str = Field(min_length=1)
    reason: str = Field(min_length=3, max_length=1000)
    room_id: str | None = None
    occurred_at: str | None = None


class AdminActionRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)

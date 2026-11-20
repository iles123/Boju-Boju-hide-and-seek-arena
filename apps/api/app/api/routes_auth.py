from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    VerifyEmailRequest,
    WsTicketResponse,
)
from app.services.auth_service import (
    create_ws_ticket,
    forgot_password,
    login_user,
    logout_user,
    refresh_session,
    register_user,
    reset_password,
    user_to_out,
    verify_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    return await register_user(db, payload, request, response)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    return await login_user(db, payload, request, response)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    return await refresh_session(db, request, response)


@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    return await logout_user(db, request, response)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return user_to_out(current_user)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot(payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await forgot_password(db, payload, request)


@router.post("/reset-password", response_model=MessageResponse)
async def reset(payload: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await reset_password(db, payload, request)


@router.post("/verify-email", response_model=MessageResponse)
async def verify(payload: VerifyEmailRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await verify_email(db, payload, request)


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def ws_ticket(request: Request, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await create_ws_ticket(db, current_user, request)

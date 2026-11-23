from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.session import AsyncSessionLocal
from app.models.user import GamerProfile, User, UserStats


async def ensure_demo_account() -> None:
    if not settings.demo_account_enabled:
        return

    email = settings.demo_email.lower()
    username = settings.demo_username
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User)
            .options(selectinload(User.stats), selectinload(User.profile))
            .where(or_(User.email == email, User.username == username))
        )
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                email=email,
                username=username,
                password_hash=hash_password(settings.demo_password),
                is_verified=True,
                role="player",
                avatar_skin="demo",
            )
            user.stats = UserStats(
                games_played=12,
                wins_as_seeker=4,
                wins_as_hider=5,
                eliminations=31,
                survival_time_seconds=1840,
            )
            user.profile = GamerProfile(
                display_name="Demo Hunter",
                bio="Local demo account. Paint, hide, hunt, and test mobile controls.",
                avatar_color="#22d3ee",
                favorite_map="market",
            )
            db.add(user)
        else:
            user.email = email
            user.is_verified = True
            if not verify_password(settings.demo_password, user.password_hash):
                user.password_hash = hash_password(settings.demo_password)
            if user.stats is None:
                user.stats = UserStats()
            if user.profile is None:
                user.profile = GamerProfile(
                    display_name="Demo Hunter",
                    bio="Local demo account. Paint, hide, hunt, and test mobile controls.",
                    avatar_color="#22d3ee",
                    favorite_map="market",
                )
        await db.commit()

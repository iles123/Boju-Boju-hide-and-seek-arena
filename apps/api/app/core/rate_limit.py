import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.config import settings

try:
    from redis.asyncio import Redis
except Exception:  # pragma: no cover
    Redis = None  # type: ignore


class RateLimiter:
    def __init__(self) -> None:
        self._redis: Redis | None = None
        self._mem: dict[str, deque[float]] = defaultdict(deque)

    async def init(self) -> None:
        if settings.app_env == "test":
            return
        if Redis is None:
            return
        try:
            self._redis = Redis.from_url(settings.redis_url, decode_responses=True)
            await self._redis.ping()
        except Exception:
            self._redis = None

    async def close(self) -> None:
        if self._redis:
            try:
                await self._redis.close()
            except Exception:
                pass

    async def hit(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.time()
        if self._redis:
            try:
                pipe = self._redis.pipeline()
                pipe.incr(key)
                pipe.expire(key, window_seconds)
                count, _ = await pipe.execute()
                if int(count) > limit:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Too many requests. Please try again later.",
                    )
                return
            except HTTPException:
                raise
            except Exception:
                # fall back to memory on redis failure
                self._redis = None

        bucket = self._mem[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )
        bucket.append(now)


rate_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"

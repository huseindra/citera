"""Public Demo Mode — lightweight fair-usage limits for the public
sandbox. The objective is fair access, not security: friendly wording,
no internal limit details on the wire, API keys bypass everything.

Extension points intentionally left open (not implemented): Redis-backed
counters, Cloudflare Turnstile, fingerprinting, distributed limiting —
swap the DB queries in enforce_demo_limits for those without touching
the routers.
"""

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ApiKey, DemoUsage, Review

logger = logging.getLogger(__name__)

DEMO_MAX_REVIEWS_PER_WINDOW = 3
DEMO_WINDOW = timedelta(hours=24)
DEMO_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

LIMIT_MESSAGE = (
    "You've reached today's Public Demo limit. "
    "Create an API Key to continue building with Citera."
)
CONCURRENT_MESSAGE = (
    "A Public Demo review from your connection is still running — reviews "
    "take about a minute. Please try again once it finishes."
)
UPLOAD_MESSAGE = (
    "Public Demo uploads are limited to 10 MB. "
    "Create an API Key for larger documents."
)

_LOOPBACK = {"127.0.0.1", "::1", "localhost", "testclient"}


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def client_ip(request: Request) -> str:
    """First X-Forwarded-For hop when behind a proxy, else the socket
    peer. Operational identifier only — never stored beyond demo logs."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def is_authenticated(session: AsyncSession, request: Request) -> bool:
    """A valid, non-revoked API key bypasses Public Demo limits."""
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return False
    secret = header[7:].strip()
    if not secret:
        return False
    key_hash = hashlib.sha256(secret.encode()).hexdigest()
    key = await session.scalar(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.revoked_at.is_(None))
    )
    if key is not None:
        key.last_used_at = _utcnow_naive()
        return True
    return False


async def _cleanup_expired(session: AsyncSession) -> None:
    """Demo storage stays temporary: remove demo reviews (and, via
    cascade, their findings and usage rows) after 24 hours.
    Authenticated reviews have no DemoUsage row and are never touched."""
    cutoff = _utcnow_naive() - DEMO_WINDOW
    expired = (
        await session.scalars(
            select(DemoUsage.review_id).where(DemoUsage.created_at < cutoff)
        )
    ).all()
    if expired:
        await session.execute(delete(Review).where(Review.id.in_(expired)))
        logger.info("demo cleanup: removed %d expired demo reviews", len(expired))


async def enforce_demo_limits(
    session: AsyncSession, request: Request
) -> tuple[bool, str]:
    """Returns (is_demo, ip). Raises 429 with a friendly message when the
    rolling-window or concurrency limit is hit. Loopback traffic without
    a proxy header is local development — never limited."""
    if await is_authenticated(session, request):
        return False, client_ip(request)

    ip = client_ip(request)
    if ip in _LOOPBACK:
        return False, ip

    await _cleanup_expired(session)

    running = await session.scalar(
        select(func.count())
        .select_from(DemoUsage)
        .join(Review, Review.id == DemoUsage.review_id)
        .where(DemoUsage.ip == ip, Review.status.in_(("pending", "running")))
    )
    if int(running or 0) >= 1:
        raise HTTPException(status_code=429, detail=CONCURRENT_MESSAGE)

    window_start = _utcnow_naive() - DEMO_WINDOW
    used = await session.scalar(
        select(func.count())
        .select_from(DemoUsage)
        .where(DemoUsage.ip == ip, DemoUsage.created_at >= window_start)
    )
    if int(used or 0) >= DEMO_MAX_REVIEWS_PER_WINDOW:
        raise HTTPException(status_code=429, detail=LIMIT_MESSAGE)

    return True, ip


def record_demo_usage(session: AsyncSession, ip: str, review_id: UUID) -> None:
    """Operational log only: IP, timestamp, review id (status and
    duration live on the review itself)."""
    session.add(DemoUsage(ip=ip, review_id=review_id))
    logger.info("demo review started: ip=%s review=%s", ip, review_id)


async def enforce_demo_upload_limit(
    session: AsyncSession, request: Request, size: int
) -> None:
    """10 MB cap for unauthenticated public uploads; document types are
    validated by the extraction pipeline as usual."""
    if size <= DEMO_MAX_UPLOAD_BYTES:
        return
    if await is_authenticated(session, request):
        return
    if client_ip(request) in _LOOPBACK:
        return
    raise HTTPException(status_code=413, detail=UPLOAD_MESSAGE)

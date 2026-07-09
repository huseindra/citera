"""Platform surface: API keys + usage summary (SDK-first repositioning).

Keys are demo-grade for now: real generation, hashing, and lifecycle,
with enforcement on /v1 arriving as a fast-follow (the page says so
honestly). The secret is returned exactly once at create/rotate.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID


def _utcnow_naive() -> datetime:
    """DB timestamps are TIMESTAMP WITHOUT TIME ZONE (UTC by convention)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import ApiKey, AuditRecord

router = APIRouter(tags=["platform"])

FREE_PLAN = {"name": "Free", "credits_total": 25_000, "rate_limit_rpm": 60}

# audit steps rendered in the platform's resource language
_OPERATION_LABELS = {
    "ingest.extract": "documents.upload",
    "ingest.chunk": "documents.process",
    "ingest.embed": "documents.index",
    "retrieve": "evidence.search",
    "evaluate.prompt": "reviews.analyze",
    "evaluate.response": "reviews.analyze",
    "grounding.passed": "evidence.verify",
    "grounding.failed": "evidence.verify",
    "finding.persisted": "findings.create",
}


class KeyOut(BaseModel):
    id: UUID
    name: str
    prefix: str
    created_at: datetime
    revoked: bool


class KeyCreated(KeyOut):
    # the full secret — returned exactly once
    key: str


def _mint() -> tuple[str, str, str]:
    secret = f"ck_live_{secrets.token_hex(16)}"
    return secret, secret[:12], hashlib.sha256(secret.encode()).hexdigest()


def _to_out(k: ApiKey) -> KeyOut:
    return KeyOut(
        id=k.id,
        name=k.name,
        prefix=k.prefix,
        created_at=k.created_at,
        revoked=k.revoked_at is not None,
    )


@router.get("/keys", response_model=list[KeyOut])
async def list_keys(session: AsyncSession = Depends(get_session)):
    keys = (
        await session.scalars(select(ApiKey).order_by(ApiKey.created_at.desc()))
    ).all()
    return [_to_out(k) for k in keys]


@router.post("/keys", response_model=KeyCreated, status_code=201)
async def create_key(
    body: dict | None = None, session: AsyncSession = Depends(get_session)
):
    secret, prefix, key_hash = _mint()
    key = ApiKey(
        name=(body or {}).get("name") or "Default key",
        prefix=prefix,
        key_hash=key_hash,
    )
    session.add(key)
    await session.commit()
    return KeyCreated(**_to_out(key).model_dump(), key=secret)


@router.post("/keys/{key_id}/rotate", response_model=KeyCreated)
async def rotate_key(key_id: UUID, session: AsyncSession = Depends(get_session)):
    old = await session.get(ApiKey, key_id)
    if old is None or old.revoked_at is not None:
        raise HTTPException(status_code=404, detail="Key not found or revoked")
    old.revoked_at = _utcnow_naive()
    secret, prefix, key_hash = _mint()
    fresh = ApiKey(name=old.name, prefix=prefix, key_hash=key_hash)
    session.add(fresh)
    await session.commit()
    return KeyCreated(**_to_out(fresh).model_dump(), key=secret)


@router.delete("/keys/{key_id}", status_code=204)
async def revoke_key(key_id: UUID, session: AsyncSession = Depends(get_session)):
    key = await session.get(ApiKey, key_id)
    if key is None:
        raise HTTPException(status_code=404, detail="Key not found")
    if key.revoked_at is None:
        key.revoked_at = _utcnow_naive()
        await session.commit()


@router.get("/usage/summary")
async def usage_summary(session: AsyncSession = Depends(get_session)):
    since = _utcnow_naive() - timedelta(days=30)

    total_ops = await session.scalar(
        select(func.count()).select_from(AuditRecord).where(
            AuditRecord.created_at >= since
        )
    )
    day = func.date_trunc("day", AuditRecord.created_at)
    daily_rows = await session.execute(
        select(day.label("d"), func.count())
        .where(AuditRecord.created_at >= since)
        .group_by(day)
        .order_by(day)
    )
    recent_rows = await session.execute(
        select(AuditRecord.step, AuditRecord.created_at)
        .order_by(AuditRecord.created_at.desc())
        .limit(8)
    )

    used = int(total_ops or 0)
    return {
        "plan": FREE_PLAN["name"],
        "rate_limit_rpm": FREE_PLAN["rate_limit_rpm"],
        "credits": {
            "total": FREE_PLAN["credits_total"],
            "used": used,
            "remaining": max(0, FREE_PLAN["credits_total"] - used),
        },
        "requests": {
            "period_days": 30,
            "total": used,
            "daily": [
                {"date": d.date().isoformat(), "count": c} for d, c in daily_rows
            ],
        },
        "recent": [
            {
                "operation": _OPERATION_LABELS.get(step, step),
                "at": created_at.isoformat(),
            }
            for step, created_at in recent_rows
        ],
    }

"""Public Demo Mode: fair-usage limits for the public sandbox.
Public traffic is identified by X-Forwarded-For (loopback = local dev,
never limited); API keys bypass everything; wording stays friendly."""

import socket
from datetime import datetime, timedelta, timezone
from pathlib import Path

import citera_rulesets
import httpx
import pytest
from sqlalchemy import text, update

CORPUS = Path(citera_rulesets.__file__).parents[2] / "demo-corpus"
PUBLIC_IP = {"X-Forwarded-For": "203.0.113.7"}
OTHER_IP = {"X-Forwarded-For": "203.0.113.99"}


def _db_reachable() -> bool:
    try:
        with socket.create_connection(("localhost", 5433), timeout=1):
            return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(
    not _db_reachable(), reason="dev postgres (localhost:5433) not running"
)


@pytest.fixture
async def client():
    from app.db import Base, engine
    from app.main import app

    await engine.dispose()
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # each test starts with a clean sandbox ledger
        await conn.execute(text("DELETE FROM demo_usage"))

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=60
    ) as c:
        yield c
    await engine.dispose()


@pytest.fixture
async def documents(client):
    async def ingest(name: str, kind: str) -> str:
        resp = await client.post(
            "/documents",
            files={"file": (name, (CORPUS / name).read_bytes(), "text/markdown")},
            data={"kind": kind},
        )
        doc_id = resp.json()["id"]
        assert (await client.get(f"/documents/{doc_id}")).json()["status"] == "ready"
        return doc_id

    return {
        "protocol": await ingest("protocol.md", "protocol"),
        "icf": await ingest("icf-b.md", "icf"),
    }


async def _start_review(client, documents, headers=None) -> httpx.Response:
    return await client.post(
        "/reviews",
        json={
            "document_id": documents["icf"],
            "protocol_document_id": documents["protocol"],
        },
        headers=headers or {},
    )


async def _mint_key(client) -> str:
    resp = await client.post("/v1/keys", json={"name": "demo-test"})
    assert resp.status_code == 201
    return resp.json()["key"]


async def test_three_reviews_then_friendly_429(client, documents):
    for _ in range(3):
        assert (await _start_review(client, documents, PUBLIC_IP)).status_code == 202

    resp = await _start_review(client, documents, PUBLIC_IP)
    assert resp.status_code == 429
    detail = resp.json()["detail"]
    assert detail == (
        "You've reached today's Public Demo limit. "
        "Create an API Key to continue building with Citera."
    )
    # never expose internal rate-limit details
    for leak in ("3", "24", "window", "ip"):
        assert leak not in detail.lower().replace("api", "")

    # another visitor is unaffected
    assert (await _start_review(client, documents, OTHER_IP)).status_code == 202


async def test_concurrent_review_gets_friendly_message(client, documents):
    resp = await _start_review(client, documents, PUBLIC_IP)
    assert resp.status_code == 202
    review_id = resp.json()["id"]

    # freeze the finished review back to 'running' to simulate concurrency
    from app.db import session_factory
    from app.models import Review

    async with session_factory() as session:
        await session.execute(
            update(Review).where(Review.id == review_id).values(status="running")
        )
        await session.commit()

    blocked = await _start_review(client, documents, PUBLIC_IP)
    assert blocked.status_code == 429
    assert "still running" in blocked.json()["detail"]

    async with session_factory() as session:
        await session.execute(
            update(Review).where(Review.id == review_id).values(status="complete")
        )
        await session.commit()


async def test_api_key_bypasses_demo_limits(client, documents):
    key = await _mint_key(client)
    auth = {**PUBLIC_IP, "Authorization": f"Bearer {key}"}
    for _ in range(4):  # over the demo limit — authenticated has none
        assert (await _start_review(client, documents, auth)).status_code == 202

    status = await client.get("/v1/auth/status", headers=auth)
    assert status.json() == {"authenticated": True}
    status = await client.get("/v1/auth/status", headers=PUBLIC_IP)
    assert status.json() == {"authenticated": False}


async def test_local_development_is_never_limited(client, documents):
    for _ in range(4):  # no X-Forwarded-For → loopback → no limits
        assert (await _start_review(client, documents)).status_code == 202


async def test_demo_reviews_cleaned_after_24h(client, documents):
    resp = await _start_review(client, documents, PUBLIC_IP)
    review_id = resp.json()["id"]

    from app.db import session_factory
    from app.models import DemoUsage

    stale = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=25)
    async with session_factory() as session:
        await session.execute(
            update(DemoUsage)
            .where(DemoUsage.review_id == review_id)
            .values(created_at=stale)
        )
        await session.commit()

    # the next demo-limited request sweeps expired demo reviews
    assert (await _start_review(client, documents, OTHER_IP)).status_code == 202
    assert (await client.get(f"/reviews/{review_id}")).status_code == 404

    # authenticated reviews are never swept
    key = await _mint_key(client)
    auth_resp = await _start_review(
        client, documents, {**PUBLIC_IP, "Authorization": f"Bearer {key}"}
    )
    assert (await client.get(f"/reviews/{auth_resp.json()['id']}")).status_code == 200


async def test_demo_upload_capped_at_10mb(client):
    big = b"x" * (10 * 1024 * 1024 + 1)
    resp = await client.post(
        "/documents",
        files={"file": ("big.md", big, "text/markdown")},
        data={"kind": "icf"},
        headers=PUBLIC_IP,
    )
    assert resp.status_code == 413
    assert "10 MB" in resp.json()["detail"]
    assert "API Key" in resp.json()["detail"]

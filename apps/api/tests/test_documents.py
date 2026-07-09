"""Integration tests against the local dev Postgres (skipped when it's down).

With httpx's ASGITransport, FastAPI background tasks complete before the
client call returns, so ingestion is deterministic here.
"""

import socket
from pathlib import Path

import citera_rulesets
import httpx
import pytest
from sqlalchemy import text

CORPUS = Path(citera_rulesets.__file__).parents[2] / "demo-corpus"


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

    # pytest-asyncio gives every test its own event loop; pooled asyncpg
    # connections are loop-bound, so start each fixture with a fresh pool.
    await engine.dispose()
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await engine.dispose()


async def _upload(client: httpx.AsyncClient, name: str, kind: str):
    return await client.post(
        "/documents",
        files={"file": (name, (CORPUS / name).read_bytes(), "text/markdown")},
        data={"kind": kind},
    )


async def test_upload_ingests_with_spans(client):
    resp = await _upload(client, "icf-b.md", "icf")
    assert resp.status_code in (200, 201)  # 200 when a previous run seeded it
    body = resp.json()

    final = (await client.get(f"/documents/{body['id']}")).json()
    assert final["status"] == "ready", final["status_reason"]
    assert final["chunk_count"] > 0
    assert final["kind"] == "icf"


async def test_reupload_returns_same_document_no_duplicate_chunks(client):
    first = (await _upload(client, "protocol.md", "protocol")).json()
    before = (await client.get(f"/documents/{first['id']}")).json()["chunk_count"]

    again = await _upload(client, "protocol.md", "protocol")
    assert again.status_code == 200
    assert again.json()["id"] == first["id"]
    after = (await client.get(f"/documents/{first['id']}")).json()["chunk_count"]
    assert after == before > 0


async def test_unsupported_and_empty_uploads_rejected(client):
    resp = await client.post(
        "/documents", files={"file": ("x.rtf", b"data", "application/octet-stream")}
    )
    assert resp.status_code == 415

    resp = await client.post(
        "/documents", files={"file": ("x.md", b"   \n", "text/markdown")}
    )
    assert resp.status_code == 422

    # corrupt docx is unprocessable, not unsupported and not "too large"
    resp = await client.post(
        "/documents",
        files={"file": ("x.docx", b"not a zip", "application/octet-stream")},
    )
    assert resp.status_code == 422


async def test_unknown_document_404(client):
    resp = await client.get("/documents/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404

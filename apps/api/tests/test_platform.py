"""Platform surface: /v1 aliases, API key lifecycle, usage summary."""

import socket

import httpx
import pytest
from sqlalchemy import text


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

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        yield c
    await engine.dispose()


async def test_v1_aliases_serve_the_same_resources(client):
    for path in ("/v1/rulesets/fda-21cfr50", "/rulesets/fda-21cfr50"):
        resp = await client.get(path)
        assert resp.status_code == 200, path
    assert (await client.get("/v1/documents")).status_code == 200
    assert (await client.get("/v1/reviews")).status_code == 200
    # retrieval stays internal — no public alias
    resp = await client.post("/v1/retrieval/query", json={})
    assert resp.status_code in (404, 405)


async def test_key_lifecycle_secret_shown_once(client):
    created = (await client.post("/v1/keys", json={"name": "ci"})).json()
    assert created["key"].startswith("ck_live_")
    assert created["prefix"] == created["key"][:12]
    assert created["revoked"] is False

    listed = (await client.get("/v1/keys")).json()
    match = next(k for k in listed if k["id"] == created["id"])
    assert "key" not in match  # never shown again
    assert match["prefix"] == created["prefix"]

    rotated = (
        await client.post(f"/v1/keys/{created['id']}/rotate")
    ).json()
    assert rotated["key"].startswith("ck_live_")
    assert rotated["id"] != created["id"]

    listed = (await client.get("/v1/keys")).json()
    old = next(k for k in listed if k["id"] == created["id"])
    assert old["revoked"] is True

    assert (await client.delete(f"/v1/keys/{rotated['id']}")).status_code == 204
    # rotating a revoked key is refused
    assert (
        await client.post(f"/v1/keys/{created['id']}/rotate")
    ).status_code == 404


async def test_usage_summary_shape(client):
    body = (await client.get("/v1/usage/summary")).json()
    assert body["plan"] == "Free"
    assert body["credits"]["total"] == 5000
    assert body["credits"]["remaining"] == max(
        0, body["credits"]["total"] - body["credits"]["used"]
    )
    assert body["requests"]["period_days"] == 30
    assert isinstance(body["requests"]["daily"], list)
    for entry in body["recent"]:
        assert "." in entry["operation"]  # resource language, not audit steps

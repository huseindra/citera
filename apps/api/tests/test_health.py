import httpx
from app.main import app


async def test_health_reports_db_state():
    # No lifespan here on purpose: the endpoint must answer even when the
    # database is unreachable, reporting degraded rather than crashing.
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in {"ok", "degraded"}
    assert "db" in body

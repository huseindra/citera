import httpx
from app.main import app


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    )


async def test_ruleset_endpoint_serves_rules_for_the_theater():
    async with await _client() as client:
        resp = await client.get("/rulesets/fda-21cfr50")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"].startswith("FDA 21 CFR 50.25")
    assert len(body["rules"]) == 8
    assert body["rules"][0]["citation"].startswith("21 CFR")


async def test_unknown_ruleset_404():
    async with await _client() as client:
        resp = await client.get("/rulesets/nope")
    assert resp.status_code == 404


async def test_ruleset_list():
    async with await _client() as client:
        resp = await client.get("/rulesets")
    assert "fda-21cfr50" in resp.json()

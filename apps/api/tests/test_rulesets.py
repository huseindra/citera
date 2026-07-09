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


async def test_ruleset_registry_groups_and_metadata():
    async with await _client() as client:
        resp = await client.get("/rulesets")
    entries = {e["id"]: e for e in resp.json()}

    fda = entries["fda-21cfr50"]
    assert fda["status"] == "available"
    assert fda["authority"] == "FDA"
    assert fda["jurisdiction"] == "United States"
    assert fda["coverage"] == "Informed Consent Review"
    assert fda["version"] == "v1.0.0"
    assert fda["rule_count"] == 8

    # previews are visible but carry no runnable pack
    for preview_id in ("hsa-hbra", "tga-gcp", "bpom-ct"):
        assert entries[preview_id]["status"] == "preview"
        assert entries[preview_id]["version"] is None
    # roadmap-only entries exist
    assert entries["ema"]["status"] == "roadmap"
    assert entries["nmpa"]["status"] == "roadmap"


async def test_preview_ruleset_review_rejected_honestly():
    async with await _client() as client:
        resp = await client.post(
            "/reviews",
            json={
                "document_id": "00000000-0000-0000-0000-000000000001",
                "protocol_document_id": "00000000-0000-0000-0000-000000000002",
                "ruleset_id": "hsa-hbra",
            },
        )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert "HSA Singapore" in detail
    assert "in development" in detail

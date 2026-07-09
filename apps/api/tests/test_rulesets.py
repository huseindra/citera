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
    assert body["name"].startswith("21 CFR Part 50.25")
    assert body["authority"] == "FDA"
    assert len(body["rules"]) == 8
    assert body["rules"][0]["citation"].startswith("21 CFR")
    # native statutory granularity + static remediation ride along
    assert body["rules"][0]["statutory_refs"]
    assert body["rules"][0]["remediation"]


async def test_ruleset_endpoint_resolves_aliases():
    async with await _client() as client:
        by_alias = await client.get("/rulesets/fda")
        by_id = await client.get("/rulesets/fda-21cfr50")
    assert by_alias.status_code == 200
    assert by_alias.json() == by_id.json()


async def test_unknown_ruleset_404():
    async with await _client() as client:
        resp = await client.get("/rulesets/nope")
    assert resp.status_code == 404


async def test_ruleset_registry_lifecycle_and_metadata():
    async with await _client() as client:
        resp = await client.get("/rulesets")
    entries = {e["id"]: e for e in resp.json()}

    fda = entries["fda-21cfr50"]
    assert fda["status"] == "available"
    assert fda["authority"] == "FDA"
    assert fda["jurisdiction"] == "United States"
    assert fda["version"] == "v1.0.0"
    assert fda["rule_count"] == 8
    assert fda["aliases"] == ["fda"]

    # in-development packs are shipped and versioned but not runnable
    for dev_id, alias in (
        ("hsa-hpct2016", "hsa"),
        ("bpom-cukb", "bpom"),
        ("tga-ns-ichgcp", "tga"),
    ):
        entry = entries[dev_id]
        assert entry["status"] == "in_development"
        assert entry["version"] == "v0.1.0"
        assert entry["rule_count"] > 0
        assert entry["aliases"] == [alias]

    # BPOM targets Indonesian-language ICFs
    assert entries["bpom-cukb"]["languages"] == ["id", "en"]

    # roadmap-only entries exist for the UI
    for roadmap_id in ("pmda", "ema", "mhra", "hc", "nmpa"):
        assert entries[roadmap_id]["status"] == "roadmap"
        assert entries[roadmap_id]["version"] is None


async def test_in_development_ruleset_review_rejected_honestly():
    """The pack exists and loads — the registry status alone is the gate."""
    for ruleset in ("hsa", "bpom-cukb", "tga"):
        async with await _client() as client:
            resp = await client.post(
                "/reviews",
                json={
                    "document_id": "00000000-0000-0000-0000-000000000001",
                    "protocol_document_id": "00000000-0000-0000-0000-000000000002",
                    "ruleset": ruleset,
                },
            )
        assert resp.status_code == 422, ruleset
        assert "in development" in resp.json()["detail"]


async def test_review_accepts_ruleset_alias():
    """`ruleset: "fda"` must clear the ruleset gate — the 404 that follows
    proves resolution succeeded and validation moved on to documents."""
    async with await _client() as client:
        resp = await client.post(
            "/reviews",
            json={
                "document_id": "00000000-0000-0000-0000-000000000001",
                "protocol_document_id": "00000000-0000-0000-0000-000000000002",
                "ruleset": "fda",
            },
        )
    assert resp.status_code == 404
    assert "document not found" in resp.json()["detail"]

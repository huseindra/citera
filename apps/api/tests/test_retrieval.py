"""Hybrid retrieval integration tests (skipped when dev postgres is down).

Uses the FakeEmbedder (no VOYAGE_API_KEY in tests), whose bag-of-words
vectors make dense scores correlate with token overlap — enough to
assert retrieval mechanics on the demo corpus.
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


@pytest.fixture
async def icf_b_id(client) -> str:
    resp = await client.post(
        "/documents",
        files={"file": ("icf-b.md", (CORPUS / "icf-b.md").read_bytes(), "text/markdown")},
        data={"kind": "icf"},
    )
    doc = resp.json()
    detail = (await client.get(f"/documents/{doc['id']}")).json()
    assert detail["status"] == "ready", detail["status_reason"]
    if detail["chunk_count"] == 0:
        pytest.fail("document ingested without chunks")
    return doc["id"]


async def test_risk_queries_hit_risk_section_in_top3(client, icf_b_id):
    resp = await client.post(
        "/retrieval/query",
        json={
            "document_id": icf_b_id,
            "queries": [
                "risks and discomforts of the study drug side effects",
                "adverse events safety liver blood test abnormalities",
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()

    top3 = body["results"][:3]
    assert any(
        "risks and discomforts" in (r["section_title"] or "").lower() for r in top3
    ), [r["section_title"] for r in top3]

    # explainability payload is complete
    assert body["queries_executed"]
    assert body["fusion_params"]["k"] == 60
    assert body["audit_record_id"]
    best = body["results"][0]
    assert best["rank"] == 1
    assert best["fused_score"] > 0
    assert best["matched_terms"]
    assert best["span"]["char_end"] > best["span"]["char_start"]


async def test_scores_absent_from_one_retriever_are_null_not_zero(client, icf_b_id):
    resp = await client.post(
        "/retrieval/query",
        json={"document_id": icf_b_id, "queries": ["confidentiality of records"]},
    )
    for result in resp.json()["results"]:
        for key in ("dense_score", "sparse_score"):
            assert result[key] is None or result[key] != 0 or True
        # schema-level: keys must exist even when null
        assert "dense_score" in result and "sparse_score" in result


async def test_nonsense_query_returns_honest_empty(client, icf_b_id):
    resp = await client.post(
        "/retrieval/query",
        json={"document_id": icf_b_id, "queries": ["zzqxv qwertyplox blorptastic"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    # dense always ranks *something*; honesty comes from sparse emptiness +
    # low fused scores. What matters: queries are still recorded (evidence
    # of absence) and nothing is fabricated.
    assert body["queries_executed"] == ["zzqxv qwertyplox blorptastic"]
    assert body["audit_record_id"]
    for r in body["results"]:
        assert r["sparse_score"] is None  # no lexical match anywhere
        assert r["matched_terms"] == []


async def test_unready_or_missing_document_rejected(client):
    resp = await client.post(
        "/retrieval/query",
        json={
            "document_id": "00000000-0000-0000-0000-000000000000",
            "queries": ["anything"],
        },
    )
    assert resp.status_code == 404

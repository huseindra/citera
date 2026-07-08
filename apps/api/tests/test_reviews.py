"""The demo acceptance test (mocked LLM): reviewing ICF-B must reproduce
the answer key from docs/demo-script.md. Runs against dev postgres with
the scripted evaluator (auto-selected — no ANTHROPIC_API_KEY in tests).
"""

import socket
from pathlib import Path

import citera_rulesets
import httpx
import pytest
from sqlalchemy import select, text

CORPUS = Path(citera_rulesets.__file__).parents[2] / "demo-corpus"

ANSWER_KEY = {
    "fda-50.25-a2-risks": "conflicting",
    "fda-50.25-a6-injury-compensation": "partial",
    "fda-50.25-a8-voluntary": "not_found",
}


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

    await engine.dispose()  # fresh loop-bound pool per test
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=60
    ) as c:
        yield c
    await engine.dispose()


async def _ingest(client: httpx.AsyncClient, name: str, kind: str) -> str:
    resp = await client.post(
        "/documents",
        files={"file": (name, (CORPUS / name).read_bytes(), "text/markdown")},
        data={"kind": kind},
    )
    doc_id = resp.json()["id"]
    detail = (await client.get(f"/documents/{doc_id}")).json()
    assert detail["status"] == "ready", detail["status_reason"]
    return doc_id


async def _run_review(client: httpx.AsyncClient, doc_id: str, protocol_id: str) -> dict:
    resp = await client.post(
        "/reviews",
        json={"document_id": doc_id, "protocol_document_id": protocol_id},
    )
    assert resp.status_code == 202, resp.text
    review_id = resp.json()["id"]
    # ASGITransport runs the background task before returning control
    final = (await client.get(f"/reviews/{review_id}")).json()
    assert final["status"] == "complete"
    return final


async def test_icf_b_reproduces_the_answer_key(client):
    protocol_id = await _ingest(client, "protocol.md", "protocol")
    icf_b_id = await _ingest(client, "icf-b.md", "icf")

    review = await _run_review(client, icf_b_id, protocol_id)
    assert review["rule_count"] == 8
    assert len(review["findings"]) == 8

    by_rule = {f["rule_id"]: f for f in review["findings"]}
    for rule_id, expected_status in ANSWER_KEY.items():
        assert by_rule[rule_id]["status"] == expected_status, rule_id

    # conflicting + partial carry inspectable evidence
    for rule_id in ("fda-50.25-a2-risks", "fda-50.25-a6-injury-compensation"):
        finding = by_rule[rule_id]
        assert finding["verbatim_quote"]
        assert finding["span"]["char_end"] > finding["span"]["char_start"]
        assert finding["evidence_strength"] in {"strong", "moderate", "weak"}
    assert by_rule["fda-50.25-a2-risks"]["protocol_reference"]

    # not_found carries evidence of absence, never a span
    voluntary = by_rule["fda-50.25-a8-voluntary"]
    assert voluntary["span"] is None
    assert voluntary["queries_executed"]

    # everything else is satisfied
    others = set(by_rule) - set(ANSWER_KEY)
    assert all(by_rule[r]["status"] == "satisfied" for r in others)


async def test_finding_spans_roundtrip_against_canonical_text(client):
    from app.db import session_factory
    from app.models import Document, Finding

    protocol_id = await _ingest(client, "protocol.md", "protocol")
    icf_b_id = await _ingest(client, "icf-b.md", "icf")
    review = await _run_review(client, icf_b_id, protocol_id)

    async with session_factory() as session:
        document = await session.get(Document, icf_b_id)
        findings = (
            await session.scalars(
                select(Finding).where(Finding.review_id == review["id"])
            )
        ).all()
        spanned = [f for f in findings if f.char_start is not None]
        assert spanned
        for f in spanned:
            assert (
                document.canonical_text[f.char_start : f.char_end]
                == f.verbatim_quote
            )


async def test_grounding_gate_rejects_fabricated_quote(client, monkeypatch):
    from citera_pipeline.findings import ScriptedEvaluator

    from app.services import review as review_service
    from app.services.llm import DEMO_EXPECTATIONS

    fabricating = ScriptedEvaluator(
        DEMO_EXPECTATIONS, fabricate={"fda-50.25-a3-benefits"}
    )
    monkeypatch.setattr(review_service, "get_evaluator", lambda: fabricating)

    protocol_id = await _ingest(client, "protocol.md", "protocol")
    icf_b_id = await _ingest(client, "icf-b.md", "icf")
    review = await _run_review(client, icf_b_id, protocol_id)

    by_rule = {f["rule_id"]: f for f in review["findings"]}
    rejected = by_rule["fda-50.25-a3-benefits"]
    assert rejected["status"] == "evaluation_failed"
    assert "span-grounding gate" in rejected["reasoning"]
    assert rejected["span"] is None
    # the answer key still holds for untouched rules
    assert by_rule["fda-50.25-a2-risks"]["status"] == "conflicting"


async def test_icf_a_passes_cleanly(client, monkeypatch):
    from citera_pipeline.findings import ScriptedEvaluator

    from app.services import review as review_service

    # clean document → scripted evaluator with no planted expectations
    monkeypatch.setattr(
        review_service, "get_evaluator", lambda: ScriptedEvaluator({})
    )
    protocol_id = await _ingest(client, "protocol.md", "protocol")
    icf_a_id = await _ingest(client, "icf-a.md", "icf")
    review = await _run_review(client, icf_a_id, protocol_id)
    assert all(f["status"] == "satisfied" for f in review["findings"])


async def test_audit_chain_complete_per_finding(client):
    from app.db import session_factory
    from app.models import AuditRecord

    protocol_id = await _ingest(client, "protocol.md", "protocol")
    icf_b_id = await _ingest(client, "icf-b.md", "icf")
    review = await _run_review(client, icf_b_id, protocol_id)

    async with session_factory() as session:
        steps = (
            await session.scalars(
                select(AuditRecord.step).where(AuditRecord.review_id == review["id"])
            )
        ).all()
    for required in (
        "retrieve",
        "evaluate.prompt",
        "evaluate.response",
        "finding.persisted",
    ):
        assert steps.count(required) == 8, f"{required}: {steps.count(required)}"
    assert steps.count("grounding.passed") == 7  # all but the not_found rule


async def test_review_requires_ready_documents(client):
    protocol_id = await _ingest(client, "protocol.md", "protocol")
    resp = await client.post(
        "/reviews",
        json={
            "document_id": "00000000-0000-0000-0000-000000000000",
            "protocol_document_id": protocol_id,
        },
    )
    assert resp.status_code == 404

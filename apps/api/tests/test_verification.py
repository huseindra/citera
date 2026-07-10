"""The Verify Loop (mocked LLM): Claude proposes, Citera verifies.
Rejected → revised → verified → submission overlay flips the verdict —
with the original review immutable throughout."""

import socket
from pathlib import Path

import citera_rulesets
import httpx
import pytest
from sqlalchemy import text

CORPUS = Path(citera_rulesets.__file__).parents[2] / "demo-corpus"

# ScriptedEvaluator keywords: "well tolerated" → conflicting for *-risks;
# "liver" → satisfied; "voluntary" → satisfied for *-voluntary;
# "pay the reasonable costs" → satisfied for *-injury-compensation.
BAD_RISKS = (
    "The study drug has been well tolerated in earlier studies, and most "
    "participants completed treatment without problems."
)
GOOD_RISKS = (
    "In earlier studies about 3 in 100 participants developed elevated liver "
    "enzymes; your liver function will be checked with a blood test at every "
    "visit, and rare serious allergic reactions (angioedema) have occurred."
)
GOOD_INJURY = (
    "If you are injured as a result of this study, medical care is available "
    "and the sponsor will pay the reasonable costs of treating "
    "research-related injuries."
)
GOOD_VOLUNTARY = (
    "Taking part in this study is completely voluntary; you may stop at any "
    "time without penalty or loss of benefits."
)


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


@pytest.fixture
async def review(client):
    protocol_id = await _ingest(client, "protocol.md", "protocol")
    icf_id = await _ingest(client, "icf-b.md", "icf")
    resp = await client.post(
        "/reviews",
        json={"document_id": icf_id, "protocol_document_id": protocol_id},
    )
    assert resp.status_code == 202, resp.text
    review_id = resp.json()["id"]
    final = (await client.get(f"/reviews/{review_id}")).json()
    assert final["status"] == "complete"
    return final


def _finding(review: dict, rule_id: str) -> dict:
    return next(f for f in review["findings"] if f["rule_id"] == rule_id)


async def _verify(client, finding_id: str, revised: str) -> dict:
    resp = await client.post(
        f"/v1/findings/{finding_id}/verify", json={"revised_text": revised}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_loop_rejected_then_verified(client, review):
    risks = _finding(review, "fda-50.25-a2-risks")
    assert risks["status"] == "conflicting"

    # attempt 1: the presenter's understated draft — REJECTED
    first = await _verify(client, risks["id"], BAD_RISKS)
    assert first["verdict"] == "rejected"
    assert first["status"] == "conflicting"
    assert first["attempt"] == 1
    assert first["requirement"]["citation"] == "21 CFR 50.25(a)(2)"
    assert first["reasoning"]

    # attempt 2: Claude's full-disclosure rewrite — VERIFIED, quote
    # grounded in the revision itself
    second = await _verify(client, risks["id"], GOOD_RISKS)
    assert second["verdict"] == "verified"
    assert second["status"] == "satisfied"
    assert second["attempt"] == 2
    quote = second["verified_quote"]
    assert quote is not None
    start, end = second["quote_char_start"], second["quote_char_end"]
    assert GOOD_RISKS[start:end] == quote  # byte-for-byte in the revision

    # the original review is immutable — the stored finding is untouched
    fresh = (await client.get(f"/reviews/{review['id']}")).json()
    assert _finding(fresh, "fda-50.25-a2-risks")["status"] == "conflicting"


async def test_submission_overlay_flips_to_ready(client, review):
    submission = (
        await client.get(f"/v1/reviews/{review['id']}/submission")
    ).json()
    assert submission["verdict"] == "Not ready — critical findings"
    assert submission["resolved_by_revision"] == []
    open_before = {a["rule_id"] for a in submission["remaining_actions"]}
    assert "fda-50.25-a2-risks" in open_before

    # verify every non-satisfied finding through the loop
    fixes = {
        "fda-50.25-a2-risks": GOOD_RISKS,
        "fda-50.25-a6-injury-compensation": GOOD_INJURY,
        "fda-50.25-a8-voluntary": GOOD_VOLUNTARY,
    }
    for rule_id, revision in fixes.items():
        result = await _verify(client, _finding(review, rule_id)["id"], revision)
        assert result["verdict"] == "verified", rule_id

    submission = (
        await client.get(f"/v1/reviews/{review['id']}/submission")
    ).json()
    assert submission["verdict"] == "Submission Ready"
    assert submission["coverage"]["percent"] == 100
    assert submission["remaining_actions"] == []
    resolved = {r["rule_id"] for r in submission["resolved_by_revision"]}
    assert resolved == set(fixes)
    # resolved rows are labeled explicitly — never silently upgraded
    labels = {row["rule_id"]: row["label"] for row in submission["coverage"]["rows"]}
    for rule_id in fixes:
        assert labels[rule_id] == "Resolved by Verified Revision"


async def test_rejected_attempts_never_resolve(client, review):
    risks = _finding(review, "fda-50.25-a2-risks")
    rejected = await _verify(client, risks["id"], BAD_RISKS)
    assert rejected["verdict"] == "rejected"

    submission = (
        await client.get(f"/v1/reviews/{review['id']}/submission")
    ).json()
    assert submission["resolved_by_revision"] == []
    assert submission["verdict"] == "Not ready — critical findings"

    # latest attempt wins: verified then re-rejected → back to unresolved
    await _verify(client, risks["id"], GOOD_RISKS)
    await _verify(client, risks["id"], BAD_RISKS)
    submission = (
        await client.get(f"/v1/reviews/{review['id']}/submission")
    ).json()
    assert submission["resolved_by_revision"] == []


async def test_verify_rejects_unknown_finding_and_short_text(client, review):
    resp = await client.post(
        "/v1/findings/00000000-0000-0000-0000-000000000000/verify",
        json={"revised_text": GOOD_RISKS},
    )
    assert resp.status_code == 404

    risks = _finding(review, "fda-50.25-a2-risks")
    resp = await client.post(
        f"/v1/findings/{risks['id']}/verify", json={"revised_text": "short"}
    )
    assert resp.status_code == 422

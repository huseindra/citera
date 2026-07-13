"""Answer-key acceptance tests for the HSA / BPOM / TGA packs (scripted
evaluator). Each jurisdiction's synthetic corpus plants the same defect
archetypes — an understated risk section (conflicting), an incomplete
injury/compensation promise (partial), and one missing required element
(not_found) — and everything else must come back satisfied.

Reviews are created directly on the engine (Review row + run_review),
bypassing the API status gate: the packs are in_development for users,
but the engine itself must behave identically for every jurisdiction.
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


async def _run_engine_review(
    client: httpx.AsyncClient, ruleset_id: str, icf_id: str, protocol_id: str
) -> dict:
    """Insert the Review row directly and run the orchestrator — the
    jurisdiction-agnostic path below the API's availability gate."""
    from uuid import UUID

    from citera_rulesets import load_ruleset

    from app.db import session_factory
    from app.models import Review
    from app.services.review import run_review

    pack = load_ruleset(ruleset_id)
    async with session_factory() as session:
        review = Review(
            document_id=UUID(icf_id),
            protocol_document_id=UUID(protocol_id),
            ruleset_id=pack.id,
            ruleset_version=pack.version,
            status="pending",
        )
        session.add(review)
        await session.commit()
        review_id = review.id

    await run_review(review_id)
    final = (await client.get(f"/reviews/{review_id}")).json()
    assert final["status"] == "complete"
    return final


ANSWER_KEYS = {
    "hsa-hpct2016": {
        "corpus": ("hsa-protocol.md", "hsa-icf.md"),
        "expected": {
            "hsa-r19-risks": "conflicting",
            "hsa-r19-injury-compensation": "partial",
            "hsa-r19-tissue": "not_found",
        },
    },
    "bpom-cukb": {
        "corpus": ("bpom-protocol.md", "bpom-icf.md"),
        "expected": {
            "bpom-4810-risks": "conflicting",
            "bpom-4810-injury-compensation": "partial",
            "bpom-ku17-insurance": "not_found",
            "bpom-4811-copy": "not_found",
        },
    },
    "tga-ns-ichgcp": {
        "corpus": ("tga-protocol.md", "tga-icf.md"),
        "expected": {
            "tga-risks": "conflicting",
            "tga-contacts-complaints": "partial",
            "tga-data-withdrawal": "not_found",
        },
    },
}


@pytest.mark.parametrize("ruleset_id", list(ANSWER_KEYS))
async def test_pack_reproduces_its_answer_key(client, ruleset_id):
    spec = ANSWER_KEYS[ruleset_id]
    protocol_name, icf_name = spec["corpus"]
    protocol_id = await _ingest(client, protocol_name, "protocol")
    icf_id = await _ingest(client, icf_name, "icf")

    review = await _run_engine_review(client, ruleset_id, icf_id, protocol_id)
    by_rule = {f["rule_id"]: f for f in review["findings"]}
    assert len(by_rule) == review["rule_count"]

    for rule_id, expected in spec["expected"].items():
        assert by_rule[rule_id]["status"] == expected, (
            rule_id,
            by_rule[rule_id]["status"],
            by_rule[rule_id]["reasoning"],
        )

    # evidence contract holds in every jurisdiction and language:
    # grounded statuses carry a verified span, absence carries queries
    for finding in review["findings"]:
        if finding["status"] in ("satisfied", "partial", "conflicting"):
            assert finding["verbatim_quote"], finding["rule_id"]
            assert finding["span"]["char_end"] > finding["span"]["char_start"]
        if finding["status"] == "not_found":
            assert finding["queries_executed"], finding["rule_id"]
            assert finding["span"] is None

    # everything not planted must be satisfied — no silent regressions
    others = set(by_rule) - set(spec["expected"])
    not_satisfied = [
        (r, by_rule[r]["status"]) for r in others if by_rule[r]["status"] != "satisfied"
    ]
    assert not not_satisfied, not_satisfied


async def test_bpom_review_content_is_in_bahasa_indonesia(client):
    """An Indonesian case must produce an Indonesian review: reasoning
    and AI-drafted revisions follow the pack's primary language (id for
    BPOM), never defaulting back to English."""
    protocol_id = await _ingest(client, "bpom-protocol.md", "protocol")
    icf_id = await _ingest(client, "bpom-icf.md", "icf")
    review = await _run_engine_review(client, "bpom-cukb", icf_id, protocol_id)

    assert review["findings"]
    for finding in review["findings"]:
        assert "[evaluator skrip]" in finding["reasoning"], finding["rule_id"]

    drafts = [
        f["suggested_revision"]
        for f in review["findings"]
        if f["suggested_revision"]
    ]
    assert drafts  # planted defects guarantee at least one draft
    assert all("[draf skrip]" in d for d in drafts)

    # the conflicting finding's protocol reference quotes the Indonesian
    # protocol (this was already localized; keep it that way)
    conflicting = next(
        f for f in review["findings"] if f["status"] == "conflicting"
    )
    assert "Protokol" in conflicting["protocol_reference"]


async def test_bpom_findings_ground_against_indonesian_text(client):
    """Span integrity in Bahasa Indonesia: every grounded quote must
    round-trip byte-for-byte against the canonical Indonesian text."""
    from sqlalchemy import select

    from app.db import session_factory
    from app.models import Document, Finding

    protocol_id = await _ingest(client, "bpom-protocol.md", "protocol")
    icf_id = await _ingest(client, "bpom-icf.md", "icf")
    review = await _run_engine_review(client, "bpom-cukb", icf_id, protocol_id)

    async with session_factory() as session:
        document = await session.get(Document, icf_id)
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

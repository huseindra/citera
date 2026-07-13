"""Review CRUD + the staged reviewer workflow (mocked LLM).

Covers the feedback items end-to-end: update/delete on reviews, orphan
recovery for the in-process background runner, sequential Review 1..N
stages with append-only determinations, and the Verified digital stamp —
every action leaving an append-only audit record.
"""

import socket
import uuid
from pathlib import Path

import citera_rulesets
import httpx
import pytest
from sqlalchemy import select, text

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


async def _run_review(client: httpx.AsyncClient, **overrides) -> dict:
    protocol_id = await _ingest(client, "protocol.md", "protocol")
    icf_id = await _ingest(client, "icf-b.md", "icf")
    resp = await client.post(
        "/reviews",
        json={
            "document_id": icf_id,
            "protocol_document_id": protocol_id,
            **overrides,
        },
    )
    assert resp.status_code == 202, resp.text
    # ASGITransport runs the background task before returning control
    final = (await client.get(f"/reviews/{resp.json()['id']}")).json()
    assert final["status"] == "complete"
    return final


async def _manual_review(status: str) -> str:
    """A bare review row in an arbitrary state — for guard tests that a
    real run (which always terminates) can't reach."""
    from app.db import session_factory
    from app.models import Document, Review

    async with session_factory() as session:
        doc = Document(
            filename="manual.md",
            kind="icf",
            content_hash="manual",
            canonical_text="manual",
            status="ready",
        )
        session.add(doc)
        await session.flush()
        review = Review(
            document_id=doc.id,
            ruleset_id="fda-21cfr50",
            ruleset_version="0.0",
            status=status,
        )
        session.add(review)
        await session.commit()
        return str(review.id)


async def _audit_steps(review_id: str) -> list[str]:
    from app.db import session_factory
    from app.models import AuditRecord

    async with session_factory() as session:
        return list(
            (
                await session.scalars(
                    select(AuditRecord.step).where(
                        AuditRecord.review_id == uuid.UUID(review_id)
                    )
                )
            ).all()
        )


# ---------------------------------------------------------------- CRUD


async def test_create_carries_title_and_required_stages(client):
    review = await _run_review(client, title="ONC-450 ICF v3", required_stages=2)
    assert review["title"] == "ONC-450 ICF v3"
    assert review["required_stages"] == 2

    listed = (await client.get("/reviews")).json()
    mine = next(r for r in listed if r["id"] == review["id"])
    assert mine["title"] == "ONC-450 ICF v3"
    assert mine["approved"] is False


async def test_update_review_metadata(client):
    review = await _run_review(client)
    resp = await client.patch(
        f"/reviews/{review['id']}",
        json={"title": "Renamed", "notes": "second-look pending"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["title"] == "Renamed"
    assert resp.json()["notes"] == "second-look pending"

    # findings and outcome untouched
    assert resp.json()["status"] == "complete"
    assert len(resp.json()["findings"]) == len(review["findings"])

    # empty patch is a 422, not a silent no-op
    assert (
        await client.patch(f"/reviews/{review['id']}", json={})
    ).status_code == 422

    assert "review.updated" in await _audit_steps(review["id"])


async def test_delete_review_keeps_audit_trail(client):
    from app.db import session_factory
    from app.models import Finding

    review = await _run_review(client)
    steps_before = await _audit_steps(review["id"])
    assert steps_before  # the pipeline wrote its trail

    resp = await client.delete(f"/reviews/{review['id']}")
    assert resp.status_code == 204
    assert (await client.get(f"/reviews/{review['id']}")).status_code == 404

    async with session_factory() as session:
        remaining = (
            await session.scalars(
                select(Finding).where(
                    Finding.review_id == uuid.UUID(review["id"])
                )
            )
        ).all()
    assert remaining == []  # cascade removed the findings

    steps_after = await _audit_steps(review["id"])
    assert "review.deleted" in steps_after
    assert len(steps_after) == len(steps_before) + 1  # nothing else lost

    # deleting twice is a 404, not an error 500
    assert (await client.delete(f"/reviews/{review['id']}")).status_code == 404


async def test_delete_blocked_while_running(client):
    review_id = await _manual_review("running")
    resp = await client.delete(f"/reviews/{review_id}")
    assert resp.status_code == 409
    assert "running" in resp.json()["detail"]


async def test_orphan_recovery_marks_stranded_reviews_failed(client):
    from app.db import session_factory
    from app.models import Review
    from app.services.review import recover_orphaned_reviews

    pending_id = await _manual_review("pending")
    running_id = await _manual_review("running")
    complete_id = await _manual_review("complete")

    recovered = await recover_orphaned_reviews()
    assert recovered >= 2

    async with session_factory() as session:
        for review_id, expected in (
            (pending_id, "failed"),
            (running_id, "failed"),
            (complete_id, "complete"),
        ):
            review = await session.get(Review, uuid.UUID(review_id))
            assert review.status == expected, review_id


# ------------------------------------------------------------ workflow


async def test_staged_workflow_to_verified_stamp(client):
    review = await _run_review(client, required_stages=3)
    rid = review["id"]
    findings = review["findings"]

    # empty workflow: no stages, no stamp
    wf = (await client.get(f"/reviews/{rid}/workflow")).json()
    assert wf["required_stages"] == 3
    assert wf["completed_stages"] == 0
    assert wf["stages"] == []
    assert wf["approval"] is None

    # the stamp is unreachable before the stages exist
    resp = await client.post(
        f"/reviews/{rid}/approval", json={"reviewer_name": "Dr. Sari"}
    )
    assert resp.status_code == 409
    assert "0 of 3" in resp.json()["detail"]

    # Review 1
    resp = await client.post(
        f"/reviews/{rid}/stages", json={"reviewer_name": ""}
    )
    assert resp.status_code == 422  # a stage needs an accountable reviewer
    resp = await client.post(
        f"/reviews/{rid}/stages", json={"reviewer_name": "Dr. Sari"}
    )
    assert resp.status_code == 201, resp.text
    stage1 = resp.json()["stages"][0]
    assert stage1["stage_number"] == 1
    assert stage1["status"] == "in_progress"

    # stages are sequential — no Review 2 while Review 1 is open
    resp = await client.post(
        f"/reviews/{rid}/stages", json={"reviewer_name": "Dr. Budi"}
    )
    assert resp.status_code == 409

    # concur on one finding
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage1['id']}/determinations",
        json={"finding_id": findings[0]["id"], "decision": "concur"},
    )
    assert resp.status_code == 201, resp.text

    # an override must say what changes
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage1['id']}/determinations",
        json={"finding_id": findings[1]["id"], "decision": "override"},
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage1['id']}/determinations",
        json={
            "finding_id": findings[1]["id"],
            "decision": "override",
            "edited_text": "Risks section must list cardiac events explicitly.",
            "comment": "AI missed the cardiology sub-study.",
        },
    )
    assert resp.status_code == 201, resp.text

    # changing your mind appends — history preserved, latest wins
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage1['id']}/determinations",
        json={"finding_id": findings[1]["id"], "decision": "concur"},
    )
    assert resp.status_code == 201
    dets = resp.json()["stages"][0]["determinations"]
    same_finding = [d for d in dets if d["finding_id"] == findings[1]["id"]]
    assert [d["decision"] for d in same_finding] == ["override", "concur"]
    assert all(d["reviewer_name"] == "Dr. Sari" for d in dets)
    assert all(d["rule_id"] for d in dets)

    # bogus finding: 404, decision typo: 422
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage1['id']}/determinations",
        json={"finding_id": str(uuid.uuid4()), "decision": "concur"},
    )
    assert resp.status_code == 404
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage1['id']}/determinations",
        json={"finding_id": findings[0]["id"], "decision": "approve"},
    )
    assert resp.status_code == 422

    # complete Review 1 — its determinations freeze
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage1['id']}/complete",
        json={"notes": "initial pass done"},
    )
    assert resp.status_code == 200, resp.text
    done = resp.json()["stages"][0]
    assert done["status"] == "completed"
    assert done["completed_at"] is not None
    assert done["notes"] == "initial pass done"
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage1['id']}/determinations",
        json={"finding_id": findings[0]["id"], "decision": "concur"},
    )
    assert resp.status_code == 409

    # Review 2 and Review 3
    for reviewer in ("Dr. Budi", "Dr. Ayu"):
        wf = (
            await client.post(
                f"/reviews/{rid}/stages", json={"reviewer_name": reviewer}
            )
        ).json()
        stage_id = wf["stages"][-1]["id"]
        resp = await client.post(
            f"/reviews/{rid}/stages/{stage_id}/complete", json={}
        )
        assert resp.status_code == 200

    # the digital stamp
    resp = await client.post(
        f"/reviews/{rid}/approval", json={"reviewer_name": "Dr. Ayu"}
    )
    assert resp.status_code == 201, resp.text
    wf = resp.json()
    assert wf["completed_stages"] == 3
    approval = wf["approval"]
    assert approval["reviewer_name"] == "Dr. Ayu"
    assert len(approval["content_hash"]) == 64  # sha256 of the report payload

    # verified list chip
    listed = (await client.get("/reviews")).json()
    assert next(r for r in listed if r["id"] == rid)["approved"] is True

    # the workflow is closed: no new stages, no second stamp, no deletion
    resp = await client.post(
        f"/reviews/{rid}/stages", json={"reviewer_name": "Dr. Sari"}
    )
    assert resp.status_code == 409
    assert "Verified" in resp.json()["detail"]
    resp = await client.post(
        f"/reviews/{rid}/approval", json={"reviewer_name": "Dr. Sari"}
    )
    assert resp.status_code == 409
    resp = await client.delete(f"/reviews/{rid}")
    assert resp.status_code == 409
    assert "Verified" in resp.json()["detail"]

    # every workflow action left its append-only record
    steps = await _audit_steps(rid)
    assert steps.count("workflow.stage.started") == 3
    assert steps.count("workflow.determination") == 3
    assert steps.count("workflow.stage.completed") == 3
    assert steps.count("review.approved") == 1


async def test_reviewer_adds_manual_finding(client):
    """A finding the engine missed: a NEW reviewer-sourced row, never a
    mutation — and its quote must still pass the grounding gate."""
    review = await _run_review(client, required_stages=1)
    rid = review["id"]
    wf = (
        await client.post(
            f"/reviews/{rid}/stages", json={"reviewer_name": "Dr. Sari"}
        )
    ).json()
    stage_id = wf["stages"][0]["id"]
    findings_url = f"/reviews/{rid}/stages/{stage_id}/findings"

    # unknown rule and unknown status are rejected
    resp = await client.post(
        findings_url,
        json={"rule_id": "not-a-rule", "status": "partial", "reasoning": "x"},
    )
    assert resp.status_code == 422
    some_rule = review["findings"][0]["rule_id"]
    resp = await client.post(
        findings_url,
        json={"rule_id": some_rule, "status": "evaluation_failed", "reasoning": "x"},
    )
    assert resp.status_code == 422

    # an ungroundable quote can never enter the record
    resp = await client.post(
        findings_url,
        json={
            "rule_id": some_rule,
            "status": "conflicting",
            "reasoning": "Reviewer claim with fabricated evidence.",
            "verbatim_quote": "This exact sentence appears nowhere in the ICF.",
        },
    )
    assert resp.status_code == 422
    assert "ground" in resp.json()["detail"]

    # a verbatim slice of the reviewed document grounds and persists
    satisfied_rule = next(
        f["rule_id"] for f in review["findings"] if f["status"] == "satisfied"
    )
    text = (
        await client.get(f"/documents/{review['document_id']}/text")
    ).json()["canonical_text"]
    quote = text[200:320]
    resp = await client.post(
        findings_url,
        json={
            "rule_id": satisfied_rule,
            "status": "partial",
            "reasoning": "The engine overlooked a qualifier in this passage.",
            "verbatim_quote": quote,
        },
    )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created["source"] == "reviewer"
    assert created["reviewer_name"] == "Dr. Sari"
    assert created["char_end"] > created["char_start"]

    # visible in the review, labeled as the reviewer's
    detail = (await client.get(f"/reviews/{rid}")).json()
    manual = [f for f in detail["findings"] if f["source"] == "reviewer"]
    assert len(manual) == 1
    assert manual[0]["reviewer_name"] == "Dr. Sari"
    # grounding may trim surrounding whitespace; the stored quote is the
    # exact grounded slice and must round-trip against the document
    assert manual[0]["verbatim_quote"] == quote.strip()
    assert manual[0]["verbatim_quote"] in text
    assert all(
        f["reviewer_name"] is None
        for f in detail["findings"]
        if f["source"] == "engine"
    )

    # readiness: the latest finding per rule wins — the reviewer's partial
    # supersedes the engine's satisfied without rewriting it
    report = (await client.get(f"/reviews/{rid}/report")).json()
    row = next(
        r for r in report["coverage"]["rows"] if r["rule_id"] == satisfied_rule
    )
    assert row["status"] == "partial"

    assert "workflow.finding.added" in await _audit_steps(rid)

    # a completed stage takes no more findings
    resp = await client.post(
        f"/reviews/{rid}/stages/{stage_id}/complete", json={}
    )
    assert resp.status_code == 200
    resp = await client.post(
        findings_url,
        json={"rule_id": some_rule, "status": "partial", "reasoning": "late"},
    )
    assert resp.status_code == 409


async def test_delete_document_guards_review_history(client):
    # a document no review uses: freely deletable, audit trail retained
    content = f"# Disposable {uuid.uuid4()}\n\nA throwaway paragraph.".encode()
    resp = await client.post(
        "/documents",
        files={"file": ("temp.md", content, "text/markdown")},
        data={"kind": "other"},
    )
    doc_id = resp.json()["id"]
    assert (await client.get(f"/documents/{doc_id}")).json()["status"] == "ready"
    assert (await client.delete(f"/documents/{doc_id}")).status_code == 204
    assert (await client.get(f"/documents/{doc_id}")).status_code == 404

    # documents referenced by reviews are protected — both roles
    review = await _run_review(client)
    for used in (review["document_id"], review["protocol_document_id"]):
        resp = await client.delete(f"/documents/{used}")
        assert resp.status_code == 409
        assert "review" in resp.json()["detail"]


async def test_workflow_requires_completed_review(client):
    review_id = await _manual_review("running")
    resp = await client.post(
        f"/reviews/{review_id}/stages", json={"reviewer_name": "Dr. Sari"}
    )
    assert resp.status_code == 409
    assert "running" in resp.json()["detail"]

    # reading the (empty) workflow is fine at any status
    resp = await client.get(f"/reviews/{review_id}/workflow")
    assert resp.status_code == 200
    assert resp.json()["stages"] == []

    missing = uuid.uuid4()
    assert (await client.get(f"/reviews/{missing}/workflow")).status_code == 404

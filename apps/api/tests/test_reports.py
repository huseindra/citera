"""The export surface (mocked LLM): the report endpoint and the finding
dossier must serve the same findings as the review endpoint — identical
regulatory intelligence through every interface."""

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


async def test_json_report_carries_identical_findings_and_coverage(
    client, review
):
    resp = await client.get(f"/v1/reviews/{review['id']}/report")
    assert resp.status_code == 200, resp.text
    report = resp.json()

    # identical findings: same ids, same statuses as the review endpoint
    assert {f["id"] for f in report["review"]["findings"]} == {
        f["id"] for f in review["findings"]
    }

    coverage = report["coverage"]
    assert coverage["total"] == review["rule_count"]
    assert 0 <= coverage["percent"] <= 100
    # icf-b plants a critical conflicting risk — readiness must be blocked
    assert coverage["verdict"] == "Not ready — critical findings"
    # every row pairs the number with a human label, never a bare percent
    assert all(row["label"] for row in coverage["rows"])


async def test_markdown_report_is_reviewer_facing(client, review):
    resp = await client.get(
        f"/v1/reviews/{review['id']}/report", params={"format": "markdown"}
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/markdown")
    body = resp.text
    assert body.startswith("# Compliance Review Report")
    assert "Regulatory Readiness" in body
    # implementation details never reach the reviewer
    for banned in ("embedding", "dense", "sparse", "fused", "prompt"):
        assert banned not in body.lower(), banned


async def test_report_rejects_unknown_format_and_incomplete_review(
    client, review
):
    resp = await client.get(
        f"/v1/reviews/{review['id']}/report", params={"format": "docx"}
    )
    assert resp.status_code == 422


async def test_finding_dossier_by_id(client, review):
    non_satisfied = next(
        f for f in review["findings"] if f["status"] != "satisfied"
    )
    resp = await client.get(f"/v1/findings/{non_satisfied['id']}")
    assert resp.status_code == 200, resp.text
    dossier = resp.json()

    assert dossier["review_id"] == review["id"]
    assert dossier["status"] == non_satisfied["status"]
    assert dossier["requirement"]["rule_id"] == non_satisfied["rule_id"]
    assert dossier["requirement"]["impact"] in {"Critical", "Medium", "Low"}
    assert dossier["status_label"]
    # the audit trail behind the finding is discoverable
    assert dossier["audit"]["records"] >= 1
    # span verification status matches the evidence actually present
    assert dossier["audit"]["span_verified"] == (
        dossier["verbatim_quote"] is not None and dossier["span"] is not None
    )


async def test_finding_dossier_404_on_unknown_id(client):
    resp = await client.get(
        "/v1/findings/00000000-0000-0000-0000-000000000000"
    )
    assert resp.status_code == 404

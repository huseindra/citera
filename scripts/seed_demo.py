#!/usr/bin/env python
"""One-command demo state: reset the database, ingest the demo corpus,
run both reviews, verify the answer key, print the URLs.

    make seed        (or: uv run python scripts/seed_demo.py)

Requires the dev postgres (docker compose up -d). Safe to run twice —
every run starts from a fresh schema. With no ANTHROPIC_API_KEY the
scripted evaluator reproduces the answer key deterministically; with a
key, real Claude runs and the answer key is checked as a warning only.
"""

import asyncio
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

ANSWER_KEY = {
    "fda-50.25-a2-risks": "conflicting",
    "fda-50.25-a6-injury-compensation": "partial",
    "fda-50.25-a8-voluntary": "not_found",
}
CORPUS = ROOT / "packages" / "rulesets" / "demo-corpus"


async def main() -> int:
    from citera_pipeline.ingest import extract
    from citera_rulesets import load_ruleset
    from citera_schemas import AuditStep
    from sqlalchemy import select, text

    from app.db import Base, engine, session_factory
    from app.models import AuditRecord, Document, Finding, Review
    from app.services.ingestion import run_chunking
    from app.services.llm import get_evaluator
    from app.services.review import run_review

    print("→ resetting schema")
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    documents: dict[str, object] = {}
    for name, kind in [
        ("protocol.md", "protocol"),
        ("icf-a.md", "icf"),
        ("icf-b.md", "icf"),
    ]:
        data = (CORPUS / name).read_bytes()
        extraction = extract(name, data)
        async with session_factory() as session:
            document = Document(
                filename=name,
                kind=kind,
                content_hash=hashlib.sha256(data).hexdigest(),
                canonical_text=extraction.canonical_text,
                page_map=None,
                status="processing",
            )
            session.add(document)
            await session.flush()
            session.add(
                AuditRecord(
                    step=AuditStep.INGEST_EXTRACT,
                    document_id=document.id,
                    payload={
                        "filename": name,
                        "kind": kind,
                        "bytes": len(data),
                        "content_hash": document.content_hash,
                        "pages": None,
                        "seeded": True,
                    },
                )
            )
            await session.commit()
            documents[name] = document.id
        await run_chunking(documents[name])
        print(f"→ ingested {name}")

    evaluator = get_evaluator()
    scripted = evaluator.model == "scripted-demo"
    print(f"→ evaluator: {evaluator.model}")

    ruleset = load_ruleset("fda-21cfr50")
    review_ids: dict[str, object] = {}
    failures: list[str] = []

    for icf in ("icf-a.md", "icf-b.md"):
        async with session_factory() as session:
            review = Review(
                document_id=documents[icf],
                protocol_document_id=documents["protocol.md"],
                ruleset_id=ruleset.id,
                ruleset_version=ruleset.version,
                status="pending",
            )
            session.add(review)
            await session.commit()
            review_ids[icf] = review.id
        await run_review(review_ids[icf])

        async with session_factory() as session:
            findings = (
                await session.scalars(
                    select(Finding).where(Finding.review_id == review_ids[icf])
                )
            ).all()
        by_rule = {f.rule_id: f.status for f in findings}
        expected = ANSWER_KEY if icf == "icf-b.md" else {}
        marks = []
        for rule in ruleset.rules:
            want = expected.get(rule.id, "satisfied")
            got = by_rule.get(rule.id, "missing")
            ok = got == want
            if not ok:
                failures.append(f"{icf} {rule.id}: expected {want}, got {got}")
            marks.append("✓" if ok else "✗")
        print(f"→ reviewed {icf}: {' '.join(marks)}")

    await engine.dispose()

    print()
    print("Demo state ready:")
    print(f"  clean   http://localhost:5173/reviews/{review_ids['icf-a.md']}")
    print(f"  defects http://localhost:5173/reviews/{review_ids['icf-b.md']}")

    if failures:
        for failure in failures:
            print(f"  ⚠ {failure}")
        if scripted:
            print("ANSWER KEY MISMATCH with the deterministic evaluator — this is a bug.")
            return 1
        print("(live Claude run — review the mismatches above before demoing)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

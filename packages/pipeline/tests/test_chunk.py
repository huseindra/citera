from pathlib import Path
from uuid import uuid4

import citera_rulesets
import pytest
from citera_pipeline.ingest import MAX_CHUNK_CHARS, chunk_document

# demo corpus lives next to the rulesets package (editable install)
CORPUS = Path(citera_rulesets.__file__).parents[2] / "demo-corpus"


@pytest.mark.parametrize("name", ["protocol.md", "icf-a.md", "icf-b.md"])
def test_keystone_span_roundtrip_on_demo_corpus(name):
    """THE invariant: slicing canonical text by a chunk's span reproduces
    the chunk text exactly. Heatmap and grounding both depend on this."""
    text = (CORPUS / name).read_text()
    chunks = chunk_document(text, uuid4())
    assert chunks
    for chunk in chunks:
        assert text[chunk.span.char_start : chunk.span.char_end] == chunk.text
        assert chunk.text == chunk.text.strip()
        assert len(chunk.text) <= MAX_CHUNK_CHARS
        assert chunk.content_hash


def test_demo_corpus_sections_detected():
    text = (CORPUS / "icf-b.md").read_text()
    titles = {c.section_title for c in chunk_document(text, uuid4())}
    assert any("risks and discomforts" in (t or "").lower() for t in titles)
    assert any("confidential" in (t or "").lower() for t in titles)


def test_markdown_headings_suppress_numbered_list_false_positives():
    text = "# Real Section\n\nSteps:\n\n1. first step\n\n2. second step\n"
    chunks = chunk_document(text, uuid4())
    assert {c.section_title for c in chunks} == {"Real Section"}


def test_fallback_headings_without_markdown():
    text = (
        "STUDY PURPOSE\n\nThis study tests a drug.\n\n"
        "2. RISKS\n\nThere are risks.\n"
    )
    titles = [c.section_title for c in chunk_document(text, uuid4())]
    assert "STUDY PURPOSE" in titles
    assert "2. RISKS" in titles


def test_document_without_headings_still_chunks():
    text = "para one\n\npara two\n\npara three"
    chunks = chunk_document(text, uuid4())
    assert chunks
    assert all(c.section_title is None for c in chunks)


def test_oversized_section_splits_within_budget():
    sentence = "This sentence is repeated to exceed the chunk budget. "
    text = "# Long Section\n\n" + sentence * 120  # ~6600 chars, one paragraph
    chunks = chunk_document(text, uuid4())
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk.text) <= MAX_CHUNK_CHARS
        assert text[chunk.span.char_start : chunk.span.char_end] == chunk.text


def test_empty_text_returns_no_chunks():
    assert chunk_document("", uuid4()) == []

"""Section-aware chunking with exact evidence spans.

Invariant (the keystone of the whole system):
    canonical_text[chunk.span.char_start : chunk.span.char_end] == chunk.text
Chunk text is only ever produced by slicing the canonical text — trimming
moves offsets instead of editing text — so the invariant holds by
construction and is enforced by a property test.
"""

import hashlib
import re
from uuid import UUID, uuid4

from citera_schemas import Chunk, EvidenceSpan

from citera_pipeline.ingest.extract import PageRange

MAX_CHUNK_CHARS = 2000  # ~500 tokens; character budget avoids a tokenizer dep

_MD_HEADING = re.compile(r"^#{1,6}\s+\S")
_NUM_HEADING = re.compile(r"^\d+(\.\d+)*[.)]?\s+\S")
_PARAGRAPH_BREAK = re.compile(r"\n[ \t]*\n")
_SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+")


def chunk_document(
    canonical_text: str,
    document_id: UUID,
    page_map: list[PageRange] | None = None,
) -> list[Chunk]:
    sections = _split_sections(canonical_text)
    chunks: list[Chunk] = []
    for title, sec_start, sec_end in sections:
        for start, end in _pack_units(canonical_text, sec_start, sec_end):
            start, end = _trim(canonical_text, start, end)
            if start >= end:
                continue
            text = canonical_text[start:end]
            chunks.append(
                Chunk(
                    id=uuid4(),
                    document_id=document_id,
                    text=text,
                    span=EvidenceSpan(
                        document_id=document_id,
                        page=_page_of(start, page_map),
                        char_start=start,
                        char_end=end,
                    ),
                    section_title=title,
                    content_hash=hashlib.sha256(text.encode()).hexdigest(),
                )
            )
    return chunks


def _split_sections(text: str) -> list[tuple[str | None, int, int]]:
    """Split at heading lines → (title, start, end). The heading line itself
    belongs to its section, so retrieval sees titles in chunk text."""
    headings = _find_headings(text)
    if not headings:
        return [(None, 0, len(text))] if text else []

    sections: list[tuple[str | None, int, int]] = []
    if headings[0][0] > 0:  # preamble before the first heading
        sections.append((None, 0, headings[0][0]))
    for i, (offset, title) in enumerate(headings):
        end = headings[i + 1][0] if i + 1 < len(headings) else len(text)
        sections.append((title, offset, end))
    return sections


def _find_headings(text: str) -> list[tuple[int, str]]:
    """Markdown headings when present are authoritative; the numbered /
    ALL-CAPS fallback only applies to documents without any markdown
    headings (it false-positives on ordered lists otherwise)."""
    markdown: list[tuple[int, str]] = []
    fallback: list[tuple[int, str]] = []
    offset = 0
    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        if _MD_HEADING.match(stripped):
            markdown.append((offset, stripped.lstrip("#").strip()))
        elif stripped and len(stripped) < 80:
            letters = [c for c in stripped if c.isalpha()]
            if _NUM_HEADING.match(stripped) and not stripped.endswith("."):
                fallback.append((offset, stripped))
            elif len(letters) >= 4 and all(c.isupper() for c in letters):
                fallback.append((offset, stripped))
        offset += len(line)
    return markdown or fallback


def _pack_units(text: str, start: int, end: int) -> list[tuple[int, int]]:
    """Greedily pack paragraphs into chunks within budget; oversized
    paragraphs recurse into sentences, oversized sentences hard-split."""
    units = _paragraph_spans(text, start, end)
    packed: list[tuple[int, int]] = []
    run_start: int | None = None
    run_end = 0

    for u_start, u_end in units:
        if u_end - u_start > MAX_CHUNK_CHARS:
            if run_start is not None:
                packed.append((run_start, run_end))
                run_start = None
            packed.extend(_split_oversized(text, u_start, u_end))
            continue
        if run_start is None:
            run_start, run_end = u_start, u_end
        elif u_end - run_start <= MAX_CHUNK_CHARS:
            run_end = u_end
        else:
            packed.append((run_start, run_end))
            run_start, run_end = u_start, u_end
    if run_start is not None:
        packed.append((run_start, run_end))
    return packed


def _paragraph_spans(text: str, start: int, end: int) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    cursor = start
    for match in _PARAGRAPH_BREAK.finditer(text, start, end):
        spans.append((cursor, match.start()))
        cursor = match.end()
    spans.append((cursor, end))
    return [(s, e) for s, e in spans if text[s:e].strip()]


def _split_oversized(text: str, start: int, end: int) -> list[tuple[int, int]]:
    boundaries = [start]
    for match in _SENTENCE_BREAK.finditer(text, start, end):
        boundaries.append(match.end())
    boundaries.append(end)

    pieces: list[tuple[int, int]] = []
    run_start = boundaries[0]
    for i in range(1, len(boundaries)):
        seg_start, seg_end = boundaries[i - 1], boundaries[i]
        while seg_end - seg_start > MAX_CHUNK_CHARS:  # pathological: one giant sentence
            pieces.append((seg_start, seg_start + MAX_CHUNK_CHARS))
            seg_start += MAX_CHUNK_CHARS
            run_start = seg_start
        if seg_end - run_start > MAX_CHUNK_CHARS:
            pieces.append((run_start, seg_start))
            run_start = seg_start
    if run_start < end:
        pieces.append((run_start, end))
    return [(s, e) for s, e in pieces if s < e]


def _trim(text: str, start: int, end: int) -> tuple[int, int]:
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def _page_of(offset: int, page_map: list[PageRange] | None) -> int | None:
    if not page_map:
        return None
    for page in page_map:
        if page.char_start <= offset < page.char_end:
            return page.page
    return page_map[-1].page

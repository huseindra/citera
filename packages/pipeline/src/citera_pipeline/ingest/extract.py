"""Text extraction to canonical text.

The canonical text is stored once at ingestion and is the single reference
all evidence spans index into, forever. Markdown/plain text is the demo
path (canonical text == file content); PDF is a secondary path.
"""

import io
from dataclasses import dataclass
from pathlib import Path

MAX_BYTES = 20 * 1024 * 1024
_TEXT_SUFFIXES = {".md", ".markdown", ".txt"}
_PAGE_SEPARATOR = "\n\n"


class ExtractionError(Exception):
    pass


class UnsupportedFileTypeError(ExtractionError):
    pass


class EmptyDocumentError(ExtractionError):
    pass


class FileTooLargeError(ExtractionError):
    pass


@dataclass(frozen=True)
class PageRange:
    page: int
    char_start: int
    char_end: int


@dataclass(frozen=True)
class ExtractionResult:
    canonical_text: str
    # None for text formats that have no page concept.
    page_map: list[PageRange] | None


def extract(filename: str, data: bytes) -> ExtractionResult:
    if len(data) > MAX_BYTES:
        raise FileTooLargeError(
            f"File exceeds {MAX_BYTES // (1024 * 1024)} MB limit"
        )

    suffix = Path(filename).suffix.lower()
    if suffix in _TEXT_SUFFIXES:
        result = ExtractionResult(
            canonical_text=data.decode("utf-8", errors="replace"), page_map=None
        )
    elif suffix == ".pdf":
        result = _extract_pdf(data)
    elif suffix == ".docx":
        result = _extract_docx(data)
    else:
        raise UnsupportedFileTypeError(
            f"Unsupported file type '{suffix or filename}'; "
            f"accepted: {sorted(_TEXT_SUFFIXES)}, .pdf and .docx"
        )

    if not result.canonical_text.strip():
        raise EmptyDocumentError("Document contains no extractable text")
    return result


def _extract_docx(data: bytes) -> ExtractionResult:
    import zipfile

    import docx  # heavy import, only paid on the DOCX path
    from docx.opc.exceptions import PackageNotFoundError

    try:
        document = docx.Document(io.BytesIO(data))
    except (PackageNotFoundError, zipfile.BadZipFile, ValueError, KeyError) as exc:
        raise ExtractionError(f"Could not read .docx file: {exc}") from exc

    # Headings become markdown-style so the section-aware chunker (and the
    # viewer's line styling) treat DOCX and markdown identically.
    parts: list[str] = []
    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        style = (paragraph.style.name or "").lower()
        if style.startswith("heading"):
            level = 2
            digits = "".join(ch for ch in style if ch.isdigit())
            if digits:
                level = min(3, max(1, int(digits)))
            parts.append(f"{'#' * level} {text}")
        else:
            parts.append(text)
    return ExtractionResult(canonical_text="\n\n".join(parts), page_map=None)


def _extract_pdf(data: bytes) -> ExtractionResult:
    import pdfplumber  # heavy import, only paid on the PDF path

    parts: list[str] = []
    pages: list[PageRange] = []
    cursor = 0
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            start = cursor
            parts.append(text)
            cursor += len(text)
            pages.append(PageRange(page=number, char_start=start, char_end=cursor))
            parts.append(_PAGE_SEPARATOR)
            cursor += len(_PAGE_SEPARATOR)
    return ExtractionResult(canonical_text="".join(parts), page_map=pages)

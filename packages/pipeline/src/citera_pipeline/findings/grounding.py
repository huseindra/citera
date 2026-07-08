"""Span-grounding gate: a quote either locates verbatim in the canonical
text or the finding is rejected. This is the hard backstop against both
hallucinated evidence and prompt injection — no exceptions, even in demos.

Matching strategy: exact first, then normalized (unicode quotes/dashes
unified, whitespace runs collapsed) with an index map back to original
offsets. Multiple occurrences resolve to the one nearest the cited
chunk's position.
"""

from dataclasses import dataclass

MIN_QUOTE_CHARS = 10

_TRANSLATE = {
    "‘": "'",
    "’": "'",
    "“": '"',
    "”": '"',
    "–": "-",
    "—": "-",
    " ": " ",
}


@dataclass(frozen=True)
class GroundingResult:
    char_start: int | None
    char_end: int | None
    method: str | None  # "exact" | "normalized"
    reason: str | None  # populated when rejected

    @property
    def ok(self) -> bool:
        return self.char_start is not None


def ground_quote(
    quote: str | None,
    canonical_text: str,
    hint_offset: int | None = None,
) -> GroundingResult:
    if not quote or len(quote.strip()) < MIN_QUOTE_CHARS:
        return _rejected(f"quote missing or shorter than {MIN_QUOTE_CHARS} characters")
    if "..." in quote or "…" in quote:
        return _rejected("quote contains an ellipsis; only contiguous quotes ground")

    quote = quote.strip()

    # 1) exact match
    occurrences = _find_all(canonical_text, quote)
    if occurrences:
        start = _nearest(occurrences, hint_offset)
        return GroundingResult(start, start + len(quote), "exact", None)

    # 2) normalized match, mapped back to original offsets
    norm_text, index_map = _normalize(canonical_text)
    norm_quote, _ = _normalize(quote)
    if len(norm_quote) >= MIN_QUOTE_CHARS:
        occurrences = _find_all(norm_text, norm_quote)
        if occurrences:
            n_start = _nearest(occurrences, _map_hint(hint_offset, index_map))
            start = index_map[n_start]
            end = index_map[n_start + len(norm_quote) - 1] + 1
            return GroundingResult(start, end, "normalized", None)

    return _rejected("quote not found in document (exact or normalized)")


def _rejected(reason: str) -> GroundingResult:
    return GroundingResult(None, None, None, reason)


def _find_all(text: str, needle: str) -> list[int]:
    found: list[int] = []
    idx = text.find(needle)
    while idx != -1:
        found.append(idx)
        idx = text.find(needle, idx + 1)
    return found


def _nearest(occurrences: list[int], hint: int | None) -> int:
    if hint is None or len(occurrences) == 1:
        return occurrences[0]
    return min(occurrences, key=lambda pos: abs(pos - hint))


def _normalize(text: str) -> tuple[str, list[int]]:
    """Collapse whitespace runs and unify punctuation variants, keeping a
    map from every normalized character back to its original offset."""
    chars: list[str] = []
    index_map: list[int] = []
    prev_space = False
    for i, ch in enumerate(text):
        ch = _TRANSLATE.get(ch, ch)
        if ch.isspace():
            if prev_space:
                continue
            ch = " "
            prev_space = True
        else:
            prev_space = False
        chars.append(ch)
        index_map.append(i)
    return "".join(chars), index_map


def _map_hint(hint: int | None, index_map: list[int]) -> int | None:
    """Translate an original-text hint offset into normalized-text space."""
    if hint is None or not index_map:
        return None
    # index_map is sorted; binary search would be overkill at these sizes
    for n_idx, orig in enumerate(index_map):
        if orig >= hint:
            return n_idx
    return len(index_map) - 1

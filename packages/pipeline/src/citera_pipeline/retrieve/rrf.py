"""Reciprocal Rank Fusion — pure function, no I/O.

Fuses any number of ranked lists (dense and sparse, one pair per query).
A chunk's fused score is the sum of 1/(k + rank) over every list it
appears in. Scores from lists a chunk did NOT appear in stay None —
absence and zero relevance are different facts.
"""

from dataclasses import dataclass, field
from uuid import UUID

DEFAULT_K = 60
DEFAULT_TOP_N = 8


@dataclass
class FusedChunk:
    chunk_id: UUID
    fused_score: float = 0.0
    # best raw score seen across query lists; None if never retrieved that way
    dense_score: float | None = None
    sparse_score: float | None = None
    rank: int = 0
    _appearances: int = field(default=0, repr=False)


def fuse(
    dense_lists: list[list[tuple[UUID, float]]],
    sparse_lists: list[list[tuple[UUID, float]]],
    *,
    k: int = DEFAULT_K,
    top_n: int = DEFAULT_TOP_N,
) -> list[FusedChunk]:
    fused: dict[UUID, FusedChunk] = {}

    def _accumulate(ranked: list[tuple[UUID, float]], kind: str) -> None:
        for position, (chunk_id, score) in enumerate(ranked, start=1):
            entry = fused.setdefault(chunk_id, FusedChunk(chunk_id=chunk_id))
            entry.fused_score += 1.0 / (k + position)
            entry._appearances += 1
            current = getattr(entry, f"{kind}_score")
            if current is None or score > current:
                setattr(entry, f"{kind}_score", score)

    for ranked in dense_lists:
        _accumulate(ranked, "dense")
    for ranked in sparse_lists:
        _accumulate(ranked, "sparse")

    # ties broken by chunk id for stable, reproducible ordering
    ordered = sorted(fused.values(), key=lambda f: (-f.fused_score, str(f.chunk_id)))
    top = ordered[:top_n]
    for position, entry in enumerate(top, start=1):
        entry.rank = position
    return top

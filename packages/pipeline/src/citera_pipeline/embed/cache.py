"""In-process embedding cache.

Rule retrieval queries are static strings — re-embedding them on every
review wastes rate-limited API calls (the failure mode that surfaced on
Voyage's free tier). Caches per (input_type, text); misses are embedded
in a single batched call to the inner embedder.
"""

from collections import OrderedDict

from citera_pipeline.embed.base import Embedder, InputType


class CachingEmbedder:
    def __init__(self, inner: Embedder, max_entries: int = 4096):
        self._inner = inner
        self._cache: OrderedDict[tuple[str, str], list[float]] = OrderedDict()
        self._max_entries = max_entries

    @property
    def model(self) -> str:
        return self._inner.model

    @property
    def version(self) -> str:
        return self._inner.version

    @property
    def dim(self) -> int:
        return self._inner.dim

    async def embed(
        self, texts: list[str], *, input_type: InputType = "document"
    ) -> list[list[float]]:
        misses = [t for t in texts if (input_type, t) not in self._cache]
        # dedupe misses, preserve order
        unique_misses = list(dict.fromkeys(misses))
        if unique_misses:
            vectors = await self._inner.embed(unique_misses, input_type=input_type)
            for text, vector in zip(unique_misses, vectors):
                self._cache[(input_type, text)] = vector
                self._cache.move_to_end((input_type, text))
            while len(self._cache) > self._max_entries:
                self._cache.popitem(last=False)
        return [self._cache[(input_type, t)] for t in texts]

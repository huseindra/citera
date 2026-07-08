"""Deterministic offline embedder for tests and keyless development.

Not random vectors: tokens are hashed into dimensions (bag-of-words),
so cosine similarity correlates with token overlap. Retrieval tests
behave sensibly without any ML dependency or network call.
"""

import hashlib
import math
import re

from citera_pipeline.embed.base import InputType

_TOKEN = re.compile(r"[a-z0-9]+")


class FakeEmbedder:
    model = "fake-bow"
    version = "1"

    def __init__(self, dim: int = 1024):
        self.dim = dim

    async def embed(
        self, texts: list[str], *, input_type: InputType = "document"
    ) -> list[list[float]]:
        return [self._embed_one(t) for t in texts]

    def _embed_one(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for token in _TOKEN.findall(text.lower()):
            digest = hashlib.sha256(token.encode()).digest()
            index = int.from_bytes(digest[:4], "big") % self.dim
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vec[index] += sign
        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0.0:
            vec[0] = 1.0  # degenerate input: stable unit vector
            return vec
        return [v / norm for v in vec]

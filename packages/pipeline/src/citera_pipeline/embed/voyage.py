"""Voyage AI embeddings over REST (no SDK dependency)."""

import asyncio

import httpx

from citera_pipeline.embed.base import InputType

_API_URL = "https://api.voyageai.com/v1/embeddings"
_BATCH_SIZE = 96
_MAX_ATTEMPTS = 3  # 1 call + 2 retries, per implementation plan


class EmbeddingError(Exception):
    pass


class VoyageEmbedder:
    version = "1"

    def __init__(self, api_key: str, model: str = "voyage-3.5-lite", dim: int = 1024):
        self.model = model
        self.dim = dim
        self._api_key = api_key

    async def embed(
        self, texts: list[str], *, input_type: InputType = "document"
    ) -> list[list[float]]:
        vectors: list[list[float]] = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for start in range(0, len(texts), _BATCH_SIZE):
                batch = texts[start : start + _BATCH_SIZE]
                vectors.extend(await self._embed_batch(client, batch, input_type))
        return vectors

    async def _embed_batch(
        self, client: httpx.AsyncClient, batch: list[str], input_type: InputType
    ) -> list[list[float]]:
        last_error: Exception | None = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                resp = await client.post(
                    _API_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={
                        "input": batch,
                        "model": self.model,
                        "input_type": input_type,
                        "output_dimension": self.dim,
                    },
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                return [item["embedding"] for item in data]
            except (httpx.HTTPError, KeyError) as exc:
                last_error = exc
                if attempt < _MAX_ATTEMPTS - 1:
                    await asyncio.sleep(1.5 * (attempt + 1))
        raise EmbeddingError(
            f"Voyage embedding failed after {_MAX_ATTEMPTS} attempts: {last_error}"
        ) from last_error

"""Voyage AI embeddings over REST (no SDK dependency)."""

import asyncio

import httpx

from citera_pipeline.embed.base import InputType

_API_URL = "https://api.voyageai.com/v1/embeddings"
_BATCH_SIZE = 96
_MAX_ATTEMPTS = 3  # 1 call + 2 retries for generic failures
# 429s get patient, Retry-After-aware backoff — free-tier Voyage allows
# only a few requests per minute
_MAX_RATE_LIMIT_ATTEMPTS = 7
_MAX_BACKOFF_SECONDS = 45.0


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
        generic_attempts = 0
        rate_limit_attempts = 0
        while (
            generic_attempts < _MAX_ATTEMPTS
            and rate_limit_attempts < _MAX_RATE_LIMIT_ATTEMPTS
        ):
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
            except httpx.HTTPStatusError as exc:
                last_error = exc
                if exc.response.status_code == 429:
                    rate_limit_attempts += 1
                    await asyncio.sleep(
                        _retry_after_seconds(exc.response, rate_limit_attempts)
                    )
                else:
                    generic_attempts += 1
                    await asyncio.sleep(1.5 * generic_attempts)
            except (httpx.HTTPError, KeyError) as exc:
                last_error = exc
                generic_attempts += 1
                await asyncio.sleep(1.5 * generic_attempts)
        raise EmbeddingError(
            f"Voyage embedding failed (generic={generic_attempts}, "
            f"rate_limited={rate_limit_attempts}): {last_error}"
        ) from last_error


def _retry_after_seconds(response: httpx.Response, attempt: int) -> float:
    header = response.headers.get("retry-after")
    if header:
        try:
            return min(float(header), _MAX_BACKOFF_SECONDS)
        except ValueError:
            pass
    return min(2.0 * (2 ** (attempt - 1)), _MAX_BACKOFF_SECONDS)

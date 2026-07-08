"""OpenAI-compatible embedding provider.

One class covers every server speaking the /v1/embeddings dialect:
Ollama, HuggingFace TEI, Infinity, vLLM, OpenAI, Jina. The provider is
selected purely by configuration (base_url + model) — never by code.
"""

import asyncio

import httpx

from citera_pipeline.embed.base import EmbeddingError, InputType

_BATCH_SIZE = 96
_MAX_ATTEMPTS = 3
_MAX_RATE_LIMIT_ATTEMPTS = 7
_MAX_BACKOFF_SECONDS = 45.0

# Some models require task prefixes on the text itself (matched by
# substring of the model name). BGE-M3 and OpenAI models need none.
_TASK_PREFIXES: dict[str, tuple[str, str]] = {
    # model-substring: (query prefix, document prefix)
    "nomic": ("search_query: ", "search_document: "),
}


class OpenAICompatEmbedder:
    version = "1"

    def __init__(
        self,
        base_url: str,
        model: str,
        dim: int,
        api_key: str = "",
        send_dimensions: bool = False,
    ):
        self.model = model
        self.dim = dim
        self._api_key = api_key
        # e.g. OpenAI text-embedding-3-* accepts a "dimensions" param;
        # most local servers reject unknown fields, so it's opt-in
        self._send_dimensions = send_dimensions
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"), timeout=60.0
        )

    async def health_check(self) -> None:
        try:
            [vector] = await self._embed_batch(["healthcheck"], "query")
        except Exception as exc:
            raise EmbeddingError(
                f"Embedding provider unreachable or misconfigured "
                f"(model={self.model}, base_url={self._client.base_url}): {exc}"
            ) from exc
        if len(vector) != self.dim:
            raise EmbeddingError(
                f"Dimension mismatch: provider returns {len(vector)}-d vectors "
                f"but EMBEDDING_DIM={self.dim}. Fix the configuration (and "
                f"reindex if the model changed)."
            )

    async def embed(
        self, texts: list[str], *, input_type: InputType = "document"
    ) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), _BATCH_SIZE):
            batch = texts[start : start + _BATCH_SIZE]
            vectors.extend(await self._embed_batch(batch, input_type))
        for vector in vectors:
            if len(vector) != self.dim:
                raise EmbeddingError(
                    f"Provider returned {len(vector)}-d vector, expected {self.dim}"
                )
        return vectors

    async def _embed_batch(
        self, batch: list[str], input_type: InputType
    ) -> list[list[float]]:
        prefixed = [self._apply_prefix(t, input_type) for t in batch]
        payload: dict = {"input": prefixed, "model": self.model}
        if self._send_dimensions:
            payload["dimensions"] = self.dim
        headers = (
            {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}
        )

        last_error: Exception | None = None
        generic_attempts = 0
        rate_limit_attempts = 0
        while (
            generic_attempts < _MAX_ATTEMPTS
            and rate_limit_attempts < _MAX_RATE_LIMIT_ATTEMPTS
        ):
            try:
                resp = await self._client.post(
                    "/embeddings", json=payload, headers=headers
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                # spec: order by index, not response order
                ordered = sorted(data, key=lambda item: item["index"])
                return [item["embedding"] for item in ordered]
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
            except (httpx.HTTPError, KeyError, TypeError) as exc:
                last_error = exc
                generic_attempts += 1
                await asyncio.sleep(1.5 * generic_attempts)
        raise EmbeddingError(
            f"Embedding failed (generic={generic_attempts}, "
            f"rate_limited={rate_limit_attempts}): {last_error}"
        ) from last_error

    def _apply_prefix(self, text: str, input_type: InputType) -> str:
        for needle, (query_prefix, document_prefix) in _TASK_PREFIXES.items():
            if needle in self.model:
                prefix = query_prefix if input_type == "query" else document_prefix
                return prefix + text
        return text


def _retry_after_seconds(response: httpx.Response, attempt: int) -> float:
    header = response.headers.get("retry-after")
    if header:
        try:
            return min(float(header), _MAX_BACKOFF_SECONDS)
        except ValueError:
            pass
    return min(2.0 * (2 ** (attempt - 1)), _MAX_BACKOFF_SECONDS)

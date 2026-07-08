"""OpenAICompatEmbedder contract tests — MockTransport only, no network."""

import json

import httpx
import pytest
from citera_pipeline.embed import EmbeddingError, OpenAICompatEmbedder


def _mock_embedder(handler, **kwargs) -> OpenAICompatEmbedder:
    embedder = OpenAICompatEmbedder(
        base_url="http://mock/v1", model=kwargs.pop("model", "bge-m3"),
        dim=kwargs.pop("dim", 4), **kwargs
    )
    embedder._client = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://mock/v1"
    )
    return embedder


def _ok_response(request: httpx.Request) -> httpx.Response:
    texts = json.loads(request.content)["input"]
    # deliberately out of order — the client must sort by index
    data = [
        {"index": i, "embedding": [float(i)] * 4} for i in range(len(texts))
    ][::-1]
    return httpx.Response(200, json={"data": data})


async def test_embeds_and_orders_by_index():
    embedder = _mock_embedder(_ok_response)
    vectors = await embedder.embed(["a", "b", "c"])
    assert vectors == [[0.0] * 4, [1.0] * 4, [2.0] * 4]


async def test_health_check_passes_on_matching_dimension():
    await _mock_embedder(_ok_response).health_check()


async def test_health_check_fails_on_dimension_mismatch():
    embedder = _mock_embedder(_ok_response, dim=1024)
    with pytest.raises(EmbeddingError, match="Dimension mismatch"):
        await embedder.health_check()


async def test_embed_rejects_wrong_dimension_vectors():
    embedder = _mock_embedder(_ok_response, dim=99)
    with pytest.raises(EmbeddingError):
        await embedder.embed(["a"])


async def test_nomic_task_prefixes_applied_per_input_type():
    seen: list[list[str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        texts = json.loads(request.content)["input"]
        seen.append(texts)
        return httpx.Response(
            200,
            json={"data": [{"index": i, "embedding": [0.0] * 4} for i in range(len(texts))]},
        )

    embedder = _mock_embedder(handler, model="nomic-embed-text")
    await embedder.embed(["find risks"], input_type="query")
    await embedder.embed(["chunk body"], input_type="document")
    assert seen[0] == ["search_query: find risks"]
    assert seen[1] == ["search_document: chunk body"]


async def test_server_error_fails_gracefully_after_retries():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "boom"})

    embedder = _mock_embedder(handler)
    with pytest.raises(EmbeddingError, match="generic=3"):
        await embedder.embed(["a"])


async def test_rate_limit_retries_then_succeeds():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, headers={"retry-after": "0"})
        return _ok_response(request)

    embedder = _mock_embedder(handler)
    vectors = await embedder.embed(["a"])
    assert len(vectors) == 1
    assert calls["n"] == 3

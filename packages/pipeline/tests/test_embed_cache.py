from citera_pipeline.embed import CachingEmbedder, FakeEmbedder


class CountingEmbedder(FakeEmbedder):
    def __init__(self, dim: int = 32):
        super().__init__(dim=dim)
        self.calls: list[list[str]] = []

    async def embed(self, texts, *, input_type="document"):
        self.calls.append(list(texts))
        return await super().embed(texts, input_type=input_type)


async def test_repeat_queries_hit_the_cache():
    inner = CountingEmbedder()
    cached = CachingEmbedder(inner)

    first = await cached.embed(["q1", "q2"], input_type="query")
    second = await cached.embed(["q1", "q2"], input_type="query")

    assert first == second
    assert len(inner.calls) == 1  # second round: zero inner calls


async def test_only_misses_are_embedded_and_order_is_preserved():
    inner = CountingEmbedder()
    cached = CachingEmbedder(inner)

    await cached.embed(["a", "b"], input_type="query")
    result = await cached.embed(["b", "c", "a", "c"], input_type="query")

    assert inner.calls[1] == ["c"]  # only the miss, deduped
    direct = await FakeEmbedder(dim=32).embed(["b", "c", "a", "c"])
    assert result == direct  # order and duplicates preserved


async def test_input_types_are_cached_separately():
    inner = CountingEmbedder()
    cached = CachingEmbedder(inner)
    await cached.embed(["same text"], input_type="document")
    await cached.embed(["same text"], input_type="query")
    assert len(inner.calls) == 2


async def test_cache_eviction_keeps_size_bounded():
    inner = CountingEmbedder()
    cached = CachingEmbedder(inner, max_entries=2)
    await cached.embed(["a"], input_type="query")
    await cached.embed(["b"], input_type="query")
    await cached.embed(["c"], input_type="query")  # evicts "a"
    await cached.embed(["a"], input_type="query")  # miss again
    assert len(inner.calls) == 4


async def test_delegates_model_metadata():
    cached = CachingEmbedder(FakeEmbedder(dim=64))
    assert cached.model == "fake-bow"
    assert cached.dim == 64

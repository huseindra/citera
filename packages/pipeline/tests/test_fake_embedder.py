import math

import pytest
from citera_pipeline.embed import FakeEmbedder


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


@pytest.fixture
def embedder():
    return FakeEmbedder(dim=256)


async def test_deterministic(embedder):
    [a1] = await embedder.embed(["risks and side effects"])
    [a2] = await embedder.embed(["risks and side effects"])
    assert a1 == a2


async def test_unit_norm_and_dim(embedder):
    [vec] = await embedder.embed(["some text"])
    assert len(vec) == 256
    assert math.isclose(sum(v * v for v in vec), 1.0, rel_tol=1e-9)


async def test_token_overlap_drives_similarity(embedder):
    [risks_a, risks_b, voluntary] = await embedder.embed(
        [
            "risks side effects of the study drug",
            "the study drug has risks and side effects",
            "voluntary participation right to withdraw",
        ]
    )
    assert _cosine(risks_a, risks_b) > _cosine(risks_a, voluntary)


async def test_degenerate_input_still_unit_vector(embedder):
    [vec] = await embedder.embed(["§§§ !!!"])  # no tokens survive
    assert math.isclose(sum(v * v for v in vec), 1.0, rel_tol=1e-9)

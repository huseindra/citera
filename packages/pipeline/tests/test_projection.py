import math

from citera_pipeline.semantic import project_2d


def _cluster(base: float, n: int, dim: int = 16) -> list[list[float]]:
    return [
        [base + (i * 0.01 if d == 0 else 0.001 * d) for d in range(dim)]
        for i in range(n)
    ]


def test_deterministic_across_calls():
    vectors = _cluster(0.0, 4) + _cluster(5.0, 4)
    assert project_2d(vectors) == project_2d(vectors)


def test_output_normalized_and_finite():
    points = project_2d(_cluster(0.0, 5) + _cluster(3.0, 5))
    assert len(points) == 10
    for x, y in points:
        assert 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0
        assert math.isfinite(x) and math.isfinite(y)


def test_distinct_clusters_separate_on_first_axis():
    a, b = _cluster(0.0, 5), _cluster(10.0, 5)
    points = project_2d(a + b)
    xs_a = [p[0] for p in points[:5]]
    xs_b = [p[0] for p in points[5:]]
    # clusters end up on opposite sides
    assert max(xs_a) < min(xs_b) or max(xs_b) < min(xs_a)


def test_too_few_points_returns_empty():
    assert project_2d([[1.0, 2.0], [3.0, 4.0]]) == []
    assert project_2d([]) == []


def test_identical_vectors_collapse_without_nan():
    points = project_2d([[1.0, 1.0, 1.0]] * 5)
    for x, y in points:
        assert math.isfinite(x) and math.isfinite(y)

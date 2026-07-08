"""2D PCA projection of chunk embeddings for the semantic evidence map.

Deterministic by construction: SVD has a per-axis sign ambiguity, fixed
here by flipping each axis so its largest-magnitude coordinate is
positive. Output is normalized to [0, 1] per axis for direct SVG use.
Cheap enough (dozens of chunks) to compute on demand — no cache.
"""

import numpy as np

MIN_POINTS = 3


def project_2d(vectors: list[list[float]]) -> list[tuple[float, float]]:
    if len(vectors) < MIN_POINTS:
        return []

    matrix = np.asarray(vectors, dtype=np.float64)
    centered = matrix - matrix.mean(axis=0)
    _, singular_values, vt = np.linalg.svd(centered, full_matrices=False)

    components = 2 if vt.shape[0] >= 2 else vt.shape[0]
    coords = centered @ vt[:components].T
    if components < 2:  # pathological: rank-1 data
        coords = np.column_stack([coords, np.zeros(len(coords))])

    # deterministic sign per axis
    for axis in range(2):
        extreme = np.argmax(np.abs(coords[:, axis]))
        if coords[extreme, axis] < 0:
            coords[:, axis] *= -1

    # normalize to [0, 1]; degenerate variance collapses to the center
    lo = coords.min(axis=0)
    span = coords.max(axis=0) - lo
    normalized = np.where(span > 1e-12, (coords - lo) / np.where(span == 0, 1, span), 0.5)

    return [(float(x), float(y)) for x, y in normalized]

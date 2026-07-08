from functools import lru_cache

from citera_pipeline.embed import (
    CachingEmbedder,
    Embedder,
    FakeEmbedder,
    VoyageEmbedder,
)

from app.settings import settings


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    provider = settings.embeddings_provider
    if provider == "auto":
        provider = "voyage" if settings.voyage_api_key else "fake"
    if provider == "voyage":
        # cached: rule queries are static strings, and rate-limited APIs
        # must never be asked the same question twice in one process
        return CachingEmbedder(
            VoyageEmbedder(api_key=settings.voyage_api_key, dim=settings.embedding_dim)
        )
    if provider == "fake":
        return FakeEmbedder(dim=settings.embedding_dim)
    raise ValueError(f"Unknown embeddings provider '{provider}'")

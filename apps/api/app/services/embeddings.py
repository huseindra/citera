"""Embedding provider factory.

The active provider is ALWAYS explicit configuration (EMBEDDING_PROVIDER +
EMBEDDING_MODEL) — never probed, never silently switched. Unknown or
legacy 'auto' values fail fast with an actionable message. See
docs/embedding-architecture.md.
"""

from functools import lru_cache

from citera_pipeline.embed import (
    CachingEmbedder,
    Embedder,
    FakeEmbedder,
    OpenAICompatEmbedder,
    VoyageEmbedder,
)

from app.settings import settings

# Presets are static configuration defaults, not runtime behavior; every
# value can be overridden with EMBEDDING_BASE_URL.
_OPENAI_COMPAT_PRESETS: dict[str, dict] = {
    "ollama": {"base_url": "http://localhost:11434/v1", "send_dimensions": False},
    "tei": {"base_url": "http://localhost:8080/v1", "send_dimensions": False},
    "openai": {"base_url": "https://api.openai.com/v1", "send_dimensions": True},
    "jina": {"base_url": "https://api.jina.ai/v1", "send_dimensions": True},
    "openai-compat": {"base_url": "", "send_dimensions": False},
}

KNOWN_PROVIDERS = sorted({"fake", "voyage", *_OPENAI_COMPAT_PRESETS})


class EmbeddingConfigError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    provider = settings.embedding_provider.strip().lower()

    if provider in ("auto", ""):
        raise EmbeddingConfigError(
            "EMBEDDING_PROVIDER must be explicit (automatic provider selection "
            f"was removed). Set one of: {', '.join(KNOWN_PROVIDERS)} — e.g. "
            "EMBEDDING_PROVIDER=ollama EMBEDDING_MODEL=bge-m3"
        )

    if provider == "fake":
        embedder: Embedder = FakeEmbedder(dim=settings.embedding_dim)
        embedder.provider = provider  # type: ignore[attr-defined]
        return embedder

    if provider == "voyage":
        if not settings.voyage_api_key:
            raise EmbeddingConfigError(
                "EMBEDDING_PROVIDER=voyage requires VOYAGE_API_KEY"
            )
        inner: Embedder = VoyageEmbedder(
            api_key=settings.voyage_api_key,
            model=settings.embedding_model or "voyage-3.5-lite",
            dim=settings.embedding_dim,
        )
    elif provider in _OPENAI_COMPAT_PRESETS:
        if not settings.embedding_model:
            raise EmbeddingConfigError(
                f"EMBEDDING_PROVIDER={provider} requires EMBEDDING_MODEL "
                "(provider and model are separate concerns — e.g. "
                "EMBEDDING_MODEL=bge-m3)"
            )
        preset = _OPENAI_COMPAT_PRESETS[provider]
        base_url = settings.embedding_base_url or preset["base_url"]
        if not base_url:
            raise EmbeddingConfigError(
                f"EMBEDDING_PROVIDER={provider} requires EMBEDDING_BASE_URL"
            )
        inner = OpenAICompatEmbedder(
            base_url=base_url,
            model=settings.embedding_model,
            dim=settings.embedding_dim,
            api_key=settings.embedding_api_key,
            send_dimensions=preset["send_dimensions"],
        )
    else:
        raise EmbeddingConfigError(
            f"Unknown EMBEDDING_PROVIDER '{provider}'. "
            f"Known providers: {', '.join(KNOWN_PROVIDERS)}"
        )

    cached = CachingEmbedder(inner)
    cached.provider = provider  # type: ignore[attr-defined]
    return cached


def embedding_metadata() -> dict:
    """Provider metadata for audit records and diagnostics — the four
    reproducibility fields required on every review."""
    embedder = get_embedder()
    return {
        "provider": getattr(embedder, "provider", "unknown"),
        "model": embedder.model,
        "dim": embedder.dim,
        "version": embedder.version,
    }


def embedding_cache_stats() -> dict | None:
    embedder = get_embedder()
    stats = getattr(embedder, "stats", None)
    return stats() if callable(stats) else None

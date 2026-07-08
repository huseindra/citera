"""Factory fail-fast behavior + diagnostics endpoint shape.

No external APIs: the configured test provider is 'fake' (conftest), and
misconfiguration cases only exercise the factory's error paths.
"""

import httpx
import pytest

from app.services import embeddings as embeddings_service
from app.services.embeddings import (
    EmbeddingConfigError,
    embedding_metadata,
    get_embedder,
)


@pytest.fixture(autouse=True)
def reset_factory_cache():
    get_embedder.cache_clear()
    yield
    get_embedder.cache_clear()


def _with_settings(monkeypatch, **overrides):
    for key, value in overrides.items():
        monkeypatch.setattr(embeddings_service.settings, key, value)


def test_auto_is_rejected_with_actionable_message(monkeypatch):
    _with_settings(monkeypatch, embedding_provider="auto")
    with pytest.raises(EmbeddingConfigError, match="must be explicit"):
        get_embedder()


def test_unknown_provider_rejected(monkeypatch):
    _with_settings(monkeypatch, embedding_provider="qdrant-magic")
    with pytest.raises(EmbeddingConfigError, match="Known providers"):
        get_embedder()


def test_openai_compat_provider_requires_model(monkeypatch):
    _with_settings(monkeypatch, embedding_provider="ollama", embedding_model="")
    with pytest.raises(EmbeddingConfigError, match="EMBEDDING_MODEL"):
        get_embedder()


def test_voyage_requires_api_key(monkeypatch):
    _with_settings(monkeypatch, embedding_provider="voyage", voyage_api_key="")
    with pytest.raises(EmbeddingConfigError, match="VOYAGE_API_KEY"):
        get_embedder()


def test_metadata_carries_the_four_reproducibility_fields():
    meta = embedding_metadata()
    assert set(meta) == {"provider", "model", "dim", "version"}
    assert meta["provider"] == "fake"
    assert meta["dim"] == 1024


async def test_health_endpoints_expose_diagnostics():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        detailed = (await client.get("/health/embeddings")).json()

    assert detailed["healthy"] is True
    assert detailed["provider"] == "fake"
    assert detailed["model"] == "fake-bow"
    assert detailed["dim"] == 1024
    # fake embedder has no cache wrapper — the field exists, value None
    assert "cache" in detailed

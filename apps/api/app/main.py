import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.db import Base, engine
from fastapi import APIRouter

from app.routers.documents import router as documents_router
from app.routers.findings import router as findings_router
from app.routers.platform import router as platform_router
from app.routers.retrieval import router as retrieval_router
from app.routers.reviews import router as reviews_router
from app.routers.rulesets import router as rulesets_router
from app.services.embeddings import embedding_metadata, get_embedder
from app.settings import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Idempotent safety net: initdb only runs on first volume creation.
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    # Fail fast: a misconfigured or unreachable embedding provider must be
    # visible at startup, never at the first review.
    embedder = get_embedder()  # raises EmbeddingConfigError on bad config
    await embedder.health_check()  # raises EmbeddingError when unreachable
    app.state.embedding_diagnostics = {**embedding_metadata(), "healthy": True}
    logger.info("embedding provider ready: %s", app.state.embedding_diagnostics)

    yield
    await engine.dispose()


app = FastAPI(title="Citera API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(documents_router)
app.include_router(findings_router)
app.include_router(retrieval_router)
app.include_router(reviews_router)
app.include_router(rulesets_router)

# Public v1 surface: the SDK's REST API is the existing resource API,
# re-included under /v1 (retrieval stays internal). Key enforcement on
# /v1 is a fast-follow.
v1 = APIRouter(prefix="/v1")
v1.include_router(documents_router)
v1.include_router(findings_router)
v1.include_router(reviews_router)
v1.include_router(rulesets_router)
v1.include_router(platform_router)
app.include_router(v1)


@app.get("/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db = "ok"
    except Exception as exc:  # surface the reason, don't mask it
        db = f"error: {type(exc).__name__}"
    return {
        "status": "ok" if db == "ok" else "degraded",
        "db": db,
        # startup snapshot — live provider check lives at /health/embeddings
        "embeddings": getattr(app.state, "embedding_diagnostics", None),
    }


@app.get("/health/embeddings")
async def health_embeddings():
    """Startup diagnostics + a LIVE provider check on demand."""
    from app.services.embeddings import embedding_cache_stats

    diagnostics = {**embedding_metadata(), "cache": embedding_cache_stats()}
    try:
        await get_embedder().health_check()
        diagnostics["healthy"] = True
    except Exception as exc:
        diagnostics["healthy"] = False
        diagnostics["error"] = str(exc)
    return diagnostics

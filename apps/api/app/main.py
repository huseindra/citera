from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.db import Base, engine
from app.routers.documents import router as documents_router
from app.routers.retrieval import router as retrieval_router
from app.routers.reviews import router as reviews_router
from app.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Idempotent safety net: initdb only runs on first volume creation.
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
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
app.include_router(retrieval_router)
app.include_router(reviews_router)


@app.get("/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db = "ok"
    except Exception as exc:  # surface the reason, don't mask it
        db = f"error: {type(exc).__name__}"
    return {"status": "ok" if db == "ok" else "degraded", "db": db}

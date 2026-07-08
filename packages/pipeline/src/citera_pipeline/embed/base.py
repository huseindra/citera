from typing import Literal, Protocol

InputType = Literal["document", "query"]


class EmbeddingError(Exception):
    pass


class Embedder(Protocol):
    """Turns texts into vectors. model + version + dim are stored per chunk
    so retrieval is only ever performed within one embedding space."""

    model: str
    version: str
    dim: int

    async def embed(
        self, texts: list[str], *, input_type: InputType = "document"
    ) -> list[list[float]]: ...

    async def health_check(self) -> None:
        """Raises EmbeddingError when the provider is unusable. Called at
        startup — the application fails fast instead of failing on the
        first review."""
        ...


async def embed_documents(embedder: Embedder, texts: list[str]) -> list[list[float]]:
    return await embedder.embed(texts, input_type="document")


async def embed_query(embedder: Embedder, text: str) -> list[float]:
    [vector] = await embedder.embed([text], input_type="query")
    return vector

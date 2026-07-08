from typing import Literal, Protocol

InputType = Literal["document", "query"]


class Embedder(Protocol):
    """Turns texts into vectors. model + version are stored per chunk so
    retrieval is only ever performed within one embedding space."""

    model: str
    version: str
    dim: int

    async def embed(
        self, texts: list[str], *, input_type: InputType = "document"
    ) -> list[list[float]]: ...

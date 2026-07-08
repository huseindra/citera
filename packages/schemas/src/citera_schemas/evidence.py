from uuid import UUID

from pydantic import BaseModel, model_validator


class EvidenceSpan(BaseModel):
    """A verifiable location in a document's canonical text.

    Offsets index into the canonical text stored at ingestion; slicing the
    canonical text with them must reproduce the referenced text exactly.
    """

    document_id: UUID
    page: int | None = None
    char_start: int
    char_end: int

    @model_validator(mode="after")
    def _valid_range(self) -> "EvidenceSpan":
        if self.char_start < 0:
            raise ValueError("char_start must be >= 0")
        if self.char_end <= self.char_start:
            raise ValueError("char_end must be > char_start")
        return self

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class AuditStep(StrEnum):
    INGEST_EXTRACT = "ingest.extract"
    INGEST_CHUNK = "ingest.chunk"
    INGEST_EMBED = "ingest.embed"
    RETRIEVE = "retrieve"
    EVALUATE_PROMPT = "evaluate.prompt"
    EVALUATE_RESPONSE = "evaluate.response"
    GROUNDING_PASSED = "grounding.passed"
    GROUNDING_FAILED = "grounding.failed"
    FINDING_PERSISTED = "finding.persisted"


class AuditRecord(BaseModel):
    """One append-only record of a pipeline step.

    payload holds the raw truth of the step (queries, scores, prompt,
    response, model version, …). Records are never updated or summarized.
    """

    id: UUID
    step: AuditStep
    payload: dict[str, Any]
    created_at: datetime
    document_id: UUID | None = None
    review_id: UUID | None = None
    finding_id: UUID | None = None

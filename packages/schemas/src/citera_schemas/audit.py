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
    VERIFY_REVISION = "verify.revision"
    # reviewer workflow: staged human review over an immutable AI review
    REVIEW_UPDATED = "review.updated"
    REVIEW_DELETED = "review.deleted"
    WORKFLOW_STAGE_STARTED = "workflow.stage.started"
    WORKFLOW_DETERMINATION = "workflow.determination"
    WORKFLOW_FINDING_ADDED = "workflow.finding.added"
    WORKFLOW_STAGE_COMPLETED = "workflow.stage.completed"
    REVIEW_APPROVED = "review.approved"
    DOCUMENT_DELETED = "document.deleted"


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

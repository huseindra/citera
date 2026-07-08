from enum import StrEnum

from pydantic import BaseModel, Field


class Severity(StrEnum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"


class Rule(BaseModel):
    """One declarative regulatory requirement.

    Adding a regulation is content work (YAML), not code work.
    """

    id: str
    citation: str
    title: str
    description: str
    retrieval_queries: list[str] = Field(min_length=1)
    evaluation_criteria: str
    severity: Severity


class RuleSet(BaseModel):
    id: str
    name: str
    version: str
    rules: list[Rule] = Field(min_length=1)

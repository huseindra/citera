from enum import StrEnum

from pydantic import BaseModel, Field


class Severity(StrEnum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"


class Rule(BaseModel):
    """One declarative regulatory requirement.

    Adding a regulation is content work (YAML), not code work. A rule is
    the unit of evaluation and of the finding the reviewer sees — grouped
    at reviewer granularity, while `statutory_refs` preserves the native
    statutory granularity (every provision the rule covers, including
    dual citations during guideline transitions).
    """

    id: str
    citation: str
    title: str
    description: str
    retrieval_queries: list[str] = Field(min_length=1)
    evaluation_criteria: str
    severity: Severity
    # native statutory provisions this grouped rule covers (evidence mapping)
    statutory_refs: list[str] = []
    # static, jurisdiction-authored remediation guidance (distinct from the
    # AI-drafted suggested_revision, which is generated per finding)
    remediation: str | None = None


class RuleSet(BaseModel):
    """A self-describing, independently versioned regulatory rule pack.

    The engine is jurisdiction-agnostic: it never knows about FDA or
    BPOM, it only loads RuleSets. Everything a jurisdiction needs lives
    here; nothing is hardcoded in the engine.
    """

    id: str
    name: str
    version: str
    authority: str = ""
    jurisdiction: str = ""
    coverage: str | None = None
    # ISO 639-1 codes of languages the pack's retrieval queries target
    languages: list[str] = ["en"]
    # short aliases accepted by the API (e.g. "fda" → "fda-21cfr50")
    aliases: list[str] = []
    rules: list[Rule] = Field(min_length=1)

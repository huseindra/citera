from citera_rulesets import RulesetError, load_ruleset, registry, resolve_ruleset_id
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/rulesets", tags=["rulesets"])


class RuleOut(BaseModel):
    id: str
    citation: str
    title: str
    description: str
    severity: str
    # native statutory provisions this grouped rule covers
    statutory_refs: list[str]
    remediation: str | None


class RuleSetOut(BaseModel):
    id: str
    name: str
    version: str
    authority: str
    jurisdiction: str
    languages: list[str]
    rules: list[RuleOut]


class RulesetInfo(BaseModel):
    id: str
    authority: str
    name: str
    jurisdiction: str
    coverage: str | None
    status: str  # available | in_development | roadmap
    version: str | None
    rule_count: int | None
    languages: list[str]
    aliases: list[str]


@router.get("", response_model=list[RulesetInfo])
async def list_rulesets():
    """Every regulatory authority is a pluggable ruleset — available
    packs run today, in_development packs are shipped but not yet
    runnable, roadmap is planned."""
    return [RulesetInfo(**entry) for entry in registry()]


@router.get("/{ruleset_id}", response_model=RuleSetOut)
async def get_ruleset(ruleset_id: str):
    try:
        ruleset = load_ruleset(resolve_ruleset_id(ruleset_id))
    except RulesetError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RuleSetOut(
        id=ruleset.id,
        name=ruleset.name,
        version=ruleset.version,
        authority=ruleset.authority,
        jurisdiction=ruleset.jurisdiction,
        languages=ruleset.languages,
        rules=[
            RuleOut(
                id=r.id,
                citation=r.citation,
                title=r.title,
                description=r.description,
                severity=r.severity.value,
                statutory_refs=r.statutory_refs,
                remediation=r.remediation,
            )
            for r in ruleset.rules
        ],
    )

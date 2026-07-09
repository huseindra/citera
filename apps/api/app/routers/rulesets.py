from citera_rulesets import RulesetError, load_ruleset, registry
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/rulesets", tags=["rulesets"])


class RuleOut(BaseModel):
    id: str
    citation: str
    title: str
    description: str
    severity: str


class RuleSetOut(BaseModel):
    id: str
    name: str
    version: str
    rules: list[RuleOut]


class RulesetInfo(BaseModel):
    id: str
    authority: str
    name: str
    jurisdiction: str
    coverage: str | None
    status: str  # available | preview | roadmap
    version: str | None
    rule_count: int | None


@router.get("", response_model=list[RulesetInfo])
async def list_rulesets():
    """Every regulatory authority is a pluggable ruleset — available
    packs run today, previews are in development, roadmap is planned."""
    return [RulesetInfo(**entry) for entry in registry()]


@router.get("/{ruleset_id}", response_model=RuleSetOut)
async def get_ruleset(ruleset_id: str):
    try:
        ruleset = load_ruleset(ruleset_id)
    except RulesetError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RuleSetOut(
        id=ruleset.id,
        name=ruleset.name,
        version=ruleset.version,
        rules=[
            RuleOut(
                id=r.id,
                citation=r.citation,
                title=r.title,
                description=r.description,
                severity=r.severity.value,
            )
            for r in ruleset.rules
        ],
    )

from citera_rulesets import RulesetError, available_rulesets, load_ruleset
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


@router.get("", response_model=list[str])
async def list_rulesets():
    return available_rulesets()


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

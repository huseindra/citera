"""Load declarative rule sets from package data.

Fails loudly at load time — a malformed rule must break startup,
never a review in progress.
"""

from pathlib import Path

import yaml
from citera_schemas import Rule, RuleSet

_DATA_DIR = Path(__file__).parent / "data"


class RulesetError(Exception):
    pass


def available_rulesets() -> list[str]:
    return sorted(p.name for p in _DATA_DIR.iterdir() if (p / "ruleset.yaml").is_file())


def load_ruleset(ruleset_id: str) -> RuleSet:
    base = _DATA_DIR / ruleset_id
    meta_path = base / "ruleset.yaml"
    if not meta_path.is_file():
        raise RulesetError(
            f"Unknown ruleset '{ruleset_id}'. Available: {available_rulesets()}"
        )

    meta = yaml.safe_load(meta_path.read_text())
    rule_files = sorted((base / "rules").glob("*.yaml"))
    if not rule_files:
        raise RulesetError(f"Ruleset '{ruleset_id}' has no rules")

    rules: list[Rule] = []
    for path in rule_files:
        try:
            rules.append(Rule.model_validate(yaml.safe_load(path.read_text())))
        except Exception as exc:
            raise RulesetError(f"Invalid rule file {path.name}: {exc}") from exc

    ids = [r.id for r in rules]
    duplicates = {i for i in ids if ids.count(i) > 1}
    if duplicates:
        raise RulesetError(f"Duplicate rule ids in '{ruleset_id}': {duplicates}")

    return RuleSet(
        id=meta["id"], name=meta["name"], version=str(meta["version"]), rules=rules
    )

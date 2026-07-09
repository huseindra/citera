"""Load declarative rule sets from package data.

Fails loudly at load time — a malformed rule must break startup,
never a review in progress.

Lifecycle: `available` (pack shipped, reviews run) → `in_development`
(pack exists and is versioned, reviews are refused) → `roadmap`
(registry entry only, no pack). Status lives in registry.yaml; every
other fact about a ruleset lives in the pack itself (ruleset.yaml) —
single source of truth, independently versioned.
"""

from pathlib import Path

import yaml
from citera_schemas import Rule, RuleSet

_DATA_DIR = Path(__file__).parent / "data"

STATUSES = {"available", "in_development", "roadmap"}


class RulesetError(Exception):
    pass


def available_rulesets() -> list[str]:
    """Ids of every shipped rule pack (any status)."""
    return sorted(p.name for p in _DATA_DIR.iterdir() if (p / "ruleset.yaml").is_file())


def registry() -> list[dict]:
    """All known jurisdictions with status — every authority is just a
    pluggable ruleset. Entries with a shipped pack derive their metadata
    (name, version, languages, aliases, rule count) from the pack;
    roadmap entries carry their own display metadata."""
    raw = yaml.safe_load((_DATA_DIR / "registry.yaml").read_text())
    packs = set(available_rulesets())
    entries: list[dict] = []
    seen_aliases: dict[str, str] = {}
    for item in raw["rulesets"]:
        status = item["status"]
        if status not in STATUSES:
            raise RulesetError(
                f"Registry entry '{item['id']}' has unknown status '{status}' "
                f"(expected one of {sorted(STATUSES)})"
            )
        entry = {
            "id": item["id"],
            "authority": item.get("authority", ""),
            "name": item.get("name", item.get("authority", item["id"])),
            "jurisdiction": item.get("jurisdiction", ""),
            "coverage": item.get("coverage"),
            "status": status,
            "version": None,
            "rule_count": None,
            "languages": [],
            "aliases": [],
        }
        if status in ("available", "in_development"):
            if item["id"] not in packs:
                raise RulesetError(
                    f"Registry marks '{item['id']}' {status} but no rule "
                    f"pack exists — fix the registry or ship the pack"
                )
            pack = load_ruleset(item["id"])
            entry.update(
                name=pack.name,
                authority=pack.authority or entry["authority"],
                jurisdiction=pack.jurisdiction or entry["jurisdiction"],
                coverage=pack.coverage or entry["coverage"],
                version=f"v{pack.version}",
                rule_count=len(pack.rules),
                languages=pack.languages,
                aliases=pack.aliases,
            )
            for alias in pack.aliases:
                if alias in seen_aliases:
                    raise RulesetError(
                        f"Alias '{alias}' claimed by both "
                        f"'{seen_aliases[alias]}' and '{item['id']}'"
                    )
                seen_aliases[alias] = item["id"]
        elif item["id"] in packs:
            raise RulesetError(
                f"Registry marks '{item['id']}' roadmap but a rule pack "
                f"exists — promote the entry to in_development or available"
            )
        entries.append(entry)
    return entries


def resolve_ruleset_id(id_or_alias: str) -> str:
    """Resolve an API-facing alias ("fda") to the pack id ("fda-21cfr50").
    Unknown values pass through so load_ruleset can raise its usual error."""
    for pack_id in available_rulesets():
        if id_or_alias == pack_id:
            return pack_id
        meta = yaml.safe_load((_DATA_DIR / pack_id / "ruleset.yaml").read_text())
        if id_or_alias in (meta.get("aliases") or []):
            return pack_id
    return id_or_alias


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

    try:
        return RuleSet(
            id=meta["id"],
            name=meta["name"],
            version=str(meta["version"]),
            authority=meta.get("authority", ""),
            jurisdiction=meta.get("jurisdiction", ""),
            coverage=meta.get("coverage"),
            languages=meta.get("languages", ["en"]),
            aliases=meta.get("aliases", []),
            rules=rules,
        )
    except Exception as exc:
        raise RulesetError(f"Invalid ruleset.yaml for '{ruleset_id}': {exc}") from exc

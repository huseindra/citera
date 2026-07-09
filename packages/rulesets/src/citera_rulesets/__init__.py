"""Citera rule sets.

Rule content lives in YAML under data/; the loader validates it into
citera_schemas.Rule at startup. Adding a regulation is content work.
"""

from citera_rulesets.loader import (
    RulesetError,
    available_rulesets,
    load_ruleset,
    registry,
)

__all__ = ["RulesetError", "available_rulesets", "load_ruleset", "registry"]

__version__ = "0.1.0"

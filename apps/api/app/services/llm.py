from functools import lru_cache

from citera_pipeline.findings import ClaudeEvaluator, Evaluator, ScriptedEvaluator

from app.settings import settings

# Mirrors docs/demo-script.md — the planted defects in ICF-B. Used by the
# scripted evaluator so tests and keyless dev reproduce the answer key.
DEMO_EXPECTATIONS = {
    "fda-50.25-a2-risks": "conflicting",
    "fda-50.25-a6-injury-compensation": "partial",
    "fda-50.25-a8-voluntary": "not_found",
}


@lru_cache(maxsize=1)
def get_evaluator() -> Evaluator:
    provider = settings.llm_provider
    if provider == "auto":
        provider = "claude" if settings.anthropic_api_key else "scripted"
    if provider == "claude":
        return ClaudeEvaluator(
            api_key=settings.anthropic_api_key, model=settings.claude_model
        )
    if provider == "scripted":
        return ScriptedEvaluator(DEMO_EXPECTATIONS)
    raise ValueError(f"Unknown llm provider '{provider}'")

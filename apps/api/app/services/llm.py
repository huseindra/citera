from functools import lru_cache

from citera_pipeline.findings import ClaudeEvaluator, Evaluator, ScriptedEvaluator

from app.settings import settings


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
        # judges evidence with deterministic keyword heuristics; reproduces
        # the demo answer key on ICF-B and a clean pass on ICF-A
        return ScriptedEvaluator()
    raise ValueError(f"Unknown llm provider '{provider}'")

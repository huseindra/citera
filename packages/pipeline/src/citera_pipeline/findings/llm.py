"""Claude evaluator: one requirement per call, forced structured output.

claude-sonnet-5 notes (per current API): non-default sampling params
(temperature/top_p/top_k) are rejected — determinism is steered by the
prompt and the forced tool schema. thinking is explicitly disabled for
this structured-extraction task and to pair with forced tool_choice.
"""

from typing import Any

from anthropic import APIStatusError, AsyncAnthropic
from citera_schemas import RetrievedChunk, Rule

from citera_pipeline.findings.base import (
    CLAIMABLE_STATUSES,
    EvaluationError,
    EvaluationOutcome,
)
from citera_pipeline.findings.prompt import build_prompt

_NULLABLE_STRING = {"anyOf": [{"type": "string"}, {"type": "null"}]}

FINDING_TOOL: dict[str, Any] = {
    "name": "report_finding",
    "description": (
        "Report the compliance finding for the requirement under review. "
        "verbatim_quote must be copied exactly from one evidence chunk."
    ),
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["satisfied", "partial", "not_found", "conflicting"],
            },
            "reasoning": {"type": "string"},
            "verbatim_quote": _NULLABLE_STRING,
            "source_chunk_id": _NULLABLE_STRING,
            "protocol_reference": _NULLABLE_STRING,
        },
        "required": [
            "status",
            "reasoning",
            "verbatim_quote",
            "source_chunk_id",
            "protocol_reference",
        ],
        "additionalProperties": False,
    },
}

_MAX_ATTEMPTS = 2  # one retry on malformed output; API errors retry in the SDK


class ClaudeEvaluator:
    def __init__(self, api_key: str, model: str = "claude-sonnet-5"):
        self.model = model
        self._client = AsyncAnthropic(api_key=api_key)

    async def evaluate(
        self,
        rule: Rule,
        evidence: list[RetrievedChunk],
        protocol_text: str | None,
    ) -> EvaluationOutcome:
        system, messages = build_prompt(rule, evidence, protocol_text)
        prompt_payload = {"system": system, "messages": messages}

        last_problem = "no attempts made"
        for _ in range(_MAX_ATTEMPTS):
            try:
                response = await self._client.messages.create(
                    model=self.model,
                    max_tokens=2048,
                    thinking={"type": "disabled"},
                    system=system,
                    messages=messages,
                    tools=[FINDING_TOOL],
                    tool_choice={"type": "tool", "name": "report_finding"},
                )
            except APIStatusError as exc:
                raise EvaluationError(
                    f"Claude API error for rule {rule.id}: {exc.status_code} {exc.message}"
                ) from exc

            tool_use = next(
                (b for b in response.content if b.type == "tool_use"), None
            )
            if tool_use is not None:
                data = tool_use.input
                if isinstance(data, dict) and data.get("status") in CLAIMABLE_STATUSES:
                    return EvaluationOutcome(
                        status=data["status"],
                        reasoning=data.get("reasoning") or "",
                        verbatim_quote=data.get("verbatim_quote"),
                        source_chunk_id=data.get("source_chunk_id"),
                        protocol_reference=data.get("protocol_reference"),
                        model=f"{self.model} ({response.model})",
                        prompt_payload=prompt_payload,
                        raw_response=response.model_dump(mode="json"),
                    )
                last_problem = f"invalid tool input: {data!r}"
            else:
                last_problem = f"no tool_use block (stop_reason={response.stop_reason})"

        raise EvaluationError(
            f"Claude produced no valid finding for rule {rule.id}: {last_problem}"
        )

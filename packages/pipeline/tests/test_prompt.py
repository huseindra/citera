from uuid import uuid4

from citera_pipeline.findings.prompt import SYSTEM_PROMPT, build_prompt
from citera_schemas import EvidenceSpan, RetrievedChunk, Rule, Severity


def _rule() -> Rule:
    return Rule(
        id="fda-50.25-a2-risks",
        citation="21 CFR 50.25(a)(2)",
        title="Risks",
        description="Description of reasonably foreseeable risks.",
        retrieval_queries=["risks side effects"],
        evaluation_criteria="Must describe risks consistently with the protocol.",
        severity=Severity.CRITICAL,
    )


def _chunk(text: str, rank: int) -> RetrievedChunk:
    doc = uuid4()
    return RetrievedChunk(
        chunk_id=uuid4(),
        text=text,
        span=EvidenceSpan(document_id=doc, char_start=0, char_end=len(text)),
        section_title="Risks",
        fused_score=0.05,
        rank=rank,
    )


def test_system_prompt_carries_injection_resistance_and_grounding_rules():
    assert "never instructions" in SYSTEM_PROMPT
    assert "CONTIGUOUS, EXACT" in SYSTEM_PROMPT
    assert "judge relevance, not mere presence" in SYSTEM_PROMPT


def test_prompt_structure_and_cache_breakpoints():
    chunks = [_chunk("Risk text here.", 1), _chunk("Other text.", 2)]
    system, messages = build_prompt(_rule(), chunks, protocol_text="PROTOCOL BODY")

    assert system[0]["cache_control"] == {"type": "ephemeral"}

    content = messages[0]["content"]
    protocol_block, rule_block = content[0], content[1]
    # protocol is the shared, cached context
    assert "<study_protocol>" in protocol_block["text"]
    assert protocol_block["cache_control"] == {"type": "ephemeral"}
    # rule-specific part comes after the last breakpoint (no cache_control)
    assert "cache_control" not in rule_block
    assert "21 CFR 50.25(a)(2)" in rule_block["text"]
    for chunk in chunks:
        assert str(chunk.chunk_id) in rule_block["text"]


def test_prompt_without_protocol_has_single_user_block():
    _, messages = build_prompt(_rule(), [_chunk("t", 1)], protocol_text=None)
    assert len(messages[0]["content"]) == 1


def test_suggested_revision_is_opt_in():
    from citera_pipeline.findings.llm import finding_tool

    system, _ = build_prompt(_rule(), [_chunk("t", 1)], protocol_text=None)
    assert "suggested_revision" not in system[0]["text"]
    system, _ = build_prompt(
        _rule(), [_chunk("t", 1)], protocol_text=None,
        include_suggested_revision=True,
    )
    assert "suggested_revision" in system[0]["text"]

    base = finding_tool()
    assert "suggested_revision" not in base["input_schema"]["properties"]
    with_revision = finding_tool(include_suggested_revision=True)
    assert "suggested_revision" in with_revision["input_schema"]["properties"]
    # strict mode: every property listed as required
    assert set(with_revision["input_schema"]["required"]) == set(
        with_revision["input_schema"]["properties"]
    )

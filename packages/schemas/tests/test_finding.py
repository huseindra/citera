from uuid import uuid4

import pytest
from citera_schemas import EvidenceSpan, Finding, FindingStatus


def _span() -> EvidenceSpan:
    return EvidenceSpan(document_id=uuid4(), page=1, char_start=0, char_end=20)


def _base(**overrides):
    kwargs = dict(
        id=uuid4(),
        review_id=uuid4(),
        rule_id="fda-50.25-a2-risks",
        status=FindingStatus.SATISFIED,
        reasoning="The risks section discloses reasonably foreseeable risks.",
        verbatim_quote="Possible side effects include",
        span=_span(),
    )
    kwargs.update(overrides)
    return kwargs


@pytest.mark.parametrize(
    "status",
    [FindingStatus.SATISFIED, FindingStatus.PARTIAL, FindingStatus.CONFLICTING],
)
def test_evidence_backed_status_requires_span_and_quote(status):
    Finding(**_base(status=status))  # valid with both
    with pytest.raises(ValueError, match="requires both span and verbatim_quote"):
        Finding(**_base(status=status, span=None))
    with pytest.raises(ValueError, match="requires both span and verbatim_quote"):
        Finding(**_base(status=status, verbatim_quote=None))


def test_not_found_requires_queries_and_forbids_span():
    valid = Finding(
        **_base(
            status=FindingStatus.NOT_FOUND,
            span=None,
            verbatim_quote=None,
            queries_executed=["voluntary participation statement"],
        )
    )
    assert valid.queries_executed

    with pytest.raises(ValueError, match="must not carry a span"):
        Finding(**_base(status=FindingStatus.NOT_FOUND))

    with pytest.raises(ValueError, match="queries_executed"):
        Finding(
            **_base(status=FindingStatus.NOT_FOUND, span=None, verbatim_quote=None)
        )


def test_evaluation_failed_needs_no_evidence():
    finding = Finding(
        **_base(
            status=FindingStatus.EVALUATION_FAILED,
            span=None,
            verbatim_quote=None,
            reasoning="LLM output failed grounding validation twice.",
        )
    )
    assert finding.status == FindingStatus.EVALUATION_FAILED


def test_status_round_trips_as_string():
    finding = Finding(**_base())
    assert finding.model_dump()["status"] == "satisfied"

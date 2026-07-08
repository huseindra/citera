from uuid import uuid4

import pytest
from citera_schemas import EvidenceSpan


def test_valid_span():
    span = EvidenceSpan(document_id=uuid4(), page=2, char_start=10, char_end=42)
    assert span.char_end - span.char_start == 32


def test_negative_start_rejected():
    with pytest.raises(ValueError):
        EvidenceSpan(document_id=uuid4(), char_start=-1, char_end=5)


def test_empty_span_rejected():
    with pytest.raises(ValueError):
        EvidenceSpan(document_id=uuid4(), char_start=7, char_end=7)


def test_inverted_span_rejected():
    with pytest.raises(ValueError):
        EvidenceSpan(document_id=uuid4(), char_start=10, char_end=3)

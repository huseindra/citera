from citera_pipeline.findings import ground_quote

TEXT = (
    "## What are the risks and discomforts?\n\n"
    "Centraxol has been **well tolerated** in previous studies. "
    "Most participants experienced no side effects at all.\n\n"
    "As with any blood draw, you may have brief discomfort or a small bruise. "
    "Tell the study team about any discomfort you feel. "
    "As with any blood draw, you may have brief discomfort or a small bruise.\n"
)


def test_exact_match_returns_precise_offsets():
    quote = "Most participants experienced no side effects at all."
    result = ground_quote(quote, TEXT)
    assert result.ok and result.method == "exact"
    assert TEXT[result.char_start : result.char_end] == quote


def test_fabricated_quote_rejected():
    """THE test: a quote not in the document must never produce a span."""
    result = ground_quote(
        "This exact sentence does not appear anywhere in the document.", TEXT
    )
    assert not result.ok
    assert "not found" in result.reason


def test_whitespace_variant_grounds_via_normalization():
    quote = "Centraxol has been **well tolerated**  in previous\nstudies."
    result = ground_quote(quote, TEXT)
    assert result.ok and result.method == "normalized"
    sliced = TEXT[result.char_start : result.char_end]
    assert sliced.startswith("Centraxol has been")
    assert sliced.endswith("previous studies.")


def test_unicode_quote_variant_grounds():
    text = 'The sponsor states: "no serious side effects have been observed" here.'
    quote = "“no serious side effects have been observed”"
    result = ground_quote(quote, text)
    assert result.ok
    assert text[result.char_start : result.char_end] == '"no serious side effects have been observed"'


def test_multiple_occurrences_pick_nearest_to_hint():
    quote = "As with any blood draw, you may have brief discomfort or a small bruise."
    first = TEXT.find(quote)
    second = TEXT.find(quote, first + 1)
    assert first != -1 and second != -1 and first != second

    near_first = ground_quote(quote, TEXT, hint_offset=first)
    near_second = ground_quote(quote, TEXT, hint_offset=second + 10)
    assert near_first.char_start == first
    assert near_second.char_start == second


def test_ellipsis_quote_rejected():
    result = ground_quote("Centraxol has been ... no side effects", TEXT)
    assert not result.ok
    assert "ellipsis" in result.reason


def test_short_or_missing_quote_rejected():
    assert not ground_quote("tiny", TEXT).ok
    assert not ground_quote(None, TEXT).ok
    assert not ground_quote("   ", TEXT).ok

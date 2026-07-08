from uuid import UUID

from citera_pipeline.retrieve import fuse


def _id(n: int) -> UUID:
    return UUID(int=n)


def test_chunk_in_both_lists_outranks_single_list_chunk():
    dense = [[(_id(1), 0.9), (_id(2), 0.8)]]
    sparse = [[(_id(1), 0.5), (_id(3), 0.4)]]
    result = fuse(dense, sparse)
    assert result[0].chunk_id == _id(1)
    assert result[0].fused_score > result[1].fused_score


def test_absent_scores_stay_none_not_zero():
    result = fuse([[(_id(1), 0.9)]], [[(_id(2), 0.4)]])
    by_id = {f.chunk_id: f for f in result}
    assert by_id[_id(1)].dense_score == 0.9
    assert by_id[_id(1)].sparse_score is None
    assert by_id[_id(2)].dense_score is None
    assert by_id[_id(2)].sparse_score == 0.4


def test_multi_query_lists_accumulate():
    # chunk 1 appears at rank 1 in two dense lists; chunk 2 once
    dense = [[(_id(1), 0.9)], [(_id(1), 0.7), (_id(2), 0.6)]]
    result = fuse(dense, [])
    by_id = {f.chunk_id: f for f in result}
    assert by_id[_id(1)].fused_score > by_id[_id(2)].fused_score
    assert by_id[_id(1)].dense_score == 0.9  # best score kept


def test_ties_broken_stably_by_chunk_id():
    dense = [[(_id(2), 0.5)]]
    sparse = [[(_id(1), 0.5)]]
    result = fuse(dense, sparse)  # identical fused contribution 1/(k+1)
    assert [f.chunk_id for f in result] == [_id(1), _id(2)]


def test_top_n_and_ranks():
    dense = [[(_id(i), 1.0 - i / 100) for i in range(1, 15)]]
    result = fuse(dense, [], top_n=8)
    assert len(result) == 8
    assert [f.rank for f in result] == list(range(1, 9))


def test_empty_lists_return_empty():
    assert fuse([], []) == []
    assert fuse([[]], [[]]) == []

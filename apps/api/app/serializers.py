"""Shared response-field types.

Timestamps are stored naive-UTC (Postgres `now()` in a UTC container),
but a naive ISO string is ambiguous on the wire: JavaScript's
`new Date("2026-07-09T17:14:51")` parses it as LOCAL time, skewing every
duration by the viewer's UTC offset (+7 h in WIB — the "starts at 420m"
bug). UTCDateTime serializes with an explicit +00:00 offset so every
consumer (web, SDK, MCP) parses the same instant.
"""

from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer


def as_utc(dt: datetime) -> datetime:
    """Attach UTC to naive datetimes; leave aware ones untouched."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


UTCDateTime = Annotated[
    datetime,
    PlainSerializer(lambda dt: as_utc(dt).isoformat(), return_type=str),
]

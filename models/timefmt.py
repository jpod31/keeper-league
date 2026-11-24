"""Times as coaches read them: Melbourne time, one format.

Event times (a trade offered, a notification, a chat message, a draft
finishing) are stored as naive UTC. Formatting them straight from the column
showed UTC, eleven hours behind Melbourne in summer. Everything that shows one
of those times goes through here.

Fixture and game times are a different thing: they are stored as naive
MELBOURNE wall-clock (see CLAUDE.md) and must NOT be passed to these.
"""
from datetime import timezone
from zoneinfo import ZoneInfo

MELB = ZoneInfo("Australia/Melbourne")


def to_local(dt):
    """A stored UTC datetime as an aware Melbourne datetime."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(MELB)


def clock(dt):
    """'1:03 pm'"""
    loc = to_local(dt)
    if loc is None:
        return None
    return f"{loc.hour % 12 or 12}:{loc:%M} {'am' if loc.hour < 12 else 'pm'}"


def when(dt, year=False):
    """'24 Nov, 1:03 pm' or, with year, '24 Nov 2026, 1:03 pm'"""
    loc = to_local(dt)
    if loc is None:
        return None
    day = f"{loc.day} {loc:%b}" + (f" {loc.year}" if year else "")
    return f"{day}, {clock(dt)}"


def day(dt, year=False):
    """'24 Nov' or '24 Nov 2026'"""
    loc = to_local(dt)
    if loc is None:
        return None
    return f"{loc.day} {loc:%b}" + (f" {loc.year}" if year else "")

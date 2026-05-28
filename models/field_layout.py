"""Pure helpers for laying out the squad field view.

Shared by the LIVE squad builder (blueprints/team.py) and the read-only
HISTORICAL lineup snapshot (blueprints/spa_api.py). Only genuinely identical,
side-effect-free logic lives here — the two builders are otherwise intentionally
separate (live/editable vs historical/read-only) and must NOT be merged.
"""


def calc_zone_rows(count):
    """Row sizes for a position zone with `count` slots (drives FieldView).

    e.g. 4 -> [2, 2], 7 -> [2, 3, 2]. 11+ falls back to rows of 5 then 4.
    """
    if count <= 0:
        return []
    if count <= 3:
        return [count]
    if count == 4:
        return [2, 2]
    if count == 5:
        return [3, 2]
    if count == 6:
        return [3, 3]
    if count == 7:
        return [2, 3, 2]
    if count == 8:
        return [3, 2, 3]
    if count == 9:
        return [5, 4]
    if count == 10:
        return [5, 5]
    rows = []
    remaining = count
    while remaining > 0:
        row = min(5, remaining)
        rows.append(row)
        remaining -= row
    return rows


def is_rookie(age, rating):
    """A bench player is a 'rookie' when young AND low-rated (AFL ratings doc).

    `age` may be None (live ORM objects) or 0 (historical snapshot coalesces
    missing ages to 0) — both mean "no real age" and count as not-a-rookie, so
    a truthiness check covers both call sites identically (real ages are never 0).
    """
    return bool(age) and age < 22 and rating is not None and rating < 70

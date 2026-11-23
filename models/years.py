"""Which season the numbers on screen belong to.

``config.CURRENT_YEAR`` is the season the site is in. Between the AFL draft
and Opening Round that season has no games, so every average, last-3 and
last-5 on the site still comes from the season before. ``stats_year`` is the
one answer to "which season are these scores from", so a number is never
shown without it being clear whose year it is.
"""

import time

import config

_cache = {"at": 0.0, "year": None}
_TTL = 600


def stats_year():
    """The latest AFL season with a game played (never past CURRENT_YEAR)."""
    now = time.time()
    if _cache["year"] is not None and now - _cache["at"] < _TTL:
        return _cache["year"]
    year = None
    try:
        from models.database import db, PlayerStat
        year = (db.session.query(db.func.max(PlayerStat.year))
                .filter(PlayerStat.supercoach_score.isnot(None),
                        PlayerStat.year <= config.CURRENT_YEAR)
                .scalar())
    except Exception:
        year = None
    if year is None:
        year = config.CURRENT_YEAR - 1
    _cache["year"], _cache["at"] = int(year), now
    return _cache["year"]


def reset_cache():
    _cache["year"] = None


def stats_are_last_season():
    """True while the season in play has no games yet."""
    return stats_year() < config.CURRENT_YEAR


def year_context():
    """What the frontend needs to label a score."""
    sy = stats_year()
    return {
        "afl_year": config.CURRENT_YEAR,
        "stats_year": sy,
        "stats_are_last_season": sy < config.CURRENT_YEAR,
    }

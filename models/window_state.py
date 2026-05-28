"""Date-based open/closed state for trade + delist windows.

Single source of truth so every page agrees on whether a window is open.
Avoids stale stored flags (League.trade_window_open, DelistPeriod.status) that
don't get flipped when a window's time simply passes — which left the trade /
delist / delist-bubble UI showing long after the windows had closed.

Window datetimes are stored naive; we coerce to aware-UTC before comparing,
consistent with the squad endpoint's existing handling.
"""

from datetime import datetime, timezone


def _aware(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def get_open_delist_period(league_id, year):
    """Return the league's DelistPeriod only if it is open AND currently within
    its [opens_at, closes_at) window. Guards against a stale status='open' whose
    close time has already passed. Returns None when no period is active now.
    """
    from models.database import DelistPeriod
    now = datetime.now(timezone.utc)
    dp = (DelistPeriod.query
          .filter_by(league_id=league_id, year=year, status="open")
          .first())
    if not dp:
        return None
    opens, closes = _aware(dp.opens_at), _aware(dp.closes_at)
    if opens and now < opens:
        return None
    if closes and now >= closes:
        return None
    return dp


def is_trade_window_open(league_id, year):
    """True if NOW falls inside the mid- or off-season trade window per
    SeasonConfig (date-based — matches the squad page), regardless of any stored
    flag. Both bounds of a window must be set for it to count.
    """
    from models.database import SeasonConfig
    now = datetime.now(timezone.utc)
    sc = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    if not sc:
        return False
    for o, c in ((sc.mid_trade_window_open, sc.mid_trade_window_close),
                 (sc.off_trade_window_open, sc.off_trade_window_close)):
        o, c = _aware(o), _aware(c)
        if o and c and o <= now < c:
            return True
    return False

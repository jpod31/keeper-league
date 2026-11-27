"""AFL career games, kept current (2026-11-27).

afl_player.career_games was loaded once from a CSV and never moved, so after
the 2026 season every established player read a year short (Dan Houston 189,
which is his total to the end of 2025). Lucas: "these numbers need updating".

  career games = draftguru games for every past season (finals included)
               + this season: draftguru's figure or the games in our own
                 stats feed (player_stat), whichever is higher, so the
                 number moves every week in season without a re-scrape.

refresh() is cheap (database only) and runs daily; the draftguru history
itself is re-scraped once a year after the season (scheduler).
"""

import logging
from collections import defaultdict

from models.database import db, AflPlayer, AflListHistory, PlayerStat

logger = logging.getLogger(__name__)


def refresh(year=None):
    """Recompute career_games for every player with a draftguru history.
    Returns how many changed."""
    from models.years import stats_year
    year = year or stats_year()
    history = defaultdict(dict)                 # pid -> {season: games}
    for pid, season, g in db.session.query(AflListHistory.player_id, AflListHistory.season, AflListHistory.games).filter(
            AflListHistory.player_id.isnot(None)).all():
        history[pid][season] = history[pid].get(season, 0) + (g or 0)
    this_year = dict(db.session.query(PlayerStat.player_id, db.func.count(PlayerStat.id)).filter(
        PlayerStat.year == year).group_by(PlayerStat.player_id).all())
    changed = 0
    for p in AflPlayer.query.filter(AflPlayer.id.in_(list(history) or [0])).all():
        h = history[p.id]
        total = sum(g for s, g in h.items() if s < year) + max(h.get(year, 0), this_year.get(p.id, 0))
        # never go backwards on a partial scrape
        if total > (p.career_games or 0):
            p.career_games = total
            changed += 1
    db.session.commit()
    logger.info("career games: %d players updated", changed)
    return changed

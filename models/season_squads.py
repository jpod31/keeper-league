"""Squads as they stood when each season began.

``SeasonSquad`` rows are written once per league-year and never edited:

  - a league's FIRST season: rebuilt from its initial draft (every club's
    picks are its opening list), by ``backfill_first_season``;
  - every season after: the active lists at the moment the league rolls into
    the new year, by ``snapshot_season`` (called from season_rollover).

Each row carries the player as he was on the day (club, position, age,
rating, last season's average), so the page stays true however he and the
list change afterwards.
"""

import logging
from collections import defaultdict

from models.database import (
    db, League, FantasyTeam, FantasyRoster, AflPlayer, SeasonSquad,
    DraftSession, DraftPick, AflListHistory,
)

logger = logging.getLogger(__name__)


def has_snapshot(league_id, year):
    return db.session.query(SeasonSquad.id).filter_by(
        league_id=league_id, year=year).first() is not None


def snapshot_years(league_id):
    return [y for (y,) in db.session.query(SeasonSquad.year)
            .filter_by(league_id=league_id).distinct().order_by(SeasonSquad.year.desc()).all()]


def _prev_averages(player_ids, year):
    """player_id -> average for the season before ``year``."""
    from models.database import PlayerStat
    if not player_ids:
        return {}
    rows = (db.session.query(PlayerStat.player_id, db.func.avg(PlayerStat.supercoach_score))
            .filter(PlayerStat.year == year - 1,
                    PlayerStat.supercoach_score.isnot(None),
                    PlayerStat.player_id.in_(list(player_ids)))
            .group_by(PlayerStat.player_id).all())
    return {pid: round(float(avg), 1) for pid, avg in rows if avg is not None}


def snapshot_season(league_id, year, overwrite=False):
    """Record every active list as the squad that starts ``year``.
    Returns rows written (0 if the year already has a snapshot)."""
    if has_snapshot(league_id, year):
        if not overwrite:
            return 0
        SeasonSquad.query.filter_by(league_id=league_id, year=year).delete()

    from models.player_history import league_stints
    stints = league_stints(league_id)
    rows = (db.session.query(FantasyRoster, FantasyTeam)
            .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
            .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
            .all())
    prev = _prev_averages({fr.player_id for fr, _t in rows}, year)
    written = 0
    for fr, team in rows:
        p = fr.player
        if not p:
            continue
        current = next((s for s in reversed(stints.get(p.id, []))
                        if s["is_active"] and s["team_id"] == team.id), None)
        db.session.add(SeasonSquad(
            league_id=league_id, year=year, team_id=team.id, player_id=p.id,
            afl_team=p.afl_team, position=p.position, age=p.age,
            rating=p.rating_start if p.rating_start is not None else p.rating,
            prev_avg=prev.get(p.id),
            acquired_via=fr.acquired_via or "draft",
            draft_pick=current["pick_number"] if current else None,
            draft_round=current["draft_round"] if current else None,
        ))
        written += 1
    db.session.commit()
    logger.info("League %d: %d squad snapshot written (%d players)", league_id, year, written)
    return written


def backfill_first_season(league_id, overwrite=False):
    """Rebuild the opening lists of a league's first season from its initial
    draft. Must run BEFORE the player workbook moves on a year, while
    afl_player still holds that season's age and start-of-year rating.
    Returns (year, rows) or (None, 0) when there is nothing to do.
    """
    session = (DraftSession.query
               .filter_by(league_id=league_id, draft_round_type="initial",
                          is_mock=False, status="completed")
               .order_by(DraftSession.id).first())
    if not session:
        return None, 0
    when = session.completed_at or session.started_at or session.scheduled_start
    year = when.year if when else None
    if not year:
        return None, 0
    if has_snapshot(league_id, year):
        if not overwrite:
            return year, 0
        SeasonSquad.query.filter_by(league_id=league_id, year=year).delete()

    picks = (DraftPick.query.filter_by(draft_session_id=session.id)
             .filter(DraftPick.player_id.isnot(None))
             .order_by(DraftPick.pick_number).all())
    ids = {p.player_id for p in picks}
    players = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(list(ids))).all()} if ids else {}
    prev = _prev_averages(ids, year)

    # His club that season, from list history where we have it (afl_team is
    # only ever the current club, and he may have moved since).
    club = {}
    if ids:
        for h in AflListHistory.query.filter(
                AflListHistory.season == year, AflListHistory.player_id.in_(list(ids))).all():
            club[h.player_id] = h.club

    written = 0
    for pk in picks:
        p = players.get(pk.player_id)
        if not p:
            continue
        db.session.add(SeasonSquad(
            league_id=league_id, year=year, team_id=pk.team_id, player_id=p.id,
            afl_team=club.get(p.id) or p.afl_team, position=p.position,
            age=p.age,
            rating=p.rating_start if p.rating_start is not None else p.rating,
            prev_avg=prev.get(p.id) if p.id in prev else p.sc_avg_prev,
            acquired_via="draft", draft_pick=pk.pick_number, draft_round=pk.draft_round,
        ))
        written += 1
    db.session.commit()
    logger.info("League %d: %d opening lists rebuilt from the draft (%d players)",
                league_id, year, written)
    return year, written


def season_squads(league_id, year):
    """{team_id: [player rows]} for one season's opening lists, best first."""
    rows = (SeasonSquad.query.filter_by(league_id=league_id, year=year).all())
    out = defaultdict(list)
    for r in rows:
        p = r.player
        out[r.team_id].append({
            "id": r.player_id,
            "name": p.name if p else "?",
            "afl_team": r.afl_team or "",
            "position": r.position or "",
            "age": r.age,
            "rating": r.rating,
            "prev_avg": r.prev_avg,
            "acquired_via": r.acquired_via,
            "draft_pick": r.draft_pick,
            "draft_round": r.draft_round,
            "is_former": bool(p and p.is_former),
        })
    for lst in out.values():
        lst.sort(key=lambda x: (x["draft_pick"] is None, x["draft_pick"] or 0,
                                -(x["prev_avg"] or 0)))
    return dict(out)

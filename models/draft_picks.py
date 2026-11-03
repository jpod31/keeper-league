"""Draft order and pick ownership for the supplemental drafts.

The "<year> R<n>" pick is that year's OFF-SEASON draft (held in November,
after the season it is named for). Every team holds its own picks for the
open draft plus the next two years; a trade moves ``current_owner_id``.
When the off-season draft is created, each slot goes to whoever owns that
pick, so a traded pick is used by its new owner on the night.

Order is reverse ladder (wooden spoon first), the same in every round, the
way the AFL runs its national draft.
"""

from models.database import (
    db, League, FantasyTeam, FutureDraftPick, SeasonConfig, SeasonStanding,
)

YEARS_AHEAD = 2


def reverse_ladder(league_id, year):
    """Teams worst-to-best on ``year``'s ladder. Teams with no standing row
    (nothing played yet) fall back to their draft_order, after the rest."""
    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.draft_order).all()
    rows = {
        s.team_id: s for s in SeasonStanding.query.filter_by(league_id=league_id, year=year).all()
    }
    ranked = [t for t in teams if t.id in rows]
    ranked.sort(key=lambda t: ((rows[t.id].ladder_points or 0), (rows[t.id].percentage or 0)))
    return ranked + [t for t in teams if t.id not in rows]


def ladder(league_id, year):
    """Best-to-worst, for fixture weighting."""
    return list(reversed(reverse_ladder(league_id, year)))


def pick_rounds(league):
    cfg = SeasonConfig.query.filter_by(league_id=league.id, year=league.season_year).first()
    n = cfg.offseason_draft_min_picks if cfg and cfg.offseason_draft_min_picks is not None else 4
    return max(1, n)


def first_open_year(league):
    """The earliest pick year still to be drafted."""
    from models.season_manager import offseason_draft_done
    year = league.season_year
    if league.status == "offseason" and offseason_draft_done(league.id, year):
        return year + 1
    return year


def ensure_future_picks(league_id):
    """Make sure every team holds its picks from the open draft through
    YEARS_AHEAD seasons out. Fills gaps only; never touches an existing
    pick, so traded ownership is safe. Returns how many were created."""
    league = db.session.get(League, league_id)
    if not league:
        return 0
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    start = first_open_year(league)
    rounds = pick_rounds(league)
    have = {
        (p.year, p.round_number, p.original_team_id)
        for p in FutureDraftPick.query.filter(
            FutureDraftPick.league_id == league_id,
            FutureDraftPick.year >= start,
        ).all()
    }
    created = 0
    for year in range(start, league.season_year + YEARS_AHEAD + 1):
        for team in teams:
            for rnd in range(1, rounds + 1):
                if (year, rnd, team.id) in have:
                    continue
                db.session.add(FutureDraftPick(
                    league_id=league_id, year=year, round_number=rnd,
                    original_team_id=team.id, current_owner_id=team.id,
                ))
                created += 1
    if created:
        db.session.commit()
    return created


def open_picks_query(league, owner_id=None):
    """Picks that can still change hands: not yet drafted."""
    q = FutureDraftPick.query.filter(
        FutureDraftPick.league_id == league.id,
        FutureDraftPick.year >= first_open_year(league),
        FutureDraftPick.year <= league.season_year + YEARS_AHEAD,
    )
    if owner_id is not None:
        q = q.filter(FutureDraftPick.current_owner_id == owner_id)
    return q.order_by(FutureDraftPick.year, FutureDraftPick.round_number)


def slot_owner(league_id, year, round_number, original_team_id):
    """Who uses this team's pick in this round of ``year``'s off-season draft."""
    fp = FutureDraftPick.query.filter_by(
        league_id=league_id, year=year, round_number=round_number,
        original_team_id=original_team_id,
    ).first()
    return fp.current_owner_id if fp else original_team_id

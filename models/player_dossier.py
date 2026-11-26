"""Everything about one player, for the full player page
(`/leagues/<id>/player/<pid>` in the app, data from
`/api/leagues/<id>/players/<pid>/dossier`).

Built from tables we already keep, nothing scraped on the way:
  afl_player              who he is now, role data, draft details
  player_season_rating    rating and potential each season (workbook)
  rating_log              each rating change the sync recorded
  player_stat             every AFL game since 2013
  afl_list_history        his AFL club each season, list-only years too
  state_league_stat       VFL / SANFL / WAFL and under-18 seasons
  fantasy_roster + picks  his stints with this league's clubs
  weekly_lineup / slots   where each club named him each round
  round_score.breakdown   the points he banked for the club

Only rounds the league actually played count: a round with a fixture that
is live or finished. Lineups and round scores are also saved for the AFL
finals weeks after a season ends (2026 has them for rounds 25 to 29), and
those never counted for anyone.

A round his AFL club had the bye is left out of every count too: nobody
can pick a player whose club isn't playing. Byes come from the AFL fixture
(afl_game), with his club that season from his list history.

"Named in the side" means an on-field slot (DEF, MID, FWD, RUC, FLEX): the
coach's best 22 plus the flex. Every other slot (bench, emergency, no
position) is on the list but not named.
"""

from collections import defaultdict

import config
from models.database import (
    db, AflPlayer, PlayerSeasonRating, RatingLog, PlayerStat, AflListHistory,
    StateLeagueStat, FantasyTeam, FantasyRoster, WeeklyLineup, LineupSlot, RoundScore, Fixture, AflGame,
)

ON_FIELD = {"DEF", "MID", "FWD", "RUC", "FLEX"}

# Every per-game stat we hold, in the order the page shows them.
STATS = [
    ("supercoach_score", "SC"), ("afl_fantasy_score", "AF"),
    ("disposals", "DIS"), ("kicks", "K"), ("handballs", "HB"), ("marks", "M"),
    ("goals", "G"), ("behinds", "B"), ("tackles", "T"), ("hitouts", "HO"),
    ("contested_possessions", "CP"), ("uncontested_possessions", "UP"),
    ("clearances", "CLR"), ("centre_clearances", "CC"), ("stoppage_clearances", "SC CLR"),
    ("inside_fifties", "I50"), ("rebounds", "R50"), ("metres_gained", "MG"),
    ("score_involvements", "SI"), ("goal_assists", "GA"), ("intercepts", "INT"),
    ("contested_marks", "CM"), ("marks_inside_50", "MI50"), ("ground_ball_gets", "GBG"),
    ("pressure_acts", "PA"), ("one_percenters", "1%"), ("effective_disposals", "ED"),
    ("disposal_efficiency", "DE%"), ("clangers", "CL"), ("turnovers", "TO"),
    ("frees_for", "FF"), ("frees_against", "FA"), ("bounces", "BO"),
    ("kick_ins", "KI"), ("time_on_ground_pct", "TOG%"),
]
STAT_KEYS = [k for k, _ in STATS]
STAT_NAMES = {
    "supercoach_score": "SuperCoach", "afl_fantasy_score": "AFL Fantasy", "disposals": "Disposals", "kicks": "Kicks",
    "handballs": "Handballs", "marks": "Marks", "goals": "Goals", "behinds": "Behinds", "tackles": "Tackles",
    "hitouts": "Hitouts", "contested_possessions": "Contested possessions", "uncontested_possessions": "Uncontested possessions",
    "clearances": "Clearances", "centre_clearances": "Centre clearances", "stoppage_clearances": "Stoppage clearances",
    "inside_fifties": "Inside 50s", "rebounds": "Rebound 50s", "metres_gained": "Metres gained",
    "score_involvements": "Score involvements", "goal_assists": "Goal assists", "intercepts": "Intercepts",
    "contested_marks": "Contested marks", "marks_inside_50": "Marks inside 50", "ground_ball_gets": "Ground ball gets",
    "pressure_acts": "Pressure acts", "one_percenters": "One percenters", "effective_disposals": "Effective disposals",
    "disposal_efficiency": "Disposal efficiency %", "clangers": "Clangers", "turnovers": "Turnovers",
    "frees_for": "Frees for", "frees_against": "Frees against", "bounces": "Bounces", "kick_ins": "Kick-ins",
    "time_on_ground_pct": "Time on ground %",
}


def _r1(v):
    return round(v, 1) if v is not None else None


def _avg(vals):
    vals = [v for v in vals if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def _avg_cover(vals):
    """Average of a stat over a set of games, but only when we hold it for
    at least half of them. Live feeds only carry the basic stats, so in
    2026 contested possessions exist for one game in twenty: that one game
    is not a season average."""
    have = [v for v in vals if v is not None]
    if not have or len(have) * 2 < len(vals):
        return None
    return round(sum(have) / len(have), 1)


def _bio(p):
    from models.player_photos import photo_url
    rank = None
    if p.rating is not None:
        rank = AflPlayer.query.filter(AflPlayer.listed(), AflPlayer.rating > p.rating).count() + 1
    listed_n = AflPlayer.query.filter(AflPlayer.listed()).count()
    return {
        "id": p.id, "name": p.name, "afl_team": p.afl_team or "", "position": p.position or "",
        "position_expected": bool(p.position_expected), "role": p.role, "role_detail": p.role_detail,
        "age": p.age, "dob": p.dob, "height_cm": p.height_cm, "career_games": p.career_games or 0,
        "games_played": p.games_played or 0, "sc_avg": _r1(p.sc_avg), "sc_avg_prev": _r1(p.sc_avg_prev),
        "rating": p.rating, "potential": p.potential, "rating_start": p.rating_start,
        "rating_rank": rank, "listed_count": listed_n,
        "grade": p.grade, "afl_best22": p.afl_best22, "keeper_value": _r1(p.keeper_value),
        "list_status": p.list_status or "listed", "left_afl_year": p.left_afl_year,
        "joined_year": p.joined_year,
        "draft": {"pick": p.draft_pick, "year": p.draft_year, "type": p.draft_type,
                  "father_son": p.father_son, "academy": p.academy, "international": p.international},
        "injury": ({"type": p.injury_type, "return": p.injury_return, "severity": p.injury_severity}
                   if p.injury_severity else None),
        "role_data": {"cba_pct": _r1(p.cba_pct), "cba_trend": _r1(p.cba_trend),
                      "kick_in_pct": _r1(p.kick_in_pct), "kick_in_playon_pct": _r1(p.kick_in_playon_pct),
                      "kick_ins": p.kick_ins_season},
        "photo_url": photo_url(p.name),
    }


def _ratings(p):
    rows = (PlayerSeasonRating.query.filter_by(player_id=p.id)
            .order_by(PlayerSeasonRating.season).all())
    changes = (RatingLog.query.filter_by(player_id=p.id)
               .order_by(RatingLog.changed_at).all())
    return {
        "seasons": [{"season": r.season, "rating": r.rating, "potential": r.potential} for r in rows],
        "changes": [{"at": c.changed_at.isoformat() if c.changed_at else None,
                     "old_rating": c.old_rating, "new_rating": c.new_rating,
                     "old_potential": c.old_potential, "new_potential": c.new_potential}
                    for c in changes],
    }


def _games(p):
    return (PlayerStat.query.filter_by(player_id=p.id)
            .order_by(PlayerStat.year, PlayerStat.round).all())


def _afl_clubs(p):
    rows = (AflListHistory.query
            .filter(db.or_(AflListHistory.player_id == p.id, AflListHistory.player_name == p.name))
            .order_by(AflListHistory.season).all())
    seen, out = set(), []
    for r in rows:
        k = (r.season, r.club)
        if k in seen:
            continue
        seen.add(k)
        out.append({"season": r.season, "club": r.club, "list_type": r.list_type, "games": r.games or 0})
    return out


def _seasons(games, clubs):
    by_year = defaultdict(list)
    for g in games:
        if not g.is_live:
            by_year[g.year].append(g)
    club_of = defaultdict(list)
    for c in clubs:
        club_of[c["season"]].append(c["club"])
    out = []
    for year in sorted(by_year):
        gs = by_year[year]
        row = {"year": year, "games": len(gs), "club": ", ".join(club_of.get(year, [])) or None}
        for k in STAT_KEYS:
            row[k] = _avg_cover([getattr(g, k) for g in gs])
        scs = [g.supercoach_score for g in gs if g.supercoach_score is not None]
        row["sc_max"] = max(scs) if scs else None
        row["sc_min"] = min(scs) if scs else None
        row["goals_total"] = sum(g.goals or 0 for g in gs)
        row["sc_100s"] = sum(1 for s in scs if s >= 100)
        out.append(row)
    return out


def _rounds(games):
    out = defaultdict(list)
    for g in games:
        row = {"round": g.round, "live": bool(g.is_live)}
        for k in STAT_KEYS:
            v = getattr(g, k)
            row[k] = round(v, 1) if isinstance(v, float) else v
        out[g.year].append(row)
    return {str(y): rs for y, rs in out.items()}


def _career_totals(games):
    done = [g for g in games if not g.is_live]
    scs = [g.supercoach_score for g in done if g.supercoach_score is not None]
    return {
        "games": len(done),
        "seasons": len({g.year for g in done}),
        "goals": sum(g.goals or 0 for g in done),
        "disposals": sum(g.disposals or 0 for g in done),
        "sc_avg": _avg(scs),
        "sc_best": max(scs) if scs else None,
        "sc_100s": sum(1 for s in scs if s >= 100),
        "first_year": min((g.year for g in done), default=None),
    }


def _state_league(p):
    from models.pre_afl import disposals as sl_disposals, goals as sl_goals
    rows = (StateLeagueStat.query
            .filter(db.or_(StateLeagueStat.player_id == p.id, StateLeagueStat.player_name == p.name))
            .order_by(StateLeagueStat.season.desc()).all())
    return [{"season": r.season, "competition": (r.competition or "").upper(), "team": r.team,
             "matches": r.matches, "disposals": _r1(sl_disposals(r)), "marks": _r1(r.marks),
             "goals": _r1(sl_goals(r)), "tackles": _r1(r.tackles), "hitouts": _r1(r.hitouts),
             "clearances": _r1(r.clearances), "fantasy_avg": _r1(r.dreamteam_avg)} for r in rows]


def league_rounds(league_id):
    """{(year, round)} the league has played or is playing."""
    rows = (db.session.query(Fixture.year, Fixture.afl_round)
            .filter(Fixture.league_id == league_id, Fixture.status.in_(("completed", "live")))
            .distinct().all())
    return {(y, r) for y, r in rows}


def bye_rounds(player, years):
    """{(year, round)} where his AFL club had no game. Empty for a year we
    hold no AFL fixture for."""
    out = set()
    for y in years:
        games = AflGame.query.filter_by(year=y).all()
        if not games:
            continue
        clubs = {r.club for r in AflListHistory.query.filter(
            db.or_(AflListHistory.player_id == player.id, AflListHistory.player_name == player.name),
            AflListHistory.season == y).all()} or {player.afl_team}
        rounds = {g.afl_round for g in games}
        played = {g.afl_round for g in games if g.home_team in clubs or g.away_team in clubs}
        out |= {(y, r) for r in rounds - played}
    return out


def keeper_career(league_id, player_id, sc_by_round=None):
    """His career with this league's clubs: stints, and round by round where
    he was named, with his score and what he banked.

    sc_by_round: {(year, round): SuperCoach score} for rounds he played.
    Returns {stints, rounds, seasons, totals, owner}."""
    from models.player_history import league_stints, serialise_stint

    teams = {t.id: t for t in FantasyTeam.query.filter_by(league_id=league_id).all()}
    stints = [serialise_stint(s) for s in league_stints(league_id, [player_id]).get(player_id, [])]
    owner = None
    active = (FantasyRoster.query.filter(FantasyRoster.player_id == player_id,
                                         FantasyRoster.is_active == True,  # noqa: E712
                                         FantasyRoster.team_id.in_(list(teams) or [0])).first())
    if active:
        t = teams[active.team_id]
        owner = {"team_id": t.id, "team": t.name, "logo_url": t.logo_url, "accent": t.accent}

    sc_by_round = sc_by_round or {}
    rows = (db.session.query(LineupSlot, WeeklyLineup)
            .join(WeeklyLineup, LineupSlot.lineup_id == WeeklyLineup.id)
            .filter(LineupSlot.player_id == player_id,
                    WeeklyLineup.team_id.in_(list(teams) or [0]))
            .all())
    banked = {}
    if rows:
        keys = {(w.team_id, w.year, w.afl_round) for _s, w in rows}
        years = {k[1] for k in keys}
        for rs in RoundScore.query.filter(RoundScore.team_id.in_(list(teams)),
                                          RoundScore.year.in_(list(years))).all():
            if (rs.team_id, rs.year, rs.afl_round) in keys and rs.breakdown:
                v = rs.breakdown.get(str(player_id))
                if v is not None:
                    banked[(rs.team_id, rs.year, rs.afl_round)] = v

    played = league_rounds(league_id)
    rows = [(s, w) for s, w in rows if (w.year, w.afl_round) in played]
    byes = bye_rounds(db.session.get(AflPlayer, player_id), {w.year for _s, w in rows})
    rounds = []
    for s, w in sorted(rows, key=lambda sw: (sw[1].year, sw[1].afl_round)):
        code = (s.position_code or "").upper()
        named = code in ON_FIELD
        sc = sc_by_round.get((w.year, w.afl_round))
        rounds.append({
            "year": w.year, "round": w.afl_round, "team_id": w.team_id,
            "team": teams[w.team_id].name if w.team_id in teams else None,
            "slot": code or None, "named": named,
            "captain": bool(s.is_captain), "vice_captain": bool(s.is_vice_captain),
            "emergency": bool(s.is_emergency),
            "sc": sc, "banked": banked.get((w.team_id, w.year, w.afl_round)),
            "bye": (w.year, w.afl_round) in byes,
        })

    def summary(rs):
        byes_n = sum(1 for r in rs if r["bye"])
        rs = [r for r in rs if not r["bye"]]
        named = [r for r in rs if r["named"]]
        not_named = [r for r in rs if not r["named"]]
        return {
            "rounds_on_list": len(rs),
            "named": len(named),
            "named_played": sum(1 for r in named if r["sc"] is not None),
            "not_named": len(not_named),
            "not_named_played": sum(1 for r in not_named if r["sc"] is not None),
            "captain": sum(1 for r in rs if r["captain"]),
            "vice_captain": sum(1 for r in rs if r["vice_captain"]),
            "emergency": sum(1 for r in rs if r["emergency"]),
            "avg_named": _avg([r["sc"] for r in named]),
            "avg_not_named": _avg([r["sc"] for r in not_named]),
            "banked": round(sum(r["banked"] or 0 for r in rs), 1),
            "byes": byes_n,
        }

    by_year = defaultdict(list)
    for r in rounds:
        by_year[r["year"]].append(r)
    seasons = [{"year": y, **summary(rs)} for y, rs in sorted(by_year.items())]
    return {"owner": owner, "stints": stints, "rounds": rounds,
            "seasons": seasons, "totals": summary(rounds)}


def _named_splits(league_id, player_id, games):
    """His AFL stats in rounds a coach named him vs rounds he was on a list
    but not named: every stat, not only the score."""
    teams = [t.id for t in FantasyTeam.query.filter_by(league_id=league_id).all()]
    slots = (db.session.query(LineupSlot.position_code, WeeklyLineup.year, WeeklyLineup.afl_round)
             .join(WeeklyLineup, LineupSlot.lineup_id == WeeklyLineup.id)
             .filter(LineupSlot.player_id == player_id, WeeklyLineup.team_id.in_(teams or [0])).all())
    played = league_rounds(league_id)
    slots = [(c, y, r) for c, y, r in slots if (y, r) in played]
    named = {(y, r) for code, y, r in slots if (code or "").upper() in ON_FIELD}
    listed = {(y, r) for _c, y, r in slots}
    gin = [g for g in games if (g.year, g.round) in named and not g.is_live]
    gout = [g for g in games if (g.year, g.round) in listed - named and not g.is_live]

    def block(gs):
        return {"games": len(gs), **{k: _avg_cover([getattr(g, k) for g in gs]) for k in STAT_KEYS}}
    return {"named": block(gin), "not_named": block(gout)}


def build(league_id, player_id):
    p = db.session.get(AflPlayer, player_id)
    if not p:
        return None
    from models.years import year_context
    games = _games(p)
    clubs = _afl_clubs(p)
    sc_by_round = {(g.year, g.round): g.supercoach_score for g in games
                   if g.supercoach_score is not None and not g.is_live}
    try:
        from models.player_usage import compute_player_benchmarks
        bench = compute_player_benchmarks(p.id)
    except Exception:
        bench = {"has_data": False}
    return {
        "player": _bio(p),
        "years": year_context(),
        "ratings": _ratings(p),
        "stat_labels": [{"key": k, "label": lab, "name": STAT_NAMES.get(k, lab)} for k, lab in STATS],
        "seasons": _seasons(games, clubs),
        "rounds": _rounds(games),
        "career": _career_totals(games),
        "afl_clubs": clubs,
        "state_league": _state_league(p),
        "keeper": keeper_career(league_id, p.id, sc_by_round),
        "splits": _named_splits(league_id, p.id, games),
        "benchmarks": bench,
        "current_year": config.CURRENT_YEAR,
        "honours": _honours(league_id, p.id),
    }


def _honours(league_id, player_id):
    from models.player_honours import for_player
    try:
        return for_player(league_id, player_id)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("player honours failed for %s", player_id)
        return {"emblems": [], "next": None}

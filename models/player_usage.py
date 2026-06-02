"""Per-team player usage — how a manager has actually deployed a player this
season (games for the team, captaincy, 7s, emergency call-ups, points banked),
derived from the per-round history (WeeklyLineup/LineupSlot, RoundScore,
Reserve7s*). Powers the Stats-page player drill-down (ideas #31–38).
"""

from models.database import (
    db, WeeklyLineup, RoundScore, Reserve7sLineup, Reserve7sRoundScore,
    FantasyRoster, AflPlayer,
)
from models.scoring_engine import FIELD_POSITIONS


def _primary_pos(p):
    return (p.position or "MID").split("/")[0].upper()


def compute_player_benchmarks(player_id):
    """Percentile rank of a player vs their primary-position cohort across the
    pool, on metrics already stored on AflPlayer (cheap, no CSV). Idea #9."""
    me = db.session.get(AflPlayer, player_id)
    if not me:
        return {"has_data": False}
    primary = _primary_pos(me)
    cohort = [q for q in AflPlayer.query.all() if _primary_pos(q) == primary]

    def pctile(getter, higher_better=True, positive=False):
        mine = getter(me)
        if mine is None:
            return None
        vals = [getter(q) for q in cohort]
        vals = [v for v in vals if v is not None and (v > 0 if positive else True)]
        if len(vals) < 4:
            return None
        if higher_better:
            rank = sum(1 for v in vals if v <= mine)
        else:
            rank = sum(1 for v in vals if v >= mine)
        return {"value": round(mine, 1), "percentile": round(rank / len(vals) * 100), "of": len(vals)}

    specs = [
        ("sc_avg", "SuperCoach avg", lambda q: q.sc_avg, True, True),
        ("rating", "Rating", lambda q: q.rating, True, False),
        ("potential", "Potential", lambda q: q.potential, True, False),
        ("keeper_value", "Keeper Value", lambda q: q.keeper_value, True, True),
        ("career_games", "Experience", lambda q: q.career_games, True, True),
        ("youth", "Youth (younger = higher)", lambda q: q.age, False, True),
    ]
    metrics = []
    for key, label, getter, hb, pos in specs:
        r = pctile(getter, hb, pos)
        if r:
            metrics.append({"key": key, "label": label, **r})
    return {"has_data": bool(metrics), "position": primary, "cohort": len(cohort), "metrics": metrics}


def _num(v):
    return v if isinstance(v, (int, float)) else 0.0


def compute_player_team_usage(league_id, team_id, player_id, year):
    """Walk the season's per-round history once and emit every usage counter
    for (team, player), plus a round-by-round role/score timeline."""

    lineups = (WeeklyLineup.query
               .filter_by(team_id=team_id, year=year)
               .order_by(WeeklyLineup.afl_round).all())
    rscores = {rs.afl_round: rs for rs
               in RoundScore.query.filter_by(team_id=team_id, year=year).all()}

    team_games = bench_rounds = emg_named = emg_activated = 0
    captain_games = vc_games = 0
    points_banked = captain_points = emg_points = 0.0
    timeline = []

    for wl in lineups:
        slot = next((s for s in wl.slots if s.player_id == player_id), None)
        if slot is None:
            timeline.append({"round": wl.afl_round, "role": "out", "score": None,
                             "captain": False, "vc": False})
            continue

        rs = rscores.get(wl.afl_round)
        bd = (rs.breakdown or {}) if rs else {}
        is_field = (slot.position_code or "").upper() in FIELD_POSITIONS and not slot.is_emergency
        role, score = None, None

        if slot.is_emergency:
            emg_named += 1
            em_score = bd.get(f"emergency_{player_id}")
            if slot.emergency_for is not None or em_score is not None:
                emg_activated += 1
                emg_points += _num(em_score)
                points_banked += _num(em_score)
                role, score = "emg_in", em_score
            else:
                role = "emg"
        elif is_field:
            team_games += 1
            base = bd.get(str(player_id))
            points_banked += _num(base)
            role, score = "field", base
        else:
            bench_rounds += 1
            role = "bench"

        if slot.is_captain:
            captain_games += 1
            if rs:
                captain_points += _num(rs.captain_bonus)
        if slot.is_vice_captain:
            vc_games += 1

        timeline.append({
            "round": wl.afl_round, "role": role,
            "score": round(score, 1) if isinstance(score, (int, float)) else None,
            "captain": bool(slot.is_captain), "vc": bool(slot.is_vice_captain),
        })

    # ── 7s ──
    s7 = Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=team_id, player_id=player_id, year=year).all()
    sevens_games = len(s7)
    sevens_captain = sum(1 for r in s7 if r.is_captain)
    sevens_points = 0.0
    if s7:
        s7rounds = {r.afl_round for r in s7}
        s7scores = {rs.afl_round: rs for rs
                    in Reserve7sRoundScore.query.filter_by(team_id=team_id, year=year).all()}
        for rnd in s7rounds:
            rs = s7scores.get(rnd)
            if rs and rs.breakdown:
                sevens_points += _num(rs.breakdown.get(str(player_id)))

    # ── acquisition / contribution ──
    fr = FantasyRoster.query.filter_by(team_id=team_id, player_id=player_id).first()
    team_total = sum(_num(rs.total_score) for rs in rscores.values())

    return {
        "team_games": team_games,
        "bench_rounds": bench_rounds,
        "out_rounds": sum(1 for t in timeline if t["role"] == "out"),
        "rounds_rostered": team_games + bench_rounds + emg_named,
        "captain_games": captain_games,
        "vc_games": vc_games,
        "captain_points": round(captain_points, 1),
        "emg_named": emg_named,
        "emg_activated": emg_activated,
        "emg_points": round(emg_points, 1),
        "points_banked": round(points_banked, 1),
        "contribution_pct": round(points_banked / team_total * 100, 1) if team_total > 0 else 0,
        "team_total": round(team_total, 1),
        "sevens_games": sevens_games,
        "sevens_captain": sevens_captain,
        "sevens_points": round(sevens_points, 1),
        "acquired_via": fr.acquired_via if fr else None,
        "timeline": timeline,
    }

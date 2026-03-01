"""Team analytics helpers: projections, captain recs, bye clashes, form."""

from models.database import (
    db, FantasyRoster, AflPlayer, ScScore, RoundScore, AflByeRound,
    CustomScoringRule, PlayerStat, League,
)
import config


def compute_projected_score(team_id, year, league_id):
    """Project team score based on avg of last 5 SC scores per starter."""
    starters = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True, is_benched=False
    ).all()

    total = 0
    player_projections = []
    for r in starters:
        scores = (
            ScScore.query.filter_by(player_id=r.player_id, year=year)
            .order_by(ScScore.round.desc())
            .limit(5)
            .all()
        )
        vals = [s.sc_score for s in scores if s.sc_score is not None]
        avg = sum(vals) / len(vals) if vals else (r.player.sc_avg or 0)
        total += avg
        player_projections.append({
            "player": r.player,
            "avg_last5": round(avg, 1),
            "games_scored": len(vals),
        })

    return {
        "total": round(total, 1),
        "players": sorted(player_projections, key=lambda x: x["avg_last5"], reverse=True),
    }


def captain_recommendations(team_id, year, limit=5):
    """Rank on-field players by avg score for captain picks."""
    starters = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True, is_benched=False
    ).all()

    recs = []
    for r in starters:
        scores = (
            ScScore.query.filter_by(player_id=r.player_id, year=year)
            .order_by(ScScore.round.desc())
            .limit(8)
            .all()
        )
        vals = [s.sc_score for s in scores if s.sc_score is not None]
        if not vals:
            avg = r.player.sc_avg or 0
            consistency = 0
        else:
            avg = sum(vals) / len(vals)
            mean = avg
            variance = sum((v - mean) ** 2 for v in vals) / len(vals) if len(vals) > 1 else 0
            consistency = round(100 - (variance ** 0.5), 1)

        last3 = vals[:3]
        form_avg = sum(last3) / len(last3) if last3 else avg

        recs.append({
            "player": r.player,
            "avg": round(avg, 1),
            "form_avg": round(form_avg, 1),
            "consistency": consistency,
            "is_captain": r.is_captain,
            "is_vc": r.is_vice_captain,
        })

    recs.sort(key=lambda x: x["avg"], reverse=True)
    return recs[:limit]


def detect_bye_clashes(team_id, year):
    """Find rounds where 3+ starters have byes."""
    starters = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True, is_benched=False
    ).all()

    player_teams = {r.player_id: r.player.afl_team for r in starters}

    byes = AflByeRound.query.filter_by(year=year).all()
    # Build round -> set of teams on bye
    bye_map = {}
    for b in byes:
        bye_map.setdefault(b.afl_round, set()).add(b.afl_team)

    clashes = []
    for rnd, bye_teams in sorted(bye_map.items()):
        affected = [
            {"player_id": pid, "team": team}
            for pid, team in player_teams.items()
            if team in bye_teams
        ]
        if len(affected) >= 3:
            clashes.append({
                "round": rnd,
                "count": len(affected),
                "affected": affected,
            })

    return clashes


def get_team_form(team_id, year, last_n=8):
    """Get last N round scores for form chart."""
    scores = (
        RoundScore.query.filter_by(team_id=team_id, year=year)
        .order_by(RoundScore.afl_round.asc())
        .all()
    )

    return [
        {"round": s.afl_round, "score": s.total_score}
        for s in scores[-last_n:]
    ]


def get_player_comparison_data(player_ids, year, league_id=None):
    """Build comparison data for up to 4 players."""
    players_data = []
    for pid in player_ids[:4]:
        player = db.session.get(AflPlayer, pid)
        if not player:
            continue

        # Current year scores
        scores = (
            ScScore.query.filter_by(player_id=pid, year=year)
            .order_by(ScScore.round.asc())
            .all()
        )
        sc_vals = [s.sc_score for s in scores if s.sc_score is not None]
        games = len(sc_vals)
        avg = sum(sc_vals) / games if games else (player.sc_avg or 0)
        ceiling = max(sc_vals) if sc_vals else 0
        floor = min(sc_vals) if sc_vals else 0

        last3 = sc_vals[-3:] if sc_vals else []
        last5 = sc_vals[-5:] if sc_vals else []
        l3_avg = sum(last3) / len(last3) if last3 else 0
        l5_avg = sum(last5) / len(last5) if last5 else 0

        # Consistency (lower std dev = more consistent)
        if games > 1:
            variance = sum((v - avg) ** 2 for v in sc_vals) / games
            consistency = round(100 - (variance ** 0.5), 1)
        else:
            consistency = 0

        # Detailed stats for radar
        stats = (
            PlayerStat.query.filter_by(player_id=pid, year=year)
            .order_by(PlayerStat.round.desc())
            .limit(5)
            .all()
        )
        stat_avgs = {}
        if stats:
            for col in ["kicks", "handballs", "marks", "tackles", "goals", "disposals", "clearances"]:
                vals = [getattr(s, col) or 0 for s in stats]
                stat_avgs[col] = round(sum(vals) / len(vals), 1) if vals else 0

        players_data.append({
            "player": player,
            "games": games,
            "avg": round(avg, 1),
            "l3_avg": round(l3_avg, 1),
            "l5_avg": round(l5_avg, 1),
            "ceiling": ceiling,
            "floor": floor,
            "consistency": consistency,
            "scores_by_round": [{"round": s.round, "score": s.sc_score} for s in scores if s.sc_score is not None],
            "stat_avgs": stat_avgs,
        })

    return players_data

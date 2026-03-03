"""Reserve 7s scoring engine: round scoring, standings, live scores."""

from models.database import (
    db, Reserve7sLineup, Reserve7sFixture, Reserve7sRoundScore,
    Reserve7sStanding, FantasyTeam, League, SeasonConfig,
)
from models.scoring_engine import _get_player_score


def score_7s_round(league_id, afl_round, year):
    """Score all teams' 7s lineups for a given round.

    For each team: sum scores of 7 selected players + captain bonus.
    Returns dict of {team_id: total_score}.
    """
    league = db.session.get(League, league_id)
    if not league:
        return {}

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    scores = {}

    for team in teams:
        score = _score_7s_team(
            team.id, league_id, afl_round, year,
            league.scoring_type, league.hybrid_base,
        )
        scores[team.id] = score

    db.session.commit()
    return scores


def _score_7s_team(team_id, league_id, afl_round, year, scoring_type, hybrid_base=None):
    """Score a single team's 7s lineup for a round. Returns total score.

    NOTE: Does NOT commit — caller is responsible for db.session.commit().
    """
    lineup = Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=team_id,
        afl_round=afl_round, year=year,
    ).all()

    if not lineup:
        _save_7s_round_score(team_id, afl_round, year, 0, 0, {})
        return 0

    total = 0.0
    captain_bonus = 0.0
    breakdown = {}
    captain_entry = next((e for e in lineup if e.is_captain), None)

    for entry in lineup:
        player_score = _get_player_score(
            entry.player_id, afl_round, year,
            league_id, scoring_type, hybrid_base,
        )
        if player_score is not None:
            total += player_score
            breakdown[str(entry.player_id)] = player_score
        else:
            breakdown[str(entry.player_id)] = 0

    # Captain bonus (score doubled = original + bonus)
    if captain_entry:
        cap_score = _get_player_score(
            captain_entry.player_id, afl_round, year,
            league_id, scoring_type, hybrid_base,
        )
        if cap_score is not None and cap_score > 0:
            captain_bonus = cap_score

    total += captain_bonus
    _save_7s_round_score(team_id, afl_round, year, total, captain_bonus, breakdown)
    return total


def _save_7s_round_score(team_id, afl_round, year, total, captain_bonus, breakdown):
    """Save or update a team's 7s round score.

    NOTE: Does NOT commit — caller is responsible for db.session.commit().
    """
    existing = Reserve7sRoundScore.query.filter_by(
        team_id=team_id, afl_round=afl_round, year=year,
    ).first()
    if existing:
        existing.total_score = total
        existing.captain_bonus = captain_bonus
        existing.breakdown = breakdown
    else:
        rs = Reserve7sRoundScore(
            team_id=team_id,
            afl_round=afl_round,
            year=year,
            total_score=total,
            captain_bonus=captain_bonus,
            breakdown=breakdown,
        )
        db.session.add(rs)


def recalculate_7s_standings(league_id, year):
    """Recalculate 7s standings from all completed 7s fixture results.

    4 pts per win, 2 pts per draw.
    """
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    pts_win = season_cfg.points_per_win if season_cfg else 4
    pts_draw = season_cfg.points_per_draw if season_cfg else 2

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    team_stats = {t.id: {"wins": 0, "losses": 0, "draws": 0,
                          "pf": 0.0, "pa": 0.0} for t in teams}

    fixtures = Reserve7sFixture.query.filter_by(
        league_id=league_id, year=year, status="completed", is_final=False,
    ).filter(Reserve7sFixture.afl_round > 0).all()

    for f in fixtures:
        hs = f.home_score or 0
        aws = f.away_score or 0

        if f.home_team_id not in team_stats or f.away_team_id not in team_stats:
            continue

        team_stats[f.home_team_id]["pf"] += hs
        team_stats[f.home_team_id]["pa"] += aws
        team_stats[f.away_team_id]["pf"] += aws
        team_stats[f.away_team_id]["pa"] += hs

        if hs > aws:
            team_stats[f.home_team_id]["wins"] += 1
            team_stats[f.away_team_id]["losses"] += 1
        elif aws > hs:
            team_stats[f.away_team_id]["wins"] += 1
            team_stats[f.home_team_id]["losses"] += 1
        else:
            team_stats[f.home_team_id]["draws"] += 1
            team_stats[f.away_team_id]["draws"] += 1

    for team_id, stats in team_stats.items():
        ladder_pts = stats["wins"] * pts_win + stats["draws"] * pts_draw
        percentage = (stats["pf"] / stats["pa"] * 100) if stats["pa"] > 0 else 0

        standing = Reserve7sStanding.query.filter_by(
            league_id=league_id, team_id=team_id, year=year,
        ).first()
        if not standing:
            standing = Reserve7sStanding(league_id=league_id, team_id=team_id, year=year)
            db.session.add(standing)

        standing.wins = stats["wins"]
        standing.losses = stats["losses"]
        standing.draws = stats["draws"]
        standing.points_for = round(stats["pf"], 1)
        standing.points_against = round(stats["pa"], 1)
        standing.percentage = round(percentage, 1)
        standing.ladder_points = ladder_pts

    db.session.commit()


def finalize_7s_round(league_id, afl_round, year):
    """End-of-round: score all 7s teams, resolve 7s fixtures, update 7s standings.

    Returns the scores dict {team_id: total_score}.
    """
    # Guard: don't re-score already-finalized 7s round
    fixtures = Reserve7sFixture.query.filter_by(
        league_id=league_id, afl_round=afl_round, year=year,
    ).all()
    if fixtures and all(f.status == "completed" for f in fixtures):
        teams = FantasyTeam.query.filter_by(league_id=league_id).all()
        return {
            t.id: (Reserve7sRoundScore.query.filter_by(
                team_id=t.id, afl_round=afl_round, year=year,
            ).first() or type("", (), {"total_score": 0})()).total_score
            for t in teams
        }

    # 1. Score all teams
    scores = score_7s_round(league_id, afl_round, year)

    # 2. Update 7s fixture results
    fixtures = Reserve7sFixture.query.filter_by(
        league_id=league_id, afl_round=afl_round, year=year,
    ).all()
    for f in fixtures:
        f.home_score = scores.get(f.home_team_id, 0)
        f.away_score = scores.get(f.away_team_id, 0)
        f.status = "completed"

    db.session.commit()

    # 3. Recalculate 7s standings
    recalculate_7s_standings(league_id, year)

    return scores


def get_7s_standings(league_id, year):
    """Get 7s standings sorted by ladder points, then percentage, then points for."""
    return (
        Reserve7sStanding.query
        .filter_by(league_id=league_id, year=year)
        .order_by(
            Reserve7sStanding.ladder_points.desc(),
            Reserve7sStanding.percentage.desc(),
            Reserve7sStanding.points_for.desc(),
        )
        .all()
    )


def get_7s_live_scores(league_id, afl_round, year):
    """Get current 7s round scores for all teams (for live display)."""
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    league = db.session.get(League, league_id)

    scores = {}
    for team in teams:
        rs = Reserve7sRoundScore.query.filter_by(
            team_id=team.id, afl_round=afl_round, year=year,
        ).first()

        lineup = Reserve7sLineup.query.filter_by(
            league_id=league_id, team_id=team.id,
            afl_round=afl_round, year=year,
        ).all()

        # Count how many of the 7 have played
        from models.database import PlayerStat
        player_ids = [e.player_id for e in lineup]
        played_count = 0
        if player_ids:
            stats = PlayerStat.query.filter(
                PlayerStat.player_id.in_(player_ids),
                PlayerStat.year == year,
                PlayerStat.round == afl_round,
            ).with_entities(PlayerStat.player_id).all()
            played_count = len(stats)

        captain_entry = next((e for e in lineup if e.is_captain), None)

        scores[team.id] = {
            "team_name": team.name,
            "total_score": rs.total_score if rs else 0,
            "captain_bonus": rs.captain_bonus if rs else 0,
            "players_played": played_count,
            "players_total": len(lineup),
            "captain_id": captain_entry.player_id if captain_entry else None,
        }
    return scores

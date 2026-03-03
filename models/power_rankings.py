"""Power Rankings — composite team rankings distinct from the ladder.

Factors:
  Recent form (40%)  — last 3 fixtures: W=3, D=1.5, L=0 + margin bonus
  Scoring power (35%) — average total_score across all rounds
  Strength of wins (25%) — wins vs higher-ladder teams count more
"""

import logging

from models.database import (
    db, PowerRanking, Fixture, RoundScore, SeasonStanding, FantasyTeam,
)

logger = logging.getLogger(__name__)


def compute_power_rankings(league_id, afl_round, year):
    """Compute and store power rankings for all teams after a round."""
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    if not teams:
        return

    team_ids = [t.id for t in teams]

    # ── 1. Recent form (last 3 completed fixtures) ──
    completed = (
        Fixture.query
        .filter_by(league_id=league_id, status="completed", is_final=False, year=year)
        .order_by(Fixture.afl_round.desc())
        .all()
    )

    # Build per-team recent results (last 3)
    team_recent = {tid: [] for tid in team_ids}
    for f in completed:
        if f.home_score is None or f.away_score is None:
            continue
        margin = f.home_score - f.away_score
        # Home team
        if f.home_team_id in team_recent and len(team_recent[f.home_team_id]) < 3:
            if margin > 0:
                team_recent[f.home_team_id].append(("W", margin))
            elif margin < 0:
                team_recent[f.home_team_id].append(("L", abs(margin)))
            else:
                team_recent[f.home_team_id].append(("D", 0))
        # Away team
        if f.away_team_id in team_recent and len(team_recent[f.away_team_id]) < 3:
            if margin < 0:
                team_recent[f.away_team_id].append(("W", abs(margin)))
            elif margin > 0:
                team_recent[f.away_team_id].append(("L", margin))
            else:
                team_recent[f.away_team_id].append(("D", 0))

    form_scores = {}
    for tid in team_ids:
        results = team_recent[tid]
        if not results:
            form_scores[tid] = 0.5
            continue
        pts = 0
        for result, margin in results:
            if result == "W":
                pts += 3 + min(margin / 200, 0.5)
            elif result == "D":
                pts += 1.5
        # Max possible per game = 3.5, normalise
        form_scores[tid] = pts / (len(results) * 3.5)

    # ── 2. Scoring power (avg round score) ──
    round_scores = (
        db.session.query(RoundScore.team_id, db.func.avg(RoundScore.total_score))
        .filter(RoundScore.team_id.in_(team_ids), RoundScore.year == year)
        .group_by(RoundScore.team_id)
        .all()
    )
    avg_scores = {tid: avg for tid, avg in round_scores}
    max_avg = max(avg_scores.values(), default=1)
    if max_avg <= 0:
        max_avg = 1
    scoring_power = {tid: (avg_scores.get(tid, 0) / max_avg) for tid in team_ids}

    # ── 3. Strength of wins ──
    # Get ladder positions
    standings = SeasonStanding.query.filter_by(league_id=league_id, year=year).all()
    ladder_pos = {}
    for s in standings:
        ladder_pos[s.team_id] = s
    # Sort by ladder points desc for ranking
    sorted_standings = sorted(standings, key=lambda s: (-s.ladder_points, -(s.percentage or 0)))
    position_map = {s.team_id: i + 1 for i, s in enumerate(sorted_standings)}
    num_teams = len(teams)

    sow_scores = {tid: 0.0 for tid in team_ids}
    sow_counts = {tid: 0 for tid in team_ids}
    for f in completed:
        if f.home_score is None or f.away_score is None:
            continue
        if f.home_score > f.away_score:
            # Home wins — weight by away team's ladder position
            opp_pos = position_map.get(f.away_team_id, num_teams)
            sow_scores[f.home_team_id] = sow_scores.get(f.home_team_id, 0) + (num_teams - opp_pos + 1) / num_teams
            sow_counts[f.home_team_id] = sow_counts.get(f.home_team_id, 0) + 1
        elif f.away_score > f.home_score:
            opp_pos = position_map.get(f.home_team_id, num_teams)
            sow_scores[f.away_team_id] = sow_scores.get(f.away_team_id, 0) + (num_teams - opp_pos + 1) / num_teams
            sow_counts[f.away_team_id] = sow_counts.get(f.away_team_id, 0) + 1

    strength_of_wins = {}
    for tid in team_ids:
        if sow_counts[tid] > 0:
            strength_of_wins[tid] = sow_scores[tid] / sow_counts[tid]
        else:
            strength_of_wins[tid] = 0

    # ── Composite score ──
    composite = {}
    for tid in team_ids:
        composite[tid] = (
            0.40 * form_scores.get(tid, 0)
            + 0.35 * scoring_power.get(tid, 0)
            + 0.25 * strength_of_wins.get(tid, 0)
        )

    # Sort by composite desc
    ranked = sorted(team_ids, key=lambda tid: composite[tid], reverse=True)

    # Get previous round's rankings for movement
    prev_rankings = (
        PowerRanking.query
        .filter_by(league_id=league_id, year=year, afl_round=afl_round - 1)
        .all()
    )
    prev_rank_map = {pr.team_id: pr.rank for pr in prev_rankings}

    # Delete existing rankings for this round (idempotent)
    PowerRanking.query.filter_by(
        league_id=league_id, year=year, afl_round=afl_round
    ).delete()

    # Save new rankings
    for i, tid in enumerate(ranked):
        rank = i + 1
        prev = prev_rank_map.get(tid)
        movement = (prev - rank) if prev else 0

        pr = PowerRanking(
            league_id=league_id,
            year=year,
            afl_round=afl_round,
            team_id=tid,
            rank=rank,
            score=round(composite[tid] * 100, 1),
            previous_rank=prev,
            movement=movement,
        )
        db.session.add(pr)

    db.session.commit()
    logger.info("Power rankings computed for league %d, R%d %d", league_id, afl_round, year)


def get_latest_power_rankings(league_id, year):
    """Get the most recent power rankings for a league."""
    # Find the latest round with rankings
    latest = (
        db.session.query(db.func.max(PowerRanking.afl_round))
        .filter_by(league_id=league_id, year=year)
        .scalar()
    )
    if latest is None:
        return []

    return (
        PowerRanking.query
        .filter_by(league_id=league_id, year=year, afl_round=latest)
        .order_by(PowerRanking.rank)
        .all()
    )

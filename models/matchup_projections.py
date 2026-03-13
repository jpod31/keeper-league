"""Matchup projections — projected scores and win probability for gameday."""

import math

from models.database import (
    db, FantasyRoster, AflPlayer, PlayerStat, AflGame, SeasonConfig,
)
from models.scoring_engine import _positions_compatible

FIELD_POSITIONS = {"DEF", "MID", "FWD", "RUC", "FLEX"}


def project_matchup(my_team_id, opp_team_id, afl_round, year, league_id, teams_playing):
    """Project final scores and win probability for a matchup.

    Returns {
        'my_projected': float,
        'opp_projected': float,
        'my_win_pct': float,
        'opp_win_pct': float,
    }
    """
    completed_teams = _get_completed_teams(afl_round, year)

    my_proj = _project_team(my_team_id, afl_round, year, league_id, teams_playing, completed_teams)
    opp_proj = _project_team(opp_team_id, afl_round, year, league_id, teams_playing, completed_teams)

    margin = my_proj - opp_proj
    # Sigmoid with spread factor of 120 (typical SC scores ~1200-2000 range)
    my_win_pct = 100 / (1 + math.exp(-margin / 120))
    opp_win_pct = 100 - my_win_pct

    return {
        "my_projected": round(my_proj, 0),
        "opp_projected": round(opp_proj, 0),
        "my_win_pct": round(my_win_pct, 1),
        "opp_win_pct": round(opp_win_pct, 1),
    }


def _get_completed_teams(afl_round, year):
    """Get set of AFL teams whose game is complete this round."""
    completed = set()
    for g in AflGame.query.filter_by(year=year, afl_round=afl_round).all():
        if g.status == "complete":
            completed.add(g.home_team)
            completed.add(g.away_team)
    return completed


def _project_team(team_id, afl_round, year, league_id, teams_playing, completed_teams):
    """Project total score for a team in a given round."""
    roster_entries = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True
    ).all()

    on_field = [r for r in roster_entries
                if r.position_code in FIELD_POSITIONS and not r.is_emergency]
    emergencies = [r for r in roster_entries if r.is_emergency]

    if not on_field:
        return 0

    # Batch-load all player objects (field + emergency)
    all_pids = [r.player_id for r in on_field] + [r.player_id for r in emergencies]
    players = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(all_pids)).all()}

    # Batch-load any actual stats for this round
    actual_stats = {
        ps.player_id: ps.supercoach_score
        for ps in PlayerStat.query.filter(
            PlayerStat.player_id.in_(all_pids),
            PlayerStat.round == afl_round,
            PlayerStat.year == year,
        ).all()
        if ps.supercoach_score is not None
    }

    # Captain check
    captain_entry = next((r for r in roster_entries if r.is_captain), None)
    vc_entry = next((r for r in roster_entries if r.is_vice_captain), None)

    sc = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    captain_enabled = sc.captain_scoring_enabled if sc and sc.captain_scoring_enabled is not None else True

    total = 0.0
    captain_proj = 0.0
    dnp_entries = []

    for entry in on_field:
        pid = entry.player_id
        player = players.get(pid)

        if pid in actual_stats:
            score = actual_stats[pid]
            total += score
        elif player and player.afl_team and player.afl_team in teams_playing:
            if player.afl_team in completed_teams:
                # Game finished but no stat → confirmed DNP
                dnp_entries.append(entry)
                score = None
            else:
                # Game not started or in progress — project using avg
                score = player.sc_avg or 0
                total += score
        else:
            # BYE or team not playing — no stat possible, treat as DNP
            dnp_entries.append(entry)
            score = None

        # Track captain/VC projection
        if captain_enabled and score is not None and score > 0:
            if captain_entry and captain_entry.player_id == pid:
                captain_proj = score

    # Emergency substitutions for DNP field players
    em_scores = []
    for em in emergencies:
        pid = em.player_id
        player = players.get(pid)
        if pid in actual_stats:
            em_scores.append((em, actual_stats[pid]))
        elif player and player.afl_team and player.afl_team in teams_playing:
            if player.afl_team not in completed_teams:
                em_scores.append((em, player.sc_avg or 0))
    em_scores.sort(key=lambda x: x[1], reverse=True)

    used = set()
    for entry in dnp_entries:
        for em, em_score in em_scores:
            if em.player_id in used:
                continue
            if _positions_compatible(entry, em, players):
                used.add(em.player_id)
                total += em_score
                break

    # Captain bonus
    if captain_enabled:
        if captain_proj > 0:
            total += captain_proj
        elif vc_entry:
            # Captain DNP — use VC bonus
            vc_pid = vc_entry.player_id
            vc_score = actual_stats.get(vc_pid)
            if vc_score is None:
                vc_player = players.get(vc_pid)
                if vc_player and vc_player.afl_team and vc_player.afl_team in teams_playing:
                    if vc_player.afl_team not in completed_teams:
                        vc_score = vc_player.sc_avg or 0
            if vc_score and vc_score > 0:
                total += vc_score

    return total



"""Matchup projections — projected scores and win probability for gameday."""

import math

from models.database import (
    db, FantasyRoster, AflPlayer, PlayerStat, AflGame, SeasonConfig,
)

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
    my_proj = _project_team(my_team_id, afl_round, year, league_id, teams_playing)
    opp_proj = _project_team(opp_team_id, afl_round, year, league_id, teams_playing)

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


def _project_team(team_id, afl_round, year, league_id, teams_playing):
    """Project total score for a team in a given round."""
    roster_entries = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True
    ).all()

    on_field = [r for r in roster_entries
                if r.position_code in FIELD_POSITIONS and not r.is_emergency]

    if not on_field:
        return 0

    # Batch-load all player objects
    pids = [r.player_id for r in on_field]
    players = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(pids)).all()}

    # Batch-load any actual stats for this round
    actual_stats = {
        ps.player_id: ps.supercoach_score
        for ps in PlayerStat.query.filter(
            PlayerStat.player_id.in_(pids),
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

    for entry in on_field:
        pid = entry.player_id
        player = players.get(pid)

        if pid in actual_stats:
            # Already have an actual score for this round
            score = actual_stats[pid]
        elif player and player.afl_team and player.afl_team in teams_playing:
            # Their team is playing but no score yet — project using avg
            score = player.sc_avg or 0
        else:
            # BYE or unknown
            score = 0

        total += score

        # Track captain/VC projection
        if captain_enabled:
            if captain_entry and captain_entry.player_id == pid:
                captain_proj = score
            elif vc_entry and vc_entry.player_id == pid and captain_proj == 0:
                # VC only kicks in if captain hasn't played; for projections
                # assume captain plays, so VC bonus usually 0
                pass

    # Captain bonus (double the captain's score)
    if captain_enabled and captain_proj > 0:
        total += captain_proj

    return total

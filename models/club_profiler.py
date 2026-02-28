"""League-wide team profiling and comparison."""

from __future__ import annotations

from typing import Dict, List, Optional

from models.player import Player, load_players_csv
from models.team_manager import load_teams, resolve_roster


def team_profile(roster: List[Player]) -> Dict:
    """Compute summary stats for a single keeper-league team."""
    if not roster:
        return {
            "size": 0, "avg_age": 0, "sc_mean": 0, "sc_median": 0,
            "experience": 0, "positions": {}, "top_5": [],
        }

    ages = [p.age for p in roster if p.age]
    sc_avgs = sorted([p.sc_avg for p in roster if p.sc_avg], reverse=True)
    games = [p.games for p in roster if p.games]

    # Positional breakdown
    pos_counts: Dict[str, int] = {}
    for p in roster:
        for pos in p.positions:
            pos_counts[pos] = pos_counts.get(pos, 0) + 1

    # Top 5 by SC
    top_5 = sorted(roster, key=lambda p: p.sc_avg or 0, reverse=True)[:5]

    return {
        "size": len(roster),
        "avg_age": round(sum(ages) / len(ages), 1) if ages else 0,
        "sc_mean": round(sum(sc_avgs) / len(sc_avgs), 1) if sc_avgs else 0,
        "sc_median": round(sc_avgs[len(sc_avgs) // 2], 1) if sc_avgs else 0,
        "experience": round(sum(games) / len(games), 0) if games else 0,
        "positions": pos_counts,
        "top_5": [{"name": p.name, "team": p.team, "sc_avg": p.sc_avg} for p in top_5],
    }


def all_team_profiles(master: Optional[List[Player]] = None) -> Dict[str, Dict]:
    """Build profiles for every keeper-league team."""
    if master is None:
        master = load_players_csv()

    teams = load_teams()
    profiles = {}
    for team_name in teams:
        roster = resolve_roster(team_name, master)
        profiles[team_name] = team_profile(roster)
    return profiles


def comparison_table(master: Optional[List[Player]] = None) -> List[Dict]:
    """Return a list of dicts suitable for rendering a comparison table."""
    profiles = all_team_profiles(master)
    rows = []
    for name, prof in profiles.items():
        rows.append({
            "team": name,
            "size": prof["size"],
            "avg_age": prof["avg_age"],
            "sc_mean": prof["sc_mean"],
            "sc_median": prof["sc_median"],
            "experience": prof["experience"],
            "top_player": prof["top_5"][0]["name"] if prof["top_5"] else "—",
        })
    rows.sort(key=lambda r: r["sc_mean"], reverse=True)
    return rows

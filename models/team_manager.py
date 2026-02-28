"""Squad management, best-23 selection, and future projections."""

from __future__ import annotations

import json
import os
from typing import Dict, List, Optional

from config import DATA_DIR, POSITIONS, SQUAD_SIZE, AGE_CURVE
from models.player import Player, load_players_csv


TEAMS_PATH = os.path.join(DATA_DIR, "league", "teams.json")


# ── Persistence ──────────────────────────────────────────────────────


def _ensure_league_dir():
    os.makedirs(os.path.join(DATA_DIR, "league"), exist_ok=True)


def load_teams() -> Dict[str, List[str]]:
    """Load the 6 keeper-league teams. Keys are team names, values are
    lists of player names."""
    if not os.path.exists(TEAMS_PATH):
        return {}
    with open(TEAMS_PATH, "r") as f:
        return json.load(f)


def save_teams(teams: Dict[str, List[str]]):
    _ensure_league_dir()
    with open(TEAMS_PATH, "w") as f:
        json.dump(teams, f, indent=2)


def set_team_roster(team_name: str, player_names: List[str]):
    """Set or replace a keeper-league team's roster."""
    teams = load_teams()
    teams[team_name] = player_names[:SQUAD_SIZE]
    save_teams(teams)


def add_player_to_team(team_name: str, player_name: str):
    teams = load_teams()
    roster = teams.get(team_name, [])
    if player_name not in roster and len(roster) < SQUAD_SIZE:
        roster.append(player_name)
    teams[team_name] = roster
    save_teams(teams)


def remove_player_from_team(team_name: str, player_name: str):
    teams = load_teams()
    roster = teams.get(team_name, [])
    if player_name in roster:
        roster.remove(player_name)
    teams[team_name] = roster
    save_teams(teams)


# ── Resolve names → Player objects ───────────────────────────────────


def resolve_roster(team_name: str, master: Optional[List[Player]] = None) -> List[Player]:
    """Return Player objects for a keeper-league team."""
    if master is None:
        master = load_players_csv()
    player_map = {p.name: p for p in master}
    teams = load_teams()
    names = teams.get(team_name, [])
    return [player_map[n] for n in names if n in player_map]


# ── Best 23 selection ────────────────────────────────────────────────


def select_best_23(roster: List[Player]) -> Dict[str, List[Player]]:
    """Given a full squad, pick the best on-field 23 for 6-9-6-2 formation.

    Returns a dict with keys DEF, MID, FWD, RUC (on-field) and BENCH.
    Uses a greedy approach: fill the scarcest positions first (RUC),
    then DEF/FWD, then MID.
    """
    # Bucket players by each position they can play
    buckets: Dict[str, List[Player]] = {pos: [] for pos in POSITIONS}
    for p in roster:
        for pos in p.positions:
            if pos in buckets:
                buckets[pos].append(p)

    # Sort each bucket by SC average descending
    for pos in buckets:
        buckets[pos].sort(key=lambda p: p.sc_avg or 0, reverse=True)

    selected: Dict[str, List[Player]] = {pos: [] for pos in POSITIONS}
    used = set()

    # Fill positions in scarcity order: RUC → DEF → FWD → MID
    fill_order = ["RUC", "DEF", "FWD", "MID"]
    for pos in fill_order:
        needed = POSITIONS[pos]
        for p in buckets[pos]:
            if p.name not in used and len(selected[pos]) < needed:
                selected[pos].append(p)
                used.add(p.name)

    # Bench: everyone not selected
    on_field = set()
    for pos_players in selected.values():
        for p in pos_players:
            on_field.add(p.name)

    selected["BENCH"] = [p for p in roster if p.name not in on_field]
    return selected


# ── Projections ──────────────────────────────────────────────────────


def project_sc_avg(player: Player, years_ahead: int = 1) -> float:
    """Rough projection of a player's SC average N years in the future,
    based on their age curve position and current trajectory."""
    base = player.sc_avg or 0
    if base == 0:
        return 0

    age = player.age or AGE_CURVE["peak_age"]
    future_age = age + years_ahead

    # Simple heuristic: apply trajectory for young/prime, apply decay for old
    trajectory = 0.0
    if player.sc_avg_prev is not None and player.sc_avg is not None:
        trajectory = player.sc_avg - player.sc_avg_prev

    if future_age <= AGE_CURVE["prime_end"]:
        # Still in or approaching prime: assume positive trajectory carries
        projected = base + trajectory * years_ahead * 0.5
    else:
        # Past prime: decay
        years_past_prime = future_age - AGE_CURVE["prime_end"]
        decay_rate = 0.03  # 3% per year past prime
        projected = base * (1 - decay_rate) ** years_past_prime

    return round(max(projected, 0), 1)


def team_projections(roster: List[Player], years: int = 3) -> List[Dict]:
    """Project total team SC value over the next N years."""
    projections = []
    for y in range(years + 1):
        total = sum(project_sc_avg(p, y) for p in roster)
        projections.append({"year": y, "total_sc": round(total, 1)})
    return projections


# ── Weakness analysis ────────────────────────────────────────────────


def analyse_weaknesses(roster: List[Player]) -> List[str]:
    """Identify roster weaknesses."""
    warnings = []

    # Position coverage
    pos_counts: Dict[str, int] = {pos: 0 for pos in POSITIONS}
    for p in roster:
        for pos in p.positions:
            if pos in pos_counts:
                pos_counts[pos] += 1

    for pos, needed in POSITIONS.items():
        count = pos_counts[pos]
        # Want at least 1.5x the on-field requirement for depth
        if count < needed:
            warnings.append(f"CRITICAL: Only {count} {pos} players (need {needed} on-field)")
        elif count < int(needed * 1.5):
            warnings.append(f"Low {pos} depth: {count} players for {needed} spots")

    # Aging
    old_count = sum(1 for p in roster if p.age and p.age >= 31)
    if old_count > len(roster) * 0.3:
        warnings.append(f"Aging roster: {old_count}/{len(roster)} players are 31+")

    # Low SC bench
    sorted_by_sc = sorted(roster, key=lambda p: p.sc_avg or 0)
    low_sc = [p for p in sorted_by_sc[:5] if p.sc_avg and p.sc_avg < 60]
    if low_sc:
        names = ", ".join(p.name for p in low_sc)
        warnings.append(f"Weak bench players (SC < 60): {names}")

    return warnings

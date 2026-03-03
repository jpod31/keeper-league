"""Keeper Value Index (KVI) — 0-99 score for keeper/delist decisions.

Unlike draft_score which values current production, KVI heavily favours
youth + upside over current output.  Weights:
  age_upside       35%  — young players far more valuable to keep
  rating_potential  35%  — growth gap is the key keeper signal
  trajectory        20%  — improving players are better keepers
  durability        10%  — can't keep injury-prone players
"""

import logging

from models.database import db, AflPlayer

logger = logging.getLogger(__name__)


def compute_keeper_values(player_ids: list, year: int) -> dict:
    """Batch compute KVI (0-99) for a list of player IDs.

    Returns {player_id: float} keyed by player ID.
    """
    if not player_ids:
        return {}

    players = AflPlayer.query.filter(AflPlayer.id.in_(player_ids)).all()
    result = {}

    for p in players:
        result[p.id] = _compute_single_kvi(p, year)

    return result


def _compute_single_kvi(p: AflPlayer, year: int) -> float:
    """Compute KVI for a single player."""

    # 1. Age upside (35%) — peak 18-21, gentle decay to 30, steep after
    age = p.age or 25
    raw_age = max(0, min(1, (32 - age) / 14))
    age_upside = raw_age ** 2  # Square for exponential youth premium

    # 2. Rating / Potential gap (35%)
    rating = p.rating or 60
    potential = p.potential or rating
    # Blend: 30% raw potential ceiling + 70% growth gap
    potential_norm = min(1, potential / 100)
    gap_norm = max(0, min(1, (potential - rating) / 40))
    rating_potential = 0.3 * potential_norm + 0.7 * gap_norm

    # 3. Trajectory (20%) — SC avg improvement year-over-year
    sc_avg = p.sc_avg or 0
    sc_avg_prev = p.sc_avg_prev or 0
    base = max(sc_avg_prev, 30)
    if sc_avg > 0 and sc_avg_prev > 0:
        trajectory_raw = (sc_avg - sc_avg_prev) / base
        trajectory = max(0, min(1, (trajectory_raw + 0.3) / 0.6))  # normalise ~[-0.3, +0.3] → [0, 1]
    elif sc_avg > 0:
        # First year with scores — slight positive signal
        trajectory = 0.55
    else:
        trajectory = 0.5  # neutral

    # 4. Durability (10%) — games played / expected max
    games = p.games_played or 0
    # Assume ~23 rounds as full season
    durability = min(1, games / 23) if games > 0 else 0.3

    # Weighted combination
    raw = (
        0.35 * age_upside
        + 0.35 * rating_potential
        + 0.20 * trajectory
        + 0.10 * durability
    )

    # Scale to 0-99
    return round(min(99, max(0, raw * 99)), 1)


def recompute_all_kvi(year: int):
    """Recompute KVI for ALL players and persist to DB."""
    players = AflPlayer.query.all()
    count = 0
    for p in players:
        kvi = _compute_single_kvi(p, year)
        p.keeper_value = kvi
        count += 1

    db.session.commit()
    logger.info("Recomputed KVI for %d players (year=%d)", count, year)
    return count

"""Five-factor weighted draft ranking engine."""

from __future__ import annotations

import os
from typing import List, Dict, Optional

import pandas as pd

from models.player import Player
from config import DRAFT_WEIGHTS, POSITIONAL_SCARCITY, DATA_DIR, SC_HISTORY_YEARS


def _normalise(values: List[Optional[float]]) -> List[float]:
    """Min-max normalise a list of values to 0-1.  None → 0."""
    nums = [v for v in values if v is not None]
    if not nums:
        return [0.0] * len(values)
    lo, hi = min(nums), max(nums)
    rng = hi - lo if hi != lo else 1.0
    return [(v - lo) / rng if v is not None else 0.0 for v in values]


# ── Individual factor calculators ────────────────────────────────────


def _sc_average_scores(players: List[Player]) -> List[float]:
    # Use current-year SC avg when available; fall back to previous year
    # (pre-season everyone's current avg is 0/None, so draft on last year)
    raw = [p.sc_avg if p.sc_avg else p.sc_avg_prev for p in players]
    return _normalise(raw)


def _age_factor_scores(players: List[Player]) -> List[float]:
    """Keeper league longevity: younger = more years of keeper value.

    Uses a power curve so the penalty accelerates after ~26.
    Linear base raised to the power of 1.5 means:
      18yo → 1.00,  22yo → 0.72,  25yo → 0.51,
      28yo → 0.35,  31yo → 0.21,  34yo → 0.09,  38yo → 0.00

    Note: the keeper longevity multiplier in rank_players() applies
    additional discounting for players 29+, so this curve handles
    the relative age preference while the multiplier handles absolute
    keeper value.
    """
    scores: List[float] = []
    for p in players:
        if p.age is None:
            scores.append(0.5)
            continue
        age = max(min(p.age, 38), 18)
        linear = (38 - age) / 20.0
        scores.append(linear ** 1.5)
    return scores


def _positional_scarcity_scores(players: List[Player]) -> List[float]:
    """Two-dimensional positional scarcity with per-player rank decay.

    Base scarcity per position uses two signals:
      1. Quality drop-off: elite_SC / replacement_SC
      2. Elite shortfall: what fraction of demand lacks 100+ SC players
         (captures FWD's thin elite tier vs DEF's deeper talent)

    Per-player rank decay ensures only the top players at scarce positions
    get the full boost — prevents 7 rucks flooding the top 20 when only
    the first 4-5 drafted rucks give a real positional advantage.
    """
    from config import POSITIONS, NUM_TEAMS
    import math

    ELITE_THRESHOLD = 100.0

    # Build sorted SC lists per position (dual-pos players appear in both)
    pos_sc: Dict[str, list] = {pos: [] for pos in POSITIONS}
    player_sc: Dict[int, float] = {}
    for i, p in enumerate(players):
        sc = p.sc_avg if p.sc_avg else p.sc_avg_prev
        if sc is None:
            continue
        player_sc[i] = sc
        for pos in (p.positions if p.position else []):
            if pos in pos_sc:
                pos_sc[pos].append((sc, i))

    for pos in pos_sc:
        pos_sc[pos].sort(reverse=True)

    # ── Base scarcity per position ──
    base: Dict[str, float] = {}
    for pos, slots in POSITIONS.items():
        demand = slots * NUM_TEAMS
        ranked = pos_sc[pos]
        if not ranked:
            base[pos] = 1.0
            continue

        scs = [sc for sc, _ in ranked]
        elite_sc = scs[0]
        rep_idx = min(demand - 1, len(scs) - 1)
        replacement_sc = max(scs[rep_idx], 1.0)

        # Factor A: quality drop-off ratio
        dropoff = elite_sc / replacement_sc

        # Factor B: elite shortfall — fraction of starter demand NOT met
        # by players above ELITE_THRESHOLD (100 SC)
        elite_count = sum(1 for sc in scs if sc >= ELITE_THRESHOLD)
        shortfall = max(0.0, (demand - elite_count) / demand)

        # Combined: drop-off boosted by shortfall, scaled by log(slots)
        # Floor slots at 2 so single-slot positions (RUC) don't get
        # an outsized 3x scarcity advantage over midfielders
        base[pos] = dropoff * (1.0 + 0.5 * shortfall) / math.log2(max(slots, 2) + 1)

    # Normalise base to 0-1
    max_base = max(base.values()) if base else 1.0
    if max_base > 0:
        base = {pos: val / max_base for pos, val in base.items()}

    # ── Per-player rank at their primary position ──
    pos_rank: Dict[int, int] = {}
    for pos in POSITIONS:
        for rank, (sc, idx) in enumerate(pos_sc[pos]):
            if players[idx].primary_position == pos and idx not in pos_rank:
                pos_rank[idx] = rank

    # ── Per-player scarcity with rank decay ──
    result: List[float] = []
    for i, p in enumerate(players):
        pos = p.primary_position
        b = base.get(pos, 0.3)

        if i in pos_rank:
            rank = pos_rank[i]
            demand = POSITIONS.get(pos, 5) * NUM_TEAMS
            cutoff = demand * 2  # scarcity decays over 2× starter demand
            decay = max(0.0, 1.0 - rank / cutoff)
            result.append(b * decay)
        elif i in player_sc:
            # Has SC data but wasn't ranked at primary position — rare edge case
            result.append(b * 0.5)
        else:
            # No SC data — moderate default
            result.append(b * 0.3)

    return result


def _least_squares_slope(xs: List[float], ys: List[float]) -> float:
    """Pure-Python least-squares linear regression slope."""
    n = len(xs)
    if n < 2:
        return 0.0
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den = sum((x - x_mean) ** 2 for x in xs)
    if den == 0:
        return 0.0
    return num / den


def _trajectory_scores_batch(players: List[Player]) -> List[float]:
    """Multi-year regression slope trajectory, computed in batch.

    Loads each year CSV once, builds per-player yearly averages,
    then computes least-squares slope for all players in a single pass.
    Falls back to single-year delta when only 1 year of prior data exists.

    Checks two data sources per year:
      1. sc_scores_{year}.csv (Footywire SC scores) — column: sc_score, keyed by name
      2. player_stats_{year}.csv (fitzRoy detailed stats) — column: supercoach_score, keyed by Player
    """
    # Load all available year CSVs once
    year_avgs: Dict[int, Dict[str, float]] = {}  # {year: {name: avg}}
    for year in SC_HISTORY_YEARS:
        # Source 1: Footywire SC score CSVs
        sc_path = os.path.join(DATA_DIR, f"sc_scores_{year}.csv")
        if os.path.exists(sc_path):
            df = pd.read_csv(sc_path)
            if "name" in df.columns and "sc_score" in df.columns:
                avgs = df.groupby("name")["sc_score"].mean()
                year_avgs[year] = avgs.to_dict()
                continue

        # Source 2: fitzRoy detailed stats CSVs (fallback)
        stats_path = os.path.join(DATA_DIR, f"player_stats_{year}.csv")
        if os.path.exists(stats_path):
            df = pd.read_csv(stats_path)
            # Resolve player name column
            name_col = None
            for col in ("Player", "player_name", "player"):
                if col in df.columns:
                    name_col = col
                    break
            # Resolve SC score column
            sc_col = None
            for col in ("supercoach_score", "SC", "supercoach"):
                if col in df.columns:
                    sc_col = col
                    break
            if name_col and sc_col:
                df[sc_col] = pd.to_numeric(df[sc_col], errors="coerce")
                valid = df.dropna(subset=[sc_col])
                if not valid.empty:
                    avgs = valid.groupby(name_col)[sc_col].mean()
                    year_avgs[year] = avgs.to_dict()
                    continue

        # Source 3: DB fallback (no CSVs available for this year)
        try:
            from models.database import db, PlayerStat, AflPlayer
            rows = (
                db.session.query(AflPlayer.name, PlayerStat.supercoach_score)
                .join(AflPlayer, AflPlayer.id == PlayerStat.player_id)
                .filter(PlayerStat.year == year, PlayerStat.supercoach_score.isnot(None))
                .all()
            )
            if rows:
                df = pd.DataFrame(rows, columns=["Player", "SC"])
                avgs = df.groupby("Player")["SC"].mean()
                year_avgs[year] = avgs.to_dict()
        except Exception:
            pass

    if not year_avgs:
        # No historical data at all — fall back to old single-year delta
        raw: List[Optional[float]] = []
        for p in players:
            if p.sc_avg is not None and p.sc_avg_prev is not None:
                raw.append(p.sc_avg - p.sc_avg_prev)
            else:
                raw.append(None)
        return _normalise(raw)

    # Compute slope for each player
    raw = []
    available_years = sorted(year_avgs.keys())
    for p in players:
        xs = []
        ys = []
        for year in available_years:
            avg = year_avgs[year].get(p.name)
            if avg is not None:
                xs.append(float(year))
                ys.append(avg)

        if len(xs) >= 2:
            slope = _least_squares_slope(xs, ys)
            # Dampen small samples: confidence ramps from 0.4 at 2 years to 1.0 at 5+
            confidence = min(1.0, 0.4 + (len(xs) - 2) * 0.2)
            raw.append(slope * confidence)
        elif p.sc_avg is not None and p.sc_avg_prev is not None:
            # Fallback: single-year delta
            raw.append(p.sc_avg - p.sc_avg_prev)
        elif p.sc_avg_prev is not None and len(xs) == 1:
            # Have 1 year of historical data + a prev-year average
            raw.append(ys[0] - p.sc_avg_prev)
        else:
            # No trajectory data — assume flat (neutral) rather than worst
            raw.append(0.0)

    return _normalise(raw)


def _durability_scores(players: List[Player]) -> List[float]:
    """Games played as a proportion of the maximum games played by anyone.

    Uses current-season games when available; falls back to career games
    (pre-season everyone's current-season count is 0/None).
    """
    games = [p.games_played if p.games_played else p.games for p in players]
    return _normalise(games)


def _rating_potential_scores(players: List[Player]) -> List[float]:
    """Reward high ceiling AND room to grow (potential - rating gap)."""
    scores = []
    for p in players:
        if p.rating is None and p.potential is None:
            scores.append(None)
            continue
        r = (p.rating or 50) / 100.0
        pot = (p.potential or 50) / 100.0
        growth = max(0, pot - r)  # room to improve
        # 40% ceiling (absolute potential) + 60% growth room
        scores.append(0.4 * pot + 0.6 * growth)
    return _normalise(scores)


# ── Composite score ──────────────────────────────────────────────────


FACTOR_FNS = {
    "sc_average": _sc_average_scores,
    "age_factor": _age_factor_scores,
    "positional_scarcity": _positional_scarcity_scores,
    "trajectory": _trajectory_scores_batch,
    "durability": _durability_scores,
    "rating_potential": _rating_potential_scores,
}


def rank_players(
    players: List[Player],
    weights: Optional[Dict[str, float]] = None,
) -> List[Player]:
    """Score and rank players using the 6-factor model.

    Mutates each player's draft_score and returns the list sorted desc.
    """
    if not players:
        return players

    w = weights or DRAFT_WEIGHTS

    # Compute all factor scores
    factor_scores: Dict[str, List[float]] = {}
    for name, fn in FACTOR_FNS.items():
        factor_scores[name] = fn(players)

    # Weighted composite
    raw = []
    for i, player in enumerate(players):
        score = 0.0
        for factor_name, weight in w.items():
            score += weight * factor_scores[factor_name][i]

        # Keeper longevity multiplier — in a keeper league, a 34yo with 1 year
        # left has fundamentally less value than a 23yo you keep for a decade,
        # regardless of current production. This multiplier applies on top of
        # the age factor component to enforce that.
        age = player.age
        if age is not None and age > 30:
            keeper_mult = max(0.55, 1.0 - (age - 30) * 0.08)
            score *= keeper_mult

        raw.append(score)

    # Normalise to full 0-99 range so top player isn't stuck at 60
    lo, hi = min(raw), max(raw)
    rng = hi - lo if hi != lo else 1.0
    for i, player in enumerate(players):
        player.draft_score = round(((raw[i] - lo) / rng) * 99, 1)

    players.sort(key=lambda p: p.draft_score or 0, reverse=True)
    return players


def rank_players_for_user(league_id, user_id):
    """Rank AflPlayers using the user's personal weights (fallback: league defaults).

    If the league uses custom scoring, the SC Average factor uses the league's
    custom formula to project each player's score instead of raw SC avg.

    Returns a list of (AflPlayer, score) tuples sorted by score descending.
    """
    from models.database import (
        db, AflPlayer, UserDraftWeights, LeagueDraftWeights,
        League, CustomScoringRule, PlayerStat,
    )
    from models.player import orm_to_player

    # Load user weights (fallback to league defaults)
    user_weights = UserDraftWeights.query.filter_by(
        user_id=user_id, league_id=league_id
    ).first()
    if user_weights:
        weights = user_weights.to_dict()
    else:
        league_weights = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
        weights = league_weights.to_dict() if league_weights else DRAFT_WEIGHTS

    # Load all players and convert to Player dataclass for factor functions
    afl_players = AflPlayer.query.all()
    if not afl_players:
        return []

    players = [orm_to_player(ap) for ap in afl_players]

    # For custom/hybrid leagues, override SC avg with projected score from custom rules
    league = db.session.get(League, league_id)
    if league and league.scoring_type in ("custom", "hybrid"):
        rules = CustomScoringRule.query.filter_by(league_id=league_id).all()
        if rules:
            _apply_custom_sc_projection(players, afl_players, rules)
    # For AFL Fantasy leagues, use AF averages instead of SC
    elif league and league.scoring_type == "afl_fantasy":
        _apply_af_projection(players, afl_players)

    # Rank using the standard 6-factor model with user's weights
    rank_players(players, weights)

    # Build result: map back to AflPlayer objects
    name_team_to_afl = {(ap.name, ap.afl_team): ap for ap in afl_players}
    result = []
    for p in players:
        ap = name_team_to_afl.get((p.name, p.team))
        if ap:
            result.append((ap, p.draft_score))

    return result


def _apply_custom_sc_projection(players, afl_players, rules):
    """Override each player's sc_avg with a projected score based on custom scoring rules.

    Computes: for each player, average their per-round stat totals under the custom formula.
    Falls back to existing sc_avg if no stat data exists for that player.
    """
    from models.database import PlayerStat, db
    from sqlalchemy import func

    # Build a mapping of player_id -> average custom score
    # Use the most recent year's stats
    rule_map = {r.stat_column: r.points_per for r in rules}
    stat_cols = list(rule_map.keys())

    # Get all player IDs
    id_map = {ap.id: i for i, ap in enumerate(afl_players)}

    # For efficiency, query aggregated stats per player for the latest year available
    latest_year = db.session.query(func.max(PlayerStat.year)).scalar()
    if not latest_year:
        return

    stats = PlayerStat.query.filter_by(year=latest_year).all()
    # Group by player_id, compute average custom score
    from collections import defaultdict
    player_scores = defaultdict(list)
    for stat in stats:
        total = 0.0
        for col, pts in rule_map.items():
            val = getattr(stat, col, 0) or 0
            total += val * pts
        player_scores[stat.player_id].append(total)

    # Apply averages to players
    for ap in afl_players:
        idx = id_map.get(ap.id)
        if idx is None:
            continue
        rounds = player_scores.get(ap.id)
        if rounds:
            players[idx].sc_avg = sum(rounds) / len(rounds)


def _apply_af_projection(players, afl_players):
    """Override each player's sc_avg with their AFL Fantasy average for ranking."""
    from models.database import PlayerStat, db
    from sqlalchemy import func
    from collections import defaultdict

    id_map = {ap.id: i for i, ap in enumerate(afl_players)}
    latest_year = db.session.query(func.max(PlayerStat.year)).scalar()
    if not latest_year:
        return

    stats = PlayerStat.query.filter_by(year=latest_year).all()
    player_scores = defaultdict(list)
    for stat in stats:
        if stat.afl_fantasy_score is not None:
            player_scores[stat.player_id].append(stat.afl_fantasy_score)

    for ap in afl_players:
        idx = id_map.get(ap.id)
        if idx is None:
            continue
        rounds = player_scores.get(ap.id)
        if rounds:
            players[idx].sc_avg = sum(rounds) / len(rounds)


def factor_breakdown(
    player: Player,
    players: List[Player],
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, float]:
    """Return the individual factor scores (0-1) for a single player."""
    if player not in players:
        return {}

    idx = players.index(player)
    w = weights or DRAFT_WEIGHTS
    breakdown = {}
    for name, fn in FACTOR_FNS.items():
        scores = fn(players)
        breakdown[name] = round(scores[idx], 3)
    return breakdown


def compute_historical_draft_scores(
    player: Player,
    detailed: dict,
    players: List[Player],
) -> List[Dict]:
    """Compute a draft score for each year of the player's career.

    Uses the same 6-factor model but applied retrospectively:
      - SC avg: that year's SC avg / current pool max
      - Age factor: keeper longevity (younger = better)
      - Positional scarcity: same as current (static)
      - Trajectory: SC slope using all data up to that year
      - Durability: games that year / 25, capped at 1.0
      - Rating/potential: growth ceiling (potential - rating gap)

    Returns list of {"year": int, "draft_score": float, "sc_avg": float}.
    """
    season_averages = detailed.get("season_averages", [])
    if not season_averages:
        return []

    # Current pool max SC for normalisation
    pool_max_sc = max((p.sc_avg for p in players if p.sc_avg is not None), default=1.0)
    if pool_max_sc == 0:
        pool_max_sc = 1.0

    # Positional scarcity (static across years)
    pos_score = POSITIONAL_SCARCITY.get(player.primary_position, 0.3)

    current_year = SC_HISTORY_YEARS[-1]

    results = []
    for i, season in enumerate(season_averages):
        year = season["year"]

        # SC component: that year's SC avg normalised against pool max
        sc_avg = season.get("avg_supercoach_score")
        if sc_avg is None:
            continue
        sc_score = min(sc_avg / pool_max_sc, 1.0)

        # Age component: keeper longevity (younger = better)
        if player.age is not None:
            age_that_year = player.age - (current_year - year)
        else:
            age_that_year = None

        if age_that_year is not None:
            clamped = max(min(age_that_year, 38), 18)
            age_score = ((38 - clamped) / 20.0) ** 1.5
        else:
            age_score = 0.5

        # Trajectory: SC slope using all data up to and including this year
        prior = season_averages[:i + 1]
        xs = [float(s["year"]) for s in prior if s.get("avg_supercoach_score") is not None]
        ys = [s["avg_supercoach_score"] for s in prior if s.get("avg_supercoach_score") is not None]
        if len(xs) >= 2:
            slope = _least_squares_slope(xs, ys)
            # Normalise slope: +10 pts/yr → 1.0, -10 pts/yr → 0.0
            traj_score = max(0.0, min(1.0, (slope + 10) / 20))
        else:
            traj_score = 0.5  # neutral for first year

        # Durability: games that year / 25, capped at 1.0
        games = season.get("games", 0) or 0
        dur_score = min(games / 25.0, 1.0)

        # Rating/potential component: growth ceiling (static across years)
        if player.rating is not None or player.potential is not None:
            r = (player.rating or 50) / 100.0
            pot = (player.potential or 50) / 100.0
            growth = max(0, pot - r)
            rp_score = 0.4 * pot + 0.6 * growth
        else:
            rp_score = 0.5  # neutral if no rating data

        # Weighted composite (6 factors — matches DRAFT_WEIGHTS in config.py)
        draft_score = (
            0.28 * sc_score
            + 0.22 * age_score
            + 0.12 * pos_score
            + 0.12 * traj_score
            + 0.08 * dur_score
            + 0.18 * rp_score
        )

        # Keeper longevity multiplier (matches rank_players)
        if age_that_year is not None and age_that_year > 30:
            keeper_mult = max(0.55, 1.0 - (age_that_year - 30) * 0.08)
            draft_score *= keeper_mult

        results.append({
            "year": year,
            "draft_score": draft_score,
            "sc_avg": sc_avg,
        })

    # Normalise historical scores to 0-99 range
    if results:
        raw_scores = [r["draft_score"] for r in results]
        lo, hi = min(raw_scores), max(raw_scores)
        rng = hi - lo if hi != lo else 1.0
        for r in results:
            r["draft_score"] = round(((r["draft_score"] - lo) / rng) * 99, 1)

    return results

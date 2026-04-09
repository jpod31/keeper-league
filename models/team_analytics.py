"""Team Analytics — Bayesian projection model with Monte Carlo simulation.

Statistical engine for fantasy AFL keeper league roster analysis:
  1. Bayesian true-talent estimation (prior + evidence + regression to mean)
  2. Role-aware age curves (position x height bucket, built from 8 years of data)
  3. Multi-year projections (3-year horizon using Bayesian base + age curve)
  4. Monte Carlo score simulation with credible intervals
  5. Scenario analysis (best-18, captain-down, key-injury, position-collapse)
  6. Team Health Score (0-100 composite of power, depth, balance, youth, trajectory, durability)
  7. Actionable insights engine (ranked by point impact)
  8. Full league context on every metric

Entry point: compute_deep_analytics(team_id, league_id, year, profile_tags)
Backward-compatible alias: compute_team_analytics(...)
"""

import os
import math
import logging
from collections import defaultdict

import config
from models.database import (
    db, FantasyRoster, AflPlayer, PlayerStat, RoundScore,
    FantasyTeam, Fixture, SeasonStanding,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional fast-path libraries
# ---------------------------------------------------------------------------
try:
    import numpy as np
    _HAS_NUMPY = True
except ImportError:
    import random as _random
    np = None
    _HAS_NUMPY = False
    logger.info("numpy not available — Monte Carlo will use stdlib random")

try:
    import pandas as pd
    _HAS_PANDAS = True
except ImportError:
    pd = None
    _HAS_PANDAS = False
    logger.warning("pandas not available — age curve model will be limited")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_IDEAL_FIELD = {"DEF": 5, "MID": 7, "FWD": 5, "RUC": 1}
_MC_SIMULATIONS = 2000
_MC_HISTOGRAM_BUCKETS = 20

# Regression-to-the-mean constant: games needed to trust observed avg 50/50.
# With 8 games you get ~50% weight on evidence, ~50% on prior.
_REGRESSION_K = 8

# Minimum useful std-dev when we have no games (fraction of mean)
_DEFAULT_CV = 0.28

# Tier weights for roster quality scoring (kept for backward compat)
_TIER_WEIGHTS = {
    "Elite": 10, "Elite Veteran": 9, "Premium": 8,
    "Emerging Star": 7, "Breakout": 6, "Proven": 5,
    "Steady": 3, "Developing": 2, "Project": 1,
    "Veteran": 2, "Declining": 1, "Fringe": 0, "Unclassified": 0,
}

# Position peak age ranges (inclusive)
_POS_PEAK = {
    "MID": (25, 29), "DEF": (26, 30), "FWD": (24, 28), "RUC": (26, 30),
}

# CSV column mapping
_CSV_SC_COL = "SC"
_CSV_PLAYER_COL = "Player"
_CSV_TEAM_COL = "Team"
_CSV_ROUND_COL = "Round"
_CSV_SEASON_COL = "Season"


# ═══════════════════════════════════════════════════════════════════════════
# ROLE BUCKETS — position x height classification
# ═══════════════════════════════════════════════════════════════════════════

def _role_bucket(position_str, height_cm):
    """Classify a player into one of 8 role buckets based on position and height.

    Buckets:
      small_fwd  (<188cm FWD), mid_fwd (188-194cm FWD), key_fwd (>=195cm FWD)
      small_mid  (<185cm MID), tall_mid (>=185cm MID)
      small_def  (<190cm DEF), key_def (>=190cm DEF)
      ruck       (RUC regardless of height)
    """
    pos = _primary_pos(position_str)
    h = height_cm or 185  # fallback

    if pos == "RUC":
        return "ruck"
    elif pos == "FWD":
        if h < 188:
            return "small_fwd"
        elif h < 195:
            return "mid_fwd"
        else:
            return "key_fwd"
    elif pos == "MID":
        if h < 185:
            return "small_mid"
        else:
            return "tall_mid"
    elif pos == "DEF":
        if h < 190:
            return "small_def"
        else:
            return "key_def"
    return "small_mid"  # fallback


# Peak age range per bucket (empirically reasonable for AFL)
_BUCKET_PEAK = {
    "small_fwd": (24, 28), "mid_fwd": (25, 29), "key_fwd": (26, 30),
    "small_mid": (25, 29), "tall_mid": (25, 29),
    "small_def": (26, 30), "key_def": (27, 31),
    "ruck": (27, 31),
}


# ═══════════════════════════════════════════════════════════════════════════
# PURE HELPERS (no DB access)
# ═══════════════════════════════════════════════════════════════════════════

def _primary_pos(position_str):
    """Extract primary position from 'DEF/MID' style string."""
    if not position_str:
        return "MID"
    return position_str.split("/")[0]


def _std_dev(values):
    """Population standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((v - mean) ** 2 for v in values) / len(values))


def _linear_slope(values):
    """Simple OLS slope for an ordered list of values (one per time unit)."""
    n = len(values)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    den = sum((i - x_mean) ** 2 for i in range(n))
    return num / den if den else 0.0


def _safe_div(a, b, default=0.0):
    """Safe division returning *default* when divisor is zero."""
    return a / b if b else default


def _percentile(sorted_values, pct):
    """Compute the p-th percentile from a pre-sorted list (0-100 scale)."""
    if not sorted_values:
        return 0.0
    k = (pct / 100) * (len(sorted_values) - 1)
    lo = int(math.floor(k))
    hi = min(lo + 1, len(sorted_values) - 1)
    frac = k - lo
    return sorted_values[lo] + frac * (sorted_values[hi] - sorted_values[lo])


def _clamp(val, lo, hi):
    return max(lo, min(hi, val))


def _pearson(x, y):
    """Pearson correlation coefficient for two lists of equal length."""
    n = len(x)
    if n < 3:
        return None
    mx = sum(x) / n
    my = sum(y) / n
    num = sum((a - mx) * (b - my) for a, b in zip(x, y))
    den_x = math.sqrt(sum((a - mx) ** 2 for a in x))
    den_y = math.sqrt(sum((b - my) ** 2 for b in y))
    if den_x == 0 or den_y == 0:
        return None
    return num / (den_x * den_y)


# ═══════════════════════════════════════════════════════════════════════════
# ROLE-AWARE AGE CURVES (cached at module level)
# ═══════════════════════════════════════════════════════════════════════════

_age_curve_cache = {}


def _load_historical_sc():
    """Load per-game SC from CSVs (2018-2025).

    Returns list of dicts with player, team, year, round, sc keys.
    """
    if not _HAS_PANDAS:
        return []

    records = []
    for year in range(2018, config.CURRENT_YEAR):
        path = os.path.join(config.DATA_DIR, f"player_stats_{year}.csv")
        if not os.path.exists(path):
            continue
        try:
            df = pd.read_csv(path, usecols=lambda c: c in (
                _CSV_PLAYER_COL, _CSV_TEAM_COL, _CSV_ROUND_COL,
                _CSV_SEASON_COL, _CSV_SC_COL,
            ))
            df = df.dropna(subset=[_CSV_SC_COL])
            for _, row in df.iterrows():
                records.append({
                    "player": str(row[_CSV_PLAYER_COL]).strip(),
                    "team": str(row.get(_CSV_TEAM_COL, "")).strip(),
                    "year": int(row.get(_CSV_SEASON_COL, year)),
                    "round": row.get(_CSV_ROUND_COL, 0),
                    "sc": int(row[_CSV_SC_COL]),
                })
        except Exception:
            logger.debug("Failed to load %s", path, exc_info=True)
    return records


def _build_player_yearly_avgs(records):
    """Group raw records into {player_name: {year: avg_sc}}."""
    by_player_year = defaultdict(lambda: defaultdict(list))
    for r in records:
        by_player_year[r["player"]][r["year"]].append(r["sc"])

    result = {}
    for name, years in by_player_year.items():
        result[name] = {
            y: sum(scores) / len(scores)
            for y, scores in years.items()
            if len(scores) >= 3
        }
    return result


def _build_role_aware_age_curves(records, all_players_db):
    """Build empirical age curves per role bucket (not just position).

    Uses all CSVs 2018-2025, matching to AflPlayer for height.
    Returns: {bucket: {age: avg_sc}} where bucket is one of the 8 role buckets,
    plus a legacy {pos: {age: avg_sc}} keyed by primary position.
    """
    cache_key = "role_age_curves"
    if cache_key in _age_curve_cache:
        return _age_curve_cache[cache_key]

    # Build lookup: player_name -> (role_bucket, primary_pos, current_age, height)
    player_info = {}
    for p in all_players_db:
        if p.age and p.age > 0:
            bucket = _role_bucket(p.position, p.height_cm)
            player_info[p.name] = (bucket, _primary_pos(p.position), p.age, p.height_cm or 185)

    current_year = config.CURRENT_YEAR
    player_yearly = _build_player_yearly_avgs(records)

    # Accumulate SC by (bucket, age) AND (pos, age)
    bucket_age_sc = defaultdict(lambda: defaultdict(list))
    pos_age_sc = defaultdict(lambda: defaultdict(list))

    for name, yearly in player_yearly.items():
        info = player_info.get(name)
        if not info:
            continue
        bucket, pos, cur_age, _ = info
        for year, avg_sc in yearly.items():
            age_in_year = cur_age - (current_year - year)
            if 18 <= age_in_year <= 38 and avg_sc > 0:
                bucket_age_sc[bucket][age_in_year].append(avg_sc)
                pos_age_sc[pos][age_in_year].append(avg_sc)

    def _build_curve(age_data, min_sample=5):
        """Convert {age: [scores]} to {age: avg_sc} with interpolation."""
        curve = {}
        for age in range(18, 39):
            scores = age_data.get(age, [])
            if len(scores) >= min_sample:
                curve[age] = round(sum(scores) / len(scores), 1)

        # Interpolate gaps
        ages_present = sorted(curve.keys())
        if len(ages_present) >= 2:
            for age in range(min(ages_present), max(ages_present) + 1):
                if age not in curve:
                    below = [a for a in ages_present if a < age]
                    above = [a for a in ages_present if a > age]
                    if below and above:
                        a_lo, a_hi = below[-1], above[0]
                        frac = (age - a_lo) / (a_hi - a_lo)
                        curve[age] = round(
                            curve[a_lo] + frac * (curve[a_hi] - curve[a_lo]), 1
                        )
        return curve

    # Build curves per bucket
    bucket_curves = {}
    for bucket in ("small_fwd", "mid_fwd", "key_fwd", "small_mid", "tall_mid",
                    "small_def", "key_def", "ruck"):
        bucket_curves[bucket] = _build_curve(bucket_age_sc.get(bucket, {}), min_sample=3)

    # Build legacy position-level curves (larger samples, more robust)
    pos_curves = {}
    for pos in ("DEF", "MID", "FWD", "RUC"):
        pos_curves[pos] = _build_curve(pos_age_sc.get(pos, {}), min_sample=5)

    result = {"buckets": bucket_curves, "positions": pos_curves}
    _age_curve_cache[cache_key] = result
    return result


def _get_age_curve_value(curves_dict, bucket, pos, age):
    """Get the age curve SC value, preferring bucket curve, falling back to position curve."""
    bucket_curves = curves_dict.get("buckets", {})
    pos_curves = curves_dict.get("positions", {})

    # Try bucket-specific curve first
    bc = bucket_curves.get(bucket, {})
    if age in bc:
        return bc[age]

    # Fall back to position curve
    pc = pos_curves.get(pos, {})
    if age in pc:
        return pc[age]

    return None


def _curve_peak_sc(curves_dict, bucket, pos):
    """Get the peak SC on the curve for a given bucket/pos."""
    bc = curves_dict.get("buckets", {}).get(bucket, {})
    pc = curves_dict.get("positions", {}).get(pos, {})

    # Prefer bucket curve if it has data
    curve = bc if bc else pc
    if not curve:
        return None
    return max(curve.values())


def _curve_peak_age(curves_dict, bucket, pos):
    """Get the peak age on the curve for a given bucket/pos."""
    bc = curves_dict.get("buckets", {}).get(bucket, {})
    pc = curves_dict.get("positions", {}).get(pos, {})
    curve = bc if bc else pc
    if not curve:
        return None
    return max(curve, key=curve.get)


# ═══════════════════════════════════════════════════════════════════════════
# BAYESIAN TRUE-TALENT ESTIMATION
# ═══════════════════════════════════════════════════════════════════════════

def _compute_bucket_priors(all_players_db):
    """Compute prior mean SC for each role bucket.

    Groups all AflPlayers with sc_avg > 0 into buckets and computes
    the mean SC for each bucket. This is the "prior" in the Bayesian model.

    Returns: {bucket: {"mean": float, "std": float, "n": int}}
    """
    bucket_scores = defaultdict(list)
    for p in all_players_db:
        if p.sc_avg and p.sc_avg > 0:
            bucket = _role_bucket(p.position, p.height_cm)
            bucket_scores[bucket].append(p.sc_avg)

    priors = {}
    for bucket in ("small_fwd", "mid_fwd", "key_fwd", "small_mid", "tall_mid",
                    "small_def", "key_def", "ruck"):
        scores = bucket_scores.get(bucket, [])
        if scores:
            mean = sum(scores) / len(scores)
            std = _std_dev(scores) if len(scores) >= 2 else mean * _DEFAULT_CV
            priors[bucket] = {"mean": round(mean, 1), "std": round(std, 1), "n": len(scores)}
        else:
            priors[bucket] = {"mean": 65.0, "std": 20.0, "n": 0}
    return priors


def _bayesian_estimate(prior_mean, prior_std, observed_scores, sc_avg_prev=None):
    """Compute Bayesian true-talent estimate for a single player.

    Model:
      posterior_mean = (n / (n + k)) * observed_mean + (k / (n + k)) * prior_mean
      where k = _REGRESSION_K

    For players with 0 current-year games, we use sc_avg_prev with heavier regression.

    Returns: dict with true_talent, regression_pct, observed_mean, prior_used, ceiling, floor
    """
    n = len(observed_scores)

    if n > 0:
        obs_mean = sum(observed_scores) / n
        obs_std = _std_dev(observed_scores) if n >= 2 else prior_std
        weight_evidence = n / (n + _REGRESSION_K)
        weight_prior = _REGRESSION_K / (n + _REGRESSION_K)
        true_talent = weight_evidence * obs_mean + weight_prior * prior_mean
    elif sc_avg_prev and sc_avg_prev > 0:
        # No current-year games — use last year with heavy regression
        obs_mean = sc_avg_prev
        obs_std = prior_std
        # Treat prev-year avg as equivalent to ~4 games of evidence (half weight of real games)
        equiv_games = 4
        weight_evidence = equiv_games / (equiv_games + _REGRESSION_K)
        weight_prior = _REGRESSION_K / (equiv_games + _REGRESSION_K)
        true_talent = weight_evidence * obs_mean + weight_prior * prior_mean
        n = 0
    else:
        # No data at all — pure prior
        obs_mean = 0.0
        obs_std = prior_std
        true_talent = prior_mean
        weight_prior = 1.0

    regression_pct = round(weight_prior * 100 if 'weight_prior' in dir() else 100, 1)

    # Ceiling/floor: use the posterior distribution
    # Effective std shrinks as we get more games
    effective_std = obs_std if n >= 5 else prior_std
    ceiling = round(true_talent + 1.28 * effective_std, 1)  # ~90th percentile
    floor = round(max(0, true_talent - 1.28 * effective_std), 1)  # ~10th percentile

    return {
        "true_talent": round(true_talent, 1),
        "regression_pct": regression_pct,
        "observed_mean": round(obs_mean, 1),
        "observed_std": round(obs_std, 1),
        "prior_used": round(prior_mean, 1),
        "ceiling": ceiling,
        "floor": floor,
        "games": n,
    }


# ═══════════════════════════════════════════════════════════════════════════
# MULTI-YEAR PROJECTION
# ═══════════════════════════════════════════════════════════════════════════

def _project_player_multi_year(true_talent, age, bucket, pos, curves_dict, peak_phase, trajectory):
    """Project a player's SC for years +1, +2, +3 using Bayesian base + age curve.

    Logic:
      - Find the curve's rate of change from current age to future age
      - Apply that rate to the player's personal true_talent estimate
      - Pre-peak players with positive trajectory get additional uplift
      - Post-peak players follow the curve decline

    Returns: [yr1_sc, yr2_sc, yr3_sc]
    """
    projections = []
    current_curve_val = _get_age_curve_value(curves_dict, bucket, pos, age)
    base_sc = true_talent

    for delta in (1, 2, 3):
        future_age = age + delta
        future_curve_val = _get_age_curve_value(curves_dict, bucket, pos, future_age)

        if current_curve_val and current_curve_val > 0 and future_curve_val and future_curve_val > 0:
            # Use the curve's ratio to project: player keeps their relative level
            ratio = future_curve_val / current_curve_val
            projected = base_sc * ratio
        elif peak_phase == "pre-peak" and trajectory > 0:
            # No curve data but player is improving — extrapolate trajectory with decay
            decay = 0.7 ** (delta - 1)  # trajectory effect diminishes
            projected = base_sc + trajectory * delta * decay
        elif peak_phase == "post-peak":
            # No curve data, post-peak — assume 3% decline per year
            projected = base_sc * (0.97 ** delta)
        else:
            # At peak or unknown — mild decline
            projected = base_sc * (0.99 ** delta)

        projected = max(0, round(projected, 1))
        projections.append(projected)

    return projections


# ═══════════════════════════════════════════════════════════════════════════
# MONTE CARLO SIMULATION
# ═══════════════════════════════════════════════════════════════════════════

def _get_player_game_scores(player_id, year):
    """Fetch per-game SC scores for a player from the PlayerStat table."""
    stats = (
        PlayerStat.query
        .filter_by(player_id=player_id, year=year)
        .filter(PlayerStat.round > 0, PlayerStat.supercoach_score.isnot(None))
        .order_by(PlayerStat.round)
        .all()
    )
    return [s.supercoach_score for s in stats]


def _get_player_csv_scores(player_name, year):
    """Fall back to CSV data if the DB has insufficient games."""
    if not _HAS_PANDAS:
        return []
    path = os.path.join(config.DATA_DIR, f"player_stats_{year}.csv")
    if not os.path.exists(path):
        return []
    try:
        df = pd.read_csv(path, usecols=[_CSV_PLAYER_COL, _CSV_SC_COL])
        df = df.dropna(subset=[_CSV_SC_COL])
        mask = df[_CSV_PLAYER_COL].str.strip() == player_name
        return df.loc[mask, _CSV_SC_COL].astype(int).tolist()
    except Exception:
        logger.debug("Failed to load CSV scores for %s/%s", player_name, year, exc_info=True)
        return []


def _run_monte_carlo(player_distributions, n_sims=_MC_SIMULATIONS):
    """Run Monte Carlo simulation of team totals.

    Args:
        player_distributions: list of (mean, std_dev) tuples for each field player.
                              Uses Bayesian true-talent as mean.
        n_sims: number of simulations

    Returns:
        dict with p10, p25, p50, p75, p90, distribution (histogram), labels
    """
    if not player_distributions:
        return {
            "mc_p10": 0, "mc_p25": 0, "mc_p50": 0, "mc_p75": 0, "mc_p90": 0,
            "mc_distribution": [], "mc_labels": [],
        }

    if _HAS_NUMPY:
        rng = np.random.default_rng(seed=42)
        totals = np.zeros(n_sims)
        for mean, std in player_distributions:
            if std > 0:
                scores = rng.normal(mean, std, n_sims)
                scores = np.maximum(scores, 0)
            else:
                scores = np.full(n_sims, mean)
            totals += scores
        p10 = float(np.percentile(totals, 10))
        p25 = float(np.percentile(totals, 25))
        p50 = float(np.percentile(totals, 50))
        p75 = float(np.percentile(totals, 75))
        p90 = float(np.percentile(totals, 90))
        totals_list = totals.tolist()
    else:
        _random.seed(42)
        totals_list = []
        for _ in range(n_sims):
            total = 0
            for mean, std in player_distributions:
                if std > 0:
                    score = max(0, _random.gauss(mean, std))
                else:
                    score = mean
                total += score
            totals_list.append(total)
        totals_list.sort()
        p10 = _percentile(totals_list, 10)
        p25 = _percentile(totals_list, 25)
        p50 = _percentile(totals_list, 50)
        p75 = _percentile(totals_list, 75)
        p90 = _percentile(totals_list, 90)

    # Build histogram
    if totals_list:
        lo = min(totals_list)
        hi = max(totals_list)
        if hi == lo:
            hi = lo + 1
        bucket_width = (hi - lo) / _MC_HISTOGRAM_BUCKETS
        hist = [0] * _MC_HISTOGRAM_BUCKETS
        labels = []
        for i in range(_MC_HISTOGRAM_BUCKETS):
            edge_lo = lo + i * bucket_width
            edge_hi = lo + (i + 1) * bucket_width
            labels.append(f"{edge_lo:.0f}-{edge_hi:.0f}")
            for v in totals_list:
                if edge_lo <= v < edge_hi or (i == _MC_HISTOGRAM_BUCKETS - 1 and v == hi):
                    hist[i] += 1
    else:
        hist, labels = [], []

    return {
        "mc_p10": round(p10, 1),
        "mc_p25": round(p25, 1),
        "mc_p50": round(p50, 1),
        "mc_p75": round(p75, 1),
        "mc_p90": round(p90, 1),
        "mc_distribution": hist,
        "mc_labels": labels,
    }


# ═══════════════════════════════════════════════════════════════════════════
# REPLACEMENT LEVELS (VORP)
# ═══════════════════════════════════════════════════════════════════════════

def _compute_replacement_levels():
    """Compute replacement-level SC per position (25th percentile of players with sc_avg > 0)."""
    all_players = AflPlayer.query.filter(AflPlayer.sc_avg > 0).all()
    pos_scores = defaultdict(list)
    for p in all_players:
        pos = _primary_pos(p.position)
        pos_scores[pos].append(p.sc_avg)

    levels = {}
    for pos in ("DEF", "MID", "FWD", "RUC"):
        scores = sorted(pos_scores.get(pos, []))
        levels[pos] = round(_percentile(scores, 25), 1) if scores else 0.0
    return levels


# ═══════════════════════════════════════════════════════════════════════════
# AFL TEAM EXPOSURE
# ═══════════════════════════════════════════════════════════════════════════

def _compute_team_exposure(field_players, total_field):
    """Count field players per AFL team and flag over-exposure."""
    team_counts = defaultdict(lambda: {"count": 0, "players": []})
    for p in field_players:
        team_name = p.afl_team or "Unknown"
        team_counts[team_name]["count"] += 1
        team_counts[team_name]["players"].append(p.name)

    for team in team_counts:
        team_counts[team]["pct"] = round(
            team_counts[team]["count"] / max(total_field, 1) * 100, 1
        )

    if team_counts:
        max_team = max(team_counts, key=lambda t: team_counts[t]["count"])
        max_exposure = {"team": max_team, "count": team_counts[max_team]["count"]}
    else:
        max_exposure = {"team": "None", "count": 0}

    return dict(team_counts), max_exposure


# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

def _compute_scenarios(field_players, bayesian_map, roster_map, all_players_on_team,
                       replacement_levels):
    """Compute scenario analysis: best-18, captain-down, key-injury, position-collapse.

    Args:
        field_players: list of AflPlayer on field
        bayesian_map: {player_id: bayesian_estimate_dict}
        roster_map: {player_id: FantasyRoster}
        all_players_on_team: list of all AflPlayer (field + bench)
        replacement_levels: {pos: replacement_sc}

    Returns: scenarios dict
    """
    # Use ACTUAL sc_avg for scenarios (not Bayesian — users see real numbers)
    all_estimates = []
    for p in all_players_on_team:
        sc = p.sc_avg or p.sc_avg_prev or 0
        all_estimates.append((p, sc))

    # Sort by SC descending
    all_estimates.sort(key=lambda x: -x[1])

    # Current team total (field players only, using actual averages)
    field_ids = {p.id for p in field_players}
    current_total = sum(p.sc_avg or 0 for p in field_players)

    # --- Best 18 ---
    best_18 = all_estimates[:18]
    best_18_total = round(sum(tt for _, tt in best_18), 1)

    # --- Captain down ---
    # Find the captain
    captain = None
    captain_sc = 0
    for p in field_players:
        r = roster_map.get(p.id)
        if r and r.is_captain:
            captain = p
            captain_sc = bayesian_map.get(p.id, {}).get("true_talent", p.sc_avg or 0)
            break

    if captain is None and field_players:
        # No captain set — use highest scorer
        best_field = max(field_players,
                         key=lambda p: bayesian_map.get(p.id, {}).get("true_talent", 0))
        captain = best_field
        captain_sc = bayesian_map.get(best_field.id, {}).get("true_talent", 0)

    # Captain bonus is typically 2x score, so losing captain = losing their score once
    # (they still play, just not as captain). The "captain down" scenario means
    # what if your captain scores 0 (injured) — team loses their full contribution
    # plus the captain bonus (their score again).
    if captain:
        # Score without captain at all + best bench player subbing in
        bench_subs = [(p, bayesian_map.get(p.id, {}).get("true_talent", 0))
                      for p in all_players_on_team if p.id not in field_ids]
        bench_subs.sort(key=lambda x: -x[1])
        sub_sc = bench_subs[0][1] if bench_subs else 0
        captain_down_score = round(current_total - captain_sc + sub_sc, 1)
        captain_down_drop = round(current_total - captain_down_score, 1)
    else:
        captain_down_score = round(current_total, 1)
        captain_down_drop = 0.0

    # --- Key injuries (top 3 players) ---
    field_by_sc = sorted(field_players,
                         key=lambda p: bayesian_map.get(p.id, {}).get("true_talent", 0),
                         reverse=True)
    key_injuries = []
    bench_sorted = sorted(
        [p for p in all_players_on_team if p.id not in field_ids],
        key=lambda p: bayesian_map.get(p.id, {}).get("true_talent", 0),
        reverse=True
    )

    for i, p in enumerate(field_by_sc[:3]):
        p_sc = bayesian_map.get(p.id, {}).get("true_talent", p.sc_avg or 0)
        # Best available bench player (not already used as sub in previous scenario)
        sub_sc = 0
        if i < len(bench_sorted):
            sub_sc = bayesian_map.get(bench_sorted[i].id, {}).get("true_talent", 0)
        score_without = round(current_total - p_sc + sub_sc, 1)
        key_injuries.append({
            "name": p.name,
            "team_score_without": score_without,
            "drop": round(current_total - score_without, 1),
        })

    # --- Position collapse (each position group drops 15%) ---
    pos_totals = defaultdict(float)
    for p in field_players:
        ppos = _primary_pos(p.position)
        pos_totals[ppos] += bayesian_map.get(p.id, {}).get("true_talent", p.sc_avg or 0)

    position_collapse = {}
    for pos in ("DEF", "MID", "FWD", "RUC"):
        pos_sc = pos_totals.get(pos, 0)
        drop = round(pos_sc * 0.15, 1)
        position_collapse[pos] = {
            "score": round(current_total - drop, 1),
            "drop": drop,
        }

    return {
        "best_18": best_18_total,
        "best_18_delta": round(best_18_total - current_total, 1),
        "captain_down": {
            "score": captain_down_score,
            "drop": captain_down_drop,
            "captain": captain.name if captain else "None",
        },
        "key_injuries": key_injuries,
        "position_collapse": position_collapse,
        "current_total": round(current_total, 1),
    }


# ═══════════════════════════════════════════════════════════════════════════
# TEAM HEALTH SCORE
# ═══════════════════════════════════════════════════════════════════════════

def _compute_health_score(field_players, bench_players, bayesian_map, profile_tags,
                          league_team_totals, replacement_levels):
    """Compute a single 0-100 Team Health Score and its 6 components.

    Components (weights):
      - Scoring power (30%): Bayesian team total vs league average
      - Depth (20%): scoring drop from best 18 to actual lineup
      - Balance (15%): positional coverage
      - Youth (15%): proportion of pre-peak players
      - Trajectory (10%): average trajectory of field players
      - Durability (10%): average games/season

    Each component is scored 0-100, then weighted.
    """
    total_field = len(field_players)
    all_on_roster = list(field_players) + list(bench_players)

    # --- Power (30%) --- use actual SC averages, not Bayesian
    team_total = sum(p.sc_avg or 0 for p in field_players)
    if league_team_totals:
        league_avg_total = sum(league_team_totals.values()) / len(league_team_totals)
        league_max_total = max(league_team_totals.values())
        league_min_total = min(league_team_totals.values())
        spread = league_max_total - league_min_total if league_max_total > league_min_total else 1
        # Score: 50 at league average, 100 at league max, 0 at league min
        power_raw = (team_total - league_min_total) / spread * 100
    else:
        power_raw = 50.0
    power = _clamp(power_raw, 0, 100)

    # --- Depth (20%) ---
    # Best 18 from full roster vs actual field
    all_estimates = sorted(
        [(p, bayesian_map.get(p.id, {}).get("true_talent", p.sc_avg or 0)) for p in all_on_roster],
        key=lambda x: -x[1]
    )
    best_18_total = sum(tt for _, tt in all_estimates[:18])
    if best_18_total > 0:
        depth_ratio = team_total / best_18_total
        # If actual == best18, depth = 100. If actual is 80% of best18, depth ~ 0
        depth = _clamp((depth_ratio - 0.80) / 0.20 * 100, 0, 100)
    else:
        depth = 50.0

    # --- Balance (15%) ---
    pos_counts = defaultdict(int)
    for p in field_players:
        pos_counts[_primary_pos(p.position)] += 1

    balance_score = 0
    for pos, ideal in _IDEAL_FIELD.items():
        actual = pos_counts.get(pos, 0)
        if actual >= ideal:
            balance_score += 25  # each position worth 25 points
        elif actual > 0:
            balance_score += 25 * (actual / ideal)
    balance = _clamp(balance_score, 0, 100)

    # --- Youth (15%) ---
    pre_peak_count = 0
    for p in field_players:
        t = profile_tags.get(p.id, {})
        if t.get("peak_phase") == "pre-peak":
            pre_peak_count += 1
    # Ideal: 25-40% pre-peak. Below 15% is bad, above 50% means too raw.
    if total_field > 0:
        youth_pct = pre_peak_count / total_field
        if youth_pct < 0.15:
            youth = youth_pct / 0.15 * 60  # aging roster
        elif youth_pct <= 0.45:
            youth = 60 + (youth_pct - 0.15) / 0.30 * 40  # sweet spot
        else:
            youth = max(40, 100 - (youth_pct - 0.45) / 0.25 * 60)  # too raw
    else:
        youth = 50.0
    youth = _clamp(youth, 0, 100)

    # --- Trajectory (10%) ---
    trajectories = [profile_tags.get(p.id, {}).get("trajectory", 0) for p in field_players]
    if trajectories:
        avg_traj = sum(trajectories) / len(trajectories)
        # Range roughly -10 to +10. 0 is neutral (50), +5 is great (100), -5 is bad (0)
        traj_score = 50 + avg_traj * 10
    else:
        traj_score = 50.0
    traj_score = _clamp(traj_score, 0, 100)

    # --- Durability (10%) ---
    durabilities = [profile_tags.get(p.id, {}).get("durability", 18) for p in field_players]
    if durabilities:
        avg_dur = sum(durabilities) / len(durabilities)
        # 22 games/yr is perfect (100), 15 is mediocre (50), 10 is terrible (0)
        dur_score = (avg_dur - 10) / 12 * 100
    else:
        dur_score = 50.0
    dur_score = _clamp(dur_score, 0, 100)

    # --- Composite ---
    health = (
        power * 0.30 +
        depth * 0.20 +
        balance * 0.15 +
        youth * 0.15 +
        traj_score * 0.10 +
        dur_score * 0.10
    )

    return {
        "health_score": round(health, 1),
        "health_components": {
            "power": round(power, 1),
            "depth": round(depth, 1),
            "balance": round(balance, 1),
            "youth": round(youth, 1),
            "trajectory": round(traj_score, 1),
            "durability": round(dur_score, 1),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# INSIGHTS ENGINE
# ═══════════════════════════════════════════════════════════════════════════

def _generate_insights(field_players, bench_players, bayesian_map, profile_tags,
                       replacement_levels, scenarios, projections_by_player,
                       pos_breakdown, league_team_totals, team_id):
    """Generate specific, ranked recommendations sorted by point impact.

    Insight types:
      - "warning": something is hurting the team
      - "opportunity": an action that could improve the team
      - "strength": something the team does well

    Each insight has a numeric 'impact' (estimated weekly SC points affected).
    """
    insights = []
    total_field = len(field_players)
    if total_field == 0:
        return insights

    team_total = sum(p.sc_avg or 0 for p in field_players)

    # 1. Weakest link analysis
    field_by_sc = sorted(
        field_players,
        key=lambda p: p.sc_avg or 0
    )
    for p in field_by_sc[:3]:
        pos = _primary_pos(p.position)
        tt = bayesian_map.get(p.id, {}).get("true_talent", 0)
        repl = replacement_levels.get(pos, 0)
        gap = tt - repl
        if gap < 10:
            # Find ideal draft target age range
            peak_lo, peak_hi = _POS_PEAK.get(pos, (25, 29))
            target_age_lo = peak_lo - 3
            target_age_hi = peak_lo
            insights.append({
                "type": "warning",
                "title": f"{p.name} is your weakest link at {pos}",
                "detail": (f"Bayesian estimate {tt:.0f} SC is only {gap:+.0f} above replacement level "
                           f"({repl:.0f}). Target a {pos} aged {target_age_lo}-{target_age_hi} in the draft."),
                "impact": round(abs(gap), 1),
            })

    # 2. Top-heavy dependency
    if total_field >= 5:
        top3_sc = sum(
            bayesian_map.get(p.id, {}).get("true_talent", 0)
            for p in sorted(field_players,
                            key=lambda p: bayesian_map.get(p.id, {}).get("true_talent", 0),
                            reverse=True)[:3]
        )
        dependency_pct = round(top3_sc / team_total * 100, 1) if team_total > 0 else 0
        if dependency_pct > 25:
            captain = scenarios.get("captain_down", {})
            cap_name = captain.get("captain", "your captain")
            cap_drop = captain.get("drop", 0)
            insights.append({
                "type": "warning",
                "title": f"Top-3 dependency: {dependency_pct}% of scoring",
                "detail": (f"Your team is heavily reliant on your top 3 scorers. "
                           f"If {cap_name} misses, you drop {cap_drop:.0f} points."),
                "impact": round(cap_drop * 0.1, 1),  # weight by probability
            })

    # 3. Aging roster warnings
    post_peak_players = []
    for p in field_players:
        t = profile_tags.get(p.id, {})
        if t.get("peak_phase") == "post-peak":
            proj = projections_by_player.get(p.id, {})
            yr1 = proj.get("yr1", bayesian_map.get(p.id, {}).get("true_talent", 0))
            current = bayesian_map.get(p.id, {}).get("true_talent", 0)
            drop = current - yr1
            if drop > 2:
                post_peak_players.append((p, drop))

    post_peak_players.sort(key=lambda x: -x[1])
    for p, drop in post_peak_players[:3]:
        insights.append({
            "type": "opportunity",
            "title": f"Consider trading {p.name} (post-peak)",
            "detail": (f"Projected to drop {drop:.0f} SC next year. "
                       f"Current Bayesian estimate: {bayesian_map.get(p.id, {}).get('true_talent', 0):.0f}."),
            "impact": round(drop, 1),
        })

    # 4. Underperforming players (actual << Bayesian estimate, might bounce back)
    for p in field_players:
        est = bayesian_map.get(p.id, {})
        tt = est.get("true_talent", 0)
        raw = p.sc_avg or 0
        if raw > 0 and tt > raw + 8 and est.get("games", 0) <= 6:
            insights.append({
                "type": "strength",
                "title": f"{p.name} is better than their current average",
                "detail": (f"Raw avg {raw:.0f} but Bayesian estimate {tt:.0f} "
                           f"(only {est.get('games', 0)} games — small sample regressed to prior). "
                           f"Expect improvement toward {tt:.0f}."),
                "impact": round(tt - raw, 1),
            })

    # 5. Depth advantage or weakness
    best_18_delta = scenarios.get("best_18_delta", 0)
    if best_18_delta > 20:
        insights.append({
            "type": "warning",
            "title": f"Lineup not optimised ({best_18_delta:.0f} below best 18)",
            "detail": "Your best possible 18 outscores your current lineup significantly. Check bench.",
            "impact": round(best_18_delta, 1),
        })
    elif best_18_delta < 5 and total_field >= 18:
        insights.append({
            "type": "strength",
            "title": "Lineup is well-optimised",
            "detail": f"Only {best_18_delta:.0f} SC separates your lineup from your theoretical best 18.",
            "impact": 0,
        })

    # 6. Position weakness
    for pos, ideal in _IDEAL_FIELD.items():
        pd_entry = pos_breakdown.get(pos, {})
        actual = pd_entry.get("count", 0)
        if actual < ideal:
            avg_pos_sc = pd_entry.get("avg_sc", 0)
            insights.append({
                "type": "warning",
                "title": f"{pos} is under-staffed ({actual}/{ideal})",
                "detail": f"Only {actual} {pos}s on field (ideal: {ideal}). Average SC: {avg_pos_sc:.0f}.",
                "impact": round((ideal - actual) * replacement_levels.get(pos, 50), 1),
            })

    # 7. League context
    if league_team_totals:
        leader_total = max(league_team_totals.values())
        if team_total < leader_total:
            gap = leader_total - team_total
            if gap > 50:
                insights.append({
                    "type": "opportunity",
                    "title": f"{gap:.0f} SC behind the league leader",
                    "detail": f"Your total ({team_total:.0f}) is {gap:.0f} below the leader ({leader_total:.0f}). Target roster upgrades.",
                    "impact": round(gap / total_field, 1),
                })

    # Sort by impact descending
    insights.sort(key=lambda x: -x["impact"])
    return insights


# ═══════════════════════════════════════════════════════════════════════════
# LEAGUE CONTEXT HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _compute_league_context(team_id, league_id, year, team_total, avg_sc, avg_age,
                            all_league_data):
    """For each key metric, show rank and distance from 1st/average.

    Args:
        all_league_data: {team_id: {"total": float, "avg_sc": float, "avg_age": float}}

    Returns: dict with rank info
    """
    if not all_league_data:
        return {}

    n_teams = len(all_league_data)
    totals = {tid: d["total"] for tid, d in all_league_data.items()}
    avg_scs = {tid: d["avg_sc"] for tid, d in all_league_data.items()}
    avg_ages = {tid: d["avg_age"] for tid, d in all_league_data.items()}

    def _rank_and_gap(metric_dict, tid, higher_is_better=True):
        sorted_items = sorted(metric_dict.items(), key=lambda x: -x[1] if higher_is_better else x[1])
        rank = next((i + 1 for i, (t, _) in enumerate(sorted_items) if t == tid), n_teams)
        values = list(metric_dict.values())
        avg_val = sum(values) / len(values) if values else 0
        best_val = sorted_items[0][1] if sorted_items else 0
        my_val = metric_dict.get(tid, 0)
        return {
            "rank": rank,
            "of": n_teams,
            "value": round(my_val, 1),
            "league_avg": round(avg_val, 1),
            "leader": round(best_val, 1),
            "gap_to_leader": round(best_val - my_val, 1) if higher_is_better else round(my_val - best_val, 1),
            "gap_to_avg": round(my_val - avg_val, 1),
        }

    return {
        "total_sc_rank": _rank_and_gap(totals, team_id, higher_is_better=True),
        "avg_sc_rank": _rank_and_gap(avg_scs, team_id, higher_is_better=True),
        "avg_age_rank": _rank_and_gap(avg_ages, team_id, higher_is_better=False),
    }


# ═══════════════════════════════════════════════════════════════════════════
# EXPOSURE CORRELATION
# ═══════════════════════════════════════════════════════════════════════════

def _compute_exposure_correlation(field_players, year):
    """Check if players from the same AFL team tend to score together."""
    team_groups = defaultdict(list)
    for p in field_players:
        team_groups[p.afl_team or "Unknown"].append(p)

    correlations = []
    for team_name, players in team_groups.items():
        if len(players) < 2:
            continue

        player_round_scores = {}
        for p in players:
            stats = (
                PlayerStat.query
                .filter_by(player_id=p.id, year=year)
                .filter(PlayerStat.round > 0, PlayerStat.supercoach_score.isnot(None))
                .all()
            )
            player_round_scores[p.id] = {s.round: s.supercoach_score for s in stats}

        for i in range(len(players)):
            for j in range(i + 1, len(players)):
                pa, pb = players[i], players[j]
                scores_a = player_round_scores.get(pa.id, {})
                scores_b = player_round_scores.get(pb.id, {})
                common_rounds = set(scores_a.keys()) & set(scores_b.keys())
                if len(common_rounds) < 3:
                    continue
                vals_a = [scores_a[r] for r in sorted(common_rounds)]
                vals_b = [scores_b[r] for r in sorted(common_rounds)]
                corr = _pearson(vals_a, vals_b)
                if corr is not None:
                    correlations.append({
                        "player_a": pa.name,
                        "player_b": pb.name,
                        "afl_team": team_name,
                        "correlation": round(corr, 3),
                        "games": len(common_rounds),
                    })

    return correlations


# ═══════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

def compute_deep_analytics(team_id, league_id, year, profile_tags):
    """Compute comprehensive deep analytics for a fantasy team.

    This is the single entry point — it runs all models and returns a dict
    with every metric the template needs.

    Args:
        team_id: FantasyTeam.id
        league_id: League.id
        year: current season year (e.g. 2026)
        profile_tags: dict from compute_profile_tags() — {player_id: {...}}

    Returns:
        dict with all analytics sections. Returns empty dict if team has no players.
    """
    try:
        return _compute_deep_analytics_inner(team_id, league_id, year, profile_tags)
    except Exception:
        logger.exception("Deep analytics failed for team %s", team_id)
        return {}


def _compute_deep_analytics_inner(team_id, league_id, year, profile_tags):
    """Inner implementation — separated so the outer function can catch errors."""

    # ── Load roster ──────────────────────────────────────────────────────
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    players = [db.session.get(AflPlayer, r.player_id) for r in roster]
    players = [p for p in players if p]
    roster_map = {r.player_id: r for r in roster}

    if not players:
        return {}

    field_players = [p for p in players if not roster_map[p.id].is_benched]
    bench_players = [p for p in players if roster_map[p.id].is_benched]
    total_field = len(field_players)

    # ── Load shared resources ────────────────────────────────────────────
    all_db_players = AflPlayer.query.all()
    historical_records = _load_historical_sc()
    curves_dict = _build_role_aware_age_curves(historical_records, all_db_players)
    bucket_priors = _compute_bucket_priors(all_db_players)
    replacement_levels = _compute_replacement_levels()

    # ══════════════════════════════════════════════════════════════════════
    # BAYESIAN TRUE-TALENT ESTIMATION (for every player on roster)
    # ══════════════════════════════════════════════════════════════════════
    bayesian_map = {}  # player_id -> bayesian estimate dict
    player_game_scores = {}  # player_id -> [scores]

    for p in players:
        bucket = _role_bucket(p.position, p.height_cm)
        prior = bucket_priors.get(bucket, {"mean": 65.0, "std": 20.0})

        # Get this season's game scores
        scores = _get_player_game_scores(p.id, year)
        if len(scores) < 3:
            csv_scores = _get_player_csv_scores(p.name, year - 1)
            if len(csv_scores) >= 3:
                scores = csv_scores

        player_game_scores[p.id] = scores
        est = _bayesian_estimate(prior["mean"], prior["std"], scores, p.sc_avg_prev)
        est["role_bucket"] = bucket
        bayesian_map[p.id] = est

    # Build player_bayesian list for the return
    player_bayesian = []
    for p in players:
        est = bayesian_map[p.id]
        player_bayesian.append({
            "name": p.name,
            "position": _primary_pos(p.position),
            "full_position": p.position or "MID",
            "role_bucket": est["role_bucket"],
            "age": p.age or 0,
            "height": p.height_cm or 0,
            "raw_avg": round(p.sc_avg or 0, 1),
            "true_talent": est["true_talent"],
            "regression_pct": est["regression_pct"],
            "games": est["games"],
            "prior_avg": est["prior_used"],
            "ceiling": est["ceiling"],
            "floor": est["floor"],
            "is_field": not roster_map[p.id].is_benched,
        })
    player_bayesian.sort(key=lambda x: -x["true_talent"])

    # ══════════════════════════════════════════════════════════════════════
    # MULTI-YEAR PROJECTIONS (3 years)
    # ══════════════════════════════════════════════════════════════════════
    projections_by_player = {}  # player_id -> {"yr1", "yr2", "yr3"}
    proj_1yr_players = []
    proj_2yr_players = []
    proj_3yr_players = []

    for p in field_players:
        est = bayesian_map.get(p.id, {})
        # Use ACTUAL sc_avg as the base for projections (not Bayesian)
        base_sc = p.sc_avg or p.sc_avg_prev or est.get("true_talent", 0)
        bucket = est.get("role_bucket", "small_mid")
        pos = _primary_pos(p.position)
        age = p.age or 25
        t = profile_tags.get(p.id, {})
        peak_phase = t.get("peak_phase", "peak")
        traj = t.get("trajectory", 0)

        yr1, yr2, yr3 = _project_player_multi_year(base_sc, age, bucket, pos, curves_dict,
                                                     peak_phase, traj)
        projections_by_player[p.id] = {"yr1": yr1, "yr2": yr2, "yr3": yr3}

        change_1 = round(yr1 - base_sc, 1)
        change_2 = round(yr2 - base_sc, 1)
        change_3 = round(yr3 - base_sc, 1)

        entry_base = {
            "name": p.name,
            "age": age,
            "position": pos,
            "current": round(base_sc, 1),
        }
        proj_1yr_players.append({**entry_base, "projected": yr1, "change": change_1})
        proj_2yr_players.append({**entry_base, "projected": yr2, "change": change_2})
        proj_3yr_players.append({**entry_base, "projected": yr3, "change": change_3})

    proj_1yr_total = round(sum(d["yr1"] for d in projections_by_player.values()), 1)
    proj_2yr_total = round(sum(d["yr2"] for d in projections_by_player.values()), 1)
    proj_3yr_total = round(sum(d["yr3"] for d in projections_by_player.values()), 1)

    projections = {
        "1yr": {"total": proj_1yr_total, "players": sorted(proj_1yr_players, key=lambda x: -x["change"])},
        "2yr": {"total": proj_2yr_total, "players": sorted(proj_2yr_players, key=lambda x: -x["change"])},
        "3yr": {"total": proj_3yr_total, "players": sorted(proj_3yr_players, key=lambda x: -x["change"])},
    }

    # ══════════════════════════════════════════════════════════════════════
    # MONTE CARLO (using Bayesian true-talent as mean)
    # ══════════════════════════════════════════════════════════════════════
    mc_distributions = []
    for p in field_players:
        # Use actual SC avg for MC simulation (matches what user sees)
        sc = p.sc_avg or p.sc_avg_prev or 0
        est = bayesian_map.get(p.id, {})
        obs_std = est.get("observed_std", sc * _DEFAULT_CV if sc > 0 else 20)
        if est.get("games", 0) >= 5:
            std = obs_std
        else:
            prior_std = bucket_priors.get(est.get("role_bucket", "small_mid"), {}).get("std", 20)
            std = max(obs_std, prior_std)  # use wider uncertainty for small samples
        mc_distributions.append((max(sc, 0), max(std, 5)))

    mc_results = _run_monte_carlo(mc_distributions)

    # ══════════════════════════════════════════════════════════════════════
    # SCENARIO ANALYSIS
    # ══════════════════════════════════════════════════════════════════════
    scenarios = _compute_scenarios(field_players, bayesian_map, roster_map,
                                    players, replacement_levels)

    # ══════════════════════════════════════════════════════════════════════
    # LEAGUE COMPARISON — compute for all teams
    # ══════════════════════════════════════════════════════════════════════
    league_teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    league_team_totals = {}  # tid -> bayesian team total
    all_league_data = {}  # tid -> {total, avg_sc, avg_age}
    league_avg_sc_accum = 0.0
    league_avg_age_accum = 0.0
    team_count = 0

    for lt in league_teams:
        lt_roster = FantasyRoster.query.filter_by(team_id=lt.id, is_active=True).all()
        lt_field = []
        for r in lt_roster:
            if not r.is_benched:
                lp = db.session.get(AflPlayer, r.player_id)
                if lp:
                    lt_field.append(lp)

        if lt_field:
            # Use actual SC averages for all teams (consistent comparison)
            lt_total = sum(p.sc_avg or 0 for p in lt_field)
            lt_avg_sc = lt_total / len(lt_field)
            lt_avg_age = sum(p.age or 25 for p in lt_field) / len(lt_field)

            league_team_totals[lt.id] = lt_total
            all_league_data[lt.id] = {
                "total": lt_total,
                "avg_sc": lt_avg_sc,
                "avg_age": lt_avg_age,
            }
            league_avg_sc_accum += lt_avg_sc
            league_avg_age_accum += lt_avg_age
            team_count += 1

    if team_count:
        league_avg_sc = round(league_avg_sc_accum / team_count, 1)
        league_avg_age = round(league_avg_age_accum / team_count, 1)
    else:
        league_avg_sc = 0.0
        league_avg_age = 0.0

    league_context = _compute_league_context(
        team_id, league_id, year,
        league_team_totals.get(team_id, 0),
        all_league_data.get(team_id, {}).get("avg_sc", 0),
        all_league_data.get(team_id, {}).get("avg_age", 0),
        all_league_data,
    )

    # ══════════════════════════════════════════════════════════════════════
    # TEAM HEALTH SCORE
    # ══════════════════════════════════════════════════════════════════════
    health = _compute_health_score(field_players, bench_players, bayesian_map,
                                    profile_tags, league_team_totals, replacement_levels)

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: ROSTER COMPOSITION
    # ══════════════════════════════════════════════════════════════════════
    tier_counts = defaultdict(int)
    tier_players = defaultdict(list)
    for p in players:
        t = profile_tags.get(p.id, {})
        tag = t.get("tag", "Unclassified")
        tier_counts[tag] += 1
        tier_players[tag].append(p.name)

    roster_quality = sum(
        _TIER_WEIGHTS.get(profile_tags.get(p.id, {}).get("tag", ""), 0)
        for p in field_players
    )
    max_quality = len(field_players) * 10
    quality_pct = round(_safe_div(roster_quality, max_quality) * 100, 1)

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: AGE PROFILE
    # ══════════════════════════════════════════════════════════════════════
    ages = [p.age for p in players if p.age]
    avg_age = round(_safe_div(sum(ages), len(ages)), 1) if ages else 0
    age_buckets = {"U22": 0, "22-25": 0, "26-29": 0, "30+": 0}
    for a in ages:
        if a < 22:
            age_buckets["U22"] += 1
        elif a < 26:
            age_buckets["22-25"] += 1
        elif a < 30:
            age_buckets["26-29"] += 1
        else:
            age_buckets["30+"] += 1

    peak_phases = defaultdict(int)
    for p in field_players:
        t = profile_tags.get(p.id, {})
        peak_phases[t.get("peak_phase", "unknown")] += 1

    peak_count = peak_phases.get("peak", 0)
    pre_peak_count = peak_phases.get("pre-peak", 0)
    post_peak_count = peak_phases.get("post-peak", 0)

    if total_field > 0:
        now_pct = round((peak_count + post_peak_count) / total_field * 100)
        future_pct = round(pre_peak_count / total_field * 100)
    else:
        now_pct = future_pct = 0

    if peak_count >= total_field * 0.5:
        window = "Win Now"
        window_detail = f"{peak_count}/{total_field} field players in their peak window"
    elif pre_peak_count >= total_field * 0.4:
        window = "Building"
        window_detail = f"{pre_peak_count}/{total_field} field players haven't peaked yet"
    elif post_peak_count >= total_field * 0.35:
        window = "Declining"
        window_detail = f"{post_peak_count}/{total_field} field players past their peak"
    else:
        window = "Balanced"
        window_detail = (f"Mix of peak ({peak_count}), pre-peak ({pre_peak_count}), "
                         f"post-peak ({post_peak_count})")

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: SCORING ANALYSIS
    # ══════════════════════════════════════════════════════════════════════
    sc_values = [(p, p.sc_avg or 0) for p in field_players]
    sc_values.sort(key=lambda x: x[1], reverse=True)
    total_sc = sum(v for _, v in sc_values)
    avg_sc_field = round(_safe_div(total_sc, len(sc_values)), 1)

    if len(sc_values) >= 5:
        top5_sc = sum(v for _, v in sc_values[:5])
        top5_pct = round(_safe_div(top5_sc, total_sc) * 100, 1)
    else:
        top5_pct = 100.0

    if len(sc_values) >= 2:
        mean_sc = total_sc / len(sc_values)
        sc_std = round(math.sqrt(sum((v - mean_sc) ** 2 for _, v in sc_values) / len(sc_values)), 1)
    else:
        sc_std = 0

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: POSITIONAL BALANCE
    # ══════════════════════════════════════════════════════════════════════
    pos_breakdown = defaultdict(lambda: {"count": 0, "total_sc": 0, "avg_sc": 0, "players": []})
    for p in field_players:
        primary = _primary_pos(p.position)
        sc = p.sc_avg or 0
        pos_breakdown[primary]["count"] += 1
        pos_breakdown[primary]["total_sc"] += sc
        pos_breakdown[primary]["players"].append({"name": p.name, "sc": sc})

    for pos in pos_breakdown:
        c = pos_breakdown[pos]["count"]
        pos_breakdown[pos]["avg_sc"] = round(_safe_div(pos_breakdown[pos]["total_sc"], c), 1)
        pos_breakdown[pos]["players"].sort(key=lambda x: -x["sc"])

    pos_balance_score = 0
    pos_notes = []
    for pos, ideal in _IDEAL_FIELD.items():
        actual = pos_breakdown[pos]["count"]
        if actual >= ideal:
            pos_balance_score += 1
        else:
            pos_notes.append(f"{pos} short ({actual}/{ideal})")

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: TRAJECTORY / OUTLOOK
    # ══════════════════════════════════════════════════════════════════════
    trajectories = []
    for p in field_players:
        t = profile_tags.get(p.id, {})
        traj = t.get("trajectory", 0)
        trajectories.append(traj)

    avg_trajectory = round(_safe_div(sum(trajectories), len(trajectories)), 1) if trajectories else 0
    rising_count = sum(1 for t in trajectories if t > 3)
    declining_count = sum(1 for t in trajectories if t < -3)

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: CONSISTENCY & DURABILITY
    # ══════════════════════════════════════════════════════════════════════
    consistencies = [profile_tags.get(p.id, {}).get("consistency", 0.5) for p in field_players]
    durabilities = [profile_tags.get(p.id, {}).get("durability", 15) for p in field_players]
    avg_consistency = round(_safe_div(sum(consistencies), len(consistencies)), 2)
    avg_durability = round(_safe_div(sum(durabilities), len(durabilities)), 1)

    injury_risk = []
    for p in field_players:
        dur = profile_tags.get(p.id, {}).get("durability", 20)
        if p.injury_severity or dur < 14:
            injury_risk.append({
                "name": p.name,
                "reason": p.injury_type or f"Low durability ({dur:.0f} games/yr)",
                "sc": p.sc_avg or 0,
            })

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: ROUND-BY-ROUND PERFORMANCE
    # ══════════════════════════════════════════════════════════════════════
    # Only include completed rounds (exclude R0 and mid-round partial scores)
    from models.database import Fixture as _Fx
    completed_rounds = set(
        f.afl_round for f in _Fx.query.filter_by(league_id=league_id, year=year, status="completed").all()
        if f.afl_round > 0
    )
    round_scores = (
        RoundScore.query
        .filter_by(team_id=team_id, year=year)
        .filter(RoundScore.afl_round > 0)
        .order_by(RoundScore.afl_round)
        .all()
    )
    round_data = [{"round": rs.afl_round, "score": rs.total_score}
                  for rs in round_scores if rs.afl_round in completed_rounds]

    if len(round_data) >= 3:
        form_avg = round(sum(r["score"] for r in round_data[-3:]) / 3, 1)
    elif round_data:
        form_avg = round(sum(r["score"] for r in round_data) / len(round_data), 1)
    else:
        form_avg = 0

    season_avg = round(
        _safe_div(sum(r["score"] for r in round_data), len(round_data)), 1
    ) if round_data else 0
    form_vs_season = round(form_avg - season_avg, 1) if season_avg else 0

    # VS expectation (using Bayesian total as baseline)
    bayesian_total = sum(
        bayesian_map.get(p.id, {}).get("true_talent", p.sc_avg or 0)
        for p in field_players
    )
    vs_expectation = []
    for rs in round_scores:
        diff = rs.total_score - bayesian_total
        vs_expectation.append({
            "round": rs.afl_round,
            "actual": rs.total_score,
            "expected": round(bayesian_total, 0),
            "diff": round(diff, 0),
            "pct": round(_safe_div(diff, bayesian_total) * 100, 1),
        })

    # ══════════════════════════════════════════════════════════════════════
    # VORP
    # ══════════════════════════════════════════════════════════════════════
    player_vorp = []
    total_vorp = 0.0
    for p in field_players:
        pos = _primary_pos(p.position)
        tt = bayesian_map.get(p.id, {}).get("true_talent", p.sc_avg or 0)
        repl = replacement_levels.get(pos, 0)
        vorp = round(tt - repl, 1)
        total_vorp += vorp
        player_vorp.append({
            "name": p.name,
            "position": pos,
            "sc": round(tt, 1),
            "replacement": repl,
            "vorp": vorp,
        })
    player_vorp.sort(key=lambda x: -x["vorp"])
    total_vorp = round(total_vorp, 1)

    # ══════════════════════════════════════════════════════════════════════
    # EFFICIENCY
    # ══════════════════════════════════════════════════════════════════════
    squad_size = len(players)
    field_sc_total = sum(p.sc_avg or 0 for p in field_players)
    roster_efficiency = round(_safe_div(field_sc_total, squad_size), 1)

    bench_scs = [p.sc_avg or 0 for p in bench_players]
    bench_avg_sc = round(_safe_div(sum(bench_scs), len(bench_scs)), 1) if bench_scs else 0
    dead_weight_count = sum(1 for sc in bench_scs if sc < 40)

    # ══════════════════════════════════════════════════════════════════════
    # AFL TEAM EXPOSURE
    # ══════════════════════════════════════════════════════════════════════
    team_exposure, max_exposure = _compute_team_exposure(field_players, total_field)
    exposure_correlations = _compute_exposure_correlation(field_players, year)

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: AGE CURVE MODEL (player vs curve)
    # ══════════════════════════════════════════════════════════════════════
    player_vs_curve = []
    for p in field_players:
        pos = _primary_pos(p.position)
        bucket = _role_bucket(p.position, p.height_cm)
        age = p.age or 25
        actual_sc = p.sc_avg or 0
        personal_peak = profile_tags.get(p.id, {}).get("peak_avg", actual_sc)
        if personal_peak <= 0:
            personal_peak = actual_sc

        curve_val = _get_age_curve_value(curves_dict, bucket, pos, age)
        curve_peak = _curve_peak_sc(curves_dict, bucket, pos)

        if curve_val and curve_val > 0 and curve_peak and curve_peak > 0:
            # Scale curve to player's personal peak
            scale = personal_peak / curve_peak if personal_peak > 0 else 1.0
            expected = curve_val * scale
            diff_pct = round((actual_sc - expected) / expected * 100, 1) if expected > 0 else 0
        else:
            expected = actual_sc
            diff_pct = 0.0

        player_vs_curve.append({
            "name": p.name,
            "age": age,
            "position": pos,
            "role_bucket": bucket,
            "actual_sc": round(actual_sc, 1),
            "expected_sc": round(expected, 1),
            "diff_pct": diff_pct,
        })
    player_vs_curve.sort(key=lambda x: -abs(x["diff_pct"]))

    # Legacy position-level curves for template
    age_curves = curves_dict.get("positions", {})

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: FUTURE PROJECTION (1-year, using new model)
    # ══════════════════════════════════════════════════════════════════════
    aging_out = []
    aging_in = []
    for p in field_players:
        proj = projections_by_player.get(p.id, {})
        yr1 = proj.get("yr1", 0)
        tt = bayesian_map.get(p.id, {}).get("true_talent", p.sc_avg or 0)
        change = round(yr1 - tt, 1)
        entry = {
            "name": p.name,
            "age": p.age or 0,
            "current_sc": round(tt, 1),
            "projected_sc": yr1,
            "change": change,
        }
        if change < -2:
            aging_out.append(entry)
        elif change > 2:
            aging_in.append(entry)

    aging_out.sort(key=lambda x: x["change"])
    aging_in.sort(key=lambda x: -x["change"])

    projected_next_year = proj_1yr_total
    current_total_field = round(sum(
        bayesian_map.get(p.id, {}).get("true_talent", p.sc_avg or 0) for p in field_players
    ), 1)
    projected_change_pct = round(
        _safe_div(projected_next_year - current_total_field, current_total_field) * 100, 1
    )

    # ══════════════════════════════════════════════════════════════════════
    # BACKWARD-COMPAT: ENHANCED PER-PLAYER ANALYSIS (player_deep)
    # ══════════════════════════════════════════════════════════════════════
    player_deep = []
    for p in field_players:
        t = profile_tags.get(p.id, {})
        pos = _primary_pos(p.position)
        age = p.age or 0
        sc = p.sc_avg or 0
        baseline_sc = p.sc_avg_prev or t.get("peak_avg", 0) or 0
        est = bayesian_map.get(p.id, {})
        tt = est.get("true_talent", sc)

        if baseline_sc > 0:
            diff = sc - baseline_sc
            diff_pct = round(diff / baseline_sc * 100, 1)
        else:
            diff = 0
            diff_pct = 0

        round_scores_player = player_game_scores.get(p.id, [])

        # vs age curve
        personal_peak = t.get("peak_avg", sc)
        if personal_peak <= 0:
            personal_peak = sc
        bucket = _role_bucket(p.position, p.height_cm)
        curve_val = _get_age_curve_value(curves_dict, bucket, pos, age)
        cpeak = _curve_peak_sc(curves_dict, bucket, pos)
        if curve_val and curve_val > 0 and cpeak and cpeak > 0:
            scale = personal_peak / cpeak
            expected_curve = curve_val * scale
            vs_curve = round(sc - expected_curve, 1)
            vs_curve_pct = round(_safe_div(vs_curve, expected_curve) * 100, 1)
        else:
            vs_curve = 0
            vs_curve_pct = 0

        # z-score
        if len(round_scores_player) >= 3:
            p_mean = sum(round_scores_player) / len(round_scores_player)
            p_std = _std_dev(round_scores_player)
            z_score = round(_safe_div(sc - p_mean, p_std), 2) if p_std > 0 else 0
        else:
            z_score = 0

        # last 3 trend
        if len(round_scores_player) >= 3:
            last3 = round_scores_player[-3:]
            l3_avg = sum(last3) / 3
            season_p_avg = sum(round_scores_player) / len(round_scores_player)
            l3_trend = round(l3_avg - season_p_avg, 1)
        else:
            l3_trend = 0.0

        # ceiling / floor from game scores
        if len(round_scores_player) >= 3:
            sorted_scores = sorted(round_scores_player)
            ceiling = round(_percentile(sorted_scores, 90), 1)
            floor = round(_percentile(sorted_scores, 10), 1)
        elif round_scores_player:
            ceiling = max(round_scores_player)
            floor = min(round_scores_player)
        else:
            ceiling = est.get("ceiling", sc)
            floor = est.get("floor", sc)

        # VORP
        repl = replacement_levels.get(pos, 0)
        p_vorp = round(tt - repl, 1)

        # Projected
        proj = projections_by_player.get(p.id, {})
        projected_next = proj.get("yr1", tt)

        player_deep.append({
            "name": p.name,
            "position": pos,
            "age": age,
            "sc": round(sc, 1),
            "true_talent": round(tt, 1),
            "baseline": round(baseline_sc, 1),
            "diff": round(diff, 1),
            "diff_pct": diff_pct,
            "vs_curve": vs_curve,
            "vs_curve_pct": vs_curve_pct,
            "z_score": z_score,
            "l3_trend": l3_trend,
            "ceiling": ceiling,
            "floor": floor,
            "vorp": p_vorp,
            "projected_next_yr": projected_next,
            "tag": t.get("tag", ""),
            "tag_css": t.get("css", ""),
            "round_scores": round_scores_player,
            "composite": t.get("composite", 0),
            "trajectory": t.get("trajectory", 0),
            "consistency": t.get("consistency", 0.5),
            "games": p.games_played or 0,
            "role_bucket": bucket,
            "regression_pct": est.get("regression_pct", 100),
        })
    player_deep.sort(key=lambda x: -x["sc"])

    # ══════════════════════════════════════════════════════════════════════
    # INSIGHTS ENGINE
    # ══════════════════════════════════════════════════════════════════════
    pos_breakdown_dict = {k: dict(v) for k, v in pos_breakdown.items()}

    insights = _generate_insights(
        field_players, bench_players, bayesian_map, profile_tags,
        replacement_levels, scenarios, projections_by_player,
        pos_breakdown_dict, league_team_totals, team_id,
    )

    # ══════════════════════════════════════════════════════════════════════
    # ASSEMBLE FINAL RESULT
    # ══════════════════════════════════════════════════════════════════════
    return {
        # ── Team Health Score ──
        "health_score": health["health_score"],
        "health_components": health["health_components"],

        # ── Bayesian estimates ──
        "player_bayesian": player_bayesian,

        # ── Multi-year projections ──
        "projections": projections,

        # ── Scenarios ──
        "scenarios": scenarios,

        # ── Insights (sorted by impact) ──
        "insights": insights,

        # ── League context (detailed) ──
        "league_context": league_context,

        # ── Monte Carlo (using Bayesian estimates) ──
        "mc_p10": mc_results["mc_p10"],
        "mc_p25": mc_results["mc_p25"],
        "mc_p50": mc_results["mc_p50"],
        "mc_p75": mc_results["mc_p75"],
        "mc_p90": mc_results["mc_p90"],
        "mc_distribution": mc_results["mc_distribution"],
        "mc_labels": mc_results["mc_labels"],

        # ══════════════════════════════════════════════════════════════════
        # BACKWARD-COMPATIBLE FIELDS (preserved for existing template)
        # ══════════════════════════════════════════════════════════════════

        # ── Composition ──
        "squad_size": squad_size,
        "field_count": total_field,
        "bench_count": len(bench_players),
        "tier_counts": dict(tier_counts),
        "tier_players": dict(tier_players),
        "quality_pct": quality_pct,

        # ── Age ──
        "avg_age": avg_age,
        "age_buckets": age_buckets,
        "peak_phases": dict(peak_phases),
        "window": window,
        "window_detail": window_detail,
        "now_pct": now_pct,
        "future_pct": future_pct,

        # ── Scoring ──
        "total_sc": round(total_sc, 0),
        "avg_sc": avg_sc_field,
        "top5_pct": top5_pct,
        "sc_std": sc_std,
        "season_avg": season_avg,
        "form_avg": form_avg,
        "form_vs_season": form_vs_season,
        "current_total": current_total_field,

        # ── Position ──
        "pos_breakdown": pos_breakdown_dict,
        "pos_balance_score": pos_balance_score,
        "pos_notes": pos_notes,

        # ── Trajectory ──
        "avg_trajectory": avg_trajectory,
        "rising_count": rising_count,
        "declining_count": declining_count,

        # ── Reliability ──
        "avg_consistency": avg_consistency,
        "avg_durability": avg_durability,
        "injury_risk": injury_risk,

        # ── Performance ──
        "round_data": round_data,
        "vs_expectation": vs_expectation,
        "player_vs_baseline": player_deep,

        # ── League context (simple) ──
        "league_avg_sc": league_avg_sc,
        "league_avg_age": league_avg_age,
        "sc_vs_league": round(avg_sc_field - league_avg_sc, 1),
        "age_vs_league": round(avg_age - league_avg_age, 1),

        # ── Age curve model ──
        "age_curves": age_curves,
        "role_curves": curves_dict.get("buckets", {}),
        "player_vs_curve": player_vs_curve,

        # ── VORP ──
        "replacement_levels": replacement_levels,
        "total_vorp": total_vorp,
        "player_vorp": player_vorp,

        # ── Efficiency ──
        "roster_efficiency": roster_efficiency,
        "bench_avg_sc": bench_avg_sc,
        "dead_weight_count": dead_weight_count,

        # ── AFL team exposure ──
        "team_exposure": team_exposure,
        "max_exposure": max_exposure,
        "exposure_correlations": exposure_correlations,

        # ── Future projection (backward compat) ──
        "projected_next_year": projected_next_year,
        "projected_change_pct": projected_change_pct,
        "aging_out": aging_out[:10],
        "aging_in": aging_in[:10],

        # ── Enhanced per-player ──
        "player_deep": player_deep,
    }


# ═══════════════════════════════════════════════════════════════════════════
# BACKWARD COMPATIBILITY ALIAS
# ═══════════════════════════════════════════════════════════════════════════

def compute_team_analytics(team_id, league_id, year, profile_tags):
    """Drop-in replacement — delegates to compute_deep_analytics.

    Existing callers of compute_team_analytics will get the same keys they
    had before, plus all the new deep analytics fields.
    """
    return compute_deep_analytics(team_id, league_id, year, profile_tags)

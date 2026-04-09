"""Team Analytics — deep statistical modelling of roster composition and outlook.

Provides:
  1. Age-curve regression model (historical SC by position + age)
  2. Monte Carlo score simulation with confidence intervals
  3. Value Over Replacement Player (VORP) per position
  4. Draft capital / roster efficiency metrics
  5. AFL team exposure and bye-week risk
  6. 1-2 year future projection using age curves
  7. Enhanced per-player deep analysis

All heavy lifting is in `compute_deep_analytics()` which returns a single
comprehensive dict suitable for rendering charts and tables.
"""

import os
import math
import logging
from collections import defaultdict
from functools import lru_cache

import config
from models.database import (
    db, FantasyRoster, AflPlayer, PlayerStat, RoundScore,
    FantasyTeam, Fixture,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Try numpy for fast Monte Carlo; fall back to stdlib random
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

# Positional peak age ranges (inclusive)
_POS_PEAK = {
    "MID": (25, 29),
    "DEF": (26, 30),
    "FWD": (24, 28),
    "RUC": (26, 30),
}

_MC_SIMULATIONS = 1000
_MC_HISTOGRAM_BUCKETS = 20

# Tier weights for roster quality scoring
_TIER_WEIGHTS = {
    "Elite": 10, "Elite Veteran": 9, "Premium": 8,
    "Emerging Star": 7, "Breakout": 6, "Proven": 5,
    "Steady": 3, "Developing": 2, "Project": 1,
    "Veteran": 2, "Declining": 1, "Fringe": 0, "Unclassified": 0,
}

# CSV column mapping (fitzRoy column names -> friendly names)
_CSV_SC_COL = "SC"
_CSV_PLAYER_COL = "Player"
_CSV_TEAM_COL = "Team"
_CSV_ROUND_COL = "Round"
_CSV_SEASON_COL = "Season"


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
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


# ═══════════════════════════════════════════════════════════════════════════
# AGE CURVE — loads CSV history and builds position-age SC curves
# ═══════════════════════════════════════════════════════════════════════════

# Module-level cache so we only build the age curve once per process
_age_curve_cache = {}


def _load_historical_sc():
    """Load per-game SC from CSVs (2018-2025).

    Returns:
        list of dicts: [{"player": str, "team": str, "year": int,
                         "round": str/int, "sc": int}, ...]
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
            if len(scores) >= 3  # need 3+ games for a meaningful avg
        }
    return result


def _build_age_curves(records, all_players_db):
    """Build empirical age curves: avg SC at each age for each position.

    We need age data from the DB (AflPlayer.age, AflPlayer.dob) combined with
    historical SC from CSVs.  Since CSVs don't have age, we compute it from
    the player's current age and the year difference.

    Returns: {pos: {age: avg_sc}}
    """
    cache_key = "age_curves"
    if cache_key in _age_curve_cache:
        return _age_curve_cache[cache_key]

    # Build lookup: player_name -> (current_age, primary_position)
    player_info = {}
    for p in all_players_db:
        if p.age and p.age > 0:
            player_info[p.name] = (_primary_pos(p.position), p.age)

    current_year = config.CURRENT_YEAR

    # Accumulate SC by (position, age)
    pos_age_sc = defaultdict(lambda: defaultdict(list))

    player_yearly = _build_player_yearly_avgs(records)

    for name, yearly in player_yearly.items():
        info = player_info.get(name)
        if not info:
            continue
        pos, cur_age = info
        for year, avg_sc in yearly.items():
            # Estimate their age in that year
            age_in_year = cur_age - (current_year - year)
            if 18 <= age_in_year <= 38 and avg_sc > 0:
                pos_age_sc[pos][age_in_year].append(avg_sc)

    # Compute averages
    curves = {}
    for pos in ("DEF", "MID", "FWD", "RUC"):
        age_data = pos_age_sc.get(pos, {})
        curves[pos] = {}
        for age in range(18, 39):
            scores = age_data.get(age, [])
            if len(scores) >= 5:  # need decent sample
                curves[pos][age] = round(sum(scores) / len(scores), 1)

    # Smooth gaps: if an age is missing but neighbours exist, interpolate
    for pos in curves:
        ages_present = sorted(curves[pos].keys())
        if len(ages_present) < 2:
            continue
        for age in range(min(ages_present), max(ages_present) + 1):
            if age not in curves[pos]:
                # Find nearest neighbours
                below = [a for a in ages_present if a < age]
                above = [a for a in ages_present if a > age]
                if below and above:
                    a_lo, a_hi = below[-1], above[0]
                    frac = (age - a_lo) / (a_hi - a_lo)
                    curves[pos][age] = round(
                        curves[pos][a_lo] + frac * (curves[pos][a_hi] - curves[pos][a_lo]), 1
                    )

    _age_curve_cache[cache_key] = curves
    return curves


def _expected_sc_for_player(curves, pos, age, personal_peak_sc):
    """Project a player's expected SC at their current age using the curve.

    We scale the generic curve to the player's personal peak so a 110-avg
    Elite mid isn't compared to the 75-avg position mean.

    Returns: expected SC (float), or None if no curve data.
    """
    curve = curves.get(pos, {})
    if not curve or age not in curve:
        return None

    # Find the peak of the generic curve for this position
    curve_peak_age = max(curve, key=curve.get)
    curve_peak_sc = curve[curve_peak_age]

    if curve_peak_sc <= 0:
        return None

    # Scale factor: player's personal peak vs curve peak
    scale = personal_peak_sc / curve_peak_sc if personal_peak_sc > 0 else 1.0

    return round(curve[age] * scale, 1)


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
        player_distributions: list of (mean, std_dev) tuples for each field player
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
        # Fast vectorised approach
        rng = np.random.default_rng(seed=42)
        totals = np.zeros(n_sims)
        for mean, std in player_distributions:
            if std > 0:
                scores = rng.normal(mean, std, n_sims)
                # Floor individual scores at 0
                scores = np.maximum(scores, 0)
            else:
                scores = np.full(n_sims, mean)
            totals += scores
        totals_sorted = np.sort(totals)
        p10 = float(np.percentile(totals, 10))
        p25 = float(np.percentile(totals, 25))
        p50 = float(np.percentile(totals, 50))
        p75 = float(np.percentile(totals, 75))
        p90 = float(np.percentile(totals, 90))
        totals_list = totals.tolist()
    else:
        # Stdlib fallback
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
# VORP (Value Over Replacement Player)
# ═══════════════════════════════════════════════════════════════════════════

def _compute_replacement_levels():
    """Compute replacement-level SC per position (25th percentile).

    Uses ALL active AflPlayers in the DB with sc_avg > 0.

    Returns: {pos: replacement_sc}
    """
    all_players = AflPlayer.query.filter(AflPlayer.sc_avg > 0).all()
    pos_scores = defaultdict(list)
    for p in all_players:
        pos = _primary_pos(p.position)
        pos_scores[pos].append(p.sc_avg)

    levels = {}
    for pos in ("DEF", "MID", "FWD", "RUC"):
        scores = sorted(pos_scores.get(pos, []))
        if scores:
            levels[pos] = round(_percentile(scores, 25), 1)
        else:
            levels[pos] = 0.0
    return levels


# ═══════════════════════════════════════════════════════════════════════════
# AFL TEAM EXPOSURE
# ═══════════════════════════════════════════════════════════════════════════

def _compute_team_exposure(field_players, total_field):
    """Count field players per AFL team and flag over-exposure.

    Returns: (exposure_dict, max_exposure_dict)
    """
    team_counts = defaultdict(lambda: {"count": 0, "players": []})
    for p in field_players:
        team_name = p.afl_team or "Unknown"
        team_counts[team_name]["count"] += 1
        team_counts[team_name]["players"].append(p.name)

    # Add percentage
    for team in team_counts:
        team_counts[team]["pct"] = round(
            team_counts[team]["count"] / max(total_field, 1) * 100, 1
        )

    # Find max exposure
    if team_counts:
        max_team = max(team_counts, key=lambda t: team_counts[t]["count"])
        max_exposure = {"team": max_team, "count": team_counts[max_team]["count"]}
    else:
        max_exposure = {"team": "None", "count": 0}

    return dict(team_counts), max_exposure


# ═══════════════════════════════════════════════════════════════════════════
# INTRA-TEAM CORRELATION (players from same AFL game)
# ═══════════════════════════════════════════════════════════════════════════

def _compute_exposure_correlation(field_players, year):
    """Check if players from the same AFL team tend to score together.

    For each pair of field players on the same AFL team, compute the
    Pearson correlation of their per-round SC scores.

    Returns: list of {"player_a", "player_b", "afl_team", "correlation", "games"}
    """
    # Group field players by AFL team
    team_groups = defaultdict(list)
    for p in field_players:
        team_groups[p.afl_team or "Unknown"].append(p)

    correlations = []
    for team_name, players in team_groups.items():
        if len(players) < 2:
            continue

        # Load round scores for each player
        player_round_scores = {}
        for p in players:
            stats = (
                PlayerStat.query
                .filter_by(player_id=p.id, year=year)
                .filter(PlayerStat.round > 0, PlayerStat.supercoach_score.isnot(None))
                .all()
            )
            player_round_scores[p.id] = {s.round: s.supercoach_score for s in stats}

        # Compute pairwise correlations
        for i in range(len(players)):
            for j in range(i + 1, len(players)):
                pa, pb = players[i], players[j]
                scores_a = player_round_scores.get(pa.id, {})
                scores_b = player_round_scores.get(pb.id, {})
                # Find common rounds
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
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

def compute_deep_analytics(team_id, league_id, year, profile_tags):
    """Compute comprehensive deep analytics for a fantasy team.

    This is the single entry point — it runs all models and returns a flat
    dict with every metric the template needs, including all the fields
    that the original compute_team_analytics returned.

    Args:
        team_id: FantasyTeam.id
        league_id: League.id
        year: current season year (e.g. 2026)
        profile_tags: dict from compute_profile_tags() — {player_id: {...}}

    Returns:
        dict with all analytics sections (see module docstring).
        Returns empty dict if team has no players.
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

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 1: ROSTER COMPOSITION (preserved from original)
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
    # SECTION 2: AGE PROFILE (preserved from original)
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
    # SECTION 3: SCORING ANALYSIS (preserved from original)
    # ══════════════════════════════════════════════════════════════════════
    sc_values = [(p, p.sc_avg or 0) for p in field_players]
    sc_values.sort(key=lambda x: x[1], reverse=True)
    total_sc = sum(v for _, v in sc_values)
    avg_sc = round(_safe_div(total_sc, len(sc_values)), 1)

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
    # SECTION 4: POSITIONAL BALANCE (preserved from original)
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
    # SECTION 5: TRAJECTORY / OUTLOOK (preserved from original)
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
    # SECTION 6: CONSISTENCY & DURABILITY (preserved from original)
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
    # SECTION 7: ROUND-BY-ROUND PERFORMANCE (preserved from original)
    # ══════════════════════════════════════════════════════════════════════
    round_scores = (
        RoundScore.query
        .filter_by(team_id=team_id, year=year)
        .filter(RoundScore.afl_round > 0)
        .order_by(RoundScore.afl_round)
        .all()
    )
    round_data = [{"round": rs.afl_round, "score": rs.total_score} for rs in round_scores]

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

    # VS expectation
    baseline_total = sum(p.sc_avg or 0 for p in field_players)
    vs_expectation = []
    for rs in round_scores:
        diff = rs.total_score - baseline_total
        vs_expectation.append({
            "round": rs.afl_round,
            "actual": rs.total_score,
            "expected": round(baseline_total, 0),
            "diff": round(diff, 0),
            "pct": round(_safe_div(diff, baseline_total) * 100, 1),
        })

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 8: LEAGUE COMPARISON (preserved from original)
    # ══════════════════════════════════════════════════════════════════════
    league_teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    league_avg_sc = 0
    league_avg_age = 0
    team_count = 0
    for lt in league_teams:
        lt_roster = FantasyRoster.query.filter_by(team_id=lt.id, is_active=True).all()
        lt_players = [db.session.get(AflPlayer, r.player_id) for r in lt_roster if not r.is_benched]
        lt_players = [p for p in lt_players if p]
        if lt_players:
            league_avg_sc += sum(p.sc_avg or 0 for p in lt_players) / len(lt_players)
            league_avg_age += sum(p.age or 25 for p in lt_players) / len(lt_players)
            team_count += 1
    if team_count:
        league_avg_sc = round(league_avg_sc / team_count, 1)
        league_avg_age = round(league_avg_age / team_count, 1)

    # ══════════════════════════════════════════════════════════════════════
    # NEW SECTION A: AGE-CURVE REGRESSION MODEL
    # ══════════════════════════════════════════════════════════════════════
    all_db_players = AflPlayer.query.all()
    historical_records = _load_historical_sc()
    age_curves = _build_age_curves(historical_records, all_db_players)

    player_vs_curve = []
    for p in field_players:
        pos = _primary_pos(p.position)
        age = p.age or 25
        actual_sc = p.sc_avg or 0
        # Personal peak from profile tags or historical best
        personal_peak = profile_tags.get(p.id, {}).get("peak_avg", actual_sc)
        if personal_peak <= 0:
            personal_peak = actual_sc

        expected = _expected_sc_for_player(age_curves, pos, age, personal_peak)
        if expected is not None and expected > 0:
            diff_pct = round((actual_sc - expected) / expected * 100, 1)
        else:
            expected = actual_sc  # no curve data — assume on track
            diff_pct = 0.0

        player_vs_curve.append({
            "name": p.name,
            "age": age,
            "position": pos,
            "actual_sc": round(actual_sc, 1),
            "expected_sc": round(expected, 1),
            "diff_pct": diff_pct,
        })
    player_vs_curve.sort(key=lambda x: -abs(x["diff_pct"]))

    # ══════════════════════════════════════════════════════════════════════
    # NEW SECTION B: MONTE CARLO SCORE SIMULATION
    # ══════════════════════════════════════════════════════════════════════
    player_distributions = []
    for p in field_players:
        scores = _get_player_game_scores(p.id, year)
        # Fall back to previous year CSV if < 3 games in current year
        if len(scores) < 3:
            csv_scores = _get_player_csv_scores(p.name, year - 1)
            if len(csv_scores) >= 3:
                scores = csv_scores

        if len(scores) >= 2:
            mean = sum(scores) / len(scores)
            std = _std_dev(scores)
        elif scores:
            mean = scores[0]
            std = mean * 0.25  # assume 25% CV for single-game players
        else:
            mean = p.sc_avg or 0
            std = mean * 0.25 if mean > 0 else 0

        player_distributions.append((mean, std))

    mc_results = _run_monte_carlo(player_distributions)

    # ══════════════════════════════════════════════════════════════════════
    # NEW SECTION C: VORP (Value Over Replacement Player)
    # ══════════════════════════════════════════════════════════════════════
    replacement_levels = _compute_replacement_levels()
    player_vorp = []
    total_vorp = 0.0
    for p in field_players:
        pos = _primary_pos(p.position)
        sc = p.sc_avg or 0
        repl = replacement_levels.get(pos, 0)
        vorp = round(sc - repl, 1)
        total_vorp += vorp
        player_vorp.append({
            "name": p.name,
            "position": pos,
            "sc": round(sc, 1),
            "replacement": repl,
            "vorp": vorp,
        })
    player_vorp.sort(key=lambda x: -x["vorp"])
    total_vorp = round(total_vorp, 1)

    # ══════════════════════════════════════════════════════════════════════
    # NEW SECTION D: DRAFT CAPITAL EFFICIENCY
    # ══════════════════════════════════════════════════════════════════════
    squad_size = len(players)
    field_sc_total = sum(p.sc_avg or 0 for p in field_players)
    roster_efficiency = round(_safe_div(field_sc_total, squad_size), 1)

    bench_scs = [p.sc_avg or 0 for p in bench_players]
    bench_avg_sc = round(_safe_div(sum(bench_scs), len(bench_scs)), 1) if bench_scs else 0
    dead_weight_count = sum(1 for sc in bench_scs if sc < 40)

    # ══════════════════════════════════════════════════════════════════════
    # NEW SECTION E: AFL TEAM EXPOSURE
    # ══════════════════════════════════════════════════════════════════════
    team_exposure, max_exposure = _compute_team_exposure(field_players, total_field)

    # Compute pairwise correlations for same-team players
    exposure_correlations = _compute_exposure_correlation(field_players, year)

    # ══════════════════════════════════════════════════════════════════════
    # NEW SECTION F: FUTURE PROJECTION (1-2 year outlook)
    # ══════════════════════════════════════════════════════════════════════
    projected_next_year = 0.0
    aging_out = []  # biggest decliners
    aging_in = []   # biggest improvers
    player_projections = {}  # player_id -> projected_sc

    for p in field_players:
        pos = _primary_pos(p.position)
        age = p.age or 25
        current_sc = p.sc_avg or 0
        personal_peak = profile_tags.get(p.id, {}).get("peak_avg", current_sc)
        if personal_peak <= 0:
            personal_peak = current_sc

        # Project at age + 1
        projected = _expected_sc_for_player(age_curves, pos, age + 1, personal_peak)
        if projected is None:
            # No curve data: use trajectory from profile tags as fallback
            traj = profile_tags.get(p.id, {}).get("trajectory", 0)
            projected = max(0, current_sc + traj)

        projected = round(projected, 1)
        player_projections[p.id] = projected
        projected_next_year += projected

        change = round(projected - current_sc, 1)
        entry = {
            "name": p.name,
            "age": age,
            "current_sc": round(current_sc, 1),
            "projected_sc": projected,
            "change": change,
        }
        if change < -2:
            aging_out.append(entry)
        elif change > 2:
            aging_in.append(entry)

    projected_next_year = round(projected_next_year, 1)
    projected_change_pct = round(
        _safe_div(projected_next_year - field_sc_total, field_sc_total) * 100, 1
    )
    aging_out.sort(key=lambda x: x["change"])        # most decline first
    aging_in.sort(key=lambda x: -x["change"])         # most improvement first

    # ══════════════════════════════════════════════════════════════════════
    # NEW SECTION G: ENHANCED PER-PLAYER ANALYSIS
    # ══════════════════════════════════════════════════════════════════════
    player_deep = []
    for p in field_players:
        t = profile_tags.get(p.id, {})
        pos = _primary_pos(p.position)
        age = p.age or 0
        sc = p.sc_avg or 0
        baseline_sc = p.sc_avg_prev or t.get("peak_avg", 0) or 0

        # Diff vs baseline
        if baseline_sc > 0:
            diff = sc - baseline_sc
            diff_pct = round(diff / baseline_sc * 100, 1)
        else:
            diff = 0
            diff_pct = 0

        # Per-round scores this season
        stats = (
            PlayerStat.query
            .filter_by(player_id=p.id, year=year)
            .filter(PlayerStat.round > 0, PlayerStat.supercoach_score.isnot(None))
            .order_by(PlayerStat.round)
            .all()
        )
        round_scores_player = [s.supercoach_score for s in stats]

        # ── vs age curve ──
        personal_peak = t.get("peak_avg", sc)
        if personal_peak <= 0:
            personal_peak = sc
        expected_curve = _expected_sc_for_player(age_curves, pos, age, personal_peak)
        if expected_curve and expected_curve > 0:
            vs_curve = round(sc - expected_curve, 1)
            vs_curve_pct = round(_safe_div(vs_curve, expected_curve) * 100, 1)
        else:
            vs_curve = 0
            vs_curve_pct = 0

        # ── z-score (within their own game-by-game distribution) ──
        if len(round_scores_player) >= 3:
            p_mean = sum(round_scores_player) / len(round_scores_player)
            p_std = _std_dev(round_scores_player)
            z_score = round(_safe_div(sc - p_mean, p_std), 2) if p_std > 0 else 0
        else:
            z_score = 0

        # ── last 3 trend ──
        if len(round_scores_player) >= 3:
            last3 = round_scores_player[-3:]
            l3_avg = sum(last3) / 3
            season_p_avg = sum(round_scores_player) / len(round_scores_player)
            l3_trend = round(l3_avg - season_p_avg, 1)
        elif len(round_scores_player) >= 1:
            l3_trend = 0.0
        else:
            l3_trend = 0.0

        # ── ceiling (p90) and floor (p10) ──
        if len(round_scores_player) >= 3:
            sorted_scores = sorted(round_scores_player)
            ceiling = round(_percentile(sorted_scores, 90), 1)
            floor = round(_percentile(sorted_scores, 10), 1)
        elif round_scores_player:
            ceiling = max(round_scores_player)
            floor = min(round_scores_player)
        else:
            ceiling = sc
            floor = sc

        # ── VORP ──
        repl = replacement_levels.get(pos, 0)
        p_vorp = round(sc - repl, 1)

        # ── Projected next year ──
        projected_next = player_projections.get(p.id, sc)

        player_deep.append({
            "name": p.name,
            "position": pos,
            "age": age,
            "sc": round(sc, 1),
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
        })
    player_deep.sort(key=lambda x: -x["sc"])

    # ══════════════════════════════════════════════════════════════════════
    # ASSEMBLE FINAL RESULT
    # ══════════════════════════════════════════════════════════════════════
    return {
        # ── Composition (original) ──
        "squad_size": squad_size,
        "field_count": total_field,
        "bench_count": len(bench_players),
        "tier_counts": dict(tier_counts),
        "tier_players": dict(tier_players),
        "quality_pct": quality_pct,

        # ── Age (original) ──
        "avg_age": avg_age,
        "age_buckets": age_buckets,
        "peak_phases": dict(peak_phases),
        "window": window,
        "window_detail": window_detail,
        "now_pct": now_pct,
        "future_pct": future_pct,

        # ── Scoring (original) ──
        "total_sc": round(total_sc, 0),
        "avg_sc": avg_sc,
        "top5_pct": top5_pct,
        "sc_std": sc_std,
        "season_avg": season_avg,
        "form_avg": form_avg,
        "form_vs_season": form_vs_season,

        # ── Position (original) ──
        "pos_breakdown": {k: dict(v) for k, v in pos_breakdown.items()},
        "pos_balance_score": pos_balance_score,
        "pos_notes": pos_notes,

        # ── Trajectory (original) ──
        "avg_trajectory": avg_trajectory,
        "rising_count": rising_count,
        "declining_count": declining_count,

        # ── Reliability (original) ──
        "avg_consistency": avg_consistency,
        "avg_durability": avg_durability,
        "injury_risk": injury_risk,

        # ── Performance (original) ──
        "round_data": round_data,
        "vs_expectation": vs_expectation,
        # Keep player_vs_baseline for backward compatibility
        "player_vs_baseline": player_deep,

        # ── League context (original) ──
        "league_avg_sc": league_avg_sc,
        "league_avg_age": league_avg_age,
        "sc_vs_league": round(avg_sc - league_avg_sc, 1),
        "age_vs_league": round(avg_age - league_avg_age, 1),

        # ══════════════════════════════════════════════════════════════════
        # NEW FIELDS
        # ══════════════════════════════════════════════════════════════════

        # ── Age curve model ──
        "age_curves": age_curves,
        "player_vs_curve": player_vs_curve,

        # ── Monte Carlo ──
        "mc_p10": mc_results["mc_p10"],
        "mc_p25": mc_results["mc_p25"],
        "mc_p50": mc_results["mc_p50"],
        "mc_p75": mc_results["mc_p75"],
        "mc_p90": mc_results["mc_p90"],
        "mc_distribution": mc_results["mc_distribution"],
        "mc_labels": mc_results["mc_labels"],

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

        # ── Future projection ──
        "projected_next_year": projected_next_year,
        "projected_change_pct": projected_change_pct,
        "aging_out": aging_out[:10],    # top 10 decliners
        "aging_in": aging_in[:10],      # top 10 improvers

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

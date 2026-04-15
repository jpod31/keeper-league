"""Dynasty Simulator — 5-year roster projection with positional constraints.

For each year (now through +5), projects every rostered player's SC,
then auto-selects the optimal 23 (6 DEF, 9 MID, 1 RUC, 6 FWD) from
projected values. Kids who develop displace aging veterans naturally.

Runs for ALL teams in the league for head-to-head comparison.
"""

import math
import logging
from collections import defaultdict

from models.database import (
    db, AflPlayer, FantasyRoster, FantasyTeam, LeaguePositionSlot,
    StateLeagueStat,
)

logger = logging.getLogger(__name__)

# Position requirements (field only, not bench/flex)
_DEFAULT_POS = {"DEF": 6, "MID": 9, "RUC": 1, "FWD": 6}


def _get_position_requirements(league_id):
    """Get position requirements from league config, fall back to defaults."""
    slots = LeaguePositionSlot.query.filter_by(league_id=league_id, is_bench=False).all()
    if not slots:
        return dict(_DEFAULT_POS)
    reqs = {}
    for s in slots:
        if s.position_code in ("DEF", "MID", "FWD", "RUC"):
            reqs[s.position_code] = s.count
    result = reqs if reqs else dict(_DEFAULT_POS)
    result["_league_id"] = league_id  # pass through for flex lookup
    return result


# ── Position-specific absolute ceilings (based on all-time SC data) ──
# These are HARD CAPS. The very best season ever by position.
# Personal ceilings are much lower for 99% of players.
_POS_CEILING = {"DEF": 120, "MID": 128, "FWD": 125, "RUC": 132}
_ABSOLUTE_CEILING = 128

# ── Age-based development multipliers (vs peak) ──
# Corrected for survivorship bias. Peak is 27-28.
_AGE_CURVE = {
    18: 0.55, 19: 0.60, 20: 0.66, 21: 0.72, 22: 0.78, 23: 0.84,
    24: 0.90, 25: 0.95, 26: 0.98, 27: 1.00, 28: 0.99, 29: 0.97,
    30: 0.93, 31: 0.88, 32: 0.82, 33: 0.75, 34: 0.67, 35: 0.58,
    36: 0.48, 37: 0.38,
}


def _get_age_multiplier(age):
    if age in _AGE_CURVE:
        return _AGE_CURVE[age]
    if age < 18:
        return 0.55
    if age > 37:
        return max(0.3, 0.45 - (age - 37) * 0.1)
    return 0.5


_true_level_cache: dict[int, float] = {}
_ceiling_cache: dict[int, float] = {}


def _precompute_true_levels(player_ids: list[int]):
    """Batch-compute true levels for all players in one query."""
    from models.database import PlayerStat
    from sqlalchemy import func

    if not player_ids:
        return

    # Single query: get all season averages for all players
    rows = db.session.query(
        PlayerStat.player_id,
        PlayerStat.year,
        func.avg(PlayerStat.supercoach_score).label("avg"),
        func.count().label("gm"),
    ).filter(
        PlayerStat.player_id.in_(player_ids),
        PlayerStat.supercoach_score > 0,
    ).group_by(PlayerStat.player_id, PlayerStat.year).all()

    # Group by player
    by_player: dict[int, list] = {}
    for pid, yr, avg, gm in rows:
        by_player.setdefault(pid, []).append((yr, float(avg), gm))

    for pid in player_ids:
        seasons = sorted(by_player.get(pid, []), key=lambda x: -x[0])[:4]
        if not seasons:
            p = db.session.get(AflPlayer, pid)
            _true_level_cache[pid] = (p.sc_avg or p.sc_avg_prev or (p.rating or 60) * 0.8) if p else 60
            continue

        weighted_sum = 0.0
        weight_total = 0.0
        for i, (yr, avg, gm) in enumerate(seasons):
            recency = 1.0 - i * 0.2
            sample_weight = min(gm / 20.0, 1.0)
            w = recency * sample_weight * gm
            weighted_sum += avg * w
            weight_total += w
        _true_level_cache[pid] = round(weighted_sum / weight_total, 1) if weight_total > 0 else 60


def _compute_true_level(player):
    """Get cached true level, or compute on the fly."""
    if player.id in _true_level_cache:
        return _true_level_cache[player.id]
    _precompute_true_levels([player.id])
    return _true_level_cache.get(player.id, player.sc_avg or 60)


def _get_ceiling(player):
    """Get the realistic SC ceiling for a player (cached)."""
    if player.id in _ceiling_cache:
        return _ceiling_cache[player.id]
    val = _get_ceiling_inner(player)
    _ceiling_cache[player.id] = val
    return val


def _get_ceiling_inner(player):
    """Get the realistic SC ceiling for a player.

    Uses multiple signals weighted by reliability:
    1. Multi-year AFL history (strongest — proven over full seasons)
    2. Rating/potential (front-office assessment, good for young players)
    3. State league data + scouting model (for developing players with little AFL data)
    4. Draft pick quality (higher picks have higher ceilings)
    5. Career trajectory slope (sustained improvement vs one-off spikes)
    """
    pos = ((player.position or "MID").split("/")[0])
    pos_cap = _POS_CEILING.get(pos, _ABSOLUTE_CEILING)
    age = player.age or 25
    career = player.career_games or 0

    # True level from multi-year history (regressed for small samples)
    true_level = _compute_true_level(player)
    potential = player.potential or 0
    rating = player.rating or 0

    # ── State league signal (for young/developing players) ──
    sl_signal = 0
    if age <= 27 and career < 80:
        try:
            sl = StateLeagueStat.query.filter_by(player_id=player.id)\
                .filter(StateLeagueStat.competition.in_(["vfl", "sanfl", "wafl"]))\
                .order_by(StateLeagueStat.season.desc()).first()
            if sl and sl.dreamteam_avg:
                sl_signal = sl.dreamteam_avg * 0.65
        except Exception:
            pass
    # Note: scouting model prediction skipped here for performance.
    # It's too slow for batch dynasty sim (200+ players × 6 teams).
    # State league signal + rating/potential is sufficient for ceiling estimation.
    model_signal = 0

    # ── Ceiling estimation ──
    # The ceiling is how good this player COULD be at their peak.
    # Most players' ceiling is only modestly above their proven level.

    if true_level >= 115:
        # Already proven elite (Bontempelli, Daicos tier)
        # Ceiling is basically where they are — maybe 3-5% upside
        personal_ceiling = min(true_level * 1.03, pos_cap)
    elif true_level >= 100:
        # Very good — some upside but not unlimited
        upside = 1.06 if age <= 26 else 1.03
        personal_ceiling = min(true_level * upside, pos_cap * 0.95)
    elif true_level >= 85:
        # Good — moderate upside, more for young players
        upside = 1.12 if age <= 24 else 1.08 if age <= 27 else 1.04
        personal_ceiling = min(true_level * upside, pos_cap * 0.88)
    elif true_level >= 70:
        # Decent — young players could improve significantly
        upside = 1.18 if age <= 23 else 1.12 if age <= 26 else 1.05
        # Blend with scouting model for developing players
        est = true_level * upside
        if model_signal > est:
            est = est * 0.7 + model_signal * 0.3
        personal_ceiling = min(est, pos_cap * 0.82)
    elif potential >= 85 and age <= 24:
        # High potential youngster with little AFL data
        est = max(true_level * 1.25, potential * 0.95, model_signal, sl_signal * 1.1)
        personal_ceiling = min(est, pos_cap * 0.80)
    elif model_signal > 0 and age <= 25:
        # Scouting model is our best guide
        personal_ceiling = min(model_signal * 1.05, pos_cap * 0.75)
    elif sl_signal > 0 and age <= 25:
        personal_ceiling = min(sl_signal * 1.1, pos_cap * 0.70)
    elif rating >= 70:
        personal_ceiling = min(rating * 1.05, pos_cap * 0.70)
    else:
        personal_ceiling = min(max(true_level * 1.1, 55), pos_cap * 0.60)

    return round(min(personal_ceiling, pos_cap), 1)


def _project_player_at_age(player, target_age, profile_tag, age_curves):
    """Project a player's SC at a specific age.

    Uses a ceiling-bounded model:
    1. Estimate the player's personal SC ceiling (based on position, current SC, rating)
    2. Apply age curve to determine what fraction of ceiling they express at each age
    3. Blend with trajectory data for near-term (1-2 year) adjustments
    4. Hard cap at position ceiling — nobody exceeds historical maximums

    This prevents runaway projections (no more 163 SC averages).
    """
    current_age = player.age or 25
    years_ahead = target_age - current_age
    if years_ahead <= 0:
        return _compute_true_level(player)

    base = _compute_true_level(player)
    ceiling = _get_ceiling(player)
    traj = profile_tag.get("trajectory", 0)

    # Age curve: what fraction of ceiling does this player express now vs at target age?
    current_mult = _get_age_multiplier(current_age)
    target_mult = _get_age_multiplier(target_age)

    # Implied peak SC (what ceiling the player is "on track for" based on current)
    if current_mult > 0:
        implied_peak = base / current_mult
    else:
        implied_peak = base

    # Cap implied peak at personal ceiling
    implied_peak = min(implied_peak, ceiling)

    # Base projection from age curve
    projected = implied_peak * target_mult

    # Near-term trajectory adjustment (only for 1-2 years out, diminishing)
    if years_ahead <= 2 and traj != 0:
        # Cap trajectory contribution: max +/- 8 per year
        capped_traj = max(-8, min(8, traj))
        traj_boost = capped_traj * max(0, 1.0 - (years_ahead - 1) * 0.5)
        projected += traj_boost

    # Hard ceiling: never exceed position max
    pos = ((player.position or "MID").split("/")[0])
    hard_cap = _POS_CEILING.get(pos, _ABSOLUTE_CEILING)
    projected = min(projected, hard_cap)

    # Floor: don't project below 30 (player would be delisted)
    projected = max(projected, 30)

    return round(projected, 1)


def _select_best_23(players_with_projections, pos_requirements):
    """Select the optimal 23 players given positional constraints.

    Args:
        players_with_projections: [(AflPlayer, projected_sc, projected_age)]
        pos_requirements: {"DEF": 6, "MID": 9, "RUC": 1, "FWD": 6}

    Returns: (total_sc, selected_players_list, emergencies_list)
    """
    # Group players by primary position
    by_pos = defaultdict(list)
    for entry in players_with_projections:
        p, sc = entry[0], entry[1]
        proj_age = entry[2] if len(entry) > 2 else (p.age or 0)
        positions = (p.position or "MID").split("/")
        primary = positions[0]
        by_pos[primary].append((p, sc, positions, proj_age))

    # Sort each position group by projected SC descending
    for pos in by_pos:
        by_pos[pos].sort(key=lambda x: -x[1])

    selected = []
    used_ids = set()
    remaining = []

    # First pass: fill each position with the required number
    for pos, count in pos_requirements.items():
        candidates = by_pos.get(pos, [])
        filled = 0
        for p, sc, positions, proj_age in candidates:
            if filled >= count:
                break
            if p.id not in used_ids:
                selected.append({"name": p.name, "position": pos, "sc": sc, "age": proj_age})
                used_ids.add(p.id)
                filled += 1

    # Second pass: fill remaining spots with FLEX (any position, best available)
    # Include FLEX slots — check league config for bench/flex count
    flex_count = 1  # default
    try:
        flex_slots = LeaguePositionSlot.query.filter_by(
            league_id=pos_requirements.get("_league_id", 0),
            is_bench=True, position_code="FLEX"
        ).first()
        if flex_slots:
            flex_count = flex_slots.count
    except Exception:
        pass
    total_needed = sum(v for k, v in pos_requirements.items() if k != "_league_id") + flex_count
    all_remaining = []
    for pos_list in by_pos.values():
        for p, sc, positions, proj_age in pos_list:
            if p.id not in used_ids:
                all_remaining.append((p, sc, positions, proj_age))
    all_remaining.sort(key=lambda x: -x[1])

    while len(selected) < total_needed and all_remaining:
        p, sc, positions, proj_age = all_remaining.pop(0)
        if p.id not in used_ids:
            selected.append({"name": p.name, "position": positions[0], "sc": sc, "age": proj_age})
            used_ids.add(p.id)

    # Also try to improve: check if any dual-position player not selected
    # could replace a weaker player at an alternative position
    unselected = [(p, sc, pos, pa) for p, sc, pos, pa in
                  [(p, sc, pos, pa) for plist in by_pos.values() for p, sc, pos, pa in plist]
                  if p.id not in used_ids]
    unselected.sort(key=lambda x: -x[1])

    for p, sc, positions, proj_age in unselected[:10]:
        for alt_pos in positions:
            weakest = None
            weakest_idx = -1
            for i, sel in enumerate(selected):
                if sel["position"] == alt_pos and sel["sc"] < sc:
                    if weakest is None or sel["sc"] < weakest["sc"]:
                        weakest = sel
                        weakest_idx = i
            if weakest and sc - weakest["sc"] > 5:
                selected[weakest_idx] = {"name": p.name, "position": alt_pos, "sc": sc, "age": proj_age}
                used_ids.add(p.id)
                break

    total = sum(s["sc"] for s in selected)

    # Emergency selections: best 4 players not in the 23
    emergencies = []
    for p, sc, positions, proj_age in all_remaining:
        if p.id not in used_ids and len(emergencies) < 4:
            emergencies.append({"name": p.name, "position": positions[0], "sc": sc,
                                "age": proj_age, "is_emergency": True})
    # Mark selected players
    for s in selected:
        s["is_emergency"] = False

    return round(total, 1), selected, emergencies


def simulate_dynasty(league_id, year, profile_tags, years_ahead=5):
    """Run the dynasty simulation for all teams.

    Returns: {
        team_id: {
            "name": str,
            "years": [
                {"year": int, "total": float, "squad": [{"name","position","sc","age"}]}
            ]
        }
    }
    """
    pos_reqs = _get_position_requirements(league_id)
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()

    # Load age curves (reuse if cached)
    from models.team_analytics import _load_historical_sc, _build_role_aware_age_curves
    records = _load_historical_sc()
    all_players_db = AflPlayer.query.all()

    # Precompute true levels for ALL rostered players in one batch query
    all_player_ids = set()
    team_players_map = {}
    for team in teams:
        roster = FantasyRoster.query.filter_by(team_id=team.id, is_active=True).all()
        players = [db.session.get(AflPlayer, r.player_id) for r in roster]
        players = [p for p in players if p]
        team_players_map[team.id] = players
        all_player_ids.update(p.id for p in players)

    _true_level_cache.clear()
    _ceiling_cache.clear()
    _precompute_true_levels(list(all_player_ids))

    results = {}

    for team in teams:
        players = team_players_map.get(team.id, [])

        team_years = []

        for offset in range(years_ahead + 1):
            target_year = year + offset

            # Project each player
            projections = []
            for p in players:
                target_age = (p.age or 25) + offset
                pt = profile_tags.get(p.id, {})

                if offset == 0:
                    # Current year: use best estimate of true ability, NOT
                    # current season avg (which is volatile due to byes,
                    # injuries, small sample). Blend current + prev + rating.
                    sc = p.sc_avg or 0
                    prev = p.sc_avg_prev or 0
                    games = p.games_played or 0
                    if sc > 0 and prev > 0 and games >= 5:
                        # Enough data: lean on current avg
                        sc = sc
                    elif sc > 0 and prev > 0:
                        # Small sample: blend with last year
                        weight = min(games / 10, 0.7)
                        sc = sc * weight + prev * (1 - weight)
                    elif sc == 0 and prev > 0:
                        # Hasn't played yet this year (injured/rested): use last year
                        sc = prev
                    elif sc == 0 and p.rating:
                        sc = p.rating * 1.0
                else:
                    sc = _project_player_at_age(p, target_age, pt, {})

                projections.append((p, sc, target_age))

            # Select best 23 + 4 emergencies
            total, squad, emg = _select_best_23(projections, pos_reqs)

            team_years.append({
                "year": target_year,
                "offset": offset,
                "total": total,
                "squad": sorted(squad, key=lambda x: -x["sc"]) + sorted(emg, key=lambda x: -x["sc"]),
            })

        results[team.id] = {
            "name": team.name,
            "years": team_years,
        }

    return results

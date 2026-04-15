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
# No player in AFL history has sustained above these over a full season.
_POS_CEILING = {"DEF": 125, "MID": 132, "FWD": 130, "RUC": 138}
_ABSOLUTE_CEILING = 138  # fallback

# ── Age-based development multipliers (vs peak) ──
# Based on historical data, corrected for survivorship bias.
# Peak is 26-28 for most positions. Values are fraction of peak ability.
_AGE_CURVE = {
    18: 0.58, 19: 0.63, 20: 0.68, 21: 0.74, 22: 0.80, 23: 0.86,
    24: 0.92, 25: 0.96, 26: 0.99, 27: 1.00, 28: 0.99, 29: 0.97,
    30: 0.94, 31: 0.90, 32: 0.85, 33: 0.79, 34: 0.72, 35: 0.64,
    36: 0.55, 37: 0.45,
}


def _get_age_multiplier(age):
    if age in _AGE_CURVE:
        return _AGE_CURVE[age]
    if age < 18:
        return 0.55
    if age > 37:
        return max(0.3, 0.45 - (age - 37) * 0.1)
    return 0.5


def _get_ceiling(player):
    """Get the realistic SC ceiling for a player based on position, talent,
    state league performance, and scouting model projection.

    Uses multiple signals:
    - AFL SC history (strongest signal for established players)
    - Rating/potential (front-office assessment)
    - State league fantasy avg (VFL/SANFL/WAFL indicator for developing players)
    - Scouting model AFL projection (for players with state league data)
    """
    pos = ((player.position or "MID").split("/")[0])
    pos_cap = _POS_CEILING.get(pos, _ABSOLUTE_CEILING)

    best_sc = max(player.sc_avg or 0, player.sc_avg_prev or 0)
    rating = player.rating or 0
    potential = player.potential or 0
    age = player.age or 25

    # For young/developing players, check state league data
    sl_signal = 0
    if age <= 26:
        try:
            sl = StateLeagueStat.query.filter_by(player_id=player.id)\
                .filter(StateLeagueStat.competition.in_(["vfl", "sanfl", "wafl"]))\
                .order_by(StateLeagueStat.season.desc()).first()
            if sl and sl.dreamteam_avg:
                # VFL fantasy avg translates to ~60-70% of AFL equivalent
                # A 100+ VFL fantasy avg suggests 70-80 AFL ceiling potential
                sl_signal = sl.dreamteam_avg * 0.7
        except Exception:
            pass

    # For players with scouting model predictions, use that too
    model_signal = 0
    if age <= 26 and (best_sc < 80 or not best_sc):
        try:
            from models.scouting_model import predict_afl_output
            pred = predict_afl_output(player_id=player.id)
            if pred:
                model_signal = pred["predicted_afl"].get("afl_sc_avg", 0)
        except Exception:
            pass

    # Combine signals to estimate ceiling
    if best_sc >= 110:
        personal_ceiling = min(best_sc * 1.08, pos_cap)
    elif best_sc >= 90:
        personal_ceiling = min(best_sc * 1.12, pos_cap * 0.92)
    elif best_sc >= 70:
        # Blend AFL data with scouting model for players still developing
        afl_est = best_sc * 1.18
        if model_signal > 0:
            afl_est = max(afl_est, model_signal * 1.05)
        personal_ceiling = min(afl_est, pos_cap * 0.85)
    elif potential and potential >= 80:
        # High potential but hasn't shown it at AFL level yet
        pot_est = potential * 1.1
        personal_ceiling = min(max(pot_est, model_signal, sl_signal), pos_cap * 0.82)
    elif model_signal > 0:
        # Scouting model gives us a projection
        personal_ceiling = min(model_signal * 1.1, pos_cap * 0.80)
    elif sl_signal > 0:
        # Only state league data to go on
        personal_ceiling = min(sl_signal * 1.15, pos_cap * 0.75)
    elif rating and rating >= 70:
        personal_ceiling = min(rating * 1.2, pos_cap * 0.75)
    else:
        personal_ceiling = min(max(best_sc * 1.15, 60), pos_cap * 0.65)

    return round(personal_ceiling, 1)


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
        return player.sc_avg or player.sc_avg_prev or 0

    # Current SC: best estimate of true ability
    sc = player.sc_avg or 0
    sc_prev = player.sc_avg_prev or 0
    games = player.games_played or 0
    career = player.career_games or 0

    # Robust base estimate
    if sc > 0 and games >= 5:
        base = sc
    elif sc > 0 and sc_prev > 0:
        weight = min(games / 10, 0.6)
        base = sc * weight + sc_prev * (1 - weight)
    elif sc > 0:
        base = sc * 0.7 + 60 * 0.3  # regress toward mean
    elif sc_prev > 0:
        base = sc_prev
    elif player.rating:
        base = player.rating * 0.8
    else:
        base = 55 if career > 20 else 45

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

    results = {}

    for team in teams:
        roster = FantasyRoster.query.filter_by(team_id=team.id, is_active=True).all()
        players = [db.session.get(AflPlayer, r.player_id) for r in roster]
        players = [p for p in players if p]

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

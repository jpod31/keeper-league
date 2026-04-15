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


def _estimate_kid_projection(player, age_at_year, profile_tag):
    """Estimate SC for a young player with limited data.

    Uses a blend of:
    1. Actual SC data (if any)
    2. Historical trajectory
    3. Career games as a maturity indicator
    4. Height-based role inference

    More career games = more confidence in current SC.
    Fewer career games = more regression to a development curve.
    """
    sc = player.sc_avg or 0
    sc_prev = player.sc_avg_prev or 0
    career = player.career_games or 0
    traj = profile_tag.get("trajectory", 0)
    current_age = player.age or 20

    # Base estimate: use actual if available, else prev, else baseline
    if sc > 0 and (player.games_played or 0) >= 3:
        base = sc
    elif sc > 0:
        # Few games this year — regress toward prev year
        base = sc * 0.6 + (sc_prev if sc_prev > 0 else 60) * 0.4
    elif sc_prev > 0:
        base = sc_prev
    else:
        # No data at all — use age-based baseline
        # Young players with more career games are more established
        if career >= 30:
            base = 65  # established but no current data
        elif career >= 10:
            base = 55
        else:
            base = 45  # very raw

    # Apply trajectory for future years
    years_ahead = age_at_year - current_age
    if years_ahead <= 0:
        return round(base, 1)

    if traj > 0:
        # Positive trajectory: apply with diminishing returns
        # Year 1: full traj, Year 2: 80%, Year 3: 60%, etc.
        projected = base
        for y in range(years_ahead):
            decay = max(0.4, 1.0 - y * 0.15)
            projected += traj * decay
        return round(max(projected, base * 0.8), 1)
    else:
        # Flat or negative: young players usually improve regardless
        # Apply a gentle development curve: +3-5 per year until ~25
        annual_dev = max(0, 5.0 - (current_age - 18) * 0.5) if current_age < 25 else 0
        projected = base + annual_dev * years_ahead + traj * years_ahead * 0.3
        return round(max(projected, base * 0.7), 1)


def _project_player_at_age(player, target_age, profile_tag, age_curves):
    """Project a player's SC at a specific age.

    For players under 25 with limited data, uses the kid projection model.
    For established players, uses age curve decay/growth.
    """
    current_age = player.age or 25
    sc = player.sc_avg or player.sc_avg_prev or 0
    years_ahead = target_age - current_age

    if years_ahead <= 0:
        return sc

    # Kids (under 25 with < 50 career games): use development model
    if current_age < 25 and (player.career_games or 0) < 80:
        return _estimate_kid_projection(player, target_age, profile_tag)

    # Established players: use trajectory for near-term, age curve for longer
    traj = profile_tag.get("trajectory", 0)
    peak_phase = profile_tag.get("peak_phase", "peak")

    if peak_phase == "pre-peak" and traj > 0:
        # Still improving — use trajectory with decay
        projected = sc
        for y in range(years_ahead):
            decay = max(0.3, 1.0 - y * 0.2)
            projected += traj * decay
        return round(projected, 1)
    elif peak_phase == "peak":
        # At peak — slight decline per year
        decline = 2.0 * years_ahead
        return round(max(sc - decline, sc * 0.75), 1)
    else:
        # Post-peak — steeper decline
        decline_rate = 0.04 + 0.01 * max(0, current_age - 30)
        projected = sc * ((1 - decline_rate) ** years_ahead)
        return round(max(projected, 30), 1)


def _select_best_23(players_with_projections, pos_requirements):
    """Select the optimal 23 players given positional constraints.

    Args:
        players_with_projections: [(AflPlayer, projected_sc)]
        pos_requirements: {"DEF": 6, "MID": 9, "RUC": 1, "FWD": 6}

    Returns: (total_sc, selected_players_list)
    """
    # Group players by primary position
    by_pos = defaultdict(list)
    for p, sc in players_with_projections:
        positions = (p.position or "MID").split("/")
        primary = positions[0]
        by_pos[primary].append((p, sc, positions))

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
        for p, sc, positions in candidates:
            if filled >= count:
                break
            if p.id not in used_ids:
                selected.append({"name": p.name, "position": pos, "sc": sc, "age": p.age or 0})
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
        for p, sc, positions in pos_list:
            if p.id not in used_ids:
                all_remaining.append((p, sc, positions))
    all_remaining.sort(key=lambda x: -x[1])

    while len(selected) < total_needed and all_remaining:
        p, sc, positions = all_remaining.pop(0)
        if p.id not in used_ids:
            selected.append({"name": p.name, "position": positions[0], "sc": sc, "age": p.age or 0})
            used_ids.add(p.id)

    # Also try to improve: check if any dual-position player not selected
    # could replace a weaker player at an alternative position
    # (This is a simple greedy approach, not globally optimal, but good enough)
    unselected = [(p, sc, pos) for p, sc, pos in
                  [(p, sc, pos) for plist in by_pos.values() for p, sc, pos in plist]
                  if p.id not in used_ids]
    unselected.sort(key=lambda x: -x[1])

    for p, sc, positions in unselected[:10]:  # check top 10 unselected
        for alt_pos in positions:
            # Find the weakest selected player at this position
            weakest = None
            weakest_idx = -1
            for i, sel in enumerate(selected):
                if sel["position"] == alt_pos and sel["sc"] < sc:
                    if weakest is None or sel["sc"] < weakest["sc"]:
                        weakest = sel
                        weakest_idx = i
            if weakest and sc - weakest["sc"] > 5:
                # Swap
                selected[weakest_idx] = {"name": p.name, "position": alt_pos, "sc": sc, "age": p.age or 0}
                used_ids.add(p.id)
                break

    total = sum(s["sc"] for s in selected)

    # Emergency selections: best 4 players not in the 23
    emergencies = []
    for p, sc, positions in all_remaining:
        if p.id not in used_ids and len(emergencies) < 4:
            emergencies.append({"name": p.name, "position": positions[0], "sc": sc,
                                "age": p.age or 0, "is_emergency": True})
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
                    # Current year: use actual SC. For injured players who
                    # haven't played (sc_avg=0), fall back to last year's
                    # average so they aren't dropped from the best-23.
                    sc = p.sc_avg or 0
                    if sc == 0:
                        sc = p.sc_avg_prev or 0
                    if sc == 0 and p.rating:
                        sc = p.rating * 1.0
                else:
                    sc = _project_player_at_age(p, target_age, pt, {})

                projections.append((p, sc))

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

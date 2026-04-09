"""Team Analytics — deep statistical analysis of roster composition and outlook.

Provides team-level metrics by aggregating per-player profile tag data,
historical scoring, positional balance, age curves, and trajectory analysis.
"""

import math
import logging
from collections import defaultdict

from models.database import (
    db, FantasyRoster, AflPlayer, PlayerStat, RoundScore,
    FantasyTeam, Fixture,
)

logger = logging.getLogger(__name__)

# Position requirements for a balanced squad (on-field)
_IDEAL_FIELD = {"DEF": 5, "MID": 7, "FWD": 5, "RUC": 1}


def compute_team_analytics(team_id, league_id, year, profile_tags):
    """Compute comprehensive team analytics.

    Args:
        team_id: FantasyTeam ID
        league_id: League ID
        year: Season year
        profile_tags: dict from compute_profile_tags() — {player_id: {...}}

    Returns: dict with all analytics sections
    """
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    players = [db.session.get(AflPlayer, r.player_id) for r in roster]
    players = [p for p in players if p]
    roster_map = {r.player_id: r for r in roster}

    if not players:
        return {}

    # ── 1. ROSTER COMPOSITION ──
    field_players = [p for p in players if not roster_map[p.id].is_benched]
    bench_players = [p for p in players if roster_map[p.id].is_benched]

    # Tier distribution
    tier_counts = defaultdict(int)
    tier_players = defaultdict(list)
    for p in players:
        t = profile_tags.get(p.id, {})
        tag = t.get("tag", "Unclassified")
        tier_counts[tag] += 1
        tier_players[tag].append(p.name)

    # Tier quality score: weighted by tier value
    _TIER_WEIGHTS = {
        "Elite": 10, "Elite Veteran": 9, "Premium": 8,
        "Emerging Star": 7, "Breakout": 6, "Proven": 5,
        "Steady": 3, "Developing": 2, "Project": 1,
        "Veteran": 2, "Declining": 1, "Fringe": 0, "Unclassified": 0,
    }
    roster_quality = sum(_TIER_WEIGHTS.get(profile_tags.get(p.id, {}).get("tag", ""), 0) for p in field_players)
    max_quality = len(field_players) * 10
    quality_pct = round(roster_quality / max(max_quality, 1) * 100, 1)

    # ── 2. AGE PROFILE ──
    ages = [p.age for p in players if p.age]
    avg_age = round(sum(ages) / len(ages), 1) if ages else 0
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

    # Peak phase distribution
    peak_phases = defaultdict(int)
    for p in field_players:
        t = profile_tags.get(p.id, {})
        peak_phases[t.get("peak_phase", "unknown")] += 1

    # Window analysis: are we competing now or building?
    peak_count = peak_phases.get("peak", 0)
    pre_peak_count = peak_phases.get("pre-peak", 0)
    post_peak_count = peak_phases.get("post-peak", 0)
    total_field = len(field_players)

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
        window_detail = f"Mix of peak ({peak_count}), pre-peak ({pre_peak_count}), post-peak ({post_peak_count})"

    # ── 3. SCORING ANALYSIS ──
    sc_values = [(p, p.sc_avg or 0) for p in field_players]
    sc_values.sort(key=lambda x: x[1], reverse=True)
    total_sc = sum(v for _, v in sc_values)
    avg_sc = round(total_sc / max(len(sc_values), 1), 1)

    # Top-heavy analysis: how dependent on top players?
    if len(sc_values) >= 5:
        top5_sc = sum(v for _, v in sc_values[:5])
        top5_pct = round(top5_sc / max(total_sc, 1) * 100, 1)
    else:
        top5_pct = 100.0

    # Scoring depth: std dev of field player SC averages
    if len(sc_values) >= 2:
        mean = total_sc / len(sc_values)
        sc_std = round(math.sqrt(sum((v - mean) ** 2 for _, v in sc_values) / len(sc_values)), 1)
    else:
        sc_std = 0

    # ── 4. POSITIONAL BALANCE ──
    pos_breakdown = defaultdict(lambda: {"count": 0, "total_sc": 0, "avg_sc": 0, "players": []})
    for p in field_players:
        primary = (p.position or "MID").split("/")[0]
        sc = p.sc_avg or 0
        pos_breakdown[primary]["count"] += 1
        pos_breakdown[primary]["total_sc"] += sc
        pos_breakdown[primary]["players"].append({"name": p.name, "sc": sc})

    for pos in pos_breakdown:
        c = pos_breakdown[pos]["count"]
        pos_breakdown[pos]["avg_sc"] = round(pos_breakdown[pos]["total_sc"] / max(c, 1), 1)
        pos_breakdown[pos]["players"].sort(key=lambda x: -x["sc"])

    # Positional strength score vs ideal
    pos_balance_score = 0
    pos_notes = []
    for pos, ideal in _IDEAL_FIELD.items():
        actual = pos_breakdown[pos]["count"]
        if actual >= ideal:
            pos_balance_score += 1
        else:
            pos_notes.append(f"{pos} short ({actual}/{ideal})")

    # ── 5. TRAJECTORY / OUTLOOK ──
    trajectories = []
    for p in field_players:
        t = profile_tags.get(p.id, {})
        traj = t.get("trajectory", 0)
        trajectories.append(traj)

    avg_trajectory = round(sum(trajectories) / max(len(trajectories), 1), 1) if trajectories else 0
    rising_count = sum(1 for t in trajectories if t > 3)
    declining_count = sum(1 for t in trajectories if t < -3)

    # ── 6. CONSISTENCY & DURABILITY ──
    consistencies = [profile_tags.get(p.id, {}).get("consistency", 0.5) for p in field_players]
    durabilities = [profile_tags.get(p.id, {}).get("durability", 15) for p in field_players]
    avg_consistency = round(sum(consistencies) / max(len(consistencies), 1), 2)
    avg_durability = round(sum(durabilities) / max(len(durabilities), 1), 1)

    # Injury risk: players with low durability or current injury
    injury_risk = []
    for p in field_players:
        dur = profile_tags.get(p.id, {}).get("durability", 20)
        if p.injury_severity or dur < 14:
            injury_risk.append({
                "name": p.name,
                "reason": p.injury_type or f"Low durability ({dur:.0f} games/yr)",
                "sc": p.sc_avg or 0,
            })

    # ── 7. ROUND-BY-ROUND PERFORMANCE ──
    round_scores = (
        RoundScore.query
        .filter_by(team_id=team_id, year=year)
        .filter(RoundScore.afl_round > 0)
        .order_by(RoundScore.afl_round)
        .all()
    )
    round_data = [{"round": rs.afl_round, "score": rs.total_score} for rs in round_scores]

    # Form: last 3 rounds
    if len(round_data) >= 3:
        form_avg = round(sum(r["score"] for r in round_data[-3:]) / 3, 1)
    elif round_data:
        form_avg = round(sum(r["score"] for r in round_data) / len(round_data), 1)
    else:
        form_avg = 0

    season_avg = round(sum(r["score"] for r in round_data) / max(len(round_data), 1), 1) if round_data else 0
    form_vs_season = round(form_avg - season_avg, 1) if season_avg else 0

    # ── 8. VS EXPECTATION (actual vs projected baseline) ──
    # Baseline: sum of field players' sc_avg
    baseline = sum(p.sc_avg or 0 for p in field_players)
    vs_expectation = []
    for rs in round_scores:
        diff = rs.total_score - baseline
        vs_expectation.append({
            "round": rs.afl_round,
            "actual": rs.total_score,
            "expected": round(baseline, 0),
            "diff": round(diff, 0),
            "pct": round(diff / max(baseline, 1) * 100, 1),
        })

    # ── 9. PER-PLAYER PERFORMANCE VS BASELINE ──
    player_vs_baseline = []
    for p in field_players:
        t = profile_tags.get(p.id, {})
        baseline_sc = p.sc_avg_prev or t.get("peak_avg", 0) or 0
        current_sc = p.sc_avg or 0
        if baseline_sc > 0:
            diff = current_sc - baseline_sc
            diff_pct = round(diff / baseline_sc * 100, 1)
        else:
            diff = 0
            diff_pct = 0

        # Get this season's per-round scores
        stats = (
            PlayerStat.query
            .filter_by(player_id=p.id, year=year)
            .filter(PlayerStat.round > 0, PlayerStat.supercoach_score.isnot(None))
            .order_by(PlayerStat.round)
            .all()
        )
        round_scores_player = [s.supercoach_score for s in stats]

        player_vs_baseline.append({
            "name": p.name,
            "position": (p.position or "MID").split("/")[0],
            "age": p.age or 0,
            "current_sc": current_sc,
            "baseline_sc": round(baseline_sc, 1),
            "diff": round(diff, 1),
            "diff_pct": diff_pct,
            "tag": t.get("tag", ""),
            "tag_css": t.get("css", ""),
            "trajectory": t.get("trajectory", 0),
            "consistency": t.get("consistency", 0.5),
            "composite": t.get("composite", 0),
            "games": p.games_played or 0,
            "round_scores": round_scores_player,
        })
    player_vs_baseline.sort(key=lambda x: -x["current_sc"])

    # ── 10. LEAGUE COMPARISON ──
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

    return {
        # Composition
        "squad_size": len(players),
        "field_count": len(field_players),
        "bench_count": len(bench_players),
        "tier_counts": dict(tier_counts),
        "tier_players": dict(tier_players),
        "quality_pct": quality_pct,

        # Age
        "avg_age": avg_age,
        "age_buckets": age_buckets,
        "peak_phases": dict(peak_phases),
        "window": window,
        "window_detail": window_detail,
        "now_pct": now_pct,
        "future_pct": future_pct,

        # Scoring
        "total_sc": round(total_sc, 0),
        "avg_sc": avg_sc,
        "top5_pct": top5_pct,
        "sc_std": sc_std,
        "season_avg": season_avg,
        "form_avg": form_avg,
        "form_vs_season": form_vs_season,

        # Position
        "pos_breakdown": {k: dict(v) for k, v in pos_breakdown.items()},
        "pos_balance_score": pos_balance_score,
        "pos_notes": pos_notes,

        # Trajectory
        "avg_trajectory": avg_trajectory,
        "rising_count": rising_count,
        "declining_count": declining_count,

        # Reliability
        "avg_consistency": avg_consistency,
        "avg_durability": avg_durability,
        "injury_risk": injury_risk,

        # Performance
        "round_data": round_data,
        "vs_expectation": vs_expectation,
        "player_vs_baseline": player_vs_baseline,

        # League context
        "league_avg_sc": league_avg_sc,
        "league_avg_age": league_avg_age,
        "sc_vs_league": round(avg_sc - league_avg_sc, 1),
        "age_vs_league": round(avg_age - league_avg_age, 1),
    }

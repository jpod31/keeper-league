"""Squad Intelligence — one batched analytics payload for the My Team → Stats
cockpit. Per roster player: AFL stats + your-team usage + derived models (VORP,
projection±, scoring shape, form) + per-round form for the heatmap; plus team
metrics and an auto-generated insight narrative. Cached per team per season.
"""

import statistics

from models.database import db, FantasyTeam, FantasyRoster, AflPlayer
from models.player_usage import compute_player_team_usage, _primary_pos
from scrapers.stats_loader import compute_scoring_profile, compute_player_projection

# Rough on-field starters per position (for the replacement-level baseline)
_STARTERS = {"DEF": 6, "MID": 8, "FWD": 6, "RUC": 2}


def _replacement_levels(league_id):
    """League-wide replacement SC by position = the scoring level of the last
    rosterable starter (band-averaged for stability)."""
    n_teams = max(1, FantasyTeam.query.filter_by(league_id=league_id).count())
    pool = AflPlayer.query.all()
    by_pos = {}
    for p in pool:
        if (p.sc_avg or 0) > 0:
            by_pos.setdefault(_primary_pos(p), []).append(p.sc_avg)
    repl, ranked = {}, {}
    for pos, arr in by_pos.items():
        arr.sort(reverse=True)
        ranked[pos] = arr
        idx = min(n_teams * _STARTERS.get(pos, 6), len(arr) - 1)
        band = arr[max(0, idx - 3): idx + 4] or arr[-5:]
        repl[pos] = round(sum(band) / len(band), 1) if band else 0.0
    return repl, ranked, n_teams


def _percentile(value, sorted_desc):
    """Percentile of value within a descending-sorted list (higher = better)."""
    if not sorted_desc or value is None:
        return None
    below = sum(1 for v in sorted_desc if v <= value)
    return round(below / len(sorted_desc) * 100)


def compute_squad_intel(league_id, team_id, year):
    team = db.session.get(FantasyTeam, team_id)
    if not team:
        return {"has_data": False}

    repl, ranked, n_teams = _replacement_levels(league_id)
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()

    players = []
    for r in roster:
        p = db.session.get(AflPlayer, r.player_id)
        if not p:
            continue
        pos = _primary_pos(p)
        sc = p.sc_avg or 0
        prof = compute_scoring_profile(p.name)
        proj = compute_player_projection(p.name, p.age)
        usage = compute_player_team_usage(league_id, team_id, p.id, year)

        # per-round form (current year) → z vs the player's own season
        rounds = prof.get("current_rounds", []) if prof.get("has_data") else []
        rscores = [x["sc"] for x in rounds]
        if len(rscores) >= 3:
            m = statistics.mean(rscores)
            sd = statistics.pstdev(rscores) or 1.0
            round_form = [{"round": x["round"], "sc": x["sc"], "z": round((x["sc"] - m) / sd, 2)} for x in rounds]
            recent = statistics.mean(rscores[-3:])
            form_z = round((recent - m) / sd, 2)
        else:
            round_form = [{"round": x["round"], "sc": x["sc"], "z": 0} for x in rounds]
            form_z = 0.0

        vorp = round(sc - repl.get(pos, 0), 1) if sc else None

        players.append({
            "id": p.id, "name": p.name, "pos": p.position or pos, "primary": pos,
            "afl_team": p.afl_team or "", "age": p.age, "height": p.height_cm,
            "injury": p.injury_severity,
            "rating": p.rating, "potential": p.potential,
            "keeper_value": round(p.keeper_value) if p.keeper_value is not None else None,
            "cba_pct": round(p.cba_pct, 1) if p.cba_pct is not None else None,
            "cba_trend": p.cba_trend,
            "sc_avg": round(sc, 1), "sc_prev": round(p.sc_avg_prev, 1) if p.sc_avg_prev else None,
            "ceiling": prof.get("ceiling"), "floor": prof.get("floor"),
            "consistency": prof.get("consistency"), "boom_pct": prof.get("boom_pct"),
            "proj": proj.get("next_season"), "proj_lo": proj.get("next_season_low"),
            "proj_hi": proj.get("next_season_high"),
            "vorp": vorp, "sc_pctile": _percentile(sc, ranked.get(pos, [])),
            "form_z": form_z, "round_form": round_form,
            # your-team usage (now first-class)
            "team_games": usage.get("team_games"), "bench_rounds": usage.get("bench_rounds"),
            "captain_games": usage.get("captain_games"), "sevens_games": usage.get("sevens_games"),
            "emg_activated": usage.get("emg_activated"),
            "points_banked": usage.get("points_banked"), "contribution_pct": usage.get("contribution_pct"),
        })

    # ── team metrics ──
    rated = [p for p in players if p["vorp"] is not None]
    vorp_total = round(sum(max(0, p["vorp"]) for p in rated), 1)
    ages = [p["age"] for p in players if p["age"]]
    avg_age = round(sum(ages) / len(ages), 1) if ages else 0
    depth = {}
    for pos in ("DEF", "MID", "FWD", "RUC"):
        pp = [p for p in players if p["primary"] == pos]
        above = sum(1 for p in pp if (p["vorp"] or 0) > 0)
        depth[pos] = {"count": len(pp), "above_repl": above, "replacement": repl.get(pos, 0)}

    # contention via existing squad-health (rating + age + youth) ranked in league
    try:
        from models.team_analytics import compute_league_squad_health
        sh = compute_league_squad_health(league_id)
        me_sh = next((t for t in sh.get("teams", []) if t["team_id"] == team_id), None)
    except Exception:
        me_sh = None

    team_metrics = {
        "vorp_total": vorp_total, "avg_age": avg_age, "depth": depth,
        "health": me_sh.get("health") if me_sh else None,
        "health_rank": me_sh.get("rank") if me_sh else None,
        "descriptor": me_sh.get("descriptor") if me_sh else None,
        "n_teams": n_teams,
    }

    # ── auto insights ──
    insights = []
    if me_sh:
        insights.append({"kind": "window", "headline": me_sh.get("descriptor", "")})
    thin = min(depth.items(), key=lambda kv: (kv[1]["above_repl"], kv[1]["count"]), default=None)
    if thin and thin[1]["count"] > 0:
        insights.append({"kind": "depth", "headline": f"Thin at {thin[0]}",
                         "detail": f"only {thin[1]['above_repl']} above replacement"})
    risers = [p for p in players if (p["cba_pct"] or 0) >= 25 and (p["cba_trend"] or 0) >= 12]
    if risers:
        top = max(risers, key=lambda p: p["cba_trend"])
        insights.append({"kind": "role", "headline": f"{top['name'].split()[-1]} ↗ into the midfield",
                         "detail": f"CBA +{top['cba_trend']}", "player": top["id"]})
    hot = [p for p in players if p["form_z"] >= 1.0 and p["sc_avg"] >= 60]
    if hot:
        top = max(hot, key=lambda p: p["form_z"])
        insights.append({"kind": "form", "headline": f"{top['name'].split()[-1]} red-hot",
                         "detail": f"last 3 well above season", "player": top["id"]})

    return {
        "has_data": bool(players),
        "team": {"id": team.id, "name": team.name},
        "replacement": repl,
        "players": players,
        "team_metrics": team_metrics,
        "insights": insights,
    }

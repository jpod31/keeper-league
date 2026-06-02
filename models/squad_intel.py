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


def _age_curve(a):
    """Relative SC level by age (peak ~25-27)."""
    if a is None:
        return 1.0
    pts = [(18, 0.70), (20, 0.82), (22, 0.92), (24, 0.98), (26, 1.0),
           (28, 0.99), (30, 0.93), (32, 0.83), (34, 0.70), (36, 0.58)]
    if a <= pts[0][0]:
        return pts[0][1]
    if a >= pts[-1][0]:
        return pts[-1][1]
    for (a0, v0), (a1, v1) in zip(pts, pts[1:]):
        if a0 <= a <= a1:
            return v0 + (v1 - v0) * (a - a0) / (a1 - a0)
    return 1.0


def compute_dynasty_window(league_id, team_id, year):
    """Projected squad output over the next 5 seasons (each player's current SC
    aged along the league age curve) → contention window + archetype makeup."""
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    players = [p for p in (db.session.get(AflPlayer, r.player_id) for r in roster) if p]
    contributors = [p for p in players if (p.sc_avg or 0) > 0 and p.age]
    if not contributors:
        return {"has_data": False}
    # use the squad's top ~18 by SC as the scoring core
    core = sorted(contributors, key=lambda p: p.sc_avg or 0, reverse=True)[:18]

    trajectory = []
    for off in range(0, 5):
        total = 0.0
        ages = []
        for p in core:
            fa = (p.age or 25) + off
            total += (p.sc_avg or 0) * _age_curve(fa) / (_age_curve(p.age) or 1)
            ages.append(fa)
        trajectory.append({"year": year + off, "output": round(total),
                           "avg_age": round(sum(ages) / len(ages), 1)})

    peak = max(trajectory, key=lambda t: t["output"])
    window = [t["year"] for t in trajectory if t["output"] >= 0.95 * peak["output"]]

    # archetype makeup (cheap classification from position + role + scoring)
    arche = {}
    for p in players:
        pos = _primary_pos(p)
        cba = p.cba_pct or 0
        if pos == "RUC":
            a = "Ruck"
        elif pos == "MID":
            a = "Inside mid" if cba >= 55 else "Outside mid"
        elif pos == "DEF":
            a = "Rebounding def" if (p.sc_avg or 0) >= 80 else "Lockdown def"
        elif pos == "FWD":
            a = "High-CBA fwd" if cba >= 30 else "Key/small fwd"
        else:
            a = "Utility"
        arche[a] = arche.get(a, 0) + 1
    archetypes = sorted([{"type": k, "count": v} for k, v in arche.items()], key=lambda x: -x["count"])

    return {"has_data": True, "trajectory": trajectory,
            "peak_year": peak["year"], "window": window,
            "current": trajectory[0]["output"], "archetypes": archetypes}


def compute_predictions(league_id, team_id, opp_team_id, year, n=20000):
    """Monte-Carlo round projection + win probability. Each on-field starter is
    sampled from Normal(season SC, heuristic σ); captain doubled if enabled; sum →
    squad score distribution; compared to the opponent's for win probability."""
    import numpy as np
    from models.database import FantasyRoster, SeasonConfig, FantasyTeam
    FIELD = {"DEF", "MID", "FWD", "RUC", "FLEX"}

    sc_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    cap_enabled = sc_cfg.captain_scoring_enabled if (sc_cfg and sc_cfg.captain_scoring_enabled is not None) else True

    def sim_team(tid):
        st = []
        for r in FantasyRoster.query.filter_by(team_id=tid, is_active=True).all():
            if r.is_benched or r.is_emergency or (r.position_code or "").upper() not in FIELD:
                continue
            p = db.session.get(AflPlayer, r.player_id)
            if p and (p.sc_avg or 0) > 0:
                st.append((p, r))
        if not st:
            return None
        means = np.array([p.sc_avg or 0 for p, _ in st])
        stds = np.maximum(8.0, 0.25 * means)
        sims = np.clip(np.random.normal(means, stds, size=(n, len(means))), 0, None)
        cap_idx = next((i for i, (_, r) in enumerate(st) if r.is_captain), None)
        if cap_enabled and cap_idx is not None:
            sims[:, cap_idx] *= 2
        totals = sims.sum(axis=1)
        if cap_enabled and cap_idx is not None:
            means = means.copy(); means[cap_idx] *= 2
        players = sorted([{"name": p.name, "pos": _primary_pos(p), "proj": round(p.sc_avg or 0, 1),
                           "cap": bool(r.is_captain)} for p, r in st], key=lambda x: -x["proj"])
        return {"totals": totals, "mean": float(means.sum()), "n": len(st), "players": players}

    you = sim_team(team_id)
    if not you:
        return {"has_data": False}
    out = {"has_data": True, "your_proj": round(you["mean"]),
           "your_lo": round(float(np.percentile(you["totals"], 10))),
           "your_hi": round(float(np.percentile(you["totals"], 90))),
           "your_players": you["players"], "n_starters": you["n"],
           "captain_scoring": cap_enabled, "opp_name": None}
    if opp_team_id:
        opp = sim_team(opp_team_id)
        ot = db.session.get(FantasyTeam, opp_team_id)
        out["opp_name"] = ot.name if ot else "Opponent"
        if opp:
            out.update({
                "opp_proj": round(opp["mean"]),
                "opp_lo": round(float(np.percentile(opp["totals"], 10))),
                "opp_hi": round(float(np.percentile(opp["totals"], 90))),
                "win_prob": round(float((you["totals"] > opp["totals"]).mean()) * 100),
            })
    return out


def compute_team_records(league_id, team_id, year):
    """Team + player records (season + all-time) from scoring & fixture history."""
    from models.database import (RoundScore, Fixture, SeasonStanding,
                                 WeeklyLineup, FantasyTeam)
    team = db.session.get(FantasyTeam, team_id)
    if not team:
        return {"has_data": False}

    team_records, player_records = [], []
    name_cache = {}

    def pname(pid):
        if pid not in name_cache:
            p = db.session.get(AflPlayer, int(pid))
            name_cache[pid] = p.name if p else f"#{pid}"
        return name_cache[pid]

    def oppname(oid):
        t = db.session.get(FantasyTeam, oid)
        return t.name if t else "?"

    rss = RoundScore.query.filter_by(team_id=team_id).order_by(RoundScore.year, RoundScore.afl_round).all()

    # ── team scoring records ──
    scored = [(rs.total_score or 0, rs.year, rs.afl_round) for rs in rss if (rs.total_score or 0) > 0]
    if scored:
        hi = max(scored, key=lambda x: x[0]); lo = min(scored, key=lambda x: x[0])
        team_records.append({"label": "Highest round score", "value": round(hi[0]), "detail": f"R{hi[2]} {hi[1]}", "icon": "bi-graph-up-arrow", "color": "#4ec77a"})
        team_records.append({"label": "Lowest round score", "value": round(lo[0]), "detail": f"R{lo[2]} {lo[1]}", "icon": "bi-graph-down-arrow", "color": "#ef6b5e"})
        team_records.append({"label": "Average round", "value": round(sum(x[0] for x in scored) / len(scored)), "detail": f"{len(scored)} rounds", "icon": "bi-bar-chart-fill", "color": "#5aa0ff"})

    # ── win/loss records ──
    fxs = (Fixture.query.filter(Fixture.league_id == league_id,
            db.or_(Fixture.home_team_id == team_id, Fixture.away_team_id == team_id),
            Fixture.status == "completed").order_by(Fixture.year, Fixture.afl_round).all())
    results = []
    for f in fxs:
        if f.home_team_id == team_id:
            mine, opp, oid = (f.home_score or 0), (f.away_score or 0), f.away_team_id
        else:
            mine, opp, oid = (f.away_score or 0), (f.home_score or 0), f.home_team_id
        results.append({"margin": round(mine - opp), "win": mine > opp, "year": f.year, "round": f.afl_round, "opp_id": oid})
    if results:
        wins = sum(1 for r in results if r["win"])
        losses = sum(1 for r in results if not r["win"] and r["margin"] != 0)
        bw = max(results, key=lambda r: r["margin"]); bl = min(results, key=lambda r: r["margin"])
        if bw["margin"] > 0:
            team_records.append({"label": "Biggest win", "value": f"+{bw['margin']}", "detail": f"vs {oppname(bw['opp_id'])} · R{bw['round']} {bw['year']}", "icon": "bi-trophy-fill", "color": "#e8c25b"})
        if bl["margin"] < 0:
            team_records.append({"label": "Biggest loss", "value": str(bl['margin']), "detail": f"vs {oppname(bl['opp_id'])} · R{bl['round']} {bl['year']}", "icon": "bi-emoji-frown-fill", "color": "#ef6b5e"})

        def longest(pred):
            best = cur = 0
            for r in results:
                cur = cur + 1 if pred(r) else 0
                best = max(best, cur)
            return best
        ws = longest(lambda r: r["win"]); ls = longest(lambda r: (not r["win"]) and r["margin"] < 0)
        if ws:
            team_records.append({"label": "Longest win streak", "value": ws, "detail": "games", "icon": "bi-fire", "color": "#4ec77a"})
        if ls:
            team_records.append({"label": "Longest losing streak", "value": ls, "detail": "games", "icon": "bi-snow2", "color": "#8b949e"})
        if wins + losses:
            team_records.append({"label": "All-time record", "value": f"{wins}–{losses}", "detail": f"{round(wins / (wins + losses) * 100)}% win rate", "icon": "bi-clipboard-data-fill", "color": "#5aa0ff"})

    best_season = max(SeasonStanding.query.filter_by(team_id=team_id).all(),
                      key=lambda s: (s.wins or 0, s.percentage or 0), default=None)
    if best_season:
        team_records.append({"label": "Best season", "value": f"{best_season.wins}–{best_season.losses}", "detail": f"{best_season.year} · {round(best_season.percentage or 0)}%", "icon": "bi-star-fill", "color": "#e8c25b"})

    # ── player records (from per-round breakdown) ──
    best_game, banked, tons = None, {}, {}
    for rs in rss:
        for k, v in (rs.breakdown or {}).items():
            if k.startswith("emergency_") or not isinstance(v, (int, float)) or v <= 0:
                continue
            if rs.year == year:
                banked[k] = banked.get(k, 0) + v
                if v >= 100:
                    tons[k] = tons.get(k, 0) + 1
            if best_game is None or v > best_game[1]:
                best_game = (k, v, rs.year, rs.afl_round)
    if best_game:
        player_records.append({"label": "Best individual game", "player": pname(best_game[0]), "value": round(best_game[1]), "detail": f"R{best_game[3]} {best_game[2]}", "icon": "bi-lightning-charge-fill", "color": "#a98bff"})
    if banked:
        b = max(banked.items(), key=lambda x: x[1])
        player_records.append({"label": "Most banked", "player": pname(b[0]), "value": round(b[1]), "detail": f"{year} season", "icon": "bi-piggy-bank-fill", "color": "#4ec77a"})
    if tons:
        t = max(tons.items(), key=lambda x: x[1])
        player_records.append({"label": "Most tons (100+)", "player": pname(t[0]), "value": t[1], "detail": f"{year} season", "icon": "bi-trophy", "color": "#e0a93f"})
    cap_pts = {}
    rs_by = {(r.year, r.afl_round): r for r in rss}
    for wl in WeeklyLineup.query.filter_by(team_id=team_id).all():
        cap = next((s for s in wl.slots if s.is_captain), None)
        rs = rs_by.get((wl.year, wl.afl_round))
        if cap and rs and rs.captain_bonus:
            cap_pts[str(cap.player_id)] = cap_pts.get(str(cap.player_id), 0) + (rs.captain_bonus or 0)
    if cap_pts:
        c = max(cap_pts.items(), key=lambda x: x[1])
        player_records.append({"label": "Most captain points", "player": pname(c[0]), "value": round(c[1]), "detail": "bonus banked", "icon": "bi-star-fill", "color": "#e8c25b"})

    return {"has_data": bool(team_records or player_records),
            "team_records": team_records, "player_records": player_records}


def compute_league_comparison(league_id, team_id):
    """How every team in the league stacks up: per-team strength metrics +
    positional strength, league averages, your rank on each, and radar data."""
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    if not teams:
        return {"has_data": False}

    POS = ["DEF", "MID", "FWD", "RUC"]
    rows = []
    for t in teams:
        roster = FantasyRoster.query.filter_by(team_id=t.id, is_active=True).all()
        players = [p for p in (db.session.get(AflPlayer, r.player_id) for r in roster) if p]
        if not players:
            continue
        ratings = [p.rating for p in players if p.rating]
        scs = [p.sc_avg for p in players if (p.sc_avg or 0) > 0]
        ages = [p.age for p in players if p.age]
        kvs = [p.keeper_value for p in players if p.keeper_value is not None]
        # positional strength = mean rating of the best 4 at that position
        by_pos = {}
        for pos in POS:
            pr = sorted([p.rating for p in players if _primary_pos(p) == pos and p.rating], reverse=True)[:4]
            by_pos[pos] = round(sum(pr) / len(pr), 1) if pr else 0
        rows.append({
            "team_id": t.id, "name": t.name,
            "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else 0,
            "avg_sc": round(sum(scs) / len(scs), 1) if scs else 0,
            "avg_age": round(sum(ages) / len(ages), 1) if ages else 0,
            "keeper_value": round(sum(kvs) / len(kvs)) if kvs else 0,
            "squad_size": len(players),
            "by_pos": by_pos,
        })
    if not rows:
        return {"has_data": False}

    # squad-health ranking (composite) for the headline ranking
    try:
        sh = compute_league_squad_health(league_id)
        health_by = {x["team_id"]: x for x in sh.get("teams", [])}
    except Exception:
        health_by = {}
    for r in rows:
        h = health_by.get(r["team_id"])
        r["health"] = h.get("health") if h else None
        r["descriptor"] = h.get("descriptor") if h else None
    rows.sort(key=lambda r: (r["health"] or r["avg_rating"]), reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    n = len(rows)
    league_avg = {
        "avg_rating": round(sum(r["avg_rating"] for r in rows) / n, 1),
        "avg_sc": round(sum(r["avg_sc"] for r in rows) / n, 1),
        "avg_age": round(sum(r["avg_age"] for r in rows) / n, 1),
        "by_pos": {pos: round(sum(r["by_pos"][pos] for r in rows) / n, 1) for pos in POS},
    }
    league_best = {"by_pos": {pos: max(r["by_pos"][pos] for r in rows) for pos in POS}}

    me = next((r for r in rows if r["team_id"] == team_id), None)
    # your rank on each metric (1 = best; age lower = "younger", reported as-is)
    def rank_on(key, higher=True):
        order = sorted(rows, key=lambda r: r[key], reverse=higher)
        return next((i + 1 for i, r in enumerate(order) if r["team_id"] == team_id), None)
    your_ranks = {
        "health": me["rank"] if me else None,
        "avg_rating": rank_on("avg_rating"),
        "avg_sc": rank_on("avg_sc"),
        "keeper_value": rank_on("keeper_value"),
    } if me else {}

    radar = [{"pos": pos,
              "you": me["by_pos"][pos] if me else 0,
              "league": league_avg["by_pos"][pos],
              "best": league_best["by_pos"][pos]} for pos in POS] if me else []

    return {
        "has_data": True, "n_teams": n,
        "teams": rows, "league_avg": league_avg,
        "your_team_id": team_id, "your_ranks": your_ranks, "radar": radar,
    }


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

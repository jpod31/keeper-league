"""War Room analytics — trade opportunities, contention timeline, squad depth.

Supplements the deep analytics model with trade-focused and
narrative-focused data for the War Room dashboard.
"""

import logging
from collections import defaultdict

from models.database import (
    db, AflPlayer, FantasyRoster, FantasyTeam, PlayerStat,
)

logger = logging.getLogger(__name__)


def compute_trade_table(team_id, league_id, year, profile_tags):
    """Identify gaps in the roster and opportunities to fill them.

    Returns: {
        "gaps": [{"position", "avg_sc", "league_avg", "gap", "weakest_player", "reason"}],
        "free_agents": [{"name", "position", "age", "sc_avg", "tag", "fills_gap", "projected_gain"}],
        "bench_targets": [{"name", "position", "age", "sc_avg", "tag", "owner", "fills_gap"}],
        "surplus": [{"name", "position", "age", "sc_avg", "tag", "reason"}],
    }
    """
    # Current team's field players
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    roster_map = {r.player_id: r for r in roster}
    field_players = []
    bench_players_own = []
    for r in roster:
        p = db.session.get(AflPlayer, r.player_id)
        if not p:
            continue
        if r.is_benched:
            bench_players_own.append(p)
        else:
            field_players.append(p)

    # Position averages for this team and league
    pos_avgs = defaultdict(list)
    for p in field_players:
        pos = (p.position or "MID").split("/")[0]
        pos_avgs[pos].append(p.sc_avg or 0)

    team_pos_avg = {pos: round(sum(v)/len(v), 1) for pos, v in pos_avgs.items() if v}

    # League position averages
    league_pos = defaultdict(list)
    all_teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    for t in all_teams:
        for r in FantasyRoster.query.filter_by(team_id=t.id, is_active=True, is_benched=False).all():
            p = db.session.get(AflPlayer, r.player_id)
            if p and p.sc_avg:
                pos = (p.position or "MID").split("/")[0]
                league_pos[pos].append(p.sc_avg)

    league_avg = {pos: round(sum(v)/len(v), 1) for pos, v in league_pos.items() if v}

    # Identify gaps
    gaps = []
    for pos in ["DEF", "MID", "FWD", "RUC"]:
        my_avg = team_pos_avg.get(pos, 0)
        lg_avg = league_avg.get(pos, 0)
        diff = my_avg - lg_avg
        if diff < -5:
            # Find weakest player at this position
            pos_players = [(p, p.sc_avg or 0) for p in field_players
                          if (p.position or "MID").split("/")[0] == pos]
            pos_players.sort(key=lambda x: x[1])
            weakest = pos_players[0] if pos_players else (None, 0)
            gaps.append({
                "position": pos,
                "avg_sc": my_avg,
                "league_avg": lg_avg,
                "gap": round(diff, 1),
                "weakest_player": weakest[0].name if weakest[0] else "",
                "weakest_sc": round(weakest[1], 0),
                "reason": f"Your {pos} line averages {my_avg:.0f}, league average is {lg_avg:.0f}",
            })
    gaps.sort(key=lambda x: x["gap"])

    gap_positions = set(g["position"] for g in gaps)

    # All rostered player IDs
    all_rostered = set(r.player_id for r in
                       FantasyRoster.query.filter_by(is_active=True).all())

    # Free agents — not on any team, SC > 50
    all_fa = AflPlayer.query.filter(
        AflPlayer.sc_avg.isnot(None),
        AflPlayer.sc_avg > 50,
        ~AflPlayer.id.in_(all_rostered) if all_rostered else True,
    ).order_by(AflPlayer.sc_avg.desc()).limit(50).all()

    free_agents = []
    for p in all_fa:
        pos = (p.position or "MID").split("/")[0]
        t = profile_tags.get(p.id, {})
        fills = pos in gap_positions
        # Projected gain: how much would they improve the weakest spot
        gain = 0
        if fills:
            gap = next((g for g in gaps if g["position"] == pos), None)
            if gap:
                gain = round((p.sc_avg or 0) - gap["weakest_sc"], 0)

        free_agents.append({
            "name": p.name,
            "position": pos,
            "age": p.age or 0,
            "sc_avg": round(p.sc_avg or 0, 1),
            "tag": t.get("tag", ""),
            "tag_css": t.get("css", ""),
            "fills_gap": fills,
            "projected_gain": gain,
        })

    # Sort: gap-fillers first, then by SC
    free_agents.sort(key=lambda x: (-int(x["fills_gap"]), -x["sc_avg"]))
    free_agents = free_agents[:15]

    # Trade targets: players who are SURPLUS to other teams' needs
    # A player is surplus if the other team has enough depth at that position
    # to afford trading them (they wouldn't make the other team's best 23)
    trade_targets = []

    # Position requirements
    pos_req = {"DEF": 6, "MID": 9, "RUC": 1, "FWD": 6}

    other_teams = FantasyTeam.query.filter(
        FantasyTeam.league_id == league_id,
        FantasyTeam.id != team_id,
    ).all()

    for ot in other_teams:
        ot_roster = FantasyRoster.query.filter_by(team_id=ot.id, is_active=True).all()
        # Group all their players by primary position, sorted by SC
        ot_by_pos = defaultdict(list)
        for r in ot_roster:
            p = db.session.get(AflPlayer, r.player_id)
            if not p:
                continue
            pos = (p.position or "MID").split("/")[0]
            sc = p.sc_avg or p.sc_avg_prev or 0
            ot_by_pos[pos].append((p, sc))

        for pos in ot_by_pos:
            ot_by_pos[pos].sort(key=lambda x: -x[1])

        # Players beyond the required count at each position are surplus
        for pos, req in pos_req.items():
            players_at_pos = ot_by_pos.get(pos, [])
            if len(players_at_pos) <= req:
                continue
            # Players beyond the top 'req' are surplus to this team
            surplus_players = players_at_pos[req:]
            for p, sc in surplus_players:
                if sc < 50:
                    continue
                pt = profile_tags.get(p.id, {})
                fills = pos in gap_positions
                trade_targets.append({
                    "name": p.name,
                    "position": pos,
                    "age": p.age or 0,
                    "sc_avg": round(sc, 1),
                    "tag": pt.get("tag", ""),
                    "tag_css": pt.get("css", ""),
                    "owner": ot.name,
                    "fills_gap": fills,
                    "reason": f"Surplus {pos} on {ot.name} ({len(players_at_pos)} deep, needs {req})",
                })

    trade_targets.sort(key=lambda x: (-int(x["fills_gap"]), -x["sc_avg"]))
    trade_targets = trade_targets[:15]

    # Surplus players (own bench with decent SC who could be traded)
    # EXCLUDE players at positions where we have a gap — trading them would hurt
    surplus = []
    for p in bench_players_own:
        if not p.sc_avg or p.sc_avg < 50:
            continue
        pos = (p.position or "MID").split("/")[0]
        # Don't suggest trading players at a position we're weak at
        if pos in gap_positions:
            continue
        pt = profile_tags.get(p.id, {})
        surplus.append({
            "name": p.name,
            "position": pos,
            "age": p.age or 0,
            "sc_avg": round(p.sc_avg, 1),
            "tag": pt.get("tag", ""),
            "tag_css": pt.get("css", ""),
            "reason": f"Bench depth at {pos} — tradeable for positional upgrade",
        })
    surplus.sort(key=lambda x: -x["sc_avg"])
    surplus = surplus[:10]

    return {
        "gaps": gaps,
        "free_agents": free_agents,
        "trade_targets": trade_targets,
        "surplus": surplus,
    }


def compute_contention_timeline(field_players, profile_tags, projections):
    """Build data for the contention window timeline visualization.

    Returns: {
        "years": [{"label", "total", "status", "events": [{"player", "event"}]}],
        "peak_year": int (0-3 offset),
    }
    """
    years = []

    # Current year
    current_total = sum(p.sc_avg or 0 for p in field_players)
    current_events = []

    # Count key stats
    peak_count = sum(1 for p in field_players if profile_tags.get(p.id, {}).get("peak_phase") == "peak")
    pre_peak = sum(1 for p in field_players if profile_tags.get(p.id, {}).get("peak_phase") == "pre-peak")
    post_peak = sum(1 for p in field_players if profile_tags.get(p.id, {}).get("peak_phase") == "post-peak")

    current_events.append(f"{peak_count} players in peak, {pre_peak} pre-peak, {post_peak} post-peak")
    years.append({
        "label": "Now",
        "total": round(current_total, 0),
        "status": "strong" if current_total > 2000 else "moderate" if current_total > 1800 else "weak",
        "events": current_events,
    })

    # Future years from projections
    peak_total = current_total
    peak_year = 0
    for offset in range(1, 4):
        yr_key = f"{offset}yr"
        proj = projections.get(yr_key, {})
        total = proj.get("total", current_total)

        if total > peak_total:
            peak_total = total
            peak_year = offset

        events = []
        players = proj.get("players", [])

        # Big movers
        for p in sorted(players, key=lambda x: x.get("change", 0), reverse=True)[:2]:
            if p.get("change", 0) > 5:
                events.append(f"{p['name']} enters peak (+{p['change']:.0f})")

        for p in sorted(players, key=lambda x: x.get("change", 0))[:2]:
            if p.get("change", 0) < -5:
                events.append(f"{p['name']} declines ({p['change']:.0f})")

        status = "strong" if total > current_total * 0.98 else "moderate" if total > current_total * 0.92 else "weak"
        years.append({
            "label": f"+{offset} Year{'s' if offset > 1 else ''}",
            "total": round(total, 0),
            "status": status,
            "events": events,
        })

    return {
        "years": years,
        "peak_year": peak_year,
    }


def compute_squad_depth(field_players, bench_players, profile_tags, league_pos_avgs):
    """Build squad depth board data — players as cards in position rows.

    Returns: {pos: {"players": [{"name","sc","tag","tag_css","trajectory","age","height"}],
                    "avg_sc", "league_avg", "diff"}}
    """
    depth = {}
    for pos in ["DEF", "MID", "RUC", "FWD"]:
        pos_players = []
        for p in field_players:
            if (p.position or "MID").split("/")[0] == pos:
                t = profile_tags.get(p.id, {})
                traj = t.get("trajectory", 0)
                pos_players.append({
                    "name": p.name,
                    "sc": round(p.sc_avg or 0, 0),
                    "tag": t.get("tag", ""),
                    "tag_css": t.get("css", ""),
                    "trajectory": "rising" if traj > 3 else "declining" if traj < -3 else "stable",
                    "age": p.age or 0,
                    "peak_phase": t.get("peak_phase", ""),
                })
        pos_players.sort(key=lambda x: -x["sc"])

        avg = round(sum(p["sc"] for p in pos_players) / max(len(pos_players), 1), 1)
        lg = league_pos_avgs.get(pos, 0)

        depth[pos] = {
            "players": pos_players,
            "avg_sc": avg,
            "league_avg": round(lg, 1),
            "diff": round(avg - lg, 1),
            "count": len(pos_players),
        }

    return depth


def compute_league_landscape(league_id, year, profile_tags):
    """Build league landscape data — all teams as stacked player columns.

    Returns: [{"name", "is_you": bool, "total_sc", "players": [{"name","sc","tag","tag_css"}]}]
    """
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    landscape = []

    for t in teams:
        roster = FantasyRoster.query.filter_by(team_id=t.id, is_active=True, is_benched=False).all()
        players = []
        total = 0
        for r in roster:
            p = db.session.get(AflPlayer, r.player_id)
            if not p:
                continue
            sc = p.sc_avg or 0
            pt = profile_tags.get(p.id, {})
            players.append({
                "name": p.name,
                "sc": round(sc, 0),
                "tag": pt.get("tag", ""),
                "tag_css": pt.get("css", ""),
            })
            total += sc

        players.sort(key=lambda x: -x["sc"])
        landscape.append({
            "team_id": t.id,
            "name": t.name,
            "total_sc": round(total, 0),
            "avg_sc": round(total / max(len(players), 1), 1),
            "players": players,
            "count": len(players),
        })

    landscape.sort(key=lambda x: -x["total_sc"])
    return landscape


# ═══════════════════════════════════════════════════════════════════════════
# STATE LEAGUE INTELLIGENCE
# ═══════════════════════════════════════════════════════════════════════════

def compute_state_league_intel(team_id, league_id, year, trade_table=None):
    """Find state league players that could benefit this team.

    Uses the scouting ML model to predict AFL output, cross-references with
    the team's positional gaps and fantasy league ownership.

    Returns: {
        "pickup_targets": [...],   # AFL-listed FAs killing it in VFL/SANFL/WAFL
        "draft_watch": [...],      # NAB/Coates prospects worth watching
        "vfl_form_owned": [...],   # Players you own who are in strong VFL form
    }
    """
    from models.database import StateLeagueStat
    from models.scouting_model import predict_afl_output

    # Get all rostered player IDs across the league
    league_teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    rostered_player_ids = set()
    my_player_ids = set()
    for lt in league_teams:
        for r in FantasyRoster.query.filter_by(team_id=lt.id, is_active=True).all():
            rostered_player_ids.add(r.player_id)
            if lt.id == team_id:
                my_player_ids.add(r.player_id)

    # Get team's positional gaps
    gaps = {}
    if trade_table:
        for g in trade_table.get("gaps", []):
            gaps[g["position"]] = g["gap"]

    # ── 1. Pickup targets: AFL-listed, strong VFL/SANFL/WAFL form, not rostered ──
    sl_current = StateLeagueStat.query.filter(
        StateLeagueStat.season == year,
        StateLeagueStat.is_afl_listed == True,
        StateLeagueStat.matches >= 2,
        StateLeagueStat.competition.in_(["vfl", "sanfl", "wafl"]),
    ).order_by(StateLeagueStat.dreamteam_avg.desc()).limit(200).all()

    pickup_targets = []
    for sl in sl_current:
        if not sl.player_id or sl.player_id in rostered_player_ids:
            continue

        player = db.session.get(AflPlayer, sl.player_id)
        if not player:
            continue

        # Run scouting model prediction
        pred = predict_afl_output(sl_row=sl)
        if not pred:
            continue

        projected_sc = pred["predicted_afl"].get("afl_sc_avg", 0)
        if projected_sc < 50:
            continue

        pos = (player.position or "MID").split("/")[0]
        fills_gap = pos in gaps and gaps[pos] < -3

        # Compute a relevance score: projected SC + gap bonus + form bonus
        relevance = projected_sc
        if fills_gap:
            relevance += 15
        if sl.dreamteam_avg and sl.dreamteam_avg >= 100:
            relevance += 10
        if player.age and player.age <= 24:
            relevance += 5

        # Check actual AFL form this season
        afl_games = PlayerStat.query.filter_by(
            player_id=player.id, year=year
        ).count()
        afl_avg = None
        if afl_games:
            from sqlalchemy import func
            afl_avg_q = db.session.query(
                func.avg(PlayerStat.supercoach_score)
            ).filter_by(player_id=player.id, year=year).scalar()
            afl_avg = round(float(afl_avg_q), 1) if afl_avg_q else None

        pickup_targets.append({
            "name": player.name,
            "position": player.position or "MID",
            "age": player.age or 0,
            "afl_team": player.afl_team,
            "sl_competition": sl.competition.upper(),
            "sl_team": sl.team,
            "sl_matches": sl.matches,
            "sl_fantasy_avg": round(sl.dreamteam_avg, 1) if sl.dreamteam_avg else 0,
            "sl_disposals": round(sl.disposals, 1) if sl.disposals else 0,
            "projected_afl_sc": round(projected_sc, 1),
            "afl_games_this_year": afl_games,
            "afl_avg_this_year": afl_avg,
            "breakout_pct": pred["breakout_probability"],
            "tag": pred["tag"],
            "fills_gap": pos if fills_gap else None,
            "relevance": round(relevance, 1),
        })

    pickup_targets.sort(key=lambda x: -x["relevance"])
    pickup_targets = pickup_targets[:15]

    # ── 2. Draft watch: NAB/Coates prospects ──
    nab_current = StateLeagueStat.query.filter(
        StateLeagueStat.season == year,
        StateLeagueStat.competition == "nab",
        StateLeagueStat.matches >= 2,
    ).order_by(StateLeagueStat.dreamteam_avg.desc()).limit(100).all()

    draft_watch = []
    for sl in nab_current:
        pred = predict_afl_output(sl_row=sl)
        if not pred:
            continue

        projected_sc = pred["predicted_afl"].get("afl_sc_avg", 0)
        draft_prob = pred.get("draft_probability", 0) or 0
        if projected_sc < 40 and draft_prob < 10:
            continue

        # Check historical NAB data for this player
        career_nab = StateLeagueStat.query.filter_by(
            player_name=sl.player_name, competition="nab"
        ).order_by(StateLeagueStat.season).all()
        career_seasons = len(career_nab)
        career_avg_fan = round(
            sum(s.dreamteam_avg or 0 for s in career_nab) / max(career_seasons, 1), 1
        )

        pos_grp = pred.get("position_group", "MID")
        fills_gap = pos_grp in gaps and gaps[pos_grp] < -3

        draft_watch.append({
            "name": sl.player_name,
            "age": sl.age or 0,
            "sl_team": sl.team,
            "sl_matches": sl.matches,
            "sl_fantasy_avg": round(sl.dreamteam_avg, 1) if sl.dreamteam_avg else 0,
            "sl_disposals": round(sl.disposals, 1) if sl.disposals else 0,
            "projected_afl_sc": round(projected_sc, 1),
            "draft_probability": draft_prob,
            "breakout_pct": pred["breakout_probability"],
            "tag": pred["tag"],
            "position_group": pos_grp,
            "fills_gap": pos_grp if fills_gap else None,
            "career_nab_seasons": career_seasons,
            "career_nab_avg_fantasy": career_avg_fan,
            "projections": pred.get("projections", {}),
        })

    draft_watch.sort(key=lambda x: -(x["draft_probability"] + x["breakout_pct"]))
    draft_watch = draft_watch[:10]

    # ── 3. VFL form for players you own ──
    vfl_form_owned = []
    for pid in my_player_ids:
        sl = StateLeagueStat.query.filter_by(
            player_id=pid, season=year
        ).order_by(StateLeagueStat.dreamteam_avg.desc()).first()
        if not sl or not sl.matches or not sl.dreamteam_avg:
            continue

        player = db.session.get(AflPlayer, pid)
        if not player:
            continue

        vfl_form_owned.append({
            "name": player.name,
            "position": player.position or "MID",
            "age": player.age or 0,
            "sl_competition": sl.competition.upper(),
            "sl_team": sl.team,
            "sl_matches": sl.matches,
            "sl_fantasy_avg": round(sl.dreamteam_avg, 1),
            "sl_disposals": round(sl.disposals, 1) if sl.disposals else 0,
            "afl_sc_avg": player.sc_avg or 0,
            "sl_vs_afl": round(sl.dreamteam_avg - (player.sc_avg or 0), 1),
        })

    vfl_form_owned.sort(key=lambda x: -x["sl_fantasy_avg"])

    return {
        "pickup_targets": pickup_targets,
        "draft_watch": draft_watch,
        "vfl_form_owned": vfl_form_owned,
    }

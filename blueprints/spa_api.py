"""JSON API endpoints for the React SPA."""

import logging
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from models.database import (
    db, League, FantasyTeam, Fixture, SeasonStanding, DraftSession, SeasonConfig,
    AflPlayer, FantasyRoster, Trade, TradeAsset, TradeComment,
    LeagueChatMessage, LeagueChat, Notification, ActivityFeedEntry,
    WeeklyLineup, LineupSlot, RoundScore, StateLeagueStat,
)

logger = logging.getLogger(__name__)

spa_api = Blueprint("spa_api", __name__, url_prefix="/api")


# ── League context (used by LeagueShell) ──────────────────────────────

@spa_api.route("/leagues/<int:league_id>/context")
@login_required
def league_context(league_id):
    from models.database import LongTermInjury, SeasonConfig

    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    user_team = next((t for t in teams if t.owner_id == current_user.id), None)
    is_commissioner = league.commissioner_id == current_user.id

    active_draft = DraftSession.query.filter_by(
        league_id=league_id, is_mock=False
    ).filter(DraftSession.status.in_(["scheduled", "in_progress", "paused"])).first() is not None

    pending_ltil_count = 0
    if is_commissioner:
        pending_ltil_count = LongTermInjury.query.filter_by(
            league_id=league_id, removed_at=None, status="pending"
        ).count()

    # User's other leagues (for the selector dropdown)
    user_league_rows = (
        db.session.query(League, FantasyTeam)
        .join(FantasyTeam, FantasyTeam.league_id == League.id)
        .filter(FantasyTeam.owner_id == current_user.id)
        .all()
    )
    user_leagues = [{
        "id": lg.id,
        "name": lg.name,
        "season_year": lg.season_year,
        "invite_code": lg.invite_code or "",
        "is_commissioner": lg.commissioner_id == current_user.id,
        "team_id": tm.id,
        "team_name": tm.name,
    } for lg, tm in user_league_rows]

    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    finals_teams = 0
    if season_cfg and getattr(season_cfg, "finals_format", None):
        finals_teams = {"top_4": 4, "top_6": 6, "top_8": 8}.get(season_cfg.finals_format, 0)

    # Current round + next lockout — used by the global lockout badge in
    # the top bar. Mirrors the logic in blueprints/leagues.py dashboard.
    current_round = 0
    next_lockout_at = None
    try:
        from zoneinfo import ZoneInfo
        from models.database import AflGame
        from scrapers.squiggle import get_current_round
        current_round = get_current_round(league.season_year) or 0
        next_game = (
            AflGame.query
            .filter_by(year=league.season_year)
            .filter(AflGame.status.in_(["scheduled", "live"]))
            .filter(AflGame.scheduled_start.isnot(None))
            .order_by(AflGame.scheduled_start.asc())
            .first()
        )
        if next_game and next_game.scheduled_start:
            ga = next_game.scheduled_start
            # scheduled_start is naive Melbourne wall-clock (see scrapers/squiggle.py).
            # Attach the proper zone so the ISO string carries the correct offset,
            # otherwise the client interprets it as UTC and shows a ~10h-too-late
            # countdown during winter (AEST) or ~11h during summer (AEDT).
            if ga.tzinfo is None:
                ga = ga.replace(tzinfo=ZoneInfo("Australia/Melbourne"))
            next_lockout_at = ga.isoformat()
    except Exception:
        pass

    # Current matchup — used by the squad page mini fixture strip.
    # Looks up the user's fixture for the current AFL round.
    current_matchup = None
    if user_team and current_round:
        fx = Fixture.query.filter(
            Fixture.league_id == league_id,
            Fixture.year == league.season_year,
            Fixture.afl_round == current_round,
            db.or_(Fixture.home_team_id == user_team.id, Fixture.away_team_id == user_team.id),
        ).first()
        if fx:
            user_is_home = fx.home_team_id == user_team.id
            opp_team = fx.away_team if user_is_home else fx.home_team
            current_matchup = {
                "fixture_id": fx.id,
                "opponent_id": opp_team.id if opp_team else None,
                "opponent_name": opp_team.name if opp_team else "?",
                "user_is_home": user_is_home,
                "status": fx.status,
                "user_score": (fx.home_score if user_is_home else fx.away_score) or None,
                "opponent_score": (fx.away_score if user_is_home else fx.home_score) or None,
            }

    return jsonify({
        "id": league.id,
        "name": league.name,
        "season_year": league.season_year,
        "invite_code": league.invite_code or "",
        "commissioner_id": league.commissioner_id,
        "user_team": {"id": user_team.id, "name": user_team.name} if user_team else None,
        "teams": [{"id": t.id, "name": t.name, "owner": t.owner.display_name if t.owner else "?"} for t in teams],
        "is_commissioner": is_commissioner,
        "is_owner": user_team is not None,
        "active_draft": active_draft,
        "season_phase": league.status or "setup",
        "pending_ltil_count": pending_ltil_count,
        "finals_teams": finals_teams,
        "user_leagues": user_leagues,
        "current_round": current_round,
        "next_lockout_at": next_lockout_at,
        "current_matchup": current_matchup,
    })


# ── League list ───────────────────────────────────────────────────────

@spa_api.route("/leagues")
@login_required
def league_list():
    teams = FantasyTeam.query.filter_by(owner_id=current_user.id).all()
    result = []
    for t in teams:
        lg = t.league
        team_count = FantasyTeam.query.filter_by(league_id=lg.id).count()
        result.append({
            "id": lg.id,
            "name": lg.name,
            "season_year": lg.season_year,
            "invite_code": lg.invite_code or "",
            "team_count": team_count,
            "user_team": {"id": t.id, "name": t.name},
            "is_commissioner": lg.commissioner_id == current_user.id,
        })
    return jsonify(result)


# ── Dashboard ─────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/dashboard")
@login_required
def dashboard(league_id):
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    standings = SeasonStanding.query.filter_by(
        league_id=league_id, year=league.season_year
    ).order_by(SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc()).all()

    standings_data = [{
        "team_id": s.team_id,
        "name": s.team.name if s.team else "?",
        "wins": s.wins, "losses": s.losses, "draws": s.draws,
        "points": s.ladder_points, "pct": s.percentage or 0,
        "for": s.points_for or 0,
    } for s in standings]

    # Latest completed round
    from sqlalchemy import func
    latest = db.session.query(func.max(Fixture.afl_round)).filter(
        Fixture.league_id == league_id,
        Fixture.year == league.season_year,
        Fixture.status == "completed",
    ).scalar() or 0

    recent = []
    if latest > 0:
        for f in Fixture.query.filter_by(league_id=league_id, year=league.season_year, afl_round=latest).all():
            recent.append({
                "fixture_id": f.id,
                "home": f.home_team.name if f.home_team else "?",
                "away": f.away_team.name if f.away_team else "?",
                "home_score": f.home_score or 0,
                "away_score": f.away_score or 0,
            })

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    user_summary = None
    if user_team:
        us = SeasonStanding.query.filter_by(league_id=league_id, year=league.season_year, team_id=user_team.id).first()
        rank = next((i + 1 for i, s in enumerate(standings_data) if s["team_id"] == user_team.id), 0)
        user_summary = {
            "name": user_team.name,
            "record": f"{us.wins}-{us.losses}" if us else "0-0",
            "rank": rank,
            "next_opponent": "",
        }

    return jsonify({
        "standings": standings_data,
        "current_round": latest,
        "recent_results": recent,
        "recent_trades": [],
        "user_team_summary": user_summary,
    })


# ── Standings ─────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/standings")
@login_required
def standings(league_id):
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    rows = SeasonStanding.query.filter_by(
        league_id=league_id, year=league.season_year
    ).order_by(SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc()).all()

    return jsonify([{
        "rank": i + 1, "team_id": s.team_id,
        "name": s.team.name if s.team else "?",
        "wins": s.wins, "losses": s.losses, "draws": s.draws,
        "points": s.ladder_points, "pct": s.percentage or 0,
        "for": s.points_for or 0, "against": s.points_against or 0,
        "streak": "",
    } for i, s in enumerate(rows)])


# ── Fixture ───────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/fixture")
@login_required
def fixture_list(league_id):
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    fixtures = Fixture.query.filter_by(
        league_id=league_id, year=league.season_year
    ).order_by(Fixture.afl_round, Fixture.id).all()

    rounds: dict = {}
    for f in fixtures:
        rd = f.afl_round
        if rd not in rounds:
            rounds[rd] = {"round": rd, "matches": []}
        rounds[rd]["matches"].append({
            "fixture_id": f.id,
            "home": f.home_team.name if f.home_team else "?",
            "away": f.away_team.name if f.away_team else "?",
            "home_score": f.home_score or 0,
            "away_score": f.away_score or 0,
            "completed": f.status == "completed",
            "status": f.status or "scheduled",
        })

    return jsonify(sorted(rounds.values(), key=lambda r: r["round"]))


# ── Round detail ──────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/fixture/<int:round_num>")
@login_required
def round_detail(league_id, round_num):
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    fixtures = Fixture.query.filter_by(
        league_id=league_id, year=league.season_year, afl_round=round_num
    ).all()

    return jsonify([{
        "fixture_id": f.id,
        "home_team": {"id": f.home_team_id, "name": f.home_team.name if f.home_team else "?"},
        "away_team": {"id": f.away_team_id, "name": f.away_team.name if f.away_team else "?"},
        "home_score": f.home_score or 0,
        "away_score": f.away_score or 0,
        "completed": f.status == "completed",
    } for f in fixtures])


# ── Matchup detail ────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/matchup/<int:fixture_id>")
@login_required
def matchup_detail(league_id, fixture_id):
    f = db.session.get(Fixture, fixture_id)
    if not f or f.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    def get_players(team_id):
        """Extract player breakdown from RoundScore JSON."""
        rs = RoundScore.query.filter_by(
            team_id=team_id, afl_round=f.afl_round, year=f.year
        ).first()
        if not rs or not rs.breakdown:
            return []
        # breakdown is a JSON list of player dicts
        bd = rs.breakdown if isinstance(rs.breakdown, list) else []
        result = []
        for entry in bd:
            result.append({
                "name": entry.get("name", "?"),
                "position": entry.get("position", ""),
                "score": entry.get("final_score", 0) or entry.get("score", 0) or 0,
                "is_captain": entry.get("is_captain", False),
                "is_vc": entry.get("is_vice_captain", False),
                "is_emergency": entry.get("is_emergency", False),
                "dnp": entry.get("is_dnp", False),
            })
        return sorted(result, key=lambda x: -x["score"])

    return jsonify({
        "fixture_id": f.id,
        "round": f.afl_round,
        "home_team": {"id": f.home_team_id, "name": f.home_team.name if f.home_team else "?"},
        "away_team": {"id": f.away_team_id, "name": f.away_team.name if f.away_team else "?"},
        "home_score": f.home_score or 0,
        "away_score": f.away_score or 0,
        "home_players": get_players(f.home_team_id),
        "away_players": get_players(f.away_team_id),
        "completed": f.status == "completed",
    })


# ── Gameday ───────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/gameday")
@login_required
def gameday(league_id):
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    from scrapers.squiggle import get_current_round
    current_round = get_current_round(league.season_year) or 1

    fixtures = Fixture.query.filter_by(
        league_id=league_id, year=league.season_year, afl_round=current_round
    ).all()

    return jsonify({
        "round": current_round,
        "fixtures": [{
            "fixture_id": f.id,
            "home_team": {"id": f.home_team_id, "name": f.home_team.name if f.home_team else "?"},
            "away_team": {"id": f.away_team_id, "name": f.away_team.name if f.away_team else "?"},
            "home_score": f.home_score or 0,
            "away_score": f.away_score or 0,
            "home_projected": 0,
            "away_projected": 0,
            "status": f.status or "scheduled",
        } for f in fixtures],
        "live": any(f.status == "live" for f in fixtures),
    })


# ── Squad ─────────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/team/<int:team_id>/squad")
@login_required
def team_squad(league_id, team_id):
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    league = db.session.get(League, league_id)

    try:
        from models.profile_tags import compute_profile_tags
        tags = compute_profile_tags(league_id, league.season_year)
    except Exception:
        tags = {}

    players = []
    for rs in roster:
        p = rs.player
        if not p:
            continue
        tag_info = tags.get(p.name, {})
        injury = None
        if p.injury_type:
            injury = p.injury_type
            if p.injury_return:
                injury += f" ({p.injury_return})"
        players.append({
            "id": p.id,
            "name": p.name,
            "position": p.position or "",
            "afl_team": p.afl_team or "",
            "age": p.age or 0,
            "sc_avg": p.sc_avg or 0,
            "games": p.games_played or 0,
            "is_captain": rs.is_captain,
            "is_vc": rs.is_vice_captain,
            "tag": tag_info.get("tag", ""),
            "tag_css": tag_info.get("css", ""),
            "injury": injury,
        })

    return jsonify({
        "team": {"id": team.id, "name": team.name, "owner": team.owner.display_name if team.owner else "?"},
        "players": sorted(players, key=lambda x: -x["sc_avg"]),
        "salary_cap": 0,
        "roster_size": len(players),
    })


# ── Roster health (#6 — pos avg + count for the strip above the squad) ─
#
# Computes per-position SC averages across the league (active, on-field
# rosters) plus the requesting team's own counts and averages, so the
# squad page can render "DEF 6 · +1.2 vs lg avg" chips at a glance.

@spa_api.route("/leagues/<int:league_id>/team/<int:team_id>/pos-avgs")
@login_required
def team_pos_avgs(league_id, team_id):
    from collections import defaultdict
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    # League-wide: every active, on-field player across every team.
    league_buckets = defaultdict(list)
    for lt in FantasyTeam.query.filter_by(league_id=league_id).all():
        rosters = FantasyRoster.query.filter_by(
            team_id=lt.id, is_active=True, is_benched=False,
        ).all()
        for r in rosters:
            p = db.session.get(AflPlayer, r.player_id)
            if not p or not p.sc_avg:
                continue
            pos = (p.position or "MID").split("/")[0].upper()
            league_buckets[pos].append(p.sc_avg)
    league_avg = {pos: round(sum(v) / len(v), 1) for pos, v in league_buckets.items() if v}

    # Mine: same shape but just this team's active, on-field roster.
    my_buckets = defaultdict(list)
    my_count = defaultdict(int)
    for r in FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True, is_benched=False,
    ).all():
        p = db.session.get(AflPlayer, r.player_id)
        if not p:
            continue
        pos = (p.position or "MID").split("/")[0].upper()
        my_count[pos] += 1
        if p.sc_avg:
            my_buckets[pos].append(p.sc_avg)
    mine = {
        pos: {
            "count": my_count[pos],
            "avg": round(sum(my_buckets[pos]) / len(my_buckets[pos]), 1) if my_buckets[pos] else None,
        }
        for pos in ("DEF", "MID", "RUC", "FWD")
    }

    return jsonify({"league_avg": league_avg, "mine": mine})


# ── Bye-round planner (#14) ───────────────────────────────────────────
#
# For the next N AFL rounds, list each player on this team who's on bye
# (their AFL team isn't playing that round). Powers the bye planner
# overlay on SquadPage so users can spot positional congestion ahead.

@spa_api.route("/leagues/<int:league_id>/team/<int:team_id>/byes")
@login_required
def team_byes(league_id, team_id):
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    lookahead = max(1, min(20, request.args.get("lookahead", 10, type=int)))

    # Pull team's active roster + their AflPlayer record (skip benched? no
    # — bye planning cares about the whole list since you might be moving
    # players up). For now: all active roster spots.
    rosters = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    pairs = [(db.session.get(AflPlayer, r.player_id), r) for r in rosters]
    pairs = [(p, r) for p, r in pairs if p]

    # Anchor at the current AFL round; if we can't determine one, start at 1.
    from models.database import AflGame
    try:
        from scrapers.squiggle import get_current_round
        current_round = get_current_round(league.season_year) or 1
    except Exception:
        current_round = 1

    results = []
    for rnd in range(current_round, current_round + lookahead):
        games = AflGame.query.filter_by(year=league.season_year, afl_round=rnd).all()
        if not games:
            continue  # round not in the scraped schedule yet
        teams_playing = set()
        for g in games:
            teams_playing.add(g.home_team)
            teams_playing.add(g.away_team)
        players_out = []
        for p, _r in pairs:
            if p.afl_team and p.afl_team not in teams_playing:
                players_out.append({
                    "id": p.id,
                    "name": p.name,
                    "afl_team": p.afl_team,
                    "position": (p.position or "MID").split("/")[0].upper(),
                })
        # Sort players_out by position for readable grouping.
        pos_order = {"DEF": 0, "MID": 1, "RUC": 2, "FWD": 3}
        players_out.sort(key=lambda x: (pos_order.get(x["position"], 9), x["name"]))
        results.append({
            "round": rnd,
            "players_out": players_out,
            "total_out": len(players_out),
        })

    return jsonify({
        "current_round": current_round,
        "lookahead": lookahead,
        "rounds": results,
    })


# ── Team stats ────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/team/<int:team_id>/stats")
@login_required
def team_stats(league_id, team_id):
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    league = db.session.get(League, league_id)

    # Get all round breakdowns for this team
    round_scores = RoundScore.query.filter_by(team_id=team_id, year=league.season_year).all()

    # Build per-player stats from breakdown JSON
    player_stats: dict = {}
    for rs in round_scores:
        if not rs.breakdown:
            continue
        bd = rs.breakdown if isinstance(rs.breakdown, list) else []
        for entry in bd:
            name = entry.get("name", "?")
            score = entry.get("final_score", 0) or entry.get("score", 0) or 0
            if score <= 0:
                continue
            if name not in player_stats:
                player_stats[name] = {"scores": [], "position": entry.get("position", "")}
            player_stats[name]["scores"].append(score)

    # Merge with roster
    players = []
    team_total = 0
    for rs in roster:
        p = rs.player
        if not p:
            continue
        ps = player_stats.get(p.name, {"scores": [], "position": p.position or ""})
        scores = ps["scores"]
        avg = sum(scores) / len(scores) if scores else (p.sc_avg or 0)
        total = sum(scores)
        team_total += total
        players.append({
            "name": p.name, "position": p.position or "",
            "games": len(scores), "sc_avg": avg, "sc_total": total,
            "best": max(scores) if scores else 0,
            "worst": min(scores) if scores else 0,
            "consistency": 0,
        })

    team_avg = sum(p["sc_avg"] for p in players) / len(players) if players else 0

    return jsonify({
        "team": {"id": team.id, "name": team.name},
        "players": sorted(players, key=lambda x: -x["sc_avg"]),
        "team_avg": team_avg,
        "team_total": team_total,
    })


# ── Lineup ────────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/team/<int:team_id>/lineup/<int:round_num>")
@login_required
def lineup(league_id, team_id, round_num):
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    league = db.session.get(League, league_id)
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()

    wl = WeeklyLineup.query.filter_by(team_id=team_id, afl_round=round_num, year=league.season_year).first()
    slot_map = {}
    if wl:
        for slot in wl.slots:
            slot_map[slot.player_id] = slot

    sc = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    max_round = sc.num_regular_rounds if sc else 23

    players = []
    for rs in roster:
        p = rs.player
        if not p:
            continue
        slot = slot_map.get(p.id)
        # If player is in a lineup slot, they're playing; otherwise use FantasyRoster.is_benched
        is_playing = slot is not None if wl else not rs.is_benched
        injury = f"{p.injury_type} ({p.injury_return})" if p.injury_type else None
        players.append({
            "id": p.id,
            "name": p.name,
            "position": slot.position_code if slot else (p.position or ""),
            "afl_team": p.afl_team or "",
            "sc_avg": p.sc_avg or 0,
            "is_captain": slot.is_captain if slot else False,
            "is_vc": slot.is_vice_captain if slot else False,
            "is_emergency": 1 if (slot and slot.is_emergency) else 0,
            "playing": is_playing,
            "bench": not is_playing,
            "injury": injury,
        })

    # ── Build a FieldData-shaped snapshot so the historical view can
    #    render in the SAME FieldView (field background + positioned
    #    cards) as the live squad, just read-only. ──
    from models.database import LeaguePositionSlot
    import config as _cfg

    def _sp(p):
        return {
            "id": p.id, "name": p.name, "position": p.position or "",
            "afl_team": p.afl_team or "", "age": p.age or 0,
            "sc_avg": p.sc_avg or 0, "games_played": p.games_played or 0,
            "career_games": p.career_games or 0, "rating": p.rating,
            "injury_type": p.injury_type, "injury_return": p.injury_return,
            "injury_severity": p.injury_severity,
        }

    pos_slots = LeaguePositionSlot.query.filter_by(league_id=league_id).all()
    slot_counts, flex_count = {}, 0
    for ps in pos_slots:
        if ps.is_bench and ps.position_code == "FLEX":
            flex_count = ps.count
        elif not ps.is_bench:
            slot_counts[ps.position_code] = ps.count
    if not slot_counts:
        slot_counts = _cfg.POSITIONS.copy()
    if not flex_count:
        flex_count = 1

    zones = {}
    flex_slots = []
    reserves = []
    emergency_players = []
    emergency_ids = []
    cap_id = vc_id = None
    roster_by_id = {rs.player_id: rs for rs in roster}

    if wl:
        # Use the saved lineup slots.
        for slot in wl.slots:
            p = slot.player
            if not p:
                continue
            if slot.is_captain:
                cap_id = p.id
            if slot.is_vice_captain:
                vc_id = p.id
            if slot.is_emergency:
                emergency_players.append(_sp(p))
                emergency_ids.append(p.id)
                continue
            code = slot.position_code
            if code in ("DEF", "MID", "FWD", "RUC"):
                zones.setdefault(code, []).append(_sp(p))
            elif code == "FLEX":
                flex_slots.append(_sp(p))
            else:
                reserves.append(_sp(p))
        # Players on roster not in any slot → reserves.
        slotted = {s.player_id for s in wl.slots}
        for rs in roster:
            if rs.player and rs.player_id not in slotted:
                reserves.append(_sp(rs.player))
    else:
        # No saved lineup for this round — fall back to current roster
        # flags so the field still renders something coherent.
        for rs in roster:
            p = rs.player
            if not p:
                continue
            if rs.is_captain:
                cap_id = p.id
            if rs.is_vice_captain:
                vc_id = p.id
            if rs.is_benched:
                reserves.append(_sp(p))
            elif rs.position_code in ("DEF", "MID", "FWD", "RUC"):
                zones.setdefault(rs.position_code, []).append(_sp(p))
            elif rs.position_code == "FLEX":
                flex_slots.append(_sp(p))
            else:
                reserves.append(_sp(p))

    # Pad zones to slot counts with None.
    for code, count in slot_counts.items():
        cur = zones.get(code, [])
        while len(cur) < count:
            cur.append(None)
        zones[code] = cur[:count]

    # zone_layouts drives the field render: it's the per-zone list of row
    # sizes (e.g. 4 → [2,2]) that FieldView slices the padded zones list
    # by. Without it the zones render EMPTY. Mirror team.py's calc_zone_rows.
    def _calc_zone_rows(count):
        if count <= 0:
            return []
        if count <= 3:
            return [count]
        if count == 4:
            return [2, 2]
        if count == 5:
            return [3, 2]
        if count == 6:
            return [3, 3]
        if count == 7:
            return [2, 3, 2]
        if count == 8:
            return [3, 2, 3]
        if count == 9:
            return [5, 4]
        if count == 10:
            return [5, 5]
        rows, remaining = [], count
        while remaining > 0:
            row = min(5, remaining)
            rows.append(row)
            remaining -= row
        return rows

    zone_layouts = {code: _calc_zone_rows(count) for code, count in slot_counts.items()}

    flex_data = [{"player": flex_slots[i] if i < len(flex_slots) else None} for i in range(flex_count)]

    reserves_by_pos = {}
    for sp in reserves:
        primary = (sp["position"] or "MID").split("/")[0]
        reserves_by_pos.setdefault(primary, []).append(sp)

    field_data = {
        "zones": zones,
        "flex_data": flex_data,
        "flex_count": flex_count,
        "cap_id": cap_id,
        "vc_id": vc_id,
        "reserves": reserves,
        "reserves_by_pos": reserves_by_pos,
        "emergency_players": emergency_players,
        "emergency_ids": emergency_ids,
        "sevens_players": [],
        "sevens_ids": [],
        "sevens_captain_id": None,
        "sevens_captain_enabled": False,
        "has_7s_fixture": False,
        "injury_list": [],
        "ltil_entries": [],
        "ltil_full": [],
        "pending_ltil": [],
        "pending_ltil_count": 0,
        "ssp_slots": 1,
        "ssp_enabled": False,
        "ssp_window_active": False,
        "can_remove_ltil": False,
        "locked_teams": [],
        "teams_playing": [],
        "selected_player_ids": [],
        "next_lockout_time": None,
        "slot_counts": slot_counts,
        "zone_layouts": zone_layouts,
        "player_form": {},
        "cap_locked": False,
        "vc_locked": False,
    }

    return jsonify({
        "team": {"id": team.id, "name": team.name},
        "round": round_num,
        "max_round": max_round,
        "players": players,
        "locked": wl.is_locked if wl else False,
        "field_data": field_data,
        "team_logos": getattr(_cfg, "TEAM_LOGOS", {}),
    })


# ── Player pool ───────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/player-pool")
@login_required
def player_pool(league_id):
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    search = request.args.get("search", "").strip().lower()
    position = request.args.get("position", "").strip()
    status = request.args.get("status", "all")
    sort_col = request.args.get("sort", "sc_avg")
    sort_dir = request.args.get("dir", "desc")
    page = int(request.args.get("page", 1))
    per_page = 50

    # Build owner map
    owner_map = {}
    for rs in FantasyRoster.query.join(FantasyTeam).filter(
        FantasyTeam.league_id == league_id, FantasyRoster.is_active == True
    ).all():
        owner_map[rs.player_id] = rs.team.name if rs.team else "?"

    query = AflPlayer.query
    if search:
        query = query.filter(AflPlayer.name.ilike(f"%{search}%"))
    if position:
        query = query.filter(AflPlayer.position.contains(position))

    sort_map = {
        "sc_avg": AflPlayer.sc_avg, "age": AflPlayer.age,
        "name": AflPlayer.name, "games": AflPlayer.games_played,
    }
    col = sort_map.get(sort_col, AflPlayer.sc_avg)
    query = query.order_by(col.asc() if sort_dir == "asc" else col.desc())

    all_players = query.all()
    if status == "available":
        all_players = [p for p in all_players if p.id not in owner_map]
    elif status == "rostered":
        all_players = [p for p in all_players if p.id in owner_map]

    total = len(all_players)
    paged = all_players[(page - 1) * per_page : page * per_page]

    return jsonify({
        "players": [{
            "id": p.id, "name": p.name, "position": p.position or "",
            "afl_team": p.afl_team or "", "age": p.age or 0,
            "sc_avg": p.sc_avg or 0, "games": p.games_played or 0,
            "owner": owner_map.get(p.id), "tag": "",
        } for p in paged],
        "total": total, "page": page, "per_page": per_page,
    })


# ── Trades ────────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/trades")
@login_required
def trade_list(league_id):
    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        return jsonify({"incoming": [], "outgoing": [], "completed": []})

    all_trades = Trade.query.filter_by(league_id=league_id).order_by(Trade.proposed_at.desc()).all()

    def fmt(t):
        return {
            "id": t.id,
            "proposer": t.proposer_team.name if t.proposer_team else "?",
            "recipient": t.recipient_team.name if t.recipient_team else "?",
            "status": t.status,
            "created": t.proposed_at.strftime("%b %d") if t.proposed_at else "",
            "players_out": [a.player.name if a.player else "Pick" for a in t.assets if a.from_team_id == t.proposer_team_id],
            "players_in": [a.player.name if a.player else "Pick" for a in t.assets if a.from_team_id == t.recipient_team_id],
        }

    # Privacy: pending offers are private to the two parties; the public
    # "completed" ledger only shows ACCEPTED trades (never rejected /
    # cancelled / vetoed / expired ones from other teams).
    active = ("pending", "agreed")
    return jsonify({
        "incoming": [fmt(t) for t in all_trades if t.recipient_team_id == user_team.id and t.status in active],
        "outgoing": [fmt(t) for t in all_trades if t.proposer_team_id == user_team.id and t.status in active],
        "completed": [fmt(t) for t in all_trades if t.status == "accepted"][:20],
    })


# ── Trades roster ─────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/trades/roster/<int:team_id>")
@login_required
def trade_roster(league_id, team_id):
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    return jsonify(sorted([{
        "id": rs.player.id, "name": rs.player.name,
        "position": rs.player.position or "", "sc_avg": rs.player.sc_avg or 0,
    } for rs in roster if rs.player], key=lambda x: -x["sc_avg"]))


# ── Chat ──────────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/chat")
@login_required
def chat_messages(league_id):
    # Find or create the league chat
    chat = LeagueChat.query.filter_by(league_id=league_id).first()
    if not chat:
        return jsonify([])

    msgs = LeagueChatMessage.query.filter_by(league_chat_id=chat.id).order_by(
        LeagueChatMessage.created_at.asc()
    ).limit(200).all()

    return jsonify([{
        "id": m.id,
        "author": m.sender.display_name if m.sender else "?",
        "author_id": m.sender_user_id,
        "text": m.body,
        "created": m.created_at.strftime("%H:%M") if m.created_at else "",
    } for m in msgs])


@spa_api.route("/leagues/<int:league_id>/chat/send", methods=["POST"])
@login_required
def chat_send(league_id):
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "Empty"}), 400

    chat = LeagueChat.query.filter_by(league_id=league_id).first()
    if not chat:
        chat = LeagueChat(league_id=league_id)
        db.session.add(chat)
        db.session.flush()

    msg = LeagueChatMessage(
        league_chat_id=chat.id,
        sender_user_id=current_user.id,
        body=text[:500],
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({"ok": True})


# ── Notifications ─────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/notifications")
@login_required
def notifications(league_id):
    notifs = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

    return jsonify([{
        "id": n.id, "type": n.type or "",
        "title": n.title or "", "body": n.body or "",
        "read": n.is_read or False,
        "created": n.created_at.strftime("%b %d, %H:%M") if n.created_at else "",
        "link": n.link,
    } for n in notifs])


@spa_api.route("/leagues/<int:league_id>/notifications/read/<int:notif_id>", methods=["POST"])
@login_required
def notification_read(league_id, notif_id):
    n = db.session.get(Notification, notif_id)
    if n and n.user_id == current_user.id:
        n.is_read = True
        db.session.commit()
    return jsonify({"ok": True})


@spa_api.route("/leagues/<int:league_id>/notifications/read-all", methods=["POST"])
@login_required
def notifications_read_all(league_id):
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True})


# ── Activity feed ─────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/activity")
@login_required
def activity_feed(league_id):
    activities = ActivityFeedEntry.query.filter_by(league_id=league_id).order_by(
        ActivityFeedEntry.created_at.desc()
    ).limit(50).all()

    return jsonify([{
        "id": a.id, "type": a.type or "",
        "text": a.title or "",
        "actor": a.actor.display_name if a.actor else "",
        "created": a.created_at.strftime("%b %d, %H:%M") if a.created_at else "",
    } for a in activities])


# ── Settings ──────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/settings", methods=["GET", "POST"])
@login_required
def league_settings(league_id):
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    sc = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if league.commissioner_id != current_user.id:
            return jsonify({"error": "Not commissioner"}), 403
        if data.get("name"):
            league.name = data["name"]
        db.session.commit()
        return jsonify({"ok": True})

    return jsonify({
        "name": league.name,
        "season_year": league.season_year,
        "invite_code": league.invite_code or "",
        "max_roster_size": league.squad_size or 38,
        "trade_review_hours": 24,
        "lineup_lock": "",
    })


# ── Trade detail ──────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/trades/<int:trade_id>")
@login_required
def trade_detail(league_id, trade_id):
    t = db.session.get(Trade, trade_id)
    if not t or t.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    league = db.session.get(League, league_id)
    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    is_party = user_team and user_team.id in (t.proposer_team_id, t.recipient_team_id)
    is_commish = league and league.commissioner_id == current_user.id

    # Privacy: non-accepted trades are visible only to the parties + commish.
    if t.status != "accepted" and not (is_party or is_commish):
        return jsonify({"error": "This trade is private to the parties involved."}), 403

    return jsonify({
        "id": t.id,
        "proposer": {
            "team_id": t.proposer_team_id,
            "team_name": t.proposer_team.name if t.proposer_team else "?",
            "owner": t.proposer_team.owner.display_name if t.proposer_team and t.proposer_team.owner else "?",
        },
        "recipient": {
            "team_id": t.recipient_team_id,
            "team_name": t.recipient_team.name if t.recipient_team else "?",
            "owner": t.recipient_team.owner.display_name if t.recipient_team and t.recipient_team.owner else "?",
        },
        "status": t.status,
        "created": t.proposed_at.strftime("%b %d, %Y") if t.proposed_at else "",
        "message": t.notes or "",
        "players_out": [{"name": a.player.name if a.player else "Pick", "position": a.player.position if a.player else "", "sc_avg": a.player.sc_avg or 0 if a.player else 0} for a in t.assets if a.from_team_id == t.proposer_team_id],
        "players_in": [{"name": a.player.name if a.player else "Pick", "position": a.player.position if a.player else "", "sc_avg": a.player.sc_avg or 0 if a.player else 0} for a in t.assets if a.from_team_id == t.recipient_team_id],
        "comments": [{"author": c.user.display_name if c.user else "?", "text": c.comment, "created": c.created_at.strftime("%b %d, %H:%M") if c.created_at else ""} for c in t.comments],
        "can_respond": user_team and user_team.id == t.recipient_team_id and t.status == "pending",
        "can_veto": is_commish and t.status == "pending",
    })


# ── Global (cross-league) notifications ───────────────────────────────

@spa_api.route("/notifications/unread-count")
@login_required
def notifications_unread_count():
    count = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({"count": count})


@spa_api.route("/notifications/recent")
@login_required
def notifications_recent():
    """Recent notifications across all leagues for the header bell."""
    notifs = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).limit(15).all()
    return jsonify({"items": [{
        "id": n.id,
        "type": n.type or "",
        "title": n.title or "",
        "body": n.body or "",
        "url": n.link,
        "is_read": bool(n.is_read),
        "created_at": n.created_at.isoformat() if n.created_at else "",
    } for n in notifs]})


@spa_api.route("/notifications/read-all", methods=["POST"])
@login_required
def notifications_read_all_global():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True})


@spa_api.route("/notifications/read/<int:notif_id>", methods=["POST"])
@login_required
def notification_read_global(notif_id):
    n = db.session.get(Notification, notif_id)
    if n and n.user_id == current_user.id:
        n.is_read = True
        db.session.commit()
    return jsonify({"ok": True})


# ── State league scouting ────────────────────────────────────────────


@spa_api.route("/leagues/<int:league_id>/state-league-stats")
@login_required
def state_league_stats(league_id):
    comp = request.args.get("comp", "")
    season = request.args.get("season", type=int)
    afl_only = request.args.get("afl_only", "true").lower() == "true"
    search = request.args.get("search", "").strip()
    sort = request.args.get("sort", "disposals")
    direction = request.args.get("dir", "desc")
    page = request.args.get("page", 1, type=int)
    per_page = 50

    mode = request.args.get("mode", "avg")
    team_filter = request.args.get("team", "").strip()

    _AVG_FIELDS = {"kicks", "handballs", "disposals", "marks", "behinds",
                   "tackles", "hitouts", "contested_possessions", "uncontested_possessions",
                   "clearances", "inside_fifties", "rebounds", "intercepts",
                   "score_involvements", "frees_for", "frees_against", "contested_marks",
                   "tackles_inside_50", "total_possessions", "dreamteam_avg"}
    _TOTAL_FIELDS = {"goals"}

    def _apply_mode(val, field, matches):
        if val is None:
            return None
        if field in _TOTAL_FIELDS:
            return round(val / matches, 1) if mode == "avg" and matches else val
        if field in _AVG_FIELDS:
            return round(val * matches, 1) if mode == "total" and matches else val
        return val

    # Build base filter
    q = StateLeagueStat.query
    if comp:
        q = q.filter(StateLeagueStat.competition == comp)
    if season:
        q = q.filter(StateLeagueStat.season == season)
    if afl_only:
        q = q.filter(StateLeagueStat.is_afl_listed == True)
    if search:
        q = q.filter(StateLeagueStat.player_name.ilike(f"%{search}%"))

    # Distinct team list for the dropdown — built BEFORE the team filter is applied
    # so selecting a team doesn't collapse the list to that team only.
    teams_q = db.session.query(StateLeagueStat.team).distinct()
    if comp:
        teams_q = teams_q.filter(StateLeagueStat.competition == comp)
    if season:
        teams_q = teams_q.filter(StateLeagueStat.season == season)
    if afl_only:
        teams_q = teams_q.filter(StateLeagueStat.is_afl_listed == True)
    if search:
        teams_q = teams_q.filter(StateLeagueStat.player_name.ilike(f"%{search}%"))
    teams_list = sorted([t[0] for t in teams_q.all() if t[0]])

    if team_filter:
        q = q.filter(StateLeagueStat.team == team_filter)

    # Build fantasy ownership lookup for this league
    from models.database import FantasyRoster, FantasyTeam, User
    ownership = {}
    roster_rows = db.session.query(
        FantasyRoster.player_id, FantasyTeam.name, User.display_name
    ).join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)\
     .join(User, FantasyTeam.owner_id == User.id)\
     .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True).all()
    for pid, tname, coach in roster_rows:
        ownership[pid] = {"fantasy_team": tname, "coach": coach}

    if season:
        # ── Single season: direct query ──
        col = getattr(StateLeagueStat, sort, StateLeagueStat.disposals)
        q = q.order_by(col.desc() if direction == "desc" else col.asc())
        total = q.count()
        rows = q.offset((page - 1) * per_page).limit(per_page).all()

        player_ids = [r.player_id for r in rows if r.player_id]
        afl_map = {}
        if player_ids:
            for p in AflPlayer.query.filter(AflPlayer.id.in_(player_ids)).all():
                afl_map[p.id] = {"afl_team": p.afl_team, "position": p.position,
                                 "sc_avg": p.sc_avg, "rating": p.rating, "potential": p.potential}

        _STAT_FIELDS = ["kicks", "handballs", "disposals", "marks", "goals",
                        "behinds", "tackles", "hitouts", "contested_possessions",
                        "uncontested_possessions", "clearances", "inside_fifties",
                        "rebounds", "intercepts", "score_involvements", "frees_for",
                        "frees_against", "contested_marks", "tackles_inside_50",
                        "dreamteam_avg", "total_possessions"]

        data = []
        for r in rows:
            afl = afl_map.get(r.player_id, {})
            own = ownership.get(r.player_id, {})
            d = {
                "id": r.id, "player_name": r.player_name, "competition": r.competition,
                "season": r.season, "team": r.team, "age": r.age, "matches": r.matches,
                "is_afl_listed": r.is_afl_listed, "player_id": r.player_id,
                "afl_team": afl.get("afl_team"), "position": afl.get("position"),
                "sc_avg": afl.get("sc_avg"), "rating": afl.get("rating"), "potential": afl.get("potential"),
                "fantasy_team": own.get("fantasy_team"), "coach": own.get("coach"),
                "goals_avg": r.goals_avg,
                "disposal_efficiency": r.disposal_efficiency,
                "kick_percentage": r.kick_percentage,
                "contested_possession_rate": r.contested_possession_rate,
                "score_involvement_pct": r.score_involvement_pct,
            }
            for f in _STAT_FIELDS:
                d[f] = _apply_mode(getattr(r, f), f, r.matches)
            data.append(d)
    else:
        # ── All Seasons: SQL aggregation (fast) ──
        from sqlalchemy import func, case, literal_column

        S = StateLeagueStat
        # Weighted average: SUM(stat * matches) / SUM(matches)
        # We use case() to get the latest season's metadata via MAX
        _wavg = lambda col: func.round(
            func.sum(col * S.matches) / func.nullif(func.sum(
                case((col.isnot(None), S.matches), else_=0)
            ), 0), 1
        )

        agg_q = db.session.query(
            S.player_name,
            func.sum(S.matches).label("matches"),
            func.max(S.id).label("id"),
            func.max(S.season).label("season"),
            func.max(S.player_id).label("player_id"),
            func.sum(S.goals).label("goals"),
            _wavg(S.kicks).label("kicks"),
            _wavg(S.handballs).label("handballs"),
            _wavg(S.disposals).label("disposals"),
            _wavg(S.marks).label("marks"),
            _wavg(S.behinds).label("behinds"),
            _wavg(S.tackles).label("tackles"),
            _wavg(S.hitouts).label("hitouts"),
            _wavg(S.contested_possessions).label("contested_possessions"),
            _wavg(S.uncontested_possessions).label("uncontested_possessions"),
            _wavg(S.clearances).label("clearances"),
            _wavg(S.inside_fifties).label("inside_fifties"),
            _wavg(S.rebounds).label("rebounds"),
            _wavg(S.intercepts).label("intercepts"),
            _wavg(S.score_involvements).label("score_involvements"),
            _wavg(S.frees_for).label("frees_for"),
            _wavg(S.frees_against).label("frees_against"),
            _wavg(S.contested_marks).label("contested_marks"),
            _wavg(S.tackles_inside_50).label("tackles_inside_50"),
            _wavg(S.dreamteam_avg).label("dreamteam_avg"),
            _wavg(S.total_possessions).label("total_possessions"),
            _wavg(S.disposal_efficiency).label("disposal_efficiency"),
            _wavg(S.kick_percentage).label("kick_percentage"),
            _wavg(S.contested_possession_rate).label("contested_possession_rate"),
            _wavg(S.score_involvement_pct).label("score_involvement_pct"),
        )
        if comp:
            agg_q = agg_q.filter(S.competition == comp)
        if afl_only:
            agg_q = agg_q.filter(S.is_afl_listed == True)
        if search:
            agg_q = agg_q.filter(S.player_name.ilike(f"%{search}%"))
        if team_filter:
            agg_q = agg_q.filter(S.team == team_filter)

        agg_q = agg_q.group_by(S.player_name)

        # Sort
        sort_col = sort if sort in ("matches", "goals", "kicks", "handballs", "disposals",
            "marks", "tackles", "hitouts", "contested_possessions", "clearances",
            "inside_fifties", "rebounds", "intercepts", "dreamteam_avg", "frees_for",
            "frees_against", "contested_marks", "tackles_inside_50", "total_possessions",
            "score_involvements", "disposal_efficiency") else "disposals"
        sort_label = literal_column(sort_col)
        agg_q = agg_q.order_by(sort_label.desc() if direction == "desc" else sort_label.asc())

        # Count total before pagination
        count_q = db.session.query(func.count()).select_from(
            agg_q.subquery()
        )
        total = count_q.scalar()
        rows = agg_q.offset((page - 1) * per_page).limit(per_page).all()

        # Get metadata for the latest season row of each player
        latest_ids = [r.id for r in rows if r.id]
        meta_map = {}
        if latest_ids:
            for sl in StateLeagueStat.query.filter(StateLeagueStat.id.in_(latest_ids)).all():
                meta_map[sl.player_name] = {
                    "team": sl.team, "age": sl.age, "competition": sl.competition,
                    "is_afl_listed": sl.is_afl_listed,
                }

        player_ids = [r.player_id for r in rows if r.player_id]
        afl_map = {}
        if player_ids:
            for p in AflPlayer.query.filter(AflPlayer.id.in_(player_ids)).all():
                afl_map[p.id] = {"afl_team": p.afl_team, "position": p.position,
                                 "sc_avg": p.sc_avg, "rating": p.rating, "potential": p.potential}

        _STAT_FIELDS_AGG = ["kicks", "handballs", "disposals", "marks",
                            "behinds", "tackles", "hitouts", "contested_possessions",
                            "uncontested_possessions", "clearances", "inside_fifties",
                            "rebounds", "intercepts", "score_involvements", "frees_for",
                            "frees_against", "contested_marks", "tackles_inside_50",
                            "dreamteam_avg", "total_possessions"]

        data = []
        for r in rows:
            meta = meta_map.get(r.player_name, {})
            afl = afl_map.get(r.player_id, {})
            own = ownership.get(r.player_id, {})
            matches = r.matches or 0
            goals = r.goals or 0
            d = {
                "id": r.id, "player_name": r.player_name,
                "competition": meta.get("competition", ""),
                "season": r.season, "team": meta.get("team", ""),
                "age": meta.get("age"), "matches": matches,
                "is_afl_listed": meta.get("is_afl_listed", False),
                "player_id": r.player_id,
                "afl_team": afl.get("afl_team"), "position": afl.get("position"),
                "sc_avg": afl.get("sc_avg"), "rating": afl.get("rating"), "potential": afl.get("potential"),
                "fantasy_team": own.get("fantasy_team"), "coach": own.get("coach"),
                "goals": _apply_mode(goals, "goals", matches),
                "goals_avg": round(goals / matches, 1) if matches else None,
                "disposal_efficiency": getattr(r, "disposal_efficiency", None),
                "kick_percentage": getattr(r, "kick_percentage", None),
                "contested_possession_rate": getattr(r, "contested_possession_rate", None),
                "score_involvement_pct": getattr(r, "score_involvement_pct", None),
            }
            for f in _STAT_FIELDS_AGG:
                val = getattr(r, f, None)
                d[f] = _apply_mode(val, f, matches)
            data.append(d)

    from config import STATE_LEAGUE_LOGOS, TEAM_LOGOS, TEAM_COLOURS
    team_colours = {name: {"bg": bg, "fg": fg} for name, (bg, fg) in TEAM_COLOURS.items()}
    return jsonify({"players": data, "total": total, "page": page, "pages": (total + per_page - 1) // per_page,
                    "teams": teams_list,
                    "sl_logos": STATE_LEAGUE_LOGOS, "team_logos": TEAM_LOGOS, "team_colours": team_colours})


@spa_api.route("/leagues/<int:league_id>/state-league-stats/player/<int:player_id>")
@login_required
def state_league_player(league_id, player_id):
    from models.database import PlayerStat, ScScore
    from sqlalchemy import func

    sl_rows = StateLeagueStat.query.filter_by(player_id=player_id)\
        .order_by(StateLeagueStat.season.desc()).all()
    state_league = [{
        "level": r.competition.upper(), "season": r.season, "team": r.team,
        "age": r.age, "matches": r.matches,
        "kicks": r.kicks, "handballs": r.handballs, "disposals": r.disposals,
        "marks": r.marks, "goals": r.goals, "tackles": r.tackles, "hitouts": r.hitouts,
        "contested_possessions": r.contested_possessions, "clearances": r.clearances,
        "inside_fifties": r.inside_fifties, "intercepts": r.intercepts,
        "disposal_efficiency": r.disposal_efficiency, "dreamteam_avg": r.dreamteam_avg,
        "contested_marks": r.contested_marks, "score_involvements": r.score_involvements,
    } for r in sl_rows]

    afl_seasons = db.session.query(
        PlayerStat.year,
        func.count(PlayerStat.id).label("matches"),
        func.avg(PlayerStat.kicks).label("kicks"),
        func.avg(PlayerStat.handballs).label("handballs"),
        func.avg(PlayerStat.disposals).label("disposals"),
        func.avg(PlayerStat.marks).label("marks"),
        func.avg(PlayerStat.goals).label("goals"),
        func.avg(PlayerStat.tackles).label("tackles"),
        func.avg(PlayerStat.hitouts).label("hitouts"),
        func.avg(PlayerStat.contested_possessions).label("contested_possessions"),
        func.avg(PlayerStat.clearances).label("clearances"),
        func.avg(PlayerStat.inside_fifties).label("inside_fifties"),
        func.avg(PlayerStat.intercepts).label("intercepts"),
        func.avg(PlayerStat.disposal_efficiency).label("disposal_efficiency"),
        func.avg(PlayerStat.supercoach_score).label("sc_avg"),
        func.avg(PlayerStat.contested_marks).label("contested_marks"),
        func.avg(PlayerStat.score_involvements).label("score_involvements"),
    ).filter_by(player_id=player_id).group_by(PlayerStat.year)\
     .order_by(PlayerStat.year.desc()).all()

    p = db.session.get(AflPlayer, player_id)
    afl = [{
        "level": "AFL", "season": r.year, "team": p.afl_team if p else None,
        "age": None, "matches": r.matches,
        "kicks": round(r.kicks, 1) if r.kicks else None,
        "handballs": round(r.handballs, 1) if r.handballs else None,
        "disposals": round(r.disposals, 1) if r.disposals else None,
        "marks": round(r.marks, 1) if r.marks else None,
        "goals": round(r.goals, 1) if r.goals else None,
        "tackles": round(r.tackles, 1) if r.tackles else None,
        "hitouts": round(r.hitouts, 1) if r.hitouts else None,
        "contested_possessions": round(r.contested_possessions, 1) if r.contested_possessions else None,
        "clearances": round(r.clearances, 1) if r.clearances else None,
        "inside_fifties": round(r.inside_fifties, 1) if r.inside_fifties else None,
        "intercepts": round(r.intercepts, 1) if r.intercepts else None,
        "disposal_efficiency": round(r.disposal_efficiency, 1) if r.disposal_efficiency else None,
        "dreamteam_avg": None, "sc_avg": round(r.sc_avg, 1) if r.sc_avg else None,
        "contested_marks": round(r.contested_marks, 1) if r.contested_marks else None,
        "score_involvements": round(r.score_involvements, 1) if r.score_involvements else None,
    } for r in afl_seasons]

    combined = sorted(state_league + afl, key=lambda x: x["season"])
    return jsonify(combined)


@spa_api.route("/leagues/<int:league_id>/state-league-stats/career-by-name")
@login_required
def state_league_career_by_name(league_id):
    """Career data for any state league player, looked up by name.
    Works for ALL players — no AFL player link required."""
    from models.database import PlayerStat
    from sqlalchemy import func

    name = request.args.get("name", "").strip()
    if not name:
        return jsonify([])

    sl_rows = StateLeagueStat.query.filter_by(player_name=name)\
        .order_by(StateLeagueStat.season).all()
    state_league = [{
        "level": r.competition.upper(), "season": r.season, "team": r.team,
        "age": r.age, "matches": r.matches,
        "kicks": r.kicks, "handballs": r.handballs, "disposals": r.disposals,
        "marks": r.marks, "goals": r.goals, "tackles": r.tackles, "hitouts": r.hitouts,
        "contested_possessions": r.contested_possessions, "clearances": r.clearances,
        "inside_fifties": r.inside_fifties, "intercepts": r.intercepts,
        "disposal_efficiency": r.disposal_efficiency, "dreamteam_avg": r.dreamteam_avg,
        "sc_avg": r.dreamteam_avg,
        "contested_marks": r.contested_marks, "score_involvements": r.score_involvements,
    } for r in sl_rows]

    # Also try to find AFL stats if any row has a player_id link
    player_ids = list({r.player_id for r in sl_rows if r.player_id})
    afl = []
    for pid in player_ids:
        afl_seasons = db.session.query(
            PlayerStat.year,
            func.count(PlayerStat.id).label("matches"),
            func.avg(PlayerStat.disposals).label("disposals"),
            func.avg(PlayerStat.marks).label("marks"),
            func.avg(PlayerStat.goals).label("goals"),
            func.avg(PlayerStat.tackles).label("tackles"),
            func.avg(PlayerStat.hitouts).label("hitouts"),
            func.avg(PlayerStat.contested_possessions).label("contested_possessions"),
            func.avg(PlayerStat.clearances).label("clearances"),
            func.avg(PlayerStat.supercoach_score).label("sc_avg"),
        ).filter_by(player_id=pid).group_by(PlayerStat.year).all()
        p = db.session.get(AflPlayer, pid)
        for r in afl_seasons:
            afl.append({
                "level": "AFL", "season": r.year, "team": p.afl_team if p else None,
                "age": None, "matches": r.matches,
                "disposals": round(r.disposals, 1) if r.disposals else None,
                "marks": round(r.marks, 1) if r.marks else None,
                "goals": round(r.goals, 1) if r.goals else None,
                "tackles": round(r.tackles, 1) if r.tackles else None,
                "hitouts": round(r.hitouts, 1) if r.hitouts else None,
                "contested_possessions": round(r.contested_possessions, 1) if r.contested_possessions else None,
                "clearances": round(r.clearances, 1) if r.clearances else None,
                "dreamteam_avg": None, "sc_avg": round(r.sc_avg, 1) if r.sc_avg else None,
            })

    combined = sorted(state_league + afl, key=lambda x: x["season"])
    return jsonify(combined)


@spa_api.route("/leagues/<int:league_id>/state-league-stats/comps")
@login_required
def state_league_comps(league_id):
    rows = db.session.query(
        StateLeagueStat.competition,
        StateLeagueStat.season,
        db.func.count(StateLeagueStat.id)
    ).group_by(StateLeagueStat.competition, StateLeagueStat.season)\
     .order_by(StateLeagueStat.competition, StateLeagueStat.season.desc()).all()
    return jsonify([{"comp": r[0], "season": r[1], "count": r[2]} for r in rows])


@spa_api.route("/leagues/<int:league_id>/scouting/predictions")
@login_required
def scouting_predictions(league_id):
    from models.scouting_model import bulk_predict
    season = request.args.get("season", type=int)
    comp = request.args.get("comp", "")
    afl_only = request.args.get("afl_only", "false").lower() == "true"
    min_matches = request.args.get("min_matches", 3, type=int)

    results = bulk_predict(
        season=season, competition=comp or None,
        min_matches=min_matches, afl_listed_only=afl_only,
    )
    return jsonify(results)


@spa_api.route("/leagues/<int:league_id>/scouting/predict/<int:sl_id>")
@login_required
def scouting_predict_single(league_id, sl_id):
    from models.scouting_model import predict_afl_output
    sl = db.session.get(StateLeagueStat, sl_id)
    if not sl:
        return jsonify({"error": "Not found"}), 404
    result = predict_afl_output(sl_row=sl)
    if not result:
        return jsonify({"error": "No model or insufficient data"}), 400
    return jsonify(result)



# ═══════════════════════════════════════════════════════════════════════
# Innovation features: Breakout Radar, Round Recap, Win Probability
# ═══════════════════════════════════════════════════════════════════════

@spa_api.route("/leagues/<int:league_id>/breakout-radar")
@login_required
def breakout_radar(league_id):
    """Players trending toward a senior AFL role based on SL form + scouting model."""
    from models.database import StateLeagueStat, AflPlayer
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    year = league.season_year
    comp_filter = request.args.get("comp", "")
    listed_filter = request.args.get("listed", "any")
    min_prob = request.args.get("min_prob", 0, type=int)

    q = StateLeagueStat.query.filter(
        StateLeagueStat.season == year,
        StateLeagueStat.predicted_afl_sc.isnot(None),
        StateLeagueStat.matches >= 2,
    )
    if comp_filter:
        q = q.filter(StateLeagueStat.competition == comp_filter)
    if listed_filter == "afl_only":
        q = q.filter(StateLeagueStat.is_afl_listed == True)
    elif listed_filter == "unlisted":
        q = q.filter(StateLeagueStat.is_afl_listed == False)
    if min_prob > 0:
        q = q.filter(StateLeagueStat.breakout_probability >= min_prob)

    rows = q.order_by(StateLeagueStat.predicted_afl_sc.desc()).limit(80).all()
    player_ids = [r.player_id for r in rows if r.player_id]
    afl_map = {}
    if player_ids:
        for ap in AflPlayer.query.filter(AflPlayer.id.in_(player_ids)).all():
            afl_map[ap.id] = {"afl_team": ap.afl_team, "position": ap.position,
                              "sc_avg": ap.sc_avg, "rating": ap.rating,
                              "potential": ap.potential}

    players = []
    for r in rows:
        afl = afl_map.get(r.player_id, {})
        players.append({
            "id": r.id,
            "player_id": r.player_id,
            "name": r.player_name,
            "comp": (r.competition or "").upper(),
            "sl_team": r.team,
            "age": r.age,
            "matches": r.matches,
            "sl_fantasy_avg": round(r.dreamteam_avg, 1) if r.dreamteam_avg else 0,
            "sl_disposals": round(r.disposals, 1) if r.disposals else 0,
            "sl_goals_avg": round(r.goals_avg, 2) if r.goals_avg else 0,
            "is_afl_listed": r.is_afl_listed,
            "afl_team": afl.get("afl_team"),
            "afl_sc_avg": afl.get("sc_avg"),
            "rating": afl.get("rating"),
            "potential": afl.get("potential"),
            "predicted_afl_sc": round(r.predicted_afl_sc, 1) if r.predicted_afl_sc else 0,
            "breakout_probability": round(r.breakout_probability, 0) if r.breakout_probability else 0,
            "draft_probability": round(r.draft_probability, 0) if r.draft_probability else 0,
            "scouting_tag": r.scouting_tag or "",
        })

    return jsonify({"year": year, "players": players, "total": len(players)})


from blueprints.innovation_endpoints import register_innovation_endpoints
register_innovation_endpoints(spa_api)

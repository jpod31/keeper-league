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

    from models.scoring_engine import get_current_afl_round
    current_round = get_current_afl_round(league.season_year)

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

    return jsonify({
        "team": {"id": team.id, "name": team.name},
        "round": round_num,
        "max_round": max_round,
        "players": players,
        "locked": wl.is_locked if wl else False,
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

    return jsonify({
        "incoming": [fmt(t) for t in all_trades if t.recipient_team_id == user_team.id and t.status == "pending"],
        "outgoing": [fmt(t) for t in all_trades if t.proposer_team_id == user_team.id and t.status == "pending"],
        "completed": [fmt(t) for t in all_trades if t.status != "pending"][:20],
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

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()

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
        "can_veto": league.commissioner_id == current_user.id and t.status == "pending",
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

    q = StateLeagueStat.query
    if comp:
        q = q.filter(StateLeagueStat.competition == comp)
    if season:
        q = q.filter(StateLeagueStat.season == season)
    if afl_only:
        q = q.filter(StateLeagueStat.is_afl_listed == True)
    if search:
        q = q.filter(StateLeagueStat.player_name.ilike(f"%{search}%"))

    col = getattr(StateLeagueStat, sort, StateLeagueStat.disposals)
    q = q.order_by(col.desc() if direction == "desc" else col.asc())

    total = q.count()
    rows = q.offset((page - 1) * per_page).limit(per_page).all()

    player_ids = [r.player_id for r in rows if r.player_id]
    afl_map = {}
    if player_ids:
        for p in AflPlayer.query.filter(AflPlayer.id.in_(player_ids)).all():
            afl_map[p.id] = {"afl_team": p.afl_team, "position": p.position,
                             "sc_avg": p.sc_avg, "rating": p.rating, "name": p.name}

    data = []
    for r in rows:
        afl = afl_map.get(r.player_id, {})
        data.append({
            "id": r.id, "player_name": r.player_name, "competition": r.competition,
            "season": r.season, "team": r.team, "age": r.age, "matches": r.matches,
            "is_afl_listed": r.is_afl_listed, "player_id": r.player_id,
            "afl_team": afl.get("afl_team"), "position": afl.get("position"),
            "sc_avg": afl.get("sc_avg"), "rating": afl.get("rating"),
            "kicks": r.kicks, "handballs": r.handballs, "disposals": r.disposals,
            "marks": r.marks, "goals": r.goals, "goals_avg": r.goals_avg,
            "behinds": r.behinds, "tackles": r.tackles, "hitouts": r.hitouts,
            "contested_possessions": r.contested_possessions,
            "uncontested_possessions": r.uncontested_possessions,
            "clearances": r.clearances, "inside_fifties": r.inside_fifties,
            "rebounds": r.rebounds, "disposal_efficiency": r.disposal_efficiency,
            "intercepts": r.intercepts, "score_involvements": r.score_involvements,
            "frees_for": r.frees_for, "frees_against": r.frees_against,
            "contested_marks": r.contested_marks, "tackles_inside_50": r.tackles_inside_50,
            "dreamteam_avg": r.dreamteam_avg, "total_possessions": r.total_possessions,
            "kick_percentage": r.kick_percentage,
            "contested_possession_rate": r.contested_possession_rate,
            "score_involvement_pct": r.score_involvement_pct,
        })

    return jsonify({"players": data, "total": total, "page": page, "pages": (total + per_page - 1) // per_page})


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


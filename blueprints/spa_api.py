"""JSON API endpoints for the React SPA."""

import logging
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from models.database import (
    db, League, FantasyTeam, Fixture, SeasonStanding, DraftSession, SeasonConfig,
    AflPlayer, FantasyRoster, Trade, TradeAsset, TradeComment,
    LeagueChatMessage, LeagueChat, Notification, ActivityFeedEntry,
    WeeklyLineup, LineupSlot, RoundScore,
)

logger = logging.getLogger(__name__)

spa_api = Blueprint("spa_api", __name__, url_prefix="/api")


# ── League context (used by LeagueShell) ──────────────────────────────

@spa_api.route("/leagues/<int:league_id>/context")
@login_required
def league_context(league_id):
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    user_team = next((t for t in teams if t.owner_id == current_user.id), None)

    active_draft = DraftSession.query.filter_by(
        league_id=league_id, is_mock=False
    ).filter(DraftSession.status.in_(["scheduled", "in_progress", "paused"])).first() is not None

    return jsonify({
        "id": league.id,
        "name": league.name,
        "season_year": league.season_year,
        "invite_code": league.invite_code or "",
        "commissioner_id": league.commissioner_id,
        "user_team": {"id": user_team.id, "name": user_team.name} if user_team else None,
        "teams": [{"id": t.id, "name": t.name, "owner": t.owner.display_name if t.owner else "?"} for t in teams],
        "is_commissioner": league.commissioner_id == current_user.id,
        "active_draft": active_draft,
        "season_phase": league.status or "setup",
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

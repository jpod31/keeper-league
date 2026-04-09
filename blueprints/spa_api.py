"""JSON API endpoints for the React SPA.

These endpoints provide data that was previously embedded in Jinja2 templates.
Each returns JSON for client-side rendering.
"""

import logging
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from models.database import (
    db, League, FantasyTeam, Fixture, SeasonStanding, DraftSession, SeasonConfig,
    AflPlayer, FantasyRoster, Trade, TradeAsset, TradeComment,
    LeagueChatMessage, Notification, ActivityFeedEntry, WeeklyLineup, LineupSlot,
    RoundScore,
)

logger = logging.getLogger(__name__)

spa_api = Blueprint("spa_api", __name__, url_prefix="/api")


# ── League context (used by LeagueShell) ──────────────────────────────

@spa_api.route("/leagues/<int:league_id>/context")
@login_required
def league_context(league_id):
    """Provides the league shell context: name, teams, user team, nav state."""
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
        "season_phase": league.season_phase if hasattr(league, "season_phase") else "regular",
    })


# ── League list ───────────────────────────────────────────────────────

@spa_api.route("/leagues")
@login_required
def league_list():
    """List all leagues the user belongs to."""
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
    """Dashboard data: standings, recent results, user team summary."""
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "Not found"}), 404

    # Standings
    standings = SeasonStanding.query.filter_by(
        league_id=league_id, year=league.season_year
    ).order_by(SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc()).all()

    standings_data = []
    for s in standings:
        team = db.session.get(FantasyTeam, s.team_id)
        standings_data.append({
            "team_id": s.team_id,
            "name": team.name if team else "?",
            "wins": s.wins,
            "losses": s.losses,
            "draws": s.draws,
            "points": s.ladder_points,
            "pct": s.percentage or 0,
            "for": s.points_for or 0,
        })

    # Recent results (latest completed round)
    from sqlalchemy import func
    latest_completed = db.session.query(func.max(Fixture.afl_round)).filter(
        Fixture.league_id == league_id,
        Fixture.year == league.season_year,
        Fixture.completed == True,
    ).scalar() or 0

    recent = []
    if latest_completed > 0:
        fixtures = Fixture.query.filter_by(
            league_id=league_id, year=league.season_year, afl_round=latest_completed
        ).all()
        for f in fixtures:
            ht = db.session.get(FantasyTeam, f.home_team_id)
            at = db.session.get(FantasyTeam, f.away_team_id)
            recent.append({
                "fixture_id": f.id,
                "home": ht.name if ht else "?",
                "away": at.name if at else "?",
                "home_score": f.home_score or 0,
                "away_score": f.away_score or 0,
            })

    # User team summary
    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    user_summary = None
    if user_team:
        user_standing = SeasonStanding.query.filter_by(
            league_id=league_id, year=league.season_year, team_id=user_team.id
        ).first()
        rank = next((i + 1 for i, s in enumerate(standings_data) if s["team_id"] == user_team.id), 0)
        user_summary = {
            "name": user_team.name,
            "record": f"{user_standing.wins}-{user_standing.losses}" if user_standing else "0-0",
            "rank": rank,
            "next_opponent": "",
        }

    return jsonify({
        "standings": standings_data,
        "current_round": latest_completed,
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

    result = []
    for i, s in enumerate(rows):
        team = db.session.get(FantasyTeam, s.team_id)
        result.append({
            "rank": i + 1,
            "team_id": s.team_id,
            "name": team.name if team else "?",
            "wins": s.wins,
            "losses": s.losses,
            "draws": s.draws,
            "points": s.ladder_points,
            "pct": s.percentage or 0,
            "for": s.points_for or 0,
            "against": s.points_against or 0,
            "streak": "",
        })
    return jsonify(result)


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
        ht = db.session.get(FantasyTeam, f.home_team_id)
        at = db.session.get(FantasyTeam, f.away_team_id)
        rounds[rd]["matches"].append({
            "fixture_id": f.id,
            "home": ht.name if ht else "?",
            "away": at.name if at else "?",
            "home_score": f.home_score or 0,
            "away_score": f.away_score or 0,
            "completed": f.completed or False,
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

    result = []
    for f in fixtures:
        ht = db.session.get(FantasyTeam, f.home_team_id)
        at = db.session.get(FantasyTeam, f.away_team_id)
        result.append({
            "fixture_id": f.id,
            "home_team": {"id": f.home_team_id, "name": ht.name if ht else "?"},
            "away_team": {"id": f.away_team_id, "name": at.name if at else "?"},
            "home_score": f.home_score or 0,
            "away_score": f.away_score or 0,
            "completed": f.completed or False,
        })
    return jsonify(result)


# ── Matchup detail ────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/matchup/<int:fixture_id>")
@login_required
def matchup_detail(league_id, fixture_id):
    f = db.session.get(Fixture, fixture_id)
    if not f or f.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    ht = db.session.get(FantasyTeam, f.home_team_id)
    at = db.session.get(FantasyTeam, f.away_team_id)

    def get_players(team_id):
        """Get player breakdown from round scores."""
        scores = RoundScore.query.filter_by(
            team_id=team_id, afl_round=f.afl_round
        ).all()
        result = []
        for s in scores:
            p = db.session.get(AflPlayer, s.player_id) if hasattr(s, 'player_id') else None
            result.append({
                "name": p.name if p else (s.player_name if hasattr(s, 'player_name') else "?"),
                "position": p.position if p else "",
                "score": s.score or 0,
                "is_captain": getattr(s, 'is_captain', False),
                "is_vc": getattr(s, 'is_vice_captain', False),
                "is_emergency": False,
                "dnp": (s.score or 0) == 0,
            })
        return sorted(result, key=lambda x: -x["score"])

    return jsonify({
        "fixture_id": f.id,
        "round": f.afl_round,
        "home_team": {"id": f.home_team_id, "name": ht.name if ht else "?"},
        "away_team": {"id": f.away_team_id, "name": at.name if at else "?"},
        "home_score": f.home_score or 0,
        "away_score": f.away_score or 0,
        "home_players": get_players(f.home_team_id),
        "away_players": get_players(f.away_team_id),
        "completed": f.completed or False,
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

    results = []
    for f in fixtures:
        ht = db.session.get(FantasyTeam, f.home_team_id)
        at = db.session.get(FantasyTeam, f.away_team_id)
        results.append({
            "fixture_id": f.id,
            "home_team": {"id": f.home_team_id, "name": ht.name if ht else "?"},
            "away_team": {"id": f.away_team_id, "name": at.name if at else "?"},
            "home_score": f.home_score or 0,
            "away_score": f.away_score or 0,
            "home_projected": 0,
            "away_projected": 0,
            "status": "completed" if f.completed else "scheduled",
        })

    return jsonify({
        "round": current_round,
        "fixtures": results,
        "live": False,
    })


# ── Squad ─────────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/team/<int:team_id>/squad")
@login_required
def team_squad(league_id, team_id):
    from models.profile_tags import compute_profile_tags

    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Not found"}), 404

    roster = FantasyRoster.query.filter_by(team_id=team_id).all()
    league = db.session.get(League, league_id)

    # Get profile tags
    try:
        tags = compute_profile_tags(league_id, league.season_year)
    except Exception:
        tags = {}

    players = []
    for rs in roster:
        p = db.session.get(AflPlayer, rs.player_id)
        if not p:
            continue
        tag_info = tags.get(p.name, {})
        players.append({
            "id": p.id,
            "name": p.name,
            "position": p.position or "",
            "afl_team": p.afl_team or "",
            "age": p.age or 0,
            "sc_avg": p.sc_avg or 0,
            "games": p.games_played or 0,
            "is_captain": False,
            "is_vc": False,
            "tag": tag_info.get("tag", ""),
            "tag_css": tag_info.get("css", ""),
            "injury": p.injury_status if hasattr(p, "injury_status") and p.injury_status else None,
        })

    return jsonify({
        "team": {"id": team.id, "name": team.name, "owner": team.owner.display_name if team.owner else "?"},
        "players": sorted(players, key=lambda x: (-x["sc_avg"],)),
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

    roster = FantasyRoster.query.filter_by(team_id=team_id).all()
    player_ids = [rs.player_id for rs in roster]

    players = []
    team_total = 0
    for pid in player_ids:
        p = db.session.get(AflPlayer, pid)
        if not p:
            continue
        # Get round scores
        round_scores = RoundScore.query.filter_by(team_id=team_id, player_id=pid).all() if hasattr(RoundScore, 'player_id') else []
        scores = [rs.score for rs in round_scores if rs.score and rs.score > 0]

        avg = sum(scores) / len(scores) if scores else (p.sc_avg or 0)
        total = sum(scores)
        team_total += total

        players.append({
            "name": p.name,
            "position": p.position or "",
            "games": len(scores),
            "sc_avg": avg,
            "sc_total": total,
            "best": max(scores) if scores else 0,
            "worst": min(scores) if scores else 0,
            "consistency": 0,
        })

    team_avg = sum(p["sc_avg"] for p in players) / len(players) if players else 0

    return jsonify({
        "team": {"id": team.id, "name": team.name},
        "players": players,
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

    # Get weekly lineup for this round
    wl = WeeklyLineup.query.filter_by(team_id=team_id, afl_round=round_num).first()
    slot_map = {}
    if wl:
        for slot in LineupSlot.query.filter_by(lineup_id=wl.id).all():
            slot_map[slot.player_id] = slot

    sc = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    max_round = sc.total_rounds if sc else 24

    players = []
    for rs in roster:
        p = db.session.get(AflPlayer, rs.player_id)
        if not p:
            continue
        slot = slot_map.get(p.id)
        is_playing = slot.is_playing if slot and hasattr(slot, 'is_playing') else True
        players.append({
            "id": p.id,
            "name": p.name,
            "position": p.position or "",
            "afl_team": p.afl_team or "",
            "sc_avg": p.sc_avg or 0,
            "is_captain": getattr(slot, 'is_captain', False) if slot else False,
            "is_vc": getattr(slot, 'is_vice_captain', False) if slot else False,
            "is_emergency": getattr(slot, 'emergency_slot', 0) if slot else 0,
            "playing": is_playing,
            "bench": not is_playing,
            "injury": p.injury_status if hasattr(p, "injury_status") and p.injury_status else None,
        })

    return jsonify({
        "team": {"id": team.id, "name": team.name},
        "round": round_num,
        "max_round": max_round,
        "players": players,
        "locked": False,
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
    roster_spots = FantasyRoster.query.join(FantasyTeam).filter(FantasyTeam.league_id == league_id).all()
    owner_map = {}
    for rs in roster_spots:
        p = db.session.get(AflPlayer, rs.player_id)
        t = db.session.get(FantasyTeam, rs.team_id)
        if p and t:
            owner_map[p.id] = t.name

    query = AflPlayer.query
    if search:
        query = query.filter(AflPlayer.name.ilike(f"%{search}%"))
    if position:
        query = query.filter(AflPlayer.position == position)

    # Sort
    sort_map = {
        "sc_avg": AflPlayer.sc_avg,
        "age": AflPlayer.age,
        "name": AflPlayer.name,
        "games": AflPlayer.games_played,
    }
    col = sort_map.get(sort_col, AflPlayer.sc_avg)
    if sort_dir == "asc":
        query = query.order_by(col.asc())
    else:
        query = query.order_by(col.desc())

    # Filter status
    all_players = query.all()
    if status == "available":
        all_players = [p for p in all_players if p.id not in owner_map]
    elif status == "rostered":
        all_players = [p for p in all_players if p.id in owner_map]

    total = len(all_players)
    paged = all_players[(page - 1) * per_page : page * per_page]

    return jsonify({
        "players": [{
            "id": p.id,
            "name": p.name,
            "position": p.position or "",
            "afl_team": p.afl_team or "",
            "age": p.age or 0,
            "sc_avg": p.sc_avg or 0,
            "games": p.games_played or 0,
            "owner": owner_map.get(p.id),
            "tag": "",
        } for p in paged],
        "total": total,
        "page": page,
        "per_page": per_page,
    })


# ── Trades ────────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/trades")
@login_required
def trade_list(league_id):
    from models.database import Trade, TradePlayer, TradeComment

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        return jsonify({"incoming": [], "outgoing": [], "completed": []})

    all_trades = Trade.query.filter_by(league_id=league_id).order_by(Trade.proposed_at.desc()).all()

    def format_trade(t):
        proposer = db.session.get(FantasyTeam, t.proposer_team_id)
        recipient = db.session.get(FantasyTeam, t.recipient_team_id)
        players = TradeAsset.query.filter_by(trade_id=t.id).all()
        return {
            "id": t.id,
            "proposer": proposer.name if proposer else "?",
            "recipient": recipient.name if recipient else "?",
            "status": t.status,
            "created": t.proposed_at.strftime("%b %d") if t.proposed_at else "",
            "players_out": [tp.player.name if tp.player else "Pick" for tp in players if tp.from_team_id == t.proposer_team_id],
            "players_in": [tp.player.name if tp.player else "Pick" for tp in players if tp.from_team_id == t.recipient_team_id],
        }

    incoming = [format_trade(t) for t in all_trades if t.recipient_team_id == user_team.id and t.status == "pending"]
    outgoing = [format_trade(t) for t in all_trades if t.proposer_team_id == user_team.id and t.status == "pending"]
    completed = [format_trade(t) for t in all_trades if t.status != "pending"][:20]

    return jsonify({"incoming": incoming, "outgoing": outgoing, "completed": completed})


# ── Trades roster (for propose page) ─────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/trades/roster/<int:team_id>")
@login_required
def trade_roster(league_id, team_id):
    from models.database import Player, RosterSpot
    roster = FantasyRoster.query.filter_by(team_id=team_id).all()
    result = []
    for rs in roster:
        p = db.session.get(AflPlayer, rs.player_id)
        if not p:
            continue
        result.append({
            "id": p.id,
            "name": p.name,
            "position": p.position or "",
            "sc_avg": p.sc_avg or 0,
        })
    return jsonify(sorted(result, key=lambda x: -x["sc_avg"]))


# ── Chat ──────────────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/chat")
@login_required
def chat_messages(league_id):
    from models.database import LeagueChatMessage, User
    msgs = LeagueChatMessage.query.filter_by(league_id=league_id).order_by(
        LeagueChatMessage.created_at.asc()
    ).limit(200).all()

    return jsonify([{
        "id": m.id,
        "author": m.author.display_name if m.author else "?",
        "author_id": m.user_id,
        "text": m.message,
        "created": m.created_at.strftime("%H:%M") if m.created_at else "",
    } for m in msgs])


@spa_api.route("/leagues/<int:league_id>/chat/send", methods=["POST"])
@login_required
def chat_send(league_id):
    from models.database import LeagueChatMessage
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "Empty"}), 400

    msg = LeagueChatMessage(
        league_id=league_id,
        user_id=current_user.id,
        message=text[:500],
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({"ok": True})


# ── Notifications ─────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/notifications")
@login_required
def notifications(league_id):
    from models.database import Notification
    notifs = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

    return jsonify([{
        "id": n.id,
        "type": n.type or "",
        "title": n.title or "",
        "body": n.body or "",
        "read": n.is_read or False,
        "created": n.created_at.strftime("%b %d, %H:%M") if n.created_at else "",
        "link": n.link,
    } for n in notifs])


# ── Activity feed ─────────────────────────────────────────────────────

@spa_api.route("/leagues/<int:league_id>/activity")
@login_required
def activity_feed(league_id):
    from models.database import ActivityLog
    activities = ActivityFeedEntry.query.filter_by(league_id=league_id).order_by(
        ActivityFeedEntry.created_at.desc()
    ).limit(50).all()

    return jsonify([{
        "id": a.id,
        "type": a.type or "",
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

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if league.commissioner_id != current_user.id:
            return jsonify({"error": "Not commissioner"}), 403
        if data.get("name"):
            league.name = data["name"]
        sc = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
        if sc:
            if "max_roster_size" in data:
                sc.max_roster_size = data["max_roster_size"]
            if "trade_review_hours" in data:
                sc.trade_review_hours = data["trade_review_hours"]
        db.session.commit()
        return jsonify({"ok": True})

    sc = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    return jsonify({
        "name": league.name,
        "season_year": league.season_year,
        "invite_code": league.invite_code or "",
        "max_roster_size": sc.max_roster_size if sc else 30,
        "trade_review_hours": sc.trade_review_hours if sc else 24,
        "lineup_lock": "",
    })

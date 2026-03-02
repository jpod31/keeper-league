"""Live draft blueprint: setup, room, API endpoints for picks and queues."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, make_response
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, DraftSession, AflPlayer, UserDraftWeights, LeagueDraftWeights, DraftChatMessage
from blueprints import check_league_access
from models.draft_live import (
    create_draft_session, get_draft_state, start_draft, pause_draft, resume_draft,
    get_available_players, get_queue, set_queue, add_to_queue, remove_from_queue,
    randomize_draft_order, get_team_draft_picks, get_position_needs, restart_draft,
    delete_mock_draft, reset_mock_draft, run_mock_auto_picks,
)

draft_bp = Blueprint("draft_live", __name__, url_prefix="/leagues",
                     template_folder="../templates")


def _get_active_draft_session(league_id, include_mock=False):
    """Return the most relevant draft session: active first, then latest.
    Excludes mock sessions by default.
    """
    q = DraftSession.query.filter_by(league_id=league_id)
    if not include_mock:
        q = q.filter(DraftSession.is_mock == False)
    active = q.filter(
        DraftSession.status.in_(["in_progress", "paused", "scheduled"])
    ).order_by(DraftSession.id.desc()).first()
    if active:
        return active
    q2 = DraftSession.query.filter_by(league_id=league_id)
    if not include_mock:
        q2 = q2.filter(DraftSession.is_mock == False)
    return q2.order_by(DraftSession.id.desc()).first()


# ── Cached score lookup to avoid re-ranking 786 players on every request ──
import time as _time
_score_cache = {}  # key: (league_id, weights_tuple) -> {"lookup": dict, "ts": float}
_CACHE_TTL = 30  # seconds

def _get_score_lookup(league_id, weights):
    """Return {(name, team): score} dict, cached for 30s per weight combo."""
    wkey = (league_id, tuple(sorted(weights.items())))
    cached = _score_cache.get(wkey)
    if cached and (_time.monotonic() - cached["ts"]) < _CACHE_TTL:
        return cached["lookup"]

    from models.database import AflPlayer as AflPlayerModel
    from models.player import orm_to_player
    from models.draft_model import rank_players, _apply_custom_sc_projection

    league = db.session.get(League, league_id)
    all_afl = AflPlayerModel.query.all()
    all_dcs = [orm_to_player(p) for p in all_afl]

    if league and league.scoring_type in ("custom", "hybrid"):
        from models.database import CustomScoringRule
        rules = CustomScoringRule.query.filter_by(league_id=league_id).all()
        if rules:
            _apply_custom_sc_projection(all_dcs, all_afl, rules)
    elif league and league.scoring_type == "afl_fantasy":
        from models.draft_model import _apply_af_projection
        _apply_af_projection(all_dcs, all_afl)

    rank_players(all_dcs, weights)
    lookup = {(dc.name, dc.team): dc.draft_score for dc in all_dcs}

    _score_cache[wkey] = {"lookup": lookup, "ts": _time.monotonic()}
    # Evict old entries
    now = _time.monotonic()
    for k in list(_score_cache):
        if now - _score_cache[k]["ts"] > _CACHE_TTL * 4:
            del _score_cache[k]

    return lookup


@draft_bp.route("/<int:league_id>/draft")
@login_required
def draft_room(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    session = _get_active_draft_session(league_id)
    if not session:
        if league.commissioner_id == current_user.id:
            flash("No draft session created yet.", "info")
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))
        else:
            flash("The draft hasn't been set up yet. Ask your commissioner to create a draft session.", "info")
            return redirect(url_for("leagues.season_hub", league_id=league_id))

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    is_commissioner = league.commissioner_id == current_user.id
    state = get_draft_state(session.id)

    # Load user's draft weights for the inline panel
    from config import DRAFT_WEIGHTS
    uw = UserDraftWeights.query.filter_by(user_id=current_user.id, league_id=league_id).first()
    lw = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
    user_weights = uw.to_dict() if uw else (lw.to_dict() if lw else DRAFT_WEIGHTS.copy())
    has_custom_weights = uw is not None

    # Check if draft can be restarted (no fixtures played yet)
    from models.database import Fixture
    can_restart = is_commissioner and not Fixture.query.filter_by(
        league_id=league_id, status="completed"
    ).first()

    resp = make_response(render_template("draft/room.html",
                           league=league,
                           session=session,
                           user_team=user_team,
                           is_commissioner=is_commissioner,
                           state=state,
                           user_weights=user_weights,
                           has_custom_weights=has_custom_weights,
                           can_restart=can_restart))
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return resp


@draft_bp.route("/<int:league_id>/draft/setup", methods=["GET", "POST"])
@login_required
def draft_setup(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    if league.commissioner_id != current_user.id:
        flash("Only the commissioner can set up the draft.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.draft_order).all()

    # Get initial and active supplemental sessions (exclude mocks)
    initial_session = DraftSession.query.filter_by(
        league_id=league_id, draft_round_type="initial", is_mock=False,
    ).first()
    # Get the latest supplemental (active or completed)
    supp_session = DraftSession.query.filter_by(
        league_id=league_id, draft_round_type="supplemental", is_mock=False,
    ).order_by(DraftSession.id.desc()).first()

    # The "active" session is the most relevant one
    session = _get_active_draft_session(league_id)
    initial_completed = initial_session and initial_session.status == "completed"

    if request.method == "POST":
        action = request.form.get("action")

        if action == "randomize":
            randomize_draft_order(league_id)
            flash("Draft order randomized!", "success")
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))

        elif action == "save_order":
            order_str = request.form.get("order", "")
            if order_str:
                team_ids = [int(x) for x in order_str.split(",") if x.strip()]
                for i, tid in enumerate(team_ids):
                    team = db.session.get(FantasyTeam, tid)
                    if team and team.league_id == league_id:
                        team.draft_order = i + 1
                db.session.commit()
                flash("Draft order saved!", "success")
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))

        elif action == "create_session":
            if initial_session:
                flash("Draft session already exists.", "warning")
            else:
                sess, error = create_draft_session(league_id)
                if error:
                    flash(error, "danger")
                else:
                    # Set scheduled start: form value > league default
                    sched = request.form.get("scheduled_start")
                    if not sched and league.draft_scheduled_date:
                        sess.scheduled_start = league.draft_scheduled_date
                        db.session.commit()
                    elif sched and sess:
                        from datetime import datetime
                        try:
                            sess.scheduled_start = datetime.fromisoformat(sched)
                            db.session.commit()
                        except ValueError:
                            pass
                    flash("Draft session created!", "success")
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))

        elif action == "set_schedule":
            if session:
                sched = request.form.get("scheduled_start")
                from datetime import datetime
                if sched:
                    try:
                        session.scheduled_start = datetime.fromisoformat(sched)
                        db.session.commit()
                        flash("Draft time updated!", "success")
                    except ValueError:
                        flash("Invalid date/time format.", "warning")
                else:
                    session.scheduled_start = None
                    db.session.commit()
                    flash("Scheduled time cleared.", "info")
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))

        elif action == "create_supplemental":
            supp_rounds = request.form.get("supp_rounds", type=int) or 5
            sched = request.form.get("supp_scheduled_start")
            sched_dt = None
            if sched:
                from datetime import datetime as _dt
                try:
                    sched_dt = _dt.fromisoformat(sched)
                except ValueError:
                    flash("Invalid date/time format.", "warning")
                    return redirect(url_for("draft_live.draft_setup", league_id=league_id))

                # Validate scheduled time doesn't clash with an active AFL round
                from models.database import AflGame
                clash = AflGame.query.filter(
                    AflGame.status.in_(["scheduled", "live"]),
                    AflGame.scheduled_start.isnot(None),
                    AflGame.scheduled_start <= sched_dt,
                ).order_by(AflGame.scheduled_start.desc()).first()
                if clash and clash.status == "live":
                    flash(
                        f"Cannot schedule during a live AFL game ({clash.home_team} v {clash.away_team}). "
                        "Pick a time between rounds.", "warning"
                    )
                    return redirect(url_for("draft_live.draft_setup", league_id=league_id))

            sess, error = create_draft_session(
                league_id, supplemental=True, total_rounds_override=supp_rounds
            )
            if error:
                flash(error, "danger")
            else:
                if sched_dt and sess:
                    sess.scheduled_start = sched_dt
                    db.session.commit()
                flash("Supplemental draft session created!", "success")
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))

        elif action == "start":
            if not session:
                flash("Create a draft session first.", "warning")
            else:
                _, error = start_draft(session.id)
                if error:
                    flash(error, "danger")
                else:
                    flash("Draft started!", "success")
                    return redirect(url_for("draft_live.draft_room", league_id=league_id))
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))

        elif action == "restart_draft":
            ok, error = restart_draft(league_id)
            if error:
                flash(error, "danger")
            else:
                flash("Draft has been reset. You can now change settings and re-create the draft.", "success")
                return redirect(url_for("leagues.league_settings", league_id=league_id))
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))

        elif action == "create_mock":
            mock_rounds = request.form.get("mock_rounds", type=int) or league.squad_size
            # Delete any existing mock sessions for this league
            old_mocks = DraftSession.query.filter_by(league_id=league_id, is_mock=True).all()
            for m in old_mocks:
                db.session.delete(m)
            db.session.commit()
            sess, error = create_draft_session(
                league_id, is_mock=True, total_rounds_override=mock_rounds
            )
            if error:
                flash(error, "danger")
                return redirect(url_for("draft_live.draft_setup", league_id=league_id))
            _, error = start_draft(sess.id)
            if error:
                flash(error, "danger")
                return redirect(url_for("draft_live.draft_setup", league_id=league_id))
            return redirect(url_for("draft_live.mock_draft_room", league_id=league_id))

    # Get existing mock session for the template
    mock_session = DraftSession.query.filter_by(
        league_id=league_id, is_mock=True
    ).order_by(DraftSession.id.desc()).first()

    from models.database import SeasonConfig, Fixture
    season_config = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()

    can_restart = initial_session is not None and not Fixture.query.filter_by(
        league_id=league_id, status="completed"
    ).first()

    return render_template("draft/setup.html",
                           league=league,
                           teams=teams,
                           session=session,
                           initial_session=initial_session,
                           initial_completed=initial_completed,
                           supp_session=supp_session,
                           mock_session=mock_session,
                           season_config=season_config,
                           can_restart=can_restart)


# ── JSON APIs ────────────────────────────────────────────────────────


@draft_bp.route("/<int:league_id>/draft/api/state")
@login_required
def api_draft_state(league_id):
    session = _get_active_draft_session(league_id)
    if not session:
        return jsonify({"error": "No draft session"}), 404
    return jsonify(get_draft_state(session.id))


@draft_bp.route("/<int:league_id>/draft/api/update_schedule", methods=["POST"])
@login_required
def api_update_schedule(league_id):
    """Commissioner can update the draft scheduled start from the draft room."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        return jsonify({"error": "Not authorised"}), 403
    session = _get_active_draft_session(league_id)
    if not session or session.status != "scheduled":
        return jsonify({"error": "No scheduled draft session"}), 400
    data = request.get_json(silent=True) or {}
    sched = data.get("scheduled_start")
    from datetime import datetime
    if sched:
        try:
            session.scheduled_start = datetime.fromisoformat(sched)
        except ValueError:
            return jsonify({"error": "Invalid date/time"}), 400
    else:
        session.scheduled_start = None
    db.session.commit()
    iso = session.scheduled_start.isoformat() if session.scheduled_start else None
    return jsonify({"status": "ok", "scheduled_start": iso})


@draft_bp.route("/<int:league_id>/draft/api/available")
@login_required
def api_available_players(league_id):
    # Support mock draft: if mock=1, look for the mock session instead
    if request.args.get("mock") == "1":
        session = DraftSession.query.filter_by(
            league_id=league_id, is_mock=True
        ).order_by(DraftSession.id.desc()).first()
    else:
        session = _get_active_draft_session(league_id)
    if not session:
        return jsonify({"error": "No draft session"}), 404

    search = request.args.get("q", "").strip()
    position = request.args.get("pos", "").strip()
    limit = request.args.get("limit", 100, type=int)

    players = get_available_players(session.id, search=search or None,
                                    position=position or None, limit=limit)

    # Compute per-user draft scores.
    # Uses a per-weights cache so we don't re-rank all 786 players on
    # every request — critical with 6 users to avoid blocking eventlet.
    from models.database import UserDraftWeights, LeagueDraftWeights
    from models.draft_model import DRAFT_WEIGHTS

    weight_keys = ["sc_average", "age_factor", "positional_scarcity",
                    "trajectory", "durability", "rating_potential"]
    has_overrides = any(request.args.get(f"w_{k}") for k in weight_keys)
    if has_overrides:
        raw = {k: float(request.args.get(f"w_{k}", 0.2)) for k in weight_keys}
        total = sum(raw.values())
        weights = {k: round(v / total, 4) if total > 0 else 0.2 for k, v in raw.items()}
    else:
        user_weights_row = UserDraftWeights.query.filter_by(
            user_id=current_user.id, league_id=league_id
        ).first()
        if user_weights_row:
            weights = user_weights_row.to_dict()
        else:
            lw = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
            weights = lw.to_dict() if lw else DRAFT_WEIGHTS

    if players:
        score_lookup = _get_score_lookup(league_id, weights)

        result = []
        for p in players:
            sc = p.sc_avg if p.sc_avg else p.sc_avg_prev
            result.append({
                "id": p.id,
                "name": p.name,
                "afl_team": p.afl_team,
                "position": p.position,
                "age": p.age,
                "sc_avg": sc,
                "draft_score": score_lookup.get((p.name, p.afl_team), p.draft_score),
                "rating": p.rating,
                "potential": p.potential,
            })
        result.sort(key=lambda x: x["draft_score"] or 0, reverse=True)
        return jsonify(result[:limit])

    return jsonify([])


@draft_bp.route("/<int:league_id>/draft/api/position_needs")
@login_required
def api_position_needs(league_id):
    """Return position requirements, drafted counts, and blocked positions for the user's team."""
    if request.args.get("mock") == "1":
        session = DraftSession.query.filter_by(
            league_id=league_id, is_mock=True
        ).order_by(DraftSession.id.desc()).first()
    else:
        session = _get_active_draft_session(league_id)
    if not session:
        return jsonify({"error": "No draft session"}), 404

    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    if not user_team:
        return jsonify({"error": "No team"}), 404

    needs = get_position_needs(league_id, session.id, user_team.id)
    return jsonify(needs)


@draft_bp.route("/<int:league_id>/draft/api/queue", methods=["GET", "POST", "DELETE"])
@login_required
def api_queue(league_id):
    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        return jsonify({"error": "You don't have a team in this league"}), 403

    if request.method == "GET":
        queue = get_queue(user_team.id)
        return jsonify([{
            "player_id": q.player_id,
            "player_name": q.player.name if q.player else None,
            "priority": q.priority,
        } for q in queue])

    elif request.method == "POST":
        data = request.get_json()
        if data and "player_ids" in data:
            set_queue(user_team.id, data["player_ids"])
        elif data and "player_id" in data:
            add_to_queue(user_team.id, data["player_id"])
        return jsonify({"status": "ok"})

    elif request.method == "DELETE":
        data = request.get_json()
        if data and "player_id" in data:
            remove_from_queue(user_team.id, data["player_id"])
        return jsonify({"status": "ok"})


@draft_bp.route("/<int:league_id>/draft/api/team_picks/<int:team_id>")
@login_required
def api_team_picks(league_id, team_id):
    league, user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Not a league member"}), 403
    if request.args.get("mock") == "1":
        session = DraftSession.query.filter_by(
            league_id=league_id, is_mock=True
        ).order_by(DraftSession.id.desc()).first()
    else:
        session = _get_active_draft_session(league_id)
    if not session:
        return jsonify({"error": "No draft session"}), 404

    picks = get_team_draft_picks(session.id, team_id)
    return jsonify([{
        "pick_number": p.pick_number,
        "round": p.draft_round,
        "player_name": p.player.name if p.player else None,
        "player_position": p.player.position if p.player else None,
        "player_afl_team": p.player.afl_team if p.player else None,
    } for p in picks])


@draft_bp.route("/<int:league_id>/draft/api/save_weights", methods=["POST"])
@login_required
def api_save_weights(league_id):
    """Save user's draft value weights from the inline draft room panel."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data"}), 400

    weight_keys = ["sc_average", "age_factor", "positional_scarcity", "trajectory", "durability", "rating_potential"]
    weights = {}
    for k in weight_keys:
        weights[k] = float(data.get(k, 0.2))

    # Normalise
    total = sum(weights.values())
    if total > 0:
        for k in weights:
            weights[k] = round(weights[k] / total, 4)

    uw = UserDraftWeights.query.filter_by(user_id=current_user.id, league_id=league_id).first()
    if not uw:
        uw = UserDraftWeights(user_id=current_user.id, league_id=league_id)
        db.session.add(uw)
    for k, v in weights.items():
        setattr(uw, k, v)
    db.session.commit()

    return jsonify({"status": "ok", "weights": weights})


@draft_bp.route("/<int:league_id>/draft/api/chat_history")
@login_required
def api_chat_history(league_id):
    """Return persisted chat messages for the active draft session."""
    session = _get_active_draft_session(league_id)
    if not session:
        return jsonify([])
    messages = DraftChatMessage.query.filter_by(
        draft_session_id=session.id
    ).order_by(DraftChatMessage.id.asc()).limit(200).all()
    return jsonify([{
        "team_name": m.team_name,
        "message": m.message,
        "user_id": m.user_id,
        "is_system": m.is_system,
    } for m in messages])


# ── Mock Draft Routes ──────────────────────────────────────────────


@draft_bp.route("/<int:league_id>/draft/mock")
@login_required
def mock_draft_room(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    session = DraftSession.query.filter_by(
        league_id=league_id, is_mock=True
    ).order_by(DraftSession.id.desc()).first()
    if not session:
        flash("No mock draft session. Start one from the draft setup page.", "info")
        return redirect(url_for("draft_live.draft_setup", league_id=league_id))

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    state = get_draft_state(session.id)

    from config import DRAFT_WEIGHTS
    uw = UserDraftWeights.query.filter_by(user_id=current_user.id, league_id=league_id).first()
    lw = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
    user_weights = uw.to_dict() if uw else (lw.to_dict() if lw else DRAFT_WEIGHTS.copy())
    has_custom_weights = uw is not None

    return render_template("draft/mock_room.html",
                           league=league,
                           session=session,
                           user_team=user_team,
                           is_commissioner=True,
                           state=state,
                           user_weights=user_weights,
                           has_custom_weights=has_custom_weights)


@draft_bp.route("/<int:league_id>/draft/mock/pick", methods=["POST"])
@login_required
def mock_make_pick(league_id):
    """User makes their pick in a mock draft, then computer teams auto-pick."""
    from models.draft_live import make_pick

    session = DraftSession.query.filter_by(
        league_id=league_id, is_mock=True
    ).filter(DraftSession.status == "in_progress").first()
    if not session:
        return jsonify({"error": "No active mock draft"}), 404

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        return jsonify({"error": "You don't have a team"}), 403

    data = request.get_json()
    player_id = data.get("player_id") if data else None
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    # Make the user's pick
    pick, error = make_pick(session.id, player_id)
    if error:
        return jsonify({"error": error}), 400

    user_pick = {
        "pick_number": pick.pick_number,
        "round": pick.draft_round,
        "team_id": pick.team_id,
        "team_name": pick.team.name,
        "player_id": pick.player_id,
        "player_name": pick.player.name,
        "player_position": pick.player.position,
        "player_afl_team": pick.player.afl_team,
        "is_auto_pick": False,
    }

    # Auto-pick for computer teams
    auto_picks = run_mock_auto_picks(session.id, user_team.id)

    # Get updated state
    new_state = get_draft_state(session.id)

    return jsonify({
        "user_pick": user_pick,
        "auto_picks": auto_picks,
        "state": new_state,
    })


@draft_bp.route("/<int:league_id>/draft/mock/auto_start", methods=["POST"])
@login_required
def mock_auto_start(league_id):
    """Auto-pick computer teams at the start of a mock draft until user's turn."""
    session = DraftSession.query.filter_by(
        league_id=league_id, is_mock=True
    ).filter(DraftSession.status == "in_progress").first()
    if not session:
        return jsonify({"error": "No active mock draft"}), 404

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        return jsonify({"error": "You don't have a team"}), 403

    auto_picks = run_mock_auto_picks(session.id, user_team.id)
    state = get_draft_state(session.id)

    return jsonify({"auto_picks": auto_picks, "state": state})


@draft_bp.route("/<int:league_id>/draft/mock/reset", methods=["POST"])
@login_required
def mock_reset(league_id):
    """Reset the mock draft to start over."""
    session = DraftSession.query.filter_by(
        league_id=league_id, is_mock=True
    ).order_by(DraftSession.id.desc()).first()
    if not session:
        return jsonify({"error": "No mock draft to reset"}), 404

    _, error = reset_mock_draft(session.id)
    if error:
        return jsonify({"error": error}), 400

    # Re-start it
    _, error = start_draft(session.id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"status": "ok", "state": get_draft_state(session.id)})


@draft_bp.route("/<int:league_id>/draft/mock/delete", methods=["POST"])
@login_required
def mock_delete(league_id):
    """Delete the mock draft session entirely."""
    session = DraftSession.query.filter_by(
        league_id=league_id, is_mock=True
    ).order_by(DraftSession.id.desc()).first()
    if not session:
        flash("No mock draft to delete.", "warning")
    else:
        delete_mock_draft(session.id)
        flash("Mock draft deleted.", "info")
    return redirect(url_for("draft_live.draft_setup", league_id=league_id))


# ── Draft Recap & Grades ──────────────────────────────────────────


@draft_bp.route("/<int:league_id>/draft/recap")
@draft_bp.route("/<int:league_id>/draft/recap/<int:session_id>")
@login_required
def draft_recap(league_id, session_id=None):
    """Show draft grades and full recap for a completed draft session."""
    from models.database import DraftPick, AflPlayer

    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    # Find the draft session
    if session_id:
        session = db.session.get(DraftSession, session_id)
        if not session or session.league_id != league_id:
            flash("Draft session not found.", "warning")
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))
    else:
        # Latest completed non-mock session
        session = DraftSession.query.filter_by(
            league_id=league_id, status="completed", is_mock=False
        ).order_by(DraftSession.completed_at.desc()).first()
        if not session:
            flash("No completed draft found.", "info")
            return redirect(url_for("draft_live.draft_setup", league_id=league_id))

    # Get all picks for this session, ordered by pick number
    all_picks = (
        DraftPick.query
        .filter_by(draft_session_id=session.id)
        .order_by(DraftPick.pick_number)
        .all()
    )

    if not all_picks:
        flash("No picks found for this draft.", "info")
        return redirect(url_for("draft_live.draft_setup", league_id=league_id))

    # Get all players with draft scores for expected-value calculation
    all_players = AflPlayer.query.filter(AflPlayer.draft_score.isnot(None)).all()
    all_scores_sorted = sorted(
        [p.draft_score for p in all_players if p.draft_score and p.draft_score > 0],
        reverse=True,
    )

    # Number of teams in the league
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    num_teams = len(teams) if teams else league.num_teams
    team_map = {t.id: t.name for t in teams}

    # Track which players have been picked so far (to compute "available at time of pick")
    picked_player_ids = set()
    # Build a set of all draft_scores for available players tracking
    available_scores = list(all_scores_sorted)  # copy

    # Build pick data with expected values
    pick_data = []
    # Per-team accumulators
    team_totals = {}  # team_id -> {"actual": float, "expected": float, "picks": []}

    for pick in all_picks:
        team_name = team_map.get(pick.team_id, "Unknown")

        if pick.team_id not in team_totals:
            team_totals[pick.team_id] = {
                "actual": 0.0,
                "expected": 0.0,
                "picks": [],
                "team_name": team_name,
            }

        if pick.is_pass or not pick.player_id:
            pick_data.append({
                "pick_number": pick.pick_number,
                "draft_round": pick.draft_round,
                "team_name": team_name,
                "player_name": None,
                "position": None,
                "afl_team": None,
                "draft_score": None,
                "expected_value": None,
                "value_diff": None,
                "is_pass": True,
                "is_auto_pick": pick.is_auto_pick,
            })
            continue

        player = pick.player
        actual_score = player.draft_score if player and player.draft_score else 0.0

        # Expected value = average of top N available scores (N = num_teams)
        if available_scores:
            top_n = available_scores[:num_teams]
            expected_value = sum(top_n) / len(top_n) if top_n else 0.0
        else:
            expected_value = 0.0

        value_diff = actual_score - expected_value

        pick_data.append({
            "pick_number": pick.pick_number,
            "draft_round": pick.draft_round,
            "team_name": team_name,
            "player_name": player.name if player else "Unknown",
            "position": player.position if player else None,
            "afl_team": player.afl_team if player else None,
            "draft_score": actual_score,
            "expected_value": expected_value,
            "value_diff": value_diff,
            "is_pass": False,
            "is_auto_pick": pick.is_auto_pick,
        })

        # Update team totals
        team_totals[pick.team_id]["actual"] += actual_score
        team_totals[pick.team_id]["expected"] += expected_value
        team_totals[pick.team_id]["picks"].append({
            "player_name": player.name if player else "Unknown",
            "value_diff": value_diff,
        })

        # Remove this player's score from available pool
        if actual_score in available_scores:
            available_scores.remove(actual_score)
        picked_player_ids.add(pick.player_id)

    # Calculate grades for each team
    def get_grade(ratio):
        """Convert actual/expected ratio to letter grade."""
        if ratio >= 1.15:
            return "A+"
        elif ratio >= 1.05:
            return "A"
        elif ratio >= 0.95:
            return "B"
        elif ratio >= 0.85:
            return "C"
        elif ratio >= 0.75:
            return "D"
        else:
            return "F"

    def get_grade_color(grade):
        """Return a colour hex for each grade."""
        colors = {
            "A+": "#3fb950",
            "A": "#3fb950",
            "B": "#58a6ff",
            "C": "#d29922",
            "D": "#f0883e",
            "F": "#f85149",
        }
        return colors.get(grade, "#8b949e")

    grades = []
    for team_id, data in team_totals.items():
        actual = data["actual"]
        expected = data["expected"]
        ratio = actual / expected if expected > 0 else 1.0
        grade = get_grade(ratio)

        # Find best and worst picks
        best_pick = None
        worst_pick = None
        for p in data["picks"]:
            if best_pick is None or p["value_diff"] > best_pick["value_diff"]:
                best_pick = p
            if worst_pick is None or p["value_diff"] < worst_pick["value_diff"]:
                worst_pick = p

        grades.append({
            "team_id": team_id,
            "team_name": data["team_name"],
            "grade": grade,
            "grade_color": get_grade_color(grade),
            "total_value": actual,
            "expected_value": expected,
            "ratio": ratio,
            "picks_count": len(data["picks"]),
            "best_pick": best_pick,
            "worst_pick": worst_pick,
        })

    # Sort grades by ratio descending (best drafter first)
    grades.sort(key=lambda g: g["ratio"], reverse=True)

    return render_template(
        "draft/recap.html",
        league=league,
        session=session,
        picks=pick_data,
        grades=grades,
    )

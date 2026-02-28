"""Live draft blueprint: setup, room, API endpoints for picks and queues."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, DraftSession, AflPlayer, UserDraftWeights, LeagueDraftWeights
from blueprints import check_league_access
from models.draft_live import (
    create_draft_session, get_draft_state, start_draft, pause_draft, resume_draft,
    get_available_players, get_queue, set_queue, add_to_queue, remove_from_queue,
    randomize_draft_order, get_team_draft_picks,
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


@draft_bp.route("/<int:league_id>/draft")
@login_required
def draft_room(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    session = _get_active_draft_session(league_id)
    if not session:
        flash("No draft session created yet.", "info")
        return redirect(url_for("draft_live.draft_setup", league_id=league_id))

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    is_commissioner = league.commissioner_id == current_user.id
    state = get_draft_state(session.id)

    # Load user's draft weights for the inline panel
    from config import DRAFT_WEIGHTS
    uw = UserDraftWeights.query.filter_by(user_id=current_user.id, league_id=league_id).first()
    lw = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
    user_weights = uw.to_dict() if uw else (lw.to_dict() if lw else DRAFT_WEIGHTS.copy())
    has_custom_weights = uw is not None

    return render_template("draft/room.html",
                           league=league,
                           session=session,
                           user_team=user_team,
                           is_commissioner=is_commissioner,
                           state=state,
                           user_weights=user_weights,
                           has_custom_weights=has_custom_weights)


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

        elif action == "create_session":
            if initial_session:
                flash("Draft session already exists.", "warning")
            else:
                sess, error = create_draft_session(league_id)
                if error:
                    flash(error, "danger")
                else:
                    # Set scheduled start if provided
                    sched = request.form.get("scheduled_start")
                    if sched and sess:
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

    from models.database import SeasonConfig
    season_config = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()

    return render_template("draft/setup.html",
                           league=league,
                           teams=teams,
                           session=session,
                           initial_session=initial_session,
                           initial_completed=initial_completed,
                           supp_session=supp_session,
                           mock_session=mock_session,
                           season_config=season_config)


# ── JSON APIs ────────────────────────────────────────────────────────


@draft_bp.route("/<int:league_id>/draft/api/state")
@login_required
def api_draft_state(league_id):
    session = _get_active_draft_session(league_id)
    if not session:
        return jsonify({"error": "No draft session"}), 404
    return jsonify(get_draft_state(session.id))


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

    # Compute per-user draft scores for the available players
    from models.database import UserDraftWeights, LeagueDraftWeights
    from models.player import orm_to_player
    from models.draft_model import rank_players, _apply_custom_sc_projection, DRAFT_WEIGHTS

    user_weights_row = UserDraftWeights.query.filter_by(
        user_id=current_user.id, league_id=league_id
    ).first()
    if user_weights_row:
        weights = user_weights_row.to_dict()
    else:
        lw = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
        weights = lw.to_dict() if lw else DRAFT_WEIGHTS

    if players:
        league = db.session.get(League, league_id)
        player_dcs = [orm_to_player(p) for p in players]

        # Apply custom/hybrid scoring projection or AFL Fantasy ranking if needed
        if league and league.scoring_type in ("custom", "hybrid"):
            from models.database import CustomScoringRule
            rules = CustomScoringRule.query.filter_by(league_id=league_id).all()
            if rules:
                _apply_custom_sc_projection(player_dcs, players, rules)
        elif league and league.scoring_type == "afl_fantasy":
            from models.draft_model import _apply_af_projection
            _apply_af_projection(player_dcs, players)

        rank_players(player_dcs, weights)

        # Build result sorted by user's personalised score
        name_to_dc = {(dc.name, dc.team): dc for dc in player_dcs}
        result = []
        for p in players:
            dc = name_to_dc.get((p.name, p.afl_team))
            result.append({
                "id": p.id,
                "name": p.name,
                "afl_team": p.afl_team,
                "position": p.position,
                "age": p.age,
                "sc_avg": p.sc_avg,
                "draft_score": dc.draft_score if dc else p.draft_score,
                "rating": p.rating,
                "potential": p.potential,
            })
        result.sort(key=lambda x: x["draft_score"] or 0, reverse=True)
        return jsonify(result[:limit])

    return jsonify([])


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

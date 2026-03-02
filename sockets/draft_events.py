"""SocketIO event handlers for the live draft room."""

import logging
import time

from flask import request
from flask_login import current_user
from flask_socketio import emit, join_room, leave_room

from models.database import db, DraftSession, FantasyTeam, League, DraftChatMessage
from models.draft_live import (
    get_draft_state, make_pick, pass_pick, auto_pick, start_draft,
    pause_draft, resume_draft, end_draft,
)

logger = logging.getLogger(__name__)


def _get_active_session(league_id):
    """Return the most relevant non-mock draft session: active first, then latest."""
    active = DraftSession.query.filter_by(league_id=league_id, is_mock=False).filter(
        DraftSession.status.in_(["in_progress", "paused", "scheduled"])
    ).order_by(DraftSession.id.desc()).first()
    if active:
        return active
    return DraftSession.query.filter_by(league_id=league_id, is_mock=False).order_by(DraftSession.id.desc()).first()


# Timer state per draft session
_timers = {}  # {session_id: {"remaining": int, "running": bool, "generation": int}}


def _cleanup_timer(session_id):
    """Remove timer entry to prevent memory leak after draft completes."""
    _timers.pop(session_id, None)


def register_draft_events(socketio):
    """Register all SocketIO event handlers for the draft."""

    @socketio.on("connect", namespace="/draft")
    def handle_connect():
        if not current_user.is_authenticated:
            return False  # reject connection

    @socketio.on("join_draft", namespace="/draft")
    def handle_join(data):
        try:
            league_id = data.get("league_id")
            if not league_id:
                return

            room = f"draft_{league_id}"
            join_room(room)

            session = _get_active_session(league_id)
            if session:
                state = get_draft_state(session.id)
                emit("draft_state", state)
        except Exception:
            logger.exception("Error in join_draft handler")
            emit("error", {"message": "Failed to join draft room"})

    @socketio.on("leave_draft", namespace="/draft")
    def handle_leave(data):
        league_id = data.get("league_id")
        if league_id:
            leave_room(f"draft_{league_id}")

    @socketio.on("make_pick", namespace="/draft")
    def handle_make_pick(data):
        try:
            league_id = data.get("league_id")
            player_id = data.get("player_id")

            if not league_id or not player_id:
                emit("error", {"message": "Missing league_id or player_id"})
                return

            session = _get_active_session(league_id)
            if not session:
                emit("error", {"message": "No draft session"})
                return

            # Verify it's this user's turn
            state = get_draft_state(session.id)
            if not state or not state.get("current_team_id"):
                emit("error", {"message": "Draft is not active"})
                return

            user_team = FantasyTeam.query.filter_by(
                league_id=league_id, owner_id=current_user.id
            ).first()

            # Allow commissioner to pick for anyone, or player for their own team
            league = db.session.get(League, league_id)
            is_commissioner = league and league.commissioner_id == current_user.id
            is_current_picker = user_team and user_team.id == state["current_team_id"]

            if not is_commissioner and not is_current_picker:
                emit("error", {"message": "It's not your turn to pick"})
                return

            pick, error = make_pick(session.id, player_id)
            if error:
                emit("error", {"message": error})
                return

            # Reset timer
            _reset_timer(session.id)

            # Broadcast updated state to all in the room
            new_state = get_draft_state(session.id)
            room = f"draft_{league_id}"
            pick_data = {
                "pick_number": pick.pick_number,
                "round": pick.draft_round,
                "team_id": pick.team_id,
                "team_name": pick.team.name if pick.team else "Unknown",
                "player_id": pick.player_id,
                "player_name": pick.player.name if pick.player else "Unknown",
                "player_position": pick.player.position if pick.player else "",
                "player_afl_team": pick.player.afl_team if pick.player else "",
                "is_auto_pick": pick.is_auto_pick,
            }
            emit("pick_made", pick_data, room=room)

            # Save pick as system chat message
            sys_text = "%s drafted %s" % (pick_data["team_name"], pick_data["player_name"])
            db.session.add(DraftChatMessage(
                draft_session_id=session.id, user_id=0,
                team_name=None, message=sys_text, is_system=True,
            ))
            db.session.commit()

            if new_state["status"] == "completed":
                _cleanup_timer(session.id)
                emit("draft_completed", new_state, room=room)
            else:
                emit("draft_state", new_state, room=room)
                # Start timer for next pick
                _start_timer(socketio, session.id, league_id)
        except Exception:
            logger.exception("Error in make_pick handler")
            db.session.rollback()
            emit("error", {"message": "An error occurred making the pick"})

    @socketio.on("pass_pick", namespace="/draft")
    def handle_pass_pick(data):
        try:
            league_id = data.get("league_id")
            if not league_id:
                emit("error", {"message": "Missing league_id"})
                return

            session = _get_active_session(league_id)
            if not session:
                emit("error", {"message": "No draft session"})
                return

            # Only allowed for supplemental drafts
            if session.draft_round_type != "supplemental":
                emit("error", {"message": "Passing is only allowed in supplemental drafts"})
                return

            # Verify it's this user's turn
            state = get_draft_state(session.id)
            if not state or not state.get("current_team_id"):
                emit("error", {"message": "Draft is not active"})
                return

            user_team = FantasyTeam.query.filter_by(
                league_id=league_id, owner_id=current_user.id
            ).first()

            league = db.session.get(League, league_id)
            is_commissioner = league and league.commissioner_id == current_user.id
            is_current_picker = user_team and user_team.id == state["current_team_id"]

            if not is_commissioner and not is_current_picker:
                emit("error", {"message": "It's not your turn to pick"})
                return

            pick, error = pass_pick(session.id)
            if error:
                emit("error", {"message": error})
                return

            # Reset timer
            _reset_timer(session.id)

            # Broadcast updated state to all in the room
            new_state = get_draft_state(session.id)
            room = f"draft_{league_id}"
            pick_data = {
                "pick_number": pick.pick_number,
                "round": pick.draft_round,
                "team_id": pick.team_id,
                "team_name": pick.team.name if pick.team else "Unknown",
                "player_id": None,
                "player_name": None,
                "player_position": None,
                "player_afl_team": None,
                "is_auto_pick": False,
                "is_pass": True,
            }
            emit("pick_made", pick_data, room=room)

            db.session.add(DraftChatMessage(
                draft_session_id=session.id, user_id=0,
                team_name=None, message="%s passed" % pick_data["team_name"],
                is_system=True,
            ))
            db.session.commit()

            if new_state["status"] == "completed":
                _cleanup_timer(session.id)
                emit("draft_completed", new_state, room=room)
            else:
                emit("draft_state", new_state, room=room)
                _start_timer(socketio, session.id, league_id)
        except Exception:
            logger.exception("Error in pass_pick handler")
            db.session.rollback()
            emit("error", {"message": "An error occurred passing the pick"})

    @socketio.on("start_draft", namespace="/draft")
    def handle_start_draft(data):
        try:
            league_id = data.get("league_id")
            if not league_id:
                return

            league = db.session.get(League, league_id)
            if not league or league.commissioner_id != current_user.id:
                emit("error", {"message": "Only the commissioner can start the draft"})
                return

            session = _get_active_session(league_id)
            if not session:
                emit("error", {"message": "No draft session"})
                return

            _, error = start_draft(session.id)
            if error:
                emit("error", {"message": error})
                return

            state = get_draft_state(session.id)
            room = f"draft_{league_id}"
            emit("draft_state", state, room=room)
            _start_timer(socketio, session.id, league_id)
        except Exception:
            logger.exception("Error in start_draft handler")
            db.session.rollback()
            emit("error", {"message": "An error occurred starting the draft"})

    @socketio.on("pause_draft", namespace="/draft")
    def handle_pause(data):
        try:
            league_id = data.get("league_id")
            if not league_id:
                return

            league = db.session.get(League, league_id)
            if not league or league.commissioner_id != current_user.id:
                emit("error", {"message": "Only the commissioner can pause the draft"})
                return

            session = _get_active_session(league_id)
            if session:
                _, error = pause_draft(session.id)
                if not error:
                    _stop_timer(session.id)
                    state = get_draft_state(session.id)
                    emit("draft_state", state, room=f"draft_{league_id}")
        except Exception:
            logger.exception("Error in pause_draft handler")
            db.session.rollback()
            emit("error", {"message": "An error occurred pausing the draft"})

    @socketio.on("resume_draft", namespace="/draft")
    def handle_resume(data):
        try:
            league_id = data.get("league_id")
            if not league_id:
                return

            league = db.session.get(League, league_id)
            if not league or league.commissioner_id != current_user.id:
                emit("error", {"message": "Only the commissioner can resume the draft"})
                return

            session = _get_active_session(league_id)
            if session:
                _, error = resume_draft(session.id)
                if not error:
                    state = get_draft_state(session.id)
                    emit("draft_state", state, room=f"draft_{league_id}")
                    _start_timer(socketio, session.id, league_id)
        except Exception:
            logger.exception("Error in resume_draft handler")
            db.session.rollback()
            emit("error", {"message": "An error occurred resuming the draft"})

    @socketio.on("draft_chat", namespace="/draft")
    def handle_draft_chat(data):
        """Broadcast a chat message to all users in the draft room."""
        try:
            league_id = data.get("league_id")
            msg = (data.get("message") or "").strip()
            if not league_id or not msg or len(msg) > 500:
                return

            session = _get_active_session(league_id)
            user_team = FantasyTeam.query.filter_by(
                league_id=league_id, owner_id=current_user.id
            ).first()
            team_name = user_team.name if user_team else current_user.display_name

            # Persist to DB
            if session:
                chat_msg = DraftChatMessage(
                    draft_session_id=session.id,
                    user_id=current_user.id,
                    team_name=team_name,
                    message=msg,
                )
                db.session.add(chat_msg)
                db.session.commit()

            emit("draft_chat_msg", {
                "team_name": team_name,
                "message": msg,
                "user_id": current_user.id,
            }, room=f"draft_{league_id}")
        except Exception:
            logger.exception("Error in draft_chat handler")

    @socketio.on("update_schedule", namespace="/draft")
    def handle_update_schedule(data):
        """Commissioner updates the draft scheduled start — broadcast to room."""
        try:
            league_id = data.get("league_id")
            scheduled_start = data.get("scheduled_start")  # ISO string or null
            if not league_id:
                return

            league = db.session.get(League, league_id)
            if not league or league.commissioner_id != current_user.id:
                emit("error", {"message": "Only the commissioner can change the draft time"})
                return

            session = _get_active_session(league_id)
            if not session or session.status != "scheduled":
                emit("error", {"message": "Draft is not in scheduled state"})
                return

            from datetime import datetime
            if scheduled_start:
                try:
                    session.scheduled_start = datetime.fromisoformat(scheduled_start)
                except ValueError:
                    emit("error", {"message": "Invalid date/time"})
                    return
            else:
                session.scheduled_start = None
            db.session.commit()

            iso = session.scheduled_start.isoformat() if session.scheduled_start else None
            emit("schedule_updated", {"scheduled_start": iso}, room=f"draft_{league_id}")
        except Exception:
            logger.exception("Error in update_schedule handler")
            db.session.rollback()
            emit("error", {"message": "An error occurred updating the schedule"})

    @socketio.on("end_draft", namespace="/draft")
    def handle_end_draft(data):
        try:
            league_id = data.get("league_id")
            if not league_id:
                return

            league = db.session.get(League, league_id)
            if not league or league.commissioner_id != current_user.id:
                emit("error", {"message": "Only the commissioner can end the draft"})
                return

            session = _get_active_session(league_id)
            if not session:
                emit("error", {"message": "No draft session"})
                return

            _, error = end_draft(session.id)
            if error:
                emit("error", {"message": error})
                return

            _cleanup_timer(session.id)
            state = get_draft_state(session.id)
            room = f"draft_{league_id}"
            emit("draft_completed", state, room=room)
        except Exception:
            logger.exception("Error in end_draft handler")
            db.session.rollback()
            emit("error", {"message": "An error occurred ending the draft"})


def _start_timer(socketio, session_id, league_id):
    """Start the countdown timer for the current pick.

    Uses monotonic clock to avoid drift from green-thread scheduling delays.
    """
    from flask import current_app
    app = current_app._get_current_object()

    session = db.session.get(DraftSession, session_id)
    if not session:
        return

    prev_gen = _timers.get(session_id, {}).get("generation", 0)
    gen = prev_gen + 1
    duration = session.pick_timer_secs
    _timers[session_id] = {
        "remaining": duration,
        "deadline": time.monotonic() + duration,
        "running": True,
        "generation": gen,
    }

    def tick():
        my_gen = gen
        room = f"draft_{league_id}"
        try:
            while _timers.get(session_id, {}).get("running", False):
                # Stale generation check — exit if a newer timer started
                if _timers.get(session_id, {}).get("generation") != my_gen:
                    return

                # Calculate remaining from monotonic deadline (drift-proof)
                deadline = _timers[session_id]["deadline"]
                remaining = max(0, int(deadline - time.monotonic()))
                _timers[session_id]["remaining"] = remaining
                socketio.emit("timer_tick", {"remaining": remaining}, namespace="/draft", room=room)

                if remaining <= 0:
                    # Auto-pick on timeout
                    _timers[session_id]["running"] = False
                    with app.app_context():
                        sess = db.session.get(DraftSession, session_id)
                        if sess and sess.status == "in_progress":
                            state = get_draft_state(session_id)
                            if state and state.get("current_team_id"):
                                pick, error = auto_pick(session_id, state["current_team_id"])
                                if pick and not error:
                                    pick_data = {
                                        "pick_number": pick.pick_number,
                                        "round": pick.draft_round,
                                        "team_id": pick.team_id,
                                        "team_name": pick.team.name if pick.team else "Unknown",
                                        "player_id": pick.player_id,
                                        "player_name": pick.player.name if pick.player else "Unknown",
                                        "player_position": pick.player.position if pick.player else "",
                                        "player_afl_team": pick.player.afl_team if pick.player else "",
                                        "is_auto_pick": True,
                                    }
                                    socketio.emit("pick_made", pick_data, namespace="/draft", room=room)

                                    new_state = get_draft_state(session_id)
                                    if new_state["status"] == "completed":
                                        _cleanup_timer(session_id)
                                        socketio.emit("draft_completed", new_state,
                                                      namespace="/draft", room=room)
                                    else:
                                        socketio.emit("draft_state", new_state,
                                                      namespace="/draft", room=room)
                                        _start_timer(socketio, session_id, league_id)
                    return

                socketio.sleep(1)
        except Exception:
            logger.exception(f"Error in draft timer for session {session_id}")
            _timers.pop(session_id, None)

    socketio.start_background_task(tick)


def _stop_timer(session_id):
    """Stop the timer for a session."""
    if session_id in _timers:
        _timers[session_id]["running"] = False
        _timers[session_id]["generation"] = _timers[session_id].get("generation", 0) + 1


def _reset_timer(session_id):
    """Reset/stop the timer (new pick will start a fresh one)."""
    _stop_timer(session_id)


def get_timer_remaining(session_id):
    """Get the current timer remaining seconds for a session (for external use)."""
    timer = _timers.get(session_id)
    if timer and timer.get("running"):
        return timer.get("remaining")
    return None

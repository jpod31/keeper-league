"""Communications blueprint: notifications and team messaging."""

from datetime import datetime, timezone

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import (
    db, League, FantasyTeam, Conversation, Message, Notification,
)
from models.notification_manager import (
    get_unread_count, get_recent_notifications, mark_read, mark_all_read,
    get_or_create_conversation, create_notification, get_unread_message_count,
)
from blueprints import check_league_access

comms_bp = Blueprint("comms", __name__, url_prefix="/leagues",
                     template_folder="../templates")


# ── Notifications ─────────────────────────────────────────────────────


@comms_bp.route("/<int:league_id>/notifications")
@login_required
def notifications(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))
    notifs = get_recent_notifications(current_user.id, limit=50, league_id=league_id)
    return render_template("comms/notifications.html",
                           league=league, user_team=user_team, notifs=notifs)


@comms_bp.route("/<int:league_id>/notifications/api")
@login_required
def notifications_api(league_id):
    """JSON endpoint for dropdown AJAX."""
    notifs = get_recent_notifications(current_user.id, limit=15, league_id=league_id)
    return jsonify([{
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    } for n in notifs])


@comms_bp.route("/<int:league_id>/notifications/read/<int:notif_id>", methods=["POST"])
@login_required
def notification_mark_read(league_id, notif_id):
    mark_read(notif_id, current_user.id)
    return jsonify({"ok": True})


@comms_bp.route("/<int:league_id>/notifications/read-all", methods=["POST"])
@login_required
def notification_mark_all_read(league_id):
    mark_all_read(current_user.id, league_id=league_id)
    return jsonify({"ok": True})


# ── Global unread count (not league-scoped) ───────────────────────────


@comms_bp.route("/api/notifications/unread-count")
@login_required
def unread_count_api():
    count = get_unread_count(current_user.id)
    return jsonify({"count": count})


# ── Messages ──────────────────────────────────────────────────────────


@comms_bp.route("/<int:league_id>/messages")
@login_required
def inbox(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))
    if not user_team:
        flash("You need a team to use messaging.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    # Get all conversations involving this team
    convos = Conversation.query.filter(
        Conversation.league_id == league_id,
        db.or_(
            Conversation.team_a_id == user_team.id,
            Conversation.team_b_id == user_team.id,
        )
    ).order_by(Conversation.last_message_at.desc()).all()

    # Annotate each conversation with unread count and other team
    convo_data = []
    for c in convos:
        other_team = c.team_b if c.team_a_id == user_team.id else c.team_a
        unread = Message.query.filter_by(
            conversation_id=c.id, is_read=False
        ).filter(Message.sender_user_id != current_user.id).count()
        last_msg = Message.query.filter_by(conversation_id=c.id).order_by(
            Message.created_at.desc()
        ).first()
        convo_data.append({
            "convo": c,
            "other_team": other_team,
            "unread": unread,
            "last_msg": last_msg,
        })

    # Teams available to start a new conversation
    all_teams = FantasyTeam.query.filter(
        FantasyTeam.league_id == league_id,
        FantasyTeam.id != user_team.id,
    ).all()

    return render_template("comms/inbox.html",
                           league=league, user_team=user_team,
                           convo_data=convo_data, all_teams=all_teams)


@comms_bp.route("/<int:league_id>/messages/<int:convo_id>")
@login_required
def conversation(league_id, convo_id):
    league, user_team = check_league_access(league_id)
    if not league or not user_team:
        flash("Access denied.", "warning")
        return redirect(url_for("leagues.league_list"))

    convo = db.session.get(Conversation, convo_id)
    if not convo or convo.league_id != league_id:
        flash("Conversation not found.", "warning")
        return redirect(url_for("comms.inbox", league_id=league_id))

    if user_team.id not in (convo.team_a_id, convo.team_b_id):
        flash("You're not part of this conversation.", "warning")
        return redirect(url_for("comms.inbox", league_id=league_id))

    other_team = convo.team_b if convo.team_a_id == user_team.id else convo.team_a

    # Mark messages as read
    Message.query.filter_by(conversation_id=convo_id, is_read=False).filter(
        Message.sender_user_id != current_user.id
    ).update({"is_read": True})
    db.session.commit()

    messages = Message.query.filter_by(conversation_id=convo_id).order_by(
        Message.created_at.asc()
    ).all()

    return render_template("comms/conversation.html",
                           league=league, user_team=user_team,
                           convo=convo, other_team=other_team, messages=messages)


@comms_bp.route("/<int:league_id>/messages/send", methods=["POST"])
@login_required
def send_message(league_id):
    league, user_team = check_league_access(league_id)
    if not league or not user_team:
        return jsonify({"error": "Access denied"}), 403

    convo_id = request.form.get("conversation_id", type=int)
    recipient_team_id = request.form.get("recipient_team_id", type=int)
    body = request.form.get("body", "").strip()

    if not body:
        flash("Message cannot be empty.", "warning")
        if convo_id:
            return redirect(url_for("comms.conversation", league_id=league_id, convo_id=convo_id))
        return redirect(url_for("comms.inbox", league_id=league_id))

    # Get or create conversation
    if convo_id:
        convo = db.session.get(Conversation, convo_id)
        if not convo or user_team.id not in (convo.team_a_id, convo.team_b_id):
            flash("Invalid conversation.", "warning")
            return redirect(url_for("comms.inbox", league_id=league_id))
    elif recipient_team_id:
        convo = get_or_create_conversation(league_id, user_team.id, recipient_team_id)
    else:
        flash("No recipient specified.", "warning")
        return redirect(url_for("comms.inbox", league_id=league_id))

    msg = Message(
        conversation_id=convo.id,
        sender_user_id=current_user.id,
        body=body,
    )
    db.session.add(msg)
    convo.last_message_at = datetime.now(timezone.utc)
    db.session.commit()

    # Notify the other team's owner
    other_team_id = convo.team_b_id if convo.team_a_id == user_team.id else convo.team_a_id
    other_team = db.session.get(FantasyTeam, other_team_id)
    if other_team:
        create_notification(
            user_id=other_team.owner_id,
            league_id=league_id,
            notif_type="message_received",
            title=f"New message from {user_team.name}",
            body=body[:100],
            link=url_for("comms.conversation", league_id=league_id, convo_id=convo.id),
            conversation_id=convo.id,
        )

    # Emit real-time message via SocketIO
    from models.notification_manager import _socketio
    if _socketio:
        _socketio.emit("new_message", {
            "conversation_id": convo.id,
            "sender_user_id": current_user.id,
            "sender_name": current_user.display_name or current_user.username,
            "team_name": user_team.name,
            "body": body,
            "created_at": msg.created_at.isoformat(),
        }, namespace="/notifications", room=f"convo_{convo.id}")

    return redirect(url_for("comms.conversation", league_id=league_id, convo_id=convo.id))

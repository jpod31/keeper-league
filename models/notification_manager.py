"""Notification and messaging helpers."""

from datetime import datetime, timezone

from models.database import db, Notification, Conversation, Message


# ── Notification socketio emitter (set by app.py after socketio init) ──
_socketio = None


def init_notification_socketio(sio):
    """Store reference to SocketIO instance for real-time pushes."""
    global _socketio
    _socketio = sio


def notify_user(user_id, data):
    """Push a real-time notification event to a specific user's room."""
    if _socketio:
        _socketio.emit(
            "new_notification",
            data,
            namespace="/notifications",
            room=f"user_{user_id}",
        )


def create_notification(user_id, league_id, notif_type, title,
                        body=None, link=None, trade_id=None, conversation_id=None):
    """Write a notification row and push it via WebSocket."""
    notif = Notification(
        user_id=user_id,
        league_id=league_id,
        type=notif_type,
        title=title,
        body=body,
        link=link,
        trade_id=trade_id,
        conversation_id=conversation_id,
    )
    db.session.add(notif)
    db.session.commit()

    notify_user(user_id, {
        "id": notif.id,
        "type": notif_type,
        "title": title,
        "body": body,
        "link": link,
        "created_at": notif.created_at.isoformat(),
    })
    return notif


def get_unread_count(user_id, league_id=None):
    """Return count of unread notifications for a user."""
    q = Notification.query.filter_by(user_id=user_id, is_read=False)
    if league_id:
        q = q.filter_by(league_id=league_id)
    return q.count()


def get_recent_notifications(user_id, limit=20, league_id=None):
    """Return recent notifications for dropdown display."""
    q = Notification.query.filter_by(user_id=user_id)
    if league_id:
        q = q.filter_by(league_id=league_id)
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


def mark_read(notification_id, user_id):
    """Mark a single notification as read."""
    notif = db.session.get(Notification, notification_id)
    if notif and notif.user_id == user_id:
        notif.is_read = True
        db.session.commit()
    return notif


def mark_all_read(user_id, league_id=None):
    """Mark all notifications as read for a user."""
    q = Notification.query.filter_by(user_id=user_id, is_read=False)
    if league_id:
        q = q.filter_by(league_id=league_id)
    q.update({"is_read": True})
    db.session.commit()


def get_or_create_conversation(league_id, team_a_id, team_b_id):
    """Get or create a conversation between two teams (canonical order)."""
    lo, hi = min(team_a_id, team_b_id), max(team_a_id, team_b_id)
    convo = Conversation.query.filter_by(
        league_id=league_id, team_a_id=lo, team_b_id=hi
    ).first()
    if not convo:
        convo = Conversation(league_id=league_id, team_a_id=lo, team_b_id=hi)
        db.session.add(convo)
        db.session.commit()
    return convo


def get_unread_message_count(user_id, league_id=None):
    """Count unread messages across all conversations for a user."""
    from models.database import FantasyTeam
    teams = FantasyTeam.query.filter_by(owner_id=user_id).all()
    if not teams:
        return 0
    team_ids = [t.id for t in teams]

    q = db.session.query(db.func.count(Message.id)).join(
        Conversation, Message.conversation_id == Conversation.id
    ).filter(
        Message.is_read == False,
        Message.sender_user_id != user_id,
        db.or_(
            Conversation.team_a_id.in_(team_ids),
            Conversation.team_b_id.in_(team_ids),
        ),
    )
    if league_id:
        q = q.filter(Conversation.league_id == league_id)
    return q.scalar() or 0

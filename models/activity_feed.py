"""Activity feed: log and retrieve league-wide activity entries."""

from models.database import db, ActivityFeedEntry

# SocketIO ref, set by app.py
_socketio = None


def init_activity_socketio(sio):
    global _socketio
    _socketio = sio


def log_activity(league_id, activity_type, title, body=None, link=None, actor_user_id=None):
    """Insert an activity entry and broadcast via SocketIO."""
    entry = ActivityFeedEntry(
        league_id=league_id,
        type=activity_type,
        title=title,
        body=body,
        link=link,
        actor_user_id=actor_user_id,
    )
    db.session.add(entry)
    db.session.commit()

    if _socketio:
        _socketio.emit("new_activity", {
            "id": entry.id,
            "type": activity_type,
            "title": title,
            "body": body,
            "link": link,
            "created_at": entry.created_at.isoformat(),
            "actor": entry.actor.display_name if entry.actor else None,
        }, namespace="/notifications", room=f"league_chat_{league_id}")

    return entry


def get_recent_activity(league_id, limit=30):
    """Return recent activity feed entries for a league."""
    return (
        ActivityFeedEntry.query
        .filter_by(league_id=league_id)
        .order_by(ActivityFeedEntry.created_at.desc())
        .limit(limit)
        .all()
    )

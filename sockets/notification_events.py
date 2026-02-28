"""SocketIO event handlers for notifications and messaging."""

import logging

from flask_login import current_user
from flask_socketio import emit, join_room, leave_room

logger = logging.getLogger(__name__)


def register_notification_events(socketio):
    """Register SocketIO handlers for the /notifications namespace."""

    @socketio.on("connect", namespace="/notifications")
    def handle_connect():
        if not current_user.is_authenticated:
            return False
        # Auto-join user's personal notification room
        join_room(f"user_{current_user.id}")

    @socketio.on("join_conversation", namespace="/notifications")
    def handle_join_convo(data):
        convo_id = data.get("conversation_id")
        if convo_id:
            join_room(f"convo_{convo_id}")

    @socketio.on("leave_conversation", namespace="/notifications")
    def handle_leave_convo(data):
        convo_id = data.get("conversation_id")
        if convo_id:
            leave_room(f"convo_{convo_id}")

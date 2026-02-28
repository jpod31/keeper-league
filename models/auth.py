"""User authentication: registration, login, Flask-Login callbacks."""

from flask_login import LoginManager
from werkzeug.security import generate_password_hash, check_password_hash

from models.database import db, User

login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message_category = "info"


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def register_user(username, email, password, display_name=None):
    """Create a new user account. Returns (user, None) on success or (None, error_msg) on failure."""
    if User.query.filter_by(username=username).first():
        return None, "Username already taken."
    if User.query.filter_by(email=email).first():
        return None, "Email already registered."

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        display_name=display_name or username,
    )
    db.session.add(user)
    db.session.commit()
    return user, None


def authenticate_user(login, password):
    """Verify credentials (username or email).

    Returns (user, None) on success, or (None, error_field) on failure.
    error_field is 'login' if user not found, 'password' if password wrong.
    """
    user = User.query.filter_by(username=login).first()
    if user is None:
        user = User.query.filter_by(email=login).first()
    if user is None:
        return None, "login"
    if not check_password_hash(user.password_hash, password):
        return None, "password"
    return user, None

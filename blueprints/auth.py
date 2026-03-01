"""Authentication blueprint: register, login, logout, profile."""

from urllib.parse import urlparse

from datetime import datetime, timezone

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user

from models.auth import register_user, authenticate_user


def _safe_redirect(target, fallback):
    """Only redirect to relative URLs on the same host (prevent open redirect)."""
    if not target:
        return redirect(fallback)
    parsed = urlparse(target)
    if parsed.scheme or parsed.netloc:
        return redirect(fallback)
    return redirect(target)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth",
                    template_folder="../templates")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("leagues.league_list"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        display_name = request.form.get("display_name", "").strip()
        form_vals = {"username": username, "email": email, "display_name": display_name}

        if not username or not email or not password:
            flash("All fields are required.", "warning")
            return render_template("auth/register.html", form=form_vals)

        if len(password) < 6:
            flash("Password must be at least 6 characters.", "warning")
            return render_template("auth/register.html", form=form_vals)

        if password != confirm:
            flash("Passwords do not match.", "warning")
            return render_template("auth/register.html", form=form_vals)

        user, error = register_user(username, email, password, display_name or None)
        if error:
            flash(error, "danger")
            return render_template("auth/register.html", form=form_vals)

        login_user(user)
        flash(f"Welcome, {user.display_name}!", "success")
        next_page = request.args.get("next")
        return _safe_redirect(next_page, url_for("leagues.league_list"))

    return render_template("auth/register.html", form={})


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("leagues.league_list"))

    if request.method == "POST":
        login_val = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        user, error_field = authenticate_user(login_val, password)
        if user:
            login_user(user, remember=request.form.get("remember") == "on")
            user.last_login = datetime.now(timezone.utc)
            from models.database import db
            db.session.commit()
            flash(f"Welcome back, {user.display_name}!", "success")
            next_page = request.args.get("next")
            return _safe_redirect(next_page, url_for("leagues.league_list"))

        errors = {}
        if error_field == "login":
            errors["login"] = "No account found with that username or email."
        else:
            errors["password"] = "Incorrect password."
        return render_template("auth/login.html",
                               form={"username": login_val}, errors=errors)

    return render_template("auth/login.html", form={}, errors={})


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for("index"))


@auth_bp.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    from models.database import db

    if request.method == "POST":
        display_name = request.form.get("display_name", "").strip()
        email = request.form.get("email", "").strip()

        if display_name:
            current_user.display_name = display_name
        if email:
            current_user.email = email
        db.session.commit()
        flash("Profile updated.", "success")
        return redirect(url_for("auth.profile"))

    # Build notification preferences map for the template
    from models.database import NotificationPreference
    prefs = NotificationPreference.query.filter_by(user_id=current_user.id).all()
    notif_prefs = {}
    for p in prefs:
        notif_prefs[p.notif_type] = {
            "in_app": p.channel_in_app,
            "push": p.channel_push,
            "email": p.channel_email,
        }

    return render_template("auth/profile.html", notif_prefs=notif_prefs)


@auth_bp.route("/notification-prefs", methods=["POST"])
@login_required
def notification_prefs():
    from models.database import db, NotificationPreference
    data = request.get_json(silent=True) or {}

    # Handle digest toggle
    if "digest_enabled" in data:
        current_user.email_digest_enabled = bool(data["digest_enabled"])
        db.session.commit()
        return jsonify({"ok": True})

    # Handle per-type channel toggle
    notif_type = data.get("notif_type")
    channel = data.get("channel")
    enabled = data.get("enabled", False)

    if not notif_type or channel not in ("in_app", "push", "email"):
        return jsonify({"error": "Invalid params"}), 400

    pref = NotificationPreference.query.filter_by(
        user_id=current_user.id, notif_type=notif_type
    ).first()
    if not pref:
        pref = NotificationPreference(
            user_id=current_user.id,
            notif_type=notif_type,
        )
        db.session.add(pref)

    if channel == "in_app":
        pref.channel_in_app = enabled
    elif channel == "push":
        pref.channel_push = enabled
    elif channel == "email":
        pref.channel_email = enabled

    db.session.commit()
    return jsonify({"ok": True})


@auth_bp.route("/theme", methods=["POST"])
@login_required
def set_theme():
    from models.database import db
    data = request.get_json(silent=True) or {}
    theme = data.get("theme", "dark")
    if theme not in ("dark", "light"):
        theme = "dark"
    current_user.theme_preference = theme
    db.session.commit()
    return jsonify({"ok": True})


@auth_bp.route("/onboarding/complete", methods=["POST"])
@login_required
def onboarding_complete():
    from models.database import db
    current_user.has_completed_onboarding = True
    db.session.commit()
    return jsonify({"ok": True})

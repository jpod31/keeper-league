"""Authentication blueprint: register, login, logout, profile."""

from urllib.parse import urlparse

from flask import Blueprint, render_template, request, redirect, url_for, flash
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

    return render_template("auth/profile.html")

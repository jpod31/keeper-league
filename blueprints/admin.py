"""Admin hub blueprint: dashboard, user management, league overview, analytics."""

from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import func

from models.database import db, User, League, FantasyTeam, PageView

admin_bp = Blueprint("admin", __name__, url_prefix="/admin",
                     template_folder="../templates")


def admin_required(f):
    """Decorator that enforces login + is_admin."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not getattr(current_user, "is_admin", False):
            flash("Admin access required.", "warning")
            return redirect(url_for("leagues.league_list"))
        return f(*args, **kwargs)
    return decorated


@admin_bp.route("/")
@admin_required
def dashboard():
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = User.query.count()
    total_leagues = League.query.count()
    total_teams = FantasyTeam.query.count()
    views_today = PageView.query.filter(PageView.timestamp >= today_start).count()

    # Recent activity (last 20 page views)
    recent = (
        PageView.query
        .order_by(PageView.timestamp.desc())
        .limit(20)
        .all()
    )
    # Enrich with usernames
    user_ids = {pv.user_id for pv in recent if pv.user_id}
    users_map = {}
    if user_ids:
        for u in User.query.filter(User.id.in_(user_ids)).all():
            users_map[u.id] = u.username

    activity = []
    for pv in recent:
        activity.append({
            "user": users_map.get(pv.user_id, "Anonymous"),
            "path": pv.path,
            "method": pv.method,
            "status": pv.status_code,
            "time": pv.timestamp,
        })

    return render_template("admin/dashboard.html",
                           total_users=total_users,
                           total_leagues=total_leagues,
                           total_teams=total_teams,
                           views_today=views_today,
                           activity=activity)


@admin_bp.route("/sync-positions", methods=["POST"])
@admin_required
def sync_positions():
    from scrapers.footywire import sync_player_positions
    changes = sync_player_positions()
    if changes:
        summary = f"Updated {len(changes)} position(s): " + ", ".join(
            f"{c['name']} {c['old_pos']}->{c['new_pos']}" for c in changes
        )
        flash(summary, "success")
    else:
        flash("All player positions are already up to date.", "info")
    return redirect(url_for("admin.dashboard"))


@admin_bp.route("/sync-injuries", methods=["POST"])
@admin_required
def sync_injuries():
    from scrapers.afl_injuries import sync_injuries_to_db
    count = sync_injuries_to_db()
    if count:
        flash(f"Injury sync complete: {count} player(s) updated.", "success")
    else:
        flash("Injury sync complete: no injuries found (page may have changed).", "info")
    return redirect(url_for("admin.dashboard"))


@admin_bp.route("/users")
@admin_required
def users():
    all_users = User.query.order_by(User.created_at.desc()).all()

    # Count teams per user
    team_counts = dict(
        db.session.query(FantasyTeam.owner_id, func.count(FantasyTeam.id))
        .group_by(FantasyTeam.owner_id).all()
    )

    user_data = []
    for u in all_users:
        leagues = [t.league for t in FantasyTeam.query.filter_by(owner_id=u.id).all()]
        user_data.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "display_name": u.display_name,
            "created_at": u.created_at,
            "is_admin": u.is_admin,
            "team_count": team_counts.get(u.id, 0),
            "leagues": leagues,
        })

    return render_template("admin/users.html", users=user_data)


@admin_bp.route("/leagues")
@admin_required
def leagues():
    all_leagues = League.query.order_by(League.created_at.desc()).all()

    league_data = []
    for lg in all_leagues:
        commissioner = User.query.get(lg.commissioner_id)
        league_data.append({
            "id": lg.id,
            "name": lg.name,
            "commissioner": commissioner.username if commissioner else "?",
            "season_year": lg.season_year,
            "status": lg.status,
            "num_teams": len(lg.teams),
            "max_teams": lg.num_teams,
            "created_at": lg.created_at,
        })

    return render_template("admin/leagues.html", leagues=league_data)


@admin_bp.route("/analytics")
@admin_required
def analytics():
    now = datetime.now(timezone.utc)

    # Active users in 24h / 7d / 30d
    def unique_users_since(delta):
        cutoff = now - delta
        return db.session.query(func.count(func.distinct(PageView.user_id))).filter(
            PageView.timestamp >= cutoff,
            PageView.user_id.isnot(None),
        ).scalar() or 0

    active_24h = unique_users_since(timedelta(hours=24))
    active_7d = unique_users_since(timedelta(days=7))
    active_30d = unique_users_since(timedelta(days=30))

    # Daily page views for last 30 days (for Chart.js)
    thirty_days_ago = now - timedelta(days=30)
    daily_rows = (
        db.session.query(
            func.date(PageView.timestamp).label("day"),
            func.count(PageView.id).label("count"),
        )
        .filter(PageView.timestamp >= thirty_days_ago)
        .group_by(func.date(PageView.timestamp))
        .order_by(func.date(PageView.timestamp))
        .all()
    )
    chart_labels = [str(r.day) for r in daily_rows]
    chart_data = [r.count for r in daily_rows]

    # Top pages (last 30 days)
    top_pages = (
        db.session.query(PageView.path, func.count(PageView.id).label("count"))
        .filter(PageView.timestamp >= thirty_days_ago)
        .group_by(PageView.path)
        .order_by(func.count(PageView.id).desc())
        .limit(15)
        .all()
    )

    # ── Per-user engagement (last 30 days) ──
    user_engagement = (
        db.session.query(
            PageView.user_id,
            func.count(PageView.id).label("total_views"),
            func.count(func.distinct(func.date(PageView.timestamp))).label("active_days"),
            func.max(PageView.timestamp).label("last_seen"),
        )
        .filter(PageView.timestamp >= thirty_days_ago, PageView.user_id.isnot(None))
        .group_by(PageView.user_id)
        .order_by(func.count(PageView.id).desc())
        .all()
    )
    user_ids_engagement = {r.user_id for r in user_engagement}
    users_map_all = {}
    if user_ids_engagement:
        for u in User.query.filter(User.id.in_(user_ids_engagement)).all():
            users_map_all[u.id] = u

    user_stats = []
    for r in user_engagement:
        u = users_map_all.get(r.user_id)
        if not u:
            continue
        user_stats.append({
            "username": u.display_name or u.username,
            "total_views": r.total_views,
            "active_days": r.active_days,
            "avg_per_day": round(r.total_views / max(r.active_days, 1), 1),
            "last_seen": r.last_seen,
        })

    # ── Day-of-week heatmap (last 30 days) ──
    dow_rows = (
        db.session.query(
            func.strftime("%w", PageView.timestamp).label("dow"),
            func.count(PageView.id).label("count"),
        )
        .filter(PageView.timestamp >= thirty_days_ago, PageView.user_id.isnot(None))
        .group_by(func.strftime("%w", PageView.timestamp))
        .all()
    )
    dow_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    dow_map = {str(i): 0 for i in range(7)}
    for r in dow_rows:
        dow_map[r.dow] = r.count
    dow_labels = dow_names
    dow_data = [dow_map[str(i)] for i in range(7)]

    # ── Hour-of-day distribution (last 30 days, AEST = UTC+10/11) ──
    hour_rows = (
        db.session.query(
            func.strftime("%H", PageView.timestamp).label("hour"),
            func.count(PageView.id).label("count"),
        )
        .filter(PageView.timestamp >= thirty_days_ago, PageView.user_id.isnot(None))
        .group_by(func.strftime("%H", PageView.timestamp))
        .all()
    )
    # Shift to AEST (+10)
    hour_map_aest = {h: 0 for h in range(24)}
    for r in hour_rows:
        utc_hour = int(r.hour)
        aest_hour = (utc_hour + 10) % 24
        hour_map_aest[aest_hour] += r.count
    hour_labels = [f"{h:02d}" for h in range(24)]
    hour_data = [hour_map_aest[h] for h in range(24)]

    # ── Device breakdown (mobile vs desktop, last 30 days) ──
    all_recent_ua = (
        db.session.query(PageView.user_agent)
        .filter(PageView.timestamp >= thirty_days_ago, PageView.user_id.isnot(None),
                PageView.user_agent.isnot(None))
        .all()
    )
    mobile_count = sum(1 for (ua,) in all_recent_ua if ua and ("Mobile" in ua or "Android" in ua or "iPhone" in ua))
    desktop_count = len(all_recent_ua) - mobile_count

    # ── Top features used (categorised paths, last 30 days) ──
    feature_map = {
        "Gameday": "/gameday", "My Team": "/team/", "Player Pool": "/player-pool",
        "Trades": "/trade", "Fixtures": "/standings", "Draft": "/draft",
        "Player Detail": "/player/", "Settings": "/settings", "Chat": "/chat",
    }
    feature_counts = {}
    all_paths = (
        db.session.query(PageView.path, func.count(PageView.id).label("count"))
        .filter(PageView.timestamp >= thirty_days_ago, PageView.user_id.isnot(None))
        .group_by(PageView.path)
        .all()
    )
    for path, count in all_paths:
        for feature, pattern in feature_map.items():
            if pattern in path:
                feature_counts[feature] = feature_counts.get(feature, 0) + count
                break
    feature_sorted = sorted(feature_counts.items(), key=lambda x: x[1], reverse=True)

    # Recent activity (last 50)
    recent = (
        PageView.query
        .order_by(PageView.timestamp.desc())
        .limit(50)
        .all()
    )
    user_ids = {pv.user_id for pv in recent if pv.user_id}
    users_map = {}
    if user_ids:
        for u in User.query.filter(User.id.in_(user_ids)).all():
            users_map[u.id] = u.username

    recent_data = []
    for pv in recent:
        recent_data.append({
            "user": users_map.get(pv.user_id, "Anonymous"),
            "path": pv.path,
            "method": pv.method,
            "status": pv.status_code,
            "time": pv.timestamp,
        })

    return render_template("admin/analytics.html",
                           active_24h=active_24h,
                           active_7d=active_7d,
                           active_30d=active_30d,
                           chart_labels=chart_labels,
                           chart_data=chart_data,
                           top_pages=top_pages,
                           user_stats=user_stats,
                           dow_labels=dow_labels,
                           dow_data=dow_data,
                           hour_labels=hour_labels,
                           hour_data=hour_data,
                           mobile_count=mobile_count,
                           desktop_count=desktop_count,
                           feature_sorted=feature_sorted,
                           recent=recent_data)


@admin_bp.route("/scheduler-health")
@admin_required
def scheduler_health():
    from models.scheduler import get_scheduler_health
    return jsonify(get_scheduler_health())

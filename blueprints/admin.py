"""Admin hub blueprint: dashboard, user management, league overview, analytics."""

from datetime import datetime, timedelta, timezone
from functools import wraps
from zoneinfo import ZoneInfo

_AEST = ZoneInfo("Australia/Melbourne")

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

    if request.args.get("format") == "json":
        return jsonify({
            "total_users": total_users,
            "total_leagues": total_leagues,
            "total_teams": total_teams,
            "views_today": views_today,
            "activity": [{
                "user": a["user"],
                "path": a["path"],
                "method": a["method"],
                "status": a["status"],
                "time": a["time"].isoformat() if a["time"] else None,
            } for a in activity],
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

    if request.args.get("format") == "json":
        return jsonify({"users": [{
            "id": u["id"],
            "username": u["username"],
            "email": u["email"],
            "display_name": u["display_name"],
            "created_at": u["created_at"].isoformat() if u["created_at"] else None,
            "is_admin": u["is_admin"],
            "team_count": u["team_count"],
            "leagues": [{"id": lg.id, "name": lg.name} for lg in u["leagues"]],
        } for u in user_data]})

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

    if request.args.get("format") == "json":
        return jsonify({"leagues": [{
            "id": lg["id"],
            "name": lg["name"],
            "commissioner": lg["commissioner"],
            "season_year": lg["season_year"],
            "status": lg["status"],
            "num_teams": lg["num_teams"],
            "max_teams": lg["max_teams"],
            "created_at": lg["created_at"].isoformat() if lg["created_at"] else None,
        } for lg in league_data]})

    return render_template("admin/leagues.html", leagues=league_data)


@admin_bp.route("/analytics/api")
@admin_required
def analytics_api():
    """JSON API for analytics dashboard with date range and user filters."""
    now = datetime.now(timezone.utc)
    days = request.args.get("days", 30, type=int)
    user_filter = request.args.get("user_id", None, type=int)
    exclude_jpod = request.args.get("exclude_jpod", "false").lower() == "true"
    start_arg = request.args.get("start")
    end_arg = request.args.get("end")

    # Resolve date range — custom start/end overrides days
    if start_arg and end_arg:
        try:
            start_dt = datetime.strptime(start_arg, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            # end is inclusive — extend to end-of-day
            end_dt = (datetime.strptime(end_arg, "%Y-%m-%d") + timedelta(days=1)).replace(tzinfo=timezone.utc)
            days = max((end_dt - start_dt).days, 1)
        except ValueError:
            start_dt = now - timedelta(days=days)
            end_dt = now
    else:
        start_dt = now - timedelta(days=days)
        end_dt = now

    # Resolve jpod31 user_id (None if user doesn't exist)
    jpod_id = None
    if exclude_jpod:
        jpod = User.query.filter(User.username == "jpod31").first()
        if jpod:
            jpod_id = jpod.id

    def _scope(q):
        """Apply common filters to any PageView query."""
        q = q.filter(PageView.timestamp >= start_dt,
                     PageView.timestamp < end_dt,
                     PageView.user_id.isnot(None))
        if user_filter:
            q = q.filter(PageView.user_id == user_filter)
        elif jpod_id:
            q = q.filter(PageView.user_id != jpod_id)
        return q

    base_q = _scope(PageView.query)

    # Daily views
    daily = _scope(
        db.session.query(func.date(PageView.timestamp).label("day"), func.count(PageView.id))
    ).group_by(func.date(PageView.timestamp)).order_by(func.date(PageView.timestamp)).all()

    # Daily unique users
    daily_users = _scope(
        db.session.query(func.date(PageView.timestamp).label("day"), func.count(func.distinct(PageView.user_id)))
    ).group_by(func.date(PageView.timestamp)).order_by(func.date(PageView.timestamp)).all()

    # Hour x Day heatmap
    heatmap_rows = _scope(
        db.session.query(
            func.strftime("%w", PageView.timestamp).label("dow"),
            func.strftime("%H", PageView.timestamp).label("hour"),
            func.count(PageView.id).label("count"),
        )
    ).group_by("dow", "hour").all()
    # Build 7x24 matrix (shifted to AEST +10)
    heatmap = [[0]*24 for _ in range(7)]
    for dow, hour, count in heatmap_rows:
        aest_hour = (int(hour) + 10) % 24
        heatmap[int(dow)][aest_hour] = count

    # Per-user stats
    user_rows = _scope(
        db.session.query(
            PageView.user_id,
            func.count(PageView.id).label("views"),
            func.count(func.distinct(func.date(PageView.timestamp))).label("active_days"),
            func.max(PageView.timestamp).label("last_seen"),
        )
    ).group_by(PageView.user_id).order_by(func.count(PageView.id).desc()).all()
    uid_set = {r.user_id for r in user_rows}
    umap = {}
    if uid_set:
        for u in User.query.filter(User.id.in_(uid_set)).all():
            umap[u.id] = u.display_name or u.username

    users = []
    for r in user_rows:
        # Per-user daily sparkline
        spark = (
            db.session.query(func.date(PageView.timestamp), func.count(PageView.id))
            .filter(PageView.timestamp >= start_dt, PageView.timestamp < end_dt,
                    PageView.user_id == r.user_id)
            .group_by(func.date(PageView.timestamp))
            .order_by(func.date(PageView.timestamp))
            .all()
        )
        users.append({
            "id": r.user_id,
            "name": umap.get(r.user_id, "?"),
            "views": r.views,
            "active_days": r.active_days,
            "avg_per_day": round(r.views / max(r.active_days, 1), 1),
            "last_seen": (
                (r.last_seen.replace(tzinfo=timezone.utc) if r.last_seen.tzinfo is None else r.last_seen)
                .astimezone(_AEST).strftime("%d %b %H:%M")
            ) if r.last_seen else "",
            "sparkline": [c for _, c in spark],
        })

    # Feature breakdown
    feature_map = {
        "Gameday": "/gameday", "My Team": "/team/", "Player Pool": "/player-pool",
        "Trades": "/trade", "Ladder / Standings": "/standings", "Draft": "/draft",
        "Player Detail": "/player/", "Settings": "/settings", "Chat": "/chat",
        "Fixtures": "/fixture", "AFL Live": "/afl-live",
    }
    all_paths = _scope(
        db.session.query(PageView.path, func.count(PageView.id))
    ).group_by(PageView.path).all()
    features = {}
    for path, count in all_paths:
        for feat, pattern in feature_map.items():
            if pattern in path:
                features[feat] = features.get(feat, 0) + count
                break
        else:
            features["Other"] = features.get("Other", 0) + count
    features = sorted(features.items(), key=lambda x: x[1], reverse=True)

    # Device split
    all_ua = _scope(
        db.session.query(PageView.user_agent).filter(PageView.user_agent.isnot(None))
    ).all()
    mobile = sum(1 for (ua,) in all_ua if ua and any(k in ua for k in ("Mobile", "Android", "iPhone")))
    desktop = len(all_ua) - mobile

    # Top pages
    top_pages = _scope(
        db.session.query(PageView.path, func.count(PageView.id).label("c"))
    ).group_by(PageView.path).order_by(func.count(PageView.id).desc()).limit(20).all()

    # Total sessions — group page views per user, count gaps > 30 min as a new session.
    # Also track session sizes for bounce rate + pages-per-session.
    session_rows = _scope(
        db.session.query(PageView.user_id, PageView.timestamp)
    ).order_by(PageView.user_id, PageView.timestamp).all()
    total_sessions = 0
    session_sizes = []  # views per session
    current_size = 0
    last_uid, last_ts = None, None
    for uid, ts in session_rows:
        new_session = (uid != last_uid) or (ts - last_ts).total_seconds() > 1800
        if new_session:
            if current_size:
                session_sizes.append(current_size)
            total_sessions += 1
            current_size = 1
        else:
            current_size += 1
        last_uid, last_ts = uid, ts
    if current_size:
        session_sizes.append(current_size)
    pages_per_session = round(sum(session_sizes) / max(len(session_sizes), 1), 2) if session_sizes else 0
    single_page_sessions = sum(1 for s in session_sizes if s == 1)
    bounce_rate = round(single_page_sessions / max(len(session_sizes), 1) * 100, 1) if session_sizes else 0

    # ── Page coverage: normalize paths (replace numeric IDs), count views per pattern ──
    import re as _re
    _ID_PATTERN = _re.compile(r"/\d+(?=/|$)")

    def _normalize(p):
        return _ID_PATTERN.sub("/:id", p)

    path_rows = _scope(
        db.session.query(PageView.path, func.count(PageView.id).label("c"),
                         func.count(func.distinct(PageView.user_id)).label("uu"),
                         func.max(PageView.timestamp).label("last"))
    ).group_by(PageView.path).all()

    coverage_map = {}
    for p, c, uu, last in path_rows:
        key = _normalize(p)
        entry = coverage_map.setdefault(key, {"path": key, "views": 0, "unique_users": 0, "last_seen_ts": None})
        entry["views"] += c
        entry["unique_users"] = max(entry["unique_users"], uu or 0)  # approx — distinct per raw path, not quite right but usable
        if last and (entry["last_seen_ts"] is None or last > entry["last_seen_ts"]):
            entry["last_seen_ts"] = last

    # Compute total views across coverage so we can show % of traffic per page
    coverage_total = sum(e["views"] for e in coverage_map.values()) or 1

    # Add entries for routes that exist in the app but have 0 views in this period,
    # so they appear alongside low-traffic pages in the coverage table.
    from flask import current_app
    viewed_keys = set(coverage_map.keys())
    _SKIP_RULE_PREFIXES = ("/static", "/api/", "/auth/api", "/push/", "/socket.io", "/admin/")
    for rule in current_app.url_map.iter_rules():
        if "GET" not in rule.methods:
            continue
        pattern = rule.rule
        if any(pattern.startswith(p) for p in _SKIP_RULE_PREFIXES):
            continue
        if "/api/" in pattern or "_debug" in pattern:
            continue
        norm = _re.sub(r"<[^>]+>", ":id", pattern)
        if norm in viewed_keys:
            continue
        coverage_map[norm] = {"path": norm, "views": 0, "unique_users": 0, "last_seen_ts": None}

    # Format last-seen timestamps, attach pct-of-traffic, finalise
    coverage = []
    for entry in coverage_map.values():
        last_ts_val = entry.pop("last_seen_ts")
        if last_ts_val:
            last_aest = (last_ts_val.replace(tzinfo=timezone.utc) if last_ts_val.tzinfo is None else last_ts_val).astimezone(_AEST)
            entry["last_seen"] = last_aest.strftime("%d %b %H:%M")
        else:
            entry["last_seen"] = ""
        entry["pct_of_traffic"] = round(entry["views"] / coverage_total * 100, 2)
        coverage.append(entry)
    coverage.sort(key=lambda e: e["views"], reverse=True)

    # Summary stats
    total_views = base_q.count()
    unique_users = _scope(
        db.session.query(func.count(func.distinct(PageView.user_id)))
    ).scalar() or 0
    avg_daily = round(total_views / max(days, 1), 1)

    # This period vs previous period comparison (same length immediately before)
    period_len = end_dt - start_dt
    prev_start = start_dt - period_len
    prev_q = PageView.query.filter(
        PageView.timestamp >= prev_start, PageView.timestamp < start_dt,
        PageView.user_id.isnot(None))
    if user_filter:
        prev_q = prev_q.filter(PageView.user_id == user_filter)
    elif jpod_id:
        prev_q = prev_q.filter(PageView.user_id != jpod_id)
    prev_views = prev_q.count()
    change_pct = round((total_views - prev_views) / max(prev_views, 1) * 100, 1) if prev_views else 0

    return jsonify({
        "summary": {
            "total_views": total_views,
            "unique_users": unique_users,
            "total_sessions": total_sessions,
            "pages_per_session": pages_per_session,
            "bounce_rate": bounce_rate,
            "avg_daily": avg_daily,
            "change_pct": change_pct,
            "prev_views": prev_views,
        },
        "daily_views": {"labels": [str(d) for d, _ in daily], "data": [c for _, c in daily]},
        "daily_users": {"labels": [str(d) for d, _ in daily_users], "data": [c for _, c in daily_users]},
        "heatmap": heatmap,
        "users": users,
        "features": features,
        "device": {"mobile": mobile, "desktop": desktop},
        "top_pages": [{"path": p, "views": c} for p, c in top_pages],
        "page_coverage": coverage,
    })


@admin_bp.route("/analytics")
@admin_required
def analytics():
    # Just render the shell — all data loaded via analytics_api JS calls
    users = User.query.order_by(User.username).all()
    return render_template("admin/analytics.html", all_users=users)


@admin_bp.route("/scheduler-health")
@admin_required
def scheduler_health():
    from models.scheduler import get_scheduler_health
    return jsonify(get_scheduler_health())

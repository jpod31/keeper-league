"""Flask entry point for the Keeper League dashboard."""

import os
import json
import logging
import subprocess

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import current_user, login_required
from flask_wtf.csrf import CSRFProtect
from werkzeug.utils import secure_filename

from flask_socketio import SocketIO

import config
from models.database import db, init_db

csrf = CSRFProtect()
from models.auth import login_manager
from models.player import load_players_csv, save_players_csv
from models.draft_model import rank_players, factor_breakdown, compute_historical_draft_scores
from models.team_manager import (
    load_teams, save_teams, set_team_roster, resolve_roster,
    select_best_23, team_projections, analyse_weaknesses,
    add_player_to_team, remove_player_from_team,
)
from models.club_profiler import all_team_profiles, comparison_table
from scrapers.footywire import (
    scrape_rosters, scrape_sc_scores, scrape_sc_scores_batch,
    build_master_player_list, load_player_sc_history,
)
from scrapers.csv_import import import_players_csv, import_sc_scores_csv
from scrapers.stats_loader import (
    load_player_detailed_stats,
    backfill_sc_from_fitzroy,
    load_player_sc_history_fitzroy,
)


_XLSX_PATH = os.environ.get("RATINGS_XLSX_PATH",
    os.path.join(os.path.expanduser("~"), "OneDrive", "Documents", "AFL 2025.1.xlsx")
)

# Team name mapping: Excel name -> DB name
_XLSX_TEAM_MAP = {
    "Brisbane": "Brisbane Lions",
    "Greater Western Sydney": "GWS",
    "St. Kilda": "St Kilda",
}

# Exact name overrides: DB name -> XLSX name (when names are just different)
_NAME_OVERRIDES = {
    ("Michael Frederick", "Fremantle"): "Minairo Frederick",
    ("Max King", "Sydney"): "Maxy King",
    ("Nikolas Cox", "Essendon"): "Nik Cox",
    ("Jacob Farrow", "Essendon"): "Jackson Farrow",
    ("Indy Cotton", "Adelaide"): "Indi Cotton",
    ("Hussien El Achkar", "Essendon"): "Hussein El Achkar",
    ("Jack Hutchinson", "West Coast"): "Jack Hutchison",
    ("Maurice Rioli", "Richmond"): "Maurice Rioli Jr",
    ("Robert Hansen", "North Melbourne"): "Robert Hansen Jr",
}

# Bidirectional nickname map for fuzzy player matching
_NICKNAME_MAP = {
    "brad": "bradley", "cam": "cameron", "dan": "daniel",
    "ed": "edward", "harry": "harrison", "josh": "joshua",
    "jake": "jacob", "tom": "thomas", "will": "william",
    "matt": "matthew", "ben": "benjamin", "sam": "samuel",
    "nick": "nicholas", "mitch": "mitchell", "alex": "alexander",
    "tim": "timothy", "rob": "robert", "pat": "patrick",
    "joe": "joseph", "charlie": "charles", "liam": "william",
    "zac": "zachary", "zach": "zachary", "nat": "nathan",
    "nic": "nicholas", "mike": "michael", "chris": "christopher",
    "jim": "james", "jon": "jonathan", "dave": "david",
    "lachlan": "lachie", "ollie": "oliver", "wil": "will",
    "willem": "will", "jack": "jackson", "jaime": "jamie",
}
# Build reverse map (long -> short)
_NICKNAME_MAP_REV = {}
for short, long in _NICKNAME_MAP.items():
    _NICKNAME_MAP_REV.setdefault(long, []).append(short)


def _name_variants(name: str):
    """Generate plausible first-name variants for a full name."""
    parts = name.strip().split()
    if len(parts) < 2:
        return []
    first = parts[0].lower()
    rest = " ".join(parts[1:])
    variants = []
    # short -> long
    if first in _NICKNAME_MAP:
        variants.append(f"{_NICKNAME_MAP[first].title()} {rest}")
    # long -> short(s)
    if first in _NICKNAME_MAP_REV:
        for short in _NICKNAME_MAP_REV[first]:
            variants.append(f"{short.title()} {rest}")
    return variants


def _sync_ratings_to_db(app):
    """Import rating & potential from AFL 2025.1.xlsx into the afl_player table."""
    from models.database import AflPlayer, RatingLog

    if not os.path.exists(_XLSX_PATH):
        app.logger.info("Ratings sync: XLSX not found, skipping")
        return

    with app.app_context():
        # Staleness check
        import datetime as _dt
        xlsx_mtime = _dt.datetime.fromtimestamp(os.path.getmtime(_XLSX_PATH))
        newest = AflPlayer.query.filter(AflPlayer.rating.isnot(None)).order_by(
            AflPlayer.updated_at.desc()
        ).first()
        if newest and newest.updated_at:
            db_time = newest.updated_at.replace(tzinfo=None)
            if db_time >= xlsx_mtime:
                app.logger.info("Ratings sync: XLSX not newer than DB, skipping")
                return

        import openpyxl
        wb = openpyxl.load_workbook(_XLSX_PATH, read_only=True, data_only=True)
        ws = wb["Player Database"]

        # Find the current-year column for start-of-year rating
        # After Dec 1 use next year's column; before Dec 1 use current year
        from datetime import date
        today = date.today()
        target_year = today.year + 1 if today.month == 12 else today.year
        headers = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
        year_col_idx = None
        for ci, h in enumerate(headers):
            if h and str(h).strip().isdigit() and int(str(h)) == target_year:
                year_col_idx = ci
                break

        # Read rows: col 0=Player, 2=Rating, 3=Potential, 4=Team, year_col_idx=start-of-year
        xlsx_players = []
        for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
            name = row[0]
            if not name or not isinstance(name, str):
                continue
            team_raw = row[4] or ""
            team = _XLSX_TEAM_MAP.get(team_raw, team_raw)
            rating = row[2] if isinstance(row[2], (int, float)) else None
            potential = row[3] if isinstance(row[3], (int, float)) else None
            rating_start = None
            if year_col_idx is not None and len(row) > year_col_idx:
                val = row[year_col_idx]
                if isinstance(val, (int, float)):
                    rating_start = int(val)
            if rating is not None:
                rating = int(rating)
            if potential is not None:
                potential = int(potential)
            xlsx_players.append((name.strip(), team.strip(), rating, potential, rating_start))
        wb.close()

        # Build DB lookup: (lowercase name, team) -> AflPlayer
        all_db = AflPlayer.query.all()
        db_lookup = {}
        for ap in all_db:
            key = (ap.name.lower(), ap.afl_team)
            db_lookup[key] = ap

        # Build reverse override map: (xlsx_name_lower, team) -> db AflPlayer
        override_lookup = {}
        for (db_name, db_team), xlsx_name in _NAME_OVERRIDES.items():
            ap = db_lookup.get((db_name.lower(), db_team))
            if ap:
                override_lookup[(xlsx_name.lower(), db_team)] = ap

        matched = 0
        unmatched = []

        for xlsx_name, xlsx_team, rating, potential, rating_start in xlsx_players:
            # Pass 1: exact match on (name, team)
            key = (xlsx_name.lower(), xlsx_team)
            ap = db_lookup.get(key)

            # Pass 2: explicit overrides
            if ap is None:
                ap = override_lookup.get(key)

            # Pass 3: nickname variants (both directions)
            if ap is None:
                for variant in _name_variants(xlsx_name):
                    key2 = (variant.lower(), xlsx_team)
                    ap = db_lookup.get(key2)
                    if ap:
                        break

            if ap:
                # Log changes before applying
                rating_changed = (ap.rating != rating) if rating is not None else False
                potential_changed = (ap.potential != potential) if potential is not None else False
                if rating_changed or potential_changed:
                    log = RatingLog(
                        player_id=ap.id,
                        old_rating=ap.rating,
                        new_rating=rating,
                        old_potential=ap.potential,
                        new_potential=potential,
                        rating_start=rating_start if rating_start is not None else ap.rating_start,
                    )
                    db.session.add(log)
                ap.rating = rating
                ap.potential = potential
                if rating_start is not None:
                    ap.rating_start = rating_start
                matched += 1
            else:
                unmatched.append((xlsx_name, xlsx_team))

        db.session.commit()
        app.logger.info(
            f"Ratings sync: {matched} players updated, "
            f"{len(unmatched)} unmatched from XLSX"
        )
        if unmatched and len(unmatched) <= 30:
            for n, t in unmatched:
                app.logger.debug(f"  Unmatched: {n} ({t})")


def _sync_players_to_db(app, force=False):
    """Bulk-import players.csv into the afl_player table if it's empty or stale.

    Args:
        force: If True, bypass staleness check and always sync.
    """
    from models.database import AflPlayer
    from models.player import load_players_csv, player_to_orm
    from models.draft_model import rank_players

    with app.app_context():
        csv_path = os.path.join(config.DATA_DIR, "players.csv")
        if not os.path.exists(csv_path):
            return

        db_count = AflPlayer.query.count()
        if not force and db_count > 0:
            # Check staleness: compare CSV mod-time to newest updated_at
            import datetime
            csv_mtime = datetime.datetime.fromtimestamp(os.path.getmtime(csv_path))
            newest = (
                AflPlayer.query
                .order_by(AflPlayer.updated_at.desc())
                .first()
            )
            if newest and newest.updated_at:
                # Strip timezone info for comparison (SQLite stores naive datetimes)
                db_time = newest.updated_at.replace(tzinfo=None)
                if db_time >= csv_mtime:
                    return  # DB is up-to-date

        players = load_players_csv()
        if not players:
            return

        # Rank them so draft_score is populated
        rank_players(players, config.DRAFT_WEIGHTS)

        # Upsert: match on (name, afl_team)
        existing = {(p.name, p.afl_team): p for p in AflPlayer.query.all()}
        added = 0
        updated = 0
        for p in players:
            orm_data = player_to_orm(p)
            key = (orm_data["name"], orm_data["afl_team"])
            if key in existing:
                row = existing[key]
                # Skip sc_avg/sc_avg_prev/games_played — these are now
                # computed from live PlayerStat data, not from CSV.
                _LIVE_COLS = {"name", "afl_team", "sc_avg", "sc_avg_prev", "games_played"}
                for col, val in orm_data.items():
                    if col not in _LIVE_COLS:
                        setattr(row, col, val)
                updated += 1
            else:
                row = AflPlayer(**orm_data)
                db.session.add(row)
                added += 1

        db.session.commit()
        total = AflPlayer.query.count()
        app.logger.info(f"Player sync: {added} added, {updated} updated, {total} total in DB")


def create_app():
    app = Flask(__name__)
    app.secret_key = config.SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = config.SQLALCHEMY_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = config.SQLALCHEMY_TRACK_MODIFICATIONS
    app.config["SESSION_COOKIE_HTTPONLY"] = config.SESSION_COOKIE_HTTPONLY
    app.config["SESSION_COOKIE_SAMESITE"] = config.SESSION_COOKIE_SAMESITE
    app.config["SESSION_COOKIE_SECURE"] = config.SESSION_COOKIE_SECURE
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH

    # Email config
    app.config["MAIL_SERVER"] = config.MAIL_SERVER
    app.config["MAIL_PORT"] = config.MAIL_PORT
    app.config["MAIL_USE_TLS"] = config.MAIL_USE_TLS
    app.config["MAIL_USERNAME"] = config.MAIL_USERNAME
    app.config["MAIL_PASSWORD"] = config.MAIL_PASSWORD
    app.config["MAIL_DEFAULT_SENDER"] = config.MAIL_DEFAULT_SENDER

    # Init extensions
    init_db(app)
    login_manager.init_app(app)
    csrf.init_app(app)

    # Flask-Mail (lazy — only sends if MAIL_USERNAME is configured)
    from flask_mail import Mail
    mail = Mail(app)
    app.extensions["mail"] = mail

    # Enable SQLite WAL mode for concurrent reads
    if "sqlite" in config.SQLALCHEMY_DATABASE_URI:
        from sqlalchemy import event as sa_event, engine as sa_engine

        @sa_event.listens_for(sa_engine.Engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()

    # Sync CSV players into SQLite, then ratings from XLSX
    _sync_players_to_db(app)
    _sync_ratings_to_db(app)

    # Register blueprints
    from blueprints.auth import auth_bp
    from blueprints.leagues import leagues_bp
    from blueprints.draft import draft_bp
    from blueprints.team import team_bp
    from blueprints.trades import trades_bp
    from blueprints.matchups import matchups_bp
    from blueprints.admin import admin_bp
    from blueprints.comms import comms_bp
    from blueprints.reserve7s import reserve7s_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(leagues_bp)
    app.register_blueprint(draft_bp)
    csrf.exempt(draft_bp)   # draft API endpoints use @login_required + auth checks
    csrf.exempt(team_bp)    # team API endpoints use @login_required + ownership checks
    # Exempt specific JSON API endpoints in leagues blueprint
    csrf.exempt("leagues.commissioner_delist")
    csrf.exempt("leagues.commissioner_force_move")
    csrf.exempt("leagues.player_pickup")
    app.register_blueprint(team_bp)
    app.register_blueprint(trades_bp)
    app.register_blueprint(matchups_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(comms_bp)
    app.register_blueprint(reserve7s_bp)
    csrf.exempt(reserve7s_bp)  # 7s team API uses @login_required + ownership checks

    # Context processor — inject globals into all templates
    @app.context_processor
    def inject_globals():
        ctx = {
            "TEAM_LOGOS": config.TEAM_LOGOS,
            "TEAM_COLOURS": config.TEAM_COLOURS,
            "SCORING_TYPE_LABELS": config.SCORING_TYPE_LABELS,
        }
        if current_user.is_authenticated:
            from models.database import FantasyTeam
            from models.notification_manager import get_unread_count
            user_teams = FantasyTeam.query.filter_by(
                owner_id=current_user.id
            ).all()
            ctx["user_leagues"] = [(t.league, t) for t in user_teams]
            ctx["unread_notif_count"] = get_unread_count(current_user.id)
            ctx["theme_pref"] = getattr(current_user, "theme_preference", "dark") or "dark"
            ctx["has_completed_onboarding"] = getattr(current_user, "has_completed_onboarding", True)

            # If in a league-scoped route, provide nav helpers
            league_id = (request.view_args or {}).get("league_id")
            if league_id:
                nav_team = next(
                    (t for t in user_teams if t.league_id == league_id), None
                )
                ctx["nav_user_team"] = nav_team
                # Finals config for subnav visibility
                from models.database import League as _League, SeasonConfig as _SC, DraftSession
                _lg = db.session.get(_League, league_id)
                if _lg:
                    _sc = _SC.query.filter_by(league_id=league_id, year=_lg.season_year).first()
                    ctx["nav_finals_teams"] = _sc.finals_teams if _sc else 4
                    # Active draft session for nav link visibility
                    ctx["nav_active_draft"] = DraftSession.query.filter_by(
                        league_id=league_id, is_mock=False
                    ).filter(
                        DraftSession.status.in_(["scheduled", "in_progress", "paused"])
                    ).first() is not None
                    # Commissioner nav helpers
                    if _lg.commissioner_id == current_user.id:
                        ctx["nav_is_commissioner"] = True
                        from models.database import LongTermInjury as _LTI
                        ctx["pending_ltil_count"] = _LTI.query.filter_by(
                            league_id=league_id, removed_at=None, status="pending"
                        ).count()
        return ctx

    # ── Security headers ────────────────────────────────────────────
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # ── Error handlers ────────────────────────────────────────────────
    @app.errorhandler(404)
    def page_not_found(e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        return render_template("errors/500.html"), 500

    @app.errorhandler(403)
    def forbidden(e):
        return render_template("errors/403.html"), 403

    # ── Request logging (analytics) ──────────────────────────────────
    @app.after_request
    def log_page_view(response):
        """Record every non-static request to PageView for analytics."""
        path = request.path
        if path.startswith("/static/") or path == "/favicon.ico":
            return response
        try:
            import hashlib
            from models.database import PageView
            ip_raw = request.remote_addr or "unknown"
            ip_hash = hashlib.sha256(ip_raw.encode()).hexdigest()
            pv = PageView(
                user_id=current_user.id if current_user.is_authenticated else None,
                path=path,
                method=request.method,
                status_code=response.status_code,
                user_agent=(request.user_agent.string or "")[:256],
                ip_hash=ip_hash,
            )
            db.session.add(pv)
            db.session.commit()
        except Exception:
            db.session.rollback()
        return response

    # ── Helpers ──────────────────────────────────────────────────────

    def _get_ranked_players():
        from models.database import AflPlayer
        from models.player import orm_to_player
        afl_players = AflPlayer.query.all()
        if afl_players:
            players = [orm_to_player(ap) for ap in afl_players]
            rank_players(players, config.DRAFT_WEIGHTS)
            return players
        # Fallback to CSV if DB is empty
        players = load_players_csv()
        if players:
            rank_players(players, config.DRAFT_WEIGHTS)
        return players

    # ── Public routes (no login required) ────────────────────────────

    @app.route("/")
    def index():
        if not current_user.is_authenticated:
            return redirect(url_for("auth.login"))
        return redirect(url_for("leagues.league_list"))

    @app.route("/player/<name>")
    def player_detail(name):
        players = _get_ranked_players()
        player = next((p for p in players if p.name == name), None)
        if player is None:
            flash(f"Player '{name}' not found.", "warning")
            return redirect(url_for("leagues.league_list"))

        breakdown = factor_breakdown(player, players, config.DRAFT_WEIGHTS)

        # Load multi-year SC history (fitzRoy preferred — has all years; footywire fallback)
        sc_history = load_player_sc_history_fitzroy(name)
        if not sc_history.get("yearly_averages"):
            sc_history = load_player_sc_history(name)

        # Load detailed stats from fitzRoy CSVs (if available)
        detailed = load_player_detailed_stats(name)

        # Compute historical draft scores across career
        draft_history = compute_historical_draft_scores(player, detailed, players)

        # Load rating/potential from DB for this player
        from models.database import AflPlayer as _AP
        afl_row = _AP.query.filter_by(name=name).first()
        player_ratings = {}
        player_injury = {}
        if afl_row:
            player_ratings = {
                "rating": afl_row.rating,
                "potential": afl_row.potential,
            }
            if afl_row.injury_severity:
                from scrapers.afl_injuries import friendly_return_text
                from scrapers.squiggle import get_current_round
                current_round = get_current_round(config.CURRENT_YEAR)
                player_injury = {
                    "type": afl_row.injury_type,
                    "return": afl_row.injury_return,
                    "severity": afl_row.injury_severity,
                    "display": friendly_return_text(afl_row.injury_return, current_round),
                }

        # Acquisition info: find which league/team drafted this player
        acquisition_info = []
        if afl_row:
            from models.database import FantasyRoster, FantasyTeam, DraftPick, DraftSession, User, League
            acq_rows = (
                db.session.query(FantasyRoster, FantasyTeam)
                .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
                .filter(FantasyRoster.player_id == afl_row.id, FantasyRoster.is_active == True)
                .all()
            )
            for fr, ft in acq_rows:
                owner = User.query.get(ft.owner_id) if ft.owner_id else None
                coach_name = (owner.display_name or owner.username) if owner else ft.name
                info = {
                    "coach": coach_name,
                    "team": ft.name,
                    "method": fr.acquired_via or "draft",
                    "league_name": "",
                }
                lg = db.session.get(League, ft.league_id)
                if lg:
                    info["league_name"] = lg.name
                # Find draft pick details
                if fr.acquired_via in ("draft", "supplemental", None):
                    dp = (
                        DraftPick.query
                        .join(DraftSession, DraftPick.draft_session_id == DraftSession.id)
                        .filter(
                            DraftSession.league_id == ft.league_id,
                            DraftPick.player_id == afl_row.id,
                            DraftPick.team_id == ft.id,
                        )
                        .first()
                    )
                    if dp:
                        ds = DraftSession.query.get(dp.draft_session_id)
                        info["pick_number"] = dp.pick_number
                        info["draft_year"] = ds.started_at.year if ds and ds.started_at else (ds.scheduled_start.year if ds and ds.scheduled_start else "")
                        info["draft_type"] = ds.draft_round_type if ds else "initial"
                acquisition_info.append(info)

        return render_template("player.html",
                               player=player,
                               breakdown=breakdown,
                               sc_history=sc_history,
                               detailed=detailed,
                               draft_history=draft_history,
                               weights=config.DRAFT_WEIGHTS,
                               player_ratings=player_ratings,
                               player_injury=player_injury,
                               acquisition_info=acquisition_info)

    # ── Legacy team routes (keep working — no login required) ────────

    @app.route("/my_team")
    @app.route("/my_team/<team_name>")
    def my_team(team_name=None):
        teams = load_teams()
        if not teams:
            flash("No teams configured yet. Add teams via League page.", "info")
            return redirect(url_for("league"))

        if team_name is None:
            team_name = list(teams.keys())[0]

        master = load_players_csv()
        if master:
            rank_players(master, config.DRAFT_WEIGHTS)

        roster = resolve_roster(team_name, master)
        best_23 = select_best_23(roster)
        projections = team_projections(roster, years=3)
        warnings = analyse_weaknesses(roster)

        return render_template("my_team.html",
                               team_name=team_name,
                               teams=list(teams.keys()),
                               roster=roster,
                               best_23=best_23,
                               projections=projections,
                               warnings=warnings,
                               positions=config.POSITIONS)

    @app.route("/my_team/<team_name>/add", methods=["POST"])
    def team_add_player(team_name):
        player_name = request.form.get("player_name", "").strip()
        if player_name:
            add_player_to_team(team_name, player_name)
            flash(f"Added {player_name} to {team_name}.", "success")
        return redirect(url_for("my_team", team_name=team_name))

    @app.route("/my_team/<team_name>/remove", methods=["POST"])
    def team_remove_player(team_name):
        player_name = request.form.get("player_name", "").strip()
        if player_name:
            remove_player_from_team(team_name, player_name)
            flash(f"Removed {player_name} from {team_name}.", "success")
        return redirect(url_for("my_team", team_name=team_name))

    @app.route("/league")
    def league():
        teams = load_teams()
        master = load_players_csv()
        profiles = all_team_profiles(master)
        comp = comparison_table(master)
        return render_template("league.html",
                               teams=teams,
                               profiles=profiles,
                               comparison=comp)

    @app.route("/league/create_team", methods=["POST"])
    def create_team():
        name = request.form.get("team_name", "").strip()
        if name:
            teams = load_teams()
            if name not in teams:
                teams[name] = []
                save_teams(teams)
                flash(f"Team '{name}' created.", "success")
            else:
                flash(f"Team '{name}' already exists.", "warning")
        return redirect(url_for("league"))

    @app.route("/league/delete_team", methods=["POST"])
    def delete_team():
        name = request.form.get("team_name", "").strip()
        teams = load_teams()
        if name in teams:
            del teams[name]
            save_teams(teams)
            flash(f"Team '{name}' deleted.", "success")
        return redirect(url_for("league"))

    @app.route("/settings", methods=["GET", "POST"])
    def settings():
        if request.method == "POST":
            try:
                new_weights = {}
                for key in config.DRAFT_WEIGHTS:
                    val = float(request.form.get(key, 0))
                    new_weights[key] = val

                total = sum(new_weights.values())
                if abs(total - 1.0) > 0.01:
                    # Auto-normalise
                    for k in new_weights:
                        new_weights[k] = round(new_weights[k] / total, 2)
                    flash("Weights were normalised to sum to 1.0.", "info")

                config.DRAFT_WEIGHTS.update(new_weights)

                # Age curve
                for key in config.AGE_CURVE:
                    val = request.form.get(f"age_{key}")
                    if val is not None:
                        config.AGE_CURVE[key] = float(val)

                # Positional scarcity
                for pos in config.POSITIONAL_SCARCITY:
                    val = request.form.get(f"scarcity_{pos}")
                    if val is not None:
                        config.POSITIONAL_SCARCITY[pos] = float(val)

                flash("Settings saved.", "success")
            except (ValueError, TypeError) as e:
                flash(f"Invalid input: {e}", "danger")

            return redirect(url_for("settings"))

        return render_template("settings.html",
                               weights=config.DRAFT_WEIGHTS,
                               age_curve=config.AGE_CURVE,
                               scarcity=config.POSITIONAL_SCARCITY)

    @app.route("/refresh", methods=["POST"])
    def trigger_refresh_all():
        """One-button refresh: rosters, SC scores, and fitzRoy detailed stats."""
        import pandas as pd

        steps = []

        # 1. Scrape rosters + current SC scores → master player list
        try:
            players = build_master_player_list()
            steps.append(f"Rosters: {len(players)} players")
        except Exception as e:
            steps.append(f"Rosters FAILED: {e}")

        # 2. Fetch detailed stats via fitzRoy (footywire source)
        script_path = os.path.join(config.BASE_DIR, "scripts", "fetch_stats.R")
        try:
            result = subprocess.run(
                [config.RSCRIPT_PATH, script_path, "2013", str(config.CURRENT_YEAR)],
                capture_output=True, text=True, timeout=600,
                cwd=config.BASE_DIR,
            )
            csv_count = sum(
                1 for y in range(2013, config.CURRENT_YEAR + 1)
                if os.path.exists(os.path.join(config.DATA_DIR, f"player_stats_{y}.csv"))
            )
            if result.returncode in (0, 127):  # 127 is OK on Windows bash
                steps.append(f"fitzRoy: {csv_count} years on disk")
            else:
                steps.append(f"fitzRoy error: {result.stderr[-200:]}")
        except FileNotFoundError:
            steps.append("fitzRoy: Rscript not found (install R + fitzRoy)")
        except subprocess.TimeoutExpired:
            steps.append("fitzRoy: timed out")
        except Exception as e:
            steps.append(f"fitzRoy: {e}")

        # 3. Clean names and filter detailed stats to current players only
        try:
            import re
            roster_df = pd.read_csv(os.path.join(config.DATA_DIR, "players.csv"))
            current_names = set(roster_df["name"].str.strip().str.lower())
            from scrapers.stats_loader import _NAME_FIXES
            trimmed = 0
            for year in range(2013, config.CURRENT_YEAR + 1):
                path = os.path.join(config.DATA_DIR, f"player_stats_{year}.csv")
                if not os.path.exists(path):
                    continue
                df = pd.read_csv(path)
                name_col = "Player" if "Player" in df.columns else None
                if name_col is None:
                    continue
                before = len(df)
                df[name_col] = df[name_col].apply(
                    lambda n: re.sub(r'\s*[\u2190-\u21ff\u2b00-\u2bff]+\s*$', '', str(n)).strip()
                    if isinstance(n, str) else str(n)
                )
                df[name_col] = df[name_col].apply(
                    lambda n: _NAME_FIXES.get(n.lower(), n)
                )
                df = df[df[name_col].str.strip().str.lower().isin(current_names)]
                df.to_csv(path, index=False)
                trimmed += before - len(df)
            steps.append(f"Filtered to current players (removed {trimmed:,} retired rows)")
        except Exception as e:
            steps.append(f"Filter: {e}")

        # 4. Backfill sc_avg from fitzRoy data for players missing it
        try:
            filled = backfill_sc_from_fitzroy()
            if filled > 0:
                steps.append(f"Backfilled SC avg for {filled} players from fitzRoy")
        except Exception as e:
            steps.append(f"SC backfill: {e}")

        # 5. Sync players.csv into AflPlayer DB table (force=True to bypass staleness)
        try:
            from models.database import AflPlayer
            _sync_players_to_db(app, force=True)
            total = AflPlayer.query.count()
            steps.append(f"DB sync: {total} players in AflPlayer table")
        except Exception as e:
            steps.append(f"DB sync FAILED: {e}")

        # 6. Re-sync ratings/potential from XLSX
        try:
            _sync_ratings_to_db(app)
            steps.append("Ratings synced from XLSX")
        except Exception as e:
            steps.append(f"Ratings sync: {e}")

        # 7. Pull AFL game schedule from Squiggle for current + next round
        try:
            from models.live_sync import sync_game_schedule
            from scrapers.squiggle import get_current_round

            year = config.CURRENT_YEAR
            current_round = get_current_round(year)
            if current_round is not None:
                count1 = sync_game_schedule(year, current_round)
                count2 = sync_game_schedule(year, current_round + 1)
                steps.append(f"Schedule: R{current_round}={count1} games, R{current_round+1}={count2} games")
            else:
                steps.append("Schedule: could not determine current round from Squiggle")
        except Exception as e:
            steps.append(f"Schedule sync: {e}")

        # 8. Ensure DB schema is up to date (idempotent)
        try:
            db.create_all()
            steps.append("Schema migration: OK")
        except Exception as e:
            steps.append(f"Schema migration: {e}")

        flash("Refresh complete — " + " | ".join(steps), "success")
        return redirect(url_for("settings"))

    @app.route("/push/vapid-key")
    def vapid_key():
        return jsonify({"publicKey": config.VAPID_PUBLIC_KEY})

    @app.route("/push/subscribe", methods=["POST"])
    @login_required
    def push_subscribe():
        data = request.get_json(silent=True) or {}
        subscription = data.get("subscription")
        if subscription:
            import json as _json
            current_user.push_subscription = _json.dumps(subscription)
            db.session.commit()
        return jsonify({"ok": True})

    @app.route("/import/players", methods=["POST"])
    def trigger_import_players():
        f = request.files.get("file")
        if not f or f.filename == "":
            flash("No file uploaded.", "warning")
            return redirect(url_for("settings"))
        filename = secure_filename(f.filename)
        if not filename.lower().endswith(".csv"):
            flash("Only CSV files are allowed.", "danger")
            return redirect(url_for("settings"))
        path = os.path.join(config.DATA_DIR, "import_temp.csv")
        os.makedirs(config.DATA_DIR, exist_ok=True)
        f.save(path)
        try:
            players = import_players_csv(path, merge=True)
            flash(f"Imported/merged — master list now has {len(players)} players.", "success")
        except Exception as e:
            app.logger.exception("Player import failed")
            flash("Import failed. Check the CSV format and try again.", "danger")
        return redirect(url_for("settings"))

    @app.route("/import/sc_scores", methods=["POST"])
    def trigger_import_sc():
        f = request.files.get("file")
        year = request.form.get("year", type=int) or config.CURRENT_YEAR
        if not f or f.filename == "":
            flash("No file uploaded.", "warning")
            return redirect(url_for("settings"))
        filename = secure_filename(f.filename)
        if not filename.lower().endswith(".csv"):
            flash("Only CSV files are allowed.", "danger")
            return redirect(url_for("settings"))
        path = os.path.join(config.DATA_DIR, "import_sc_temp.csv")
        os.makedirs(config.DATA_DIR, exist_ok=True)
        f.save(path)
        try:
            df = import_sc_scores_csv(path, year)
            flash(f"Imported {len(df)} SC score rows for {year}.", "success")
        except Exception as e:
            app.logger.exception("SC scores import failed")
            flash("Import failed. Check the CSV format and try again.", "danger")
        return redirect(url_for("settings"))

    return app


# Create the app instance and SocketIO
app = create_app()

_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
if _allowed_origins != "*":
    _allowed_origins = [o.strip() for o in _allowed_origins.split(",")]
socketio = SocketIO(app, async_mode="threading", cors_allowed_origins=_allowed_origins)

# Exempt SocketIO from CSRF (it uses its own origin check)
csrf.exempt("flask_socketio")

# Register SocketIO events
from sockets.draft_events import register_draft_events
from sockets.matchup_events import register_matchup_events
from sockets.notification_events import register_notification_events
register_draft_events(socketio)
register_matchup_events(socketio)
register_notification_events(socketio)

# Give notification_manager access to socketio for real-time pushes
from models.notification_manager import init_notification_socketio
init_notification_socketio(socketio)

from models.activity_feed import init_activity_socketio
init_activity_socketio(socketio)

# Start live scoring scheduler (skip in testing)
if not app.testing:
    from models.scheduler import init_scheduler
    init_scheduler(app, socketio)

if __name__ == "__main__":
    os.makedirs(config.DATA_DIR, exist_ok=True)
    os.makedirs(os.path.join(config.DATA_DIR, "league"), exist_ok=True)
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, debug=debug, port=port)

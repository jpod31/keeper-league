"""League management blueprint: create, list, dashboard, settings, scoring."""

import os
import re
from datetime import datetime

import pandas as pd
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam
from models.league_manager import (
    create_league, join_league, get_user_leagues, get_league_teams,
    set_custom_scoring, get_custom_scoring,
)
import config


def _round_sort_key(round_str):
    """Convert round string to a sortable integer.

    'Round 0' -> 0, 'Round 24' -> 24,
    Finals -> 25-28 so they sort after home-and-away.
    """
    m = re.match(r"Round\s+(\d+)", str(round_str))
    if m:
        return int(m.group(1))
    finals_order = {
        "Qualifying Final": 25, "Elimination Final": 26,
        "Semi Final": 27, "Preliminary Final": 28, "Grand Final": 29,
    }
    return finals_order.get(str(round_str), 99)


def _compute_rolling_averages():
    """Compute L3 and L5 rolling SC averages for all players.

    Uses current year (CURRENT_YEAR) data first, then fills from previous
    year so that rolling windows cross seasons seamlessly.
    Returns dict: player_name -> {'l3': float|None, 'l5': float|None}.
    """
    current_year = config.CURRENT_YEAR
    prev_year = current_year - 1

    frames = []
    for year in (prev_year, current_year):
        path = os.path.join(config.DATA_DIR, f"player_stats_{year}.csv")
        if os.path.exists(path):
            df = pd.read_csv(path, usecols=["Player", "Round", "SC", "Season"])
            df = df.dropna(subset=["SC"])
            df["_year"] = year
            df["_rnd"] = df["Round"].apply(_round_sort_key)
            frames.append(df)
        else:
            # No CSV for this year — pull from DB
            from models.database import PlayerStat, AflPlayer
            rows = (
                db.session.query(AflPlayer.name, PlayerStat.round, PlayerStat.supercoach_score)
                .join(AflPlayer, AflPlayer.id == PlayerStat.player_id)
                .filter(PlayerStat.year == year, PlayerStat.supercoach_score.isnot(None))
                .all()
            )
            if rows:
                df = pd.DataFrame(rows, columns=["Player", "Round", "SC"])
                df["Season"] = year
                df["_year"] = year
                df["_rnd"] = df["Round"]
                frames.append(df)

    if not frames:
        return {}

    all_scores = pd.concat(frames, ignore_index=True)
    all_scores = all_scores.sort_values(["_year", "_rnd"])

    result = {}
    for name, group in all_scores.groupby("Player"):
        scores = group["SC"].values  # already sorted chronologically
        n = len(scores)
        l3 = float(scores[-3:].mean()) if n >= 3 else (float(scores.mean()) if n else None)
        l5 = float(scores[-5:].mean()) if n >= 5 else (float(scores.mean()) if n else None)
        result[name] = {"l3": round(l3, 1) if l3 is not None else None,
                        "l5": round(l5, 1) if l5 is not None else None}

    return result

leagues_bp = Blueprint("leagues", __name__, url_prefix="/leagues",
                       template_folder="../templates")


@leagues_bp.route("/")
@login_required
def league_list():
    from models.database import Fixture, Trade, DraftSession, SeasonStanding

    leagues = get_user_leagues(current_user.id)

    # Build dashboard data for each league
    dashboard_data = []
    for lg in leagues:
        team = FantasyTeam.query.filter_by(league_id=lg.id, owner_id=current_user.id).first()
        entry = {"league": lg, "team": team}

        if team:
            # Next fixture (unplayed)
            next_fix = Fixture.query.filter(
                Fixture.league_id == lg.id,
                ((Fixture.home_team_id == team.id) | (Fixture.away_team_id == team.id)),
                Fixture.status == "scheduled",
            ).order_by(Fixture.afl_round).first()
            entry["next_fixture"] = next_fix

            # Last result (completed)
            last_fix = Fixture.query.filter(
                Fixture.league_id == lg.id,
                ((Fixture.home_team_id == team.id) | (Fixture.away_team_id == team.id)),
                Fixture.status == "completed",
            ).order_by(Fixture.afl_round.desc()).first()
            entry["last_result"] = last_fix

            # Standing
            standing = SeasonStanding.query.filter_by(
                league_id=lg.id, team_id=team.id, year=lg.season_year
            ).first()
            entry["standing"] = standing
        else:
            entry["next_fixture"] = None
            entry["last_result"] = None
            entry["standing"] = None

        # Pending trades across league
        pending_trades = Trade.query.filter_by(league_id=lg.id, status="pending").count()
        entry["pending_trades"] = pending_trades

        # Draft status
        draft = DraftSession.query.filter_by(
            league_id=lg.id, is_mock=False
        ).order_by(DraftSession.id.desc()).first()
        entry["draft"] = draft

        dashboard_data.append(entry)

    return render_template("leagues/list.html", leagues=leagues, dashboard_data=dashboard_data)


@leagues_bp.route("/create", methods=["GET", "POST"])
@login_required
def league_create():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        scoring_type = request.form.get("scoring_type", "supercoach")
        num_teams = request.form.get("num_teams", type=int) or 6
        squad_size = request.form.get("squad_size", type=int) or 38
        draft_type = request.form.get("draft_type", "snake")
        pick_timer = request.form.get("pick_timer_secs", type=int) or 120
        team_name = request.form.get("team_name", "").strip()
        form_vals = {
            "name": name, "scoring_type": scoring_type, "num_teams": num_teams,
            "squad_size": squad_size, "draft_type": draft_type,
            "pick_timer_secs": pick_timer, "team_name": team_name,
        }

        if not name:
            flash("League name is required.", "warning")
            return render_template("leagues/create.html", form=form_vals,
                                   available_stats=config.AVAILABLE_STATS,
                                   default_scoring=config.DEFAULT_CUSTOM_SCORING,
                                   stat_categories=config.STAT_CATEGORIES,
                                   scoring_presets=config.SCORING_PRESETS,
                                   default_uf_categories=config.DEFAULT_UF_CATEGORIES)

        # Read formation fields
        def_count = request.form.get("def_count", type=int) or 6
        mid_count = request.form.get("mid_count", type=int) or 9
        fwd_count = request.form.get("fwd_count", type=int) or 6
        ruc_count = request.form.get("ruc_count", type=int) or 1
        flex_count = request.form.get("flex_count", type=int) or 1
        position_slots = [
            ("DEF", def_count, False), ("MID", mid_count, False),
            ("FWD", fwd_count, False), ("RUC", ruc_count, False),
            ("FLEX", flex_count, True),
        ]
        on_field = def_count + mid_count + fwd_count + ruc_count

        hybrid_base = request.form.get("hybrid_base")
        try:
            league = create_league(
                name=name,
                commissioner_id=current_user.id,
                scoring_type=scoring_type,
                num_teams=num_teams,
                squad_size=squad_size,
                on_field_count=on_field,
                draft_type=draft_type,
                pick_timer_secs=pick_timer,
                position_slots=position_slots,
                hybrid_base=hybrid_base,
            )
        except Exception as e:
            db.session.rollback()
            flash(f"Failed to create league: {e}", "danger")
            return render_template("leagues/create.html", form=form_vals,
                                   available_stats=config.AVAILABLE_STATS,
                                   default_scoring=config.DEFAULT_CUSTOM_SCORING,
                                   stat_categories=config.STAT_CATEGORIES,
                                   scoring_presets=config.SCORING_PRESETS,
                                   default_uf_categories=config.DEFAULT_UF_CATEGORIES)

        # Hybrid weight/mode settings
        if scoring_type == "hybrid":
            hw = request.form.get("hybrid_base_weight", type=float)
            if hw is not None:
                league.hybrid_base_weight = max(0.0, min(1.0, hw))
            league.hybrid_custom_mode = request.form.get("hybrid_custom_mode", "points")
            db.session.commit()

        # Draft preferences
        league.draft_auto_randomize = "draft_auto_randomize" in request.form
        draft_date = request.form.get("draft_scheduled_date")
        if draft_date:
            try:
                league.draft_scheduled_date = datetime.fromisoformat(draft_date)
            except ValueError:
                pass
        db.session.commit()

        # Inline scoring rules (custom, hybrid, or ultimate_footy)
        if scoring_type == "ultimate_footy":
            uf_stats = request.form.getlist("uf_category")
            rules = {stat.strip(): 1 for stat in uf_stats if stat.strip()}
            if rules:
                set_custom_scoring(league.id, rules)
        elif scoring_type in ("custom", "hybrid"):
            stat_cols = request.form.getlist("stat_column")
            stat_pts = request.form.getlist("points_per")
            rules = {}
            for col, pts in zip(stat_cols, stat_pts):
                col = col.strip()
                if col:
                    try:
                        rules[col] = float(pts)
                    except (ValueError, TypeError):
                        rules[col] = 0
            if rules:
                set_custom_scoring(league.id, rules)

        # Auto-join the commissioner
        join_league(league.id, current_user.id,
                    team_name or f"{current_user.display_name}'s Team")

        # Auto-generate season config with mid/off-season settings
        from models.database import SeasonConfig, LockoutConfig
        if not SeasonConfig.query.filter_by(league_id=league.id, year=league.season_year).first():
            mid_draft = request.form.get("mid_season_draft_enabled") == "on"
            mid_draft_round = request.form.get("mid_season_draft_after_round", type=int)
            mid_draft_picks = request.form.get("mid_season_draft_picks", type=int) or 1
            offseason_delist = request.form.get("offseason_delist_min", type=int) or 3
            ssp = request.form.get("ssp_enabled") == "on"
            db.session.add(SeasonConfig(
                league_id=league.id,
                year=league.season_year,
                mid_season_draft_enabled=mid_draft,
                mid_season_draft_after_round=mid_draft_round,
                mid_season_draft_picks=mid_draft_picks,
                offseason_delist_min=offseason_delist,
                ssp_enabled=ssp,
            ))
        if not LockoutConfig.query.filter_by(league_id=league.id).first():
            db.session.add(LockoutConfig(league_id=league.id, lockout_type="game_start"))
        db.session.commit()

        from models.fixture_manager import generate_round_robin, generate_7s_round_robin
        generate_round_robin(league.id, league.season_year, num_rounds=23)
        generate_7s_round_robin(league.id, league.season_year, num_rounds=23)

        flash(f"League '{league.name}' created!", "success")
        return redirect(url_for("leagues.dashboard", league_id=league.id))

    return render_template("leagues/create.html", form={},
                           available_stats=config.AVAILABLE_STATS,
                           default_scoring=config.DEFAULT_CUSTOM_SCORING,
                           stat_categories=config.STAT_CATEGORIES,
                           scoring_presets=config.SCORING_PRESETS,
                           default_uf_categories=config.DEFAULT_UF_CATEGORIES)


@leagues_bp.route("/<int:league_id>")
@login_required
def dashboard(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    # Default to My Team view if user has a team
    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if user_team and not request.args.get("overview"):
        return redirect(url_for("team.squad", league_id=league_id, team_id=user_team.id))

    teams = get_league_teams(league_id)
    is_commissioner = league.commissioner_id == current_user.id
    scoring_rules = get_custom_scoring(league_id) if league.scoring_type in ("custom", "hybrid", "ultimate_footy") else {}

    return render_template("leagues/dashboard.html",
                           league=league,
                           teams=teams,
                           user_team=user_team,
                           is_commissioner=is_commissioner,
                           scoring_rules=scoring_rules)


@leagues_bp.route("/<int:league_id>/join", methods=["POST"])
@login_required
def league_join(league_id):
    team_name = request.form.get("team_name", "").strip()
    if not team_name:
        flash("Team name is required.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    team, error = join_league(league_id, current_user.id, team_name)
    if error:
        flash(error, "danger")
    else:
        flash(f"Joined with team '{team.name}'!", "success")
    return redirect(url_for("leagues.dashboard", league_id=league_id))


@leagues_bp.route("/join-by-code", methods=["POST"])
@login_required
def league_join_by_code():
    """Redirect to the invite page for a given invite code."""
    code = request.form.get("invite_code", "").strip().upper()
    if not code:
        flash("Please enter an invite code.", "warning")
        return redirect(url_for("leagues.league_list"))
    league = League.query.filter_by(invite_code=code).first()
    if not league:
        flash("Invalid invite code. Check with your commissioner.", "warning")
        return redirect(url_for("leagues.league_list"))
    return redirect(url_for("leagues.league_invite", code=code))


@leagues_bp.route("/invite/<code>", methods=["GET", "POST"])
def league_invite(code):
    """Public invite page — anyone with the link can view and join."""
    from flask_login import current_user as cu
    league = League.query.filter_by(invite_code=code).first()
    if not league:
        flash("Invalid or expired invite link.", "warning")
        return redirect(url_for("auth.login"))

    # If not logged in, redirect to login with next= back here
    if not cu.is_authenticated:
        flash("Log in or create an account to join this league.", "info")
        return redirect(url_for("auth.login", next=url_for("leagues.league_invite", code=code)))

    # Check if already a member
    existing = FantasyTeam.query.filter_by(league_id=league.id, owner_id=cu.id).first()
    if existing:
        flash("You're already in this league!", "info")
        return redirect(url_for("leagues.dashboard", league_id=league.id))

    if request.method == "POST":
        team_name = request.form.get("team_name", "").strip()
        if not team_name:
            flash("Team name is required.", "warning")
            return render_template("leagues/invite.html", league=league, code=code)

        team, error = join_league(league.id, cu.id, team_name)
        if error:
            flash(error, "danger")
            return render_template("leagues/invite.html", league=league, code=code)
        flash(f"Joined '{league.name}' with team '{team.name}'!", "success")
        return redirect(url_for("leagues.dashboard", league_id=league.id))

    return render_template("leagues/invite.html", league=league, code=code)



# ── Register route sub-modules (must be after leagues_bp is defined) ──────
from blueprints import leagues_settings      # noqa: F401, E402
from blueprints import leagues_season        # noqa: F401, E402
from blueprints import leagues_players       # noqa: F401, E402
from blueprints import leagues_commissioner  # noqa: F401, E402

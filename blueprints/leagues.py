"""League management blueprint: create, list, dashboard, settings, scoring."""

import os
import re
from datetime import datetime, timezone, timedelta

import pandas as pd
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, FantasyRoster, AflPlayer, UserDraftWeights, LeagueDraftWeights, LiveScoringConfig, DraftPick, DraftSession
from models.league_manager import (
    create_league, join_league, get_user_leagues, get_league_teams,
    set_custom_scoring, get_custom_scoring, update_league_settings,
    update_position_slots, update_draft_weights,
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
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path, usecols=["Player", "Round", "SC", "Season"])
        df = df.dropna(subset=["SC"])
        df["_year"] = year
        df["_rnd"] = df["Round"].apply(_round_sort_key)
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
        def_count = request.form.get("def_count", type=int) or 5
        mid_count = request.form.get("mid_count", type=int) or 7
        fwd_count = request.form.get("fwd_count", type=int) or 5
        ruc_count = request.form.get("ruc_count", type=int) or 1
        bench_def = request.form.get("bench_def", type=int) or 1
        bench_mid = request.form.get("bench_mid", type=int) or 2
        bench_fwd = request.form.get("bench_fwd", type=int) or 1
        bench_flex = request.form.get("bench_flex", type=int) or 1
        position_slots = [
            ("DEF", def_count, False), ("MID", mid_count, False),
            ("FWD", fwd_count, False), ("RUC", ruc_count, False),
            ("DEF", bench_def, True), ("MID", bench_mid, True),
            ("FWD", bench_fwd, True), ("FLEX", bench_flex, True),
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

        from models.fixture_manager import generate_round_robin
        generate_round_robin(league.id, league.season_year, num_rounds=23)

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


@leagues_bp.route("/<int:league_id>/settings", methods=["GET", "POST"])
@login_required
def league_settings(league_id):
    from blueprints import check_league_access
    league, _user_team = check_league_access(league_id)
    if not league:
        flash("League not found or you don't have access.", "warning")
        return redirect(url_for("leagues.league_list"))

    is_commissioner = league.commissioner_id == current_user.id

    if request.method == "POST" and not is_commissioner:
        flash("Only the commissioner can edit league settings.", "warning")
        return redirect(url_for("leagues.league_settings", league_id=league_id))

    if request.method == "POST":
        # Block draft-critical setting changes while a draft exists
        from models.database import DraftSession
        active_draft = DraftSession.query.filter_by(
            league_id=league_id, is_mock=False
        ).filter(DraftSession.status.in_(["scheduled", "in_progress", "paused"])).first()

        new_num_teams = request.form.get("num_teams", type=int) or league.num_teams
        new_squad_size = request.form.get("squad_size", type=int) or league.squad_size
        new_draft_type = request.form.get("draft_type", league.draft_type)

        if active_draft:
            changed = []
            if new_num_teams != league.num_teams:
                changed.append("Max Teams")
            if new_squad_size != league.squad_size:
                changed.append("Squad Size")
            if new_draft_type != league.draft_type:
                changed.append("Draft Type")
            if changed:
                flash(
                    f"Cannot change {', '.join(changed)} while a draft is active. "
                    "Delete the draft session first from Draft Setup.",
                    "warning",
                )
                return redirect(url_for("leagues.league_settings", league_id=league_id))

        update_league_settings(
            league_id,
            name=request.form.get("name", league.name).strip(),
            num_teams=new_num_teams,
            squad_size=new_squad_size,
            draft_type=new_draft_type,
            pick_timer_secs=request.form.get("pick_timer_secs", type=int) or league.pick_timer_secs,
            delist_minimum=request.form.get("delist_minimum", type=int) or league.delist_minimum,
        )

        # Live scoring config
        live_config = LiveScoringConfig.query.get(league_id)
        if not live_config:
            live_config = LiveScoringConfig(league_id=league_id)
            db.session.add(live_config)
        live_config.enabled = request.form.get("live_scoring_enabled") == "on"
        live_config.lockout_type = request.form.get("lockout_type", "game_start")
        db.session.commit()

        # Season / fixture config
        from models.database import SeasonConfig
        season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
        if not season_cfg:
            season_cfg = SeasonConfig(league_id=league_id, year=league.season_year)
            db.session.add(season_cfg)
        num_fixture_rounds = request.form.get("num_fixture_rounds", type=int)
        if num_fixture_rounds:
            season_cfg.num_regular_rounds = num_fixture_rounds
        finals_teams = request.form.get("finals_teams", type=int)
        if finals_teams is not None:
            season_cfg.finals_teams = finals_teams

        # Mid-season config (single toggle — trade follows draft toggle)
        mid_enabled = request.form.get("mid_season_draft_enabled") == "on"
        season_cfg.mid_season_draft_enabled = mid_enabled
        season_cfg.mid_season_trade_enabled = mid_enabled
        trade_mode = request.form.get("mid_season_trade_mode", "window")
        if trade_mode in ("all_year", "until_round", "window"):
            season_cfg.mid_season_trade_mode = trade_mode
            season_cfg.trades_all_year = (trade_mode == "all_year")  # keep legacy in sync
        trade_until = request.form.get("mid_season_trade_until_round", type=int)
        if trade_until is not None:
            season_cfg.mid_season_trade_until_round = max(1, min(24, trade_until))
        mid_round = request.form.get("mid_season_draft_after_round", type=int)
        if mid_round is not None:
            season_cfg.mid_season_draft_after_round = max(1, min(24, mid_round))
            season_cfg.mid_season_trade_after_round = season_cfg.mid_season_draft_after_round

        # SSP config
        season_cfg.ssp_enabled = request.form.get("ssp_enabled") == "on"
        ssp_cutoff = request.form.get("ssp_cutoff_round", type=int)
        if ssp_cutoff is not None:
            season_cfg.ssp_cutoff_round = max(1, min(24, ssp_cutoff))
        ssp_slots = request.form.get("ssp_slots", type=int)
        if ssp_slots is not None:
            season_cfg.ssp_slots = max(0, min(5, ssp_slots))

        db.session.commit()

        # Formation + bench position slots
        def_count = request.form.get("def_count", type=int)
        mid_count = request.form.get("mid_count", type=int)
        fwd_count = request.form.get("fwd_count", type=int)
        ruc_count = request.form.get("ruc_count", type=int)
        bench_def = request.form.get("bench_def", type=int)
        bench_mid = request.form.get("bench_mid", type=int)
        bench_fwd = request.form.get("bench_fwd", type=int)
        bench_flex = request.form.get("bench_flex", type=int)

        if any(v is not None for v in [def_count, mid_count, fwd_count, ruc_count]):
            d = def_count if def_count is not None else 5
            m = mid_count if mid_count is not None else 7
            f = fwd_count if fwd_count is not None else 5
            r = ruc_count if ruc_count is not None else 1
            bd = bench_def if bench_def is not None else 1
            bm = bench_mid if bench_mid is not None else 2
            bf = bench_fwd if bench_fwd is not None else 1
            bx = bench_flex if bench_flex is not None else 1
            total_positions = d + m + f + r + bd + bm + bf + bx

            # Reload league to get potentially-updated squad_size
            db.session.refresh(league)
            if total_positions > league.squad_size:
                flash(
                    f"Total positions ({total_positions}) exceed squad size ({league.squad_size}). "
                    "Reduce formation/bench or increase squad size.",
                    "warning",
                )
                return redirect(url_for("leagues.league_settings", league_id=league_id))

            slots = [
                {"position_code": "DEF", "count": d, "is_bench": False},
                {"position_code": "MID", "count": m, "is_bench": False},
                {"position_code": "FWD", "count": f, "is_bench": False},
                {"position_code": "RUC", "count": r, "is_bench": False},
                {"position_code": "DEF", "count": bd, "is_bench": True},
                {"position_code": "MID", "count": bm, "is_bench": True},
                {"position_code": "FWD", "count": bf, "is_bench": True},
                {"position_code": "FLEX", "count": bx, "is_bench": True},
            ]
            update_position_slots(league_id, slots)
            on_field = d + m + f + r
            update_league_settings(league_id, on_field_count=on_field)

        flash("League settings updated.", "success")
        return redirect(url_for("leagues.league_settings", league_id=league_id))

    live_config = LiveScoringConfig.query.get(league_id)
    from models.database import SeasonConfig, DraftSession
    season_config = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    has_active_draft = DraftSession.query.filter_by(
        league_id=league_id, is_mock=False
    ).filter(DraftSession.status.in_(["scheduled", "in_progress", "paused"])).first() is not None
    return render_template("leagues/settings.html", league=league, live_config=live_config,
                           season_config=season_config, is_commissioner=is_commissioner,
                           has_active_draft=has_active_draft)


@leagues_bp.route("/<int:league_id>/scoring", methods=["GET", "POST"])
@login_required
def league_scoring(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    if league.commissioner_id != current_user.id:
        flash("Only the commissioner can edit scoring rules.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    if request.method == "POST":
        scoring_type = request.form.get("scoring_type", league.scoring_type)
        league.scoring_type = scoring_type

        # Hybrid base selector + weight/mode
        if scoring_type == "hybrid":
            league.hybrid_base = request.form.get("hybrid_base", "supercoach")
            hw = request.form.get("hybrid_base_weight", type=float)
            if hw is not None:
                league.hybrid_base_weight = max(0.0, min(1.0, hw))
            league.hybrid_custom_mode = request.form.get("hybrid_custom_mode", "points")
        db.session.commit()

        if scoring_type == "ultimate_footy":
            uf_stats = request.form.getlist("uf_category")
            rules = {stat.strip(): 1 for stat in uf_stats if stat.strip()}
            set_custom_scoring(league_id, rules)
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
            set_custom_scoring(league_id, rules)

        flash("Scoring settings updated.", "success")
        return redirect(url_for("leagues.league_scoring", league_id=league_id))

    scoring_rules = get_custom_scoring(league_id)

    return render_template("leagues/scoring.html",
                           league=league,
                           scoring_rules=scoring_rules,
                           available_stats=config.AVAILABLE_STATS,
                           default_scoring=config.DEFAULT_CUSTOM_SCORING,
                           stat_categories=config.STAT_CATEGORIES,
                           scoring_presets=config.SCORING_PRESETS,
                           scoring_type_labels=config.SCORING_TYPE_LABELS,
                           default_uf_categories=config.DEFAULT_UF_CATEGORIES)


@leagues_bp.route("/<int:league_id>/sync-now", methods=["POST"])
@login_required
def sync_now(league_id):
    """Quick sync: pull AFL game schedule from Squiggle for current + next round."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    if league.commissioner_id != current_user.id:
        flash("Only the commissioner can sync game data.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    try:
        from models.live_sync import sync_game_schedule
        from scrapers.squiggle import get_current_round

        year = config.CURRENT_YEAR
        current_round = get_current_round(year)
        if current_round is None:
            flash("Could not determine the current AFL round from Squiggle.", "warning")
            return redirect(url_for("leagues.league_settings", league_id=league_id))

        count1 = sync_game_schedule(year, current_round)
        count2 = sync_game_schedule(year, current_round + 1)
        flash(
            f"Synced {count1} games for R{current_round}, {count2} games for R{current_round + 1}.",
            "success",
        )
    except Exception as e:
        flash(f"Schedule sync failed: {e}", "danger")

    return redirect(url_for("leagues.league_settings", league_id=league_id))


@leagues_bp.route("/<int:league_id>/regenerate-fixtures", methods=["POST"])
@login_required
def regenerate_fixtures(league_id):
    """Commissioner regenerates the season fixture."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    if league.commissioner_id != current_user.id:
        flash("Only the commissioner can generate fixtures.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    from models.database import SeasonConfig
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    num_rounds = int(request.form.get("num_rounds", 23))

    from models.fixture_manager import generate_round_robin
    fixtures, error = generate_round_robin(league_id, league.season_year, num_rounds)

    # Support AJAX requests (no page reload)
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        if error:
            return {"ok": False, "message": error}, 400
        return {"ok": True, "message": f"Generated {len(fixtures)} fixtures across {num_rounds} rounds."}

    if error:
        flash(error, "danger")
    else:
        flash(f"Generated {len(fixtures)} fixtures across {num_rounds} rounds.", "success")
    return redirect(url_for("leagues.league_settings", league_id=league_id))


@leagues_bp.route("/<int:league_id>/finalize-round/<int:afl_round>", methods=["POST"])
@login_required
def finalize_round_route(league_id, afl_round):
    """Commissioner triggers end-of-round scoring, fixture resolution, standings update."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    if league.commissioner_id != current_user.id:
        flash("Only the commissioner can finalize rounds.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    try:
        from models.scoring_engine import finalize_round
        scores = finalize_round(league_id, afl_round, league.season_year)
        flash(f"Round {afl_round} finalized. {len(scores)} teams scored.", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Failed to finalize round: {e}", "danger")

    return redirect(url_for("matchups.standings", league_id=league_id))


@leagues_bp.route("/<int:league_id>/draft-values", methods=["GET", "POST"])
@login_required
def draft_values(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        flash("You need a team in this league to set draft values.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    # Load user's personal weights (or league defaults)
    user_weights = UserDraftWeights.query.filter_by(
        user_id=current_user.id, league_id=league_id
    ).first()
    league_weights = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
    has_custom = user_weights is not None

    active_weights = user_weights.to_dict() if user_weights else (
        league_weights.to_dict() if league_weights else config.DRAFT_WEIGHTS.copy()
    )

    if request.method == "POST":
        action = request.form.get("action")

        if action == "reset":
            # Delete user's custom weights (revert to league defaults)
            if user_weights:
                db.session.delete(user_weights)
                db.session.commit()
            flash("Draft values reset to league defaults.", "info")
            return redirect(url_for("leagues.draft_values", league_id=league_id))

        # Save custom weights
        weight_keys = ["sc_average", "age_factor", "positional_scarcity", "trajectory", "durability", "rating_potential"]
        new_weights = {}
        for k in weight_keys:
            val = request.form.get(k, type=float)
            new_weights[k] = val if val is not None else active_weights.get(k, 0.2)

        # Normalise to sum to 1.0
        total = sum(new_weights.values())
        if total > 0:
            for k in new_weights:
                new_weights[k] = round(new_weights[k] / total, 4)

        if not user_weights:
            user_weights = UserDraftWeights(user_id=current_user.id, league_id=league_id)
            db.session.add(user_weights)

        for k, v in new_weights.items():
            setattr(user_weights, k, v)
        db.session.commit()

        flash("Your draft values have been saved.", "success")
        return redirect(url_for("leagues.draft_values", league_id=league_id))

    # Build top-ranked preview (top 20 players)
    from models.draft_model import rank_players_for_user
    ranked = rank_players_for_user(league_id, current_user.id)
    top_players = ranked[:20]

    return render_template("leagues/draft_values.html",
                           league=league,
                           weights=active_weights,
                           has_custom=has_custom,
                           top_players=top_players)


@leagues_bp.route("/<int:league_id>/draft-values/preview")
@login_required
def draft_values_preview(league_id):
    """JSON endpoint: preview top-20 players under custom weight sliders."""
    from models.database import AflPlayer
    from models.player import orm_to_player
    from models.draft_model import rank_players, FACTOR_FNS

    league = db.session.get(League, league_id)
    if not league:
        return jsonify([])

    weight_keys = ["sc_average", "age_factor", "positional_scarcity", "trajectory", "durability", "rating_potential"]
    weights = {}
    for k in weight_keys:
        weights[k] = request.args.get(k, type=float) or 0.2
    total = sum(weights.values())
    if total > 0:
        for k in weights:
            weights[k] = weights[k] / total

    afl_players = AflPlayer.query.all()
    if not afl_players:
        return jsonify([])

    players = [orm_to_player(ap) for ap in afl_players]

    # If custom/hybrid scoring, override SC avg; if AFL Fantasy, use AF averages
    if league.scoring_type in ("custom", "hybrid"):
        from models.database import CustomScoringRule
        from models.draft_model import _apply_custom_sc_projection
        rules = CustomScoringRule.query.filter_by(league_id=league_id).all()
        if rules:
            _apply_custom_sc_projection(players, afl_players, rules)
    elif league.scoring_type == "afl_fantasy":
        from models.draft_model import _apply_af_projection
        _apply_af_projection(players, afl_players)

    rank_players(players, weights)

    name_team_to_afl = {(ap.name, ap.afl_team): ap for ap in afl_players}
    result = []
    for p in players[:20]:
        ap = name_team_to_afl.get((p.name, p.team))
        if ap:
            result.append({
                "name": ap.name,
                "afl_team": ap.afl_team,
                "position": ap.position,
                "sc_avg": ap.sc_avg,
                "draft_score": p.draft_score,
            })

    return jsonify(result)


@leagues_bp.route("/<int:league_id>/season")
@login_required
def season_hub(league_id):
    """Unified season hub showing draft, mid-season, and off-season lifecycle."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    from models.database import (
        SeasonConfig, DelistPeriod, DraftSession, LongTermInjury, DelistAction, Trade,
    )
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    if not season_cfg:
        season_cfg = SeasonConfig(league_id=league_id, year=league.season_year)
        db.session.add(season_cfg)
        db.session.commit()
    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    is_commissioner = league.commissioner_id == current_user.id

    # ── Current phase ──
    if league.status in ("setup", "drafting"):
        current_phase = "pre_season"
    elif league.status == "active" and season_cfg and season_cfg.season_phase == "midseason":
        current_phase = "midseason"
    elif league.status == "active":
        current_phase = "regular"
    elif league.status == "finals":
        current_phase = "finals"
    elif league.status == "offseason":
        current_phase = "offseason"
    else:
        current_phase = "pre_season"

    # ── Trade window dates for template ──
    now = datetime.now(timezone.utc)
    trade_window_dates = {
        "mid_open": season_cfg.mid_trade_window_open,
        "mid_close": season_cfg.mid_trade_window_close,
        "mid_draft": season_cfg.mid_draft_date,
        "off_open": season_cfg.off_trade_window_open,
        "off_close": season_cfg.off_trade_window_close,
    }

    # ── Draft data ──
    draft_sessions = DraftSession.query.filter_by(
        league_id=league_id, is_mock=False
    ).order_by(DraftSession.id).all()

    initial_draft = None
    supplemental_drafts = []
    for ds in draft_sessions:
        if ds.draft_round_type == "initial":
            initial_draft = ds
        elif ds.draft_round_type == "supplemental":
            supplemental_drafts.append(ds)

    # ── Mid-season step statuses ──
    mid_trade_status = "locked"
    if season_cfg and season_cfg.season_phase == "midseason":
        if season_cfg.mid_trade_window_open and season_cfg.mid_trade_window_close:
            if now < season_cfg.mid_trade_window_close:
                mid_trade_status = "active"
            else:
                mid_trade_status = "completed"
        elif league.trade_window_open:
            mid_trade_status = "active"
        elif season_cfg.mid_trade_window_close:
            mid_trade_status = "completed"

    mid_delist_status = "locked"
    delist_period = DelistPeriod.query.filter_by(
        league_id=league_id, year=league.season_year
    ).order_by(DelistPeriod.id.desc()).first()
    if current_phase == "midseason":
        if delist_period and delist_period.status == "open":
            mid_delist_status = "active"
        elif mid_trade_status == "completed":
            mid_delist_status = "pending"

    mid_draft_status = "locked"
    if season_cfg and season_cfg.mid_season_draft_enabled:
        mid_supp = DraftSession.query.filter_by(
            league_id=league_id, draft_round_type="supplemental", is_mock=False
        ).order_by(DraftSession.id.desc()).first()
        if mid_supp and mid_supp.status == "in_progress" and current_phase == "midseason":
            mid_draft_status = "active"
        elif mid_supp and mid_supp.status == "completed" and current_phase == "midseason":
            mid_draft_status = "completed"
        elif (mid_delist_status == "completed" or (delist_period and delist_period.status == "closed")) and current_phase == "midseason":
            mid_draft_status = "pending"

    mid_lock_status = "locked"
    if mid_draft_status == "completed":
        mid_lock_status = "completed"

    # ── Off-season step statuses ──
    off_delist_status = "pending" if current_phase == "offseason" else "locked"
    if current_phase == "offseason":
        if delist_period and delist_period.status == "open":
            off_delist_status = "active"
        elif delist_period and delist_period.status == "closed":
            off_delist_status = "completed"

    off_ssp_status = "locked"
    ltil_entries = []
    if season_cfg and season_cfg.ssp_enabled:
        ltil_entries = LongTermInjury.query.filter_by(
            league_id=league_id, year=league.season_year, removed_at=None
        ).all()
        if off_delist_status == "completed":
            off_ssp_status = "active" if ltil_entries else "completed"

    off_draft_status = "locked"
    off_supp = DraftSession.query.filter_by(
        league_id=league_id, draft_round_type="supplemental", is_mock=False
    ).order_by(DraftSession.id.desc()).first()
    if current_phase == "offseason":
        if off_supp and off_supp.status == "in_progress":
            off_draft_status = "active"
        elif off_supp and off_supp.status == "completed":
            off_draft_status = "completed"
        elif off_delist_status == "completed" and off_ssp_status in ("completed", "locked"):
            off_draft_status = "pending"

    off_trade_status = "locked"
    if current_phase == "offseason":
        if season_cfg.off_trade_window_open and season_cfg.off_trade_window_close:
            if now < season_cfg.off_trade_window_close:
                off_trade_status = "active"
            else:
                off_trade_status = "completed"
        elif league.trade_window_open:
            off_trade_status = "active"
        else:
            off_trade_status = "pending"

    # ── Team delist count ──
    team_delist_count = 0
    if user_team and delist_period:
        team_delist_count = DelistAction.query.filter_by(
            delist_period_id=delist_period.id, team_id=user_team.id
        ).count()

    # ── User roster for inline delist management ──
    user_roster = []
    delisted_player_ids = set()
    if user_team:
        user_roster = (
            FantasyRoster.query
            .filter_by(team_id=user_team.id, is_active=True)
            .join(AflPlayer, FantasyRoster.player_id == AflPlayer.id)
            .order_by(AflPlayer.position, AflPlayer.sc_avg.desc())
            .all()
        )
        if delist_period:
            from models.database import DelistAction
            delisted_actions = DelistAction.query.filter_by(
                delist_period_id=delist_period.id, team_id=user_team.id
            ).all()
            delisted_player_ids = {a.player_id for a in delisted_actions}

    # ── Delist inline data ──
    min_delists = 3
    if delist_period and delist_period.min_delists:
        min_delists = delist_period.min_delists
    elif season_cfg:
        if current_phase == "midseason" and season_cfg.mid_season_delist_required:
            min_delists = season_cfg.mid_season_delist_required
        elif season_cfg.offseason_delist_min:
            min_delists = season_cfg.offseason_delist_min

    all_teams_progress = []
    if is_commissioner and delist_period and delist_period.status == "open":
        teams = FantasyTeam.query.filter_by(league_id=league_id).all()
        for t in teams:
            count = DelistAction.query.filter_by(
                delist_period_id=delist_period.id, team_id=t.id
            ).count()
            all_teams_progress.append({
                "name": t.name,
                "owner": t.owner.display_name if t.owner else "?",
                "count": count,
                "met": count >= min_delists,
            })

    is_midseason = (league.status == "active" and season_cfg
                    and season_cfg.season_phase == "midseason")
    close_route = ("leagues.midseason_start_step" if is_midseason
                   else "leagues.offseason_start_step")

    # ── Mock draft ──
    mock_draft = DraftSession.query.filter_by(league_id=league_id, is_mock=True).first()

    # ── Trade data ──
    pending_incoming = 0
    pending_outgoing = 0
    recent_trades = []
    if user_team:
        pending_incoming = Trade.query.filter_by(
            league_id=league_id, recipient_team_id=user_team.id, status="pending"
        ).count()
        pending_outgoing = Trade.query.filter_by(
            league_id=league_id, proposer_team_id=user_team.id, status="pending"
        ).count()
    recent_trades = Trade.query.filter_by(league_id=league_id).order_by(
        Trade.proposed_at.desc()
    ).limit(5).all()

    return render_template("leagues/season_hub.html",
                           league=league,
                           season_cfg=season_cfg,
                           user_team=user_team,
                           is_commissioner=is_commissioner,
                           current_phase=current_phase,
                           initial_draft=initial_draft,
                           supplemental_drafts=supplemental_drafts,
                           mid_trade_status=mid_trade_status,
                           mid_delist_status=mid_delist_status,
                           mid_draft_status=mid_draft_status,
                           mid_lock_status=mid_lock_status,
                           off_delist_status=off_delist_status,
                           off_ssp_status=off_ssp_status,
                           off_draft_status=off_draft_status,
                           off_trade_status=off_trade_status,
                           delist_period=delist_period,
                           team_delist_count=team_delist_count,
                           min_delists=min_delists,
                           all_teams_progress=all_teams_progress,
                           close_route=close_route,
                           ltil_entries=ltil_entries,
                           pending_incoming=pending_incoming,
                           pending_outgoing=pending_outgoing,
                           recent_trades=recent_trades,
                           user_roster=user_roster,
                           delisted_player_ids=delisted_player_ids,
                           trade_window_dates=trade_window_dates,
                           mock_draft=mock_draft,
                           rolling=_compute_rolling_averages())


@leagues_bp.route("/<int:league_id>/season/auto-transition", methods=["POST"])
@login_required
def save_auto_transition(league_id):
    """Save season automation settings (commissioner only)."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can change automation settings.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    from models.season_manager import get_or_create_season_config
    from datetime import datetime as dt

    cfg = get_or_create_season_config(league_id, league.season_year)
    cfg.auto_transition_enabled = "auto_transition_enabled" in request.form

    season_start = request.form.get("season_start_date", "").strip()
    offseason_start = request.form.get("offseason_start_date", "").strip()
    finals_round = request.form.get("finals_start_round", type=int)

    if season_start:
        try:
            cfg.season_start_date = dt.strptime(season_start, "%Y-%m-%d")
        except ValueError:
            pass
    else:
        cfg.season_start_date = None

    if offseason_start:
        try:
            cfg.offseason_start_date = dt.strptime(offseason_start, "%Y-%m-%d")
        except ValueError:
            pass
    else:
        cfg.offseason_start_date = None

    cfg.finals_start_round = finals_round
    db.session.commit()
    flash("Season automation settings saved.", "success")
    return redirect(url_for("leagues.season_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/midseason")
@login_required
def midseason_hub(league_id):
    """Redirect to unified season hub."""
    return redirect(url_for("leagues.season_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/midseason/start-step", methods=["POST"])
@login_required
def midseason_start_step(league_id):
    """Commissioner starts a mid-season step."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can manage season steps.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    from models.database import SeasonConfig
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    if not season_cfg:
        season_cfg = SeasonConfig(league_id=league_id, year=league.season_year)
        db.session.add(season_cfg)
        db.session.commit()

    step = request.form.get("step")

    if step == "trade_window":
        now = datetime.now(timezone.utc)
        trade_days = season_cfg.mid_trade_duration_days or 2
        duration = timedelta(days=trade_days)
        season_cfg.season_phase = "midseason"
        season_cfg.mid_trade_window_open = now
        season_cfg.mid_trade_window_close = now + duration
        season_cfg.mid_draft_date = now + duration + timedelta(days=1)
        db.session.commit()

        # Auto-execute agreed trades intended for mid-season
        from models.database import Trade
        from models.trade_manager import _execute_trade
        agreed_trades = Trade.query.filter_by(
            league_id=league_id, status="agreed", intended_period="midseason"
        ).all()
        executed_count = 0
        for t in agreed_trades:
            _execute_trade(t)
            t.status = "accepted"
            executed_count += 1
        if executed_count:
            db.session.commit()
            flash(f"Mid-season trade window is now open (closes {season_cfg.mid_trade_window_close.strftime('%d %b %Y')}). {executed_count} agreed trade(s) auto-executed.", "success")
        else:
            flash(f"Mid-season trade window is now open (closes {season_cfg.mid_trade_window_close.strftime('%d %b %Y')}).", "success")

    elif step == "close_trades":
        season_cfg.mid_trade_window_close = datetime.now(timezone.utc)
        db.session.commit()
        flash("Mid-season trade window closed.", "info")

    elif step == "amend_draft_date":
        draft_date_str = request.form.get("draft_date")
        if draft_date_str:
            try:
                new_date = datetime.fromisoformat(draft_date_str).replace(tzinfo=timezone.utc)
                if season_cfg.mid_trade_window_close and new_date < season_cfg.mid_trade_window_close:
                    flash("Draft date must be after the trade window closes.", "warning")
                else:
                    season_cfg.mid_draft_date = new_date
                    db.session.commit()
                    flash(f"Draft date updated to {new_date.strftime('%d %b %Y %H:%M')}.", "success")
            except ValueError:
                flash("Invalid date format.", "warning")

    elif step == "open_delists":
        if season_cfg.season_phase != "midseason":
            flash("Delists can only be opened during mid-season.", "warning")
        else:
            from models.season_manager import open_delist_period
            min_delists = season_cfg.mid_season_delist_required or 1
            delist_days = season_cfg.mid_delist_duration_days or 2
            closes_at = datetime.now(timezone.utc) + timedelta(days=delist_days)
            _, error = open_delist_period(league_id, league.season_year,
                                          min_delists=min_delists, closes_at=closes_at)
            if error:
                flash(error, "warning")
            else:
                flash(f"Delist period opened (closes {closes_at.strftime('%d %b %Y')}).", "success")

    elif step == "close_delists":
        from models.database import DelistPeriod
        period = DelistPeriod.query.filter_by(
            league_id=league_id, year=league.season_year, status="open"
        ).first()
        if period:
            from models.season_manager import close_delist_period
            _, error = close_delist_period(period.id)
            if error:
                flash(error, "warning")
            else:
                flash("Delist period closed.", "success")

    elif step == "roster_lock":
        season_cfg.season_phase = "regular"
        db.session.commit()
        flash("Rosters locked. Season resumed.", "success")

    return redirect(url_for("leagues.season_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/offseason")
@login_required
def offseason_hub(league_id):
    """Redirect to unified season hub."""
    return redirect(url_for("leagues.season_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/offseason/start-step", methods=["POST"])
@login_required
def offseason_start_step(league_id):
    """Commissioner starts an off-season step."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can manage season steps.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    from models.database import SeasonConfig
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    if not season_cfg:
        season_cfg = SeasonConfig(league_id=league_id, year=league.season_year)
        db.session.add(season_cfg)
        db.session.commit()

    step = request.form.get("step")

    if step == "open_delists":
        # Don't allow off-season delists during setup/drafting (pre-season)
        if league.status in ("setup", "drafting"):
            flash("Off-season delists can't be opened before the season starts.", "warning")
            return redirect(url_for("leagues.season_hub", league_id=league_id))
        season_cfg.season_phase = "offseason"
        league.status = "offseason"
        min_delists = season_cfg.offseason_delist_min or 3
        delist_days = season_cfg.off_delist_duration_days or 7
        closes_at = datetime.now(timezone.utc) + timedelta(days=delist_days)
        from models.season_manager import open_delist_period
        _, error = open_delist_period(league_id, league.season_year,
                                      min_delists=min_delists, closes_at=closes_at)
        if error:
            flash(error, "warning")
        else:
            flash(f"Off-season delist period opened (closes {closes_at.strftime('%d %b %Y')}).", "success")

    elif step == "close_delists":
        from models.database import DelistPeriod
        period = DelistPeriod.query.filter_by(
            league_id=league_id, year=league.season_year, status="open"
        ).first()
        if period:
            from models.season_manager import close_delist_period
            _, error = close_delist_period(period.id)
            if error:
                flash(error, "warning")
            else:
                flash("Delist period closed.", "success")

    elif step == "open_trades":
        now = datetime.now(timezone.utc)
        trade_days = season_cfg.off_trade_duration_days or 7
        duration = timedelta(days=trade_days)
        season_cfg.off_trade_window_open = now
        season_cfg.off_trade_window_close = now + duration
        db.session.commit()

        # Auto-execute agreed trades intended for off-season
        from models.database import Trade
        from models.trade_manager import _execute_trade
        agreed_trades = Trade.query.filter_by(
            league_id=league_id, status="agreed", intended_period="offseason"
        ).all()
        executed_count = 0
        for t in agreed_trades:
            _execute_trade(t)
            t.status = "accepted"
            executed_count += 1
        if executed_count:
            db.session.commit()
            flash(f"Off-season trade window opened (closes {season_cfg.off_trade_window_close.strftime('%d %b %Y')}). {executed_count} agreed trade(s) auto-executed.", "success")
        else:
            flash(f"Off-season trade window opened (closes {season_cfg.off_trade_window_close.strftime('%d %b %Y')}).", "success")

    elif step == "close_trades":
        season_cfg.off_trade_window_close = datetime.now(timezone.utc)
        db.session.commit()
        flash("Off-season trade window closed.", "info")

    elif step == "finish_offseason":
        now = datetime.now(timezone.utc)
        if season_cfg:
            season_cfg.season_phase = "regular"
            # Ensure off-season window is closed
            if season_cfg.off_trade_window_open and (not season_cfg.off_trade_window_close or season_cfg.off_trade_window_close > now):
                season_cfg.off_trade_window_close = now
        db.session.commit()
        flash("Off-season complete. Season is ready.", "success")

    return redirect(url_for("leagues.season_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/season/delist", methods=["POST"])
@login_required
def delist_player_action(league_id):
    """Delist a player during an active delist period (midseason or offseason only)."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    # Only allow delisting during midseason or offseason phases
    from models.database import SeasonConfig
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    is_midseason = (league.status == "active" and season_cfg
                    and season_cfg.season_phase == "midseason")
    is_offseason = league.status == "offseason"
    if not is_midseason and not is_offseason:
        flash("Delisting is only available during mid-season and off-season periods.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        flash("You need a team to delist players.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    from models.database import DelistPeriod
    delist_period = DelistPeriod.query.filter_by(
        league_id=league_id, year=league.season_year, status="open"
    ).first()
    if not delist_period:
        flash("No active delist period.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    player_id = request.form.get("player_id", type=int)
    if not player_id:
        flash("No player selected.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    from models.season_manager import delist_player
    _, error = delist_player(delist_period.id, user_team.id, player_id)
    if error:
        flash(error, "warning")
    else:
        # Notify all other team owners in the league
        from models.notification_manager import create_notification
        delisted_player = db.session.get(AflPlayer, player_id)
        player_name = delisted_player.name if delisted_player else "Unknown"
        other_teams = FantasyTeam.query.filter(
            FantasyTeam.league_id == league_id,
            FantasyTeam.id != user_team.id,
        ).all()
        for t in other_teams:
            create_notification(
                user_id=t.owner_id,
                league_id=league_id,
                notif_type="player_delisted",
                title=f"{user_team.name} delisted {player_name}",
                link=url_for("leagues.season_hub", league_id=league_id),
            )
        flash("Player delisted.", "success")

    return redirect(url_for("leagues.season_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/delist-hub")
@login_required
def delist_hub(league_id):
    """Redirect to unified season hub — delists are now inline."""
    return redirect(url_for("leagues.season_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/player-pool")
@login_required
def player_pool(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    # Get ALL players — rank with user/league weights so values match draft room
    from models.draft_model import rank_players_for_user
    ranked = rank_players_for_user(league_id, current_user.id)
    # ranked is list of (AflPlayer, score) — write personalised score onto each ORM object
    players = []
    for i, (ap, score) in enumerate(ranked, 1):
        ap.draft_score = score
        ap._rank = i
        players.append(ap)
    # Also include unranked players (those with no data) at the end
    ranked_ids = {ap.id for ap, _ in ranked}
    unranked = AflPlayer.query.filter(~AflPlayer.id.in_(ranked_ids)).all() if ranked_ids else AflPlayer.query.all()
    for ap in unranked:
        ap._rank = len(players) + 1
        players.append(ap)

    # Build rostered lookup: player_id -> team name
    rostered_map = {}
    roster_rows = (
        db.session.query(FantasyRoster.player_id, FantasyTeam.name)
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
        .all()
    )
    for pid, tname in roster_rows:
        rostered_map[pid] = tname

    # Assign a colour to each fantasy team for status badges
    _team_palette = [
        ("#79c0ff", "rgba(88,166,255,.18)"),    # blue
        ("#ffb471", "rgba(240,136,62,.18)"),    # orange
        ("#d2a8ff", "rgba(188,140,255,.18)"),   # purple
        ("#7ee787", "rgba(63,185,80,.18)"),     # green
        ("#e3b341", "rgba(210,153,34,.18)"),    # yellow
        ("#ff7b72", "rgba(248,81,73,.18)"),     # red
        ("#a5d6ff", "rgba(121,192,255,.18)"),   # light blue
        ("#f778ba", "rgba(219,97,162,.18)"),    # pink
    ]
    unique_teams = sorted(set(rostered_map.values()))
    team_colours = {}
    for i, tname in enumerate(unique_teams):
        fg, bg = _team_palette[i % len(_team_palette)]
        team_colours[tname] = {"fg": fg, "bg": bg}

    rolling = _compute_rolling_averages()

    # SSP pickup: check if user's team is below squad_size
    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    roster_count = 0
    can_pickup = False
    if user_team:
        roster_count = FantasyRoster.query.filter_by(
            team_id=user_team.id, is_active=True
        ).count()
        can_pickup = roster_count < (league.squad_size or 0)

    return render_template("leagues/player_pool.html",
                           league=league,
                           players=players,
                           rolling=rolling,
                           rostered_map=rostered_map,
                           team_colours=team_colours,
                           user_team=user_team,
                           roster_count=roster_count,
                           can_pickup=can_pickup)


@leagues_bp.route("/<int:league_id>/player-pool/pickup", methods=["POST"])
@login_required
def player_pickup(league_id):
    """Pick up a free agent when team is below squad_size."""
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "League not found"}), 404

    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    if not user_team:
        return jsonify({"error": "You don't have a team in this league"}), 403

    roster_count = FantasyRoster.query.filter_by(
        team_id=user_team.id, is_active=True
    ).count()
    if roster_count >= (league.squad_size or 0):
        return jsonify({"error": "Your roster is full (%d/%d)" % (roster_count, league.squad_size)}), 409

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    player = db.session.get(AflPlayer, player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404

    # Check player isn't already rostered in this league
    already = (
        db.session.query(FantasyRoster.id)
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyRoster.player_id == player_id,
            FantasyRoster.is_active == True,
        )
        .first()
    )
    if already:
        return jsonify({"error": "%s is already rostered" % player.name}), 409

    # Add to roster
    entry = FantasyRoster(
        team_id=user_team.id,
        player_id=player_id,
        is_active=True,
        acquired_via="free_agent",
    )
    db.session.add(entry)
    db.session.commit()

    new_count = FantasyRoster.query.filter_by(
        team_id=user_team.id, is_active=True
    ).count()
    return jsonify({
        "ok": True,
        "player_name": player.name,
        "roster_count": new_count,
        "squad_size": league.squad_size,
    })


@leagues_bp.route("/<int:league_id>/players/compare")
@login_required
def player_compare(league_id):
    """Compare up to 4 players side-by-side."""
    from blueprints import check_league_access
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    player_ids = request.args.getlist("p", type=int)

    from models.analytics import get_player_comparison_data
    players_data = get_player_comparison_data(player_ids, league.season_year, league_id)

    # Get searchable player list for selectors
    all_players = (
        AflPlayer.query
        .filter(AflPlayer.sc_avg.isnot(None))
        .order_by(AflPlayer.sc_avg.desc())
        .limit(500)
        .all()
    )

    return render_template("leagues/player_compare.html",
                           league=league,
                           players_data=players_data,
                           selected_ids=player_ids,
                           all_players=all_players,
                           active_tab="players")


# ── Keeper Value Tracking ────────────────────────────────────────────


@leagues_bp.route("/<int:league_id>/keepers")
@login_required
def keeper_values(league_id):
    """Keeper value tracker: shows draft cost vs current value for every rostered player."""
    from blueprints import check_league_access

    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    # ── Gather all teams and their active rosters ────────────────────
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    team_map = {t.id: t for t in teams}

    rosters = (
        FantasyRoster.query
        .filter(
            FantasyRoster.team_id.in_([t.id for t in teams]),
            FantasyRoster.is_active == True,
        )
        .all()
    )

    # ── Build draft-pick lookup: player_id -> DraftPick ──────────────
    # Get all draft sessions for this league (initial + supplemental)
    sessions = DraftSession.query.filter_by(league_id=league_id).all()
    session_ids = [s.id for s in sessions]
    session_map = {s.id: s for s in sessions}

    draft_picks = (
        DraftPick.query
        .filter(
            DraftPick.draft_session_id.in_(session_ids),
            DraftPick.player_id.isnot(None),
        )
        .all()
    ) if session_ids else []

    # Map player_id -> their draft pick info
    player_draft = {}  # player_id -> {round, round_type, pick_number}
    for dp in draft_picks:
        sess = session_map.get(dp.draft_session_id)
        round_type = sess.draft_round_type if sess else "initial"
        # Keep the earliest draft pick if a player was drafted multiple times
        if dp.player_id not in player_draft:
            player_draft[dp.player_id] = {
                "round": dp.draft_round,
                "pick_number": dp.pick_number,
                "round_type": round_type,
                "total_rounds": sess.total_rounds if sess else 10,
            }

    # ── Determine total rounds for baseline calculation ──────────────
    initial_sessions = [s for s in sessions if s.draft_round_type == "initial"]
    total_rounds = max((s.total_rounds or 10 for s in initial_sessions), default=10)

    # ── Find the best draft_score among all rostered players ─────────
    rostered_player_ids = [r.player_id for r in rosters]
    all_rostered_players = (
        AflPlayer.query
        .filter(AflPlayer.id.in_(rostered_player_ids))
        .all()
    ) if rostered_player_ids else []
    player_obj_map = {p.id: p for p in all_rostered_players}

    best_draft_score = max(
        (p.draft_score for p in all_rostered_players if p.draft_score),
        default=1.0,
    )
    if best_draft_score <= 0:
        best_draft_score = 1.0

    # Baseline value per round: what a "fair" pick at each round is worth
    baseline_per_round = best_draft_score / total_rounds

    # ── Keeper longevity multiplier (from draft_model.py) ────────────
    # Players 29+ lose 8% per year over 30, floor 0.55
    def _keeper_age_mult(age):
        if age is None:
            return 1.0
        if age > 30:
            return max(0.55, 1.0 - (age - 30) * 0.08)
        return 1.0

    # ── Compute rolling averages for trend data ──────────────────────
    rolling = _compute_rolling_averages()

    # ── Build per-team keeper data ───────────────────────────────────
    teams_data = []  # list of {team, players: [{...}]}

    # Collect all keeper entries for the projected rankings
    all_keepers = []

    for team in sorted(teams, key=lambda t: t.name):
        team_rosters = [r for r in rosters if r.team_id == team.id]
        team_players = []

        for roster_entry in team_rosters:
            player = player_obj_map.get(roster_entry.player_id)
            if not player:
                continue

            draft_info = player_draft.get(player.id)
            draft_score = player.draft_score or 0

            # Determine cost label and effective round cost
            if draft_info:
                if draft_info["round_type"] == "supplemental":
                    cost_label = f"Supp R{draft_info['round']}"
                    # Supplemental picks treated as mid-round value
                    effective_round = total_rounds * 0.6
                else:
                    cost_label = f"R{draft_info['round']}"
                    effective_round = draft_info["round"]
            elif roster_entry.acquired_via == "trade":
                cost_label = "Trade"
                # Trades treated as mid-round value
                effective_round = total_rounds * 0.5
            else:
                cost_label = "Undrafted"
                # Undrafted = treat as last round pick
                effective_round = total_rounds

            # Keeper value = draft_score / (effective_round_cost * baseline)
            expected_value = effective_round * baseline_per_round
            if expected_value > 0:
                keeper_value = draft_score / expected_value
            else:
                keeper_value = 0

            # Recommendation
            if keeper_value > 1.2:
                recommendation = "KEEP"
            elif keeper_value >= 0.8:
                recommendation = "TRADE"
            else:
                recommendation = "DROP"

            # Season trend
            pr = rolling.get(player.name, {})
            sc_display = player.sc_avg or player.sc_avg_prev or 0
            if pr.get("l3") and sc_display:
                trend_val = pr["l3"] - sc_display
                trend_pct = (trend_val / sc_display * 100) if sc_display else 0
            else:
                trend_val = 0
                trend_pct = 0

            # Projected next-year value (age decline)
            age_mult_now = _keeper_age_mult(player.age)
            age_mult_next = _keeper_age_mult((player.age + 1) if player.age else None)
            projected_score = draft_score * (age_mult_next / age_mult_now) if age_mult_now > 0 else draft_score

            # Projected keeper value next year
            if expected_value > 0:
                projected_kv = projected_score / expected_value
            else:
                projected_kv = 0

            entry = {
                "player": player,
                "cost_label": cost_label,
                "effective_round": effective_round,
                "draft_score": round(draft_score, 1),
                "keeper_value": round(keeper_value, 2),
                "recommendation": recommendation,
                "trend_val": round(trend_val, 1),
                "trend_pct": round(trend_pct, 1),
                "projected_score": round(projected_score, 1),
                "projected_kv": round(projected_kv, 2),
                "age_mult_next": round(age_mult_next, 2),
                "team_name": team.name,
                "team_id": team.id,
            }

            team_players.append(entry)
            all_keepers.append(entry)

        # Sort team players by keeper value descending
        team_players.sort(key=lambda x: x["keeper_value"], reverse=True)

        teams_data.append({
            "team": team,
            "players": team_players,
        })

    # ── Projected keeper rankings (all players, sorted by projected KV) ──
    projected_rankings = sorted(all_keepers, key=lambda x: x["projected_kv"], reverse=True)

    return render_template(
        "leagues/keepers.html",
        league=league,
        teams_data=teams_data,
        projected_rankings=projected_rankings,
        best_draft_score=best_draft_score,
        total_rounds=total_rounds,
        active_tab="players",
    )


# ── League Records (all-time history) ────────────────────────────────


@leagues_bp.route("/<int:league_id>/records")
@login_required
def league_history(league_id):
    """All-time league records: champions, records, head-to-head, standings."""
    from collections import defaultdict
    from blueprints import check_league_access
    from models.database import SeasonStanding, Fixture, RoundScore

    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    team_map = {t.id: t.name for t in teams}

    # ── Champions per year ────────────────────────────────────────
    all_standings = (
        SeasonStanding.query
        .filter_by(league_id=league_id)
        .order_by(SeasonStanding.year, SeasonStanding.ladder_points.desc(),
                  SeasonStanding.percentage.desc())
        .all()
    )

    # Group by year, pick #1
    standings_by_year = defaultdict(list)
    for s in all_standings:
        standings_by_year[s.year].append(s)

    champions = []
    for year in sorted(standings_by_year.keys()):
        rows = standings_by_year[year]
        if rows:
            champ = rows[0]
            champions.append({
                "year": year,
                "team_name": team_map.get(champ.team_id, "Unknown"),
                "team_id": champ.team_id,
                "wins": champ.wins,
                "losses": champ.losses,
                "draws": champ.draws,
                "points_for": champ.points_for,
                "ladder_points": champ.ladder_points,
                "percentage": champ.percentage,
            })

    # ── All-time aggregate standings ──────────────────────────────
    alltime = {}
    for s in all_standings:
        tid = s.team_id
        if tid not in alltime:
            alltime[tid] = {
                "team_name": team_map.get(tid, "Unknown"),
                "team_id": tid,
                "wins": 0, "losses": 0, "draws": 0,
                "points_for": 0.0, "points_against": 0.0,
                "seasons": 0,
            }
        alltime[tid]["wins"] += s.wins
        alltime[tid]["losses"] += s.losses
        alltime[tid]["draws"] += s.draws
        alltime[tid]["points_for"] += s.points_for
        alltime[tid]["points_against"] += s.points_against
        alltime[tid]["seasons"] += 1

    for tid in alltime:
        a = alltime[tid]
        total = a["wins"] + a["losses"] + a["draws"]
        a["total_games"] = total
        a["win_pct"] = (a["wins"] / total * 100) if total > 0 else 0
        a["percentage"] = (
            (a["points_for"] / a["points_against"] * 100)
            if a["points_against"] > 0 else 0
        )

    alltime_sorted = sorted(
        alltime.values(),
        key=lambda x: (-x["wins"], -x["win_pct"], -x["points_for"]),
    )

    # ── Records: highest round score, highest season PF, biggest blowout ─
    # Highest single-round scores
    top_round_scores = (
        db.session.query(RoundScore, FantasyTeam)
        .join(FantasyTeam, RoundScore.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id)
        .order_by(RoundScore.total_score.desc())
        .limit(10)
        .all()
    )
    top_scores = []
    for rs, ft in top_round_scores:
        top_scores.append({
            "team_name": ft.name,
            "score": rs.total_score,
            "round": rs.afl_round,
            "year": rs.year,
        })

    # Highest season points for
    top_season_pf = sorted(
        all_standings, key=lambda s: s.points_for, reverse=True
    )[:5]
    top_season_pf_list = [{
        "team_name": team_map.get(s.team_id, "Unknown"),
        "year": s.year,
        "points_for": s.points_for,
        "wins": s.wins,
        "losses": s.losses,
    } for s in top_season_pf]

    # Biggest blowout (largest margin in completed fixtures)
    blowout_fixtures = (
        Fixture.query
        .filter_by(league_id=league_id, status="completed", is_final=False)
        .all()
    )
    blowouts = []
    for f in blowout_fixtures:
        if f.home_score is not None and f.away_score is not None:
            margin = abs(f.home_score - f.away_score)
            if f.home_score > f.away_score:
                winner = team_map.get(f.home_team_id, "Unknown")
                loser = team_map.get(f.away_team_id, "Unknown")
                winner_score = f.home_score
                loser_score = f.away_score
            else:
                winner = team_map.get(f.away_team_id, "Unknown")
                loser = team_map.get(f.home_team_id, "Unknown")
                winner_score = f.away_score
                loser_score = f.home_score
            blowouts.append({
                "winner": winner,
                "loser": loser,
                "winner_score": winner_score,
                "loser_score": loser_score,
                "margin": margin,
                "round": f.afl_round,
                "year": f.year,
            })
    blowouts.sort(key=lambda x: x["margin"], reverse=True)
    blowouts = blowouts[:5]

    # ── Longest win streaks ───────────────────────────────────────
    completed = (
        Fixture.query
        .filter_by(league_id=league_id, status="completed", is_final=False)
        .order_by(Fixture.year, Fixture.afl_round)
        .all()
    )
    team_results = defaultdict(list)
    for f in completed:
        if f.home_score is not None and f.away_score is not None:
            if f.home_score > f.away_score:
                team_results[f.home_team_id].append(("W", f.afl_round, f.year))
                team_results[f.away_team_id].append(("L", f.afl_round, f.year))
            elif f.away_score > f.home_score:
                team_results[f.away_team_id].append(("W", f.afl_round, f.year))
                team_results[f.home_team_id].append(("L", f.afl_round, f.year))
            else:
                team_results[f.home_team_id].append(("D", f.afl_round, f.year))
                team_results[f.away_team_id].append(("D", f.afl_round, f.year))

    win_streaks = []
    for tid, results in team_results.items():
        results.sort(key=lambda x: (x[2], x[1]))
        best_streak = 0
        current_streak = 0
        streak_start = None
        best_start = None
        best_end = None
        for r in results:
            if r[0] == "W":
                if current_streak == 0:
                    streak_start = (r[2], r[1])
                current_streak += 1
                if current_streak > best_streak:
                    best_streak = current_streak
                    best_start = streak_start
                    best_end = (r[2], r[1])
            else:
                current_streak = 0
        if best_streak > 0:
            win_streaks.append({
                "team_name": team_map.get(tid, "Unknown"),
                "streak": best_streak,
                "start_year": best_start[0] if best_start else None,
                "start_round": best_start[1] if best_start else None,
                "end_year": best_end[0] if best_end else None,
                "end_round": best_end[1] if best_end else None,
            })
    win_streaks.sort(key=lambda x: x["streak"], reverse=True)
    win_streaks = win_streaks[:10]

    # ── Head-to-head matrix ───────────────────────────────────────
    h2h = defaultdict(lambda: {"wins": 0, "losses": 0, "draws": 0})
    for f in completed:
        if f.home_score is not None and f.away_score is not None:
            hid, aid = f.home_team_id, f.away_team_id
            if f.home_score > f.away_score:
                h2h[(hid, aid)]["wins"] += 1
                h2h[(aid, hid)]["losses"] += 1
            elif f.away_score > f.home_score:
                h2h[(aid, hid)]["wins"] += 1
                h2h[(hid, aid)]["losses"] += 1
            else:
                h2h[(hid, aid)]["draws"] += 1
                h2h[(aid, hid)]["draws"] += 1

    # Convert to serialisable dict for template
    h2h_data = {}
    for (t1, t2), record in h2h.items():
        key = f"{t1}-{t2}"
        h2h_data[key] = {
            "team1_id": t1,
            "team2_id": t2,
            "team1_name": team_map.get(t1, "Unknown"),
            "team2_name": team_map.get(t2, "Unknown"),
            "wins": record["wins"],
            "losses": record["losses"],
            "draws": record["draws"],
        }

    return render_template("leagues/history.html",
                           league=league,
                           champions=champions,
                           alltime_standings=alltime_sorted,
                           top_scores=top_scores,
                           top_season_pf=top_season_pf_list,
                           blowouts=blowouts,
                           win_streaks=win_streaks,
                           h2h_data=h2h_data,
                           teams=teams,
                           team_map=team_map,
                           active_tab="league")


# ── Advanced Stats Dashboard ────────────────────────────────────────


@leagues_bp.route("/<int:league_id>/stats")
@login_required
def advanced_stats(league_id):
    """Advanced stats dashboard: league leaders, player lookup, team analysis."""
    import json
    import statistics
    from blueprints import check_league_access
    from models.database import (
        ScScore, PlayerStat, RoundScore, AflByeRound,
        FantasyRoster, FantasyTeam, AflPlayer,
    )

    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    prev_year = year - 1

    # ── Rostered player IDs in this league ──
    roster_rows = (
        db.session.query(FantasyRoster.player_id, FantasyTeam.name, FantasyTeam.id)
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
        .all()
    )
    rostered_ids = {r[0] for r in roster_rows}
    player_team_map = {r[0]: r[1] for r in roster_rows}  # player_id -> fantasy team name

    # ── Gather SC scores for rostered players (current year) ──
    sc_rows = (
        db.session.query(ScScore.player_id, ScScore.round, ScScore.sc_score)
        .filter(ScScore.year == year, ScScore.player_id.in_(rostered_ids))
        .order_by(ScScore.player_id, ScScore.round)
        .all()
    )

    # Build per-player score lists
    player_scores = {}  # player_id -> [(round, score), ...]
    for pid, rnd, sc in sc_rows:
        if sc is not None:
            player_scores.setdefault(pid, []).append((rnd, sc))

    # ── Previous year averages (for "most improved") ──
    prev_sc_rows = (
        db.session.query(ScScore.player_id, ScScore.sc_score)
        .filter(ScScore.year == prev_year, ScScore.player_id.in_(rostered_ids))
        .all()
    )
    prev_totals = {}
    prev_counts = {}
    for pid, sc in prev_sc_rows:
        if sc is not None:
            prev_totals[pid] = prev_totals.get(pid, 0) + sc
            prev_counts[pid] = prev_counts.get(pid, 0) + 1
    prev_avgs = {pid: prev_totals[pid] / prev_counts[pid] for pid in prev_totals if prev_counts[pid] > 0}

    # ── Player name lookup ──
    player_objs = {
        p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(rostered_ids)).all()
    }

    # ── Compute per-player metrics ──
    player_metrics = []
    for pid, scores_list in player_scores.items():
        if not scores_list:
            continue
        player = player_objs.get(pid)
        if not player:
            continue

        vals = [s[1] for s in scores_list]
        games = len(vals)
        if games < 1:
            continue

        avg = sum(vals) / games
        std_dev = statistics.pstdev(vals) if games > 1 else 0.0
        ceiling = max(vals)
        floor = min(vals)
        best_round = scores_list[vals.index(ceiling)][0]

        player_metrics.append({
            "id": pid,
            "name": player.name,
            "fantasy_team": player_team_map.get(pid, ""),
            "avg": avg,
            "games": games,
            "std_dev": std_dev,
            "ceiling": ceiling,
            "floor": floor,
            "best_round": best_round,
            "prev_avg": prev_avgs.get(pid),
        })

    # ── Build leader tables ──
    leaders = {}

    # Top 10 scoring average (min 3 games)
    qualified = [p for p in player_metrics if p["games"] >= 3]
    leaders["scoring_avg"] = sorted(qualified, key=lambda x: x["avg"], reverse=True)[:10]

    # Most consistent (lowest std dev, min 3 games)
    leaders["consistency"] = sorted(qualified, key=lambda x: x["std_dev"])[:10]

    # Highest ceiling
    leaders["ceiling"] = sorted(player_metrics, key=lambda x: x["ceiling"], reverse=True)[:10]

    # Most improved (biggest avg increase from prev year, min 3 games both years)
    improved = []
    for p in qualified:
        if p["prev_avg"] is not None and p["prev_avg"] > 0:
            improvement = p["avg"] - p["prev_avg"]
            improved.append({
                "name": p["name"],
                "prev_avg": p["prev_avg"],
                "curr_avg": p["avg"],
                "improvement": improvement,
            })
    leaders["most_improved"] = sorted(improved, key=lambda x: x["improvement"], reverse=True)[:10]

    # Ironman (most games)
    leaders["ironman"] = sorted(player_metrics, key=lambda x: x["games"], reverse=True)[:10]

    # ── All players for search (JSON) ──
    all_players_list = (
        AflPlayer.query
        .filter(AflPlayer.sc_avg.isnot(None))
        .order_by(AflPlayer.sc_avg.desc())
        .limit(600)
        .all()
    )
    all_players_json = json.dumps([
        {"id": p.id, "name": p.name, "position": p.position or "", "afl_team": p.afl_team or ""}
        for p in all_players_list
    ])

    # ── Teams for dropdown ──
    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.name).all()

    # ── Team analysis data (precomputed for all teams) ──
    team_analysis = {}
    for team in teams:
        # Round scores
        round_scores = (
            RoundScore.query.filter_by(team_id=team.id, year=year)
            .order_by(RoundScore.afl_round.asc())
            .all()
        )
        rs_data = [{"round": rs.afl_round, "score": rs.total_score or 0} for rs in round_scores]

        # Position group contribution
        roster_entries = (
            FantasyRoster.query.filter_by(team_id=team.id, is_active=True, is_benched=False)
            .all()
        )
        pos_scores = {"DEF": 0.0, "MID": 0.0, "FWD": 0.0, "RUC": 0.0}
        for entry in roster_entries:
            if entry.position_code not in pos_scores:
                continue
            p_scores = player_scores.get(entry.player_id, [])
            if p_scores:
                p_avg = sum(s[1] for s in p_scores) / len(p_scores)
                pos_scores[entry.position_code] += p_avg

        # Bye round impact
        player_teams = {
            entry.player_id: entry.player.afl_team
            for entry in roster_entries if entry.player
        }
        bye_rows = AflByeRound.query.filter_by(year=year).all()
        bye_map = {}
        for b in bye_rows:
            bye_map.setdefault(b.afl_round, set()).add(b.afl_team)

        bye_impact = []
        for rnd, bye_teams in sorted(bye_map.items()):
            affected_players = [
                pid for pid, afl_team in player_teams.items()
                if afl_team in bye_teams
            ]
            if affected_players:
                est_loss = 0
                for pid in affected_players:
                    p_scores = player_scores.get(pid, [])
                    if p_scores:
                        est_loss += sum(s[1] for s in p_scores) / len(p_scores)
                    else:
                        player = player_objs.get(pid)
                        est_loss += (player.sc_avg or 0) if player else 0
                bye_impact.append({
                    "round": rnd,
                    "players_out": len(affected_players),
                    "estimated_loss": est_loss,
                })

        team_analysis[str(team.id)] = {
            "name": team.name,
            "round_scores": rs_data,
            "position_breakdown": pos_scores,
            "bye_impact": bye_impact,
        }

    team_analysis_json = json.dumps(team_analysis)

    return render_template("leagues/stats.html",
                           league=league,
                           leaders=leaders,
                           teams=teams,
                           all_players_json=all_players_json,
                           team_analysis_json=team_analysis_json,
                           active_tab="players")


@leagues_bp.route("/<int:league_id>/stats/api/player/<int:player_id>")
@login_required
def api_player_stats(league_id, player_id):
    """API endpoint returning JSON with player round-by-round scores and metrics."""
    import statistics
    from blueprints import check_league_access
    from models.database import ScScore, PlayerStat, AflPlayer

    league, user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Access denied"}), 403

    player = db.session.get(AflPlayer, player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404

    year = league.season_year

    # Current year scores
    scores = (
        ScScore.query.filter_by(player_id=player_id, year=year)
        .order_by(ScScore.round.asc())
        .all()
    )
    sc_vals = [s.sc_score for s in scores if s.sc_score is not None]
    games = len(sc_vals)
    avg = sum(sc_vals) / games if games else (player.sc_avg or 0)
    std_dev = statistics.pstdev(sc_vals) if games > 1 else 0.0
    ceiling = max(sc_vals) if sc_vals else 0
    floor = min(sc_vals) if sc_vals else 0

    last3 = sc_vals[-3:] if sc_vals else []
    last5 = sc_vals[-5:] if sc_vals else []
    l3_avg = sum(last3) / len(last3) if last3 else None
    l5_avg = sum(last5) / len(last5) if last5 else None

    # Break-even: the score needed in the next game to maintain current avg
    # breakeven = avg (you need to score your average to keep it the same)
    breakeven = avg

    # Detailed stats averages (last 5 games)
    stats = (
        PlayerStat.query.filter_by(player_id=player_id, year=year)
        .order_by(PlayerStat.round.desc())
        .limit(5)
        .all()
    )
    stat_avgs = {}
    if stats:
        for col in ["kicks", "handballs", "marks", "tackles", "goals",
                     "behinds", "hitouts", "disposals", "clearances",
                     "contested_possessions", "inside_fifties"]:
            vals = [getattr(s, col) or 0 for s in stats]
            stat_avgs[col] = round(sum(vals) / len(vals), 1) if vals else 0

    scores_by_round = [
        {"round": s.round, "score": s.sc_score}
        for s in scores if s.sc_score is not None
    ]

    return jsonify({
        "id": player.id,
        "name": player.name,
        "afl_team": player.afl_team,
        "position": player.position,
        "games": games,
        "avg": round(avg, 1),
        "std_dev": round(std_dev, 1),
        "ceiling": ceiling,
        "floor": floor,
        "l3_avg": round(l3_avg, 1) if l3_avg is not None else None,
        "l5_avg": round(l5_avg, 1) if l5_avg is not None else None,
        "breakeven": round(breakeven, 1),
        "stat_avgs": stat_avgs,
        "scores_by_round": scores_by_round,
    })

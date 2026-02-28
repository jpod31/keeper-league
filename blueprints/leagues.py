"""League management blueprint: create, list, dashboard, settings, scoring."""

import os
import re
from datetime import datetime, timezone, timedelta

import pandas as pd
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, FantasyRoster, AflPlayer, UserDraftWeights, LeagueDraftWeights, LiveScoringConfig
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
        update_league_settings(
            league_id,
            name=request.form.get("name", league.name).strip(),
            num_teams=request.form.get("num_teams", type=int) or league.num_teams,
            squad_size=request.form.get("squad_size", type=int) or league.squad_size,
            draft_type=request.form.get("draft_type", league.draft_type),
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
        if finals_teams:
            season_cfg.finals_teams = finals_teams

        # Mid-season config
        season_cfg.mid_season_trade_enabled = request.form.get("mid_season_trade_enabled") == "on"
        season_cfg.mid_season_draft_enabled = request.form.get("mid_season_draft_enabled") == "on"
        mid_trade_round = request.form.get("mid_season_trade_after_round", type=int)
        if mid_trade_round:
            season_cfg.mid_season_trade_after_round = mid_trade_round
        mid_draft_round = request.form.get("mid_season_draft_after_round", type=int)
        if mid_draft_round:
            season_cfg.mid_season_draft_after_round = mid_draft_round
        mid_picks = request.form.get("mid_season_draft_picks", type=int)
        if mid_picks is not None:
            season_cfg.mid_season_draft_picks = mid_picks
        mid_delist = request.form.get("mid_season_delist_required", type=int)
        if mid_delist is not None:
            season_cfg.mid_season_delist_required = mid_delist

        # Off-season config
        season_cfg.offseason_trade_enabled = request.form.get("offseason_trade_enabled") == "on"
        season_cfg.ssp_enabled = request.form.get("ssp_enabled") == "on"
        offseason_delist = request.form.get("offseason_delist_min", type=int)
        if offseason_delist is not None:
            season_cfg.offseason_delist_min = offseason_delist
        ssp_slots = request.form.get("ssp_slots", type=int)
        if ssp_slots is not None:
            season_cfg.ssp_slots = ssp_slots

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
            slots = [
                {"position_code": "DEF", "count": def_count or 5, "is_bench": False},
                {"position_code": "MID", "count": mid_count or 7, "is_bench": False},
                {"position_code": "FWD", "count": fwd_count or 5, "is_bench": False},
                {"position_code": "RUC", "count": ruc_count or 1, "is_bench": False},
                {"position_code": "DEF", "count": bench_def if bench_def is not None else 1, "is_bench": True},
                {"position_code": "MID", "count": bench_mid if bench_mid is not None else 2, "is_bench": True},
                {"position_code": "FWD", "count": bench_fwd if bench_fwd is not None else 1, "is_bench": True},
                {"position_code": "FLEX", "count": bench_flex if bench_flex is not None else 1, "is_bench": True},
            ]
            update_position_slots(league_id, slots)
            on_field = (def_count or 5) + (mid_count or 7) + (fwd_count or 5) + (ruc_count or 1)
            update_league_settings(league_id, on_field_count=on_field)

        flash("League settings updated.", "success")
        return redirect(url_for("leagues.league_settings", league_id=league_id))

    live_config = LiveScoringConfig.query.get(league_id)
    from models.database import SeasonConfig
    season_config = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    return render_template("leagues/settings.html", league=league, live_config=live_config, season_config=season_config, is_commissioner=is_commissioner)


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
        flash("Only the commissioner can regenerate fixtures.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    from models.database import SeasonConfig
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    num_rounds = int(request.form.get("num_rounds", 23))

    from models.fixture_manager import generate_round_robin
    fixtures, error = generate_round_robin(league_id, league.season_year, num_rounds)
    if error:
        flash(error, "danger")
    else:
        flash(f"Regenerated {len(fixtures)} fixtures across {num_rounds} rounds.", "success")

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
        user_roster = FantasyRoster.query.filter_by(
            team_id=user_team.id, is_active=True
        ).all()
        if delist_period:
            from models.database import DelistAction
            delisted_actions = DelistAction.query.filter_by(
                delist_period_id=delist_period.id, team_id=user_team.id
            ).all()
            delisted_player_ids = {a.player_id for a in delisted_actions}

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

    # ── Build phases list for timeline ──
    phase_order = ["preseason", "draft", "regular", "midseason", "finals", "offseason"]
    phase_labels = {
        "preseason": "Pre-Season", "draft": "Draft",
        "regular": "Regular Season", "midseason": "Mid-Season",
        "finals": "Finals", "offseason": "Off-Season",
    }
    # Map current_phase to timeline phase id
    cp_map = {"pre_season": "preseason", "regular": "regular", "midseason": "midseason", "finals": "finals", "offseason": "offseason"}
    active_phase_id = cp_map.get(current_phase, "preseason")
    # Draft is "completed" if initial draft is done; it's "active" if we're in pre_season with no draft yet or draft in progress
    if current_phase == "pre_season" and initial_draft and initial_draft.status in ("in_progress", "paused"):
        active_phase_id = "draft"
    elif current_phase == "pre_season" and initial_draft and initial_draft.status == "completed":
        active_phase_id = "regular"

    phases = []
    found_active = False
    for pid in phase_order:
        if pid == active_phase_id:
            phases.append({"id": pid, "label": phase_labels[pid], "status": "active"})
            found_active = True
        elif not found_active:
            phases.append({"id": pid, "label": phase_labels[pid], "status": "completed"})
        else:
            phases.append({"id": pid, "label": phase_labels[pid], "status": "future"})

    # ── Standings snapshot for regular season panel ──
    from models.database import SeasonStanding, Fixture
    standings = []
    current_round_num = None
    if current_phase in ("regular", "midseason", "finals"):
        standings = SeasonStanding.query.filter_by(
            league_id=league_id, year=league.season_year
        ).order_by(SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc()).all()
        # Find current round (last completed fixture round)
        last_completed = Fixture.query.filter_by(
            league_id=league_id, year=league.season_year, status="completed"
        ).order_by(Fixture.afl_round.desc()).first()
        current_round_num = last_completed.afl_round if last_completed else 0

    return render_template("leagues/season_hub.html",
                           league=league,
                           season_cfg=season_cfg,
                           user_team=user_team,
                           is_commissioner=is_commissioner,
                           current_phase=current_phase,
                           phases=phases,
                           active_phase_id=active_phase_id,
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
                           ltil_entries=ltil_entries,
                           pending_incoming=pending_incoming,
                           pending_outgoing=pending_outgoing,
                           recent_trades=recent_trades,
                           user_roster=user_roster,
                           delisted_player_ids=delisted_player_ids,
                           trade_window_dates=trade_window_dates,
                           standings=standings,
                           current_round_num=current_round_num,
                           mock_draft=mock_draft)


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
        duration = timedelta(weeks=config.TRADE_WINDOW_DURATION_WEEKS)
        season_cfg.season_phase = "midseason"
        season_cfg.mid_trade_window_open = now
        season_cfg.mid_trade_window_close = now + duration
        season_cfg.mid_draft_date = now + duration + timedelta(days=1)
        db.session.commit()

        # Auto-execute any agreed trades
        from models.database import Trade
        from models.trade_manager import _execute_trade
        agreed_trades = Trade.query.filter_by(league_id=league_id, status="agreed").all()
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
            _, error = open_delist_period(league_id, league.season_year, min_delists=min_delists)
            if error:
                flash(error, "warning")
            else:
                flash("Delist period opened.", "success")

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
        from models.season_manager import open_delist_period
        _, error = open_delist_period(league_id, league.season_year, min_delists=min_delists)
        if error:
            flash(error, "warning")
        else:
            flash("Off-season delist period opened.", "success")

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
        duration = timedelta(weeks=config.TRADE_WINDOW_DURATION_WEEKS)
        season_cfg.off_trade_window_open = now
        season_cfg.off_trade_window_close = now + duration
        db.session.commit()

        # Auto-execute any agreed trades
        from models.database import Trade
        from models.trade_manager import _execute_trade
        agreed_trades = Trade.query.filter_by(league_id=league_id, status="agreed").all()
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
        return redirect(url_for("leagues.delist_hub", league_id=league_id))

    from models.season_manager import delist_player
    _, error = delist_player(delist_period.id, user_team.id, player_id)
    if error:
        flash(error, "warning")
    else:
        flash("Player delisted.", "success")

    return redirect(url_for("leagues.delist_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/delist-hub")
@login_required
def delist_hub(league_id):
    """Dedicated delist management page with player assessment."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    from models.database import (
        SeasonConfig, DelistPeriod, DelistAction, FantasyRoster, AflPlayer,
    )
    season_cfg = SeasonConfig.query.filter_by(
        league_id=league_id, year=league.season_year
    ).first()

    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    if not user_team:
        flash("You need a team to manage delists.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    is_commissioner = league.commissioner_id == current_user.id

    # Check phase
    is_midseason = (league.status == "active" and season_cfg
                    and season_cfg.season_phase == "midseason")
    is_offseason = league.status == "offseason"

    delist_period = DelistPeriod.query.filter_by(
        league_id=league_id, year=league.season_year, status="open"
    ).first()

    if not delist_period:
        flash("No active delist period.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    if not is_midseason and not is_offseason:
        flash("Delisting is only available during mid-season and off-season.", "warning")
        return redirect(url_for("leagues.season_hub", league_id=league_id))

    # Get user's active roster with player details
    roster_entries = (
        FantasyRoster.query
        .filter_by(team_id=user_team.id, is_active=True)
        .join(AflPlayer, FantasyRoster.player_id == AflPlayer.id)
        .order_by(AflPlayer.position, AflPlayer.sc_avg.desc())
        .all()
    )

    # Get delisted player IDs
    delisted_actions = DelistAction.query.filter_by(
        delist_period_id=delist_period.id, team_id=user_team.id
    ).all()
    delisted_player_ids = {a.player_id for a in delisted_actions}
    team_delist_count = len(delisted_actions)

    # Determine min delists for this period
    min_delists = delist_period.min_delists or 3

    # Get all teams' delist progress (for commissioner view)
    all_teams_progress = []
    if is_commissioner:
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

    # Determine which phase for the close route
    close_route = ("leagues.midseason_start_step" if is_midseason
                   else "leagues.offseason_start_step")

    return render_template(
        "leagues/delist_hub.html",
        league=league,
        season_cfg=season_cfg,
        user_team=user_team,
        is_commissioner=is_commissioner,
        delist_period=delist_period,
        roster_entries=roster_entries,
        delisted_player_ids=delisted_player_ids,
        team_delist_count=team_delist_count,
        min_delists=min_delists,
        all_teams_progress=all_teams_progress,
        close_route=close_route,
    )


@leagues_bp.route("/<int:league_id>/player-pool")
@login_required
def player_pool(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    # Get ALL players
    players = (
        AflPlayer.query
        .order_by(AflPlayer.draft_score.desc().nullslast())
        .all()
    )

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

    # Rank by draft value (fallback to SC avg if no draft score)
    players.sort(key=lambda p: p.draft_score or 0, reverse=True)
    for i, p in enumerate(players, 1):
        p._rank = i

    rolling = _compute_rolling_averages()

    return render_template("leagues/player_pool.html",
                           league=league,
                           players=players,
                           rolling=rolling,
                           rostered_map=rostered_map,
                           team_colours=team_colours)

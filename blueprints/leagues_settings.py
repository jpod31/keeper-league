"""League settings, scoring, sync, and fixture generation routes."""

from datetime import datetime
from flask import render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, LiveScoringConfig
from models.league_manager import (
    set_custom_scoring, get_custom_scoring, update_league_settings,
    update_position_slots,
)
import config
from blueprints.leagues import leagues_bp


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

        # Mid-season delist config
        mid_delist_days = request.form.get("mid_delist_duration_days", type=int)
        if mid_delist_days is not None:
            season_cfg.mid_delist_duration_days = max(1, min(7, mid_delist_days))
        mid_delist_req = request.form.get("mid_season_delist_required", type=int)
        if mid_delist_req is not None:
            season_cfg.mid_season_delist_required = max(0, min(10, mid_delist_req))

        # Off-season delist/trade config
        off_delist_days = request.form.get("off_delist_duration_days", type=int)
        if off_delist_days is not None:
            season_cfg.off_delist_duration_days = max(1, min(30, off_delist_days))
        off_delist_min = request.form.get("offseason_delist_min", type=int)
        if off_delist_min is not None:
            season_cfg.offseason_delist_min = max(0, min(15, off_delist_min))
        off_trade_days = request.form.get("off_trade_duration_days", type=int)
        if off_trade_days is not None:
            season_cfg.off_trade_duration_days = max(1, min(30, off_trade_days))
        supp_draft_date = request.form.get("supplemental_draft_date", "").strip()
        if supp_draft_date:
            try:
                season_cfg.supplemental_draft_date = datetime.strptime(supp_draft_date, "%Y-%m-%d")
            except ValueError:
                pass
        else:
            season_cfg.supplemental_draft_date = None

        # Captain scoring toggle
        season_cfg.captain_scoring_enabled = request.form.get("captain_scoring_enabled") == "on"

        # SSP config
        season_cfg.ssp_enabled = request.form.get("ssp_enabled") == "on"
        ssp_cutoff = request.form.get("ssp_cutoff_round", type=int)
        if ssp_cutoff is not None:
            season_cfg.ssp_cutoff_round = max(1, min(24, ssp_cutoff))
        ssp_slots = request.form.get("ssp_slots", type=int)
        if ssp_slots is not None:
            season_cfg.ssp_slots = max(0, min(5, ssp_slots))

        db.session.commit()

        # Formation + flex position slots
        def_count = request.form.get("def_count", type=int)
        mid_count = request.form.get("mid_count", type=int)
        fwd_count = request.form.get("fwd_count", type=int)
        ruc_count = request.form.get("ruc_count", type=int)
        flex_count = request.form.get("flex_count", type=int)

        if any(v is not None for v in [def_count, mid_count, fwd_count, ruc_count]):
            d = def_count if def_count is not None else 6
            m = mid_count if mid_count is not None else 9
            f = fwd_count if fwd_count is not None else 6
            r = ruc_count if ruc_count is not None else 1
            fx = flex_count if flex_count is not None else 1
            total_positions = d + m + f + r + fx

            # Reload league to get potentially-updated squad_size
            db.session.refresh(league)
            if total_positions > league.squad_size:
                flash(
                    f"Total positions ({total_positions}) exceed squad size ({league.squad_size}). "
                    "Reduce formation or increase squad size.",
                    "warning",
                )
                return redirect(url_for("leagues.league_settings", league_id=league_id))

            slots = [
                {"position_code": "DEF", "count": d, "is_bench": False},
                {"position_code": "MID", "count": m, "is_bench": False},
                {"position_code": "FWD", "count": f, "is_bench": False},
                {"position_code": "RUC", "count": r, "is_bench": False},
                {"position_code": "FLEX", "count": fx, "is_bench": True},
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
    teams = FantasyTeam.query.filter_by(league_id=league_id).all() if is_commissioner else []
    from models.database import Fixture
    has_preseason = Fixture.query.filter_by(
        league_id=league_id, year=league.season_year, afl_round=0, is_final=False
    ).first() is not None
    return render_template("leagues/settings.html", league=league, live_config=live_config,
                           season_config=season_config, is_commissioner=is_commissioner,
                           has_active_draft=has_active_draft, teams=teams,
                           has_preseason=has_preseason)


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

    from models.fixture_manager import generate_round_robin, generate_7s_round_robin
    fixtures, error = generate_round_robin(league_id, league.season_year, num_rounds)

    # Auto-generate 7s fixture to match
    if not error:
        generate_7s_round_robin(league_id, league.season_year, num_rounds)

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


@leagues_bp.route("/<int:league_id>/fixture/generate-preseason", methods=["POST"])
@login_required
def generate_preseason_route(league_id):
    """Commissioner generates pre-season (round 0) fixtures."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    if league.commissioner_id != current_user.id:
        flash("Only the commissioner can generate pre-season fixtures.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    from models.fixture_manager import generate_preseason, generate_7s_preseason
    fixtures, error = generate_preseason(league_id, league.season_year)

    # Auto-generate 7s pre-season to match
    if not error:
        generate_7s_preseason(league_id, league.season_year)

    if error:
        flash(error, "danger")
    else:
        flash(f"Pre-season generated: {len(fixtures)} match{'es' if len(fixtures) != 1 else ''}.", "success")

    return redirect(url_for("leagues.league_settings", league_id=league_id))

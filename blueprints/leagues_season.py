"""League season management: draft values, mid/off-season steps, delist actions."""

from datetime import datetime, timezone, timedelta
from flask import render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, AflPlayer, UserDraftWeights, LeagueDraftWeights, DraftPick, DraftSession, FantasyRoster
import config
from blueprints.leagues import leagues_bp

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
    from models.draft_model import rank_players

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


@leagues_bp.route("/<int:league_id>/midseason/start-step", methods=["POST"])
@login_required
def midseason_start_step(league_id):
    """Commissioner starts a mid-season step."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can manage season steps.", "warning")
        return redirect(url_for("leagues.commissioner_hub", league_id=league_id))

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
                                          min_delists=min_delists, closes_at=closes_at,
                                          period_type="midseason")
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

    return redirect(url_for("leagues.commissioner_hub", league_id=league_id))


@leagues_bp.route("/<int:league_id>/offseason/start-step", methods=["POST"])
@login_required
def offseason_start_step(league_id):
    """Commissioner starts an off-season step."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can manage season steps.", "warning")
        return redirect(url_for("leagues.commissioner_hub", league_id=league_id))

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
            return redirect(url_for("leagues.commissioner_hub", league_id=league_id))
        season_cfg.season_phase = "offseason"
        league.status = "offseason"
        min_delists = season_cfg.offseason_delist_min or 3
        delist_days = season_cfg.off_delist_duration_days or 7
        closes_at = datetime.now(timezone.utc) + timedelta(days=delist_days)
        from models.season_manager import open_delist_period
        _, error = open_delist_period(league_id, league.season_year,
                                      min_delists=min_delists, closes_at=closes_at,
                                      period_type="offseason")
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

    return redirect(url_for("leagues.commissioner_hub", league_id=league_id))


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
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        flash("You need a team to delist players.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    team_url = url_for("team.squad", league_id=league_id, team_id=user_team.id)

    from models.database import DelistPeriod
    delist_period = DelistPeriod.query.filter_by(
        league_id=league_id, year=league.season_year, status="open"
    ).first()
    if not delist_period:
        flash("No active delist period.", "warning")
        return redirect(team_url)

    player_id = request.form.get("player_id", type=int)
    if not player_id:
        flash("No player selected.", "warning")
        return redirect(team_url)

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
                notif_type="list_change",
                title=f"{user_team.name} delisted {player_name}",
                link=url_for("leagues.list_changes_page", league_id=league_id),
            )
        flash("Player delisted.", "success")

    next_url = request.form.get("next")
    if next_url:
        return redirect(next_url)
    return redirect(team_url)


"""Commissioner hub: season controls, LTIL approvals, roster management, wishlist."""

from datetime import datetime, timezone

from flask import render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, FantasyRoster, AflPlayer
import config
from blueprints.leagues import leagues_bp

# ── Commissioner Hub ──────────────────────────────────────────────


@leagues_bp.route("/<int:league_id>/commissioner")
@login_required
def commissioner_hub(league_id):
    """Commissioner Central Hub — season controls, LTIL approvals, tools."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "danger")
        return redirect(url_for("leagues.my_leagues"))
    if league.commissioner_id != current_user.id:
        flash("Commissioner access required.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    from models.database import (
        LongTermInjury, Trade, SeasonConfig, DelistPeriod, DelistAction,
        DraftSession,
    )

    # ── Season phase data (moved from season_hub) ──
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    if not season_cfg:
        season_cfg = SeasonConfig(league_id=league_id, year=league.season_year)
        db.session.add(season_cfg)
        db.session.commit()

    now = datetime.now(timezone.utc)

    # Current phase
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

    # Mid-season step statuses
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

    delist_period = DelistPeriod.query.filter_by(
        league_id=league_id, year=league.season_year
    ).order_by(DelistPeriod.id.desc()).first()

    mid_delist_status = "locked"
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

    # Off-season step statuses
    off_delist_status = "pending" if current_phase == "offseason" else "locked"
    if current_phase == "offseason":
        if delist_period and delist_period.status == "open":
            off_delist_status = "active"
        elif delist_period and delist_period.status == "closed":
            off_delist_status = "completed"

    off_ssp_status = "locked"
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

    delist_is_open = delist_period and delist_period.status == "open"

    # Min delists
    min_delists = 3
    if delist_period and delist_period.min_delists:
        min_delists = delist_period.min_delists
    elif season_cfg:
        if current_phase == "midseason" and season_cfg.mid_season_delist_required:
            min_delists = season_cfg.mid_season_delist_required
        elif season_cfg.offseason_delist_min:
            min_delists = season_cfg.offseason_delist_min

    # All-teams delist progress
    all_teams_progress = []
    if delist_is_open:
        all_teams = FantasyTeam.query.filter_by(league_id=league_id).all()
        for t in all_teams:
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

    # Trade window dates
    trade_window_dates = {
        "mid_open": season_cfg.mid_trade_window_open,
        "mid_close": season_cfg.mid_trade_window_close,
        "off_open": season_cfg.off_trade_window_open,
        "off_close": season_cfg.off_trade_window_close,
    }

    # ── LTIL data ──
    pending_ltil = LongTermInjury.query.filter_by(
        league_id=league_id, removed_at=None, status="pending"
    ).order_by(LongTermInjury.added_at.desc()).all()

    active_ltil = LongTermInjury.query.filter_by(
        league_id=league_id, removed_at=None, status="approved"
    ).order_by(LongTermInjury.added_at.desc()).all()

    recent_history = LongTermInjury.query.filter_by(
        league_id=league_id
    ).filter(
        db.or_(
            LongTermInjury.status == "rejected",
            LongTermInjury.removed_at.isnot(None),
        )
    ).order_by(LongTermInjury.reviewed_at.desc().nullslast(),
               LongTermInjury.removed_at.desc().nullslast()).limit(20).all()

    pending_trades_count = Trade.query.filter_by(
        league_id=league_id, status="pending"
    ).count()

    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.name).all()

    return render_template(
        "leagues/commissioner_hub.html",
        league=league,
        season_cfg=season_cfg,
        current_phase=current_phase,
        mid_trade_status=mid_trade_status,
        mid_delist_status=mid_delist_status,
        mid_draft_status=mid_draft_status,
        mid_lock_status=mid_lock_status,
        off_delist_status=off_delist_status,
        off_ssp_status=off_ssp_status,
        off_draft_status=off_draft_status,
        off_trade_status=off_trade_status,
        delist_period=delist_period,
        delist_is_open=delist_is_open,
        min_delists=min_delists,
        all_teams_progress=all_teams_progress,
        close_route=close_route,
        trade_window_dates=trade_window_dates,
        pending_ltil=pending_ltil,
        active_ltil=active_ltil,
        recent_history=recent_history,
        pending_trades_count=pending_trades_count,
        teams=teams,
        active_tab="commissioner",
    )


@leagues_bp.route("/<int:league_id>/commissioner/ltil-approve", methods=["POST"])
@login_required
def commissioner_ltil_approve(league_id):
    """Commissioner approves a pending LTIL entry."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        return jsonify({"error": "Commissioner access required"}), 403

    data = request.get_json(silent=True) or {}
    ltil_id = data.get("ltil_id")
    if not ltil_id:
        return jsonify({"error": "Missing ltil_id"}), 400

    from models.season_manager import approve_ltil
    ltil, err = approve_ltil(ltil_id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True, "message": f"{ltil.player.name} approved for LTIL"})


@leagues_bp.route("/<int:league_id>/commissioner/ltil-reject", methods=["POST"])
@login_required
def commissioner_ltil_reject(league_id):
    """Commissioner rejects a pending LTIL entry."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        return jsonify({"error": "Commissioner access required"}), 403

    data = request.get_json(silent=True) or {}
    ltil_id = data.get("ltil_id")
    if not ltil_id:
        return jsonify({"error": "Missing ltil_id"}), 400

    from models.season_manager import reject_ltil
    ltil, err = reject_ltil(ltil_id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True, "message": f"LTIL request rejected for {ltil.player.name}"})


@leagues_bp.route("/<int:league_id>/commissioner/ltil-remove", methods=["POST"])
@login_required
def commissioner_ltil_remove(league_id):
    """Commissioner removes an active LTIL entry (overrides offseason restriction)."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        return jsonify({"error": "Commissioner access required"}), 403

    data = request.get_json(silent=True) or {}
    team_id = data.get("team_id")
    player_id = data.get("player_id")
    if not team_id or not player_id:
        return jsonify({"error": "Missing team_id or player_id"}), 400

    from models.season_manager import remove_from_ltil
    ltil, err = remove_from_ltil(team_id, player_id, league_id=league_id, commissioner_override=True)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True, "message": f"{ltil.player.name} removed from LTIL"})


# ── Commissioner Tools ──────────────────────────────────────────────


@leagues_bp.route("/<int:league_id>/commissioner/team-roster/<int:team_id>")
@login_required
def commissioner_team_roster(league_id, team_id):
    """Return roster for a team (commissioner use)."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        return jsonify({"error": "Commissioner access required"}), 403
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    return jsonify([
        {"id": r.player.id, "name": r.player.name, "afl_team": r.player.afl_team,
         "position": r.player.position}
        for r in roster if r.player
    ])


@leagues_bp.route("/<int:league_id>/commissioner/delist", methods=["POST"])
@login_required
def commissioner_delist(league_id):
    """Commissioner removes a player from a team's roster (for incorrect picks)."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        return jsonify({"error": "Commissioner access required"}), 403

    data = request.get_json(silent=True) or {}
    team_id = data.get("team_id")
    player_id = data.get("player_id")
    if not team_id or not player_id:
        return jsonify({"error": "Missing team_id or player_id"}), 400

    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Team not found in this league"}), 404

    entry = FantasyRoster.query.filter_by(
        team_id=team_id, player_id=player_id, is_active=True
    ).first()
    if not entry:
        return jsonify({"error": "Player not on this team's roster"}), 404

    player_name = entry.player.name if entry.player else f"Player {player_id}"
    entry.is_active = False
    entry.is_captain = False
    entry.is_vice_captain = False
    entry.is_emergency = False
    db.session.commit()

    return jsonify({"ok": True, "message": f"{player_name} delisted from {team.name}"})


@leagues_bp.route("/<int:league_id>/commissioner/force-move", methods=["POST"])
@login_required
def commissioner_force_move(league_id):
    """Commissioner moves a player from one team to another (correcting draft mistakes).
    Does NOT create trade history records."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        return jsonify({"error": "Commissioner access required"}), 403

    data = request.get_json(silent=True) or {}
    from_team_id = data.get("from_team_id")
    to_team_id = data.get("to_team_id")
    player_id = data.get("player_id")
    if not from_team_id or not to_team_id or not player_id:
        return jsonify({"error": "Missing from_team_id, to_team_id, or player_id"}), 400

    if from_team_id == to_team_id:
        return jsonify({"error": "Source and destination teams must be different"}), 400

    from_team = db.session.get(FantasyTeam, from_team_id)
    to_team = db.session.get(FantasyTeam, to_team_id)
    if not from_team or from_team.league_id != league_id:
        return jsonify({"error": "Source team not found in this league"}), 404
    if not to_team or to_team.league_id != league_id:
        return jsonify({"error": "Destination team not found in this league"}), 404

    entry = FantasyRoster.query.filter_by(
        team_id=from_team_id, player_id=player_id, is_active=True
    ).first()
    if not entry:
        return jsonify({"error": "Player not on the source team's roster"}), 404

    # Check player isn't already on destination team
    existing = FantasyRoster.query.filter_by(
        team_id=to_team_id, player_id=player_id, is_active=True
    ).first()
    if existing:
        return jsonify({"error": "Player already on destination team"}), 409

    player_name = entry.player.name if entry.player else f"Player {player_id}"

    # Deactivate from source team
    entry.is_active = False
    entry.is_captain = False
    entry.is_vice_captain = False
    entry.is_emergency = False

    # Add to destination team
    new_entry = FantasyRoster(
        team_id=to_team_id,
        player_id=player_id,
        acquired_via="commissioner",
        is_active=True,
        is_benched=True,
    )
    db.session.add(new_entry)
    db.session.commit()

    # Notify all league members
    from models.notification_manager import create_notification
    all_teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    for t in all_teams:
        create_notification(
            user_id=t.owner_id,
            league_id=league_id,
            notif_type="list_change",
            title=f"Commissioner moved {player_name} to {to_team.name}",
            body=f"{player_name} moved from {from_team.name} to {to_team.name}.",
            link=url_for("leagues.list_changes_page", league_id=league_id),
        )

    return jsonify({
        "ok": True,
        "message": f"{player_name} moved from {from_team.name} to {to_team.name}"
    })


# ── Wishlist API ──────────────────────────────────────────────────────


@leagues_bp.route("/<int:league_id>/wishlist/toggle", methods=["POST"])
@login_required
def wishlist_toggle(league_id):
    from models.database import PlayerWishlist
    from blueprints import check_league_access
    league, _ = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "player_id required"}), 400

    existing = PlayerWishlist.query.filter_by(
        user_id=current_user.id, league_id=league_id, player_id=player_id
    ).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"wishlisted": False})

    db.session.add(PlayerWishlist(
        user_id=current_user.id, league_id=league_id, player_id=player_id
    ))
    db.session.commit()
    return jsonify({"wishlisted": True})


@leagues_bp.route("/<int:league_id>/wishlist/api")
@login_required
def wishlist_api(league_id):
    from models.database import PlayerWishlist
    from blueprints import check_league_access
    league, _ = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Access denied"}), 403

    rows = PlayerWishlist.query.filter_by(
        user_id=current_user.id, league_id=league_id
    ).all()
    return jsonify({"player_ids": [r.player_id for r in rows]})

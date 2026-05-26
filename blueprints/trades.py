"""Trade center blueprint: propose, respond, veto, comment, history."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, FantasyRoster, Trade, FutureDraftPick, SeasonConfig
from blueprints import check_league_access
from models.trade_manager import (
    propose_trade, respond_to_trade, cancel_trade, veto_trade,
    add_comment, get_team_trades, get_league_trades, expire_stale_trades,
)
from models.notification_manager import create_notification

trades_bp = Blueprint("trades", __name__, url_prefix="/leagues",
                      template_folder="../templates")


@trades_bp.route("/<int:league_id>/trades")
@login_required
def trade_center(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    is_commissioner = league.commissioner_id == current_user.id

    # Expire stale trades
    expire_stale_trades(league_id)

    # Get trades
    tab = request.args.get("tab", "incoming")
    if user_team:
        incoming = [t for t in get_team_trades(user_team.id) if t.recipient_team_id == user_team.id]
        outgoing = [t for t in get_team_trades(user_team.id) if t.proposer_team_id == user_team.id]
    else:
        incoming = []
        outgoing = []

    all_trades = get_league_trades(league_id)
    history = [t for t in all_trades if t.status != "pending"]

    if request.args.get("format") == "json":
        from config import TEAM_LOGOS

        # Trade window close — same shape as propose, so the center page
        # can show a countdown banner without a second round-trip.
        trade_close = None
        season_cfg = SeasonConfig.query.filter_by(
            league_id=league_id, year=league.season_year
        ).first()
        if season_cfg:
            for col in (season_cfg.mid_trade_window_close, season_cfg.off_trade_window_close):
                if col is None:
                    continue
                trade_close = col.isoformat() + ("" if col.tzinfo else "+00:00")
                break

        def _ser_team(t):
            return {"id": t.id, "name": t.name, "logo_url": t.logo_url} if t else None

        def _ser_asset(a, t):
            if a.player_id and a.player:
                return {
                    "kind": "player",
                    "name": a.player.name,
                    "position": a.player.position or "",
                    "afl_team": a.player.afl_team or "",
                    "sc_avg": a.player.sc_avg or 0,
                    "from_team_id": a.from_team_id,
                }
            if a.future_pick_id and a.future_pick:
                return {
                    "kind": "pick",
                    "name": f"{a.future_pick.year} R{a.future_pick.round_number}",
                    "year": a.future_pick.year,
                    "round_number": a.future_pick.round_number,
                    "from_team_id": a.from_team_id,
                }
            return {"kind": "unknown", "name": "?", "from_team_id": a.from_team_id}

        def _ser_trade(t):
            proposer_id = t.proposer_team_id
            recipient_id = t.recipient_team_id
            assets = [_ser_asset(a, t) for a in (t.assets or [])]
            from_proposer = [a for a in assets if a["from_team_id"] == proposer_id]
            from_recipient = [a for a in assets if a["from_team_id"] == recipient_id]
            return {
                "id": t.id,
                "status": t.status,
                "proposer_team": _ser_team(t.proposer_team),
                "recipient_team": _ser_team(t.recipient_team),
                "asset_count": len(assets),
                "from_proposer": from_proposer,
                "from_recipient": from_recipient,
                "proposed_at": t.proposed_at.strftime("%d %b %Y %H:%M") if t.proposed_at else None,
                "proposed_at_iso": (t.proposed_at.isoformat() + ("" if t.proposed_at.tzinfo else "+00:00")) if t.proposed_at else None,
                "intended_period": getattr(t, "intended_period", None),
            }

        return jsonify({
            "league": {"id": league.id, "name": league.name,
                       "trade_window_open": bool(league.trade_window_open),
                       "trade_close_at": trade_close},
            "user_team": _ser_team(user_team),
            "is_commissioner": is_commissioner,
            "tab": tab,
            "team_logos": TEAM_LOGOS,
            "incoming": [_ser_trade(t) for t in incoming],
            "outgoing": [_ser_trade(t) for t in outgoing],
            "history": [_ser_trade(t) for t in history],
        })

    return render_template("trades/center.html",
                           league=league,
                           user_team=user_team,
                           is_commissioner=is_commissioner,
                           incoming=incoming,
                           outgoing=outgoing,
                           history=history,
                           tab=tab)


@trades_bp.route("/<int:league_id>/trades/propose", methods=["GET", "POST"])
@login_required
def trade_propose(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not user_team:
        flash("You need a team to propose trades.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    other_teams = FantasyTeam.query.filter(
        FantasyTeam.league_id == league_id,
        FantasyTeam.id != user_team.id
    ).all()

    if request.method == "POST":
        recipient_team_id = request.form.get("recipient_team_id", type=int)
        give_ids = [int(x) for x in request.form.getlist("give_player_ids") if x]
        receive_ids = [int(x) for x in request.form.getlist("receive_player_ids") if x]
        give_pick_ids = [int(x) for x in request.form.getlist("give_pick_ids") if x]
        receive_pick_ids = [int(x) for x in request.form.getlist("receive_pick_ids") if x]
        notes = request.form.get("notes", "").strip()
        intended_period = request.form.get("intended_period", "").strip() or None

        if not recipient_team_id:
            flash("Select a team to trade with.", "warning")
        elif not give_ids and not receive_ids and not give_pick_ids and not receive_pick_ids:
            flash("Select at least one player or draft pick to trade.", "warning")
        else:
            trade, error = propose_trade(
                league_id, user_team.id, recipient_team_id,
                give_ids, receive_ids, notes or None,
                give_pick_ids=give_pick_ids, receive_pick_ids=receive_pick_ids,
                intended_period=intended_period,
            )
            if error:
                flash(error, "danger")
            else:
                # Notify recipient team owner
                recipient_team = db.session.get(FantasyTeam, recipient_team_id)
                if recipient_team:
                    create_notification(
                        user_id=recipient_team.owner_id,
                        league_id=league_id,
                        notif_type="trade_received",
                        title=f"Trade offer from {user_team.name}",
                        body="You have a new trade proposal to review.",
                        link=url_for("trades.trade_detail", league_id=league_id, trade_id=trade.id),
                        trade_id=trade.id,
                    )
                flash("Trade proposed!", "success")
                return redirect(url_for("trades.trade_detail", league_id=league_id, trade_id=trade.id))

    # Get rosters for player selection
    my_roster = FantasyRoster.query.filter_by(team_id=user_team.id, is_active=True).all()
    my_players = [r.player for r in my_roster]

    # Get future draft picks owned by user's team
    max_pick_year = league.season_year + 3
    my_picks = FutureDraftPick.query.filter(
        FutureDraftPick.league_id == league_id,
        FutureDraftPick.current_owner_id == user_team.id,
        FutureDraftPick.year <= max_pick_year,
    ).order_by(FutureDraftPick.year, FutureDraftPick.round_number).all()

    if request.args.get("format") == "json":
        from config import TEAM_LOGOS
        # Compute trade window close (the new propose UI shows a countdown)
        trade_close = None
        season_cfg = SeasonConfig.query.filter_by(
            league_id=league_id, year=league.season_year
        ).first()
        if season_cfg:
            for col in (season_cfg.mid_trade_window_close, season_cfg.off_trade_window_close):
                if col is None:
                    continue
                # Naive datetimes coerced to ISO with implied UTC.
                trade_close = col.isoformat() + ("" if col.tzinfo else "+00:00")
                break
        return jsonify({
            "league": {"id": league.id, "name": league.name},
            "user_team": {"id": user_team.id, "name": user_team.name,
                          "logo_url": user_team.logo_url},
            "trade_window_open": bool(league.trade_window_open),
            "trade_close_at": trade_close,
            "team_logos": TEAM_LOGOS,
            "other_teams": [
                {"id": t.id, "name": t.name,
                 "owner": t.owner.display_name if t.owner else "?",
                 "logo_url": t.logo_url}
                for t in other_teams
            ],
            "my_players": [
                {"id": p.id, "name": p.name,
                 "position": p.position or "",
                 "afl_team": p.afl_team or "",
                 "sc_avg": p.sc_avg or 0,
                 "age": p.age or 0,
                 "rating": p.rating}
                for p in my_players
            ],
            "my_picks": [
                {
                    "id": pk.id,
                    "year": pk.year,
                    "round_number": pk.round_number,
                    "original_team_id": pk.original_team_id,
                    "original_team": pk.original_team.name if pk.original_team else "?",
                    "is_own": pk.original_team_id == user_team.id,
                }
                for pk in my_picks
            ],
        })

    return render_template("trades/propose.html",
                           league=league,
                           user_team=user_team,
                           other_teams=other_teams,
                           my_players=my_players,
                           my_picks=my_picks,
                           trade_window_open=league.trade_window_open)


@trades_bp.route("/<int:league_id>/trades/<int:trade_id>")
@login_required
def trade_detail(league_id, trade_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    trade = db.session.get(Trade, trade_id)
    if not trade or trade.league_id != league_id:
        flash("Trade not found.", "warning")
        return redirect(url_for("trades.trade_center", league_id=league_id))
    is_commissioner = league.commissioner_id == current_user.id
    is_recipient = user_team and trade.recipient_team_id == user_team.id
    is_proposer = user_team and trade.proposer_team_id == user_team.id

    # Separate assets by direction and type
    giving_players = [a for a in trade.assets if a.from_team_id == trade.proposer_team_id and a.player_id]
    receiving_players = [a for a in trade.assets if a.from_team_id == trade.recipient_team_id and a.player_id]
    giving_picks = [a for a in trade.assets if a.from_team_id == trade.proposer_team_id and a.future_pick_id]
    receiving_picks = [a for a in trade.assets if a.from_team_id == trade.recipient_team_id and a.future_pick_id]

    if request.args.get("format") == "json":
        from config import TEAM_LOGOS

        def _ser_player_asset(a):
            p = a.player
            return {
                "player_id": p.id if p else None,
                "name": p.name if p else "?",
                "position": p.position if p else "",
                "sc_avg": p.sc_avg if p else 0,
                "afl_team": p.afl_team if p else "",
                "age": p.age if p else 0,
            }

        def _ser_pick_asset(a):
            fp = a.future_pick
            return {
                "id": fp.id if fp else None,
                "year": fp.year if fp else None,
                "round_number": fp.round_number if fp else None,
                "original_team_id": fp.original_team_id if fp else None,
                "original_team": fp.original_team.name if fp and fp.original_team else None,
                "from_team_id": a.from_team_id,
                "is_own": fp.original_team_id == a.from_team_id if fp else True,
            }

        def _ser_comment(c):
            return {
                "user_name": c.user.display_name if c.user else "?",
                "user_initial": (c.user.display_name[0].upper() if c.user and c.user.display_name else "?"),
                "comment": c.comment,
                "created_at": c.created_at.strftime("%d %b %H:%M") if c.created_at else None,
            }

        def _ser_team_full(t):
            if not t:
                return None
            return {
                "id": t.id,
                "name": t.name,
                "logo_url": t.logo_url,
                "owner": t.owner.display_name if t.owner else None,
            }

        return jsonify({
            "league": {"id": league.id, "name": league.name,
                       "trade_window_open": bool(league.trade_window_open)},
            "team_logos": TEAM_LOGOS,
            "trade": {
                "id": trade.id,
                "status": trade.status,
                "proposer_team": _ser_team_full(trade.proposer_team),
                "recipient_team": _ser_team_full(trade.recipient_team),
                "proposed_at": trade.proposed_at.strftime("%d %b %Y %H:%M") if trade.proposed_at else None,
                "review_deadline": trade.review_deadline.strftime("%d %b %Y %H:%M") if trade.review_deadline else None,
                "responded_at": trade.responded_at.strftime("%d %b %Y %H:%M") if trade.responded_at else None,
                "intended_period": trade.intended_period,
                "notes": trade.notes,
                "veto_reason": trade.veto_reason,
            },
            "giving": [_ser_player_asset(a) for a in giving_players],
            "receiving": [_ser_player_asset(a) for a in receiving_players],
            "giving_picks": [_ser_pick_asset(a) for a in giving_picks],
            "receiving_picks": [_ser_pick_asset(a) for a in receiving_picks],
            "comments": [_ser_comment(c) for c in (trade.comments or [])],
            "is_commissioner": is_commissioner,
            "is_recipient": bool(is_recipient),
            "is_proposer": bool(is_proposer),
        })

    return render_template("trades/detail.html",
                           league=league,
                           trade=trade,
                           giving=giving_players,
                           receiving=receiving_players,
                           giving_picks=giving_picks,
                           receiving_picks=receiving_picks,
                           is_commissioner=is_commissioner,
                           is_recipient=is_recipient,
                           is_proposer=is_proposer)


@trades_bp.route("/<int:league_id>/trades/<int:trade_id>/respond", methods=["POST"])
@login_required
def trade_respond(league_id, trade_id):
    action = request.form.get("action")
    trade = db.session.get(Trade, trade_id)
    if action == "accept":
        _, error = respond_to_trade(trade_id, accept=True)
        if error:
            flash(error, "danger")
        else:
            if trade:
                create_notification(
                    user_id=trade.proposer_team.owner_id,
                    league_id=league_id,
                    notif_type="trade_accepted",
                    title=f"{trade.recipient_team.name} accepted your trade",
                    link=url_for("trades.trade_detail", league_id=league_id, trade_id=trade_id),
                    trade_id=trade_id,
                )
                # Notify all other league members about the completed trade
                from models.database import TradeAsset
                assets = TradeAsset.query.filter_by(trade_id=trade_id).all()
                outgoing = [a.player.name for a in assets if a.player and a.from_team_id == trade.proposer_team_id]
                incoming = [a.player.name for a in assets if a.player and a.from_team_id == trade.recipient_team_id]
                trade_summary = f"{trade.proposer_team.name} traded {', '.join(outgoing or ['picks'])} for {', '.join(incoming or ['picks'])}"
                other_teams = FantasyTeam.query.filter(
                    FantasyTeam.league_id == league_id,
                    FantasyTeam.id != trade.proposer_team_id,
                    FantasyTeam.id != trade.recipient_team_id,
                ).all()
                for t in other_teams:
                    create_notification(
                        user_id=t.owner_id,
                        league_id=league_id,
                        notif_type="list_change",
                        title="Trade completed",
                        body=trade_summary,
                        link=url_for("leagues.list_changes_page", league_id=league_id),
                    )
            flash("Trade accepted! Rosters have been updated.", "success")
    elif action == "reject":
        _, error = respond_to_trade(trade_id, accept=False)
        if error:
            flash(error, "danger")
        else:
            if trade:
                create_notification(
                    user_id=trade.proposer_team.owner_id,
                    league_id=league_id,
                    notif_type="trade_rejected",
                    title=f"{trade.recipient_team.name} rejected your trade",
                    link=url_for("trades.trade_detail", league_id=league_id, trade_id=trade_id),
                    trade_id=trade_id,
                )
            flash("Trade rejected.", "info")
    elif action == "cancel":
        _, error = cancel_trade(trade_id)
        if error:
            flash(error, "danger")
        else:
            flash("Trade cancelled.", "info")
    return redirect(url_for("trades.trade_detail", league_id=league_id, trade_id=trade_id))


@trades_bp.route("/<int:league_id>/trades/<int:trade_id>/veto", methods=["POST"])
@login_required
def trade_veto(league_id, trade_id):
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can veto trades.", "warning")
        return redirect(url_for("trades.trade_detail", league_id=league_id, trade_id=trade_id))

    reason = request.form.get("reason", "").strip()
    trade = db.session.get(Trade, trade_id)
    _, error = veto_trade(trade_id, reason or None)
    if error:
        flash(error, "danger")
    else:
        # Notify both teams
        if trade:
            link = url_for("trades.trade_detail", league_id=league_id, trade_id=trade_id)
            for owner_id in (trade.proposer_team.owner_id, trade.recipient_team.owner_id):
                create_notification(
                    user_id=owner_id,
                    league_id=league_id,
                    notif_type="trade_vetoed",
                    title="Commissioner vetoed a trade",
                    body=reason[:100] if reason else None,
                    link=link,
                    trade_id=trade_id,
                )
        flash("Trade vetoed.", "warning")
    return redirect(url_for("trades.trade_detail", league_id=league_id, trade_id=trade_id))


@trades_bp.route("/<int:league_id>/trades/<int:trade_id>/comment", methods=["POST"])
@login_required
def trade_comment(league_id, trade_id):
    comment_text = request.form.get("comment", "").strip()
    if comment_text:
        add_comment(trade_id, current_user.id, comment_text)
    return redirect(url_for("trades.trade_detail", league_id=league_id, trade_id=trade_id))


@trades_bp.route("/<int:league_id>/trades/api/roster/<int:team_id>")
@login_required
def api_team_roster(league_id, team_id):
    """Get a team's roster for trade proposal UI."""
    league, user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Not a league member"}), 403
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    return jsonify([{
        "id": r.player.id,
        "name": r.player.name,
        "position": r.player.position,
        "afl_team": r.player.afl_team,
        "sc_avg": r.player.sc_avg,
        "age": r.player.age,
        "rating": r.player.rating,
    } for r in roster])


@trades_bp.route("/<int:league_id>/trades/api/picks/<int:team_id>")
@login_required
def api_team_picks(league_id, team_id):
    """Get a team's future draft picks for trade proposal UI."""
    league, user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Not a league member"}), 403
    max_year = league.season_year + 3
    picks = FutureDraftPick.query.filter(
        FutureDraftPick.league_id == league_id,
        FutureDraftPick.current_owner_id == team_id,
        FutureDraftPick.year <= max_year,
    ).order_by(FutureDraftPick.year, FutureDraftPick.round_number).all()
    return jsonify([{
        "id": p.id,
        "year": p.year,
        "round_number": p.round_number,
        "original_team": p.original_team.name if p.original_team else "?",
        "is_own": p.original_team_id == team_id,
    } for p in picks])

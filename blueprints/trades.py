"""Trade center blueprint: propose, respond, veto, comment, history."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, FantasyRoster, Trade, FutureDraftPick
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

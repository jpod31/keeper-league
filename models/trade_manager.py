"""Trade management: propose, accept/reject, cancel, veto, validate, expire."""

import threading
from datetime import datetime, timezone, timedelta

from models.database import (
    db, Trade, TradeAsset, TradeComment, FantasyRoster,
    FantasyTeam, League, AflPlayer, FutureDraftPick, LongTermInjury,
)

# Thread lock to serialise trade acceptance and prevent concurrent roster corruption
_trade_lock = threading.Lock()

TRADE_REVIEW_HOURS = 48


def counterable(trade_id, team_id):
    """The open offer `team_id` may counter, or None. Only the club an offer
    was sent to can counter it, and only while it is open."""
    t = db.session.get(Trade, trade_id) if trade_id else None
    if t and t.status == "pending" and t.recipient_team_id == team_id:
        return t
    return None


def counter_prefill(trade):
    """The countered offer turned round, for the trade builder: what they
    asked of you is what you give, what they offered is what you get."""
    a = trade.assets
    return {
        "trade_id": trade.id,
        "with_team_id": trade.proposer_team_id,
        "with_team": trade.proposer_team.name if trade.proposer_team else None,
        "give_player_ids": [x.player_id for x in a if x.player_id and x.from_team_id == trade.recipient_team_id],
        "give_pick_ids": [x.future_pick_id for x in a if x.future_pick_id and x.from_team_id == trade.recipient_team_id],
        "receive_player_ids": [x.player_id for x in a if x.player_id and x.from_team_id == trade.proposer_team_id],
        "receive_pick_ids": [x.future_pick_id for x in a if x.future_pick_id and x.from_team_id == trade.proposer_team_id],
    }


def propose_trade(league_id, proposer_team_id, recipient_team_id,
                  give_player_ids, receive_player_ids, notes=None,
                  give_pick_ids=None, receive_pick_ids=None,
                  intended_period=None, counter_of=None):
    """Propose a trade between two teams.
    give_player_ids: players moving FROM proposer TO recipient
    receive_player_ids: players moving FROM recipient TO proposer
    give_pick_ids: future draft pick IDs moving FROM proposer TO recipient
    receive_pick_ids: future draft pick IDs moving FROM recipient TO proposer
    counter_of: the id of an open offer from recipient to proposer that this
    answers. That offer is closed as "countered" once this one is made.
    Returns (trade, None) on success or (None, error_msg) on failure.
    """
    give_pick_ids = give_pick_ids or []
    receive_pick_ids = receive_pick_ids or []

    original = None
    if counter_of:
        original = counterable(counter_of, proposer_team_id)
        if not original or original.proposer_team_id != recipient_team_id:
            return None, "That offer can no longer be countered."

    # Validate
    error = check_trade_validity(league_id, proposer_team_id, recipient_team_id,
                                  give_player_ids, receive_player_ids,
                                  give_pick_ids=give_pick_ids,
                                  receive_pick_ids=receive_pick_ids)
    if error:
        return None, error

    trade = Trade(
        league_id=league_id,
        proposer_team_id=proposer_team_id,
        recipient_team_id=recipient_team_id,
        notes=notes,
        intended_period=intended_period,
        review_deadline=datetime.now(timezone.utc) + timedelta(hours=TRADE_REVIEW_HOURS),
        counter_of_id=original.id if original else None,
    )
    db.session.add(trade)
    db.session.flush()
    if original:
        original.status = "countered"
        original.responded_at = datetime.now(timezone.utc)

    # Create player trade assets
    for pid in give_player_ids:
        asset = TradeAsset(
            trade_id=trade.id,
            player_id=pid,
            from_team_id=proposer_team_id,
            to_team_id=recipient_team_id,
        )
        db.session.add(asset)

    for pid in receive_player_ids:
        asset = TradeAsset(
            trade_id=trade.id,
            player_id=pid,
            from_team_id=recipient_team_id,
            to_team_id=proposer_team_id,
        )
        db.session.add(asset)

    # Create draft pick trade assets
    for pick_id in give_pick_ids:
        asset = TradeAsset(
            trade_id=trade.id,
            future_pick_id=pick_id,
            from_team_id=proposer_team_id,
            to_team_id=recipient_team_id,
        )
        db.session.add(asset)

    for pick_id in receive_pick_ids:
        asset = TradeAsset(
            trade_id=trade.id,
            future_pick_id=pick_id,
            from_team_id=recipient_team_id,
            to_team_id=proposer_team_id,
        )
        db.session.add(asset)

    db.session.commit()
    return trade, None


def respond_to_trade(trade_id, accept):
    """Accept or reject a trade proposal.
    Returns (trade, None) on success or (None, error_msg) on failure.
    Uses _trade_lock to prevent concurrent acceptance from corrupting rosters.
    """
    with _trade_lock:
        # Re-fetch inside the lock to get the latest state
        trade = db.session.get(Trade, trade_id)
        if not trade:
            return None, "Trade not found."
        db.session.refresh(trade)
        if trade.status != "pending":
            return None, f"Trade is already {trade.status}."

        if accept:
            # Re-validate before executing (exclude this trade from double-dealing check)
            give_ids = [a.player_id for a in trade.assets if a.from_team_id == trade.proposer_team_id and a.player_id]
            receive_ids = [a.player_id for a in trade.assets if a.from_team_id == trade.recipient_team_id and a.player_id]
            give_pick_ids = [a.future_pick_id for a in trade.assets if a.from_team_id == trade.proposer_team_id and a.future_pick_id]
            receive_pick_ids = [a.future_pick_id for a in trade.assets if a.from_team_id == trade.recipient_team_id and a.future_pick_id]
            error = check_trade_validity(trade.league_id, trade.proposer_team_id,
                                          trade.recipient_team_id, give_ids, receive_ids,
                                          exclude_trade_id=trade.id,
                                          give_pick_ids=give_pick_ids,
                                          receive_pick_ids=receive_pick_ids)
            if error:
                return None, f"Trade no longer valid: {error}"

            # Check if trade window is open — if closed, mark as agreed (execute later)
            league = db.session.get(League, trade.league_id)
            if league and not league.trade_window_open:
                trade.status = "agreed"
                trade.responded_at = datetime.now(timezone.utc)
                withdrawn = withdraw_overlapping_offers(trade)
                db.session.commit()
                _tell_withdrawn(trade, withdrawn)
                return trade, None

            # Execute the swap
            _execute_trade(trade)
            trade.status = "accepted"
            withdrawn = withdraw_overlapping_offers(trade)
        else:
            trade.status = "rejected"
            withdrawn = []

        trade.responded_at = datetime.now(timezone.utc)
        db.session.commit()
    _tell_withdrawn(trade, withdrawn)

    # Log activity (outside lock)
    try:
        from models.activity_feed import log_activity
        status_label = trade.status.replace("_", " ").title()
        log_activity(
            trade.league_id, f"trade_{trade.status}",
            f"Trade {status_label}: {trade.proposer_team.name} ↔ {trade.recipient_team.name}",
            link=f"/leagues/{trade.league_id}/trades/{trade.id}",
        )
    except Exception:
        pass

    return trade, None


def _tell_withdrawn(done, withdrawn):
    """Tell both coaches on each withdrawn offer why it went."""
    if not withdrawn:
        return
    try:
        from models.notification_manager import create_notification
        for t in withdrawn:
            for team in (t.proposer_team, t.recipient_team):
                if team and team.owner_id:
                    create_notification(
                        user_id=team.owner_id, league_id=t.league_id, notif_type="trade_withdrawn",
                        title=f"Trade withdrawn: {t.proposer_team.name} and {t.recipient_team.name}",
                        body=f"A player or pick in it went in the {done.proposer_team.name} and "
                             f"{done.recipient_team.name} trade.",
                        link=f"/leagues/{t.league_id}/trades/{t.id}", trade_id=t.id,
                    )
    except Exception:
        pass


def cancel_trade(trade_id):
    """Cancel a pending or agreed trade (by proposer)."""
    trade = db.session.get(Trade, trade_id)
    if not trade:
        return None, "Trade not found."
    if trade.status not in ("pending", "agreed"):
        return None, f"Cannot cancel a {trade.status} trade."
    trade.status = "cancelled"
    trade.responded_at = datetime.now(timezone.utc)
    db.session.commit()
    return trade, None


def veto_trade(trade_id, reason=None):
    """Commissioner vetoes a trade."""
    trade = db.session.get(Trade, trade_id)
    if not trade:
        return None, "Trade not found."
    if trade.status not in ("pending", "accepted", "agreed"):
        return None, f"Cannot veto a {trade.status} trade."

    # If already accepted (executed), reverse it
    if trade.status == "accepted":
        _reverse_trade(trade)

    trade.status = "vetoed"
    trade.commissioner_veto = True
    trade.veto_reason = reason
    trade.responded_at = datetime.now(timezone.utc)
    db.session.commit()
    return trade, None


def add_comment(trade_id, user_id, comment_text):
    """Add a comment to a trade."""
    comment = TradeComment(
        trade_id=trade_id,
        user_id=user_id,
        comment=comment_text,
    )
    db.session.add(comment)
    db.session.commit()
    return comment


def check_trade_validity(league_id, proposer_team_id, recipient_team_id,
                          give_player_ids, receive_player_ids, exclude_trade_id=None,
                          give_pick_ids=None, receive_pick_ids=None):
    """Validate a trade. Returns error message string or None if valid.

    Trades can be proposed at any time (even when the window is closed).
    """
    give_pick_ids = give_pick_ids or []
    receive_pick_ids = receive_pick_ids or []

    league = db.session.get(League, league_id)
    if not league:
        return "League not found."

    if proposer_team_id == recipient_team_id:
        return "Cannot trade with yourself."

    if not give_player_ids and not receive_player_ids and not give_pick_ids and not receive_pick_ids:
        return "Trade must involve at least one player or draft pick."

    # Verify proposer owns the players they're giving
    proposer_roster = {
        r.player_id for r in
        FantasyRoster.query.filter_by(team_id=proposer_team_id, is_active=True).all()
    }
    for pid in give_player_ids:
        if pid not in proposer_roster:
            return f"Player {pid} is not on proposer's roster."

    # Verify recipient owns the players being received
    recipient_roster = {
        r.player_id for r in
        FantasyRoster.query.filter_by(team_id=recipient_team_id, is_active=True).all()
    }
    for pid in receive_player_ids:
        if pid not in recipient_roster:
            return f"Player {pid} is not on recipient's roster."

    # Validate future draft pick ownership, and that the pick is still to be used
    if give_pick_ids or receive_pick_ids:
        from models.draft_picks import first_open_year
        _lg = db.session.get(League, league_id) if league_id else None
        floor = first_open_year(_lg) if _lg else None
        for pick_id in list(give_pick_ids) + list(receive_pick_ids):
            pick = db.session.get(FutureDraftPick, pick_id)
            if pick and floor is not None and pick.year < floor:
                return f"The {pick.year} R{pick.round_number} pick has already been used."
    for pick_id in give_pick_ids:
        pick = db.session.get(FutureDraftPick, pick_id)
        if not pick or pick.current_owner_id != proposer_team_id:
            return f"Draft pick {pick_id} is not owned by the proposer."
    for pick_id in receive_pick_ids:
        pick = db.session.get(FutureDraftPick, pick_id)
        if not pick or pick.current_owner_id != recipient_team_id:
            return f"Draft pick {pick_id} is not owned by the recipient."

    # A player or pick can be in any number of OFFERS at once: a coach can
    # shop the same player to several clubs, or send one club two versions.
    # Lucas, 2026-11-25: "we cant send multiple trade offers to the same
    # person right now, and we can have only one pending trade offer at
    # once, that needs to change". Only an AGREED deal (accepted while the
    # window is shut, waiting to go through) holds its players and picks.
    # When one offer is accepted, every other open offer that shares a player
    # or pick with it is withdrawn (withdraw_overlapping_offers).
    all_player_ids = set(give_player_ids) | set(receive_player_ids)
    if all_player_ids:
        query = (
            db.session.query(TradeAsset.player_id)
            .join(Trade)
            .filter(Trade.league_id == league_id, Trade.status == "agreed",
                    TradeAsset.player_id.isnot(None))
        )
        if exclude_trade_id:
            query = query.filter(Trade.id != exclude_trade_id)
        if all_player_ids & {row[0] for row in query.all()}:
            return "A player in this trade is already in an agreed deal."

    all_pick_ids = set(give_pick_ids) | set(receive_pick_ids)
    if all_pick_ids:
        query = (
            db.session.query(TradeAsset.future_pick_id)
            .join(Trade)
            .filter(Trade.league_id == league_id, Trade.status == "agreed",
                    TradeAsset.future_pick_id.isnot(None))
        )
        if exclude_trade_id:
            query = query.filter(Trade.id != exclude_trade_id)
        if all_pick_ids & {row[0] for row in query.all()}:
            return "A draft pick in this trade is already in an agreed deal."

    # The same offer twice is a double click, not a second offer.
    if exclude_trade_id is None:
        wanted = _asset_key(proposer_team_id, recipient_team_id, give_player_ids,
                            receive_player_ids, give_pick_ids, receive_pick_ids)
        open_offers = Trade.query.filter_by(
            league_id=league_id, proposer_team_id=proposer_team_id,
            recipient_team_id=recipient_team_id, status="pending").all()
        for t in open_offers:
            if _trade_key(t) == wanted:
                return "You already have this exact offer open with them."

    # Validate roster sizes post-swap (only player assets affect roster)
    # LTIL players free up a list spot — subtract them from effective count (approved only)
    proposer_ltil = LongTermInjury.query.filter_by(
        team_id=proposer_team_id, removed_at=None, year=league.season_year, status="approved"
    ).count()
    recipient_ltil = LongTermInjury.query.filter_by(
        team_id=recipient_team_id, removed_at=None, year=league.season_year, status="approved"
    ).count()
    proposer_size = len(proposer_roster) - proposer_ltil - len(give_player_ids) + len(receive_player_ids)
    recipient_size = len(recipient_roster) - recipient_ltil - len(receive_player_ids) + len(give_player_ids)

    # Squad-size enforcement is window-aware. When a trade window is
    # OPEN we allow uneven trades (1-for-N, 2-for-N, etc.) that
    # temporarily over-roster a team — they'll resolve it via delist
    # or the mid-season draft before the window closes, and the
    # eligibility lock at window close blocks closure with any team
    # still over. When the window is CLOSED we enforce strictly so
    # a regular-season trade can't push anyone over.
    if not league.trade_window_open:
        if proposer_size > league.squad_size:
            return f"Proposer would exceed squad size ({proposer_size} > {league.squad_size})."
        if recipient_size > league.squad_size:
            return f"Recipient would exceed squad size ({recipient_size} > {league.squad_size})."

    return None


def _asset_key(proposer_id, recipient_id, give_players, receive_players, give_picks, receive_picks):
    return (frozenset(("p", pid, proposer_id) for pid in give_players)
            | frozenset(("p", pid, recipient_id) for pid in receive_players)
            | frozenset(("k", pid, proposer_id) for pid in give_picks)
            | frozenset(("k", pid, recipient_id) for pid in receive_picks))


def _trade_key(trade):
    return frozenset((("p", a.player_id) if a.player_id else ("k", a.future_pick_id)) + (a.from_team_id,)
                     for a in trade.assets)


def withdraw_overlapping_offers(trade):
    """Withdraw every other open offer that shares a player or pick with `trade`.

    Called once `trade` is accepted or agreed: those players and picks are
    spoken for. Returns the withdrawn trades, so the caller can tell the
    coaches. Caller commits.
    """
    pids = {a.player_id for a in trade.assets if a.player_id}
    picks = {a.future_pick_id for a in trade.assets if a.future_pick_id}
    if not pids and not picks:
        return []
    cond = []
    if pids:
        cond.append(TradeAsset.player_id.in_(pids))
    if picks:
        cond.append(TradeAsset.future_pick_id.in_(picks))
    ids = {row[0] for row in db.session.query(TradeAsset.trade_id).join(Trade).filter(
        Trade.league_id == trade.league_id, Trade.status == "pending",
        Trade.id != trade.id, db.or_(*cond)).all()}
    if not ids:
        return []
    now = datetime.now(timezone.utc)
    gone = Trade.query.filter(Trade.id.in_(ids)).all()
    for t in gone:
        t.status = "withdrawn"
        t.responded_at = now
    return gone


def expire_stale_trades(league_id):
    """Expire trades past their review deadline."""
    now = datetime.now(timezone.utc)
    expired = Trade.query.filter(
        Trade.league_id == league_id,
        Trade.status == "pending",
        Trade.review_deadline < now,
    ).all()
    for trade in expired:
        trade.status = "expired"
        trade.responded_at = now
    if expired:
        db.session.commit()
    return len(expired)


def get_team_trades(team_id, status=None):
    """Get all trades involving a team (incoming + outgoing)."""
    query = Trade.query.filter(
        db.or_(
            Trade.proposer_team_id == team_id,
            Trade.recipient_team_id == team_id,
        )
    )
    if status:
        query = query.filter_by(status=status)
    return query.order_by(Trade.proposed_at.desc()).all()


def get_league_trades(league_id, status=None):
    """Get all trades in a league."""
    query = Trade.query.filter_by(league_id=league_id)
    if status:
        query = query.filter_by(status=status)
    return query.order_by(Trade.proposed_at.desc()).all()


def _execute_trade(trade):
    """Swap roster entries and draft pick ownership for an accepted trade."""
    from models.season_manager import drop_player_from_future_7s
    from models.database import League as _League
    _lg = db.session.get(_League, trade.league_id)
    _year = _lg.season_year if _lg else None
    for asset in trade.assets:
        if asset.player_id:
            # Deactivate from source team
            source_entry = FantasyRoster.query.filter_by(
                team_id=asset.from_team_id, player_id=asset.player_id, is_active=True
            ).first()
            if source_entry:
                source_entry.is_active = False
                # Player left this team — drop them from its upcoming 7s lineups.
                if _year is not None:
                    drop_player_from_future_7s(trade.league_id, asset.from_team_id, asset.player_id, _year)

            # Add to destination team
            dest_entry = FantasyRoster(
                team_id=asset.to_team_id,
                player_id=asset.player_id,
                acquired_via="trade",
            )
            db.session.add(dest_entry)

        if asset.future_pick_id:
            # Transfer draft pick ownership
            pick = db.session.get(FutureDraftPick, asset.future_pick_id)
            if pick:
                pick.current_owner_id = asset.to_team_id


def _reverse_trade(trade):
    """Reverse an already-executed trade (for veto)."""
    for asset in trade.assets:
        if asset.player_id:
            # Deactivate the destination entry (the one created by _execute_trade)
            dest_entry = FantasyRoster.query.filter_by(
                team_id=asset.to_team_id, player_id=asset.player_id,
                acquired_via="trade", is_active=True
            ).first()
            if dest_entry:
                dest_entry.is_active = False

            # Re-activate the source entry
            source_entry = FantasyRoster.query.filter_by(
                team_id=asset.from_team_id, player_id=asset.player_id, is_active=False
            ).order_by(FantasyRoster.acquired_at.desc()).first()
            if source_entry:
                source_entry.is_active = True

        if asset.future_pick_id:
            # Revert draft pick ownership
            pick = db.session.get(FutureDraftPick, asset.future_pick_id)
            if pick:
                pick.current_owner_id = asset.from_team_id

"""Backfill league-wide notifications for events that happened in a
recent window but didn't generate notifications (because the route
that performed the action wasn't fanning out at the time).

Scope: today's mid-season trade window activity.

Events covered:
  - Trade accepted (re-titled "executed" for the user-facing string,
    since "accepted" tends to read as "consented but not yet done").
    Skipped if a trade_accepted notification already exists for the
    trade — we don't double-send.
  - LTIL added (status pending or approved).
  - LTIL removed (player came off the list).
  - Player delisted (DelistAction).
  - Player acquired via draft (DraftPick on a completed draft) —
    fans out only for picks made within the window.

Usage:
  python scripts/backfill_notifications.py [--league-id 3] [--hours 36] [--dry-run]

Idempotent within a single backfill scope: for each event we
generate a stable de-duplication key based on (notif_type, link,
title) and skip rows whose user already has that key.
"""

import argparse
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from flask import url_for
from models.database import (
    db, FantasyTeam, AflPlayer, Trade, TradeAsset,
    LongTermInjury, DelistAction, DelistPeriod,
    DraftPick, DraftSession, Notification,
)
from models.notification_manager import create_notification


def _already_notified(user_id, league_id, title):
    """Skip if this exact title already exists for this user/league.
    Cheap idempotency — re-running won't duplicate."""
    return Notification.query.filter_by(
        user_id=user_id, league_id=league_id, title=title
    ).first() is not None


def _fan_out(league_id, title, body, link, notif_type="list_change"):
    """Create one notification per fantasy team owner in the league
    (skipping duplicates)."""
    n = 0
    for t in FantasyTeam.query.filter_by(league_id=league_id).all():
        if _already_notified(t.owner_id, league_id, title):
            continue
        create_notification(
            user_id=t.owner_id,
            league_id=league_id,
            notif_type=notif_type,
            title=title,
            body=body,
            link=link,
        )
        n += 1
    return n


def backfill_trades(league_id, since):
    """Trades 'accepted' but the league-wide notification didn't fire
    (only the proposer got trade_accepted under the old behaviour)."""
    n_titles = 0
    for t in Trade.query.filter(
        Trade.league_id == league_id,
        Trade.status == "accepted",
        Trade.responded_at >= since,
    ).all():
        proposer = db.session.get(FantasyTeam, t.proposer_team_id)
        recipient = db.session.get(FantasyTeam, t.recipient_team_id)
        if not proposer or not recipient:
            continue

        # Build a readable description of what moved
        assets = TradeAsset.query.filter_by(trade_id=t.id).all()
        from_p, from_r = [], []
        for a in assets:
            if a.player_id:
                ap = db.session.get(AflPlayer, a.player_id)
                label = ap.name if ap else f"player#{a.player_id}"
            elif a.future_pick_id and a.future_pick:
                label = f"{a.future_pick.year} R{a.future_pick.round_number} pick"
            else:
                label = "?"
            (from_p if a.from_team_id == t.proposer_team_id else from_r).append(label)

        title = f"Trade executed: {proposer.name} ↔ {recipient.name}"
        body = (
            f"{proposer.name} sent {', '.join(from_p) or 'nothing'}; "
            f"{recipient.name} sent {', '.join(from_r) or 'nothing'}."
        )
        link = url_for("trades.trade_detail", league_id=league_id, trade_id=t.id)
        n_titles += _fan_out(league_id, title, body, link, notif_type="trade_accepted")
    return n_titles


def backfill_ltil_added(league_id, since):
    n_titles = 0
    for lt in LongTermInjury.query.filter(
        LongTermInjury.league_id == league_id,
        LongTermInjury.added_at >= since,
    ).all():
        team = db.session.get(FantasyTeam, lt.team_id)
        player = db.session.get(AflPlayer, lt.player_id)
        if not team or not player:
            continue
        suffix = " (pending approval)" if lt.status == "pending" else ""
        title = f"{team.name} added {player.name} to LTIL{suffix}"
        body = f"{player.name} placed on the long-term injury list."
        link = url_for("leagues.list_changes_page", league_id=league_id)
        n_titles += _fan_out(league_id, title, body, link)
    return n_titles


def backfill_ltil_removed(league_id, since):
    n_titles = 0
    for lt in LongTermInjury.query.filter(
        LongTermInjury.league_id == league_id,
        LongTermInjury.removed_at != None,  # noqa: E711
        LongTermInjury.removed_at >= since,
    ).all():
        team = db.session.get(FantasyTeam, lt.team_id)
        player = db.session.get(AflPlayer, lt.player_id)
        if not team or not player:
            continue
        title = f"{team.name} returned {player.name} from LTIL"
        body = f"{player.name} is back on the active squad."
        link = url_for("leagues.list_changes_page", league_id=league_id)
        n_titles += _fan_out(league_id, title, body, link)
    return n_titles


def backfill_delists(league_id, since):
    n_titles = 0
    periods = DelistPeriod.query.filter_by(league_id=league_id).all()
    period_ids = [p.id for p in periods]
    if not period_ids:
        return 0
    for da in DelistAction.query.filter(
        DelistAction.delist_period_id.in_(period_ids),
        DelistAction.delisted_at >= since,
    ).all():
        team = db.session.get(FantasyTeam, da.team_id)
        player = db.session.get(AflPlayer, da.player_id)
        if not team or not player:
            continue
        title = f"{team.name} delisted {player.name}"
        body = f"{player.name} removed from {team.name}'s squad."
        link = url_for("leagues.list_changes_page", league_id=league_id)
        n_titles += _fan_out(league_id, title, body, link)
    return n_titles


def backfill_draft_picks(league_id, since):
    """Player acquired via draft — only fans out for picks completed
    within the window. The initial draft is months old so this only
    catches mid-season / supplemental drafts."""
    n_titles = 0
    sessions = DraftSession.query.filter_by(
        league_id=league_id, status="completed", is_mock=False
    ).all()
    for ds in sessions:
        completed_at = ds.completed_at if hasattr(ds, "completed_at") else None
        if completed_at and completed_at < since:
            continue
        for dp in DraftPick.query.filter_by(draft_session_id=ds.id).all():
            if not dp.player_id or not dp.picked_at:
                continue
            if dp.picked_at < since:
                continue
            team = db.session.get(FantasyTeam, dp.team_id)
            player = db.session.get(AflPlayer, dp.player_id)
            if not team or not player:
                continue
            draft_label = ds.draft_round_type or "draft"
            title = f"{team.name} drafted {player.name} (pick {dp.pick_number})"
            body = f"{player.name} joined {team.name} via the {draft_label} draft."
            link = url_for("leagues.list_changes_page", league_id=league_id)
            n_titles += _fan_out(league_id, title, body, link)
    return n_titles


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league-id", type=int, default=3)
    parser.add_argument("--hours", type=int, default=36,
                        help="window of events to backfill (default 36h)")
    parser.add_argument("--dry-run", action="store_true",
                        help="count what would be created without writing")
    args = parser.parse_args()

    since = datetime.utcnow() - timedelta(hours=args.hours)
    print(f"Backfill window: since {since.isoformat()} UTC")
    print(f"League: {args.league_id}")
    print(f"Dry run: {args.dry_run}")

    app = create_app()
    with app.test_request_context():  # url_for needs an app/request context
        if args.dry_run:
            # Stub create_notification to count without writing
            from models import notification_manager
            counts = {"called": 0}
            orig = notification_manager.create_notification

            def stub(*a, **k):
                counts["called"] += 1
                return None
            notification_manager.create_notification = stub
            try:
                t = backfill_trades(args.league_id, since)
                lta = backfill_ltil_added(args.league_id, since)
                ltr = backfill_ltil_removed(args.league_id, since)
                de = backfill_delists(args.league_id, since)
                dr = backfill_draft_picks(args.league_id, since)
            finally:
                notification_manager.create_notification = orig
            print(f"Would create: trades={t}, ltil_add={lta}, ltil_rm={ltr}, delist={de}, draft={dr}")
            return

        n_trade = backfill_trades(args.league_id, since)
        n_ltil_a = backfill_ltil_added(args.league_id, since)
        n_ltil_r = backfill_ltil_removed(args.league_id, since)
        n_delist = backfill_delists(args.league_id, since)
        n_draft = backfill_draft_picks(args.league_id, since)
        total = n_trade + n_ltil_a + n_ltil_r + n_delist + n_draft
        print(
            f"Created notifications — trades:{n_trade}, ltil_add:{n_ltil_a}, "
            f"ltil_remove:{n_ltil_r}, delist:{n_delist}, draft:{n_draft} "
            f"(total {total})"
        )


if __name__ == "__main__":
    main()

"""League records helpers: list changes / transaction history."""

from collections import defaultdict

from models.database import (
    db, FantasyTeam, FantasyRoster, AflPlayer,
    DraftPick, DraftSession, Trade, TradeAsset,
    DelistPeriod, DelistAction,
)


def compute_list_changes(league_id):
    """Build a chronological feed of all list changes for a league.

    Returns list of dicts sorted by date descending:
        {type, date, year, description, team, player_name}
    """
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    team_map = {t.id: t.name for t in teams}

    entries = []

    # ── 1. Draft picks (initial + supplemental) ──────────────────────
    draft_sessions = DraftSession.query.filter_by(league_id=league_id).all()
    for ds in draft_sessions:
        is_supp = ds.draft_round_type == "supplemental"
        picks = DraftPick.query.filter(
            DraftPick.draft_session_id == ds.id,
            DraftPick.player_id.isnot(None),
            DraftPick.is_pass == False,
        ).all()
        for pick in picks:
            player_name = pick.player.name if pick.player else "Unknown"
            team_name = team_map.get(pick.team_id, "Unknown")
            if is_supp:
                desc = (f"{team_name} selected {player_name} in supplemental draft "
                        f"(Pick #{pick.pick_number})")
                entry_type = "supplemental"
            else:
                desc = (f"{team_name} drafted {player_name} with pick "
                        f"#{pick.pick_number} (Round {pick.draft_round})")
                entry_type = "draft"
            entries.append({
                "type": entry_type,
                "date": pick.picked_at or ds.started_at or ds.scheduled_start,
                "year": (pick.picked_at or ds.started_at or ds.scheduled_start).year
                        if (pick.picked_at or ds.started_at or ds.scheduled_start) else None,
                "description": desc,
                "team": team_name,
                "player_name": player_name,
            })

    # ── 2. Trades (accepted only) ────────────────────────────────────
    trades = Trade.query.filter_by(league_id=league_id, status="accepted").all()
    for trade in trades:
        assets = TradeAsset.query.filter_by(trade_id=trade.id).all()
        from_team = team_map.get(trade.proposer_team_id, "Unknown")
        to_team = team_map.get(trade.recipient_team_id, "Unknown")

        # Group assets by direction
        outgoing = []  # from proposer to recipient
        incoming = []  # from recipient to proposer
        for a in assets:
            name = a.player.name if a.player else (
                f"R{a.future_pick.round_number} {a.future_pick.year} pick"
                if a.future_pick else "Unknown asset"
            )
            if a.from_team_id == trade.proposer_team_id:
                outgoing.append(name)
            else:
                incoming.append(name)

        if outgoing and incoming:
            desc = (f"{from_team} traded {', '.join(outgoing)} to {to_team} "
                    f"for {', '.join(incoming)}")
        elif outgoing:
            desc = f"{from_team} traded {', '.join(outgoing)} to {to_team}"
        elif incoming:
            desc = f"{to_team} traded {', '.join(incoming)} to {from_team}"
        else:
            desc = f"Trade between {from_team} and {to_team}"

        trade_date = trade.responded_at or trade.proposed_at
        entries.append({
            "type": "trade",
            "date": trade_date,
            "year": trade_date.year if trade_date else None,
            "description": desc,
            "team": from_team,
            "player_name": ", ".join(outgoing + incoming) if (outgoing or incoming) else "",
        })

    # ── 3. Delists ───────────────────────────────────────────────────
    delist_periods = DelistPeriod.query.filter_by(league_id=league_id).all()
    for dp in delist_periods:
        actions = DelistAction.query.filter_by(delist_period_id=dp.id).all()
        for action in actions:
            player_name = action.player.name if action.player else "Unknown"
            team_name = team_map.get(action.team_id, "Unknown")
            entries.append({
                "type": "delist",
                "date": action.delisted_at,
                "year": dp.year,
                "description": f"{team_name} delisted {player_name}",
                "team": team_name,
                "player_name": player_name,
            })

    # ── 4. SSP signings ──────────────────────────────────────────────
    ssp_rosters = (
        FantasyRoster.query
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.acquired_via == "ssp")
        .all()
    )
    for fr in ssp_rosters:
        player_name = fr.player.name if fr.player else "Unknown"
        team_name = team_map.get(fr.team_id, "Unknown")
        entries.append({
            "type": "ssp",
            "date": fr.acquired_at,
            "year": fr.acquired_at.year if fr.acquired_at else None,
            "description": f"{team_name} signed {player_name} as SSP replacement",
            "team": team_name,
            "player_name": player_name,
        })

    # ── 5. Commissioner additions ────────────────────────────────────
    comm_rosters = (
        FantasyRoster.query
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.acquired_via == "commissioner")
        .all()
    )
    for fr in comm_rosters:
        player_name = fr.player.name if fr.player else "Unknown"
        team_name = team_map.get(fr.team_id, "Unknown")
        entries.append({
            "type": "commissioner",
            "date": fr.acquired_at,
            "year": fr.acquired_at.year if fr.acquired_at else None,
            "description": f"Commissioner added {player_name} to {team_name}",
            "team": team_name,
            "player_name": player_name,
        })

    # Sort by date descending (None dates go last)
    entries.sort(key=lambda e: e["date"] or __import__("datetime").datetime.min, reverse=True)

    return entries

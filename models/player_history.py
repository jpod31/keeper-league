"""A player's time in a keeper league, stint by stint.

``fantasy_roster`` holds one row per stint (a club drafting, trading for or
signing a player), so a player who was drafted, delisted and drafted again
has two. ``league_stints`` turns those rows into the story the player pool
and the former players page tell: who had him, how he arrived, with which
pick, and how he left.

One helper, because the pool, the former players page and the season squads
all answer "how did this club get this player" and must not disagree.
"""

from collections import defaultdict
from datetime import datetime

from models.database import (
    db, FantasyRoster, FantasyTeam, User, DraftSession, DraftPick,
    DelistAction, DelistPeriod, Trade, TradeAsset,
)

METHOD_LABEL = {
    "draft": "Drafted",
    "supplemental": "Drafted",
    "trade": "Traded in",
    "ssp": "SSP signing",
    "commissioner": "Commissioner move",
}


def draft_label(session):
    """What to call a draft: "2026 draft", "2026 mid-season draft",
    "2026 off-season draft". A supplemental draft held from September to
    February is the off-season one for the season that has just ended."""
    when = session.started_at or session.completed_at or session.scheduled_start
    if not when:
        return "Draft"
    if session.draft_round_type != "supplemental":
        return f"{when.year} draft"
    if when.month >= 9:
        return f"{when.year} off-season draft"
    if when.month <= 2:
        return f"{when.year - 1} off-season draft"
    return f"{when.year} mid-season draft"


def _naive(dt):
    return dt.replace(tzinfo=None) if dt is not None and dt.tzinfo else dt


def league_stints(league_id, player_ids=None):
    """player_id -> [stint, ...] oldest first.

    stint: team_id, team, coach, method, acquired_at, is_active,
           pick_number, draft_round, draft_label, draft_year, draft_type,
           left ('delisted' | 'traded' | 'moved' | None), left_at, left_to.
    """
    q = (db.session.query(FantasyRoster, FantasyTeam)
         .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
         .filter(FantasyTeam.league_id == league_id))
    if player_ids is not None:
        ids = list(player_ids)
        if not ids:
            return {}
        q = q.filter(FantasyRoster.player_id.in_(ids))
    rows = q.all()
    if not rows:
        return {}

    teams = {t.id: t for t in FantasyTeam.query.filter_by(league_id=league_id).all()}
    owners = {u.id: (u.display_name or u.username)
              for u in User.query.filter(User.id.in_({t.owner_id for t in teams.values()})).all()}

    # Draft picks, by (player, club): a club can pick the same player twice.
    sessions = {s.id: s for s in DraftSession.query.filter_by(
        league_id=league_id, is_mock=False).all()}
    picks = defaultdict(list)
    if sessions:
        for p in DraftPick.query.filter(
                DraftPick.draft_session_id.in_(list(sessions)),
                DraftPick.player_id.isnot(None)).all():
            picks[(p.player_id, p.team_id)].append(p)

    # How stints ended.
    delists = defaultdict(list)
    period_ids = [p.id for p in DelistPeriod.query.filter_by(league_id=league_id).all()]
    if period_ids:
        for a in DelistAction.query.filter(DelistAction.delist_period_id.in_(period_ids)).all():
            delists[(a.player_id, a.team_id)].append(_naive(a.delisted_at))
    trades_out = defaultdict(list)
    for asset, trade in (db.session.query(TradeAsset, Trade)
                         .join(Trade, TradeAsset.trade_id == Trade.id)
                         .filter(Trade.league_id == league_id, Trade.status == "accepted",
                                 TradeAsset.player_id.isnot(None)).all()):
        trades_out[(asset.player_id, asset.from_team_id)].append(
            (_naive(trade.responded_at or trade.proposed_at), asset.to_team_id))

    out = defaultdict(list)
    rows.sort(key=lambda rt: (_naive(rt[0].acquired_at) or datetime.min, rt[0].id))
    for fr, team in rows:
        got = _naive(fr.acquired_at)
        stint = {
            "team_id": team.id,
            "team": team.name,
            "coach": owners.get(team.owner_id, ""),
            "method": fr.acquired_via or "draft",
            "acquired_at": got,
            "is_active": bool(fr.is_active),
            "pick_number": None, "draft_round": None, "draft_label": None,
            "draft_year": None, "draft_type": None,
            "left": None, "left_at": None, "left_to": None,
        }
        if (fr.acquired_via or "draft") in ("draft", "supplemental"):
            cands = picks.get((fr.player_id, team.id), [])
            if cands:
                # The pick made closest to when this stint began.
                def gap(p):
                    at = _naive(p.picked_at)
                    return abs((at - got).total_seconds()) if at and got else 0
                pick = min(cands, key=gap)
                sess = sessions.get(pick.draft_session_id)
                when = sess and (sess.started_at or sess.completed_at or sess.scheduled_start)
                stint.update(
                    pick_number=pick.pick_number, draft_round=pick.draft_round,
                    draft_label=draft_label(sess) if sess else None,
                    draft_year=when.year if when else None,
                    draft_type=sess.draft_round_type if sess else None,
                )
        if not fr.is_active:
            ends = []
            for at in delists.get((fr.player_id, team.id), []):
                if at and (got is None or at >= got):
                    ends.append((at, "delisted", None))
            for at, to_id in trades_out.get((fr.player_id, team.id), []):
                if at and (got is None or at >= got):
                    ends.append((at, "traded", to_id))
            if ends:
                at, how, to_id = min(ends, key=lambda e: e[0])
                stint.update(left=how, left_at=at,
                             left_to=teams[to_id].name if to_id in teams else None)
            else:
                stint["left"] = "moved"
        out[fr.player_id].append(stint)
    return dict(out)


def serialise_stint(s):
    return {
        "team_id": s["team_id"],
        "team": s["team"],
        "coach": s["coach"],
        "method": s["method"],
        "acquired_at": s["acquired_at"].isoformat() if s["acquired_at"] else None,
        "is_active": s["is_active"],
        "delisted": s["left"] == "delisted",
        "left": s["left"],
        "left_at": s["left_at"].isoformat() if s["left_at"] else None,
        "left_to": s["left_to"],
        "pick_number": s["pick_number"],
        "draft_round": s["draft_round"],
        "draft_label": s["draft_label"],
        "draft_year": s["draft_year"] or "",
        "draft_type": s["draft_type"],
    }

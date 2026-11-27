"""Post-round honours and records news (2026-11-27).

After a round is finalised, every honour earned and every record broken goes
to the league's Activity and to each coach's notifications. Grouped: one line
per badge per round, so when fifteen players reach 50 club games the line
says so once (Lucas: "loads of players will simultaneously get their 25th
game.. so the notification should say 15 players achieved this badge this
round"), with the names in the body.

What has been announced is kept in honour_announcement, keyed per honour or
per record. The first run for a league records everything that already
exists without posting it, so a deploy never replays a past season.
"""

import logging
from collections import defaultdict

from models.database import db, FantasyTeam, AflPlayer, HonourAnnouncement

logger = logging.getLogger(__name__)

NAMES_SHOWN = 12


def _honour_key(h):
    return f"h:{h['kind']}:{h['player_id']}:{h.get('year') or ''}:{h.get('round') or h.get('step') or ''}:{h.get('team_id') or ''}"


# record keys where lower is better
LOWER = {"low", "closest"}


def _names(items):
    shown = [f"{n} ({c})" if c else n for n, c in items[:NAMES_SHOWN]]
    more = len(items) - NAMES_SHOWN
    return ", ".join(shown) + (f" and {more} more" if more > 0 else "") + "."


def _honour_lines(new, teams, players):
    """Group new honours into one line each: (title, body)."""
    from models.player_honours import KINDS
    groups = defaultdict(list)
    for h in new:
        groups[(h["kind"], h.get("step"))].append(h)
    out = []
    for (kind, step), hs in groups.items():
        name = KINDS[kind][0]
        who = [(players[h["player_id"]].name if h["player_id"] in players else "?", teams.get(h.get("team_id"), ""))
               for h in hs]
        n = len(hs)
        if kind == "clubgames":
            label = "Life Member, 100 club games" if step == 100 else f"{step} club games"
            if n == 1:
                out.append((f"{who[0][0]} reached {label}" + (f" for {who[0][1]}" if who[0][1] else ""), None))
            else:
                out.append((f"{n} players reached {label} this round", _names(who)))
        elif kind == "siren":
            for h, (nm, club) in zip(hs, who):
                out.append((f"The Siren: {nm} won round {h.get('round')} for {club}", h.get("detail")))
        elif kind in ("flag", "flag7"):
            by_team = defaultdict(list)
            for h, w in zip(hs, who):
                by_team[w[1]].append(w[0])
            for club, ps in by_team.items():
                out.append((f"{club} won the {hs[0].get('year')} {'7s ' if kind == 'flag7' else ''}flag: {len(ps)} premiership players",
                            _names([(p, None) for p in ps])))
        elif kind == "allleague":
            out.append((f"The {hs[0].get('year')} All-League 23 is named", _names(who)))
        elif kind == "champion":
            out.append((f"{n} Club Champion{'s' if n > 1 else ''} crowned" if n > 1 else f"{who[0][0]} is {who[0][1]}'s Club Champion",
                        _names(who) if n > 1 else None))
        elif kind in ("hof", "legend"):
            title = "the Hall of Fame" if kind == "hof" else "Legend status"
            out.append((f"{who[0][0]} enters {title}" if n == 1 else f"{n} players enter {title}", None if n == 1 else _names(who)))
        else:
            # Keeper Medal, Rising Star, 7s Medal, Called Up, Triple Crown
            if n == 1:
                out.append((f"{who[0][0]} won {'the ' if kind in ('keepermedal', 'medal7', 'triple') else ''}{name}", hs[0].get("detail")))
            else:
                out.append((f"{n} players earned {name} this round", _names(who)))
    return out


def _record_lines(league_id, seen, fresh):
    """New records against what was last announced: (title, body), and the
    values to store."""
    from models.record_book import build
    book = build(league_id)
    out, store = [], {}
    for r in book["clubs"] + book["players"] + book["matches"]:
        top = r.get("top")
        if not top or r["key"] == "flags":
            continue
        key = f"r:{r['key']}"
        v = float(top["value"])
        old = seen.get(key)
        store[key] = v
        if old is None or fresh:
            continue
        better = v < old if r["key"] in LOWER else v > old
        if not better:
            continue
        unit = f" {r['unit']}" if r["unit"] else ""
        holder = top.get("player") or top.get("team") or top.get("winner") or ""
        fmt = (lambda x: f"{x:,.1f}" if x != int(x) else f"{int(x):,}")
        out.append((f"New record, {r['label'].lower()}: {holder}, {fmt(v)}{unit}", f"The old record was {fmt(old)}{unit}."))
    return out, store


def post_round_news(league_id, year=None, afl_round=None):
    """Announce what is new since the last run. Returns the lines posted."""
    from models.player_honours import league_honours
    from models.activity_feed import log_activity
    from models.notification_manager import create_notification

    seen = {a.key: a.value for a in HonourAnnouncement.query.filter_by(league_id=league_id).all()}
    fresh = not seen
    data = league_honours(league_id)
    teams = {t.id: t.name for t in FantasyTeam.query.filter_by(league_id=league_id).all()}
    new = []
    for pid, hs in data["by_player"].items():
        for h in hs:
            k = _honour_key(h)
            if k not in seen:
                new.append((k, h))
    players = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_([h["player_id"] for _k, h in new] or [0])).all()}
    lines = [] if fresh else _honour_lines([h for _k, h in new], teams, players)
    rec_lines, rec_store = _record_lines(league_id, seen, fresh)
    lines += rec_lines

    for k, _h in new:
        db.session.add(HonourAnnouncement(league_id=league_id, key=k))
    for k, v in rec_store.items():
        row = HonourAnnouncement.query.filter_by(league_id=league_id, key=k).first()
        if row:
            row.value = v
        else:
            db.session.add(HonourAnnouncement(league_id=league_id, key=k, value=v))
    db.session.commit()

    if lines:
        coaches = {t.owner_id for t in FantasyTeam.query.filter_by(league_id=league_id).all() if t.owner_id}
        for title, body in lines:
            is_record = title.startswith("New record")
            link = f"/leagues/{league_id}/history" if is_record else f"/leagues/{league_id}/honours"
            log_activity(league_id, "record" if is_record else "honours", title, body=body, link=link)
            for uid in coaches:
                try:
                    create_notification(uid, league_id, "honours", title, body=body, link=link)
                except Exception:
                    logger.warning("honours notification failed for %s", uid, exc_info=True)
    logger.info("round news league %s R%s: %d lines%s", league_id, afl_round, len(lines), " (first run, recorded only)" if fresh else "")
    return lines

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
import re
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


def _by_club(who):
    """Names for a line's body. One player per club: "Name (Club), ...".
    All from one club: the names alone (the club is in the title). Several
    from several clubs: grouped, "Club: A, B. Other: C." so the club is not
    repeated after every name."""
    clubs = defaultdict(list)
    for n, c in who:
        clubs[c].append(n)
    if len(clubs) == 1:
        return _names([(n, None) for n, _c in who])
    if all(len(v) == 1 for v in clubs.values()):
        return _names(who)
    return " ".join(f"{c}: {', '.join(v)}." if c else f"{', '.join(v)}." for c, v in
                    sorted(clubs.items(), key=lambda kv: -len(kv[1])))


def _board_key(kind, step):
    """The Honour Board board a line links to (player_honours.honour_boards keys)."""
    return f"clubgames{step}" if kind == "clubgames" else kind


TROPHY = {"keepermedal": "the Keeper Medal", "rising": "the Rising Star", "medal7": "the 7s Medal",
          "triple": "the Triple Crown"}


def _honour_lines(new, teams, players):
    """Group new honours into one line each: (title, body, board key).
    Titles are sentences about a player or a club; when every player in a
    group is from one club the club is in the title, so its crest shows."""
    from models.player_honours import KINDS
    groups = defaultdict(list)
    for h in new:
        groups[(h["kind"], h.get("step"))].append(h)
    out = []
    for (kind, step), hs in groups.items():
        key = _board_key(kind, step)
        who = [(players[h["player_id"]].name if h["player_id"] in players else "?", teams.get(h.get("team_id"), ""))
               for h in hs]
        n = len(hs)
        clubs = {c for _n, c in who}
        one_club = next(iter(clubs)) if len(clubs) == 1 and "" not in clubs else None
        nm, club = who[0]
        if kind == "clubgames":
            what = "100 club games and Life Membership" if step == 100 else f"{step} club games"
            if n == 1:
                out.append((f"{nm} reached {what}" + (f" for {club}" if club else ""), None, key))
            elif one_club:
                out.append((f"{n} {one_club} players reached {what}", _by_club(who), key))
            else:
                out.append((f"{n} players reached {what} this round", _by_club(who), key))
        elif kind == "calledup":
            if n == 1:
                out.append((f"{nm} was called up from the 7s" + (f" by {club}" if club else ""), None, key))
            elif one_club:
                out.append((f"{one_club} called up {n} players from the 7s", _by_club(who), key))
            else:
                out.append((f"{n} players were called up from the 7s", _by_club(who), key))
        elif kind == "siren":
            for h, (pn, pc) in zip(hs, who):
                m = re.match(r"Round \d+, (\d+) points, won by (\d+)", h.get("detail") or "")
                body = f"He scored {m.group(1)} and {pc} won by {m.group(2)}." if m and pc else None
                out.append((f"The Siren: {pn} won round {h.get('round')} on his own" + (f" for {pc}" if pc else ""), body, key))
        elif kind in ("flag", "flag7"):
            by_team = defaultdict(list)
            for w in who:
                by_team[w[1]].append(w[0])
            for c, ps in by_team.items():
                out.append((f"{c} won the {hs[0].get('year')} {'7s ' if kind == 'flag7' else ''}flag, {len(ps)} premiership players",
                            _names([(p, None) for p in ps]), key))
        elif kind == "allleague":
            per = defaultdict(int)
            for _n, c in who:
                per[c] += 1
            body = ", ".join(f"{c} {k}" for c, k in sorted(per.items(), key=lambda kv: -kv[1]) if c) + "."
            out.append((f"The {hs[0].get('year')} All-League 23 is named", body, key))
        elif kind == "champion":
            if n == 1:
                out.append((f"{nm} is {club}'s Club Champion", hs[0].get("detail"), key))
            else:
                out.append((f"{n} Club Champions crowned", _by_club(who), key))
        elif kind in ("hof", "legend"):
            title = "the Hall of Fame" if kind == "hof" else "Legend status"
            out.append((f"{nm} enters {title}" if n == 1 else f"{n} players enter {title}",
                        hs[0].get("detail") if n == 1 else _by_club(who), key))
        else:
            name = TROPHY.get(kind, KINDS[kind][0])
            if n == 1:
                out.append((f"{nm} won {name}" + (f" for {club}" if club else ""), hs[0].get("detail"), key))
            else:
                out.append((f"{n} players won {name}", _by_club(who), key))
    return out


# How each record reads when it falls, from (who, value).
RECORD_TITLES = {
    "high": lambda h, v: f"{h} posted the highest club score ever, {v}",
    "season_pf": lambda h, v: f"{h} scored the most points in a season, {v}",
    "win_run": lambda h, v: f"{h} have won {v} in a row, the longest winning run",
    "loss_run": lambda h, v: f"{h} have lost {v} in a row, the longest losing run",
    "low": lambda h, v: f"{h} posted the lowest club score ever, {v}",
    "p_high": lambda h, v: f"{h} scored {v}, the highest score by a player",
    "p_total": lambda h, v: f"{h} has the most points by a player in a season, {v}",
    "p_hundreds": lambda h, v: f"{h} has {v} scores of 100 or more this season, a record",
    "p_avg": lambda h, v: f"{h} is averaging {v}, above the best season average",
    "closest": lambda h, v: f"The closest match ever: {h} by {v}",
    "biggest": lambda h, v: f"The biggest win ever: {h} by {v}",
    "combined": lambda h, v: f"The highest scoring match ever: {h}, {v} combined",
}
MARGINS = ("closest", "biggest")


def _record_lines(league_id, seen, fresh):
    """New records against what was last announced: (title, body), and the
    values to store."""
    from models.record_book import build
    book = build(league_id)
    out, store = [], {}
    fmt = (lambda x: f"{x:,.1f}" if x != int(x) else f"{int(x):,}")
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
        if top.get("winner"):
            who = f"{top['winner']} beat {top.get('loser', '')}".strip()
        elif top.get("player"):
            who = f"{top['player']} ({top['team']})" if top.get("team") else top["player"]
        else:
            who = top.get("team") or ""
        unit = (" point" if v == 1 else " points") if r["key"] in MARGINS else ""
        make = RECORD_TITLES.get(r["key"])
        title = make(who, fmt(v) + unit) if make else f"New record, {r['label'].lower()}: {who}, {fmt(v)}"
        out.append((title, f"The old record was {fmt(old)}{unit}."))
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
    lines += [(t, b, None) for t, b in rec_lines]

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
        for title, body, board in lines:
            # A record has no board. An honour links to its own board, and the
            # board key in the link tells the feed which emblem to draw.
            is_record = board is None
            link = f"/leagues/{league_id}/history" if is_record else f"/leagues/{league_id}/honours?badge={board}"
            log_activity(league_id, "record" if is_record else "honours", title, body=body, link=link)
            for uid in coaches:
                try:
                    create_notification(uid, league_id, "honours", title, body=body, link=link)
                except Exception:
                    logger.warning("honours notification failed for %s", uid, exc_info=True)
    logger.info("round news league %s R%s: %d lines%s", league_id, afl_round, len(lines), " (first run, recorded only)" if fresh else "")
    return [(t, b) for t, b, _k in lines]

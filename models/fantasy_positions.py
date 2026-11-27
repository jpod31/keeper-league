"""Official AFL Fantasy positions (Champion Data), the league's positions of record.

Each pre-season AFL.com.au publishes "Fantasy <year>: Every player, every
position": four tables (defenders, midfielders, rucks, forwards) with every
listed player, draftees included. A dual-position player appears in both of
his tables. This module reads that article, matches each row to a listed
`AflPlayer` by name and club, writes `position` in our format and clears
`position_expected` (the "exp" guess the workbook sync gives a new player).

Run `scripts/sync_fantasy_positions.py` (dry run by default). The weekly job
in `models/scheduler.py` runs the same sync so players added to the article
later (rookie list, SSP signings) pick up their positions.
"""
from __future__ import annotations

import html
import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# The article's club names to ours.
CLUBS = {
    "brisbane": "Brisbane Lions",
    "brisbane lions": "Brisbane Lions",
    "gws": "GWS",
    "gws giants": "GWS",
    "greater western sydney": "GWS",
    "sydney": "Sydney",
    "sydney swans": "Sydney",
    "west coast": "West Coast",
    "west coast eagles": "West Coast",
    "gold coast": "Gold Coast",
    "gold coast suns": "Gold Coast",
    "geelong": "Geelong",
    "geelong cats": "Geelong",
    "adelaide": "Adelaide",
    "adelaide crows": "Adelaide",
}

# Surnames the article spells differently from our lists (normalised form).
SPELLINGS = {"gustavo teixeira": "gustavo texeira"}

CODES = {"DEF": "DEF", "MID": "MID", "FWD": "FWD", "RUC": "RUC", "RUCK": "RUC"}

# Refuse to write from a page that is plainly not the full list.
MIN_PLAYERS = 500


def club(name: str) -> str:
    n = (name or "").strip()
    return CLUBS.get(n.lower(), n)


def fmt(codes) -> str:
    """Our stored form: non-MID codes alphabetically, MID last ('FWD/MID',
    'DEF/FWD/MID', 'RUC/MID'), matching every value already in the table."""
    s = set(codes)
    return "/".join(sorted(c for c in s if c != "MID") + (["MID"] if "MID" in s else []))


def parse(page: str) -> dict:
    """{(name, club): set of codes} from the article's tables."""
    out: dict = defaultdict(set)
    for table in re.findall(r"<table.*?</table>", page, re.S | re.I):
        rows = re.findall(r"<tr.*?</tr>", table, re.S | re.I)
        if not rows:
            continue
        head = [_text(c).upper() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", rows[0], re.S | re.I)]
        if "PLAYER" not in head or "POSITION" not in head:
            continue
        i_name, i_pos = head.index("PLAYER"), head.index("POSITION")
        i_team = head.index("TEAM") if "TEAM" in head else head.index("CLUB")
        for r in rows[1:]:
            cells = [_text(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S | re.I)]
            if len(cells) <= max(i_name, i_pos, i_team) or not cells[i_name]:
                continue
            codes = {CODES[p] for p in re.split(r"[/,\s]+", cells[i_pos].upper()) if p in CODES}
            if codes:
                out[(cells[i_name], club(cells[i_team]))] |= codes
    return dict(out)


def _text(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def fetch(url: str) -> dict:
    import requests
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (keeper league position sync)"}, timeout=30)
    resp.raise_for_status()
    return parse(resp.text)


@dataclass
class Plan:
    official: int = 0
    changes: list = field(default_factory=list)      # (player, old, new, how)
    confirmed: list = field(default_factory=list)    # (player, how): exp cleared, same position
    same: int = 0
    unmatched: list = field(default_factory=list)    # (name, club, position) in the article, not on our lists
    missing: list = field(default_factory=list)      # listed players the article does not name
    ambiguous: list = field(default_factory=list)    # (name, club, [players])
    moves: list = field(default_factory=list)        # (team, text) from repair_slots


def plan(official: dict, players) -> Plan:
    """Match the article to our listed players. Strictest rule first, each of
    our players used once: name + club, nickname variant + club, then the
    name alone when exactly one listed player has it (a club move we have not
    picked up yet; reported with the clubs)."""
    from models.player_sync import norm, variants

    p = Plan(official=len(official))
    by_nc, by_n = defaultdict(list), defaultdict(list)
    for pl in players:
        by_nc[(norm(pl.name), pl.afl_team)].append(pl)
        by_n[norm(pl.name)].append(pl)
    used: set = set()

    def pick(cands):
        cands = [c for c in cands if c.id not in used]
        return cands[0] if len(cands) == 1 else (None if not cands else cands)

    rows = sorted(official.items())
    pending = []
    for (name, team), codes in rows:
        got = pick(by_nc.get((norm(name), team), []))
        how = "name+club"
        if got is None:
            for v in variants(name):
                got = pick(by_nc.get((v, team), []))
                if got is not None:
                    how = "nickname+club"
                    break
        if isinstance(got, list):
            p.ambiguous.append((name, team, got))
            continue
        if got is None:
            pending.append((name, team, codes))
            continue
        used.add(got.id)
        _record(p, got, fmt(codes), how)
    later = []
    for name, team, codes in pending:
        got = pick(by_n.get(norm(name), []))
        if got is None or isinstance(got, list):
            later.append((name, team, codes))
            continue
        used.add(got.id)
        _record(p, got, fmt(codes), f"name only (ours {got.afl_team}, article {team})")
    # Last: same club, same surname (or a known spelling), same first initial,
    # and the only such player left on either side (Archer / Archie May,
    # Leonardo / Leo Lombard).
    for name, team, codes in later:
        want = SPELLINGS.get(norm(name), norm(name)).split()
        def close(pl):
            have = norm(pl.name).split()
            return (pl.afl_team == team and len(have) >= 2 and have[-1] == want[-1]
                    and have[0][:1] == want[0][:1])
        cands = [pl for pl in players if pl.id not in used and close(pl)]
        rivals = [n for n, t, _c in later if t == team and norm(n).split()[-1] == norm(name).split()[-1]]
        if len(cands) != 1 or len(rivals) != 1:
            p.unmatched.append((name, team, fmt(codes)))
            continue
        used.add(cands[0].id)
        _record(p, cands[0], fmt(codes), f"surname+initial+club ({name})")
    p.missing = sorted((pl for pl in players if pl.id not in used), key=lambda x: (x.afl_team, x.name))
    return p


def _record(p: Plan, pl, new: str, how: str):
    old = pl.position or ""
    if old != new:
        p.changes.append((pl, old, new, how))
    elif pl.position_expected:
        p.confirmed.append((pl, how))
    else:
        p.same += 1


def apply(p: Plan) -> int:
    from models.database import db
    for pl, _old, new, _how in p.changes:
        pl.position = new
        pl.position_expected = False
    for pl, _how in p.confirmed:
        pl.position_expected = False
    db.session.flush()
    p.moves = repair_slots()
    db.session.commit()
    return len(p.changes) + len(p.confirmed)


ON_FIELD = ("DEF", "MID", "FWD", "RUC")


def _sevens(team) -> set:
    """Players named in this team's next 7s side (left alone, as the
    line-up optimiser does)."""
    try:
        import config
        from blueprints.reserve7s import get_7s_target
        from models.database import Reserve7sLineup
        year, rnd, _ = get_7s_target(team.league_id, config.CURRENT_YEAR)
        return {e.player_id for e in Reserve7sLineup.query.filter_by(
            league_id=team.league_id, team_id=team.id, afl_round=rnd, year=year).all()}
    except Exception:
        return set()


def repair_slots(new_pos: dict | None = None):
    """Put every on-field player back in a slot he can play after positions
    change. Smallest move first: swap with a team-mate on the field (FLEX
    takes anyone) so both stay on. Otherwise the best bench player who can
    play the slot comes on, and the side keeps whichever is stronger of him
    and the weakest player in a slot he can play. Nothing scores
    position eligibility at lockout, so an illegal slot left here would
    count in round 1. `new_pos` {player id: position} judges by positions
    not written yet (the dry run). Returns [(team, text)]; caller commits.
    """
    from models.database import db, FantasyRoster, FantasyTeam, LongTermInjury

    pos = dict(new_pos or {})
    can = lambda e, code: code == "FLEX" or code in pos.get(e.player_id, e.player.position or "MID").upper().split("/")
    val = lambda e: e.player.sc_avg or 0
    # Never brought on: LTIL and injured players.
    out = {lt.player_id for lt in LongTermInjury.query.filter_by(removed_at=None).all()}
    out |= {r.player_id for r in FantasyRoster.query.filter_by(is_active=True).all()
            if (r.player.injury_severity or "").lower() in ("short", "long")}
    moves = []
    rows = (FantasyRoster.query.filter_by(is_active=True)
            .order_by(FantasyRoster.team_id, FantasyRoster.id).all())
    by_team: dict = defaultdict(list)
    for r in rows:
        by_team[r.team_id].append(r)
    for team_id, roster in by_team.items():
        team = db.session.get(FantasyTeam, team_id)
        sevens = _sevens(team)
        roster = [r for r in roster if r.player_id not in sevens]
        for x in roster:
            s = x.position_code
            if x.is_benched or s not in ON_FIELD or can(x, s):
                continue
            field = [y for y in roster if y is not x and not y.is_benched and y.position_code in ON_FIELD + ("FLEX",)]
            # Fixed slots before FLEX, so the coach's FLEX choice is kept if possible.
            field.sort(key=lambda y: y.position_code == "FLEX")
            y = next((y for y in field if can(x, y.position_code) and can(y, s)), None)
            if y:
                x.position_code, y.position_code = y.position_code, s
                moves.append((team, f"{x.player.name} to {x.position_code}, {y.player.name} to {s}"))
                continue
            bench = [b for b in roster if b.is_benched and b.player_id not in out and can(b, s)]
            bench.sort(key=lambda b: -val(b))
            if not bench:
                moves.append((team, f"LEFT: {x.player.name} at {s}, nobody can take it"))
                continue
            b = bench[0]
            # Keep the stronger side: if he outscores the weakest player in a
            # slot he can play, he takes that slot and that player sits out.
            z = min((z for z in field if z.position_code != "FLEX" and can(x, z.position_code)
                     and not (z.is_captain or z.is_vice_captain)), key=val, default=None)
            b.position_code, b.is_benched, b.is_emergency = s, False, False
            if z is not None and val(x) > val(z):
                x.position_code = z.position_code
                z.position_code, z.is_benched = None, True
                moves.append((team, f"{x.player.name} to {x.position_code}, {b.player.name} on at {s}, "
                                    f"{z.player.name} to the bench"))
            else:
                x.position_code, x.is_benched = None, True
                moves.append((team, f"{b.player.name} on at {s}, {x.player.name} to the bench"))
    return moves


def sync(url: str, write: bool = True) -> Plan:
    """Fetch, match and (optionally) write. Refuses a page with too few
    players so a broken or partial page never rewrites the league."""
    from models.database import AflPlayer
    official = fetch(url)
    if len(official) < MIN_PLAYERS:
        raise RuntimeError(f"only {len(official)} players on {url}; expected {MIN_PLAYERS}+")
    p = plan(official, AflPlayer.query.filter(AflPlayer.listed()).all())
    if write:
        apply(p)
    else:
        from models.database import db
        p.moves = repair_slots({pl.id: new for pl, _o, new, _h in p.changes})
        db.session.rollback()
    return p

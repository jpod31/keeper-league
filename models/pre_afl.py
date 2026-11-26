"""Before the AFL: the card for a player who has not played an AFL game.

Lucas, 2026-11-26: "for new players we should add in a little profile ...
their state league and nab league stats", then "this needs to be cooler..
more detailed, with some comparisons ... place him a little better ...
determine his likelihood to play early in his career, is he ready made? are
there spots in the 23 open for him?", then "the text does not help anywhere
near enough".

So the card is numbers, not prose:
  verdict    will he play early: his rating against what last year's
             first-year players did at that rating, your workbook's best-22
             call, and players at his position who left his club
  headline   his best recent junior season, ranked stat by stat against that
             competition (or against the other draftees there, where we only
             hold draftees) and against his own draft class. Rankings, not
             player comparisons ("rankings not comparisons of bs").
  seasons    every junior and state league season we hold

Sources: state_league_stat (DFS Australia: Talent League, SANFL, SANFL
under-18s; wheeloratings: VFL, SANFL, WAFL; scrapers/junior_sources.py:
WAFL Colts/Reserves/League and the under-18 championships), afl_player
(draftguru pathway, honours and pick; workbook rating and best 22).
"""

import math
import statistics
import time

import config
from models.database import db, StateLeagueStat, AflPlayer, PlayerStat, PlayerSeasonRating

LEAGUE = {
    "vfl": "VFL", "sanfl": "SANFL", "wafl": "WAFL", "waflres": "WAFL Reserves",
    "sanflu18": "SANFL under-18s", "waflcolts": "WAFL Colts", "u18champs": "Under-18 Championships",
}
# Under-18 competitions: "came through", and kept apart from senior state leagues.
JUNIOR_COMPS = ("nab", "sanflu18", "waflcolts", "u18champs")
# Competitions we hold in full (every player), so a percentile means the whole league.
FULL_POOL = ("nab", "sanflu18")
HONOUR_NOTES = {
    "larke medal": "the best player at the under-18 national championships",
    "hunter harrison medal": "the best player in division two of the under-18 championships",
    "morrish medal": "the Talent League best and fairest",
}
POS_WORD = {"DEF": "defender", "MID": "midfielder", "FWD": "forward", "RUC": "ruck"}


def league_name(comp, season):
    comp = (comp or "").lower()
    if comp == "nab":
        return "Talent League" if (season or 0) >= 2023 else "NAB League"
    return LEAGUE.get(comp, comp.upper())


def _r1(v):
    """One decimal, halves up (113 disposals in 4 games is 28.3, as the
    source prints it, not Python's 28.2)."""
    return math.floor(v * 10 + 0.5 + 1e-9) / 10 if v is not None else None


def disposals(r):
    """Per game. Many junior rows carry kicks and handballs but no disposals."""
    if r.disposals is not None:
        return r.disposals
    if r.kicks is not None and r.handballs is not None:
        return r.kicks + r.handballs
    return None


def goals(r):
    """Per game: the goals column is the season total."""
    if r.goals_avg is not None:
        return r.goals_avg
    if r.goals is not None and r.matches:
        return r.goals / r.matches
    return None


def _and_list(items):
    items = [i.strip() for i in items if i and i.strip()]
    if len(items) <= 1:
        return items[0] if items else ""
    return ", ".join(items[:-1]) + " and " + items[-1]


def honour_text(raw):
    """'Larke Medallist' -> 'Larke Medallist: the best player at the under-18
    national championships.'"""
    if not raw:
        return None
    out = []
    for part in [x.strip() for x in raw.split(",") if x.strip()]:
        note = HONOUR_NOTES.get(part.lower().replace("medallist", "medal").strip())
        out.append(f"{part}: {note}" if note else part)
    return ". ".join(out) + "."


def _rows(p):
    rows = (StateLeagueStat.query
            .filter(db.or_(StateLeagueStat.player_id == p.id, StateLeagueStat.player_name == p.name))
            .order_by(StateLeagueStat.season.desc()).all())
    out, seen = [], set()
    for r in rows:
        if p.age and r.season and p.age - (config.CURRENT_YEAR - r.season) < 15:
            continue  # somebody else with his name
        key = (r.season, r.competition, r.team)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def _season_row(r):
    return {
        "season": r.season, "league": league_name(r.competition, r.season), "team": r.team,
        "games": r.matches, "disposals": _r1(disposals(r)), "marks": _r1(r.marks),
        "tackles": _r1(r.tackles), "goals": _r1(goals(r)), "clearances": _r1(r.clearances),
        "hitouts": _r1(r.hitouts), "fantasy": _r1(r.dreamteam_avg),
    }


# ── the cohort: what last year's first-year players did, by rating ───────

_cache = {}


def _cached(key, ttl, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _cache[key] = (time.time(), val)
    return val


BANDS = ((70, 100, "70 and up"), (66, 70, "66 to 69"), (62, 66, "62 to 65"), (58, 62, "58 to 61"), (0, 58, "under 58"))


def cohort():
    """First-year players of last season (rated, no AFL game before it, 21 or
    under), grouped by their rating that season: how many played, median games."""
    def build():
        year = config.CURRENT_YEAR - 1
        first = dict(db.session.query(PlayerStat.player_id, db.func.min(PlayerStat.year))
                     .group_by(PlayerStat.player_id).all())
        games = dict(db.session.query(PlayerStat.player_id, db.func.count(PlayerStat.id))
                     .filter(PlayerStat.year == year).group_by(PlayerStat.player_id).all())
        ages = dict(db.session.query(AflPlayer.id, AflPlayer.age).all())
        out = {b[2]: [] for b in BANDS}
        for pid, rating in db.session.query(PlayerSeasonRating.player_id, PlayerSeasonRating.rating).filter(
                PlayerSeasonRating.season == year, PlayerSeasonRating.rating.isnot(None)).all():
            if (ages.get(pid) or 99) - 1 > 21 or (first.get(pid) or 9999) < year:
                continue
            for lo, hi, label in BANDS:
                if lo <= rating < hi:
                    out[label].append(games.get(pid, 0))
        return {"year": year, "bands": [{"band": label, "n": len(out[label]),
                                          "played": sum(1 for g in out[label] if g),
                                          "median": statistics.median(out[label]) if out[label] else 0}
                                         for _lo, _hi, label in BANDS]}
    return _cached("cohort", 6 * 3600, build)


def _band(rating):
    for lo, hi, label in BANDS:
        if rating is not None and lo <= rating < hi:
            return label
    return None


def verdict(p):
    """{label, tone, reasons[]}: will he play early."""
    c = cohort()
    band = _band(p.rating)
    b = next((x for x in c["bands"] if x["band"] == band), None)
    pos = (p.position or "MID").split("/")[0]
    left = []
    if p.afl_team:
        left = [q.name for q in AflPlayer.query.filter(
            AflPlayer.afl_team == p.afl_team, AflPlayer.left_afl_year == config.CURRENT_YEAR - 1).all()
            if pos in (q.position or "").split("/") and (q.games_played or 0) >= 8]
    best22 = bool(p.afl_best22)
    r = p.rating or 0
    if r >= 66 and best22:
        label, tone = "Walks straight in", "good"
    elif r >= 66 or best22:
        label, tone = "Pushing for round 1", "good"
    elif r >= 62:
        label, tone = "Mid-season debut", "warn"
    else:
        label, tone = "Development year", "slow"
    reasons = []
    if p.rating is not None:
        reasons.append(f"Rated {p.rating}" + (", in your workbook's best 22" if best22 else ", outside your workbook's best 22"))
    if b and b["n"]:
        reasons.append(f"{c['year']} first-years rated {band}: {b['played']} of {b['n']} played, median {b['median']:g} games")
    if left:
        line = {"DEF": "defence", "MID": "midfield", "FWD": "forward line", "RUC": "ruck"}.get(pos, "list")
        reasons.append(f"Left {p.afl_team}'s {line}: {_and_list(left[:3])}")
    return {"label": label, "tone": tone, "reasons": reasons, "band": band, "cohort": c}


# ── ranking a junior season ──────────────────────────────────────────────

RANK_STATS = (
    ("Disposals", disposals), ("Fantasy", lambda x: x.dreamteam_avg), ("Marks", lambda x: x.marks),
    ("Tackles", lambda x: x.tackles), ("Clearances", lambda x: x.clearances), ("Goals", goals),
    ("Contested", lambda x: x.contested_possessions), ("Inside 50s", lambda x: x.inside_fifties),
    ("Rebound 50s", lambda x: x.rebounds), ("Hitouts", lambda x: x.hitouts),
)


def ordinal(n):
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def _rank(row, p):
    """Where his season ranks, stat by stat: in its competition (every player
    in the Talent League and SANFL under-18s; the draftees we hold elsewhere)
    and in his own draft class. Lucas, 2026-11-26: "rankings not comparisons
    of bs like compares to this player". Strongest first."""
    pool = StateLeagueStat.query.filter_by(competition=row.competition, season=row.season).filter(
        StateLeagueStat.matches >= (2 if row.competition == "u18champs" else 3)).all()
    full = row.competition in FULL_POOL
    cls = set()
    if p.joined_year:
        cls = {q.name for q in AflPlayer.query.filter(AflPlayer.joined_year == p.joined_year).all()}
    out = []
    for label, fn in RANK_STATS:
        mine = fn(row)
        vals = [fn(x) for x in pool if fn(x) is not None]
        if mine is None or len(vals) < 8 or (label in ("Goals", "Hitouts") and mine < 0.5):
            continue
        rank = 1 + sum(1 for v in vals if v > mine)
        item = {"label": label, "value": _r1(mine), "rank": rank, "of": len(vals),
                "pct": round(100 * (1 - (rank - 1) / len(vals))),
                "text": f"{ordinal(rank)} of {len(vals)}"}
        cvals = [fn(x) for x in pool if x.player_name in cls and fn(x) is not None]
        if full and len(cvals) >= 5:  # where we only hold draftees, the league rank already is the class rank
            crank = 1 + sum(1 for v in cvals if v > mine)
            item["class_text"] = f"{ordinal(crank)} of {len(cvals)}"
        out.append(item)
    out.sort(key=lambda x: -x["pct"])
    return out[:6], full


# ── the card ─────────────────────────────────────────────────────────────

def _headline(rows):
    """His season to rank: the latest junior season with 3+ games (2+ at the
    championships), the one with more games on a tie."""
    juniors = [r for r in rows if r.competition in JUNIOR_COMPS
               and (r.matches or 0) >= (2 if r.competition == "u18champs" else 3)]
    if not juniors:
        return None
    latest = max(r.season for r in juniors)
    return max((r for r in juniors if r.season == latest), key=lambda r: (r.matches or 0, r.dreamteam_avg or 0))


def pre_afl(p):
    rows = _rows(p)
    pos = (p.position or "").split("/")[0]
    facts = []
    if p.draft_pick and p.draft_year:
        facts.append(f"Pick {p.draft_pick}, {p.draft_year}" + (f" {p.draft_type}" if p.draft_type else ""))
    elif p.draft_note:
        facts.append(", ".join(b.strip() for b in p.draft_note.split(",")[:2]))
    if p.junior_origin:
        facts.append(p.junior_origin.split(" / ")[-1])
    if p.height_cm:
        facts.append(f"{p.height_cm} cm")

    head = _headline(rows)
    headline = None
    if head:
        stats = [("Disposals", _r1(disposals(head))), ("Fantasy", _r1(head.dreamteam_avg)),
                 ("Marks", _r1(head.marks)), ("Tackles", _r1(head.tackles)), ("Goals", _r1(goals(head))),
                 ("Clearances", _r1(head.clearances))]
        ranks, full = _rank(head, p)
        headline = {"league": league_name(head.competition, head.season), "season": head.season,
                    "team": head.team, "games": head.matches,
                    "stats": [{"label": a, "value": b} for a, b in stats if b is not None][:3],
                    "ranks": ranks, "full": full,
                    "pool": ("every player in the " + league_name(head.competition, head.season)) if full
                            else "the draftees we hold from it"}

    proj = next((r for r in rows if r.predicted_afl_sc), None)
    v = verdict(p)
    ht = honour_text(p.junior_honours)
    lines = [f"{(p.afl_team or '')} {POS_WORD.get(pos, 'player')}".strip() + (f", {p.age}" if p.age else "") + "."]
    if ht:
        lines.append(ht)
    return {
        "verdict": {"label": v["label"], "tone": v["tone"], "reasons": v["reasons"]},
        "cohort": v["cohort"], "band": v["band"],
        "facts": facts, "honours": p.junior_honours, "honour_note": ht, "pathway": p.junior_origin,
        "headline": headline,
        "seasons": [_season_row(r) for r in rows[:6]],
        "projection": ({"sc": round(proj.predicted_afl_sc), "season": proj.season, "tag": proj.scouting_tag or None}
                       if proj else None),
        "lines": lines,
    }

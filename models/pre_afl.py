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
  headline   his best recent junior season, ranked stat by stat against the
             AFL-listed players of his workbook role who played that
             competition, and against those from his own season. Like for
             like: a key forward against key forwards. Rankings, not player
             comparisons ("rankings not comparisons of bs").
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


ROLE_WORDS = {"MID": "midfielders", "KF": "key forwards", "GF": "general forwards",
              "KD": "key defenders", "GD": "general defenders", "RUC": "ruckmen"}
LINE_ROLES = {"KF": ("KF", "GF"), "GF": ("KF", "GF"), "KD": ("KD", "GD"), "GD": ("KD", "GD")}
LINE_WORDS = {("KF", "GF"): "forwards", ("KD", "GD"): "defenders"}
MIN_ROLE_POOL = 12
MIN_RANK_POOL = 8


def _min_games(comp):
    return 2 if comp == "u18champs" else 3


def role_pool(comp):
    """Every AFL-listed player (now or before) with a workbook role who played
    this competition: his last season in it, as plain numbers. Junior feeds
    carry no position and a stat line cannot tell a key forward from a
    general one (54% right on a held-out check, 2026-11-26), so the pool is
    only players whose role we know. Lucas, 2026-11-26: "it should be like
    for like... so against mids, against key forwards, rucks"."""
    def build():
        people = db.session.query(AflPlayer.id, AflPlayer.name, AflPlayer.role, AflPlayer.age).filter(
            AflPlayer.role.isnot(None)).all()
        by_id = {x.id: x for x in people}
        by_name = {}
        for x in people:
            by_name.setdefault(x.name, []).append(x)
        best = {}
        for r in StateLeagueStat.query.filter(StateLeagueStat.competition == comp,
                                               StateLeagueStat.matches >= _min_games(comp)).all():
            who = by_id.get(r.player_id)
            if not who:
                fits = [x for x in by_name.get(r.player_name, [])
                        if x.age and 15 <= x.age - (config.CURRENT_YEAR - r.season) <= 20]
                who = fits[0] if len(fits) == 1 else None
            if not who:
                continue
            key = (r.season, r.matches or 0)
            if who.id in best and best[who.id]["key"] >= key:
                continue
            best[who.id] = {"key": key, "pid": who.id, "role": who.role, "season": r.season,
                            "vals": {label: fn(r) for label, fn in RANK_STATS}}
        return list(best.values())
    return _cached("role_pool:" + comp, 6 * 3600, build)


def _roles_for(p):
    if p.role in ROLE_WORDS:
        return (p.role,)
    pos = (p.position or "").split("/")[0]
    return {"MID": ("MID",), "RUC": ("RUC",), "DEF": ("KD", "GD"), "FWD": ("KF", "GF")}.get(pos, ())


def _rank(row, p):
    """Where his season ranks, stat by stat, against AFL-listed players of his
    role from the same competition (any season), and against those of them
    from his own season. Widens to his line (forwards, defenders) and then to
    everyone when too few share his role. Lucas, 2026-11-26: "rankings not
    comparisons of bs" and "who cares if someone was top 3% disposals when
    most of the team are not disposal getters". Strongest first."""
    pool = [x for x in role_pool(row.competition) if x["pid"] != p.id]
    roles = _roles_for(p)
    group = None
    for cand in (roles, LINE_ROLES.get(roles[0]) if len(roles) == 1 else None):
        if cand and sum(1 for x in pool if x["role"] in cand) + 1 >= MIN_ROLE_POOL:
            group = tuple(cand)
            break
    if group:
        pool = [x for x in pool if x["role"] in group]
        word = ROLE_WORDS[group[0]] if len(group) == 1 else LINE_WORDS.get(group, "players")
    else:
        word = "players"
    first = min((x["season"] for x in pool), default=row.season)
    out = []
    for label, fn in RANK_STATS:
        mine = fn(row)
        vals = [x["vals"][label] for x in pool if x["vals"][label] is not None]
        if mine is None or len(vals) + 1 < MIN_RANK_POOL or (label in ("Goals", "Hitouts") and mine < 0.5):
            continue
        rank = 1 + sum(1 for v in vals if v > mine)
        of = len(vals) + 1
        item = {"label": label, "value": _r1(mine), "rank": rank, "of": of,
                "pct": round(100 * (1 - (rank - 1) / of)), "text": f"{ordinal(rank)} of {of}"}
        cvals = [x["vals"][label] for x in pool if x["season"] == row.season and x["vals"][label] is not None]
        if len(cvals) + 1 >= 5:
            item["class_text"] = f"{ordinal(1 + sum(1 for v in cvals if v > mine))} of {len(cvals) + 1}"
        out.append(item)
    out.sort(key=lambda x: (-x["pct"], x["rank"]))
    meta = {"word": word, "since": first, "of": len(pool) + 1,
            "pool": f"AFL-listed {word} who played the {league_name(row.competition, row.season)}, since {first}"}
    return out[:6], meta


# ── the scouting description ─────────────────────────────────────────────

SENIOR_COMPS = ("vfl", "sanfl", "wafl")
STAT_WORDS = {"Disposals": "disposals", "Fantasy": "fantasy", "Marks": "marks", "Tackles": "tackles",
              "Clearances": "clearances", "Goals": "goals", "Contested": "contested possessions",
              "Inside 50s": "inside 50s", "Rebound 50s": "rebound 50s", "Hitouts": "hitouts"}


def description(p, head, ranks, meta, rows):
    """Three or four plain sentences a coach can act on, every one from a
    number we hold. Lucas, 2026-11-26: "we need much stronger descriptions,
    new player in 2027.. what the actual fuck is that?"."""
    out = []
    pos = (p.position or "").split("/")[0]
    size = f"{p.height_cm} cm " if p.height_cm else ""
    who = f"{size}{POS_WORD.get(pos, 'player')}".strip()
    draft = None
    if p.draft_pick and p.draft_year:
        draft = f"Pick {p.draft_pick} in the {p.draft_year} {p.draft_type or 'draft'}".replace("draft draft", "draft")
    elif p.draft_note:
        bits = [b.strip() for b in p.draft_note.split(",")]
        draft = f"{bits[0]} in the {bits[1]}" if len(bits) >= 2 else bits[0]
    honour = None
    if p.junior_honours:
        first = p.junior_honours.split(",")[0].strip()
        note = HONOUR_NOTES.get(first.lower().replace("medallist", "medal").strip())
        honour = f"the {first}" + (f", {note}" if note else "")
    came = f" from {p.junior_origin.split(' / ')[-1]}" if p.junior_origin else ""
    if draft and honour:
        out.append(f"{draft}{came} and {honour}.")
    elif draft:
        out.append(f"{draft}{came}, a {who}.")
    elif honour:
        out.append(f"A {who}, and {honour}.")

    if head and ranks:
        top = [r for r in ranks if r["pct"] >= 75][:2] or ranks[:1]
        league = f"{head.season} {league_name(head.competition, head.season)}"
        bits = [f"{ordinal(r['rank'])} for {STAT_WORDS.get(r['label'], r['label'].lower())} "
                f"({fmt_num(r['value'])}{'' if r['label'] == 'Fantasy' else ' a game'})" for r in top]
        comp = league_name(head.competition, head.season)
        since = f" since {meta['since']}" if meta["since"] < head.season else f" in {head.season}"
        out.append(f"{head.matches} games in the {league} for {head.team}. Against the {meta['of']} AFL-listed "
                   f"{meta['word']} who played the {comp}{since}, he ranks " + " and ".join(bits) + ".")
    elif head:
        out.append(f"{head.matches} games in the {head.season} {league_name(head.competition, head.season)} for {head.team}, "
                   f"{fmt_num(disposals(head))} disposals a game.")

    seniors = [r for r in rows if r.competition in SENIOR_COMPS and (r.matches or 0) >= 1]
    if seniors:
        s = max(seniors, key=lambda r: (r.season, r.matches or 0))
        d = disposals(s)
        out.append(f"Already {s.matches} senior {league_name(s.competition, s.season)} game{'s' if s.matches != 1 else ''} "
                   f"for {s.team} in {s.season}" + (f", {fmt_num(d)} disposals a game." if d else "."))
    if not out:
        out.append("No junior or state league games in any source we hold.")
    return " ".join(out)


def fmt_num(v):
    v = _r1(v)
    return "-" if v is None else (str(int(v)) if float(v).is_integer() else f"{v:.1f}")


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
        ranks, meta = _rank(head, p)
        headline = {"league": league_name(head.competition, head.season), "season": head.season,
                    "team": head.team, "games": head.matches,
                    "stats": [{"label": a, "value": b} for a, b in stats if b is not None][:3],
                    "ranks": ranks, "meta": meta, "pool": meta["pool"],
                    "col": f"vs {meta['of']} {meta['word']}",
                    "class_col": f"{head.season} only" if any("class_text" in r for r in ranks) else None}

    proj = next((r for r in rows if r.predicted_afl_sc), None)
    v = verdict(p)
    desc = description(p, head, headline["ranks"] if headline else [], headline["meta"] if headline else None, rows)
    ht = honour_text(p.junior_honours)
    lines = [f"{(p.afl_team or '')} {POS_WORD.get(pos, 'player')}".strip() + (f", {p.age}" if p.age else "") + "."]
    if ht:
        lines.append(ht)
    return {
        "description": desc,
        "verdict": {"label": v["label"], "tone": v["tone"], "reasons": v["reasons"]},
        "cohort": v["cohort"], "band": v["band"],
        "facts": facts, "honours": p.junior_honours, "honour_note": ht, "pathway": p.junior_origin,
        "headline": headline,
        "seasons": [_season_row(r) for r in rows[:6]],
        "projection": ({"sc": round(proj.predicted_afl_sc), "season": proj.season, "tag": proj.scouting_tag or None}
                       if proj else None),
        "lines": lines,
    }

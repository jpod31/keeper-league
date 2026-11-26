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
import re
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


# ── will he play early: what earlier draftees did ────────────────────────

_cache = {}


def _cached(key, ttl, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _cache[key] = (time.time(), val)
    return val


FIRST_CLASS = 2019  # the first draft we compare against (Talent League numbers start in 2019)
_NOTE = re.compile(r"Pick (\d+), (\d{4}) ([\w-]+) Draft")


def draft_info(p):
    """(year, pick, kind) from the list record, else from the draftguru line
    ("Pick 5, 2026 National Draft, West Coast"). kind is 'National',
    'Rookie', 'Pre-Season', ..."""
    if p.draft_year and p.draft_pick:
        return p.draft_year, p.draft_pick, (p.draft_type or "National")
    m = _NOTE.match(p.draft_note or "")
    if m:
        return int(m.group(2)), int(m.group(1)), m.group(3)
    if p.joined_year:
        return p.joined_year - 1, None, None
    return None, None, None


POT_BANDS = ((85, 100, "85 or more"), (80, 85, "80 to 84"), (75, 80, "75 to 79"), (0, 75, "under 75"))
PICK_BANDS = ((1, 5, "picks 1 to 5"), (6, 10, "picks 6 to 10"), (11, 20, "picks 11 to 20"),
              (21, 40, "picks 21 to 40"), (41, 999, "picks 41 on"))


def _in(bands, v):
    return next((b for b in bands if v is not None and b[0] <= v <= (b[1] - (0 if bands is PICK_BANDS else 1e-9))), None)


def draftees():
    """Every player drafted since FIRST_CLASS whose first season is done: his
    pick, his potential going into that first season (the pre-season figure,
    so nothing from the season itself), and his games in it. Only players
    still on a list are in our records, so a draftee delisted since is
    missing; that flatters the lower bands a little, not the top ones."""
    from models.years import stats_year
    def build():
        last = stats_year() - 1
        games = {(pid, yr): n for pid, yr, n in db.session.query(
            PlayerStat.player_id, PlayerStat.year, db.func.count(PlayerStat.id)).group_by(
            PlayerStat.player_id, PlayerStat.year).all()}
        pot = {(pid, se): pt for pid, se, pt in db.session.query(
            PlayerSeasonRating.player_id, PlayerSeasonRating.season, PlayerSeasonRating.potential).filter(
            PlayerSeasonRating.potential.isnot(None)).all()}
        senior = {}
        for name, se, m in db.session.query(StateLeagueStat.player_name, StateLeagueStat.season,
                                            StateLeagueStat.matches).filter(
                StateLeagueStat.competition.in_(SENIOR_COMPS)).all():
            senior[(name, se)] = senior.get((name, se), 0) + (m or 0)
        out = []
        for q in AflPlayer.query.filter(db.or_(AflPlayer.draft_year.isnot(None), AflPlayer.draft_note.isnot(None))).all():
            yr, pick, kind = draft_info(q)
            if not yr or not (FIRST_CLASS <= yr <= last):
                continue
            out.append({"pid": q.id, "role": q.role, "year": yr, "pick": pick, "kind": kind,
                        "pot": pot.get((q.id, yr + 1)), "g1": games.get((q.id, yr + 1), 0),
                        "senior": senior.get((q.name, yr), 0)})
        return out
    return _cached("draftees", 6 * 3600, build)


def _summary(group):
    g = [x["g1"] for x in group]
    return {"n": len(g), "played": sum(1 for x in g if x), "ten": sum(1 for x in g if x >= 10),
            "median": statistics.median(g) if g else 0}


def _games(n):
    return f"{n:g} game" + ("" if n == 1 else "s")


LINE_WORD = {"DEF": "defenders", "MID": "midfielders", "FWD": "forwards", "RUC": "ruckmen"}
ROLES = ("MID", "KF", "GF", "KD", "GD", "RUC")


def _x(pot, role, senior):
    return [1.0, (pot - 80) / 5] + [1.0 if role == k else 0.0 for k in ROLES[1:]] + [1.0 if senior else 0.0]


def _fit(rows, target):
    """Logistic fit (light ridge) of target(row) on potential, role and senior
    games. Checked on held-out draft classes, 2026-11-27 (log loss, lower is
    better), for 10+ games in year one: base rate .587, potential .537,
    + role .535, + senior games .518; adding pick (.538 with role) or club
    depth (regulars in his role against usual spots, .520) did worse, so
    they stay out."""
    import numpy as np
    A = np.array([_x(r["pot"], r["role"], r["senior"]) for r in rows])
    y = np.array([1.0 if target(r) else 0.0 for r in rows])
    w = np.zeros(A.shape[1])
    for _ in range(3000):
        q = 1 / (1 + np.exp(-A @ w))
        w -= 0.5 * (A.T @ (q - y) + np.r_[0, w[1:]]) / len(y)
    return [float(v) for v in w]


def chances():
    """{'any': w, 'ten': w}: weights for a debut in year one and for 10+
    games in it, fitted on every draftee since FIRST_CLASS with a potential
    and a role."""
    def build():
        rows = [r for r in draftees() if r["pot"] and r["role"] in ROLES]
        if len(rows) < 50:
            return None
        return {"n": len(rows), "any": _fit(rows, lambda r: r["g1"] > 0), "ten": _fit(rows, lambda r: r["g1"] >= 10)}
    return _cached("chances", 6 * 3600, build)


def _p(w, x):
    return 1 / (1 + math.exp(-sum(a * b for a, b in zip(w, x))))


def _depth(p, roles):
    """His club's players of his role who played in the last season (any
    club), most games first, and how many of that role its best 22 holds."""
    from models.years import stats_year
    from models.database import AflListHistory
    yr = stats_year()
    mates = AflPlayer.query.filter(AflPlayer.listed(), AflPlayer.afl_team == p.afl_team,
                                   AflPlayer.id != p.id, AflPlayer.role.in_(roles)).all()
    if not mates:
        return [], 0
    ids = [m.id for m in mates]
    g = dict(db.session.query(PlayerStat.player_id, db.func.count(PlayerStat.id)).filter(
        PlayerStat.year == yr, PlayerStat.player_id.in_(ids)).group_by(PlayerStat.player_id).all())
    was = dict(db.session.query(AflListHistory.player_id, AflListHistory.club).filter(
        AflListHistory.season == yr, AflListHistory.player_id.in_(ids)).all())
    out = []
    for m in mates:
        n = g.get(m.id, 0)
        if n >= 1:
            came = was.get(m.id)
            out.append({"name": m.name, "games": n, "from": came if came and came != p.afl_team else None})
    out.sort(key=lambda x: -x["games"])
    slots = AflPlayer.query.filter(AflPlayer.listed(), AflPlayer.afl_team == p.afl_team,
                                   AflPlayer.afl_best22.is_(True), AflPlayer.role.in_(roles)).count()
    return out, slots


VERDICTS = (  # by the fitted chances (see chances())
    ("Expect games early", "good"),
    ("Should debut in his first year", "good"),
    ("A few games at most in year one", "warn"),
    ("Development years", "slow"),
)


def verdict(p, rows=None):
    """{label, tone, chance, reasons[]}: will he play early. Lucas,
    2026-11-27: "ratings before first game dont really matter, potential is
    more of an indicator, so is draft numbers", then "why would you expect
    games early from a ruckman..? ... theres already Nankervis and they just
    signed Briggs". The label comes from a fit on every draftee since 2019
    (potential going into year one, role, senior state games; see _fit for
    what earned its place). The club's players of his role are named under
    it, since depth is what a coach looks at, though as a count it did not
    sharpen the fit."""
    from models.years import stats_year
    pool = draftees()
    since = f"since {FIRST_CLASS}"
    yr, pick, kind = draft_info(p)
    seniors = [r for r in (rows or []) if r.competition in SENIOR_COMPS and (r.matches or 0) >= 1 and yr and r.season >= yr]
    role = p.role if p.role in ROLES else None
    fit = chances()
    reasons, chance = [], None
    if fit and role and p.potential:
        x = _x(p.potential, role, bool(seniors))
        pa, pt = _p(fit["any"], x), _p(fit["ten"], x)
        chance = {"any": round(100 * pa), "ten": round(100 * pt)}
        i = 0 if pt >= .5 else 1 if (pt >= .3 or pa >= .75) else 2 if pa >= .5 else 3
        label, tone = VERDICTS[i]
        reasons.append(f"{chance['ten']}% chance of 10+ games in {yr + 1 if yr else stats_year() + 1}, from what "
                       f"draftees {since} with his potential, position and senior games did.")
    else:
        label, tone = "Not enough to go on", "warn"

    roles = _roles_for(p)
    if p.afl_team and roles:
        ahead, slots = _depth(p, roles)
        word = ROLE_WORDS[roles[0]] if len(roles) == 1 else LINE_WORDS.get(tuple(roles), "players")
        one = ROLE_ONE[roles[0]] if len(roles) == 1 else word[:-1]
        if ahead:
            names = [f"{a['name']} ({a['games']} game{'s' if a['games'] != 1 else ''}"
                     + (f" for {a['from']}, new" if a["from"] else "") + ")" for a in ahead[:3]]
            head = (f"{p.afl_team}'s best 22 has {slots} {one if slots == 1 else word}. " if slots else "")
            if len(ahead) > 3:
                reasons.append(f"{head}{len(ahead)} {word} there played in {stats_year()}, led by {_and_list(names)}.")
            else:
                reasons.append(f"{head}{word[0].upper() + word[1:]} there who played in {stats_year()}: "
                               f"{_and_list(names)}.")
        else:
            reasons.append(f"No {one} at {p.afl_team} played a game in {stats_year()}.")

    if role:
        s = _summary([x for x in pool if x["role"] == role])
        if s["n"] >= 8:
            reasons.append(f"Of the {s['n']} {ROLE_WORDS[role]} drafted {since}, {s['played']} played in year one "
                           f"and {s['ten']} played 10+ games.")
    band = _in(POT_BANDS, p.potential)
    if band:
        s = _summary([x for x in pool if _in(POT_BANDS, x["pot"]) == band])
        if s["n"]:
            reasons.append(f"Potential {p.potential}: of the {s['n']} draftees {since} at {band[2]}, {s['played']} played "
                           f"in year one and {s['ten']} played 10+ games.")
    if seniors:
        n = sum(r.matches for r in seniors)
        lg = league_name(seniors[0].competition, seniors[0].season)
        with_ = _summary([x for x in pool if x["senior"] >= 1])
        without = _summary([x for x in pool if x["senior"] == 0])
        line = f"{n} senior {lg} game{'s' if n != 1 else ''} already."
        if with_["n"] >= 5 and without["n"] >= 5:
            line += (f" {round(100 * with_['ten'] / with_['n'])}% of draftees {since} with senior games in their draft "
                     f"year played 10+ in year one, {round(100 * without['ten'] / without['n'])}% of those without.")
        reasons.append(line)
    pos = (p.position or "MID").split("/")[0]
    if p.afl_team:
        left = [q.name for q in AflPlayer.query.filter(
            AflPlayer.afl_team == p.afl_team, AflPlayer.left_afl_year == config.CURRENT_YEAR - 1).all()
            if pos in (q.position or "").split("/") and (q.games_played or 0) >= 8]
        if left:
            reasons.append(f"{p.afl_team} lost {len(left)} {LINE_WORD.get(pos, 'players')} who played 8 or more games: "
                           f"{_and_list(left[:3])}.")
    return {"label": label, "tone": tone, "chance": chance, "reasons": reasons}


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
ROLE_ONE = {"MID": "midfielder", "KF": "key forward", "GF": "general forward",
            "KD": "key defender", "GD": "general defender", "RUC": "ruckman"}
LINE_ROLES = {"KF": ("KF", "GF"), "GF": ("KF", "GF"), "KD": ("KD", "GD"), "GD": ("KD", "GD")}
LINE_WORDS = {("KF", "GF"): "forwards", ("KD", "GD"): "defenders"}
MIN_ROLE_POOL = 12
MIN_RANK_POOL = 8
MIN_CROP = 4


def _min_games(comp):
    return 2 if comp == "u18champs" else 3


def role_pool(comp):
    """Every listed player with a known role who played this competition: his
    last season in it and his draft year, as plain numbers. Junior feeds
    carry no position and a stat line cannot tell a key forward from a
    general one (54% right on a held-out check, 2026-11-26), so the pool is
    only players whose role we know. Lucas, 2026-11-26: "it should be like
    for like... so against mids, against key forwards, rucks"."""
    def build():
        people = AflPlayer.query.filter(AflPlayer.role.isnot(None)).all()
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
                            "dy": draft_info(who)[0],
                            "vals": {label: fn(r) for label, fn in RANK_STATS}}
        return list(best.values())
    return _cached("role_pool:" + comp, 6 * 3600, build)


def _roles_for(p):
    if p.role in ROLE_WORDS:
        return (p.role,)
    pos = (p.position or "").split("/")[0]
    return {"MID": ("MID",), "RUC": ("RUC",), "DEF": ("KD", "GD"), "FWD": ("KF", "GF")}.get(pos, ())


def _rank(row, p):
    """Where his season ranks, stat by stat, against players of his role who
    played the same competition: those drafted from FIRST_CLASS to last
    year, and this year's crop. Widens to his line (forwards, defenders) and
    then to everyone when too few share his role. Lucas, 2026-11-26/27:
    "rankings not comparisons of bs", "who cares if someone was top 3%
    disposals when most of the team are not disposal getters", "it should
    have since 2019 and against current crop of draftee mids". Strongest
    first."""
    dy = draft_info(p)[0] or config.CURRENT_YEAR
    pool = [x for x in role_pool(row.competition) if x["pid"] != p.id and x["dy"]]
    roles = _roles_for(p)
    group = None
    for cand in (roles, LINE_ROLES.get(roles[0]) if len(roles) == 1 else None):
        if cand and sum(1 for x in pool if x["role"] in cand and FIRST_CLASS <= x["dy"] < dy) + 1 >= MIN_ROLE_POOL:
            group = tuple(cand)
            break
    if group:
        pool = [x for x in pool if x["role"] in group]
        word = ROLE_WORDS[group[0]] if len(group) == 1 else LINE_WORDS.get(group, "players")
    else:
        word = "players"
    prev = [x for x in pool if FIRST_CLASS <= x["dy"] < dy]
    crop = [x for x in pool if x["dy"] == dy]
    out = []
    for label, fn in RANK_STATS:
        mine = fn(row)
        vals = [x["vals"][label] for x in prev if x["vals"][label] is not None]
        if mine is None or len(vals) + 1 < MIN_RANK_POOL or (label in ("Goals", "Hitouts") and mine < 0.5):
            continue
        rank = 1 + sum(1 for v in vals if v > mine)
        of = len(vals) + 1
        item = {"label": label, "value": _r1(mine), "rank": rank, "of": of,
                "pct": round(100 * (1 - (rank - 1) / of)), "text": f"{ordinal(rank)} of {of}"}
        cvals = [x["vals"][label] for x in crop if x["vals"][label] is not None]
        if len(cvals) + 1 >= MIN_CROP:
            item["crank"], item["cof"] = 1 + sum(1 for v in cvals if v > mine), len(cvals) + 1
            item["class_text"] = f"{ordinal(item['crank'])} of {item['cof']}"
        out.append(item)
    out.sort(key=lambda x: (-x["pct"], x["rank"]))
    meta = {"word": word, "first": FIRST_CLASS, "last": dy - 1, "dy": dy, "of": len(prev) + 1,
            "crop_of": len(crop) + 1,
            "pool": f"{word} drafted {FIRST_CLASS} to {dy - 1} who played the {league_name(row.competition, row.season)}"}
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
    # the workbook role, as the rankings use it, ahead of the line
    who = f"{size}{ROLE_ONE.get(p.role) or POS_WORD.get(pos, 'player')}".strip()
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
        # only stats every player in the pool has, so "against the 83" is true of each
        whole = [r for r in ranks if r["of"] == meta["of"]] or ranks
        top = [r for r in whole if r["pct"] >= 75][:2] or whole[:1]
        league = f"{head.season} {league_name(head.competition, head.season)}"
        bits = [f"{ordinal(r['rank'])} for {STAT_WORDS.get(r['label'], r['label'].lower())} "
                f"({fmt_num(r['value'])}{'' if r['label'] == 'Fantasy' else ' a game'})" for r in top]
        comp = league_name(head.competition, head.season)
        out.append(f"{head.matches} games in the {league} for {head.team}. Against the {meta['of']} {meta['word']} "
                   f"drafted {meta['first']} to {meta['last']} who played the {comp}, he ranks " + " and ".join(bits) + ".")
        crop = [r for r in top if "crank" in r]
        if crop:
            ords = {ordinal(r["crank"]) for r in crop}
            what = (f"{ords.pop()} for {'both' if len(crop) > 1 else STAT_WORDS.get(crop[0]['label'], crop[0]['label'].lower())}"
                    if len(ords) == 1 else
                    " and ".join(f"{ordinal(r['crank'])} for {STAT_WORDS.get(r['label'], r['label'].lower())}" for r in crop))
            out.append(f"Among the {crop[0]['cof']} {meta['word']} in the {meta['dy']} draft who played it, he is {what}.")
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
                    "group": f"vs {meta['word']}",
                    "col": f"Drafted {meta['first']}-{meta['last'] % 100:02d}",
                    "class_col": f"{meta['dy']} draft" if any("class_text" in r for r in ranks) else None}

    proj = next((r for r in rows if r.predicted_afl_sc), None)
    v = verdict(p, rows)
    desc = description(p, head, headline["ranks"] if headline else [], headline["meta"] if headline else None, rows)
    ht = honour_text(p.junior_honours)
    lines = [f"{(p.afl_team or '')} {POS_WORD.get(pos, 'player')}".strip() + (f", {p.age}" if p.age else "") + "."]
    if ht:
        lines.append(ht)
    return {
        "description": desc,
        "verdict": v,
        "facts": facts, "honours": p.junior_honours, "honour_note": ht, "pathway": p.junior_origin,
        "headline": headline,
        "seasons": [_season_row(r) for r in rows[:6]],
        "projection": ({"sc": round(proj.predicted_afl_sc), "season": proj.season, "tag": proj.scouting_tag or None}
                       if proj else None),
        "lines": lines,
    }

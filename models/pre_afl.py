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
    missing; _weights() puts the lower bands right from draft_history."""
    from models.years import stats_year
    def build():
        last = stats_year() - 1
        games = {(pid, yr): n for pid, yr, n in db.session.query(
            PlayerStat.player_id, PlayerStat.year, db.func.count(PlayerStat.id)).group_by(
            PlayerStat.player_id, PlayerStat.year).all()}
        pot = {(pid, se): pt for pid, se, pt in db.session.query(
            PlayerSeasonRating.player_id, PlayerSeasonRating.season, PlayerSeasonRating.potential).filter(
            PlayerSeasonRating.potential.isnot(None)).all()}
        senior, sen_row = {}, {}
        for r in StateLeagueStat.query.filter(StateLeagueStat.competition.in_(SENIOR_COMPS)).all():
            key = (r.player_name, r.season)
            senior[key] = senior.get(key, 0) + (r.matches or 0)
            if (r.matches or 0) > (sen_row.get(key, (0, None))[0]):
                sen_row[key] = (r.matches or 0, disposals(r))
        out = []
        for q in AflPlayer.query.filter(db.or_(AflPlayer.draft_year.isnot(None), AflPlayer.draft_note.isnot(None))).all():
            yr, pick, kind = draft_info(q)
            if not yr or not (FIRST_CLASS <= yr <= last):
                continue
            out.append({"pid": q.id, "role": q.role, "year": yr, "pick": pick, "kind": kind,
                        "pot": pot.get((q.id, yr + 1)), "g1": games.get((q.id, yr + 1), 0),
                        "senior": senior.get((q.name, yr), 0), "sen_row": sen_row.get((q.name, yr))})
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


def _band(kind, pick):
    """Pick band used to correct for draftees missing from our records."""
    k = (kind or "national").lower()
    if k.startswith("rookie"):
        return "rookie"
    if not k.startswith("national") or not pick:
        return None                       # pre-season and mid-season drafts
    return "1-10" if pick <= 10 else "11-20" if pick <= 20 else "21-40" if pick <= 40 else "41+"


def _weights(rows, target):
    """Row weights that put back the draftees our records lost. Only players
    still on a list are in afl_player, and the ones gone are mostly the ones
    who never played (picks 41 on: 12% of those we hold played 10+ games in
    year one, 9% of every pick; rookies 14% against 9%, 2026-11-27). Sampling
    that depends on the outcome is corrected by weighting each row by one
    over the share of its pick band AND outcome that we hold (draft_history
    is the full draft). A band with no history keeps weight 1."""
    from models.database import DraftHistory
    full = {}
    for d in DraftHistory.query.filter(DraftHistory.g1.isnot(None)).all():
        b = _band(d.kind, d.pick)
        if b:
            k = (b, bool(target({"g1": d.g1})))
            n, held = full.get(k, (0, 0))
            full[k] = (n + 1, held + (1 if d.player_id else 0))
    out = []
    for r in rows:
        n, held = full.get((_band(r["kind"], r["pick"]), bool(target(r))), (0, 0))
        out.append(n / held if held else 1.0)
    return out


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
    s = np.array(_weights(rows, target))
    w = np.zeros(A.shape[1])
    for _ in range(3000):
        q = 1 / (1 + np.exp(-A @ w))
        w -= 0.5 * (A.T @ (s * (q - y)) + np.r_[0, w[1:]]) / s.sum()
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


def _short(name):
    return name.split(" ", 1)[-1] if " " in name else name


def club_line(p):
    """Who he has to get past: his club's players of his role who played last
    season (and where, if they have just arrived), and who left."""
    from models.years import stats_year
    roles = _roles_for(p)
    if not p.afl_team or not roles:
        return None
    ahead, slots = _depth(p, roles)
    word = ROLE_WORDS[roles[0]] if len(roles) == 1 else LINE_WORDS.get(tuple(roles), "players")
    pos = (p.position or "MID").split("/")[0]
    left = [_short(q.name) for q in AflPlayer.query.filter(
        AflPlayer.afl_team == p.afl_team, AflPlayer.left_afl_year == config.CURRENT_YEAR - 1).all()
        if pos in (q.position or "").split("/") and (q.games_played or 0) >= 8]

    def who(a):
        return f"{_short(a['name'])} ({a['games']}" + (f" at {a['from']})" if a["from"] else ")")
    yr = stats_year()
    if not ahead:
        line = f"No {word} on {p.afl_team}'s list played in {yr}"
    elif roles == ("RUC",):
        line = (f"{p.afl_team} play {max(1, slots)} ruckman and have {_and_list([who(a) for a in ahead[:3]])}")
    elif len(ahead) <= 3:
        line = f"{p.afl_team}'s {word} in {yr}: {_and_list([who(a) for a in ahead])}"
    else:
        line = (f"{p.afl_team} used {len(ahead)} {word} in {yr}, the regulars "
                f"{_and_list([who(a) for a in ahead[:3]])}")
    if left:
        line += f"; {_and_list(left[:3])} {'has' if len(left) == 1 else 'have'} gone"
    return line + "."


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
        reasons.append(f"{chance['ten']}% chance of 10+ games in {yr + 1 if yr else stats_year() + 1}.")
    else:
        label, tone = "Not enough to go on", "warn"

    club = club_line(p)
    if club:
        reasons.append(club)
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
# The stats that say something about a player of each role. A midfielder is
# not ranked on hitouts. Lucas, 2026-11-27: "2nd for hitouts (0.7 a game)".
ROLE_STATS = {
    "MID": ("Disposals", "Contested", "Clearances", "Tackles", "Inside 50s", "Marks", "Goals", "Fantasy"),
    "RUC": ("Hitouts", "Clearances", "Contested", "Marks", "Disposals", "Fantasy"),
    "KF": ("Goals", "Marks", "Contested", "Disposals", "Tackles", "Fantasy"),
    "GF": ("Goals", "Tackles", "Inside 50s", "Marks", "Disposals", "Fantasy"),
    "KD": ("Marks", "Rebound 50s", "Disposals", "Contested", "Fantasy"),
    "GD": ("Rebound 50s", "Disposals", "Marks", "Tackles", "Fantasy"),
}
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
    core = set()
    for r in (roles or ROLES):
        core.update(ROLE_STATS[r])
    wanted = core | set(GENERAL)
    out = []
    for label, fn in RANK_STATS:
        if label not in wanted:
            continue
        mine = fn(row)
        vals = [x["vals"][label] for x in prev if x["vals"][label] is not None]
        if mine is None or len(vals) + 1 < MIN_RANK_POOL or (label in ("Goals", "Hitouts") and mine < 0.5):
            continue
        rank = 1 + sum(1 for v in vals if v > mine)
        of = len(vals) + 1
        item = {"label": label, "value": _r1(mine), "rank": rank, "of": of, "core": label in core,
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
    return out, meta


# ── the scouting description ─────────────────────────────────────────────

SENIOR_COMPS = ("vfl", "sanfl", "wafl")
STAT_WORDS = {"Disposals": "disposals", "Fantasy": "fantasy", "Marks": "marks", "Tackles": "tackles",
              "Clearances": "clearances", "Goals": "goals", "Contested": "contested possessions",
              "Inside 50s": "inside 50s", "Rebound 50s": "rebound 50s", "Hitouts": "hitouts"}


STRENGTH = {
    "Disposals": "wins plenty of the ball", "Contested": "wins it in close", "Clearances": "gets first hands at stoppages",
    "Tackles": "brings real pressure", "Inside 50s": "drives it forward", "Marks": "marks it cleanly",
    "Goals": "kicks goals", "Rebound 50s": "rebounds out of defence", "Hitouts": "strong at the ball-up",
    "Fantasy": "racks up fantasy points",
}
WEAKNESS = {
    "Disposals": "doesn't win much of the ball", "Contested": "not a contested ball winner",
    "Clearances": "rarely clears it from stoppages", "Tackles": "light on tackles", "Inside 50s": "rarely drives it inside 50",
    "Marks": "doesn't take many marks", "Goals": "rarely hits the scoreboard", "Rebound 50s": "rarely rebounds out of 50",
    "Hitouts": "loses the taps", "Fantasy": "fantasy output is modest",
}
UNIT = {"Fantasy": ""}


def _crop_ords(crop):
    o = [ordinal(r["crank"]) for r in crop]
    return f"both {o[0]}" if len(o) == 2 and o[0] == o[1] else " and ".join(o)


def _per(r):
    return f"{fmt_num(r['value'])} {STAT_WORDS[r['label']]}" + UNIT.get(r["label"], " a game")


def description(p, head, ranks, meta, rows):
    """A scout's paragraph: who he is in a line, whether he is ready for men,
    what he does best against his own kind of player, and what he does not
    do. Every claim is a ranking against players of his role. Lucas,
    2026-11-27: "you arent talking like a detailed footy analyst ... stating
    implied things"."""
    out = []
    yr, pick, kind = draft_info(p)
    who = []
    if pick:
        who.append(f"Pick {pick}" + ("" if kind in (None, "National") else f" in the {kind.lower()} draft"))
    if p.junior_origin:
        who.append(f"from {p.junior_origin.split(' / ')[-1]}")
    first = " ".join(who)
    if p.role in ("KF", "KD", "RUC") and p.height_cm:
        first += f", {p.height_cm} cm"
    if p.junior_honours:
        first += f", {p.junior_honours.split(',')[0].strip()}"
    if first:
        out.append(first[0].upper() + first[1:] + ".")

    # ready for men?
    seniors = [r for r in rows if r.competition in SENIOR_COMPS and (r.matches or 0) >= 1 and yr and r.season >= yr]
    if seniors:
        s = max(seniors, key=lambda r: r.matches or 0)
        d = disposals(s)
        lg = league_name(s.competition, s.season)
        line = f"Already {s.matches} {lg} game{'s' if s.matches != 1 else ''} with {s.team}"
        if d:
            line += f" at {fmt_num(d)} disposals"
            roles = _roles_for(p)
            peers = [x["sen_row"][1] for x in draftees() if x["role"] in roles and x["sen_row"]
                     and x["sen_row"][0] >= 3 and x["sen_row"][1]]
            if len(peers) >= 5 and (s.matches or 0) >= 3:
                rank = 1 + sum(1 for v in peers if v > d)
                word = ROLE_WORDS.get(roles[0], "players") if len(roles) == 1 else LINE_WORDS.get(tuple(roles), "players")
                if rank == 1:
                    line += f", more than any of the {len(peers)} {word} drafted since {FIRST_CLASS} managed in senior footy in their draft year"
                elif rank <= 3:
                    line += f", {ordinal(rank)} of the {len(peers)} {word} drafted since {FIRST_CLASS} who played senior footy in their draft year"
        out.append(line + ".")

    if head and ranks:
        lg = league_name(head.competition, head.season)
        mine = [r for r in ranks if r.get("core", True)]
        whole = [r for r in mine if r["of"] == meta["of"]] or mine
        strong = [r for r in whole if r["pct"] >= 80][:2]
        if strong:
            does = " and ".join(STRENGTH[r["label"]] for r in strong)
            nums = " and ".join(f"{fmt_num(r['value'])} {STAT_WORDS[r['label']]}" for r in strong)
            nums += "" if all(r["label"] == "Fantasy" for r in strong) else " a game"
            ords = [ordinal(r["rank"]) for r in strong]
            where = f"both {ords[0]}" if len(ords) == 2 and ords[0] == ords[1] else " and ".join(ords)
            crop = [r for r in strong if "crank" in r]
            out.append(f"{does[0].upper() + does[1:]}: {nums} in the {lg}, "
                       f"{where} of the {meta['of']} {meta['word']} drafted since {meta['first']}"
                       + (f", and {_crop_ords(crop)} in this year's crop" if len(crop) == len(strong) else "")
                       + ".")
        else:
            best = whole[0]
            out.append(f"No standout number in the {lg}: his best against {meta['word']} drafted since {meta['first']} "
                       f"is {fmt_num(best['value'])} {STAT_WORDS[best['label']]}, {ordinal(best['rank'])} of {best['of']}.")
        weak = [r for r in whole if r["pct"] <= 30 and r["label"] != "Fantasy"]
        if weak:
            w = min(weak, key=lambda r: r["pct"])
            out.append(f"{WEAKNESS[w['label']][0].upper() + WEAKNESS[w['label']][1:]} ({_per(w)}, "
                       f"{ordinal(w['rank'])} of {w['of']}).")
    elif head:
        out.append(f"{head.matches} games in the {head.season} {league_name(head.competition, head.season)}, "
                   f"{fmt_num(disposals(head))} disposals a game.")
    if not out:
        out.append("No junior or state league games in any source we hold.")
    return " ".join(out)


def fmt_num(v):
    v = _r1(v)
    return "-" if v is None else (str(int(v)) if float(v).is_integer() else f"{v:.1f}")


# ── the card ─────────────────────────────────────────────────────────────

# Always on the card, whatever he is good at (Lucas, 2026-11-27: "things
# should also keep general ones too... disposals... marks.. tackles"), plus
# the number that defines his role.
GENERAL = ("Disposals", "Marks", "Tackles", "Fantasy")
ROLE_KEY = {"MID": ("Clearances", "Contested", "Goals"), "RUC": ("Hitouts", "Clearances"), "KF": ("Goals",),
            "GF": ("Goals", "Inside 50s"), "KD": ("Rebound 50s",), "GD": ("Rebound 50s",)}
BEST_PCT = 80


def card_rows(ranks, roles):
    """His standout numbers first (marked best), then the general ones and his
    role's key stat, in a fixed order."""
    by = {r["label"]: r for r in ranks}
    best = [dict(r, best=True) for r in ranks if r["pct"] >= BEST_PCT]
    keys = list(GENERAL) + [k for r in roles for k in ROLE_KEY.get(r, ())]
    seen = {r["label"] for r in best}
    rest = []
    for k in keys:
        if k in by and k not in seen:
            rest.append(by[k])
            seen.add(k)
    return (best + rest)[:7]


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
        table = card_rows(ranks, _roles_for(p))
        headline = {"league": league_name(head.competition, head.season), "season": head.season,
                    "team": head.team, "games": head.matches,
                    "stats": [{"label": a, "value": b} for a, b in stats if b is not None][:3],
                    "ranks": table, "meta": meta, "pool": meta["pool"],
                    "group": f"vs {meta['word']}",
                    "col": f"Since {meta['first']}",
                    "class_col": "This draft" if any("class_text" in r for r in ranks) else None}

    proj = next((r for r in rows if r.predicted_afl_sc), None)
    v = verdict(p, rows)
    desc = description(p, head, ranks if headline else [], headline["meta"] if headline else None, rows)
    ht = honour_text(p.junior_honours)
    lines = [f"{(p.afl_team or '')} {POS_WORD.get(pos, 'player')}".strip() + (f", {p.age}" if p.age else "") + "."]
    if ht:
        lines.append(ht)
    from models.season_table import junior_table
    _yr, pick, kind = draft_info(p)
    return {
        "description": desc,
        "verdict": v,
        "pick": pick, "pick_kind": kind,
        "season_table": junior_table(rows),
        "facts": facts, "honours": p.junior_honours, "honour_note": ht, "pathway": p.junior_origin,
        "headline": headline,
        "seasons": [_season_row(r) for r in rows[:6]],
        "projection": ({"sc": round(proj.predicted_afl_sc), "season": proj.season, "tag": proj.scouting_tag or None}
                       if proj else None),
        "lines": lines,
    }


def scouting_summary():
    """{player_id: {label, tone, ten, pick, best}} for every listed player
    with no AFL games: the draft room's outlook column (2026-11-27). Built
    from the same card the player pop-up shows, cached for an hour."""
    def build():
        out = {}
        q = AflPlayer.query.filter(AflPlayer.listed(),
                                   db.or_(AflPlayer.career_games.is_(None), AflPlayer.career_games == 0))
        for p in q.all():
            try:
                card = pre_afl(p)
            except Exception:
                continue
            v = card.get("verdict") or {}
            ranks = (card.get("headline") or {}).get("ranks") or []
            best = next((r for r in ranks if r.get("best")), ranks[0] if ranks else None)
            word = ((card.get("headline") or {}).get("meta") or {}).get("word", "")
            out[p.id] = {"label": v.get("label"), "tone": v.get("tone"),
                         "ten": (v.get("chance") or {}).get("ten"), "pick": card.get("pick"),
                         "best": f"{best['text']} {word} drafted since {FIRST_CLASS} for {best['label'].lower()}" if best else None}
        return out
    return _cached("scouting_summary", 3600, build)

"""Player honours: the trophies on the player card and the player page.

Everything is keeper league football. A game counts when he was in the 23
that counted for his club (the round_score breakdown, emergencies who came
in included) and scored more than zero, in a league round whose fixture is
completed.

Most honours run on two measures:

  points over replacement  his score minus what a replacement at the same
                           position scored that round. A replacement is the
                           next player down once every club has filled its
                           lines (6 DEF, 9 MID, 6 FWD, 1 RUC): the average of
                           the next N scores, N = clubs in the league.
                           Dual-position players count in every pool they
                           can play; a flex or an emergency is judged against
                           his cheapest position.

  wins added               how far those points moved his club's chance of
                           winning that match: P(win | margin) minus
                           P(win | margin - his points over replacement),
                           with P a normal curve as wide as the season's
                           margins. Points in a tight game count more than
                           the same points in a thrashing.

Season honours (premiership, club champion, League Medal, All-League,
leading scorer, Rising Star, The Rock, breakout, draft bargain, captain) are
only given once every fixture of that season is completed. Match winners and
games milestones count as they happen.

The premiership goes to the club on top of the ladder: this league has no
finals (Lucas, 2026-11-26). A premiership player had at least one counted
game for them that season.
"""

import json
import math
import statistics
import threading
import time
from collections import defaultdict

from models.database import (
    db, AflPlayer, FantasyTeam, Fixture, RoundScore, WeeklyLineup, LineupSlot,
    PlayerStat, SeasonStanding, SeasonSquad,
)

LINES = {"DEF": 6, "MID": 9, "FWD": 6, "RUC": 1}
ALL_LEAGUE = {"DEF": 6, "MID": 9, "FWD": 6, "RUC": 1, "FLEX": 1}
MIN_ALL_LEAGUE = 12
MIN_ROCK = 15
MIN_BREAKOUT = 12
RISING_AGE = 21
BARGAIN_TOP = 30
CLUB_STEPS = (25, 50, 100, 150, 200)
LEAGUE_STEPS = (50, 100, 150, 200)

# name, how it climbs with repeats, display order
KINDS = {
    "premiership": ("Premiership player", "big", 1),
    "champion":    ("Club champion", "big", 2),
    "leaguemedal": ("League Medal", "big", 3),
    "allleague":   ("All-League", "big", 4),
    "topscorer":   ("Leading scorer", "big", 5),
    "rising":      ("Rising Star", "big", 6),
    "matchwinner": ("Match winner", "feat", 7),
    "rock":        ("The Rock", "feat", 8),
    "breakout":    ("Breakout", "feat", 9),
    "bargain":     ("Draft bargain", "feat", 10),
    "captain":     ("Club captain", "feat", 11),
    "clubgames":   ("Club games", "mile", 12),
    "leaguegames": ("League games", "mile", 13),
}


def tier_for(kind, times=1, step=None):
    """The metal an emblem is drawn in."""
    group = KINDS[kind][1]
    if group == "big":
        return ("gold", "plat", "ruby", "sapph")[times - 1] if times <= 4 else "black"
    if group == "feat":
        if times >= 10:
            return "black"
        if times >= 5:
            return "plat"
        if times >= 3:
            return "gold"
        return "silver" if times == 2 else "bronze"
    return {25: "bronze", 50: "silver", 100: "gold", 150: "plat", 200: "black"}.get(step, "bronze")


def _elig(pos):
    out = [x.strip() for x in (pos or "MID").upper().split("/") if x.strip() in LINES]
    return out or ["MID"]


def _phi(x, sigma):
    return 0.5 * (1 + math.erf(x / (sigma * math.sqrt(2))))


def _age_in(p, year, squad_age):
    if squad_age:
        return squad_age
    if p and p.dob:
        try:
            return year - int(str(p.dob)[:4]) - 1  # age at the start of the season, near enough
        except ValueError:
            return p.age
    return p.age if p else None


def _season(league_id, year, teams):
    """Everything one season gives. Returns (honours, games) where honours
    is a list of dicts and games is {(team_id, player_id): counted games}."""
    fixtures = Fixture.query.filter_by(league_id=league_id, year=year).all()
    done = [f for f in fixtures if f.status == "completed"]
    if not done:
        return [], {}
    complete = len(done) == len(fixtures)
    rounds = sorted({f.afl_round for f in done})
    tids = list(teams)

    breakdown, emergencies = {}, {}
    for rs in RoundScore.query.filter(RoundScore.team_id.in_(tids), RoundScore.year == year,
                                      RoundScore.afl_round.in_(rounds)).all():
        raw = rs.breakdown or {}
        if isinstance(raw, str):
            raw = json.loads(raw or "{}")
        scores = {}
        for k, v in raw.items():
            try:
                scores[int(str(k).replace("emergency_", ""))] = v
            except ValueError:
                continue
        breakdown[(rs.team_id, rs.afl_round)] = scores
        emergencies[(rs.team_id, rs.afl_round)] = {int(str(k)[10:]) for k in raw if str(k).startswith("emergency_")}

    slot, listed, cap_slot = {}, defaultdict(set), {}
    captain = defaultdict(lambda: defaultdict(int))
    rows = (db.session.query(WeeklyLineup.team_id, WeeklyLineup.afl_round, LineupSlot.player_id,
                             LineupSlot.position_code, LineupSlot.is_captain)
            .join(LineupSlot, LineupSlot.lineup_id == WeeklyLineup.id)
            .filter(WeeklyLineup.team_id.in_(tids), WeeklyLineup.year == year,
                    WeeklyLineup.afl_round.in_(rounds)).all())
    for tid, rnd, pid, code, is_cap in rows:
        slot[(tid, rnd, pid)] = (code or "").upper()
        listed[rnd].add(pid)
        if is_cap:
            cap_slot[(tid, rnd)] = pid

    pids = {p for s in breakdown.values() for p in s} | {p for s in listed.values() for p in s}
    players = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(list(pids) or [0])).all()}
    sc = {(s.player_id, s.round): s.supercoach_score
          for s in PlayerStat.query.filter(PlayerStat.year == year, PlayerStat.round.in_(rounds),
                                           PlayerStat.player_id.in_(list(pids) or [0])).all()
          if s.supercoach_score is not None}

    n = len(teams)
    repl = {}
    for r in rounds:
        pool = defaultdict(list)
        for pid in listed[r]:
            s = sc.get((pid, r))
            if s and s > 0:
                for e in _elig(players[pid].position if pid in players else None):
                    pool[e].append(s)
        for line, k in LINES.items():
            v = sorted(pool[line], reverse=True)
            band = v[k * n:k * n + n] or v[-n:] or [0]
            repl[(r, line)] = statistics.mean(band)

    def over(tid, r, pid, s):
        code = slot.get((tid, r, pid), "")
        if code in LINES:
            return s - repl[(r, code)]
        el = _elig(players[pid].position if pid in players else None)
        return s - min(repl[(r, e)] for e in el)

    margins = [(f.home_score or 0) - (f.away_score or 0) for f in done]
    sigma = statistics.pstdev(margins) or 100.0

    games = defaultdict(int)
    pts = defaultdict(float)
    por = defaultdict(float)
    wins = defaultdict(float)
    above = defaultdict(int)
    medal = defaultdict(int)
    out = []

    for f in sorted(done, key=lambda f: f.afl_round):
        r = f.afl_round
        both = []
        for tid, m in ((f.home_team_id, (f.home_score or 0) - (f.away_score or 0)),
                       (f.away_team_id, (f.away_score or 0) - (f.home_score or 0))):
            side = []
            for pid, s in breakdown.get((tid, r), {}).items():
                if not s or s <= 0:
                    continue
                v = over(tid, r, pid, s)
                k = (tid, pid)
                games[k] += 1
                pts[k] += s
                por[k] += v
                wins[k] += _phi(m, sigma) - _phi(m - v, sigma)
                if v > 0:
                    above[k] += 1
                if cap_slot.get((tid, r)) == pid:  # wore the C and played
                    captain[tid][pid] += 1
                side.append((pid, s, v))
                both.append((pid, v))
            # Match winner: his club won, without him they lose, and no more
            # than two team-mates could say the same.
            if m > 0 and side:
                flips = [x for x in side if x[2] > m]
                if flips and len(flips) <= 3:
                    pid, s, v = max(flips, key=lambda x: x[2])
                    out.append({"kind": "matchwinner", "player_id": pid, "team_id": tid, "year": year,
                                "round": r, "detail": f"Round {r}: {s} points, won by {round(m)}"})
        for i, (pid, v) in enumerate(sorted(both, key=lambda x: -x[1])[:3]):
            medal[pid] += 3 - i

    if not complete:
        return out, dict(games)

    def add(kind, pid, tid, detail, value=None):
        out.append({"kind": kind, "player_id": pid, "team_id": tid, "year": year,
                    "detail": detail, "value": value})

    def tname(tid):
        return teams[tid].name if tid in teams else ""

    # Premiership: the ladder topper.
    top = (SeasonStanding.query.filter_by(league_id=league_id, year=year)
           .order_by(SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc()).first())
    if top:
        for (tid, pid), g in games.items():
            if tid == top.team_id:
                add("premiership", pid, tid, f"{tname(tid)}, {g} game{'' if g == 1 else 's'}", g)

    # Club champion: most wins added at the club. A tie shares it.
    by_club = defaultdict(list)
    for (tid, pid), w in wins.items():
        by_club[tid].append((w, pid))
    for tid, rows_ in by_club.items():
        best = max(w for w, _ in rows_)
        for w, pid in rows_:
            if abs(w - best) < 1e-9:
                add("champion", pid, tid, f"{tname(tid)}, {w:.2f} wins added", round(w, 2))

    # League Medal.
    if medal:
        best = max(medal.values())
        for pid, v in medal.items():
            if v == best:
                tid = max((k for k in games if k[1] == pid), key=lambda k: games[k])[0]
                add("leaguemedal", pid, tid, f"{v} votes", v)

    # Season totals across clubs (a player traded mid-season adds up).
    pg, pw, pp = defaultdict(int), defaultdict(float), defaultdict(float)
    club_of = {}
    for (tid, pid), g in games.items():
        pg[pid] += g
        pw[pid] += wins[(tid, pid)]
        pp[pid] += pts[(tid, pid)]
        if g > games.get((club_of.get(pid), pid), 0):
            club_of[pid] = tid

    # All-League: best 23 by wins added into real lines.
    team = defaultdict(list)
    for pid in sorted((p for p in pg if pg[p] >= MIN_ALL_LEAGUE), key=lambda p: -pw[p]):
        el = [e for e in _elig(players[pid].position if pid in players else None)
              if len(team[e]) < ALL_LEAGUE[e]]
        if el:
            team[min(el, key=lambda e: ALL_LEAGUE[e] - len(team[e]))].append(pid)
        elif len(team["FLEX"]) < ALL_LEAGUE["FLEX"]:
            team["FLEX"].append(pid)
        if sum(len(v) for v in team.values()) == sum(ALL_LEAGUE.values()):
            break
    names = {"DEF": "defence", "MID": "midfield", "FWD": "forward line", "RUC": "ruck", "FLEX": "flex"}
    for line, ps in team.items():
        for pid in ps:
            add("allleague", pid, club_of[pid], f"Named in the {names[line]}", round(pw[pid], 2))

    # Leading scorer.
    if pp:
        best = max(pp.values())
        for pid, v in pp.items():
            if v == best:
                add("topscorer", pid, club_of[pid], f"{round(v):,} points", round(v))

    # Squad facts for age and draft position.
    squad = {(s.team_id, s.player_id): s for s in SeasonSquad.query.filter_by(league_id=league_id, year=year).all()}
    sq_by_player = {}
    for (tid, pid), s in squad.items():
        sq_by_player.setdefault(pid, s)

    # Rising Star.
    young = [pid for pid in pg
             if (_age_in(players.get(pid), year, getattr(sq_by_player.get(pid), "age", None)) or 99) <= RISING_AGE]
    if young:
        best = max(pw[p] for p in young)
        for pid in young:
            if abs(pw[pid] - best) < 1e-9:
                age = _age_in(players.get(pid), year, getattr(sq_by_player.get(pid), "age", None))
                add("rising", pid, club_of[pid], f"Age {age}, {pw[pid]:.2f} wins added", round(pw[pid], 2))

    # The Rock.
    for (tid, pid), g in games.items():
        if g >= MIN_ROCK and above[(tid, pid)] == g:
            add("rock", pid, tid, f"Above replacement in all {g} games", g)

    # Breakout: biggest jump on last season's average.
    prev = {}
    for pid in pg:
        s = sq_by_player.get(pid)
        if s and s.prev_avg:
            prev[pid] = s.prev_avg
    missing = [p for p in pg if p not in prev]
    if missing:
        acc = defaultdict(list)
        for st in PlayerStat.query.filter(PlayerStat.year == year - 1, PlayerStat.player_id.in_(missing)).all():
            if st.supercoach_score is not None and not st.is_live:
                acc[st.player_id].append(st.supercoach_score)
        for pid, v in acc.items():
            if len(v) >= 5:
                prev[pid] = sum(v) / len(v)
    jumps = {pid: pp[pid] / pg[pid] - prev[pid] for pid in pg if pid in prev and pg[pid] >= MIN_BREAKOUT}
    if jumps:
        pid = max(jumps, key=jumps.get)
        if jumps[pid] > 0:
            add("breakout", pid, club_of[pid],
                f"{prev[pid]:.1f} to {pp[pid] / pg[pid]:.1f}, up {jumps[pid]:.1f}", round(jumps[pid], 1))

    # Draft bargain: the biggest gap between pick and value rank, top 30 by value.
    drafted = [(pid, s.draft_pick) for pid, s in sq_by_player.items()
               if s.draft_pick and (s.acquired_via or "draft") == "draft" and pid in pw]
    ranked = sorted(drafted, key=lambda x: -pw[x[0]])
    gaps = [(pick - (i + 1), pid, pick, i + 1) for i, (pid, pick) in enumerate(ranked) if i < BARGAIN_TOP]
    if gaps:
        gap, pid, pick, rank = max(gaps)
        if gap > 0:
            add("bargain", pid, club_of[pid], f"Pick {pick}, finished {rank} of {len(ranked)} picks", pick)

    # Club captain: most rounds with the C at his club. A tie shares it.
    for tid, caps in captain.items():
        best = max(caps.values())
        for pid, v in caps.items():
            if v == best:
                add("captain", pid, tid, f"{tname(tid)}, captain {v} rounds", v)

    return out, dict(games)


def _compute(league_id):
    teams = {t.id: t for t in FantasyTeam.query.filter_by(league_id=league_id).all()}
    years = sorted({y for (y,) in db.session.query(Fixture.year).filter_by(league_id=league_id).distinct()})
    honours = []
    club_games = defaultdict(int)
    order = []
    for y in years:
        hs, games = _season(league_id, y, teams)
        honours += hs
        for (tid, pid), g in games.items():
            club_games[(tid, pid)] += g
            order.append((tid, pid))
    by_player = defaultdict(list)
    for h in honours:
        by_player[h["player_id"]].append(h)
    league_games = defaultdict(int)
    for (tid, pid), g in club_games.items():
        league_games[pid] += g
    for (tid, pid), g in club_games.items():
        hit = [s for s in CLUB_STEPS if g >= s]
        if hit:
            by_player[pid].append({"kind": "clubgames", "player_id": pid, "team_id": tid, "step": hit[-1],
                                   "detail": f"{g} games for {teams[tid].name if tid in teams else ''}", "value": g})
    for pid, g in league_games.items():
        hit = [s for s in LEAGUE_STEPS if g >= s]
        if hit:
            by_player[pid].append({"kind": "leaguegames", "player_id": pid, "step": hit[-1],
                                   "detail": f"{g} keeper league games", "value": g})
    return {"by_player": dict(by_player), "club_games": dict(club_games), "league_games": dict(league_games),
            "teams": {t.id: t.name for t in teams.values()}}


_CACHE = {}
_LOCK = threading.Lock()


def _signature(league_id):
    """Changes whenever a fixture finishes or a score is corrected."""
    row = db.session.query(db.func.count(Fixture.id), db.func.sum(Fixture.home_score),
                           db.func.sum(Fixture.away_score)).filter(
        Fixture.league_id == league_id, Fixture.status == "completed").first()
    return tuple(row or ())


def league_honours(league_id):
    sig = _signature(league_id)
    with _LOCK:
        hit = _CACHE.get(league_id)
        if hit and hit[0] == sig and time.time() - hit[1] < 3600:
            return hit[2]
    data = _compute(league_id)
    with _LOCK:
        _CACHE[league_id] = (sig, time.time(), data)
    return data


def for_player(league_id, player_id):
    """His honours grouped for display: one entry per emblem, best first.

    [{kind, name, tier, times, step, items: [{year, team, detail}]}],
    plus `next`: the next games milestone he is heading for."""
    data = league_honours(league_id)
    raw = data["by_player"].get(player_id, [])
    teams = data["teams"]
    groups = defaultdict(list)
    for h in raw:
        groups[h["kind"]].append(h)
    out = []
    for kind, hs in groups.items():
        name, group, order = KINDS[kind]
        hs = sorted(hs, key=lambda h: (h.get("year") or 0, h.get("round") or 0))
        items = [{"year": h.get("year"), "team": teams.get(h.get("team_id"), ""), "detail": h["detail"]} for h in hs]
        if group == "mile":
            best = max(hs, key=lambda h: h["step"])
            out.append({"kind": kind, "name": name, "tier": tier_for(kind, step=best["step"]),
                        "times": 1, "step": best["step"], "order": order, "items": items})
        else:
            out.append({"kind": kind, "name": name, "tier": tier_for(kind, len(hs)),
                        "times": len(hs), "step": None, "order": order, "items": items})
    out.sort(key=lambda e: e["order"])

    nxt = None
    mine = {tid: g for (tid, pid), g in data["club_games"].items() if pid == player_id}
    if mine:
        tid, g = max(mine.items(), key=lambda kv: kv[1])
        step = next((s for s in CLUB_STEPS if s > g), None)
        if step:
            nxt = {"kind": "clubgames", "name": "Club games", "step": step, "games": g, "to_go": step - g,
                   "team": teams.get(tid, ""), "tier": tier_for("clubgames", step=step)}
    return {"emblems": out, "next": nxt}

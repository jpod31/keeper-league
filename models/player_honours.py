"""Player honours, v3 (2026-11-27): few honours, hard to win.

Lucas: "we dont need highly overlapping trophies, having too many badges
reduces the need for them ... you want them to be quite coveted", then
"wheres the all league 23?". The proposal he saw is artifact
6Bp96JykZHQTjzFspYyx8M (v3); docs/HONOURS_V2.md has the list.

Everything is keeper league football. A game counts when he was in the 23
that counted for his club (the round_score breakdown, emergencies who came
in included) and scored more than zero, in a league round whose fixture is
completed. The 7s count the same way off the 7s scores and 7s fixtures.
Rounds without a fixture (AFL finals weeks are saved too) never count.

Points over replacement: his score minus what a replacement at his position
scored that round. A replacement is the next player down once every club has
filled its lines (6 DEF, 9 MID, 6 FWD, 1 RUC): the mean of the next N scores,
N = clubs in the league. Dual-position players count in every pool they can
play; a flex or an emergency is judged against his cheapest position.

Season honours (given once every fixture of the season is completed):
  The Flag        12+ games in the 23 for the club that topped the ladder
                  (no finals in this league)
  Keeper Medal    3-2-1 votes a match to the best three on the ground, on
                  points over replacement
  Club Champion   5-4-3-2-1 votes each round to the club's best five; a tie
                  goes to more rounds as the club's best
  Rising Star     most Keeper Medal votes aged 21 or under
  All-League      the best 23 of the season on points over replacement,
                  12+ games, picked into real lines plus a flex
  The Siren       (as it happens) at most one a match: his club won, without
                  his points over replacement it loses, and no more than two
                  team-mates could say the same
7s:
  7s Flag         8+ 7s games for the club that topped the 7s ladder
  7s Medal        3-2-1 votes a 7s match on score
  Called Up       started the season in his club's 7s (no game in its 23
                  before his first 7s game), then 8+ games in its 23
Career:
  Club games      50, 100 (Life Member), 150, 200 for one club
  Triple Crown    a Flag, a Keeper Medal and a Club Champion in one career
  Hall of Fame    100 points; Legend at 250, or two Keeper Medals and the Hall
"""

import json
import statistics
import threading
import time
from collections import defaultdict

from models.database import (
    db, AflPlayer, FantasyTeam, Fixture, RoundScore, WeeklyLineup, LineupSlot,
    PlayerStat, SeasonStanding, Reserve7sFixture, Reserve7sRoundScore, Reserve7sStanding,
)

LINES = {"DEF": 6, "MID": 9, "FWD": 6, "RUC": 1}
ALL_LEAGUE = {"DEF": 6, "MID": 9, "FWD": 6, "RUC": 1, "FLEX": 1}
MIN_FLAG = 12
MIN_ALL_LEAGUE = 12
MIN_FLAG7 = 8
MIN_CALLED_UP = 8
RISING_AGE = 21
CLUB_STEPS = (50, 100, 150, 200)
HOF = 100
LEGEND = 250

# kind: (name, Hall of Fame points each, how repeats climb, display order)
KINDS = {
    "flag":        ("The Flag", 15, "big", 1),
    "keepermedal": ("Keeper Medal", 30, "big", 2),
    "champion":    ("Club Champion", 15, "big", 3),
    "allleague":   ("All-League", 6, "big", 4),
    "rising":      ("Rising Star", 8, "big", 5),
    "siren":       ("The Siren", 4, "feat", 6),
    "flag7":       ("7s Flag", 5, "big", 7),
    "medal7":      ("7s Medal", 10, "big", 8),
    "calledup":    ("Called Up", 4, "big", 9),
    "clubgames":   ("Club games", 0, "mile", 10),
    "triple":      ("Triple Crown", 0, "summit", 11),
    "hof":         ("Hall of Fame", 0, "summit", 12),
    "legend":      ("Legend", 0, "summit", 13),
}
CLUB_STEP_POINTS = {50: 5, 100: 10, 150: 15, 200: 20}
SEVENS = {"flag7", "medal7", "calledup"}


def tier_for(kind, times=1, step=None):
    """The metal an emblem is drawn in: every repeat changes it."""
    group = KINDS[kind][2]
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
    if group == "mile":
        return {50: "silver", 100: "gold", 150: "plat", 200: "black"}.get(step, "silver")
    return "black" if kind == "legend" else "gold"


def _elig(pos):
    out = [x.strip() for x in (pos or "MID").upper().split("/") if x.strip() in LINES]
    return out or ["MID"]


def _age_in(p, year):
    if p and p.dob:
        try:
            return year - int(str(p.dob)[:4]) - 1  # at the start of the season, near enough
        except ValueError:
            pass
    if p and p.age is not None:
        from config import CURRENT_YEAR
        return p.age - (CURRENT_YEAR - year)
    return None


def _breakdown(raw):
    if isinstance(raw, str):
        raw = json.loads(raw or "{}")
    out = {}
    for k, v in (raw or {}).items():
        try:
            out[int(str(k).replace("emergency_", ""))] = v
        except ValueError:
            continue
    return out


def _season(league_id, year, teams):
    """One season: (honours, games, season facts for the board)."""
    fixtures = Fixture.query.filter_by(league_id=league_id, year=year).all()
    done = [f for f in fixtures if f.status == "completed"]
    if not done:
        return [], {}, {}
    complete = len(done) == len(fixtures)
    rounds = sorted({f.afl_round for f in done})
    tids = list(teams)

    breakdown = {}
    for rs in RoundScore.query.filter(RoundScore.team_id.in_(tids), RoundScore.year == year,
                                      RoundScore.afl_round.in_(rounds)).all():
        breakdown[(rs.team_id, rs.afl_round)] = _breakdown(rs.breakdown)

    slot, listed = {}, defaultdict(set)
    for tid, rnd, pid, code in (db.session.query(WeeklyLineup.team_id, WeeklyLineup.afl_round, LineupSlot.player_id,
                                                 LineupSlot.position_code)
                                .join(LineupSlot, LineupSlot.lineup_id == WeeklyLineup.id)
                                .filter(WeeklyLineup.team_id.in_(tids), WeeklyLineup.year == year,
                                        WeeklyLineup.afl_round.in_(rounds)).all()):
        slot[(tid, rnd, pid)] = (code or "").upper()
        listed[rnd].add(pid)

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
        return s - min(repl[(r, e)] for e in _elig(players[pid].position if pid in players else None))

    games = defaultdict(int)          # (tid, pid) -> counted games
    first_game = {}                   # (tid, pid) -> first round in the 23
    rounds_in = defaultdict(list)     # (tid, pid) -> rounds in the 23
    pts = defaultdict(float)
    por = defaultdict(float)
    medal = defaultdict(int)
    club_votes = defaultdict(lambda: defaultdict(int))
    club_best = defaultdict(lambda: defaultdict(int))
    out = []
    facts = {"top_score": None, "top_club_round": None}

    def tname(tid):
        return teams[tid].name if tid in teams else ""

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
                rounds_in[k].append(r)
                first_game.setdefault(k, r)
                pts[k] += s
                por[k] += v
                side.append((pid, s, v))
                both.append((pid, v))
                if not facts["top_score"] or s > facts["top_score"]["score"]:
                    facts["top_score"] = {"score": s, "player_id": pid, "team": tname(tid), "round": r}
            total = (f.home_score if tid == f.home_team_id else f.away_score) or 0
            if not facts["top_club_round"] or total > facts["top_club_round"]["score"]:
                facts["top_club_round"] = {"score": round(total), "team": tname(tid), "round": r}
            for i, (pid, _s, _v) in enumerate(sorted(side, key=lambda x: -x[2])[:5]):
                club_votes[tid][pid] += 5 - i
                if i == 0:
                    club_best[tid][pid] += 1
            # The Siren: his club won, without him they lose, and no more than
            # two team-mates could say the same. One a match at most.
            if m > 0 and side:
                flips = [x for x in side if x[2] > m]
                if flips and len(flips) <= 3:
                    pid, s, v = max(flips, key=lambda x: x[2])
                    out.append({"kind": "siren", "player_id": pid, "team_id": tid, "year": year, "round": r,
                                "detail": f"Round {r}, {round(s)} points, won by {round(m)}", "value": round(m)})
        for i, (pid, v) in enumerate(sorted(both, key=lambda x: -x[1])[:3]):
            medal[pid] += 3 - i

    pg, pp, pv = defaultdict(int), defaultdict(float), defaultdict(float)
    club_of = {}
    for (tid, pid), g in games.items():
        pg[pid] += g
        pp[pid] += pts[(tid, pid)]
        pv[pid] += por[(tid, pid)]
        if g > games.get((club_of.get(pid), pid), 0):
            club_of[pid] = tid
    if pp:
        pid = max(pp, key=pp.get)
        facts["top_season"] = {"points": round(pp[pid]), "player_id": pid, "team": tname(club_of[pid])}
    facts["medal_votes"] = sorted(([pid, v] for pid, v in medal.items()), key=lambda x: -x[1])[:10]
    facts["rising_votes"] = sorted(([pid, v] for pid, v in medal.items()
                                    if (_age_in(players.get(pid), year) or 99) <= RISING_AGE), key=lambda x: -x[1])[:5]

    if not complete:
        return out, dict(games), {"facts": facts, "complete": False, "rounds_in": rounds_in}

    def add(kind, pid, tid, detail, value=None, extra=None):
        h = {"kind": kind, "player_id": pid, "team_id": tid, "year": year, "detail": detail, "value": value}
        if extra:
            h.update(extra)
        out.append(h)

    # The Flag
    top = (SeasonStanding.query.filter_by(league_id=league_id, year=year)
           .order_by(SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc()).first())
    flag = None
    if top:
        flag = {"team_id": top.team_id, "team": tname(top.team_id), "wins": top.wins, "losses": top.losses, "players": []}
        for (tid, pid), g in sorted(games.items(), key=lambda kv: -kv[1]):
            if tid == top.team_id and g >= MIN_FLAG:
                add("flag", pid, tid, f"{tname(tid)} premiers", g)
                flag["players"].append([pid, g])

    # Keeper Medal (ties share)
    if medal:
        best = max(medal.values())
        for pid, v in medal.items():
            if v == best:
                add("keepermedal", pid, club_of.get(pid), f"{v} votes", v)

    # Club Champion: most votes; a tie goes to more rounds as the club's best
    champs = {}
    for tid, votes in club_votes.items():
        key = max((v, club_best[tid][pid]) for pid, v in votes.items())
        for pid, v in votes.items():
            if (v, club_best[tid][pid]) == key:
                add("champion", pid, tid, f"{tname(tid)}, {v} votes", v)
                champs.setdefault(tid, []).append([pid, v])

    # Rising Star
    young = [pid for pid in medal if (_age_in(players.get(pid), year) or 99) <= RISING_AGE]
    if young:
        best = max(medal[p] for p in young)
        for pid in young:
            if medal[pid] == best and best > 0:
                add("rising", pid, club_of.get(pid), f"Age {_age_in(players.get(pid), year)}, {best} votes", best)

    # All-League 23: best on points over replacement, into real lines
    team = defaultdict(list)
    for pid in sorted((p for p in pg if pg[p] >= MIN_ALL_LEAGUE), key=lambda p: -pv[p]):
        el = [e for e in _elig(players[pid].position if pid in players else None) if len(team[e]) < ALL_LEAGUE[e]]
        if el:
            team[min(el, key=lambda e: ALL_LEAGUE[e] - len(team[e]))].append(pid)
        elif len(team["FLEX"]) < ALL_LEAGUE["FLEX"]:
            team["FLEX"].append(pid)
        if sum(len(v) for v in team.values()) == sum(ALL_LEAGUE.values()):
            break
    line_word = {"DEF": "defence", "MID": "midfield", "FWD": "forward line", "RUC": "ruck", "FLEX": "flex"}
    all_league = {}
    for line in ("DEF", "MID", "RUC", "FWD", "FLEX"):
        all_league[line] = [[pid, round(pp[pid] / pg[pid], 1), pg[pid], tname(club_of[pid])] for pid in team.get(line, [])]
        for pid in team.get(line, []):
            add("allleague", pid, club_of[pid], line_word[line].capitalize(), round(pv[pid], 1), {"line": line})

    return out, dict(games), {"facts": facts, "complete": True, "flag": flag, "champions": champs,
                              "all_league": all_league, "rounds_in": rounds_in}


def _sevens(league_id, year, teams, main_rounds_in):
    """7s honours for one season: (honours, 7s games, board facts)."""
    fixtures = Reserve7sFixture.query.filter_by(league_id=league_id, year=year).all()
    done = [f for f in fixtures if f.status == "completed"]
    if not done:
        return [], {}, {}
    regular = [f for f in fixtures if not f.is_final]
    complete = all(f.status == "completed" for f in regular)
    rounds = sorted({f.afl_round for f in done})
    tids = list(teams)
    scores = {}
    for rs in Reserve7sRoundScore.query.filter(Reserve7sRoundScore.team_id.in_(tids), Reserve7sRoundScore.year == year,
                                               Reserve7sRoundScore.afl_round.in_(rounds)).all():
        scores[(rs.team_id, rs.afl_round)] = _breakdown(rs.breakdown)

    def tname(tid):
        return teams[tid].name if tid in teams else ""

    games = defaultdict(int)
    first7 = {}
    votes = defaultdict(int)
    for f in sorted(done, key=lambda f: f.afl_round):
        r = f.afl_round
        both = []
        for tid in (f.home_team_id, f.away_team_id):
            for pid, s in scores.get((tid, r), {}).items():
                if s and s > 0:
                    games[(tid, pid)] += 1
                    first7.setdefault((tid, pid), r)
                    both.append((pid, s))
        for i, (pid, _s) in enumerate(sorted(both, key=lambda x: -x[1])[:3]):
            votes[pid] += 3 - i
    out = []
    facts = {"medal_votes": sorted(([pid, v] for pid, v in votes.items()), key=lambda x: -x[1])[:10]}
    if not complete:
        return out, dict(games), facts

    def add(kind, pid, tid, detail, value=None):
        out.append({"kind": kind, "player_id": pid, "team_id": tid, "year": year, "detail": detail, "value": value})

    top = (Reserve7sStanding.query.filter_by(league_id=league_id, year=year)
           .order_by(Reserve7sStanding.ladder_points.desc(), Reserve7sStanding.percentage.desc()).first())
    if top:
        facts["flag"] = {"team_id": top.team_id, "team": tname(top.team_id), "wins": top.wins, "losses": top.losses, "players": []}
        for (tid, pid), g in sorted(games.items(), key=lambda kv: -kv[1]):
            if tid == top.team_id and g >= MIN_FLAG7:
                add("flag7", pid, tid, f"{tname(tid)} 7s premiers", g)
                facts["flag"]["players"].append([pid, g])
    if votes:
        best = max(votes.values())
        club = {pid: tid for (tid, pid) in games}
        for pid, v in votes.items():
            if v == best:
                add("medal7", pid, club.get(pid), f"{v} votes", v)
    facts["called_up"] = []
    for (tid, pid), r7 in first7.items():
        main = main_rounds_in.get((tid, pid), [])
        if main and min(main) < r7:
            continue  # already in the 23 before his first 7s game: not called up from the 7s
        after = [r for r in main if r > r7]
        if len(after) >= MIN_CALLED_UP:
            add("calledup", pid, tid, f"Called up by {tname(tid)}", len(after))
            facts["called_up"].append([pid, len(after)])
    facts["called_up"].sort(key=lambda x: -x[1])
    return out, dict(games), facts


def _compute(league_id):
    teams = {t.id: t for t in FantasyTeam.query.filter_by(league_id=league_id).all()}
    years = sorted({y for (y,) in db.session.query(Fixture.year).filter_by(league_id=league_id).distinct()})
    honours, seasons = [], {}
    club_games = defaultdict(int)
    for y in years:
        hs, games, facts = _season(league_id, y, teams)
        h7, games7, facts7 = _sevens(league_id, y, teams, facts.get("rounds_in", {}))
        honours += hs + h7
        for k, g in games.items():
            club_games[k] += g
        facts.pop("rounds_in", None)
        seasons[y] = {**facts, "sevens": facts7}
    by_player = defaultdict(list)
    for h in honours:
        by_player[h["player_id"]].append(h)
    for (tid, pid), g in club_games.items():
        for step in CLUB_STEPS:
            if g >= step:
                by_player[pid].append({"kind": "clubgames", "player_id": pid, "team_id": tid, "step": step,
                                       "detail": f"{step} games for {teams[tid].name if tid in teams else ''}", "value": g})
    # Points, then the summits
    points = {}
    for pid, hs in by_player.items():
        p = sum(KINDS[h["kind"]][1] for h in hs if h["kind"] != "clubgames")
        p += sum(CLUB_STEP_POINTS[h["step"]] for h in hs if h["kind"] == "clubgames")
        points[pid] = p
        kinds = defaultdict(int)
        for h in hs:
            kinds[h["kind"]] += 1
        if kinds["flag"] and kinds["keepermedal"] and kinds["champion"]:
            last = max(h["year"] for h in hs if h["kind"] in ("flag", "keepermedal", "champion"))
            hs.append({"kind": "triple", "player_id": pid, "team_id": None, "year": last,
                       "detail": "A Flag, a Keeper Medal and a Club Champion"})
        if p >= HOF:
            hs.append({"kind": "hof", "player_id": pid, "team_id": None, "year": None, "detail": f"{p} points"})
        if p >= LEGEND or (kinds["keepermedal"] >= 2 and p >= HOF):
            hs.append({"kind": "legend", "player_id": pid, "team_id": None, "year": None, "detail": f"{p} points"})
    return {"by_player": dict(by_player), "club_games": dict(club_games), "points": points, "seasons": seasons,
            "teams": {t.id: t.name for t in teams.values()}}


_CACHE = {}
_LOCK = threading.Lock()


def _signature(league_id):
    """Changes whenever a fixture (main or 7s) finishes or a score is corrected."""
    a = db.session.query(db.func.count(Fixture.id), db.func.sum(Fixture.home_score), db.func.sum(Fixture.away_score)).filter(
        Fixture.league_id == league_id, Fixture.status == "completed").first()
    b = db.session.query(db.func.count(Reserve7sFixture.id), db.func.sum(Reserve7sFixture.home_score)).filter(
        Reserve7sFixture.league_id == league_id, Reserve7sFixture.status == "completed").first()
    return tuple(a or ()) + tuple(b or ())


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


def _emblems(raw, teams):
    groups = defaultdict(list)
    for h in raw:
        groups[h["kind"]].append(h)
    out = []
    for kind, hs in groups.items():
        name, _pts, group, order = KINDS[kind]
        hs = sorted(hs, key=lambda h: (h.get("year") or 0, h.get("round") or 0, h.get("step") or 0))
        items = [{"year": h.get("year"), "team": teams.get(h.get("team_id"), ""), "detail": h["detail"]} for h in hs]
        if group == "mile":
            # one per club: the highest step reached at each, best club first
            best = max(hs, key=lambda h: h["step"])
            out.append({"kind": kind, "name": "Life Member" if best["step"] == 100 else name,
                        "tier": tier_for(kind, step=best["step"]), "times": 1, "step": best["step"],
                        "seven": False, "order": order, "items": [i for i, h in zip(items, hs) if h["step"] == best["step"]]})
        else:
            out.append({"kind": kind, "name": name, "tier": tier_for(kind, len(hs)), "times": len(hs), "step": None,
                        "seven": kind in SEVENS, "order": order, "items": items})
    out.sort(key=lambda e: e["order"])
    return out


def for_player(league_id, player_id):
    """His honours for display: one entry per emblem, best first, his Hall of
    Fame points, and the next games milestone he is heading for."""
    data = league_honours(league_id)
    teams = data["teams"]
    out = _emblems(data["by_player"].get(player_id, []), teams)
    nxt = None
    mine = {tid: g for (tid, pid), g in data["club_games"].items() if pid == player_id}
    if mine:
        tid, g = max(mine.items(), key=lambda kv: kv[1])
        step = next((s for s in CLUB_STEPS if s > g), None)
        if step:
            nxt = {"kind": "clubgames", "name": "Club games", "step": step, "games": g, "to_go": step - g,
                   "team": teams.get(tid, ""), "tier": tier_for("clubgames", step=step)}
    return {"emblems": out, "next": nxt, "points": data["points"].get(player_id, 0), "hof": HOF}


def summary(league_id):
    """{player_id: {points, flags, medals, champs, allleague, icons}} for the
    pool: every player with an honour."""
    data = league_honours(league_id)
    out = {}
    for pid, raw in data["by_player"].items():
        ems = _emblems(raw, data["teams"])
        count = defaultdict(int)
        for h in raw:
            count[h["kind"]] += 1
        out[pid] = {"points": data["points"].get(pid, 0), "flags": count["flag"], "medals": count["keepermedal"],
                    "champs": count["champion"], "allleague": count["allleague"], "sevens": count["flag7"] + count["medal7"] + count["calledup"],
                    "icons": [{"kind": e["kind"], "tier": e["tier"], "step": e["step"], "seven": e["seven"], "times": e["times"],
                               "name": e["name"]} for e in ems]}
    return out


def board(league_id):
    """The Honour Board: every season's winners, the All-League 23, the Hall of
    Fame race, records and the milestones coming up."""
    data = league_honours(league_id)
    teams = data["teams"]
    pids = set(data["points"]) | set(pid for (_t, pid) in data["club_games"])
    for s in data["seasons"].values():
        f = s.get("facts", {})
        for key in ("top_score", "top_season"):
            if f.get(key):
                pids.add(f[key]["player_id"])
        pids.update(p for p, _v in f.get("medal_votes", []))
        pids.update(p for p, _v in f.get("rising_votes", []))
        pids.update(p for p, _v in s.get("sevens", {}).get("medal_votes", []))
        for line in (s.get("all_league") or {}).values():
            pids.update(x[0] for x in line)
    players = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(list(pids) or [0])).all()}

    from models.player_photos import photo_url

    def card(pid):
        p = players.get(pid)
        return {"id": pid, "name": p.name if p else "?", "position": (p.position if p else "") or "",
                "afl_team": (p.afl_team if p else "") or "", "photo_url": photo_url(p.name) if p else None}

    seasons = []
    for y in sorted(data["seasons"], reverse=True):
        s = data["seasons"][y]
        f = s.get("facts", {})
        by_kind = defaultdict(list)
        for pid, hs in data["by_player"].items():
            for h in hs:
                if h.get("year") == y:
                    by_kind[h["kind"]].append({**card(pid), "team": teams.get(h.get("team_id"), ""), "detail": h["detail"],
                                               "value": h.get("value"), "round": h.get("round")})
        for k in by_kind:
            by_kind[k].sort(key=lambda x: (-(x["value"] or 0) if k != "siren" else (x["round"] or 0)))
        s7 = s.get("sevens", {})
        seasons.append({
            "year": y, "complete": s.get("complete", False),
            "flag": s.get("flag") and {**s["flag"], "players": [{**card(pid), "games": g} for pid, g in s["flag"]["players"]]},
            "medal": [{**card(pid), "votes": v} for pid, v in f.get("medal_votes", [])[:5]],
            "rising": [{**card(pid), "votes": v} for pid, v in f.get("rising_votes", [])],
            "honours": dict(by_kind),
            "all_league": {line: [{**card(pid), "avg": avg, "games": g, "team": t} for pid, avg, g, t in rows]
                           for line, rows in (s.get("all_league") or {}).items()},
            "sevens": {
                "flag": s7.get("flag") and {**s7["flag"], "players": [{**card(pid), "games": g} for pid, g in s7["flag"]["players"]]},
                "medal": [{**card(pid), "votes": v} for pid, v in s7.get("medal_votes", [])[:5]],
                "called_up": [{**card(pid), "games": g} for pid, g in s7.get("called_up", [])],
            },
            "records": {
                "top_score": f.get("top_score") and {**f["top_score"], "player": card(f["top_score"]["player_id"])},
                "top_season": f.get("top_season") and {**f["top_season"], "player": card(f["top_season"]["player_id"])},
                "top_club_round": f.get("top_club_round"),
            },
        })
    race = sorted(((pid, p) for pid, p in data["points"].items() if p > 0), key=lambda x: -x[1])[:15]
    near = sorted(((g, tid, pid) for (tid, pid), g in data["club_games"].items() if g < CLUB_STEPS[-1]), reverse=True)
    coming = []
    for g, tid, pid in near:
        step = next((s for s in CLUB_STEPS if s > g), None)
        if step and len(coming) < 8:
            coming.append({**card(pid), "team": teams.get(tid, ""), "games": g, "step": step, "to_go": step - g})
    clubs = defaultdict(list)
    for pid, hs in data["by_player"].items():
        for h in hs:
            if h.get("team_id") in teams and h["kind"] not in ("siren",):
                clubs[h["team_id"]].append({**card(pid), "kind": h["kind"], "name": KINDS[h["kind"]][0], "year": h.get("year"),
                                            "detail": h["detail"], "seven": h["kind"] in SEVENS, "step": h.get("step")})
    for tid in clubs:
        clubs[tid].sort(key=lambda x: (-(x["year"] or 0), KINDS[x["kind"]][3]))
    return {
        "seasons": seasons,
        "hall": {"line": HOF, "legend": LEGEND,
                 "race": [{**card(pid), "points": p, "emblems": [{"kind": e["kind"], "tier": e["tier"], "seven": e["seven"], "step": e["step"]}
                                                                 for e in _emblems(data["by_player"].get(pid, []), teams)]} for pid, p in race],
                 "table": [{"name": KINDS[k][0], "points": KINDS[k][1], "kind": k, "seven": k in SEVENS}
                           for k in sorted(KINDS, key=lambda k: KINDS[k][3]) if KINDS[k][1]]
                 + [{"name": "Club games 50 / 100 / 150 / 200", "points": "5 / 10 / 15 / 20", "kind": "clubgames", "seven": False}]},
        "coming": coming,
        "clubs": [{"team_id": tid, "team": teams[tid], "honours": clubs.get(tid, [])} for tid in teams],
    }


# Board order on the Honour Board, biggest first.
BOARD_ORDER = ("keepermedal", "flag", "champion", "allleague", "rising", "triple", "siren",
               "medal7", "flag7", "calledup", "clubgames", "hof", "legend")


def honour_boards(league_id):
    """One board per honour: every player who holds it, the years he won it,
    and the metal his count puts him in. Lucas, 2026-11-27: "we just want
    honour boards for players that have that badge, and the year they earnt
    them in ... and colour changes for multi year winnings"."""
    from models.player_photos import photo_url
    data = league_honours(league_id)
    teams = data["teams"]
    held = defaultdict(lambda: defaultdict(list))   # kind (or clubgames step) -> pid -> honours
    for pid, hs in data["by_player"].items():
        for h in hs:
            key = f"clubgames{h['step']}" if h["kind"] == "clubgames" else h["kind"]
            held[key][pid].append(h)
    players = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_([p for b in held.values() for p in b] or [0])).all()}

    def board(key, kind, name, step=None):
        rows = []
        for pid, hs in held.get(key, {}).items():
            p = players.get(pid)
            if not p:
                continue
            years = sorted({h["year"] for h in hs if h.get("year")})
            latest = max(hs, key=lambda h: (h.get("year") or 0, h.get("round") or 0))
            if not latest.get("team_id"):
                # career honours carry no club: use the club of his latest club honour
                with_club = [h for h in data["by_player"].get(pid, []) if h.get("team_id")]
                if with_club:
                    latest = {**latest, "team_id": max(with_club, key=lambda h: h.get("year") or 0)["team_id"]}
            times = len(hs) if kind != "clubgames" else 1
            rows.append({"id": pid, "name": p.name, "position": p.position or "", "afl_team": p.afl_team or "",
                         "photo_url": photo_url(p.name), "team": teams.get(latest.get("team_id"), ""),
                         "times": times, "years": years, "tier": tier_for(kind, times, step),
                         "detail": latest.get("detail", ""), "value": latest.get("value")})
        rows.sort(key=lambda r: (-r["times"], -(r["years"][-1] if r["years"] else 0), -(r["value"] or 0), r["name"]))
        return {"key": key, "kind": kind, "name": name, "step": step, "seven": kind in SEVENS,
                "points": KINDS[kind][1] if kind != "clubgames" else CLUB_STEP_POINTS[step], "holders": rows}

    out = []
    for kind in BOARD_ORDER:
        if kind == "clubgames":
            for step in CLUB_STEPS:
                b = board(f"clubgames{step}", "clubgames", "Life Member" if step == 100 else f"{step} club games", step)
                if b["holders"] or step == 100:
                    out.append(b)
        else:
            out.append(board(kind, kind, KINDS[kind][0]))
    return out


def cabinets(league_id):
    """Every honoured player with everything he has accumulated: one row per
    player, his badges in their metal, his Hall of Fame points. Lucas,
    2026-11-27: "its more about which badges players have accumulated ... a
    scrollable list with badges of players that have earnt those badges"."""
    from models.player_photos import photo_url
    data = league_honours(league_id)
    teams = data["teams"]
    pids = list(data["by_player"])
    players = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(pids or [0])).all()}
    out = []
    for pid, hs in data["by_player"].items():
        p = players.get(pid)
        if not p:
            continue
        with_club = [h for h in hs if h.get("team_id")]
        team = teams.get(max(with_club, key=lambda h: h.get("year") or 0)["team_id"], "") if with_club else ""
        ems = _emblems(hs, teams)
        out.append({"id": pid, "name": p.name, "position": p.position or "", "afl_team": p.afl_team or "",
                    "photo_url": photo_url(p.name), "team": team, "points": data["points"].get(pid, 0),
                    "badges": [{"kind": e["kind"], "name": e["name"], "tier": e["tier"], "times": e["times"], "step": e["step"],
                                "seven": e["seven"], "years": sorted({i["year"] for i in e["items"] if i.get("year")})} for e in ems]})
    out.sort(key=lambda r: (-r["points"], -len(r["badges"]), r["name"]))
    return out


def home_line(league_id, team_id):
    """One sentence for Home: your player closest to his next club games
    milestone, and your Hall of Fame leader (2026-11-27). None when there is
    nothing to say."""
    from models.database import FantasyRoster
    data = league_honours(league_id)
    mine = {fr.player_id for fr in FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()}
    if not mine:
        return None
    names = {p.id: p.name for p in AflPlayer.query.filter(AflPlayer.id.in_(list(mine))).all()}
    near = None
    for (tid, pid), g in data["club_games"].items():
        if tid != team_id or pid not in mine:
            continue
        step = next((s for s in CLUB_STEPS if s > g), None)
        if step and (near is None or step - g < near[2]):
            near = (pid, step, step - g)
    lead = max(((pid, data["points"].get(pid, 0)) for pid in mine), key=lambda x: x[1], default=(None, 0))
    bits = []
    if near:
        pid, step, to_go = near
        bits.append(f"{names.get(pid, '?')} is {to_go} game{'s' if to_go != 1 else ''} from {step} for you")
    if lead[0] and lead[1] > 0:
        bits.append(f"{names.get(lead[0], '?')} leads your Hall of Fame race on {lead[1]} points")
    if not bits:
        return None
    s = "; ".join(bits) + "."
    return s[0].upper() + s[1:]

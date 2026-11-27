"""The Record Book (League > Records), 2026-11-27.

Honours, Records and Seasons each answer one question (proposal: artifact
NGSh3hPtSk6HTY6nQJsR2o):
  Honours  what has this player earned?           models/player_honours.py
  Records  what is the best (and worst) ever done?  this module
  Seasons  what happened in a given year?          models/season_squads.py and friends
Records never hand out badges, and premierships show here only as a count.

Counting rules:
  * League rounds only: a round counts when its fixture is completed. AFL
    finals weeks (25 to 29) are saved in round_score too and never count.
    The old records page counted them (Luke Jackson "27 games").
  * The Opening Round (round 0) is short: only some clubs' players play, so
    every club and match score record (scores, margins, combined) leaves it
    out. It counts for runs, rivalries, the ladder and player records.
  * A player's game: in the counted 23 (round_score breakdown, emergencies
    who came in included) and scored more than zero.

record(): {key, label, unit, kind: club|player|match, top: entry, next: [entries]}
"""

import json
from collections import defaultdict

from models.database import db, AflPlayer, FantasyTeam, Fixture, RoundScore, SeasonStanding

TOP = 5
MIN_AVG_GAMES = 10


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


def _rec(key, label, unit, kind, rows):
    return {"key": key, "label": label, "unit": unit, "kind": kind, "top": rows[0] if rows else None, "next": rows[1:TOP]}


def build(league_id):
    from models.player_photos import photo_url
    teams = {t.id: t for t in FantasyTeam.query.filter_by(league_id=league_id).all()}
    name = {tid: t.name for tid, t in teams.items()}
    fixtures = (Fixture.query.filter_by(league_id=league_id, status="completed")
                .order_by(Fixture.year, Fixture.afl_round, Fixture.id).all())
    done = {(f.year, f.afl_round) for f in fixtures}

    # ── clubs ──────────────────────────────────────────────────────
    club_scores = []
    for f in fixtures:
        if f.afl_round == 0:
            continue
        for tid, s in ((f.home_team_id, f.home_score), (f.away_team_id, f.away_score)):
            if s:
                club_scores.append({"team": name.get(tid, ""), "value": round(s), "year": f.year, "round": f.afl_round})
    high = sorted(club_scores, key=lambda r: -r["value"])
    low = sorted(club_scores, key=lambda r: r["value"])

    season_pf = [{"team": name.get(s.team_id, ""), "value": round(s.points_for or 0), "year": s.year,
                  "wins": s.wins, "losses": s.losses}
                 for s in SeasonStanding.query.filter_by(league_id=league_id).all() if s.points_for]
    season_pf.sort(key=lambda r: -r["value"])

    # runs of wins and losses, across seasons, round 0 included
    results = defaultdict(list)   # tid -> [(year, round, 'W'|'L'|'D')]
    for f in fixtures:
        if f.home_score is None or f.away_score is None:
            continue
        h = "W" if f.home_score > f.away_score else "L" if f.home_score < f.away_score else "D"
        a = {"W": "L", "L": "W", "D": "D"}[h]
        results[f.home_team_id].append((f.year, f.afl_round, h))
        results[f.away_team_id].append((f.year, f.afl_round, a))

    def runs(want):
        out = []
        for tid, rs in results.items():
            best, cur, start = (0, None, None), 0, None
            for y, r, res in rs:
                if res == want:
                    if cur == 0:
                        start = (y, r)
                    cur += 1
                    if cur > best[0]:
                        best = (cur, start, (y, r))
                else:
                    cur = 0
            if best[0]:
                n, (y0, r0), (y1, r1) = best
                out.append({"team": name.get(tid, ""), "value": n, "year": y1, "from_round": r0, "to_round": r1, "from_year": y0})
        return sorted(out, key=lambda r: -r["value"])

    # premierships: the ladder topper of every finished season (no finals)
    flags = defaultdict(list)
    by_year = defaultdict(list)
    for s in SeasonStanding.query.filter_by(league_id=league_id).all():
        by_year[s.year].append(s)
    for y, rows in by_year.items():
        fx = [f for f in Fixture.query.filter_by(league_id=league_id, year=y).all()]
        if fx and all(f.status == "completed" for f in fx):
            top = max(rows, key=lambda s: (s.ladder_points or 0, s.percentage or 0))
            flags[top.team_id].append(y)
    flag_rows = sorted(({"team": name.get(t, ""), "value": len(ys), "years": sorted(ys)} for t, ys in flags.items()),
                       key=lambda r: -r["value"])

    clubs = [
        _rec("high", "Highest club score", "", "club", high),
        _rec("season_pf", "Most points in a season", "", "club", season_pf),
        _rec("win_run", "Longest winning run", "wins", "club", runs("W")),
        _rec("loss_run", "Longest losing run", "losses", "club", runs("L")),
        _rec("low", "Lowest club score", "", "club", low),
        _rec("flags", "Most premierships", "flags", "club", flag_rows),
    ]

    # ── players ────────────────────────────────────────────────────
    rounds_by_year = defaultdict(set)
    for y, r in done:
        rounds_by_year[y].add(r)
    scores = []                       # (pid, score, tid, year, round)
    for rs in RoundScore.query.filter(RoundScore.team_id.in_(list(teams) or [0])).all():
        if (rs.year, rs.afl_round) not in done:
            continue
        for pid, s in _breakdown(rs.breakdown).items():
            if s and s > 0:
                scores.append((pid, s, rs.team_id, rs.year, rs.afl_round))
    pids = {s[0] for s in scores}
    people = {p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(list(pids) or [0])).all()}

    def who(pid):
        p = people.get(pid)
        return {"player_id": pid, "player": p.name if p else "?", "afl_team": (p.afl_team if p else "") or "",
                "position": (p.position if p else "") or "", "photo_url": photo_url(p.name) if p else None}

    top_scores = [{**who(pid), "team": name.get(tid, ""), "value": round(s), "year": y, "round": r}
                  for pid, s, tid, y, r in sorted(scores, key=lambda x: -x[1])[:TOP]]
    season = defaultdict(list)
    club_of = {}
    for pid, s, tid, y, r in scores:
        season[(pid, y)].append(s)
        club_of[(pid, y)] = name.get(tid, "")
    hundreds = sorted(({**who(pid), "team": club_of[(pid, y)], "value": sum(1 for s in v if s >= 100), "games": len(v), "year": y}
                       for (pid, y), v in season.items()), key=lambda r: (-r["value"], r["games"]))
    avgs = sorted(({**who(pid), "team": club_of[(pid, y)], "value": round(sum(v) / len(v), 1), "games": len(v), "year": y}
                   for (pid, y), v in season.items() if len(v) >= MIN_AVG_GAMES), key=lambda r: -r["value"])
    totals = sorted(({**who(pid), "team": club_of[(pid, y)], "value": round(sum(v)), "games": len(v), "year": y}
                     for (pid, y), v in season.items()), key=lambda r: -r["value"])
    players = [
        _rec("p_high", "Highest score", "", "player", top_scores),
        _rec("p_total", "Most points in a season", "", "player", totals[:TOP]),
        _rec("p_hundreds", "Most 100s in a season", "", "player", hundreds[:TOP]),
        _rec("p_avg", "Best season average", "", "player", avgs[:TOP]),
    ]

    # ── matches ────────────────────────────────────────────────────
    games = []
    for f in fixtures:
        if f.home_score is None or f.away_score is None:
            continue
        w, l = (f.home_team_id, f.away_team_id) if f.home_score >= f.away_score else (f.away_team_id, f.home_team_id)
        ws, ls = max(f.home_score, f.away_score), min(f.home_score, f.away_score)
        games.append({"winner": name.get(w, ""), "loser": name.get(l, ""), "winner_score": round(ws), "loser_score": round(ls),
                      "margin": round(ws - ls), "total": round(ws + ls), "year": f.year, "round": f.afl_round, "draw": ws == ls})
    full = [g for g in games if g["round"] != 0]   # the Opening Round's short sides skew every score
    closest = sorted(full, key=lambda g: (g["margin"], -g["total"]))
    biggest = sorted(full, key=lambda g: -g["margin"])
    combined = sorted(full, key=lambda g: -g["total"])
    matches = [
        _rec("closest", "Closest match", "points", "match", [{**g, "value": g["margin"]} for g in closest]),
        _rec("biggest", "Biggest win", "points", "match", [{**g, "value": g["margin"]} for g in biggest]),
        _rec("combined", "Highest scoring match", "combined", "match", [{**g, "value": g["total"]} for g in combined]),
    ]

    # ── rivalries: every pair, and the games ───────────────────────
    h2h = defaultdict(lambda: {"w": 0, "l": 0, "d": 0, "games": []})
    for f in fixtures:
        if f.home_score is None or f.away_score is None:
            continue
        for a, b, sa, sb in ((f.home_team_id, f.away_team_id, f.home_score, f.away_score),
                             (f.away_team_id, f.home_team_id, f.away_score, f.home_score)):
            c = h2h[f"{a}-{b}"]
            c["w" if sa > sb else "l" if sa < sb else "d"] += 1
            c["games"].append({"year": f.year, "round": f.afl_round, "for": round(sa), "against": round(sb)})

    # ── the all-time ladder ────────────────────────────────────────
    agg = defaultdict(lambda: {"seasons": 0, "w": 0, "l": 0, "d": 0, "pf": 0.0, "pa": 0.0})
    for s in SeasonStanding.query.filter_by(league_id=league_id).all():
        a = agg[s.team_id]
        a["seasons"] += 1
        a["w"] += s.wins or 0
        a["l"] += s.losses or 0
        a["d"] += s.draws or 0
        a["pf"] += s.points_for or 0
        a["pa"] += s.points_against or 0
    ladder = []
    for tid, a in agg.items():
        g = a["w"] + a["l"] + a["d"]
        ladder.append({"team": name.get(tid, ""), "seasons": a["seasons"], "wins": a["w"], "losses": a["l"], "draws": a["d"],
                       "win_pct": round(100 * (a["w"] + a["d"] / 2) / g) if g else 0,
                       "pct": round(100 * a["pf"] / a["pa"], 1) if a["pa"] else 0, "points_for": round(a["pf"]),
                       "flags": sorted(flags.get(tid, []))})
    ladder.sort(key=lambda r: (-r["win_pct"], -r["pct"]))

    return {
        "clubs": clubs, "players": players, "matches": matches,
        "teams": [{"id": tid, "name": t.name} for tid, t in sorted(teams.items(), key=lambda kv: kv[1].name.lower())],
        "h2h": dict(h2h), "ladder": ladder,
        "since": min((f.year for f in fixtures), default=None),
    }

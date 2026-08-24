"""Season Review ("Wrapped") — end-of-season aggregation for one league year.

Builds the full payload behind the year-in-review takeover: ladder, personal
season arc, ever-presents ("most times in the 23"), the league's Best 23,
records, head-to-heads, bench regrets, the 7s comp, the draft report card,
milestones and awards.

Everything is derived from HISTORICAL tables (weekly_lineup / lineup_slot,
round_score.breakdown, fixture, draft_pick) rather than the live
FantasyRoster, so the review stays correct once the off-season starts
stripping players off lists.

One build does ~10 bulk queries and holds the season in memory (a 6-team,
25-round season is ~7k lineup rows). Results are memoised per
(league, year) because the underlying season is finished and immutable.
"""

import statistics
from collections import defaultdict

from models.database import (
    db, League, SeasonConfig, FantasyTeam, Fixture, SeasonStanding, RoundScore,
    WeeklyLineup, LineupSlot, PlayerStat, AflPlayer, AflGame, DraftPick,
    DraftSession, Trade, TradeAsset, DelistPeriod, DelistAction,
    Reserve7sStanding, Reserve7sRoundScore, Reserve7sLineup, Reserve7sFixture,
)

FIELD_POSITIONS = {"DEF", "MID", "FWD", "RUC", "FLEX"}

# Same accent ramp the dashboard/fixture cards use, so a team keeps one
# colour identity everywhere in the app.
TEAM_PALETTE = [
    "#58a6ff", "#ffb471", "#bc8cff", "#3fb950", "#e3b341",
    "#ff7b72", "#7ee787", "#f778ba", "#79c0ff", "#ff9e64",
    "#9ece6a", "#bb9af7",
]

_CACHE = {}


def _accent(team_id):
    return TEAM_PALETTE[(team_id or 0) % len(TEAM_PALETTE)]


def _r1(v):
    return round(float(v or 0), 1)


def season_review_year(league_id):
    """The year whose review is ready to show, or None.

    A season is 'done' once every fixture generated for the league's current
    year is completed. That makes the review appear automatically the moment
    the last round finalises, and disappear again when the league rolls over
    to a new season year with fresh unplayed fixtures.
    """
    league = db.session.get(League, league_id)
    if not league:
        return None
    year = league.season_year
    total = Fixture.query.filter_by(league_id=league_id, year=year).count()
    if not total:
        return None
    done = Fixture.query.filter_by(
        league_id=league_id, year=year, status="completed"
    ).count()
    return year if done == total else None


# ── Loading ──────────────────────────────────────────────────────────


class _Season:
    """Bulk-loaded season slice — every table read exactly once."""

    def __init__(self, league_id, year):
        self.league_id = league_id
        self.year = year
        self.league = db.session.get(League, league_id)
        self.cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()

        self.teams = FantasyTeam.query.filter_by(league_id=league_id).all()
        self.team_ids = [t.id for t in self.teams]
        self.tname = {t.id: t.name for t in self.teams}
        self.towner = {
            t.id: (t.owner.display_name or t.owner.username) if t.owner else "Vacant"
            for t in self.teams
        }
        self.tlogo = {t.id: t.logo_url for t in self.teams}

        self.fixtures = Fixture.query.filter_by(league_id=league_id, year=year).all()
        self.standings = (
            SeasonStanding.query
            .filter_by(league_id=league_id, year=year)
            .order_by(SeasonStanding.ladder_points.desc(),
                      SeasonStanding.percentage.desc(),
                      SeasonStanding.points_for.desc())
            .all()
        )

        self.round_scores = RoundScore.query.filter(
            RoundScore.year == year, RoundScore.team_id.in_(self.team_ids)
        ).all() if self.team_ids else []

        lineups = WeeklyLineup.query.filter(
            WeeklyLineup.year == year, WeeklyLineup.team_id.in_(self.team_ids)
        ).all() if self.team_ids else []
        self.lineup_meta = {l.id: (l.team_id, l.afl_round) for l in lineups}
        self.slots = LineupSlot.query.filter(
            LineupSlot.lineup_id.in_(list(self.lineup_meta))
        ).all() if self.lineup_meta else []

        # (player_id, round) -> supercoach score, for bench-regret maths.
        self.sc = {}
        for pid, rnd, sc in db.session.query(
            PlayerStat.player_id, PlayerStat.round, PlayerStat.supercoach_score
        ).filter(PlayerStat.year == year).all():
            self.sc[(pid, rnd)] = sc or 0

        # AFL games per round — used to spot partial rounds (Opening Round,
        # bye weeks) so they don't pollute "lowest score" records.
        self.games_per_round = dict(
            db.session.query(AflGame.afl_round, db.func.count(AflGame.id))
            .filter(AflGame.year == year).group_by(AflGame.afl_round).all()
        )

        self.rounds = sorted({f.afl_round for f in self.fixtures})
        round_set = set(self.rounds)
        # Rounds each AFL club actually played. A player can only be a real
        # selection in a week his club took the field — Opening Round (most
        # clubs absent) and the mid-season byes are not weeks he was "left out".
        self.club_rounds = defaultdict(set)
        for g in AflGame.query.filter_by(year=year).all():
            if g.afl_round in round_set:
                self.club_rounds[g.home_team].add(g.afl_round)
                self.club_rounds[g.away_team].add(g.afl_round)
        peak = max(self.games_per_round.values()) if self.games_per_round else 0
        self.full_rounds = {
            r for r in self.rounds
            if self.games_per_round.get(r, 0) >= peak * 0.6
        } or set(self.rounds)

        self.players = {}
        self._load_players()

    def _load_players(self):
        ids = set()
        for s in self.slots:
            ids.add(s.player_id)
        for rs in self.round_scores:
            for k in (rs.breakdown or {}):
                ids.add(int(str(k).replace("emergency_", "")))
        for row in Reserve7sLineup.query.filter_by(
            league_id=self.league_id, year=self.year
        ).with_entities(Reserve7sLineup.player_id).all():
            ids.add(row[0])
        ds_ids = [d.id for d in DraftSession.query.filter_by(
            league_id=self.league_id, is_mock=False).all()]
        if ds_ids:
            for row in DraftPick.query.filter(
                DraftPick.draft_session_id.in_(ds_ids),
                DraftPick.player_id.isnot(None),
            ).with_entities(DraftPick.player_id).all():
                ids.add(row[0])
        ids.discard(None)
        if ids:
            for p in AflPlayer.query.filter(AflPlayer.id.in_(list(ids))).all():
                self.players[p.id] = p

    def pmeta(self, pid):
        """Player card data. Club logo + colours ride along so the frontend
        never has to keep its own copy of the AFL club map."""
        from config import TEAM_COLOURS, TEAM_LOGOS

        p = self.players.get(pid)
        if not p:
            return {"id": pid, "name": "Unknown", "afl_team": "", "position": "MID",
                    "age": None, "rating": None, "logo": None,
                    "club_bg": "#1c2333", "club_fg": "#8b949e"}
        club = p.afl_team or ""
        bg, fg = TEAM_COLOURS.get(club, ("#1c2333", "#8b949e"))
        return {
            "id": p.id, "name": p.name, "afl_team": club,
            "position": p.position or "MID", "age": p.age, "rating": p.rating,
            "logo": TEAM_LOGOS.get(club), "club_bg": bg, "club_fg": fg,
        }


# ── Derived season indices ───────────────────────────────────────────


def _index(s):
    """Fold the raw season slice into the per-(team, player) indices every
    downstream section reads."""
    idx = {
        # (team_id, player_id) -> counts
        "sel": defaultdict(int),        # named in the 23
        "bench": defaultdict(int),      # named on the bench
        "emerg": defaultdict(int),      # named as an emergency
        "cap": defaultdict(int),        # named captain
        "pts": defaultdict(float),      # points contributed to the team
        "played": defaultdict(int),     # rounds where they actually scored
        "sub_on": defaultdict(int),     # rounds their emergency slot was activated
        "pos_use": defaultdict(lambda: defaultdict(int)),  # position they filled
        "best": defaultdict(lambda: (0.0, None)),          # best score, round
        "sel_rounds": defaultdict(set),   # rounds they were named in the 23
        "field_pts": defaultdict(dict),   # (team, player) -> round -> on-field score
        "round_pts": defaultdict(dict),   # ... including emergency call-ups
        # per team
        "team_round": defaultdict(dict),   # team -> round -> score
        "team_field": defaultdict(dict),   # team -> round -> set(player ids)
        "team_bench": defaultdict(dict),
    }

    for sl in s.slots:
        meta = s.lineup_meta.get(sl.lineup_id)
        if not meta:
            continue
        tid, rnd = meta
        pc = (sl.position_code or "").upper()
        key = (tid, sl.player_id)
        if sl.is_emergency:
            idx["emerg"][key] += 1
            continue
        if pc in FIELD_POSITIONS:
            idx["sel"][key] += 1
            idx["sel_rounds"][key].add(rnd)
            idx["pos_use"][sl.player_id][pc] += 1
            idx["team_field"][tid].setdefault(rnd, set()).add(sl.player_id)
        else:
            idx["bench"][key] += 1
            idx["team_bench"][tid].setdefault(rnd, set()).add(sl.player_id)
        if sl.is_captain:
            idx["cap"][key] += 1

    for rs in s.round_scores:
        idx["team_round"][rs.team_id][rs.afl_round] = _r1(rs.total_score)
        for k, v in (rs.breakdown or {}).items():
            k = str(k)
            v = float(v or 0)
            if k.startswith("emergency_"):
                pid = int(k.split("_", 1)[1])
                idx["sub_on"][(rs.team_id, pid)] += 1
                key = (rs.team_id, pid)
            else:
                pid = int(k)
                key = (rs.team_id, pid)
                idx["field_pts"][key][rs.afl_round] = v
            idx["round_pts"][key][rs.afl_round] = v
            idx["pts"][key] += v
            if v > 0:
                idx["played"][key] += 1
                if v > idx["best"][pid][0]:
                    idx["best"][pid] = (v, rs.afl_round)
    return idx


def _player_row(s, idx, tid, pid, extra=None, weeks=False):
    """One player's season for one club.

    `weeks=True` also attaches two arrays aligned to `s.rounds` — a 0/1
    selection mask and the score they returned each round. That drives the
    per-player presence strip in the review; it roughly doubles a row, so it
    is opt-in and only the leaderboards that draw a strip ask for it.
    """
    m = s.pmeta(pid)
    key = (tid, pid)
    sel = idx["sel"][key]
    played = idx["played"][key]
    pts = idx["pts"][key]

    # A week only counts as a real selection if the club took the field AND he
    # played. Weeks his club had no game (Opening Round, the bye) were never
    # his to win or lose, so they come out of both sides of the ratio.
    named = idx["sel_rounds"][key]
    field = idx["field_pts"][key]
    club_on = s.club_rounds.get(m["afl_team"]) or set()
    available = len([r for r in s.rounds if r in club_on])
    played_23 = len([r for r in named if r in club_on and field.get(r, 0) > 0])
    missed_23 = len([r for r in s.rounds if r in club_on and r not in named])

    row = {
        **m,
        "team_id": tid,
        "team_name": s.tname.get(tid, ""),
        "selections": sel,
        "played_23": played_23,
        "available": available,
        "missed_23": missed_23,
        "ever_present": bool(available) and played_23 == available,
        "played": played,
        "points": round(pts),
        "avg": _r1(pts / played) if played else 0.0,
        "emerg": idx["emerg"][key],
        "sub_on": idx["sub_on"][key],
        "best": _r1(idx["best"][pid][0]),
        "best_round": idx["best"][pid][1],
    }
    if weeks:
        #  2 named and played · 1 club had no game · 0 named but didn't play
        # -1 not named
        def _state(r):
            if r not in named:
                return -1
            if r not in club_on:
                return 1
            return 2 if field.get(r, 0) > 0 else 0
        row["weeks"] = [_state(r) for r in s.rounds]
        row["week_pts"] = [round(field.get(r, 0)) for r in s.rounds]
    if extra:
        row.update(extra)
    return row


# ── Sections ─────────────────────────────────────────────────────────


def _ladder(s):
    rows = []
    for i, st in enumerate(s.standings):
        rows.append({
            "pos": i + 1,
            "team_id": st.team_id,
            "name": s.tname.get(st.team_id, "?"),
            "owner": s.towner.get(st.team_id, ""),
            "logo_url": s.tlogo.get(st.team_id),
            "accent": _accent(st.team_id),
            "wins": st.wins, "losses": st.losses, "draws": st.draws,
            "points_for": round(st.points_for or 0),
            "points_against": round(st.points_against or 0),
            "percentage": _r1(st.percentage),
            "ladder_points": st.ladder_points,
        })
    return rows


def _cover(s, idx):
    total = sum(v for rounds in idx["team_round"].values() for v in rounds.values())
    used = len({pid for (_t, pid) in idx["sel"] if idx["sel"][(_t, pid)] > 0})
    completed = [f for f in s.fixtures if f.status == "completed"]
    top = max(
        ((v, tid, r) for tid, rr in idx["team_round"].items() for r, v in rr.items()),
        default=(0, None, None),
    )
    return {
        "total_points": round(total),
        "players_used": used,
        "matches": len(completed),
        "rounds": len(s.rounds),
        "teams": len(s.teams),
        "top_round": {
            "score": _r1(top[0]),
            "team": s.tname.get(top[1], ""),
            "round": top[2],
        } if top[1] else None,
    }


def _arc(s, idx):
    """Ladder position + score by round for every team (drives the SVG arc)."""
    pts_cfg = (s.cfg.points_per_win if s.cfg else 4) or 4
    draw_cfg = (s.cfg.points_per_draw if s.cfg else 2) or 2

    running = {tid: {"pts": 0, "for": 0.0, "against": 0.0} for tid in s.team_ids}
    by_round = defaultdict(list)
    for f in s.fixtures:
        if f.status == "completed":
            by_round[f.afl_round].append(f)

    positions = {tid: [] for tid in s.team_ids}
    for rnd in s.rounds:
        for f in by_round.get(rnd, []):
            hs, aws = f.home_score or 0, f.away_score or 0
            for tid, own, opp in ((f.home_team_id, hs, aws), (f.away_team_id, aws, hs)):
                if tid not in running:
                    continue
                running[tid]["for"] += own
                running[tid]["against"] += opp
                if own > opp:
                    running[tid]["pts"] += pts_cfg
                elif own == opp:
                    running[tid]["pts"] += draw_cfg
        order = sorted(
            s.team_ids,
            key=lambda t: (-running[t]["pts"],
                           -(running[t]["for"] / running[t]["against"] * 100
                             if running[t]["against"] else 0)),
        )
        for i, tid in enumerate(order):
            positions[tid].append(i + 1)

    league_avg = []
    for rnd in s.rounds:
        vals = [idx["team_round"][tid].get(rnd) for tid in s.team_ids]
        vals = [v for v in vals if v is not None]
        league_avg.append(round(sum(vals) / len(vals)) if vals else 0)

    return {
        "rounds": s.rounds,
        "league_avg": league_avg,
        "teams": [{
            "team_id": tid,
            "name": s.tname.get(tid, ""),
            "accent": _accent(tid),
            "positions": positions[tid],
            "scores": [round(idx["team_round"][tid].get(r, 0)) for r in s.rounds],
        } for tid in s.team_ids],
    }


def _ever_present(s, idx):
    """Weeks in the 23 — the season's iron men, league-wide and per team.

    A week counts only when the player was named AND actually played. Weeks his
    club had no game (Opening Round, the bye) are excluded from both the count
    and the total available to him, so an every-week player reads as 23 of 23
    rather than a nonsense 25.
    """
    rows = [
        _player_row(s, idx, tid, pid, weeks=True)
        for (tid, pid), n in idx["sel"].items() if n > 0
    ]
    rows.sort(key=lambda r: (-r["played_23"], -r["points"]))

    per_team = {}
    for tid in s.team_ids:
        per_team[str(tid)] = [r for r in rows if r["team_id"] == tid][:6]

    perfect = [r for r in rows if r["ever_present"]]
    # The most common "every available week" figure — the honest denominator
    # to quote, since every club plays the same number of games.
    counts = defaultdict(int)
    for r in rows:
        if r["available"]:
            counts[r["available"]] += 1
    typical = max(counts.items(), key=lambda kv: kv[1])[0] if counts else len(s.rounds)

    return {
        "league": rows[:12],
        "per_team": per_team,
        "perfect": perfect[:10],
        "perfect_count": len(perfect),
        "max_rounds": typical,
    }


MIN_GAMES_FOR_BEST_23 = 16


def _best_23(s, idx):
    """The league's Best 23, built to the league's own field shape.

    Ranked on AVERAGE, not season total, behind a 16-game qualification.
    Ranking on total quietly rewards availability over quality — the list fills
    with solid players who never missed while genuinely elite players who lost a
    month to injury drop off it. The qualification keeps out small samples; the
    average decides who was the better player. Being elite AND never missing
    still gets its own billing via `ever_present` / `iron_best`.

    Each player is slotted into the position he actually filled most often
    (falling back to his listed primary position).
    """
    from models.database import LeaguePositionSlot

    shape = []
    for ps in LeaguePositionSlot.query.filter_by(league_id=s.league_id).all():
        shape.append((ps.position_code.upper(), ps.count or 0))
    if not shape:
        shape = [("DEF", 6), ("MID", 9), ("FWD", 6), ("RUC", 1), ("FLEX", 1)]
    order = {"DEF": 0, "MID": 1, "RUC": 2, "FWD": 3, "FLEX": 4}
    shape.sort(key=lambda x: order.get(x[0], 9))

    # Best single team-stint per player, so a traded player counts once, for
    # the club he did the most for.
    best_stint = {}
    for (tid, pid), pts in idx["pts"].items():
        if idx["sel"][(tid, pid)] <= 0:
            continue
        cur = best_stint.get(pid)
        if not cur or pts > cur[1]:
            best_stint[pid] = (tid, pts)

    def slot_pos(pid):
        use = {k: v for k, v in (idx["pos_use"].get(pid) or {}).items() if k != "FLEX"}
        if use:
            return max(use.items(), key=lambda kv: kv[1])[0]
        return (s.pmeta(pid)["position"] or "MID").split("/")[0].upper()

    pool = defaultdict(list)
    for pid, (tid, pts) in best_stint.items():
        pool[slot_pos(pid)].append(_player_row(s, idx, tid, pid))
    for k in pool:
        pool[k].sort(key=lambda r: (-r["avg"], -r["points"]))

    def _qualified(rows, need, threshold):
        """Rows meeting the games bar, relaxed only if a line cannot fill."""
        ok = [r for r in rows if r["played_23"] >= threshold]
        while len(ok) < need and threshold > 1:
            threshold -= 2
            ok = [r for r in rows if r["played_23"] >= threshold]
        return ok, threshold

    picked, used_ids, lines = [], set(), []
    relaxed_to = MIN_GAMES_FOR_BEST_23
    for code, count in shape:
        if code == "FLEX":
            continue
        avail = [r for r in pool.get(code, []) if r["id"] not in used_ids]
        ok, threshold = _qualified(avail, count, MIN_GAMES_FOR_BEST_23)
        relaxed_to = min(relaxed_to, threshold)
        take = ok[:count]
        for r in take:
            used_ids.add(r["id"])
        lines.append({"code": code, "players": take})
        picked.extend(take)

    flex_count = sum(c for code, c in shape if code == "FLEX")
    if flex_count:
        rest = [r for lst in pool.values() for r in lst if r["id"] not in used_ids]
        ok, threshold = _qualified(rest, flex_count, MIN_GAMES_FOR_BEST_23)
        relaxed_to = min(relaxed_to, threshold)
        take = sorted(ok, key=lambda r: (-r["avg"], -r["points"]))[:flex_count]
        for r in take:
            used_ids.add(r["id"])
        lines.append({"code": "FLEX", "players": take})
        picked.extend(take)

    reps = defaultdict(int)
    for r in picked:
        reps[r["team_id"]] += 1

    # Elite AND available — the best average among players who never missed a
    # week their club played. "Good and always there" earns its own line.
    all_iron = [
        _player_row(s, idx, tid, pid)
        for (tid, pid), n in idx["sel"].items() if n > 0
    ]
    all_iron = [r for r in all_iron if r["ever_present"]]
    all_iron.sort(key=lambda r: -r["avg"])

    return {
        "lines": lines,
        "reps": [{"team_id": tid, "name": s.tname.get(tid, ""),
                  "accent": _accent(tid), "count": n}
                 for tid, n in sorted(reps.items(), key=lambda kv: -kv[1])],
        "mvp": max(picked, key=lambda r: r["avg"]) if picked else None,
        "min_games": relaxed_to,
        "iron_in_side": sum(1 for r in picked if r["ever_present"]),
        "iron_best": all_iron[0] if all_iron else None,
        "iron_men": all_iron[:6],
    }


def _records(s, idx):
    scores = [
        (v, tid, r)
        for tid, rr in idx["team_round"].items() for r, v in rr.items()
        if r in s.full_rounds
    ]
    scores.sort(reverse=True)

    def sc_row(entry):
        v, tid, r = entry
        return {"score": _r1(v), "team_id": tid, "name": s.tname.get(tid, ""),
                "accent": _accent(tid), "round": r}

    done = [f for f in s.fixtures if f.status == "completed"]
    margins = []
    for f in done:
        hs, aws = f.home_score or 0, f.away_score or 0
        margins.append({
            "round": f.afl_round,
            "home": s.tname.get(f.home_team_id, ""), "home_id": f.home_team_id,
            "away": s.tname.get(f.away_team_id, ""), "away_id": f.away_team_id,
            "home_score": _r1(hs), "away_score": _r1(aws),
            "margin": _r1(abs(hs - aws)), "combined": _r1(hs + aws),
            "winner": s.tname.get(f.home_team_id if hs >= aws else f.away_team_id, ""),
            "loser": s.tname.get(f.away_team_id if hs >= aws else f.home_team_id, ""),
        })

    # Individual season bests, credited to whoever had him named that round.
    singles = []
    for pid, (v, rnd) in idx["best"].items():
        if v <= 0:
            continue
        owner = None
        for tid in s.team_ids:
            if pid in idx["team_field"].get(tid, {}).get(rnd, set()):
                owner = tid
                break
        singles.append({**s.pmeta(pid), "score": _r1(v), "round": rnd,
                        "team_id": owner, "team_name": s.tname.get(owner, "-")})
    singles.sort(key=lambda r: -r["score"])

    tons = defaultdict(int)
    monsters = defaultdict(int)
    for rs in s.round_scores:
        for k, v in (rs.breakdown or {}).items():
            v = float(v or 0)
            pid = int(str(k).replace("emergency_", ""))
            if v >= 100:
                tons[pid] += 1
            if v >= 150:
                monsters[pid] += 1
    ton_rows = sorted(
        ({**s.pmeta(pid), "tons": n, "monsters": monsters.get(pid, 0)}
         for pid, n in tons.items()),
        key=lambda r: (-r["tons"], -r["monsters"]),
    )[:12]

    return {
        "highest": [sc_row(x) for x in scores[:5]],
        "lowest": [sc_row(x) for x in scores[-5:][::-1]],
        "blowouts": sorted(margins, key=lambda m: -m["margin"])[:4],
        "nailbiters": sorted(margins, key=lambda m: m["margin"])[:4],
        "shootouts": sorted(margins, key=lambda m: -m["combined"])[:3],
        "single_scores": singles[:10],
        "tons": ton_rows,
    }


def _head_to_head(s):
    rec = defaultdict(lambda: {"w": 0, "l": 0, "d": 0, "for": 0.0, "against": 0.0})
    for f in s.fixtures:
        if f.status != "completed":
            continue
        hs, aws = f.home_score or 0, f.away_score or 0
        for a, b, sa, sb in ((f.home_team_id, f.away_team_id, hs, aws),
                             (f.away_team_id, f.home_team_id, aws, hs)):
            r = rec[(a, b)]
            r["for"] += sa
            r["against"] += sb
            if sa > sb:
                r["w"] += 1
            elif sa < sb:
                r["l"] += 1
            else:
                r["d"] += 1

    matrix = []
    for a in s.team_ids:
        row = {"team_id": a, "name": s.tname.get(a, ""),
               "accent": _accent(a), "cells": []}
        for b in s.team_ids:
            if a == b:
                row["cells"].append(None)
                continue
            r = rec.get((a, b))
            row["cells"].append({
                "opp_id": b, "opp": s.tname.get(b, ""),
                "w": r["w"], "l": r["l"], "d": r["d"],
                "for": round(r["for"]), "against": round(r["against"]),
            } if r else None)
        matrix.append(row)

    pairs = []
    seen = set()
    for (a, b), r in rec.items():
        if (b, a) in seen:
            continue
        seen.add((a, b))
        games = r["w"] + r["l"] + r["d"]
        if not games:
            continue
        pairs.append({
            "a_id": a, "a": s.tname.get(a, ""), "b_id": b, "b": s.tname.get(b, ""),
            "a_wins": r["w"], "b_wins": r["l"], "draws": r["d"], "games": games,
            "dominance": abs(r["w"] - r["l"]) / games,
            "avg_margin": _r1(abs(r["for"] - r["against"]) / games),
        })
    lopsided = sorted(pairs, key=lambda p: (-p["dominance"], -p["avg_margin"]))
    closest = sorted(pairs, key=lambda p: (p["dominance"], p["avg_margin"]))

    return {
        "matrix": matrix,
        "lopsided": lopsided[0] if lopsided else None,
        "closest": closest[0] if closest else None,
    }


def _bench_rounds(s):
    """Rounds where leaving points on the bench was a real selection failure.

    Two rounds are never a fair test and come out:
      - Opening Round, where most clubs don't play at all, so nobody can field
        a full 23 and every bench score reads as "waste".
      - The final home-and-away round when the league plays no finals. With the
        ladder already settled, managers load their 7s side instead — that's a
        deliberate trade, not a mistake.
    """
    rounds = [r for r in s.rounds if r in s.full_rounds]
    dropped = [r for r in s.rounds if r not in s.full_rounds]
    finals_teams = (s.cfg.finals_teams if s.cfg else 0) or 0
    if not finals_teams and len(rounds) > 1:
        dead = rounds[-1]
        rounds = rounds[:-1]
        dropped.append(dead)
    return rounds, sorted(dropped)


def _bench(s, idx):
    """Points left on the bench.

    For each round a benched player only counts as a miss if he outscored the
    WORST scorer actually named in the 23 that round — i.e. the manager had a
    strictly better option sitting there. The gap is the cost of that call.
    """
    counted, dropped = _bench_rounds(s)
    left = defaultdict(float)
    misses = []
    for tid in s.team_ids:
        for rnd in counted:
            field = idx["team_field"].get(tid, {}).get(rnd)
            bench = idx["team_bench"].get(tid, {}).get(rnd)
            if not field or not bench:
                continue
            worst = min((s.sc.get((p, rnd), 0) for p in field), default=0)
            for p in bench:
                got = s.sc.get((p, rnd), 0)
                if got > worst:
                    gap = got - worst
                    left[tid] += gap
                    misses.append({
                        **s.pmeta(p), "round": rnd, "score": _r1(got),
                        "gap": _r1(gap), "team_id": tid,
                        "team_name": s.tname.get(tid, ""),
                        "accent": _accent(tid),
                    })
    # Efficiency compares like with like — points banked and points wasted are
    # both measured over the same counted rounds.
    table = []
    for tid in s.team_ids:
        wasted = left.get(tid, 0.0)
        scored = sum(idx["team_round"].get(tid, {}).get(r, 0) for r in counted)
        table.append({
            "team_id": tid, "name": s.tname.get(tid, ""), "accent": _accent(tid),
            "points": round(wasted),
            "per_round": _r1(wasted / max(len(counted), 1)),
            "scored": round(scored),
            "efficiency": _r1(scored / (scored + wasted) * 100) if (scored + wasted) else 0.0,
        })
    table.sort(key=lambda r: -r["points"])
    misses.sort(key=lambda m: -m["gap"])
    return {
        "table": table,
        "worst": misses[:6],
        "total": round(sum(left.values())),
        "rounds_counted": len(counted),
        "rounds_excluded": dropped,
        "note": _excluded_note(s, dropped),
    }


def _excluded_note(s, dropped):
    if not dropped:
        return ""
    bits = []
    if s.rounds and s.rounds[0] in dropped:
        bits.append(f"Opening Round (R{s.rounds[0]})")
    tail = [r for r in dropped if not (s.rounds and r == s.rounds[0])]
    if tail:
        bits.append(f"the dead final round (R{tail[-1]})")
    return " and ".join(bits) + " excluded"


def _sevens(s):
    standings = (
        Reserve7sStanding.query
        .filter_by(league_id=s.league_id, year=s.year)
        .order_by(Reserve7sStanding.ladder_points.desc(),
                  Reserve7sStanding.percentage.desc())
        .all()
    )
    ladder = [{
        "pos": i + 1, "team_id": st.team_id, "name": s.tname.get(st.team_id, ""),
        "accent": _accent(st.team_id), "logo_url": s.tlogo.get(st.team_id),
        "wins": st.wins, "losses": st.losses, "draws": st.draws,
        "points_for": round(st.points_for or 0),
        "percentage": _r1(st.percentage), "ladder_points": st.ladder_points,
    } for i, st in enumerate(standings)]

    pts = defaultdict(float)
    games = defaultdict(int)
    best = defaultdict(lambda: (0.0, None))
    for rs in Reserve7sRoundScore.query.filter(
        Reserve7sRoundScore.year == s.year,
        Reserve7sRoundScore.team_id.in_(s.team_ids or [0]),
    ).all():
        for k, v in (rs.breakdown or {}).items():
            pid = int(str(k).replace("emergency_", ""))
            v = float(v or 0)
            pts[(rs.team_id, pid)] += v
            if v > 0:
                games[(rs.team_id, pid)] += 1
                if v > best[(rs.team_id, pid)][0]:
                    best[(rs.team_id, pid)] = (v, rs.afl_round)

    picks = defaultdict(int)
    for row in Reserve7sLineup.query.filter_by(
        league_id=s.league_id, year=s.year
    ).all():
        picks[(row.team_id, row.player_id)] += 1

    def row(tid, pid):
        g = games[(tid, pid)]
        return {
            **s.pmeta(pid), "team_id": tid, "team_name": s.tname.get(tid, ""),
            "accent": _accent(tid),
            "points": round(pts[(tid, pid)]), "played": g,
            "avg": _r1(pts[(tid, pid)] / g) if g else 0.0,
            "selections": picks[(tid, pid)],
            "best": _r1(best[(tid, pid)][0]), "best_round": best[(tid, pid)][1],
        }

    scorers = sorted((row(t, p) for (t, p) in pts if pts[(t, p)] > 0),
                     key=lambda r: -r["points"])[:10]
    iron = sorted((row(t, p) for (t, p) in picks),
                  key=lambda r: (-r["selections"], -r["points"]))[:10]
    ballers = sorted((r for r in (row(t, p) for (t, p) in pts) if r["played"] >= 8),
                     key=lambda r: -r["avg"])[:8]

    return {
        "ladder": ladder,
        "premier": ladder[0] if ladder else None,
        "top_scorers": scorers,
        "iron": iron,
        "best_average": ballers,
    }


MISS_MIN_AGE = 22


def _ltil_player_ids(league_id, year):
    """Players a club formally parked on the long-term injury list.

    In a keeper league a season lost to injury is not a bad pick — the asset is
    still there next year — so these never appear as a poor investment.
    """
    from models.database import LongTermInjury
    return {
        row[0] for row in
        LongTermInjury.query
        .filter_by(league_id=league_id, year=year, status="approved")
        .with_entities(LongTermInjury.player_id).all()
    }


def _expected_avg(row, s):
    """What this player was reasonably expected to return.

    Prior-season output is the honest yardstick. Where it's missing (first
    year, or no prior data), fall back to the pre-season rating, which is the
    market's own view of him.
    """
    p = s.players.get(row["id"])
    prev = getattr(p, "sc_avg_prev", None) if p else None
    if prev and prev > 0:
        return float(prev)
    rating = (getattr(p, "rating_start", None) or row.get("rating") or 0) if p else 0
    if rating:
        # Rough map of the rating scale onto SC output: 70 -> ~65, 90 -> ~115.
        return max(40.0, (rating - 70) * 2.5 + 65)
    return 0.0


def _age_band(age):
    """(multiplier, tag) — the same shortfall means different things by age."""
    if age is None:
        return 1.0, "underperformed"
    if age >= 28:
        return 1.35, "past it"          # expensive, declining, little keeper value left
    if age >= 25:
        return 1.15, "went backwards"
    return 1.0, "went backwards"        # 22-24: prime years, a real miss


def _score_misses(rows, s, num_teams):
    """Rank picks by investment-vs-return rather than raw points.

    Raw points punishes exactly the wrong people: a 20-year-old on six games is
    a normal keeper runway, while a 28-year-old taken early who averaged 20
    below his last season is the actual failure. So the score is how far a
    player fell short of what he was expected to give, weighted up for age and
    for how early he was taken.
    """
    ltil = _ltil_player_ids(s.league_id, s.year)
    early_cut = max(12, num_teams * 6)

    scored = []
    for r in rows:
        r["on_ltil"] = r["id"] in ltil
        expected = _expected_avg(r, s)
        r["expected"] = round(expected)
        r["regression"] = _r1(expected - (r["avg"] or 0)) if expected else 0.0

        age = r.get("age")
        # Kids get a free year — that IS the keeper plan, not a misfire.
        if r["on_ltil"] or age is None or age < MISS_MIN_AGE:
            r["miss"] = None
            r["miss_tag"] = None
            continue
        # Only picks that actually cost something count as an investment.
        p = s.players.get(r["id"])
        rating_start = (getattr(p, "rating_start", None) or 0) if p else 0
        if r["pick"] > early_cut and rating_start < 80:
            r["miss"] = None
            r["miss_tag"] = None
            continue

        mult, tag = _age_band(age)
        inv = max(0.0, 1 - (r["pick"] - 1) / float(early_cut))
        shortfall = max(0.0, expected - (r["avg"] or 0))
        # Weeks he was fit enough to be picked but wasn't in anyone's 23.
        absent = max(0, (r.get("available") or 0) - (r.get("played_23") or 0))
        miss = shortfall * mult * (0.55 + 0.45 * inv) + absent * 1.4

        if absent >= 8 and shortfall < 8:
            tag = "barely sighted"
        r["miss"] = _r1(miss)
        r["miss_tag"] = tag
        scored.append(r)

    scored.sort(key=lambda r: -r["miss"])
    return scored


def _draft(s, idx):
    sessions = DraftSession.query.filter_by(
        league_id=s.league_id, is_mock=False
    ).order_by(DraftSession.id).all()
    initial = next((d for d in sessions if d.draft_round_type != "supplemental"), None)
    if not initial:
        return {"picks": [], "steals": [], "busts": [], "best_by_team": []}

    picks = DraftPick.query.filter(
        DraftPick.draft_session_id == initial.id,
        DraftPick.player_id.isnot(None),
        DraftPick.is_pass == False,  # noqa: E712 — SQL boolean, not identity
    ).order_by(DraftPick.pick_number).all()

    total_by_player = defaultdict(float)
    played_by_player = defaultdict(int)
    for (tid, pid), v in idx["pts"].items():
        total_by_player[pid] += v
        played_by_player[pid] += idx["played"][(tid, pid)]

    rows = []
    for p in picks:
        pts = total_by_player.get(p.player_id, 0.0)
        played = played_by_player.get(p.player_id, 0)
        base = _player_row(s, idx, p.team_id, p.player_id)
        rows.append({
            **s.pmeta(p.player_id),
            "pick": p.pick_number, "draft_round": p.draft_round,
            "team_id": p.team_id, "team_name": s.tname.get(p.team_id, ""),
            "accent": _accent(p.team_id),
            "points": round(pts), "played": played,
            "played_23": base["played_23"], "available": base["available"],
            "avg": _r1(pts / played) if played else 0.0,
            "auto": bool(p.is_auto_pick),
        })

    ranked = sorted(rows, key=lambda r: -r["points"])
    value_rank = {r["id"]: i + 1 for i, r in enumerate(ranked)}
    for r in rows:
        r["value_rank"] = value_rank.get(r["id"], len(rows))
        r["surplus"] = r["pick"] - r["value_rank"]

    steals = sorted([r for r in rows if r["points"] > 0],
                    key=lambda r: -r["surplus"])[:6]

    # Worst value, not lowest points — see _score_misses.
    misses = _score_misses(rows, s, len(s.team_ids))
    busts = misses[:6]

    best_by_team = []
    for tid in s.team_ids:
        mine = [r for r in rows if r["team_id"] == tid]
        if not mine:
            continue
        my_misses = [r for r in misses if r["team_id"] == tid]
        best_by_team.append({
            "team_id": tid, "name": s.tname.get(tid, ""), "accent": _accent(tid),
            "best": max(mine, key=lambda r: r["surplus"]),
            "worst": my_misses[0] if my_misses else None,
            "top": max(mine, key=lambda r: r["points"]),
        })

    return {
        "total_picks": len(rows),
        "first_round": [r for r in rows if r["pick"] <= len(s.team_ids)],
        "steals": steals,
        "busts": busts,
        "miss_excluded_ltil": sorted(
            {r["name"] for r in rows if r.get("on_ltil")}
        ),
        "best_by_team": best_by_team,
    }


def _movement(s, idx):
    trades = []
    for t in Trade.query.filter_by(league_id=s.league_id, status="accepted").all():
        assets = TradeAsset.query.filter_by(trade_id=t.id).all()
        sides = defaultdict(list)
        for a in assets:
            if not a.player_id:
                continue
            gained = sum(v for (tid, pid), v in idx["pts"].items()
                         if pid == a.player_id and tid == a.to_team_id)
            sides[a.to_team_id].append({
                **s.pmeta(a.player_id), "points_after": round(gained),
            })
        trades.append({
            "id": t.id,
            "date": t.responded_at.isoformat() if t.responded_at else None,
            "period": t.intended_period,
            "sides": [{"team_id": tid, "name": s.tname.get(tid, ""),
                       "accent": _accent(tid), "players": pl}
                      for tid, pl in sides.items()],
        })

    delists = []
    period_ids = [p.id for p in DelistPeriod.query.filter_by(
        league_id=s.league_id, year=s.year).all()]
    if period_ids:
        for a in DelistAction.query.filter(
            DelistAction.delist_period_id.in_(period_ids)
        ).all():
            delists.append({
                **s.pmeta(a.player_id),
                "team_id": a.team_id, "team_name": s.tname.get(a.team_id, ""),
                "accent": _accent(a.team_id),
            })

    return {"trades": trades, "delists": delists}


def _awards(s, idx, bench, sevens, draft):
    """Season awards. Every one is a real, computed extreme — no filler."""
    out = []

    def add(key, title, sub, tid, value, detail, icon):
        out.append({
            "key": key, "title": title, "sub": sub,
            "team_id": tid, "team_name": s.tname.get(tid, ""),
            "accent": _accent(tid), "logo_url": s.tlogo.get(tid),
            "value": value, "detail": detail, "icon": icon,
        })

    full = [r for r in s.rounds if r in s.full_rounds]
    series = {tid: [idx["team_round"][tid].get(r) for r in full] for tid in s.team_ids}
    series = {t: [v for v in vals if v is not None] for t, vals in series.items()}
    series = {t: vals for t, vals in series.items() if len(vals) >= 3}

    if series:
        sds = {t: statistics.pstdev(v) for t, v in series.items()}
        steady = min(sds, key=lambda t: sds[t])
        wild = max(sds, key=lambda t: sds[t])
        add("metronome", "The Metronome", "Lowest week-to-week swing",
            steady, f"±{sds[steady]:.0f}",
            f"{statistics.mean(series[steady]):.0f} avg across {len(series[steady])} rounds",
            "bi-activity")
        add("rollercoaster", "The Rollercoaster", "Biggest week-to-week swing",
            wild, f"±{sds[wild]:.0f}",
            f"{min(series[wild]):.0f} low to {max(series[wild]):.0f} high",
            "bi-graph-up-arrow")

        ceilings = {t: max(v) for t, v in series.items()}
        floors = {t: min(v) for t, v in series.items()}
        top = max(ceilings, key=lambda t: ceilings[t])
        add("ceiling", "Highest Ceiling", "Biggest single round of the year",
            top, f"{ceilings[top]:.0f}", f"Round {full[series[top].index(ceilings[top])]}",
            "bi-rocket-takeoff")
        solid = max(floors, key=lambda t: floors[t])
        add("floor", "Highest Floor", "Never had a bad week",
            solid, f"{floors[solid]:.0f}", "Worst round all season", "bi-shield-check")

    churn = {}
    for tid in s.team_ids:
        prev, changes = None, []
        for rnd in s.rounds:
            cur = idx["team_field"].get(tid, {}).get(rnd)
            if cur is None:
                continue
            if prev is not None:
                changes.append(len(cur - prev))
            prev = cur
        if changes:
            churn[tid] = sum(changes) / len(changes)
    if churn:
        tinker = max(churn, key=lambda t: churn[t])
        setfg = min(churn, key=lambda t: churn[t])
        add("tinkerer", "The Tinkerer", "Most changes to the 23 each week",
            tinker, f"{churn[tinker]:.1f}", "players swapped in per round", "bi-tools")
        add("setforget", "Set And Forget", "Fewest changes to the 23 each week",
            setfg, f"{churn[setfg]:.1f}", "players swapped in per round", "bi-lock")

    if bench["table"]:
        worst = bench["table"][0]
        best = bench["table"][-1]
        add("benchwarmer", "Left On The Pine", "Most points wasted on the bench",
            worst["team_id"], f"{worst['points']:,}",
            f"{worst['per_round']:.0f} per round", "bi-emoji-frown")
        add("selector", "Best Selector", "Least points wasted on the bench",
            best["team_id"], f"{best['points']:,}",
            f"{best['per_round']:.0f} per round", "bi-clipboard-check")

    subs = defaultdict(int)
    for (tid, _pid), n in idx["sub_on"].items():
        subs[tid] += n
    if subs:
        sub_king = max(subs, key=lambda t: subs[t])
        add("emergency", "Emergency Services", "Most emergency call-ups activated",
            sub_king, str(subs[sub_king]), "covered outs across the season",
            "bi-bandaid")

    if sevens.get("premier"):
        p = sevens["premier"]
        add("sevens", "7s Premier", "Won the reserves competition",
            p["team_id"], f"{p['wins']}-{p['losses']}-{p['draws']}",
            f"{p['percentage']:.1f}% percentage", "bi-7-circle")

    if draft.get("steals"):
        st = draft["steals"][0]
        add("draftsteal", "Draft Heist", "Biggest value beat at the draft",
            st["team_id"], f"#{st['pick']}",
            f"{st['name']} — {st['points']:,} pts", "bi-gem")

    if s.standings:
        champ = s.standings[0]
        add("premier", "Minor Premier", "Finished on top of the ladder",
            champ.team_id, f"{champ.wins}-{champ.losses}-{champ.draws}",
            f"{champ.percentage:.1f}% percentage", "bi-trophy-fill")
        spoon = s.standings[-1]
        add("spoon", "Wooden Spoon", "Finished last",
            spoon.team_id, f"{spoon.wins}-{spoon.losses}-{spoon.draws}",
            f"{spoon.percentage:.1f}% percentage", "bi-emoji-dizzy")

    return out


def _coaches(s, idx, bench, sevens, draft):
    """One row per manager — the season judged on how they actually coached,
    not just where the ladder left them."""
    bench_by = {r["team_id"]: r for r in bench["table"]}
    sevens_by = {r["team_id"]: r for r in sevens["ladder"]}
    draft_by = {r["team_id"]: r for r in draft.get("best_by_team", [])}
    pos_by = {st.team_id: i + 1 for i, st in enumerate(s.standings)}
    st_by = {st.team_id: st for st in s.standings}

    full = [r for r in s.rounds if r in s.full_rounds]
    rows = []
    for tid in s.team_ids:
        vals = [idx["team_round"][tid].get(r) for r in full]
        vals = [v for v in vals if v is not None]

        prev, changes = None, []
        for rnd in s.rounds:
            cur = idx["team_field"].get(tid, {}).get(rnd)
            if cur is None:
                continue
            if prev is not None:
                changes.append(len(cur - prev))
            prev = cur

        squad = [_player_row(s, idx, tid, pid)
                 for (t, pid) in idx["sel"] if t == tid and idx["sel"][(t, pid)] > 0]
        squad.sort(key=lambda r: -r["points"])
        st = st_by.get(tid)

        rows.append({
            "team_id": tid,
            "name": s.tname.get(tid, ""),
            "owner": s.towner.get(tid, ""),
            "logo_url": s.tlogo.get(tid),
            "accent": _accent(tid),
            "position": pos_by.get(tid),
            "wins": st.wins if st else 0,
            "losses": st.losses if st else 0,
            "draws": st.draws if st else 0,
            "percentage": _r1(st.percentage) if st else 0,
            "points_for": round(st.points_for or 0) if st else 0,
            "avg_score": round(sum(vals) / len(vals)) if vals else 0,
            "swing": _r1(statistics.pstdev(vals)) if len(vals) >= 3 else 0.0,
            "high": round(max(vals)) if vals else 0,
            "low": round(min(vals)) if vals else 0,
            "churn": _r1(sum(changes) / len(changes)) if changes else 0.0,
            "bench_waste": bench_by.get(tid, {}).get("points", 0),
            "efficiency": bench_by.get(tid, {}).get("efficiency", 0.0),
            "subs_used": sum(n for (t, _p), n in idx["sub_on"].items() if t == tid),
            "sevens_pos": sevens_by.get(tid, {}).get("pos"),
            "sevens_record": (
                f"{sevens_by[tid]['wins']}-{sevens_by[tid]['losses']}-{sevens_by[tid]['draws']}"
                if tid in sevens_by else None
            ),
            "best_player": squad[0] if squad else None,
            "draft_gem": (draft_by.get(tid) or {}).get("best"),
            "players_used": len(squad),
        })

    rows.sort(key=lambda r: (r["position"] or 99))
    return rows

def _your_season(s, idx, team_id, arc, h2h, bench):
    if not team_id or team_id not in s.team_ids:
        return None
    st = next((x for x in s.standings if x.team_id == team_id), None)
    pos = next((i + 1 for i, x in enumerate(s.standings) if x.team_id == team_id), None)

    scores = {r: v for r, v in idx["team_round"].get(team_id, {}).items()}
    full = {r: v for r, v in scores.items() if r in s.full_rounds}
    best = max(full.items(), key=lambda kv: kv[1]) if full else None
    worst = min(full.items(), key=lambda kv: kv[1]) if full else None

    squad = [
        _player_row(s, idx, team_id, pid, weeks=True)
        for (tid, pid) in idx["sel"] if tid == team_id and idx["sel"][(tid, pid)] > 0
    ]
    squad.sort(key=lambda r: -r["points"])

    arc_row = next((t for t in arc["teams"] if t["team_id"] == team_id), None)
    h2h_row = next((r for r in h2h["matrix"] if r["team_id"] == team_id), None)
    bench_row = next((r for r in bench["table"] if r["team_id"] == team_id), None)

    league_pf = [x.points_for or 0 for x in s.standings]
    rank_pf = sorted(league_pf, reverse=True).index(st.points_for or 0) + 1 if st else None

    streak_best, streak_cur = 0, 0
    for f in sorted([f for f in s.fixtures if f.status == "completed"
                     and team_id in (f.home_team_id, f.away_team_id)],
                    key=lambda f: f.afl_round):
        mine = f.home_score if f.home_team_id == team_id else f.away_score
        theirs = f.away_score if f.home_team_id == team_id else f.home_score
        if (mine or 0) > (theirs or 0):
            streak_cur += 1
            streak_best = max(streak_best, streak_cur)
        else:
            streak_cur = 0

    return {
        "team_id": team_id,
        "name": s.tname.get(team_id, ""),
        "owner": s.towner.get(team_id, ""),
        "logo_url": s.tlogo.get(team_id),
        "accent": _accent(team_id),
        "position": pos,
        "wins": st.wins if st else 0,
        "losses": st.losses if st else 0,
        "draws": st.draws if st else 0,
        "points_for": round(st.points_for or 0) if st else 0,
        "points_against": round(st.points_against or 0) if st else 0,
        "percentage": _r1(st.percentage) if st else 0,
        "ladder_points": st.ladder_points if st else 0,
        "pf_rank": rank_pf,
        "avg_score": round(sum(full.values()) / len(full)) if full else 0,
        "best_round": {"round": best[0], "score": _r1(best[1])} if best else None,
        "worst_round": {"round": worst[0], "score": _r1(worst[1])} if worst else None,
        "best_streak": streak_best,
        "top_players": squad[:8],
        "ever_present": sorted(squad, key=lambda r: (-r["selections"], -r["points"]))[:6],
        "arc": arc_row,
        "h2h": h2h_row,
        "bench": bench_row,
        "squad_size": len(squad),
    }


# ── Assembler ────────────────────────────────────────────────────────


def build_season_review(league_id, year, viewer_team_id=None):
    """Full year-in-review payload. Memoised per (league, year) — the season is
    finished, so nothing behind it can change until the league rolls over."""
    cache_key = (league_id, year)
    shared = _CACHE.get(cache_key)
    if shared is None:
        s = _Season(league_id, year)
        if not s.league or not s.teams:
            return None
        idx = _index(s)
        arc = _arc(s, idx)
        h2h = _head_to_head(s)
        bench = _bench(s, idx)
        sevens = _sevens(s)
        draft = _draft(s, idx)
        shared = {
            "year": year,
            "league": {
                "id": s.league.id, "name": s.league.name,
                "teams": len(s.teams), "rounds": len(s.rounds),
                "scoring": s.league.scoring_type,
            },
            "rounds": s.rounds,
            "cover": _cover(s, idx),
            "ladder": _ladder(s),
            "arc": arc,
            "ever_present": _ever_present(s, idx),
            "best_23": _best_23(s, idx),
            "records": _records(s, idx),
            "h2h": h2h,
            "bench": bench,
            "sevens": sevens,
            "draft": draft,
            "movement": _movement(s, idx),
            "coaches": _coaches(s, idx, bench, sevens, draft),
            "awards": _awards(s, idx, bench, sevens, draft),
        }
        shared["_per_team"] = {
            tid: _your_season(s, idx, tid, arc, h2h, bench) for tid in s.team_ids
        }
        _CACHE.clear()
        _CACHE[cache_key] = shared

    payload = {k: v for k, v in shared.items() if k != "_per_team"}
    payload["you"] = shared["_per_team"].get(viewer_team_id)
    payload["available"] = True
    return payload


def invalidate(league_id=None, year=None):
    """Drop memoised reviews — call after a rescore or standings rebuild."""
    if league_id is None:
        _CACHE.clear()
    else:
        _CACHE.pop((league_id, year), None)

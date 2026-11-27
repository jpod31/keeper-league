"""The season stats table on the player card (2026-11-27): stats down the
side, a column per season, grouped. Lucas, on the six averages it replaces:
"the stats at the bottom need more depth because its just fucking wank", and
on the first try at it: "this part couldnt be more ugly".

  {"cols": [{"year", "comp", "team", "games"}],
   "groups": [{"name", "rows": [{"label", "fmt", "vals": [...]}]}]}

fmt: "1" one decimal, "int" whole number, "pct" a percentage. A value is
None where the season does not hold that stat (or holds it for under half
his games: live feeds only carry the basic stats).
"""

from collections import defaultdict

from models.database import PlayerStat, AflListHistory

AFL_GROUPS = (
    ("Scoring", (("supercoach_score", "SuperCoach", "1"), ("afl_fantasy_score", "AFL Fantasy", "1"))),
    ("Ball winning", (("disposals", "Disposals", "1"), ("kicks", "Kicks", "1"), ("handballs", "Handballs", "1"),
                      ("contested_possessions", "Contested", "1"), ("uncontested_possessions", "Uncontested", "1"))),
    ("Stoppages", (("clearances", "Clearances", "1"), ("centre_clearances", "Centre clearances", "1"),
                   ("hitouts", "Hitouts", "1"))),
    ("Use", (("inside_fifties", "Inside 50s", "1"), ("metres_gained", "Metres gained", "int"),
             ("disposal_efficiency", "Efficiency", "pct"), ("score_involvements", "Score involvements", "1"),
             ("goals", "Goals", "1"))),
    ("Defence", (("tackles", "Tackles", "1"), ("marks", "Marks", "1"), ("intercepts", "Intercepts", "1"),
                 ("rebounds", "Rebound 50s", "1"))),
    ("Time on ground", (("time_on_ground_pct", "Time on ground", "pct"),)),
)


def _cover(vals):
    have = [v for v in vals if v is not None]
    if not have or len(have) * 2 < len(vals):
        return None
    return round(sum(have) / len(have), 1)


def _finish(cols, groups):
    out = []
    for name, rows in groups:
        rows = [r for r in rows if any(v is not None for v in r["vals"])]
        # hitouts only for someone who takes them
        rows = [r for r in rows if r["label"] != "Hitouts" or max(v or 0 for v in r["vals"]) >= 1]
        if rows:
            out.append({"name": name, "rows": rows})
    return {"cols": cols, "groups": out} if cols and out else None


def afl_table(player, upto_year, n=3):
    """His last n AFL seasons with games, up to upto_year."""
    games = defaultdict(list)
    for g in PlayerStat.query.filter(PlayerStat.player_id == player.id, PlayerStat.year <= upto_year).all():
        games[g.year].append(g)
    years = sorted((y for y, gs in games.items() if gs), reverse=True)[:n]
    if not years:
        return None
    clubs = {h.season: h.club for h in AflListHistory.query.filter(AflListHistory.player_id == player.id,
                                                                     AflListHistory.season.in_(years)).all()}
    cols = [{"year": y, "comp": "AFL", "team": clubs.get(y) or (player.afl_team if y == years[0] else None),
             "games": len(games[y])} for y in years]
    groups = []
    for name, stats in AFL_GROUPS:
        groups.append((name, [{"label": label, "fmt": fmt,
                               "vals": [_cover([getattr(g, key) for g in games[y]]) for y in years]}
                              for key, label, fmt in stats]))
    return _finish(cols, groups)


SHORT = {"vfl": "VFL", "sanfl": "SANFL", "wafl": "WAFL", "waflres": "WAFL Res", "nab": "Talent",
         "sanflu18": "SANFL U18", "waflcolts": "Colts", "u18champs": "U18s"}
SENIOR = ("vfl", "sanfl", "wafl")


def junior_table(rows, n=5):
    """Every junior and state league season we hold for him, newest first,
    senior footy ahead of juniors within a year."""
    from models.pre_afl import disposals, goals
    rows = sorted((r for r in rows if (r.matches or 0) >= 1),
                  key=lambda r: (-(r.season or 0), r.competition not in SENIOR, -(r.matches or 0)))[:n]
    if not rows:
        return None
    cols = [{"year": r.season, "comp": SHORT.get(r.competition, r.competition.upper()), "team": r.team, "games": r.matches}
            for r in rows]

    def col(fn, fmt="1"):
        return [None if fn(r) is None else round(float(fn(r)), 1) for r in rows], fmt

    def row(label, fn, fmt="1"):
        vals, f = col(fn, fmt)
        return {"label": label, "fmt": f, "vals": vals}
    groups = [
        ("Ball winning", [row("Disposals", disposals), row("Kicks", lambda r: r.kicks), row("Handballs", lambda r: r.handballs),
                          row("Contested", lambda r: r.contested_possessions), row("Clearances", lambda r: r.clearances)]),
        ("Use and scoring", [row("Inside 50s", lambda r: r.inside_fifties), row("Goals", goals),
                             row("Score involvements", lambda r: r.score_involvements),
                             row("Efficiency", lambda r: r.disposal_efficiency, "pct")]),
        ("Defence", [row("Marks", lambda r: r.marks), row("Tackles", lambda r: r.tackles),
                     row("Intercepts", lambda r: r.intercepts), row("Rebound 50s", lambda r: r.rebounds)]),
        ("Ruck", [row("Hitouts", lambda r: r.hitouts)]),
        ("Fantasy", [row("Fantasy", lambda r: r.dreamteam_avg)]),
    ]
    return _finish(cols, groups)

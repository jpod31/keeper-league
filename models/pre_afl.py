"""A short profile for a player who has not played an AFL game yet: who he
is, where he came through, and his state league and under-18 numbers.

Lucas, 2026-11-26: "for new players we should add in a little profile ...
their state league and nab league stats, until they play their first afl
game".

The profile is written from what we hold (afl_player, state_league_stat
and the scouting model's projection on those rows), never copied from a
draft site. State league rows carry no player id for most juniors, so they
are matched by name, and a season he would have been under 15 for is
dropped as somebody else with the same name.
"""

import config
from models.database import db, StateLeagueStat

LEAGUE = {"vfl": "VFL", "sanfl": "SANFL", "wafl": "WAFL", "sanflu18": "SANFL under-18s"}
# Under-18 competitions: shown as "came through", and kept apart from senior state leagues.
JUNIOR_COMPS = ("nab", "sanflu18")
# Junior honours draftguru names, and what they are for.
HONOUR_NOTES = {
    "larke medal": "the best player at the under-18 national championships",
    "hunter harrison medal": "the best player in division two of the under-18 championships",
    "morrish medal": "the Talent League best and fairest",
}
POS_WORD = {"DEF": "defender", "MID": "midfielder", "FWD": "forward", "RUC": "ruck"}


def league_name(comp, season):
    comp = (comp or "").lower()
    if comp == "nab":
        # The under-18 competition: NAB League to 2022, Talent League since.
        return "Talent League" if season >= 2023 else "NAB League"
    return LEAGUE.get(comp, comp.upper())


def _r1(v):
    return round(v, 1) if v is not None else None


def disposals(r):
    """Per game. Most under-18 rows carry kicks and handballs but no
    disposals."""
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


def _rows(p):
    rows = (StateLeagueStat.query
            .filter(db.or_(StateLeagueStat.player_id == p.id, StateLeagueStat.player_name == p.name))
            .order_by(StateLeagueStat.season.desc()).all())
    out, seen = [], set()
    for r in rows:
        if p.age and r.season:
            age_then = p.age - (config.CURRENT_YEAR - r.season)
            if age_then < 15:
                continue
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


def _averages_sentence(r):
    bits = []
    vals = {"disposals": disposals(r), "goals": goals(r)}
    for key, word in (("disposals", "disposals"), ("clearances", "clearances"), ("tackles", "tackles"),
                      ("hitouts", "hitouts"), ("marks", "marks"), ("goals", "goals")):
        v = vals[key] if key in vals else getattr(r, key)
        if v is not None and v > 0 and len(bits) < 3:
            bits.append(f"{v:.1f} {word}")
    if not bits:
        return None
    games = f" across {r.matches} games" if r.matches else ""
    where = f"{league_name(r.competition, r.season)}"
    text = f"In {r.season} he averaged {', '.join(bits[:-1]) + ' and ' + bits[-1] if len(bits) > 1 else bits[0]} in the {where}{games}"
    if r.dreamteam_avg:
        text += f", {round(r.dreamteam_avg)} fantasy points a game"
    return text + "."


def _and_list(items):
    items = [i.strip() for i in items if i and i.strip()]
    if len(items) <= 1:
        return items[0] if items else ""
    return ", ".join(items[:-1]) + " and " + items[-1]


def honour_text(raw):
    """'Larke Medallist' -> 'Larke Medallist: the best player at the under-18
    national championships.' Unknown honours are kept as draftguru names them."""
    if not raw:
        return None
    out = []
    for part in [x.strip() for x in raw.split(",") if x.strip()]:
        key = part.lower().replace("medallist", "medal").strip()
        note = HONOUR_NOTES.get(key)
        out.append(f"{part}: {note}" if note else part)
    return ". ".join(out) + "."


def pre_afl(p):
    rows = _rows(p)
    pos = (p.position or "").split("/")[0]
    words = [p.afl_team or "", POS_WORD.get(pos, "player")]
    first = " ".join(w for w in words if w).strip()
    first = first[0].upper() + first[1:] if first else "Player"
    facts = [str(p.age)] if p.age else []
    if p.height_cm:
        facts.append(f"{p.height_cm} cm")
    lines = [first + (", " + ", ".join(facts) if facts else "") + "."]

    if p.draft_pick and p.draft_year:
        kind = f" {p.draft_type.lower()}" if p.draft_type else ""
        lines.append(f"Pick {p.draft_pick} in the {p.draft_year}{kind} draft.")
    elif p.draft_note:
        bits = [b.strip() for b in p.draft_note.split(",")]
        if len(bits) >= 2:
            lines.append(f"{bits[0]} in the {bits[1]}.")
    honours = honour_text(p.junior_honours)
    if honours:
        lines.append(honours)
    elif p.joined_year and p.joined_year >= config.CURRENT_YEAR:
        lines.append(f"New to an AFL list for {p.joined_year}.")

    juniors = [r for r in rows if (r.competition or "").lower() in JUNIOR_COMPS]
    seniors = [r for r in rows if (r.competition or "").lower() not in JUNIOR_COMPS]
    if juniors:
        j = juniors[0]
        lines.append(f"Came through {j.team} in the {league_name(j.competition, j.season)}.")
    elif p.junior_origin:
        lines.append("Came through " + _and_list(p.junior_origin.split(" / ")) + ".")
    if seniors:
        s = seniors[0]
        lines.append(f"Played {s.season} in the {league_name(s.competition, s.season)}"
                     + (f" with {s.team}." if s.team else "."))
    best = next((r for r in rows if r.matches and (disposals(r) or r.goals or r.dreamteam_avg)), None)
    if best:
        avg = _averages_sentence(best)
        if avg:
            lines.append(avg)

    proj = next((r for r in rows if r.predicted_afl_sc), None)
    projection = None
    if proj:
        projection = {"sc": round(proj.predicted_afl_sc), "season": proj.season,
                      "tag": proj.scouting_tag or None}
        lines.append(f"Our scouting model projects about {round(proj.predicted_afl_sc)} SuperCoach points a game at AFL level.")

    return {"lines": lines, "seasons": [_season_row(r) for r in rows[:6]], "projection": projection,
            "honours": p.junior_honours, "pathway": p.junior_origin}

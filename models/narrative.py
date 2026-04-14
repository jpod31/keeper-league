"""Narrative Engine — extract story-driven insights from dynasty simulation.

Turns raw numbers into specific, named, dated narrative events:
- Crossover points (when teams overtake each other)
- Kid breakthrough timeline (when young players enter the best 23)
- Biggest positional gap with specific fill recommendation
- Key dependencies and risks
"""

import logging
from models.database import db, AflPlayer, FantasyRoster, FantasyTeam

logger = logging.getLogger(__name__)


def build_narrative(team_id, league_id, year, dynasty, analytics, trade_table, profile_tags):
    """Build narrative data points for the analytics story.

    Returns: {
        "verdict": str,  # one-line summary
        "crossovers": [{"year", "event", "team"}],
        "kid_timeline": [{"year", "enters", "replaces", "enters_age", "enters_sc"}],
        "biggest_gap": {"position", "gap", "best_fill_name", "best_fill_sc"} or None,
        "dependency": {"level": "low"|"moderate"|"high", "detail": str},
        "trajectory": "dominant"|"rising"|"peaking"|"declining",
    }
    """
    if not dynasty or team_id not in dynasty:
        return {}

    my_data = dynasty[team_id]
    my_years = my_data["years"]

    # ── CROSSOVERS ──
    crossovers = []
    for tid, d in dynasty.items():
        if tid == team_id:
            continue
        for i in range(1, len(d["years"])):
            my = my_years[i]["total"]
            them = d["years"][i]["total"]
            prev_my = my_years[i-1]["total"]
            prev_them = d["years"][i-1]["total"]
            if prev_my < prev_them and my >= them:
                crossovers.append({
                    "year": d["years"][i]["year"],
                    "event": f"You overtake {d['name']}",
                    "team": d["name"],
                    "type": "overtake",
                })
            elif prev_my >= prev_them and my < them:
                crossovers.append({
                    "year": d["years"][i]["year"],
                    "event": f"{d['name']} overtakes you",
                    "team": d["name"],
                    "type": "overtaken",
                })

    # ── KID BREAKTHROUGH TIMELINE ──
    # Only report genuine youth breakthroughs, not positional churn.
    # Quality gates:
    #   - Entering player must be under 24 (actually a "kid")
    #   - Entering player must project at least 65 SC (not a fringe player)
    #   - Departing player must be 27+ (actually declining/aging out)
    #   - Departing player's projected SC must be LOWER than the entrant
    #   - Position must match
    kid_timeline = []
    for i in range(1, len(my_years)):
        curr_names = set(p["name"] for p in my_years[i]["squad"])
        prev_names = set(p["name"] for p in my_years[i-1]["squad"])
        entered = curr_names - prev_names
        left = prev_names - curr_names

        prev_by_name = {p["name"]: p for p in my_years[i-1]["squad"]}
        curr_by_name = {p["name"]: p for p in my_years[i]["squad"]}
        left_list = list(left)

        for name in entered:
            entry = curr_by_name.get(name)
            if not entry:
                continue
            entry_age = entry.get("age", 0)
            entry_sc = entry.get("sc", 0)

            # Gate: must be a genuine kid, not just a squad rotation
            if entry_age > 23 or entry_sc < 65:
                continue

            entry_pos = (entry.get("position", "MID")).split("/")[0]

            # Find a position-matched departed player who is actually aging out
            replaces = None
            for j, dep_name in enumerate(left_list):
                dep = prev_by_name.get(dep_name, {})
                dep_pos = dep.get("position", "MID").split("/")[0]
                dep_age = dep.get("age", 0)
                dep_sc = dep.get("sc", 0)
                # Must be same position, 27+, and the kid must project higher
                if dep_pos == entry_pos and dep_age >= 27 and entry_sc >= dep_sc:
                    replaces = left_list.pop(j)
                    break

            kid_timeline.append({
                "year": my_years[i]["year"],
                "enters": name,
                "replaces": replaces,
                "enters_age": entry_age,
                "enters_sc": round(entry_sc, 0),
            })

    # ── BIGGEST GAP ──
    biggest_gap = None
    if trade_table and trade_table.get("gaps"):
        gap = trade_table["gaps"][0]  # already sorted by gap
        fills = [fa for fa in trade_table.get("free_agents", [])
                if fa.get("fills_gap") and fa["position"] == gap["position"]]
        biggest_gap = {
            "position": gap["position"],
            "gap": gap["gap"],
            "your_avg": gap["avg_sc"],
            "league_avg": gap["league_avg"],
            "weakest": gap["weakest_player"],
            "weakest_sc": gap.get("weakest_sc", 0),
            "best_fill_name": fills[0]["name"] if fills else None,
            "best_fill_sc": fills[0]["sc_avg"] if fills else 0,
        }

    # ── DEPENDENCY ──
    scenarios = analytics.get("scenarios", {})
    key_injuries = scenarios.get("key_injuries", [])
    max_drop = max((abs(k["drop"]) for k in key_injuries), default=0) if key_injuries else 0
    if max_drop > 30:
        dep_level, dep_detail = "high", f"Losing your most important player costs {max_drop:.0f} points per week"
    elif max_drop > 15:
        dep_level = "moderate"
        top = key_injuries[0]["name"] if key_injuries else "?"
        dep_detail = f"{top} is your most irreplaceable player ({max_drop:.0f} point drop)"
    else:
        dep_level = "low"
        dep_detail = "No single player loss costs more than 15 points — deep, resilient roster"

    # ── TRAJECTORY ──
    start = my_years[0]["total"]
    end = my_years[-1]["total"]
    change_pct = (end - start) / max(start, 1) * 100

    # Am I #1 now and throughout?
    always_first = True
    for i, yr in enumerate(my_years):
        for tid, d in dynasty.items():
            if tid == team_id:
                continue
            if d["years"][i]["total"] > yr["total"]:
                always_first = False
                break
        if not always_first:
            break

    if always_first and change_pct > 5:
        trajectory = "dominant"
    elif change_pct > 10:
        trajectory = "rising"
    elif change_pct > -2:
        trajectory = "peaking"
    else:
        trajectory = "declining"

    # ── VERDICT ──
    lc = analytics.get("league_context", {})
    rank = lc.get("avg_sc_rank", {}).get("rank", "?")
    total_teams = lc.get("avg_sc_rank", {}).get("of", "?")

    if trajectory == "dominant":
        verdict = f"The strongest team in the league now and projected to stay that way. Your youth pipeline means you get better every year while others decline."
    elif trajectory == "rising":
        verdict = f"Currently {rank}/{total_teams} but your young core projects to push you to the top within 2-3 years. Patience will pay off."
    elif trajectory == "peaking":
        verdict = f"You're at or near your peak. The next 1-2 years are your best window to win it all before age catches up."
    else:
        verdict = f"Your roster is trending down. Key players are aging out faster than replacements are developing. Time to rebuild through the draft."

    if biggest_gap:
        verdict += f" Your biggest weakness is {biggest_gap['position']} — {abs(biggest_gap['gap']):.0f} points below league average."

    return {
        "verdict": verdict,
        "crossovers": crossovers,
        "kid_timeline": kid_timeline,
        "biggest_gap": biggest_gap,
        "dependency": {"level": dep_level, "detail": dep_detail},
        "trajectory": trajectory,
    }

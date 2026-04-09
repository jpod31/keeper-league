"""Player profile tags — data-driven classification using historical SC performance.

Uses multi-year SuperCoach data to classify players into meaningful tiers
based on actual scoring output, trajectory, and age context.
"""

import os
import logging
from collections import defaultdict

import pandas as pd

import config

logger = logging.getLogger(__name__)


def _load_sc_history():
    """Load all available SC score CSVs into a consolidated dict.

    Returns: {player_name: {year: {'avg': float, 'games': int, 'scores': [int]}}}
    """
    history = defaultdict(lambda: defaultdict(lambda: {"scores": []}))

    for year in range(2018, config.CURRENT_YEAR + 1):
        path = os.path.join(config.DATA_DIR, f"player_stats_{year}.csv")
        if not os.path.exists(path):
            continue
        try:
            df = pd.read_csv(path, usecols=["Player", "SC"])
            df = df.dropna(subset=["SC"])
            for _, row in df.iterrows():
                name = str(row["Player"]).strip()
                sc = int(row["SC"])
                history[name][year]["scores"].append(sc)
        except Exception:
            logger.debug("Failed to load %s for profile tags", path, exc_info=True)

    # Compute averages
    for name in history:
        for year in history[name]:
            scores = history[name][year]["scores"]
            history[name][year]["avg"] = sum(scores) / len(scores) if scores else 0
            history[name][year]["games"] = len(scores)

    return dict(history)


def _compute_percentiles(players):
    """Compute SC average percentile ranks for the current season.

    Returns: {player_name: percentile (0-100)}
    """
    sc_vals = []
    for p in players:
        if p.sc_avg and p.sc_avg > 0:
            sc_vals.append((p.name, p.sc_avg))

    if not sc_vals:
        return {}

    sc_vals.sort(key=lambda x: x[1])
    n = len(sc_vals)
    return {name: round(i / n * 100, 1) for i, (name, _) in enumerate(sc_vals)}


def compute_profile_tags(players):
    """Compute rich profile tags for a list of AflPlayer objects.

    Returns: {player_id: {
        'tag': str,          # tag name (e.g. 'Premium', 'Emerging Star')
        'css': str,          # CSS class suffix
        'detail': str,       # one-line explanation
        'tier': int,         # 1=best for sorting
        'sc_pct': float,     # SC percentile this season
        'trajectory': str,   # 'rising', 'declining', 'stable', 'peaking'
        'years_elite': int,  # years with avg > 100
        'peak_avg': float,   # best season average
        'peak_year': int,    # year of best season
    }}
    """
    history = _load_sc_history()
    percentiles = _compute_percentiles(players)

    tags = {}
    for p in players:
        age = p.age or 25
        sc = p.sc_avg or 0
        sc_prev = p.sc_avg_prev or 0
        games = p.games_played or 0
        pct = percentiles.get(p.name, 50)

        # Historical analysis
        ph = history.get(p.name, {})
        yearly_avgs = [(y, d["avg"]) for y, d in sorted(ph.items()) if d["games"] >= 3]
        years_elite = sum(1 for _, avg in yearly_avgs if avg >= 100)
        years_premium = sum(1 for _, avg in yearly_avgs if avg >= 90)
        peak_avg = max((avg for _, avg in yearly_avgs), default=0)
        peak_year = next((y for y, avg in yearly_avgs if avg == peak_avg), 0) if peak_avg else 0

        # Trajectory: compare last 2-3 years (use current sc_avg if fresher)
        recent_avgs = [avg for _, avg in yearly_avgs[-3:]]
        # If current sc_avg differs significantly from latest CSV year, prefer it
        if sc > 0 and recent_avgs and abs(sc - recent_avgs[-1]) > 5:
            recent_avgs[-1] = sc
        if len(recent_avgs) >= 2:
            trend = recent_avgs[-1] - recent_avgs[0]
            if trend > 8:
                trajectory = "rising"
            elif trend < -8:
                trajectory = "declining"
            elif recent_avgs[-1] >= peak_avg * 0.95 and peak_avg >= 90:
                trajectory = "peaking"
            else:
                trajectory = "stable"
        elif sc > sc_prev + 8 and sc_prev > 0:
            trajectory = "rising"
        elif sc < sc_prev - 8 and sc_prev > 0:
            trajectory = "declining"
        else:
            trajectory = "stable"

        # ── Classification (order matters — first match wins) ──

        # ELITE TIER: Genuine gun — top 5% AND proven over multiple years
        if pct >= 95 and years_elite >= 2 and age < 30:
            tag, css, tier = "Elite", "elite", 1
            detail = f"Top {100-pct:.0f}% scorer, {years_elite}yr elite — generational"

        elif pct >= 95 and age >= 30:
            tag, css, tier = "Elite Veteran", "elite-vet", 2
            detail = f"Top {100-pct:.0f}% at {age} — still dominant"

        # PREMIUM TIER: Top 10% OR averaging 100+ this season
        elif pct >= 90 or (sc >= 100 and games >= 3):
            tag, css, tier = "Premium", "premium", 3
            if trajectory == "rising":
                detail = f"Top {100-pct:.0f}% and trending up — {sc:.0f} avg"
            elif trajectory == "peaking":
                detail = f"Career-best form — {sc:.0f} avg, peak is {peak_avg:.0f}"
            else:
                detail = f"Top {100-pct:.0f}% scorer — averaging {sc:.0f}"

        # EMERGING: Young + clearly improving + showing real SC output
        elif age <= 23 and trajectory == "rising" and sc >= 70:
            tag, css, tier = "Emerging Star", "rising", 4
            detail = f"Avg up to {sc:.0f} at {age} — on the rise"

        elif age <= 22 and sc >= 60 and games >= 3:
            tag, css, tier = "Breakout", "breakout", 5
            detail = f"Averaging {sc:.0f} at {age} — {games} games this year"

        # PROVEN: Reliable mid-tier, scoring above average
        elif pct >= 70 and age <= 30:
            tag, css, tier = "Proven", "proven", 6
            if years_premium >= 2:
                detail = f"Consistent — {years_premium} years averaging 90+"
            else:
                detail = f"Top {100-pct:.0f}% — solid {sc:.0f} avg"

        # DECLINING: Was good, now clearly below peak
        elif peak_avg >= 90 and sc < peak_avg - 15 and age >= 27:
            tag, css, tier = "Declining", "declining", 10
            detail = f"Down from {peak_avg:.0f} peak ({peak_year}) to {sc:.0f}"

        # DEVELOPING: Young, hasn't done enough yet
        elif age <= 22 and sc < 60:
            tag, css, tier = "Developing", "developing", 8
            if sc > 0:
                detail = f"Averaging {sc:.0f} at {age} — still raw"
            else:
                detail = f"Age {age} — yet to establish"

        # VETERAN: Older, middling output
        elif age >= 30 and pct < 70:
            tag, css, tier = "Veteran", "veteran", 11
            if peak_avg >= 90:
                detail = f"Past peak ({peak_avg:.0f} in {peak_year}) — now {sc:.0f}"
            else:
                detail = f"Age {age}, averaging {sc:.0f}"

        # STEADY: Mid-range, nothing special
        elif pct >= 50 and age <= 30:
            tag, css, tier = "Steady", "steady", 7
            detail = f"Middle of the pack — {sc:.0f} avg"

        # FRINGE: Below average SC, not young enough to develop
        elif age >= 25 and pct < 50:
            tag, css, tier = "Fringe", "fringe", 12
            detail = f"Below average — {sc:.0f} avg at {age}"

        # PROJECT: Young but no real SC output yet
        elif age <= 23 and sc < 60:
            tag, css, tier = "Project", "project", 9
            detail = f"Age {age} — potential upside, limited output"

        # FALLBACK
        else:
            tag, css, tier = "Unclassified", "fringe", 13
            detail = f"{sc:.0f} avg, age {age}"

        tags[p.id] = {
            "tag": tag,
            "css": css,
            "detail": detail,
            "tier": tier,
            "sc_pct": pct,
            "trajectory": trajectory,
            "years_elite": years_elite,
            "years_premium": years_premium,
            "peak_avg": round(peak_avg, 1),
            "peak_year": peak_year,
        }

    return tags

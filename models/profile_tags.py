"""Player profile tags — deep statistical classification using multi-year SC data.

Factors:
  1. Position-adjusted SC percentile (ruck 90 != mid 90)
  2. Historical trajectory (linear regression on yearly averages)
  3. Consistency (coefficient of variation across games)
  4. Durability (avg games per season)
  5. Age-curve context (years to/from positional peak)
  6. Multi-year elite/premium seasons count
  7. Composite keeper value score
"""

import os
import math
import logging
from collections import defaultdict

import pandas as pd

import config

logger = logging.getLogger(__name__)

# Positional peak age ranges (start, end) — when SC output typically peaks
_POS_PEAK = {
    "MID": (25, 29),
    "DEF": (26, 30),
    "FWD": (24, 28),
    "RUC": (26, 30),
}

# Positional scarcity: multiplier for composite score.
# Higher = harder to find good scorers at this position.
# Derived from % of players at 80+ SC: FWD(20%) > DEF(27%) > MID/RUC(44%)
_POS_SCARCITY = {
    "FWD": 1.20,   # hardest to find premium scorers
    "DEF": 1.10,   # moderately scarce
    "MID": 1.00,   # baseline — most supply
    "RUC": 1.15,   # tiny pool makes each one more valuable
}


def _load_sc_history():
    """Load per-game SC scores from CSVs into structured history.

    Returns: {player_name: {year: [sc_score, sc_score, ...]}}
    """
    history = defaultdict(lambda: defaultdict(list))

    for year in range(2018, config.CURRENT_YEAR + 1):
        path = os.path.join(config.DATA_DIR, f"player_stats_{year}.csv")
        if not os.path.exists(path):
            continue
        try:
            df = pd.read_csv(path, usecols=["Player", "SC"])
            df = df.dropna(subset=["SC"])
            for _, row in df.iterrows():
                name = str(row["Player"]).strip()
                history[name][year].append(int(row["SC"]))
        except Exception:
            logger.debug("Failed to load %s", path, exc_info=True)

    return dict(history)


def _linear_slope(values):
    """Simple linear regression slope for a list of values (one per year)."""
    n = len(values)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    den = sum((i - x_mean) ** 2 for i in range(n))
    return num / den if den else 0.0


def _std_dev(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((v - mean) ** 2 for v in values) / len(values))


def _primary_pos(position_str):
    """Extract primary position from 'DEF/MID' style string."""
    if not position_str:
        return "MID"
    return position_str.split("/")[0]


def compute_profile_tags(players):
    """Compute rich, data-driven profile tags for all players.

    Returns: {player_id: {
        'tag': str, 'css': str, 'tier': int,
        'headline': str,       # short context line
        'detail': str,         # longer explanation
        'composite': float,    # 0-100 keeper value score
        'pos_pct': float,      # positional percentile
        'trajectory': float,   # yearly SC slope
        'consistency': float,  # 0-1 (1 = perfectly consistent)
        'durability': float,   # avg games per season
        'peak_avg': float,
        'peak_year': int,
        'years_elite': int,
        'years_premium': int,
    }}
    """
    history = _load_sc_history()

    # ── Step 1: Build positional percentile ranks ──
    pos_groups = defaultdict(list)  # pos -> [(player, sc_avg)]
    for p in players:
        if p.sc_avg and p.sc_avg > 0:
            pos = _primary_pos(p.position)
            pos_groups[pos].append((p, p.sc_avg))

    pos_percentiles = {}  # player_id -> percentile within position
    for pos, group in pos_groups.items():
        group.sort(key=lambda x: x[1])
        n = len(group)
        for i, (p, _) in enumerate(group):
            pos_percentiles[p.id] = round(i / max(n - 1, 1) * 100, 1)

    # ── Global percentile for all-positions comparison ──
    all_sc = [(p, p.sc_avg) for p in players if p.sc_avg and p.sc_avg > 0]
    all_sc.sort(key=lambda x: x[1])
    global_pct = {}
    n_all = len(all_sc)
    for i, (p, _) in enumerate(all_sc):
        global_pct[p.id] = round(i / max(n_all - 1, 1) * 100, 1)

    # ── Step 2: Per-player deep analysis ──
    tags = {}
    for p in players:
        age = p.age or 25
        sc = p.sc_avg or 0
        sc_prev = p.sc_avg_prev or 0
        games = p.games_played or 0
        pos = _primary_pos(p.position)

        # If no current season avg, use previous year or best recent historical avg
        # so players who are injured/missed early rounds aren't penalised
        if sc == 0 and sc_prev > 0:
            sc = sc_prev
        if sc == 0:
            ph = history.get(p.name, {})
            recent_avgs = [(y, sum(s)/len(s)) for y, s in sorted(ph.items(), reverse=True) if len(s) >= 3]
            if recent_avgs:
                sc = recent_avgs[0][1]  # most recent year with 3+ games

        pct = global_pct.get(p.id, 50)
        pos_pct = pos_percentiles.get(p.id, 50)

        # If player has no current sc_avg but we derived one from history,
        # estimate their percentile from the distribution
        if p.sc_avg is None or p.sc_avg == 0:
            # Find where they'd rank in the global distribution
            below = sum(1 for _, v in all_sc if v < sc)
            pct = round(below / max(n_all, 1) * 100, 1) if sc > 0 else 50
            # Same for positional
            pos_group = pos_groups.get(pos, [])
            pos_below = sum(1 for _, v in pos_group if v < sc)
            pos_pct = round(pos_below / max(len(pos_group) - 1, 1) * 100, 1) if sc > 0 else 50

        # Historical data
        ph = history.get(p.name, {})
        yearly_data = []  # [(year, avg, games, std)]
        all_scores = []
        for y in sorted(ph.keys()):
            scores = ph[y]
            if len(scores) >= 3:
                avg = sum(scores) / len(scores)
                std = _std_dev(scores)
                yearly_data.append((y, avg, len(scores), std))
                all_scores.extend(scores)

        # Use current season data — require meaningful sample (8+ games)
        # to prevent small-sample inflation driving tag decisions.
        if sc > 0 and games >= 8:
            cur_year = config.CURRENT_YEAR
            if not any(y == cur_year for y, _, _, _ in yearly_data):
                yearly_data.append((cur_year, sc, games, 0))

        yearly_avgs = [avg for _, avg, _, _ in yearly_data]
        years_elite = sum(1 for avg in yearly_avgs if avg >= 105)
        years_premium = sum(1 for avg in yearly_avgs if avg >= 90)
        total_seasons = len(yearly_data)

        peak_avg = max(yearly_avgs, default=0)
        peak_year = 0
        if peak_avg > 0:
            for y, avg, _, _ in yearly_data:
                if avg == peak_avg:
                    peak_year = y
                    break

        # Trajectory: slope of yearly averages (points per year)
        trajectory = _linear_slope(yearly_avgs) if len(yearly_avgs) >= 2 else 0.0

        # Consistency: 1 - (CV of all game scores). Higher = more consistent.
        if all_scores and len(all_scores) >= 5:
            mean_sc = sum(all_scores) / len(all_scores)
            cv = _std_dev(all_scores) / mean_sc if mean_sc > 0 else 1.0
            consistency = round(max(0, 1 - cv), 2)
        elif sc > 0:
            consistency = 0.5  # unknown
        else:
            consistency = 0.0

        # Durability: average games per season (max ~22-23)
        if yearly_data:
            durability = round(sum(g for _, _, g, _ in yearly_data) / len(yearly_data), 1)
        else:
            durability = games or 0

        # Age curve: years to/from peak for this position
        peak_start, peak_end = _POS_PEAK.get(pos, (25, 29))
        if age < peak_start:
            peak_phase = "pre-peak"
            years_to_peak = peak_start - age
        elif age <= peak_end:
            peak_phase = "peak"
            years_to_peak = 0
        else:
            peak_phase = "post-peak"
            years_to_peak = -(age - peak_end)

        # ── Composite keeper value (0-100) ──
        # Weighted: SC output (30%) + trajectory (15%) + consistency (15%) +
        #           durability (10%) + age value (15%) + history (15%)
        # Small-sample credibility: dampen current SC toward league median
        # when games < 12 (about half a season). Full trust at 12+.
        credibility = min(games / 12, 1.0) if games else 0
        league_median_sc = 65  # rough median for rostered AFL players
        sc_effective = sc * credibility + league_median_sc * (1 - credibility) if sc > 0 else 0
        # Compute percentile of sc_effective in the global SC distribution
        below = sum(1 for _, s in all_sc if s < sc_effective)
        pct_effective = round(below / max(n_all, 1) * 100, 1) if sc_effective > 0 else 50
        sc_score = min(pct_effective, 100) * 0.30

        traj_norm = max(min(trajectory / 10, 1), -1)  # normalise -1 to +1
        traj_score = (traj_norm + 1) / 2 * 100 * 0.15  # 0-15

        cons_score = consistency * 100 * 0.15  # 0-15

        dur_norm = min(durability / 22, 1)
        dur_score = dur_norm * 100 * 0.10  # 0-10

        # Age value: pre-peak > peak > post-peak, weighted by how much SC they produce
        if peak_phase == "pre-peak" and sc >= 60:
            age_val = min(90 + years_to_peak * 3, 100)
        elif peak_phase == "peak":
            age_val = 80
        elif peak_phase == "post-peak":
            age_val = max(60 + years_to_peak * 5, 10)  # years_to_peak is negative
        else:
            age_val = 50
        age_score = age_val * 0.15  # 0-15

        hist_val = min(years_premium * 15, 100)
        hist_score = hist_val * 0.15  # 0-15

        raw_composite = sc_score + traj_score + cons_score + dur_score + age_score + hist_score

        # Apply positional scarcity multiplier
        scarcity = _POS_SCARCITY.get(pos, 1.0)
        composite = round(min(raw_composite * scarcity, 100), 1)

        # Scarcity-adjusted effective percentile for classification
        # A FWD at 75th percentile is effectively as scarce as a MID at 90th
        eff_pos_pct = min(pos_pct * scarcity, 100)

        # ── Classification ──
        # Elite: top 5% positionally (scarcity-adjusted) AND multi-year production
        if eff_pos_pct >= 95 and years_elite >= 2 and age < 31:
            tag, css, tier = "Elite", "elite", 1
            headline = f"Top {100-pos_pct:.0f}% {pos} — {years_elite}yr elite"
            detail = f"Averaging {sc:.0f} (top {100-pct:.0f}% overall). {years_premium} seasons at 90+. Peak {peak_avg:.0f} ({peak_year}). {peak_phase.replace('-', ' ').title()} for {pos}."

        elif eff_pos_pct >= 95 and age >= 31:
            tag, css, tier = "Elite Veteran", "elite-vet", 2
            headline = f"Top {100-pos_pct:.0f}% {pos} at {age}"
            detail = f"Still averaging {sc:.0f} at {age}. Peak was {peak_avg:.0f} ({peak_year}). {years_premium} premium seasons. Post-peak but still producing."

        elif eff_pos_pct >= 90 or (sc >= 100 and games >= 10) or (sc >= 100 and years_premium >= 1):
            tag, css, tier = "Premium", "premium", 3
            if trajectory > 3:
                headline = f"Top {100-pos_pct:.0f}% {pos} — trending up"
            elif peak_phase == "pre-peak":
                headline = f"Top {100-pos_pct:.0f}% {pos} — hasn't peaked yet"
            else:
                headline = f"Top {100-pos_pct:.0f}% {pos} — {sc:.0f} avg"
            detail = f"Averaging {sc:.0f} ({100-pct:.0f}th percentile overall). Consistency {consistency:.0%}. {durability:.0f} games/season avg."
            if years_premium >= 2:
                detail += f" {years_premium} years at 90+."

        elif age <= 23 and trajectory > 5 and sc >= 70:
            tag, css, tier = "Emerging Star", "rising", 4
            headline = f"Avg up {trajectory:+.0f}/yr — {sc:.0f} at {age}"
            detail = f"SC trending up {trajectory:+.1f} per year. Averaging {sc:.0f} as a {age}yo {pos}. {years_to_peak} years to typical {pos} peak."

        elif age <= 22 and sc >= 60 and games >= 3:
            tag, css, tier = "Breakout", "breakout", 5
            headline = f"{sc:.0f} avg at {age} — {games} games"
            detail = f"Young {pos} averaging {sc:.0f} from {games} games. {years_to_peak} years before peak window. Consistency {consistency:.0%}."

        elif eff_pos_pct >= 65 and age <= 30:
            tag, css, tier = "Proven", "proven", 6
            headline = f"Top {100-pos_pct:.0f}% {pos} — reliable"
            detail = f"Averaging {sc:.0f} (top {100-pct:.0f}% overall). {years_premium} seasons at 90+. Durability: {durability:.0f} games/yr."
            if trajectory < -3:
                detail += f" Trending down {trajectory:+.1f}/yr."

        elif peak_avg >= 90 and sc < peak_avg - 15 and age >= 27:
            tag, css, tier = "Declining", "declining", 10
            headline = f"Down from {peak_avg:.0f} ({peak_year})"
            detail = f"Was averaging {peak_avg:.0f} in {peak_year}, now {sc:.0f}. Trajectory {trajectory:+.1f}/yr. {age}yo {pos}, {abs(years_to_peak)} years post-peak."

        elif age <= 22 and sc < 60:
            tag, css, tier = "Developing", "developing", 8
            headline = f"Age {age} {pos} — early days"
            detail = f"Averaging {sc:.0f} from {games} games. {years_to_peak} years to {pos} peak window."

        elif age >= 30 and eff_pos_pct < 65:
            tag, css, tier = "Veteran", "veteran", 11
            headline = f"{age}yo — {sc:.0f} avg"
            if peak_avg >= 90:
                detail = f"Past peak ({peak_avg:.0f} in {peak_year}). Now {sc:.0f}. {years_premium} premium seasons in career."
            else:
                detail = f"Career journeyman averaging {sc:.0f}. Durability: {durability:.0f} games/yr."

        elif eff_pos_pct >= 40 and age <= 30:
            tag, css, tier = "Steady", "steady", 7
            headline = f"Mid-tier {pos} — {sc:.0f} avg"
            detail = f"Positional rank: top {100-pos_pct:.0f}% of {pos}s. Overall: top {100-pct:.0f}%. Consistency {consistency:.0%}."

        elif age >= 25 and eff_pos_pct < 40:
            tag, css, tier = "Fringe", "fringe", 12
            headline = f"Bottom half {pos} — {sc:.0f} avg"
            detail = f"Below average for {pos} (bottom {pos_pct:.0f}%). {age}yo. Durability: {durability:.0f} games/yr."

        elif age <= 23 and sc < 60:
            tag, css, tier = "Project", "project", 9
            headline = f"Age {age} — limited output"
            detail = f"Averaging {sc:.0f}. Young enough to develop — {years_to_peak} years to {pos} peak."

        else:
            tag, css, tier = "Unclassified", "fringe", 13
            headline = f"{sc:.0f} avg, {age}yo {pos}"
            detail = f"Position rank: {pos_pct:.0f}th percentile. Overall: {pct:.0f}th percentile."

        tags[p.id] = {
            "tag": tag,
            "css": css,
            "tier": tier,
            "headline": headline,
            "detail": detail,
            "composite": composite,
            "scarcity": scarcity,
            "pos_pct": pos_pct,
            "eff_pos_pct": round(eff_pos_pct, 1),
            "global_pct": pct,
            "trajectory": round(trajectory, 1),
            "consistency": consistency,
            "durability": durability,
            "peak_avg": round(peak_avg, 1),
            "peak_year": peak_year,
            "years_elite": years_elite,
            "years_premium": years_premium,
            "peak_phase": peak_phase,
        }

    return tags

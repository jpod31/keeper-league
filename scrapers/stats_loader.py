"""Load detailed player stats from fitzRoy-generated CSVs."""

from __future__ import annotations

import os
from typing import Dict, List, Optional

import pandas as pd

from config import DATA_DIR, CURRENT_YEAR, SC_HISTORY_YEARS

# Columns we prioritise when building stat summaries.
# Ordered so tables read naturally left-to-right.
CORE_STAT_COLS = [
    "kicks", "handballs", "disposals", "marks", "goals", "behinds",
    "tackles", "hitouts",
]

ADVANCED_STAT_COLS = [
    "contested_possessions", "uncontested_possessions", "clearances",
    "clangers", "inside_fifties", "rebounds", "effective_disposals",
    "disposal_efficiency_percentage", "metres_gained", "pressure_acts",
    "ground_ball_gets", "intercepts", "score_involvements",
    "frees_for", "frees_against", "contested_marks", "marks_inside_50",
    "one_percenters", "bounces", "goal_assists", "time_on_ground_pct",
    "centre_clearances", "stoppage_clearances", "turnovers", "kick_ins",
]

FANTASY_COLS = [
    "supercoach_score", "afl_fantasy_score",
]

# All stat columns we care about, in display order
ALL_STAT_COLS = CORE_STAT_COLS + ADVANCED_STAT_COLS + FANTASY_COLS

# Common alternative column names produced by different fitzRoy sources.
# First entry is canonical; the rest are aliases from AFL API, footywire, fryzigg.
_ALIASES: Dict[str, List[str]] = {
    "kicks":                        ["kicks", "K"],
    "handballs":                    ["handballs", "HB"],
    "disposals":                    ["disposals", "D"],
    "marks":                        ["marks", "M"],
    "goals":                        ["goals", "G"],
    "behinds":                      ["behinds", "B"],
    "tackles":                      ["tackles", "T"],
    "hitouts":                      ["hitouts", "HO", "hit_outs"],
    "contested_possessions":        ["contested_possessions", "CP",
                                     "contestedPossessions"],
    "uncontested_possessions":      ["uncontested_possessions", "UP",
                                     "uncontestedPossessions"],
    "clearances":                   ["clearances", "CL", "total_clearances",
                                     "clearances.totalClearances"],
    "clangers":                     ["clangers", "CG"],
    "inside_fifties":               ["inside_fifties", "I50", "inside_50s",
                                     "inside50s"],
    "rebounds":                     ["rebounds", "R50", "rebound_50s",
                                     "rebound50s"],
    "effective_disposals":          ["effective_disposals", "ED",
                                     "extendedStats.effectiveDisposals"],
    "disposal_efficiency_percentage": ["disposal_efficiency_percentage", "DE",
                                       "disposalEfficiency"],
    "metres_gained":                ["metres_gained", "MG", "metresGained"],
    "pressure_acts":                ["pressure_acts", "PA",
                                     "extendedStats.pressureActs"],
    "ground_ball_gets":             ["ground_ball_gets", "GBG",
                                     "extendedStats.groundBallGets"],
    "intercepts":                   ["intercepts", "ITC"],
    "score_involvements":           ["score_involvements", "SI",
                                     "scoreInvolvements"],
    "supercoach_score":             ["supercoach_score", "SC", "supercoach"],
    "afl_fantasy_score":            ["afl_fantasy_score", "AF", "fantasy_points",
                                     "dreamteam_score", "dreamTeamPoints"],
    "frees_for":                    ["frees_for", "FF", "freesFor"],
    "frees_against":                ["frees_against", "FA", "freesAgainst"],
    "contested_marks":              ["contested_marks", "CM", "contestedMarks"],
    "marks_inside_50":              ["marks_inside_50", "MI5", "marksInside50"],
    "one_percenters":               ["one_percenters", "1%", "onePercenters"],
    "bounces":                      ["bounces", "BO"],
    "goal_assists":                 ["goal_assists", "GA", "goalAssists"],
    "time_on_ground_pct":           ["time_on_ground_pct", "TOG", "timeOnGroundPercentage"],
    "centre_clearances":            ["centre_clearances", "CCL", "centreClearances"],
    "stoppage_clearances":          ["stoppage_clearances", "SCL", "stoppageClearances"],
    "turnovers":                    ["turnovers", "TO"],
    "kick_ins":                     ["kick_ins", "KI", "kickIns"],
}

# Potential player-name columns in fitzRoy output
_NAME_COLS = [
    "Player",       # footywire (already "First Last")
    "player_name",  # our canonical
    "player", "playerName",
]

# Columns that may contain given name / surname separately
_GIVEN_NAME_COLS = [
    "player_first_name",  # fryzigg
    "player.givenName", "player.player.player.givenName",  # AFL API
    "givenName", "given_name", "first_name",
]
_SURNAME_COLS = [
    "player_last_name",  # fryzigg
    "player.surname", "player.player.player.surname",  # AFL API
    "surname", "last_name",
]

# Potential team columns
_TEAM_COLS = ["Team", "team", "player_team", "playing_for", "team.name"]

# Potential round/match-date columns
_ROUND_COLS = ["Round", "round", "round_number", "match_round",
               "round.roundNumber"]
_DATE_COLS = ["Date", "date", "match_date", "utcStartTime"]


def _resolve_col(df: pd.DataFrame, aliases: List[str]) -> Optional[str]:
    """Return the first alias that exists as a column in *df*, or None."""
    for a in aliases:
        if a in df.columns:
            return a
    return None


def _parse_round(val) -> tuple:
    """Convert round string to (sort_key, display_label).

    'Round 5' → (5, 'R5')
    'Round 0' → (0, 'R0')
    'Qualifying Final' → (100, 'QF')
    'Elimination Final' → (101, 'EF')
    'Semi Final' → (102, 'SF')
    'Preliminary Final' → (103, 'PF')
    'Grand Final' → (104, 'GF')
    Numeric 5 → (5, 'R5')
    """
    import re
    if pd.isna(val):
        return (999, "?")
    s = str(val).strip()
    # "Round 5" style
    m = re.match(r"[Rr](?:ound\s*)?(\d+)", s)
    if m:
        n = int(m.group(1))
        return (n, f"R{n}")
    # Pure number
    if s.isdigit():
        n = int(s)
        return (n, f"R{n}")
    # Finals
    finals = {
        "qualifying final": (100, "QF"),
        "elimination final": (101, "EF"),
        "semi final": (102, "SF"),
        "preliminary final": (103, "PF"),
        "grand final": (104, "GF"),
    }
    return finals.get(s.lower(), (999, s))


def _clean_player_name(name: str) -> str:
    """Clean player name: strip trade arrows, extra whitespace, fix abbreviated hyphens."""
    import re
    if not isinstance(name, str):
        return str(name)
    # Strip trade indicator arrows (↗ ↙ etc.) and surrounding whitespace
    name = re.sub(r'\s*[\u2190-\u21ff\u2b00-\u2bff]+\s*$', '', name).strip()
    return name


# Mapping of abbreviated hyphenated names (fitzRoy footywire) → full names (players.csv)
_NAME_FIXES: Dict[str, str] = {
    "luke d-uniacke": "Luke Davies-Uniacke",
    "jamarra u-hagan": "Jamarra Ugle-Hagan",
    "callum c-jones": "Callum Coleman-Jones",
    "andy m-wakefield": "Andy Moniz-Wakefield",
}


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename columns to our canonical names where possible."""
    rename_map: Dict[str, str] = {}

    # Player name
    for c in _NAME_COLS:
        if c in df.columns:
            rename_map[c] = "player_name"
            break

    # If fitzRoy gives first+surname separately, combine them
    if "player_name" not in rename_map.values():
        given = _resolve_col(df, _GIVEN_NAME_COLS)
        surname = _resolve_col(df, _SURNAME_COLS)
        if given and surname:
            df["player_name"] = df[given].astype(str).str.strip() + " " + df[surname].astype(str).str.strip()

    # Team
    for c in _TEAM_COLS:
        if c in df.columns:
            rename_map[c] = "team"
            break

    # Round
    for c in _ROUND_COLS:
        if c in df.columns:
            rename_map[c] = "round"
            break

    # Date
    for c in _DATE_COLS:
        if c in df.columns:
            rename_map[c] = "date"
            break

    # Stat columns
    for canonical, aliases in _ALIASES.items():
        found = _resolve_col(df, aliases)
        if found and found != canonical:
            rename_map[found] = canonical

    df = df.rename(columns=rename_map)

    # Clean player names: strip trade arrows, fix abbreviated hyphens
    if "player_name" in df.columns:
        df["player_name"] = df["player_name"].apply(_clean_player_name)
        # Apply known name fixes
        lower_map = {k: v for k, v in _NAME_FIXES.items()}
        df["player_name"] = df["player_name"].apply(
            lambda n: lower_map.get(n.lower(), n) if isinstance(n, str) else n
        )

    return df


def _load_year_csv(year: int) -> Optional[pd.DataFrame]:
    """Load a single year CSV and normalise columns."""
    path = os.path.join(DATA_DIR, f"player_stats_{year}.csv")
    if not os.path.exists(path):
        return None
    df = pd.read_csv(path)
    df = _normalise_columns(df)
    if "player_name" not in df.columns:
        return None
    df["year"] = year
    return df


def _least_squares_slope(xs: List[float], ys: List[float]) -> float:
    """Pure-Python least-squares linear regression slope."""
    n = len(xs)
    if n < 2:
        return 0.0
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den = sum((x - x_mean) ** 2 for x in xs)
    if den == 0:
        return 0.0
    return num / den


def available_stat_columns() -> List[str]:
    """Return the list of stat columns actually present across all CSVs on disk."""
    found: set = set()
    for year in range(2013, CURRENT_YEAR + 1):
        df = _load_year_csv(year)
        if df is not None:
            for col in ALL_STAT_COLS:
                if col in df.columns:
                    found.add(col)
    # Return in canonical order
    return [c for c in ALL_STAT_COLS if c in found]


def load_player_detailed_stats(player_name: str) -> dict:
    """Load rich multi-year stats for a single player from fitzRoy CSVs.

    Returns dict with keys:
        season_averages:  list of {year, games, avg_<stat>, ...} per season
        current_rounds:   list of per-round stat dicts for the current year
        career_totals:    aggregated career stat totals
        last_3_avg:       rolling 3-game averages for key stats
        last_5_avg:       rolling 5-game averages
        trajectory_slope: SC regression slope (pts/yr)
        available_cols:   list of stat column names present in the data
        has_data:         bool — whether any detailed stats were found
    """
    all_frames: List[pd.DataFrame] = []

    for year in range(2013, CURRENT_YEAR + 1):
        df = _load_year_csv(year)
        if df is None:
            continue
        # Filter to this player
        player_df = df[df["player_name"].str.lower() == player_name.lower()]
        if player_df.empty:
            continue
        all_frames.append(player_df)

    if not all_frames:
        return {
            "season_averages": [],
            "current_rounds": [],
            "career_totals": {},
            "last_3_avg": {},
            "last_5_avg": {},
            "trajectory_slope": None,
            "available_cols": [],
            "has_data": False,
        }

    combined = pd.concat(all_frames, ignore_index=True)

    # Determine which stat columns are actually present
    present_cols = [c for c in ALL_STAT_COLS if c in combined.columns]

    # ── Season averages ──
    season_averages = []
    for year, grp in combined.groupby("year"):
        row: Dict = {"year": int(year), "games": len(grp)}
        for col in present_cols:
            vals = pd.to_numeric(grp[col], errors="coerce").dropna()
            row[f"avg_{col}"] = round(float(vals.mean()), 1) if len(vals) > 0 else None
            row[f"total_{col}"] = round(float(vals.sum()), 1) if len(vals) > 0 else None
        season_averages.append(row)
    season_averages.sort(key=lambda r: r["year"])

    # ── Current-year round-by-round ──
    current_rounds = []
    current_df = combined[combined["year"] == CURRENT_YEAR].copy()
    if not current_df.empty:
        # Parse round strings into sortable keys + labels
        if "round" in current_df.columns:
            parsed = current_df["round"].apply(_parse_round)
            current_df["_round_sort"] = parsed.apply(lambda x: x[0])
            current_df["_round_label"] = parsed.apply(lambda x: x[1])
            current_df = current_df.sort_values("_round_sort")

        for _, row in current_df.iterrows():
            rd: Dict = {}
            if "_round_sort" in current_df.columns:
                rd["round"] = int(row["_round_sort"])
                rd["round_label"] = row["_round_label"]
            elif "round" in current_df.columns:
                rd["round"] = row.get("round")
                rd["round_label"] = str(row.get("round", ""))
            if "date" in current_df.columns:
                rd["date"] = str(row.get("date", ""))
            if "team" in current_df.columns:
                rd["team"] = row.get("team", "")
            for col in present_cols:
                val = row.get(col)
                if pd.notna(val):
                    try:
                        rd[col] = round(float(val), 1)
                    except (ValueError, TypeError):
                        rd[col] = None
                else:
                    rd[col] = None
            current_rounds.append(rd)

    # ── Career totals ──
    career_totals: Dict = {"games": len(combined)}
    for col in present_cols:
        vals = pd.to_numeric(combined[col], errors="coerce").dropna()
        if len(vals) > 0:
            career_totals[f"total_{col}"] = round(float(vals.sum()), 1)
            career_totals[f"avg_{col}"] = round(float(vals.mean()), 1)

    # ── Rolling averages (last N games across all years) ──
    def _rolling_avg(n: int) -> Dict:
        recent = combined.tail(n)
        avg: Dict = {}
        for col in present_cols:
            vals = pd.to_numeric(recent[col], errors="coerce").dropna()
            if len(vals) > 0:
                avg[col] = round(float(vals.mean()), 1)
        return avg

    last_3_avg = _rolling_avg(3) if len(combined) >= 3 else {}
    last_5_avg = _rolling_avg(5) if len(combined) >= 5 else {}

    # ── SC trajectory slope (pts/yr) ──
    trajectory_slope = None
    sc_col = "supercoach_score" if "supercoach_score" in combined.columns else None
    if sc_col and len(season_averages) >= 2:
        xs = [float(s["year"]) for s in season_averages if s.get(f"avg_{sc_col}") is not None]
        ys = [s[f"avg_{sc_col}"] for s in season_averages if s.get(f"avg_{sc_col}") is not None]
        if len(xs) >= 2:
            trajectory_slope = round(_least_squares_slope(xs, ys), 2)

    return {
        "season_averages": season_averages,
        "current_rounds": current_rounds,
        "career_totals": career_totals,
        "last_3_avg": last_3_avg,
        "last_5_avg": last_5_avg,
        "trajectory_slope": trajectory_slope,
        "available_cols": present_cols,
        "has_data": True,
    }


def backfill_sc_from_fitzroy() -> int:
    """Backfill sc_avg and sc_avg_prev in players.csv from fitzRoy CSVs.

    For any player where sc_avg is null but fitzRoy data exists,
    find the most recent year with SC data and use that as sc_avg.

    Returns the number of players updated.
    """
    from models.player import load_players_csv, save_players_csv

    players = load_players_csv()
    if not players:
        return 0

    # Pre-load all years (most recent first)
    year_dfs: list[tuple[int, pd.DataFrame]] = []
    for year in range(CURRENT_YEAR, 2012, -1):
        df = _load_year_csv(year)
        if df is not None and "supercoach_score" in df.columns:
            year_dfs.append((year, df))

    if not year_dfs:
        return 0

    updated = 0
    for player in players:
        name_lower = player.name.lower()

        # Backfill sc_avg: try current year first, then most recent year
        if player.sc_avg is None:
            for year, df in year_dfs:
                pdata = df[df["player_name"].str.lower() == name_lower]
                if pdata.empty:
                    continue
                sc_vals = pd.to_numeric(pdata["supercoach_score"], errors="coerce").dropna()
                if len(sc_vals) > 0:
                    player.sc_avg = round(float(sc_vals.mean()), 1)
                    player.games_played = int(len(sc_vals))
                    updated += 1
                    break

        # Backfill sc_avg_prev: find the year before the one used for sc_avg
        if player.sc_avg_prev is None:
            # Find second most recent year with data
            found_first = False
            for year, df in year_dfs:
                pdata = df[df["player_name"].str.lower() == name_lower]
                if pdata.empty:
                    continue
                sc_vals = pd.to_numeric(pdata["supercoach_score"], errors="coerce").dropna()
                if len(sc_vals) == 0:
                    continue
                if not found_first:
                    found_first = True
                    continue
                # This is the second year with data
                player.sc_avg_prev = round(float(sc_vals.mean()), 1)
                break

    if updated > 0:
        save_players_csv(players)

    return updated


def load_player_sc_history_fitzroy(player_name: str) -> dict:
    """Build SC history from fitzRoy CSVs (fallback for players missing sc_scores data).

    Returns same structure as footywire's load_player_sc_history().
    """
    yearly_averages = []
    current_rounds = []

    for year in SC_HISTORY_YEARS:
        df = _load_year_csv(year)
        if df is None:
            continue
        if "supercoach_score" not in df.columns:
            continue

        pdata = df[df["player_name"].str.lower() == player_name.lower()]
        if pdata.empty:
            continue

        sc_vals = pd.to_numeric(pdata["supercoach_score"], errors="coerce").dropna()
        if len(sc_vals) == 0:
            continue

        avg = round(float(sc_vals.mean()), 1)
        gp = len(sc_vals)
        yearly_averages.append({"year": year, "avg": avg, "games_played": gp})

        if year == CURRENT_YEAR and "round" in pdata.columns:
            parsed = pdata["round"].apply(_parse_round)
            pdata = pdata.copy()
            pdata["_round_sort"] = parsed.apply(lambda x: x[0])
            pdata = pdata.sort_values("_round_sort")
            for _, row in pdata.iterrows():
                sc = pd.to_numeric(pd.Series([row.get("supercoach_score")]), errors="coerce").dropna()
                if len(sc) > 0:
                    rnd_key, _ = _parse_round(row.get("round"))
                    current_rounds.append({
                        "round": int(rnd_key),
                        "sc_score": round(float(sc.iloc[0]), 1),
                    })

    career_avg = None
    peak_avg = None
    peak_year = None
    trajectory_slope = None

    if yearly_averages:
        all_avgs = [y["avg"] for y in yearly_averages]
        career_avg = round(sum(all_avgs) / len(all_avgs), 1)
        best = max(yearly_averages, key=lambda y: y["avg"])
        peak_avg = best["avg"]
        peak_year = best["year"]

        if len(yearly_averages) >= 2:
            xs = [float(y["year"]) for y in yearly_averages]
            ys = [y["avg"] for y in yearly_averages]
            trajectory_slope = round(_least_squares_slope(xs, ys), 2)

    return {
        "yearly_averages": yearly_averages,
        "career_avg": career_avg,
        "peak_avg": peak_avg,
        "peak_year": peak_year,
        "current_rounds": current_rounds,
        "trajectory_slope": trajectory_slope,
    }

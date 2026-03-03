"""Merge AFL API player stats into footywire CSVs for missing players.

The footywire source is missing some hyphenated-surname players.
The AFL API has them but lacks SC/AF scores. This script:
1. Fetches AFL source data via R/fitzRoy for specified years
2. Identifies players in the AFL data but missing from footywire CSVs
3. Merges the missing players into the existing CSV (without SC scores)
4. Re-runs the PlayerStat import for affected years

Usage:
    python scripts/merge_afl_stats.py [start_year] [end_year]
    Default: 2018-2025
"""

import csv
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# Mapping from AFL API column names to footywire column names
AFL_COL_MAP = {
    "player.player.player.givenName": "_given",
    "player.player.player.surname": "_surname",
    "kicks": "K",
    "handballs": "HB",
    "disposals": "D",  # may need to compute
    "marks": "M",
    "goals": "G",
    "behinds": "B",
    "tackles": "T",
    "hitouts": "HO",
    "contestedPossessions": "CP",
    "uncontestedPossessions": "UP",
    "effectiveDisposals": "ED",
    "disposalEfficiency": "DE",
    "contestedMarks": "CM",
    "marksInside50": "MI5",
    "onePercenters": "One.Percenters",
    "bounces": "BO",
    "timeOnGroundPercentage": "TOG",
    "inside50s": "I50",
    "clearances.totalClearances": "CL",
    "clangers": "CG",
    "rebound50s": "R50",
    "freesFor": "FF",
    "freesAgainst": "FA",
    "goalAssists": "GA",
    "centreClearances": "CCL",
    "stoppageClearances": "SCL",
    "scoreInvolvements": "SI",
    "metresGained": "MG",
    "turnovers": "TO",
    "intercepts": "ITC",
}

FOOTYWIRE_COLS = [
    "Date", "Season", "Round", "Venue", "Player", "Team", "Opposition",
    "Status", "Match_id", "GA", "CP", "UP", "ED", "DE", "CM", "MI5",
    "One.Percenters", "BO", "TOG", "K", "HB", "D", "M", "G", "B", "T",
    "HO", "I50", "CL", "CG", "R50", "FF", "FA", "AF", "SC", "CCL", "SCL",
    "SI", "MG", "TO", "ITC", "T5",
]


def fetch_afl_source(year):
    """Fetch AFL API data for a year using R/fitzRoy, return as CSV path."""
    tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w")
    tmp.close()

    r_code = f'''
library(fitzRoy)
stats <- fetch_player_stats(season = {year}, source = "AFL")
# Build full player name
stats$Player <- paste(stats$player.player.player.givenName, stats$player.player.player.surname)
write.csv(stats, "{tmp.name}", row.names = FALSE)
cat(sprintf("Fetched %d rows\\n", nrow(stats)))
'''
    result = subprocess.run(
        ["Rscript", "-e", r_code],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        print(f"  R failed for {year}: {result.stderr[:200]}")
        os.unlink(tmp.name)
        return None

    print(f"  {result.stdout.strip()}")
    return tmp.name


def load_csv_players(csv_path):
    """Return set of player names from a footywire CSV."""
    names = set()
    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            names.add(row.get("Player", "").strip())
    return names


def merge_missing(footywire_path, afl_csv_path, year):
    """Append missing players from AFL source to footywire CSV. Returns count added."""
    fw_players = load_csv_players(footywire_path)

    afl_rows = []
    with open(afl_csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("Player", "").strip()
            if name and name not in fw_players:
                afl_rows.append(row)

    if not afl_rows:
        return 0

    # Group by player to report
    missing_names = sorted(set(r.get("Player", "") for r in afl_rows))
    print(f"  Missing from footywire: {len(missing_names)} players, {len(afl_rows)} game rows")
    for n in missing_names[:20]:
        print(f"    + {n}")

    # Append to footywire CSV
    added = 0
    with open(footywire_path, "a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FOOTYWIRE_COLS)
        for row in afl_rows:
            fw_row = {col: "" for col in FOOTYWIRE_COLS}
            fw_row["Player"] = row.get("Player", "")
            fw_row["Season"] = str(year)
            fw_row["Date"] = row.get("utcStartTime", "")[:10]

            # Map round
            rnd = row.get("round.name", row.get("round.roundNumber", ""))
            if rnd:
                try:
                    fw_row["Round"] = f"Round {int(rnd)}"
                except (ValueError, TypeError):
                    fw_row["Round"] = str(rnd)

            fw_row["Venue"] = row.get("venue.name", "")
            fw_row["Team"] = row.get("team.name", "")
            fw_row["Opposition"] = row.get("opposition.name", "")
            fw_row["Status"] = row.get("status", row.get("homeTeamScore.matchScore.homeTeamScore", ""))
            fw_row["Match_id"] = row.get("providerId", "")

            # Map stat columns
            fw_row["K"] = row.get("kicks", "")
            fw_row["HB"] = row.get("handballs", "")
            d = row.get("disposals", "")
            if not d:
                try:
                    d = str(int(float(row.get("kicks", 0) or 0)) + int(float(row.get("handballs", 0) or 0)))
                except (ValueError, TypeError):
                    d = ""
            fw_row["D"] = d
            fw_row["M"] = row.get("marks", "")
            fw_row["G"] = row.get("goals", "")
            fw_row["B"] = row.get("behinds", "")
            fw_row["T"] = row.get("tackles", "")
            fw_row["HO"] = row.get("hitouts", "")
            fw_row["CP"] = row.get("contestedPossessions", "")
            fw_row["UP"] = row.get("uncontestedPossessions", "")
            fw_row["ED"] = row.get("effectiveDisposals", "")
            fw_row["DE"] = row.get("disposalEfficiency", "")
            fw_row["CM"] = row.get("contestedMarks", "")
            fw_row["MI5"] = row.get("marksInside50", "")
            fw_row["One.Percenters"] = row.get("onePercenters", "")
            fw_row["BO"] = row.get("bounces", "")
            fw_row["TOG"] = row.get("timeOnGroundPercentage", "")
            fw_row["I50"] = row.get("inside50s", "")
            fw_row["CL"] = row.get("clearances.totalClearances", "")
            fw_row["CG"] = row.get("clangers", "")
            fw_row["R50"] = row.get("rebound50s", "")
            fw_row["FF"] = row.get("freesFor", "")
            fw_row["FA"] = row.get("freesAgainst", "")
            fw_row["GA"] = row.get("goalAssists", "")
            fw_row["CCL"] = row.get("centreClearances", "")
            fw_row["SCL"] = row.get("stoppageClearances", "")
            fw_row["SI"] = row.get("scoreInvolvements", "")
            fw_row["MG"] = row.get("metresGained", "")
            fw_row["TO"] = row.get("turnovers", "")
            fw_row["ITC"] = row.get("intercepts", "")
            fw_row["AF"] = ""  # No fantasy scores from AFL source
            fw_row["SC"] = ""  # No SC scores from AFL source
            fw_row["T5"] = ""

            writer.writerow(fw_row)
            added += 1

    return added


def main():
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 2018
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
    years_with_changes = []

    for year in range(start, end + 1):
        fw_path = os.path.join(DATA_DIR, f"player_stats_{year}.csv")
        if not os.path.exists(fw_path):
            print(f"\n{year}: No footywire CSV, skipping")
            continue

        print(f"\n{year}: Fetching AFL source...")
        afl_path = fetch_afl_source(year)
        if not afl_path:
            continue

        added = merge_missing(fw_path, afl_path, year)
        os.unlink(afl_path)

        if added:
            print(f"  Merged {added} rows into footywire CSV")
            years_with_changes.append(year)
        else:
            print(f"  No missing players")

    if years_with_changes:
        print(f"\n--- Re-importing PlayerStat for years: {years_with_changes} ---")
        from app import create_app
        from models.database import db, AflPlayer, PlayerStat
        from scripts.import_player_stats import import_year

        app = create_app()
        with app.app_context():
            name_to_id = {p.name: p.id for p in AflPlayer.query.all()}
            total = 0
            for year in years_with_changes:
                total += import_year(year, name_to_id, DATA_DIR)
            print(f"Re-imported {total} new stat rows")

    print("\nDone!")


if __name__ == "__main__":
    main()

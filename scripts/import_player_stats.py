"""Bulk-import player_stats_*.csv files into the PlayerStat table.

Matches CSV 'Player' column to AflPlayer.name -> player_id.
Parses round strings ('Round 5', 'Qualifying Final', etc.) to integers.
Idempotent: skips rows where (player_id, year, round) already exists.

Usage:
    python scripts/import_player_stats.py              # all years
    python scripts/import_player_stats.py 2024 2025    # specific years
"""

import csv
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from models.database import db, AflPlayer, PlayerStat

app = create_app()

FINALS_MAP = {
    "Qualifying Final": 25,
    "Elimination Final": 26,
    "Semi Final": 27,
    "Preliminary Final": 28,
    "Grand Final": 29,
}

# CSV column -> PlayerStat attribute
COL_MAP = {
    "K": "kicks",
    "HB": "handballs",
    "D": "disposals",
    "M": "marks",
    "G": "goals",
    "B": "behinds",
    "T": "tackles",
    "HO": "hitouts",
    "CP": "contested_possessions",
    "UP": "uncontested_possessions",
    "CL": "clearances",
    "CG": "clangers",
    "I50": "inside_fifties",
    "R50": "rebounds",
    "ED": "effective_disposals",
    "DE": "disposal_efficiency",
    "MG": "metres_gained",
    "FF": "frees_for",
    "FA": "frees_against",
    "CM": "contested_marks",
    "MI5": "marks_inside_50",
    "One.Percenters": "one_percenters",
    "BO": "bounces",
    "GA": "goal_assists",
    "TOG": "time_on_ground_pct",
    "SC": "supercoach_score",
    "AF": "afl_fantasy_score",
    "SI": "score_involvements",
    "ITC": "intercepts",
    "CCL": "centre_clearances",
    "SCL": "stoppage_clearances",
    "TO": "turnovers",
}


def parse_round(round_str):
    """Convert round string to integer."""
    if round_str in FINALS_MAP:
        return FINALS_MAP[round_str]
    m = re.match(r"Round\s+(\d+)", str(round_str))
    if m:
        return int(m.group(1))
    return None


def safe_int(val):
    """Convert to int, returning None for empty/invalid."""
    if val is None or val == "":
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def safe_float(val):
    """Convert to float, returning None for empty/invalid."""
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def import_year(year, name_to_id, data_dir):
    """Import a single year's CSV into PlayerStat."""
    path = os.path.join(data_dir, f"player_stats_{year}.csv")
    if not os.path.exists(path):
        print(f"  {year}: file not found, skipping")
        return 0

    # Pre-load existing keys for this year to skip dupes
    existing = set(
        db.session.query(PlayerStat.player_id, PlayerStat.round)
        .filter_by(year=year)
        .all()
    )

    created = 0
    skipped_name = 0
    skipped_round = 0
    skipped_dupe = 0
    batch = []

    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("Player", "").strip()
            pid = name_to_id.get(name)
            if not pid:
                skipped_name += 1
                continue

            rnd = parse_round(row.get("Round", ""))
            if rnd is None:
                skipped_round += 1
                continue

            if (pid, rnd) in existing:
                skipped_dupe += 1
                continue

            stat = PlayerStat(
                player_id=pid,
                year=year,
                round=rnd,
            )
            # Map CSV columns to model attributes
            for csv_col, attr in COL_MAP.items():
                val = row.get(csv_col)
                if attr in ("disposal_efficiency", "metres_gained", "time_on_ground_pct"):
                    setattr(stat, attr, safe_float(val))
                else:
                    setattr(stat, attr, safe_int(val))

            batch.append(stat)
            existing.add((pid, rnd))
            created += 1

            if len(batch) >= 500:
                db.session.bulk_save_objects(batch)
                db.session.commit()
                batch = []

    if batch:
        db.session.bulk_save_objects(batch)
        db.session.commit()

    print(f"  {year}: {created} imported, {skipped_dupe} dupes, {skipped_name} unmatched names, {skipped_round} bad rounds")
    return created


def main():
    # Determine which years to import
    if len(sys.argv) > 1:
        years = [int(y) for y in sys.argv[1:]]
    else:
        years = list(range(2013, 2026))

    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")

    with app.app_context():
        # Build name -> player_id lookup
        name_to_id = {}
        for p in AflPlayer.query.all():
            name_to_id[p.name] = p.id

        print(f"AflPlayer lookup: {len(name_to_id)} players")
        print(f"Importing years: {years}")

        total = 0
        for year in years:
            total += import_year(year, name_to_id, data_dir)

        print(f"\nDone! {total} total rows imported.")
        print(f"PlayerStat total: {PlayerStat.query.count()}")


if __name__ == "__main__":
    main()

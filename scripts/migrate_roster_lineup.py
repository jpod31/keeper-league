"""Migration: Add lineup columns to fantasy_roster table.

Adds position_code, is_captain, is_vice_captain, is_emergency, is_benched
so the roster row itself carries lineup state (replacing WeeklyLineup/LineupSlot
for the field view).

Usage:
    python scripts/migrate_roster_lineup.py
"""

import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

DB_PATH = os.path.join(config.DATA_DIR, "keeper_league.db")

COLUMNS = [
    ("position_code",   "VARCHAR(10)"),
    ("is_captain",      "BOOLEAN DEFAULT 0"),
    ("is_vice_captain", "BOOLEAN DEFAULT 0"),
    ("is_emergency",    "BOOLEAN DEFAULT 0"),
    ("is_benched",      "BOOLEAN DEFAULT 1"),
]


def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found — will be created on next app start.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(fantasy_roster)")
    existing = {row[1] for row in cursor.fetchall()}

    for col_name, col_def in COLUMNS:
        if col_name not in existing:
            cursor.execute(
                f"ALTER TABLE fantasy_roster ADD COLUMN {col_name} {col_def}"
            )
            print(f"Added {col_name} column to fantasy_roster.")
        else:
            print(f"{col_name} column already exists.")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    migrate()

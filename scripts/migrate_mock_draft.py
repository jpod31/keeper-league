"""Migration: Add is_mock column to draft_session table.

Usage:
    python scripts/migrate_mock_draft.py
"""

import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

DB_PATH = os.path.join(config.DATA_DIR, "keeper_league.db")


def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found — will be created on next app start.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(draft_session)")
    columns = [row[1] for row in cursor.fetchall()]

    if "is_mock" not in columns:
        cursor.execute(
            "ALTER TABLE draft_session ADD COLUMN is_mock BOOLEAN DEFAULT 0"
        )
        print("Added is_mock column to draft_session.")
    else:
        print("is_mock column already exists.")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    migrate()

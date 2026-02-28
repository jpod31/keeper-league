"""Migration: Add invite_code column to league table and backfill existing leagues.

Usage:
    python scripts/migrate_invite_code.py
"""

import os
import sys
import sqlite3
import secrets
import string

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

DB_PATH = os.path.join(config.DATA_DIR, "keeper_league.db")


def _gen_code():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(8))


def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found — will be created on next app start.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(league)")
    columns = [row[1] for row in cursor.fetchall()]

    if "invite_code" not in columns:
        cursor.execute(
            "ALTER TABLE league ADD COLUMN invite_code VARCHAR(12)"
        )
        print("Added invite_code column to league.")
    else:
        print("invite_code column already exists.")

    # Backfill any leagues without an invite code
    cursor.execute("SELECT id FROM league WHERE invite_code IS NULL")
    rows = cursor.fetchall()
    used_codes = set()
    for (league_id,) in rows:
        code = _gen_code()
        while code in used_codes:
            code = _gen_code()
        used_codes.add(code)
        cursor.execute("UPDATE league SET invite_code = ? WHERE id = ?", (code, league_id))
        print(f"  League {league_id} -> {code}")

    if not rows:
        print("All leagues already have invite codes.")

    # Create unique index if not exists
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='index' AND name='ix_league_invite_code'
    """)
    if not cursor.fetchone():
        cursor.execute("CREATE UNIQUE INDEX ix_league_invite_code ON league(invite_code)")
        print("Created unique index on invite_code.")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    migrate()

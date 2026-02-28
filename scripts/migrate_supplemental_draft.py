"""Migration: Add draft_round_type column to draft_session table.

SQLite doesn't support DROP CONSTRAINT, so the unique constraint on league_id
remains in the table definition but we work around it by deleting completed
sessions before creating supplemental ones (or recreating the table).

This script just adds the new column if it doesn't exist.

Usage:
    python scripts/migrate_supplemental_draft.py
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

    if "draft_round_type" not in columns:
        cursor.execute(
            "ALTER TABLE draft_session ADD COLUMN draft_round_type VARCHAR(20) DEFAULT 'initial'"
        )
        print("Added draft_round_type column to draft_session.")
    else:
        print("draft_round_type column already exists.")

    # SQLite doesn't support dropping unique constraints directly.
    # For existing databases with the unique constraint on league_id,
    # we need to recreate the table. Check if the constraint exists.
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='draft_session'")
    create_sql = cursor.fetchone()
    if create_sql and "UNIQUE" in create_sql[0] and "league_id" in create_sql[0]:
        print("Recreating draft_session table to remove unique constraint on league_id...")
        cursor.execute("ALTER TABLE draft_session RENAME TO draft_session_old")
        cursor.execute("""
            CREATE TABLE draft_session (
                id INTEGER PRIMARY KEY,
                league_id INTEGER NOT NULL REFERENCES league(id),
                status VARCHAR(20) DEFAULT 'scheduled',
                draft_type VARCHAR(10) DEFAULT 'snake',
                draft_round_type VARCHAR(20) DEFAULT 'initial',
                pick_timer_secs INTEGER DEFAULT 120,
                current_pick INTEGER DEFAULT 1,
                current_round INTEGER DEFAULT 1,
                scheduled_start DATETIME,
                started_at DATETIME,
                completed_at DATETIME,
                total_rounds INTEGER
            )
        """)
        cursor.execute("CREATE INDEX ix_draft_session_league_id ON draft_session(league_id)")
        cursor.execute("""
            INSERT INTO draft_session (id, league_id, status, draft_type, draft_round_type,
                pick_timer_secs, current_pick, current_round, scheduled_start,
                started_at, completed_at, total_rounds)
            SELECT id, league_id, status, draft_type,
                COALESCE(draft_round_type, 'initial'),
                pick_timer_secs, current_pick, current_round, scheduled_start,
                started_at, completed_at, total_rounds
            FROM draft_session_old
        """)
        cursor.execute("DROP TABLE draft_session_old")
        print("Table recreated successfully.")
    else:
        print("No unique constraint to remove (or table doesn't exist yet).")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    migrate()

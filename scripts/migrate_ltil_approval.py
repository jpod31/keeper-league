"""Idempotent migration: add status and reviewed_at columns to long_term_injury."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from models.database import db

app = create_app()

with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    # Check existing columns
    cur.execute("PRAGMA table_info(long_term_injury)")
    cols = {row[1] for row in cur.fetchall()}

    if "status" not in cols:
        cur.execute("ALTER TABLE long_term_injury ADD COLUMN status VARCHAR(20) DEFAULT 'approved'")
        print("Added 'status' column (default='approved').")
    else:
        print("'status' column already exists.")

    if "reviewed_at" not in cols:
        cur.execute("ALTER TABLE long_term_injury ADD COLUMN reviewed_at DATETIME")
        print("Added 'reviewed_at' column.")
    else:
        print("'reviewed_at' column already exists.")

    conn.commit()
    conn.close()
    print("Migration complete.")

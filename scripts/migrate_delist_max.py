"""Idempotent migration: add max_delists column to delist_period."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from models.database import db

app = create_app()

with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(delist_period)")
    cols = {row[1] for row in cur.fetchall()}

    if "max_delists" not in cols:
        # NULL = no upper cap (back-compat for existing offseason periods).
        cur.execute("ALTER TABLE delist_period ADD COLUMN max_delists INTEGER")
        print("Added 'max_delists' column to delist_period.")
    else:
        print("'max_delists' column already exists on delist_period.")

    conn.commit()
    conn.close()
    print("Migration complete.")

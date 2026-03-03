"""Idempotent migration: add period_type to delist_period, supplemental_draft_date to season_config."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from models.database import db

app = create_app()

with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    # DelistPeriod: add period_type
    cur.execute("PRAGMA table_info(delist_period)")
    dp_cols = {row[1] for row in cur.fetchall()}

    if "period_type" not in dp_cols:
        cur.execute('ALTER TABLE delist_period ADD COLUMN period_type VARCHAR(20) DEFAULT "offseason"')
        print("Added 'period_type' column to delist_period.")
    else:
        print("'period_type' column already exists on delist_period.")

    # SeasonConfig: add supplemental_draft_date
    cur.execute("PRAGMA table_info(season_config)")
    sc_cols = {row[1] for row in cur.fetchall()}

    if "supplemental_draft_date" not in sc_cols:
        cur.execute("ALTER TABLE season_config ADD COLUMN supplemental_draft_date DATETIME")
        print("Added 'supplemental_draft_date' column to season_config.")
    else:
        print("'supplemental_draft_date' column already exists on season_config.")

    conn.commit()
    conn.close()
    print("Migration complete.")

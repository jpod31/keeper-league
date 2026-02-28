"""Migration script: Create future_draft_pick table, add future_pick_id to trade_asset,
and generate initial future picks for all existing leagues.

Usage:
    python scripts/migrate_future_picks.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models.database import db, League, FutureDraftPick
from models.season_manager import generate_future_picks
from sqlalchemy import inspect, text


def migrate():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()

        # 1. Create future_draft_pick table if it doesn't exist
        if "future_draft_pick" not in tables:
            print("Creating future_draft_pick table...")
            FutureDraftPick.__table__.create(db.engine)
            print("  Done.")
        else:
            print("future_draft_pick table already exists.")

        # 2. Add future_pick_id column to trade_asset if missing
        if "trade_asset" in tables:
            existing_cols = {c["name"] for c in inspector.get_columns("trade_asset")}
            if "future_pick_id" not in existing_cols:
                print("Adding future_pick_id column to trade_asset...")
                db.session.execute(
                    text("ALTER TABLE trade_asset ADD COLUMN future_pick_id INTEGER REFERENCES future_draft_pick(id)")
                )
                db.session.commit()
                print("  Done.")
            else:
                print("trade_asset.future_pick_id column already exists.")

        # 3. Generate initial future picks for all existing leagues
        leagues = League.query.all()
        for league in leagues:
            start_year = league.season_year + 1
            existing = FutureDraftPick.query.filter_by(league_id=league.id).first()
            if existing:
                print(f"League '{league.name}' (id={league.id}): future picks already exist, skipping.")
                continue
            count = generate_future_picks(league.id, start_year, num_years=3)
            print(f"League '{league.name}' (id={league.id}): generated {count} future draft picks for {start_year}-{start_year + 2}.")

        print("\nMigration complete!")


if __name__ == "__main__":
    migrate()

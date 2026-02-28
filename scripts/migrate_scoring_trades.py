"""Migration script: Add new stat columns to player_stat, trade window date columns
to season_config, and hybrid_base to league.

Idempotent — safe to run multiple times.

Usage:
    python scripts/migrate_scoring_trades.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models.database import db
from sqlalchemy import inspect, text


def migrate():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()

        # 1. Add 12 new stat columns to player_stat
        if "player_stat" in tables:
            existing = {c["name"] for c in inspector.get_columns("player_stat")}
            new_cols = [
                ("frees_for", "INTEGER"),
                ("frees_against", "INTEGER"),
                ("contested_marks", "INTEGER"),
                ("marks_inside_50", "INTEGER"),
                ("one_percenters", "INTEGER"),
                ("bounces", "INTEGER"),
                ("goal_assists", "INTEGER"),
                ("time_on_ground_pct", "FLOAT"),
                ("centre_clearances", "INTEGER"),
                ("stoppage_clearances", "INTEGER"),
                ("turnovers", "INTEGER"),
                ("kick_ins", "INTEGER"),
            ]
            added = 0
            for col_name, col_def in new_cols:
                if col_name not in existing:
                    print(f"  Adding player_stat.{col_name}...")
                    db.session.execute(
                        text(f"ALTER TABLE player_stat ADD COLUMN {col_name} {col_def}")
                    )
                    added += 1
            if added:
                db.session.commit()
                print(f"  Added {added} columns to player_stat.")
            else:
                print("  player_stat: all stat columns already exist.")

        # 2. Add 5 trade window date columns to season_config
        if "season_config" in tables:
            existing = {c["name"] for c in inspector.get_columns("season_config")}
            date_cols = [
                ("mid_trade_window_open", "DATETIME"),
                ("mid_trade_window_close", "DATETIME"),
                ("mid_draft_date", "DATETIME"),
                ("off_trade_window_open", "DATETIME"),
                ("off_trade_window_close", "DATETIME"),
            ]
            added = 0
            for col_name, col_def in date_cols:
                if col_name not in existing:
                    print(f"  Adding season_config.{col_name}...")
                    db.session.execute(
                        text(f"ALTER TABLE season_config ADD COLUMN {col_name} {col_def}")
                    )
                    added += 1
            if added:
                db.session.commit()
                print(f"  Added {added} columns to season_config.")
            else:
                print("  season_config: all date columns already exist.")

        # 3. Add hybrid_base column to league
        if "league" in tables:
            existing = {c["name"] for c in inspector.get_columns("league")}
            if "hybrid_base" not in existing:
                print("  Adding league.hybrid_base...")
                db.session.execute(
                    text("ALTER TABLE league ADD COLUMN hybrid_base VARCHAR(20)")
                )
                db.session.commit()
                print("  Done.")
            else:
                print("  league.hybrid_base already exists.")

        print("\nMigration complete.")


if __name__ == "__main__":
    migrate()

"""One-time idempotent CSV → SQLite migration.

Imports:
  - data/players.csv          → afl_player
  - data/sc_scores_YYYY.csv   → sc_score
  - data/player_stats_YYYY.csv→ player_stat
  - data/league/teams.json    → (legacy, kept for backward compat)

Usage:
    python scripts/migrate_to_sqlite.py
"""

import os
import sys
import json

import pandas as pd

# Allow running from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from models.database import db, AflPlayer, ScScore, PlayerStat, init_db

from flask import Flask


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = config.SQLALCHEMY_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = config.SECRET_KEY
    init_db(app)
    return app


def migrate_players(app):
    """Import players.csv into afl_player table."""
    path = os.path.join(config.DATA_DIR, "players.csv")
    if not os.path.exists(path):
        print("  [skip] players.csv not found")
        return 0

    df = pd.read_csv(path)
    count = 0

    with app.app_context():
        for _, row in df.iterrows():
            name = str(row.get("name", "")).strip()
            team = str(row.get("team", "")).strip()
            if not name:
                continue

            # Upsert: check if exists
            existing = AflPlayer.query.filter_by(name=name, afl_team=team).first()
            if existing:
                existing.position = row.get("position")
                existing.age = _int_or_none(row.get("age"))
                existing.dob = str(row.get("dob", "")) if pd.notna(row.get("dob")) else None
                existing.career_games = _int_or_none(row.get("games"))
                existing.height_cm = _int_or_none(row.get("height"))
                existing.sc_avg = _float_or_none(row.get("sc_avg"))
                existing.sc_avg_prev = _float_or_none(row.get("sc_avg_prev"))
                existing.games_played = _int_or_none(row.get("games_played"))
                existing.draft_score = _float_or_none(row.get("draft_score"))
            else:
                player = AflPlayer(
                    name=name,
                    afl_team=team,
                    position=row.get("position"),
                    age=_int_or_none(row.get("age")),
                    dob=str(row.get("dob", "")) if pd.notna(row.get("dob")) else None,
                    career_games=_int_or_none(row.get("games")),
                    height_cm=_int_or_none(row.get("height")),
                    sc_avg=_float_or_none(row.get("sc_avg")),
                    sc_avg_prev=_float_or_none(row.get("sc_avg_prev")),
                    games_played=_int_or_none(row.get("games_played")),
                    draft_score=_float_or_none(row.get("draft_score")),
                )
                db.session.add(player)
            count += 1

        db.session.commit()
    print(f"  [done] {count} players migrated")
    return count


def migrate_sc_scores(app):
    """Import sc_scores_YYYY.csv files into sc_score table."""
    total = 0
    with app.app_context():
        # Build name→id lookup
        player_map = {p.name: p.id for p in AflPlayer.query.all()}

        for year in config.SC_HISTORY_YEARS:
            path = os.path.join(config.DATA_DIR, f"sc_scores_{year}.csv")
            if not os.path.exists(path):
                continue

            df = pd.read_csv(path)
            count = 0
            for _, row in df.iterrows():
                name = str(row.get("name", "")).strip()
                player_id = player_map.get(name)
                if not player_id:
                    continue

                rnd = _int_or_none(row.get("round"))
                score = _int_or_none(row.get("sc_score"))
                if rnd is None:
                    continue

                existing = ScScore.query.filter_by(
                    player_id=player_id, year=year, round=rnd
                ).first()
                if not existing:
                    db.session.add(ScScore(
                        player_id=player_id,
                        year=year,
                        round=rnd,
                        sc_score=score,
                    ))
                    count += 1

            db.session.commit()
            print(f"  [done] sc_scores_{year}: {count} new rows")
            total += count

    return total


def migrate_player_stats(app):
    """Import player_stats_YYYY.csv files into player_stat table."""
    total = 0
    stat_columns = [
        "kicks", "handballs", "disposals", "marks", "goals", "behinds",
        "tackles", "hitouts", "contested_possessions", "uncontested_possessions",
        "clearances", "clangers", "inside_fifties", "rebounds",
        "effective_disposals", "disposal_efficiency", "metres_gained",
        "pressure_acts", "ground_ball_gets", "intercepts", "score_involvements",
        "supercoach_score", "afl_fantasy_score",
    ]

    # Column name mapping from fitzRoy CSVs to our schema
    col_map = {
        "Player": "name", "player_name": "name",
        "Team": "team", "Round": "round",
        "Kicks": "kicks", "Handballs": "handballs",
        "Disposals": "disposals", "Marks": "marks",
        "Goals": "goals", "Behinds": "behinds",
        "Tackles": "tackles", "Hit.Outs": "hitouts", "Hitouts": "hitouts",
        "Contested.Possessions": "contested_possessions",
        "Uncontested.Possessions": "uncontested_possessions",
        "Clearances": "clearances", "Clangers": "clangers",
        "Inside.50s": "inside_fifties", "Rebounds": "rebounds",
        "Effective.Disposals": "effective_disposals",
        "Disposal.Efficiency": "disposal_efficiency",
        "Metres.Gained": "metres_gained",
        "Pressure.Acts": "pressure_acts",
        "Ground.Ball.Gets": "ground_ball_gets",
        "Intercepts": "intercepts",
        "Score.Involvements": "score_involvements",
        "SC": "supercoach_score", "SuperCoach": "supercoach_score",
        "AF": "afl_fantasy_score", "AFL.Fantasy": "afl_fantasy_score",
    }

    with app.app_context():
        player_map = {p.name: p.id for p in AflPlayer.query.all()}

        for year in config.SC_HISTORY_YEARS:
            path = os.path.join(config.DATA_DIR, f"player_stats_{year}.csv")
            if not os.path.exists(path):
                continue

            df = pd.read_csv(path)
            # Rename columns to our schema
            df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
            count = 0

            for _, row in df.iterrows():
                name = str(row.get("name", "")).strip()
                player_id = player_map.get(name)
                if not player_id:
                    continue

                rnd = _int_or_none(row.get("round"))
                if rnd is None:
                    continue

                existing = PlayerStat.query.filter_by(
                    player_id=player_id, year=year, round=rnd
                ).first()
                if existing:
                    continue

                stat = PlayerStat(player_id=player_id, year=year, round=rnd)
                for col in stat_columns:
                    val = row.get(col)
                    if pd.notna(val) if isinstance(val, float) else val is not None:
                        if col == "disposal_efficiency" or col == "metres_gained":
                            setattr(stat, col, _float_or_none(val))
                        else:
                            setattr(stat, col, _int_or_none(val))

                db.session.add(stat)
                count += 1

            db.session.commit()
            print(f"  [done] player_stats_{year}: {count} new rows")
            total += count

    return total


def _int_or_none(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _float_or_none(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def migrate_live_scoring_schema(app):
    """Add live-scoring tables and columns (idempotent ALTER TABLE)."""
    with app.app_context():
        conn = db.engine.raw_connection()
        cur = conn.cursor()

        # 1. AflGame table (created by create_all, but ensure it exists for older DBs)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS afl_game (
                id INTEGER PRIMARY KEY,
                year INTEGER NOT NULL,
                afl_round INTEGER NOT NULL,
                home_team VARCHAR(40) NOT NULL,
                away_team VARCHAR(40) NOT NULL,
                venue VARCHAR(80),
                scheduled_start DATETIME,
                status VARCHAR(20) DEFAULT 'scheduled',
                home_score INTEGER,
                away_score INTEGER,
                updated_at DATETIME,
                UNIQUE(year, afl_round, home_team)
            )
        """)

        # 2. LiveScoringConfig table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS live_scoring_config (
                league_id INTEGER PRIMARY KEY REFERENCES league(id),
                enabled BOOLEAN DEFAULT 1,
                poll_interval_seconds INTEGER DEFAULT 120,
                lockout_type VARCHAR(20) DEFAULT 'game_start'
            )
        """)

        # 3. Add is_live column to player_stat (ignore if already exists)
        try:
            cur.execute("ALTER TABLE player_stat ADD COLUMN is_live BOOLEAN DEFAULT 0")
        except Exception:
            pass  # column already exists

        conn.commit()
        conn.close()
        print("  [done] Live scoring schema migration complete")


def migrate_ssp_cutoff_round(app):
    """Add ssp_cutoff_round column to season_config (idempotent)."""
    with app.app_context():
        conn = db.engine.raw_connection()
        cur = conn.cursor()
        try:
            cur.execute("ALTER TABLE season_config ADD COLUMN ssp_cutoff_round INTEGER DEFAULT 4")
        except Exception:
            pass  # column already exists
        conn.commit()
        conn.close()
        print("  [done] ssp_cutoff_round migration complete")


def migrate_draft_pick_is_pass(app):
    """Add is_pass column to draft_pick table (idempotent)."""
    with app.app_context():
        conn = db.engine.raw_connection()
        cur = conn.cursor()
        try:
            cur.execute("ALTER TABLE draft_pick ADD COLUMN is_pass BOOLEAN DEFAULT 0")
        except Exception:
            pass  # column already exists
        conn.commit()
        conn.close()
        print("  [done] draft_pick is_pass migration complete")


def main():
    print("=== Keeper League CSV -> SQLite Migration ===\n")
    os.makedirs(config.DATA_DIR, exist_ok=True)

    app = create_app()

    print("1. Migrating players...")
    migrate_players(app)

    print("\n2. Migrating SC scores...")
    migrate_sc_scores(app)

    print("\n3. Migrating player stats...")
    migrate_player_stats(app)

    print("\n4. Migrating live scoring schema...")
    migrate_live_scoring_schema(app)

    print("\n5. Migrating SSP cutoff round...")
    migrate_ssp_cutoff_round(app)

    print("\n6. Migrating draft_pick is_pass...")
    migrate_draft_pick_is_pass(app)

    print("\n=== Migration complete! ===")
    db_path = os.path.join(config.DATA_DIR, "keeper_league.db")
    if os.path.exists(db_path):
        size_mb = os.path.getsize(db_path) / (1024 * 1024)
        print(f"Database: {db_path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()

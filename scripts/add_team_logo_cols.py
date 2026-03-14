"""Add logo_url and logo_prompt columns to fantasy_team table."""

import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from models.database import db, init_db
from flask import Flask


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = config.SQLALCHEMY_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    init_db(app)
    return app


def migrate():
    app = create_app()
    with app.app_context():
        conn = db.engine.raw_connection()
        cur = conn.cursor()

        # Check existing columns
        cur.execute("PRAGMA table_info(fantasy_team)")
        cols = {row[1] for row in cur.fetchall()}

        if "logo_url" not in cols:
            cur.execute("ALTER TABLE fantasy_team ADD COLUMN logo_url VARCHAR(300)")
            print("Added logo_url column")
        else:
            print("logo_url already exists")

        if "logo_prompt" not in cols:
            cur.execute("ALTER TABLE fantasy_team ADD COLUMN logo_prompt VARCHAR(500)")
            print("Added logo_prompt column")
        else:
            print("logo_prompt already exists")

        conn.commit()
        conn.close()
        print("Done!")


if __name__ == "__main__":
    migrate()

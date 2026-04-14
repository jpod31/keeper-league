"""Import state league stats from wheeloratings.com.

Usage:
    python scripts/import_state_league_stats.py              # all comps, all years
    python scripts/import_state_league_stats.py vfl 2026     # specific
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from models.database import db
from scrapers.state_league_scraper import sync_state_league_stats

app = create_app()
with app.app_context():
    db.create_all()
    comp = sys.argv[1] if len(sys.argv) > 1 else None
    season = int(sys.argv[2]) if len(sys.argv) > 2 else None
    count = sync_state_league_stats(comp=comp, season=season)
    print(f"Synced {count} state league stat rows.")

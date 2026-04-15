#!/usr/bin/env python3
"""Import state league stats from DFS Australia.

Usage:
    python scripts/import_dfsaustralia.py                    # all leagues, all years
    python scripts/import_dfsaustralia.py SANFL 2026         # specific league/year
    python scripts/import_dfsaustralia.py NAB                # all NAB/Coates years
    python scripts/import_dfsaustralia.py --no-logs          # skip per-game log fetching (faster)
"""

import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

from app import create_app
from scrapers.dfsaustralia_scraper import sync_dfsaustralia

app = create_app()

with app.app_context():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    fetch_logs = "--no-logs" not in flags

    league = args[0].upper() if len(args) >= 1 else None
    season = int(args[1]) if len(args) >= 2 else None

    if league and league not in ("SANFL", "NAB"):
        print(f"Unknown league: {league}. Use SANFL or NAB.")
        sys.exit(1)

    print(f"Syncing DFS Australia: league={league or 'all'}, season={season or 'all'}, logs={fetch_logs}")
    count = sync_dfsaustralia(league=league, season=season, fetch_logs=fetch_logs)
    print(f"Done — synced {count} rows.")

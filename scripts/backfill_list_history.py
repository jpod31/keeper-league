#!/usr/bin/env python3
"""Create the afl_list_history table (if missing) and backfill it from draftguru.

draftguru.com.au is the only source that records a player's AFL club for seasons
they were list-only (no senior games) — e.g. delisted-then-redrafted players.
This populates the "AFL Career" timeline on player profiles.

Usage:
    python scripts/backfill_list_history.py             # all matched players
    python scripts/backfill_list_history.py --limit 5   # test on a handful
"""

import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

from app import create_app

app = create_app()

with app.app_context():
    from models.database import db
    # create_all() only creates missing tables; it never alters/drops existing ones.
    db.create_all()
    print("Ensured afl_list_history table exists.")

    from scrapers.draftguru_scraper import sync_draftguru_list_history

    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    matched, rows = sync_draftguru_list_history(limit=limit)
    print(f"Done: {matched} players matched, {rows} list-history rows written.")

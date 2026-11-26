#!/usr/bin/env python3
"""Fill the pre-AFL profile facts (pathway, junior honours, draft pick) from
draftguru for every listed player with no AFL games.

    python scripts/sync_draftguru_profiles.py
"""
import os
import sys
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

from app import create_app
from scrapers.draftguru_scraper import sync_draftguru_profiles

app = create_app()
with app.app_context():
    print("updated", sync_draftguru_profiles())

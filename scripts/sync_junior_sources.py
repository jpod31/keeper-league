#!/usr/bin/env python3
"""Pull WAFL (Colts, Reserves, League) and under-18 championship numbers for
every listed player with no AFL games, or with --since YEAR for every listed
player drafted that year or later. See scrapers/junior_sources.py.

    python scripts/sync_junior_sources.py
    python scripts/sync_junior_sources.py --since 2019
"""
import argparse
import os
import sys
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

from app import create_app
from scrapers.junior_sources import sync_junior_sources

ap = argparse.ArgumentParser()
ap.add_argument("--since", type=int, default=None)
args = ap.parse_args()

app = create_app()
with app.app_context():
    print("players, rows:", sync_junior_sources(drafted_since=args.since))

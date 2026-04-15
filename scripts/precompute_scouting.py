#!/usr/bin/env python3
"""Precompute scouting model predictions for all current-year state league players.

Stores predicted_afl_sc, breakout_probability, draft_probability, and scouting_tag
directly on StateLeagueStat rows so analytics pages can read them instantly.

Usage:
    python scripts/precompute_scouting.py           # current year
    python scripts/precompute_scouting.py 2025      # specific year
"""

import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

from app import create_app
app = create_app()

with app.app_context():
    import config
    from models.database import db, StateLeagueStat
    from models.scouting_model import predict_afl_output

    year = int(sys.argv[1]) if len(sys.argv) > 1 else config.CURRENT_YEAR

    rows = StateLeagueStat.query.filter_by(season=year).filter(
        StateLeagueStat.matches >= 2
    ).all()
    logger.info("Processing %d state league rows for %d", len(rows), year)

    updated = 0
    errors = 0
    for i, sl in enumerate(rows):
        try:
            pred = predict_afl_output(sl_row=sl)
            if pred:
                sl.predicted_afl_sc = pred["predicted_afl"].get("afl_sc_avg")
                sl.breakout_probability = pred["breakout_probability"]
                sl.draft_probability = pred.get("draft_probability")
                sl.scouting_tag = pred.get("tag")
                updated += 1
            else:
                sl.predicted_afl_sc = None
                sl.breakout_probability = None
                sl.draft_probability = None
                sl.scouting_tag = None
        except Exception as e:
            errors += 1
            if errors <= 5:
                logger.warning("Error for %s: %s", sl.player_name, e)

        if (i + 1) % 200 == 0:
            db.session.commit()
            logger.info("  %d/%d processed...", i + 1, len(rows))

    db.session.commit()
    logger.info("Done: %d updated, %d errors out of %d rows", updated, errors, len(rows))

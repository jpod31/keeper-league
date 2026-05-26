"""Open the mid-season trade window + delist period for the live season.

Idempotent: re-running just confirms current state without duplicating.

Defaults (override via CLI args):
  --league-id 1                # the main league
  --year 2026                  # current season year
  --close 2026-05-28T17:00     # AEST close time (Thursday 5pm)

The trade window close is stored UTC. AEST is UTC+10 (no DST in
winter), so 17:00 AEST = 07:00 UTC same day.

Delist period is opened with type='midseason', min_delists=0
(no forced delist) and max_delists=2 (cap to prevent gutting).
"""

import argparse
import sys
import os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from models.database import db, League, SeasonConfig, DelistPeriod


def aest_to_utc(dt_naive_aest):
    """AEST is UTC+10 year-round (Australia/Brisbane convention).
    For Melbourne/Sydney this is correct in winter; in summer those
    cities are AEDT (UTC+11) — adjust if running late-Oct to early-Apr."""
    return (dt_naive_aest - timedelta(hours=10)).replace(tzinfo=timezone.utc)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league-id", type=int, default=1)
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument(
        "--close", default="2026-05-28T17:00",
        help="AEST close time in YYYY-MM-DDTHH:MM",
    )
    parser.add_argument(
        "--max-delists", type=int, default=2,
        help="Max delists per team during the mid-season period.",
    )
    args = parser.parse_args()

    close_aest = datetime.fromisoformat(args.close)
    close_utc = aest_to_utc(close_aest)
    open_utc = datetime.now(timezone.utc)

    app = create_app()
    with app.app_context():
        league = db.session.get(League, args.league_id)
        if not league:
            print(f"ERROR: League {args.league_id} not found.")
            sys.exit(1)

        # 1. Set the mid-season trade window dates on SeasonConfig.
        cfg = SeasonConfig.query.filter_by(
            league_id=args.league_id, year=args.year
        ).first()
        if not cfg:
            cfg = SeasonConfig(league_id=args.league_id, year=args.year)
            db.session.add(cfg)
            db.session.flush()
            print(f"Created SeasonConfig for league {args.league_id}, year {args.year}.")

        cfg.mid_season_trade_enabled = True
        cfg.mid_season_trade_mode = "window"
        cfg.mid_trade_window_open = open_utc
        cfg.mid_trade_window_close = close_utc
        db.session.commit()
        print(
            f"Trade window: opens {open_utc.isoformat()} UTC, "
            f"closes {close_utc.isoformat()} UTC "
            f"({close_aest.isoformat()} AEST)."
        )

        # 2. Open a mid-season delist period (idempotent — bail if one
        # already exists for this league/year and is still open).
        existing = DelistPeriod.query.filter_by(
            league_id=args.league_id, year=args.year, status="open"
        ).first()
        if existing:
            # If it exists, ensure max_delists is set correctly.
            if existing.max_delists != args.max_delists:
                existing.max_delists = args.max_delists
                db.session.commit()
                print(
                    f"Updated existing open delist period (id={existing.id}) "
                    f"max_delists -> {args.max_delists}."
                )
            else:
                print(
                    f"Delist period already open (id={existing.id}, "
                    f"type={existing.period_type}, max={existing.max_delists}). "
                    f"No change."
                )
        else:
            period = DelistPeriod(
                league_id=args.league_id,
                year=args.year,
                status="open",
                opens_at=open_utc,
                closes_at=close_utc,
                min_delists=0,
                max_delists=args.max_delists,
                period_type="midseason",
            )
            db.session.add(period)
            db.session.commit()
            print(
                f"Opened mid-season delist period (id={period.id}, "
                f"min=0, max={args.max_delists}, closes {close_utc.isoformat()} UTC)."
            )

        print("Done.")


if __name__ == "__main__":
    main()

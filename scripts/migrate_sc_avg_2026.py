"""One-time migration: shift sc_avg (2025) → sc_avg_prev, recompute sc_avg from 2026 PlayerStat data,
and backfill ScScore rows from PlayerStat 2026 records.

Run on server after deploying the new live_sync code:
    cd /opt/keeper-league && python scripts/migrate_sc_avg_2026.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models.database import db, AflPlayer, PlayerStat, ScScore

YEAR = 2026

app = create_app()

with app.app_context():
    # 1. Shift current sc_avg → sc_avg_prev (preserve 2025 data as previous year)
    players = AflPlayer.query.all()
    shifted = 0
    for p in players:
        if p.sc_avg is not None:
            p.sc_avg_prev = p.sc_avg
            shifted += 1
    db.session.commit()
    print(f"Step 1: Shifted sc_avg → sc_avg_prev for {shifted} players")

    # 2. Backfill ScScore rows from existing PlayerStat 2026 data
    stats = PlayerStat.query.filter(
        PlayerStat.year == YEAR,
        PlayerStat.supercoach_score.isnot(None),
    ).all()

    inserted = 0
    for s in stats:
        existing = ScScore.query.filter_by(
            player_id=s.player_id, year=YEAR, round=s.round
        ).first()
        if existing:
            existing.sc_score = s.supercoach_score
        else:
            db.session.add(ScScore(
                player_id=s.player_id,
                year=YEAR,
                round=s.round,
                sc_score=s.supercoach_score,
            ))
            inserted += 1
    db.session.commit()
    print(f"Step 2: Synced {len(stats)} PlayerStat rows to ScScore ({inserted} new)")

    # 3. Recompute sc_avg from 2026 PlayerStat data
    from models.live_sync import recompute_sc_averages
    updated = recompute_sc_averages(YEAR)
    print(f"Step 3: Recomputed sc_avg for {updated} players with 2026 data")

    # 4. Summary
    with_avg = AflPlayer.query.filter(AflPlayer.sc_avg.isnot(None)).count()
    with_prev = AflPlayer.query.filter(AflPlayer.sc_avg_prev.isnot(None)).count()
    total = AflPlayer.query.count()
    print(f"\nDone! {total} total players: {with_avg} with 2026 sc_avg, {with_prev} with sc_avg_prev (2025)")

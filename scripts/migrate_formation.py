"""Migrate existing leagues to the new 5-7-5-1 + 5 bench formation.

Updates LeaguePositionSlot rows and resets roster position assignments
so the field view auto-fills correctly.

Run from project root:
    python scripts/migrate_formation.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models.database import db, LeaguePositionSlot, FantasyRoster, League

app = create_app()

NEW_SLOTS = [
    ("DEF", 5, False),
    ("MID", 7, False),
    ("FWD", 5, False),
    ("RUC", 1, False),
    ("BENCH", 5, True),
]

with app.app_context():
    leagues = League.query.all()
    for league in leagues:
        print(f"\n=== League: {league.name} (id={league.id}) ===")

        # Update position slots
        old_slots = LeaguePositionSlot.query.filter_by(league_id=league.id).all()
        print(f"  Old slots: {[(s.position_code, s.count, s.is_bench) for s in old_slots]}")

        LeaguePositionSlot.query.filter_by(league_id=league.id).delete()
        for code, count, is_bench in NEW_SLOTS:
            db.session.add(LeaguePositionSlot(
                league_id=league.id,
                position_code=code,
                count=count,
                is_bench=is_bench,
            ))
        print(f"  New slots: {NEW_SLOTS}")

        # Reset all roster entries to reserve state (is_benched=True, position_code=None)
        # so the field view auto-fills based on ratings
        roster_entries = FantasyRoster.query.filter_by(is_active=True).join(
            FantasyRoster.team
        ).filter_by(league_id=league.id).all()

        reset_count = 0
        for r in roster_entries:
            r.position_code = None
            r.is_benched = True
            reset_count += 1

        print(f"  Reset {reset_count} roster entries to reserve state")

    db.session.commit()
    print("\nDone! All leagues migrated to 5-7-5-1 + 5 bench.")
    print("Load the field view to see the auto-filled formation.")

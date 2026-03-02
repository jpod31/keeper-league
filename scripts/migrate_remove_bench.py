"""Remove positional bench slots, absorb counts into field, keep FLEX.

For each league:
1. Find bench position slots (is_bench=1)
2. DEF/MID/FWD bench: add count to matching field slot, delete bench row
3. FLEX bench: keep as-is (sidebar FLEX)
4. Update roster entries: BENCH_DEF->DEF, BENCH_MID->MID, BENCH_FWD->FWD, BENCH_FLEX->FLEX
5. Recalculate on_field_count

Idempotent — safe to run multiple times.

Run from project root:
    python scripts/migrate_remove_bench.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models.database import db, LeaguePositionSlot, FantasyRoster, League

app = create_app()

ABSORB_POSITIONS = {"DEF", "MID", "FWD"}

with app.app_context():
    leagues = League.query.all()
    for league in leagues:
        print(f"\n=== League: {league.name} (id={league.id}) ===")

        slots = LeaguePositionSlot.query.filter_by(league_id=league.id).all()
        field_slots = {s.position_code: s for s in slots if not s.is_bench}
        bench_slots = [s for s in slots if s.is_bench]

        if not bench_slots:
            print("  No bench slots — skipping")
            continue

        absorbed = False
        for bs in bench_slots:
            if bs.position_code in ABSORB_POSITIONS:
                # Absorb into matching field slot
                fs = field_slots.get(bs.position_code)
                if fs:
                    print(f"  Absorb bench {bs.position_code} ({bs.count}) into field {fs.position_code} ({fs.count} -> {fs.count + bs.count})")
                    fs.count += bs.count
                    db.session.delete(bs)
                    absorbed = True
                else:
                    print(f"  WARN: No field slot for {bs.position_code}, converting bench to field")
                    bs.is_bench = False
                    absorbed = True
            elif bs.position_code == "FLEX":
                print(f"  Keep FLEX bench slot (count={bs.count})")
            elif bs.position_code == "RUC":
                # Absorb RUC bench into RUC field if present
                fs = field_slots.get("RUC")
                if fs:
                    print(f"  Absorb bench RUC ({bs.count}) into field RUC ({fs.count} -> {fs.count + bs.count})")
                    fs.count += bs.count
                    db.session.delete(bs)
                    absorbed = True
            else:
                # Unknown bench type — convert to FLEX
                print(f"  WARN: Unknown bench type {bs.position_code}, converting to FLEX")
                bs.position_code = "FLEX"

        # Update roster position codes
        roster_entries = FantasyRoster.query.filter_by(is_active=True).join(
            FantasyRoster.team
        ).filter_by(league_id=league.id).all()

        remap = {
            "BENCH_DEF": "DEF",
            "BENCH_MID": "MID",
            "BENCH_FWD": "FWD",
            "BENCH_RUC": "RUC",
            "BENCH_FLEX": "FLEX",
            "BENCH": "FLEX",
        }
        for r in roster_entries:
            if r.position_code in remap:
                old = r.position_code
                r.position_code = remap[old]
                r.is_benched = False
                print(f"  Roster {r.player_id}: {old} -> {r.position_code}")

        # Recalculate on_field_count from field slots
        updated_slots = LeaguePositionSlot.query.filter_by(
            league_id=league.id, is_bench=False
        ).all()
        new_on_field = sum(s.count for s in updated_slots)
        if league.on_field_count != new_on_field:
            print(f"  on_field_count: {league.on_field_count} -> {new_on_field}")
            league.on_field_count = new_on_field

        db.session.commit()
        print("  Done.")

    print("\nMigration complete.")

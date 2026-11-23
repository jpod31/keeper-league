"""Sync afl_player from the player workbook, with a full report.

    python scripts/sync_players.py --dry-run          # print the plan, write nothing
    python scripts/sync_players.py                    # apply it
    python scripts/sync_players.py --xlsx path.xlsx   # a workbook other than the configured one

Run the dry run first after every workbook refresh and read the "created" and
"former" lists: a player in both is one person the matcher failed to pair.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--xlsx")
    ap.add_argument("--year", type=int)
    args = ap.parse_args()

    # Stop create_app() running its own sync before we report.
    os.environ["RATINGS_XLSX_PATH"] = os.devnull + ".none"
    import config
    from app import create_app
    from models.database import db, FantasyRoster, FantasyTeam
    from models.player_sync import sync_players

    path = args.xlsx or os.environ.get("KL_WORKBOOK") or os.path.join(config.DATA_DIR, "ratings.xlsx")
    if not os.path.exists(path):
        sys.exit(f"Workbook not found: {path}")
    year = args.year or config.CURRENT_YEAR

    app = create_app()
    with app.app_context():
        owner = dict(
            db.session.query(FantasyRoster.player_id, FantasyTeam.name)
            .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
            .filter(FantasyRoster.is_active == True).all())

        plan, changed = sync_players(path, year, dry_run=args.dry_run)
        print(f"\nWorkbook: {path}\nSeason: {year}\n{plan.counts()}")
        if plan.retire_refused:
            print(f"\nNOBODY MARKED FORMER: {plan.retire_refused}")
        for w in plan.warnings:
            print("WARNING:", w)

        loose = [(p, r, h) for p, r, h in plan.matched if h not in ("exact", "nickname")]
        print(f"\nMatched by a looser rule ({len(loose)}):")
        for p, r, h in loose:
            print(f"  [{h}] {p.name} ({p.afl_team}, {p.age}) = {r.name} ({r.team}, {r.age})")

        print(f"\nChanged club ({len(plan.moved)}):")
        for p, r in plan.moved:
            print(f"  {p.name}: {p.afl_team} -> {r.team}" + (f"   [{owner[p.id]}]" if p.id in owner else ""))

        print(f"\nNew players ({len(plan.create)}):")
        for r in sorted(plan.create, key=lambda r: (-(r.rating or 0), r.name)):
            print(f"  {r.name} | {r.team} | {r.age} | {r.rating}/{r.potential} | "
                  f"expected {r.expected_position} ({r.role_detail or r.role})")

        print(f"\nOff AFL lists ({len(plan.former)}):")
        for p in plan.former:
            print(f"  {p.name} | {p.afl_team} | {p.age} | rating {p.rating} | avg {p.sc_avg}"
                  + (f"   [ON A LIST: {owner[p.id]}]" if p.id in owner else ""))

        if plan.skipped:
            print(f"\nSkipped rows ({len(plan.skipped)}):")
            for r, why in plan.skipped:
                print(f"  {r.name} ({r.team}): {why}")

        print("\nDRY RUN, nothing written." if args.dry_run else f"\nApplied: {changed}")


if __name__ == "__main__":
    main()

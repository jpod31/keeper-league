"""Move the site's player data onto a new AFL season, in the order that matters.

    python scripts/cutover_season.py --xlsx data/ratings.xlsx --dry-run
    python scripts/cutover_season.py --xlsx data/ratings.xlsx

Run once each November, after the player workbook has been rolled to the new
year (new ages, new clubs, draftees added, departed players removed) and
config.CURRENT_YEAR has been bumped to match.

  1. Opening squads. Any league whose first season has no start-of-year
     squads gets them rebuilt from its initial draft. This has to happen
     BEFORE step 2: it reads each player's age and start-of-year rating, and
     the sync is about to move both on a year.
  2. Player sync (models/player_sync.py): ratings, ages, clubs, new players
     with expected positions, departures marked former.
  3. Averages recomputed, so sc_avg / sc_avg_prev describe the latest season
     with games and the one before it.
  4. Cached analytics that depend on ages and ratings are dropped.

A league's own year is NOT touched here. It moves when its commissioner
starts the new season, after the off-season draft.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--xlsx", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not os.path.exists(args.xlsx):
        sys.exit(f"Workbook not found: {args.xlsx}")

    # Keep create_app() from running its own sync before the squads are saved.
    os.environ["RATINGS_XLSX_PATH"] = os.devnull + ".none"
    import config
    from app import create_app
    from models.database import db, League, AflPlayer, FantasyRoster, FantasyTeam
    from models.player_sync import sync_players
    from models.season_squads import backfill_first_season, has_snapshot

    app = create_app()
    with app.app_context():
        year = config.CURRENT_YEAR
        print(f"Cutover to the {year} AFL season" + (" (DRY RUN)" if args.dry_run else ""))

        print("\n1. Opening squads")
        for league in League.query.order_by(League.id).all():
            if args.dry_run:
                print(f"   league {league.id} {league.name}: would rebuild if missing")
                continue
            y, rows = backfill_first_season(league.id)
            if y is None:
                print(f"   league {league.id} {league.name}: no completed initial draft")
            elif rows:
                print(f"   league {league.id} {league.name}: {y} opening squads saved ({rows} players)")
            else:
                print(f"   league {league.id} {league.name}: {y} already saved")

        print("\n2. Players")
        owner = dict(
            db.session.query(FantasyRoster.player_id, FantasyTeam.name)
            .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
            .filter(FantasyRoster.is_active == True).all())
        plan, changed = sync_players(args.xlsx, year, dry_run=args.dry_run)
        print("  ", plan.counts())
        if plan.retire_refused:
            print("   NOBODY MARKED FORMER:", plan.retire_refused)
        for w in plan.warnings:
            print("   WARNING:", w)
        listed_and_gone = [p for p in plan.former if p.id in owner]
        for p in listed_and_gone:
            print(f"   off AFL lists but on a keeper list: {p.name} ({owner[p.id]})")
        if args.dry_run:
            print("\nDRY RUN, nothing written.")
            return
        print("   applied:", changed)

        print("\n3. Averages")
        from models.live_sync import recompute_sc_averages
        n = recompute_sc_averages(year)
        from models.years import stats_year
        print(f"   {n} players with an average, from the {stats_year()} season")

        print("\n4. Caches")
        try:
            from models.team_ai_summary import AnalyticsJsonCache
            dropped = AnalyticsJsonCache.query.delete()
            db.session.commit()
            print(f"   {dropped} cached analytics dropped")
        except Exception as e:
            db.session.rollback()
            print("   cache table not cleared:", e)

        print("\nDone. Listed:", AflPlayer.query.filter(AflPlayer.listed()).count(),
              "· former:", AflPlayer.query.filter_by(list_status="former").count())


if __name__ == "__main__":
    main()

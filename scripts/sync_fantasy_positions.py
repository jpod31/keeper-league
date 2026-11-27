"""Set every listed player's position from the official AFL Fantasy list.

    python scripts/sync_fantasy_positions.py            # dry run: print the plan
    python scripts/sync_fantasy_positions.py --apply    # write it
    python scripts/sync_fantasy_positions.py --url URL  # another article

Reads config.FANTASY_POSITIONS_URL (AFL.com.au "Fantasy <year>: Every player,
every position"). Writes `position` and clears `position_expected`. Read the
"not in the article" list: those keep the position they have.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--url")
    args = ap.parse_args()

    os.environ["RATINGS_XLSX_PATH"] = os.devnull + ".none"
    import config
    from app import create_app
    from models.database import db, FantasyRoster, FantasyTeam
    from models import fantasy_positions as fp

    url = args.url or config.FANTASY_POSITIONS_URL
    app = create_app()
    with app.app_context():
        owner = dict(
            db.session.query(FantasyRoster.player_id, FantasyTeam.name)
            .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
            .filter(FantasyRoster.is_active == True).all())
        tag = lambda p: f"   [{owner[p.id]}]" if p.id in owner else ""

        p = fp.sync(url, write=False)
        print(f"Source: {url}\nOfficial players: {p.official}")
        print(f"Unchanged: {p.same}   Changed: {len(p.changes)}   "
              f"Expected now confirmed: {len(p.confirmed)}")

        print(f"\nChanged ({len(p.changes)}), on a keeper list first:")
        for pl, old, new, how in sorted(p.changes, key=lambda c: (c[0].id not in owner, c[0].afl_team, c[0].name)):
            exp = " (was expected)" if pl.position_expected else ""
            loose = "" if how == "name+club" else f"   <{how}>"
            print(f"  {pl.name} ({pl.afl_team}): {old or '-'} -> {new}{exp}{tag(pl)}{loose}")

        print(f"\nExpected position confirmed ({len(p.confirmed)}):")
        for pl, how in p.confirmed:
            print(f"  {pl.name} ({pl.afl_team}): {pl.position}{tag(pl)}")

        print(f"\nIn the article, not on our lists ({len(p.unmatched)}):")
        for name, team, pos in p.unmatched:
            print(f"  {name} ({team}) {pos}")

        print(f"\nOn our lists, not in the article ({len(p.missing)}); they keep their position:")
        for pl in p.missing:
            exp = " expected" if pl.position_expected else ""
            print(f"  {pl.name} ({pl.afl_team}) {pl.position}{exp}{tag(pl)}")

        print(f"\nLine-up slots fixed ({len(p.moves)}):")
        for team, text in p.moves:
            print(f"  {team.name}: {text}")

        for name, team, cands in p.ambiguous:
            print(f"AMBIGUOUS: {name} ({team}) = {[c.id for c in cands]}")

        if args.apply:
            n = fp.apply(p)
            print(f"\nApplied: {n} players written. Slots fixed:")
            for team, text in p.moves:
                print(f"  {team.name}: {text}")
        else:
            print("\nDRY RUN, nothing written. Add --apply to write.")


if __name__ == "__main__":
    main()

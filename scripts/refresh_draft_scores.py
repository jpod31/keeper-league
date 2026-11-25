"""Save each listed player's draft value (afl_player.draft_score) from a league's default weights.

    python scripts/refresh_draft_scores.py --league-id 3 --dry-run
    python scripts/refresh_draft_scores.py --league-id 3

The pool and the draft room work the value out fresh for whoever is looking.
The saved column is only what the draft's auto-pick falls back to when a coach
has no queue, and nothing recomputes it on its own: run this after the model or
the workbook changes, and before a draft.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--league-id", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    os.environ["RATINGS_XLSX_PATH"] = os.devnull + ".none"
    import config
    from app import create_app
    app = create_app()
    with app.app_context():
        from models.database import db, AflPlayer, League, LeagueDraftWeights, CustomScoringRule
        from models.draft_model import rank_players, _apply_custom_sc_projection, _apply_af_projection
        from models.player import orm_to_player

        league = db.session.get(League, args.league_id)
        if not league:
            sys.exit("League not found")
        lw = LeagueDraftWeights.query.filter_by(league_id=league.id).first()
        weights = lw.to_dict() if lw else config.DRAFT_WEIGHTS
        aps = AflPlayer.query.filter(AflPlayer.listed()).all()
        players = [orm_to_player(a) for a in aps]
        if league.scoring_type in ("custom", "hybrid"):
            rules = CustomScoringRule.query.filter_by(league_id=league.id).all()
            if rules:
                _apply_custom_sc_projection(players, aps, rules)
        elif league.scoring_type == "afl_fantasy":
            _apply_af_projection(players, aps)
        by_key = {(a.name, a.afl_team): a for a in aps}
        rank_players(players, weights)   # sorts in place, best first
        moved = 0
        for p in players:
            a = by_key[(p.name, p.team)]
            if a.draft_score is None or abs((a.draft_score or 0) - p.draft_score) >= 0.05:
                moved += 1
            if not args.dry_run:
                a.draft_score = p.draft_score
        print(f"League {league.id} {league.name}: {len(players)} listed players, {moved} values change")
        print("Top 15:", ", ".join(f"{p.name} {p.draft_score}" for p in players[:15]))
        if args.dry_run:
            print("DRY RUN, nothing written.")
        else:
            db.session.commit()
            print("Saved.")


if __name__ == "__main__":
    main()

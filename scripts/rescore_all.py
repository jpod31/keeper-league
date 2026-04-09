"""One-time script to re-score all rounds and rebuild the ladder."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
app = create_app()

with app.app_context():
    from models.database import db, Fixture, RoundScore, SeasonStanding, FantasyTeam
    from models.scoring_engine import finalize_round
    from models.power_rankings import compute_power_rankings

    league_id = 3
    year = 2026

    # Un-finalize and clear scores for all rounds
    for rnd in [1, 2, 3, 4]:
        fixtures = Fixture.query.filter_by(league_id=league_id, afl_round=rnd, year=year).all()
        team_ids = []
        for f in fixtures:
            if f.status == "completed":
                f.status = "live"
            team_ids.append(f.home_team_id)
            team_ids.append(f.away_team_id)
        RoundScore.query.filter(
            RoundScore.team_id.in_(team_ids),
            RoundScore.afl_round == rnd,
            RoundScore.year == year,
        ).delete(synchronize_session=False)
        db.session.commit()
        print(f"R{rnd}: cleared")

    # Reset standings
    SeasonStanding.query.filter_by(league_id=league_id, year=year).delete()
    db.session.commit()
    print("Standings reset")

    # Re-score each round
    for rnd in [1, 2, 3, 4]:
        scores = finalize_round(league_id, rnd, year)
        print(f"R{rnd}: {scores}")

    # Recompute power rankings
    compute_power_rankings(league_id, 4, year)
    print("Power rankings recomputed")

    # Print results
    print("\n=== CORRECTED RESULTS ===")
    for rnd in [1, 2, 3, 4]:
        fixtures = Fixture.query.filter_by(league_id=league_id, afl_round=rnd, year=year).all()
        for f in fixtures:
            winner = f.home_team.name if f.home_score > f.away_score else f.away_team.name
            print(f"  R{rnd}: {f.home_team.name} {f.home_score:.0f} vs {f.away_team.name} {f.away_score:.0f}  ({winner})")

    print("\n=== CORRECTED LADDER ===")
    standings = SeasonStanding.query.filter_by(league_id=league_id, year=year).order_by(
        SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc()
    ).all()
    for i, s in enumerate(standings, 1):
        t = db.session.get(FantasyTeam, s.team_id)
        print(f"  {i}. {t.name:20s}  {s.wins}W {s.losses}L {s.draws}D  pts={s.ladder_points}  pf={s.points_for:.0f}  pa={s.points_against:.0f}  %={s.percentage:.1f}")

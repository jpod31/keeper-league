"""Fix R4 Lamb of North Cult: sub CDT in for Xerri, rescore."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
app = create_app()

with app.app_context():
    from models.database import db, Fixture, RoundScore, SeasonStanding, FantasyTeam, WeeklyLineup, LineupSlot
    from models.scoring_engine import finalize_round
    from models.power_rankings import compute_power_rankings

    league_id = 3
    team_id = 9  # Lamb of North Cult
    year = 2026
    rnd = 4
    cdt_id = 718  # Cooper Duff-Tytler
    xerri_id = 120  # Tristan Xerri

    # Set CDT as emergency in the R4 lineup snapshot so scoring picks him up
    lineup = WeeklyLineup.query.filter_by(team_id=team_id, afl_round=rnd, year=year).first()
    cdt_slot = LineupSlot.query.filter_by(lineup_id=lineup.id, player_id=cdt_id).first()
    if cdt_slot:
        cdt_slot.is_emergency = True
        cdt_slot.position_code = ""  # emergency slots use empty position_code
        db.session.commit()
        print(f"Set CDT as emergency in R4 lineup")
    else:
        print("CDT slot not found!")
        sys.exit(1)

    # Clear R4 scores for all teams and re-finalize
    fixtures = Fixture.query.filter_by(league_id=league_id, afl_round=rnd, year=year).all()
    team_ids = []
    for f in fixtures:
        f.status = "live"
        team_ids.append(f.home_team_id)
        team_ids.append(f.away_team_id)
    RoundScore.query.filter(
        RoundScore.team_id.in_(team_ids),
        RoundScore.afl_round == rnd,
        RoundScore.year == year,
    ).delete(synchronize_session=False)
    db.session.commit()
    print("R4 scores cleared")

    # Also need to recalculate standings from scratch since R4 results change
    SeasonStanding.query.filter_by(league_id=league_id, year=year).delete()
    db.session.commit()

    # Re-score all rounds to rebuild standings correctly
    for r in [1, 2, 3, 4]:
        if r < 4:
            # Re-finalize just to rebuild standings (scores already correct)
            pass
        scores = finalize_round(league_id, r, year)
        print(f"R{r}: {scores}")

    compute_power_rankings(league_id, 4, year)

    # Show R4 result
    print("\n=== R4 CORRECTED ===")
    for f in fixtures:
        winner = f.home_team.name if f.home_score > f.away_score else f.away_team.name
        print(f"  {f.home_team.name} {f.home_score:.0f} vs {f.away_team.name} {f.away_score:.0f}  ({winner})")

    # Lamb breakdown - check CDT sub
    import json
    rs = RoundScore.query.filter_by(team_id=team_id, afl_round=rnd, year=year).first()
    if rs and rs.breakdown:
        bd = json.loads(rs.breakdown) if isinstance(rs.breakdown, str) else rs.breakdown
        emg_keys = [k for k in bd if "emergency" in str(k)]
        print(f"\n  Lamb score: {rs.total_score}")
        print(f"  Emergency subs: {emg_keys}")
        for k in emg_keys:
            print(f"    {k} = {bd[k]}")

    print("\n=== UPDATED LADDER ===")
    standings = SeasonStanding.query.filter_by(league_id=league_id, year=year).order_by(
        SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc()
    ).all()
    for i, s in enumerate(standings, 1):
        t = db.session.get(FantasyTeam, s.team_id)
        print(f"  {i}. {t.name:20s}  {s.wins}W {s.losses}L {s.draws}D  pts={s.ladder_points}  pf={s.points_for:.0f}  pa={s.points_against:.0f}  %={s.percentage:.1f}")

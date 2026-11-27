"""The Record Book counts league rounds only, and keeps the short Opening
Round out of club score records."""

from models.database import Fixture, RoundScore, SeasonStanding, PlayerStat
from models.record_book import build


def test_record_book_counts_league_rounds_only(db, seed_data):
    lg, a, b = seed_data["league"], seed_data["team_a"], seed_data["team_b"]
    p = list(seed_data["players"].values())[0]
    for f in Fixture.query.filter_by(league_id=lg.id).all():
        db.session.delete(f)
    db.session.add(Fixture(league_id=lg.id, afl_round=0, year=2026, home_team_id=a.id, away_team_id=b.id, home_score=500, away_score=400, status="completed"))
    db.session.add(Fixture(league_id=lg.id, afl_round=1, year=2026, home_team_id=a.id, away_team_id=b.id, home_score=2000, away_score=1900, status="completed"))
    db.session.add(Fixture(league_id=lg.id, afl_round=2, year=2026, home_team_id=b.id, away_team_id=a.id, home_score=2100, away_score=1800, status="completed"))
    # round 1 counts; round 26 is an AFL finals week with no fixture and must not
    db.session.add(RoundScore(team_id=a.id, afl_round=1, year=2026, total_score=2000, breakdown={str(p.id): 150}))
    db.session.add(RoundScore(team_id=a.id, afl_round=26, year=2026, total_score=900, breakdown={str(p.id): 250}))
    db.session.add(SeasonStanding(league_id=lg.id, team_id=a.id, year=2026, wins=2, losses=1, points_for=4300, points_against=4400, ladder_points=8, percentage=97.7))
    db.session.add(SeasonStanding(league_id=lg.id, team_id=b.id, year=2026, wins=1, losses=2, points_for=4400, points_against=4300, ladder_points=4, percentage=102.3))
    db.session.commit()
    d = build(lg.id)
    rec = {r["key"]: r for r in d["clubs"] + d["players"] + d["matches"]}
    assert rec["p_high"]["top"]["value"] == 150            # the 250 in a finals week is not a record
    assert rec["p_high"]["top"]["player"] == p.name
    assert rec["low"]["top"]["value"] == 1800              # the Opening Round's 400 is left out
    assert rec["high"]["top"]["value"] == 2100
    assert rec["win_run"]["top"]["value"] == 2             # round 0 and round 1, both won by A
    assert rec["flags"]["top"]["team"] == a.name
    assert d["h2h"][f"{a.id}-{b.id}"]["w"] == 2 and d["h2h"][f"{a.id}-{b.id}"]["l"] == 1

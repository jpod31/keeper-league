"""Live scoring writes nothing for a round with no league fixture: AFL finals
weeks used to get a round score for every club, and every season count
picked them up (2026-11-27)."""

from models.database import RoundScore, Fixture


def test_no_round_scores_without_a_league_fixture(db, seed_data):
    from models.live_sync import _rescore_affected_matchups
    lg = seed_data["league"]
    p = list(seed_data["players"].values())[0]
    assert not Fixture.query.filter_by(league_id=lg.id, year=2026, afl_round=26).first()
    _rescore_affected_matchups(2026, 26, {p.id})
    assert RoundScore.query.filter_by(afl_round=26, year=2026).count() == 0

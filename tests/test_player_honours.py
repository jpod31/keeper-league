"""Player honours and the pre-AFL profile."""

import config
from models.database import (
    WeeklyLineup, LineupSlot, PlayerStat, RoundScore, Fixture, SeasonStanding, StateLeagueStat,
)
from models import player_honours
from models.player_honours import tier_for, for_player
from models.pre_afl import league_name, pre_afl


def test_repeats_change_the_metal():
    assert [tier_for("premiership", n) for n in (1, 2, 3, 4, 5, 9)] == ["gold", "plat", "ruby", "sapph", "black", "black"]
    assert [tier_for("matchwinner", n) for n in (1, 2, 3, 4, 5, 10)] == ["bronze", "silver", "gold", "gold", "plat", "black"]
    assert [tier_for("clubgames", step=s) for s in (25, 50, 100, 150, 200)] == ["bronze", "silver", "gold", "plat", "black"]


def _named(db, team, rnd, player, code="MID", captain=False):
    w = WeeklyLineup.query.filter_by(team_id=team.id, afl_round=rnd, year=2026).first()
    if not w:
        w = WeeklyLineup(team_id=team.id, afl_round=rnd, year=2026)
        db.session.add(w)
        db.session.flush()
    db.session.add(LineupSlot(lineup_id=w.id, player_id=player.id, position_code=code, is_captain=captain))


def _season(db, seed_data, complete=True):
    lg, a, b = seed_data["league"], seed_data["team_a"], seed_data["team_b"]
    ps = list(seed_data["players"].values())
    p1, p2, p3, p4 = ps[0], ps[1], ps[2], ps[3]
    for p in (p1, p2, p3, p4):
        p.position = "MID"
    for f in Fixture.query.filter_by(league_id=lg.id).all():
        db.session.delete(f)
    for s in SeasonStanding.query.filter_by(league_id=lg.id).all():
        db.session.delete(s)
    # Round 1: A win by 10, and only p1's game turned it.
    db.session.add(Fixture(league_id=lg.id, afl_round=1, year=2026, home_team_id=a.id, away_team_id=b.id,
                           home_score=1000, away_score=990, status="completed"))
    db.session.add(Fixture(league_id=lg.id, afl_round=2, year=2026, home_team_id=b.id, away_team_id=a.id,
                           home_score=900, away_score=800, status="completed" if complete else "scheduled"))
    _named(db, a, 1, p1, captain=True)
    _named(db, a, 1, p2)
    _named(db, b, 1, p3)
    _named(db, b, 1, p4, code="BENCH")
    db.session.add(RoundScore(team_id=a.id, afl_round=1, year=2026, total_score=1000,
                              breakdown={str(p1.id): 200, str(p2.id): 0, f"emergency_{p4.id}": 50}))
    db.session.add(RoundScore(team_id=b.id, afl_round=1, year=2026, total_score=990, breakdown={str(p3.id): 100}))
    for p, s in ((p1, 200), (p3, 100), (p4, 50)):
        db.session.add(PlayerStat(player_id=p.id, year=2026, round=1, supercoach_score=s))
    db.session.add(SeasonStanding(league_id=lg.id, team_id=a.id, year=2026, wins=1, losses=1, ladder_points=4, percentage=105))
    db.session.add(SeasonStanding(league_id=lg.id, team_id=b.id, year=2026, wins=1, losses=1, ladder_points=4, percentage=95))
    db.session.commit()
    player_honours._CACHE.clear()
    return lg, a, (p1, p2, p3, p4)


def test_honours_from_a_season(db, seed_data):
    lg, a, (p1, p2, p3, p4) = _season(db, seed_data)
    h1 = {e["kind"]: e for e in for_player(lg.id, p1.id)["emblems"]}
    assert "matchwinner" in h1 and h1["matchwinner"]["tier"] == "bronze"
    assert "champion" in h1 and "premiership" in h1 and "captain" in h1
    # A zero is not a game: no flag for p2. The emergency who came in and scored has one.
    assert "premiership" not in {e["kind"] for e in for_player(lg.id, p2.id)["emblems"]}
    assert "premiership" in {e["kind"] for e in for_player(lg.id, p4.id)["emblems"]}
    nxt = for_player(lg.id, p1.id)["next"]
    assert nxt["step"] == 25 and nxt["games"] == 1 and nxt["to_go"] == 24


def test_season_honours_wait_for_the_last_fixture(db, seed_data):
    lg, a, (p1, *_rest) = _season(db, seed_data, complete=False)
    kinds = {e["kind"] for e in for_player(lg.id, p1.id)["emblems"]}
    assert kinds == {"matchwinner"}


def test_under_18_league_names():
    assert league_name("nab", 2022) == "NAB League"
    assert league_name("nab", 2025) == "Talent League"
    assert league_name("vfl", 2025) == "VFL"


def test_pre_afl_profile_drops_a_namesake_too_young(db, seed_data):
    p = list(seed_data["players"].values())[0]
    p.age = 19
    db.session.add(StateLeagueStat(player_name=p.name, competition="nab", season=config.CURRENT_YEAR - 1,
                                   team="GWV Rebels", matches=10, disposals=24.5, goals=1.2, dreamteam_avg=95.0,
                                   predicted_afl_sc=76.4))
    db.session.add(StateLeagueStat(player_name=p.name, competition="nab", season=config.CURRENT_YEAR - 6,
                                   team="GWV Rebels", matches=3))
    db.session.commit()
    out = pre_afl(p)
    assert [s["season"] for s in out["seasons"]] == [config.CURRENT_YEAR - 1]
    text = " ".join(out["lines"])
    assert "GWV Rebels in the Talent League" in text and "24.5 disposals" in text
    assert out["projection"]["sc"] == 76

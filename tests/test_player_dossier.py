"""The full player page: photos, season averages, and his keeper career."""

from models.database import WeeklyLineup, LineupSlot, PlayerStat, RoundScore
from models.player_photos import photo_slug, find_slug
from models.player_dossier import _avg_cover, keeper_career, build


def test_photo_slug_matches_afl_manager_files():
    assert photo_slug("Balyn O'Brien") == "balyn-o-brien"
    assert photo_slug("Nasiah Wanganeen-Milera") == "nasiah-wanganeen-milera"
    assert photo_slug("Zoë Smith") == "zoe-smith"


def test_photo_found_through_a_nickname_never_a_guess():
    assert find_slug("Nick Daicos") == "nick-daicos"
    assert find_slug("Zachary Merrett") == "zach-merrett"       # Zachary -> Zach
    assert find_slug("Liam Jones") is None                     # not Lachie Jones


def test_a_stat_held_for_under_half_his_games_is_not_an_average():
    assert _avg_cover([6, None, None, None]) is None
    assert _avg_cover([4, 6, None]) == 5.0
    assert _avg_cover([]) is None


def _lineup(db, team, rnd, player, code, captain=False):
    w = WeeklyLineup(team_id=team.id, afl_round=rnd, year=2026)
    db.session.add(w)
    db.session.flush()
    db.session.add(LineupSlot(lineup_id=w.id, player_id=player.id, position_code=code, is_captain=captain))


def test_keeper_career_splits_named_from_not_named(db, seed_data):
    lg = seed_data["league"]
    a = seed_data["team_a"]
    p = seed_data["players"]["Jordan Dawson"]
    _lineup(db, a, 1, p, "MID", captain=True)
    _lineup(db, a, 2, p, "BENCH")
    _lineup(db, a, 3, p, "MID")
    db.session.add(RoundScore(team_id=a.id, afl_round=1, year=2026, total_score=0, breakdown={str(p.id): 240}))
    db.session.add(RoundScore(team_id=a.id, afl_round=3, year=2026, total_score=0, breakdown={str(p.id): 90}))
    for rnd, sc in ((1, 120), (2, 70), (3, 90)):
        db.session.add(PlayerStat(player_id=p.id, year=2026, round=rnd, supercoach_score=sc, disposals=20 + rnd))
    db.session.commit()

    k = keeper_career(lg.id, p.id, {(2026, 1): 120, (2026, 2): 70, (2026, 3): 90})
    t = k["totals"]
    assert (t["rounds_on_list"], t["named"], t["not_named"], t["captain"]) == (3, 2, 1, 1)
    assert t["avg_named"] == 105.0 and t["avg_not_named"] == 70.0
    assert t["banked"] == 330

    d = build(lg.id, p.id)
    assert d["splits"]["named"]["games"] == 2
    assert d["splits"]["named"]["disposals"] == 22.0          # rounds 1 and 3
    assert d["splits"]["not_named"]["supercoach_score"] == 70.0
    assert d["seasons"][0]["games"] == 3

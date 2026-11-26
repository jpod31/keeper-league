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
    h = out["headline"]
    assert h["league"] == "Talent League" and h["team"] == "GWV Rebels" and h["games"] == 10
    assert {"label": "Disposals", "value": 24.5} in h["stats"]
    assert out["projection"]["sc"] == 76
    assert out["verdict"]["label"] in ("Walks straight in", "Pushing for round 1", "Mid-season debut", "Development year")


DG_PAGE = """<div class="player-bits">
    <p style="max-width: 40em"><em>Larke Medallist</em></p>
  <p class="top-bump"><em>Born: </em>27 Jul 2008 (18 years old)</p>
  <p><em>Height: </em>185cm</p>
    <p><em>Originally from: </em><a href="/from/a">Wembley Downs JFC</a><em>/&#8203;</em><a href="/from/b">Hale School</a><em>/&#8203;</em><a href="/from/c">Claremont</a></p>
</div>
<td colspan="10"><a href="/years/2026">Drafted by West Coast with National Draft pick #5</a></td>"""


def test_draftguru_profile_facts():
    from scrapers.draftguru_scraper import parse_player_profile
    f = parse_player_profile(DG_PAGE)
    assert f == {"honours": "Larke Medallist", "origin": "Wembley Downs JFC / Hale School / Claremont",
                 "draft_note": "Pick 5, 2026 National Draft, West Coast", "height_cm": 185}


def test_pre_afl_without_junior_stats_still_says_who_he_is(db, seed_data):
    p = list(seed_data["players"].values())[1]
    p.age, p.draft_pick, p.draft_year = 18, None, None
    p.junior_origin = "Wembley Downs JFC / Hale School / Claremont"
    p.junior_honours = "Larke Medallist"
    p.draft_note = "Pick 5, 2026 National Draft, West Coast"
    db.session.commit()
    out = pre_afl(p)
    assert out["facts"][:2] == ["Pick 5, 2026 National Draft", "Claremont"]
    assert out["honour_note"] == "Larke Medallist: the best player at the under-18 national championships."
    assert out["pathway"] == "Wembley Downs JFC / Hale School / Claremont"
    assert league_name("sanflu18", 2026) == "SANFL under-18s"



def test_rankings_are_like_for_like(db, seed_data, monkeypatch):
    from models import pre_afl as pa
    ps = list(seed_data["players"].values())[:4]
    for p, role, disp in zip(ps, ("MID", "MID", "KF", "KF"), (20, 25, 30, 35)):
        p.role, p.age = role, 19
        db.session.add(StateLeagueStat(player_id=p.id, player_name=p.name, competition="nab",
                                       season=config.CURRENT_YEAR - 1, team="GWV Rebels", matches=10, disposals=disp))
    db.session.commit()
    monkeypatch.setattr(pa, "MIN_ROLE_POOL", 2)
    monkeypatch.setattr(pa, "MIN_RANK_POOL", 2)
    pa._cache.clear()
    row = StateLeagueStat.query.filter_by(player_id=ps[0].id).first()
    ranks, meta = pa._rank(row, ps[0])
    # Two key forwards had more of the ball; against midfielders he is 2nd of 2.
    assert meta["word"] == "midfielders" and meta["of"] == 2
    assert next(r for r in ranks if r["label"] == "Disposals")["text"] == "2nd of 2"


WAFL_ROW = ('<table><thead><tr><th> AVG </th></tr></thead><tbody><tr><td>2025</td><td>Colts</td><td>Claremont</td>'
            '<td><div class="w-6">8</div></td><td>99</td><td>86</td><td>185</td><td>23.1</td><td>31</td><td>39</td>'
            '<td>0</td><td>17</td><td>2</td><td>6</td><td>5</td></tr></tbody></table>')
RM_TABLE = ('<h4 class="sp-table-caption">AFL U18 Championships</h4><div><table><tbody><tr class="odd">'
            '<td class="data-name">2026</td><td class="data-team"><a>Western Australia</a></td>'
            '<td class="data-kicks">64</td><td class="data-handballs">49</td><td class="data-disposals">113</td>'
            '<td class="data-marks">20</td><td class="data-cp">27</td><td class="data-up">72</td>'
            '<td class="data-tackles">10</td><td class="data-hitouts">0</td><td class="data-clr">9</td>'
            '<td class="data-i">12</td><td class="data-r">16</td><td class="data-goals">0</td>'
            '<td class="data-gamesplayed">4</td><td class="data-dc">104</td></tr></tbody></table>')


def test_wafl_and_championship_tables():
    from scrapers.junior_sources import parse_wafl, parse_rookieme
    w = parse_wafl(WAFL_ROW)
    assert w == [{"season": 2025, "comp": "waflcolts", "team": "Claremont", "matches": 8, "kicks": 99.0,
                  "handballs": 86.0, "disposals": 185.0, "marks": 31.0, "tackles": 39.0, "hitouts": 0.0,
                  "frees_for": 17.0, "frees_against": 2.0, "goals_total": 6.0, "behinds": 5.0}]
    r = parse_rookieme(RM_TABLE)
    assert r[0]["comp"] == "u18champs" and r[0]["matches"] == 4 and r[0]["disposals"] == 113 and r[0]["fantasy"] == 104
    assert league_name("u18champs", 2026) == "Under-18 Championships"

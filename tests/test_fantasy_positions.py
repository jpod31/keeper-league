"""Official AFL Fantasy positions: reading the article, matching, slot repair."""
from models import fantasy_positions as fp
from models.database import AflPlayer, FantasyRoster

PAGE = """
<h2>Defenders</h2>
<table><tr><th>PLAYER</th><th>TEAM</th><th>POSITION</th><th>2026 AVERAGE</th><th>2026 GAMES</th></tr>
<tr><td>Jack Henry</td><td>Geelong</td><td>DEF</td><td>70.1</td><td>20</td></tr>
<tr><td>Sam Flanders</td><td>St Kilda</td><td>DEF/MID</td><td>91.9</td><td>12</td></tr></table>
<h2>Midfielders</h2>
<table><tr><th>PLAYER</th><th>TEAM</th><th>POSITION</th><th>2026 AVERAGE</th><th>2026 GAMES</th></tr>
<tr><td>Sam Flanders</td><td>St Kilda</td><td>DEF/MID</td><td>91.9</td><td>12</td></tr>
<tr><td>Zac Bailey</td><td>Brisbane</td><td>MID/FWD</td><td>92.2</td><td>22</td></tr></table>
<h2>Rucks</h2>
<table><tr><th>PLAYER</th><th>TEAM</th><th>POSITION</th><th>2026 AVERAGE</th><th>2026 GAMES</th></tr>
<tr><td>Zac McCarthy</td><td>Collingwood</td><td>FWD/RUCK</td><td>&#8211;</td><td>0</td></tr></table>
"""


def test_parse_joins_tables_and_maps_clubs():
    got = fp.parse(PAGE)
    assert got[("Sam Flanders", "St Kilda")] == {"DEF", "MID"}
    assert got[("Zac Bailey", "Brisbane Lions")] == {"MID", "FWD"}
    assert got[("Zac McCarthy", "Collingwood")] == {"FWD", "RUC"}
    assert len(got) == 4


def test_format_matches_stored_values():
    assert fp.fmt({"MID", "FWD"}) == "FWD/MID"
    assert fp.fmt({"RUC", "FWD"}) == "FWD/RUC"
    assert fp.fmt({"MID", "FWD", "DEF"}) == "DEF/FWD/MID"
    assert fp.fmt({"MID", "RUC"}) == "RUC/MID"


def _p(db, name, club, pos, expected=False, avg=80.0):
    p = AflPlayer(name=name, afl_team=club, position=pos, position_expected=expected, sc_avg=avg, age=22)
    db.session.add(p)
    db.session.flush()
    return p


def test_plan_matches_strictest_first(db):
    henry = _p(db, "Jack Henry", "Geelong", "DEF/FWD/MID")
    matt = _p(db, "Matthew Roberts", "Sydney", "DEF/MID")
    may = _p(db, "Archie May", "Essendon", "MID", expected=True)
    burrows = _p(db, "Lachie Burrows", "Melbourne", "DEF/MID", expected=True)
    kept = _p(db, "Blake Leidler", "Sydney", "DEF")
    official = {
        ("Jack Henry", "Geelong"): {"DEF"},
        ("Matt Roberts", "Sydney"): {"MID"},
        ("Archer May", "Essendon"): {"FWD"},
        ("Lochie Burrows", "Melbourne"): {"DEF", "MID"},
    }
    p = fp.plan(official, [henry, matt, may, burrows, kept])
    changed = {pl.name: new for pl, _o, new, _h in p.changes}
    assert changed == {"Jack Henry": "DEF", "Matthew Roberts": "MID", "Archie May": "FWD"}
    assert [pl.name for pl, _h in p.confirmed] == ["Lachie Burrows"]
    assert [pl.name for pl in p.missing] == ["Blake Leidler"]
    assert not p.unmatched

    fp.apply(p)
    assert henry.position == "DEF" and not may.position_expected and not burrows.position_expected


def _slot(db, team, player, code, benched=False):
    r = FantasyRoster(team_id=team.id, player_id=player.id, position_code=code, is_benched=benched)
    db.session.add(r)
    db.session.flush()
    return r


def test_repair_swaps_on_field_first(db, seed_data):
    team = seed_data["team_a"]
    FantasyRoster.query.filter_by(team_id=team.id).delete()
    rankine = _p(db, "Izak Rankine", "Adelaide", "MID", avg=97)
    wilson = _p(db, "Darcy Wilson", "St Kilda", "FWD/MID", avg=83)
    r1 = _slot(db, team, rankine, "FWD")
    r2 = _slot(db, team, wilson, "MID")
    moves = fp.repair_slots()
    assert (r1.position_code, r2.position_code) == ("MID", "FWD")
    assert not r1.is_benched and not r2.is_benched
    assert len(moves) == 1


def test_repair_keeps_the_stronger_side(db, seed_data):
    team = seed_data["team_a"]
    FantasyRoster.query.filter_by(team_id=team.id).delete()
    warner = _p(db, "Chad Warner", "Sydney", "MID", avg=93)
    weak_mid = _p(db, "Dylan Stephens", "North Melbourne", "MID", avg=60)
    sub_fwd = _p(db, "Logan Morris", "Brisbane Lions", "FWD", avg=70)
    rw = _slot(db, team, warner, "FWD")
    rs = _slot(db, team, weak_mid, "MID")
    rm = _slot(db, team, sub_fwd, None, benched=True)
    fp.repair_slots()
    assert (rw.position_code, rw.is_benched) == ("MID", False)
    assert (rm.position_code, rm.is_benched) == ("FWD", False)
    assert rs.is_benched and rs.position_code is None

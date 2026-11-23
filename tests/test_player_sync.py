"""The workbook sync's matching rules (models/player_sync.plan_sync).

plan_sync is pure, so these run on plain objects: no database, no workbook.
Each test is a case that went wrong, or would have, at the 2027 cutover.
"""

from types import SimpleNamespace

from models.player_sync import Row, plan_sync, norm, variants, MIN_WORKBOOK_ROWS

YEAR = 2027


def P(pid, name, team, age=25, rating=70, status="listed"):
    return SimpleNamespace(id=pid, name=name, afl_team=team, age=age, rating=rating,
                           list_status=status, sc_avg=None)


def R(name, team, age=26, rating=70, role="MID"):
    return Row(name=name, team=team, age=age, rating=rating, potential=rating,
               rating_start=rating, role=role, role_detail=None)


def padded(rows, players):
    """A real list is 700+ players; pad both sides so the "is this a full
    workbook" guard is satisfied and only the case under test differs."""
    n = MIN_WORKBOOK_ROWS
    extra_rows = [R(f"Filler Player{i}", "Carlton") for i in range(n)]
    extra_players = [P(10_000 + i, f"Filler Player{i}", "Carlton") for i in range(n)]
    return rows + extra_rows, players + extra_players


def how(plan, pid):
    return next((h for p, _r, h in plan.matched if p.id == pid), None)


def test_names_compare_without_case_punctuation_or_suffix():
    assert norm("Nathan O'Driscoll") == norm("nathan odriscoll")
    assert norm("Maurice Rioli Jr") == norm("Maurice Rioli")
    assert norm("Callum Coleman-Jones") == "callum coleman jones"


def test_zach_reaches_zachary_and_zac():
    assert "zachary merrett" in variants("Zach Merrett")
    assert "zac merrett" in variants("Zach Merrett")


def test_traded_player_keeps_his_row():
    rows, players = padded([R("Zak Butters", "Western Bulldogs")], [P(1, "Zak Butters", "Port Adelaide")])
    plan = plan_sync(rows, players, YEAR)
    assert how(plan, 1) == "moved"
    assert [p.id for p, _r in plan.moved] == [1]
    assert not plan.create and not plan.former


def test_traded_under_a_short_name_is_one_player_not_two():
    # Zachary Merrett (Essendon) in the table, Zach Merrett (Hawthorn) in the
    # workbook: the old sync created a second player and orphaned the first.
    rows, players = padded([R("Zach Merrett", "Hawthorn")], [P(1, "Zachary Merrett", "Essendon")])
    plan = plan_sync(rows, players, YEAR)
    assert how(plan, 1) == "moved+nickname"
    assert not plan.create and not plan.former


def test_same_name_at_two_clubs_is_never_guessed():
    # Two Max Kings in the table. A third club's Max King is a new player,
    # not a coin toss between the existing two.
    rows, players = padded(
        [R("Max King", "St Kilda"), R("Max King", "Sydney"), R("Max King", "Geelong")],
        [P(1, "Max King", "St Kilda"), P(2, "Max King", "Sydney")])
    plan = plan_sync(rows, players, YEAR)
    assert how(plan, 1) == "exact" and how(plan, 2) == "exact"
    assert [r.team for r in plan.create] == ["Geelong"]


def test_new_player_gets_an_expected_position_from_his_role():
    rows, players = padded([R("Dougie Cochrane", "Port Adelaide", age=19, role="GF"),
                            R("Harry Van Hattum", "Richmond", age=19, role="RUC"),
                            R("Mitch Harris", "Melbourne", age=19, role="KD")], [])
    plan = plan_sync(rows, players, YEAR)
    assert {r.name: r.expected_position for r in plan.create} == {
        "Dougie Cochrane": "FWD", "Harry Van Hattum": "RUC", "Mitch Harris": "DEF"}


def test_player_missing_from_the_workbook_becomes_former():
    rows, players = padded([], [P(1, "Taylor Walker", "Adelaide", age=36)])
    plan = plan_sync(rows, players, YEAR)
    assert [p.id for p in plan.former] == [1]


def test_former_player_named_again_returns():
    rows, players = padded([R("Liam Jones", "Gold Coast", age=36)],
                           [P(1, "Liam Jones", "Western Bulldogs", status="former")])
    plan = plan_sync(rows, players, YEAR)
    assert [p.id for p, _r in plan.returning] == [1]
    assert not plan.former


def test_a_partial_workbook_retires_nobody():
    players = [P(i, f"Player {i}", "Carlton") for i in range(700)]
    plan = plan_sync([R("Player 1", "Carlton")], players, YEAR)
    assert plan.former == []
    assert plan.retire_refused


def test_a_workbook_missing_a_third_of_the_league_retires_nobody():
    players = [P(i, f"Player {i}", "Carlton") for i in range(1000)]
    rows = [R(f"Player {i}", "Carlton") for i in range(MIN_WORKBOOK_ROWS)]
    plan = plan_sync(rows, players, YEAR)
    assert plan.former == []
    assert "too many" in plan.retire_refused

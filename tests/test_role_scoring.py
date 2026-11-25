"""Draft values know what kind of player he is (models/role_scoring.py)."""

from models import role_scoring as rs
from models.draft_model import _rating_potential_scores, _sc_average_scores, player_output, player_ceiling
from models.player import Player


def _p(name, **kw):
    base = dict(team="Richmond", position="FWD", age=20, rating=70, potential=80)
    base.update(kw)
    return Player(name=name, **base)


def test_fit_file_is_loaded_and_has_both_parts():
    m = rs.model()
    assert m["peak"]["by_detail"], "role_scoring_fit.json missing or empty: run scripts/fit_role_scoring.py --write"
    assert m["now"]["by_role"]


def test_small_and_key_forwards_project_below_a_midfielder_of_the_same_potential():
    mid = rs.projected_peak(80, "MID", "General Midfielder")
    small = rs.projected_peak(80, "GF", "Small Forward")
    key_fwd = rs.projected_peak(80, "KF", "Key Forward")
    key_def = rs.projected_peak(80, "KD", "Key Defender")
    assert small < mid - 10
    assert key_fwd < mid - 10
    assert key_def < mid


def test_unknown_specific_role_falls_back_to_the_broad_role_then_to_the_line():
    line = rs.projected_peak(80)
    assert rs.projected_peak(80, "GF", "Something New") == line + rs.model()["peak"]["by_role"]["GF"]
    assert rs.projected_peak(80, None, None) == line


def test_a_thin_average_is_pulled_toward_the_role_line():
    line = rs.expected_now(71, "GD", "Rebound Defender")
    two_games = rs.output(88.0, 2, 71, "GD", "Rebound Defender")
    full_season = rs.output(88.0, 22, 71, "GD", "Rebound Defender")
    assert line < two_games < full_season < 88.0
    assert two_games - line < 88.0 - two_games      # two games: nearer the line than the average


def test_a_player_with_no_games_is_expected_to_score_not_zero():
    draftee = _p("Draftee", rating=66, potential=86, role="MID", role_detail="General Midfielder", sc_avg=None, games_played=0)
    assert player_output(draftee) == rs.expected_now(66, "MID", "General Midfielder")
    assert player_output(draftee) > 30


def test_ceiling_is_what_he_has_shown_when_that_beats_his_role():
    star = _p("Star small forward", rating=85, potential=85, role="GF", role_detail="Small Forward", sc_avg=100.0, games_played=23)
    assert player_ceiling(star) > rs.projected_peak(85, "GF", "Small Forward")
    assert abs(player_ceiling(star) - rs.output(100.0, 23, 85, "GF", "Small Forward")) < 1e-9


def test_the_ceiling_factor_ranks_by_role_not_by_the_gap_to_potential():
    small = _p("Small forward", rating=70, potential=80, role="GF", role_detail="Small Forward", sc_avg=52.5, games_played=8)
    mid = _p("Midfielder", position="MID", rating=70, potential=80, role="MID", role_detail="General Midfielder", sc_avg=52.5, games_played=8)
    elite = _p("Elite midfielder", position="MID", age=24, rating=91, potential=93, role="MID", role_detail="General Midfielder", sc_avg=115.0, games_played=24)
    scores = dict(zip(["small", "mid", "elite"], _rating_potential_scores([small, mid, elite])))
    assert scores["small"] < scores["mid"] < scores["elite"]


def test_another_scoring_systems_average_is_left_alone():
    p = _p("Custom league", rating=70, role="GF", role_detail="Small Forward", sc_avg=40.0, games_played=2)
    p.sc_scale = False
    assert player_output(p) == 40.0
    assert _sc_average_scores([p, _p("Other", sc_avg=80.0, games_played=20, sc_scale=False)])[0] == 0.0

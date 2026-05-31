"""Bye player on field gets an emergency at round lock (end of round), not before."""

from werkzeug.security import generate_password_hash

from models.database import (
    AflPlayer, League, FantasyTeam, FantasyRoster, User,
    SeasonConfig, AflGame, PlayerStat,
)
from models.scoring_engine import score_team_round
from models.live_sync import get_player_score_breakdown


def _setup(db, all_locked):
    u = User(username="u", email="u@t.com", password_hash=generate_password_hash("p"))
    db.session.add(u)
    db.session.flush()
    lg = League(name="L", commissioner_id=u.id, season_year=2026,
                scoring_type="supercoach", squad_size=38, on_field_count=18, num_teams=2)
    db.session.add(lg)
    db.session.flush()
    db.session.add(SeasonConfig(league_id=lg.id, year=2026, num_regular_rounds=23,
                                finals_teams=4, captain_scoring_enabled=False))
    t = FantasyTeam(league_id=lg.id, owner_id=u.id, name="T", draft_order=1)
    db.session.add(t)
    db.session.flush()

    p_bye = AflPlayer(name="Bye Guy", afl_team="Geelong", position="DEF", sc_avg=90, age=27)
    p_play = AflPlayer(name="Play Guy", afl_team="Adelaide", position="MID", sc_avg=100, age=27)
    emg = AflPlayer(name="Emg Guy", afl_team="Carlton", position="DEF", sc_avg=70, age=27)
    db.session.add_all([p_bye, p_play, emg])
    db.session.flush()

    db.session.add_all([
        FantasyRoster(team_id=t.id, player_id=p_bye.id, position_code="DEF", is_benched=False, is_active=True),
        FantasyRoster(team_id=t.id, player_id=p_play.id, position_code="MID", is_benched=False, is_active=True),
        FantasyRoster(team_id=t.id, player_id=emg.id, position_code="DEF", is_emergency=True, is_benched=True, is_active=True),
    ])
    db.session.add_all([
        PlayerStat(player_id=p_play.id, year=2026, round=1, supercoach_score=100),
        PlayerStat(player_id=emg.id, year=2026, round=1, supercoach_score=70),
    ])
    # Geelong has no game this round → inferred as bye (byes derived from fixtures)
    db.session.add(AflGame(year=2026, afl_round=1, home_team="Adelaide",
                           away_team="Carlton", status="complete"))
    db.session.add(AflGame(year=2026, afl_round=1, home_team="Melbourne", away_team="Sydney",
                           status="complete" if all_locked else "scheduled"))
    db.session.commit()
    return lg, t, p_bye, emg


def test_locked_bye_gets_emergency(db):
    lg, t, p_bye, emg = _setup(db, all_locked=True)
    score = score_team_round(t.id, lg.id, 1, 2026, "supercoach")
    assert score == 170, f"expected 100 (play) + 70 (emergency) = 170, got {score}"

    bd = get_player_score_breakdown(t.id, 1, 2026, lg.id)
    bye_row = next(r for r in bd if r["player_id"] == p_bye.id)
    emg_row = next(r for r in bd if r["player_id"] == emg.id)
    assert bye_row["is_dnp"] is True
    assert bye_row["replaced_by"] == emg.id
    assert emg_row["subbed_on"] is True


def test_unlocked_bye_pending_no_emergency(db):
    lg, t, p_bye, emg = _setup(db, all_locked=False)
    score = score_team_round(t.id, lg.id, 1, 2026, "supercoach")
    assert score == 100, f"expected 100 (play only, bye pending), got {score}"

    bd = get_player_score_breakdown(t.id, 1, 2026, lg.id)
    bye_row = next(r for r in bd if r["player_id"] == p_bye.id)
    emg_row = next(r for r in bd if r["player_id"] == emg.id)
    assert bye_row["is_dnp"] is False
    assert bye_row["replaced_by"] is None
    assert emg_row["subbed_on"] is False
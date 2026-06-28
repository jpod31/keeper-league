"""A field player omitted from a NAMED AFL side is out pre-bounce — their
emergency comes on in the gameday breakdown before the game starts."""

from werkzeug.security import generate_password_hash

from models.database import (
    AflPlayer, League, FantasyTeam, FantasyRoster, User,
    SeasonConfig, AflGame, AflTeamSelection,
)
from models.live_sync import get_player_score_breakdown


def _setup(db, name_geelong):
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

    # Jhye Clark on field for Geelong; emergency on the bench.
    p_out = AflPlayer(name="Jhye Clark", afl_team="Geelong", position="MID", sc_avg=70, age=21)
    keeper = AflPlayer(name="Named Cat", afl_team="Geelong", position="DEF", sc_avg=80, age=27)
    emg = AflPlayer(name="Emg Guy", afl_team="Carlton", position="MID", sc_avg=65, age=27)
    db.session.add_all([p_out, keeper, emg])
    db.session.flush()

    db.session.add_all([
        FantasyRoster(team_id=t.id, player_id=p_out.id, position_code="MID", is_benched=False, is_active=True),
        FantasyRoster(team_id=t.id, player_id=emg.id, position_code="MID", is_emergency=True, is_benched=True, is_active=True),
    ])
    # Geelong v Carlton this round, NOT started (scheduled) — pre-bounce.
    db.session.add(AflGame(year=2026, afl_round=1, home_team="Geelong",
                           away_team="Carlton", status="scheduled"))

    if name_geelong:
        # Geelong's side is named and Jhye Clark is NOT in it (omitted).
        db.session.add(AflTeamSelection(year=2026, afl_round=1, afl_team="Geelong",
                                        player_id=keeper.id, player_name="Named Cat",
                                        position="C"))
    db.session.commit()
    return lg, t, p_out, emg


def test_omitted_from_named_side_subs_emergency_pre_bounce(db):
    lg, t, p_out, emg = _setup(db, name_geelong=True)
    bd = get_player_score_breakdown(t.id, 1, 2026, lg.id)
    out_row = next(r for r in bd if r["player_id"] == p_out.id)
    emg_row = next(r for r in bd if r["player_id"] == emg.id)
    assert out_row["is_dnp"] is True
    assert out_row["replaced_by"] == emg.id
    assert emg_row["subbed_on"] is True


def test_unnamed_side_does_not_fire_pre_bounce(db):
    # No selections published yet → we don't know Clark is out, so the
    # emergency stays on standby until the game starts.
    lg, t, p_out, emg = _setup(db, name_geelong=False)
    bd = get_player_score_breakdown(t.id, 1, 2026, lg.id)
    out_row = next(r for r in bd if r["player_id"] == p_out.id)
    emg_row = next(r for r in bd if r["player_id"] == emg.id)
    assert out_row["is_dnp"] is False
    assert out_row["replaced_by"] is None
    assert emg_row["subbed_on"] is False

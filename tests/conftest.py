"""Shared test fixtures for Keeper League tests."""

import os
import sys
import tempfile

import pytest

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from models.database import (
    db as _db, init_db, AflPlayer, League, FantasyTeam, FantasyRoster,
    User, WeeklyLineup, LineupSlot, LeaguePositionSlot, LockoutConfig,
    Fixture, SeasonConfig, AflGame, LiveScoringConfig, PlayerStat,
    CustomScoringRule, RoundScore,
)
from models.auth import login_manager

from flask import Flask
from flask_socketio import SocketIO
from werkzeug.security import generate_password_hash


@pytest.fixture()
def app():
    """Create a test Flask app with an in-memory SQLite database."""
    db_fd, db_path = tempfile.mkstemp(suffix=".db")

    test_app = Flask(__name__, template_folder=os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates"
    ))
    test_app.config["TESTING"] = True
    test_app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    test_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    test_app.config["SECRET_KEY"] = "test-secret-key"
    test_app.config["WTF_CSRF_ENABLED"] = False
    test_app.config["LOGIN_DISABLED"] = True

    init_db(test_app)
    login_manager.init_app(test_app)

    # Register blueprints
    from blueprints.auth import auth_bp
    from blueprints.leagues import leagues_bp
    from blueprints.draft import draft_bp
    from blueprints.team import team_bp
    from blueprints.trades import trades_bp
    from blueprints.matchups import matchups_bp
    test_app.register_blueprint(auth_bp)
    test_app.register_blueprint(leagues_bp)
    test_app.register_blueprint(draft_bp)
    test_app.register_blueprint(team_bp)
    test_app.register_blueprint(trades_bp)
    test_app.register_blueprint(matchups_bp)

    # Context processor
    test_app.context_processor(lambda: {
        "TEAM_LOGOS": config.TEAM_LOGOS,
        "TEAM_COLOURS": config.TEAM_COLOURS,
    })

    with test_app.app_context():
        _db.create_all()

    yield test_app

    # Cleanup — properly dispose engine before deleting file (Windows lock issue)
    with test_app.app_context():
        _db.session.remove()
        _db.engine.dispose()
    os.close(db_fd)
    try:
        os.unlink(db_path)
    except PermissionError:
        pass  # Windows sometimes holds the file; will be cleaned up by OS


@pytest.fixture()
def db(app):
    """Provide the database session, rolled back after each test."""
    with app.app_context():
        yield _db
        _db.session.rollback()


@pytest.fixture()
def socketio(app):
    """Create a SocketIO instance for the test app."""
    sio = SocketIO(app, async_mode="threading")
    from sockets.matchup_events import register_matchup_events
    register_matchup_events(sio)
    return sio


@pytest.fixture()
def seed_data(db):
    """Seed the DB with a league, two teams, players, and a fixture.

    Returns a dict with all created objects for easy reference.
    """
    # Users
    commissioner = User(
        username="commish", email="c@test.com",
        password_hash=generate_password_hash("pass"), display_name="Commissioner"
    )
    manager = User(
        username="manager", email="m@test.com",
        password_hash=generate_password_hash("pass"), display_name="Manager"
    )
    db.session.add_all([commissioner, manager])
    db.session.flush()

    # League
    league = League(
        name="Test League", commissioner_id=commissioner.id,
        season_year=2026, scoring_type="supercoach",
        squad_size=38, on_field_count=18, num_teams=2,
    )
    db.session.add(league)
    db.session.flush()

    # Position slots
    for code, count, bench in [("DEF", 5, False), ("MID", 7, False),
                                ("FWD", 5, False), ("RUC", 1, False),
                                ("DEF", 1, True), ("MID", 2, True),
                                ("FWD", 1, True), ("FLEX", 1, True)]:
        db.session.add(LeaguePositionSlot(
            league_id=league.id, position_code=code, count=count, is_bench=bench
        ))

    # Lockout config — per-game rolling
    db.session.add(LockoutConfig(league_id=league.id, lockout_type="game_start"))

    # Live scoring config
    db.session.add(LiveScoringConfig(
        league_id=league.id, enabled=True,
        poll_interval_seconds=120, lockout_type="game_start"
    ))

    # Season config
    db.session.add(SeasonConfig(
        league_id=league.id, year=2026,
        num_regular_rounds=23, finals_teams=4
    ))

    # Teams
    team_a = FantasyTeam(league_id=league.id, owner_id=commissioner.id,
                         name="Team Alpha", draft_order=1)
    team_b = FantasyTeam(league_id=league.id, owner_id=manager.id,
                         name="Team Beta", draft_order=2)
    db.session.add_all([team_a, team_b])
    db.session.flush()

    # AFL Players (from various real teams for lockout testing)
    players = []
    player_specs = [
        # Adelaide players (will be in a "live" game)
        ("Jordan Dawson", "Adelaide", "DEF", 95.0),
        ("Rory Laird", "Adelaide", "MID", 110.0),
        ("Ben Keays", "Adelaide", "MID", 88.0),
        # Carlton players (will be in a "live" game)
        ("Patrick Cripps", "Carlton", "MID", 115.0),
        ("Sam Walsh", "Carlton", "MID", 100.0),
        # Geelong players (scheduled — not yet started)
        ("Jeremy Cameron", "Geelong", "FWD", 90.0),
        ("Tom Stewart", "Geelong", "DEF", 92.0),
        # Melbourne players (scheduled)
        ("Clayton Oliver", "Melbourne", "MID", 105.0),
        # Ruck players
        ("Max Gawn", "Melbourne", "RUC", 98.0),
        ("Reilly O'Brien", "Adelaide", "RUC", 85.0),
    ]
    for name, team, pos, sc_avg in player_specs:
        p = AflPlayer(name=name, afl_team=team, position=pos, sc_avg=sc_avg, age=27)
        db.session.add(p)
        players.append(p)
    db.session.flush()

    # Rosters: split players between teams
    for i, p in enumerate(players):
        team = team_a if i % 2 == 0 else team_b
        db.session.add(FantasyRoster(team_id=team.id, player_id=p.id))

    # Fixture: Team Alpha vs Team Beta, Round 1
    fixture = Fixture(
        league_id=league.id, afl_round=1, year=2026,
        home_team_id=team_a.id, away_team_id=team_b.id,
        status="scheduled",
    )
    db.session.add(fixture)
    db.session.flush()

    # Build player lookup by name
    player_map = {p.name: p for p in players}

    db.session.commit()

    return {
        "commissioner": commissioner,
        "manager": manager,
        "league": league,
        "team_a": team_a,
        "team_b": team_b,
        "players": player_map,
        "fixture": fixture,
    }

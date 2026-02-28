"""Tests for the live scoring system (Phases 1-7).

Tests cover:
  1. DB models: AflGame, LiveScoringConfig, PlayerStat.is_live
  2. Squiggle client: team name mapping, game status parsing
  3. Footywire live scraper: SC score parsing, caching
  4. Live sync: schedule upsert, score sync, lockout IDs, rescore matchups
  5. Lineup lockouts: rolling per-game lockout enforcement
  6. API endpoint: /live/<round>/api/scores JSON response
  7. SocketIO: join/leave rooms, score_update events
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from models.database import (
    db as _db, AflGame, LiveScoringConfig, PlayerStat, AflPlayer,
    WeeklyLineup, LineupSlot, Fixture, RoundScore,
)


# ── Phase 1: DB Model Tests ─────────────────────────────────────────


class TestAflGameModel:
    """Test the AflGame model CRUD and constraints."""

    def test_create_afl_game(self, app, db):
        game = AflGame(
            id=12345, year=2026, afl_round=1,
            home_team="Adelaide", away_team="Carlton",
            venue="Adelaide Oval", status="scheduled",
        )
        db.session.add(game)
        db.session.commit()

        fetched = db.session.get(AflGame, 12345)
        assert fetched is not None
        assert fetched.home_team == "Adelaide"
        assert fetched.away_team == "Carlton"
        assert fetched.status == "scheduled"

    def test_afl_game_unique_constraint(self, app, db):
        game1 = AflGame(id=1, year=2026, afl_round=1, home_team="Adelaide", away_team="Carlton")
        game2 = AflGame(id=2, year=2026, afl_round=1, home_team="Adelaide", away_team="Melbourne")
        db.session.add(game1)
        db.session.commit()
        db.session.add(game2)
        with pytest.raises(Exception):  # IntegrityError — unique on (year, round, home_team)
            db.session.commit()

    def test_afl_game_status_transitions(self, app, db):
        game = AflGame(id=99, year=2026, afl_round=1,
                       home_team="Geelong", away_team="Sydney", status="scheduled")
        db.session.add(game)
        db.session.commit()

        game.status = "live"
        db.session.commit()
        assert db.session.get(AflGame, 99).status == "live"

        game.status = "complete"
        game.home_score = 95
        game.away_score = 78
        db.session.commit()
        fetched = db.session.get(AflGame, 99)
        assert fetched.status == "complete"
        assert fetched.home_score == 95


class TestLiveScoringConfig:
    """Test the LiveScoringConfig model."""

    def test_create_live_config(self, app, db, seed_data):
        config = LiveScoringConfig.query.get(seed_data["league"].id)
        assert config is not None
        assert config.enabled is True
        assert config.poll_interval_seconds == 120
        assert config.lockout_type == "game_start"

    def test_update_live_config(self, app, db, seed_data):
        config = LiveScoringConfig.query.get(seed_data["league"].id)
        config.enabled = False
        config.poll_interval_seconds = 300
        config.lockout_type = "round_start"
        db.session.commit()

        refreshed = LiveScoringConfig.query.get(seed_data["league"].id)
        assert refreshed.enabled is False
        assert refreshed.poll_interval_seconds == 300
        assert refreshed.lockout_type == "round_start"


class TestPlayerStatIsLive:
    """Test the is_live flag on PlayerStat."""

    def test_player_stat_is_live_default(self, app, db, seed_data):
        player = seed_data["players"]["Jordan Dawson"]
        stat = PlayerStat(
            player_id=player.id, year=2026, round=1,
            supercoach_score=95,
        )
        db.session.add(stat)
        db.session.commit()

        fetched = PlayerStat.query.filter_by(player_id=player.id, year=2026, round=1).first()
        assert fetched.is_live is False  # default

    def test_player_stat_is_live_set(self, app, db, seed_data):
        player = seed_data["players"]["Patrick Cripps"]
        stat = PlayerStat(
            player_id=player.id, year=2026, round=1,
            supercoach_score=120, is_live=True,
        )
        db.session.add(stat)
        db.session.commit()

        fetched = PlayerStat.query.filter_by(player_id=player.id, year=2026, round=1).first()
        assert fetched.is_live is True


# ── Phase 2: Squiggle Client Tests ──────────────────────────────────


class TestSquiggleClient:
    """Test Squiggle API client helper functions."""

    def test_normalise_team_names(self):
        from scrapers.squiggle import normalise_team_name
        assert normalise_team_name("Greater Western Sydney") == "GWS"
        assert normalise_team_name("Brisbane Lions") == "Brisbane Lions"
        assert normalise_team_name("Brisbane") == "Brisbane Lions"
        assert normalise_team_name("Adelaide") == "Adelaide"
        assert normalise_team_name("St Kilda") == "St Kilda"
        assert normalise_team_name("Unknown Team") == "Unknown Team"

    def test_parse_game_status(self):
        from scrapers.squiggle import parse_game_status
        assert parse_game_status({"complete": 100, "is_live": False}) == "complete"
        assert parse_game_status({"complete": 0, "is_live": True}) == "live"
        assert parse_game_status({"complete": 0, "is_live": False}) == "scheduled"
        # Edge case: complete + is_live both set — complete wins
        assert parse_game_status({"complete": 100, "is_live": True}) == "complete"

    def test_parse_scheduled_start(self):
        from scrapers.squiggle import parse_scheduled_start

        dt = parse_scheduled_start({"date": "2026-03-19 19:40:00"})
        assert dt is not None
        assert dt.year == 2026
        assert dt.month == 3
        assert dt.hour == 19
        assert dt.minute == 40

        assert parse_scheduled_start({}) is None
        assert parse_scheduled_start({"date": None}) is None

    @patch("scrapers.squiggle.requests.get")
    def test_get_games_success(self, mock_get):
        from scrapers.squiggle import get_games

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "games": [
                {"id": 1, "hteam": "Adelaide", "ateam": "Carlton",
                 "complete": 0, "is_live": True, "hscore": 45, "ascore": 38}
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        games = get_games(2026, 1)
        assert len(games) == 1
        assert games[0]["hteam"] == "Adelaide"

        # Verify correct params sent
        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args
        assert call_kwargs[1]["params"]["q"] == "games"
        assert call_kwargs[1]["params"]["year"] == 2026
        assert call_kwargs[1]["params"]["round"] == 1

    @patch("scrapers.squiggle.requests.get")
    def test_get_games_api_failure(self, mock_get):
        from scrapers.squiggle import get_games
        import requests

        mock_get.side_effect = requests.RequestException("timeout")
        games = get_games(2026, 1)
        assert games == []  # graceful fallback


# ── Phase 3: Footywire Live Scraper Tests ────────────────────────────


class TestFootywireLiveScraper:
    """Test the Footywire live scraper helpers."""

    def test_normalise_team_mascot_names(self):
        """Test that mascot names (as returned by the real SC scores page) are mapped correctly."""
        from scrapers.footywire_live import normalise_team
        assert normalise_team("Crows") == "Adelaide"
        assert normalise_team("Lions") == "Brisbane Lions"
        assert normalise_team("Blues") == "Carlton"
        assert normalise_team("Magpies") == "Collingwood"
        assert normalise_team("Bombers") == "Essendon"
        assert normalise_team("Dockers") == "Fremantle"
        assert normalise_team("Cats") == "Geelong"
        assert normalise_team("Suns") == "Gold Coast"
        assert normalise_team("Giants") == "GWS"
        assert normalise_team("Hawks") == "Hawthorn"
        assert normalise_team("Demons") == "Melbourne"
        assert normalise_team("Kangaroos") == "North Melbourne"
        assert normalise_team("Power") == "Port Adelaide"
        assert normalise_team("Tigers") == "Richmond"
        assert normalise_team("Saints") == "St Kilda"
        assert normalise_team("Swans") == "Sydney"
        assert normalise_team("Eagles") == "West Coast"
        assert normalise_team("Bulldogs") == "Western Bulldogs"

    def test_normalise_team_abbreviations(self):
        """Test that abbreviation codes (from match stats pages) still work."""
        from scrapers.footywire_live import normalise_team
        assert normalise_team("ADE") == "Adelaide"
        assert normalise_team("BRL") == "Brisbane Lions"
        assert normalise_team("GWS") == "GWS"
        assert normalise_team("  Sydney  ") == "Sydney"

    def test_cache_clearing(self):
        from scrapers.footywire_live import _cache, clear_cache
        _cache["test_url"] = (0, "fake_soup")
        assert len(_cache) > 0
        clear_cache()
        assert len(_cache) == 0

    @patch("scrapers.footywire_live._get_cached")
    def test_scrape_live_sc_scores_parsing(self, mock_get):
        """Test that the SC score page parser correctly extracts rows.

        Uses mascot names (Crows, Blues, Demons) as the real Footywire SC page does.
        """
        from scrapers.footywire_live import scrape_live_sc_scores
        from bs4 import BeautifulSoup

        # Simulate a Footywire SC scores page — real page uses mascot names
        html = """
        <html><body><table>
        <tr><td>1</td><td><a href="pu-jordan-dawson">Jordan Dawson</a></td>
            <td>Crows</td><td>$500k</td><td>$510k</td><td>95</td><td>1.2</td></tr>
        <tr><td>2</td><td><a href="pu-patrick-cripps">Patrick Cripps</a></td>
            <td>Blues</td><td>$600k</td><td>$620k</td><td>120</td><td>1.5</td></tr>
        <tr><td>3</td><td><a href="pu-dnp-player">DNP Player</a></td>
            <td>Demons</td><td>$300k</td><td>$300k</td><td>0</td><td>0</td></tr>
        <tr><td>Bad row with no link</td><td>No</td><td>Link</td></tr>
        </table></body></html>
        """
        mock_get.return_value = BeautifulSoup(html, "lxml")

        results = scrape_live_sc_scores(2026, 1)

        assert len(results) == 3
        assert results[0]["name"] == "Jordan Dawson"
        assert results[0]["team"] == "Adelaide"  # "Crows" → "Adelaide"
        assert results[0]["sc_score"] == 95
        assert results[1]["name"] == "Patrick Cripps"
        assert results[1]["team"] == "Carlton"  # "Blues" → "Carlton"
        assert results[1]["sc_score"] == 120
        assert results[2]["team"] == "Melbourne"  # "Demons" → "Melbourne"
        assert results[2]["sc_score"] == 0


# ── Phase 4: Live Sync Tests ────────────────────────────────────────


class TestSyncGameSchedule:
    """Test sync_game_schedule — upserts AflGame rows from Squiggle data."""

    @patch("models.live_sync.squiggle_get_games")
    def test_sync_creates_new_games(self, mock_squiggle, app, db, seed_data):
        from models.live_sync import sync_game_schedule

        mock_squiggle.return_value = [
            {
                "id": 101, "hteam": "Adelaide", "ateam": "Carlton",
                "date": "2026-03-19 19:40:00", "venue": "Adelaide Oval",
                "complete": 0, "is_live": False, "hscore": None, "ascore": None,
            },
            {
                "id": 102, "hteam": "Geelong", "ateam": "Melbourne",
                "date": "2026-03-20 13:10:00", "venue": "MCG",
                "complete": 0, "is_live": False, "hscore": None, "ascore": None,
            },
        ]

        count = sync_game_schedule(2026, 1)
        assert count == 2

        game1 = db.session.get(AflGame, 101)
        assert game1 is not None
        assert game1.home_team == "Adelaide"
        assert game1.away_team == "Carlton"
        assert game1.status == "scheduled"

        game2 = db.session.get(AflGame, 102)
        assert game2.venue == "MCG"

    @patch("models.live_sync.squiggle_get_games")
    def test_sync_updates_existing_game(self, mock_squiggle, app, db, seed_data):
        from models.live_sync import sync_game_schedule

        # First sync — create game
        mock_squiggle.return_value = [{
            "id": 201, "hteam": "Adelaide", "ateam": "Carlton",
            "date": "2026-03-19 19:40:00", "venue": "AO",
            "complete": 0, "is_live": False, "hscore": 0, "ascore": 0,
        }]
        sync_game_schedule(2026, 1)
        assert db.session.get(AflGame, 201).status == "scheduled"

        # Second sync — game is now live
        mock_squiggle.return_value = [{
            "id": 201, "hteam": "Adelaide", "ateam": "Carlton",
            "date": "2026-03-19 19:40:00", "venue": "AO",
            "complete": 0, "is_live": True, "hscore": 45, "ascore": 38,
        }]
        sync_game_schedule(2026, 1)
        game = db.session.get(AflGame, 201)
        assert game.status == "live"
        assert game.home_score == 45
        assert game.away_score == 38

    @patch("models.live_sync.squiggle_get_games")
    def test_sync_with_gws_name_mapping(self, mock_squiggle, app, db, seed_data):
        from models.live_sync import sync_game_schedule

        mock_squiggle.return_value = [{
            "id": 301, "hteam": "Greater Western Sydney", "ateam": "Brisbane",
            "date": "2026-03-20 16:00:00", "venue": "Engie Stadium",
            "complete": 0, "is_live": False, "hscore": None, "ascore": None,
        }]
        sync_game_schedule(2026, 1)
        game = db.session.get(AflGame, 301)
        assert game.home_team == "GWS"
        assert game.away_team == "Brisbane Lions"


class TestGetLockedPlayerIds:
    """Test rolling per-game lockout detection."""

    def test_no_games_no_lockouts(self, app, db, seed_data):
        from models.live_sync import get_locked_player_ids
        locked = get_locked_player_ids(1, 2026)
        assert locked == set()  # no AflGame rows → no lockouts

    def test_live_game_locks_both_teams(self, app, db, seed_data):
        from models.live_sync import get_locked_player_ids

        # Adelaide vs Carlton is live
        db.session.add(AflGame(
            id=501, year=2026, afl_round=1,
            home_team="Adelaide", away_team="Carlton",
            status="live",
        ))
        db.session.commit()

        locked = get_locked_player_ids(1, 2026)
        players = seed_data["players"]

        # All Adelaide + Carlton players should be locked
        assert players["Jordan Dawson"].id in locked
        assert players["Rory Laird"].id in locked
        assert players["Ben Keays"].id in locked
        assert players["Reilly O'Brien"].id in locked  # Adelaide RUC
        assert players["Patrick Cripps"].id in locked
        assert players["Sam Walsh"].id in locked

        # Geelong + Melbourne players should NOT be locked
        assert players["Jeremy Cameron"].id not in locked
        assert players["Tom Stewart"].id not in locked
        assert players["Clayton Oliver"].id not in locked
        assert players["Max Gawn"].id not in locked

    def test_complete_game_also_locks(self, app, db, seed_data):
        from models.live_sync import get_locked_player_ids

        db.session.add(AflGame(
            id=502, year=2026, afl_round=1,
            home_team="Geelong", away_team="Melbourne",
            status="complete",
        ))
        db.session.commit()

        locked = get_locked_player_ids(1, 2026)
        players = seed_data["players"]
        assert players["Jeremy Cameron"].id in locked
        assert players["Max Gawn"].id in locked

    def test_scheduled_game_no_lockout(self, app, db, seed_data):
        from models.live_sync import get_locked_player_ids

        db.session.add(AflGame(
            id=503, year=2026, afl_round=1,
            home_team="Geelong", away_team="Melbourne",
            status="scheduled",
        ))
        db.session.commit()

        locked = get_locked_player_ids(1, 2026)
        assert len(locked) == 0


class TestSyncLiveScores:
    """Test the main sync_live_scores orchestrator."""

    @patch("models.live_sync.scrape_live_round")
    @patch("models.live_sync.squiggle_get_games")
    def test_sync_creates_player_stats(self, mock_squiggle, mock_scrape, app, db, seed_data):
        from models.live_sync import sync_live_scores

        # Setup: Adelaide vs Carlton is live
        mock_squiggle.return_value = [{
            "id": 601, "hteam": "Adelaide", "ateam": "Carlton",
            "date": "2026-03-19 19:40:00", "venue": "AO",
            "complete": 0, "is_live": True, "hscore": 50, "ascore": 42,
        }]

        mock_scrape.return_value = [
            {"name": "Jordan Dawson", "team": "Adelaide", "sc_score": 95},
            {"name": "Patrick Cripps", "team": "Carlton", "sc_score": 120},
            {"name": "Jeremy Cameron", "team": "Geelong", "sc_score": 80},  # not in active game
        ]

        sync_live_scores(2026, 1)

        # Jordan Dawson should have a PlayerStat with is_live=True
        dawson = seed_data["players"]["Jordan Dawson"]
        stat = PlayerStat.query.filter_by(player_id=dawson.id, year=2026, round=1).first()
        assert stat is not None
        assert stat.supercoach_score == 95
        assert stat.is_live is True

        # Cripps too
        cripps = seed_data["players"]["Patrick Cripps"]
        stat2 = PlayerStat.query.filter_by(player_id=cripps.id, year=2026, round=1).first()
        assert stat2.supercoach_score == 120
        assert stat2.is_live is True

        # Jeremy Cameron should NOT have a stat (Geelong not in an active game)
        cameron = seed_data["players"]["Jeremy Cameron"]
        stat3 = PlayerStat.query.filter_by(player_id=cameron.id, year=2026, round=1).first()
        assert stat3 is None

    @patch("models.live_sync.scrape_live_round")
    @patch("models.live_sync.squiggle_get_games")
    def test_sync_updates_existing_stats(self, mock_squiggle, mock_scrape, app, db, seed_data):
        from models.live_sync import sync_live_scores

        dawson = seed_data["players"]["Jordan Dawson"]

        # Pre-existing stat with lower score
        db.session.add(PlayerStat(
            player_id=dawson.id, year=2026, round=1,
            supercoach_score=60, is_live=True,
        ))
        db.session.commit()

        mock_squiggle.return_value = [{
            "id": 701, "hteam": "Adelaide", "ateam": "Carlton",
            "complete": 0, "is_live": True, "hscore": 55, "ascore": 48,
        }]
        mock_scrape.return_value = [
            {"name": "Jordan Dawson", "team": "Adelaide", "sc_score": 95},
        ]

        sync_live_scores(2026, 1)

        stat = PlayerStat.query.filter_by(player_id=dawson.id, year=2026, round=1).first()
        assert stat.supercoach_score == 95  # updated from 60 → 95

    @patch("models.live_sync.scrape_live_round")
    @patch("models.live_sync.squiggle_get_games")
    def test_sync_finalises_complete_game(self, mock_squiggle, mock_scrape, app, db, seed_data):
        from models.live_sync import sync_live_scores

        mock_squiggle.return_value = [{
            "id": 801, "hteam": "Adelaide", "ateam": "Carlton",
            "complete": 100, "is_live": False, "hscore": 95, "ascore": 78,
        }]
        mock_scrape.return_value = [
            {"name": "Jordan Dawson", "team": "Adelaide", "sc_score": 110},
        ]

        sync_live_scores(2026, 1)

        dawson = seed_data["players"]["Jordan Dawson"]
        stat = PlayerStat.query.filter_by(player_id=dawson.id, year=2026, round=1).first()
        assert stat.is_live is False  # game complete → finalised

    @patch("models.live_sync.scrape_live_round")
    @patch("models.live_sync.squiggle_get_games")
    def test_sync_rescores_fixture(self, mock_squiggle, mock_scrape, app, db, seed_data):
        """Verify that syncing live scores triggers fixture score updates."""
        from models.live_sync import sync_live_scores

        fixture = seed_data["fixture"]
        team_a = seed_data["team_a"]
        dawson = seed_data["players"]["Jordan Dawson"]

        # Create a lineup for team_a with Dawson on field
        lineup = WeeklyLineup(team_id=team_a.id, afl_round=1, year=2026)
        db.session.add(lineup)
        db.session.flush()
        db.session.add(LineupSlot(
            lineup_id=lineup.id, player_id=dawson.id,
            position_code="DEF", is_captain=True,
        ))
        db.session.commit()

        mock_squiggle.return_value = [{
            "id": 901, "hteam": "Adelaide", "ateam": "Carlton",
            "complete": 0, "is_live": True, "hscore": 50, "ascore": 42,
        }]
        mock_scrape.return_value = [
            {"name": "Jordan Dawson", "team": "Adelaide", "sc_score": 95},
        ]

        changed = sync_live_scores(2026, 1)

        # Fixture should now have a score
        db.session.refresh(fixture)
        assert fixture.home_score is not None
        assert fixture.home_score > 0

        # RoundScore should exist
        rs = RoundScore.query.filter_by(team_id=team_a.id, afl_round=1, year=2026).first()
        assert rs is not None
        assert rs.total_score > 0

        # Changed data should include our league
        assert seed_data["league"].id in changed


# ── Phase 5: Lineup Lockout Enforcement Tests ───────────────────────


class TestLineupLockoutEnforcement:
    """Test that set_lineup() blocks moving locked players.

    Roster assignments from seed_data (even indices → team_a, odd → team_b):
        team_a: Jordan Dawson (ADE), Ben Keays (ADE), Sam Walsh (CAR),
                Jeremy Cameron (GEE), Max Gawn (MEL)
        team_b: Rory Laird (ADE), Patrick Cripps (CAR), Tom Stewart (GEE),
                Clayton Oliver (MEL), Reilly O'Brien (ADE)
    """

    def _setup_lineup_and_game(self, db, seed_data):
        """Helper: create a lineup for team_a and a live Adelaide vs Carlton game.

        team_a roster: Dawson(ADE), Keays(ADE), Walsh(CAR), Stewart(GEE), Gawn(MEL)
        Dawson (Adelaide, idx 0) → on team_a, will be LOCKED (ADE game is live)
        Tom Stewart (Geelong, idx 6) → on team_a, will be UNLOCKED (GEE not playing)
        """
        team_a = seed_data["team_a"]
        dawson = seed_data["players"]["Jordan Dawson"]   # ADE → locked
        stewart = seed_data["players"]["Tom Stewart"]     # GEE → unlocked

        # Create a lineup with Dawson at DEF and Stewart at DEF
        lineup = WeeklyLineup(team_id=team_a.id, afl_round=1, year=2026)
        db.session.add(lineup)
        db.session.flush()
        db.session.add(LineupSlot(
            lineup_id=lineup.id, player_id=dawson.id, position_code="DEF"
        ))
        db.session.add(LineupSlot(
            lineup_id=lineup.id, player_id=stewart.id, position_code="DEF"
        ))
        db.session.commit()

        # Adelaide vs Carlton is live → Dawson (ADE) locked, Stewart (GEE) not
        db.session.add(AflGame(
            id=1001, year=2026, afl_round=1,
            home_team="Adelaide", away_team="Carlton", status="live",
        ))
        db.session.commit()

        return lineup, dawson, stewart

    def test_locked_player_cannot_change_position(self, app, db, seed_data):
        from models.lineup_manager import set_lineup

        lineup, dawson, stewart = self._setup_lineup_and_game(db, seed_data)
        team_a = seed_data["team_a"]
        league = seed_data["league"]

        # Try to move Dawson (locked, ADE game live) from DEF to BENCH
        slot_data = [
            {"player_id": dawson.id, "position_code": "BENCH"},  # was DEF!
            {"player_id": stewart.id, "position_code": "DEF"},
        ]
        result, error = set_lineup(team_a.id, 1, 2026, slot_data, league.id)
        assert error is not None
        assert "locked" in error.lower()

    def test_locked_player_can_stay_same_position(self, app, db, seed_data):
        from models.lineup_manager import set_lineup

        lineup, dawson, stewart = self._setup_lineup_and_game(db, seed_data)
        team_a = seed_data["team_a"]
        league = seed_data["league"]

        # Keep Dawson at DEF (same position) — should succeed
        slot_data = [
            {"player_id": dawson.id, "position_code": "DEF"},
            {"player_id": stewart.id, "position_code": "DEF"},
        ]
        result, error = set_lineup(team_a.id, 1, 2026, slot_data, league.id)
        assert error is None

    def test_unlocked_player_can_move_freely(self, app, db, seed_data):
        from models.lineup_manager import set_lineup

        lineup, dawson, stewart = self._setup_lineup_and_game(db, seed_data)
        team_a = seed_data["team_a"]
        league = seed_data["league"]

        # Stewart (Geelong, not locked) can move from DEF to BENCH
        slot_data = [
            {"player_id": dawson.id, "position_code": "DEF"},
            {"player_id": stewart.id, "position_code": "BENCH"},  # was DEF
        ]
        result, error = set_lineup(team_a.id, 1, 2026, slot_data, league.id)
        assert error is None


# ── Phase 6: Game Status & Breakdown Helpers ─────────────────────────


class TestGameStatusHelpers:
    """Test get_game_statuses and get_player_score_breakdown."""

    def test_get_game_statuses(self, app, db, seed_data):
        from models.live_sync import get_game_statuses

        db.session.add(AflGame(
            id=1101, year=2026, afl_round=1,
            home_team="Adelaide", away_team="Carlton",
            status="live", home_score=55, away_score=42,
            scheduled_start=datetime(2026, 3, 19, 19, 40),
        ))
        db.session.commit()

        statuses = get_game_statuses(1, 2026)
        assert len(statuses) == 1
        assert statuses[0]["game_id"] == 1101
        assert statuses[0]["status"] == "live"
        assert statuses[0]["home_team"] == "Adelaide"
        assert statuses[0]["home_score"] == 55

    def test_get_player_score_breakdown(self, app, db, seed_data):
        from models.live_sync import get_player_score_breakdown

        team_a = seed_data["team_a"]
        dawson = seed_data["players"]["Jordan Dawson"]

        # Setup lineup + stat
        lineup = WeeklyLineup(team_id=team_a.id, afl_round=1, year=2026)
        db.session.add(lineup)
        db.session.flush()
        db.session.add(LineupSlot(
            lineup_id=lineup.id, player_id=dawson.id,
            position_code="DEF", is_captain=True,
        ))
        db.session.add(PlayerStat(
            player_id=dawson.id, year=2026, round=1,
            supercoach_score=95, is_live=True,
        ))
        db.session.commit()

        breakdown = get_player_score_breakdown(team_a.id, 1, 2026)
        assert len(breakdown) == 1
        assert breakdown[0]["name"] == "Jordan Dawson"
        assert breakdown[0]["score"] == 95
        assert breakdown[0]["is_live"] is True
        assert breakdown[0]["is_captain"] is True


# ── Phase 7: API Endpoint Test ───────────────────────────────────────


class TestApiLiveScores:
    """Test the /live/<round>/api/scores JSON endpoint."""

    def test_api_returns_json(self, app, db, seed_data):
        from flask_login import FlaskLoginClient
        app.test_client_class = FlaskLoginClient

        commissioner = seed_data["commissioner"]
        league = seed_data["league"]

        with app.test_client(user=commissioner) as client:
            resp = client.get(f"/leagues/{league.id}/live/1/api/scores")
            assert resp.status_code == 200
            data = resp.get_json()
            assert "fixtures" in data
            assert "game_statuses" in data
            assert "locked_player_ids" in data
            assert isinstance(data["fixtures"], list)
            assert isinstance(data["locked_player_ids"], list)

    def test_api_returns_fixture_data(self, app, db, seed_data):
        from flask_login import FlaskLoginClient
        app.test_client_class = FlaskLoginClient

        commissioner = seed_data["commissioner"]
        league = seed_data["league"]

        with app.test_client(user=commissioner) as client:
            resp = client.get(f"/leagues/{league.id}/live/1/api/scores")
            data = resp.get_json()
            # We have one fixture (Team Alpha vs Team Beta)
            assert len(data["fixtures"]) == 1
            f = data["fixtures"][0]
            assert "fixture_id" in f
            assert "home_score" in f
            assert "away_score" in f
            assert "home_players" in f
            assert "away_players" in f

    def test_api_404_for_missing_league(self, app, db, seed_data):
        from flask_login import FlaskLoginClient
        app.test_client_class = FlaskLoginClient

        commissioner = seed_data["commissioner"]

        with app.test_client(user=commissioner) as client:
            resp = client.get("/leagues/99999/live/1/api/scores")
            assert resp.status_code == 404

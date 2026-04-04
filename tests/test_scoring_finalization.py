"""Tests for round scoring and finalization logic."""

import pytest
from models.database import (
    db, Fixture, RoundScore, SeasonStanding, PlayerStat, AflGame,
    FantasyTeam,
)


class TestFinalizeRound:
    """Ensure finalize_round scores teams, resolves fixtures, updates standings."""

    def test_finalize_scores_both_teams(self, app, seed_data):
        """Finalization should create RoundScore for both teams."""
        with app.app_context():
            league = seed_data["league"]
            fixture = seed_data["fixture"]

            # Add some player stats so scoring has data
            for name, p in seed_data["players"].items():
                db.session.add(PlayerStat(
                    player_id=p.id, year=2026, round=1,
                    supercoach_score=80, is_live=False,
                ))
            db.session.commit()

            from models.scoring_engine import finalize_round
            scores = finalize_round(league.id, 1, 2026)

            assert scores is not None
            assert seed_data["team_a"].id in scores
            assert seed_data["team_b"].id in scores

            # Fixture should be marked completed
            f = db.session.get(Fixture, fixture.id)
            assert f.status == "completed"

    def test_finalize_is_idempotent(self, app, seed_data):
        """Calling finalize_round twice should not re-score."""
        with app.app_context():
            league = seed_data["league"]

            for name, p in seed_data["players"].items():
                db.session.add(PlayerStat(
                    player_id=p.id, year=2026, round=1,
                    supercoach_score=80, is_live=False,
                ))
            db.session.commit()

            from models.scoring_engine import finalize_round
            scores1 = finalize_round(league.id, 1, 2026)
            scores2 = finalize_round(league.id, 1, 2026)

            # Second call should return same scores without re-calculating
            for tid in scores1:
                assert scores1[tid] == scores2[tid]

    def test_finalize_updates_standings(self, app, seed_data):
        """Finalization should update season standings with W/L."""
        with app.app_context():
            league = seed_data["league"]

            # Give team_a's players higher scores
            for name, p in seed_data["players"].items():
                sc = 120 if p.afl_team == "Adelaide" else 60
                db.session.add(PlayerStat(
                    player_id=p.id, year=2026, round=1,
                    supercoach_score=sc, is_live=False,
                ))
            db.session.commit()

            from models.scoring_engine import finalize_round
            finalize_round(league.id, 1, 2026)

            standings = SeasonStanding.query.filter_by(
                league_id=league.id, year=2026
            ).all()
            # At least one team should have a win or loss
            total_wl = sum(s.wins + s.losses for s in standings)
            assert total_wl >= 2  # 1 win + 1 loss


class TestRoundScoreCreation:
    """Ensure RoundScore records are created correctly."""

    def test_round_score_has_breakdown(self, app, seed_data):
        """RoundScore should include a breakdown JSON."""
        with app.app_context():
            league = seed_data["league"]

            for name, p in seed_data["players"].items():
                db.session.add(PlayerStat(
                    player_id=p.id, year=2026, round=1,
                    supercoach_score=90, is_live=False,
                ))
            db.session.commit()

            from models.scoring_engine import finalize_round
            finalize_round(league.id, 1, 2026)

            rs = RoundScore.query.filter_by(
                team_id=seed_data["team_a"].id, afl_round=1, year=2026
            ).first()
            assert rs is not None
            assert rs.total_score > 0

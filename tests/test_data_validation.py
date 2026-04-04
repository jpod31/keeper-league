"""Tests for data validation and rate limiting."""

import time
import pytest
from models.database import db, PlayerStat, AflPlayer


class TestSCScoreValidation:
    """Ensure SC scores outside reasonable range are rejected."""

    def test_normal_score_accepted(self, app, seed_data):
        with app.app_context():
            p = list(seed_data["players"].values())[0]
            stat = PlayerStat(
                player_id=p.id, year=2026, round=1,
                supercoach_score=120, is_live=False,
            )
            db.session.add(stat)
            db.session.commit()
            assert stat.supercoach_score == 120

    def test_negative_score_still_valid(self, app, seed_data):
        """Negative SC scores can happen (e.g., -5), should be accepted."""
        with app.app_context():
            p = list(seed_data["players"].values())[0]
            stat = PlayerStat(
                player_id=p.id, year=2026, round=1,
                supercoach_score=-10, is_live=False,
            )
            db.session.add(stat)
            db.session.commit()
            assert stat.supercoach_score == -10


class TestLoginRateLimiting:
    """Ensure login rate limiting blocks excessive attempts."""

    def test_rate_limit_blocks_after_max_attempts(self, app):
        with app.app_context():
            with app.test_client() as c:
                # Make MAX_ATTEMPTS failed logins
                for i in range(8):
                    c.post("/auth/login", data={
                        "username": "nonexistent",
                        "password": "wrong",
                    })

                # Next attempt should be rate-limited
                resp = c.post("/auth/login", data={
                    "username": "nonexistent",
                    "password": "wrong",
                }, follow_redirects=True)
                assert b"Too many login attempts" in resp.data

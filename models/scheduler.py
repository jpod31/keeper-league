"""APScheduler integration for background live-scoring jobs.

Jobs:
  1. _poll_live_scores  — cron: Thu-Sun at 11pm AEST, plus Sat at 5pm AEST
  2. _sync_round_schedule — daily at 6am UTC, populates AflGame with bounce times
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

# These are set by init_scheduler()
_app = None
_socketio = None


def init_scheduler(app, socketio):
    """Register jobs and start the scheduler. Called from app.py."""
    global _app, _socketio
    _app = app
    _socketio = socketio

    # Score sync: Thu-Sun at 11pm AEST (13:00 UTC)
    scheduler.add_job(
        _poll_live_scores,
        "cron",
        day_of_week="thu,fri,sat,sun",
        hour=13,
        minute=0,
        id="nightly_score_sync",
        replace_existing=True,
        max_instances=1,
    )
    # Extra Saturday sync at 5pm AEST (07:00 UTC)
    scheduler.add_job(
        _poll_live_scores,
        "cron",
        day_of_week="sat",
        hour=7,
        minute=0,
        id="saturday_afternoon_sync",
        replace_existing=True,
        max_instances=1,
    )
    # Daily schedule sync at 06:00 UTC
    scheduler.add_job(
        _sync_round_schedule,
        "cron",
        hour=6,
        minute=0,
        id="daily_schedule_sync",
        replace_existing=True,
    )
    # Weekly position sync: Tuesday 04:00 UTC (after weekend rounds)
    scheduler.add_job(
        _sync_positions,
        "cron",
        day_of_week="tue",
        hour=4,
        minute=0,
        id="weekly_position_sync",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Scheduler started (score sync: Thu-Sun 11pm + Sat 5pm AEST, schedule sync: daily 06:00 UTC, position sync: Tue 04:00 UTC)")


def run_manual_score_sync():
    """Trigger a score sync on demand (called from the gameday manual sync route)."""
    _poll_live_scores()


def _poll_live_scores():
    """Poll for live AFL scores and push updates via SocketIO."""
    if not _app or not _socketio:
        return

    with _app.app_context():
        try:
            from models.database import AflGame
            from models.live_sync import sync_live_scores, get_game_statuses, get_locked_player_ids
            from scrapers.squiggle import get_current_round
            import config

            year = config.CURRENT_YEAR

            # Determine active round
            active_round = _get_active_round(year)
            if active_round is None:
                return

            # Check if any games are live
            live_games = AflGame.query.filter_by(
                year=year, afl_round=active_round, status="live"
            ).all()
            if not live_games:
                # Also check for recently completed games that might need final scoring
                recent_complete = AflGame.query.filter_by(
                    year=year, afl_round=active_round, status="complete"
                ).all()
                if not recent_complete:
                    logger.debug("No live/recent games for R%d, skipping poll", active_round)
                    return

            # Sync scores
            changed_data = sync_live_scores(year, active_round)

            # Broadcast via SocketIO
            if changed_data:
                game_statuses = get_game_statuses(active_round, year)
                locked_ids = list(get_locked_player_ids(active_round, year))

                for league_id, fixtures_data in changed_data.items():
                    _broadcast_score_update(
                        league_id, active_round,
                        fixtures_data, game_statuses, locked_ids
                    )

        except Exception:
            logger.exception("Error in live score poll")


def _sync_round_schedule():
    """Daily job: sync AFL game schedule from Squiggle for current + next round."""
    if not _app:
        return

    with _app.app_context():
        try:
            from models.live_sync import sync_game_schedule
            from scrapers.squiggle import get_current_round
            import config

            year = config.CURRENT_YEAR
            current_round = get_current_round(year)
            if current_round is None:
                logger.info("Could not determine current AFL round from Squiggle")
                return

            # Sync current round and next round
            for rnd in [current_round, current_round + 1]:
                count = sync_game_schedule(year, rnd)
                logger.info("Daily schedule sync: %d R%d -> %d games", year, rnd, count)

        except Exception:
            logger.exception("Error in daily schedule sync")


def _sync_positions():
    """Weekly job: sync player positions from Footywire."""
    if not _app:
        return

    with _app.app_context():
        try:
            from scrapers.footywire import sync_player_positions
            changes = sync_player_positions()
            logger.info("Weekly position sync: %d changes", len(changes))
        except Exception:
            logger.exception("Error in weekly position sync")


def _get_active_round(year: int) -> int | None:
    """Determine the currently active round from the DB or Squiggle."""
    from models.database import AflGame

    # First check DB for any round with live games
    live_game = AflGame.query.filter_by(year=year, status="live").first()
    if live_game:
        return live_game.afl_round

    # Check Squiggle
    from scrapers.squiggle import get_current_round
    return get_current_round(year)


def _broadcast_score_update(league_id, afl_round, fixtures_data, game_statuses, locked_ids):
    """Push score update to all clients in the live room for this league/round."""
    if not _socketio:
        return

    import config
    from models.live_sync import get_player_score_breakdown
    from models.database import Fixture

    # Build full payload with player breakdowns
    fixture_list = []
    for fixture_id, fdata in fixtures_data.items():
        home_players = get_player_score_breakdown(
            fdata["home_team_id"], afl_round, fdata.get("year", config.CURRENT_YEAR), league_id
        )
        away_players = get_player_score_breakdown(
            fdata["away_team_id"], afl_round, fdata.get("year", config.CURRENT_YEAR), league_id
        )

        fixture_list.append({
            "fixture_id": fixture_id,
            "home_score": fdata["home_score"],
            "away_score": fdata["away_score"],
            "home_captain_bonus": fdata.get("home_captain_bonus", 0),
            "away_captain_bonus": fdata.get("away_captain_bonus", 0),
            "home_players": home_players,
            "away_players": away_players,
        })

    payload = {
        "fixtures": fixture_list,
        "game_statuses": game_statuses,
        "locked_player_ids": locked_ids,
    }

    room = f"live_{league_id}_{afl_round}"
    _socketio.emit("score_update", payload, room=room, namespace="/matchups")
    logger.debug("Broadcast score_update to room %s (%d fixtures)", room, len(fixture_list))

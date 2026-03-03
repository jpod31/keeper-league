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
    # Weekly email digest: Monday 08:00 UTC (6pm AEST)
    scheduler.add_job(
        _send_weekly_digest,
        "cron",
        day_of_week="mon",
        hour=8,
        minute=0,
        id="weekly_email_digest",
        replace_existing=True,
        max_instances=1,
    )
    # Daily season auto-transition check: 05:00 UTC
    scheduler.add_job(
        _check_season_transitions,
        "cron",
        hour=5,
        minute=0,
        id="daily_season_transition",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Scheduler started (score sync: Thu-Sun 11pm + Sat 5pm AEST, schedule sync: daily 06:00 UTC, position sync: Tue 04:00 UTC, digest: Mon 08:00 UTC, season check: daily 05:00 UTC)")


def schedule_round_finalization(year: int, afl_round: int):
    """Schedule a one-time job to finalize a round 45 minutes from now.

    If the job already exists (timer already running), skip to avoid resetting it.
    """
    from datetime import datetime, timedelta, timezone

    job_id = f"auto_finalize_{year}_R{afl_round}"

    # Don't reset the timer if already scheduled
    if scheduler.get_job(job_id):
        logger.info("Auto-finalize already scheduled for %d R%d, skipping", year, afl_round)
        return

    run_at = datetime.now(timezone.utc) + timedelta(minutes=45)
    scheduler.add_job(
        _auto_finalize_round,
        "date",
        run_date=run_at,
        args=[year, afl_round],
        id=job_id,
        replace_existing=False,
        max_instances=1,
    )
    logger.info("Auto-finalize scheduled for %d R%d at %s", year, afl_round, run_at.isoformat())


def _auto_finalize_round(year: int, afl_round: int):
    """Delayed finalization: final score refresh then finalize all leagues."""
    if not _app:
        return

    with _app.app_context():
        try:
            from models.database import AflGame, Fixture, League
            from models.live_sync import sync_live_scores
            from models.scoring_engine import finalize_round

            # Verify all AFL games are still complete
            all_games = AflGame.query.filter_by(year=year, afl_round=afl_round).all()
            if not all_games or not all(g.status == "complete" for g in all_games):
                logger.warning(
                    "Auto-finalize aborted for %d R%d: not all games complete", year, afl_round
                )
                return

            # Final score refresh
            logger.info("Auto-finalize: running final score sync for %d R%d", year, afl_round)
            sync_live_scores(year, afl_round)

            # Find all leagues with fixtures for this round (or round 0 when AFL R1)
            rounds_to_check = [afl_round]
            if afl_round == 1:
                rounds_to_check.append(0)
            league_ids = (
                db.session.query(Fixture.league_id)
                .filter(Fixture.year == year, Fixture.afl_round.in_(rounds_to_check))
                .distinct()
                .all()
            )

            for (league_id,) in league_ids:
                try:
                    # When AFL R1 completes, finalize round 0 (pre-season)
                    # instead of round 1 if round 0 is still active
                    fantasy_round = afl_round
                    if afl_round == 1:
                        r0_active = Fixture.query.filter_by(
                            league_id=league_id, year=year, afl_round=0, is_final=False
                        ).filter(Fixture.status != "completed").first()
                        if r0_active:
                            fantasy_round = 0

                    finalize_round(league_id, fantasy_round, year)
                    logger.info("Auto-finalize: finalized league %d for %d R%d (fantasy R%d)",
                                league_id, year, afl_round, fantasy_round)
                except Exception:
                    logger.exception("Auto-finalize failed for league %d, %d R%d", league_id, year, afl_round)

            # Broadcast completion via SocketIO
            if _socketio:
                from models.live_sync import get_game_statuses, get_locked_player_ids
                game_statuses = get_game_statuses(afl_round, year)
                locked_ids = list(get_locked_player_ids(afl_round, year))
                for (league_id,) in league_ids:
                    _broadcast_score_update(
                        league_id, afl_round,
                        {}, game_statuses, locked_ids
                    )

            logger.info("Auto-finalize complete for %d R%d", year, afl_round)

        except Exception:
            logger.exception("Error in auto-finalize for %d R%d", year, afl_round)


def run_manual_score_sync():
    """Trigger a score sync on demand (called from the gameday manual sync route)."""
    _poll_live_scores()


def _poll_live_scores():
    """Poll for live AFL scores and push updates via SocketIO.

    Retries up to 2 times on transient network failures before giving up.
    """
    if not _app or not _socketio:
        return

    import time as _time

    max_retries = 2
    for attempt in range(max_retries + 1):
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
                return  # Success — exit retry loop

            except Exception:
                if attempt < max_retries:
                    logger.warning("Live score poll attempt %d failed, retrying in 10s...",
                                   attempt + 1, exc_info=True)
                    _time.sleep(10)
                else:
                    logger.exception("Live score poll failed after %d attempts", max_retries + 1)


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


def _send_weekly_digest():
    """Weekly job: email a digest of the past week's activity to opted-in users."""
    if not _app:
        return

    with _app.app_context():
        try:
            from datetime import timedelta
            from models.database import User, Notification
            from flask_mail import Message as MailMessage
            from flask import render_template
            import config

            mail = _app.extensions.get("mail")
            if not mail or not config.MAIL_USERNAME:
                logger.debug("Email digest: mail not configured, skipping")
                return

            one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)

            # Find users who opted in to email digests
            users = User.query.filter_by(email_digest_enabled=True).all()
            sent = 0
            for user in users:
                if not user.email:
                    continue
                # Get their notifications from the past week
                notifs = Notification.query.filter(
                    Notification.user_id == user.id,
                    Notification.created_at >= one_week_ago,
                ).order_by(Notification.created_at.desc()).limit(50).all()

                if not notifs:
                    continue

                try:
                    msg = MailMessage(
                        subject="Keeper League — Weekly Digest",
                        recipients=[user.email],
                        html=render_template("email/digest.html",
                                             user=user, notifications=notifs),
                    )
                    mail.send(msg)
                    sent += 1
                except Exception:
                    logger.debug("Digest email failed for user %s", user.id, exc_info=True)

            logger.info("Weekly digest: sent to %d users", sent)

        except Exception:
            logger.exception("Error in weekly email digest")


def _check_season_transitions():
    """Daily job: check all leagues with auto-transition enabled."""
    if not _app:
        return

    with _app.app_context():
        try:
            from models.season_transitions import check_and_transition
            from models.database import SeasonConfig

            configs = SeasonConfig.query.filter_by(auto_transition_enabled=True).all()
            for cfg in configs:
                try:
                    check_and_transition(cfg.league_id)
                except Exception:
                    logger.exception("Auto-transition failed for league %d", cfg.league_id)

            if configs:
                logger.info("Season transition check: %d leagues checked", len(configs))
        except Exception:
            logger.exception("Error in season transition check")

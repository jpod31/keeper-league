"""Season auto-transition logic.

Checks date-based triggers and advances league season phase automatically.
Called daily by the scheduler job.
"""

import logging
from datetime import datetime, timezone

from models.database import db, League, SeasonConfig

logger = logging.getLogger(__name__)


def check_and_transition(league_id):
    """Compare current date to season config dates and auto-advance if needed."""
    league = db.session.get(League, league_id)
    if not league:
        return

    cfg = SeasonConfig.query.filter_by(
        league_id=league_id, year=league.season_year
    ).first()
    if not cfg or not cfg.auto_transition_enabled:
        return

    now = datetime.now(timezone.utc)
    phase = cfg.season_phase or "regular"
    changed = False

    # regular -> midseason (after finals_start_round - based on mid_season_draft_after_round)
    if phase == "regular" and cfg.mid_season_draft_after_round:
        # Check if we've passed the mid-season trigger round
        from models.database import Fixture
        completed_rounds = (
            db.session.query(db.func.max(Fixture.afl_round))
            .filter_by(league_id=league_id, year=league.season_year, status="completed")
            .scalar()
        ) or 0
        if completed_rounds >= cfg.mid_season_draft_after_round:
            cfg.season_phase = "midseason"
            changed = True
            logger.info("League %d: auto-transition regular -> midseason (round %d completed)",
                        league_id, completed_rounds)

    # Check date-based offseason transition
    if phase in ("regular", "midseason") and cfg.offseason_start_date:
        if now >= cfg.offseason_start_date.replace(tzinfo=timezone.utc):
            cfg.season_phase = "offseason"
            changed = True
            logger.info("League %d: auto-transition %s -> offseason (date reached)", league_id, phase)

    # offseason -> regular (new season start)
    if phase == "offseason" and cfg.season_start_date:
        if now >= cfg.season_start_date.replace(tzinfo=timezone.utc):
            # Roll over to new season
            new_year = league.season_year + 1
            league.season_year = new_year

            # Create new season config for the new year (copy key settings)
            new_cfg = SeasonConfig(
                league_id=league_id,
                year=new_year,
                num_regular_rounds=cfg.num_regular_rounds,
                finals_teams=cfg.finals_teams,
                finals_format=cfg.finals_format,
                points_per_win=cfg.points_per_win,
                points_per_draw=cfg.points_per_draw,
                season_phase="regular",
                mid_season_draft_enabled=cfg.mid_season_draft_enabled,
                mid_season_draft_after_round=cfg.mid_season_draft_after_round,
                mid_season_draft_picks=cfg.mid_season_draft_picks,
                mid_season_delist_required=cfg.mid_season_delist_required,
                mid_season_trade_enabled=cfg.mid_season_trade_enabled,
                mid_season_trade_mode=cfg.mid_season_trade_mode,
                mid_season_trade_after_round=cfg.mid_season_trade_after_round,
                mid_season_trade_until_round=cfg.mid_season_trade_until_round,
                mid_trade_duration_days=cfg.mid_trade_duration_days,
                mid_delist_duration_days=cfg.mid_delist_duration_days,
                offseason_trade_enabled=cfg.offseason_trade_enabled,
                offseason_delist_min=cfg.offseason_delist_min,
                ssp_enabled=cfg.ssp_enabled,
                ssp_slots=cfg.ssp_slots,
                ssp_cutoff_round=cfg.ssp_cutoff_round,
                auto_transition_enabled=cfg.auto_transition_enabled,
            )
            db.session.add(new_cfg)
            changed = True
            logger.info("League %d: auto-transition offseason -> new season %d", league_id, new_year)

    if changed:
        db.session.commit()

        # Notify all league members
        try:
            from models.database import FantasyTeam
            from models.notification_manager import create_notification
            teams = FantasyTeam.query.filter_by(league_id=league_id).all()
            new_phase = cfg.season_phase
            for team in teams:
                if team.owner_id:
                    create_notification(
                        user_id=team.owner_id,
                        league_id=league_id,
                        notif_type="season_transition",
                        title=f"Season phase changed to {new_phase}",
                        body=f"{league.name} has moved to the {new_phase} phase.",
                        link=f"/leagues/{league_id}/season",
                    )
        except Exception:
            logger.debug("Failed to send transition notifications", exc_info=True)

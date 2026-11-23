"""Set the off-season draft night and hold delistings open until it starts.

    python scripts/set_offseason_draft.py --league-id 3 --draft 2026-12-02T19:00
    python scripts/set_offseason_draft.py --league-id 3 --draft 2026-12-02T19:00 --create-session

--draft is Melbourne wall-clock. Idempotent: re-running confirms the state and
only notifies managers when something actually changed.

What it does:
  - SeasonConfig.supplemental_draft_date and offseason_close_date = the draft
    start (window datetimes are stored naive and read as UTC, so the Melbourne
    time is converted to its UTC instant).
  - Reopens this off-season's delist period with closes_at = the draft start.
    Same period, so the finish size (squad size less the draft places), the
    locked player pool and this year's draft picks all still apply.
  - --create-session also creates the scheduled draft session so the draft
    room counts down to it. DraftSession.scheduled_start is naive Melbourne
    wall-clock. The slots are rebuilt from the lists when the draft starts.
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

MELB = ZoneInfo("Australia/Melbourne")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--league-id", type=int, required=True)
    ap.add_argument("--draft", required=True, help="Melbourne time, YYYY-MM-DDTHH:MM")
    ap.add_argument("--create-session", action="store_true")
    ap.add_argument("--no-notify", action="store_true")
    args = ap.parse_args()

    local = datetime.fromisoformat(args.draft)
    utc_naive = local.replace(tzinfo=MELB).astimezone(timezone.utc).replace(tzinfo=None)

    from app import create_app
    from models.database import (
        db, League, SeasonConfig, DelistPeriod, DraftSession, FantasyTeam,
    )

    app = create_app()
    with app.app_context():
        league = db.session.get(League, args.league_id)
        if not league:
            sys.exit("League not found.")
        if league.status != "offseason":
            sys.exit(f"League is '{league.status}', not in its off-season.")
        cfg = SeasonConfig.query.filter_by(
            league_id=league.id, year=league.season_year).first()
        if not cfg:
            sys.exit("No season config for this year.")

        changed = []
        if cfg.supplemental_draft_date != utc_naive:
            print(f"draft date: {cfg.supplemental_draft_date} -> {utc_naive} UTC")
            cfg.supplemental_draft_date = utc_naive
            changed.append("draft")
        if cfg.offseason_close_date != utc_naive:
            print(f"deadline pin: {cfg.offseason_close_date} -> {utc_naive} UTC")
            cfg.offseason_close_date = utc_naive

        period = (DelistPeriod.query
                  .filter_by(league_id=league.id, year=league.season_year,
                             period_type="offseason")
                  .order_by(DelistPeriod.id.desc()).first())
        if not period:
            sys.exit("No off-season delist period exists to reopen.")
        if period.status != "open" or period.closes_at != utc_naive:
            print(f"delist period {period.id}: {period.status} closes {period.closes_at}"
                  f" -> open closes {utc_naive} UTC")
            period.status = "open"
            period.closes_at = utc_naive
            changed.append("delists")
        db.session.commit()

        if args.create_session:
            live = DraftSession.query.filter_by(
                league_id=league.id, is_mock=False, draft_round_type="supplemental",
            ).filter(DraftSession.status.in_(["scheduled", "paused", "in_progress"])).first()
            if live:
                if live.status == "scheduled" and live.scheduled_start != local:
                    print(f"draft session {live.id}: start {live.scheduled_start} -> {local}")
                    live.scheduled_start = local
                    db.session.commit()
                else:
                    print(f"draft session {live.id} already {live.status} for {live.scheduled_start}")
            else:
                from models.draft_live import create_draft_session
                sess, err = create_draft_session(league.id, supplemental=True)
                if err:
                    sys.exit(f"Could not create the draft: {err}")
                sess.scheduled_start = local
                db.session.commit()
                print(f"draft session {sess.id} created: {sess.total_rounds} rounds, starts {local}")
                changed.append("session")

        if changed and not args.no_notify and ("draft" in changed or "delists" in changed):
            from models.notification_manager import create_notification
            from models.season_manager import delist_requirement
            when = local.strftime("%a %d %b, %I:%M%p").replace(" 0", " ").replace("AM", "am").replace("PM", "pm")
            for t in FantasyTeam.query.filter_by(league_id=league.id).all():
                if not t.owner_id:
                    continue
                req = delist_requirement(period, t.id, league, cfg)
                if req["remaining"]:
                    body = (f"Delistings are open again until the draft starts. "
                            f"You are at {req['current_size']} and need to be at "
                            f"{req['target_size']} or fewer: {req['remaining']} to cut.")
                else:
                    body = ("Delistings are open again until the draft starts. "
                            f"Your list is at {req['current_size']}, so nothing more is required.")
                create_notification(
                    user_id=t.owner_id, league_id=league.id,
                    notif_type="season_transition",
                    title=f"Draft night: {when}",
                    body=body,
                    link=f"/leagues/{league.id}/team/{t.id}",
                )
            print("managers notified")

        print("done:", ", ".join(changed) or "nothing to change")


if __name__ == "__main__":
    main()

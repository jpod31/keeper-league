"""Rehearse draft night on a COPY of the live data. Local only.

Needs data/snap/now.db, a read-only backup of the production database with
emails rewritten (see CLAUDE.md). It never touches production: it copies that
file to data/snap/draftnight.db and works on the copy.

    python tools/rehearse_draft.py

Starts the scheduled supplemental draft, makes every pick (a mix of real
picks, auto picks and passes), and reports what state the league is left in.
"""
import os
import shutil
import sqlite3
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "data", "snap", "now.db")
DST = os.path.join(REPO, "data", "snap", "draftnight.db")

c = sqlite3.connect(SRC)
c.execute("pragma wal_checkpoint(truncate)")
c.close()
# A leftover -wal/-shm from an earlier run would be replayed over the fresh
# copy and leave it holding the finished draft, so clear them first.
for suffix in ("", "-wal", "-shm"):
    try:
        os.remove(DST + suffix)
    except FileNotFoundError:
        pass
shutil.copy(SRC, DST)

os.environ["DATABASE_URL"] = "sqlite:///" + DST.replace("\\", "/")
os.environ["FLASK_DEBUG"] = "0"
os.environ["RATINGS_XLSX_PATH"] = "C:/nonexistent.xlsx"
os.environ.pop("MAIL_USERNAME", None)
os.chdir(REPO)
sys.path.insert(0, REPO)

import app as appmod  # noqa: E402
from models.database import db, League, DraftSession, DraftPick, FantasyRoster, FantasyTeam, DelistPeriod, SeasonConfig  # noqa: E402
from models import draft_live  # noqa: E402

app = appmod.app
with app.app_context():
    league = db.session.get(League, 3)
    sess = (DraftSession.query.filter_by(league_id=3, is_mock=False, status="scheduled")
            .order_by(DraftSession.id.desc()).first())
    if sess is None:
        sys.exit("No scheduled draft in the copy. Is data/snap/now.db a fresh backup taken before the draft?")
    print("before: league", league.status, league.season_year, "| session", sess.id, sess.status,
          "| rounds", sess.total_rounds)
    sizes = {t.name: FantasyRoster.query.filter_by(team_id=t.id, is_active=True).count()
             for t in FantasyTeam.query.filter_by(league_id=3)}
    print("lists before:", sizes)

    res = draft_live.start_draft(sess.id)
    db.session.commit()
    print("start_draft ->", res if not isinstance(res, tuple) else res)
    db.session.refresh(sess)
    print("after start: session", sess.status, "| league", db.session.get(League, 3).status)
    print("delist periods open:", DelistPeriod.query.filter_by(league_id=3, status="open").count())
    cfg = SeasonConfig.query.filter_by(league_id=3, year=league.season_year).first()
    print("trade window open now:", db.session.get(League, 3).trade_window_open, "| close", cfg.off_trade_window_close)
    total = DraftPick.query.filter_by(draft_session_id=sess.id).count()
    print("pick slots:", total)

    n = made = passed = errors = 0
    while True:
        db.session.refresh(sess)
        if sess.status != "in_progress":
            break
        state = draft_live.get_draft_state(sess.id)
        tid = state.get("current_team_id")
        n += 1
        if n > total + 20:
            print("STOP: more steps than slots")
            break
        try:
            if n % 7 == 0:
                out = draft_live.pass_pick(sess.id)
                passed += 1
            else:
                out = draft_live.auto_pick(sess.id, tid)
                made += 1
            db.session.commit()
            if isinstance(out, tuple) and out and out[0] is None:
                print("  step", n, "team", tid, "->", out)
                errors += 1
                # A club with a full list has to pass.
                draft_live.pass_pick(sess.id)
                db.session.commit()
        except Exception as e:  # noqa: BLE001
            db.session.rollback()
            errors += 1
            print("  step", n, "team", tid, "EXCEPTION", type(e).__name__, str(e)[:160])
            break

    db.session.refresh(sess)
    league = db.session.get(League, 3)
    print("after draft: session", sess.status, "| league", league.status, league.season_year,
          "| steps", n, "picks", made, "passes", passed, "problems", errors)
    sizes = {t.name: FantasyRoster.query.filter_by(team_id=t.id, is_active=True).count()
             for t in FantasyTeam.query.filter_by(league_id=3)}
    print("lists after:", sizes)
    picked = DraftPick.query.filter(DraftPick.draft_session_id == sess.id, DraftPick.player_id.isnot(None)).count()
    print("players drafted:", picked)

    from models.season_rollover import rollover_preview
    try:
        view = rollover_preview(league)
        print("can start new season:", view.get("can_start"))
        for ch in view.get("checks", []):
            if ch["level"] != "ok":
                print("   ", ch["level"], "-", ch["label"])
    except Exception as e:  # noqa: BLE001
        print("rollover_preview failed:", type(e).__name__, e)

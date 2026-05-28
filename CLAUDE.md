# Keeper League — Codebase Map

Fantasy AFL **keeper league** platform. Live at **https://keeperlg.com**.
Flask + SQLite (WAL) backend, React 19 + Vite + TypeScript SPA frontend,
Flask-SocketIO for live draft/scoring, APScheduler for live-score polling.

This file is the orientation map. Read it first — it saves re-deriving the
wiring every session. Keep it current when structure changes.

---

## Deploy + validate workflow (READ THIS)

**Deploying is expected after every change** — the owner wants work live
immediately. The flow is always: build (if frontend changed) → commit → push →
run the server update script.

```
# 1. If frontend/src changed, rebuild the SPA bundle (CSS-only changes DON'T need this):
cd frontend && npm run build        # tsc -b && vite build → outputs to ../static/spa/

# 2. Commit + push (main branch, remote: origin → github.com/jpod31/keeper-league)
git add <files> && git commit -m "..." && git push origin HEAD

# 3. Deploy to prod (pulls, installs deps, restarts gunicorn, confirms running)
ssh root@43.224.183.136 'bash /opt/keeper-league/scripts/update_server.sh'
```

- **Server**: `root@43.224.183.136`, app at `/opt/keeper-league`, service
  `keeper-league` (gunicorn+eventlet behind nginx). Logs:
  `journalctl -u keeper-league -f`.
- **CSV/XLSX data is gitignored** — upload separately via `scp` to
  `/opt/keeper-league/data/` then `chown keeper:keeper`. Ratings XLSX path is in
  server `.env` (`RATINGS_XLSX_PATH`).

### Validation before declaring done
1. **Tests**: `python -m pytest -q`. Baseline = **37 pass / 5 fail**. The 5
   failures are pre-existing (rate-limit, live-scores fixtures, standings
   finalize). A change is safe if those 37 stay green and no NEW failures appear.
2. **Offline simulation**: copy the prod DB to test against real data — you MUST
   copy all three SQLite files: `keeper_league.db` **+ `.db-wal` + `.db-shm`**
   (uncommitted WAL pages live in -wal; copying only .db misses recent writes).
3. **Visual render**: `_mobtest/` holds a puppeteer-core harness driving the
   installed Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`) to
   screenshot pages/components at given viewports. Use it to confirm layout, no
   overflow. Type-check/build passing ≠ "looks right".
4. **Endpoint health (avoid the 404 trap)**: in SPA mode a 404 is served as the
   React shell with **HTTP 200**. So a bare `200` proves nothing. Test the REAL
   route with `?format=json` and expect **401** (auth required) — never a 500,
   never a 200 HTML shell. Example:
   `curl "https://keeperlg.com/leagues/1/team/1?format=json"` → `{"error":"Authentication required"}` 401.

---

## Architecture

- **App factory**: `app.py::create_app()` builds the Flask app; `socketio` and
  the scheduler are wired at module level below it. ~1200 lines.
- **Dual-mode endpoints**: many routes content-negotiate. A browser navigation
  gets a Jinja template (or, in SPA mode, the React shell); a request with
  `?format=json` or `Accept: application/json` gets JSON. The squad endpoint
  (`team_bp` `/<league>/team/<team>`) is the canonical example — same function
  returns `render_template(...)` or `jsonify(...)`.
- **SPA mode** (`SPA_MODE=1`, prod): `app.py::_spa_intercept` (a
  `before_request`) serves the React shell for genuine browser navigations and
  lets API/fetch calls fall through to Flask. **Carve-out list** (paths that
  must NOT be intercepted): `/static/`, `/api/`, `?format=json`, `/auth/api/`,
  `/push/`, `/player/`, `/admin/`. If a Jinja page silently renders the React
  shell, add its prefix here.
- **Frontend**: `frontend/` — React 19 + Vite + TS. `npm run build` outputs to
  `static/spa/` (Vite `base: '/static/spa/'`). The build injects a fresh
  `?v=<hash>` onto `/static/style.css` in the generated `index.html`.
- **CSS**: `static/style.css` is ONE file (~9.6k lines) served directly via
  `base.html` `<link>`, cache-busted by an md5 of its mtime (`ASSET_V`). Editing
  it needs NO build — just deploy. (The SPA also bundles its own CSS from
  `frontend/src/*.css` via Vite — separate from style.css.)
- **Realtime**: `socketio` (threading async mode). Namespaces registered in
  `app.py`: draft (`sockets/draft_events.py`), matchup
  (`sockets/matchup_events.py`), notifications (`sockets/notification_events.py`).
- **Scheduler**: `models/scheduler.py::init_scheduler` (APScheduler) polls live
  scores on AFL game days. Skipped under testing.

---

## Directory guide

| Path | What's there |
|------|--------------|
| `app.py` | App factory, blueprint registration, SPA intercept, error handlers, socketio + scheduler wiring, a handful of top-level routes (`/`, `/player/<name>`, `/refresh`, `/import/*`, `/push/*`). |
| `config.py` | Positions, default scoring, team logos, constants. |
| `blueprints/` | HTTP routes, grouped by feature (see table below). |
| `models/` | SQLAlchemy models (`database.py`, `auth.py`) + domain/business logic engines (scoring, lineup, draft, trades, fixtures, scheduler, analytics, etc.). Despite the name, most files here are logic, not just ORM. |
| `sockets/` | SocketIO event handlers (draft / matchup / notification). |
| `scrapers/` | External data ingestion: Squiggle (fixtures), Footywire (SC scores, rosters, live), wheeloratings + dfsaustralia (state leagues), draftguru (AFL list/draft history -> `AflListHistory`), AFL injuries, CSV import. |
| `scripts/` | One-off + operational scripts. `update_server.sh` / `deploy_server.sh` (deploy), `rescore_all.py`, `precompute_scouting.py`, `smoke_endpoints.py`, `train_scouting_model.py` are operational. `migrate_*.py` are historical one-off migrations (already applied). `debug_*/investigate_*/fix_*/verify_*/check_*` are one-off forensics. |
| `templates/` | Jinja2 templates for the non-SPA pages still served server-side (admin, draft setup, player profile, errors, email). |
| `static/` | `style.css` (the big one), `spa/` (built React bundle — generated, do not hand-edit), `sw.js`, icons, `changelog.json`. |
| `frontend/` | React SPA source. Edit here, then `npm run build`. |
| `data/` | SQLite DB + CSV/XLSX (gitignored). |
| `tests/` | pytest suite (`conftest.py` fixtures + 3 test modules). |

### Blueprints

All registered in `app.py::create_app`. Most JSON-API blueprints are
`csrf.exempt` (SPA sends JSON, not form tokens; all behind `@login_required`).

| Blueprint (name) | url_prefix | File(s) |
|---|---|---|
| auth | `/auth` | `auth.py` |
| leagues | `/leagues` | `leagues.py` + side-effect imports `leagues_settings.py`, `leagues_season.py`, `leagues_players.py`, `leagues_commissioner.py` (each registers more routes onto `leagues_bp`) |
| draft_live | `/leagues` | `draft.py` |
| team | `/leagues` | `team.py` |
| trades | `/leagues` | `trades.py` |
| matchups | `/leagues` | `matchups.py` |
| reserve7s | `/leagues` | `reserve7s.py` |
| comms | `/leagues` | `comms.py` |
| admin | `/admin` | `admin.py` |
| spa_api | `/api` | `spa_api.py` (+ side-effect import of `innovation_endpoints.py`) |

---

## Gotchas (hard-won — don't relearn these the hard way)

- **Naive Melbourne datetimes**: fixture/game datetimes are stored as naive
  Melbourne wall-clock. Attach `ZoneInfo("Australia/Melbourne")` before
  `.isoformat()` — never append `+00:00`. For trade-window comparisons, coerce
  DB datetimes to aware UTC before comparing against `datetime.now(timezone.utc)`
  (see `team.py` `_aware()` helper) or you'll hit naive-vs-aware `TypeError` 500s.
- **404 → SPA shell (200)**: see validation section. Never trust a bare 200 as a
  health check.
- **WAL when copying the DB**: copy `.db` + `.db-wal` + `.db-shm` together.
- **Two field_data builders are INTENTIONALLY separate**, not accidental
  duplication: `team.py` builds the **live, editable** squad (full picture: 7s,
  emergencies, LTIL, locks, injuries) with ORM objects then serializes; the
  `spa_api.py::lineup` builder reconstructs a **read-only historical** snapshot
  for a past round (most live-only fields hardcoded empty). They share only pure
  helpers (zone layout, rookie rule) via `models/field_layout.py`. Do NOT merge
  them — they'd diverge in behavior.
- **Player club data is split by purpose**: `afl_player.afl_team` is only ever
  the player's CURRENT club. Per-season match stats (`player_stats_*.csv`) are
  games-only (a listed player who didn't play a senior game is absent).
  Historical AFL club BY YEAR — including non-playing list seasons — comes ONLY
  from `AflListHistory` (draftguru). Do NOT infer historical club from the
  state-league/reserves team name: a delisted player can play VFL for a
  non-aligned club (e.g. Williamstown). Backfill: `scripts/backfill_list_history.py`
  on the server (creates the table + scrapes draftguru).
- **Positional priority for dual-position players**: FWD > DEF > RUC > MID.
- **Rookie rule**: bench player with `age < 22` AND `rating < 70` → Rookies
  section (field/flex/7s/emergency/injury take precedence). Single source of
  truth: `models/field_layout.py::is_rookie`.

## Conventions / preferences

- **Always commit + deploy** after Keeper League work; don't ask "should I
  commit?". Then test key live pages.
- **Don't over-remove**: before deleting a route/function/file, grep ALL file
  types (`.py`, `.html`, `.js`, `.sh`, `.txt`) for references. Removing only what
  was asked; never strip surrounding features.
- **Sort defaults descending**: first click on a sortable stat column sorts
  highest-first.
- **Mobile-native UX**: bottom-nav buttons open sheets for sub-pages; no inline
  sticky-tab sub-navigation on mobile.
- **Minimal comments**: explain WHY only when non-obvious; let names carry WHAT.

## Test baseline

`python -m pytest -q` → **37 passed, 5 failed** as of 2026-05-28. Pre-existing
failures (NOT regressions — don't chase unless asked):
- `test_data_validation.py::TestLoginRateLimiting::test_rate_limit_blocks_after_max_attempts`
- `test_live_scoring.py::TestApiLiveScores::test_api_returns_json`
- `test_live_scoring.py::TestApiLiveScores::test_api_returns_fixture_data`
- `test_scoring_finalization.py::TestFinalizeRound::test_finalize_updates_standings`
- `test_scoring_finalization.py::TestRoundScoreCreation::test_round_score_has_breakdown`

## Planning docs

Longer-form design/backlog notes live in `docs/` (`REDESIGN_BACKLOG.md`,
`UX_MODERNISATION.md`) — historical context, not authoritative for current code.

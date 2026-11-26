# Keeper League — Codebase Map

Fantasy AFL **keeper league** platform. Live at **https://keeperlg.com**.
Flask + SQLite (WAL) backend, React 19 + Vite + TypeScript SPA frontend,
Flask-SocketIO for live draft/scoring, APScheduler for live-score polling.

This file is the orientation map. Read it first — it saves re-deriving the
wiring every session. Keep it current when structure changes.

---

## Scope discipline (READ THIS FIRST — hard rules)

These exist because changes got bundled in that the user didn't ask for, then
had to be reverted (the swap-picker rebuild, a bench-list collapse, an added
status line — all on a page the user was happy with).

- **Deferral words mean DO NOT BUILD IT.** "add to backlog", "note it",
  "later", "for now", "don't fix yet", "leave it", "another time" → record it in
  memory/backlog and STOP. An explicit deferral overrides any "keep going" /
  "do everything" momentum. If the user flags a problem AND defers it in the
  same breath, deferring wins — do not implement it.
- **A suggestion / audit / "ideas" list is a MENU, not a build queue.** "Give me
  N options / suggestions" means review them together. Only build the specific
  items the user explicitly approves ("do them all", "implement #3", "go").
- **Don't redesign working UI unrequested.** If the user is happy with a page,
  do not "improve" it as a side-quest. Default to the *smallest* change that
  satisfies the literal request; don't bundle extra polish/refactors.
- **Reverts: revert exactly what was named.** Don't over-remove surrounding
  features, and don't silently leave your own other additions — name them and
  ask. (See [[feedback_no_overremoval]].)
- When unsure whether something is in scope, do the literal ask and *say* what
  you deliberately left out, rather than guessing wider.

---

## Deploy + validate workflow (READ THIS)

**Deploying is expected after every change** — the owner wants work live
immediately. The flow is always: build (if frontend changed) → commit → push →
run the server update script.

Steps, server details and the four validation gates live in
`.claude/skills/deploy-and-validate`. Two things that must never be unloaded:

- **Never trust a bare HTTP 200 as a health check** — in SPA mode a 404 is served as
  the React shell with status 200. Test the real route with `?format=json`.
- **Copy all three SQLite files** (`.db` + `.db-wal` + `.db-shm`) when snapshotting the
  prod DB; `.db` alone silently misses recent writes.

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
| `models/` | SQLAlchemy models (`database.py`, `auth.py`) + domain/business logic engines (scoring, lineup, draft, trades, fixtures, scheduler, analytics, `season_review.py`, etc.). Despite the name, most files here are logic, not just ORM. |
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
Note the side-effect imports: `leagues.py` pulls in `leagues_settings.py`,
`leagues_season.py`, `leagues_players.py` and `leagues_commissioner.py`, each of which
registers more routes onto `leagues_bp`; `spa_api.py` likewise pulls in
`innovation_endpoints.py`.

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
- **SPA CSS splits with its chunk**: a `.css` imported from a lazily-loaded
  component ships *inside that chunk*. Styles for anything rendered by
  always-loaded chrome (e.g. the rail's Season Review button) must live in
  `static/style.css`, or they simply don't exist until someone opens the lazy
  feature. This bit the Season Review rail entry.
- **Season Review** (`models/season_review.py`) is built entirely from
  HISTORICAL tables — `weekly_lineup`/`lineup_slot` for who was named,
  `round_score.breakdown` for what they contributed, plus fixtures and draft
  picks. Never read `FantasyRoster` for it: the off-season strips players off
  lists and would rewrite finished seasons. Memoised per (league, year).
  `season_review_year(league_id)` is the single gate — non-null only while every
  fixture of the league's current year is completed, so the review appears when
  the last round finalises and vanishes at the next rollover. Exposed on the
  league context as `season_review_year`.
- **Moving to a new year = `models/season_rollover.py::start_new_season`**, the
  ONLY path (commissioner page `/leagues/<id>/new-season` and the date-based
  auto-transition both call it). It copies every SeasonConfig column except the
  per-year dates/windows (`_RESET_COLUMNS`), applies the commissioner's edits,
  bumps `league.season_year`, builds main + 7s fixtures (+ Opening Round),
  releases the LTIL, expires pending trades, tops up future picks. Any new
  per-year state belongs in there. `config.CURRENT_YEAR` (the AFL data year)
  is separate and still a manual bump before Opening Round.
- **Supplemental drafts follow the year's draft plan** on SeasonConfig
  (`draft_order_basis` reverse_ladder|ladder|custom, `draft_style`
  linear|snake, `draft_custom_order`, `draft_compensation` = added picks at
  the start/end of a round, off-season draft only, stored as `DraftPick.label`).
  `models/draft_picks.py::build_slots` is the one slot builder (the draft AND
  the previews). Edited for this year on Draft Setup (`/leagues/<id>/draft-plan`)
  and for next year on the new-season page; added picks reset each rollover.
  "<year> R<n>" picks = that year's OFF-SEASON draft; the off-season draft
  gives each slot to `FutureDraftPick.current_owner_id` and records
  `DraftPick.original_team_id` ("via X" in the draft room). Picks are created
  lazily by `ensure_future_picks` (open draft + 2 years, rounds =
  `offseason_draft_min_picks`); only `open_picks_query` years are tradeable.
- **Fixture draw**: `generate_round_robin(..., ladder_teams=)` makes the
  leftover rounds after the full cycles pair sides close on last year's ladder
  (squared rank gap); without it they are random.
- **Two years, never one**: `config.CURRENT_YEAR` is the AFL season the site
  is in (ages, ratings, fixtures, live scoring). `models/years.py::stats_year()`
  is the latest season WITH games, and every average, last-3 and last-5 comes
  from it. Between the AFL draft and Opening Round they differ, and the UI
  labels the numbers with the year (`useStatsYear()` in LeagueContext, the
  `afl_year` / `stats_year` / `stats_are_last_season` keys on the league
  context, pool and player-detail payloads). Anything new that shows a score
  must use `stats_year`, never `CURRENT_YEAR`, or it blanks every November.
  `recompute_sc_averages` falls back a year rather than wiping averages.
- **The player workbook is the AFL list of record** (`models/player_sync.py`,
  run by `scripts/sync_players.py --dry-run` then for real, or the whole
  November sequence by `scripts/cutover_season.py`). It updates rating, age
  AND club, creates new players with an EXPECTED position
  (`afl_player.position_expected`, shown as "exp", cleared by the footywire
  position sync), and marks players it no longer names as former
  (`list_status='former'`, `left_afl_year`). Former players are never
  deleted; `AflPlayer.listed()` is the filter for anything draftable or
  signable. Matching is one-to-one, strictest rule first; read the dry run's
  "new" and "off AFL lists" lists after every refresh.
- **Back puts you where you were** (`frontend/src/lib/pageMemory.tsx`). Each
  browser history entry has its own store in sessionStorage, so it survives
  the full page load on the way back from the server-rendered profile
  (`/player/<name>`). A list page keeps its filters, sort, open tab and open
  player card with `usePageState('name', initial)` in place of `useState`;
  `ScrollMemory` (mounted in `App.tsx`) restores the window scroll on back and
  starts a clicked link at the top; `useKeptScroll` does the same for a list
  that scrolls in its own box (the desktop pool table). A long list that
  loads in chunks must keep its count the same way or the scroll has nothing
  to land on. Scroll jumps must be `behavior: 'instant'`: Bootstrap turns
  smooth scrolling on. `useKeptFetch` (read-only pages only) shows the last
  copy at once and refreshes behind it; never use it on a page that fills a
  form from its data. A page's own back link should return to the entry it
  came from (`navigate(-n)` with the step count carried in `location.state`),
  not push a fresh copy. Proof: `_mobtest/flow_back.mjs <outdir> [width]`.
  A new list page that opens a player gets all of this from day one.
- **Draft values know the kind of player** (`models/role_scoring.py`, fitted
  by `scripts/fit_role_scoring.py --write` into `models/role_scoring_fit.json`).
  `afl_player.role` / `role_detail` are the workbook's Position and Specific
  Position columns, written by the player sync. Three numbers, in SuperCoach
  points: `expected_now` (rating and role to a season average), `output` (his
  average mixed with 10 games of that line, so three games at 88 is not an 88
  player and a draftee is not a zero) and `ceiling` (potential moved by a role
  offset, or his output if that is more). In `draft_model.py` the `sc_average`
  and scarcity factors use `output`, and `rating_potential` (key kept for
  saved weights, shown as "Scoring ceiling") is the ceiling; it used to be
  40% potential plus 60% of the gap to rating, which ranked a 70-rated small
  forward above a 91-rated midfielder. The trend factor only counts seasons
  of 6+ games. Nothing in the model is hand-set: refit each November, and
  read the fit script's report (error on held-out players, with and without
  role) before changing a number. A layer that does not cut the held-out
  error stays out (the SuperCoach MID tag was tried and dropped). To move one
  player, change his Specific Position in the workbook and sync.
  `scripts/refresh_draft_scores.py --league-id N` saves the values the
  draft's auto-pick falls back to; run it after a refit or a workbook sync.
- **Draft values know the kind of player** (`models/role_scoring.py`, fitted
  by `scripts/fit_role_scoring.py --write` into `models/role_scoring_fit.json`).
  `afl_player.role` / `role_detail` are the workbook's Position and Specific
  Position columns, written by the player sync. Three numbers, in SuperCoach
  points: `expected_now` (rating and role to a season average), `output` (his
  average mixed with 10 games of that line, so three games at 88 is not an 88
  player and a draftee is not a zero) and `ceiling` (potential moved by a role
  offset, or his output if that is more). In `draft_model.py` the `sc_average`
  and scarcity factors use `output`, and `rating_potential` (key kept for
  saved weights, shown as "Scoring ceiling") is the ceiling; it used to be
  40% potential plus 60% of the gap to rating, which ranked a 70-rated small
  forward above a 91-rated midfielder. The trend factor only counts seasons
  of 6+ games. Nothing in the model is hand-set: refit each November, and
  read the fit script's report (error on held-out players, with and without
  role) before changing a number. A layer that does not cut the held-out
  error stays out (the SuperCoach MID tag was tried and dropped). To move one
  player, change his Specific Position in the workbook and sync.
  `scripts/refresh_draft_scores.py --league-id N` saves the values the
  draft's auto-pick falls back to; run it after a refit or a workbook sync.
- **Trade offers don't lock players** (`models/trade_manager.py`, 2026-11-25).
  A coach can have any number of open offers, to the same club or several,
  with the same players or picks in them. Only an AGREED deal (accepted while
  the window is shut) holds its players and picks. Accepting or agreeing one
  offer withdraws every other open offer sharing a player or pick with it
  (status `withdrawn`, both coaches notified). An identical offer to the same
  club twice is refused. Only the club an offer was sent to can accept or
  reject it, only its sender can cancel it. The propose and respond routes
  answer `format=json` with `{ok, error}`: the app used to read any 200 as
  sent, so a refused offer looked sent and never existed.
  Counter: the club an offer was sent to opens `/trades/propose?counter=<id>`
  (the builder pre-filled with that offer turned round); sending it with
  `counter_of` closes the original as `countered` and links the two
  (`trade.counter_of_id`). Proof: `_mobtest/flow_counter.mjs` (writes, so
  throwaway copy only).
- **Role data from dfsaustralia**: CBA% (`scrapers/cba_scraper.py`,
  `cba_pct`/`cba_trend`) and kick-ins (`scrapers/kickin_scraper.py`,
  `kick_in_pct` = share of his club's kick-ins in the games he played,
  `kick_in_playon_pct`, `kick_ins_season`; season is `stats_year()`). Both
  run in the `/refresh` sequence and show in the player compare and the
  position percentile ranks. Unmatched names are printed; a near match is
  settled by club.
- **The player card pop-up** (`components/squad/PlayerModal.tsx`) is ONE
  screen, never scrolls (Lucas: "dont want the right side pane scrollable
  ... i hate all those shitty boxes"): photo on the LEFT of the header, the
  surname on one line sized to its space (container query, 16 to 32px), the
  form chart filling the spare height, six season averages as plain type,
  My notes opening in place of the form, More details at the bottom. No
  stat tiles, no last-game grid.
- **The full player page** (`/leagues/<id>/player/<pid>`,
  `pages/players/PlayerDossierPage.tsx`, data from
  `/api/leagues/<id>/players/<pid>/dossier` built by `models/player_dossier.py`).
  Reached from the card pop-up's "More details"; back returns to the card.
  Tabs: Overview, AFL stats, Ratings, Career, Keeper League. "Named" in the
  keeper career = an on-field slot (DEF/MID/FWD/RUC/FLEX); bench, emergency
  and no slot are "not named". A season average only counts a stat held for
  at least half his games (`_avg_cover`). The old server page `/player/<name>`
  still exists but nothing in the app links to it now.
- **Player photos**: AFL Manager's cutouts in `player_photos/` (NOT under
  /static: nginx would serve them openly), served signed-in only by
  `/api/player-photo/<slug>.webp`. `models/player_photos.find_slug`: exact
  slug, then the player sync's nickname variants, then `ALIASES`. Never a
  looser guess (surname + initial put Lachie Jones's face on Liam Jones).
  No photo draws a silhouette. The folder is gitignored (licensed images,
  never pushed to GitHub): copy it to `/opt/keeper-league/player_photos/`
  on the server with scp, and copy new files over from
  `AFL Manager/backend/aflm/api/static/players/` when that set grows.
- **Workbook history**: `player_season_rating` (rating 2016 on, potential 2017
  on) and `afl_player.draft_pick/draft_year/draft_type/father_son/academy/
  international/grade/afl_best22` are written by the player sync.
- **2026 stats gap, fixed 2026-11-26**: the live feed writes a game's row with
  only the basic stats, and `scripts/import_player_stats.py` used to skip any
  game that already had a row, so contested possessions, clearances, metres
  gained and the rest never arrived from the full CSV. It now fills the
  missing stats on existing rows (never changing a value already held).
- **Pool "Detailed stats"** (`pages/players/PoolDetailTable.tsx`, data from
  `/api/leagues/<id>/player-pool/detail`): every stat as a season average,
  plus role and draft columns, name pinned, every column sorts, kept on back.
- **`fantasy_roster` is one row per STINT**, not per (team, player). A club
  that redrafts a player it delisted gets a second row. Never add a unique
  constraint back; `models/player_history.py::league_stints` is the one
  reader for "how did this club get this player" (pool, former players,
  season squads).
- **Off-season draft**: starting it closes any open delist period and
  rebuilds the board from the lists and pick ownership as they stand
  (`draft_live.refresh_supplemental_slots`), so it can be scheduled days
  ahead. When it ends the league goes back to `offseason`
  (`status_after_draft`), which is what `start_new_season` requires.
- **Season squads** (`models/season_squads.py`, table `season_squad`) are
  written once per league-year: the first season from the initial draft, every
  later one by `start_new_season`. `/api/leagues/<id>/seasons[/<year>]` is the
  one endpoint for a past year (ladder, results, squads, drafts, trades,
  delistings).
- **Colour**: chrome is black and white; colour is only for things that mean
  something. Never let one house colour take over (a gold scheme was shipped
  and rejected the same day, 2026-11-23). The sets, each used everywhere:
  positions (`--pos-def/mid/ruc/fwd`), rating bands (`.rt .rt-elite` to
  `.rt-low`, potential as `.rt-line`), form (green up, red down), AFL clubs
  (`clubVars()` in `frontend/src/lib/clubs.ts` sets `--ca`/`--cb` on anything
  showing a player), and teams (`models/team_identity.py`: `fantasy_team.accent`,
  from the crest; the signed-in coach's arrives as `--team` on the root).
  Show a team as a crest (`TeamBadge`), never as a bare name. The old variable
  names survive as roles (`--kl-accent-blue` is the white interactive colour).
  `tools/retheme*.py` are the record of the two passes and are not idempotent.
  New UI: nothing under 13px, no grey copy.
- **Design system (v4, the last band in style.css)**: Geist for words, Geist
  Mono for every number and for small tracked capital labels; black panels
  with 1px hairlines (`--hair`, `--hair-2`) and 5 to 8px corners; primary
  buttons white, everything else a hairline outline; no glows, no pills, no
  gradient fills on controls, no Inter, no sparkle / wand / robot icons. A
  drafting grid lit in the coach's team colour sits behind the top of each
  page. New components should take their look from this band, not invent one.
- **Type rules are enforced by tools, not by eye.** `python tools/type_floor.py`
  raises every font-size under 13px and turns grey text into the one text
  colour (idempotent; run it after adding UI). `_mobtest/kl_audit.mjs` visits
  pages on the local rig and counts visible text under 13px, grey text and
  clipped text per page; a page is done when it reports zeros. No captions
  under buttons or stats, no em dashes in visible text, no pill shapes, no
  letter-spacing over .06em. No dot-separated meta lines ("A · B · C"): use a
  comma, a plain count, or a chip.
- **The audit also reports boxes that scroll sideways.** Raising the type made
  the draft room's players table wider than its card and pushed Pick off the
  edge. Any `side-scroll` line that is not a strip meant to scroll (draft
  order, round picker, tabs) is a bug: content is hidden. Check 1280 and 390
  wide. Tables hide columns by `nth-child`, so removing a column shifts every
  such rule after it (page CSS and `static/style.css` both).
- **The audit checks five things** per page: text under 13px, grey text
  (including text faded with `opacity` on itself or a parent), text clipped by
  its own box, boxes that scroll sideways, and low contrast (light on light,
  dark on dark). `_mobtest/kl_states.mjs` clicks or hovers through menus,
  sheets and pop-ups and screenshots each state; `_mobtest/wide.mjs <path>`
  names the table and columns behind a sideways scroll.
- **Grey reaches text three ways the type sweep cannot see**: colour variables
  (`--pp-text-muted` and friends), `opacity` on a row, and inline SVG `fill`.
  After adding UI, run the audit, not only `tools/type_floor.py`.
- **Check the state coaches are in, not only the test state.** Take a fresh
  read-only copy of prod (python `sqlite3` backup over ssh; the server has no
  sqlite3 binary), set a local password, and view as a coach who still owes
  cuts and has no team colour. That is how the squad strips and an unreadable
  league badge were found.
- **Status strips are a sentence and a button** (`.sq-strip`). No icon box,
  title and caption per item.
- **Team colour comes from the team** (`useTeamAccent()` in
  `components/ui/TeamBadge.tsx`, `team_accent()` server-side). Gameday, the
  ladder and the season review each had their own palette; do not add another.
  Text on a team colour uses `--team-ink`.
- **The season review has one look**: black, white, the viewer's team colour.
  Per-slide `theme` triples in `slides.tsx` are no longer applied.
- **`/player/<name>` is a server-rendered page** (`templates/player.html`,
  `.pp-*` styles in `static/style.css`), reached from the pool, trade block and
  former players. It also carries the What's New pop-up and install banner from
  `templates/base.html`. Restart the local server to see template changes.
- **The player card has one face, used everywhere** (squad `.fv-card` +
  `.fv-face`, phone rows `.mob-pos-row`, pop-up `.pmod-face`, trade block
  `.tb-card`): the club's colour as a gradient with a sheen, the club logo
  embossed behind (`--logo` set inline, drawn by `::after`), a trim line in
  position colour across the TOP border (two halves for a dual-position
  player, `--pc` and `--pc2` set inline), a real drop shadow, position as solid
  badges, rating as the `.rt` band chip, one font inside the card (no mono).
  Lucas asked for the top border back by name: "i liked the colour border
  being the position before.. the top one" (2026-11-24). Rows (phone squad,
  gameday) keep the position on the left edge. Lucas called the flat version
  "too 2d, basic, the fonts dont match" (2026-11-23).
- **Squad card layout (`.pc7-*` in `FieldView.tsx`)**: WIDER THAN TALL, 168 by
  about 119 (the shape it had before the restyle; a 150 by 165 portrait cut
  was called "way too vertical ... just not professional", 2026-11-24). Order
  of size, set 2026-11-25 ("theres too much going on, and the name is the
  smallest part of it ... make the names bigger, the numbers smaller"): the
  NAME is the biggest thing (18px, one line, CENTRED; first name in full up to 16
  characters, else the initial, else the surname alone), then the three
  numbers (15px: average with the form arrow, rating chip, age), then the
  club logo top left and a SMALL ROUND DOT per position top RIGHT, one
  letter each: D, M, R, F in the position colour (`.pc7-dot-*`, hollow for an
  expected position). No FWD / MID rectangles, no position colour bar along
  the top, no lines between the numbers. The faded club logo behind the card
  STAYS ("the faded logo is cool"). Role bubbles (C, VC, E, 7, L, BYE) are
  ROUND AND COLOURED on the top LEFT corner (`.pc7-bub-*`; moved from the
  right on 2026-11-25 so they are clear of the position dots, with the
  selected tick and injury dot now top right), and the hover
  buttons are round in the same colours. Flattening them to white outlines
  was noticed straight away: "the colours on the bubbles for things have gone
  too?? why??". Black and white is for chrome, not for these. Field rows use
  `min(168px, (100% - 32px) / 5)` so every row has the same card width on a
  small laptop. New class names on purpose, so older `.fv-*` and `.pc6-*`
  rules do not apply. The look is the "glass tray" (picked from mock-ups,
  2026-11-25; the last card band in style.css): club colour with light
  from the top left, a bigger turned faded logo, the numbers on a frosted
  plate floating at the bottom. Toned down the same day ("a bit TOO
  light and glassy"): darker colour, a dark tray. NO tilt: it made subs
  feel messy ("the card movement is not that clean when you are making
  subs"); hover is a 2px lift and in swap mode cards do not move at all.
  Proof: `_mobtest/shot_glass.mjs`, `_mobtest/sub_motion.mjs`.
- **A number is bigger than its label** (on the squad card a 15px figure
  over a 10.5px AVG / RTG / AGE label; the figure was 23px until he said the
  name must lead). Lucas, 2026-11-24: "larger numbers smaller text on
  Age rating etc. come on... thats 101". This label is the one deliberate
  exception to the 13px floor: its size is the `--pc7-lab` variable so
  `tools/type_floor.py` does not raise it, and `kl_audit.mjs` skips `.pc7-l`.
  A label under a number should never be near the number's size.
- **`python tools/css_prune.py`** (report) / `--apply` removes rules from
  `static/style.css` whose classes exist nowhere in the code. First run,
  2026-11-24: 558 rules, 12,508 lines down to 10,844. It leaves order alone,
  so live markup cannot change. ALWAYS prove it with screenshots: every page
  before and after, off-season and in season, 1280 and 390 wide, compared
  with a tolerance (clocks, loading states and animations differ between two
  identical runs). The first attempt deleted the rail's `:root` sizes because
  a comment above them named an old class; the comparison caught it. Run it
  after retiring a component (`.pc6-*` went this way).
- **A role is a round coloured bubble everywhere** (`.kl-role` and the
  "Sweep, 24 Nov" block in `static/style.css`: captain gold `--role-c`, vice
  captain blue `--role-vc`, emergency `--role-e`, 7s `--role-7`, LTIL
  `--role-l`). On the gameday scoreboard a role that has not played yet is
  hollow. Do not draw a new C or VC tag by hand.
- **A broad rule beats page rules**: `[class*="badge"]:not(...):not(...)`
  (the no-pills sweep) has the weight of three classes and `!important`, so a
  normal two-class override loses to it. That is why some selectors in the
  sweep block repeat a class (`.kl-role.kl-role.kl-role`).
- **Any page that throws shows a message, not a blank screen**
  (`PageErrorBoundary`, wrapped round the outlet in `LeagueShell`). The team
  analytics page had been blank whenever its summary was cached. After
  changing what an endpoint returns, run `_mobtest/kl_audit.mjs` over every
  route and look for `PAGEERROR`.
- **Event times go through `models/timefmt.py`** (`when`, `day`, `clock`):
  trades, notifications, chat, activity and list changes are stored as naive
  UTC and were shown as UTC, eleven hours behind Melbourne in summer. Never
  `strftime` one of those columns directly. Fixture and game times are naive
  MELBOURNE and must not be passed to it.
- **No browser pop-ups**: `ask()` and `tell()` from `components/ui/dialog.tsx`
  replace `confirm()` and `alert()` (`DialogHost` is mounted in `App`). A
  message that says delete, delist, veto, restart, reset or remove gets a red
  button on its own.
- **A player opens as a card over the page you are on**, from any list:
  `const openPlayer = useOpenPlayer()` then `openPlayer(p.id)`
  (`components/squad/PlayerPopup.tsx`, provider in `LeagueShell`). Do not
  send a click to `/player/<name>`; that page is only the card's "full
  profile" link. Sending the pool there lost the coach's filters.
- **Notifications and activity are one list** (`components/comms/NoticeList.tsx`):
  the crest of the club named in the line, in-app links, same layout.
- **Page titles**: sentence case, no icon, no banner, in `.page-header` or
  `.kx-head`.
- **Click-through tests** live in `_mobtest/flow_*.mjs` on `flowlib.mjs`
  (squad actions, a trade between two coaches, the draft room, pool, trade
  block, notes). Run them against a THROWAWAY copy of the data (copy
  `data/snap/now.db` first); they write. Each step prints page errors,
  failed requests and any browser dialog.
- **One typeface: Geist.** Geist Mono was dropped on 2026-11-24 (Lucas: "the
  fonts dont match the style"); `--kl-font-mono` now points at `--kl-font` so
  older rules keep working, and `body` has tabular numerals. Do not add a
  second face.
- **The 13px floor flattens hierarchy if applied blindly.** It made the name,
  numbers and labels on the card all 13px. After the floor, set sizes on
  purpose: the main thing largest (surname 17px bold), numbers next (16px
  mono), labels at 13px.
- **Home is one thing in season too** (`.hm` in `DashboardPage.tsx`): your
  game, one sentence, the round's games, the ladder. Do not add tiles to it.
- **Viewing in-season pages in the off-season**: copy the DB, set round
  fixtures to `live` or `scheduled`, and run the app with the AFL round pinned
  (the home page asks Squiggle for the current round). A launcher that patches
  `scrapers.squiggle.get_current_round` is enough.
- **Draft room, your pick**: `.draft-banner-your-pick` gets a white frame and
  the banner says "You are on the clock"; enabled Pick buttons are solid
  white. Confirming a pick (`.dn-confirm`) and the announcement (`.dn-reveal`)
  use the player's face. To see it locally, log in as the coach on the clock.
- **The left rail is labelled** (icon over word, 84px). The wider rail takes
  room from tables: pool, former players and the draft table drop columns by
  `nth-child` at 1500, 1300, 1180 and 1080px. Check 1280, 1122 and 1024 wide
  after adding a column.
- **Rehearse the season start on a copy before the real one.** Take a prod
  copy, mark the scheduled draft completed, close the delist period and set
  `off_trade_window_close` to the past, then press Start on `/new-season`
  locally. The 2026-11-24 rehearsal found a "Round 1 recap, draw 0 to 0"
  pop-up for an unplayed round, and that the recap's seen marker had no year
  in it (so nobody would have seen a recap in 2027). Local runs cannot email
  or push: no MAIL or VAPID credentials, and snapshot emails are rewritten.
- **`python tools/rehearse_draft.py`** runs draft night on a copy: starts the
  scheduled draft, makes every pick (auto picks and passes), and prints the
  state it leaves. Run 2026-11-24: start closed delistings and trades, 22
  picks and 3 passes went through, the league went back to its off-season
  state and the new season could be started.
- **A club drafts until its list is full**, so the number that matters before
  the draft is spots to fill (`squad_size` minus list), not the count of
  tradeable round 1 to 4 picks. Home shows spots.
- **Round 0 is the Opening Round**, not "Pre-Season", and it is a real round:
  test `is not None`, never truthiness, on a round number. Home takes its
  round from `_detect_gameday_round` so it cannot disagree with Gameday.
- **One set of position colours**: `--pos-def #58a6ff`, `--pos-mid #bc8cff`,
  `--pos-ruc #3fb950`, `--pos-fwd #f0883e`, solid fill with dark text. Several
  pages carried their own maps; grep `DEF:` and `pos-` before adding another.
- **Class names are global.** `.rec-card` meant two things (team stats and
  league records) and one broke the other. Prefix new classes per page.
- **Player cards: club AND position.** The card body is the player's AFL club
  colours; the position is a solid badge in the position colour plus the
  card's left edge. Position badges are solid everywhere; an EXPECTED position
  is the same badge hollow with a dashed edge, never the word "exp". The owner
  asked for both: do not drop either.
- **Home in the off-season is one thing**: the draft date, a countdown, one
  line on where your list stands, and the draft order table. The rest of the
  dashboard is hidden until the season (`.lg-page.is-offseason`).
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

`python -m pytest -q` -> **61 passed** as of 2026-11-24. The five that failed
for months were stale tests, not bugs: the seed left every player on the
bench (a roster row with no `position_code` scores nothing), one test built a
draw by accident, two called a live-scores route removed as dead code (the
gameday page polls `/gameday/api/fixtures`), and the test app had no
`csrf_token`. Any failure now is a regression.

## Planning docs

Longer-form design/backlog notes live in `docs/` (`REDESIGN_BACKLOG.md`,
`UX_MODERNISATION.md`) — historical context, not authoritative for current code.


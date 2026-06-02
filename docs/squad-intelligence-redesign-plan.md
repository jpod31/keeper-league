# Squad Intelligence — State-of-the-Art Redesign Plan

> A working session between three roles — **Data Scientist** (what's true &
> predictive), **Data Modeller** (how the data is shaped & served), and **UX
> Designer** (how it feels & flows) — to turn My Team → Stats from a static
> table-and-cards page into an interactive, mathematically deep "Squad
> Intelligence" cockpit.

## The three critiques (what we're solving)
1. **Not mathematical / insightful enough** — current metrics are mostly
   descriptive (averages, percentiles, simple trends). No value-over-
   replacement, no uncertainty, no "what does this mean for my decisions".
2. **Team-usage stats are buried behind a click** — "how many games has this
   player played *for my team*", points banked, captaincy, role — all live in a
   per-player modal. They should be **first-class, squad-wide, glanceable**.
3. **Looks static / HTML-y** — Bootstrap tables + flat cards. Wants beautiful,
   interactive, motion, density — "the future of analytics".

---

## Data Scientist — the model layer

Replace descriptive stats with a small set of **defensible, decision-relevant**
models, each with a clear formula and shown with its inputs (never a black box).

1. **VORP — Value Over Replacement Player** (the keeper-value backbone).
   `replacement(pos)` = mean SC of the ~Nth-best player at that position across
   the league pool (N = teams × starters at pos). `VORP = player_SC − replacement(pos)`.
   This is *the* number for "how much roster value does this player provide".
2. **Projection with uncertainty** (deepen the current point estimate).
   Empirical-Bayes shrinkage: `proj = w·recent + (1−w)·career_prior`, `w` grows
   with games played; age-curve multiplier; **80% interval** from per-game stdev.
   Show as a band, not a number.
3. **Reliability-weighted value** — `floor_value = 0.6·median + 0.4·p25` (what
   you can bank weekly) vs **ceiling** (p90, what wins specific weeks). Surfaces
   the safe-stud vs boom-bust distinction quantitatively.
4. **Role signal** — CBA% + CBA trend (have) → a "role score" and trend arrow;
   midfield role is the strongest leading indicator of SC scoring.
5. **Form** — rolling z-score of last-3 vs season, per player → the heatmap colour.
6. **Team-level**:
   - **Points left on bench** — Σ over rounds of (best benched score that
     could've replaced a lower on-field score). Quantifies lineup mistakes.
   - **Positional surplus/deficit** vs replacement — where you're stacked / thin.
   - **Contention index** — blend of XI VORP + age window → win-now vs rebuild.
   - **Regression flags** — z of season vs career baseline (sell-high/buy-low).
7. **Cohort-correct percentiles** — always vs same-position pool (a 100-SC ruck
   ≠ a 100-SC defender).

All computed **server-side, batched, cached** — never per-row N+1.

---

## Data Modeller — the data contract

One **batch squad-analytics endpoint** powering the whole page in a single
fetch, so nothing requires a click:

`GET /leagues/<l>/team/<t>/squad-intel?format=json` →
```
{
  team: {...}, league:{...},
  replacement: { DEF:.., MID:.., FWD:.., RUC:.. },   # league replacement levels
  league_ctx: { sc_avg, age_avg, n_teams, ... },
  players: [ {                                        # ONE row per roster player
    id, name, pos, afl_team, age, height, injury,
    rating, potential, keeper_value, cba_pct, cba_trend,
    sc_avg, sc_prev, career_avg, ceiling, floor, consistency, boom_pct,
    vorp, proj, proj_lo, proj_hi, form_z, archetype,
    # YOUR-TEAM usage (was modal-only — now in the row):
    team_games, bench_rounds, captain_games, sevens_games,
    emg_activated, points_banked, contribution_pct,
    round_scores: [ {round, sc, role} ],             # for the form heatmap & sparkline
  } ],
  team_metrics: { points_left_on_bench, contention_index, optimal_vs_actual, depth_by_pos },
  insights: [ {kind, headline, detail, player?} ],   # auto-generated narrative
}
```
Built with **one pass** over lineup history (`WeeklyLineup`/`LineupSlot`/
`RoundScore`) + **cached** per-game CSV reads (`stats_loader`) + a single league
pool scan for replacement/percentiles. Cached per team per refresh (mirror the
analytics cache) so the page is instant.

Reuses existing engines: `compute_player_team_usage`, `compute_scoring_profile`,
`compute_player_projection`, `keeper_value`, `team_analytics` replacement logic.

---

## UX Designer — information architecture, visuals & motion

**Principle: answer the top questions without a click; make depth one hover/expand away.**

### Layout — "Squad Intelligence" cockpit (single scroll, sectioned)
1. **Insight header** — team archetype + contention window + an auto-generated
   headline ("Win-now core; thin at RUC; Rankine trending into the midfield").
   2–3 StatTiles: Squad VORP rank, Points left on bench, Contention index.
2. **Squad Form Heatmap** — the hero visual. Rows = players (sorted by form),
   columns = last ~8 rounds, cell colour = SC z-score (diverging). Instantly
   shows who's hot/cold across the whole list. Hover = exact score + role; the
   "out"/bye/bench cells are visually distinct. *Beautiful, dense, zero clicks.*
3. **The Matrix** — one interactive squad table with **view modes** (segmented
   control): **Performance** (SC, ceiling/floor, consistency, form spark),
   **Your Usage** (games-for-you, banked, %, captain, 7s, role), **Value**
   (VORP, keeper value, proj±, age, runway). Sortable, position-filter,
   inline micro-viz (sparkline, mini bars, VORP bar, role bar, percentile fill),
   colour-encoded cells. Row hover → highlight; row click → the existing deep
   drill-down (now a bonus, not a necessity).
4. **Value & roster modules** (interactive charts): VORP-ranked bars,
   positional depth vs replacement, development scatter (age×SC, brush-to-filter
   the matrix), age/contention pyramid.

### Visual system (away from "HTML-y")
- Custom card chrome (subtle gradient, 1px hairline, soft shadow, more negative
  space), refined type scale, tabular-nums everywhere, consistent accent system.
- **Colour as data**: one diverging scale for form/z, one sequential for
  percentile fills — used consistently so colour *means* something.
- **Motion**: animated count-ups, smooth re-sort/transition (FLIP), heatmap cell
  fade-in, hover elevation, view-mode crossfade. Subtle, fast (150–200ms), never
  janky.
- **Interactivity**: segmented view-mode control, position filter chips, sort,
  brush-link from scatter → matrix, sticky header, hover tooltips everywhere.
- Mobile: heatmap → horizontal scroll; matrix → card list with the active
  view-mode's key stats; charts → ResponsiveContainer/bar fallbacks.

---

## Phased implementation
- **P1 — Data spine + Matrix + Usage-in-grid**: batch `squad-intel` endpoint
  (VORP, replacement, usage, scoring, projection, form) + the view-mode Matrix
  with inline micro-viz. *Kills critiques #1 (math) + #2 (clicks).*
- **P2 — Form heatmap + insight header**: the hero visual + auto-narrative +
  team-metric tiles (points-left-on-bench, contention). *Kills #3 (beauty) start.*
- **P3 — Value/roster modules + motion polish**: VORP bars, depth-vs-replacement,
  brush-linked development scatter, FLIP re-sort animations, view crossfade.
- **P4 — Validation & nonsense-hunt** (see below).

## Validation & nonsense-hunt (mandatory final pass)
- **Math sanity**: VORP signs, replacement levels reasonable, projections within
  plausible SC range, percentiles 0–100, intervals ordered (lo≤proj≤hi), no
  divide-by-zero, byes/DNPs excluded correctly, rookies fall back gracefully.
- **Cross-check** a handful of real players against intuition (elite mid high
  VORP/role; defender low CBA; aging star = win-now/decline flag).
- **Visual**: render at desktop + mobile via the harness; verify heatmap colours
  encode correctly, no overflow, motion smooth, empty states clean.
- **Explicitly look for nonsensical outputs** (e.g. negative games, >100
  percentiles, projection wildly off, contribution% summing wrong) and fix.

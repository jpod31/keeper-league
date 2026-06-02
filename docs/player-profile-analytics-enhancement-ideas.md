# Player Profile Analytics Enhancement Ideas

> **Scope (read first).** This document targets the **My Team → Stats** page
> only — `frontend/src/pages/team/TeamStatsPage.tsx`, backed by
> `blueprints/team.py::team_stats`. It does **not** touch the **My Team →
> Analytics** tab (`AnalyticsPage.tsx` / `models/team_analytics.py`), which
> already holds the deep *team-level* analytics and is intentionally left
> as-is. The goal here is to turn the Stats page from a flat squad table into a
> premium **player-level** scouting / fantasy / keeper analytics hub for the
> players on your list — with team rollups up top and rich per-player
> drill-downs below.

---

## Current State Summary

`TeamStatsPage.tsx` today renders, for the team's active roster:

- **4 StatTiles**: Squad Size, Total SC Value, Avg Age, Avg SC / Player.
- **Position Breakdown**: count-per-position progress bars.
- **Top 10 by SC Avg**: simple ranked list/table.
- **All Players table**: name, position, age, AFL team, SC avg, career games,
  draft score.

The backing endpoint (`team_stats`, `blueprints/team.py:1020`) only serializes
`id, name, position, afl_team, age, sc_avg, career_games, games_played,
draft_score` plus `total_sc / avg_age / position_counts`. There is **no
clicking into a player, no time series, no benchmarking, no projection, no
keeper framing, and no per-game data** — even though all of that exists in the
codebase and is surfaced elsewhere.

**What is underused (already in the app, not on this page):**

| Data / logic | Where it lives | Currently used by |
|---|---|---|
| `rating`, `potential`, `rating_start`, `keeper_value`, `sc_avg_prev`, `height_cm`, `dob` | `models/database.py::AflPlayer` | squad/player profile only |
| Rating-over-time | `models/database.py::RatingLog` | not surfaced |
| Per-season averages + **current-year per-round** + `last_3_avg`/`last_5_avg` + `trajectory_slope` | `scrapers/stats_loader.py::load_player_detailed_stats` | `/player/<name>` Jinja page |
| SC history (`yearly_averages`, `current_rounds`, `peak`, `career_avg`) | `scrapers/stats_loader.py::load_player_sc_history_fitzroy` | `/player/<name>` |
| Keeper Value Index (0–99) | `models/keeper_value.py` | stored, barely shown |
| Bayesian projection, consistency, durability, ceiling/floor, replacement levels | `models/team_analytics.py` | Analytics tab (team-level) |
| Draft-score factor breakdown + historical draft scores | `models/draft_model.py` | `/player/<name>` |
| State-league (VFL/SANFL/WAFL) + U18/Coates stats + percentile ranks | `models/database.py::StateLeagueStat` | `/player/<name>` |
| Club-by-year career arc | `models/database.py::AflListHistory` | `/player/<name>` |
| Keeper-draft acquisition (pick #, year, type, coach) | `DraftPick`/`DraftSession` | `/player/<name>` |

Charting library is **recharts ^3.8.1**; a per-player chart precedent already
exists in `components/squad/PlayerModal.tsx`. Styling is the single
`static/style.css` + Bootstrap utility classes + the `StatTile` component
(accent system: forest/sapphire/ochre/rust/amethyst/teal/garnet/cognac).

---

## Product Vision

The Stats page should feel like the **player-analysis cockpit for your list** —
the place a keeper-league manager opens to answer "who do I keep, who do I
trade, who's about to pop, who's about to fall off, and how does each guy
actually score?"

It should have two layers:

1. **Squad layer (top):** dense, sortable, benchmarked rollups — a scannable
   "state of my list" with smart auto-flags (sell-high, buy-low, breakout,
   decline, injury risk).
2. **Player layer (drill-down):** click any player to open a rich panel
   (inline expander on desktop, full-screen sheet on mobile) with tabbed
   per-player analytics — scoring trajectory, ceiling/floor, role fingerprint,
   benchmarks, development curve, keeper value, match log, projection.

Design principles: every number is **contextualised** (percentile, vs league,
vs own baseline, vs position), every chart is **interactive** (hover detail,
toggle comparisons), and the page degrades gracefully for rookies / fringe
players with little AFL data (fall back to state-league + draft pedigree).

---

## Suggested Sub-Navigation Structure

A horizontal sub-nav **inside the Stats page** (mirrors the existing
`league-subnav` chip style). The first tab is squad-wide; the rest populate for
a **selected player** (selecting a player in any squad table sets the context).

| Tab | Purpose | Key user question | Best visualisations | Data required |
|---|---|---|---|---|
| **Overview** | Squad-wide rollup + auto-flags | "What's the state of my list?" | StatTiles, age pyramid, watchlist chips, sortable benchmarked table | roster + `rating/potential/keeper_value/sc_avg/age` |
| **Scoring & Form** | How each player scores + recent form | "Who's hot, who's cold, who's reliable?" | multi-line SC trajectory, rolling-form heat strip, ceiling–floor bars | `sc_history`, `last_3/5_avg`, per-round |
| **Development** | Age/output curve + trajectory | "Who's rising, peaking, declining?" | age-vs-SC scatter with peak band, slope arrows, keeper horizon | `age`, `sc_history.yearly_averages`, `trajectory_slope`, `rating/potential` |
| **Roles & Position** | Positional depth, scarcity, role mix | "Where am I deep/thin? What kind of player is this?" | scarcity map, stat-mix fingerprint radar, height/role | `position`, `detailed` stat mix, `height_cm` |
| **Benchmarks** | Each player vs positional cohort | "Is this output good for the position?" | percentile radar, percentile bars, vs-league deltas | per-position percentiles (derived) |
| **Comparisons** | Compare squad players / find similar | "Who plays like X? Who should I keep of these two?" | overlaid trajectories, similarity list, side-by-side cards | full stat vectors |
| **Draft & Keeper Value** | Acquisition ROI + keep decisions | "Was this a steal? Do I keep him?" | KVI gauge + factor bars, draft-ROI scatter, keep/cut board | `keeper_value`, `draft_score`, `DraftPick`, factor breakdown |
| **Match Log** | Per-game detail + splits | "How did he actually score game to game?" | game-log table w/ heat cells, distribution histogram | per-round detailed stats |
| **Advanced / Risk** | Volatility, durability, regression | "How risky is this asset?" | volatility quadrant, durability timeline, regression flags | stdev, games-missed, career baseline |
| **Projection** | Next-round + next-season outlook | "What do I get next?" | projection fan/range, scenario toggles | Bayesian + age curve (derived) |

> Implementation reality: most per-player tabs need data the current
> `team_stats` endpoint does not return. The recommended path is a **new JSON
> player-analytics endpoint** (e.g. `GET /leagues/<lid>/team/<tid>/player/<pid>/analytics?format=json`)
> that reuses the existing `/player/<name>` assembly (`stats_loader`,
> `draft_model`, `keeper_value`, `team_analytics`) but returns JSON instead of
> the Jinja `player.html`. Marked per-idea below as **Requires new API endpoint**.

---

## 30 Enhancement Ideas

### 1. Squad SuperCoach Trajectory Small-Multiples

**Concept:**
A grid of tiny multi-year SC trajectory sparklines — one per squad player —
each showing yearly SC average with the current season highlighted, so the
whole list's career arcs are scannable at a glance. Click one to open the full
player panel.

**User Question Answered:**
"At a glance, which of my players are trending up, flat, or down over their
careers?"

**Mathematical / Analytical Logic:**
Per player, plot `sc_history.yearly_averages[*].avg` vs `year`. Overlay a
least-squares trend line; colour the spark by `trajectory_slope` sign/magnitude
(green ↑ if slope > +3 pts/yr, red ↓ if < −3, neutral otherwise). Slope already
computed in `load_player_sc_history_fitzroy`.

**Visualisation / UX Design:**
Responsive CSS grid of `StatTile`-sized cards; each card = name + last value +
mini recharts `<LineChart>` (no axes, ~64px tall). Hover shows a tooltip with
year-by-year values and slope (`+4.2/yr`). Empty state for players with <2
seasons: show "Rookie — limited history" with a draft-pedigree chip instead.
Desktop 4–5 across, mobile 2 across.

**Keeper League Usefulness:**
Keeper decisions are about *trajectory*, not just current output — this is the
fastest way to spot risers worth keeping and faders worth trading.

**Data Required:** `sc_history.yearly_averages`, `trajectory_slope`.

**Implementation Notes:** New `<TrajectorySpark>` component (recharts
`LineChart`); needs the new player-analytics endpoint to return `sc_history`
per squad player (batch), or a lightweight `sc_yearly` array added to
`team_stats`. **Requires new API endpoint** (batch).

**Complexity:** Medium **Impact:** High **Priority:** Must Have

---

### 2. Rolling-Form Heat Strip

**Concept:**
A per-player horizontal strip of coloured cells = each recent game's SC,
shaded relative to that player's own season baseline, with a leading badge for
last-3 vs season delta ("🔥 +12" / "❄ −9").

**User Question Answered:**
"Who is in form right now versus coasting on a good season average?"

**Mathematical / Analytical Logic:**
For current-year `current_rounds[*].sc_score`, compute z-score vs season mean/sd;
map z to a diverging colour scale. Form delta = `last_3_avg.supercoach − season
avg`. `last_3_avg`/`last_5_avg` already exist.

**Visualisation / UX Design:**
Row of fixed-width cells (recharts not needed — CSS grid of coloured divs),
most-recent on the right, hover = round + exact score + z. Cell for a missed
game rendered hollow/grey (injury/omission). Mobile: horizontally scrollable.

**Keeper League Usefulness:**
Separates "genuinely hot" from "fading but high average" — critical for
buy/sell timing inside a season.

**Data Required:** `detailed.current_rounds`, `last_3_avg`, `last_5_avg`,
season avg.

**Implementation Notes:** Reuse the colour-cell pattern from the form dots
already added to `SquadPage`. **Requires new API endpoint** for per-round data.

**Complexity:** Medium **Impact:** High **Priority:** Must Have

---

### 3. Ceiling–Floor Range Bars

**Concept:**
For each player, a horizontal bar showing floor (10th pct game), median, and
ceiling (90th pct game) SC, so you see the *range* of outcomes, not just the
average.

**User Question Answered:**
"What's this player's realistic best and worst game — and how wide is the gap?"

**Mathematical / Analytical Logic:**
From the per-game SC distribution (current + historical), compute p10 / p50 /
p90 (and mean). `team_analytics.py` already derives ceiling/floor concepts —
reuse/extend that logic.

**Visualisation / UX Design:**
Floating range bar (think box-plot lite): thin track p10→p90, a dot at median,
a ghost marker at season mean, accent-coloured. Hover = exact values + sample
size. Sort the squad by ceiling, floor, or range width.

**Keeper League Usefulness:**
High-ceiling boom players win you specific weeks; high-floor players win you
seasons. Knowing each player's shape informs captain/keep choices.

**Data Required:** per-game SC across seasons (currently only current-year
per-round is exposed). **Requires new derived metric** (extend `stats_loader`
to expose historical per-game SC, then percentiles).

**Complexity:** Medium **Impact:** High **Priority:** Should Have

---

### 4. Consistency Index (Coefficient of Variation)

**Concept:**
A single 0–100 "reliability" score per player = how tightly their game scores
cluster around their mean.

**User Question Answered:**
"Can I trust this player week to week, or is he a coin flip?"

**Mathematical / Analytical Logic:**
`CV = stdev(game SC) / mean(game SC)`; map to a 0–100 index `consistency =
round(100 · (1 − clamp(CV, 0, 1)))`. `team_analytics.py` already computes
`avg_consistency` — lift the per-player calc out.

**Visualisation / UX Design:**
A labelled chip / mini radial in each player row; in the player panel, a
gauge + plain-language tag ("Metronomic" ≥80, "Reliable" 65–79, "Streaky"
45–64, "Volatile" <45). Sortable column.

**Keeper League Usefulness:**
Consistency is undervalued in keeper formats where you set lineups weekly —
helps choose between two similar-average players.

**Data Required:** per-game SC. **Requires new derived metric** (per-player CV
from existing `team_analytics` logic).

**Complexity:** Low **Impact:** Medium **Priority:** Should Have

---

### 5. Age–Output Development Curve (Squad Scatter)

**Concept:**
A scatter of every squad player: x = age, y = current SC avg, bubble size =
games, colour = position. Overlaid with the league's empirical "peak-age" band
(~24–28) and per-player trajectory arrows.

**User Question Answered:**
"Where is each of my players on the standard AFL development curve?"

**Mathematical / Analytical Logic:**
Plot `age` vs `sc_avg`. Fit a LOESS/polynomial age→SC curve from the full player
pool to draw the population "expectation" line; an arrow per player from
last-year (`sc_avg_prev`) to this-year shows individual trajectory vs the curve.

**Visualisation / UX Design:**
recharts `ScatterChart` with a `ReferenceArea` for the peak band and a reference
line for the population curve. Hover = player card; click = open panel. Toggle
to filter by position. Mobile: collapse to a sorted "age cohort" list.

**Keeper League Usefulness:**
The core keeper question is future value — this visual instantly shows who's
pre-peak (keep/buy), at-peak (hold), or post-peak (sell before decline).

**Data Required:** `age`, `sc_avg`, `sc_avg_prev`, `games_played`, `position`;
population curve from full pool.

**Implementation Notes:** Population curve is a derived fit over all
`AflPlayer` rows — compute server-side once and cache. **Requires new derived
metric.**

**Complexity:** Medium **Impact:** High **Priority:** Must Have

---

### 6. Keeper Horizon Timeline

**Concept:**
A per-player forward timeline (next ~5 seasons) shading each year as
"prime / declining / cliff", giving an at-a-glance "how many good years left".

**User Question Answered:**
"How long is this player a keep before age catches up?"

**Mathematical / Analytical Logic:**
From current `age` + position-specific decline curve (e.g. mids decline ~29,
key forwards/rucks later), project SC retention per future year; flag the year
projected SC drops below e.g. 85% of current. Combine with `potential` for
young players (upside runway).

**Visualisation / UX Design:**
Horizontal segmented bar, one segment per upcoming season, green→amber→red, with
the projected age labelled. Tooltip explains the decline assumption. In the
squad Overview, render as a compact "yrs left" number with colour.

**Keeper League Usefulness:**
Directly answers the keep-or-trade timing question that defines dynasty/keeper
play.

**Data Required:** `age`, `position`, `sc_avg`, `potential`; position decline
curves. **Requires new derived metric.**

**Complexity:** High **Impact:** High **Priority:** Should Have

---

### 7. Breakout Probability Score

**Concept:**
A 0–100 likelihood that a young/fringe player takes a meaningful leap next
season.

**User Question Answered:**
"Which of my cheap/young players is most likely to break out?"

**Mathematical / Analytical Logic:**
Logistic-style composite of: age ≤ 23, positive `trajectory_slope`, rising
games-played, `potential − rating` gap (upside runway), and recent-form delta
(`last_5_avg` vs season). Weight & sigmoid-scale to 0–100. Calibrate weights
against historical breakouts if labelled data is available.

**Visualisation / UX Design:**
A "Breakout" badge with the score; in the panel, a factor bar chart showing
each contributing component. Surface a "Breakout Watch" shelf on Overview of
the top 3 squad candidates.

**Keeper League Usefulness:**
Identifying breakouts before they happen is the single highest-leverage edge in
keeper leagues (cheap keepers that become studs).

**Data Required:** `age`, `trajectory_slope`, `games_played`, `rating`,
`potential`, `last_5_avg`. **Requires new derived metric.**

**Complexity:** High **Impact:** High **Priority:** Should Have

---

### 8. Positional Scarcity & Depth Map

**Concept:**
For each position, show your depth quality vs the league's replacement level —
where you're stacked and where you're dangerously thin.

**User Question Answered:**
"If I lose my MID2 to injury, how big is the drop-off — and where should I
trade for depth?"

**Mathematical / Analytical Logic:**
Per position, rank your players by SC; compare your 1st/2nd/3rd best to the
league **replacement level** (already computed in `team_analytics.py`). Depth
score = sum of (your players − replacement) above replacement.

**Visualisation / UX Design:**
A column per position; stacked dots/bars for your players' SC with a dashed
replacement line; gap below the line highlighted red. Hover = drop-off if you
lose the starter.

**Keeper League Usefulness:**
Keeper rosters live and die on positional depth across byes/injuries — this
makes thin spots obvious before they bite.

**Data Required:** `position`, `sc_avg`; replacement levels (exist in
`team_analytics`). **Requires new derived metric** (reuse replacement logic).

**Complexity:** Medium **Impact:** High **Priority:** Must Have

---

### 9. Positional Percentile Radar

**Concept:**
A radar per player showing their percentile (vs same-position cohort) across
key stat axes: disposals, marks, tackles, goals, hitouts, SC, contested poss.

**User Question Answered:**
"Is this player's output actually good *for his position*?"

**Mathematical / Analytical Logic:**
For each stat, percentile-rank the player within their position cohort across
the pool (`StateLeagueStat`/detailed season averages for the stat axes; SC from
`sc_avg`). Plot percentiles 0–100 on radar axes.

**Visualisation / UX Design:**
recharts `RadarChart`; toggle to overlay a second squad player for comparison.
Axis labels with hover = raw value + percentile. Mobile: fall back to a
horizontal percentile bar list (radars read poorly on small screens).

**Keeper League Usefulness:**
A 90 SC ruck and a 90 SC mid are different assets — positional context reframes
"good".

**Data Required:** per-position percentiles over `detailed.season_averages`
stat cols + `sc_avg`. **Requires new derived metric.**

**Complexity:** Medium **Impact:** Medium **Priority:** Should Have

---

### 10. Player Similarity Finder ("Plays Like")

**Concept:**
For any squad player, surface the most statistically similar players in the
pool ("This player profiles like X, Y, Z").

**User Question Answered:**
"Who is comparable to this player — for trade targets, comps, or replacements?"

**Mathematical / Analytical Logic:**
Build a normalised feature vector per player (z-scored: SC, age, position
one-hot, disposals, marks, tackles, goals, hitouts, consistency, height).
Similarity = cosine similarity or inverse Euclidean distance (k-NN). Return top
k nearest.

**Visualisation / UX Design:**
A "Similar players" list with a similarity % and a tiny stat-delta strip;
clicking a comp opens its profile. In Comparisons tab, a 2-player side-by-side
diff card.

**Keeper League Usefulness:**
Finds undervalued equivalents of your studs (trade targets) and like-for-like
replacements when planning a sale.

**Data Required:** full per-player stat vectors. **Requires new derived
metric** (similarity service over the pool).

**Complexity:** High **Impact:** Medium **Priority:** Nice to Have

---

### 11. Draft Value ROI Scatter (Steals & Busts)

**Concept:**
Plot each squad player's keeper-draft acquisition cost (pick #) against realised
value (SC avg / Keeper Value), so steals and busts pop out.

**User Question Answered:**
"Which of my picks over- or under-delivered relative to where I got them?"

**Mathematical / Analytical Logic:**
x = `DraftPick.pick_number` (from acquisition), y = `sc_avg` (or
`keeper_value`). Fit an expected-value-by-pick curve from all league draft picks;
residual above/below the curve = "value over pick". Steal if residual > +1σ,
bust if < −1σ.

**Visualisation / UX Design:**
recharts `ScatterChart` with the expectation curve; steals tinted green, busts
red, labelled. Players acquired via trade/FA shown with a different marker.
Hover = pick #, year, coach, realised value.

**Keeper League Usefulness:**
Calibrates your own drafting and reveals which assets are outperforming their
cost (and are thus trade chips or locks).

**Data Required:** `DraftPick.pick_number`, `draft_year`, `sc_avg`,
`keeper_value`; league-wide pick→value curve. **Requires new API endpoint** +
**new derived metric**.

**Complexity:** High **Impact:** Medium **Priority:** Nice to Have

---

### 12. Keeper Value Index — Surfaced & Explained

**Concept:**
Prominently display the existing `keeper_value` (0–99) per player with a
factor-breakdown of *why* it's high or low.

**User Question Answered:**
"What is each player actually worth as a keeper, and what's driving it?"

**Mathematical / Analytical Logic:**
`keeper_value` already exists (`models/keeper_value.py`). Surface it plus its
components (output, age/horizon, consistency, position scarcity). Reuse the
`draft_model.factor_breakdown` pattern for the explanatory bars.

**Visualisation / UX Design:**
A KVI gauge (radial) + a horizontal factor-contribution bar chart (like the
existing draft-score breakdown on `/player`). Sortable KVI column on the squad
table with colour bands.

**Keeper League Usefulness:**
This is *the* keeper-specific metric — making it first-class (not buried) aligns
the page with the format.

**Data Required:** `keeper_value` + its factor inputs. (Mostly exists; factor
exposure may need adding.)

**Implementation Notes:** Expose `keeper_value` in `team_stats` payload
immediately (cheap win); factor breakdown via the player-analytics endpoint.

**Complexity:** Low **Impact:** High **Priority:** Must Have

---

### 13. Rating vs Potential Runway

**Concept:**
Show each player's current `rating`, ceiling `potential`, and within-season
`rating_start` movement, framed as "how much upside is left".

**User Question Answered:**
"How much growth runway does this young player have left?"

**Mathematical / Analytical Logic:**
Runway = `potential − rating`. In-season momentum = `rating − rating_start`.
`RatingLog` gives the full rating time series for a trend line.

**Visualisation / UX Design:**
A dual-marker bar (rating ▶ potential) with the gap shaded as "upside"; a small
`RatingLog` sparkline of rating over time. Colour by runway size. Filter squad
to "high runway, young" for keeper targeting.

**Keeper League Usefulness:**
Potential runway is precisely what separates a hold from a long-term keeper.

**Data Required:** `rating`, `potential`, `rating_start`, `RatingLog`. (Exists;
expose in payload.)

**Complexity:** Low **Impact:** Medium **Priority:** Should Have

---

### 14. Match Log with Contextual Splits

**Concept:**
A full per-game log per player (round, opponent, SC, key stats) with split
toggles (home/away, vs finalists, by month).

**User Question Answered:**
"How has he actually performed game by game, and against whom?"

**Mathematical / Analytical Logic:**
List `detailed.current_rounds` (and historical per-game once exposed); compute
split averages. Opponent/venue splits depend on opponent fields in the CSVs.

**Visualisation / UX Design:**
A compact table with heat-shaded SC cells; split chips above filter the table
and recompute the average banner. Distribution histogram alongside. Mobile:
card list.

**Keeper League Usefulness:**
Reveals matchup/venue sensitivity and recency that season averages hide.

**Data Required:** per-game rows. Home/away & opponent splits **Require new data
source** if not in the fitzRoy CSVs; basic round-by-round is available.

**Complexity:** Medium **Impact:** Medium **Priority:** Should Have

---

### 15. Volatility–Output Quadrant

**Concept:**
Scatter squad players by mean SC (x) vs game-to-game stdev (y), splitting them
into quadrants: Safe Studs, Boom-or-Bust, Steady Role, Low-Impact.

**User Question Answered:**
"Which players are high-output *and* safe versus high-output but a gamble?"

**Mathematical / Analytical Logic:**
x = mean game SC, y = stdev game SC; quadrant thresholds at league medians.
Reuses consistency math (idea 4).

**Visualisation / UX Design:**
recharts `ScatterChart` with median `ReferenceLine`s and labelled quadrants;
hover = player; click = panel. Toggle position filter.

**Keeper League Usefulness:**
Frames risk/return for keep & captaincy decisions in one picture.

**Data Required:** per-game SC mean & stdev. **Requires new derived metric.**

**Complexity:** Medium **Impact:** Medium **Priority:** Should Have

---

### 16. Availability & Durability Timeline

**Concept:**
A per-player season-by-season availability bar (games played / possible) plus a
durability score and current injury status.

**User Question Answered:**
"How often is this player actually on the park?"

**Mathematical / Analytical Logic:**
Availability% = `games_played / games_possible` per season (possible = rounds in
season). Durability = multi-year availability mean (exists as `avg_durability`
in `team_analytics`). Current injury from `injury_*` fields.

**Visualisation / UX Design:**
Stacked yearly bars (played vs missed), with gaps annotated; a durability gauge;
the live injury chip (reuse existing injury styling). Sort squad by durability.

**Keeper League Usefulness:**
Soft-tissue-prone stars quietly sink keeper seasons; durability is a real
valuation input.

**Data Required:** `games_played` per season (`detailed.season_averages.games`),
season length, `injury_*`. **Requires new derived metric** (games-possible).

**Complexity:** Medium **Impact:** Medium **Priority:** Should Have

---

### 17. Regression-to-Mean Flags (Sell-High / Buy-Low)

**Concept:**
Flag players whose current-season SC is far above or below their established
multi-year baseline — likely to regress.

**User Question Answered:**
"Who is overperforming (sell now) or underperforming (buy low)?"

**Mathematical / Analytical Logic:**
Baseline = age-adjusted weighted mean of prior seasons (Bayesian shrinkage,
already in `team_analytics`). Flag if `current − baseline` exceeds ~1.5σ of the
player's historical variation. Sell-high if above, buy-low if below.

**Visualisation / UX Design:**
A coloured flag chip ("Sell-high +18 vs baseline") on the row and Overview
shelf; in the panel, a band chart showing baseline ± expected range with the
current point outside it.

**Keeper League Usefulness:**
Trade-timing edge — buy/sell against the market before reversion.

**Data Required:** multi-year `sc_history`, Bayesian baseline (exists).
**Requires new derived metric** (per-player flag).

**Complexity:** Medium **Impact:** High **Priority:** Should Have

---

### 18. Role / Stat-Mix Change Detector

**Concept:**
Detect when a player's *role* has shifted (e.g. inside-mid → half-back) by
tracking changes in their stat composition year over year.

**User Question Answered:**
"Has this player's role changed in a way that affects scoring?"

**Mathematical / Analytical Logic:**
Represent each season as a normalised stat-mix vector (disposal share, marks,
tackles, goals, hitouts, contested%); measure year-over-year vector distance.
A large shift = role change. True CBA%/positional-role feeds would sharpen this.

**Visualisation / UX Design:**
A stacked-area "stat mix over time" chart; a callout when a significant shift is
detected ("Role shift in 2025: more marks, fewer contested"). 

**Keeper League Usefulness:**
Role changes precede scoring breakouts/declines — early signal for value moves.

**Data Required:** multi-year `detailed.season_averages` stat cols. CBA% /
explicit role **Requires new data source**; stat-mix proxy is available.

**Complexity:** High **Impact:** Medium **Priority:** Nice to Have

---

### 19. Next-Season Projection (Bayesian + Age Curve)

**Concept:**
A projected SC average for next season per player, with an uncertainty range.

**User Question Answered:**
"What will this player average next year if I keep him?"

**Mathematical / Analytical Logic:**
Bayesian shrinkage of recent seasons toward position/age prior (logic exists in
`team_analytics`), then apply the age-curve delta (idea 5/6) for next year's
age. Output projected mean + 80% interval from historical variance.

**Visualisation / UX Design:**
A projection "fan"/range bar: this-year point → next-year projected point with a
shaded interval; colour by up/down. Overview column "Proj 'YY".

**Keeper League Usefulness:**
Keeper decisions are bets on *next* year — an explicit projection is the most
direct decision aid.

**Data Required:** `sc_history`, `age`, position prior. **Requires new derived
metric** (reuse Bayesian + age curve).

**Complexity:** High **Impact:** High **Priority:** Should Have

---

### 20. Next-Round Projection

**Concept:**
A short-term projected SC for the upcoming round per player (form + role + base).

**User Question Answered:**
"Roughly what do I get from this player this week?"

**Mathematical / Analytical Logic:**
Weighted blend: `0.5·last_3_avg + 0.3·season_avg + 0.2·career_avg`, optionally
nudged by opponent strength if matchup data is wired. Already partially covered
by the squad "Projected" metric — here it's per player with the form weighting
shown.

**Visualisation / UX Design:**
Per-player projected number with a small "form-weighted" tooltip breakdown; ties
into lineup decisions.

**Keeper League Usefulness:**
Weekly lineup/captain calls; complements the keeper-horizon long view.

**Data Required:** `last_3_avg`, `sc_avg`, `career_avg`. (Exists.)

**Complexity:** Low **Impact:** Medium **Priority:** Should Have

---

### 21. State-League → AFL Readiness (Fringe Players)

**Concept:**
For fringe/young players with limited AFL data, surface their VFL/SANFL/WAFL
output and percentile to gauge AFL-readiness.

**User Question Answered:**
"Is this state-league player ready to produce at AFL level?"

**Mathematical / Analytical Logic:**
Use `StateLeagueStat.dreamteam_avg` + the existing comp/team percentile rankings
(`_build_section` already computes rank-in-comp). Map high state-league
percentile + age to a readiness tag.

**Visualisation / UX Design:**
A "state-league" card shown only when AFL data is thin: comp + season, dreamteam
avg, "Top X% in VFL" badges, mini trajectory. Avoids an empty profile for
rookies.

**Keeper League Usefulness:**
Fringe/rookie keepers are cheap upside — this is where leagues are won, and the
data already exists.

**Data Required:** `StateLeagueStat` (exists, incl. percentile ranks).

**Complexity:** Low **Impact:** Medium **Priority:** Should Have

---

### 22. Junior & Draft Pedigree Strip

**Concept:**
For young players, a compact pedigree strip: AFL draft pick/year, U18/Coates
output, junior percentile.

**User Question Answered:**
"What was this kid's draft pedigree and junior production?"

**Mathematical / Analytical Logic:**
Show U18/NAB section from `StateLeagueStat` (`sl_u18`) + draft pick. AFL draft
pick/year availability needs confirming in `AflListHistory`/draftguru.

**Visualisation / UX Design:**
A horizontal pedigree timeline: Draft (pick #) → U18 stats → state league → AFL
debut. Clean iconography, collapses on mobile.

**Keeper League Usefulness:**
Draft pedigree correlates with breakout odds — useful context for young keeper
bets.

**Data Required:** U18 `StateLeagueStat` (exists); AFL draft pick/year **Requires
new data source / verification** (may exist via draftguru).

**Complexity:** Medium **Impact:** Low **Priority:** Nice to Have

---

### 23. Squad Age Pyramid

**Concept:**
A population-pyramid-style view of your list: counts (or SC mass) by age bucket,
split by position.

**User Question Answered:**
"Is my list age-balanced, or top-heavy with ageing stars / too green?"

**Mathematical / Analytical Logic:**
Bucket players by age (≤21, 22–24, 25–27, 28–30, 31+); within each, stack by
position or sum SC. Compare your distribution shape to a balanced ideal.

**Visualisation / UX Design:**
Horizontal diverging bars (pyramid) or a stacked bar; hover lists players in the
bucket. A one-line verdict ("Top-heavy: 42% of SC from 29+").

**Keeper League Usefulness:**
Age structure is the heartbeat of a keeper list — this makes "contending vs
rebuilding" obvious.

**Data Required:** `age`, `position`, `sc_avg`. (Exists.)

**Complexity:** Low **Impact:** Medium **Priority:** Should Have

---

### 24. Trade-Value Heat (Composite Asset Score)

**Concept:**
A single tradeable-asset score blending output, age/horizon, consistency, and
scarcity — a "what's this guy worth in a deal" number.

**User Question Answered:**
"Who are my most/least valuable trade chips right now?"

**Mathematical / Analytical Logic:**
Composite z-blend: `keeper_value` (base), age-horizon multiplier, consistency,
positional scarcity premium. Normalise 0–100. Distinct from KVI by emphasising
*market* desirability.

**Visualisation / UX Design:**
A heat-sorted asset board (cards ranked, colour by tier) with "rising/falling"
arrows vs last computation. Drag-free, just a ranked read.

**Keeper League Usefulness:**
Frames the whole list as trade assets — directly supports deal-making.

**Data Required:** `keeper_value`, `age`, consistency, scarcity. **Requires new
derived metric.**

**Complexity:** Medium **Impact:** Medium **Priority:** Nice to Have

---

### 25. Momentum Arrows (Hot-Hand)

**Concept:**
A simple per-player momentum indicator (▲▲ / ▲ / ▬ / ▼ / ▼▼) from recent slope.

**User Question Answered:**
"Who's trending up or down over the last few weeks?"

**Mathematical / Analytical Logic:**
Slope of last-5 games vs prior-5 (or `last_3_avg − season_avg`), bucketed into 5
momentum tiers.

**Visualisation / UX Design:**
A coloured arrow glyph in every squad row + a tiny 5-game sparkline; cheap,
always-visible signal. Sort by momentum.

**Keeper League Usefulness:**
Fast in-season read for lineup and buy/sell nudges.

**Data Required:** `last_3_avg`/`last_5_avg`, `current_rounds`. (Mostly exists.)

**Complexity:** Low **Impact:** Medium **Priority:** Should Have

---

### 26. Stat-Mix Fingerprint ("What kind of scorer")

**Concept:**
A per-player "fingerprint" describing *how* they score (disposal-machine,
goalkicker, tackler, ruck-dominant, hybrid).

**User Question Answered:**
"How does this player generate their fantasy points?"

**Mathematical / Analytical Logic:**
Normalise career stat shares (kicks/handballs/marks/tackles/goals/hitouts) into
a composition; classify against archetype templates (max-share / template
distance).

**Visualisation / UX Design:**
A small stacked "fingerprint" bar + an archetype label; in the panel, a radar
or treemap of stat composition. Helps comparisons feel concrete.

**Keeper League Usefulness:**
Scoring source affects floor stability (tackle/disposal accumulators are safer
than goal-dependent) — informs risk and matchup reads.

**Data Required:** `detailed.season_averages`/`career_totals` stat cols.
**Requires new derived metric** (archetype classifier).

**Complexity:** Medium **Impact:** Medium **Priority:** Nice to Have

---

### 27. Career Arc Timeline (Club & Level by Year)

**Concept:**
A clean career timeline: club-by-year with games and level (AFL vs VFL/SANFL/
WAFL), including non-playing list seasons.

**User Question Answered:**
"What's this player's career path and continuity?"

**Mathematical / Analytical Logic:**
Directly render `afl_team_history` (already assembled in the `/player` route:
AFL listing overrides reserves for a year; state-league years shown with their
logo; non-playing list seasons included).

**Visualisation / UX Design:**
Horizontal timeline with club logos, games-per-year bars, and level colour;
gaps/level-changes annotated (delisted → state league → redrafted).

**Keeper League Usefulness:**
Context for journeymen, redrafts, and stability — useful for valuing fringe
keepers.

**Data Required:** `afl_team_history` (logic exists in `/player`).
**Requires new API endpoint** to return it as JSON.

**Complexity:** Low **Impact:** Low **Priority:** Nice to Have

---

### 28. Boom / Bust Game-Frequency Bars

**Concept:**
Per player, the % of games that are "booms" (SC ≥ threshold, e.g. 120) vs
"busts" (SC ≤ e.g. 60).

**User Question Answered:**
"How often does this player actually go big — or bomb?"

**Mathematical / Analytical Logic:**
Over all games, `boom% = count(SC ≥ 120)/games`, `bust% = count(SC ≤ 60)/games`
(thresholds configurable / position-relative).

**Visualisation / UX Design:**
A 100%-width split bar (boom green / mid grey / bust red) per player; tooltip =
counts and thresholds. Sort by boom%.

**Keeper League Usefulness:**
Captaincy and ceiling decisions — frequency of big games matters more than
average for upside picks.

**Data Required:** per-game SC. **Requires new derived metric.**

**Complexity:** Low **Impact:** Medium **Priority:** Should Have

---

### 29. Smart Watchlist Auto-Flags

**Concept:**
An automated "coach's notes" shelf on Overview that scans the squad and raises
the most decision-relevant flags: Sell-High, Buy-Low, Breakout Watch, Decline
Risk, Injury Risk, Keep Lock.

**User Question Answered:**
"If I only had 30 seconds, what should I act on?"

**Mathematical / Analytical Logic:**
Rules engine combining earlier metrics: regression flag (17), breakout score
(7), keeper horizon (6), durability/injury (16), KVI (12). Each player gets 0–N
tags with a short reason string.

**Visualisation / UX Design:**
A row of categorised flag chips at the top of Overview; click a chip → filters
the squad table to those players. Each chip shows count; empty categories
hidden.

**Keeper League Usefulness:**
Turns the whole analytics suite into *actions* — the highest-value UX layer for
busy managers.

**Data Required:** outputs of ideas 6, 7, 12, 16, 17. **Requires new derived
metric** (aggregator).

**Complexity:** Medium **Impact:** High **Priority:** Must Have

---

### 30. Compare Tray (Multi-Player Side-by-Side)

**Concept:**
A persistent "compare" tray: tick 2–4 squad players and open a side-by-side
analytics comparison (trajectories overlaid, benchmark deltas, projections,
keeper value).

**User Question Answered:**
"Of these players, which do I keep / start / trade?"

**Mathematical / Analytical Logic:**
No new model — composes existing per-player metrics into aligned columns;
overlay trajectories on one chart; highlight the better value per row.

**Visualisation / UX Design:**
Checkbox on each squad row adds to a sticky bottom tray (count badge);
"Compare" opens a modal/sheet with a column per player, a shared overlaid
SC-trajectory chart, and green/best highlights per metric row. Mobile:
full-screen swipeable columns.

**Keeper League Usefulness:**
Keep/cut and trade decisions are inherently comparative — this is the natural
decision surface tying everything together.

**Data Required:** per-player metrics from the above ideas. **Requires new API
endpoint** (batch fetch for selected players).

**Complexity:** Medium **Impact:** High **Priority:** Should Have

---

## Suggested Build Order (pragmatic)

1. **Foundations (unlock everything):** new JSON player-analytics endpoint
   (reuse `/player` assembly) + expand `team_stats` payload with `rating,
   potential, keeper_value, sc_avg_prev, height_cm, trajectory_slope`. Add the
   in-page sub-nav + player drill-down panel shell.
2. **Cheap, high-impact wins (mostly existing data):** #12 KVI surfaced, #5 age
   curve, #1 trajectory sparks, #23 age pyramid, #13 rating/potential, #25
   momentum, #20 next-round, #29 watchlist flags.
3. **Derived-metric tier:** #2 form heat, #3 ceiling/floor, #4 consistency, #8
   scarcity, #15 volatility quadrant, #16 durability, #17 regression, #19
   next-season projection, #28 boom/bust.
4. **Heavier / nice-to-have:** #6 horizon, #7 breakout, #9 radar, #10 similarity,
   #11 draft ROI, #18 role change, #24 trade value, #26 fingerprint, #27 career
   arc, #30 compare tray, #21/#22 fringe & pedigree (rookie coverage).

## Cross-cutting Notes

- **Charting:** standardise on recharts (already in deps; precedent in
  `PlayerModal.tsx`). Build small reusable wrappers (`<TrajectorySpark>`,
  `<RangeBar>`, `<PercentileRadar>`, `<HeatStrip>`).
- **Mobile:** radars/scatters degrade to sorted bar/percentile lists; the
  player drill-down is a full-screen sheet (consistent with the app's
  mobile-native sheet pattern).
- **Empty states:** rookies/fringe with little AFL data fall back to
  state-league (#21) + pedigree (#22) instead of blank charts.
- **Performance:** derived metrics (curves, percentiles, replacement levels,
  similarity) should be computed server-side and cached per refresh, not per
  request — mirror how `team_analytics` already batches the league.
- **Do not touch** the Analytics tab; where logic overlaps (Bayesian,
  consistency, durability, replacement levels), **reuse** the functions in
  `models/team_analytics.py` / `models/keeper_value.py` rather than duplicating.

---

## Addendum — Keeper-League Participation / Usage Stats (My Team, not just AFL)

> Added scope: the Stats page should also surface how each player has been used
> **within this fantasy team**, not just their AFL output. "Games played *for
> my team*", 7s games, captain games, emergency call-ups, bench time, points
> they've actually banked for me, tenure on my list, etc. This is some of the
> most interesting, league-personal data on the page — and it's all derivable
> from existing per-round history.

**Data sources (all already in `models/database.py`):**

- `WeeklyLineup` + `LineupSlot` — the per-round historical lineup snapshot per
  team, with `position_code`, `is_captain`, `is_vice_captain`, `is_emergency`
  (and benched/field state). This is the spine for every per-team participation
  count, round by round.
- `RoundScore` (`total_score`, `captain_bonus`, `breakdown` JSON) — per-team,
  per-round scoring, including the per-player breakdown → points banked for you.
- `Reserve7sLineup` + `Reserve7sRoundScore` — 7s appearances, 7s captaincy, 7s
  points.
- `FantasyRoster` (`acquired_via`) + `DraftPick`/`DraftSession` — acquisition &
  tenure.

> These belong in a new **"Usage"** sub-nav tab (added to the structure above),
> sitting alongside the AFL-output tabs. Purpose: *"How have I actually deployed
> this player, and what have they returned for my team?"* They're all per
> team+player, so they ride on the same player-analytics endpoint but gated to
> the viewing team's context. **Most are Requires new derived metric** (the raw
> rows exist; the aggregation across rounds does not yet).

---

### 31. Team Appearance Ledger (Games For My Team vs AFL)

**Concept:**
A clear split of, for this player on your list: rounds **started on-field for
you**, rounds **benched**, rounds **out** (bye/injury/omitted), versus the AFL
games available in that span.

**User Question Answered:**
"How many games has this player actually counted for *my* team — and how often
did I have him on the ground when he played?"

**Mathematical / Analytical Logic:**
Across `LineupSlot` rows for (team, player) over all `WeeklyLineup` rounds:
`team_games = count(on-field rounds where his AFL team played)`; `bench_rounds`,
`out_rounds`. "Deployment rate" = team_games / (rounds he was rostered and his
AFL club played).

**Visualisation / UX Design:**
A compact ledger card: big "Games for [Team]" number, with a stacked bar
(field / bench / out) and the deployment rate %. Hover each segment → list of
rounds. Squad-table column "Gms (you)".

**Keeper League Usefulness:**
Distinguishes a player who's *been valuable to you* from one who's been a
bench-warming hold — directly informs keep/cut.

**Data Required:** `LineupSlot` (per-round, per-team), AFL games-played per
round. **Requires new derived metric.**

**Complexity:** Medium **Impact:** High **Priority:** Must Have

---

### 32. Captaincy & Vice-Captaincy Log

**Concept:**
A record of how often you've handed this player the C / VC, and what it
returned — captain games, total captain bonus banked, and captain hit-rate.

**User Question Answered:**
"Have I trusted this player with the captaincy, and has it paid off?"

**Mathematical / Analytical Logic:**
From `LineupSlot.is_captain`/`is_vice_captain` per round: `captain_games`,
`vc_games`. Join `RoundScore.captain_bonus` (or per-player breakdown) on the
rounds he captained → `captain_points` and average. Hit-rate = % of captain
games scoring above his season avg.

**Visualisation / UX Design:**
A captaincy strip: rounds-as-C timeline with each game's score heat-shaded;
headline "Captained 6× · +614 bonus · 67% hit". Squad-level "captaincy log"
showing who you lean on.

**Keeper League Usefulness:**
Captain choice is a weekly scoring lever; reviewing your own captaincy history
sharpens future calls and shows which players have earned trust.

**Data Required:** `LineupSlot.is_captain/is_vice_captain`,
`RoundScore.captain_bonus`/breakdown. **Requires new derived metric.**

**Complexity:** Medium **Impact:** High **Priority:** Should Have

---

### 33. 7s Participation & Returns

**Concept:**
For each player, their Reserve 7s usage on your team: 7s games played, 7s
captain games, and 7s points banked.

**User Question Answered:**
"How much has this player featured in my 7s side, and what did he score there?"

**Mathematical / Analytical Logic:**
Count `Reserve7sLineup` rounds for (team, player); join `Reserve7sRoundScore`
breakdown for points; flag `is_captain` rounds in 7s.

**Visualisation / UX Design:**
A small "7s" badge block: games, captain games, avg 7s score; only shown for
players who've featured in 7s (hidden otherwise). Squad column "7s gms".

**Keeper League Usefulness:**
7s is a parallel competition many managers under-track; surfacing per-player 7s
usage rounds out a player's true value to your franchise.

**Data Required:** `Reserve7sLineup`, `Reserve7sRoundScore`. **Requires new
derived metric.**

**Complexity:** Medium **Impact:** Medium **Priority:** Should Have

---

### 34. Emergency Call-Up Tracker

**Concept:**
How often you named this player an emergency, and how often that emergency
**actually got activated** (subbed in to cover a non-player) — plus the points
it salvaged.

**User Question Answered:**
"Is this bench/emergency player quietly saving my round scores?"

**Mathematical / Analytical Logic:**
From `LineupSlot.is_emergency` per round: `emg_named`. Activation = rounds where
a field player didn't play and this emergency's score was promoted (detectable
from the scoring engine's emergency logic / `breakdown`). `points_salvaged` =
sum of activated scores.

**Visualisation / UX Design:**
A "covered X rounds · +Y pts salvaged" callout with a per-round mini-log marking
activated rounds. Squad-level "best insurance" ranking.

**Keeper League Usefulness:**
Quantifies the hidden value of depth/emergency pieces — often the difference in
tight matchups, and a real keeper consideration.

**Data Required:** `LineupSlot.is_emergency`, scoring-engine emergency
promotion, `RoundScore.breakdown`. **Requires new derived metric.**

**Complexity:** High **Impact:** Medium **Priority:** Nice to Have

---

### 35. Field / Bench / Emergency / 7s Utilisation Mix

**Concept:**
A single visual of how you've deployed each player across the season: % of
rostered rounds on-field vs benched vs emergency vs 7s.

**User Question Answered:**
"What role has this player actually played on my list this year?"

**Mathematical / Analytical Logic:**
Over all rostered rounds, tally role per round from `LineupSlot`/`Reserve7sLineup`
and normalise to shares. Utilisation rate = on-field share.

**Visualisation / UX Design:**
A small horizontal 100% stacked bar per player (field / bench / emg / 7s),
consistent colour key; hover = round counts. Squad Overview can sort by
on-field utilisation to find dead-weight roster spots.

**Keeper League Usefulness:**
Reveals roster spots you never actually use — prime delist/trade candidates in a
keeper squeeze.

**Data Required:** `LineupSlot`, `Reserve7sLineup` per round. **Requires new
derived metric.**

**Complexity:** Medium **Impact:** Medium **Priority:** Should Have

---

### 36. Points Banked For My Team (Contribution Share)

**Concept:**
The total fantasy points this player has actually scored **while counting for
your team** this season, and their share of your team's total.

**User Question Answered:**
"How much of my season output has come from this player?"

**Mathematical / Analytical Logic:**
Sum the player's per-round score on rounds he was on-field for you (from
`RoundScore.breakdown` keyed by player, or LineupSlot joined to his round
score), including captain doubling where it applied. Share = player_points /
team_total_points.

**Visualisation / UX Design:**
A "Banked for you: 1,842 (14% of team)" stat; a squad-wide contribution treemap
or ranked bar showing who's carrying your scoring. Distinct from AFL season
total (which ignores your lineup choices).

**Keeper League Usefulness:**
Shows realised, team-specific value (not theoretical AFL output) — the truest
measure of what a player has done *for you*.

**Data Required:** `RoundScore.breakdown` per player, `LineupSlot` on-field
rounds. **Requires new derived metric.**

**Complexity:** Medium **Impact:** High **Priority:** Should Have

---

### 37. Tenure & Acquisition Journey

**Concept:**
How long this player has been on your list and how he arrived — rounds/seasons
rostered, acquisition method (draft pick #, trade, FA, mid-season draft), and
continuity.

**User Question Answered:**
"How long have I held this player, and how did I get him?"

**Mathematical / Analytical Logic:**
`acquired_via` + `DraftPick`/`DraftSession` for the entry event; count distinct
rostered rounds/seasons (`FantasyRoster` history / `WeeklyLineup` presence) for
tenure.

**Visualisation / UX Design:**
A small journey chip: "Drafted R1 P14, 2024 · 28 rounds on list" with an icon
for acquisition type; ties into the Draft & Keeper Value tab.

**Keeper League Usefulness:**
Context for keeper loyalty/sunk-cost and contract-style decisions; pairs with
draft-ROI (#11).

**Data Required:** `FantasyRoster.acquired_via`, `DraftPick`/`DraftSession`,
roster/lineup history. (Acquisition exists; tenure **Requires new derived
metric**.)

**Complexity:** Low **Impact:** Low **Priority:** Nice to Have

---

### 38. Season Usage Timeline (Role Ribbon)

**Concept:**
A per-round ribbon for the season showing exactly how you deployed the player
each round: F (field) / B (bench) / E (emergency) / 7 (7s) / — (out), with the
score in each played round.

**User Question Answered:**
"Round by round, how did I use this player and what did he score?"

**Mathematical / Analytical Logic:**
For each round, resolve role from `LineupSlot`/`Reserve7sLineup` and score from
`RoundScore.breakdown`; render the sequence.

**Visualisation / UX Design:**
A horizontal ribbon of round cells, colour = role, number = score, captain
rounds marked with a (C). Hover = full round detail. Mobile: horizontally
scrollable. This is the per-player companion to the squad Usage Mix (#35).

**Keeper League Usefulness:**
A single glance at your management of a player all season — great for reviewing
decisions and spotting underused assets.

**Data Required:** `LineupSlot`, `Reserve7sLineup`, `RoundScore.breakdown` per
round. **Requires new derived metric.**

**Complexity:** Medium **Impact:** Medium **Priority:** Should Have

---

### Usage-tab build note

All of #31–#38 read from the **same per-round history** (`WeeklyLineup` /
`LineupSlot` / `RoundScore` / `Reserve7s*`). The efficient approach is **one
server-side aggregation pass** per (team, player) — or per team, batched —
that walks the rounds once and emits every counter (team games, captain games,
VC games, 7s games, emergency named/activated, role mix, points banked, tenure).
Expose it on the player-analytics endpoint (and a batch variant for the squad
table's new "you"-context columns). It composes cleanly with the AFL-output
ideas above without touching the Analytics tab.

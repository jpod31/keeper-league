# Team Intelligence Hub — the Crown-Jewel Plan

> A ground-up rebuild of "My Team → Stats" into a **Team Intelligence Hub**: not
> a stats table, but a place a manager returns to weekly to understand their
> squad's makeup, how it's *moving*, how it *stacks up against the league*, what
> the *records* are, and what's *predicted* next — backed by real ML, deep
> statistics, and high-end interactive (incl. 3D) visuals. Player-level depth
> lives in a redesigned **Player Profile** you reach by clicking any player.
>
> Roles in the room: **Data Scientist** (models & truth), **Data Modeller**
> (pipelines & contracts), **UX Designer** (flow, IA, beauty), **ML Engineer**
> (training, validation, serving), **Front-end Architect** (packages, perf, 3D).

---

## 0. What went wrong before (so we don't repeat it)
- We coloured per-week scores by deviation from a player's *own* mean — variance
  dressed up as signal. **Fix: contextual baselines + significance everywhere.**
- We shipped a flat table and a scrolling colour grid — data dumps, not insight.
  **Fix: guided IA, purposeful visuals, the few things that matter surfaced.**
- "My team stats" and records were buried/absent. **Fix: explicit sections.**
- No real modelling. **Fix: a genuine ML prediction pipeline with validation.**

---

## 1. The data we actually have (audited)
**Per-game player rows (fitzRoy CSVs, 2013→present):** Date, Season, Round,
**Venue**, Player, Team, **Opposition**, Status, Match_id, TOG (time on ground),
and a deep stat set — CP/UP (contested/uncontested), ED/DE (disposal efficiency),
CM, MI5 (marks inside 50), one-percenters, K/HB/D, M, G/B, T, HO, I50, CL
(+CCL/SCL split), CG (clangers), R50, FF/FA, MG (metres gained), TO, ITC, **AF**
(AFL Fantasy) **+ SC** (SuperCoach). → enables opponent & venue splits, role
signals (TOG, CBA), an underlying-stats model (**xSC**), and rich ML features.

**Already in the app:** SuperCoach history, **CBA% + trend** (dfsaustralia),
FIFA-style rating/potential, **keeper value index**, per-round lineup history
(`WeeklyLineup`/`LineupSlot`), per-team round scores + breakdown (`RoundScore`),
7s, draft picks, state-league + U18, AFL list history (club-by-year), Bayesian/
consistency/durability engines, replacement levels, squad-health ranking.

**What we'd derive (no new source):** opponent defensive strength (SC conceded by
position), venue residuals, rest days (from Date), age curves, true-talent priors.

**What would need a new source (optional, later):** weather, injury-return
confidence beyond current, betting/role news. *Marked where used.*

---

## 2. Information Architecture — sections you can actually find
The Hub gets a clear sub-nav (chips, like the league/players subnav). Each is a
distinct "place":

1. **Overview** — the cockpit. Auto-narrative headline, a few decision tiles,
   your team at a glance *and* a vs-league snapshot. The "what should I care
   about this week" view.
2. **My Squad** — the interactive player **matrix** (Performance / **Your Usage**
   / Value view-modes) — *this is where "my team stats" live*: games-for-you,
   captain games, points banked, 7s, role, VORP, projection — sortable, filter,
   inline micro-viz, click → Player Profile.
3. **League** — how you stack up: power rankings, **positional-strength radar vs
   the league**, projected ladder, percentile-of-everything, head-to-head matrix,
   schedule strength. *("how you stack up to other teams")*
4. **Trends & Movement** — how your squad is *moving*: squad-strength curve over
   time, **Dynasty Window** projection (idea #8), value/age drift, form (signal,
   not noise), trade-impact history. *("how your squad is moving")*
5. **Records** — team & player records, season + all-time: highest round score,
   biggest win/margin, longest streak, best individual game, most consistent,
   milestones, captaincy ROI. *(the missing "records" section)*
6. **Predictions (ML)** — next-round projected XI score + **win probability**
   (Monte-Carlo, idea #12), per-player predictions with **opponent & venue**
   context, and a transparent **model-accuracy / backtest** panel.
7. **Player Profile** (drill-down, redesigned) — deep per-player: score
   distribution, **opponent splits** (best/worst matchups), **venue/stadium
   splits**, form (changepoint-aware), role (CBA/TOG), xSC over/under-performance,
   career arc, similar players, prediction with reasoning, head-to-head compare.

> The three you picked map in: **#8 Dynasty Window** → Trends; **#11 Archetype
> clustering** → Overview/League (squad makeup & gaps); **#12 Monte-Carlo** →
> Predictions/Overview.

---

## 3. The modelling layer (Data Scientist + ML Engineer)

### 3a. Core predictive model — projected SuperCoach per player-game
**Target:** a player's SC in an upcoming game (and aggregated to round/season).
**Features (all derivable):**
- Form: rolling means (last 3/5/10), EWMA, trend slope, volatility.
- Role: **CBA%** + trend, **TOG%**, positional role, recent CBA momentum.
- Underlying: contested poss, disposals, DE, MI5, I50, clearances, MG (lagged).
- Context: **opponent defensive strength** (SC conceded to the player's position),
  **venue effect** (player & league residuals at that venue), home/away, rest days.
- Player: age (age-curve term), rating/potential, career baseline, injury status.

**Model choice (we'll present a recommendation, not hand-wave):**
- **Primary: gradient-boosted trees (LightGBM / XGBoost)** — state-of-the-art for
  tabular, handles non-linear interactions (role × opponent × venue), fast, robust.
- **You asked for backprop/NN:** add an optional **PyTorch/Keras MLP** and a tiny
  **embedding model** (player & opponent & venue embeddings) — genuinely uses
  backpropagation, and we **ensemble** it with the GBM. We'll report which wins on
  the backtest rather than assume.
- **Uncertainty:** quantile regression (P10/P50/P90) → prediction *bands*, not a
  single number. (This is what makes it trustworthy.)

### 3b. Training, validation & the "backprop to test & refine" loop
- **Walk-forward / time-series backtest:** train on rounds ≤ N, predict round N+1,
  roll forward across seasons. No look-ahead leakage. This *is* the iterative
  "test & refine" — each pass measures error, we tune features/hyperparams, repeat.
- **Metrics:** MAE / RMSE vs naïve baselines (season avg, last-3 avg) — the model
  must *beat* the baselines or we don't ship it. Calibration of the P10–P90 bands.
- **Feature importance / SHAP** surfaced in the UI so predictions are explainable
  ("driven by: role ↑, soft matchup, strong venue history").
- **Cadence:** retrain weekly (scheduler / refresh) on the server (Python + libs
  already there); **serve precomputed predictions** (no inference latency in the page).

### 3c. Supporting models
- **xSC (expected SC):** regression of SC on underlying stats → who's over/under-
  converting (luck vs skill, regression candidates).
- **Opponent & venue effect models:** mixed-effects / residual models giving each
  player a matchup & stadium adjustment (powers the splits + profile).
- **True-talent (empirical Bayes):** shrink to position/age prior + credible band.
- **Archetype clustering (#11):** k-means / GMM on normalised stat vectors →
  player types (accumulator, goal-mid, lockdown D, ruck-hybrid, pressure fwd) →
  squad-composition view and gap analysis.
- **Monte-Carlo squad sim (#12):** sample each starter from their predictive
  distribution (incl. captain ×if-enabled) → squad score distribution, expected
  total, range, and **win probability** vs each opponent / the field.
- **Dynasty window (#8):** project squad strength over 4 seasons from age curves ×
  projections → contention timeline.

---

## 4. Visualisation & packages (Front-end Architect)
Honest tradeoffs — we don't need everything; we choose deliberately and lazy-load
the heavy stuff per section.

| Need | Recommended | Why / tradeoff |
|---|---|---|
| Core 2D charts | **keep recharts** + add **visx** (or **nivo**) | recharts for simple; visx (D3 under the hood) for custom/performant bespoke charts (scatter, frontier, radar) |
| **Interactive 3D / "futuristic"** | **Apache ECharts + echarts-gl** *or* **Plotly.js** | ECharts-gl: GPU 3D scatter/surface/globe, gorgeous, interactive, one lib for 2D+3D; Plotly: easiest scientific 3D. Both ~heavy → **lazy-load only on sections that use 3D** |
| Custom bespoke 3D (squad "galaxy", animated) | **react-three-fiber + drei (Three.js)** | full control for a signature hero (e.g., 3D player-value cloud you can orbit). Highest effort; use for one wow-piece, not everywhere |
| The pro data grid | **TanStack Table** (headless) | proper sort/multi-sort/filter/group/virtualise for the matrix — replaces hand-rolled sorting, scales to big tables |
| Motion / transitions | **framer-motion** | orchestrated animation + built-in layout/FLIP (the matrix re-sort we hand-rolled becomes trivial + smoother) |
| ML / stats (backend, Python) | **scikit-learn, LightGBM/XGBoost, scipy/statsmodels**, optional **PyTorch** | all pip-installable on the server; training offline, serve precomputed |
| Maps/large-data GPU (optional) | deck.gl | only if we do something spatial; probably skip |

**Recommendation:** ECharts(+gl) as the primary advanced/3D library (one
dependency covers interactive 2D *and* 3D, great perf), **TanStack Table** for the
matrix, **framer-motion** for motion, **LightGBM + scikit-learn (+ optional
PyTorch NN)** for ML. Keep recharts for the simple existing charts. Lazy-load
ECharts-gl/3D so the base page stays light.

**Where 3D earns its place (purposeful, not gimmick):**
- **3D Scouting Cloud** — output × reliability × value (or × age) as an orbitable
  3D scatter; rotate to see the value frontier; colour = position; click → profile.
- **League landscape** — your team vs others in a 3D space of (offense, defense,
  youth); see clusters/contenders.
- Everything else stays 2D where 2D is clearer (most things).

---

## 5. Player Profile redesign (the click-through)
A dedicated, beautiful profile (rebuild the `/player` page as an SPA route) with
its own sections: **Overview** (headline + prediction + true-talent), **Scoring**
(distribution, ceiling/floor, consistency, boom/bust), **Splits** (best/worst
**opponents**, **venues/stadiums**, home/away, by month), **Role** (CBA/TOG trend,
changepoints), **xSC** (over/under-performance), **Career** (arc, clubs, draft,
junior/state pedigree), **Similar players**, **Compare** (head-to-head), and the
**ML prediction with SHAP reasoning**. This is where the "super deep player
analysis" lives — the Hub stays scannable; depth is one click away.

---

## 6. Phased roadmap (this is a multi-phase build — done right, not fast)
- **Phase A — Foundations & data:** per-game fact pipeline (opponent/venue/TOG/
  advanced), opponent-strength & venue-effect tables, extend the batched payloads;
  add the **section IA / sub-nav**; surface **My Squad usage** + **Records**
  clearly (kills "can't find my stats / records"). *Mostly data + IA; low risk.*
- **Phase B — ML core:** feature store, train LightGBM (+ baselines + backtest
  harness), quantile bands, precompute & serve; **Predictions** section + a
  transparent accuracy panel. Add the optional NN/embedding ensemble; report wins.
- **Phase C — League & Trends:** vs-league comparisons (power ranks, positional
  radar, projected ladder, head-to-head), Dynasty window, squad-movement curves,
  archetype clustering.
- **Phase D — Signature visuals & polish:** ECharts/3D Scouting Cloud + league
  landscape, framer-motion, TanStack matrix, Monte-Carlo win-prob, mobile passes.
- **Phase E — Player Profile rebuild:** the deep per-player page (splits,
  predictions, xSC, career, compare).
- **Phase F — Validation & nonsense-hunt:** model calibration, math sanity,
  visual QA desktop+mobile, perf/bundle (lazy-load 3D), explainability checks.

Each phase ships independently and is validated before the next.

---

## 7. Risks & honest constraints
- **3D/bundle/perf:** heavy libs must be lazy-loaded per section; 3D used
  sparingly and tested on mobile (fallback to 2D where needed).
- **ML infra:** training runs on the single server; schedule off-peak, cache
  outputs; the model must beat naïve baselines on backtest or we keep the simpler
  projection. No black boxes — SHAP/feature-importance shown.
- **Data freshness:** predictions only as current as the last CSV/scrape; show
  "as of round N". CSV/CBA refresh already wired.
- **Scope:** this is weeks of work; we go phase-by-phase, you steer between phases.

---

## 8. Decisions I need from you (so I build the right thing)
1. **ML approach:** GBM-primary with an optional NN ensemble (recommended), or do
   you specifically want the neural-net front-and-centre even if it backtests worse?
2. **Viz library:** ECharts(+gl) as the advanced/3D engine (my rec), or Plotly, or
   go all-in on react-three-fiber for custom 3D?
3. **3D appetite:** one or two signature 3D pieces (Scouting Cloud + league
   landscape) with everything else best-in-class 2D — agree, or want more 3D?
4. **Start point:** begin with **Phase A** (sections/IA + find-your-stats +
   records + data pipeline) so the structure & your missing stats land first, then
   ML — agree?

---

## 9. Complete data-touchpoint inventory (every source → what it unlocks)
> The point: we have *far* more than player averages. Each touchpoint opens
> analytical angles — not all need ML; most are smart aggregation, context &
> comparison.

| Source / model | Key fields | Unlocks |
|---|---|---|
| **PlayerStat / per-game CSV** | round, **Venue**, **Opposition**, **TOG**, K/HB/D/M/G/B/T/HO, **CP/UP, ED/DE, MI5, I50, CL(+CCL/SCL), CG, R50, MG, FF/FA, ITC**, **AF + SC** | per-game form, **opponent & venue splits**, role (TOG), efficiency, contested vs uncontested, **xSC**, ML features, distributions, boom/bust |
| **AflPlayer** | rating, potential, rating_start, keeper_value, cba_pct, cba_trend, age, dob, height_cm, sc_avg(+prev), career_games, injury_* | value, role, age curve, FIFA-style rating, keeper index |
| **RatingLog** | rating over time | **rating trajectory** — who's risen/fallen, momentum |
| **AflGame** | home/away, **venue**, scheduled_start, status, scores | AFL schedule, byes, **strength-of-schedule**, live state, rest days |
| **AflTeamSelection** | per-round team sheet, jumper #, position, is_captain, team_type | **selection confidence** (is he named?), late outs, positional listing, debutants |
| **StateLeagueStat** | VFL/SANFL/WAFL + U18 stats + ranks | fringe/rookie **AFL-readiness**, draft pedigree, depth prospects |
| **AflListHistory** | club-by-year, games, level | **career arc**, list tenure, draft pedigree, journeyman context |
| **WeeklyLineup / LineupSlot** | per-round role, captain/VC, emergency, bench | **your-team usage** (games-for-you, captaincy, emergencies, role timeline), points-left-on-bench |
| **RoundScore** | total, captain_bonus, breakdown{pid:score} | your scoring history, **contribution share**, bench leakage, captain ROI |
| **SeasonStanding** | W/L/D, points_for/against, %, ladder_pts | ladder, **vs-league**, projected finish |
| **PowerRanking** | rank, score, previous_rank, movement, per round | **power ranks over time**, momentum vs league |
| **Fixture / matchups** | H2H schedule, scores | **head-to-head**, remaining SOS, finals path |
| **DraftSession / DraftPick** | pick #, year, type | **draft ROI** (steals/busts), acquisition cost vs value |
| **DraftQueue / PlayerWishlist** | queued/wished players | watch-list intelligence, target tracking |
| **Trade / TradeAsset / FutureDraftPick** | trade history, assets, picks | **value flow over time**, trade-impact, draft capital vs rivals |
| **FantasyRoster** | acquired_via, is_active, benched | squad makeup, acquisition mix, tenure |
| **LeaguePositionSlot / CustomScoringRule** | on-field slots, scoring weights | **league-specific value** (score under *your* rules), correct replacement levels |
| **DelistPeriod / DelistAction / LongTermInjury** | roster moves, LTIL | availability, delist tracking, IR management |
| **Reserve7s*** | 7s lineups, fixtures, scores, standings | 7s competition analytics |
| **SeasonConfig** | phase, draft config, captain toggle | correct scoring & phase-aware UI |

---

## 10. Feature catalog (a deep, analytical menu — pick the set)
Organised by lens. Most are smart stats/comparison/context; ✦ = uses a model.

**Team makeup & composition**
- Archetype mix ✦ (accumulator / goal-mid / lockdown-D / ruck-hybrid / pressure-fwd) → squad-DNA donut + gaps
- Scoring-source fingerprint (how the *squad* earns points: disposals vs marks vs tackles vs goals)
- **Star-reliance index** (Gini/HHI of scoring) — are you carried by 2 guys?
- Age × position pyramid; rating distribution; keeper-value distribution
- Depth chart per position with the drop-off to your next man & to replacement
- Bye-exposure timeline (which rounds gut your squad)

**How you stack up (League)**
- Power rank + movement sparkline; positional-strength **radar vs league avg & #1**
- **Projected ladder / finals odds** ✦ (Monte-Carlo over remaining fixtures)
- Head-to-head record matrix; remaining **strength-of-schedule**
- **Percentile-of-everything** — your team's league percentile on every metric, one view
- Per-round "vs the field": did your squad beat the league average each week?
- League scarcity map → where your surplus is most tradeable

**Squad movement (Trends)**
- Squad-strength curve over rounds (ascending/declining) ✦
- Total keeper-value & age drift over time; rating risers/fallers (RatingLog)
- Aggregate form (signal-filtered); rolling power-rank percentile
- **Trade-impact timeline** — each deal's value delta, in hindsight

**Matchups & splits**
- Best/worst **opponents** per player & squad; **venue/stadium** splits; home/away; vs top-8
- This week's **matchup difficulty** per player (opponent SC-conceded by position)
- Team SOS heat for the run home

**Value & decisions (prescriptive)**
- VORP, keeper index, **value-vs-cost** (draft ROI steals/busts)
- **Sell-high / buy-low** ✦ (vs true-talent / xSC); auto **keep-cut board**
- **Trade-target finder** — rivals' surplus matched to your needs ✦
- **Optimal lineup + points-left-on-bench**; optimal captain + captaincy ROI
- Breakout candidates ✦; decline risk ✦

**Risk & reliability**
- Floor/ceiling, consistency, boom/bust frequency; volatility; durability/availability
- Injury & LTIL watch; **selection confidence** (named in the team sheet?)
- Squad-score variance (Monte-Carlo spread) → how safe is this week?

**Records & milestones (the missing section)**
- Team: highest/lowest round, biggest win & loss margin, longest streaks, best/worst season
- Your players: best individual game, most consistent, most banked, most captain pts, tons (100+)
- League-wide: most dominant team, biggest upset, all-time leaders
- "On this round in history", personal bests, season-to-date leaderboards

**Predictive / forward** ✦
- Next-round projected XI + **win probability** (Monte-Carlo); per-player projection ± band with opponent/venue context + **explainability**
- Next-season projection; **dynasty window**; xSC over/under → regression forecast

**Per-player (Profile drill-down)**
- Distribution, splits (opponent/venue/home-away/month), role (CBA+TOG, changepoints),
  xSC, rating trajectory, career arc + pedigree, similar players, head-to-head compare,
  prediction with reasoning

---

## 11. UX / UI & responsivity (make it feel state-of-the-art)
- **IA:** section sub-nav (Overview / My Squad / League / Trends / Records /
  Predictions) — each a guided layout: *hero → modules → detail*, never a data dump.
- **Cross-filtering & brushing:** select on one chart (e.g. a position, an age band,
  a quadrant) → the matrix and other modules filter to it. Everything is linked.
- **Density modes** (comfortable / compact) for casual vs pro users.
- **Motion** via **framer-motion**: layout transitions, FLIP re-sort, view
  crossfades, count-ups, chart enter animations — subtle, fast, reduced-motion aware.
- **Hover-everywhere** rich tooltips; **click → drill** to profile; sticky headers;
  segmented controls; filter chips; optional **command palette** (jump to any
  player/section).
- **Responsive:** desktop multi-column dashboards → tablet stacks → mobile
  card/sheet patterns with bottom-sheet drilldowns (matches the app's mobile-native
  pattern); horizontal-scroll only where it adds value, never as the main UI.
- **Colour-as-data discipline:** one diverging + one sequential scale, semantic,
  **colourblind-safe**; colour means something or isn't used.
- **States:** skeleton loaders, "as of round N" freshness, graceful rookie/empty
  fallbacks (state-league pedigree when no AFL data).
- **Returnable hooks:** "what changed since your last visit", weekly digest,
  alert chips (role riser / sell-high / injury), **shareable stat cards** (export PNG).
- **A11y & perf:** keyboard nav, ARIA, lazy-load heavy/3D libs per section,
  virtualised tables, precomputed+cached server payloads.

---

## 12. Packages & plugins (expanded menu, with intent)
- **2D charts:** recharts (keep, simple) · **visx** (bespoke/performant) · **nivo**
  (beautiful defaults) · **Observable Plot** (fast exploratory) · **D3** (ultimate control)
- **Interactive + 3D:** **Apache ECharts + echarts-gl** (2D *and* GPU 3D, one lib —
  recommended) · **Plotly.js** (scientific 3D) · **react-three-fiber + drei**
  (custom Three.js hero — e.g. orbitable "value cloud") · **deck.gl** (GPU, big data)
- **Pro data grid:** **TanStack Table** (+ virtualization) — sort/multi-sort/filter/group
- **Motion:** **framer-motion** (primary) · auto-animate (cheap wins) · GSAP (advanced)
- **Data layer:** **TanStack Query** (caching, background refetch, freshness)
- **Stats in JS:** simple-statistics, d3-array/d3-scale
- **ML & stats (Python, backend):** scikit-learn · LightGBM/XGBoost · statsmodels ·
  scipy · optional PyTorch (NN/embeddings) · **SHAP** (explainability)
- **Share/export:** html-to-image (shareable cards), maybe `@react-pdf` for reports

> Lazy-load the heavy ones (ECharts-gl, Plotly, three.js) per section so the base
> Hub stays light and fast.

---

## 13. So, how I'd proceed
Phase A first — **the sections/IA + your findable squad stats + Records +
league-comparison foundation + the per-game fact pipeline (opponent/venue/TOG)** —
because that fixes the "I can't find my stats / records / how I compare" problem
immediately and lays the data spine everything else needs. Then layer Trends,
Predictions, signature visuals, and the Player-Profile rebuild. You steer between
phases; each ships validated.

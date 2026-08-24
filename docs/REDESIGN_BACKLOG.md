# Keeper League — Redesign backlog

Targeted modernisation pass on top of the existing app. Direction is "Stadium" —
glass surfaces, electric accents on team-coloured washes, big rounded pills,
soft glows, choreographed motion. **No ground-up rewrites** — each item below is
a scoped redesign of an existing structure (or a small new module that fits the
energy).

Work order: **one item at a time**, all the way to deployed-and-confirmed, before
pitching the next. After each ship:
- Visual review by user
- End-to-end works (no broken endpoints, smoke tests pass)
- No regressions on other pages
- Mobile checked

---

## A — Chrome / global structure

### ☑ 1. The top bar
**Shipped** (commit `a3d8bfa` + `3d0d94e`). Glass-blur sticky header,
gradient brand mark restored to clean transparent logo, glass home pill,
right-side glass cluster, user pill with avatar gradient + dropdown
matching league switcher.
The thin Bootstrap-ish strip becomes a glass-blur sticky header. Pill switcher
(already shipped) on the left, primary nav as a glass pill-tab group in the
centre, notification bell + avatar on the right. `backdrop-filter: blur()`,
1px hairline border, subtle gradient bleed from the active league's accent.

### ☑ 2. League shell sub-tabs → left vertical rail
**Shipped.** After multiple iterations, replaced the horizontal tab
strip entirely with a fixed left rail (Option A from the redesign
pitch). League switcher moved to the top bar via React portal.
Palette pushed to jewel tones on a cool deep navy canvas; rail
surface elevated above canvas; three real layers; active row uses
the league's accent at 18% fill with a 2px soft left edge.
Sub-tabs expand inline under the active section. Hover-to-expand
+ click-to-pin (persists via localStorage). Loading skeleton
reserves the rail's silhouette so no jolt on first paint.
The underlined Bootstrap nav-tabs (My Team / Players / League / Trades / etc.)
become the same glass pill-row pattern as the player profile, plus an animated
indicator that slides between tabs (`framer-motion` `layoutId`). Active tab gets
a soft accent-coloured glow. Mobile keeps the row with horizontal scroll + edge
fade.

### ☑ 3. Notifications drawer
**Shipped.** Slide-in glass panel from the right (bottom sheet on
mobile). Items grouped by day with tone-coloured glass icon circles
matching the jewel-tone palette. Unread items get a tinted bg +
left stripe. Spring animations, body scroll lock, Esc/backdrop/route
all close.
Currently a small dropdown. Becomes a slide-in right-side glass panel — full
height, backdrop-blur, items grouped by day (Today / Yesterday / This week),
each item a rich card with type-coloured icon + timestamp pill. Animated unread
pulse on the bell.

### ☐ 4. Toasts
Stacked glass cards in the bottom-right, each with a thin progress bar that
drains as the toast times out, accent-coloured by type, slide-in from the right
with spring physics.

### ⏸ 5. Mobile bottom tab bar — **deferred**
*Paused this session — mobile-focused work is being skipped for now.
Will revisit alongside any major desktop change that needs mobile
parity. Pitch on file, ready to execute when revisited.*

### ☐ 5 [original]. Mobile bottom tab bar — **new**
A floating glass bottom bar (My Team / Players / Trades / Standings / More) —
backdrop-blur, rounded corners, sits 16px above the bottom edge. Active tab
gets a coloured dot + scale animation. Massive UX win on mobile.

---

## B — Existing pages: targeted facelifts

### ☐ 6. My Team field view
The current grid of player cards on a flat dark surface becomes an **actual
football field**: green gradient pitch, white line markings (centre circle,
50m arcs, goal squares), zones for DEF / MID / RUC / FWD, players as glass
cards stationed in their zones. Lockout state pulses red. Captains get a "C"
sticker. Team colour washes the field subtly.

### ☑ 7. Standings / Ladder page
**Shipped.** Unified ladder (no podium hero — user wanted it to read
like a true ladder). 11 columns: # | Team | Status | PR | W–L |
Form · 5 | Mov. | PF | PA | % | Pts. Sortable headers on every
metric (highest first per `feedback_sort_descending`). # stays
anchored to ladder rank under any sort; finals-cut divider only
shows in canonical ladder order. PR rendered as a chip with
gold/silver/bronze tiers for top 3 + a 3px left-edge accent
strip. Glass rows with team-coloured 2px left stripe, mine
highlighted with accent gradient bg.

### ☑ 8. Gameday / Live scoring
**Shipped after several iterations.** Final state:
- Round bar with TV-style clock (LIVE · N ON / PRE-MATCH / FT)
- AFL broadcast ticker — sorted live → upcoming → done, wraps to
  fit every game on one panel (no horizontal scroll)
- KL fixtures mini bar — grid that fits all matchups on one row
- Neutral hero scoreboard: deep navy panel, top accent band split
  50/50 in each team's accent, leading score coloured in team
  accent with soft glow, loser stays muted, pre-match both stay
  muted (no false leader). Logos restored, 56px crests with team-
  accent borders. State-aware bottom strip — no margin chip
  pre-match.
- Player rows → broadcast tiles with position chips, name + AFL
  fixture line, tabular score with live pulse dot.
- Section headers (Field / Bench / Emergency / DNP / No Game)
  with tone-coloured left stripes + counts.
- Slashed-zero suppressed everywhere via font-feature-settings.

### ☑ 9. Draft Room
**Shipped.** Render-layer-only repaint; sockets/timer/WS untouched.
- Pick banner: 52×52 badge, 2.4rem timer (rust pulse ≤10s),
  sapphire "Your Pick" pill (was amber), forest tint on complete.
- Available players table: Ladder-style sortable headers, shared
  DEF/MID/RUC/FWD position-chip palette, rating/potential/draft-
  score now tier chips (gold/sapphire/amethyst/rust), sapphire
  row hover, glass filter inputs.
- Position-need pills: forest met / ochre short / rust blocked /
  sapphire NM.
- Right column: pick history with sapphire highlight on user's
  picks, your-team grouped by position with tone-coloured section
  headers, chat author palette swapped to jewel tones.
- Values panel: custom slider track with sapphire thumb.
- Pre-draft event card: tri-tone gradient strip + big tabular
  countdown.
- NOT touched: MockDraftPage (separate route, still on legacy).

### ☑ 10. Round Recap modal
**Shipped.** Auto-fires once per completed round (localStorage-gated).
- Stadium repaint: win=forest, loss=rust, draw=ochre. Outcome-tinted
  top stripe + radial glow tuned to result.
- New headline strip "WON BY 14 / LOST BY 23 / DRAW" in bold caps
  with tone-coloured glow. Score line + opponent name underneath.
- MVP promoted to hero card — gold gradient bg, 52×52 star icon,
  big 2.2rem tabular score, captain pill inline.
- Bust / League top / Biggest blowout collapsed into compact rows
  with tone-coloured icon backdrops + score chips (rust /
  sapphire / amethyst).
- Footer buttons restyled (sapphire primary, neutral skip).
- Out of scope (kept on backlog): shareable result image (canvas /
  server render), swipe-down dismiss on mobile.

---

## C — Component-level upgrades (replace globally)

### ☑ 11. Stat tiles
**Shipped.**
- New `<StatTile>` component at `frontend/src/components/ui/StatTile.tsx`.
  Props: label / value / sub / accent (9-tone palette) / rank / sparkline /
  decimals / animate. AnimatedNumber count-up on mount when value is
  numeric. 2px accent top stripe + value tinted to match. Rank chip in
  the corner when supplied. Optional behind-value sparkline svg.
- Legacy CSS refreshed in `static/style.css`:
  - `.stat-card` (used in Jinja templates + un-migrated SPA spots) now
    on Stadium tones: rgba(15,22,36,.7) surface, jewel-tone accent
    stripe at top, tabular-nums + slashed-zero off.
  - `.pp-tile` (player profile) ditto. Accent helpers
    `.pp-tile-accent-rating/pot/sc/form-*` swapped from GitHub
    greens/blues/pinks to forest/sapphire/ochre/forest/rust.
- SPA migrations:
  - `SquadPage`: 3 of 4 tiles → StatTile (Roster Makeup kept as chip
    layout). Inline hex tints removed.
  - `TeamStatsPage`: all 4 tiles → StatTile.
  - `StatsPage`: `.stat-card` here is used as a card WRAPPER around
    tables/charts, not as a tile. Local CSS overrides the new global
    rules so tables stay flush. Rank chips repainted to ochre/silver/
    cognac instead of GitHub gold/grey/bronze.
- Out of scope: per-stat sparkline data wiring (prop exists; nothing
  uses it yet). Rank chips only show when callers provide a number.

### ☑ 12. Buttons
**Shipped — CSS-only override of Bootstrap classes in `static/style.css`.**
- Three variants:
  · **Gradient CTA pill + glow** — sapphire / forest / rust / ochre / teal
    matching .btn-primary/.btn-success/.btn-danger/.btn-warning/.btn-info.
    Each has a 16px tone-tinted drop shadow, 1px translateY lift on
    hover.
  · **Ghost outline** — `.btn-outline-*` (six tones). Transparent with
    accent border + text; hover gets a 12% wash in the same tone.
  · **Subtle link** — `.btn-link` text-only in sapphire with faint
    hover bg.
- Disabled state: 45% opacity, no glow, no transform, cursor not-allowed.
- Focus rings: 3px accent halo per tone.
- Size variants (.btn-sm / .btn-lg) get matched typography + padding.
- No JSX changes — every page using Bootstrap btn classes picks up the
  new look automatically.

### ⏸ 13. Forms — **deferred**
*Skipped this session — not a current priority. Pitch on file: base
repaint with `--lgs-rgb` focus ring, Bootstrap `.form-floating`
styling, validation pills, restyled check/radio inputs. Pure CSS
override, no JSX changes needed. Revisit when forms feel like the
biggest visible-aesthetic gap.*

### ☑ 14. Empty states
**Shipped — CSS-only update to `.empty-state` in `static/style.css`.**
- 96px tonal icon ring (was 64px ghost), gradient fill + 36px outer
  glow + accent border in the active tone.
- Ambient concentric-rings pattern radiating from the icon center
  (4 layered radial-gradients: halo + 3 faint rings). Subtle, no
  artwork required.
- Typography refresh: 1.25rem heading on `--kl-text-heading`,
  0.85rem paragraph with 400px max-width.
- Tonal variants via additional class on `.empty-state`:
  · default → sapphire
  · `.positive` → forest ("you're all caught up")
  · `.attention` → ochre ("set this up")
  Tones drive the icon ring, glow and ring pattern via
  `--es-accent-hex` + `--es-accent-rgb` custom props.
- CTA buttons inherit the new gradient-pill / ghost-outline styles
  from #12 automatically.
- Mobile: 76px icon, tighter padding, scaled-down ring pattern.
- Out of scope: custom-drawn team/league illustrations (separate
  design exercise).

---

## D — New modules

### ✗ 15. AI Coach panel — **dropped**
Not wanted. Scrapped per user direction. Original pitch was a
dashboard sidebar with rule-based recommendation chips (captain
pick / bench risk / trade up / form). Skipping entirely.

### ✗ 16. Streaks & achievements — **dropped**
Not wanted. Scrapped per user direction. Would have required new
schema + compute logic + retroactive backfill + UI surfaces.
Skipping.

### ✗ 17. Live commentary feed — **dropped**
Not wanted. Scrapped per user direction. The realistic v1 would
have been a per-player score-delta feed during live windows (no
true event labels since the data feeds don't expose per-event
detail). Skipping.

### ☑ 18. Power Rankings module — **satisfied by #7**
Backend power-rank algorithm already existed; #7 (Standings)
surfaced it on the ladder as a sortable PR column with
gold/silver/bronze tier chips for the top 3, alongside the Status
headline pill, Movement chip and Form sparkline. A dedicated
/power-rankings page wasn't worth the extra surface area when the
information already lives on Standings.

Not built (out of scope): historical rank snapshots (needs new
schema), Strength-of-Schedule compute, per-team momentum charts.
Can be revisited if richer drill-in becomes valuable.

---

## Definition of done (every item)

1. **Visual** — matches the pitch; user signs off after live preview
2. **End-to-end** — every code path that touches the changed area still works
3. **Smoke** — `python scripts/smoke_endpoints.py` returns all green
4. **No regressions** — quick walk-through of adjacent pages
5. **Mobile** — works at <600px width
6. **Reduced motion** — `prefers-reduced-motion: reduce` respected
7. **Committed + deployed** — live on keeperlg.com

Each item gets a session of: pitch → implement → ship → review → fix → next.

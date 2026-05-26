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

### ☐ 1. The top bar
The thin Bootstrap-ish strip becomes a glass-blur sticky header. Pill switcher
(already shipped) on the left, primary nav as a glass pill-tab group in the
centre, notification bell + avatar on the right. `backdrop-filter: blur()`,
1px hairline border, subtle gradient bleed from the active league's accent.

### ☐ 2. League shell sub-tabs
The underlined Bootstrap nav-tabs (My Team / Players / League / Trades / etc.)
become the same glass pill-row pattern as the player profile, plus an animated
indicator that slides between tabs (`framer-motion` `layoutId`). Active tab gets
a soft accent-coloured glow. Mobile keeps the row with horizontal scroll + edge
fade.

### ☐ 3. Notifications drawer
Currently a small dropdown. Becomes a slide-in right-side glass panel — full
height, backdrop-blur, items grouped by day (Today / Yesterday / This week),
each item a rich card with type-coloured icon + timestamp pill. Animated unread
pulse on the bell.

### ☐ 4. Toasts
Stacked glass cards in the bottom-right, each with a thin progress bar that
drains as the toast times out, accent-coloured by type, slide-in from the right
with spring physics.

### ☐ 5. Mobile bottom tab bar — **new**
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

### ☐ 7. Standings / Ladder page
Top 3 become a podium row (1st centre-tall, 2nd & 3rd flanking, each with
team-colour glow), positions 4+ as horizontal glass rows with mini form-bar
sparklines (last 5 results) + momentum arrow.

### ☐ 8. Gameday / Live scoring
Broadcast aesthetic: animated H2H scoreboard at top, "what's happening now"
rail with bullet-style updates, per-player tiles arranged by position with live
SC numbers in tabular monospace, TV-style round clock.

### ☐ 9. Draft Room
War-room layout: huge countdown timer top-centre with pulse glow, current-pick
spotlight, recent-picks ticker scrolling underneath, available-players grid
with trading-card-style cards (hover tilt, click expand).

### ☐ 10. Round Recap modal
Full overlay match-centre: player-of-the-week hero card, "biggest move"
call-outs (biggest score / margin / surprise / dud), shareable result image,
swipe-down dismiss on mobile.

---

## C — Component-level upgrades (replace globally)

### ☐ 11. Stat tiles
Replace `.pp-tile` and similar with animated tiles that count up on mount,
optional sparkline behind the value, rank chip in the corner. Single tile
component, used everywhere.

### ☐ 12. Buttons
Primary CTAs → gradient pills with soft glow shadows. Secondary stays ghost.
Destructive gets red glow. Three variants total.

### ☐ 13. Forms
Floating-label inputs (label slides up into the border on focus), focus rings
in the active league's accent, validation states as inline pills.

### ☐ 14. Empty states
Abstract illustrations / pattern + primary CTA instead of flat icons + text.

---

## D — New modules

### ☐ 15. AI Coach panel
Dashboard sidebar card: weekly auto-generated recommendations ("Trade up:
rating +6", "Captain: Bontempelli +18% vs avg", "Bench risk: Sharp may be
late OUT") presented as conversation chips.

### ☐ 16. Streaks & achievements
Gamified badges: 3-week win streak, perfect captain pick, biggest margin,
comeback win, undefeated month. Shown on profile + glass overlay when
triggered.

### ☐ 17. Live commentary feed
During AFL game windows, rolling feed at the top of gameday: "WALSH MARK
· +6 SC" — auto-generated from per-event updates, team-coloured bullets.

### ☐ 18. Power Rankings module
Algorithmic ladder. Ladder position + recent form + PF/PA + SoS. Momentum
chart for each team. Updates weekly.

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

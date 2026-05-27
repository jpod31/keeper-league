# Keeper League — UX modernisation exploration

A senior-design-consultant exploration of how to elevate the existing product without
destroying its identity. **30 substantial suggestions**, each scoped to be independently
valuable and implementable.

This is a working document for reviewing each idea: **implement / modify / reject / combine**.

---

## 1. Persistent context strip

### Problem
The current chrome tells you which league you're in, but not which AFL round we're in,
when lineups lock, or how recently your team scored. Users have to mentally context-switch
every time they hit the app.

### Proposed Improvement
A 32-36px context strip pinned directly under the top bar across all league pages:
`ROUND 14 · Locks Fri 7:30PM (4h 12m)` on the left; `MY TEAM 87 — Last round W +14` on the
right. Auto-collapses on scroll-down, returns on scroll-up.

### Why It Improves UX
Eliminates the "what round are we in?" cognitive load that currently affects every screen.
Surfaces urgency (lockout countdown) where it actually matters — across the entire
experience, not buried in Gameday.

### Visual/Interaction Direction
Tabular monospaced numerals for the countdown. Sapphire pulse dot when ≤24h to lockout,
rust when ≤2h. Subtle border-bottom against the canvas, no extra glass — it's information,
not chrome. Smooth slide-out/slide-in on scroll with 220ms ease.

### Complexity
Low

### Impact
High

### Screens/Areas Affected
All league-scoped pages.

### Risks or Tradeoffs
Adds vertical chrome; needs a hide-toggle for power users. Lockout calculation needs the
same source of truth used by the squad page.

### Optional Enhancements
Click the strip to drill into round detail; long-press to pin always-visible;
"lineup not locked" warning when user hasn't confirmed.

### Decision notes (2026-05-27)
**Modify** — Lucas dislikes the current big lockout strip. Direction: kill the
horizontal chrome band entirely. Replace with a **top-bar badge** — a single
anchored pill in the existing top bar, e.g. `[⏱ R14 · 4h 12m]`, that expands on
hover/click for round detail. Pulse/tone shifts as lockout approaches (sapphire ≤24h,
rust ≤2h). No separate chrome strip below the top bar.

---

## 2. Player detail: desktop side panel, not centred modal

### Problem
Clicking a player on the squad page fires a centred modal. The squad disappears behind
backdrop. Comparing two players is impossible without closing/opening repeatedly.

### Proposed Improvement
On desktop (≥1100px), the player detail slides in as a docked right-side panel (440px
wide), pushing the squad list into a narrower column. Multiple panels stack as tabs at
the top of the panel ("Last 3 viewed"). Mobile keeps the modal.

### Why It Improves UX
You can browse your squad and inspect a player simultaneously. Modal-to-panel is the move
that most quickly signals "this product grew up." Comparison becomes a side-effect —
open one player, click another to add a tab.

### Visual/Interaction Direction
Spring slide-in from right, 320ms. Persistent close in the panel header. Tabs at top of
panel for last 3 viewed. Pin icon to keep a player "sticky" across navigation. The squad
list reflows to accommodate, not overlay.

### Complexity
Medium

### Impact
High

### Screens/Areas Affected
SquadPage, Wishlist, Players list, Draft Room available list, Search results.

### Risks or Tradeoffs
Existing PlayerModal is built; refactor cost. Keep modal as the mobile path so we don't
fork data flow.

### Optional Enhancements
"Compare" toggle inside the panel to render two stacked tabs side by side instead of as
tabs.

---

## 3. Cmd-K command palette

### Problem
The app has many features (set captain, swap, find player, jump to settings, schedule
draft), and every one of them is reached by traversing nav + clicks. Power users have no
escape hatch.

### Proposed Improvement
`Cmd/Ctrl-K` opens a centred command palette. Categories: Players (fuzzy by name), Teams
(in the current league), Pages (Squad, Draft, Trades…), Actions ("Set captain to X",
"Propose trade with Walsh", "Show round 12"). Recent items shown when input is empty.

### Why It Improves UX
Keyboard users get a fly-through interface. Discoverability of niche actions goes up
because they're searchable. Casuals never have to use it.

### Visual/Interaction Direction
Centred modal at 620px wide, ghost backdrop, instant fade. Fuzzy match with section
headers. Arrow keys + Enter to confirm. Slash commands inline (`/cap Walsh`, `/round 14`).
Action descriptions render inline with secondary text.

### Complexity
Medium

### Impact
Medium (high for power users, low for casuals)

### Screens/Areas Affected
Global.

### Risks or Tradeoffs
Adds a keyboard-shortcut surface to maintain. Mobile fallback needed (a search icon in
the top bar that opens the same palette).

### Optional Enhancements
Recent + suggested actions; jump-back-where-you-were (`Cmd-Shift-K` reopens last result).

---

## 4. Captain decision wizard at point of action

### Problem
Captain pick is the biggest weekly decision in fantasy. Currently it's "tap player →
captain badge appears." No decision support at the moment of choice. Users tab out to
Stats or Squad page to compare.

### Proposed Improvement
When the user taps the captain badge (or a "Set Captain" action), a small inline sub-panel
slides open in place. It surfaces the top 3-5 captain candidates from the user's lineup
with: this-round projected SC, opponent + DvP rank, last 3-round form trend, season avg,
and last-season same-fixture if data exists. One tap to confirm.

### Why It Improves UX
Decision context AT the point of decision, not in another tab. Reduces "let me go
check…" tab-switching that breaks flow. Acts as gentle coaching without needing actual AI.

### Visual/Interaction Direction
Popover on desktop anchored to the captain badge; bottom-sheet on mobile. Three to five
horizontally-scrolling cards. Each card: player chip + projected score + trend sparkline
+ opponent strength indicator. Selected card glows. Single confirm button.

### Complexity
Medium-High (projection logic, opponent context)

### Impact
High

### Screens/Areas Affected
SquadPage; potentially the same component reused for emergency picks.

### Risks or Tradeoffs
Projections are imperfect — needs framing as "suggestions, not gospel." Add an explicit
"let me pick myself" button to bypass.

### Optional Enhancements
Show vice-captain ranks too; track "captain bonus this season" as a tiny chip;
cap-success rate (percentage of times your captain pick was correct).

---

## 5. Drag-to-swap on the field view

### Problem
Swapping a bench player with a field player today is a multi-step menu flow. The spatial
relationship (this guy is on the field, that one is on the bench) is begging for direct
manipulation.

### Proposed Improvement
On the field view, long-press (mobile) or click-drag (desktop) a player chip to lift it.
Valid swap targets light up. Drop on a target to initiate the swap. Invalid drops snap
back with a small shake.

### Why It Improves UX
Direct manipulation matches the mental model. Fewer clicks. Mistakes are surfaced before
commit (drop zones tell you "this is allowed").

### Visual/Interaction Direction
Press → 1.05× scale + drop shadow on the chip. Valid targets get a sapphire pulse outline;
invalid dim to 40%. Drop = swap with a subtle confirmation toast.

### Complexity
Medium

### Impact
Medium

### Screens/Areas Affected
SquadPage field view (could extend to draft order on the Setup page).

### Risks or Tradeoffs
Touch behaviour needs careful handling (don't conflict with scroll); long-press timing
must be tuned. Power users may prefer the explicit menu.

### Optional Enhancements
Drag to "Captain" zone at top of field for one-step captain set; drag to "Bench" zone
to deactivate.

---

## 6. Roster health strip above the squad

### Problem
You don't get a "is my team healthy?" sense without analysing. Positional balance, age
skew, total SC tier — all latent in the data, not glanceable.

### Proposed Improvement
A single thin row above the squad: four position chips (`DEF · 6 · −0.3 vs lg avg`,
`MID · 8 · +1.1`, …) plus an "Age skew" and "SC tier" chip. Each chip is tone-coloured:
forest if better than league, neutral if equal, ochre if worse. Each chip is clickable to
filter the squad to that lens.

### Why It Improves UX
Encapsulates a coach's at-a-glance check. Doubles as a filter shortcut — fewer clicks to
drill in. Doesn't compete with the squad below because it's chip-shaped, not card-shaped.

### Visual/Interaction Direction
Single 28px row of pill chips. Tabular nums for the deltas. Subtle hover. Active state
when one chip is being used as a filter.

### Complexity
Low (data already exists)

### Impact
Medium

### Screens/Areas Affected
SquadPage.

### Risks or Tradeoffs
Adds one more horizontal strip near the top. Worth piloting before committing to all
pages.

### Optional Enhancements
Mini "league percentile" chart in a hover popover; same chips render on opponent's team
page for matchup comparison.

---

## 7. Smart default sorting per page

### Problem
Every list defaults to whatever the first column is. Squad opens alphabetical, when the
user actually wants SC avg desc. Trades open alphabetical, when "most recent" is the
natural order. The user's first-load experience is wrong.

### Proposed Improvement
Each list has an opinionated default: Squad → SC avg desc. Available players → draft
value desc. Trades → most recent first. Standings → ladder rank asc. Pick history → most
recent first. A tiny "Sorted by: SC avg" label sits beside the table so the user knows
what they're seeing.

### Why It Improves UX
First-load shows the right order. No discovery cost. The "sorted by" label teaches the
sort affordance.

### Visual/Interaction Direction
No new visuals. Per-page constant + the small label.

### Complexity
Low

### Impact
Medium (compounding — every list page lands better)

### Screens/Areas Affected
Squad, Players, Standings, Draft, Trades, Pick history.

### Risks or Tradeoffs
A few users might prefer different defaults; pair this with #23 (saved views) or persist
the user's last-used sort in localStorage.

### Optional Enhancements
Remember last-applied sort per page per user.

---

## 8. Density toggle (comfortable / compact)

### Problem
One density doesn't fit. Power users want 30 rows visible; casuals want bigger touch
targets and breathing room.

### Proposed Improvement
A small density toggle (icon button) in the top-right of every list page. Toggles between
"comfortable" (current) and "compact" (1.4× more rows visible). Persists per user across
sessions.

### Why It Improves UX
Same UI serves both audiences. Lets a draft-night user with 200+ available players see
more without losing legibility.

### Visual/Interaction Direction
Two-icon toggle (rows vs compact). Smooth height transition on rows when toggled (180ms).
Same fonts, just tighter padding.

### Complexity
Low

### Impact
Medium

### Screens/Areas Affected
All list pages.

### Risks or Tradeoffs
Doubles the table styling surface to test. Manageable.

### Optional Enhancements
Three-tier (comfortable / cozy / compact); per-list density preferences.

---

## 9. Live state breath

### Problem
When AFL games are in progress, the app feels static even though data is updating behind
the scenes. Users refresh to confirm the page is alive.

### Proposed Improvement
A subtle 4-second "breath" on live-state elements: round chip, live AFL game pills, live
player scores. Opacity 1 → 0.85 → 1, eased. Reinforces "this is live."

### Why It Improves UX
Establishes a soft, non-distracting pulse. The product literally feels alive during
gameday.

### Visual/Interaction Direction
CSS animation only. 4s cycle. `prefers-reduced-motion: reduce` disables it.

### Complexity
Low

### Impact
Medium (emotional, but compounding across the live experience)

### Screens/Areas Affected
Gameday, Standings (during live windows), Squad (when scores are moving).

### Risks or Tradeoffs
Motion can fatigue; tune amplitude carefully. Must respect reduced-motion preference.

### Optional Enhancements
Toast on first WebSocket connect ("Live updates connected"); breath stops when the round
goes final.

---

## 10. Optimistic UI for lineup changes

### Problem
Setting captain, swapping, toggling emergency — every action sends to the server and
waits. UI feels slow even when the server is fast.

### Proposed Improvement
Apply the change client-side immediately. Show a tiny "Saving…" chip near the affected
element. On confirmation, the chip disappears. On error, revert with an explicit toast
that includes an "undo" if relevant.

### Why It Improves UX
Latency is the #1 perceived-speed killer. Optimistic UI makes the app feel native.

### Visual/Interaction Direction
Captain badge flips to gold instantly. Tiny inline chip ("Saving" → checkmark → fade).
5-second undo window after save via toast action.

### Complexity
Medium (rollback paths)

### Impact
High

### Screens/Areas Affected
SquadPage actions; ripple to Trades and Draft picks.

### Risks or Tradeoffs
Sync bugs hurt more when UI lies optimistically. Needs careful rollback testing.

### Optional Enhancements
Batch rapid-fire changes into a single save; show pending-saves count in the status bar.

---

## 11. Skeleton states everywhere, not spinners

### Problem
The spinner says "something is happening" but tells the user nothing about what's coming.
Skeletons set expectations and feel faster.

### Proposed Improvement
Each major page has a layout-aware skeleton: Squad skeleton renders 8 placeholder player
rows; Standings renders 8 ladder rows; Gameday renders the hero shape + ticker shape.
Subtle shimmer animation.

### Why It Improves UX
Perceived performance jumps. Users don't stare at a blank loading state; the page outlines
itself.

### Visual/Interaction Direction
Placeholder rectangles in Stadium tones (rgba(110,130,180,.08)). 1.6s shimmer cycle, low
contrast.

### Complexity
Medium (one skeleton per page)

### Impact
Medium

### Screens/Areas Affected
All async-loaded pages.

### Risks or Tradeoffs
More component files; needs to stay in sync with real layouts.

### Optional Enhancements
Render stale cached data underneath the skeleton until fresh data arrives
("stale-while-revalidate" pattern).

---

## 12. Smart breadcrumbs with hover context

### Problem
Today's breadcrumbs are flat text. They take real estate without earning it.

### Proposed Improvement
Each breadcrumb segment becomes interactive. Hover (or tap) the league name → small
popover with quick league stats (rank, last round result). Hover team name → quick links
to your other teams in other leagues. Click goes to the page.

### Why It Improves UX
Breadcrumbs become miniature navigation aids. Particularly valuable for users in multiple
leagues.

### Visual/Interaction Direction
Subtle text-decoration on hover. Popover at 240px, 200ms delay. Tap behaviour on mobile.

### Complexity
Low-Medium

### Impact
Low-Medium

### Screens/Areas Affected
Global breadcrumb.

### Risks or Tradeoffs
Hover popovers can annoy if not tuned. Mobile needs tap-based equivalent.

### Optional Enhancements
"You have an active draft" or "1 pending trade" hints appear inline when relevant.

---

## 13. Mini fixture strip on Squad page

### Problem
The user has to navigate to Gameday to see who they're playing this round. The matchup
is missing context on the team page itself.

### Proposed Improvement
A small horizontal strip near the top of the squad page: "Round 14: Your Hawks vs
Ralph's Roos · Friday 7:30PM · Opponent form W-L-W-W-L". Click to jump straight to gameday.

### Why It Improves UX
Squad and matchup are mentally linked. Bridge them in the UI.

### Visual/Interaction Direction
28-32px tall glass strip. Tabular times. Subtle opponent-accent stripe on the right side.

### Complexity
Low

### Impact
Medium

### Screens/Areas Affected
SquadPage.

### Risks or Tradeoffs
Adds chrome; balance against #1 if both ship (combine into one strip with sub-rows).

### Optional Enhancements
Hover reveals full opponent squad preview; tap "Compare lineups" to see side-by-side.

---

## 14. Bye-round planner

### Problem
Keeper-league strategy lives across multiple weeks. Today, planning around AFL bye rounds
is a mental exercise — there's no view that shows you "in round 14 you'll have 5 players
out."

### Proposed Improvement
A bye-planner overlay reachable from the squad page. Grid of upcoming N rounds × your
players, with cells coloured by "players-out" count per round. Hover any cell to see who's
out and what your projected total looks like.

### Why It Improves UX
Real strategic tool. Keeper-format-specific. Solves a problem casual fantasy apps don't
even acknowledge.

### Visual/Interaction Direction
8-12 column grid (next 8-12 rounds). Cell colour heat: forest (≤1 out), neutral (2-3),
ochre (4-5), rust (6+). Sticky position column on left listing your players.

### Complexity
Medium-High (bye data, projection logic)

### Impact
High (for keeper context specifically)

### Screens/Areas Affected
SquadPage or new `/plan` route.

### Risks or Tradeoffs
Requires AFL bye schedule data; needs careful UI to not feel overwhelming.

### Optional Enhancements
Suggest trade targets that resolve bye congestion; export to CSV.

---

## 15. Inline season sparkline per player

### Problem
Each player row shows a season average — a single number. The trend (climbing, peaking,
declining) is the more important signal in a fantasy decision context.

### Proposed Improvement
A 60-80px wide inline sparkline in each player row showing the player's last 10 SC scores.
Colour-tints: forest if upward, rust if downward, neutral otherwise.

### Why It Improves UX
Recent trajectory matters more than season avg. The chart tells a story the number cannot.
Same component reused across squad / wishlist / draft / pick history.

### Visual/Interaction Direction
18-22px tall SVG sparkline. Subtle stroke. Slight glow when trending sharply. Tap to
expand a full multi-stat chart in the player panel.

### Complexity
Medium (data shape + render efficiency)

### Impact
High

### Screens/Areas Affected
SquadPage, Wishlist, Draft, Compare view.

### Risks or Tradeoffs
More DOM per row; must render efficiently to keep big lists fast. Memoise per player ID.

### Optional Enhancements
Second line overlaying opponent strength; toggle between "raw SC" and "vs avg" view.

---

## 16. `<PlayerChip>` — single reusable player primitive

### Problem
The same player appears in 10+ contexts (squad row, draft row, pick history, trade
builder, modal header, search result), and each renders it slightly differently. Updates
fragment.

### Proposed Improvement
Define `<PlayerChip>` with three variants: compact (36px), default (48px), detailed (72px).
One source of truth for: name, position chip, AFL team logo, optional badges (C/VC/EMG),
optional click handler, optional context menu. Adopt everywhere.

### Why It Improves UX
Visual consistency is the floor of premium feel. Future improvements (e.g., a new injury
indicator) ship once and propagate. Bug fixes apply universally.

### Visual/Interaction Direction
Three documented sizes, consistent badge positions, predictable hover/active behaviour.
Hover state reveals a quick-action menu (pin, trade-from, view).

### Complexity
Medium (refactor across many call sites)

### Impact
High (long-term compounding)

### Screens/Areas Affected
Global — anywhere a player is shown.

### Risks or Tradeoffs
Large refactor; needs phased migration with a Storybook reference.

### Optional Enhancements
`onContext` prop for right-click actions; a `<PlayerChipGroup>` for stacked / overlapping
renders (e.g., "5 emergencies").

---

## 17. Standardised `<FilterBar>` component

### Problem
Every list page reinvented its filter row. Different layouts, placements, behaviours.
Users have to relearn each one.

### Proposed Improvement
A single `<FilterBar>` component with slots: search input on the left, dropdown filters
in the middle, density / sort / view toggles on the right. Sticky to top of list when
scrolling. Adopted across Squad, Players, Standings, Draft, Trades.

### Why It Improves UX
Filter is a learned pattern. Consistent shape = users transfer skill across pages without
thinking.

### Visual/Interaction Direction
Single horizontal bar, ~52px. Sticky on scroll past the page header. Active filters render
as removable chips below the bar with a "Clear all" link.

### Complexity
Medium

### Impact
High

### Screens/Areas Affected
All list pages.

### Risks or Tradeoffs
Less per-page flexibility; needs careful slot API.

### Optional Enhancements
Hook in #23 (saved views); active-filter chip count badge on the bar when collapsed.

---

## 18. Workflow-aware empty state CTAs

### Problem
Empty states say what's missing. They don't tell you what to do next.

### Proposed Improvement
Every empty state pairs the new visual treatment from your shipped #14 with a single
primary CTA that progresses the workflow: "Propose your first trade →", "Set up draft
schedule →", "Add to wishlist while you browse →".

### Why It Improves UX
Reframes "empty" as "invitation." Reduces dead-end feelings.

### Visual/Interaction Direction
Already-styled empty-state + #12 gradient CTA. Optional secondary "Learn more" text link.

### Complexity
Low

### Impact
Medium

### Screens/Areas Affected
~14 empty-state surfaces.

### Risks or Tradeoffs
Some empty states are legitimately "wait for an event" — those keep the no-CTA shape.

### Optional Enhancements
Pre-populate suggested actions from observed user behaviour ("you haven't tried setting a
captain yet").

---

## 19. Start a trade from a player row

### Problem
To propose a trade, the user navigates to Trades and starts blank. The intent forms when
looking at *a specific player*; the workflow asks them to remember and re-find them.

### Proposed Improvement
A "Trade with this player" action on every player row (visible on hover desktop; in the
action sheet on mobile). Clicking pre-fills the trade builder with that player on the
appropriate side.

### Why It Improves UX
Workflow continuity. Starts the action from the context where intent was formed.

### Visual/Interaction Direction
Hover-revealed icon button in the row. Clicking opens trade builder modal / page with
player pre-loaded.

### Complexity
Medium

### Impact
Medium-High

### Screens/Areas Affected
SquadPage, Wishlist, opponent team views, draft history.

### Risks or Tradeoffs
Adds an action that competes with view-details click; needs clear hover discoverability.

### Optional Enhancements
Suggest a counterparty player based on positional need; flag obvious mismatches before
submitting.

---

## 20. Pin / star from any player row

### Problem
Wishlist lives on a separate page. To add a player to the wishlist, the user has to
remember to go there. This kills the casual "I'll watch this guy" intent.

### Proposed Improvement
A small star icon on every player row across the app. Tap to pin; filled gold when already
pinned. Wishlist page then shows the aggregate.

### Why It Improves UX
The wishlist becomes a passive collection that builds as you browse. Friction toward zero.

### Visual/Interaction Direction
Subtle star, hover-revealed on desktop, always visible on mobile. 40px tap target.

### Complexity
Low

### Impact
Medium

### Screens/Areas Affected
Anywhere a player row renders.

### Risks or Tradeoffs
Action overload on already-busy rows; needs a clear visual hierarchy.

### Optional Enhancements
Quick-note dialog ("Why am I watching this player?"); tags ("trade target", "draft 2027").

---

## 21. Historical squad snapshots

### Problem
"What was my lineup in round 7?" requires navigating to Fixtures and reconstructing.
Self-coaching is hampered.

### Proposed Improvement
A small round-picker at the top of the squad page. Pick a past round → the squad re-renders
as it was at that moment (lineup, captain, scores). Read-only.

### Why It Improves UX
Enables retrospective analysis. Particularly valuable during finals.

### Visual/Interaction Direction
Round chip in the header — "Round 14 (current)" by default. Click to drop a list of
historical rounds. A subtle "Viewing R7 archive" banner when in historical mode.

### Complexity
Medium-High (requires historical snapshots stored in DB)

### Impact
Medium

### Screens/Areas Affected
SquadPage, Gameday.

### Risks or Tradeoffs
Storage cost; need a backfill if not already stored.

### Optional Enhancements
Side-by-side comparison of two rounds; "what I'd do differently" annotation per round.

---

## 22. Player-vs-player comparison view

### Problem
Most fantasy decisions are comparative ("X vs Y for captain?"). Currently the app supports
one-at-a-time inspection.

### Proposed Improvement
Select two players (shift-click on desktop, multi-select chip on mobile). A Compare view
opens — same data as the player panel but two columns, shared scales, differential
highlights ("X is +3 SC avg ahead", "Y has missed twice this season").

### Why It Improves UX
Native support for the fundamental fantasy-decision shape.

### Visual/Interaction Direction
Two-column compare layout. Shared scales for stat bars. Differential micro-text in each
row ("+3 SC", "-1 game"). Toggle to flip which player is on the left.

### Complexity
Medium-High

### Impact
High

### Screens/Areas Affected
SquadPage, Draft, Wishlist.

### Risks or Tradeoffs
Discoverability — how does a user learn shift-click works? Pair with #27 (compare tray)
for a more obvious entry point.

### Optional Enhancements
Three-player compare; export as image.

---

## 23. Saved views per user

### Problem
Users apply complex filters ("U23 MIDs with SC avg > 90, not on NM"), reload the page,
and the filter is gone. Power-user workflows have no codification.

### Proposed Improvement
After applying filters that differ from default, a "Save view" appears. Named views drop
down from the filter bar for instant recall.

### Why It Improves UX
Codifies repeated workflows. Reduces re-filtering friction.

### Visual/Interaction Direction
Save-view button appears when filters are non-default. Dropdown lists saved views. Trash
icon to delete.

### Complexity
Medium

### Impact
Medium (power users)

### Screens/Areas Affected
All filterable list pages.

### Risks or Tradeoffs
Backend storage vs localStorage. localStorage works for v1.

### Optional Enhancements
Share a view via URL; pin a view as the default for a list page.

---

## 24. Unified notification model

### Problem
Notifications, toasts, modals, and inline alerts each live in their own world. A round
recap fires a modal; a trade proposal fires a notification; a captain-change error fires
a toast. Mental model is fragmented.

### Proposed Improvement
One backend notification model. Toasts become ephemeral promos for new notifications.
Modals are reserved for truly blocking events. The drawer is the canonical history of
everything.

### Why It Improves UX
Single source of truth: "Did I miss anything?" → check the drawer. Always.

### Visual/Interaction Direction
Drawer items styled per type (round recap, trade, system). 24h toast history accessible
from drawer.

### Complexity
Medium-High

### Impact
Medium

### Screens/Areas Affected
Global notifications, toasts, modals.

### Risks or Tradeoffs
Backend refactor risk; needs careful migration of existing channels.

### Optional Enhancements
Per-type mute preferences; "important only" filter.

---

## 25. Confirmation modals show consequence preview

### Problem
Destructive actions (end draft, accept trade, delist player) show text-based
confirmations. The consequence is described, not previewed.

### Proposed Improvement
Each destructive confirmation modal shows a visual "before / after" preview. Accept trade
→ shows the two team rosters with the affected players highlighted. End draft → shows
unfilled pick count + who gets penalised.

### Why It Improves UX
Reduces "oh shit" moments. Confirmations are an opportunity to teach the user about state.

### Visual/Interaction Direction
Two side-by-side panels in the modal: "Now" and "After this action." Affected players
highlighted. Clear primary destructive button.

### Complexity
Medium per action

### Impact
Medium-High

### Screens/Areas Affected
Trade accept/reject/veto, draft end, delist, swap when locked.

### Risks or Tradeoffs
More UI per confirmation; balance against speed for power users with a "Don't show me
this again" option.

### Optional Enhancements
"Undo within 30s" via toast after a destructive action where reversible.

---

## 26. Mobile bottom action bar

### Problem
On mobile, primary squad actions (captain, swap, view) require scrolling, hidden menus,
or modal openings. Thumb reach to top-of-page is awkward.

### Proposed Improvement
A 56-64px bottom action bar that surfaces the most likely next action ("Set captain")
with a chevron for more. Contextual: changes based on what's selected.

### Why It Improves UX
Thumb-zone friendly. The primary action is always one tap away.

### Visual/Interaction Direction
Sticky bottom, slides in only when squad is in viewport. Single CTA + chevron-for-more.
Auto-hides on scroll up.

### Complexity
Medium

### Impact
High (mobile)

### Screens/Areas Affected
Mobile SquadPage; pattern reusable for Draft on mobile.

### Risks or Tradeoffs
iOS gesture conflicts at the bottom edge; needs safe-area handling.

### Optional Enhancements
Bar morphs based on selection — "Set Captain X" when a player is selected, "Lineup Save"
when changes pending.

---

## 27. Persistent compare / watch tray

### Problem
While browsing, a user wants to park 2-3 players "to look at later." Today, navigating
loses that intent.

### Proposed Improvement
A small floating tray at the bottom-right. Players added via "+" or drag accumulate as
avatars. Tray persists across navigation. Click "Compare" to open the comparison view
(#22) or "Trade with these" (#19).

### Why It Improves UX
Captures intent during exploration. Makes the compare and trade flows discoverable.

### Visual/Interaction Direction
Floating glass tray, lower-right, 280px wide. Avatars stack with subtle overlap. Hover
any avatar to remove. Clear-all icon.

### Complexity
Medium

### Impact
Medium-High

### Screens/Areas Affected
Squad, Players, Draft, Wishlist.

### Risks or Tradeoffs
Persistence: localStorage works; server-side would survive devices.

### Optional Enhancements
Drag a player from the tray onto another player to start a trade.

---

## 28. Strict spacing system

### Problem
Section margins across the app are arbitrary — 1rem here, 1.5rem there, 8px elsewhere.
The cumulative effect is "this app grew organically." Spacing is one of the highest-leverage
signals of polish.

### Proposed Improvement
Adopt a strict 4 / 8 / 12 / 16 / 24 / 40 / 64px scale via CSS custom properties
(`--space-1` through `--space-7`). Audit every section margin and align. Document.

### Why It Improves UX
Visual rhythm. Pages feel premium when everything snaps to a grid. The change is invisible
per-instance but enormous in aggregate.

### Visual/Interaction Direction
No visible single change. The cumulative feel is tightness and intention.

### Complexity
Medium (audit + apply)

### Impact
Medium (subtle, compounding)

### Screens/Areas Affected
Global.

### Risks or Tradeoffs
Many small CSS edits; testing surface increases.

### Optional Enhancements
Storybook page documenting tokens; lint rule to flag non-token margins.

---

## 29. Icon system audit

### Problem
Bootstrap Icons used inconsistently — outline vs filled, varying sizes, sometimes paired
with chips, sometimes not. Adds visual noise.

### Proposed Improvement
Document a usage convention: outline for nav/labels, filled for active/emphasis. Three
documented sizes (14 / 18 / 24px) tied to context. Audit existing icon usage and align.

### Why It Improves UX
Icon cohesion is invisible when right and obnoxious when wrong. Today it's quietly wrong.

### Visual/Interaction Direction
No new icons needed. Just systematic usage. Storybook for reference.

### Complexity
Medium (audit + edits)

### Impact
Low-Medium

### Screens/Areas Affected
Global.

### Risks or Tradeoffs
Time-cost vs visible improvement; can be done over time.

### Optional Enhancements
Migrate to Phosphor or Lucide if Bootstrap Icons hit limits (more consistent stroke
weights, better selection).

---

## 30. First-visit guided tour

### Problem
New users land on the squad page and have to discover affordances (captain badge, VC,
emergency, field/squad toggle, wishlist, stats sub-tab) on their own. Some features go
undiscovered for weeks.

### Proposed Improvement
A subtle one-time guided tour — 4-5 anchored tooltips on first visit. "This is your
starting lineup," "Tap a player for details," "Tap this badge to set captain," "Pin
players you're watching," "Stats shows team makeup." Skippable. Tracked per-user so it
doesn't repeat.

### Why It Improves UX
First impression matters. Today, users sometimes miss whole features.

### Visual/Interaction Direction
Subtle pulse arrows + anchored popovers. Bottom-sheet on mobile. "Got it" button to
advance; "Skip tour" always visible. `Cmd-?` reopens.

### Complexity
Medium

### Impact
Medium (high for new users, none for returning users)

### Screens/Areas Affected
SquadPage primarily; extensible to Draft and Trades on their first visits.

### Risks or Tradeoffs
Tours can feel patronising if too long or unskippable.

### Optional Enhancements
Contextual help icon throughout (small `?` triggers an inline mini-tour for that section).

---

## 31. Remove "My Team" subheaders from the Squad page

### Problem
The Squad page renders "My Team" / section subheaders that duplicate context already
implied by where the user is. They eat vertical space and add chrome the player rows
don't need.

### Proposed Improvement
Remove the subheaders from the main Squad page. Any equivalent labelling lives only
in the side panel (where context can be ambiguous and labels earn their space).

### Why It Improves UX
Less chrome, more squad. The page is about the players — get the labels out of the
way of the data.

### Complexity
Low

### Impact
Medium (cumulative — every visit to the page benefits)

### Screens/Areas Affected
SquadPage; side panel keeps subheaders.

### Risks or Tradeoffs
Side panel needs to carry the labelling weight unambiguously. Verify nothing else
on the page relied on those headings for anchor/section structure.

---

## 32. Chatbox: stop echoing sender's message into the incoming feed

### Problem
When the user sends a message in the chatbox, that message appears twice — once as
"sent by you" and again in the incoming-messages feed. The duplicate makes the chat
feel broken.

### Proposed Improvement
Fix the duplication. The sender's own message should render once (in the
sent-by-you position). Inbound feed should not echo the local user's message.

### Why It Improves UX
Removes a glaring polish bug. Chat is the single feature users notice broken-ness in
fastest because they compare against every other chat app they use.

### Complexity
Low (likely a one-spot socket / state fix)

### Impact
High (kills an obvious bug)

### Screens/Areas Affected
Wherever the chat component renders.

### Risks or Tradeoffs
Need to confirm the fix at the right layer — don't filter at render time if the
real issue is that the socket is broadcasting the sender's own message back to
them; fix it at the source.

---

## 33. Timezone audit — every datetime surfaced to the SPA

### Problem
The codebase stores most fixture-related datetimes as **naive Melbourne
wall-clock** (see `scrapers/squiggle.py` — Squiggle returns AEST/AEDT and we
strip the tzinfo before persisting). Backend endpoints that serialise these
values via `.isoformat()`, or worse append `+00:00` to make them look UTC,
hand a wrong-time string to the React client. JS `new Date(...)` interprets
"`+00:00`" as UTC and renders the local time accordingly, so countdowns
appear ~10h late in winter (AEST is UTC+10) and ~11h late in summer (AEDT
is UTC+11).

This bit the **lockout badge + matchup strip shipped 2026-05-27** (commit
`38253b1`): R12 displayed "Locks in 1d 15h" when the actual lockout was
~1d 5h away. Fixed in `blueprints/spa_api.py` by attaching
`ZoneInfo("Australia/Melbourne")` before serialising. But that's a one-spot
fix; the broader pattern almost certainly exists elsewhere.

### Proposed Improvement
1. Sweep all SPA-facing endpoints for `.isoformat()` calls on datetimes that
   originate from `AflGame.scheduled_start`, `Fixture` timestamps,
   `WeeklyLineup.created_at`, `LongTermInjury.opened_at`, etc. Audit which
   are stored naive-Melbourne, naive-UTC, or tz-aware.
2. Adopt a single helper, e.g. `serialise_dt(dt)`, that does the right thing
   based on the source convention. Centralise so future endpoints can't get
   it wrong.
3. Also audit the existing `blueprints/leagues.py` dashboard endpoint's
   `next_lockout_at` — it uses the same broken `+ "+00:00"` pattern as the
   pre-fix spa_api.py code; it likely has the same bug, just hidden behind
   the dashboard's own rendering.

### Why It Improves UX
Times that lie by 10 hours are worse than no times — users plan around
them. A consistent helper means the moment a new endpoint is added, the
right output shape is the obvious one.

### Complexity
Medium — touching every fixture-related serialiser plus the dashboard fix.

### Impact
High (correctness — wrong times are actively misleading).

### Screens/Areas Affected
Anywhere a fixture / game / lockout time is shown to the SPA: dashboard,
lockout badge, matchup strip, gameday, fixtures, finals, draft schedule.

### Risks or Tradeoffs
The fix can't be one-line global because some datetimes ARE stored UTC
(`created_at` / `updated_at` on most models — SQLAlchemy default). Need to
audit per-field rather than blanket-convert.

---

# Top 10 Highest-Leverage Improvements

Ranked by (impact × reuse) ÷ complexity:

1. **#1 Persistent context strip** — global, every page benefits, low complexity.
2. **#16 `<PlayerChip>` primitive** — foundational; every player render improves once.
3. **#17 `<FilterBar>` standardisation** — every list page improves; users learn one pattern.
4. **#28 Strict spacing system** — invisible per-instance, transformative in aggregate.
5. **#4 Captain decision wizard** — biggest weekly decision gets coaching.
6. **#10 Optimistic UI for lineup changes** — perceptual speed step-change.
7. **#15 Inline season sparklines** — trend data in every player row everywhere.
8. **#2 Desktop player panel** — modal-to-panel signals product maturity.
9. **#14 Bye-round planner** — keeper-format-specific killer feature.
10. **#7 Smart-default sorting** — every list lands better on first load.

---

# Top 3 Dramatic Modernisers

The three that *immediately* shift the perception from "good amateur build" to
"premium product":

1. **#2 Desktop player panel** — modal-to-side-panel is the single most recognisable
   "this app grew up" move. Comparison becomes free.
2. **#1 Persistent context strip** — instant sense that the product knows what's going on.
   Round, lockout countdown, last result — all always visible.
3. **#4 Captain decision wizard** — adds the *feeling* of intelligence and coaching
   without needing an LLM. Shifts the product from "tool" to "assistant."

---

# Recommended Iteration Order

**Phase 1 — Foundation** (must come first because everything else leans on it):
- #28 spacing tokens
- #16 `<PlayerChip>` primitive
- #17 `<FilterBar>` component
- #7 smart-default sorting
- #10 optimistic UI

**Phase 2 — Strategic UX wins** (use the foundation):
- #1 persistent context strip
- #2 desktop player panel
- #15 sparklines per player
- #4 captain decision wizard
- #11 skeleton states

**Phase 3 — Power features** (build on the patterns):
- #14 bye planner
- #22 comparison view + #27 compare tray
- #3 Cmd-K palette
- #21 historical snapshots
- #23 saved views

**Phase 4 — Mobile + polish** (last, because mobile reuses everything above):
- #26 mobile bottom action bar
- #5 drag-to-swap
- #30 guided tour
- #20 pin from anywhere
- #19 trade-from-row
- #25 consequence-preview confirmations

Polish items (#8 density toggle, #9 live breath, #12 smart breadcrumbs, #13 mini fixture
strip, #29 icon audit, #18 empty-state CTAs, #6 roster health strip, #24 notification
unification) slot in opportunistically wherever they fit during the phases above.

---

# Review log

For each suggestion below, record the decision: **implement / modify / reject / combine**.
Update this log as we walk through them together.

| #  | Title                                              | Decision  | Notes |
|----|----------------------------------------------------|-----------|-------|
| 1  | Persistent context strip                           | modify    | Kill the existing big lockout strip — replace with a centralised, modern surfacing of round + lockout countdown (not a horizontal chrome band). |
| 2  | Desktop player side panel                          | implement |       |
| 3  | Cmd-K command palette                              | reject    |       |
| 4  | Captain decision wizard                            | reject    |       |
| 5  | Drag-to-swap on field view                         | implement | Needs thorough validation — touch vs scroll conflicts, lockout state, invalid drop feedback, lineup-rule violations. |
| 6  | Roster health strip                                | implement |       |
| 7  | Smart default sorting per page                     | implement |       |
| 8  | Density toggle                                     | implement |       |
| 9  | Live state breath                                  | implement |       |
| 10 | Optimistic UI for lineup changes                   | implement |       |
| 11 | Skeleton states everywhere                         | implement |       |
| 12 | Smart breadcrumbs with hover context               | implement |       |
| 13 | Mini fixture strip on Squad page                   | implement |       |
| 14 | Bye-round planner                                  | implement |       |
| 15 | Inline season sparkline per player                 | reject    |       |
| 16 | `<PlayerChip>` primitive                           | implement |       |
| 17 | Standardised `<FilterBar>` component               | implement |       |
| 18 | Workflow-aware empty state CTAs                    | implement |       |
| 19 | Trade-from-player-row                              | implement |       |
| 20 | Pin / star from any player row                     | implement |       |
| 21 | Historical squad snapshots                         | implement |       |
| 22 | Player-vs-player comparison view                   | reject    |       |
| 23 | Saved views per user                               | reject    |       |
| 24 | Unified notification model                         | implement |       |
| 25 | Confirmation modals with consequence preview       | reject    |       |
| 26 | Mobile bottom action bar                           | implement |       |
| 27 | Persistent compare / watch tray                    | reject    |       |
| 28 | Strict spacing system                              | implement |       |
| 29 | Icon system audit                                  | implement |       |
| 30 | First-visit guided tour                            | reject    |       |
| 31 | Remove "My Team" subheaders from Squad page        | implement | Subheader content lives in the side panel only — declutter the main page. |
| 32 | Chatbox: stop echoing sender's message into incoming feed | implement | Bug — sent message appears both as "you" and as an incoming message. Fix the duplication. |
| 33 | Timezone audit — every datetime surfaced to the client | implement | Sweep all places we serialise a naive datetime to the SPA. Most fixture-related datetimes are naive Melbourne wall-clock; default `.isoformat()` (or appending `+00:00`) lies and the client renders ~10h late in winter / ~11h in summer. Adopt a single helper. |
| 34 | Empty-state icon vs concentric rings centring | implement | The icon and the ambient ring pattern don't share a vertical centre — rings sit at 5.5rem from container top, icon centre at 7.5rem (32px off on desktop, ~22px on mobile). Fix the ring centres, NOT the icon position (moving icon up makes it crowd the card top). Visible most clearly on the trade empty state. |
| 35 | Draft Room access + upcoming-only scoping        | implement | Users should be able to enter the Draft Room when no draft is live, purely to prepare (browse pool, set queue, plan tiers). Today the room appears tied to a live/scheduled session. Also: when multiple drafts exist (past + future), show ONLY the upcoming/scheduled draft, not historical ones — those belong on a recap surface (DraftRecapPage already exists). |
| 36 | Player acquisition history phrasing              | implement | In PlayerPool's "Acquired" dropdown, multi-tenure players currently read like a soap opera ("jpod31 traded away" then "Charlies Demons traded in") because each entry is framed from THAT team's perspective on the exit/entry event. Rephrase to describe how each team **got** the player (the origin event for that tenure): "Pick #10 drafted by jpod31", "Charlies Demons acquired by trade · 12 Mar", "SSP signing by X". Fix in `entryStyle()` in PlayerPoolPage.tsx — both the active and inactive branches currently key off the LEAVING event for past tenures. |

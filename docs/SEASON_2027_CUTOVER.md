# 2027 season cutover

Brief from Lucas, 2026-11-23. This file is the working list: what was asked,
what was built, and what is still his to do.

Status key: `[x]` live on keeperlg.com, `[ ]` not done.

## Lucas's league: dates

- [x] Draft set for **7:00pm Wednesday 2 December 2026** (Melbourne time).
      Draft session 6 is scheduled; the draft room and the home page count
      down to it. 6 rounds, reverse ladder, same order every round, Lamb of
      North Cult first. Pick timer is the league's 150 seconds.
- [x] Delistings reopened until the draft. The 2026 off-season delist period
      (id 2) is open again and closes at the draft's start. Each manager got
      one notification with their own number to cut.
- [x] How the reopened window sits with the cutover (the answer):
      **the site is on 2027, the league stays in its 2026 off-season until the
      draft is done.** The reopened delist period, the 41 finish size, the
      locked player pool and the "2026 R1 to R4" picks all hang off the 2026
      off-season, so moving the league's own year first would have broken all
      four. After the draft, the commissioner presses **Start 2027 season** on
      the hub. That builds the 2027 fixture and saves the 2027 opening squads.
- Trades were reopened the same evening, until the draft starts (see Round 2).

## 1. Move to the 2027 season

- [x] Site on 2027: `config.CURRENT_YEAR = 2027`.
- [x] Players updated from the workbook refreshed on 23 Nov: 702 matched
      (ratings, ages, 40 club changes), 84 new players, 112 off AFL lists.
- [x] New draftees are in the pool and the draft room ("New to the AFL"
      filter in both).
- [x] New players have an expected position (from the workbook's role),
      shown as "exp" with a dashed edge until SuperCoach publishes one.
- [x] Whole-site sweep for things that assumed the old season. Found and
      fixed: averages blanking when the year moves, last-3 computed from an
      empty season, an "R29 LIVE" pill and "Next lockout NOW" showing all
      off-season, BYE badges that would have appeared on every club not in
      Opening Round, the player pop-up reading an empty season after rollover.

## 2. Former players

- [x] Players > Former. Everyone off AFL lists, not only drafted ones.
- [x] Career games, career average, best year, final year, final rating,
      last club, and every stint in this league with pick and club
      ("+N prior" when listed more than once).
- [x] Filters: search, position, listed here / never listed, last season,
      AFL club, which keeper club had him. Every column sorts.

## 3. Averages are from 2026

- [x] Averages stay on 2026 until 2027 has a game, then move by themselves.
- [x] Labelled with the year on the pool (SC '26, L3 '26, plus a note under
      the heading), squad cards and header, player pop-up, full player page,
      trade block and draft room.

## 4. Previous years

- [x] League > Seasons: one page per year with ladder, results, opening
      squads, drafts, trades and delistings.
- [x] Opening squads: 2026 rebuilt from the initial draft (43 per club, as
      they were then). 2027 is saved when the season is started.

## 5. Trade block

- [x] My Team > Trade block: a board of cards by club, with what each club
      wants back and a note. Other clubs are notified when a player goes up.
      "Make an offer" opens the trade builder on that player.

## 6. Player notes

- [x] My notes on the player pop-up and the full player page: private,
      timestamped, as many as you like, each deletable.

## 7. New colour scheme

- [x] First cut was black and gold. Lucas rejected it (see Round 2). The
      site is now black and white, with colour kept for positions, rating
      bands, form, AFL clubs and fantasy teams. Logo and app icons are white
      (originals kept as `*-2026.*` in `static/icons`).

## 8. General beautification

- [x] Proposals published as an artifact (eleven items to pick from).
      Nothing in it is built until picked.

## Round 2, same evening: Lucas's verdict on the first cut

His words: he hated the gold, and hated that it took over the colour of
things that should have their own colour. The beautification was weak, the
proposals were changes and not improvements, trades should be open to the
draft as well, and the draft should use ratings, potentials, club logos and
coach crests instead of bare names. "More impressive, more immersive, way
cooler."

- [x] Trades reopened until the draft starts (7:00pm Wed 2 Dec). Managers
      told. Starting the draft now closes the trade window as well.
- [x] Gold removed. Second cut (`tools/retheme2.py`): chrome is black and
      white, and every other colour went back to what it was, so positions,
      rating bands, form and team colours are distinct again. Logo is white.
- [x] Your club's colour: each team has a colour (from its crest where it has
      one: jpod31 crimson, Reservoir Wogs blue; a default until the other four
      coaches set one). The signed-in coach's colour lights the page, the rail
      and the home hub.
- [x] Players wear their AFL club's colours on squad cards, trade block cards
      and the draft's pick card.
- [x] Rating bands: one colour per band, potential as an outline, everywhere
      a rating shows.
- [x] Crests in place of team names: pool, seasons, trade block, draft room,
      home hub.
- [x] Draft room: the club on the clock with crest and colour, an up-next
      strip, club logos, rating and potential on the board and on every pick,
      and a card that announces each pick.
- [x] Home: a live countdown to draft night and every club's list, picks and
      what it still owes, in draft order.
- [x] Proposals rewritten as eight ideas that improve the game (same link).

## Rounds 3 and 4: the design system and the type rules

Round 3, his words: "even better, more advanced, more modern, clean, sleek,
no sign of Claude". Round 4: the squad header was "pure claude again, the
tiny text", the home layout "too much going on, not intuitive", "RUC exp"
"doesn't even fit in the box", and club-coloured cards were fine as an idea
but hid the position.

- [x] Design system v4: Geist and Geist Mono, hairlines, 5 to 8px corners,
      white primary button, no glows, no pills, no gradients on controls.
- [x] Type rules, enforced by `tools/type_floor.py`: nothing under 13px and
      one text colour. `_mobtest/kl_audit.mjs` counts what is left per page.
- [x] Squad header rebuilt: name, three plain facts, three buttons, four
      numbers. No captions.
- [x] Home in the off-season is one thing: the draft date, the countdown, one
      sentence on your list, and the draft order.
- [x] Cards keep the AFL club's colours. Position is a solid badge and the
      card's left edge.
- [x] An expected position is the same badge, hollow with a dashed edge. The
      word "exp" is gone.
- [x] No em dashes in visible text. Pills squared. Crests on the ladder.

## Round 5: "keep going"

Went through every page by eye instead of by count.

- [x] Trades page rebuilt: a title, three plain tabs, one row per deal.
- [x] One set of position colours. The trade builder, season review and
      scouting had a second set (green mids, pink forwards).
- [x] Dot-separated lines are commas or plain counts.
- [x] Player page header, pop-up stat grids and chart labels.
- [x] Gameday in the off-season says there are no games.
- [x] League records, notifications, mock draft and commissioner page fixes.
- [x] The page backdrop is flat black with the grid.
- [x] Draft room: Pick had scrolled off the edge of the players table after
      the type went up. The table now fits and the action column is pinned.
      The audit reports any box that scrolls sideways so this is caught.

## Round 6: "stop stopping"

Every page, desktop and phone, plus menus, sheets and pop-ups, viewed on a
fresh copy of production.

- [x] Gameday and the ladder use each team's saved colour; gameday position
      badges are solid.
- [x] Nothing is faded with opacity (bench and did-not-play rows, losing AFL
      side, past ownership lines).
- [x] The player page reached from the pool, trade block and former players
      (a separate server-rendered page) brought into line; its tiles now show
      the season average.
- [x] What's New pop-up and install banner restyled; changelog wording cleaned.
- [x] Phone sheets, player pool filter panel, optimise menu, notifications
      drawer fixed.
- [x] Squad page strips rebuilt as a sentence and a button.
- [x] Team stats deck, trade detail, 7s ladder, analytics cleaned up.
- [x] Season review re-skinned to black, white and the viewer's team colour.
- [x] Em dashes out of messages the server sends and of email templates.
- [x] The audit also checks faded text, sideways scrolling and contrast.

## Fixed along the way (would have bitten on draft night)

- A club redrafting a player it had delisted crashed the pick. The roster
  table allowed one row per club and player ever. It now holds one row per
  stint, which is also what makes "picked up more than once" show properly.
- A finished off-season draft left the league "active", and Start new season
  refuses a league that is not in its off-season.
- A draft scheduled days ahead kept the board it was created with. It now
  rebuilds from the lists and pick ownership when it starts, and starting it
  closes delistings.
- The old player sync never changed a player's club and would have created
  second copies of Zach Merrett and Mitch Knevitt.

## Still Lucas's to do

1. Before 2 Dec: Nadia's Cartel has 6 to cut, PeUcKeR2oo9 has 1. Clay Hall
   (Nadia's Cartel) is off AFL lists and still on that list.
2. 2 Dec, 7pm: press Start Draft in the draft room.
3. After the draft: Commissioner Hub > Start 2027 season.

## How to repeat this next November

1. Roll the workbook to the new year, bump `config.CURRENT_YEAR`, deploy.
2. `python scripts/cutover_season.py --xlsx <workbook> --dry-run`, read the
   "new" and "off AFL lists" lists, then run it without `--dry-run`.
3. `python scripts/set_offseason_draft.py --league-id N --draft YYYY-MM-DDTHH:MM --create-session`.

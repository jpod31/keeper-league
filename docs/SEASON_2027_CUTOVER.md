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
- Trades were NOT reopened (only delistings were asked for). One click on the
  hub if wanted.

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

- [x] Black and gold, no green or blue. Logo and app icons recoloured
      (originals kept as `*-2026.*` in `static/icons`).

## 8. General beautification

- [x] Proposals published as an artifact (eleven items to pick from).
      Nothing in it is built until picked.

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

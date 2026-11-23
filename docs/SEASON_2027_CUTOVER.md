# 2027 season cutover

Brief from Lucas, 2026-11-23. This file is the working list. Each item gets
ticked here as it lands, with a note on what was built and where.

Status key: `[ ]` not started, `[~]` in progress, `[x]` live on keeperlg.com.

## Lucas's league: dates (do first)

- [ ] Draft set for **7:00pm Wednesday 2 December 2026** (Melbourne time).
- [ ] Delistings reopened until the draft.
- [ ] Work out how the reopened delist window sits with the cutover into the
      new season (the 2026 off-season period closed 18 Nov; the league is about
      to move to 2027). Write down the answer here before changing prod.

## 1. Move to the 2027 season

- [ ] Move the site across to 2027.
- [ ] Player updates: Lucas refreshed all players on 2026-11-23, so bring
      everything up to date from that (ratings, ages, clubs, new draftees).
- [ ] Latest players ready for the draft (new AFL draftees in the pool).
- [ ] New players have no SuperCoach position yet: give each an expected
      position, and show that it is expected, not official. (Added 23 Nov.)
- [ ] Search the whole site for anything that assumes the old season and fix it.

## 2. Former players

- [ ] A former players section, so players who are now off AFL lists are not
      gone forever.
- [ ] Covers ALL former players, not only ones a coach drafted.
- [ ] Each shows draft pick, who drafted them, and the rest of what the players
      list shows, including the case where a player was picked up more than once.
- [ ] Filterable, so you can see who has gone over the years.

## 3. Averages are from 2026

- [ ] Player cards and everywhere else: the average shown is the 2026 average.
- [ ] Last 3 and last 5 stay, but are marked as being from last year.

## 4. Previous years

- [ ] A previous-years search/selector everywhere it makes sense.
- [ ] See what each squad looked like at the start of each year.

## 5. Trade block (new)

- [ ] A section for putting players up for trade.
- [ ] A board showing who is up for trade, properly designed.

## 6. Player notes (new)

- [ ] Personal notes on a player, opened from the player click-through.
- [ ] Multiple notes per player, each timestamped, each deletable.

## 7. New colour scheme

- [ ] Entirely new scheme for the whole site. Not green, not blue. It should
      read as a new year and a new season.

## 8. General beautification

- [ ] Proposals go in an artifact for Lucas to pick from. These are a menu:
      nothing here is built until he approves it.

## Ground rules for this work

- Take the lessons from AFL Manager: no small grey text, 13px floor, one text
  colour, no glows or gradient washes, flat real-product look, no em dashes,
  no emojis, sort descending by default, mobile is sheets not tabs.
- Real data questions are answered from production, not a local copy.
- Batch the edits, then build the SPA, commit, push, deploy and check the live
  pages.

## Log

(filled in as work lands)

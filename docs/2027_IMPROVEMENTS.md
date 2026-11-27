# 2027 improvements (Lucas, 2026-11-27: "yeah go for it ... get to all of this")

## Before the draft (2 Dec)
- [x] 1. Draft room "10+" column: outlook colour and chance of 10+ games for every player yet to play; sorts; hover gives the verdict and his best rank (`scouting_summary`, `/api/leagues/<id>/draft-scouting`).
- [ ] 2. Headshots for the new draftees. BLOCKED: 86 draftees plus Jack Hutchinson, Maurice Rioli, Hussien El Achkar and Kobe McDonald have no photo in any licensed set; waits on the AFL Manager set.
- [x] 3. Full draftee history: `draft_history` (draftguru year pages, delisted players included), refreshed each 1 November; the year-one fit is weighted by pick band and outcome so the lower bands are no longer flattered.

## Before round 1
- [x] 4. Finals weeks: fixed at the source (live sync writes no round score for a round without a league fixture), prod rows deleted, check returns 0.
- [ ] 5. Open decisions for Lucas (do not decide for him): Arki Butler's position, draftee discount, proposals K1-K8, rounds 17-24 fixture times.

## During the season
- [-] 6. Keeper Medal count night: DROPPED (Lucas, 2026-11-27: "the live count for the brownlow only thing we should leave out").
- [x] 7. Post-round honours and records news, grouped per badge (`models/round_news.py`, run at round finalisation; Activity plus a notification to every coach, type `honours`, push if the coach turns it on in Profile). The 2026 honours are recorded as already announced.
- [x] 8. Home: one sentence under your game line, your player closest to his next club games milestone and your Hall of Fame leader.
- [x] 9. Season review: Honours slide (medals, Club Champions, badge counts, league records set that year).

## Polish
- [x] 10. 1122x626: Honour Board, Record Book, Home, squad, the card and the notes panel audit clean; the draft table fits after the new column.

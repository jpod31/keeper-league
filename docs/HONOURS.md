# Player honours: working list

Lucas, 2026-11-26. The player card's form chart was too stretched; fill the
space with honours ("trophies"), in keeper league terms only. Design agreed on
the honours cabinet page (artifact 9N66ySZepTbYvqUtzKepUY, version 2).

His answers:
- Premiership = the club that tops the ladder (no finals in this league).
- 2026 was the first season. Nothing earlier to load.
- 25-game step is fine.

A game counts when he is in the 23 that counted (round_score breakdown,
emergencies who came in included) and scored more than zero, in a league
round that is completed.

## Build
- [x] `models/player_honours.py`: every honour for every player, cached per league
  - [x] Premiership player: at least one counted game for the ladder topper
  - [x] Club champion: most wins added at his club
  - [x] League Medal: 3-2-1 per match on points over replacement
  - [x] All-League: best 23 by wins added in real positions, 12+ games
  - [x] Leading scorer: most points in the 23
  - [x] Rising Star: most wins added, 21 or under
  - [x] Match winner: at most one a match, flips the result, at most two team-mates could too
  - [x] The Rock: above replacement every game, 15+ games
  - [x] Breakout: biggest jump on last season's average, 12+ games
  - [x] Draft bargain: biggest pick minus value rank, top 30 by value
  - [x] Club captain: most rounds with the C at his club
  - [x] Club games 25/50/100/150/200, league games 50/100/150/200
  - [x] Season honours only once every fixture that year is completed
- [x] Multiples ladder: big honours gold, platinum, ruby, sapphire, black; feats bronze, silver, gold (3-4), platinum (5-9), black (10+); milestones by number
- [x] Card endpoint and dossier return honours
- [x] `Emblem` component (SVG, the cabinet's emblems)
- [x] Player card: trophy shelf between the numbers and the form chart; next milestone shown when he has none
- [x] Player page: Honours block on the Keeper League tab
- [x] Tests, local check at 1366 and 390, deploy, prod check

## Added mid-build (Lucas, same day)
- [x] New players: "Before the AFL" on the card, a profile from our data plus state league and Talent League seasons, until his first AFL game

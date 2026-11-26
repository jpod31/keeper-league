# Player page and detailed pool columns (2026-11-26)

Lucas: "click a player card, more details, then its this whole page insane
thing" ... "multi tabbed ... career stats, details, player ratings,
potentials and teams played for ... their keeper league career, how many
games theyve been in a coaches best 22, stats in best 22, stats outside ...
so modern, so beautiful and so next gen" ... "player images, silhouette for
players without images (afl manager player pictures are available)".
And: "on the player pool, there should be a toggle for columns to turn into
details stats (scrollable left and right), sortable. everything."

## Data

- [x] Headshots: AFL Manager's 803 cutouts (240px webp, slug = accents
      stripped, lower case, anything else a dash) copied into
      `player_photos/` (not under /static, so nginx never serves them
      openly). Served by a login-only route. Payloads carry `photo_url` or
      null; null draws a silhouette.
- [x] Workbook history: rating 2016 to 2027 and potential 2017 to 2027 per
      season into a new `player_season_rating` table; draft pick, draft
      year, draft type, father-son, academy, international, grade, ranking
      and the AFL best-22 column onto `afl_player`. Written by the player
      sync, so every refresh keeps them current.
- [x] Run the sync on prod with the current workbook (back up first).

## Player page (SPA, `/leagues/:id/player/:playerId`)

- [x] One endpoint returns everything: bio, photo, ratings by season,
      career stats by season (PlayerStat 2013 on), round by round for a
      chosen season, AFL clubs by season (AflListHistory), draft details,
      state league, role (CBA, kick-ins), keeper league career.
- [x] Keeper league career: every stint (how he arrived, pick, how he
      left), rounds on the list, rounds named on the field (best 22 + flex),
      captain rounds, points banked for the club, SuperCoach average when
      named on the field vs when on the list but not named, by season.
- [x] Tabs: Overview, Stats, Ratings, Career, Keeper League.
- [x] Hero: headshot cutout on the club colours, big name, position dots,
      the key numbers. Silhouette when no photo.
- [x] Player card pop-up: "More details" opens the page. Back returns to the
      card.
- [x] Works at 1280 and 390 wide; audit shows no small or grey text.

## Pool

- [x] "Detailed stats" toggle: the table becomes a wide, sideways-scrolling
      table with the name column pinned. Season averages for every stat
      (stats year), games, SuperCoach, rating, potential, CBA%, kick-in %,
      play-on %, age, height, career games, draft pick. Every column sorts.
- [x] Loaded only when the toggle is on; the toggle is kept on back.

## Done when

- [x] Tests for the keeper career splits and the photo slug.
- [x] Screens checked at 1280 and 390, audit clean, deployed, prod sync run.

## Follow-ups from Lucas, same day (none to be dropped)

- [x] "can we add their picture on the right pane player cards too": the
      slide-in player card shows his photo (silhouette if none).
- [x] "there have not been 30 rounds this year": count only rounds the league
      played (a league fixture, live or finished). The site also saved
      lineups and scores for rounds 25 to 29 (AFL finals weeks); they never
      counted and come out of the totals and points banked.
- [x] "some of those are byes, which i dont know why youre counting them":
      a round his AFL club had the bye is not counted at all (not on the
      list, not named, not not-named); its tile says BYE.
- [x] "Round SC DIS K HB M G T HO CP CLR I50 MG ... this isnt comprehensive
      enough": the round-by-round and season tables show every stat we hold
      by default, plus where a coach in this league had him that round; the
      named / not named comparison covers every stat.
- [x] "the wangeneen milera falls on multiple lines, we have to structure that
      space so it doesnt.. this is the right pane stuff": the surname stays
      on one line in the slide-in card (and the player page header), the
      type stepping down for long names.
- [x] "dont like any of em" (squad header layouts 1 to 3): a second, bolder
      set of directions on the canvas.
- [x] "player photo on the left side please.. rearrange that right side panel
      header": photo on the left standing on the numbers bar; positions,
      name, club, age and games to its right.
- [x] "no need for all this crap, dont want the right side pane scrollable
      ... i hate all those shitty boxes": the card is one screen. Last-game
      tiles and the boxed averages are gone; his form chart fills the room,
      six season averages as plain type (picked for his position), notes
      open in place of the form, More details at the bottom.

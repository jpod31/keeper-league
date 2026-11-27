# Honours v2: working list

Lucas, 2026-11-26, after seeing the live honours and the 7s proposal:

> again we need cooler looking emblems.. hate the 7 in a circle, want a purple
> 7 no circle, stylised. also i hate the flag around the trophy. just want a
> trophy. and we need more distinct trophy types and medals depending on whats
> been won. and we need cooler reasons for winning stuff HONESTLY.... and
> things thatll last their careers.. like things people want to achieve ...
> I like the idea of a brownlow, 7s medal, all that shit... but get more
> creative ... we need a central area as well beyond just the icons to show
> these things, maybe another toggle in player pool... and some icons that
> carry with them in the player pool in general

Show the design first (artifact), build after he says go.

## Design (artifact 6Bp96JykZHQTjzFspYyx8M, v1 published, waiting on Lucas)
- [x] Emblems redrawn as real trophies: each honour its own object (cup, medal, statuette or plaque, ball, blazer, star, siren, obelisk, torch, gem, armband, framed jumper, cap, key, laurel, ingots, temple)
- [x] Premiership = just the cup, no pennant
- [x] 7s = the same trophy with a stylised purple 7, no circle
- [x] Distinct medals: league medal, 7s medal, club champion are three different objects
- [x] More creative honours with real reasons (named awards, not just totals)
- [x] Career honours worth chasing: games, wins, points, life membership, Hall of Fame, Legend, dynasty, double, triple crown
- [x] Hall of Fame points: every honour is worth points; the Hall of Fame line and Legend line
- [x] Central area: an Honour Board page (season boards, Hall of Fame race, records, milestones coming up, club boards)
- [x] Player pool: an Honours toggle (sortable honours columns)
- [x] Player pool: small emblem icons beside names everywhere
- [x] Real 2026 winners for every honour that has one

## Build (after his go)
- [ ] Honours engine v2 (models/player_honours.py) incl. 7s and career honours
- [ ] Emblem component v2
- [ ] Honour Board page + API
- [ ] Pool toggle + inline icons
- [ ] Card shelf + player page with v2
- [ ] Tests, local check 1366/390, deploy, prod check

## Added mid-design (Lucas, same day)
> this needs to be cooler.. more detailed, with some comparisons ... place him a
> little better ... determine his likelihood to play early in his career, is he
> ready made? are there spots in the 23 open for him?
- [x] Before the AFL v2 design: Talent League percentile, draft class rank, three comparable past juniors with outcomes, readiness verdict (rating vs the 2026 first-year cohort, workbook best 22, spots opening)
- [ ] Build it with the rest of v2

## Same day, later
- [x] Club Champion = coaches' votes (5-4-3-2-1 each round on points over replacement), not wins added ("i dont really like this as a metric")
- [x] Premiership stars over club crests, or over the initials; drawn by TeamCrest so an uploaded crest gets them. LIVE.
- [x] "Called Up" counts were inflated by AFL finals weeks 25-29; recomputed on league rounds only
- [x] v3 proposal: "we dont need highly overlapping trophies ... you want them to be quite coveted". Twelve honours: Flag (12+ games), Keeper Medal, Club Champion, Rising Star (medal votes, 21 and under), The Siren, club games 50/100 (Life Member key)/150/200, Triple Crown, Hall of Fame, Legend, 7s Flag (8+ 7s games), 7s Medal, Called Up. Everything else cut.
- [x] Built 2026-11-27 ("where is the badges summary area that I asked for"), with the All-League 23 back in ("wheres the all league 23?") as an honour worth 6 points
- [x] Engine v3, emblems v2, Honour Board (Season, All-League 23, Hall of Fame, Clubs, Records), pool Honours switch and name icons
- [x] Called Up = started the season in the 7s (no 23 game before his first 7s game), then 8+ in the 23: 11 in 2026

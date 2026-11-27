# Player card redesign + notes dock (2026-11-27)

Mock agreed: https://claude.ai/artifact/T2rjMtvmtFEGoWVTRG1NTv (v3).

## A. Player card (components/squad/PlayerModal.tsx)

- [x] The whole card scrolls as one. No inner scrolling box, no fixed footer.
- [x] Header top line: position badge and NEW on the left, then the buttons on the right (notes, Full profile, close). Nothing overlaps.
- [x] On scroll the header shrinks to a slim sticky bar: badge, name, the three buttons.
- [x] Numbers strip. New player: Pick, Rating, Potential, chance of 10+ games. Established: season avg, last 3, rating, potential.
- [x] Drop the "Expected position, no SuperCoach position yet" line (the dashed badge says it).
- [x] New player order: verdict, scouting report, ranks table, every season table.
- [x] Established order: honours, form chart (fixed height), season stats table.
- [x] Season stats table: stats down the side, a column per season, grouped, best season bold, current season shaded. Juniors: every season we hold. AFL: last three seasons.
- [x] No small faint text anywhere on the card.
- [x] Phone: same card as a sheet; rank bars hidden.
- [x] Screenshots at 1366x1000, 1366x768, 390 wide, new and established player.

## B. Notes dock on My Team (pages/team/SquadPage.tsx)

- [x] Round button bottom right of My Team; opens a panel, minimises back to the button.
- [x] General notes: write, list (newest first, dated), delete. One set per manager per league.
- [x] Player notes: every player you have notes on, your squad first, each row expands to his notes.
- [x] "Add player note": pick from your squad, then write.
- [x] "Other player": search every player in the competition, then write.
- [x] Backend: general_note table, GET/POST/DELETE endpoints; player search endpoint.
- [x] Tests for the new endpoints.

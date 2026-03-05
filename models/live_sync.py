"""Live sync orchestrator: ties Squiggle schedule + Footywire stats + DB together.

Called by the scheduler to keep AFL game data and fantasy scores up to date
during live AFL rounds.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from models.database import (
    db, AflGame, AflPlayer, PlayerStat, Fixture, FantasyTeam,
    FantasyRoster, LiveScoringConfig, RoundScore, League,
    CustomScoringRule,
)
from models.scoring_engine import score_team_round, _compute_uf_fixture
from scrapers.squiggle import (
    get_games as squiggle_get_games,
    normalise_team_name,
    parse_game_status,
    parse_scheduled_start,
)
from scrapers.footywire_live import scrape_live_round

logger = logging.getLogger(__name__)

_R0_ID_OFFSET = 10_000_000  # Offset added to AflGame IDs for round 0 copies


# ── Schedule sync ────────────────────────────────────────────────────


def sync_game_schedule(year: int, afl_round: int) -> int:
    """Fetch game schedule from Squiggle and upsert AflGame rows.

    Returns number of games upserted.
    """
    games = squiggle_get_games(year, afl_round)
    if not games:
        logger.info("No games returned from Squiggle for %d R%d", year, afl_round)
        return 0

    count = 0
    for g in games:
        home = normalise_team_name(g.get("hteam", ""))
        away = normalise_team_name(g.get("ateam", ""))
        if not home or not away:
            continue

        status = parse_game_status(g)
        scheduled_start = parse_scheduled_start(g)

        # Upsert by Squiggle game ID
        afl_game = db.session.get(AflGame, g["id"])
        if afl_game:
            afl_game.status = status
            afl_game.home_score = g.get("hscore")
            afl_game.away_score = g.get("ascore")
            afl_game.venue = g.get("venue")
            if scheduled_start:
                afl_game.scheduled_start = scheduled_start
        else:
            afl_game = AflGame(
                id=g["id"],
                year=year,
                afl_round=afl_round,
                home_team=home,
                away_team=away,
                venue=g.get("venue"),
                scheduled_start=scheduled_start,
                status=status,
                home_score=g.get("hscore"),
                away_score=g.get("ascore"),
            )
            db.session.add(afl_game)
        count += 1

    db.session.commit()
    logger.info("Synced %d games for %d R%d", count, year, afl_round)

    # Mirror game schedule to round 0 if pre-season is active
    if afl_round == 1:
        _mirror_game_schedule_to_r0(year)

    return count


def _mirror_game_schedule_to_r0(year: int):
    """Copy AflGame rows from round 1 to round 0 for pre-season display."""
    if not _has_active_preseason(year):
        return
    _mirror_afl_games(year, source_round=1, target_round=0)
    db.session.commit()


# ── Live scores sync ─────────────────────────────────────────────────


def sync_live_scores(year: int, afl_round: int) -> dict:
    """Main polling function: scrape live scores, update DB, rescore matchups.

    Returns dict of changed data suitable for SocketIO broadcast:
    {league_id: {fixture_id: {...}, ...}, ...}
    """
    # 1. Refresh game statuses from Squiggle
    sync_game_schedule(year, afl_round)

    # 2. Check if any games are live or recently completed
    afl_games = AflGame.query.filter_by(year=year, afl_round=afl_round).all()
    active_games = [g for g in afl_games if g.status in ("live", "complete")]
    if not active_games:
        logger.debug("No active games for %d R%d, skipping scrape", year, afl_round)
        return {}

    # 3. Scrape live SC scores
    sc_scores = scrape_live_round(year, afl_round)
    if not sc_scores:
        logger.info("No SC scores scraped for %d R%d", year, afl_round)
        return {}

    # 4. Build player name→AflPlayer lookup
    all_players = AflPlayer.query.all()
    player_lookup: dict[tuple[str, str], AflPlayer] = {}
    player_name_lookup: dict[str, list[AflPlayer]] = {}
    # Surname + team lookup for footyinfo (returns surname-only names)
    surname_team_lookup: dict[tuple[str, str], list[AflPlayer]] = {}
    for p in all_players:
        player_lookup[(p.name, p.afl_team)] = p
        player_name_lookup.setdefault(p.name, []).append(p)
        # Extract surname (last word of name)
        surname = p.name.split()[-1] if p.name else ""
        if surname:
            surname_team_lookup.setdefault((surname, p.afl_team), []).append(p)

    # Build set of teams in active games
    active_teams = set()
    completed_teams = set()
    for g in active_games:
        active_teams.add(g.home_team)
        active_teams.add(g.away_team)
        if g.status == "complete":
            completed_teams.add(g.home_team)
            completed_teams.add(g.away_team)

    # 5. Upsert PlayerStat rows from scraped SC scores
    updated_player_ids = set()
    unmatched_count = 0
    for entry in sc_scores:
        name = entry["name"]
        team = entry["team"]
        sc_score = entry["sc_score"]
        is_surname_only = entry.get("is_surname_only", False)

        # Match by (name, team) first
        afl_player = player_lookup.get((name, team))
        if not afl_player:
            # Fallback: match by name only (if unambiguous)
            candidates = player_name_lookup.get(name, [])
            if len(candidates) == 1:
                afl_player = candidates[0]

        # Surname-only matching (footyinfo fallback)
        if not afl_player and is_surname_only and team:
            surname_candidates = surname_team_lookup.get((name, team), [])
            if len(surname_candidates) == 1:
                afl_player = surname_candidates[0]

        if not afl_player:
            unmatched_count += 1
            logger.debug("Unmatched player from scrape: '%s' (team='%s')", name, team)
            continue

        # Only process players whose AFL team is in an active game
        if afl_player.afl_team not in active_teams:
            continue

        is_live = afl_player.afl_team not in completed_teams

        stat = PlayerStat.query.filter_by(
            player_id=afl_player.id, year=year, round=afl_round
        ).first()

        if stat:
            stat.supercoach_score = sc_score
            stat.is_live = is_live
        else:
            stat = PlayerStat(
                player_id=afl_player.id,
                year=year,
                round=afl_round,
                supercoach_score=sc_score,
                is_live=is_live,
            )
            db.session.add(stat)

        updated_player_ids.add(afl_player.id)

    db.session.commit()

    matched = len(updated_player_ids)
    total_scraped = len(sc_scores)
    if unmatched_count > 0:
        logger.warning(
            "Player matching: %d/%d matched, %d unmatched for %d R%d",
            matched, total_scraped, unmatched_count, year, afl_round,
        )
    else:
        logger.info("Player matching: %d/%d matched for %d R%d", matched, total_scraped, year, afl_round)

    # 6. Mirror data to round 0 if any league has active pre-season fixtures
    if afl_round == 1:
        _mirror_round_data(year, source_round=1, target_round=0)

    # 7. Rescore affected fantasy matchups
    changed_data = _rescore_affected_matchups(year, afl_round, updated_player_ids)

    return changed_data


def _has_active_preseason(year: int) -> bool:
    """Check if any league has non-completed round 0 fixtures."""
    return Fixture.query.filter_by(
        year=year, afl_round=0, is_final=False
    ).filter(Fixture.status != "completed").first() is not None


def _mirror_afl_games(year: int, source_round: int, target_round: int):
    """Copy AflGame rows from source_round to target_round using ID offset."""
    source_games = AflGame.query.filter_by(year=year, afl_round=source_round).all()
    for g in source_games:
        mirror_id = g.id + _R0_ID_OFFSET
        existing = db.session.get(AflGame, mirror_id)
        if existing:
            existing.status = g.status
            existing.home_score = g.home_score
            existing.away_score = g.away_score
            existing.venue = g.venue
            existing.scheduled_start = g.scheduled_start
        else:
            db.session.add(AflGame(
                id=mirror_id, year=year, afl_round=target_round,
                home_team=g.home_team, away_team=g.away_team,
                venue=g.venue, scheduled_start=g.scheduled_start,
                status=g.status, home_score=g.home_score, away_score=g.away_score,
            ))


_STAT_COLS = (
    "kicks", "handballs", "marks", "tackles", "goals", "behinds", "hitouts",
    "disposals", "inside_50s", "clearances", "rebounds", "turnovers",
    "intercepts", "contested_possessions", "uncontested_possessions",
    "tackles_inside_50", "metres_gained", "score_involvements",
)


def _mirror_round_data(year: int, source_round: int, target_round: int):
    """Copy AflGame and PlayerStat rows from source_round to target_round.

    Gives pre-season (round 0) its own data rows mirrored from AFL R1.
    Only runs if there are active pre-season fixtures.
    """
    if not _has_active_preseason(year):
        return

    _mirror_afl_games(year, source_round, target_round)

    # Mirror PlayerStat rows
    source_stats = PlayerStat.query.filter_by(year=year, round=source_round).all()
    for s in source_stats:
        existing = PlayerStat.query.filter_by(
            player_id=s.player_id, year=year, round=target_round
        ).first()
        if existing:
            existing.supercoach_score = s.supercoach_score
            existing.afl_fantasy_score = s.afl_fantasy_score
            existing.is_live = s.is_live
            for col in _STAT_COLS:
                val = getattr(s, col, None)
                if val is not None:
                    setattr(existing, col, val)
        else:
            mirror = PlayerStat(
                player_id=s.player_id, year=year, round=target_round,
                supercoach_score=s.supercoach_score,
                afl_fantasy_score=s.afl_fantasy_score,
                is_live=s.is_live,
            )
            for col in _STAT_COLS:
                val = getattr(s, col, None)
                if val is not None:
                    setattr(mirror, col, val)
            db.session.add(mirror)

    db.session.commit()
    logger.info("Mirrored R%d data to R%d (%d games, %d stats)",
                source_round, target_round, len(source_stats), len(source_stats))


def _rescore_affected_matchups(year: int, afl_round: int, updated_player_ids: set[int]) -> dict:
    """Rescore fantasy teams that have players with updated scores.

    Returns {league_id: {fixture_id: {home_score, away_score, ...}, ...}, ...}
    """
    if not updated_player_ids:
        return {}

    # Find all teams that have these players on their active roster
    affected_roster = FantasyRoster.query.filter(
        FantasyRoster.player_id.in_(updated_player_ids),
        FantasyRoster.is_active == True,
    ).all()
    affected_team_ids = {r.team_id for r in affected_roster}

    if not affected_team_ids:
        return {}

    # Get leagues for these teams
    affected_teams = FantasyTeam.query.filter(FantasyTeam.id.in_(affected_team_ids)).all()
    league_teams: dict[int, set[int]] = {}
    team_to_league: dict[int, int] = {}
    for t in affected_teams:
        league_teams.setdefault(t.league_id, set()).add(t.id)
        team_to_league[t.id] = t.league_id

    # Check if all AFL games in this round are complete
    all_games = AflGame.query.filter_by(year=year, afl_round=afl_round).all()
    all_complete = all_games and all(g.status == "complete" for g in all_games)

    changed_data: dict[int, dict] = {}

    for league_id, team_ids in league_teams.items():
        league = db.session.get(League, league_id)
        if not league:
            continue

        # When AFL R1 data arrives, check if this league has active pre-season
        # (round 0) fixtures. If so, rescore round 0 INSTEAD of round 1.
        # Round 1 only gets live scoring after round 0 is fully completed.
        fantasy_round = afl_round
        if afl_round == 1:
            r0_active = Fixture.query.filter_by(
                league_id=league_id, year=year, afl_round=0, is_final=False
            ).filter(Fixture.status != "completed").first()
            if r0_active:
                fantasy_round = 0

        # Update fixture scores for this league/round
        fixtures = Fixture.query.filter_by(
            league_id=league_id, year=year, afl_round=fantasy_round
        ).all()

        if league.scoring_type == "ultimate_footy":
            # UF: rescore at fixture level using stat category totals
            categories = [r.stat_column for r in
                          CustomScoringRule.query.filter_by(league_id=league_id).all()]
            league_data = {}
            for f in fixtures:
                if f.status == "completed":
                    continue  # Already finalized — don't touch
                if categories:
                    breakdown = _compute_uf_fixture(f, league_id, f.afl_round, year, categories)
                    home_wins = sum(1 for b in breakdown if b["winner"] == "home")
                    away_wins = sum(1 for b in breakdown if b["winner"] == "away")
                else:
                    home_wins = 0
                    away_wins = 0

                f.home_score = home_wins
                f.away_score = away_wins

                if f.status == "scheduled":
                    f.status = "live"

                league_data[f.id] = {
                    "fixture_id": f.id,
                    "home_team_id": f.home_team_id,
                    "away_team_id": f.away_team_id,
                    "home_score": home_wins,
                    "away_score": away_wins,
                    "home_captain_bonus": 0,
                    "away_captain_bonus": 0,
                    "status": f.status,
                }

            if league_data:
                changed_data[league_id] = league_data
        else:
            # Standard scoring: rescore each affected team for the fantasy round
            for team_id in team_ids:
                score_team_round(team_id, league_id, fantasy_round, year, league.scoring_type, league.hybrid_base)

            league_data = {}
            for f in fixtures:
                if f.status == "completed":
                    continue  # Already finalized — don't touch
                home_rs = RoundScore.query.filter_by(
                    team_id=f.home_team_id, afl_round=fantasy_round, year=year
                ).first()
                away_rs = RoundScore.query.filter_by(
                    team_id=f.away_team_id, afl_round=fantasy_round, year=year
                ).first()

                home_total = home_rs.total_score if home_rs else 0
                away_total = away_rs.total_score if away_rs else 0

                f.home_score = home_total
                f.away_score = away_total

                # Auto-transition fixture status
                if f.status == "scheduled":
                    f.status = "live"

                league_data[f.id] = {
                    "fixture_id": f.id,
                    "home_team_id": f.home_team_id,
                    "away_team_id": f.away_team_id,
                    "home_score": home_total,
                    "away_score": away_total,
                    "home_captain_bonus": home_rs.captain_bonus if home_rs else 0,
                    "away_captain_bonus": away_rs.captain_bonus if away_rs else 0,
                    "status": f.status,
                }

            if league_data:
                changed_data[league_id] = league_data

    db.session.commit()

    # If all games complete, schedule delayed finalization (45 min)
    if all_complete:
        from models.scheduler import schedule_round_finalization
        schedule_round_finalization(year, afl_round)

    return changed_data


# ── Rolling lockouts ─────────────────────────────────────────────────


def get_locked_player_ids(afl_round: int, year: int) -> set[int]:
    """Return set of AflPlayer IDs whose AFL game has started (live or complete).

    Used by lineup management to prevent swapping locked players.
    """
    live_games = AflGame.query.filter(
        AflGame.year == year,
        AflGame.afl_round == afl_round,
        AflGame.status.in_(["live", "complete"]),
    ).all()

    if not live_games:
        return set()

    locked_teams = set()
    for g in live_games:
        locked_teams.add(g.home_team)
        locked_teams.add(g.away_team)

    locked_players = AflPlayer.query.filter(
        AflPlayer.afl_team.in_(locked_teams)
    ).all()

    return {p.id for p in locked_players}


def _format_game_time(dt):
    """Format a datetime as 'Thu 7:30pm' for display."""
    if not dt:
        return None
    t = dt.strftime("%I:%M%p").lstrip("0").lower()
    return f"{dt.strftime('%a')} {t}"


def get_game_statuses(afl_round: int, year: int) -> list[dict]:
    """Return list of game status dicts for a round (for frontend display)."""
    games = AflGame.query.filter_by(year=year, afl_round=afl_round).all()
    return [
        {
            "game_id": g.id,
            "home_team": g.home_team,
            "away_team": g.away_team,
            "status": g.status,
            "scheduled_start": g.scheduled_start.isoformat() if g.scheduled_start else None,
            "scheduled_display": _format_game_time(g.scheduled_start),
            "home_score": g.home_score,
            "away_score": g.away_score,
        }
        for g in games
    ]


def _compute_player_score(stat, league_id, scoring_type, hybrid_base=None):
    """Compute a player's score from a PlayerStat row, respecting league scoring type.

    Returns the numeric score (0 if stat columns are null).
    """
    from models.scoring_engine import _compute_score_from_stat
    return _compute_score_from_stat(stat, league_id, scoring_type, hybrid_base)


def get_player_score_breakdown(team_id: int, afl_round: int, year: int,
                                league_id: int | None = None,
                                include_reserves: bool = False) -> list[dict]:
    """Get per-player score breakdown for a team in a round (for live display).

    Detects DNP (did-not-play) field players and shows which emergency
    replaced them, mirroring the scoring engine's auto-sub logic.

    Only marks a player as DNP if their AFL team's game has started
    (live or complete) but no stat row exists. Players whose game hasn't
    begun show as 'yet to play' instead.

    If league_id is provided, uses the league's scoring type for score calculation.
    Otherwise falls back to supercoach scores.

    If include_reserves is True, also returns benched (reserve) players
    with lineup_type='reserve'.
    """
    roster_entries = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True
    ).all()

    if not roster_entries:
        return []

    # Determine scoring type
    scoring_type = "supercoach"
    hybrid_base = None
    if league_id:
        league = db.session.get(League, league_id)
        if league:
            scoring_type = league.scoring_type
            hybrid_base = league.hybrid_base

    # Separate on-field vs emergencies vs reserves
    on_field = [r for r in roster_entries if not r.is_benched and not r.is_emergency]
    emergencies = [r for r in roster_entries if r.is_emergency]
    reserves = [r for r in roster_entries if r.is_benched and not r.is_emergency]

    # Pre-fetch stats for all relevant players in one query
    relevant_ids = [r.player_id for r in on_field] + [r.player_id for r in emergencies]
    if include_reserves:
        relevant_ids += [r.player_id for r in reserves]
    stats_rows = PlayerStat.query.filter(
        PlayerStat.player_id.in_(relevant_ids),
        PlayerStat.year == year,
        PlayerStat.round == afl_round,
    ).all() if relevant_ids else []
    stats_map = {s.player_id: s for s in stats_rows}

    # Determine which AFL teams have started playing (live or complete)
    started_games = AflGame.query.filter(
        AflGame.year == year,
        AflGame.afl_round == afl_round,
        AflGame.status.in_(["live", "complete"]),
    ).all()
    started_teams = set()
    for g in started_games:
        started_teams.add(g.home_team)
        started_teams.add(g.away_team)

    # Determine which emergencies auto-subbed for DNP field players
    # Highest-scoring emergency subs in first, then second-highest, etc.
    used_emergencies = set()        # emergency player_id -> True
    dnp_replaced_by = {}            # field player_id -> emergency player_id
    emergency_replaces = {}         # emergency player_id -> field player name

    # Pre-calculate emergency scores and sort by highest first
    em_scored = []
    for em in emergencies:
        em_stat = stats_map.get(em.player_id)
        if em_stat is not None:
            em_score = _compute_player_score(em_stat, league_id, scoring_type, hybrid_base)
            em_scored.append((em, em_score))
    em_scored.sort(key=lambda x: x[1], reverse=True)

    # Collect DNP field entries
    dnp_field_entries = []
    for entry in on_field:
        stat = stats_map.get(entry.player_id)
        if stat is not None:
            continue  # played — no sub needed
        player = entry.player
        player_team = player.afl_team if player else ""
        if player_team not in started_teams:
            continue  # game hasn't started — not DNP yet
        dnp_field_entries.append(entry)

    # Assign highest-scoring emergencies to DNP slots
    for entry in dnp_field_entries:
        for em, em_score in em_scored:
            if em.player_id in used_emergencies:
                continue
            if not _breakdown_positions_compatible(entry, em):
                continue
            used_emergencies.add(em.player_id)
            dnp_replaced_by[entry.player_id] = em.player_id
            emergency_replaces[em.player_id] = entry.player.name if entry.player else "Unknown"
            break

    # Build breakdown list
    breakdown = []

    for entry in on_field:
        stat = stats_map.get(entry.player_id)
        player = entry.player
        player_team = player.afl_team if player else ""
        game_started = player_team in started_teams
        is_dnp = stat is None and game_started
        replaced_by_id = dnp_replaced_by.get(entry.player_id)

        score = _compute_player_score(stat, league_id, scoring_type, hybrid_base) if stat else 0

        # Determine lineup type from position code
        pos = (entry.position_code or "").upper()
        if pos == "FLEX":
            lineup_type = "flex"
        else:
            lineup_type = "field"

        breakdown.append({
            "player_id": entry.player_id,
            "name": player.name if player else "Unknown",
            "afl_team": player.afl_team if player else "",
            "position": entry.position_code or "FIELD",
            "score": score,
            "is_live": stat.is_live if stat else False,
            "is_captain": entry.is_captain,
            "is_vice_captain": entry.is_vice_captain,
            "is_emergency": False,
            "is_dnp": is_dnp,
            "game_started": game_started,
            "replaced_by": replaced_by_id,
            "lineup_type": lineup_type,
        })

    for entry in emergencies:
        stat = stats_map.get(entry.player_id)
        player = entry.player
        subbed_on = entry.player_id in used_emergencies

        score = _compute_player_score(stat, league_id, scoring_type, hybrid_base) if stat else 0

        breakdown.append({
            "player_id": entry.player_id,
            "name": player.name if player else "Unknown",
            "afl_team": player.afl_team if player else "",
            "position": entry.position_code or "EMG",
            "score": score,
            "is_live": stat.is_live if stat else False,
            "is_captain": entry.is_captain,
            "is_vice_captain": entry.is_vice_captain,
            "is_emergency": True,
            "is_dnp": False,
            "game_started": (player.afl_team if player else "") in started_teams,
            "subbed_on": subbed_on,
            "replaces": emergency_replaces.get(entry.player_id, ""),
            "lineup_type": "emergency",
        })

    # Optionally include reserves (benched players not in lineup)
    if include_reserves:
        for entry in reserves:
            stat = stats_map.get(entry.player_id)
            player = entry.player

            score = _compute_player_score(stat, league_id, scoring_type, hybrid_base) if stat else 0

            breakdown.append({
                "player_id": entry.player_id,
                "name": player.name if player else "Unknown",
                "afl_team": player.afl_team if player else "",
                "position": player.position if player else "",
                "score": score,
                "is_live": stat.is_live if stat else False,
                "is_captain": False,
                "is_vice_captain": False,
                "is_emergency": False,
                "is_dnp": False,
                "game_started": (player.afl_team if player else "") in started_teams,
                "replaced_by": None,
                "lineup_type": "reserve",
            })

    return breakdown


def _breakdown_positions_compatible(field_entry, emergency_entry):
    """Check if an emergency can sub for a field player based on position."""
    field_pos = (field_entry.position_code or "").upper()
    em_player = emergency_entry.player

    if not field_pos or not em_player or not em_player.position:
        return True

    em_positions = set(em_player.position.upper().split("/"))

    if field_pos in ("BENCH", "UTIL", "FLEX"):
        return True

    return field_pos in em_positions

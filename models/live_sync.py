"""Live sync orchestrator: ties Squiggle schedule + Footywire stats + DB together.

Called by the scheduler to keep AFL game data and fantasy scores up to date
during live AFL rounds.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func as sa_func

from models.database import (
    db, AflGame, AflPlayer, PlayerStat, ScScore, Fixture, FantasyTeam,
    FantasyRoster, LiveScoringConfig, RoundScore, League,
    CustomScoringRule, WeeklyLineup, LineupSlot,
    Reserve7sFixture, Reserve7sRoundScore,
)
from models.scoring_engine import score_team_round, _compute_uf_fixture, _positions_compatible, _round_fully_locked
from scrapers.squiggle import (
    get_games as squiggle_get_games,
    normalise_team_name,
    parse_game_status,
    parse_scheduled_start,
)
from scrapers.footywire_live import scrape_live_round

logger = logging.getLogger(__name__)

_R0_ID_OFFSET = 10_000_000  # Offset added to AflGame IDs for round 0 copies


# ── SC average recompute ─────────────────────────────────────────────


def recompute_sc_averages(year: int) -> int:
    """Recompute AflPlayer.sc_avg from PlayerStat for the given year.

    Returns the number of players updated with a 2026 average.
    """
    rows = db.session.query(
        PlayerStat.player_id,
        sa_func.avg(PlayerStat.supercoach_score).label("avg_sc"),
        sa_func.count(PlayerStat.id).label("games"),
    ).filter(
        PlayerStat.year == year,
        PlayerStat.supercoach_score.isnot(None),
    ).group_by(PlayerStat.player_id).all()

    avg_map = {r.player_id: (r.avg_sc, r.games) for r in rows}

    updated = 0
    for p in AflPlayer.query.all():
        if p.id in avg_map:
            avg_sc, games = avg_map[p.id]
            p.sc_avg = round(float(avg_sc), 1)
            p.games_played = int(games)
            updated += 1
        else:
            # No 2026 data — clear sc_avg so it shows as "-"
            # sc_avg_prev retains their previous season average for reference
            p.sc_avg = None
            p.games_played = 0

    db.session.commit()
    logger.info("Recomputed sc_avg for year %d: %d players with data", year, updated)
    return updated


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

    # 4. Build player name→AflPlayer lookup with bulletproof normalisation
    all_players = AflPlayer.query.all()

    # Normalise a name to a canonical form that strips all variation:
    # lowercase, remove apostrophes/hyphens/periods/accents/unicode arrows,
    # collapse whitespace, strip leading/trailing spaces
    import unicodedata, re as _re
    def _normalise(name: str) -> str:
        if not name:
            return ""
        # Strip fitzRoy unicode arrows (↗ ↙ etc.) and other non-ASCII markers
        s = "".join(c for c in name if unicodedata.category(c)[0] != "S")
        # Decompose accents (é → e, ü → u)
        s = unicodedata.normalize("NFKD", s)
        s = "".join(c for c in s if not unicodedata.combining(c))
        # Remove apostrophes, hyphens, periods
        s = s.replace("'", "").replace("'", "").replace("-", " ").replace(".", "")
        # Collapse whitespace and lowercase
        s = " ".join(s.lower().split())
        return s

    player_lookup: dict[tuple[str, str], AflPlayer] = {}        # exact
    player_lookup_norm: dict[tuple[str, str], AflPlayer] = {}   # normalised name + team
    player_name_lookup: dict[str, list[AflPlayer]] = {}          # name only (for unambiguous)
    player_name_norm_lookup: dict[str, list[AflPlayer]] = {}     # normalised name only
    surname_team_lookup: dict[tuple[str, str], list[AflPlayer]] = {}

    for p in all_players:
        player_lookup[(p.name, p.afl_team)] = p
        norm = _normalise(p.name)
        player_lookup_norm[(norm, p.afl_team)] = p
        player_name_lookup.setdefault(p.name, []).append(p)
        player_name_norm_lookup.setdefault(norm, []).append(p)
        # Extract surname (last word of name)
        words = p.name.split() if p.name else []
        surname = words[-1] if words else ""
        if surname:
            surname_team_lookup.setdefault((surname, p.afl_team), []).append(p)
            surname_team_lookup.setdefault((_normalise(surname), p.afl_team), []).append(p)
        # Multi-word surnames (De Koning, De Goey, Van Rooyen, etc.)
        if len(words) >= 3:
            two_word_surname = " ".join(words[-2:])
            surname_team_lookup.setdefault((two_word_surname, p.afl_team), []).append(p)
            surname_team_lookup.setdefault((_normalise(two_word_surname), p.afl_team), []).append(p)

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

        # ── Player matching chain (most specific → most fuzzy) ──
        norm_name = _normalise(name)

        # 1. Exact match: (name, team)
        afl_player = player_lookup.get((name, team))

        # 2. Normalised match: strips case, accents, apostrophes, hyphens, arrows
        if not afl_player:
            afl_player = player_lookup_norm.get((norm_name, team))

        # 3. Normalised name only (if unambiguous across all teams)
        if not afl_player:
            candidates = player_name_norm_lookup.get(norm_name, [])
            if len(candidates) == 1:
                afl_player = candidates[0]

        # 4. Surname-only matching (footyinfo returns surname-only names)
        if not afl_player and is_surname_only and team:
            norm_surname = norm_name
            parts = norm_name.split(None, 1)
            if len(parts) == 2 and len(parts[0]) <= 2:
                # Initial + surname: "o hollands" → match initial against first name
                initial, surname = parts[0], parts[1]
                surname_candidates = surname_team_lookup.get((surname, team), [])
                matched = [p for p in surname_candidates if _normalise(p.name).startswith(initial)]
                if len(matched) == 1:
                    afl_player = matched[0]
                norm_surname = surname
            # Direct surname/multi-word surname match
            if not afl_player:
                surname_candidates = surname_team_lookup.get((norm_surname, team), [])
                if len(surname_candidates) == 1:
                    afl_player = surname_candidates[0]

        # 5. Last resort: try original (un-normalised) name lookups
        if not afl_player:
            candidates = player_name_lookup.get(name, [])
            if len(candidates) == 1:
                afl_player = candidates[0]

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

        # Extract detailed stats from scrape entry
        _detail = {
            "kicks": entry.get("kicks"),
            "handballs": entry.get("handballs"),
            "disposals": entry.get("disposals"),
            "marks": entry.get("marks"),
            "tackles": entry.get("tackles"),
            "goals": entry.get("goals"),
            "behinds": entry.get("behinds"),
            "hitouts": entry.get("hitouts"),
        }

        # Validate SC score is within reasonable range
        if sc_score is not None and (sc_score < -50 or sc_score > 300):
            logger.warning("Suspicious SC score %s for %s (player_id=%d) — skipping",
                           sc_score, entry.get("name"), afl_player.id)
            continue

        if stat:
            stat.supercoach_score = sc_score
            stat.is_live = is_live
            for k, v in _detail.items():
                if v is not None:
                    setattr(stat, k, v)
        else:
            stat = PlayerStat(
                player_id=afl_player.id,
                year=year,
                round=afl_round,
                supercoach_score=sc_score,
                is_live=is_live,
                **{k: v for k, v in _detail.items() if v is not None},
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

    # 5b. Sync ScScore rows alongside PlayerStat (for form/analytics queries)
    if updated_player_ids:
        sc_synced = 0
        for pid in updated_player_ids:
            ps = PlayerStat.query.filter_by(
                player_id=pid, year=year, round=afl_round
            ).first()
            if not ps or ps.supercoach_score is None:
                continue
            sc = ScScore.query.filter_by(
                player_id=pid, year=year, round=afl_round
            ).first()
            if sc:
                sc.sc_score = ps.supercoach_score
            else:
                db.session.add(ScScore(
                    player_id=pid, year=year, round=afl_round,
                    sc_score=ps.supercoach_score,
                ))
            sc_synced += 1
        db.session.commit()
        logger.info("ScScore sync: %d rows for %d R%d", sc_synced, year, afl_round)

    # 5c. Recompute sc_avg from 2026 PlayerStat data
    recompute_sc_averages(year)

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

        # ── 7s live scoring (mirror main comp fixture status + scores) ──
        try:
            from models.reserve7s_engine import score_7s_round
            from blueprints.reserve7s import _ensure_7s_lineup
            sevens_fixtures = Reserve7sFixture.query.filter_by(
                league_id=league_id, year=year, afl_round=fantasy_round,
            ).all()
            if sevens_fixtures:
                # Auto-carry lineups forward for all teams in this round
                for sf in sevens_fixtures:
                    _ensure_7s_lineup(league_id, sf.home_team_id, fantasy_round, year)
                    _ensure_7s_lineup(league_id, sf.away_team_id, fantasy_round, year)
                score_7s_round(league_id, fantasy_round, year)
                for sf in sevens_fixtures:
                    if sf.status == "completed":
                        continue
                    hrs = Reserve7sRoundScore.query.filter_by(
                        team_id=sf.home_team_id, afl_round=fantasy_round, year=year,
                    ).first()
                    ars = Reserve7sRoundScore.query.filter_by(
                        team_id=sf.away_team_id, afl_round=fantasy_round, year=year,
                    ).first()
                    sf.home_score = hrs.total_score if hrs else 0
                    sf.away_score = ars.total_score if ars else 0
                    if sf.status == "scheduled":
                        sf.status = "live"
        except Exception:
            logger.warning("7s live scoring failed for league %d", league_id, exc_info=True)

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
    games = AflGame.query.filter_by(year=year, afl_round=afl_round).order_by(AflGame.scheduled_start).all()
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
    # Determine scoring type
    scoring_type = "supercoach"
    hybrid_base = None
    if league_id:
        league = db.session.get(League, league_id)
        if league:
            scoring_type = league.scoring_type
            hybrid_base = league.hybrid_base

    # Check for a WeeklyLineup snapshot (created by rolling lockout).
    # Use it if it has slots — even if not fully locked yet, the snapshot
    # reflects the correct state (frozen for started games, live for others).
    snapshot_lineup = WeeklyLineup.query.filter_by(
        team_id=team_id, afl_round=afl_round, year=year
    ).first()

    if snapshot_lineup:
        lineup_slots = LineupSlot.query.filter_by(lineup_id=snapshot_lineup.id).all()
        if lineup_slots:
            _FIELD_POS = {"DEF", "MID", "FWD", "RUC", "FLEX"}
            on_field = [s for s in lineup_slots
                        if not s.is_emergency and (s.position_code or "").upper() in _FIELD_POS]
            emergencies = [s for s in lineup_slots if s.is_emergency]
            reserves = [s for s in lineup_slots
                        if not s.is_emergency and (s.position_code or "").upper() not in _FIELD_POS]
        else:
            snapshot_lineup = None  # fall through to FantasyRoster

    if not snapshot_lineup:
        # Fallback: no snapshot exists, use live FantasyRoster state
        roster_entries = FantasyRoster.query.filter_by(
            team_id=team_id, is_active=True
        ).all()

        if not roster_entries:
            return []

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
    # Also build team→kickoff map for sorting
    all_round_games = AflGame.query.filter(
        AflGame.year == year,
        AflGame.afl_round == afl_round,
    ).all()
    started_teams = set()
    team_kickoff = {}
    for g in all_round_games:
        if g.status in ("live", "complete"):
            started_teams.add(g.home_team)
            started_teams.add(g.away_team)
        if g.scheduled_start:
            ts = g.scheduled_start.isoformat()
            for t in (g.home_team, g.away_team):
                if t not in team_kickoff or ts < team_kickoff[t]:
                    team_kickoff[t] = ts

    # A player with no game this round (bye) is DNP (emergency subs on) only once
    # the round is fully locked — until then their slot is still swappable
    # (end-of-round resolution). Byes derived from fixtures, not AflByeRound.
    round_teams = {t for g in all_round_games for t in (g.home_team, g.away_team)}
    round_locked = _round_fully_locked(all_round_games)

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

    # Collect DNP field entries (no stat OR SC=0 from a started game = DNP).
    # A bye player counts as DNP only once the round is fully locked.
    dnp_field_entries = []
    for entry in on_field:
        stat = stats_map.get(entry.player_id)
        player = entry.player
        player_team = player.afl_team if player else ""
        game_started = player_team in started_teams

        if round_teams and player_team not in round_teams:
            # No game this round (bye)
            if round_locked:
                dnp_field_entries.append(entry)
            # else: bye slot still swappable — pending, no emergency yet
        elif stat is None and game_started:
            dnp_field_entries.append(entry)
        elif stat is not None and stat.supercoach_score == 0 and game_started:
            # SC=0 from a completed/live game = late out / DNP
            dnp_field_entries.append(entry)
        # else: player scored > 0, or game hasn't started — not DNP

    dnp_pids = {e.player_id for e in dnp_field_entries}

    # Assign highest-scoring emergencies to DNP slots
    for entry in dnp_field_entries:
        for em, em_score in em_scored:
            if em.player_id in used_emergencies:
                continue
            if not _positions_compatible(entry, em):
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
        is_dnp = entry.player_id in dnp_pids
        replaced_by_id = dnp_replaced_by.get(entry.player_id)

        score = _compute_player_score(stat, league_id, scoring_type, hybrid_base) if stat else 0

        # FLEX is an on-field scoring position — treat as "field" for display
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
            "game_kickoff": team_kickoff.get(player_team, ""),
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
            "position": player.position if player and player.position else (entry.position_code or "EMG"),
            "score": score,
            "is_live": stat.is_live if stat else False,
            "is_captain": entry.is_captain,
            "is_vice_captain": entry.is_vice_captain,
            "is_emergency": True,
            "is_dnp": False,
            "game_started": (player.afl_team if player else "") in started_teams,
            "game_kickoff": team_kickoff.get(player.afl_team if player else "", ""),
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


def reconcile_missing_scores(year, afl_round):
    """Post-finalization reconciliation: backfill PlayerStat from ScScore for any
    rostered players who have a ScScore but no PlayerStat (missed by name matching).

    Also creates PlayerStat with score=0 for players whose game completed but
    have no data at all (true DNPs or scraper misses), so the scoring engine
    can correctly identify them as DNP.

    Returns: (backfilled_count, flagged_count)
    """
    from models.database import (
        db, AflPlayer, PlayerStat, ScScore, FantasyRoster, AflGame,
    )

    # All rostered player IDs across all teams
    rostered_pids = {r.player_id for r in
                     db.session.query(FantasyRoster.player_id)
                     .filter_by(is_active=True).all()}

    # Teams whose game completed this round
    completed_teams = set()
    for g in AflGame.query.filter_by(year=year, afl_round=afl_round).all():
        if g.status in ("complete", "live"):
            completed_teams.add(g.home_team)
            completed_teams.add(g.away_team)

    backfilled = 0
    flagged = 0

    for pid in rostered_pids:
        # Already has a PlayerStat? Skip.
        existing = PlayerStat.query.filter_by(
            player_id=pid, year=year, round=afl_round
        ).first()
        if existing:
            continue

        player = db.session.get(AflPlayer, pid)
        if not player or not player.afl_team:
            continue

        # Only consider players whose team played this round
        if player.afl_team not in completed_teams:
            continue

        # Check if ScScore exists (from live scraper)
        sc = ScScore.query.filter_by(
            player_id=pid, year=year, round=afl_round
        ).first()

        if sc and sc.sc_score is not None:
            # Backfill from ScScore
            stat = PlayerStat(
                player_id=pid, year=year, round=afl_round,
                supercoach_score=sc.sc_score, is_live=False,
            )
            db.session.add(stat)
            backfilled += 1
            logger.info("Reconciled: %s (pid=%d) R%d SC=%d from ScScore",
                        player.name, pid, afl_round, sc.sc_score)
        else:
            # No data at all — player's team played but no score anywhere.
            # Don't create a stat (they might have been a genuine late out / DNP).
            # Just flag for logging.
            flagged += 1
            logger.warning("No score data for rostered player %s (pid=%d, team=%s) in R%d",
                           player.name, pid, player.afl_team, afl_round)

    if backfilled:
        db.session.commit()
        logger.info("Reconciliation R%d: backfilled %d, flagged %d", afl_round, backfilled, flagged)

    return backfilled, flagged



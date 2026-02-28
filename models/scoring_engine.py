"""Scoring engine: round scoring (SC or custom), captain bonus, standings calculation."""

from models.database import (
    db, RoundScore, SeasonStanding, Fixture, FantasyTeam, FantasyRoster,
    PlayerStat, CustomScoringRule, League, SeasonConfig,
)


def score_round(league_id, afl_round, year):
    """Score all teams for a given round. Uses SuperCoach or custom scoring based on league config.
    Returns dict of {team_id: total_score}.
    """
    league = db.session.get(League, league_id)
    if not league:
        return {}

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    scores = {}

    for team in teams:
        score = score_team_round(team.id, league_id, afl_round, year, league.scoring_type, league.hybrid_base)
        scores[team.id] = score

    # Single commit for all teams scored in this round
    db.session.commit()
    return scores


def score_team_round(team_id, league_id, afl_round, year, scoring_type, hybrid_base=None):
    """Score a single team for a round. Returns total score.

    NOTE: Does NOT commit — caller is responsible for db.session.commit().
    """
    # Get on-field roster entries
    roster_entries = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True
    ).all()

    on_field = [r for r in roster_entries if not r.is_benched and not r.is_emergency]
    emergencies = [r for r in roster_entries if r.is_emergency]
    captain_entry = next((r for r in roster_entries if r.is_captain), None)
    vc_entry = next((r for r in roster_entries if r.is_vice_captain), None)

    if not on_field:
        _save_round_score(team_id, afl_round, year, 0, 0, {})
        return 0

    total = 0.0
    captain_bonus = 0.0
    breakdown = {}
    used_emergencies = set()

    for entry in on_field:
        player_score = _get_player_score(entry.player_id, afl_round, year, league_id, scoring_type, hybrid_base)

        # If player didn't play (None = DNP), check for emergency sub
        if player_score is None:
            for em in emergencies:
                if em.player_id in used_emergencies:
                    continue
                # Position-aware: only sub within compatible positions
                if not _positions_compatible(entry, em):
                    continue
                em_score = _get_player_score(
                    em.player_id, afl_round, year, league_id, scoring_type, hybrid_base
                )
                if em_score is not None:
                    player_score = em_score
                    used_emergencies.add(em.player_id)
                    breakdown[f"emergency_{em.player_id}"] = em_score
                    break

        # DNP with no emergency = 0
        if player_score is None:
            player_score = 0

        total += player_score
        breakdown[str(entry.player_id)] = player_score

    # Captain bonus
    if captain_entry:
        cap_score = _get_player_score(captain_entry.player_id, afl_round, year, league_id, scoring_type, hybrid_base)
        if cap_score is not None and cap_score > 0:
            captain_bonus = cap_score  # doubled = original + bonus
        elif cap_score is None and vc_entry:
            # Captain DNP — use vice-captain
            vc_score = _get_player_score(vc_entry.player_id, afl_round, year, league_id, scoring_type, hybrid_base)
            if vc_score is not None and vc_score > 0:
                captain_bonus = vc_score

    total += captain_bonus
    _save_round_score(team_id, afl_round, year, total, captain_bonus, breakdown)
    return total


def _positions_compatible(field_entry, emergency_entry):
    """Check if an emergency can sub for a field player based on position.

    An emergency is compatible if they share at least one position with
    the field player. Falls back to True if position data is missing.
    """
    field_pos = (field_entry.position_code or "").upper()
    em_player = emergency_entry.player

    if not field_pos or not em_player or not em_player.position:
        return True  # allow if data is missing

    em_positions = set(em_player.position.upper().split("/"))

    # BENCH/UTIL entries are flexible
    if field_pos in ("BENCH", "UTIL", "FLEX"):
        return True

    return field_pos in em_positions


def _get_player_score(player_id, afl_round, year, league_id, scoring_type, hybrid_base=None):
    """Get a player's score for a round.

    Supports 4 scoring types:
      supercoach  -> stat.supercoach_score
      afl_fantasy -> stat.afl_fantasy_score
      custom      -> sum(stat_value * points_per for each CustomScoringRule)
      hybrid      -> base_score(SC or AF) + sum(stat_value * points_per for bonus rules)

    Returns None if the player did not play (no stat record), or the numeric score.
    """
    stat = PlayerStat.query.filter_by(
        player_id=player_id, year=year, round=afl_round
    ).first()

    if stat is None:
        return None  # DNP — no stat record at all

    return _compute_score_from_stat(stat, league_id, scoring_type, hybrid_base)


def _compute_score_from_stat(stat, league_id, scoring_type, hybrid_base=None):
    """Compute score from a PlayerStat row for any scoring type."""
    if scoring_type == "supercoach":
        return stat.supercoach_score or 0

    if scoring_type == "afl_fantasy":
        return stat.afl_fantasy_score or 0

    if scoring_type == "hybrid":
        # Fetch league for weight/mode settings
        league = db.session.get(League, league_id)
        weight = league.hybrid_base_weight if league and league.hybrid_base_weight is not None else 1.0
        mode = league.hybrid_custom_mode if league and league.hybrid_custom_mode else "points"

        # Base score from official source
        base = (stat.afl_fantasy_score or 0) if hybrid_base == "afl_fantasy" else (stat.supercoach_score or 0)

        # Custom bonus from rules
        rules = CustomScoringRule.query.filter_by(league_id=league_id).all()
        custom_total = sum((getattr(stat, r.stat_column, 0) or 0) * r.points_per for r in rules)

        # Apply formula based on mode
        if mode == "percentage":
            return round(base * weight + custom_total * (1 - weight), 1)
        else:  # "points" — weighted base + flat custom bonus
            return round(base * weight + custom_total, 1)

    # Custom scoring (also used for ultimate_footy per-player contribution display)
    rules = CustomScoringRule.query.filter_by(league_id=league_id).all()
    total = 0.0
    for rule in rules:
        val = getattr(stat, rule.stat_column, 0) or 0
        total += val * rule.points_per
    return round(total, 1)


def _save_round_score(team_id, afl_round, year, total, captain_bonus, breakdown):
    """Save or update a team's round score.

    NOTE: Does NOT commit — caller is responsible for db.session.commit().
    """
    existing = RoundScore.query.filter_by(
        team_id=team_id, afl_round=afl_round, year=year
    ).first()
    if existing:
        existing.total_score = total
        existing.captain_bonus = captain_bonus
        existing.breakdown = breakdown
    else:
        rs = RoundScore(
            team_id=team_id,
            afl_round=afl_round,
            year=year,
            total_score=total,
            captain_bonus=captain_bonus,
            breakdown=breakdown,
        )
        db.session.add(rs)


def recalculate_standings(league_id, year):
    """Recalculate standings from all completed fixture results.
    4 pts per win, 2 pts per draw, sorted by ladder points then percentage then points for.
    """
    config = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    pts_win = config.points_per_win if config else 4
    pts_draw = config.points_per_draw if config else 2

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    team_stats = {t.id: {"wins": 0, "losses": 0, "draws": 0,
                          "pf": 0.0, "pa": 0.0} for t in teams}

    # Get all completed non-finals fixtures
    fixtures = Fixture.query.filter_by(
        league_id=league_id, year=year, status="completed", is_final=False
    ).all()

    for f in fixtures:
        hs = f.home_score or 0
        aws = f.away_score or 0

        team_stats[f.home_team_id]["pf"] += hs
        team_stats[f.home_team_id]["pa"] += aws
        team_stats[f.away_team_id]["pf"] += aws
        team_stats[f.away_team_id]["pa"] += hs

        if hs > aws:
            team_stats[f.home_team_id]["wins"] += 1
            team_stats[f.away_team_id]["losses"] += 1
        elif aws > hs:
            team_stats[f.away_team_id]["wins"] += 1
            team_stats[f.home_team_id]["losses"] += 1
        else:
            team_stats[f.home_team_id]["draws"] += 1
            team_stats[f.away_team_id]["draws"] += 1

    # Update standings
    for team_id, stats in team_stats.items():
        ladder_pts = stats["wins"] * pts_win + stats["draws"] * pts_draw
        percentage = (stats["pf"] / stats["pa"] * 100) if stats["pa"] > 0 else 0

        standing = SeasonStanding.query.filter_by(
            league_id=league_id, team_id=team_id, year=year
        ).first()
        if not standing:
            standing = SeasonStanding(league_id=league_id, team_id=team_id, year=year)
            db.session.add(standing)

        standing.wins = stats["wins"]
        standing.losses = stats["losses"]
        standing.draws = stats["draws"]
        standing.points_for = round(stats["pf"], 1)
        standing.points_against = round(stats["pa"], 1)
        standing.percentage = round(percentage, 1)
        standing.ladder_points = ladder_pts

    db.session.commit()


def get_standings(league_id, year):
    """Get standings sorted by ladder points, then percentage, then points for."""
    return (
        SeasonStanding.query
        .filter_by(league_id=league_id, year=year)
        .order_by(
            SeasonStanding.ladder_points.desc(),
            SeasonStanding.percentage.desc(),
            SeasonStanding.points_for.desc(),
        )
        .all()
    )


def score_round_ultimate(league_id, afl_round, year):
    """Score all fixtures for an Ultimate Footy league.

    Instead of summing player points, teams compete head-to-head on stat
    categories.  For each category the team with the higher aggregate wins 1
    point.  Ties award 0 to both.

    Updates Fixture scores directly and saves RoundScore per team.
    Returns dict {team_id: categories_won}.
    """
    categories = [r.stat_column for r in CustomScoringRule.query.filter_by(league_id=league_id).all()]
    if not categories:
        return {}

    fixtures = Fixture.query.filter_by(
        league_id=league_id, afl_round=afl_round, year=year
    ).all()

    scores = {}
    for f in fixtures:
        breakdown = _compute_uf_fixture(f, league_id, afl_round, year, categories)
        home_wins = sum(1 for b in breakdown if b["winner"] == "home")
        away_wins = sum(1 for b in breakdown if b["winner"] == "away")

        f.home_score = home_wins
        f.away_score = away_wins

        # Save RoundScore for each team
        _save_round_score(f.home_team_id, afl_round, year, home_wins, 0,
                          {"stat_totals": {b["stat"]: b["home"] for b in breakdown},
                           "categories_won": home_wins})
        _save_round_score(f.away_team_id, afl_round, year, away_wins, 0,
                          {"stat_totals": {b["stat"]: b["away"] for b in breakdown},
                           "categories_won": away_wins})

        scores[f.home_team_id] = home_wins
        scores[f.away_team_id] = away_wins

    db.session.commit()
    return scores


def _compute_uf_fixture(fixture, league_id, afl_round, year, categories):
    """Compute per-category breakdown for a single UF fixture.

    Returns list of dicts: [{"stat": ..., "home": total, "away": total, "winner": "home"|"away"|"tie"}, ...]
    """
    home_roster = FantasyRoster.query.filter_by(team_id=fixture.home_team_id, is_active=True).all()
    away_roster = FantasyRoster.query.filter_by(team_id=fixture.away_team_id, is_active=True).all()

    home_ids = [r.player_id for r in home_roster if not r.is_benched and not r.is_emergency]
    away_ids = [r.player_id for r in away_roster if not r.is_benched and not r.is_emergency]

    home_stats = PlayerStat.query.filter(
        PlayerStat.player_id.in_(home_ids),
        PlayerStat.year == year,
        PlayerStat.round == afl_round,
    ).all() if home_ids else []

    away_stats = PlayerStat.query.filter(
        PlayerStat.player_id.in_(away_ids),
        PlayerStat.year == year,
        PlayerStat.round == afl_round,
    ).all() if away_ids else []

    breakdown = []
    for cat in categories:
        home_total = sum(getattr(s, cat, 0) or 0 for s in home_stats)
        away_total = sum(getattr(s, cat, 0) or 0 for s in away_stats)
        if home_total > away_total:
            winner = "home"
        elif away_total > home_total:
            winner = "away"
        else:
            winner = "tie"
        breakdown.append({"stat": cat, "home": home_total, "away": away_total, "winner": winner})

    return breakdown


def compute_uf_breakdown(fixture, league_id):
    """On-the-fly UF category breakdown for display (matchup detail page)."""
    categories = [r.stat_column for r in CustomScoringRule.query.filter_by(league_id=league_id).all()]
    if not categories:
        return []
    return _compute_uf_fixture(fixture, league_id, fixture.afl_round, fixture.year, categories)


def finalize_round(league_id, afl_round, year):
    """End-of-round: score all teams, resolve fixtures, update standings.

    Called by the commissioner to close out a round.
    Also advances finals if the completed fixture is a finals match.
    Returns the scores dict {team_id: total_score}.
    """
    league = db.session.get(League, league_id)

    if league and league.scoring_type == "ultimate_footy":
        # UF: score at fixture level (category wins)
        scores = score_round_ultimate(league_id, afl_round, year)
        # Fixtures already updated inside score_round_ultimate; mark completed
        fixtures = Fixture.query.filter_by(
            league_id=league_id, afl_round=afl_round, year=year
        ).all()
        for f in fixtures:
            f.status = "completed"
        db.session.commit()
    else:
        # Standard scoring path
        # 1. Score all teams (commits internally)
        scores = score_round(league_id, afl_round, year)

        # 2. Update fixture results
        fixtures = Fixture.query.filter_by(
            league_id=league_id, afl_round=afl_round, year=year
        ).all()
        for f in fixtures:
            f.home_score = scores.get(f.home_team_id, 0)
            f.away_score = scores.get(f.away_team_id, 0)
            f.status = "completed"

        db.session.commit()

    # 3. Recalculate standings (only from regular-season fixtures)
    recalculate_standings(league_id, year)

    # 4. Advance finals bracket if applicable
    has_finals = any(f.is_final for f in fixtures)
    if has_finals:
        from models.fixture_manager import advance_finals
        advance_finals(league_id, year)

    return scores


def get_live_scores(league_id, afl_round, year):
    """Get current round scores for all teams (for live display)."""
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    scores = {}
    for team in teams:
        rs = RoundScore.query.filter_by(
            team_id=team.id, afl_round=afl_round, year=year
        ).first()
        scores[team.id] = {
            "team_name": team.name,
            "total_score": rs.total_score if rs else 0,
            "captain_bonus": rs.captain_bonus if rs else 0,
        }
    return scores


def get_team_round_scores(team_id, year):
    """Get all round scores for a team across the season."""
    return (
        RoundScore.query
        .filter_by(team_id=team_id, year=year)
        .order_by(RoundScore.afl_round)
        .all()
    )

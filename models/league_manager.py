"""League creation, joining, scoring configuration, and custom score calculation."""

from models.database import (
    db, League, LeaguePositionSlot, CustomScoringRule,
    FantasyTeam, LeagueDraftWeights,
)
import config


# ── Default position slots (matches existing config.POSITIONS + bench) ──


DEFAULT_POSITION_SLOTS = [
    # On-field
    ("DEF", 5, False),
    ("MID", 7, False),
    ("FWD", 5, False),
    ("RUC", 1, False),
    # Bench (position-locked + flex)
    ("DEF", 1, True),
    ("MID", 2, True),
    ("FWD", 1, True),
    ("FLEX", 1, True),
]


def _generate_invite_code():
    """Generate a short unique invite code (8 chars, alphanumeric)."""
    import secrets
    import string
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(10):
        code = ''.join(secrets.choice(alphabet) for _ in range(8))
        if not League.query.filter_by(invite_code=code).first():
            return code
    return secrets.token_urlsafe(6)


def create_league(name, commissioner_id, season_year=None, scoring_type="supercoach",
                  squad_size=38, on_field_count=18, num_teams=6, draft_type="snake",
                  pick_timer_secs=120, position_slots=None, hybrid_base=None):
    """Create a new league with default position slots and optional custom scoring."""
    league = League(
        name=name,
        commissioner_id=commissioner_id,
        season_year=season_year or config.CURRENT_YEAR,
        scoring_type=scoring_type,
        hybrid_base=hybrid_base if scoring_type == "hybrid" else None,
        squad_size=squad_size,
        on_field_count=on_field_count,
        num_teams=num_teams,
        draft_type=draft_type,
        pick_timer_secs=pick_timer_secs,
        invite_code=_generate_invite_code(),
    )
    db.session.add(league)
    db.session.flush()  # get league.id

    # Position slots — use custom if provided, else defaults
    slots_to_use = position_slots or DEFAULT_POSITION_SLOTS
    for code, count, is_bench in slots_to_use:
        slot = LeaguePositionSlot(
            league_id=league.id,
            position_code=code,
            count=count,
            is_bench=is_bench,
        )
        db.session.add(slot)

    # Default draft weights (merge to avoid conflict if orphan exists)
    existing_weights = LeagueDraftWeights.query.filter_by(league_id=league.id).first()
    if not existing_weights:
        weights = LeagueDraftWeights(league_id=league.id)
        db.session.add(weights)

    # If custom scoring, seed with AFL Fantasy defaults
    if scoring_type == "custom":
        for stat, pts in config.DEFAULT_CUSTOM_SCORING.items():
            rule = CustomScoringRule(
                league_id=league.id,
                stat_column=stat,
                points_per=pts,
            )
            db.session.add(rule)

    db.session.commit()
    return league


def join_league(league_id, user_id, team_name):
    """Create a fantasy team in the league for the given user.
    Returns (team, None) on success or (None, error_msg) on failure."""
    league = db.session.get(League, league_id)
    if not league:
        return None, "League not found."

    # Check if user already has a team in this league
    existing = FantasyTeam.query.filter_by(league_id=league_id, owner_id=user_id).first()
    if existing:
        return None, "You already have a team in this league."

    # Check if league is full
    team_count = FantasyTeam.query.filter_by(league_id=league_id).count()
    if team_count >= league.num_teams:
        return None, "League is full."

    team = FantasyTeam(
        league_id=league_id,
        owner_id=user_id,
        name=team_name,
        draft_order=team_count + 1,
    )
    db.session.add(team)
    db.session.commit()
    return team, None


def get_user_leagues(user_id):
    """Get all leagues a user is part of (as commissioner or team owner)."""
    commissioned = League.query.filter_by(commissioner_id=user_id).all()
    team_leagues = (
        db.session.query(League)
        .join(FantasyTeam, FantasyTeam.league_id == League.id)
        .filter(FantasyTeam.owner_id == user_id)
        .all()
    )
    # Merge and deduplicate
    seen = set()
    result = []
    for lg in commissioned + team_leagues:
        if lg.id not in seen:
            seen.add(lg.id)
            result.append(lg)
    return result


def get_league_teams(league_id):
    """Get all fantasy teams in a league."""
    return FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.draft_order).all()


def set_custom_scoring(league_id, rules_dict):
    """Set or update custom scoring rules for a league.
    rules_dict: {stat_column: points_per, ...}
    """
    # Delete existing rules
    CustomScoringRule.query.filter_by(league_id=league_id).delete()
    for stat, pts in rules_dict.items():
        rule = CustomScoringRule(
            league_id=league_id,
            stat_column=stat,
            points_per=float(pts),
        )
        db.session.add(rule)
    db.session.commit()


def get_custom_scoring(league_id):
    """Return the custom scoring rules as a dict {stat_column: points_per}."""
    rules = CustomScoringRule.query.filter_by(league_id=league_id).all()
    return {r.stat_column: r.points_per for r in rules}


def calculate_custom_score(player_stat_row, league_id):
    """Calculate a custom fantasy score for a single player_stat record.
    player_stat_row should be a PlayerStat ORM instance or dict with stat columns.
    """
    rules = get_custom_scoring(league_id)
    if not rules:
        return 0

    total = 0.0
    for stat_col, pts_per in rules.items():
        if isinstance(player_stat_row, dict):
            val = player_stat_row.get(stat_col, 0) or 0
        else:
            val = getattr(player_stat_row, stat_col, 0) or 0
        total += val * pts_per
    return round(total, 1)


def update_league_settings(league_id, **kwargs):
    """Update league settings. Only updates provided kwargs."""
    league = db.session.get(League, league_id)
    if not league:
        return None
    for key, val in kwargs.items():
        if hasattr(league, key):
            setattr(league, key, val)
    db.session.commit()
    return league


def update_position_slots(league_id, slots_list):
    """Update position slots for a league.
    slots_list: [{"position_code": "DEF", "count": 6, "is_bench": False}, ...]
    """
    LeaguePositionSlot.query.filter_by(league_id=league_id).delete()
    for slot_data in slots_list:
        slot = LeaguePositionSlot(
            league_id=league_id,
            position_code=slot_data["position_code"],
            count=slot_data["count"],
            is_bench=slot_data.get("is_bench", False),
        )
        db.session.add(slot)
    db.session.commit()


def update_draft_weights(league_id, weights_dict):
    """Update draft ranking weights for a league."""
    weights = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
    if not weights:
        weights = LeagueDraftWeights(league_id=league_id)
        db.session.add(weights)
    for key, val in weights_dict.items():
        if hasattr(weights, key):
            setattr(weights, key, float(val))
    db.session.commit()
    return weights

"""Season management: delist periods, delisting, supplemental drafts, LTIL, SSP, season config."""

from datetime import datetime, timezone

from models.database import (
    db, DelistPeriod, DelistAction, FantasyTeam, FantasyRoster,
    League, SeasonConfig, DraftSession, LongTermInjury, AflPlayer,
    FutureDraftPick,
)


def get_or_create_season_config(league_id, year):
    """Get or create a season config for a league/year."""
    config = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    if not config:
        config = SeasonConfig(league_id=league_id, year=year)
        db.session.add(config)
        db.session.commit()
    return config


def update_season_config(league_id, year, **kwargs):
    """Update season config fields."""
    config = get_or_create_season_config(league_id, year)
    for key, val in kwargs.items():
        if hasattr(config, key):
            setattr(config, key, val)
    db.session.commit()
    return config


def open_delist_period(league_id, year, opens_at=None, closes_at=None, min_delists=3):
    """Open a delist period for the league."""
    existing = DelistPeriod.query.filter_by(
        league_id=league_id, year=year, status="open"
    ).first()
    if existing:
        return existing, "A delist period is already open."

    period = DelistPeriod(
        league_id=league_id,
        year=year,
        status="open",
        opens_at=opens_at or datetime.now(timezone.utc),
        closes_at=closes_at,
        min_delists=min_delists,
    )
    db.session.add(period)
    db.session.commit()
    return period, None


def close_delist_period(period_id):
    """Close a delist period. Validates minimum delists have been met."""
    period = db.session.get(DelistPeriod, period_id)
    if not period:
        return None, "Delist period not found."
    if period.status != "open":
        return None, "Delist period is not open."

    # Check all teams have met minimum delists
    league = db.session.get(League, period.league_id)
    teams = FantasyTeam.query.filter_by(league_id=period.league_id).all()
    violations = []
    for team in teams:
        count = DelistAction.query.filter_by(
            delist_period_id=period_id, team_id=team.id
        ).count()
        if count < period.min_delists:
            violations.append(f"{team.name}: {count}/{period.min_delists}")

    if violations:
        return None, f"Teams haven't met minimum delists: {', '.join(violations)}"

    period.status = "closed"
    db.session.commit()
    return period, None


def delist_player(period_id, team_id, player_id):
    """Delist a player from a team during an open delist period.
    Returns (action, None) on success or (None, error_msg) on failure.
    """
    period = db.session.get(DelistPeriod, period_id)
    if not period or period.status != "open":
        return None, "Delist period is not open."

    # Verify player is on the team
    roster_entry = FantasyRoster.query.filter_by(
        team_id=team_id, player_id=player_id, is_active=True
    ).first()
    if not roster_entry:
        return None, "Player is not on your active roster."

    # Check not already delisted this period
    existing = DelistAction.query.filter_by(
        delist_period_id=period_id, team_id=team_id, player_id=player_id
    ).first()
    if existing:
        return None, "Player already delisted this period."

    # Deactivate from roster
    roster_entry.is_active = False

    action = DelistAction(
        delist_period_id=period_id,
        team_id=team_id,
        player_id=player_id,
    )
    db.session.add(action)
    db.session.commit()
    return action, None


def get_delist_summary(period_id):
    """Get summary of all delists in a period, grouped by team."""
    actions = DelistAction.query.filter_by(delist_period_id=period_id).all()
    summary = {}
    for a in actions:
        if a.team_id not in summary:
            summary[a.team_id] = []
        summary[a.team_id].append(a)
    return summary


def get_team_delists(period_id, team_id):
    """Get all delists for a specific team in a period."""
    return DelistAction.query.filter_by(
        delist_period_id=period_id, team_id=team_id
    ).all()


def generate_future_picks(league_id, start_year, num_years=3):
    """Generate future draft pick records for a league.

    For each year in range and each team, creates FutureDraftPick records.
    Number of rounds = league.squad_size (same as initial draft).
    Only generates if not already existing for that year.
    """
    league = db.session.get(League, league_id)
    if not league:
        return 0

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    if not teams:
        return 0

    total_rounds = league.squad_size or 38
    created = 0

    for year in range(start_year, start_year + num_years):
        # Check if picks already exist for this year
        existing = FutureDraftPick.query.filter_by(
            league_id=league_id, year=year
        ).first()
        if existing:
            continue

        for team in teams:
            for rnd in range(1, total_rounds + 1):
                pick = FutureDraftPick(
                    league_id=league_id,
                    year=year,
                    round_number=rnd,
                    original_team_id=team.id,
                    current_owner_id=team.id,
                )
                db.session.add(pick)
                created += 1

    if created:
        db.session.commit()
    return created


def create_supplemental_draft(league_id):
    """Create a supplemental draft session using the existing Phase 2 infrastructure.
    This is a mini-draft for teams to pick up delisted players.

    Preserves the original draft session — creates a new one alongside it
    with draft_round_type='supplemental'.
    """
    from models.draft_live import create_draft_session

    league = db.session.get(League, league_id)
    if not league:
        return None, "League not found."

    # Check for in-progress drafts (can't start a new one)
    active = DraftSession.query.filter_by(
        league_id=league_id, status="in_progress"
    ).first()
    if active:
        return None, "A draft is already in progress."

    # Determine how many supplemental rounds are needed
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    max_roster = max(
        FantasyRoster.query.filter_by(team_id=t.id, is_active=True).count()
        for t in teams
    ) if teams else 0
    supplemental_rounds = league.squad_size - max_roster

    if supplemental_rounds <= 0:
        return None, "All teams are at full squad size."

    session, error = create_draft_session(
        league_id,
        supplemental=True,
        total_rounds_override=supplemental_rounds,
    )

    if error:
        return None, error

    db.session.commit()

    return session, error


# ── Long-Term Injury List (LTIL) ────────────────────────────────────


def get_team_ltil(team_id, year=None):
    """Get all active LTIL entries for a team (optionally filtered by year)."""
    q = LongTermInjury.query.filter_by(team_id=team_id, removed_at=None)
    if year:
        q = q.filter_by(year=year)
    return q.all()


def get_league_ltil(league_id, year=None):
    """Get all active LTIL entries for a league."""
    q = LongTermInjury.query.filter_by(league_id=league_id, removed_at=None)
    if year:
        q = q.filter_by(year=year)
    return q.all()


def add_to_ltil(team_id, player_id, league_id, year):
    """Place a player on the long-term injury list.

    Removes the player from the active roster position (marks as injured).
    Returns (ltil_entry, None) on success or (None, error_msg) on failure.
    """
    # Check player is on the team's active roster
    roster_entry = FantasyRoster.query.filter_by(
        team_id=team_id, player_id=player_id, is_active=True
    ).first()
    if not roster_entry:
        return None, "Player is not on your active roster."

    # Check not already on LTIL
    existing = LongTermInjury.query.filter_by(
        team_id=team_id, player_id=player_id, removed_at=None
    ).first()
    if existing:
        return None, "Player is already on the long-term injury list."

    # Check SSP slot limit
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    max_slots = season_cfg.ssp_slots if season_cfg and season_cfg.ssp_slots else 1
    current_ltil = LongTermInjury.query.filter_by(
        team_id=team_id, year=year, removed_at=None
    ).count()
    if current_ltil >= max_slots:
        return None, f"Maximum LTIL slots reached ({max_slots})."

    # Move player off active lineup (keep on roster but bench them)
    roster_entry.is_benched = True
    roster_entry.position_code = None
    roster_entry.is_captain = False
    roster_entry.is_vice_captain = False
    roster_entry.is_emergency = False

    ltil = LongTermInjury(
        league_id=league_id,
        team_id=team_id,
        player_id=player_id,
        year=year,
    )
    db.session.add(ltil)
    db.session.commit()
    return ltil, None


def remove_from_ltil(team_id, player_id, league_id=None):
    """Remove a player from the long-term injury list.

    Only allowed when the league status is 'offseason' or 'setup'.
    If a replacement player was selected via SSP, the replacement is dropped
    from the team's roster.
    Returns (ltil_entry, None) on success or (None, error_msg) on failure.
    """
    if league_id:
        league = db.session.get(League, league_id)
        if league and league.status not in ("offseason", "setup"):
            return None, "Players can only be removed from LTIL during the off-season."

    ltil = LongTermInjury.query.filter_by(
        team_id=team_id, player_id=player_id, removed_at=None
    ).first()
    if not ltil:
        return None, "Player is not on the long-term injury list."

    ltil.removed_at = datetime.now(timezone.utc)

    # If a replacement player was picked via SSP, drop them
    if ltil.replacement_player_id:
        replacement_roster = FantasyRoster.query.filter_by(
            team_id=team_id, player_id=ltil.replacement_player_id, is_active=True
        ).first()
        if replacement_roster:
            replacement_roster.is_active = False

    db.session.commit()
    return ltil, None


def ssp_select_replacement(team_id, ltil_id, replacement_player_id, league_id):
    """SSP: Select a replacement player from the unrostered pool for an LTIL player.

    Validates SSP window dates if configured.
    Returns (ltil_entry, None) on success or (None, error_msg) on failure.
    """
    # Check SSP window if configured
    ltil_entry = db.session.get(LongTermInjury, ltil_id)
    if ltil_entry:
        season_cfg = SeasonConfig.query.filter_by(
            league_id=league_id, year=ltil_entry.year
        ).first()
        if season_cfg and season_cfg.ssp_window_open and season_cfg.ssp_window_close:
            now = datetime.now(timezone.utc)
            if now < season_cfg.ssp_window_open or now > season_cfg.ssp_window_close:
                return None, "SSP window is not currently open."

    ltil = db.session.get(LongTermInjury, ltil_id)
    if not ltil or ltil.team_id != team_id or ltil.removed_at is not None:
        return None, "Invalid LTIL entry."

    if ltil.replacement_player_id:
        return None, "A replacement has already been selected for this LTIL entry."

    # Check the replacement player exists and is unrostered in this league
    player = db.session.get(AflPlayer, replacement_player_id)
    if not player:
        return None, "Player not found."

    rostered = (
        FantasyRoster.query
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyRoster.player_id == replacement_player_id,
            FantasyRoster.is_active == True,
        )
        .first()
    )
    if rostered:
        return None, "Player is already on a team's roster in this league."

    # Add to team roster
    roster_entry = FantasyRoster(
        team_id=team_id,
        player_id=replacement_player_id,
        acquired_via="ssp",
        is_active=True,
        is_benched=True,
    )
    db.session.add(roster_entry)

    # Record on the LTIL entry
    ltil.replacement_player_id = replacement_player_id
    db.session.commit()
    return ltil, None

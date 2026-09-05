"""Season management: delist periods, delisting, supplemental drafts, LTIL, SSP, season config."""

from datetime import datetime, timezone

from models.database import (
    db, DelistPeriod, DelistAction, FantasyTeam, FantasyRoster,
    League, SeasonConfig, DraftSession, LongTermInjury, AflPlayer,
    FutureDraftPick, Fixture, AflGame,
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


def open_delist_period(league_id, year, opens_at=None, closes_at=None,
                       min_delists=3, max_delists=None, period_type="offseason"):
    """Open a delist period for the league.
    max_delists: optional cap. NULL means no upper bound (back-compat for
    offseason where everyone needs to contract). Set to 2 for mid-season
    where teams can use a couple of slots to reshape but can't gut.
    """
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
        max_delists=max_delists,
        period_type=period_type,
    )
    db.session.add(period)
    db.session.commit()
    return period, None


DEFAULT_DRAFT_MIN_PICKS = 4


def delist_requirement(period, team_id, league=None, season_cfg=None):
    """What this team still has to cut, and the shape of the ask.

    An off-season period is not "cut N players" — it's "get your list down to a
    size that leaves room for the draft". A 47-man squad that cuts five is
    still one over, and a squad that came in small shouldn't be forced to cut
    the same five as everyone else. So the requirement is derived from the
    finishing size: squad_size minus the places reserved for draft picks.

    Mid-season periods keep the flat minimum — nobody is drafting mid-year.

    Returns dict(done, remaining, required, target_size, current_size, basis).
    """
    league = league or db.session.get(League, period.league_id)
    done = DelistAction.query.filter_by(
        delist_period_id=period.id, team_id=team_id
    ).count()
    current = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).count()

    if (period.period_type or "offseason") == "offseason":
        if season_cfg is None:
            season_cfg = SeasonConfig.query.filter_by(
                league_id=period.league_id, year=period.year
            ).first()
        reserve = (getattr(season_cfg, "offseason_draft_min_picks", None)
                   or DEFAULT_DRAFT_MIN_PICKS)
        target = max(0, (league.squad_size or 0) - reserve)
        remaining = max(0, current - target)
        return {
            "done": done, "remaining": remaining, "required": done + remaining,
            "target_size": target, "current_size": current,
            "draft_reserve": reserve, "basis": "squad_size",
        }

    required = period.min_delists or 0
    return {
        "done": done, "remaining": max(0, required - done), "required": required,
        "target_size": None, "current_size": current,
        "draft_reserve": 0, "basis": "min_delists",
    }


def close_delist_period(period_id):
    """Close a delist period. Validates every team has met its requirement."""
    period = db.session.get(DelistPeriod, period_id)
    if not period:
        return None, "Delist period not found."
    if period.status != "open":
        return None, "Delist period is not open."

    league = db.session.get(League, period.league_id)
    season_cfg = SeasonConfig.query.filter_by(
        league_id=period.league_id, year=period.year
    ).first()
    teams = FantasyTeam.query.filter_by(league_id=period.league_id).all()
    violations = []
    for team in teams:
        req = delist_requirement(period, team.id, league, season_cfg)
        if req["remaining"] > 0:
            if req["basis"] == "squad_size":
                violations.append(
                    f"{team.name}: {req['current_size']} listed, needs "
                    f"{req['target_size']} ({req['remaining']} to go)"
                )
            else:
                violations.append(f"{team.name}: {req['done']}/{req['required']}")

    if violations:
        return None, f"Teams haven't finished delisting: {', '.join(violations)}"

    period.status = "closed"
    db.session.commit()
    return period, None


def drop_player_from_future_7s(league_id, team_id, player_id, year):
    """Remove a player from a team's upcoming (current + future) 7s lineups
    after they leave the roster (delist / trade / commissioner move). Past
    completed rounds keep them for scoring history. No-op if the league
    runs no 7s comp. Caller is responsible for committing.
    """
    from models.database import Reserve7sLineup
    try:
        from blueprints.reserve7s import get_7s_target
        target_year, next_round, _ = get_7s_target(league_id, year)
    except Exception:
        return
    if next_round is None:
        return
    # Past rounds keep him for scoring history; everything from the round
    # currently being picked for onwards loses him. In the off-season that
    # target is next season's plan, so delisting also clears the ideation.
    Reserve7sLineup.query.filter(
        Reserve7sLineup.league_id == league_id,
        Reserve7sLineup.team_id == team_id,
        Reserve7sLineup.player_id == player_id,
        Reserve7sLineup.year == target_year,
        Reserve7sLineup.afl_round >= next_round,
    ).delete(synchronize_session=False)


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

    # Enforce per-period max-delists cap (mid-season windows cap at 2).
    # NULL on the period means no cap.
    if period.max_delists is not None:
        current_count = DelistAction.query.filter_by(
            delist_period_id=period_id, team_id=team_id
        ).count()
        if current_count >= period.max_delists:
            return None, (
                f"Already delisted {current_count} player(s) this period "
                f"(max {period.max_delists})."
            )

    # Deactivate from roster + drop from upcoming 7s lineups
    roster_entry.is_active = False
    drop_player_from_future_7s(period.league_id, team_id, player_id, period.year)

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


def get_team_ltil(team_id, year=None, include_pending=False):
    """Get active LTIL entries for a team (optionally filtered by year).
    By default only returns approved entries. Set include_pending=True for both."""
    q = LongTermInjury.query.filter_by(team_id=team_id, removed_at=None)
    if include_pending:
        q = q.filter(LongTermInjury.status.in_(["approved", "pending"]))
    else:
        q = q.filter_by(status="approved")
    if year:
        q = q.filter_by(year=year)
    return q.all()


def get_league_ltil(league_id, year=None, include_pending=False):
    """Get active LTIL entries for a league.
    By default only returns approved entries. Set include_pending=True for both."""
    q = LongTermInjury.query.filter_by(league_id=league_id, removed_at=None)
    if include_pending:
        q = q.filter(LongTermInjury.status.in_(["approved", "pending"]))
    else:
        q = q.filter_by(status="approved")
    if year:
        q = q.filter_by(year=year)
    return q.all()


def add_to_ltil(team_id, player_id, league_id, year):
    """Request to place a player on the long-term injury list.

    Creates a pending LTIL entry that requires commissioner approval.
    Player stays in their current position until approved.
    Returns (ltil_entry, None) on success or (None, error_msg) on failure.
    """
    # Check player is on the team's active roster
    roster_entry = FantasyRoster.query.filter_by(
        team_id=team_id, player_id=player_id, is_active=True
    ).first()
    if not roster_entry:
        return None, "Player is not on your active roster."

    # Check not already on LTIL (pending or approved)
    existing = LongTermInjury.query.filter_by(
        team_id=team_id, player_id=player_id, removed_at=None
    ).filter(LongTermInjury.status.in_(["pending", "approved"])).first()
    if existing:
        if existing.status == "pending":
            return None, "LTIL request already pending for this player."
        return None, "Player is already on the long-term injury list."

    # Check SSP round cutoff — bypassed during a mid-season trade
    # window so managers can list newly injured players during the
    # reshaping period (mirrors the relaxed remove_from_ltil rule).
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    league = db.session.get(League, league_id) if league_id else None
    trade_window_open = bool(league and league.trade_window_open)
    if season_cfg and season_cfg.ssp_cutoff_round and not trade_window_open:
        latest_completed = (
            db.session.query(db.func.max(Fixture.afl_round))
            .filter_by(league_id=league_id, year=year, status="completed", is_final=False)
            .scalar()
        ) or 0
        if latest_completed >= season_cfg.ssp_cutoff_round:
            return None, f"SSP window closed after round {season_cfg.ssp_cutoff_round}."

    # Check SSP slot limit (count pending + approved)
    max_slots = season_cfg.ssp_slots if season_cfg and season_cfg.ssp_slots else 1
    current_ltil = LongTermInjury.query.filter_by(
        team_id=team_id, year=year, removed_at=None
    ).filter(LongTermInjury.status.in_(["pending", "approved"])).count()
    if current_ltil >= max_slots:
        return None, f"Maximum LTIL slots reached ({max_slots})."

    # Do NOT bench the player — stays in position until commissioner approves
    ltil = LongTermInjury(
        league_id=league_id,
        team_id=team_id,
        player_id=player_id,
        year=year,
        status="pending",
    )
    db.session.add(ltil)
    db.session.commit()
    return ltil, None


def remove_from_ltil(team_id, player_id, league_id=None, commissioner_override=False):
    """Remove a player from the long-term injury list.

    Allowed during off-season / setup AT ANY TIME, and also during a
    mid-season trade window (so managers can reactivate a returning
    player as part of squad reshaping). Otherwise blocked unless
    commissioner_override=True.

    An SSP signing made while the player was listed is NOT a temporary cover —
    in this league he is a full member of the squad and stays on the list. So
    coming off the LTIL only restores the injured player; nobody is dropped for
    him, and the squad simply runs over the cap until the delist period sorts it.
    Returns (ltil_entry, None) on success or (None, error_msg) on failure.
    """
    if league_id and not commissioner_override:
        league = db.session.get(League, league_id)
        if league and league.status not in ("offseason", "setup"):
            # Mid-season carve-out: allow when a trade window is open,
            # since that's the only time roster reshaping is on the
            # table outside the offseason.
            if not (league and league.trade_window_open):
                return None, (
                    "Players can only be removed from LTIL during the off-season "
                    "or while a trade window is open."
                )

    ltil = LongTermInjury.query.filter_by(
        team_id=team_id, player_id=player_id, removed_at=None, status="approved"
    ).first()
    if not ltil:
        return None, "Player is not on the long-term injury list."

    ltil.removed_at = datetime.now(timezone.utc)
    db.session.commit()
    return ltil, None


def ssp_select_replacement(team_id, ltil_id, replacement_player_id, league_id):
    """SSP: sign a player from the unrostered pool while someone is on the LTIL.

    "Replacement" is a misnomer kept for the column name — the signing is a
    permanent squad member, not cover that expires. He is not dropped when the
    injured player comes back off the list.

    Validates the SSP window if configured.
    Returns (ltil_entry, None) on success or (None, error_msg) on failure.
    """
    # Check SSP round cutoff
    ltil_entry = db.session.get(LongTermInjury, ltil_id)
    if ltil_entry:
        season_cfg = SeasonConfig.query.filter_by(
            league_id=league_id, year=ltil_entry.year
        ).first()
        if season_cfg and season_cfg.ssp_cutoff_round:
            latest_completed = (
                db.session.query(db.func.max(Fixture.afl_round))
                .filter_by(league_id=league_id, year=ltil_entry.year, status="completed", is_final=False)
                .scalar()
            ) or 0
            if latest_completed >= season_cfg.ssp_cutoff_round:
                return None, f"SSP window closed after round {season_cfg.ssp_cutoff_round}."

    # An SSP replacement comes out of the unrostered pool, so it obeys exactly
    # the same window as a free-agent signing — in the off-season that means
    # after the draft, never before it.
    league = db.session.get(League, league_id)
    allowed, reason = pool_pickup_state(league)
    if not allowed:
        return None, reason

    ltil = db.session.get(LongTermInjury, ltil_id)
    if not ltil or ltil.team_id != team_id or ltil.removed_at is not None:
        return None, "Invalid LTIL entry."

    if ltil.status != "approved":
        return None, "LTIL entry must be approved before selecting a replacement."

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


def approve_ltil(ltil_id):
    """Commissioner approves a pending LTIL entry.

    Benches the player (clears position, captain/vc/emergency flags).
    Returns (ltil_entry, None) on success or (None, error_msg) on failure.
    """
    ltil = db.session.get(LongTermInjury, ltil_id)
    if not ltil:
        return None, "LTIL entry not found."
    if ltil.status != "pending":
        return None, "Only pending LTIL entries can be approved."

    # Bench the player
    roster_entry = FantasyRoster.query.filter_by(
        team_id=ltil.team_id, player_id=ltil.player_id, is_active=True
    ).first()
    if roster_entry:
        roster_entry.is_benched = True
        roster_entry.position_code = None
        roster_entry.is_captain = False
        roster_entry.is_vice_captain = False
        roster_entry.is_emergency = False

    ltil.status = "approved"
    ltil.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()
    return ltil, None


def reject_ltil(ltil_id):
    """Commissioner rejects a pending LTIL entry.

    Player stays in their current position.
    Returns (ltil_entry, None) on success or (None, error_msg) on failure.
    """
    ltil = db.session.get(LongTermInjury, ltil_id)
    if not ltil:
        return None, "LTIL entry not found."
    if ltil.status != "pending":
        return None, "Only pending LTIL entries can be rejected."

    ltil.status = "rejected"
    ltil.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()
    return ltil, None



def league_season_over(league_id, year):
    """True once the league has no round left to play this year.

    The AFL calendar keeps going after a league's home-and-away season ends —
    finals weeks still have scheduled games — so "is there an upcoming AFL
    round" is NOT the same question as "is there a round I'm still picking a
    side for". Anything that asks the user to select for a round (bye badges,
    lockouts, the 7s side) has to use this one instead.
    """
    return not (
        Fixture.query
        .filter(Fixture.league_id == league_id, Fixture.year == year)
        .filter(Fixture.status.in_(("scheduled", "live")))
        .first()
    )


LIVE_FIXTURE_STATUSES = ("scheduled", "live")


def team_round_is_consequential(team_id, afl_round, year):
    """Does this team have a match in this round whose result is still open?

    A lockout only exists to protect a match that counts. Once a team has no
    fixture left in the round -- knocked out of finals, sitting out a bye
    week, or the whole league season already done -- an AFL game kicking off
    decides nothing for them, so nothing of theirs should freeze. The AFL
    calendar rolling into September must not lock the managers who aren't
    playing that week.
    """
    if not team_id or afl_round is None:
        return False
    return bool(
        Fixture.query
        .filter(Fixture.year == year, Fixture.afl_round == afl_round)
        .filter(db.or_(Fixture.home_team_id == team_id,
                       Fixture.away_team_id == team_id))
        .filter(Fixture.status.in_(LIVE_FIXTURE_STATUSES))
        .first()
    )


def team_7s_round_is_consequential(team_id, afl_round, year):
    """The 7s equivalent of team_round_is_consequential.

    The 7s comp runs its own ladder and finals, so a team can be playing a
    live 7s match in a week its main side has nothing on, and vice versa.
    Each competition answers the lockout question for itself.
    """
    from models.database import Reserve7sFixture

    if not team_id or afl_round is None:
        return False
    return bool(
        Reserve7sFixture.query
        .filter(Reserve7sFixture.year == year,
                Reserve7sFixture.afl_round == afl_round)
        .filter(db.or_(Reserve7sFixture.home_team_id == team_id,
                       Reserve7sFixture.away_team_id == team_id))
        .filter(Reserve7sFixture.status.in_(LIVE_FIXTURE_STATUSES))
        .first()
    )


def teams_with_consequential_round(afl_round, year, statuses=LIVE_FIXTURE_STATUSES):
    """Every fantasy team with an open main-comp fixture in this AFL round.

    Pass statuses=None to get every team fixtured in the round regardless of
    result -- the difference between "has a match on" and "was ever down to
    play", which is what tells a team knocked out of the finals apart from one
    whose match this round has already been played and scored.
    """
    if afl_round is None:
        return set()
    q = (
        Fixture.query
        .filter(Fixture.year == year, Fixture.afl_round == afl_round)
    )
    if statuses is not None:
        q = q.filter(Fixture.status.in_(statuses))
    rows = q.all()
    ids = set()
    for f in rows:
        # Finals placeholders carry -1 until the bracket advances.
        if f.home_team_id and f.home_team_id > 0:
            ids.add(f.home_team_id)
        if f.away_team_id and f.away_team_id > 0:
            ids.add(f.away_team_id)
    return ids


# ── Player-pool signings (free agents / SSP) ─────────────────────────


def offseason_draft_done(league_id, year):
    """Has THIS off-season's draft actually been held?

    A completed supplemental draft from earlier in the year (the mid-season
    one) must not count, so the draft has to have finished after the
    off-season delist period opened.
    """
    period = (
        DelistPeriod.query
        .filter_by(league_id=league_id, year=year, period_type="offseason")
        .order_by(DelistPeriod.id.desc())
        .first()
    )
    since = period.opens_at if period else None

    q = DraftSession.query.filter_by(
        league_id=league_id, is_mock=False, status="completed",
    ).filter(DraftSession.draft_round_type == "supplemental")
    for ds in q.order_by(DraftSession.id.desc()).all():
        if not since:
            return True
        done = ds.completed_at
        if done is None:
            continue
        if done.tzinfo is None:
            done = done.replace(tzinfo=timezone.utc)
        anchor = since if since.tzinfo else since.replace(tzinfo=timezone.utc)
        if done >= anchor:
            return True
    return False


def pool_pickup_state(league):
    """Can players be signed out of the unrostered pool right now?

    Returns (allowed, reason). The pool is never a free-for-all — squad spots
    are filled at the draft. It opens in exactly two places:

      - early in the season, as short-term cover before the SSP cutoff round;
      - in the off-season, ONLY once the draft has actually been held.

    That second rule is the important one: delisting drops every list below
    the cap, and without this the pool would be open slather the moment the
    cuts land, before anyone gets to the draft table.
    """
    if not league:
        return False, "League not found."

    if league.status in ("setup", "drafting"):
        return False, "Squads are built at the draft, not from the pool."

    active_draft = DraftSession.query.filter_by(
        league_id=league.id, is_mock=False, status="in_progress",
    ).first()
    if active_draft:
        return False, "A draft is in progress."

    cfg = SeasonConfig.query.filter_by(
        league_id=league.id, year=league.season_year
    ).first()
    phase = (cfg.season_phase if cfg else None) or "regular"
    in_offseason = league.status == "offseason" or phase == "offseason"

    if in_offseason:
        if offseason_draft_done(league.id, league.season_year):
            return True, None
        when = cfg.supplemental_draft_date if cfg else None
        if when:
            return False, (
                "Free agents and SSP signings open after the draft on "
                f"{when.strftime('%d %b %Y')}."
            )
        return False, (
            "Free agents and SSP signings open after the draft. "
            "The commissioner hasn't set a draft date yet."
        )

    # In-season: the pool is short-term injury cover only, and closes once a
    # trade window opens (spots then fill via the mid-season draft).
    if league.trade_window_open:
        return False, (
            "Free-agent pickups are paused — squad spots fill via the "
            "upcoming draft, not the player pool."
        )

    cutoff = (cfg.ssp_cutoff_round if cfg and cfg.ssp_cutoff_round else 4)
    latest = (
        AflGame.query
        .filter_by(year=league.season_year, status="complete")
        .order_by(AflGame.afl_round.desc())
        .first()
    )
    current_round = latest.afl_round if latest else 0
    if current_round >= cutoff:
        return False, f"SSP pickup window closed after Round {cutoff}."

    return True, None

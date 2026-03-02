"""Live draft session management: creation, pick order, making picks, auto-pick, queues."""

import threading
from datetime import datetime, timezone

from models.database import (
    db, DraftSession, DraftPick, DraftQueue,
    FantasyTeam, FantasyRoster, AflPlayer, League,
    LeaguePositionSlot,
)

# Thread lock for SQLite concurrency safety during picks
_pick_lock = threading.Lock()


def create_draft_session(league_id, supplemental=False, total_rounds_override=None,
                         is_mock=False):
    """Create a draft session with all pick slots pre-generated.
    Returns (session, None) on success or (None, error_msg) on failure.
    """
    league = db.session.get(League, league_id)
    if not league:
        return None, "League not found."

    if not is_mock:
        if not supplemental:
            # Check if initial session already exists
            existing = DraftSession.query.filter_by(
                league_id=league_id, draft_round_type="initial", is_mock=False,
            ).first()
            if existing:
                return None, "Draft session already exists for this league."
        else:
            # Check that initial draft is completed
            initial = DraftSession.query.filter_by(
                league_id=league_id, draft_round_type="initial", is_mock=False,
            ).first()
            if not initial or initial.status != "completed":
                return None, "Initial draft must be completed before scheduling a supplemental draft."
            # Check no active supplemental draft
            active_supp = DraftSession.query.filter_by(
                league_id=league_id, draft_round_type="supplemental", is_mock=False,
            ).filter(DraftSession.status.notin_(["completed"])).first()
            if active_supp:
                return None, "A supplemental draft is already in progress."

    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.draft_order).all()
    if not teams:
        return None, "No teams in the league."

    total_rounds = total_rounds_override or league.squad_size

    session = DraftSession(
        league_id=league_id,
        draft_type=league.draft_type,
        draft_round_type="supplemental" if supplemental else "initial",
        pick_timer_secs=league.pick_timer_secs,
        total_rounds=total_rounds,
        is_mock=is_mock,
    )
    db.session.add(session)
    db.session.flush()

    # Pre-generate all pick slots
    pick_number = 1
    for rnd in range(1, total_rounds + 1):
        order = _get_round_order(teams, rnd, league.draft_type)
        for team in order:
            pick = DraftPick(
                draft_session_id=session.id,
                pick_number=pick_number,
                draft_round=rnd,
                team_id=team.id,
            )
            db.session.add(pick)
            pick_number += 1

    db.session.commit()
    return session, None


def _get_round_order(teams, round_num, draft_type):
    """Return team order for a given round. Snake reverses odd/even rounds."""
    if draft_type == "snake" and round_num % 2 == 0:
        return list(reversed(teams))
    return list(teams)


def get_draft_state(session_id):
    """Get the full current state of a draft session for client sync."""
    session = db.session.get(DraftSession, session_id)
    if not session:
        return None

    picks = DraftPick.query.filter_by(draft_session_id=session_id).order_by(DraftPick.pick_number).all()
    current_pick = next((p for p in picks if p.player_id is None and not p.is_pass), None)

    # Get teams
    teams = FantasyTeam.query.filter_by(league_id=session.league_id).order_by(FantasyTeam.draft_order).all()

    # Picked player IDs
    picked_ids = {p.player_id for p in picks if p.player_id is not None}

    # Timer remaining (imported lazily to avoid circular imports)
    try:
        from sockets.draft_events import get_timer_remaining
        timer_remaining = get_timer_remaining(session_id)
    except ImportError:
        timer_remaining = None

    return {
        "session_id": session.id,
        "league_id": session.league_id,
        "status": session.status,
        "draft_type": session.draft_type,
        "draft_round_type": session.draft_round_type,
        "is_mock": session.is_mock,
        "pick_timer_secs": session.pick_timer_secs,
        "timer_remaining": timer_remaining,
        "current_pick": current_pick.pick_number if current_pick else None,
        "current_round": current_pick.draft_round if current_pick else session.total_rounds,
        "current_team_id": current_pick.team_id if current_pick else None,
        "current_team_name": current_pick.team.name if current_pick else None,
        "total_rounds": session.total_rounds,
        "total_picks": len(picks),
        "picks_made": len([p for p in picks if p.player_id is not None or p.is_pass]),
        "teams": [{"id": t.id, "name": t.name, "owner_id": t.owner_id,
                    "draft_order": t.draft_order} for t in teams],
        "pick_history": [
            {
                "pick_number": p.pick_number,
                "round": p.draft_round,
                "team_id": p.team_id,
                "team_name": p.team.name,
                "player_id": p.player_id,
                "player_name": p.player.name if p.player else None,
                "player_position": p.player.position if p.player else None,
                "player_afl_team": p.player.afl_team if p.player else None,
                "is_auto_pick": p.is_auto_pick,
                "is_pass": p.is_pass,
            }
            for p in picks if p.player_id is not None or p.is_pass
        ],
        "picked_player_ids": list(picked_ids),
    }


def start_draft(session_id):
    """Move draft status to in_progress."""
    session = db.session.get(DraftSession, session_id)
    if not session:
        return None, "Session not found."
    if session.status not in ("scheduled", "paused"):
        return None, f"Cannot start draft in '{session.status}' status."

    session.status = "in_progress"
    session.started_at = session.started_at or datetime.now(timezone.utc)
    # Update league status (skip for mock drafts)
    if not session.is_mock:
        league = db.session.get(League, session.league_id)
        if league:
            league.status = "drafting"
    db.session.commit()
    return session, None


def pause_draft(session_id):
    """Pause an in-progress draft."""
    session = db.session.get(DraftSession, session_id)
    if not session or session.status != "in_progress":
        return None, "Draft is not in progress."
    session.status = "paused"
    db.session.commit()
    return session, None


def resume_draft(session_id):
    """Resume a paused draft."""
    session = db.session.get(DraftSession, session_id)
    if not session or session.status != "paused":
        return None, "Draft is not paused."
    session.status = "in_progress"
    db.session.commit()
    return session, None


def make_pick(session_id, player_id, is_auto=False):
    """Make a draft pick. Thread-safe with lock.
    Returns (pick, None) on success or (None, error_msg) on failure.
    """
    with _pick_lock:
        session = db.session.get(DraftSession, session_id)
        if not session or session.status != "in_progress":
            return None, "Draft is not in progress."
        # Refresh to get latest DB state inside the lock
        db.session.refresh(session)
        if session.status != "in_progress":
            return None, "Draft is not in progress."

        # Find current pick (first unpicked, not passed)
        current_pick = (
            DraftPick.query
            .filter_by(draft_session_id=session_id, player_id=None)
            .filter(DraftPick.is_pass == False)
            .order_by(DraftPick.pick_number)
            .first()
        )
        if not current_pick:
            return None, "All picks have been made."

        # Verify player is available
        already_picked = db.session.query(DraftPick.player_id).filter(
            DraftPick.draft_session_id == session_id,
            DraftPick.player_id.isnot(None),
        ).all()
        picked_ids = {row[0] for row in already_picked}
        if player_id in picked_ids:
            return None, "Player has already been picked."

        # Verify player exists
        player = db.session.get(AflPlayer, player_id)
        if not player:
            return None, "Player not found."

        # Make the pick
        current_pick.player_id = player_id
        current_pick.is_auto_pick = is_auto
        current_pick.picked_at = datetime.now(timezone.utc)

        # Add to fantasy roster (skip for mock drafts)
        if not session.is_mock:
            acquired = "supplemental" if session.draft_round_type == "supplemental" else "draft"
            roster_entry = FantasyRoster(
                team_id=current_pick.team_id,
                player_id=player_id,
                acquired_via=acquired,
            )
            db.session.add(roster_entry)

        # Remove from all queues
        DraftQueue.query.filter_by(player_id=player_id).delete()

        # Check if draft is complete (exclude passed picks)
        remaining = (
            DraftPick.query
            .filter_by(draft_session_id=session_id, player_id=None)
            .filter(DraftPick.is_pass == False)
            .count()
        )
        if remaining == 0:
            session.status = "completed"
            session.completed_at = datetime.now(timezone.utc)
            if not session.is_mock:
                league = db.session.get(League, session.league_id)
                if league:
                    league.status = "active"

        db.session.commit()

        return current_pick, None


def undo_pick(session_id):
    """Undo the last pick in the draft. Commissioner only.
    Returns (undone_pick, None) on success or (None, error_msg) on failure.
    """
    with _pick_lock:
        session = db.session.get(DraftSession, session_id)
        if not session or session.status not in ("in_progress", "paused"):
            return None, "Draft is not active."

        # Find the last completed pick
        last_pick = (
            DraftPick.query
            .filter_by(draft_session_id=session_id)
            .filter(db.or_(DraftPick.player_id.isnot(None), DraftPick.is_pass == True))
            .order_by(DraftPick.pick_number.desc())
            .first()
        )
        if not last_pick:
            return None, "No picks to undo."

        player_id = last_pick.player_id
        player_name = last_pick.player.name if last_pick.player else "PASS"
        team_name = last_pick.team.name if last_pick.team else "Unknown"

        # Remove from roster if it was a real pick (not pass, not mock)
        if player_id and not session.is_mock:
            FantasyRoster.query.filter_by(
                team_id=last_pick.team_id, player_id=player_id
            ).delete()

        # Reset the pick
        last_pick.player_id = None
        last_pick.is_auto_pick = False
        last_pick.is_pass = False
        last_pick.picked_at = None

        db.session.commit()
        return {"pick_number": last_pick.pick_number, "player_name": player_name,
                "team_name": team_name}, None


def pass_pick(session_id):
    """Pass on the current pick (supplemental drafts only).
    Marks the pick as passed (no player selected) and advances to next pick.
    Returns (pick, None) on success or (None, error_msg) on failure.
    """
    with _pick_lock:
        session = db.session.get(DraftSession, session_id)
        if not session or session.status != "in_progress":
            return None, "Draft is not in progress."

        if session.draft_round_type != "supplemental":
            return None, "Passing is only allowed in supplemental drafts."

        # Find current pick (first unpicked and not passed)
        current_pick = (
            DraftPick.query
            .filter_by(draft_session_id=session_id, player_id=None)
            .filter(DraftPick.is_pass == False)
            .order_by(DraftPick.pick_number)
            .first()
        )
        if not current_pick:
            return None, "All picks have been made."

        # Mark as passed
        current_pick.is_pass = True
        current_pick.picked_at = datetime.now(timezone.utc)

        # Check if draft is complete (all picks either have a player or are passed)
        remaining = (
            DraftPick.query
            .filter_by(draft_session_id=session_id, player_id=None)
            .filter(DraftPick.is_pass == False)
            .count()
        )
        if remaining == 0:
            session.status = "completed"
            session.completed_at = datetime.now(timezone.utc)
            if not session.is_mock:
                league = db.session.get(League, session.league_id)
                if league:
                    league.status = "active"

        db.session.commit()

        return current_pick, None


def end_draft(session_id):
    """End a draft early (commissioner action).

    Marks all remaining unpicked slots as passed and completes the session.
    Returns (session, None) on success or (None, error_msg) on failure.
    """
    with _pick_lock:
        session = db.session.get(DraftSession, session_id)
        if not session or session.status not in ("in_progress", "paused"):
            return None, "Draft is not active."

        # Mark all remaining unpicked slots as passed
        remaining_picks = (
            DraftPick.query
            .filter_by(draft_session_id=session_id, player_id=None)
            .filter(DraftPick.is_pass == False)
            .all()
        )
        now = datetime.now(timezone.utc)
        for pick in remaining_picks:
            pick.is_pass = True
            pick.picked_at = now

        session.status = "completed"
        session.completed_at = now
        if not session.is_mock:
            league = db.session.get(League, session.league_id)
            if league:
                league.status = "active"

        db.session.commit()
        return session, None


def get_position_needs(league_id, session_id, team_id):
    """Calculate remaining position needs for a team during a draft.

    Returns dict with required/drafted counts, remaining picks, and blocked positions.
    A position is blocked when picking another player of that position would make it
    impossible to fill all required roster slots.
    """
    slots = LeaguePositionSlot.query.filter_by(league_id=league_id).all()

    # Sum required per position (on-field starters only — bench/reserves can be anyone)
    required = {}
    flex_count = 0
    for s in slots:
        code = s.position_code.upper()
        if s.is_bench or code in ("FLEX", "UTIL", "BENCH"):
            flex_count += s.count
        else:
            required[code] = required.get(code, 0) + s.count

    # Get team's completed picks in this draft
    picks = (
        DraftPick.query
        .filter_by(draft_session_id=session_id, team_id=team_id)
        .filter(DraftPick.player_id.isnot(None))
        .all()
    )

    # Count drafted by primary position (first in "DEF/MID" etc.)
    drafted = {}
    for pick in picks:
        player = db.session.get(AflPlayer, pick.player_id)
        if player and player.position:
            primary = player.position.split("/")[0].upper()
            drafted[primary] = drafted.get(primary, 0) + 1

    # Remaining position needs
    needs = {}
    for pos, req in required.items():
        needs[pos] = max(0, req - drafted.get(pos, 0))

    total_mandatory = sum(needs.values())

    # Remaining picks for this team
    session = db.session.get(DraftSession, session_id)
    remaining_picks = (session.total_rounds if session else 0) - len(picks)

    # Determine blocked positions
    blocked = set()
    if total_mandatory >= remaining_picks and remaining_picks > 0:
        # Every remaining pick must fill a mandatory need
        for pos in ("DEF", "MID", "FWD", "RUC"):
            if needs.get(pos, 0) == 0:
                blocked.add(pos)

    return {
        "required": required,
        "drafted": drafted,
        "needs": needs,
        "flex_count": flex_count,
        "total_mandatory": total_mandatory,
        "remaining_picks": remaining_picks,
        "blocked_positions": sorted(blocked),
    }


def _player_position_allowed(player, blocked_positions):
    """Check if a player can be drafted given blocked positions.

    A multi-position player (e.g. DEF/MID) is allowed if ANY of their
    positions is not blocked.
    """
    if not blocked_positions:
        return True
    if not player.position:
        return True
    positions = [p.strip().upper() for p in player.position.split("/")]
    return any(pos not in blocked_positions for pos in positions)


def auto_pick(session_id, team_id):
    """Auto-pick for a team: use their queue first, then highest-ranked available player.
    Respects position limits — won't pick a position that would make it impossible
    to fill required roster slots.
    """
    session = db.session.get(DraftSession, session_id)
    if not session:
        return None, "No draft session."

    # Get position constraints
    pos_needs = get_position_needs(session.league_id, session_id, team_id)
    blocked = set(pos_needs["blocked_positions"])

    # Check queue first
    queue_entries = (
        DraftQueue.query
        .filter_by(team_id=team_id)
        .order_by(DraftQueue.priority)
        .all()
    )

    already_picked = db.session.query(DraftPick.player_id).filter(
        DraftPick.draft_session_id == session_id,
        DraftPick.player_id.isnot(None),
    ).all()
    picked_ids = {row[0] for row in already_picked}

    for queue_entry in queue_entries:
        if queue_entry.player_id not in picked_ids:
            player = db.session.get(AflPlayer, queue_entry.player_id)
            if player and _player_position_allowed(player, blocked):
                return make_pick(session_id, queue_entry.player_id, is_auto=True)

    # Fallback: pick highest draft_score available player respecting position limits
    query = AflPlayer.query
    if picked_ids:
        query = query.filter(AflPlayer.id.notin_(picked_ids))
    candidates = query.order_by(AflPlayer.draft_score.desc().nullslast()).limit(50).all()

    for player in candidates:
        if _player_position_allowed(player, blocked):
            return make_pick(session_id, player.id, is_auto=True)

    # If all blocked, fall back to any player (shouldn't happen in practice)
    if candidates:
        return make_pick(session_id, candidates[0].id, is_auto=True)

    return None, "No players available for auto-pick."


def get_available_players(session_id, search=None, position=None, limit=100):
    """Get players not yet drafted in this session.
    For supplemental drafts, also excludes players already on active rosters.
    """
    session = db.session.get(DraftSession, session_id)

    # Players picked in this session
    already_picked = db.session.query(DraftPick.player_id).filter(
        DraftPick.draft_session_id == session_id,
        DraftPick.player_id.isnot(None),
    ).all()
    picked_ids = {row[0] for row in already_picked}

    # For supplemental drafts, also exclude players on active rosters in this league
    if session and session.draft_round_type == "supplemental":
        rostered = db.session.query(FantasyRoster.player_id).join(
            FantasyTeam, FantasyRoster.team_id == FantasyTeam.id
        ).filter(
            FantasyTeam.league_id == session.league_id,
            FantasyRoster.is_active == True,
        ).all()
        picked_ids.update(row[0] for row in rostered)

    query = AflPlayer.query
    if picked_ids:
        query = query.filter(AflPlayer.id.notin_(picked_ids))
    if search:
        query = query.filter(AflPlayer.name.ilike(f"%{search}%"))
    if position:
        query = query.filter(AflPlayer.position.ilike(f"%{position}%"))

    return query.order_by(AflPlayer.draft_score.desc().nullslast()).limit(limit).all()


def get_team_draft_picks(session_id, team_id):
    """Get all picks made by a specific team."""
    return (
        DraftPick.query
        .filter_by(draft_session_id=session_id, team_id=team_id)
        .filter(DraftPick.player_id.isnot(None))
        .order_by(DraftPick.pick_number)
        .all()
    )


# ── Queue management ────────────────────────────────────────────────


def set_queue(team_id, player_ids):
    """Set the draft queue for a team. Replaces any existing queue."""
    DraftQueue.query.filter_by(team_id=team_id).delete()
    for i, pid in enumerate(player_ids):
        entry = DraftQueue(team_id=team_id, player_id=pid, priority=i + 1)
        db.session.add(entry)
    db.session.commit()


def get_queue(team_id):
    """Get the draft queue for a team, ordered by priority."""
    return (
        DraftQueue.query
        .filter_by(team_id=team_id)
        .order_by(DraftQueue.priority)
        .all()
    )


def add_to_queue(team_id, player_id):
    """Add a player to the end of a team's queue."""
    max_priority = db.session.query(db.func.max(DraftQueue.priority)).filter_by(team_id=team_id).scalar() or 0
    entry = DraftQueue(team_id=team_id, player_id=player_id, priority=max_priority + 1)
    db.session.add(entry)
    db.session.commit()


def remove_from_queue(team_id, player_id):
    """Remove a player from a team's queue."""
    DraftQueue.query.filter_by(team_id=team_id, player_id=player_id).delete()
    db.session.commit()


def randomize_draft_order(league_id):
    """Randomize the draft order for all teams in a league."""
    import random
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    random.shuffle(teams)
    for i, team in enumerate(teams):
        team.draft_order = i + 1
    db.session.commit()
    return teams


# ── Mock draft helpers ─────────────────────────────────────────────


def restart_draft(league_id):
    """Delete the initial draft session, clear all drafted rosters, and reset league status.

    Only allowed before any fixture round has been scored.
    Returns (True, None) on success or (False, error_msg) on failure.
    """
    from models.database import Fixture

    # Check no fixtures have been played
    played = Fixture.query.filter_by(league_id=league_id).filter(
        Fixture.status == "completed"
    ).first()
    if played:
        return False, "Cannot restart draft — fixtures have already been played."

    # Find the initial draft session
    session = DraftSession.query.filter_by(
        league_id=league_id, draft_round_type="initial", is_mock=False,
    ).first()
    if not session:
        return False, "No draft session to restart."

    # Remove all roster entries that were added via draft for teams in this league
    team_ids = [t.id for t in FantasyTeam.query.filter_by(league_id=league_id).all()]
    if team_ids:
        FantasyRoster.query.filter(
            FantasyRoster.team_id.in_(team_ids),
            FantasyRoster.acquired_via.in_(("draft", "supplemental")),
        ).delete(synchronize_session="fetch")

    # Clear all draft queues for teams in this league
    if team_ids:
        DraftQueue.query.filter(DraftQueue.team_id.in_(team_ids)).delete(
            synchronize_session="fetch"
        )

    # Delete the draft session (cascade deletes picks)
    db.session.delete(session)

    # Also delete any supplemental sessions
    supps = DraftSession.query.filter_by(
        league_id=league_id, draft_round_type="supplemental", is_mock=False,
    ).all()
    for s in supps:
        db.session.delete(s)

    # Reset league status
    league = db.session.get(League, league_id)
    if league:
        league.status = "setup"

    db.session.commit()
    return True, None


def delete_mock_draft(session_id):
    """Delete a mock draft session and all its picks."""
    session = db.session.get(DraftSession, session_id)
    if not session or not session.is_mock:
        return False, "Not a mock draft session."
    db.session.delete(session)  # cascade deletes picks
    db.session.commit()
    return True, None


def reset_mock_draft(session_id):
    """Reset a mock draft: clear all picks and set status back to scheduled."""
    session = db.session.get(DraftSession, session_id)
    if not session or not session.is_mock:
        return None, "Not a mock draft session."
    # Clear all picks
    DraftPick.query.filter_by(draft_session_id=session_id).update(
        {"player_id": None, "is_auto_pick": False, "is_pass": False, "picked_at": None}
    )
    session.status = "scheduled"
    session.started_at = None
    session.completed_at = None
    db.session.commit()
    return session, None


def run_mock_auto_picks(session_id, user_team_id):
    """Auto-pick for all computer teams until it's the user's turn or draft is done.
    Returns list of picks made (for broadcasting).
    """
    picks_made = []
    for _ in range(500):  # safety limit
        session = db.session.get(DraftSession, session_id)
        if not session or session.status != "in_progress":
            break

        current_pick = (
            DraftPick.query
            .filter_by(draft_session_id=session_id, player_id=None)
            .order_by(DraftPick.pick_number)
            .first()
        )
        if not current_pick:
            break  # draft complete

        # Stop if it's the user's turn
        if current_pick.team_id == user_team_id:
            break

        # Auto-pick for this computer team
        pick, error = auto_pick(session_id, current_pick.team_id)
        if error or not pick:
            break

        picks_made.append({
            "pick_number": pick.pick_number,
            "round": pick.draft_round,
            "team_id": pick.team_id,
            "team_name": pick.team.name,
            "player_id": pick.player_id,
            "player_name": pick.player.name,
            "player_position": pick.player.position,
            "player_afl_team": pick.player.afl_team,
            "is_auto_pick": True,
        })

    return picks_made

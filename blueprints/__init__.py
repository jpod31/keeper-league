"""Blueprint package — shared helpers for league-scoped route guards."""

from flask import flash, redirect, url_for
from flask_login import current_user

from models.database import db, League, FantasyTeam


def check_league_access(league_id):
    """Check if the current user has access to a league.

    Access is granted if the user is:
      - a site admin (is_admin)
      - the league commissioner
      - an owner of a team in the league

    Returns:
        (league, user_team) on success — user_team may be None for
        commissioners/admins without a team.
        (None, None) if the league doesn't exist or access is denied.
    """
    league = db.session.get(League, league_id)
    if not league:
        return None, None

    # Site admins always pass
    if getattr(current_user, "is_admin", False):
        user_team = FantasyTeam.query.filter_by(
            league_id=league_id, owner_id=current_user.id
        ).first()
        return league, user_team

    # Commissioner always passes
    if league.commissioner_id == current_user.id:
        user_team = FantasyTeam.query.filter_by(
            league_id=league_id, owner_id=current_user.id
        ).first()
        return league, user_team

    # Regular member — must own a team
    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    if user_team:
        return league, user_team

    return None, None

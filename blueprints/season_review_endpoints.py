"""Season Review ("Wrapped") endpoint — registered onto the spa_api blueprint.

  GET /api/leagues/<id>/season-review[?year=YYYY]

"Has this user already seen it" is tracked client-side in localStorage, the
same way the round recap popup does it.
"""

import logging

from flask import jsonify, request
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam
from models.season_review import build_season_review, season_review_year

logger = logging.getLogger(__name__)


def register_season_review_endpoints(spa_api):
    @spa_api.route("/leagues/<int:league_id>/season-review")
    @login_required
    def season_review(league_id):
        league = db.session.get(League, league_id)
        if not league:
            return jsonify({"error": "Not found"}), 404

        team = FantasyTeam.query.filter_by(
            league_id=league_id, owner_id=current_user.id
        ).first()
        is_member = bool(team) or league.commissioner_id == current_user.id \
            or getattr(current_user, "is_admin", False)
        if not is_member:
            return jsonify({"error": "Forbidden"}), 403

        year = request.args.get("year", type=int) or season_review_year(league_id)
        if not year:
            return jsonify({"available": False, "year": None})

        try:
            payload = build_season_review(league_id, year,
                                          viewer_team_id=team.id if team else None)
        except Exception:
            logger.exception("season review build failed (league=%s year=%s)",
                             league_id, year)
            return jsonify({"available": False, "year": year,
                            "error": "Could not build the season review."}), 500

        if payload is None:
            return jsonify({"available": False, "year": year})
        return jsonify(payload)

"""SocketIO event handlers for live matchup score updates.

Follows the same pattern as sockets/draft_events.py.
Namespace: /matchups
Rooms: live_{league_id}_{afl_round}
"""

import logging

from flask_login import current_user
from flask_socketio import emit, join_room, leave_room

logger = logging.getLogger(__name__)


def register_matchup_events(socketio):
    """Register all SocketIO event handlers for live matchups."""

    @socketio.on("connect", namespace="/matchups")
    def handle_connect():
        if not current_user.is_authenticated:
            return False  # reject unauthenticated connections

    @socketio.on("join_live", namespace="/matchups")
    def handle_join(data):
        league_id = data.get("league_id")
        afl_round = data.get("afl_round")
        if not league_id or not afl_round:
            return

        room = f"live_{league_id}_{afl_round}"
        join_room(room)
        emit("joined", {"room": room, "message": "Connected to live scores"})

    @socketio.on("leave_live", namespace="/matchups")
    def handle_leave(data):
        league_id = data.get("league_id")
        afl_round = data.get("afl_round")
        if league_id and afl_round:
            leave_room(f"live_{league_id}_{afl_round}")

    @socketio.on("request_scores", namespace="/matchups")
    def handle_request_scores(data):
        """Client requests current scores (e.g. on reconnect)."""
        try:
            league_id = data.get("league_id")
            afl_round = data.get("afl_round")
            if not league_id or not afl_round:
                return

            from flask import current_app
            with current_app.app_context():
                from models.database import League, Fixture, RoundScore
                from models.live_sync import (
                    get_game_statuses, get_locked_player_ids,
                    get_player_score_breakdown,
                )

                league = League.query.get(league_id)
                if not league:
                    return

                year = league.season_year
                fixtures = Fixture.query.filter_by(
                    league_id=league_id, year=year, afl_round=afl_round
                ).all()

                fixture_list = []
                for f in fixtures:
                    home_rs = RoundScore.query.filter_by(
                        team_id=f.home_team_id, afl_round=afl_round, year=year
                    ).first()
                    away_rs = RoundScore.query.filter_by(
                        team_id=f.away_team_id, afl_round=afl_round, year=year
                    ).first()

                    fixture_list.append({
                        "fixture_id": f.id,
                        "home_score": home_rs.total_score if home_rs else 0,
                        "away_score": away_rs.total_score if away_rs else 0,
                        "home_captain_bonus": home_rs.captain_bonus if home_rs else 0,
                        "away_captain_bonus": away_rs.captain_bonus if away_rs else 0,
                        "home_players": get_player_score_breakdown(f.home_team_id, afl_round, year, league_id),
                        "away_players": get_player_score_breakdown(f.away_team_id, afl_round, year, league_id),
                    })

                payload = {
                    "fixtures": fixture_list,
                    "game_statuses": get_game_statuses(afl_round, year),
                    "locked_player_ids": list(get_locked_player_ids(afl_round, year)),
                }

                emit("score_update", payload)
        except Exception:
            logger.exception("Error in request_scores handler")
            emit("error", {"message": "Failed to load live scores"})

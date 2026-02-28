"""Matchups blueprint: fixtures, standings, scoring, finals, delist, live scoring."""

import logging

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, SeasonConfig, DelistPeriod, AflGame, LiveScoringConfig
from models.fixture_manager import (
    generate_round_robin, get_fixture, get_round_fixtures, get_matchup,
    generate_finals, get_finals,
)
from models.scoring_engine import (
    finalize_round, get_standings, get_live_scores,
    get_team_round_scores,
)
from models.season_manager import (
    get_or_create_season_config, update_season_config,
    open_delist_period, close_delist_period, delist_player,
    get_delist_summary, get_team_delists,
)
from models.live_sync import (
    get_locked_player_ids, get_game_statuses, get_player_score_breakdown,
)
from models.database import Fixture, FantasyRoster, RoundScore
from blueprints import check_league_access
from scrapers.squiggle import get_current_round
import config

logger = logging.getLogger(__name__)

matchups_bp = Blueprint("matchups", __name__, url_prefix="/leagues",
                        template_folder="../templates")


@matchups_bp.route("/<int:league_id>/fixture")
@login_required
def fixture_view(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    rounds = get_fixture(league_id, year)
    is_commissioner = league.commissioner_id == current_user.id

    return render_template("matchups/fixture.html",
                           league=league,
                           rounds=rounds,
                           is_commissioner=is_commissioner)


@matchups_bp.route("/<int:league_id>/fixture/generate", methods=["POST"])
@login_required
def generate_fixture(league_id):
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can generate fixtures.", "warning")
        return redirect(url_for("matchups.fixture_view", league_id=league_id))

    num_rounds = request.form.get("num_rounds", type=int) or 23
    fixtures, error = generate_round_robin(league_id, league.season_year, num_rounds)
    if error:
        flash(error, "danger")
    else:
        flash(f"Generated {len(fixtures)} fixtures across {num_rounds} rounds.", "success")
    return redirect(url_for("matchups.fixture_view", league_id=league_id))


@matchups_bp.route("/<int:league_id>/fixture/<int:afl_round>")
@login_required
def round_view(league_id, afl_round):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    fixtures = get_round_fixtures(league_id, league.season_year, afl_round)
    is_commissioner = league.commissioner_id == current_user.id

    return render_template("matchups/round.html",
                           league=league,
                           afl_round=afl_round,
                           fixtures=fixtures,
                           is_commissioner=is_commissioner,
                           max_round=config.SC_ROUNDS)


@matchups_bp.route("/<int:league_id>/matchup/<int:fixture_id>")
@login_required
def matchup_detail(league_id, fixture_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))
    fixture = get_matchup(fixture_id)
    if not fixture:
        flash("Matchup not found.", "warning")
        return redirect(url_for("matchups.fixture_view", league_id=league_id))

    uf_breakdown = None
    if league.scoring_type == "ultimate_footy" and fixture.status == "completed":
        from models.scoring_engine import compute_uf_breakdown
        uf_breakdown = compute_uf_breakdown(fixture, league_id)

    return render_template("matchups/detail.html",
                           league=league,
                           fixture=fixture,
                           uf_breakdown=uf_breakdown)


@matchups_bp.route("/<int:league_id>/standings")
@login_required
def standings(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    standing_list = get_standings(league_id, league.season_year)

    return render_template("matchups/standings.html",
                           league=league,
                           standings=standing_list)


@matchups_bp.route("/<int:league_id>/score/<int:afl_round>", methods=["POST"])
@login_required
def score_round_view(league_id, afl_round):
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can score rounds.", "warning")
        return redirect(url_for("matchups.round_view", league_id=league_id, afl_round=afl_round))

    # Score all teams, update fixtures, recalculate standings, advance finals
    finalize_round(league_id, afl_round, league.season_year)

    flash(f"Round {afl_round} scored and standings updated.", "success")
    return redirect(url_for("matchups.round_view", league_id=league_id, afl_round=afl_round))


@matchups_bp.route("/<int:league_id>/live/<int:afl_round>")
@login_required
def live_scores(league_id, afl_round):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    scores = get_live_scores(league_id, afl_round, year)
    fixtures = get_round_fixtures(league_id, year, afl_round)
    afl_games = get_game_statuses(afl_round, year)
    locked_ids = get_locked_player_ids(afl_round, year)

    # Build per-fixture player breakdowns
    fixture_breakdowns = {}
    for f in fixtures:
        fixture_breakdowns[f.id] = {
            "home_players": get_player_score_breakdown(f.home_team_id, afl_round, year, league_id),
            "away_players": get_player_score_breakdown(f.away_team_id, afl_round, year, league_id),
        }

    # Check if live scoring is enabled for this league
    live_config = LiveScoringConfig.query.get(league_id)
    live_enabled = live_config.enabled if live_config else False

    return render_template("matchups/live.html",
                           league=league,
                           afl_round=afl_round,
                           scores=scores,
                           fixtures=fixtures,
                           afl_games=afl_games,
                           locked_player_ids=locked_ids,
                           fixture_breakdowns=fixture_breakdowns,
                           live_enabled=live_enabled,
                           max_round=config.SC_ROUNDS)


@matchups_bp.route("/<int:league_id>/live/<int:afl_round>/api/scores")
@login_required
def api_live_scores(league_id, afl_round):
    """JSON endpoint for AJAX polling fallback (when SocketIO unavailable)."""
    league, user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Not a league member"}), 403

    year = league.season_year
    fixtures = get_round_fixtures(league_id, year, afl_round)
    game_statuses = get_game_statuses(afl_round, year)
    locked_ids = list(get_locked_player_ids(afl_round, year))

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

    return jsonify({
        "fixtures": fixture_list,
        "game_statuses": game_statuses,
        "locked_player_ids": locked_ids,
    })


def _detect_current_round(year: int) -> int | None:
    """Auto-detect the current AFL round.

    Priority: 1) DB AflGame with status='live'
              2) Squiggle API get_current_round()
              3) Latest fixture round in the DB
    """
    # 1. Check for any live game in DB
    live_game = AflGame.query.filter_by(year=year, status="live").first()
    if live_game:
        return live_game.afl_round

    # 2. Ask Squiggle
    try:
        squiggle_round = get_current_round(year)
        if squiggle_round:
            return squiggle_round
    except Exception:
        logger.debug("Squiggle current-round lookup failed", exc_info=True)

    # 3. Fallback: latest fixture round in DB for this year
    latest = (
        db.session.query(db.func.max(Fixture.afl_round))
        .filter_by(year=year)
        .scalar()
    )
    return latest


@matchups_bp.route("/<int:league_id>/gameday")
@login_required
def gameday(league_id):
    """Single-fixture head-to-head view for the logged-in user's matchup."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year

    # Find user's fantasy team in this league
    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    if not user_team:
        flash("You don't have a team in this league.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    # Determine round (query param or auto-detect)
    afl_round = request.args.get("round", type=int)
    if not afl_round:
        afl_round = _detect_current_round(year)
    if not afl_round:
        flash("No fixtures found yet. The season may not have started.", "info")
        return redirect(url_for("matchups.fixture_view", league_id=league_id))

    # Find user's fixture for this round (home or away)
    fixture = Fixture.query.filter(
        Fixture.league_id == league_id,
        Fixture.year == year,
        Fixture.afl_round == afl_round,
        Fixture.is_final == False,
        db.or_(
            Fixture.home_team_id == user_team.id,
            Fixture.away_team_id == user_team.id,
        ),
    ).first()

    if not fixture:
        flash(f"You don't have a matchup in round {afl_round} (bye round?).", "info")
        return redirect(url_for("matchups.fixture_view", league_id=league_id))

    # Determine which side the user is on
    is_home = fixture.home_team_id == user_team.id
    my_team = fixture.home_team if is_home else fixture.away_team
    opp_team = fixture.away_team if is_home else fixture.home_team

    # Fetch player breakdowns
    my_players = get_player_score_breakdown(my_team.id, afl_round, year, league_id)
    opp_players = get_player_score_breakdown(opp_team.id, afl_round, year, league_id)

    # Scores
    my_rs = RoundScore.query.filter_by(
        team_id=my_team.id, afl_round=afl_round, year=year
    ).first()
    opp_rs = RoundScore.query.filter_by(
        team_id=opp_team.id, afl_round=afl_round, year=year
    ).first()

    my_score = my_rs.total_score if my_rs else 0
    opp_score = opp_rs.total_score if opp_rs else 0
    my_captain_bonus = my_rs.captain_bonus if my_rs else 0
    opp_captain_bonus = opp_rs.captain_bonus if opp_rs else 0

    # AFL game statuses + locked players
    afl_games = get_game_statuses(afl_round, year)
    locked_ids = get_locked_player_ids(afl_round, year)

    # Live scoring config
    live_config = LiveScoringConfig.query.get(league_id)
    live_enabled = live_config.enabled if live_config else False

    # Round navigation bounds
    min_round = (
        db.session.query(db.func.min(Fixture.afl_round))
        .filter_by(league_id=league_id, year=year, is_final=False)
        .scalar()
    ) or 1
    max_round = (
        db.session.query(db.func.max(Fixture.afl_round))
        .filter_by(league_id=league_id, year=year, is_final=False)
        .scalar()
    ) or config.SC_ROUNDS

    return render_template(
        "matchups/gameday.html",
        league=league,
        afl_round=afl_round,
        fixture=fixture,
        is_home=is_home,
        my_team=my_team,
        opp_team=opp_team,
        my_players=my_players,
        opp_players=opp_players,
        my_score=my_score,
        opp_score=opp_score,
        my_captain_bonus=my_captain_bonus,
        opp_captain_bonus=opp_captain_bonus,
        afl_games=afl_games,
        locked_player_ids=locked_ids,
        live_enabled=live_enabled,
        min_round=min_round,
        max_round=max_round,
    )


@matchups_bp.route("/<int:league_id>/gameday/sync-scores", methods=["POST"])
@login_required
def sync_scores(league_id):
    """Manual score sync triggered from the gameday page."""
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "League not found"}), 404

    live_config = LiveScoringConfig.query.get(league_id)
    if not live_config or not live_config.enabled:
        return jsonify({"error": "Live scoring is not enabled"}), 400

    try:
        from models.scheduler import run_manual_score_sync
        run_manual_score_sync()
        return jsonify({"ok": True, "message": "Scores synced successfully"})
    except Exception as e:
        logger.exception("Manual score sync failed")
        return jsonify({"error": str(e)}), 500


@matchups_bp.route("/<int:league_id>/teams")
@login_required
def teams_view(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    standing_list = get_standings(league_id, league.season_year)
    # Map team_id -> standing for easy lookup
    standing_map = {s.team_id: s for s in standing_list}

    return render_template("matchups/teams.html",
                           league=league,
                           teams=teams,
                           standing_map=standing_map)


@matchups_bp.route("/<int:league_id>/results")
@login_required
def results_view(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    rounds = get_fixture(league_id, year)
    is_commissioner = league.commissioner_id == current_user.id

    # Find the most recent completed round
    latest_completed = 0
    for rnd_num, fixtures in rounds.items():
        if any(f.status == "completed" for f in fixtures):
            latest_completed = max(latest_completed, rnd_num)

    return render_template("matchups/results.html",
                           league=league,
                           rounds=rounds,
                           latest_completed=latest_completed,
                           is_commissioner=is_commissioner)


@matchups_bp.route("/<int:league_id>/finals")
@login_required
def finals_view(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    finals = get_finals(league_id, league.season_year)
    is_commissioner = league.commissioner_id == current_user.id

    return render_template("matchups/finals.html",
                           league=league,
                           finals=finals,
                           is_commissioner=is_commissioner)


@matchups_bp.route("/<int:league_id>/finals/generate", methods=["POST"])
@login_required
def generate_finals_view(league_id):
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can generate finals.", "warning")
        return redirect(url_for("matchups.finals_view", league_id=league_id))

    finals, error = generate_finals(league_id, league.season_year)
    if error:
        flash(error, "danger")
    else:
        flash(f"Finals bracket generated ({len(finals)} matches).", "success")
    return redirect(url_for("matchups.finals_view", league_id=league_id))


@matchups_bp.route("/<int:league_id>/season/delist", methods=["GET", "POST"])
@login_required
def delist_view(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    is_commissioner = league.commissioner_id == current_user.id

    # Find active delist period
    period = DelistPeriod.query.filter_by(
        league_id=league_id, year=league.season_year, status="open"
    ).first()

    if request.method == "POST":
        action = request.form.get("action")

        if action == "open_period" and is_commissioner:
            min_delists = request.form.get("min_delists", type=int) or league.delist_minimum
            period, error = open_delist_period(league_id, league.season_year, min_delists=min_delists)
            if error:
                flash(error, "warning")
            else:
                flash("Delist period opened.", "success")
            return redirect(url_for("matchups.delist_view", league_id=league_id))

        elif action == "close_period" and is_commissioner and period:
            _, error = close_delist_period(period.id)
            if error:
                flash(error, "danger")
            else:
                flash("Delist period closed.", "success")
            return redirect(url_for("matchups.delist_view", league_id=league_id))

        elif action == "delist" and user_team and period:
            player_id = request.form.get("player_id", type=int)
            if player_id:
                _, error = delist_player(period.id, user_team.id, player_id)
                if error:
                    flash(error, "danger")
                else:
                    flash("Player delisted.", "success")
            return redirect(url_for("matchups.delist_view", league_id=league_id))

    # Get delist data
    delist_summary = get_delist_summary(period.id) if period else {}
    my_delists = get_team_delists(period.id, user_team.id) if period and user_team else []
    my_roster = (
        FantasyRoster.query.filter_by(team_id=user_team.id, is_active=True).all()
        if user_team else []
    )

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()

    return render_template("season/delist.html",
                           league=league,
                           period=period,
                           delist_summary=delist_summary,
                           my_delists=my_delists,
                           my_roster=my_roster,
                           teams=teams,
                           is_commissioner=is_commissioner,
                           user_team=user_team)

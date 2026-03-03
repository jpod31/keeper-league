"""Reserve 7s blueprint: lineup selection, gameday, standings, fixture."""

import logging
from datetime import datetime, timezone, timedelta

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import (
    db, League, FantasyTeam, FantasyRoster, AflPlayer, SeasonConfig,
    Reserve7sLineup, Reserve7sFixture, Reserve7sRoundScore, Reserve7sStanding,
    AflGame, LiveScoringConfig, PlayerStat,
)
from models.fixture_manager import (
    generate_7s_round_robin, generate_7s_finals,
    get_7s_fixture, get_7s_round_fixtures,
)
from models.reserve7s_engine import (
    get_7s_standings, get_7s_live_scores, finalize_7s_round, score_7s_round,
)
from models.scoring_engine import get_scoring_context, _get_player_score
from models.live_sync import get_locked_player_ids, get_game_statuses
from blueprints import check_league_access
import config

logger = logging.getLogger(__name__)

reserve7s_bp = Blueprint("reserve7s", __name__, url_prefix="/leagues",
                         template_folder="../templates")

AGE_CUTOFF = 24  # Under 24 = 23 and younger


def _detect_7s_gameday_round(league_id, year):
    """Auto-detect the 7s gameday round, mirroring main comp logic."""
    # Live 7s fixtures
    live = Reserve7sFixture.query.filter_by(
        league_id=league_id, year=year, status="live", is_final=False,
    ).first()
    if live:
        return live.afl_round

    # Tuesday rollover
    now_utc = datetime.now(timezone.utc)
    now_aest = now_utc + timedelta(hours=10)
    before_cutoff = (
        now_aest.weekday() in (4, 5, 6, 0)
        or (now_aest.weekday() == 1 and now_aest.hour < 10)
    )

    if before_cutoff:
        latest_completed = (
            db.session.query(db.func.max(Reserve7sFixture.afl_round))
            .filter_by(league_id=league_id, year=year, status="completed", is_final=False)
            .scalar()
        )
        if latest_completed is not None:
            return latest_completed
    else:
        next_scheduled = (
            db.session.query(db.func.min(Reserve7sFixture.afl_round))
            .filter_by(league_id=league_id, year=year, status="scheduled", is_final=False)
            .scalar()
        )
        if next_scheduled is not None:
            return next_scheduled

    # Fallbacks
    latest_completed = (
        db.session.query(db.func.max(Reserve7sFixture.afl_round))
        .filter_by(league_id=league_id, year=year, status="completed", is_final=False)
        .scalar()
    )
    if latest_completed is not None:
        return latest_completed

    first_scheduled = (
        db.session.query(db.func.min(Reserve7sFixture.afl_round))
        .filter_by(league_id=league_id, year=year, status="scheduled", is_final=False)
        .scalar()
    )
    if first_scheduled is not None:
        return first_scheduled

    return 1


def _get_next_7s_round(league_id, year):
    """Get the next round that needs a lineup (first scheduled or next after latest completed)."""
    next_sched = (
        db.session.query(db.func.min(Reserve7sFixture.afl_round))
        .filter_by(league_id=league_id, year=year, status="scheduled", is_final=False)
        .scalar()
    )
    if next_sched is not None:
        return next_sched

    # If no scheduled rounds, check main comp's next round
    from models.database import Fixture
    next_main = (
        db.session.query(db.func.min(Fixture.afl_round))
        .filter_by(league_id=league_id, year=year, status="scheduled", is_final=False)
        .scalar()
    )
    return next_main or 1


# ── Team Management ────────────────────────────────────────────────────


@reserve7s_bp.route("/<int:league_id>/reserve7s/team")
@login_required
def sevens_team(league_id):
    """7s lineup selection page."""
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))
    if not user_team:
        flash("You don't have a team in this league.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    year = league.season_year
    afl_round = _get_next_7s_round(league_id, year)

    # Get all roster players
    roster_entries = FantasyRoster.query.filter_by(
        team_id=user_team.id, is_active=True,
    ).all()
    player_ids = [r.player_id for r in roster_entries]
    players = AflPlayer.query.filter(AflPlayer.id.in_(player_ids)).all() if player_ids else []

    # Current 7s lineup for this round
    current_lineup = Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=user_team.id,
        afl_round=afl_round, year=year,
    ).all()
    selected_ids = {e.player_id for e in current_lineup}
    captain_id = next((e.player_id for e in current_lineup if e.is_captain), None)

    # Locked players (AFL game has started)
    locked_ids = get_locked_player_ids(afl_round, year)

    # AFL game schedule for round
    afl_games = (
        AflGame.query.filter_by(year=year, afl_round=afl_round)
        .order_by(AflGame.scheduled_start)
        .all()
    )
    teams_playing = set()
    for g in afl_games:
        teams_playing.add(g.home_team)
        teams_playing.add(g.away_team)

    scoring = get_scoring_context(league)

    return render_template("reserve7s/team.html",
                           league=league,
                           team=user_team,
                           players=players,
                           selected_ids=selected_ids,
                           captain_id=captain_id,
                           afl_round=afl_round,
                           year=year,
                           locked_ids=locked_ids,
                           teams_playing=teams_playing,
                           age_cutoff=AGE_CUTOFF,
                           scoring=scoring)


@reserve7s_bp.route("/<int:league_id>/reserve7s/team/set", methods=["POST"])
@login_required
def sevens_team_set(league_id):
    """Save 7s lineup (JSON API)."""
    league, user_team = check_league_access(league_id)
    if not league or not user_team:
        return jsonify({"error": "No access"}), 403

    data = request.get_json(silent=True) or {}
    player_ids = data.get("player_ids", [])
    captain_id = data.get("captain_id")
    afl_round = data.get("afl_round")
    year = league.season_year

    if not afl_round:
        return jsonify({"error": "Missing afl_round"}), 400

    # Validate exactly 7 players
    if len(player_ids) != 7:
        return jsonify({"error": "Must select exactly 7 players"}), 400

    # Validate all players on team's roster
    roster_entries = FantasyRoster.query.filter_by(
        team_id=user_team.id, is_active=True,
    ).all()
    roster_player_ids = {r.player_id for r in roster_entries}
    for pid in player_ids:
        if pid not in roster_player_ids:
            return jsonify({"error": f"Player {pid} is not on your roster"}), 400

    # Validate captain is in the selection
    if captain_id and captain_id not in player_ids:
        return jsonify({"error": "Captain must be in the selected 7"}), 400

    # Validate age constraints: min 5 under-24, max 2 over-24
    players = AflPlayer.query.filter(AflPlayer.id.in_(player_ids)).all()
    player_map = {p.id: p for p in players}

    young_count = sum(1 for pid in player_ids
                      if player_map.get(pid) and (player_map[pid].age or 99) < AGE_CUTOFF)
    senior_count = len(player_ids) - young_count

    if young_count < 5:
        return jsonify({"error": f"Need at least 5 under-{AGE_CUTOFF} players (have {young_count})"}), 400
    if senior_count > 2:
        return jsonify({"error": f"Maximum 2 over-{AGE_CUTOFF} players allowed (have {senior_count})"}), 400

    # Check lockouts — can't remove locked players from existing lineup
    locked_ids = get_locked_player_ids(afl_round, year)
    existing = Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=user_team.id,
        afl_round=afl_round, year=year,
    ).all()
    existing_ids = {e.player_id for e in existing}
    for pid in existing_ids:
        if pid in locked_ids and pid not in player_ids:
            p = player_map.get(pid) or db.session.get(AflPlayer, pid)
            name = p.name if p else f"Player {pid}"
            return jsonify({"error": f"{name} is locked (game started) and cannot be removed"}), 400

    # Clear existing and save new
    Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=user_team.id,
        afl_round=afl_round, year=year,
    ).delete()

    for pid in player_ids:
        entry = Reserve7sLineup(
            league_id=league_id,
            team_id=user_team.id,
            afl_round=afl_round,
            year=year,
            player_id=pid,
            is_captain=(pid == captain_id),
        )
        db.session.add(entry)

    db.session.commit()
    return jsonify({"ok": True, "message": "7s lineup saved"})


# ── Gameday ────────────────────────────────────────────────────────────


@reserve7s_bp.route("/<int:league_id>/reserve7s/gameday")
@login_required
def sevens_gameday(league_id):
    """7s gameday view."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id,
    ).first()
    if not user_team:
        flash("You don't have a team in this league.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    afl_round = _detect_7s_gameday_round(league_id, year)

    # Round dates from AFL game schedule
    afl_games_for_round = (
        AflGame.query.filter_by(year=year, afl_round=afl_round)
        .order_by(AflGame.scheduled_start)
        .all()
    )
    round_dates = None
    starts = [g.scheduled_start for g in afl_games_for_round if g.scheduled_start]
    if starts:
        earliest = min(starts)
        latest = max(starts)
        fmt = lambda dt: f"{dt.strftime('%a')} {dt.day} {dt.strftime('%b')}"
        if earliest.date() == latest.date():
            round_dates = fmt(earliest)
        else:
            round_dates = f"{fmt(earliest)} – {fmt(latest)}"

    # All 7s fixtures this round
    round_fixtures = get_7s_round_fixtures(league_id, year, afl_round)

    # Determine gameday state
    if any(f.status == "live" for f in round_fixtures):
        gameday_state = "live"
    elif round_fixtures and all(f.status == "completed" for f in round_fixtures):
        gameday_state = "completed"
    else:
        gameday_state = "upcoming"

    # AFL game statuses
    afl_games = get_game_statuses(afl_round, year)

    # 7s live scores
    sevens_scores = get_7s_live_scores(league_id, afl_round, year)

    scoring = get_scoring_context(league)

    # Find user's 7s fixture
    fixture = Reserve7sFixture.query.filter(
        Reserve7sFixture.league_id == league_id,
        Reserve7sFixture.year == year,
        Reserve7sFixture.afl_round == afl_round,
        Reserve7sFixture.is_final == False,
        db.or_(
            Reserve7sFixture.home_team_id == user_team.id,
            Reserve7sFixture.away_team_id == user_team.id,
        ),
    ).first()

    is_bye = fixture is None

    my_lineup = []
    opp_lineup = []
    my_score = 0
    opp_score = 0
    my_captain_bonus = 0
    opp_captain_bonus = 0
    my_team = user_team
    opp_team = None
    is_home = True

    if fixture:
        is_home = fixture.home_team_id == user_team.id
        my_team = fixture.home_team if is_home else fixture.away_team
        opp_team = fixture.away_team if is_home else fixture.home_team

        # Build lineup player data
        my_lineup = _build_7s_player_list(
            league_id, my_team.id, afl_round, year, league,
        )
        opp_lineup = _build_7s_player_list(
            league_id, opp_team.id, afl_round, year, league,
        )

        # Scores
        my_rs = Reserve7sRoundScore.query.filter_by(
            team_id=my_team.id, afl_round=afl_round, year=year,
        ).first()
        opp_rs = Reserve7sRoundScore.query.filter_by(
            team_id=opp_team.id, afl_round=afl_round, year=year,
        ).first()
        my_score = my_rs.total_score if my_rs else 0
        opp_score = opp_rs.total_score if opp_rs else 0
        my_captain_bonus = my_rs.captain_bonus if my_rs else 0
        opp_captain_bonus = opp_rs.captain_bonus if opp_rs else 0

    return render_template("reserve7s/gameday.html",
                           league=league,
                           afl_round=afl_round,
                           round_dates=round_dates,
                           gameday_state=gameday_state,
                           afl_games=afl_games,
                           user_team=user_team,
                           scoring=scoring,
                           is_bye=is_bye,
                           fixture=fixture,
                           is_home=is_home,
                           my_team=my_team,
                           opp_team=opp_team,
                           my_lineup=my_lineup,
                           opp_lineup=opp_lineup,
                           my_score=my_score,
                           opp_score=opp_score,
                           my_captain_bonus=my_captain_bonus,
                           opp_captain_bonus=opp_captain_bonus,
                           round_fixtures=round_fixtures,
                           sevens_scores=sevens_scores)


def _build_7s_player_list(league_id, team_id, afl_round, year, league):
    """Build a list of player dicts for a team's 7s lineup."""
    lineup = Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=team_id,
        afl_round=afl_round, year=year,
    ).all()

    players = []
    for entry in lineup:
        p = entry.player
        if not p:
            continue

        score = _get_player_score(
            p.id, afl_round, year, league_id,
            league.scoring_type, league.hybrid_base,
        )

        players.append({
            "id": p.id,
            "name": p.name,
            "afl_team": p.afl_team or "",
            "position": p.position or "",
            "age": p.age,
            "sc_avg": p.sc_avg or 0,
            "score": score if score is not None else 0,
            "has_played": score is not None,
            "is_captain": entry.is_captain,
        })

    # Sort: captain first, then by score descending
    players.sort(key=lambda x: (-x["is_captain"], -x["score"]))
    return players


# ── League Standings & Fixture ─────────────────────────────────────────


@reserve7s_bp.route("/<int:league_id>/reserve7s/standings")
@login_required
def sevens_standings(league_id):
    """7s ladder."""
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    standing_list = get_7s_standings(league_id, year)

    # Initialize standings for all teams if missing
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    existing_ids = {s.team_id for s in standing_list}
    added = False
    for t in teams:
        if t.id not in existing_ids:
            s = Reserve7sStanding(league_id=league_id, team_id=t.id, year=year)
            db.session.add(s)
            added = True
    if added:
        db.session.commit()
        standing_list = get_7s_standings(league_id, year)

    scoring = get_scoring_context(league)

    return render_template("reserve7s/standings.html",
                           league=league,
                           standings=standing_list,
                           scoring=scoring)


@reserve7s_bp.route("/<int:league_id>/reserve7s/fixture")
@login_required
def sevens_fixture(league_id):
    """7s season fixture view."""
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    rounds = get_7s_fixture(league_id, year)
    is_commissioner = league.commissioner_id == current_user.id

    # Determine selected round
    selected_round = request.args.get("round", type=int)
    if selected_round is None and rounds:
        completed_rounds = [r for r, fxs in rounds.items()
                            if any(f.status == "completed" for f in fxs)]
        live_rounds = [r for r, fxs in rounds.items()
                       if any(f.status == "live" for f in fxs)]
        if live_rounds:
            selected_round = max(live_rounds)
        elif completed_rounds:
            selected_round = max(completed_rounds)
        else:
            selected_round = min(rounds.keys()) if rounds else 1

    # Build round metadata
    round_meta = {}
    for rnd_num, fixtures in sorted(rounds.items()):
        has_live = any(f.status == "live" for f in fixtures)
        all_completed = all(f.status == "completed" for f in fixtures)
        has_completed = any(f.status == "completed" for f in fixtures)
        if has_live:
            status = "live"
        elif all_completed:
            status = "completed"
        elif has_completed:
            status = "partial"
        else:
            status = "scheduled"
        round_meta[rnd_num] = status

    current_fixtures = rounds.get(selected_round, [])
    scoring = get_scoring_context(league)

    return render_template("reserve7s/fixture.html",
                           league=league,
                           rounds=rounds,
                           round_meta=round_meta,
                           selected_round=selected_round,
                           current_fixtures=current_fixtures,
                           is_commissioner=is_commissioner,
                           scoring=scoring)


# ── Commissioner Actions ───────────────────────────────────────────────


@reserve7s_bp.route("/<int:league_id>/reserve7s/generate-fixture", methods=["POST"])
@login_required
def sevens_generate_fixture(league_id):
    """Generate 7s fixture draw."""
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can generate fixtures.", "warning")
        return redirect(url_for("reserve7s.sevens_fixture", league_id=league_id))

    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=league.season_year).first()
    num_rounds = season_cfg.num_regular_rounds if season_cfg else 23

    fixtures, error = generate_7s_round_robin(league_id, league.season_year, num_rounds)
    if error:
        flash(error, "danger")
    else:
        flash(f"Generated {len(fixtures)} Reserve 7s fixtures across {num_rounds} rounds.", "success")
    return redirect(url_for("reserve7s.sevens_fixture", league_id=league_id))


# ── API ────────────────────────────────────────────────────────────────


@reserve7s_bp.route("/<int:league_id>/reserve7s/api/live/<int:afl_round>")
@login_required
def api_7s_live(league_id, afl_round):
    """Live score polling for 7s gameday."""
    league, user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Not a league member"}), 403

    year = league.season_year
    fixtures = get_7s_round_fixtures(league_id, year, afl_round)
    game_statuses = get_game_statuses(afl_round, year)

    fixture_list = []
    for f in fixtures:
        home_rs = Reserve7sRoundScore.query.filter_by(
            team_id=f.home_team_id, afl_round=afl_round, year=year,
        ).first()
        away_rs = Reserve7sRoundScore.query.filter_by(
            team_id=f.away_team_id, afl_round=afl_round, year=year,
        ).first()

        fixture_list.append({
            "fixture_id": f.id,
            "home_team": f.home_team.name,
            "away_team": f.away_team.name,
            "home_score": home_rs.total_score if home_rs else 0,
            "away_score": away_rs.total_score if away_rs else 0,
            "home_captain_bonus": home_rs.captain_bonus if home_rs else 0,
            "away_captain_bonus": away_rs.captain_bonus if away_rs else 0,
        })

    return jsonify({
        "fixtures": fixture_list,
        "game_statuses": game_statuses,
    })

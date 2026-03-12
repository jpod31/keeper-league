"""Matchups blueprint: fixtures, standings, scoring, finals, delist, live scoring."""

import logging
from datetime import datetime, timezone, timedelta

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, SeasonConfig, DelistPeriod, AflGame, LiveScoringConfig, AflTeamSelection
from models.fixture_manager import (
    generate_round_robin, get_fixture, get_round_fixtures, get_matchup,
    generate_finals, get_finals,
)
from models.scoring_engine import (
    get_standings, get_live_scores,
    get_team_round_scores, get_scoring_context,
    compute_uf_breakdown, compute_custom_breakdown, compute_player_breakdown,
)
from models.season_manager import (
    get_or_create_season_config, update_season_config,
    open_delist_period, close_delist_period, delist_player,
    get_delist_summary, get_team_delists,
)
from models.live_sync import (
    get_locked_player_ids, get_game_statuses, get_player_score_breakdown,
)
from models.database import Fixture, FantasyRoster, RoundScore, DraftPick, Trade
from blueprints import check_league_access
import config
from config import TEAM_LOGOS, TEAM_COLOURS

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

    # Determine which round to show (query param or auto-detect)
    selected_round = request.args.get("round", type=int)
    if selected_round is None and rounds:
        # Default: latest round with a completed game, or the first scheduled
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

    # Build round metadata for the selector bar
    round_meta = {}
    for rnd_num, fixtures in sorted(rounds.items()):
        has_live = any(f.status == "live" for f in fixtures)
        has_completed = any(f.status == "completed" for f in fixtures)
        all_completed = all(f.status == "completed" for f in fixtures)
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
    max_round = max(rounds.keys()) if rounds else 1

    # Season config for finals info
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()

    scoring = get_scoring_context(league)

    return render_template("matchups/fixture.html",
                           league=league,
                           rounds=rounds,
                           round_meta=round_meta,
                           selected_round=selected_round,
                           current_fixtures=current_fixtures,
                           max_round=max_round,
                           season_config=season_cfg,
                           is_commissioner=is_commissioner,
                           scoring=scoring)


@matchups_bp.route("/<int:league_id>/fixture/generate", methods=["POST"])
@login_required
def generate_fixture(league_id):
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can generate fixtures.", "warning")
        return redirect(url_for("matchups.fixture_view", league_id=league_id))

    num_rounds = request.form.get("num_rounds", type=int) or 23
    fixtures, error = generate_round_robin(league_id, league.season_year, num_rounds)

    # Auto-generate 7s fixture to match
    if not error:
        from models.fixture_manager import generate_7s_round_robin
        generate_7s_round_robin(league_id, league.season_year, num_rounds)

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

    scoring = get_scoring_context(league)

    return render_template("matchups/round.html",
                           league=league,
                           afl_round=afl_round,
                           fixtures=fixtures,
                           is_commissioner=is_commissioner,
                           max_round=config.SC_ROUNDS,
                           scoring=scoring)


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

    scoring = get_scoring_context(league)

    # Build scoring-type-appropriate breakdown for completed fixtures
    uf_breakdown = None
    custom_breakdown = None
    player_breakdown = None

    if fixture.status == "completed":
        if league.scoring_type == "ultimate_footy":
            uf_breakdown = compute_uf_breakdown(fixture, league_id)
        elif league.scoring_type in ("custom", "hybrid"):
            custom_breakdown = compute_custom_breakdown(fixture, league_id)
            player_breakdown = compute_player_breakdown(fixture, league_id)
        else:
            # supercoach / afl_fantasy — show per-player scores
            player_breakdown = compute_player_breakdown(fixture, league_id)

    return render_template("matchups/detail.html",
                           league=league,
                           fixture=fixture,
                           scoring=scoring,
                           uf_breakdown=uf_breakdown,
                           custom_breakdown=custom_breakdown,
                           player_breakdown=player_breakdown)


@matchups_bp.route("/<int:league_id>/standings")
@login_required
def standings(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    standing_list = get_standings(league_id, year)

    # Initialize standings for all teams if missing (so ladder always shows)
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    existing_ids = {s.team_id for s in standing_list}
    added = False
    for t in teams:
        if t.id not in existing_ids:
            from models.database import SeasonStanding
            s = SeasonStanding(league_id=league_id, team_id=t.id, year=year)
            db.session.add(s)
            added = True
    if added:
        db.session.commit()
        standing_list = get_standings(league_id, year)

    # Season config for finals info
    season_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    finals_teams = season_cfg.finals_teams if season_cfg else 4

    scoring = get_scoring_context(league)

    # Power rankings data for inline toggle
    from models.power_rankings import get_latest_power_rankings
    rankings = get_latest_power_rankings(league_id, year)

    # Recent form for rankings display
    from models.database import Fixture as Fx
    completed_fx = (
        Fx.query.filter_by(league_id=league_id, status="completed", is_final=False, year=year)
        .order_by(Fx.afl_round.desc()).all()
    )
    team_form = {}
    for f in completed_fx:
        if f.home_score is None or f.away_score is None:
            continue
        for tid, won in [(f.home_team_id, f.home_score > f.away_score),
                         (f.away_team_id, f.away_score > f.home_score)]:
            if tid not in team_form:
                team_form[tid] = []
            if len(team_form[tid]) < 5:
                if f.home_score == f.away_score:
                    team_form[tid].append("D")
                elif won:
                    team_form[tid].append("W")
                else:
                    team_form[tid].append("L")

    # Auto-generate fun blurbs for each ranked team
    ranking_blurbs = {}
    if rankings:
        # Get avg scores for blurbs
        avg_rs = {}
        rs_rows = (
            db.session.query(RoundScore.team_id, db.func.avg(RoundScore.total_score))
            .filter(RoundScore.team_id.in_([r.team_id for r in rankings]), RoundScore.year == year)
            .group_by(RoundScore.team_id).all()
        )
        for tid, avg in rs_rows:
            avg_rs[tid] = avg
        league_avg = sum(avg_rs.values()) / len(avg_rs) if avg_rs else 0

        for pr in rankings:
            form = team_form.get(pr.team_id, [])
            wins = sum(1 for r in form if r == "W")
            losses = sum(1 for r in form if r == "L")
            avg = avg_rs.get(pr.team_id, 0)
            pct_above = ((avg - league_avg) / league_avg * 100) if league_avg > 0 else 0

            if wins >= 4 and pct_above > 10:
                blurb = f"Dominant — {wins} from last {len(form)}, scoring {pct_above:+.0f}% above league average"
            elif wins >= 3:
                blurb = f"On fire — {wins} wins from last {len(form)}"
            elif pr.movement >= 3:
                blurb = f"Surging — up {pr.movement} spots this round"
            elif losses >= 4:
                blurb = f"In freefall — {losses} losses from last {len(form)}"
            elif pr.movement <= -3:
                blurb = f"Sliding — dropped {abs(pr.movement)} spots"
            elif losses >= 3:
                blurb = f"Struggling — {losses} losses from last {len(form)}"
            elif pct_above > 5:
                blurb = f"Solid — scoring {pct_above:+.0f}% above average"
            elif pct_above < -5:
                blurb = f"Underperforming — scoring {pct_above:+.0f}% vs league average"
            elif wins == losses and len(form) >= 4:
                blurb = f"Treading water — {wins}W {losses}L from last {len(form)}"
            else:
                blurb = f"Steady — holding at #{pr.rank}"
            ranking_blurbs[pr.team_id] = blurb

    return render_template("matchups/standings.html",
                           league=league,
                           standings=standing_list,
                           finals_teams=finals_teams,
                           scoring=scoring,
                           rankings=rankings,
                           team_form=team_form,
                           ranking_blurbs=ranking_blurbs)


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

    scoring = get_scoring_context(league)

    return render_template("matchups/live.html",
                           league=league,
                           afl_round=afl_round,
                           scores=scores,
                           fixtures=fixtures,
                           afl_games=afl_games,
                           locked_player_ids=locked_ids,
                           fixture_breakdowns=fixture_breakdowns,
                           live_enabled=live_enabled,
                           max_round=config.SC_ROUNDS,
                           scoring=scoring)


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

    # Build kickoff-time sort key (same as gameday route)
    afl_games_for_round = (
        AflGame.query.filter_by(year=year, afl_round=afl_round)
        .order_by(AflGame.scheduled_start)
        .all()
    )
    _team_start = {}
    for g in afl_games_for_round:
        ts = g.scheduled_start
        for t in (g.home_team, g.away_team):
            if t not in _team_start or (ts and (not _team_start[t] or ts < _team_start[t])):
                _team_start[t] = ts

    _type_order = {"field": 0, "flex": 1, "emergency": 2, "reserve": 3}
    _far_future = datetime(2099, 1, 1)

    def _player_sort_key(p):
        return (
            _type_order.get(p.get("lineup_type", "field"), 9),
            _team_start.get(p.get("afl_team", ""), _far_future) or _far_future,
            p.get("name", ""),
        )

    fixture_list = []
    for f in fixtures:
        home_rs = RoundScore.query.filter_by(
            team_id=f.home_team_id, afl_round=afl_round, year=year
        ).first()
        away_rs = RoundScore.query.filter_by(
            team_id=f.away_team_id, afl_round=afl_round, year=year
        ).first()

        home_players = get_player_score_breakdown(f.home_team_id, afl_round, year, league_id)
        away_players = get_player_score_breakdown(f.away_team_id, afl_round, year, league_id)
        home_players.sort(key=_player_sort_key)
        away_players.sort(key=_player_sort_key)

        fixture_list.append({
            "fixture_id": f.id,
            "home_score": home_rs.total_score if home_rs else 0,
            "away_score": away_rs.total_score if away_rs else 0,
            "home_captain_bonus": home_rs.captain_bonus if home_rs else 0,
            "away_captain_bonus": away_rs.captain_bonus if away_rs else 0,
            "home_players": home_players,
            "away_players": away_players,
        })

    # Compute projections for the user's fixture
    projections = None
    if user_team:
        user_fixture = next(
            (f for f in fixtures
             if f.home_team_id == user_team.id or f.away_team_id == user_team.id),
            None,
        )
        if user_fixture:
            teams_playing = set()
            for g in afl_games_for_round:
                teams_playing.add(g.home_team)
                teams_playing.add(g.away_team)
            is_home = user_fixture.home_team_id == user_team.id
            my_tid = user_team.id
            opp_tid = user_fixture.away_team_id if is_home else user_fixture.home_team_id
            try:
                from models.matchup_projections import project_matchup
                projections = project_matchup(my_tid, opp_tid, afl_round, year, league_id, teams_playing)
            except Exception:
                pass

    return jsonify({
        "fixtures": fixture_list,
        "game_statuses": game_statuses,
        "locked_player_ids": locked_ids,
        "projections": projections,
    })


def _detect_gameday_round(league_id: int, year: int) -> int | None:
    """Auto-detect the gameday round for a specific league.

    Uses AFL game schedule dates as the primary signal (not just fixture
    status) so that round advancement works even if finalization hasn't run.

    Priority:
      1. Live AFL games → that round (games actively in progress)
      2. Date-based detection using AflGame schedule:
         - Find the most recent round whose games have ALL finished
           (last game scheduled_start + 4 hours < now)
         - Tuesday 10am AEST rollover:
           * Before cutoff → show that "just finished" round (results mode)
           * After cutoff → show the NEXT round (preview mode)
      3. Fallbacks: latest completed fixture → first scheduled fixture → round 1
    """
    now_utc = datetime.now(timezone.utc)
    now_naive = now_utc.replace(tzinfo=None)  # naive UTC for DB comparisons
    now_aest = now_utc + timedelta(hours=10)  # AEST = UTC+10

    # 1. Live AFL games — show that round regardless of day/time
    live_game = AflGame.query.filter_by(year=year, status="live").first()
    if live_game:
        return live_game.afl_round

    # Also check fantasy fixture status, but ONLY if the round's AFL games
    # are actually still in progress (not stale "live" status from a missed
    # finalization).
    live_fixture = Fixture.query.filter_by(
        league_id=league_id, year=year, status="live", is_final=False
    ).first()
    if live_fixture:
        # Verify the round's AFL games haven't all finished already
        round_games = AflGame.query.filter_by(
            year=year, afl_round=live_fixture.afl_round
        ).all()
        games_still_live = not round_games or any(
            g.status not in ("complete",) and
            (not g.scheduled_start or g.scheduled_start + timedelta(hours=4) > now_naive)
            for g in round_games
        )
        if games_still_live:
            return live_fixture.afl_round
        # Otherwise fall through — the "live" status is stale

    # 2. Date-based round detection from AFL schedule
    #    Find the latest round where ALL games have finished.
    #    A game is "finished" if status == "complete" OR
    #    scheduled_start + 4 hours < now (covers longest AFL games).
    game_end_buffer = timedelta(hours=4)

    rounds_with_games = (
        db.session.query(AflGame.afl_round)
        .filter_by(year=year)
        .distinct()
        .order_by(AflGame.afl_round.desc())
        .all()
    )

    latest_finished_round = None
    for (rnd,) in rounds_with_games:
        games = AflGame.query.filter_by(year=year, afl_round=rnd).all()
        if not games:
            continue
        all_finished = all(
            g.status in ("complete",) or
            (g.scheduled_start and g.scheduled_start + game_end_buffer < now_naive)
            for g in games
        )
        if all_finished:
            latest_finished_round = rnd
            break

    # Tuesday rollover logic
    # weekday: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    before_cutoff = (
        now_aest.weekday() in (4, 5, 6, 0)  # Fri–Mon
        or (now_aest.weekday() == 1 and now_aest.hour < 10)  # Tue before 10am
    )

    if latest_finished_round is not None:
        if before_cutoff:
            # Show the just-finished round (results mode)
            return latest_finished_round
        else:
            # After Tuesday 10am — show next round (preview mode)
            # Next round = latest_finished_round + 1, but verify it exists
            # in either AflGame schedule or league fixtures
            next_rnd = latest_finished_round + 1
            has_next_games = AflGame.query.filter_by(
                year=year, afl_round=next_rnd
            ).first()
            has_next_fixture = Fixture.query.filter_by(
                league_id=league_id, year=year, afl_round=next_rnd, is_final=False
            ).first()
            if has_next_games or has_next_fixture:
                return next_rnd
            # No next round exists yet — stay on finished round
            return latest_finished_round

    # 3. Fallback to fixture-status-based detection (handles cases where
    #    AflGame table isn't populated yet, e.g. start of season)
    if before_cutoff:
        latest_completed = (
            db.session.query(db.func.max(Fixture.afl_round))
            .filter_by(league_id=league_id, year=year, status="completed", is_final=False)
            .scalar()
        )
        if latest_completed is not None:
            return latest_completed
    else:
        next_scheduled = (
            db.session.query(db.func.min(Fixture.afl_round))
            .filter_by(league_id=league_id, year=year, status="scheduled", is_final=False)
            .scalar()
        )
        if next_scheduled is not None:
            return next_scheduled

    # Final fallbacks
    latest_completed = (
        db.session.query(db.func.max(Fixture.afl_round))
        .filter_by(league_id=league_id, year=year, status="completed", is_final=False)
        .scalar()
    )
    if latest_completed is not None:
        return latest_completed

    first_scheduled = (
        db.session.query(db.func.min(Fixture.afl_round))
        .filter_by(league_id=league_id, year=year, status="scheduled", is_final=False)
        .scalar()
    )
    if first_scheduled is not None:
        return first_scheduled

    return 1


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

    # Auto-detect round (no manual override)
    afl_round = _detect_gameday_round(league_id, year)
    if afl_round is None:
        flash("No fixtures found yet. The season may not have started.", "info")
        return redirect(url_for("matchups.fixture_view", league_id=league_id))

    # ── Compute round dates + first bounce from AflGame schedule ──
    afl_games_for_round = (
        AflGame.query.filter_by(year=year, afl_round=afl_round)
        .order_by(AflGame.scheduled_start)
        .all()
    )
    first_bounce = None
    round_dates = None
    starts = [g.scheduled_start for g in afl_games_for_round if g.scheduled_start]
    if starts:
        earliest = min(starts)
        latest = max(starts)
        # First bounce display (e.g. "Thu 7:30pm")
        fb_hour = earliest.strftime("%I:%M%p").lstrip("0").lower()
        first_bounce = f"{earliest.strftime('%a')} {fb_hour}"
        # Date range (e.g. "Thu 10 Apr – Mon 14 Apr")
        fmt = lambda dt: f"{dt.strftime('%a')} {dt.day} {dt.strftime('%b')}"
        if earliest.date() == latest.date():
            round_dates = fmt(earliest)
        else:
            round_dates = f"{fmt(earliest)} – {fmt(latest)}"

    # Build set of AFL teams that have a game this round + matchup info
    teams_playing = set()
    afl_matchup_info = {}  # e.g. {"Collingwood": "v Ess (H)", "Essendon": "v Coll (A)"}
    for g in afl_games_for_round:
        teams_playing.add(g.home_team)
        teams_playing.add(g.away_team)
        afl_matchup_info[g.home_team] = f"v {g.away_team[:4]} (H)"
        afl_matchup_info[g.away_team] = f"v {g.home_team[:4]} (A)"

    # ── Shared round-level data (needed by all states inc. bye) ──
    round_fixtures = get_round_fixtures(league_id, year, afl_round)
    round_scores = get_live_scores(league_id, afl_round, year)
    afl_games = get_game_statuses(afl_round, year)
    locked_ids = get_locked_player_ids(afl_round, year)

    if any(f.status == "live" for f in round_fixtures):
        gameday_state = "live"
    elif round_fixtures and all(f.status == "completed" for f in round_fixtures):
        gameday_state = "completed"
    else:
        gameday_state = "upcoming"

    live_config = LiveScoringConfig.query.get(league_id)
    live_enabled = live_config.enabled if live_config else False
    scoring = get_scoring_context(league)

    # Shared template vars passed to every render
    shared = dict(
        league=league,
        afl_round=afl_round,
        round_dates=round_dates,
        first_bounce=first_bounce,
        round_fixtures=round_fixtures,
        round_scores=round_scores,
        afl_games=afl_games,
        locked_player_ids=locked_ids,
        live_enabled=live_enabled,
        gameday_state=gameday_state,
        user_team=user_team,
        scoring=scoring,
        teams_playing=teams_playing,
        afl_matchup_info=afl_matchup_info,
    )

    # ── Find user's fixture (or bye) ──
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
        return render_template(
            "matchups/gameday.html", is_bye=True, **shared,
        )

    # ── User's matchup data ──
    is_home = fixture.home_team_id == user_team.id
    my_team = fixture.home_team if is_home else fixture.away_team
    opp_team = fixture.away_team if is_home else fixture.home_team

    my_players = get_player_score_breakdown(my_team.id, afl_round, year, league_id)
    opp_players = get_player_score_breakdown(opp_team.id, afl_round, year, league_id)

    # Sort players within each lineup type by AFL game kickoff time
    # (earliest game first = "next cab off the rank")
    _team_start = {}
    for g in afl_games_for_round:
        ts = g.scheduled_start
        for t in (g.home_team, g.away_team):
            if t not in _team_start or (ts and (not _team_start[t] or ts < _team_start[t])):
                _team_start[t] = ts

    _type_order = {"field": 0, "flex": 1, "emergency": 2, "reserve": 3}
    _far_future = datetime(2099, 1, 1)

    def _player_sort_key(p):
        return (
            _type_order.get(p.get("lineup_type", "field"), 9),
            _team_start.get(p.get("afl_team", ""), _far_future) or _far_future,
            p.get("name", ""),
        )

    my_players.sort(key=_player_sort_key)
    opp_players.sort(key=_player_sort_key)

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

    # Compute players played / eligible (only field+flex with a game this round)
    def _count_played(players):
        eligible = [p for p in players
                    if p.get("lineup_type") in ("field", "flex")
                    and p.get("afl_team", "") in teams_playing]
        played = sum(1 for p in eligible if p.get("game_started") and not p.get("is_dnp"))
        return played, len(eligible)

    my_played, my_eligible = _count_played(my_players)
    opp_played, opp_eligible = _count_played(opp_players)

    # ── Win probability + projected scores ──
    projections = None
    try:
        from models.matchup_projections import project_matchup
        projections = project_matchup(
            my_team.id, opp_team.id, afl_round, year, league_id, teams_playing
        )
    except Exception:
        logger.debug("Projection calc failed", exc_info=True)

    return render_template(
        "matchups/gameday.html",
        is_bye=False,
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
        my_played=my_played,
        my_eligible=my_eligible,
        opp_played=opp_played,
        opp_eligible=opp_eligible,
        projections=projections,
        **shared,
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


@matchups_bp.route("/<int:league_id>/power-rankings")
@login_required
def power_rankings(league_id):
    """Team power rankings — composite score separate from the ladder."""
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    from models.power_rankings import get_latest_power_rankings
    rankings = get_latest_power_rankings(league_id, league.season_year)

    # Get recent form (last 3 results) for each team
    from models.database import Fixture as Fx
    completed = (
        Fx.query
        .filter_by(league_id=league_id, status="completed", is_final=False, year=league.season_year)
        .order_by(Fx.afl_round.desc())
        .all()
    )
    team_form = {}
    for f in completed:
        if f.home_score is None or f.away_score is None:
            continue
        for tid, won in [(f.home_team_id, f.home_score > f.away_score),
                         (f.away_team_id, f.away_score > f.home_score)]:
            if tid not in team_form:
                team_form[tid] = []
            if len(team_form[tid]) < 3:
                if f.home_score == f.away_score:
                    team_form[tid].append("D")
                elif won:
                    team_form[tid].append("W")
                else:
                    team_form[tid].append("L")

    return render_template("matchups/power_rankings.html",
                           league=league,
                           rankings=rankings,
                           team_form=team_form,
                           active_tab="league",
                           active_subtab="rankings")


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

    scoring = get_scoring_context(league)

    return render_template("matchups/teams.html",
                           league=league,
                           teams=teams,
                           standing_map=standing_map,
                           scoring=scoring)


@matchups_bp.route("/<int:league_id>/history")
@login_required
def history_list(league_id):
    """List all past seasons for this league."""
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    from models.database import SeasonStanding
    # Get distinct years that have standings data
    years = (
        db.session.query(SeasonStanding.year)
        .filter_by(league_id=league_id)
        .distinct()
        .order_by(SeasonStanding.year.desc())
        .all()
    )
    years = [y[0] for y in years]

    scoring = get_scoring_context(league)

    return render_template("matchups/history.html",
                           league=league,
                           years=years,
                           scoring=scoring)


@matchups_bp.route("/<int:league_id>/history/<int:year>")
@login_required
def season_archive(league_id, year):
    """View a single past season's standings, trades, and draft picks."""
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    from models.database import SeasonStanding, Trade, DraftPick

    # Standings
    standings = (
        SeasonStanding.query.filter_by(league_id=league_id, year=year)
        .order_by(
            SeasonStanding.ladder_points.desc(),
            SeasonStanding.percentage.desc(),
        )
        .all()
    )

    # Trades from that year
    trades = []
    try:
        trades = (
            Trade.query
            .filter_by(league_id=league_id)
            .filter(
                Trade.status == "accepted",
                db.extract("year", Trade.created_at) == year,
            )
            .order_by(Trade.created_at.desc())
            .limit(50)
            .all()
        )
    except Exception:
        pass

    # Draft picks from that year (via DraftSession)
    draft_picks = []
    try:
        from models.database import DraftSession
        sessions = DraftSession.query.filter_by(
            league_id=league_id, status="completed"
        ).all()
        for sess in sessions:
            if sess.completed_at and sess.completed_at.year == year:
                draft_picks.extend(
                    DraftPick.query.filter_by(draft_session_id=sess.id)
                    .order_by(DraftPick.pick_number)
                    .all()
                )
    except Exception:
        pass

    scoring = get_scoring_context(league)

    return render_template("matchups/season_archive.html",
                           league=league,
                           year=year,
                           standings=standings,
                           trades=trades,
                           draft_picks=draft_picks,
                           scoring=scoring)


@matchups_bp.route("/<int:league_id>/results")
@login_required
def results_view(league_id):
    """Redirect to the unified fixture view (results merged into season view)."""
    return redirect(url_for("matchups.fixture_view", league_id=league_id))


@matchups_bp.route("/<int:league_id>/finals")
@login_required
def finals_view(league_id):
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    finals = get_finals(league_id, league.season_year)
    is_commissioner = league.commissioner_id == current_user.id

    scoring = get_scoring_context(league)

    return render_template("matchups/finals.html",
                           league=league,
                           finals=finals,
                           is_commissioner=is_commissioner,
                           scoring=scoring)


@matchups_bp.route("/<int:league_id>/finals/generate", methods=["POST"])
@login_required
def generate_finals_view(league_id):
    league = db.session.get(League, league_id)
    if not league or league.commissioner_id != current_user.id:
        flash("Only the commissioner can generate finals.", "warning")
        return redirect(url_for("matchups.finals_view", league_id=league_id))

    finals, error = generate_finals(league_id, league.season_year)

    # Auto-generate 7s finals to match (respects SeasonConfig.finals_teams)
    if not error:
        from models.fixture_manager import generate_7s_finals
        generate_7s_finals(league_id, league.season_year)

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
                    from models.notification_manager import create_notification
                    from models.database import AflPlayer
                    delisted_player = db.session.get(AflPlayer, player_id)
                    player_name = delisted_player.name if delisted_player else "Unknown"
                    other_teams = FantasyTeam.query.filter(
                        FantasyTeam.league_id == league_id,
                        FantasyTeam.id != user_team.id,
                    ).all()
                    for t in other_teams:
                        create_notification(
                            user_id=t.owner_id,
                            league_id=league_id,
                            notif_type="list_change",
                            title=f"{user_team.name} delisted {player_name}",
                            link=url_for("leagues.list_changes_page", league_id=league_id),
                        )
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


@matchups_bp.route("/<int:league_id>/team-lineups")
@login_required
def team_lineups(league_id):
    """AFL team lineups page — shows official team selections with roster indicators."""
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year

    # Build round list from Fixture schedule (all rounds, like the fixture tab)
    round_rows = (
        db.session.query(Fixture.afl_round)
        .filter_by(league_id=league_id, year=year, is_final=False)
        .distinct()
        .order_by(Fixture.afl_round)
        .all()
    )
    round_list = [r[0] for r in round_rows]

    # Track which rounds have lineup data
    lineup_rounds = set(
        r[0] for r in db.session.query(AflTeamSelection.afl_round)
        .filter_by(year=year).distinct().all()
    )

    if not round_list:
        return render_template("matchups/team_lineups.html",
                               league=league,
                               round_list=[],
                               lineup_rounds=set(),
                               selected_round=None,
                               matches=[],
                               rostered_set=set(),
                               injury_map={},
                               TEAM_LOGOS=TEAM_LOGOS,
                               TEAM_COLOURS=TEAM_COLOURS)

    # Selected round: query param, or latest round with lineup data, or current gameday round
    selected_round = request.args.get("round", type=int)
    if selected_round is None or selected_round not in round_list:
        # Default to latest round with lineup data
        rounds_with_data = [r for r in round_list if r in lineup_rounds]
        if rounds_with_data:
            selected_round = rounds_with_data[-1]
        else:
            selected_round = _detect_gameday_round(league_id, year) or round_list[0]

    # Get all selections for the round
    selections = (
        AflTeamSelection.query
        .filter_by(year=year, afl_round=selected_round)
        .all()
    )

    # Get AFL games for this round (for venue/time info)
    afl_games = AflGame.query.filter_by(year=year, afl_round=selected_round).all()
    game_map = {}  # (home_team, away_team) -> AflGame
    team_to_game = {}  # team_name -> AflGame
    for g in afl_games:
        game_map[(g.home_team, g.away_team)] = g
        team_to_game[g.home_team] = g
        team_to_game[g.away_team] = g

    # Build rostered set: player IDs on the current user's fantasy roster
    rostered_set = set()
    if user_team:
        roster_rows = FantasyRoster.query.filter_by(
            team_id=user_team.id, is_active=True
        ).all()
        rostered_set = {r.player_id for r in roster_rows if r.player_id}

    # Build injury map: player_id -> severity
    from models.database import AflPlayer
    injured = AflPlayer.query.filter(AflPlayer.injury_severity.isnot(None)).all()
    injury_map = {p.id: p.injury_severity for p in injured}

    # Group selections by team
    from collections import defaultdict
    team_selections = defaultdict(list)
    for sel in selections:
        team_selections[sel.afl_team].append(sel)

    # Build match list from AflGame schedule
    from scrapers.team_lineups import group_selections_by_line
    matches = []
    seen_teams = set()

    for g in sorted(afl_games, key=lambda g: g.scheduled_start or datetime(2099, 1, 1)):
        home_sels = team_selections.get(g.home_team, [])
        away_sels = team_selections.get(g.away_team, [])
        seen_teams.add(g.home_team)
        seen_teams.add(g.away_team)

        matches.append({
            "game": g,
            "home_team": g.home_team,
            "away_team": g.away_team,
            "venue": g.venue,
            "start_time": g.scheduled_start,
            "home_lines": group_selections_by_line(home_sels),
            "away_lines": group_selections_by_line(away_sels),
        })

    # Handle teams with selections but no AflGame entry (fallback)
    remaining_teams = set(team_selections.keys()) - seen_teams
    if remaining_teams:
        # Group remaining by match_id
        match_groups = defaultdict(list)
        for team in remaining_teams:
            for sel in team_selections[team]:
                key = sel.match_id or team
                match_groups[key].append(sel)

        for key, sels in match_groups.items():
            teams_in_match = list({s.afl_team for s in sels})
            if len(teams_in_match) >= 2:
                home = teams_in_match[0]
                away = teams_in_match[1]
            else:
                home = teams_in_match[0]
                away = ""

            home_sels = [s for s in sels if s.afl_team == home]
            away_sels = [s for s in sels if s.afl_team == away]

            matches.append({
                "game": None,
                "home_team": home,
                "away_team": away,
                "venue": None,
                "start_time": None,
                "home_lines": group_selections_by_line(home_sels),
                "away_lines": group_selections_by_line(away_sels),
            })

    return render_template("matchups/team_lineups.html",
                           league=league,
                           round_list=round_list,
                           lineup_rounds=lineup_rounds,
                           selected_round=selected_round,
                           matches=matches,
                           rostered_set=rostered_set,
                           injury_map=injury_map,
                           TEAM_LOGOS=TEAM_LOGOS,
                           TEAM_COLOURS=TEAM_COLOURS)

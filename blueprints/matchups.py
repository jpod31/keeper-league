"""Matchups blueprint: fixtures, standings, scoring, finals, gameday."""

import logging
from datetime import datetime, timezone, timedelta

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, SeasonConfig, AflGame, LiveScoringConfig, Fixture, RoundScore
from models.fixture_manager import (
    get_fixture, get_round_fixtures, get_matchup,
    generate_finals, get_finals,
)
from models.scoring_engine import (
    get_standings, get_live_scores, get_scoring_context,
    compute_uf_breakdown, compute_custom_breakdown, compute_player_breakdown,
)
from models.live_sync import (
    get_locked_player_ids, get_game_statuses, get_player_score_breakdown,
)
from blueprints import check_league_access
import config
from config import TEAM_LOGOS

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

    # ── JSON API mode for React SPA ──
    if request.args.get("format") == "json":
        from models.database import WeeklyLineup, LineupSlot, ScScore

        # Cache lineup progress (played/total) per team for the selected round
        _progress_cache: dict[int, tuple[int, int]] = {}

        def _lineup_progress(team_id: int) -> tuple[int, int]:
            if team_id in _progress_cache:
                return _progress_cache[team_id]
            wl = WeeklyLineup.query.filter_by(
                team_id=team_id, afl_round=selected_round, year=year
            ).first()
            if not wl:
                _progress_cache[team_id] = (0, 0)
                return (0, 0)
            # Field = on-field only: exclude BENCH and emergency slots
            field_slots = [s for s in LineupSlot.query.filter_by(lineup_id=wl.id).all()
                           if s.position_code != "BENCH" and not s.is_emergency]
            total = len(field_slots)
            if total == 0:
                _progress_cache[team_id] = (0, 0)
                return (0, 0)
            pids = [s.player_id for s in field_slots if s.player_id]
            played = ScScore.query.filter(
                ScScore.year == year,
                ScScore.round == selected_round,
                ScScore.player_id.in_(pids),
            ).count() if pids else 0
            _progress_cache[team_id] = (played, total)
            return (played, total)

        def _ser_team(t):
            return {"id": t.id, "name": t.name, "logo_url": t.logo_url} if t else None

        def _ser_fixture(f):
            home_played, home_total = _lineup_progress(f.home_team_id)
            away_played, away_total = _lineup_progress(f.away_team_id)
            return {
                "id": f.id,
                "home_team_id": f.home_team_id,
                "away_team_id": f.away_team_id,
                "home_team": _ser_team(f.home_team),
                "away_team": _ser_team(f.away_team),
                "home_score": f.home_score,
                "away_score": f.away_score,
                "status": f.status,
                "home_played": home_played,
                "home_total": home_total,
                "away_played": away_played,
                "away_total": away_total,
            }

        return jsonify({
            "round_meta": {str(k): v for k, v in round_meta.items()},
            "selected_round": selected_round,
            "current_fixtures": [_ser_fixture(f) for f in current_fixtures],
            "max_round": max_round,
            "scoring": scoring,
            "is_commissioner": is_commissioner,
        })

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

    # ── JSON API mode for React SPA ──
    if request.args.get("format") == "json":
        def _ser_team(t):
            return {"id": t.id, "name": t.name, "logo_url": t.logo_url} if t else None

        def _ser_fixture(f):
            return {
                "id": f.id,
                "home_team_id": f.home_team_id,
                "away_team_id": f.away_team_id,
                "home_team": _ser_team(f.home_team),
                "away_team": _ser_team(f.away_team),
                "home_score": f.home_score,
                "away_score": f.away_score,
                "status": f.status,
            }

        return jsonify({
            "afl_round": afl_round,
            "fixtures": [_ser_fixture(f) for f in fixtures],
            "is_commissioner": is_commissioner,
            "max_round": config.SC_ROUNDS,
            "scoring": scoring,
        })

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

    # ── JSON API mode for React SPA ──
    if request.args.get("format") == "json":
        def _ser_team(t):
            return {"id": t.id, "name": t.name, "logo_url": t.logo_url} if t else None

        fixture_out = {
            "id": fixture.id,
            "afl_round": fixture.afl_round,
            "home_team_id": fixture.home_team_id,
            "away_team_id": fixture.away_team_id,
            "home_team": _ser_team(fixture.home_team),
            "away_team": _ser_team(fixture.away_team),
            "home_score": fixture.home_score,
            "away_score": fixture.away_score,
            "status": fixture.status,
            "is_final": bool(fixture.is_final),
            "final_type": fixture.final_type,
        }

        return jsonify({
            "fixture": fixture_out,
            "scoring": scoring,
            "uf_breakdown": uf_breakdown,
            "custom_breakdown": custom_breakdown,
            "player_breakdown": player_breakdown,
        })

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
        .filter(Fx.afl_round > 0)
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

    # Build detailed ranking analysis per team
    ranking_details = {}
    if rankings:
        # Avg scores
        avg_rs = {}
        rs_rows = (
            db.session.query(RoundScore.team_id, db.func.avg(RoundScore.total_score))
            .filter(RoundScore.team_id.in_([r.team_id for r in rankings]), RoundScore.year == year, RoundScore.afl_round > 0)
            .group_by(RoundScore.team_id).all()
        )
        for tid, avg in rs_rows:
            avg_rs[tid] = avg
        league_avg = sum(avg_rs.values()) / len(avg_rs) if avg_rs else 0

        # Best/worst round scores
        best_worst = {}
        bw_rows = (
            db.session.query(
                RoundScore.team_id,
                db.func.max(RoundScore.total_score),
                db.func.min(RoundScore.total_score),
            )
            .filter(RoundScore.team_id.in_([r.team_id for r in rankings]), RoundScore.year == year, RoundScore.afl_round > 0)
            .group_by(RoundScore.team_id).all()
        )
        for tid, best, worst in bw_rows:
            best_worst[tid] = (best, worst)

        # Season record from standings
        record_map = {}
        for s in standing_list:
            record_map[s.team_id] = s

        for pr in rankings:
            form = team_form.get(pr.team_id, [])
            wins = sum(1 for r in form if r == "W")
            losses = sum(1 for r in form if r == "L")
            draws = sum(1 for r in form if r == "D")
            avg = avg_rs.get(pr.team_id, 0)
            pct_above = ((avg - league_avg) / league_avg * 100) if league_avg > 0 else 0
            best, worst = best_worst.get(pr.team_id, (0, 0))
            rec = record_map.get(pr.team_id)

            # Headline blurb
            if wins >= 4 and pct_above > 10:
                headline = "Dominant"
            elif wins >= 3 and len(form) <= 4:
                headline = "On fire"
            elif pr.movement >= 3:
                headline = "Surging"
            elif losses >= 4:
                headline = "In freefall"
            elif pr.movement <= -3:
                headline = "Sliding"
            elif losses >= 3:
                headline = "Struggling"
            elif pct_above > 5:
                headline = "Strong"
            elif pct_above < -5:
                headline = "Underperforming"
            else:
                headline = "Steady"

            ranking_details[pr.team_id] = {
                "headline": headline,
                "avg_score": round(avg, 1),
                "league_avg": round(league_avg, 1),
                "pct_above": round(pct_above, 1),
                "best_round": round(best, 0) if best else 0,
                "worst_round": round(worst, 0) if worst else 0,
                "record": f"{rec.wins if rec else 0}W {rec.losses if rec else 0}L" + (f" {rec.draws}D" if rec and rec.draws else ""),
                "form_wins": wins,
                "form_losses": losses,
                "form_total": len(form),
            }

    # ── JSON API mode for React SPA ──
    if request.args.get("format") == "json":
        def _ser_standing(s):
            t = s.team
            return {
                "team_id": s.team_id,
                "team": {"id": t.id, "name": t.name, "logo_url": t.logo_url} if t else None,
                "wins": s.wins,
                "losses": s.losses,
                "draws": s.draws,
                "ladder_points": s.ladder_points,
                "points_for": s.points_for,
                "points_against": s.points_against,
                "percentage": s.percentage,
            }

        def _ser_ranking(pr):
            t = pr.team
            return {
                "rank": pr.rank,
                "movement": pr.movement,
                "team_id": pr.team_id,
                "team": {"id": t.id, "name": t.name} if t else None,
                "score": pr.score,
                "afl_round": pr.afl_round,
            }

        return jsonify({
            "standings": [_ser_standing(s) for s in standing_list],
            "finals_teams": finals_teams,
            "scoring": scoring,
            "rankings": [_ser_ranking(r) for r in (rankings or [])],
            "ranking_details": {str(k): v for k, v in ranking_details.items()},
            "team_form": {str(k): v for k, v in team_form.items()},
            "user_team_id": user_team.id if user_team else None,
        })

    return render_template("matchups/standings.html",
                           league=league,
                           standings=standing_list,
                           finals_teams=finals_teams,
                           scoring=scoring,
                           rankings=rankings,
                           team_form=team_form,
                           ranking_details=ranking_details)




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

    # Allow manual round override via query param, else auto-detect
    afl_round = request.args.get("round", type=int)
    if afl_round is None:
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
        if request.args.get("format") == "json":
            return jsonify({"is_bye": True, "afl_round": afl_round, "round_dates": round_dates,
                "gameday_state": gameday_state, "round_fixtures": [], "round_scores": {},
                "afl_games": [], "teams_playing": list(teams_playing), "team_logos": TEAM_LOGOS, "team_abbr": config.TEAM_ABBR})
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
        team = p.get("afl_team", "")
        return (
            _type_order.get(p.get("lineup_type", "field"), 9),
            _team_start.get(team, _far_future) or _far_future,
            team,
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
                    if p.get("lineup_type") == "field"
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

    # ── JSON API mode for React SPA ──
    if request.args.get("format") == "json":
        def _ser_team(t):
            return {"id": t.id, "name": t.name, "logo_url": t.logo_url} if t else None

        def _ser_fixture(f):
            return {
                "id": f.id, "home_team_id": f.home_team_id, "away_team_id": f.away_team_id,
                "home_score": f.home_score, "away_score": f.away_score, "status": f.status,
                "home_team": _ser_team(f.home_team), "away_team": _ser_team(f.away_team),
            }

        # afl_games is already a list of dicts from get_game_statuses()

        _rs_data = {}
        for f in round_fixtures:
            for tid in (f.home_team_id, f.away_team_id):
                rs = round_scores.get(tid, {})
                _rs_data[tid] = rs if isinstance(rs, dict) else {"total_score": rs.total_score if hasattr(rs, "total_score") else 0}

        return jsonify({
            "is_bye": False,
            "afl_round": afl_round,
            "round_dates": round_dates,
            "first_bounce": first_bounce,
            "gameday_state": gameday_state,
            "live_enabled": live_enabled,
            "is_home": is_home,
            "fixture": _ser_fixture(fixture),
            "my_team": _ser_team(my_team),
            "opp_team": _ser_team(opp_team),
            "my_players": my_players,
            "opp_players": opp_players,
            "my_score": my_score,
            "opp_score": opp_score,
            "my_captain_bonus": my_captain_bonus,
            "opp_captain_bonus": opp_captain_bonus,
            "my_played": my_played,
            "my_eligible": my_eligible,
            "opp_played": opp_played,
            "opp_eligible": opp_eligible,
            "projections": {
                "my_projected": projections.get("my_projected", 0) if isinstance(projections, dict) else getattr(projections, "my_projected", 0),
                "opp_projected": projections.get("opp_projected", 0) if isinstance(projections, dict) else getattr(projections, "opp_projected", 0),
                "my_win_pct": projections.get("my_win_pct", 50) if isinstance(projections, dict) else getattr(projections, "my_win_pct", 50),
                "opp_win_pct": projections.get("opp_win_pct", 50) if isinstance(projections, dict) else getattr(projections, "opp_win_pct", 50),
            } if projections else None,
            "round_fixtures": [_ser_fixture(f) for f in round_fixtures],
            "round_scores": {str(k): v if isinstance(v, dict) else {"total_score": v.total_score if hasattr(v, "total_score") else 0} for k, v in round_scores.items()},
            "afl_games": afl_games or [],
            "locked_player_ids": list(locked_ids),
            "teams_playing": list(teams_playing),
            "afl_matchup_info": afl_matchup_info,
            "team_logos": TEAM_LOGOS,
            "team_abbr": config.TEAM_ABBR,
        })

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


@matchups_bp.route("/<int:league_id>/gameday/api/fixtures")
@login_required
def api_gameday_fixtures(league_id):
    """Return all fixture player breakdowns for the current gameday round."""
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "League not found"}), 404

    year = league.season_year
    afl_round = request.args.get("round", type=int)
    if afl_round is None:
        afl_round = _detect_gameday_round(league_id, year)
    if afl_round is None:
        return jsonify({"error": "No round detected"}), 404

    round_fixtures = get_round_fixtures(league_id, year, afl_round)
    locked_ids = get_locked_player_ids(afl_round, year)

    # Teams playing this round (needed for projections)
    teams_playing = set()
    for g in AflGame.query.filter_by(year=year, afl_round=afl_round).all():
        teams_playing.add(g.home_team)
        teams_playing.add(g.away_team)

    from models.matchup_projections import project_matchup

    fixtures_out = []
    for f in round_fixtures:
        home_players = get_player_score_breakdown(f.home_team_id, afl_round, year, league_id)
        away_players = get_player_score_breakdown(f.away_team_id, afl_round, year, league_id)

        home_rs = RoundScore.query.filter_by(team_id=f.home_team_id, afl_round=afl_round, year=year).first()
        away_rs = RoundScore.query.filter_by(team_id=f.away_team_id, afl_round=afl_round, year=year).first()

        # Projections per fixture
        proj = None
        try:
            proj = project_matchup(
                f.home_team_id, f.away_team_id, afl_round, year, league_id, teams_playing
            )
        except Exception:
            pass

        fx_out = {
            "fixture_id": f.id,
            "home_team_id": f.home_team_id,
            "away_team_id": f.away_team_id,
            "home_score": home_rs.total_score if home_rs else 0,
            "away_score": away_rs.total_score if away_rs else 0,
            "home_captain_bonus": home_rs.captain_bonus if home_rs else 0,
            "away_captain_bonus": away_rs.captain_bonus if away_rs else 0,
            "home_players": home_players,
            "away_players": away_players,
            "status": f.status,
        }
        if proj:
            fx_out["projections"] = {
                "home_projected": proj["my_projected"],
                "away_projected": proj["opp_projected"],
                "home_win_pct": proj["my_win_pct"],
                "away_win_pct": proj["opp_win_pct"],
            }
        fixtures_out.append(fx_out)

    # Include team metadata so React can render hero with logos when switching matchups
    teams_meta = {}
    for f in round_fixtures:
        for t in (f.home_team, f.away_team):
            if t and t.id not in teams_meta:
                teams_meta[t.id] = {"id": t.id, "name": t.name, "logo_url": t.logo_url}

    return jsonify({
        "fixtures": fixtures_out,
        "locked_player_ids": list(locked_ids),
        "teams_playing": list(teams_playing),
        "teams_meta": teams_meta,
    })


@matchups_bp.route("/<int:league_id>/afl-live")
@login_required
def afl_live(league_id):
    """AFL live matchup hub — vertical list of all games for the current round."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    afl_round = request.args.get("round", type=int)
    if afl_round is None:
        afl_round = _detect_gameday_round(league_id, year)
    if afl_round is None:
        afl_round = 1

    afl_games = get_game_statuses(afl_round, year)

    # Round dates
    afl_games_db = (
        AflGame.query.filter_by(year=year, afl_round=afl_round)
        .order_by(AflGame.scheduled_start).all()
    )
    starts = [g.scheduled_start for g in afl_games_db if g.scheduled_start]
    round_dates = None
    if starts:
        earliest, latest = min(starts), max(starts)
        fmt = lambda dt: f"{dt.strftime('%a')} {dt.day} {dt.strftime('%b')}"
        round_dates = fmt(earliest) if earliest.date() == latest.date() else f"{fmt(earliest)} – {fmt(latest)}"

    if request.args.get("format") == "json":
        def _game(g):
            ss = g.get("scheduled_start")
            if ss and hasattr(ss, "isoformat"):
                ss = ss.isoformat()
            status = g.get("status", "scheduled")
            return {
                "game_id": g.get("game_id"),
                "home_team": g.get("home_team"),
                "away_team": g.get("away_team"),
                "home_score": g.get("home_score"),
                "away_score": g.get("away_score"),
                "home_goals": g.get("home_goals"),
                "home_behinds": g.get("home_behinds"),
                "away_goals": g.get("away_goals"),
                "away_behinds": g.get("away_behinds"),
                "status": status,
                "quarter": g.get("quarter"),
                "time_remaining": g.get("time_remaining"),
                "is_live": g.get("is_live", status == "live"),
                "is_complete": g.get("is_complete", status == "complete"),
                "scheduled_display": g.get("scheduled_display"),
                "scheduled_start": ss,
                "venue": g.get("venue"),
            }
        return jsonify({
            "league": {"id": league.id, "name": league.name},
            "afl_round": afl_round,
            "round_dates": round_dates,
            "games": [_game(g) for g in afl_games],
        })

    return render_template(
        "matchups/afl_live.html",
        league=league,
        afl_round=afl_round,
        afl_games=afl_games,
        round_dates=round_dates,
    )


@matchups_bp.route("/<int:league_id>/gameday/afl-game/<int:game_id>")
@login_required
def afl_game_view(league_id, game_id):
    """Show all players and SC scores for a specific AFL game."""
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    game = db.session.get(AflGame, game_id)
    if not game:
        flash("Game not found.", "warning")
        return redirect(url_for("matchups.gameday", league_id=league_id))

    from models.database import PlayerStat, AflPlayer

    # Get all players from both teams with stats for this round
    home_players = []
    away_players = []

    # Which team to show (default home, toggle via query param)
    show_team = request.args.get("team", "home")

    from models.database import AflTeamSelection

    # Pre-fetch jumper numbers for this round
    selections = AflTeamSelection.query.filter_by(year=game.year, afl_round=game.afl_round).all()
    jumper_map = {}          # (full_name, team) -> number
    jumper_map_surname = {}  # (surname, team) -> number  (fallback for nickname mismatches)
    for s in selections:
        jumper_map[(s.player_name, s.afl_team)] = s.jumper_number
        surname = s.player_name.rsplit(" ", 1)[-1].lower()
        jumper_map_surname[(surname, s.afl_team)] = s.jumper_number

    for team_name, player_list in [(game.home_team, home_players), (game.away_team, away_players)]:
        players = AflPlayer.query.filter_by(afl_team=team_name).all()
        for p in players:
            stat = PlayerStat.query.filter_by(
                player_id=p.id, year=game.year, round=game.afl_round
            ).first()
            if stat and stat.supercoach_score is not None:
                jumper = jumper_map.get((p.name, team_name))
                if jumper is None:
                    surname = p.name.rsplit(" ", 1)[-1].lower()
                    jumper = jumper_map_surname.get((surname, team_name), "")
                player_list.append({
                    "name": p.name,
                    "position": p.position or "",
                    "jumper": jumper,
                    "sc_score": stat.supercoach_score,
                    "is_live": stat.is_live if stat else False,
                    "injury": p.injury_type or "",
                    "kicks": stat.kicks or 0,
                    "handballs": stat.handballs or 0,
                    "disposals": stat.disposals or 0,
                    "marks": stat.marks or 0,
                    "tackles": stat.tackles or 0,
                    "goals": stat.goals or 0,
                    "behinds": stat.behinds or 0,
                    "hitouts": stat.hitouts or 0,
                })

        player_list.sort(key=lambda x: x["sc_score"], reverse=True)

    return render_template(
        "matchups/afl_game.html",
        league=league,
        game=game,
        home_players=home_players,
        away_players=away_players,
        show_team=show_team,
    )


@matchups_bp.route("/<int:league_id>/gameday/api/afl-game/<int:game_id>")
@login_required
def api_afl_game(league_id, game_id):
    """API: return player SC scores for an AFL game."""
    game = db.session.get(AflGame, game_id)
    if not game:
        return jsonify({"error": "Game not found"}), 404

    from models.database import PlayerStat, AflPlayer

    result = {"home": [], "away": [], "game": {
        "home_team": game.home_team,
        "away_team": game.away_team,
        "status": game.status,
        "home_score": game.home_score,
        "away_score": game.away_score,
    }}

    for team_name, key in [(game.home_team, "home"), (game.away_team, "away")]:
        players = AflPlayer.query.filter_by(afl_team=team_name).all()
        for p in players:
            stat = PlayerStat.query.filter_by(
                player_id=p.id, year=game.year, round=game.afl_round
            ).first()
            if stat and stat.supercoach_score is not None:
                result[key].append({
                    "name": p.name,
                    "position": p.position or "",
                    "jumper": None,
                    "sc_score": stat.supercoach_score,
                    "kicks": stat.kicks or 0,
                    "handballs": stat.handballs or 0,
                    "disposals": stat.disposals or 0,
                    "marks": stat.marks or 0,
                    "tackles": stat.tackles or 0,
                    "goals": stat.goals or 0,
                    "behinds": stat.behinds or 0,
                    "hitouts": stat.hitouts or 0,
                    "is_live": stat.is_live if stat else False,
                })

        result[key].sort(key=lambda x: x["sc_score"], reverse=True)

    result["team_logos"] = TEAM_LOGOS
    return jsonify(result)


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

    if request.args.get("format") == "json":
        def _ser_team(t):
            return {"id": t.id, "name": t.name} if t else None

        return jsonify({
            "league": {"id": league.id, "name": league.name, "season_year": league.season_year},
            "is_commissioner": is_commissioner,
            "scoring": scoring,
            "finals": [{
                "id": f.id,
                "final_type": f.final_type,
                "status": f.status,
                "home_team": _ser_team(f.home_team),
                "away_team": _ser_team(f.away_team),
                "home_score": f.home_score,
                "away_score": f.away_score,
            } for f in (finals or [])],
        })

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




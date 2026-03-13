"""League player pages: pool, injuries, ratings, compare, stats, keepers, records, list changes."""

import os
import re
import json
import statistics
from collections import defaultdict

import pandas as pd
from flask import render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam, FantasyRoster, AflPlayer, DraftPick, DraftSession
import config
from blueprints.leagues import leagues_bp, _round_sort_key, _compute_rolling_averages

@leagues_bp.route("/<int:league_id>/injuries")
@login_required
def player_injuries(league_id):
    from blueprints import check_league_access
    from scrapers.afl_injuries import friendly_return_text
    from scrapers.squiggle import get_current_round

    league, _ = check_league_access(league_id)
    if not league:
        flash("League not found or access denied.", "warning")
        return redirect(url_for("leagues.league_list"))

    # All injured/suspended players
    players = AflPlayer.query.filter(AflPlayer.injury_severity.isnot(None)).order_by(AflPlayer.name).all()

    # Build rostered lookup: player_id -> team name
    rostered_map = {}
    roster_rows = (
        db.session.query(FantasyRoster.player_id, FantasyTeam.name)
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
        .all()
    )
    for pid, tname in roster_rows:
        rostered_map[pid] = tname

    # Current round for friendly return text
    current_round = get_current_round(config.CURRENT_YEAR)

    # Compute return display for each player
    for p in players:
        p._return_display = friendly_return_text(p.injury_return, current_round)

    # Fantasy teams for owner filter dropdown
    fantasy_teams = sorted(
        [t.name for t in FantasyTeam.query.filter_by(league_id=league_id).all()]
    )

    return render_template(
        "leagues/player_injuries.html",
        league=league,
        players=players,
        rostered_map=rostered_map,
        current_round=current_round,
        fantasy_teams=fantasy_teams,
    )


@leagues_bp.route("/<int:league_id>/player-ratings")
@login_required
def player_ratings(league_id):
    from blueprints import check_league_access
    from models.database import RatingLog

    league, _ = check_league_access(league_id)
    if not league:
        flash("League not found or access denied.", "warning")
        return redirect(url_for("leagues.league_list"))

    # ── Last Update: most recent sync batch ──
    latest_ts = db.session.query(db.func.max(RatingLog.changed_at)).scalar()
    last_update = []
    last_update_date = None
    if latest_ts:
        cutoff = latest_ts - timedelta(minutes=5)
        last_update = (
            db.session.query(RatingLog, AflPlayer.name, AflPlayer.afl_team, AflPlayer.position)
            .join(AflPlayer, RatingLog.player_id == AflPlayer.id)
            .filter(RatingLog.changed_at >= cutoff)
            .order_by(
                db.case(
                    (RatingLog.new_rating > RatingLog.old_rating, 0),
                    (RatingLog.new_rating < RatingLog.old_rating, 1),
                    else_=2,
                ),
                (RatingLog.new_rating - RatingLog.old_rating).desc(),
            )
            .all()
        )
        last_update_date = latest_ts

    # ── Season Movers: rating != rating_start ──
    season_movers = (
        AflPlayer.query
        .filter(
            AflPlayer.rating.isnot(None),
            AflPlayer.rating_start.isnot(None),
            AflPlayer.rating != AflPlayer.rating_start,
        )
        .all()
    )
    season_movers.sort(key=lambda p: abs(p.rating - p.rating_start), reverse=True)

    return render_template(
        "leagues/player_ratings.html",
        league=league,
        last_update=last_update,
        last_update_date=last_update_date,
        season_movers=season_movers,
    )


@leagues_bp.route("/<int:league_id>/player-pool")
@login_required
def player_pool(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    # Get ALL players — rank with user/league weights so values match draft room
    from models.draft_model import rank_players_for_user
    ranked = rank_players_for_user(league_id, current_user.id)
    # ranked is list of (AflPlayer, score) — write personalised score onto each ORM object
    players = []
    for i, (ap, score) in enumerate(ranked, 1):
        ap.draft_score = score
        ap._rank = i
        players.append(ap)
    # Also include unranked players (those with no data) at the end
    ranked_ids = {ap.id for ap, _ in ranked}
    unranked = AflPlayer.query.filter(~AflPlayer.id.in_(ranked_ids)).all() if ranked_ids else AflPlayer.query.all()
    for ap in unranked:
        ap._rank = len(players) + 1
        players.append(ap)

    # Build rostered lookup: player_id -> team name
    rostered_map = {}
    roster_rows = (
        db.session.query(FantasyRoster.player_id, FantasyTeam.name)
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
        .all()
    )
    for pid, tname in roster_rows:
        rostered_map[pid] = tname

    # Assign a colour to each fantasy team for status badges
    _team_palette = [
        ("#79c0ff", "rgba(88,166,255,.18)"),    # blue
        ("#ffb471", "rgba(240,136,62,.18)"),    # orange
        ("#d2a8ff", "rgba(188,140,255,.18)"),   # purple
        ("#7ee787", "rgba(63,185,80,.18)"),     # green
        ("#e3b341", "rgba(210,153,34,.18)"),    # yellow
        ("#ff7b72", "rgba(248,81,73,.18)"),     # red
        ("#a5d6ff", "rgba(121,192,255,.18)"),   # light blue
        ("#f778ba", "rgba(219,97,162,.18)"),    # pink
    ]
    unique_teams = sorted(set(rostered_map.values()))
    team_colours = {}
    for i, tname in enumerate(unique_teams):
        fg, bg = _team_palette[i % len(_team_palette)]
        team_colours[tname] = {"fg": fg, "bg": bg}

    rolling = _compute_rolling_averages()

    # SSP pickup: check if user's team is below squad_size AND within SSP window
    from models.database import SeasonConfig, AflGame, LongTermInjury
    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    roster_count = 0
    ltil_count = 0
    can_pickup = False
    ssp_cutoff_round = 4
    if user_team:
        roster_count = FantasyRoster.query.filter_by(
            team_id=user_team.id, is_active=True
        ).count()
        # LTIL players free up a list spot (approved only)
        ltil_count = LongTermInjury.query.filter_by(
            team_id=user_team.id, removed_at=None, year=league.season_year, status="approved"
        ).count()
        effective_count = roster_count - ltil_count
        below_cap = effective_count < (league.squad_size or 0)

        # Check SSP cutoff round from season config
        sc = SeasonConfig.query.filter_by(
            league_id=league_id, year=league.season_year
        ).first()
        ssp_cutoff_round = sc.ssp_cutoff_round if sc and sc.ssp_cutoff_round else 4

        # Current round = highest completed round in the league's season year
        latest_completed = (
            AflGame.query
            .filter_by(year=league.season_year, status="completed")
            .order_by(AflGame.afl_round.desc())
            .first()
        )
        current_round = latest_completed.afl_round if latest_completed else 0

        can_pickup = below_cap and current_round < ssp_cutoff_round

    # Keeper Value Index for rostered players
    rostered_pids = list(rostered_map.keys())
    kvi_map = {}
    if rostered_pids:
        from models.keeper_value import compute_keeper_values
        kvi_map = compute_keeper_values(rostered_pids, league.season_year)

    # Acquisition info: player_id -> {coach, method, pick_number, draft_year, draft_type}
    acquired_map = {}
    acq_rows = (
        db.session.query(
            FantasyRoster.player_id,
            FantasyRoster.acquired_via,
            FantasyRoster.acquired_at,
            FantasyTeam.name.label("team_name"),
            FantasyTeam.owner_id,
        )
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
        .all()
    )
    from models.database import User
    owner_ids = {r.owner_id for r in acq_rows if r.owner_id}
    owner_names = {}
    if owner_ids:
        for u in User.query.filter(User.id.in_(owner_ids)).all():
            owner_names[u.id] = u.display_name or u.username
    # Get draft pick details for players acquired via draft/supplemental
    draft_pick_map = {}
    league_drafts = DraftSession.query.filter_by(league_id=league_id, status="completed").all()
    if league_drafts:
        ds_ids = [ds.id for ds in league_drafts]
        draft_picks = DraftPick.query.filter(
            DraftPick.draft_session_id.in_(ds_ids),
            DraftPick.player_id.isnot(None),
        ).all()
        ds_lookup = {ds.id: ds for ds in league_drafts}
        for dp in draft_picks:
            ds = ds_lookup.get(dp.draft_session_id)
            draft_pick_map[dp.player_id] = {
                "pick_number": dp.pick_number,
                "draft_year": ds.started_at.year if ds and ds.started_at else (ds.scheduled_start.year if ds and ds.scheduled_start else ""),
                "draft_type": ds.draft_round_type if ds else "initial",
            }

    for r in acq_rows:
        info = {
            "coach": owner_names.get(r.owner_id, ""),
            "method": r.acquired_via or "draft",
            "acquired_at": r.acquired_at,
        }
        dp = draft_pick_map.get(r.player_id)
        if dp and r.acquired_via in ("draft", "supplemental", None):
            info["pick_number"] = dp["pick_number"]
            info["draft_year"] = dp["draft_year"]
            info["draft_type"] = dp["draft_type"]
        acquired_map[r.player_id] = info

    # Build set of player IDs selected to play this round (for status dot)
    from models.database import AflTeamSelection
    from scrapers.squiggle import get_current_round
    current_afl_round = get_current_round(config.CURRENT_YEAR)
    if current_afl_round is None:
        current_afl_round = 0
    selected_set = set(
        r[0] for r in db.session.query(AflTeamSelection.player_id)
        .filter_by(year=config.CURRENT_YEAR, afl_round=current_afl_round)
        .filter(AflTeamSelection.player_id.isnot(None))
        .all()
    )

    return render_template("leagues/player_pool.html",
                           league=league,
                           players=players,
                           rolling=rolling,
                           rostered_map=rostered_map,
                           team_colours=team_colours,
                           user_team=user_team,
                           roster_count=roster_count,
                           effective_roster_count=roster_count - ltil_count,
                           ltil_count=ltil_count,
                           can_pickup=can_pickup,
                           ssp_cutoff_round=ssp_cutoff_round,
                           kvi_map=kvi_map,
                           acquired_map=acquired_map,
                           selected_set=selected_set)


@leagues_bp.route("/<int:league_id>/player-pool/pickup", methods=["POST"])
@login_required
def player_pickup(league_id):
    """Pick up a free agent when team is below squad_size."""
    league = db.session.get(League, league_id)
    if not league:
        return jsonify({"error": "League not found"}), 404

    user_team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    if not user_team:
        return jsonify({"error": "You don't have a team in this league"}), 403

    from models.database import SeasonConfig, AflGame, LongTermInjury
    roster_count = FantasyRoster.query.filter_by(
        team_id=user_team.id, is_active=True
    ).count()
    # LTIL players free up a list spot (approved only)
    ltil_count = LongTermInjury.query.filter_by(
        team_id=user_team.id, removed_at=None, year=league.season_year, status="approved"
    ).count()
    effective_count = roster_count - ltil_count
    if effective_count >= (league.squad_size or 0):
        return jsonify({"error": "Your roster is full (%d/%d)" % (effective_count, league.squad_size)}), 409

    # Check SSP cutoff round
    sc = SeasonConfig.query.filter_by(
        league_id=league_id, year=league.season_year
    ).first()
    cutoff = sc.ssp_cutoff_round if sc and sc.ssp_cutoff_round else 4
    latest_completed = (
        AflGame.query
        .filter_by(year=league.season_year, status="completed")
        .order_by(AflGame.afl_round.desc())
        .first()
    )
    current_round = latest_completed.afl_round if latest_completed else 0
    if current_round >= cutoff:
        return jsonify({"error": "SSP pickup window closed after Round %d" % cutoff}), 409

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    player = db.session.get(AflPlayer, player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404

    # Check player isn't already rostered in this league
    already = (
        db.session.query(FantasyRoster.id)
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyRoster.player_id == player_id,
            FantasyRoster.is_active == True,
        )
        .first()
    )
    if already:
        return jsonify({"error": "%s is already rostered" % player.name}), 409

    # Add to roster
    entry = FantasyRoster(
        team_id=user_team.id,
        player_id=player_id,
        is_active=True,
        acquired_via="ssp",
    )
    db.session.add(entry)
    db.session.commit()

    # Notify all league members about the SSP signing
    from models.notification_manager import create_notification
    all_teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    for t in all_teams:
        create_notification(
            user_id=t.owner_id,
            league_id=league_id,
            notif_type="list_change",
            title=f"{user_team.name} signed {player.name} (SSP)",
            body=f"{user_team.name} selected {player.name} as an SSP replacement.",
            link=url_for("leagues.list_changes_page", league_id=league_id),
        )

    new_count = FantasyRoster.query.filter_by(
        team_id=user_team.id, is_active=True
    ).count()
    new_ltil = LongTermInjury.query.filter_by(
        team_id=user_team.id, removed_at=None, year=league.season_year, status="approved"
    ).count()
    return jsonify({
        "ok": True,
        "player_name": player.name,
        "roster_count": new_count - new_ltil,
        "squad_size": league.squad_size,
    })


@leagues_bp.route("/<int:league_id>/players/compare")
@login_required
def player_compare(league_id):
    """Compare up to 4 players side-by-side."""
    from blueprints import check_league_access
    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    player_ids = request.args.getlist("p", type=int)

    from models.analytics import get_player_comparison_data
    players_data = get_player_comparison_data(player_ids, league.season_year, league_id)

    # Get searchable player list for selectors
    all_players = (
        AflPlayer.query
        .filter(AflPlayer.sc_avg.isnot(None))
        .order_by(AflPlayer.sc_avg.desc())
        .limit(500)
        .all()
    )

    return render_template("leagues/player_compare.html",
                           league=league,
                           players_data=players_data,
                           selected_ids=player_ids,
                           all_players=all_players,
                           active_tab="players")


# ── Keeper Value Tracking ────────────────────────────────────────────


@leagues_bp.route("/<int:league_id>/keepers")
@login_required
def keeper_values(league_id):
    """Keeper value tracker: shows draft cost vs current value for every rostered player."""
    from blueprints import check_league_access

    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    # ── Gather all teams and their active rosters ────────────────────
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    team_map = {t.id: t for t in teams}

    rosters = (
        FantasyRoster.query
        .filter(
            FantasyRoster.team_id.in_([t.id for t in teams]),
            FantasyRoster.is_active == True,
        )
        .all()
    )

    # ── Build draft-pick lookup: player_id -> DraftPick ──────────────
    # Get all draft sessions for this league (initial + supplemental)
    sessions = DraftSession.query.filter_by(league_id=league_id).all()
    session_ids = [s.id for s in sessions]
    session_map = {s.id: s for s in sessions}

    draft_picks = (
        DraftPick.query
        .filter(
            DraftPick.draft_session_id.in_(session_ids),
            DraftPick.player_id.isnot(None),
        )
        .all()
    ) if session_ids else []

    # Map player_id -> their draft pick info
    player_draft = {}  # player_id -> {round, round_type, pick_number}
    for dp in draft_picks:
        sess = session_map.get(dp.draft_session_id)
        round_type = sess.draft_round_type if sess else "initial"
        # Keep the earliest draft pick if a player was drafted multiple times
        if dp.player_id not in player_draft:
            player_draft[dp.player_id] = {
                "round": dp.draft_round,
                "pick_number": dp.pick_number,
                "round_type": round_type,
                "total_rounds": sess.total_rounds if sess else 10,
            }

    # ── Determine total rounds for baseline calculation ──────────────
    initial_sessions = [s for s in sessions if s.draft_round_type == "initial"]
    total_rounds = max((s.total_rounds or 10 for s in initial_sessions), default=10)

    # ── Find the best draft_score among all rostered players ─────────
    rostered_player_ids = [r.player_id for r in rosters]
    all_rostered_players = (
        AflPlayer.query
        .filter(AflPlayer.id.in_(rostered_player_ids))
        .all()
    ) if rostered_player_ids else []
    player_obj_map = {p.id: p for p in all_rostered_players}

    best_draft_score = max(
        (p.draft_score for p in all_rostered_players if p.draft_score),
        default=1.0,
    )
    if best_draft_score <= 0:
        best_draft_score = 1.0

    # Baseline value per round: what a "fair" pick at each round is worth
    baseline_per_round = best_draft_score / total_rounds

    # ── Keeper longevity multiplier (from draft_model.py) ────────────
    # Players 29+ lose 8% per year over 30, floor 0.55
    def _keeper_age_mult(age):
        if age is None:
            return 1.0
        if age > 30:
            return max(0.55, 1.0 - (age - 30) * 0.08)
        return 1.0

    # ── Compute rolling averages for trend data ──────────────────────
    rolling = _compute_rolling_averages()

    # ── Build per-team keeper data ───────────────────────────────────
    teams_data = []  # list of {team, players: [{...}]}

    # Collect all keeper entries for the projected rankings
    all_keepers = []

    for team in sorted(teams, key=lambda t: t.name):
        team_rosters = [r for r in rosters if r.team_id == team.id]
        team_players = []

        for roster_entry in team_rosters:
            player = player_obj_map.get(roster_entry.player_id)
            if not player:
                continue

            draft_info = player_draft.get(player.id)
            draft_score = player.draft_score or 0

            # Determine cost label and effective round cost
            if draft_info:
                if draft_info["round_type"] == "supplemental":
                    cost_label = f"Supp R{draft_info['round']}"
                    # Supplemental picks treated as mid-round value
                    effective_round = total_rounds * 0.6
                else:
                    cost_label = f"R{draft_info['round']}"
                    effective_round = draft_info["round"]
            elif roster_entry.acquired_via == "trade":
                cost_label = "Trade"
                # Trades treated as mid-round value
                effective_round = total_rounds * 0.5
            else:
                cost_label = "Undrafted"
                # Undrafted = treat as last round pick
                effective_round = total_rounds

            # Keeper value = draft_score / (effective_round_cost * baseline)
            expected_value = effective_round * baseline_per_round
            if expected_value > 0:
                keeper_value = draft_score / expected_value
            else:
                keeper_value = 0

            # Recommendation
            if keeper_value > 1.2:
                recommendation = "KEEP"
            elif keeper_value >= 0.8:
                recommendation = "TRADE"
            else:
                recommendation = "DROP"

            # Season trend
            pr = rolling.get(player.name, {})
            sc_display = player.sc_avg or player.sc_avg_prev or 0
            if pr.get("l3") and sc_display:
                trend_val = pr["l3"] - sc_display
                trend_pct = (trend_val / sc_display * 100) if sc_display else 0
            else:
                trend_val = 0
                trend_pct = 0

            # Projected next-year value (age decline)
            age_mult_now = _keeper_age_mult(player.age)
            age_mult_next = _keeper_age_mult((player.age + 1) if player.age else None)
            projected_score = draft_score * (age_mult_next / age_mult_now) if age_mult_now > 0 else draft_score

            # Projected keeper value next year
            if expected_value > 0:
                projected_kv = projected_score / expected_value
            else:
                projected_kv = 0

            entry = {
                "player": player,
                "cost_label": cost_label,
                "effective_round": effective_round,
                "draft_score": round(draft_score, 1),
                "keeper_value": round(keeper_value, 2),
                "recommendation": recommendation,
                "trend_val": round(trend_val, 1),
                "trend_pct": round(trend_pct, 1),
                "projected_score": round(projected_score, 1),
                "projected_kv": round(projected_kv, 2),
                "age_mult_next": round(age_mult_next, 2),
                "team_name": team.name,
                "team_id": team.id,
            }

            team_players.append(entry)
            all_keepers.append(entry)

        # Sort team players by keeper value descending
        team_players.sort(key=lambda x: x["keeper_value"], reverse=True)

        teams_data.append({
            "team": team,
            "players": team_players,
        })

    # ── Projected keeper rankings (all players, sorted by projected KV) ──
    projected_rankings = sorted(all_keepers, key=lambda x: x["projected_kv"], reverse=True)

    return render_template(
        "leagues/keepers.html",
        league=league,
        teams_data=teams_data,
        projected_rankings=projected_rankings,
        best_draft_score=best_draft_score,
        total_rounds=total_rounds,
        active_tab="players",
    )


# ── List Changes (transaction history) ─────────────────────────────


@leagues_bp.route("/<int:league_id>/list-changes")
@login_required
def list_changes_page(league_id):
    """Standalone list changes / transaction history page."""
    from blueprints import check_league_access
    from models.league_records import compute_list_changes

    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    list_changes = compute_list_changes(league_id)

    return render_template("leagues/list_changes.html",
                           league=league,
                           list_changes=list_changes,
                           active_tab="league")


# ── League Records (all-time history) ────────────────────────────────


@leagues_bp.route("/<int:league_id>/records")
@login_required
def league_history(league_id):
    """All-time league records: champions, records, head-to-head, standings."""
    from collections import defaultdict
    from blueprints import check_league_access
    from models.database import SeasonStanding, Fixture, RoundScore

    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    team_map = {t.id: t.name for t in teams}

    # ── Champions per year ────────────────────────────────────────
    all_standings = (
        SeasonStanding.query
        .filter_by(league_id=league_id)
        .order_by(SeasonStanding.year, SeasonStanding.ladder_points.desc(),
                  SeasonStanding.percentage.desc())
        .all()
    )

    # Group by year, pick #1
    standings_by_year = defaultdict(list)
    for s in all_standings:
        standings_by_year[s.year].append(s)

    champions = []
    for year in sorted(standings_by_year.keys()):
        rows = standings_by_year[year]
        if rows:
            champ = rows[0]
            champions.append({
                "year": year,
                "team_name": team_map.get(champ.team_id, "Unknown"),
                "team_id": champ.team_id,
                "wins": champ.wins,
                "losses": champ.losses,
                "draws": champ.draws,
                "points_for": champ.points_for,
                "ladder_points": champ.ladder_points,
                "percentage": champ.percentage,
            })

    # ── All-time aggregate standings ──────────────────────────────
    alltime = {}
    for s in all_standings:
        tid = s.team_id
        if tid not in alltime:
            alltime[tid] = {
                "team_name": team_map.get(tid, "Unknown"),
                "team_id": tid,
                "wins": 0, "losses": 0, "draws": 0,
                "points_for": 0.0, "points_against": 0.0,
                "seasons": 0,
            }
        alltime[tid]["wins"] += s.wins
        alltime[tid]["losses"] += s.losses
        alltime[tid]["draws"] += s.draws
        alltime[tid]["points_for"] += s.points_for
        alltime[tid]["points_against"] += s.points_against
        alltime[tid]["seasons"] += 1

    for tid in alltime:
        a = alltime[tid]
        total = a["wins"] + a["losses"] + a["draws"]
        a["total_games"] = total
        a["win_pct"] = (a["wins"] / total * 100) if total > 0 else 0
        a["percentage"] = (
            (a["points_for"] / a["points_against"] * 100)
            if a["points_against"] > 0 else 0
        )

    alltime_sorted = sorted(
        alltime.values(),
        key=lambda x: (-x["wins"], -x["win_pct"], -x["points_for"]),
    )

    # ── Records: highest round score, highest season PF, biggest blowout ─
    # Highest single-round scores
    top_round_scores = (
        db.session.query(RoundScore, FantasyTeam)
        .join(FantasyTeam, RoundScore.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id)
        .order_by(RoundScore.total_score.desc())
        .limit(10)
        .all()
    )
    top_scores = []
    for rs, ft in top_round_scores:
        top_scores.append({
            "team_name": ft.name,
            "score": rs.total_score,
            "round": rs.afl_round,
            "year": rs.year,
        })

    # Highest season points for
    top_season_pf = sorted(
        all_standings, key=lambda s: s.points_for, reverse=True
    )[:5]
    top_season_pf_list = [{
        "team_name": team_map.get(s.team_id, "Unknown"),
        "year": s.year,
        "points_for": s.points_for,
        "wins": s.wins,
        "losses": s.losses,
    } for s in top_season_pf]

    # Biggest blowout (largest margin in completed fixtures)
    blowout_fixtures = (
        Fixture.query
        .filter_by(league_id=league_id, status="completed", is_final=False)
        .all()
    )
    blowouts = []
    for f in blowout_fixtures:
        if f.home_score is not None and f.away_score is not None:
            margin = abs(f.home_score - f.away_score)
            if f.home_score > f.away_score:
                winner = team_map.get(f.home_team_id, "Unknown")
                loser = team_map.get(f.away_team_id, "Unknown")
                winner_score = f.home_score
                loser_score = f.away_score
            else:
                winner = team_map.get(f.away_team_id, "Unknown")
                loser = team_map.get(f.home_team_id, "Unknown")
                winner_score = f.away_score
                loser_score = f.home_score
            blowouts.append({
                "winner": winner,
                "loser": loser,
                "winner_score": winner_score,
                "loser_score": loser_score,
                "margin": margin,
                "round": f.afl_round,
                "year": f.year,
            })
    blowouts.sort(key=lambda x: x["margin"], reverse=True)
    blowouts = blowouts[:5]

    # ── Longest win streaks ───────────────────────────────────────
    completed = (
        Fixture.query
        .filter_by(league_id=league_id, status="completed", is_final=False)
        .order_by(Fixture.year, Fixture.afl_round)
        .all()
    )
    team_results = defaultdict(list)
    for f in completed:
        if f.home_score is not None and f.away_score is not None:
            if f.home_score > f.away_score:
                team_results[f.home_team_id].append(("W", f.afl_round, f.year))
                team_results[f.away_team_id].append(("L", f.afl_round, f.year))
            elif f.away_score > f.home_score:
                team_results[f.away_team_id].append(("W", f.afl_round, f.year))
                team_results[f.home_team_id].append(("L", f.afl_round, f.year))
            else:
                team_results[f.home_team_id].append(("D", f.afl_round, f.year))
                team_results[f.away_team_id].append(("D", f.afl_round, f.year))

    win_streaks = []
    for tid, results in team_results.items():
        results.sort(key=lambda x: (x[2], x[1]))
        best_streak = 0
        current_streak = 0
        streak_start = None
        best_start = None
        best_end = None
        for r in results:
            if r[0] == "W":
                if current_streak == 0:
                    streak_start = (r[2], r[1])
                current_streak += 1
                if current_streak > best_streak:
                    best_streak = current_streak
                    best_start = streak_start
                    best_end = (r[2], r[1])
            else:
                current_streak = 0
        if best_streak > 0:
            win_streaks.append({
                "team_name": team_map.get(tid, "Unknown"),
                "streak": best_streak,
                "start_year": best_start[0] if best_start else None,
                "start_round": best_start[1] if best_start else None,
                "end_year": best_end[0] if best_end else None,
                "end_round": best_end[1] if best_end else None,
            })
    win_streaks.sort(key=lambda x: x["streak"], reverse=True)
    win_streaks = win_streaks[:10]

    # ── Head-to-head matrix ───────────────────────────────────────
    h2h = defaultdict(lambda: {"wins": 0, "losses": 0, "draws": 0})
    for f in completed:
        if f.home_score is not None and f.away_score is not None:
            hid, aid = f.home_team_id, f.away_team_id
            if f.home_score > f.away_score:
                h2h[(hid, aid)]["wins"] += 1
                h2h[(aid, hid)]["losses"] += 1
            elif f.away_score > f.home_score:
                h2h[(aid, hid)]["wins"] += 1
                h2h[(hid, aid)]["losses"] += 1
            else:
                h2h[(hid, aid)]["draws"] += 1
                h2h[(aid, hid)]["draws"] += 1

    # Convert to serialisable dict for template
    h2h_data = {}
    for (t1, t2), record in h2h.items():
        key = f"{t1}-{t2}"
        h2h_data[key] = {
            "team1_id": t1,
            "team2_id": t2,
            "team1_name": team_map.get(t1, "Unknown"),
            "team2_name": team_map.get(t2, "Unknown"),
            "wins": record["wins"],
            "losses": record["losses"],
            "draws": record["draws"],
        }

    # ── Lowest single-round scores ──────────────────────────────────
    bottom_round_scores = (
        db.session.query(RoundScore, FantasyTeam)
        .join(FantasyTeam, RoundScore.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, RoundScore.total_score > 0)
        .order_by(RoundScore.total_score.asc())
        .limit(10)
        .all()
    )
    lowest_scores = [{
        "team_name": ft.name, "score": rs.total_score,
        "round": rs.afl_round, "year": rs.year,
    } for rs, ft in bottom_round_scores]

    # ── Closest matches ─────────────────────────────────────────────
    close_matches = []
    for f in blowout_fixtures:
        if f.home_score is not None and f.away_score is not None:
            margin = abs(f.home_score - f.away_score)
            close_matches.append({
                "home": team_map.get(f.home_team_id, "Unknown"),
                "away": team_map.get(f.away_team_id, "Unknown"),
                "home_score": f.home_score,
                "away_score": f.away_score,
                "margin": margin,
                "round": f.afl_round,
                "year": f.year,
            })
    close_matches.sort(key=lambda x: x["margin"])
    close_matches = close_matches[:10]

    # ── Highest & lowest combined scores ─────────────────────────────
    combined = []
    for f in blowout_fixtures:
        if f.home_score is not None and f.away_score is not None:
            total = f.home_score + f.away_score
            combined.append({
                "home": team_map.get(f.home_team_id, "Unknown"),
                "away": team_map.get(f.away_team_id, "Unknown"),
                "home_score": f.home_score,
                "away_score": f.away_score,
                "total": total,
                "round": f.afl_round,
                "year": f.year,
            })
    highest_combined = sorted(combined, key=lambda x: x["total"], reverse=True)[:5]
    lowest_combined = sorted(combined, key=lambda x: x["total"])[:5]

    # ── Longest losing streaks ──────────────────────────────────────
    loss_streaks = []
    for tid, results in team_results.items():
        results_sorted = sorted(results, key=lambda x: (x[2], x[1]))
        best_streak = 0
        current_streak = 0
        streak_start = None
        best_start = None
        best_end = None
        for r in results_sorted:
            if r[0] == "L":
                if current_streak == 0:
                    streak_start = (r[2], r[1])
                current_streak += 1
                if current_streak > best_streak:
                    best_streak = current_streak
                    best_start = streak_start
                    best_end = (r[2], r[1])
            else:
                current_streak = 0
        if best_streak > 0:
            loss_streaks.append({
                "team_name": team_map.get(tid, "Unknown"),
                "streak": best_streak,
                "start_year": best_start[0] if best_start else None,
                "start_round": best_start[1] if best_start else None,
                "end_year": best_end[0] if best_end else None,
                "end_round": best_end[1] if best_end else None,
            })
    loss_streaks.sort(key=lambda x: x["streak"], reverse=True)
    loss_streaks = loss_streaks[:10]

    # ── Player records (from RoundScore breakdown JSON) ─────────────
    import json as _json
    all_round_scores = (
        db.session.query(RoundScore, FantasyTeam)
        .join(FantasyTeam, RoundScore.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id)
        .all()
    )

    # Build player name lookup
    from models.database import AflPlayer
    player_score_records = []  # (player_name, score, team_name, round, year)
    player_season_scores = defaultdict(list)  # (player_id, year) -> [scores]
    player_name_map = {}

    for rs, ft in all_round_scores:
        if not rs.breakdown:
            continue
        try:
            bd = _json.loads(rs.breakdown) if isinstance(rs.breakdown, str) else rs.breakdown
        except Exception:
            continue
        for key, score in bd.items():
            if not key.isdigit():
                continue
            pid = int(key)
            if score and score > 0:
                player_score_records.append((pid, score, ft.name, rs.afl_round, rs.year))
                player_season_scores[(pid, rs.year)].append(score)

    # Resolve player names
    all_pids = list({r[0] for r in player_score_records})
    if all_pids:
        pname_rows = db.session.query(AflPlayer.id, AflPlayer.name).filter(
            AflPlayer.id.in_(all_pids)
        ).all()
        player_name_map = {pid: name for pid, name in pname_rows}

    # Top individual scores
    player_score_records.sort(key=lambda x: x[1], reverse=True)
    top_player_scores = [{
        "player_name": player_name_map.get(r[0], f"Player #{r[0]}"),
        "score": r[1],
        "team_name": r[2],
        "round": r[3],
        "year": r[4],
    } for r in player_score_records[:10]]

    # Most 100+ scores in a season
    hundred_plus = []
    for (pid, year), scores in player_season_scores.items():
        count = sum(1 for s in scores if s >= 100)
        if count > 0:
            hundred_plus.append({
                "player_name": player_name_map.get(pid, f"Player #{pid}"),
                "count": count,
                "year": year,
                "games": len(scores),
            })
    hundred_plus.sort(key=lambda x: x["count"], reverse=True)
    hundred_plus = hundred_plus[:10]

    # Highest season average (min 10 games)
    best_averages = []
    for (pid, year), scores in player_season_scores.items():
        if len(scores) >= 10:
            avg = sum(scores) / len(scores)
            best_averages.append({
                "player_name": player_name_map.get(pid, f"Player #{pid}"),
                "avg": round(avg, 1),
                "year": year,
                "games": len(scores),
            })
    best_averages.sort(key=lambda x: x["avg"], reverse=True)
    best_averages = best_averages[:10]

    # ── H2H Fun Facts ─────────────────────────────────────────────
    rivalry_facts = []

    # Most one-sided matchup
    for (t1, t2), rec in h2h.items():
        total = rec["wins"] + rec["losses"] + rec["draws"]
        if total >= 3:
            dominance = rec["wins"] / total * 100 if total > 0 else 0
            if dominance >= 75:
                rivalry_facts.append({
                    "type": "dominance",
                    "text": f"{team_map.get(t1, '?')} dominates {team_map.get(t2, '?')} — {rec['wins']}-{rec['draws']}-{rec['losses']} all-time ({dominance:.0f}% win rate)",
                    "value": dominance,
                })
            if rec["losses"] == 0 and rec["wins"] >= 2:
                rivalry_facts.append({
                    "type": "unbeaten",
                    "text": f"{team_map.get(t1, '?')} has NEVER lost to {team_map.get(t2, '?')} ({rec['wins']}-{rec['draws']}-0)",
                    "value": rec["wins"],
                })

    # H2H win streaks (consecutive wins in one direction)
    h2h_results = defaultdict(list)
    for f in completed:
        if f.home_score is None or f.away_score is None:
            continue
        if f.home_score > f.away_score:
            h2h_results[(f.home_team_id, f.away_team_id)].append(("W", f.year, f.afl_round))
            h2h_results[(f.away_team_id, f.home_team_id)].append(("L", f.year, f.afl_round))
        elif f.away_score > f.home_score:
            h2h_results[(f.away_team_id, f.home_team_id)].append(("W", f.year, f.afl_round))
            h2h_results[(f.home_team_id, f.away_team_id)].append(("L", f.year, f.afl_round))

    for (t1, t2), results in h2h_results.items():
        sorted_r = sorted(results, key=lambda x: (x[1], x[2]))
        streak = 0
        best_streak = 0
        for r in sorted_r:
            if r[0] == "W":
                streak += 1
                best_streak = max(best_streak, streak)
            else:
                streak = 0
        # Current streak (is it still active?)
        current = 0
        for r in reversed(sorted_r):
            if r[0] == "W":
                current += 1
            else:
                break
        if current >= 3:
            rivalry_facts.append({
                "type": "streak",
                "text": f"{team_map.get(t1, '?')} is on a {current}-game winning streak vs {team_map.get(t2, '?')}",
                "value": current,
            })

    # Closest rivalry (smallest win% difference, min 4 games)
    closest_rivalry = None
    closest_diff = 999
    for (t1, t2), rec in h2h.items():
        total = rec["wins"] + rec["losses"] + rec["draws"]
        if total >= 4:
            diff = abs(rec["wins"] - rec["losses"])
            if diff < closest_diff:
                closest_diff = diff
                closest_rivalry = {
                    "team1": team_map.get(t1, "?"),
                    "team2": team_map.get(t2, "?"),
                    "record": f"{rec['wins']}-{rec['draws']}-{rec['losses']}",
                    "total": total,
                }

    # Sort facts by interestingness
    rivalry_facts.sort(key=lambda x: x["value"], reverse=True)
    rivalry_facts = rivalry_facts[:8]

    # ── Milestone tracking ─────────────────────────────────────────
    milestones = []
    # Check if any team is approaching all-time records
    if top_scores and alltime_sorted:
        record_score = top_scores[0]["score"] if top_scores else 0
        for a in alltime_sorted[:3]:
            # Approaching wins milestone
            for milestone in [10, 25, 50, 75, 100]:
                if a["wins"] >= milestone - 3 and a["wins"] < milestone:
                    milestones.append(f"{a['team_name']} is {milestone - a['wins']} wins away from {milestone} all-time wins")

    return render_template("leagues/history.html",
                           league=league,
                           champions=champions,
                           alltime_standings=alltime_sorted,
                           top_scores=top_scores,
                           lowest_scores=lowest_scores,
                           top_season_pf=top_season_pf_list,
                           blowouts=blowouts,
                           close_matches=close_matches,
                           highest_combined=highest_combined,
                           lowest_combined=lowest_combined,
                           win_streaks=win_streaks,
                           loss_streaks=loss_streaks,
                           top_player_scores=top_player_scores,
                           hundred_plus=hundred_plus,
                           best_averages=best_averages,
                           h2h_data=h2h_data,
                           rivalry_facts=rivalry_facts,
                           closest_rivalry=closest_rivalry,
                           milestones=milestones,
                           teams=teams,
                           team_map=team_map,
                           active_tab="league")


# ── Advanced Stats Dashboard ────────────────────────────────────────


@leagues_bp.route("/<int:league_id>/stats")
@login_required
def advanced_stats(league_id):
    """Advanced stats dashboard: league leaders, player lookup, team analysis."""
    import json
    import statistics
    from blueprints import check_league_access
    from models.database import (
        ScScore, PlayerStat, RoundScore, AflByeRound,
        FantasyRoster, FantasyTeam, AflPlayer,
    )

    league, user_team = check_league_access(league_id)
    if not league:
        flash("You don't have access to this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    year = league.season_year
    prev_year = year - 1

    # ── Rostered player IDs in this league ──
    roster_rows = (
        db.session.query(FantasyRoster.player_id, FantasyTeam.name, FantasyTeam.id)
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
        .all()
    )
    rostered_ids = {r[0] for r in roster_rows}
    player_team_map = {r[0]: r[1] for r in roster_rows}  # player_id -> fantasy team name

    # ── Gather SC scores for rostered players (current year) ──
    sc_rows = (
        db.session.query(ScScore.player_id, ScScore.round, ScScore.sc_score)
        .filter(ScScore.year == year, ScScore.player_id.in_(rostered_ids))
        .order_by(ScScore.player_id, ScScore.round)
        .all()
    )

    # Build per-player score lists
    player_scores = {}  # player_id -> [(round, score), ...]
    for pid, rnd, sc in sc_rows:
        if sc is not None:
            player_scores.setdefault(pid, []).append((rnd, sc))

    # ── Previous year averages (for "most improved") ──
    prev_sc_rows = (
        db.session.query(ScScore.player_id, ScScore.sc_score)
        .filter(ScScore.year == prev_year, ScScore.player_id.in_(rostered_ids))
        .all()
    )
    prev_totals = {}
    prev_counts = {}
    for pid, sc in prev_sc_rows:
        if sc is not None:
            prev_totals[pid] = prev_totals.get(pid, 0) + sc
            prev_counts[pid] = prev_counts.get(pid, 0) + 1
    prev_avgs = {pid: prev_totals[pid] / prev_counts[pid] for pid in prev_totals if prev_counts[pid] > 0}

    # ── Player name lookup ──
    player_objs = {
        p.id: p for p in AflPlayer.query.filter(AflPlayer.id.in_(rostered_ids)).all()
    }

    # ── Compute per-player metrics ──
    player_metrics = []
    for pid, scores_list in player_scores.items():
        if not scores_list:
            continue
        player = player_objs.get(pid)
        if not player:
            continue

        vals = [s[1] for s in scores_list]
        games = len(vals)
        if games < 1:
            continue

        avg = sum(vals) / games
        std_dev = statistics.pstdev(vals) if games > 1 else 0.0
        ceiling = max(vals)
        floor = min(vals)
        best_round = scores_list[vals.index(ceiling)][0]

        player_metrics.append({
            "id": pid,
            "name": player.name,
            "fantasy_team": player_team_map.get(pid, ""),
            "avg": avg,
            "games": games,
            "std_dev": std_dev,
            "ceiling": ceiling,
            "floor": floor,
            "best_round": best_round,
            "prev_avg": prev_avgs.get(pid),
        })

    # ── Build leader tables ──
    leaders = {}

    # Top 10 scoring average (min 3 games)
    qualified = [p for p in player_metrics if p["games"] >= 3]
    leaders["scoring_avg"] = sorted(qualified, key=lambda x: x["avg"], reverse=True)[:10]

    # Most consistent (lowest std dev, min 3 games)
    leaders["consistency"] = sorted(qualified, key=lambda x: x["std_dev"])[:10]

    # Highest ceiling
    leaders["ceiling"] = sorted(player_metrics, key=lambda x: x["ceiling"], reverse=True)[:10]

    # Most improved (biggest avg increase from prev year, min 3 games both years)
    improved = []
    for p in qualified:
        if p["prev_avg"] is not None and p["prev_avg"] > 0:
            improvement = p["avg"] - p["prev_avg"]
            improved.append({
                "name": p["name"],
                "prev_avg": p["prev_avg"],
                "curr_avg": p["avg"],
                "improvement": improvement,
            })
    leaders["most_improved"] = sorted(improved, key=lambda x: x["improvement"], reverse=True)[:10]

    # Ironman (most games)
    leaders["ironman"] = sorted(player_metrics, key=lambda x: x["games"], reverse=True)[:10]

    # ── All players for search (JSON) ──
    all_players_list = (
        AflPlayer.query
        .filter(AflPlayer.sc_avg.isnot(None))
        .order_by(AflPlayer.sc_avg.desc())
        .limit(600)
        .all()
    )
    all_players_json = json.dumps([
        {"id": p.id, "name": p.name, "position": p.position or "", "afl_team": p.afl_team or ""}
        for p in all_players_list
    ])

    # ── Teams for dropdown ──
    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.name).all()

    # ── Team analysis data (precomputed for all teams) ──
    team_analysis = {}
    for team in teams:
        # Round scores
        round_scores = (
            RoundScore.query.filter_by(team_id=team.id, year=year)
            .order_by(RoundScore.afl_round.asc())
            .all()
        )
        rs_data = [{"round": rs.afl_round, "score": rs.total_score or 0} for rs in round_scores]

        # Position group contribution
        roster_entries = (
            FantasyRoster.query.filter_by(team_id=team.id, is_active=True, is_benched=False)
            .all()
        )
        pos_scores = {"DEF": 0.0, "MID": 0.0, "FWD": 0.0, "RUC": 0.0}
        for entry in roster_entries:
            if entry.position_code not in pos_scores:
                continue
            p_scores = player_scores.get(entry.player_id, [])
            if p_scores:
                p_avg = sum(s[1] for s in p_scores) / len(p_scores)
                pos_scores[entry.position_code] += p_avg

        # Bye round impact
        player_teams = {
            entry.player_id: entry.player.afl_team
            for entry in roster_entries if entry.player
        }
        bye_rows = AflByeRound.query.filter_by(year=year).all()
        bye_map = {}
        for b in bye_rows:
            bye_map.setdefault(b.afl_round, set()).add(b.afl_team)

        bye_impact = []
        for rnd, bye_teams in sorted(bye_map.items()):
            affected_players = [
                pid for pid, afl_team in player_teams.items()
                if afl_team in bye_teams
            ]
            if affected_players:
                est_loss = 0
                for pid in affected_players:
                    p_scores = player_scores.get(pid, [])
                    if p_scores:
                        est_loss += sum(s[1] for s in p_scores) / len(p_scores)
                    else:
                        player = player_objs.get(pid)
                        est_loss += (player.sc_avg or 0) if player else 0
                bye_impact.append({
                    "round": rnd,
                    "players_out": len(affected_players),
                    "estimated_loss": est_loss,
                })

        team_analysis[str(team.id)] = {
            "name": team.name,
            "round_scores": rs_data,
            "position_breakdown": pos_scores,
            "bye_impact": bye_impact,
        }

    team_analysis_json = json.dumps(team_analysis)

    return render_template("leagues/stats.html",
                           league=league,
                           leaders=leaders,
                           teams=teams,
                           all_players_json=all_players_json,
                           team_analysis_json=team_analysis_json,
                           active_tab="players")


@leagues_bp.route("/<int:league_id>/stats/api/player/<int:player_id>")
@login_required
def api_player_stats(league_id, player_id):
    """API endpoint returning JSON with player round-by-round scores and metrics."""
    import statistics
    from blueprints import check_league_access
    from models.database import ScScore, PlayerStat, AflPlayer

    league, user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Access denied"}), 403

    player = db.session.get(AflPlayer, player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404

    year = league.season_year

    # Current year scores
    scores = (
        ScScore.query.filter_by(player_id=player_id, year=year)
        .order_by(ScScore.round.asc())
        .all()
    )
    sc_vals = [s.sc_score for s in scores if s.sc_score is not None]
    games = len(sc_vals)
    avg = sum(sc_vals) / games if games else (player.sc_avg or 0)
    std_dev = statistics.pstdev(sc_vals) if games > 1 else 0.0
    ceiling = max(sc_vals) if sc_vals else 0
    floor = min(sc_vals) if sc_vals else 0

    last3 = sc_vals[-3:] if sc_vals else []
    last5 = sc_vals[-5:] if sc_vals else []
    l3_avg = sum(last3) / len(last3) if last3 else None
    l5_avg = sum(last5) / len(last5) if last5 else None

    # Break-even: the score needed in the next game to maintain current avg
    # breakeven = avg (you need to score your average to keep it the same)
    breakeven = avg

    # Detailed stats averages (last 5 games)
    stats = (
        PlayerStat.query.filter_by(player_id=player_id, year=year)
        .order_by(PlayerStat.round.desc())
        .limit(5)
        .all()
    )
    stat_avgs = {}
    if stats:
        for col in ["kicks", "handballs", "marks", "tackles", "goals",
                     "behinds", "hitouts", "disposals", "clearances",
                     "contested_possessions", "inside_fifties"]:
            vals = [getattr(s, col) or 0 for s in stats]
            stat_avgs[col] = round(sum(vals) / len(vals), 1) if vals else 0

    scores_by_round = [
        {"round": s.round, "score": s.sc_score}
        for s in scores if s.sc_score is not None
    ]

    return jsonify({
        "id": player.id,
        "name": player.name,
        "afl_team": player.afl_team,
        "position": player.position,
        "games": games,
        "avg": round(avg, 1),
        "std_dev": round(std_dev, 1),
        "ceiling": ceiling,
        "floor": floor,
        "l3_avg": round(l3_avg, 1) if l3_avg is not None else None,
        "l5_avg": round(l5_avg, 1) if l5_avg is not None else None,
        "breakeven": round(breakeven, 1),
        "stat_avgs": stat_avgs,
        "scores_by_round": scores_by_round,
        "keeper_value": round(player.keeper_value, 1) if player.keeper_value else None,
    })



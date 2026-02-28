"""Fantasy team management blueprint: lineup, squad, stats."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from sqlalchemy import func as sa_func

from models.database import (
    db, League, FantasyTeam, FantasyRoster, AflPlayer, AflGame,
    LeaguePositionSlot, WeeklyLineup, LineupSlot,
    PlayerStat, RoundScore, UserDraftWeights, LeagueDraftWeights,
)
from blueprints import check_league_access
from models.lineup_manager import (
    get_or_create_lineup, get_lineup_with_slots, set_lineup,
    auto_fill_lineup, lock_lineup, get_bye_players,
)
import config
from config import TEAM_LOGOS

team_bp = Blueprint("team", __name__, url_prefix="/leagues",
                    template_folder="../templates")


@team_bp.route("/<int:league_id>/team/<int:team_id>")
@login_required
def squad(league_id, team_id):
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        flash("Team not found.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    roster = (
        FantasyRoster.query
        .filter_by(team_id=team_id, is_active=True)
        .all()
    )
    players = [r.player for r in roster]
    players.sort(key=lambda p: p.sc_avg or 0, reverse=True)

    is_owner = team.owner_id == current_user.id
    view = request.args.get("view", "field")

    # For field view, build structured position data server-side
    field_data = None
    if view == "field":
        position_slots = LeaguePositionSlot.query.filter_by(league_id=league_id).all()

        # ── Migrate legacy "BENCH" position slots to positional bench ──
        legacy_bench = [ps for ps in position_slots if ps.is_bench and ps.position_code == "BENCH"]
        if legacy_bench:
            total_old = sum(ps.count for ps in legacy_bench)
            for ps in legacy_bench:
                db.session.delete(ps)
            # Replace with positional bench: DEF:1, MID:2, FWD:1, FLEX:N
            positional_count = min(total_old, 4)  # up to 4 positional slots
            flex_count = max(total_old - positional_count, 1)
            new_bench = [("DEF", 1), ("MID", min(2, positional_count - 1) if positional_count > 1 else 0),
                         ("FWD", 1 if positional_count > 2 else 0), ("FLEX", flex_count)]
            for code, count in new_bench:
                if count > 0:
                    db.session.add(LeaguePositionSlot(
                        league_id=league_id, position_code=code, count=count, is_bench=True
                    ))
            db.session.commit()
            # Reload after migration
            position_slots = LeaguePositionSlot.query.filter_by(league_id=league_id).all()

        # ── Slot counts from league config (or defaults) — compute first ──
        slot_counts = {}
        bench_slots_config = []  # [(pos_code, count), ...] for bench
        for ps in position_slots:
            if ps.is_bench:
                bench_slots_config.append((ps.position_code, ps.count))
            else:
                slot_counts[ps.position_code] = ps.count

        if not slot_counts:
            slot_counts = config.POSITIONS.copy()
            bench_slots_config = [("DEF", 1), ("MID", 2), ("FWD", 1), ("FLEX", 1)]

        # Flatten bench config to ordered list of slot types
        # Normalise legacy "BENCH" slots to "FLEX" (any position)
        bench_slot_types = []  # e.g. ["DEF", "MID", "MID", "FWD", "FLEX"]
        for pos_code, count in bench_slots_config:
            normalised = pos_code if pos_code in ("DEF", "MID", "FWD", "RUC", "FLEX") else "FLEX"
            bench_slot_types.extend([normalised] * count)
        bench_count = len(bench_slot_types)

        # Build bench position code mapping (BENCH_DEF, BENCH_MID, etc.)
        bench_code_map = {}  # BENCH_X -> required positions (list of eligible positions)
        for bt in set(bench_slot_types):
            if bt == "FLEX":
                bench_code_map["BENCH_FLEX"] = None  # any position
            else:
                bench_code_map[f"BENCH_{bt}"] = bt  # must match this position

        # ── Always read captain / VC from roster ──
        cap_id = None
        vc_id = None
        roster_map = {r.player_id: r for r in roster}
        for r in roster:
            if r.is_captain:
                cap_id = r.player_id
            if r.is_vice_captain:
                vc_id = r.player_id

        zones = {}   # pos_code -> [player_or_None, ...]
        # bench_data: list of {"player": p_or_None, "bench_type": "DEF"/"MID"/.../"FLEX"}
        bench_data = [{"player": None, "bench_type": bt} for bt in bench_slot_types]
        used_ids = set()

        # ── Step 1: Read already-positioned players from DB ──
        bench_players_by_type = {}  # bench_type -> [player, ...]
        for r in roster:
            p = r.player
            if not r.is_benched and r.position_code in ("DEF", "MID", "FWD", "RUC"):
                zones.setdefault(r.position_code, []).append(p)
                used_ids.add(p.id)
            elif not r.is_benched and r.position_code and r.position_code.startswith("BENCH_"):
                btype = r.position_code.replace("BENCH_", "")
                if btype not in ("DEF", "MID", "FWD", "RUC", "FLEX"):
                    btype = "FLEX"
                bench_players_by_type.setdefault(btype, []).append(p)
                used_ids.add(p.id)
            elif not r.is_benched and r.position_code == "BENCH":
                bench_players_by_type.setdefault("FLEX", []).append(p)
                used_ids.add(p.id)

        # Place already-benched players into bench_data slots
        type_idx = {}
        for i, slot in enumerate(bench_data):
            bt = slot["bench_type"]
            available = bench_players_by_type.get(bt, [])
            idx = type_idx.get(bt, 0)
            if idx < len(available):
                bench_data[i]["player"] = available[idx]
                type_idx[bt] = idx + 1

        # ── Step 2: Auto-fill empty on-field slots with unpositioned players ──
        # Sort unpositioned players by SC avg (best first), fill scarcest positions first
        unpositioned = sorted(
            [p for p in players if p.id not in used_ids],
            key=lambda p: p.sc_avg or 0, reverse=True,
        )
        fill_order = sorted(slot_counts.keys(), key=lambda pos: slot_counts[pos])
        for pos in fill_order:
            current = zones.get(pos, [])
            needed = slot_counts[pos] - len(current)
            if needed <= 0:
                continue
            for p in list(unpositioned):
                if needed <= 0:
                    break
                p_positions = (p.position or "MID").split("/")
                primary = p_positions[0] if p_positions[0] in ("DEF", "MID", "FWD", "RUC") else "MID"
                if pos in p_positions or (pos == primary):
                    zones.setdefault(pos, []).append(p)
                    used_ids.add(p.id)
                    unpositioned.remove(p)
                    needed -= 1

        # Pad each zone with None to reach full slot count
        for code, count in slot_counts.items():
            current = zones.get(code, [])
            while len(current) < count:
                current.append(None)
            zones[code] = current[:count]

        # Rebuild used_ids from truncated zones
        used_ids = set()
        for plist in zones.values():
            for p in plist:
                if p is not None:
                    used_ids.add(p.id)
        for bd in bench_data:
            if bd["player"] is not None:
                used_ids.add(bd["player"].id)

        # ── Step 3: Auto-fill empty bench slots ──
        for i, slot in enumerate(bench_data):
            if slot["player"] is not None:
                continue
            bt = slot["bench_type"]
            remaining = sorted(
                [p for p in players if p.id not in used_ids],
                key=lambda p: p.sc_avg or 0, reverse=True,
            )
            for p in remaining:
                if bt == "FLEX":
                    bench_data[i]["player"] = p
                    used_ids.add(p.id)
                    break
                else:
                    p_positions = (p.position or "MID").split("/")
                    if bt in p_positions:
                        bench_data[i]["player"] = p
                        used_ids.add(p.id)
                        break

        # Build flat bench_list for backward compatibility + bench_filled count
        bench_list = [bd["player"] for bd in bench_data]
        bench_filled = sum(1 for p in bench_list if p is not None)

        # Reserves: all roster players not on-field and not on bench
        reserves = [p for p in players if p.id not in used_ids]
        reserves.sort(key=lambda p: p.rating or 0, reverse=True)

        # ── Step 4: Persist to DB so swap/captain/VC operations work ──
        # Check if any unpositioned players were auto-filled into new slots
        needs_persist = is_owner and any(
            roster_map.get(p.id) and (
                roster_map[p.id].position_code is None or roster_map[p.id].is_benched
            )
            for plist in zones.values() for p in plist
            if p is not None and p.id in roster_map
        )
        if needs_persist:
            for code, plist in zones.items():
                for p in plist:
                    if p is not None:
                        entry = roster_map.get(p.id)
                        if entry and (entry.position_code != code or entry.is_benched):
                            entry.position_code = code
                            entry.is_benched = False
            for bd in bench_data:
                p = bd["player"]
                if p is not None:
                    expected_code = f"BENCH_{bd['bench_type']}"
                    entry = roster_map.get(p.id)
                    if entry and (entry.position_code != expected_code or entry.is_benched):
                        entry.position_code = expected_code
                        entry.is_benched = False
            db.session.commit()

        # Counts for the header badges
        zone_filled = {code: sum(1 for p in plist if p is not None)
                       for code, plist in zones.items()}

        # Dynamic row layouts for each zone (adapts field view to any count)
        def calc_zone_rows(count):
            """Return list of row sizes for a given position count."""
            if count <= 0:
                return []
            if count <= 3:
                return [count]
            if count == 4:
                return [2, 2]
            if count == 5:
                return [3, 2]
            if count == 6:
                return [3, 3]
            if count == 7:
                return [2, 3, 2]
            if count == 8:
                return [3, 2, 3]
            # 9+: rows of 3, last row gets remainder
            rows = []
            remaining = count
            while remaining > 0:
                row = min(3, remaining)
                rows.append(row)
                remaining -= row
            return rows

        zone_layouts = {}
        for code, count in slot_counts.items():
            zone_layouts[code] = calc_zone_rows(count)

        # Emergency IDs — only reserves (is_benched=True) can be emergency.
        # Also fix any stale is_emergency flags on non-reserve players.
        emergency_ids = []
        fixed_stale = False
        for r in roster:
            if r.is_emergency:
                if r.is_benched:
                    emergency_ids.append(r.player_id)
                else:
                    # Stale flag — player is on field/bench but still marked emergency
                    r.is_emergency = False
                    fixed_stale = True
        if fixed_stale:
            db.session.commit()

        # Next lockout time — earliest scheduled game start for players on team
        next_lockout_time = None
        try:
            team_afl_teams = set(p.afl_team for p in players if p and p.afl_team)
            from models.database import AflGame
            upcoming_games = (
                AflGame.query
                .filter(
                    AflGame.status == "scheduled",
                    AflGame.scheduled_start.isnot(None),
                    db.or_(
                        AflGame.home_team.in_(team_afl_teams),
                        AflGame.away_team.in_(team_afl_teams),
                    ),
                )
                .order_by(AflGame.scheduled_start.asc())
                .first()
            )
            if upcoming_games and upcoming_games.scheduled_start:
                next_lockout_time = upcoming_games.scheduled_start.isoformat()
        except Exception:
            pass

        field_data = {
            "zones": zones,
            "bench": bench_list,
            "bench_data": bench_data,
            "reserves": reserves,
            "cap_id": cap_id,
            "vc_id": vc_id,
            "slot_counts": slot_counts,
            "zone_layouts": zone_layouts,
            "zone_filled": zone_filled,
            "bench_filled": bench_filled,
            "emergency_ids": emergency_ids,
            "next_lockout_time": next_lockout_time,
        }

    # ── All-time stats for table view ──
    alltime_stats = {}
    if view == "table":
        player_ids = [p.id for p in players]
        if player_ids:
            rows = db.session.query(
                PlayerStat.player_id,
                sa_func.count(PlayerStat.id).label("games"),
                sa_func.sum(PlayerStat.goals).label("goals"),
                sa_func.sum(PlayerStat.disposals).label("disposals"),
                sa_func.sum(PlayerStat.marks).label("marks"),
                sa_func.sum(PlayerStat.tackles).label("tackles"),
                sa_func.avg(PlayerStat.supercoach_score).label("sc_avg"),
            ).filter(
                PlayerStat.player_id.in_(player_ids)
            ).group_by(PlayerStat.player_id).all()
            for r in rows:
                alltime_stats[r.player_id] = {
                    "games": r.games,
                    "goals": int(r.goals or 0),
                    "disposals": int(r.disposals or 0),
                    "marks": int(r.marks or 0),
                    "tackles": int(r.tackles or 0),
                    "sc_avg": round(float(r.sc_avg or 0), 1),
                }

    return render_template("team/squad.html",
                           league=league,
                           team=team,
                           players=players,
                           roster=roster,
                           is_owner=is_owner,
                           view=view,
                           field_data=field_data,
                           alltime_stats=alltime_stats,
                           TEAM_LOGOS=TEAM_LOGOS)


@team_bp.route("/<int:league_id>/team/<int:team_id>/lineup/<int:afl_round>", methods=["GET", "POST"])
@login_required
def lineup(league_id, team_id, afl_round):
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        flash("Team not found.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    is_owner = team.owner_id == current_user.id
    year = league.season_year

    if request.method == "POST" and is_owner:
        action = request.form.get("action")

        if action == "auto_fill":
            _, error = auto_fill_lineup(team_id, afl_round, year, league_id)
            if error:
                flash(error, "danger")
            else:
                flash("Lineup auto-filled!", "success")
            return redirect(url_for("team.lineup", league_id=league_id,
                                    team_id=team_id, afl_round=afl_round))

        elif action == "save":
            # Parse slot data from form
            player_ids = request.form.getlist("player_id")
            position_codes = request.form.getlist("position_code")
            captain_id = request.form.get("captain_id", type=int)
            vc_id = request.form.get("vc_id", type=int)
            emergency_ids = request.form.getlist("emergency_id")

            slot_data = []
            for pid, pos in zip(player_ids, position_codes):
                pid = int(pid)
                slot_data.append({
                    "player_id": pid,
                    "position_code": pos,
                    "is_captain": pid == captain_id,
                    "is_vice_captain": pid == vc_id,
                    "is_emergency": str(pid) in emergency_ids,
                })

            _, error = set_lineup(team_id, afl_round, year, slot_data, league_id)
            if error:
                flash(error, "danger")
            else:
                flash("Lineup saved!", "success")
            return redirect(url_for("team.lineup", league_id=league_id,
                                    team_id=team_id, afl_round=afl_round))

        elif action == "lock":
            lock_lineup(team_id, afl_round, year)
            flash("Lineup locked.", "info")
            return redirect(url_for("team.lineup", league_id=league_id,
                                    team_id=team_id, afl_round=afl_round))

    lineup_data = get_lineup_with_slots(team_id, afl_round, year)
    bye_players = get_bye_players(team_id, afl_round, year)

    # Get full roster for bench options
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    all_players = [r.player for r in roster]

    # Get position slots config
    from models.database import LeaguePositionSlot, AflGame
    position_slots = LeaguePositionSlot.query.filter_by(league_id=league_id).all()

    # Get locked player IDs for rolling lockout display
    from models.live_sync import get_locked_player_ids, get_game_statuses
    locked_player_ids = get_locked_player_ids(afl_round, year)
    afl_games = get_game_statuses(afl_round, year)

    # Build player→game start time lookup for "Locks at X" display
    player_lock_times = {}
    games_by_team = {}
    for g in afl_games:
        games_by_team[g["home_team"]] = g
        games_by_team[g["away_team"]] = g
    for p in all_players:
        game = games_by_team.get(p.afl_team)
        if game:
            if game["status"] in ("live", "complete"):
                player_lock_times[p.id] = "Locked"
            elif game.get("scheduled_start"):
                player_lock_times[p.id] = f"Locks at {game['scheduled_start'][11:16]}"

    return render_template("team/lineup.html",
                           league=league,
                           team=team,
                           afl_round=afl_round,
                           lineup=lineup_data,
                           bye_players=bye_players,
                           all_players=all_players,
                           position_slots=position_slots,
                           is_owner=is_owner,
                           locked_player_ids=locked_player_ids,
                           player_lock_times=player_lock_times,
                           max_round=config.SC_ROUNDS)


@team_bp.route("/<int:league_id>/team/<int:team_id>/stats")
@login_required
def team_stats(league_id, team_id):
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        flash("Team not found.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    players = [r.player for r in roster]
    players.sort(key=lambda p: p.sc_avg or 0, reverse=True)

    # Basic stats
    total_sc = sum(p.sc_avg or 0 for p in players)
    avg_age = sum(p.age or 0 for p in players) / max(len(players), 1)
    position_counts = {}
    for p in players:
        for pos in (p.position or "MID").split("/"):
            position_counts[pos] = position_counts.get(pos, 0) + 1

    return render_template("team/stats.html",
                           league=league,
                           team=team,
                           players=players,
                           total_sc=round(total_sc, 1),
                           avg_age=round(avg_age, 1),
                           position_counts=position_counts)


@team_bp.route("/<int:league_id>/draft-weights", methods=["GET", "POST"])
@login_required
def draft_weights(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()
    if not team:
        flash("You don't have a team in this league.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    weight_keys = ["sc_average", "age_factor", "positional_scarcity", "trajectory", "durability", "rating_potential"]

    if request.method == "POST":
        weights = {}
        for k in weight_keys:
            val = request.form.get(f"weight_{k}", type=float)
            if val is not None:
                weights[k] = val
        if weights:
            total = sum(weights.values())
            if total > 0 and abs(total - 1.0) > 0.01:
                for k in weights:
                    weights[k] = round(weights[k] / total, 4)
                flash("Weights normalised to sum to 1.0.", "info")

            uw = UserDraftWeights.query.filter_by(user_id=current_user.id, league_id=league_id).first()
            if not uw:
                uw = UserDraftWeights(user_id=current_user.id, league_id=league_id)
                db.session.add(uw)
            for k, v in weights.items():
                setattr(uw, k, v)
            db.session.commit()
            flash("Draft ranking weights saved.", "success")
        return redirect(url_for("team.draft_weights", league_id=league_id))

    # Load current weights: UserDraftWeights → LeagueDraftWeights → config.DRAFT_WEIGHTS
    uw = UserDraftWeights.query.filter_by(user_id=current_user.id, league_id=league_id).first()
    if uw:
        current_weights = uw.to_dict()
    else:
        lw = LeagueDraftWeights.query.filter_by(league_id=league_id).first()
        current_weights = lw.to_dict() if lw else dict(config.DRAFT_WEIGHTS)

    return render_template("team/draft_weights.html",
                           league=league,
                           team=team,
                           weights=current_weights,
                           weight_keys=weight_keys)


# ── Lineup AJAX helpers ──────────────────────────────────────────────


def _check_player_locked(player_id, year):
    """Return True if the player's AFL game has started (rolling lockout)."""
    from models.live_sync import get_locked_player_ids
    # Find the current AFL round from the most recent live/complete game
    latest_game = (
        AflGame.query
        .filter_by(year=year)
        .filter(AflGame.status.in_(["live", "complete"]))
        .order_by(AflGame.afl_round.desc())
        .first()
    )
    if not latest_game:
        return False
    locked = get_locked_player_ids(latest_game.afl_round, year)
    return player_id in locked


def _get_roster_entry(player_id, team, user):
    """Validate ownership and return the FantasyRoster entry or (None, error_response)."""
    if team.owner_id != user.id:
        return None, (jsonify({"error": "Not your team"}), 403)
    entry = FantasyRoster.query.filter_by(
        team_id=team.id, player_id=player_id, is_active=True
    ).first()
    if not entry:
        return None, (jsonify({"error": "Player not on roster"}), 404)
    return entry, None


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/set-captain", methods=["POST"])
@login_required
def api_set_captain(league_id, team_id):
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    entry, err = _get_roster_entry(player_id, team, current_user)
    if err:
        return err

    if _check_player_locked(player_id, league.season_year):
        return jsonify({"error": "Player is locked (game started)"}), 409

    # Only on-field players can be captain
    if entry.is_benched or (entry.position_code and entry.position_code.startswith("BENCH")):
        return jsonify({"error": "Only on-field players can be captain"}), 409

    # Clear old captain on this team
    FantasyRoster.query.filter_by(team_id=team_id, is_active=True, is_captain=True).update(
        {"is_captain": False}
    )
    entry.is_captain = True
    # Can't be both captain and VC
    entry.is_vice_captain = False
    db.session.commit()
    return jsonify({"ok": True, "captain_id": player_id})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/set-vc", methods=["POST"])
@login_required
def api_set_vc(league_id, team_id):
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    entry, err = _get_roster_entry(player_id, team, current_user)
    if err:
        return err

    if _check_player_locked(player_id, league.season_year):
        return jsonify({"error": "Player is locked (game started)"}), 409

    # Only on-field players can be vice-captain
    if entry.is_benched or (entry.position_code and entry.position_code.startswith("BENCH")):
        return jsonify({"error": "Only on-field players can be vice-captain"}), 409

    # Clear old VC on this team
    FantasyRoster.query.filter_by(team_id=team_id, is_active=True, is_vice_captain=True).update(
        {"is_vice_captain": False}
    )
    entry.is_vice_captain = True
    # Can't be both captain and VC
    entry.is_captain = False
    db.session.commit()
    return jsonify({"ok": True, "vc_id": player_id})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/set-position", methods=["POST"])
@login_required
def api_set_position(league_id, team_id):
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    position_code = data.get("position_code")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    entry, err = _get_roster_entry(player_id, team, current_user)
    if err:
        return err

    if _check_player_locked(player_id, league.season_year):
        return jsonify({"error": "Player is locked (game started)"}), 409

    valid_codes = ("DEF", "MID", "FWD", "RUC", "BENCH",
                    "BENCH_DEF", "BENCH_MID", "BENCH_FWD", "BENCH_FLEX")
    if position_code and position_code not in valid_codes:
        return jsonify({"error": "Invalid position_code"}), 400

    # Validate slot count if moving to field or bench
    if position_code:
        slot_counts = {}
        for ps in LeaguePositionSlot.query.filter_by(league_id=league_id):
            if not ps.is_bench:
                slot_counts[ps.position_code] = ps.count
        if not slot_counts:
            slot_counts = config.POSITIONS.copy()

        max_slots = slot_counts.get(position_code, 0)
        current_count = FantasyRoster.query.filter_by(
            team_id=team_id, is_active=True, position_code=position_code, is_benched=False
        ).count()
        # Don't count the player themselves if already in that position
        if entry.position_code == position_code and not entry.is_benched:
            current_count -= 1
        if current_count >= max_slots:
            return jsonify({"error": f"{position_code} slots full ({max_slots})"}), 409

        entry.position_code = position_code
        entry.is_benched = False
        # Player on field/bench cannot be emergency
        entry.is_emergency = False
    else:
        # Move to reserves
        entry.position_code = None
        entry.is_benched = True
        # Clear captain/VC when moving off field
        entry.is_captain = False
        entry.is_vice_captain = False

    db.session.commit()
    return jsonify({"ok": True})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/swap", methods=["POST"])
@login_required
def api_swap(league_id, team_id):
    """Swap two players' positions (field↔bench, field↔reserve, bench↔reserve)."""
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    data = request.get_json(silent=True) or {}
    pid1 = data.get("player_id_1")
    pid2 = data.get("player_id_2")
    if not pid1 or not pid2:
        return jsonify({"error": "Missing player IDs"}), 400
    if pid1 == pid2:
        return jsonify({"error": "Cannot swap a player with themselves"}), 400

    entry1, err = _get_roster_entry(pid1, team, current_user)
    if err:
        return err
    entry2, err = _get_roster_entry(pid2, team, current_user)
    if err:
        return err

    # Validate position eligibility before swapping
    p1 = entry1.player
    p2 = entry2.player
    p1_positions = (p1.position or "MID").split("/")
    p2_positions = (p2.position or "MID").split("/")

    def _check_slot_eligibility(player_positions, target_code, player_name):
        """Check if player can fill the target slot (field or positional bench)."""
        if target_code in ("DEF", "MID", "FWD", "RUC"):
            if target_code not in player_positions:
                return f"{player_name} can't play {target_code}"
        elif target_code and target_code.startswith("BENCH_") and target_code != "BENCH_FLEX":
            required_pos = target_code.replace("BENCH_", "")
            if required_pos not in player_positions:
                return f"{player_name} can't fill bench {required_pos} slot"
        return None

    err_msg = _check_slot_eligibility(p1_positions, entry2.position_code, p1.name)
    if err_msg:
        return jsonify({"error": err_msg}), 409
    err_msg = _check_slot_eligibility(p2_positions, entry1.position_code, p2.name)
    if err_msg:
        return jsonify({"error": err_msg}), 409

    # Remember emergency status before the swap
    was_e1 = entry1.is_emergency
    was_e2 = entry2.is_emergency

    # Swap position_code and is_benched
    entry1.position_code, entry2.position_code = entry2.position_code, entry1.position_code
    entry1.is_benched, entry2.is_benched = entry2.is_benched, entry1.is_benched

    # Emergency status: only a player in reserves (is_benched=True) can be emergency.
    # Transfer the E to whichever player ends up in reserves; clear it on field/bench.
    entry1.is_emergency = was_e2 if entry1.is_benched else False
    entry2.is_emergency = was_e1 if entry2.is_benched else False

    # Captain/VC can only be on-field — clear if player moved off field
    if entry1.is_benched:
        entry1.is_captain = False
        entry1.is_vice_captain = False
    if entry2.is_benched:
        entry2.is_captain = False
        entry2.is_vice_captain = False

    db.session.commit()
    return jsonify({"ok": True})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/set-emergency", methods=["POST"])
@login_required
def api_set_emergency(league_id, team_id):
    """Toggle is_emergency on a reserve player. Max 4 emergencies per team."""
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    entry, err = _get_roster_entry(player_id, team, current_user)
    if err:
        return err

    # Must be a reserve (is_benched=True)
    if not entry.is_benched:
        return jsonify({"error": "Only reserve players can be set as emergency"}), 409

    MAX_EMERGENCIES = 4

    if entry.is_emergency:
        # Toggle off
        entry.is_emergency = False
    else:
        # Check limit
        current_count = FantasyRoster.query.filter_by(
            team_id=team_id, is_active=True, is_emergency=True
        ).count()
        if current_count >= MAX_EMERGENCIES:
            return jsonify({"error": f"Max {MAX_EMERGENCIES} emergencies allowed"}), 409
        entry.is_emergency = True

    db.session.commit()
    return jsonify({"ok": True, "is_emergency": entry.is_emergency})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/player/<int:player_id>")
@login_required
def api_player_detail(league_id, team_id, player_id):
    """Return JSON player profile data for the scouting-report modal."""
    from models.database import ScScore, PlayerStat
    from sqlalchemy import func
    league, _user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Not a league member"}), 403
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    player = db.session.get(AflPlayer, player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404

    # Recent round scores (last 5)
    recent_scores = (
        ScScore.query
        .filter_by(player_id=player_id)
        .order_by(ScScore.year.desc(), ScScore.round.desc())
        .limit(5)
        .all()
    )
    scores_list = [
        {"year": s.year, "round": s.round, "score": s.sc_score}
        for s in reversed(recent_scores)
    ]

    # Last game detailed stats
    last_stat = (
        PlayerStat.query
        .filter_by(player_id=player_id)
        .order_by(PlayerStat.year.desc(), PlayerStat.round.desc())
        .first()
    )
    last_game = None
    if last_stat:
        last_game = {
            "round": last_stat.round, "year": last_stat.year,
            "disposals": last_stat.disposals, "kicks": last_stat.kicks,
            "handballs": last_stat.handballs, "marks": last_stat.marks,
            "goals": last_stat.goals, "behinds": last_stat.behinds,
            "tackles": last_stat.tackles, "hitouts": last_stat.hitouts,
            "clearances": last_stat.clearances,
            "inside_fifties": last_stat.inside_fifties,
            "contested_possessions": last_stat.contested_possessions,
            "pressure_acts": last_stat.pressure_acts,
            "metres_gained": last_stat.metres_gained,
            "supercoach_score": last_stat.supercoach_score,
        }

    # Season averages
    current_year = league.season_year
    season_avgs = db.session.query(
        func.count(PlayerStat.id).label("games"),
        func.avg(PlayerStat.disposals).label("disposals"),
        func.avg(PlayerStat.kicks).label("kicks"),
        func.avg(PlayerStat.handballs).label("handballs"),
        func.avg(PlayerStat.marks).label("marks"),
        func.avg(PlayerStat.goals).label("goals"),
        func.avg(PlayerStat.tackles).label("tackles"),
        func.avg(PlayerStat.hitouts).label("hitouts"),
        func.avg(PlayerStat.clearances).label("clearances"),
        func.avg(PlayerStat.supercoach_score).label("sc"),
    ).filter_by(player_id=player_id, year=current_year).first()

    season_avg = None
    if season_avgs and season_avgs.games:
        season_avg = {
            "games": season_avgs.games,
            "disposals": round(float(season_avgs.disposals or 0), 1),
            "kicks": round(float(season_avgs.kicks or 0), 1),
            "handballs": round(float(season_avgs.handballs or 0), 1),
            "marks": round(float(season_avgs.marks or 0), 1),
            "goals": round(float(season_avgs.goals or 0), 1),
            "tackles": round(float(season_avgs.tackles or 0), 1),
            "hitouts": round(float(season_avgs.hitouts or 0), 1),
            "clearances": round(float(season_avgs.clearances or 0), 1),
            "sc": round(float(season_avgs.sc or 0), 1),
        }

    # Form: last 5 SC scores for sparkline
    form_scores = (
        PlayerStat.query
        .filter_by(player_id=player_id)
        .filter(PlayerStat.supercoach_score.isnot(None))
        .order_by(PlayerStat.year.desc(), PlayerStat.round.desc())
        .limit(5)
        .all()
    )
    form = [{"round": s.round, "sc": s.supercoach_score} for s in reversed(form_scores)]

    return jsonify({
        "id": player.id,
        "name": player.name,
        "afl_team": player.afl_team,
        "position": player.position,
        "age": player.age,
        "height_cm": player.height_cm,
        "career_games": player.career_games,
        "sc_avg": player.sc_avg,
        "sc_avg_prev": player.sc_avg_prev,
        "games_played": player.games_played,
        "rating": player.rating,
        "potential": player.potential,
        "recent_scores": scores_list,
        "last_game": last_game,
        "season_avg": season_avg,
        "form": form,
    })


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/roster-stats")
@login_required
def api_roster_stats(league_id, team_id):
    """Return per-player 'For My Club' stats — only rounds where in scoring 23."""
    import json
    league, _user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Not a league member"}), 403
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    player_ids = {r.player_id for r in roster}

    # Get all RoundScores for this team
    round_scores = RoundScore.query.filter_by(team_id=team_id).all()

    # Parse breakdowns: map player_id -> list of (year, round, sc_from_breakdown)
    player_rounds = {}  # pid -> [(year, round, sc), ...]
    for rs in round_scores:
        breakdown = rs.breakdown
        if not breakdown:
            continue
        if isinstance(breakdown, str):
            try:
                breakdown = json.loads(breakdown)
            except (json.JSONDecodeError, TypeError):
                continue
        for pid_str, sc_val in breakdown.items():
            try:
                pid = int(pid_str)
            except (ValueError, TypeError):
                continue
            if pid in player_ids:
                player_rounds.setdefault(pid, []).append(
                    (rs.year, rs.afl_round, float(sc_val) if sc_val else 0)
                )

    # For each player, query PlayerStat for the specific (year, round) combos
    result = {}
    for pid, rounds_list in player_rounds.items():
        games = len(rounds_list)
        total_sc = sum(r[2] for r in rounds_list)

        # Batch query detailed stats for these rounds
        conditions = [
            db.and_(PlayerStat.year == yr, PlayerStat.round == rd)
            for yr, rd, _ in rounds_list
        ]
        if conditions:
            stats_rows = PlayerStat.query.filter(
                PlayerStat.player_id == pid,
                db.or_(*conditions)
            ).all()

            total_goals = sum(s.goals or 0 for s in stats_rows)
            total_disposals = sum(s.disposals or 0 for s in stats_rows)
            total_marks = sum(s.marks or 0 for s in stats_rows)
            total_tackles = sum(s.tackles or 0 for s in stats_rows)
        else:
            total_goals = total_disposals = total_marks = total_tackles = 0

        result[str(pid)] = {
            "games": games,
            "goals": total_goals,
            "disposals": total_disposals,
            "marks": total_marks,
            "tackles": total_tackles,
            "sc_avg": round(total_sc / games, 1) if games else 0,
        }

    # Include players on roster with 0 games if not in any breakdown
    for pid in player_ids:
        if str(pid) not in result:
            result[str(pid)] = {
                "games": 0, "goals": 0, "disposals": 0,
                "marks": 0, "tackles": 0, "sc_avg": 0,
            }

    return jsonify(result)


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/season-stats")
@login_required
def api_season_stats(league_id, team_id):
    """Return per-player stats for the current season year only."""
    league, _user_team = check_league_access(league_id)
    if not league:
        return jsonify({"error": "Not a league member"}), 403
    team = db.session.get(FantasyTeam, team_id)
    if not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404

    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    player_ids = [r.player_id for r in roster]
    current_year = league.season_year

    result = {}
    if player_ids:
        rows = db.session.query(
            PlayerStat.player_id,
            sa_func.count(PlayerStat.id).label("games"),
            sa_func.sum(PlayerStat.goals).label("goals"),
            sa_func.sum(PlayerStat.disposals).label("disposals"),
            sa_func.sum(PlayerStat.marks).label("marks"),
            sa_func.sum(PlayerStat.tackles).label("tackles"),
            sa_func.avg(PlayerStat.supercoach_score).label("sc_avg"),
        ).filter(
            PlayerStat.player_id.in_(player_ids),
            PlayerStat.year == current_year,
        ).group_by(PlayerStat.player_id).all()

        for r in rows:
            result[str(r.player_id)] = {
                "games": r.games,
                "goals": int(r.goals or 0),
                "disposals": int(r.disposals or 0),
                "marks": int(r.marks or 0),
                "tackles": int(r.tackles or 0),
                "sc_avg": round(float(r.sc_avg or 0), 1),
            }

    # Fill in zeros for players with no season stats
    for pid in player_ids:
        if str(pid) not in result:
            result[str(pid)] = {
                "games": 0, "goals": 0, "disposals": 0,
                "marks": 0, "tackles": 0, "sc_avg": 0,
            }

    return jsonify(result)

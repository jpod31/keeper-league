"""Fantasy team management blueprint: lineup, squad, stats."""

from datetime import datetime, timezone

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from sqlalchemy import func as sa_func

from models.database import (
    db, League, FantasyTeam, FantasyRoster, AflPlayer, AflGame,
    LeaguePositionSlot, WeeklyLineup, LineupSlot,
    PlayerStat, RoundScore, UserDraftWeights, LeagueDraftWeights,
    LongTermInjury, SeasonConfig, DelistPeriod, DelistAction,
    AflTeamSelection,
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

    # ── Delist period info for list view ──
    delist_is_open = False
    delist_period = None
    team_delist_count = 0
    min_delists = 0
    delisted_player_ids = set()
    next_delist_info = None
    if is_owner:
        delist_period = DelistPeriod.query.filter_by(
            league_id=league_id, year=league.season_year, status="open"
        ).first()
        if delist_period:
            delist_is_open = True
            min_delists = delist_period.min_delists or 0
            team_delist_count = DelistAction.query.filter_by(
                delist_period_id=delist_period.id, team_id=team_id
            ).count()
            delisted_actions = DelistAction.query.filter_by(
                delist_period_id=delist_period.id, team_id=team_id
            ).all()
            delisted_player_ids = {a.player_id for a in delisted_actions}
        else:
            # Compute next delist period info for countdown
            season_cfg = SeasonConfig.query.filter_by(
                league_id=league_id, year=league.season_year
            ).first()
            if season_cfg:
                phase = season_cfg.season_phase or "regular"
                if phase == "regular" and season_cfg.mid_season_draft_enabled and season_cfg.mid_season_draft_after_round:
                    next_delist_info = f"After Round {season_cfg.mid_season_draft_after_round} (Midseason)"
                elif phase in ("regular", "midseason") and season_cfg.offseason_start_date:
                    next_delist_info = season_cfg.offseason_start_date.strftime("Opens %d %b %Y (Offseason)")
                # If offseason and delist already closed, no upcoming

    # Build selected_player_ids for ALL views (status dots)
    selected_player_ids = set()
    try:
        _round_game = (
            AflGame.query
            .filter(AflGame.year == league.season_year,
                    AflGame.status.in_(["live", "scheduled"]))
            .order_by(AflGame.scheduled_start.asc())
            .first()
        )
        _sel_round = _round_game.afl_round if _round_game else None
        if _sel_round is not None:
            sel_rows = AflTeamSelection.query.filter_by(
                year=league.season_year, afl_round=_sel_round
            ).filter(
                AflTeamSelection.player_id.isnot(None),
                AflTeamSelection.position != "EMERG",
            ).all()
            selected_player_ids = {s.player_id for s in sel_rows}
    except Exception:
        pass

    # For field view, build structured position data server-side
    field_data = None
    if view == "field":
        position_slots = LeaguePositionSlot.query.filter_by(league_id=league_id).all()

        # ── Slot counts from league config (or defaults) ──
        slot_counts = {}
        flex_count = 0
        for ps in position_slots:
            if ps.is_bench and ps.position_code == "FLEX":
                flex_count = ps.count
            elif not ps.is_bench:
                slot_counts[ps.position_code] = ps.count

        if not slot_counts:
            slot_counts = config.POSITIONS.copy()
        if not flex_count:
            flex_count = 1

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
        flex_data = [{"player": None} for _ in range(flex_count)]
        used_ids = set()

        # ── Step 1: Read already-positioned players from DB ──
        flex_players = []
        for r in roster:
            p = r.player
            if not r.is_benched and r.position_code in ("DEF", "MID", "FWD", "RUC"):
                zones.setdefault(r.position_code, []).append(p)
                used_ids.add(p.id)
            elif not r.is_benched and r.position_code == "FLEX":
                flex_players.append(p)
                used_ids.add(p.id)

        # Place already-positioned FLEX players into flex_data slots
        for i, p in enumerate(flex_players[:flex_count]):
            flex_data[i]["player"] = p

        # ── Step 2: Auto-fill empty on-field slots with unpositioned players ──
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
        for fd in flex_data:
            if fd["player"] is not None:
                used_ids.add(fd["player"].id)

        # ── Step 3: Auto-fill empty FLEX slots ──
        for i, slot in enumerate(flex_data):
            if slot["player"] is not None:
                continue
            remaining = sorted(
                [p for p in players if p.id not in used_ids],
                key=lambda p: p.sc_avg or 0, reverse=True,
            )
            if remaining:
                flex_data[i]["player"] = remaining[0]
                used_ids.add(remaining[0].id)

        flex_filled = sum(1 for fd in flex_data if fd["player"] is not None)

        # LTIL entries — exclude from reserves (approved only)
        ltil_entries = LongTermInjury.query.filter_by(
            team_id=team_id, removed_at=None, year=league.season_year, status="approved"
        ).all()
        # Pending LTIL entries — show in sidebar with different styling
        pending_ltil = LongTermInjury.query.filter_by(
            team_id=team_id, removed_at=None, year=league.season_year, status="pending"
        ).all()
        ltil_player_ids = {lt.player_id for lt in ltil_entries}

        # Reserves: all roster players not on-field, not in FLEX, not on LTIL
        # Grouped by highest-priority position (FWD > DEF > RUC > MID),
        # sorted within each group by SC avg (fallback to rating)
        _reserve_players = [p for p in players if p.id not in used_ids and p.id not in ltil_player_ids]
        _sort_key = lambda p: (p.sc_avg or 0, p.rating or 0)
        _pos_priority = {"FWD": 0, "DEF": 1, "RUC": 2, "MID": 3}
        _pos_order = ["DEF", "MID", "RUC", "FWD"]
        reserves_by_pos = {}
        for p in _reserve_players:
            positions = (p.position or "MID").split("/")
            # Pick highest-priority position for grouping
            best = min(positions, key=lambda x: _pos_priority.get(x, 99))
            if best not in _pos_priority:
                best = "MID"
            reserves_by_pos.setdefault(best, []).append(p)
        for pos in reserves_by_pos:
            reserves_by_pos[pos].sort(key=_sort_key, reverse=True)
        # Flat list for backward compat
        reserves = []
        for pos in _pos_order:
            reserves.extend(reserves_by_pos.get(pos, []))

        # ── Step 4: Persist to DB so swap/captain/VC operations work ──
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
            for fd in flex_data:
                p = fd["player"]
                if p is not None:
                    entry = roster_map.get(p.id)
                    if entry and (entry.position_code != "FLEX" or entry.is_benched):
                        entry.position_code = "FLEX"
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
            if count == 9:
                return [5, 4]
            if count == 10:
                return [5, 5]
            # 11+: rows of 5 then 4
            rows = []
            remaining = count
            while remaining > 0:
                row = min(5, remaining)
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
                    # Stale flag — player is on field but still marked emergency
                    r.is_emergency = False
                    fixed_stale = True
        if fixed_stale:
            db.session.commit()

        # Next lockout time — earliest scheduled game start for players on team
        next_lockout_time = None
        teams_playing = set()
        locked_teams = set()
        current_afl_round = None
        try:
            team_afl_teams = set(p.afl_team for p in players if p and p.afl_team)
            # Find the current/next round: first check live games, then scheduled
            current_round_game = (
                AflGame.query
                .filter(AflGame.year == league.season_year,
                        AflGame.status.in_(["live", "scheduled"]))
                .order_by(AflGame.scheduled_start.asc())
                .first()
            )
            if current_round_game:
                current_afl_round = current_round_game.afl_round
                round_games = AflGame.query.filter_by(
                    year=league.season_year, afl_round=current_afl_round
                ).all()
                for g in round_games:
                    teams_playing.add(g.home_team)
                    teams_playing.add(g.away_team)
                # Build set of teams whose game has started (locked)
                # Check both status AND scheduled_start time as fallback
                locked_teams = set()
                now = datetime.now()
                for g in round_games:
                    if g.status in ("live", "complete") or (g.scheduled_start and g.scheduled_start <= now):
                        locked_teams.add(g.home_team)
                        locked_teams.add(g.away_team)
                # Find earliest not-yet-started game for lockout countdown
                for g in sorted(round_games, key=lambda x: x.scheduled_start or datetime.max):
                    if g.scheduled_start and g.scheduled_start > now and g.status == "scheduled":
                        if g.home_team in team_afl_teams or g.away_team in team_afl_teams:
                            next_lockout_time = g.scheduled_start.isoformat()
                            break
        except Exception:
            pass

        # Build set of player IDs selected in AFL team lineups this round
        # Excludes emergencies — they are NOT playing
        selected_player_ids = set()
        if current_afl_round is not None:
            sel_rows = AflTeamSelection.query.filter_by(
                year=league.season_year, afl_round=current_afl_round
            ).filter(
                AflTeamSelection.player_id.isnot(None),
                AflTeamSelection.position != "EMERG",
            ).all()
            selected_player_ids = {s.player_id for s in sel_rows}

        # LTIL / SSP config
        season_cfg = SeasonConfig.query.filter_by(
            league_id=league_id, year=league.season_year
        ).first()
        ssp_slots = season_cfg.ssp_slots if season_cfg and season_cfg.ssp_slots else 1
        ssp_enabled = season_cfg.ssp_enabled if season_cfg else True
        now = datetime.now(timezone.utc)
        ssp_window_active = False
        if season_cfg and season_cfg.ssp_window_open and season_cfg.ssp_window_close:
            ssp_window_active = season_cfg.ssp_window_open <= now <= season_cfg.ssp_window_close
        can_remove_ltil = league.status in ("offseason", "setup")

        # Reserve 7s lineup IDs for the upcoming round
        from models.database import Reserve7sLineup, Reserve7sFixture
        from blueprints.reserve7s import _get_next_7s_round, AGE_CUTOFF
        sevens_round = _get_next_7s_round(league_id, league.season_year)
        sevens_entries = Reserve7sLineup.query.filter_by(
            league_id=league_id, team_id=team_id,
            afl_round=sevens_round, year=league.season_year,
        ).all()
        sevens_ids = [e.player_id for e in sevens_entries]
        sevens_captain_id = next((e.player_id for e in sevens_entries if e.is_captain), None)
        # Check if 7s fixture exists (so we know to show the bubbles)
        has_7s_fixture = Reserve7sFixture.query.filter_by(
            league_id=league_id, year=league.season_year, is_final=False,
        ).first() is not None

        # Form arrows (up/down/flat) for field view
        from models.form_utils import compute_player_form
        all_pids = [p.id for p in players if p]
        player_form = compute_player_form(all_pids, league.season_year)

        # Determine which roles are locked in (player's game already started)
        _player_by_id = {p.id: p for p in players if p}
        def _is_pid_locked(pid):
            pl = _player_by_id.get(pid)
            return bool(pl and pl.afl_team and locked_teams and pl.afl_team in locked_teams)

        cap_locked = _is_pid_locked(cap_id) if cap_id else False
        vc_locked = _is_pid_locked(vc_id) if vc_id else False
        locked_emg_count = sum(1 for eid in emergency_ids if _is_pid_locked(eid))
        locked_7s_count = sum(1 for sid in sevens_ids if _is_pid_locked(sid))

        field_data = {
            "zones": zones,
            "flex_data": flex_data,
            "flex_filled": flex_filled,
            "flex_count": flex_count,
            "reserves": reserves,
            "reserves_by_pos": reserves_by_pos,
            "cap_id": cap_id,
            "vc_id": vc_id,
            "slot_counts": slot_counts,
            "zone_layouts": zone_layouts,
            "zone_filled": zone_filled,
            "emergency_ids": emergency_ids,
            "next_lockout_time": next_lockout_time,
            "ltil_entries": ltil_entries,
            "pending_ltil": pending_ltil,
            "ssp_slots": ssp_slots,
            "ssp_enabled": ssp_enabled,
            "ssp_window_active": ssp_window_active,
            "teams_playing": teams_playing,
            "locked_teams": locked_teams,
            "can_remove_ltil": can_remove_ltil,
            "sevens_ids": sevens_ids,
            "sevens_captain_id": sevens_captain_id,
            "sevens_round": sevens_round,
            "has_7s_fixture": has_7s_fixture,
            "age_cutoff": AGE_CUTOFF,
            "player_form": player_form,
            "selected_player_ids": selected_player_ids,
            "cap_locked": cap_locked,
            "vc_locked": vc_locked,
            "locked_emg_count": locked_emg_count,
            "locked_7s_count": locked_7s_count,
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

    # ── Trade / draft alerts (owner only) ──
    pending_incoming = 0
    trade_is_open = False
    trade_close_date = None
    has_active_draft = False
    active_draft_round = None
    if is_owner:
        from models.database import Trade, DraftSession as DS2
        pending_incoming = Trade.query.filter_by(
            league_id=league_id, recipient_team_id=team.id, status="pending"
        ).count()

        season_cfg = SeasonConfig.query.filter_by(
            league_id=league_id, year=league.season_year
        ).first()
        if season_cfg:
            now_utc = datetime.now(timezone.utc)
            # Check mid-season trade window
            if (season_cfg.mid_trade_window_open and season_cfg.mid_trade_window_close
                    and now_utc < season_cfg.mid_trade_window_close):
                trade_is_open = True
                trade_close_date = season_cfg.mid_trade_window_close
            # Check off-season trade window
            elif (season_cfg.off_trade_window_open and season_cfg.off_trade_window_close
                    and now_utc < season_cfg.off_trade_window_close):
                trade_is_open = True
                trade_close_date = season_cfg.off_trade_window_close

        draft_live = DS2.query.filter_by(
            league_id=league_id, is_mock=False
        ).filter(DS2.status.in_(["in_progress", "paused", "scheduled"])).first()
        if draft_live:
            has_active_draft = True
            active_draft_round = draft_live.current_round

    # ── Wishlist data (owner only, wishlist view) ──
    wishlist_players = []
    if view == "wishlist" and is_owner:
        from models.database import PlayerWishlist, ScScore
        import os, pandas as pd

        wl_rows = PlayerWishlist.query.filter_by(
            user_id=current_user.id, league_id=league_id
        ).all()
        wl_player_ids = [w.player_id for w in wl_rows]
        wl_player_map = {w.player_id: w for w in wl_rows}

        if wl_player_ids:
            wl_players_db = AflPlayer.query.filter(AflPlayer.id.in_(wl_player_ids)).all()

            # Build rostered map for status
            all_rostered = (
                db.session.query(FantasyRoster.player_id, FantasyTeam.name)
                .join(FantasyTeam, FantasyTeam.id == FantasyRoster.team_id)
                .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
                .all()
            )
            rostered_map = {r[0]: r[1] for r in all_rostered}

            # Rolling averages for trend
            rolling = {}
            current_year = config.CURRENT_YEAR
            prev_year = current_year - 1
            frames = []
            for year_val in (prev_year, current_year):
                path = os.path.join(config.DATA_DIR, f"player_stats_{year_val}.csv")
                if os.path.exists(path):
                    try:
                        df = pd.read_csv(path, usecols=["Player", "Round", "SC", "Season"])
                        df = df.dropna(subset=["SC"])
                        frames.append(df)
                    except Exception:
                        pass
            if frames:
                all_scores = pd.concat(frames, ignore_index=True)
                wl_names = {p.name for p in wl_players_db}
                all_scores = all_scores[all_scores["Player"].isin(wl_names)]
                for name, group in all_scores.groupby("Player"):
                    scores = group["SC"].values
                    n = len(scores)
                    l3 = float(scores[-3:].mean()) if n >= 3 else (float(scores.mean()) if n else None)
                    rolling[name] = {"l3": round(l3, 1) if l3 is not None else None}

            for p in wl_players_db:
                sc_display = p.sc_avg or p.sc_avg_prev
                pr = rolling.get(p.name, {})
                l3 = pr.get("l3")
                trend_val = round(l3 - sc_display, 1) if l3 and sc_display else 0
                wishlist_players.append({
                    "player": p,
                    "sc_avg": round(sc_display, 1) if sc_display else None,
                    "l3": l3,
                    "trend": trend_val,
                    "games": p.games_played or p.career_games or 0,
                    "owner": rostered_map.get(p.id),
                    "added_at": wl_player_map[p.id].added_at,
                })
            wishlist_players.sort(key=lambda x: x["sc_avg"] or 0, reverse=True)

    return render_template("team/squad.html",
                           league=league,
                           team=team,
                           players=players,
                           roster=roster,
                           is_owner=is_owner,
                           view=view,
                           field_data=field_data,
                           alltime_stats=alltime_stats,
                           TEAM_LOGOS=TEAM_LOGOS,
                           delist_is_open=delist_is_open,
                           delist_period=delist_period,
                           team_delist_count=team_delist_count,
                           min_delists=min_delists,
                           delisted_player_ids=delisted_player_ids,
                           pending_incoming=pending_incoming,
                           trade_is_open=trade_is_open,
                           trade_close_date=trade_close_date,
                           has_active_draft=has_active_draft,
                           active_draft_round=active_draft_round,
                           next_delist_info=next_delist_info,
                           wishlist_players=wishlist_players,
                           selected_player_ids=selected_player_ids)


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


def _injury_return_display(player):
    """Build a friendly round-based injury return string for the modal."""
    if not player.injury_severity:
        return None
    from scrapers.afl_injuries import friendly_return_text
    from scrapers.squiggle import get_current_round
    current_round = get_current_round(config.CURRENT_YEAR)
    return friendly_return_text(player.injury_return, current_round)


# ── Lineup AJAX helpers ──────────────────────────────────────────────


def _check_player_locked(player_id, year):
    """Return True if the player's AFL game has started (rolling lockout).

    Uses both DB game status AND scheduled_start time as fallback,
    so lockout works even if game status hasn't been synced yet.
    """
    from datetime import datetime
    from models.live_sync import get_locked_player_ids

    player = db.session.get(AflPlayer, player_id)
    if not player or not player.afl_team:
        return False

    # Find the current/active round
    from scrapers.squiggle import get_current_round
    active_round = get_current_round(year)
    if active_round is None:
        # Fallback: check DB for any round with live/complete games
        latest_game = (
            AflGame.query
            .filter_by(year=year)
            .filter(AflGame.status.in_(["live", "complete"]))
            .order_by(AflGame.afl_round.desc())
            .first()
        )
        if not latest_game:
            return False
        active_round = latest_game.afl_round

    # Check if player's team has a game this round that has started
    game = AflGame.query.filter(
        AflGame.year == year,
        AflGame.afl_round == active_round,
        db.or_(
            AflGame.home_team == player.afl_team,
            AflGame.away_team == player.afl_team,
        ),
    ).first()

    if not game:
        return False

    # Lock if game status is live/complete
    if game.status in ("live", "complete"):
        return True

    # Fallback: lock if scheduled_start has passed (even if status not updated yet)
    # scheduled_start is stored in Melbourne local time
    if game.scheduled_start and game.scheduled_start <= datetime.now():
        return True

    return False


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

    # If current captain is locked, can't change captain at all
    current_cap = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True, is_captain=True
    ).first()
    if current_cap and current_cap.player_id != player_id and _check_player_locked(current_cap.player_id, league.season_year):
        return jsonify({"error": "Captain is locked (game started)"}), 409

    # Only on-field/flex players can be captain
    if entry.is_benched:
        return jsonify({"error": "Only on-field players can be captain"}), 409

    # Clear old captain on this team
    if current_cap:
        current_cap.is_captain = False
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

    # If current VC is locked, can't change VC at all
    current_vc = FantasyRoster.query.filter_by(
        team_id=team_id, is_active=True, is_vice_captain=True
    ).first()
    if current_vc and current_vc.player_id != player_id and _check_player_locked(current_vc.player_id, league.season_year):
        return jsonify({"error": "Vice Captain is locked (game started)"}), 409

    # Only on-field/flex players can be vice-captain
    if entry.is_benched:
        return jsonify({"error": "Only on-field players can be vice-captain"}), 409

    # Clear old VC on this team
    if current_vc:
        current_vc.is_vice_captain = False
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

    valid_codes = ("DEF", "MID", "FWD", "RUC", "FLEX")
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

    # Rolling lockout — block swap if either player's game has started
    if _check_player_locked(pid1, league.season_year):
        return jsonify({"error": f"{entry1.player.name} is locked (game started)"}), 409
    if _check_player_locked(pid2, league.season_year):
        return jsonify({"error": f"{entry2.player.name} is locked (game started)"}), 409

    # Validate position eligibility before swapping
    p1 = entry1.player
    p2 = entry2.player
    p1_positions = (p1.position or "MID").split("/")
    p2_positions = (p2.position or "MID").split("/")

    def _check_slot_eligibility(player_positions, target_code, player_name):
        """Check if player can fill the target slot (field or flex)."""
        if target_code in ("DEF", "MID", "FWD", "RUC"):
            if target_code not in player_positions:
                return f"{player_name} can't play {target_code}"
        # FLEX accepts any position — no check needed
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

    # Rolling lockout — block if player's game has started
    if _check_player_locked(player_id, league.season_year):
        return jsonify({"error": "Player is locked (game started)"}), 409

    # Must be a reserve (is_benched=True)
    if not entry.is_benched:
        return jsonify({"error": "Only reserve players can be set as emergency"}), 409

    MAX_EMERGENCIES = 4

    if entry.is_emergency:
        # Toggle off
        entry.is_emergency = False
    else:
        # Check mutual exclusivity with 7s
        from models.database import Reserve7sLineup
        from blueprints.reserve7s import _get_next_7s_round
        sevens_round = _get_next_7s_round(league_id, league.season_year)
        in_7s = Reserve7sLineup.query.filter_by(
            league_id=league_id, team_id=team_id,
            afl_round=sevens_round, year=league.season_year,
            player_id=player_id,
        ).first()
        if in_7s:
            return jsonify({"error": "Player is in 7s lineup — remove from 7s first"}), 409

        # Check limit — if full, bump the earliest unlocked emergency player
        current_emgs = FantasyRoster.query.filter_by(
            team_id=team_id, is_active=True, is_emergency=True
        ).all()
        if len(current_emgs) >= MAX_EMERGENCIES:
            # Find an unlocked emergency to bump (earliest = lowest player_id)
            bumped = None
            for emg_entry in sorted(current_emgs, key=lambda e: e.player_id):
                if not _check_player_locked(emg_entry.player_id, league.season_year):
                    bumped = emg_entry
                    break
            if not bumped:
                return jsonify({"error": "All emergency slots are locked"}), 409
            bumped.is_emergency = False
        entry.is_emergency = True

    db.session.commit()
    return jsonify({"ok": True, "is_emergency": entry.is_emergency})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/toggle-7s", methods=["POST"])
@login_required
def api_toggle_7s(league_id, team_id):
    """Toggle a reserve player in/out of the Reserve 7s lineup for the upcoming round."""
    from models.database import Reserve7sLineup, Reserve7sFixture
    from blueprints.reserve7s import _get_next_7s_round, AGE_CUTOFF

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
        return jsonify({"error": "Only reserve players can be in the 7s"}), 409

    year = league.season_year
    sevens_round = _get_next_7s_round(league_id, year)

    # Check if already in 7s
    existing = Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=team_id,
        afl_round=sevens_round, year=year, player_id=player_id,
    ).first()

    if existing:
        # Toggle off
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"ok": True, "in_7s": False, "sevens_count": Reserve7sLineup.query.filter_by(
            league_id=league_id, team_id=team_id, afl_round=sevens_round, year=year,
        ).count()})
    else:
        # Adding — if full, bump the earliest unlocked 7s player
        current_7s = Reserve7sLineup.query.filter_by(
            league_id=league_id, team_id=team_id,
            afl_round=sevens_round, year=year,
        ).all()
        if len(current_7s) >= 7:
            bumped = None
            for s_entry in sorted(current_7s, key=lambda e: e.player_id):
                if not _check_player_locked(s_entry.player_id, league.season_year):
                    bumped = s_entry
                    break
            if not bumped:
                return jsonify({"error": "All 7s slots are locked"}), 409
            db.session.delete(bumped)

        # Check age constraint: max 2 seniors
        player = db.session.get(AflPlayer, player_id)
        is_young = player and (player.age or 99) < AGE_CUTOFF

        if not is_young:
            senior_count = 0
            current_entries = Reserve7sLineup.query.filter_by(
                league_id=league_id, team_id=team_id,
                afl_round=sevens_round, year=year,
            ).all()
            for e in current_entries:
                p = db.session.get(AflPlayer, e.player_id)
                if p and (p.age or 99) >= AGE_CUTOFF:
                    senior_count += 1
            if senior_count >= 2:
                return jsonify({"error": "Max 2 senior (24+) players in 7s"}), 409

        # Mutually exclusive with emergency
        if entry.is_emergency:
            entry.is_emergency = False

        new_entry = Reserve7sLineup(
            league_id=league_id, team_id=team_id,
            afl_round=sevens_round, year=year,
            player_id=player_id, is_captain=False,
        )
        db.session.add(new_entry)
        db.session.commit()
        return jsonify({"ok": True, "in_7s": True, "sevens_count": Reserve7sLineup.query.filter_by(
            league_id=league_id, team_id=team_id, afl_round=sevens_round, year=year,
        ).count()})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/set-7s-captain", methods=["POST"])
@login_required
def api_set_7s_captain(league_id, team_id):
    """Set or unset captain for the 7s lineup."""
    from models.database import Reserve7sLineup
    from blueprints.reserve7s import _get_next_7s_round

    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id or team.owner_id != current_user.id:
        return jsonify({"error": "Not your team"}), 403

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    year = league.season_year
    sevens_round = _get_next_7s_round(league_id, year)

    # Must be in the 7s lineup
    entry = Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=team_id,
        afl_round=sevens_round, year=year, player_id=player_id,
    ).first()
    if not entry:
        return jsonify({"error": "Player not in 7s lineup"}), 404

    # Clear all captains first
    Reserve7sLineup.query.filter_by(
        league_id=league_id, team_id=team_id,
        afl_round=sevens_round, year=year,
    ).update({"is_captain": False})

    # Toggle: if already captain, we just cleared; otherwise set
    if not entry.is_captain:
        entry.is_captain = True

    db.session.commit()
    return jsonify({"ok": True, "captain_id": player_id if entry.is_captain else None})


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
        "injury_type": player.injury_type,
        "injury_return": player.injury_return,
        "injury_severity": player.injury_severity,
        "injury_return_display": _injury_return_display(player),
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


# ── LTIL / SSP API routes ──────────────────────────────────────────


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/add-to-ltil", methods=["POST"])
@login_required
def api_add_to_ltil(league_id, team_id):
    """Place a player on the Long-Term Injury List."""
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404
    if team.owner_id != current_user.id:
        return jsonify({"error": "Not your team"}), 403

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    from models.season_manager import add_to_ltil
    ltil, err = add_to_ltil(team_id, player_id, league_id, league.season_year)
    if err:
        return jsonify({"error": err}), 409
    return jsonify({"ok": True, "ltil_id": ltil.id})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/remove-from-ltil", methods=["POST"])
@login_required
def api_remove_from_ltil(league_id, team_id):
    """Remove a player from LTIL — blocked unless offseason."""
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404
    if team.owner_id != current_user.id:
        return jsonify({"error": "Not your team"}), 403

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400

    from models.season_manager import remove_from_ltil
    ltil, err = remove_from_ltil(team_id, player_id, league_id=league_id)
    if err:
        return jsonify({"error": err}), 409
    return jsonify({"ok": True})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/ssp-pick", methods=["POST"])
@login_required
def api_ssp_pick(league_id, team_id):
    """Select an SSP replacement for an LTIL player."""
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404
    if team.owner_id != current_user.id:
        return jsonify({"error": "Not your team"}), 403

    data = request.get_json(silent=True) or {}
    ltil_id = data.get("ltil_id")
    replacement_player_id = data.get("replacement_player_id")
    if not ltil_id or not replacement_player_id:
        return jsonify({"error": "Missing ltil_id or replacement_player_id"}), 400

    from models.season_manager import ssp_select_replacement
    ltil, err = ssp_select_replacement(team_id, ltil_id, replacement_player_id, league_id)
    if err:
        return jsonify({"error": err}), 409

    # Notify all league members about the SSP signing
    from models.notification_manager import create_notification
    replacement_player = db.session.get(AflPlayer, replacement_player_id)
    player_name = replacement_player.name if replacement_player else "Unknown"
    all_teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    for t in all_teams:
        create_notification(
            user_id=t.owner_id,
            league_id=league_id,
            notif_type="list_change",
            title=f"{team.name} signed {player_name} (SSP)",
            body=f"{team.name} selected {player_name} as an SSP replacement.",
            link=url_for("leagues.list_changes_page", league_id=league_id),
        )

    return jsonify({"ok": True})


@team_bp.route("/<int:league_id>/team/<int:team_id>/api/ssp-available")
@login_required
def api_ssp_available(league_id, team_id):
    """List unrostered players available for SSP selection."""
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        return jsonify({"error": "Team not found"}), 404
    if team.owner_id != current_user.id:
        return jsonify({"error": "Not your team"}), 403

    # Get all rostered player IDs in this league
    rostered_ids = set(
        r.player_id for r in
        FantasyRoster.query
        .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id, FantasyRoster.is_active == True)
        .all()
    )

    # Get unrostered players with SC data
    available = (
        AflPlayer.query
        .filter(AflPlayer.id.notin_(rostered_ids))
        .filter(AflPlayer.sc_avg.isnot(None))
        .order_by(AflPlayer.sc_avg.desc())
        .limit(200)
        .all()
    )

    return jsonify([
        {
            "id": p.id,
            "name": p.name,
            "afl_team": p.afl_team,
            "position": p.position,
            "sc_avg": p.sc_avg,
        }
        for p in available
    ])


@team_bp.route("/<int:league_id>/team/<int:team_id>/analytics")
@login_required
def team_analytics(league_id, team_id):
    """Team analytics: projected score, captain recs, bye clashes, form."""
    league = db.session.get(League, league_id)
    team = db.session.get(FantasyTeam, team_id)
    if not league or not team or team.league_id != league_id:
        flash("Team not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    from models.analytics import (
        compute_projected_score, captain_recommendations,
        detect_bye_clashes, get_team_form,
    )

    year = league.season_year
    projection = compute_projected_score(team_id, year, league_id)
    captain_recs = captain_recommendations(team_id, year)
    bye_clashes = detect_bye_clashes(team_id, year)
    form_data = get_team_form(team_id, year)

    return render_template("team/analytics.html",
                           league=league, team=team,
                           projection=projection,
                           captain_recs=captain_recs,
                           bye_clashes=bye_clashes,
                           form_data=form_data,
                           active_tab="team")

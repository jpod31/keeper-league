"""League management blueprint: create, list, dashboard, settings, scoring."""

import os
import re
from datetime import datetime

import pandas as pd
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.database import db, League, FantasyTeam
from models.league_manager import (
    create_league, join_league, get_user_leagues, get_league_teams,
    set_custom_scoring, get_custom_scoring,
)
import config
from config import SCORING_TYPE_LABELS


def _round_sort_key(round_str):
    """Convert round string to a sortable integer.

    'Round 0' -> 0, 'Round 24' -> 24,
    Finals -> 25-28 so they sort after home-and-away.
    """
    m = re.match(r"Round\s+(\d+)", str(round_str))
    if m:
        return int(m.group(1))
    finals_order = {
        "Qualifying Final": 25, "Elimination Final": 26,
        "Semi Final": 27, "Preliminary Final": 28, "Grand Final": 29,
    }
    return finals_order.get(str(round_str), 99)


def _compute_rolling_averages():
    """Compute L3 and L5 rolling SC averages for all players.

    Uses current year (CURRENT_YEAR) data first, then fills from previous
    year so that rolling windows cross seasons seamlessly.
    Returns dict: player_name -> {'l3': float|None, 'l5': float|None}.
    """
    current_year = config.CURRENT_YEAR
    prev_year = current_year - 1

    frames = []
    for year in (prev_year, current_year):
        # CSV data (historical fitzRoy exports)
        path = os.path.join(config.DATA_DIR, f"player_stats_{year}.csv")
        if os.path.exists(path):
            df = pd.read_csv(path, usecols=["Player", "Round", "SC", "Season"])
            df = df.dropna(subset=["SC"])
            df["_year"] = year
            df["_rnd"] = df["Round"].apply(_round_sort_key)
            frames.append(df)

        # Always also check DB (live-scraped data may be fresher than CSV)
        from models.database import PlayerStat, AflPlayer
        rows = (
            db.session.query(AflPlayer.name, PlayerStat.round, PlayerStat.supercoach_score)
            .join(AflPlayer, AflPlayer.id == PlayerStat.player_id)
            .filter(PlayerStat.year == year, PlayerStat.supercoach_score.isnot(None))
            .all()
        )
        if rows:
            df = pd.DataFrame(rows, columns=["Player", "Round", "SC"])
            df["Season"] = year
            df["_year"] = year
            df["_rnd"] = df["Round"]
            frames.append(df)

    if not frames:
        return {}

    all_scores = pd.concat(frames, ignore_index=True)
    # Deduplicate: keep DB data (last) over CSV if both exist for same player/year/round
    all_scores = all_scores.drop_duplicates(subset=["Player", "_year", "_rnd"], keep="last")
    all_scores = all_scores.sort_values(["_year", "_rnd"])

    result = {}
    current_year = config.CURRENT_YEAR
    for name, group in all_scores.groupby("Player"):
        # L3: last 3 games in current year only
        cy_scores = group[group["_year"] == current_year]["SC"].values
        l3 = float(cy_scores[-3:].mean()) if len(cy_scores) >= 3 else None
        # L5: last 5 games across all data
        scores = group["SC"].values
        n = len(scores)
        l5 = float(scores[-5:].mean()) if n >= 5 else (float(scores.mean()) if n else None)
        result[name] = {"l3": round(l3, 1) if l3 is not None else None,
                        "l5": round(l5, 1) if l5 is not None else None}

    return result

leagues_bp = Blueprint("leagues", __name__, url_prefix="/leagues",
                       template_folder="../templates")


@leagues_bp.route("/")
@login_required
def league_list():
    from models.database import Fixture, Trade, DraftSession, SeasonStanding

    leagues = get_user_leagues(current_user.id)

    # Auto-redirect: if user has a team, go straight to My Team
    first_team = FantasyTeam.query.filter_by(
        owner_id=current_user.id
    ).first()
    if first_team:
        return redirect(url_for("team.squad",
                                league_id=first_team.league_id,
                                team_id=first_team.id))

    # No teams — show create/join page
    if not leagues:
        return render_template("leagues/list.html", leagues=[], dashboard_data=[])

    # Build dashboard data for each league
    dashboard_data = []
    for lg in leagues:
        team = FantasyTeam.query.filter_by(league_id=lg.id, owner_id=current_user.id).first()
        entry = {"league": lg, "team": team}

        if team:
            # Next fixture (unplayed)
            next_fix = Fixture.query.filter(
                Fixture.league_id == lg.id,
                ((Fixture.home_team_id == team.id) | (Fixture.away_team_id == team.id)),
                Fixture.status == "scheduled",
            ).order_by(Fixture.afl_round).first()
            entry["next_fixture"] = next_fix

            # Last result (completed)
            last_fix = Fixture.query.filter(
                Fixture.league_id == lg.id,
                ((Fixture.home_team_id == team.id) | (Fixture.away_team_id == team.id)),
                Fixture.status == "completed",
            ).order_by(Fixture.afl_round.desc()).first()
            entry["last_result"] = last_fix

            # Standing
            standing = SeasonStanding.query.filter_by(
                league_id=lg.id, team_id=team.id, year=lg.season_year
            ).first()
            entry["standing"] = standing
        else:
            entry["next_fixture"] = None
            entry["last_result"] = None
            entry["standing"] = None

        # Pending trades across league
        pending_trades = Trade.query.filter_by(league_id=lg.id, status="pending").count()
        entry["pending_trades"] = pending_trades

        # Draft status
        draft = DraftSession.query.filter_by(
            league_id=lg.id, is_mock=False
        ).order_by(DraftSession.id.desc()).first()
        entry["draft"] = draft

        dashboard_data.append(entry)

    return render_template("leagues/list.html", leagues=leagues, dashboard_data=dashboard_data)


@leagues_bp.route("/create", methods=["GET", "POST"])
@login_required
def league_create():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        scoring_type = request.form.get("scoring_type", "supercoach")
        num_teams = request.form.get("num_teams", type=int) or 6
        squad_size = request.form.get("squad_size", type=int) or 38
        draft_type = request.form.get("draft_type", "snake")
        pick_timer = request.form.get("pick_timer_secs", type=int) or 120
        team_name = request.form.get("team_name", "").strip()
        form_vals = {
            "name": name, "scoring_type": scoring_type, "num_teams": num_teams,
            "squad_size": squad_size, "draft_type": draft_type,
            "pick_timer_secs": pick_timer, "team_name": team_name,
        }

        if not name:
            flash("League name is required.", "warning")
            return render_template("leagues/create.html", form=form_vals,
                                   available_stats=config.AVAILABLE_STATS,
                                   default_scoring=config.DEFAULT_CUSTOM_SCORING,
                                   stat_categories=config.STAT_CATEGORIES,
                                   scoring_presets=config.SCORING_PRESETS,
                                   default_uf_categories=config.DEFAULT_UF_CATEGORIES)

        # Read formation fields
        def_count = request.form.get("def_count", type=int) or 6
        mid_count = request.form.get("mid_count", type=int) or 9
        fwd_count = request.form.get("fwd_count", type=int) or 6
        ruc_count = request.form.get("ruc_count", type=int) or 1
        flex_count = request.form.get("flex_count", type=int) or 1
        position_slots = [
            ("DEF", def_count, False), ("MID", mid_count, False),
            ("FWD", fwd_count, False), ("RUC", ruc_count, False),
            ("FLEX", flex_count, True),
        ]
        on_field = def_count + mid_count + fwd_count + ruc_count

        hybrid_base = request.form.get("hybrid_base")
        try:
            league = create_league(
                name=name,
                commissioner_id=current_user.id,
                scoring_type=scoring_type,
                num_teams=num_teams,
                squad_size=squad_size,
                on_field_count=on_field,
                draft_type=draft_type,
                pick_timer_secs=pick_timer,
                position_slots=position_slots,
                hybrid_base=hybrid_base,
            )
        except Exception as e:
            db.session.rollback()
            flash(f"Failed to create league: {e}", "danger")
            return render_template("leagues/create.html", form=form_vals,
                                   available_stats=config.AVAILABLE_STATS,
                                   default_scoring=config.DEFAULT_CUSTOM_SCORING,
                                   stat_categories=config.STAT_CATEGORIES,
                                   scoring_presets=config.SCORING_PRESETS,
                                   default_uf_categories=config.DEFAULT_UF_CATEGORIES)

        # Hybrid weight/mode settings
        if scoring_type == "hybrid":
            hw = request.form.get("hybrid_base_weight", type=float)
            if hw is not None:
                league.hybrid_base_weight = max(0.0, min(1.0, hw))
            league.hybrid_custom_mode = request.form.get("hybrid_custom_mode", "points")
            db.session.commit()

        # Draft preferences
        league.draft_auto_randomize = "draft_auto_randomize" in request.form
        draft_date = request.form.get("draft_scheduled_date")
        if draft_date:
            try:
                league.draft_scheduled_date = datetime.fromisoformat(draft_date)
            except ValueError:
                pass
        db.session.commit()

        # Inline scoring rules (custom, hybrid, or ultimate_footy)
        if scoring_type == "ultimate_footy":
            uf_stats = request.form.getlist("uf_category")
            rules = {stat.strip(): 1 for stat in uf_stats if stat.strip()}
            if rules:
                set_custom_scoring(league.id, rules)
        elif scoring_type in ("custom", "hybrid"):
            stat_cols = request.form.getlist("stat_column")
            stat_pts = request.form.getlist("points_per")
            rules = {}
            for col, pts in zip(stat_cols, stat_pts):
                col = col.strip()
                if col:
                    try:
                        rules[col] = float(pts)
                    except (ValueError, TypeError):
                        rules[col] = 0
            if rules:
                set_custom_scoring(league.id, rules)

        # Auto-join the commissioner
        join_league(league.id, current_user.id,
                    team_name or f"{current_user.display_name}'s Team")

        # Auto-generate season config with mid/off-season settings
        from models.database import SeasonConfig, LockoutConfig
        if not SeasonConfig.query.filter_by(league_id=league.id, year=league.season_year).first():
            mid_draft = request.form.get("mid_season_draft_enabled") == "on"
            mid_draft_round = request.form.get("mid_season_draft_after_round", type=int)
            mid_draft_picks = request.form.get("mid_season_draft_picks", type=int) or 1
            offseason_delist = request.form.get("offseason_delist_min", type=int) or 3
            ssp = request.form.get("ssp_enabled") == "on"
            db.session.add(SeasonConfig(
                league_id=league.id,
                year=league.season_year,
                mid_season_draft_enabled=mid_draft,
                mid_season_draft_after_round=mid_draft_round,
                mid_season_draft_picks=mid_draft_picks,
                offseason_delist_min=offseason_delist,
                ssp_enabled=ssp,
            ))
        if not LockoutConfig.query.filter_by(league_id=league.id).first():
            db.session.add(LockoutConfig(league_id=league.id, lockout_type="game_start"))
        db.session.commit()

        from models.fixture_manager import generate_round_robin, generate_7s_round_robin
        generate_round_robin(league.id, league.season_year, num_rounds=23)
        generate_7s_round_robin(league.id, league.season_year, num_rounds=23)

        flash(f"League '{league.name}' created!", "success")
        return redirect(url_for("leagues.dashboard", league_id=league.id))

    if request.args.get("format") == "json":
        # Serialise scoring presets so React can render preset buttons + load rules
        ser_presets = {}
        for key, preset in config.SCORING_PRESETS.items():
            ser_presets[key] = {
                "label": preset.get("label", key),
                "rules": preset.get("rules", {}),
            }
        return jsonify({
            "available_stats": list(config.AVAILABLE_STATS),
            "default_scoring": dict(config.DEFAULT_CUSTOM_SCORING),
            "stat_categories": {k: list(v) for k, v in config.STAT_CATEGORIES.items()},
            "scoring_presets": ser_presets,
            "default_uf_categories": list(config.DEFAULT_UF_CATEGORIES),
        })

    return render_template("leagues/create.html", form={},
                           available_stats=config.AVAILABLE_STATS,
                           default_scoring=config.DEFAULT_CUSTOM_SCORING,
                           stat_categories=config.STAT_CATEGORIES,
                           scoring_presets=config.SCORING_PRESETS,
                           default_uf_categories=config.DEFAULT_UF_CATEGORIES)


@leagues_bp.route("/<int:league_id>")
@login_required
def dashboard(league_id):
    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    user_team = FantasyTeam.query.filter_by(league_id=league_id, owner_id=current_user.id).first()

    teams = get_league_teams(league_id)
    is_commissioner = league.commissioner_id == current_user.id
    scoring_rules = get_custom_scoring(league_id) if league.scoring_type in ("custom", "hybrid", "ultimate_footy") else {}

    # ── JSON API mode for React SPA ──
    if request.args.get("format") == "json":
        from models.database import (
            Fixture as _Fx, SeasonStanding as _SS, RoundScore as _RS,
            Trade as _Tr, AflGame as _AG, Notification as _Notif,
            LineupSlot as _LS, WeeklyLineup as _WL, AflPlayer as _AP,
            LongTermInjury as _LTIL, DelistAction as _DA, DelistPeriod as _DP,
        )
        from scrapers.squiggle import get_current_round as _gcr
        from datetime import datetime, timezone, timedelta
        from sqlalchemy import or_, and_

        def _ser_team(t):
            return {
                "id": t.id,
                "name": t.name,
                "owner_id": t.owner_id,
                "owner": t.owner.display_name if t.owner else "?",
                "draft_order": t.draft_order,
                "is_mine": t.owner_id == current_user.id,
                "roster_count": sum(1 for r in t.roster if r.is_active) if t.roster else 0,
                "logo_url": t.logo_url,
            }

        # Stable accent palette so each fantasy team gets a distinctive
        # colour for hero gradients and ladder rows. Keyed by team_id %
        # len so a re-rendered page always shows the same colour for the
        # same team — even if FantasyTeam doesn't yet have a team_colour
        # column.
        _TEAM_PALETTE = [
            "#58a6ff", "#ffb471", "#bc8cff", "#3fb950", "#e3b341",
            "#ff7b72", "#7ee787", "#f778ba", "#79c0ff", "#ff9e64",
            "#9ece6a", "#bb9af7",
        ]

        def _team_summary(t):
            """Compact team shape for matchup hero / fixture cards."""
            if not t:
                return None
            colour = (getattr(t, "team_colour", None)
                      or _TEAM_PALETTE[(t.id or 0) % len(_TEAM_PALETTE)])
            return {
                "id": t.id,
                "name": t.name,
                "owner": t.owner.display_name if t.owner else "?",
                "is_mine": t.owner_id == current_user.id,
                "logo_url": t.logo_url,
                "colour": colour,
            }

        # ── Current AFL round + lockout countdown ──
        current_round = _gcr(league.season_year) or 0
        next_lockout_at = None
        live_games_count = 0
        try:
            next_game = (
                _AG.query
                .filter_by(year=league.season_year)
                .filter(_AG.status.in_(["scheduled", "live"]))
                .filter(_AG.scheduled_start.isnot(None))
                .order_by(_AG.scheduled_start.asc())
                .first()
            )
            if next_game and next_game.scheduled_start:
                ga = next_game.scheduled_start
                next_lockout_at = (
                    ga.isoformat() + ("" if ga.tzinfo else "+00:00")
                )
            live_games_count = _AG.query.filter_by(
                year=league.season_year, status="live"
            ).count()
        except Exception:
            pass

        # ── Trade window close countdown ──
        trade_close_at = None
        try:
            from models.database import SeasonConfig as _SC
            cfg = _SC.query.filter_by(
                league_id=league_id, year=league.season_year
            ).first()
            if cfg:
                for col in (cfg.mid_trade_window_close, cfg.off_trade_window_close):
                    if col is None:
                        continue
                    trade_close_at = col.isoformat() + ("" if col.tzinfo else "+00:00")
                    break
        except Exception:
            pass

        # ── This week's matchup for the current user ──
        this_matchup = None
        if user_team and current_round:
            fx = (
                _Fx.query
                .filter_by(league_id=league_id, year=league.season_year, afl_round=current_round)
                .filter(or_(_Fx.home_team_id == user_team.id, _Fx.away_team_id == user_team.id))
                .first()
            )
            if fx:
                is_home = fx.home_team_id == user_team.id
                my_team = fx.home_team if is_home else fx.away_team
                opp_team = fx.away_team if is_home else fx.home_team
                my_score = (fx.home_score if is_home else fx.away_score) or 0
                opp_score = (fx.away_score if is_home else fx.home_score) or 0
                this_matchup = {
                    "round": current_round,
                    "status": fx.status,
                    "me": {**_team_summary(my_team), "score": round(my_score, 1)},
                    "opp": {**_team_summary(opp_team), "score": round(opp_score, 1)},
                    "margin": round(my_score - opp_score, 1),
                }

        # ── Standings (top + my rank) ──
        standings_rows = (
            _SS.query.filter_by(league_id=league_id, year=league.season_year).all()
        )
        standings_sorted = sorted(
            standings_rows,
            key=lambda s: (-(s.ladder_points or 0), -(s.percentage or 0)),
        )
        standings = []
        my_rank = None
        for i, s in enumerate(standings_sorted, 1):
            if user_team and s.team_id == user_team.id:
                my_rank = i
            standings.append({
                "rank": i,
                "team": _team_summary(s.team),
                "wins": s.wins or 0,
                "losses": s.losses or 0,
                "draws": s.draws or 0,
                "pf": round(s.points_for or 0, 1),
                "pa": round(s.points_against or 0, 1),
                "pct": round(s.percentage or 0, 1),
                "pts": s.ladder_points or 0,
            })

        # ── Round fixtures (all matchups in current round) ──
        league_fixtures = []
        if current_round:
            for fx in _Fx.query.filter_by(
                league_id=league_id, year=league.season_year, afl_round=current_round,
            ).all():
                league_fixtures.append({
                    "id": fx.id,
                    "status": fx.status,
                    "home": {**_team_summary(fx.home_team), "score": round(fx.home_score or 0, 1)},
                    "away": {**_team_summary(fx.away_team), "score": round(fx.away_score or 0, 1)},
                })

        # ── Top performers (best individual player scores this round) ──
        top_performers = []
        if user_team and current_round:
            from models.database import ScScore as _SCS, FantasyRoster as _FR
            league_pids = [
                pid for (pid,) in db.session.query(_FR.player_id)
                .join(FantasyTeam, _FR.team_id == FantasyTeam.id)
                .filter(FantasyTeam.league_id == league_id, _FR.is_active == True)
                .all()
            ]
            if league_pids:
                sc_rows = (
                    _SCS.query
                    .filter(
                        _SCS.year == league.season_year,
                        _SCS.round == current_round,
                        _SCS.player_id.in_(league_pids),
                    )
                    .order_by(_SCS.sc_score.desc().nullslast())
                    .limit(6)
                    .all()
                )
                # Who owns each player → for the team colour border
                owner_map = {}
                for r in db.session.query(_FR.player_id, FantasyTeam).join(
                    FantasyTeam, _FR.team_id == FantasyTeam.id,
                ).filter(
                    FantasyTeam.league_id == league_id, _FR.is_active == True,
                    _FR.player_id.in_([s.player_id for s in sc_rows]),
                ).all():
                    owner_map[r[0]] = r[1]
                for s in sc_rows:
                    if not s.sc_score:
                        continue
                    p = db.session.get(_AP, s.player_id)
                    if not p:
                        continue
                    owner = owner_map.get(s.player_id)
                    top_performers.append({
                        "player_id": p.id,
                        "name": p.name,
                        "afl_team": p.afl_team or "",
                        "position": p.position or "",
                        "sc_score": s.sc_score,
                        "owner_team": _team_summary(owner) if owner else None,
                    })

        # ── Recent activity (last 20 notifications league-wide) ──
        recent_activity = []
        cutoff = datetime.utcnow() - timedelta(days=7)
        notif_rows = (
            _Notif.query.filter_by(league_id=league_id)
            .filter(_Notif.created_at > cutoff)
            .order_by(_Notif.created_at.desc())
            .limit(40)
            .all()
        )
        # De-dupe by title within the last hour (same title fan-out to N owners)
        seen = set()
        for n in notif_rows:
            key = (n.title, n.created_at.replace(minute=0, second=0, microsecond=0))
            if key in seen:
                continue
            seen.add(key)
            recent_activity.append({
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "created_at": (n.created_at.isoformat() + ("" if n.created_at.tzinfo else "+00:00")) if n.created_at else None,
                "link": n.link,
            })
            if len(recent_activity) >= 12:
                break

        # ── Pending trade counts for the current user ──
        pending_incoming = 0
        pending_outgoing = 0
        if user_team:
            pending_incoming = _Tr.query.filter_by(
                league_id=league_id, recipient_team_id=user_team.id, status="pending",
            ).count()
            pending_outgoing = _Tr.query.filter_by(
                league_id=league_id, proposer_team_id=user_team.id, status="pending",
            ).count()

        # ── Delist period open? ──
        delist_open = (_DP.query.filter_by(
            league_id=league_id, year=league.season_year, status="open",
        ).first() is not None)

        return jsonify({
            "league": {
                "id": league.id,
                "name": league.name,
                "status": league.status,
                "season_year": league.season_year,
                "scoring_type": league.scoring_type,
                "scoring_label": SCORING_TYPE_LABELS.get(league.scoring_type, league.scoring_type),
                "num_teams": league.num_teams,
                "squad_size": league.squad_size,
                "on_field_count": league.on_field_count,
                "draft_type": league.draft_type,
                "pick_timer_secs": league.pick_timer_secs,
                "trade_window_open": bool(league.trade_window_open),
                "trade_close_at": trade_close_at,
                "commissioner_name": league.commissioner.display_name if league.commissioner else "?",
                "invite_code": league.invite_code,
                "position_slots": [
                    {"position_code": ps.position_code, "count": ps.count, "is_bench": bool(getattr(ps, "is_bench", False))}
                    for ps in (league.position_slots or [])
                ],
            },
            "user_team": _ser_team(user_team) if user_team else None,
            "teams": [_ser_team(t) for t in teams],
            "is_commissioner": is_commissioner,
            "scoring_rules": scoring_rules,
            "has_completed_onboarding": bool(getattr(current_user, "has_completed_onboarding", True)),
            # NEW — feeds the redesigned dashboard
            "current_round": current_round,
            "live_games_count": live_games_count,
            "next_lockout_at": next_lockout_at,
            "this_matchup": this_matchup,
            "my_rank": my_rank,
            "standings": standings,
            "league_fixtures": league_fixtures,
            "top_performers": top_performers,
            "recent_activity": recent_activity,
            "pending_incoming": pending_incoming,
            "pending_outgoing": pending_outgoing,
            "delist_open": delist_open,
        })

    # Default to My Team view if user has a team (HTML mode only)
    if user_team and not request.args.get("overview"):
        return redirect(url_for("team.squad", league_id=league_id, team_id=user_team.id))

    return render_template("leagues/dashboard.html",
                           league=league,
                           teams=teams,
                           user_team=user_team,
                           is_commissioner=is_commissioner,
                           scoring_rules=scoring_rules)


@leagues_bp.route("/<int:league_id>/join", methods=["POST"])
@login_required
def league_join(league_id):
    team_name = request.form.get("team_name", "").strip()
    if not team_name:
        flash("Team name is required.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    team, error = join_league(league_id, current_user.id, team_name)
    if error:
        flash(error, "danger")
    else:
        flash(f"Joined with team '{team.name}'!", "success")
    return redirect(url_for("leagues.dashboard", league_id=league_id))


@leagues_bp.route("/<int:league_id>/leave", methods=["POST"])
@login_required
def league_leave(league_id):
    """Leave a league — removes the user's team and all associated data."""
    from models.database import (
        FantasyRoster, WeeklyLineup, LineupSlot, RoundScore,
        Reserve7sLineup, Reserve7sRoundScore, Reserve7sStanding,
        LongTermInjury, SeasonStanding, Trade, TradeItem, KeeperHistory,
    )

    league = db.session.get(League, league_id)
    if not league:
        flash("League not found.", "warning")
        return redirect(url_for("leagues.league_list"))

    team = FantasyTeam.query.filter_by(
        league_id=league_id, owner_id=current_user.id
    ).first()
    if not team:
        flash("You don't have a team in this league.", "warning")
        return redirect(url_for("leagues.league_list"))

    # Commissioners can't leave their own league — they must delete it
    if league.commissioner_id == current_user.id:
        flash("You're the commissioner — transfer ownership first or delete the league.", "warning")
        return redirect(url_for("leagues.dashboard", league_id=league_id))

    team_id = team.id
    team_name = team.name

    # Clean up all team-related data
    Reserve7sLineup.query.filter_by(team_id=team_id).delete()
    Reserve7sRoundScore.query.filter_by(team_id=team_id).delete()
    Reserve7sStanding.query.filter_by(team_id=team_id).delete()
    LineupSlot.query.filter(
        LineupSlot.lineup_id.in_(
            db.session.query(WeeklyLineup.id).filter_by(team_id=team_id)
        )
    ).delete(synchronize_session=False)
    WeeklyLineup.query.filter_by(team_id=team_id).delete()
    RoundScore.query.filter_by(team_id=team_id).delete()
    SeasonStanding.query.filter_by(team_id=team_id).delete()
    LongTermInjury.query.filter_by(team_id=team_id).delete()
    KeeperHistory.query.filter(
        (KeeperHistory.original_team_id == team_id) |
        (KeeperHistory.current_owner_id == team_id)
    ).delete(synchronize_session=False)
    # Cancel pending trades involving this team
    Trade.query.filter(
        ((Trade.proposer_team_id == team_id) | (Trade.recipient_team_id == team_id)),
        Trade.status == "pending",
    ).update({"status": "cancelled"}, synchronize_session=False)
    FantasyRoster.query.filter_by(team_id=team_id).delete()
    db.session.delete(team)
    db.session.commit()

    flash(f"You left '{league.name}' (team '{team_name}' removed).", "info")
    return redirect(url_for("leagues.league_list"))


@leagues_bp.route("/join-by-code", methods=["POST"])
@login_required
def league_join_by_code():
    """Redirect to the invite page for a given invite code."""
    code = request.form.get("invite_code", "").strip().upper()
    if not code:
        flash("Please enter an invite code.", "warning")
        return redirect(url_for("leagues.league_list"))
    league = League.query.filter_by(invite_code=code).first()
    if not league:
        flash("Invalid invite code. Check with your commissioner.", "warning")
        return redirect(url_for("leagues.league_list"))
    return redirect(url_for("leagues.league_invite", code=code))


@leagues_bp.route("/invite/<code>", methods=["GET", "POST"])
def league_invite(code):
    """Public invite page — anyone with the link can view and join."""
    from flask_login import current_user as cu
    league = League.query.filter_by(invite_code=code).first()
    if not league:
        flash("Invalid or expired invite link.", "warning")
        return redirect(url_for("auth.login"))

    # If not logged in, redirect to login with next= back here
    if not cu.is_authenticated:
        flash("Log in or create an account to join this league.", "info")
        return redirect(url_for("auth.login", next=url_for("leagues.league_invite", code=code)))

    # Check if already a member
    existing = FantasyTeam.query.filter_by(league_id=league.id, owner_id=cu.id).first()
    if existing:
        flash("You're already in this league!", "info")
        return redirect(url_for("leagues.dashboard", league_id=league.id))

    if request.method == "POST":
        team_name = request.form.get("team_name", "").strip()
        if not team_name:
            flash("Team name is required.", "warning")
            return render_template("leagues/invite.html", league=league, code=code)

        team, error = join_league(league.id, cu.id, team_name)
        if error:
            flash(error, "danger")
            return render_template("leagues/invite.html", league=league, code=code)
        flash(f"Joined '{league.name}' with team '{team.name}'!", "success")
        return redirect(url_for("leagues.dashboard", league_id=league.id))

    if request.args.get("format") == "json":
        team_count = FantasyTeam.query.filter_by(league_id=league.id).count()
        return jsonify({
            "league": {
                "id": league.id,
                "name": league.name,
                "season_year": league.season_year,
                "scoring_type": league.scoring_type,
                "num_teams": league.num_teams,
                "squad_size": league.squad_size,
                "commissioner": league.commissioner.display_name if league.commissioner else "?",
                "team_count": team_count,
            },
            "code": code,
            "is_full": team_count >= (league.num_teams or 10),
            "user_authenticated": True,
        })

    return render_template("leagues/invite.html", league=league, code=code)



# ── Register route sub-modules (must be after leagues_bp is defined) ──────
from blueprints import leagues_settings      # noqa: F401, E402
from blueprints import leagues_season        # noqa: F401, E402
from blueprints import leagues_players       # noqa: F401, E402
from blueprints import leagues_commissioner  # noqa: F401, E402

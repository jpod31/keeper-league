"""Start a new season: the one way a league moves from one year into the next.

Everything a year owns is keyed on ``league.season_year``: the SeasonConfig,
fixtures (main + 7s), standings, delist periods, LTIL entries, lineups. Moving
year therefore has to happen in one place, or the league ends up half in each
year (the old "Finish Off-Season" step flipped the phase back to regular and
never moved the year at all).

``rollover_preview`` answers "can I start next season, and what will it look
like"; ``start_new_season`` does it. The commissioner page and the automatic
date-based transition both go through ``start_new_season``.
"""

from datetime import datetime, timezone
import logging

import config
from models.draft_picks import team_cards
from models.database import (
    db, League, FantasyTeam, FantasyRoster, SeasonConfig, Fixture, Trade,
    DelistPeriod, DraftSession, LongTermInjury,
)

logger = logging.getLogger(__name__)

# Per-year dates and window state. Everything else on SeasonConfig is a rule
# and carries into the new year unchanged unless the commissioner edits it.
_RESET_COLUMNS = {
    "id", "league_id", "year", "season_phase",
    "mid_trade_window_open", "mid_trade_window_close", "mid_draft_date",
    "off_trade_window_open", "off_trade_window_close",
    "ssp_window_open", "ssp_window_close",
    "season_start_date", "offseason_start_date",
    "supplemental_draft_date", "offseason_close_date",
}

AFL_SEASON_ROUNDS = 24
FINALS_WEEKS = {0: 0, 4: 3}

# The settings the commissioner can change on the way into the new year.
# owner: "cfg" = SeasonConfig column, "league" = League column,
#        "fixture" = only shapes the fixture build, never stored.
SETTINGS = [
    # key, owner, kind, lo, hi
    ("num_regular_rounds", "cfg", "int", 1, AFL_SEASON_ROUNDS),
    ("opening_round", "fixture", "bool", None, None),
    ("fixture_weighting", "fixture", "choice", ("random", "ladder"), None),
    ("finals_teams", "cfg", "choice", (0, 4), None),
    ("captain_scoring_enabled", "cfg", "bool", None, None),
    ("sevens_captain_enabled", "cfg", "bool", None, None),
    ("squad_size", "league", "int", 20, 60),
    ("offseason_draft_min_picks", "cfg", "int", 0, 15),
    ("ssp_enabled", "cfg", "bool", None, None),
    ("ssp_slots", "cfg", "int", 0, 5),
    ("ssp_cutoff_round", "cfg", "int", 1, AFL_SEASON_ROUNDS),
    ("mid_season_draft_enabled", "cfg", "bool", None, None),
    ("mid_season_draft_after_round", "cfg", "int", 1, AFL_SEASON_ROUNDS),
    ("mid_season_delist_required", "cfg", "int", 0, 10),
    ("mid_season_trade_mode", "cfg", "choice", ("window", "until_round", "all_year"), None),
    ("mid_season_trade_until_round", "cfg", "int", 1, AFL_SEASON_ROUNDS),
]
_SPEC = {s[0]: s for s in SETTINGS}


def _now():
    return datetime.now(timezone.utc)


def _cfg(league_id, year):
    return SeasonConfig.query.filter_by(league_id=league_id, year=year).first()


def current_settings(league):
    """The settings as they stand this year: the starting point for next year."""
    cfg = _cfg(league.id, league.season_year) or SeasonConfig(
        league_id=league.id, year=league.season_year)
    had_opening_round = Fixture.query.filter_by(
        league_id=league.id, year=league.season_year, afl_round=0, is_final=False,
    ).first() is not None

    out = {}
    for key, owner, kind, _lo, _hi in SETTINGS:
        if owner == "league":
            val = getattr(league, key)
        elif key == "opening_round":
            val = had_opening_round
        elif owner == "fixture":
            val = "random"
        else:
            val = getattr(cfg, key)
        if kind == "bool":
            val = bool(val)
        out[key] = val

    # Fill the blanks the settings page also defaults, so the form never
    # shows an empty box for a rule that is in force.
    out["num_regular_rounds"] = out["num_regular_rounds"] or 23
    out["finals_teams"] = out["finals_teams"] if out["finals_teams"] in (0, 4) else 0
    out["mid_season_draft_after_round"] = out["mid_season_draft_after_round"] or 12
    out["mid_season_trade_mode"] = out["mid_season_trade_mode"] or "window"
    out["mid_season_trade_until_round"] = out["mid_season_trade_until_round"] or 18
    out["mid_season_delist_required"] = (
        out["mid_season_delist_required"] if out["mid_season_delist_required"] is not None else 1)
    out["offseason_draft_min_picks"] = (
        out["offseason_draft_min_picks"] if out["offseason_draft_min_picks"] is not None else 4)
    out["ssp_slots"] = out["ssp_slots"] if out["ssp_slots"] is not None else 1
    out["ssp_cutoff_round"] = out["ssp_cutoff_round"] or 4

    # Draft plan carries across; added (compensation) picks belong to one
    # year's draft, so next year starts with none.
    from models.draft_picks import read_plan
    out.update(read_plan(cfg))
    out["draft_compensation"] = []
    return out


PLAN_KEYS = ("draft_order_basis", "draft_style", "draft_custom_order", "draft_compensation")


def clean_settings(league, raw):
    """Merge the commissioner's edits over this year's settings.

    Returns (settings, errors). Unknown keys are ignored; bad values are
    errors rather than silently clamped, so nothing changes that the
    commissioner did not see.
    """
    settings = current_settings(league)
    from models.draft_picks import clean_plan
    plan, errors = clean_plan(
        league.id, {k: v for k, v in (raw or {}).items() if k in PLAN_KEYS},
        base={k: settings[k] for k in PLAN_KEYS})
    settings.update(plan)
    for key, val in (raw or {}).items():
        spec = _SPEC.get(key)
        if not spec:
            continue
        _k, _owner, kind, lo, hi = spec
        if kind == "bool":
            settings[key] = bool(val)
        elif kind == "int":
            try:
                n = int(val)
            except (TypeError, ValueError):
                errors.append(f"{key} must be a whole number.")
                continue
            if n < lo or n > hi:
                errors.append(f"{key} must be between {lo} and {hi}.")
                continue
            settings[key] = n
        elif kind == "choice":
            if val not in lo:
                try:
                    val = int(val)
                except (TypeError, ValueError):
                    pass
            if val not in lo:
                errors.append(f"{key} must be one of {', '.join(map(str, lo))}.")
                continue
            settings[key] = val

    weeks = settings["num_regular_rounds"] + FINALS_WEEKS.get(settings["finals_teams"], 0)
    if weeks > AFL_SEASON_ROUNDS:
        errors.append(
            f"{settings['num_regular_rounds']} rounds plus "
            f"{FINALS_WEEKS[settings['finals_teams']]} finals weeks is {weeks}, "
            f"more than the {AFL_SEASON_ROUNDS} AFL rounds.")

    on_field = (league.on_field_count or 0) + sum(
        s.count for s in (league.position_slots or [])
        if s.is_bench and s.position_code == "FLEX")
    if on_field and settings["squad_size"] < on_field:
        errors.append(
            f"A squad of {settings['squad_size']} can't fill the {on_field}-man side.")
    if settings["offseason_draft_min_picks"] >= settings["squad_size"]:
        errors.append("Off-season draft places must be fewer than the squad size.")
    return settings, errors


def _checks(league, settings):
    """Readiness list. level: ok | warn | block. Only 'block' stops the start."""
    year = league.season_year
    cfg = _cfg(league.id, year)
    checks = []

    def add(key, level, label, detail="", action=None):
        checks.append({"key": key, "level": level, "label": label, "detail": detail,
                       "action": action})

    if league.status != "offseason":
        add("phase", "block", "League is not in the off-season",
            f"The {year} season has to finish and move into the off-season first.")
    else:
        add("phase", "ok", f"{year} season finished")

    if _cfg(league.id, year + 1) or Fixture.query.filter_by(
            league_id=league.id, year=year + 1).first():
        add("next_year", "block", f"{year + 1} already has data",
            f"A {year + 1} season config or fixture already exists.")

    open_period = DelistPeriod.query.filter_by(
        league_id=league.id, year=year, status="open").first()
    if open_period:
        add("delists", "block", "Delist period still open",
            "Lists are still being cut. Close it once everyone is done.",
            {"kind": "step", "step": "close_delists", "label": "Close delists"})
    else:
        add("delists", "ok", "Delist period closed")

    trade_open = bool(league.trade_window_open)
    if cfg and cfg.off_trade_window_open and cfg.off_trade_window_close:
        close = cfg.off_trade_window_close
        if close.tzinfo is None:
            close = close.replace(tzinfo=timezone.utc)
        trade_open = trade_open or close > _now()
    if trade_open:
        add("trades", "block", "Trade window still open",
            "Trades can't be in flight when the year changes.",
            {"kind": "step", "step": "close_trades", "label": "Close trade window"})
    else:
        add("trades", "ok", "Trade window closed")

    live_draft = DraftSession.query.filter_by(league_id=league.id, is_mock=False).filter(
        DraftSession.status.in_(["scheduled", "in_progress", "paused"])).first()
    if live_draft:
        add("draft", "block", "A draft is scheduled or running", "Finish or delete it first.",
            {"kind": "link", "to": "draft/setup", "label": "Draft setup"})
    else:
        from models.season_manager import offseason_draft_done
        if offseason_draft_done(league.id, year):
            add("draft", "ok", "Off-season draft done")
        else:
            add("draft", "warn", "No off-season draft held",
                "Free agents open as soon as the season starts.",
                {"kind": "link", "to": "draft/setup", "label": "Draft setup"})

    pending = Trade.query.filter_by(league_id=league.id, status="pending").count()
    if pending:
        add("pending_trades", "warn", f"{pending} trade offer{'s' if pending != 1 else ''} still pending",
            "They will be marked expired.")

    ltil = LongTermInjury.query.filter_by(league_id=league.id, removed_at=None).count()
    if ltil:
        add("ltil", "warn", f"{ltil} player{'s' if ltil != 1 else ''} on the LTIL",
            "They come off the list and back into their squads.")

    squad = settings["squad_size"]
    over, under = [], []
    for t in FantasyTeam.query.filter_by(league_id=league.id).order_by(FantasyTeam.name).all():
        n = FantasyRoster.query.filter_by(team_id=t.id, is_active=True).count()
        if n > squad:
            over.append({"team_id": t.id, "count": n})
        elif n < squad:
            under.append({"team_id": t.id, "count": n})
    if over:
        add("lists_over", "warn", f"Over the {squad}-man cap",
            "They start the year over and cut at the mid-season delists.")
        checks[-1]["teams"] = over
    if under:
        add("lists_under", "warn", f"Under the {squad}-man cap",
            "They can fill from the player pool once the season starts.")
        checks[-1]["teams"] = under
    if not over and not under:
        add("lists", "ok", f"Every list at {squad}")

    if config.CURRENT_YEAR < year + 1:
        add("afl_year", "warn", f"AFL data still on {config.CURRENT_YEAR}",
            f"Live scores and the player pool follow config.CURRENT_YEAR. "
            f"Move it to {year + 1} before Opening Round.")
    return checks


def fixture_preview(league, settings):
    """Each side's draw against last year's ladder: how many games against
    each finishing position, and the average finish of its opponents."""
    from models.draft_picks import ladder
    from models.fixture_manager import ladder_weighted_rounds, meetings

    order = ladder(league.id, league.season_year)
    if len(order) < 2:
        return None
    n_rounds = settings["num_regular_rounds"]
    cycle_len = len(order) - 1 if len(order) % 2 == 0 else len(order)
    weighted = settings["fixture_weighting"] == "ladder"
    if weighted:
        base, extra = ladder_weighted_rounds(order, n_rounds)
        count = meetings(order, base, n_rounds, extra)
    rows = []
    for pos, t in enumerate(order, 1):
        row = {"team": t.name, "team_id": t.id, "finish": pos}
        if weighted:
            games = {o.id: count.get(frozenset({t.id, o.id}), 0) for o in order if o.id != t.id}
            total = sum(games.values()) or 1
            opp_avg = sum(
                (i + 1) * games[o.id] for i, o in enumerate(order) if o.id != t.id) / total
            # Against an even draw (every rival equally often). Negative =
            # stronger opponents than even, i.e. a harder draw.
            even = (sum(range(1, len(order) + 1)) - pos) / (len(order) - 1)
            row["vs_even"] = round(opp_avg - even, 2)
            row["vs"] = [games[o.id] if o.id != t.id else None for o in order]
        rows.append(row)
    return {
        "weighting": settings["fixture_weighting"],
        "from_year": league.season_year,
        "full_cycles": n_rounds // cycle_len,
        "extra_rounds": n_rounds % cycle_len,
        "teams": rows,
    }


def rollover_preview(league, raw_settings=None):
    settings, errors = clean_settings(league, raw_settings)
    checks = _checks(league, settings)
    return {
        "fixture": fixture_preview(league, settings) if not errors else None,
        "from_year": league.season_year,
        "to_year": league.season_year + 1,
        "settings": settings,
        "current": current_settings(league),
        "errors": errors,
        "checks": checks,
        "can_start": not errors and not any(c["level"] == "block" for c in checks),
        "team_count": FantasyTeam.query.filter_by(league_id=league.id).count(),
        "teams": list(team_cards(league.id).values()),
        "ladder": final_ladder(league),
    }


def final_ladder(league):
    """This year's finishing order, best first, for the handover."""
    from models.draft_picks import ladder
    from models.database import SeasonStanding
    rows = {s.team_id: s for s in SeasonStanding.query.filter_by(
        league_id=league.id, year=league.season_year).all()}
    cards = team_cards(league.id)
    out = []
    for pos, t in enumerate(ladder(league.id, league.season_year), 1):
        st = rows.get(t.id)
        out.append({**cards[t.id], "pos": pos,
                    "wins": st.wins if st else 0, "losses": st.losses if st else 0,
                    "draws": st.draws if st else 0,
                    "pct": round(st.percentage or 0, 1) if st else 0})
    return out


def _new_config(league, old, settings, new_year, now):
    new = SeasonConfig(league_id=league.id, year=new_year)
    if old is not None:
        for col in SeasonConfig.__table__.columns:
            if col.name not in _RESET_COLUMNS:
                setattr(new, col.name, getattr(old, col.name))
    for key, owner, _kind, _lo, _hi in SETTINGS:
        if owner == "cfg":
            setattr(new, key, settings[key])
    from models.draft_picks import write_plan
    write_plan(new, {k: settings[k] for k in PLAN_KEYS})
    # The settings page drives these pairs off one control; keep them in step.
    new.mid_season_trade_enabled = settings["mid_season_draft_enabled"]
    new.mid_season_trade_after_round = settings["mid_season_draft_after_round"]
    new.trades_all_year = settings["mid_season_trade_mode"] == "all_year"
    new.season_phase = "regular"
    # Marks where this season began, so "the latest supplemental draft" can
    # tell last November's draft from this year's mid-season one.
    new.season_start_date = now.replace(tzinfo=None)
    return new


def start_new_season(league_id, raw_settings=None, notify=True, force=False):
    """Move the league into its next year. Returns (summary, error).

    ``force`` skips the readiness blocks (used by the date-based automatic
    transition, which has already decided it is time). Bad settings always
    refuse.
    """
    league = db.session.get(League, league_id)
    if not league:
        return None, "League not found."

    preview = rollover_preview(league, raw_settings)
    if preview["errors"]:
        return None, " ".join(preview["errors"])
    blocks = [c for c in preview["checks"] if c["level"] == "block"]
    if blocks and not force:
        return None, " ".join(f"{c['label']}." for c in blocks)

    settings = preview["settings"]
    old_year = league.season_year
    from models.draft_picks import ladder
    ladder_order = ladder(league.id, old_year)
    weighted = settings["fixture_weighting"] == "ladder"
    new_year = old_year + 1
    now = _now()
    old_cfg = _cfg(league.id, old_year)

    # Close out the year that's ending.
    if old_cfg is not None:
        if old_cfg.off_trade_window_open and (
                not old_cfg.off_trade_window_close
                or old_cfg.off_trade_window_close.replace(tzinfo=timezone.utc) > now):
            old_cfg.off_trade_window_close = now.replace(tzinfo=None)
    expired = 0
    for t in Trade.query.filter_by(league_id=league.id, status="pending").all():
        t.status = "expired"
        t.responded_at = now
        expired += 1
    released = 0
    for entry in LongTermInjury.query.filter_by(league_id=league.id, removed_at=None).all():
        entry.removed_at = now
        if entry.status == "pending":
            entry.status = "rejected"
            entry.reviewed_at = now
        released += 1

    # Open the new one.
    db.session.add(_new_config(league, old_cfg, settings, new_year, now))
    league.season_year = new_year
    league.status = "active"
    league.trade_window_open = False
    league.squad_size = settings["squad_size"]
    db.session.commit()

    from models.fixture_manager import (
        generate_round_robin, generate_7s_round_robin,
        generate_preseason, generate_7s_preseason,
    )
    fixtures, err = generate_round_robin(
        league.id, new_year, settings["num_regular_rounds"],
        ladder_teams=ladder_order if weighted else None)
    if err:
        logger.error("League %d: %d fixture build failed: %s", league.id, new_year, err)
        return None, f"Moved to {new_year} but the fixture failed: {err}. Generate it from League Settings."
    generate_7s_round_robin(league.id, new_year, settings["num_regular_rounds"])
    if settings["opening_round"]:
        # Ladder-weighted: Opening Round is 1v2, 3v4, 5v6 off last year.
        generate_preseason(league.id, new_year, teams=ladder_order if weighted else None)
        generate_7s_preseason(league.id, new_year)

    from models.draft_picks import ensure_future_picks
    ensure_future_picks(league.id)

    regular = Fixture.query.filter_by(league_id=league.id, year=new_year, is_final=False)
    first = min((f.afl_round for f in regular.all()), default=None)
    opening = [
        {"home_id": f.home_team_id, "away_id": f.away_team_id}
        for f in regular.filter_by(afl_round=first).order_by(Fixture.id).all()
    ] if first is not None else []

    summary = {
        "year": new_year,
        "fixture_weighting": settings["fixture_weighting"],
        "first_round": first,
        "first_matches": opening,
        "teams": list(team_cards(league.id).values()),
        "rounds": settings["num_regular_rounds"],
        "opening_round": settings["opening_round"],
        "fixtures": Fixture.query.filter_by(league_id=league.id, year=new_year).count(),
        "trades_expired": expired,
        "ltil_released": released,
    }
    logger.info("League %d: started season %d %s", league.id, new_year, summary)

    if notify:
        try:
            from models.notification_manager import create_notification
            for t in FantasyTeam.query.filter_by(league_id=league.id).all():
                if t.owner_id:
                    create_notification(
                        user_id=t.owner_id, league_id=league.id,
                        notif_type="season_transition",
                        title=f"The {new_year} season is open",
                        body=f"{settings['num_regular_rounds']} rounds. Your {new_year} fixture is out.",
                        link=f"/leagues/{league.id}/fixture",
                    )
            db.session.commit()
        except Exception:
            logger.exception("League %d: new-season notifications failed", league.id)
    return summary, None

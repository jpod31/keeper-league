"""Draft order and pick ownership for the supplemental drafts.

The "<year> R<n>" pick is that year's OFF-SEASON draft (held in November,
after the season it is named for). Every team holds its own picks for the
open draft plus the next two years; a trade moves ``current_owner_id``.
When the off-season draft is created, each slot goes to whoever owns that
pick, so a traded pick is used by its new owner on the night.

Order is reverse ladder (wooden spoon first), the same in every round, the
way the AFL runs its national draft.
"""

from models.database import (
    db, League, FantasyTeam, FutureDraftPick, SeasonConfig, SeasonStanding,
)

YEARS_AHEAD = 2


def reverse_ladder(league_id, year):
    """Teams worst-to-best on ``year``'s ladder. Teams with no standing row
    (nothing played yet) fall back to their draft_order, after the rest."""
    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.draft_order).all()
    rows = {
        s.team_id: s for s in SeasonStanding.query.filter_by(league_id=league_id, year=year).all()
    }
    ranked = [t for t in teams if t.id in rows]
    ranked.sort(key=lambda t: ((rows[t.id].ladder_points or 0), (rows[t.id].percentage or 0)))
    return ranked + [t for t in teams if t.id not in rows]


def ladder(league_id, year):
    """Best-to-worst, for fixture weighting."""
    return list(reversed(reverse_ladder(league_id, year)))


def pick_rounds(league):
    cfg = SeasonConfig.query.filter_by(league_id=league.id, year=league.season_year).first()
    n = cfg.offseason_draft_min_picks if cfg and cfg.offseason_draft_min_picks is not None else 4
    return max(1, n)


def first_open_year(league):
    """The earliest pick year still to be drafted."""
    from models.season_manager import offseason_draft_done
    year = league.season_year
    if league.status == "offseason" and offseason_draft_done(league.id, year):
        return year + 1
    return year


def ensure_future_picks(league_id):
    """Make sure every team holds its picks from the open draft through
    YEARS_AHEAD seasons out. Fills gaps only; never touches an existing
    pick, so traded ownership is safe. Returns how many were created."""
    league = db.session.get(League, league_id)
    if not league:
        return 0
    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    start = first_open_year(league)
    rounds = pick_rounds(league)
    have = {
        (p.year, p.round_number, p.original_team_id)
        for p in FutureDraftPick.query.filter(
            FutureDraftPick.league_id == league_id,
            FutureDraftPick.year >= start,
        ).all()
    }
    created = 0
    for year in range(start, league.season_year + YEARS_AHEAD + 1):
        for team in teams:
            for rnd in range(1, rounds + 1):
                if (year, rnd, team.id) in have:
                    continue
                db.session.add(FutureDraftPick(
                    league_id=league_id, year=year, round_number=rnd,
                    original_team_id=team.id, current_owner_id=team.id,
                ))
                created += 1
    if created:
        db.session.commit()
    return created


def open_picks_query(league, owner_id=None):
    """Picks that can still change hands: not yet drafted."""
    q = FutureDraftPick.query.filter(
        FutureDraftPick.league_id == league.id,
        FutureDraftPick.year >= first_open_year(league),
        FutureDraftPick.year <= league.season_year + YEARS_AHEAD,
    )
    if owner_id is not None:
        q = q.filter(FutureDraftPick.current_owner_id == owner_id)
    return q.order_by(FutureDraftPick.year, FutureDraftPick.round_number)


def slot_owner(league_id, year, round_number, original_team_id):
    """Who uses this team's pick in this round of ``year``'s off-season draft."""
    fp = FutureDraftPick.query.filter_by(
        league_id=league_id, year=year, round_number=round_number,
        original_team_id=original_team_id,
    ).first()
    return fp.current_owner_id if fp else original_team_id


# ── Draft plan: how a year's supplemental drafts are ordered ─────────────

import json

BASES = ("reverse_ladder", "ladder", "custom")
STYLES = ("linear", "snake")
PLACEMENTS = ("start", "end")
MAX_COMP = 12


def _loads(raw, default):
    try:
        val = json.loads(raw) if raw else default
    except (TypeError, ValueError):
        return default
    return val if isinstance(val, type(default)) else default


def read_plan(cfg):
    """The plan stored on a SeasonConfig, with defaults filled."""
    return {
        "draft_order_basis": (cfg.draft_order_basis if cfg and cfg.draft_order_basis in BASES
                              else "reverse_ladder"),
        "draft_style": cfg.draft_style if cfg and cfg.draft_style in STYLES else "linear",
        "draft_custom_order": _loads(cfg.draft_custom_order if cfg else None, []),
        "draft_compensation": _loads(cfg.draft_compensation if cfg else None, []),
    }


def clean_plan(league_id, raw, base=None):
    """Validate a submitted plan over ``base``. Returns (plan, errors)."""
    plan = dict(base or read_plan(None))
    errors = []
    raw = raw or {}
    team_ids = {t.id for t in FantasyTeam.query.filter_by(league_id=league_id).all()}

    if "draft_order_basis" in raw:
        if raw["draft_order_basis"] in BASES:
            plan["draft_order_basis"] = raw["draft_order_basis"]
        else:
            errors.append("Draft order must be reverse ladder, ladder or custom.")
    if "draft_style" in raw:
        if raw["draft_style"] in STYLES:
            plan["draft_style"] = raw["draft_style"]
        else:
            errors.append("Draft style must be linear or snake.")

    if "draft_custom_order" in raw:
        try:
            order = [int(x) for x in (raw["draft_custom_order"] or [])]
        except (TypeError, ValueError):
            order = None
        if order is None or len(set(order)) != len(order) or not set(order) <= team_ids:
            errors.append("Custom order has an unknown or repeated team.")
        else:
            plan["draft_custom_order"] = order
    if plan["draft_order_basis"] == "custom" and set(plan["draft_custom_order"]) != team_ids:
        errors.append("A custom order has to list every team once.")

    if "draft_compensation" in raw:
        comp = []
        for i, c in enumerate(raw["draft_compensation"] or []):
            try:
                tid, rnd = int(c.get("team_id")), int(c.get("round"))
            except (TypeError, ValueError, AttributeError):
                errors.append(f"Added pick {i + 1}: pick a team and a round.")
                continue
            placement = c.get("placement", "end")
            if tid not in team_ids:
                errors.append(f"Added pick {i + 1}: unknown team.")
            elif not 1 <= rnd <= 20:
                errors.append(f"Added pick {i + 1}: round must be 1 to 20.")
            elif placement not in PLACEMENTS:
                errors.append(f"Added pick {i + 1}: placement must be start or end of the round.")
            else:
                comp.append({"team_id": tid, "round": rnd, "placement": placement,
                             "note": str(c.get("note") or "").strip()[:40]})
        if len(comp) > MAX_COMP:
            errors.append(f"At most {MAX_COMP} added picks.")
        plan["draft_compensation"] = comp[:MAX_COMP]
    return plan, errors


def write_plan(cfg, plan):
    cfg.draft_order_basis = plan["draft_order_basis"]
    cfg.draft_style = plan["draft_style"]
    cfg.draft_custom_order = json.dumps(plan["draft_custom_order"]) if plan["draft_custom_order"] else None
    cfg.draft_compensation = json.dumps(plan["draft_compensation"]) if plan["draft_compensation"] else None


def base_order(league_id, year, plan):
    """Round-one order before traded or added picks."""
    if plan["draft_order_basis"] == "ladder":
        return ladder(league_id, year)
    teams = reverse_ladder(league_id, year)
    if plan["draft_order_basis"] == "custom" and plan["draft_custom_order"]:
        pos = {tid: i for i, tid in enumerate(plan["draft_custom_order"])}
        teams.sort(key=lambda t: pos.get(t.id, len(pos)))
    return teams


def build_slots(league_id, year, plan, total_rounds, offseason):
    """Every slot of a supplemental draft, in pick order.

    Each slot: {round, team_id (who uses it), original_team_id, label}.
    Traded picks and added (compensation) picks only apply to the off-season
    draft; the "<year> R<n>" picks are that draft's.
    """
    teams = base_order(league_id, year, plan)
    comp = plan["draft_compensation"] if offseason else []
    slots = []
    for rnd in range(1, total_rounds + 1):
        order = list(reversed(teams)) if plan["draft_style"] == "snake" and rnd % 2 == 0 else teams
        added = [c for c in comp if c["round"] == rnd]

        def extra(c):
            return {"round": rnd, "team_id": c["team_id"], "original_team_id": c["team_id"],
                    "label": c["note"] or "Added pick"}

        slots.extend(extra(c) for c in added if c["placement"] == "start")
        for t in order:
            owner = slot_owner(league_id, year, rnd, t.id) if offseason else t.id
            slots.append({"round": rnd, "team_id": owner, "original_team_id": t.id, "label": None})
        slots.extend(extra(c) for c in added if c["placement"] == "end")
    return slots


def plan_preview(league, plan, rounds=2):
    """The first rounds of this year's supplemental draft under ``plan``."""
    offseason = league.status == "offseason"
    names = {t.id: t.name for t in FantasyTeam.query.filter_by(league_id=league.id).all()}
    comp_rounds = [c["round"] for c in plan["draft_compensation"]] if offseason else []
    shown = max([rounds] + [r for r in comp_rounds if r <= 4])
    out = []
    for n, s in enumerate(build_slots(league.id, league.season_year, plan, shown, offseason), 1):
        out.append({
            "pick": n, "round": s["round"], "team": names.get(s["team_id"], "?"),
            "via": names.get(s["original_team_id"]) if s["original_team_id"] != s["team_id"] else None,
            "label": s["label"],
        })
    return out

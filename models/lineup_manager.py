"""Weekly lineup management: creation, validation, auto-fill, lockouts, emergencies."""

from models.database import (
    db, WeeklyLineup, LineupSlot, FantasyRoster, FantasyTeam,
    LeaguePositionSlot, AflPlayer, AflByeRound, LockoutConfig,
)


def get_or_create_lineup(team_id, afl_round, year):
    """Get an existing lineup or create a blank one for the given round."""
    lineup = WeeklyLineup.query.filter_by(
        team_id=team_id, afl_round=afl_round, year=year
    ).first()
    if not lineup:
        lineup = WeeklyLineup(team_id=team_id, afl_round=afl_round, year=year)
        db.session.add(lineup)
        db.session.commit()
    return lineup


def get_lineup_with_slots(team_id, afl_round, year):
    """Get the lineup with all slot details for display."""
    lineup = get_or_create_lineup(team_id, afl_round, year)
    slots = LineupSlot.query.filter_by(lineup_id=lineup.id).all()

    result = {
        "lineup_id": lineup.id,
        "is_locked": lineup.is_locked,
        "round": afl_round,
        "year": year,
        "slots": [],
    }

    for slot in slots:
        result["slots"].append({
            "id": slot.id,
            "player_id": slot.player_id,
            "player_name": slot.player.name if slot.player else None,
            "player_position": slot.player.position if slot.player else None,
            "player_afl_team": slot.player.afl_team if slot.player else None,
            "player_sc_avg": slot.player.sc_avg if slot.player else None,
            "position_code": slot.position_code,
            "is_captain": slot.is_captain,
            "is_vice_captain": slot.is_vice_captain,
            "is_emergency": slot.is_emergency,
        })

    return result


def set_lineup(team_id, afl_round, year, slot_data, league_id):
    """Set the weekly lineup from submitted slot data.
    slot_data: list of {"player_id": int, "position_code": str,
                         "is_captain": bool, "is_vice_captain": bool, "is_emergency": bool}
    Returns (lineup, None) on success or (None, error_msg) on failure.
    """
    lineup = get_or_create_lineup(team_id, afl_round, year)
    if lineup.is_locked:
        return None, "Lineup is locked for this round."

    # Validate against league position slots
    position_slots = LeaguePositionSlot.query.filter_by(league_id=league_id).all()
    pos_limits = {ps.position_code: ps.count for ps in position_slots if not ps.is_bench}

    # Count positions in new lineup (excluding bench/emergency)
    pos_counts = {}
    bench_counts = {}  # bench_type -> count
    for s in slot_data:
        if not s.get("is_emergency", False):
            code = s["position_code"]
            if code.startswith("BENCH_"):
                btype = code.replace("BENCH_", "")
                bench_counts[btype] = bench_counts.get(btype, 0) + 1
            elif code == "BENCH":
                bench_counts["FLEX"] = bench_counts.get("FLEX", 0) + 1
            else:
                pos_counts[code] = pos_counts.get(code, 0) + 1

    for pos, limit in pos_limits.items():
        if pos_counts.get(pos, 0) > limit:
            return None, f"Too many {pos} players: {pos_counts[pos]} (max {limit})"

    # Validate positional bench slot limits
    bench_limits = {ps.position_code: ps.count for ps in position_slots if ps.is_bench}
    total_bench = sum(bench_counts.values())
    total_bench_limit = sum(bench_limits.values()) if bench_limits else 5
    if total_bench > total_bench_limit:
        return None, f"Too many bench players: {total_bench} (max {total_bench_limit})"

    # Validate captain/VC
    captains = [s for s in slot_data if s.get("is_captain")]
    vcs = [s for s in slot_data if s.get("is_vice_captain")]
    if len(captains) > 1:
        return None, "Only one captain allowed."
    if len(vcs) > 1:
        return None, "Only one vice-captain allowed."

    # Verify all players are on the team's roster
    roster_player_ids = {
        r.player_id for r in
        FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    }
    for s in slot_data:
        if s["player_id"] not in roster_player_ids:
            return None, f"Player {s['player_id']} is not on your roster."

    # Rolling per-game lockout: locked players can't be moved from their current slot
    lockout_type = get_lockout_config(league_id)
    if lockout_type == "game_start":
        locked_ids = get_locked_player_ids_for_round(afl_round, year)
        if locked_ids:
            # Build current slot mapping for locked players
            old_slots = LineupSlot.query.filter_by(lineup_id=lineup.id).all()
            old_mapping = {s.player_id: s.position_code for s in old_slots}

            for s in slot_data:
                pid = s["player_id"]
                if pid in locked_ids and pid in old_mapping:
                    # Locked player must stay in the same position
                    if s["position_code"] != old_mapping[pid]:
                        player = AflPlayer.query.get(pid)
                        pname = player.name if player else f"ID {pid}"
                        return None, f"{pname} is locked (game started) and cannot be moved."

    # Clear old slots and set new ones
    LineupSlot.query.filter_by(lineup_id=lineup.id).delete()
    for s in slot_data:
        slot = LineupSlot(
            lineup_id=lineup.id,
            player_id=s["player_id"],
            position_code=s["position_code"],
            is_captain=s.get("is_captain", False),
            is_vice_captain=s.get("is_vice_captain", False),
            is_emergency=s.get("is_emergency", False),
            emergency_for=s.get("emergency_for"),
        )
        db.session.add(slot)

    db.session.commit()
    return lineup, None


def auto_fill_lineup(team_id, afl_round, year, league_id):
    """Auto-fill a lineup using the best available players from the roster.
    Uses a greedy position fill with bench cap based on league position config.
    """
    lineup = get_or_create_lineup(team_id, afl_round, year)
    if lineup.is_locked:
        return None, "Lineup is locked."

    # Get roster players
    roster_entries = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    players = [entry.player for entry in roster_entries]

    # Get bye players for this round
    bye_teams = get_bye_teams(afl_round, year)
    available = [p for p in players if p.afl_team not in bye_teams]
    on_bye = [p for p in players if p.afl_team in bye_teams]

    # Get position slots
    position_slots = LeaguePositionSlot.query.filter_by(league_id=league_id).all()
    on_field_slots = {ps.position_code: ps.count for ps in position_slots if not ps.is_bench}

    # Bucket players by position
    buckets = {}
    for pos in on_field_slots:
        buckets[pos] = []
    for p in available:
        positions = p.position.split("/") if p.position else ["MID"]
        for pos in positions:
            if pos in buckets:
                buckets[pos].append(p)

    # Sort each bucket by SC average desc
    for pos in buckets:
        buckets[pos].sort(key=lambda p: p.sc_avg or 0, reverse=True)

    # Fill positions (scarcest first: RUC → DEF → FWD → MID)
    fill_order = sorted(on_field_slots.keys(), key=lambda p: on_field_slots[p])
    selected = {}
    used = set()

    for pos in fill_order:
        selected[pos] = []
        needed = on_field_slots[pos]
        for p in buckets.get(pos, []):
            if p.id not in used and len(selected[pos]) < needed:
                selected[pos].append(p)
                used.add(p.id)

    # Build slot data
    slot_data = []
    all_on_field = []
    for pos, players_list in selected.items():
        for p in players_list:
            slot_data.append({
                "player_id": p.id,
                "position_code": pos,
                "is_captain": False,
                "is_vice_captain": False,
                "is_emergency": False,
            })
            all_on_field.append(p)

    # Bench: fill positional bench slots, then flex with remaining
    bench_slot_types = []
    for ps in position_slots:
        if ps.is_bench:
            bench_slot_types.extend([ps.position_code] * ps.count)
    if not bench_slot_types:
        bench_slot_types = ["DEF", "MID", "MID", "FWD", "FLEX"]

    remaining_for_bench = sorted(
        [p for p in available if p.id not in used] + on_bye,
        key=lambda p: p.sc_avg or 0, reverse=True,
    )
    bench_used = set()
    for bt in bench_slot_types:
        for p in remaining_for_bench:
            if p.id in used or p.id in bench_used:
                continue
            if bt == "FLEX":
                slot_data.append({
                    "player_id": p.id,
                    "position_code": "BENCH_FLEX",
                    "is_captain": False,
                    "is_vice_captain": False,
                    "is_emergency": False,
                })
                bench_used.add(p.id)
                break
            else:
                p_positions = (p.position or "MID").split("/")
                if bt in p_positions:
                    slot_data.append({
                        "player_id": p.id,
                        "position_code": f"BENCH_{bt}",
                        "is_captain": False,
                        "is_vice_captain": False,
                        "is_emergency": False,
                    })
                    bench_used.add(p.id)
                    break

    # Auto-captain: highest SC avg on field
    if all_on_field:
        all_on_field.sort(key=lambda p: p.sc_avg or 0, reverse=True)
        for s in slot_data:
            if s["player_id"] == all_on_field[0].id:
                s["is_captain"] = True
                break
        if len(all_on_field) > 1:
            for s in slot_data:
                if s["player_id"] == all_on_field[1].id:
                    s["is_vice_captain"] = True
                    break

    return set_lineup(team_id, afl_round, year, slot_data, league_id)


def lock_lineup(team_id, afl_round, year):
    """Lock a lineup so it can't be changed."""
    lineup = WeeklyLineup.query.filter_by(
        team_id=team_id, afl_round=afl_round, year=year
    ).first()
    if lineup:
        lineup.is_locked = True
        db.session.commit()
    return lineup


def apply_emergencies(lineup_id):
    """Check starting players for DNP and return a mapping of activated emergencies.
    Returns a dict {original_player_id: emergency_player_id} for each substitution.
    Does NOT mutate the lineup — scoring engine reads this to know which emergency scored.
    """
    from models.database import PlayerStat

    lineup = db.session.get(WeeklyLineup, lineup_id)
    if not lineup:
        return {}

    slots = LineupSlot.query.filter_by(lineup_id=lineup_id).all()
    emergency_slots = [s for s in slots if s.is_emergency and s.emergency_for]

    if not emergency_slots:
        return {}

    activated = {}
    for em_slot in emergency_slots:
        # Check if the player they cover actually played
        starter_stat = PlayerStat.query.filter_by(
            player_id=em_slot.emergency_for,
            year=lineup.year,
            round=lineup.afl_round,
        ).first()

        if starter_stat is None:
            # Starter DNP — check emergency player actually played
            em_stat = PlayerStat.query.filter_by(
                player_id=em_slot.player_id,
                year=lineup.year,
                round=lineup.afl_round,
            ).first()
            if em_stat is not None:
                activated[em_slot.emergency_for] = em_slot.player_id

    return activated


def carry_forward_lineup(team_id, afl_round, year, league_id):
    """Copy lineup from previous round to current round.

    If no previous round exists, falls back to auto_fill_lineup.
    Emergencies are NOT carried forward — they must be re-set each week.
    """
    prev_round = afl_round - 1
    if prev_round < 1:
        return auto_fill_lineup(team_id, afl_round, year, league_id)

    prev_lineup = WeeklyLineup.query.filter_by(
        team_id=team_id, afl_round=prev_round, year=year
    ).first()
    if not prev_lineup or not prev_lineup.slots:
        return auto_fill_lineup(team_id, afl_round, year, league_id)

    new_lineup = get_or_create_lineup(team_id, afl_round, year)
    if new_lineup.is_locked:
        return None, "Lineup is locked."

    # Clear existing slots
    LineupSlot.query.filter_by(lineup_id=new_lineup.id).delete()

    # Get current roster player IDs
    roster_ids = {
        r.player_id for r in
        FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    }

    for old_slot in prev_lineup.slots:
        if old_slot.player_id not in roster_ids:
            continue  # Player no longer on roster (traded/delisted)
        new_slot = LineupSlot(
            lineup_id=new_lineup.id,
            player_id=old_slot.player_id,
            position_code=old_slot.position_code,
            is_captain=old_slot.is_captain,
            is_vice_captain=old_slot.is_vice_captain,
            is_emergency=False,
        )
        db.session.add(new_slot)

    db.session.commit()
    return new_lineup, None


def get_bye_teams(afl_round, year):
    """Get the set of AFL teams on bye for a given round."""
    byes = AflByeRound.query.filter_by(afl_round=afl_round, year=year).all()
    return {b.afl_team for b in byes}


def get_bye_players(team_id, afl_round, year):
    """Get roster players who are on bye this round."""
    bye_teams = get_bye_teams(afl_round, year)
    if not bye_teams:
        return []
    roster = FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()
    return [r.player for r in roster if r.player.afl_team in bye_teams]


def get_lockout_config(league_id):
    """Get lockout configuration for a league."""
    config = LockoutConfig.query.filter_by(league_id=league_id).first()
    return config.lockout_type if config else "round_start"


def get_locked_player_ids_for_round(afl_round, year):
    """Return set of AflPlayer IDs whose AFL game has started (live or complete).

    Thin wrapper that imports from live_sync to avoid circular imports at module level.
    """
    from models.live_sync import get_locked_player_ids
    return get_locked_player_ids(afl_round, year)

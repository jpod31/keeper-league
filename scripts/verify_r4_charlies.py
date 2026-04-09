"""Verify R4 Charlies Demons scoring is correct."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app
app = create_app()

with app.app_context():
    from models.database import db, RoundScore, AflPlayer, PlayerStat, WeeklyLineup, LineupSlot

    team_id = 5
    rnd = 4
    year = 2026

    rs = RoundScore.query.filter_by(team_id=team_id, afl_round=rnd, year=year).first()
    bd = json.loads(rs.breakdown) if isinstance(rs.breakdown, str) else rs.breakdown

    lineup = WeeklyLineup.query.filter_by(team_id=team_id, afl_round=rnd, year=year).first()
    slots = LineupSlot.query.filter_by(lineup_id=lineup.id).all()

    field_slots = [s for s in slots if not s.is_emergency and (s.position_code or "").upper() in ("DEF","MID","FWD","RUC","FLEX")]
    emg_slots = [s for s in slots if s.is_emergency]

    print(f"=== CHARLIES R4 VERIFICATION ===")
    print(f"Field players: {len(field_slots)}")
    print(f"Emergencies: {len(emg_slots)}")
    print(f"Stored total: {rs.total_score}")
    print()

    # List all field players with scores
    field_total = 0
    dnp_list = []
    scored_list = []
    for s in field_slots:
        p = db.session.get(AflPlayer, s.player_id)
        stat = PlayerStat.query.filter_by(player_id=s.player_id, year=year, round=rnd).first()
        sc = stat.supercoach_score if stat else None
        if sc is None or sc == 0:
            dnp_list.append((p, s))
        else:
            scored_list.append((p, s, sc))
            field_total += sc

    print(f"--- SCORED ({len(scored_list)} players) ---")
    for p, s, sc in sorted(scored_list, key=lambda x: -x[2]):
        cap = " (C)" if s.is_captain else " (VC)" if s.is_vice_captain else ""
        print(f"  {sc:4d}  {p.name:25s} {s.position_code:5s} {p.position:10s}{cap}")

    print(f"\n--- DNP ({len(dnp_list)} players) ---")
    for p, s in dnp_list:
        stat = PlayerStat.query.filter_by(player_id=p.id, year=year, round=rnd).first()
        print(f"    0  {p.name:25s} {s.position_code:5s} {p.position:10s}  stat={'SC='+str(stat.supercoach_score) if stat else 'NONE'}")

    print(f"\n--- EMERGENCIES ---")
    emg_total = 0
    for s in emg_slots:
        p = db.session.get(AflPlayer, s.player_id)
        stat = PlayerStat.query.filter_by(player_id=p.id, year=year, round=rnd).first()
        sc = stat.supercoach_score if stat else 0
        # Check if this emergency was used (in breakdown)
        used = f"emergency_{s.player_id}" in bd
        can_sub_mid = "MID" in (p.position or "").split("/")
        can_sub_def = "DEF" in (p.position or "").split("/")
        can_sub_fwd = "FWD" in (p.position or "").split("/")
        can_sub_ruc = "RUC" in (p.position or "").split("/")
        covers = "/".join([x for x in [("MID" if can_sub_mid else ""), ("DEF" if can_sub_def else ""), ("FWD" if can_sub_fwd else ""), ("RUC" if can_sub_ruc else "")] if x])
        status = "USED" if used else "UNUSED"
        if used:
            emg_total += sc
        print(f"  {sc:4d}  {p.name:25s} {p.position:10s} covers={covers:10s} [{status}]")

    # DNP positions needed
    dnp_positions = [s.position_code for _, s in dnp_list]
    print(f"\n--- ANALYSIS ---")
    print(f"DNP positions needing subs: {dnp_positions}")
    print(f"Field scored: {field_total}")
    print(f"Emergency subs: {emg_total}")
    print(f"Captain bonus: {rs.captain_bonus}")
    print(f"Calculated total: {field_total + emg_total + rs.captain_bonus}")
    print(f"Stored total: {rs.total_score}")
    print(f"Match: {'YES' if field_total + emg_total + rs.captain_bonus == rs.total_score else 'NO - MISMATCH!'}")

    # Check optimal sub assignment
    print(f"\n--- OPTIMAL SUB CHECK ---")
    unused_emgs = [(db.session.get(AflPlayer, s.player_id), PlayerStat.query.filter_by(player_id=s.player_id, year=year, round=rnd).first()) for s in emg_slots if f"emergency_{s.player_id}" not in bd]
    for p, stat in unused_emgs:
        sc = stat.supercoach_score if stat else 0
        could_fill = []
        for dnp_p, dnp_s in dnp_list:
            if dnp_s.position_code in (p.position or "").split("/") or dnp_s.position_code == "FLEX":
                could_fill.append(dnp_s.position_code)
        if could_fill:
            print(f"  WARNING: {p.name} ({p.position}, SC={sc}) could fill {could_fill} but was NOT used!")
        else:
            print(f"  OK: {p.name} ({p.position}, SC={sc}) cannot fill any DNP slot ({dnp_positions})")

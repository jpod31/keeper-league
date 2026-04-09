"""Investigate CDT/Xerri emergency sub issue."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
app = create_app()

with app.app_context():
    from models.database import db, AflPlayer, FantasyRoster, WeeklyLineup, LineupSlot, PlayerStat, RoundScore
    from models.scoring_engine import _positions_compatible
    import json

    # Find players
    cdt = AflPlayer.query.filter(AflPlayer.name.ilike("%duff%tytler%")).first()
    xerri = AflPlayer.query.filter(AflPlayer.name.ilike("%xerri%")).first()
    print(f"CDT: id={cdt.id}, name={cdt.name}, pos={cdt.position}, team={cdt.afl_team}" if cdt else "CDT not found")
    print(f"Xerri: id={xerri.id}, name={xerri.name}, pos={xerri.position}, team={xerri.afl_team}" if xerri else "Xerri not found")

    # R4 scores
    for p in [cdt, xerri]:
        if p:
            stat = PlayerStat.query.filter_by(player_id=p.id, year=2026, round=4).first()
            print(f"  {p.name} R4 SC: {stat.supercoach_score if stat else 'NO STAT'}")

    # Lamb team = 9
    team_id = 9
    for p in [cdt, xerri]:
        if p:
            r = FantasyRoster.query.filter_by(team_id=team_id, player_id=p.id, is_active=True).first()
            if r:
                print(f"\nRoster {p.name}: benched={r.is_benched}, emg={r.is_emergency}, pos_code={r.position_code}")

    # R4 lineup snapshot
    lineup = WeeklyLineup.query.filter_by(team_id=team_id, afl_round=4, year=2026).first()
    if lineup:
        slots = LineupSlot.query.filter_by(lineup_id=lineup.id).all()
        print(f"\nR4 Lineup: {len(slots)} slots, is_locked={lineup.is_locked}")

        xerri_slot = None
        cdt_slot = None
        for s in slots:
            if cdt and s.player_id == cdt.id:
                cdt_slot = s
                print(f"  CDT slot: pos={s.position_code}, emg={s.is_emergency}")
            if xerri and s.player_id == xerri.id:
                xerri_slot = s
                print(f"  Xerri slot: pos={s.position_code}, emg={s.is_emergency}")

        # Test positional compatibility
        if xerri_slot and cdt_slot:
            compat = _positions_compatible(xerri_slot, cdt_slot)
            print(f"\n  _positions_compatible(xerri_slot, cdt_slot) = {compat}")

        # Also test the other way
        if cdt_slot and xerri_slot:
            compat2 = _positions_compatible(cdt_slot, xerri_slot)
            print(f"  _positions_compatible(cdt_slot, xerri_slot) = {compat2}")

        # Show all emergencies and their positions
        print("\nAll emergencies in R4 lineup:")
        for s in slots:
            if s.is_emergency:
                p = db.session.get(AflPlayer, s.player_id)
                stat = PlayerStat.query.filter_by(player_id=p.id, year=2026, round=4).first()
                print(f"  {p.name:25s} pos={p.position:10s} slot_pos={s.position_code}  SC={stat.supercoach_score if stat else 'N/A'}")

        # Show all DNPs (field players with score 0 or no stat)
        print("\nField players with 0/no score:")
        field_slots = [s for s in slots if not s.is_emergency and (s.position_code or "").upper() in ("DEF","MID","FWD","RUC","FLEX")]
        for s in field_slots:
            stat = PlayerStat.query.filter_by(player_id=s.player_id, year=2026, round=4).first()
            sc = stat.supercoach_score if stat else None
            if sc is None or sc == 0:
                p = db.session.get(AflPlayer, s.player_id)
                print(f"  {p.name:25s} pos={p.position:10s} slot_pos={s.position_code}  SC={sc}")

    # Show the R4 breakdown
    rs = RoundScore.query.filter_by(team_id=team_id, afl_round=4, year=2026).first()
    if rs and rs.breakdown:
        bd = json.loads(rs.breakdown) if isinstance(rs.breakdown, str) else rs.breakdown
        print(f"\nR4 Breakdown (total={rs.total_score}):")
        emg_keys = [k for k in bd if "emergency" in str(k)]
        print(f"  Emergency subs used: {emg_keys}")
        for k in emg_keys:
            print(f"    {k} = {bd[k]}")

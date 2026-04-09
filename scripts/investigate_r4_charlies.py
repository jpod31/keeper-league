"""Investigate R4 Nadia vs Charlies — check scores, subs, and Daicos/Blamires."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app
app = create_app()

with app.app_context():
    from models.database import db, Fixture, RoundScore, AflPlayer, PlayerStat, WeeklyLineup, LineupSlot

    # R4 fixture
    fx = Fixture.query.filter_by(league_id=3, afl_round=4, year=2026, home_team_id=7).first()
    if not fx:
        fx = Fixture.query.filter_by(league_id=3, afl_round=4, year=2026, away_team_id=7).first()
    print(f"Fixture: {fx.home_team.name} {fx.home_score:.0f} vs {fx.away_team.name} {fx.away_score:.0f} (status={fx.status})")

    # Round scores
    for tid, name in [(7, "Nadias"), (5, "Charlies")]:
        rs = RoundScore.query.filter_by(team_id=tid, afl_round=4, year=2026).first()
        print(f"\n{name}: total={rs.total_score}, cap_bonus={rs.captain_bonus}")
        bd = json.loads(rs.breakdown) if isinstance(rs.breakdown, str) else rs.breakdown

        # Show all entries
        total_check = 0
        for pid_str, val in sorted(bd.items(), key=lambda x: -(x[1] if isinstance(x[1], (int,float)) else 0)):
            if isinstance(val, (int, float)):
                p = None
                if "emergency" in pid_str:
                    actual_pid = pid_str.replace("emergency_", "")
                    p = db.session.get(AflPlayer, int(actual_pid))
                    print(f"  EMG  {val:4.0f}  {p.name if p else pid_str} (subbed on)")
                else:
                    p = db.session.get(AflPlayer, int(pid_str))
                    label = ""
                    if val == 0:
                        # Check if DNP
                        stat = PlayerStat.query.filter_by(player_id=int(pid_str), year=2026, round=4).first()
                        label = " DNP" if (stat is None or stat.supercoach_score == 0) else ""
                    print(f"  FLD  {val:4.0f}  {p.name if p else pid_str}{label}")
                total_check += val
        print(f"  Sum: {total_check} + cap_bonus {rs.captain_bonus} = {total_check + rs.captain_bonus}")

    # Check Daicos and Blamires specifically
    print("\n=== DAICOS / BLAMIRES ===")
    daicos = AflPlayer.query.filter_by(name="Nick Daicos").first()
    blamires = AflPlayer.query.filter_by(name="Tom Blamires").first()

    for p in [daicos, blamires]:
        stat = PlayerStat.query.filter_by(player_id=p.id, year=2026, round=4).first()
        print(f"{p.name}: pos={p.position}, SC={stat.supercoach_score if stat else 'NONE'}")

    # Check Charlies R4 lineup for emergencies and their positions
    lineup = WeeklyLineup.query.filter_by(team_id=5, afl_round=4, year=2026).first()
    if lineup:
        slots = LineupSlot.query.filter_by(lineup_id=lineup.id).all()

        # Find Daicos slot
        daicos_slot = next((s for s in slots if s.player_id == daicos.id), None)
        blamires_slot = next((s for s in slots if s.player_id == blamires.id), None)

        if daicos_slot:
            print(f"\nDaicos slot: pos={daicos_slot.position_code}, emg={daicos_slot.is_emergency}")
        if blamires_slot:
            print(f"Blamires slot: pos={blamires_slot.position_code}, emg={blamires_slot.is_emergency}")

        # Show all DNP field players and all emergencies
        print("\nField DNPs:")
        field = [s for s in slots if not s.is_emergency and (s.position_code or "").upper() in ("DEF","MID","FWD","RUC","FLEX")]
        for s in field:
            stat = PlayerStat.query.filter_by(player_id=s.player_id, year=2026, round=4).first()
            sc = stat.supercoach_score if stat else None
            if sc is None or sc == 0:
                p = db.session.get(AflPlayer, s.player_id)
                print(f"  {p.name:25s} slot={s.position_code:5s} pos={p.position:10s} SC={sc}")

        print("\nEmergencies:")
        for s in slots:
            if s.is_emergency:
                p = db.session.get(AflPlayer, s.player_id)
                stat = PlayerStat.query.filter_by(player_id=p.id, year=2026, round=4).first()
                print(f"  {p.name:25s} pos={p.position:10s} SC={stat.supercoach_score if stat else 'NONE'}")

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app
app = create_app()
with app.app_context():
    from models.database import AflPlayer, PlayerStat
    from models.profile_tags import compute_profile_tags

    name = sys.argv[1] if len(sys.argv) > 1 else "Tom Green"
    p = AflPlayer.query.filter(AflPlayer.name.ilike(f"%{name}%")).first()
    if not p:
        print(f"Not found: {name}")
        sys.exit(1)

    print(f"Name: {p.name}, Team: {p.afl_team}, Pos: {p.position}")
    print(f"Age: {p.age}, SC avg: {p.sc_avg}, SC prev: {p.sc_avg_prev}, Games: {p.games_played}")

    stats = PlayerStat.query.filter_by(player_id=p.id, year=2026).order_by(PlayerStat.round).all()
    print(f"\n2026 stats: {len(stats)} rounds")
    for s in stats:
        print(f"  R{s.round}: SC={s.supercoach_score}")

    # Need ALL players for percentile calculation
    all_players = AflPlayer.query.all()
    tags = compute_profile_tags(all_players)
    t = tags.get(p.id, {})
    print(f"\nTag: {t.get('tag')}")
    print(f"Headline: {t.get('headline')}")
    print(f"Detail: {t.get('detail')}")
    print(f"Global pct: {t.get('global_pct')}")
    print(f"Pos pct: {t.get('pos_pct')}")
    print(f"Eff pos pct: {t.get('eff_pos_pct')}")
    print(f"Scarcity: {t.get('scarcity')}")
    print(f"Trajectory: {t.get('trajectory')}/yr")
    print(f"Consistency: {t.get('consistency')}")
    print(f"Durability: {t.get('durability')} games/yr")
    print(f"Peak: {t.get('peak_avg')} ({t.get('peak_year')})")
    print(f"Years premium (90+): {t.get('years_premium')}")
    print(f"Years elite (105+): {t.get('years_elite')}")
    print(f"Peak phase: {t.get('peak_phase')}")
    print(f"Composite: {t.get('composite')}")

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app
app = create_app()
with app.app_context():
    from blueprints.leagues import _compute_rolling_averages
    rolling = _compute_rolling_averages()
    for name in ["Nick Daicos", "Marcus Bontempelli", "Patrick Cripps", "Isaac Heeney", "Connor MacDonald"]:
        r = rolling.get(name, {})
        print(f"{name:25s}  l3={r.get('l3')}, l5={r.get('l5')}")
    has_l3 = sum(1 for v in rolling.values() if v.get("l3"))
    has_l5 = sum(1 for v in rolling.values() if v.get("l5"))
    print(f"\nTotal with L3: {has_l3} / {len(rolling)}")
    print(f"Total with L5: {has_l5} / {len(rolling)}")

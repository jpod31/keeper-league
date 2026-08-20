"""Force a ratings sync so player ages are pulled from the ratings XLSX.

The normal sync short-circuits when the DB looks fresher than the spreadsheet,
which is always true here — so ages that the sync used to ignore never landed.
Run once after deploying the age fix; the scheduled sync keeps them current
from then on.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, _sync_ratings_to_db
from models.database import AflPlayer

with app.app_context():
    before = {p.id: p.age for p in AflPlayer.query.all()}

_sync_ratings_to_db(app, force=True)

with app.app_context():
    changed = []
    for p in AflPlayer.query.all():
        old = before.get(p.id)
        if old != p.age:
            changed.append((p.name, old, p.age))
    changed.sort(key=lambda r: r[0])
    print(f"{len(changed)} ages changed")
    for name, old, new in changed:
        print(f"  {name}: {old} -> {new}")

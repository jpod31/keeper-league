"""Draftees missing from our records are put back by weight: a held row
stands for every pick of its band and outcome."""

from models import pre_afl
from models.database import DraftHistory


def test_weights_put_back_the_missing(db):
    # picks 41 on: 4 who never played (we hold 1), 2 who did (we hold both)
    for i, (g1, held) in enumerate([(0, True), (0, False), (0, False), (0, False), (12, True), (15, True)]):
        db.session.add(DraftHistory(year=2020, kind="national", pick=45 + i, name=f"P{i}", g1=g1, player_id=None))
        if held:
            db.session.flush()
    db.session.commit()
    # mark the held ones
    rows = DraftHistory.query.order_by(DraftHistory.pick).all()
    for r, held in zip(rows, [True, False, False, False, True, True]):
        r.player_id = 1 if held else None
    db.session.commit()
    ten = lambda r: r["g1"] >= 10
    w = pre_afl._weights([{"kind": "National", "pick": 50, "g1": 0}, {"kind": "National", "pick": 50, "g1": 12},
                          {"kind": "National", "pick": 3, "g1": 0}, {"kind": "Pre-Season", "pick": 1, "g1": 0}], ten)
    assert w == [4.0, 1.0, 1.0, 1.0]


def test_bands():
    assert pre_afl._band("Rookie", 3) == "rookie"
    assert pre_afl._band(None, 12) == "11-20"
    assert pre_afl._band("Mid-Season", 2) is None

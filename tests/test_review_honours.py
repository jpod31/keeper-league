"""The season review's Honours slide data: winners and records from that year."""

from models import season_review


def test_honours_block_keeps_the_years_records(monkeypatch):
    monkeypatch.setattr("models.player_honours.board", lambda _lg: {"seasons": [{"year": 2026, "flag": {"team": "A", "players": [1, 2]},
        "honours": {"keepermedal": [{"name": "X", "team": "A", "detail": "18 votes"}], "champion": [], "allleague": [1] * 23}}]})
    monkeypatch.setattr("models.record_book.build", lambda _lg: {"clubs": [
        {"key": "high", "label": "Highest club score", "unit": "", "top": {"value": 2378, "team": "A", "year": 2026}},
        {"key": "low", "label": "Lowest club score", "unit": "", "top": {"value": 1410, "team": "B", "year": 2025}}], "players": [], "matches": []})
    h = season_review._honours(1, 2026)
    assert h["medal"] == [{"name": "X", "team": "A", "detail": "18 votes"}]
    assert h["counts"]["flag"] == 2 and h["counts"]["allleague"] == 23
    assert [r["label"] for r in h["records"]] == ["Highest club score"]

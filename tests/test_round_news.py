"""Post-round news: the first run only records what exists; later runs post
one grouped line per badge."""

from models import round_news
from models.round_news import post_round_news, _honour_lines
from models.database import ActivityFeedEntry


def test_many_milestones_are_one_line():
    hs = [{"kind": "clubgames", "step": 50, "player_id": i, "team_id": 1, "year": 2027} for i in range(15)]
    lines = _honour_lines(hs, {1: "jpod31"}, {})
    assert len(lines) == 1 and lines[0][0] == "15 players reached 50 club games this round"
    assert lines[0][1].endswith("and 3 more.")


def test_first_run_records_then_new_honours_post(db, seed_data, monkeypatch):
    lg = seed_data["league"]
    p = list(seed_data["players"].values())[0]
    honours = {"by_player": {p.id: [{"kind": "siren", "player_id": p.id, "team_id": seed_data["team_a"].id, "year": 2026, "round": 3, "detail": "Round 3"}]},
               "points": {}, "club_games": {}, "seasons": {}, "teams": {}}
    monkeypatch.setattr("models.player_honours.league_honours", lambda _lg: honours)
    monkeypatch.setattr(round_news, "_record_lines", lambda *_a: ([], {}))
    assert post_round_news(lg.id) == []                       # first run: recorded, not posted
    honours["by_player"][p.id].append({"kind": "clubgames", "step": 50, "player_id": p.id, "team_id": seed_data["team_a"].id, "value": 50})
    lines = post_round_news(lg.id)
    assert [t for t, _b in lines] == [f"{p.name} reached 50 club games for {seed_data['team_a'].name}"]
    assert ActivityFeedEntry.query.filter_by(league_id=lg.id, type="honours").count() == 1
    assert post_round_news(lg.id) == []                       # nothing twice


def test_a_broken_record_is_announced(monkeypatch):
    book = {"clubs": [{"key": "high", "label": "Highest club score", "unit": "", "top": {"value": 2401, "team": "jpod31"}},
                      {"key": "low", "label": "Lowest club score", "unit": "", "top": {"value": 1500, "team": "Lamb of North Cult"}}],
            "players": [], "matches": []}
    monkeypatch.setattr("models.record_book.build", lambda _lg: book)
    lines, store = round_news._record_lines(1, {"r:high": 2378.0, "r:low": 1410.0}, False)
    assert lines == [("New record, highest club score: jpod31, 2,401", "The old record was 2,378.")]
    assert store == {"r:high": 2401.0, "r:low": 1500.0}

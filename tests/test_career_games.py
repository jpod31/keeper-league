"""Career games = draftguru games for past seasons + this season's games."""

from models.database import AflListHistory, PlayerStat
from models.career_games import refresh


def test_career_games_add_this_season(db, seed_data):
    p = list(seed_data["players"].values())[0]
    p.career_games = 43   # through 2025, before the season it now adds
    for season, g in ((2024, 22), (2025, 21), (2026, 11)):
        db.session.add(AflListHistory(player_id=p.id, player_name=p.name, season=season, club="Collingwood", games=g, source="draftguru"))
    for r in range(24):   # our feed has 24 games this season; the scrape said 11
        db.session.add(PlayerStat(player_id=p.id, year=2026, round=r, supercoach_score=80))
    db.session.commit()
    refresh(2026)
    assert p.career_games == 22 + 21 + 24

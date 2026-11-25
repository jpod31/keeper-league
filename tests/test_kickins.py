"""Kick-in share counts only the games a player played."""

from scrapers.kickin_scraper import team_shares


def test_share_is_of_the_games_he_played():
    rows = [
        # Plays games 0 and 1, takes every kick-in in game 0 and half of game 1.
        {"playerName": "A", "KI": "8", "PO": "6", "KI_G0": "5", "KI_G1": "3", "KI_G2": None},
        # Plays games 1 and 2, takes the rest.
        {"playerName": "B", "KI": "7", "PO": "7", "KI_G0": None, "KI_G1": "3", "KI_G2": "4"},
        # Plays all three, takes none.
        {"playerName": "C", "KI": "0", "PO": "0", "KI_G0": "0", "KI_G1": "0", "KI_G2": "0"},
    ]
    s = team_shares(rows, 3)
    assert s["A"] == {"ki": 8, "po": 6, "team_ki": 11}     # 5 + 6
    assert s["B"] == {"ki": 7, "po": 7, "team_ki": 10}     # 6 + 4
    assert s["C"]["team_ki"] == 15 and s["C"]["ki"] == 0

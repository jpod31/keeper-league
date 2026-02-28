"""Squiggle API client for AFL game schedules and statuses.

Docs: https://api.squiggle.com.au/
Requires User-Agent header per Squiggle policy.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import requests

logger = logging.getLogger(__name__)

SQUIGGLE_BASE = "https://api.squiggle.com.au/"
HEADERS = {"User-Agent": "KeeperLeague/1.0 (fantasy-league-app)"}

# Squiggle team names → our canonical names (from config.TEAM_SLUGS keys)
_SQUIGGLE_TEAM_MAP = {
    "Adelaide": "Adelaide",
    "Brisbane Lions": "Brisbane Lions",
    "Brisbane": "Brisbane Lions",
    "Carlton": "Carlton",
    "Collingwood": "Collingwood",
    "Essendon": "Essendon",
    "Fremantle": "Fremantle",
    "Geelong": "Geelong",
    "Gold Coast": "Gold Coast",
    "Greater Western Sydney": "GWS",
    "GWS": "GWS",
    "Hawthorn": "Hawthorn",
    "Melbourne": "Melbourne",
    "North Melbourne": "North Melbourne",
    "Port Adelaide": "Port Adelaide",
    "Richmond": "Richmond",
    "St Kilda": "St Kilda",
    "Sydney": "Sydney",
    "West Coast": "West Coast",
    "Western Bulldogs": "Western Bulldogs",
}


def normalise_team_name(squiggle_name: str) -> str:
    """Map a Squiggle team name to our canonical team name."""
    return _SQUIGGLE_TEAM_MAP.get(squiggle_name, squiggle_name)


def get_games(year: int, afl_round: int) -> list[dict]:
    """Fetch game list for a round from Squiggle.

    Returns list of game dicts with keys:
        id, hteam, ateam, date, venue, is_live, complete, hscore, ascore, etc.
    """
    try:
        resp = requests.get(
            SQUIGGLE_BASE,
            params={"q": "games", "year": year, "round": afl_round},
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("games", [])
    except requests.RequestException as e:
        logger.error("Squiggle get_games failed (year=%d, round=%d): %s", year, afl_round, e)
        return []


def get_game(game_id: int) -> Optional[dict]:
    """Fetch a single game by its Squiggle ID."""
    try:
        resp = requests.get(
            SQUIGGLE_BASE,
            params={"q": "games", "game": game_id},
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        games = resp.json().get("games", [])
        return games[0] if games else None
    except requests.RequestException as e:
        logger.error("Squiggle get_game failed (id=%d): %s", game_id, e)
        return None


def parse_game_status(game: dict) -> str:
    """Derive our status string from Squiggle game fields.

    Returns: 'scheduled', 'live', or 'complete'.
    """
    if game.get("complete") == 100:
        return "complete"
    if game.get("is_live"):
        return "live"
    return "scheduled"


def parse_scheduled_start(game: dict) -> Optional[datetime]:
    """Parse the 'date' field from Squiggle into a UTC datetime.

    Squiggle returns local Melbourne time (AEST/AEDT).  We parse as-is
    and store as UTC-naive for simplicity (all times Melbourne-relative).
    """
    date_str = game.get("date")
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        # Try common format: "2026-03-13 19:40:00"
        try:
            return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            return None


def get_current_round(year: int) -> Optional[int]:
    """Determine the current AFL round from Squiggle.

    Finds the first round that has live or upcoming games.
    Falls back to the last round with completed games.
    """
    try:
        resp = requests.get(
            SQUIGGLE_BASE,
            params={"q": "games", "year": year},
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        games = resp.json().get("games", [])
    except requests.RequestException as e:
        logger.error("Squiggle get_current_round failed: %s", e)
        return None

    if not games:
        return None

    # Group by round
    rounds: dict[int, list[dict]] = {}
    for g in games:
        rnd = g.get("round")
        if rnd is not None:
            rounds.setdefault(rnd, []).append(g)

    # Find first round with any live game
    for rnd in sorted(rounds.keys()):
        if any(g.get("is_live") for g in rounds[rnd]):
            return rnd

    # Find first round with any scheduled (not complete) game
    for rnd in sorted(rounds.keys()):
        if any(g.get("complete", 0) != 100 for g in rounds[rnd]):
            return rnd

    # All rounds complete — return the last one
    return max(rounds.keys()) if rounds else None

"""Scrape the AFL official injury list and sync to the database."""

from __future__ import annotations

import logging
import re

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_INJURY_URL = "https://www.afl.com.au/matches/injury-list"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

# AFL site team names → canonical DB team names
_AFL_TEAM_MAP = {
    "Adelaide Crows": "Adelaide",
    "Adelaide": "Adelaide",
    "Brisbane Lions": "Brisbane Lions",
    "Brisbane": "Brisbane Lions",
    "Carlton Blues": "Carlton",
    "Carlton": "Carlton",
    "Collingwood Magpies": "Collingwood",
    "Collingwood": "Collingwood",
    "Essendon Bombers": "Essendon",
    "Essendon": "Essendon",
    "Fremantle Dockers": "Fremantle",
    "Fremantle": "Fremantle",
    "Geelong Cats": "Geelong",
    "Geelong": "Geelong",
    "Gold Coast Suns": "Gold Coast",
    "Gold Coast SUNS": "Gold Coast",
    "Gold Coast": "Gold Coast",
    "GWS Giants": "GWS",
    "GWS GIANTS": "GWS",
    "GWS": "GWS",
    "Greater Western Sydney": "GWS",
    "Hawthorn Hawks": "Hawthorn",
    "Hawthorn": "Hawthorn",
    "Melbourne Demons": "Melbourne",
    "Melbourne": "Melbourne",
    "North Melbourne Kangaroos": "North Melbourne",
    "North Melbourne": "North Melbourne",
    "Port Adelaide Power": "Port Adelaide",
    "Port Adelaide": "Port Adelaide",
    "Richmond Tigers": "Richmond",
    "Richmond": "Richmond",
    "St Kilda Saints": "St Kilda",
    "St Kilda": "St Kilda",
    "Sydney Swans": "Sydney",
    "Sydney": "Sydney",
    "West Coast Eagles": "West Coast",
    "West Coast": "West Coast",
    "Western Bulldogs": "Western Bulldogs",
}


def classify_severity(return_text: str) -> str:
    """Map an estimated-return string to 'test', 'short', or 'long'.

    - "test"  — return text is exactly "Test"
    - "short" — "1 week", "1-2 weeks", or a specific next-round target
    - "long"  — everything else (2+ weeks, Season, TBC, Indefinite, etc.)
    """
    if not return_text:
        return "long"

    text = return_text.strip()
    lower = text.lower()

    if lower == "test":
        return "test"

    # "1 week" or "1-2 weeks" → short
    if re.match(r"^1\s*(-\s*2)?\s*weeks?$", lower):
        return "short"

    # "Round X" where X is the next round → treat as short
    # (single round target is short-term)
    if re.match(r"^round\s+\d+$", lower):
        return "short"

    return "long"


def scrape_injury_list() -> list[dict]:
    """Fetch the AFL injury list page, return a list of injury dicts.

    Each dict: {"name": str, "team": str, "injury": str, "return_text": str}
    """
    resp = requests.get(_INJURY_URL, headers=_HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    injuries = []
    current_team = None

    # The page uses team sections — look for headings followed by tables/rows
    # Try multiple selector strategies for robustness

    # Strategy 1: Look for table-based layout with team headings
    for section in soup.select("[class*='injury'], [class*='Injury']"):
        # Try to find team headings and tables within sections
        headings = section.find_all(["h2", "h3", "h4", "h5"])
        tables = section.find_all("table")
        if headings and tables:
            for heading, table in zip(headings, tables):
                team_raw = heading.get_text(strip=True)
                team = _AFL_TEAM_MAP.get(team_raw, team_raw)
                for row in table.find_all("tr")[1:]:  # skip header
                    cells = row.find_all(["td", "th"])
                    if len(cells) >= 3:
                        injuries.append({
                            "name": cells[0].get_text(strip=True),
                            "team": team,
                            "injury": cells[1].get_text(strip=True),
                            "return_text": cells[2].get_text(strip=True),
                        })
            if injuries:
                return injuries

    # Strategy 2: Walk all headings and sibling tables
    for heading in soup.find_all(["h2", "h3", "h4", "h5"]):
        team_raw = heading.get_text(strip=True)
        canonical = _AFL_TEAM_MAP.get(team_raw)
        if not canonical:
            continue
        current_team = canonical

        # Find the next table sibling
        table = heading.find_next("table")
        if not table:
            continue

        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 3:
                name = cells[0].get_text(strip=True)
                # Skip header rows
                if name.upper() in ("PLAYER", "NAME", ""):
                    continue
                injuries.append({
                    "name": name,
                    "team": current_team,
                    "injury": cells[1].get_text(strip=True),
                    "return_text": cells[2].get_text(strip=True),
                })

    if injuries:
        return injuries

    # Strategy 3: Generic — find all tables with 3+ columns
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        # Check if a preceding heading gives us a team name
        prev = table.find_previous(["h2", "h3", "h4", "h5"])
        team_raw = prev.get_text(strip=True) if prev else ""
        team = _AFL_TEAM_MAP.get(team_raw, "")

        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) >= 3:
                name = cells[0].get_text(strip=True)
                if name.upper() in ("PLAYER", "NAME", ""):
                    continue
                if team:
                    injuries.append({
                        "name": name,
                        "team": team,
                        "injury": cells[1].get_text(strip=True),
                        "return_text": cells[2].get_text(strip=True),
                    })

    logger.info("Scraped %d injuries from AFL injury list", len(injuries))
    return injuries


def _normalize_name(name: str) -> str:
    """Normalize player name for matching: strip whitespace, titlecase."""
    return " ".join(name.strip().split())


def sync_injuries_to_db() -> int:
    """Full refresh: clear all injury fields, scrape, match & update.

    Returns the count of players updated with injury info.
    """
    from models.database import db, AflPlayer

    # 1. Clear all existing injury data
    AflPlayer.query.update({
        AflPlayer.injury_type: None,
        AflPlayer.injury_return: None,
        AflPlayer.injury_severity: None,
    })
    db.session.flush()

    # 2. Scrape
    injury_list = scrape_injury_list()
    if not injury_list:
        db.session.commit()
        logger.info("Injury sync: no injuries found (page may have changed)")
        return 0

    # 3. Match and update
    count = 0
    for entry in injury_list:
        name = _normalize_name(entry["name"])
        team = entry["team"]

        # Primary: exact name + team match
        player = AflPlayer.query.filter_by(name=name, afl_team=team).first()

        # Fallback: surname-only match within the team
        if not player and " " in name:
            surname = name.split()[-1]
            candidates = AflPlayer.query.filter(
                AflPlayer.afl_team == team,
                AflPlayer.name.ilike(f"% {surname}"),
            ).all()
            if len(candidates) == 1:
                player = candidates[0]

        if not player:
            logger.warning("Injury sync: unmatched player %r (%s)", name, team)
            continue

        player.injury_type = entry["injury"]
        player.injury_return = entry["return_text"]
        player.injury_severity = classify_severity(entry["return_text"])
        count += 1

    db.session.commit()
    logger.info("Injury sync: %d players updated", count)
    return count

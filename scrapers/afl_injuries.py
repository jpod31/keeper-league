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


def _parse_weeks(return_text: str) -> int | None:
    """Extract the maximum number of weeks from a return estimate, or None."""
    lower = return_text.strip().lower()

    # "X-Y weeks" → Y
    m = re.match(r"^(\d+)\s*-\s*(\d+)\s+weeks?$", lower)
    if m:
        return int(m.group(2))

    # "X-plus weeks" → X (minimum, treat as that many)
    m = re.match(r"^(\d+)-?plus\s+weeks?$", lower)
    if m:
        return int(m.group(1))

    # "X weeks"
    m = re.match(r"^(\d+)\s+weeks?$", lower)
    if m:
        return int(m.group(1))

    # "X months" → X*4
    m = re.match(r"^(\d+)\s+months?$", lower)
    if m:
        return int(m.group(1)) * 4

    return None


def classify_severity(return_text: str) -> str:
    """Map an estimated-return string to test/short/medium/long.

    - "test"   — return text is exactly "Test"
    - "short"  — up to 2 weeks
    - "medium" — 3-6 weeks
    - "long"   — beyond 6 weeks, Season, TBC, Indefinite, etc.
    """
    if not return_text:
        return "long"

    text = return_text.strip()
    lower = text.lower()

    if lower == "test":
        return "test"

    if lower in ("season", "indefinite", "tbc"):
        return "long"

    # "Round X" — treat as short (specific near-term target)
    if re.match(r"^round\s+\d+$", lower):
        return "short"

    weeks = _parse_weeks(text)
    if weeks is not None:
        if weeks <= 2:
            return "short"
        if weeks <= 6:
            return "medium"
        return "long"

    return "long"


def friendly_return_text(return_text: str, current_round: int | None) -> str:
    """Convert a raw return estimate into a round-based display string.

    Examples:
      "Test"       → "Expected to play this round"
      "1 week"     → "Expected to return Round 3"
      "1-2 weeks"  → "Expected to return Round 3 or 4"
      "3-4 weeks"  → "Expected to return between Round 5 and 6"
      "Round 5"    → "Expected to return Round 5"
      "Season"     → "Out for the season"
      "TBC"        → "Return date TBC"
    """
    if not return_text:
        return ""

    text = return_text.strip()
    lower = text.lower()

    if lower == "test":
        return "Test for this round"

    # Already a specific round: "Round X"
    m = re.match(r"^round\s+(\d+)$", lower)
    if m:
        return f"Expected to return Round {m.group(1)}"

    if lower in ("season", "indefinite"):
        return "Out for the season"

    if lower == "tbc":
        return "Return date TBC"

    # "X weeks" or "X-Y weeks" or "X-plus weeks" or "X months"
    if current_round is not None:
        # "X-plus weeks" → treat as X weeks minimum
        m = re.match(r"^(\d+)-?plus\s+weeks?$", lower)
        if m:
            lo = int(m.group(1))
            r_lo = current_round + lo
            return f"Expected to return Round {r_lo}+"

        # "X months" → approximate as X*4 weeks
        m = re.match(r"^(\d+)\s+months?$", lower)
        if m:
            weeks = int(m.group(1)) * 4
            r_lo = current_round + weeks
            return f"Expected to return Round {r_lo}+"

        # "X-Y weeks"
        m = re.match(r"^(\d+)\s*-\s*(\d+)\s+weeks?$", lower)
        if m:
            lo, hi = int(m.group(1)), int(m.group(2))
            r_lo = current_round + lo
            r_hi = current_round + hi
            if r_lo == r_hi:
                return f"Expected to return Round {r_lo}"
            return f"Expected to return between Round {r_lo} and {r_hi}"

        # "X weeks"
        m = re.match(r"^(\d+)\s+weeks?$", lower)
        if m:
            weeks = int(m.group(1))
            r_ret = current_round + weeks
            return f"Expected to return Round {r_ret}"

    # Fallback: just return the raw text
    return text


def scrape_injury_list() -> list[dict]:
    """Fetch the AFL injury list page, return a list of injury dicts.

    Each dict: {"name": str, "team": str, "injury": str, "return_text": str}

    The AFL page has a sidebar with ``club-list__club-name`` spans listing
    teams in order, and an ``article__body`` div containing one ``<table>``
    per team in the same order.  Tables may be empty for teams with no
    injuries.
    """
    resp = requests.get(_INJURY_URL, headers=_HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    injuries = []

    # 1. Build ordered team list from sidebar club-name spans (deduplicated)
    team_order = []
    seen = set()
    for span in soup.find_all("span", class_="club-list__club-name"):
        raw = span.get_text(strip=True)
        if raw not in seen:
            seen.add(raw)
            team_order.append(_AFL_TEAM_MAP.get(raw, raw))

    # 2. Collect tables from the article body — one per team, same order
    article_body = soup.find("div", class_="article__body")
    tables = article_body.find_all("table") if article_body else soup.find_all("table")

    if not team_order or not tables:
        logger.warning("Injury scrape: could not find teams (%d) or tables (%d)",
                       len(team_order), len(tables))
        return injuries

    for idx, table in enumerate(tables):
        team = team_order[idx] if idx < len(team_order) else None
        if not team:
            continue

        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            name = cells[0].get_text(strip=True)
            if not name or name.lower() in ("player", "name", "updated:"):
                continue
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
        severity = classify_severity(entry["return_text"])
        # Override: suspensions get their own category
        if "suspension" in entry["injury"].lower():
            severity = "suspension"
        player.injury_severity = severity
        count += 1

    db.session.commit()
    logger.info("Injury sync: %d players updated", count)
    return count

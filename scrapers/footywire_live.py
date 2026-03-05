"""Live Footywire scraper for mid-round SuperCoach scores and detailed match stats.

Reuses patterns from scrapers/footywire.py (HEADERS, DELAY, _get).
Adds response caching (90 seconds) to avoid hammering during rapid poll cycles.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

import requests
from bs4 import BeautifulSoup

from config import FOOTYWIRE_BASE, TEAM_SLUGS

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

DELAY = 1.5  # seconds between requests (polite crawling)

# Simple in-memory response cache: {url: (timestamp, soup)}
_cache: dict[str, tuple[float, BeautifulSoup]] = {}
_CACHE_TTL = 90  # seconds


def _get_cached(url: str) -> BeautifulSoup:
    """Fetch a URL with 90-second caching to avoid re-fetching during rapid polls."""
    now = time.time()
    if url in _cache:
        ts, soup = _cache[url]
        if now - ts < _CACHE_TTL:
            return soup

    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")
    _cache[url] = (now, soup)
    return soup


# Footywire team names → our canonical names.
# The SC scores page uses MASCOT names ("Crows", "Lions", "Blues", etc.)
# while match stats pages may use abbreviations ("ADE", "BRL") or full names.
# We map all known variants to our canonical DB names.
_FW_TEAM_MAP = {
    # Mascot names (as they appear on the SC scores page)
    "Crows": "Adelaide",
    "Lions": "Brisbane Lions",
    "Blues": "Carlton",
    "Magpies": "Collingwood",
    "Bombers": "Essendon",
    "Dockers": "Fremantle",
    "Cats": "Geelong",
    "Suns": "Gold Coast",
    "Giants": "GWS",
    "Hawks": "Hawthorn",
    "Demons": "Melbourne",
    "Kangaroos": "North Melbourne",
    "Power": "Port Adelaide",
    "Tigers": "Richmond",
    "Saints": "St Kilda",
    "Swans": "Sydney",
    "Eagles": "West Coast",
    "Bulldogs": "Western Bulldogs",
    # Abbreviation codes (match stats pages)
    "ADE": "Adelaide",
    "BRL": "Brisbane Lions",
    "CAR": "Carlton",
    "COL": "Collingwood",
    "ESS": "Essendon",
    "FRE": "Fremantle",
    "GEE": "Geelong",
    "GCS": "Gold Coast",
    "GWS": "GWS",
    "HAW": "Hawthorn",
    "MEL": "Melbourne",
    "NME": "North Melbourne",
    "PTA": "Port Adelaide",
    "RIC": "Richmond",
    "STK": "St Kilda",
    "SYD": "Sydney",
    "WCE": "West Coast",
    "WBD": "Western Bulldogs",
    # Full canonical names (pass-through)
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


def normalise_team(raw: str) -> str:
    """Map a Footywire team string to our canonical team name."""
    key = raw.strip()
    canonical = _FW_TEAM_MAP.get(key)
    if canonical is None:
        logger.warning("Unknown Footywire team name: '%s' — passing through unchanged", key)
        return key
    return canonical


def scrape_live_sc_scores(year: int, afl_round: int) -> list[dict]:
    """Scrape SuperCoach scores for all players in a given round.

    URL: https://www.footywire.com/afl/footy/supercoach_round?round={round}&season={year}

    Returns list of dicts: {name, team, sc_score}
    """
    url = f"{FOOTYWIRE_BASE}/supercoach_round?year={year}&round={afl_round}&p=&s=T"
    logger.info("Scraping live SC scores: %s R%d", year, afl_round)

    try:
        soup = _get_cached(url)
    except requests.RequestException as e:
        logger.error("Failed to fetch SC scores page: %s", e)
        return []

    results = []
    for tr in soup.find_all("tr"):
        cells = tr.find_all("td", recursive=False)
        if len(cells) != 7:
            continue
        link = tr.find("a", href=lambda h: h and h.startswith("pu-"))
        if not link:
            continue

        # Use the <a> link text for the player name — the cell text may have
        # "Injured" or other markers appended (e.g. "Thomas StewartInjured")
        name = link.get_text(strip=True)
        team_raw = cells[2].get_text(strip=True)
        score_text = cells[5].get_text(strip=True).replace(",", "")

        if not name or not score_text.lstrip("-").isdigit():
            continue

        sc_score = int(score_text)
        results.append({
            "name": name,
            "team": normalise_team(team_raw),
            "sc_score": sc_score,
        })

    logger.info("Scraped %d SC scores for %d R%d", len(results), year, afl_round)
    return results


def scrape_match_stats(match_id: int) -> list[dict]:
    """Scrape detailed per-player stats from a Footywire match page.

    URL: https://www.footywire.com/afl/footy/ft_match_statistics?mid={match_id}

    Returns list of dicts with keys:
        name, team, kicks, handballs, disposals, marks, goals, behinds,
        tackles, hitouts, contested_possessions, uncontested_possessions,
        clearances, clangers, inside_fifties, rebounds
    """
    url = f"{FOOTYWIRE_BASE}/ft_match_statistics?mid={match_id}"
    logger.info("Scraping match stats: mid=%d", match_id)

    try:
        soup = _get_cached(url)
    except requests.RequestException as e:
        logger.error("Failed to fetch match stats mid=%d: %s", match_id, e)
        return []

    results = []

    # Footywire match stats has two tables (one per team)
    stat_tables = soup.find_all("table", class_="sortable")
    if not stat_tables:
        # Fallback: find tables with expected headers
        for t in soup.find_all("table"):
            rows = t.find_all("tr")
            if len(rows) < 3:
                continue
            header_text = rows[0].get_text(strip=True)
            if "Kicks" in header_text and "Handballs" in header_text:
                stat_tables.append(t)

    for table in stat_tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        # Parse header
        header_cells = rows[0].find_all(["th", "td"])
        headers = [c.get_text(strip=True) for c in header_cells]

        col_map = {}
        stat_keys = {
            "K": "kicks", "Kicks": "kicks",
            "HB": "handballs", "Handballs": "handballs",
            "D": "disposals", "Disposals": "disposals",
            "M": "marks", "Marks": "marks",
            "G": "goals", "Goals": "goals",
            "B": "behinds", "Behinds": "behinds",
            "T": "tackles", "Tackles": "tackles",
            "HO": "hitouts", "Hitouts": "hitouts",
            "CP": "contested_possessions",
            "UP": "uncontested_possessions",
            "CL": "clearances",
            "CG": "clangers",
            "I50": "inside_fifties",
            "R50": "rebounds",
            "FF": "frees_for",
            "FA": "frees_against",
            "CM": "contested_marks",
            "MI5": "marks_inside_50",
            "1%": "one_percenters",
            "BO": "bounces",
            "GA": "goal_assists",
            "TOG": "time_on_ground_pct",
            "CCL": "centre_clearances",
            "SCL": "stoppage_clearances",
            "TO": "turnovers",
            "KI": "kick_ins",
        }
        for i, h in enumerate(headers):
            if h in stat_keys:
                col_map[stat_keys[h]] = i

        for row in rows[1:]:
            cells = row.find_all("td")
            if len(cells) < 5:
                continue

            # Player name is usually in a link
            player_link = row.find("a", href=lambda h: h and "pp-" in h)
            if not player_link:
                continue

            name = player_link.get_text(strip=True)
            if not name:
                continue

            player_data = {"name": name}
            for stat_key, col_idx in col_map.items():
                if col_idx < len(cells):
                    val_text = cells[col_idx].get_text(strip=True).replace(",", "")
                    try:
                        player_data[stat_key] = int(val_text)
                    except (ValueError, TypeError):
                        player_data[stat_key] = 0

            results.append(player_data)

    logger.info("Scraped %d player stat lines for mid=%d", len(results), match_id)
    return results


def scrape_preseason_sc_scores() -> list[dict]:
    """Scrape SuperCoach scores from the pre-season / Community Series page.

    URL: https://www.footywire.com/afl/footy/pre_season_supercoach

    Returns list of dicts: {name, team, sc_score}
    The page aggregates all pre-season games (Total column).
    """
    url = f"{FOOTYWIRE_BASE}/pre_season_supercoach"
    logger.info("Scraping pre-season SC scores")

    try:
        soup = _get_cached(url)
    except requests.RequestException as e:
        logger.error("Failed to fetch pre-season SC page: %s", e)
        return []

    results = []
    for tr in soup.find_all("tr"):
        cells = tr.find_all("td", recursive=False)
        if len(cells) < 7:
            continue
        # Cell layout: [rank, player_link, team, games, price, total, avg, value]
        link = tr.find("a", href=lambda h: h and h.startswith("pp-"))
        if not link:
            # Try alternate link pattern
            link = tr.find("a", href=lambda h: h and ("pp-" in str(h) or "pu-" in str(h)))
        if not link:
            continue

        name = link.get_text(strip=True)
        # Strip position markers like "(MID)" from end of name
        import re
        name = re.sub(r'\s*\([A-Z, ]+\)\s*$', '', name).strip()

        team_raw = cells[2].get_text(strip=True)
        total_text = cells[5].get_text(strip=True).replace(",", "")

        if not name or not total_text.lstrip("-").isdigit():
            continue

        sc_score = int(total_text)
        if sc_score == 0:
            continue

        results.append({
            "name": name,
            "team": normalise_team(team_raw),
            "sc_score": sc_score,
        })

    logger.info("Scraped %d pre-season SC scores", len(results))
    return results


def scrape_live_round(year: int, afl_round: int) -> list[dict]:
    """Scrape SC scores for all players in a round.

    This is the main entry point used by the live sync module.
    Returns list of {name, team, sc_score} dicts.
    """
    if afl_round == 0:
        return scrape_preseason_sc_scores()
    return scrape_live_sc_scores(year, afl_round)


def clear_cache():
    """Clear the response cache (useful for testing)."""
    _cache.clear()

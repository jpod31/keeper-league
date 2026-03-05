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
_CACHE_TTL = 45  # seconds


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

    Tries Footywire first. If no data (e.g. early-season before Footywire
    populates), falls back to footyinfo match pages.
    """
    results = scrape_live_sc_scores(year, afl_round)
    if results:
        return results

    logger.info("Footywire returned no data for %d R%d, trying footyinfo fallback", year, afl_round)
    return scrape_footyinfo_sc_scores(year, afl_round)


# ── Footyinfo fallback scraper ──────────────────────────────────────

FOOTYINFO_BASE = "https://www.footyinfo.com"

# Footyinfo team_id → our canonical team name
_FOOTYINFO_TEAM_ID_MAP = {
    1: "Adelaide",
    2: "Brisbane Lions",
    3: "Carlton",
    4: "Collingwood",
    5: "Essendon",
    6: "Fremantle",
    7: "Geelong",
    8: "Gold Coast",
    9: "GWS",
    10: "Hawthorn",
    11: "Melbourne",
    12: "North Melbourne",
    13: "Port Adelaide",
    14: "Sydney",
    15: "Richmond",
    16: "St Kilda",
    17: "West Coast",
    18: "Western Bulldogs",
}



def _teams_from_url(url: str) -> tuple[str, str]:
    """Extract (home_team, away_team) canonical names from a footyinfo match URL.

    URL pattern: .../round-0/sydney-vs-carlton-18938
    """
    # Footyinfo slug → canonical name
    _SLUG_MAP = {
        "adelaide": "Adelaide",
        "brisbane": "Brisbane Lions",
        "carlton": "Carlton",
        "collingwood": "Collingwood",
        "essendon": "Essendon",
        "fremantle": "Fremantle",
        "geelong": "Geelong",
        "gold-coast": "Gold Coast",
        "gws": "GWS",
        "hawthorn": "Hawthorn",
        "melbourne": "Melbourne",
        "north-melbourne": "North Melbourne",
        "port-adelaide": "Port Adelaide",
        "richmond": "Richmond",
        "st-kilda": "St Kilda",
        "sydney": "Sydney",
        "west-coast": "West Coast",
        "western-bulldogs": "Western Bulldogs",
    }

    # Extract the slug part: "sydney-vs-carlton-18938"
    match = re.search(r'/([a-z-]+-vs-[a-z-]+-\d+)$', url)
    if not match:
        return ("", "")

    slug = match.group(1)
    # Remove trailing match ID: "sydney-vs-carlton"
    slug = re.sub(r'-\d+$', '', slug)
    parts = slug.split("-vs-")
    if len(parts) != 2:
        return ("", "")

    home = _SLUG_MAP.get(parts[0], "")
    away = _SLUG_MAP.get(parts[1], "")
    return (home, away)


def _parse_footyinfo_match(url: str) -> list[dict]:
    """Parse a footyinfo match page and extract player SC scores.

    Returns list of {name, team, sc_score} dicts.
    Names are surname-only (from HTML tables). Team is canonical.
    """
    home_team, away_team = _teams_from_url(url)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error("Failed to fetch footyinfo match %s: %s", url, e)
        return []

    return _parse_footyinfo_match_tables(resp.text, url, home_team, away_team)


def _parse_footyinfo_match_tables(html: str, url: str,
                                   home_team: str = "", away_team: str = "") -> list[dict]:
    """Parse footyinfo match page HTML tables for SC scores.

    Tables appear in order: table 0 = home, table 1 = away.
    Headers: #, Player, KI, HB, DI, MA, FF, FA, TA, HO, G.B, ToG, AF, SC
    """
    soup = BeautifulSoup(html, "lxml")
    results = []
    team_order = [home_team, away_team]
    table_idx = 0

    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        # Find SC and Player column indices from headers
        header_cells = rows[0].find_all(["th", "td"])
        headers = [c.get_text(strip=True).upper() for c in header_cells]

        sc_idx = None
        name_idx = None
        for i, h in enumerate(headers):
            if h == "SC":
                sc_idx = i
            if h == "PLAYER":
                name_idx = i

        if sc_idx is None:
            continue

        # Assign team based on table order (first = home, second = away)
        team = team_order[table_idx] if table_idx < len(team_order) else ""
        table_idx += 1

        for row in rows[1:]:
            cells = row.find_all("td")
            if len(cells) <= sc_idx:
                continue

            # Player name (surname only from footyinfo tables)
            if name_idx is not None and name_idx < len(cells):
                name = cells[name_idx].get_text(strip=True)
            else:
                continue

            if not name:
                continue

            sc_text = cells[sc_idx].get_text(strip=True).replace(",", "")
            if not sc_text.lstrip("-").isdigit():
                continue

            results.append({
                "name": name,
                "team": team,
                "sc_score": int(sc_text),
                "is_surname_only": True,  # Flag for matching logic
            })

    logger.info("Parsed %d players from footyinfo tables: %s", len(results), url)
    return results


def scrape_footyinfo_sc_scores(year: int, afl_round: int) -> list[dict]:
    """Scrape SC scores from footyinfo match pages for a round.

    Discovers match URLs from the round overview page, then scrapes
    each match page for player SC scores.

    Returns list of {name, team, sc_score} dicts.
    """
    round_url = f"{FOOTYINFO_BASE}/supercoach/afl/{year}/round/{afl_round}"
    logger.info("Scraping footyinfo SC scores: %d R%d", year, afl_round)

    try:
        resp = requests.get(round_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error("Failed to fetch footyinfo round page: %s", e)
        return []

    # Extract match URLs from the round page
    soup = BeautifulSoup(resp.text, "lxml")
    match_urls = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/match/australian-football-league/" in href and href not in match_urls:
            full_url = f"{FOOTYINFO_BASE}{href}" if href.startswith("/") else href
            if full_url not in match_urls:
                match_urls.append(full_url)

    if not match_urls:
        # Try extracting from embedded JSON
        import json
        for script in soup.find_all("script"):
            text = script.string or ""
            for m in re.finditer(r'/match/australian-football-league/[^"\'\\]+', text):
                url = f"{FOOTYINFO_BASE}{m.group(0)}"
                if url not in match_urls:
                    match_urls.append(url)

    logger.info("Found %d match URLs for %d R%d", len(match_urls), year, afl_round)

    all_results = []
    for url in match_urls:
        time.sleep(1)  # polite delay between requests
        players = _parse_footyinfo_match(url)
        all_results.extend(players)
        logger.info("Scraped %d players from %s", len(players), url.split("/")[-1])

    logger.info("Footyinfo total: %d SC scores for %d R%d", len(all_results), year, afl_round)
    return all_results


def clear_cache():
    """Clear the response cache (useful for testing)."""
    _cache.clear()

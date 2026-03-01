"""Scrape Footywire for AFL rosters and Supercoach scores."""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Dict, List, Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup

from config import (
    FOOTYWIRE_BASE,
    TEAM_SLUGS,
    DATA_DIR,
    CURRENT_YEAR,
    SC_ROUNDS,
    SC_HISTORY_YEARS,
)
from models.player import Player, save_players_csv, load_players_csv

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

DELAY = 1.5  # seconds between requests to be polite


def _get(url: str) -> BeautifulSoup:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "lxml")


# ── Position parsing ─────────────────────────────────────────────────

# Footywire concatenates dual positions like "MidfieldForward", "DefenderMidfield"
# We split them and for dual-pos default to the non-MID position (more scarce).

_POS_MAP = {
    "Defender": "DEF",
    "Midfield": "MID",
    "Forward": "FWD",
    "Ruck": "RUC",
}

_POS_PATTERN = re.compile(r"(Defender|Midfield|Forward|Ruck)")


def _parse_position(raw: str) -> str:
    """Parse Footywire's position string into our format.

    'MidfieldForward' → 'FWD/MID'  (non-MID first)
    'DefenderMidfield' → 'DEF/MID'
    'Midfield' → 'MID'
    'Ruck' → 'RUC'
    """
    matches = _POS_PATTERN.findall(raw)
    if not matches:
        return "MID"

    codes = [_POS_MAP[m] for m in matches]
    # Remove duplicates while preserving order
    seen = set()
    unique = []
    for c in codes:
        if c not in seen:
            seen.add(c)
            unique.append(c)

    if len(unique) == 1:
        return unique[0]

    # Dual-pos: put the non-MID position first (it's scarcer)
    unique.sort(key=lambda c: (0 if c != "MID" else 1))
    return "/".join(unique)


# ── Roster scraping ──────────────────────────────────────────────────
# Page: https://www.footywire.com/afl/footy/tp-{slug}
# Table with header: No | Name | Games | Age | Date of Birth | Height | Origin | Position
# Age format: "28yr 4mth" → we extract the integer year part
# Height format: "182cm" → we extract the integer


def _parse_age(raw: str) -> Optional[int]:
    """'28yr 4mth' → 28"""
    m = re.match(r"(\d+)yr", raw)
    return int(m.group(1)) if m else None


def _parse_height(raw: str) -> Optional[int]:
    """'182cm' → 182"""
    m = re.match(r"(\d+)cm", raw)
    return int(m.group(1)) if m else None


def _parse_roster_page(team_name: str, slug: str) -> List[Player]:
    """Scrape a single team's roster page on Footywire."""
    url = f"{FOOTYWIRE_BASE}/tp-{slug}"
    soup = _get(url)

    # Find the table whose header row contains 'Name' and 'Position'
    target_table = None
    for t in soup.find_all("table"):
        rows = t.find_all("tr")
        if len(rows) < 5:
            continue
        hdr_cells = rows[0].find_all(["th", "td"])
        hdr_texts = [c.get_text(strip=True) for c in hdr_cells]
        if "Name" in hdr_texts and "Position" in hdr_texts:
            target_table = t
            break

    if target_table is None:
        print(f"  [WARN] No roster table found for {team_name}")
        return []

    # Build column index map from header
    hdr_row = target_table.find_all("tr")[0]
    hdr_cells = hdr_row.find_all(["th", "td"])
    col_names = [c.get_text(strip=True) for c in hdr_cells]
    col = {name: i for i, name in enumerate(col_names)}

    players: List[Player] = []
    for row in target_table.find_all("tr")[1:]:
        cells = row.find_all("td")
        if len(cells) < len(col):
            continue

        def cell(name: str) -> str:
            idx = col.get(name)
            if idx is None or idx >= len(cells):
                return ""
            return cells[idx].get_text(strip=True)

        name = cell("Name")
        # Strip trailing R (rookie indicator) e.g. "Borlase, JamesR"
        name = re.sub(r"R$", "", name).strip()
        if not name:
            continue

        # Convert "Last, First" → "First Last"
        if "," in name:
            parts = name.split(",", 1)
            name = f"{parts[1].strip()} {parts[0].strip()}"

        games_str = cell("Games").replace(",", "")
        games = int(games_str) if games_str.isdigit() else None

        age = _parse_age(cell("Age"))
        dob = cell("Date of Birth") or None
        height = _parse_height(cell("Height"))
        position = _parse_position(cell("Position"))

        players.append(
            Player(
                name=name,
                team=team_name,
                position=position,
                age=age,
                dob=dob,
                games=games,
                height=height,
            )
        )

    return players


def scrape_rosters() -> List[Player]:
    """Scrape all 18 AFL team rosters and return a combined player list."""
    all_players: List[Player] = []
    for team_name, slug in TEAM_SLUGS.items():
        print(f"Scraping roster: {team_name} ...")
        try:
            roster = _parse_roster_page(team_name, slug)
            all_players.extend(roster)
            print(f"  -> {len(roster)} players")
        except Exception as e:
            print(f"  [ERROR] {team_name}: {e}")
        time.sleep(DELAY)

    print(f"\nTotal players scraped: {len(all_players)}")
    return all_players


# ── Supercoach score scraping ────────────────────────────────────────
# Page: https://www.footywire.com/afl/footy/supercoach_round?year={year}&round={round}&p=&s=T
# Data rows: <tr> with exactly 7 <td> children containing a pu- link
# Columns: Rank | Player | Team | CurrentSalary | RoundSalary | RoundScore | Value


def scrape_sc_scores(year: int = CURRENT_YEAR, max_round: int = SC_ROUNDS) -> pd.DataFrame:
    """Scrape Supercoach scores for every round of a given year.

    Returns a DataFrame with columns: name, team, round, sc_score
    """
    all_rows = []

    for rnd in range(0, max_round + 1):
        url = (
            f"{FOOTYWIRE_BASE}/supercoach_round"
            f"?year={year}&round={rnd}&p=&s=T"
        )
        print(f"Scraping SC scores: {year} R{rnd} ...")
        try:
            soup = _get(url)
        except requests.HTTPError:
            print(f"  [WARN] No data for round {rnd}, stopping.")
            break

        # Find rows with exactly 7 cells that contain a pu- player link
        round_count = 0
        for tr in soup.find_all("tr"):
            cells = tr.find_all("td", recursive=False)
            if len(cells) != 7:
                continue
            link = tr.find("a", href=lambda h: h and h.startswith("pu-"))
            if not link:
                continue

            name = cells[1].get_text(strip=True)
            team = cells[2].get_text(strip=True)
            score_text = cells[5].get_text(strip=True).replace(",", "")

            if not name or not score_text.isdigit():
                continue

            sc_score = int(score_text)
            # Score of 0 means DNP for this round — skip
            if sc_score == 0:
                continue

            all_rows.append({
                "name": name,
                "team": team,
                "round": rnd,
                "sc_score": sc_score,
            })
            round_count += 1

        if round_count == 0:
            print(f"  [WARN] No scores found for R{rnd}, stopping.")
            break

        print(f"  -> {round_count} scores")
        time.sleep(DELAY)

    df = pd.DataFrame(all_rows, columns=["name", "team", "round", "sc_score"])
    # Save to CSV
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, f"sc_scores_{year}.csv")
    df.to_csv(path, index=False)
    print(f"Saved {len(df)} score rows -> {path}")
    return df


# ── Master player list builder ───────────────────────────────────────


def build_master_player_list(
    roster_players: Optional[List[Player]] = None,
    sc_year: int = CURRENT_YEAR,
    sc_prev_year: Optional[int] = None,
) -> List[Player]:
    """Merge roster data with SC averages to produce the master player list.

    If roster_players is None, scrapes fresh.
    """
    if sc_prev_year is None:
        sc_prev_year = sc_year - 1

    if roster_players is None:
        roster_players = scrape_rosters()

    # Load or scrape current-year SC scores
    sc_path = os.path.join(DATA_DIR, f"sc_scores_{sc_year}.csv")
    if os.path.exists(sc_path):
        sc_df = pd.read_csv(sc_path)
    else:
        sc_df = scrape_sc_scores(sc_year)

    # Load previous-year SC scores for trajectory (don't scrape automatically)
    sc_prev_path = os.path.join(DATA_DIR, f"sc_scores_{sc_prev_year}.csv")
    if os.path.exists(sc_prev_path):
        sc_prev_df = pd.read_csv(sc_prev_path)
    else:
        sc_prev_df = pd.DataFrame()

    # Compute current-year averages
    if not sc_df.empty:
        avg_df = sc_df.groupby("name").agg(
            sc_avg=("sc_score", "mean"),
            games_played=("sc_score", "count"),
        ).reset_index()
    else:
        avg_df = pd.DataFrame(columns=["name", "sc_avg", "games_played"])

    # Compute previous-year averages
    if not sc_prev_df.empty:
        prev_avg_df = sc_prev_df.groupby("name")["sc_score"].mean().reset_index()
        prev_avg_df.columns = ["name", "sc_avg_prev"]
    else:
        prev_avg_df = pd.DataFrame(columns=["name", "sc_avg_prev"])

    # Merge onto roster
    for player in roster_players:
        match = avg_df[avg_df["name"] == player.name]
        if not match.empty:
            player.sc_avg = round(float(match.iloc[0]["sc_avg"]), 1)
            player.games_played = int(match.iloc[0]["games_played"])

        prev_match = prev_avg_df[prev_avg_df["name"] == player.name]
        if not prev_match.empty:
            player.sc_avg_prev = round(float(prev_match.iloc[0]["sc_avg_prev"]), 1)

    path = save_players_csv(roster_players)
    print(f"Master player list saved -> {path} ({len(roster_players)} players)")
    return roster_players


# ── Batch historical SC scraping ─────────────────────────────────────


def scrape_sc_scores_batch(
    years: Optional[List[int]] = None,
    skip_existing: bool = True,
) -> Dict[int, str]:
    """Scrape SC scores for multiple years, skipping years already on disk.

    Returns a dict of {year: csv_path} for all years (existing + newly scraped).
    """
    if years is None:
        years = SC_HISTORY_YEARS

    results: Dict[int, str] = {}
    for year in years:
        path = os.path.join(DATA_DIR, f"sc_scores_{year}.csv")
        if skip_existing and os.path.exists(path):
            print(f"SC scores {year}: already on disk, skipping.")
            results[year] = path
            continue
        try:
            scrape_sc_scores(year)
            results[year] = path
        except Exception as e:
            print(f"  [ERROR] SC scores {year}: {e}")

    return results


# ── Player SC history loader ─────────────────────────────────────────


def _least_squares_slope(xs: List[float], ys: List[float]) -> float:
    """Pure-Python least-squares linear regression slope."""
    n = len(xs)
    if n < 2:
        return 0.0
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den = sum((x - x_mean) ** 2 for x in xs)
    if den == 0:
        return 0.0
    return num / den


def load_player_sc_history(player_name: str) -> dict:
    """Load multi-year SC history for a single player from CSV files on disk.

    Returns dict with keys:
        yearly_averages: list of {year, avg, games_played}
        career_avg: float or None
        peak_avg: float or None
        peak_year: int or None
        current_rounds: list of {round, sc_score}
        trajectory_slope: float (pts/yr from linear regression) or None
    """
    yearly_averages = []
    current_rounds = []

    for year in SC_HISTORY_YEARS:
        path = os.path.join(DATA_DIR, f"sc_scores_{year}.csv")
        if not os.path.exists(path):
            continue

        df = pd.read_csv(path)
        pdata = df[df["name"] == player_name]
        if pdata.empty:
            continue

        avg = round(float(pdata["sc_score"].mean()), 1)
        gp = len(pdata)
        yearly_averages.append({"year": year, "avg": avg, "games_played": gp})

        if year == CURRENT_YEAR:
            current_rounds = pdata.sort_values("round")[["round", "sc_score"]].to_dict(orient="records")

    # Derived stats
    career_avg = None
    peak_avg = None
    peak_year = None
    trajectory_slope = None

    if yearly_averages:
        all_avgs = [y["avg"] for y in yearly_averages]
        career_avg = round(sum(all_avgs) / len(all_avgs), 1)
        best = max(yearly_averages, key=lambda y: y["avg"])
        peak_avg = best["avg"]
        peak_year = best["year"]

        if len(yearly_averages) >= 2:
            xs = [float(y["year"]) for y in yearly_averages]
            ys = [y["avg"] for y in yearly_averages]
            trajectory_slope = round(_least_squares_slope(xs, ys), 2)

    return {
        "yearly_averages": yearly_averages,
        "career_avg": career_avg,
        "peak_avg": peak_avg,
        "peak_year": peak_year,
        "current_rounds": current_rounds,
        "trajectory_slope": trajectory_slope,
    }


# ── Position sync ─────────────────────────────────────────────────────

_sync_logger = logging.getLogger(__name__)


def _update_csv_positions(changes: List[dict]) -> None:
    """Patch players.csv with updated positions from a list of change dicts."""
    players = load_players_csv()
    if not players:
        return

    lookup = {(c["name"], c["team"]): c["new_pos"] for c in changes}
    updated = 0
    for p in players:
        key = (p.name, p.team)
        if key in lookup:
            p.position = lookup[key]
            updated += 1

    if updated:
        save_players_csv(players)
        _sync_logger.info("Updated %d positions in players.csv", updated)


def sync_player_positions() -> List[dict]:
    """Scrape current positions from Footywire and update the DB + CSV.

    Returns a list of change dicts: {name, team, old_pos, new_pos}
    """
    from models.database import db, AflPlayer

    _sync_logger.info("Starting player position sync from Footywire...")
    scraped = scrape_rosters()

    # Build lookup: (name, team) -> scraped position
    scraped_positions = {}
    for p in scraped:
        scraped_positions[(p.name, p.team)] = p.position

    # Compare with DB
    all_db_players = AflPlayer.query.all()
    changes = []

    for dbp in all_db_players:
        key = (dbp.name, dbp.afl_team)
        new_pos = scraped_positions.get(key)
        if new_pos is None:
            continue  # player not found in scrape (delisted, name mismatch, etc.)

        old_pos = dbp.position or "MID"
        if new_pos != old_pos:
            changes.append({
                "name": dbp.name,
                "team": dbp.afl_team,
                "old_pos": old_pos,
                "new_pos": new_pos,
            })
            dbp.position = new_pos

    if changes:
        db.session.commit()
        _sync_logger.info(
            "Position sync complete: %d changes — %s",
            len(changes),
            ", ".join(f"{c['name']} ({c['team']}): {c['old_pos']} -> {c['new_pos']}" for c in changes),
        )
        _update_csv_positions(changes)
    else:
        _sync_logger.info("Position sync complete: all positions up to date")

    return changes

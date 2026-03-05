"""Fetch AFL team lineups via fitzRoy's fetch_lineup() and sync to DB."""

from __future__ import annotations

import io
import logging
import subprocess

import pandas as pd

logger = logging.getLogger(__name__)

# fitzRoy team names → canonical DB team names (reuse mapping from afl_injuries)
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

# Position code → (line group name, sort order within the line)
_POSITION_ORDER = {
    "BPL":  ("Backs", 0),
    "FB":   ("Backs", 1),
    "BPR":  ("Backs", 2),
    "HBFL": ("Half Backs", 0),
    "CHB":  ("Half Backs", 1),
    "HBFR": ("Half Backs", 2),
    "WL":   ("Centre", 0),
    "C":    ("Centre", 1),
    "WR":   ("Centre", 2),
    "HFFL": ("Half Forwards", 0),
    "CHF":  ("Half Forwards", 1),
    "HFFR": ("Half Forwards", 2),
    "FPL":  ("Forwards", 0),
    "FF":   ("Forwards", 1),
    "FPR":  ("Forwards", 2),
    "RK":   ("Followers", 0),
    "RR":   ("Followers", 1),
    "R":    ("Followers", 2),
    "INT":  ("Interchange", 0),
    "SUB":  ("Interchange", 5),
    "EMERG": ("Emergencies", 0),
}

# Ordered line groups for display
LINE_ORDER = ["Backs", "Half Backs", "Centre", "Half Forwards", "Forwards",
              "Followers", "Interchange", "Emergencies"]


def fetch_team_lineups(year: int, afl_round: int) -> list[dict]:
    """Call fitzRoy fetch_lineup() via Rscript and return parsed rows.

    Each dict has: team, player_name, position, jumper_number, is_captain,
                   match_id, team_type
    """
    r_code = f"""
    suppressMessages(library(fitzRoy))
    df <- fetch_lineup(season = {year}, round_number = {afl_round})
    write.csv(df, row.names = FALSE)
    """

    try:
        result = subprocess.run(
            ["Rscript", "-e", r_code],
            capture_output=True, text=True, timeout=120,
        )
    except FileNotFoundError:
        logger.error("Rscript not found — R is not installed or not on PATH")
        return []
    except subprocess.TimeoutExpired:
        logger.error("Rscript timed out fetching lineups for %d R%d", year, afl_round)
        return []

    if result.returncode != 0:
        logger.error("Rscript failed (exit %d): %s", result.returncode, result.stderr[:500])
        return []

    csv_text = result.stdout
    if not csv_text.strip():
        logger.warning("Empty output from fetch_lineup(%d, %d)", year, afl_round)
        return []

    try:
        df = pd.read_csv(io.StringIO(csv_text))
    except Exception:
        logger.exception("Failed to parse lineup CSV")
        return []

    if df.empty:
        logger.warning("No lineup data returned for %d R%d", year, afl_round)
        return []

    rows = []
    for _, r in df.iterrows():
        # Build player name from givenName + surname columns
        given = str(r.get("player.playerName.givenName", "")).strip()
        surname = str(r.get("player.playerName.surname", "")).strip()
        if given == "nan":
            given = ""
        if surname == "nan":
            surname = ""
        player_name = f"{given} {surname}".strip()
        if not player_name:
            continue

        raw_team = str(r.get("teamName", "")).strip()
        team = _AFL_TEAM_MAP.get(raw_team, raw_team)

        position = str(r.get("position", "")).strip()
        if position == "nan":
            position = None

        jumper = r.get("player.playerJumperNumber")
        try:
            jumper = int(jumper)
        except (ValueError, TypeError):
            jumper = None

        is_captain = bool(r.get("player.captain", False))

        match_id = str(r.get("providerId", "")).strip()
        if match_id == "nan":
            match_id = None

        team_type = str(r.get("teamType", "")).strip().lower()
        if team_type == "nan":
            team_type = None

        rows.append({
            "team": team,
            "player_name": player_name,
            "position": position,
            "jumper_number": jumper,
            "is_captain": is_captain,
            "match_id": match_id,
            "team_type": team_type,
        })

    logger.info("Fetched %d lineup entries for %d R%d", len(rows), year, afl_round)
    return rows


def _match_player(name: str, team: str, AflPlayer):
    """Match a player name to an AflPlayer record.

    Tries exact name+team first, then surname-only fallback within team.
    """
    # Exact match
    player = AflPlayer.query.filter_by(name=name, afl_team=team).first()
    if player:
        return player

    # Surname fallback
    if " " in name:
        surname = name.split()[-1]
        candidates = AflPlayer.query.filter(
            AflPlayer.afl_team == team,
            AflPlayer.name.ilike(f"% {surname}"),
        ).all()
        if len(candidates) == 1:
            return candidates[0]

    return None


def sync_lineups_to_db(year: int, afl_round: int) -> int:
    """Fetch lineups from fitzRoy and upsert into AflTeamSelection.

    Deletes existing data for the round, then inserts fresh.
    Returns the number of rows inserted.
    """
    from models.database import db, AflPlayer, AflTeamSelection

    rows = fetch_team_lineups(year, afl_round)
    if not rows:
        logger.warning("No lineup data to sync for %d R%d", year, afl_round)
        return 0

    # Delete existing selections for this round
    AflTeamSelection.query.filter_by(year=year, afl_round=afl_round).delete()
    db.session.flush()

    count = 0
    for row in rows:
        player = _match_player(row["player_name"], row["team"], AflPlayer)

        sel = AflTeamSelection(
            year=year,
            afl_round=afl_round,
            match_id=row["match_id"],
            afl_team=row["team"],
            player_id=player.id if player else None,
            player_name=row["player_name"],
            jumper_number=row["jumper_number"],
            position=row["position"],
            is_captain=row["is_captain"],
            team_type=row["team_type"],
        )
        db.session.add(sel)
        count += 1

    db.session.commit()
    logger.info("Synced %d lineup selections for %d R%d", count, year, afl_round)
    return count


def group_selections_by_line(selections: list) -> dict:
    """Group a list of AflTeamSelection objects by positional line.

    Returns: {line_name: [selection, ...]} in display order.
    """
    grouped = {line: [] for line in LINE_ORDER}

    for sel in selections:
        pos = sel.position or ""
        info = _POSITION_ORDER.get(pos)
        if info:
            line_name, sort_idx = info
        else:
            # Unknown position → Interchange
            line_name = "Interchange"
            sort_idx = 10

        sel._sort_idx = sort_idx
        grouped[line_name].append(sel)

    # Sort within each line by positional order
    for line in grouped:
        grouped[line].sort(key=lambda s: getattr(s, "_sort_idx", 99))

    # Remove empty groups
    return {k: v for k, v in grouped.items() if v}

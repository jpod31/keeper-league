"""Fetch state league stats from DFS Australia (dfsaustralia.com).

Supplements wheeloratings data with:
- SANFL 2026+ (wheeloratings doesn't cover yet)
- Coates Talent League / NAB (U18s) — all historical years

Data source: WordPress admin-ajax endpoints on dfsaustralia.com.
Summary endpoint gives per-game avgs; game logs give per-round detail
which we aggregate for richer stats (disposals, inside50s, rebound50s, clearances).
"""

import logging
import time
import requests
from models.database import db, AflPlayer, StateLeagueStat

logger = logging.getLogger(__name__)

_AJAX_URL = "https://dfsaustralia.com/wp-admin/admin-ajax.php"
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
_HEADERS = {"User-Agent": _UA}

# DFS Australia league keys → our competition codes
COMPETITIONS = {
    "SANFL": {"code": "sanfl", "seasons": list(range(2021, 2027))},
    "NAB":   {"code": "nab",   "seasons": [2019] + list(range(2021, 2027))},
}

# Abbreviation → full team name mappings
_SANFL_TEAMS = {
    "ADL": "Adelaide", "PORT": "Port Adelaide", "CNTRL": "Central District",
    "TIGERS": "Glenelg", "NORTH": "North Adelaide", "NWD": "Norwood",
    "SOUTH": "South Adelaide", "STURT": "Sturt", "WEST": "West Adelaide",
    "EAGLES": "Woodville-West Torrens",
}

_NAB_TEAMS = {
    "BPFC": "Bendigo Pioneers", "CCFC": "Calder Cannons",
    "DSFC": "Dandenong Stingrays", "ERFC": "Eastern Ranges",
    "GFFC": "Geelong Falcons", "GPFC": "Gippsland Power",
    "GWVRFC": "GWV Rebels", "MBFC": "Murray Bushrangers",
    "NKFC": "Northern Knights", "OCFC": "Oakleigh Chargers",
    "SDFC": "Sandringham Dragons", "WJFC": "Western Jets",
    "NTFC": "NT Thunder", "TDFC": "Tasmania Devils",
    # AFL academy teams
    "BLFC": "Brisbane Lions Academy", "GCFC": "Gold Coast Academy",
    "GWSFC": "GWS Giants Academy", "SSFC": "Sydney Swans Academy",
}

_TEAM_MAP = {**_SANFL_TEAMS, **_NAB_TEAMS}


def _resolve_team(abbr: str) -> str:
    """Convert team abbreviation to full name."""
    return _TEAM_MAP.get(abbr, abbr)


def _post(data: dict, retries: int = 3) -> dict:
    """POST to admin-ajax with retries."""
    for attempt in range(retries):
        try:
            resp = requests.post(_AJAX_URL, data=data, headers=_HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise


def _fetch_season(league: str, season: int) -> list[dict]:
    """Fetch player summary stats for a league/season."""
    result = _post({"action": "stateleague_page", "league": league, "season": season})
    return result.get("playerStats", [])


def _fetch_game_logs(player_id: str, league: str, season: int) -> list[dict]:
    """Fetch per-round game logs for a player."""
    result = _post({
        "action": "state_league_player_logs_call",
        "playerId": player_id,
        "league": league,
        "season": str(season),
    })
    return result.get("playerLogs", [])


def _safe_float(val) -> float | None:
    if val is None or val == "" or val == "NA":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _aggregate_logs(logs: list[dict]) -> dict:
    """Aggregate per-game logs into per-game averages.

    Returns a dict with averages matching our StateLeagueStat fields.
    Only includes fields available in the game logs.
    """
    if not logs:
        return {}

    n = len(logs)
    sums = {}
    fields = {
        "kicks": "kicks", "handballs": "handballs", "disposals": "disposals",
        "marks": "marks", "goals": "goals", "behinds": "behinds",
        "tackles": "tackles", "hitouts": "hitouts", "freesFor": "frees_for",
        "freesAgainst": "frees_against", "inside50s": "inside_fifties",
        "rebound50s": "rebounds", "totalClearances": "clearances",
        "dreamTeamPoints": "dreamteam_avg",
    }

    for log in logs:
        for src, dst in fields.items():
            val = _safe_float(log.get(src))
            if val is not None:
                sums[dst] = sums.get(dst, 0) + val

    avgs = {}
    for key, total in sums.items():
        avgs[key] = round(total / n, 1)

    return avgs


def _build_name_index():
    players = AflPlayer.query.all()
    idx = {}
    for p in players:
        idx[p.name.strip().lower()] = p.id
    return idx


def _match_player(name: str, afl_team: str | None, name_idx: dict) -> tuple[int | None, bool]:
    """Match to AFL player. Returns (player_id, is_afl_listed)."""
    is_listed = bool(afl_team)
    if not is_listed:
        return None, False

    key = name.strip().lower()
    if key in name_idx:
        return name_idx[key], True

    parts = key.split()
    if len(parts) >= 2:
        surname = parts[-1]
        first = parts[0]
        for full, pid in name_idx.items():
            fp = full.split()
            if len(fp) >= 2 and fp[-1] == surname and fp[0][0] == first[0]:
                return pid, True

    return None, True


def sync_dfsaustralia(league: str | None = None, season: int | None = None,
                      fetch_logs: bool = True) -> int:
    """Sync state league stats from DFS Australia.

    Args:
        league: 'SANFL' or 'NAB' (None = all)
        season: specific year (None = all configured years)
        fetch_logs: if True, fetch per-game logs for richer stats (slower but better data)

    Returns:
        Number of rows synced.
    """
    name_idx = _build_name_index()
    total = 0

    leagues = {league: COMPETITIONS[league]} if league and league in COMPETITIONS else COMPETITIONS

    for lg, cfg in leagues.items():
        comp_code = cfg["code"]
        year_list = [season] if season else cfg["seasons"]

        for yr in year_list:
            try:
                players = _fetch_season(lg, yr)
            except Exception as e:
                logger.warning("Failed to fetch %s/%s: %s", lg, yr, e)
                continue

            logger.info("Fetched %d players for %s/%s", len(players), lg, yr)

            for p in players:
                pname = p.get("playerName")
                if not pname:
                    continue

                team = _resolve_team(p.get("teamAbbr", ""))
                afl_team = p.get("aflTeam")
                pid, is_listed = _match_player(pname, afl_team, name_idx)
                matches = int(p.get("gms") or 0)
                player_dfs_id = p.get("playerId")  # e.g. "CD_I990606"

                # Start with summary data
                row_data = {
                    "kicks": _safe_float(p.get("kicks")),
                    "handballs": _safe_float(p.get("handballs")),
                    "marks": _safe_float(p.get("marks")),
                    "tackles": _safe_float(p.get("tackles")),
                    "hitouts": _safe_float(p.get("hitouts")),
                    "frees_for": _safe_float(p.get("freesFor")),
                    "frees_against": _safe_float(p.get("freesAgainst")),
                    "goals": _safe_float(p.get("goals")),
                    "behinds": _safe_float(p.get("behinds")),
                    "dreamteam_avg": _safe_float(p.get("FP")),
                }

                # Fetch game logs for richer stats (disposals, inside50s, clearances, etc.)
                if fetch_logs and player_dfs_id and matches > 0:
                    try:
                        logs = _fetch_game_logs(player_dfs_id, lg, yr)
                        if logs:
                            log_avgs = _aggregate_logs(logs)
                            # Log data overrides summary data where available
                            row_data.update(log_avgs)
                            # Compute derived fields
                            k = row_data.get("kicks") or 0
                            h = row_data.get("handballs") or 0
                            if k + h > 0:
                                row_data["disposals"] = round(k + h, 1)
                                row_data["kick_percentage"] = round(k / (k + h) * 100, 1)
                            # Total possessions ≈ disposals (no contested/uncontested split available)
                            if row_data.get("disposals"):
                                row_data["total_possessions"] = row_data["disposals"]
                        time.sleep(0.15)  # be polite
                    except Exception as e:
                        logger.debug("Failed to fetch logs for %s: %s", pname, e)

                # Goals in summary are per-game avg; keep consistent
                # goals_avg = per-game, goals = season total (matching wheeloratings convention)
                goals_avg = row_data.get("goals")
                if goals_avg is not None and matches:
                    row_data["goals_avg"] = goals_avg
                    row_data["goals"] = round(goals_avg * matches, 1)

                # Upsert
                existing = StateLeagueStat.query.filter_by(
                    player_name=pname, competition=comp_code, season=yr, team=team
                ).first()

                if existing:
                    obj = existing
                else:
                    obj = StateLeagueStat(
                        player_name=pname, competition=comp_code, season=yr, team=team
                    )
                    db.session.add(obj)

                obj.player_id = pid
                obj.is_afl_listed = is_listed
                obj.matches = matches

                for field, val in row_data.items():
                    if val is not None:
                        setattr(obj, field, val)

                total += 1

            db.session.commit()
            logger.info("Committed %s/%s", lg, yr)

    logger.info("DFS Australia sync complete: %d rows", total)
    return total

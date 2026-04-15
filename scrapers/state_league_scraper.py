"""Fetch state league stats (VFL/SANFL/WAFL) from wheeloratings.com."""

import logging
import requests
from models.database import db, AflPlayer, StateLeagueStat

logger = logging.getLogger(__name__)

_BASE = "https://www.wheeloratings.com/src/afl_stats/player_stats/{comp}/{season}.json"
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

COMPETITIONS = {
    "vfl": list(range(2021, 2027)),
    "sanfl": list(range(2022, 2027)),
    "wafl": list(range(2022, 2027)),
}

_COL_MAP = {
    "Player": "player_name",
    "Team": "team",
    "Age": "age",
    "Matches": "matches",
    "IsAFLListedPlayer": "is_afl_listed",
    "Kicks": "kicks",
    "Handballs": "handballs",
    "Disposals": "disposals",
    "Marks": "marks",
    "Goals_Total": "goals",
    "Goals_Avg": "goals_avg",
    "Behinds": "behinds",
    "Tackles": "tackles",
    "Hitouts": "hitouts",
    "ContestedPossessions": "contested_possessions",
    "UncontestedPossessions": "uncontested_possessions",
    "TotalClearances": "clearances",
    "Inside50s": "inside_fifties",
    "Rebound50s": "rebounds",
    "DisposalEfficiency": "disposal_efficiency",
    "Intercepts": "intercepts",
    "ScoreInvolvements": "score_involvements",
    "ScoreInvolvementPercentage": "score_involvement_pct",
    "FreesFor": "frees_for",
    "FreesAgainst": "frees_against",
    "ContestedMarks": "contested_marks",
    "TacklesInside50": "tackles_inside_50",
    "DreamTeamPoints_Avg": "dreamteam_avg",
    "TotalPossessions": "total_possessions",
    "KickPercentage": "kick_percentage",
    "ContestedPossessionRate": "contested_possession_rate",
}


def _fetch_json(comp: str, season: int) -> list[dict]:
    url = _BASE.format(comp=comp, season=season)
    resp = requests.get(url, headers={"User-Agent": _UA}, timeout=30)
    resp.raise_for_status()
    raw = resp.json().get("Data", {})
    if not raw:
        return []
    keys = list(raw.keys())
    n = len(raw[keys[0]])
    rows = []
    for i in range(n):
        row = {}
        for k in keys:
            if k in _COL_MAP:
                row[_COL_MAP[k]] = raw[k][i]
        rows.append(row)
    return rows


def _build_name_index():
    players = AflPlayer.query.all()
    idx = {}
    for p in players:
        idx[p.name.strip().lower()] = p.id
    return idx


def _match_player(name: str, is_afl_listed, name_idx: dict) -> int | None:
    if not is_afl_listed:
        return None
    key = name.strip().lower()
    if key in name_idx:
        return name_idx[key]
    parts = key.split()
    if len(parts) >= 2:
        surname = parts[-1]
        first = parts[0]
        for full, pid in name_idx.items():
            fp = full.split()
            if len(fp) >= 2 and fp[-1] == surname and fp[0][0] == first[0]:
                return pid
    return None


def sync_state_league_stats(comp: str | None = None, season: int | None = None) -> int:
    name_idx = _build_name_index()
    total = 0
    comps = {comp: COMPETITIONS[comp]} if comp and comp in COMPETITIONS else COMPETITIONS
    for c, seasons in comps.items():
        year_list = [season] if season else seasons
        for yr in year_list:
            try:
                rows = _fetch_json(c, yr)
            except Exception as e:
                logger.warning("Failed to fetch %s/%s: %s", c, yr, e)
                continue
            logger.info("Fetched %d rows for %s/%s", len(rows), c, yr)
            for row in rows:
                pname = row.get("player_name")
                if not pname:
                    continue
                team = row.get("team", "")
                # Sandringham rebranded to St Kilda VFL in 2026
                if team == "Sandringham" and yr >= 2026:
                    team = "St Kilda"
                is_listed = bool(row.get("is_afl_listed"))
                pid = _match_player(pname, is_listed, name_idx)
                existing = StateLeagueStat.query.filter_by(
                    player_name=pname, competition=c, season=yr, team=team
                ).first()
                if existing:
                    obj = existing
                else:
                    obj = StateLeagueStat(player_name=pname, competition=c, season=yr, team=team)
                    db.session.add(obj)
                obj.player_id = pid
                obj.is_afl_listed = is_listed
                for field in [
                    "age", "matches", "kicks", "handballs", "disposals", "marks",
                    "goals", "goals_avg", "behinds", "tackles", "hitouts",
                    "contested_possessions", "uncontested_possessions", "clearances",
                    "inside_fifties", "rebounds", "disposal_efficiency", "intercepts",
                    "score_involvements", "score_involvement_pct", "frees_for",
                    "frees_against", "contested_marks", "tackles_inside_50",
                    "dreamteam_avg", "total_possessions", "kick_percentage",
                    "contested_possession_rate",
                ]:
                    val = row.get(field)
                    if val is not None and val != "NA" and val != "":
                        try:
                            setattr(obj, field, float(val))
                        except (ValueError, TypeError):
                            pass
                total += 1
            db.session.commit()
    logger.info("Synced %d state league stat rows total", total)
    return total

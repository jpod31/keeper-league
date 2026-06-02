"""Centre Bounce Attendance (CBA) % from DFS Australia (dfsaustralia.com/afl-cbas).

CBA% is the share of a team's centre bounces a player attends — the cleanest
public signal of a genuine midfield role (and therefore fantasy scoring upside).

Data source: WordPress admin-ajax action `afl_cbas_call_new_mysql`, one POST per
team ({action, season, team}) → {"cbas": [{playerName, playerId, position,
avg (season CBA%), G1..G24 counts, G0avg..G24avg per-round %}]}.

Stores the season-average CBA% on AflPlayer.cba_pct. Players in our master list
who don't appear on any team's CBA list are set to 0 (they don't attend centre
bounces). Every CBA-listed player is name-matched to the master list; unmatched
names are reported so they can be reconciled.
"""

import logging
import time
import unicodedata
import requests

from config import CURRENT_YEAR
from models.database import db, AflPlayer

logger = logging.getLogger(__name__)

_AJAX_URL = "https://dfsaustralia.com/wp-admin/admin-ajax.php"
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

TEAMS = ["ADE", "BRL", "CAR", "COL", "ESS", "FRE", "GCS", "GEE", "GWS",
         "HAW", "MEL", "NTH", "PTA", "RIC", "STK", "SYD", "WBD", "WCE"]


def _norm(name: str) -> str:
    """Normalise a name for matching: curly→straight apostrophe, strip accents,
    drop periods, lowercase, collapse whitespace."""
    n = (name or "").replace("’", "'")
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode("ascii")
    return " ".join(n.lower().replace(".", "").split())


def _round_trend(r, season_avg):
    """Recent-vs-season CBA% trend = mean(last 3 rounds that happened) − season
    avg. Positive = midfield role rising, negative = role shrinking. None if too
    few rounds. Uses G{n}team>0 to tell which rounds actually happened."""
    happened = []
    for n in range(1, 25):
        team = r.get(f"G{n}team")
        try:
            team_n = int(team) if team not in (None, "") else 0
        except (TypeError, ValueError):
            team_n = 0
        if team_n <= 0:
            continue
        pa = r.get(f"G{n}avg")
        try:
            happened.append(float(pa) if pa not in (None, "") else 0.0)
        except (TypeError, ValueError):
            happened.append(0.0)
    if len(happened) < 6:
        return None
    recent = sum(happened[-3:]) / 3
    return round(recent - season_avg, 1)


def _fetch_team(season, team, retries=3):
    for attempt in range(retries):
        try:
            resp = requests.post(_AJAX_URL,
                                 data={"action": "afl_cbas_call_new_mysql", "season": season, "team": team},
                                 headers={"User-Agent": _UA}, timeout=30)
            resp.raise_for_status()
            return resp.json().get("cbas", []) or []
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            logger.warning("CBA fetch failed for %s %s: %s", team, season, e)
            return []


def sync_cbas(season=None):
    """Fetch CBA% for all 18 teams and write AflPlayer.cba_pct. Returns a report
    dict including the list of unmatched CBA names for validation."""
    season = season or CURRENT_YEAR

    # 1. Gather CBA% per player across all teams
    cba = {}  # norm_name -> {name, avg, position, team}
    for team in TEAMS:
        for r in _fetch_team(season, team):
            name = r.get("playerName")
            if not name:
                continue
            try:
                avg = float(r.get("avg") or 0)
            except (TypeError, ValueError):
                avg = 0.0
            cba[_norm(name)] = {"name": name, "avg": round(avg, 1),
                                "trend": _round_trend(r, avg),
                                "position": r.get("position"), "team": team}
        time.sleep(0.4)

    if not cba:
        logger.warning("CBA sync %s: no data returned", season)
        return {"season": season, "cba_players": 0, "matched": 0, "unmatched": [], "zeroed": 0}

    # 2. Master lookup — exact normalised name, with a last-name + first-initial
    #    fallback (handles nickname forms: Cam/Cameron, Mitch/Mitchell, …) applied
    #    only when exactly one master player matches, so it can't mis-assign.
    masters = AflPlayer.query.all()
    by_norm = {}
    by_key2 = {}

    def _key2(name):
        parts = _norm(name).split()
        return (parts[-1], parts[0][0]) if len(parts) >= 2 else None

    for p in masters:
        by_norm.setdefault(_norm(p.name), []).append(p)
        k = _key2(p.name)
        if k:
            by_key2.setdefault(k, []).append(p)

    matched, fuzzy, unmatched = 0, 0, []
    matched_ids = set()
    for nn, info in cba.items():
        cands = by_norm.get(nn)
        if not cands:
            k2 = _key2(info["name"])
            alt = by_key2.get(k2, []) if k2 else []
            if len(alt) == 1:
                cands = alt
                fuzzy += 1
            else:
                unmatched.append(info["name"])
                continue
        for p in cands:
            p.cba_pct = info["avg"]
            p.cba_trend = info["trend"]
            matched_ids.add(p.id)
        matched += 1

    # 3. Anyone in master not on a CBA list → 0 (doesn't attend centre bounces)
    zeroed = 0
    for p in masters:
        if p.id not in matched_ids and p.cba_pct != 0:
            p.cba_pct = 0.0
            zeroed += 1

    db.session.commit()
    report = {"season": season, "cba_players": len(cba), "matched": matched,
              "fuzzy": fuzzy, "unmatched": sorted(unmatched), "zeroed": zeroed}
    logger.info("CBA sync %s: %d listed, %d matched (%d via fallback), %d unmatched, %d zeroed",
                season, len(cba), matched, fuzzy, len(unmatched), zeroed)
    return report


if __name__ == "__main__":
    import sys
    from app import create_app
    app = create_app()
    with app.app_context():
        yr = int(sys.argv[1]) if len(sys.argv) > 1 else None
        rep = sync_cbas(yr)
        print(f"season={rep['season']} listed={rep['cba_players']} matched={rep['matched']} "
              f"(fallback={rep.get('fuzzy', 0)}) zeroed={rep['zeroed']} unmatched={len(rep['unmatched'])}")
        if rep["unmatched"]:
            print("UNMATCHED CBA names (need reconciliation):")
            for n in rep["unmatched"]:
                print("  -", n)

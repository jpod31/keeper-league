"""Kick-ins from DFS Australia (dfsaustralia.com/afl-kickins).

Who takes his club's kick-ins matters in SuperCoach: a kick-in he plays on
from counts as a kick. Same source shape as the CBA page: WordPress
admin-ajax action `afl_kickins_new_call`, one POST per team ({action, season,
team}) -> {"kickins": [{playerName, KI, PO, POpercentage, KI_G0.., PO_G0..}],
"games": [...]}. A game value of null means he did not play that game; "0"
means he played and took none. Only players who took a kick-in that season
are listed.

Writes three AflPlayer columns:
  kick_in_pct         his share of his club's kick-ins in the games he played
  kick_in_playon_pct  the share of his kick-ins he played on from
  kick_ins_season     kick-ins taken that season
A player on no club's list is set to 0 / None / 0.

The season is `stats_year()` (the latest season with games), not
CURRENT_YEAR, so it never blanks between the AFL draft and Opening Round.
"""

import logging
import time

import requests

from models.database import db, AflPlayer
from scrapers.cba_scraper import TEAMS, _norm

logger = logging.getLogger(__name__)

_AJAX_URL = "https://dfsaustralia.com/wp-admin/admin-ajax.php"
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# dfsaustralia's club codes, for settling a near-match by club.
CLUB = {"ADE": "Adelaide", "BRL": "Brisbane Lions", "CAR": "Carlton", "COL": "Collingwood",
        "ESS": "Essendon", "FRE": "Fremantle", "GCS": "Gold Coast", "GEE": "Geelong",
        "GWS": "GWS", "HAW": "Hawthorn", "MEL": "Melbourne", "NTH": "North Melbourne",
        "PTA": "Port Adelaide", "RIC": "Richmond", "STK": "St Kilda", "SYD": "Sydney",
        "WBD": "Western Bulldogs", "WCE": "West Coast"}


def _fetch_team(season, team, retries=3):
    for attempt in range(retries):
        try:
            resp = requests.post(_AJAX_URL,
                                 data={"action": "afl_kickins_new_call", "season": season, "team": team},
                                 headers={"User-Agent": _UA}, timeout=30)
            resp.raise_for_status()
            d = resp.json()
            return d.get("kickins", []) or [], d.get("games", []) or []
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            logger.warning("Kick-in fetch failed for %s %s: %s", team, season, e)
            return [], []


def _int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def team_shares(rows, n_games):
    """Per player on one club: kick-ins taken, play-ons, and the club's
    kick-ins in the games he played. Pure, for testing."""
    per_game = [0] * n_games
    for r in rows:
        for i in range(n_games):
            v = _int(r.get(f"KI_G{i}"))
            if v:
                per_game[i] += v
    out = {}
    for r in rows:
        name = r.get("playerName")
        if not name:
            continue
        played = [i for i in range(n_games) if _int(r.get(f"KI_G{i}")) is not None]
        out[name] = {
            "ki": _int(r.get("KI")) or 0,
            "po": _int(r.get("PO")) or 0,
            "team_ki": sum(per_game[i] for i in played),
        }
    return out


def sync_kickins(season=None):
    """Fetch kick-ins for all 18 clubs and write the AflPlayer columns.
    Returns a report including unmatched names."""
    if season is None:
        from models.years import stats_year
        season = stats_year()

    # A player traded mid-season can appear for two clubs: add them up.
    agg = {}   # norm name -> {name, ki, po, team_ki}
    for team in TEAMS:
        rows, games = _fetch_team(season, team)
        for name, v in team_shares(rows, len(games)).items():
            a = agg.setdefault(_norm(name), {"name": name, "ki": 0, "po": 0, "team_ki": 0, "clubs": set()})
            a["clubs"].add(CLUB.get(team))
            a["ki"] += v["ki"]; a["po"] += v["po"]; a["team_ki"] += v["team_ki"]
        time.sleep(0.4)

    if not agg:
        logger.warning("Kick-in sync %s: no data returned", season)
        return {"season": season, "listed": 0, "matched": 0, "unmatched": [], "zeroed": 0}

    # Same matching as the CBA sync: exact normalised name, else surname plus
    # first initial when exactly one player fits, or exactly one at his club.
    masters = AflPlayer.query.all()
    by_norm, by_key2 = {}, {}

    def _key2(name):
        parts = _norm(name).split()
        return (parts[-1], parts[0][0]) if len(parts) >= 2 else None

    for p in masters:
        by_norm.setdefault(_norm(p.name), []).append(p)
        k = _key2(p.name)
        if k:
            by_key2.setdefault(k, []).append(p)

    matched, fuzzy, unmatched, seen = 0, 0, [], set()
    for nn, a in agg.items():
        cands = by_norm.get(nn)
        if not cands:
            k2 = _key2(a["name"])
            alt = by_key2.get(k2, []) if k2 else []
            if len(alt) > 1:   # "Lachie Jones": two L. Joneses, one at his club
                alt = [p for p in alt if p.afl_team in a["clubs"]]
            if len(alt) == 1:
                cands, fuzzy = alt, fuzzy + 1
            else:
                unmatched.append(a["name"])
                continue
        for p in cands:
            p.kick_ins_season = a["ki"]
            p.kick_in_pct = round(a["ki"] / a["team_ki"] * 100, 1) if a["team_ki"] else 0.0
            p.kick_in_playon_pct = round(a["po"] / a["ki"] * 100, 1) if a["ki"] else None
            seen.add(p.id)
        matched += 1

    zeroed = 0
    for p in masters:
        if p.id not in seen and (p.kick_in_pct != 0 or p.kick_ins_season != 0):
            p.kick_in_pct, p.kick_in_playon_pct, p.kick_ins_season = 0.0, None, 0
            zeroed += 1

    db.session.commit()
    report = {"season": season, "listed": len(agg), "matched": matched, "fuzzy": fuzzy,
              "unmatched": sorted(unmatched), "zeroed": zeroed}
    logger.info("Kick-in sync %s: %d listed, %d matched (%d via fallback), %d unmatched, %d zeroed",
                season, len(agg), matched, fuzzy, len(unmatched), zeroed)
    return report


if __name__ == "__main__":
    import sys
    from app import create_app
    app = create_app()
    with app.app_context():
        yr = int(sys.argv[1]) if len(sys.argv) > 1 else None
        rep = sync_kickins(yr)
        print(f"season={rep['season']} listed={rep['listed']} matched={rep['matched']} "
              f"(fallback={rep.get('fuzzy', 0)}) zeroed={rep['zeroed']} unmatched={len(rep['unmatched'])}")
        for n in rep["unmatched"]:
            print("  -", n)
        top = (AflPlayer.query.filter(AflPlayer.kick_ins_season > 0)
               .order_by(AflPlayer.kick_in_pct.desc()).limit(12).all())
        for p in top:
            print(f"  {p.name:24} {p.afl_team:18} {p.kick_in_pct:5.1f}% of club, "
                  f"{p.kick_ins_season} taken, played on {p.kick_in_playon_pct}%")

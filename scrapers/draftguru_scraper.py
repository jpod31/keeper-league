"""Fetch AFL list/draft history per player from draftguru.com.au.

This is the authoritative source for a player's AFL club BY YEAR, including
seasons they were on a club's list but played zero senior games (e.g. a
delisted-then-redrafted player like Hugo Hall-Kahan: Sydney 2022-23, delisted,
Adelaide 2026). AFL match-stats feeds are games-only and miss those years; the
only other signal is the reserves-team name, which is unreliable (a delisted
player can play VFL for a non-aligned club such as Williamstown).

draftguru player page has an "AFL Career" table; each year row carries
Year | Age | Club | # | List | Grade | Games | ... where the Club column is the
AFL club that season (blank when not on an AFL list that year).
"""

import logging
import re
import time
import requests

logger = logging.getLogger(__name__)

_BASE = "https://www.draftguru.com.au"
_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/120 Safari/537.36")
_HEADERS = {"User-Agent": _UA}

# Current AFL club slugs on draftguru (Fitzroy etc. omitted — defunct).
_CLUB_SLUGS = [
    "adelaide", "brisbane", "carlton", "collingwood", "essendon", "fremantle",
    "geelong", "gold-coast", "greater-western-sydney", "hawthorn", "melbourne",
    "north-melbourne", "port-adelaide", "richmond", "st-kilda", "sydney",
    "west-coast", "western-bulldogs",
]

# draftguru club name -> our canonical TEAM_LOGOS key (only the differing ones).
_CLUB_ALIASES = {
    "brisbane": "Brisbane Lions",
    "greater western sydney": "GWS",
}


def _valid_clubs():
    try:
        import config
        return list(config.TEAM_LOGOS.keys())
    except Exception:
        return []


def _canon_club(name, valid_clubs):
    """Normalise a draftguru club name to our canonical club key, or None."""
    if not name:
        return None
    raw = name.strip()
    if not raw:
        return None
    low = raw.lower()
    if low in _CLUB_ALIASES:
        return _CLUB_ALIASES[low]
    for c in valid_clubs:
        if c.lower() == low:
            return c
    return raw  # unknown (e.g. a defunct club) — keep raw; no logo will resolve


def _get(url):
    resp = requests.get(url, headers=_HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def _clean(cell_html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cell_html)).replace("\xa0", " ").strip()


def build_player_url_index():
    """Map lower-cased player name -> draftguru player URL path, from club pages."""
    idx = {}
    for slug in _CLUB_SLUGS:
        try:
            html = _get(f"{_BASE}/clubs/{slug}")
        except Exception as e:
            logger.warning("draftguru club page %s failed: %s", slug, e)
            continue
        for path, label in re.findall(r'href="(/players/[^"]+)"[^>]*>([^<]+)</a>', html):
            nm = _clean(label).lower()
            if nm and path:
                idx.setdefault(nm, path)
        time.sleep(0.2)
    logger.info("draftguru: indexed %d player URLs", len(idx))
    return idx


def fetch_player_list_history(url_path, valid_clubs=None):
    """Parse a player page into AFL list seasons.

    Returns [{"season": int, "club": str, "list_type": str|None, "games": int}]
    for each year the player was on an AFL club's list (Club column populated).
    """
    if valid_clubs is None:
        valid_clubs = _valid_clubs()
    html = _get(_BASE + url_path)
    m = re.search(r"<table.*?</table>", html, re.S)
    if not m:
        return []
    out = []
    for rw in re.findall(r"<tr.*?</tr>", m.group(0), re.S):
        cells = [_clean(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", rw, re.S)]
        if len(cells) < 7:
            continue  # movement/spacer row ("Drafted by ...", "Delisted")
        if not re.fullmatch(r"\d{4}", cells[0]):
            continue  # header or non-year row
        club = _canon_club(cells[2], valid_clubs)
        if not club:
            continue  # blank Club column = not on an AFL list that year
        list_type = (cells[4] or "").lower() or None
        games = int(cells[6]) if cells[6].isdigit() else 0
        out.append({
            "season": int(cells[0]),
            "club": club,
            "list_type": list_type,
            "games": games,
        })
    return out


def sync_draftguru_list_history(limit=None):
    """Backfill AflListHistory for every AflPlayer matched by name on draftguru.

    Returns (players_matched, rows_written).
    """
    from models.database import db, AflPlayer, AflListHistory

    valid_clubs = _valid_clubs()
    idx = build_player_url_index()
    players = AflPlayer.query.all()
    matched = 0
    rows_written = 0
    for i, p in enumerate(players):
        if limit and matched >= limit:
            break
        url = idx.get((p.name or "").strip().lower())
        if not url:
            continue
        try:
            seasons = fetch_player_list_history(url, valid_clubs)
        except Exception as e:
            logger.warning("draftguru fetch failed for %s: %s", p.name, e)
            continue
        if not seasons:
            continue
        matched += 1
        # Replace this player's rows so re-runs stay idempotent.
        AflListHistory.query.filter_by(player_id=p.id).delete()
        for s in seasons:
            db.session.add(AflListHistory(
                player_id=p.id,
                player_name=p.name,
                season=s["season"],
                club=s["club"],
                list_type=s["list_type"],
                games=s["games"],
                source="draftguru",
            ))
            rows_written += 1
        db.session.commit()
        time.sleep(0.25)
    logger.info("draftguru sync: %d players matched, %d rows", matched, rows_written)
    return matched, rows_written

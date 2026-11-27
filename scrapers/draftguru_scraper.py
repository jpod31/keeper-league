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

import html as _html
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
    txt = re.sub(r"<[^>]+>", " ", cell_html)
    txt = _html.unescape(txt)            # &nbsp; -> \xa0, &amp; -> &, etc.
    txt = txt.replace("\xa0", " ")
    return re.sub(r"\s+", " ", txt).strip()


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
            path = _html.unescape(path)  # &#39; -> ' so apostrophe names resolve
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
    from sqlalchemy.exc import IntegrityError
    from models.database import db, AflPlayer, AflListHistory

    valid_clubs = _valid_clubs()
    idx = build_player_url_index()
    players = AflPlayer.query.all()
    matched = 0
    rows_written = 0
    seen_names = set()
    for p in players:
        if limit and matched >= limit:
            break
        name_key = (p.name or "").strip().lower()
        url = idx.get(name_key)
        if not url:
            continue
        # The unique constraint is on (player_name, season, club). Duplicate
        # real-world names (e.g. two "Max King"s) resolve to one draftguru URL
        # and would collide — process each name once.
        if name_key in seen_names:
            continue
        seen_names.add(name_key)
        try:
            seasons = fetch_player_list_history(url, valid_clubs)
        except Exception as e:
            logger.warning("draftguru fetch failed for %s: %s", p.name, e)
            continue
        if not seasons:
            continue
        # Idempotent: clear any prior rows for this player (by id AND name, so
        # re-runs and name-collisions don't duplicate or crash).
        AflListHistory.query.filter(
            db.or_(AflListHistory.player_id == p.id,
                   AflListHistory.player_name == p.name)
        ).delete(synchronize_session=False)
        seen_rows = set()
        added = 0
        for s in seasons:
            key = (p.name, s["season"], s["club"])
            if key in seen_rows:
                continue
            seen_rows.add(key)
            db.session.add(AflListHistory(
                player_id=p.id,
                player_name=p.name,
                season=s["season"],
                club=s["club"],
                list_type=s["list_type"],
                games=s["games"],
                source="draftguru",
            ))
            added += 1
        try:
            db.session.commit()
        except IntegrityError as e:
            db.session.rollback()
            logger.warning("draftguru commit failed for %s: %s", p.name, e)
            continue
        matched += 1
        rows_written += added
        time.sleep(0.25)
    logger.info("draftguru sync: %d players matched, %d rows", matched, rows_written)
    return matched, rows_written


# ── Player profile facts for the pre-AFL card (2026-11-26) ───────────────
# Lucas: "why doesnt someone like Heath Mellody have any junior stats!??!".
# WA draftees come through WAFL Colts and the U18 championships, which no
# stats source we use covers. draftguru has every draftee's pathway and
# junior honours, so a new player's card can still say who he is.

def parse_player_profile(html):
    """{honours, origin, draft_note, height_cm} from a draftguru player page."""
    out = {"honours": None, "origin": None, "draft_note": None, "height_cm": None}
    m = re.search(r'<div class="player-bits">\s*<p[^>]*>\s*<em>(.*?)</em>\s*</p>', html, re.S)
    if m:
        txt = _clean(m.group(1))
        if txt and not txt.lower().startswith("born"):
            out["honours"] = txt
    m = re.search(r"<em>Originally from: </em>(.*?)</p>", html, re.S)
    if m:
        parts = [p for p in (_clean(x) for x in re.split(r"<em>\s*/\s*(?:&#8203;|\u200b)?\s*</em>", m.group(1))) if p]
        out["origin"] = " / ".join(parts) or None
    m = re.search(r"<em>Height: </em>\s*(\d{3})cm", html)
    if m:
        out["height_cm"] = int(m.group(1))
    m = re.search(r'href="/years/(\d{4})">Drafted by (.+?) with (.+?) pick #(\d+)<', html)
    if m:
        year, club, kind, pick = m.groups()
        out["draft_note"] = f"Pick {pick}, {year} {_clean(kind)}, {_clean(club)}"
    return out


def sync_draftguru_profiles(only_new=True):
    """Fill junior_origin, junior_honours, draft_note (and a missing height)
    for players with no AFL games yet. Returns players updated."""
    from models.database import db, AflPlayer
    idx = build_player_url_index()
    q = AflPlayer.query.filter(AflPlayer.listed())
    if only_new:
        q = q.filter(db.or_(AflPlayer.career_games.is_(None), AflPlayer.career_games == 0))
    n = 0
    for p in q.all():
        url = idx.get((p.name or "").strip().lower())
        if not url:
            continue
        try:
            facts = parse_player_profile(_get(_BASE + url))
        except Exception as e:
            logger.warning("draftguru profile failed for %s: %s", p.name, e)
            continue
        p.junior_origin = facts["origin"]
        p.junior_honours = facts["honours"]
        p.draft_note = facts["draft_note"]
        if not p.height_cm and facts["height_cm"]:
            p.height_cm = facts["height_cm"]
        n += 1
        time.sleep(0.25)
    db.session.commit()
    logger.info("draftguru profiles: %d players", n)
    return n


DRAFT_KINDS = (("national_draft", "national"), ("rookie_draft", "rookie"))


def fetch_draft_year(year):
    """[{kind, pick, club, name, url}] for one year's national and rookie
    drafts (draftguru /years/<year>/<kind>), every pick including players
    delisted since."""
    out = []
    for page, kind in DRAFT_KINDS:
        try:
            html = _get(f"{_BASE}/years/{year}/{page}")
        except Exception as e:
            logger.warning("draftguru %s %s failed: %s", year, page, e)
            continue
        m = re.search(r"<table.*?</table>", html, re.S)
        if not m:
            continue
        for rw in re.findall(r"<tr.*?</tr>", m.group(0), re.S):
            cells = [_clean(c).replace("\u200b", "") for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", rw, re.S)]
            link = re.findall(r'href="(/players/[^"]+)"', rw)
            if len(cells) < 5 or not cells[1].isdigit() or not link:
                continue
            out.append({"kind": kind, "pick": int(cells[1]), "club": cells[2], "name": cells[4],
                        "url": _html.unescape(link[0])})
        time.sleep(0.3)
    return out


def _season_games(url_path, season):
    total = None
    for r in fetch_player_list_history(url_path):
        if r["season"] == season:
            total = (total or 0) + r["games"]
    return total or 0


def sync_draft_history(first=2019, last=None):
    """Fill draft_history from FIRST to LAST (default: the latest finished
    season's draft year). A player we hold is matched by name (nickname
    variants too) and draft year, and his first-season games come from our
    list history; anyone else's from his draftguru page. Returns rows written."""
    from models.database import db, AflPlayer, AflListHistory, DraftHistory
    from models.player_sync import norm, variants
    from models.years import stats_year
    last = last or stats_year() - 1
    by = {}
    for q in AflPlayer.query.all():
        by.setdefault(norm(q.name), []).append(q)

    def find(name, year):
        for k in [norm(name)] + variants(name):
            c = by.get(k, [])
            exact = [q for q in c if q.draft_year == year]
            if exact:
                return exact[0]
            if len(c) == 1 and c[0].draft_year in (None, year):
                return c[0]
        return None

    written = 0
    for year in range(first, last + 1):
        for r in fetch_draft_year(year):
            row = DraftHistory.query.filter_by(year=year, kind=r["kind"], pick=r["pick"]).first()
            if row and row.g1 is not None:
                continue
            q = find(r["name"], year)
            done = year + 1 <= stats_year()
            g1 = None
            if done:
                if q:
                    g1 = db.session.query(db.func.coalesce(db.func.sum(AflListHistory.games), 0)).filter(
                        AflListHistory.player_id == q.id, AflListHistory.season == year + 1).scalar() or 0
                else:
                    try:
                        g1 = _season_games(r["url"], year + 1)
                    except Exception:
                        logger.warning("draftguru player %s failed", r["url"], exc_info=True)
                    time.sleep(0.25)
            if not row:
                row = DraftHistory(year=year, kind=r["kind"], pick=r["pick"])
                db.session.add(row)
            row.club, row.name, row.url = r["club"], r["name"], r["url"]
            row.player_id = q.id if q else None
            row.g1 = g1
            written += 1
        db.session.commit()
    logger.info("draft history: %d rows written", written)
    return written

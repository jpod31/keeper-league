"""Junior and state-league numbers for players our main feeds miss.

Lucas, 2026-11-26: "why doesnt someone like Heath Mellody have any junior
stats!??! ... we need to look around other sites, and also we dont even have
state championships anywhere".

DFS Australia (scrapers/dfsaustralia_scraper.py) covers the Talent League and
SANFL under-18s. Nothing we used covered Western Australia or the under-18
national championships. Two public sites do:

  wafl.com.au/player/<slug>              WAFL Colts, Reserves and League season
                                         totals (Season, Competition, Club,
                                         Matches, K H D AVG M T HO FF FA G B)
  central.rookieme.com/afl/player/<slug>  Rookie Me Central (formerly AFL Draft
                                         Central): AFL U18 Championships and
                                         other junior tables, totals plus
                                         per-game averages; DC is its fantasy
                                         average

Both are fetched per player for listed players with no AFL games (the ones
the Before the AFL card is for). Rows go into state_league_stat as per-game
averages, like every other competition there. A row we already hold from a
feed (same name, competition, season) is left alone.
"""

import html as _html
import logging
import re
import time
import unicodedata

import requests

logger = logging.getLogger(__name__)

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120 Safari/537.36"}

WAFL_COMPS = {"colts": "waflcolts", "reserves": "waflres", "league": "wafl"}
ROOKIEME_COMPS = {
    "afl u18 championships": "u18champs",
    "wafl colts": "waflcolts",
    "sanfl u18": "sanflu18",
    "sanfl under 18": "sanflu18",
    "coates talent league": "nab",
    "nab league": "nab",
}


def slug(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = s.replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _clean(cell):
    t = _html.unescape(re.sub(r"<[^>]+>", " ", cell)).replace("\xa0", " ")
    return re.sub(r"\s+", " ", t).strip()


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _get(url):
    r = requests.get(url, headers=_HEADERS, timeout=30)
    return r.status_code, r.text


# ── wafl.com.au ──────────────────────────────────────────────────────────

def parse_wafl(page):
    """Season rows from a wafl.com.au player page:
    [{season, comp, team, matches, kicks, handballs, disposals, marks, tackles,
      hitouts, frees_for, frees_against, goals_total, behinds}] as totals."""
    out = []
    # the season table is the one whose header carries an AVG column
    for table in re.findall(r"<table.*?</table>", page, re.S):
        if ">AVG<" not in re.sub(r"\s+", "", table):
            continue
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S):
            cells = [_clean(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
            if len(cells) < 15 or not re.fullmatch(r"\d{4}", cells[0]):
                continue
            comp = WAFL_COMPS.get(cells[1].lower())
            if not comp:
                continue  # preseason and anything else
            n = [_num(c) for c in cells[3:15]]
            if not n[0]:
                continue
            out.append({"season": int(cells[0]), "comp": comp, "team": cells[2], "matches": int(n[0]),
                        "kicks": n[1], "handballs": n[2], "disposals": n[3], "marks": n[5], "tackles": n[6],
                        "hitouts": n[7], "frees_for": n[8], "frees_against": n[9], "goals_total": n[10],
                        "behinds": n[11]})
        if out:
            break
    return out


def fetch_wafl(name):
    """The player's WAFL rows, trying the plain slug and the numbered ones the
    site uses for shared names. Only a page with his name on it counts."""
    base = slug(name)
    for s in (base, base + "-1", base + "-2"):
        try:
            code, page = _get(f"https://www.wafl.com.au/player/{s}")
        except Exception as e:
            logger.debug("wafl fetch failed %s: %s", s, e)
            continue
        if code != 200 or name.lower() not in _clean(page).lower():
            continue
        rows = parse_wafl(page)
        if rows:
            return rows
    return []


# ── Rookie Me Central ────────────────────────────────────────────────────

def parse_rookieme(page):
    """Season rows from every stats table on a Rookie Me Central profile."""
    out = []
    for caption, table in re.findall(r'<h4 class="sp-table-caption">(.*?)</h4>.*?(<table.*?</table>)', page, re.S):
        comp = ROOKIEME_COMPS.get(_clean(caption).lower())
        if not comp:
            continue
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S):
            cells = dict(re.findall(r'<td class="data-([a-z]+)[^"]*">(.*?)</td>', row, re.S))
            season = _clean(cells.get("name", ""))
            if not re.fullmatch(r"\d{4}", season):
                continue
            gm = _num(_clean(cells.get("gamesplayed", "")))
            if not gm:
                continue
            tot = lambda k: _num(_clean(cells.get(k, "")))
            out.append({"season": int(season), "comp": comp, "team": _clean(cells.get("team", "")), "matches": int(gm),
                        "kicks": tot("kicks"), "handballs": tot("handballs"), "disposals": tot("disposals"),
                        "marks": tot("marks"), "tackles": tot("tackles"), "hitouts": tot("hitouts"),
                        "contested_possessions": tot("cp"), "uncontested_possessions": tot("up"),
                        "clearances": tot("clr"), "inside_fifties": tot("i"), "rebounds": tot("r"),
                        "goals_total": tot("goals"), "fantasy": tot("dc")})
    return out


def fetch_rookieme(name):
    try:
        code, page = _get(f"https://central.rookieme.com/afl/player/{slug(name)}/")
    except Exception as e:
        logger.debug("rookieme fetch failed %s: %s", name, e)
        return []
    if code != 200 or name.lower() not in _clean(page).lower():
        return []
    return parse_rookieme(page)


# ── store ────────────────────────────────────────────────────────────────

# Competitions a scheduled feed already fills (DFS Australia, wheeloratings).
FEED_COMPS = ("nab", "sanflu18", "wafl", "vfl", "sanfl")

PER_GAME = ("kicks", "handballs", "disposals", "marks", "tackles", "hitouts", "frees_for", "frees_against",
            "behinds", "contested_possessions", "uncontested_possessions", "clearances", "inside_fifties", "rebounds")


def store(player, rows):
    """Write rows as per-game averages. Returns rows written."""
    from models.database import db, StateLeagueStat
    n = 0
    for r in rows:
        exists = StateLeagueStat.query.filter_by(player_name=player.name, competition=r["comp"], season=r["season"]).first()
        if exists and r["comp"] in FEED_COMPS:
            continue  # the feed has this season already: keep the feed's row
        obj = exists or StateLeagueStat(player_name=player.name, competition=r["comp"], season=r["season"])
        if not exists:
            db.session.add(obj)
        m = r["matches"]
        obj.player_id = player.id
        obj.team = r["team"] or obj.team
        obj.matches = m
        obj.is_afl_listed = True
        for k in PER_GAME:
            if r.get(k) is not None:
                setattr(obj, k, round(r[k] / m, 2))
        if r.get("goals_total") is not None:
            obj.goals = r["goals_total"]
            obj.goals_avg = round(r["goals_total"] / m, 2)
        if r.get("fantasy") is not None:
            obj.dreamteam_avg = r["fantasy"]
        n += 1
    return n


def sync_junior_sources(only_new=True, limit=None, drafted_since=None):
    """Fetch WAFL and Rookie Me rows for listed players with no AFL games, or
    with drafted_since, for every listed player drafted that year or later
    (the past draftees the Before the AFL rankings compare against).
    Returns (players with rows, rows written)."""
    from models.database import db, AflPlayer
    from models.pre_afl import draft_info
    q = AflPlayer.query.filter(AflPlayer.listed())
    if only_new and not drafted_since:
        q = q.filter(db.or_(AflPlayer.career_games.is_(None), AflPlayer.career_games == 0))
    todo = q.all()
    if drafted_since:
        todo = [p for p in todo if (draft_info(p)[0] or 0) >= drafted_since]
    players, rows_n = 0, 0
    for i, p in enumerate(todo):
        if limit and i >= limit:
            break
        rows = fetch_wafl(p.name) + fetch_rookieme(p.name)
        if rows:
            rows_n += store(p, rows)
            players += 1
            db.session.commit()
        time.sleep(0.3)
    logger.info("junior sources: %d players, %d rows", players, rows_n)
    return players, rows_n

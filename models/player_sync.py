"""Bring afl_player into line with the player workbook.

The workbook's "Player Database" sheet is the list of record for who is on an
AFL list this season, and it owns rating, potential, age and club. One sync
does four things:

  - matched players: rating, potential, start-of-year rating, age, and CLUB
    (a traded player keeps his row, his history and his place on a keeper list);
  - workbook rows with no player: created, with an EXPECTED position taken from
    the workbook's role, since a draftee has no SuperCoach position yet;
  - listed players the workbook no longer names: marked former (never deleted);
  - former players the workbook names again: back on a list.

Matching is one-to-one and runs strictest first, so a loose rule can never
steal a player an exact rule would have claimed. ``plan_sync`` is pure (no
writes) and returns the full plan, which is what the dry run prints.
"""

import logging
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

SHEET = "Player Database"

# Workbook club name -> afl_player.afl_team
TEAM_MAP = {
    "Brisbane": "Brisbane Lions",
    "Greater Western Sydney": "GWS",
    "St. Kilda": "St Kilda",
}

# Workbook role -> the SuperCoach line we expect a new player to be given.
EXPECTED_POSITION = {
    "MID": "MID", "RUC": "RUC",
    "GD": "DEF", "KD": "DEF",
    "GF": "FWD", "KF": "FWD",
}

# (afl_player name, club) -> workbook name, where the two simply differ.
NAME_OVERRIDES = {
    ("Michael Frederick", "Fremantle"): "Minairo Frederick",
    ("Max King", "Sydney"): "Maxy King",
    ("Nikolas Cox", "Essendon"): "Nik Cox",
    ("Jacob Farrow", "Essendon"): "Jackson Farrow",
    ("Indy Cotton", "Adelaide"): "Indi Cotton",
    ("Hussien El Achkar", "Essendon"): "Hussein El Achkar",
    ("Jack Hutchinson", "West Coast"): "Jack Hutchison",
    ("Maurice Rioli", "Richmond"): "Maurice Rioli Jr",
    ("Robert Hansen", "North Melbourne"): "Robert Hansen Jr",
}

# short -> long. Applied in both directions.
NICKNAMES = {
    "brad": "bradley", "cam": "cameron", "dan": "daniel",
    "ed": "edward", "harry": "harrison", "josh": "joshua",
    "jake": "jacob", "tom": "thomas", "will": "william",
    "matt": "matthew", "ben": "benjamin", "sam": "samuel",
    "nick": "nicholas", "mitch": "mitchell", "alex": "alexander",
    "tim": "timothy", "rob": "robert", "pat": "patrick",
    "joe": "joseph", "charlie": "charles", "liam": "william",
    "zac": "zachary", "zach": "zachary", "nat": "nathan",
    "nic": "nicholas", "mike": "michael", "chris": "christopher",
    "jim": "james", "jon": "jonathan", "dave": "david",
    "lachlan": "lachie", "ollie": "oliver", "wil": "will",
    "willem": "will", "jack": "jackson", "jaime": "jamie",
    "bobby": "robert", "paddy": "patrick", "nik": "nikolas",
    "andy": "andrew", "tommy": "thomas", "max": "maxwell",
    "connor": "conor", "callum": "cal", "isaac": "zac",
    "dom": "dominic", "seb": "sebastian", "gus": "angus",
    "jed": "jedd", "jai": "jay", "bailey": "bailee",
}
_NICK_GROUPS = defaultdict(set)
for _short, _long in NICKNAMES.items():
    _NICK_GROUPS[_short].add(_long)
    _NICK_GROUPS[_long].add(_short)

# Refuse to retire players off a workbook that is obviously not a full list.
MIN_WORKBOOK_ROWS = 600
MAX_FORMER_SHARE = 0.30


def norm(name: str) -> str:
    """Case, accents, punctuation and suffix-free form for comparing names."""
    s = unicodedata.normalize("NFKD", name or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[.'’`]", "", s)
    s = re.sub(r"[-]", " ", s)
    s = re.sub(r"\b(jr|jnr|snr|sr)\b", "", s)
    return re.sub(r"\s+", " ", s).strip()


def variants(name: str):
    """Other first names the same person may be filed under."""
    parts = norm(name).split()
    if len(parts) < 2:
        return []
    first, rest = parts[0], " ".join(parts[1:])
    seen, out, frontier = {first}, [], [first]
    # Two hops: zach -> zachary -> zac.
    for _ in range(2):
        nxt = []
        for f in frontier:
            for alt in _NICK_GROUPS.get(f, ()):
                if alt not in seen:
                    seen.add(alt)
                    nxt.append(alt)
                    out.append(f"{alt} {rest}")
        frontier = nxt
    return out


@dataclass
class Row:
    name: str
    team: str
    age: Optional[int]
    rating: Optional[int]
    potential: Optional[int]
    rating_start: Optional[int]
    role: Optional[str]            # MID / RUC / GD / KD / GF / KF
    role_detail: Optional[str]     # "Rebound Defender"

    @property
    def expected_position(self):
        return EXPECTED_POSITION.get((self.role or "").strip().upper(), "MID")


@dataclass
class Plan:
    season_year: int
    rows: int = 0
    matched: list = field(default_factory=list)     # (player, Row, how)
    create: list = field(default_factory=list)      # Row
    former: list = field(default_factory=list)      # player
    skipped: list = field(default_factory=list)     # (Row, reason)
    warnings: list = field(default_factory=list)
    retire_refused: Optional[str] = None

    @property
    def moved(self):
        return [(p, r) for p, r, _h in self.matched if p.afl_team != r.team]

    @property
    def returning(self):
        return [(p, r) for p, r, _h in self.matched if p.list_status == "former"]

    def counts(self):
        how = defaultdict(int)
        for _p, _r, h in self.matched:
            how[h] += 1
        return {
            "rows": self.rows, "matched": len(self.matched), "by_rule": dict(how),
            "moved_club": len(self.moved), "created": len(self.create),
            "former": len(self.former), "returning": len(self.returning),
            "skipped": len(self.skipped),
        }


def _num(v, lo=0, hi=100):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    v = int(v)
    return v if lo <= v <= hi else None


def read_workbook(path, season_year):
    """The workbook's players as Rows. Raises if the sheet isn't there."""
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        ws = wb[SHEET]
        it = ws.iter_rows(values_only=True)
        headers = [str(h).strip() if h is not None else "" for h in next(it)]

        def col(label, default=None):
            return headers.index(label) if label in headers else default

        c_name, c_age = col("Player", 0), col("Age", 1)
        c_rating, c_pot = col("Rating", 2), col("Potential", 3)
        c_team, c_role = col("Team", 4), col("Position", 5)
        c_detail = col("Specific Position")
        c_start = col(str(season_year))

        def cell(row, i):
            return row[i] if i is not None and i < len(row) else None

        rows = []
        for row in it:
            name = cell(row, c_name)
            if not name or not isinstance(name, str) or not name.strip():
                continue
            team_raw = str(cell(row, c_team) or "").strip()
            role = cell(row, c_role)
            detail = cell(row, c_detail)
            rows.append(Row(
                name=name.strip(),
                team=TEAM_MAP.get(team_raw, team_raw),
                age=_num(cell(row, c_age), 15, 50),
                rating=_num(cell(row, c_rating)),
                potential=_num(cell(row, c_pot)),
                rating_start=_num(cell(row, c_start)),
                role=str(role).strip() if role else None,
                role_detail=str(detail).strip() if detail else None,
            ))
        return rows
    finally:
        wb.close()


def plan_sync(rows, players, season_year):
    """Decide every match, creation and departure. No writes.

    ``players`` is every afl_player row (listed and former).
    """
    plan = Plan(season_year=season_year, rows=len(rows))
    free_rows = list(range(len(rows)))
    free_players = {p.id: p for p in players}

    def take(i, player, how):
        plan.matched.append((player, rows[i], how))
        free_rows.remove(i)
        del free_players[player.id]

    def by_key(keyfn):
        idx = defaultdict(list)
        for p in free_players.values():
            for k in keyfn(p):
                idx[k].append(p)
        return idx

    def run(how, row_keys, player_keys, need_unique_row=False):
        """Match each free row to the single free player sharing a key."""
        idx = by_key(player_keys)
        claims = defaultdict(list)          # player id -> rows wanting him
        for i in list(free_rows):
            cands = {}
            for k in row_keys(rows[i]):
                for p in idx.get(k, ()):
                    cands[p.id] = p
            if len(cands) == 1:
                claims[next(iter(cands))].append(i)
        for pid, wanting in claims.items():
            if len(wanting) != 1:
                continue                    # two rows, one player: leave both
            if pid in free_players:
                take(wanting[0], free_players[pid], how)

    # 1. Same name, same club.
    run("exact",
        lambda r: [(norm(r.name), r.team)],
        lambda p: [(norm(p.name), p.afl_team)])

    # 2. Known spelling differences, same club.
    override = {(norm(x_name), team): (norm(db_name), team)
                for (db_name, team), x_name in NAME_OVERRIDES.items()}
    run("override",
        lambda r: [override[(norm(r.name), r.team)]] if (norm(r.name), r.team) in override else [],
        lambda p: [(norm(p.name), p.afl_team)])

    # 3. Short/long first name, same club.
    run("nickname",
        lambda r: [(v, r.team) for v in variants(r.name)],
        lambda p: [(norm(p.name), p.afl_team)])

    # 4. Same name at another club: he was traded.
    run("moved",
        lambda r: [norm(r.name)],
        lambda p: [norm(p.name)])

    # 5. Traded AND filed under the other first name.
    run("moved+nickname",
        lambda r: variants(r.name),
        lambda p: [norm(p.name)])

    # 6. Same surname at the same club, a year (or none) older, same first
    #    initial: a spelling the nickname table doesn't know.
    def surname_key_row(r):
        parts = norm(r.name).split()
        if len(parts) < 2 or r.age is None:
            return []
        return [(parts[-1], r.team, parts[0][0], r.age - d) for d in (0, 1)]

    def surname_key_player(p):
        parts = norm(p.name).split()
        if len(parts) < 2 or p.age is None:
            return []
        return [(parts[-1], p.afl_team, parts[0][0], p.age)]

    run("surname", surname_key_row, surname_key_player)

    # Whatever is left in the workbook is a new player.
    for i in free_rows:
        r = rows[i]
        if r.rating is None:
            plan.skipped.append((r, "no rating"))
        elif not r.team:
            plan.skipped.append((r, "no club"))
        else:
            plan.create.append(r)

    # Whatever is left in the table, and was listed, has left the AFL.
    listed = [p for p in players if p.list_status != "former"]
    leaving = [p for p in free_players.values() if p.list_status != "former"]
    if len(rows) < MIN_WORKBOOK_ROWS:
        plan.retire_refused = (
            f"workbook has {len(rows)} players, under the {MIN_WORKBOOK_ROWS} "
            "a full AFL list needs")
    elif listed and len(leaving) / len(listed) > MAX_FORMER_SHARE:
        plan.retire_refused = (
            f"{len(leaving)} of {len(listed)} listed players are missing from "
            "the workbook, too many for one off-season")
    else:
        plan.former = sorted(leaving, key=lambda p: (-(p.rating or 0), p.name))

    # A club change that collides with another row's (name, club) can't be written.
    taken = {(p.name, p.afl_team): p.id for p in players}
    for p, r in plan.moved:
        other = taken.get((p.name, r.team))
        if other and other != p.id:
            plan.warnings.append(
                f"{p.name}: can't move to {r.team}, another {p.name} is already there")
    return plan


def apply_sync(plan):
    """Write a plan. Caller commits. Returns counts of what changed."""
    from models.database import db, AflPlayer, RatingLog

    year = plan.season_year
    taken = {(p.name, p.afl_team): p.id for p in AflPlayer.query.all()}
    from models.role_scoring import clean_role, clean_detail
    changed = {"ratings": 0, "ages": 0, "clubs": 0, "created": 0,
               "former": 0, "returning": 0, "roles": 0}

    for p, r, _how in plan.matched:
        if p.rating is not None and r.rating is not None and p.rating != r.rating:
            db.session.add(RatingLog(
                player_id=p.id, old_rating=p.rating, new_rating=r.rating,
                old_potential=p.potential, new_potential=r.potential,
                rating_start=r.rating_start if r.rating_start is not None else p.rating_start,
            ))
            changed["ratings"] += 1
        if r.rating is not None:
            p.rating = r.rating
        if r.potential is not None:
            p.potential = r.potential
        if r.rating_start is not None:
            p.rating_start = r.rating_start
        if r.age is not None and p.age != r.age:
            p.age = r.age
            changed["ages"] += 1
        # The kind of player he is. A blank cell leaves what we have.
        role, detail = clean_role(r.role), clean_detail(r.role_detail)
        if (role and p.role != role) or (detail and p.role_detail != detail):
            p.role = role or p.role
            p.role_detail = detail or p.role_detail
            changed["roles"] += 1
        if r.team and p.afl_team != r.team:
            holder = taken.get((p.name, r.team))
            if holder and holder != p.id:
                logger.warning("Player sync: %s not moved to %s (name clash)", p.name, r.team)
            else:
                taken.pop((p.name, p.afl_team), None)
                p.afl_team = r.team
                taken[(p.name, r.team)] = p.id
                changed["clubs"] += 1
        if p.list_status == "former":
            changed["returning"] += 1
        if p.list_status != "listed":
            p.list_status = "listed"
        if p.left_afl_year is not None:
            p.left_afl_year = None

    for r in plan.create:
        if (r.name, r.team) in taken:
            continue
        p = AflPlayer(
            name=r.name, afl_team=r.team,
            position=r.expected_position, position_expected=True,
            age=r.age, rating=r.rating, potential=r.potential,
            rating_start=r.rating_start if r.rating_start is not None else r.rating,
            games_played=0, career_games=0,
            list_status="listed", joined_year=year,
            role=clean_role(r.role), role_detail=clean_detail(r.role_detail),
        )
        db.session.add(p)
        db.session.flush()
        taken[(r.name, r.team)] = p.id
        changed["created"] += 1

    for p in plan.former:
        p.list_status = "former"
        # The last season he was on a list is the one before this workbook's.
        p.left_afl_year = year - 1
        changed["former"] += 1
    return changed


def sync_players(path, season_year, dry_run=False):
    """Read, plan and (unless dry_run) apply. Returns (plan, changed)."""
    from models.database import db, AflPlayer

    rows = read_workbook(path, season_year)
    plan = plan_sync(rows, AflPlayer.query.all(), season_year)
    if dry_run:
        return plan, None
    changed = apply_sync(plan)
    db.session.commit()
    return plan, changed

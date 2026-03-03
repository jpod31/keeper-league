"""Fixture generation: round-robin, matchups, finals bracket."""

import random
from collections import defaultdict

from models.database import (
    db, Fixture, FantasyTeam, League, SeasonConfig,
)


def _circle_method_pairings(teams):
    """Generate round-robin pairings using the circle method.

    With N teams (padded to even), produces N-1 rounds where each team
    plays exactly once per round.  Returns list of rounds, each round
    being a list of (team_a, team_b) tuples — home/away is NOT assigned
    here; the caller decides that based on fairness tracking.
    """
    team_list = list(teams)
    n = len(team_list)

    # Pad with None (bye placeholder) if odd number of teams
    if n % 2 == 1:
        team_list.append(None)
        n += 1

    # Circle method: fix team_list[0], rotate the rest
    num_rounds = n - 1
    rounds = []

    for r in range(num_rounds):
        round_pairs = []
        for i in range(n // 2):
            t1 = team_list[i]
            t2 = team_list[n - 1 - i]
            if t1 is not None and t2 is not None:
                round_pairs.append((t1, t2))
        rounds.append(round_pairs)

        # Rotate: keep team_list[0] fixed, rotate rest clockwise
        team_list = [team_list[0]] + [team_list[-1]] + team_list[1:-1]

    return rounds


def generate_preseason(league_id, year):
    """Generate pre-season fixtures (afl_round=0) using simple sequential pairings.

    Pairs teams by draft order: 1v2, 3v4, 5v6, etc.
    Odd team count → last team gets a bye (no fixture).
    Idempotent: deletes existing round-0 fixtures before creating new ones.
    """
    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.draft_order).all()
    if len(teams) < 2:
        return [], "Need at least 2 teams."

    # Delete existing pre-season fixtures
    Fixture.query.filter_by(league_id=league_id, year=year, afl_round=0, is_final=False).delete()

    fixtures = []
    for i in range(0, len(teams) - 1, 2):
        home = teams[i]
        away = teams[i + 1]
        fixture = Fixture(
            league_id=league_id,
            afl_round=0,
            year=year,
            home_team_id=home.id,
            away_team_id=away.id,
        )
        db.session.add(fixture)
        fixtures.append(fixture)

    db.session.commit()
    return fixtures, None


def generate_round_robin(league_id, year, num_rounds=23):
    """Generate a fair round-robin fixture for the season.

    Improvements over a naive circle method:
      1. Teams are shuffled so fixture is randomised each generation
      2. Repeat cycles use shuffled round order to spread rematches apart
      3. Home/away assigned per-pairing: alternates between meetings,
         and balances each team's total home games across the season
    """
    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.draft_order).all()
    if len(teams) < 2:
        return [], "Need at least 2 teams."

    # Delete any existing fixtures for this year
    Fixture.query.filter_by(league_id=league_id, year=year, is_final=False).delete()

    # Shuffle teams so the fixture is different each time it's generated
    shuffled = list(teams)
    random.shuffle(shuffled)

    # Generate one full cycle of pairings (no home/away yet)
    base_rounds = _circle_method_pairings(shuffled)
    if not base_rounds:
        return [], "Could not generate fixture."

    cycle_len = len(base_rounds)

    # Build round schedule: first cycle in natural order, subsequent
    # cycles shuffled so rematches are spread across the season
    round_schedule = []
    num_cycles = (num_rounds + cycle_len - 1) // cycle_len
    for c in range(num_cycles):
        indices = list(range(cycle_len))
        if c > 0:
            random.shuffle(indices)
        round_schedule.extend(indices)
    round_schedule = round_schedule[:num_rounds]

    # Track fairness
    home_counts = defaultdict(int)       # team_id -> total home games
    pair_last_home = {}                  # frozenset({a_id, b_id}) -> team_id last home

    fixtures = []
    for afl_round, base_idx in enumerate(round_schedule, 1):
        for t1, t2 in base_rounds[base_idx]:
            pair_key = frozenset({t1.id, t2.id})
            last_home = pair_last_home.get(pair_key)

            if last_home is not None:
                # Alternate from last meeting
                if last_home == t1.id:
                    home, away = t2, t1
                else:
                    home, away = t1, t2
            else:
                # First meeting — give home to team with fewer home games
                if home_counts[t1.id] <= home_counts[t2.id]:
                    home, away = t1, t2
                else:
                    home, away = t2, t1

            home_counts[home.id] += 1
            pair_last_home[pair_key] = home.id

            fixture = Fixture(
                league_id=league_id,
                afl_round=afl_round,
                year=year,
                home_team_id=home.id,
                away_team_id=away.id,
            )
            db.session.add(fixture)
            fixtures.append(fixture)

    db.session.commit()
    return fixtures, None


def get_fixture(league_id, year):
    """Get the full season fixture grouped by round."""
    fixtures = (
        Fixture.query
        .filter_by(league_id=league_id, year=year, is_final=False)
        .order_by(Fixture.afl_round, Fixture.id)
        .all()
    )

    rounds = {}
    for f in fixtures:
        rnd = f.afl_round
        if rnd not in rounds:
            rounds[rnd] = []
        rounds[rnd].append(f)

    return rounds


def get_round_fixtures(league_id, year, afl_round):
    """Get fixtures for a specific round."""
    return (
        Fixture.query
        .filter_by(league_id=league_id, year=year, afl_round=afl_round, is_final=False)
        .all()
    )


def get_matchup(fixture_id):
    """Get a single matchup by fixture ID."""
    return db.session.get(Fixture, fixture_id)


def update_fixture_scores(fixture_id, home_score, away_score):
    """Update scores for a fixture and mark status."""
    fixture = db.session.get(Fixture, fixture_id)
    if not fixture:
        return None
    fixture.home_score = home_score
    fixture.away_score = away_score
    fixture.status = "completed"
    db.session.commit()
    return fixture


def generate_finals(league_id, year, num_finals_teams=4):
    """Generate finals bracket fixtures (top 4 format).
    QF1: 1st vs 4th, QF2: 2nd vs 3rd
    PF: Loser QF1 vs Winner QF2 (elimination)
    GF: Winner QF1 vs Winner PF
    """
    # Delete existing finals
    Fixture.query.filter_by(league_id=league_id, year=year, is_final=True).delete()

    from models.database import SeasonStanding
    standings = (
        SeasonStanding.query
        .filter_by(league_id=league_id, year=year)
        .order_by(SeasonStanding.ladder_points.desc(), SeasonStanding.percentage.desc())
        .limit(num_finals_teams)
        .all()
    )

    if len(standings) < num_finals_teams:
        return [], "Not enough teams in standings for finals."

    # Get config for round numbering
    config = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    base_round = (config.num_regular_rounds if config else 23) + 1

    finals = []

    # QF1: 1st vs 4th
    qf1 = Fixture(
        league_id=league_id, afl_round=base_round, year=year,
        home_team_id=standings[0].team_id, away_team_id=standings[3].team_id,
        is_final=True, final_type="QF1",
    )
    db.session.add(qf1)
    finals.append(qf1)

    # QF2: 2nd vs 3rd
    qf2 = Fixture(
        league_id=league_id, afl_round=base_round, year=year,
        home_team_id=standings[1].team_id, away_team_id=standings[2].team_id,
        is_final=True, final_type="QF2",
    )
    db.session.add(qf2)
    finals.append(qf2)

    # PF and GF are created as placeholders (teams filled when QFs complete)
    # Use -1 as placeholder team IDs — advance_finals() will update them
    pf = Fixture(
        league_id=league_id, afl_round=base_round + 1, year=year,
        home_team_id=-1,
        away_team_id=-1,
        is_final=True, final_type="PF",
    )
    db.session.add(pf)
    finals.append(pf)

    gf = Fixture(
        league_id=league_id, afl_round=base_round + 2, year=year,
        home_team_id=-1,
        away_team_id=-1,
        is_final=True, final_type="GF",
    )
    db.session.add(gf)
    finals.append(gf)

    db.session.commit()
    return finals, None


def advance_finals(league_id, year):
    """Check completed finals fixtures and advance winners to the next round.

    AFL Top-4 finals system:
      QF1 (1v4): Winner -> GF, Loser -> PF
      QF2 (2v3): Winner -> PF, Loser -> eliminated
      PF: Winner -> GF, Loser -> eliminated
      GF: Winner = premier

    Returns list of updated fixture types, e.g. ["PF", "GF"].
    """
    finals = Fixture.query.filter_by(
        league_id=league_id, year=year, is_final=True
    ).all()

    by_type = {f.final_type: f for f in finals}
    updated = []

    qf1 = by_type.get("QF1")
    qf2 = by_type.get("QF2")
    pf = by_type.get("PF")
    gf = by_type.get("GF")

    # Advance from QFs
    if qf1 and qf1.status == "completed" and qf2 and qf2.status == "completed":
        qf1_winner = qf1.home_team_id if (qf1.home_score or 0) >= (qf1.away_score or 0) else qf1.away_team_id
        qf1_loser = qf1.away_team_id if qf1_winner == qf1.home_team_id else qf1.home_team_id
        qf2_winner = qf2.home_team_id if (qf2.home_score or 0) >= (qf2.away_score or 0) else qf2.away_team_id

        # PF: Loser QF1 vs Winner QF2
        if pf and pf.home_team_id == -1:
            pf.home_team_id = qf1_loser
            pf.away_team_id = qf2_winner
            updated.append("PF")

        # GF gets QF1 winner (home advantage for qualifying final winner)
        if gf and gf.home_team_id == -1:
            gf.home_team_id = qf1_winner
            # away_team_id stays -1 until PF is completed
            updated.append("GF_home")

    # Advance from PF to GF
    if pf and pf.status == "completed" and gf:
        pf_winner = pf.home_team_id if (pf.home_score or 0) >= (pf.away_score or 0) else pf.away_team_id
        if gf.away_team_id == -1:
            gf.away_team_id = pf_winner
            updated.append("GF")

    if updated:
        db.session.commit()

    return updated


def get_finals(league_id, year):
    """Get all finals fixtures."""
    return (
        Fixture.query
        .filter_by(league_id=league_id, year=year, is_final=True)
        .order_by(Fixture.afl_round, Fixture.id)
        .all()
    )


# ── Reserve 7s Fixture Functions ────────────────────────────────────────


def generate_7s_round_robin(league_id, year, num_rounds=23, start_round=1):
    """Mirror the main comp's regular-season fixture into Reserve7sFixture.

    Copies every non-final Fixture row so the 7s draw matches the main
    comp exactly (same matchups, same home/away, same rounds).
    """
    from models.database import Reserve7sFixture

    # Delete existing 7s regular-season fixtures
    Reserve7sFixture.query.filter_by(league_id=league_id, year=year, is_final=False).delete()

    # Read main comp fixtures
    main_fixtures = (
        Fixture.query
        .filter_by(league_id=league_id, year=year, is_final=False)
        .order_by(Fixture.afl_round, Fixture.id)
        .all()
    )

    if not main_fixtures:
        return [], "No main comp fixture to mirror."

    fixtures = []
    for mf in main_fixtures:
        f7 = Reserve7sFixture(
            league_id=league_id,
            afl_round=mf.afl_round,
            year=year,
            home_team_id=mf.home_team_id,
            away_team_id=mf.away_team_id,
        )
        db.session.add(f7)
        fixtures.append(f7)

    db.session.commit()
    return fixtures, None


def generate_7s_finals(league_id, year, num_finals_teams=None):
    """Generate 7s finals mirroring the main comp's finals format.

    Uses the same structure (top-4 bracket by default) but with 7s standings.
    num_finals_teams defaults to whatever SeasonConfig.finals_teams is set to.
    """
    from models.database import Reserve7sFixture, Reserve7sStanding

    # Delete existing 7s finals
    Reserve7sFixture.query.filter_by(league_id=league_id, year=year, is_final=True).delete()

    config_obj = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    if num_finals_teams is None:
        num_finals_teams = config_obj.finals_teams if config_obj else 4

    # No finals configured — just clear any existing and return
    if num_finals_teams == 0:
        db.session.commit()
        return [], None

    base_round = (config_obj.num_regular_rounds if config_obj else 23) + 1

    standings = (
        Reserve7sStanding.query
        .filter_by(league_id=league_id, year=year)
        .order_by(Reserve7sStanding.ladder_points.desc(), Reserve7sStanding.percentage.desc())
        .limit(num_finals_teams)
        .all()
    )

    if len(standings) < num_finals_teams:
        return [], f"Not enough teams in 7s standings for finals (need {num_finals_teams}, have {len(standings)})."

    finals = []

    # Top-4 format (same as main comp)
    # QF1: 1st vs 4th
    qf1 = Reserve7sFixture(
        league_id=league_id, afl_round=base_round, year=year,
        home_team_id=standings[0].team_id, away_team_id=standings[3].team_id,
        is_final=True, final_type="QF1",
    )
    db.session.add(qf1)
    finals.append(qf1)

    # QF2: 2nd vs 3rd
    qf2 = Reserve7sFixture(
        league_id=league_id, afl_round=base_round, year=year,
        home_team_id=standings[1].team_id, away_team_id=standings[2].team_id,
        is_final=True, final_type="QF2",
    )
    db.session.add(qf2)
    finals.append(qf2)

    # PF and GF as placeholders
    pf = Reserve7sFixture(
        league_id=league_id, afl_round=base_round + 1, year=year,
        home_team_id=-1, away_team_id=-1,
        is_final=True, final_type="PF",
    )
    db.session.add(pf)
    finals.append(pf)

    gf = Reserve7sFixture(
        league_id=league_id, afl_round=base_round + 2, year=year,
        home_team_id=-1, away_team_id=-1,
        is_final=True, final_type="GF",
    )
    db.session.add(gf)
    finals.append(gf)

    db.session.commit()
    return finals, None


def advance_7s_finals(league_id, year):
    """Advance 7s finals winners, mirroring main comp's advance_finals."""
    from models.database import Reserve7sFixture

    finals = Reserve7sFixture.query.filter_by(
        league_id=league_id, year=year, is_final=True,
    ).all()

    by_type = {f.final_type: f for f in finals}
    updated = []

    qf1 = by_type.get("QF1")
    qf2 = by_type.get("QF2")
    pf = by_type.get("PF")
    gf = by_type.get("GF")

    if qf1 and qf1.status == "completed" and qf2 and qf2.status == "completed":
        qf1_winner = qf1.home_team_id if (qf1.home_score or 0) >= (qf1.away_score or 0) else qf1.away_team_id
        qf1_loser = qf1.away_team_id if qf1_winner == qf1.home_team_id else qf1.home_team_id
        qf2_winner = qf2.home_team_id if (qf2.home_score or 0) >= (qf2.away_score or 0) else qf2.away_team_id

        if pf and pf.home_team_id == -1:
            pf.home_team_id = qf1_loser
            pf.away_team_id = qf2_winner
            updated.append("PF")

        if gf and gf.home_team_id == -1:
            gf.home_team_id = qf1_winner
            updated.append("GF_home")

    if pf and pf.status == "completed" and gf:
        pf_winner = pf.home_team_id if (pf.home_score or 0) >= (pf.away_score or 0) else pf.away_team_id
        if gf.away_team_id == -1:
            gf.away_team_id = pf_winner
            updated.append("GF")

    if updated:
        db.session.commit()

    return updated


def generate_7s_preseason(league_id, year):
    """Mirror the main comp's pre-season (round 0) fixtures into 7s.

    Copies round-0 Fixture rows so 7s matchups match the main comp.
    Called automatically when main comp pre-season is generated.
    """
    from models.database import Reserve7sFixture

    # Delete existing 7s pre-season fixtures
    Reserve7sFixture.query.filter_by(league_id=league_id, year=year, afl_round=0, is_final=False).delete()

    # Read main comp round-0 fixtures
    main_fixtures = (
        Fixture.query
        .filter_by(league_id=league_id, year=year, afl_round=0, is_final=False)
        .order_by(Fixture.id)
        .all()
    )

    if not main_fixtures:
        return [], "No main comp pre-season fixture to mirror."

    fixtures = []
    for mf in main_fixtures:
        f7 = Reserve7sFixture(
            league_id=league_id,
            afl_round=0,
            year=year,
            home_team_id=mf.home_team_id,
            away_team_id=mf.away_team_id,
        )
        db.session.add(f7)
        fixtures.append(f7)

    db.session.commit()
    return fixtures, None


def get_7s_fixture(league_id, year):
    """Get the full 7s season fixture grouped by round."""
    from models.database import Reserve7sFixture

    fixtures = (
        Reserve7sFixture.query
        .filter_by(league_id=league_id, year=year, is_final=False)
        .order_by(Reserve7sFixture.afl_round, Reserve7sFixture.id)
        .all()
    )

    rounds = {}
    for f in fixtures:
        rnd = f.afl_round
        if rnd not in rounds:
            rounds[rnd] = []
        rounds[rnd].append(f)

    return rounds


def get_7s_round_fixtures(league_id, year, afl_round):
    """Get 7s fixtures for a specific round."""
    from models.database import Reserve7sFixture

    return (
        Reserve7sFixture.query
        .filter_by(league_id=league_id, year=year, afl_round=afl_round, is_final=False)
        .all()
    )

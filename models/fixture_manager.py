"""Fixture generation: round-robin, matchups, finals bracket."""

from models.database import (
    db, Fixture, FantasyTeam, League, SeasonConfig,
)


def _circle_method_rounds(teams):
    """Generate a valid round-robin schedule using the circle method.

    With N teams (padded to even), produces N-1 rounds where each team
    plays exactly once per round.  Returns list of rounds, each round
    being a list of (home, away) tuples of team objects.
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
            home = team_list[i]
            away = team_list[n - 1 - i]
            if home is not None and away is not None:
                # Alternate home/away by round to keep it fair
                if r % 2 == 0:
                    round_pairs.append((home, away))
                else:
                    round_pairs.append((away, home))
        rounds.append(round_pairs)

        # Rotate: keep team_list[0] fixed, rotate rest clockwise
        team_list = [team_list[0]] + [team_list[-1]] + team_list[1:-1]

    return rounds


def generate_round_robin(league_id, year, num_rounds=23):
    """Generate a round-robin fixture for the season.

    Uses the circle method to produce valid rounds where each team plays
    exactly once per round.  Cycles through the generated rounds to fill
    the requested number of AFL rounds, alternating home/away on repeats.
    """
    teams = FantasyTeam.query.filter_by(league_id=league_id).order_by(FantasyTeam.draft_order).all()
    if len(teams) < 2:
        return [], "Need at least 2 teams."

    # Delete any existing fixtures for this year
    Fixture.query.filter_by(league_id=league_id, year=year, is_final=False).delete()

    # Generate one full cycle of valid rounds
    base_rounds = _circle_method_rounds(teams)
    if not base_rounds:
        return [], "Could not generate fixture."

    fixtures = []
    cycle_len = len(base_rounds)

    for rnd in range(1, num_rounds + 1):
        base_idx = (rnd - 1) % cycle_len
        cycle = (rnd - 1) // cycle_len  # which repetition we're on

        for home, away in base_rounds[base_idx]:
            # Flip home/away on odd cycles for fairness
            if cycle % 2 == 1:
                home, away = away, home

            fixture = Fixture(
                league_id=league_id,
                afl_round=rnd,
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

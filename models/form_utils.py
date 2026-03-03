"""Player form arrow utilities — up/down/flat based on recent scores vs season avg."""

from models.database import db, ScScore, AflPlayer


def compute_player_form(player_ids: list, year: int) -> dict:
    """Return {player_id: 'up' | 'down' | 'flat'} for the given players.

    Compares mean of last 3 SC scores to the player's season sc_avg.
    > 1.05 * avg  → 'up'
    < 0.95 * avg  → 'down'
    Otherwise      → 'flat'
    If fewer than 2 scores → 'flat'
    """
    if not player_ids:
        return {}

    # Fetch all SC scores for these players this year, ordered by round desc
    rows = (
        db.session.query(ScScore.player_id, ScScore.round, ScScore.sc_score)
        .filter(
            ScScore.player_id.in_(player_ids),
            ScScore.year == year,
            ScScore.sc_score.isnot(None),
        )
        .order_by(ScScore.player_id, ScScore.round.desc())
        .all()
    )

    # Group by player — last 3 rounds
    from collections import defaultdict
    recent = defaultdict(list)
    for pid, rnd, score in rows:
        if len(recent[pid]) < 3:
            recent[pid].append(score)

    # Fetch sc_avg for each player
    players = (
        db.session.query(AflPlayer.id, AflPlayer.sc_avg)
        .filter(AflPlayer.id.in_(player_ids))
        .all()
    )
    avg_map = {pid: avg for pid, avg in players}

    result = {}
    for pid in player_ids:
        scores = recent.get(pid, [])
        avg = avg_map.get(pid) or 0

        if len(scores) < 2 or avg <= 0:
            result[pid] = "flat"
            continue

        recent_mean = sum(scores) / len(scores)

        if recent_mean > 1.05 * avg:
            result[pid] = "up"
        elif recent_mean < 0.95 * avg:
            result[pid] = "down"
        else:
            result[pid] = "flat"

    return result

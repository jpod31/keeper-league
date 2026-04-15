"""State league → AFL projection model.

Trains position-aware models on players who've played both levels.
Predicts AFL output for current state league players.
"""

import logging
import pickle
import os
import numpy as np
from collections import defaultdict
from datetime import datetime, timezone

from models.database import db, AflPlayer, PlayerStat, StateLeagueStat

logger = logging.getLogger(__name__)

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "scouting_model.pkl")

_SL_FEATURES = [
    "disposals", "kicks", "handballs", "marks", "goals_per_game", "behinds",
    "tackles", "hitouts", "contested_possessions", "uncontested_possessions",
    "clearances", "inside_fifties", "rebounds", "intercepts",
    "contested_marks", "score_involvements", "disposal_efficiency",
    "tackles_inside_50", "frees_for", "frees_against",
]

_AFL_TARGETS = [
    "afl_disposals", "afl_marks", "afl_goals", "afl_tackles", "afl_hitouts",
    "afl_contested_possessions", "afl_clearances", "afl_sc_avg",
]

_POS_GROUPS = {
    "MID": ["MID", "FWD/MID", "DEF/MID"],
    "FWD": ["FWD", "FWD/RUC"],
    "DEF": ["DEF", "DEF/FWD"],
    "RUC": ["RUC", "DEF/RUC"],
}


def _pos_group(position: str) -> str:
    if not position:
        return "MID"
    for group, positions in _POS_GROUPS.items():
        if position in positions:
            return group
    primary = position.split("/")[0]
    return primary if primary in _POS_GROUPS else "MID"


def _build_training_data():
    """Build feature/target arrays from players with both SL and AFL stats."""
    linked = StateLeagueStat.query.filter(StateLeagueStat.player_id.isnot(None)).all()
    player_sl = defaultdict(list)
    for row in linked:
        player_sl[row.player_id].append(row)

    from sqlalchemy import func
    afl_avgs = db.session.query(
        PlayerStat.player_id, PlayerStat.year,
        func.count(PlayerStat.id).label("games"),
        func.avg(PlayerStat.disposals).label("disposals"),
        func.avg(PlayerStat.marks).label("marks"),
        func.avg(PlayerStat.goals).label("goals"),
        func.avg(PlayerStat.tackles).label("tackles"),
        func.avg(PlayerStat.hitouts).label("hitouts"),
        func.avg(PlayerStat.contested_possessions).label("cp"),
        func.avg(PlayerStat.clearances).label("clearances"),
        func.avg(PlayerStat.supercoach_score).label("sc"),
    ).group_by(PlayerStat.player_id, PlayerStat.year).all()

    player_afl = defaultdict(list)
    for r in afl_avgs:
        if r.games and r.games >= 3:
            player_afl[r.player_id].append(r)

    players = AflPlayer.query.filter(
        AflPlayer.id.in_(set(player_sl.keys()) & set(player_afl.keys()))
    ).all()
    player_map = {p.id: p for p in players}

    samples = []
    for pid in player_sl:
        if pid not in player_afl or pid not in player_map:
            continue
        p = player_map[pid]
        pos = _pos_group(p.position)

        for sl in player_sl[pid]:
            if not sl.matches or sl.matches < 2:
                continue
            gpg = (sl.goals / sl.matches) if sl.goals else 0

            for afl in player_afl[pid]:
                if afl.year < sl.season:
                    continue
                if afl.year > sl.season + 2:
                    continue

                features = {
                    "age": sl.age or 0,
                    "sl_matches": sl.matches,
                    "pos_MID": 1 if pos == "MID" else 0,
                    "pos_FWD": 1 if pos == "FWD" else 0,
                    "pos_DEF": 1 if pos == "DEF" else 0,
                    "pos_RUC": 1 if pos == "RUC" else 0,
                    "disposals": sl.disposals or 0,
                    "kicks": sl.kicks or 0,
                    "handballs": sl.handballs or 0,
                    "marks": sl.marks or 0,
                    "goals_per_game": gpg,
                    "behinds": sl.behinds or 0,
                    "tackles": sl.tackles or 0,
                    "hitouts": sl.hitouts or 0,
                    "contested_possessions": sl.contested_possessions or 0,
                    "uncontested_possessions": sl.uncontested_possessions or 0,
                    "clearances": sl.clearances or 0,
                    "inside_fifties": sl.inside_fifties or 0,
                    "rebounds": sl.rebounds or 0,
                    "intercepts": sl.intercepts or 0,
                    "contested_marks": sl.contested_marks or 0,
                    "score_involvements": sl.score_involvements or 0,
                    "disposal_efficiency": sl.disposal_efficiency or 0,
                    "tackles_inside_50": sl.tackles_inside_50 or 0,
                    "frees_for": sl.frees_for or 0,
                    "frees_against": sl.frees_against or 0,
                    "years_gap": afl.year - sl.season,
                }
                targets = {
                    "afl_disposals": afl.disposals or 0,
                    "afl_marks": afl.marks or 0,
                    "afl_goals": afl.goals or 0,
                    "afl_tackles": afl.tackles or 0,
                    "afl_hitouts": afl.hitouts or 0,
                    "afl_contested_possessions": afl.cp or 0,
                    "afl_clearances": afl.clearances or 0,
                    "afl_sc_avg": afl.sc or 0,
                }
                samples.append((features, targets))

    logger.info("Built %d training samples from %d players", len(samples), len(player_sl))
    return samples


def _peak_age_factor(age: int, position: str) -> float:
    """Age curve multiplier. Peak years differ by position."""
    pos = _pos_group(position)
    if pos == "RUC":
        peak = 28
    elif pos == "FWD":
        peak = 27
    else:
        peak = 26
    diff = abs(age - peak)
    if age < peak:
        return 1.0 + diff * 0.02
    else:
        return max(0.7, 1.0 - diff * 0.03)


def train_model():
    """Train the scouting projection model and save to disk."""
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.multioutput import MultiOutputRegressor

    samples = _build_training_data()
    if len(samples) < 50:
        logger.warning("Not enough training data (%d samples)", len(samples))
        return None

    feature_names = sorted(samples[0][0].keys())
    target_names = sorted(samples[0][1].keys())

    X = np.array([[s[0][f] for f in feature_names] for s in samples])
    Y = np.array([[s[1][t] for t in target_names] for s in samples])

    model = MultiOutputRegressor(
        GradientBoostingRegressor(
            n_estimators=200, max_depth=4, learning_rate=0.1,
            min_samples_leaf=10, subsample=0.8, random_state=42,
        )
    )
    model.fit(X, Y)

    from sklearn.metrics import r2_score, mean_absolute_error
    preds = model.predict(X)
    for i, t in enumerate(target_names):
        r2 = r2_score(Y[:, i], preds[:, i])
        mae = mean_absolute_error(Y[:, i], preds[:, i])
        logger.info("  %s: R²=%.3f  MAE=%.2f", t, r2, mae)

    artifact = {
        "model": model,
        "feature_names": feature_names,
        "target_names": target_names,
        "n_samples": len(samples),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    os.makedirs(os.path.dirname(_MODEL_PATH), exist_ok=True)
    with open(_MODEL_PATH, "wb") as f:
        pickle.dump(artifact, f)

    logger.info("Model saved to %s (%d samples)", _MODEL_PATH, len(samples))
    return artifact


def _load_model():
    if not os.path.exists(_MODEL_PATH):
        return None
    with open(_MODEL_PATH, "rb") as f:
        return pickle.load(f)


def predict_afl_output(player_id: int = None, sl_row: StateLeagueStat = None) -> dict | None:
    """Predict AFL output for a state league player."""
    artifact = _load_model()
    if not artifact:
        return None

    if sl_row is None and player_id:
        sl_row = StateLeagueStat.query.filter_by(player_id=player_id)\
            .order_by(StateLeagueStat.season.desc()).first()
    if not sl_row or not sl_row.matches or sl_row.matches < 2:
        return None

    player = db.session.get(AflPlayer, sl_row.player_id) if sl_row.player_id else None
    pos = player.position if player else None
    age = sl_row.age or (player.age if player else 22)
    gpg = (sl_row.goals / sl_row.matches) if sl_row.goals else 0

    features = {
        "age": age,
        "sl_matches": sl_row.matches,
        "pos_MID": 1 if _pos_group(pos) == "MID" else 0,
        "pos_FWD": 1 if _pos_group(pos) == "FWD" else 0,
        "pos_DEF": 1 if _pos_group(pos) == "DEF" else 0,
        "pos_RUC": 1 if _pos_group(pos) == "RUC" else 0,
        "disposals": sl_row.disposals or 0,
        "kicks": sl_row.kicks or 0,
        "handballs": sl_row.handballs or 0,
        "marks": sl_row.marks or 0,
        "goals_per_game": gpg,
        "behinds": sl_row.behinds or 0,
        "tackles": sl_row.tackles or 0,
        "hitouts": sl_row.hitouts or 0,
        "contested_possessions": sl_row.contested_possessions or 0,
        "uncontested_possessions": sl_row.uncontested_possessions or 0,
        "clearances": sl_row.clearances or 0,
        "inside_fifties": sl_row.inside_fifties or 0,
        "rebounds": sl_row.rebounds or 0,
        "intercepts": sl_row.intercepts or 0,
        "contested_marks": sl_row.contested_marks or 0,
        "score_involvements": sl_row.score_involvements or 0,
        "disposal_efficiency": sl_row.disposal_efficiency or 0,
        "tackles_inside_50": sl_row.tackles_inside_50 or 0,
        "frees_for": sl_row.frees_for or 0,
        "frees_against": sl_row.frees_against or 0,
        "years_gap": 0,
    }

    fn = artifact["feature_names"]
    X = np.array([[features[f] for f in fn]])
    preds = artifact["model"].predict(X)[0]
    tn = artifact["target_names"]
    raw = {tn[i]: round(float(preds[i]), 1) for i in range(len(tn))}

    age_mult = _peak_age_factor(age, pos or "MID")

    breakout_score = _calc_breakout_score(raw, age, sl_row, pos)

    projections = {}
    for yr_offset in range(3):
        proj_age = age + yr_offset
        mult = _peak_age_factor(proj_age, pos or "MID")
        yr_proj = {}
        for k, v in raw.items():
            yr_proj[k] = round(v * mult, 1)
        yr_proj["age"] = proj_age
        yr_proj["year"] = sl_row.season + yr_offset + 1
        projections[f"year_{yr_offset + 1}"] = yr_proj

    return {
        "predicted_afl": raw,
        "projections": projections,
        "breakout_probability": breakout_score,
        "age": age,
        "position": pos,
        "position_group": _pos_group(pos),
        "age_factor": round(age_mult, 2),
    }


def _calc_breakout_score(predicted: dict, age: int, sl: StateLeagueStat, position: str) -> float:
    """0-100 breakout probability based on predicted AFL output + profile."""
    sc = predicted.get("afl_sc_avg", 0)
    disp = predicted.get("afl_disposals", 0)

    score = 0
    if sc >= 90:
        score += 30
    elif sc >= 75:
        score += 20
    elif sc >= 60:
        score += 10

    if disp >= 20:
        score += 15
    elif disp >= 15:
        score += 10

    if age <= 22:
        score += 20
    elif age <= 24:
        score += 12
    elif age <= 26:
        score += 5

    if sl.matches and sl.matches >= 10:
        score += 10
    elif sl.matches and sl.matches >= 5:
        score += 5

    pos = _pos_group(position)
    if pos == "MID" and (sl.clearances or 0) >= 4:
        score += 10
    elif pos == "FWD" and (sl.goals or 0) / max(sl.matches or 1, 1) >= 2:
        score += 10
    elif pos == "DEF" and (sl.intercepts or 0) >= 4:
        score += 10
    elif pos == "RUC" and (sl.hitouts or 0) >= 20:
        score += 10

    if sl.contested_possessions and sl.contested_possessions >= 8:
        score += 5

    return min(score, 100)


def bulk_predict(season: int = None, competition: str = None,
                 min_matches: int = 3, afl_listed_only: bool = False) -> list[dict]:
    """Run predictions for all eligible state league players."""
    artifact = _load_model()
    if not artifact:
        return []

    q = StateLeagueStat.query
    if season:
        q = q.filter(StateLeagueStat.season == season)
    if competition:
        q = q.filter(StateLeagueStat.competition == competition)
    q = q.filter(StateLeagueStat.matches >= min_matches)
    if afl_listed_only:
        q = q.filter(StateLeagueStat.is_afl_listed == True)

    rows = q.all()
    results = []
    for sl in rows:
        pred = predict_afl_output(sl_row=sl)
        if not pred:
            continue
        results.append({
            "player_name": sl.player_name,
            "player_id": sl.player_id,
            "team": sl.team,
            "competition": sl.competition,
            "season": sl.season,
            "is_afl_listed": sl.is_afl_listed,
            "sl_matches": sl.matches,
            "sl_disposals": sl.disposals,
            "sl_goals_per_game": round((sl.goals / sl.matches), 1) if sl.goals and sl.matches else 0,
            "sl_tackles": sl.tackles,
            **pred,
        })

    results.sort(key=lambda x: x["breakout_probability"], reverse=True)
    return results

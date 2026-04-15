"""State league → AFL projection model.

Trains position-aware models on players who've played both levels.
Predicts AFL output for current state league players.

Key insight: age fundamentally changes translation. A 20yo dominating
VFL is discovering their game. A 30yo dominating VFL is either
rehabbing or playing a different role when promoted. The model learns
this from age × stat interaction features.
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


def _build_features(sl, age: int, pos: str, matches: int, goals_total: float) -> dict:
    """Build feature dict from a state league row. Includes age × stat interactions."""
    gpg = (goals_total / matches) if goals_total and matches else 0
    disp = sl.disposals or 0
    cp = sl.contested_possessions or 0
    clr = sl.clearances or 0
    ho = sl.hitouts or 0
    marks = sl.marks or 0
    tackles = sl.tackles or 0
    i50 = sl.inside_fifties or 0

    return {
        "age": age,
        "age_sq": age * age,
        "sl_matches": matches,
        "pos_MID": 1 if pos == "MID" else 0,
        "pos_FWD": 1 if pos == "FWD" else 0,
        "pos_DEF": 1 if pos == "DEF" else 0,
        "pos_RUC": 1 if pos == "RUC" else 0,
        "disposals": disp,
        "kicks": sl.kicks or 0,
        "handballs": sl.handballs or 0,
        "marks": marks,
        "goals_per_game": gpg,
        "behinds": sl.behinds or 0,
        "tackles": tackles,
        "hitouts": ho,
        "contested_possessions": cp,
        "uncontested_possessions": sl.uncontested_possessions or 0,
        "clearances": clr,
        "inside_fifties": i50,
        "rebounds": sl.rebounds or 0,
        "intercepts": sl.intercepts or 0,
        "contested_marks": sl.contested_marks or 0,
        "score_involvements": sl.score_involvements or 0,
        "disposal_efficiency": sl.disposal_efficiency or 0,
        "tackles_inside_50": sl.tackles_inside_50 or 0,
        "frees_for": sl.frees_for or 0,
        "frees_against": sl.frees_against or 0,
        # Age × stat interactions — lets the model learn that
        # 25 disposals at age 20 means something different to age 30
        "age_x_disp": age * disp,
        "age_x_cp": age * cp,
        "age_x_clr": age * clr,
        "age_x_goals": age * gpg,
        "age_x_ho": age * ho,
        "age_x_marks": age * marks,
        "age_x_tackles": age * tackles,
        "age_x_i50": age * i50,
        # Young player flag — explicit signal for sub-23
        "is_young": 1 if age <= 23 else 0,
        "is_prime": 1 if 24 <= age <= 27 else 0,
        "is_veteran": 1 if age >= 28 else 0,
    }


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

            for afl in player_afl[pid]:
                if afl.year < sl.season:
                    continue
                if afl.year > sl.season + 2:
                    continue

                age = sl.age or 22
                features = _build_features(sl, age, pos, sl.matches, sl.goals)
                features["years_gap"] = afl.year - sl.season

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
            n_estimators=250, max_depth=5, learning_rate=0.08,
            min_samples_leaf=8, subsample=0.8, random_state=42,
        )
    )
    model.fit(X, Y)

    from sklearn.metrics import r2_score, mean_absolute_error
    preds = model.predict(X)
    for i, t in enumerate(target_names):
        r2 = r2_score(Y[:, i], preds[:, i])
        mae = mean_absolute_error(Y[:, i], preds[:, i])
        logger.info("  %s: R²=%.3f  MAE=%.2f", t, r2, mae)

    # Train a separate breakout classifier
    # "Breakout" = player achieves SC avg >= 70 at AFL level within 2 years
    breakout_labels = (Y[:, target_names.index("afl_sc_avg")] >= 70).astype(int)
    from sklearn.ensemble import GradientBoostingClassifier
    breakout_model = GradientBoostingClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.08,
        min_samples_leaf=10, subsample=0.8, random_state=42,
    )
    breakout_model.fit(X, breakout_labels)
    from sklearn.metrics import roc_auc_score
    bp = breakout_model.predict_proba(X)[:, 1]
    auc = roc_auc_score(breakout_labels, bp)
    logger.info("  breakout_classifier: AUC=%.3f  (threshold: SC>=70)", auc)

    artifact = {
        "model": model,
        "breakout_model": breakout_model,
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
    if not sl_row or not sl_row.matches:
        return None

    player = db.session.get(AflPlayer, sl_row.player_id) if sl_row.player_id else None
    pos = player.position if player else None
    age = sl_row.age or (player.age if player else 22)
    pos_grp = _pos_group(pos)

    features = _build_features(sl_row, age, pos_grp, sl_row.matches, sl_row.goals)
    features["years_gap"] = 0

    fn = artifact["feature_names"]
    X = np.array([[features[f] for f in fn]])

    preds = artifact["model"].predict(X)[0]
    tn = artifact["target_names"]
    raw = {tn[i]: round(max(0, float(preds[i])), 1) for i in range(len(tn))}

    # Breakout probability from the trained classifier
    breakout_model = artifact.get("breakout_model")
    if breakout_model:
        bp = float(breakout_model.predict_proba(X)[0, 1])
    else:
        bp = 0.0

    # Draft probability for unlisted players
    draft_prob = None
    if not sl_row.is_afl_listed:
        if age <= 21:
            draft_prob = min(bp * 1.2, 0.95)
        elif age <= 23:
            draft_prob = bp * 0.6
        elif age <= 25:
            draft_prob = bp * 0.2
        else:
            draft_prob = bp * 0.03

    # 3-year projections with age awareness baked into the model
    projections = {}
    for yr_offset in range(3):
        proj_features = dict(features)
        proj_age = age + yr_offset + 1
        proj_features["age"] = proj_age
        proj_features["age_sq"] = proj_age * proj_age
        proj_features["is_young"] = 1 if proj_age <= 23 else 0
        proj_features["is_prime"] = 1 if 24 <= proj_age <= 27 else 0
        proj_features["is_veteran"] = 1 if proj_age >= 28 else 0
        proj_features["years_gap"] = yr_offset + 1
        # Update age interactions
        for stat_key in ["disp", "cp", "clr", "goals", "ho", "marks", "tackles", "i50"]:
            base_key = {
                "disp": "disposals", "cp": "contested_possessions",
                "clr": "clearances", "goals": "goals_per_game",
                "ho": "hitouts", "marks": "marks", "tackles": "tackles",
                "i50": "inside_fifties",
            }[stat_key]
            proj_features[f"age_x_{stat_key}"] = proj_age * proj_features[base_key]

        X_proj = np.array([[proj_features[f] for f in fn]])
        proj_preds = artifact["model"].predict(X_proj)[0]
        yr_proj = {tn[i]: round(max(0, float(proj_preds[i])), 1) for i in range(len(tn))}
        yr_proj["age"] = proj_age
        yr_proj["year"] = sl_row.season + yr_offset + 1
        projections[f"year_{yr_offset + 1}"] = yr_proj

    # Keeper league relevance tag
    tag, tag_css = _relevance_tag(raw, bp, age, sl_row.is_afl_listed, draft_prob)

    return {
        "predicted_afl": raw,
        "projections": projections,
        "breakout_probability": round(bp * 100),
        "draft_probability": round(draft_prob * 100) if draft_prob is not None else None,
        "age": age,
        "position": pos,
        "position_group": pos_grp,
        "tag": tag,
        "tag_css": tag_css,
    }


def _relevance_tag(predicted: dict, bp: float, age: int,
                   is_listed: bool, draft_prob: float | None) -> tuple[str, str]:
    """Assign a keeper league relevance tag."""
    sc = predicted.get("afl_sc_avg", 0)

    if not is_listed:
        if draft_prob and draft_prob > 0.3 and age <= 22:
            return "Draft Watch", "tag-watch"
        if draft_prob and draft_prob > 0.15:
            return "On Radar", "tag-radar"
        return "Development", "tag-dev"

    if sc >= 85 and age <= 25:
        return "Star Potential", "tag-star"
    if sc >= 75 and age <= 23:
        return "Breakout Candidate", "tag-breakout"
    if sc >= 70 and bp >= 0.4:
        return "Emerging", "tag-emerging"
    if sc >= 60 and age <= 24:
        return "Developing", "tag-developing"
    if age >= 28:
        return "Veteran", "tag-veteran"
    if sc >= 50:
        return "Depth", "tag-depth"
    return "Fringe", "tag-fringe"


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

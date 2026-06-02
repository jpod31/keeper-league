"""Deep Intelligence — the heavier, novel analytics behind the Command Deck.

Nothing here is a basic average. The four engines:

1. Style Universe  — a PCA(3) embedding of every player's per-game stat
   fingerprint, k-means clustered into data-driven archetypes. This is the
   3D centrepiece: players placed in a "playing-style space", not a VORP scatter.
2. Season Outlook  — Monte-Carlo simulation of the remaining fixtures using each
   squad's score distribution → finals odds, projected record, seed distribution,
   premiership odds.
3. Squad DNA       — portfolio analytics on the team's weekly score: floor/median/
   ceiling, scoring concentration (HHI reliance), fragility (drop if your gun is
   out), and per-player leverage on a typical week.
4. Narrative       — a short, computed story tying the numbers together.

numpy only (PCA via SVD, k-means via Lloyd's) — no sklearn dependency.
"""

import numpy as np

from models.database import (
    db, FantasyTeam, FantasyRoster, AflPlayer, PlayerStat, Fixture,
    SeasonStanding, SeasonConfig,
)
from models.player_usage import _primary_pos

_FEATS = ["kicks", "handballs", "marks", "tackles", "goals", "hitouts",
          "clearances", "inside_fifties", "contested_possessions",
          "pressure_acts", "metres_gained"]
_FIELD = {"DEF", "MID", "FWD", "RUC", "FLEX"}


# ─────────────────────────── Style Universe ───────────────────────────

def _archetype_name(centroid, feat_names):
    """Name a cluster from its two most distinctive (highest z) features."""
    order = np.argsort(centroid)[::-1]
    top = [feat_names[i] for i in order[:2]]
    has = lambda *xs: any(t in top for t in xs)
    if has("hitouts"):
        return "Ruck engine"
    if has("goals") and not has("clearances", "contested_possessions"):
        return "Goal source"
    if has("clearances", "contested_possessions"):
        return "Inside bull"
    if has("tackles", "pressure_acts"):
        return "Pressure forward"
    if has("metres_gained", "marks") and has("kicks", "metres_gained", "marks"):
        return "Rebounding general"
    if has("handballs"):
        return "Outside link"
    if has("kicks", "marks"):
        return "Distributor"
    return "Utility"


def compute_style_universe(league_id, team_id, year):
    """PCA(3) embedding of per-game stat fingerprints + k-means archetypes."""
    from sqlalchemy import func
    aggs = [func.avg(getattr(PlayerStat, f)).label(f) for f in _FEATS]
    rows = (
        db.session.query(
            PlayerStat.player_id, func.count(PlayerStat.id).label("g"),
            func.avg(PlayerStat.supercoach_score).label("sc"), *aggs)
        .filter(PlayerStat.year >= year - 2)
        .group_by(PlayerStat.player_id)
        .having(func.count(PlayerStat.id) >= 5)
        .all()
    )
    if len(rows) < 8:
        return {"has_data": False}

    pids = [r.player_id for r in rows]
    X = np.array([[float(getattr(r, f) or 0.0) for f in _FEATS] for r in rows], dtype=float)
    sc = np.array([float(r.sc or 0.0) for r in rows])

    # standardise columns
    mu, sd = X.mean(0), X.std(0)
    sd[sd == 0] = 1.0
    Z = (X - mu) / sd

    # PCA via SVD → 3 components
    Zc = Z - Z.mean(0)
    _, _, Vt = np.linalg.svd(Zc, full_matrices=False)
    comps = Vt[:3]
    coords = Zc @ comps.T
    # scale each axis to a tidy [-10, 10]
    for j in range(coords.shape[1]):
        m = np.abs(coords[:, j]).max() or 1.0
        coords[:, j] = coords[:, j] / m * 10.0

    # k-means (Lloyd's) on the standardised features
    k = min(6, max(2, len(rows) // 6))
    np.random.seed(42)
    init = Z[np.random.choice(len(Z), k, replace=False)]
    cent = init.copy()
    labels = np.zeros(len(Z), dtype=int)
    for _ in range(25):
        d = ((Z[:, None, :] - cent[None, :, :]) ** 2).sum(2)
        new = d.argmin(1)
        if np.array_equal(new, labels):
            labels = new
            break
        labels = new
        for c in range(k):
            if (labels == c).any():
                cent[c] = Z[labels == c].mean(0)
    names = [_archetype_name(cent[c], _FEATS) for c in range(k)]

    owned = {r.player_id for r in FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all()}
    nodes = []
    for i, pid in enumerate(pids):
        p = db.session.get(AflPlayer, pid)
        if not p:
            continue
        nodes.append({
            "id": pid, "name": p.name, "pos": _primary_pos(p),
            "x": round(float(coords[i, 0]), 2), "y": round(float(coords[i, 1]), 2),
            "z": round(float(coords[i, 2]), 2),
            "cluster": int(labels[i]), "archetype": names[labels[i]],
            "sc": round(float(sc[i]), 1), "owned": pid in owned,
        })
    clusters = [{"id": c, "name": names[c], "n": int((labels == c).sum())} for c in range(k)]
    # variance explained by the 3 shown axes
    sv = np.linalg.svd(Zc, compute_uv=False)
    var3 = float((sv[:3] ** 2).sum() / (sv ** 2).sum() * 100)
    return {"has_data": True, "nodes": nodes, "clusters": clusters,
            "variance_explained": round(var3), "n_players": len(nodes),
            "owned_count": sum(1 for n in nodes if n["owned"])}


# ─────────────────────────── team score model ───────────────────────────

def _team_score_model(team_id, cap_enabled):
    """Mean + variance of a team's weekly score from on-field starters."""
    means, vars, top = [], [], None
    cap_i = None
    starters = []
    for r in FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all():
        if r.is_benched or r.is_emergency or (r.position_code or "").upper() not in _FIELD:
            continue
        p = db.session.get(AflPlayer, r.player_id)
        if p and (p.sc_avg or 0) > 0:
            starters.append((p, r))
    if not starters:
        return None
    for i, (p, r) in enumerate(starters):
        m = p.sc_avg or 0
        s = max(8.0, 0.25 * m)
        if cap_enabled and r.is_captain:
            m, s, cap_i = m * 2, s * 2, i
        means.append(m); vars.append(s * s)
    means, vars = np.array(means), np.array(vars)
    return {
        "starters": starters, "means": means, "vars": vars, "cap_i": cap_i,
        "mean": float(means.sum()), "sd": float(np.sqrt(vars.sum())),
    }


# ─────────────────────────── Season Outlook ───────────────────────────

def compute_season_outlook(league_id, team_id, year, n=4000):
    """Monte-Carlo the remaining fixtures → finals odds, projected record, seeds."""
    sc_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    cap_enabled = sc_cfg.captain_scoring_enabled if (sc_cfg and sc_cfg.captain_scoring_enabled is not None) else True

    teams = FantasyTeam.query.filter_by(league_id=league_id).all()
    if len(teams) < 2:
        return {"has_data": False, "reason": "solo"}
    models = {t.id: _team_score_model(t.id, cap_enabled) for t in teams}
    if not models.get(team_id):
        return {"has_data": False}

    standings = {s.team_id: s for s in SeasonStanding.query.filter_by(league_id=league_id, year=year).all()}
    base_w = {t.id: (standings[t.id].wins if t.id in standings else 0) for t in teams}

    remaining = (Fixture.query
                 .filter_by(league_id=league_id, year=year)
                 .filter(Fixture.status.in_(["scheduled", "live"])).all())
    n_teams = len(teams)
    finals_n = max(2, min(n_teams - 1, n_teams // 2 if n_teams >= 6 else 2))
    ids = [t.id for t in teams]

    # pre-draw all team scores for all sims/rounds we need
    sims_wins = {tid: np.full(n, float(base_w.get(tid, 0))) for tid in ids}
    for fx in remaining:
        ha, aw = fx.home_team_id, fx.away_team_id
        ma, mb = models.get(ha), models.get(aw)
        if not ma or not mb:
            continue
        sa = np.random.normal(ma["mean"], ma["sd"], n)
        sb = np.random.normal(mb["mean"], mb["sd"], n)
        sims_wins[ha] += (sa >= sb); sims_wins[aw] += (sb > sa)

    # rank each sim → seed of our team; finals if seed <= finals_n
    W = np.stack([sims_wins[t] for t in ids], 1)  # n x teams
    # add tiny noise to break ties deterministically by points (use mean score as tiebreak)
    tiebreak = np.array([models[t]["mean"] if models[t] else 0 for t in ids])
    W = W + tiebreak[None, :] * 1e-4
    our = ids.index(team_id)
    ranks = (W > W[:, our][:, None]).sum(1) + 1  # our seed each sim
    finals_pct = float((ranks <= finals_n).mean() * 100)
    seed_dist = [int((ranks == s).sum()) for s in range(1, n_teams + 1)]
    proj_wins = float(np.median(sims_wins[team_id]))
    premier_pct = float((ranks == 1).mean() * 100)

    return {
        "has_data": True, "finals_pct": round(finals_pct), "finals_n": finals_n,
        "n_teams": n_teams, "proj_wins": round(proj_wins, 1),
        "current_wins": base_w.get(team_id, 0), "remaining": len(remaining),
        "seed_dist": seed_dist, "median_seed": int(np.median(ranks)),
        "top_seed_pct": round(premier_pct),
        "your_mean": round(models[team_id]["mean"]), "your_sd": round(models[team_id]["sd"]),
    }


# ─────────────────────────── Squad DNA ───────────────────────────

def compute_squad_dna(league_id, team_id, year, n=6000):
    sc_cfg = SeasonConfig.query.filter_by(league_id=league_id, year=year).first()
    cap_enabled = sc_cfg.captain_scoring_enabled if (sc_cfg and sc_cfg.captain_scoring_enabled is not None) else True
    m = _team_score_model(team_id, cap_enabled)
    if not m:
        return {"has_data": False}
    means, vars = m["means"], m["vars"]
    sims = np.clip(np.random.normal(means, np.sqrt(vars), size=(n, len(means))), 0, None)
    totals = sims.sum(1)

    # scoring concentration (HHI) → reliance
    shares = means / means.sum()
    hhi = float((shares ** 2).sum())
    eff_n = 1.0 / hhi  # effective number of scorers
    top3 = float(np.sort(shares)[::-1][:3].sum() * 100)

    # fragility: drop in mean if the single biggest scorer is out (→ replacement ~ league min starter)
    top_i = int(means.argmax())
    repl = float(np.percentile(means, 20))
    fragility = round(float((means[top_i] - repl) / means.sum() * 100), 1)

    # per-player leverage = contribution to team variance (who drives the swing)
    var_share = vars / vars.sum()
    leverage = []
    for i, (p, r) in enumerate(m["starters"]):
        leverage.append({
            "id": p.id, "name": p.name, "pos": _primary_pos(p),
            "mean_share": round(float(shares[i]) * 100, 1),
            "swing": round(float(var_share[i]) * 100, 1),
            "is_cap": bool(r.is_captain),
        })
    leverage.sort(key=lambda x: -x["mean_share"])

    return {
        "has_data": True,
        "floor": round(float(np.percentile(totals, 10))),
        "median": round(float(np.percentile(totals, 50))),
        "ceiling": round(float(np.percentile(totals, 90))),
        "mean": round(float(totals.mean())), "sd": round(float(totals.std())),
        "cv": round(float(totals.std() / totals.mean() * 100), 1),
        "hhi": round(hhi, 3), "eff_scorers": round(eff_n, 1), "top3_share": round(top3),
        "fragility": fragility, "n_starters": len(means),
        "leverage": leverage[:8],
    }


# ─────────────────────────── batched deck feed ───────────────────────────

def compute_deck(league_id, team_id, year):
    out = {"team_id": team_id}
    try:
        out["universe"] = compute_style_universe(league_id, team_id, year)
    except Exception as e:
        out["universe"] = {"has_data": False, "error": str(e)}
    try:
        out["outlook"] = compute_season_outlook(league_id, team_id, year)
    except Exception as e:
        out["outlook"] = {"has_data": False, "error": str(e)}
    try:
        out["dna"] = compute_squad_dna(league_id, team_id, year)
    except Exception as e:
        out["dna"] = {"has_data": False, "error": str(e)}
    return out

"""Fit the role scoring model from the workbook and the stats in the database.

    python scripts/fit_role_scoring.py                  # report only
    python scripts/fit_role_scoring.py --write          # also write models/role_scoring_fit.json
    python scripts/fit_role_scoring.py --xlsx path.xlsx

It answers two questions, both by role (the workbook's Position and Specific
Position columns), and writes the answers for models/role_scoring.py to use.

1. PEAK. Given what a young player's potential was rated at the time, and the
   kind of player he is, what did he go on to average in SuperCoach?
   Sample: every (player, base year) where the workbook has his potential for
   that year, he was 22 or younger then, and he has since had a season of 8+
   games at least two years later. The target is his best such season. One
   line on potential for everyone, then an offset per role (the role's average
   miss, shrunk toward zero when it has few players).

2. NOW. Given the rating a player took into a season, and the kind of player
   he is, what did he average that season?
   Sample: every player-season of 8+ games in the last six seasons, against
   the workbook's rating column for that year. A line per specific role where
   there are enough seasons, else per broad role, else one line for everyone.
   This is what a player with few or no games is expected to score, and it is
   what a thin average is pulled toward (see the last table in the report).

Read this before trusting it:
  - The role is TODAY's label in the workbook, not the label he had back then.
    A player who turned into a midfielder is counted as one from the start.
  - Only players still on an AFL list are in the workbook, and only those who
    became regulars have a target. The numbers are "if he plays", not the
    chance that he does.
  - Every error in the report is on players held out of the fit, and the
    report shows it with and without role, so the gain from role is measured.
  - A bonus for a forward or defender SuperCoach also lists as a midfielder is
    measured and reported, but NOT written to the model: in 2026 it was worth
    1.5 points and did not reduce the held-out error.

Rerun it each November after the workbook rolls over; read-only unless --write.
"""

import argparse
import json
import os
import random
import statistics as st
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

MIN_GAMES = 8        # a season counts once he has played this many games
MAX_AGE = 22         # "young" for the peak fit
SHRINK = 5           # an offset is the role's total miss / (players + SHRINK)
MIN_ROLE_N = 5       # peak: roles with fewer samples get no offset of their own
LINE_DETAIL_N = 60   # now: seasons needed for a specific role to get its own line
LINE_ROLE_N = 40     # now: seasons needed for a broad role to get its own line
NOW_SEASONS = 6
SHRINK_GAMES = 10    # a thin average is mixed with this many games of the NOW line


def _fit(pts):
    n = len(pts)
    mx = sum(x for x, _ in pts) / n
    my = sum(y for _, y in pts) / n
    den = sum((x - mx) ** 2 for x, _ in pts)
    b = sum((x - mx) * (y - my) for x, y in pts) / den if den else 0.0
    return my - b * mx, b


def _rmse(errs):
    return (sum(e * e for e in errs) / len(errs)) ** 0.5, sum(abs(e) for e in errs) / len(errs)


def load(xlsx, season_year):
    """(peak samples, season rows) from the workbook and player_stat."""
    import openpyxl
    from models.database import db, AflPlayer, PlayerStat
    from models.role_scoring import clean_role, clean_detail
    from sqlalchemy import func

    by_year = defaultdict(dict)
    q = (db.session.query(PlayerStat.player_id, PlayerStat.year,
                          func.avg(PlayerStat.supercoach_score), func.count(PlayerStat.id))
         .filter(PlayerStat.supercoach_score.isnot(None))
         .group_by(PlayerStat.player_id, PlayerStat.year))
    for pid, year, avg, n in q:
        by_year[pid][year] = (avg, n)
    by_name = {p.name: p for p in AflPlayer.query.all()}

    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb["Player Database"]
    it = ws.iter_rows(values_only=True)
    h = [str(x).strip() if x is not None else "" for x in next(it)]

    def num(v):
        return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

    peak, seasons = [], []
    for r in it:
        if not r[0] or not isinstance(r[0], str):
            continue
        p = by_name.get(r[0].strip())
        age = num(r[h.index("Age")])
        if p is None:
            continue
        role = clean_role(r[h.index("Position")])
        detail = clean_detail(r[h.index("Specific Position")])
        base = {"name": p.name, "role": role, "detail": detail, "sc_pos": p.position or ""}

        if age is not None:
            for year in range(season_year - 8, season_year - 3):
                col = f"Potential {year}"
                if col not in h:
                    continue
                pot = num(r[h.index(col)])
                age_then = age - (season_year - year)
                if pot is None or not (17 <= age_then <= MAX_AGE):
                    continue
                later = [a for y, (a, n) in by_year[p.id].items() if y >= year + 2 and n >= MIN_GAMES]
                if later:
                    peak.append(dict(base, x=pot, y=max(later)))

        for year in range(season_year - NOW_SEASONS, season_year):
            if str(year) not in h:
                continue
            rating = num(r[h.index(str(year))])
            got = by_year[p.id].get(year)
            if rating is not None and got:
                seasons.append(dict(base, year=year, x=rating, y=got[0], n=got[1]))
    wb.close()
    return peak, seasons


# ── Peak: one line on potential, an offset per role ──────────────────

def fit_peak(samples):
    a, b = _fit([(s["x"], s["y"]) for s in samples])
    miss = lambda s: s["y"] - (a + b * s["x"])

    def offsets(key):
        g = defaultdict(list)
        for s in samples:
            if s[key]:
                g[s[key]].append(miss(s))
        return ({k: round(sum(v) / (len(v) + SHRINK), 2) for k, v in g.items() if len(v) >= MIN_ROLE_N},
                {k: len(v) for k, v in g.items()})

    by_detail, n_detail = offsets("detail")
    by_role, n_role = offsets("role")
    off = lambda s: by_detail.get(s["detail"], by_role.get(s["role"], 0.0))
    fwd_def = [s for s in samples if s["role"] not in ("MID", "RUC")]
    tagged = [miss(s) - off(s) for s in fwd_def if "MID" in s["sc_pos"]]
    plain = [miss(s) - off(s) for s in fwd_def if "MID" not in s["sc_pos"]]
    mid_tag = 0.0
    if tagged and plain:
        mid_tag = max(0.0, sum(tagged) / (len(tagged) + SHRINK) - sum(plain) / (len(plain) + SHRINK))
    return {"intercept": round(a, 2), "slope": round(b, 3), "by_detail": by_detail, "by_role": by_role,
            "mid_tag": round(mid_tag, 2), "n_detail": n_detail, "n_role": n_role, "n_mid_tag": len(tagged)}


def predict_peak(m, s, use):
    v = m["intercept"] + m["slope"] * s["x"]
    if use == "none":
        return v
    if use == "role":
        return v + m["by_role"].get(s["role"], 0.0)
    v += m["by_detail"].get(s["detail"], m["by_role"].get(s["role"], 0.0))
    if use == "full" and s["role"] not in ("MID", "RUC") and "MID" in s["sc_pos"]:
        v += m["mid_tag"]
    return v


# ── Now: a line on rating per role ───────────────────────────────────

def fit_now(samples):
    lines = lambda key, min_n: {
        k: [round(c, 3) for c in _fit(v)]
        for k, v in _group(samples, key).items() if k and len(v) >= min_n}
    return {"pooled": [round(c, 3) for c in _fit([(s["x"], s["y"]) for s in samples])],
            "by_role": lines("role", LINE_ROLE_N), "by_detail": lines("detail", LINE_DETAIL_N)}


def _group(samples, key):
    g = defaultdict(list)
    for s in samples:
        g[s[key]].append((s["x"], s["y"]))
    return g


def predict_now(m, s, use="detail"):
    line = m["pooled"]
    if use != "none":
        line = m["by_role"].get(s["role"], line)
        if use == "detail":
            line = m["by_detail"].get(s["detail"], line)
    return line[0] + line[1] * s["x"]


def cross_validate(samples, fit, predict, layers, folds=5, reps=10, seed=7):
    """Error on players held out of the fit, for each layer of a model."""
    names = sorted({s["name"] for s in samples})
    rng = random.Random(seed)
    errs = {use: [] for use in ["mean"] + layers}
    for _ in range(reps):
        rng.shuffle(names)
        fold = {n: i % folds for i, n in enumerate(names)}
        for f in range(folds):
            train = [s for s in samples if fold[s["name"]] != f]
            test = [s for s in samples if fold[s["name"]] == f]
            mean = st.mean(s["y"] for s in train)
            errs["mean"] += [mean - s["y"] for s in test]
            m = fit(train)
            for use in layers:
                errs[use] += [predict(m, s, use) - s["y"] for s in test]
    return {use: _rmse(e) for use, e in errs.items()}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--xlsx")
    ap.add_argument("--year", type=int)
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    os.environ["RATINGS_XLSX_PATH"] = os.devnull + ".none"
    import config
    from app import create_app
    path = args.xlsx or os.path.join(config.DATA_DIR, "ratings.xlsx")
    if not os.path.exists(path):
        sys.exit(f"Workbook not found: {path}")
    year = args.year or config.CURRENT_YEAR

    app = create_app()
    with app.app_context():
        peak_s, seasons = load(path, year)
    now_s = [s for s in seasons if s["n"] >= MIN_GAMES]
    if len(peak_s) < 100 or len(now_s) < 300:
        sys.exit(f"Too little to fit: {len(peak_s)} peak samples, {len(now_s)} seasons.")

    # ── Peak
    peak = fit_peak(peak_s)
    cv = cross_validate(peak_s, fit_peak, predict_peak, ["none", "role", "detail", "full"], reps=20)
    print(f"\n1. PEAK: {len(peak_s)} (player, base year) pairs from {len({s['name'] for s in peak_s})} players")
    print(f"   best later season = {peak['intercept']} + {peak['slope']} x potential then, plus the role's offset")
    print("   Error on held-out players (SuperCoach points):")
    for use, label in [("mean", "no model, the average"), ("none", "potential only"), ("role", "+ broad role"),
                       ("detail", "+ specific role (the model)"), ("full", "+ MID tag (not used)")]:
        print(f"     {label:30} RMSE {cv[use][0]:5.2f}   mean miss {cv[use][1]:5.2f}")
    print("   Offset by specific role:")
    for k, v in sorted(peak["by_detail"].items(), key=lambda kv: -kv[1]):
        print(f"     {k:22} {v:+6.1f}   n={peak['n_detail'][k]}")
    print("   Offset by broad role (when the specific role has too few players):")
    for k, v in sorted(peak["by_role"].items(), key=lambda kv: -kv[1]):
        print(f"     {k:22} {v:+6.1f}   n={peak['n_role'][k]}")
    print(f"   MID tag on a forward or defender: {peak['mid_tag']:+.1f}   n={peak['n_mid_tag']}   (reported only)")

    # ── Now
    now = fit_now(now_s)
    cvn = cross_validate(now_s, fit_now, predict_now, ["none", "role", "detail"])
    last = max(s["year"] for s in now_s)
    before = fit_now([s for s in now_s if s["year"] < last])
    held = [s for s in now_s if s["year"] == last]
    print(f"\n2. NOW: {len(now_s)} player-seasons of {MIN_GAMES}+ games, {min(s['year'] for s in now_s)} to {last}")
    print("   Error on held-out players, and on the last season when fitted on the ones before it:")
    for use, label in [("mean", "no model, the average"), ("none", "rating only"), ("role", "+ a line per broad role"),
                       ("detail", "+ a line per specific role (the model)")]:
        oot = ""
        if use != "mean":
            oot = f"   {last} alone: RMSE {_rmse([predict_now(before, s, use) - s['y'] for s in held])[0]:5.2f}"
        print(f"     {label:38} RMSE {cvn[use][0]:5.2f}   mean miss {cvn[use][1]:5.2f}{oot}")
    print("   Expected average at a rating of 65 / 75 / 85:")
    for group, label in (("by_detail", "specific"), ("by_role", "broad")):
        for k, (a, b) in sorted(now[group].items(), key=lambda kv: -(kv[1][0] + kv[1][1] * 85)):
            print(f"     {label:8} {k:22} {a + b * 65:5.0f} {a + b * 75:5.0f} {a + b * 85:5.0f}")
    a, b = now["pooled"]
    print(f"     {'everyone':31} {a + b * 65:5.0f} {a + b * 75:5.0f} {a + b * 85:5.0f}")

    # ── How far to trust a thin average
    rows = {(s["name"], s["year"]): s for s in seasons}
    print(f"\n3. THIN SAMPLES: predicting next season ({MIN_GAMES}+ games) from this one, RMSE")
    print(f"   {'games this season':18} {'n':>5} {'raw average':>12} {'role line':>10} " + " ".join(f"{'mix K=' + str(k):>9}" for k in (4, 10, 20)))
    bands = [("1 to 3", 1, 3), ("4 to 7", 4, 7), ("8 to 14", 8, 14), ("15 or more", 15, 99)]
    for label, lo, hi in bands:
        pairs = [(s, rows[(s["name"], s["year"] + 1)]) for s in seasons
                 if lo <= s["n"] <= hi and (s["name"], s["year"] + 1) in rows and rows[(s["name"], s["year"] + 1)]["n"] >= MIN_GAMES]
        if not pairs:
            continue
        err = lambda f: _rmse([f(s) - nx["y"] for s, nx in pairs])[0]
        mix = lambda k: err(lambda s: (s["n"] * s["y"] + k * predict_now(now, s)) / (s["n"] + k))
        print(f"   {label:18} {len(pairs):5} {err(lambda s: s['y']):12.1f} {err(lambda s: predict_now(now, s)):10.1f} "
              + " ".join(f"{mix(k):9.1f}" for k in (4, 10, 20)))
    print(f"   The model mixes a player's average with {SHRINK_GAMES} games of his role line.")

    if args.write:
        out = os.path.join(os.path.dirname(__file__), "..", "models", "role_scoring_fit.json")
        keep = {
            "season": year,
            "peak": {k: peak[k] for k in ("intercept", "slope", "by_detail", "by_role")},
            "now": now,
            "shrink_games": SHRINK_GAMES,
            "fit": {
                "peak_samples": len(peak_s), "peak_rmse_potential_only": round(cv["none"][0], 2),
                "peak_rmse_with_role": round(cv["detail"][0], 2),
                "now_seasons": len(now_s), "now_rmse_rating_only": round(cvn["none"][0], 2),
                "now_rmse_with_role": round(cvn["detail"][0], 2),
            },
        }
        with open(out, "w", encoding="utf-8", newline="\n") as f:
            json.dump(keep, f, indent=2, sort_keys=True)
            f.write("\n")
        print(f"\nWrote {os.path.normpath(out)}")
    else:
        print("\nReport only. Pass --write to save it.")


if __name__ == "__main__":
    main()

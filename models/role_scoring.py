"""What a player scores in SuperCoach, given the kind of player he is.

Potential alone says a small forward rated to reach 80 is worth what a
midfielder rated to reach 80 is. He is not: a small forward gets the ball far
less, and so do key forwards and key backs. Lucas, 2026-11-25: "it should
include positional type.. key forwards and backs might find it harder to get
supercoach scoring potential.. guys like jasper alger, youve put him up the top
of value but hes always gonna be a small forward so he will struggle".

Three numbers come out of here, all in SuperCoach points:

  expected_now   what a player of his rating and role averages in a season
  output         his average so far, mixed with expected_now when it rests on
                 few games (none at all: expected_now)
  ceiling        what he projects to at his best: his potential, moved by his
                 role, or his output if that is already more

Nothing here is hand-set. `scripts/fit_role_scoring.py` fits it from the
workbook's ratings and potentials through the years against what players went
on to score, and writes `role_scoring_fit.json` beside this file. Its docstring
says what the fit can and cannot tell you, and its report shows the error with
and without role on players held out of the fit. Read it before changing this.

The role is the workbook's: `afl_player.role` is its Position column (MID, RUC,
GD, KD, GF, KF) and `afl_player.role_detail` its Specific Position ("Small
Forward"). To move a player, change his row in the workbook and sync. That is
the lever for a player the label undersells.
"""

import json
import os

_FIT_PATH = os.path.join(os.path.dirname(__file__), "role_scoring_fit.json")

# Used only if the fitted file is missing: one line each, no role effect.
_FALLBACK = {
    "peak": {"intercept": -46.2, "slope": 1.56, "by_detail": {}, "by_role": {}},
    "now": {"pooled": [-84.2, 2.1], "by_detail": {}, "by_role": {}},
    "shrink_games": 10,
}

ROLES = ("MID", "RUC", "GD", "KD", "GF", "KF")
ROLE_NAMES = {"MID": "Midfielder", "RUC": "Ruck", "GD": "General defender", "KD": "Key defender",
              "GF": "General forward", "KF": "Key forward"}
# Spellings seen in the workbook that mean the same thing.
_DETAIL_ALIASES = {"generalmid": "General Midfielder", "general mid": "General Midfielder"}

_model = None


def clean_role(v):
    """The workbook's Position as one of ROLES, or None."""
    s = str(v or "").strip().upper()
    return s if s in ROLES else None


def clean_detail(v):
    """The workbook's Specific Position, tidied, or None."""
    s = " ".join(str(v or "").split())
    if not s:
        return None
    return _DETAIL_ALIASES.get(s.lower(), s)


def model():
    global _model
    if _model is None:
        try:
            with open(_FIT_PATH, encoding="utf-8") as f:
                loaded = json.load(f)
            _model = loaded if "peak" in loaded and "now" in loaded else dict(_FALLBACK)
        except (OSError, ValueError):
            _model = dict(_FALLBACK)
    return _model


def expected_now(rating, role=None, role_detail=None):
    """Average a player of this rating and role puts up in a season he plays."""
    if rating is None:
        return None
    now = model()["now"]
    a, b = now["by_detail"].get(role_detail or "") or now["by_role"].get(role or "") or now["pooled"]
    return max(0.0, a + b * rating)


def output(sc_avg, games_played, rating, role=None, role_detail=None):
    """His average, trusted in proportion to the games behind it.

    Three games at 88 is not an 88 player. Each year's history says a raw
    average from one to three games misses next season by about 22 points, the
    role line alone by 12, and a mix of the two by less than either, at every
    sample size. With no games at all this is the role line.
    """
    prior = expected_now(rating, role, role_detail)
    n = games_played or 0
    if not sc_avg or n <= 0:
        return prior
    if prior is None:
        return sc_avg
    k = model().get("shrink_games", 10)
    return (n * sc_avg + k * prior) / (n + k)


def role_offset(role, role_detail):
    """Peak: points above or below the line for this kind of player."""
    peak = model()["peak"]
    if role_detail and role_detail in peak["by_detail"]:
        return peak["by_detail"][role_detail]
    return peak["by_role"].get(role or "", 0.0)


def projected_peak(potential, role=None, role_detail=None):
    """SuperCoach average he projects to at his best, or None without a potential.

    A bonus for a forward or defender SuperCoach also lists as MID was tried
    (2026-11-25): it was worth 1.5 points and made the error on held-out
    players slightly worse, so it is not in the model. The fit script still
    reports it each year.
    """
    if potential is None:
        return None
    peak = model()["peak"]
    return peak["intercept"] + peak["slope"] * potential + role_offset(role, role_detail)


def ceiling(potential, rating, role, role_detail, sc_avg, games_played):
    """The better of what he projects to and what he already puts up.

    A player who has beaten his role's line (a small forward averaging 85 over
    a full season) is judged on what he does, not on what small forwards
    usually do.
    """
    proj = projected_peak(potential if potential is not None else rating, role, role_detail)
    shown = output(sc_avg, games_played, rating, role, role_detail)
    if proj is None:
        return shown
    return max(proj, shown) if shown is not None else proj

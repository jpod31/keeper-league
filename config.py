"""Central configuration for the Keeper League app."""

import os
from dotenv import load_dotenv

load_dotenv()  # reads .env file if present

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "data"))

# ---------- Flask / SQLAlchemy ----------
_default_key = "keeper-league-dev-key-CHANGE-ME"
SECRET_KEY = os.environ.get("SECRET_KEY", _default_key)
if SECRET_KEY == _default_key and os.environ.get("FLASK_ENV") == "production":
    raise RuntimeError("SECRET_KEY must be set in production — do not use the default dev key")
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "DATABASE_URL",
    "sqlite:///" + os.path.join(DATA_DIR, "keeper_league.db"),
)
SQLALCHEMY_TRACK_MODIFICATIONS = False

# ---------- Session security ----------
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not os.environ.get("FLASK_DEBUG")  # True unless explicitly debugging
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload

# ---------- Email (Flask-Mail) ----------
MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "noreply@keeperlg.com")

# ---------- Push Notifications (VAPID) ----------
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:admin@keeperlg.com")

# ---------- League rules ----------
SQUAD_SIZE = 38
ON_FIELD = 18
BENCH = 5
NUM_TEAMS = 6

POSITIONS = {
    "DEF": 5,
    "MID": 7,
    "FWD": 5,
    "RUC": 1,
}

# ---------- Draft model weights (must sum to 1.0) ----------
DRAFT_WEIGHTS = {
    "sc_average": 0.28,
    "age_factor": 0.22,
    "positional_scarcity": 0.12,
    "trajectory": 0.12,
    "durability": 0.08,
    "rating_potential": 0.18,
}

# ---------- Age curve (legacy — kept for reference) ----------
# The draft model uses a steep power longevity formula:
#   score = ((38 - age) / 20.0) ^ 2.5  →  18yo = 1.0, 28yo = 0.13, 38yo = 0.0
AGE_CURVE = {
    "min_age": 18,
    "max_age": 38,
}

# ---------- Positional scarcity ----------
# Display defaults for the settings page.  The draft engine computes scarcity
# dynamically from the actual player pool (lineup impact × pool depth).
_max_slots = max(POSITIONS.values()) if POSITIONS else 1
POSITIONAL_SCARCITY = {pos: round(count / _max_slots, 2) for pos, count in POSITIONS.items()}

# ---------- Team abbreviations ----------
TEAM_ABBR = {
    "Adelaide": "ADE", "Brisbane Lions": "BL", "Carlton": "CAR",
    "Collingwood": "COL", "Essendon": "ESS", "Fremantle": "FRE",
    "Geelong": "GEE", "Gold Coast": "GC", "GWS Giants": "GWS",
    "Hawthorn": "HAW", "Melbourne": "MEL", "North Melbourne": "NM",
    "Port Adelaide": "PTA", "Richmond": "RIC", "St Kilda": "STK",
    "Sydney": "SYD", "West Coast": "WCE", "Western Bulldogs": "WB",
}

# ---------- Supercoach scraping ----------
CURRENT_YEAR = 2026
SC_ROUNDS = 24          # max rounds in a regular season
SC_HISTORY_YEARS = list(range(2013, 2027))  # historical years for SC data

# ---------- Footywire team slugs ----------
TEAM_SLUGS = {
    "Adelaide":           "adelaide-crows",
    "Brisbane Lions":     "brisbane-lions",
    "Carlton":            "carlton-blues",
    "Collingwood":        "collingwood-magpies",
    "Essendon":           "essendon-bombers",
    "Fremantle":          "fremantle-dockers",
    "Geelong":            "geelong-cats",
    "Gold Coast":         "gold-coast-suns",
    "GWS":                "greater-western-sydney-giants",
    "Hawthorn":           "hawthorn-hawks",
    "Melbourne":          "melbourne-demons",
    "North Melbourne":    "kangaroos",
    "Port Adelaide":      "port-adelaide-power",
    "Richmond":           "richmond-tigers",
    "St Kilda":           "st-kilda-saints",
    "Sydney":             "sydney-swans",
    "West Coast":         "west-coast-eagles",
    "Western Bulldogs":   "western-bulldogs",
}

FOOTYWIRE_BASE = "https://www.footywire.com/afl/footy"
SQUIGGLE_BASE = "https://api.squiggle.com.au/"

# ---------- R / fitzRoy ----------
import shutil as _shutil
RSCRIPT_PATH = os.environ.get("RSCRIPT_PATH") or _shutil.which("Rscript") or r"C:\Program Files (x86)\R\R-4.5.2\bin\Rscript.exe"

# ---------- Team logos + colours ----------
_LOGO_BASE = "https://squiggle.com.au/wp-content/themes/squiggle/assets/images/"
TEAM_LOGOS = {
    "Adelaide":         f"{_LOGO_BASE}Adelaide.png",
    "Brisbane Lions":   f"{_LOGO_BASE}Brisbane.png",
    "Carlton":          f"{_LOGO_BASE}Carlton.png",
    "Collingwood":      f"{_LOGO_BASE}Collingwood.png",
    "Essendon":         f"{_LOGO_BASE}Essendon.png",
    "Fremantle":        f"{_LOGO_BASE}Fremantle.png",
    "Geelong":          f"{_LOGO_BASE}Geelong.png",
    "Gold Coast":       f"{_LOGO_BASE}GoldCoast.png",
    "GWS":              f"{_LOGO_BASE}Giants.png",
    "Hawthorn":         f"{_LOGO_BASE}Hawthorn.png",
    "Melbourne":        f"{_LOGO_BASE}Melbourne.png",
    "North Melbourne":  f"{_LOGO_BASE}NorthMelbourne.png",
    "Port Adelaide":    f"{_LOGO_BASE}PortAdelaide.png",
    "Richmond":         f"{_LOGO_BASE}Richmond.png",
    "St Kilda":         f"{_LOGO_BASE}StKilda.png",
    "Sydney":           f"{_LOGO_BASE}Sydney.png",
    "West Coast":       f"{_LOGO_BASE}WestCoast.png",
    "Western Bulldogs": f"{_LOGO_BASE}Bulldogs.png",
}

_SL_LOGO = "/static/logos/state-league/"
STATE_LEAGUE_LOGOS = {
    # VFL — AFL affiliates
    "Brisbane": f"{_LOGO_BASE}Brisbane.png",
    "Carlton": f"{_LOGO_BASE}Carlton.png",
    "Collingwood": f"{_LOGO_BASE}Collingwood.png",
    "Essendon": f"{_LOGO_BASE}Essendon.png",
    "Geelong": f"{_LOGO_BASE}Geelong.png",
    "Gold Coast": f"{_LOGO_BASE}GoldCoast.png",
    "Greater Western Sydney": f"{_LOGO_BASE}Giants.png",
    "North Melbourne": f"{_LOGO_BASE}NorthMelbourne.png",
    "Richmond": f"{_LOGO_BASE}Richmond.png",
    "St Kilda": f"{_LOGO_BASE}StKilda.png",
    "Sydney": f"{_LOGO_BASE}Sydney.png",
    "Footscray": f"{_LOGO_BASE}Bulldogs.png",
    # VFL — standalone with AFL affiliate logos
    "Box Hill": f"{_LOGO_BASE}Hawthorn.png",
    "Casey": f"{_LOGO_BASE}Melbourne.png",
    "Sandringham": f"{_SL_LOGO}sandringham.png",
    "Southport": f"{_LOGO_BASE}GoldCoast.png",
    "Tasmania": f"{_LOGO_BASE}NorthMelbourne.png",
    # VFL — standalone with own logos
    "Coburg": f"{_SL_LOGO}coburg.png",
    "Williamstown": f"{_SL_LOGO}williamstown.png",
    "Werribee": f"{_SL_LOGO}werribee.png",
    "Frankston": f"{_SL_LOGO}frankston.png",
    "Port Melbourne": f"{_SL_LOGO}port-melbourne.png",
    # SANFL — AFL affiliates
    "Adelaide": f"{_LOGO_BASE}Adelaide.png",
    "Port Adelaide": f"{_LOGO_BASE}PortAdelaide.png",
    # SANFL — standalone with own logos
    "Central District": f"{_SL_LOGO}central-district.png",
    "Glenelg": f"{_SL_LOGO}glenelg.png",
    "North Adelaide": f"{_SL_LOGO}north-adelaide.png",
    "Norwood": f"{_SL_LOGO}norwood.png",
    "South Adelaide": f"{_SL_LOGO}south-adelaide.png",
    "Sturt": f"{_SL_LOGO}sturt.png",
    "West Adelaide": f"{_SL_LOGO}west-adelaide.png",
    "Woodville-West Torrens": f"{_SL_LOGO}woodville-west-torrens.png",
    # WAFL — AFL affiliates
    "West Coast": f"{_LOGO_BASE}WestCoast.png",
    "Peel Thunder": f"{_LOGO_BASE}Fremantle.png",
    # WAFL — standalone
    "Claremont": f"{_SL_LOGO}claremont.png",
    "East Fremantle": f"{_SL_LOGO}east-fremantle.png",
    "East Perth": f"{_SL_LOGO}east-perth.png",
    "Perth": f"{_SL_LOGO}perth.png",
    "South Fremantle": f"{_SL_LOGO}south-fremantle.png",
    "Subiaco": f"{_SL_LOGO}subiaco.png",
    "Swan Districts": f"{_SL_LOGO}swan-districts.png",
    "West Perth": f"{_SL_LOGO}west-perth.png",
    # NAB / Coates Talent League (U18s)
    "Bendigo Pioneers": f"{_SL_LOGO}bendigo-pioneers.png",
    "Calder Cannons": f"{_SL_LOGO}calder-cannons.png",
    "Dandenong Stingrays": f"{_SL_LOGO}dandenong-stingrays.png",
    "Eastern Ranges": f"{_SL_LOGO}eastern-ranges.png",
    "Geelong Falcons": f"{_SL_LOGO}geelong-falcons.png",
    "Gippsland Power": f"{_SL_LOGO}gippsland-power.png",
    "GWV Rebels": f"{_SL_LOGO}gwv-rebels.png",
    "Murray Bushrangers": f"{_SL_LOGO}murray-bushrangers.png",
    "Northern Knights": f"{_SL_LOGO}northern-knights.png",
    "Oakleigh Chargers": f"{_SL_LOGO}oakleigh-chargers.png",
    "Sandringham Dragons": f"{_SL_LOGO}sandringham-dragons.png",
    "Western Jets": f"{_SL_LOGO}western-jets.png",
    "NT Thunder": f"{_SL_LOGO}nt-thunder.png",
    "Tasmania Devils": f"{_SL_LOGO}tasmania-devils.png",
    # NAB — AFL academy teams (use parent club logo)
    "Brisbane Lions Academy": f"{_LOGO_BASE}Brisbane.png",
    "Gold Coast Academy": f"{_LOGO_BASE}GoldCoast.png",
    "GWS Giants Academy": f"{_LOGO_BASE}Giants.png",
    "Sydney Swans Academy": f"{_LOGO_BASE}Sydney.png",
}

TEAM_COLOURS = {
    "Adelaide":         ("#05173f", "#ffd600"),
    "Brisbane Lions":   ("#9b0033", "#feba35"),
    "Carlton":          ("#021a31", "#ffffff"),
    "Collingwood":      ("#000000", "#ffffff"),
    "Essendon":         ("#000000", "#ff1100"),
    "Fremantle":        ("#1d1160", "#ffffff"),
    "Geelong":          ("#05173f", "#ffffff"),
    "Gold Coast":       ("#fc1921", "#ffe831"),
    "GWS":              ("#f78f1e", "#54534a"),
    "Hawthorn":         ("#361500", "#ffb300"),
    "Melbourne":        ("#021a31", "#cc0c00"),
    "North Melbourne":  ("#0e2b8d", "#ffffff"),
    "Port Adelaide":    ("#000000", "#008e8f"),
    "Richmond":         ("#000000", "#ffd600"),
    "St Kilda":         ("#000000", "#fc1921"),
    "Sydney":           ("#f20017", "#ffffff"),
    "West Coast":       ("#05173f", "#ffc211"),
    "Western Bulldogs": ("#0e2b8d", "#f20017"),
}

# ---------- Available stat columns for custom scoring ----------
AVAILABLE_STATS = [
    "kicks", "handballs", "disposals", "marks", "goals", "behinds",
    "tackles", "hitouts", "contested_possessions", "uncontested_possessions",
    "clearances", "clangers", "inside_fifties", "rebounds",
    "effective_disposals", "metres_gained", "pressure_acts",
    "ground_ball_gets", "intercepts", "score_involvements",
    "frees_for", "frees_against", "contested_marks", "marks_inside_50",
    "one_percenters", "bounces", "goal_assists", "kick_ins",
    "centre_clearances", "stoppage_clearances", "turnovers",
    "time_on_ground_pct", "disposal_efficiency",
    "supercoach_score", "afl_fantasy_score",
]

# ---------- Default custom scoring (AFL Fantasy-style) ----------
DEFAULT_CUSTOM_SCORING = {
    "kicks": 3,
    "handballs": 2,
    "marks": 3,
    "tackles": 4,
    "goals": 6,
    "behinds": 1,
    "hitouts": 1,
}

# ---------- Trade window constants ----------
TRADE_WINDOW_DURATION_WEEKS = 2
MID_SEASON_TRADE_AFTER_ROUND = 12

# ---------- Ultimate Footy default categories ----------
DEFAULT_UF_CATEGORIES = [
    "kicks", "handballs", "marks", "tackles", "goals", "behinds",
    "hitouts", "contested_possessions", "clearances", "inside_fifties",
    "rebounds", "frees_for", "frees_against",
]

# ---------- Scoring presets ----------
SCORING_PRESETS = {
    "afl_fantasy_formula": {
        "label": "AFL Fantasy Formula",
        "rules": {
            "kicks": 3, "handballs": 2, "marks": 3, "tackles": 4,
            "goals": 6, "behinds": 1, "hitouts": 1, "frees_for": 1,
            "frees_against": -3,
        },
    },
    "basic_stats": {
        "label": "Basic Stats",
        "rules": {
            "kicks": 3, "handballs": 2, "marks": 3, "tackles": 4,
            "goals": 6, "behinds": 1, "hitouts": 1,
        },
    },
    "advanced_stats": {
        "label": "Advanced Stats",
        "rules": {
            "kicks": 3, "handballs": 2, "marks": 3, "tackles": 4,
            "goals": 6, "behinds": 1, "hitouts": 1,
            "contested_possessions": 2, "clearances": 3,
            "inside_fifties": 2, "rebounds": 2,
            "intercepts": 3, "score_involvements": 1,
            "contested_marks": 4, "ground_ball_gets": 1,
            "frees_for": 1, "frees_against": -3,
            "clangers": -2, "turnovers": -2,
        },
    },
    "full_stats": {
        "label": "Full Stats",
        "rules": {
            "kicks": 3, "handballs": 2, "marks": 3, "tackles": 4,
            "goals": 6, "behinds": 1, "hitouts": 1,
            "contested_possessions": 2, "uncontested_possessions": 1,
            "clearances": 3, "centre_clearances": 1, "stoppage_clearances": 1,
            "inside_fifties": 2, "rebounds": 2,
            "effective_disposals": 1, "metres_gained": 0.1,
            "pressure_acts": 1, "ground_ball_gets": 1,
            "intercepts": 3, "score_involvements": 1,
            "contested_marks": 4, "marks_inside_50": 3,
            "one_percenters": 2, "bounces": 1,
            "goal_assists": 3, "kick_ins": 1,
            "frees_for": 1, "frees_against": -3,
            "clangers": -2, "turnovers": -2,
        },
    },
    "uf_standard": {
        "label": "UF Standard",
        "rules": {s: 1 for s in DEFAULT_UF_CATEGORIES},
    },
}

# ---------- Stat categories for custom scoring UI ----------
STAT_CATEGORIES = {
    "Core": ["kicks", "handballs", "disposals", "marks", "goals", "behinds", "tackles", "hitouts"],
    "Possessions": [
        "contested_possessions", "uncontested_possessions", "clearances",
        "centre_clearances", "stoppage_clearances", "ground_ball_gets",
    ],
    "Advanced": [
        "inside_fifties", "rebounds", "effective_disposals", "metres_gained",
        "pressure_acts", "intercepts", "score_involvements",
    ],
    "Discipline": ["clangers", "frees_for", "frees_against", "turnovers"],
    "Marking": ["contested_marks", "marks_inside_50"],
    "Other": [
        "one_percenters", "bounces", "goal_assists", "kick_ins",
        "time_on_ground_pct", "disposal_efficiency",
    ],
    "Fantasy Scores": ["supercoach_score", "afl_fantasy_score"],
}

# ---------- Scoring type labels ----------
SCORING_TYPE_LABELS = {
    "supercoach": "SuperCoach",
    "afl_fantasy": "AFL Fantasy",
    "custom": "Custom",
    "hybrid": "Hybrid",
    "ultimate_footy": "Ultimate Footy",
}


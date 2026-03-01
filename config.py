"""Central configuration for the Keeper League app."""

import os
from dotenv import load_dotenv

load_dotenv()  # reads .env file if present

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "data"))

# ---------- Flask / SQLAlchemy ----------
SECRET_KEY = os.environ.get("SECRET_KEY", "keeper-league-dev-key-CHANGE-ME")
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "DATABASE_URL",
    "sqlite:///" + os.path.join(DATA_DIR, "keeper_league.db"),
)
SQLALCHEMY_TRACK_MODIFICATIONS = False

# ---------- Session security ----------
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = os.environ.get("FLASK_ENV") == "production"
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
# The draft model now uses a simple linear longevity formula:
#   score = (38 - age) / 20.0  →  18yo = 1.0, 38yo = 0.0
AGE_CURVE = {
    "min_age": 18,
    "max_age": 38,
}

# ---------- Positional scarcity ----------
# Display defaults for the settings page.  The draft engine computes scarcity
# dynamically from the actual player pool (lineup impact × pool depth).
_max_slots = max(POSITIONS.values()) if POSITIONS else 1
POSITIONAL_SCARCITY = {pos: round(count / _max_slots, 2) for pos, count in POSITIONS.items()}

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

TEAM_COLOURS = {
    "Adelaide":         ("#002B5C", "#FFD200"),
    "Brisbane Lions":   ("#69003B", "#FFB81C"),
    "Carlton":          ("#002F6C", "#FFFFFF"),
    "Collingwood":      ("#000000", "#FFFFFF"),
    "Essendon":         ("#CC2031", "#000000"),
    "Fremantle":        ("#2A0D45", "#FFFFFF"),
    "Geelong":          ("#002F6C", "#FFFFFF"),
    "Gold Coast":       ("#D63239", "#FFD200"),
    "GWS":              ("#F47920", "#3D3D3D"),
    "Hawthorn":         ("#4D2004", "#FFB81C"),
    "Melbourne":        ("#0F1131", "#CC2031"),
    "North Melbourne":  ("#003690", "#FFFFFF"),
    "Port Adelaide":    ("#008AAB", "#000000"),
    "Richmond":         ("#FFD200", "#000000"),
    "St Kilda":         ("#ED1C24", "#000000"),
    "Sydney":           ("#ED171F", "#FFFFFF"),
    "West Coast":       ("#002B5C", "#FFD200"),
    "Western Bulldogs": ("#002F6C", "#CC2031"),
}

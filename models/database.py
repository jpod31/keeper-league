"""SQLAlchemy ORM models and database initialisation."""

from datetime import datetime, timezone

from sqlalchemy import func
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()


# ── Core AFL data (migrated from CSV) ────────────────────────────────


class AflPlayer(db.Model):
    __tablename__ = "afl_player"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, index=True)
    afl_team = db.Column(db.String(60))
    position = db.Column(db.String(20))  # DEF, MID, FWD, RUC, or dual e.g. DEF/MID
    age = db.Column(db.Integer)
    dob = db.Column(db.String(20))
    career_games = db.Column(db.Integer)
    height_cm = db.Column(db.Integer)
    sc_avg = db.Column(db.Float)
    sc_avg_prev = db.Column(db.Float)
    games_played = db.Column(db.Integer)  # games this season
    draft_score = db.Column(db.Float)
    rating = db.Column(db.Integer)              # FIFA-style 54–90
    potential = db.Column(db.Integer)            # FIFA-style 64–94
    rating_start = db.Column(db.Integer)         # Rating at start of year (from XLSX year column)
    injury_type = db.Column(db.String(100))      # "Hamstring", "Knee", etc. NULL = not injured
    injury_return = db.Column(db.String(60))     # "Test", "1-2 weeks", "Season", etc.
    injury_severity = db.Column(db.String(10))   # "test", "short", "long". NULL = not injured
    keeper_value = db.Column(db.Float)           # 0-99 Keeper Value Index
    cba_pct = db.Column(db.Float)                # season centre-bounce attendance % (dfsaustralia)
    cba_trend = db.Column(db.Float)              # recent-vs-season CBA% trend (+ = midfield role rising)
    # Kick-ins (dfsaustralia): his share of his club's kick-ins in the games he
    # played, the share of his kick-ins he played on from, and the season count.
    kick_in_pct = db.Column(db.Float)
    kick_in_playon_pct = db.Column(db.Float)
    kick_ins_season = db.Column(db.Integer)
    # From the player workbook: how he came into the AFL, and where he sits.
    draft_pick = db.Column(db.Integer)           # 0 = no pick number (rookie, pre-listed)
    draft_year = db.Column(db.Integer)
    draft_type = db.Column(db.String(20))        # National, Rookie, Mid-Season, ...
    father_son = db.Column(db.Boolean)
    academy = db.Column(db.Boolean)
    international = db.Column(db.Boolean)
    grade = db.Column(db.String(20))             # Elite, A Grade, B Grade, AFL Standard, Rotation, Reserves
    afl_best22 = db.Column(db.Boolean)           # in his AFL club's best 22 (workbook "22")
    # AFL list membership. The player workbook is the list of record: a player
    # it no longer names has left the AFL and becomes "former". The row stays
    # (every draft pick, lineup and score still points at it); afl_team is then
    # his last club and left_afl_year the last season he was listed.
    list_status = db.Column(db.String(10), default="listed", index=True)  # listed|former
    left_afl_year = db.Column(db.Integer)
    joined_year = db.Column(db.Integer)          # first season in the workbook (new draftees)
    # True while `position` is our estimate (from the workbook's role) rather
    # than an official SuperCoach position. Cleared by the footywire position sync.
    position_expected = db.Column(db.Boolean, default=False)
    # The kind of player he is, from the workbook: `role` is its Position
    # column (MID / RUC / GD / KD / GF / KF), `role_detail` its Specific
    # Position ("Small Forward"). Drives the scoring ceiling in draft values
    # (models/role_scoring.py). Not the SuperCoach position.
    role = db.Column(db.String(4))
    role_detail = db.Column(db.String(40))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    sc_scores = db.relationship("ScScore", backref="player", lazy="dynamic")
    stats = db.relationship("PlayerStat", backref="player", lazy="dynamic")

    __table_args__ = (
        db.UniqueConstraint("name", "afl_team", name="uq_player_name_team"),
    )

    @classmethod
    def listed(cls):
        """Filter clause: players on an AFL list (NULL = pre-migration rows)."""
        return db.or_(cls.list_status.is_(None), cls.list_status != "former")

    @property
    def is_former(self):
        return self.list_status == "former"

    def __repr__(self):
        return f"<AflPlayer {self.name} ({self.afl_team})>"


class RatingLog(db.Model):
    """Tracks every rating change from XLSX sync for the Ratings tab."""
    __tablename__ = "rating_log"

    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False, index=True)
    old_rating = db.Column(db.Integer)
    new_rating = db.Column(db.Integer)
    old_potential = db.Column(db.Integer)
    new_potential = db.Column(db.Integer)
    rating_start = db.Column(db.Integer)
    changed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    player = db.relationship("AflPlayer", backref="rating_logs")


class PlayerSeasonRating(db.Model):
    """His rating and potential as the workbook had them each season
    (rating from 2016, potential from 2017). Rewritten by the player sync."""
    __tablename__ = "player_season_rating"

    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False, index=True)
    season = db.Column(db.Integer, nullable=False)
    rating = db.Column(db.Integer)
    potential = db.Column(db.Integer)

    __table_args__ = (
        db.UniqueConstraint("player_id", "season", name="uq_season_rating_player_season"),
    )


class ScScore(db.Model):
    __tablename__ = "sc_score"

    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False, index=True)
    year = db.Column(db.Integer, nullable=False)
    round = db.Column(db.Integer, nullable=False)
    sc_score = db.Column(db.Integer)

    __table_args__ = (
        db.UniqueConstraint("player_id", "year", "round", name="uq_sc_score_player_year_round"),
    )


class PlayerStat(db.Model):
    __tablename__ = "player_stat"

    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False, index=True)
    year = db.Column(db.Integer, nullable=False)
    round = db.Column(db.Integer, nullable=False)
    kicks = db.Column(db.Integer)
    handballs = db.Column(db.Integer)
    disposals = db.Column(db.Integer)
    marks = db.Column(db.Integer)
    goals = db.Column(db.Integer)
    behinds = db.Column(db.Integer)
    tackles = db.Column(db.Integer)
    hitouts = db.Column(db.Integer)
    contested_possessions = db.Column(db.Integer)
    uncontested_possessions = db.Column(db.Integer)
    clearances = db.Column(db.Integer)
    clangers = db.Column(db.Integer)
    inside_fifties = db.Column(db.Integer)
    rebounds = db.Column(db.Integer)
    effective_disposals = db.Column(db.Integer)
    disposal_efficiency = db.Column(db.Float)
    metres_gained = db.Column(db.Float)
    pressure_acts = db.Column(db.Integer)
    ground_ball_gets = db.Column(db.Integer)
    intercepts = db.Column(db.Integer)
    score_involvements = db.Column(db.Integer)
    supercoach_score = db.Column(db.Integer)
    afl_fantasy_score = db.Column(db.Integer)
    frees_for = db.Column(db.Integer)
    frees_against = db.Column(db.Integer)
    contested_marks = db.Column(db.Integer)
    marks_inside_50 = db.Column(db.Integer)
    one_percenters = db.Column(db.Integer)
    bounces = db.Column(db.Integer)
    goal_assists = db.Column(db.Integer)
    time_on_ground_pct = db.Column(db.Float)
    centre_clearances = db.Column(db.Integer)
    stoppage_clearances = db.Column(db.Integer)
    turnovers = db.Column(db.Integer)
    kick_ins = db.Column(db.Integer)
    is_live = db.Column(db.Boolean, default=False)  # True while AFL game in progress, False when final

    __table_args__ = (
        db.UniqueConstraint("player_id", "year", "round", name="uq_stat_player_year_round"),
        db.Index("ix_playerstat_year_round", "year", "round"),
    )


# ── State league stats (VFL / SANFL / WAFL) ─────────────────────────


class StateLeagueStat(db.Model):
    __tablename__ = "state_league_stat"

    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=True, index=True)
    player_name = db.Column(db.String(120), nullable=False)
    competition = db.Column(db.String(10), nullable=False)
    season = db.Column(db.Integer, nullable=False)
    team = db.Column(db.String(80))
    age = db.Column(db.Integer)
    matches = db.Column(db.Integer)
    is_afl_listed = db.Column(db.Boolean, default=False)

    kicks = db.Column(db.Float)
    handballs = db.Column(db.Float)
    disposals = db.Column(db.Float)
    marks = db.Column(db.Float)
    goals = db.Column(db.Float)
    behinds = db.Column(db.Float)
    tackles = db.Column(db.Float)
    hitouts = db.Column(db.Float)
    contested_possessions = db.Column(db.Float)
    uncontested_possessions = db.Column(db.Float)
    clearances = db.Column(db.Float)
    inside_fifties = db.Column(db.Float)
    rebounds = db.Column(db.Float)
    disposal_efficiency = db.Column(db.Float)
    intercepts = db.Column(db.Float)
    score_involvements = db.Column(db.Float)
    frees_for = db.Column(db.Float)
    frees_against = db.Column(db.Float)
    contested_marks = db.Column(db.Float)
    tackles_inside_50 = db.Column(db.Float)
    dreamteam_avg = db.Column(db.Float)
    total_possessions = db.Column(db.Float)
    kick_percentage = db.Column(db.Float)
    contested_possession_rate = db.Column(db.Float)
    score_involvement_pct = db.Column(db.Float)
    goals_avg = db.Column(db.Float)

    # Precomputed scouting model predictions (populated by weekly sync job)
    predicted_afl_sc = db.Column(db.Float)        # projected AFL SuperCoach avg
    breakout_probability = db.Column(db.Float)     # 0-100%
    draft_probability = db.Column(db.Float)        # 0-100% (unlisted players only)
    scouting_tag = db.Column(db.String(30))        # e.g. "Star Potential", "Breakout Candidate"

    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    sl_player = db.relationship("AflPlayer", backref="state_league_stats")

    __table_args__ = (
        db.UniqueConstraint("player_name", "competition", "season", "team",
                            name="uq_state_league_player_comp_season_team"),
    )


class AflListHistory(db.Model):
    """A player's AFL club for a given season, including list-only (no senior
    game) seasons. Sourced from draftguru.com.au — the only feed that records
    non-playing list stints (match-stats feeds are games-only). Drives the
    "AFL Career" timeline on the player profile.
    """
    __tablename__ = "afl_list_history"

    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=True, index=True)
    player_name = db.Column(db.String(120), nullable=False)
    season = db.Column(db.Integer, nullable=False)
    club = db.Column(db.String(80), nullable=False)
    list_type = db.Column(db.String(20))   # rookie / senior / primary
    games = db.Column(db.Integer, default=0)
    source = db.Column(db.String(20), default="draftguru")

    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    list_player = db.relationship("AflPlayer", backref="list_history")

    __table_args__ = (
        db.UniqueConstraint("player_name", "season", "club",
                            name="uq_list_history_player_season_club"),
    )


# ── AFL game schedule (for live scoring + lockouts) ──────────────────


class AflGame(db.Model):
    __tablename__ = "afl_game"

    id = db.Column(db.Integer, primary_key=True)           # Squiggle game ID
    year = db.Column(db.Integer, nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    home_team = db.Column(db.String(40), nullable=False)    # e.g. "Adelaide"
    away_team = db.Column(db.String(40), nullable=False)
    venue = db.Column(db.String(80))
    scheduled_start = db.Column(db.DateTime)                # UTC bounce time
    status = db.Column(db.String(20), default="scheduled")  # scheduled | live | complete
    home_score = db.Column(db.Integer)
    away_score = db.Column(db.Integer)
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        db.UniqueConstraint("year", "afl_round", "home_team", name="uq_afl_game_year_round_home"),
    )

    def __repr__(self):
        return f"<AflGame R{self.afl_round} {self.home_team} v {self.away_team} ({self.status})>"


# ── Auth ─────────────────────────────────────────────────────────────


class User(UserMixin, db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    display_name = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_active_user = db.Column(db.Boolean, default=True)
    is_admin = db.Column(db.Boolean, default=False)
    theme_preference = db.Column(db.String(10), default="dark")
    has_completed_onboarding = db.Column(db.Boolean, default=False)
    last_login = db.Column(db.DateTime)
    email_digest_enabled = db.Column(db.Boolean, default=False)
    push_subscription = db.Column(db.Text)

    leagues_commissioned = db.relationship("League", backref="commissioner", lazy="dynamic")
    fantasy_teams = db.relationship("FantasyTeam", backref="owner", lazy="dynamic")

    @property
    def is_active(self):
        return self.is_active_user

    def __repr__(self):
        return f"<User {self.username}>"


# ── League config ────────────────────────────────────────────────────


class League(db.Model):
    __tablename__ = "league"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    commissioner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    season_year = db.Column(db.Integer, nullable=False)
    scoring_type = db.Column(db.String(20), nullable=False, default="supercoach")  # supercoach|afl_fantasy|custom|hybrid
    hybrid_base = db.Column(db.String(20))  # supercoach|afl_fantasy — used only when scoring_type is hybrid
    hybrid_base_weight = db.Column(db.Float, default=1.0)        # 0.0-1.0 weight for official base score
    hybrid_custom_mode = db.Column(db.String(20), default="points")  # "percentage"|"points"
    squad_size = db.Column(db.Integer, default=38)
    on_field_count = db.Column(db.Integer, default=18)
    num_teams = db.Column(db.Integer, default=6)
    draft_type = db.Column(db.String(10), default="snake")  # snake|linear
    pick_timer_secs = db.Column(db.Integer, default=120)
    draft_auto_randomize = db.Column(db.Boolean, default=True)
    draft_scheduled_date = db.Column(db.DateTime, nullable=True)
    _trade_window_open = db.Column("trade_window_open", db.Boolean, default=True)
    delist_minimum = db.Column(db.Integer, default=3)
    status = db.Column(db.String(20), default="setup")  # setup|drafting|active|finals|offseason
    invite_code = db.Column(db.String(12), unique=True, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    position_slots = db.relationship("LeaguePositionSlot", backref="league",
                                     lazy="select", cascade="all, delete-orphan")
    scoring_rules = db.relationship("CustomScoringRule", backref="league",
                                    lazy="select", cascade="all, delete-orphan")
    teams = db.relationship("FantasyTeam", backref="league",
                            lazy="select", cascade="all, delete-orphan")
    draft_weights = db.relationship("LeagueDraftWeights", backref="league",
                                    uselist=False, cascade="all, delete-orphan")

    @property
    def trade_window_open(self):
        """Check if trade window is open via trade mode, date windows, or legacy toggle."""
        now = datetime.now(timezone.utc)
        cfg = SeasonConfig.query.filter_by(league_id=self.id, year=self.season_year).first()
        if cfg:
            mode = cfg.mid_season_trade_mode or ("all_year" if cfg.trades_all_year else "window")

            if mode == "all_year":
                return True

            if mode == "until_round" and cfg.mid_season_trade_until_round:
                # Open until the specified round is completed
                latest_completed = (
                    db.session.query(db.func.max(Fixture.afl_round))
                    .filter_by(league_id=self.id, year=self.season_year,
                               status="completed", is_final=False)
                    .scalar()
                ) or 0
                return latest_completed < cfg.mid_season_trade_until_round

            # mode == "window" — use date-based windows. SQLite + SQLAlchemy
            # DateTime (no timezone=True) strips tz info on round-trip, so
            # stored values may be naive. Coerce to aware UTC before
            # comparing against an aware `now`.
            def _aware(dt):
                if dt is None:
                    return None
                return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)

            mid_open = _aware(cfg.mid_trade_window_open)
            mid_close = _aware(cfg.mid_trade_window_close)
            off_open = _aware(cfg.off_trade_window_open)
            off_close = _aware(cfg.off_trade_window_close)

            if mid_open and mid_close:
                if mid_open <= now <= mid_close:
                    return True
            if off_open and off_close:
                if off_open <= now <= off_close:
                    return True
            # If any date-based window is configured, use dates only (don't fall back)
            if mid_open or off_open:
                return False
        # Legacy fallback for leagues without date-based windows
        return self._trade_window_open

    @trade_window_open.setter
    def trade_window_open(self, value):
        self._trade_window_open = value

    def __repr__(self):
        return f"<League {self.name} ({self.season_year})>"


class LeaguePositionSlot(db.Model):
    __tablename__ = "league_position_slot"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    position_code = db.Column(db.String(10), nullable=False)  # DEF|MID|FWD|RUC|UTIL|BENCH
    count = db.Column(db.Integer, nullable=False)
    is_bench = db.Column(db.Boolean, default=False)


class CustomScoringRule(db.Model):
    __tablename__ = "custom_scoring_rule"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    stat_column = db.Column(db.String(40), nullable=False)
    points_per = db.Column(db.Float, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("league_id", "stat_column", name="uq_scoring_league_stat"),
    )


# ── Fantasy teams & rosters ──────────────────────────────────────────


class FantasyTeam(db.Model):
    __tablename__ = "fantasy_team"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    logo_url = db.Column(db.String(300))      # path to AI-generated team logo
    logo_prompt = db.Column(db.String(500))    # prompt used to generate the logo
    accent = db.Column(db.String(9))           # the team's colour, #rrggbb (see models/team_identity.py)
    draft_order = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    roster = db.relationship("FantasyRoster", backref="team",
                             lazy="select", cascade="all, delete-orphan")

    __table_args__ = (
        db.UniqueConstraint("league_id", "owner_id", name="uq_team_league_owner"),
    )

    def __repr__(self):
        return f"<FantasyTeam {self.name}>"


class FantasyRoster(db.Model):
    __tablename__ = "fantasy_roster"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    acquired_via = db.Column(db.String(20), default="draft")  # draft|trade|supplemental
    acquired_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = db.Column(db.Boolean, default=True)

    # Lineup state (replaces WeeklyLineup/LineupSlot for the field view)
    position_code = db.Column(db.String(10))           # DEF|MID|FWD|RUC|None
    is_captain = db.Column(db.Boolean, default=False)
    is_vice_captain = db.Column(db.Boolean, default=False)
    is_emergency = db.Column(db.Boolean, default=False)
    is_benched = db.Column(db.Boolean, default=True)   # new players start benched

    player = db.relationship("AflPlayer", lazy="joined")

    # One row per TENURE, not per (team, player): a team that redrafts a
    # player it delisted, or trades one back, gets a second row and the first
    # stays as history. At most one row per (team, player) is active.
    __table_args__ = (
        db.Index("ix_roster_team_active", "team_id", "is_active"),
    )


class LeagueDraftWeights(db.Model):
    __tablename__ = "league_draft_weights"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False, unique=True)
    sc_average = db.Column(db.Float, default=0.30)
    age_factor = db.Column(db.Float, default=0.12)
    positional_scarcity = db.Column(db.Float, default=0.12)
    trajectory = db.Column(db.Float, default=0.12)
    durability = db.Column(db.Float, default=0.12)
    rating_potential = db.Column(db.Float, default=0.22)

    def to_dict(self):
        return {
            "sc_average": self.sc_average,
            "age_factor": self.age_factor,
            "positional_scarcity": self.positional_scarcity,
            "trajectory": self.trajectory,
            "durability": self.durability,
            "rating_potential": self.rating_potential,
        }


class UserDraftWeights(db.Model):
    __tablename__ = "user_draft_weights"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    sc_average = db.Column(db.Float, default=0.30)
    age_factor = db.Column(db.Float, default=0.12)
    positional_scarcity = db.Column(db.Float, default=0.12)
    trajectory = db.Column(db.Float, default=0.12)
    durability = db.Column(db.Float, default=0.12)
    rating_potential = db.Column(db.Float, default=0.22)

    user = db.relationship("User", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("user_id", "league_id", name="uq_user_draft_weights"),
    )

    def to_dict(self):
        return {
            "sc_average": self.sc_average,
            "age_factor": self.age_factor,
            "positional_scarcity": self.positional_scarcity,
            "trajectory": self.trajectory,
            "durability": self.durability,
            "rating_potential": self.rating_potential,
        }


# ── Phase 2: Draft tables ────────────────────────────────────────────


class DraftSession(db.Model):
    __tablename__ = "draft_session"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False, index=True)
    status = db.Column(db.String(20), default="scheduled")  # scheduled|in_progress|paused|completed
    draft_type = db.Column(db.String(10), default="snake")
    draft_round_type = db.Column(db.String(20), default="initial")  # initial|supplemental
    pick_timer_secs = db.Column(db.Integer, default=120)
    current_pick = db.Column(db.Integer, default=1)
    current_round = db.Column(db.Integer, default=1)
    scheduled_start = db.Column(db.DateTime)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    total_rounds = db.Column(db.Integer)
    is_mock = db.Column(db.Boolean, default=False)
    pick_deadline = db.Column(db.DateTime)  # UTC deadline for current pick timer

    league = db.relationship("League", backref=db.backref("draft_sessions", lazy="select"))
    picks = db.relationship("DraftPick", backref="session", lazy="select",
                            cascade="all, delete-orphan", order_by="DraftPick.pick_number")


class DraftPick(db.Model):
    __tablename__ = "draft_pick"

    id = db.Column(db.Integer, primary_key=True)
    draft_session_id = db.Column(db.Integer, db.ForeignKey("draft_session.id"), nullable=False)
    pick_number = db.Column(db.Integer, nullable=False)
    draft_round = db.Column(db.Integer, nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=True)
    is_auto_pick = db.Column(db.Boolean, default=False)
    is_pass = db.Column(db.Boolean, default=False)
    picked_at = db.Column(db.DateTime)
    # Whose pick this was before any trade; team_id is who uses it.
    original_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=True)
    # Set on an added selection (compensation / priority), e.g. "Compensation".
    label = db.Column(db.String(60))

    team = db.relationship("FantasyTeam", lazy="joined", foreign_keys=[team_id])
    original_team = db.relationship("FantasyTeam", lazy="joined", foreign_keys=[original_team_id])
    player = db.relationship("AflPlayer", lazy="joined")


class DraftQueue(db.Model):
    __tablename__ = "draft_queue"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    priority = db.Column(db.Integer, nullable=False)

    player = db.relationship("AflPlayer", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("team_id", "player_id", name="uq_queue_team_player"),
    )


class PlayerWishlist(db.Model):
    __tablename__ = "player_wishlist"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    player = db.relationship("AflPlayer", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("user_id", "league_id", "player_id", name="uq_wishlist_user_league_player"),
    )


class DraftChatMessage(db.Model):
    __tablename__ = "draft_chat_message"

    id = db.Column(db.Integer, primary_key=True)
    draft_session_id = db.Column(db.Integer, db.ForeignKey("draft_session.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    team_name = db.Column(db.String(100))
    message = db.Column(db.String(500), nullable=False)
    is_system = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: __import__('datetime').datetime.now(__import__('datetime').timezone.utc))


# ── Phase 3: Weekly lineup tables ────────────────────────────────────


class WeeklyLineup(db.Model):
    __tablename__ = "weekly_lineup"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    is_locked = db.Column(db.Boolean, default=False)

    slots = db.relationship("LineupSlot", backref="lineup", lazy="select",
                            cascade="all, delete-orphan")

    __table_args__ = (
        db.UniqueConstraint("team_id", "afl_round", "year", name="uq_lineup_team_round_year"),
    )


class LineupSlot(db.Model):
    __tablename__ = "lineup_slot"

    id = db.Column(db.Integer, primary_key=True)
    lineup_id = db.Column(db.Integer, db.ForeignKey("weekly_lineup.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    position_code = db.Column(db.String(10), nullable=False)
    is_captain = db.Column(db.Boolean, default=False)
    is_vice_captain = db.Column(db.Boolean, default=False)
    is_emergency = db.Column(db.Boolean, default=False)
    emergency_for = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=True)

    player = db.relationship("AflPlayer", foreign_keys=[player_id], lazy="joined")


class LockoutConfig(db.Model):
    __tablename__ = "lockout_config"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False, unique=True)
    lockout_type = db.Column(db.String(20), default="round_start")  # round_start|game_start


class LiveScoringConfig(db.Model):
    __tablename__ = "live_scoring_config"

    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), primary_key=True)
    enabled = db.Column(db.Boolean, default=True)
    poll_interval_seconds = db.Column(db.Integer, default=120)      # how often to fetch
    lockout_type = db.Column(db.String(20), default="game_start")   # game_start | round_start


# ── Phase 4: Trading tables ──────────────────────────────────────────


class Trade(db.Model):
    __tablename__ = "trade"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    proposer_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    recipient_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    status = db.Column(db.String(20), default="pending")
    proposed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    responded_at = db.Column(db.DateTime)
    review_deadline = db.Column(db.DateTime)
    commissioner_veto = db.Column(db.Boolean, default=False)
    veto_reason = db.Column(db.Text)
    intended_period = db.Column(db.String(20))  # "midseason" or "offseason"
    notes = db.Column(db.Text)
    # The offer this one answers. The offer it answers is closed as "countered".
    counter_of_id = db.Column(db.Integer, db.ForeignKey("trade.id"))

    proposer_team = db.relationship("FantasyTeam", foreign_keys=[proposer_team_id], lazy="joined")
    recipient_team = db.relationship("FantasyTeam", foreign_keys=[recipient_team_id], lazy="joined")
    assets = db.relationship("TradeAsset", backref="trade", lazy="select",
                             cascade="all, delete-orphan")
    comments = db.relationship("TradeComment", backref="trade", lazy="select",
                               cascade="all, delete-orphan", order_by="TradeComment.created_at")


class FutureDraftPick(db.Model):
    __tablename__ = "future_draft_pick"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    round_number = db.Column(db.Integer, nullable=False)
    original_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    current_owner_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)

    original_team = db.relationship("FantasyTeam", foreign_keys=[original_team_id])
    current_owner = db.relationship("FantasyTeam", foreign_keys=[current_owner_id])

    __table_args__ = (
        db.UniqueConstraint("league_id", "year", "round_number", "original_team_id",
                            name="uq_future_pick_league_year_round_team"),
    )

    def __repr__(self):
        return f"<FutureDraftPick {self.year} R{self.round_number} (orig: team {self.original_team_id}, owner: team {self.current_owner_id})>"


class TradeAsset(db.Model):
    __tablename__ = "trade_asset"

    id = db.Column(db.Integer, primary_key=True)
    trade_id = db.Column(db.Integer, db.ForeignKey("trade.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=True)
    future_pick_id = db.Column(db.Integer, db.ForeignKey("future_draft_pick.id"), nullable=True)
    from_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    to_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)

    player = db.relationship("AflPlayer", lazy="joined")
    future_pick = db.relationship("FutureDraftPick", lazy="joined")


class TradeComment(db.Model):
    __tablename__ = "trade_comment"

    id = db.Column(db.Integer, primary_key=True)
    trade_id = db.Column(db.Integer, db.ForeignKey("trade.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    comment = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", lazy="joined")


# ── Phase 5: Matchups / Fixtures / Standings ─────────────────────────


class Fixture(db.Model):
    __tablename__ = "fixture"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    home_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    away_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    home_score = db.Column(db.Float)
    away_score = db.Column(db.Float)
    is_final = db.Column(db.Boolean, default=False)
    final_type = db.Column(db.String(20))  # QF1, QF2, PF, GF etc.
    status = db.Column(db.String(20), default="scheduled")  # scheduled|live|completed

    home_team = db.relationship("FantasyTeam", foreign_keys=[home_team_id], lazy="joined")
    away_team = db.relationship("FantasyTeam", foreign_keys=[away_team_id], lazy="joined")

    __table_args__ = (
        db.Index("ix_fixture_league_round_year", "league_id", "afl_round", "year"),
    )


class SeasonStanding(db.Model):
    __tablename__ = "season_standing"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    wins = db.Column(db.Integer, default=0)
    losses = db.Column(db.Integer, default=0)
    draws = db.Column(db.Integer, default=0)
    points_for = db.Column(db.Float, default=0)
    points_against = db.Column(db.Float, default=0)
    percentage = db.Column(db.Float, default=0)
    ladder_points = db.Column(db.Integer, default=0)

    team = db.relationship("FantasyTeam", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("league_id", "team_id", "year", name="uq_standing_league_team_year"),
    )


class RoundScore(db.Model):
    __tablename__ = "round_score"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    total_score = db.Column(db.Float, default=0)
    captain_bonus = db.Column(db.Float, default=0)
    breakdown = db.Column(db.JSON)

    __table_args__ = (
        db.UniqueConstraint("team_id", "afl_round", "year", name="uq_rscore_team_round_year"),
    )


class AflByeRound(db.Model):
    __tablename__ = "afl_bye_round"

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    afl_team = db.Column(db.String(60), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("year", "afl_round", "afl_team", name="uq_bye_year_round_team"),
    )


class AflTeamSelection(db.Model):
    __tablename__ = "afl_team_selection"

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    match_id = db.Column(db.String(30))
    afl_team = db.Column(db.String(60), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=True)
    player_name = db.Column(db.String(120), nullable=False)
    jumper_number = db.Column(db.Integer)
    position = db.Column(db.String(10))
    is_captain = db.Column(db.Boolean, default=False)
    team_type = db.Column(db.String(10))

    player = db.relationship("AflPlayer", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("year", "afl_round", "afl_team", "player_name",
                            name="uq_selection_round_team_player"),
    )


class SeasonConfig(db.Model):
    __tablename__ = "season_config"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    num_regular_rounds = db.Column(db.Integer, default=23)
    finals_teams = db.Column(db.Integer, default=4)
    finals_format = db.Column(db.String(20), default="top4")  # top4|top6|top8
    points_per_win = db.Column(db.Integer, default=4)
    points_per_draw = db.Column(db.Integer, default=2)

    # Season phase tracking
    season_phase = db.Column(db.String(20), default="regular")  # regular|midseason|finals|offseason

    # Mid-season configuration
    mid_season_draft_enabled = db.Column(db.Boolean, default=False)
    mid_season_draft_after_round = db.Column(db.Integer)
    mid_season_draft_picks = db.Column(db.Integer, default=1)
    mid_season_delist_required = db.Column(db.Integer, default=1)
    mid_season_trade_enabled = db.Column(db.Boolean, default=False)
    mid_season_trade_after_round = db.Column(db.Integer)
    trades_all_year = db.Column(db.Boolean, default=False)  # legacy, use trade_mode
    mid_season_trade_mode = db.Column(db.String(20), default="window")  # window|all_year|until_round
    mid_season_trade_until_round = db.Column(db.Integer)

    # Trade/delist window duration settings (configured in Settings)
    mid_trade_duration_days = db.Column(db.Integer, default=2)     # 1-3 days
    mid_delist_duration_days = db.Column(db.Integer, default=2)    # 1-3 days
    off_trade_start_days = db.Column(db.Integer, default=7)        # days after offseason opens
    off_trade_duration_days = db.Column(db.Integer, default=7)     # how long window runs
    off_delist_duration_days = db.Column(db.Integer, default=7)    # how long delist period runs

    # Trade window dates (automatic date-based windows)
    mid_trade_window_open = db.Column(db.DateTime)    # UTC datetime mid-season window opens
    mid_trade_window_close = db.Column(db.DateTime)   # UTC datetime mid-season window closes
    mid_draft_date = db.Column(db.DateTime)            # UTC datetime of supplemental draft
    off_trade_window_open = db.Column(db.DateTime)    # UTC datetime off-season window opens
    off_trade_window_close = db.Column(db.DateTime)   # UTC datetime off-season window closes

    # Off-season configuration
    offseason_trade_enabled = db.Column(db.Boolean, default=True)
    offseason_delist_min = db.Column(db.Integer, default=3)
    # Squad places every team must leave open for the off-season draft. The
    # delist requirement is derived from this, not from a flat cut count: a
    # 47-man list cutting 5 is still 1 over, so what actually matters is the
    # size you finish at.
    offseason_draft_min_picks = db.Column(db.Integer, default=4)
    # The one off-season deadline: trades AND delistings both close here.
    # When set it WINS over off_trade_duration_days / off_delist_duration_days,
    # so re-opening a window from the commissioner hub can't silently drag a
    # date that was deliberately anchored to the AFL draft calendar.
    offseason_close_date = db.Column(db.DateTime)
    ssp_enabled = db.Column(db.Boolean, default=True)
    ssp_slots = db.Column(db.Integer, default=1)
    ssp_cutoff_round = db.Column(db.Integer, default=4)  # SSP open post-draft until this round
    ssp_window_open = db.Column(db.DateTime)
    ssp_window_close = db.Column(db.DateTime)

    # Captain scoring toggle
    captain_scoring_enabled = db.Column(db.Boolean, default=True)

    # 7s captain (double score for one 7s player)
    sevens_captain_enabled = db.Column(db.Boolean, default=False)

    # Season automation (Phase F)
    auto_transition_enabled = db.Column(db.Boolean, default=False)
    season_start_date = db.Column(db.DateTime)
    offseason_start_date = db.Column(db.DateTime)
    finals_start_round = db.Column(db.Integer)
    supplemental_draft_date = db.Column(db.DateTime)  # e.g. Nov 30 after AFL draft

    # Supplemental drafts held this year (mid-season + off-season):
    # basis reverse_ladder|ladder|custom, style linear|snake,
    # custom order = JSON [team_id, ...], compensation = JSON
    # [{team_id, round, placement: start|end, note}] (off-season draft only).
    draft_order_basis = db.Column(db.String(20), default="reverse_ladder")
    draft_style = db.Column(db.String(10), default="linear")
    draft_custom_order = db.Column(db.Text)
    draft_compensation = db.Column(db.Text)

    __table_args__ = (
        db.UniqueConstraint("league_id", "year", name="uq_season_config_league_year"),
    )


class DelistPeriod(db.Model):
    __tablename__ = "delist_period"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default="closed")  # open|closed
    opens_at = db.Column(db.DateTime)
    closes_at = db.Column(db.DateTime)
    min_delists = db.Column(db.Integer, default=3)
    # NULL = no upper cap (old behaviour: only enforces min for offseason
    # contraction). Mid-season windows set this (e.g. 2) so teams can't
    # gut their squad before the supplemental draft.
    max_delists = db.Column(db.Integer)
    period_type = db.Column(db.String(20), default="offseason")  # midseason|offseason


class DelistAction(db.Model):
    __tablename__ = "delist_action"

    id = db.Column(db.Integer, primary_key=True)
    delist_period_id = db.Column(db.Integer, db.ForeignKey("delist_period.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    delisted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    player = db.relationship("AflPlayer", lazy="joined")


# ── Long-Term Injury List (LTIL) ─────────────────────────────────────


class LongTermInjury(db.Model):
    __tablename__ = "long_term_injury"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    removed_at = db.Column(db.DateTime)  # null = still on LTIL
    status = db.Column(db.String(20), default="approved")  # pending, approved, rejected
    reviewed_at = db.Column(db.DateTime)  # when commissioner acted
    replacement_player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"))

    team = db.relationship("FantasyTeam", lazy="joined")
    player = db.relationship("AflPlayer", foreign_keys=[player_id], lazy="joined")
    replacement_player = db.relationship("AflPlayer", foreign_keys=[replacement_player_id], lazy="joined")


# ── Reserve 7s Sub-Competition ────────────────────────────────────────


class Reserve7sLineup(db.Model):
    """Per-round selection of 7 players for each team in the 7s comp."""
    __tablename__ = "reserve7s_lineup"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    is_captain = db.Column(db.Boolean, default=False)

    player = db.relationship("AflPlayer", lazy="joined")
    team = db.relationship("FantasyTeam", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("league_id", "team_id", "afl_round", "year", "player_id",
                            name="uq_7s_lineup_team_round_player"),
    )


class Reserve7sFixture(db.Model):
    """Separate fixture table for 7s round-robin and finals."""
    __tablename__ = "reserve7s_fixture"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    home_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    away_team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    home_score = db.Column(db.Float, default=0)
    away_score = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default="scheduled")  # scheduled/live/completed
    is_final = db.Column(db.Boolean, default=False)
    final_type = db.Column(db.String(10))  # GF

    home_team = db.relationship("FantasyTeam", foreign_keys=[home_team_id], lazy="joined")
    away_team = db.relationship("FantasyTeam", foreign_keys=[away_team_id], lazy="joined")


class Reserve7sRoundScore(db.Model):
    """Per-team round scores for 7s."""
    __tablename__ = "reserve7s_round_score"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    total_score = db.Column(db.Float, default=0)
    captain_bonus = db.Column(db.Float, default=0)
    breakdown = db.Column(db.JSON)

    team = db.relationship("FantasyTeam", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("team_id", "afl_round", "year",
                            name="uq_7s_round_score_team_round"),
    )


class Reserve7sStanding(db.Model):
    """Separate ladder for 7s."""
    __tablename__ = "reserve7s_standing"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    wins = db.Column(db.Integer, default=0)
    losses = db.Column(db.Integer, default=0)
    draws = db.Column(db.Integer, default=0)
    points_for = db.Column(db.Float, default=0)
    points_against = db.Column(db.Float, default=0)
    percentage = db.Column(db.Float, default=0)
    ladder_points = db.Column(db.Integer, default=0)

    team = db.relationship("FantasyTeam", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("league_id", "team_id", "year",
                            name="uq_7s_standing_league_team_year"),
    )


# ── Notifications & Messaging ─────────────────────────────────────────


class Notification(db.Model):
    __tablename__ = "notification"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=True)
    type = db.Column(db.String(30), nullable=False)  # trade_received/accepted/rejected/vetoed, player_delisted, message_received
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=True)
    link = db.Column(db.String(300), nullable=True)
    is_read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    trade_id = db.Column(db.Integer, db.ForeignKey("trade.id"), nullable=True)
    conversation_id = db.Column(db.Integer, nullable=True)

    user = db.relationship("User", lazy="joined")


class Conversation(db.Model):
    __tablename__ = "conversation"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    team_a_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    team_b_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_message_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    team_a = db.relationship("FantasyTeam", foreign_keys=[team_a_id], lazy="joined")
    team_b = db.relationship("FantasyTeam", foreign_keys=[team_b_id], lazy="joined")
    messages = db.relationship("Message", backref="conversation", lazy="select",
                               cascade="all, delete-orphan", order_by="Message.created_at")

    __table_args__ = (
        db.UniqueConstraint("league_id", "team_a_id", "team_b_id", name="uq_conversation_league_teams"),
    )


class Message(db.Model):
    __tablename__ = "message"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversation.id"), nullable=False, index=True)
    sender_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_read = db.Column(db.Boolean, default=False)

    sender = db.relationship("User", lazy="joined")


# ── League Chat & Activity Feed ──────────────────────────────────────


class LeagueChat(db.Model):
    __tablename__ = "league_chat"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    messages = db.relationship("LeagueChatMessage", backref="chat", lazy="dynamic",
                               cascade="all, delete-orphan")


class LeagueChatMessage(db.Model):
    __tablename__ = "league_chat_message"

    id = db.Column(db.Integer, primary_key=True)
    league_chat_id = db.Column(db.Integer, db.ForeignKey("league_chat.id"), nullable=False, index=True)
    sender_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    sender = db.relationship("User", lazy="joined")


class ActivityFeedEntry(db.Model):
    __tablename__ = "activity_feed_entry"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False, index=True)
    type = db.Column(db.String(30), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text)
    link = db.Column(db.String(300))
    actor_user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    actor = db.relationship("User", lazy="joined")


# ── Notification Preferences ────────────────────────────────────────


class NotificationPreference(db.Model):
    __tablename__ = "notification_preference"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    notif_type = db.Column(db.String(30), nullable=False)
    channel_in_app = db.Column(db.Boolean, default=True)
    channel_push = db.Column(db.Boolean, default=False)
    channel_email = db.Column(db.Boolean, default=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "notif_type", name="uq_notif_pref_user_type"),
    )


# ── Analytics ─────────────────────────────────────────────────────────


class PageView(db.Model):
    __tablename__ = "page_view"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    path = db.Column(db.String(256), nullable=False)
    method = db.Column(db.String(10), default="GET")
    status_code = db.Column(db.Integer)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    user_agent = db.Column(db.String(256))
    ip_hash = db.Column(db.String(64))


class PlayerNote(db.Model):
    """A manager's private note on a player. Many per player, newest first."""
    __tablename__ = "player_note"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    player = db.relationship("AflPlayer", lazy="joined")

    __table_args__ = (
        db.Index("ix_player_note_user_player", "user_id", "player_id"),
    )


class TradeBlockEntry(db.Model):
    """A player a team has put up for trade. One live entry per team-player;
    it is removed when the team takes him down or he leaves the list."""
    __tablename__ = "trade_block_entry"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False, index=True)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    seeking = db.Column(db.String(40))     # what the team wants back: see trade_block.SEEKING
    note = db.Column(db.String(240))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    player = db.relationship("AflPlayer", lazy="joined")
    team = db.relationship("FantasyTeam", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("team_id", "player_id", name="uq_trade_block_team_player"),
    )


class SeasonSquad(db.Model):
    """Who was on each list when a season began. Written once per league-year
    (by the season rollover; 2026 is rebuilt from the initial draft) and never
    edited, so "my squad at the start of 2026" stays true however the list
    changes afterwards."""
    __tablename__ = "season_squad"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"), nullable=False)
    # The player as he was on the day, so the page doesn't drift with him.
    afl_team = db.Column(db.String(60))
    position = db.Column(db.String(20))
    age = db.Column(db.Integer)
    rating = db.Column(db.Integer)
    prev_avg = db.Column(db.Float)        # average for the season before `year`
    acquired_via = db.Column(db.String(20))
    draft_pick = db.Column(db.Integer)    # overall pick, when he arrived by draft
    draft_round = db.Column(db.Integer)

    player = db.relationship("AflPlayer", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("league_id", "year", "team_id", "player_id",
                            name="uq_season_squad_row"),
        db.Index("ix_season_squad_league_year", "league_id", "year"),
    )


# ── Power Rankings ────────────────────────────────────────────────────


class PowerRanking(db.Model):
    __tablename__ = "power_ranking"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("league.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    afl_round = db.Column(db.Integer, nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("fantasy_team.id"), nullable=False)
    rank = db.Column(db.Integer, nullable=False)
    score = db.Column(db.Float, nullable=False)
    previous_rank = db.Column(db.Integer)
    movement = db.Column(db.Integer, default=0)

    team = db.relationship("FantasyTeam", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("league_id", "year", "afl_round", "team_id",
                            name="uq_power_ranking_round_team"),
    )


# ── Database init ────────────────────────────────────────────────────


def init_db(app):
    """Initialise the database — create tables if they don't exist."""
    import os, config
    os.makedirs(config.DATA_DIR, exist_ok=True)
    db.init_app(app)
    with app.app_context():
        db.create_all()
        _run_migrations(app)


def _rebuild_fantasy_roster():
    """Drop UNIQUE(team_id, player_id) from fantasy_roster.

    The constraint made a team re-acquiring a player it had once held
    (redrafting someone it delisted, trading a player back) an IntegrityError,
    and it collapsed two stints into one row. SQLite can't drop a constraint,
    so the table is rebuilt once: same columns, same ids, same rows.
    """
    import logging
    from sqlalchemy.schema import CreateTable

    log = logging.getLogger(__name__)
    ddl = str(CreateTable(FantasyRoster.__table__).compile(db.engine))
    ddl = ddl.replace("CREATE TABLE fantasy_roster", "CREATE TABLE fantasy_roster_new", 1)
    model_cols = [c.name for c in FantasyRoster.__table__.columns]

    conn = db.engine.raw_connection()
    try:
        cur = conn.cursor()
        have = [r[1] for r in cur.execute("PRAGMA table_info(fantasy_roster)").fetchall()]
        cols = ", ".join(c for c in model_cols if c in have)
        before = cur.execute("SELECT COUNT(*) FROM fantasy_roster").fetchone()[0]
        cur.execute("PRAGMA foreign_keys=OFF")
        cur.execute("BEGIN IMMEDIATE")
        try:
            cur.execute("DROP TABLE IF EXISTS fantasy_roster_new")
            cur.execute(ddl)
            cur.execute(f"INSERT INTO fantasy_roster_new ({cols}) SELECT {cols} FROM fantasy_roster")
            after = cur.execute("SELECT COUNT(*) FROM fantasy_roster_new").fetchone()[0]
            if after != before:
                raise RuntimeError(f"row count changed {before} -> {after}")
            cur.execute("DROP TABLE fantasy_roster")
            cur.execute("ALTER TABLE fantasy_roster_new RENAME TO fantasy_roster")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_roster_team_active "
                        "ON fantasy_roster (team_id, is_active)")
            cur.execute("COMMIT")
            log.warning("fantasy_roster rebuilt without UNIQUE(team_id, player_id): %d rows", after)
        except Exception:
            cur.execute("ROLLBACK")
            log.exception("fantasy_roster rebuild failed; table left as it was")
        finally:
            cur.execute("PRAGMA foreign_keys=ON")
    finally:
        conn.close()


def _run_migrations(app):
    """Idempotent column additions for existing databases."""
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)

    if "fantasy_team" in inspector.get_table_names():
        if "accent" not in {c["name"] for c in inspector.get_columns("fantasy_team")}:
            db.session.execute(text("ALTER TABLE fantasy_team ADD COLUMN accent VARCHAR(9)"))
            db.session.commit()

    if "fantasy_roster" in inspector.get_table_names():
        uniques = inspector.get_unique_constraints("fantasy_roster")
        if any(set(u.get("column_names") or []) == {"team_id", "player_id"} for u in uniques):
            _rebuild_fantasy_roster()
            inspector = inspect(db.engine)

    # User columns
    if "user" in inspector.get_table_names():
        existing_user = {c["name"] for c in inspector.get_columns("user")}
        if "is_admin" not in existing_user:
            db.session.execute(text("ALTER TABLE user ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
        if "theme_preference" not in existing_user:
            db.session.execute(text("ALTER TABLE user ADD COLUMN theme_preference VARCHAR(10) DEFAULT 'dark'"))
        if "has_completed_onboarding" not in existing_user:
            db.session.execute(text("ALTER TABLE user ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT 0"))
        if "last_login" not in existing_user:
            db.session.execute(text("ALTER TABLE user ADD COLUMN last_login DATETIME"))
        if "email_digest_enabled" not in existing_user:
            db.session.execute(text("ALTER TABLE user ADD COLUMN email_digest_enabled BOOLEAN DEFAULT 0"))
        if "push_subscription" not in existing_user:
            db.session.execute(text("ALTER TABLE user ADD COLUMN push_subscription TEXT"))
        db.session.commit()

    # FutureDraftPick table — created automatically by create_all()
    # TradeAsset.future_pick_id column
    if "trade_asset" in inspector.get_table_names():
        existing_ta = {c["name"] for c in inspector.get_columns("trade_asset")}
        if "future_pick_id" not in existing_ta:
            db.session.execute(text("ALTER TABLE trade_asset ADD COLUMN future_pick_id INTEGER REFERENCES future_draft_pick(id)"))
            db.session.commit()
        # Make player_id nullable (SQLite doesn't support ALTER COLUMN, but new rows will work)

    # SeasonConfig new columns (added in season management update)
    if "season_config" in inspector.get_table_names():
        existing = {c["name"] for c in inspector.get_columns("season_config")}
        migrations = [
            ("season_phase", 'VARCHAR(20) DEFAULT "regular"'),
            ("mid_season_draft_enabled", "BOOLEAN DEFAULT 0"),
            ("mid_season_draft_after_round", "INTEGER"),
            ("mid_season_draft_picks", "INTEGER DEFAULT 1"),
            ("mid_season_delist_required", "INTEGER DEFAULT 1"),
            ("mid_season_trade_enabled", "BOOLEAN DEFAULT 0"),
            ("mid_season_trade_after_round", "INTEGER"),
            ("trades_all_year", "BOOLEAN DEFAULT 0"),
            ("mid_season_trade_mode", 'VARCHAR(20) DEFAULT "window"'),
            ("mid_season_trade_until_round", "INTEGER"),
            ("offseason_trade_enabled", "BOOLEAN DEFAULT 1"),
            ("offseason_delist_min", "INTEGER DEFAULT 3"),
            ("offseason_draft_min_picks", "INTEGER DEFAULT 4"),
            ("ssp_enabled", "BOOLEAN DEFAULT 1"),
            ("ssp_slots", "INTEGER DEFAULT 1"),
            ("draft_order_basis", 'VARCHAR(20) DEFAULT "reverse_ladder"'),
            ("draft_style", 'VARCHAR(10) DEFAULT "linear"'),
            ("draft_custom_order", "TEXT"),
            ("draft_compensation", "TEXT"),
        ]
        for col_name, col_def in migrations:
            if col_name not in existing:
                db.session.execute(
                    text(f"ALTER TABLE season_config ADD COLUMN {col_name} {col_def}")
                )
        # Trade window date columns
        date_cols = [
            ("mid_trade_window_open", "DATETIME"),
            ("mid_trade_window_close", "DATETIME"),
            ("mid_draft_date", "DATETIME"),
            ("off_trade_window_open", "DATETIME"),
            ("offseason_close_date", "DATETIME"),
            ("off_trade_window_close", "DATETIME"),
            ("ssp_window_open", "DATETIME"),
            ("ssp_window_close", "DATETIME"),
        ]
        for col_name, col_def in date_cols:
            if col_name not in existing:
                db.session.execute(
                    text(f"ALTER TABLE season_config ADD COLUMN {col_name} {col_def}")
                )
        # Season automation columns (Phase F)
        auto_cols = [
            ("auto_transition_enabled", "BOOLEAN DEFAULT 0"),
            ("season_start_date", "DATETIME"),
            ("offseason_start_date", "DATETIME"),
            ("finals_start_round", "INTEGER"),
        ]
        for col_name, col_def in auto_cols:
            if col_name not in existing:
                db.session.execute(
                    text(f"ALTER TABLE season_config ADD COLUMN {col_name} {col_def}")
                )
        # Trade window duration columns
        duration_cols = [
            ("mid_trade_duration_days", "INTEGER DEFAULT 2"),
            ("mid_delist_duration_days", "INTEGER DEFAULT 2"),
            ("off_trade_start_days", "INTEGER DEFAULT 7"),
            ("off_trade_duration_days", "INTEGER DEFAULT 7"),
            ("off_delist_duration_days", "INTEGER DEFAULT 7"),
        ]
        for col_name, col_def in duration_cols:
            if col_name not in existing:
                db.session.execute(
                    text(f"ALTER TABLE season_config ADD COLUMN {col_name} {col_def}")
                )
        # Supplemental draft date
        if "supplemental_draft_date" not in existing:
            db.session.execute(
                text("ALTER TABLE season_config ADD COLUMN supplemental_draft_date DATETIME")
            )
        db.session.commit()

    # DelistPeriod.period_type column
    if "delist_period" in inspector.get_table_names():
        existing_dp = {c["name"] for c in inspector.get_columns("delist_period")}
        if "period_type" not in existing_dp:
            db.session.execute(
                text('ALTER TABLE delist_period ADD COLUMN period_type VARCHAR(20) DEFAULT "offseason"')
            )
            db.session.commit()

    # DraftPick.original_team_id column (traded picks)
    if "draft_pick" in inspector.get_table_names():
        existing_pick = {c["name"] for c in inspector.get_columns("draft_pick")}
        if "original_team_id" not in existing_pick:
            db.session.execute(
                text("ALTER TABLE draft_pick ADD COLUMN original_team_id INTEGER REFERENCES fantasy_team(id)")
            )
            db.session.commit()
        if "label" not in existing_pick:
            db.session.execute(text("ALTER TABLE draft_pick ADD COLUMN label VARCHAR(60)"))
            db.session.commit()

    # Trade.intended_period column
    if "trade" in inspector.get_table_names():
        existing_trade = {c["name"] for c in inspector.get_columns("trade")}
        if "intended_period" not in existing_trade:
            db.session.execute(
                text("ALTER TABLE trade ADD COLUMN intended_period VARCHAR(20)")
            )
            db.session.commit()
        if "counter_of_id" not in existing_trade:
            db.session.execute(text("ALTER TABLE trade ADD COLUMN counter_of_id INTEGER REFERENCES trade(id)"))
            db.session.commit()

    # League hybrid + draft preference columns
    if "league" in inspector.get_table_names():
        existing_league = {c["name"] for c in inspector.get_columns("league")}
        if "hybrid_base" not in existing_league:
            db.session.execute(text("ALTER TABLE league ADD COLUMN hybrid_base VARCHAR(20)"))
        if "hybrid_base_weight" not in existing_league:
            db.session.execute(text("ALTER TABLE league ADD COLUMN hybrid_base_weight FLOAT DEFAULT 1.0"))
        if "hybrid_custom_mode" not in existing_league:
            db.session.execute(text("ALTER TABLE league ADD COLUMN hybrid_custom_mode VARCHAR(20) DEFAULT 'points'"))
        if "draft_auto_randomize" not in existing_league:
            db.session.execute(text("ALTER TABLE league ADD COLUMN draft_auto_randomize BOOLEAN DEFAULT 1"))
        if "draft_scheduled_date" not in existing_league:
            db.session.execute(text("ALTER TABLE league ADD COLUMN draft_scheduled_date DATETIME"))
        db.session.commit()

    # PlayerStat new stat columns
    if "player_stat" in inspector.get_table_names():
        existing_ps = {c["name"] for c in inspector.get_columns("player_stat")}
        new_stat_cols = [
            ("frees_for", "INTEGER"),
            ("frees_against", "INTEGER"),
            ("contested_marks", "INTEGER"),
            ("marks_inside_50", "INTEGER"),
            ("one_percenters", "INTEGER"),
            ("bounces", "INTEGER"),
            ("goal_assists", "INTEGER"),
            ("time_on_ground_pct", "FLOAT"),
            ("centre_clearances", "INTEGER"),
            ("stoppage_clearances", "INTEGER"),
            ("turnovers", "INTEGER"),
            ("kick_ins", "INTEGER"),
        ]
        for col_name, col_def in new_stat_cols:
            if col_name not in existing_ps:
                db.session.execute(
                    text(f"ALTER TABLE player_stat ADD COLUMN {col_name} {col_def}")
                )
        db.session.commit()

    # AflPlayer injury + keeper_value columns
    if "afl_player" in inspector.get_table_names():
        existing_ap = {c["name"] for c in inspector.get_columns("afl_player")}
        for col_name, col_def in [
            ("injury_type", "VARCHAR(100)"),
            ("injury_return", "VARCHAR(60)"),
            ("injury_severity", "VARCHAR(10)"),
            ("keeper_value", "FLOAT"),
            ("cba_pct", "FLOAT"),
            ("cba_trend", "FLOAT"),
            ("kick_in_pct", "FLOAT"),
            ("kick_in_playon_pct", "FLOAT"),
            ("kick_ins_season", "INTEGER"),
            ("draft_pick", "INTEGER"),
            ("draft_year", "INTEGER"),
            ("draft_type", "VARCHAR(20)"),
            ("father_son", "BOOLEAN"),
            ("academy", "BOOLEAN"),
            ("international", "BOOLEAN"),
            ("grade", "VARCHAR(20)"),
            ("afl_best22", "BOOLEAN"),
            ("list_status", "VARCHAR(10) DEFAULT 'listed'"),
            ("left_afl_year", "INTEGER"),
            ("joined_year", "INTEGER"),
            ("position_expected", "BOOLEAN DEFAULT 0"),
            ("role", "VARCHAR(4)"),
            ("role_detail", "VARCHAR(40)"),
        ]:
            if col_name not in existing_ap:
                db.session.execute(
                    text(f"ALTER TABLE afl_player ADD COLUMN {col_name} {col_def}")
                )
        db.session.commit()

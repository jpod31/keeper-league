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
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    sc_scores = db.relationship("ScScore", backref="player", lazy="dynamic")
    stats = db.relationship("PlayerStat", backref="player", lazy="dynamic")

    __table_args__ = (
        db.UniqueConstraint("name", "afl_team", name="uq_player_name_team"),
    )

    def __repr__(self):
        return f"<AflPlayer {self.name} ({self.afl_team})>"


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

            # mode == "window" — use date-based windows
            if cfg.mid_trade_window_open and cfg.mid_trade_window_close:
                if cfg.mid_trade_window_open <= now <= cfg.mid_trade_window_close:
                    return True
            if cfg.off_trade_window_open and cfg.off_trade_window_close:
                if cfg.off_trade_window_open <= now <= cfg.off_trade_window_close:
                    return True
            # If any date-based window is configured, use dates only (don't fall back)
            if cfg.mid_trade_window_open or cfg.off_trade_window_open:
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

    __table_args__ = (
        db.UniqueConstraint("team_id", "player_id", name="uq_roster_team_player"),
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

    team = db.relationship("FantasyTeam", lazy="joined")
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
    ssp_enabled = db.Column(db.Boolean, default=True)
    ssp_slots = db.Column(db.Integer, default=1)
    ssp_cutoff_round = db.Column(db.Integer, default=4)  # SSP open post-draft until this round
    ssp_window_open = db.Column(db.DateTime)
    ssp_window_close = db.Column(db.DateTime)

    # Season automation (Phase F)
    auto_transition_enabled = db.Column(db.Boolean, default=False)
    season_start_date = db.Column(db.DateTime)
    offseason_start_date = db.Column(db.DateTime)
    finals_start_round = db.Column(db.Integer)

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
    replacement_player_id = db.Column(db.Integer, db.ForeignKey("afl_player.id"))

    team = db.relationship("FantasyTeam", lazy="joined")
    player = db.relationship("AflPlayer", foreign_keys=[player_id], lazy="joined")
    replacement_player = db.relationship("AflPlayer", foreign_keys=[replacement_player_id], lazy="joined")


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


# ── Database init ────────────────────────────────────────────────────


def init_db(app):
    """Initialise the database — create tables if they don't exist."""
    import os, config
    os.makedirs(config.DATA_DIR, exist_ok=True)
    db.init_app(app)
    with app.app_context():
        db.create_all()
        _run_migrations(app)


def _run_migrations(app):
    """Idempotent column additions for existing databases."""
    from sqlalchemy import inspect, text

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
            ("ssp_enabled", "BOOLEAN DEFAULT 1"),
            ("ssp_slots", "INTEGER DEFAULT 1"),
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
        db.session.commit()

    # Trade.intended_period column
    if "trade" in inspector.get_table_names():
        existing_trade = {c["name"] for c in inspector.get_columns("trade")}
        if "intended_period" not in existing_trade:
            db.session.execute(
                text("ALTER TABLE trade ADD COLUMN intended_period VARCHAR(20)")
            )
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

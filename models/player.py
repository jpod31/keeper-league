"""Player dataclass and CSV persistence helpers."""

from __future__ import annotations

import csv
import os
from dataclasses import dataclass, fields, field, asdict
from typing import List, Optional

import pandas as pd

from config import DATA_DIR


@dataclass
class Player:
    name: str
    team: str
    position: str  # DEF / MID / FWD / RUC  (dual-pos stored as "DEF/MID")
    age: Optional[int] = None
    dob: Optional[str] = None
    games: Optional[int] = None
    height: Optional[int] = None  # cm
    sc_avg: Optional[float] = None
    sc_avg_prev: Optional[float] = None  # previous year avg (for trajectory)
    games_played: Optional[int] = None   # games this season
    draft_score: Optional[float] = None
    rating: Optional[int] = None          # FIFA-style 54–90
    potential: Optional[int] = None       # FIFA-style 64–94

    # ----- helpers -----
    @property
    def primary_position(self) -> str:
        return self.position.split("/")[0] if self.position else "MID"

    @property
    def positions(self) -> List[str]:
        return self.position.split("/") if self.position else ["MID"]


def players_to_df(players: List[Player]) -> pd.DataFrame:
    return pd.DataFrame([asdict(p) for p in players])


def df_to_players(df: pd.DataFrame) -> List[Player]:
    player_fields = {f.name for f in fields(Player)}
    records = df.to_dict(orient="records")
    players = []
    for rec in records:
        filtered = {k: v for k, v in rec.items() if k in player_fields}
        # Convert NaN to None
        for k, v in filtered.items():
            if pd.isna(v):
                filtered[k] = None
        players.append(Player(**filtered))
    return players


def save_players_csv(players: List[Player], filename: str = "players.csv") -> str:
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, filename)
    df = players_to_df(players)
    df.to_csv(path, index=False)
    return path


def load_players_csv(filename: str = "players.csv") -> List[Player]:
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    df = pd.read_csv(path)
    return df_to_players(df)


# ── ORM converters ───────────────────────────────────────────────────


def player_to_orm(player: Player):
    """Convert a Player dataclass to an AflPlayer ORM dict (for create/update)."""
    return {
        "name": player.name,
        "afl_team": player.team,
        "position": player.position,
        "age": player.age,
        "dob": player.dob,
        "career_games": player.games,
        "height_cm": player.height,
        "sc_avg": player.sc_avg,
        "sc_avg_prev": player.sc_avg_prev,
        "games_played": player.games_played,
        "draft_score": player.draft_score,
        "rating": player.rating,
        "potential": player.potential,
    }


def orm_to_player(afl_player) -> Player:
    """Convert an AflPlayer ORM instance to a Player dataclass."""
    return Player(
        name=afl_player.name,
        team=afl_player.afl_team,
        position=afl_player.position or "MID",
        age=afl_player.age,
        dob=afl_player.dob,
        games=afl_player.career_games,
        height=afl_player.height_cm,
        sc_avg=afl_player.sc_avg,
        sc_avg_prev=afl_player.sc_avg_prev,
        games_played=afl_player.games_played,
        draft_score=afl_player.draft_score,
        rating=afl_player.rating,
        potential=afl_player.potential,
    )

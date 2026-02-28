"""Import / override player data from user-supplied CSV files."""

from __future__ import annotations

import os
from typing import List

import pandas as pd

from config import DATA_DIR
from models.player import Player, load_players_csv, save_players_csv, df_to_players


def import_players_csv(filepath: str, merge: bool = True) -> List[Player]:
    """Import a CSV of players and optionally merge with the existing master list.

    The CSV must have at minimum columns: name, team, position.
    Any extra columns matching Player fields (age, sc_avg, etc.) are applied.

    If merge=True, imported rows overwrite existing players matched by name+team,
    and new players are appended.  If merge=False, the import replaces everything.
    """
    incoming_df = pd.read_csv(filepath)

    # Normalise column names to lowercase/underscore
    incoming_df.columns = [c.strip().lower().replace(" ", "_") for c in incoming_df.columns]

    required = {"name", "team", "position"}
    if not required.issubset(set(incoming_df.columns)):
        missing = required - set(incoming_df.columns)
        raise ValueError(f"CSV is missing required columns: {missing}")

    incoming = df_to_players(incoming_df)

    if not merge:
        save_players_csv(incoming)
        return incoming

    existing = load_players_csv()
    existing_map = {(p.name, p.team): p for p in existing}

    for p in incoming:
        existing_map[(p.name, p.team)] = p

    merged = list(existing_map.values())
    save_players_csv(merged)
    return merged


def import_sc_scores_csv(filepath: str, year: int) -> pd.DataFrame:
    """Import a CSV of Supercoach scores for a given year.

    Expected columns: name, team, round, sc_score
    Overwrites the existing sc_scores_{year}.csv.
    """
    df = pd.read_csv(filepath)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    required = {"name", "round", "sc_score"}
    if not required.issubset(set(df.columns)):
        missing = required - set(df.columns)
        raise ValueError(f"CSV is missing required columns: {missing}")

    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, f"sc_scores_{year}.csv")
    df.to_csv(path, index=False)
    return df

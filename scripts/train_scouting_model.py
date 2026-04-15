"""Train the state league → AFL projection model.

Usage: python scripts/train_scouting_model.py
"""
import os, sys, logging
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

from app import create_app
from models.scouting_model import train_model

app = create_app()
with app.app_context():
    result = train_model()
    if result:
        print(f"Model trained on {result['n_samples']} samples.")
    else:
        print("Training failed — not enough data.")

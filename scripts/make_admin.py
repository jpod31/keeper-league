"""Promote a user to site admin.

Usage:
    python scripts/make_admin.py <username>
"""

import sys
import os

# Add parent directory to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app
from models.database import db, User


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/make_admin.py <username>")
        sys.exit(1)

    username = sys.argv[1]

    with app.app_context():
        user = User.query.filter_by(username=username).first()
        if not user:
            print(f"User '{username}' not found.")
            sys.exit(1)

        if user.is_admin:
            print(f"'{username}' is already an admin.")
            return

        user.is_admin = True
        db.session.commit()
        print(f"'{username}' is now a site admin.")


if __name__ == "__main__":
    main()

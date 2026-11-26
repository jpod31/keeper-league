"""Player headshots: AFL Manager's cutouts (240px transparent webp), kept in
`player_photos/` at the repo root and served only to signed-in coaches by
`/api/player-photo/<slug>.webp`. They are not under /static, so nginx never
hands them out to the open web.

The file name is the slug AFL Manager uses: accents stripped, lower case,
any run of other characters one dash ("Balyn O'Brien" -> balyn-o-brien).
A player with no file gets `None`, and the page draws a silhouette.
"""

import os
import re
import unicodedata

PHOTO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "player_photos")
_have = None


def photo_slug(name: str) -> str:
    n = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")


def _available():
    global _have
    if _have is None:
        try:
            _have = {f[:-5] for f in os.listdir(PHOTO_DIR) if f.endswith(".webp")}
        except OSError:
            _have = set()
    return _have


# Names the nickname table can't reach. Checked by eye; a wrong face is
# worse than a silhouette, so there is no looser guess than these.
ALIASES = {
    "Indy Cotton": "indi-cotton",
    "Michael Frederick": "minairo-frederick",
}


def find_slug(name):
    """The photo for a player: his name, then the same name with a nickname
    swapped (Zachary / Zach, Jackson / Jack, Oliver / Ollie), then ALIASES."""
    have = _available()
    s = photo_slug(name)
    if s in have:
        return s
    from models.player_sync import variants
    for v in variants(name):
        vs = photo_slug(v)
        if vs in have:
            return vs
    a = ALIASES.get(name)
    return a if a in have else None


def photo_url(name):
    s = find_slug(name)
    return f"/api/player-photo/{s}.webp" if s else None

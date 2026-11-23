"""A fantasy team's colour.

A team with a crest takes its colour FROM the crest: the most vivid colour in
the image. A team without one takes a slot on a fixed ramp by id, so it still
has a colour of its own until its coach uploads a crest. The app uses this for
everything that belongs to a team: the signed-in coach's chrome, team rows on
the ladder, draft board columns, trade block cards.
"""

import colorsys
import os

import config

# Full spectrum on purpose: team identity is exactly the kind of thing that
# should NOT all be one house colour.
PALETTE = [
    "#58a6ff", "#ffb471", "#bc8cff", "#3fb950", "#e3b341",
    "#ff7b72", "#7ee787", "#f778ba", "#79c0ff", "#ff9e64",
    "#9ece6a", "#bb9af7",
]

LOGO_DIR = os.path.join(config.DATA_DIR, "team_logos")
_cache = {}


def _vivid(path):
    """The crest's signature colour as #rrggbb, or None."""
    try:
        from PIL import Image
        im = Image.open(path).convert("RGB").resize((72, 72))
    except Exception:
        return None
    buckets = {}
    for r, g, b in im.getdata():
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if s < 0.35 or l < 0.18 or l > 0.82:
            continue                      # greys, near-black, near-white: not identity
        key = int(h * 24)                 # 15 degree hue buckets
        n, sr, sg, sb, w = buckets.get(key, (0, 0, 0, 0, 0.0))
        buckets[key] = (n + 1, sr + r, sg + g, sb + b, w + s)
    if not buckets:
        return None
    n, sr, sg, sb, _w = max(buckets.values(), key=lambda v: v[4])   # most saturated mass
    h, l, s = colorsys.rgb_to_hls(sr / n / 255, sg / n / 255, sb / n / 255)
    # Readable on black as text and as a fill: mid-light, well saturated.
    l = min(max(l, 0.52), 0.66)
    s = max(s, 0.72)
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def team_accent(team):
    """#rrggbb for a FantasyTeam."""
    path = os.path.join(LOGO_DIR, f"team_{team.id}.png")
    try:
        stamp = os.path.getmtime(path)
    except OSError:
        return PALETTE[team.id % len(PALETTE)]
    hit = _cache.get(team.id)
    if hit and hit[0] == stamp:
        return hit[1]
    colour = _vivid(path) or PALETTE[team.id % len(PALETTE)]
    _cache[team.id] = (stamp, colour)
    return colour


def team_card(team):
    """What the frontend needs to draw a team: crest, name, colour."""
    return {"id": team.id, "name": team.name, "logo": team.logo_url, "accent": team_accent(team)}

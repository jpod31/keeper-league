"""One-off: move the whole site from the 2026 navy/blue/green look to the
2027 black-and-gold scheme.

Every colour literal in the frontend, the stylesheet and the templates is
re-mapped by role, keeping its lightness (so contrast relationships hold):

    cool greys / navy  -> warm ink neutrals
    blue               -> gold            (links, active states, primary data)
    green              -> pale gold       (positive, success)
    teal / cyan        -> sand
    yellow / amber     -> orange          (warnings)
    orange, red, pink, purple: kept (warmed slightly)

    python tools/retheme.py --preview out.html   # swatches, no writes
    python tools/retheme.py --apply              # rewrite the files

NOT idempotent: gold would be read as amber and pushed to orange on a second
run. It was run once, on 2026-11-23. Kept for the record of how each colour
was derived, and for the next re-skin.
"""

import argparse
import colorsys
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [
    ("frontend/src", (".tsx", ".ts", ".css")),
    ("static/style.css", None),
    ("templates", (".html",)),
    ("frontend/index.html", None),
    ("static/favicon.svg", None),
    ("static/manifest.json", None),
    ("static/onboarding.js", None),
    ("models/season_review.py", None),
    ("blueprints/leagues_players.py", None),
]

HEX = re.compile(r"(?<![&\w])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_])")
RGB = re.compile(r"rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*[\d.]+%?\s*)?\)")


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def remap(r, g, b):
    """(r,g,b) 0-255 -> (r,g,b) 0-255 in the new scheme."""
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hue = h * 360

    def out(hue_deg, sat, light):
        rr, gg, bb = colorsys.hls_to_rgb((hue_deg % 360) / 360, clamp(light), clamp(sat))
        return round(rr * 255), round(gg * 255), round(bb * 255)

    # Pure black / white / true greys: leave (shadows, overlays, #fff text).
    if s < 0.03:
        return r, g, b

    # Neutrals: low saturation anywhere, or the dark navy surface colours.
    cool = 185 <= hue <= 265
    is_neutral = s < 0.22 or (cool and l < 0.24) or (cool and s < 0.34 and l < 0.5) \
        or (cool and s < 0.45 and l > 0.82) or (cool and l >= 0.9)
    if is_neutral:
        # Warm ink: a touch of brown, never navy. Dark surfaces go a hair
        # darker so cards separate from the page without borders shouting.
        sat = 0.07 if l < 0.5 else 0.14
        light = l * 0.94 if l < 0.3 else l
        return out(32, sat, light)

    if 185 <= hue <= 265:            # blue -> gold
        if l < 0.34:                 # tinted dark fills (chip backgrounds)
            return out(40, min(s, 0.62), l * 0.92)
        if l < 0.56:                 # solid fills that carry white text
            return out(38, min(s, 0.86), min(l, 0.39))
        return out(40, min(s, 0.9), clamp(l * 0.9, 0.5, 0.84))

    if 70 <= hue < 170:              # green -> pale gold ("champagne")
        if l < 0.34:
            return out(46, min(s, 0.45), l * 0.92)
        if l < 0.43:                 # button greens: bronze, white text holds
            return out(40, min(s, 0.7), min(l, 0.38))
        return out(50, min(s, 0.62), clamp(l * 1.2, 0.72, 0.92))

    if 170 <= hue < 185:             # teal / cyan -> sand
        return out(36, min(s, 0.42), clamp(l * 1.05, 0.0, 0.88))

    if 49 <= hue < 70:               # true yellow (medals, trophies): gold
        return out(46, min(s, 0.95), l)

    if 36 <= hue < 49:               # amber (warnings) -> orange
        return out(24, min(s, 0.92), l)

    if 15 <= hue < 36:               # orange: keep, slightly redder so it
        return out(max(hue - 6, 14), s, l)   # stays apart from the new orange

    return r, g, b                   # red, pink, purple: keep


def parse_hex(h):
    if len(h) in (3, 4):
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), h[6:8]


def files():
    for rel, exts in TARGETS:
        path = os.path.join(ROOT, rel)
        if os.path.isfile(path):
            yield path
        elif os.path.isdir(path):
            for d, _dirs, names in os.walk(path):
                for n in names:
                    if exts is None or n.endswith(exts):
                        yield os.path.join(d, n)


def transform(text, counts=None, short_hex=True):
    def hex_sub(m):
        raw = m.group(1)
        # Outside a stylesheet a 3/4-digit "#abc" is as likely an issue
        # number or an anchor as a colour, so only CSS files rewrite those.
        if len(raw) in (3, 4) and not short_hex:
            return m.group(0)
        r, g, b, a = parse_hex(raw)
        nr, ng, nb = remap(r, g, b)
        if counts is not None:
            counts[((r, g, b), (nr, ng, nb))] += 1
        return "#%02x%02x%02x%s" % (nr, ng, nb, a)

    def rgb_sub(m):
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if max(r, g, b) > 255:
            return m.group(0)
        nr, ng, nb = remap(r, g, b)
        if counts is not None:
            counts[((r, g, b), (nr, ng, nb))] += 1
        alpha = m.group(4) or ""
        fn = "rgba" if alpha else "rgb"
        return f"{fn}({nr},{ng},{nb}{alpha.replace(' ', '')})"

    text = HEX.sub(hex_sub, text)
    return RGB.sub(rgb_sub, text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    counts = Counter()
    changed = 0
    for path in files():
        raw = open(path, "rb").read()
        crlf = b"\r\n" in raw
        text = raw.decode("utf-8")
        new = transform(text, counts, short_hex=path.endswith('.css'))
        if new != text:
            changed += 1
            if args.apply:
                open(path, "wb").write(new.encode("utf-8"))
    print(f"{changed} files, {sum(counts.values())} colour literals, {len(counts)} distinct")

    if args.preview:
        rows = []
        for ((o, n), c) in counts.most_common(260):
            oh, nh = "#%02x%02x%02x" % o, "#%02x%02x%02x" % n
            rows.append(
                f'<div class="r"><i style="background:{oh}"></i><b style="color:{oh}">Aa {oh}</b>'
                f'<i style="background:{nh}"></i><b style="color:{nh}">Aa {nh}</b><u>{c}</u></div>')
        html = ("<!doctype html><meta charset=utf-8><style>body{background:#0f0e0d;color:#eee;"
                "font:13px/1.2 system-ui;margin:12px;columns:4;column-gap:14px}"
                ".r{display:flex;align-items:center;gap:6px;margin:0 0 3px;break-inside:avoid}"
                "i{width:26px;height:18px;border-radius:3px;display:inline-block;border:1px solid #333}"
                "b{width:88px;font-weight:600}u{color:#999;text-decoration:none}</style>"
                + "".join(rows))
        open(args.preview, "w", encoding="utf-8").write(html)
        print("preview ->", args.preview)


if __name__ == "__main__":
    main()

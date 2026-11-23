"""2027 scheme, second cut: undo "everything is gold".

The first re-colour (tools/retheme.py) pushed blue AND green AND amber into
one gold family, so things that had their own colour for a reason (positions,
ratings, form, team identity) all turned the same. This pass goes back to the
original colour behind every literal and maps it again by a narrower rule:

    cool greys / navy  -> carbon (true black surfaces, neutral greys)
    blue               -> ice (near-white): chrome and interactive states
    everything else    -> its ORIGINAL colour (green stays green, amber amber)

So chrome is black and white, and colour only ever means something: a
position, a rating, form, a club. Team colour is added on top through CSS
variables (--club, --team) by the components that have a club or team.

How: the first pass was deterministic, so every colour it produced is traced
back to the original(s) it came from by replaying it over the pre-retheme
commit. Colours written by hand since then are in MANUAL.

    python tools/retheme2.py --report     # what would change, and unknowns
    python tools/retheme2.py --apply

Not idempotent. Run once on 2026-11-23.
"""

import argparse
import colorsys
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import retheme as v1  # noqa: E402

ROOT = v1.ROOT
BASE_COMMIT = "a7edfab"
BARE = re.compile(r"(?<!rgba\()(?<!rgb\()(?<![\d.,(])\b(\d{1,3}),(\d{1,3}),(\d{1,3})\b(?!\s*[,.]?\d)")


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def remap3(r, g, b):
    """Original colour -> second-cut colour."""
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hue = h * 360

    def out(hue_deg, sat, light):
        rr, gg, bb = colorsys.hls_to_rgb((hue_deg % 360) / 360, clamp(light), clamp(sat))
        return round(rr * 255), round(gg * 255), round(bb * 255)

    if s < 0.03:
        return r, g, b
    cool = 185 <= hue <= 265
    neutral = s < 0.22 or (cool and l < 0.24) or (cool and s < 0.34 and l < 0.5) \
        or (cool and s < 0.45 and l > 0.82) or (cool and l >= 0.9)
    if neutral:
        if l < 0.3:
            return out(250, 0.07, l * 0.80)          # surfaces: closer to black
        if l < 0.72:
            return out(250, 0.06, min(l + 0.09, 0.78))  # mid greys: lifted, legible
        return out(250, 0.10, l)
    if cool:                                         # blue -> ice
        if l < 0.34:
            return out(250, 0.10, l * 0.95)
        if l < 0.56:
            return out(250, 0.10, min(l, 0.34))      # solid fills under white text
        return out(250, 0.22, clamp(0.88 + (l - 0.56) * 0.2, 0.88, 0.97))
    return r, g, b                                   # every other hue: as it was


# Colours typed by hand after the first pass -> what they should be now.
MANUAL = {
    (245, 185, 64): (236, 236, 246),    # --kl-gold
    (255, 203, 94): (255, 255, 255),    # gold hover
    (26, 20, 8): (10, 10, 12),          # gold ink
    (185, 130, 14): (60, 60, 72),
    (240, 134, 62): (240, 136, 62),     # warning
    (248, 197, 82): (121, 192, 255),    # DEF chip text (restored below anyway)
    (214, 176, 255): (210, 168, 255),
    (255, 148, 132): (255, 180, 113),
    (241, 235, 221): (126, 231, 135),
    (255, 201, 77): (86, 211, 100),     # rating: elite
    (228, 216, 166): (227, 179, 65),    # rating: good
    (240, 138, 75): (240, 136, 62),     # rating: average
    (246, 195, 92): (121, 192, 255),
    (255, 166, 113): (255, 180, 113),
    (240, 179, 138): (240, 179, 138),
    (215, 209, 203): (207, 207, 214),
    (234, 231, 228): (236, 236, 241),
    (251, 250, 249): (255, 255, 255),
    (181, 169, 156): (176, 176, 188),
    (57, 54, 50): (42, 42, 49),
    (87, 82, 76): (74, 74, 86),
    (27, 25, 23): (18, 18, 21),
    (40, 37, 35): (28, 28, 33),
    (12, 11, 10): (7, 7, 9),
    (31, 29, 27): (22, 22, 26),
    (136, 128, 118): (140, 140, 152),
    (100, 94, 87): (104, 104, 116),
    (163, 149, 134): (160, 160, 172),
}


def base_files():
    out = subprocess.run(["git", "ls-tree", "-r", "--name-only", BASE_COMMIT],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout.splitlines()
    wanted = []
    for rel, exts in v1.TARGETS:
        for f in out:
            if f == rel or (f.startswith(rel.rstrip("/") + "/") and (exts is None or f.endswith(exts))):
                wanted.append(f)
    return sorted(set(wanted))


def literals(text, short_hex):
    """Every colour literal in a text as (r,g,b)."""
    for m in v1.HEX.finditer(text):
        raw = m.group(1)
        if len(raw) in (3, 4) and not short_hex:
            continue
        r, g, b, _a = v1.parse_hex(raw)
        yield (r, g, b)
    for m in v1.RGB.finditer(text):
        t = tuple(int(m.group(i)) for i in (1, 2, 3))
        if max(t) <= 255:
            yield t
    for m in BARE.finditer(text):
        t = tuple(int(x) for x in m.groups())
        if max(t) <= 255:
            yield t


def build_table():
    """gold colour -> Counter of the original colours it came from."""
    table = defaultdict(Counter)
    for rel in base_files():
        blob = subprocess.run(["git", "show", f"{BASE_COMMIT}:{rel}"], cwd=ROOT,
                              capture_output=True, check=True).stdout
        try:
            text = blob.decode("utf-8")
        except UnicodeDecodeError:
            continue
        for old in literals(text, rel.endswith(".css")):
            table[v1.remap(*old)][old] += 1
    return table


def resolve(table):
    """gold colour -> new colour, plus the ambiguous ones for the report."""
    mapping, ambiguous = {}, []
    for gold, olds in table.items():
        targets = Counter()
        for old, n in olds.items():
            targets[remap3(*old)] += n
        best = targets.most_common(1)[0][0]
        mapping[gold] = best
        if len(targets) > 1:
            spread = max(abs(a - b) for t in targets for a, b in zip(t, best))
            if spread > 40:
                ambiguous.append((gold, olds.most_common(4), targets.most_common(3)))
    for k, v in MANUAL.items():
        mapping[k] = v
    return mapping, ambiguous


def transform(text, mapping, short_hex, unknown):
    def look(rgb):
        if rgb in mapping:
            return mapping[rgb]
        h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
        if s >= 0.03:
            unknown[rgb] += 1
        return rgb

    def hex_sub(m):
        raw = m.group(1)
        if len(raw) in (3, 4) and not short_hex:
            return m.group(0)
        r, g, b, a = v1.parse_hex(raw)
        return "#%02x%02x%02x%s" % (*look((r, g, b)), a)

    def rgb_sub(m):
        t = tuple(int(m.group(i)) for i in (1, 2, 3))
        if max(t) > 255:
            return m.group(0)
        alpha = (m.group(4) or "").replace(" ", "")
        return f"{'rgba' if alpha else 'rgb'}({','.join(map(str, look(t)))}{alpha})"

    def bare_sub(m):
        t = tuple(int(x) for x in m.groups())
        if max(t) > 255:
            return m.group(0)
        return ",".join(map(str, look(t)))

    text = v1.HEX.sub(hex_sub, text)
    text = v1.RGB.sub(rgb_sub, text)
    return BARE.sub(bare_sub, text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    table = build_table()
    mapping, ambiguous = resolve(table)
    unknown = Counter()
    changed = 0
    for path in v1.files():
        raw = open(path, "rb").read()
        text = raw.decode("utf-8")
        new = transform(text, mapping, path.endswith(".css"), unknown)
        if new != text:
            changed += 1
            if args.apply:
                open(path, "wb").write(new.encode("utf-8"))
    print(f"{len(table)} gold colours traced; {changed} files {'rewritten' if args.apply else 'would change'}")
    if args.report or not args.apply:
        print(f"\nambiguous ({len(ambiguous)}): gold <- originals -> candidates")
        for gold, olds, targets in ambiguous[:40]:
            print("  #%02x%02x%02x" % gold, [("#%02x%02x%02x" % o, n) for o, n in olds],
                  "->", [("#%02x%02x%02x" % t, n) for t, n in targets])
        print(f"\nunknown, left alone ({len(unknown)}):")
        for rgb, n in unknown.most_common(60):
            print("  #%02x%02x%02x x%d" % (*rgb, n))


if __name__ == "__main__":
    main()

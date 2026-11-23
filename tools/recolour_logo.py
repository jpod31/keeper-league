"""Recolour the KL logo and app icons from the green-to-blue gradient to chrome white.

Each pixel keeps its alpha and its brightness; only the colour changes, by
mapping luminance onto a grey -> white ramp (it was gold for a day). Originals are kept
as *-2026.* beside the new files. Run once on 2026-11-23.
"""
import os
import shutil
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "icons")
RAMP = [  # (luminance 0-1, rgb): a chrome white mark for a black-and-white chrome
    (0.00, (8, 8, 10)),
    (0.12, (70, 70, 80)),
    (0.35, (168, 168, 180)),
    (0.60, (226, 226, 234)),
    (1.00, (255, 255, 255)),
]


def ramp(lum):
    for (a, ca), (b, cb) in zip(RAMP, RAMP[1:]):
        if lum <= b:
            t = (lum - a) / (b - a) if b > a else 0
            return tuple(round(ca[i] + (cb[i] - ca[i]) * t) for i in range(3))
    return RAMP[-1][1]


LUT = [ramp(i / 255) for i in range(256)]


def recolour(name):
    path = os.path.join(ROOT, name)
    stem, ext = os.path.splitext(name)
    keep = os.path.join(ROOT, f"{stem}-2026{ext}")
    if not os.path.exists(keep):
        shutil.copy2(path, keep)
    im = Image.open(keep).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # Perceived brightness, lifted a little: the blues in the old
            # logo are dark and would otherwise all land in bronze.
            lum = (0.30 * r + 0.50 * g + 0.20 * b) / 255
            lum = min(1.0, lum ** 0.8 * 1.08)
            px[x, y] = LUT[round(lum * 255)] + (a,)
    if ext == ".webp":
        im.save(path, "WEBP", quality=92)
    else:
        im.save(path)
    print("recoloured", name, im.size)


for n in ("kl-logo.png", "kl-logo.webp", "icon-192.png", "icon-512.png", "icon-32.png"):
    recolour(n)

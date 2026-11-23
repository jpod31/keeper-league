"""Run once after retheme2: give defenders their blue back.

The second cut turns blue into ice because blue was the old chrome colour.
But some blue never was chrome: it meant "defender". Every single-line rule
whose selector names DEF is put back exactly as it was before the re-colours.
"""

import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "a7edfab"
SEL = re.compile(r"(?:\.|-)(?:def|DEF)\b")
SKIP = re.compile(r"default|define|undefined")


def tracked(exts):
    out = subprocess.run(["git", "ls-files", "static/style.css", "frontend/src"], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout.splitlines()
    return [f for f in out if f.endswith(exts)]


total = 0
for rel in tracked((".css", ".tsx")):
    try:
        base = subprocess.run(["git", "show", f"{BASE}:{rel}"], cwd=ROOT, capture_output=True,
                              check=True).stdout.decode("utf-8").replace("\r\n", "\n")
    except subprocess.CalledProcessError:
        continue
    by_selector = {}
    for line in base.split("\n"):
        if "{" in line and "}" in line:
            by_selector.setdefault(line.split("{", 1)[0].strip(), line)
    full = os.path.join(ROOT, rel)
    raw = open(full, "rb").read()
    crlf = b"\r\n" in raw
    lines = raw.decode("utf-8").replace("\r\n", "\n").split("\n")
    changed = 0
    for i, line in enumerate(lines):
        if "{" not in line or "}" not in line:
            continue
        selector = line.split("{", 1)[0].strip()
        if not SEL.search(selector) or SKIP.search(selector):
            continue
        orig = by_selector.get(selector)
        if orig and orig != line:
            lines[i] = orig
            changed += 1
    if changed:
        text = "\n".join(lines)
        if crlf:
            text = text.replace("\n", "\r\n")
        open(full, "wb").write(text.encode("utf-8"))
        print(f"{rel}: {changed} defender rule(s) restored")
        total += changed
print("total", total)

"""Remove rules from static/style.css whose classes no longer exist anywhere.

A selector is dead when it needs a class that appears in no source file
(frontend/src, templates, static JS, Python). Dead selectors are dropped from
their rule; a rule with none left is dropped. Everything else, including
order, is left exactly as it was, so the cascade cannot change for live
markup.

    python tools/css_prune.py            # report only
    python tools/css_prune.py --apply    # rewrite static/style.css

Conservative on purpose: a class is treated as live if its name shows up as a
word anywhere in the sources, if it starts with a prefix that sources build
dynamically (`fv-card-${pos}`), or if it belongs to a library (Bootstrap,
icons, charts). Check with screenshots before and after (see CLAUDE.md).
"""
import glob
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "static", "style.css")
APPLY = "--apply" in sys.argv

# Classes that come from libraries or are toggled by library JS.
LIB_PREFIX = (
    "bi", "btn", "form", "table", "card", "badge", "alert", "nav", "navbar", "dropdown", "modal", "tooltip",
    "popover", "list", "offcanvas", "toast", "accordion", "collapse", "carousel", "spinner", "progress",
    "pagination", "page", "breadcrumb", "input", "row", "col", "container", "d", "flex", "justify", "align",
    "text", "bg", "border", "rounded", "shadow", "m", "p", "g", "w", "h", "position", "overflow", "ratio",
    "visually", "was", "is", "has", "fs", "fw", "lh", "me", "ms", "mt", "mb", "mx", "my", "pe", "ps", "pt",
    "pb", "px", "py", "gap", "order", "float", "sticky", "fixed", "top", "bottom", "start", "end", "opacity",
    "recharts", "echarts", "leaflet", "swiper", "tab", "fade", "show", "active", "disabled", "open", "link",
    "stretched", "vr", "placeholder", "valid", "invalid", "img", "figure", "close", "clearfix", "user", "pe",
    "translate", "invisible", "visible", "font", "small", "lead", "display", "blockquote", "initialism",
    "object", "vstack", "hstack", "focus", "icon", "check", "select", "range", "floating", "ratio",
)


def read(path):
    try:
        return open(path, encoding="utf-8", errors="ignore").read()
    except OSError:
        return ""


def sources():
    pats = ["frontend/src/**/*.tsx", "frontend/src/**/*.ts", "frontend/src/**/*.css", "frontend/index.html",
            "templates/**/*.html", "static/*.js", "static/js/**/*.js", "blueprints/*.py", "models/*.py", "app.py"]
    text = []
    for pat in pats:
        for f in glob.glob(os.path.join(ROOT, pat), recursive=True):
            text.append(read(f))
    return "\n".join(text)


SRC = sources()
WORDS = set(re.findall(r"[A-Za-z_][A-Za-z0-9_-]*", SRC))
# Prefixes the sources finish at run time: `fv-card-${x}`, 'badge-' + x, "rt-" + tier
DYN = set(re.findall(r"([A-Za-z][A-Za-z0-9_-]*-)(?:\$\{|['\"`]\s*\+)", SRC))
DYN |= set(re.findall(r"([A-Za-z][A-Za-z0-9_-]*-)\{\{", SRC))        # Jinja: class="pos-{{ x }}"
DYN |= set(re.findall(r"([A-Za-z][A-Za-z0-9_-]*-)\{%", SRC))


def live(cls):
    if cls in WORDS:
        return True
    if "-" not in cls:
        return True                      # bare words are too easy to get wrong
    if cls.split("-")[0] in LIB_PREFIX:
        return True
    return any(cls.startswith(d) for d in DYN)


def split_top(s, sep):
    out, depth, cur = [], 0, []
    for ch in s:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == sep and depth == 0:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    out.append("".join(cur))
    return out


CLASS = re.compile(r"\.(-?[A-Za-z_][A-Za-z0-9_-]*)")


def selector_dead(sel):
    # Classes inside :not() are not required, so ignore them.
    need = re.sub(r":not\([^()]*(?:\([^()]*\))?[^()]*\)", "", sel)
    need = re.sub(r"\[[^\]]*\]", "", need)
    return next((c for c in CLASS.findall(need) if not live(c)), None)


stats = Counter()
dead_classes = Counter()


def prune_block(css):
    """Return css with dead rules removed. Handles one level of @media nesting."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            out.append(css[i:])
            break
        # A comment may sit before the selector; keep it with the output.
        head = css[i:j]
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            elif css.startswith("/*", k):
                e = css.find("*/", k + 2)
                k = (e + 1) if e >= 0 else n
            k += 1
        body = css[j + 1:k - 1]
        # Everything up to the last comment before the selector is kept as it
        # is. (A comment that named an old class once got read as part of the
        # selector and took the rule under it with it.)
        cut = head.rfind("*/")
        cut = cut + 2 if cut >= 0 else 0
        sel = head[cut:]
        pre = head[:len(head) - len(sel.lstrip())]
        seltxt = sel.strip()
        if seltxt.startswith("@"):
            if seltxt.startswith(("@media", "@supports", "@container", "@layer")):
                inner = prune_block(body)
                if inner.strip():
                    out.append(pre + seltxt + " {" + inner + "}")
                else:
                    out.append(pre.rstrip(" \t"))
                    stats["empty at-rules removed"] += 1
            else:
                out.append(css[i:k])          # @keyframes, @font-face: untouched
            i = k
            continue
        parts = split_top(seltxt, ",")
        keep = []
        for part in parts:
            d = selector_dead(part)
            if d:
                dead_classes[d] += 1
                stats["selectors removed"] += 1
            else:
                keep.append(part)
        if len(keep) == len(parts):
            out.append(css[i:k])
        elif keep:
            stats["rules trimmed"] += 1
            out.append(pre + ",".join(keep).strip() + " {" + body + "}")
        else:
            stats["rules removed"] += 1
            out.append(pre.rstrip(" \t"))
        i = k
    return "".join(out)


raw = open(CSS, "rb").read().decode("utf-8")
new = prune_block(raw)
new = re.sub(r"\n{4,}", "\n\n\n", new)
print("lines before", raw.count("\n"), "after", new.count("\n"))
for key, v in stats.items():
    print(f"  {key}: {v}")
pref = Counter()
for c, v in dead_classes.items():
    pref[c.split("-")[0] + "-"] += v
print("dead selectors by prefix:", ", ".join(f"{p}{v}" for p, v in pref.most_common(40)))
if "--list" in sys.argv:
    for c, v in sorted(dead_classes.items()):
        print("   ", c, v)
if APPLY:
    open(CSS, "wb").write(new.encode("utf-8"))
    print("written")

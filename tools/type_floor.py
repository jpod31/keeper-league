"""Site-wide type rules, applied to the source. Safe to run again.

1. Nothing is set under 13px. Every smaller font-size is raised to 13px.
2. One text colour. Grey text (neutral hex between dim and near-white, and
   part-transparent white) becomes the primary text colour.

A line with "keep-size" in it is left alone: the squad card's form arrow
(.pc7-form, .fv-form) is an icon beside the average, small on purpose.

Run from the repo root: python tools/type_floor.py [--dry-run]
"""
import glob
import re
import sys

FLOOR_PX = 13
FLOOR = ".8125rem"
TEXT = "var(--kl-text-primary)"
DRY = "--dry-run" in sys.argv

CSS_SIZE = re.compile(r"(font-size:\s*)(\d*\.?\d+)(rem|px)")
CSS_FONT = re.compile(r"(\bfont:\s*(?:(?:italic|normal|bold|\d{3})\s+)*)(\d*\.?\d+)(rem|px)")
JS_SIZE_STR = re.compile(r"(fontSize:\s*)(['\"])(\d*\.?\d+)(rem|px)\2")
JS_SIZE_NUM = re.compile(r"(fontSize:\s*)(\d+(?:\.\d+)?)(?=\s*[,}\n])")
CSS_COLOR = re.compile(r"(?<![-\w])(color:\s*)(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b(?![0-9a-fA-F])")
JS_COLOR = re.compile(r"(?<![-\w])(color:\s*)(['\"])(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\2")
WHITE_A = re.compile(r"(?<![-\w])(color:\s*)rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+)\s*\)")
JS_WHITE_A = re.compile(r"(?<![-\w])(color:\s*)(['\"])rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+)\s*\)\2")


def px(v, unit):
    return float(v) * (16 if unit == "rem" else 1)


def is_grey(hexv):
    h = hexv.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return max(r, g, b) - min(r, g, b) <= 34 and 70 <= (r + g + b) / 3 <= 212


def sweep(s, is_js):
    n = {"size": 0, "colour": 0}

    def kept(m):
        t = m.string
        start = t.rfind("\n", 0, m.start()) + 1
        end = t.find("\n", m.end())
        return "keep-size" in t[start: end if end >= 0 else len(t)]

    def size(m):
        if px(m.group(2), m.group(3)) < FLOOR_PX and not kept(m):
            n["size"] += 1
            return m.group(1) + FLOOR
        return m.group(0)

    s = CSS_SIZE.sub(size, s)
    s = CSS_FONT.sub(size, s)

    def colour(m):
        if is_grey(m.group(2)):
            n["colour"] += 1
            return m.group(1) + TEXT
        return m.group(0)

    def white(m):
        if 0.3 <= float(m.group(2)) <= 0.88:
            n["colour"] += 1
            return m.group(1) + TEXT
        return m.group(0)

    if is_js:
        def js_colour(m):
            if is_grey(m.group(3)):
                n["colour"] += 1
                return f"{m.group(1)}{m.group(2)}{TEXT}{m.group(2)}"
            return m.group(0)

        def js_white(m):
            if 0.3 <= float(m.group(3)) <= 0.88:
                n["colour"] += 1
                return f"{m.group(1)}{m.group(2)}{TEXT}{m.group(2)}"
            return m.group(0)

        def js_size_str(m):
            if px(m.group(3), m.group(4)) < FLOOR_PX:
                n["size"] += 1
                return f"{m.group(1)}{m.group(2)}{FLOOR}{m.group(2)}"
            return m.group(0)

        def js_size_num(m):
            if float(m.group(2)) < FLOOR_PX:
                n["size"] += 1
                return m.group(1) + str(FLOOR_PX)
            return m.group(0)

        s = JS_COLOR.sub(js_colour, s)
        s = JS_WHITE_A.sub(js_white, s)
        s = JS_SIZE_STR.sub(js_size_str, s)
        s = JS_SIZE_NUM.sub(js_size_num, s)
    s = CSS_COLOR.sub(colour, s)
    s = WHITE_A.sub(white, s)
    return s, n


def main():
    files = ["static/style.css"]
    files += glob.glob("frontend/src/**/*.css", recursive=True)
    files += glob.glob("frontend/src/**/*.tsx", recursive=True)
    files += glob.glob("templates/**/*.html", recursive=True)
    files = [f for f in files if "email" not in f.replace("\\", "/").split("/")]
    total = {"size": 0, "colour": 0, "files": 0}
    for path in files:
        raw = open(path, "rb").read()
        crlf = b"\r\n" in raw
        s = raw.decode("utf-8").replace("\r\n", "\n")
        out, n = sweep(s, path.endswith(".tsx"))
        if out == s:
            continue
        total["files"] += 1
        total["size"] += n["size"]
        total["colour"] += n["colour"]
        if not DRY:
            if crlf:
                out = out.replace("\n", "\r\n")
            open(path, "wb").write(out.encode("utf-8"))
    print(("would change" if DRY else "changed"), total)


if __name__ == "__main__":
    main()

"""One-off, run straight after tools/retheme.py: the colours a blanket remap
can't choose, set by hand.

  - position chips: four hues that are neither green nor blue and stay apart
    (DEF gold, MID purple, FWD coral red, RUC bone);
  - rating tiers best to worst: gold, bone, orange, red;
  - primary and success buttons: flat gold / bone with ink text, no gradient;
  - the twelve team identity colours.

Run once on 2026-11-23. Not idempotent (it matches the remap's exact output).
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(path, pairs):
    full = os.path.join(ROOT, path)
    b = open(full, "rb").read()
    crlf = b"\r\n" in b
    s = b.decode("utf-8").replace("\r\n", "\n")
    for old, new in pairs:
        assert old in s, (path, old[:70])
        s = s.replace(old, new)
    if crlf:
        s = s.replace("\n", "\r\n")
    open(full, "wb").write(s.encode("utf-8"))


edit("static/style.css", [
    (".pos-DEF, .pos-badge.badge-def { background: #5e4718; color: #f6c35c; }\n"
     ".pos-MID, .pos-badge.badge-mid { background: #351d4a; color: #d2a8ff; }\n"
     ".pos-FWD, .pos-badge.badge-fwd { background: #46230a; color: #ffa671; }\n"
     ".pos-RUC, .pos-badge.badge-ruc { background: #38311b; color: #efe7bd; }",
     ".pos-DEF, .pos-badge.badge-def { background: #5a4313; color: #f8c552; }\n"
     ".pos-MID, .pos-badge.badge-mid { background: #3a2152; color: #d6b0ff; }\n"
     ".pos-FWD, .pos-badge.badge-fwd { background: #5c1f18; color: #ff9484; }\n"
     ".pos-RUC, .pos-badge.badge-ruc { background: #46423b; color: #f1ebdd; }"),
    ("  .pos-DEF, .pos-badge.badge-def { background: rgba(94,71,24,.6); color: #f7c96c; }\n"
     "  .pos-MID, .pos-badge.badge-mid { background: rgba(53,29,74,.6); color: #dbb8ff; }\n"
     "  .pos-FWD, .pos-badge.badge-fwd { background: rgba(70,35,10,.6); color: #ffb98a; }\n"
     "  .pos-RUC, .pos-badge.badge-ruc { background: rgba(56,49,27,.6); color: #f5f0d4; }",
     "  .pos-DEF, .pos-badge.badge-def { background: rgba(90,67,19,.7); color: #f8c552; }\n"
     "  .pos-MID, .pos-badge.badge-mid { background: rgba(58,33,82,.7); color: #d6b0ff; }\n"
     "  .pos-FWD, .pos-badge.badge-fwd { background: rgba(92,31,24,.7); color: #ff9484; }\n"
     "  .pos-RUC, .pos-badge.badge-ruc { background: rgba(70,66,59,.7); color: #f1ebdd; }"),
    (".fv-rtg-elite { color: var(--kl-accent-green) !important; }\n"
     ".fv-rtg-good  { color: var(--kl-accent-yellow) !important; }\n"
     ".fv-rtg-avg   { color: var(--kl-accent-orange) !important; }",
     ".fv-rtg-elite { color: #ffc94d !important; }\n"
     ".fv-rtg-good  { color: #e4d8a6 !important; }\n"
     ".fv-rtg-avg   { color: #f08a4b !important; }"),
    (""".btn-primary {
  background: linear-gradient(135deg, #99722d 0%, #cb9a36 100%);
  border-color: rgba(153,114,45,.55);
  color: #ffffff;
  box-shadow: 0 4px 16px -4px rgba(153,114,45,.45);
}
.btn-primary:hover {
  background: linear-gradient(135deg, #9e7329 0%, #d3a342 100%);
  border-color: rgba(206,157,58,.7);
  color: #ffffff;
  box-shadow: 0 6px 20px -4px rgba(153,114,45,.6);
}

.btn-success {
  background: linear-gradient(135deg, #876e3b 0%, #d0c89f 100%);
  border-color: rgba(135,110,59,.55);
  color: #ffffff;
  box-shadow: 0 4px 16px -4px rgba(135,110,59,.45);
}
.btn-success:hover {
  background: linear-gradient(135deg, #d0c89f 0%, #d1c99e 100%);
  border-color: rgba(206,198,161,.7);
  color: #ffffff;
  box-shadow: 0 6px 20px -4px rgba(135,110,59,.6);
}""", """.btn-primary {
  background: var(--kl-gold);
  border-color: var(--kl-gold);
  color: var(--kl-gold-ink);
  box-shadow: none;
}
.btn-primary:hover {
  background: #ffcb5e;
  border-color: #ffcb5e;
  color: var(--kl-gold-ink);
  box-shadow: none;
}

.btn-success {
  background: #e4d8a6;
  border-color: #e4d8a6;
  color: var(--kl-gold-ink);
  box-shadow: none;
}
.btn-success:hover {
  background: #f1e8c0;
  border-color: #f1e8c0;
  color: var(--kl-gold-ink);
  box-shadow: none;
}"""),
])

POS4 = "DEF: '#f8c552', MID: '#d6b0ff', FWD: '#ff9484', RUC: '#f1ebdd'"
for path, old, new in [
    ("frontend/src/pages/players/StatsPage.tsx",
     "DEF: '#f5b940', MID: '#bc8cff', RUC: '#dbcf94', FWD: '#f0763e',", POS4 + ","),
    ("frontend/src/pages/team/AnalyticsPage.tsx",
     "{ DEF: '#f5b940', MID: '#d2a8ff', RUC: '#dbcf94', FWD: '#fb7f3c', FLEX: '#f67b29' }",
     "{ " + POS4 + ", FLEX: '#f08a4b' }"),
    ("frontend/src/pages/team/TeamStatsPage.tsx",
     "  DEF: '#f5b940', MID: '#bc8cff', FWD: '#f0763e', RUC: '#dbcf94',\n", "  " + POS4 + ",\n"),
    ("frontend/src/pages/team/TeamStatsPage.tsx",
     "{ DEF: '#f5b940', MID: '#bc8cff', FWD: '#f0763e', RUC: '#dbcf94' }", "{ " + POS4 + " }"),
    ("frontend/src/pages/team/ValueCloud3D.tsx",
     "{ DEF: '#f5b940', MID: '#bc8cff', FWD: '#f0763e', RUC: '#dbcf94' }", "{ " + POS4 + " }"),
    ("frontend/src/components/season/slides.tsx",
     "DEF: '#f6bf50', MID: '#eee5b8', RUC: '#ffa45f', FWD: '#ff7d8f', FLEX: '#c99cff',",
     "DEF: '#f8c552', MID: '#d6b0ff', RUC: '#f1ebdd', FWD: '#ff9484', FLEX: '#f08a4b',"),
]:
    edit(path, [(old, new)])

SQ_OLD = """  DEF: { bg: 'rgba(94,71,24,.35)', text: '#f6c35c', row: 'rgba(94,71,24,.08)' },
  MID: { bg: 'rgba(53,29,74,.35)', text: '#d2a8ff', row: 'rgba(53,29,74,.08)' },
  RUC: { bg: 'rgba(56,49,27,.35)', text: '#efe7bd', row: 'rgba(56,49,27,.08)' },
  FWD: { bg: 'rgba(70,35,10,.35)', text: '#ffa671', row: 'rgba(70,35,10,.08)' },"""
SQ_NEW = """  DEF: { bg: 'rgba(90,67,19,.45)', text: '#f8c552', row: 'rgba(90,67,19,.10)' },
  MID: { bg: 'rgba(58,33,82,.45)', text: '#d6b0ff', row: 'rgba(58,33,82,.10)' },
  RUC: { bg: 'rgba(70,66,59,.45)', text: '#f1ebdd', row: 'rgba(70,66,59,.10)' },
  FWD: { bg: 'rgba(92,31,24,.45)', text: '#ff9484', row: 'rgba(92,31,24,.10)' },"""
edit("frontend/src/pages/team/SquadPage.tsx", [(SQ_OLD, SQ_NEW)])
edit("frontend/src/components/squad/HistoricalSquadView.tsx", [(SQ_OLD, SQ_NEW)])

edit("models/season_review.py", [("""TEAM_PALETTE = [
    "#f5b940", "#ffa671", "#bc8cff", "#dbcf94", "#e38241",
    "#ff7b72", "#efe7bd", "#f778ba", "#f6c35c", "#ff8e64",
    "#ddd299", "#f4ca75",
]""", """TEAM_PALETTE = [
    "#f5b940", "#ff7b72", "#c79bff", "#f1ebdd", "#f08a4b",
    "#f778ba", "#d9c27a", "#e0563f", "#9d7bd8", "#ffb48a",
    "#b89a5e", "#ff9ed0",
]""")])

edit("blueprints/leagues_players.py", [("""        ("#f6c35c", "rgba(245,185,64,.18)"),    # blue
        ("#ffa671", "rgba(240,118,62,.18)"),    # orange
        ("#d2a8ff", "rgba(188,140,255,.18)"),   # purple
        ("#efe7bd", "rgba(219,207,148,.18)"),     # green
        ("#e38241", "rgba(210,104,34,.18)"),    # yellow
        ("#ff7b72", "rgba(248,81,73,.18)"),     # red
        ("#f8d182", "rgba(246,195,92,.18)"),   # light blue
        ("#f778ba", "rgba(219,97,162,.18)"),    # pink""", """        ("#f8c552", "rgba(245,185,64,.18)"),    # gold
        ("#ff8f7f", "rgba(248,81,73,.18)"),     # red
        ("#d6b0ff", "rgba(188,140,255,.18)"),   # purple
        ("#f1ebdd", "rgba(241,235,221,.14)"),   # bone
        ("#f6a063", "rgba(240,138,75,.18)"),    # orange
        ("#f98bc4", "rgba(219,97,162,.18)"),    # pink
        ("#d9c27a", "rgba(217,194,122,.16)"),   # sand
        ("#b79be0", "rgba(157,123,216,.18)"),   # violet""")])

edit("frontend/src/pages/draft/MockDraftPage.tsx", [("""  if (r >= 80) return '#dbcf94'
  if (r >= 70) return '#d26822'
  if (r >= 60) return '#f0763e'""", """  if (r >= 80) return '#ffc94d'
  if (r >= 70) return '#e4d8a6'
  if (r >= 60) return '#f08a4b'""")])

for path in ("frontend/index.html", "templates/base.html"):
    full = os.path.join(ROOT, path)
    s = open(full, "rb").read().decode("utf-8")
    import re
    s = re.sub(r'(<meta name="theme-color" content=")[^"]*(")', r"\g<1>#0c0b0a\2", s)
    open(full, "wb").write(s.encode("utf-8"))

print("hand-set colours applied")


def remap_bare_triplets():
    """`--lgs-rgb: 58,125,196` and `rgb(var(--x, 58,125,196))`: colour triplets
    written without rgb(), which the main pass can't see. Same role mapping."""
    import re
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from retheme import remap, files

    bare = re.compile(r"(?<!rgba\()(?<!rgb\()(?<![\d.,(])\b(\d{1,3}),(\d{1,3}),(\d{1,3})\b(?!\s*[,.]?\d)")
    n = 0
    for path in files():
        raw = open(path, "rb").read()
        text = raw.decode("utf-8")

        def sub(m):
            nonlocal n
            r, g, b = (int(x) for x in m.groups())
            if max(r, g, b) > 255:
                return m.group(0)
            n += 1
            return "%d,%d,%d" % remap(r, g, b)

        new = bare.sub(sub, text)
        if new != text:
            open(path, "wb").write(new.encode("utf-8"))
    print("bare triplets remapped:", n)


if __name__ == "__main__" and os.environ.get("KL_TRIPLETS") == "1":
    remap_bare_triplets()

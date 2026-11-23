"""Run once, straight after tools/retheme2.py --apply.

Puts back, exactly, the colour sets that were re-chosen by hand during the
gold scheme (positions, ratings, team ramps), and writes the second-cut theme
variables. Structural matches, so it does not depend on what the remap turned
those hand-set colours into.
"""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rewrite(path, fn):
    full = os.path.join(ROOT, path)
    b = open(full, "rb").read()
    crlf = b"\r\n" in b
    s = b.decode("utf-8").replace("\r\n", "\n")
    out = fn(s)
    assert out != s, f"{path}: nothing changed"
    if crlf:
        out = out.replace("\n", "\r\n")
    open(full, "wb").write(out.encode("utf-8"))
    print("restored", path)


def sub1(pattern, repl, s, flags=re.S, count=1):
    new, n = re.subn(pattern, lambda _m: repl, s, count=count, flags=flags)
    assert n >= 1, f"no match: {pattern[:70]}"
    return new


ROOT_VARS = '''  /* 2027 scheme, second cut. Chrome is black and white. Colour is kept for
     things that mean something: a position, a rating, form, a club, a team.
     The old variable names survive as roles:
       --kl-accent-blue = interactive (ice white)   --kl-accent-green = positive
       --kl-accent-yellow = warning                 --kl-accent-red = negative
     The signed-in coach's team colour arrives as --team (r,g,b), set on the
     root by LeagueShell; it lights the top of the page and the rail. */
  --kl-bg-body: #060608;
  --kl-bg-card: #111114;
  --kl-bg-elevated: #1b1b20;
  --kl-bg-hover: #16161a;
  --kl-border: #2a2a31;
  --kl-border-light: #4a4a56;
  --kl-text-primary: #ececf1;
  --kl-text-heading: #ffffff;
  --kl-text-secondary: #b6b6c2;
  --kl-text-muted: #8f8f9b;
  --kl-text-faint: #6a6a76;
  --kl-accent-blue: #ececf6;
  --kl-accent-green: #3fb950;
  --kl-accent-red: #f85149;
  --kl-accent-yellow: #d29922;
  --kl-accent-orange: #f0883e;
  --kl-accent-purple: #bc8cff;
  --kl-accent: #ececf6;           /* interactive */
  --kl-accent-ink: #08080a;       /* text on an accent fill */
  --kl-positive: #3fb950;
  --kl-negative: #f85149;
  --kl-warning: #d29922;
  --kl-ink: #060608;
  --team: 236,236,246;
  /* Positions: one colour each, everywhere. */
  --pos-def: #58a6ff; --pos-def-bg: #1a3f66;
  --pos-mid: #bc8cff; --pos-mid-bg: #351d4a;
  --pos-ruc: #3fb950; --pos-ruc-bg: #1d3d2e;
  --pos-fwd: #f0883e; --pos-fwd-bg: #46290a;
  /* Bootstrap's own palette, so its links, focus rings and utilities follow. */
  --bs-primary: #ececf6;
  --bs-primary-rgb: 236,236,246;
  --bs-success: #3fb950;
  --bs-success-rgb: 63,185,80;
  --bs-info: #ececf6;
  --bs-info-rgb: 236,236,246;
  --bs-warning: #d29922;
  --bs-warning-rgb: 210,153,34;
  --bs-danger: #f85149;
  --bs-danger-rgb: 248,81,73;
  --bs-link-color: #ffffff;
  --bs-link-color-rgb: 255,255,255;
  --bs-link-hover-color: #ffffff;
  --bs-link-hover-color-rgb: 255,255,255;
  --bs-focus-ring-color: rgba(236,236,246,.28);
  --bs-body-color: #ececf1;
  --bs-body-color-rgb: 236,236,241;
  --bs-body-bg: #060608;
  --bs-body-bg-rgb: 6,6,8;
  --bs-emphasis-color: #ffffff;
  --bs-emphasis-color-rgb: 255,255,255;
  --bs-heading-color: #ffffff;
  --bs-secondary: #b6b6c2;
  --bs-secondary-rgb: 182,182,194;
  --bs-secondary-color: rgba(236,236,241,.78);
  --bs-secondary-color-rgb: 236,236,241;
  --bs-secondary-bg: #1b1b20;
  --bs-secondary-bg-rgb: 27,27,32;
  --bs-tertiary-color: rgba(236,236,241,.55);
  --bs-tertiary-color-rgb: 236,236,241;
  --bs-tertiary-bg: #111114;
  --bs-tertiary-bg-rgb: 17,17,20;
  --bs-border-color: #2a2a31;
  --bs-border-color-translucent: rgba(255,255,255,.12);
  --bs-dark: #111114;
  --bs-dark-rgb: 17,17,20;
'''

BUTTONS = '''.btn-primary {
  background: #ffffff;
  border-color: #ffffff;
  color: #08080a;
  box-shadow: none;
}
.btn-primary:hover {
  background: #dcdce6;
  border-color: #dcdce6;
  color: #08080a;
  box-shadow: none;
}

.btn-success {
  background: #3fb950;
  border-color: #3fb950;
  color: #04140a;
  box-shadow: none;
}
.btn-success:hover {
  background: #56d364;
  border-color: #56d364;
  color: #04140a;
  box-shadow: none;
}'''


def css(s):
    a = s.index("  /* 2027 scheme: black and gold.")
    z = s.index("  /* ── Spacing scale (canonical) ──")
    s = s[:a] + ROOT_VARS + s[z:]
    s = sub1(r"\.pos-DEF, \.pos-badge\.badge-def \{[^}]*\}\n\.pos-MID, \.pos-badge\.badge-mid \{[^}]*\}\n"
             r"\.pos-FWD, \.pos-badge\.badge-fwd \{[^}]*\}\n\.pos-RUC, \.pos-badge\.badge-ruc \{[^}]*\}",
             ".pos-DEF, .pos-badge.badge-def { background: var(--pos-def-bg); color: #79c0ff; }\n"
             ".pos-MID, .pos-badge.badge-mid { background: var(--pos-mid-bg); color: #d2a8ff; }\n"
             ".pos-FWD, .pos-badge.badge-fwd { background: var(--pos-fwd-bg); color: #ffb471; }\n"
             ".pos-RUC, .pos-badge.badge-ruc { background: var(--pos-ruc-bg); color: #7ee787; }", s)
    s = sub1(r"  \.pos-DEF, \.pos-badge\.badge-def \{[^}]*\}\n  \.pos-MID, \.pos-badge\.badge-mid \{[^}]*\}\n"
             r"  \.pos-FWD, \.pos-badge\.badge-fwd \{[^}]*\}\n  \.pos-RUC, \.pos-badge\.badge-ruc \{[^}]*\}",
             "  .pos-DEF, .pos-badge.badge-def { background: rgba(26,63,102,.6); color: #8cc8ff; }\n"
             "  .pos-MID, .pos-badge.badge-mid { background: rgba(53,29,74,.6); color: #dbb8ff; }\n"
             "  .pos-FWD, .pos-badge.badge-fwd { background: rgba(70,41,10,.6); color: #ffc58a; }\n"
             "  .pos-RUC, .pos-badge.badge-ruc { background: rgba(29,61,46,.6); color: #90edb0; }", s)
    s = sub1(r"\.fv-rtg-elite \{[^}]*\}\n\.fv-rtg-good  \{[^}]*\}\n\.fv-rtg-avg   \{[^}]*\}",
             ".fv-rtg-elite { color: var(--kl-accent-green) !important; }\n"
             ".fv-rtg-good  { color: var(--kl-accent-yellow) !important; }\n"
             ".fv-rtg-avg   { color: var(--kl-accent-orange) !important; }", s)
    s = sub1(r"\.btn-primary \{[^}]*\}\n\.btn-primary:hover \{[^}]*\}\n\n\.btn-success \{[^}]*\}\n\.btn-success:hover \{[^}]*\}",
             BUTTONS, s)
    s = sub1(r"\.fv-card-def \{[^}]*\}", ".fv-card-def { border-left: 3px solid var(--pos-def); }", s)
    s = sub1(r"\.fv-card-ruc \{[^}]*\}", ".fv-card-ruc { border-left: 3px solid var(--pos-ruc); }", s)
    s = s.replace("var(--kl-gold-ink)", "var(--kl-accent-ink)").replace("var(--kl-gold)", "var(--kl-accent)")
    return s


POS4 = "DEF: '#58a6ff', MID: '#bc8cff', FWD: '#f0883e', RUC: '#3fb950'"
SQ = """  DEF: { bg: 'rgba(26,63,102,.35)', text: '#79c0ff', row: 'rgba(26,63,102,.08)' },
  MID: { bg: 'rgba(53,29,74,.35)', text: '#d2a8ff', row: 'rgba(53,29,74,.08)' },
  RUC: { bg: 'rgba(29,61,46,.35)', text: '#7ee787', row: 'rgba(29,61,46,.08)' },
  FWD: { bg: 'rgba(70,41,10,.35)', text: '#ffb471', row: 'rgba(70,41,10,.08)' },
"""

rewrite("static/style.css", css)
rewrite("models/season_review.py", lambda s: sub1(
    r"TEAM_PALETTE = \[[^\]]*\]",
    'TEAM_PALETTE = [\n    "#58a6ff", "#ffb471", "#bc8cff", "#3fb950", "#e3b341",\n'
    '    "#ff7b72", "#7ee787", "#f778ba", "#79c0ff", "#ff9e64",\n    "#9ece6a", "#bb9af7",\n]', s))
rewrite("blueprints/leagues_players.py", lambda s: sub1(
    r"    _team_palette = \[[^\]]*\]",
    '''    _team_palette = [
        ("#79c0ff", "rgba(88,166,255,.18)"),    # blue
        ("#ffb471", "rgba(240,136,62,.18)"),    # orange
        ("#d2a8ff", "rgba(188,140,255,.18)"),   # purple
        ("#7ee787", "rgba(63,185,80,.18)"),     # green
        ("#e3b341", "rgba(210,153,34,.18)"),    # yellow
        ("#ff7b72", "rgba(248,81,73,.18)"),     # red
        ("#a5d6ff", "rgba(121,192,255,.18)"),   # light blue
        ("#f778ba", "rgba(219,97,162,.18)"),    # pink
    ]''', s))
rewrite("frontend/src/components/layout/LeagueShell.tsx", lambda s: sub1(
    r"const SWITCH_PALETTE: \{ hex: string; rgb: string \}\[\] = \[.*?\n\]",
    '''const SWITCH_PALETTE: { hex: string; rgb: string }[] = [
  { hex: '#3a7dc4', rgb: '58,125,196' },    // sapphire
  { hex: '#b87f3d', rgb: '184,127,61' },    // cognac
  { hex: '#8a6db8', rgb: '138,109,184' },   // amethyst
  { hex: '#3d8c63', rgb: '61,140,99' },     // forest green
  { hex: '#c2932f', rgb: '194,147,47' },    // deep gold / ochre
  { hex: '#b85a4a', rgb: '184,90,74' },     // rust
  { hex: '#3d8a9c', rgb: '61,138,156' },    // teal
  { hex: '#9d5878', rgb: '157,88,120' },    // garnet
]''', s))
for path in ("frontend/src/pages/team/SquadPage.tsx", "frontend/src/components/squad/HistoricalSquadView.tsx"):
    rewrite(path, lambda s: sub1(
        r"  DEF: \{ bg: [^\n]*\n  MID: \{ bg: [^\n]*\n  RUC: \{ bg: [^\n]*\n  FWD: \{ bg: [^\n]*\n", SQ, s))
rewrite("frontend/src/pages/players/StatsPage.tsx", lambda s: sub1(
    r"const POS_COLORS: Record<string, string> = \{\n[^\n]*\n\}",
    "const POS_COLORS: Record<string, string> = {\n  " + POS4 + ",\n}", s))
rewrite("frontend/src/pages/team/AnalyticsPage.tsx", lambda s: sub1(
    r"const PC: Record<string, string> = \{[^}]*\}",
    "const PC: Record<string, string> = { " + POS4 + ", FLEX: '#fbbf24' }", s))


def team_stats(s):
    s = sub1(r"const POS_COLOR: Record<string, string> = \{\n[^\n]*\n\}",
             "const POS_COLOR: Record<string, string> = {\n  " + POS4 + ",\n}", s)
    return sub1(r"const SM_POS_COLOR: Record<string, string> = \{[^}]*\}",
                "const SM_POS_COLOR: Record<string, string> = { " + POS4 + " }", s)


rewrite("frontend/src/pages/team/TeamStatsPage.tsx", team_stats)
rewrite("frontend/src/pages/team/ValueCloud3D.tsx", lambda s: sub1(
    r"const POS_COLOR: Record<string, string> = \{[^}]*\}",
    "const POS_COLOR: Record<string, string> = { " + POS4 + " }", s))
rewrite("frontend/src/components/season/slides.tsx", lambda s: sub1(
    r"const LINE_COLOUR: Record<string, string> = \{\n[^\n]*\n\}",
    "const LINE_COLOUR: Record<string, string> = {\n"
    "  DEF: '#6bb2ff', MID: '#7fe0a6', RUC: '#ffb45f', FWD: '#ff7d8f', FLEX: '#c99cff',\n}", s))
rewrite("frontend/src/pages/draft/MockDraftPage.tsx", lambda s: sub1(
    r"  if \(r >= 80\) return '[^']*'\n  if \(r >= 70\) return '[^']*'\n  if \(r >= 60\) return '[^']*'",
    "  if (r >= 80) return '#3fb950'\n  if (r >= 70) return '#d29922'\n  if (r >= 60) return '#f0883e'", s))
print("done")

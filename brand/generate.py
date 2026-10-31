"""Generate the Kairotic brand SVGs, letters outlined from IBM Plex Mono Medium.

Usage: python3 brand/generate.py path/to/IBMPlexMono-Medium.ttf brand   (needs fonttools)
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

font_path, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
f = TTFont(font_path)
gs = f.getGlyphSet()
cmap = f.getBestCmap()
S = 0.1  # 1000 upm -> 100 units per em

def glyph(ch, x):
    name = cmap[ord(ch)]
    pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
    gs[name].draw(TransformPen(pen, (S, 0, 0, -S, x, 0)))
    b = BoundsPen(gs); gs[name].draw(b)
    x0, y0, x1, y1 = b.bounds
    return pen.getCommands(), (x + x0 * S, -y1 * S, x + x1 * S, -y0 * S)

INK, INK_D = "#1b2430", "#e3e8ee"
DOT, DOT_D = "#b4472e", "#e58a6f"

# the Rama k (viewBox 20 6 68 88); open node drawn as a ring, arm stops at its edge
K = """<path d="M30 12 V88" stroke-width="11"/>
<path d="M30 56 C48 56 54 26 67 20.7" stroke-width="9"/>
<path d="M30 56 C48 56 56 76 75 82" stroke-width="9"/>
<circle cx="76" cy="17" r="7.5" stroke-width="4.5"/>
<circle cx="78" cy="83" r="7.5" class="f" stroke="none"/>
<circle cx="30" cy="56" r="11" class="d" stroke="none"/>"""
BR = """<path d="M34 50 H44 M44 50 C52 50 54 33 62 32 M44 50 C52 50 54 67 62 68" stroke-width="7"/>
<circle cx="44" cy="50" r="7.5" class="d" stroke="none"/>"""
PK = """<path d="M26 14 C10 32 10 68 26 86" stroke-width="8"/>
<path d="M74 14 C90 32 90 68 74 86" stroke-width="8"/>
<path d="M40 26 V74" stroke-width="7"/>
<path d="M40 54 C50 54 53 37 56 33.7" stroke-width="6"/>
<path d="M40 54 C50 54 54 66 60 70" stroke-width="6"/>
<circle cx="61" cy="30" r="4.8" stroke-width="2.8"/>
<circle cx="62" cy="71" r="4.8" class="f" stroke="none"/>
<circle cx="40" cy="54" r="7" class="d" stroke="none"/>"""
PKS = """<path d="M24 10 C6 30 6 70 24 90" stroke-width="12"/>
<path d="M76 10 C94 30 94 70 76 90" stroke-width="12"/>
<path d="M40 22 V78" stroke-width="12"/>
<path d="M40 56 C52 56 56 34 64 28 M40 56 C52 56 57 68 65 74" stroke-width="10"/>
<circle cx="40" cy="56" r="10" class="d" stroke="none"/>"""

def style(ink, dot, adaptive):
    s = (f"g{{fill:none;stroke:{ink};stroke-linecap:round}}.f,.t{{fill:{ink}}}.t{{stroke:none}}.d{{fill:{dot}}}")
    if adaptive:
        s += (f"@media (prefers-color-scheme:dark){{g{{stroke:{INK_D}}}.f,.t{{fill:{INK_D}}}.d{{fill:{DOT_D}}}}}")
    return f"<style>{s}</style>"

def svg(vb, body, ink=INK, dot=DOT, adaptive=False, label="Kairotic", w=None, h=None):
    size = f' width="{w}" height="{h}"' if w else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{size} role="img" aria-label="{label}">'
            f'<title>{label}</title>{style(ink, dot, adaptive)}<g>{body}</g></svg>\n')

def wordmark(parens=True, branch=True):
    parts, boxes, x = [], [], 0
    def text(s):
        nonlocal x
        for ch in s:
            d, b = glyph(ch, x); parts.append(f'<path class="t" d="{d}"/>'); boxes.append(b); x += 60
    if parens: text("(")
    parts.append(f'<svg x="{x}" y="-75" width="60" height="78" viewBox="20 6 68 88">{K}</svg>')
    boxes.append((x, -75, x + 60, 3)); x += 60
    text("airotic")
    if branch:
        x += 4
        parts.append(f'<svg x="{x}" y="-82.5" width="50" height="90" viewBox="30 14 40 72">{BR}</svg>')
        boxes.append((x, -82.5, x + 50, 7.5)); x += 54
    if parens: text(")")
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    pad = 4
    vb = f"{x0 - pad:.1f} {y0 - pad:.1f} {x1 - x0 + 2 * pad:.1f} {y1 - y0 + 2 * pad:.1f}"
    return vb, "".join(parts)

files = {}
vb, body = wordmark()
files["kairotic-logo.svg"] = svg(vb, body)
files["kairotic-logo-dark.svg"] = svg(vb, body, INK_D, DOT_D)
files["kairotic-logo-adaptive.svg"] = svg(vb, body, adaptive=True)
vb, body = wordmark(branch=False)
files["kairotic-logo-closed.svg"] = svg(vb, body)
vb, body = wordmark(parens=False, branch=False)
files["kairotic-wordmark.svg"] = svg(vb, body)
files["kairotic-icon.svg"] = svg("0 0 100 100", PK, adaptive=True)
files["kairotic-icon-small.svg"] = svg("0 0 100 100", PKS, adaptive=True)
files["kairotic-icon-light.svg"] = svg("0 0 100 100", PK)
files["kairotic-icon-dark.svg"] = svg("0 0 100 100", PK, INK_D, DOT_D)
# app icon: rounded tile
tile = lambda bg, ink, dot: (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Kairotic">'
    f'<title>Kairotic</title>{style(ink, dot, False)}<rect width="100" height="100" rx="23" fill="{bg}"/>'
    f'<svg x="12" y="12" width="76" height="76" viewBox="0 0 100 100"><g>{PK}</g></svg></svg>\n')
files["kairotic-app-icon.svg"] = tile(INK, INK_D, DOT_D)
for n, s in files.items():
    open(os.path.join(out, n), "w").write(s)
print("\n".join(files))

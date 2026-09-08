"""Generate the Crystals look's three parallax layers.

    python tools/gen-ambient-crystals.py

Writes rocks_out.txt beside itself; paste each data URI into the matching
`body:not(.amb-theme-fire):not(.amb-theme-night) .amb-{far,canopy,under}` rule
in css/ambient.css.

WHY THIS EXISTS
---------------
The Crystals scene was 54 flat triangles -- `M129 174 L175 174 L151 51 Z`, an
average of 26 characters each, not one of them curved. Fireflies, the look this
is measured against, is 177 paths in the same layer, every one of them a curve,
averaging 55 characters. That gap is the whole of why one reads as a place and
the other as a row of spines.

The answer is NOT to add curves. Fireflies is curved because leaves are; a
crystal is faceted, and copying the technique rather than the intent would give
soft crystals, which is worse than sharp triangles. The equivalent investment
for a mineral is FACES: every prism here is built from four shaded faces plus a
terminated cap, so the facet lines fall out of where the faces meet instead of
being drawn on top, and each crystal catches light on one side and loses it on
the other.

That follows how crystals are actually drawn -- enclose the tip, run lines the
length of the body, keep one face light and one dark, and vary the weight of
the edges rather than making every line equal.

Fixed seed, so re-running reproduces the art in the CSS byte for byte. The
layers are repeat-x, so anything crossing an edge is emitted again a full width
over rather than being cut in half at the seam.
"""
import math
import random

# ── Palette ────────────────────────────────────────────────────
# The cavern's own blues carry the bulk, so the place is unchanged. A minority
# of crystals take a mineral hue, which is what puts colour in the scene
# without turning it into a sweet shop.
CAVE = ['#2f3b80', '#33407f', '#2a3572']
MINERAL = ['#7c3aed', '#be3455', '#b45309', '#0e7490', '#15803d']
MINERAL_RATE = 0.34          # how many crystals are not simply blue


def shade(hex_colour, amount):
    """Lighten (amount > 0) or darken (amount < 0) toward white or black."""
    h = hex_colour.lstrip('#')
    rgb = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    out = []
    for c in rgb:
        c = c + (255 - c) * amount if amount > 0 else c * (1 + amount)
        out.append(max(0, min(255, int(round(c)))))
    return '#%02x%02x%02x' % tuple(out)


def pts(p):
    return 'M' + ' L'.join('%g %g' % (round(x, 1), round(y, 1)) for x, y in p) + ' Z'


# ── One crystal ────────────────────────────────────────────────
def prism(bx, by, h, w, tilt, up, base, rng):
    """A terminated prism as separate faces, dark side to light side.

    Returns [(path, fill, opacity)]. The seam between the two body faces IS the
    facet line -- drawing one over a single flat shape gives a line on a
    triangle, not a solid with two sides to it.
    """
    d = -1 if up else 1
    tipx, tipy = bx + tilt * h, by + d * h
    shy = by + d * h * rng.uniform(0.66, 0.78)      # where the cap begins
    shx = bx + tilt * h * 0.72
    sw = w * 0.84                                    # prisms taper a little

    # The ridge sits off centre, so the two faces are unequal -- an even split
    # reads as a folded card rather than as something with a near side.
    r = rng.uniform(-0.34, 0.34)
    bc = (bx + w * r, by)
    sc = (shx + sw * r, shy)

    dark = shade(base, -0.32)
    lit = shade(base, 0.20)
    cap = shade(base, 0.34)

    faces = [
        ([(bx - w, by), (shx - sw, shy), sc, bc], dark, 0.95),
        ([bc, sc, (shx + sw, shy), (bx + w, by)], lit, 0.95),
        ([(shx - sw, shy), (tipx, tipy), sc], shade(base, 0.06), 0.95),
        ([sc, (tipx, tipy), (shx + sw, shy)], cap, 0.95),
    ]
    # A thin bright strip down the lit face, on the taller ones only: a
    # highlight on something small is just noise.
    if h > 34 and rng.random() < 0.55:
        t = rng.uniform(0.30, 0.62)
        x0 = bc[0] + (bx + w - bc[0]) * t
        x1 = sc[0] + (shx + sw - sc[0]) * t
        ww = max(0.7, w * 0.10)
        faces.append(([(x0 - ww, by), (x1 - ww, shy), (x1 + ww, shy), (x0 + ww, by)],
                      shade(base, 0.52), 0.5))
    return faces


def cluster(cx, base_y, spread, h, up, rng):
    """Crystals fanning off a shared base, tallest near the middle.

    Real druse radiates -- parallel prisms read as a fence. The angle grows with
    distance from the centre, so the group opens outward.
    """
    out = []
    n = rng.randint(3, 5)
    for i in range(n):
        f = (i + rng.uniform(0.1, 0.9)) / n * 2 - 1          # -1 .. 1
        px = cx + spread * f
        # Tallest at the heart of the cluster, falling off toward the edges.
        ph = h * (0.42 + 0.58 * math.cos(f * 1.25) ** 2) * rng.uniform(0.82, 1.12)
        pw = max(1.8, ph * rng.uniform(0.115, 0.185))
        tilt = f * rng.uniform(0.16, 0.30)                   # fan outward
        col = rng.choice(MINERAL) if rng.random() < MINERAL_RATE else rng.choice(CAVE)
        out += prism(px, base_y, ph, pw, tilt, up, col, rng)
    return out


def layer(w, h, base_y, bands, up, seed):
    """bands = [(count, spread_range, height_range, opacity, detail)]"""
    rng = random.Random(seed)
    faces = []
    for count, spr, hr, op, detail in bands:
        for _ in range(count):
            cx = rng.uniform(-25, w + 25)
            spread = rng.uniform(*spr)
            ch = rng.uniform(*hr)
            for dx in (0, -w, w):                            # wrap for repeat-x
                if -50 < cx + dx < w + 50:
                    for p, fill, o in cluster(cx + dx, base_y, spread, ch, up, rng):
                        if not detail and o < 0.9:           # far layer keeps no highlights
                            continue
                        faces.append((p, fill, round(o * op, 2)))

    svg = ["<svg xmlns='http://www.w3.org/2000/svg' width='%d' height='%d' "
           "viewBox='0 0 %d %d'>" % (w, h, w, h)]
    svg += ["<path d='%s' fill='%s' fill-opacity='%s'/>" % (pts(p), fill, o)
            for p, fill, o in faces]
    svg.append("</svg>")
    return ''.join(svg), len(faces)


def uri(svg):
    return svg.replace('<', '%3C').replace('>', '%3E').replace('#', '%23')


# .amb-under — the near growth along the floor, the densest of the three
under, n_under = layer(340, 170, 174, [
    (3, (26, 44), (74, 112), 0.96, True),     # back, tall
    (4, (20, 34), (46, 78), 0.88, True),      # middle
    (6, (13, 24), (24, 44), 0.72, True),      # front, small, fills the base line
], up=True, seed=101)

# .amb-canopy — crystal hanging down from the ceiling
canopy, n_canopy = layer(380, 130, -4, [
    (3, (24, 40), (58, 92), 0.92, True),
    (4, (16, 28), (32, 56), 0.7, True),
], up=False, seed=202)

# .amb-far — the distant ridge. Simple and pale: it is blurred in the CSS, and
# detail behind a blur is detail spent for nothing.
far, n_far = layer(420, 96, 100, [
    (5, (22, 38), (30, 56), 0.55, False),
], up=True, seed=303)

if __name__ == '__main__':
    for name, svg, n in (('under', under, n_under),
                         ('canopy', canopy, n_canopy),
                         ('far', far, n_far)):
        print('%-7s %3d faces  %5d chars -> %5d encoded' % (name, n, len(svg), len(uri(svg))))
    with open('rocks_out.txt', 'w', encoding='utf-8') as f:
        for name, svg in (('under', under), ('canopy', canopy), ('far', far)):
            f.write(name + '\n' + uri(svg) + '\n')

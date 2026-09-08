"""Generate the Crystals look's three parallax layers: rock carrying crystals.

    python tools/gen-ambient-crystals.py

Writes rocks_out.txt beside itself; paste each data URI into the matching
`body:not(.amb-theme-fire):not(.amb-theme-night) .amb-{far,canopy,under}` rule
in css/ambient.css.

KEPT THIS TIME. The note in css/ambient.css has always said this art is
generated from plain coordinates on a fixed seed, but no generator was ever
committed -- so the only way to adjust a single rock was to hand-edit a 4,500
character data URI, which is exactly the silent failure that note warns about:
one stray %23 and the layer renders nothing at all, with no error anywhere.

Fixed seed, so re-running reproduces the art in the CSS byte for byte. Change a
seed or a range and the whole scene moves; that is the point.

The layers are repeat-x, so anything crossing an edge is emitted again a full
width over rather than being cut in half at the seam.
"""
import math, random

RED, AMBER, VIOLET, GREEN, CYAN, ROSE = '#ef4444', '#f59e0b', '#a78bfa', '#34d399', '#22d3ee', '#fb7185'
GEMS = [RED, AMBER, VIOLET, GREEN, CYAN, ROSE]


def pts(p):
    return 'M' + ' L'.join('%g %g' % (round(x, 1), round(y, 1)) for x, y in p) + ' Z'


def rock(cx, base, hw, h, rng, up=True):
    """A broken stone sitting on `base`. up=False hangs it downward.

    Faceted, not domed. A smooth sine profile with a little jitter gave rounded
    hills -- the silhouette of a landscape rather than of rock. The peak is
    thrown off centre, the flanks are few and straight, and each vertex carries
    real displacement, so the outline turns in hard angles the way split stone
    does.
    """
    d = -1 if up else 1
    apex = rng.uniform(-0.42, 0.42)                  # off-centre summit
    out = [(cx - hw, base)]
    for side, span in ((-1, 1 + apex), (1, 1 - apex)):
        steps = rng.randint(2, 3)
        for i in range(1, steps + 1):
            t = i / (steps + 1)
            x = cx + side * hw * (1 - t) if side < 0 else cx + hw * apex + side * hw * span * t
            if side < 0:
                x = cx - hw + (hw * (1 + apex)) * t
            # Straight flanks, stepped rather than curved.
            climb = t ** 0.82 if side < 0 else (1 - t) ** 0.82
            y = base + d * h * climb
            y += rng.uniform(-1, 1) * h * 0.16
            out.append((x, y))
        if side < 0:
            out.append((cx + hw * apex, base + d * h * rng.uniform(0.94, 1.0)))
    out.append((cx + hw, base))
    return out


def crystal(px, py, h, w, tilt, up=True):
    """A six-sided crystal growing out of a rock, tilted by `tilt`."""
    d = -1 if up else 1
    tipx, tipy = px + tilt * h, py + d * h
    sh = py + d * h * 0.55
    return [(px - w, py), (px - w * 0.86, sh), (tipx, tipy), (px + w * 0.86, sh), (px + w, py)]


def cluster(cx, base, hw, h, rng, up=True):
    """Crystals set INTO the rock -- small, low on the mound, and quiet.

    The first pass grew them to two thirds of the rock's height at up to 0.68
    opacity and they read as coloured sails, not as minerals: the rock vanished
    behind them and the whole thing fought the text it sits under. They are now
    a fifth of the rock at most, sit low on its shoulder rather than on its
    crown, and stay faint enough that the rock is still the shape you see.
    """
    out = []
    for _ in range(rng.randint(1, 3)):
        f = rng.uniform(-0.66, 0.66)
        px = cx + hw * f
        prof = math.cos(f * math.pi / 2) ** 0.8
        # Low on the flank, so it emerges from the rock instead of crowning it.
        py = base - h * prof * 0.46 if up else base + h * prof * 0.46
        ch = h * rng.uniform(0.11, 0.21)
        cw = max(1.3, ch * rng.uniform(0.20, 0.30))
        out.append((crystal(px, py, ch, cw, rng.uniform(-0.2, 0.2), up),
                    rng.choice(GEMS), round(rng.uniform(0.26, 0.42), 2)))
    return out


def layer(w, h, base, bands, up, seed):
    """bands = [(rock_fill, rock_opacity, count, (hw_lo,hw_hi), (h_lo,h_hi))]"""
    rng = random.Random(seed)
    groups, gems = [], []
    for band_i, (fill, op, count, hwr, hr) in enumerate(bands):
        paths = []
        for _ in range(count):
            cx = rng.uniform(-20, w + 20)
            hw = rng.uniform(*hwr)
            rh = rng.uniform(*hr)
            for dx in (0, -w, w):                       # wrap for repeat-x
                if -40 < cx + dx < w + 40:
                    paths.append(pts(rock(cx + dx, base, hw, rh, rng, up)))
                    if band_i == 0:                     # front band only; distance costs colour
                        for cp, col, co in cluster(cx + dx, base, hw, rh, rng, up):
                            gems.append((pts(cp), col, co))
        groups.append((fill, op, paths))

    svg = ["<svg xmlns='http://www.w3.org/2000/svg' width='%d' height='%d' viewBox='0 0 %d %d'>" % (w, h, w, h)]
    for fill, op, paths in groups:
        svg.append("<g fill='%s' opacity='%s'>" % (fill, op))
        svg += ["<path d='%s'/>" % p for p in paths]
        svg.append("</g>")
    for d, col, co in gems:
        svg.append("<path d='%s' fill='%s' fill-opacity='%s'/>" % (d, col, co))
    svg.append("</svg>")
    return ''.join(svg)


def uri(svg):
    return svg.replace('<', '%3C').replace('>', '%3E').replace('#', '%23')


# .amb-under — the near rocks along the floor
under = layer(340, 170, 174, [
    ('#2b3576', 0.95, 7, (26, 52), (55, 108)),
    ('#3d4a9c', 0.75, 6, (18, 34), (34, 72)),
], up=True, seed=11)

# .amb-canopy — rock hanging in from the ceiling
canopy = layer(380, 130, -4, [
    ('#222a5e', 0.92, 6, (24, 46), (48, 96)),
    ('#364285', 0.62, 6, (16, 30), (28, 58)),
], up=False, seed=23)

# .amb-far — the distant ridge, small and pale
far = layer(420, 96, 100, [
    ('#222c63', 0.55, 8, (28, 54), (28, 62)),
    ('#2f3b7e', 0.35, 7, (18, 32), (18, 38)),
], up=True, seed=37)

for name, svg in (('under', under), ('canopy', canopy), ('far', far)):
    print(name, len(svg), 'chars ->', len(uri(svg)), 'encoded')

with open('rocks_out.txt', 'w', encoding='utf-8') as f:
    for name, svg in (('under', under), ('canopy', canopy), ('far', far)):
        f.write(name + '\n' + uri(svg) + '\n')

"""Generate the language run's permanent art: six people and six places.

    python tools/gen-lang-art.py        # writes js/lang-art.js

WHY THIS EXISTS
---------------
The run shipped with stand-ins: every NPC was the character U+263B in a box,
and every location was one procedural skyline behind a different gradient, so a
cafeteria and a classroom were the same street in another colour.

The art is FIXED and the text is not. That split is the point: a portrait and a
backdrop are furniture and should be the same every time you meet them --
recognising the vendor IS the point of the vendor -- while the lines, options
and vocabulary stay editable, because those are the learning.

THE PEOPLE
----------
A 24x32 grid, one character per pixel, run-length encoded into <rect>s. The
first pass was 18x24, which is enough for a silhouette and not enough for a
face: at that size a nose is the same pixel as a cheek shadow. The extra eight
rows buy eyebrows, a nose, a jaw, a collar, cuffs, buttons and feet, which is
the difference between a shape wearing a colour and somebody dressed.

They share a skeleton -- same head box, same eye row, same shoulder line -- so
they read as one cast, and differ by hair, build, palette, garment and prop.

THE PLACES
----------
Each is its own builder, not one skyline recoloured. Three things hold the set
together: a shared horizon, a shared lighting model (every scene has exactly
one warm source, cool fill from outside, and a vignette), and foliage drawn
from one library so a plant in the market is the same plant as in the hallway.

Deterministic throughout: same seed, same art, byte for byte.
"""
import random

OUT = 'js/lang-art.js'

# ── Palette ────────────────────────────────────────────────────
PAL = {
    '.': None,
    'k': '#120e18',   # outline
    'K': '#231c2d',   # soft shadow
    # skin, three tones each so a face can have a lit side, a turn and a shadow
    's': '#f0c49c', 'S': '#d39f74', 'q': '#b07b52',
    't': '#c68a5e', 'T': '#a06b45', 'Q': '#7d5233',
    'e': '#2a2036',   # eye
    'w': '#faf6f0',   # white
    'W': '#d8d0c4',   # off-white / shirt shade
    # hair
    'h': '#2b2030', 'H': '#463650', 'j': '#6e5570',
    'b': '#6d4b32', 'B': '#8a6244', 'J': '#a87c56',
    'g': '#9aa7bd', 'G': '#c3cddb',
    # cloth
    'r': '#b8433f', 'R': '#d8635c', 'x': '#8a2f2c',
    'u': '#3a5a8c', 'U': '#4f76ad', 'v': '#28406a',
    'n': '#2f4a3a', 'N': '#436b52', 'm': '#1f3327',
    'y': '#d8a13f', 'Y': '#f0c469', 'z': '#a8761f',
    'p': '#6b4a78', 'P': '#8a5f99', 'o': '#4c3357',
    'a': '#e2dbcf', 'A': '#b9b0a1',   # apron
    'd': '#332c3d', 'D': '#4a4055', 'f': '#221c2a',
    'l': '#3a3340',   # leather / shoe
    'c': '#c9a227',   # brass, buttons, earrings
}


def rle(grid):
    out = []
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            c = row[x]
            if c == '.':
                x += 1
                continue
            n = 1
            while x + n < len(row) and row[x + n] == c:
                n += 1
            out.append("<rect x='%d' y='%d' width='%d' height='1' fill='%s'/>" % (x, y, n, PAL[c]))
            x += n
        # end row
    return ''.join(out)


# ── One person ─────────────────────────────────────────────────
W, H = 24, 32
CX = 12                      # centre column


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, s):
    for i, c in enumerate(s):
        if c != ' ' and 0 <= y < H and 0 <= x + i < W:
            g[y][x + i] = c


def box(g, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= y < H and 0 <= x < W:
                g[y][x] = c


def face(g, skin, mid, dark, hair, hairlit, style, brow=True):
    """Head, rows 4-14. Ten wide, with a jaw that narrows -- a straight-sided
    head is the thing that most makes a pixel person look like a tin."""
    box(g, 7, 4, 16, 13, skin)
    # jaw narrows over the last two rows
    box(g, 8, 13, 15, 13, skin)
    box(g, 9, 14, 14, 14, skin)
    # turn of the cheek on the right, and under the jaw
    for y in range(5, 14):
        g[y][16] = mid
    box(g, 9, 14, 14, 14, mid)
    g[13][8] = mid
    g[13][15] = mid
    # ears
    g[8][6] = mid
    g[9][6] = dark
    g[8][17] = mid
    g[9][17] = dark

    # brows, eyes, nose, mouth -- the eight rows the smaller grid could not hold
    if brow:
        put(g, 8, 7, hair * 3)
        put(g, 13, 7, hair * 3)
    put(g, 8, 9, 'w' + 'e')
    put(g, 14, 9, 'e' + 'w')
    g[10][11] = mid          # nose
    g[11][11] = dark
    g[11][12] = mid
    put(g, 10, 12, dark + dark + dark)   # mouth
    g[12][10] = mid
    g[12][14] = mid

    # neck and its shadow
    box(g, 10, 15, 13, 16, skin)
    box(g, 10, 15, 13, 15, mid)


def hair_style(g, style, hair, hairlit, cloth, clothlit):
    if style == 'short':
        box(g, 7, 2, 16, 4, hair)
        box(g, 6, 4, 6, 8, hair)
        box(g, 17, 4, 17, 8, hair)
        put(g, 9, 2, hairlit * 4)
    elif style == 'bun':
        box(g, 7, 2, 16, 4, hair)
        box(g, 6, 4, 6, 9, hair)
        box(g, 17, 4, 17, 9, hair)
        box(g, 10, 0, 13, 2, hair)        # the bun
        put(g, 11, 0, hairlit * 2)
        g[1][9] = hair
        g[1][14] = hair
    elif style == 'long':
        box(g, 7, 2, 16, 4, hair)
        box(g, 5, 4, 6, 17, hair)         # falls past the shoulder
        box(g, 17, 4, 18, 17, hair)
        put(g, 9, 2, hairlit * 4)
        g[10][5] = hairlit
        g[12][18] = hairlit
    elif style == 'cap':
        box(g, 6, 2, 17, 4, cloth)
        box(g, 5, 3, 5, 4, cloth)
        put(g, 17, 4, clothlit * 4)       # the peak
        box(g, 7, 5, 16, 5, hair)
        put(g, 8, 2, clothlit * 3)
    elif style == 'hood':
        box(g, 5, 1, 18, 5, cloth)
        box(g, 5, 5, 6, 16, cloth)
        box(g, 17, 5, 18, 16, cloth)
        box(g, 8, 5, 15, 5, hair)
        put(g, 7, 1, clothlit * 4)
    elif style == 'tied':
        box(g, 7, 2, 16, 4, hair)
        box(g, 6, 4, 6, 7, hair)
        box(g, 17, 4, 17, 7, hair)
        box(g, 17, 5, 18, 12, hair)       # tail down the back
        g[6][18] = hairlit
        put(g, 9, 2, hairlit * 4)


def garment(g, cloth, lit, shade, kind):
    """Torso rows 17-29, with a collar, sleeves that cuff, and a hem."""
    box(g, 6, 17, 17, 29, cloth)
    box(g, 5, 18, 5, 26, cloth)      # arms
    box(g, 18, 18, 18, 26, cloth)
    # shoulders slope
    g[17][6] = shade
    g[17][17] = shade
    # a lit edge down the left, shadow down the right
    box(g, 6, 18, 6, 29, lit)
    box(g, 17, 18, 17, 29, shade)
    box(g, 5, 18, 5, 26, lit)
    box(g, 18, 18, 18, 26, shade)
    # cuffs
    box(g, 5, 25, 5, 26, shade)
    box(g, 18, 25, 18, 26, shade)
    # hands
    box(g, 5, 27, 5, 28, 's')
    box(g, 18, 27, 18, 28, 's')
    # hem
    box(g, 6, 29, 17, 29, shade)

    if kind == 'collar':
        put(g, 9, 17, 'w' * 6)
        put(g, 10, 18, 'w' * 4)
        g[19][11] = 'w'
        g[19][12] = 'w'
    elif kind == 'vneck':
        g[17][11] = 's'
        g[17][12] = 's'
        g[18][11] = 's'
        g[18][12] = 's'
        put(g, 10, 17, lit)
        put(g, 13, 17, lit)
    elif kind == 'buttons':
        put(g, 9, 17, 'w' * 6)
        for y in (20, 23, 26):
            g[y][11] = 'c'
    elif kind == 'crew':
        put(g, 9, 17, shade * 6)

    # feet, rows 30-31 -- a figure cut off at the hem floats
    box(g, 7, 30, 10, 31, 'l')
    box(g, 13, 30, 16, 31, 'l')


def prop_on(g, prop):
    if prop == 'strap':                       # satchel diagonally across
        for i, y in enumerate(range(17, 27)):
            g[y][8 + i // 2] = 'f'
            g[y][9 + i // 2] = 'd'
        box(g, 16, 24, 19, 28, 'd')           # the bag itself
        box(g, 16, 24, 19, 24, 'D')
    elif prop == 'apron':
        box(g, 8, 21, 15, 29, 'a')
        box(g, 9, 19, 14, 20, 'a')
        box(g, 8, 24, 15, 24, 'A')            # waist tie
        box(g, 8, 21, 8, 29, 'A')
        g[26][10] = 'A'                       # pocket
        g[26][13] = 'A'
        box(g, 10, 26, 13, 28, 'A')
    elif prop == 'basket':
        box(g, 0, 22, 5, 26, 'y')
        box(g, 0, 22, 5, 22, 'Y')
        box(g, 0, 26, 5, 26, 'z')
        for x in range(1, 5, 2):
            box(g, x, 23, x, 25, 'z')
        box(g, 1, 20, 1, 21, 'z')             # handle
        box(g, 4, 20, 4, 21, 'z')
        box(g, 1, 20, 4, 20, 'z')
    elif prop == 'glasses':
        box(g, 7, 9, 10, 9, 'k')
        box(g, 13, 9, 16, 9, 'k')
        g[9][11] = 'k'
        g[9][12] = 'k'
        put(g, 8, 9, 'w')
        put(g, 15, 9, 'w')
    elif prop == 'earrings':
        g[10][6] = 'c'
        g[10][17] = 'c'
        box(g, 9, 18, 14, 18, 'c')            # a chain at the collar
        g[19][11] = 'c'
    elif prop == 'scarf':
        box(g, 8, 16, 15, 18, 'r')
        box(g, 8, 16, 15, 16, 'R')
        box(g, 15, 18, 16, 24, 'r')           # the trailing end
        g[24][16] = 'x'


CAST = {
    # key          skin  mid   dark  hair  hairlit cloth lit  shade style     garment    prop
    'stranger':  ('t', 'T', 'Q', 'h', 'H', 'd', 'D', 'f', 'hood',  'crew',    'scarf'),
    'classmate': ('s', 'S', 'q', 'h', 'H', 'u', 'U', 'v', 'short', 'collar',  'strap'),
    'vendor':    ('t', 'T', 'Q', 'b', 'B', 'r', 'R', 'x', 'cap',   'crew',    'apron'),
    'neighbour': ('s', 'S', 'q', 'g', 'G', 'n', 'N', 'm', 'short', 'buttons', 'glasses'),
    'tita':      ('t', 'T', 'Q', 'h', 'j', 'p', 'P', 'o', 'bun',   'vneck',   'earrings'),
    'kuya':      ('s', 'S', 'q', 'h', 'H', 'y', 'Y', 'z', 'tied',  'crew',    'basket'),
}


def portrait(key):
    skin, mid, dark, hair, hairlit, cloth, lit, shade, style, gk, prop = CAST[key]
    g = blank()
    garment(g, cloth, lit, shade, gk)
    face(g, skin, mid, dark, hair, hairlit, style)
    hair_style(g, style, hair, hairlit, cloth, lit)
    prop_on(g, prop)
    return ("<svg class='lq-person' viewBox='0 0 %d %d' shape-rendering='crispEdges' "
            "preserveAspectRatio='xMidYMax meet' aria-hidden='true'>%s</svg>" % (W, H, rle(g)))


# ── The places ─────────────────────────────────────────────────
SW, SH, HZ = 1000, 400, 250


def defs(key, a, b, c):
    return ("<defs><linearGradient id='lqs-%s' x1='0' y1='0' x2='0' y2='1'>"
            "<stop offset='0%%' stop-color='%s'/><stop offset='60%%' stop-color='%s'/>"
            "<stop offset='100%%' stop-color='%s'/></linearGradient>"
            "<linearGradient id='lqg-%s' x1='0' y1='0' x2='0' y2='1'>"
            "<stop offset='0%%' stop-color='%s'/><stop offset='100%%' stop-color='#07050c'/>"
            "</linearGradient>"
            "<radialGradient id='lqv-%s' cx='50%%' cy='46%%' r='74%%'>"
            "<stop offset='55%%' stop-color='#000' stop-opacity='0'/>"
            "<stop offset='100%%' stop-color='#000' stop-opacity='0.55'/></radialGradient>"
            "</defs>"
            "<rect width='%d' height='%d' fill='url(#lqs-%s)'/>"
            "<rect y='%d' width='%d' height='%d' fill='url(#lqg-%s)'/>"
            % (key, a, b, c, key, c, key, SW, HZ, key, HZ, SW, SH - HZ, key))


def vignette(key):
    """Every scene gets one. Corners falling off is most of what stops a flat
    fill of colour reading as a flat fill of colour."""
    return "<rect width='%d' height='%d' fill='url(#lqv-%s)'/>" % (SW, SH, key)


def glow(x, y, r, col='#ffd98a', a=0.14):
    return "<circle cx='%d' cy='%d' r='%d' fill='%s' opacity='%.2f'/>" % (x, y, r, col, a)


def lamp(x, y, r=9, col='#ffd98a'):
    return ("<circle cx='%d' cy='%d' r='%d' fill='%s' opacity='0.95'/>%s%s"
            % (x, y, r, col, glow(x, y, r * 3, col, 0.16), glow(x, y, r * 6, col, 0.07)))


def pool(x, y, rx, ry, col='#ffd98a', a=0.16):
    """Light on the floor under something. A lamp with no pool under it reads as
    a sticker."""
    return ("<ellipse cx='%d' cy='%d' rx='%d' ry='%d' fill='%s' opacity='%.2f'/>"
            % (x, y, rx, ry, col, a))


def shaft(x, y, w1, w2, h, col='#ffd98a', a=0.07):
    return ("<path d='M%d %d L%d %d L%d %d L%d %d Z' fill='%s' opacity='%.2f'/>"
            % (x - w1 // 2, y, x + w1 // 2, y, x + w2 // 2, y + h, x - w2 // 2, y + h, col, a))


# ── Foliage, one library for every scene ───────────────────────
def leaf(x, y, w, h, col, rot=0):
    return ("<ellipse cx='%d' cy='%d' rx='%d' ry='%d' fill='%s' transform='rotate(%d %d %d)'/>"
            % (x, y, w, h, col, rot, x, y))


def potted(x, y, s=1.0, dark='#1d3326', lit='#2f5138', pot='#6b4433'):
    """A plant in a pot, standing on y."""
    g = []
    pw, ph = int(26 * s), int(22 * s)
    g.append("<path d='M%d %d L%d %d L%d %d L%d %d Z' fill='%s'/>"
             % (x - pw // 2, y - ph, x + pw // 2, y - ph,
                x + pw // 3, y, x - pw // 3, y, pot))
    g.append("<rect x='%d' y='%d' width='%d' height='%d' fill='#000' opacity='0.18'/>"
             % (x - pw // 2, y - ph, pw, int(4 * s)))
    for i, (dx, dy, lw, lh, rot, c) in enumerate([
            (0, -42, 7, 20, 0, lit), (-11, -36, 6, 17, -38, dark), (11, -36, 6, 17, 38, dark),
            (-17, -28, 5, 13, -62, dark), (17, -28, 5, 13, 62, lit), (-6, -48, 5, 14, -18, lit),
            (7, -47, 5, 13, 20, dark)]):
        g.append(leaf(x + int(dx * s), y - ph + int(dy * s) + int(12 * s),
                      max(2, int(lw * s)), max(4, int(lh * s)), c, rot))
    return ''.join(g)


def vine(x, y, length, col='#24402c', lit='#365f3e'):
    """Hanging from y downward. Reads best in a doorway or over a window."""
    g = ["<rect x='%d' y='%d' width='2' height='%d' fill='%s'/>" % (x, y, length, col)]
    step = 16
    for i in range(length // step):
        yy = y + 10 + i * step
        side = -1 if i % 2 == 0 else 1
        g.append(leaf(x + side * 8, yy, 8, 5, lit if i % 3 else col, side * 24))
        g.append(leaf(x + side * 15, yy + 6, 6, 4, col, side * 34))
    return ''.join(g)


def tuft(x, y, w=30, h=16, col='#1b2f20'):
    """Grass at a base line."""
    g = []
    n = max(4, w // 5)
    for i in range(n):
        bx = x - w // 2 + i * (w // n)
        hh = max(4, h - abs(i - n / 2) * 2)
        g.append("<path d='M%d %d Q%d %d %d %d' stroke='%s' stroke-width='2' fill='none'/>"
                 % (bx, y, bx + (3 if i % 2 else -3), y - hh // 2,
                    bx + (7 if i % 2 else -7), y - hh, col))
    return ''.join(g)


def tree(x, y, s=1.0, trunk='#241a16', canopy='#152a1c', lit='#1e3b26'):
    g = ["<rect x='%d' y='%d' width='%d' height='%d' fill='%s'/>"
         % (x - int(4 * s), y - int(86 * s), int(8 * s), int(86 * s), trunk)]
    for dx, dy, r, c in [(-24, -96, 30, canopy), (22, -92, 28, canopy), (0, -116, 34, lit),
                         (-10, -78, 24, canopy), (14, -74, 22, lit)]:
        g.append("<circle cx='%d' cy='%d' r='%d' fill='%s'/>"
                 % (x + int(dx * s), y + int(dy * s), int(r * s), c))
    return ''.join(g)


def banana(x, y, s=1.0, col='#1f3a24', lit='#2d5432'):
    """Broad leaves -- reads as a market or a back yard rather than a park."""
    g = ["<rect x='%d' y='%d' width='%d' height='%d' fill='#2a2018'/>"
         % (x - int(3 * s), y - int(54 * s), int(6 * s), int(54 * s))]
    for dx, dy, w, h, rot, c in [(-26, -62, 26, 9, -18, col), (26, -60, 26, 9, 18, lit),
                                 (-20, -78, 22, 8, -44, lit), (20, -76, 22, 8, 44, col),
                                 (0, -88, 10, 20, 0, lit)]:
        g.append(leaf(x + int(dx * s), y + int(dy * s), int(w * s), int(h * s), c, rot))
    return ''.join(g)


# ── Scenes ─────────────────────────────────────────────────────
def scene_street(rnd):
    s = [defs('street', '#5a7099', '#33456b', '#1a2338')]
    for _ in range(52):
        s.append("<circle cx='%.0f' cy='%.0f' r='%.1f' fill='#fff' opacity='%.2f'/>"
                 % (rnd.uniform(0, SW), rnd.uniform(0, HZ - 80),
                    1.1 if rnd.random() < 0.82 else 1.9, 0.25 + rnd.random() * 0.55))
    s.append("<circle cx='858' cy='74' r='26' fill='#f6edc8' opacity='0.95'/>"
             "<circle cx='846' cy='66' r='24' fill='#33456b'/>" + glow(858, 74, 90, '#dfe6ff', 0.10))
    x, far = -20, []
    while x < SW + 20:
        w, h = 34 + rnd.random() * 62, 40 + rnd.random() * 78
        far.append("<rect x='%.0f' y='%.0f' width='%.0f' height='%.0f'/>" % (x, HZ - h, w, h + 30))
        x += w + rnd.random() * 14
    s.append("<g fill='#26314d' opacity='0.85'>%s</g>" % ''.join(far))
    x, near, win = -30, [], []
    while x < SW + 30:
        w, h = 46 + rnd.random() * 74, 70 + rnd.random() * 132
        top = HZ - h
        near.append("<rect x='%.0f' y='%.0f' width='%.0f' height='%.0f'/>" % (x, top, w, h + 30))
        wy = top + 12
        while wy < HZ - 10:
            wx = x + 8
            while wx < x + w - 10:
                if rnd.random() < 0.34:
                    win.append("<rect x='%.0f' y='%.0f' width='6' height='8' fill='#ffd98a' opacity='%.2f'/>"
                               % (wx, wy, 0.35 + rnd.random() * 0.5))
                wx += 15
            wy += 17
        x += w + 4 + rnd.random() * 20
    s.append("<g fill='#161d33'>%s</g>%s" % (''.join(near), ''.join(win)))
    # Street trees between the lamps, and grass at the kerb.
    for tx in (150, 470, 790):
        s.append(tree(tx, HZ + 18, 0.8))
    for i in range(4):
        lx = int(80 + i * 260 + rnd.random() * 50)
        s.append("<rect x='%d' y='%d' width='5' height='118' fill='#0b0812' opacity='0.85'/>"
                 % (lx, HZ - 78))
        s.append(pool(lx + 2, HZ + 52, 96, 26))
        s.append(lamp(lx + 2, HZ - 82))
    for i in range(7):
        s.append(tuft(60 + i * 150, HZ + 34, 34, 14))
    s.append(vignette('street'))
    return ''.join(s)


def scene_cafeteria(rnd):
    s = [defs('cafeteria', '#6d5a86', '#443660', '#241c38')]
    s.append("<rect y='40' width='%d' height='%d' fill='#3b3054'/>" % (SW, HZ - 40))
    for i in range(6):
        x = 40 + i * 160
        s.append("<rect x='%d' y='70' width='110' height='96' fill='#1c2540'/>"
                 "<rect x='%d' y='70' width='110' height='96' fill='none' stroke='#544470' stroke-width='4'/>"
                 "<rect x='%d' y='118' width='110' height='4' fill='#544470'/>" % (x, x, x))
        for _ in range(5):
            s.append("<circle cx='%.0f' cy='%.0f' r='1.3' fill='#fff' opacity='0.5'/>"
                     % (x + 8 + rnd.random() * 94, 78 + rnd.random() * 34))
        s.append(shaft(x + 55, 166, 96, 150, 92, '#a9c4ff', 0.05))
    # Pendant lights, each with its pool on the counter below.
    for i in range(5):
        x = 110 + i * 195
        s.append("<rect x='%d' y='0' width='3' height='54' fill='#1a1428'/>"
                 "<path d='M%d 54 L%d 54 L%d 78 L%d 78 Z' fill='#2a2038'/>"
                 % (x, x - 20, x + 23, x + 15, x - 12))
        s.append(shaft(x + 1, 80, 26, 120, 118))
        s.append(lamp(x + 1, 80, 11))
        s.append(pool(x + 1, 200, 78, 14, '#ffd98a', 0.13))
    s.append("<rect y='196' width='%d' height='20' fill='#5a4a72'/>"
             "<rect y='216' width='%d' height='%d' fill='#2c2340'/>" % (SW, SW, HZ - 216))
    for i in range(14):
        s.append("<rect x='%d' y='202' width='30' height='8' fill='#8f7aa8' opacity='0.5'/>" % (30 + i * 70))
    # Planters along the counter and a trailing vine at each end.
    for px in (60, 500, 940):
        s.append(potted(px, 196, 0.85, '#24402c', '#38643f', '#7a5040'))
    s.append(vine(24, 40, 120))
    s.append(vine(976, 40, 140))
    for i in range(3):
        tx = 90 + i * 330
        s.append(pool(tx + 100, HZ + 44, 132, 20, '#ffd98a', 0.07))
        s.append("<rect x='%d' y='%d' width='200' height='11' fill='#0b0812' opacity='0.86'/>"
                 "<rect x='%d' y='%d' width='8' height='46' fill='#0b0812' opacity='0.86'/>"
                 "<rect x='%d' y='%d' width='8' height='46' fill='#0b0812' opacity='0.86'/>"
                 % (tx, HZ + 34, tx + 16, HZ + 45, tx + 176, HZ + 45))
    s.append(vignette('cafeteria'))
    return ''.join(s)


def scene_classroom(rnd):
    s = [defs('classroom', '#4d6a9b', '#2f4470', '#1a2440')]
    s.append("<rect y='30' width='%d' height='%d' fill='#2c3a5e'/>" % (SW, HZ - 30))
    s.append("<rect x='150' y='62' width='560' height='150' fill='#1e3630'/>"
             "<rect x='150' y='62' width='560' height='150' fill='none' stroke='#6b5638' stroke-width='9'/>"
             "<rect x='150' y='206' width='560' height='10' fill='#6b5638'/>")
    for i, w in enumerate([180, 250, 140, 300]):
        s.append("<rect x='%d' y='%d' width='%d' height='4' fill='#cfe3d8' opacity='0.28'/>"
                 % (185 + (i % 2) * 40, 92 + i * 26, w))
    # A map and a chart, because a blackboard alone is a bare wall.
    s.append("<rect x='740' y='58' width='96' height='70' fill='#3f5a52'/>"
             "<rect x='740' y='58' width='96' height='70' fill='none' stroke='#8a7250' stroke-width='4'/>"
             "<path d='M752 96 L768 80 L786 98 L806 76 L826 92' stroke='#9fc4a6' stroke-width='3' fill='none'/>")
    for i in range(2):
        x = 852 + i * 78
        s.append("<rect x='%d' y='72' width='62' height='120' fill='#16213c'/>"
                 "<rect x='%d' y='72' width='62' height='120' fill='none' stroke='#46578a' stroke-width='4'/>" % (x, x))
        for _ in range(4):
            s.append("<circle cx='%.0f' cy='%.0f' r='1.3' fill='#fff' opacity='0.5'/>"
                     % (x + 8 + rnd.random() * 46, 80 + rnd.random() * 50))
        s.append(shaft(x + 31, 192, 56, 130, 110, '#a9c4ff', 0.06))
    s.append("<circle cx='92' cy='104' r='27' fill='#e6e2d6'/><circle cx='92' cy='104' r='27' fill='none' "
             "stroke='#2c2340' stroke-width='4'/><rect x='90' y='88' width='4' height='18' fill='#2c2340'/>"
             "<rect x='92' y='102' width='14' height='4' fill='#2c2340'/>")
    for i in range(4):
        x = 130 + i * 210
        s.append("<rect x='%d' y='30' width='44' height='4' fill='#ffd98a' opacity='0.5'/>" % x)
        s.append(shaft(x + 22, 34, 44, 190, 120, '#ffd98a', 0.045))
    # Plants on the sill and by the door.
    s.append(potted(66, 250, 0.9))
    s.append(potted(948, 250, 0.7))
    s.append(vine(724, 52, 96))
    for row, (sc, yy, op) in enumerate([(0.72, HZ + 6, 0.55), (0.86, HZ + 34, 0.72), (1.0, HZ + 74, 0.9)]):
        for i in range(5):
            dx = 40 + i * 200 - row * 30
            w = int(150 * sc)
            s.append("<rect x='%d' y='%d' width='%d' height='%d' fill='#0b0812' opacity='%.2f'/>"
                     "<rect x='%d' y='%d' width='7' height='%d' fill='#0b0812' opacity='%.2f'/>"
                     "<rect x='%d' y='%d' width='7' height='%d' fill='#0b0812' opacity='%.2f'/>"
                     % (dx, yy, w, int(10 * sc), op,
                        dx + 10, yy + int(10 * sc), int(34 * sc), op,
                        dx + w - 17, yy + int(10 * sc), int(34 * sc), op))
    s.append(vignette('classroom'))
    return ''.join(s)


def scene_hallway(rnd):
    s = [defs('hallway', '#5f7b9c', '#3a5171', '#1e2c40')]
    s.append("<rect width='%d' height='%d' fill='#2b3a52'/>" % (SW, HZ))
    s.append("<path d='M0 0 L%d 0 L%d %d L0 %d Z' fill='#243247'/>" % (SW, SW, 40, 40))
    s.append("<path d='M0 0 L380 118 L620 118 L%d 0 Z' fill='#1d2942'/>" % SW)
    s.append("<path d='M0 %d L380 %d L620 %d L%d %d Z' fill='#141d2e'/>" % (SH, 160, 160, SW, SH))
    # The door at the end, and the light it throws down the corridor.
    s.append("<rect x='432' y='118' width='136' height='120' fill='#2a3a55'/>"
             "<rect x='452' y='138' width='96' height='100' fill='#ffd98a' opacity='0.24'/>")
    s.append(shaft(500, 160, 96, 620, 240, '#ffd98a', 0.05))
    s.append(pool(500, 300, 300, 54, '#ffd98a', 0.07))
    for side in (0, 1):
        for i in range(7):
            t = i / 7.0
            w = int(96 - 74 * t)
            hh = int(150 - 96 * t)
            x = int(t * 400) if side == 0 else int(SW - t * 400 - w)
            y = int(96 + t * 40)
            s.append("<rect x='%d' y='%d' width='%d' height='%d' fill='#1a2337' opacity='0.9'/>"
                     "<rect x='%d' y='%d' width='%d' height='%d' fill='none' stroke='#3d5273' stroke-width='2'/>"
                     "<rect x='%d' y='%d' width='%d' height='3' fill='#ffd98a' opacity='0.3'/>"
                     % (x, y, w, hh, x, y, w, hh, x + w - int(18 - 12 * t), y + hh // 2, max(3, int(9 - 6 * t))))
    for i in range(4):
        t = i / 4.0
        w = int(150 - 96 * t)
        cx = SW // 2
        s.append("<rect x='%d' y='%d' width='%d' height='%d' fill='#ffd98a' opacity='%.2f'/>"
                 % (cx - w // 2, int(14 + t * 74), w, max(3, int(9 - 5 * t)), 0.5 - t * 0.22))
        s.append(glow(cx, int(18 + t * 74), int(60 - 30 * t), '#ffd98a', 0.07))
    # Planters either side of the near end, where a corridor always has them.
    s.append(potted(96, HZ + 96, 1.15))
    s.append(potted(904, HZ + 96, 1.15))
    s.append(vine(150, 40, 110))
    s.append(vine(850, 40, 96))
    s.append(vignette('hallway'))
    return ''.join(s)


def scene_home(rnd):
    s = [defs('home', '#8a6a4c', '#5b4230', '#2e2118')]
    s.append("<rect y='20' width='%d' height='%d' fill='#40312a'/>" % (SW, HZ - 20))
    s.append("<rect x='92' y='60' width='190' height='140' fill='#16203a'/>"
             "<rect x='92' y='60' width='190' height='140' fill='none' stroke='#6b533c' stroke-width='7'/>"
             "<rect x='182' y='60' width='6' height='140' fill='#6b533c'/>"
             "<rect x='92' y='126' width='190' height='6' fill='#6b533c'/>")
    for _ in range(8):
        s.append("<circle cx='%.0f' cy='%.0f' r='1.4' fill='#fff' opacity='0.55'/>"
                 % (100 + rnd.random() * 172, 68 + rnd.random() * 50))
    s.append(shaft(187, 200, 190, 300, 140, '#8ea8d8', 0.05))
    s.append("<rect x='68' y='52' width='28' height='156' fill='#7a4a44'/>"
             "<rect x='278' y='52' width='28' height='156' fill='#7a4a44'/>")
    for x, y, w, h in [(400, 78, 70, 54), (496, 66, 54, 70), (576, 84, 62, 48)]:
        s.append("<rect x='%d' y='%d' width='%d' height='%d' fill='#2a2038'/>"
                 "<rect x='%d' y='%d' width='%d' height='%d' fill='none' stroke='#8a6b4a' stroke-width='5'/>"
                 % (x, y, w, h, x, y, w, h))
    # The room's one light, with the pool it actually casts.
    s.append("<rect x='790' y='120' width='6' height='130' fill='#2a2038'/>"
             "<path d='M760 120 L826 120 L814 76 L772 76 Z' fill='#d8a13f' opacity='0.9'/>")
    s.append(shaft(793, 120, 60, 260, 170))
    s.append(pool(793, 268, 150, 30, '#ffd98a', 0.16))
    s.append(lamp(793, 112, 16))
    # Houseplants: a big one by the lamp, a small one on the sill, a hanging one.
    s.append(banana(690, 250, 1.0))
    s.append(potted(310, 200, 0.6, '#2a4a30', '#3d6a45', '#7a5040'))
    s.append(vine(430, 30, 86))
    s.append("<rect x='300' y='%d' width='420' height='58' fill='#3d2d3f'/>"
             "<rect x='300' y='%d' width='420' height='18' fill='#4d3a50'/>"
             "<rect x='286' y='%d' width='30' height='72' fill='#4d3a50'/>"
             "<rect x='704' y='%d' width='30' height='72' fill='#4d3a50'/>"
             % (HZ + 42, HZ + 42, HZ + 30, HZ + 30))
    for i in range(3):
        s.append("<rect x='%d' y='%d' width='62' height='34' fill='#6b4f68' opacity='0.8'/>"
                 % (330 + i * 130, HZ + 22))
    s.append(vignette('home'))
    return ''.join(s)


def scene_market(rnd):
    s = [defs('market', '#6f8a56', '#455a36', '#232f1d')]
    for _ in range(30):
        s.append("<circle cx='%.0f' cy='%.0f' r='1.2' fill='#fff' opacity='%.2f'/>"
                 % (rnd.uniform(0, SW), rnd.uniform(0, 110), 0.3 + rnd.random() * 0.4))
    # Banana leaves behind the stalls, so the row has something growing behind it.
    for bx in (30, 330, 660, 970):
        s.append(banana(bx, HZ - 6, 1.25))
    pts = ' '.join('%d,%d' % (i * 100, 36 + (24 if i % 2 else 8)) for i in range(11))
    s.append("<polyline points='%s' fill='none' stroke='#2a2038' stroke-width='3'/>" % pts)
    for i in range(11):
        s.append(lamp(i * 100, 36 + (24 if i % 2 else 8) + 8, 6))
    for i in range(3):
        x = 60 + i * 330
        s.append("<rect x='%d' y='150' width='250' height='100' fill='#2f2a24'/>" % x)
        for k in range(10):
            s.append("<rect x='%d' y='118' width='25' height='34' fill='%s'/>"
                     % (x + k * 25, '#b8433f' if k % 2 == 0 else '#e6ded0'))
        s.append("<rect x='%d' y='112' width='250' height='8' fill='#4a3f33'/>"
                 "<rect x='%d' y='120' width='7' height='130' fill='#4a3f33'/>"
                 "<rect x='%d' y='120' width='7' height='130' fill='#4a3f33'/>"
                 % (x, x + 4, x + 239))
        # A bulb under each awning, lighting its own counter.
        s.append(lamp(x + 125, 138, 7))
        s.append(pool(x + 125, 198, 116, 16, '#ffd98a', 0.16))
        s.append("<rect x='%d' y='196' width='250' height='14' fill='#5a4a38'/>" % x)
        for k in range(6):
            cx = x + 26 + k * 38
            col = ['#d8a13f', '#b8433f', '#7a9a4a', '#d87a3f'][k % 4]
            s.append("<circle cx='%d' cy='188' r='9' fill='%s' opacity='0.92'/>" % (cx, col))
            s.append("<circle cx='%d' cy='185' r='3' fill='#fff' opacity='0.22'/>" % (cx - 3))
        # Greens in a crate at the stall's end.
        s.append(potted(x + 232, 196, 0.6, '#2a4a30', '#3f6d46', '#5a4a38'))
    for i in range(4):
        x = 40 + i * 270
        s.append("<rect x='%d' y='%d' width='96' height='58' fill='#0b0812' opacity='0.85'/>"
                 "<rect x='%d' y='%d' width='96' height='6' fill='#2a2038' opacity='0.9'/>"
                 % (x, HZ + 48, x, HZ + 48))
        s.append(tuft(x + 110, HZ + 106, 40, 18))
    s.append(vignette('market'))
    return ''.join(s)


SCENES = {
    'street': scene_street,
    'cafeteria': scene_cafeteria,
    'classroom': scene_classroom,
    'hallway': scene_hallway,
    'home': scene_home,
    'market': scene_market,
}


def build():
    people = {k: portrait(k) for k in CAST}
    places = {}
    for k, fn in SCENES.items():
        places[k] = ("<svg class='lq-art' viewBox='0 0 %d %d' preserveAspectRatio='xMidYMid slice' "
                     "aria-hidden='true'>%s</svg>"
                     % (SW, SH, fn(random.Random(sum(ord(c) for c in k) * 7919))))

    def dump(name, d, note):
        rows = ',\n'.join("  %s: '%s'" % (k, v.replace("'", "\\'")) for k, v in sorted(d.items()))
        return "/* %s */\nconst %s = {\n%s\n};\n" % (note, name, rows)

    head = (
        "/* ============================================================\n"
        "   LANG-ART.JS — the run's permanent art\n"
        "   ------------------------------------------------------------\n"
        "   GENERATED by tools/gen-lang-art.py. Do not hand-edit: these are long\n"
        "   single-line SVG strings and a stray quote in one of them breaks the file,\n"
        "   which in this app means every script after it stops existing.\n"
        "\n"
        "   THE ART IS FIXED AND THE TEXT IS NOT. A portrait and a backdrop are\n"
        "   furniture: recognising the vendor on sight IS the point of the vendor, so\n"
        "   they must be the same every time. The lines, the options and the\n"
        "   vocabulary stay editable, because those are the learning.\n"
        "   ============================================================ */\n\n")

    body = head
    body += dump('LANG_PORTRAITS', people,
                 'Six people on a 24x32 grid. The grid was 18x24 and that is enough for a\n'
                 '   silhouette but not a face -- at that size a nose is the same pixel as a\n'
                 '   cheek shadow. The extra rows buy eyebrows, a nose, a jaw, a collar, cuffs,\n'
                 '   buttons and feet: the difference between a shape wearing a colour and\n'
                 '   somebody dressed. They share a head box, an eye row and a shoulder line so\n'
                 '   they read as one cast.')
    body += "\n"
    body += dump('LANG_SCENE_ART', places,
                 'Six places, each its own builder rather than one skyline recoloured. Three\n'
                 '   things hold the set together: a shared horizon, one lighting model per\n'
                 '   scene (a single warm source that casts a visible shaft and a pool, cool\n'
                 '   fill from outside, and a vignette), and foliage drawn from one library so\n'
                 '   the plant in the hallway is the plant in the market.')
    return body


if __name__ == '__main__':
    out = build()
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)
    print('wrote %s  (%d bytes)' % (OUT, len(out)))
    for k in sorted(CAST):
        print('  person %-10s %5d chars' % (k, len(portrait(k))))

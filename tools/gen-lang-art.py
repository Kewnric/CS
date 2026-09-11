"""Generate the language run's permanent art: six people and six places.

    python tools/gen-lang-art.py        # writes js/lang-art.js

WHY THIS EXISTS
---------------
The run shipped with stand-ins and said so: every NPC was the character U+263B
in a rounded box, and every location was the same procedural skyline behind a
different gradient, so a cafeteria and a classroom were the same street in
another colour.

The art is now FIXED and the text is not. That split is the point: a portrait
and a backdrop are the furniture of the mode and should be the same every time
you meet them -- recognising the vendor IS the point of the vendor -- while the
lines, the options and the vocabulary stay editable, because those are the
learning and the learning is yours.

HOW THE PEOPLE ARE BUILT
------------------------
On an 18x24 grid, one character per pixel, run-length encoded into <rect>s.
They share a skeleton -- same head size, same shoulder line, same eye row -- so
they read as one cast rather than six unrelated drawings, and differ by hair,
build, palette and one prop each. A pixel person is mostly silhouette at this
size, so the prop is doing as much work as the face.

HOW THE PLACES ARE BUILT
------------------------
Each is its own builder rather than one skyline recoloured. They share a
horizon and a palette discipline (far things pale and low contrast, near things
dark, one warm light source) so the set hangs together, and nothing else.

Deterministic throughout: same seed, same art, byte for byte.
"""
import random

OUT = 'js/lang-art.js'

# ── Palette ────────────────────────────────────────────────────
# One letter per colour. '.' is transparent.
PAL = {
    '.': None,
    'k': '#141019',   # outline
    'K': '#241d2e',   # soft outline / shadow
    's': '#e8b48c',   # skin
    'S': '#c98f68',   # skin shadow
    't': '#c68a5e',   # skin, darker tone
    'T': '#a06b45',
    'e': '#2a2036',   # eye
    'w': '#f4eee8',   # white / highlight
    'h': '#2e2333',   # hair dark
    'H': '#46374f',   # hair light
    'b': '#6d4b32',   # hair brown
    'B': '#8a6244',
    'g': '#9aa7bd',   # grey hair
    'r': '#b8433f',   # red cloth
    'R': '#d8635c',
    'u': '#3a5a8c',   # blue cloth
    'U': '#4f76ad',
    'n': '#2f4a3a',   # green cloth
    'N': '#436b52',
    'y': '#d8a13f',   # yellow / straw
    'Y': '#f0c469',
    'p': '#6b4a78',   # purple cloth
    'P': '#8a5f99',
    'a': '#d9d2c6',   # apron / pale cloth
    'A': '#b3aa9c',
    'd': '#3a3142',   # dark cloth
    'D': '#4e4357',
}


def rle(grid):
    """Horizontal run-length encoding into rects -- far fewer nodes than one
    per pixel, and identical output."""
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
    return ''.join(out)


# ── One person ─────────────────────────────────────────────────
W, H = 18, 24


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, s):
    for i, c in enumerate(s):
        if c != ' ' and 0 <= y < H and 0 <= x + i < W:
            g[y][x + i] = c


def person(skin, shade, hair, hairlit, cloth, clothlit, style, prop):
    """The shared skeleton. Everyone has the same head box and shoulder line so
    the cast reads as one set; hair, build and prop carry the difference."""
    g = blank()

    # Head: rows 3-10, eight wide, centred.
    for y in range(3, 11):
        put(g, 5, y, skin * 8)
    # Cheek shadow down the right, so a flat fill reads as a head.
    for y in range(4, 10):
        g[y][12] = shade
    # Ears
    g[6][4] = shade
    g[6][13] = shade

    # Eyes on row 7 for everybody -- a shared eye line is most of what makes a
    # set of pixel faces look related.
    g[7][7] = 'e'
    g[7][10] = 'e'
    # Mouth
    g[9][8] = shade
    g[9][9] = shade

    # Hair, by style.
    if style == 'short':
        for y in range(2, 5):
            put(g, 5, y, hair * 8)
        g[5][5] = hair
        g[5][12] = hair
    elif style == 'bun':
        for y in range(2, 5):
            put(g, 5, y, hair * 8)
        put(g, 7, 0, hair * 4)          # the bun, sitting proud of the head
        put(g, 8, 1, hairlit * 2)
        g[5][5] = hair
        g[5][12] = hair
    elif style == 'long':
        for y in range(2, 5):
            put(g, 5, y, hair * 8)
        for y in range(5, 12):           # falls past the jaw on both sides
            g[y][4] = hair
            g[y][5] = hair
            g[y][12] = hair
            g[y][13] = hair
        put(g, 6, 2, hairlit * 3)
    elif style == 'cap':
        for y in range(2, 4):
            put(g, 5, y, cloth * 8)
        put(g, 4, 3, cloth)
        put(g, 5, 4, hair + hair + '....' + hair + hair)
        put(g, 12, 3, clothlit * 2)      # the peak
    elif style == 'hood':
        for y in range(1, 5):
            put(g, 4, y, cloth * 10)
        for y in range(5, 12):           # the hood frames the face
            g[y][4] = cloth
            g[y][13] = cloth
        put(g, 6, 4, hair * 6)
    elif style == 'tied':
        for y in range(2, 5):
            put(g, 5, y, hair * 8)
        for y in range(4, 9):            # tail down the back
            g[y][13] = hair
        g[3][14] = hairlit
        g[5][5] = hair
        g[5][12] = hair

    # Neck
    put(g, 8, 11, shade * 2)

    # Shoulders and torso, rows 12-23.
    put(g, 4, 12, cloth * 10)
    for y in range(13, 24):
        put(g, 4, y, cloth * 10)
    # Arms
    for y in range(13, 21):
        g[y][3] = cloth
        g[y][14] = cloth
    # Hands
    put(g, 3, 21, skin)
    put(g, 14, 21, skin)
    # A lit edge down one side, so the torso is not a flat slab.
    for y in range(12, 24):
        g[y][12] = clothlit

    # Props: the thing you actually recognise them by at this size.
    if prop == 'strap':                  # satchel across the chest
        for i, y in enumerate(range(12, 20)):
            g[y][6 + i // 2] = 'd'
    elif prop == 'apron':
        for y in range(15, 24):
            put(g, 6, y, 'a' * 6)
        put(g, 7, 14, 'a' * 4)
        put(g, 6, 19, 'A' * 6)           # the tie
    elif prop == 'basket':
        put(g, 1, 18, 'y' * 5)
        put(g, 1, 19, 'Y' * 5)
        put(g, 1, 20, 'y' * 5)
        g[17][2] = 'y'
        g[17][4] = 'y'
    elif prop == 'glasses':
        put(g, 6, 7, 'w')
        put(g, 11, 7, 'w')
        g[7][7] = 'e'
        g[7][10] = 'e'
        put(g, 9, 7, 'k')
    elif prop == 'earrings':
        g[7][4] = 'y'
        g[7][13] = 'y'
        put(g, 6, 13, 'y' * 6)           # a chain at the collar
    elif prop == 'collar':
        put(g, 6, 13, 'w' * 6)
        put(g, 8, 14, 'w' * 2)

    return g


CAST = {
    # key          skin shade hair hairlit cloth clothlit style      prop
    'stranger':  ('t', 'T',  'h', 'H',    'd',  'D',     'hood',    None),
    'classmate': ('s', 'S',  'h', 'H',    'u',  'U',     'short',   'strap'),
    'vendor':    ('t', 'T',  'b', 'B',    'r',  'R',     'cap',     'apron'),
    'neighbour': ('s', 'S',  'g', 'w',    'n',  'N',     'short',   'glasses'),
    'tita':      ('t', 'T',  'h', 'H',    'p',  'P',     'bun',     'earrings'),
    'kuya':      ('s', 'S',  'h', 'H',    'y',  'Y',     'tied',    'collar'),
}


def portrait(key):
    skin, shade, hair, hairlit, cloth, clothlit, style, prop = CAST[key]
    g = person(skin, shade, hair, hairlit, cloth, clothlit, style, prop)
    return ("<svg class='lq-person' viewBox='0 0 %d %d' shape-rendering='crispEdges' "
            "preserveAspectRatio='xMidYMax meet' aria-hidden='true'>%s</svg>" % (W, H, rle(g)))


# ── The places ─────────────────────────────────────────────────
SW, SH, HZ = 1000, 400, 250


def sky(key, a, b, c):
    return ("<defs><linearGradient id='lqs-%s' x1='0' y1='0' x2='0' y2='1'>"
            "<stop offset='0%%' stop-color='%s'/><stop offset='60%%' stop-color='%s'/>"
            "<stop offset='100%%' stop-color='%s'/></linearGradient>"
            "<linearGradient id='lqg-%s' x1='0' y1='0' x2='0' y2='1'>"
            "<stop offset='0%%' stop-color='%s'/><stop offset='100%%' stop-color='#07050c'/>"
            "</linearGradient></defs>"
            "<rect width='%d' height='%d' fill='url(#lqs-%s)'/>"
            "<rect y='%d' width='%d' height='%d' fill='url(#lqg-%s)'/>"
            % (key, a, b, c, key, c, SW, HZ, key, HZ, SW, SH - HZ, key))


def lamp(x, y, r=9):
    return ("<circle cx='%d' cy='%d' r='%d' fill='#ffd98a' opacity='0.92'/>"
            "<circle cx='%d' cy='%d' r='%d' fill='#ffd98a' opacity='0.13'/>" % (x, y, r, x, y, r * 3))


def scene_street(rnd):
    s = [sky('street', '#5a7099', '#33456b', '#1a2338')]
    for _ in range(46):
        x, y = rnd.uniform(0, SW), rnd.uniform(0, HZ - 70)
        s.append("<circle cx='%.0f' cy='%.0f' r='%.1f' fill='#fff' opacity='%.2f'/>"
                 % (x, y, 1.1 if rnd.random() < 0.82 else 1.9, 0.25 + rnd.random() * 0.55))
    s.append("<circle cx='858' cy='74' r='26' fill='#f6edc8' opacity='0.95'/>"
             "<circle cx='846' cy='66' r='24' fill='#33456b'/>")
    x = -20
    far = []
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
    for i in range(4):
        lx = 80 + i * 260 + rnd.random() * 50
        s.append("<rect x='%.0f' y='%d' width='5' height='118' fill='#0b0812' opacity='0.85'/>%s"
                 % (lx, HZ - 78, lamp(int(lx + 2), HZ - 82)))
    return ''.join(s)


def scene_cafeteria(rnd):
    s = [sky('cafeteria', '#6d5a86', '#443660', '#241c38')]
    # Back wall with a run of night windows.
    s.append("<rect y='40' width='%d' height='%d' fill='#3b3054'/>" % (SW, HZ - 40))
    for i in range(6):
        x = 40 + i * 160
        s.append("<rect x='%d' y='70' width='110' height='96' fill='#1c2540'/>"
                 "<rect x='%d' y='70' width='110' height='96' fill='none' stroke='#544470' stroke-width='4'/>"
                 "<rect x='%d' y='118' width='110' height='4' fill='#544470'/>" % (x, x, x))
        for _ in range(5):
            s.append("<circle cx='%.0f' cy='%.0f' r='1.3' fill='#fff' opacity='0.5'/>"
                     % (x + 8 + rnd.random() * 94, 78 + rnd.random() * 34))
    # Pendant lights over the counter.
    for i in range(5):
        x = 110 + i * 195
        s.append("<rect x='%d' y='0' width='3' height='54' fill='#1a1428'/>"
                 "<path d='M%d 54 L%d 54 L%d 78 L%d 78 Z' fill='#2a2038'/>%s"
                 % (x, x - 20, x + 23, x + 15, x - 12, lamp(x + 1, 80, 11)))
    # Serving counter.
    s.append("<rect y='196' width='%d' height='20' fill='#5a4a72'/>"
             "<rect y='216' width='%d' height='%d' fill='#2c2340'/>" % (SW, SW, HZ - 216))
    for i in range(14):
        s.append("<rect x='%d' y='202' width='30' height='8' fill='#8f7aa8' opacity='0.5'/>" % (30 + i * 70))
    # Tables in the near dark.
    for i in range(3):
        tx = 90 + i * 330
        s.append("<rect x='%d' y='%d' width='200' height='11' fill='#0b0812' opacity='0.86'/>"
                 "<rect x='%d' y='%d' width='8' height='46' fill='#0b0812' opacity='0.86'/>"
                 "<rect x='%d' y='%d' width='8' height='46' fill='#0b0812' opacity='0.86'/>"
                 % (tx, HZ + 34, tx + 16, HZ + 45, tx + 176, HZ + 45))
    return ''.join(s)


def scene_classroom(rnd):
    s = [sky('classroom', '#4d6a9b', '#2f4470', '#1a2440')]
    s.append("<rect y='30' width='%d' height='%d' fill='#2c3a5e'/>" % (SW, HZ - 30))
    # Blackboard, the one thing that makes a classroom a classroom.
    s.append("<rect x='150' y='62' width='560' height='150' fill='#1e3630'/>"
             "<rect x='150' y='62' width='560' height='150' fill='none' stroke='#6b5638' stroke-width='9'/>"
             "<rect x='150' y='206' width='560' height='10' fill='#6b5638'/>")
    for i, w in enumerate([180, 250, 140, 300]):
        s.append("<rect x='%d' y='%d' width='%d' height='4' fill='#cfe3d8' opacity='0.28'/>"
                 % (185 + (i % 2) * 40, 92 + i * 26, w))
    # Windows down the right, and a clock.
    for i in range(2):
        x = 760 + i * 110
        s.append("<rect x='%d' y='72' width='84' height='120' fill='#16213c'/>"
                 "<rect x='%d' y='72' width='84' height='120' fill='none' stroke='#46578a' stroke-width='4'/>" % (x, x))
        for _ in range(4):
            s.append("<circle cx='%.0f' cy='%.0f' r='1.3' fill='#fff' opacity='0.5'/>"
                     % (x + 8 + rnd.random() * 68, 80 + rnd.random() * 50))
    s.append("<circle cx='92' cy='104' r='27' fill='#e6e2d6'/><circle cx='92' cy='104' r='27' fill='none' "
             "stroke='#2c2340' stroke-width='4'/><rect x='90' y='88' width='4' height='18' fill='#2c2340'/>"
             "<rect x='92' y='102' width='14' height='4' fill='#2c2340'/>")
    for i in range(4):
        x = 120 + i * 210
        s.append("<rect x='%d' y='%d' width='36' height='3' fill='#ffd98a' opacity='0.22'/>" % (x, 34))
    # Desks in rows, receding.
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
    return ''.join(s)


def scene_hallway(rnd):
    s = [sky('hallway', '#5f7b9c', '#3a5171', '#1e2c40')]
    s.append("<rect width='%d' height='%d' fill='#2b3a52'/>" % (SW, HZ))
    # One-point perspective: the corridor runs to a lit door at the end.
    s.append("<path d='M0 0 L%d 0 L%d %d L0 %d Z' fill='#243247'/>" % (SW, SW, 40, 40))
    s.append("<path d='M0 0 L380 118 L620 118 L%d 0 Z' fill='#1d2942'/>" % SW)
    s.append("<path d='M0 %d L380 %d L620 %d L%d %d Z' fill='#141d2e'/>" % (SH, 160, 160, SW, SH))
    s.append("<rect x='432' y='118' width='136' height='120' fill='#2a3a55'/>"
             "<rect x='452' y='138' width='96' height='100' fill='#ffd98a' opacity='0.20'/>")
    # Lockers down both walls, shrinking toward the vanishing point.
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
    # Ceiling strips.
    for i in range(4):
        t = i / 4.0
        w = int(150 - 96 * t)
        s.append("<rect x='%d' y='%d' width='%d' height='%d' fill='#ffd98a' opacity='%.2f'/>"
                 % (SW // 2 - w // 2, int(14 + t * 74), w, max(3, int(9 - 5 * t)), 0.5 - t * 0.22))
    return ''.join(s)


def scene_home(rnd):
    s = [sky('home', '#8a6a4c', '#5b4230', '#2e2118')]
    s.append("<rect y='20' width='%d' height='%d' fill='#40312a'/>" % (SW, HZ - 20))
    # Window on the night, curtains either side.
    s.append("<rect x='92' y='60' width='190' height='140' fill='#16203a'/>"
             "<rect x='92' y='60' width='190' height='140' fill='none' stroke='#6b533c' stroke-width='7'/>"
             "<rect x='182' y='60' width='6' height='140' fill='#6b533c'/>"
             "<rect x='92' y='126' width='190' height='6' fill='#6b533c'/>")
    for _ in range(8):
        s.append("<circle cx='%.0f' cy='%.0f' r='1.4' fill='#fff' opacity='0.55'/>"
                 % (100 + rnd.random() * 172, 68 + rnd.random() * 50))
    s.append("<rect x='68' y='52' width='28' height='156' fill='#7a4a44'/>"
             "<rect x='278' y='52' width='28' height='156' fill='#7a4a44'/>")
    # Frames on the wall.
    for i, (x, y, w, h) in enumerate([(400, 78, 70, 54), (496, 66, 54, 70), (576, 84, 62, 48)]):
        s.append("<rect x='%d' y='%d' width='%d' height='%d' fill='#2a2038'/>"
                 "<rect x='%d' y='%d' width='%d' height='%d' fill='none' stroke='#8a6b4a' stroke-width='5'/>"
                 % (x, y, w, h, x, y, w, h))
    # A standing lamp, which is the room's light.
    s.append("<rect x='790' y='120' width='6' height='130' fill='#2a2038'/>"
             "<path d='M760 120 L826 120 L814 76 L772 76 Z' fill='#d8a13f' opacity='0.9'/>%s"
             % lamp(793, 116, 30))
    # Sofa along the front.
    s.append("<rect x='300' y='%d' width='420' height='58' fill='#3d2d3f'/>"
             "<rect x='300' y='%d' width='420' height='18' fill='#4d3a50'/>"
             "<rect x='286' y='%d' width='30' height='72' fill='#4d3a50'/>"
             "<rect x='704' y='%d' width='30' height='72' fill='#4d3a50'/>"
             % (HZ + 42, HZ + 42, HZ + 30, HZ + 30))
    for i in range(3):
        s.append("<rect x='%d' y='%d' width='62' height='34' fill='#6b4f68' opacity='0.8'/>"
                 % (330 + i * 130, HZ + 22))
    return ''.join(s)


def scene_market(rnd):
    s = [sky('market', '#6f8a56', '#455a36', '#232f1d')]
    for _ in range(30):
        s.append("<circle cx='%.0f' cy='%.0f' r='1.2' fill='#fff' opacity='%.2f'/>"
                 % (rnd.uniform(0, SW), rnd.uniform(0, 120), 0.3 + rnd.random() * 0.4))
    # String lights across the top -- the thing that says night market.
    pts = ' '.join('%d,%d' % (i * 100, 36 + (24 if i % 2 else 8)) for i in range(11))
    s.append("<polyline points='%s' fill='none' stroke='#2a2038' stroke-width='3'/>" % pts)
    for i in range(11):
        s.append(lamp(i * 100, 36 + (24 if i % 2 else 8) + 8, 6))
    # Three stalls with striped awnings.
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
        # Crates and produce on the counter.
        s.append("<rect x='%d' y='196' width='250' height='14' fill='#5a4a38'/>" % x)
        for k in range(6):
            cx = x + 26 + k * 38
            col = ['#d8a13f', '#b8433f', '#7a9a4a', '#d87a3f'][k % 4]
            s.append("<circle cx='%d' cy='188' r='9' fill='%s' opacity='0.92'/>" % (cx, col))
    # Foreground crates.
    for i in range(4):
        x = 40 + i * 270
        s.append("<rect x='%d' y='%d' width='96' height='58' fill='#0b0812' opacity='0.85'/>"
                 "<rect x='%d' y='%d' width='96' height='6' fill='#2a2038' opacity='0.9'/>"
                 % (x, HZ + 48, x, HZ + 48))
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
    people = {}
    for k in CAST:
        people[k] = portrait(k)

    places = {}
    for k, fn in SCENES.items():
        rnd = random.Random(hash(k) & 0xffff if False else sum(ord(c) for c in k) * 7919)
        places[k] = ("<svg class='lq-art' viewBox='0 0 %d %d' preserveAspectRatio='xMidYMid slice' "
                     "aria-hidden='true'>%s</svg>" % (SW, SH, fn(rnd)))

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
        "   THE ART IS FIXED AND THE TEXT IS NOT. That split is deliberate. A portrait\n"
        "   and a backdrop are furniture: recognising the vendor on sight IS the point\n"
        "   of the vendor, so they must be the same every time. The lines, the options\n"
        "   and the vocabulary stay editable, because those are the learning.\n"
        "\n"
        "   Before this, every NPC was the character U+263B in a rounded box and every\n"
        "   location was one procedural skyline behind a different gradient -- so a\n"
        "   cafeteria and a classroom were the same street in another colour.\n"
        "   ============================================================ */\n\n")

    body = head
    body += dump('LANG_PORTRAITS', people,
                 'Six people on an 18x24 grid, sharing a head size, a shoulder line and an\n'
                 '   eye row so they read as one cast, and differing by hair, palette and one\n'
                 '   prop each. At this size the prop does as much work as the face.')
    body += "\n"
    body += dump('LANG_SCENE_ART', places,
                 'Six places, each its own builder rather than one skyline recoloured. They\n'
                 '   share a horizon and a lighting discipline -- far things pale, near things\n'
                 '   dark, one warm source -- and nothing else.')
    return body


if __name__ == '__main__':
    out = build()
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)
    print('wrote %s  (%d bytes)' % (OUT, len(out)))
    for k in sorted(CAST):
        print('  person %-10s %5d chars' % (k, len(portrait(k))))

"""List CSS custom properties that are used but never defined.

Run from studysession-pro/:  python tools/check-css-vars.py
Prints nothing when clean. A var() with a fallback is reported only if it has
no definition anywhere, and is marked so it can be judged case by case.
"""
import collections, glob, io, re

files = (glob.glob('css/**/*.css', recursive=True) + ['index.html']
         + [f for f in glob.glob('js/**/*.js', recursive=True) if 'JSCPP' not in f])
defined, uses = set(), collections.defaultdict(list)
for f in files:
    t = io.open(f, encoding='utf-8', errors='replace').read()
    if f.endswith('.css'):
        t = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), t, flags=re.S)
    defined.update(re.findall(r'(--[A-Za-z0-9_-]+)\s*:', t))
    defined.update(re.findall(r"setProperty\(\s*['\"](--[A-Za-z0-9_-]+)", t))
    for m in re.finditer(r'var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])', t):
        uses[m.group(1)].append((f, t.count('\n', 0, m.start()) + 1, m.group(2) == ','))
for name in sorted(k for k in uses if k not in defined):
    bare = [u for u in uses[name] if not u[2]]
    where = ', '.join('%s:%d' % (a, b) for a, b, _ in (bare or uses[name])[:3])
    print('%-28s %s  %s' % (name, 'NO FALLBACK' if bare else 'has fallback', where))

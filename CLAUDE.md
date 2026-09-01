# StudySession Pro

A study app for learning C: a library of programs, an editor that compiles and
runs them, spaced repetition, and progress tracking. Buildless vanilla
HTML/CSS/JS — no bundler, no framework, no build step. `index.html` loads ~120
scripts and ~34 stylesheets in order and that is the whole pipeline.

Deployed to GitHub Pages from the repo root (`Kewnric/CS`, branch `main`), live
at kewnric.github.io/CS. Editing a file and pushing is the deploy.

**Run it locally:** `preview_start` with the `studysession` config in
`.claude/launch.json` (python http.server on 8754). Do not open `index.html`
from disk — `file://` cannot fetch its own neighbours, which silently breaks
audio and anything else that loads a file.

---

## The one rule that will bite you

**Every script shares ONE global scope.** These are classic `<script>` tags, not
modules. A duplicate top-level `const` or `let` is a hard `SyntaxError` that
kills the *entire second file* — every function in it silently stops existing,
and the failure looks like an unrelated feature breaking.

There are currently **2851 top-level declarations across 108 files and zero
collisions**. Keep it that way. After adding or renaming anything top-level:

```bash
python - <<'PY'
import re, io, glob, collections
names = collections.defaultdict(list)
for f in sorted(glob.glob('js/**/*.js', recursive=True)):
    if 'JSCPP' in f: continue
    depth = 0
    for line in io.open(f, encoding='utf-8', errors='replace'):
        if depth == 0:
            m = re.match(r'\s*(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', line)
            if m: names[m.group(1)].append(f)
        depth += line.count('{') - line.count('}')
        if depth < 0: depth = 0
print({k: v for k, v in names.items() if len(v) > 1} or 'none')
PY
```

**Load order matters.** A new file needs a `<script>` tag in `index.html`, placed
after anything it reads at load time. Most modules only call each other at
runtime, so order is usually forgiving — but data files (e.g.
`coding-starter-solutions.js`) must come before the file that consumes them.

---

## Layout

```
index.html            every script and stylesheet tag; the only HTML file
sw.js                 service worker. BUMP `CACHE` ON EVERY CHANGE or the
                      deployed app serves stale files
css/                  24 stylesheets, ~28k lines
js/                   ~108 files, ~60k lines
  routes/             one file per screen + register.js
  wings/              the newer libraries (mindset, diary, roadmap, …)
design-system/        snapshot exported by Claude Design; see the
                      studysession-pro-design skill. A SPEC, not code to import
audio/                three short SFX (also embedded as base64) + ost/ music
```

---

## How a screen happens

`js/router.js` — a hash router. `js/routes/register.js` registers **29 routes**,
each `{ templateFn, initFn, destroyFn }`. `handleRoute` wraps rendering in
`Motion.withViewTransition`, sets `document.body.dataset.route`, and calls the
previous route's `destroyFn` first.

That destroy step is load-bearing: the practice route autosaves there. If you
add state to a route, release it in `destroyFn` or it leaks across navigations.

Navigation: `location.hash = '#/practice'`. In tests you often also need
`SpaRouter.init()`, because setting the hash from script does not always
re-enter the router.

---

## State and persistence

One global `state` object (`js/state.js:14`). `saveData()` is **debounced** —
it does not write immediately; `_flushSaveData()` is the real write.

`state.nodes` holds folders for **every** library, separated by `scope`
(`'challenge'`, `'snippet'`, `'notebook'`, `'wing:<key>'`). Anything that
touches folders must filter by scope or it will move another library's tree.

39 `localStorage` keys, mostly per-feature preferences (`ssp.*` for newer ones).
`storageMode` chooses local vs cloud; Firebase auth is optional and the app
works fully offline.

---

## The practice page — the complicated part

`js/practice.js` (~3600 lines) plus `js/editor.js`, `js/practice-panel.js`.

**Multi-file editor.** `state.userFiles` is the live set; each file has
`starterCode` (what the editor opens with) and `code` (the **reference**). These
are different things — setting both to the same value makes the boss bar read
100% on load.

**Boss HP bar** measures similarity between what you have typed and the
reference `code`, per file. Max HP is the reference's significant-character
count. No reference means no bar.

**Run Code** (`preprocessMultiFile`) builds one translation unit: it inlines
`#include "local.h"` from the file you are on, then links a companion `.c`
**only if its matching header is in the unit** (`utils.c` ↔ `utils.h`). If
nothing defines `main`, the file that does is pulled in. It deliberately does
*not* compile every file present — that used to drag unrelated programs in.

**Compilers:** Godbolt (`_godboltCompileRun`) over the network, and JSCPP
(`js/JSCPP.es5.min.js`) lazy-loaded on first Run — which is why it has no
script tag.

**Autosave** writes to `ssp.practiceDraft` and a session copy, recording the
files *and* which tab was open. The saved list is authoritative for which files
exist; the challenge definition only supplies each file's starter code.

**Editor extras:** `fold.js` (folding — parks text in a module, so it is the only
thing between the user and lost code), `brackets.js` (pair highlight, matched
against the *whole* file so a folded partner is not mismatched), `editor-fx.js`
(per-character animation; hides the real glyph while its ghost flies).

---

## Libraries

- **Coding Library** (`js/browse.js`, route `browse`) — `state.challenges`.
- **Snippets**, **Notebooks** — their own routes and state arrays.
- **Wings** (`js/wings/`) — newer libraries sharing a schema-driven core.

**Starter-pack switch** (`js/coding-starter*.js`): the package button in the
Coding Library header swaps the whole library. Whatever is live is parked in
`state.codingStash` and the other set takes its place, so `state.challenges`
always means "what is on screen". Only the challenge scope moves. Nothing can
leak between the two because only one is ever loaded.

The pack is 8 folders / 25 programs. Every program has a reference solution in
`coding-starter-solutions.js` that has been **compiled and run against its own
tests**. If you add one, do the same — a reference that fails its own tests
marks correct work wrong, silently.

---

## Audio

- **SFX** (typing, success, failure) are base64 in `js/audio-data.js`. Embedded
  because `fetch` failed silently for the user; they are only ~42 KB.
- **OST music** (`js/ost.js`) are real files in `audio/ost/`. Not base64: 13.4 MB
  would become ~19 MB of JS parsed on every load, and `<audio src>` streams and
  seeks by byte range, which a `data:` URI cannot.
- Filenames are plain lowercase ASCII on purpose — spaces and em dashes only
  reach a static host through percent-encoding.
- The `<audio>` element lives on `document.body`, not in a route, so music
  survives navigation.

---

## Traps that have already cost time

**Verify by measuring, not reasoning.** Several "bugs" this codebase appeared to
have were measurement mistakes. Check the measurement before believing a
surprising result.

- **Browser-pane artefacts:** `requestAnimationFrame` does not fire while the
  pane is hidden; timers throttle; CSS transitions mean `getComputedStyle` right
  after a class change returns the *old* value; styles inside a
  `visibility: hidden` subtree resolve stale.
- **WAAPI seeking with a negative `animation-delay`:** `currentTime` is timeline
  time. Seeking naively lands *before* the animation starts and the element
  reads as dead. Step one whole iteration ahead.
- **`CSSStyleRule` now has an empty `cssRules`**, so a `if (r.cssRules) recurse;
  continue;` walk skips every style rule.
- **Naive brace counting on CSS is wrong** — comments and SVG data URIs contain
  braces. `editor.css` is balanced despite what a `grep -c` suggests.
- **Heredocs mangle backslashes.** `\\n` in a bash heredoc arrives as `\n`. For
  patches containing regexes or C strings, use raw strings with single
  backslashes, build them with `chr(92)`, or use the Write tool.
- **Line endings are mixed**, including *within* `index.html`. Match the
  surrounding file; edit `index.html` line by line.
- **The local preview server drops out** mid-session. `504`s from every request
  and a stale-looking app usually mean restart it, not a code bug.

---

## Before you push

1. `node --check` every touched JS file.
2. Run the duplicate-globals scan above.
3. Bump `CACHE` in `sw.js`.
4. Exercise the change in the browser and *measure* the claim you intend to
   make. Screenshots settle visual questions that computed styles will not.
5. Clean up test fixtures — challenges, drafts, session keys — and confirm the
   sandbox store is back to empty.

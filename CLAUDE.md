# StudySession Pro

A study app for learning C: a library of programs, an editor that compiles and
runs them, spaced repetition, and progress tracking. Buildless vanilla
HTML/CSS/JS — no bundler, no framework, no build step. `index.html` loads ~120
scripts and ~34 stylesheets in order and that is the whole pipeline.

Deployed to GitHub Pages from the repo root (`Kewnric/CS`, branch `main`), live
at kewnric.github.io/CS. Editing a file and pushing is the deploy.

**Run it locally:** `preview_start` with the `studysession` config in
`.claude/launch.json` (node http-server on 8754). Do not open `index.html`
from disk — `file://` cannot fetch its own neighbours, which silently breaks
audio and anything else that loads a file.

---

## The one rule that will bite you

**Every script shares ONE global scope.** These are classic `<script>` tags, not
modules. A duplicate top-level `const` or `let` is a hard `SyntaxError` that
kills the *entire second file* — every function in it silently stops existing,
and the failure looks like an unrelated feature breaking.

There are currently **2882 top-level declarations across 108 files and zero
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
            m = re.match(r'\s*(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', line)
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
fonts/                bundled OFL fonts (Comic Neue Bold for comic notes) +
                      their licence files
```

---

## How a screen happens

`js/router.js` — a hash router. `js/routes/register.js` registers **46 routes** (32 fixed, plus a library and an admin route for each of the 7 wings),
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

**Compilers:** two, and Run Code picks by `termEnginePref()` (the engine badge
in the terminal's status bar toggles it; default `xcc`):
- **xcc**, in the browser (`js/xcc-runner.js` → a Web Worker running
  `js/xcc-core.js`): a real C compiler shipped as WebAssembly, base64 in
  `vendor/xcc/wccfiles.js` (MIT, 166 KB zipped), run through a small in-memory
  WASI layer. About 50 ms a run and works offline. **It has to work from
  file://** — the user opens the app from disk, where a page may load
  `<script>` tags but may not `fetch()` or start a Worker from a file — so the
  runner loads everything by script tag on first use and builds the worker as a
  blob: URL from the factories' own source text (`xccStdioFactory` /
  `xccCoreFactory.toString()`). Its libc's printf/scanf are not gcc-exact, so
  `js/xcc-stdio.js` compiles a replacement family in front of every program,
  followed by `#line 1` (float digits come from JS BigInt, ties to even like
  glibc). It also lacks clock/time.h's struct tm family, difftime, rewind,
  trunc and lround; `XccStdio.extrasFor(source)` adds just the ones a program
  names. Limits: 32-bit (`long` and pointers are 4 bytes), and no warnings (the
  JS lint `termLintC` stands in -- it must stay silent on every pack reference).
  Address 0 is ordinary memory in wasm, so a write through NULL is caught after
  the run instead: xcc leaves the first 4 KB all zero, and anything written
  there is reported as a segfault (exit 139). Reads through NULL are not caught.
- **GCC on Godbolt** (`_godboltCompileRun`): exact, `-Wall`, 1–2 s per step.
Each falls back to the other. **Check Code grades on GCC whenever it is
reachable** (xcc only offline), so verdicts come from the real compiler. Both
answer in the same result shape, so the input probe works on either. Measured
on the pack: xcc 157/158 (the one left prints `sizeof` a pointer). JSCPP, the
old JS interpreter (93/158), is gone.

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
- **Memorization Typing** (`typing`, `admin-typing`, `typing-attempt`) — a typing test over
  your own entries (`state.typeItems`, results in `state.typeHistory`). Text or code; code is
  C, HTML, CSS or JS with per-character highlighting from `typing-syntax.js` (not
  `syntaxHighlight`, which returns HTML for C only). The rules live in `typing-engine.js`, which
  has no DOM, so the replay re-runs it over the recorded keys. Screen preferences are per
  device in `ssp.typeConfig`.
- **Wings** (`js/wings/`) — newer libraries sharing a schema-driven core.

**Notebook editor** (route `admin-notes`), three files:
- `admin-notebooks.js` — the list, the form, tags window, sections, Import window.
- `admin-notebook-questions.js` — the question model (`nbApplyTypeDefaults`,
  `nbCommitQuestions`) and the one Edit Questions window, where answers are marked
  beside the choices. It edits a draft; the section changes only on Save.
- `notebook-import.js` — the paste parser and the copyable AI format. No DOM; test it
  with `node tools/test-notebook-import.js` after any change.
A section's `answerKeysData` holds one record per question (text, choices *and* answer);
`questions` is just `[1..n]` beside it. Files that may be cached next to an older copy of
a neighbour must not reuse its top-level `const`/`let` names (a stale + fresh pair then
throws on load); that is why the parser's constants are `_NBI_*`.

**Notebook attempt** (route `notes-practice`): `notes-practice.js` owns the attempt (answers,
grading, timer, resume); `notes-practice-ui.js` + `css/notes-practice-ui.css` own how it looks
and moves — display prefs in `ssp.np.ui` (text size, element size, width, spatial level,
animations, keycaps, right-click nav) written as `data-np-*` on `#np-layout`, the spatial
lean/glare on anything `.np-sp`, right-click left/right half of the pane = Previous/Next, and
the Display panel. The Feel panel is not on this screen (its options are all code-editor ones).
Choices are `.np-choice` with `is-selected / is-correct / is-wrong / is-missed / is-dim /
is-locked`; their onclick must stay `selectAnswer('X')`, which the keyboard handler matches on.
Matching connectors are measured from layout offsets up to the grid (`_npMatchPos`), never
from `getBoundingClientRect`, so the card's slide-in and the hover lean cannot misplace them;
a ResizeObserver redraws them. The attempt's theme (`ssp.np.ui` `theme`) is set on `<html>`
while the route is up and the app's own `theme` key is put back on unmount — never call
`changeTheme` from here, it saves app-wide. A question is locked and shows its key only with an
answer AND a grade (`_npHealAnswered`); the resume draft stores no grades, so they are re-derived.
A reload resumes silently: session param `npLive` is set while the attempt is up and cleared in
`notesPracticeDestroy`, so finding it on init means the tab was reloaded (a `pagehide` flush keeps
the draft and the clock current). The pencil in Display opens the admin notebook form in a drawer
(`npUiOpenEditor`); the attempt follows its draft live through `npApplyNotebookUpdate`, which keeps
answers and regrades them, and falls back to the saved notebook when the drawer closes.
Start options (`notes.js notesConfirmStart`, the `#np-start-opts` block in the shared
`#timer-modal`): No backtracking (`notebookNoBack`) and seconds per question (`notebookQSec`,
only with no backtracking). Read once at init, cleared, and kept in the progress draft with the
question clock (`npQKey`/`npQLeft`). `npSubmitted` stops anything re-saving a finished attempt.

**Execution stack** (the layers button in the attempt's editor toolbar): memory as it
stands when the program reaches the cursor's line — frames, globals, heap — redrawn a
moment after typing stops. It does not use the compiler: a small C interpreter runs
the program quietly in the page, because only an interpreter knows which bytes are
`you.age`. Four files:
- `cvm-parse.js` — lexer, preprocessor (`#include "x.h"` from the other tabs, `#define`,
  `#if`), parser. Types are gcc x86-64 sizes, so padding and `sizeof` match Run Code.
- `cvm-run.js` — the interpreter over one byte memory with an "ever written" bit per
  byte (garbage draws as `?`), the C library, in-memory files, snapshots at a target
  statement. It stops with a plain message on an index past the end, NULL, use after
  free, or a loop past 1M steps.
- `cvm-view.js` — `targetAt` (cursor → statement) and `describe` (snapshot → boxes).
- `stack-window.js` — the window: docked beside the code or floating, `ssp.stackWindow`.
All three `cvm-*` files attach to one global `CVM` and run under Node. After any change
run `node tools/test-cvm.js`: every starter-pack reference must print exactly its
tests' expected output (366/366), plus snapshot checks.

**Starter-pack switch** (`js/coding-starter*.js`): the package button in the
Coding Library header swaps the whole library. Whatever is live is parked in
`state.codingStash` and the other set takes its place, so `state.challenges`
always means "what is on screen". Only the challenge scope moves. Nothing can
leak between the two because only one is ever loaded.

The pack is 33 folders / 159 programs plus 12 practice sets. Every program has a reference solution in
`coding-starter-solutions.js` (or `-advanced-solutions.js`) that has been
**compiled and run against its own tests** by `tools/verify-pack.js`, which also
checks every minimum requirement against that same reference. Run it after any
pack change: `node tools/verify-pack.js .`. If you add a program, do the same — a reference that fails its own tests
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

## Ambient backgrounds

`js/ambient.js` puts `.amb-host` on the two attempt panes and paints three
layers behind them: a tiled field (`::before`), a glow (`::after`), and drifting
shards. **Nothing in `css/ambient.css` may be bigger than the pane or
transformed** — both panes scroll, and an oversized layer grows their
scrollbars. Layers are `inset: 0` and move by `background-position`.

Four looks, chosen from the topbar gem: Crystals (id `default`), Fireflies,
Starry night, Off. The theme class goes on the **body**, because two of the
three layers are pseudo-elements. Off is a separate switch, not a theme, so it
survives picking a look — and no theme rule sets `content`, which is what keeps
`.amb-off`'s `content: none` winning over all of them.

A theme recolours those layers and reshapes the shards — Fireflies swaps the
slivers for soft round glows that wander and blink, Starry night for points
that twinkle where they hang. All of it is CSS keyframes; there is no canvas
and no `rAF` loop behind the panes.

**Every loop must close.** A non-alternating animation restarts on its first
frame, so its last frame has to be the same picture: the field drifts exactly
one tile (`--amb-tile`, set per theme), the Crystals shafts one 1010px tile, a
light that never goes out ends where it started, and a gust's turn resets only
while its members are dark. Check it by seeking WAAPI across the restart and
comparing screen positions, not by watching. A pane that re-renders sets its
content with `ambSetContent`, which keeps the scene and shards in the document —
rebuilding them restarts every phase, and that reads as the background snapping.

---

## Stickers

`js/stickers.js` + `css/stickers.css`: your own pictures placed on any screen. Opened from the
small icon at the foot of the sidebar, the sticker button in the attempt topbars (coding,
multi-problem, SQL, notebook), or Alt+Shift+S anywhere.

- **Where one belongs:** `route` (body `data-route`), `host` (the pane it was dropped in, named by
  id or tag+first stable class, `@n` if not unique; `page` = `#spa-content`) and `sub` — what a
  library's **detail pane** shows (`STK_SUBS`: browse folder/program/set, notebook folder, …).
  The tree pane and single-pane pages have no `sub`, so one set each. Attempt routes have no
  `sub`, which is why every attempt of a kind shares its stickers.
- **Cut at edges** stickers live inside their pane in `.stk-layer-back` / `.stk-layer-front`,
  appended last, `overflow: clip` (not hidden -- a hidden box can be scrolled by scrollIntoView),
  so they scroll natively and never grow the scrollbar. The wrappers have NO z-index: as a
  stacking context one was composited as a single page-sized layer. Each sticker carries its own
  (-1 behind, 40 in front; document order breaks ties). Wrapper height = the content's height,
  read from the pane's children's boxes in a ResizeObserver -- never by collapsing it and reading
  scrollHeight, which forced a full layout on every DOM change. **Spill over** ones live in fixed
  `#stk-float` (z 150) and follow their pane by transform from a scroll listener.
- A pane gets `.stk-host` (+ `.stk-host-rel` if it was static) only while it holds a sticker.
  A MutationObserver on `#spa-content` puts layers back after a pane re-renders (`ambSetContent`
  keeps them). Drags do their work once per frame, move by transform, and look up the pane under
  the pointer at most every 90 ms -- that lookup was 91% of a drag's cost.
- Placements: localStorage `ssp.stickers` (other tabs follow via the `storage` event). Pictures:
  IndexedDB `ssp-stickers` (device only, not in the data export; Reset Data clears both). Huge
  pictures are scaled to 2000px once, as WebP.
- Settings' Storage row (`js/storage-meter.js`): localStorage against ~5 MB (measured in Chrome:
  5,242,773 characters) and `navigator.storage.estimate()` for IndexedDB + the offline cache.

---

## Traps that have already cost time

**Verify by measuring, not reasoning — then check the measurement.** Every
alarming finding this codebase has produced so far has been the tool, not the
code. A scan that reports 117 broken things in an app that visibly works is
reporting a broken scan. Confirm one case by hand before believing the set.

Specifically, when scanning this app's JS for "is this defined anywhere", a
naive scan will be wrong three ways:

- functions are often `window.foo = function ...`, not a top-level declaration
- `async function foo()` does not match `(const|let|var|function|class)\s+`
- an `onclick="...${_esc(x)}..."` contains build-time interpolation that is
  never part of the emitted handler

With all three handled, all 1281 inline handlers resolve and there are no dead
buttons.

- **Lucide 0.408's `createIcons` ignores `root` and `el`** and redrew every icon on the page on every
  call (a drawn `<svg>` keeps `data-lucide`). `js/utils.js` wraps it to draw only placeholders and
  icons whose `data-lucide` changed, still through Lucide. Scoping a call does nothing; do not rely on it.
- **A finished animation with `fill: forwards` that touches transform, opacity or filter keeps its
  element composited for good.** Home had 470 such layers (heatmap cells, hero letters). Rest on the
  final keyframe and fill `backwards`. Count layers with CDP `LayerTree` when a page feels slow.
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
3. Run `python tools/check-css-vars.py` — any NO FALLBACK line is a variable no
   theme defines.
4. Bump `CACHE` in `sw.js`.
5. Exercise the change in the browser and *measure* the claim you intend to
   make. Screenshots settle visual questions that computed styles will not.
6. Clean up test fixtures — challenges, drafts, session keys — and confirm the
   sandbox store is back to empty.

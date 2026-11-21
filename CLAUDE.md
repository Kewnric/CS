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

**The big saves are stored compressed** (`js/store-codec.js`, `vendor/fflate`, MIT): the library
(`codePlatformData`, `_online`), the Visualize canvas and brain, and the cheat sheets (`cheatsheetLibrary`,
`_online`; readers `CS_`, `FB_`, `IO_`, `NAV_`, `LIB_READS_PACKED_CS`, see `storeCheatsReadPacked`). Format
`~z1:<deflated bytes>:<original chars>:<FNV-1a of the deflated bytes>:<packed>`, 15 bits per char
below the surrogate range; anything without the `~z1:` tag is plain JSON and reads as it is. About
13x fewer characters (the 5 MB budget counts characters). **Never `JSON.parse` these keys directly**:
read through `storeDecode(raw)` / `storeGetText(key)`, write through `storeSetJSON` / `storeWriteSync`.
The debounced `saveData` compresses and verifies in fflate's background workers
(`_flushSaveData({ background: true })`); a newer write to a key always wins, and hiding or closing
the tab writes synchronously over anything still in flight (`storeBusy()`). Old plain saves are
packed ~4 s after start (or by **Compress now** in Settings > Storage), only if nothing has written
the key since, and **only once every reader of that key declares it can read packed saves**
(`STATE_READS_PACKED`, `FB_READS_PACKED`, `VIZ_READS_PACKED`, `BRAIN_READS_PACKED`): the first load
after a release can run the new codec beside the service worker's cached old `state.js`, and packing
under it would leave the next old load unable to read the library. A new reader of these keys must
declare itself and be added to `STORE_COMPACT_GROUPS`. An unreadable compressed
save goes down the same path as unreadable JSON: copy set aside, saving paused.
`storageMode` chooses local vs cloud; Firebase auth is optional and the app
works fully offline. Firestore refuses a list directly inside a list (a cheat-sheet table's rows of
cells), and the cloud save is one batch, so one such list fails every domain: `_sanitizeForFirestore`
wraps it as `{ $arr: [...] }` and `_loadV2Domains` reads every domain doc through `dataOf` →
`_fromFirestore`, which unwraps it. A new cloud reader must do the same. Test:
`tests/cloud-nested-arrays.spec.js` (runs the real SDK's batch check, no network).
**Preferences and data kept in their own keys** sync through `SYNC_PREF_KEYS` (firebase-auth.js) as the
`prefs` domain doc (`{ items: [{k, v}] }`, raw strings; a key the account lacks keeps the device's).
**A new localStorage key that is the person's data or taste goes on that list**; layout (positions, sizes,
folded panels), secrets and device caches never do. Writing a listed key while signed in schedules a cloud
save by itself (a `Storage.prototype` wrapper). Practice-set drafts ride in `stash`, merged per set.
**Cloud domains of 16 KB or more go up compressed** (`_fsDeflate`, fflate, read back before trusted): base64 in
`domains/<name>__p0..` (`{ s }`) under a head `{ $parts: n, $z: 1 }`; one that will not compress but is over 1 MB goes
up as JSON text in parts (`{ $parts }`); small ones stay plain maps. `_fsJoinDomain` puts them back before `dataOf`.
The starter pack alone puts `app` past Firestore's 1 MB a document; that used to throw and, the save being one batch,
stop every domain. **The root names the format in `schema` (3), not `schemaVersion`**, and carries
`app: { challenges: FS_OLD_READER_TRAP }`: an older build, finding no schemaVersion, takes its V1 path and throws on
the trap before changing anything, instead of reading split domains as empty and saving that. Keep both. The last
save's sizes (`ssp.cloudUse`) fill Settings > Storage's "Cloud copy". Tests: `tests/cloud-sync.spec.js`.
**A refresh while signed in opens from this device's copy** (`_bootFromDeviceCopy`), not a download: the
`*_online` keys hold the account, and `ssp.cloudCopy` ({uid, stamp, clean}) vouches for them. It is written
only by a full cloud load or a cloud save, marked unclean by `markCloudDirty`, and dropped with the caches or on
any failed `localStorage.setItem` (the wrapper below). Then one read of the root doc (`_cloudCheckAfterDeviceBoot`):
another device's newer save (`savedBy` is the device id) reloads into the full load (`ssp.cloudFullLoad`, once).
Signing in from the login page uses the same copy (`_afterSignedIn`): it may hold changes the cloud never got,
which a download would cover. Hence the leave prompt (`_attachUnloadGuard`) asks only when `_cloudCopyHolds()` is
false. So the device copy must be COMPLETE: `_cacheAllToLocalStorage` writes the app blob with `_flushSaveData()`, never
a field list of its own. Tests: `tests/cloud-sync.spec.js` "refresh while signed in".
**Save state shows on `#sync-fab`** (above the gear, `_paintSyncFab`): no toast on success, one per run of
failures. Hiding the tab or coming back online saves at once; offline, the timed save waits.
Proof for Google and username alike: `tests/cloud-sync.spec.js` (two-device round trip: every doc the fresh
device saves must equal the first device's).

---

## The practice page — the complicated part

`js/practice.js` (~3600 lines) plus `js/editor.js`, `js/practice-panel.js`.

**Multi-file editor.** `state.userFiles` is the live set; each file has
`starterCode` (what the editor opens with) and `code` (the **reference**). These
are different things — setting both to the same value makes the boss bar read
100% on load.

**Boss HP bar** (`_bossFight`, shared with practice sets) measures the code still
to write: max HP is the significant characters the starter leaves missing from
the reference `code` (the whole reference with no starter), so a fresh attempt
opens at full HP; current HP is the edits between your code and the reference
(|a| + |b| - 2·LCS, summed over files), capped at full. No reference means no
bar. Tests: `tests/boss-hp-starter.spec.js`.

**Run Code** (`preprocessMultiFile` → `mergeTranslationUnit`) builds one
translation unit: it inlines `#include "local.h"` from the file you are on,
links a companion `.c` whose header is in the unit (`utils.c` ↔ `utils.h`),
pulls in the file that defines `main` if nothing does yet, and then links every
other source file **that has no `main` of its own** (a workshop's `cancel.c` has
no header). A second file with its own `main` is another program and stays out.
**Check Code and Finish** build the same unit from `entryFileIndex` (the file
that defines `main`) rather than the open tab, so a check means the same code
from every tab. Practice sets use the same function (`_psetMerge`).

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

**Program admin window** (`js/practice-admin.js`, `css/practice-admin.css`): the topbar's
file-cog button opens the program's own admin form (`getAdminFormHTML` + `openAdminForm`) in a
window built like the terminal (dragged by its header, resized from its corner, the dash leaves
the attempt clear and clickable; remembered as `programAdmin` in window-memory.js). The attempt
follows the draft (`adminState`) live through `practiceApplyProgram`, which re-points
`state.activeChallenge` / `activeVariant` and repaints only what changed. **`userCode` is never
touched**: a locked file follows the program's text, a file the program gains becomes a tab, and
one the window added goes again if dropped before it was written in. Save keeps it and closes;
closing without saving asks (the form's own question), then re-applies the saved program. While
it is open `state.activeChallenge` can be a draft copy, so anything else that writes to it then
is lost unless the program is saved. Single-program attempt only; Esc and Back close it first.

**Starter lock** (`js/starter-lock.js`, `variant.lockStarter`, the admin form's "Lock starter code"
under the starter editor): the starter's characters cannot be deleted, typed over, cut or moved;
text goes in only at a line's end, between lines, in a blank line, or (as a whole new line) before
a starter line. A mask over the editor text marks each character starter (1) or yours (0). Every
edit is judged before it lands -- the textarea's `beforeinput` (capture, on document) and
`edReplaceRange`'s `slkAllowReplace` -- and an allowed edit sets the mask it will produce
(`_slk.pending`); undo/redo get theirs back from a history keyed by text; anything else is diffed. A
range that reaches into the starter only loses YOUR characters (`_slkTakeMine`). Ctrl+A selects the
piece of yours at the caret, then all of yours, then the file. The mask rides on the file
(`state.userFiles[i].slk`, run-length plus a hash of the starter) into drafts and restore points;
without one, `slkAlign` lines the starter up against the text. The mask is over the WHOLE file
(`edFullSource`), so folding works: positions on screen go through `edViewOffsetToFull` /
`edFullOffsetToView`, and an edit whose range would reach into a folded block is refused.
`slkAttach` reads the file from `userCode`, never the textarea (folds may not be back on screen yet). editor.js's Enter / brackets / `}` hand the key back to the
browser when the lock refuses their fancy version, so a plain keystroke can still go in.

**Editor extras:** `fold.js` (folding — parks text in a module, so it is the only
thing between the user and lost code), `brackets.js` (pair highlight, matched
against the *whole* file so a folded partner is not mismatched), `editor-fx.js`
(per-character animation; hides the real glyph while its ghost flies), and
`code-peek.js` (hold Ctrl+Space or the toolbar eye: your code merged with the
reference `code` -- missing lines faint, wrong tokens wavy-red, compared as C
tokens so spacing and comments never count; off in Recall mode). Its merge is
pure (`peekRender`); after any change to it run `node tools/test-code-peek.js .`.
Right-click either eye for its settings (`ssp.peek`: hide the target's comments
that the starter does not have).

**Solution page diff** (`js/diff.js` `computeDiffs`, drawn by `js/solution.js`; also the reference-match
score). With names ignored, your names are PAIRED with the reference's by where they are used
(`diffPairNames`: a token alignment where any name may face any other, votes, one partner each), not
numbered by first appearance, so an extra variable or another declaration order no longer shifts every
name. The alignment weighs a real token 2 and name-against-name 1, so names line up inside matching
structure. One name may do two of the reference's jobs (`x` read as `n`, then counted down as `i`):
a name used in a second reference name's place on 2+ lines goes in `names.also` and matches there too
(`_diffNameAlso`); on one line it is a slip and stays marked. The pairs come back as `names` and must
reach the in-line highlight (`computeLineDiffs(…, names)`) and the explanations (`ctx.names`), or those
go back to marking `x` against `n`. The "different variable" explanation only fires when the two lines
are the same apart from names. `_diffCanonC` folds
forms that are the same program (`main(void)`, `++i;`/`i += 1;`, `x = x + E` when E binds tighter,
`return (x);`), never where a value is used; with whitespace ignored a lone `{`, an `else` after `}` and
a do-while's `while` join the line above; leading `#include`s follow the reference's order. Every rewrite
keeps line i on line i. After any change: `node tools/test-diff.js .` (also runs every pack reference
against itself renamed, Allman-braced and in the other statement style; all must match).

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
- **Freeground** (`js/freeground.js` rules, no DOM; `js/routes/route-freeground.js` screen) — scratch
  tabs. Only a **kept** tab (Save to shelf: topbar button, Alt+S, tab menu) survives closing; closing an
  unkept one discards it with an Undo. The shelf is a tree of categories (`state.freeground.cats`, 8 deep,
  100 at most) in the Ctrl+P list; which are folded open is per device (`ssp.fg.fold`, not synced). A store
  without `ver: 2` is migrated when first read (`_fgMigrate`), so `ver` must never go in train-store's empty
  value. After any change: `node tools/test-freeground.js`.

**Tree bullets and the order lock** (`js/tree-dnd.js`, every tree that commits through
`treeCommit`: Coding, Notebooks, Snippets, Visualize, Brain). Right-click a row → "Bullets for
this level…" lists that row's level (its siblings) with a bullet or a number style;
`treeApplyBullets` marks the level's box `data-bullets` and puts an empty `.tree-bullet` slot first
inside each row's `.tree-node-label`, and a CSS counter fills it (`css/library.css`). Numbers come
from the rows' order on screen, so they stay with the SLOT through a reorder. Keys: a real folder's
id (shared by every tree that shows it), else `<scope>:top` / `<scope>:<pseudo id>`. Styles live in
libPrefs `treeBullets`, a level's colour in `treeBulletColors` (Highlight colour → Bullet, the whole
level). "Lock tree order" (`treeOrderLocked`, libPrefs, in the Coding Library's header menu and every
row's right-click) stops drags in every tree; a Visualize row can still be dragged onto the canvas.
A drop between two top-level rows reorders the top level (`treeMoveAllowed(…, reorder)`).

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
tests' expected output (563/563), plus snapshot checks.

**Starter-pack switch** (`js/coding-starter*.js`): the package button in the
Coding Library header swaps the whole library. Whatever is live is parked in
`state.codingStash` and the other set takes its place, so `state.challenges`
always means "what is on screen". Only the challenge scope moves. Nothing can
leak between the two because only one is ever loaded.

**Pre-Final folder** (`coding-starter-prefinal.js`): the exam's own problems, each with its
starter code and one empty function, starter locked. Sources are real C in
`tools/prefinal/<id>/` (`starter.c` verbatim from the exam with the stub's body empty,
`answer.c` = that one function, `tests.json` = names + stdin). `node tools/build-prefinal.js`
splices the answer over the stub, compiles with gcc, runs every test and writes
`coding-starter-prefinal-files.js` — expected outputs are never typed by hand. Then add the
program to `CSP_PROGRAMS` (exam item order), or to `CSP_ALTERNATIVES` for the Alternatives
subfolder (`tools/prefinal/alternatives/`: 29 V1/V2 variants by operation). The first three
tests are the samples.
Every `answer.c` is written in the teacher's style, kept in `tools/prefinal/teacher-style.c`:
`memmove` for every shift, an empty-body `for` to search, the space check wrapping the
insert, one `return` at the end. It is the boss bar's target, so match it.

The pack is 35 folders / 192 programs plus 12 practice sets. Every program has a reference solution in
`coding-starter-solutions.js` (or `-advanced-solutions.js`) that has been
**compiled and run against its own tests** by `tools/verify-pack.js`, which also
checks every minimum requirement against that same reference. Run it after any
pack change: `node tools/verify-pack.js .`. If you add a program, do the same — a reference that fails its own tests
marks correct work wrong, silently.

---

## The front door: login page, accounts, Status Window, sidebar wheel

- **Login page** (`index.html` `#storage-mode-popup.lp-page`, `css/login.css`, `js/auth-accounts.js`): still the
  storage picker `firebase-auth.js` drives (`showStorageModePicker` → `lpOnShow`), with every `smp-*` id kept —
  `#smp-local-btn` is **Play as Guest** (Local), `#smp-online-btn` is Google. Your own picture: `ssp.loginArt`
  holds a `media:` reference (the media clean-up sees it as used).
- **Username accounts**: Firebase email/password under `<name>@users.studysession.app` (never mailed; Auth's
  unique emails make names unique), display name = the username; the same `_afterSignedIn` as Google, so the
  cloud library is `users/<uid>` either way. Needs **Email/Password enabled** in the Firebase console. Optional
  recovery email (sidebar account card → `acctOpenRecovery`): the account moves to it, and `usernames/<name>`
  keeps it AES-GCM-encrypted with a PBKDF2 key from the password (needs the Firestore rule in the file's header).
  Tests stub `fbAuth.*`, `loadFromFirestore` and `_acctLookup`; never create real accounts.
- **Profiles on one device** (Guest and each account). Nothing of one may show in, or be saved into,
  another. (1) The `*_online` keys are one slot: `ssp.onlineOwner` names its account, and
  `loadFromFirestore` empties it for anyone else (`_claimOnlineCaches`); sign-out removes those keys
  BY NAME (`_wipeOnlineCaches`) -- never `getAppStorageKey()`, which is Guest's library in a tab that
  was not told its mode. Every boot path stores the tab's mode in sessionStorage (all `get*StorageKey`
  read it there; "Remember me" restores used to skip it). (2) Device-kept data that is the person's
  (drafts, `anSrsState`, `editorLineMarks`, `demoSeenLessons`, `ssp.actionUse`) is
  `PROFILE_OWNED_KEYS` in `js/profile-keys.js`: `ssp.profileOwner` says whose values the keys hold,
  entering another profile parks them in `ssp.profile.<id>`, sign-out drops the account's. Taste and
  layout stay the device's. (3) Switching profile from inside the app (Change Storage Mode) asks about
  unsaved changes (`authLeaveAccountOk`), signs the old account out of the device and RELOADS into the
  new one (`_reloadInto`): memory is never carried across. `_flushAllInMemoryDomains` still clears every
  field a profile owns, for the boot-time picker. (4) **Reset Data** (`handleDataReset`, io.js) empties only the
  tab's profile: its keys come from the `get*StorageKey` getters, never both modes' names, and it refuses when
  `storageMode` and the tab's saved mode disagree. Signed in, the reload waits for the cloud save.
  (5) **Two tabs, two profiles**: the tab in front takes its profile's owned keys back (`profileKeysTakeBack`),
  and a cloud save reads its own values through `_ownKeyRaw` / `profileKeysOwnRaw` (parked when another tab is in
  front), never the keys directly. Two ACCOUNTS cannot share the slot: a `storage` event on `ssp.onlineOwner`
  stops the older tab (`_onlineSlotChanged`): one last cloud save of its own work, then the Storage wrapper drops
  every local write and a cover asks for a reload. `_cloudCopySave` and `ssp.cloudUse` write only for the slot's
  owner. (6) **A failed cloud load** opens the device copy if it is trusted, else sets `_cloudLoadFailedFor`
  and no save reaches that cloud until a reload. (7) **Pictures only this device has** of an account (over 1 MB,
  or not uploaded yet) are listed in `ssp.media.only.<uid>`, which the clean-up counts as used, so Guest's
  Clean up or Reset cannot delete them. `node tools/test-profiles.js`.
- **Status Window** (`js/status-window.js`, `css/status-window.css`): from `finishBoot`; full the first time per
  account (`ssp.welcome.seen.<key>`), brief once a day (`ssp.welcome.day.<key>`). Skipped under
  `navigator.webdriver` unless `ssp.welcome.test` is set, so it never covers what other tests click.
- **Sidebar wheel** (`js/sidebar-wheel.js`): notches move `.is-wheel-target`; the page opens after 320 ms still.
- **Parallel sessions**: give each Playwright run its own port (a config importing `playwright.config.js` with
  another `baseURL`/`webServer` port, `reuseExistingServer: false`): a shared 8754 server is shut down by
  whichever run ends first. To commit a file another session also has uncommitted lines in, **never**
  `git apply --cached --unidiff-zero` a subset of hunks: they land by line number and shift (that broke the
  live index.html once). Write the wanted version to a temp file (the working copy minus the other
  session's whole blocks), `git hash-object -w` + `git update-index --cacheinfo`, diff it against the last
  good commit, and boot it headless before pushing.

---

## Visualize: tasks, the select tool, the seams

- **Task notes** (`js/visualization/brain-tasks.js`): a Brain note's `task = { dur, state, endsAt?, left? }`
  (`idle|running|paused|done`). One app-wide `setTimeout` to the next `endsAt`; it runs off the
  canvas and across reloads (started by `brainTasksBoot`, again after every `brainLoad`). Finishing
  checks the note and starts every task an arrow leads to (`from → to`), timed from the real end, with a
  WAAPI pulse along the arrow. Off-screen canvases are edited in the stored version (`v.nodes` /
  `v.dirs[id]`), the on-screen one in `brain.nodes`. Ticks never push undo. Tests stub `brainTaskChime`.
  The timer floats above its note (`.brain-task` + `.bt-lead` leader line, `brainTaskLayout`), draggable
  (`task.pos`, not an edit), right-click for `#brain-task-ctx`. Every state change goes through `_btTask`,
  which keeps `dur`, `pos` and `startedAt`. It bobs, so tests click it with `force`.
- **Dates** (`js/visualization/brain-dates.js`): `createdAt` / `updatedAt` on notes, canvases and folders,
  `checkedAt`, `task.startedAt` / `doneAt`. Notes are stamped only in `brainSaveCurrentVersion`
  (`brainDatesStamp` compares `brainNoteSig` with the saved copy; position, size and the task's run are
  not edits). Old records have none ("Before dates were kept"). UI: row card (`brainDatesHover`), the
  `.brain-fresh` dot, `#brain-ctx-dates`, and the Activity panel (`brainActivityToggle`).
- **Animated borders** (`js/visualization/brain-borders.js`, `css/brain-borders.css`): nine, keyed on
  `.bfx-card` + `data-border`, each with a `.bfx-<id>` layer; animated parts are `.bfx-a` (transform /
  opacity only). `brainSizeBorderFx` sets `--bfx-w/h/d` for Circuit and Aurora.
- **Select tool** (`js/visualization/viz-select.js`, `viz.selectMode`, V): a box on empty canvas, a click
  adds/removes, no dragging; Space / middle button pan. Brain's group is `brain.selectedNodeIds`. Menu
  actions on a group go through `brainForEachTarget` (one undo, one render, one save via `brain._batch`)
  or `vizCtxTargets()`; one-note-only items carry `.ctx-single`.
- **Seams**: Visualize has no `.rz-collapse` buttons. The pane divider is zero-width (the 8px is the two
  flex gaps); `initResizerDrag(e, el, onClick)` treats a press that moves < 4px as a click (fold).
- **Note editor**: Text | Code switch (`#viz-ce-mode`) with per-mode settings saved on the note
  (`BRAIN_OPT_DEFAULTS`); they reach the canvas as `--note-*` / `--code-*` vars (`brainNoteVars`).
  Right-click its text box (`dictMenu`, `js/dictation.js`) for **voice typing** (also Ctrl+Shift+Space): the
  browser's SpeechRecognition, free, Chrome/Edge only. Half-heard words show in the bar in the footer; each
  settled phrase goes in at the caret via `execCommand('insertText')` (one undo step), shaped by the pure
  `dictShape` (spacing, capitals, spoken punctuation). `dictDetach(textarea)` wherever the editor goes away.
  Prefs `ssp.dictation` (synced). After any change: `node tools/test-dictation.js`.
- Run the full Playwright suite with `--workers=2`: at higher parallelism the single http-server makes
  random `page.goto` calls time out.

---

## Audio

- **SFX** (typing, success, failure) are base64 in `js/audio-data.js`. Embedded
  because `fetch` failed silently for the user; they are only ~42 KB.
- **Typing voices**: Mita, Keys and Recorded live in `js/typing-sfx.js`; the ten
  synthesised ones (Typewriter … Drums) are engines in `js/typing-voices.js`, which
  register into `SFX_VOICES` at load and receive the key itself, not numbers.
  `SFX_SYNTH_LEVEL` levels them against Keys/Mita — re-measure (offline render,
  K-weighted 50 ms loudness) rather than retune by guess after changing an engine.
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
shards, plus a scene of four layers. **Nothing may reach the pane itself bigger
than the pane or transformed** — both panes scroll, and an oversized layer grows
their scrollbars. Everything lives in `.amb-pin` (and the scene in `.amb-scene`),
both `overflow: hidden`, so the layers inside are a little bigger than the pane
and move by **transform only**: the field is one tile larger and slides one tile,
the scene layers are wider by their swing, the glow scales about its pool. They
used to move by `background-position` / `background-size` / `mask-size`, which
repainted the whole pane every frame: 290% of a core without the GPU, 30% of the
GPU with it, on an idle attempt. Never animate a background or a mask here.

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
- **A sticker keeps to the nearer edge of its pane** (left/right, top/bottom), so fullscreen or a
  resized pane does not leave one placed along the bottom floating mid-pane. `bw`/`bh` are the
  pane's size when it was put down (`bh` 0 when the content scrolled: it rides with the content);
  `x`/`y` are measured in that pane. Read the place through `_stkPos(it, host)`, never raw `it.x`.
  A gesture first `_stkPin`s the sticker to the pane as it is, so x/y are exact while it runs.
- Placements: localStorage `ssp.stickers@<profile>` (other tabs in the same profile follow via the
  `storage` event). Pictures: IndexedDB `ssp-stickers` (device only, not in the data export), each
  record's `owners` lists the profiles using it. Huge pictures are scaled to 2000px once, as WebP.
- **Each profile has its own stickers**: `'guest'`, `'u:<uid>'`, and `'device'` for the login page
  (`_stkWho`). Only the profile in the tab is in memory; every `_stkSync` first runs
  `_stkEnsureProfile`, which saves the leaving profile's pending change to its own key and swaps.
  Removing a picture or Reset Data only drops this profile from `owners` (deleted when none are left).
  The one shared list from before (`ssp.stickers`) is nobody's: its login-page stickers move to the
  device at start (`_stkLegacySplit`), the rest and the unowned pictures wait until a profile keeps or
  deletes them from the tray's note (`_stkLegacyClaim` / `_stkLegacyAskDrop`). `node tools/test-profiles.js`.
- Settings' Storage row (`js/storage-meter.js`): localStorage against ~5 MB (measured in Chrome:
  5,242,773 characters) and `navigator.storage.estimate()` for IndexedDB + the offline cache. Its
  action rows: Compress now, old recovery copies (Download / Delete), unused pictures (Clean up now),
  and whether storage is protected (`navigator.storage.persist`).
- **The storage picker is a sticker page too.** While `body.picker-open`, `_stkRoot()` is
  `#storage-mode-popup` and `_stkRoute()` is `'picker'`. The picker has its own copy of the sidebar's
  button (`.smp-stk-btn`) at the same spot, and the sticker layers and tools go above its z 9999.

---

## Uploaded pictures (covers, question and cheat-sheet images)

`js/media-store.js`. Program, snippet, notebook and Collection-wing covers, notebook question
pictures and cheat-sheet image blocks are kept in IndexedDB `ssp-media` (the disk-sized
allowance, beside the sticker pictures), not in the 5 MB localStorage saves. A saved field holds
`media:m<length>_<hash>`; the id is a hash of the bytes, so one picture used twice is stored once
and the same picture migrated on two devices gets the same id.
- **Draw every such field through `mediaSrc(value[, 'thumb'])`.** Non-references (old data: URLs,
  web addresses) pass through unchanged. `'thumb'` is the 640px copy kept for cards. Before the
  pictures are read at start it returns a tagged see-through pixel that `_mdPatch` fills in.
- **Uploads go through `mediaUpload(file)`** (scaled to 1600px, WebP; GIF/SVG kept as they are). It
  falls back to a small inline data: URL only where IndexedDB is refused.
- **Old inline pictures are moved by `mediaSweep`** about 4 s after start, and after any save whose
  JSON still contains `data:image/`. It only runs once every drawing file has set its name in
  `window.MEDIA_READERS` (`MEDIA_READER_FILES`). A new file that draws these fields must join that
  list. Fields are listed in `_mdSlots`. Cheat-sheet revision snapshots are JSON text, so it
  rewrites inside them too.
- **Rich text** (snippet description/comments, program and variant descriptions) saves
  `src="media:<id>"`. `sanitizeHTML` (utils.js) passes it through DOMPurify as a tagged pixel and
  swaps in the blob: URL after. The Quill editors load through `mediaHtml` and save through
  `mediaHtmlOut`. Quill's image sanitize is patched to allow blob:. Never turn description HTML into
  text with a detached `<div>`'s innerHTML: that loads every `<img>`. Use DOMParser.
- Export writes the pictures back in (`mediaInlineText`). Import moves them out before writing
  (`mediaAbsorbBackup`).
- **Cloud:** the library documents carry only references. After a cloud save, `mediaCloudPush` copies
  each picture the library uses to its own document, `users/<uid>/media/<id>` (1 MB each at most).
  After a cloud load, `mediaCloudPull` fetches the missing ones and `_mdPatch` fills them in.
  `ssp.media.cloud.<uid>` lists what is up there.
- Unused pictures: `mediaGc` runs once a day and deletes only those that no localStorage save mentions
  for 14 days running (signing out removes the cloud copy of the library from this device).
  `mediaGc({ now: true })` is Settings' **Clean up now** and Reset Data's clean-up. Signed in, the
  cloud copies of deleted pictures go too.

---

## Traps that have already cost time

**A text selection dragged out of a box fires `click` on the page.** Press in an input, drag to select,
let go outside: the browser sends `click` to the nearest element holding both ends (the backdrop, the
canvas, `body`), and every popup that closes on a click outside closed mid-selection. `js/utils.js`
(`_selDragField` / `_selDragIsNotClick`) stops that one click in the window's capture phase, before any
popup sees it: a press that began in an input, textarea, editable region or range slider with the main
button and ended outside it. Keyboard and script clicks (`detail` 0) always go through. So a new popup
that closes on `click` outside needs nothing of its own; one that closes on `pointerdown`/`mousedown`
outside never had the problem. Test: `node tools/test-drag-click.js .`

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
  call (a drawn `<svg>` keeps `data-lucide`). `js/utils.js` replaces it: only placeholders and icons
  whose `data-lucide` changed are drawn, each glyph built once by Lucide and cloned after (the same
  element Lucide makes). Scoping a call does nothing; do not rely on it.
- **A selector whose last part names no class, id or tag is tried on every element** of every page,
  on every restyle: `:is(.a, .b):active`, `:is(.x, .y) > :nth-child(2)`, `[id$="-x"] > *`,
  `html[data-motion="off"] *`, and a bare `::view-transition-old(...)` (write `html::view-...`).
  176 of them made a full restyle 2.5x slower (25 ms vs 10 ms on the Coding Library). Write the list
  out (`.a:active, .b:active`), key on a class rather than an attribute value, and measure a full
  restyle before and after. Infinite animations of anything but transform/opacity/filter restyle the
  page every frame; a stepped one is cheaper as a timer (see the tree row dither in tree-dnd.js).
- **The Coding Library tree draws a shut folder's rows only when it opens** (`_browseFillOpened`,
  `data-lazy` on the children box). Code that looks for a program's row must open its path first
  (`expandNodePath` + `renderBrowseTree`). The Folders view draws every row while it is on.
- **Every tree's shut folders are `content-visibility: hidden`** (`.tree-children.collapsed
  .tree-children-inner`, css/layout.css), switched at the END of the 0.7 s close. Nothing inside is
  styled or laid out until the folder opens; read layout only from rows in open folders.
- **Do not re-read the library from storage to be safe.** `loadData()` decompresses everything and,
  with a save still in its debounce, puts the older disk copy over newer memory. Visualize now asks
  `storeIsCurrent(key, raw)` (store-codec.js) and reloads only what another tab or a cloud load wrote.
- **A backdrop blur is redrawn every frame that anything under it changes.** One endless glow behind the
  Session Setup window took the Coding Library from 60 to ~22 fps; the stopwatch's 30 ms writes did the
  same to the Run Code window. `js/perf-freeze.js` pauses endless animations behind any full-screen blurred
  overlay (`PERF_FREEZE_SEL`; add a new overlay class there) and `perfFreezeActive()` tells fast painters to
  hold still. Page switches skip the View Transition (`snapshot: false`, router.js): its snapshot of the
  whole old screen dropped a frame on every switch (80-120 ms into an attempt); pages come in by their own
  entrances. **Where the browser composites without the GPU** (hardware acceleration off, GPU blocklisted
  or crashed) any motion under a blur re-blurs the screen on the CPU: Session Setup and Settings opened at
  ~18 fps, 60 without the blur. `js/glass.js` times the first blurred windows to open (`glassProbe`, from
  perf-freeze) and, if their frames are slow while the main thread is idle (long-animation-frame script +
  render time), sets `html.no-glass`, which drops every backdrop-filter (css/components.css), and
  remembers it (`ssp.glass.slow`). Headless Chromium draws in software
  too, so the probe is off under webdriver unless `ssp.glass.test` is set. Measure blur changes with
  `--disable-gpu-compositing` as well as with the GPU: GPU-only numbers hid this for three rounds.
  **Settings > Blur: Light / Off / Full**, Light the default (stored `ssp.glass` absent = `'auto'`): full-screen
  windows dim instead of frosting (`html.glass-lite`, the list in css/components.css — a new full-screen blurred
  window joins it AND `PERF_FREEZE_SEL`). The radius buys nothing: without the GPU Settings opened at 47-49 fps
  with blur(10px), (4px) or (2px), 60 with none. perf-freeze still pauses what is behind a window whose blur
  the setting dropped (`_pfBlurDropped`): covered, it cost ~5% of the GPU for nothing.
- **What actually cost the GPU** (new headless, `channel: 'chromium'`, gets the real GPU; Windows'
  `\GPU Engine(pid_<gpu process>*engtype_3D)\Running Time` counter gives its 3D time): an animated `filter` on
  the boss bar's tiny SVG crystal in its 3D context was 13 of an idle attempt's 15% (now a static glow); the
  starter fill's per-character `opacity`/`filter` spans (`Layerize` took a quarter of every frame: hide waiting
  characters by `visibility`); blur on letters in flight. Compositor-only loops (transform/opacity, var() in
  keyframes included) cost ~nothing — until anything restyles on the main thread (a toast, a timer write), and
  then every running animation is restyled with it, so keep the count of endless ones low. Custom properties
  written every frame on a container (the boss tilt's old `--mx/--my/--tx/--ty` on the whole bar) restyle and
  repaint everything under it that reads them: hovering the bar was 20% of the GPU, 7% now that the light moves
  by transform (`--gx/--gy` on the face only) and the slab shadows do not lean.
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

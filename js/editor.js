/* ============================================================
   EDITOR.JS — Custom Code Editor (Instant Visuals & Multi-field)
   ------------------------------------------------------------
   Every edit this file makes goes through edReplaceRange(), which uses
   document.execCommand('insertText'). That is deliberate and load-bearing:
   assigning `textarea.value` wipes the browser's native undo stack, so Ctrl+Z
   used to stop working the moment you pressed Tab, typed a bracket or let a
   line auto-indent. execCommand is the only cross-browser way to edit a
   textarea and keep undo/redo alive.
   ============================================================ */

const editorListeners = new WeakMap();
let syntaxDebounceTimer;

const ED_INDENT = '  ';

/**
 * Replace [from, to) with `text` while preserving the native undo stack.
 * @param {HTMLTextAreaElement} textarea
 * @param {number} from @param {number} to @param {string} text
 * @param {number|[number,number]} [caret] final caret, or [start,end] selection
 */
function edReplaceRange(textarea, from, to, text, caret) {
  textarea.focus();
  textarea.setSelectionRange(from, to);
  let ok = false;
  try {
    ok = text === ''
      ? document.execCommand('delete')
      : document.execCommand('insertText', false, text);
  } catch (e) {
    ok = false;
  }
  if (!ok) {
    // Engine without execCommand support — the edit still lands, but this one
    // step won't be undoable.
    const v = textarea.value;
    textarea.value = v.slice(0, from) + text + v.slice(to);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (Array.isArray(caret)) textarea.setSelectionRange(caret[0], caret[1]);
  else if (caret != null) textarea.setSelectionRange(caret, caret);
}

/** Expand a selection to whole lines. @returns {{start,end,text,lines}} */
function edLineSpan(textarea) {
  const v = textarea.value;
  const start = v.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
  let end = v.indexOf('\n', textarea.selectionEnd);
  if (end === -1) end = v.length;
  return { start, end, text: v.slice(start, end), lines: v.slice(start, end).split('\n') };
}

// ADDED: stateField parameter (defaults to 'code')
function setupSpecificEditor(textareaId, preId, codeId, isPracticeMode, stateField = 'code') {
  const textarea = document.getElementById(textareaId);
  const preCode = document.getElementById(codeId);
  const preContainer = document.getElementById(preId);

  if (!textarea || !preCode) return;

  if (editorListeners.has(textarea)) {
    const oldHandlers = editorListeners.get(textarea);
    textarea.removeEventListener('scroll', oldHandlers.scroll);
    textarea.removeEventListener('input', oldHandlers.input);
    textarea.removeEventListener('keydown', oldHandlers.keydown);
    if (oldHandlers.beforeinput) textarea.removeEventListener('beforeinput', oldHandlers.beforeinput);
    if (oldHandlers.caret) {
      textarea.removeEventListener('focus', oldHandlers.caret);
      textarea.removeEventListener('blur', oldHandlers.caret);
    }
  }

  const handlers = {
    scroll: () => {
      preContainer.scrollTop = textarea.scrollTop;
      preContainer.scrollLeft = textarea.scrollLeft;
      const gutter = document.getElementById('editor-line-numbers');
      if (gutter) gutter.scrollTop = textarea.scrollTop;
    },
    input: (e) => {
      // Slide fold anchors past this edit first — everything below reads the
      // reconstructed source, which depends on the anchors being current.
      if (isPracticeMode && typeof edFoldOnInput === 'function') edFoldOnInput(e.target);
      const newVal = e.target.value;
      // With a block collapsed the textarea holds only part of the file, so
      // state must be given the whole thing, never what happens to be on screen.
      const fullVal = (isPracticeMode && typeof edFullSource === 'function')
        ? edFullSource(e.target) : newVal;
      if (isPracticeMode) {
        if (typeof state !== 'undefined') state.userCode = fullVal;
      } else if (typeof adminState !== 'undefined' && adminState?.variants && typeof adminState.activeVariantIndex !== 'undefined') {
        adminState.variants[adminState.activeVariantIndex][stateField] = newVal;
      }
      preCode.innerHTML = syntaxHighlight(e.target.value) + '<br/>';
      if (isPracticeMode) updateLineNumbers(e.target);
    },
    keydown: (e) => {
      const { value, selectionStart, selectionEnd } = e.target;
      const bracketPairs = { '{': '}', '(': ')', '[': ']' };
      const mod = e.ctrlKey || e.metaKey;

      // ── Editing commands ─────────────────────────────────────
      if (mod && (e.key === '/' || e.code === 'Slash')) {
        e.preventDefault();
        edToggleComment(textarea);
        return;
      }
      if (mod && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        edDuplicateLines(textarea);
        return;
      }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        edMoveLines(textarea, e.key === 'ArrowUp' ? -1 : 1);
        return;
      }
      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        edOpenFind(textarea);
        return;
      }

      // Everything below is text entry. With Ctrl/Cmd held these are app
      // shortcuts (Ctrl+Enter = check, etc.) and must not also type a newline
      // or an auto-closed bracket into the file.
      if (mod || e.altKey) return;

      if (edTextEntry(textarea, e.key, e.shiftKey)) e.preventDefault();
    },

    /* The same behaviours again, for keyboards that will not say what was
       typed. An Android IME reports keydown with key "Unidentified" for every
       printable character, so a handler that switches on e.key does nothing
       there: no auto-closed bracket, no auto-indent, no de-indented brace.

       beforeinput does carry the character, in e.data, and is cancellable, so
       it can do the same edits. There is no double-handling to guard against:
       when the keydown path recognises a key it calls preventDefault, the
       character is never inserted, and beforeinput never fires for it. */
    beforeinput: (e) => {
      const t = e.target;
      let key = null;
      if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') key = 'Enter';
      else if (e.inputType === 'insertText' && e.data && e.data.length === 1) key = e.data;
      if (!key) return;
      if (edTextEntry(t, key, false)) e.preventDefault();
    },

    /* Focus and blur move no caret, so updateLineNumbers does not run for
       them — but the bracket highlight has to appear when the editor is
       focused and go when it is not, or it sits there pointing at a caret
       that is no longer in the file. */
    caret: () => { if (typeof edPaintBrackets === 'function') edPaintBrackets(textarea); }
  };

  textarea.addEventListener('scroll', handlers.scroll);
  textarea.addEventListener('input', handlers.input);
  textarea.addEventListener('keydown', handlers.keydown);
  textarea.addEventListener('beforeinput', handlers.beforeinput);
  if (isPracticeMode) {
    textarea.addEventListener('click', () => setTimeout(() => updateLineNumbers(textarea), 0));
    textarea.addEventListener('keyup', () => setTimeout(() => updateLineNumbers(textarea), 0));
    textarea.addEventListener('focus', handlers.caret);
    textarea.addEventListener('blur', handlers.caret);
  }
  editorListeners.set(textarea, handlers);
}

/* ============================================================
   LINE COMMANDS
   ============================================================ */

/** Ctrl+/ — comment or uncomment every line the selection touches. */
function edToggleComment(textarea) {
  const span = edLineSpan(textarea);
  const nonEmpty = span.lines.filter(l => l.trim() !== '');
  if (!nonEmpty.length) return;
  const allCommented = nonEmpty.every(l => l.trim().startsWith('//'));

  const out = span.lines.map(l => {
    if (l.trim() === '') return l;
    if (allCommented) return l.replace(/^(\s*)\/\/ ?/, '$1');
    const indent = l.match(/^\s*/)[0];
    return indent + '// ' + l.slice(indent.length);
  }).join('\n');

  edReplaceRange(textarea, span.start, span.end, out, [span.start, span.start + out.length]);
}

/** Ctrl+D — duplicate the current line (or every line in the selection). */
function edDuplicateLines(textarea) {
  const span = edLineSpan(textarea);
  const caretOffset = textarea.selectionStart - span.start;
  const out = span.text + '\n' + span.text;
  edReplaceRange(textarea, span.start, span.end, out,
    span.start + span.text.length + 1 + caretOffset);
}

/** Alt+↑ / Alt+↓ — move the current line (or selection) up or down. */
function edMoveLines(textarea, dir) {
  const v = textarea.value;
  const span = edLineSpan(textarea);
  const selOffStart = textarea.selectionStart - span.start;
  const selOffEnd = textarea.selectionEnd - span.start;

  if (dir < 0) {
    if (span.start === 0) return;
    const prevStart = v.lastIndexOf('\n', span.start - 2) + 1;
    const prevLine = v.slice(prevStart, span.start - 1);
    const out = span.text + '\n' + prevLine;
    edReplaceRange(textarea, prevStart, span.end, out,
      [prevStart + selOffStart, prevStart + selOffEnd]);
  } else {
    if (span.end >= v.length) return;
    let nextEnd = v.indexOf('\n', span.end + 1);
    if (nextEnd === -1) nextEnd = v.length;
    const nextLine = v.slice(span.end + 1, nextEnd);
    const out = nextLine + '\n' + span.text;
    const newStart = span.start + nextLine.length + 1;
    edReplaceRange(textarea, span.start, nextEnd, out,
      [newStart + selOffStart, newStart + selOffEnd]);
  }
}

/** Tab / Shift+Tab across a multi-line selection. */
function edIndentLines(textarea, dir) {
  const span = edLineSpan(textarea);
  const out = span.lines.map(l => {
    if (dir > 0) return ED_INDENT + l;
    return l.startsWith(ED_INDENT) ? l.slice(ED_INDENT.length) : l.replace(/^\s/, '');
  }).join('\n');
  edReplaceRange(textarea, span.start, span.end, out, [span.start, span.start + out.length]);
}

/* ============================================================
   EDITOR VIEW SETTINGS — font size + word wrap (persisted)
   ============================================================ */

const ED_FONT_MIN = 10, ED_FONT_MAX = 24, ED_FONT_DEFAULT = 14;

function edGetFontSize() {
  const n = parseInt(localStorage.getItem('editorFontSize'), 10);
  return n >= ED_FONT_MIN && n <= ED_FONT_MAX ? n : ED_FONT_DEFAULT;
}
function edGetWrap() { return localStorage.getItem('editorWordWrap') === '1'; }

/** Apply size + wrap to the textarea, the highlight layer and the gutter together
    — they're stacked, so any mismatch makes the syntax colouring drift. */
function applyEditorViewSettings() {
  const size = edGetFontSize();
  const wrap = edGetWrap();
  const ta = document.getElementById('editor-textarea');
  const pre = document.getElementById('editor-pre');
  const gutter = document.getElementById('editor-line-numbers');
  [ta, pre].forEach(el => {
    if (!el) return;
    el.style.fontSize = size + 'px';
    el.style.lineHeight = '1.5';
    el.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
    el.style.overflowWrap = wrap ? 'break-word' : 'normal';
  });
  if (gutter) { gutter.style.fontSize = size + 'px'; gutter.style.lineHeight = '1.5'; }
  const label = document.getElementById('ed-font-label');
  if (label) label.textContent = size;
  const wrapBtn = document.getElementById('ed-wrap-btn');
  if (wrapBtn) wrapBtn.classList.toggle('active', wrap);
  if (ta && typeof updateLineNumbers === 'function') updateLineNumbers(ta);
}

function edChangeFontSize(delta) {
  const next = Math.max(ED_FONT_MIN, Math.min(ED_FONT_MAX, edGetFontSize() + delta));
  localStorage.setItem('editorFontSize', String(next));
  applyEditorViewSettings();
}

function edToggleWrap() {
  localStorage.setItem('editorWordWrap', edGetWrap() ? '0' : '1');
  applyEditorViewSettings();
}

/**
 * The seam between two panes: drag to resize, or use the arrow that fades in on
 * hover to collapse the pane away / bring it back.
 *
 * The arrow lives on the divider rather than in the editor toolbar because that
 * is where the boundary actually is — you reach for the edge you want to move.
 *
 * @param {'left'|'right'} side which pane the arrow folds away
 */
function paneDividerTemplate(side) {
  const drag = side === 'left' ? 'initResizerDrag' : 'initPanelResizerDrag';
  return `
    <div class="resizer-divider" data-side="${side}" onmousedown="${drag}(event, this)">
      <button class="rz-collapse" id="rz-${side}-btn" type="button"
              onmousedown="event.stopPropagation()"
              onclick="togglePracticePane('${side}')"
              tabindex="-1" aria-hidden="true">
        <i data-lucide="chevron-${side}"></i>
      </button>
    </div>`;
}

/**
 * Toolbar that sits at the right of the file-tab bar.
 *
 * Scope: things that act on the TEXT in the editor — find, wrap, line numbers,
 * font size, zen. Collapsing a side pane moved onto that pane's own divider
 * (see paneDividerTemplate); controls that act on the whole attempt (boss bar,
 * cheat sheet, full screen) stay in the topbar with the timer and Run Code.
 */
function editorToolbarTemplate() {
  return `
    <div class="editor-tools" id="editor-tools">
      <button class="ed-tool" onclick="edOpenFind()" title="Find &amp; replace (Ctrl+F)" aria-label="Find and replace">
        <i data-lucide="search"></i>
      </button>
      <button class="ed-tool" id="ed-wrap-btn" onclick="edToggleWrap()" title="Toggle word wrap" aria-label="Toggle word wrap">
        <i data-lucide="wrap-text"></i>
      </button>
      <button class="ed-tool" id="line-numbers-toggle-btn" onclick="toggleLineNumbers()" title="Toggle line numbers" aria-label="Toggle line numbers">
        <i data-lucide="list-ordered"></i>
      </button>
      <span class="ed-tool-group" role="group" aria-label="Editor font size">
        <button class="ed-tool" onclick="edChangeFontSize(-1)" title="Smaller text" aria-label="Smaller text"><i data-lucide="minus"></i></button>
        <span class="ed-font-label" id="ed-font-label">14</span>
        <button class="ed-tool" onclick="edChangeFontSize(1)" title="Larger text" aria-label="Larger text"><i data-lucide="plus"></i></button>
      </span>
      <button class="ed-tool" id="ed-zen-btn" onclick="toggleZenMode()" title="Zen mode — editor only (Ctrl+\\)" aria-label="Zen mode">
        <i data-lucide="maximize-2"></i>
      </button>
    </div>`;
}

/* ============================================================
   FIND & REPLACE
   ============================================================ */

let _edFindMatches = [];
let _edFindIndex = -1;

function edOpenFind() {
  const area = document.querySelector('.practice-editor-area');
  const ta = document.getElementById('editor-textarea');
  if (!area || !ta) return;

  let bar = document.getElementById('ed-find-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'ed-find-bar';
    bar.className = 'ed-find-bar';
    bar.innerHTML = `
      <div class="ed-find-row">
        <i data-lucide="search" class="ed-find-ic"></i>
        <input id="ed-find-input" class="ed-find-input" placeholder="Find" spellcheck="false" autocomplete="off" />
        <span class="ed-find-count" id="ed-find-count">0/0</span>
        <button class="ed-tool" onclick="edFindStep(-1)" title="Previous (Shift+Enter)"><i data-lucide="chevron-up"></i></button>
        <button class="ed-tool" onclick="edFindStep(1)" title="Next (Enter)"><i data-lucide="chevron-down"></i></button>
        <button class="ed-tool" onclick="edCloseFind()" title="Close (Esc)"><i data-lucide="x"></i></button>
      </div>
      <div class="ed-find-row">
        <i data-lucide="replace" class="ed-find-ic"></i>
        <input id="ed-replace-input" class="ed-find-input" placeholder="Replace with" spellcheck="false" autocomplete="off" />
        <button class="btn btn-secondary btn-sm" onclick="edReplaceOne()">Replace</button>
        <button class="btn btn-secondary btn-sm" onclick="edReplaceAll()">All</button>
      </div>`;
    area.appendChild(bar);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: bar });

    const input = bar.querySelector('#ed-find-input');
    input.addEventListener('input', () => edRunFind());
    bar.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); edCloseFind(); }
      if (e.key === 'Enter') { e.preventDefault(); edFindStep(e.shiftKey ? -1 : 1); }
    });
  }

  bar.classList.add('open');
  const input = document.getElementById('ed-find-input');
  // Seed with the current selection, the way every other editor does.
  const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  if (sel && !sel.includes('\n')) input.value = sel;
  input.focus();
  input.select();
  edRunFind();
}

function edCloseFind() {
  const bar = document.getElementById('ed-find-bar');
  if (bar) bar.classList.remove('open');
  _edFindMatches = [];
  _edFindIndex = -1;
  const ta = document.getElementById('editor-textarea');
  if (ta) ta.focus();
}

function edRunFind(keepIndex) {
  const ta = document.getElementById('editor-textarea');
  const input = document.getElementById('ed-find-input');
  const count = document.getElementById('ed-find-count');
  if (!ta || !input) return;
  const needle = input.value;
  _edFindMatches = [];
  if (needle) {
    const hay = ta.value;
    let i = hay.indexOf(needle);
    while (i !== -1) { _edFindMatches.push(i); i = hay.indexOf(needle, i + Math.max(1, needle.length)); }
  }
  if (!keepIndex) _edFindIndex = _edFindMatches.length ? 0 : -1;
  else _edFindIndex = Math.min(_edFindIndex, _edFindMatches.length - 1);
  if (count) count.textContent = `${_edFindMatches.length ? _edFindIndex + 1 : 0}/${_edFindMatches.length}`;
  input.classList.toggle('no-match', !!needle && !_edFindMatches.length);
  if (_edFindIndex >= 0) edFocusMatch();
}

function edFocusMatch() {
  const ta = document.getElementById('editor-textarea');
  const input = document.getElementById('ed-find-input');
  if (!ta || !input || _edFindIndex < 0) return;
  const start = _edFindMatches[_edFindIndex];
  ta.setSelectionRange(start, start + input.value.length);
  // Scroll the hit into view without stealing focus from the find box.
  const before = ta.value.slice(0, start).split('\n').length;
  const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 21;
  ta.scrollTop = Math.max(0, (before - 4) * lineH);
  ta.dispatchEvent(new Event('scroll'));
}

function edFindStep(dir) {
  if (!_edFindMatches.length) return;
  _edFindIndex = (_edFindIndex + dir + _edFindMatches.length) % _edFindMatches.length;
  const count = document.getElementById('ed-find-count');
  if (count) count.textContent = `${_edFindIndex + 1}/${_edFindMatches.length}`;
  edFocusMatch();
}

function edReplaceOne() {
  const ta = document.getElementById('editor-textarea');
  const find = document.getElementById('ed-find-input');
  const rep = document.getElementById('ed-replace-input');
  if (!ta || !find || _edFindIndex < 0) return;
  const start = _edFindMatches[_edFindIndex];
  edReplaceRange(ta, start, start + find.value.length, rep.value, start + rep.value.length);
  edRunFind(true);
}

function edReplaceAll() {
  const ta = document.getElementById('editor-textarea');
  const find = document.getElementById('ed-find-input');
  const rep = document.getElementById('ed-replace-input');
  if (!ta || !find || !find.value || !_edFindMatches.length) return;
  const n = _edFindMatches.length;
  const next = ta.value.split(find.value).join(rep.value);
  edReplaceRange(ta, 0, ta.value.length, next, 0);
  edRunFind();
  if (typeof toast === 'function') toast(`Replaced ${n} occurrence${n !== 1 ? 's' : ''}.`, { type: 'success' });
}

/* ============================================================
   LINE NUMBERS
   ============================================================ */

function toggleLineNumbers() {
  const gutter = document.getElementById('editor-line-numbers');
  if (!gutter) return;
  const hidden = gutter.classList.toggle('gutter-hidden');
  localStorage.setItem('lineNumbersHidden', hidden ? '1' : '0');
  const btn = document.getElementById('line-numbers-toggle-btn');
  if (btn) btn.style.color = hidden ? 'var(--text-tertiary)' : 'var(--color-primary)';
}

function initLineNumbersState() {
  const gutter = document.getElementById('editor-line-numbers');
  if (!gutter) return;
  const hidden = localStorage.getItem('lineNumbersHidden') === '1';
  if (hidden) gutter.classList.add('gutter-hidden');
  const btn = document.getElementById('line-numbers-toggle-btn');
  if (btn) btn.style.color = hidden ? 'var(--text-tertiary)' : 'var(--color-primary)';
}

/* ── Line marks ────────────────────────────────────────────────
   The gutter equivalent of a VS Code breakpoint: click a line number to pin a
   cyan marker on it, click again to clear. Marks are per FILE — the key mixes
   the program/set, the problem and the filename — so switching tabs or problems
   swaps them instead of showing another file's markers.

   Marks are anchored to line NUMBERS, not to the text: inserting a line above a
   marked one does not drag the marker down with it. */

const ED_MARK_STORE = 'editorLineMarks';
const ED_MARK_MAX_FILES = 60;
let _edMarksCache = null;

function _edMarkStore() {
  if (_edMarksCache) return _edMarksCache;
  try {
    const raw = JSON.parse(localStorage.getItem(ED_MARK_STORE));
    _edMarksCache = (raw && typeof raw === 'object') ? raw : {};
  } catch (e) {
    _edMarksCache = {};
  }
  return _edMarksCache;
}

function _edMarkSave(keepKey) {
  const store = _edMarkStore();
  const keys = Object.keys(store);
  // Cap the store so a long history of files can't grow it without bound.
  for (let i = 0; keys.length - i > ED_MARK_MAX_FILES; i++) {
    if (keys[i] !== keepKey) delete store[keys[i]];
  }
  try { localStorage.setItem(ED_MARK_STORE, JSON.stringify(store)); }
  catch (e) { /* quota — the marks still work for this session */ }
}

/** Identity of the file currently in the editor. Both attempt pages point
    state.userFiles/activeFileIndex at the live file, so the tail is shared. */
function edMarkKey() {
  let file = '#';
  try {
    const f = (state.userFiles || [])[state.activeFileIndex || 0];
    if (f) file = (f.name || '') + (f.ext || '');
  } catch (e) { /* no attempt loaded */ }
  // _pset only exists once practice-set.js has run; typeof alone would throw
  // while it is still in its temporal dead zone.
  try {
    if (typeof _pset !== 'undefined' && _pset && _pset.set) {
      return 'set:' + _pset.set.id + ':' + _pset.current + ':' + file;
    }
  } catch (e) { /* not the practice-set page */ }
  try {
    if (state.activeChallenge && state.activeVariant) {
      return 'prog:' + state.activeChallenge.id + ':' + state.activeVariant.id + ':' + file;
    }
  } catch (e) { /* ignore */ }
  return 'anon:' + file;
}

function edGetMarks() {
  const arr = _edMarkStore()[edMarkKey()];
  return Array.isArray(arr) ? arr : [];
}

function edToggleMark(line) {
  const n = parseInt(line, 10);
  if (!(n > 0)) return;
  const store = _edMarkStore();
  const key = edMarkKey();
  const marks = new Set(Array.isArray(store[key]) ? store[key] : []);
  if (marks.has(n)) marks.delete(n); else marks.add(n);
  if (marks.size) store[key] = [...marks].sort((a, b) => a - b);
  else delete store[key];
  _edMarkSave(key);
  const ta = document.getElementById('editor-textarea');
  if (ta) updateLineNumbers(ta);
}

/**
 * A faint band behind each marked line, drawn inside the syntax layer so it
 * scrolls with the code. Skipped while word wrap is on: a wrapped line takes
 * more than one row, so "line number × line height" stops locating it.
 */
function _edPaintMarkBands(marks, lineCount) {
  const pre = document.getElementById('editor-pre');
  if (!pre) return;
  pre.querySelectorAll('.ed-mark-band').forEach(el => el.remove());
  if (!marks || !marks.size || edGetWrap()) return;
  const cs = getComputedStyle(pre);
  const lh = parseFloat(cs.lineHeight);
  const padTop = parseFloat(cs.paddingTop) || 0;
  if (!lh) return;
  const frag = document.createDocumentFragment();
  marks.forEach(n => {
    // Marks are stored against the real line; a collapsed block moves the row
    // it sits on, and a mark inside one has no row at all.
    const row = (typeof edRealToView === 'function') ? edRealToView(n) : n;
    if (!row || row > lineCount) return;
    const band = document.createElement('div');
    band.className = 'ed-mark-band';
    band.style.top = (padTop + (row - 1) * lh) + 'px';
    band.style.height = lh + 'px';
    frag.appendChild(band);
  });
  pre.insertBefore(frag, pre.firstChild);
}

/* The gutter is rebuilt from scratch on every keystroke, so a mark's entry
   animation replayed on each one and the triangles appeared to blink while you
   typed. Only a line that was NOT marked on the previous paint of this same
   file gets the animation. */
let _edMarkAnimSeen = { key: null, lines: null };

function updateLineNumbers(textarea) {
  const gutter = document.getElementById('editor-line-numbers');
  if (!gutter || !textarea) return;
  const lineCount = (textarea.value.match(/\n/g) || []).length + 1;
  const cursorPos = textarea.selectionStart;
  const activeLine = textarea.value.substring(0, cursorPos).split('\n').length;
  const marks = new Set(edGetMarks());

  // Switching file/problem is not "a mark was just placed" — treat everything
  // already there as seen, so a file that opens with marks doesn't animate them.
  const key = edMarkKey();
  const seen = _edMarkAnimSeen.key === key && _edMarkAnimSeen.lines ? _edMarkAnimSeen.lines : marks;
  _edMarkAnimSeen = { key, lines: new Set(marks) };

  // With a block collapsed the row on screen is no longer the line in the file,
  // so the gutter prints the REAL number (as VS Code does) and carries the view
  // row alongside it for the fold chevron.
  const folding = typeof edFoldMarkers === 'function';
  const foldMap = folding ? edFoldMarkers(textarea.value) : {};
  const realOf = folding ? edViewToReal : (v) => v;
  let html = '';
  let foldCount = 0;
  for (let i = 1; i <= lineCount; i++) {
    const real = realOf(i);
    const marked = marks.has(real);
    const fresh = marked && !seen.has(real);
    const fold = foldMap[i];
    if (fold) foldCount++;
    // Three partitions, each its own box: marker | number | fold. They used to
    // be one text node with two absolutely-positioned children sitting on top
    // of it, which is why the chevron landed on the digits.
    html += `<span class="line-num${i === activeLine ? ' active' : ''}${marked ? ' marked' : ''}${fold === 'folded' ? ' folded' : ''}" data-line="${real}" data-view="${i}">` +
            `<span class="ln-mark-col">${marked ? `<span class="line-mark${fresh ? ' just-added' : ''}" aria-hidden="true"></span>` : ''}</span>` +
            `<span class="ln-no">${real}</span>` +
            `<span class="ln-fold-col">${fold ? `<button class="line-fold${fold === 'folded' ? ' closed' : ''}" data-fold="${i}" tabindex="-1" aria-label="${fold === 'folded' ? 'Expand' : 'Collapse'} block" title="${fold === 'folded' ? 'Expand this block' : 'Collapse this block'}"></button>` : ''}</span>` +
            `</span>`;
  }
  gutter.innerHTML = html;
  // Only a marked file pays for the marker column (see .has-marks).
  gutter.classList.toggle('has-marks', marks.size > 0);
  gutter.classList.toggle('has-folds', foldCount > 0);
  // A file that CAN fold is not the same as one that IS folded: only a live
  // fold keeps the third partition open after the pointer leaves.
  gutter.classList.toggle('has-folded', Object.keys(foldMap).some(k => foldMap[k] === 'folded'));
  gutter.scrollTop = textarea.scrollTop;
  // Delegated, and attached once — the rows above are rebuilt on every keystroke.
  if (!gutter._markClick) {
    gutter._markClick = (e) => {
      const chevron = e.target.closest && e.target.closest('.line-fold');
      if (chevron) {
        e.stopPropagation();
        if (typeof edToggleFold === 'function') edToggleFold(chevron.dataset.fold);
        return;
      }
      const row = e.target.closest && e.target.closest('.line-num');
      if (row && row.dataset.line) edToggleMark(row.dataset.line);
    };
    gutter.addEventListener('click', gutter._markClick);
  }
  _edPaintMarkBands(marks, lineCount);
  if (typeof edFoldPaintBadges === 'function') edFoldPaintBadges(textarea);
  // Repainted from here rather than from a listener of its own: this already
  // runs on input, on click and on keyup, which is every way the caret moves.
  if (typeof edPaintBrackets === 'function') edPaintBrackets(textarea);
}

/**
 * Where character `idx` of the editor is actually drawn, as offsets from
 * #editor-pre's padding box -- the coordinates every overlay in here uses.
 *
 * Measured with a Range over the rendered text rather than by measuring a copy
 * of the line in a hidden span. The two disagree: the probe carried the <pre>'s
 * font, while the text is drawn inside <code> in tokens that are not all the
 * same weight, so the error grew by about a pixel per column and had an overlay
 * a whole character out of place by the middle of a line.
 *
 * @returns {{left:number, top:number, right:number, height:number}|null}
 */
function edCharRect(idx) {
  const pre = document.getElementById('editor-pre');
  const code = document.getElementById('editor-code');
  if (!pre || !code || !(idx >= 0)) return null;
  const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let seen = 0, n;
  while ((n = walk.nextNode())) {
    const len = n.nodeValue.length;
    if (seen + len > idx) {
      const r = document.createRange();
      r.setStart(n, idx - seen);
      r.setEnd(n, idx - seen + 1);
      const b = r.getBoundingClientRect();
      const p = pre.getBoundingClientRect();
      const cs = getComputedStyle(pre);
      // Absolute children are placed from the padding box, which starts inside
      // the border; the rect above is measured from outside it.
      const bx = parseFloat(cs.borderLeftWidth) || 0;
      const by = parseFloat(cs.borderTopWidth) || 0;
      return { left: b.left - p.left - bx + pre.scrollLeft,
               right: b.right - p.left - bx + pre.scrollLeft,
               top: b.top - p.top - by + pre.scrollTop,
               height: b.height };
    }
    seen += len;
  }
  return null;
}

/** Legacy whole-value setter, kept for the admin forms that still call it. */
function updateVal(newVal, cursorOffset, textarea, preCode, isPracticeMode, stateField) {
  edReplaceRange(textarea, 0, textarea.value.length, newVal, cursorOffset);
  if (isPracticeMode) {
    if (typeof state !== 'undefined') state.userCode = newVal;
  } else if (typeof adminState !== 'undefined' && adminState?.variants && typeof adminState.activeVariantIndex !== 'undefined') {
    adminState.variants[adminState.activeVariantIndex][stateField] = newVal;
  }
  if (preCode) preCode.innerHTML = syntaxHighlight(newVal) + '<br/>';
}

/* ============================================================
   THE TEXT-ENTRY BEHAVIOURS
   ------------------------------------------------------------
   Auto-closing a bracket, wrapping a selection in quotes, indenting after an
   opening brace, pulling a closing brace back out — everything the editor
   does in response to one character being typed.

   Lifted out of the keydown handler so that beforeinput can run exactly the
   same code. They were only ever reachable through e.key, which an Android
   keyboard does not fill in, so none of this worked on a phone: you got a
   bare "(" with no ")", and Enter left the caret at column zero.

   @param   {HTMLTextAreaElement} textarea
   @param   {string} key    the character being inserted, or 'Enter' / 'Tab'
   @param   {boolean} shiftKey
   @returns {boolean} true when the insertion was handled and the caller
            should cancel the default one
   ============================================================ */
function edTextEntry(textarea, key, shiftKey) {
  if (!textarea || !key) return false;
  const value = textarea.value;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const bracketPairs = { '{': '}', '(': ')', '[': ']' };

  if (key === 'Tab') {
    const multiline = value.slice(selectionStart, selectionEnd).includes('\n');
    if (multiline || shiftKey) {
      edIndentLines(textarea, shiftKey ? -1 : 1);
    } else {
      edReplaceRange(textarea, selectionStart, selectionEnd, ED_INDENT, selectionStart + ED_INDENT.length);
    }
    return true;
  }

  if (bracketPairs[key]) {
    edReplaceRange(textarea, selectionStart, selectionEnd, key + bracketPairs[key], selectionStart + 1);
    return true;
  }

  if (key === '"' || key === "'" || key === '`') {
    const selected = value.substring(selectionStart, selectionEnd);
    const caret = selected.length === 0 ? selectionStart + 1 : selectionStart + 1 + selected.length;
    edReplaceRange(textarea, selectionStart, selectionEnd, key + selected + key, caret);
    return true;
  }

  if (key === 'Enter') {
    const textBefore = value.substring(0, selectionStart);
    const textAfter = value.substring(selectionEnd);
    const linesBeforeCursor = textBefore.split('\n');
    const currentLine = linesBeforeCursor[linesBeforeCursor.length - 1];
    const indentMatch = currentLine.match(/^\s*/);
    let indent = indentMatch ? indentMatch[0] : '';

    // Between a pair: the closing half goes to its own line and the caret
    // lands on the blank one between them.
    if ((textBefore.endsWith('{') && textAfter.startsWith('}')) ||
        (textBefore.endsWith('[') && textAfter.startsWith(']'))) {
      const innerIndent = indent + ED_INDENT;
      edReplaceRange(textarea, selectionStart, selectionEnd,
        '\n' + innerIndent + '\n' + indent, selectionStart + 1 + innerIndent.length);
      return true;
    }

    if (currentLine.trim().endsWith('{') || currentLine.trim().endsWith('[')) indent += ED_INDENT;
    edReplaceRange(textarea, selectionStart, selectionEnd, '\n' + indent, selectionStart + 1 + indent.length);
    return true;
  }

  if (key === '}' || key === ']') {
    const linesBeforeCursor = value.substring(0, selectionStart).split('\n');
    const currentLine = linesBeforeCursor[linesBeforeCursor.length - 1];
    // Only pull back when the brace is the first thing on its line; typing one
    // mid-expression must not reindent the line under it.
    if (currentLine.trim() === '' && currentLine.length > 0) {
      const lineStart = selectionStart - currentLine.length;
      const newIndent = currentLine.length >= ED_INDENT.length ? currentLine.slice(0, -ED_INDENT.length) : '';
      edReplaceRange(textarea, lineStart, selectionEnd, newIndent + key, lineStart + newIndent.length + 1);
      return true;
    }
  }

  return false;
}

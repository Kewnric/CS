/* ============================================================
   SAMPLE EDITOR — formatting you can see
   ------------------------------------------------------------
   A sample body is not prose and never became rich text: `Run this` feeds
   the Input: block straight to the program, so the sample text has to stay
   the characters the program will read — only those. Formatting is stored
   beside it as runs over those characters (see sampleModel in utils.js).

   There WAS a notation for writing formatting into the text by hand,
   `[[gold:7]]`. It is withdrawn: the toolbar is how formatting is applied,
   nothing writes tokens any more, and a sample whose output legitimately
   contains `[[x:y]]` now keeps those characters instead of losing them.
   Old content is still read (sampleParseTokens) and is rewritten into the
   new shape the first time it is saved.

   HOW IT WORKS. The text is held as characters plus, per character, the
   style words that apply to it — the ordinary way to model formatted text,
   and the reason overlapping, partial and repeated formatting all behave.

       stored {content, fmt}  ──sampleModel──▶  {text, attrs}  ──▶  DOM
       stored {content, fmt}  ◀──────────────  {text, attrs}  ◀──  DOM

   Typing edits the DOM; every input reads it back to the model, redraws,
   and puts the caret where it was. Section colouring (Input:/Output:) is
   derived from the line each time rather than stored, so it follows what
   you type and can never be saved into the sample by accident.
   ============================================================ */

/* The palette, as swatches. Named CSS colours: they are stored as words, so
   a saved sample still reads as itself if anyone ever looks at the data. */
const SAMPLE_FMT_COLORS = [
  ['tomato', 'Red'],
  ['orange', 'Orange'],
  ['gold', 'Yellow'],
  ['mediumseagreen', 'Green'],
  ['deepskyblue', 'Blue'],
  ['mediumpurple', 'Purple'],
  ['lightgray', 'Grey'],
  ['white', 'White']
];

/** Every mark the toolbar can apply, in the order the buttons sit. */
const SAMPLE_FMT_MARKS = [
  ['b', 'bold', 'Bold'],
  ['i', 'italic', 'Italic'],
  ['u', 'underline', 'Underline'],
  ['s', 'strikethrough', 'Strikethrough']
];

const _STB_NL = String.fromCharCode(10);

/* ── The model ───────────────────────────────────────────── */

function _stbIsMark(w) { return SAMPLE_FMT_MARKS.some(m => m[0] === w); }
function _stbIsBg(w) { return String(w).slice(0, 3) === 'bg-'; }

/** One colour, one highlight, any marks — a character cannot be two colours. */
function _stbNormWords(words) {
  const marks = [], out = [];
  let color = '', bg = '';
  (words || []).forEach(w => {
    if (!w) return;
    if (_stbIsMark(w)) { if (marks.indexOf(w) === -1) marks.push(w); }
    else if (_stbIsBg(w)) bg = w;
    else color = w;
  });
  SAMPLE_FMT_MARKS.forEach(m => { if (marks.indexOf(m[0]) !== -1) out.push(m[0]); });
  if (color) out.push(color);
  if (bg) out.push(bg);
  return out;
}

/* ── Drawing the editor ──────────────────────────────────── */

function _stbEsc(s) {
  return typeof escapeHTML === 'function' ? escapeHTML(s)
    : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The editable DOM for one sample: a line per line, coloured as the card is. */
function sampleRenderEditor(text, attrs) {
  const lines = String(text == null ? '' : text).split(_STB_NL);
  let at = 0;
  let section = '';
  return lines.map(line => {
    const start = at;
    at += line.length + 1;             // + the newline that followed it
    if (!line.length) return '<div class="stb-line"><br></div>';

    const own = line.match(SAMPLE_OWN_LINE);
    if (own) {
      section = sampleSectionOf(own[2]);
      return '<div class="stb-line"><span class="sample-label">'
           + sampleRunsHTML(text, attrs, start, start + line.length, true) + '</span></div>';
    }
    const named = line.match(SAMPLE_NAMED);
    if (named) {
      section = sampleSectionOf(named[2]);
      const cut = start + named[0].length;
      const head = '<span class="sample-label">' + sampleRunsHTML(text, attrs, start, cut, true) + '</span>';
      const rest = sampleRunsHTML(text, attrs, cut, start + line.length, true);
      const tail = line.slice(named[0].length).trim()
        ? (section ? '<span class="sample-' + section + '">' + rest + '</span>' : rest)
        : rest;
      return '<div class="stb-line">' + head + tail + '</div>';
    }
    const runs = sampleRunsHTML(text, attrs, start, start + line.length, true);
    return '<div class="stb-line">'
         + (line.trim() && section ? '<span class="sample-' + section + '">' + runs + '</span>' : runs)
         + '</div>';
  }).join('');
}

/* ── Reading the editor back ─────────────────────────────── */

/** The style words in force at a node — the nearest data-fmt ancestor wins. */
function _stbWordsAt(node, root) {
  let el = node.nodeType === 3 ? node.parentNode : node;
  while (el && el !== root) {
    if (el.getAttribute && el.getAttribute('data-fmt')) {
      return _stbNormWords(el.getAttribute('data-fmt').split(/\s+/).filter(Boolean));
    }
    el = el.parentNode;
  }
  return [];
}

/**
 * DOM → model. Each block child is a line; a block's trailing <br> is filler.
 *
 * Text sitting at the top level, between or beside those blocks, counts too.
 * Reading only element children dropped it silently — the browser can leave a
 * bare text node there while editing, and text typed into it simply vanished.
 */
function sampleReadEditor(root) {
  const chars = [], attrs = [];
  const kids = Array.prototype.slice.call(root.childNodes)
    .filter(n => n.nodeType !== 3 || n.nodeValue !== '');
  const lines = kids.length ? kids : [root];

  let first = true;
  lines.forEach((line) => {
    const isBlock = line.nodeType === 1 && (line.nodeName === 'DIV' || line.nodeName === 'P');
    if (isBlock && !first) { chars.push(_STB_NL); attrs.push([]); }
    first = false;
    if (line.nodeType === 3) {
      const w = _stbWordsAt(line, root);
      for (let k = 0; k < line.nodeValue.length; k++) { chars.push(line.nodeValue[k]); attrs.push(w); }
      return;
    }
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT + NodeFilter.SHOW_ELEMENT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) {
        const w = _stbWordsAt(n, root);
        for (let k = 0; k < n.nodeValue.length; k++) { chars.push(n.nodeValue[k]); attrs.push(w); }
      } else if (n.nodeName === 'BR' && n.nextSibling) {
        // A <br> that ends its block is the browser's filler, not a line break.
        chars.push(_STB_NL); attrs.push([]);
      }
    }
  });
  return { text: chars.join(''), attrs: attrs };
}

/* ── The caret, across a redraw ──────────────────────────── */

function _stbFragText(node) {
  let out = '';
  Array.prototype.forEach.call(node.childNodes, (ch) => {
    if (ch.nodeType === 3) { out += ch.nodeValue; return; }
    if (ch.nodeName === 'BR') { out += _STB_NL; return; }
    const block = ch.nodeName === 'DIV' || ch.nodeName === 'P';
    if (block && out && out.slice(-1) !== _STB_NL) out += _STB_NL;
    out += _stbFragText(ch);
  });
  return out;
}

/** How many characters of the model sit before the caret. */
function _stbCaretOffset(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const live = sel.getRangeAt(0);
  if (!root.contains(live.startContainer)) return null;
  const r = document.createRange();
  r.selectNodeContents(root);
  r.setEnd(live.startContainer, live.startOffset);
  return _stbFragText(r.cloneContents()).length;
}

/** Put the caret back that many characters in. */
function _stbSetCaret(root, offset) {
  if (offset == null) return;
  let left = offset;
  const lines = Array.prototype.slice.call(root.children);
  for (let li = 0; li < lines.length; li++) {
    if (li) {
      if (left === 0) { _stbCaretInto(lines[li], 0); return; }
      left -= 1;
    }
    const walker = document.createTreeWalker(lines[li], NodeFilter.SHOW_TEXT, null);
    let n, last = null;
    while ((n = walker.nextNode())) {
      if (left <= n.nodeValue.length) {
        const r = document.createRange();
        r.setStart(n, left);
        r.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        return;
      }
      left -= n.nodeValue.length;
      last = n;
    }
    if (left === 0 && li === lines.length - 1) { _stbCaretInto(lines[li], last ? -1 : 0); return; }
  }
  _stbCaretInto(root, -1);
}

function _stbCaretInto(el, where) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(where === 0);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}

/** The selected span of the model, as character offsets. */
function _stbSelection(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const live = sel.getRangeAt(0);
  if (!root.contains(live.startContainer) || !root.contains(live.endContainer)) return null;
  const a = document.createRange();
  a.selectNodeContents(root);
  a.setEnd(live.startContainer, live.startOffset);
  const b = document.createRange();
  b.selectNodeContents(root);
  b.setEnd(live.endContainer, live.endOffset);
  const start = _stbFragText(a.cloneContents()).length;
  const end = _stbFragText(b.cloneContents()).length;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function _stbSelectRange(root, start, end) {
  _stbSetCaret(root, start);
  if (end === start) return;
  const sel = window.getSelection();
  const from = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  _stbSetCaret(root, end);
  if (!from || !sel.rangeCount) return;
  const to = sel.getRangeAt(0);
  const r = document.createRange();
  r.setStart(from.startContainer, from.startOffset);
  r.setEnd(to.startContainer, to.startOffset);
  sel.removeAllRanges();
  sel.addRange(r);
}

/* ── The element ─────────────────────────────────────────── */

/** Markup for one sample field: toolbar above, editable body below. */
function sampleFieldHTML(id, sample) {
  const m = sampleModel(sample);
  return sampleToolbarHTML(id)
    + '<div class="stb-field"><div class="stb-editor' + (m.text ? '' : ' is-empty') + '" id="' + id + '" '
    + 'contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" '
    + 'data-placeholder="Sample content…">'
    + sampleRenderEditor(m.text, m.attrs)
    + '</div></div>';
}

/**
 * Draw a state, and remember the one it replaced so it can be undone.
 *
 * Everything that changes the editor goes through here, which is what makes
 * undo possible at all: redrawing from the model on every keystroke throws
 * the browser's own undo stack away, so the editor has to keep its own.
 * Consecutive typing coalesces into one step — undo should take back a word,
 * not a letter.
 */
function _stbPaint(el, text, attrs, opts) {
  const o = opts || {};
  if (!o.silent) {
    const now = Date.now();
    const coalescing = o.coalesce && el._stbUndoAt && (now - el._stbUndoAt) < 700;
    if (!coalescing && el._stbText != null) {
      el._stbUndo = el._stbUndo || [];
      el._stbUndo.push({ text: el._stbText, attrs: el._stbAttrs, caret: el._stbCaret });
      if (el._stbUndo.length > 120) el._stbUndo.shift();
      el._stbRedo = [];
    }
    el._stbUndoAt = now;
  }
  el._stbText = text;
  el._stbAttrs = attrs;
  el.innerHTML = sampleRenderEditor(text, attrs);
  el.classList.toggle('is-empty', !text);
}

/** Step back, or forward again. */
function _stbHistory(el, redo) {
  const from = redo ? el._stbRedo : el._stbUndo;
  if (!from || !from.length) return false;
  const to = redo ? (el._stbUndo = el._stbUndo || []) : (el._stbRedo = el._stbRedo || []);
  to.push({ text: el._stbText, attrs: el._stbAttrs, caret: _stbCaretOffset(el) });
  const state = from.pop();
  _stbPaint(el, state.text, state.attrs, { silent: true });
  _stbSetCaret(el, state.caret == null ? state.text.length : state.caret);
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function _stbEl(idOrEl) {
  return typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
}

/** What to store: the sample text, and the formatting beside it. */
function sampleEditorValue(idOrEl) {
  const el = _stbEl(idOrEl);
  if (!el) return { content: '', fmt: [] };
  const m = sampleReadEditor(el);
  return { content: m.text, fmt: sampleRunsFromAttrs(m.attrs) };
}

/**
 * Load a stored sample into the editor.
 *
 * This starts a new history rather than adding to the old one: a different
 * sample is a different document, and undo should not walk back into the
 * text of the one before it.
 */
function sampleEditorSetValue(idOrEl, sample) {
  const el = _stbEl(idOrEl);
  if (!el) return;
  const m = sampleModel(sample);
  _stbPaint(el, m.text, m.attrs, { silent: true });
  el._stbUndo = [];
  el._stbRedo = [];
  el._stbUndoAt = 0;
}

/* Redraw from the model after every change, so section colouring follows what
   is typed. The caret is measured before and restored after, in characters, so
   it lands where it was rather than where the old nodes were. */
function _stbRefresh(el, keepSelection) {
  const sel = keepSelection ? _stbSelection(el) : null;
  const caret = sel ? null : _stbCaretOffset(el);
  const m = sampleReadEditor(el);
  el._stbCaret = caret;
  _stbPaint(el, m.text, m.attrs, { coalesce: true });
  if (sel) _stbSelectRange(el, sel.start, sel.end);
  else _stbSetCaret(el, caret);
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return m;
}

/** Wire one editor. Safe to call again on the same element. */
function sampleEditorAttach(idOrEl) {
  const el = _stbEl(idOrEl);
  if (!el || el._stbReady) return;
  el._stbReady = true;
  const start = sampleReadEditor(el);
  el._stbText = start.text;
  el._stbAttrs = start.attrs;
  el._stbUndo = [];
  el._stbRedo = [];
  el.classList.toggle('is-empty', !start.text);

  let composing = false;
  el.addEventListener('compositionstart', () => { composing = true; });
  el.addEventListener('compositionend', () => { composing = false; _stbRefresh(el); });
  el.addEventListener('input', () => { if (!composing) _stbRefresh(el); });

  /* The browser cannot undo for us — the redraw replaces its DOM every time
     — so the editor answers these itself. */
  el.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;
    const redo = e.key.toLowerCase() === 'y' || e.shiftKey;
    if (_stbHistory(el, redo)) e.preventDefault();
  });

  // Plain text only: pasted markup would arrive with styles this cannot read
  // back, and the sample would look one way and store another.
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    _stbInsertText(el, text);
  });
}

/** Attach every sample editor under `root` that is not wired yet. */
function sampleSyncEditors(root) {
  const scope = root || document;
  const list = scope.querySelectorAll ? scope.querySelectorAll('.stb-editor') : [];
  Array.prototype.forEach.call(list, sampleEditorAttach);
}

function _stbInsertText(el, text) {
  const sel = _stbSelection(el);
  const m = sampleReadEditor(el);
  const at = sel || { start: m.text.length, end: m.text.length };
  const before = m.text.slice(0, at.start), after = m.text.slice(at.end);
  const attrsAt = m.attrs[at.start] || [];
  const inserted = String(text).replace(/\r\n?/g, _STB_NL);
  const attrs = m.attrs.slice(0, at.start)
    .concat(inserted.split('').map(c => (c === _STB_NL ? [] : attrsAt)))
    .concat(m.attrs.slice(at.end));
  _stbPaint(el, before + inserted + after, attrs);
  _stbSetCaret(el, at.start + inserted.length);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/* ── The toolbar ─────────────────────────────────────────── */

/**
 * The toolbar's markup, bound to one editor by id.
 * Every control cancels mousedown so the editor keeps focus: a contenteditable
 * loses its selection the moment something else takes focus, and the selection
 * is the thing being formatted.
 */
function sampleToolbarHTML(targetId) {
  const t = String(targetId);
  const marks = SAMPLE_FMT_MARKS.map(([key, icon, label]) => `
    <button type="button" class="stb-btn" data-mark="${key}" title="${label}" aria-label="${label}"
            aria-pressed="false"
            onmousedown="event.preventDefault()" onclick="sampleFmtMark('${t}', '${key}')">
      <i data-lucide="${icon}"></i>
    </button>`).join('');

  /* The way back off is a labelled row, not a ninth tile. As a dark square
     among eight colours it read as another colour and people could not find
     the way to remove one. */
  const swatches = (bg) => `
        <span class="stb-grid">${SAMPLE_FMT_COLORS.map(([v, label]) => `
          <button type="button" class="stb-swatch" title="${label}" aria-label="${label}"
                  style="background:${v}" onmousedown="event.preventDefault()"
                  onclick="sampleFmtColor('${t}', '${v}', ${bg})"></button>`).join('')}</span>
        <button type="button" class="stb-clear-row" onmousedown="event.preventDefault()"
                onclick="sampleFmtColor('${t}', '', ${bg})">
          <i data-lucide="ban"></i> ${bg ? 'No highlight' : 'No colour'}
        </button>`;

  return `
    <div class="sample-toolbar" data-target="${t}">
      ${marks}
      <span class="stb-div" aria-hidden="true"></span>
      <span class="stb-pick">
        <button type="button" class="stb-btn" title="Text colour" aria-label="Text colour"
                onmousedown="event.preventDefault()" onclick="sampleFmtOpenPalette(this)">
          <i data-lucide="baseline"></i>
        </button>
        <span class="stb-palette">${swatches(false)}</span>
      </span>
      <span class="stb-pick">
        <button type="button" class="stb-btn" title="Highlight" aria-label="Highlight"
                onmousedown="event.preventDefault()" onclick="sampleFmtOpenPalette(this)">
          <i data-lucide="highlighter"></i>
        </button>
        <span class="stb-palette">${swatches(true)}</span>
      </span>
      <span class="stb-div" aria-hidden="true"></span>
      <button type="button" class="stb-btn stb-text" title="Start an Input: section"
              onmousedown="event.preventDefault()" onclick="sampleFmtSection('${t}', 'Input')">Input:</button>
      <button type="button" class="stb-btn stb-text" title="Start an Output: section"
              onmousedown="event.preventDefault()" onclick="sampleFmtSection('${t}', 'Output')">Output:</button>
      <span class="stb-div" aria-hidden="true"></span>
      <button type="button" class="stb-btn" title="Remove formatting" aria-label="Remove formatting"
              onmousedown="event.preventDefault()" onclick="sampleFmtClear('${t}')">
        <i data-lucide="remove-formatting"></i>
      </button>
    </div>`;
}

/* Which marks are on where the caret is. Without this the only way to learn
   that a button toggles was to press it twice and watch. */
function sampleSyncToolbar(el) {
  const bar = document.querySelector('.sample-toolbar[data-target="' + el.id + '"]');
  if (!bar) return;
  const m = sampleReadEditor(el);
  const r = _stbRange(el, m);
  const on = {};
  SAMPLE_FMT_MARKS.forEach(([w]) => { on[w] = r.end > r.start; });
  for (let i = r.start; i < r.end; i++) {
    if (m.text[i] === _STB_NL) continue;
    const words = m.attrs[i] || [];
    SAMPLE_FMT_MARKS.forEach(([w]) => { if (words.indexOf(w) === -1) on[w] = false; });
  }
  bar.querySelectorAll('.stb-btn[data-mark]').forEach((b) => {
    const active = !!on[b.getAttribute('data-mark')];
    b.classList.toggle('is-on', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  let node = sel.getRangeAt(0).startContainer;
  node = node.nodeType === 3 ? node.parentNode : node;
  const el = node && node.closest ? node.closest('.stb-editor') : null;
  if (el) sampleSyncToolbar(el);
});

/** Open one palette, closing any other. */
window.sampleFmtOpenPalette = function (btn) {
  const pick = btn.parentNode;
  const open = pick.classList.contains('is-open');
  document.querySelectorAll('.stb-pick.is-open').forEach(p => p.classList.remove('is-open'));
  if (!open) pick.classList.add('is-open');
};

document.addEventListener('mousedown', (e) => {
  if (e.target.closest && e.target.closest('.stb-pick')) return;
  document.querySelectorAll('.stb-pick.is-open').forEach(p => p.classList.remove('is-open'));
});

/* ── Applying a format ───────────────────────────────────── */

/* With nothing selected the whole line is used: a sample is written a line at
   a time, and formatting nothing at all would just look broken. */
function _stbRange(el, m) {
  const sel = _stbSelection(el);
  if (sel && sel.end > sel.start) return sel;
  const at = sel ? sel.start : m.text.length;
  const from = m.text.lastIndexOf(_STB_NL, Math.max(0, at - 1)) + 1;
  const nl = m.text.indexOf(_STB_NL, at);
  return { start: from, end: nl === -1 ? m.text.length : nl };
}

function _stbApply(targetId, change) {
  const el = _stbEl(targetId);
  if (!el) return;
  const m = sampleReadEditor(el);
  const r = _stbRange(el, m);
  if (r.end <= r.start) return;

  const attrs = m.attrs.slice();
  for (let i = r.start; i < r.end; i++) {
    if (m.text[i] === _STB_NL) continue;
    attrs[i] = _stbNormWords(change(attrs[i] || []));
  }
  _stbPaint(el, m.text, attrs);
  _stbSelectRange(el, r.start, r.end);
  el.focus();
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Bold / italic / underline / strike — off again if the whole run has it. */
window.sampleFmtMark = function (targetId, word) {
  const el = _stbEl(targetId);
  if (!el) return;
  const m = sampleReadEditor(el);
  const r = _stbRange(el, m);
  let on = true;
  for (let i = r.start; i < r.end; i++) {
    if (m.text[i] === _STB_NL) continue;
    if ((m.attrs[i] || []).indexOf(word) === -1) { on = false; break; }
  }
  _stbApply(targetId, (words) => (on
    ? words.filter(w => w !== word)
    : words.concat([word])));
};

/** A colour, or the highlight behind it. An empty value clears that one. */
window.sampleFmtColor = function (targetId, color, isBackground) {
  document.querySelectorAll('.stb-pick.is-open').forEach(p => p.classList.remove('is-open'));
  _stbApply(targetId, (words) => {
    const kept = words.filter(w => (isBackground ? !_stbIsBg(w) : (_stbIsBg(w) || _stbIsMark(w))));
    if (!color) return kept;
    return kept.concat([isBackground ? 'bg-' + color : color]);
  });
};

/** Take every mark and colour off the selection. */
window.sampleFmtClear = function (targetId) {
  _stbApply(targetId, () => []);
};

/**
 * Open a section. Input: is the one that matters — _sampleStdin reads what
 * follows it, and that is what earns the sample its Run this button.
 */
window.sampleFmtSection = function (targetId, word) {
  const el = _stbEl(targetId);
  if (!el) return;
  const m = sampleReadEditor(el);
  const sel = _stbSelection(el);
  const at = sel ? sel.start : m.text.length;
  const lineStart = m.text.lastIndexOf(_STB_NL, Math.max(0, at - 1)) + 1;
  // On its own line, always: a heading is only read as one when it owns a line.
  const insert = word + ':' + _STB_NL;
  const text = m.text.slice(0, lineStart) + insert + m.text.slice(lineStart);
  const attrs = m.attrs.slice(0, lineStart)
    .concat(insert.split('').map(() => []))
    .concat(m.attrs.slice(lineStart));
  _stbPaint(el, text, attrs);
  _stbSetCaret(el, lineStart + insert.length);
  el.focus();
  el.dispatchEvent(new Event('change', { bubbles: true }));
};


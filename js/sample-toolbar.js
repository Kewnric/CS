/* ============================================================
   SAMPLE EDITOR — formatting you can see
   ------------------------------------------------------------
   A sample body is not prose and never became rich text: `Run this` feeds the
   Input: block straight to the program, so what is STORED has to stay the
   characters the program will read. Formatting is therefore kept as author
   tokens — `[[gold b:7]]` — which formatSampleText turns into spans when the
   sample is drawn on its card.

   That is a storage format, not something to read. Showing it in the field was
   the mistake this file exists to undo: you picked a colour and got `[[gold:`
   back. What you edit now is coloured text; the tokens are written and read
   behind it and never appear on screen.

   HOW IT WORKS. The text is held as characters plus, per character, the style
   words that apply to it — the ordinary way to model formatted text, and the
   reason overlapping, partial and repeated formatting all behave. Three pure
   functions move between that model and the two things it has to be:

       tokens  ──sampleParseTokens──▶  {text, attrs}  ──sampleRenderEditor──▶  DOM
       tokens  ◀─sampleSerialize────  {text, attrs}   ◀──sampleReadEditor───  DOM

   Typing edits the DOM; every input reads it back to the model, redraws, and
   puts the caret where it was. Section colouring (Input:/Output:) is derived
   from the line each time rather than stored, so it follows what you type and
   can never be saved into the sample by accident.
   ============================================================ */

/* The palette, as swatches. Named CSS colours: they survive a round trip
   through the token text as words, and read as themselves if anyone ever does
   look at the stored string. */
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
const _STB_TOKEN_AT = /^\[\[([^:\]]+):(.*?)\]\]/;

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

/**
 * Stored tokens → characters + the style words on each.
 * Nested tokens (hand-written, or left by an older version) flatten here, the
 * inner one winning the colour it is nearer to.
 */
function sampleParseTokens(tokenText) {
  const src = String(tokenText == null ? '' : tokenText);
  const chars = [], attrs = [];
  let i = 0;
  while (i < src.length) {
    const m = src.slice(i).match(_STB_TOKEN_AT);
    if (m && m[2] !== '') {
      const words = m[1].trim().split(/\s+/).filter(Boolean);
      const inner = sampleParseTokens(m[2]);
      for (let k = 0; k < inner.text.length; k++) {
        chars.push(inner.text[k]);
        attrs.push(_stbNormWords(words.concat(inner.attrs[k] || [])));
      }
      i += m[0].length;
      continue;
    }
    chars.push(src[i]);
    attrs.push([]);
    i++;
  }
  return { text: chars.join(''), attrs: attrs };
}

/**
 * Characters + style words → stored tokens.
 * Runs are grouped per line, because formatSampleText wraps each line in its
 * own section span and a token straddling a newline would interleave with it.
 */
function sampleSerializeTokens(text, attrs) {
  const s = String(text || '');
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === _STB_NL) { out += s[i]; i++; continue; }
    const key = ((attrs && attrs[i]) || []).join(' ');
    if (!key) { out += s[i]; i++; continue; }
    let j = i;
    while (j < s.length && s[j] !== _STB_NL && ((attrs && attrs[j]) || []).join(' ') === key) j++;
    const body = s.slice(i, j);
    /* `]]` inside a body would end the token early and corrupt everything
       after it. Losing a colour is recoverable; corrupting the sample is not. */
    out += (body.indexOf(']]') === -1 && body.indexOf('[[') === -1)
      ? '[[' + key + ':' + body + ']]'
      : body;
    i = j;
  }
  return out;
}

/* ── Drawing the editor ──────────────────────────────────── */

function _stbEsc(s) {
  return typeof escapeHTML === 'function' ? escapeHTML(s)
    : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Spans for each run of identically-styled characters in [from, to). */
function _stbRunsHTML(text, attrs, from, to) {
  let out = '';
  let i = from;
  while (i < to) {
    const key = ((attrs && attrs[i]) || []).join(' ');
    let j = i;
    while (j < to && ((attrs && attrs[j]) || []).join(' ') === key) j++;
    const body = _stbEsc(text.slice(i, j));
    if (!key) {
      out += body;
    } else {
      const style = typeof sampleTokenStyle === 'function' ? sampleTokenStyle(key) : '';
      // data-fmt is what survives the round trip; the style is only how it looks.
      out += '<span data-fmt="' + _stbEsc(key) + '"' + (style ? ' style="' + style + '"' : '') + '>'
           + body + '</span>';
    }
    i = j;
  }
  return out;
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
           + _stbRunsHTML(text, attrs, start, start + line.length) + '</span></div>';
    }
    const named = line.match(SAMPLE_NAMED);
    if (named) {
      section = sampleSectionOf(named[2]);
      const cut = start + named[0].length;
      const head = '<span class="sample-label">' + _stbRunsHTML(text, attrs, start, cut) + '</span>';
      const rest = _stbRunsHTML(text, attrs, cut, start + line.length);
      const tail = line.slice(named[0].length).trim()
        ? (section ? '<span class="sample-' + section + '">' + rest + '</span>' : rest)
        : rest;
      return '<div class="stb-line">' + head + tail + '</div>';
    }
    const runs = _stbRunsHTML(text, attrs, start, start + line.length);
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

/** DOM → model. Each block child is a line; a block's trailing <br> is filler. */
function sampleReadEditor(root) {
  const chars = [], attrs = [];
  const lines = root.children.length
    ? Array.prototype.slice.call(root.children)
    : [root];

  lines.forEach((line, li) => {
    if (li) { chars.push(_STB_NL); attrs.push([]); }
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
function sampleFieldHTML(id, tokenText) {
  const parsed = sampleParseTokens(tokenText);
  return sampleToolbarHTML(id)
    + '<div class="stb-field"><div class="stb-editor" id="' + id + '" contenteditable="true" '
    + 'spellcheck="false" role="textbox" aria-multiline="true">'
    + sampleRenderEditor(parsed.text, parsed.attrs)
    + '</div></div>';
}

function _stbEl(idOrEl) {
  return typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
}

/** What to store: the sample with its formatting as tokens. */
function sampleEditorValue(idOrEl) {
  const el = _stbEl(idOrEl);
  if (!el) return '';
  const m = sampleReadEditor(el);
  return sampleSerializeTokens(m.text, m.attrs);
}

/** Load stored text into the editor. */
function sampleEditorSetValue(idOrEl, tokenText) {
  const el = _stbEl(idOrEl);
  if (!el) return;
  const parsed = sampleParseTokens(tokenText);
  el.innerHTML = sampleRenderEditor(parsed.text, parsed.attrs);
}

/* Redraw from the model after every change, so section colouring follows what
   is typed. The caret is measured before and restored after, in characters, so
   it lands where it was rather than where the old nodes were. */
function _stbRefresh(el, keepSelection) {
  const sel = keepSelection ? _stbSelection(el) : null;
  const caret = sel ? null : _stbCaretOffset(el);
  const m = sampleReadEditor(el);
  el.innerHTML = sampleRenderEditor(m.text, m.attrs);
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

  let composing = false;
  el.addEventListener('compositionstart', () => { composing = true; });
  el.addEventListener('compositionend', () => { composing = false; _stbRefresh(el); });
  el.addEventListener('input', () => { if (!composing) _stbRefresh(el); });

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
  el.innerHTML = sampleRenderEditor(before + inserted + after, attrs);
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
    <button type="button" class="stb-btn" title="${label}" aria-label="${label}"
            onmousedown="event.preventDefault()" onclick="sampleFmtMark('${t}', '${key}')">
      <i data-lucide="${icon}"></i>
    </button>`).join('');

  const swatches = (bg) => SAMPLE_FMT_COLORS.map(([v, label]) => `
        <button type="button" class="stb-swatch" title="${label}" aria-label="${label}"
                style="background:${v}" onmousedown="event.preventDefault()"
                onclick="sampleFmtColor('${t}', '${v}', ${bg})"></button>`).join('')
    + `
        <button type="button" class="stb-swatch stb-swatch-none" title="None" aria-label="None"
                onmousedown="event.preventDefault()"
                onclick="sampleFmtColor('${t}', '', ${bg})"></button>`;

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
  el.innerHTML = sampleRenderEditor(m.text, attrs);
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
  el.innerHTML = sampleRenderEditor(text, attrs);
  _stbSetCaret(el, lineStart + insert.length);
  el.focus();
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

/** `[[red:hi]]` → `hi`. What a program would actually receive. */
function sampleStripTokens(text) {
  return sampleParseTokens(text).text;
}

/* ============================================================
   SAMPLE FORMATTING TOOLBAR
   ------------------------------------------------------------
   A sample body is not prose and never became rich text: `Run this` feeds the
   Input: block straight to the program, so what is stored has to stay the
   characters the program will read. Formatting therefore travels as author
   tokens — `[[red:text]]` — which formatSampleText turns into a span when the
   sample is drawn. That syntax has been there all along; nothing offered a way
   to write it except typing it by hand.

   This is that way. It edits the textarea's selection in place, so the same
   toolbar serves the attempt's Edit sample dialog and the admin sample rows
   without either of them knowing how a token is spelled.

   A token's style is inline, and the automatic Input:/Output: colouring is a
   class, so anything coloured by hand wins over the section it sits in — which
   is the whole reason to offer the control at all. See formatSampleText.
   ============================================================ */

/* Named CSS colours, so a token stays readable as text. Picked to sit legibly
   on the sample block's near-black ground rather than for range. */
const SAMPLE_FMT_COLORS = [
  ['', 'Default'],
  ['tomato', 'Red'],
  ['orange', 'Orange'],
  ['gold', 'Yellow'],
  ['mediumseagreen', 'Green'],
  ['deepskyblue', 'Blue'],
  ['mediumpurple', 'Purple'],
  ['lightgray', 'Grey']
];

/** Every mark the toolbar can apply, in the order the buttons sit. */
const SAMPLE_FMT_MARKS = [
  ['b', 'bold', 'Bold'],
  ['i', 'italic', 'Italic'],
  ['u', 'underline', 'Underline'],
  ['s', 'strikethrough', 'Strikethrough']
];

/**
 * The toolbar's markup, bound to one textarea by id.
 * Rendered as a string so a template can drop it in beside the field.
 */
function sampleToolbarHTML(targetId) {
  const t = String(targetId);
  const marks = SAMPLE_FMT_MARKS.map(([key, icon, label]) => `
    <button type="button" class="stb-btn" title="${label}" aria-label="${label}"
            onclick="sampleFmtMark('${t}', '${key}')">
      <i data-lucide="${icon}"></i>
    </button>`).join('');

  const colorOpts = SAMPLE_FMT_COLORS
    .map(([v, label]) => `<option value="${v}">${label}</option>`).join('');

  return `
    <div class="sample-toolbar" data-target="${t}">
      ${marks}
      <span class="stb-div" aria-hidden="true"></span>
      <label class="stb-pick" title="Text colour">
        <i data-lucide="baseline"></i>
        <select onchange="sampleFmtColor('${t}', this.value, false); this.selectedIndex = 0;"
                aria-label="Text colour">${colorOpts}</select>
      </label>
      <label class="stb-pick" title="Highlight">
        <i data-lucide="highlighter"></i>
        <select onchange="sampleFmtColor('${t}', this.value, true); this.selectedIndex = 0;"
                aria-label="Highlight colour">${colorOpts}</select>
      </label>
      <span class="stb-div" aria-hidden="true"></span>
      <button type="button" class="stb-btn stb-text" title="Start an Input: section"
              onclick="sampleFmtSection('${t}', 'Input')">Input:</button>
      <button type="button" class="stb-btn stb-text" title="Start an Output: section"
              onclick="sampleFmtSection('${t}', 'Output')">Output:</button>
      <span class="stb-div" aria-hidden="true"></span>
      <button type="button" class="stb-btn" title="Remove formatting" aria-label="Remove formatting"
              onclick="sampleFmtClear('${t}')">
        <i data-lucide="remove-formatting"></i>
      </button>
    </div>`;
}

/* A token, whole. The body is whatever sits between the brackets — including
   another token, which is how content that already nested gets flattened
   rather than nested one deeper. */
const _STB_TOKEN = /^\[\[([^:\]]+):([\s\S]*)\]\]$/;
const _STB_SCAN = /\[\[[^:\]]+:.*?\]\]/g;
const _STB_NL = String.fromCharCode(10);

/** Every style word on a piece of text, and the text with all of them removed. */
function _stbSplit(body) {
  let words = [], text = String(body), m;
  while ((m = text.match(_STB_TOKEN))) {
    words = words.concat(m[1].trim().split(/\s+/).filter(Boolean));
    text = m[2];
  }
  return { words: words, text: text };
}

/* Selecting the words you can see and pressing a second button has to add to
   the token already around them, not wrap a new one outside it: `[[gold:` and
   its `]]` are characters in the field, and nobody selects those. So a
   selection sitting inside a token grows to cover the whole token first. */
function _stbExpand(line, relStart, relEnd) {
  let m;
  _STB_SCAN.lastIndex = 0;
  while ((m = _STB_SCAN.exec(line)) !== null) {
    const a = m.index, b = a + m[0].length;
    if (relStart >= a && relEnd <= b) return [a, b];
  }
  return [relStart, relEnd];
}

/** The field, and the selection to work on — the whole line if nothing is picked. */
function _stbField(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return null;
  const v = el.value;
  let start = el.selectionStart, end = el.selectionEnd;
  const lineStart = v.lastIndexOf(_STB_NL, Math.max(0, start - 1)) + 1;

  if (start === end) {
    // Nothing selected: take the line the caret is on, which is the unit a
    // sample is written in. Formatting nothing at all would just look broken.
    const nl = v.indexOf(_STB_NL, end);
    start = lineStart;
    end = nl === -1 ? v.length : nl;
  } else if (v.slice(start, end).indexOf(_STB_NL) === -1) {
    const nl = v.indexOf(_STB_NL, lineStart);
    const line = v.slice(lineStart, nl === -1 ? v.length : nl);
    const grown = _stbExpand(line, start - lineStart, end - lineStart);
    start = lineStart + grown[0];
    end = lineStart + grown[1];
  }
  return { el: el, start: start, end: end, text: v.slice(start, end) };
}

/** Write back, keep the new text selected, and tell whoever is listening. */
function _stbReplace(f, text) {
  const el = f.el;
  el.value = el.value.slice(0, f.start) + text + el.value.slice(f.end);
  el.focus();
  el.setSelectionRange(f.start, f.start + text.length);
  // Admin saves on input; the dialog reads the field on save. Both are served
  // by saying so out loud rather than either of them being special-cased here.
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* Tokens never span a line: formatSampleText wraps each line in its own
   section span, so a token straddling a newline would interleave with those
   wrappers. Applying line by line keeps every token inside one. */
function _stbPerLine(text, fn) {
  return text.split(_STB_NL).map(line => (line.trim() ? fn(line) : line)).join(_STB_NL);
}

/** Set one line's style words, flattening whatever was already on it. */
function _stbAddWord(line, word, replaces) {
  const lead = (line.match(/^[ \t]*/) || [''])[0];
  const split = _stbSplit(line.slice(lead.length));

  let words = split.words;
  // A second colour replaces the first rather than stacking two that fight.
  if (replaces) words = words.filter(w => !replaces(w));
  if (word && words.indexOf(word) === -1) words.push(word);
  if (!words.length) return lead + split.text;
  return lead + '[[' + words.join(' ') + ':' + split.text + ']]';
}

/** Bold / italic / underline / strike — toggled, so a second press removes it. */
window.sampleFmtMark = function (targetId, word) {
  const f = _stbField(targetId);
  if (!f || !f.text.trim()) return;
  const on = f.text.split(_STB_NL).every(line => !line.trim()
    || _stbSplit(line.trim()).words.indexOf(word) !== -1);
  _stbReplace(f, _stbPerLine(f.text, line => (on
    ? _stbAddWord(line, '', w => w === word)
    : _stbAddWord(line, word))));
};

/** Text colour, or the highlight behind it. An empty value clears that one. */
window.sampleFmtColor = function (targetId, color, isBackground) {
  const f = _stbField(targetId);
  if (!f || !f.text.trim()) return;
  const isBg = (w) => w.slice(0, 3) === 'bg-';
  const drops = isBackground ? isBg : (w) => !isBg(w) && SAMPLE_FMT_MARKS.every(m => m[0] !== w);
  const word = color ? (isBackground ? 'bg-' + color : color) : '';
  _stbReplace(f, _stbPerLine(f.text, line => _stbAddWord(line, word, drops)));
};

/** Strip every token from the selection, leaving the text it wrapped. */
window.sampleFmtClear = function (targetId) {
  const f = _stbField(targetId);
  if (!f) return;
  _stbReplace(f, sampleStripTokens(f.text));
};

/**
 * Open a section. Input: is the one that matters — _sampleStdin reads what
 * follows it, and that is what earns the sample its Run this button.
 */
window.sampleFmtSection = function (targetId, word) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const v = el.value;
  const lineStart = v.lastIndexOf(_STB_NL, Math.max(0, el.selectionStart - 1)) + 1;
  // On its own line, always: formatSampleText only reads a heading that owns
  // the line it is on, or one of the names it knows at the start of one.
  const before = v.slice(0, lineStart);
  const insert = (before && before.slice(-1) !== _STB_NL ? _STB_NL : '') + word + ':' + _STB_NL;
  el.value = before + insert + v.slice(lineStart);
  const caret = before.length + insert.length;
  el.focus();
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

/** `[[red:hi]]` → `hi`. Used by the clear button, and by anything that needs
    the characters a program would actually receive. */
function sampleStripTokens(text) {
  let s = String(text == null ? '' : text);
  // Repeat: a line the toolbar wrote holds one token, but content written by
  // hand may hold several nested, and one pass leaves the outer one behind.
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\[\[[^:\]]+:(.*?)\]\]/g, '$1');
    if (next === s) break;
    s = next;
  }
  return s;
}

/* ============================================================
   THE FIELD SHOWS WHAT THE SAMPLE WILL LOOK LIKE
   ------------------------------------------------------------
   Editing was monochrome while the card beside it was coloured, so the one
   place you choose a colour was the one place you could not see one. The
   colouring is the card's own: the same section rules, the same token styles.

   Same trick the code editor uses (see .editor-pre / .editor-textarea) — a
   <pre> painted underneath and a transparent textarea on top, aligned
   character for character so the caret lands where the glyph is. That means
   the highlighted copy must contain EXACTLY the characters the field holds,
   token brackets included; they are dimmed rather than hidden, because hiding
   them would move every glyph after them out from under the caret.
   ============================================================ */

/** One line's worth of token spans, over text that is already HTML-escaped. */
function _stbPaintTokens(escaped) {
  return escaped.replace(/\[\[([^:\]]+):(.*?)\]\]/g, (m, key, body) => {
    const style = typeof sampleTokenStyle === 'function' ? sampleTokenStyle(key) : '';
    if (!style) return m;
    return '<span class="stb-hl-mark">[[' + key + ':</span>'
         + '<span style="' + style + '">' + body + '</span>'
         + '<span class="stb-hl-mark">]]</span>';
  });
}

/** The editor's backdrop: the field's text, coloured the way the card colours it. */
function sampleEditorHighlightHTML(text) {
  const src = String(text == null ? '' : text);
  let section = '';
  const out = src.split(String.fromCharCode(10)).map(line => {
    const esc = typeof escapeHTML === 'function' ? escapeHTML(line) : line;

    const own = line.match(SAMPLE_OWN_LINE);
    if (own) {
      section = sampleSectionOf(own[2]);
      return '<span class="sample-label">' + esc + '</span>';
    }
    const named = line.match(SAMPLE_NAMED);
    if (named) {
      section = sampleSectionOf(named[2]);
      const headLen = named[0].length;
      const head = typeof escapeHTML === 'function' ? escapeHTML(line.slice(0, headLen)) : line.slice(0, headLen);
      const rest = _stbPaintTokens(
        typeof escapeHTML === 'function' ? escapeHTML(line.slice(headLen)) : line.slice(headLen));
      const headHTML = '<span class="sample-label">' + head + '</span>';
      if (!line.slice(headLen).trim()) return headHTML;
      return headHTML + (section ? '<span class="sample-' + section + '">' + rest + '</span>' : rest);
    }
    const painted = _stbPaintTokens(esc);
    if (!line.trim() || !section) return painted;
    return '<span class="sample-' + section + '">' + painted + '</span>';
  }).join(String.fromCharCode(10));

  /* A trailing newline leaves the <pre> one line shorter than the textarea,
     which slides the backdrop up by a line as soon as the caret goes there. */
  return out + String.fromCharCode(10);
}

/** Repaint one field's backdrop, and keep it scrolled where the field is. */
function sampleRepaintHighlight(ta) {
  if (!ta) return;
  const pre = ta.parentElement && ta.parentElement.querySelector('.stb-hl');
  if (!pre) return;
  pre.innerHTML = sampleEditorHighlightHTML(ta.value);
  pre.scrollTop = ta.scrollTop;
  pre.scrollLeft = ta.scrollLeft;
}

/**
 * Give every sample field under `root` its backdrop, once.
 * Safe to call again — re-rendered forms hand over fresh elements, and the
 * ones already wired are left alone.
 */
function sampleSyncHighlights(root) {
  const scope = root || document;
  const fields = scope.querySelectorAll ? scope.querySelectorAll('.stb-field textarea') : [];
  Array.prototype.forEach.call(fields, (ta) => {
    if (!ta._stbHl) {
      ta._stbHl = true;
      const pre = document.createElement('pre');
      pre.className = 'stb-hl';
      pre.setAttribute('aria-hidden', 'true');
      ta.parentElement.insertBefore(pre, ta);
      // input covers typing and the toolbar, which fires its own input event.
      ta.addEventListener('input', () => sampleRepaintHighlight(ta));
      ta.addEventListener('scroll', () => {
        pre.scrollTop = ta.scrollTop;
        pre.scrollLeft = ta.scrollLeft;
      });
    }
    sampleRepaintHighlight(ta);
  });
}

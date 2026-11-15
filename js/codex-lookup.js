/* ============================================================
   CODEX-LOOKUP.JS — F1 on a word in any editor opens its Codex entry
   ------------------------------------------------------------
   In the attempt, the multi-problem session, Freeground and the template
   drill: F1 (or Alt+click) on a name, an operator or a format code opens a
   small card under the caret with what it is, its form, a short example and
   its most common mistake -- without leaving the code. Related entries open
   their own card on top (three deep at most); Esc closes the top one, a click
   elsewhere closes them all unless one is pinned.

   F1 is taken from the browser only in an editor; anywhere else it is left
   alone. Closed book (exam-mode.js) turns lookup off.
   ============================================================ */

const CDX_POP_MAX = 3;
const CDX_OPS = ['->', '++', '--', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '+=', '-=', '*=', '/=', '%=',
  '+', '-', '*', '/', '%', '<', '>', '!', '=', '&', '|', '^', '~', '?', ':', '.', '[', ']', '(', ')', ','];
const CDX_OP_ALIAS = { '[': '[]', ']': '[]', '(': '()', ')': '()', '?': '?:', ':': '?:' };

const _cdxPops = [];

/** What is at `pos` in `text`: a format code, a name, or an operator. */
function codexWordAt(text, pos) {
  const t = String(text || '');
  // A format code in a string: %d, %.2f, %-5s, %lf ...
  const fmt = /%[-+ 0#]*\d*(?:\.\d+)?(?:hh|h|ll|l|z)?[diouxXfeEgGcsp%]/g;
  let m;
  while ((m = fmt.exec(t))) {
    if (m.index <= pos && pos <= m.index + m[0].length) return { word: m[0], kind: 'format' };
    if (m.index > pos) break;
  }
  let a = pos, b = pos;
  while (a > 0 && /\w/.test(t[a - 1])) a--;
  while (b < t.length && /\w/.test(t[b])) b++;
  if (b > a) {
    const w = t.slice(a, b);
    if (t[a - 1] === '#') return { word: '#' + w, kind: 'name' };
    if (w === 'long' && /^\s+long\b/.test(t.slice(b))) return { word: 'long long', kind: 'name' };
    return { word: w, kind: 'name' };
  }
  for (const op of CDX_OPS) {
    for (let s = Math.max(0, pos - op.length); s <= pos; s++) {
      if (t.substr(s, op.length) === op) return { word: CDX_OP_ALIAS[op] || op, kind: 'op' };
    }
  }
  return null;
}

/** The entries a looked-up word stands for. */
function codexLookupEntries(found) {
  if (!found) return [];
  let list = codexByName(found.word);
  if (!list.length && found.kind === 'format') {
    const w = found.word;
    const guess = /^%-?0?\d+d$/.test(w) ? '%5d' : /^%\.\d+l?f$/.test(w) ? '%.2f' : /^%lld$/.test(w) ? '%ld' : /^%X$/.test(w) ? '%x' : '';
    list = guess ? codexByName(guess) : codexByName('%' + w.slice(-1));
  }
  if (!list.length && /^(islower)$/.test(found.word)) list = codexByName('isupper');
  if (!list.length && /^(tolower)$/.test(found.word)) list = codexByName('toupper');
  if (!list.length && /^(ceil)$/.test(found.word)) list = codexByName('floor');
  return list;
}

/* Where the caret is on screen: a hidden copy of the textarea, laid out the
   same, measured up to the caret. */
function _cdxCaretRect(ta) {
  const cs = getComputedStyle(ta);
  const div = document.createElement('div');
  ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'tabSize', 'textTransform',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'boxSizing', 'whiteSpace', 'wordWrap', 'overflowWrap']
    .forEach(p => { div.style[p] = cs[p]; });
  const r = ta.getBoundingClientRect();
  Object.assign(div.style, { position: 'fixed', visibility: 'hidden', top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', overflow: 'hidden' });
  div.textContent = ta.value.slice(0, ta.selectionStart);
  const span = document.createElement('span');
  span.textContent = ta.value.slice(ta.selectionStart, ta.selectionStart + 1) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const s = span.getBoundingClientRect();
  div.remove();
  return { left: s.left - ta.scrollLeft, top: s.top - ta.scrollTop, bottom: s.bottom - ta.scrollTop };
}

function codexPopsClose(all) {
  while (_cdxPops.length) {
    const p = _cdxPops[_cdxPops.length - 1];
    if (!all && _cdxPops.length === 0) break;
    if (all && p.pinned) break;
    _cdxPops.pop();
    p.el.remove();
    if (!all) break;
  }
  if (!_cdxPops.length) {
    document.removeEventListener('mousedown', _cdxOutside, true);
    document.removeEventListener('keydown', _cdxKey, true);
  }
}

function _cdxOutside(e) {
  if (_cdxPops.some(p => p.el.contains(e.target))) return;
  codexPopsClose(true);
}

function _cdxKey(e) {
  if (e.key !== 'Escape' || !_cdxPops.length) return;
  e.preventDefault();
  e.stopPropagation();
  codexPopsClose(false);
  const ta = document.getElementById('editor-textarea');
  if (!_cdxPops.length && ta) ta.focus();
}

function _cdxPopHTML(entries, word) {
  if (!entries.length) {
    return `<div class="cdx-pop-head"><code>${escapeHTML(word)}</code></div>
      <p class="cdx-pop-d">No Codex entry for this.</p>
      <div class="cdx-pop-foot"><button class="cdx-link" data-cdx-search="${escapeHTML(word)}">Search the Codex</button></div>`;
  }
  return entries.map(e => {
    const rel = (e.r || []).map(codexFind).filter(Boolean).slice(0, 6);
    const hl = (s) => (typeof syntaxHighlight === 'function' ? syntaxHighlight(s) : escapeHTML(s));
    return `
      <div class="cdx-pop-head"><code>${escapeHTML(e.n)}</code>${e.h ? `<span>&lt;${escapeHTML(e.h)}&gt;</span>` : ''}${codexStarsHTML(e.id)}</div>
      ${e.s ? `<pre class="cdx-pop-sig"><code>${hl(e.s)}</code></pre>` : ''}
      <p class="cdx-pop-d">${escapeHTML(e.d)}</p>
      ${e.ex && e.ex.split('\n').length <= 6 ? `<pre class="cdx-pop-ex"><code>${hl(e.ex)}</code></pre>` : ''}
      ${(e.m || []).length ? `<p class="cdx-pop-m"><i data-lucide="alert-triangle"></i> ${escapeHTML(e.m[0])}</p>` : ''}
      ${rel.length ? `<div class="cdx-pop-rel">${rel.map(r => `<button class="cdx-chip" data-cdx-rel="${r.id}"><code>${escapeHTML(r.n)}</code></button>`).join('')}</div>` : ''}
      <div class="cdx-pop-foot">
        <button class="cdx-link" data-cdx-open="${e.id}">Open in the Codex</button>
        <button class="cdx-pin" data-cdx-pin title="Keep this card open" aria-label="Keep this card open"><i data-lucide="pin"></i></button>
      </div>`;
  }).join('<hr>');
}

/**
 * Show a card for these entries at a screen point.
 * @param {Array} entries
 * @param {{left:number, top:number, bottom:number}} at
 * @param {string} word what was looked up (for the "no entry" card)
 */
function codexPopShow(entries, at, word) {
  if (_cdxPops.length >= CDX_POP_MAX) codexPopsClose(false);
  const el = document.createElement('div');
  el.className = 'cdx-pop';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Codex: ' + (entries[0] ? entries[0].n : word));
  el.tabIndex = -1;
  el.innerHTML = _cdxPopHTML(entries, word);
  document.body.appendChild(el);
  const depth = _cdxPops.length;
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = Math.min(Math.max(8, at.left + depth * 18), window.innerWidth - w - 8);
  let top = at.bottom + 6 + depth * 18;
  if (top + h > window.innerHeight - 8) top = Math.max(8, at.top - h - 6 - depth * 18);   // no room below: above the line
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  const pop = { el, pinned: false };
  _cdxPops.push(pop);
  entries.forEach(e => codexMarkSeen(e.id));
  el.addEventListener('click', (ev) => {
    const rel = ev.target.closest('[data-cdx-rel]');
    const open = ev.target.closest('[data-cdx-open]');
    const pin = ev.target.closest('[data-cdx-pin]');
    const search = ev.target.closest('[data-cdx-search]');
    if (rel) {
      const r = el.getBoundingClientRect();
      codexPopShow([codexFind(rel.getAttribute('data-cdx-rel'))].filter(Boolean), { left: r.left, top: r.top, bottom: r.top + 24 }, '');
    } else if (open) {
      codexPopsClose(true);
      codexOpen(open.getAttribute('data-cdx-open'));
    } else if (pin) {
      pop.pinned = !pop.pinned;
      el.classList.toggle('is-pinned', pop.pinned);
    } else if (search) {
      codexPopsClose(true);
      setSessionParam('codexOpen', '');
      spaNavigate('codex');
    }
  });
  if (_cdxPops.length === 1) {
    document.addEventListener('mousedown', _cdxOutside, true);
    document.addEventListener('keydown', _cdxKey, true);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  return el;
}

/** Look up whatever is at the caret in the editor. */
function codexLookupAtCaret(ta) {
  if (!ta) return;
  if (typeof examClosedBookOn === 'function' && examClosedBookOn()) {
    if (typeof toast === 'function') toast('Lookup is off: this is a closed-book attempt.', { type: 'info', duration: 2000 });
    return;
  }
  const full = ta.value;
  const found = codexWordAt(full, ta.selectionStart);
  if (!found) return;
  codexPopsClose(true);
  codexPopShow(codexLookupEntries(found), _cdxCaretRect(ta), found.word);
}

/* F1 in an editor; Alt+click on a word. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'F1' || e.ctrlKey || e.altKey || e.metaKey) return;
  if (!(typeof isEditorRoute === 'function' && isEditorRoute())) return;
  const ta = document.getElementById('editor-textarea');
  if (!ta || document.activeElement !== ta) return;
  e.preventDefault();
  codexLookupAtCaret(ta);
}, true);

document.addEventListener('click', (e) => {
  if (!e.altKey || !e.target || e.target.id !== 'editor-textarea') return;
  if (!(typeof isEditorRoute === 'function' && isEditorRoute())) return;
  codexLookupAtCaret(e.target);
}, true);

/* ============================================================
   STARTER-LOCK.JS — the starter code can be added to, never changed
   ------------------------------------------------------------
   A version can lock its starter code (admin form: "Lock starter code",
   variant.lockStarter). In the attempt, every character the starter put in
   the file then stays exactly as it is: it cannot be deleted, typed over,
   cut, indented away or moved. What you can do is ADD -- on a new line
   between its lines, at the start or the end of one of its lines (a comment
   after `return 0;`), inside a blank line it left for you -- and everything
   you add is yours to change freely.

   HOW IT KNOWS. A mask over the editor's text marks each character as the
   starter's (1) or yours (0). It is kept exact rather than guessed:
     - every edit is judged BEFORE it lands, at the two places text changes:
       the textarea's beforeinput (typing, Backspace, Delete, paste, cut) and
       editor.js's edReplaceRange (Enter, Tab, brackets, Ctrl+/, Ctrl+D,
       Alt+arrows, find and replace). An allowed edit says what the mask will
       be afterwards; a refused one is cancelled;
     - an edit that reaches into the starter only takes YOUR characters out of
       the range: select across both and press Delete, and the starter stays
       while your code goes;
     - undo and redo bring back a text this file has had before, and its mask
       with it (a short history keyed by the text);
     - the mask rides on the file (state.userFiles[i].slk, run-length, with a
       hash of the starter it belongs to), so a draft, a reload or a restore
       point brings back exactly which characters are yours. Without one (the
       lock was switched on mid-attempt, an old draft) the starter is lined up
       against the text, whole lines first (slkAlign).

   Ctrl+A selects your code, not the file: the piece the caret is in, then all
   of your code, then (a third time) everything, for copying.

   Folding is off in a locked file. A fold takes text out of the textarea,
   and keeping the mask to the screen through that is not worth the risk to
   a guarantee whose whole point is that it holds.

   Single-program attempt (route practice) only.
   ============================================================ */

let _slk = { on: false };
let _slkRefusedAt = 0;
const SLK_HISTORY = 200;

/* ── The mask on the file ─────────────────────────────────────── */

function _slkHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return s.length + ':' + (h >>> 0).toString(36);
}

/** Runs of the starter's characters, as [start, length] pairs. */
function _slkEncode(mask) {
  const out = [];
  for (let i = 0; i < mask.length;) {
    if (!mask[i]) { i++; continue; }
    let j = i;
    while (j < mask.length && mask[j]) j++;
    out.push([i, j - i]);
    i = j;
  }
  return out;
}

function _slkDecode(runs, len) {
  if (!Array.isArray(runs)) return null;
  const mask = new Uint8Array(len);
  for (const r of runs) {
    if (!Array.isArray(r) || !(r[0] >= 0) || !(r[1] > 0) || r[0] + r[1] > len) return null;
    mask.fill(1, r[0], r[0] + r[1]);
  }
  return mask;
}

function _slkJoin(parts) {
  let n = 0;
  parts.forEach(p => { n += p.length; });
  const out = new Uint8Array(n);
  let at = 0;
  parts.forEach(p => { out.set(p, at); at += p.length; });
  return out;
}

const _slkZeros = n => new Uint8Array(Math.max(0, n));

/**
 * Where the starter's characters are in `T`, when nothing recorded it. The
 * lock only ever lets text in at a line's start or end or between lines, so
 * every starter line is still whole somewhere in T, in order: lines that are
 * unchanged are paired first (longest first wins, so a real line beats a
 * blank one), then the rest are found inside the lines between those pairs.
 * A starter line that cannot be found is left unmarked.
 */
function slkAlign(S, T) {
  S = String(S || '').replace(/\r\n/g, '\n');
  T = String(T || '');
  const mask = new Uint8Array(T.length);
  if (!S || !T) return mask;
  if (S === T) { mask.fill(1); return mask; }
  const sl = S.split('\n'), tl = T.split('\n');
  const n = sl.length, m = tl.length;
  const tAt = new Array(m);
  for (let j = 0, o = 0; j < m; j++) { tAt[j] = o; o += tl[j].length + 1; }
  const put = (i, j, col) => {
    const a = tAt[j] + col;
    mask.fill(1, a, a + sl[i].length);
    // The line's own end goes with it, unless it was the starter's last line.
    if (i < n - 1 && j < m - 1) mask[tAt[j] + tl[j].length] = 1;
  };
  const pairs = [];
  if (n * m <= 2500000) {
    const w = m + 1;
    const dp = new Float64Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = sl[i] === tl[j]
          ? dp[(i + 1) * w + j + 1] + sl[i].length + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (sl[i] === tl[j] && dp[i * w + j] === dp[(i + 1) * w + j + 1] + sl[i].length + 1) {
        pairs.push([i, j]); i++; j++;
      } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
      else j++;
    }
  }
  const gap = (i0, i1, j0, j1) => {
    let j = j0;
    for (let i = i0; i < i1; i++) {
      if (!sl[i].length) continue;
      for (let k = j; k < j1; k++) {
        const col = tl[k].indexOf(sl[i]);
        if (col >= 0) { put(i, k, col); j = k + 1; break; }
      }
    }
  };
  let pi = 0, pj = 0;
  pairs.forEach(([a, b]) => { gap(pi, a, pj, b); put(a, b, 0); pi = a + 1; pj = b + 1; });
  gap(pi, n, pj, m);
  return mask;
}

/* ── Which file, and whether it is locked ─────────────────────── */

function _slkFile() {
  return (state.userFiles || [])[_slk.fi] || null;
}

/** Put the mask on the file, where drafts and restore points carry it. */
function _slkStore() {
  const f = _slkFile();
  if (!f || !_slk.on) return;
  f.slk = { s: _slk.hash, r: _slkEncode(_slk.mask) };
}

function _slkRemember(text, mask) {
  const h = _slk.hist;
  if (!h) return;
  h.delete(text);
  h.set(text, mask);
  if (h.size > SLK_HISTORY) h.delete(h.keys().next().value);
}

/** Is the file on screen starter-locked? */
function slkActive() { return !!_slk.on; }

/** Write the file's mask before the editor moves to another file (savePracticeFileCode). */
function slkFlush() { _slkSync(); }

/**
 * Take up the file now in the editor. Called whenever loadPracticeFile puts
 * a file on screen, and when the program it comes from changes (the admin
 * window). Sets the lock up, or stands it down, for that file.
 */
function slkAttach() {
  const ta = document.getElementById('editor-textarea');
  _slk = { on: false };
  _slkChip(false);
  if (!ta || !document.body || document.body.dataset.route !== 'practice') return;
  const variant = state.activeVariant;
  const fi = state.activeFileIndex || 0;
  const file = state.userFiles && state.userFiles[fi];
  if (!variant || !variant.lockStarter || !file || file.locked) return;
  const S = String(file.starterCode || '').replace(/\r\n/g, '\n');
  if (!S.trim()) return;
  // Recall starts from an empty file: there is no starter on screen to keep.
  if (typeof examRecallOn === 'function' && examRecallOn()) return;

  if (typeof edFoldsFor === 'function' && edFoldsFor().length && typeof edUnfoldAll === 'function') edUnfoldAll();
  // While the starter is still typing itself in, the file holds all of it.
  const running = typeof _starterAnimRunning === 'function' && _starterAnimRunning();
  const text = running ? String(file.userCode || '') : ta.value;
  const hash = _slkHash(S);
  let mask = (file.slk && file.slk.s === hash) ? _slkDecode(file.slk.r, text.length) : null;
  if (!mask) mask = slkAlign(S, text);

  _slk = { on: true, ta, fi, hash, text, mask, hist: new Map(), pending: null, bypass: false };
  _slkRemember(text, mask);
  _slkStore();
  _slkChip(true);
}

/** Bring the mask up to the text in the editor, after any change. */
function _slkSync() {
  if (!_slk.on) return;
  const ta = _slk.ta;
  if (!ta || !ta.isConnected) { _slk = { on: false }; return; }
  // Mid-switch to another file: the editor holds that file's text now, and
  // reading it as an edit of this one would wreck this one's mask.
  if ((state.activeFileIndex || 0) !== _slk.fi) return;
  if (typeof _starterAnimRunning === 'function' && _starterAnimRunning()) return;
  const v = ta.value;
  if (v === _slk.text) return;
  let mask;
  if (_slk.pending && _slk.pending.text === v) mask = _slk.pending.mask;
  else if (_slk.hist.has(v)) mask = _slk.hist.get(v);
  else mask = _slkDiff(_slk.text, _slk.mask, v);
  _slk.pending = null;
  _slk.text = v;
  _slk.mask = mask;
  _slkRemember(v, mask);
  _slkStore();
}

/* A change nothing announced (one this file had no hand in): what was common
   to both ends stays as it was, and whatever is new in the middle is yours. */
function _slkDiff(oldText, oldMask, v) {
  const min = Math.min(oldText.length, v.length);
  let p = 0;
  while (p < min && oldText[p] === v[p]) p++;
  let s = 0;
  while (s < min - p && oldText[oldText.length - 1 - s] === v[v.length - 1 - s]) s++;
  return _slkJoin([oldMask.subarray(0, p), _slkZeros(v.length - p - s), oldMask.subarray(oldText.length - s)]);
}

/* ── The rules ────────────────────────────────────────────────── */

function _slkHasStarter(a, b) {
  const m = _slk.mask;
  for (let i = Math.max(0, a); i < b && i < m.length; i++) if (m[i]) return true;
  return false;
}

/**
 * May `ins` go in at `a` once [a, b) is gone?
 *   - at the end of a line (a comment after `return 0;`, Enter), between
 *     lines, in a blank line the starter left, before your own text, or at
 *     the end of the file: yes;
 *   - just before a starter line's own text: only a whole new line ("...\n"),
 *     which opens a line above it. Anything else there would be typed onto
 *     the starter's line -- `// ` in front of it is commenting it out;
 *   - inside one of the starter's lines: no.
 */
function _slkInsertOk(a, b, ins) {
  const v = _slk.text, m = _slk.mask;
  if (b >= v.length || v[b] === '\n' || !m[b]) return true;
  if (a === 0 || v[a - 1] === '\n' || !m[a - 1]) return /\n$/.test(ins || '');
  return false;
}

function _slkRefuse(msg) {
  const chip = document.getElementById('slk-chip');
  if (chip) { chip.classList.remove('is-bump'); void chip.offsetWidth; chip.classList.add('is-bump'); }
  const now = Date.now();
  if (now - _slkRefusedAt < 2500) return;
  _slkRefusedAt = now;
  if (typeof toast === 'function') {
    toast(msg || 'The starter code is locked. Add yours on a new line, or after the end of a line.',
      { type: 'info', duration: 3200 });
  }
}

/** Expected text and mask after [a, b) becomes `ins`, for the sync to take up exactly. */
function _slkExpect(a, b, ins) {
  const v = _slk.text, m = _slk.mask;
  _slk.pending = {
    text: v.slice(0, a) + ins + v.slice(b),
    mask: _slkJoin([m.subarray(0, a), _slkZeros(ins.length), m.subarray(b)]),
  };
}

/**
 * Take only YOUR characters out of [s, e), keeping the starter's, and put
 * `ins` where the first of yours was. One edit, so one Ctrl+Z puts it back.
 * Returns false when there is nothing of yours in the range.
 */
function _slkTakeMine(s, e, ins) {
  const ta = _slk.ta, v = _slk.text, m = _slk.mask;
  ins = ins || '';
  let a = -1, b = -1;
  for (let i = s; i < e; i++) if (!m[i]) { if (a < 0) a = i; b = i + 1; }
  if (a < 0) return false;
  let keep = '';
  for (let i = a; i < b; i++) if (m[i]) keep += v[i];
  const text = ins + keep;
  const kept = new Uint8Array(keep.length).fill(1);
  _slk.pending = {
    text: v.slice(0, a) + text + v.slice(b),
    mask: _slkJoin([m.subarray(0, a), _slkZeros(ins.length), kept, m.subarray(b)]),
  };
  _slk.bypass = true;
  try { edReplaceRange(ta, a, b, text, a + ins.length); }
  finally { _slk.bypass = false; }
  _slkSync();
  return true;
}

/**
 * editor.js asks before every edit it makes (edReplaceRange). Judged on what
 * the edit actually changes -- Ctrl+D replaces a line with itself twice, which
 * only ADDS the copy -- so the commands that do not touch the starter work.
 */
function slkAllowReplace(ta, from, to, text) {
  if (!_slk.on || ta !== _slk.ta || _slk.bypass) return true;
  _slkSync();
  const v = _slk.text;
  if (v !== ta.value) return true;      // not a state this file knows; let the sync work it out
  const seg = v.slice(from, to);
  text = String(text);
  const max = Math.min(seg.length, text.length);
  let p = 0;
  while (p < max && seg[p] === text[p]) p++;
  let s = 0;
  while (s < max - p && seg[seg.length - 1 - s] === text[text.length - 1 - s]) s++;
  const ra = from + p, rb = to - s, ins = text.slice(p, text.length - s);
  if (_slkHasStarter(ra, rb) || (ins && !_slkInsertOk(ra, rb, ins))) { _slkRefuse(); return false; }
  _slkExpect(ra, rb, ins);
  return true;
}

/** Folding is off while the starter is locked (see the top of this file). */
function slkBlocksFolding() {
  if (!_slk.on) return false;
  _slkRefuse('Folding is off while the starter code is locked.');
  return true;
}

/* ── Typing, deleting, pasting, cutting ───────────────────────── */

const _SLK_WORD = /[A-Za-z0-9_]/;

/** What a collapsed word/line delete would take, in the file's terms. */
function _slkDeleteSpan(type, at) {
  const v = _slk.text;
  let a = at, b = at;
  if (type === 'deleteWordBackward') {
    while (a > 0 && (v[a - 1] === ' ' || v[a - 1] === '\t')) a--;
    if (a > 0 && _SLK_WORD.test(v[a - 1])) { while (a > 0 && _SLK_WORD.test(v[a - 1])) a--; }
    else if (a === at && a > 0) {
      const c = v[a - 1];
      if (c === '\n') a--;
      else while (a > 0 && v[a - 1] === c) a--;
    }
  } else if (type === 'deleteWordForward') {
    while (b < v.length && (v[b] === ' ' || v[b] === '\t')) b++;
    if (b < v.length && _SLK_WORD.test(v[b])) { while (b < v.length && _SLK_WORD.test(v[b])) b++; }
    else if (b === at && b < v.length) {
      const c = v[b];
      if (c === '\n') b++;
      else while (b < v.length && v[b] === c) b++;
    }
  } else if (/Backward$/.test(type)) {
    a = v.lastIndexOf('\n', at - 1) + 1;
    if (a === at && a > 0) a--;
  } else if (/Forward$/.test(type)) {
    b = v.indexOf('\n', at);
    if (b < 0) b = v.length;
    if (b === at && b < v.length) b++;
  } else {                                  // deleteEntireSoftLine
    a = v.lastIndexOf('\n', at - 1) + 1;
    b = v.indexOf('\n', at);
    b = b < 0 ? v.length : b + 1;
  }
  return [a, b];
}

function _slkBeforeInput(e) {
  if (!_slk.on || e.target !== _slk.ta || _slk.bypass) return;
  if (typeof _starterAnimRunning === 'function' && _starterAnimRunning() && typeof _starterAnimFlush === 'function') {
    _starterAnimFlush();
  }
  _slkSync();
  const ta = _slk.ta, v = _slk.text;
  if (ta.value !== v) return;
  const t = e.inputType || '';
  if (t === 'historyUndo' || t === 'historyRedo' || t === 'insertCompositionText') return;
  let s = ta.selectionStart, en = ta.selectionEnd;
  let ins = null;

  if (t === 'insertFromDrop' || t === 'deleteByDrag' || t === 'insertTranspose') {
    // Where a drop lands is not something a textarea says; copy and paste does.
    _slkStop(e);
    _slkRefuse('Dragging text is off while the starter code is locked. Copy and paste instead.');
    return;
  }
  if (t === 'insertLineBreak' || t === 'insertParagraph') ins = '\n';
  else if (t.indexOf('insert') === 0) {
    ins = e.data != null ? String(e.data)
      : (e.dataTransfer && e.dataTransfer.getData ? e.dataTransfer.getData('text/plain') : '');
  } else if (t === 'deleteContentBackward') {
    if (s === en) { s = Math.max(0, s - 1); if (s > 0 && /[\uDC00-\uDFFF]/.test(v[s]) && /[\uD800-\uDBFF]/.test(v[s - 1])) s--; }
  } else if (t === 'deleteContentForward') {
    if (s === en) { en = Math.min(v.length, en + 1); if (/[\uD800-\uDBFF]/.test(v[en - 1]) && en < v.length) en++; }
  } else if (t.indexOf('delete') === 0 && t !== 'deleteByCut' && t !== 'deleteContent') {
    /* A word or line at a time: done here either way, because the browser's
       idea of a word is not one this file can see in advance, and guessing
       it short would let the rest of it through. */
    _slkStop(e);
    if (s === en) [s, en] = _slkDeleteSpan(t, s);
    if (!_slkHasStarter(s, en)) {
      _slkExpect(s, en, '');
      _slk.bypass = true;
      try { edReplaceRange(ta, s, en, '', s); } finally { _slk.bypass = false; }
      _slkSync();
    } else if (!_slkTakeMine(s, en, '')) _slkRefuse();
    return;
  } else if (t !== 'deleteByCut' && t !== 'deleteContent') {
    return;                                   // nothing that edits text
  }

  const text = ins || '';
  // Judged by where it goes, not by what the browser says it is: a paste can
  // arrive without its text, and it must not slip into a line for that.
  const inserting = t.indexOf('insert') === 0;
  if (!_slkHasStarter(s, en)) {
    if (inserting && !_slkInsertOk(s, en, text)) { _slkStop(e); _slkRefuse(); return; }
    // When the text is known the sync takes the result up exactly; when it is
    // not, the change is a plain insertion, which the sync's diff gets right.
    if (!inserting || text) _slkExpect(s, en, text);
    return;                                   // the browser does it
  }
  // It reaches into the starter: only your part of the range goes.
  _slkStop(e);
  if (!_slkTakeMine(s, en, text)) _slkRefuse();
}

/** Cancel an edit and keep editor.js's own handler from trying it again. */
function _slkStop(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
}

/* ── Ctrl+A: yours first ──────────────────────────────────────── */

function _slkKeydown(e) {
  if (!_slk.on || e.target !== _slk.ta) return;
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || !(e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) return;
  _slkSync();
  const ta = _slk.ta, m = _slk.mask;
  const runs = [];
  for (let i = 0; i < m.length;) {
    if (m[i]) { i++; continue; }
    let j = i;
    while (j < m.length && !m[j]) j++;
    runs.push([i, j]);
    i = j;
  }
  const s = ta.selectionStart, en = ta.selectionEnd;
  const is = r => s === r[0] && en === r[1];
  if (!runs.length) {
    e.preventDefault();
    if (typeof toast === 'function') toast('Nothing of yours to select yet. The starter code is locked; press Ctrl+A again for all of it.', { type: 'info', duration: 2600 });
    // A second press still selects the whole file, for copying.
    if (_slk.allArmed) { _slk.allArmed = false; ta.setSelectionRange(0, ta.value.length); }
    else _slk.allArmed = true;
    return;
  }
  // The piece the caret is in or next to, else the nearest one.
  let here = runs.find(r => s >= r[0] && s <= r[1]);
  if (!here) {
    let best = Infinity;
    runs.forEach(r => { const d = s < r[0] ? r[0] - s : s - r[1]; if (d < best) { best = d; here = r; } });
  }
  const all = [runs[0][0], runs[runs.length - 1][1]];
  if (is(all) || (runs.length === 1 && is(here))) return;   // third press: the browser selects everything
  e.preventDefault();
  if (is(here)) ta.setSelectionRange(all[0], all[1]);
  else ta.setSelectionRange(here[0], here[1]);
}

/* ── The sign that it is on ───────────────────────────────────── */

function _slkChip(on) {
  let chip = document.getElementById('slk-chip');
  if (!on) { if (chip) chip.hidden = true; return; }
  if (!chip) {
    const row = document.querySelector('.practice-editor-area .editor-toolbar-row');
    const tabs = document.getElementById('practice-file-tabs');
    if (!row || !tabs) return;
    chip = document.createElement('span');
    chip.id = 'slk-chip';
    chip.className = 'slk-chip';
    chip.title = 'The starter code is locked: it cannot be erased or changed. Add your code on a new line, '
      + 'or after the end of a line. Ctrl+A selects your code (press again for all of it, a third time for the whole file).';
    chip.innerHTML = '<i data-lucide="lock"></i><span>Starter locked</span>';
    tabs.after(chip);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: chip });
  }
  chip.hidden = false;
}

/* ── Wiring ───────────────────────────────────────────────────── */

// Capture, so the lock is asked before editor.js's own handlers act.
document.addEventListener('beforeinput', _slkBeforeInput, true);
document.addEventListener('keydown', _slkKeydown, true);
document.addEventListener('input', (e) => {
  if (_slk.on && e.target === _slk.ta) queueMicrotask(_slkSync);
}, true);

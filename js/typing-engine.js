/* ============================================================
   TYPING-ENGINE.JS — the rules of a Memorization Typing test
   ------------------------------------------------------------
   No DOM in here. An engine is a target string and a status per character;
   keys go in, statuses change, and the attempt screen repaints whatever the
   engine marks dirty. Keeping it pure is what lets the replay run the exact
   same rules over the recorded keys, and what lets it be tested in Node.

   The model is a typing test's, applied to a fixed text:
     - words are runs of non-blank characters; a wrong letter is marked and the
       caret moves on; letters past a word's end are "extra";
     - space submits the word (what you did not type is "missed");
     - backspace can only step back into the previous word if that word has a
       mistake in it, unless freedom mode is on.

   Code adds three things on top:
     - Enter is required at line ends, and newlines are part of the text;
     - auto indent: after Enter the next line's indentation fills itself in;
     - auto close: typing an opener fills in its closer (bracket, quote, or an
       HTML element's closing tag) the way an editor inserts it. The caret
       stops in front of it like an editor's does: type the closer and it
       overtypes, type anything else and the caret steps past it.
   ============================================================ */

const MT_UNTYPED = 0;   // still ghost
const MT_OK = 1;        // typed correctly
const MT_BAD = 2;       // typed wrong
const MT_AUTO = 3;      // filled in by auto indent / auto close and passed
const MT_PEND = 4;      // filled in by auto close, caret not past it yet
const MT_MISS = 5;      // skipped with space

function _mtWs(c) { return c === ' ' || c === '\n'; }

/** Accent-insensitive comparison for lazy mode. */
function _mtFold(c) {
  return c.normalize ? c.normalize('NFD').replace(/[̀-ͯ]/g, '') : c;
}

/**
 * A fresh engine.
 * @param {object} o { target, kind:'text'|'code', lang, cls, pairs, settings }
 */
function mtEngineCreate(o) {
  const n = o.target.length;
  const eng = {
    target: o.target,
    kind: o.kind === 'code' ? 'code' : 'text',
    lang: o.lang || null,
    cls: o.cls || null,
    pairs: o.pairs || new Map(),
    settings: Object.assign({
      autoIndent: true, autoClose: true, stopOnError: 'off', freedom: false,
      confidence: 'off', strictSpace: false, lazy: false, difficulty: 'normal'
    }, o.settings || {}),
    st: new Uint8Array(n),
    autoBy: new Int32Array(n).fill(-1),
    at: new Float64Array(n),          // ms since start each position was typed
    typed: new Map(),                 // what was typed at a wrong position
    extras: new Map(),                // gap index -> letters typed past a word's end
    caret: 0,
    keysOk: 0,
    keysBad: 0,
    started: false,
    finished: false,
    failed: '',
    t0: 0,
    log: [],                          // [ms, key] for the replay
    secKeys: [],                      // keystrokes that typed something, per second
    secErr: [],                       // wrong keystrokes per second
    dirty: new Set(),
    dirtyExtras: new Set(),
    _finishNow: false
  };
  _mtAutoIndent(eng);                 // the first line's own indentation
  eng.dirty.clear();
  return eng;
}

/** More text on the end, for time mode. Pairs come in already offset. */
function mtEngineAppend(eng, text, cls, pairs) {
  const old = eng.target.length;
  const n = old + text.length;
  const grow = (A, fill) => {
    const B = new A.constructor(n);
    if (fill !== undefined) B.fill(fill);
    B.set(A);
    return B;
  };
  eng.target += text;
  eng.st = grow(eng.st);
  eng.autoBy = grow(eng.autoBy, -1);
  eng.at = grow(eng.at);
  if (eng.cls && cls) eng.cls = eng.cls.concat(cls);
  if (pairs) pairs.forEach((v, k) => eng.pairs.set(k + old, [v[0] + old, v[1] + old]));
}

function mtWordStart(eng, i) {
  const T = eng.target;
  while (i > 0 && !_mtWs(T[i - 1])) i--;
  return i;
}

function mtWordEnd(eng, i) {
  const T = eng.target;
  while (i < T.length && !_mtWs(T[i])) i++;
  return i;
}

/** Is position i inside its line's leading indentation? */
function _mtInIndent(eng, i) {
  const T = eng.target;
  let k = i - 1;
  while (k >= 0 && T[k] === ' ') k--;
  return k < 0 || T[k] === '\n';
}

function _mtSet(eng, i, s) {
  if (eng.st[i] !== s) { eng.st[i] = s; eng.dirty.add(i); }
}

function _mtAutoIndent(eng) {
  if (eng.kind !== 'code' || !eng.settings.autoIndent) return;
  const T = eng.target;
  while (eng.caret < T.length && T[eng.caret] === ' ' && _mtInIndent(eng, eng.caret) && eng.st[eng.caret] === MT_UNTYPED) {
    eng.autoBy[eng.caret] = -1;
    _mtSet(eng, eng.caret, MT_AUTO);
    eng.caret++;
  }
}

function _mtAutoClose(eng, i) {
  if (eng.kind !== 'code' || !eng.settings.autoClose) return;
  const p = eng.pairs.get(i);
  if (!p) return;
  for (let k = p[0]; k < p[1]; k++) {
    if (eng.st[k] === MT_UNTYPED) { eng.autoBy[k] = i; _mtSet(eng, k, MT_PEND); }
  }
}

/** Does the word ending just before gap position `g` have a mistake in it? */
function _mtWordBeforeHasError(eng, g) {
  const T = eng.target;
  let e = g;
  while (e > 0 && _mtWs(T[e - 1])) e--;
  if (e === 0) return false;
  if ((eng.extras.get(e) || '').length) return true;
  const s = mtWordStart(eng, e - 1);
  for (let k = s; k < e; k++) {
    if (eng.st[k] === MT_BAD || eng.st[k] === MT_MISS) return true;
  }
  return false;
}

/** The word the caret is in (or just ended) has a mistake so far. */
function _mtCurrentWordHasError(eng) {
  const i = eng.caret;
  if ((eng.extras.get(i) || '').length) return true;
  const s = mtWordStart(eng, i);
  for (let k = s; k < i; k++) {
    if (eng.st[k] === MT_BAD || eng.st[k] === MT_MISS) return true;
  }
  return false;
}

/** Turn a position back into ghost, taking its auto-closed partners with it. */
function _mtUntype(eng, k) {
  const p = eng.pairs.get(k);
  if (p && (eng.st[k] === MT_OK || eng.st[k] === MT_BAD)) {
    for (let c = p[0]; c < p[1]; c++) {
      if (eng.autoBy[c] === k && (eng.st[c] === MT_PEND || eng.st[c] === MT_AUTO)) {
        eng.autoBy[c] = -1;
        _mtSet(eng, c, MT_UNTYPED);
      }
    }
  }
  eng.typed.delete(k);
  // an overtyped closer goes back to being the editor's, not ghost
  const by = eng.autoBy[k];
  _mtSet(eng, k, by >= 0 && eng.st[by] === MT_OK ? MT_PEND : MT_UNTYPED);
  if (eng.st[k] === MT_UNTYPED) eng.autoBy[k] = -1;
}

function _mtExtra(eng, c) {
  if (eng.settings.stopOnError === 'letter') return 'stop';
  const k = eng.caret;
  const cur = eng.extras.get(k) || '';
  if (cur.length >= 20) return 'none';
  eng.extras.set(k, cur + c);
  eng.dirtyExtras.add(k);
  return 'bad';
}

/** Mark the rest of the current word as skipped and move to its end. */
function _mtSkipRest(eng) {
  const we = mtWordEnd(eng, eng.caret);
  for (let k = eng.caret; k < we; k++) {
    if (eng.st[k] === MT_PEND) _mtSet(eng, k, MT_AUTO);
    else if (eng.st[k] === MT_UNTYPED) _mtSet(eng, k, MT_MISS);
  }
  eng.caret = we;
}

function _mtSpace(eng, now) {
  const T = eng.target, S = eng.settings, n = T.length;
  const i = eng.caret;
  const exp = T[i];
  if (exp === ' ') {
    if (S.stopOnError === 'word' && _mtCurrentWordHasError(eng)) return 'stop';
    const wordBad = _mtCurrentWordHasError(eng);
    if (eng.kind === 'code' && _mtInIndent(eng, i)) {
      _mtSet(eng, i, MT_OK); eng.at[i] = now; eng.caret++;
      return 'ok';
    }
    // a run of spaces between two words goes in one press
    while (eng.caret < n && T[eng.caret] === ' ') {
      _mtSet(eng, eng.caret, MT_OK); eng.at[eng.caret] = now; eng.caret++;
    }
    return wordBad ? 'okbad' : 'ok';
  }
  if (exp === '\n') {
    if (eng.kind === 'text') return _mtEnter(eng, now);   // either key ends a line of prose
    return 'bad';
  }
  // mid-word, or nothing typed in this word yet
  if (i === mtWordStart(eng, i)) return S.strictSpace ? 'bad' : 'none';
  if (S.stopOnError !== 'off') return 'stop';
  _mtSkipRest(eng);
  if (eng.caret < n && T[eng.caret] === ' ') {
    while (eng.caret < n && T[eng.caret] === ' ') { _mtSet(eng, eng.caret, MT_OK); eng.at[eng.caret] = now; eng.caret++; }
  } else if (eng.caret < n && T[eng.caret] === '\n' && eng.kind === 'text') {
    _mtSet(eng, eng.caret, MT_OK); eng.at[eng.caret] = now; eng.caret++;
  }
  return 'bad';
}

function _mtEnter(eng, now) {
  const T = eng.target, S = eng.settings, n = T.length;
  const i = eng.caret;
  const exp = T[i];
  if (exp === '\n') {
    if (S.stopOnError === 'word' && _mtCurrentWordHasError(eng)) return 'stop';
    const wordBad = _mtCurrentWordHasError(eng);
    _mtSet(eng, i, MT_OK); eng.at[i] = now; eng.caret++;
    _mtAutoIndent(eng);
    return wordBad ? 'okbad' : 'ok';
  }
  if (exp === ' ') return 'bad';
  const we = mtWordEnd(eng, i);
  if ((we >= n || T[we] === '\n') && i !== mtWordStart(eng, i)) {
    if (S.stopOnError !== 'off') return 'stop';
    _mtSkipRest(eng);
    if (eng.caret < n) {
      _mtSet(eng, eng.caret, MT_OK); eng.at[eng.caret] = now; eng.caret++;
      _mtAutoIndent(eng);
    }
    return 'bad';
  }
  return 'bad';
}

function _mtType(eng, c, now) {
  const T = eng.target, S = eng.settings, n = T.length;

  // The caret is in front of something the editor filled in.
  if (eng.caret < n && eng.st[eng.caret] === MT_PEND) {
    if (c === T[eng.caret]) {
      _mtSet(eng, eng.caret, MT_OK); eng.at[eng.caret] = now; eng.caret++;
      return 'ok';
    }
    while (eng.caret < n && eng.st[eng.caret] === MT_PEND) { _mtSet(eng, eng.caret, MT_AUTO); eng.caret++; }
  }

  if (eng.caret >= n) {
    if (c === ' ' || c === '\n') { eng._finishNow = true; return 'none'; }
    return _mtExtra(eng, c);
  }

  if (c === ' ') return _mtSpace(eng, now);
  if (c === '\n') return _mtEnter(eng, now);

  const exp = T[eng.caret];
  if (_mtWs(exp)) return _mtExtra(eng, c);

  const same = S.lazy ? _mtFold(c) === _mtFold(exp) : c === exp;
  const i = eng.caret;
  if (same) {
    _mtSet(eng, i, MT_OK); eng.at[i] = now; eng.caret++;
    _mtAutoClose(eng, i);
    return 'ok';
  }
  if (S.stopOnError === 'letter') return 'stop';
  eng.typed.set(i, c);
  _mtSet(eng, i, MT_BAD); eng.at[i] = now; eng.caret++;
  eng.dirty.add(i);
  return 'bad';
}

/** Tab in code: indentation to the next four-column stop. */
function _mtTab(eng, now) {
  const T = eng.target;
  if (eng.kind !== 'code' || eng.caret >= T.length) return false;
  if (T[eng.caret] !== ' ' || !_mtInIndent(eng, eng.caret)) return false;
  let ls = eng.caret;
  while (ls > 0 && T[ls - 1] !== '\n') ls--;
  let col = eng.caret - ls;
  const stop = (Math.floor(col / 4) + 1) * 4;
  while (eng.caret < T.length && T[eng.caret] === ' ' && col < stop) {
    _mtSet(eng, eng.caret, MT_OK); eng.at[eng.caret] = now; eng.caret++; col++;
  }
  return true;
}

function _mtBackspace(eng) {
  const T = eng.target, S = eng.settings;
  if (S.confidence === 'max') return false;
  const ex = eng.extras.get(eng.caret);
  if (ex) {
    if (ex.length > 1) eng.extras.set(eng.caret, ex.slice(0, -1));
    else eng.extras.delete(eng.caret);
    eng.dirtyExtras.add(eng.caret);
    return true;
  }
  let p = eng.caret - 1;
  while (p >= 0 && eng.st[p] === MT_AUTO) p--;
  if (p < 0) return false;

  // a run of spaces between words goes back as one, the way it went in
  let q = p;
  if (T[p] === ' ' && !(eng.kind === 'code' && _mtInIndent(eng, p))) {
    while (q - 1 >= 0 && T[q - 1] === ' ' && eng.st[q - 1] === MT_OK) q--;
  }
  const crossing = _mtWs(T[p]) && (q === 0 || !_mtWs(T[q - 1]) || eng.st[q - 1] === MT_AUTO);
  if (crossing) {
    if (S.confidence === 'on') return false;
    if (!S.freedom && !_mtWordBeforeHasError(eng, q)) return false;
  }
  // un-pass the filled-in positions between here and the caret
  for (let k = p + 1; k < eng.caret; k++) {
    if (eng.st[k] === MT_AUTO) {
      if (eng.autoBy[k] >= 0) _mtSet(eng, k, MT_PEND);
      else _mtSet(eng, k, MT_UNTYPED);
    }
  }
  for (let k = p; k >= q; k--) _mtUntype(eng, k);
  eng.caret = q;

  if (crossing) {
    // back into a word that was skipped: resume where you stopped typing it
    let m = eng.caret;
    while (m - 1 >= 0 && (eng.st[m - 1] === MT_MISS || (eng.st[m - 1] === MT_AUTO && eng.autoBy[m - 1] >= 0))) m--;
    for (let k = eng.caret - 1; k >= m; k--) {
      if (eng.st[k] === MT_MISS) _mtSet(eng, k, MT_UNTYPED);
      else _mtSet(eng, k, MT_PEND);
    }
    eng.caret = m;
  }
  return true;
}

/** Is the caret at the start of a word (nothing of it typed)? */
function _mtAtWordStart(eng) {
  const T = eng.target;
  if ((eng.extras.get(eng.caret) || '').length) return false;
  let p = eng.caret - 1;
  while (p >= 0 && eng.st[p] === MT_AUTO) p--;
  return p < 0 || _mtWs(T[p]);
}

function _mtCtrlBackspace(eng) {
  if (eng.settings.confidence === 'max') return false;
  let moved = false;
  if (eng.extras.get(eng.caret)) { eng.extras.delete(eng.caret); eng.dirtyExtras.add(eng.caret); moved = true; }
  if (!moved && _mtAtWordStart(eng)) {
    if (!_mtBackspace(eng)) return false;
    moved = true;
    if (eng.extras.get(eng.caret)) { eng.extras.delete(eng.caret); eng.dirtyExtras.add(eng.caret); }
  }
  let guard = 0;
  while (!_mtAtWordStart(eng) && guard++ < 400) {
    if (!_mtBackspace(eng)) break;
    moved = true;
  }
  return moved;
}

/** Has everything been typed? Trailing filled-in closers count as typed. */
function _mtAllTyped(eng) {
  let k = eng.caret;
  const n = eng.target.length;
  while (k < n && eng.st[k] === MT_PEND) k++;
  return k >= n;
}

/**
 * One key. `key` is a character, ' ', 'Enter', 'Tab', 'Backspace' or
 * 'CtrlBackspace'. `now` is performance.now().
 * Returns { result, finished, fail, action }:
 *   result  'ok' | 'bad' | 'stop' (refused) | 'none' (ignored) | 'back'
 *   action  'tab' when Tab was not indentation and belongs to the screen
 */
function mtEngineKey(eng, key, now) {
  const out = { result: 'none', finished: false, fail: '', action: '' };
  if (eng.finished) return out;
  const S = eng.settings;

  if (key === 'Backspace' || key === 'CtrlBackspace') {
    const moved = key === 'Backspace' ? _mtBackspace(eng) : _mtCtrlBackspace(eng);
    if (moved && eng.started) eng.log.push([now - eng.t0, key]);
    out.result = moved ? 'back' : 'none';
    return out;
  }

  if (key === 'Tab' && !(eng.kind === 'code' && eng.caret < eng.target.length &&
      eng.target[eng.caret] === ' ' && _mtInIndent(eng, eng.caret))) {
    out.action = 'tab';
    return out;
  }

  if (!eng.started) { eng.started = true; eng.t0 = now; }
  const t = now - eng.t0;
  let r;
  if (key === 'Tab') { _mtTab(eng, t); r = 'ok'; }
  else r = _mtType(eng, key === 'Enter' ? '\n' : key, t);

  if (r !== 'none') eng.log.push([t, key]);
  const sec = Math.floor(t / 1000);
  if (r === 'ok' || r === 'okbad' || r === 'bad' || r === 'stop') {
    eng.secKeys[sec] = (eng.secKeys[sec] || 0) + 1;
  }
  if (r === 'ok' || r === 'okbad') eng.keysOk++;
  if (r === 'bad' || r === 'stop') {
    eng.keysBad++;
    eng.secErr[sec] = (eng.secErr[sec] || 0) + 1;
  }

  // difficulty: expert fails a submitted word with a mistake, master any mistake
  if (S.difficulty === 'master' && (r === 'bad' || r === 'stop')) out.fail = 'master';
  if (S.difficulty === 'expert' && (r === 'okbad' || (r === 'bad' && (key === ' ' || key === 'Enter')))) out.fail = 'expert';

  out.result = (r === 'okbad') ? 'ok' : r;

  if (!out.fail && eng._finishNow) out.finished = true;
  else if (!out.fail && _mtAllTyped(eng)) {
    // the last word has to be right to end on it; otherwise space ends it
    const n = eng.target.length;
    if (!(eng.extras.get(n) || '').length && !_mtWordBeforeHasError(eng, n)) out.finished = true;
  }
  if (out.finished) {
    for (let k = eng.caret; k < eng.target.length; k++) if (eng.st[k] === MT_PEND) _mtSet(eng, k, MT_AUTO);
    eng.caret = Math.max(eng.caret, eng.target.length);
  }
  return out;
}

/**
 * Where a test stands.
 * wpm counts the characters of correctly typed words (and the spaces after
 * them); raw counts everything typed. Indentation the editor filled in does
 * not count toward either — it was not typed.
 */
function mtEngineStats(eng, ms) {
  const T = eng.target, st = eng.st;
  const upto = Math.min(eng.caret, T.length);
  let good = 0, raw = 0, cOk = 0, cBad = 0, cMiss = 0, cExtra = 0;
  let wordsDone = 0, wordsTotal = 0;
  let prevGood = false;
  let i = 0;
  while (i < T.length) {
    if (_mtWs(T[i])) {
      if (i < upto) {
        const s = st[i];
        const typedByYou = s === MT_OK || (s === MT_AUTO && eng.autoBy[i] >= 0);
        if (typedByYou) { cOk++; raw++; if (prevGood) good++; }
      }
      i++;
      continue;
    }
    const we = mtWordEnd(eng, i);
    wordsTotal++;
    if (i >= upto && st[i] !== MT_PEND) { i = we; prevGood = false; continue; }
    let ok = true, okChars = 0;
    for (let k = i; k < we; k++) {
      const s = k < upto ? st[k] : (st[k] === MT_PEND ? MT_PEND : MT_UNTYPED);
      if (s === MT_OK || s === MT_AUTO) { cOk++; raw++; okChars++; }
      else if (s === MT_BAD) { cBad++; raw++; ok = false; }
      else if (s === MT_MISS) { cMiss++; ok = false; }
    }
    const ex = (eng.extras.get(we) || '').length;
    if (ex) { cExtra += ex; raw += ex; ok = false; }
    const complete = we <= upto;
    if (complete) wordsDone++;
    if (ok) good += complete ? (we - i) : okChars;
    prevGood = ok && complete;
    i = we;
  }
  const min = Math.max(ms, 1) / 60000;
  const keys = eng.keysOk + eng.keysBad;
  return {
    wpm: good / 5 / min,
    raw: raw / 5 / min,
    acc: keys ? (eng.keysOk / keys) * 100 : 100,
    chars: { correct: cOk, incorrect: cBad, extra: cExtra, missed: cMiss },
    wordsDone,
    wordsTotal
  };
}

/** Typing speed per word, from when its gap was typed to its last letter. */
function mtWordBurst(eng, s, e) {
  if (e <= s) return 0;
  let t1 = 0;
  for (let k = s; k < e; k++) t1 = Math.max(t1, eng.at[k]);
  let t0 = s > 0 ? eng.at[s - 1] : 0;
  if (!t0 || t0 > t1) t0 = eng.at[s];
  const dt = Math.max(t1 - t0, 120);
  return ((e - s) / 5) / (dt / 60000);
}

/** 100 when every second ran at the same speed; lower the more it wavered. */
function mtConsistency(values) {
  const v = values.filter(x => isFinite(x));
  if (v.length < 2) return v.length ? 100 : 0;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  if (mean <= 0) return 0;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / v.length);
  const cov = sd / mean;
  return Math.max(0, 100 * (1 - Math.tanh(cov + Math.pow(cov, 3) / 3 + Math.pow(cov, 5) / 5)));
}

/* ── Zen: from memory, on a blank page ─────────────────────── */

/**
 * The fewest edits from `ref` to `typed`, as per-character marks on `ref`
 * plus the letters `typed` added. Myers' O(ND) diff, so a near-perfect recall
 * of a long text is fast; a very bad one falls back to a straight comparison.
 */
function mtDiff(ref, typed) {
  const a = ref, b = typed;
  const N = a.length, M = b.length, MAX = N + M;
  /* Each step keeps only the diagonals it can reach (2d+1 of them), so the
     trace is ~d² integers rather than d × (N+M). 1200 edits is far past a
     recall worth diffing letter by letter. */
  const LIMIT = Math.min(MAX, 1200);
  const V = new Int32Array(2 * MAX + 2);
  const trace = [];
  let found = -1;
  for (let d = 0; d <= LIMIT; d++) {
    trace.push(V.slice(Math.max(0, MAX - d - 1), MAX + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && V[MAX + k - 1] < V[MAX + k + 1])) x = V[MAX + k + 1];
      else x = V[MAX + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && a[x] === b[y]) { x++; y++; }
      V[MAX + k] = x;
      if (x >= N && y >= M) { found = d; break; }
    }
    if (found >= 0) break;
  }
  const marks = new Array(N).fill('miss');
  const inserted = new Map();      // ref index -> letters inserted before it
  if (found < 0) {
    for (let i = 0; i < N; i++) marks[i] = i < M ? (a[i] === b[i] ? 'ok' : 'bad') : 'miss';
    if (M > N) inserted.set(N, b.slice(N));
    return { marks, inserted };
  }
  // walk the trace back to recover the path
  let x = N, y = M;
  const ops = [];
  for (let d = found; d > 0; d--) {
    const Vd = trace[d];
    const base = Math.max(0, MAX - d - 1);       // where this step's slice began
    const at = (k) => Vd[MAX + k - base];
    const k = x - y;
    let prevK;
    if (k === -d || (k !== d && at(k - 1) < at(k + 1))) prevK = k + 1;
    else prevK = k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push(['eq', x - 1, y - 1]); x--; y--; }
    if (x === prevX) ops.push(['ins', x, y - 1]);
    else ops.push(['del', x - 1, y]);
    x = prevX; y = prevY;
  }
  while (x > 0 && y > 0) { ops.push(['eq', x - 1, y - 1]); x--; y--; }
  ops.reverse();
  // a deletion right next to an insertion is a substitution: one wrong letter
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op[0] === 'eq') marks[op[1]] = 'ok';
    else if (op[0] === 'del') {
      const nx = ops[i + 1];
      if (nx && nx[0] === 'ins') { marks[op[1]] = 'bad'; i++; }
      else marks[op[1]] = 'miss';
    } else {
      const nx = ops[i + 1];
      if (nx && nx[0] === 'del') { marks[nx[1]] = 'bad'; i++; }
      else inserted.set(op[1], (inserted.get(op[1]) || '') + b[op[2]]);
    }
  }
  return { marks, inserted };
}

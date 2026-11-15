/* ============================================================
   DRILL-GEN.JS — where drill questions come from, and five more kinds
   ------------------------------------------------------------
   drills.js asked two questions of the 32 walkthroughs: what does it print,
   and which line is broken. This widens both the material and the asking.

   SOURCES. Walkthroughs; programs you have PASSED (an unsolved program's
   reference is its answer, so it is never used -- nor a hidden one); and your
   templates (their canonical form, and with a harness the whole program it
   runs in). "Mine" is all three. A concept narrows any of them to programs
   and templates that use it (the skill tree's Quick drills).

   KINDS. Each generator returns null when it cannot build an honest question
   from an entry, and the deck only offers what was built:
     trace    the interpreter (cvm-*.js) runs the program to a line and the
              question asks for the values it found there -- never one that
              was not set, never a pointer's address
     blanks   one token run cut out of a line: a condition, a format string,
              the arguments of a call, the right side of an assignment
     puzzle   5-12 lines shuffled, with one line that does not belong
     flash    a few lines shown briefly, then written back from memory
     errors   a compiler message and the line it points at: name the cause
              and fix the line
   ============================================================ */

const DRILL_SOURCES = [
  { id: 'mine', label: 'Mine', hint: 'Walkthroughs, programs you have passed and your templates' },
  { id: 'lessons', label: 'Walkthroughs', hint: 'The 32 walkthrough programs' },
  { id: 'passed', label: 'Passed programs', hint: 'Programs you have passed (never one you have not: its code is the answer)' },
  { id: 'templates', label: 'Templates', hint: 'Your templates, as written' }
];

const _dgPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ── The corpus ────────────────────────────────────────────── */

/**
 * Everything a source offers, in one shape:
 *   { key, title, file, code, full, stdin, expected, concepts }
 * code = what is shown for code-only kinds; full = a whole runnable program
 * (or null); expected = what full prints on stdin (or null when unknown).
 * @param {string} source a DRILL_SOURCES id, optionally ':<concept>'
 */
function drillCorpus(source) {
  const [src, concept] = String(source || 'mine').split(':');
  const out = [];
  const want = (s) => src === 'mine' || src === s;
  if (want('lessons') && !concept) {
    (typeof DEMO_LESSONS !== 'undefined' ? DEMO_LESSONS : []).forEach(l => {
      if (!l || !l.code) return;
      const o = typeof _drillFinalOut === 'function' ? _drillFinalOut(l) : '';
      out.push({ key: 'L:' + l.id, title: l.title, file: l.file || 'demo.c', code: l.code, full: l.code,
        stdin: '', expected: o && o.indexOf('‸') === -1 ? o : null, concepts: [] });
    });
  }
  if (want('passed')) {
    (state.challenges || []).forEach(c => {
      if (!c || typeof programPassed !== 'function' || !programPassed(c.id)) return;
      if (typeof browseIsHidden === 'function' && browseIsHidden(c)) return;
      const v = (c.variants || [])[0];
      if (!v) return;
      const files = (v.files && v.files.length ? v.files : [{ name: 'main', ext: '.c', code: v.code }]).filter(f => f.ext !== '.txt');
      if (files.length !== 1 || !String(files[0].code || '').trim()) return;   // one file only: it must stand alone
      const concepts = typeof conceptsOf === 'function' ? conceptsOf(c) : [];
      if (concept && concepts.indexOf(concept) === -1) return;
      const t = (v.tests || [])[0];
      out.push({ key: 'P:' + c.id, title: c.title, file: files[0].name + files[0].ext, code: files[0].code, full: files[0].code,
        stdin: t ? String(t.stdin || '') : '', expected: t && typeof t.expected === 'string' ? t.expected : null, concepts });
    });
  }
  if (want('templates')) {
    (state.templates || []).forEach(t => {
      if (!t || !t.body) return;
      if (concept && (t.concepts || []).indexOf(concept) === -1) return;
      const code = tplCanonical(t);
      const full = t.harness ? tplHarnessSource(t, code, {}) : null;
      out.push({ key: 'T:' + t.id, title: t.title, file: 'template.c', code, full,
        stdin: t.harness ? (t.harness.stdin || '') : '', expected: t.harness ? t.harness.expect : null, concepts: t.concepts || [] });
    });
  }
  return out;
}

/* ── Predict, from any source ──────────────────────────────── */

function drillMakePredict(e) {
  if (!e.full || e.expected === null || e.expected === undefined) return null;
  if (String(e.expected).split('\n').length > 12) return null;   // too long to type honestly
  return { mode: 'predict', key: e.key, title: e.title, file: e.file, code: e.full, stdin: e.stdin || '',
    expected: e.expected, fgCode: e.full,
    ask: e.stdin ? 'Given the input below, what does this print?' : 'What does this print?' };
}

function drillMakeFixFrom(e) {
  if (typeof _drillMakeFix !== 'function') return null;
  const q = _drillMakeFix({ id: e.key, title: e.title, file: e.file, code: e.code });
  if (q) { q.key = e.key; q.fgCode = e.code; }
  return q;
}

/* ── Trace ─────────────────────────────────────────────────── */

function _dgFlatVars(nodes) {
  const out = [];
  (nodes || []).forEach(n => {
    if (!n || !n.name) return;
    if ((n.kind === 'scalar' || n.kind === 'char') && !n.unset && n.value !== '' && n.value !== '?') out.push(n);
  });
  return out;
}

/** Answers a trace question accepts for one variable. */
function _dgAccept(n) {
  const out = [String(n.value)];
  if (n.kind === 'char') {
    if (typeof n.raw === 'number') out.push(String(n.raw));
    const m = /^'(.)'$/.exec(String(n.value));
    if (m) out.push(m[1]);                         // a, as well as 'a' and 97
  }
  return out;
}

/**
 * "The first time line N has run, what are these variables?"
 * Asked of a line inside a function body, about two to four of that frame's
 * ordinary variables that hold a value by then.
 */
function drillMakeTrace(e) {
  if (!e.full || typeof CVM === 'undefined' || !CVM.parseProgram) return null;
  let prog;
  try { prog = CVM.parseProgram([{ name: 'main.c', code: e.full }]); } catch (err) { return null; }
  const lines = e.full.split('\n');
  const cand = [];
  let off = 0;
  lines.forEach((l, i) => {
    const t = l.trim();
    if (/;\s*$/.test(t) && !/^(#|\/\/|return\b|printf|puts|putchar|scanf|fprintf|free)/.test(t) && /=|\+\+|--/.test(t)) cand.push({ line: i + 1, at: off + l.length });
    off += l.length + 1;
  });
  for (let tries = 0; tries < 6 && cand.length; tries++) {
    const c = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
    let tgt, r;
    try {
      tgt = CVM.targetAt(prog, 0, c.at);
      if (!tgt || tgt.entering) continue;
      r = CVM.runProgram(prog, { stdin: e.stdin || '', target: tgt.target, maxSteps: 200000, timeMs: 150 });
    } catch (err) { continue; }
    if (!r || r.error || !r.snaps || !r.snaps.length) continue;
    let view;
    try { view = CVM.describe(r.snaps[0], prog, {}); } catch (err) { continue; }
    const frame = (view.frames || []).find(f => f && tgt.fn && (f.fn === tgt.fn.name || f.name === tgt.fn.name)) || (view.frames || [])[0];
    const vars = _dgFlatVars(frame && frame.vars);
    if (vars.length < 1) continue;
    const shuffled = vars.sort(() => Math.random() - 0.5).slice(0, Math.min(4, Math.max(2, vars.length)));
    return {
      mode: 'trace', key: e.key, title: e.title, file: e.file, code: e.full, stdin: e.stdin || '', line: c.line, fgCode: e.full,
      vars: shuffled.map(n => ({ name: n.name, want: _dgAccept(n), show: String(n.value) })),
      ask: 'The first time line ' + c.line + ' has run, what do these hold?'
    };
  }
  return null;
}

/* ── Blanks ────────────────────────────────────────────────── */

/* The part of a line worth hiding, best first. Each returns [start, end) or null. */
const DG_BLANK_SPOTS = [
  (l) => { const m = /\b(if|while)\s*\((.+)\)\s*\{?\s*$/.exec(l); return m ? [l.indexOf(m[2], m.index), l.indexOf(m[2], m.index) + m[2].length] : null; },
  (l) => { const m = /\bfor\s*\(([^;]*);([^;]*);([^)]*)\)/.exec(l); if (!m) return null; const part = m[2].trim() ? m[2] : m[3]; const s = l.indexOf(part, m.index + 4); return [s, s + part.length]; },
  (l) => { const m = /\b(printf|scanf|fprintf)\s*\(\s*(?:\w+\s*,\s*)?("(?:[^"\\]|\\.)*")/.exec(l); return m ? [l.indexOf(m[2], m.index), l.indexOf(m[2], m.index) + m[2].length] : null; },
  (l) => { const m = /\b[a-z_]\w*\s*\(([^()]+)\)\s*;\s*$/i.exec(l); return m && !/^\s*(if|while|for|return)\b/.test(l) ? [l.lastIndexOf(m[1]), l.lastIndexOf(m[1]) + m[1].length] : null; },
  (l) => { const m = /[^=!<>]=\s*([^=;][^;]*);\s*$/.exec(l); return m ? [l.lastIndexOf(m[1]), l.lastIndexOf(m[1]) + m[1].trimEnd().length] : null; }
];

/* Different spellings of the same thing that a blank should accept. */
function _dgEquivalent(a, b) {
  const t = (s) => (typeof tplTokens === 'function' ? tplTokens(s) : String(s).replace(/\s+/g, '').split('')).join(' ');
  const A = t(a), B = t(b);
  if (A === B) return true;
  const inc = (s) => {
    let m = /^(\w+) \+\+$/.exec(s) || /^\+\+ (\w+)$/.exec(s) || /^(\w+) \+= 1$/.exec(s) || /^(\w+) = \1 \+ 1$/.exec(s);
    if (m) return 'inc:' + m[1];
    m = /^(\w+) --$/.exec(s) || /^-- (\w+)$/.exec(s) || /^(\w+) -= 1$/.exec(s) || /^(\w+) = \1 - 1$/.exec(s);
    return m ? 'dec:' + m[1] : null;
  };
  const ia = inc(A), ib = inc(B);
  return !!ia && ia === ib;
}

function drillMakeBlanks(e) {
  const lines = String(e.code || '').split('\n');
  const order = lines.map((l, i) => i).sort(() => Math.random() - 0.5);
  for (const i of order) {
    const l = lines[i];
    if (!l.trim() || /^\s*(#|\/\/)/.test(l)) continue;
    for (const spot of DG_BLANK_SPOTS) {
      const r = spot(l);
      if (!r || r[0] < 0 || r[1] <= r[0]) continue;
      const want = l.slice(r[0], r[1]);
      if (want.trim().length < 2 || want.length > 60) continue;
      const shown = lines.slice();
      shown[i] = l.slice(0, r[0]) + '▁▁▁' + l.slice(r[1]);
      return { mode: 'blanks', key: e.key, title: e.title, file: e.file, code: shown.join('\n'), line: i + 1,
        want: want.trim(), fgCode: e.code, ask: 'Fill in the gap on line ' + (i + 1) + '.' };
    }
  }
  return null;
}

/* ── Line puzzle ───────────────────────────────────────────── */

function drillMakePuzzle(e) {
  const all = String(e.code || '').split('\n').map(s => s.replace(/\s+$/, '')).filter(s => s.trim() && !/^\s*\/\//.test(s));
  if (all.length < 5) return null;
  let start = 0, len = all.length;
  if (len > 12) { len = 8 + Math.floor(Math.random() * 4); start = Math.floor(Math.random() * (all.length - len + 1)); }
  const real = all.slice(start, start + len);
  // The odd one out: a real line broken the way a beginner breaks it.
  let odd = null;
  const muts = (typeof DRILL_MUTATIONS !== 'undefined' ? DRILL_MUTATIONS : []).slice().sort(() => Math.random() - 0.5);
  for (const m of muts) {
    const spots = real.filter(l => m.hit(l) && m.break(l) !== l);
    if (!spots.length) continue;
    const broken = m.break(_dgPick(spots));
    if (real.every(l => l.trim() !== broken.trim())) { odd = broken; break; }
  }
  const pieces = real.map((t, i) => ({ id: 'r' + i, text: t }));
  if (odd) pieces.push({ id: 'x', text: odd });
  pieces.sort(() => Math.random() - 0.5);
  if (pieces.every((p, i) => p.id === 'r' + i)) pieces.reverse();   // never already solved
  return { mode: 'puzzle', key: e.key, title: e.title, file: e.file, pieces, order: real, odd: odd ? 'x' : null,
    fgCode: real.join('\n'), ask: odd ? 'Put the lines in order. One of them does not belong: set it aside.' : 'Put the lines in order.' };
}

/* ── Chunk flash ───────────────────────────────────────────── */

function drillMakeFlash(e) {
  const all = String(e.code || '').split('\n');
  if (all.filter(s => s.trim()).length < 3) return null;
  const len = Math.min(all.length, 4 + Math.floor(Math.random() * 5));
  const start = Math.floor(Math.random() * (all.length - len + 1));
  const chunk = all.slice(start, start + len).join('\n').replace(/^\n+|\s+$/g, '');
  if (chunk.split('\n').filter(s => s.trim()).length < 3) return null;
  const per = Number((state.trainPrefs || {}).flashPerLine) || 0.6;
  return { mode: 'flash', key: e.key, title: e.title, file: e.file, code: chunk, fgCode: chunk,
    seconds: Math.round((2 + per * chunk.split('\n').length) * 10) / 10,
    ask: 'Read it. When it disappears, write it back.' };
}

/* ── Errors ────────────────────────────────────────────────── */

/* A fault, how to put it into a line, and the message the compiler gives. */
const DG_ERROR_CASES = [
  { code: 'missing-semicolon', hit: (l, next) => /;\s*$/.test(l) && !/^\s*(#|\/\/|for\b)/.test(l) && !!next,
    breakIt: (l) => l.replace(/;(\s*)$/, '$1'),
    msg: (file, n, l, next) => `${file}:${n + 1}: error: expected ';' before '${(next.trim().match(/^[\w}]+|^./) || ['}'])[0]}'` },
  { code: 'scanf-no-ampersand', hit: (l) => /scanf\s*\([^)]*,\s*&\s*\w/.test(l),
    breakIt: (l) => l.replace(/,(\s*)&(\s*)(\w)/, ',$1$3'),
    msg: (file, n) => `${file}:${n}: warning: format '%d' expects argument of type 'int *', but argument 2 has type 'int'` },
  { code: 'assign-in-condition', hit: (l) => /\b(if|while)\s*\([^)]*==/.test(l),
    breakIt: (l) => l.replace('==', '='),
    msg: (file, n) => `${file}:${n}: warning: suggest parentheses around assignment used as truth value` },
  { code: 'format-mismatch', hit: (l) => /printf\s*\("[^"]*%d[^"]*"\s*,/.test(l),
    breakIt: (l) => l.replace('%d', '%s'),
    msg: (file, n) => `${file}:${n}: warning: format '%s' expects argument of type 'char *', but argument 2 has type 'int'` },
  { code: 'undeclared', hit: (l) => /^\s*\w[\w\s]*=\s*[^;]*\b[a-z_]{4,}\w*\b/.test(l) && !/^\s*(int|char|long|double|float|struct|const|unsigned)\b/.test(l),
    breakIt: (l) => { const m = /=\s*[^;]*?\b([a-z_]{4,}\w*)\b/.exec(l); return m && !/^(sizeof|malloc|NULL|strlen|printf)$/.test(m[1]) ? l.replace(new RegExp('\\b' + m[1] + '\\b'), m[1].slice(0, -1)) : l; },
    msg: (file, n, l, next, broken) => { const m = /=\s*[^;]*?\b([a-z_]{3,}\w*)\b/.exec(broken); return `${file}:${n}: error: '${m ? m[1] : 'x'}' undeclared (first use in this function)`; } }
];

function drillMakeErrors(e) {
  const lines = String(e.code || '').split('\n');
  const cases = DG_ERROR_CASES.slice().sort(() => Math.random() - 0.5);
  for (const c of cases) {
    const spots = [];
    lines.forEach((l, i) => {
      const next = lines.slice(i + 1).find(s => s.trim());
      if (!c.hit(l, next)) return;
      const broken = c.breakIt(l);
      if (broken === l) return;
      if (lines.filter(x => x.trim() === l.trim()).length > 1) return;
      spots.push({ i, l, broken, next });
    });
    if (!spots.length) continue;
    const s = _dgPick(spots);
    const shown = lines.slice();
    shown[s.i] = s.broken;
    const meta = (typeof MISTAKE_BY_CODE !== 'undefined' && MISTAKE_BY_CODE[c.code]) || { label: c.code };
    const others = (typeof MISTAKE_RULES !== 'undefined' ? MISTAKE_RULES : [])
      .filter(r => r.code !== c.code && !/^(wrong-output|timeout|segfault)$/.test(r.code))
      .sort(() => Math.random() - 0.5).slice(0, 3).map(r => ({ code: r.code, label: r.label }));
    const choices = others.concat([{ code: c.code, label: meta.label }]).sort(() => Math.random() - 0.5);
    return { mode: 'errors', key: e.key, title: e.title, file: e.file, code: shown.join('\n'), line: s.i + 1,
      message: c.msg(e.file || 'main.c', s.i + 1, s.l, s.next || '', s.broken), choices, wantCode: c.code,
      want: s.l, fgCode: e.code, why: meta.why || '', fix: meta.fix || '',
      ask: 'What is wrong, and what should line ' + (s.i + 1) + ' say?' };
  }
  return null;
}

const DRILL_MAKERS = {
  predict: drillMakePredict, fix: drillMakeFixFrom, trace: drillMakeTrace, blanks: drillMakeBlanks,
  puzzle: drillMakePuzzle, flash: drillMakeFlash, errors: drillMakeErrors
};

/* Sure-and-wrong questions come back first next time (state.drillLog). */
function drillSureWrong() {
  if (!state.drillLog || !Array.isArray(state.drillLog.sureWrong)) state.drillLog = Object.assign({}, state.drillLog || {}, { sureWrong: [] });
  return state.drillLog.sureWrong;
}

function drillNoteSure(q, ok) {
  const list = drillSureWrong();
  const at = list.findIndex(x => x.mode === q.mode && x.key === q.key);
  if (ok && at !== -1) list.splice(at, 1);
  if (!ok && at === -1) { list.push({ mode: q.mode, key: q.key, at: Date.now() }); if (list.length > 100) list.shift(); }
  if (typeof saveData === 'function') saveData();
}

/**
 * A deck for one kind from one source: sure-and-wrong ones first, then the
 * rest shuffled. 'mix' takes one of each kind in turn.
 */
function drillDeckFrom(mode, source, n) {
  const corpus = drillCorpus(source).sort(() => Math.random() - 0.5);
  if (mode === 'mix') {
    const kinds = ['predict', 'trace', 'fix', 'blanks', 'puzzle', 'errors', 'flash'].sort(() => Math.random() - 0.5);
    const out = [];
    for (const k of kinds) {
      for (const e of corpus) { const q = DRILL_MAKERS[k](e); if (q) { out.push(q); break; } }
      if (out.length >= (n || 5)) break;
    }
    return out;
  }
  const make = DRILL_MAKERS[mode];
  if (!make) return [];
  const again = new Set(drillSureWrong().filter(x => x.mode === mode).map(x => x.key));
  corpus.sort((a, b) => (again.has(b.key) ? 1 : 0) - (again.has(a.key) ? 1 : 0));
  const out = [];
  for (const e of corpus) {
    const q = make(e);
    if (q) out.push(q);
    if (n && out.length >= n) break;
  }
  return out;
}

/* ── Marking the new kinds ─────────────────────────────────── */

function drillCheckMore(q, answer) {
  if (q.mode === 'trace') {
    const wrong = q.vars.filter((v, i) => v.want.indexOf(String((answer || [])[i] || '').trim().replace(/^'(.)'$/, "'$1'")) === -1);
    return wrong.length
      ? { ok: false, why: wrong.length === q.vars.length ? 'None of them. Walk it from the top, a line at a time.' : 'Close: ' + wrong.map(v => v.name).join(', ') + ' ' + (wrong.length === 1 ? 'is' : 'are') + ' not right.', want: q.vars.map(v => v.name + ' = ' + v.show).join('\n') }
      : { ok: true, why: 'Every value right.', want: '' };
  }
  if (q.mode === 'blanks') {
    return _dgEquivalent(answer, q.want) ? { ok: true, why: 'That is it.', want: q.want }
      : { ok: false, why: 'Not what goes there.', want: q.want };
  }
  if (q.mode === 'puzzle') {
    const ids = answer || [];
    const placed = ids.map(id => (q.pieces.find(p => p.id === id) || {}).text);
    const right = placed.length === q.order.length && placed.every((t, i) => String(t).trim() === q.order[i].trim());
    const oddIn = q.odd && ids.indexOf(q.odd) !== -1;
    if (right) return { ok: true, why: q.odd ? 'In order, and the odd one out set aside.' : 'In order.', want: '' };
    return { ok: false, why: oddIn ? 'The line that does not belong is still in.' : 'Not quite in order.', want: q.order.join('\n') };
  }
  if (q.mode === 'flash') {
    const pct = tplScore(answer || '', q.code);
    return { ok: pct >= 90, why: pct + '% of it came back' + (pct >= 90 ? '.' : '. Read it again and look for the shape.'), want: q.code, pct };
  }
  if (q.mode === 'errors') {
    const a = answer || {};
    const causeOk = a.cause === q.wantCode;
    const lineOk = typeof _drillNormLine === 'function' && _drillNormLine(a.line) === _drillNormLine(q.want);
    const why = (causeOk ? 'Right cause' : 'Not that cause') + (lineOk ? ', and the right fix.' : ', and the line is not fixed yet.')
      + (q.fix ? ' ' + q.fix : '');
    return { ok: causeOk && lineOk, why, want: q.want };
  }
  return null;
}

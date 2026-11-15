/* ============================================================
   DRILLS.JS — reading and repairing, not writing
   ------------------------------------------------------------
   Every exercise in this app asks the same thing: here is a problem, write a
   solution. That is one skill out of three, and it is the one that depends on
   the other two. Debugging is reading; writing correct code the first time is
   predicting what your own code will do.

   TWO MODES, NEITHER OF WHICH NEEDS A COMPILER.

   PREDICT — the program, and the question "what does it print". This is the
   highest-value exercise for building a model of execution, and it is what the
   walkthroughs already do in reverse: they SHOW the execution. Predicting it
   is the same idea with the answer withheld.

   FIX — the program with exactly one thing broken in it, and the question
   "which line, and what should it say". This is the highest-transfer skill to
   real work, and the app now produces the fault taxonomy to build it from:
   every mutation below is a mistake mistakes.js already classifies.

   THE CONTENT COSTS NOTHING TO AUTHOR, which is the point. Both decks are
   generated from DEMO_LESSONS — 32 programs whose outputs were authored
   step-by-step for the walkthroughs and are therefore already correct. 25 of
   them read no input, so their output is deterministic and can be asked for
   directly; all 32 can be broken.
   ============================================================ */

const DRILL_MODES = [
  { id: 'predict', label: 'Predict', icon: 'terminal',
    blurb: 'Read the program. Say exactly what it prints.' },
  { id: 'trace', label: 'Trace', icon: 'activity',
    blurb: 'Say what the variables hold when a line has run.' },
  { id: 'fix', label: 'Find the bug', icon: 'bug',
    blurb: 'One line is wrong. Type what it should say.' },
  { id: 'blanks', label: 'Blanks', icon: 'text-cursor-input',
    blurb: 'A piece of a line is missing. Type it.' },
  { id: 'puzzle', label: 'Line puzzle', icon: 'list-ordered',
    blurb: 'Put shuffled lines back in order; one does not belong.' },
  { id: 'flash', label: 'Chunk flash', icon: 'zap',
    blurb: 'Read a few lines, then write them back from memory.' },
  { id: 'errors', label: 'Errors', icon: 'alert-octagon',
    blurb: 'A compiler message: name the cause and fix the line.' }
];

/** The output a lesson ends with — the last step that produces any. */
function _drillFinalOut(lesson) {
  let out = '';
  ((lesson && lesson.steps) || []).forEach(s => { if (s.out !== undefined) out = s.out; });
  return out;
}

/** Lessons whose output does not depend on typed input. */
function _drillDeterministic() {
  return (typeof DEMO_LESSONS !== 'undefined' ? DEMO_LESSONS : [])
    .filter(l => { const o = _drillFinalOut(l); return l.code && o && o.indexOf('‸') === -1; });
}

/* ── Breaking a program on purpose ─────────────────────────────
   Each mutation is a mistake the classifier already knows by name, so a fix
   drill and the recurring-mistakes panel are talking about the same things.

   Every one returns null when its pattern is absent, and the deck only offers
   what actually applied — a mutation that silently did nothing would present
   a correct program and ask what is wrong with it. */
const DRILL_MUTATIONS = [
  {
    code: 'missing-semicolon',
    weight: 1,
    ask: 'A statement is missing something at the end.',
    // Not the last line of a block: dropping the ; there is legal in some
    // positions and the program still compiles, which makes the answer a lie.
    hit: (l) => /;\s*$/.test(l) && !/^\s*(#|\/\/)/.test(l) && !/^\s*(return|})/.test(l),
    break: (l) => l.replace(/;(\s*)$/, '$1')
  },
  {
    code: 'assign-in-condition',
    weight: 7,
    ask: 'A comparison is not comparing.',
    hit: (l) => /\b(if|while)\s*\([^)]*==/.test(l),
    break: (l) => l.replace('==', '=')
  },
  {
    code: 'scanf-no-ampersand',
    weight: 5,
    ask: 'An input is being written somewhere it should not.',
    hit: (l) => /scanf\s*\([^)]*&\s*\w/.test(l),
    break: (l) => l.replace(/&(\s*\w)/, '$1')
  },
  {
    code: 'array-bounds',
    weight: 5,
    ask: 'A loop runs one step too far.',
    hit: (l) => /\bfor\s*\([^)]*<\s*[A-Za-z_0-9]/.test(l) && !/<=/.test(l),
    break: (l) => l.replace('<', '<=')
  },
  {
    code: 'format-mismatch',
    weight: 1,
    ask: 'A conversion does not match what is being printed.',
    hit: (l) => /printf\s*\([^)]*%d/.test(l),
    break: (l) => l.replace('%d', '%s')
  },
  {
    code: 'off-by-direction',
    weight: 10,
    ask: 'A counter is moving the wrong way.',
    hit: (l) => /\+\+/.test(l) && !/for\s*\(/.test(l),
    break: (l) => l.replace('++', '--')
  }
];

const _drillRand = (n) => Math.floor(Math.random() * n);

/** One "what does it print" question. */
function _drillMakePredict(lesson) {
  return {
    mode: 'predict',
    lessonId: lesson.id,
    title: lesson.title,
    file: lesson.file || 'demo.c',
    code: lesson.code,
    expected: _drillFinalOut(lesson),
    ask: 'What does this print?'
  };
}

/** One "find the bug" question, or null when nothing could be broken. */
function _drillMakeFix(lesson) {
  const lines = String(lesson.code || '').split('\n');
  /* THE KIND FIRST, THEN A LINE FOR IT. Picking uniformly from every
     (mutation, line) pair sounds fairer and is not: a missing semicolon fits
     almost every line, so it won 24 of 32 questions and the deck was one joke
     told repeatedly. Choosing among the kinds that apply, and only then where
     to put it, spreads the deck across the fault taxonomy. */
  /* A line that appears twice cannot carry the fault. Breaking one copy leaves
     the other standing as the correct answer, in the same file, on screen --
     measured: 14 questions could be answered by copying the line above without
     reading either. Lessons repeat lines often (two identical counting loops,
     the same printf in both branches), so this is not a rare shape. */
  const seen = new Map();
  lines.forEach(l => {
    const k = _drillNormLine(l);
    seen.set(k, (seen.get(k) || 0) + 1);
  });
  const unique = (line) => seen.get(_drillNormLine(line)) === 1;

  const kinds = DRILL_MUTATIONS.map(m => {
    const spots = [];
    lines.forEach((line, i) => {
      if (!m.hit(line)) return;
      const broken = m.break(line);
      if (broken === line) return;        // the pattern matched but changed nothing
      if (!unique(line)) return;          // its own answer is elsewhere on screen
      spots.push({ m, i, broken });
    });
    return spots;
  }).filter(spots => spots.length);
  if (!kinds.length) return null;

  /* Weighted, because "available" is not the same as "worth asking". Almost
     every line ends in a semicolon, so picking evenly among the kinds a lesson
     happens to support still gave it 49% of the deck — most lessons support
     only it and one other. The subtle faults carry more weight both to even
     the mix out and because they are the ones worth practising.

     RE-TUNED ONCE THE CORPUS COULD TAKE IT. A weight only redistributes among
     the kinds a lesson actually supports, so while off-by-direction fitted 2
     lessons of 32 no weighting could lift it — measured, even at 12 it reached
     4.5%, and every tuning simply moved mass between the two shallow faults.
     Six lessons carrying the scarce faults changed that, and these weights were
     then chosen by measuring the deck rather than by argument: the spread
     between the most and least common fault went 13.9x, to 6.2x on the new
     lessons alone, to 4.3x here, with nothing below 7.7%. */
  const totalW = kinds.reduce((t, sp) => t + (sp[0].m.weight || 1), 0);
  let roll = Math.random() * totalW;
  let spots = kinds[kinds.length - 1];
  for (let k = 0; k < kinds.length; k++) {
    roll -= (kinds[k][0].m.weight || 1);
    if (roll <= 0) { spots = kinds[k]; break; }
  }
  const pick = spots[_drillRand(spots.length)];
  const out = lines.slice();
  out[pick.i] = pick.broken;
  return {
    mode: 'fix',
    lessonId: lesson.id,
    title: lesson.title,
    file: lesson.file || 'demo.c',
    code: out.join('\n'),
    line: pick.i + 1,
    want: lines[pick.i],
    mistakeCode: pick.m.code,
    ask: pick.m.ask
  };
}

/**
 * A shuffled deck.
 * @param {string} mode 'predict' | 'fix'
 * @param {number} [n] how many
 */
function drillDeck(mode, n) {
  const source = mode === 'fix'
    ? (typeof DEMO_LESSONS !== 'undefined' ? DEMO_LESSONS : []).filter(l => l.code)
    : _drillDeterministic();
  const made = source
    .map(l => (mode === 'fix' ? _drillMakeFix(l) : _drillMakePredict(l)))
    .filter(Boolean);
  // Fisher-Yates, so an ordering is not repeated between sessions.
  for (let i = made.length - 1; i > 0; i--) {
    const j = _drillRand(i + 1);
    const t = made[i]; made[i] = made[j]; made[j] = t;
  }
  return n ? made.slice(0, n) : made;
}

/* Output comparison is forgiving about the things a terminal is forgiving
   about — trailing spaces, and whether the last line ends in a newline — and
   about nothing else. Getting "5" instead of "5\n" is not a misunderstanding
   of the program; getting "6" is. */
function _drillNormOut(s) {
  return String(s == null ? '' : s)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '');
}

/** Whitespace inside a line is the author's, not the answer's. */
function _drillNormLine(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

/**
 * Mark one answer.
 * @returns {{ok:boolean, why:string, want:string}}
 */
function drillCheck(q, answer) {
  if (!q) return { ok: false, why: '', want: '' };
  if (q.mode === 'predict') {
    const want = _drillNormOut(q.expected);
    const got = _drillNormOut(answer);
    if (got === want) return { ok: true, why: 'Exactly right.', want: q.expected };
    if (got.replace(/\s+/g, '') === want.replace(/\s+/g, '')) {
      return { ok: false, why: 'The right characters, in the wrong layout — check the newlines and the spaces.', want: q.expected };
    }
    return { ok: false, why: 'Not what it prints. Walk the program a line at a time.', want: q.expected };
  }
  const want = _drillNormLine(q.want);
  const got = _drillNormLine(answer);
  if (got === want) return { ok: true, why: 'That is the line.', want: q.want };
  // A near miss is worth naming: they found the line but not the fault.
  if (got && _drillNormLine(q.code.split('\n')[q.line - 1]) === got) {
    return { ok: false, why: 'That is the line as it stands — it is the one that is wrong. What should it say?', want: q.want };
  }
  return { ok: false, why: 'Not quite. The fault is on one line only.', want: q.want };
}

/* ── The screen ────────────────────────────────────────────── */

const DRILL_STATE_KEY = 'ssp.drillMode';
const DRILL_SOURCE_KEY = 'ssp.drillSource';

const drillState = { mode: 'predict', source: 'mine', deck: [], at: 0, right: 0, done: 0, answered: false,
  startedAt: 0, flashTimer: 0, flashShown: false, puzzle: null };

function drillModePref() {
  try { return localStorage.getItem(DRILL_STATE_KEY) || 'predict'; } catch (e) { return 'predict'; }
}

function drillSourcePref() {
  try { return localStorage.getItem(DRILL_SOURCE_KEY) || 'mine'; } catch (e) { return 'mine'; }
}

/** Is this round part of the Training hub's daily mix? */
function _drillInMix() {
  const m = typeof getSessionParam === 'function' ? getSessionParam('thubMix') : null;
  return !!(m && m.steps && m.steps[m.at] && m.steps[m.at].kind === 'drills');
}

function drillsTemplate() {
  return `
    <div class="drill-page">
      <div class="drill-head">
        <button onclick="drillBack()" class="btn-back-dark">
          <i data-lucide="chevron-left" style="width:16px;height:16px;"></i> Training hub
        </button>
        <h2 class="drill-title">Drills</h2>
        <label class="drill-source" title="Where the questions come from">
          <i data-lucide="library"></i>
          <select id="drill-source" onchange="drillSetSource(this.value)" aria-label="Where the questions come from"></select>
        </label>
        <span class="drill-score" id="drill-score"></span>
      </div>
      <div class="drill-modes" id="drill-modes" role="tablist" aria-label="Kind of drill"></div>
      <div class="drill-body" id="drill-body"></div>
    </div>`;
}

function drillsInit() {
  const concept = getSessionParam('drillConcept');
  clearSessionParam('drillConcept');
  drillState.source = concept ? 'mine:' + concept : drillSourcePref();
  const askedMode = getSessionParam('drillModeOnce');
  clearSessionParam('drillModeOnce');
  drillStart(_drillInMix() ? 'mix' : (askedMode || drillModePref()));
}

function drillsDestroy() {
  clearTimeout(drillState.flashTimer);
  drillState.deck = [];
}

function drillBack() {
  if (_drillInMix() && typeof thubMixStop === 'function') { thubMixStop(); return; }
  spaNavigate('training');
}

function drillSetSource(src) {
  drillState.source = src;
  if (src.indexOf(':') === -1) { try { localStorage.setItem(DRILL_SOURCE_KEY, src); } catch (e) { /* private mode */ } }
  drillStart(drillState.mode === 'mix' ? 'predict' : drillState.mode);
}

function drillStart(mode) {
  clearTimeout(drillState.flashTimer);
  drillState.mode = mode;
  if (mode !== 'mix') { try { localStorage.setItem(DRILL_STATE_KEY, mode); } catch (e) { /* private mode */ } }
  drillState.deck = drillDeckFrom(mode, drillState.source, mode === 'mix' ? 5 : 10);
  drillState.at = 0;
  drillState.right = 0;
  drillState.done = 0;
  drillState.answered = false;
  drillState.startedAt = Date.now();
  drillState.flashShown = false;
  drillState.puzzle = null;
  drillRender();
}

function drillNext() {
  clearTimeout(drillState.flashTimer);
  drillState.at++;
  drillState.answered = false;
  drillState.flashShown = false;
  drillState.puzzle = null;
  if (drillState.at >= drillState.deck.length) _drillRoundDone();
  drillRender();
}

/* A finished round goes in the training log (Home's activity and streak read it). */
function _drillRoundDone() {
  if (!drillState.done) return;
  if (!Array.isArray(state.trainLog)) state.trainLog = [];
  state.trainLog.push({ id: generateId(), kind: 'drills', mode: drillState.mode, source: drillState.source,
    right: drillState.right, done: drillState.done, seconds: Math.round((Date.now() - drillState.startedAt) / 1000), at: Date.now() });
  if (state.trainLog.length > 400) state.trainLog.splice(0, state.trainLog.length - 400);
  if (typeof saveData === 'function') saveData();
}

function _drillCollect(q) {
  if (q.mode === 'trace') return Array.from(document.querySelectorAll('.drill-trace-in')).map(i => i.value);
  if (q.mode === 'puzzle') return Array.from(document.querySelectorAll('#drill-puzzle .dz-line')).map(li => li.dataset.id);
  if (q.mode === 'errors') {
    const c = document.querySelector('input[name="drill-cause"]:checked');
    return { cause: c ? c.value : '', line: (document.getElementById('drill-answer') || {}).value || '' };
  }
  const input = document.getElementById('drill-answer');
  return input ? input.value : '';
}

function drillSubmit() {
  if (drillState.answered) return;
  const q = drillState.deck[drillState.at];
  if (!q) return;
  if (q.mode === 'flash' && !drillState.flashShown) return;
  const answer = _drillCollect(q);
  const res = (['predict', 'fix'].indexOf(q.mode) !== -1 ? drillCheck(q, answer) : drillCheckMore(q, answer)) || { ok: false, why: '', want: '' };
  const sure = !!(document.getElementById('drill-sure') || {}).checked;
  if (sure || !res.ok) drillNoteSure(q, res.ok || !sure);
  res.sure = sure;
  drillState.answered = res;
  drillState.done++;
  if (res.ok) drillState.right++;
  try {
    if (res.ok && typeof psfxPass === 'function') psfxPass();
    else if (!res.ok && typeof psfxFail === 'function') psfxFail();
  } catch (e) { /* sound is never worth an error */ }
  drillRender();
}

function _drillCodeHTML(code, markLine) {
  return String(code).split('\n').map((ln, i) => {
    const n = i + 1;
    const body = typeof syntaxHighlight === 'function' ? syntaxHighlight(ln) : escapeHTML(ln);
    return `<span class="drill-line${markLine === n ? ' is-bad' : ''}">`
         + `<span class="drill-ln">${n}</span>`
         + `<span class="drill-lt">${body || '&nbsp;'}</span></span>`;
  }).join('');
}

/** This question's code as a new Freeground tab. */
function drillToFreeground() {
  const q = drillState.deck[drillState.at];
  if (!q || typeof fgOpen !== 'function') return;
  fgOpen({ newTab: { name: q.title, files: [{ name: 'main', ext: '.c', code: q.fgCode || q.code }], from: 'drill' }, back: 'drills' });
}

function _drillAnswerHTML(q, a) {
  const dis = a ? 'disabled' : '';
  if (q.mode === 'predict') {
    return (q.stdin ? `<div class="drill-stdin"><span>Input</span><pre>${escapeHTML(q.stdin)}</pre></div>` : '')
      + `<textarea id="drill-answer" class="drill-input" rows="5" spellcheck="false" placeholder="Type the output exactly, newlines and all…" ${dis}></textarea>`;
  }
  if (q.mode === 'trace') {
    return (q.stdin ? `<div class="drill-stdin"><span>Input</span><pre>${escapeHTML(q.stdin)}</pre></div>` : '')
      + `<div class="drill-trace">${q.vars.map((v, i) => `
        <label class="drill-trace-row"><code>${escapeHTML(v.name)}</code> =
          <input class="drill-input drill-trace-in" data-i="${i}" spellcheck="false" autocomplete="off" ${dis}></label>`).join('')}</div>`;
  }
  if (q.mode === 'puzzle') {
    const st = drillState.puzzle || (drillState.puzzle = { order: q.pieces.map(p => p.id), aside: [] });
    const row = (id, aside) => {
      const p = q.pieces.find(x => x.id === id);
      return `<li class="dz-line${aside ? ' is-aside' : ''}" data-id="${id}" tabindex="0" ${a ? '' : 'draggable="true"'}>
        <code>${typeof syntaxHighlight === 'function' ? syntaxHighlight(p.text) : escapeHTML(p.text)}</code>
        ${a ? '' : aside
          ? `<button type="button" class="dz-btn" onclick="drillPuzzleBack('${id}')" title="Put it back" aria-label="Put it back"><i data-lucide="undo-2"></i></button>`
          : `<button type="button" class="dz-btn" onclick="drillPuzzleMove('${id}',-1)" title="Up (Alt+Up)" aria-label="Move up"><i data-lucide="arrow-up"></i></button>
             <button type="button" class="dz-btn" onclick="drillPuzzleMove('${id}',1)" title="Down (Alt+Down)" aria-label="Move down"><i data-lucide="arrow-down"></i></button>
             <button type="button" class="dz-btn" onclick="drillPuzzleAside('${id}')" title="Does not belong (Delete)" aria-label="Set aside"><i data-lucide="x"></i></button>`}
      </li>`;
    };
    return `<ol class="drill-puzzle" id="drill-puzzle">${st.order.map(id => row(id, false)).join('')}</ol>
      ${q.odd ? `<div class="drill-aside-title">Set aside</div><ul class="drill-puzzle drill-aside" id="drill-aside">${st.aside.map(id => row(id, true)).join('') || '<li class="dz-empty">Nothing yet</li>'}</ul>` : ''}`;
  }
  if (q.mode === 'flash') {
    if (!drillState.flashShown) return '';
    return `<textarea id="drill-answer" class="drill-input" rows="${Math.min(12, q.code.split('\n').length + 1)}" spellcheck="false" placeholder="Write it back from memory…" ${dis}></textarea>`;
  }
  if (q.mode === 'errors') {
    return `<pre class="drill-msg">${escapeHTML(q.message)}</pre>
      <div class="drill-choices" role="radiogroup" aria-label="The cause">${q.choices.map(c => `
        <label class="drill-choice"><input type="radio" name="drill-cause" value="${escapeHTML(c.code)}" ${dis}> ${escapeHTML(c.label)}</label>`).join('')}</div>
      <input id="drill-answer" class="drill-input" spellcheck="false" placeholder="Line ${q.line}, fixed…" value="${escapeHTML(q.code.split('\n')[q.line - 1] || '')}" ${dis} />`;
  }
  return `<input id="drill-answer" class="drill-input" spellcheck="false" placeholder="${q.mode === 'blanks' ? 'What goes in the gap…' : 'Type the corrected line…'}" ${dis} />`;
}

function _drillShowCode(q, a) {
  if (q.mode === 'puzzle') return '';
  if (q.mode === 'flash') {
    if (drillState.flashShown && !a) return '<div class="drill-flash-gone">It is gone. Write what you saw.</div>';
    if (a) return `<pre class="drill-code">${_drillCodeHTML(q.code, 0)}</pre>`;
    return `<div class="drill-flash-bar"><div class="drill-flash-fill" style="animation-duration:${q.seconds}s"></div></div>
      <pre class="drill-code drill-flash-code">${_drillCodeHTML(q.code, 0)}</pre>`;
  }
  const mark = q.mode === 'trace' || q.mode === 'errors' || (q.mode === 'blanks') ? q.line : (a && !a.ok ? q.line : 0);
  return `<pre class="drill-code">${_drillCodeHTML(q.code, mark)}</pre>`;
}

function drillRender() {
  const modes = document.getElementById('drill-modes');
  if (modes) {
    const list = DRILL_MODES.concat(_drillInMix() || drillState.mode === 'mix' ? [{ id: 'mix', label: 'Mix', icon: 'shuffle', blurb: 'One of each, in turn' }] : []);
    modes.innerHTML = list.map(m =>
      `<button class="drill-mode${m.id === drillState.mode ? ' is-on' : ''}" role="tab" aria-selected="${m.id === drillState.mode}"
               onclick="drillStart('${m.id}')" title="${escapeHTML(m.blurb)}">
         <i data-lucide="${m.icon}"></i> ${escapeHTML(m.label)}</button>`).join('');
  }
  const sel = document.getElementById('drill-source');
  if (sel) {
    const concept = drillState.source.indexOf(':') !== -1 ? drillState.source.split(':')[1] : '';
    sel.innerHTML = DRILL_SOURCES.map(s => `<option value="${s.id}" ${drillState.source === s.id ? 'selected' : ''} title="${escapeHTML(s.hint)}">${escapeHTML(s.label)}</option>`).join('')
      + (concept ? `<option value="${escapeHTML(drillState.source)}" selected>Only: ${escapeHTML(typeof minReqLabel === 'function' ? minReqLabel(concept) : concept)}</option>` : '');
  }
  const score = document.getElementById('drill-score');
  if (score) score.textContent = drillState.done ? drillState.right + ' / ' + drillState.done : '';

  const body = document.getElementById('drill-body');
  if (!body) return;

  const q = drillState.deck[drillState.at];
  if (!q) {
    const pct = drillState.done ? Math.round((drillState.right / drillState.done) * 100) : 0;
    const inMix = _drillInMix();
    body.innerHTML = `
      <div class="drill-done">
        <i data-lucide="flag" style="width:36px;height:36px;"></i>
        <h3>${drillState.done ? pct + '% — ' + drillState.right + ' of ' + drillState.done : 'Nothing to drill here'}</h3>
        <p>${drillState.done
          ? (inMix ? 'That was the last step of the daily mix.' : 'Run another round, or switch kind above.')
          : 'This source has nothing this kind of drill can be made from yet. Pass a few programs, or pick another source.'}</p>
        ${inMix ? '<button class="btn btn-primary" onclick="thubMixNext()"><i data-lucide="check"></i> Finish the daily mix</button>'
          : `<button class="btn btn-primary" onclick="drillStart('${drillState.mode}')"><i data-lucide="rotate-ccw"></i> Another round</button>`}
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
    return;
  }

  const a = drillState.answered;
  const kind = DRILL_MODES.find(m => m.id === q.mode);
  body.innerHTML = `
    <div class="drill-card drill-k-${q.mode}">
      <div class="drill-meta">
        <span class="drill-count">${drillState.at + 1} / ${drillState.deck.length}</span>
        ${drillState.mode === 'mix' && kind ? `<span class="drill-kind"><i data-lucide="${kind.icon}"></i> ${escapeHTML(kind.label)}</span>` : ''}
        <span class="drill-file"><i data-lucide="file-code-2"></i> ${escapeHTML(q.file || 'main.c')}</span>
        <span class="drill-from">${escapeHTML(q.title)}</span>
      </div>
      ${_drillShowCode(q, a)}
      <div class="drill-ask"><i data-lucide="help-circle"></i> ${escapeHTML(q.ask)}</div>
      ${_drillAnswerHTML(q, a)}
      ${a ? `
        <div class="drill-verdict ${a.ok ? 'is-ok' : 'is-no'}">
          <i data-lucide="${a.ok ? 'check-circle-2' : 'x-circle'}"></i>
          <div>
            <strong>${a.ok ? 'Correct' : a.sure ? 'Not this time, though you were sure: it comes back first next round' : 'Not this time'}</strong>
            <p>${escapeHTML(a.why)}</p>
            ${a.ok || !a.want ? '' : `<pre class="drill-want">${escapeHTML(a.want)}</pre>`}
          </div>
        </div>` : ''}
      <div class="drill-actions">
        ${a
          ? `<button class="btn btn-ghost" onclick="drillToFreeground()" title="Open this code in Freeground"><i data-lucide="terminal"></i> Freeground</button>
             <button class="btn btn-primary" onclick="drillNext()">
               ${drillState.at + 1 >= drillState.deck.length ? 'Finish' : 'Next'}
               <i data-lucide="chevron-right"></i></button>`
          : (q.mode === 'flash' && !drillState.flashShown ? '<span class="drill-hint">Reading…</span>'
            : `<label class="drill-sure" title="Sure and wrong brings it back first next round"><input type="checkbox" id="drill-sure"> I'm sure</label>
               <button class="btn btn-primary" onclick="drillSubmit()"><i data-lucide="check"></i> Check</button>`)}
      </div>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });

  if (q.mode === 'flash' && !drillState.flashShown && !a) {
    clearTimeout(drillState.flashTimer);
    drillState.flashTimer = setTimeout(() => { drillState.flashShown = true; drillRender(); }, q.seconds * 1000);
    return;
  }
  if (q.mode === 'puzzle' && !a) _drillWirePuzzle();
  const input = document.getElementById('drill-answer') || document.querySelector('.drill-trace-in') || document.querySelector('#drill-puzzle .dz-line');
  if (input && !a) {
    input.focus();
    if (q.mode === 'flash') input.addEventListener('paste', (e) => e.preventDefault());
    // Enter submits a one-line answer; the boxes that need newlines take Ctrl/Cmd+Enter.
    const multi = q.mode === 'predict' || q.mode === 'flash';
    document.querySelectorAll('.drill-input').forEach(el => {
      el.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        if (!multi || e.ctrlKey || e.metaKey) { e.preventDefault(); drillSubmit(); }
      };
    });
  }
}

/* ── The line puzzle's moves ───────────────────────────────── */

function drillPuzzleMove(id, delta) {
  const st = drillState.puzzle;
  if (!st) return;
  const i = st.order.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= st.order.length) return;
  st.order[i] = st.order[j]; st.order[j] = id;
  drillRender();
  const li = document.querySelector('#drill-puzzle .dz-line[data-id="' + id + '"]');
  if (li) li.focus();
}

function drillPuzzleAside(id) {
  const st = drillState.puzzle;
  if (!st) return;
  st.order = st.order.filter(x => x !== id);
  st.aside.push(id);
  drillRender();
}

function drillPuzzleBack(id) {
  const st = drillState.puzzle;
  if (!st) return;
  st.aside = st.aside.filter(x => x !== id);
  st.order.push(id);
  drillRender();
}

function _drillWirePuzzle() {
  const list = document.getElementById('drill-puzzle');
  if (!list) return;
  let dragId = null;
  list.querySelectorAll('.dz-line').forEach(li => {
    li.addEventListener('dragstart', (e) => { dragId = li.dataset.id; li.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; });
    li.addEventListener('dragend', () => li.classList.remove('is-drag'));
    li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('is-over'); });
    li.addEventListener('dragleave', () => li.classList.remove('is-over'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const st = drillState.puzzle;
      if (!st || !dragId || dragId === li.dataset.id) return;
      st.order = st.order.filter(x => x !== dragId);
      st.order.splice(st.order.indexOf(li.dataset.id), 0, dragId);
      dragId = null;
      drillRender();
    });
    li.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); drillPuzzleMove(li.dataset.id, e.key === 'ArrowUp' ? -1 : 1); }
      else if (e.key === 'Delete' && drillState.deck[drillState.at].odd) { e.preventDefault(); drillPuzzleAside(li.dataset.id); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const sib = e.key === 'ArrowDown' ? li.nextElementSibling : li.previousElementSibling;
        if (sib) sib.focus();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); drillSubmit(); }
    });
  });
}

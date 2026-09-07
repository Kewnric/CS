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
  { id: 'predict', label: 'Predict the output', icon: 'terminal',
    blurb: 'Read the program. Say exactly what it prints.' },
  { id: 'fix', label: 'Find the bug', icon: 'bug',
    blurb: 'One line is wrong. Type what it should say.' }
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
    weight: 5,
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
    weight: 2,
    ask: 'A conversion does not match what is being printed.',
    hit: (l) => /printf\s*\([^)]*%d/.test(l),
    break: (l) => l.replace('%d', '%s')
  },
  {
    code: 'off-by-direction',
    weight: 5,
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
     the mix out and because they are the ones worth practising. */
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

const drillState = { mode: 'predict', deck: [], at: 0, right: 0, done: 0, answered: false };

function drillModePref() {
  try { return localStorage.getItem(DRILL_STATE_KEY) || 'predict'; } catch (e) { return 'predict'; }
}

function drillsTemplate() {
  return `
    <div class="drill-page">
      <div class="drill-head">
        <button onclick="spaNavigate('browse')" class="btn-back-dark">
          <i data-lucide="chevron-left" style="width:16px;height:16px;"></i> Library
        </button>
        <h2 class="drill-title">Drills</h2>
        <div class="drill-modes" id="drill-modes"></div>
        <span class="drill-score" id="drill-score"></span>
      </div>
      <div class="drill-body" id="drill-body"></div>
    </div>`;
}

function drillsInit() {
  drillState.mode = drillModePref();
  drillStart(drillState.mode);
}

function drillsDestroy() { drillState.deck = []; }

function drillStart(mode) {
  drillState.mode = mode;
  try { localStorage.setItem(DRILL_STATE_KEY, mode); } catch (e) { /* private mode */ }
  drillState.deck = drillDeck(mode, 10);
  drillState.at = 0;
  drillState.right = 0;
  drillState.done = 0;
  drillState.answered = false;
  drillRender();
}

function drillNext() {
  drillState.at++;
  drillState.answered = false;
  drillRender();
}

function drillSubmit() {
  const input = document.getElementById('drill-answer');
  if (!input || drillState.answered) return;
  const q = drillState.deck[drillState.at];
  const res = drillCheck(q, input.value);
  drillState.answered = res;
  drillState.done++;
  if (res.ok) drillState.right++;
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

function drillRender() {
  const modes = document.getElementById('drill-modes');
  if (modes) {
    modes.innerHTML = DRILL_MODES.map(m =>
      `<button class="drill-mode${m.id === drillState.mode ? ' is-on' : ''}"
               onclick="drillStart('${m.id}')" title="${escapeHTML(m.blurb)}">
         <i data-lucide="${m.icon}"></i> ${escapeHTML(m.label)}</button>`).join('');
  }
  const score = document.getElementById('drill-score');
  if (score) score.textContent = drillState.done ? drillState.right + ' / ' + drillState.done : '';

  const body = document.getElementById('drill-body');
  if (!body) return;

  const q = drillState.deck[drillState.at];
  if (!q) {
    const pct = drillState.done ? Math.round((drillState.right / drillState.done) * 100) : 0;
    body.innerHTML = `
      <div class="drill-done">
        <i data-lucide="flag" style="width:36px;height:36px;"></i>
        <h3>${drillState.done ? pct + '% — ' + drillState.right + ' of ' + drillState.done : 'Nothing to drill'}</h3>
        <p>${drillState.done
          ? 'Run another round, or switch mode above.'
          : 'These are generated from the walkthrough programs, so there are none until those load.'}</p>
        <button class="btn btn-primary" onclick="drillStart('${drillState.mode}')">
          <i data-lucide="rotate-ccw"></i> Another round</button>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
    return;
  }

  const a = drillState.answered;
  body.innerHTML = `
    <div class="drill-card">
      <div class="drill-meta">
        <span class="drill-count">${drillState.at + 1} / ${drillState.deck.length}</span>
        <span class="drill-file"><i data-lucide="file-code-2"></i> ${escapeHTML(q.file)}</span>
        <span class="drill-from">${escapeHTML(q.title)}</span>
      </div>
      <pre class="drill-code">${_drillCodeHTML(q.code, a && !a.ok ? q.line : 0)}</pre>
      <div class="drill-ask"><i data-lucide="help-circle"></i> ${escapeHTML(q.ask)}</div>
      ${q.mode === 'predict'
        ? `<textarea id="drill-answer" class="drill-input" rows="5" spellcheck="false"
              placeholder="Type the output exactly, newlines and all…"
              ${a ? 'disabled' : ''}></textarea>`
        : `<input id="drill-answer" class="drill-input" spellcheck="false"
              placeholder="Type the corrected line…" ${a ? 'disabled' : ''} />`}
      ${a ? `
        <div class="drill-verdict ${a.ok ? 'is-ok' : 'is-no'}">
          <i data-lucide="${a.ok ? 'check-circle-2' : 'x-circle'}"></i>
          <div>
            <strong>${a.ok ? 'Correct' : 'Not this time'}</strong>
            <p>${escapeHTML(a.why)}</p>
            ${a.ok ? '' : `<pre class="drill-want">${escapeHTML(a.want)}</pre>`}
          </div>
        </div>` : ''}
      <div class="drill-actions">
        ${a
          ? `<button class="btn btn-primary" onclick="drillNext()">
               ${drillState.at + 1 >= drillState.deck.length ? 'Finish' : 'Next'}
               <i data-lucide="chevron-right"></i></button>`
          : `<button class="btn btn-primary" onclick="drillSubmit()">
               <i data-lucide="check"></i> Check</button>`}
      </div>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
  const input = document.getElementById('drill-answer');
  if (input && !a) {
    input.focus();
    // Enter submits a one-line answer; the output box needs Enter for newlines,
    // so there it is Ctrl/Cmd+Enter.
    input.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      if (q.mode === 'fix' || e.ctrlKey || e.metaKey) { e.preventDefault(); drillSubmit(); }
    };
  }
}

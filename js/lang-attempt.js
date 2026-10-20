/* ============================================================
   LANG-ATTEMPT.JS — the drill runner
   ------------------------------------------------------------
   One question at a time, answer, check, move on: the shape a language drill
   has because it works. Five puzzle types share one loop, differing only in
   how the answer is collected and compared.

   Nothing is graded until you press Check, and a wrong answer is shown
   alongside the right one rather than just being taken off the score — the
   point of a drill is the correction. The verdict lives in the footer bar,
   which turns green or red, says what the answer was and which words you got
   wrong, and holds the one button that moves you on.

   Keyboard: 1-9 and 0 pick tiles, options and match cards; Backspace takes
   back the last tile; Enter checks and continues; Esc leaves.
   ============================================================ */

let _la = null;   // the run in progress

function langAttemptTemplate() {
  return `
    <div class="la-shell" id="la-shell">
      <header class="la-top">
        <button class="la-exit" type="button" onclick="laExit()" title="Leave the drill (Esc)" aria-label="Leave the drill">
          <i data-lucide="x"></i>
        </button>
        <div class="la-progress" id="la-progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100">
          <div class="la-progress-fill" id="la-progress-fill"></div>
        </div>
        <span class="la-clock" id="la-clock"></span>
        <div class="la-hearts" id="la-hearts"></div>
      </header>
      <main class="la-body" id="la-body"></main>
      <footer class="la-foot" id="la-foot" aria-live="polite"></footer>
    </div>`;
}

/** A fresh run over a queue. `review` marks a mistakes-only rerun, which is
    practice on top of a run already recorded and so is not recorded again. */
function laNewRun(set, queue, limit, review) {
  return {
    set,
    limit,
    remaining: limit,
    queue,
    idx: 0,
    hearts: 3,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    answered: [],
    startTime: Date.now(),
    endTime: 0,
    review: !!review,
    state: 'answering',    // answering | checked | over
    picked: [],            // arrange: the tiles laid down so far
    pool: [],              // arrange/blank: every tile, in a fixed order
    choice: -1,
    typed: '',
    matchList: [],
    matchLeft: null,
    matchRight: null,
    matchDone: [],         // [{ l, r }] pairs found
    matchMiss: [],         // [{ l, r }] pairs tried and wrong
    matchFlash: null
  };
}

function langAttemptInit() {
  langStore();
  const setId = getSessionParam('langRunSet');
  const type = getSessionParam('langRunType');
  const limit = Math.max(0, parseInt(getSessionParam('langTimeLimit'), 10) || 0);

  // Two ways in: a whole authored set, or every question of one puzzle type
  // gathered from across the sets.
  let set = null, queue = null;
  if (type) {
    const pool = langItemsOfType(type);
    if (!pool.length) { spaNavigate('language'); return; }
    set = { id: 'type:' + type, title: langPuzzleMeta(type).name, lang: langStudy(), refLang: langRef(), isType: true, type: type };
    /* NOT shuffled. langItemsOfType has already ordered this pool -- words
       that are due first, then your own questions in a fresh order, then the
       rest by how long since you saw them. Shuffling here threw that away and
       turned a review queue back into a raffle. An authored set below still
       gets its shuffle, because a fixed five in a fixed order is exactly the
       muscle memory that shuffle exists to break. */
    queue = pool.map(p => p.item);
  } else {
    set = setId ? langFindSet(setId) : null;
    if (!set || langSetProblems(set).length) { spaNavigate('language'); return; }
    queue = langShuffle((set.items || []).slice());
  }

  _la = laNewRun(set, queue, limit, false);
  document.removeEventListener('keydown', laOnKey);
  document.addEventListener('keydown', laOnKey);
  laStartTimer();
  laLoadQuestion();
}

function langAttemptDestroy() {
  laStopTimer();
  document.removeEventListener('keydown', laOnKey);
  _la = null;
}

/* ── The optional time limit ──────────────────────────────── */

/* The interval id lives HERE, not on _la.
   It used to hang off the run object, and laStopTimer only cleared the id it
   found on the CURRENT one — so replacing _la with a fresh run orphaned the
   old interval, which then went on decrementing the new run's clock. Two
   drills in a row and the timer ran at double speed. A module-level handle
   cannot be orphaned by reassigning the thing beside it. */
let _laTimer = null;

function laStartTimer() {
  laStopTimer();
  if (!_la || !_la.limit) return;
  _laTimer = setInterval(function () {
    if (!_la || _la.state === 'over') { laStopTimer(); return; }
    _la.remaining--;
    laPaintClock();
    // Time up ends the run where it stands rather than discarding it — the
    // questions already answered were still answered.
    if (_la.remaining <= 0) { laStopTimer(); laFinish('time'); }
  }, 1000);
}

function laStopTimer() {
  if (_laTimer) { clearInterval(_laTimer); _laTimer = null; }
}

function laPaintClock() {
  const el = document.getElementById('la-clock');
  if (!el || !_la) return;
  if (!_la.limit) { el.textContent = ''; return; }
  el.textContent = laClockText(Math.max(0, _la.remaining));
  el.classList.toggle('is-low', _la.remaining <= 15);
}

function laClockText(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

function laExit() {
  if (!_la || _la.state === 'over') { spaNavigate('language'); return; }
  showConfirm('Leave the drill?', 'Your progress in this run will not be saved.', () => {
    laStopTimer();
    _la = null;
    spaNavigate('language');
  });
}

function laCurrent() { return _la && _la.queue[_la.idx]; }

/* The library's four languages as tags a speech engine might recognise.

   Only English is a safe bet. Filipino ships on some platforms as fil-PH and
   on others as tl-PH; Cebuano and Waray almost certainly have no voice
   anywhere, and the engine falls back to the chosen voice reading them as
   though they were its own language. That is still useful -- the spelling is
   close enough to come out recognisable -- and it is honest about being an
   approximation rather than a pronunciation guide. */
const LA_SPEECH_TAG = { en: 'en-US', fil: 'fil-PH', ceb: 'ceb-PH', war: 'war-PH' };

/** The language being learnt -- which is what these drills are built from. */
function _laSpeechLang() {
  const code = typeof langStudy === 'function' ? langStudy() : '';
  return LA_SPEECH_TAG[code] || undefined;
}

/** The same code, for the shared chip helper. */
function _laStudyCode() { return typeof langStudy === 'function' ? langStudy() : ''; }

/** Read a word from the card out loud. */
function laSpeak(text) {
  if (typeof speak !== 'function') return;
  speak(text, { lang: _laSpeechLang(), langCode: _laStudyCode() });
}

/** Read back whatever is in the answer box right now. */
function laSpeakTyped() {
  const el = document.getElementById('la-input');
  const said = (el && el.value) || (_la && _la.typed) || '';
  if (!said.trim()) {
    if (typeof toast === 'function') toast('Type something first.', { type: 'info', duration: 2000 });
    return;
  }
  if (typeof speak === 'function') speak(said, { lang: _laSpeechLang(), langCode: _laStudyCode() });
}

function laLoadQuestion() {
  if (!_la) return;
  const it = laCurrent();
  _la.state = 'answering';
  _la.picked = [];
  _la.choice = -1;
  _la.typed = '';
  _la.matchLeft = null;
  _la.matchRight = null;
  _la.matchDone = [];
  _la.matchMiss = [];
  _la.matchFlash = null;
  if (it && (it.type === 'arrange' || it.type === 'blank')) {
    _la.pool = langShuffle(langTokensFor(it)).map((t, i) => ({ id: 'tk' + i, text: t }));
  } else {
    _la.pool = [];
  }
  if (it && it.type === 'choice') {
    // Shuffle the options but remember where the right one went.
    const opts = (it.options || []).map((text, i) => ({ text, correct: i === it.correctIndex }))
      .filter(o => (o.text || '').trim());
    _la.shuffledOptions = langShuffle(opts);
  }
  if (it && it.type === 'match') {
    const pairs = (it.pairs || []).filter(p => (p.left || '').trim() && (p.right || '').trim());
    _la.matchList = pairs;
    _la.matchA = langShuffle(pairs.map((p, i) => ({ i, text: p.left })));
    _la.matchB = langShuffle(pairs.map((p, i) => ({ i, text: p.right })));
  }
  laRender();
}

/* ── Render ───────────────────────────────────────────────── */

const LA_PRAISE = ['Nice!', 'Correct!', 'Great job!', 'You got it!', 'Excellent!'];

function laLast() { return _la && _la.answered[_la.answered.length - 1]; }

function laRender() {
  if (!_la) return;
  const body = document.getElementById('la-body');
  const foot = document.getElementById('la-foot');
  const fill = document.getElementById('la-progress-fill');
  const bar = document.getElementById('la-progress');
  const hearts = document.getElementById('la-hearts');
  if (!body || !foot) return;

  // The bar moves the moment a question is answered, not when you leave it,
  // so Check visibly does something even before you read the verdict.
  const done = _la.state === 'over' ? _la.queue.length : _la.idx + (_la.state === 'checked' ? 1 : 0);
  const pct = Math.round((done / Math.max(1, _la.queue.length)) * 100);
  if (fill) fill.style.width = pct + '%';
  if (bar) bar.setAttribute('aria-valuenow', String(pct));
  if (hearts) {
    hearts.title = _la.hearts + (_la.hearts === 1 ? ' heart' : ' hearts') + ' left';
    hearts.setAttribute('aria-label', hearts.title);
    hearts.innerHTML = [0, 1, 2].map(i =>
      `<i data-lucide="heart" class="la-heart${i < _la.hearts ? '' : ' is-lost'}"></i>`).join('');
  }
  laPaintClock();

  if (_la.state === 'over') {
    body.innerHTML = laSummaryHTML();
    foot.innerHTML = '';
    foot.className = 'la-foot is-empty';
    laIcons();
    return;
  }

  const it = laCurrent();
  if (!it) { laFinish(); return; }
  const meta = langPuzzleMeta(it.type);
  const last = _la.state === 'checked' ? laLast() : null;

  body.innerHTML = `
    <div class="la-card${_la.state === 'checked' ? ' is-checked' : ''}">
      <div class="la-kind"><i data-lucide="${meta.icon}"></i> ${escapeHTML(meta.name)}</div>
      ${it.prompt && it.type !== 'blank' ? `<h2 class="la-prompt">${escapeHTML(it.prompt)}
        <button type="button" class="la-speak" onclick="laSpeak(this.dataset.say)"
                data-say="${escapeHTML(it.prompt)}"
                title="Hear this" aria-label="Hear this"><i data-lucide="volume-2"></i></button>
      </h2>` : ''}
      ${laQuestionHTML(it, last)}
    </div>`;
  foot.className = 'la-foot' + (last ? (last.ok ? ' is-right' : ' is-wrong') : '');
  foot.innerHTML = laFootHTML(it, last);
  laIcons();

  // A typing question starts with the cursor in the box -- the alternative is
  // a click before every single answer.
  if (it.type === 'translate' && _la.state === 'answering') {
    const inp = document.getElementById('la-input');
    if (inp && document.activeElement !== inp) {
      inp.focus({ preventScroll: true });
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  }
}

function laIcons() {
  const shell = document.getElementById('la-shell');
  if (typeof lucide !== 'undefined' && shell) lucide.createIcons({ root: shell });
}

/** The keyboard shortcut a tile answers to: 1-9, then 0 for the tenth. */
function laKeyHTML(n) {
  return n >= 1 && n <= 10 ? `<kbd class="la-key" aria-hidden="true">${n % 10}</kbd>` : '';
}

function laQuestionHTML(it, last) {
  const checked = _la.state === 'checked';

  if (it.type === 'arrange' || it.type === 'blank') {
    const sentence = it.type === 'blank'
      ? `<div class="la-blank-line">${laBlankLineHTML(it, last)}
           <button type="button" class="la-speak" onclick="laSpeak(this.dataset.say)"
                   data-say="${escapeHTML(String(it.prompt || '').replace(/_{2,}|\{\}/g, '…'))}"
                   title="Hear this" aria-label="Hear this"><i data-lucide="volume-2"></i></button>
         </div>`
      : '';
    // Which of the placed words were wrong -- only meaningful once checked.
    const marks = checked && last && last.diff ? last.diff.gOk : null;
    const lane = it.type === 'arrange' ? `
      <div class="la-lane" id="la-lane">
        ${_la.picked.map((t, k) => {
          const cls = !checked ? '' : (last && last.ok) || (marks && marks[k]) ? ' is-ok' : ' is-bad';
          return `<button class="la-tile is-placed${cls}" type="button" onclick="laUnpick('${t.id}')"
                    title="Tap to take back"><span class="la-tile-text">${escapeHTML(t.text)}</span></button>`;
        }).join('')
          || `<span class="la-lane-hint">Tap the words in order<span class="la-hint-keys"> · or press 1–${Math.min(_la.pool.length, 9)}, Backspace to undo</span></span>`}
      </div>` : '';
    /* The pool keeps every tile where it was. A placed word leaves a grey
       footprint behind instead of collapsing the row, so the tiles you have
       not used yet do not jump about under your finger -- and the number keys
       keep meaning the same tile all question long. */
    return `
      ${sentence}
      ${lane}
      <div class="la-pool">
        ${_la.pool.map((t, k) => {
          const used = _la.picked.some(p => p.id === t.id);
          return used
            ? `<button class="la-tile is-used" type="button" tabindex="-1" aria-hidden="true" disabled>${laKeyHTML(k + 1)}<span class="la-tile-text">${escapeHTML(t.text)}</span><span class="la-chip-ph"></span></button>`
            : `<button class="la-tile" type="button" onclick="laPick('${t.id}')" ${checked ? 'disabled' : ''}>${laKeyHTML(k + 1)}<span class="la-tile-text">${escapeHTML(t.text)}</span>${langSpeakChip(t.text, _laStudyCode())}</button>`;
        }).join('')}
      </div>`;
  }

  if (it.type === 'choice') {
    return `<div class="la-options">
      ${(_la.shuffledOptions || []).map((o, i) => {
        let cls = _la.choice === i ? ' is-picked' : '';
        if (checked) cls = o.correct ? ' is-ok' : _la.choice === i ? ' is-bad' : ' is-faded';
        return `
        <button class="la-option${cls}" type="button" onclick="laChoose(${i})" ${checked ? 'disabled' : ''}>
          <span class="la-option-key">${i + 1}</span>
          <span class="la-option-text">${escapeHTML(o.text)}</span>
          ${langSpeakChip(o.text, _laStudyCode())}
        </button>`;
      }).join('')}
    </div>`;
  }

  if (it.type === 'translate') {
    const cls = checked && last ? (last.ok ? ' is-ok' : ' is-bad') : '';
    return `<div class="la-typed${cls}">
      <input type="text" id="la-input" class="la-input" autocomplete="off" autocapitalize="off" spellcheck="false"
             enterkeyhint="done" placeholder="Type your answer…" value="${escapeHTML(_la.typed)}"
             ${checked ? 'readonly' : ''} oninput="laTyped(this.value)" />
      <!-- Hearing what you have written is much of the point of writing it in a
           language you are learning, so this reads the BOX, not the answer. -->
      <button type="button" class="la-speak la-speak-input" onclick="laSpeakTyped()"
              title="Hear what you typed" aria-label="Hear what you typed"><i data-lucide="volume-2"></i></button>
    </div>`;
  }

  if (it.type === 'match') {
    const a = _la.matchA || [], b = _la.matchB || [];
    const f = _la.matchFlash;
    const leftDone = i => _la.matchDone.some(d => d.l === i);
    const rightDone = i => _la.matchDone.some(d => d.r === i);
    const flash = (side, i) => f && f[side] === i ? (f.ok ? ' is-flash-ok' : ' is-flash-bad') : '';
    return `<div class="la-match">
      <div class="la-match-col">
        ${a.map((x, k) => `
          <button class="la-match-btn${_la.matchLeft === x.i ? ' is-picked' : ''}${leftDone(x.i) ? ' is-done' : ''}${flash('l', x.i)}"
                  type="button" onclick="laMatchLeft(${x.i})" ${leftDone(x.i) ? 'disabled' : ''}>
            ${laKeyHTML(k + 1)}<span class="la-tile-text">${escapeHTML(x.text)}</span>${langSpeakChip(x.text, _laStudyCode())}</button>`).join('')}
      </div>
      <div class="la-match-col">
        ${b.map((x, k) => `
          <button class="la-match-btn${_la.matchRight === x.i ? ' is-picked' : ''}${rightDone(x.i) ? ' is-done' : ''}${flash('r', x.i)}"
                  type="button" onclick="laMatchRight(${x.i})" ${rightDone(x.i) ? 'disabled' : ''}>
            ${laKeyHTML(a.length + k + 1)}<span class="la-tile-text">${escapeHTML(x.text)}</span>${langSpeakChip(x.text, _laStudyCode())}</button>`).join('')}
      </div>
    </div>`;
  }
  return '';
}

/** The sentence with its blank shown as the tile you have placed, or a gap. */
function laBlankLineHTML(it, last) {
  const filled = _la.picked.length ? escapeHTML(_la.picked[0].text) : '&nbsp;';
  const parts = String(it.prompt || '').split(/_{2,}|\{\}/);
  if (parts.length < 2) return escapeHTML(it.prompt || '');
  const cls = last ? (last.ok ? ' is-ok' : ' is-bad') : _la.picked.length ? ' is-filled' : '';
  // Tapping the filled blank gives the word back, the same as tapping a placed tile.
  const slot = _la.picked.length && _la.state === 'answering'
    ? `<button type="button" class="la-blank-slot${cls}" onclick="laUnpick('${_la.picked[0].id}')" title="Tap to take back">${filled}</button>`
    : `<span class="la-blank-slot${cls}">${filled}</span>`;
  return escapeHTML(parts[0]) + slot + escapeHTML(parts.slice(1).join(' '));
}

function laFootHTML(it, last) {
  if (_la.state === 'checked' && last) {
    const isEnd = _la.idx + 1 >= _la.queue.length || _la.hearts <= 0;
    const go = `<button class="la-btn ${last.ok ? 'la-btn-ok' : 'la-btn-bad'} la-btn-go" type="button" onclick="laPrimary()">
        ${isEnd ? 'Finish' : 'Continue'}</button>`;
    const streak = last.ok && _la.streak >= 3
      ? `<span class="la-streak"><i data-lucide="flame"></i> ${_la.streak} in a row</span>` : '';
    const note = it.note ? `<div class="la-fb-note"><i data-lucide="info"></i><span>${escapeHTML(it.note)}</span></div>` : '';
    return `
      <div class="la-foot-inner">
        <div class="la-fb">
          <div class="la-fb-badge"><i data-lucide="${last.ok ? 'check' : 'x'}"></i></div>
          <div class="la-fb-text">
            <div class="la-verdict">${last.ok ? LA_PRAISE[_la.idx % LA_PRAISE.length] : last.skipped ? 'Skipped' : 'Incorrect'}${streak}</div>
            ${last.ok ? '' : laCorrectionHTML(it, last)}
            ${note}
          </div>
        </div>
        ${go}
      </div>`;
  }
  const ready = laHasAnswer(it);
  const hint = it.type === 'match'
    ? '<span class="la-foot-hint">Tap a word, then its partner</span>' : '';
  return `
    <div class="la-foot-inner">
      <button class="la-btn la-btn-ghost" type="button" onclick="laSkip()">Skip</button>
      ${hint}
      <button class="la-btn la-btn-primary" id="la-check" type="button" onclick="laPrimary()" ${ready ? '' : 'disabled'}>Check</button>
    </div>`;
}

/** What the right answer was, and -- where words can be compared -- which of
    yours were wrong and which of its you left out. */
function laCorrectionHTML(it, last) {
  if (it.type === 'match') {
    if (!last.expected) return '';
    const rows = last.expected.split('; ').map(p => `<li>${escapeHTML(p)}</li>`).join('');
    return `<div class="la-fb-label">${last.skipped ? 'The pairs were:' : 'You mixed up:'}</div>
            <ul class="la-fb-pairs">${rows}</ul>`;
  }
  const d = last.diff;
  const answer = d
    ? laMarkedWordsHTML(d.e, d.eOk, 'la-w-miss')
    : escapeHTML(last.expected);
  const yours = d && !last.skipped && d.g.length
    ? `<div class="la-fb-yours"><span>${it.type === 'translate' ? 'You wrote' : 'You built'}:</span> ${laMarkedWordsHTML(d.g, d.gOk, 'la-w-extra')}</div>`
    : '';
  return `<div class="la-fb-label">Correct answer:</div>
          <div class="la-fb-answer">${answer}${langSpeakChip(last.expected, _laStudyCode())}</div>
          ${yours}`;
}

function laMarkedWordsHTML(words, ok, cls) {
  return words.map((w, k) => ok[k] ? escapeHTML(w) : `<span class="${cls}">${escapeHTML(w)}</span>`).join(' ');
}

/* ── Comparing answers word by word ───────────────────────── */

function laWords(s) { return String(s || '').trim().split(/\s+/).filter(Boolean); }

/**
 * The longest run of words two answers share, in order -- so a wrong answer
 * can say WHICH words were wrong rather than only that something was.
 * Compared after langNormalizeAnswer, the same rule the grade uses, so a
 * capital or a full stop is never marked as the mistake.
 * @returns {{g: string[], e: string[], gOk: boolean[], eOk: boolean[]}}
 */
function laWordDiff(givenWords, expected) {
  const g = givenWords, e = laWords(expected);
  const gn = g.map(langNormalizeAnswer), en = e.map(langNormalizeAnswer);
  const m = g.length, n = e.length;
  const L = [];
  for (let i = 0; i <= m; i++) L.push(new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      L[i][j] = gn[i] === en[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const gOk = new Array(m).fill(false), eOk = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (gn[i] === en[j]) { gOk[i] = true; eOk[j] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return { g, e, gOk, eOk };
}

/* ── Interaction ──────────────────────────────────────────── */

function laPick(id) {
  if (!_la || _la.state !== 'answering') return;
  const t = _la.pool.find(x => x.id === id);
  if (!t) return;
  const it = laCurrent();
  // A blank takes exactly one word: tapping a second replaces the first
  // rather than silently doing nothing.
  if (it.type === 'blank') _la.picked = [t];
  else if (!_la.picked.some(p => p.id === id)) _la.picked.push(t);
  laRender();
}

function laUnpick(id) {
  if (!_la || _la.state !== 'answering') return;
  _la.picked = _la.picked.filter(p => p.id !== id);
  laRender();
}

/** Backspace: the last word laid down goes back. */
function laUndo() {
  if (!_la || _la.state !== 'answering' || !_la.picked.length) return false;
  _la.picked.pop();
  laRender();
  return true;
}

function laChoose(i) {
  if (!_la || _la.state !== 'answering') return;
  _la.choice = i;
  laRender();
}

function laTyped(v) {
  if (!_la) return;
  _la.typed = v;
  // The footer is not repainted per keystroke, so Check is enabled here --
  // it used to stay greyed out until something else redrew the screen.
  const btn = document.getElementById('la-check');
  if (btn) btn.disabled = !String(v).trim();
}

/* Matching is checked pair by pair, the moment both halves are chosen. A
   right pair locks in; a wrong one flashes red and lets go, and is remembered
   -- the question counts as correct only if no pair was ever wrong. Grading
   the whole grid at the end meant reading back five crossed lines to find the
   one that was off. Either side can be chosen first. */
function laMatchLeft(i) {
  if (!_la || _la.state !== 'answering' || _la.matchDone.some(d => d.l === i)) return;
  _la.matchLeft = _la.matchLeft === i ? null : i;
  laMatchTry();
}

function laMatchRight(i) {
  if (!_la || _la.state !== 'answering' || _la.matchDone.some(d => d.r === i)) return;
  _la.matchRight = _la.matchRight === i ? null : i;
  laMatchTry();
}

let _laFlashSeq = 0;

function laMatchTry() {
  const l = _la.matchLeft, r = _la.matchRight;
  if (l == null || r == null) { laRender(); return; }
  _la.matchLeft = _la.matchRight = null;
  const list = _la.matchList || [];
  const norm = langNormalizeAnswer;
  // Two pairs can share a word; either reading of it is right.
  const ok = l === r
    || norm(list[l].right) === norm(list[r].right)
    || norm(list[l].left) === norm(list[r].left);
  if (ok) _la.matchDone.push({ l, r });
  else _la.matchMiss.push({ l, r });
  const seq = ++_laFlashSeq;
  _la.matchFlash = { l, r, ok, seq };
  setTimeout(() => {
    if (_la && _la.matchFlash && _la.matchFlash.seq === seq) { _la.matchFlash = null; laRender(); }
  }, 550);
  if (_la.matchDone.length === list.length) { laPrimary(); return; }
  laRender();
}

function laHasAnswer(it) {
  if (!_la) return false;
  if (it.type === 'arrange' || it.type === 'blank') return _la.picked.length > 0;
  if (it.type === 'choice') return _la.choice > -1;
  if (it.type === 'translate') return (_la.typed || '').trim().length > 0;
  if (it.type === 'match') return _la.matchDone.length === (_la.matchList || []).length;
  return false;
}

/** Check, or advance — the one button does both, as the footer says. */
function laPrimary() {
  if (!_la) return;
  if (_la.state === 'checked') { laAdvance(); return; }
  if (_la.state !== 'answering') return;
  const it = laCurrent();
  if (!it || !laHasAnswer(it)) return;

  let given = '', expected = '', ok = false, diff = null;
  if (it.type === 'arrange') {
    const words = _la.picked.map(t => t.text);
    given = words.join(' ');
    expected = it.answer;
    ok = langAnswersMatch(given, expected);
    diff = laWordDiff(words, expected);
  } else if (it.type === 'blank') {
    given = _la.picked.map(t => t.text).join(' ');
    expected = it.answer;
    ok = langAnswersMatch(given, expected);
  } else if (it.type === 'choice') {
    const picked = (_la.shuffledOptions || [])[_la.choice];
    given = picked ? picked.text : '';
    expected = (it.options || [])[it.correctIndex] || '';
    ok = !!(picked && picked.correct);
  } else if (it.type === 'translate') {
    given = _la.typed;
    expected = it.answer;
    ok = langAnswersMatch(given, expected);
    diff = laWordDiff(laWords(given), expected);
  } else if (it.type === 'match') {
    const list = _la.matchList || [];
    ok = _la.matchMiss.length === 0;
    const missed = [];
    _la.matchMiss.forEach(m => { if (missed.indexOf(m.l) < 0) missed.push(m.l); });
    given = ok ? 'all matched' : _la.matchMiss.map(m => list[m.l].left + ' → ' + list[m.r].right).join('; ');
    expected = missed.map(l => list[l].left + ' → ' + list[l].right).join('; ');
  }

  laRecord(it, { ok, given, expected, diff });
}

function laSkip() {
  if (!_la || _la.state !== 'answering') return;
  const it = laCurrent();
  laRecord(it, { ok: false, skipped: true, given: '(skipped)', expected: laExpectedOf(it), diff: null });
}

/** One answer, graded: the score, the hearts, the streak and the word's own schedule. */
function laRecord(it, res) {
  _la.answered.push(Object.assign({ idx: _la.idx, id: it.id, type: it.type, prompt: it.prompt || '' }, res));
  if (res.ok) {
    _la.correct++;
    _la.streak++;
    _la.bestStreak = Math.max(_la.bestStreak, _la.streak);
  } else {
    _la.hearts = Math.max(0, _la.hearts - 1);
    _la.streak = 0;
  }
  /* Tell the library what just happened to this WORD, not only to this run.
     A question generated from the dictionary carries the word it came from,
     which is what turns a drill into a review schedule rather than a score.
     A skip is not knowing it, so it schedules like a miss. */
  if (it.wordId && typeof langRecallGrade === 'function') langRecallGrade(it.wordId, !!res.ok);
  _la.state = 'checked';
  laRender();
}

function laExpectedOf(it) {
  if (it.type === 'choice') return (it.options || [])[it.correctIndex] || '';
  if (it.type === 'match') {
    return (it.pairs || []).filter(p => (p.left || '').trim() && (p.right || '').trim())
      .map(p => p.left + ' → ' + p.right).join('; ');
  }
  return it.answer || '';
}

function laAdvance() {
  if (!_la) return;
  if (_la.hearts <= 0) { laFinish(); return; }
  if (_la.idx + 1 >= _la.queue.length) { laFinish(); return; }
  _la.idx++;
  laLoadQuestion();
}

function laFinish(reason) {
  if (!_la || _la.state === 'over') return;
  laStopTimer();
  _la.state = 'over';
  _la.reason = reason || null;
  _la.endTime = Date.now();
  const total = _la.queue.length;
  const score = total ? Math.round((_la.correct / total) * 100) : 0;
  // A mistakes-only rerun is extra practice on a run already on record;
  // filing it as a run of its own would show three questions at 100%.
  if (!_la.review) {
    langRecordAttempt({
      kind: _la.set.isType ? 'type' : 'set',
      refId: _la.set.isType ? _la.set.type : _la.set.id,
      title: _la.set.title,
      score, correct: _la.correct, total,
      lang: _la.set.lang, refLang: _la.set.refLang,
      heartsLeft: _la.hearts,
      endedBy: reason || 'finished',
      duration: Math.round((_la.endTime - _la.startTime) / 1000)
    });
  }
  laRender();
}

function laSummaryHTML() {
  const total = _la.queue.length;
  const score = total ? Math.round((_la.correct / total) * 100) : 0;
  const cls = score >= 80 ? 'score-perfect' : score >= 50 ? 'score-partial' : 'score-low';
  const wrong = _la.answered.filter(a => !a.ok);
  const outOfHearts = _la.hearts <= 0 && _la.answered.length < total;
  const timedOut = _la.reason === 'time';
  const secs = Math.max(0, Math.round(((_la.endTime || Date.now()) - _la.startTime) / 1000));
  const head = timedOut ? 'Time’s up' : outOfHearts ? 'Out of hearts' : score === 100 ? 'Perfect run!' : score >= 80 ? 'Lesson complete!' : 'Run finished';
  const sub = `${_la.correct} of ${total} correct${outOfHearts ? ' — the run ended early.' : timedOut ? ' — the clock beat you.' : '.'}${_la.review ? ' Mistakes practice is not added to your history.' : ''}`;
  const stat = (key, label, icon, value) => `
    <div class="la-stat la-stat-${key}">
      <div class="la-stat-label">${label}</div>
      <div class="la-stat-value"><i data-lucide="${icon}"></i> ${value}</div>
    </div>`;
  return `
    <div class="la-summary">
      <div class="la-summary-icon ${cls}"><i data-lucide="${timedOut ? 'timer-off' : score >= 80 ? 'trophy' : score >= 50 ? 'target' : 'refresh-cw'}"></i></div>
      <h2>${head}</h2>
      <p class="la-summary-sub">${sub}</p>
      <div class="la-stats">
        ${stat('score ' + cls, 'Score', 'target', score + '%')}
        ${stat('correct', 'Correct', 'check-circle-2', _la.correct + '/' + total)}
        ${stat('time', 'Time', 'timer', laClockText(secs))}
        ${stat('streak', 'Best streak', 'flame', _la.bestStreak)}
      </div>
      ${wrong.length ? `
        <div class="la-review">
          <h3>Worth another look</h3>
          ${wrong.map(a => `
            <div class="la-review-row">
              ${a.prompt && a.type !== 'match' ? `<div class="la-review-prompt">${escapeHTML(a.prompt)}</div>` : ''}
              <div class="la-review-pair">
                <span class="la-review-given">${escapeHTML(a.given || '(no answer)')}</span>
                <i data-lucide="arrow-right"></i>
                <span class="la-review-expected">${escapeHTML(a.expected)}</span>
              </div>
            </div>`).join('')}
        </div>` : ''}
      <div class="la-summary-actions">
        <button class="la-btn la-btn-ghost" type="button" onclick="spaNavigate('language')">Back to library</button>
        ${wrong.length ? `<button class="la-btn la-btn-ghost la-btn-accent" type="button" onclick="laRetryMistakes()">
          <i data-lucide="rotate-ccw"></i> Practise ${wrong.length === 1 ? 'the mistake' : wrong.length + ' mistakes'}</button>` : ''}
        <button class="la-btn la-btn-primary" type="button" onclick="laRetry()">
          <i data-lucide="repeat"></i> Run again
        </button>
      </div>
    </div>`;
}

function laRetry() {
  laStopTimer();
  _la = null;
  langAttemptInit();   // the session params that started it are still set
}

/** Just the questions you missed, in a fresh order. */
function laRetryMistakes() {
  if (!_la) return;
  const queue = _la.answered.filter(a => !a.ok).map(a => _la.queue[a.idx]).filter(Boolean);
  if (!queue.length) return;
  laStopTimer();
  _la = laNewRun(_la.set, langShuffle(queue), _la.limit, true);
  laStartTimer();
  laLoadQuestion();
}

/* ── Keyboard ─────────────────────────────────────────────── */

/* Bound on the document for the life of the route. Anything typed into a
   field stays with the field, and a focused button keeps Enter for itself,
   so tabbing to Skip and pressing Enter skips rather than checks. */
function laOnKey(e) {
  if (!_la || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;
  const t = e.target;
  const tag = t && t.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(t && t.isContentEditable);
  const onButton = !typing && t && t.closest && t.closest('button, [role="button"]');

  if (e.key === 'Escape') { e.preventDefault(); laExit(); return; }
  if (e.key === 'Enter') {
    if (onButton || e.repeat) return;
    if (typing && t.id !== 'la-input') return;
    e.preventDefault();
    if (_la.state !== 'over') laPrimary();
    return;
  }
  if (typing || _la.state !== 'answering') return;
  if (e.key === 'Backspace') { if (laUndo()) e.preventDefault(); return; }
  if (/^[0-9]$/.test(e.key) && laPickByKey(e.key === '0' ? 10 : Number(e.key))) e.preventDefault();
}

/** Number key n: the nth tile, option or match card, as numbered on screen. */
function laPickByKey(n) {
  const it = laCurrent();
  if (!it) return false;
  if (it.type === 'arrange' || it.type === 'blank') {
    const t = _la.pool[n - 1];
    if (!t) return false;
    // The same key again takes the word back.
    if (_la.picked.some(p => p.id === t.id)) laUnpick(t.id); else laPick(t.id);
    return true;
  }
  if (it.type === 'choice') {
    if (n > (_la.shuffledOptions || []).length) return false;
    laChoose(n - 1);
    return true;
  }
  if (it.type === 'match') {
    const a = _la.matchA || [], b = _la.matchB || [];
    if (n <= a.length) { laMatchLeft(a[n - 1].i); return true; }
    const r = b[n - 1 - a.length];
    if (!r) return false;
    laMatchRight(r.i);
    return true;
  }
  return false;
}

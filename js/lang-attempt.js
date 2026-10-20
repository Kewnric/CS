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
      <!-- What kind of question this is, up in the corner of the page rather
           than over the question, where it read as part of the prompt. -->
      <div class="la-strip">
        <div class="la-kind" id="la-kind"></div>
        <div class="la-toggles">
          <button class="la-toggle" id="la-tg-sfx" type="button" onclick="laToggleSfx()"></button>
          <button class="la-toggle" id="la-tg-say" type="button" onclick="laToggleSay()"></button>
          <button class="la-toggle" id="la-tg-set" type="button" onclick="laOpenSettings()" title="Run settings">
            <i data-lucide="settings-2"></i><span>Settings</span>
          </button>
        </div>
      </div>
      <header class="la-top">
        <button class="la-exit" type="button" onclick="laExit()" title="Leave the drill (Esc)" aria-label="Leave the drill">
          <i data-lucide="x"></i>
        </button>
        <div class="la-progress" id="la-progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100">
          <div class="la-progress-fill" id="la-progress-fill"></div>
        </div>
        <span class="la-count" id="la-count"></span>
        <span class="la-clock" id="la-clock"></span>
        <div class="la-hearts" id="la-hearts"></div>
      </header>
      <main class="la-body" id="la-body"></main>
      <footer class="la-foot" id="la-foot" aria-live="polite"></footer>
      <div class="la-sheet" id="la-sheet" hidden></div>
    </div>`;
}

/** A fresh run over a queue. `review` marks a mistakes-only rerun, which is
    practice on top of a run already recorded and so is not recorded again. */
function laNewRun(set, queue, limit, review) {
  const prefs = typeof laPrefs === 'function' ? laPrefs() : { hearts: 3 };
  const lives = prefs.hearts > 0 ? prefs.hearts : 0;   // 0 = unlimited
  return {
    set,
    limit,
    remaining: limit,
    queue,
    idx: 0,
    hearts: lives || Infinity,
    maxHearts: lives,
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
  // A run is a sitting, not the whole pool: ten by default, as many as you like.
  const len = typeof laPrefs === 'function' ? laPrefs().length : 0;
  if (len > 0) queue = queue.slice(0, len);

  _la = laNewRun(set, queue, limit, false);
  document.removeEventListener('keydown', laOnKey);
  document.addEventListener('keydown', laOnKey);
  laPaintToggles();
  laStartTimer();
  laLoadQuestion();
}

function langAttemptDestroy() {
  laStopTimer();
  document.removeEventListener('keydown', laOnKey);
  // Nothing should still be falling after you leave the page.
  if (typeof ppClearFx === 'function') ppClearFx();
  _la = null;
}

/* ── Sound, speech and effects ────────────────────────────── */

/* Read each word aloud as it lands in the sentence, and the whole answer once
   it is checked. On by default -- hearing the word is half of learning it --
   and remembered per device. */
const LA_SAY_KEY = 'ssp.langAutoSpeak';

function laSayOn() {
  try { return localStorage.getItem(LA_SAY_KEY) !== '0'; } catch (e) { return true; }
}

/* The effects ride the app's one sound switch (the practice page's speaker),
   so muting in either place mutes both. */
function laSfxOn() { return typeof sfxEnabled !== 'function' || sfxEnabled(); }

function laToggleSfx() {
  try { localStorage.setItem(typeof SFX_KEY !== 'undefined' ? SFX_KEY : 'ssp.typingSfx', laSfxOn() ? '0' : '1'); } catch (e) {}
  laPaintToggles();
  laSfx('tap');
}

function laToggleSay() {
  const on = !laSayOn();
  try { localStorage.setItem(LA_SAY_KEY, on ? '1' : '0'); } catch (e) {}
  if (!on && window.speechSynthesis) window.speechSynthesis.cancel();
  laPaintToggles();
}

function laPaintToggles() {
  const paint = (id, on, icon, offIcon, label, tip) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = tip + (on ? ' — on' : ' — off');
    b.innerHTML = `<i data-lucide="${on ? icon : offIcon}"></i><span>${label}</span>`;
  };
  paint('la-tg-sfx', laSfxOn(), 'volume-2', 'volume-x', 'Sounds', 'Sound effects');
  paint('la-tg-say', laSayOn(), 'audio-lines', 'audio-lines', 'Read aloud', 'Read each word aloud as it lands');
  laIcons();
}

/** Short synthesised cues, on the practice page's cue bus. */
function laSfx(kind) {
  if (!laSfxOn() || typeof psfxTone !== 'function') return;
  if (kind === 'tap') {
    psfxTone({ freq: 620, to: 900, type: 'sine', dur: 0.07, gain: 0.07 });
  } else if (kind === 'back') {
    psfxTone({ freq: 760, to: 430, type: 'sine', dur: 0.08, gain: 0.06 });
  } else if (kind === 'right') {
    // A bright rising triad with a sparkle on top: unmistakably "yes".
    [[784, 0], [988, 0.08], [1319, 0.16]].forEach(([f, at]) =>
      psfxTone({ freq: f, type: 'triangle', dur: 0.24, gain: 0.12, at }));
    psfxTone({ freq: 2637, type: 'sine', dur: 0.4, gain: 0.035, at: 0.2 });
  } else if (kind === 'wrong') {
    if (typeof psfxFail === 'function') psfxFail();
  } else if (kind === 'pair') {
    psfxTone({ freq: 880, to: 1175, type: 'triangle', dur: 0.1, gain: 0.09 });
  } else if (kind === 'miss') {
    psfxTone({ freq: 233, to: 165, type: 'square', dur: 0.14, gain: 0.05, lowpass: 900 });
  } else if (kind === 'skip') {
    psfxTone({ freq: 392, to: 294, type: 'triangle', dur: 0.16, gain: 0.08 });
  } else if (kind === 'low') {
    [[523, 0], [440, 0.12], [392, 0.24]].forEach(([f, at]) =>
      psfxTone({ freq: f, type: 'triangle', dur: 0.26, gain: 0.08, at }));
  }
}

function laReduceMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Where the answer is on screen -- the place the confetti or crosses come out of. */
function laAnswerRect() {
  const el = document.querySelector('#la-body .la-lane, #la-body .la-blank-slot, #la-body .la-option.is-bad, '
    + '#la-body .la-option.is-ok, #la-body .la-typed, #la-body .la-match');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 ? r : null;
}

/**
 * The verdict, thrown at you: confetti out of the answer when it is right, a
 * shower of crosses when it is not -- the coding library's test-case effects,
 * so a right answer feels the same everywhere in the app. The sound plays even
 * with reduced motion; asking not to see animation is not asking not to hear.
 */
function laCelebrate(ok) {
  laSfx(ok ? 'right' : 'wrong');
  const bar = document.getElementById('la-progress');
  if (ok && bar) {
    bar.classList.remove('is-boost');
    void bar.offsetWidth;
    bar.classList.add('is-boost');
  }
  if (laReduceMotion()) return;
  const r = laAnswerRect();
  if (ok) {
    if (typeof _ppConfettiBurst !== 'function') return;
    if (r) _ppConfettiBurst(r);
    const badge = document.querySelector('.la-fb-badge');
    if (badge) setTimeout(() => _ppConfettiBurst(badge.getBoundingClientRect()), 120);
  } else if (r && typeof _ppCrossRain === 'function') {
    _ppCrossRain(r);
  }
}

/** The end of the run: stars for a perfect one, a fanfare for a good one. */
function laCelebrateRun(score) {
  if (score === 100 && typeof ppStarfall === 'function') ppStarfall();
  else if (score >= 80 && laSfxOn() && typeof psfxPowerUp === 'function') psfxPowerUp();
  else if (score < 50) laSfx('low');
  if (score < 80 || laReduceMotion() || typeof _ppConfettiBurst !== 'function') return;
  const icon = document.querySelector('.la-summary-icon');
  if (icon) _ppConfettiBurst(icon.getBoundingClientRect());
}

/* ── Tiles in flight ──────────────────────────────────────────
   The screen is redrawn on every tap, so a tile does not move -- it vanishes
   from one place and appears in another. FLIP puts the motion back: measure
   every tile before the redraw, measure again after, and play each one from
   where it was to where it is. The tile you tapped arcs up and lands with a
   little overshoot; the ones that shuffle along to close a gap just slide. */

function laSnapTiles() {
  const m = {};
  document.querySelectorAll('#la-body [data-tid]').forEach(el => { m[el.dataset.tid] = el.getBoundingClientRect(); });
  return m;
}

function laFlip(before, movedId) {
  if (laReduceMotion() || !before) return;
  document.querySelectorAll('#la-body [data-tid]').forEach(el => {
    const a = before[el.dataset.tid];
    if (!a || typeof el.animate !== 'function') return;
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    if (el.dataset.tid === movedId) {
      el.style.zIndex = '5';
      const lift = Math.min(28, 10 + Math.abs(dy) * 0.12);
      const anim = el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(1)` },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - lift}px) scale(1.08)`, offset: 0.45 },
        { transform: 'translate(0, 0) scale(1)' }
      ], { duration: 360, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1.12)' });
      anim.onfinish = anim.oncancel = () => { el.style.zIndex = ''; };
    } else {
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
    }
  });
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
  // The card slides in once per question, not on every tap inside it.
  _la.fresh = true;
  _la.help = 0;            // hints used on this question
  _la.gone = [];           // tiles / options a hint has cleared
  _la.revealed = 0;        // translate: letters a hint has given
  _la.showMeaning = false; // blank: a hint can show the meaning when it is switched off
  if (it && (it.type === 'arrange' || it.type === 'blank')) {
    _la.pool = langShuffle(laFairTokens(it)).map((t, i) => ({ id: 'tk' + i, text: t }));
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
    if (!_la.maxHearts) {
      hearts.title = 'Unlimited hearts — practice mode';
      hearts.innerHTML = '<i data-lucide="heart" class="la-heart"></i><span class="la-heart-inf">∞</span>';
    } else {
      hearts.title = _la.hearts + (_la.hearts === 1 ? ' heart' : ' hearts') + ' left';
      // The heart that was just lost breaks rather than simply going grey.
      const shown = _la.heartsShown == null ? _la.hearts : _la.heartsShown;
      hearts.innerHTML = Array.from({ length: _la.maxHearts }, (_, i) =>
        `<i data-lucide="heart" class="la-heart${i < _la.hearts ? '' : ' is-lost'}${i >= _la.hearts && i < shown ? ' is-breaking' : ''}"></i>`).join('');
      _la.heartsShown = _la.hearts;
    }
    hearts.setAttribute('aria-label', hearts.title);
  }
  const count = document.getElementById('la-count');
  if (count) count.textContent = _la.state === 'over' ? '' : Math.min(_la.idx + 1, _la.queue.length) + ' / ' + _la.queue.length;
  const shell = document.getElementById('la-shell');
  if (shell && typeof laPrefs === 'function') {
    const pr = laPrefs();
    shell.classList.toggle('la-no-keys', !pr.keys);
    shell.classList.toggle('la-no-speakers', !pr.speakers);
  }
  laPaintClock();

  const kind = document.getElementById('la-kind');

  if (_la.state === 'over') {
    if (kind) kind.innerHTML = `<i data-lucide="flag"></i> ${escapeHTML(_la.set.title || 'Results')}`;
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
  if (kind) kind.innerHTML = `<i data-lucide="${meta.icon}"></i> ${escapeHTML(meta.name)}`;
  const fresh = _la.fresh;
  _la.fresh = false;

  body.innerHTML = `
    <div class="la-card${fresh ? ' is-new' : ''}${last ? (last.ok ? ' is-checked is-right' : ' is-checked is-wrong') : ''}">
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
         </div>
         ${laMeaningLineHTML(it)}`
      : '';
    // Which of the placed words were wrong -- only meaningful once checked.
    const marks = checked && last && last.diff ? last.diff.gOk : null;
    const lane = it.type === 'arrange' ? `
      <div class="la-lane" id="la-lane">
        ${_la.picked.map((t, k) => {
          const cls = !checked ? '' : (last && last.ok) || (marks && marks[k]) ? ' is-ok' : ' is-bad';
          return `<button class="la-tile is-placed${cls}" type="button" data-tid="${t.id}" style="--i:${k}"
                    onclick="laUnpick('${t.id}')" title="Tap to take back"><span class="la-tile-text">${escapeHTML(t.text)}</span></button>`;
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
            ? `<button class="la-tile is-used" type="button" tabindex="-1" aria-hidden="true" disabled style="--d:${k}">${laKeyHTML(k + 1)}<span class="la-tile-text">${escapeHTML(t.text)}</span><span class="la-chip-ph"></span></button>`
            : _la.gone.indexOf(t.id) > -1
            ? `<button class="la-tile is-gone" type="button" tabindex="-1" disabled title="A hint ruled this one out" style="--d:${k}">${laKeyHTML(k + 1)}<span class="la-tile-text">${escapeHTML(t.text)}</span><span class="la-chip-ph"></span></button>`
            : `<button class="la-tile" type="button" data-tid="${t.id}" onclick="laPick('${t.id}')" ${checked ? 'disabled' : ''} style="--d:${k}">${laKeyHTML(k + 1)}<span class="la-tile-text">${escapeHTML(t.text)}</span>${langSpeakChip(t.text, _laStudyCode())}</button>`;
        }).join('')}
      </div>`;
  }

  if (it.type === 'choice') {
    return `<div class="la-options">
      ${(_la.shuffledOptions || []).map((o, i) => {
        const gone = _la.gone.indexOf(i) > -1;
        let cls = _la.choice === i ? ' is-picked' : gone ? ' is-gone' : '';
        if (checked) cls = o.correct ? ' is-ok' : _la.choice === i ? ' is-bad' : ' is-faded';
        // Afterwards every option says what it means -- the wrong ones are
        // vocabulary too, and this is the moment you are looking at them.
        const gloss = checked && typeof laWordGloss === 'function' ? laWordGloss(o.text) : '';
        return `
        <button class="la-option${cls}" type="button" onclick="laChoose(${i})" ${checked || gone ? 'disabled' : ''} style="--d:${i}">
          <span class="la-option-key">${i + 1}</span>
          <span class="la-option-text">${escapeHTML(o.text)}${gloss ? `<small class="la-option-gloss">${escapeHTML(gloss)}</small>` : ''}</span>
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
    </div>
    ${_la.revealed && !checked ? laRevealHTML(it.answer) : ''}`;
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
                  type="button" onclick="laMatchLeft(${x.i})" ${leftDone(x.i) ? 'disabled' : ''} style="--d:${k}">
            ${laKeyHTML(k + 1)}${leftDone(x.i) ? '<i data-lucide="check" class="la-done-ico"></i>' : ''}<span class="la-tile-text">${escapeHTML(x.text)}</span>${langSpeakChip(x.text, _laStudyCode())}</button>`).join('')}
      </div>
      <div class="la-match-col">
        ${b.map((x, k) => `
          <button class="la-match-btn${_la.matchRight === x.i ? ' is-picked' : ''}${rightDone(x.i) ? ' is-done' : ''}${flash('r', x.i)}"
                  type="button" onclick="laMatchRight(${x.i})" ${rightDone(x.i) ? 'disabled' : ''} style="--d:${k + a.length}">
            ${laKeyHTML(a.length + k + 1)}${rightDone(x.i) ? '<i data-lucide="check" class="la-done-ico"></i>' : ''}<span class="la-tile-text">${escapeHTML(x.text)}</span>${langSpeakChip(x.text, _laStudyCode())}</button>`).join('')}
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
    ? `<button type="button" class="la-blank-slot${cls}" data-tid="${_la.picked[0].id}" onclick="laUnpick('${_la.picked[0].id}')" title="Tap to take back">${filled}</button>`
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
            <div class="la-verdict">${laVerdictText(last)}${streak}</div>
            ${last.ok ? laOkExtraHTML(it, last) : laCorrectionHTML(it, last)}
            ${it.type === 'blank' ? laAfterMeaningHTML(it) : ''}
            ${note}
          </div>
        </div>
        ${go}
      </div>`;
  }
  const ready = laHasAnswer(it);
  const tip = it.type === 'match'
    ? '<span class="la-foot-hint">Tap a word, then its partner</span>' : '<span class="la-foot-hint"></span>';
  const showHint = typeof laPrefs === 'function' && laPrefs().hints;
  return `
    <div class="la-foot-inner">
      <button class="la-btn la-btn-ghost" type="button" onclick="laSkip()">Skip</button>
      ${tip}
      <div class="la-foot-right">
        ${showHint ? `<button class="la-btn la-btn-hint" type="button" onclick="laHint()" ${laHintAvailable(it) ? '' : 'disabled'}
                title="A hint (H). Costs no heart.">
          <i data-lucide="lightbulb"></i><span>Hint</span>${_la.help ? `<b>${_la.help}</b>` : ''}</button>` : ''}
        <button class="la-btn la-btn-primary" id="la-check" type="button" onclick="laPrimary()" ${ready ? '' : 'disabled'}>Check</button>
      </div>
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
  const before = laSnapTiles();
  // A blank takes exactly one word: tapping a second replaces the first
  // rather than silently doing nothing.
  if (it.type === 'blank') _la.picked = [t];
  else if (!_la.picked.some(p => p.id === id)) _la.picked.push(t);
  laRender();
  laFlip(before, id);
  laSfx('tap');
  if (laSayOn()) laSpeak(t.text);
}

function laUnpick(id) {
  if (!_la || _la.state !== 'answering') return;
  const before = laSnapTiles();
  _la.picked = _la.picked.filter(p => p.id !== id);
  laRender();
  laFlip(before, id);
  laSfx('back');
}

/** Backspace: the last word laid down goes back. */
function laUndo() {
  if (!_la || _la.state !== 'answering' || !_la.picked.length) return false;
  laUnpick(_la.picked[_la.picked.length - 1].id);
  return true;
}

function laChoose(i) {
  if (!_la || _la.state !== 'answering') return;
  _la.choice = i;
  laRender();
  laSfx('tap');
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
  const last = _la.matchDone.length === list.length;
  if (!last) laSfx(ok ? 'pair' : 'miss');   // the final pair gets the verdict's sound instead
  const seq = ++_laFlashSeq;
  _la.matchFlash = { l, r, ok, seq };
  setTimeout(() => {
    if (_la && _la.matchFlash && _la.matchFlash.seq === seq) { _la.matchFlash = null; laRender(); }
  }, 550);
  if (last) { laPrimary(); return; }
  laRender();
}

/** The answer as one sentence, for reading aloud after Check. */
function laSayableAnswer(it) {
  if (it.type === 'blank') return String(it.prompt || '').replace(/_{2,}|\{\}/, it.answer || '');
  if (it.type === 'arrange' || it.type === 'translate') return it.answer || '';
  return '';
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

  let given = '', expected = '', ok = false, diff = null, close = '', slip = false;
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
    const how = typeof laTypoMatch === 'function' && laPrefs().typos
      ? laTypoMatch(given, expected)
      : (langAnswersMatch(given, expected) ? 'exact' : '');
    ok = !!how;
    if (how === 'typo' || how === 'accents') close = how;
    diff = laWordDiff(laWords(given), expected);
  } else if (it.type === 'match') {
    const list = _la.matchList || [];
    /* One slip is forgiven in a grid of three or more. Failing a five-pair
       grid for one mis-tap taught nothing the flash had not already shown. */
    const free = list.length >= 3 ? 1 : 0;
    ok = _la.matchMiss.length <= free;
    slip = ok && _la.matchMiss.length > 0;
    const missed = [];
    _la.matchMiss.forEach(m => { if (missed.indexOf(m.l) < 0) missed.push(m.l); });
    given = ok ? 'all matched' : _la.matchMiss.map(m => list[m.l].left + ' → ' + list[m.r].right).join('; ');
    expected = missed.map(l => list[l].left + ' → ' + list[l].right).join('; ');
  }

  laRecord(it, { ok, given, expected, diff, close, slip, help: _la.help });
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
  // Right with a hint, a typo or a slip is right -- but not easy, so it comes back sooner.
  const hard = !!(res.help || res.close || res.slip);
  if (it.wordId && typeof langRecallGrade === 'function') langRecallGrade(it.wordId, !!res.ok, hard);
  _la.state = 'checked';
  laRender();
  if (res.ok && typeof laPrefs === 'function' && laPrefs().autoNext) {
    const at = _la.idx;
    setTimeout(() => { if (_la && _la.idx === at && _la.state === 'checked') laAdvance(); }, it.note || hard ? 2400 : 1300);
  }
  if (res.skipped) laSfx('skip');
  else laCelebrate(!!res.ok);
  // Then the right answer, read out -- after the cue, so the two do not collide.
  const say = laSayableAnswer(it);
  if (say && laSayOn()) {
    const idx = _la.idx;
    setTimeout(() => { if (_la && _la.idx === idx && _la.state === 'checked') laSpeak(say); }, 450);
  }
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
  laCelebrateRun(score);
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
  if (laSettingsOpen()) {
    if (e.key === 'Escape') { e.preventDefault(); laCloseSettings(); }
    return;
  }
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
  if ((e.key === 'h' || e.key === 'H') && laPrefs().hints) { e.preventDefault(); laHint(); return; }
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

/* ── Fair questions ───────────────────────────────────────── */

/**
 * The tiles for a question, minus the ones that make it unfair.
 *
 * A one-word gap was offered whole phrases -- "maayong buntag" for "___ ko."
 * -- which can be ruled out by their length alone and so teach nothing; they
 * stay only if dropping them would leave fewer than two wrong tiles. And a
 * distractor that IS one of the answer's words makes two right answers when
 * only one is accepted, so it goes, as does a distractor offered twice.
 */
function laFairTokens(it) {
  const tokens = langTokensFor(it);
  const nAns = it.type === 'blank' ? 1 : laWords(it.answer).length;
  const answer = tokens.slice(0, nAns);
  const inAnswer = answer.map(langNormalizeAnswer);
  let extra = tokens.slice(nAns).filter(t => inAnswer.indexOf(langNormalizeAnswer(t)) < 0);
  extra = extra.filter((t, i) => extra.findIndex(x => langNormalizeAnswer(x) === langNormalizeAnswer(t)) === i);
  if (it.type === 'blank') {
    const n = laWords(it.answer).length;
    const sameShape = extra.filter(t => laWords(t).length === n);
    if (sameShape.length >= 2) extra = sameShape;
  }
  return answer.concat(extra);
}

/** Under a fill-in-the-blank sentence: what the whole sentence means. */
function laMeaningLineHTML(it) {
  const m = typeof laSentenceMeaning === 'function' ? laSentenceMeaning(it) : '';
  if (!m || (!laPrefs().meanings && !_la.showMeaning)) return '';
  return `<div class="la-meaning"><i data-lucide="languages"></i><span>${escapeHTML(m)}</span></div>`;
}

/** With meanings switched off, the verdict still says what the sentence meant. */
function laAfterMeaningHTML(it) {
  const m = typeof laSentenceMeaning === 'function' ? laSentenceMeaning(it) : '';
  if (!m || laPrefs().meanings || _la.showMeaning) return '';
  return `<div class="la-fb-note"><i data-lucide="languages"></i><span>Means: ${escapeHTML(m)}</span></div>`;
}

/** The answer's shape with the letters a hint has given filled in. */
function laRevealHTML(answer) {
  const a = Array.from(String(answer || ''));
  return `<div class="la-reveal" aria-label="Hint: the answer starts ${escapeHTML(a.slice(0, _la.revealed).join(''))}">
    ${a.map((ch, i) => /\s/.test(ch)
      ? '<span class="la-reveal-gap"></span>'
      : `<span class="la-reveal-cell${i < _la.revealed ? ' is-on' : ''}">${i < _la.revealed ? escapeHTML(ch) : ''}</span>`).join('')}
  </div>`;
}

function laVerdictText(last) {
  if (!last.ok) return last.skipped ? 'Skipped' : 'Incorrect';
  if (last.close === 'typo') return 'Almost — mind the spelling';
  if (last.close === 'accents') return 'Correct — mind the accents';
  if (last.slip) return 'Done — one slip forgiven';
  if (last.help) return 'Correct, with a hint';
  return LA_PRAISE[_la.idx % LA_PRAISE.length];
}

/** A right answer that was not quite clean says what to keep an eye on. */
function laOkExtraHTML(it, last) {
  if (last.close) {
    return `<div class="la-fb-label">It is spelled</div>
            <div class="la-fb-answer">${escapeHTML(last.expected)}${langSpeakChip(last.expected, _laStudyCode())}</div>
            <div class="la-fb-yours"><span>You wrote:</span> ${escapeHTML(last.given)}</div>`;
  }
  if (last.slip && last.expected) return `<div class="la-fb-yours"><span>Remember:</span> ${escapeHTML(last.expected)}</div>`;
  return '';
}

/* ── Hints ────────────────────────────────────────────────────
   One button, a different kind of help per drill, and never the whole
   answer: arrange places the next right word (taking back any wrong ones
   first); fill-in-the-blank clears a wrong tile (or, with meanings switched
   off, shows the meaning first); multiple choice clears a wrong option;
   translate gives the next letter; matching makes one pair for you. A hint
   costs no heart, but a right answer with one is graded as hard, so the
   word comes back sooner. */

function laWrongTiles(it) {
  const ans = langNormalizeAnswer(it.answer);
  return _la.pool.filter(t => langNormalizeAnswer(t.text) !== ans && _la.gone.indexOf(t.id) < 0);
}

/** For arrange: which of your words to keep, and which to lay down next. */
function laArrangeHintPlan(it) {
  const want = laWords(it.answer).map(langNormalizeAnswer);
  let k = 0;
  while (k < _la.picked.length && k < want.length && langNormalizeAnswer(_la.picked[k].text) === want[k]) k++;
  const keep = _la.picked.slice(0, k);
  if (k >= want.length) return _la.picked.length > k ? { keep, tile: null } : null;
  const tile = _la.pool.find(t => keep.indexOf(t) < 0 && langNormalizeAnswer(t.text) === want[k]);
  return tile ? { keep, tile } : null;
}

function laHintAvailable(it) {
  if (!_la || _la.state !== 'answering' || !it) return false;
  if (it.type === 'arrange') return !!laArrangeHintPlan(it);
  if (it.type === 'blank') {
    return laWrongTiles(it).length > 1
      || (!laPrefs().meanings && !_la.showMeaning && !!laSentenceMeaning(it));
  }
  if (it.type === 'choice') return (_la.shuffledOptions || []).filter((o, i) => !o.correct && _la.gone.indexOf(i) < 0).length > 1;
  if (it.type === 'translate') return _la.revealed < String(it.answer || '').length - 1;
  if (it.type === 'match') return (_la.matchList || []).length - _la.matchDone.length > 1;
  return false;
}

function laHint() {
  if (!_la) return;
  const it = laCurrent();
  if (!laHintAvailable(it)) return;
  _la.help++;
  laSfx('pair');
  if (it.type === 'arrange') {
    const plan = laArrangeHintPlan(it);
    const before = laSnapTiles();
    _la.picked = plan.keep.slice();
    if (plan.tile) _la.picked.push(plan.tile);
    laRender();
    laFlip(before, plan.tile ? plan.tile.id : '');
    if (plan.tile && laSayOn()) laSpeak(plan.tile.text);
    return;
  }
  if (it.type === 'blank') {
    if (!laPrefs().meanings && !_la.showMeaning && laSentenceMeaning(it)) {
      _la.showMeaning = true;
    } else {
      const wrong = laWrongTiles(it);
      const t = wrong[Math.floor(Math.random() * wrong.length)];
      _la.gone.push(t.id);
      _la.picked = _la.picked.filter(p => p.id !== t.id);
    }
  } else if (it.type === 'choice') {
    const left = [];
    (_la.shuffledOptions || []).forEach((o, i) => { if (!o.correct && _la.gone.indexOf(i) < 0) left.push(i); });
    const i = left[Math.floor(Math.random() * left.length)];
    _la.gone.push(i);
    if (_la.choice === i) _la.choice = -1;
  } else if (it.type === 'translate') {
    const a = String(it.answer || '');
    _la.revealed = Math.min(a.length - 1, _la.revealed + 1);
    // A space is not a letter; each hint should give one.
    if (/\s/.test(a[_la.revealed - 1] || '') && _la.revealed < a.length - 1) _la.revealed++;
    _la.typed = a.slice(0, _la.revealed);
  } else if (it.type === 'match') {
    const i = (_la.matchA || []).map(x => x.i).find(x => !_la.matchDone.some(d => d.l === x || d.r === x));
    if (i == null) return;
    _la.matchLeft = _la.matchRight = null;
    _la.matchDone.push({ l: i, r: i });
    const seq = ++_laFlashSeq;
    _la.matchFlash = { l: i, r: i, ok: true, seq };
    setTimeout(() => {
      if (_la && _la.matchFlash && _la.matchFlash.seq === seq) { _la.matchFlash = null; laRender(); }
    }, 550);
  }
  laRender();
}

/* ── Run settings, from inside a run ──────────────────────── */

function laOpenSettings() {
  const sheet = document.getElementById('la-sheet');
  if (!sheet || typeof laSettingsHTML !== 'function') return;
  sheet.innerHTML = `
    <div class="la-sheet-backdrop" onclick="laCloseSettings()"></div>
    <div class="la-sheet-panel" role="dialog" aria-modal="true" aria-label="Run settings">
      <div class="la-sheet-head">
        <b><i data-lucide="settings-2"></i> Run settings</b>
        <button class="la-exit" type="button" onclick="laCloseSettings()" aria-label="Close settings"><i data-lucide="x"></i></button>
      </div>
      ${laSettingsHTML('run')}
    </div>`;
  sheet.hidden = false;
  laIcons();
  const first = sheet.querySelector('button.la-switch, .la-seg button');
  if (first) first.focus({ preventScroll: true });
}

function laCloseSettings() {
  const sheet = document.getElementById('la-sheet');
  if (!sheet) return;
  sheet.hidden = true;
  sheet.innerHTML = '';
}

function laSettingsOpen() {
  const sheet = document.getElementById('la-sheet');
  return !!(sheet && !sheet.hidden);
}

/** A setting changed while a run is on screen: redraw what it affects. */
function laPrefsChanged(key) {
  if (!_la || _la.state === 'over' || !document.getElementById('la-shell')) return;
  if (['meanings', 'hints', 'speakers', 'keys'].indexOf(key) > -1) laRender();
}

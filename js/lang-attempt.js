/* ============================================================
   LANG-ATTEMPT.JS — the drill runner
   ------------------------------------------------------------
   One question at a time, answer, check, move on: the shape a language drill
   has because it works. Five puzzle types share one loop, differing only in
   how the answer is collected and compared.

   Nothing is graded until you press Check, and a wrong answer is shown
   alongside the right one rather than just being taken off the score — the
   point of a drill is the correction.
   ============================================================ */

let _la = null;   // the run in progress

function langAttemptTemplate() {
  return `
    <div class="la-shell" id="la-shell">
      <header class="la-top">
        <button class="btn-back-dark" onclick="laExit()" title="Leave the drill">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back
        </button>
        <div class="la-progress"><div class="la-progress-fill" id="la-progress-fill"></div></div>
        <div class="la-hearts" id="la-hearts"></div>
      </header>
      <main class="la-body" id="la-body"></main>
      <footer class="la-foot" id="la-foot"></footer>
    </div>`;
}

function langAttemptInit() {
  langStore();
  const setId = getSessionParam('langRunSet');
  const set = setId ? langFindSet(setId) : null;
  if (!set || langSetProblems(set).length) {
    spaNavigate('language');
    return;
  }
  _la = {
    set,
    // A fresh order every run, so the third pass is not muscle memory for
    // "the answer to question 4".
    queue: langShuffle((set.items || []).slice()),
    idx: 0,
    hearts: 3,
    correct: 0,
    answered: [],
    startTime: Date.now(),
    state: 'answering',    // answering | checked | over
    picked: [],            // arrange: the tiles laid down so far
    pool: [],              // arrange/blank: tiles still available
    choice: -1,
    typed: '',
    matchLeft: null,
    matchPairs: {}
  };
  laLoadQuestion();
}

function langAttemptDestroy() { _la = null; }

function laExit() {
  if (!_la || _la.state === 'over') { spaNavigate('language'); return; }
  showConfirm('Leave the drill?', 'Your progress in this run will not be saved.', () => {
    _la = null;
    spaNavigate('language');
  });
}

function laCurrent() { return _la && _la.queue[_la.idx]; }

function laLoadQuestion() {
  if (!_la) return;
  const it = laCurrent();
  _la.state = 'answering';
  _la.picked = [];
  _la.choice = -1;
  _la.typed = '';
  _la.matchLeft = null;
  _la.matchPairs = {};
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
    _la.matchA = langShuffle(pairs.map((p, i) => ({ i, text: p.left })));
    _la.matchB = langShuffle(pairs.map((p, i) => ({ i, text: p.right })));
  }
  laRender();
}

/* ── Render ───────────────────────────────────────────────── */

function laRender() {
  if (!_la) return;
  const body = document.getElementById('la-body');
  const foot = document.getElementById('la-foot');
  const fill = document.getElementById('la-progress-fill');
  const hearts = document.getElementById('la-hearts');
  if (!body || !foot) return;

  if (fill) fill.style.width = Math.round((_la.idx / Math.max(1, _la.queue.length)) * 100) + '%';
  if (hearts) {
    hearts.innerHTML = [0, 1, 2].map(i =>
      `<i data-lucide="heart" class="la-heart${i < _la.hearts ? '' : ' is-lost'}"></i>`).join('');
  }

  if (_la.state === 'over') { body.innerHTML = laSummaryHTML(); foot.innerHTML = ''; laIcons(); return; }

  const it = laCurrent();
  if (!it) { laFinish(); return; }
  const meta = langPuzzleMeta(it.type);

  body.innerHTML = `
    <div class="la-card">
      <div class="la-kind"><i data-lucide="${meta.icon}"></i> ${escapeHTML(meta.name)}</div>
      ${it.prompt ? `<h2 class="la-prompt">${escapeHTML(it.prompt)}</h2>` : ''}
      ${laQuestionHTML(it)}
      ${_la.state === 'checked' ? laFeedbackHTML(it) : ''}
    </div>`;
  foot.innerHTML = laFootHTML(it);
  laIcons();
}

function laIcons() {
  const shell = document.getElementById('la-shell');
  if (typeof lucide !== 'undefined' && shell) lucide.createIcons({ root: shell });
}

function laQuestionHTML(it) {
  if (it.type === 'arrange' || it.type === 'blank') {
    const sentence = it.type === 'blank'
      ? `<div class="la-blank-line">${laBlankLineHTML(it)}</div>`
      : '';
    return `
      ${sentence}
      <div class="la-lane" id="la-lane">
        ${_la.picked.map(t => `<button class="la-tile is-placed" type="button" onclick="laUnpick('${t.id}')">${escapeHTML(t.text)}</button>`).join('')
          || '<span class="la-lane-hint">Tap the words below in order</span>'}
      </div>
      <div class="la-pool">
        ${_la.pool.filter(t => !_la.picked.some(p => p.id === t.id))
          .map(t => `<button class="la-tile" type="button" onclick="laPick('${t.id}')">${escapeHTML(t.text)}</button>`).join('')}
      </div>`;
  }

  if (it.type === 'choice') {
    return `<div class="la-options">
      ${(_la.shuffledOptions || []).map((o, i) => `
        <button class="la-option${_la.choice === i ? ' is-picked' : ''}" type="button" onclick="laChoose(${i})">
          <span class="la-option-key">${String.fromCharCode(65 + i)}</span>
          <span>${escapeHTML(o.text)}</span>
        </button>`).join('')}
    </div>`;
  }

  if (it.type === 'translate') {
    return `<div class="la-typed">
      <input type="text" id="la-input" class="form-input" autocomplete="off" spellcheck="false"
             placeholder="Type your answer…" value="${escapeHTML(_la.typed)}"
             oninput="_la.typed = this.value" onkeydown="if(event.key==='Enter'){event.preventDefault(); laPrimary();}" />
    </div>`;
  }

  if (it.type === 'match') {
    const takenB = Object.values(_la.matchPairs);
    return `<div class="la-match">
      <div class="la-match-col">
        ${(_la.matchA || []).map(a => `
          <button class="la-match-btn${_la.matchLeft === a.i ? ' is-picked' : ''}${_la.matchPairs[a.i] != null ? ' is-done' : ''}"
                  type="button" onclick="laMatchLeft(${a.i})">${escapeHTML(a.text)}</button>`).join('')}
      </div>
      <div class="la-match-col">
        ${(_la.matchB || []).map(b => `
          <button class="la-match-btn${takenB.indexOf(b.i) > -1 ? ' is-done' : ''}"
                  type="button" onclick="laMatchRight(${b.i})">${escapeHTML(b.text)}</button>`).join('')}
      </div>
    </div>`;
  }
  return '';
}

/** The sentence with its blank shown as the tile you have placed, or a gap. */
function laBlankLineHTML(it) {
  const filled = _la.picked.length ? escapeHTML(_la.picked[0].text) : '_____';
  const parts = String(it.prompt || '').split(/_{2,}|\{\}/);
  if (parts.length < 2) return escapeHTML(it.prompt || '');
  return escapeHTML(parts[0]) + `<span class="la-blank-slot">${filled}</span>` + escapeHTML(parts.slice(1).join(' '));
}

function laFootHTML(it) {
  const ready = laHasAnswer(it);
  if (_la.state === 'checked') {
    const last = _la.answered[_la.answered.length - 1];
    return `
      <div class="la-foot-inner ${last && last.ok ? 'is-right' : 'is-wrong'}">
        <div class="la-verdict">
          <i data-lucide="${last && last.ok ? 'check-circle-2' : 'x-circle'}"></i>
          <span>${last && last.ok ? 'Correct' : 'Not quite'}</span>
        </div>
        <button class="btn btn-primary btn-lg" onclick="laPrimary()">
          ${_la.idx + 1 >= _la.queue.length ? 'Finish' : 'Continue'}
        </button>
      </div>`;
  }
  return `
    <div class="la-foot-inner">
      <button class="btn btn-ghost" onclick="laSkip()">Skip</button>
      <button class="btn btn-primary btn-lg" onclick="laPrimary()" ${ready ? '' : 'disabled'}>Check</button>
    </div>`;
}

function laFeedbackHTML(it) {
  const last = _la.answered[_la.answered.length - 1];
  if (!last) return '';
  return `
    <div class="la-feedback ${last.ok ? 'is-right' : 'is-wrong'}">
      ${last.ok ? '' : `<div class="la-correct"><em>Answer</em> ${escapeHTML(last.expected)}</div>`}
      ${it.note ? `<div class="la-note"><i data-lucide="info"></i> ${escapeHTML(it.note)}</div>` : ''}
    </div>`;
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

function laChoose(i) {
  if (!_la || _la.state !== 'answering') return;
  _la.choice = i;
  laRender();
}

function laMatchLeft(i) {
  if (!_la || _la.state !== 'answering') return;
  if (_la.matchPairs[i] != null) { delete _la.matchPairs[i]; _la.matchLeft = null; laRender(); return; }
  _la.matchLeft = _la.matchLeft === i ? null : i;
  laRender();
}

function laMatchRight(i) {
  if (!_la || _la.state !== 'answering' || _la.matchLeft == null) return;
  // One right-hand tile can only serve one pair.
  Object.keys(_la.matchPairs).forEach(k => { if (_la.matchPairs[k] === i) delete _la.matchPairs[k]; });
  _la.matchPairs[_la.matchLeft] = i;
  _la.matchLeft = null;
  laRender();
}

function laHasAnswer(it) {
  if (!_la) return false;
  if (it.type === 'arrange' || it.type === 'blank') return _la.picked.length > 0;
  if (it.type === 'choice') return _la.choice > -1;
  if (it.type === 'translate') return (_la.typed || '').trim().length > 0;
  if (it.type === 'match') return Object.keys(_la.matchPairs).length === (_la.matchA || []).length;
  return false;
}

/** Check, or advance — the one button does both, as the footer says. */
function laPrimary() {
  if (!_la) return;
  if (_la.state === 'checked') { laAdvance(); return; }
  const it = laCurrent();
  if (!it || !laHasAnswer(it)) return;

  let given = '', expected = '', ok = false;
  if (it.type === 'arrange') {
    given = _la.picked.map(t => t.text).join(' ');
    expected = it.answer;
    ok = langAnswersMatch(given, expected);
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
  } else if (it.type === 'match') {
    ok = Object.keys(_la.matchPairs).every(k => String(_la.matchPairs[k]) === String(k));
    given = ok ? 'all matched' : 'some pairs wrong';
    expected = 'every pair matched';
  }

  _la.answered.push({ id: it.id, type: it.type, ok, given, expected });
  if (ok) _la.correct++;
  else _la.hearts = Math.max(0, _la.hearts - 1);
  _la.state = 'checked';
  laRender();
}

function laSkip() {
  if (!_la || _la.state !== 'answering') return;
  const it = laCurrent();
  _la.answered.push({ id: it.id, type: it.type, ok: false, given: '(skipped)', expected: laExpectedOf(it) });
  _la.hearts = Math.max(0, _la.hearts - 1);
  _la.state = 'checked';
  laRender();
}

function laExpectedOf(it) {
  if (it.type === 'choice') return (it.options || [])[it.correctIndex] || '';
  if (it.type === 'match') return 'every pair matched';
  return it.answer || '';
}

function laAdvance() {
  if (!_la) return;
  if (_la.hearts <= 0) { laFinish(); return; }
  if (_la.idx + 1 >= _la.queue.length) { laFinish(); return; }
  _la.idx++;
  laLoadQuestion();
}

function laFinish() {
  if (!_la || _la.state === 'over') return;
  _la.state = 'over';
  const total = _la.queue.length;
  const score = total ? Math.round((_la.correct / total) * 100) : 0;
  langRecordAttempt({
    kind: 'set', refId: _la.set.id, title: _la.set.title,
    score, correct: _la.correct, total,
    lang: _la.set.lang, refLang: _la.set.refLang,
    heartsLeft: _la.hearts,
    duration: Math.round((Date.now() - _la.startTime) / 1000)
  });
  laRender();
}

function laSummaryHTML() {
  const total = _la.queue.length;
  const score = total ? Math.round((_la.correct / total) * 100) : 0;
  const cls = score >= 80 ? 'score-perfect' : score >= 50 ? 'score-partial' : 'score-low';
  const wrong = _la.answered.filter(a => !a.ok);
  const outOfHearts = _la.hearts <= 0 && _la.answered.length < total;
  return `
    <div class="la-summary">
      <div class="la-summary-icon ${cls}"><i data-lucide="${score >= 80 ? 'trophy' : score >= 50 ? 'target' : 'refresh-cw'}"></i></div>
      <h2>${outOfHearts ? 'Out of hearts' : score >= 80 ? 'Well done' : 'Run finished'}</h2>
      <div class="la-summary-score ${cls}">${score}%</div>
      <p>${_la.correct} of ${total} correct${outOfHearts ? ' — the run ended early.' : '.'}</p>
      ${wrong.length ? `
        <div class="la-review">
          <h3>Worth another look</h3>
          ${wrong.map(a => `
            <div class="la-review-row">
              <span class="la-review-given">${escapeHTML(a.given || '(no answer)')}</span>
              <i data-lucide="arrow-right"></i>
              <span class="la-review-expected">${escapeHTML(a.expected)}</span>
            </div>`).join('')}
        </div>` : ''}
      <div class="la-summary-actions">
        <button class="btn btn-secondary btn-lg" onclick="spaNavigate('language')">Back to library</button>
        <button class="btn btn-primary btn-lg" onclick="laRetry()">
          <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i> Run again
        </button>
      </div>
    </div>`;
}

function laRetry() {
  const id = _la && _la.set ? _la.set.id : getSessionParam('langRunSet');
  _la = null;
  setSessionParam('langRunSet', id);
  langAttemptInit();
}

/* ============================================================
   WING-RECALL.JS — the wings' practice
   ------------------------------------------------------------
   What made Coding, Notes and Snippets feel finished was never the list. It
   was that each has something to DO: you attempt a program, sit a notebook,
   run a snippet, get a score, and the score feeds the spaced-repetition
   schedule so the library tells you what to come back to. The wings had the
   list and nothing to do with it, which is why they read as somewhere to file
   things rather than somewhere to use them.

   Active recall is the honest equivalent for written entries. The title is
   the prompt, the body is the answer, and you say how well you knew it. That
   is a real test of a Mindset or an Insight in a way a multiple-choice
   question would not be, and it needs no extra content authored per entry —
   every entry that exists is already a card.

   IT SCHEDULES THROUGH THE EXISTING SM-2. recordReview() already does the
   arithmetic and getDueReviewItems() already surfaces it on the Library hub,
   so a wing entry appears under "Due today" beside a program and a notebook
   with nothing added there. The four buttons map onto the percentage that
   function wants:

       Again 20  → quality 1, lapse, back tomorrow
       Hard  55  → quality 2, lapse, back tomorrow with a lowered ease
       Good  80  → quality 3, the ordinary step
       Easy 100  → quality 5, the long step

   Those are the four Anki settled on, and the mapping is chosen so each lands
   in the bucket _revScoreToQuality already defines rather than inventing a
   second scale beside it.
   ============================================================ */

let _wrKey = null;          // which wing
let _wrQueue = [];          // entry ids still to see
let _wrIndex = 0;
let _wrRevealed = false;
let _wrResults = [];        // { id, title, grade } per answered card
let _wrStartedAt = 0;

const WING_RECALL_GRADES = [
  { id: 'again', label: 'Again', hint: 'No idea',        pct: 20,  key: '1', cls: 'wr-again' },
  { id: 'hard',  label: 'Hard',  hint: 'Barely',         pct: 55,  key: '2', cls: 'wr-hard' },
  { id: 'good',  label: 'Good',  hint: 'Knew it',        pct: 80,  key: '3', cls: 'wr-good' },
  { id: 'easy',  label: 'Easy',  hint: 'Instantly',      pct: 100, key: '4', cls: 'wr-easy' }
];

/* ── Which entries are worth putting in front of you ─────────
   Due first, then never-reviewed, and only then the rest. A session that
   opened with something you saw yesterday would waste the one thing the
   scheduler is for.
   ------------------------------------------------------------ */

function wingRecallCandidates(key) {
  const type = revWingType(key);
  const items = wingItems(key).slice();
  const rank = (w) => {
    const st = (typeof libReviewStatus === 'function') ? libReviewStatus(type, w.id) : 'new';
    return st === 'due' ? 0 : (st === 'new' ? 1 : 2);
  };
  return items
    .filter(w => (w.title || '').trim() || (w.body || '').trim())
    .sort((a, b) => rank(a) - rank(b) || (a.updatedAt || 0) - (b.updatedAt || 0));
}

function wingRecallDueCount(key) {
  const type = revWingType(key);
  if (typeof libIsDue !== 'function') return 0;
  return wingItems(key).filter(w => libIsDue(type, w.id)).length;
}

/**
 * Begin a session.
 *
 * @param {string} key    the wing
 * @param {string[]} [ids] specific entries — used when arriving from "Due
 *                         today", which is about one item, not a whole wing.
 */
function wingRecallStart(key, ids) {
  const pool = Array.isArray(ids) && ids.length
    ? ids.map(id => wingItems(key).find(w => w.id === id)).filter(Boolean)
    : wingRecallCandidates(key);

  if (!pool.length) {
    if (typeof toast === 'function') {
      toast('Nothing to recall here yet — write an entry first.', { type: 'info' });
    }
    return;
  }
  _wrKey = key;
  _wrQueue = pool.map(w => w.id);
  _wrIndex = 0;
  _wrRevealed = false;
  _wrResults = [];
  _wrStartedAt = Date.now();
  spaNavigate('wing-recall');
}

/** Only the due ones, which is what the header button offers when there are any. */
function wingRecallStartDue(key) {
  const type = revWingType(key);
  const due = wingItems(key).filter(w => libIsDue(type, w.id)).map(w => w.id);
  wingRecallStart(key, due.length ? due : null);
}

/* ── Route ────────────────────────────────────────────────── */

function wingRecallTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll wr-root" id="wr-root"></div>
    </div>`;
}

function wingRecallInit() {
  // Arriving with no session — a reload on the URL, or a stale link — has
  // nothing to show, so go back to the library rather than render an empty
  // shell that looks broken.
  if (!_wrKey || !_wrQueue.length) {
    spaNavigate(_wrKey || 'library');
    return;
  }
  wingRecallRender();
  document.addEventListener('keydown', _wrKeyHandler, true);
}

function wingRecallDestroy() {
  document.removeEventListener('keydown', _wrKeyHandler, true);
}

function _wrCurrent() {
  const id = _wrQueue[_wrIndex];
  return id ? wingItems(_wrKey).find(w => w.id === id) : null;
}

/* Space reveals, 1–4 grade. The same keys the attempt screens use for their
   own one-handed flow, so the habit carries between libraries. */
function _wrKeyHandler(e) {
  if (document.body.dataset.route !== 'wing-recall') return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (!_wrRevealed) wingRecallReveal();
    return;
  }
  if (!_wrRevealed) return;
  const g = WING_RECALL_GRADES.find(x => x.key === e.key);
  if (g) { e.preventDefault(); wingRecallGrade(g.id); }
}

function wingRecallRender() {
  const host = document.getElementById('wr-root');
  if (!host) return;

  if (_wrIndex >= _wrQueue.length) { host.innerHTML = _wrSummaryHTML(); _wrAfter(host); return; }

  const w = _wrCurrent();
  if (!w) { _wrIndex++; wingRecallRender(); return; }   // deleted mid-session

  const cfg = wingConfig(_wrKey);
  const schema = wingSchema(_wrKey);
  const type = revWingType(_wrKey);
  const n = _wrQueue.length;
  const pct = Math.round((_wrIndex / n) * 100);
  const meta = (typeof wingReaderMetaHTML === 'function') ? wingReaderMetaHTML(w, schema) : '';

  host.innerHTML = `
    <div class="wr-shell" style="--wing-accent:${cfg.accent || '#8b5cf6'};">
      <div class="wr-top">
        <button class="btn-back-dark" onclick="wingRecallQuit()">
          <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Finish
        </button>
        <div class="wr-progress" role="progressbar" aria-valuenow="${_wrIndex}" aria-valuemin="0" aria-valuemax="${n}">
          <div class="wr-progress-fill" style="width:${pct}%;"></div>
        </div>
        <span class="wr-count">${_wrIndex + 1} / ${n}</span>
      </div>

      <div class="wr-card${_wrRevealed ? ' is-revealed' : ''}">
        <div class="wr-card-head">
          <span class="wr-wing"><i data-lucide="${cfg.icon}"></i> ${escapeHTML(cfg.name)}</span>
          ${typeof libReviewChipHTML === 'function' ? libReviewChipHTML(type, w.id) : ''}
        </div>

        <p class="wr-prompt-label">${escapeHTML(schema.titleLabel)}</p>
        <h2 class="wr-prompt">${escapeHTML(w.title || 'Untitled')}</h2>
        ${(w.tags || []).length
          ? `<div class="wr-tags">${(w.tags || []).map(t => `<span class="awx-mini-tag">${escapeHTML(t)}</span>`).join('')}</div>`
          : ''}

        ${_wrRevealed ? `
          <div class="wr-answer">
            ${meta}
            ${w.body
              ? `<div class="wing-body">${escapeHTML(w.body).replace(/\n/g, '<br/>')}</div>`
              : `<p class="wr-empty-body">This ${escapeHTML(schema.noun)} has no ${escapeHTML(schema.bodyLabel.toLowerCase())} written yet.</p>`}
          </div>` : `
          <div class="wr-veil">
            <i data-lucide="eye-off"></i>
            <p>Bring it to mind, then reveal.</p>
          </div>`}
      </div>

      ${_wrRevealed ? `
        <div class="wr-grades">
          ${WING_RECALL_GRADES.map(g => `
            <button class="wr-grade ${g.cls}" onclick="wingRecallGrade('${g.id}')">
              <span class="wr-grade-label">${g.label}</span>
              <span class="wr-grade-hint">${g.hint}</span>
              <kbd>${g.key}</kbd>
            </button>`).join('')}
        </div>` : `
        <div class="wr-reveal-row">
          <button class="btn btn-primary wr-reveal" onclick="wingRecallReveal()">
            <i data-lucide="eye" style="width:16px;height:16px;"></i> Reveal
          </button>
          <span class="wr-hint"><kbd>Space</kbd> to reveal</span>
        </div>`}

      <button class="wr-edit" onclick="wingRecallEdit()">
        <i data-lucide="pencil" style="width:13px;height:13px;"></i> Open this ${escapeHTML(schema.noun)}
      </button>
    </div>`;
  _wrAfter(host);
}

function _wrAfter(host) {
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function wingRecallReveal() {
  _wrRevealed = true;
  wingRecallRender();
}

/**
 * Grade the current card and move on.
 *
 * "Again" puts the card back near the end of this session as well as
 * scheduling it for tomorrow — a card you just failed should come round once
 * more before you stop, which is the whole point of saying you did not know
 * it. It is only requeued once, so a card you keep failing cannot trap you in
 * a session that never ends.
 */
function wingRecallGrade(gradeId) {
  const g = WING_RECALL_GRADES.find(x => x.id === gradeId);
  const w = _wrCurrent();
  if (!g || !w) return;

  if (typeof recordReview === 'function') recordReview(revWingType(_wrKey), w.id, g.pct);
  _wrResults.push({ id: w.id, title: w.title || 'Untitled', grade: g.id });

  if (g.id === 'again' && !_wrQueue._requeued) {
    _wrQueue.push(w.id);
    // One requeue per session, tracked on the queue itself so it resets with it.
    _wrQueue._requeued = true;
  }

  _wrIndex++;
  _wrRevealed = false;
  wingRecallRender();
}

function wingRecallEdit() {
  const w = _wrCurrent();
  if (!w) return;
  if (typeof wingGoTo === 'function') wingGoTo(_wrKey, w.id);
}

function wingRecallQuit() {
  // Straight to the summary rather than out of the session, so the work
  // already done is still reported. Quitting from the summary leaves.
  if (_wrIndex < _wrQueue.length && _wrResults.length) { _wrIndex = _wrQueue.length; wingRecallRender(); return; }
  const key = _wrKey;
  _wrKey = null; _wrQueue = []; _wrResults = [];
  spaNavigate(key || 'library');
}

function _wrSummaryHTML() {
  const cfg = wingConfig(_wrKey);
  const schema = wingSchema(_wrKey);
  const secs = Math.max(1, Math.round((Date.now() - _wrStartedAt) / 1000));
  const counts = {};
  WING_RECALL_GRADES.forEach(g => { counts[g.id] = _wrResults.filter(r => r.grade === g.id).length; });
  const seen = _wrResults.length;
  const solid = counts.good + counts.easy;
  const pct = seen ? Math.round((solid / seen) * 100) : 0;
  const dueLeft = wingRecallDueCount(_wrKey);

  return `
    <div class="wr-shell wr-summary" style="--wing-accent:${cfg.accent || '#8b5cf6'};">
      <div class="wr-sum-ring" style="--pct:${pct};">
        <span>${pct}<small>%</small></span>
      </div>
      <h2 class="wr-sum-title">${seen ? 'Session done' : 'Nothing graded'}</h2>
      <p class="wr-sum-sub">
        ${seen
          // "cards", not the wing's noun: a card you failed is shown again, so
          // four gradings of three mindsets is four cards and three mindsets.
          // Calling that "3 of 4 mindsets" invents an entry you do not have.
          ? `${solid} of ${seen} card${seen === 1 ? '' : 's'} came back to you, in ${secs < 60 ? secs + 's' : Math.round(secs / 60) + 'm'}.`
          : 'You left before grading anything, so nothing was rescheduled.'}
      </p>

      ${seen ? `<div class="wr-sum-grid">
        ${WING_RECALL_GRADES.map(g => `
          <div class="wr-sum-cell ${g.cls}">
            <span class="wr-sum-n">${counts[g.id]}</span>
            <span class="wr-sum-l">${g.label}</span>
          </div>`).join('')}
      </div>` : ''}

      <p class="wr-sum-next">
        ${dueLeft
          ? `${dueLeft} still due in ${escapeHTML(cfg.name)}.`
          : `Nothing else due in ${escapeHTML(cfg.name)} today.`}
      </p>

      <div class="wr-sum-actions">
        ${dueLeft ? `<button class="btn btn-primary" onclick="wingRecallStartDue('${_wrKey}')">
          <i data-lucide="brain" style="width:16px;height:16px;"></i> Keep going
        </button>` : ''}
        <button class="btn ${dueLeft ? 'btn-secondary' : 'btn-primary'}" onclick="wingRecallQuit()">
          <i data-lucide="library" style="width:16px;height:16px;"></i> Back to ${escapeHTML(cfg.name)}
        </button>
      </div>
    </div>`;
}

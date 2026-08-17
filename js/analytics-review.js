/* ============================================================
   ANALYTICS-REVIEW.JS — the "what did I get wrong" window.
   ------------------------------------------------------------
   Target code beside the attempt you actually wrote, with the
   differing lines called out, and arrows to cycle through every
   wrong attempt you have. The history table could already open a
   single diff on a full page; this is the review loop — one place
   that walks you through your mistakes without navigating away.
   ============================================================ */

const anReview = {
  queue: [],      // [{ entry, challenge }]
  idx: 0,
  scope: null,    // challengeId, or null for "everything"
  onlyWrong: true,
  fileIdx: 0,
  _key: null
};

function _anr_esc(s) { return typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s); }

/**
 * Every attempt worth reviewing, newest first.
 * Only attempts that actually stored code can be compared.
 */
function anReviewQueue(challengeId, onlyWrong) {
  const live = (state.challenges || []);
  return (typeof anAttempts === 'function' ? anAttempts({ range: null, challengeId }) : [])
    .filter(h => (onlyWrong === false) || h.score < 100)
    .filter(h => (h.userCode != null) || (Array.isArray(h.userFiles) && h.userFiles.length))
    .slice().reverse()
    .map(h => ({ entry: h, challenge: live.find(c => c.id === h.challengeId) || null }));
}

/**
 * @param {string} [challengeId] limit the cycle to one program
 */
function anOpenReview(challengeId) {
  anReview.scope = challengeId || null;
  anReview.queue = anReviewQueue(anReview.scope, anReview.onlyWrong);
  if (!anReview.queue.length && anReview.onlyWrong) {
    // Nothing wrong to review is good news, not a dead end.
    anReview.onlyWrong = false;
    anReview.queue = anReviewQueue(anReview.scope, false);
  }
  if (!anReview.queue.length) {
    if (typeof toast === 'function') toast('No attempts with saved code to review yet.', { type: 'info' });
    return;
  }
  anReview.idx = 0;
  anReview.fileIdx = 0;
  anReviewPaint();
}

function anReviewClose() {
  const el = document.getElementById('an-review');
  if (el) el.remove();
  if (anReview._key) { document.removeEventListener('keydown', anReview._key); anReview._key = null; }
}

function anReviewStep(delta) {
  if (!anReview.queue.length) return;
  // Wraps, so the review loop keeps cycling instead of dead-ending.
  anReview.idx = (anReview.idx + delta + anReview.queue.length) % anReview.queue.length;
  anReview.fileIdx = 0;
  anReviewPaint();
}

function anReviewToggleWrong() {
  anReview.onlyWrong = !anReview.onlyWrong;
  const cur = anReview.queue[anReview.idx];
  anReview.queue = anReviewQueue(anReview.scope, anReview.onlyWrong);
  const keep = cur ? anReview.queue.findIndex(q => q.entry.id === cur.entry.id) : -1;
  anReview.idx = keep === -1 ? 0 : keep;
  if (!anReview.queue.length) { anReviewClose(); if (typeof toast === 'function') toast('Nothing to review.', { type: 'info' }); return; }
  anReviewPaint();
}

function anReviewSetFile(i) { anReview.fileIdx = i; anReviewPaint(); }

/** The file pairs stored on an attempt, newest schema first. */
function _anr_files(entry) {
  if (Array.isArray(entry.targetFiles) && entry.targetFiles.length && Array.isArray(entry.userFiles)) {
    return entry.targetFiles.map((t, i) => {
      const u = entry.userFiles.find(f => f.name === t.name && f.ext === t.ext) || entry.userFiles[i] || {};
      return { name: (t.name || 'main') + (t.ext || '.c'), user: u.userCode || '', target: t.code || '' };
    });
  }
  return [{ name: 'main.c', user: entry.userCode || '', target: entry.expectedCode || '' }];
}

/** Two aligned columns from the diff, so matching lines sit on the same row. */
function _anr_rows(user, target) {
  const res = (typeof computeDiffs === 'function') ? computeDiffs(user, target) : null;
  if (!res || !res.diffs) {
    const u = String(user).split('\n'), t = String(target).split('\n');
    const n = Math.max(u.length, t.length);
    return Array.from({ length: n }, (_, i) => ({ status: 'perfect', actualRaw: u[i] || '', expectedRaw: t[i] || '', actualLine: i + 1, expectedLine: i + 1 }));
  }
  return res.diffs;
}

function anReviewPaint() {
  const item = anReview.queue[anReview.idx];
  if (!item) return;
  const e = item.entry;
  const files = _anr_files(e);
  const f = files[Math.min(anReview.fileIdx, files.length - 1)] || files[0];
  const rows = _anr_rows(f.user, f.target);

  const wrong = rows.filter(r => r.status !== 'perfect').length;
  const title = item.challenge ? item.challenge.title : (e.challengeTitle || 'Attempt');
  const when = new Date(e.submitTime || e.startTime || 0);
  const scoreCls = e.score === 100 ? 'perfect' : e.score >= 50 ? 'mid' : 'low';

  const line = (r) => {
    const cls = r.status === 'perfect' ? 'ok' : r.status === 'extra' ? 'extra' : r.status === 'missing' ? 'missing' : 'partial';
    return { cls,
      left: r.actualRaw != null ? r.actualRaw : (r.actual || ''),
      right: r.expectedRaw != null ? r.expectedRaw : (r.expected || ''),
      ln: r.actualLine || '', rn: r.expectedLine || '' };
  };

  const body = rows.map(line).map(l => `
    <div class="anr-row ${l.cls}">
      <span class="anr-ln">${l.ln}</span>
      <pre class="anr-code anr-yours">${_anr_esc(l.left)}</pre>
      <span class="anr-ln">${l.rn}</span>
      <pre class="anr-code anr-target">${_anr_esc(l.right)}</pre>
    </div>`).join('');

  const html = `
    <div class="anr-box" role="dialog" aria-modal="true" aria-label="Attempt review">
      <div class="anr-head">
        <div class="anr-id">
          <span class="anr-title">${_anr_esc(title)}</span>
          <span class="anr-sub">${when.toLocaleDateString()} ${when.toLocaleTimeString()} ·
            ${typeof _historyVersionLabel === 'function' ? _anr_esc(_historyVersionLabel(e)) : ''} ·
            ${typeof anFmtTime === 'function' ? anFmtTime(e.duration || 0) : ''}</span>
        </div>
        <span class="anr-score ${scoreCls}">${e.score}%</span>
        <div class="anr-nav">
          <button class="anr-btn" onclick="anReviewStep(-1)" title="Previous attempt (←)"><i data-lucide="chevron-left"></i></button>
          <span class="anr-count">${anReview.idx + 1} / ${anReview.queue.length}</span>
          <button class="anr-btn" onclick="anReviewStep(1)" title="Next attempt (→)"><i data-lucide="chevron-right"></i></button>
        </div>
        <button class="anr-btn anr-toggle ${anReview.onlyWrong ? 'on' : ''}" onclick="anReviewToggleWrong()"
                title="${anReview.onlyWrong ? 'Showing only attempts below 100%' : 'Showing every attempt'}">
          <i data-lucide="filter"></i> ${anReview.onlyWrong ? 'Wrong only' : 'All'}
        </button>
        <button class="anr-btn" onclick="viewHistoricalDiff('${e.id}','${e.challengeId || ''}')" title="Open the full solution page"><i data-lucide="external-link"></i></button>
        <button class="anr-btn anr-close" onclick="anReviewClose()" title="Close (Esc)"><i data-lucide="x"></i></button>
      </div>

      ${files.length > 1 ? `<div class="anr-files">${files.map((x, i) =>
        `<button class="anr-file ${i === Math.min(anReview.fileIdx, files.length - 1) ? 'active' : ''}" onclick="anReviewSetFile(${i})">${_anr_esc(x.name)}</button>`).join('')}</div>` : ''}

      <div class="anr-legend">
        <span class="anr-k extra"></span> only in yours
        <span class="anr-k missing"></span> missing from yours
        <span class="anr-k partial"></span> different
        <span class="anr-diffcount">${wrong} line${wrong !== 1 ? 's' : ''} differ</span>
      </div>

      <div class="anr-cols">
        <div class="anr-colhead">Your attempt</div>
        <div class="anr-colhead anr-colhead-target">Target solution</div>
      </div>
      <div class="anr-body">${body || '<p class="an-empty">This attempt stored no code.</p>'}</div>

      <div class="anr-foot">
        <span class="anr-hint">← → to cycle · Esc to close</span>
        ${e.challengeId ? `<button class="btn btn-primary btn-sm" onclick="anReviewClose();promptTimer('${e.challengeId}')">
          <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> Try this again</button>` : ''}
      </div>
    </div>`;

  let host = document.getElementById('an-review');
  if (!host) {
    host = document.createElement('div');
    host.id = 'an-review';
    host.className = 'anr-overlay';
    document.body.appendChild(host);
    host.addEventListener('mousedown', (ev) => { if (ev.target === host) anReviewClose(); });
    anReview._key = (ev) => {
      if (ev.key === 'Escape') { anReviewClose(); return; }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); anReviewStep(-1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); anReviewStep(1); }
    };
    document.addEventListener('keydown', anReview._key);
  }
  host.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  const bodyEl = host.querySelector('.anr-body');
  const firstBad = bodyEl && bodyEl.querySelector('.anr-row:not(.ok)');
  if (firstBad) firstBad.scrollIntoView({ block: 'center' });
}

/** Open the review window focused on one specific attempt (a chart dot). */
function anOpenReviewById(historyId) {
  const entry = (state.history || []).find(h => h.id === historyId);
  if (!entry) return;
  anReview.scope = null;
  anReview.onlyWrong = entry.score < 100;
  anReview.queue = anReviewQueue(null, anReview.onlyWrong);
  let i = anReview.queue.findIndex(q => q.entry.id === historyId);
  if (i === -1) {
    // A perfect attempt while the queue is wrong-only: widen rather than refuse.
    anReview.onlyWrong = false;
    anReview.queue = anReviewQueue(null, false);
    i = anReview.queue.findIndex(q => q.entry.id === historyId);
  }
  if (i === -1) {
    if (typeof toast === 'function') toast('That attempt stored no code to compare.', { type: 'info' });
    return;
  }
  anReview.idx = i;
  anReview.fileIdx = 0;
  anReviewPaint();
}

window.anOpenReview = anOpenReview;
window.anOpenReviewById = anOpenReviewById;
window.anReviewClose = anReviewClose;
window.anReviewStep = anReviewStep;
window.anReviewToggleWrong = anReviewToggleWrong;
window.anReviewSetFile = anReviewSetFile;

/* ============================================================
   ADMIN-STEPS.JS — the program editor, paged
   ------------------------------------------------------------
   One program's editor measured 3053px in a 702px pane: four and a bit screens
   of scrolling through 45 controls with no navigation of any kind, no sense of
   where you were, and nothing saying what was still missing.

   The same fields are now dealt out across four steps with a rail you can click
   and arrows in the footer. Nothing is removed from the DOM when you move —
   every step stays mounted and is only hidden — so Ctrl+S still saves the whole
   program from wherever you are, and a field you never visited still counts.
   ============================================================ */

const AF_STEPS = [
  { n: 1, key: 'basics',  label: 'Basics',   icon: 'info' },
  { n: 2, key: 'code',    label: 'Code',     icon: 'code-2' },
  { n: 3, key: 'tests',   label: 'Examples & Tests', icon: 'flask-conical' },
  { n: 4, key: 'review',  label: 'Review',   icon: 'clipboard-check' }
];

let _afStep = 1;

/** Where each program was last left, so reopening does not always start at 1. */
function _afLastStepKey(id) { return 'ssp.afStep.' + id; }

/* ── What each step still needs ───────────────────────────────
   Read straight off adminState rather than off the inputs, so a step you have
   never opened is still judged on its real contents. */
function afStepIssues() {
  const st = (typeof adminState !== 'undefined' && adminState) ? adminState : null;
  const out = { 1: [], 2: [], 3: [] };
  if (!st) return out;

  if (!(st.title || '').trim()) out[1].push('Program needs a title');
  if (!(st.coverDescription || '').trim()) out[1].push('No cover description — Browse will look empty');

  const v = (st.variants || [])[typeof activeVariantIndex !== 'undefined' ? activeVariantIndex : 0]
    || (st.variants || [])[0];
  if (!v) {
    out[2].push('No version yet');
    return out;
  }
  if (!(v.name || '').trim()) out[2].push('Version needs a name');
  if (!(v.description || '').trim()) out[2].push('No instruction for this version');

  const files = v.files || [];
  const target = files.length ? (files[0].code || '') : (v.code || '');
  if (!target.trim()) out[2].push('No target code — nothing to check answers against');

  if (!(v.samples || []).length) out[3].push('No sample shown to the student');
  if (!(v.tests || []).length) out[3].push('No test cases — the attempt cannot be scored');
  return out;
}

function afStepIsClean(n) {
  const issues = afStepIssues();
  return !(issues[n] || []).length;
}

/* ── Moving between steps ─────────────────────────────────── */

window.afGoToStep = function (n) {
  const max = AF_STEPS.length;
  _afStep = Math.max(1, Math.min(max, n));

  const panel = document.getElementById('admin-form-container');
  if (!panel) return;

  // Hidden, never unmounted: an input that is not in the document cannot be
  // read on save, and half this form would silently save as blank.
  panel.querySelectorAll('[data-step]').forEach(el => {
    const steps = String(el.getAttribute('data-step')).split(' ');
    el.classList.toggle('af-step-hidden', !steps.includes(String(_afStep)));
  });

  if (_afStep === 4) afRenderReview();
  afRenderRail();
  afUpdateStepButtons();

  const st = (typeof adminState !== 'undefined' && adminState) ? adminState : null;
  if (st && st.id && st.id !== 'new') {
    try { localStorage.setItem(_afLastStepKey(st.id), String(_afStep)); } catch (e) { /* quota */ }
  }
  // A step change is a new page as far as reading goes.
  const scroller = panel.closest('.messenger-pane-2') || panel;
  scroller.scrollTop = 0;
};

window.afNextStep = function () { afGoToStep(_afStep + 1); };
window.afPrevStep = function () { afGoToStep(_afStep - 1); };

/** Called when the editor opens. */
window.afResetSteps = function () {
  const st = (typeof adminState !== 'undefined' && adminState) ? adminState : null;
  let start = 1;
  if (st && st.id && st.id !== 'new') {
    const saved = parseInt(localStorage.getItem(_afLastStepKey(st.id)), 10);
    if (Number.isFinite(saved) && saved >= 1 && saved <= AF_STEPS.length) start = saved;
  }
  afGoToStep(start);
};

/* ── The rail ─────────────────────────────────────────────── */

function afRenderRail() {
  const host = document.getElementById('af-step-rail');
  if (!host) return;
  const issues = afStepIssues();
  host.innerHTML = AF_STEPS.map(s => {
    const bad = (issues[s.n] || []).length;
    // `current` and the validity are separate classes: making them exclusive
    // meant the step you were standing on never showed whether it was complete,
    // which is exactly when you want to know.
    const classes = [
      s.n === _afStep ? 'current' : '',
      s.n === 4 ? '' : (bad ? 'warn' : 'ok')
    ].filter(Boolean).join(' ');
    const tip = bad ? (issues[s.n] || []).join(' · ') : 'Nothing missing here';
    return `
      <button class="af-step ${classes}" onclick="afGoToStep(${s.n})" title="${escapeHTML(tip)}">
        <span class="af-step-dot"><i data-lucide="${bad ? 'alert-circle' : (s.n === 4 ? s.icon : 'check')}"></i></span>
        <span class="af-step-label">${escapeHTML(s.label)}</span>
      </button>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
}

function afUpdateStepButtons() {
  const prev = document.getElementById('af-prev-btn');
  const next = document.getElementById('af-next-btn');
  if (prev) prev.disabled = _afStep === 1;
  if (next) next.disabled = _afStep === AF_STEPS.length;
  const label = document.getElementById('af-step-of');
  if (label) label.textContent = 'Step ' + _afStep + ' of ' + AF_STEPS.length;
}

/* ── Step 4: is this program actually ready ───────────────── */

function afRenderReview() {
  const host = document.getElementById('af-review-body');
  if (!host) return;
  const st = (typeof adminState !== 'undefined' && adminState) ? adminState : null;
  if (!st) { host.innerHTML = ''; return; }

  const v = (st.variants || [])[0] || {};
  const files = v.files || [];
  const target = files.length ? (files[0].code || '') : (v.code || '');
  const starter = files.length ? (files[0].starterCode || '') : (v.starterCode || '');

  const checks = [
    { ok: !!(st.title || '').trim(), label: 'Has a title', hint: 'Shown everywhere the program appears' },
    { ok: !!(st.coverDescription || '').trim(), label: 'Has a cover description', hint: 'Shown on the Browse card' },
    { ok: (st.tags || []).length > 0, label: 'Has at least one tag', hint: 'Used by the library filters' },
    { ok: (st.variants || []).length > 0, label: 'Has a version', hint: 'A program with none cannot be attempted' },
    { ok: !!target.trim(), label: 'Has target code', hint: 'The solution answers are checked against' },
    { ok: !!starter.trim(), label: 'Has starter code', hint: 'Optional, but a blank editor is a cold start' },
    { ok: (v.samples || []).length > 0, label: 'Has a worked sample', hint: 'Shown beside the editor during practice' },
    { ok: (v.tests || []).length > 0, label: 'Has test cases', hint: 'Without these the attempt cannot be scored' },
    { ok: !!st._verifiedAt, label: 'Verified against the target', hint: 'Run Verify Solution on step 3' }
  ];
  const done = checks.filter(c => c.ok).length;

  host.innerHTML = `
    <div class="af-review-score">
      <div class="af-review-ring" style="--pct:${Math.round((done / checks.length) * 100)}">
        <span>${done}<small>/${checks.length}</small></span>
      </div>
      <div>
        <h4>${done === checks.length ? 'Ready to publish' : 'Nearly there'}</h4>
        <p>${done === checks.length
          ? 'Everything a student needs is in place.'
          : 'The unticked items below still work, but the program is weaker without them.'}</p>
      </div>
    </div>
    <ul class="af-review-list">
      ${checks.map(c => `
        <li class="${c.ok ? 'ok' : 'missing'}">
          <i data-lucide="${c.ok ? 'check-circle-2' : 'circle'}"></i>
          <span><strong>${escapeHTML(c.label)}</strong><em>${escapeHTML(c.hint)}</em></span>
        </li>`).join('')}
    </ul>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
}

/* ── Textareas that fit what is in them ───────────────────────
   Samples and expected-output boxes were two and three rows, so a four-line
   sample showed two lines and a scrollbar. */
window.afAutosize = function (el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight + 2, 420) + 'px';
};

window.afAutosizeAll = function (root) {
  (root || document).querySelectorAll('textarea.af-grow').forEach(t => afAutosize(t));
};

/* One listener for the whole form rather than an attribute on every box. */
document.addEventListener('input', (e) => {
  if (e.target && e.target.matches && e.target.matches('textarea.af-grow')) afAutosize(e.target);
});

/* ============================================================
   WINGS/PROGRESSION.JS — goals, broken into steps
   ------------------------------------------------------------
   A goal is only useful if it is smaller than itself, so the steps are the
   point and they are tickable from the goal's own page — opening an editor to
   record that you did a thing is enough friction to stop you recording it.

   The stage keeps itself honest: reaching every step IS what "Reached" means,
   so it moves on its own rather than waiting to be updated by hand, and drops
   back if you untick one.

   The reader also shows the Roadmap paths laid toward this goal. That is the
   more useful direction of the link — standing on a goal and asking how you
   planned to get there — and it costs no extra field, since the path already
   names the goal it serves.
   ============================================================ */

wingRegister('progression', {
  noun: 'goal', nounPlural: 'goals',
  layout: 'goals',
  rows: false,

  titleLabel: 'The goal',
  titlePlaceholder: 'e.g. Read C fluently enough to debug without help',
  bodyLabel: 'Why this one',
  bodyPlaceholder: 'What it unlocks, and what happens if you never do it…',

  groupBy: 'stage',
  groupOrder: ['Active', 'Paused', 'Someday', 'Reached'],

  fields: [
    { key: 'stage', type: 'select', label: 'Stage',
      options: ['Someday', 'Active', 'Paused', 'Reached'], def: 'Active' },
    { key: 'target', type: 'date', label: 'Target date' },
    { key: 'steps', type: 'checklist', label: 'Steps',
      hint: 'One per line. Tick them off from the goal itself once saved.' }
  ],

  card(w) {
    const stage = wingVal(w, 'stage') || 'Active';
    const target = wingDateLabel(wingVal(w, 'target'));
    const p = wingProgress(w);
    return wingShell(w, `
      <div class="wing-goal-head">
        <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
        ${wingBadge(stage, 'stage-' + wingSlug(stage))}
      </div>
      ${p ? wingProgressBarHTML(p) : '<p class="wing-muted">No steps yet.</p>'}
      ${wingGoalCardStepsHTML(w)}
      <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 110) || '')}</p>
      <div class="wing-row-meta">
        ${target ? wingTargetChipHTML(w) : ''}
        ${(w.tags || []).slice(0, 2).map(t => libTagBadgeHTML('wing', t)).join('')}
      </div>
    `, 'card card-enhanced wing-goal');
  },

  readerExtras(w) {
    return wingGoalStepsHTML(w) + wingGoalPathsHTML(w);
  }
});

/** The tickable step list. */
function wingGoalStepsHTML(w) {
  const steps = Array.isArray(wingVal(w, 'steps')) ? wingVal(w, 'steps') : [];
  if (!steps.length) return '';
  return `
    <section class="wing-sec">
      <h3 class="wing-sec-h">Steps ${wingProgressBarHTML(wingProgress(w))}</h3>
      <ul class="wing-steps">
        ${steps.map((s, i) => `
          <li class="wing-step${s.done ? ' done' : ''}">
            <button class="wing-step-box" onclick="wingToggleStep('${w.id}', ${i})"
                    aria-pressed="${!!s.done}" aria-label="${s.done ? 'Undo' : 'Mark done'}">
              <i data-lucide="${s.done ? 'check' : 'circle'}" style="width:14px;height:14px;"></i>
            </button>
            <span>${escapeHTML(s.text)}</span>
          </li>`).join('')}
      </ul>
    </section>`;
}

/** Every Roadmap path pointing at this goal. */
function wingGoalPathsHTML(w) {
  const paths = wingItems('roadmap').filter(r => wingVal(r, 'goalRef') === w.id);
  if (!paths.length) return '';
  return `
    <section class="wing-sec">
      <h3 class="wing-sec-h">Paths toward this goal</h3>
      ${paths.map(r => {
        const p = wingProgress(r);
        return `<button class="wing-link-card" onclick="wingGoTo('roadmap','${r.id}')">
          <i data-lucide="map"></i>
          <span class="wing-link-title">${escapeHTML(r.title || 'Untitled')}</span>
          ${p ? `<span class="wing-muted">${p.done}/${p.total} stages</span>` : ''}
          <i data-lucide="chevron-right" style="margin-left:auto;"></i>
        </button>`;
      }).join('')}
    </section>`;
}

function wingToggleStep(id, i) {
  if (typeof event !== 'undefined' && event) event.stopPropagation();
  const w = wingFind(id);
  if (!w || !w.data || !Array.isArray(w.data.steps) || !w.data.steps[i]) return;
  w.data.steps[i].done = !w.data.steps[i].done;
  w.updatedAt = Date.now();
  const p = wingProgress(w);
  if (p && p.done === p.total && w.data.stage !== 'Reached') w.data.stage = 'Reached';
  else if (p && p.done < p.total && w.data.stage === 'Reached') w.data.stage = 'Active';
  wingSaveAndRepaint();
}

/* ── Starter pack ─────────────────────────────────────────────
   One goal at each stage, including a reached one, so the board is not all "Active".

   It lives here, with the schema it fills in, rather than in one file
   holding every wing's examples: the fields these entries use are
   defined a few lines up, and a pack that drifts from its schema is the
   failure mode worth designing against.
   ------------------------------------------------------------ */
wingSeedRegister('progression', [
    { title: 'Read a stack trace in any language I use',
      body: 'Not memorising frameworks — being able to open an unfamiliar trace and find the line that matters without guessing.',
      data: { stage: 'Active', target: '',
              steps: [{ text: 'Read one trace a day for a fortnight', done: true },
                      { text: 'Write down what each frame meant', done: false },
                      { text: 'Do it once in a language I do not know', done: false }] },
      tags: ['debugging'] },
    { title: 'Ship something end to end, alone',
      body: 'Design, build, deploy and support it. The gaps show up in the parts nobody hands you.',
      data: { stage: 'Someday', target: '',
              steps: [{ text: 'Pick something small and real', done: false },
                      { text: 'Get it in front of one other person', done: false },
                      { text: 'Fix the first thing they hit', done: false }] },
      tags: ['projects'] },
    { title: 'Explain my work to someone outside the field',
      body: 'The test of understanding is whether it survives losing the vocabulary.',
      data: { stage: 'Paused', target: '',
              steps: [{ text: 'Write one paragraph with no jargon', done: false },
                      { text: 'Read it aloud and watch where they frown', done: false }] },
      tags: ['communication'] },
    { title: 'Stop needing the debugger for control flow',
      body: 'Reading what a function does should not require stepping through it. Stepping is for state now, not for shape.',
      data: { stage: 'Reached', target: '',
              steps: [{ text: 'Predict the path before running it', done: true },
                      { text: 'Only step in when the prediction was wrong', done: true }] },
      tags: ['debugging'] }
  ]);

/* ── The next steps, tickable from the card ───────────────────
   Ticking a step off is the thing you do most in this library, and it was
   two clicks away behind opening the goal. The card shows the next few
   undone steps and takes the tick directly; the reader still shows all of
   them. Three, because a card is a summary — a goal with twelve steps
   should not become a page.
   ------------------------------------------------------------ */
const WING_GOAL_CARD_STEPS = 3;

function wingGoalCardStepsHTML(w) {
  const steps = Array.isArray(wingVal(w, 'steps')) ? wingVal(w, 'steps') : [];
  if (!steps.length) return '';
  // Index against the original array, since that is what the toggle needs.
  const next = steps.map((s, i) => ({ s: s, i: i })).filter(x => !x.s.done).slice(0, WING_GOAL_CARD_STEPS);
  if (!next.length) return '<p class="wing-goal-alldone"><i data-lucide="check-check"></i> Every step done</p>';
  return `
    <ul class="wing-goal-next">
      ${next.map(x => `
        <li class="wing-step">
          <button class="wing-step-box" onclick="wingToggleStep('${w.id}', ${x.i})"
                  aria-pressed="false" aria-label="Mark done">
            <i data-lucide="circle" style="width:13px;height:13px;"></i>
          </button>
          <span>${escapeHTML(x.s.text)}</span>
        </li>`).join('')}
      ${steps.filter(s => !s.done).length > next.length
        ? `<li class="wing-goal-more">+${steps.filter(s => !s.done).length - next.length} more</li>` : ''}
    </ul>`;
}

/* ── A target date that says whether it has passed ────────────
   Overdue, tomorrow and next year all rendered identically, which makes the
   field decorative. The chip carries the state now, and says how late.
   ------------------------------------------------------------ */
function wingTargetChipHTML(w) {
  const raw = wingVal(w, 'target');
  const label = wingDateLabel(raw);
  if (!label) return '';
  const stage = wingVal(w, 'stage');
  const d = (typeof wingParseDate === 'function') ? wingParseDate(raw) : null;
  let cls = '', note = '';
  // A goal already reached is not late, whatever the date says.
  if (d && stage !== 'Reached') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((d - today) / 86400000);
    if (days < 0) { cls = ' is-overdue'; note = ' · ' + (-days) + 'd late'; }
    else if (days === 0) { cls = ' is-today'; note = ' · today'; }
    else if (days <= 7) { cls = ' is-soon'; note = ' · ' + days + 'd'; }
  }
  return `<span class="wing-target${cls}"><i data-lucide="calendar" style="width:11px;height:11px;"></i> ${escapeHTML(label)}${note}</span>`;
}

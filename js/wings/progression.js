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
      <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 110) || '')}</p>
      <div class="wing-row-meta">
        ${target ? `<span><i data-lucide="calendar" style="width:11px;height:11px;"></i> ${escapeHTML(target)}</span>` : ''}
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

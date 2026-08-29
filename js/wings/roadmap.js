/* ============================================================
   WINGS/ROADMAP.JS — the path you walk to reach a goal
   ------------------------------------------------------------
   Stages run in order, and each is planned, being walked, or cleared. Three
   states rather than a tick because a path is not a checklist: knowing which
   stage you are ON is the thing you actually come here to see, and a boolean
   cannot say that.

   Clicking a marker moves it along: planned → walking → cleared → planned.
   Cycling rather than a menu, because the move is almost always forward and a
   dropdown for three states is heavier than the decision.

   A path can name the Progression goal it serves; the goal shows every path
   pointing at it in return. See wings/progression.js for the other half.
   ============================================================ */

wingRegister('roadmap', {
  noun: 'path', nounPlural: 'paths',
  layout: 'path',
  rows: false,

  titleLabel: 'The path',
  titlePlaceholder: 'e.g. From copying code to writing it cold',
  bodyLabel: 'How you intend to walk it',
  bodyPlaceholder: 'The approach, the rules you set yourself, what you will not do…',

  groupBy: 'horizon',
  groupOrder: ['Now', 'Next', 'Later'],

  fields: [
    { key: 'horizon', type: 'select', label: 'Horizon',
      options: ['Now', 'Next', 'Later'], def: 'Now' },
    { key: 'goalRef', type: 'goalref', label: 'Goal this serves',
      hint: 'Pick one of your Progression goals, so the path and the goal know about each other.' },
    { key: 'stages', type: 'stages', label: 'Stages',
      hint: 'One per line, in order. Click a marker to move it on: planned → walking → cleared.' }
  ],

  card(w) {
    const horizon = wingVal(w, 'horizon') || 'Now';
    const stages = Array.isArray(wingVal(w, 'stages')) ? wingVal(w, 'stages') : [];
    const p = wingProgress(w);
    const ref = wingVal(w, 'goalRef');
    const goal = ref ? wingItems('progression').find(g => g.id === ref) : null;
    return wingShell(w, `
      <div class="wing-goal-head">
        <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
        ${wingBadge(horizon, 'horizon-' + wingSlug(horizon))}
      </div>
      ${goal ? `<p class="wing-path-goal"><i data-lucide="flag" style="width:11px;height:11px;"></i> ${escapeHTML(goal.title || 'Untitled')}</p>` : ''}
      ${stages.length ? `<div class="wing-pips">${stages.map(s =>
        `<span class="wing-pip ${escapeHTML(s.status || 'planned')}" title="${escapeHTML(s.text)}"></span>`).join('')}</div>`
        : '<p class="wing-muted">No stages yet.</p>'}
      ${p ? wingProgressBarHTML(p) : ''}
      <div class="wing-row-meta">
        ${(w.tags || []).slice(0, 2).map(t => libTagBadgeHTML('wing', t)).join('')}
      </div>
    `, 'card card-enhanced wing-path');
  },

  readerExtras(w) {
    return wingPathStagesHTML(w) + wingPathGoalHTML(w);
  }
});

/** The route, with each marker clickable to move that stage on. */
function wingPathStagesHTML(w) {
  const stages = Array.isArray(wingVal(w, 'stages')) ? wingVal(w, 'stages') : [];
  if (!stages.length) return '';
  return `
    <section class="wing-sec">
      <h3 class="wing-sec-h">Stages ${wingProgressBarHTML(wingProgress(w))}</h3>
      <ol class="wing-route">
        ${stages.map((s, i) => `
          <li class="wing-route-step ${escapeHTML(s.status || 'planned')}">
            <button class="wing-route-mark" onclick="wingCycleStage('${w.id}', ${i})"
                    title="planned → walking → cleared">
              <i data-lucide="${s.status === 'cleared' ? 'check' : (s.status === 'walking' ? 'footprints' : 'circle')}"
                 style="width:14px;height:14px;"></i>
            </button>
            <div class="wing-route-text">
              <span>${escapeHTML(s.text)}</span>
              <em>${escapeHTML(s.status || 'planned')}</em>
            </div>
          </li>`).join('')}
      </ol>
    </section>`;
}

/** The goal at the end of the path. */
function wingPathGoalHTML(w) {
  const id = wingVal(w, 'goalRef');
  if (!id) return '';
  const goal = wingItems('progression').find(g => g.id === id);
  if (!goal) return '';
  const p = wingProgress(goal);
  return `
    <section class="wing-sec">
      <h3 class="wing-sec-h">The goal this serves</h3>
      <button class="wing-link-card" onclick="wingGoTo('progression','${goal.id}')">
        <i data-lucide="flag"></i>
        <span class="wing-link-title">${escapeHTML(goal.title || 'Untitled')}</span>
        ${p ? `<span class="wing-muted">${p.done}/${p.total} steps</span>` : ''}
        <i data-lucide="chevron-right" style="margin-left:auto;"></i>
      </button>
    </section>`;
}

function wingCycleStage(id, i) {
  if (typeof event !== 'undefined' && event) event.stopPropagation();
  const w = wingFind(id);
  if (!w || !w.data || !Array.isArray(w.data.stages) || !w.data.stages[i]) return;
  const cur = w.data.stages[i].status || 'planned';
  w.data.stages[i].status = WING_STAGE_STATES[(WING_STAGE_STATES.indexOf(cur) + 1) % WING_STAGE_STATES.length];
  w.updatedAt = Date.now();
  wingSaveAndRepaint();
}

/* ============================================================
   WING-VIEWS.JS — drawing the seven wings
   ------------------------------------------------------------
   The schema in wing-schemas.js says what a wing IS; this draws it. One
   renderer per layout, plus the editor fields, plus the few things you can do
   to an entry from the reader without opening the editor (ticking a step,
   moving a stage on).

   Layouts come in two shapes. A museum, a catalogue, goals and paths are
   cards in a grid; a rulebook, a timeline and a journal are rows in a column,
   because a numbered code of conduct and a chronology both want to be read
   downward rather than scanned across.
   ============================================================ */

const WING_ROW_LAYOUTS = ['rulebook', 'timeline', 'journal'];

function wingIsRowLayout(schema) {
  return WING_ROW_LAYOUTS.indexOf(schema.layout) !== -1;
}

/* ── Editor fields ────────────────────────────────────────── */

function wingFieldEditorHTML(f, w) {
  const id = 'wing-x-' + f.key;
  const raw = wingVal(w, f.key);
  const hint = f.hint ? `<span class="af-label-hint">${escapeHTML(f.hint)}</span>` : '';
  const label = `<label class="form-label" for="${id}">${escapeHTML(f.label)} ${hint}</label>`;

  if (f.type === 'select') {
    const cur = raw || f.def || '';
    return `<div class="af-field">${label}
      <select id="${id}" class="form-select">
        ${f.options.map(o => `<option value="${escapeHTML(o)}"${o === cur ? ' selected' : ''}>${escapeHTML(o)}</option>`).join('')}
      </select></div>`;
  }

  if (f.type === 'date') {
    const val = raw || (f.def === 'today' ? wingToday() : '');
    return `<div class="af-field">${label}
      <input type="date" id="${id}" class="form-input" value="${escapeHTML(val)}" /></div>`;
  }

  if (f.type === 'rating') {
    const v = parseInt(raw, 10) || 0;
    const max = f.max || 5;
    return `<div class="af-field">${label}
      <div class="wing-rate-pick" id="${id}" data-value="${v}">
        ${Array.from({ length: max }, (_, i) => `
          <button type="button" class="wing-rate-star${i < v ? ' on' : ''}" data-n="${i + 1}"
                  onclick="wingSetRating('${f.key}', ${i + 1})" aria-label="${i + 1} of ${max}">
            <i data-lucide="star" style="width:18px;height:18px;${i < v ? 'fill:currentColor;' : ''}"></i>
          </button>`).join('')}
        <button type="button" class="wing-rate-clear" onclick="wingSetRating('${f.key}', 0)">clear</button>
      </div></div>`;
  }

  if (f.type === 'checklist' || f.type === 'stages') {
    const list = Array.isArray(raw) ? raw : [];
    const text = list.map(s => s.text).join('\n');
    return `<div class="af-field">${label}
      <textarea id="${id}" class="form-textarea" rows="6"
                placeholder="One per line…">${escapeHTML(text)}</textarea></div>`;
  }

  if (f.type === 'goalref') {
    const goals = (typeof wingItems === 'function') ? wingItems('progression') : [];
    return `<div class="af-field">${label}
      <select id="${id}" class="form-select">
        <option value="">— none —</option>
        ${goals.map(g => `<option value="${g.id}"${raw === g.id ? ' selected' : ''}>${escapeHTML(g.title || 'Untitled')}</option>`).join('')}
      </select>
      ${goals.length ? '' : '<p class="af-label-hint" style="margin-top:0.35rem;">No goals in the Progression library yet.</p>'}
    </div>`;
  }

  if (f.type === 'textarea') {
    return `<div class="af-field">${label}
      <textarea id="${id}" class="form-textarea" rows="${f.rows || 4}"
                placeholder="${escapeHTML(f.placeholder || '')}">${escapeHTML(raw || '')}</textarea></div>`;
  }

  return `<div class="af-field">${label}
    <input id="${id}" class="form-input" value="${escapeHTML(raw || '')}"
           placeholder="${escapeHTML(f.placeholder || '')}" /></div>`;
}

/** The rating widget writes to a data attribute; the save reads that. */
function wingSetRating(key, n) {
  const host = document.getElementById('wing-x-' + key);
  if (!host) return;
  const cur = parseInt(host.dataset.value, 10) || 0;
  // Clicking the star you are already on clears it — otherwise a 1 can never
  // be undone without a separate control being hunted for.
  const next = (n === cur) ? 0 : n;
  host.dataset.value = next;
  host.querySelectorAll('.wing-rate-star').forEach(b => {
    const on = (parseInt(b.dataset.n, 10) || 0) <= next;
    b.classList.toggle('on', on);
    const i = b.querySelector('svg, [data-lucide]');
    if (i) i.style.fill = on ? 'currentColor' : '';
  });
}

/**
 * Read every schema field out of the editor.
 *
 * Checklists merge rather than replace: an item whose text is unchanged keeps
 * whether it was ticked. Retyping a step list would otherwise silently reset
 * a goal you were halfway through.
 */
function wingReadFieldValues(schema, existing) {
  const data = {};
  (schema.fields || []).forEach(f => {
    const el = document.getElementById('wing-x-' + f.key);
    if (!el) return;

    if (f.type === 'rating') {
      data[f.key] = parseInt(el.dataset.value, 10) || 0;
      return;
    }

    if (f.type === 'checklist' || f.type === 'stages') {
      const was = Array.isArray(wingVal(existing, f.key)) ? wingVal(existing, f.key) : [];
      const seen = {};
      was.forEach(s => { if (s && s.text) seen[s.text] = s; });
      data[f.key] = String(el.value || '')
        .split('\n').map(t => t.trim()).filter(Boolean)
        .map(t => {
          const prev = seen[t];
          return f.type === 'stages'
            ? { text: t, status: (prev && prev.status) || 'planned' }
            : { text: t, done: !!(prev && prev.done) };
        });
      return;
    }

    data[f.key] = el.value;
  });
  return data;
}

/* ── Cards and rows ───────────────────────────────────────── */

function wingEntryHTML(w, schema) {
  switch (schema.layout) {
    case 'museum':    return _wingMuseumCard(w);
    case 'rulebook':  return _wingRuleRow(w);
    case 'timeline':  return _wingTimelineRow(w);
    case 'journal':   return _wingJournalRow(w);
    case 'catalogue': return _wingCatalogueCard(w);
    case 'goals':     return _wingGoalCard(w);
    case 'path':      return _wingPathCard(w);
    default:          return _wingPlainCard(w);
  }
}

function _wingShell(w, inner, extraClass) {
  const selecting = libSelectMode('wing');
  return `
    <div class="${extraClass}${libIsSelected('wing', w.id) ? ' lib-selected' : ''}"
         onclick="${selecting ? `libToggleSelect('wing','${w.id}')` : `wingOpen('${w.id}')`}" style="cursor:pointer;">
      ${libSelectBoxHTML('wing', w.id)}
      ${libFavButtonHTML('wing', w)}
      ${inner}
    </div>`;
}

function _wingMuseumCard(w) {
  const conv = wingVal(w, 'conviction') || 'Testing';
  const since = wingDateLabel(wingVal(w, 'since'), { year: 'numeric', month: 'long' });
  const replaces = wingVal(w, 'replaces');
  return _wingShell(w, `
    <div class="wing-plaque-rule"></div>
    <blockquote class="wing-plaque-text">${escapeHTML(w.title || 'Untitled')}</blockquote>
    ${replaces ? `<p class="wing-plaque-replaces"><s>${escapeHTML(replaces)}</s></p>` : ''}
    <div class="wing-plaque-foot">
      ${wingBadge(conv, 'conv-' + wingSlug(conv))}
      ${since ? `<span class="wing-muted">held since ${escapeHTML(since)}</span>` : ''}
    </div>
    ${(w.tags || []).length ? `<div class="wing-tagrow">${(w.tags || []).map(t => libTagBadgeHTML('wing', t)).join('')}</div>` : ''}
  `, 'card card-enhanced wing-plaque');
}

function _wingRuleRow(w) {
  const kind = wingVal(w, 'kind') || 'Decision';
  const trig = wingVal(w, 'trigger');
  const why = wingVal(w, 'because');
  return _wingShell(w, `
    <div class="wing-rule-body">
      <p class="wing-rule-text">${escapeHTML(w.title || 'Untitled')}</p>
      ${trig ? `<p class="wing-rule-when"><i data-lucide="target" style="width:12px;height:12px;"></i> ${escapeHTML(trig)}</p>` : ''}
      ${why ? `<p class="wing-rule-why">${escapeHTML(why)}</p>` : ''}
    </div>
    <div class="wing-rule-side">${wingBadge(kind, 'kind-' + wingSlug(kind))}</div>
  `, 'wing-row wing-rule');
}

function _wingTimelineRow(w) {
  const d = wingParseDate(wingVal(w, 'occurred'));
  const place = wingVal(w, 'place');
  const who = wingVal(w, 'who');
  const feel = wingVal(w, 'feeling');
  return _wingShell(w, `
    <div class="wing-tl-rail">
      <span class="wing-tl-dot"></span>
      <span class="wing-tl-date">${d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</span>
    </div>
    <div class="wing-tl-body">
      <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
      <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 180) || 'No account written yet.')}</p>
      <div class="wing-row-meta">
        ${place ? `<span><i data-lucide="map-pin" style="width:11px;height:11px;"></i> ${escapeHTML(place)}</span>` : ''}
        ${who ? `<span><i data-lucide="users" style="width:11px;height:11px;"></i> ${escapeHTML(who)}</span>` : ''}
        ${feel ? wingBadge(feel, 'soft') : ''}
      </div>
    </div>
  `, 'wing-row wing-tl');
}

function _wingJournalRow(w) {
  const d = wingParseDate(wingVal(w, 'entryDate'));
  const mood = wingVal(w, 'mood');
  const energy = parseInt(wingVal(w, 'energy'), 10) || 0;
  const good = wingVal(w, 'oneGoodThing');
  return _wingShell(w, `
    <div class="wing-day">
      <span class="wing-day-num">${d ? d.getDate() : '–'}</span>
      <span class="wing-day-dow">${d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : ''}</span>
    </div>
    <div class="wing-tl-body">
      <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
      <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 180) || 'Nothing written yet.')}</p>
      <div class="wing-row-meta">
        ${mood ? wingBadge(mood, 'mood-' + wingSlug(mood)) : ''}
        ${energy ? wingStars(energy, 5) : ''}
        ${good ? `<span class="wing-good"><i data-lucide="sparkles" style="width:11px;height:11px;"></i> ${escapeHTML(good)}</span>` : ''}
      </div>
    </div>
  `, 'wing-row wing-journal');
}

function _wingCatalogueCard(w) {
  const medium = wingVal(w, 'medium') || 'Other';
  const creator = wingVal(w, 'creator');
  const year = wingVal(w, 'year');
  const status = wingVal(w, 'status');
  const rating = parseInt(wingVal(w, 'rating'), 10) || 0;
  const icons = { Music: 'music', Anime: 'tv', Film: 'clapperboard', Series: 'monitor-play',
                  Book: 'book', Game: 'gamepad-2', Other: 'box' };
  return _wingShell(w, `
    <div class="wing-cat-head">
      <span class="wing-cat-icon"><i data-lucide="${icons[medium] || 'box'}"></i></span>
      <div style="min-width:0;flex:1;">
        <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
        <p class="wing-cat-by">${escapeHTML([creator, year].filter(Boolean).join(' · ') || '—')}</p>
      </div>
    </div>
    ${rating ? `<div class="wing-cat-rate">${wingStars(rating, 5)}</div>` : ''}
    <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 120) || '')}</p>
    <div class="wing-row-meta">
      ${status ? wingBadge(status, 'status-' + wingSlug(status)) : ''}
      ${(w.tags || []).slice(0, 2).map(t => libTagBadgeHTML('wing', t)).join('')}
    </div>
  `, 'card card-enhanced wing-cat');
}

function _wingGoalCard(w) {
  const stage = wingVal(w, 'stage') || 'Active';
  const target = wingDateLabel(wingVal(w, 'target'));
  const p = wingProgress(w);
  return _wingShell(w, `
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
}

function _wingPathCard(w) {
  const horizon = wingVal(w, 'horizon') || 'Now';
  const stages = Array.isArray(wingVal(w, 'stages')) ? wingVal(w, 'stages') : [];
  const p = wingProgress(w);
  const goal = wingVal(w, 'goalRef')
    ? (wingItems('progression').find(g => g.id === wingVal(w, 'goalRef')) || null) : null;
  return _wingShell(w, `
    <div class="wing-goal-head">
      <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
      ${wingBadge(horizon, 'horizon-' + wingSlug(horizon))}
    </div>
    ${goal ? `<p class="wing-path-goal"><i data-lucide="flag" style="width:11px;height:11px;"></i> ${escapeHTML(goal.title || 'Untitled')}</p>` : ''}
    ${stages.length ? `<div class="wing-pips">${stages.map(s =>
      `<span class="wing-pip ${escapeHTML(s.status || 'planned')}" title="${escapeHTML(s.text)}"></span>`).join('')}</div>` : '<p class="wing-muted">No stages yet.</p>'}
    ${p ? wingProgressBarHTML(p) : ''}
    <div class="wing-row-meta">
      ${(w.tags || []).slice(0, 2).map(t => libTagBadgeHTML('wing', t)).join('')}
    </div>
  `, 'card card-enhanced wing-path');
}

function _wingPlainCard(w) {
  const when = w.updatedAt || w.createdAt;
  return _wingShell(w, `
    <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
    ${(w.tags || []).length ? `<div class="wing-tagrow">${(w.tags || []).map(t => libTagBadgeHTML('wing', t)).join('')}</div>` : ''}
    <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 160) || 'No content yet.')}</p>
    ${when ? `<div class="card-last-attempt"><i data-lucide="clock" style="width:11px;height:11px;"></i> ${new Date(when).toLocaleDateString()}</div>` : ''}
  `, 'card card-enhanced');
}

/* ── The reader ───────────────────────────────────────────── */

/** The schema fields, laid out under the title. */
function wingReaderMetaHTML(w, schema) {
  const rows = [];
  (schema.fields || []).forEach(f => {
    const v = wingVal(w, f.key);
    if (f.type === 'checklist' || f.type === 'stages' || f.type === 'goalref') return;   // shown separately
    if (v === '' || v === null || v === undefined || v === 0) return;
    let shown;
    if (f.type === 'date') shown = escapeHTML(wingDateLabel(v));
    else if (f.type === 'rating') shown = wingStars(v, f.max || 5);
    else shown = escapeHTML(String(v));
    if (!shown) return;
    rows.push(`<div class="wing-meta-row"><dt>${escapeHTML(f.label)}</dt><dd>${shown}</dd></div>`);
  });
  return rows.length ? `<dl class="wing-meta">${rows.join('')}</dl>` : '';
}

/** Steps you can tick, stages you can move on — from the reader, no editor. */
function wingReaderListHTML(w, schema) {
  const stepsField = (schema.fields || []).find(f => f.type === 'checklist');
  const stageField = (schema.fields || []).find(f => f.type === 'stages');

  if (stepsField) {
    const steps = Array.isArray(wingVal(w, stepsField.key)) ? wingVal(w, stepsField.key) : [];
    if (!steps.length) return '';
    const p = wingProgress(w);
    return `
      <section class="wing-sec">
        <h3 class="wing-sec-h">${escapeHTML(stepsField.label)} ${wingProgressBarHTML(p)}</h3>
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

  if (stageField) {
    const stages = Array.isArray(wingVal(w, stageField.key)) ? wingVal(w, stageField.key) : [];
    if (!stages.length) return '';
    const p = wingProgress(w);
    return `
      <section class="wing-sec">
        <h3 class="wing-sec-h">${escapeHTML(stageField.label)} ${wingProgressBarHTML(p)}</h3>
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
  return '';
}

/** The Progression goal a path serves, and the paths that serve a goal. */
function wingReaderLinksHTML(w, schema) {
  if (schema.layout === 'path') {
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

  if (schema.layout === 'goals') {
    // The other direction, which is the one that is actually useful: standing
    // on a goal, which paths did I lay down to reach it?
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
  return '';
}

/* ── Acting on an entry from the reader ───────────────────── */

function _wingSaveAndRepaint() {
  saveData();
  wingRenderDetail();
  wingRenderSidebar();
  wingUpdateHeader();
}

function wingToggleStep(id, i) {
  if (event) event.stopPropagation();
  const w = wingFind(id);
  if (!w || !w.data || !Array.isArray(w.data.steps) || !w.data.steps[i]) return;
  w.data.steps[i].done = !w.data.steps[i].done;
  w.updatedAt = Date.now();
  // Reaching every step is what "Reached" means, so the stage keeps itself
  // honest rather than waiting to be updated by hand.
  const p = wingProgress(w);
  if (p && p.done === p.total && w.data.stage && w.data.stage !== 'Reached') w.data.stage = 'Reached';
  else if (p && p.done < p.total && w.data.stage === 'Reached') w.data.stage = 'Active';
  _wingSaveAndRepaint();
}

function wingCycleStage(id, i) {
  if (event) event.stopPropagation();
  const w = wingFind(id);
  if (!w || !w.data || !Array.isArray(w.data.stages) || !w.data.stages[i]) return;
  const cur = w.data.stages[i].status || 'planned';
  const next = WING_STAGE_STATES[(WING_STAGE_STATES.indexOf(cur) + 1) % WING_STAGE_STATES.length];
  w.data.stages[i].status = next;
  w.updatedAt = Date.now();
  _wingSaveAndRepaint();
}

/** Jump to another wing and open one entry there. */
function wingGoTo(key, id) {
  if (event) event.stopPropagation();
  _wingKey = key;
  _wingFolderId = null;
  _wingActiveId = id;
  _wingEditing = null;
  const target = '#/wing?k=' + key;
  if (window.location.hash === target) {
    wingRenderSidebar(); wingRenderDetail(); wingUpdateHeader();
  } else {
    window.location.hash = target;
    // The route rebuilds the pane, so the entry has to be reopened after it.
    setTimeout(() => { _wingActiveId = id; wingRenderDetail(); }, 60);
  }
}

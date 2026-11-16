/* ============================================================
   Route: training — the Training hub
   ------------------------------------------------------------
   Where practice that is not a program lives, in four tabs:

     Overview    the daily mix, what is due, Drills, and every template
     Skill tree  the 15 ideas the programs are built from, how strong you
                 are at each (concepts.js), and what to do about a weak one
     Mistakes    the compiler's complaints about you, ranked (mistakes.js),
                 and your own notes on mistakes it cannot see
     History     every training session: drills, the daily mix

   THE DAILY MIX is one short session: up to two due templates (or one new
   one) and a round of five drill questions of different kinds. It is run as
   a queue in a session param (thubMix); each step hands back with
   thubMixNext. Finished, it goes in the training log, which Home's activity
   calendar and streak read -- there is no separate training streak.

   Everything is read from state on each visit.
   ============================================================ */

let _thub = { q: '', tag: '', concept: null };
const THUB_TAB_KEY = 'ssp.thubTab';
const THUB_TABS = [
  { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
  { id: 'tree', label: 'Skill tree', icon: 'git-fork' },
  { id: 'mistakes', label: 'Mistakes', icon: 'bug' },
  { id: 'history', label: 'History', icon: 'history' }
];

/* The skill tree's layout: the course's order, simplest ideas first. */
const THUB_TREE = [
  { tier: 'Talking to the user', ids: ['printf', 'scanf'] },
  { tier: 'Choosing', ids: ['if', 'ifelse', 'switch', 'ternary'] },
  { tier: 'Repeating', ids: ['while', 'for', 'dowhile', 'loop', 'nestedloop'] },
  { tier: 'Building blocks', ids: ['function', 'recursion'] },
  { tier: 'Data', ids: ['array', 'pointer'] }
];

function _thubTab() {
  try { const t = localStorage.getItem(THUB_TAB_KEY); if (THUB_TABS.some(x => x.id === t)) return t; } catch (e) { /* none */ }
  return 'overview';
}

function trainingTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll lib-hub thub">
        <div class="chub-top">
          <button onclick="spaNavigate('coding')" class="btn-back-dark chub-back">
            <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Coding Library
          </button>
          <button class="tutorial-trigger-btn chub-tour" onclick="GuidedTutorial.start()" title="Show Page Tour" aria-label="Show Page Tour">
            <i data-lucide="graduation-cap"></i>
          </button>
        </div>
        <section class="lib-hub-hero fade-in-up">
          <div class="lib-hub-hero-icon thub-icon"><i data-lucide="target"></i></div>
          <h1 class="lib-hub-title">Training hub</h1>
          <p class="lib-hub-subtitle">Learn the shapes you write again and again until they come out without thinking.</p>
          <div class="lib-hub-totals" id="thub-totals"></div>
        </section>
        <nav class="thub-tabs" id="thub-tabs" role="tablist" aria-label="Training hub"></nav>
        <div id="thub-panel" role="tabpanel"></div>
      </div>
    </div>`;
}

function trainingInit() {
  if (typeof tplEnsureStarters === 'function') tplEnsureStarters();
  _thub.q = '';
  thubRender();
  if (typeof GuidedTutorial !== 'undefined') GuidedTutorial.init('training');
}

function trainingDestroy() {
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
}

/** After an Undo in the admin, or anything else that changed the list. */
function tplOnStoreChanged() {
  if (document.body.dataset.route === 'training') thubRender();
  if (document.body.dataset.route === 'admin-templates' && typeof atplRender === 'function') atplRender();
}

function thubSetTab(id) {
  try { localStorage.setItem(THUB_TAB_KEY, id); } catch (e) { /* private mode */ }
  thubRender();
  const b = document.querySelector('#thub-tabs [data-tab="' + id + '"]');
  if (b) b.focus();
}

function thubRender() {
  const list = tplStore();
  const due = tplDueList();
  const learned = list.filter(t => tplStatus(t.id).stage >= 4).length;
  const totals = document.getElementById('thub-totals');
  if (totals) {
    totals.innerHTML = _libStatChip('puzzle', countNoun(list.length, 'template'))
      + _libStatChip('brain', `${due.length} due`) + _libStatChip('trophy', `${learned} learned`)
      + (typeof homeStreakAllLibraries === 'function' ? _libStatChip('flame', `${homeStreakAllLibraries()}-day streak`) : '');
  }
  const tab = _thubTab();
  const tabs = document.getElementById('thub-tabs');
  if (tabs) {
    tabs.innerHTML = THUB_TABS.map(t => `
      <button type="button" class="thub-tabbtn${t.id === tab ? ' is-on' : ''}" role="tab" aria-selected="${t.id === tab}" data-tab="${t.id}"
              tabindex="${t.id === tab ? 0 : -1}" onclick="thubSetTab('${t.id}')"
              onkeydown="thubTabKey(event)"><i data-lucide="${t.icon}"></i> ${t.label}</button>`).join('');
  }
  const panel = document.getElementById('thub-panel');
  if (!panel) return;
  if (tab === 'tree') panel.innerHTML = _thubTreeHTML();
  else if (tab === 'mistakes') panel.innerHTML = _thubMistakesHTML();
  else if (tab === 'history') panel.innerHTML = _thubHistoryHTML();
  else { panel.innerHTML = _thubOverviewHTML(due); thubFilter(); }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: document.querySelector('.thub') || document });
}

function thubTabKey(e) {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault();
  const i = THUB_TABS.findIndex(t => t.id === _thubTab());
  const n = THUB_TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + THUB_TABS.length) % THUB_TABS.length];
  thubSetTab(n.id);
}

/* ── Overview ──────────────────────────────────────────────── */

function _thubOverviewHTML(due) {
  const list = tplStore();
  const plan = thubMixPlan();
  const tags = Array.from(new Set(list.reduce((a, t) => a.concat(t.tags || []), []))).sort();
  return `
    <section class="thub-mix">
      <div class="thub-mix-text">
        <strong><i data-lucide="shuffle"></i> Daily mix · about 10 minutes</strong>
        <span>${plan.map(s => s.kind === 'template' ? escapeHTML((tplFind(s.id) || {}).title || 'a template') + (s.review ? ' (review)' : '') : 'five drill questions, one of each kind').join(' · ')}</span>
      </div>
      <button class="btn btn-primary" onclick="thubStartMix()"><i data-lucide="play"></i> Start</button>
    </section>
    ${due.length ? `
      <div class="thub-due-card" id="thub-due">
        <div class="thub-due-text">
          <strong><i data-lucide="brain"></i> ${countNoun(due.length, 'template')} to review today</strong>
          <span>${due.slice(0, 4).map(d => escapeHTML(d.title)).join(' · ')}${due.length > 4 ? ' …' : ''}</span>
        </div>
        <button class="btn btn-secondary" onclick="tplStartDrill('${escapeHTML(due[0].id)}', { review: true, back: 'training' })">
          <i data-lucide="play"></i> Review ${escapeHTML(due[0].title)}
        </button>
      </div>` : ''}
    <div class="thub-tiles">
      <button class="thub-tile" onclick="spaNavigate('drills')">
        <i data-lucide="brain-circuit"></i>
        <span><strong>Drills</strong><em>Predict, trace, find the bug, blanks, line puzzles, chunk flash, compiler errors</em></span>
      </button>
      <button class="thub-tile" onclick="thubExamRun()">
        <i data-lucide="book-x"></i>
        <span><strong>Exam run</strong><em>A program you have solved before, from an empty file, closed book</em></span>
      </button>
      <button class="thub-tile" onclick="setSessionParam('mtlView', 'results'); spaNavigate('typing')">
        <i data-lucide="keyboard"></i>
        <span><strong>Typing weak spots</strong><em>The keys and C symbols that slow you down, and a drill made of them</em></span>
      </button>
      <button class="thub-tile" onclick="spaNavigate('admin-templates')">
        <i data-lucide="pencil"></i>
        <span><strong>Write templates</strong><em>Mark the names that change, import a set from an AI</em></span>
      </button>
    </div>
    <section class="thub-section">
      <div class="thub-section-head">
        <h2 class="lib-hub-section-title"><i data-lucide="puzzle"></i> Templates</h2>
        <div class="thub-tools">
          <div class="search-container thub-search">
            <i data-lucide="search"></i>
            <input type="text" id="thub-q" class="search-input" placeholder="Find a template…" autocomplete="off" value="${escapeHTML(_thub.q)}" oninput="thubFilter()">
          </div>
        </div>
      </div>
      <div class="thub-tags" id="thub-tags">${tags.length ? ['', ...tags].map(tg => `<button class="thub-tag${_thub.tag === tg ? ' is-on' : ''}" onclick="thubTag('${escapeHTML(tg).replace(/'/g, '&#39;')}')">${tg ? escapeHTML(tg) : 'All'}</button>`).join('') : ''}</div>
      <div class="thub-grid" id="thub-grid"></div>
    </section>`;
}

/** One template's stage dots: filled up to the highest stage passed. */
function thubDots(stage) {
  return `<span class="thub-dots" title="${stage ? 'Passed up to stage ' + stage + ' of 5' : 'Not started'}">`
    + [1, 2, 3, 4, 5].map(n => `<span class="thub-dot${n <= stage ? ' is-on' : ''}"></span>`).join('') + '</span>';
}

function _thubStatusText(st) {
  if (st.dueNow) return '<span class="thub-st is-due">Due now</span>';
  if (st.stage >= 4 && st.due) return `<span class="thub-st is-ok">Next review ${escapeHTML(st.due)}</span>`;
  if (st.stage) return `<span class="thub-st">Learning · stage ${st.stage}</span>`;
  return '<span class="thub-st is-new">New</span>';
}

function thubTag(tag) {
  _thub.tag = tag;
  thubRender();
}

function thubFilter() {
  const grid = document.getElementById('thub-grid');
  if (!grid) return;
  const qEl = document.getElementById('thub-q');
  const q = (qEl ? qEl.value : _thub.q || '').trim().toLowerCase();
  _thub.q = qEl ? qEl.value : _thub.q;
  const shown = tplStore().filter(t => (!_thub.tag || (t.tags || []).indexOf(_thub.tag) !== -1)
    && (!q || t.title.toLowerCase().includes(q) || (t.label || '').toLowerCase().includes(q) || (t.tags || []).join(' ').toLowerCase().includes(q)));
  if (!tplStore().length) {
    grid.innerHTML = `<div class="thub-empty"><i data-lucide="puzzle"></i><p>No templates yet.</p>
      <button class="btn btn-primary" onclick="spaNavigate('admin-templates')"><i data-lucide="plus"></i> Write one</button></div>`;
  } else if (!shown.length) {
    grid.innerHTML = '<div class="thub-empty"><p>No template matches.</p></div>';
  } else {
    grid.innerHTML = shown.map(t => {
      const st = tplStatus(t.id);
      const id = escapeHTML(t.id);
      return `
        <div class="thub-card${st.dueNow ? ' is-due' : ''}" role="button" tabindex="0"
             onclick="tplStartDrill('${id}', { review: ${st.dueNow}, back: 'training' })"
             onkeydown="if(event.key==='Enter'){tplStartDrill('${id}', { review: ${st.dueNow}, back: 'training' })}">
          <div class="thub-card-top">
            <h3>${escapeHTML(t.title)}</h3>
            ${thubDots(st.stage)}
          </div>
          <p>${escapeHTML(t.label || '')}</p>
          <div class="thub-card-foot">
            ${_thubStatusText(st)}
            ${(t.tags || []).slice(0, 2).map(tg => `<span class="thub-chip">${escapeHTML(tg)}</span>`).join('')}
          </div>
        </div>`;
    }).join('');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });
}

/* ── The daily mix ─────────────────────────────────────────── */

/** Today's mix: up to two due templates, else one to learn, then a mixed drill round. */
function thubMixPlan() {
  const cap = Math.max(1, Number((state.trainPrefs || {}).mixTemplates) || 2);
  const due = tplDueList().slice(0, cap).map(d => ({ kind: 'template', id: d.id, review: true }));
  const steps = due.length ? due : (() => {
    const fresh = tplStore().find(t => tplStatus(t.id).stage < 4);
    return fresh ? [{ kind: 'template', id: fresh.id, review: false }] : [];
  })();
  steps.push({ kind: 'drills' });
  return steps;
}

function thubStartMix() {
  const steps = thubMixPlan();
  setSessionParam('thubMix', { steps, at: 0, started: Date.now() });
  thubMixGo();
}

function thubMixGo() {
  const m = getSessionParam('thubMix');
  if (!m || !m.steps || !m.steps[m.at]) { thubMixStop(); return; }
  const s = m.steps[m.at];
  if (typeof toast === 'function') toast('Daily mix: step ' + (m.at + 1) + ' of ' + m.steps.length, { type: 'info', duration: 1600 });
  if (s.kind === 'template') tplStartDrill(s.id, { review: s.review, back: 'mix' });
  else { setSessionParam('thubMixEnter', true); spaNavigate('drills'); }
}

/** The current step is finished: on to the next, or done. */
function thubMixNext() {
  const m = getSessionParam('thubMix');
  if (!m) { spaNavigate('training'); return; }
  const step = m.steps[m.at];
  if (step && step.kind === 'drills' && typeof drillState !== 'undefined') { m.right = drillState.right; m.answered = drillState.done; }
  m.at++;
  if (m.at >= m.steps.length) {
    if (!Array.isArray(state.trainLog)) state.trainLog = [];
    state.trainLog.push({ id: generateId(), kind: 'mix', steps: m.steps.length, done: m.steps.length,
      right: m.right || 0, answered: m.answered || 0,
      seconds: Math.round((Date.now() - (m.started || Date.now())) / 1000), at: Date.now() });
    if (typeof saveData === 'function') saveData();
    clearSessionParam('thubMix');
    try { if (typeof psfxStarfall === 'function') psfxStarfall(); } catch (e) { /* sound is optional */ }
    if (typeof toast === 'function') toast('Daily mix done. See you tomorrow.', { type: 'success', duration: 2600 });
    spaNavigate('training');
    return;
  }
  setSessionParam('thubMix', m);
  thubMixGo();
}

/** Leave the mix part-way: what was finished still counts toward today. */
function thubMixStop() {
  const m = getSessionParam('thubMix');
  clearSessionParam('thubMix');
  if (m && m.at > 0) {
    if (!Array.isArray(state.trainLog)) state.trainLog = [];
    state.trainLog.push({ id: generateId(), kind: 'mix', steps: m.steps.length, done: m.at,
      seconds: Math.round((Date.now() - (m.started || Date.now())) / 1000), at: Date.now() });
    if (typeof saveData === 'function') saveData();
  }
  spaNavigate('training');
}

/* ── Exam run ──────────────────────────────────────────────── */

/**
 * A program you have passed, written again from an empty file with nothing
 * to look at: Recall and Closed book on. One that is due for review first.
 * A program with an unfinished attempt is skipped, so nothing of yours is
 * overwritten by the exam.
 */
function thubExamRun() {
  const free = (id) => !(typeof _browseSavedAttempt === 'function' && _browseSavedAttempt(id));
  const due = (typeof getDueReviewItems === 'function' ? getDueReviewItems() : []).filter(d => d.type === 'challenge' && free(d.id));
  let id = due.length ? due[0].id : null;
  if (!id) {
    const passed = (state.challenges || []).filter(c => typeof programPassed === 'function' && programPassed(c.id) && free(c.id));
    if (passed.length) id = passed[Math.floor(Math.random() * passed.length)].id;
  }
  const c = id && (state.challenges || []).find(x => x.id === id);
  const v = c && (c.variants || [])[0];
  if (!c || !v) {
    if (typeof toast === 'function') toast('An exam run is a program you have passed, written again from memory. Pass one first.', { type: 'info', duration: 3200 });
    return;
  }
  if (typeof examClear === 'function') examClear();
  if (typeof examSetup === 'function') examSetup(true, 0, true);
  setSessionParam('practiceChallenge', c.id);
  setSessionParam('practiceVariant', v.id);
  setSessionParam('timeLimit', 0);
  spaNavigate('practice');
}

/* ── Skill tree ────────────────────────────────────────────── */

function _thubTreeHTML() {
  const model = typeof conceptMastery === 'function' ? conceptMastery() : [];
  const by = {};
  model.forEach(c => { by[c.concept] = c; });
  // An idea no program has tested yet still has templates and drills to offer.
  const blank = (id) => ({ concept: id, label: typeof minReqLabel === 'function' ? minReqLabel(id) : id, strength: null,
    band: 'untried', bandLabel: '', attempts: 0, programs: 0, solved: 0, mistakes: [], weakest: [] });
  const pick = _thub.concept ? (by[_thub.concept] || blank(_thub.concept)) : null;
  const node = (id) => {
    const c = by[id] || blank(id);
    const tpls = tplStore().filter(t => (t.concepts || []).indexOf(id) !== -1).length;
    const band = c.strength === null ? 'untried' : c.band;
    return `<button type="button" class="thub-node is-${band}${pick && pick.concept === id ? ' is-on' : ''}" onclick="thubPickConcept('${id}')"
              title="${escapeHTML(c.label)}: ${c.strength === null ? 'not enough yet' : c.bandLabel + ', ' + c.strength + '%'}">
      <span class="thub-node-name">${escapeHTML(c.label)}</span>
      <span class="thub-node-band">${c.strength === null ? 'not enough yet' : escapeHTML(c.bandLabel) + ' · ' + c.strength + '%'}</span>
      <span class="thub-node-meta">${countNoun(c.attempts || 0, 'attempt')}${tpls ? ' · ' + countNoun(tpls, 'template') : ''}</span>
    </button>`;
  };
  return `
    <div class="thub-tree-wrap">
      <div class="thub-tree">
        ${THUB_TREE.map(row => `
          <div class="thub-tier">
            <div class="thub-tier-name">${escapeHTML(row.tier)}</div>
            <div class="thub-tier-nodes">${row.ids.map(node).join('')}</div>
          </div>`).join('<div class="thub-tier-link" aria-hidden="true"></div>')}
        <p class="thub-legend"><span class="is-strong"></span> Strong <span class="is-solid"></span> Solid <span class="is-shaky"></span> Shaky <span class="is-weak"></span> Weak <span class="is-untried"></span> Not enough yet · fades when you have not practised it lately</p>
      </div>
      <aside class="thub-tree-side">${pick ? _thubConceptHTML(pick) : '<p class="atpl-hint">Pick an idea to see what to practise for it.</p>'}</aside>
    </div>`;
}

function thubPickConcept(id) {
  _thub.concept = id;
  thubRender();
}

function _thubConceptHTML(c) {
  const tpls = tplStore().filter(t => (t.concepts || []).indexOf(c.concept) !== -1);
  return `
    <h3>${escapeHTML(c.label)}</h3>
    <p class="thub-side-band">${c.strength === null ? 'Not enough attempts to say yet.' : escapeHTML(c.bandLabel) + ' · ' + c.strength + '% · ' + c.solved + ' of ' + c.programs + ' programs solved'}</p>
    <div class="thub-side-actions">
      <button class="btn btn-primary btn-sm" onclick="conceptDrill('${c.concept}')" title="A practice set of your weakest programs that need it"><i data-lucide="code-2"></i> Write programs</button>
      <button class="btn btn-secondary btn-sm" onclick="thubConceptDrills('${c.concept}')" title="Drill questions from programs you passed and templates that use it"><i data-lucide="brain-circuit"></i> Quick drills</button>
    </div>
    ${(c.weakest || []).length ? `<div class="thub-side-title">Weakest programs</div>
      ${c.weakest.map(p => `<button class="thub-side-link" onclick="browseOpenProgram('${escapeHTML(p.id)}'); spaNavigate('browse')">${escapeHTML(p.title)}<em>${p.score === null ? 'not tried' : p.score + '%'}</em></button>`).join('')}` : ''}
    ${tpls.length ? `<div class="thub-side-title">Templates</div>
      ${tpls.map(t => `<button class="thub-side-link" onclick="tplStartDrill('${escapeHTML(t.id)}', { back: 'training' })">${escapeHTML(t.title)}${thubDots(tplStatus(t.id).stage)}</button>`).join('')}` : ''}
    ${(c.mistakes || []).length ? `<div class="thub-side-title">Your mistakes here</div>
      ${c.mistakes.map(m => `<div class="thub-side-row">${escapeHTML(m.label)}<em>${countNoun(m.attempts, 'attempt')}</em></div>`).join('')}` : ''}`;
}

function thubConceptDrills(concept) {
  setSessionParam('drillConcept', concept);
  spaNavigate('drills');
}

/* ── Mistakes ──────────────────────────────────────────────── */

function _thubNotes() {
  if (!state.drillLog || !Array.isArray(state.drillLog.notes)) state.drillLog = Object.assign({}, state.drillLog || {}, { notes: (state.drillLog && state.drillLog.notes) || [] });
  return state.drillLog.notes;
}

function _thubMistakesHTML() {
  const notes = _thubNotes();
  return `
    <div class="thub-mk">
      <section>
        <h2 class="lib-hub-section-title"><i data-lucide="bug"></i> What the compiler keeps catching</h2>
        ${typeof mistakesPanelHTML === 'function' ? mistakesPanelHTML(40) : ''}
        <div class="thub-side-actions">
          <button class="btn btn-secondary btn-sm" onclick="thubDrillMode('errors')"><i data-lucide="alert-octagon"></i> Errors drill</button>
          <button class="btn btn-secondary btn-sm" onclick="thubDrillMode('fix')"><i data-lucide="bug"></i> Find the bug</button>
        </div>
      </section>
      <section>
        <h2 class="lib-hub-section-title"><i data-lucide="notebook-pen"></i> Your own notes</h2>
        <p class="atpl-hint">For the mistakes no compiler sees: a loop that ran once too often, a forgotten '\\0'.</p>
        <form class="thub-note-form" onsubmit="event.preventDefault(); thubAddNote();">
          <input class="form-input" id="thub-note" maxlength="200" placeholder="What went wrong, in a line">
          <button class="btn btn-primary btn-sm" type="submit"><i data-lucide="plus"></i> Add</button>
        </form>
        <div class="thub-notes">${notes.length ? notes.slice().reverse().map(n => `
          <div class="thub-note"><span>${escapeHTML(n.text)}</span><em>${escapeHTML(new Date(n.at).toLocaleDateString())}</em>
            <button class="dz-btn" onclick="thubDeleteNote('${escapeHTML(n.id)}')" title="Delete" aria-label="Delete note"><i data-lucide="x"></i></button></div>`).join('')
          : '<p class="atpl-hint">None yet.</p>'}</div>
      </section>
    </div>`;
}

function thubDrillMode(mode) {
  setSessionParam('drillModeOnce', mode);
  spaNavigate('drills');
}

function thubAddNote() {
  const el = document.getElementById('thub-note');
  const text = el ? el.value.trim() : '';
  if (!text) return;
  _thubNotes().push({ id: generateId(), text, at: Date.now() });
  if (typeof saveData === 'function') saveData();
  thubRender();
  const again = document.getElementById('thub-note');
  if (again) again.focus();
}

function thubDeleteNote(id) {
  const notes = _thubNotes();
  const i = notes.findIndex(n => n.id === id);
  if (i === -1) return;
  const [gone] = notes.splice(i, 1);
  if (typeof saveData === 'function') saveData();
  if (typeof pushUndo === 'function') pushUndo('Delete note', () => { _thubNotes().splice(i, 0, gone); if (typeof saveData === 'function') saveData(); thubRender(); });
  thubRender();
}

/* ── History ───────────────────────────────────────────────── */

function _thubHistoryHTML() {
  const log = (Array.isArray(state.trainLog) ? state.trainLog : []).slice().reverse();
  const checks = (state.templateHistory || []).slice().reverse().slice(0, 30);
  const kindLabel = (e) => e.kind === 'mix' ? 'Daily mix' : e.kind === 'drills' ? 'Drills · ' + ((DRILL_MODES.find(m => m.id === e.mode) || {}).label || 'mix') : e.kind;
  const when = (ts) => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return `
    <div class="thub-hist">
      <section>
        <h2 class="lib-hub-section-title"><i data-lucide="history"></i> Sessions</h2>
        ${log.length ? `<div class="thub-hist-list">${log.slice(0, 60).map(e => `
          <div class="thub-hist-row"><strong>${escapeHTML(kindLabel(e))}</strong>
            <span>${e.kind === 'mix' ? e.done + ' of ' + e.steps + ' steps' + (e.answered ? ' · ' + e.right + ' of ' + e.answered + ' right' : '') : e.right + ' of ' + e.done + ' right'}</span>
            <em>${escapeHTML(when(e.at))}</em></div>`).join('')}</div>` : '<p class="atpl-hint">No sessions yet. The daily mix and every drill round land here.</p>'}
      </section>
      <section>
        <h2 class="lib-hub-section-title"><i data-lucide="puzzle"></i> Template checks</h2>
        ${checks.length ? `<div class="thub-hist-list">${checks.map(c => `
          <div class="thub-hist-row"><strong>${escapeHTML((tplFind(c.templateId) || {}).title || 'a deleted template')}</strong>
            <span>stage ${c.stage} · ${c.score}%${c.passed ? ' · passed' : ''}${c.self ? ' (accepted)' : ''}</span>
            <em>${escapeHTML(when(c.at))}</em></div>`).join('')}</div>` : '<p class="atpl-hint">No template checks yet.</p>'}
      </section>
    </div>`;
}

/* ============================================================
   Route: training — the Training hub
   ------------------------------------------------------------
   Where practice that is not a program lives. For now: templates, the code
   shapes you learn by heart (template-attempt), with what is due for review
   first. Daily mix, more drills and the skill tree join it here later.

   Everything on the page is read from state on each visit: the templates,
   their checks (state.templateHistory) and their schedule (state.review).
   ============================================================ */

let _thub = { q: '', tag: '' };

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
        <section class="thub-due" id="thub-due"></section>
        <section class="thub-section">
          <div class="thub-section-head">
            <h2 class="lib-hub-section-title"><i data-lucide="puzzle"></i> Templates</h2>
            <div class="thub-tools">
              <div class="search-container thub-search">
                <i data-lucide="search"></i>
                <input type="text" id="thub-q" class="search-input" placeholder="Find a template…" autocomplete="off" oninput="thubFilter()">
              </div>
              <button class="btn btn-secondary btn-sm" onclick="spaNavigate('admin-templates')" title="Write, edit, import and export templates">
                <i data-lucide="pencil"></i> Manage
              </button>
            </div>
          </div>
          <div class="thub-tags" id="thub-tags"></div>
          <div class="thub-grid" id="thub-grid"></div>
        </section>
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

function thubRender() {
  const list = tplStore();
  const due = tplDueList();
  const learned = list.filter(t => tplStatus(t.id).stage >= 4).length;
  const totals = document.getElementById('thub-totals');
  if (totals) {
    totals.innerHTML = _libStatChip('puzzle', countNoun(list.length, 'template'))
      + _libStatChip('brain', `${due.length} due`) + _libStatChip('trophy', `${learned} learned`);
  }
  const dueHost = document.getElementById('thub-due');
  if (dueHost) {
    dueHost.innerHTML = due.length ? `
      <div class="thub-due-card">
        <div class="thub-due-text">
          <strong><i data-lucide="brain"></i> ${countNoun(due.length, 'template')} to review today</strong>
          <span>${due.slice(0, 4).map(d => escapeHTML(d.title)).join(' · ')}${due.length > 4 ? ' …' : ''}</span>
        </div>
        <button class="btn btn-primary" onclick="tplStartDrill('${due[0].id}', { review: true, back: 'training' })">
          <i data-lucide="play"></i> Start with ${escapeHTML(due[0].title)}
        </button>
      </div>` : '';
  }
  const tags = Array.from(new Set(list.reduce((a, t) => a.concat(t.tags || []), []))).sort();
  const tagHost = document.getElementById('thub-tags');
  if (tagHost) {
    tagHost.innerHTML = tags.length ? ['', ...tags].map(tg => `<button class="thub-tag${_thub.tag === tg ? ' is-on' : ''}" onclick="thubTag('${escapeHTML(tg).replace(/'/g, '&#39;')}')">${tg ? escapeHTML(tg) : 'All'}</button>`).join('') : '';
  }
  thubFilter();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: document.querySelector('.thub') || document });
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
  _thub.q = q;
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

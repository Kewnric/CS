/* ============================================================
   ROUTE-LANGUAGE.JS — the Language Library
   ------------------------------------------------------------
   Pane 1 is a board of cards rather than a list, because this wing does
   several unrelated things — look a word up, drill one puzzle type, go on a
   run — and a single scrolling list made you hunt for the one you wanted.
   Picking a card fills pane 2.

   Nothing here writes content. Words, drills and scenarios are authored in
   Language Admin and only read from the library: two places to edit the same
   record is how they drift apart.
   ============================================================ */

let langView = 'dictionary';      // which card is open
let langViewArg = null;           // its subject, when it has one
let langActiveWordId = null;
let langQuery = '';
let langTagFilter = null;
let langPosFilter = null;

function languageTemplate() {
  return `
    <div class="messenger-layout" id="lang-lib-root">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display:flex; align-items:center; gap:0.5rem; width:100%;">
            <button onclick="spaNavigate('library')" class="btn-back-dark" style="margin-right:0.5rem; padding:0.25rem 0.5rem; font-size:0.75rem; flex-shrink:0;">
              <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
            </button>
            <h2 class="section-header-animated" style="margin:0; display:flex; align-items:center;">
              <span class="section-header-icon-wrap">
                <i data-lucide="languages"></i>
                <span class="section-header-icon-ring"></span>
              </span>
              <span class="section-header-text">
                <span class="section-header-title">Language Library</span>
                <span class="section-header-subtitle" id="lang-header-stats"></span>
              </span>
            </h2>
          </div>
          <div id="lang-pair-bar"></div>
        </div>
        <div class="pane-1-content" id="lang-board"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="lang-detail" style="padding:2rem; min-height:100%;"></div>
      </section>
    </div>`;
}

function languageInit() {
  langStore();
  langView = getSessionParam('langView') || 'dictionary';
  langViewArg = getSessionParam('langViewArg') || null;
  const target = getSessionParam('langActiveWord');
  langActiveWordId = target && langFindWord(target) ? target : null;
  renderLangLibrary();
}

function languageDestroy() { }

/* ── The language pair ────────────────────────────────────── */

function langPairBarHTML() {
  const study = langStudy(), ref = langRef();
  const pill = (code, active, onclick, dim) => `
    <button class="lang-pill${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}" type="button"
            onclick="${onclick}" title="${escapeHTML(langName(code))}">${escapeHTML(langShort(code))}</button>`;
  return `
    <div class="lang-pair-bar">
      <div class="lang-pair-side">
        <span class="lang-pair-label">Learning</span>
        <div class="lang-pill-row">
          ${LANGS.map(l => pill(l.code, l.code === study, `langSetStudy('${l.code}')`, l.code === ref)).join('')}
        </div>
      </div>
      <button class="lang-swap-btn" type="button" onclick="langSwapPair()" title="Swap the two languages">
        <i data-lucide="arrow-left-right"></i>
      </button>
      <div class="lang-pair-side">
        <span class="lang-pair-label">Compare to</span>
        <div class="lang-pill-row">
          ${LANGS.map(l => pill(l.code, l.code === ref, `langSetRef('${l.code}')`, l.code === study)).join('')}
        </div>
      </div>
    </div>`;
}

function langSwapPair() {
  const s = langStudy(), r = langRef();
  try {
    localStorage.setItem(LANG_STUDY_KEY, r);
    localStorage.setItem(LANG_REF_KEY, s);
  } catch (e) { /* private mode */ }
  langRefreshViews();
}

function langOpen(view, arg) {
  langView = view;
  langViewArg = arg || null;
  setSessionParam('langView', view);
  setSessionParam('langViewArg', langViewArg);
  renderLangLibrary();
}

/* ── Render ───────────────────────────────────────────────── */

function renderLangLibrary() {
  const bar = document.getElementById('lang-pair-bar');
  if (bar) bar.innerHTML = langPairBarHTML();
  renderLangBoard();
  renderLangDetail();
  const stats = document.getElementById('lang-header-stats');
  if (stats) {
    const n = langWords().length;
    stats.textContent = `${n} word${n !== 1 ? 's' : ''} · ${langStudy().toUpperCase()} → ${langRef().toUpperCase()}`;
  }
  const root = document.getElementById('lang-lib-root');
  if (typeof lucide !== 'undefined' && root) lucide.createIcons({ root });
}

function langBoardCard(view, arg, icon, name, desc, chip, cls) {
  const active = langView === view && String(langViewArg || '') === String(arg || '');
  return `
    <button class="lang-card${active ? ' is-active' : ''}${cls ? ' ' + cls : ''}" type="button"
            onclick="langOpen('${view}'${arg ? `, '${arg}'` : ''})">
      <span class="lang-card-icon"><i data-lucide="${icon}"></i></span>
      <span class="lang-card-body">
        <span class="lang-card-name">${escapeHTML(name)}</span>
        <span class="lang-card-desc">${escapeHTML(desc)}</span>
      </span>
      ${chip ? `<span class="lang-card-chip">${chip}</span>` : ''}
    </button>`;
}

function renderLangBoard() {
  const host = document.getElementById('lang-board');
  if (!host) return;
  const words = langWords().length;
  const sets = langSets().length;
  const scenes = langScenarios().length;

  host.innerHTML = `
    <div class="lang-board">
      <h3 class="lang-board-title"><i data-lucide="book-a"></i> Dictionary</h3>
      ${langBoardCard('dictionary', null, 'library-big', 'Dictionary',
        'Every entry with its meaning, and its example sentences a tap away.', `${words}`)}
      ${langBoardCard('compare', null, 'columns-2', 'Search & compare',
        'Find a word and read it in two languages side by side.', '')}

      <h3 class="lang-board-title"><i data-lucide="dumbbell"></i> Drills</h3>
      ${LANG_PUZZLE_TYPES.map(p => {
        const n = langTypeCount(p.type);
        return langBoardCard('drill', p.type, p.icon, p.name, p.hint, `${n}`, n ? '' : 'is-empty');
      }).join('')}
      ${langBoardCard('sets', null, 'layers', 'Your drill sets',
        'The sets you have written, run start to finish.', `${sets}`)}

      <h3 class="lang-board-title"><i data-lucide="swords"></i> Adventure</h3>
      ${langBoardCard('run', null, 'footprints', 'Free run',
        'Walk, meet people, and talk your way past them. Stamina is your health.', '')}
      ${langBoardCard('scenarios', null, 'map', 'Scenarios',
        'The encounters you have written, and who you meet in them.', `${scenes}`)}
    </div>
    <div class="lang-board-foot">
      <button class="btn btn-secondary btn-sm" type="button" onclick="spaNavigate('admin-language')">
        <i data-lucide="settings" style="width:14px;height:14px;"></i> Manage in Admin
      </button>
      <span class="lang-board-hint">Words, drills and scenarios are written in Admin.</span>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function renderLangDetail() {
  const host = document.getElementById('lang-detail');
  if (!host) return;
  let html = '';
  if (langView === 'dictionary') html = langDictionaryHTML();
  else if (langView === 'compare') html = langCompareHTML();
  else if (langView === 'drill') html = langDrillTypeHTML(langViewArg);
  else if (langView === 'sets') html = langSetsHTML();
  else if (langView === 'run') html = langRunHTML();
  else if (langView === 'scenarios') html = langScenariosHTML();
  host.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/* ── Dictionary ───────────────────────────────────────────── */

function langDictionaryHTML() {
  const study = langStudy(), ref = langRef();
  let list = langWords().filter(w => langMatches(w, langQuery));
  if (langTagFilter) list = list.filter(w => (w.tags || []).includes(langTagFilter));
  if (langPosFilter) list = list.filter(w => (w.forms[study] || {}).pos === langPosFilter);
  list = list.slice().sort((a, b) =>
    langHeadword(a, study).localeCompare(langHeadword(b, study), undefined, { sensitivity: 'base' }));

  const rows = list.map(w => {
    const f = w.forms[study] || langBlankForm();
    const g = w.forms[ref] || langBlankForm();
    const exCount = (f.examples || []).length + (g.examples || []).length;
    return `
      <div class="lang-entry">
        <div class="lang-entry-main">
          <div class="lang-entry-head">
            <span class="lang-entry-term">${escapeHTML(langHeadword(w, study))}</span>
            ${f.pos ? `<span class="lang-pos">${escapeHTML(f.pos)}</span>` : ''}
            ${g.term ? `<span class="lang-entry-gloss">${escapeHTML(g.term)}</span>` : ''}
          </div>
          <div class="lang-entry-def">${escapeHTML(f.definition || g.definition || 'No definition recorded.')}</div>
          ${f.restrictions ? `<div class="lang-entry-warn"><i data-lucide="alert-triangle"></i> ${escapeHTML(f.restrictions)}</div>` : ''}
        </div>
        <div class="lang-entry-tools">
          <button class="ag-icon-btn" type="button" onclick="langShowExamples('${w.id}')"
                  title="${exCount ? exCount + ' example sentence' + (exCount !== 1 ? 's' : '') : 'No examples recorded'}"
                  ${exCount ? '' : 'disabled'}>
            <i data-lucide="quote"></i>
          </button>
          <button class="ag-icon-btn" type="button" onclick="langShowNotes('${w.id}')"
                  title="Notes and restrictions">
            <i data-lucide="sticky-note"></i>
          </button>
          <button class="ag-icon-btn" type="button" onclick="langOpen('compare'); langActiveWordId='${w.id}'; renderLangDetail();"
                  title="Compare side by side">
            <i data-lucide="columns-2"></i>
          </button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="library-big"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">Dictionary</h1>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="book-a" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Entries</em><strong>${langWords().length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="filter" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Showing</em><strong>${list.length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="languages" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Reading</em><strong>${escapeHTML(langShort(study))} / ${escapeHTML(langShort(ref))}</strong></span></div>
          </div>
        </div>
      </div>
      ${langFilterBarHTML()}
      <div class="lang-entries">${rows || '<div class="lang-empty">No entries match. Words are added in Language Admin.</div>'}</div>
    </div>`;
}

function langFilterBarHTML() {
  const study = langStudy();
  const tags = langAllTags();
  const posUsed = [];
  langWords().forEach(w => {
    const p = (w.forms[study] || {}).pos;
    if (p && posUsed.indexOf(p) === -1) posUsed.push(p);
  });
  return `
    <div class="lang-filterbar">
      <div class="search-container" style="flex:1; min-width:200px;">
        <i data-lucide="search"></i>
        <input type="text" class="search-input" id="lang-q" placeholder="Search every language…"
               autocomplete="off" value="${escapeHTML(langQuery)}" oninput="langSetQuery(this.value)" />
      </div>
      ${posUsed.length ? `
        <select class="form-select lang-filter-select" onchange="langSetPos(this.value)">
          <option value="">Any part of speech</option>
          ${posUsed.sort().map(p => `<option value="${p}"${langPosFilter === p ? ' selected' : ''}>${p}</option>`).join('')}
        </select>` : ''}
      ${(langQuery || langTagFilter || langPosFilter) ? `
        <button class="btn btn-ghost btn-sm" onclick="langClearFilters()">
          <i data-lucide="filter-x" style="width:14px;height:14px;"></i> Clear
        </button>` : ''}
    </div>
    ${tags.length ? `<div class="lang-tagbar">
      ${tags.map(t => `
        <button class="lang-tag-chip${langTagFilter === t.tag ? ' is-active' : ''}" type="button"
                onclick="langSetTag(${JSON.stringify(t.tag)})">${escapeHTML(t.tag)} <span>${t.count}</span></button>`).join('')}
    </div>` : ''}`;
}

/* The query is kept out of the re-render: replacing the input while it has
   focus would drop the caret to the end on every keystroke. */
function langSetQuery(v) {
  langQuery = (v || '').trim();
  const host = document.querySelector('.lang-entries');
  if (!host) { renderLangDetail(); return; }
  const fresh = document.createElement('div');
  fresh.innerHTML = langView === 'compare' ? langCompareHTML() : langDictionaryHTML();
  const next = fresh.querySelector('.lang-entries') || fresh.querySelector('.lang-compare-results');
  if (next) { host.innerHTML = next.innerHTML; if (typeof lucide !== 'undefined') lucide.createIcons({ root: host }); }
}

function langSetTag(tag) { langTagFilter = langTagFilter === tag ? null : tag; renderLangDetail(); }
function langSetPos(p) { langPosFilter = p || null; renderLangDetail(); }
function langClearFilters() { langQuery = ''; langTagFilter = null; langPosFilter = null; renderLangDetail(); }

/** Example sentences, in a popup rather than crowding every row. */
function langShowExamples(id) {
  const w = langFindWord(id);
  if (!w) return;
  const body = LANG_CODES.map(c => {
    const f = w.forms[c];
    if (!f || !(f.examples || []).length) return '';
    return `
      <div class="lang-pop-lang">
        <div class="lang-pop-head"><span class="lang-col-code">${escapeHTML(langShort(c))}</span> ${escapeHTML(langName(c))}</div>
        <ul class="lang-examples">
          ${f.examples.map(e => `<li>
            <span class="lang-ex-text">${escapeHTML(e.text)}</span>
            ${e.gloss ? `<span class="lang-ex-gloss">${escapeHTML(e.gloss)}</span>` : ''}
          </li>`).join('')}
        </ul>
      </div>`;
  }).join('');
  langPopup('Examples — ' + langHeadword(w), 'quote', body || '<p class="lang-empty">No example sentences recorded.</p>');
}

function langShowNotes(id) {
  const w = langFindWord(id);
  if (!w) return;
  const body = LANG_CODES.map(c => {
    const f = w.forms[c];
    if (!f || (!f.notes && !f.restrictions)) return '';
    return `
      <div class="lang-pop-lang">
        <div class="lang-pop-head"><span class="lang-col-code">${escapeHTML(langShort(c))}</span> ${escapeHTML(langName(c))}</div>
        ${f.notes ? `<div class="lang-block"><h4><i data-lucide="sticky-note"></i> Notes</h4><p>${escapeHTML(f.notes)}</p></div>` : ''}
        ${f.restrictions ? `<div class="lang-block lang-block-warn"><h4><i data-lucide="alert-triangle"></i> Restrictions</h4><p>${escapeHTML(f.restrictions)}</p></div>` : ''}
      </div>`;
  }).join('');
  langPopup('Notes — ' + langHeadword(w), 'sticky-note', body || '<p class="lang-empty">Nothing recorded.</p>');
}

/** One small modal, reused by both popups. */
function langPopup(title, icon, bodyHtml) {
  const old = document.getElementById('lang-popup');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'lang-popup';
  wrap.className = 'modal-overlay';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  wrap.innerHTML = `
    <div class="modal-content ag-modal-content">
      <div class="ag-modal-head">
        <h2 class="modal-title ag-modal-title"><i data-lucide="${icon}"></i> ${escapeHTML(title)}</h2>
        <button class="ag-icon-btn" type="button" onclick="this.closest('.modal-overlay').remove()" aria-label="Close">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="lang-pop-body">${bodyHtml}</div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') wrap.remove(); });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: wrap });
}

/* ── Search & compare ─────────────────────────────────────── */

function langCompareHTML() {
  const study = langStudy(), ref = langRef();
  let list = langWords().filter(w => langMatches(w, langQuery));
  if (langTagFilter) list = list.filter(w => (w.tags || []).includes(langTagFilter));
  const w = langActiveWordId ? langFindWord(langActiveWordId) : (list[0] || null);

  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="columns-2"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">Search &amp; compare</h1>
          <p class="prog-detail-desc" style="margin:0;">Reading ${escapeHTML(langName(study))} against ${escapeHTML(langName(ref))}.</p>
        </div>
      </div>
      ${langFilterBarHTML()}
      <div class="lang-compare-results">
        <div class="lang-pickrow">
          ${list.slice(0, 40).map(x => `
            <button class="lang-pick${w && w.id === x.id ? ' is-active' : ''}" type="button"
                    onclick="langActiveWordId='${x.id}'; renderLangDetail();">${escapeHTML(langHeadword(x, study))}</button>`).join('')
            || '<span class="lang-empty">No matches.</span>'}
        </div>
        ${w ? `
          <div class="lang-compare">
            ${langFormColumnHTML(w, study, true)}
            ${langFormColumnHTML(w, ref, false)}
          </div>
          ${langOtherLangsHTML(w, [study, ref])}` : ''}
      </div>
    </div>`;
}

function langFormColumnHTML(w, code, isStudy) {
  const f = w.forms[code] || langBlankForm();
  const empty = !(f.term || '').trim();
  return `
    <div class="lang-col${isStudy ? ' is-study' : ''}${empty ? ' is-empty' : ''}">
      <div class="lang-col-head">
        <span class="lang-col-code">${escapeHTML(langShort(code))}</span>
        <span class="lang-col-name">${escapeHTML(langName(code))}</span>
        <span class="lang-col-role">${isStudy ? 'learning' : 'reference'}</span>
      </div>
      ${empty ? `<div class="lang-col-empty">Nothing recorded in ${escapeHTML(langName(code))} yet.</div>` : `
        <div class="lang-term">${escapeHTML(f.term)}${f.pos ? `<span class="lang-pos">${escapeHTML(f.pos)}</span>` : ''}</div>
        ${f.definition ? `<p class="lang-def">${escapeHTML(f.definition)}</p>` : ''}
        ${(f.examples || []).length ? `
          <div class="lang-block">
            <h4><i data-lucide="quote"></i> Examples</h4>
            <ul class="lang-examples">
              ${f.examples.map(e => `<li>
                <span class="lang-ex-text">${escapeHTML(e.text)}</span>
                ${e.gloss ? `<span class="lang-ex-gloss">${escapeHTML(e.gloss)}</span>` : ''}
              </li>`).join('')}
            </ul>
          </div>` : ''}
        ${f.notes ? `<div class="lang-block"><h4><i data-lucide="sticky-note"></i> Notes</h4><p>${escapeHTML(f.notes)}</p></div>` : ''}
        ${f.restrictions ? `<div class="lang-block lang-block-warn"><h4><i data-lucide="alert-triangle"></i> Restrictions</h4><p>${escapeHTML(f.restrictions)}</p></div>` : ''}
      `}
    </div>`;
}

function langOtherLangsHTML(w, shown) {
  const rest = LANG_CODES.filter(c => shown.indexOf(c) === -1);
  const filled = rest.filter(c => (w.forms[c].term || '').trim());
  if (!filled.length) return '';
  return `
    <h2 class="prog-detail-section-title" style="margin-top:1.5rem;"><i data-lucide="languages"></i> Also recorded</h2>
    <div class="lang-other-row">
      ${filled.map(c => `
        <button class="lang-other" type="button" onclick="langSetStudy('${c}')" title="Switch to ${escapeHTML(langName(c))}">
          <span class="lang-col-code">${escapeHTML(langShort(c))}</span>
          <span class="lang-other-term">${escapeHTML(w.forms[c].term)}</span>
        </button>`).join('')}
    </div>`;
}

/* ── One drill type ───────────────────────────────────────── */

function langDrillTypeHTML(type) {
  const meta = langPuzzleMeta(type);
  const rules = LANG_TYPE_RULES[meta.type] || LANG_TYPE_RULES.arrange;
  const pool = langItemsOfType(meta.type);
  const runs = (state.langHistory || []).filter(h => h.kind === 'type' && h.refId === meta.type);
  const best = runs.length ? Math.max(...runs.map(r => r.score || 0)) : -1;
  const fromSets = [];
  pool.forEach(p => { if (fromSets.indexOf(p.set.title) === -1) fromSets.push(p.set.title); });

  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="${meta.icon}"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">${escapeHTML(meta.name)}</h1>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="list" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Questions ready</em><strong>${pool.length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Runs</em><strong>${runs.length}</strong></span></div>
            ${best >= 0 ? `<div class="prog-stat"><i data-lucide="target" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Best</em><strong>${best}%</strong></span></div>` : ''}
          </div>
        </div>
      </div>

      <p class="prog-detail-desc">${escapeHTML(meta.hint)}</p>

      <div class="lang-rules">
        <div class="lang-rules-block">
          <h3><i data-lucide="list-ordered"></i> How to play</h3>
          <ol>${rules.how.map(h => `<li>${escapeHTML(h)}</li>`).join('')}</ol>
        </div>
        <div class="lang-rules-block">
          <h3><i data-lucide="trophy"></i> What counts as right</h3>
          <p>${escapeHTML(rules.wins)}</p>
          <h3 style="margin-top:0.85rem;"><i data-lucide="heart"></i> Hearts</h3>
          <p>Three. A wrong answer or a skip costs one; at zero the run ends there.</p>
        </div>
      </div>

      ${pool.length ? `
        <div class="prog-detail-actions" style="margin-top:1.25rem;">
          <button class="btn btn-practice btn-lg" onclick="langPromptTimer('type', '${meta.type}')">
            <i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Start attempt
          </button>
          <button class="btn btn-secondary" onclick="langStartType('${meta.type}', 0)">
            <i data-lucide="zap" style="width:16px;height:16px;"></i> Quick start (no timer)
          </button>
        </div>
        <p class="lang-form-hint" style="margin-top:0.75rem;">
          Drawn from ${fromSets.length} set${fromSets.length !== 1 ? 's' : ''}: ${escapeHTML(fromSets.slice(0, 4).join(', '))}${fromSets.length > 4 ? '…' : ''}
        </p>`
      : `
        <div class="lang-problems" style="margin-top:1.25rem;">
          <strong><i data-lucide="alert-triangle"></i> Nothing to practise yet</strong>
          <ul><li>No finished ${escapeHTML(meta.name.toLowerCase())} questions exist in any of your sets.</li></ul>
          <button class="btn btn-secondary btn-sm" style="margin-top:0.5rem;" onclick="spaNavigate('admin-language')">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> Write some in Admin
          </button>
        </div>`}
    </div>`;
}

/* ── Authored sets ────────────────────────────────────────── */

function langSetsHTML() {
  const sets = langSets();
  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="layers"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">Your drill sets</h1>
          <p class="prog-detail-desc" style="margin:0;">Run a set exactly as you wrote it, in its own order.</p>
        </div>
      </div>
      <div class="prog-variant-list" style="margin-top:1.25rem;">
        ${sets.map((s, i) => {
          const problems = langSetProblems(s);
          const best = langBestPct('set', s.id);
          return `
          <div class="prog-variant-row">
            <div class="prog-variant-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="prog-variant-info">
              <div class="prog-variant-name">${escapeHTML(s.title || 'Untitled set')}</div>
              <div class="prog-variant-meta">
                <span><i data-lucide="list" style="width:11px;height:11px;"></i> ${(s.items || []).length} question${(s.items || []).length !== 1 ? 's' : ''}</span>
                <span><i data-lucide="languages" style="width:11px;height:11px;"></i> ${escapeHTML(langShort(s.lang))} → ${escapeHTML(langShort(s.refLang))}</span>
                ${best >= 0 ? `<span><i data-lucide="target" style="width:11px;height:11px;"></i> best ${best}%</span>` : ''}
                ${problems.length ? `<span style="color:var(--color-warning);"><i data-lucide="alert-triangle" style="width:11px;height:11px;"></i> ${problems.length} to fix</span>` : ''}
              </div>
            </div>
            <button class="btn btn-practice btn-sm" onclick="langPromptTimer('set', '${s.id}')" ${problems.length ? 'disabled' : ''}>
              <i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Run
            </button>
          </div>`;
        }).join('') || '<div class="empty-state">No sets yet — write one in Language Admin.</div>'}
      </div>
    </div>`;
}

/* ── The run ──────────────────────────────────────────────── */

function langRunHTML() {
  const blocker = langRunBlocker();
  const runs = (state.langHistory || []).filter(h => h.kind === 'run');
  const bestDist = runs.length ? Math.max(...runs.map(r => r.steps || 0)) : 0;
  const bestBeat = runs.length ? Math.max(...runs.map(r => r.defeated || 0)) : 0;
  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="footprints"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">Free run</h1>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="flame" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Stamina</em><strong>${LANG_RUN_STAMINA}</strong></span></div>
            <div class="prog-stat"><i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Runs</em><strong>${runs.length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="signpost" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Furthest</em><strong>${bestDist}</strong></span></div>
            <div class="prog-stat"><i data-lucide="swords" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Most beaten</em><strong>${bestBeat}</strong></span></div>
          </div>
        </div>
      </div>

      <div class="lang-rules">
        <div class="lang-rules-block">
          <h3><i data-lucide="list-ordered"></i> How it goes</h3>
          <ol>
            <li>You start with ${LANG_RUN_STAMINA} stamina. Stamina is your health.</li>
            <li>Choose <strong>Run</strong> to walk on. Each leg costs ${LANG_RUN_STEP_COST} stamina.</li>
            <li>Sooner or later somebody stops you, and they speak first.</li>
            <li>Reply well and you take no damage and get some stamina back. Reply badly and it drains.</li>
            <li>Beat them and your <em>maximum</em> stamina rises by ${LANG_RUN_STAMINA_GAIN}.</li>
            <li>Choose <strong>Go home</strong> whenever you like — that ends the run and keeps the score.</li>
          </ol>
        </div>
        <div class="lang-rules-block">
          <h3><i data-lucide="sparkles"></i> Power gauge</h3>
          <p>Fills as you answer well. Spend it on:</p>
          <ul class="lang-powerlist">
            ${LANG_POWERUPS.map(p => `<li><i data-lucide="${p.icon}"></i> <strong>${escapeHTML(p.name)}</strong> <span>${p.cost}</span> — ${escapeHTML(p.desc)}</li>`).join('')}
          </ul>
          <h3 style="margin-top:0.85rem;"><i data-lucide="flask-round"></i> Potions</h3>
          <p>${LANG_POTIONS.map(p => escapeHTML(p.name) + ' (+' + p.heal + ')').join(', ')} — you set off with one of each.</p>
        </div>
      </div>

      ${blocker ? `
        <div class="lang-problems" style="margin-top:1.25rem;">
          <strong><i data-lucide="alert-triangle"></i> Not enough to run on</strong>
          <ul><li>${escapeHTML(blocker)}</li></ul>
          <button class="btn btn-secondary btn-sm" style="margin-top:0.5rem;" onclick="spaNavigate('admin-language')">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> Add some in Admin
          </button>
        </div>`
      : `<div class="prog-detail-actions" style="margin-top:1.25rem;">
          <button class="btn btn-practice btn-lg" onclick="langStartRun()">
            <i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Set off
          </button>
        </div>`}

      <div class="lang-placeholder-note">
        <i data-lucide="construction"></i>
        <div>
          <strong>Placeholder art</strong>
          <span>The battle, stamina, power gauge and encounters all run for real. Backdrops and sprites are stand-ins.</span>
        </div>
      </div>
    </div>`;
}

function langScenariosHTML() {
  const list = langScenarios();
  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="map"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">Scenarios</h1>
          <p class="prog-detail-desc" style="margin:0;">The encounters you have written. A run draws its opponents from these.</p>
        </div>
      </div>
      <div class="prog-variant-list" style="margin-top:1.25rem;">
        ${list.map((s, i) => {
          const loc = langLocation(s.location);
          const ready = (s.encounters || []).some(e => (e.line || '').trim() && (e.options || []).some(o => (o.text || '').trim() && o.correct));
          return `
          <div class="prog-variant-row">
            <div class="prog-variant-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="prog-variant-info">
              <div class="prog-variant-name">${escapeHTML(s.title || 'Untitled')}</div>
              <div class="prog-variant-meta">
                <span><i data-lucide="${loc.icon}" style="width:11px;height:11px;"></i> ${escapeHTML(loc.name)}</span>
                <span><i data-lucide="user" style="width:11px;height:11px;"></i> ${escapeHTML(s.npc || 'Someone')}</span>
                <span><i data-lucide="messages-square" style="width:11px;height:11px;"></i> ${(s.encounters || []).length}</span>
                ${ready ? '' : '<span style="color:var(--color-warning);"><i data-lucide="alert-triangle" style="width:11px;height:11px;"></i> unfinished</span>'}
              </div>
            </div>
            <button class="btn btn-practice btn-sm" onclick="langStartScenario('${s.id}')" ${ready ? '' : 'disabled'}>
              <i data-lucide="swords" style="width:14px;height:14px;"></i> Fight
            </button>
          </div>`;
        }).join('') || '<div class="empty-state">No scenarios yet — write one in Language Admin.</div>'}
      </div>
    </div>`;
}

/* ── Starting things ──────────────────────────────────────── */

/** Reuses the app's shared timer modal, the way the notebooks do. */
let _langPending = null;

function langPromptTimer(kind, id) {
  _langPending = { kind, id };
  const modal = document.getElementById('timer-modal');
  if (!modal) { langConfirmStart(); return; }
  const sel = document.getElementById('timer-variant-select');
  if (sel && sel.closest('div')) sel.closest('div').style.display = 'none';
  const t = modal.querySelector('.modal-title');
  const d = modal.querySelector('.modal-desc');
  if (t) t.textContent = 'Start drill';
  if (d) d.textContent = 'Set an optional time limit (0 for untimed).';
  ['timer-h', 'timer-m', 'timer-s'].forEach(x => { const el = document.getElementById(x); if (el) el.value = '0'; });
  const btn = modal.querySelector('.modal-actions .btn-primary');
  if (btn) btn.setAttribute('onclick', 'langConfirmStart()');
  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal });
}

function langConfirmStart() {
  const modal = document.getElementById('timer-modal');
  const num = (id) => Math.max(0, parseInt((document.getElementById(id) || {}).value, 10) || 0);
  const secs = num('timer-h') * 3600 + num('timer-m') * 60 + num('timer-s');
  if (modal) modal.classList.add('hidden');
  const p = _langPending;
  _langPending = null;
  if (!p) return;
  if (p.kind === 'set') langStartSet(p.id, secs);
  else langStartType(p.id, secs);
}

function langStartSet(id, secs) {
  setSessionParam('langRunSet', id);
  setSessionParam('langRunType', null);
  setSessionParam('langTimeLimit', secs || 0);
  langGo('lang-attempt');
}

function langStartType(type, secs) {
  setSessionParam('langRunType', type);
  setSessionParam('langRunSet', null);
  setSessionParam('langTimeLimit', secs || 0);
  langGo('lang-attempt');
}

/**
 * Go to a route that may be the one already on screen.
 *
 * spaNavigate only assigns location.hash, and assigning the hash it already
 * holds fires no hashchange — so the router never re-runs and the session
 * params just set are never read. Both game modes share one route, so
 * starting a scenario from inside a run would otherwise do nothing at all.
 */
function langGo(route) {
  if (document.body.dataset.route === route) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else spaNavigate(route);
}

function langStartScenario(id) {
  setSessionParam('langRunScenario', id);
  setSessionParam('langRunMode', 'scenario');
  langGo('lang-quest');
}

function langStartRun() {
  setSessionParam('langRunScenario', null);
  setSessionParam('langRunMode', 'run');
  langGo('lang-quest');
}

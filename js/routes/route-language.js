/* ============================================================
   ROUTE-LANGUAGE.JS — the Language Library
   ------------------------------------------------------------
   Two panes, like the other libraries: the word list on the left, the entry
   on the right. What is different is the language pair in the header — every
   view below it is drawn from "the one I am learning" and "the one I am
   comparing against", and switching either redraws the page rather than
   navigating anywhere.
   ============================================================ */

let langActiveWordId = null;
let langQuery = '';
let langTagFilter = null;
let langTab = 'words';   // words | drills | scenarios

function languageTemplate() {
  return `
    <div class="messenger-layout" id="lang-lib-root">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display:flex; align-items:center; gap:0.5rem; width:100%; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
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
                  <span class="section-header-subtitle" id="lang-header-stats">0 words</span>
                </span>
              </h2>
            </div>
          </div>
          <div class="search-container search-animated" style="width:100%;">
            <i data-lucide="search"></i>
            <input type="text" id="lang-search" class="search-input" autocomplete="off"
                   placeholder="Search every language…" oninput="langOnSearch(this.value)" />
          </div>
          <div id="lang-pair-bar"></div>
        </div>
        <div class="pane-1-content" id="lang-list"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="lang-detail" style="padding:2rem; min-height:100%;"></div>
      </section>
    </div>`;
}

function languageInit() {
  langStore();
  const target = getSessionParam('langActiveWord');
  langActiveWordId = target && langFindWord(target) ? target : null;
  langTab = getSessionParam('langTab') || 'words';
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

function langOnSearch(v) {
  langQuery = (v || '').trim();
  renderLangList();
}

function langSelectWord(id) {
  langActiveWordId = id;
  setSessionParam('langActiveWord', id);
  renderLangLibrary();
}

function langSetTab(tab) {
  langTab = tab;
  setSessionParam('langTab', tab);
  langActiveWordId = tab === 'words' ? langActiveWordId : null;
  renderLangLibrary();
}

function langToggleTagFilter(tag) {
  langTagFilter = langTagFilter === tag ? null : tag;
  renderLangList();
}

/* ── Render ───────────────────────────────────────────────── */

function renderLangLibrary() {
  const bar = document.getElementById('lang-pair-bar');
  if (bar) bar.innerHTML = langPairBarHTML();
  renderLangList();
  renderLangDetail();
  const stats = document.getElementById('lang-header-stats');
  if (stats) {
    const n = langWords().length, sets = langSets().length, sc = langScenarios().length;
    stats.textContent = `${n} word${n !== 1 ? 's' : ''} · ${sets} drill${sets !== 1 ? 's' : ''} · ${sc} scenario${sc !== 1 ? 's' : ''}`;
  }
  const root = document.getElementById('lang-lib-root');
  if (typeof lucide !== 'undefined' && root) lucide.createIcons({ root });
}

function renderLangList() {
  const host = document.getElementById('lang-list');
  if (!host) return;
  const study = langStudy(), ref = langRef();

  const tabs = `
    <div class="lang-tabs">
      ${[['words', 'Words', 'book-a'], ['drills', 'Drills', 'dumbbell'], ['scenarios', 'Scenarios', 'swords']]
        .map(([k, label, icon]) => `
        <button class="lang-tab${langTab === k ? ' is-active' : ''}" type="button" onclick="langSetTab('${k}')">
          <i data-lucide="${icon}"></i> ${label}
        </button>`).join('')}
    </div>`;

  if (langTab === 'drills') { host.innerHTML = tabs + langDrillListHTML(); if (typeof lucide !== 'undefined') lucide.createIcons({ root: host }); return; }
  if (langTab === 'scenarios') { host.innerHTML = tabs + langScenarioListHTML(); if (typeof lucide !== 'undefined') lucide.createIcons({ root: host }); return; }

  let words = langWords().filter(w => langMatches(w, langQuery));
  if (langTagFilter) words = words.filter(w => (w.tags || []).includes(langTagFilter));
  words = words.slice().sort((a, b) =>
    langHeadword(a, study).localeCompare(langHeadword(b, study), undefined, { sensitivity: 'base' }));

  const tags = langAllTags();
  const tagBar = tags.length ? `
    <div class="lang-tagbar">
      ${tags.map(t => `
        <button class="lang-tag-chip${langTagFilter === t.tag ? ' is-active' : ''}" type="button"
                onclick="langToggleTagFilter('${escapeHTML(t.tag).replace(/'/g, "\\'")}')">
          ${escapeHTML(t.tag)} <span>${t.count}</span>
        </button>`).join('')}
    </div>` : '';

  const rows = words.map(w => {
    const head = langHeadword(w, study);
    const gloss = (w.forms[ref] && w.forms[ref].term) || '';
    const filled = langFilledCount(w);
    return `
      <button class="lang-row${langActiveWordId === w.id ? ' is-active' : ''}" type="button"
              onclick="langSelectWord('${w.id}')">
        <span class="lang-row-main">
          <span class="lang-row-term">${escapeHTML(head)}</span>
          ${gloss ? `<span class="lang-row-gloss">${escapeHTML(gloss)}</span>` : ''}
        </span>
        <span class="lang-row-meta">
          ${(w.forms[study] && w.forms[study].pos) ? `<span class="lang-pos">${escapeHTML(w.forms[study].pos)}</span>` : ''}
          <span class="lang-fill" title="${filled} of ${LANG_CODES.length} languages filled in">${filled}/${LANG_CODES.length}</span>
        </span>
      </button>`;
  }).join('');

  host.innerHTML = tabs + tagBar + `
    <div class="lang-list-actions">
      <button class="btn btn-primary btn-sm" type="button" onclick="langNewWordInline()">
        <i data-lucide="plus" style="width:14px;height:14px;"></i> New word
      </button>
    </div>
    <div class="lang-rows">${rows || `<div class="lang-empty">${langQuery || langTagFilter ? 'No words match.' : 'No words yet — add your first.'}</div>`}</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/** Quick-add straight from the library: type a term, edit the rest after. */
function langNewWordInline() {
  const study = langStudy();
  showInputDialog('New word', `The ${langName(study)} term — you can fill in the other languages next.`,
    'e.g. kinsa', '', (val) => {
      const term = (val || '').trim();
      if (!term) return;
      const w = langBlankWord();
      w.forms[study].term = term;
      const saved = langSaveWord(w);
      if (saved) {
        langActiveWordId = saved.id;
        setSessionParam('langActiveWord', saved.id);
        renderLangLibrary();
        if (typeof toast === 'function') toast('Word added — fill in its meaning below.', { type: 'success' });
      }
    });
}

/* ── The word entry, side by side ─────────────────────────── */

function renderLangDetail() {
  const host = document.getElementById('lang-detail');
  if (!host) return;

  if (langTab === 'drills') { host.innerHTML = langDrillDetailHTML(); if (typeof lucide !== 'undefined') lucide.createIcons({ root: host }); return; }
  if (langTab === 'scenarios') { host.innerHTML = langScenarioDetailHTML(); if (typeof lucide !== 'undefined') lucide.createIcons({ root: host }); return; }

  const w = langActiveWordId ? langFindWord(langActiveWordId) : null;
  if (!w) {
    host.innerHTML = `
      <div class="empty-state" style="height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column;">
        <div class="empty-state-icon-animated">
          <i data-lucide="book-a" style="width:48px;height:48px;opacity:0.5;"></i>
          <div class="empty-state-pulse-ring"></div>
        </div>
        <h2>Pick a word</h2>
        <p style="font-size:0.875rem; color:var(--text-tertiary); margin-top:0.5rem;">
          Choose one on the left, or add a new one.
        </p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
    return;
  }

  const study = langStudy(), ref = langRef();
  const due = typeof agDeadlineTextHTML === 'function' ? agDeadlineTextHTML('langword', w.id) : '';

  host.innerHTML = `
    <div class="animate-fade-in prog-detail lang-detail">
      <nav class="breadcrumb-nav">
        <button class="btn-back-dark browse-back-btn" onclick="langSelectWord(null)" title="Back">
          <i data-lucide="chevron-left" style="width:15px;height:15px;"></i> Back
        </button>
        <button class="breadcrumb-item" onclick="spaNavigate('library')"><i data-lucide="home" style="width:12px;height:12px;"></i></button>
        <span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>
        <span class="breadcrumb-current">${escapeHTML(langHeadword(w, study))}</span>
      </nav>

      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="book-a"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">${escapeHTML(langHeadword(w, study))}</h1>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="languages" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Filled in</em><strong>${langFilledCount(w)}/${LANG_CODES.length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="quote" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Examples</em><strong>${LANG_CODES.reduce((n, c) => n + (w.forms[c].examples || []).length, 0)}</strong></span></div>
          </div>
          ${(w.tags || []).length ? `<div class="prog-tags"><i data-lucide="tag" style="width:12px;height:12px;"></i>
            ${(w.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
        </div>
        ${due ? `<div class="prog-detail-due">${due}</div>` : ''}
      </div>

      <div class="prog-detail-actions">
        <button class="btn btn-practice" onclick="langEditWord('${w.id}')">
          <i data-lucide="pencil" style="width:16px;height:16px;"></i> Edit entry
        </button>
        <button class="btn btn-secondary" onclick="agOpenDeadlineModal('langword', '${w.id}')">
          <i data-lucide="flag" style="width:16px;height:16px;"></i> ${due ? 'Deadline' : 'Set Deadline'}
        </button>
        <button class="btn btn-ghost ag-danger-btn" onclick="langConfirmDeleteWord('${w.id}')">
          <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Delete
        </button>
      </div>

      <div class="divider"></div>

      <h2 class="prog-detail-section-title"><i data-lucide="columns-2"></i> ${escapeHTML(langName(study))} vs ${escapeHTML(langName(ref))}</h2>
      <div class="lang-compare">
        ${langFormColumnHTML(w, study, true)}
        ${langFormColumnHTML(w, ref, false)}
      </div>

      ${langOtherLangsHTML(w, [study, ref])}
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function langFormColumnHTML(w, code, isStudy) {
  const f = w.forms[code] || langBlankForm();
  const empty = !(f.term || '').trim();
  return `
    <div class="lang-col${isStudy ? ' is-study' : ''}${empty ? ' is-empty' : ''}">
      <div class="lang-col-head">
        <span class="lang-col-code">${escapeHTML(langShort(code))}</span>
        <span class="lang-col-name">${escapeHTML(langName(code))}</span>
        ${isStudy ? '<span class="lang-col-role">learning</span>' : '<span class="lang-col-role">reference</span>'}
      </div>
      ${empty ? `<div class="lang-col-empty">Nothing recorded in ${escapeHTML(langName(code))} yet.</div>` : `
        <div class="lang-term">${escapeHTML(f.term)}${f.pos ? `<span class="lang-pos">${escapeHTML(f.pos)}</span>` : ''}</div>
        ${f.definition ? `<p class="lang-def">${escapeHTML(f.definition)}</p>` : ''}
        ${(f.examples || []).length ? `
          <div class="lang-block">
            <h4><i data-lucide="quote"></i> Examples</h4>
            <ul class="lang-examples">
              ${f.examples.map(e => `
                <li>
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

/** The two languages not currently in the pair, collapsed to a summary row. */
function langOtherLangsHTML(w, shown) {
  const rest = LANG_CODES.filter(c => shown.indexOf(c) === -1);
  const filled = rest.filter(c => (w.forms[c].term || '').trim());
  if (!filled.length) return '';
  return `
    <h2 class="prog-detail-section-title" style="margin-top:1.75rem;"><i data-lucide="languages"></i> Also recorded</h2>
    <div class="lang-other-row">
      ${filled.map(c => `
        <button class="lang-other" type="button" onclick="langSetStudy('${c}')" title="Switch to ${escapeHTML(langName(c))}">
          <span class="lang-col-code">${escapeHTML(langShort(c))}</span>
          <span class="lang-other-term">${escapeHTML(w.forms[c].term)}</span>
          ${w.forms[c].definition ? `<span class="lang-other-def">${escapeHTML(w.forms[c].definition.slice(0, 70))}</span>` : ''}
        </button>`).join('')}
    </div>`;
}

function langConfirmDeleteWord(id) {
  const w = langFindWord(id);
  if (!w) return;
  showConfirm('Delete word?', `Delete "${langHeadword(w)}" and everything recorded under it? You can undo this.`, () => {
    langDeleteWord(id);
    langActiveWordId = null;
    setSessionParam('langActiveWord', null);
    renderLangLibrary();
  });
}

/** Jump to the admin form for this word. */
function langEditWord(id) {
  setSessionParam('langAdminWord', id);
  setSessionParam('langAdminTab', 'words');
  spaNavigate('admin-language');
}

/* ── Drills tab ───────────────────────────────────────────── */

function langDrillListHTML() {
  const sets = langSets();
  const rows = sets.map(s => {
    const best = langBestPct('set', s.id);
    const problems = langSetProblems(s);
    return `
      <button class="lang-row" type="button" onclick="langOpenSet('${s.id}')">
        <span class="lang-row-main">
          <span class="lang-row-term">${escapeHTML(s.title || 'Untitled set')}</span>
          <span class="lang-row-gloss">${(s.items || []).length} question${(s.items || []).length !== 1 ? 's' : ''} · ${escapeHTML(langShort(s.lang))} → ${escapeHTML(langShort(s.refLang))}</span>
        </span>
        <span class="lang-row-meta">
          ${problems.length ? '<span class="lang-warn" title="Not ready to run"><i data-lucide="alert-triangle"></i></span>' : ''}
          ${best >= 0 ? `<span class="lang-fill">${best}%</span>` : ''}
        </span>
      </button>`;
  }).join('');
  return `
    <div class="lang-list-actions">
      <button class="btn btn-primary btn-sm" type="button" onclick="langGoAdmin('sets')">
        <i data-lucide="plus" style="width:14px;height:14px;"></i> New drill set
      </button>
    </div>
    <div class="lang-rows">${rows || '<div class="lang-empty">No drill sets yet — build one in Admin.</div>'}</div>`;
}

let langActiveSetId = null;
function langOpenSet(id) { langActiveSetId = id; renderLangDetail(); }

function langDrillDetailHTML() {
  const s = langActiveSetId ? langFindSet(langActiveSetId) : null;
  if (!s) return langPickPrompt('dumbbell', 'Pick a drill set', 'Choose a set on the left, or build one in Admin.');
  const problems = langSetProblems(s);
  const best = langBestPct('set', s.id);
  const runs = langHistoryFor('set', s.id).length;
  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="dumbbell"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">${escapeHTML(s.title || 'Untitled set')}</h1>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="list" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Questions</em><strong>${(s.items || []).length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Runs</em><strong>${runs}</strong></span></div>
            ${best >= 0 ? `<div class="prog-stat"><i data-lucide="target" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Best</em><strong>${best}%</strong></span></div>` : ''}
            <div class="prog-stat"><i data-lucide="languages" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Pair</em><strong>${escapeHTML(langShort(s.lang))} → ${escapeHTML(langShort(s.refLang))}</strong></span></div>
          </div>
        </div>
      </div>
      ${s.description ? `<p class="prog-detail-desc">${escapeHTML(s.description)}</p>` : ''}
      ${problems.length ? `
        <div class="lang-problems">
          <strong><i data-lucide="alert-triangle"></i> Not ready to run</strong>
          <ul>${problems.map(p => `<li>${escapeHTML(p)}</li>`).join('')}</ul>
        </div>` : ''}
      <div class="prog-detail-actions">
        <button class="btn btn-practice btn-lg" onclick="langStartSet('${s.id}')" ${problems.length ? 'disabled' : ''}>
          <i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Start drill
        </button>
        <button class="btn btn-secondary" onclick="langGoAdmin('sets','${s.id}')">
          <i data-lucide="pencil" style="width:16px;height:16px;"></i> Edit set
        </button>
      </div>
      <div class="divider"></div>
      <h2 class="prog-detail-section-title"><i data-lucide="list"></i> Questions</h2>
      <div class="prog-variant-list">
        ${(s.items || []).map((it, i) => {
          const meta = langPuzzleMeta(it.type);
          return `
          <div class="prog-variant-row">
            <div class="prog-variant-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="prog-variant-info">
              <div class="prog-variant-name">${escapeHTML(it.prompt || it.answer || '(empty)')}</div>
              <div class="prog-variant-meta"><span><i data-lucide="${meta.icon}" style="width:11px;height:11px;"></i> ${escapeHTML(meta.name)}</span></div>
            </div>
          </div>`;
        }).join('') || '<div class="empty-state">No questions yet.</div>'}
      </div>
    </div>`;
}

/* ── Scenarios tab ────────────────────────────────────────── */

function langScenarioListHTML() {
  const rows = langScenarios().map(s => {
    const loc = langLocation(s.location);
    return `
      <button class="lang-row" type="button" onclick="langOpenScenario('${s.id}')">
        <span class="lang-row-main">
          <span class="lang-row-term">${escapeHTML(s.title || 'Untitled scenario')}</span>
          <span class="lang-row-gloss">${escapeHTML(loc.name)} · ${(s.encounters || []).length} encounter${(s.encounters || []).length !== 1 ? 's' : ''}</span>
        </span>
        <span class="lang-row-meta"><i data-lucide="${loc.icon}"></i></span>
      </button>`;
  }).join('');
  return `
    <div class="lang-list-actions">
      <button class="btn btn-primary btn-sm" type="button" onclick="langGoAdmin('scenarios')">
        <i data-lucide="plus" style="width:14px;height:14px;"></i> New scenario
      </button>
    </div>
    <div class="lang-rows">${rows || '<div class="lang-empty">No scenarios yet — write one in Admin.</div>'}</div>`;
}

let langActiveScenarioId = null;
function langOpenScenario(id) { langActiveScenarioId = id; renderLangDetail(); }

function langScenarioDetailHTML() {
  const s = langActiveScenarioId ? langFindScenario(langActiveScenarioId) : null;
  if (!s) return langPickPrompt('swords', 'Pick a scenario', 'Choose one on the left, or write one in Admin.');
  const loc = langLocation(s.location);
  const ready = (s.encounters || []).length > 0;
  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="${loc.icon}"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">${escapeHTML(s.title || 'Untitled scenario')}</h1>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="map-pin" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Location</em><strong>${escapeHTML(loc.name)}</strong></span></div>
            <div class="prog-stat"><i data-lucide="user" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Opponent</em><strong>${escapeHTML(s.npc || 'Someone')}</strong></span></div>
            <div class="prog-stat"><i data-lucide="messages-square" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Encounters</em><strong>${(s.encounters || []).length}</strong></span></div>
          </div>
        </div>
      </div>
      <div class="prog-detail-actions">
        <button class="btn btn-practice btn-lg" onclick="langStartScenario('${s.id}')" ${ready ? '' : 'disabled'}>
          <i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Enter scenario
        </button>
        <button class="btn btn-secondary" onclick="langGoAdmin('scenarios','${s.id}')">
          <i data-lucide="pencil" style="width:16px;height:16px;"></i> Edit scenario
        </button>
      </div>
      <div class="lang-placeholder-note">
        <i data-lucide="construction"></i>
        <div>
          <strong>Placeholder art</strong>
          <span>The battle runs and scores for real. Locations, sprites and the inventory are stand-ins for now.</span>
        </div>
      </div>
    </div>`;
}

function langPickPrompt(icon, title, sub) {
  return `
    <div class="empty-state" style="height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column;">
      <div class="empty-state-icon-animated">
        <i data-lucide="${icon}" style="width:48px;height:48px;opacity:0.5;"></i>
        <div class="empty-state-pulse-ring"></div>
      </div>
      <h2>${escapeHTML(title)}</h2>
      <p style="font-size:0.875rem; color:var(--text-tertiary); margin-top:0.5rem;">${escapeHTML(sub)}</p>
    </div>`;
}

function langGoAdmin(tab, id) {
  setSessionParam('langAdminTab', tab || 'words');
  if (id) setSessionParam('langAdminEdit', id);
  else setSessionParam('langAdminEdit', null);
  spaNavigate('admin-language');
}

function langStartSet(id) {
  setSessionParam('langRunSet', id);
  spaNavigate('lang-attempt');
}

function langStartScenario(id) {
  setSessionParam('langRunScenario', id);
  spaNavigate('lang-quest');
}

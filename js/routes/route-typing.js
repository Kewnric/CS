/* ============================================================
   ROUTE-TYPING.JS — the Memorization Typing Library
   ------------------------------------------------------------
   Pane 1 is a board of filters — everything, prose, code, and each of the
   four languages — plus the ways in that are not an entry (a quick test,
   custom text) and your results. Pane 2 is the list for whichever card is
   open: numbered rows with a deadline flag and a Run button.

   Nothing here writes entries. They are written in Memorization Typing
   Admin and only read from the library, the same split the Language Library
   keeps: two places to edit one record is how they drift apart.
   ============================================================ */

let mtlView = 'all';        // all | text | code | c | html | css | js | results
let mtlQuery = '';
let mtlOpenPreview = null;  // the entry whose preview is unfolded

function typingTemplate() {
  return `
    <div class="messenger-layout" id="mtl-root">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display:flex; align-items:center; gap:0.5rem; width:100%;">
            <button onclick="spaNavigate('library')" class="btn-back-dark" style="margin-right:0.5rem; padding:0.25rem 0.5rem; font-size:0.75rem; flex-shrink:0;">
              <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
            </button>
            <h1 class="section-header-animated" style="margin:0; display:flex; align-items:center;">
              <span class="section-header-icon-wrap">
                <i data-lucide="keyboard"></i>
                <span class="section-header-icon-ring"></span>
              </span>
              <span class="section-header-text">
                <span class="section-header-title">Memorization Typing</span>
                <span class="section-header-subtitle" id="mtl-header-stats"></span>
              </span>
            </h1>
            <button class="ag-icon-btn lang-admin-btn" type="button"
                    onclick="spaNavigate('admin-typing')"
                    title="Manage in Admin — write entries to type"
                    aria-label="Manage in Admin">
              <i data-lucide="settings"></i>
            </button>
          </div>
        </div>
        <div class="pane-1-content" id="mtl-board"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="mtl-detail" style="padding:2rem; min-height:100%;"></div>
      </section>
    </div>`;
}

function typingInit() {
  mtStore();
  mtlView = getSessionParam('mtlView') || 'all';
  mtlQuery = '';
  mtlOpenPreview = null;
  renderTypingLibrary();
}

function typingDestroy() { mtlOpenPreview = null; }

function mtlOpen(view) {
  mtlView = view;
  mtlOpenPreview = null;
  setSessionParam('mtlView', view);
  renderTypingLibrary();
}

function renderTypingLibrary() {
  mtlRenderBoard();
  mtlRenderDetail();
  const stats = document.getElementById('mtl-header-stats');
  if (stats) {
    const n = mtItems().length;
    const tests = mtHistory().length;
    stats.textContent = `${n} entr${n === 1 ? 'y' : 'ies'} · ${tests} test${tests === 1 ? '' : 's'} typed`;
  }
  const root = document.getElementById('mtl-root');
  if (typeof lucide !== 'undefined' && root) lucide.createIcons({ root });
}

/** Entries for one board card. */
function mtlFiltered(view) {
  return mtItems().filter(it => {
    if (view === 'text') return it.kind === 'text';
    if (view === 'code') return it.kind === 'code';
    if (MT_LANGS.some(l => l.key === view)) return it.kind === 'code' && it.lang === view;
    return true;
  });
}

function mtlCard(view, icon, name, desc, chip, extra) {
  const active = mtlView === view;
  return `
    <button class="lang-card${active ? ' is-active' : ''}${chip === '0' && !extra ? ' is-empty' : ''}${extra ? ' ' + extra : ''}" type="button" onclick="mtlOpen('${view}')">
      <span class="lang-card-icon"><i data-lucide="${icon}"></i></span>
      <span class="lang-card-body">
        <span class="lang-card-name">${escapeHTML(name)}</span>
        <span class="lang-card-desc">${escapeHTML(desc)}</span>
      </span>
      ${chip !== '' ? `<span class="lang-card-chip">${chip}</span>` : ''}
    </button>`;
}

function mtlActionCard(onclick, icon, name, desc) {
  return `
    <button class="lang-card" type="button" onclick="${onclick}">
      <span class="lang-card-icon"><i data-lucide="${icon}"></i></span>
      <span class="lang-card-body">
        <span class="lang-card-name">${escapeHTML(name)}</span>
        <span class="lang-card-desc">${escapeHTML(desc)}</span>
      </span>
      <i data-lucide="arrow-up-right" class="mtl-card-go"></i>
    </button>`;
}

function mtlRenderBoard() {
  const host = document.getElementById('mtl-board');
  if (!host) return;
  const count = (v) => String(mtlFiltered(v).length);
  host.innerHTML = `
    <div class="lang-board">
      <div class="mtl-board-title"><i data-lucide="library-big"></i> Entries</div>
      ${mtlCard('all', 'layers', 'Everything', 'Every entry, prose and code.', count('all'))}
      ${mtlCard('text', 'file-text', 'Text', 'Paragraphs, definitions, anything in words.', count('text'))}
      ${mtlCard('code', 'code-2', 'Code', 'Snippets and whole programs.', count('code'))}

      <div class="mtl-board-title"><i data-lucide="braces"></i> Code by language</div>
      ${MT_LANGS.map(l => {
        // a card reading 0 while its code sits under Text says why
        const stray = mtMisfiled(l.key).length;
        const desc = stray && !mtlFiltered(l.key).length
          ? `${stray} Text entr${stray === 1 ? 'y looks' : 'ies look'} like ${l.name} — open to convert`
          : 'Highlighted, indented and auto-closed as ' + l.name + '.';
        return mtlCard(l.key, l.icon, l.name, desc, count(l.key), stray ? 'has-stray' : '');
      }).join('')}

      <div class="mtl-board-title"><i data-lucide="zap"></i> Practice</div>
      ${mtlActionCard("mtlQuickTest()", 'keyboard', 'Quick test', 'Straight into a test with your last settings.')}
      ${mtlActionCard("mtlCustomTest()", 'wrench', 'Custom text', 'Paste anything and type it, without saving it.')}
      ${mtlCard('results', 'line-chart', 'Your results', 'Every test you have finished, best first or latest first.', String(mtHistory().length))}
    </div>
    <div class="lang-board-foot">
      <span class="lang-board-hint">Entries are written in Admin.</span>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function mtlViewMeta(view) {
  if (view === 'text') return { icon: 'file-text', title: 'Text', desc: 'Type it until your fingers know it.' };
  if (view === 'code') return { icon: 'code-2', title: 'Code', desc: 'Every snippet and program, in every language.' };
  const lang = MT_LANGS.find(l => l.key === view);
  if (lang) return { icon: lang.icon, title: lang.name, desc: 'Highlighted the way your editor shows it, with its own indentation and closers.' };
  return { icon: 'layers', title: 'Everything', desc: 'Pick one and press Run. The ghost text is what you type over.' };
}

function mtlRenderDetail() {
  const host = document.getElementById('mtl-detail');
  if (!host) return;
  host.innerHTML = mtlView === 'results' ? mtlResultsHTML() : mtlListHTML();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function mtlSetQuery(v) {
  mtlQuery = v || '';
  const list = document.getElementById('mtl-list');
  if (!list) return;
  list.innerHTML = mtlRowsHTML();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
}

/**
 * On a code card: the Text entries that look like this kind of code. They
 * are almost always code pasted under New text, and from here they are one
 * press from being where they belong.
 */
function mtlStrayHTML() {
  const isCode = mtlView === 'code' || MT_LANGS.some(l => l.key === mtlView);
  if (!isCode) return '';
  const stray = mtMisfiled(mtlView === 'code' ? null : mtlView);
  if (!stray.length) return '';
  return `
    <div class="mtl-strays">
      <div class="mtl-strays-head">
        <i data-lucide="triangle-alert"></i>
        <div>
          <strong>${stray.length} entr${stray.length === 1 ? 'y was' : 'ies were'} saved as Text but ${stray.length === 1 ? 'looks' : 'look'} like code</strong>
          <span>As text it types like a paragraph: no colours, no auto indent, no auto close, three-to-five lines at a time. Make it code to fix that.</span>
        </div>
      </div>
      ${stray.map(it => {
        const g = mtGuessLang(it.content);
        return `
        <div class="mtl-stray-row">
          <span class="mtl-stray-title"><i data-lucide="file-text" style="width:13px;height:13px;"></i> ${escapeHTML(it.title || 'Untitled')}</span>
          <button class="btn btn-primary btn-sm" type="button" onclick="mtlConvert('${it.id}', '${g}')">
            <i data-lucide="${mtLangMeta(g).icon}" style="width:14px;height:14px;"></i> Make it ${escapeHTML(mtLangMeta(g).name)}
          </button>
        </div>`;
      }).join('')}
    </div>`;
}

/** Convert a Text entry to Code where it stands, and show it under its language. */
function mtlConvert(id, lang) {
  const it = mtConvertToCode(id, lang);
  if (!it) return;
  if (typeof toast === 'function') toast(`"${it.title || 'Untitled'}" is now a ${mtLangMeta(it.lang).name} code entry.`, { type: 'success' });
  // on a text-only card the row would vanish; follow it to its language instead
  if (mtlView === 'text') mtlView = it.lang;
  setSessionParam('mtlView', mtlView);
  renderTypingLibrary();
}

function mtlRowsHTML() {
  const q = mtlQuery.trim().toLowerCase();
  const items = mtlFiltered(mtlView).filter(it => !q
    || (it.title || '').toLowerCase().includes(q)
    || (it.tags || []).some(t => t.toLowerCase().includes(q))
    || (it.content || '').toLowerCase().includes(q));
  const stray = q ? '' : mtlStrayHTML();
  if (!items.length) {
    if (q) return `<div class="mtl-empty"><i data-lucide="search-x"></i> Nothing matches “${escapeHTML(mtlQuery)}”.</div>`;
    if (stray) return stray;
    return `
      <div class="mtl-empty">
        <i data-lucide="keyboard"></i>
        <div>
          <strong>Nothing to type here yet</strong>
          <span>Write an entry in Admin — paste a paragraph or a piece of code — and it appears here with a Run button.</span>
        </div>
        <button class="btn btn-primary btn-sm" type="button" onclick="spaNavigate('admin-typing')">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> Add an entry
        </button>
      </div>`;
  }
  return stray + items.map((it, i) => {
    const sz = mtItemSize(it);
    const best = mtBestFor(it.id);
    const runs = mtResultsFor(it.id).length;
    const kindLabel = it.kind === 'code' ? mtLangMeta(it.lang).short : 'TEXT';
    const kindIcon = it.kind === 'code' ? mtLangMeta(it.lang).icon : 'file-text';
    const open = mtlOpenPreview === it.id;
    const guess = it.kind === 'text' ? mtGuessLang(it.content) : null;
    return `
      <div class="prog-variant-row mtl-row${open ? ' is-open' : ''}">
        <div class="prog-variant-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="prog-variant-info">
          <div class="prog-variant-name">${escapeHTML(it.title || 'Untitled')}</div>
          <div class="prog-variant-meta">
            <span><i data-lucide="${kindIcon}" style="width:11px;height:11px;"></i> ${escapeHTML(kindLabel)}</span>
            <span><i data-lucide="list" style="width:11px;height:11px;"></i> ${it.kind === 'code'
              ? sz.lines + ' line' + (sz.lines !== 1 ? 's' : '')
              : sz.words + ' word' + (sz.words !== 1 ? 's' : '')}</span>
            ${best ? `<span title="${escapeHTML((best.mode === 'quote' ? 'full' : best.mode) + ' · ' + Math.round(best.acc) + '% acc')}"><i data-lucide="gauge" style="width:11px;height:11px;"></i> best ${mtSpeed(best.wpm)} ${mtUnitLabel()}</span>` : ''}
            ${runs ? `<span><i data-lucide="rotate-ccw" style="width:11px;height:11px;"></i> ${runs} run${runs !== 1 ? 's' : ''}</span>` : ''}
            ${(it.tags || []).slice(0, 3).map(t => `<span class="mtl-tag">${escapeHTML(t)}</span>`).join('')}
            ${typeof agDeadlineTextHTML === 'function' ? agDeadlineTextHTML('typing', it.id) : ''}
            ${guess ? `<span class="mtl-stray"><i data-lucide="triangle-alert" style="width:11px;height:11px;"></i> saved as text, looks like ${escapeHTML(mtLangMeta(guess).name)}</span>` : ''}
          </div>
        </div>
        ${guess ? `
        <button class="btn btn-secondary btn-sm mtl-convert" type="button" onclick="mtlConvert('${it.id}', '${guess}')"
                title="Make it a ${escapeHTML(mtLangMeta(guess).name)} code entry: highlighting, auto indent, auto close and the code window">
          <i data-lucide="${mtLangMeta(guess).icon}" style="width:14px;height:14px;"></i> Make it ${escapeHTML(mtLangMeta(guess).name)}
        </button>` : ''}
        <button class="btn btn-ghost btn-sm" type="button" onclick="mtlTogglePreview('${it.id}')" title="${open ? 'Hide' : 'Show'} the text">
          <i data-lucide="${open ? 'eye-off' : 'eye'}" style="width:14px;height:14px;"></i>
        </button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="agOpenDeadlineModal('typing', '${it.id}')"
                title="${typeof agGetDeadline === 'function' && agGetDeadline('typing', it.id) ? 'Change or clear the deadline' : 'Put a due date on this entry'}">
          <i data-lucide="flag" style="width:14px;height:14px;"></i>
        </button>
        <button class="btn btn-practice btn-sm" type="button" onclick="mtlRun('${it.id}')">
          <i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Run
        </button>
      </div>
      ${open ? `<div class="mtl-preview">${mtlPreviewHTML(it)}</div>` : ''}`;
  }).join('');
}

function mtlPreviewHTML(it) {
  const s = mtCleanContent(it.content, it.kind);
  const body = it.kind === 'code'
    ? `<pre class="mtl-pre tk-on">${mtHighlightHTML(s, it.lang)}</pre>`
    : `<div class="mtl-prose">${escapeHTML(s).replace(/\n/g, '<br>')}</div>`;
  return body + (it.notes ? `<p class="mtl-notes"><i data-lucide="sticky-note" style="width:12px;height:12px;"></i> ${escapeHTML(it.notes)}</p>` : '');
}

function mtlTogglePreview(id) {
  mtlOpenPreview = mtlOpenPreview === id ? null : id;
  const list = document.getElementById('mtl-list');
  if (!list) return;
  list.innerHTML = mtlRowsHTML();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
}

function mtlListHTML() {
  const meta = mtlViewMeta(mtlView);
  const items = mtlFiltered(mtlView);
  const ids = new Set(items.map(it => it.id));
  const results = mtHistory().filter(r => ids.has(r.itemId));
  const best = results.reduce((m, r) => Math.max(m, r.wpm), 0);
  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="${meta.icon}"></i></div>
        <div style="flex:1; min-width:0;">
          <h2 class="prog-detail-title">${escapeHTML(meta.title)}</h2>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="file-stack" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Entries</em><strong>${items.length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Tests</em><strong>${results.length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="gauge" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Best</em><strong>${best ? mtSpeed(best) + ' ' + mtUnitLabel() : '—'}</strong></span></div>
          </div>
        </div>
      </div>
      <p class="prog-detail-desc mtl-desc">${escapeHTML(meta.desc)}</p>
      <div class="mtl-toolbar">
        <div class="search-container mtl-search">
          <i data-lucide="search"></i>
          <input type="text" class="search-input" placeholder="Search titles, tags and text…" autocomplete="off"
                 value="${escapeHTML(mtlQuery)}" oninput="mtlSetQuery(this.value)" aria-label="Search entries" />
        </div>
        <button class="btn btn-secondary btn-sm" type="button" onclick="spaNavigate('admin-typing')">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> New entry
        </button>
      </div>
      <div class="prog-variant-list" id="mtl-list" style="margin-top:1rem;">${mtlRowsHTML()}</div>
    </div>`;
}

let mtlResultSort = 'latest';

function mtlSortResults(by) { mtlResultSort = by; mtlRenderDetail(); }

function mtlResultsHTML() {
  const all = mtHistory().slice();
  const total = all.length;
  const time = all.reduce((t, r) => t + (r.time || 0), 0);
  const last10 = all.slice(-10);
  const avg10 = last10.length ? last10.reduce((a, r) => a + r.wpm, 0) / last10.length : 0;
  const best = all.reduce((m, r) => (!m || r.wpm > m.wpm ? r : m), null);
  const rows = (mtlResultSort === 'best' ? all.sort((a, b) => b.wpm - a.wpm) : all.reverse()).slice(0, 200);
  const fmtTime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
    return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
  };
  const typeLabel = (r) => (r.mode === 'quote' ? 'full' : r.mode === 'words' ? (r.kind === 'code' ? 'lines' : 'words') : r.mode)
    + (r.mode === 'time' || r.mode === 'words' ? ' ' + r.mode2 : '');
  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="line-chart"></i></div>
        <div style="flex:1; min-width:0;">
          <h2 class="prog-detail-title">Your results</h2>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="check-check" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Tests</em><strong>${total}</strong></span></div>
            <div class="prog-stat"><i data-lucide="timer" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Time typing</em><strong>${fmtTime(time)}</strong></span></div>
            <div class="prog-stat"><i data-lucide="activity" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Last 10 avg</em><strong>${avg10 ? mtSpeed(avg10) : '—'}</strong></span></div>
            <div class="prog-stat"><i data-lucide="crown" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Best</em><strong>${best ? mtSpeed(best.wpm) + ' ' + mtUnitLabel() : '—'}</strong></span></div>
          </div>
        </div>
      </div>
      ${total ? `
      <div class="mtl-toolbar">
        <div class="lang-tabs" style="padding:0;">
          <button class="lang-tab${mtlResultSort === 'latest' ? ' is-active' : ''}" type="button" onclick="mtlSortResults('latest')"><i data-lucide="clock"></i> Latest</button>
          <button class="lang-tab${mtlResultSort === 'best' ? ' is-active' : ''}" type="button" onclick="mtlSortResults('best')"><i data-lucide="crown"></i> Best</button>
        </div>
        <span class="lang-board-hint">${total > 200 ? 'Showing 200 of ' + total : ''}</span>
      </div>
      <table class="lang-admin-table mtl-results">
        <thead><tr><th>When</th><th>Entry</th><th>Test</th><th>${escapeHTML(mtUnitLabel())}</th><th>Acc</th><th>Raw</th><th>Consistency</th><th>Time</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td>${escapeHTML(new Date(r.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td>
            <td><strong>${escapeHTML(r.title || 'custom')}</strong></td>
            <td>${escapeHTML(typeLabel(r))}${r.kind === 'code' ? ' · ' + escapeHTML(mtLangMeta(r.lang).short) : ''}</td>
            <td><strong>${mtSpeed(r.wpm)}</strong></td>
            <td>${Math.floor(r.acc)}%</td>
            <td>${mtSpeed(r.raw)}</td>
            <td>${Math.round(r.consistency)}%</td>
            <td>${Math.round(r.time)}s</td>
          </tr>`).join('')}</tbody>
      </table>` : `
      <div class="mtl-empty">
        <i data-lucide="line-chart"></i>
        <div><strong>No results yet</strong><span>Finish a test and it is recorded here.</span></div>
        <button class="btn btn-primary btn-sm" type="button" onclick="mtlQuickTest()"><i data-lucide="keyboard" style="width:14px;height:14px;"></i> Start a test</button>
      </div>`}
    </div>`;
}

/* ── Starting ─────────────────────────────────────────────── */

function mtlRun(id) {
  setSessionParam('mtItem', id);
  spaNavigate('typing-attempt');
}

function mtlQuickTest() {
  spaNavigate('typing-attempt');
}

function mtlCustomTest() {
  setSessionParam('mtMode', 'custom');
  spaNavigate('typing-attempt');
}

/* Route: library — the universal Library hub.
   A doorway to every collection, plus the two things you actually come here to
   do: see what's due across all of them, and find something by name. */

const LIBRARY_PLACEHOLDERS = [
  { key: 'language',    name: 'Language Library',    icon: 'languages',    tagline: 'Vocabulary, grammar drills & phrases.' },
  { key: 'mindset',     name: 'Mindset Library',     icon: 'brain',        tagline: 'Mental models, attitudes & principles.' },
  { key: 'insights',    name: 'Insights Library',    icon: 'lightbulb',    tagline: 'Aha-moments and lessons worth keeping.' },
  { key: 'remembrance', name: 'Remembrance Library', icon: 'star',         tagline: 'Things you never want to forget.' },
  { key: 'diary',       name: 'Diary Library',       icon: 'pen-line',     tagline: 'Daily reflections & journaling.' },
  { key: 'collection',  name: 'Collection Library',  icon: 'boxes',        tagline: 'Curate and catalogue anything.' },
  { key: 'progression', name: 'Progression Library', icon: 'trending-up',  tagline: 'Milestones, levels & growth tracking.' },
  { key: 'roadmap',     name: 'Roadmap Library',     icon: 'map',          tagline: 'Plans, paths & what comes next.' },
];

function libraryTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll lib-hub">
        <section class="lib-hub-hero fade-in-up">
          <div class="lib-hub-hero-icon"><i data-lucide="library"></i></div>
          <h1 class="lib-hub-title">Library</h1>
          <p class="lib-hub-subtitle">Every collection in one place — pick a wing and dive in.</p>
          <div class="lib-hub-totals" id="lib-hub-totals"></div>
          <div class="lib-hub-search">
            <i data-lucide="search"></i>
            <input type="text" id="lib-hub-search" class="search-input" autocomplete="off"
                   placeholder="Search across every library…" oninput="libHubSearch()" />
          </div>
          <div class="lib-hub-results" id="lib-hub-results"></div>
        </section>

        <section id="lib-hub-due-section" style="display:none;">
          <h2 class="lib-hub-section-title"><i data-lucide="brain"></i> Due today</h2>
          <div class="lib-due-panel" id="lib-hub-due"></div>
        </section>

        <section>
          <h2 class="lib-hub-section-title"><i data-lucide="door-open"></i> Your collections</h2>
          <div class="lib-hub-grid stagger-children" id="lib-hub-active"></div>
        </section>

        <section style="margin-top:2rem;">
          <h2 class="lib-hub-section-title"><i data-lucide="boxes"></i> Other wings</h2>
          <div class="lib-hub-grid lib-hub-grid-soon stagger-children" id="lib-hub-soon"></div>
        </section>
      </div>
    </div>
  `;
}

function _libStatChip(icon, label) {
  return `<span class="lib-stat-chip"><i data-lucide="${icon}"></i> ${label}</span>`;
}

function libraryInit() {
  const challenges = state.challenges || [];
  const notebooks = state.notebooks || [];
  const snippets = state.snippets || [];

  // Shared with the Coding Library header — excludes manual practice-set problems
  // (challengeId: null) and history left behind by deleted programs.
  const completedPrograms = (typeof countCompletedPrograms === 'function')
    ? countCompletedPrograms()
    : new Set((state.history || []).filter(h => h.challengeId && h.score === 100 && !h.isArchived).map(h => h.challengeId)).size;
  const codingPct = challenges.length ? Math.round((completedPrograms / challenges.length) * 100) : 0;

  const mastered = (typeof _notebookBestPct === 'function')
    ? notebooks.filter(nb => _notebookBestPct(nb) >= 80).length : 0;
  const notesPct = notebooks.length ? Math.round((mastered / notebooks.length) * 100) : 0;

  let snippetTracked = 0;
  if (typeof _snippetStatus === 'function') {
    snippets.forEach(s => { if (_snippetStatus(s) !== 'new') snippetTracked++; });
  }
  const snipPct = snippets.length ? Math.round((snippetTracked / snippets.length) * 100) : 0;

  const totals = document.getElementById('lib-hub-totals');
  if (totals) {
    totals.innerHTML = `
      ${_libStatChip('file-code', `${challenges.length} programs`)}
      ${_libStatChip('book-open', `${notebooks.length} notebooks`)}
      ${_libStatChip('code', `${snippets.length} snippets`)}
      ${_libStatChip('boxes', `${LIBRARY_PLACEHOLDERS.length} more wings`)}
    `;
  }

  libHubRenderDue();

  const active = document.getElementById('lib-hub-active');
  if (active) {
    const card = (route, cls, icon, name, desc, chips, pct, pctLabel) => `
      <div class="lib-card ${cls}" onclick="spaNavigate('${route}')" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter')spaNavigate('${route}')">
        <div class="lib-card-glow"></div>
        <div class="lib-card-head">
          <div class="lib-card-icon"><i data-lucide="${icon}"></i></div>
          <i data-lucide="arrow-up-right" class="lib-card-arrow"></i>
        </div>
        <h3 class="lib-card-name">${name}</h3>
        <p class="lib-card-desc">${desc}</p>
        <div class="lib-card-chips">${chips}</div>
        ${pct === null || pct === undefined ? '' : `
        <div class="lib-card-progress" title="${pctLabel}">
          <div class="folder-progress-bar"><div class="folder-progress-fill" style="width:${pct}%;"></div></div>
          <span class="folder-progress-label">${pct}%</span>
        </div>`}
      </div>`;

    // Read straight from the cheat-sheet store; it is not part of `state`.
    let cheatCount = 0, cheatPages = 0;
    try {
      const raw = JSON.parse(localStorage.getItem('cheatsheetLibrary')) || {};
      cheatCount = (raw.sheets || []).length;
      cheatPages = (raw.sheets || []).reduce((n, x) => n + ((x.pages || []).length), 0);
    } catch (e) { /* nothing saved yet */ }

    const dueChip = (type, list) => {
      const n = typeof libDueCount === 'function' ? libDueCount(type, list) : 0;
      return n ? `<span class="lib-stat-chip due"><i data-lucide="brain"></i> ${n} due</span>` : '';
    };

    active.innerHTML =
      card('browse', 'lib-card-coding', 'code-2', 'Coding Library',
        'Challenge programs — rebuild them from memory, run real tests, defeat the boss bar.',
        _libStatChip('file-code', `${challenges.length} programs`) + _libStatChip('check-circle', `${completedPrograms} completed`) + dueChip('challenge', challenges),
        codingPct, `${completedPrograms}/${challenges.length} completed`) +
      card('study', 'lib-card-notes', 'book-open', 'Notes Library',
        'MCQ notebooks and quizzes — drill concepts until they stick.',
        _libStatChip('book-open', `${notebooks.length} notebooks`) + _libStatChip('trophy', `${mastered} mastered`) + dueChip('notebook', notebooks),
        notesPct, `${mastered}/${notebooks.length} mastered (80%+)`) +
      card('snippets', 'lib-card-snippets', 'code', 'Snippet Library',
        'Reference snippets with examples, Try-Coding drills and linked challenges.',
        _libStatChip('code', `${snippets.length} snippets`) + _libStatChip('brain', `${snippetTracked} in rotation`) + dueChip('snippet', snippets),
        snipPct, `${snippetTracked}/${snippets.length} in your review rotation`) +
      // The Cheat Sheet Library belongs with the other collections, not in the
      // app's top-level sidebar - it is a library, not a section.
      card('cheatsheet', 'lib-card-cheat', 'book-marked', 'Cheat Sheet Library',
        'Your own reference book - terms, code you keep for looking at, tables and notes.',
        _libStatChip('book-marked', `${cheatCount} sheet${cheatCount !== 1 ? 's' : ''}`) +
        _libStatChip('layers', `${cheatPages} page${cheatPages !== 1 ? 's' : ''}`),
        null, `${cheatCount} sheet${cheatCount !== 1 ? 's' : ''}`);
  }

  const soon = document.getElementById('lib-hub-soon');
  if (soon) {
    soon.innerHTML = LIBRARY_PLACEHOLDERS.map(p => {
      const n = (typeof wingItems === 'function') ? wingItems(p.key).length : 0;
      return `
      <div class="lib-card lib-card-wing" onclick="spaNavigate('wing?k=${p.key}')" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter')spaNavigate('wing?k=${p.key}')">
        <div class="lib-card-glow"></div>
        <div class="lib-card-head">
          <div class="lib-card-icon"><i data-lucide="${p.icon}"></i></div>
          <i data-lucide="arrow-up-right" class="lib-card-arrow"></i>
        </div>
        <h3 class="lib-card-name">${p.name}</h3>
        <p class="lib-card-desc">${p.tagline}</p>
        <div class="lib-card-chips">${_libStatChip('file-text', `${n} entr${n === 1 ? 'y' : 'ies'}`)}</div>
      </div>`;
    }).join('');
  }

  const libRoot = document.querySelector('.lib-hub');
  if (typeof lucide !== 'undefined') lucide.createIcons(libRoot ? { root: libRoot } : undefined);
}

/* ── Due today, across every library ──────────────────────────
   getDueReviewItems() has always returned this, cross-library and sorted by how
   overdue each item is. The hub was the obvious place to show it and didn't. */
function libHubRenderDue() {
  const section = document.getElementById('lib-hub-due-section');
  const host = document.getElementById('lib-hub-due');
  if (!section || !host || typeof getDueReviewItems !== 'function') return;
  const due = getDueReviewItems(12);
  if (!due.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  const all = getDueReviewItems();
  const icon = { challenge: 'file-code', notebook: 'book-open', snippet: 'code' };
  host.innerHTML = `
    <div class="lib-due-head">
      <div>
        <strong>${all.length} item${all.length === 1 ? '' : 's'} due</strong>
        <span>across ${new Set(all.map(d => d.type)).size} librar${new Set(all.map(d => d.type)).size === 1 ? 'y' : 'ies'}</span>
      </div>
      <button class="btn btn-primary" onclick="libHubStartReview()">
        <i data-lucide="play" style="width:15px;height:15px;"></i> Start review
      </button>
    </div>
    <div class="lib-due-list">
      ${due.map(d => `
        <button class="lib-due-row" onclick="reviewNavigateTo('${d.type}','${d.id}')" title="${escapeHTML(reviewDueLabel(d.daysOverdue))}">
          <i data-lucide="${icon[d.type] || 'circle'}" style="width:14px;height:14px;"></i>
          <span class="lib-due-name">${escapeHTML(d.title)}</span>
          <span class="lib-due-when${d.daysOverdue > 0 ? ' over' : ''}">${escapeHTML(reviewDueLabel(d.daysOverdue))}</span>
        </button>`).join('')}
      ${all.length > due.length ? `<span class="lib-due-more">+${all.length - due.length} more</span>` : ''}
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/** Jump straight to the most overdue thing. */
function libHubStartReview() {
  const due = typeof getDueReviewItems === 'function' ? getDueReviewItems(1) : [];
  if (!due.length) return;
  reviewNavigateTo(due[0].type, due[0].id);
}

/* ── Cross-library search ─────────────────────────────────── */

function libHubSearch() {
  const input = document.getElementById('lib-hub-search');
  const host = document.getElementById('lib-hub-results');
  if (!input || !host) return;
  const q = input.value.trim();
  if (q.length < 2) { host.innerHTML = ''; host.classList.remove('open'); return; }

  const hits = [];
  const push = (list, kind, route, icon, onclick) => {
    (list || []).forEach(item => {
      if (hits.length >= 40) return;
      if (libMatches(item, q, kind)) hits.push({ item, kind, route, icon, onclick });
    });
  };
  push(state.challenges, 'challenge', 'browse', 'file-code',
    (it) => `setSessionParam('browseActiveProgram','${it.id}'); spaNavigate('browse')`);
  push(state.notebooks, 'notebook', 'study', 'book-open',
    (it) => `setSessionParam('activeNotebook','${it.id}'); spaNavigate('study')`);
  push(state.snippets, 'snippet', 'snippets', 'code',
    (it) => `setSessionParam('activeSnippetId','${it.id}'); spaNavigate('snippets')`);
  if (typeof wingAllItems === 'function') {
    wingAllItems().forEach(({ key, item }) => {
      if (hits.length >= 40) return;
      if (libMatches(item, q, 'wing')) {
        hits.push({ item, kind: 'wing', route: 'wing', icon: 'file-text',
                    onclick: (it) => `setSessionParam('wingActiveItem','${it.id}'); spaNavigate('wing?k=${key}')` });
      }
    });
  }

  const label = { challenge: 'Coding', notebook: 'Notes', snippet: 'Snippet', wing: 'Wing' };
  host.classList.add('open');
  host.innerHTML = hits.length
    ? hits.slice(0, 20).map(h => `
        <button class="lib-hub-result" onclick="${h.onclick(h.item)}">
          <i data-lucide="${h.icon}" style="width:14px;height:14px;"></i>
          <span class="lib-hub-result-name">${escapeHTML(h.item.title || 'Untitled')}</span>
          <span class="lib-hub-result-kind">${label[h.kind]}</span>
        </button>`).join('')
    : `<div class="lib-hub-noresult">Nothing matches “${escapeHTML(q)}”.</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function libraryComingSoon(key) {
  const lib = LIBRARY_PLACEHOLDERS.find(p => p.key === key);
  const name = lib ? lib.name : 'This library';
  if (typeof toast === 'function') toast(`${name} is under construction — coming soon!`, { type: 'info', title: 'Coming soon' });
  else if (typeof showMessage === 'function') showMessage('Coming soon', `${name} is under construction.`);
}

function libraryDestroy() { }

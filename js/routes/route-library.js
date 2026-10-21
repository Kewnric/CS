/* Route: library — the universal Library hub.
   A doorway to every collection, plus the two things you actually come here to
   do: see what's due across all of them, and find something by name. */

/**
 * The seven wings. NOT placeholders — they were, and the constant was called
 * LIBRARY_WINGS for as long as they only raised a toast. Each now has
 * its own file, its own fields and its own layout, so they sit in Your
 * collections beside the other libraries and the name says what they are.
 *
 * "Other wings" holds a single Placeholder Library card instead: a marker for
 * the next one, rather than seven finished libraries filed under "not yet".
 */
const LIBRARY_WINGS = [
  /* The accent belongs to the wing, not to where it happens to sit. These
     used to come from :nth-child on the "other wings" grid, which meant the
     colours were a property of the row rather than of the library — and would
     have silently collapsed to one purple the moment they moved. */
  { key: 'mindset',     name: 'Mindset Library',     icon: 'brain',        accent: '#8b5cf6', tagline: 'Mental models, attitudes & principles.' },
  { key: 'insights',    name: 'Insights Library',    icon: 'lightbulb',    accent: '#ec4899', tagline: 'Aha-moments and lessons worth keeping.' },
  { key: 'remembrance', name: 'Remembrance Library', icon: 'star',         accent: '#f59e0b', tagline: 'Things you never want to forget.' },
  { key: 'diary',       name: 'Diary Library',       icon: 'pen-line',     accent: '#eab308', tagline: 'Daily reflections & journaling.' },
  { key: 'collection',  name: 'Collection Library',  icon: 'boxes',        accent: '#10b981', tagline: 'Curate and catalogue anything.' },
  { key: 'progression', name: 'Progression Library', icon: 'trending-up',  accent: '#06b6d4', tagline: 'Milestones, levels & growth tracking.' },
  { key: 'roadmap',     name: 'Roadmap Library',     icon: 'map',          accent: '#3b82f6', tagline: 'Plans, paths & what comes next.' },
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

/** The one thing the placeholder card can do. */
function libPlaceholderNote() {
  if (typeof toast === 'function') {
    toast('Nothing here yet — this is where the next library will go.', { type: 'info' });
  }
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
      ${_libStatChip('file-code', countNoun(challenges.length, 'program'))}
      ${_libStatChip('book-open', countNoun(notebooks.length, 'notebook'))}
      ${_libStatChip('code', countNoun(snippets.length, 'snippet'))}
      ${(() => {
        // They are not "more wings" now that they are in with everything else;
        // what is worth counting is what you have actually written in them.
        const n = LIBRARY_WINGS.reduce((t, w) =>
          t + ((typeof wingItems === 'function') ? wingItems(w.key).length : 0), 0);
        return _libStatChip('boxes', `${n} wing entr${n === 1 ? 'y' : 'ies'}`);
      })()}
    `;
  }

  libHubRenderDue();

  const active = document.getElementById('lib-hub-active');
  if (active) {
    const card = (route, cls, icon, name, desc, chips, pct, pctLabel, accent) => `
      <div class="lib-card is-spatial ${cls}" onclick="spaNavigate('${route}')" role="link" tabindex="0"
           ${accent ? `style="--lib-accent:${accent};"` : ''}
           onkeydown="if(event.key==='Enter')spaNavigate('${route}')">
        <div class="lib-card-inner">
          <div class="lib-card-bg"><div class="lib-card-glow"></div><div class="lib-card-light"></div></div>
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
        </div>
      </div>`;

    // Read straight from the cheat-sheet store; it is not part of `state`.
    let cheatCount = 0, cheatPages = 0;
    try {
      const raw = JSON.parse(localStorage.getItem(typeof getCheatStorageKey === 'function' ? getCheatStorageKey() : 'cheatsheetLibrary')) || {};
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
        _libStatChip('file-code', countNoun(challenges.length, 'program')) + _libStatChip('check-circle', `${completedPrograms} completed`) + dueChip('challenge', challenges),
        codingPct, `${completedPrograms}/${challenges.length} completed`) +
      card('study', 'lib-card-notes', 'book-open', 'Notes Library',
        'MCQ notebooks and quizzes — drill concepts until they stick.',
        _libStatChip('book-open', countNoun(notebooks.length, 'notebook')) + _libStatChip('trophy', `${mastered} mastered`) + dueChip('notebook', notebooks),
        notesPct, `${mastered}/${notebooks.length} mastered (80%+)`) +
      card('snippets', 'lib-card-snippets', 'code', 'Snippet Library',
        'Reference snippets with examples, Try-Coding drills and linked challenges.',
        _libStatChip('code', countNoun(snippets.length, 'snippet')) + _libStatChip('brain', `${snippetTracked} in rotation`) + dueChip('snippet', snippets),
        snipPct, `${snippetTracked}/${snippets.length} in your review rotation`) +
      (() => {
        const items = state.typeItems || [];
        const code = items.filter(it => it.kind === 'code').length;
        const tests = (state.typeHistory || []).length;
        return card('typing', 'lib-card-typing', 'keyboard', 'Memorization Typing Library',
          'Type your own text and code over its ghost until it is in your fingers — speed, accuracy and a chart of every run.',
          _libStatChip('file-text', `${items.length} entr${items.length === 1 ? 'y' : 'ies'}`) +
          _libStatChip('code-2', `${code} code`) +
          _libStatChip('gauge', `${tests} test${tests === 1 ? '' : 's'}`),
          null, `${items.length} entr${items.length === 1 ? 'y' : 'ies'}`, '#e2b714');
      })() +
      // The Cheat Sheet Library belongs with the other collections, not in the
      // app's top-level sidebar - it is a library, not a section.
      card('cheatsheet', 'lib-card-cheat', 'book-marked', 'Cheat Sheet Library',
        'Your own reference book - terms, code you keep for looking at, tables and notes.',
        _libStatChip('book-marked', `${cheatCount} sheet${cheatCount !== 1 ? 's' : ''}`) +
        _libStatChip('layers', `${cheatPages} page${cheatPages !== 1 ? 's' : ''}`),
        null, `${cheatCount} sheet${cheatCount !== 1 ? 's' : ''}`) +
      (() => {
        const words = (state.langWords || []).length;
        const drills = (state.langSets || []).length;
        const scenes = (state.langScenarios || []).length;
        return card('language', 'lib-card-language', 'languages', 'Language Library',
          'Your own dictionary across four languages, drills built from it, and scenario battles.',
          _libStatChip('book-a', `${words} word${words !== 1 ? 's' : ''}`) +
          _libStatChip('dumbbell', `${drills} drill${drills !== 1 ? 's' : ''}`) +
          _libStatChip('swords', `${scenes} scenario${scenes !== 1 ? 's' : ''}`),
          null, `${words} word${words !== 1 ? 's' : ''}`);
      })() +
      // The seven wings, in with everything else. They are built libraries now.
      LIBRARY_WINGS.map(w => {
        const n = (typeof wingItems === 'function') ? wingItems(w.key).length : 0;
        const noun = (typeof wingSchema === 'function')
          ? (n === 1 ? wingSchema(w.key).noun : wingSchema(w.key).nounPlural) : 'entries';
        return card(w.key, 'lib-card-wing', w.icon, w.name, w.tagline,
          _libStatChip('file-text', `${n} ${noun}`), null, `${n} ${noun}`, w.accent);
      }).join('');
  }

  /* One card, standing in for whatever comes next. This used to hold the
     seven wings, which stopped making sense the moment they were finished —
     a built library filed under "not yet" is just a lie about the state of
     the app. */
  const soon = document.getElementById('lib-hub-soon');
  if (soon) {
    soon.innerHTML = `
      <div class="lib-card is-spatial lib-card-placeholder" role="note" tabindex="0"
           onclick="libPlaceholderNote()" onkeydown="if(event.key==='Enter')libPlaceholderNote()">
        <div class="lib-card-inner">
          <div class="lib-card-bg"><div class="lib-card-glow"></div><div class="lib-card-light"></div></div>
          <div class="lib-card-head">
            <div class="lib-card-icon"><i data-lucide="package-plus"></i></div>
            <i data-lucide="sparkles" class="lib-card-arrow"></i>
          </div>
          <h3 class="lib-card-name">Placeholder Library</h3>
          <p class="lib-card-desc">Room for the next wing. Nothing lives here yet.</p>
          <div class="lib-card-chips">${_libStatChip('clock', 'Not built yet')}</div>
        </div>
      </div>`;
  }

  const libRoot = document.querySelector('.lib-hub');
  if (typeof lucide !== 'undefined') lucide.createIcons(libRoot ? { root: libRoot } : undefined);
  libSpatialBind(libRoot);
}

/* ── Spatial cards ────────────────────────────────────────────
   The collection cards tilt toward the pointer, and what is on them sits at
   different depths -- the icon and the title nearest, the description
   furthest back -- so a card reads as a little object with layers rather
   than a flat tile. A soft light follows the pointer across it. Mouse only:
   on a touch screen there is no hover to tilt toward, and the card simply
   presses in. With reduced motion it does not move at all.
   The card eases toward the pointer every frame instead of being handed a
   fresh CSS transition on every mouse move, so it turns with a little weight
   rather than snapping to the pointer the moment it arrives; a mouse press
   sinks it back toward the page. 10 degrees, not 12: at 12 the deepest
   layers leaned through the border on the side that dipped away. */
const LIB_TILT = 10;   // degrees at the card's edge
const LIB_LIFT = 12;   // px the card comes forward while hovered
const LIB_PRESS = -4;  // and where it sits while the mouse is pressed

function libSpatialBind(root) {
  if (!root) return;
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('.lib-card.is-spatial').forEach(card => {
    if (card._libSpatial) return;
    card._libSpatial = true;
    const inner = card.querySelector('.lib-card-inner');
    if (!inner || still) return;
    // Where the card is headed (to) and where it is now (at): x and y run
    // -1..1 across the card, z is the lift in px. Each frame closes a share
    // of the gap scaled by the time that passed, so it moves the same at
    // 60 Hz and 144 Hz -- quicker on the way in, unhurried settling back.
    const to = { x: 0, y: 0, z: 0 }, at = { x: 0, y: 0, z: 0 };
    let raf = 0, last = 0, over = false;
    const frame = now => {
      raf = 0;
      const dt = Math.min(64, last ? now - last : 16.7);
      last = now;
      const k = 1 - Math.pow(over ? 0.78 : 0.88, dt / 16.7);
      let moving = false;
      ['x', 'y', 'z'].forEach(a => {
        const d = to[a] - at[a];
        if (Math.abs(d) > (a === 'z' ? 0.05 : 0.002)) { at[a] += d * k; moving = true; }
        else at[a] = to[a];
      });
      if (!over && !moving) {
        // Back flat: hand the card back to the stylesheet.
        inner.style.transform = '';
        inner.style.transition = '';
        last = 0;
        return;
      }
      inner.style.transform = 'rotateX(' + (-at.y * LIB_TILT).toFixed(2) + 'deg) rotateY(' +
        (at.x * LIB_TILT).toFixed(2) + 'deg) translateZ(' + at.z.toFixed(1) + 'px)';
      card.style.setProperty('--mx', ((at.x + 1) * 50).toFixed(1) + '%');
      card.style.setProperty('--my', ((at.y + 1) * 50).toFixed(1) + '%');
      card.style.setProperty('--tx', at.x.toFixed(3));
      card.style.setProperty('--ty', at.y.toFixed(3));
      if (moving) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const aim = e => {
      const r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      to.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      to.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    };
    const enter = () => {
      if (over) return;
      over = true;
      to.z = LIB_LIFT;
      inner.style.transition = 'none';   // the frames do the easing
      card.classList.add('is-tilting');
    };
    card.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      enter(); aim(e); kick();
    });
    card.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      enter(); aim(e); kick();
    });
    card.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || !over) return;
      to.z = LIB_PRESS; kick();
    });
    card.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse' || !over) return;
      to.z = LIB_LIFT; kick();
    });
    card.addEventListener('pointerleave', () => {
      over = false;
      to.x = to.y = to.z = 0;
      card.classList.remove('is-tilting');
      kick();
    });
  });
}

/* ── Due today, across every library ──────────────────────────
   getDueReviewItems() has always returned this, cross-library and sorted by how
   overdue each item is. The hub was the obvious place to show it and didn't.
   One compact row: how many and how late (a count, a lateness meter and a
   count per library), the three most overdue as tiles, and Review. The rest
   waits in a drawer -- twelve pills that each spelled out "44 days overdue"
   made a wall of red text the size of a whole section. */
/* How late, in bands. The list is already sorted by it and every badge was
   painted the same amber regardless, so a thing twenty days overdue looked
   exactly like one that slipped yesterday -- the sort carried the urgency and
   nothing on screen did. Three bands rather than a gradient, because the
   decision this drives is only ever 'now, soon, or whenever'. */
function _libDueTier(days) {
  if (days <= 0) return 'today';
  if (days <= 2) return 'over';
  if (days <= 7) return 'mid';
  return 'high';
}
const LIB_DUE_BANDS = [
  ['high', 'more than a week late'],
  ['mid', 'three days to a week late'],
  ['over', 'a day or two late'],
  ['today', 'due today'],
];

/* Each kind of item wears the icon and colour of its card below, so a tile
   says which library it comes from without a word. */
function _libDueKind(type) {
  if (type === 'challenge') return { icon: 'file-code', color: 'var(--color-primary)', one: 'program', many: 'programs', rank: 0 };
  if (type === 'notebook') return { icon: 'book-open', color: 'var(--color-warning)', one: 'notebook', many: 'notebooks', rank: 1 };
  if (type === 'snippet') return { icon: 'code', color: 'var(--color-accent)', one: 'snippet', many: 'snippets', rank: 2 };
  const key = String(type || '').startsWith('wing:') ? String(type).slice(5) : '';
  const i = key ? LIBRARY_WINGS.findIndex(x => x.key === key) : -1;
  if (i >= 0) {
    const w = LIBRARY_WINGS[i];
    const s = typeof wingSchema === 'function' ? wingSchema(key) : null;
    return { icon: w.icon, color: w.accent, one: (s && s.noun) || 'entry', many: (s && s.nounPlural) || 'entries', rank: 3 + i };
  }
  return { icon: 'circle', color: 'var(--color-primary)', one: 'item', many: 'items', rank: 99 };
}

// Open or shut, and the library the drawer is narrowed to ('' for all). Kept
// for the visit, so coming back to the hub finds it the way you left it.
let _libDueView = { open: false, kind: '' };
let _libDueAll = [];

function _libDueTileHTML(d, cls) {
  const k = _libDueKind(d.type);
  const short = d.daysOverdue <= 0 ? 'Today' : d.daysOverdue + 'd';
  return `
    <button class="lib-due-tile${cls ? ' ' + cls : ''}" style="--k:${k.color};" onclick="reviewNavigateTo('${d.type}','${d.id}')"
            title="${escapeHTML(d.title)} · ${escapeHTML(reviewDueLabel(d.daysOverdue))}">
      <span class="lib-due-ic"><i data-lucide="${k.icon}"></i></span>
      <span class="lib-due-name">${escapeHTML(d.title)}</span>
      <span class="lib-due-late t-${_libDueTier(d.daysOverdue)}">${short}</span>
    </button>`;
}

function libHubRenderDue() {
  const section = document.getElementById('lib-hub-due-section');
  const host = document.getElementById('lib-hub-due');
  if (!section || !host || typeof getDueReviewItems !== 'function') return;
  const all = getDueReviewItems();
  _libDueAll = all;
  if (!all.length) { section.style.display = 'none'; host.innerHTML = ''; return; }
  section.style.display = '';

  // A count per library, in the order the collections appear below.
  const kinds = [];
  all.forEach(d => {
    let g = kinds.find(x => x.type === d.type);
    if (!g) kinds.push(g = { type: d.type, n: 0, k: _libDueKind(d.type) });
    g.n++;
  });
  kinds.sort((x, y) => x.k.rank - y.k.rank);
  if (_libDueView.kind && !kinds.some(g => g.type === _libDueView.kind)) _libDueView.kind = '';
  const bands = LIB_DUE_BANDS
    .map(([band, words]) => ({ band, words, n: all.filter(d => _libDueTier(d.daysOverdue) === band).length }))
    .filter(x => x.n);
  const v = _libDueView;

  host.innerHTML = `
    <div class="lib-due${v.open ? ' is-open' : ''}">
      <div class="lib-due-sum">
        <div class="lib-due-count t-${_libDueTier(all[0].daysOverdue)}" title="${all.length} due for review">
          <b>${all.length}</b><span>due</span>
        </div>
        <div class="lib-due-meta">
          <div class="lib-due-meter" role="img" aria-label="${bands.map(x => x.n + ' ' + x.words).join(', ')}">
            ${bands.map(x => `<i class="t-${x.band}" style="flex:${x.n};" title="${x.n} ${x.words}"></i>`).join('')}
          </div>
          <div class="lib-due-kinds">
            ${kinds.map(g => `
              <button class="lib-due-kind${v.kind === g.type ? ' is-on' : ''}" style="--k:${g.k.color};" data-kind="${escapeHTML(g.type)}"
                      onclick="libDueToggle('${escapeHTML(g.type)}')" title="${g.n} ${g.n === 1 ? g.k.one : g.k.many} due">
                <i data-lucide="${g.k.icon}"></i>${g.n}
              </button>`).join('')}
          </div>
        </div>
      </div>
      <div class="lib-due-next">${all.slice(0, 3).map(d => _libDueTileHTML(d)).join('')}</div>
      <div class="lib-due-acts">
        <button class="btn btn-primary btn-sm lib-due-go" onclick="libHubStartReview()" title="Start with the most overdue">
          <i data-lucide="play"></i> Review
        </button>
        <button class="lib-due-more" onclick="libDueToggle()" aria-expanded="${v.open}" title="Every due item">
          <span>All</span><i data-lucide="chevron-down"></i>
        </button>
      </div>
      <div class="lib-due-drawer"><div><div class="lib-due-grid" id="lib-due-grid"></div></div></div>
    </div>`;
  _libDuePaintDrawer();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/* Fill the drawer -- only once it is open, so fifty tiles are not built for
   nobody, and left in place when it shuts so it does not empty mid-slide. */
function _libDuePaintDrawer() {
  const grid = document.getElementById('lib-due-grid');
  if (!grid || !_libDueView.open) return;
  const list = _libDueView.kind ? _libDueAll.filter(d => d.type === _libDueView.kind) : _libDueAll;
  grid.innerHTML = list.map(d => _libDueTileHTML(d, 'is-row')).join('');
  grid.scrollTop = 0;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });
}

/* All opens and shuts the drawer. A library's count opens it on just that
   library; pressing the same count again shows everything. */
function libDueToggle(kind) {
  const v = _libDueView;
  if (kind === undefined) { v.open = !v.open; if (!v.open) v.kind = ''; }
  else if (v.open && v.kind === kind) v.kind = '';
  else { v.kind = kind; v.open = true; }
  const root = document.querySelector('#lib-hub-due .lib-due');
  if (!root) return;
  root.classList.toggle('is-open', v.open);
  root.querySelectorAll('.lib-due-kind').forEach(b => b.classList.toggle('is-on', b.dataset.kind === v.kind));
  const more = root.querySelector('.lib-due-more');
  if (more) more.setAttribute('aria-expanded', String(v.open));
  _libDuePaintDrawer();
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
    (it) => `browseOpenProgram('${it.id}'); spaNavigate('browse')`);
  push(state.notebooks, 'notebook', 'study', 'book-open',
    (it) => `setSessionParam('activeNotebook','${it.id}'); spaNavigate('study')`);
  push(state.snippets, 'snippet', 'snippets', 'code',
    (it) => `setSessionParam('activeSnippetId','${it.id}'); spaNavigate('snippets')`);
  push(state.typeItems, 'typing', 'typing', 'keyboard',
    (it) => `mtlRun('${it.id}')`);
  if (typeof wingAllItems === 'function') {
    wingAllItems().forEach(({ key, item }) => {
      if (hits.length >= 40) return;
      if (libMatches(item, q, 'wing')) {
        hits.push({ item, kind: 'wing', route: 'wing', icon: 'file-text',
                    onclick: (it) => `setSessionParam('wingActiveItem','${it.id}'); spaNavigate('${key}')` });
      }
    });
  }

  const label = { challenge: 'Coding', notebook: 'Notes', snippet: 'Snippet', typing: 'Typing', wing: 'Wing' };
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
  const lib = LIBRARY_WINGS.find(p => p.key === key);
  const name = lib ? lib.name : 'This library';
  if (typeof toast === 'function') toast(`${name} is under construction — coming soon!`, { type: 'info', title: 'Coming soon' });
  else if (typeof showMessage === 'function') showMessage('Coming soon', `${name} is under construction.`);
}

function libraryDestroy() { }

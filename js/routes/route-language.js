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
/* Tags filter as a SET, not one at a time. "verbs" and "food" is a question
   people actually have, and the old single slot could not answer it. */
let langTagFilters = [];
let langPosFilter = null;
let langTagsExpanded = false;   // the chip cloud is 83 chips at pack size

/* How many entries the dictionary paints before it stops.
   The list used to paint every match: 1,008 entries is 28,972 DOM nodes and
   1.6MB of HTML string, 111ms a repaint, and a repaint runs on every
   keystroke -- 156ms just to clear the box. Capped at 120 it is 12ms. The
   cap is a render limit, never a search limit: the count above the list, and
   the button below it, both speak for the whole result. */
const LANG_PAGE = 120;
let langShownCount = LANG_PAGE;

/* Which board sections are open.
   Collapsed on arrival, every arrival — the board is a menu of eleven cards
   across three unrelated jobs, and the whole point of the headings is to let
   you skip the two you did not come for. Deliberately not persisted, for the
   same reason the coding library's tree collapses when you leave it: coming
   back to yesterday's open sections is somebody else's shape, not yours. */
let langBoardOpen = { dictionary: false, drills: false, adventure: false };

function langBoardReset() {
  langBoardOpen = { dictionary: false, drills: false, adventure: false };
}

/** Paint one section's open or closed state onto the DOM already there. */
function langPaintBoardSection(key) {
  const open = !!langBoardOpen[key];
  const group = document.querySelector('.lang-board-group[data-section="' + key + '"]');
  const head = document.querySelector('.lang-board-title[data-section="' + key + '"]');
  if (group) group.classList.toggle('collapsed', !open);
  if (head) {
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    const caret = head.querySelector('.lang-board-caret');
    if (caret) caret.classList.toggle('expanded', open);
  }
}

/**
 * Open one section and close the rest; clicking the open one closes it.
 *
 * One at a time, because all three open is the wall of cards the headings
 * exist to break up — and because with three open the one you want scrolls
 * off, which is worse than the flat list this replaced.
 *
 * Flips classes in place rather than re-rendering the board: the open and the
 * close are a CSS grid-rows transition, and an element replaced mid-animation
 * simply appears at its new size. Closing the others by the same route is
 * what makes the two halves animate together rather than one snapping shut.
 */
function langToggleBoardSection(key) {
  if (!(key in langBoardOpen)) return;
  const open = !langBoardOpen[key];
  Object.keys(langBoardOpen).forEach(k => { langBoardOpen[k] = (k === key) ? open : false; });
  Object.keys(langBoardOpen).forEach(langPaintBoardSection);
}

function languageTemplate() {
  return `
    <div class="messenger-layout" id="lang-lib-root">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display:flex; align-items:center; gap:0.5rem; width:100%;">
            <button onclick="spaNavigate('library')" class="btn-back-dark" style="margin-right:0.5rem; padding:0.25rem 0.5rem; font-size:0.75rem; flex-shrink:0;">
              <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
            </button>
            <h1 class="section-header-animated" style="margin:0; display:flex; align-items:center;">
              <span class="section-header-icon-wrap">
                <i data-lucide="languages"></i>
                <span class="section-header-icon-ring"></span>
              </span>
              <span class="section-header-text">
                <span class="section-header-title">Language Library</span>
                <span class="section-header-subtitle" id="lang-header-stats"></span>
              </span>
            </h1>
            ${/* Authoring lives in Admin, and the way there used to be a
                 full-width button under the board — below eleven cards, so
                 you scrolled past everything to reach it. It is an icon in
                 the header now, in the corner every other pane keeps its
                 settings in. */ ''}
            <button class="ag-icon-btn lang-admin-btn" type="button"
                    onclick="spaNavigate('admin-language')"
                    title="Manage in Admin — write words, drills and scenarios"
                    aria-label="Manage in Admin">
              <i data-lucide="settings"></i>
            </button>
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
  langBoardReset();
  langView = getSessionParam('langView') || 'dictionary';
  langViewArg = getSessionParam('langViewArg') || null;
  const target = getSessionParam('langActiveWord');
  langActiveWordId = target && langFindWord(target) ? target : null;
  renderLangLibrary();
}

function languageDestroy() {
  // Same reason as the other two attempt routes: the utterance queue lives on
  // window, so a word left mid-sentence would follow you off the screen.
  if (typeof speechStop === 'function') speechStop();
}

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

/**
 * The starter-pack offer.
 *
 * It lives in Language Admin as well, but nobody goes looking in Admin for the
 * reason a page is empty — the offer belongs beside the emptiness it fixes.
 */
function langSeedOfferHTML(line) {
  if (typeof langLoadStarter !== 'function') return '';
  /* The sidebar banner offers the same pack from the same screen, and two
     buttons for one pack is the thing being fixed. When the banner is up this
     still says what is missing — it just does not repeat the button. */
  const bannerUp = !langWords().length || (!langSets().length && !langScenarios().length);
  return `
    <div class="lang-seed-offer">
      <i data-lucide="sparkles"></i>
      <div class="lang-seed-body">
        <strong>Nothing here yet</strong>
        <span>${escapeHTML(line || 'The starter pack brings the Cebuano vocabulary — every word with a description of how it is really used and an example sentence — plus the drill sets and scenarios to practise it against. Nothing you already have is replaced.')}</span>
      </div>
      ${bannerUp ? '' : `
      <div class="lang-seed-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="langLoadStarter()">
          <i data-lucide="sparkles" style="width:14px;height:14px;"></i>
          Starter pack (${typeof langStarterSize === 'function' ? langStarterSize() : 0} words)
        </button>
      </div>`}
    </div>`;
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

/**
 * One collapsible section of the board: its heading, and the cards under it.
 *
 * The heading is a button rather than an h3 because it now does something, and
 * a heading you can only reach with a mouse is a control half the people using
 * it cannot press. It still looks exactly like the heading it replaced.
 */
function langBoardSection(key, icon, label, cards) {
  const open = !!langBoardOpen[key];
  return `
    <button class="lang-board-title" type="button" data-section="${key}"
            aria-expanded="${open ? 'true' : 'false'}"
            onclick="langToggleBoardSection('${key}')">
      <i data-lucide="chevron-right" class="lang-board-caret${open ? ' expanded' : ''}"></i>
      <i data-lucide="${icon}"></i> ${escapeHTML(label)}
    </button>
    <div class="lang-board-group${open ? '' : ' collapsed'}" data-section="${key}" role="group">
      <div class="lang-board-group-inner">${cards}</div>
    </div>`;
}

function renderLangBoard() {
  const host = document.getElementById('lang-board');
  if (!host) return;
  const words = langWords().length;
  const sets = langSets().length;
  const scenes = langScenarios().length;

  host.innerHTML = `
    <div class="lang-board">
      ${/* One banner, one pack, and a caption that names what is actually
           missing. It used to advertise "10 words" to somebody who already
           had four hundred, because it only ever checked the sets and the
           scenarios; then it offered two different packs depending on which
           half was empty, which read as two starter packs. */ ""}
      ${(!words || (!sets && !scenes)) ? `
        <button class="lang-seed-banner" type="button" onclick="langLoadStarter()">
          <i data-lucide="sparkles"></i>
          <span class="lang-seed-banner-body">
            <strong>${words ? 'Add drills and scenarios' : 'Start with the starter pack'}</strong>
            <span>${words
              ? '10 drill sets and 10 scenarios to practise against — nothing you have is replaced'
              : (typeof langStarterSize === 'function' ? langStarterSize() : 0)
                + ' words across ' + (typeof LANG_CEB_PACK !== 'undefined' ? LANG_CEB_PACK.length : 0)
                + ' topics, each with how it is really used and an example, plus drills and scenarios'
                + ' — nothing you have is replaced'}</span>
          </span>
          <i data-lucide="download" class="lang-seed-banner-go"></i>
        </button>` : ''}
      ${langBoardSection('dictionary', 'book-a', 'Dictionary',
        langBoardCard('dictionary', null, 'library-big', 'Dictionary',
          'Every entry with its meaning, and its example sentences a tap away.', `${words}`)
        + langBoardCard('compare', null, 'columns-2', 'Search & compare',
          'Find a word and read it in two languages side by side.', ''))}

      ${langBoardSection('drills', 'dumbbell', 'Drills',
        LANG_PUZZLE_TYPES.map(p => {
          const n = langTypeCount(p.type);
          return langBoardCard('drill', p.type, p.icon, p.name, p.hint, `${n}`, n ? '' : 'is-empty');
        }).join('')
        + langBoardCard('sets', null, 'layers', 'Your drill sets',
          'The sets you have written, run start to finish.', `${sets}`))}

      ${langBoardSection('adventure', 'swords', 'Adventure',
        langBoardCard('run', null, 'footprints', 'Free run',
          'Walk, meet people, and talk your way past them. Stamina is your health.', '')
        + langBoardCard('scenarios', null, 'map', 'Scenarios',
          'The encounters you have written, and who you meet in them.', `${scenes}`))}
    </div>
    <div class="lang-board-foot">
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

/** Every filter in one place, so the dictionary and the compare view agree. */
function langFilteredWords(study) {
  let list = langWords().filter(w => langMatches(w, langQuery));
  // Every selected tag must match, not any -- the point of a second tag is to
  // narrow. "verbs" plus "food" means verbs about food.
  if (langTagFilters.length) {
    list = list.filter(w => {
      const tags = w.tags || [];
      return langTagFilters.every(t => tags.includes(t));
    });
  }
  if (langPosFilter) list = list.filter(w => langForm(w, study).pos === langPosFilter);
  return list;
}

function langDictionaryHTML() {
  const study = langStudy(), ref = langRef();
  const all = langFilteredWords(study);
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  /* sort() calls the comparator O(n log n) times, and each call was building
     two headwords and a fresh collator. Decorate once, compare cheaply: 35ms
     to 4ms over the pack. */
  const sorted = all
    .map(w => ({ w: w, key: langHeadword(w, study) }))
    .sort((a, b) => collator.compare(a.key, b.key))
    .map(x => x.w);
  const list = sorted.slice(0, langShownCount);
  const hidden = sorted.length - list.length;

  const rows = list.map(w => {
    const f = langForm(w, study);
    const g = langForm(w, ref);
    const exCount = (f.examples || []).length + (g.examples || []).length;
    const head = langHeadword(w, study);
    return `
      <div class="lang-entry" role="listitem">
        <div class="lang-entry-main">
          <div class="lang-entry-head">
            <span class="lang-entry-term">${escapeHTML(head)}</span>
            ${f.pos ? `<span class="lang-pos">${escapeHTML(f.pos)}</span>` : ''}
            ${g.term ? `<span class="lang-entry-gloss">${escapeHTML(g.term)}</span>` : ''}
            ${langRecallBadgeHTML(w)}
            ${typeof agDeadlineTextHTML === 'function' ? agDeadlineTextHTML('langword', w.id) : ''}
          </div>
          <div class="lang-entry-def">${escapeHTML(f.definition || g.definition || 'No definition recorded.')}</div>
          ${f.notes ? `<div class="lang-entry-note">${langIcon('sticky-note')} ${escapeHTML(f.notes)}</div>` : ''}
          ${f.restrictions ? `<div class="lang-entry-warn">${langIcon('alert-triangle')} ${escapeHTML(f.restrictions)}</div>` : ''}
        </div>
        <div class="lang-entry-tools">
          ${langSpeakBtn(head, study)}
          <button class="ag-icon-btn" type="button" onclick="langShowExamples('${w.id}')"
                  title="${exCount ? exCount + ' example sentence' + (exCount !== 1 ? 's' : '') : 'No examples recorded'}"
                  aria-label="Example sentences for ${escapeHTML(head)}"
                  ${exCount ? '' : 'disabled'}>${langIcon('quote')}</button>
          <button class="ag-icon-btn" type="button" onclick="langShowNotes('${w.id}')"
                  title="Notes and restrictions"
                  aria-label="Notes for ${escapeHTML(head)}">${langIcon('sticky-note')}</button>
          <button class="ag-icon-btn" type="button" onclick="langOpen('compare'); langActiveWordId='${w.id}'; renderLangDetail();"
                  title="Compare side by side"
                  aria-label="Compare ${escapeHTML(head)} side by side">${langIcon('columns-2')}</button>
          <button class="ag-icon-btn" type="button" onclick="agOpenDeadlineModal('langword', '${w.id}')"
                  title="Put a due date on this word"
                  aria-label="Due date for ${escapeHTML(head)}">${langIcon('flag')}</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="library-big"></i></div>
        <div style="flex:1; min-width:0;">
          <h2 class="prog-detail-title">Dictionary</h2>
          <div class="prog-stats">
            <div class="prog-stat"><i data-lucide="book-a" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Entries</em><strong>${langWords().length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="filter" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Showing</em><strong id="lang-showing">${sorted.length}</strong></span></div>
            <div class="prog-stat"><i data-lucide="languages" style="width:13px;height:13px;"></i>
              <span class="prog-stat-body"><em>Reading</em><strong>${escapeHTML(langShort(study))} / ${escapeHTML(langShort(ref))}</strong></span></div>
          </div>
        </div>
      </div>
      ${langFilterBarHTML()}
      ${/* aria-live, because filtering changes the list silently. A screen
           reader user typing in the box had no way to know whether they had
           narrowed it to 40 entries or to none. */ ''}
      <p class="sr-only" role="status" aria-live="polite" id="lang-result-status">${langResultStatus(sorted.length)}</p>
      <div class="lang-entries" role="list">${rows || (langWords().length
        ? '<div class="lang-empty">No entries match those filters.</div>'
        : langSeedOfferHTML('Add the starter pack — ten words across all four languages, with definitions and example sentences.'))}</div>
      ${hidden > 0 ? `
        <div class="lang-more">
          <button class="btn btn-secondary btn-sm" type="button" onclick="langShowMore()">
            <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
            Show ${Math.min(hidden, LANG_PAGE)} more
          </button>
          <span class="lang-more-hint">${list.length} of ${sorted.length} shown${langQuery || langTagFilters.length || langPosFilter ? ' — every match is counted above, search covers all of them' : ''}</span>
        </div>` : ''}
    </div>`;
}

/** The sentence a screen reader hears when the result set changes. */
function langResultStatus(n) {
  if (!n) return 'No entries match.';
  return n + (n === 1 ? ' entry matches.' : ' entries match.');
}

function langShowMore() {
  langShownCount += LANG_PAGE;
  renderLangDetail();
}

function langFilterBarHTML() {
  const study = langStudy();
  const tags = langAllTags();
  const posUsed = [];
  langWords().forEach(w => {
    const p = langForm(w, study).pos;
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
      ${(langQuery || langTagFilters.length || langPosFilter) ? `
        <button class="btn btn-ghost btn-sm" onclick="langClearFilters()">
          <i data-lucide="filter-x" style="width:14px;height:14px;"></i> Clear
        </button>` : ''}
    </div>
    ${langTagbarHTML(tags)}`;
}

/* The chip cloud was 83 chips at pack size, unconditionally, taking a third
   of the pane before a single word. Selected tags first, then the rest up to
   a dozen, then a button for the tail. */
const LANG_TAGS_SHOWN = 12;

function langTagbarHTML(tags) {
  if (!tags.length) return '';
  const chosen = tags.filter(t => langTagFilters.includes(t.tag));
  const rest = tags.filter(t => !langTagFilters.includes(t.tag));
  const shown = langTagsExpanded ? rest : rest.slice(0, Math.max(0, LANG_TAGS_SHOWN - chosen.length));
  const hidden = rest.length - shown.length;
  /* THE BUG THIS REPLACES: the handler was built with JSON.stringify inside a
     double-quoted attribute, so it emitted onclick="langSetTag("food")" and
     the attribute ended at the first quote it wrote. Every one of the 83
     chips threw "Unexpected end of input" on click and filtered nothing --
     silently, because an inline handler only fails when you press it. A data
     attribute cannot be broken by its own contents. */
  const chip = t => `
    <button class="lang-tag-chip${langTagFilters.includes(t.tag) ? ' is-active' : ''}" type="button"
            data-lang-tag="${escapeHTML(t.tag)}"
            aria-pressed="${langTagFilters.includes(t.tag) ? 'true' : 'false'}"
            >${escapeHTML(t.tag)} <span>${t.count}</span></button>`;
  return `
    <div class="lang-tagbar" onclick="langTagbarClick(event)">
      ${chosen.map(chip).join('')}
      ${shown.map(chip).join('')}
      ${hidden > 0 || langTagsExpanded ? `
        <button class="lang-tag-more" type="button" onclick="langToggleTags(event)">
          ${langTagsExpanded ? 'Show fewer' : '+' + hidden + ' more'}
        </button>` : ''}
    </div>`;
}

/** One listener for the whole cloud, so a chip's own text cannot break it. */
function langTagbarClick(e) {
  const chip = e.target && e.target.closest ? e.target.closest('[data-lang-tag]') : null;
  if (!chip) return;
  langSetTag(chip.getAttribute('data-lang-tag'));
}

function langToggleTags(e) {
  if (e) e.stopPropagation();
  langTagsExpanded = !langTagsExpanded;
  renderLangDetail();
}

/* The query is kept out of the re-render: replacing the input while it has
   focus would drop the caret to the end on every keystroke. */
function langSetQuery(v) {
  langQuery = (v || '').trim();
  langShownCount = LANG_PAGE;   // a new query starts a new list
  const host = document.querySelector('.lang-entries');
  if (!host) { renderLangDetail(); return; }
  const fresh = document.createElement('div');
  fresh.innerHTML = langView === 'compare' ? langCompareHTML() : langDictionaryHTML();
  const next = fresh.querySelector('.lang-entries') || fresh.querySelector('.lang-compare-results');
  if (next) { host.innerHTML = next.innerHTML; if (typeof lucide !== 'undefined') lucide.createIcons({ root: host }); }
  /* Only the list is swapped, to keep focus in the box -- so everything that
     lives outside that container has to be carried over by hand. */
  const carry = (sel, prop) => {
    const a = document.querySelector(sel), b = fresh.querySelector(sel);
    if (a && b) a[prop] = b[prop];
  };
  carry('#lang-showing', 'textContent');
  carry('#lang-result-status', 'textContent');
  const more = document.querySelector('.lang-more');
  const freshMore = fresh.querySelector('.lang-more');
  if (more && freshMore) more.innerHTML = freshMore.innerHTML;
  else if (more && !freshMore) more.remove();
  else if (!more && freshMore) host.insertAdjacentElement('afterend', freshMore);
  const moreNow = document.querySelector('.lang-more');
  if (moreNow && typeof lucide !== 'undefined') lucide.createIcons({ root: moreNow });
}

/** Add or remove one tag from the set. Narrowing the filter starts the list over. */
function langSetTag(tag) {
  if (!tag) return;
  const i = langTagFilters.indexOf(tag);
  if (i > -1) langTagFilters.splice(i, 1);
  else langTagFilters.push(tag);
  langShownCount = LANG_PAGE;
  renderLangDetail();
}
function langSetPos(p) { langPosFilter = p || null; langShownCount = LANG_PAGE; renderLangDetail(); }
function langClearFilters() {
  langQuery = ''; langTagFilters = []; langPosFilter = null;
  langTagsExpanded = false; langShownCount = LANG_PAGE;
  renderLangDetail();
}

/** Example sentences, in a popup rather than crowding every row. */
function langShowExamples(id) {
  const w = langFindWord(id);
  if (!w) return;
  const body = LANG_CODES.map(c => {
    const f = langForm(w, c);
    if (!f || !(f.examples || []).length) return '';
    return `
      <div class="lang-pop-lang">
        <div class="lang-pop-head"><span class="lang-col-code">${escapeHTML(langShort(c))}</span> ${escapeHTML(langName(c))}</div>
        <ul class="lang-examples">
          ${f.examples.map(e => `<li>
            <span class="lang-ex-text">${escapeHTML(e.text)}</span>${langSpeakBtn(e.text, c)}
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
    const f = langForm(w, c);
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
  const list = langFilteredWords(study);
  const w = langActiveWordId ? langFindWord(langActiveWordId) : (list[0] || null);

  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="columns-2"></i></div>
        <div style="flex:1; min-width:0;">
          <h2 class="prog-detail-title">Search &amp; compare</h2>
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
  const f = langForm(w, code);
  const empty = !(f.term || '').trim();
  return `
    <div class="lang-col${isStudy ? ' is-study' : ''}${empty ? ' is-empty' : ''}">
      <div class="lang-col-head">
        <span class="lang-col-code">${escapeHTML(langShort(code))}</span>
        <span class="lang-col-name">${escapeHTML(langName(code))}</span>
        <span class="lang-col-role">${isStudy ? 'learning' : 'reference'}</span>
      </div>
      ${empty ? `<div class="lang-col-empty">Nothing recorded in ${escapeHTML(langName(code))} yet.</div>` : `
        <div class="lang-term">${escapeHTML(f.term)}${f.pos ? `<span class="lang-pos">${escapeHTML(f.pos)}</span>` : ''}${langSpeakBtn(f.term, code)}</div>
        ${f.definition ? `<p class="lang-def">${escapeHTML(f.definition)}</p>` : ''}
        ${(f.examples || []).length ? `
          <div class="lang-block">
            <h4><i data-lucide="quote"></i> Examples</h4>
            <ul class="lang-examples">
              ${f.examples.map(e => `<li>
                <span class="lang-ex-text">${escapeHTML(e.text)}</span>${langSpeakBtn(e.text, code)}
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
  const filled = rest.filter(c => (langForm(w, c).term || '').trim());
  if (!filled.length) return '';
  return `
    <h2 class="prog-detail-section-title" style="margin-top:1.5rem;"><i data-lucide="languages"></i> Also recorded</h2>
    <div class="lang-other-row">
      ${filled.map(c => `
        <button class="lang-other" type="button" onclick="langSetStudy('${c}')" title="Switch to ${escapeHTML(langName(c))}">
          <span class="lang-col-code">${escapeHTML(langShort(c))}</span>
          <span class="lang-other-term">${escapeHTML(langForm(w, c).term)}</span>
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
          <h2 class="prog-detail-title">${escapeHTML(meta.name)}</h2>
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
        </div>
        ${langSets().length ? '' : langSeedOfferHTML('The starter pack brings ten questions of every type, including this one.')}`}
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
          <h2 class="prog-detail-title">Your drill sets</h2>
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
                ${typeof agDeadlineTextHTML === 'function' ? agDeadlineTextHTML('langset', s.id) : ''}
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="agOpenDeadlineModal('langset', '${s.id}')"
                    title="${typeof agGetDeadline === 'function' && agGetDeadline('langset', s.id) ? 'Change or clear the deadline' : 'Put a due date on this set'}">
              <i data-lucide="flag" style="width:14px;height:14px;"></i>
            </button>
            <button class="btn btn-practice btn-sm" onclick="langPromptTimer('set', '${s.id}')" ${problems.length ? 'disabled' : ''}>
              <i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Run
            </button>
          </div>`;
        }).join('') || langSeedOfferHTML('The starter pack brings ten sets, five questions each — one of every puzzle type.')}
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
          <h2 class="prog-detail-title">Free run</h2>
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
            <li>Choose <strong>Run</strong> to walk on. Each leg costs ${LANG_RUN_STEP_COST} stamina,
                and any block where nobody stops you raises your <em>maximum</em> by
                ${LANG_RUN_ENDURANCE_GAIN}. Running builds the capacity to run.</li>
            <li>Sooner or later somebody stops you, and they speak first.</li>
            <li>Reply well and you take no damage and get some stamina back. Reply badly and it drains.</li>
            <li>Beat them and your maximum rises by a further ${LANG_RUN_STAMINA_GAIN}.</li>
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
        </div>
        ${langSeedOfferHTML('The starter pack gives you people to meet straight away.')}`
      : `<div class="prog-detail-actions" style="margin-top:1.25rem;">
          <button class="btn btn-practice btn-lg" onclick="langStartRun()">
            <i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Set off
          </button>
        </div>`}

    </div>`;
}

function langScenariosHTML() {
  const list = langScenarios();
  return `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="map"></i></div>
        <div style="flex:1; min-width:0;">
          <h2 class="prog-detail-title">Scenarios</h2>
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
        }).join('') || langSeedOfferHTML('The starter pack brings ten scenarios across all six locations.')}
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

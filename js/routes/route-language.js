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
  /* Paging and filters are per-visit, like the board's sections. Leaving with
     600 rows painted and a tag selected and coming back to exactly that is
     somebody else's screen -- and the 600 rows are paid for again on arrival,
     which is the cost the cap exists to avoid. */
  langShownCount = LANG_PAGE;
  langQuery = '';
  langTagFilters = [];
  langPosFilter = null;
  langTagsExpanded = false;
  langCmpGaps = false;
  langCmpShown = LANG_CMP_PAGE;
  langView = getSessionParam('langView') || 'dictionary';
  langViewArg = getSessionParam('langViewArg') || null;
  const target = getSessionParam('langActiveWord');
  langActiveWordId = target && langFindWord(target) ? target : null;
  // Once a visit is enough to clear out records for words that have gone.
  if (typeof langRecallPrune === 'function') langRecallPrune();
  renderLangLibrary();
}

function languageDestroy() {
  // Same reason as the other two attempt routes: the utterance queue lives on
  // window, so a word left mid-sentence would follow you off the screen.
  if (typeof speechStop === 'function') speechStop();
  langCloseTagPicker();
}

/* ── The language pair ────────────────────────────────────── */

/* Two dropdowns rather than two rows of every language at once. Eight pills,
   four of them greyed out on any given screen, was a lot of furniture for a
   choice made once and then left alone. The dropdowns are the app's shared
   custom select, so they open the way every other picker does. */
function langPairBarHTML() {
  return `
    <div class="lang-pair-bar">
      <div class="lang-pair-side">
        <span class="lang-pair-label">Learning</span>
        <div id="lang-study-select" class="lang-pair-select"></div>
      </div>
      <button class="lang-swap-btn" type="button" onclick="langSwapPair()" title="Swap the two languages" aria-label="Swap the two languages">
        <i data-lucide="arrow-left-right"></i>
      </button>
      <div class="lang-pair-side">
        <span class="lang-pair-label">Compare to</span>
        <div id="lang-ref-select" class="lang-pair-select"></div>
      </div>
    </div>`;
}

/** Fill the two dropdowns the pair bar left room for. */
function langPaintPairSelects() {
  const study = langStudy(), ref = langRef();
  const opts = (other) => LANGS.map(l => ({
    value: l.code,
    label: l.name,
    // The other side's language is still on the list: picking it swaps the
    // pair, which is what someone choosing it almost always means.
    badge: l.code === other ? 'swap' : l.short
  }));
  if (typeof renderCustomSelect !== 'function') return;
  renderCustomSelect('lang-study-select', opts(ref), study, langPickStudy, 'Language', { searchable: false });
  renderCustomSelect('lang-ref-select', opts(study), ref, langPickRef, 'Language', { searchable: false });
}

function langPickStudy(code) {
  if (code === langStudy()) return;
  if (code === langRef()) langSwapPair(); else langSetStudy(code);
}

function langPickRef(code) {
  if (code === langRef()) return;
  if (code === langStudy()) langSwapPair(); else langSetRef(code);
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
  if (bar) { bar.innerHTML = langPairBarHTML(); langPaintPairSelects(); }
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
            onclick="langOpen('${view}'${arg ? `, '${arg}'` : ''})" title="${escapeHTML(desc)}">
      <span class="lang-card-icon"><i data-lucide="${icon}"></i></span>
      ${chip ? `<span class="lang-card-chip">${chip}</span>` : ''}
      <span class="lang-card-name">${escapeHTML(name)}</span>
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
  const n = (cards.match(/class="lang-card[ "]/g) || []).length;
  return `
    <button class="lang-board-title" type="button" data-section="${key}"
            aria-expanded="${open ? 'true' : 'false'}"
            onclick="langToggleBoardSection('${key}')">
      <span class="lang-board-ico"><i data-lucide="${icon}"></i></span>
      <span class="lang-board-label">${escapeHTML(label)}</span>
      <span class="lang-board-count">${n}</span>
      <i data-lucide="chevron-right" class="lang-board-caret${open ? ' expanded' : ''}"></i>
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

let _langLastView = '';

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
  if (typeof lpvArtStyles === 'function') lpvArtStyles();
  /* A filter click redraws the same page. Playing the whole entrance again
     on every tick read as the page reloading; only a new page slides in. */
  const key = langView + ':' + (langViewArg || '');
  host.classList.toggle('lpv-quiet', key === _langLastView);
  _langLastView = key;
  host.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  // The previews play by themselves and stop when this pane is redrawn.
  if (typeof lpvBoot === 'function') lpvBoot(host);
  const activeWord = host.querySelector('.lpv-word.is-active');
  if (activeWord) langCmpReveal(activeWord);
}

/* ── Dictionary ───────────────────────────────────────────── */

/**
 * Every filter in one place, so the dictionary and the compare view agree.
 *
 * @param {string} study the language being learnt
 * @param {boolean} [withPos] apply the part-of-speech filter too. Only the
 *   dictionary passes this: the dropdown lives there, and compare has no way
 *   to show a filter it inherited, so a list silently missing two thirds of
 *   its words was the result. It only became reachable once the pack started
 *   carrying parts of speech at all.
 */
function langFilteredWords(study, withPos) {
  let list = langWords().filter(w => langMatches(w, langQuery));
  // Every selected tag must match, not any -- the point of a second tag is to
  // narrow. "verbs" plus "food" means verbs about food.
  if (langTagFilters.length) {
    list = list.filter(w => {
      const tags = w.tags || [];
      return langTagFilters.every(t => tags.includes(t));
    });
  }
  if (withPos && langPosFilter) list = list.filter(w => langForm(w, study).pos === langPosFilter);
  return list;
}

function langDictionaryHTML() {
  const study = langStudy(), ref = langRef();
  const all = langFilteredWords(study, true);
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

  const rs = typeof langRecallSummary === 'function' ? langRecallSummary() : null;
  const flip = langFlipWords();
  return `
    <div class="lpv-page lpv-tone-primary lpv-dict">
      ${langHeroHTML('library-big', 'Words', 'Dictionary',
        'Every word with its meaning. Tap the speaker to hear one.',
        flip.length ? lpvWordFlipHTML(flip) : '')}
      <div class="lpv-stats lpv-in" style="--i:1">
        ${langStatHTML('book-a', langWords().length, 'Entries')}
        <div class="lpv-stat">
          <span class="lpv-stat-ico"><i data-lucide="filter"></i></span>
          <span class="lpv-stat-body"><b id="lang-showing">${sorted.length}</b><em>Showing</em></span>
        </div>
        ${rs ? langStatHTML('alarm-clock', rs.due, 'Due for review') : ''}
        ${rs ? langStatHTML('sparkles', rs.known, 'Known') : ''}
      </div>
      <div class="lpv-in" style="--i:2">${langFilterBarHTML()}</div>
      ${/* aria-live, because filtering changes the list silently. A screen
           reader user typing in the box had no way to know whether they had
           narrowed it to 40 entries or to none. */ ''}
      <p class="sr-only" role="status" aria-live="polite" id="lang-result-status">${langResultStatus(sorted.length)}</p>
      <div class="lang-entries" role="list">${rows || (langWords().length
        ? '<div class="lang-empty">No entries match those filters.</div>'
        : langSeedOfferHTML('Add the starter pack — ' + langStarterSize() + ' words with how each is really used and an example sentence, plus drill sets and scenarios.'))}</div>
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

/** A handful of your words for the Dictionary's flip card, in both languages. */
function langFlipWords() {
  const study = langStudy(), ref = langRef();
  const out = [];
  lpvShuffle(langWords()).some(w => {
    const f = langForm(w, study), g = langForm(w, ref);
    if (!String(f.term || '').trim() || !String(g.term || '').trim()) return false;
    const d = String(f.definition || g.definition || '');
    out.push({ t: f.term, p: f.pos || '', g: g.term, d: d.length > 90 ? d.slice(0, 88) + '…' : d,
               sl: langName(study), rl: langName(ref) });
    return out.length >= 8;
  });
  return out;
}

/** The sentence a screen reader hears when the result set changes. */
function langResultStatus(n) {
  if (!n) return 'No entries match.';
  return n + (n === 1 ? ' entry matches.' : ' entries match.');
}

/**
 * Show the next page.
 *
 * Re-rendering replaces the button that was just pressed, and the browser
 * then drops focus to <body> -- so a keyboard user who pressed Enter on
 * "Show more" was thrown to the top of the tab order and had to walk back
 * through every row they had just revealed. Put focus back on the button in
 * its new incarnation, or on the last row when the button is gone because
 * there is nothing left to show.
 */
function langShowMore() {
  langShownCount += LANG_PAGE;
  renderLangDetail();
  const next = document.querySelector('.lang-more button');
  if (next) { next.focus(); return; }
  const rows = document.querySelectorAll('.lang-entry');
  const last = rows[rows.length - 1];
  const btn = last && last.querySelector('button:not([disabled])');
  if (btn) btn.focus();
}

function langFilterBarHTML() {
  const study = langStudy();
  const tags = langAllTags();
  const posUsed = [];
  langWords().forEach(w => {
    const p = langForm(w, study).pos;
    if (p && posUsed.indexOf(p) === -1) posUsed.push(p);
  });
  const nTags = langTagFilters.length;
  const busy = langQuery || nTags || langPosFilter || (langView === 'compare' && langCmpGaps);
  return `
    <div class="lang-filterbar">
      <div class="search-container" style="flex:1; min-width:200px;">
        <i data-lucide="search"></i>
        <input type="text" class="search-input" id="lang-q" placeholder="Search every language…"
               autocomplete="off" value="${escapeHTML(langQuery)}" oninput="langSetQuery(this.value)" />
      </div>
      ${tags.length ? `
        <button class="lpv-filter-btn${nTags ? ' is-on' : ''}" type="button" onclick="langOpenTagPicker(this)"
                aria-haspopup="dialog" title="Filter by topic">
          <i data-lucide="tags"></i> Topics ${nTags ? `<b>${nTags}</b>` : `<em>${tags.length}</em>`}
          <i data-lucide="chevron-down"></i>
        </button>` : ''}
      ${/* Part of speech only narrows the Dictionary -- Compare never applied
           it, so on that page the dropdown did nothing at all. */ ''}
      ${posUsed.length && langView === 'dictionary' ? `
        <select class="form-select lang-filter-select lpv-select${langPosFilter ? ' is-on' : ''}" onchange="langSetPos(this.value)" aria-label="Part of speech">
          <option value="">Any part of speech</option>
          ${posUsed.sort().map(p => `<option value="${p}"${langPosFilter === p ? ' selected' : ''}>${p}</option>`).join('')}
        </select>` : ''}
      ${busy ? `
        <button class="btn btn-ghost btn-sm" onclick="langClearFilters()">
          <i data-lucide="filter-x" style="width:14px;height:14px;"></i> Clear
        </button>` : ''}
    </div>
    ${langTagbarHTML(tags)}`;
}

/* Topics, in two sizes. The chips were 83 of them at pack size in an 11px
   face -- hard to read and a wall to scan. Now a handful of the most used sit
   under the search as proper buttons, the ones you have chosen always first,
   and every topic is one click away in a searchable picker with counts. */
const LANG_QUICK_TAGS = 8;

function langTagbarHTML(tags) {
  if (!tags.length) return '';
  const chosen = tags.filter(t => langTagFilters.includes(t.tag));
  const top = tags.filter(t => !langTagFilters.includes(t.tag))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, Math.max(0, LANG_QUICK_TAGS - chosen.length));
  /* THE BUG THIS REPLACES: the handler was built with JSON.stringify inside a
     double-quoted attribute, so it emitted onclick="langSetTag("food")" and
     the attribute ended at the first quote it wrote. Every one of the 83
     chips threw "Unexpected end of input" on click and filtered nothing --
     silently, because an inline handler only fails when you press it. A data
     attribute cannot be broken by its own contents. */
  const chip = t => {
    const on = langTagFilters.includes(t.tag);
    return `
    <button class="lang-tag-chip${on ? ' is-active' : ''}" type="button"
            data-lang-tag="${escapeHTML(t.tag)}" data-tc="${langTagTone(t.tag)}"
            aria-pressed="${on ? 'true' : 'false'}" title="${on ? 'Remove this filter' : 'Show only ' + escapeHTML(t.tag)}"
            >${on ? '<i data-lucide="x"></i>' : '<i data-lucide="hash"></i>'}${escapeHTML(t.tag)} <span>${t.count}</span></button>`;
  };
  return `
    <div class="lang-tagbar" onclick="langTagbarClick(event)">
      <span class="lang-tagbar-label">${chosen.length ? 'Filtering by' : 'Popular'}</span>
      ${chosen.map(chip).join('')}
      ${top.map(chip).join('')}
      ${tags.length > chosen.length + top.length ? `
        <button class="lang-tag-more" type="button" onclick="langOpenTagPicker(this)">
          <i data-lucide="layout-grid"></i> All ${tags.length} topics
        </button>` : ''}
    </div>`;
}

/** A stable colour for a topic, so "food" is the same colour everywhere. */
function langTagTone(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return h % 5;
}

/* ── The topic picker ─────────────────────────────────────────
   A popover with a search box and a checkbox per topic. Choices are held
   until "Show N words" -- applying each tick at once would redraw the page
   under the popover on every click -- and the button counts what the choice
   would leave, so an empty combination is visible before it is applied. */
let _langTagPending = null;

function langOpenTagPicker(btn) {
  langCloseTagPicker();
  const tags = langAllTags().slice().sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  _langTagPending = langTagFilters.slice();
  const pop = document.createElement('div');
  pop.id = 'lang-tag-pop';
  pop.className = 'lpv-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Filter by topic');
  pop.innerHTML = `
    <div class="lpv-pop-head">
      <div class="search-container">
        <i data-lucide="search"></i>
        <input type="text" class="search-input" id="lang-tag-q" placeholder="Find a topic…" autocomplete="off"
               oninput="langTagPickFind(this.value)" />
      </div>
    </div>
    <div class="lpv-pop-list" onchange="langTagPickToggle(event)">
      ${tags.map(t => `
        <label class="lpv-pop-row" data-tag-name="${escapeHTML(t.tag.toLowerCase())}">
          <input type="checkbox" value="${escapeHTML(t.tag)}"${_langTagPending.includes(t.tag) ? ' checked' : ''} />
          <span class="lpv-pop-dot" data-tc="${langTagTone(t.tag)}"></span>
          <span class="lpv-pop-name">${escapeHTML(t.tag)}</span>
          <em>${t.count}</em>
        </label>`).join('')}
      <div class="lpv-pop-none" hidden>No topic by that name.</div>
    </div>
    <div class="lpv-pop-foot">
      <button class="btn btn-ghost btn-sm" type="button" onclick="langTagPickClear()">Clear</button>
      <button class="btn btn-primary btn-sm" type="button" id="lang-tag-apply" onclick="langTagPickApply()"></button>
    </div>`;
  document.body.appendChild(pop);
  // Under the button, or above it when there is more room there.
  const r = btn.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = Math.min(340, vw - 24);
  pop.style.width = width + 'px';
  pop.style.left = Math.max(12, Math.min(r.left, vw - width - 12)) + 'px';
  const below = vh - r.bottom, above = r.top;
  if (below < 340 && above > below) {
    pop.style.bottom = (vh - r.top + 6) + 'px';
    pop.style.maxHeight = Math.max(220, above - 18) + 'px';
  } else {
    pop.style.top = (r.bottom + 6) + 'px';
    pop.style.maxHeight = Math.max(220, below - 18) + 'px';
  }
  langTagPickCount();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: pop });
  const q = document.getElementById('lang-tag-q');
  if (q) q.focus();
  // Next tick, so the click that opened it is not also the click that closes it.
  setTimeout(() => {
    if (!document.getElementById('lang-tag-pop')) return;
    document.addEventListener('mousedown', langTagPickOutside, true);
    document.addEventListener('keydown', langTagPickKeys, true);
    document.addEventListener('scroll', langTagPickOutside, true);
  }, 0);
}

function langCloseTagPicker() {
  const pop = document.getElementById('lang-tag-pop');
  if (pop) pop.remove();
  document.removeEventListener('mousedown', langTagPickOutside, true);
  document.removeEventListener('keydown', langTagPickKeys, true);
  document.removeEventListener('scroll', langTagPickOutside, true);
  _langTagPending = null;
}

function langTagPickOutside(e) {
  const pop = document.getElementById('lang-tag-pop');
  if (pop && !pop.contains(e.target)) langCloseTagPicker();
}

function langTagPickKeys(e) {
  const pop = document.getElementById('lang-tag-pop');
  if (!pop) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); langCloseTagPicker(); }
  else if (e.key === 'Enter' && e.target && e.target.id === 'lang-tag-q') { e.preventDefault(); langTagPickApply(); }
}

function langTagPickToggle(e) {
  const cb = e.target;
  if (!cb || cb.type !== 'checkbox' || !_langTagPending) return;
  const i = _langTagPending.indexOf(cb.value);
  if (cb.checked && i < 0) _langTagPending.push(cb.value);
  if (!cb.checked && i > -1) _langTagPending.splice(i, 1);
  langTagPickCount();
}

function langTagPickFind(q) {
  const needle = String(q || '').trim().toLowerCase();
  let any = false;
  document.querySelectorAll('#lang-tag-pop .lpv-pop-row').forEach(row => {
    const hit = !needle || row.dataset.tagName.indexOf(needle) > -1;
    row.hidden = !hit;
    if (hit) any = true;
  });
  const none = document.querySelector('#lang-tag-pop .lpv-pop-none');
  if (none) none.hidden = any;
}

/** How many words the ticked topics would leave, on the apply button. */
function langTagPickCount() {
  const btn = document.getElementById('lang-tag-apply');
  if (!btn || !_langTagPending) return;
  const keep = langTagFilters;
  langTagFilters = _langTagPending;
  const n = (langView === 'compare' ? langCmpList(langStudy(), langRef()) : langFilteredWords(langStudy(), true)).length;
  langTagFilters = keep;
  btn.textContent = 'Show ' + n + (n === 1 ? ' word' : ' words');
}

function langTagPickClear() {
  if (!_langTagPending) return;
  _langTagPending = [];
  document.querySelectorAll('#lang-tag-pop input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  langTagPickCount();
}

function langTagPickApply() {
  if (!_langTagPending) return;
  langTagFilters = _langTagPending.slice();
  langShownCount = LANG_PAGE;
  langCmpShown = LANG_CMP_PAGE;
  langCloseTagPicker();
  renderLangDetail();
}

/** One listener for the whole cloud, so a chip's own text cannot break it. */
function langTagbarClick(e) {
  const chip = e.target && e.target.closest ? e.target.closest('[data-lang-tag]') : null;
  if (!chip) return;
  langSetTag(chip.getAttribute('data-lang-tag'));
}

/* The query is kept out of the re-render: replacing the input while it has
   focus would drop the caret to the end on every keystroke. */
function langSetQuery(v) {
  langQuery = (v || '').trim();
  langShownCount = LANG_PAGE;   // a new query starts a new list
  langCmpShown = LANG_CMP_PAGE;
  langSwapResults();
}

/** Repaint the results under the filter bar, leaving the search box alone. */
function langSwapResults() {
  /* Compare has its results in .lang-compare-results, not .lang-entries.
     Looking only for the Dictionary's list sent every keystroke in Compare
     down the full re-render below -- which replaced the box being typed in
     and replayed the whole page's entrance on each letter. */
  const sel = langView === 'compare' ? '.lang-compare-results' : '.lang-entries';
  const host = document.querySelector(sel);
  if (!host) { renderLangDetail(); return; }
  const fresh = document.createElement('div');
  fresh.innerHTML = langView === 'compare' ? langCompareHTML() : langDictionaryHTML();
  const next = fresh.querySelector(sel);
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
  langCmpShown = LANG_CMP_PAGE;
  renderLangDetail();
}
function langSetPos(p) { langPosFilter = p || null; langShownCount = LANG_PAGE; renderLangDetail(); }
function langClearFilters() {
  langQuery = ''; langTagFilters = []; langPosFilter = null;
  langTagsExpanded = false; langShownCount = LANG_PAGE;
  langCmpGaps = false; langCmpShown = LANG_CMP_PAGE;
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

/* A list, not a cloud. The word picker was a row of chips -- forty of them,
   cut off silently, out of a thousand -- so the word you wanted was usually
   not on screen and there was no way to reach it but typing. Now every match
   is in a scrolling list beside the comparison, eighty at a time with more on
   request, and arrow keys walk it. */
const LANG_CMP_PAGE = 80;
let langCmpShown = LANG_CMP_PAGE;
let langCmpGaps = false;      // only words still missing the reference language

/** Every word the filters let through, plus the gaps-only switch. */
function langCmpList(study, ref) {
  let list = langFilteredWords(study);
  if (langCmpGaps) list = list.filter(x => !String(langForm(x, ref).term || '').trim());
  return list;
}

function langCompareHTML() {
  const study = langStudy(), ref = langRef();
  const list = langCmpList(study, ref);
  // How much of the library is readable both ways -- and what to fill in.
  let both = 0;
  langWords().forEach(x => {
    if (String(langForm(x, study).term || '').trim() && String(langForm(x, ref).term || '').trim()) both++;
  });
  const gaps = langWords().length - both;

  return `
    <div class="lpv-page lpv-tone-primary lpv-cmp" data-a="${escapeHTML(study)}" data-b="${escapeHTML(ref)}">
      ${langHeroHTML('columns-2', 'Words', 'Search & compare',
        'Read a word in ' + langName(study) + ' and ' + langName(ref) + ', side by side.', `
        <div class="lpv-pair">
          <span class="lpv-pair-lang is-study" data-lc="${escapeHTML(study)}"><b>${escapeHTML(langShort(study))}</b><em>${escapeHTML(langName(study))}</em></span>
          <button class="lpv-pair-arrows" type="button" onclick="langSwapPair()" title="Swap the two languages" aria-label="Swap the two languages">
            <i data-lucide="arrow-right"></i><i data-lucide="arrow-left"></i>
          </button>
          <span class="lpv-pair-lang" data-lc="${escapeHTML(ref)}"><b>${escapeHTML(langShort(ref))}</b><em>${escapeHTML(langName(ref))}</em></span>
        </div>`)}
      <div class="lpv-stats lpv-in" style="--i:1">
        <div class="lpv-stat">
          <span class="lpv-stat-ico"><i data-lucide="search"></i></span>
          <span class="lpv-stat-body"><b id="lang-showing">${list.length}</b><em>Matching</em></span>
        </div>
        ${langStatHTML('link', both, 'In both languages')}
        <button class="lpv-stat is-toggle${langCmpGaps ? ' is-on' : ''}" type="button" onclick="langCmpToggleGaps()"
                aria-pressed="${langCmpGaps ? 'true' : 'false'}"
                title="${langCmpGaps ? 'Show every word again' : 'Show only the words still missing ' + escapeHTML(langName(ref))}">
          <span class="lpv-stat-ico"><i data-lucide="circle-dashed"></i></span>
          <span class="lpv-stat-body"><b>${gaps}</b><em>${langCmpGaps ? 'Showing only these' : 'Missing a translation'}</em></span>
        </button>
      </div>
      <div class="lpv-in" style="--i:2">${langFilterBarHTML()}</div>
      <div class="lang-compare-results lpv-in" style="--i:3">${langCmpResultsHTML(list, study, ref)}</div>
    </div>`;
}

/** The list and the comparison -- the part search swaps without a redraw. */
function langCmpResultsHTML(list, study, ref) {
  if (!list.length) {
    return `
      <div class="lpv-empty">
        <span class="lpv-empty-ico"><i data-lucide="search-x"></i></span>
        <b>No words match</b>
        <p>${langCmpGaps ? 'Every word here has its ' + escapeHTML(langName(ref)) + ' — nothing missing.' : 'Try fewer topics, or another spelling.'}</p>
        ${langQuery || langTagFilters.length || langCmpGaps ? `<button class="lpv-alt" type="button" onclick="langClearFilters()"><i data-lucide="filter-x"></i> Clear filters</button>` : ''}
      </div>`;
  }
  const active = langActiveWordId ? langFindWord(langActiveWordId) : null;
  const w = (active && list.indexOf(active) > -1) ? active : list[0];
  const at = list.indexOf(w);
  // The word on show is always in the painted part of the list.
  const shown = Math.max(langCmpShown, at + 1);
  const rows = list.slice(0, shown).map((x, i) => {
    const t = langHeadword(x, study);
    const g = String(langForm(x, ref).term || '').trim();
    return `
      <button class="lpv-word${x === w ? ' is-active' : ''}" type="button" role="option"
              aria-selected="${x === w ? 'true' : 'false'}" data-id="${x.id}" data-i="${i}"
              onclick="langPickWord('${x.id}')">
        <b>${escapeHTML(t)}</b>
        ${g ? `<span>${escapeHTML(g)}</span>` : `<span class="is-gap"><i data-lucide="circle-dashed"></i> no ${escapeHTML(langShort(ref))}</span>`}
      </button>`;
  }).join('');
  return `
    <div class="lpv-cmp-layout">
      <div class="lpv-wordlist">
        <div class="lpv-wordlist-head">
          <span>${list.length} word${list.length !== 1 ? 's' : ''}</span>
          <span class="lpv-wordlist-keys"><kbd>↑</kbd><kbd>↓</kbd> to move</span>
        </div>
        <div class="lpv-wordlist-rows" role="listbox" aria-label="Words" tabindex="0" onkeydown="langCmpKey(event)">${rows}
          ${list.length > shown ? `
            <button class="lpv-wordlist-more" type="button" onclick="langCmpMore()">
              <i data-lucide="chevron-down"></i> ${Math.min(LANG_CMP_PAGE, list.length - shown)} more of ${list.length - shown}
            </button>` : ''}
        </div>
      </div>
      <div class="lpv-cmp-main" id="lang-cmp-main">${langCmpMainHTML(w, study, ref, at, list.length)}</div>
    </div>`;
}

/** The two columns for one word, with a way to step to its neighbours. */
function langCmpMainHTML(w, study, ref, at, total) {
  return `
    <div class="lpv-cmp-nav">
      <button class="ag-icon-btn" type="button" onclick="langCmpStep(-1)" ${at <= 0 ? 'disabled' : ''} title="Previous word" aria-label="Previous word">
        <i data-lucide="chevron-left"></i></button>
      <span><b>${at + 1}</b> of ${total}</span>
      <button class="ag-icon-btn" type="button" onclick="langCmpStep(1)" ${at >= total - 1 ? 'disabled' : ''} title="Next word" aria-label="Next word">
        <i data-lucide="chevron-right"></i></button>
    </div>
    <div class="lang-compare">
      ${langFormColumnHTML(w, study, true)}
      ${langFormColumnHTML(w, ref, false)}
    </div>
    ${langOtherLangsHTML(w, [study, ref])}`;
}

/* Choosing a word repaints only the comparison and moves the highlight, so
   the list keeps its scroll position and nothing replays its entrance. */
function langPickWord(id, focusRow) {
  const study = langStudy(), ref = langRef();
  const list = langCmpList(study, ref);
  const w = langFindWord(id);
  const at = list.indexOf(w);
  if (!w || at < 0) return;
  langActiveWordId = id;
  const main = document.getElementById('lang-cmp-main');
  if (!main) { renderLangDetail(); return; }
  main.innerHTML = langCmpMainHTML(w, study, ref, at, list.length);
  main.classList.add('is-swap');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: main });
  let row = null;
  document.querySelectorAll('.lpv-word').forEach(r => {
    const on = r.dataset.id === id;
    r.classList.toggle('is-active', on);
    r.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) row = r;
  });
  if (!row) { langCmpRedraw(focusRow); return; }   // stepped past the painted rows
  langCmpReveal(row);
  if (focusRow) row.focus({ preventScroll: true });
}

/** Keep a row in view inside the list, without scrolling the whole pane. */
function langCmpReveal(row) {
  const box = row && row.closest('.lpv-wordlist-rows');
  if (!box) return;
  const top = row.offsetTop - box.offsetTop;
  if (top < box.scrollTop) box.scrollTop = top - 8;
  else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight + 8;
}

function langCmpStep(d) {
  const list = langCmpList(langStudy(), langRef());
  const cur = list.findIndex(x => x.id === langActiveWordId);
  const next = list[Math.max(0, Math.min(list.length - 1, (cur < 0 ? 0 : cur) + d))];
  if (!next) return;
  // Stepping off the end of the painted page paints the next page first.
  if (list.indexOf(next) >= langCmpShown) langCmpShown += LANG_CMP_PAGE;
  const inList = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.lpv-wordlist-rows'));
  if (!document.querySelector('.lpv-word[data-id="' + next.id + '"]')) { langActiveWordId = next.id; langCmpRedraw(inList); return; }
  langPickWord(next.id, inList);
}

function langCmpKey(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    langCmpStep(e.key === 'ArrowDown' ? 1 : -1);
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    const list = langCmpList(langStudy(), langRef());
    const target = e.key === 'Home' ? list[0] : list[list.length - 1];
    if (!target) return;
    if (e.key === 'End') langCmpShown = Math.max(langCmpShown, list.length);
    langActiveWordId = target.id;
    langCmpRedraw(true);
  }
}

/** Redraw the list and comparison, and keep the keyboard in the list. */
function langCmpRedraw(focusRow) {
  langSwapResults();
  const row = document.querySelector('.lpv-word.is-active');
  if (!row) return;
  langCmpReveal(row);
  if (focusRow) row.focus({ preventScroll: true });
}

function langCmpMore() {
  const box = document.querySelector('.lpv-wordlist-rows');
  const keep = box ? box.scrollTop : 0;
  langCmpShown += LANG_CMP_PAGE;
  langSwapResults();
  const again = document.querySelector('.lpv-wordlist-rows');
  if (again) again.scrollTop = keep;
}

function langCmpToggleGaps() {
  langCmpGaps = !langCmpGaps;
  langCmpShown = LANG_CMP_PAGE;
  renderLangDetail();
}

function langFormColumnHTML(w, code, isStudy) {
  const f = langForm(w, code);
  const empty = !(f.term || '').trim();
  return `
    <div class="lang-col${isStudy ? ' is-study' : ''}${empty ? ' is-empty' : ''}" data-lc="${escapeHTML(code)}">
      <div class="lang-col-head">
        <span class="lang-col-code">${escapeHTML(langShort(code))}</span>
        <span class="lang-col-name">${escapeHTML(langName(code))}</span>
        <span class="lang-col-role">${isStudy ? 'learning' : 'reference'}</span>
      </div>
      ${empty ? `
        <div class="lang-col-empty">
          <span class="lpv-empty-ico"><i data-lucide="pencil-line"></i></span>
          <span>Nothing recorded in ${escapeHTML(langName(code))} yet.</span>
          <button class="lpv-link" type="button" onclick="spaNavigate('admin-language')">Add it in Admin</button>
        </div>` : `
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
        <button class="lang-other" type="button" data-lc="${c}" onclick="langSetStudy('${c}')" title="Switch to ${escapeHTML(langName(c))}">
          <span class="lang-col-code">${escapeHTML(langShort(c))}</span>
          <span class="lang-other-term">${escapeHTML(langForm(w, c).term)}</span>
        </button>`).join('')}
    </div>`;
}

/* ── Page furniture ───────────────────────────────────────────
   The second pane's pages share one shape: a hero with a coloured icon, a
   row of stat tiles, a preview that plays, and the button. Each page has a
   tone -- a theme colour -- so the five drills and the two adventure pages
   are told apart at a glance rather than by reading their titles. */

const LANG_TONES = { arrange: 'primary', blank: 'accent', choice: 'success', translate: 'warning', match: 'danger' };

const LANG_STEP_ICONS = {
  arrange: ['message-square-text', 'mouse-pointer-click', 'undo-2'],
  blank: ['text-cursor', 'mouse-pointer-click', 'replace'],
  choice: ['message-circle-question', 'mouse-pointer-click', 'shuffle'],
  translate: ['languages', 'keyboard', 'corner-down-left'],
  match: ['columns-2', 'link', 'rotate-ccw']
};

function langHeroHTML(icon, eyebrow, title, sub, aside) {
  return `
    <header class="lpv-hero lpv-in" style="--i:0">
      <div class="lpv-hero-icon"><i data-lucide="${icon}"></i></div>
      <div class="lpv-hero-body">
        <span class="lpv-eyebrow">${escapeHTML(eyebrow)}</span>
        <h2 class="lpv-title">${escapeHTML(title)}</h2>
        ${sub ? `<p class="lpv-sub">${escapeHTML(sub)}</p>` : ''}
      </div>
      ${aside || ''}
    </header>`;
}

function langStatHTML(icon, value, label) {
  return `
    <div class="lpv-stat">
      <span class="lpv-stat-ico"><i data-lucide="${icon}"></i></span>
      <span class="lpv-stat-body"><b>${escapeHTML(String(value))}</b><em>${escapeHTML(label)}</em></span>
    </div>`;
}

/* ── One puzzle type ──────────────────────────────────────── */

function langDrillTypeHTML(type) {
  const meta = langPuzzleMeta(type);
  const rules = LANG_TYPE_RULES[meta.type] || LANG_TYPE_RULES.arrange;
  const pool = langItemsOfType(meta.type);
  const runs = (state.langHistory || []).filter(h => h.kind === 'type' && h.refId === meta.type);
  const best = runs.length ? Math.max(...runs.map(r => r.score || 0)) : -1;
  const fromSets = [];
  pool.forEach(p => { if (fromSets.indexOf(p.set.title) === -1) fromSets.push(p.set.title); });
  const tone = LANG_TONES[meta.type] || 'primary';
  const icons = LANG_STEP_ICONS[meta.type] || LANG_STEP_ICONS.arrange;

  return `
    <div class="lpv-page lpv-tone-${tone}">
      ${langHeroHTML(meta.icon, 'Drill', meta.name, meta.hint)}

      <div class="lpv-stats lpv-in" style="--i:1">
        ${langStatHTML('list-checks', pool.length, 'Questions ready')}
        ${langStatHTML('rotate-ccw', runs.length, runs.length === 1 ? 'Run' : 'Runs')}
        ${langStatHTML('trophy', best >= 0 ? best + '%' : '—', 'Best score')}
      </div>

      ${pool.length ? `
        <div class="lpv-split lpv-in" style="--i:2">
          ${lpvDemoHTML(meta.type, lpvDrillSample(meta.type), 'How it plays')}
          <div class="lpv-side">
            <button class="lpv-go" type="button" onclick="langStartType('${meta.type}', 0)">
              <i data-lucide="play"></i> Start
            </button>
            <button class="lpv-alt" type="button" onclick="langPromptTimer('type', '${meta.type}')">
              <i data-lucide="timer"></i> Timed run
            </button>
            <div class="lpv-fact">
              <span class="lpv-fact-ico is-hearts"><i data-lucide="heart"></i><i data-lucide="heart"></i><i data-lucide="heart"></i></span>
              <span><b>Three hearts.</b> A miss or a skip costs one.</span>
            </div>
            <div class="lpv-fact">
              <span class="lpv-fact-ico"><i data-lucide="badge-check"></i></span>
              <span>${escapeHTML(rules.wins)}</span>
            </div>
            <div class="lpv-fact lpv-keys">
              <span class="lpv-fact-ico"><i data-lucide="keyboard"></i></span>
              <span><kbd>1</kbd>–<kbd>9</kbd> pick · <kbd>⌫</kbd> undo · <kbd>Enter</kbd> check · <kbd>Esc</kbd> leave</span>
            </div>
          </div>
        </div>

        <div class="lpv-steps lpv-in" style="--i:3">
          ${rules.how.map((h, i) => `
            <div class="lpv-step">
              <span class="lpv-step-ico"><i data-lucide="${icons[i] || 'circle'}"></i><b>${i + 1}</b></span>
              <span class="lpv-step-text">${escapeHTML(h)}</span>
            </div>`).join('')}
        </div>

        <h3 class="lpv-h lpv-in" style="--i:4"><i data-lucide="sliders-horizontal"></i> Run settings <span class="lpv-h-note">saved on this device, used by every drill</span></h3>
        <div class="lpv-in" style="--i:4">${typeof laSettingsHTML === 'function' ? laSettingsHTML('page') : ''}</div>

        <div class="lpv-from lpv-in" style="--i:4">
          <span class="lpv-from-label"><i data-lucide="layers"></i> From ${fromSets.length} set${fromSets.length !== 1 ? 's' : ''}</span>
          ${fromSets.slice(0, 6).map(t => `<span class="lpv-chip">${escapeHTML(t)}</span>`).join('')}
          ${fromSets.length > 6 ? `<span class="lpv-chip is-more">+${fromSets.length - 6}</span>` : ''}
        </div>`
      : `
        <div class="lpv-empty lpv-in" style="--i:2">
          <span class="lpv-empty-ico"><i data-lucide="${meta.icon}"></i></span>
          <b>Nothing to practise yet</b>
          <p>No finished ${escapeHTML(meta.name.toLowerCase())} questions exist in any of your sets.</p>
          <button class="lpv-alt" type="button" onclick="spaNavigate('admin-language')">
            <i data-lucide="plus"></i> Write some in Admin
          </button>
        </div>
        ${langSets().length ? '' : langSeedOfferHTML('The starter pack brings ten questions of every type, including this one.')}`}
    </div>`;
}

/* ── Authored sets ────────────────────────────────────────── */

function langSetsHTML() {
  const sets = langSets();
  const ran = sets.filter(s => langBestPct('set', s.id) >= 0).length;
  const questions = sets.reduce((n, s) => n + (s.items || []).length, 0);
  return `
    <div class="lpv-page lpv-tone-success">
      ${langHeroHTML('layers', 'Drills', 'Your drill sets', 'Run a set exactly as you wrote it, start to finish.')}
      <div class="lpv-stats lpv-in" style="--i:1">
        ${langStatHTML('layers', sets.length, sets.length === 1 ? 'Set' : 'Sets')}
        ${langStatHTML('list-checks', questions, 'Questions')}
        ${langStatHTML('flag', ran, 'Run at least once')}
      </div>
      <details class="lpv-settings-fold lpv-in" style="--i:2">
        <summary><i data-lucide="sliders-horizontal"></i> Run settings <span class="lpv-h-note">questions, hearts, hints, typos</span><i data-lucide="chevron-down" class="lpv-fold-caret"></i></summary>
        ${typeof laSettingsHTML === 'function' ? laSettingsHTML('page') : ''}
      </details>
      <div class="lpv-grid lpv-in" style="--i:2">
        ${sets.map((s, i) => {
          const problems = langSetProblems(s);
          const best = langBestPct('set', s.id);
          const types = [];
          (s.items || []).forEach(it => { if (types.indexOf(it.type) === -1) types.push(it.type); });
          const n = (s.items || []).length;
          return `
          <div class="lpv-set" style="--k:${i}">
            <div class="lpv-set-top">
              <span class="lpv-ring${best < 0 ? ' is-none' : ''}" style="--p:${Math.max(0, best)}"><b>${best >= 0 ? best + '%' : '—'}</b></span>
              <span class="lpv-set-info">
                <b>${escapeHTML(s.title || 'Untitled set')}</b>
                <span>${n} question${n !== 1 ? 's' : ''} · ${escapeHTML(langShort(s.lang))} → ${escapeHTML(langShort(s.refLang))}</span>
              </span>
              <button class="ag-icon-btn" type="button" onclick="agOpenDeadlineModal('langset', '${s.id}')"
                      title="${typeof agGetDeadline === 'function' && agGetDeadline('langset', s.id) ? 'Change or clear the deadline' : 'Put a due date on this set'}">
                <i data-lucide="flag"></i>
              </button>
            </div>
            <div class="lpv-set-types">
              ${types.map(t => { const m = langPuzzleMeta(t); return `<span class="lpv-type lpv-tone-${LANG_TONES[t] || 'primary'}" title="${escapeHTML(m.name)}"><i data-lucide="${m.icon}"></i></span>`; }).join('')}
              ${typeof agDeadlineTextHTML === 'function' ? agDeadlineTextHTML('langset', s.id) : ''}
            </div>
            ${problems.length ? `<div class="lpv-warn"><i data-lucide="alert-triangle"></i> ${problems.length} to fix in Admin</div>` : ''}
            <button class="lpv-go is-small" type="button" onclick="langPromptTimer('set', '${s.id}')" ${problems.length ? 'disabled' : ''}>
              <i data-lucide="play"></i> Run
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
  const flow = [
    ['footprints', 'Run', 'Each leg costs ' + LANG_RUN_STEP_COST + ' stamina. A quiet block raises your max by ' + LANG_RUN_ENDURANCE_GAIN + '.'],
    ['user', 'Someone stops you', 'They always speak first.'],
    ['message-circle', 'Reply', 'A good reply costs nothing and heals. A bad one drains.'],
    ['trophy', 'Win', 'Beat them and your max stamina rises by ' + LANG_RUN_STAMINA_GAIN + '.'],
    ['home', 'Go home', 'Any time. It ends the run and keeps the score.']
  ];
  return `
    <div class="lpv-page lpv-tone-warning">
      ${langHeroHTML('footprints', 'Adventure', 'Free run', 'Walk the streets, meet people, and talk your way past them.')}
      <div class="lpv-stats lpv-in" style="--i:1">
        ${langStatHTML('flame', LANG_RUN_STAMINA, 'Starting stamina')}
        ${langStatHTML('rotate-ccw', runs.length, runs.length === 1 ? 'Run' : 'Runs')}
        ${langStatHTML('signpost', bestDist, 'Furthest')}
        ${langStatHTML('swords', bestBeat, 'Most beaten')}
      </div>

      <div class="lpv-split is-wide lpv-in" style="--i:2">
        ${lpvDemoHTML('quest', lpvQuestSamples(), 'A run, in miniature')}
        <div class="lpv-side">
          ${blocker ? `
            <div class="lpv-empty is-compact">
              <span class="lpv-empty-ico"><i data-lucide="alert-triangle"></i></span>
              <b>Not enough to run on</b>
              <p>${escapeHTML(blocker)}</p>
              <button class="lpv-alt" type="button" onclick="spaNavigate('admin-language')"><i data-lucide="plus"></i> Add some in Admin</button>
            </div>`
          : `<button class="lpv-go" type="button" onclick="langStartRun()"><i data-lucide="play"></i> Set off</button>`}
          <span class="lpv-side-label">You set off with</span>
          <div class="lpv-potions">
            ${LANG_POTIONS.map(p => `
              <span class="lpv-potion" title="${escapeHTML(p.name)}">
                <i data-lucide="flask-round"></i><b>${escapeHTML(p.name)}</b><em>+${p.heal}</em>
              </span>`).join('')}
          </div>
        </div>
      </div>
      ${blocker ? langSeedOfferHTML('The starter pack gives you people to meet straight away.') : ''}

      <h3 class="lpv-h lpv-in" style="--i:3"><i data-lucide="route"></i> How a run goes</h3>
      <div class="lpv-flow lpv-in" style="--i:3">
        ${flow.map((f, i) => `
          <div class="lpv-flow-step" style="--k:${i}">
            <span class="lpv-step-ico"><i data-lucide="${f[0]}"></i></span>
            <b>${escapeHTML(f[1])}</b>
            <span>${escapeHTML(f[2])}</span>
          </div>`).join('')}
      </div>

      <h3 class="lpv-h lpv-in" style="--i:4"><i data-lucide="zap"></i> Power-ups <span class="lpv-h-note">the gauge fills as you answer well</span></h3>
      <div class="lpv-powers lpv-in" style="--i:4">
        ${LANG_POWERUPS.map(p => `
          <div class="lpv-power">
            <span class="lpv-power-ico"><i data-lucide="${p.icon}"></i></span>
            <span class="lpv-power-body">
              <b>${escapeHTML(p.name)}</b>
              <span>${escapeHTML(p.desc)}</span>
              <span class="lpv-power-cost"><i style="width:${Math.min(100, p.cost)}%"></i><em>${p.cost}</em></span>
            </span>
          </div>`).join('')}
      </div>
    </div>`;
}

function langScenariosHTML() {
  const list = langScenarios();
  const ready = s => (s.encounters || []).some(e => (e.line || '').trim() && (e.options || []).some(o => (o.text || '').trim() && o.correct));
  const readyN = list.filter(ready).length;
  const places = [];
  list.forEach(s => { if (places.indexOf(s.location) === -1) places.push(s.location); });
  return `
    <div class="lpv-page lpv-tone-accent">
      ${langHeroHTML('map', 'Adventure', 'Scenarios', 'The encounters you have written. A run draws the people you meet from these.')}
      <div class="lpv-stats lpv-in" style="--i:1">
        ${langStatHTML('map', list.length, list.length === 1 ? 'Scenario' : 'Scenarios')}
        ${langStatHTML('check-circle-2', readyN, 'Ready to fight')}
        ${langStatHTML('map-pin', places.length, places.length === 1 ? 'Place' : 'Places')}
      </div>
      ${readyN ? `<div class="lpv-in" style="--i:2">${lpvDemoHTML('quest', lpvQuestSamples(), 'From your scenarios')}</div>` : ''}
      <div class="lpv-grid lpv-in" style="--i:3">
        ${list.map((s, i) => {
          const loc = langLocation(s.location);
          const ok = ready(s);
          const turns = (s.encounters || []).length;
          return `
          <div class="lpv-scene${ok ? '' : ' is-unready'}" style="--k:${i}">
            <div class="lpv-scene-art lpv-bg-${escapeHTML(loc.key)}">
              <span class="lpv-scene-loc"><i data-lucide="${loc.icon}"></i> ${escapeHTML(loc.name)}</span>
              <span class="lpv-scene-face lpv-face-${escapeHTML(lpvFaceKey(s.npc))}"></span>
            </div>
            <div class="lpv-scene-body">
              <b>${escapeHTML(s.title || 'Untitled')}</b>
              <span><i data-lucide="user"></i> ${escapeHTML(s.npc || 'Someone')} · <i data-lucide="messages-square"></i> ${turns} turn${turns !== 1 ? 's' : ''}</span>
              ${ok ? '' : '<span class="lpv-warn"><i data-lucide="alert-triangle"></i> unfinished</span>'}
            </div>
            <button class="lpv-go is-small" type="button" onclick="langStartScenario('${s.id}')" ${ok ? '' : 'disabled'}>
              <i data-lucide="swords"></i> Fight
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

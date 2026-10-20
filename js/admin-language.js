/* ============================================================
   ADMIN-LANGUAGE.JS — authoring for the Language Library
   ------------------------------------------------------------
   Three things to write here, on three tabs: the words, the drill sets, and
   the scenarios. All three edit a working copy and only commit on Save, so
   backing out of a half-finished entry leaves the store untouched.

   THE SHAPE. Words are a list beside an editor, because you edit them one
   after another. Sets and scenarios are cards that open a full-width editor,
   because one of them is a whole piece of work. Inside an editor, questions
   and encounters are cards that fold, each saying in one line what it is and
   whether it is finished -- the old editor was one long form with every
   field of every question open at once.

   EDITS LIVE IN THE PAGE UNTIL SAVE. Adding a tile, an example, an option or
   a pair changes the DOM, not the draft; the draft is read back from the DOM,
   by id, whenever the editor is redrawn. Reading by id rather than by
   position is what makes removing or moving a question safe: a card that is
   no longer in the draft is simply skipped.
   ============================================================ */

let langAdminTab = 'words';
let langWordDraft = null;
let langSetDraft = null;
let langScenarioDraft = null;
let langAdmDirty = false;        // an editor has changes not yet saved
let langAdmFlash = '';           // the id to highlight after a save
let langAdmWordLang = '';        // the language tab open in the word editor
let langAdmSel = [];             // words ticked for a bulk delete
let langAdmTag = '';             // words: topic filter
let langAdmSetQuery = '';
let langAdmSetFilter = 'all';    // all | ready | todo
let langAdmOpen = {};            // question / encounter ids unfolded in an editor
let langAdmCopyOf = '';          // a draft that started as a duplicate says so
let langAdmSelecting = false;    // the word list shows ticks for a bulk delete
let langAdmNewId = '';           // a question / encounter just added (it may animate in)
let _langAdmLastKey = '';        // what the body showed last, so a redraw of it stays still

/* Admin had no search at all. With the starter pack that is 1,008 rows,
   19,223 DOM nodes and 2,022 icons, rebuilt in full after every single edit
   or delete -- and the only way to reach a word was to scroll to it. A box
   and a cap; the same two things the library itself already had. */
const LANG_ADMIN_PAGE = 60;
let langAdminQuery = '';
let langAdminShown = LANG_ADMIN_PAGE;

const LANG_ADM_TABS = [
  { key: 'words', label: 'Words', icon: 'book-a', tone: 'primary', sub: 'The dictionary' },
  { key: 'sets', label: 'Drill sets', icon: 'dumbbell', tone: 'success', sub: 'Questions you write' },
  { key: 'scenarios', label: 'Scenarios', icon: 'swords', tone: 'warning', sub: 'People to meet' }
];

const LANG_ADM_TYPE_TONE = { arrange: 'primary', blank: 'accent', choice: 'success', translate: 'warning', match: 'danger' };

function adminLanguageTemplate() {
  const hero = typeof langHeroHTML === 'function'
    ? langHeroHTML('languages', 'Admin', 'Language Admin', 'Write the words, drills and scenarios the library is built from.', `
        <div class="lpv-adm-hero-actions">
          <button class="lpv-go is-small" type="button" onclick="langLoadStarter()"
                  title="The Cebuano vocabulary, ten drill sets and ten scenarios — nothing you already have is replaced">
            <i data-lucide="sparkles"></i> Starter pack
          </button>
          <button class="lpv-alt" type="button" onclick="langAdmLeave('language')"><i data-lucide="external-link"></i> Open library</button>
        </div>`)
    : '<h1 class="lib-hub-title">Language Admin</h1>';
  return `
    <div class="home-content">
      <div class="home-scroll lpv-adm-scroll" id="lang-admin-root">
        <div class="lpv-page lpv-adm lpv-tone-primary">
          <div class="lpv-adm-nav">
            <button onclick="langAdmLeave('admin')" class="btn-back-dark" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
              <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
            </button>
            <span class="lpv-adm-keys"><kbd>Ctrl</kbd>+<kbd>S</kbd> saves · <kbd>Esc</kbd> closes an editor</span>
          </div>
          ${hero}
          <div class="lpv-stats is-compact lpv-in" style="--i:1" id="lang-adm-stats"></div>
          <div class="lpv-adm-tabs lpv-in" style="--i:2" id="lang-admin-tabs" role="tablist"></div>
          <div id="lang-admin-body"></div>
        </div>
      </div>
    </div>`;
}

function adminLanguageInit() {
  langStore();
  /* Same rule as the library's: a search left behind is a screen that opens
     already filtered by something you do not remember typing, and 600 rows
     left paged in are 600 rows paid for again on arrival. */
  langAdminQuery = '';
  langAdminShown = LANG_ADMIN_PAGE;
  langAdmTag = '';
  langAdmSel = [];
  langAdmSetQuery = '';
  langAdmSetFilter = 'all';
  langAdmOpen = {};
  langAdmDirty = false;
  langAdmFlash = '';
  langAdmCopyOf = '';
  langAdmSelecting = false;
  langAdmNewId = '';
  _langAdmLastKey = '';
  langAdminTab = getSessionParam('langAdminTab') || 'words';
  const editId = getSessionParam('langAdminEdit');
  const wordId = getSessionParam('langAdminWord');
  langWordDraft = null; langSetDraft = null; langScenarioDraft = null;

  if (langAdminTab === 'words' && wordId) {
    const w = langFindWord(wordId);
    if (w) langWordDraft = JSON.parse(JSON.stringify(langNormWord(w)));
    setSessionParam('langAdminWord', null);
  }
  if (langAdminTab === 'sets' && editId) {
    const s = langFindSet(editId);
    if (s) langSetDraft = langAdmPrepSet(JSON.parse(JSON.stringify(s)));
  }
  if (langAdminTab === 'scenarios' && editId) {
    const s = langFindScenario(editId);
    if (s) langScenarioDraft = langAdmPrepScenario(JSON.parse(JSON.stringify(s)));
  }
  setSessionParam('langAdminEdit', null);
  document.removeEventListener('keydown', langAdmKeys);
  document.addEventListener('keydown', langAdmKeys);
  renderLangAdmin();
}

function adminLanguageDestroy() {
  langWordDraft = null; langSetDraft = null; langScenarioDraft = null;
  langAdmDirty = false;
  document.removeEventListener('keydown', langAdmKeys);
  document.removeEventListener('mousedown', langAdmFacePickOutside, true);
}

/* ── Guards, keys, tabs ───────────────────────────────────── */

function langAdmHasDraft() { return !!(langWordDraft || langSetDraft || langScenarioDraft); }

/** Run `fn`, but ask first if an editor has changes that would be lost. */
function langAdmGuard(fn) {
  if (langAdmDirty && langAdmHasDraft()) {
    showConfirm('Discard your changes?', 'This editor has changes that are not saved yet.',
      () => { langAdmDirty = false; fn(); }, { confirmLabel: 'Discard' });
    return;
  }
  fn();
}

function langAdmLeave(route) { langAdmGuard(() => spaNavigate(route)); }

function langAdmKeys(e) {
  if (!document.getElementById('lang-admin-root')) return;
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    if (!langAdmHasDraft()) return;
    e.preventDefault();
    langAdmSave();
  } else if (e.key === 'Escape' && langAdmFacePickOpen()) {
    e.preventDefault();
    langAdmToggleFacePick(false);
  } else if (e.key === 'Escape' && langAdmHasDraft()) {
    e.preventDefault();
    langCancelDraft();
  }
}

function langAdmSave() {
  if (langWordDraft) langSaveWordDraft();
  else if (langSetDraft) langSaveSetDraft();
  else if (langScenarioDraft) langSaveScenarioDraft();
}

function langAdminSetTab(tab) {
  if (tab === langAdminTab && !langAdmHasDraft()) return;
  langAdmGuard(() => {
    langAdminTab = tab;
    setSessionParam('langAdminTab', tab);
    langWordDraft = null; langSetDraft = null; langScenarioDraft = null;
    langAdmDirty = false;
    renderLangAdmin();
  });
}

function langCancelDraft() {
  langAdmGuard(() => {
    langWordDraft = null; langSetDraft = null; langScenarioDraft = null;
    langAdmDirty = false;
    langAdmCopyOf = '';
    renderLangAdmin();
  });
}

/* ── Render ───────────────────────────────────────────────── */

function renderLangAdmin() {
  const tabs = document.getElementById('lang-admin-tabs');
  const body = document.getElementById('lang-admin-body');
  if (!tabs || !body) return;
  // Whatever is typed into an open editor survives the redraw.
  langAdmSyncDrafts();
  if (typeof lpvArtStyles === 'function') lpvArtStyles();
  langAdmPaintChrome();

  // The words view is repainted in place: the list keeps its scroll and
  // nothing replays its entrance because something else changed.
  if (langAdminTab === 'words' && body.querySelector('.lpv-adm-split')) {
    langAdmPaintWords(true);
    return;
  }
  const key = langAdminTab + ':' + (langSetDraft ? 'set:' + langSetDraft.id : langScenarioDraft ? 'sc:' + langScenarioDraft.id : 'list');
  body.classList.toggle('lpv-quiet', key === _langAdmLastKey);
  _langAdmLastKey = key;

  const tone = (LANG_ADM_TABS.find(t => t.key === langAdminTab) || LANG_ADM_TABS[0]).tone;
  let html;
  if (langAdminTab === 'sets') html = langSetDraft ? langSetFormHTML() : langSetListHTML();
  else if (langAdminTab === 'scenarios') html = langScenarioDraft ? langScenarioFormHTML() : langScenarioListHTML();
  else html = langWordsPaneHTML();
  body.innerHTML = `<div class="lpv-adm-body lpv-tone-${tone}">${html}</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
  if (langAdminTab === 'words') langAdmAfterRows();
  langAdmFlash = '';
  langAdmNewId = '';
}

/** The stat pills and the tab counts, which follow every change. */
function langAdmPaintChrome() {
  const tabs = document.getElementById('lang-admin-tabs');
  const stats = document.getElementById('lang-adm-stats');
  if (stats) stats.innerHTML = langAdmStatsHTML();
  if (tabs) {
    tabs.innerHTML = LANG_ADM_TABS.map(t => {
      const n = t.key === 'words' ? langWords().length : t.key === 'sets' ? langSets().length : langScenarios().length;
      return `
        <button class="lpv-adm-tab lpv-tone-${t.tone}${langAdminTab === t.key ? ' is-active' : ''}" type="button" role="tab"
                aria-selected="${langAdminTab === t.key ? 'true' : 'false'}" onclick="langAdminSetTab('${t.key}')">
          <span class="lpv-adm-tab-ico"><i data-lucide="${t.icon}"></i></span>
          <span class="lpv-adm-tab-body"><b>${t.label}</b><em>${t.sub}</em></span>
          <span class="lpv-adm-tab-n">${n}</span>
        </button>`;
    }).join('');
  }
  if (typeof lucide !== 'undefined') {
    if (stats) lucide.createIcons({ root: stats });
    if (tabs) lucide.createIcons({ root: tabs });
  }
}

function langAdmStatsHTML() {
  const sets = langSets();
  const questions = sets.reduce((n, s) => n + (s.items || []).length, 0);
  const stat = typeof langStatHTML === 'function' ? langStatHTML : (i, v, l) => `<div class="lpv-stat"><b>${v}</b> ${l}</div>`;
  return stat('book-a', langWords().length, 'Words')
    + stat('dumbbell', sets.length, 'Drill sets')
    + stat('list-checks', questions, 'Questions written')
    + stat('swords', langScenarios().length, 'Scenarios');
}

/** Read every open editor back into its draft before the page is redrawn. */
function langAdmSyncDrafts() {
  if (langWordDraft) langCollectWordForm();
  if (langSetDraft) langCollectSetForm();
  if (langScenarioDraft) langCollectScenarioForm();
}

/** The editor in the page for this draft, or null -- never another draft's. */
function langAdmEditorFor(kind, draft) {
  if (!draft) return null;
  return document.querySelector('.lpv-adm-editor[data-kind="' + kind + '"][data-draft-id="' + draft.id + '"]');
}

/** Any input in an editor: mark it unsaved and refresh what depends on it. */
function langAdmEdited(e) {
  langAdmDirty = true;
  const t = e && e.target;
  if (!t || !t.closest) return;
  const q = t.closest('.lpv-qc');
  if (q) langAdmQLive(q);
  const enc = t.closest('.lpv-enc');
  if (enc) langAdmEncLive(enc);
  if (t.id === 'lang-s-title' || t.id === 'lang-sc-title') {
    const head = document.getElementById('lang-adm-head');
    if (head) head.textContent = t.value.trim() || 'Untitled';
  }
  if (t.closest('.lpv-adm-editor[data-kind="word"]')) langAdmWordLive();
}

function langAdmEmptyHTML(icon, title, line, action) {
  return `
    <div class="lpv-empty lpv-adm-empty">
      <span class="lpv-empty-ico"><i data-lucide="${icon}"></i></span>
      <b>${escapeHTML(title)}</b>
      <p>${escapeHTML(line)}</p>
      ${action || ''}
    </div>`;
}

/* ── Chip inputs (tags, extra tiles) ──────────────────────── */

function langAdmChipHTML(v) {
  return `<span class="lpv-chip-x" data-v="${escapeHTML(v)}">${escapeHTML(v)}<button type="button" tabindex="-1"
          onclick="langAdmChipRemove(event)" aria-label="Remove ${escapeHTML(v)}">×</button></span>`;
}

function langAdmChipsHTML(key, values, placeholder, listId) {
  return `
    <div class="lpv-chips" data-chips="${key}" onclick="if (event.target === this) this.querySelector('input').focus()">
      ${(values || []).map(langAdmChipHTML).join('')}
      <input type="text" placeholder="${escapeHTML(placeholder)}" ${listId ? `list="${listId}"` : ''} autocomplete="off"
             onkeydown="langAdmChipKey(event)" onblur="langAdmChipCommit(this)" />
    </div>`;
}

function langAdmChipValues(box) {
  return box ? Array.from(box.querySelectorAll('.lpv-chip-x')).map(c => c.dataset.v) : [];
}

function langAdmAddChip(box, value) {
  const v = String(value || '').trim();
  if (!box || !v) return false;
  const have = langAdmChipValues(box).map(x => x.toLowerCase());
  if (have.indexOf(v.toLowerCase()) > -1) return false;
  box.querySelector('input').insertAdjacentHTML('beforebegin', langAdmChipHTML(v));
  langAdmDirty = true;
  return true;
}

function langAdmChipCommit(input) {
  const box = input && input.closest('.lpv-chips');
  if (!box || !input.value.trim()) return;
  input.value.split(',').forEach(v => langAdmAddChip(box, v));
  input.value = '';
  langAdmChipChanged(box);
}

function langAdmChipKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    langAdmChipCommit(e.target);
  } else if (e.key === 'Backspace' && !e.target.value) {
    const chips = e.target.closest('.lpv-chips').querySelectorAll('.lpv-chip-x');
    if (chips.length) { chips[chips.length - 1].remove(); langAdmDirty = true; langAdmChipChanged(e.target.closest('.lpv-chips')); }
  }
}

function langAdmChipRemove(e) {
  e.stopPropagation();
  const chip = e.target.closest('.lpv-chip-x');
  const box = chip && chip.closest('.lpv-chips');
  if (chip) chip.remove();
  langAdmDirty = true;
  langAdmChipChanged(box);
}

function langAdmChipChanged(box) {
  const q = box && box.closest('.lpv-qc');
  if (q) langAdmQLive(q);
}

/* ── Rows inside an editor (examples, options, pairs, replies) ─ */

/** Remove a row, keeping at least `min` of its kind. */
function langAdmRemoveRow(btn, min) {
  const row = btn.closest('[data-row]');
  if (!row) return;
  const list = row.parentElement;
  if (list.querySelectorAll('[data-row]').length <= (min || 0)) {
    if (typeof toast === 'function') toast('Keep at least ' + min + '.', { type: 'info', duration: 1800 });
    return;
  }
  row.classList.add('is-leaving');
  setTimeout(() => {
    row.remove();
    langAdmDirty = true;
    const q = list.closest('.lpv-qc');
    if (q) langAdmQLive(q);
    const enc = list.closest('.lpv-enc');
    if (enc) langAdmEncLive(enc);
  }, 160);
}

/** Append a row to a list, up to `max`, and focus its first input. */
function langAdmAddRow(btn, listSel, html, max) {
  const scope = btn.closest('.lpv-qc, .lpv-enc, .lpv-adm-langpane');
  const list = scope && scope.querySelector(listSel);
  if (!list) return null;
  if (max && list.querySelectorAll('[data-row]').length >= max) {
    if (typeof toast === 'function') toast('That is the most there can be.', { type: 'info', duration: 1800 });
    return null;
  }
  list.insertAdjacentHTML('beforeend', html);
  const row = list.lastElementChild;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: row });
  const first = row.querySelector('input[type="text"], input:not([type])');
  if (first) first.focus();
  langAdmDirty = true;
  if (scope.classList.contains('lpv-qc')) langAdmQLive(scope);
  if (scope.classList.contains('lpv-enc')) langAdmEncLive(scope);
  return row;
}

/* ============================================================
   WORDS
   ------------------------------------------------------------
   THE LIST IS NEVER REDRAWN UNDER YOU. Opening a word only moves the
   highlight; saving or deleting repaints the rows but puts the scroll back
   where it was; more rows are appended as you near the bottom rather than
   rebuilding the box (rebuilding it is what threw you back to the top); and
   the A-Z rail jumps to a letter, loading as far as it needs to.
   ============================================================ */

function langWordsPaneHTML() {
  return `
    <div class="lpv-adm-split${langWordDraft ? ' has-editor' : ''}">
      <section class="lpv-adm-list lpv-in" style="--i:3">${langWordListHTML()}</section>
      <section class="lpv-adm-side">${langWordDraft ? langWordFormHTML() : langAdmEmptySideHTML()}</section>
    </div>`;
}

function langAdmEmptySideHTML() {
  return langAdmEmptyHTML('mouse-pointer-click', 'Pick a word to edit',
    'Or start a new one. Every language is optional — fill in the ones you know.',
    `<button class="lpv-go is-small" type="button" onclick="langNewWordDraft()"><i data-lucide="plus"></i> New word</button>`);
}

/** Paint the words view in place: the editor if it changed, the rows if asked. */
function langAdmPaintWords(rows) {
  const split = document.querySelector('.lpv-adm-split');
  if (!split) { renderLangAdmin(); return; }
  split.classList.toggle('has-editor', !!langWordDraft);
  const side = split.querySelector('.lpv-adm-side');
  const ed = side.querySelector('.lpv-adm-editor');
  const want = langWordDraft ? langWordDraft.id : '';
  // The editor is rebuilt only when it is a different word -- a refresh
  // from elsewhere must not take the caret out of what you are typing.
  if (want ? !ed || ed.dataset.draftId !== want : !!ed || !side.querySelector('.lpv-empty')) {
    side.innerHTML = langWordDraft ? langWordFormHTML() : langAdmEmptySideHTML();
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: side });
  }
  if (rows) {
    const tagbox = document.getElementById('lang-adm-tagbox');
    if (tagbox && !tagbox.contains(document.activeElement)) tagbox.innerHTML = langAdmTagSelectHTML();
    langAdmSwapWords({ keepScroll: true, reveal: langAdmFlash });
  } else {
    document.querySelectorAll('.lpv-adm-row').forEach(r => r.classList.toggle('is-active', r.dataset.id === want));
  }
  langAdmFlash = '';
}

function langAdmFilteredWords() {
  const study = langStudy();
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  return langWords()
    .filter(w => langMatches(w, langAdminQuery) && (!langAdmTag || (w.tags || []).indexOf(langAdmTag) > -1))
    .map(w => ({ w, key: langHeadword(w, study) }))
    .sort((a, b) => collator.compare(a.key, b.key))
    .map(x => x.w);
}

/** The letter a word files under on the A-Z rail. */
function langAdmLetter(w) {
  const head = String(langHeadword(w, langStudy()) || '');
  const c = head.replace(/^[^A-Za-zÀ-ÿ]+/, '').charAt(0).normalize('NFD').charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

/** The topic filter. Repainted with the rows, so topics that arrive later (a
    starter pack, a newly tagged word) appear without leaving the page. */
function langAdmTagSelectHTML() {
  const tags = typeof langAllTags === 'function' ? langAllTags() : [];
  if (langAdmTag && !tags.some(t => t.tag === langAdmTag)) langAdmTag = '';
  if (!tags.length) return '';
  return `
      <select class="form-select lpv-select lpv-adm-tagsel${langAdmTag ? ' is-on' : ''}" aria-label="Topic" onchange="langAdmSetTag(this.value)">
        <option value="">All topics</option>
        ${tags.slice().sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
          .map(t => `<option value="${escapeHTML(t.tag)}"${langAdmTag === t.tag ? ' selected' : ''}>${escapeHTML(t.tag)} (${t.count})</option>`).join('')}
      </select>`;
}

function langWordListHTML() {
  return `
    <div class="lpv-adm-tools">
      <div class="search-container">
        <i data-lucide="search"></i>
        <input type="text" class="search-input" id="lang-admin-q" placeholder="Search words…"
               autocomplete="off" aria-label="Search words"
               value="${escapeHTML(langAdminQuery)}" oninput="langAdminSetQuery(this.value)" />
      </div>
      <button class="lpv-adm-selbtn${langAdmSelecting ? ' is-on' : ''}" type="button" onclick="langAdmToggleSelecting()"
              aria-pressed="${langAdmSelecting ? 'true' : 'false'}" title="${langAdmSelecting ? 'Stop selecting' : 'Select several words'}">
        ${langIcon(langAdmSelecting ? 'x' : 'list-checks')}<span>${langAdmSelecting ? 'Done' : 'Select'}</span>
      </button>
      <button class="lpv-go is-small lpv-adm-new" type="button" onclick="langAdmGuard(langNewWordDraft)" title="New word">
        <i data-lucide="plus"></i><span>New</span>
      </button>
    </div>
    <div id="lang-adm-tagbox">${langAdmTagSelectHTML()}</div>
    <div id="lang-adm-bulk">${langAdmBulkHTML()}</div>
    <div id="lang-adm-words">${langWordRowsHTML()}</div>`;
}

function langAdmRowHTML(w) {
  const study = langStudy(), ref = langRef();
  const head = langHeadword(w, study);
  const gloss = String(langForm(w, ref).term || '').trim();
  const active = langWordDraft && langWordDraft.id === w.id;
  const on = langAdmSel.indexOf(w.id) > -1;
  return `
    <div class="lpv-adm-row${active ? ' is-active' : ''}${on ? ' is-selected' : ''}${langAdmFlash === w.id ? ' is-flash' : ''}"
         ${langAdmSelecting ? `role="checkbox" aria-checked="${on ? 'true' : 'false'}"` : 'role="button"'} tabindex="0"
         data-id="${w.id}" data-l="${langAdmLetter(w)}"
         onclick="langAdmRowClick('${w.id}')" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); langAdmRowClick('${w.id}'); }">
      ${langAdmSelecting ? '<span class="lpv-adm-tick" aria-hidden="true"></span>' : ''}
      <span class="lpv-adm-row-main">
        <b>${escapeHTML(head)}${langSpeakChip(head, study)}</b>
        <span>${gloss ? escapeHTML(gloss) : '<em>no ' + escapeHTML(langShort(ref)) + '</em>'}</span>
      </span>
      <span class="lpv-adm-langs">${LANG_CODES.map(c => `<i class="lpv-adm-dot${String(langForm(w, c).term || '').trim() ? ' is-on' : ''}" data-lc="${c}" title="${escapeHTML(langName(c))}"></i>`).join('')}</span>
      ${langAdmSelecting ? '' : `
      <span class="lpv-adm-row-tools">
        <button class="ag-icon-btn" type="button" onclick="event.stopPropagation(); langAdmDuplicateWord('${w.id}')" title="Duplicate"
                aria-label="Duplicate ${escapeHTML(head)}">${langIcon('copy')}</button>
        <button class="ag-icon-btn lpv-adm-danger" type="button" onclick="event.stopPropagation(); langAdminDeleteWord('${w.id}')" title="Delete"
                aria-label="Delete ${escapeHTML(head)}">${langIcon('trash-2')}</button>
      </span>`}
    </div>`;
}

function langAdmMoreHTML(left) {
  return `<button class="lpv-wordlist-more lpv-adm-more" type="button" onclick="langAdminShowMore()">
      ${langIcon('loader')} ${Math.min(left, LANG_ADMIN_PAGE)} more of ${left}</button>`;
}

function langWordRowsHTML() {
  const sorted = langAdmFilteredWords();
  const shown = sorted.slice(0, langAdminShown);
  const hidden = sorted.length - shown.length;
  const total = langWords().length;
  const letters = [];
  sorted.forEach(w => { const l = langAdmLetter(w); if (letters.indexOf(l) < 0) letters.push(l); });
  return `
    <div class="lpv-adm-count">
      <span>${langAdminQuery || langAdmTag ? sorted.length + ' of ' + total : total} word${total !== 1 ? 's' : ''}</span>
    </div>
    ${sorted.length > 30 && letters.length > 2 ? `
      <div class="lpv-adm-az" role="navigation" aria-label="Jump to a letter">
        ${letters.map(l => `<button type="button" data-az="${l}" onclick="langAdmJump('${l}')">${l}</button>`).join('')}
      </div>` : ''}
    <div class="lpv-adm-rows${langAdmSelecting ? ' is-selecting' : ''}" onscroll="langAdmAzSync()">
      ${shown.map(langAdmRowHTML).join('') || langAdmEmptyHTML('search-x',
        langAdminQuery || langAdmTag ? 'No words match' : 'No words yet',
        langAdminQuery || langAdmTag ? 'Try another spelling or topic.' : 'Add one, or load the starter pack.')}
      ${hidden > 0 ? langAdmMoreHTML(hidden) : ''}
    </div>`;
}

/** After rows are painted: icons, the self-pressing "more", the A-Z marker. */
function langAdmAfterRows() {
  const host = document.getElementById('lang-adm-words');
  if (!host) return;
  if (typeof lucide !== 'undefined' && host.querySelector('[data-lucide]')) lucide.createIcons({ root: host });
  if (typeof langAutoMore === 'function') langAutoMore(host.querySelector('.lpv-adm-more'), 'adm-words');
  langAdmAzSync();
}

/** Repaint the rows. Keeps the scroll if asked, and shows `reveal` if given. */
function langAdmSwapWords(opts) {
  opts = opts || {};
  const host = document.getElementById('lang-adm-words');
  if (!host) { renderLangAdmin(); return; }
  if (opts.reveal) {
    const at = langAdmFilteredWords().findIndex(w => w.id === opts.reveal);
    if (at >= langAdminShown) langAdminShown = at + 1;
  }
  const old = host.querySelector('.lpv-adm-rows');
  const keep = opts.keepScroll && old ? old.scrollTop : 0;
  host.innerHTML = langWordRowsHTML();
  const rows = host.querySelector('.lpv-adm-rows');
  if (rows) rows.scrollTop = keep;
  if (opts.reveal) langAdmRevealRow(opts.reveal);
  langAdmAfterRows();
}

function langAdmRevealRow(id) {
  const rows = document.querySelector('#lang-adm-words .lpv-adm-rows');
  const row = rows && rows.querySelector('.lpv-adm-row[data-id="' + id + '"]');
  if (!row) return;
  if (row.offsetTop < rows.scrollTop || row.offsetTop + row.offsetHeight > rows.scrollTop + rows.clientHeight) {
    rows.scrollTop = Math.max(0, row.offsetTop - rows.clientHeight / 3);
  }
}

/** Append the next page under the rows already there -- the scroll stays put. */
function langAdminShowMore() {
  const rows = document.querySelector('#lang-adm-words .lpv-adm-rows');
  const sorted = langAdmFilteredWords();
  const from = langAdminShown;
  langAdminShown = Math.min(sorted.length, langAdminShown + LANG_ADMIN_PAGE);
  if (!rows) { langAdmSwapWords({ keepScroll: true }); return; }
  const more = rows.querySelector('.lpv-adm-more');
  const html = sorted.slice(from, langAdminShown).map(langAdmRowHTML).join('');
  if (more) more.insertAdjacentHTML('beforebegin', html);
  else rows.insertAdjacentHTML('beforeend', html);
  const left = sorted.length - langAdminShown;
  if (more) {
    if (left > 0) more.outerHTML = langAdmMoreHTML(left);
    else more.remove();
  }
  langAdmAfterRows();
}

/** Jump to the first word under a letter, loading as far as that needs. */
function langAdmJump(letter) {
  const sorted = langAdmFilteredWords();
  const at = sorted.findIndex(w => langAdmLetter(w) === letter);
  if (at < 0) return;
  if (at >= langAdminShown) {
    langAdminShown = Math.min(sorted.length, at + LANG_ADMIN_PAGE);
    langAdmSwapWords({ keepScroll: true });
  }
  const rows = document.querySelector('#lang-adm-words .lpv-adm-rows');
  const row = rows && rows.querySelector('.lpv-adm-row[data-id="' + sorted[at].id + '"]');
  if (row) rows.scrollTop = row.offsetTop;
  langAdmAzMark(letter);
}

function langAdmAzMark(letter) {
  document.querySelectorAll('.lpv-adm-az [data-az]').forEach(b => b.classList.toggle('is-on', b.dataset.az === letter));
}

let _langAdmAzRaf = 0;

/** As the list scrolls, the rail lights the letter at the top of it. */
function langAdmAzSync() {
  if (_langAdmAzRaf) return;
  const go = () => {
    _langAdmAzRaf = 0;
    const rows = document.querySelector('#lang-adm-words .lpv-adm-rows');
    if (!rows || !document.querySelector('.lpv-adm-az')) return;
    const top = rows.scrollTop;
    const first = Array.from(rows.querySelectorAll('.lpv-adm-row')).find(r => r.offsetTop + r.offsetHeight > top);
    if (first) langAdmAzMark(first.dataset.l);
  };
  _langAdmAzRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(go) : (go(), 0);
}

function langAdminSetQuery(v) {
  langAdminQuery = (v || '').trim();
  langAdminShown = LANG_ADMIN_PAGE;
  langAdmSwapWords();
}

function langAdmSetTag(tag) {
  langAdmTag = tag || '';
  langAdminShown = LANG_ADMIN_PAGE;
  const sel = document.querySelector('.lpv-adm-tagsel');
  if (sel) sel.classList.toggle('is-on', !!langAdmTag);
  langAdmSwapWords();
}

/* ── Selecting several ─────────────────────────────────────────
   Off by default: the ticks are for the rare bulk delete, not for every
   visit. While selecting, a tap on a row ticks it instead of opening it. */

function langAdmToggleSelecting() {
  langAdmSelecting = !langAdmSelecting;
  if (!langAdmSelecting) langAdmSel = [];
  const btn = document.querySelector('.lpv-adm-selbtn');
  if (btn) {
    btn.classList.toggle('is-on', langAdmSelecting);
    btn.setAttribute('aria-pressed', langAdmSelecting ? 'true' : 'false');
    btn.innerHTML = langIcon(langAdmSelecting ? 'x' : 'list-checks') + '<span>' + (langAdmSelecting ? 'Done' : 'Select') + '</span>';
  }
  langAdmPaintBulk();
  langAdmSwapWords({ keepScroll: true });
}

function langAdmBulkHTML() {
  if (!langAdmSelecting) return '';
  const n = langAdmSel.length;
  return `
    <div class="lpv-adm-bulk">
      <b>${n ? n + ' selected' : 'Tap words to select them'}</b>
      <button class="btn btn-ghost btn-sm" type="button" onclick="langAdmSelectShown(true)">All shown</button>
      ${n ? `<button class="btn btn-ghost btn-sm" type="button" onclick="langAdmClearSel()">Clear</button>` : ''}
      <button class="btn btn-danger btn-sm" type="button" onclick="langAdmBulkDelete()" ${n ? '' : 'disabled'}>${langIcon('trash-2')} Delete</button>
    </div>`;
}

function langAdmPaintBulk() {
  const host = document.getElementById('lang-adm-bulk');
  if (host) host.innerHTML = langAdmBulkHTML();
}

function langAdmRowClick(id) {
  if (langAdmSelecting) {
    langAdmToggleSel(id, langAdmSel.indexOf(id) < 0);
    return;
  }
  if (langWordDraft && langWordDraft.id === id) return;
  langAdmGuard(() => langEditWordDraft(id));
}

/** Tick or untick one row, in place -- nothing else is redrawn. */
function langAdmToggleSel(id, on) {
  const i = langAdmSel.indexOf(id);
  if (on && i < 0) langAdmSel.push(id);
  if (!on && i > -1) langAdmSel.splice(i, 1);
  const row = document.querySelector('.lpv-adm-row[data-id="' + id + '"]');
  if (row) {
    row.classList.toggle('is-selected', !!on);
    row.setAttribute('aria-checked', on ? 'true' : 'false');
  }
  langAdmPaintBulk();
}

function langAdmSelectShown(on) {
  langAdmFilteredWords().slice(0, langAdminShown).forEach(w => {
    const i = langAdmSel.indexOf(w.id);
    if (on && i < 0) langAdmSel.push(w.id);
    if (!on && i > -1) langAdmSel.splice(i, 1);
  });
  document.querySelectorAll('.lpv-adm-row').forEach(r => {
    const sel = langAdmSel.indexOf(r.dataset.id) > -1;
    r.classList.toggle('is-selected', sel);
    r.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  langAdmPaintBulk();
}

function langAdmClearSel() { langAdmSelectShown(false); langAdmSel = []; langAdmPaintBulk(); }

/** Delete every ticked word, with one Undo that brings them all back. */
function langAdmBulkDelete() {
  const ids = langAdmSel.slice();
  if (!ids.length) return;
  showConfirm('Delete ' + ids.length + ' word' + (ids.length !== 1 ? 's' : '') + '?',
    'Undo brings them all back straight afterwards — schedules and due dates included.', () => {
      langStore();
      const recallStore = typeof langRecallStore === 'function' ? langRecallStore() : (state.langRecall || {});
      const removed = [];
      ids.forEach(id => {
        const i = state.langWords.findIndex(w => w.id === id);
        if (i < 0) return;
        const rec = state.langWords[i];
        const deadline = typeof agDetachDeadline === 'function' ? agDetachDeadline('langword', id) : null;
        const recall = recallStore[id] || null;
        if (recall) delete recallStore[id];
        state.langWords.splice(i, 1);
        removed.push({ rec, i, deadline, recall });
      });
      langAdmSel = [];
      langAdmSelecting = false;
      if (langWordDraft && ids.indexOf(langWordDraft.id) > -1) { langWordDraft = null; langAdmDirty = false; }
      saveData();
      langRefreshViews();
      const btn = document.querySelector('.lpv-adm-selbtn');
      if (btn) { btn.classList.remove('is-on'); btn.innerHTML = langIcon('list-checks') + '<span>Select</span>'; }
      langAdmPaintBulk();
      if (typeof pushUndo === 'function') {
        pushUndo('Deleted ' + removed.length + ' word' + (removed.length !== 1 ? 's' : ''), () => {
          langStore();
          const store = typeof langRecallStore === 'function' ? langRecallStore() : (state.langRecall = state.langRecall || {});
          // Back in reverse, so every word lands at the index it was taken from.
          removed.slice().reverse().forEach(x => {
            state.langWords.splice(Math.min(x.i, state.langWords.length), 0, x.rec);
            if (x.deadline && typeof agAttachDeadline === 'function') agAttachDeadline(x.deadline);
            if (x.recall) store[x.rec.id] = x.recall;
          });
          saveData();
          langRefreshViews();
        });
      }
    }, { confirmLabel: 'Delete' });
}

function langNewWordDraft() {
  langWordDraft = langBlankWord();
  langAdmWordLang = langStudy();
  langAdmCopyOf = '';
  langAdmDirty = false;
  if (document.querySelector('.lpv-adm-split')) langAdmPaintWords(!!langAdmFlash);
  else renderLangAdmin();
  langAdmFocusFirst();
}

function langEditWordDraft(id) {
  const w = langFindWord(id);
  if (!w) return;
  langWordDraft = JSON.parse(JSON.stringify(langNormWord(w)));
  langAdmWordLang = '';
  langAdmCopyOf = '';
  langAdmDirty = false;
  if (document.querySelector('.lpv-adm-split')) langAdmPaintWords(false);
  else renderLangAdmin();
}

/** A copy opens in the editor unsaved, so you change what differs and save. */
function langAdmDuplicateWord(id) {
  langAdmGuard(() => {
    const w = langFindWord(id);
    if (!w) return;
    const copy = JSON.parse(JSON.stringify(langNormWord(w)));
    copy.id = generateId();
    copy.createdAt = copy.updatedAt = Date.now();
    langWordDraft = copy;
    langAdmCopyOf = langHeadword(w);
    langAdmDirty = true;
    langAdmPaintWords(false);
  });
}

/* Deleting is undoable (the toast says so), so it does not ask first. */
function langAdminDeleteWord(id) {
  if (!langFindWord(id)) return;
  if (langWordDraft && langWordDraft.id === id) { langWordDraft = null; langAdmDirty = false; }
  langAdmSel = langAdmSel.filter(x => x !== id);
  langDeleteWord(id);   // refreshes the views, which repaints the rows in place
  renderLangAdmin();
}

function langAdmFocusFirst() {
  const el = document.querySelector('.lpv-adm-editor .lpv-adm-langpane.is-on input, .lpv-adm-editor input.form-input');
  if (el) el.focus({ preventScroll: true });
}

/* ── Hearing it ──────────────────────────────────────────────
   Every field you type a phrase into has a speaker beside it that reads
   what is in the field now, in that field's language. */

function langAdmSayHTML(code) {
  return `<button class="lpv-say" type="button" onclick="langAdmSay(this${code ? ", '" + code + "'" : ''})" title="Hear it" aria-label="Hear it">${langIcon('volume-2')}</button>`;
}

function langAdmSay(btn, code) {
  const scope = btn.closest('.lpv-say-wrap, [data-row]');
  // The text box -- not the "right answer" radio that leads an answer row.
  const input = scope && scope.querySelector('input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]):not([type="number"]), textarea');
  const text = input ? input.value.trim() : '';
  if (!text) {
    if (typeof toast === 'function') toast('Type something first.', { type: 'info', duration: 1800 });
    return;
  }
  const setLang = document.getElementById('lang-s-lang');
  const c = code || (setLang && setLang.value) || (langScenarioDraft && langScenarioDraft.lang) || langStudy();
  if (typeof speak === 'function') speak(text, { lang: langSpeechTag(c), langCode: c });
  btn.classList.remove('is-on'); void btn.offsetWidth; btn.classList.add('is-on');
}

function langWordFormHTML() {
  const w = langWordDraft;
  const study = langStudy();
  const isNew = !langFindWord(w.id);
  const filled = c => String(langForm(w, c).term || '').trim();
  const lang = langAdmWordLang || (filled(study) ? study : LANG_CODES.find(filled) || study);
  langAdmWordLang = lang;
  const tags = typeof langAllTags === 'function' ? langAllTags() : [];
  return `
    <div class="lpv-adm-editor" data-kind="word" data-draft-id="${w.id}" oninput="langAdmEdited(event)" onchange="langAdmEdited(event)">
      <div class="lpv-adm-ed-head">
        <span class="lpv-adm-ed-icon"><i data-lucide="book-a"></i></span>
        <span class="lpv-adm-ed-title">
          <span class="lpv-eyebrow">${langAdmCopyOf ? 'Copy of ' + escapeHTML(langAdmCopyOf) : isNew ? 'New word' : 'Editing'}</span>
          <b id="lang-adm-head">${escapeHTML(isNew && !langAdmCopyOf ? 'Untitled' : langHeadword(w, study))}</b>
        </span>
        <span class="lpv-adm-ed-tools">
          ${isNew ? '' : `
            <button class="ag-icon-btn" type="button" onclick="langAdmDuplicateWord('${w.id}')" title="Duplicate">${langIcon('copy')}</button>
            <button class="ag-icon-btn lpv-adm-danger" type="button" onclick="langAdminDeleteWord('${w.id}')" title="Delete">${langIcon('trash-2')}</button>`}
          <button class="ag-icon-btn" type="button" onclick="langCancelDraft()" title="Close (Esc)">${langIcon('x')}</button>
        </span>
      </div>

      <div class="lpv-adm-langtabs" role="tablist" aria-label="Language">
        ${LANGS.map(l => `
          <button class="lpv-adm-langtab${l.code === lang ? ' is-on' : ''}" type="button" role="tab" data-lc="${l.code}" data-tab="${l.code}"
                  aria-selected="${l.code === lang ? 'true' : 'false'}" onclick="langAdmWordTab('${l.code}')">
            <b>${escapeHTML(l.short)}</b><span>${escapeHTML(l.name)}</span>
            <i class="lpv-adm-fill${filled(l.code) ? ' is-on' : ''}" title="${filled(l.code) ? 'Filled in' : 'Empty'}"></i>
          </button>`).join('')}
      </div>
      ${LANGS.map(l => `
        <div class="lpv-adm-langpane${l.code === lang ? ' is-on' : ''}" data-pane="${l.code}" data-lc="${l.code}">
          ${langFormFieldsHTML(l.code, langForm(w, l.code))}
        </div>`).join('')}

      <div class="lpv-adm-field">
        <label class="form-label"><i data-lucide="tags"></i> Topics <span class="af-label-hint">Enter or comma adds one</span></label>
        ${langAdmChipsHTML('tags', w.tags || [], 'e.g. greetings', 'lang-adm-taglist')}
        <datalist id="lang-adm-taglist">${tags.map(t => `<option value="${escapeHTML(t.tag)}"></option>`).join('')}</datalist>
      </div>

      <div class="lpv-adm-ed-foot">
        <span class="lpv-adm-err" id="lang-adm-err" role="alert"></span>
        <button class="btn btn-secondary" type="button" onclick="langCancelDraft()">Cancel</button>
        <button class="btn btn-secondary" type="button" onclick="langSaveWordDraft(true)" title="Save, then start another">Save &amp; new</button>
        <button class="btn btn-primary" type="button" onclick="langSaveWordDraft()">${langIcon('check')} Save word</button>
      </div>
    </div>`;
}

function langAdmExampleRowHTML(code, e) {
  return `
    <div class="lpv-ex-row" data-row data-ex="${code}">
      <input class="form-input" data-ex-text value="${escapeHTML(e ? e.text : '')}" placeholder="Kinsa ka?" />
      ${langAdmSayHTML(code)}
      <span class="lpv-ex-eq">=</span>
      <input class="form-input" data-ex-gloss value="${escapeHTML(e ? e.gloss : '')}" placeholder="Who are you?" />
      <button class="ag-icon-btn" type="button" onclick="langAdmRemoveRow(this, 0)" title="Remove">${langIcon('x')}</button>
    </div>`;
}

function langFormFieldsHTML(code, f) {
  f = f || langBlankForm();
  return `
    <div class="lpv-adm-grid2 is-term">
      <div class="lpv-adm-field">
        <label class="form-label">Term in ${escapeHTML(langName(code))}</label>
        <div class="lpv-say-wrap">
          <input class="form-input lpv-adm-term" data-lang-field="${code}.term" value="${escapeHTML(f.term)}" placeholder="the word itself" />
          ${langAdmSayHTML(code)}
        </div>
      </div>
      <div class="lpv-adm-field">
        <label class="form-label">Part of speech</label>
        <select class="form-select" data-lang-field="${code}.pos">
          <option value="">—</option>
          ${LANG_POS.map(p => `<option value="${p}"${f.pos === p ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="lpv-adm-field">
      <label class="form-label">Definition</label>
      <textarea class="form-textarea" rows="2" data-lang-field="${code}.definition" placeholder="What it means, and how it is used">${escapeHTML(f.definition)}</textarea>
    </div>
    <div class="lpv-adm-field">
      <label class="form-label">Example sentences <span class="af-label-hint">sentence = what it means</span></label>
      <div class="lpv-ex-list">${(f.examples || []).map(e => langAdmExampleRowHTML(code, e)).join('')}</div>
      <button class="lpv-adm-add" type="button"
              onclick="langAdmAddRow(this, '.lpv-ex-list', langAdmExampleRowHTML('${code}'), 12)">${langIcon('plus')} Add example</button>
    </div>
    <div class="lpv-adm-grid2">
      <div class="lpv-adm-field">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" rows="2" data-lang-field="${code}.notes" placeholder="Anything worth remembering">${escapeHTML(f.notes)}</textarea>
      </div>
      <div class="lpv-adm-field">
        <label class="form-label">Restrictions</label>
        <textarea class="form-textarea" rows="2" data-lang-field="${code}.restrictions" placeholder="When NOT to use it">${escapeHTML(f.restrictions)}</textarea>
      </div>
    </div>`;
}

/** Switch the word editor's language tab. Every pane stays in the page. */
function langAdmWordTab(code) {
  langAdmWordLang = code;
  document.querySelectorAll('.lpv-adm-langtab').forEach(b => {
    const on = b.dataset.tab === code;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.lpv-adm-langpane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === code));
  const term = document.querySelector('.lpv-adm-langpane.is-on .lpv-adm-term');
  if (term) term.focus({ preventScroll: true });
}

/** The heading and the filled dots follow what is typed. */
function langAdmWordLive() {
  const ed = document.querySelector('.lpv-adm-editor[data-kind="word"]');
  if (!ed) return;
  const term = c => { const el = ed.querySelector('[data-lang-field="' + c + '.term"]'); return el ? el.value.trim() : ''; };
  ed.querySelectorAll('.lpv-adm-langtab').forEach(b => {
    const dot = b.querySelector('.lpv-adm-fill');
    if (dot) dot.classList.toggle('is-on', !!term(b.dataset.tab));
  });
  const order = [langStudy(), langRef()].concat(LANG_CODES);
  const head = order.map(term).find(Boolean);
  const h = document.getElementById('lang-adm-head');
  if (h) h.textContent = head || 'Untitled';
  const err = document.getElementById('lang-adm-err');
  if (err && head) err.textContent = '';
}

/** Reads the open word editor back into the draft. */
function langCollectWordForm() {
  const w = langWordDraft;
  const ed = langAdmEditorFor('word', w);
  if (!ed) return;
  const tagBox = ed.querySelector('[data-chips="tags"]');
  if (tagBox) {
    const pending = tagBox.querySelector('input');
    if (pending && pending.value.trim()) langAdmChipCommit(pending);
    w.tags = langAdmChipValues(tagBox);
  }
  ed.querySelectorAll('[data-lang-field]').forEach(el => {
    const [code, field] = el.getAttribute('data-lang-field').split('.');
    if (!w.forms[code]) w.forms[code] = langBlankForm();
    w.forms[code][field] = el.value;
  });
  LANG_CODES.forEach(code => {
    if (!w.forms[code]) w.forms[code] = langBlankForm();
    w.forms[code].examples = Array.from(ed.querySelectorAll('.lpv-ex-row[data-ex="' + code + '"]')).map(r => ({
      id: generateId(),
      text: r.querySelector('[data-ex-text]').value.trim(),
      gloss: r.querySelector('[data-ex-gloss]').value.trim()
    })).filter(e => e.text);
  });
}

function langSaveWordDraft(andNew) {
  langCollectWordForm();
  const saved = langSaveWord(langWordDraft);
  if (!saved) {
    const err = document.getElementById('lang-adm-err');
    if (err) {
      err.textContent = 'Give it a term in at least one language.';
      err.classList.remove('is-shake'); void err.offsetWidth; err.classList.add('is-shake');
    }
    const term = document.querySelector('.lpv-adm-langpane.is-on .lpv-adm-term');
    if (term) term.focus();
    return;
  }
  langAdmFlash = saved.id;
  langWordDraft = null;
  langAdmDirty = false;
  langAdmCopyOf = '';
  if (typeof toast === 'function') toast('Saved "' + langHeadword(saved) + '".', { type: 'success' });
  if (andNew) { langNewWordDraft(); return; }
  renderLangAdmin();
}

/* ============================================================
   DRILL SETS
   ============================================================ */

/** Every question and its parts carry an id, so the editor can read by id. */
function langAdmPrepSet(s) {
  (s.items || []).forEach(it => { if (!it.id) it.id = generateId(); });
  return s;
}

function langSetListHTML() {
  const all = langSets();
  const ready = all.filter(s => !langSetProblems(s).length).length;
  return `
    <div class="lpv-adm-tools is-wide lpv-in" style="--i:3">
      <div class="search-container">
        <i data-lucide="search"></i>
        <input type="text" class="search-input" id="lang-adm-setq" placeholder="Search sets…" autocomplete="off"
               value="${escapeHTML(langAdmSetQuery)}" oninput="langAdmSetSearch(this.value)" />
      </div>
      <span class="la-seg lpv-adm-seg" role="radiogroup" aria-label="Show">
        ${[['all', 'All', all.length], ['ready', 'Ready', ready], ['todo', 'Needs work', all.length - ready]].map(([k, l, n]) => `
          <button type="button" role="radio" class="${langAdmSetFilter === k ? 'is-on' : ''}" aria-checked="${langAdmSetFilter === k ? 'true' : 'false'}"
                  onclick="langAdmSetFilterTo('${k}')">${l} <em>${n}</em></button>`).join('')}
      </span>
    </div>
    <div class="lpv-grid lpv-adm-grid" id="lang-adm-setgrid">${langAdmSetCardsHTML()}</div>
    ${langAdmDockHTML(`${all.length} set${all.length !== 1 ? 's' : ''} · ${ready} ready`,
      `<button class="lpv-go is-small lpv-adm-new" type="button" onclick="langNewSetDraft()"><i data-lucide="plus"></i><span>New set</span></button>`)}`;
}

/* The list's main action lives in a bar pinned to the bottom of the screen,
   the way the Coding admin's form footer is -- in reach however far down
   the cards you have scrolled. */
function langAdmDockHTML(hint, action) {
  return `
    <div class="lpv-adm-dock">
      <span class="lpv-adm-dock-hint">${hint}</span>
      ${action}
    </div>`;
}

function langAdmSetCardsHTML() {
  const q = langAdmSetQuery.toLowerCase();
  const list = langSets().filter(s => {
    if (q && (s.title || '').toLowerCase().indexOf(q) < 0 && (s.description || '').toLowerCase().indexOf(q) < 0) return false;
    const ok = !langSetProblems(s).length;
    return langAdmSetFilter === 'all' || (langAdmSetFilter === 'ready' ? ok : !ok);
  });
  if (!list.length) {
    return langAdmEmptyHTML('layers', langSets().length ? 'No sets match' : 'No drill sets yet',
      langSets().length ? 'Try another search or filter.' : 'A set is a handful of questions you write, run start to finish.',
      `<button class="lpv-go is-small" type="button" onclick="langNewSetDraft()"><i data-lucide="plus"></i> New set</button>`);
  }
  return list.map((s, i) => {
    const problems = langSetProblems(s);
    const counts = {};
    (s.items || []).forEach(it => { counts[it.type] = (counts[it.type] || 0) + 1; });
    const n = (s.items || []).length;
    return `
      <div class="lpv-adm-card${langAdmFlash === s.id ? ' is-flash' : ''}" style="--k:${i}" role="button" tabindex="0"
           onclick="langEditSetDraft('${s.id}')" onkeydown="if (event.key === 'Enter') langEditSetDraft('${s.id}')">
        <div class="lpv-adm-card-top">
          <span class="lpv-adm-card-ico"><i data-lucide="layers"></i></span>
          <span class="lpv-adm-card-info">
            <b>${escapeHTML(s.title || 'Untitled')}</b>
            <span>${n} question${n !== 1 ? 's' : ''} · ${escapeHTML(langShort(s.lang))} → ${escapeHTML(langShort(s.refLang))}</span>
          </span>
        </div>
        ${s.description ? `<p class="lpv-adm-card-desc">${escapeHTML(s.description)}</p>` : ''}
        <div class="lpv-adm-card-types">
          ${LANG_PUZZLE_TYPES.filter(p => counts[p.type]).map(p => `
            <span class="lpv-type lpv-tone-${LANG_ADM_TYPE_TONE[p.type]}" title="${escapeHTML(p.name)}"><i data-lucide="${p.icon}"></i><b>${counts[p.type]}</b></span>`).join('')}
        </div>
        <div class="lpv-adm-card-foot">
          ${problems.length
            ? `<span class="lpv-adm-status is-todo" title="${escapeHTML(problems.join(' · '))}">${langIcon('alert-triangle')} ${problems.length} to fix</span>`
            : `<span class="lpv-adm-status is-ok">${langIcon('check')} Ready</span>`}
          <span class="lpv-adm-card-tools" onclick="event.stopPropagation()">
            <button class="ag-icon-btn" type="button" onclick="langStartSet('${s.id}', 0)" ${problems.length ? 'disabled' : ''} title="Try it">${langIcon('play')}</button>
            <button class="ag-icon-btn" type="button" onclick="langAdmDuplicateSet('${s.id}')" title="Duplicate">${langIcon('copy')}</button>
            <button class="ag-icon-btn lpv-adm-danger" type="button" onclick="langAdminDeleteSet('${s.id}')" title="Delete">${langIcon('trash-2')}</button>
          </span>
        </div>
      </div>`;
  }).join('');
}

function langAdmSetSearch(v) {
  langAdmSetQuery = (v || '').trim();
  const grid = document.getElementById('lang-adm-setgrid');
  if (!grid) { renderLangAdmin(); return; }
  grid.innerHTML = langAdmSetCardsHTML();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });
}

function langAdmSetFilterTo(k) { langAdmSetFilter = k; renderLangAdmin(); }

function langNewSetDraft() {
  langSetDraft = langBlankSet();
  langAdmOpen = {};
  langAdmCopyOf = '';
  langAdmDirty = false;
  renderLangAdmin();
  const t = document.getElementById('lang-s-title');
  if (t) t.focus();
}

function langEditSetDraft(id) {
  const s = langFindSet(id);
  if (!s) return;
  langSetDraft = langAdmPrepSet(JSON.parse(JSON.stringify(s)));
  // A short set opens with every question showing; a long one folded.
  langAdmOpen = {};
  if ((langSetDraft.items || []).length <= 2) langSetDraft.items.forEach(it => { langAdmOpen[it.id] = true; });
  langAdmCopyOf = '';
  langAdmDirty = false;
  renderLangAdmin();
}

function langAdmDuplicateSet(id) {
  langAdmGuard(() => {
    const s = langFindSet(id);
    if (!s) return;
    const copy = JSON.parse(JSON.stringify(s));
    copy.id = generateId();
    copy.title = (s.title || 'Untitled') + ' (copy)';
    copy.createdAt = copy.updatedAt = Date.now();
    (copy.items || []).forEach(it => { it.id = generateId(); });
    langSetDraft = copy;
    langAdmOpen = {};
    langAdmCopyOf = s.title || 'Untitled';
    langAdmDirty = true;
    renderLangAdmin();
  });
}

function langAdminDeleteSet(id) {
  if (!langFindSet(id)) return;
  if (langSetDraft && langSetDraft.id === id) { langSetDraft = null; langAdmDirty = false; }
  langDeleteSet(id);
  renderLangAdmin();
}

function langSetFormHTML() {
  const s = langSetDraft;
  const isNew = !langFindSet(s.id);
  const problems = langSetProblems(s);
  const langSelect = (id, val) => `
    <select class="form-select" id="${id}">
      ${LANGS.map(l => `<option value="${l.code}"${val === l.code ? ' selected' : ''}>${escapeHTML(l.name)}</option>`).join('')}
    </select>`;
  return `
    <div class="lpv-adm-editor is-wide" data-kind="set" data-draft-id="${s.id}" oninput="langAdmEdited(event)" onchange="langAdmEdited(event)">
      <div class="lpv-adm-ed-head">
        <button class="lpv-adm-backlink" type="button" onclick="langCancelDraft()">${langIcon('arrow-left')} All sets</button>
        <span class="lpv-adm-ed-icon"><i data-lucide="layers"></i></span>
        <span class="lpv-adm-ed-title">
          <span class="lpv-eyebrow">${langAdmCopyOf ? 'Copy of ' + escapeHTML(langAdmCopyOf) : isNew ? 'New drill set' : 'Drill set'}</span>
          <b id="lang-adm-head">${escapeHTML(s.title || 'Untitled')}</b>
        </span>
        <span class="lpv-adm-ed-tools">
          ${isNew ? '' : `
            <button class="ag-icon-btn" type="button" onclick="langAdmDuplicateSet('${s.id}')" title="Duplicate">${langIcon('copy')}</button>
            <button class="ag-icon-btn lpv-adm-danger" type="button" onclick="langAdminDeleteSet('${s.id}')" title="Delete">${langIcon('trash-2')}</button>`}
        </span>
      </div>

      <div class="lpv-adm-panel">
        <div class="lpv-adm-grid2">
          <div class="lpv-adm-field">
            <label class="form-label">Title</label>
            <input class="form-input af-input-bold" id="lang-s-title" value="${escapeHTML(s.title)}" placeholder="e.g. Question words — round 1" />
          </div>
          <div class="lpv-adm-field">
            <label class="form-label">Description <span class="af-label-hint">optional</span></label>
            <input class="form-input" id="lang-s-desc" value="${escapeHTML(s.description)}" placeholder="What it practises" />
          </div>
          <div class="lpv-adm-field"><label class="form-label">Language being learned</label>${langSelect('lang-s-lang', s.lang)}</div>
          <div class="lpv-adm-field"><label class="form-label">Compared against</label>${langSelect('lang-s-ref', s.refLang)}</div>
        </div>
      </div>

      <div class="lpv-adm-qhead">
        <h3>Questions <span class="lpv-adm-qcount">${(s.items || []).length}</span></h3>
        ${(s.items || []).length > 1 ? `
          <button class="lpv-link" type="button" onclick="langAdmFoldAll(true)">Open all</button>
          <button class="lpv-link" type="button" onclick="langAdmFoldAll(false)">Fold all</button>` : ''}
      </div>
      <div class="lpv-adm-qlist">
        ${(s.items || []).map((it, i) => langItemFormHTML(it, i, (s.items || []).length)).join('')
          || '<p class="lpv-adm-hint">No questions yet. Pick a kind below to add the first.</p>'}
      </div>
      <div class="lpv-adm-addq">
        <span>Add a question</span>
        ${LANG_PUZZLE_TYPES.map(p => `
          <button class="lpv-adm-addtype lpv-tone-${LANG_ADM_TYPE_TONE[p.type]}" type="button" onclick="langAddItem('${p.type}')" title="${escapeHTML(p.hint)}">
            <i data-lucide="${p.icon}"></i> ${escapeHTML(p.name)}
          </button>`).join('')}
      </div>

      <div class="lpv-adm-ed-foot is-sticky">
        <span class="lpv-adm-err" id="lang-adm-err" role="alert">${problems.length && (s.items || []).length ? escapeHTML(problems.length + ' thing' + (problems.length !== 1 ? 's' : '') + ' to fix before it can run') : ''}</span>
        <button class="btn btn-secondary" type="button" onclick="langCancelDraft()">Cancel</button>
        <button class="btn btn-primary" type="button" onclick="langSaveSetDraft()">${langIcon('check')} Save set</button>
      </div>
    </div>`;
}

/** One line that says what a question is, for its folded header. */
function langAdmQSummary(it) {
  if (it.type === 'match') {
    const left = (it.pairs || []).map(p => (p.left || '').trim()).filter(Boolean);
    return left.length ? left.join(' · ') : 'No pairs yet';
  }
  if (it.type === 'choice') {
    const right = ((it.options || [])[it.correctIndex] || '').trim();
    return (it.prompt || 'No prompt yet') + (right ? '  →  ' + right : '');
  }
  if (it.type === 'blank') return it.prompt || 'No sentence yet';
  return (it.prompt || 'No prompt yet') + (it.answer ? '  →  ' + it.answer : '');
}

/** The sentence a blank was made from, and which word is the gap. */
function langAdmBlankParts(it) {
  const prompt = String(it.prompt || '');
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  const at = words.findIndex(w => /_{2,}|\{\}/.test(w));
  const sentence = at > -1 ? prompt.replace(/_{2,}|\{\}/, it.answer || '') : prompt;
  return { sentence: sentence.trim(), at };
}

/** Blank out word `at` of a sentence: the prompt with ___, and the answer. */
function langAdmMakeBlank(sentence, at) {
  const words = String(sentence || '').trim().split(/\s+/).filter(Boolean);
  if (at < 0 || at >= words.length) return { prompt: words.join(' '), answer: '' };
  const target = words[at];
  // The tile is the word, not the word plus the comma that followed it.
  const core = target.replace(/^[^\wÀ-ÿ'-]+|[^\wÀ-ÿ'-]+$/g, '') || target;
  const start = target.indexOf(core);
  const gap = target.slice(0, start) + '___' + target.slice(start + core.length);
  return { prompt: words.map((w, i) => (i === at ? gap : w)).join(' '), answer: core };
}

function langAdmBlankWordsHTML(sentence, at) {
  const words = String(sentence || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '<span class="lpv-adm-hint">Type the sentence above, then tap the word to hide.</span>';
  return words.map((w, i) => `<button type="button" class="lpv-bw${i === at ? ' is-on' : ''}" onclick="langAdmBlankPick(this, ${i})">${escapeHTML(w)}</button>`).join('');
}

function langAdmBlankSync(input) {
  const card = input.closest('.lpv-qc');
  const pick = card && card.querySelector('.lpv-blank-pick');
  if (!pick) return;
  const n = input.value.trim().split(/\s+/).filter(Boolean).length;
  let at = parseInt(pick.dataset.at, 10);
  if (!(at >= 0 && at < n)) at = -1;
  pick.dataset.at = String(at);
  pick.innerHTML = langAdmBlankWordsHTML(input.value, at);
}

function langAdmBlankPick(btn, i) {
  const pick = btn.closest('.lpv-blank-pick');
  pick.dataset.at = String(i);
  pick.querySelectorAll('.lpv-bw').forEach((b, k) => b.classList.toggle('is-on', k === i));
  langAdmDirty = true;
  langAdmQLive(btn.closest('.lpv-qc'));
}

function langAdmOptRowHTML(qid, text, checked) {
  return `
    <div class="lpv-opt" data-row>
      <label class="lpv-opt-right" title="This is the right answer">
        <input type="radio" name="lang-c-${qid}" ${checked ? 'checked' : ''} /><span>${langIcon('check')}</span>
      </label>
      <input class="form-input" data-opt value="${escapeHTML(text || '')}" placeholder="An answer" />
      ${langAdmSayHTML()}
      <button class="ag-icon-btn" type="button" onclick="langAdmRemoveRow(this, 2)" title="Remove">${langIcon('x')}</button>
    </div>`;
}

function langAdmPairRowHTML(p) {
  return `
    <div class="lpv-pair-row" data-row>
      <input class="form-input" data-l value="${escapeHTML(p ? p.left : '')}" placeholder="Word" />
      ${langAdmSayHTML()}
      <span class="lpv-pair-link">${langIcon('arrow-right')}</span>
      <input class="form-input" data-r value="${escapeHTML(p ? p.right : '')}" placeholder="Its meaning" />
      <button class="ag-icon-btn" type="button" onclick="langAdmRemoveRow(this, 2)" title="Remove">${langIcon('x')}</button>
    </div>`;
}

function langItemFormHTML(it, i, total) {
  const meta = langPuzzleMeta(it.type);
  const problems = langItemProblems(it);
  const open = !!langAdmOpen[it.id];
  const field = (key, label, value, placeholder, hint, say) => {
    const input = `<input class="form-input" data-f="${key}" value="${escapeHTML(value || '')}" placeholder="${escapeHTML(placeholder)}" />`;
    return `
    <div class="lpv-adm-field">
      <label class="form-label">${label}${hint ? ` <span class="af-label-hint">${hint}</span>` : ''}</label>
      ${say ? `<div class="lpv-say-wrap">${input}${langAdmSayHTML()}</div>` : input}
    </div>`;
  };
  const tiles = (single) => `
    <div class="lpv-adm-field">
      <label class="form-label">Extra tiles <span class="af-label-hint">wrong ${single ? 'words' : 'words to mix in'} — Enter adds one</span></label>
      <div class="lpv-adm-inline">
        ${langAdmChipsHTML('distractors', it.distractors || [], single ? 'one word each' : 'unsa, asa…')}
        <button class="lpv-adm-add" type="button" onclick="langAdmSuggestTiles(this)" title="Pick three from your dictionary">${langIcon('wand-2')} Suggest</button>
      </div>
    </div>`;

  let body = '';
  if (it.type === 'arrange') {
    body = field('prompt', 'What to say', it.prompt, 'Say: Where are you going?', 'the meaning, in the language you read')
      + field('answer', 'The sentence', it.answer, 'Asa ka padulong?', 'in order — this is what gets built', true)
      + tiles(false);
  } else if (it.type === 'blank') {
    const parts = langAdmBlankParts(it);
    body = `
      <div class="lpv-adm-field">
        <label class="form-label">The full sentence</label>
        <div class="lpv-say-wrap">
          <input class="form-input" data-f="sentence" value="${escapeHTML(parts.sentence)}" placeholder="Maayong buntag sa imo!"
                 oninput="langAdmBlankSync(this)" />
          ${langAdmSayHTML()}
        </div>
      </div>
      <div class="lpv-adm-field">
        <label class="form-label">Tap the word to hide</label>
        <div class="lpv-blank-pick" data-at="${parts.at}">${langAdmBlankWordsHTML(parts.sentence, parts.at)}</div>
      </div>
      ${field('hint', 'What the sentence means', it.hint, 'Good morning to you!', 'shown under it, so the gap is not a guess')}
      ${tiles(true)}`;
  } else if (it.type === 'choice') {
    const opts = (it.options && it.options.length ? it.options : ['', '', '']);
    body = field('prompt', 'Question', it.prompt, 'Which one means "where"?')
      + `
      <div class="lpv-adm-field">
        <label class="form-label">Answers <span class="af-label-hint">tick the right one</span></label>
        <div class="lpv-opt-list">${opts.map((o, k) => langAdmOptRowHTML(it.id, o, k === it.correctIndex)).join('')}</div>
        <div class="lpv-adm-inline">
          <button class="lpv-adm-add" type="button" onclick="langAdmAddRow(this, '.lpv-opt-list', langAdmOptRowHTML('${it.id}', '', false), 6)">${langIcon('plus')} Add answer</button>
          <button class="lpv-adm-add" type="button" onclick="langAdmSuggestOptions(this)" title="Fill the empty answers from your dictionary">${langIcon('wand-2')} Suggest wrong answers</button>
        </div>
      </div>`;
  } else if (it.type === 'translate') {
    body = field('prompt', 'Prompt', it.prompt, 'Type "thank you" in Cebuano')
      + field('answer', 'Answer', it.answer, 'Salamat', 'small typos are forgiven when playing', true);
  } else if (it.type === 'match') {
    const pairs = (it.pairs && it.pairs.length ? it.pairs : [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }]);
    body = field('prompt', 'Instruction', it.prompt, 'Match each one to its meaning')
      + `
      <div class="lpv-adm-field">
        <label class="form-label">Pairs</label>
        <div class="lpv-pair-list">${pairs.map(langAdmPairRowHTML).join('')}</div>
        <button class="lpv-adm-add" type="button" onclick="langAdmAddRow(this, '.lpv-pair-list', langAdmPairRowHTML(), 8)">${langIcon('plus')} Add pair</button>
      </div>`;
  }
  body += field('note', 'Note after answering', it.note, 'Why this is the answer', 'optional');

  return `
    <div class="lpv-qc lpv-tone-${LANG_ADM_TYPE_TONE[it.type] || 'primary'}${open ? ' is-open' : ''}${problems.length ? ' has-problem' : ''}${it.id === langAdmNewId ? ' is-new' : ''}"
         data-qid="${it.id}" data-type="${it.type}" style="--k:${i}">
      <div class="lpv-q-head" onclick="langAdmToggleQ('${it.id}')">
        <span class="lpv-q-num">${i + 1}</span>
        <span class="lpv-type" title="${escapeHTML(meta.name)}"><i data-lucide="${meta.icon}"></i></span>
        <span class="lpv-q-sum"><b>${escapeHTML(meta.name)}</b><span class="lpv-q-text">${escapeHTML(langAdmQSummary(it))}</span></span>
        <span class="lpv-q-status">${problems.length ? langIcon('alert-triangle') + ' ' + escapeHTML(problems[0]) : langIcon('check')}</span>
        <span class="lpv-q-tools" onclick="event.stopPropagation()">
          <button class="ag-icon-btn" type="button" onclick="langMoveItem('${it.id}', -1)" ${i === 0 ? 'disabled' : ''} title="Move up">${langIcon('chevron-up')}</button>
          <button class="ag-icon-btn" type="button" onclick="langMoveItem('${it.id}', 1)" ${i === total - 1 ? 'disabled' : ''} title="Move down">${langIcon('chevron-down')}</button>
          <button class="ag-icon-btn" type="button" onclick="langAdmDuplicateItem('${it.id}')" title="Duplicate">${langIcon('copy')}</button>
          <button class="ag-icon-btn lpv-adm-danger" type="button" onclick="langRemoveItem('${it.id}')" title="Remove">${langIcon('trash-2')}</button>
        </span>
        <span class="lpv-q-caret">${langIcon('chevron-down')}</span>
      </div>
      <div class="lpv-q-body"><div class="lpv-q-inner">${body}</div></div>
    </div>`;
}

/** Read one question card into `it`. */
function langAdmReadItem(card, it) {
  const val = sel => { const el = card.querySelector(sel); return el ? el.value : undefined; };
  const put = (k, v) => { if (v !== undefined) it[k] = v; };
  put('prompt', val('[data-f="prompt"]'));
  put('answer', val('[data-f="answer"]'));
  put('note', val('[data-f="note"]'));
  if (it.type === 'blank') {
    const sentence = val('[data-f="sentence"]');
    if (sentence !== undefined) {
      const pick = card.querySelector('.lpv-blank-pick');
      const b = langAdmMakeBlank(sentence, pick ? parseInt(pick.dataset.at, 10) : -1);
      it.prompt = b.prompt;
      it.answer = b.answer;
    }
    put('hint', val('[data-f="hint"]'));
  }
  const chips = card.querySelector('[data-chips="distractors"]');
  if (chips) it.distractors = langAdmChipValues(chips);
  if (it.type === 'choice') {
    const rows = Array.from(card.querySelectorAll('.lpv-opt'));
    it.options = rows.map(r => r.querySelector('[data-opt]').value);
    const ci = rows.findIndex(r => r.querySelector('input[type="radio"]').checked);
    it.correctIndex = ci < 0 ? 0 : ci;
  }
  if (it.type === 'match') {
    it.pairs = Array.from(card.querySelectorAll('.lpv-pair-row')).map(r => ({
      left: r.querySelector('[data-l]').value, right: r.querySelector('[data-r]').value
    }));
  }
  return it;
}

/** A question card's header follows what is typed into it. */
function langAdmQLive(card) {
  if (!card || !langSetDraft) return;
  const base = (langSetDraft.items || []).find(x => x.id === card.dataset.qid);
  if (!base) return;
  const tmp = langAdmReadItem(card, JSON.parse(JSON.stringify(base)));
  const problems = langItemProblems(tmp);
  card.classList.toggle('has-problem', problems.length > 0);
  const text = card.querySelector('.lpv-q-text');
  if (text) text.textContent = langAdmQSummary(tmp);
  const status = card.querySelector('.lpv-q-status');
  if (status) status.innerHTML = problems.length ? langIcon('alert-triangle') + ' ' + escapeHTML(problems[0]) : langIcon('check');
}

function langAdmToggleQ(id) {
  const card = document.querySelector('.lpv-qc[data-qid="' + id + '"]');
  if (!card) return;
  const open = !card.classList.contains('is-open');
  card.classList.toggle('is-open', open);
  langAdmOpen[id] = open;
}

function langAdmFoldAll(open) {
  document.querySelectorAll('.lpv-qc').forEach(c => { c.classList.toggle('is-open', open); langAdmOpen[c.dataset.qid] = open; });
}

/** Reads the open set editor back into the draft, question by question id. */
function langCollectSetForm() {
  const s = langSetDraft;
  const ed = langAdmEditorFor('set', s);
  if (!ed) return;
  const g = id => ed.querySelector('#' + id);
  if (g('lang-s-title')) s.title = g('lang-s-title').value;
  if (g('lang-s-desc')) s.description = g('lang-s-desc').value;
  if (g('lang-s-lang')) s.lang = g('lang-s-lang').value;
  if (g('lang-s-ref')) s.refLang = g('lang-s-ref').value;
  ed.querySelectorAll('.lpv-qc[data-qid]').forEach(card => {
    const it = (s.items || []).find(x => x.id === card.dataset.qid);
    if (it) langAdmReadItem(card, it);
  });
}

function langAdmScrollTo(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const first = el.querySelector('.lpv-q-inner input');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 250);
}

function langAddItem(type) {
  langCollectSetForm();
  langSetDraft.items = langSetDraft.items || [];
  const it = langBlankItem(type);
  if (type === 'match') it.prompt = 'Match each one to its meaning';
  langSetDraft.items.push(it);
  langAdmOpen[it.id] = true;
  langAdmNewId = it.id;
  langAdmDirty = true;
  renderLangAdmin();
  langAdmScrollTo('.lpv-qc[data-qid="' + it.id + '"]');
}

function langRemoveItem(id) {
  langCollectSetForm();
  langSetDraft.items = (langSetDraft.items || []).filter(x => x.id !== id);
  langAdmDirty = true;
  renderLangAdmin();
}

function langMoveItem(id, dir) {
  langCollectSetForm();
  const items = langSetDraft.items || [];
  const i = items.findIndex(x => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  langAdmDirty = true;
  renderLangAdmin();
}

function langAdmDuplicateItem(id) {
  langCollectSetForm();
  const items = langSetDraft.items || [];
  const i = items.findIndex(x => x.id === id);
  if (i < 0) return;
  const copy = JSON.parse(JSON.stringify(items[i]));
  copy.id = generateId();
  items.splice(i + 1, 0, copy);
  langAdmOpen[copy.id] = true;
  langAdmNewId = copy.id;
  langAdmDirty = true;
  renderLangAdmin();
  langAdmScrollTo('.lpv-qc[data-qid="' + copy.id + '"]');
}

/** Words from the dictionary in the set's language, none already used. */
function langAdmPickWords(n, avoid, singleWord) {
  const sel = document.getElementById('lang-s-lang');
  const code = sel ? sel.value : langStudy();
  const skip = (avoid || []).map(langNormalizeAnswer);
  const out = [];
  langShuffle(langWords()).some(w => {
    const t = String(langForm(w, code).term || '').trim();
    if (!t || skip.indexOf(langNormalizeAnswer(t)) > -1 || (singleWord && /\s/.test(t))) return false;
    skip.push(langNormalizeAnswer(t));
    out.push(t);
    return out.length >= n;
  });
  return out;
}

function langAdmSuggestTiles(btn) {
  const card = btn.closest('.lpv-qc');
  const box = card && card.querySelector('[data-chips="distractors"]');
  if (!box) return;
  const it = langAdmReadItem(card, { type: card.dataset.type });
  const avoid = String(it.answer || '').split(/\s+/).concat(langAdmChipValues(box));
  const picks = langAdmPickWords(3, avoid, card.dataset.type === 'blank');
  if (!picks.length && typeof toast === 'function') toast('No words in your dictionary to suggest yet.', { type: 'info' });
  picks.forEach(p => langAdmAddChip(box, p));
  langAdmQLive(card);
}

function langAdmSuggestOptions(btn) {
  const card = btn.closest('.lpv-qc');
  if (!card) return;
  const inputs = Array.from(card.querySelectorAll('.lpv-opt')).filter(r => !r.querySelector('input[type="radio"]').checked)
    .map(r => r.querySelector('[data-opt]')).filter(inp => !inp.value.trim());
  const used = Array.from(card.querySelectorAll('[data-opt]')).map(i => i.value);
  const picks = langAdmPickWords(inputs.length || 1, used, false);
  if (!inputs.length) {
    const row = langAdmAddRow(btn, '.lpv-opt-list', langAdmOptRowHTML(card.dataset.qid, picks[0] || '', false), 6);
    if (!row) return;
  } else {
    inputs.forEach((inp, k) => { if (picks[k]) inp.value = picks[k]; });
  }
  langAdmDirty = true;
  langAdmQLive(card);
}

function langSaveSetDraft() {
  langCollectSetForm();
  if (!(langSetDraft.title || '').trim()) {
    const err = document.getElementById('lang-adm-err');
    if (err) { err.textContent = 'Give the set a title first.'; err.classList.remove('is-shake'); void err.offsetWidth; err.classList.add('is-shake'); }
    const t = document.getElementById('lang-s-title');
    if (t) t.focus();
    return;
  }
  const saved = langSaveSet(langSetDraft);
  const problems = langSetProblems(langSetDraft);
  langAdmFlash = saved ? saved.id : '';
  langSetDraft = null;
  langAdmDirty = false;
  langAdmCopyOf = '';
  renderLangAdmin();
  if (typeof toast === 'function') {
    toast(problems.length ? `Saved — ${problems.length} thing${problems.length !== 1 ? 's' : ''} still to fix before it can run.` : 'Set saved.',
      { type: problems.length ? 'info' : 'success' });
  }
}

/* ============================================================
   SCENARIOS
   ============================================================ */

function langAdmPrepScenario(s) {
  (s.encounters || []).forEach(e => { if (!e.id) e.id = generateId(); });
  return s;
}

/** What stops a scenario being fought, in plain words. */
function langAdmScenarioProblems(sc) {
  const out = [];
  if (!(sc.title || '').trim()) out.push('no title');
  if (!(sc.encounters || []).length) out.push('no encounters');
  (sc.encounters || []).forEach((e, i) => {
    const p = langAdmEncProblems(e);
    if (p.length) out.push('encounter ' + (i + 1) + ': ' + p[0]);
  });
  return out;
}

function langAdmEncProblems(e) {
  const out = [];
  if (!(e.line || '').trim()) out.push('nothing said');
  const opts = (e.options || []).filter(o => (o.text || '').trim());
  if (opts.length < 2) out.push('needs two replies');
  else if (!opts.some(o => o.correct)) out.push('no right reply ticked');
  return out;
}

function langScenarioListHTML() {
  const list = langScenarios();
  const readyN = list.filter(s => !langAdmScenarioProblems(s).length).length;
  return `
    <div class="lpv-grid lpv-adm-grid lpv-in" style="--i:3">
      ${list.map((s, i) => {
        const loc = langLocation(s.location);
        const problems = langAdmScenarioProblems(s);
        const n = (s.encounters || []).length;
        return `
        <div class="lpv-scene lpv-adm-scene${langAdmFlash === s.id ? ' is-flash' : ''}" style="--k:${i}" role="button" tabindex="0"
             onclick="langEditScenarioDraft('${s.id}')" onkeydown="if (event.key === 'Enter') langEditScenarioDraft('${s.id}')">
          <div class="lpv-scene-art lpv-bg-${escapeHTML(loc.key)}">
            <span class="lpv-scene-loc"><i data-lucide="${loc.icon}"></i> ${escapeHTML(loc.name)}</span>
            <span class="lpv-scene-face lpv-face-${escapeHTML(typeof lpvFaceKey === 'function' ? lpvFaceKey(s.npc, s.face) : '')}"></span>
          </div>
          <div class="lpv-scene-body">
            <b>${escapeHTML(s.title || 'Untitled')}</b>
            <span>${langIcon('user')} ${escapeHTML(s.npc || 'Someone')} · ${langIcon('messages-square')} ${n} encounter${n !== 1 ? 's' : ''}</span>
          </div>
          <div class="lpv-adm-card-foot">
            ${problems.length
              ? `<span class="lpv-adm-status is-todo" title="${escapeHTML(problems.join(' · '))}">${langIcon('alert-triangle')} ${problems.length} to fix</span>`
              : `<span class="lpv-adm-status is-ok">${langIcon('check')} Ready</span>`}
            <span class="lpv-adm-card-tools" onclick="event.stopPropagation()">
              <button class="ag-icon-btn" type="button" onclick="langStartScenario('${s.id}')" ${problems.length ? 'disabled' : ''} title="Fight it">${langIcon('swords')}</button>
              <button class="ag-icon-btn" type="button" onclick="langAdmDuplicateScenario('${s.id}')" title="Duplicate">${langIcon('copy')}</button>
              <button class="ag-icon-btn lpv-adm-danger" type="button" onclick="langAdminDeleteScenario('${s.id}')" title="Delete">${langIcon('trash-2')}</button>
            </span>
          </div>
        </div>`;
      }).join('') || langAdmEmptyHTML('map', 'No scenarios yet', 'A scenario is somebody you meet, what they say, and the replies you could give.',
        `<button class="lpv-go is-small" type="button" onclick="langNewScenarioDraft()"><i data-lucide="plus"></i> New scenario</button>`)}
    </div>
    ${langAdmDockHTML(`${list.length} scenario${list.length !== 1 ? 's' : ''} · ${readyN} ready`,
      `<button class="lpv-go is-small lpv-adm-new" type="button" onclick="langNewScenarioDraft()"><i data-lucide="plus"></i><span>New scenario</span></button>`)}`;
}

function langNewScenarioDraft() {
  langScenarioDraft = langBlankScenario();
  langScenarioDraft.encounters = [langBlankEncounter()];
  langAdmOpen = {};
  langAdmOpen[langScenarioDraft.encounters[0].id] = true;
  langAdmCopyOf = '';
  langAdmDirty = false;
  renderLangAdmin();
  const t = document.getElementById('lang-sc-title');
  if (t) t.focus();
}

function langEditScenarioDraft(id) {
  const s = langFindScenario(id);
  if (!s) return;
  langScenarioDraft = langAdmPrepScenario(JSON.parse(JSON.stringify(s)));
  langAdmOpen = {};
  if ((langScenarioDraft.encounters || []).length <= 2) langScenarioDraft.encounters.forEach(e => { langAdmOpen[e.id] = true; });
  langAdmCopyOf = '';
  langAdmDirty = false;
  renderLangAdmin();
}

function langAdmDuplicateScenario(id) {
  langAdmGuard(() => {
    const s = langFindScenario(id);
    if (!s) return;
    const copy = JSON.parse(JSON.stringify(s));
    copy.id = generateId();
    copy.title = (s.title || 'Untitled') + ' (copy)';
    copy.createdAt = copy.updatedAt = Date.now();
    (copy.encounters || []).forEach(e => { e.id = generateId(); });
    langScenarioDraft = copy;
    langAdmOpen = {};
    langAdmCopyOf = s.title || 'Untitled';
    langAdmDirty = true;
    renderLangAdmin();
  });
}

function langAdminDeleteScenario(id) {
  if (!langFindScenario(id)) return;
  if (langScenarioDraft && langScenarioDraft.id === id) { langScenarioDraft = null; langAdmDirty = false; }
  langDeleteScenario(id);
  renderLangAdmin();
}

function langScenarioFormHTML() {
  const s = langScenarioDraft;
  const isNew = !langFindScenario(s.id);
  const face = typeof lpvFaceKey === 'function' ? lpvFaceKey(s.npc, s.face) : '';
  const num = (id, label, value, min, max, icon) => `
    <div class="lpv-adm-field lpv-adm-num">
      <label class="form-label" for="${id}">${langIcon(icon)} ${label}</label>
      <input class="form-input" type="number" min="${min}" max="${max}" id="${id}" value="${value}" />
    </div>`;
  return `
    <div class="lpv-adm-editor is-wide" data-kind="scenario" data-draft-id="${s.id}" oninput="langAdmEdited(event)" onchange="langAdmEdited(event)">
      <div class="lpv-adm-ed-head">
        <button class="lpv-adm-backlink" type="button" onclick="langCancelDraft()">${langIcon('arrow-left')} All scenarios</button>
        <span class="lpv-adm-ed-icon"><i data-lucide="swords"></i></span>
        <span class="lpv-adm-ed-title">
          <span class="lpv-eyebrow">${langAdmCopyOf ? 'Copy of ' + escapeHTML(langAdmCopyOf) : isNew ? 'New scenario' : 'Scenario'}</span>
          <b id="lang-adm-head">${escapeHTML(s.title || 'Untitled')}</b>
        </span>
        <span class="lpv-adm-ed-tools">
          ${isNew ? '' : `
            <button class="ag-icon-btn" type="button" onclick="langAdmDuplicateScenario('${s.id}')" title="Duplicate">${langIcon('copy')}</button>
            <button class="ag-icon-btn lpv-adm-danger" type="button" onclick="langAdminDeleteScenario('${s.id}')" title="Delete">${langIcon('trash-2')}</button>`}
        </span>
      </div>

      <div class="lpv-adm-panel lpv-adm-scenehead">
        <div class="lpv-adm-who">
          <input type="hidden" id="lang-sc-facekey" value="${escapeHTML(s.face || '')}" />
          <button class="lpv-adm-who-btn" type="button" onclick="langAdmToggleFacePick()" aria-haspopup="true"
                  aria-expanded="false" title="Choose who they look like">
            <span class="lpv-adm-face lpv-face-${escapeHTML(face)}" id="lang-sc-face"></span>
            <span class="lpv-adm-who-hint" aria-hidden="true">${langIcon('repeat')}</span>
          </button>
          <div class="lpv-face-pick" id="lang-sc-facepick" hidden>${langAdmFacePickHTML(s.face || '', s.npc)}</div>
        </div>
        <div class="lpv-adm-who-fields">
          <div class="lpv-adm-grid2">
            <div class="lpv-adm-field">
              <label class="form-label">Title</label>
              <input class="form-input af-input-bold" id="lang-sc-title" value="${escapeHTML(s.title)}" placeholder="e.g. Lunch queue small talk" />
            </div>
            <div class="lpv-adm-field">
              <label class="form-label">Who you meet <span class="af-label-hint">the name picks their face</span></label>
              <input class="form-input" id="lang-sc-npc" value="${escapeHTML(s.npc)}" placeholder="e.g. Ate Marites" oninput="langAdmNpcLive(this)" />
            </div>
          </div>
          <div class="lpv-adm-nums">
            ${num('lang-sc-hp', 'Your HP', s.playerHp, 20, 500, 'heart')}
            ${num('lang-sc-mp', 'Your MP', s.playerMana, 0, 200, 'sparkles')}
            ${num('lang-sc-nhp', 'Their HP', s.npcHp, 20, 500, 'shield')}
          </div>
        </div>
      </div>

      <div class="lpv-adm-field">
        <label class="form-label">Where it happens</label>
        <input type="hidden" id="lang-sc-loc" value="${escapeHTML(s.location)}" />
        <div class="lpv-locs">
          ${LANG_LOCATIONS.map(l => `
            <button class="lpv-loc lpv-bg-${l.key}${s.location === l.key ? ' is-on' : ''}" type="button" data-loc="${l.key}" onclick="langAdmPickLoc('${l.key}')">
              <span><i data-lucide="${l.icon}"></i> ${escapeHTML(l.name)}</span>
            </button>`).join('')}
        </div>
      </div>

      <div class="lpv-adm-qhead">
        <h3>Encounters <span class="lpv-adm-qcount">${(s.encounters || []).length}</span></h3>
        ${(s.encounters || []).length > 1 ? `
          <button class="lpv-link" type="button" onclick="langAdmFoldAllEnc(true)">Open all</button>
          <button class="lpv-link" type="button" onclick="langAdmFoldAllEnc(false)">Fold all</button>` : ''}
      </div>
      <div class="lpv-adm-qlist">
        ${(s.encounters || []).map((e, i) => langEncounterFormHTML(e, i, (s.encounters || []).length)).join('')
          || '<p class="lpv-adm-hint">No encounters yet.</p>'}
      </div>
      <div class="lpv-adm-addq">
        <button class="lpv-adm-addtype lpv-tone-warning" type="button" onclick="langAddEncounter()"><i data-lucide="message-circle-plus"></i> Add encounter</button>
      </div>

      <div class="lpv-adm-ed-foot is-sticky">
        <span class="lpv-adm-err" id="lang-adm-err" role="alert"></span>
        <button class="btn btn-secondary" type="button" onclick="langCancelDraft()">Cancel</button>
        <button class="btn btn-primary" type="button" onclick="langSaveScenarioDraft()">${langIcon('check')} Save scenario</button>
      </div>
    </div>`;
}

function langAdmReplyRowHTML(eid, o) {
  return `
    <div class="lpv-opt is-reply" data-row>
      <label class="lpv-opt-right" title="This is the reply that fits">
        <input type="radio" name="lang-r-${eid}" ${o && o.correct ? 'checked' : ''} /><span>${langIcon('check')}</span>
      </label>
      <input class="form-input" data-reply value="${escapeHTML(o ? o.text : '')}" placeholder="A reply" />
      ${langAdmSayHTML()}
      <input class="form-input lpv-opt-note" data-why value="${escapeHTML(o ? o.note || '' : '')}" placeholder="Why (optional)" />
      <button class="ag-icon-btn" type="button" onclick="langAdmRemoveRow(this, 2)" title="Remove">${langIcon('x')}</button>
    </div>`;
}

function langEncounterFormHTML(e, i, total) {
  const problems = langAdmEncProblems(e);
  const open = !!langAdmOpen[e.id];
  const opts = (e.options && e.options.length ? e.options : [{ text: '', correct: true }, { text: '', correct: false }]);
  return `
    <div class="lpv-qc lpv-enc lpv-tone-warning${open ? ' is-open' : ''}${problems.length ? ' has-problem' : ''}${e.id === langAdmNewId ? ' is-new' : ''}" data-eid="${e.id}" style="--k:${i}">
      <div class="lpv-q-head" onclick="langAdmToggleEnc('${e.id}')">
        <span class="lpv-q-num">${i + 1}</span>
        <span class="lpv-type"><i data-lucide="message-circle"></i></span>
        <span class="lpv-q-sum"><b>Encounter</b><span class="lpv-q-text">${escapeHTML(e.line || e.situation || 'Nothing said yet')}</span></span>
        <span class="lpv-q-status">${problems.length ? langIcon('alert-triangle') + ' ' + escapeHTML(problems[0]) : langIcon('check')}</span>
        <span class="lpv-q-tools" onclick="event.stopPropagation()">
          <button class="ag-icon-btn" type="button" onclick="langMoveEncounter('${e.id}', -1)" ${i === 0 ? 'disabled' : ''} title="Move up">${langIcon('chevron-up')}</button>
          <button class="ag-icon-btn" type="button" onclick="langMoveEncounter('${e.id}', 1)" ${i === total - 1 ? 'disabled' : ''} title="Move down">${langIcon('chevron-down')}</button>
          <button class="ag-icon-btn" type="button" onclick="langAdmDuplicateEnc('${e.id}')" title="Duplicate">${langIcon('copy')}</button>
          <button class="ag-icon-btn lpv-adm-danger" type="button" onclick="langRemoveEncounter('${e.id}')" title="Remove">${langIcon('trash-2')}</button>
        </span>
        <span class="lpv-q-caret">${langIcon('chevron-down')}</span>
      </div>
      <div class="lpv-q-body"><div class="lpv-q-inner">
        <div class="lpv-adm-grid2">
          <div class="lpv-adm-field">
            <label class="form-label">Situation <span class="af-label-hint">what is going on</span></label>
            <input class="form-input" data-f="situation" value="${escapeHTML(e.situation)}" placeholder="They cut in front of you in the queue" />
          </div>
          <div class="lpv-adm-field">
            <label class="form-label">What they say</label>
            <div class="lpv-say-wrap">
              <input class="form-input" data-f="line" value="${escapeHTML(e.line)}" placeholder="Kinsa ka?" />
              ${langAdmSayHTML()}
            </div>
          </div>
        </div>
        <div class="lpv-adm-field">
          <label class="form-label">Replies <span class="af-label-hint">tick the one that fits</span></label>
          <div class="lpv-opt-list">${opts.map(o => langAdmReplyRowHTML(e.id, o)).join('')}</div>
          <button class="lpv-adm-add" type="button" onclick="langAdmAddRow(this, '.lpv-opt-list', langAdmReplyRowHTML('${e.id}'), 4)">${langIcon('plus')} Add reply</button>
        </div>
        <div class="lpv-adm-nums">
          <div class="lpv-adm-field lpv-adm-num">
            <label class="form-label">${langIcon('swords')} Damage on a good reply</label>
            <input class="form-input" type="number" min="1" max="100" data-f="damage" value="${e.damage}" />
          </div>
          <div class="lpv-adm-field lpv-adm-num">
            <label class="form-label">${langIcon('zap')} Backlash on a bad one</label>
            <input class="form-input" type="number" min="0" max="100" data-f="backlash" value="${e.backlash}" />
          </div>
        </div>
      </div></div>
    </div>`;
}

function langAdmReadEnc(card, e) {
  const val = sel => { const el = card.querySelector(sel); return el ? el.value : undefined; };
  if (val('[data-f="situation"]') !== undefined) e.situation = val('[data-f="situation"]');
  if (val('[data-f="line"]') !== undefined) e.line = val('[data-f="line"]');
  if (val('[data-f="damage"]') !== undefined) e.damage = Math.max(0, parseInt(val('[data-f="damage"]'), 10) || 0);
  if (val('[data-f="backlash"]') !== undefined) e.backlash = Math.max(0, parseInt(val('[data-f="backlash"]'), 10) || 0);
  const rows = Array.from(card.querySelectorAll('.lpv-opt'));
  if (rows.length) {
    e.options = rows.map(r => ({
      text: r.querySelector('[data-reply]').value,
      note: r.querySelector('[data-why]').value,
      correct: r.querySelector('input[type="radio"]').checked
    }));
  }
  return e;
}

function langAdmEncLive(card) {
  if (!card || !langScenarioDraft) return;
  const base = (langScenarioDraft.encounters || []).find(x => x.id === card.dataset.eid);
  if (!base) return;
  const tmp = langAdmReadEnc(card, JSON.parse(JSON.stringify(base)));
  const problems = langAdmEncProblems(tmp);
  card.classList.toggle('has-problem', problems.length > 0);
  const text = card.querySelector('.lpv-q-text');
  if (text) text.textContent = tmp.line || tmp.situation || 'Nothing said yet';
  const status = card.querySelector('.lpv-q-status');
  if (status) status.innerHTML = problems.length ? langIcon('alert-triangle') + ' ' + escapeHTML(problems[0]) : langIcon('check');
}

function langAdmToggleEnc(id) {
  const card = document.querySelector('.lpv-enc[data-eid="' + id + '"]');
  if (!card) return;
  const open = !card.classList.contains('is-open');
  card.classList.toggle('is-open', open);
  langAdmOpen[id] = open;
}

function langAdmFoldAllEnc(open) {
  document.querySelectorAll('.lpv-enc').forEach(c => { c.classList.toggle('is-open', open); langAdmOpen[c.dataset.eid] = open; });
}

function langAdmNpcLive(input) {
  const chosen = document.getElementById('lang-sc-facekey');
  if (chosen && chosen.value) return;   // a picked face stays put
  const face = document.getElementById('lang-sc-face');
  if (face && typeof lpvFaceKey === 'function') face.className = 'lpv-adm-face lpv-face-' + lpvFaceKey(input.value);
  const pick = document.getElementById('lang-sc-facepick');
  if (pick) pick.innerHTML = langAdmFacePickHTML('', input.value);
}

/* ── Choosing who they look like ──────────────────────────────
   The portrait used to be whatever the name hashed to -- Ate Marites is
   always the same person, but you could not choose which. Clicking it
   opens the cast; "Auto" goes back to the name's choice. */

function langAdmFaceKeys() {
  return typeof LANG_PORTRAITS !== 'undefined' ? Object.keys(LANG_PORTRAITS).sort() : [];
}

function langAdmFaceName(key) {
  const k = String(key || '');
  return k.charAt(0).toUpperCase() + k.slice(1);
}

function langAdmFacePickHTML(current, npc) {
  const auto = typeof lpvFaceKey === 'function' ? lpvFaceKey(npc || '') : '';
  return `
    <div class="lpv-face-pick-head"><b>Who do they look like?</b>
      <button class="ag-icon-btn" type="button" onclick="langAdmToggleFacePick(false)" aria-label="Close">${langIcon('x')}</button>
    </div>
    <div class="lpv-face-grid">
      <button class="lpv-face-opt${!current ? ' is-on' : ''}" type="button" onclick="langAdmPickFace('')" title="Chosen from their name">
        <span class="lpv-face-img lpv-face-${escapeHTML(auto)}"></span><b>Auto</b><em>from the name</em>
      </button>
      ${langAdmFaceKeys().map(k => `
        <button class="lpv-face-opt${current === k ? ' is-on' : ''}" type="button" onclick="langAdmPickFace('${k}')">
          <span class="lpv-face-img lpv-face-${k}"></span><b>${escapeHTML(langAdmFaceName(k))}</b>
        </button>`).join('')}
    </div>`;
}

function langAdmToggleFacePick(open) {
  const pick = document.getElementById('lang-sc-facepick');
  const btn = document.querySelector('.lpv-adm-who-btn');
  if (!pick) return;
  const show = open == null ? pick.hidden : !!open;
  pick.hidden = !show;
  if (btn) btn.setAttribute('aria-expanded', show ? 'true' : 'false');
  document.removeEventListener('mousedown', langAdmFacePickOutside, true);
  if (show) {
    const on = pick.querySelector('.lpv-face-opt.is-on') || pick.querySelector('.lpv-face-opt');
    if (on) on.focus({ preventScroll: true });
    setTimeout(() => document.addEventListener('mousedown', langAdmFacePickOutside, true), 0);
  }
}

function langAdmFacePickOutside(e) {
  const who = document.querySelector('.lpv-adm-who');
  if (!who || !who.contains(e.target)) langAdmToggleFacePick(false);
}

function langAdmFacePickOpen() {
  const pick = document.getElementById('lang-sc-facepick');
  return !!(pick && !pick.hidden);
}

function langAdmPickFace(key) {
  const hidden = document.getElementById('lang-sc-facekey');
  if (hidden) hidden.value = key || '';
  const npc = document.getElementById('lang-sc-npc');
  const shown = key || (typeof lpvFaceKey === 'function' ? lpvFaceKey(npc ? npc.value : '') : '');
  const face = document.getElementById('lang-sc-face');
  if (face) {
    face.className = 'lpv-adm-face lpv-face-' + shown;
    face.classList.remove('is-swap'); void face.offsetWidth; face.classList.add('is-swap');
  }
  const pick = document.getElementById('lang-sc-facepick');
  if (pick) pick.innerHTML = langAdmFacePickHTML(key || '', npc ? npc.value : '');
  langAdmDirty = true;
  langAdmToggleFacePick(false);
  const btn = document.querySelector('.lpv-adm-who-btn');
  if (btn) btn.focus({ preventScroll: true });
}

function langAdmPickLoc(key) {
  const hidden = document.getElementById('lang-sc-loc');
  if (hidden) hidden.value = key;
  document.querySelectorAll('.lpv-loc').forEach(b => b.classList.toggle('is-on', b.dataset.loc === key));
  langAdmDirty = true;
}

function langCollectScenarioForm() {
  const s = langScenarioDraft;
  const ed = langAdmEditorFor('scenario', s);
  if (!ed) return;
  const g = id => ed.querySelector('#' + id);
  if (g('lang-sc-title')) s.title = g('lang-sc-title').value;
  if (g('lang-sc-loc')) s.location = g('lang-sc-loc').value;
  if (g('lang-sc-npc')) s.npc = g('lang-sc-npc').value;
  if (g('lang-sc-facekey')) s.face = g('lang-sc-facekey').value || '';
  if (g('lang-sc-hp')) s.playerHp = Math.max(20, parseInt(g('lang-sc-hp').value, 10) || 100);
  if (g('lang-sc-mp')) s.playerMana = Math.max(0, parseInt(g('lang-sc-mp').value, 10) || 0);
  if (g('lang-sc-nhp')) s.npcHp = Math.max(20, parseInt(g('lang-sc-nhp').value, 10) || 100);
  ed.querySelectorAll('.lpv-enc[data-eid]').forEach(card => {
    const e = (s.encounters || []).find(x => x.id === card.dataset.eid);
    if (e) langAdmReadEnc(card, e);
  });
}

function langAddEncounter() {
  langCollectScenarioForm();
  langScenarioDraft.encounters = langScenarioDraft.encounters || [];
  const e = langBlankEncounter();
  langScenarioDraft.encounters.push(e);
  langAdmOpen[e.id] = true;
  langAdmNewId = e.id;
  langAdmDirty = true;
  renderLangAdmin();
  langAdmScrollTo('.lpv-enc[data-eid="' + e.id + '"]');
}

function langRemoveEncounter(id) {
  langCollectScenarioForm();
  langScenarioDraft.encounters = (langScenarioDraft.encounters || []).filter(x => x.id !== id);
  langAdmDirty = true;
  renderLangAdmin();
}

function langMoveEncounter(id, dir) {
  langCollectScenarioForm();
  const list = langScenarioDraft.encounters || [];
  const i = list.findIndex(x => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  langAdmDirty = true;
  renderLangAdmin();
}

function langAdmDuplicateEnc(id) {
  langCollectScenarioForm();
  const list = langScenarioDraft.encounters || [];
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return;
  const copy = JSON.parse(JSON.stringify(list[i]));
  copy.id = generateId();
  list.splice(i + 1, 0, copy);
  langAdmOpen[copy.id] = true;
  langAdmNewId = copy.id;
  langAdmDirty = true;
  renderLangAdmin();
  langAdmScrollTo('.lpv-enc[data-eid="' + copy.id + '"]');
}

function langSaveScenarioDraft() {
  langCollectScenarioForm();
  if (!(langScenarioDraft.title || '').trim()) {
    const err = document.getElementById('lang-adm-err');
    if (err) { err.textContent = 'Give the scenario a title first.'; err.classList.remove('is-shake'); void err.offsetWidth; err.classList.add('is-shake'); }
    const t = document.getElementById('lang-sc-title');
    if (t) t.focus();
    return;
  }
  const saved = langSaveScenario(langScenarioDraft);
  const problems = langAdmScenarioProblems(langScenarioDraft);
  langAdmFlash = saved ? saved.id : '';
  langScenarioDraft = null;
  langAdmDirty = false;
  langAdmCopyOf = '';
  renderLangAdmin();
  if (typeof toast === 'function') {
    toast(problems.length ? `Saved — ${problems.length} thing${problems.length !== 1 ? 's' : ''} still to fix before it can be fought.` : 'Scenario saved.',
      { type: problems.length ? 'info' : 'success' });
  }
}

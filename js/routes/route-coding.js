/* ============================================================
   Route: coding — the Coding Library's landing page
   ------------------------------------------------------------
   The Coding Library is more than the programs now, so it opens on its
   sections, one tile each, the way the Library page opens on its libraries:

     Hackathon   the programs and practice sets (route `browse`, unchanged)
     Freeground  a blank editor and a terminal, saved in tabs

   Each tile carries live numbers read from the data on every visit (nothing
   is stored for it, so it can never disagree with the library) and a button
   for its most common action, so the extra page costs a click only when you
   wanted the tree: Continue goes straight back into the program you left.

   Training hub and the Codex get their tiles when they exist. A tile for a
   section that is not built yet would be a promise, not a door.

   Keys: 1 and 2 open the tiles.
   ============================================================ */

let _chubKey = null;

function codingHubTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll lib-hub chub">
        <div class="chub-top">
          <button onclick="spaNavigate('library')" class="btn-back-dark chub-back">
            <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Library
          </button>
          <button class="tutorial-trigger-btn chub-tour" onclick="GuidedTutorial.start()" title="Show Page Tour" aria-label="Show Page Tour">
            <i data-lucide="graduation-cap"></i>
          </button>
        </div>
        <section class="lib-hub-hero fade-in-up">
          <div class="lib-hub-hero-icon"><i data-lucide="code-2"></i></div>
          <h1 class="lib-hub-title">Coding Library</h1>
          <p class="lib-hub-subtitle">Solve programs, or write anything you like. Press a number to jump.</p>
        </section>
        <div class="lib-hub-grid stagger-children chub-grid" id="chub-grid"></div>
      </div>
    </div>`;
}

/** The program to go back to: an unfinished attempt first, else the last one tried. */
function chubLastProgram() {
  const live = (id) => (state.challenges || []).find(c => c.id === id);
  try {
    const d = (typeof practiceDraftList === 'function' ? practiceDraftList() : [])
      .find(x => x && x.challengeId && live(x.challengeId) && (x.files || []).some(f => String(f.userCode || '').trim()));
    if (d) return { id: d.challengeId, title: live(d.challengeId).title, resume: true };
  } catch (e) { /* no drafts */ }
  const h = (state.history || [])
    .filter(x => x && x.challengeId && !x.isArchived && live(x.challengeId))
    .sort((a, b) => (b.submitTime || b.startTime || 0) - (a.submitTime || a.startTime || 0))[0];
  return h ? { id: h.challengeId, title: live(h.challengeId).title, resume: false } : null;
}

function _chubHackathonTile() {
  const challenges = state.challenges || [];
  const sets = (state.codingSets || []).length;
  const done = typeof countCompletedPrograms === 'function' ? countCompletedPrograms() : 0;
  const pct = challenges.length ? Math.round((done / challenges.length) * 100) : 0;
  const due = typeof libDueCount === 'function' ? libDueCount('challenge', challenges) : 0;
  const last = chubLastProgram();
  const id = last ? String(last.id).replace(/[^\w-]/g, '') : '';
  let action = null;
  if (last && last.resume) {
    action = { icon: 'play', label: 'Continue', onclick: `homeResumeAttempt('coding','${id}')`, title: 'Back into ' + last.title };
  } else if (last) {
    action = { icon: 'folder-open', label: 'Open last', onclick: `browseOpenProgram('${id}'); spaNavigate('browse')`, title: 'Open ' + last.title };
  } else if (!challenges.length) {
    action = { icon: 'plus', label: 'Add a program', onclick: `spaNavigate('admin-coding')`, title: 'Write your first program, or load the starter pack from Hackathon' };
  }
  const chips = _libStatChip('file-code', countNoun(challenges.length, 'program'))
    + (sets ? _libStatChip('layout-grid', countNoun(sets, 'set')) : '')
    + (due ? `<span class="lib-stat-chip due"><i data-lucide="brain"></i> ${due} due</span>` : '')
    + (last ? _libStatChip('history', 'last: ' + escapeHTML(last.title)) : '');
  return libSpatialCardHTML({
    route: 'browse', cls: 'lib-card-coding', icon: 'swords', name: 'Hackathon', key: '1',
    desc: 'Your programs and practice sets: rebuild them from memory, run the tests, defeat the boss bar.',
    chips, pct: challenges.length ? pct : null, pctLabel: `${done}/${challenges.length} completed`, action
  });
}

function _chubFreegroundTile() {
  const open = typeof fgOpenTabs === 'function' ? fgOpenTabs() : [];
  const shelf = typeof fgShelfTabs === 'function' ? fgShelfTabs() : [];
  const active = typeof fgActiveTab === 'function' ? fgActiveTab() : null;
  const chips = (open.length || shelf.length)
    ? _libStatChip('file-code', `${open.length} open`) + (shelf.length ? _libStatChip('archive', `${shelf.length} on the shelf`) : '')
      + (active ? _libStatChip('history', 'last: ' + escapeHTML(active.name)) : '')
    : _libStatChip('sparkles', 'Nothing yet: your first one is a click away');
  return libSpatialCardHTML({
    route: 'freeground', onclick: `fgOpen({ back: 'coding' })`, cls: 'lib-card-freeground', icon: 'terminal', name: 'Freeground', key: '2',
    desc: 'A blank editor and a terminal. Write and run anything, saved in tabs you can switch between.',
    chips, pct: null, accent: '#22c55e',
    action: { icon: 'plus', label: 'New tab', onclick: `fgOpen({ newTab: {}, back: 'coding' })`, title: 'Open Freeground on a new tab' }
  });
}

const CHUB_TILES = [
  { key: '1', open: () => spaNavigate('browse') },
  { key: '2', open: () => fgOpen({ back: 'coding' }) }
];

function codingHubInit() {
  const grid = document.getElementById('chub-grid');
  if (grid) {
    grid.innerHTML = _chubHackathonTile() + _chubFreegroundTile();
    if (typeof libSpatialBind === 'function') libSpatialBind(grid);
  }
  _chubKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (typeof _shortcutInEditable === 'function' && _shortcutInEditable(e)) return;
    if (typeof _shortcutModalOpen === 'function' && _shortcutModalOpen()) return;
    const t = CHUB_TILES.find(x => x.key === e.key);
    if (!t) return;
    e.preventDefault();
    t.open();
  };
  document.addEventListener('keydown', _chubKey);
  if (typeof GuidedTutorial !== 'undefined') GuidedTutorial.init('coding');
}

function codingHubDestroy() {
  if (_chubKey) document.removeEventListener('keydown', _chubKey);
  _chubKey = null;
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
}

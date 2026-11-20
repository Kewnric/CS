/* ============================================================
   Route: freeground — a blank editor and a terminal, saved in tabs
   ------------------------------------------------------------
   No description, no tests, no boss bar, no timer: write C and run it. The
   tabs are separate saved programs (js/freeground.js); the editor is the
   attempt's own (editor.js, practice.js), so folding, brackets, find, the
   stack window, lint and Run Code all work here exactly as they do there.

   IT IS NOT AN ATTEMPT, and the attempt code it borrows must never think it
   is one. The editor runs on a stand-in program flagged `isFreeground`:
     - the attempt's draft writer refuses it (practice.js _practiceAutoSave),
       so nothing lands in the per-program drafts that sync to the cloud;
     - nothing here calls history, review, mistakes, quests or Finish;
     - the run budget does not count it (EDITOR_ROUTES.freeground.exam);
     - the attempt's state is put back on the way out.
   The file tabs, add/rename/delete and the menus are this screen's own,
   because the attempt's versions autosave a draft.

   THE SHELF. Save to shelf (the topbar button, Alt+S, the tab's menu) opens
   the picker (#fg-keep-pop): name, category, new category / subcategory.
   Closing a scratch that is not kept discards it, with an Undo; a kept one
   is put away. Ctrl+P lists open tabs, then the shelf as a tree of
   categories (fgShelfRows), folded open per device in ssp.fg.fold.

   SAVING. Typing writes the live buffer to ssp.fg.buffer (per storage mode)
   within 400 ms; the buffer goes into state.freeground on a tab switch, a
   run, closing, leaving, hiding the page and every 30 s. A buffer newer than
   its tab's save is applied on the next visit.
   ============================================================ */

const FG_BUFFER_KEY = 'ssp.fg.buffer';
const FG_REV_KEY = 'ssp.fg.rev';
const FG_COMMIT_MS = 30000;
const FG_BUFFER_MS = 400;

let _fg = null;

/** The live buffer's key; separate for the signed-in save, like the library's. */
function fgBufferKey() {
  return FG_BUFFER_KEY + (sessionStorage.getItem('storageMode') === 'online' ? '_online' : '');
}

/**
 * Go to Freeground, optionally with a new tab made from code.
 * @param {{newTab?: {name?: string, files?: Array<{name,ext,code}>, from?: string}, back?: string}} [opts]
 */
function fgOpen(opts) {
  const o = opts || {};
  if (_fg) fgCommit();
  if (o.newTab) {
    const t = fgNewTab(o.newTab);
    if (!t) return false;
    if (_fg) { fgActivate(t.id, { noCommit: true }); return true; }
  }
  if (_fg) return true;
  const here = (document.body && document.body.dataset.route) || '';
  setSessionParam('fgBack', o.back || here || 'coding');
  spaNavigate('freeground');
  return true;
}

/**
 * A program as a new Freeground tab: its starter code, or its answer once you
 * have passed it (programPassed). An unsolved program's answer is never shown.
 */
function fgOpenProgramCopy(challengeId) {
  const c = (state.challenges || []).find(x => x.id === challengeId);
  const v = c && (c.variants || [])[0];
  if (!c || !v) return;
  const passed = typeof programPassed === 'function' && programPassed(c.id);
  const src = (v.files && v.files.length) ? v.files : [{ name: 'main', ext: '.c', starterCode: v.starterCode, code: v.code }];
  const files = src.map(f => ({ name: f.name || 'main', ext: f.ext || '.c', code: String((passed ? (f.code || f.starterCode) : f.starterCode) || '') }));
  if (!files.some(f => f.code.trim())) files[0].code = fgDefaultStarter();
  if (!fgOpen({ newTab: { name: c.title, files, from: 'program:' + c.id }, back: 'browse' })) return;
  if (typeof toast === 'function') {
    toast(passed ? 'A copy of the reference answer (you have passed this one), to experiment on.' : 'A copy of the starter code. The answer stays hidden until you pass the program.',
      { type: 'info', duration: 3000 });
  }
}

/** The snippet Try Coding box's code as a new Freeground tab. */
function fgOpenTryCoding() {
  const ta = document.getElementById('try-coding-textarea');
  if (!ta) return;
  const title = ((document.getElementById('try-coding-title') || {}).textContent || '').trim();
  fgOpen({ newTab: { name: title || 'Snippet', files: [{ name: 'main', ext: '.c', code: ta.value }], from: 'snippet' } });
}

/** Freeground's code in a new program's form, as its answer. */
function fgSaveAsProgram(id) {
  const t = fgFindTab(id);
  if (!t) return;
  fgCommit();
  setSessionParam('adminPrefill', { kind: 'program', title: t.name, files: t.files.map(f => ({ name: f.name, ext: f.ext, code: f.code })) });
  spaNavigate('admin-coding');
}

/** The selection (or the open file) in a new snippet's form. */
function fgSaveAsSnippet(id) {
  const t = fgFindTab(id);
  if (!t) return;
  const ta = document.getElementById('editor-textarea');
  let code = '';
  if (_fg && id === fgStore().activeId && ta && ta.selectionEnd > ta.selectionStart) {
    code = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  } else {
    fgCommit();
    const f = t.files[t.activeFile || 0] || t.files[0];
    code = f ? f.code : '';
  }
  setSessionParam('adminPrefill', { kind: 'snippet', title: t.name, code });
  spaNavigate('admin-snippets');
}

/** The selection (or the open file) as a new template, to mark its slots. */
function fgSaveAsTemplate(id) {
  const t = fgFindTab(id);
  if (!t) return;
  const ta = document.getElementById('editor-textarea');
  let code = '';
  if (_fg && id === fgStore().activeId && ta && ta.selectionEnd > ta.selectionStart) code = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  else { fgCommit(); const f = t.files[t.activeFile || 0] || t.files[0]; code = f ? f.code : ''; }
  tplMakeFrom({ title: t.name, body: code, sourceType: 'freeground', sourceId: t.id });
}

/* ── The screen ────────────────────────────────────────────── */

function freegroundTemplate() {
  if (typeof trainStoreWritable === 'function' && !trainStoreWritable()) {
    return `
      <div class="fg-stale">
        <i data-lucide="refresh-cw"></i>
        <h1>Freeground needs a reload</h1>
        <p>The app was just updated and part of it is still the old version, which cannot save freegrounds. Reload the page to finish updating.</p>
        <div class="fg-stale-actions">
          <button class="btn btn-primary" onclick="location.reload()">Reload</button>
          <button class="btn btn-ghost" onclick="spaNavigate('coding')">Back</button>
        </div>
      </div>`;
  }
  return `
    <div class="practice-layout fg-layout" id="fg-layout" data-zen-key="fgZen">
      <div class="practice-topbar fg-topbar">
        <div class="practice-topbar-left">
          <button onclick="fgBack()" class="btn-back-dark" id="fg-back-btn">
            <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back
          </button>
          <span class="fg-title"><i data-lucide="terminal" aria-hidden="true"></i> Freeground</span>
        </div>
        <div class="fg-strip" id="fg-strip" role="tablist" aria-label="Freegrounds"></div>
        <div class="practice-topbar-right">
          <button class="btn btn-ghost practice-icon-btn" onclick="fgNewTabUI()" title="New freeground (Alt+N)" aria-label="New freeground">
            <i data-lucide="plus" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <button class="btn btn-ghost fg-keep-btn" id="fg-keep-btn" onclick="fgOpenKeepPicker(fgStore().activeId, this)" title="Save to shelf (Alt+S)" aria-label="Save to shelf">
            <i data-lucide="archive" aria-hidden="true"></i><span class="fg-keep-label">Save to shelf</span>
          </button>
          <button class="btn btn-ghost practice-icon-btn" id="fg-switch-btn" onclick="fgOpenSwitcher()" title="All freegrounds and the shelf (Ctrl+P)" aria-label="All freegrounds">
            <i data-lucide="layers" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          ${typeof feelButtonTemplate === 'function' ? feelButtonTemplate() : ''}
          ${typeof ostButtonTemplate === 'function' ? ostButtonTemplate() : ''}
          <span class="topbar-div" aria-hidden="true"></span>
          <button class="btn btn-ghost practice-icon-btn" onclick="toggleFullscreen()" title="Full screen" id="fullscreen-toggle-btn" aria-label="Full screen" aria-pressed="false">
            <i data-lucide="maximize" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <button class="btn btn-ghost practice-icon-btn" onclick="stkToggleMode()" title="Stickers (Alt+Shift+S)" aria-label="Stickers" aria-pressed="false" data-stk-toggle>
            <i data-lucide="sticker" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <span class="topbar-div" aria-hidden="true"></span>
          <button class="btn btn-primary practice-action-btn" id="fg-run-btn" onclick="fgRun()" title="Run (Ctrl+Enter)">
            <i data-lucide="play"></i> Run
          </button>
        </div>
      </div>
      <div class="fg-conflict" id="fg-conflict" role="status" hidden>
        <i data-lucide="alert-triangle" aria-hidden="true"></i>
        <span>This freeground was changed in another browser tab.</span>
        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Reload page</button>
        <button class="btn btn-ghost btn-sm" onclick="fgKeepMine()">Keep mine</button>
      </div>
      <div class="practice-body">
        <div class="practice-editor-area" style="display:flex; flex-direction:column;">
          <div class="editor-toolbar-row">
            <div class="file-tab-bar" id="practice-file-tabs"></div>
            ${editorToolbarTemplate()}
          </div>
          <div style="flex:1; position:relative; min-height:0; display:flex;">
            <div class="editor-line-numbers" id="editor-line-numbers"></div>
            <div style="flex:1; position:relative; min-height:0;">
              <pre id="editor-pre" class="editor-pre"><code id="editor-code"></code></pre>
              <textarea id="editor-textarea" spellcheck="false" class="editor-textarea" placeholder="// Write anything. Ctrl+Enter runs it."></textarea>
            </div>
          </div>
          ${runOutputStripTemplate()}
        </div>
      </div>
    </div>`;
}

function freegroundInit() {
  if (typeof trainStoreWritable === 'function' && !trainStoreWritable()) return;
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();

  const back = getSessionParam('fgBack');
  clearSessionParam('fgBack');
  const prevRoute = String(window.cm_prevRoute || '').split('?')[0];
  _fg = {
    back: back || (prevRoute && prevRoute !== 'freeground' ? prevRoute : 'coding'),
    prev: { challenge: state.activeChallenge, variant: state.activeVariant, files: state.userFiles, idx: state.activeFileIndex },
    page: generateId(),
    dirty: new Set(),
    timer: 0, bufTimer: 0
  };
  if (typeof mistakeResetAttempt === 'function') mistakeResetAttempt();

  _fgApplyBuffer();
  let id = (fgActiveTab() || {}).id;
  if (!id) { const first = fgOpenTabs()[0]; id = first ? first.id : null; }
  if (!id) { const t = fgNewTab({}); id = t && t.id; }
  if (!id) return;

  const strip = document.getElementById('fg-strip');
  if (strip) {
    strip.addEventListener('click', _fgStripClick);
    strip.addEventListener('dblclick', _fgStripDbl);
    strip.addEventListener('contextmenu', _fgStripMenu);
    strip.addEventListener('keydown', _fgStripKey);
  }
  const ta = document.getElementById('editor-textarea');
  if (ta) {
    ta.addEventListener('input', _fgOnInput);
    ta.addEventListener('paste', _fgOnPaste);
  }

  fgActivate(id, { noCommit: true });
  const peek = document.getElementById('ed-peek-btn');
  if (peek) peek.style.display = 'none';

  if (typeof applyEditorViewSettings === 'function') applyEditorViewSettings();
  const layout = document.getElementById('fg-layout');
  if (typeof zdockConfigure === 'function') {
    zdockConfigure(layout, { run: fgRun, check: false, finish: false, timerId: false, hp: false, runTitle: 'Run (Ctrl+Enter)' });
  }
  if (typeof initZenState === 'function') initZenState();
  if (typeof _syncFullscreenBtn === 'function') _syncFullscreenBtn();
  if (typeof ostMount === 'function') ostMount();

  _fg.onKey = _fgKeydown;
  _fg.onStorage = _fgOnStorage;
  _fg.onHide = () => { try { fgCommit(); } catch (e) { /* leaving anyway */ } };
  _fg.onVis = () => { if (document.visibilityState === 'hidden') _fg.onHide(); };
  document.addEventListener('keydown', _fg.onKey);
  window.addEventListener('storage', _fg.onStorage);
  window.addEventListener('pagehide', _fg.onHide);
  document.addEventListener('visibilitychange', _fg.onVis);
  _fg.timer = setInterval(() => fgCommit(), FG_COMMIT_MS);

  if (ta) { ta.focus(); _fgCaretToStarter(ta); }
}

function freegroundDestroy() {
  if (!_fg) return;
  try { fgCommit(); } catch (e) { console.error('[Freeground] Save on exit failed:', e); }
  const f = _fg;
  document.removeEventListener('keydown', f.onKey);
  window.removeEventListener('storage', f.onStorage);
  window.removeEventListener('pagehide', f.onHide);
  document.removeEventListener('visibilitychange', f.onVis);
  clearInterval(f.timer);
  clearTimeout(f.bufTimer);
  _fgCloseMenu();
  fgCloseKeepPicker();
  fgCloseSwitcher();
  if (typeof zdockUnmount === 'function') zdockUnmount();
  if (typeof _termClose === 'function') _termClose();
  if (typeof skDestroy === 'function') skDestroy();
  if (typeof edCloseFind === 'function') edCloseFind();
  if (typeof ostStop === 'function') ostStop();
  if (typeof mistakeResetAttempt === 'function') mistakeResetAttempt();
  // The attempt's state, as it was before Freeground borrowed the editor.
  state.activeChallenge = f.prev.challenge;
  state.activeVariant = f.prev.variant;
  state.userFiles = f.prev.files;
  state.activeFileIndex = f.prev.idx;
  _fg = null;
}

function fgBack() {
  const back = _fg ? _fg.back : 'coding';
  fgCommit();
  spaNavigate(back && back !== 'freeground' ? back : 'coding');
}

/* ── One tab in the editor ─────────────────────────────────── */

/** The stand-in program the attempt's editor code runs on. */
function fgSyntheticChallenge(tab) {
  return {
    id: 'fg:' + tab.id, isFreeground: true, title: tab.name, tags: [],
    variants: [{ id: 'fg', name: '', description: '', starterCode: '', code: '',
      files: [], tests: [], samples: [], minRequirements: [], hints: [] }]
  };
}

/** Show tab `id` in the editor, saving the one that was there first. */
function fgActivate(id, opts) {
  if (!_fg) return;
  const o = opts || {};
  if (!o.noCommit) fgCommit();
  const t = fgFindTab(id);
  if (!t) return;
  if (t.shelved) t.shelved = false;
  fgStore().activeId = id;
  if (typeof _termClose === 'function' && document.getElementById('run-code-overlay')) _termClose();
  state.activeChallenge = fgSyntheticChallenge(t);
  state.activeVariant = state.activeChallenge.variants[0];
  state.userFiles = t.files.map(f => ({ id: f.id, name: f.name, ext: f.ext, starterCode: '', code: '', userCode: String(f.code || '') }));
  if (!state.userFiles.length) state.userFiles = [{ id: generateId(), name: 'main', ext: '.c', starterCode: '', code: '', userCode: '' }];
  state.activeFileIndex = Math.min(Math.max(t.activeFile || 0, 0), state.userFiles.length - 1);
  fgRenderStrip();
  fgRenderFileTabs();
  // `restored`: the editor still holds the previous tab's text, which must not
  // be saved into this one.
  loadPracticeFile(state.activeFileIndex, { restored: true });
  _fgShowLastRun(t);
}

/**
 * Write what is in the editor into the active tab and save.
 * @param {boolean} [force] save and announce even when nothing changed
 */
function fgCommit(force) {
  if (!_fg) return;
  const t = fgActiveTab();
  if (!t || !state.activeChallenge || state.activeChallenge.id !== 'fg:' + t.id || !state.userFiles) return;
  if (typeof savePracticeFileCode === 'function') savePracticeFileCode();
  const files = state.userFiles.map(f => ({ id: f.id, name: f.name, ext: f.ext, code: String(f.userCode || '') }));
  let changed = JSON.stringify(files) !== JSON.stringify(t.files) || (t.activeFile || 0) !== (state.activeFileIndex || 0);
  if (changed) { t.files = files; t.activeFile = state.activeFileIndex || 0; }
  const run = _fgLastRunText();
  if (run !== null && run !== (t.lastRun || '')) { t.lastRun = run; changed = true; }
  _fgClearBuffer();
  if (!changed && !force) return;
  t.updatedAt = Date.now();
  if (typeof saveData === 'function') saveData();
  try { localStorage.setItem(FG_REV_KEY, JSON.stringify({ tab: t.id, at: t.updatedAt, page: _fg.page, who: _fgWho() })); } catch (e) { /* full */ }
}

function fgKeepMine() {
  fgCommit(true);
  const bar = document.getElementById('fg-conflict');
  if (bar) bar.hidden = true;
}

/** Run the active tab, the way Run Code does in an attempt. */
function fgRun() {
  if (!_fg) return;
  const t = fgActiveTab();
  if (t) { _fg.dirty.delete(t.id); fgRenderStrip(); }
  fgCommit();
  const out = document.getElementById('editor-output-body');
  if (out) out.classList.remove('fg-plain');
  if (typeof runCodeWithPiston === 'function') runCodeWithPiston();
}

/* ── Live buffer ───────────────────────────────────────────── */

function _fgOnInput() {
  if (!_fg) return;
  const t = fgActiveTab();
  if (t && !_fg.dirty.has(t.id)) { _fg.dirty.add(t.id); fgRenderStrip(); }
  clearTimeout(_fg.bufTimer);
  _fg.bufTimer = setTimeout(_fgWriteBuffer, FG_BUFFER_MS);
}

/* A paste that would take this freeground past its size is refused whole,
   rather than landing and then being impossible to save. */
function _fgOnPaste(e) {
  const t = fgActiveTab();
  const ta = e.target;
  const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
  if (!t || !ta) return;
  if (typeof savePracticeFileCode === 'function') savePracticeFileCode();
  const now = (state.userFiles || []).reduce((n, f) => n + String(f.userCode || '').length, 0);
  const sel = Math.abs((ta.selectionEnd || 0) - (ta.selectionStart || 0));
  if (now - sel + text.length > FG_LIMITS.chars) {
    e.preventDefault();
    if (typeof toast === 'function') {
      toast('Too much to paste: one freeground holds ' + FG_LIMITS.chars.toLocaleString() + ' characters.', { type: 'warning', duration: 3600 });
    }
  }
}

function _fgWriteBuffer() {
  if (!_fg) return;
  const t = fgActiveTab();
  if (!t || !state.userFiles) return;
  if (typeof savePracticeFileCode === 'function') savePracticeFileCode();
  try {
    localStorage.setItem(fgBufferKey(), JSON.stringify({
      tabId: t.id, savedAt: Date.now(), activeFile: state.activeFileIndex || 0,
      files: state.userFiles.map(f => ({ id: f.id, name: f.name, ext: f.ext, code: String(f.userCode || '') }))
    }));
  } catch (e) { /* storage full: the 30 s save still runs */ }
}

function _fgClearBuffer() {
  if (_fg) clearTimeout(_fg.bufTimer);
  try { localStorage.removeItem(fgBufferKey()); } catch (e) { /* none */ }
}

/** A buffer left by a closed tab or a crash, newer than its freeground's save. */
function _fgApplyBuffer() {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(fgBufferKey()) || 'null'); } catch (e) { b = null; }
  if (b && b.tabId && Array.isArray(b.files)) {
    const t = fgFindTab(b.tabId);
    if (t && (b.savedAt || 0) > (t.updatedAt || 0)) {
      t.files = b.files.map(f => ({ id: f.id || generateId(), name: String(f.name || 'main'), ext: f.ext || '.c', code: String(f.code || '') }));
      t.activeFile = b.activeFile || 0;
      t.updatedAt = b.savedAt;
      if (typeof saveData === 'function') saveData();
    }
  }
  try { localStorage.removeItem(fgBufferKey()); } catch (e) { /* none */ }
}

/** The profile this tab is in (profile-keys.js), so another profile's tab is not taken for this one's. */
function _fgWho() { return typeof profileCurrentId === 'function' ? profileCurrentId() : ''; }

function _fgOnStorage(e) {
  if (!_fg || e.key !== FG_REV_KEY || !e.newValue) return;
  let v = null;
  try { v = JSON.parse(e.newValue); } catch (err) { return; }
  const t = fgActiveTab();
  if (!v || v.page === _fg.page || !t || v.tab !== t.id) return;
  // A tab of another profile edited ITS Freeground (a backup brought into both shares the ids): not this one.
  if (typeof v.who === 'string' && v.who !== _fgWho()) return;
  const bar = document.getElementById('fg-conflict');
  if (bar) bar.hidden = false;
}

/* ── Last run ──────────────────────────────────────────────── */

function _fgLastRunText() {
  const strip = document.getElementById('editor-output-body');
  if (!strip) return null;
  const lines = (strip.innerText || strip.textContent || '').replace(/\s+$/, '').split('\n');
  return lines.slice(-FG_LIMITS.lastRunLines).join('\n');
}

function _fgShowLastRun(t) {
  if (typeof clearRunOutput === 'function') clearRunOutput();
  const strip = document.getElementById('editor-output-body');
  const wrap = document.getElementById('editor-output');
  if (!strip || !t || !t.lastRun) return;
  strip.textContent = t.lastRun;
  strip.classList.add('fg-plain');
  if (wrap) wrap.classList.add('has-output');
}

/* ── The strip of freegrounds ──────────────────────────────── */

function fgRenderStrip() {
  const host = document.getElementById('fg-strip');
  if (!host || !_fg) return;
  const active = fgStore().activeId;
  host.innerHTML = fgOpenTabs().map((t, i) => {
    const on = t.id === active;
    const name = escapeHTML(t.name);
    return `
      <div class="fg-tab${on ? ' is-active' : ''}${t.pinned ? ' is-pinned' : ''}${_fg.dirty.has(t.id) ? ' is-dirty' : ''}"
           role="tab" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-fg-tab="${t.id}"
           title="${name}${i < 9 ? ' (Alt+' + (i + 1) + ')' : ''} — double-click to rename, right-click for more">
        ${t.pinned ? '<i data-lucide="pin" class="fg-tab-pin" aria-hidden="true"></i>' : ''}
        ${t.kept ? '<i data-lucide="archive" class="fg-tab-kept" aria-hidden="true"></i>' : ''}
        <span class="fg-tab-name">${name}</span>
        <span class="fg-tab-dot" aria-hidden="true" title="Changed since the last run"></span>
        ${t.pinned ? '' : `<button type="button" class="fg-tab-x" data-fg-close="${t.id}" tabindex="-1"
                title="${t.kept ? 'Close (Alt+W). It stays on the shelf.' : 'Close (Alt+W). Not on the shelf, so it is discarded (Undo for a few seconds).'}" aria-label="Close ${name}"><i data-lucide="x"></i></button>`}
      </div>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  const cur = host.querySelector('.fg-tab.is-active');
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  _fgPaintKeepBtn();
}

/** The Save to shelf button says whether the open tab is kept, and where. */
function _fgPaintKeepBtn() {
  const b = document.getElementById('fg-keep-btn');
  if (!b) return;
  const t = fgActiveTab();
  const kept = !!(t && t.kept);
  b.classList.toggle('is-kept', kept);
  b.title = kept
    ? 'On the shelf, in ' + (fgCatLabel(t.catId) || 'no category') + '. Click to move it, rename it or take it off (Alt+S).'
    : 'Save to shelf (Alt+S). A scratch that is not on the shelf is discarded when you close it.';
  b.setAttribute('aria-label', kept ? 'On the shelf: move, rename or take off' : 'Save to shelf');
  const label = b.querySelector('.fg-keep-label');
  if (label) label.textContent = kept ? 'On the shelf' : 'Save to shelf';
}

/**
 * After an Undo or anything else that changed the tabs from outside.
 * @param {string|null} [activateId] a tab that came back and should be shown
 */
function fgOnStoreChanged(activateId) {
  if (!_fg) return;
  if (activateId && fgFindTab(activateId)) {
    fgActivate(activateId);
    const ta = document.getElementById('editor-textarea');
    if (ta && !document.getElementById('fg-switcher')) ta.focus();
  } else {
    if (!fgActiveTab()) { const first = fgOpenTabs()[0]; if (first) fgActivate(first.id, { noCommit: true }); }
    fgRenderStrip();
  }
  if (document.getElementById('fg-switcher')) _fgRenderSwitcher();
}

function fgSwitchTo(id) {
  if (!_fg || id === fgStore().activeId) return;
  fgActivate(id);
  const ta = document.getElementById('editor-textarea');
  if (ta) { ta.focus(); _fgCaretToStarter(ta); }
}

function fgCycle(step) {
  const open = fgOpenTabs();
  const i = open.findIndex(t => t.id === fgStore().activeId);
  if (open.length < 2) return;
  fgSwitchTo(open[(i + step + open.length) % open.length].id);
}

function fgNewTabUI() {
  if (!_fg) return;
  fgCommit();
  const t = fgNewTab({});
  if (!t) return;
  fgActivate(t.id, { noCommit: true });
  const ta = document.getElementById('editor-textarea');
  if (ta) { ta.focus(); _fgCaretToStarter(ta); }
}

/** On an untouched starter, put the caret inside main's body, on the indented empty line. */
function _fgCaretToStarter(ta) {
  if (!ta || ta.value !== fgDefaultStarter()) return;
  const at = fgStarterCaret(ta.value);
  if (at !== -1) ta.setSelectionRange(at, at);
}

function fgCloseTabUI(id) {
  if (!_fg) return;
  const t = fgFindTab(id);
  if (!t) return;
  fgCommit();
  _fg.dirty.delete(id);
  const wasActive = fgStore().activeId === id;
  const kept = !!t.kept;
  // A discard shows its own Undo toast (fgCloseTab → pushUndo).
  const next = fgCloseTab(id);
  if (wasActive && next) {
    fgActivate(next, { noCommit: true });
    const ta = document.getElementById('editor-textarea');
    if (ta) { ta.focus(); _fgCaretToStarter(ta); }
  } else fgRenderStrip();
  if (kept && typeof toast === 'function') toast('"' + t.name + '" is on the shelf. Ctrl+P finds it.', { type: 'info', duration: 2200 });
}

function _fgStripClick(e) {
  const x = e.target.closest('[data-fg-close]');
  if (x) { e.stopPropagation(); fgCloseTabUI(x.getAttribute('data-fg-close')); return; }
  const tab = e.target.closest('[data-fg-tab]');
  if (tab && !e.target.closest('.fg-rename-input')) fgSwitchTo(tab.getAttribute('data-fg-tab'));
}

function _fgStripDbl(e) {
  const tab = e.target.closest('[data-fg-tab]');
  if (tab && !e.target.closest('[data-fg-close]')) fgStartRename(tab.getAttribute('data-fg-tab'));
}

function _fgStripMenu(e) {
  const tab = e.target.closest('[data-fg-tab]');
  if (!tab) return;
  e.preventDefault();
  fgTabMenu(tab.getAttribute('data-fg-tab'), tab);
}

/* Arrow keys move along the strip and switch as they go (the tablist
   pattern); the context-menu key opens the tab's menu. */
function _fgStripKey(e) {
  const tab = e.target.closest('[data-fg-tab]');
  if (!tab || e.target.closest('.fg-rename-input')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    fgCycle(e.key === 'ArrowRight' ? 1 : -1);
    const cur = document.querySelector('#fg-strip .fg-tab.is-active');
    if (cur) cur.focus();
  } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
    e.preventDefault();
    fgTabMenu(tab.getAttribute('data-fg-tab'), tab);
  }
}

/** Rename in place: the tab's name becomes a field. Enter keeps, Esc cancels. */
function fgStartRename(id) {
  const tab = document.querySelector('#fg-strip [data-fg-tab="' + id + '"]');
  const t = fgFindTab(id);
  if (!tab || !t) return;
  const label = tab.querySelector('.fg-tab-name');
  if (!label || tab.querySelector('.fg-rename-input')) return;
  const input = document.createElement('input');
  input.className = 'fg-rename-input';
  input.value = t.name;
  input.maxLength = FG_LIMITS.nameMax;
  input.setAttribute('aria-label', 'Freeground name');
  label.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    if (keep && !fgRenameTab(id, input.value) && typeof toast === 'function') {
      toast('A freeground needs a name.', { type: 'warning', duration: 2000 });
    }
    fgRenderStrip();
    const ta = document.getElementById('editor-textarea');
    if (ta) ta.focus();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

/* ── The tab's menu ────────────────────────────────────────── */

function _fgCloseMenu() {
  const el = document.getElementById('fg-tab-menu');
  if (el) el.remove();
  document.removeEventListener('mousedown', _fgMenuOutside, true);
  document.removeEventListener('keydown', _fgMenuKey, true);
}

function _fgMenuOutside(e) {
  const el = document.getElementById('fg-tab-menu');
  if (el && !el.contains(e.target)) _fgCloseMenu();
}

function _fgMenuKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); _fgCloseMenu(); }
}

/**
 * A small menu under `anchor` (one at a time, #fg-tab-menu).
 * @param {string} title
 * @param {Array<[string, string, string, string, string?]>} items  [act, icon, text, hint, extra class]
 * @param {Element} anchor
 * @param {function(string)} onAct
 */
function _fgShowMenu(title, items, anchor, onAct) {
  _fgCloseMenu();
  const el = document.createElement('div');
  el.id = 'fg-tab-menu';
  el.className = 'file-menu fg-tab-menu';
  el.setAttribute('role', 'menu');
  el.innerHTML = '<div class="file-menu-title">' + escapeHTML(title) + '</div>' + items.map(([act, icon, text, hint, cls]) =>
    '<button type="button" role="menuitem" class="file-menu-item' + (cls ? ' ' + cls : '') + '" data-act="' + act + '">'
    + '<i data-lucide="' + icon + '"></i><span><strong>' + escapeHTML(text) + '</strong>'
    + (hint ? '<em>' + escapeHTML(hint) + '</em>' : '') + '</span></button>').join('');
  document.body.appendChild(el);
  const r = (anchor || document.body).getBoundingClientRect();
  const top = r.bottom + 4;
  el.style.top = Math.max(6, top + el.offsetHeight > window.innerHeight - 6 ? r.top - el.offsetHeight - 4 : top) + 'px';
  el.style.left = Math.max(6, Math.min(r.left, window.innerWidth - el.offsetWidth - 6)) + 'px';
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('.file-menu-item');
    if (!b) return;
    _fgCloseMenu();
    onAct(b.getAttribute('data-act'));
  });
  document.addEventListener('mousedown', _fgMenuOutside, true);
  document.addEventListener('keydown', _fgMenuKey, true);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  const first = el.querySelector('.file-menu-item');
  if (first) first.focus();
}

function fgTabMenu(id, anchor) {
  const t = fgFindTab(id);
  if (!t) return;
  if (document.getElementById('fg-tab-menu')) { _fgCloseMenu(); return; }
  fgCommit();
  const file = (t.files[t.activeFile || 0] || t.files[0] || { name: 'main', ext: '.c' });
  const items = [
    ['rename', 'pencil', 'Rename…', 'F2'],
    ['duplicate', 'copy-plus', 'Duplicate', ''],
    ['pin', t.pinned ? 'pin-off' : 'pin', t.pinned ? 'Unpin' : 'Pin', 'Pinned tabs stay first and are not closed by Close others.'],
    t.kept ? ['keep', 'archive', 'Move or rename on the shelf…', 'In ' + (fgCatLabel(t.catId) || 'no category') + '. Alt+S']
      : ['keep', 'archive', 'Save to shelf…', 'Alt+S. Then closing it puts it away instead of discarding it.']
  ];
  if (t.kept) items.push(['unkeep', 'archive', 'Remove from shelf', 'It stays open; closing it then discards it.']);
  items.push(
    ['close', 'x', 'Close', t.kept ? 'Alt+W. It stays on the shelf.' : 'Alt+W. Not on the shelf, so it is discarded (with Undo).'],
    ['others', 'x-square', 'Close others', 'Ones on the shelf are put away; the rest are discarded.'],
    ['copy', 'clipboard-copy', 'Copy ' + file.name + file.ext, ''],
    ['download', 'download', 'Download ' + file.name + file.ext, '']
  );
  if (typeof fgSaveAsSnippet === 'function') items.push(['snippet', 'code', 'Save as snippet…', 'The selection, or the whole file.']);
  if (typeof fgSaveAsProgram === 'function') items.push(['program', 'file-code', 'Save as program…', 'Opens the program form with this code as the answer.']);
  if (typeof tplMakeFrom === 'function') items.push(['template', 'puzzle', 'Save as template…', 'The selection, or the whole file; mark the names that change.']);
  _fgShowMenu(t.name, items, anchor, (act) => _fgMenuAct(act, id, anchor));
}

function _fgMenuAct(act, id, anchor) {
  const t = fgFindTab(id);
  if (!t) return;
  if (act === 'rename') fgStartRename(id);
  else if (act === 'duplicate') { const d = fgDuplicateTab(id); if (d) fgActivate(d.id, { noCommit: true }); }
  else if (act === 'pin') { fgPinTab(id, !t.pinned); fgRenderStrip(); }
  else if (act === 'keep') fgOpenKeepPicker(id, anchor && anchor.isConnected ? anchor : document.getElementById('fg-keep-btn'));
  else if (act === 'unkeep') _fgUnkeepUI(id);
  else if (act === 'close') fgCloseTabUI(id);
  else if (act === 'others') { fgCloseOthers(id); fgActivate(id, { noCommit: true }); }
  else if (act === 'copy' || act === 'download') {
    if (id !== fgStore().activeId) fgActivate(id);
    const f = (state.userFiles || [])[state.activeFileIndex || 0];
    if (!f) return;
    if (act === 'copy') {
      const done = () => { if (typeof toast === 'function') toast('Copied ' + f.name + f.ext, { type: 'success', duration: 1600 }); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(f.userCode || '').then(done).catch(() => {});
    } else {
      const blob = new Blob([f.userCode || ''], { type: 'text/x-c' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (f.name || 'main') + (f.ext || '.c');
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    }
  } else if (act === 'snippet' && typeof fgSaveAsSnippet === 'function') fgSaveAsSnippet(id);
  else if (act === 'program' && typeof fgSaveAsProgram === 'function') fgSaveAsProgram(id);
  else if (act === 'template' && typeof tplMakeFrom === 'function') fgSaveAsTemplate(id);
}

/* ── Save to shelf: the picker ─────────────────────────────── */

/** Back to where the keyboard was: the switcher's search if it is open, else the code. */
function _fgFocusBack() {
  const q = document.getElementById('fg-sw-q');
  const el = q || document.getElementById('editor-textarea');
  if (el) el.focus();
}

/**
 * Turn `holder` into a name field. Enter or leaving the field keeps the text,
 * Esc gives null. `done` re-renders, which removes the field.
 */
function _fgInlineName(holder, current, done, label) {
  if (!holder) return;
  const input = document.createElement('input');
  input.className = 'fg-rename-input fg-name-input';
  input.value = current;
  input.maxLength = FG_LIMITS.nameMax;
  input.setAttribute('aria-label', label || 'Category name');
  holder.replaceWith(input);
  input.focus();
  input.select();
  let over = false;
  const finish = (keep) => { if (over) return; over = true; done(keep ? input.value : null); };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

function fgCloseKeepPicker() {
  const el = document.getElementById('fg-keep-pop');
  if (el) el.remove();
  document.removeEventListener('mousedown', _fgPickOutside, true);
  if (_fg) _fg.pick = null;
}

function _fgPickOutside(e) {
  const el = document.getElementById('fg-keep-pop');
  if (!el || el.contains(e.target)) return;
  // The Save button toggles it; its own click closes it.
  if (e.target.closest && e.target.closest('#fg-keep-btn')) return;
  fgCloseKeepPicker();
}

/**
 * Save a tab to the shelf, or move / rename / take off one already there.
 * @param {string} tabId
 * @param {Element} [anchor] what it opens under
 */
function fgOpenKeepPicker(tabId, anchor) {
  if (!_fg) return;
  if (document.getElementById('fg-keep-pop')) { fgCloseKeepPicker(); _fgFocusBack(); return; }
  const t = fgFindTab(tabId);
  if (!t) return;
  _fgCloseMenu();
  fgCommit();
  const start = t.kept ? t.catId : _fg.lastCat;
  _fg.pick = { tabId, catId: fgFindCat(start) ? start : null };
  const el = document.createElement('div');
  el.id = 'fg-keep-pop';
  el.className = 'file-menu fg-keep-pop';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', t.kept ? 'On the shelf' : 'Save to shelf');
  el.innerHTML = `
    <div class="file-menu-title">${t.kept ? 'On the shelf' : 'Save to shelf'}</div>
    <label class="fg-kp-field"><span>Name</span>
      <input id="fg-kp-name" class="fg-kp-input" maxlength="${FG_LIMITS.nameMax}" value="${escapeHTML(t.name)}" spellcheck="false" autocomplete="off"></label>
    <div class="fg-kp-label">Category</div>
    <div class="fg-kp-cats" id="fg-kp-cats" role="listbox" aria-label="Category"></div>
    <div class="fg-kp-new">
      <button type="button" class="btn btn-ghost btn-sm" data-kp="newcat" title="A new category at the top"><i data-lucide="folder-plus"></i> New category</button>
      <button type="button" class="btn btn-ghost btn-sm" data-kp="newsub" title="A new category inside the chosen one"><i data-lucide="folder-plus"></i> New subcategory</button>
    </div>
    <div class="fg-kp-actions">
      ${t.kept ? '<button type="button" class="btn btn-ghost btn-sm fg-kp-remove" data-kp="remove" title="It stays open; closing it then discards it">Remove from shelf</button>' : ''}
      <span class="fg-kp-gap"></span>
      <button type="button" class="btn btn-ghost btn-sm" data-kp="cancel">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm" data-kp="save"><i data-lucide="archive"></i> ${t.kept ? 'Save' : 'Save to shelf'}</button>
    </div>`;
  document.body.appendChild(el);
  _fgRenderPickCats();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  const r = (anchor || document.getElementById('fg-keep-btn') || document.body).getBoundingClientRect();
  const below = r.bottom + 6;
  el.style.top = Math.max(6, below + el.offsetHeight > window.innerHeight - 6 ? window.innerHeight - el.offsetHeight - 6 : below) + 'px';
  el.style.left = Math.max(6, Math.min(r.right - el.offsetWidth, window.innerWidth - el.offsetWidth - 6)) + 'px';
  el.addEventListener('click', _fgPickClick);
  el.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-kp-cat]') && !e.target.closest('.fg-name-input')) _fgPickSave();
  });
  el.addEventListener('keydown', _fgPickKey);
  document.addEventListener('mousedown', _fgPickOutside, true);
  const name = el.querySelector('#fg-kp-name');
  if (name) { name.focus(); name.select(); }
}

function _fgRenderPickCats() {
  const box = document.getElementById('fg-kp-cats');
  if (!box || !_fg || !_fg.pick) return;
  const every = new Set(fgCats().map(c => c.id));
  const rows = [{ id: null, name: 'No category', depth: 0 }].concat(fgShelfRows(every, '')
    .filter(r => r.kind === 'cat').map(r => ({ id: r.cat.id, name: r.cat.name, depth: r.depth })));
  box.innerHTML = rows.map(r => {
    const sel = r.id === _fg.pick.catId;
    return `<div class="fg-kp-cat${sel ? ' is-sel' : ''}${r.id ? '' : ' is-none'}" role="option" aria-selected="${sel}"
      data-kp-cat="${r.id || ''}" style="--fg-depth:${r.depth}"><i data-lucide="${r.id ? 'folder' : 'minus'}" aria-hidden="true"></i><span class="fg-kp-name">${escapeHTML(r.name)}</span></div>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: box });
  const sel = box.querySelector('.fg-kp-cat.is-sel');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  const sub = document.querySelector('#fg-keep-pop [data-kp="newsub"]');
  if (sub) sub.disabled = !_fg.pick.catId || fgCatPath(_fg.pick.catId).length >= FG_LIMITS.catDepth;
}

function _fgPickClick(e) {
  if (!_fg || !_fg.pick || e.target.closest('.fg-name-input')) return;
  const cat = e.target.closest('[data-kp-cat]');
  if (cat) { _fg.pick.catId = cat.getAttribute('data-kp-cat') || null; _fgRenderPickCats(); return; }
  const b = e.target.closest('[data-kp]');
  if (!b) return;
  const act = b.getAttribute('data-kp');
  if (act === 'save') _fgPickSave();
  else if (act === 'cancel') { fgCloseKeepPicker(); _fgFocusBack(); }
  else if (act === 'remove') { const id = _fg.pick.tabId; fgCloseKeepPicker(); _fgUnkeepUI(id); _fgFocusBack(); }
  else if (act === 'newcat' || act === 'newsub') {
    const c = fgNewCat('New category', act === 'newsub' ? _fg.pick.catId : null);
    if (!c) return;
    _fg.pick.catId = c.id;
    _fgRenderPickCats();
    _fgInlineName(document.querySelector('#fg-kp-cats [data-kp-cat="' + c.id + '"] .fg-kp-name'), c.name, (name) => {
      if (name) fgRenameCat(c.id, name);
      _fgRenderPickCats();
      if (document.getElementById('fg-switcher')) _fgRenderSwitcher();
      const n = document.getElementById('fg-kp-name');
      if (n) n.focus();
    });
  }
}

function _fgPickKey(e) {
  if (!_fg || !_fg.pick || (e.target.closest && e.target.closest('.fg-name-input'))) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fgCloseKeepPicker(); _fgFocusBack(); return; }
  if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); e.stopPropagation(); _fgPickSave(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    const ids = Array.from(document.querySelectorAll('#fg-kp-cats [data-kp-cat]')).map(x => x.getAttribute('data-kp-cat') || null);
    const i = ids.indexOf(_fg.pick.catId);
    _fg.pick.catId = ids[Math.max(0, Math.min(ids.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    _fgRenderPickCats();
  }
}

function _fgPickSave() {
  if (!_fg || !_fg.pick) return;
  const { tabId, catId } = _fg.pick;
  const t = fgFindTab(tabId);
  if (!t) { fgCloseKeepPicker(); return; }
  const was = !!t.kept;
  const nameEl = document.getElementById('fg-kp-name');
  if (nameEl && fgCleanName(nameEl.value)) fgRenameTab(tabId, nameEl.value);
  fgKeepTab(tabId, catId);
  _fg.lastCat = catId;
  // Open the way to it, so the list shows it where it went.
  const fold = _fgFoldGet();
  fgCatPath(catId).forEach(c => fold.add(c.id));
  _fgFoldSave(fold);
  fgCloseKeepPicker();
  fgRenderStrip();
  if (document.getElementById('fg-switcher')) _fgRenderSwitcher();
  const where = fgCatLabel(catId);
  if (typeof toast === 'function') {
    toast((was ? '"' + t.name + '" is now' : 'Saved "' + t.name + '" to the shelf,') + ' in ' + (where || 'no category') + '.', { type: 'success', duration: 2200 });
  }
  _fgFocusBack();
}

/** Off the shelf: it stays open, and closing it now discards it. */
function _fgUnkeepUI(id) {
  const t = fgFindTab(id);
  if (!t || !t.kept) return;
  fgUnkeepTab(id);
  fgRenderStrip();
  if (document.getElementById('fg-switcher')) _fgRenderSwitcher();
  if (typeof toast === 'function') toast('"' + t.name + '" is off the shelf. Closing it now discards it.', { type: 'info', duration: 2600 });
}

/* ── Every freeground and the shelf (Ctrl+P) ───────────────── */

const FG_FOLD_KEY = 'ssp.fg.fold';

/** The shelf categories folded open on this device (layout, not synced). */
function _fgFoldGet() {
  try {
    const a = JSON.parse(localStorage.getItem(FG_FOLD_KEY) || '[]');
    return new Set(Array.isArray(a) ? a : []);
  } catch (e) { return new Set(); }
}

function _fgFoldSave(set) {
  const live = Array.from(set).filter(id => fgFindCat(id));
  try { localStorage.setItem(FG_FOLD_KEY, JSON.stringify(live)); } catch (e) { /* private mode: folds just are not remembered */ }
}

/** Fold a category open (on true), shut (false) or the other way (undefined). */
function _fgToggleFold(id, on) {
  const set = _fgFoldGet();
  const want = on === undefined ? !set.has(id) : !!on;
  if (want) set.add(id); else set.delete(id);
  _fgFoldSave(set);
  _fgRenderSwitcher();
}

function fgCloseSwitcher() {
  const ov = document.getElementById('fg-switcher');
  if (ov) ov.remove();
}

function fgOpenSwitcher() {
  if (!_fg || document.getElementById('fg-switcher')) return;
  fgCommit();
  const ov = document.createElement('div');
  ov.id = 'fg-switcher';
  ov.className = 'modal-overlay fg-switcher';
  ov.innerHTML = `
    <div class="modal-content fg-sw-box" role="dialog" aria-modal="true" aria-label="All freegrounds">
      <div class="fg-sw-head">
        <i data-lucide="search" aria-hidden="true"></i>
        <input id="fg-sw-q" class="fg-sw-input" placeholder="Find a freeground by name or code…" autocomplete="off" spellcheck="false" aria-label="Find a freeground">
      </div>
      <div class="fg-sw-list" id="fg-sw-list" role="listbox" aria-label="Freegrounds"></div>
      <div class="fg-sw-foot"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>←</kbd><kbd>→</kbd> fold · <kbd>Enter</kbd> open · right-click for more · <kbd>Esc</kbd> close</div>
    </div>`;
  document.body.appendChild(ov);
  _fg.swSel = 0;
  const q = ov.querySelector('#fg-sw-q');
  q.addEventListener('input', () => { _fg.swSel = 0; _fgRenderSwitcher(); });
  ov.addEventListener('keydown', _fgSwitcherKey);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) fgCloseSwitcher(); });
  ov.addEventListener('click', _fgSwitcherClick);
  ov.addEventListener('contextmenu', _fgSwitcherMenu);
  _fgRenderSwitcher();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
  q.focus();
}

/* The first line that says what this freeground is about: past the includes,
   comments, main's own line, braces and `return 0;`, which every one shares. */
function _fgFirstLine(t) {
  const f = (t.files || [])[0];
  const boiler = /^(#include\b|\/\/|\/\*|\*|[{}]$|(int|void)\s+main\s*\(|return\s+0\s*;$)/;
  const line = String((f && f.code) || '').split('\n').map(s => s.trim())
    .find(s => s && !boiler.test(s));
  return line || '';
}

function _fgAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' h ago';
  return Math.round(h / 24) + ' d ago';
}

function _fgQuery() {
  return ((document.getElementById('fg-sw-q') || {}).value || '').trim().toLowerCase();
}

/* Open tabs first, then the shelf: a tree of categories (fgShelfRows), or a
   flat list of matches while searching. Every row is one stop for the arrows. */
function _fgSwitcherRows() {
  const q = _fgQuery();
  const open = fgOpenTabs().filter(t => fgTabMatches(t, q))
    .map(t => ({ kind: 'tab', tab: t, depth: 0, path: '', section: 'open' }));
  const shelf = fgShelfRows(_fgFoldGet(), q).map(r => Object.assign({ section: 'shelf' }, r));
  return open.concat(shelf);
}

function _fgCatRowHTML(r, i) {
  const name = escapeHTML(r.cat.name);
  const sel = i === _fg.swSel;
  return `
      <div class="fg-sw-row fg-sw-cat${sel ? ' is-sel' : ''}" role="option" aria-selected="${sel}" aria-expanded="${r.open}"
           data-fg-cat="${r.cat.id}" style="--fg-depth:${r.depth}">
        <i data-lucide="${r.open ? 'chevron-down' : 'chevron-right'}" class="fg-sw-chev" aria-hidden="true"></i>
        <i data-lucide="${r.open ? 'folder-open' : 'folder'}" class="fg-sw-folder" aria-hidden="true"></i>
        <span class="fg-sw-text"><strong class="fg-sw-catname">${name}</strong></span>
        <span class="fg-sw-count" title="${r.count} kept in here">${r.count}</span>
        <button type="button" class="fg-sw-del fg-sw-more" data-fg-catmenu="${r.cat.id}" title="New subcategory, rename, delete" aria-label="More for ${name}"><i data-lucide="more-horizontal"></i></button>
      </div>`;
}

function _fgTabRowHTML(r, i) {
  const t = r.tab;
  const sel = i === _fg.swSel;
  const shelf = r.section === 'shelf';
  const active = t.id === fgStore().activeId;
  const icon = t.shelved ? 'archive' : (t.pinned ? 'pin' : 'file-code');
  const name = escapeHTML(t.name);
  return `
      <div class="fg-sw-row${sel ? ' is-sel' : ''}${active ? ' is-active' : ''}" role="option" aria-selected="${sel}"
           data-fg-row="${t.id}" data-fg-sec="${r.section}" style="--fg-depth:${r.depth}">
        <i data-lucide="${icon}" aria-hidden="true"></i>
        <span class="fg-sw-text"><strong>${name}</strong><em>${escapeHTML(r.path || _fgFirstLine(t))}</em></span>
        ${!shelf && t.kept ? '<i data-lucide="archive" class="fg-sw-keptmark" aria-label="On the shelf"></i>' : ''}
        ${shelf && !t.shelved ? '<span class="fg-sw-when fg-sw-isopen">open</span>' : `<span class="fg-sw-when">${_fgAgo(t.updatedAt)}</span>`}
        ${shelf && t.shelved ? `<button type="button" class="fg-sw-del" data-fg-del="${t.id}" title="Delete for good" aria-label="Delete ${name} for good"><i data-lucide="trash-2"></i></button>` : ''}
      </div>`;
}

function _fgRenderSwitcher() {
  const list = document.getElementById('fg-sw-list');
  if (!list || !_fg) return;
  const rows = _fgSwitcherRows();
  const q = _fgQuery();
  _fg.swRows = rows;
  _fg.swSel = Math.min(_fg.swSel || 0, Math.max(rows.length - 1, 0));
  const shelfHead = `
      <div class="fg-sw-section fg-sw-shelfhead"><span>Shelf</span>
        <button type="button" class="fg-sw-newcat" data-fg-newcat="1" title="A new category at the top of the shelf"><i data-lucide="folder-plus" aria-hidden="true"></i> New category</button>
      </div>`;
  let html = '';
  let section = null;
  rows.forEach((r, i) => {
    if (r.section !== section) {
      section = r.section;
      html += section === 'open' ? '<div class="fg-sw-section">Open</div>' : shelfHead;
    }
    html += r.kind === 'cat' ? _fgCatRowHTML(r, i) : _fgTabRowHTML(r, i);
  });
  if (!rows.some(r => r.section === 'shelf')) {
    html += shelfHead + `<div class="fg-sw-hint">${q ? 'Nothing on the shelf matches.'
      : 'Nothing kept yet. Save to shelf (Alt+S) keeps a scratch here; a scratch that is not kept is discarded when you close it.'}</div>`;
  }
  list.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
  const sel = list.querySelector('.fg-sw-row.is-sel');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
}

/** Select the first row that `pred` accepts (from the last render). */
function _fgSelectRow(pred) {
  const i = (_fg.swRows || []).findIndex(pred);
  if (i !== -1) _fg.swSel = i;
}

/** A new category under `parentId` (null: at the top), named in place. */
function _fgNewCatUI(parentId) {
  const c = fgNewCat('New category', parentId);
  if (!c) return;
  if (parentId) { const fold = _fgFoldGet(); fgCatPath(parentId).forEach(x => fold.add(x.id)); _fgFoldSave(fold); }
  const q = document.getElementById('fg-sw-q');
  if (q && q.value) q.value = '';
  _fgRenderSwitcher();
  _fgSelectRow(r => r.kind === 'cat' && r.cat.id === c.id);
  _fgRenderSwitcher();
  _fgRenameCatUI(c.id);
}

function _fgRenameCatUI(id) {
  const c = fgFindCat(id);
  const label = document.querySelector('#fg-sw-list [data-fg-cat="' + id + '"] .fg-sw-catname');
  if (!c || !label) return;
  _fgInlineName(label, c.name, (name) => {
    if (name !== null && !fgRenameCat(id, name) && typeof toast === 'function') {
      toast('A category needs a name.', { type: 'warning', duration: 2000 });
    }
    _fgRenderSwitcher();
    _fgFocusBack();
  });
}

function _fgCatMenu(id, anchor) {
  const c = fgFindCat(id);
  if (!c) return;
  const items = [];
  if (fgCatPath(id).length < FG_LIMITS.catDepth) items.push(['sub', 'folder-plus', 'New subcategory', '']);
  items.push(['rename', 'pencil', 'Rename', ''],
    ['delete', 'trash-2', 'Delete category', 'What it holds moves up a level. Undo brings it back.', 'is-danger']);
  _fgShowMenu(fgCatLabel(id), items, anchor, (act) => {
    if (act === 'sub') _fgNewCatUI(id);
    else if (act === 'rename') _fgRenameCatUI(id);
    else if (act === 'delete') { fgDeleteCat(id); _fgRenderSwitcher(); _fgFocusBack(); }
  });
}

function _fgListTabMenu(id, anchor) {
  const t = fgFindTab(id);
  if (!t) return;
  const items = [['open', 'file-code', 'Open', '']];
  items.push(t.kept ? ['move', 'folder-open', 'Move to category…', 'In ' + (fgCatLabel(t.catId) || 'no category')]
    : ['keep', 'archive', 'Save to shelf…', '']);
  if (t.shelved) items.push(['delete', 'trash-2', 'Delete for good', 'Undo brings it back.', 'is-danger']);
  _fgShowMenu(t.name, items, anchor, (act) => {
    if (act === 'open') _fgSwitcherOpen(id);
    else if (act === 'move' || act === 'keep') fgOpenKeepPicker(id, anchor && anchor.isConnected ? anchor : document.getElementById('fg-sw-q'));
    else if (act === 'delete') { fgDeleteTab(id); _fgRenderSwitcher(); _fgFocusBack(); }
  });
}

function _fgSwitcherMenu(e) {
  if (e.target.closest('.fg-name-input')) return;
  const cat = e.target.closest('[data-fg-cat]');
  const row = e.target.closest('[data-fg-row]');
  if (!cat && !row) return;
  e.preventDefault();
  if (cat) _fgCatMenu(cat.getAttribute('data-fg-cat'), cat);
  else _fgListTabMenu(row.getAttribute('data-fg-row'), row);
}

function _fgSwitcherOpen(id) {
  fgCloseSwitcher();
  const t = fgFindTab(id);
  if (!t) return;
  fgCommit();
  if (t.shelved) fgReopenTab(id);
  // fgReopenTab already made it the active id, so ask the editor what it holds.
  if (!state.activeChallenge || state.activeChallenge.id !== 'fg:' + id) fgActivate(id, { noCommit: true });
  else fgRenderStrip();
  const ta = document.getElementById('editor-textarea');
  if (ta) { ta.focus(); _fgCaretToStarter(ta); }
}

/* Left and Right fold only while the search is empty: with text in it they
   move the caret, and a search shows no categories anyway. */
function _fgSwitcherKey(e) {
  if (e.target.closest && e.target.closest('.fg-name-input')) return;
  const rows = _fg.swRows || _fgSwitcherRows();
  const r = rows[_fg.swSel];
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fgCloseSwitcher(); const ta = document.getElementById('editor-textarea'); if (ta) ta.focus(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!rows.length) return;
    _fg.swSel = (_fg.swSel + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
    _fgRenderSwitcher();
    return;
  }
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !_fgQuery() && r) {
    if (r.kind === 'cat') {
      e.preventDefault();
      if (e.key === 'ArrowRight') { if (!r.open) _fgToggleFold(r.cat.id, true); return; }
      if (r.open) { _fgToggleFold(r.cat.id, false); return; }
    }
    if (e.key === 'ArrowLeft' && r.section === 'shelf' && r.depth > 0) {
      e.preventDefault();
      for (let i = _fg.swSel - 1; i >= 0; i--) {
        if (rows[i].kind === 'cat' && rows[i].depth === r.depth - 1) { _fg.swSel = i; break; }
      }
      _fgRenderSwitcher();
    }
    return;
  }
  if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
    const el = document.querySelector('#fg-sw-list .fg-sw-row.is-sel');
    if (!r || !el) return;
    e.preventDefault();
    if (r.kind === 'cat') _fgCatMenu(r.cat.id, el); else _fgListTabMenu(r.tab.id, el);
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!r) return;
    if (r.kind === 'cat') _fgToggleFold(r.cat.id);
    else _fgSwitcherOpen(r.tab.id);
  }
}

/* Delete is two clicks on the same button: the first turns it into "Delete?",
   the second deletes, and an Undo follows. No dialog over a dialog. */
function _fgSwitcherClick(e) {
  if (e.target.closest('.fg-name-input')) return;
  const more = e.target.closest('[data-fg-catmenu]');
  if (more) { e.stopPropagation(); _fgCatMenu(more.getAttribute('data-fg-catmenu'), more); return; }
  if (e.target.closest('[data-fg-newcat]')) { e.stopPropagation(); _fgNewCatUI(null); return; }
  const cat = e.target.closest('[data-fg-cat]');
  if (cat) {
    const id = cat.getAttribute('data-fg-cat');
    _fgSelectRow(r => r.kind === 'cat' && r.cat.id === id);
    _fgToggleFold(id);
    const q = document.getElementById('fg-sw-q');
    if (q) q.focus();
    return;
  }
  const del = e.target.closest('[data-fg-del]');
  if (del) {
    e.stopPropagation();
    if (!del.classList.contains('is-confirm')) {
      del.classList.add('is-confirm');
      del.innerHTML = 'Delete?';
      return;
    }
    fgDeleteTab(del.getAttribute('data-fg-del'));
    _fgRenderSwitcher();
    return;
  }
  const row = e.target.closest('[data-fg-row]');
  if (row) _fgSwitcherOpen(row.getAttribute('data-fg-row'));
}

/* ── Files inside a freeground ─────────────────────────────── */

function fgRenderFileTabs() {
  const bar = document.getElementById('practice-file-tabs');
  if (!bar || !state.userFiles) return;
  bar.innerHTML = state.userFiles.map((f, fi) => `
    <div class="file-tab ${fi === state.activeFileIndex ? 'active' : ''}" onclick="fgSwitchFile(${fi})"
         ondblclick="fgRenameFile(${fi}, this)" title="Double-click to rename">
      <span class="file-tab-name">${escapeHTML(f.name + f.ext)}</span>
      ${fi === 0 ? '' : `<button class="file-tab-reset" onclick="event.stopPropagation(); fgDeleteFile(${fi})" title="Delete this file" aria-label="Delete ${escapeHTML(f.name + f.ext)}">
        <i data-lucide="x" style="width:11px;height:11px;"></i></button>`}
    </div>`).join('')
    + (state.userFiles.length < FG_LIMITS.files
      ? `<button class="file-tab-add" onclick="fgAddFile(this)" title="Add a header or another source file"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>`
      : '');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: bar });
}

function fgSwitchFile(fi) {
  if (!state.userFiles || fi === state.activeFileIndex) return;
  loadPracticeFile(fi);
  fgRenderFileTabs();
  _fgWriteBuffer();
}

function fgAddFile(anchor) {
  if (!state.userFiles || typeof openFileDialog !== 'function') return;
  if (state.userFiles.length >= FG_LIMITS.files) return;
  savePracticeFileCode();
  openFileDialog({
    mode: 'add',
    files: state.userFiles,
    mainCode: (state.userFiles[0] || {}).userCode || '',
    canPair: true,
    anchor: anchor || document.querySelector('.file-tab-add'),
    onSubmit: (r) => {
      const made = [{ name: r.name, ext: r.ext, body: r.guard ? fdGuardText(r.name) : '' }];
      if (r.pair) made.push({ name: r.name, ext: '.c', body: fdPairText(r.name) });
      made.forEach(f => {
        if (state.userFiles.length >= FG_LIMITS.files) return;
        if (state.userFiles.some(x => x.name === f.name && x.ext === f.ext)) return;
        state.userFiles.push({ id: generateId(), name: f.name, ext: f.ext, starterCode: '', code: '', userCode: f.body });
      });
      if (r.include && state.userFiles[0]) {
        state.userFiles[0].userCode = fdInsertInclude(state.userFiles[0].userCode, r.name + r.ext);
        if (state.activeFileIndex === 0) loadPracticeFile(0, { restored: true });
      }
      loadPracticeFile(state.userFiles.length - 1);
      fgRenderFileTabs();
      fgCommit();
    }
  });
}

function fgRenameFile(fi, anchor) {
  if (!state.userFiles || fi >= state.userFiles.length || typeof openFileDialog !== 'function') return;
  openFileDialog({
    mode: 'rename', files: state.userFiles, index: fi, anchor: anchor,
    onSubmit: (r) => {
      state.userFiles[fi].name = r.name;
      state.userFiles[fi].ext = r.ext;
      fgRenderFileTabs();
      fgCommit();
    }
  });
}

function fgDeleteFile(fi) {
  if (!state.userFiles || fi <= 0 || fi >= state.userFiles.length) return;
  const f = state.userFiles[fi];
  const go = () => {
    savePracticeFileCode();
    state.userFiles.splice(fi, 1);
    const next = Math.min(state.activeFileIndex >= fi ? Math.max(state.activeFileIndex - 1, 0) : state.activeFileIndex, state.userFiles.length - 1);
    state.activeFileIndex = next;
    loadPracticeFile(next, { restored: true });
    fgRenderFileTabs();
    fgCommit();
  };
  if (!String(f.userCode || '').trim()) { go(); return; }
  if (typeof showConfirm === 'function') showConfirm('Delete ' + f.name + f.ext, 'Its code goes with it.', go, { confirmLabel: 'Delete' });
  else go();
}

/* ── Keys ──────────────────────────────────────────────────── */

/* Alt, not Ctrl: Ctrl+T, Ctrl+W, Ctrl+N and Ctrl+Tab belong to the browser and
   a page cannot have them. Matched on e.code, because on a Mac Option+N types
   a dead key and e.key is not "n". */
function _fgKeydown(e) {
  if (!_fg || document.body.dataset.route !== 'freeground') return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && !e.shiftKey && !e.altKey && e.code === 'KeyS') {
    e.preventDefault();
    fgCommit(true);
    if (typeof toast === 'function') toast('Saved', { type: 'success', duration: 1200 });
    return;
  }
  // Not counting the fading copy a closed dialog leaves behind (mx-popups.js):
  // a key pressed while it fades is meant for the screen.
  if (document.querySelector('.modal-overlay:not(.hidden):not([data-mx-ghost])')) return;
  if (document.getElementById('run-code-overlay')) return;
  if (document.getElementById('fg-tab-menu') || document.getElementById('fg-keep-pop')) return;
  if (e.target && e.target.classList && e.target.classList.contains('fg-rename-input')) return;
  const findBar = document.getElementById('ed-find-bar');
  const findOpen = !!(findBar && findBar.classList.contains('open'));
  if (findOpen && findBar.contains(document.activeElement) && e.key !== 'Escape') return;

  const active = fgStore().activeId;
  if (ctrl && !e.shiftKey && !e.altKey && e.key === 'Enter') { e.preventDefault(); fgRun(); return; }
  if (ctrl && !e.altKey && e.key === '\\') { e.preventDefault(); toggleZenMode(); return; }
  if (ctrl && !e.shiftKey && !e.altKey && e.code === 'KeyP') { e.preventDefault(); fgOpenSwitcher(); return; }
  if (e.altKey && !ctrl) {
    if (!e.shiftKey && e.code === 'KeyN') { e.preventDefault(); fgNewTabUI(); return; }
    if (!e.shiftKey && e.code === 'KeyW') { e.preventDefault(); fgCloseTabUI(active); return; }
    // Alt+S, not Ctrl+Shift+S: that one is the app's cloud save (firebase-auth.js).
    if (!e.shiftKey && e.code === 'KeyS') { e.preventDefault(); fgOpenKeepPicker(active, document.getElementById('fg-keep-btn')); return; }
    const m = /^Digit([1-9])$/.exec(e.code || '');
    if (m && !e.shiftKey) { e.preventDefault(); const t = fgOpenTabs()[+m[1] - 1]; if (t) fgSwitchTo(t.id); return; }
    if (!e.shiftKey && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { e.preventDefault(); fgCycle(e.code === 'BracketRight' ? 1 : -1); return; }
    if (e.shiftKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      e.preventDefault(); fgMoveTab(active, e.code === 'ArrowLeft' ? -1 : 1); fgRenderStrip(); return;
    }
  }
  if (e.key === 'F2' && !ctrl && !e.altKey) { e.preventDefault(); fgStartRename(active); return; }
  if (e.key === 'Escape') {
    // Never leaves the screen: the find bar first, then bare mode.
    if (findOpen) { e.preventDefault(); if (typeof edCloseFind === 'function') edCloseFind(); return; }
    if (typeof isZenMode === 'function' && isZenMode()) { e.preventDefault(); toggleZenMode(); }
  }
}

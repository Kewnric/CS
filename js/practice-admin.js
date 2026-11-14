/* ============================================================
   PRACTICE-ADMIN.JS — edit the program without leaving its attempt
   ------------------------------------------------------------
   The topbar's admin button (route-practice.js) opens the Coding Library's
   own program form -- route-admin.js getAdminFormHTML, filled by
   admin-form.js openAdminForm -- in a window over the attempt, built like
   the Run Code terminal: dragged by its header, resized from its corner,
   and either blurring the attempt behind it or (the dash) leaving the
   attempt clear and clickable. It opens the way it was last left
   (window-memory.js, 'programAdmin').

   THE ATTEMPT FOLLOWS THE FORM LIVE. Every change to the form's draft
   (adminState) is put on screen by practiceApplyProgram: the title, the
   version's name, the description, samples, hints, tests and minimum
   requirements, the alias and level on the boss bar, the cheat-sheet
   button, and the reference code the boss bar measures you against.

   YOUR CODE IS NEVER TOUCHED. Each file keeps what you wrote; only what the
   program owns behind it (its reference and its starter, for Reset) moves.
   A locked file is handout material, so it follows the program's text. A
   file the program gains appears as a new tab with its starter, and goes
   again if the program drops it before you have written in it.

   Save keeps the changes and puts you straight back in the attempt. Closing
   without saving asks first (the form's own unsaved-changes question), then
   puts the attempt back on the saved program. Leaving the attempt with the
   window open drops it without asking, like the notebook's editor drawer
   (notes-practice-ui.js npUiOpenEditor), which this follows.

   Three things in the form act on the admin page and are taken over here:
   Back (it would go to the admin list), the Save button (it would close
   with a "saved" dialog in the way) and Escape. Single-program attempt only.
   ============================================================ */

let _padmEd = null;           // the open window; see practiceAdminOpen
let _padmSoonTimer = null;
let _padmLast = {};           // what the attempt last painted, per part, so a change repaints only its part

function practiceAdminIsOpen() { return !!_padmEd; }

/** True while the window has the keyboard: the attempt's shortcuts stand down. */
function practiceAdminOwnsFocus() {
  return !!(_padmEd && _padmEd.ov.contains(document.activeElement));
}

function practiceAdminOpen() {
  if (!document.body || document.body.dataset.route !== 'practice') return;
  if (_padmEd) { _padmEd.win.focus({ preventScroll: true }); return; }
  if (typeof getAdminFormHTML !== 'function' || typeof openAdminForm !== 'function') {
    if (typeof toast === 'function') toast('The program editor is not available here', { type: 'warning' });
    return;
  }
  const live = state.activeChallenge;
  const saved = live && (state.challenges || []).find(c => c.id === live.id);
  if (!saved || !state.activeVariant) {
    if (typeof toast === 'function') toast('This program is not in your library any more', { type: 'warning' });
    return;
  }

  // openAdminForm opens the snippet form instead when the admin was last on
  // snippets. The admin page is not up while an attempt is, so its one draft
  // and its mode are free to borrow; the mode is put back on close.
  const mode = window.currentAdminMode;
  window.currentAdminMode = 'practice';

  const mem = (typeof winMemGet === 'function' && winMemGet('programAdmin')) || {};
  // Clear by default: the point of the window is watching the attempt change.
  const floating = mem.floating !== false;
  const ov = document.createElement('div');
  ov.id = 'padm-overlay';
  ov.className = 'padm-overlay' + (floating ? ' is-floating' : '');
  ov.innerHTML = `
    <section class="padm-window" role="dialog" aria-label="Program admin" tabindex="-1">
      <header class="padm-head">
        <span class="padm-title"><i data-lucide="file-cog"></i> Program admin</span>
        <span class="padm-live" title="Your attempt follows this form as you edit. Save keeps the changes; closing without saving puts the program back.">
          <i></i> Live
        </span>
        <span class="padm-sp"></span>
        <button type="button" class="padm-hbtn" id="padm-float-btn"></button>
        <button type="button" class="padm-hbtn padm-close" id="padm-close-btn"
                title="Close and back to the attempt (Esc)" aria-label="Close the program admin">
          <i data-lucide="x"></i>
        </button>
      </header>
      <div class="padm-body">${getAdminFormHTML()}</div>
    </section>`;
  document.body.appendChild(ov);
  const win = ov.querySelector('.padm-window');

  try {
    openAdminForm(saved.id);
    // On the version being attempted, not the program's first one.
    const vi = adminState.variants.findIndex(v => v.id === state.activeVariant.id);
    if (vi > 0) {
      adminState.activeVariantIndex = vi;
      if (typeof renderAdminVariantForm === 'function') renderAdminVariantForm();
    }
  } catch (e) {
    console.error('[ProgramAdmin] Could not open the form:', e);
    ov.remove();
    if (typeof adminState !== 'undefined') adminState = null;
    window.currentAdminMode = mode;
    window.adminIsDirty = false;
    if (typeof toast === 'function') toast('Could not open the program editor', { type: 'error' });
    return;
  }

  if (mem.w > 0 && mem.h > 0) {
    win.style.width = mem.w + 'px';
    win.style.height = mem.h + 'px';
  }
  if (floating && mem.at && typeof winMemPlace === 'function') winMemPlace(win, mem.at);

  // The form closing itself (Discard, Save Changes from its question) is
  // what closes the window, so every way out goes through one place.
  const form = document.getElementById('admin-form-container');
  const obs = new MutationObserver(() => {
    if (form && form.classList.contains('hidden')) practiceAdminClose(true);
  });
  if (form) obs.observe(form, { attributes: true, attributeFilter: ['class'] });

  _padmLast = {};
  _padmEd = {
    ov, win, obs, mode, id: saved.id,
    added: new Set(),               // ids of files this window put in the attempt
    sig: _padmSig(),
    timer: setInterval(_padmSync, 600),
    ro: null,
  };
  // openAdminForm finishes setting the form up on the next tick (its steps);
  // take the starting point after that, so it does not count as an edit.
  setTimeout(() => { if (_padmEd && !window.adminIsDirty) _padmEd.sig = _padmSig(); }, 80);

  ov.addEventListener('click', _padmClick, true);
  ov.addEventListener('input', _padmSoon, true);
  ov.addEventListener('change', _padmSoon, true);
  document.addEventListener('keydown', _padmKey, true);
  document.getElementById('padm-close-btn').onclick = () => practiceAdminClose();
  document.getElementById('padm-float-btn').onclick = () =>
    _padmSetFloating(!ov.classList.contains('is-floating'));
  _padmPaintFloat();
  _padmWireDrag(win);
  _padmWatchSize(win);

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
  win.focus({ preventScroll: true });
}

/** A fingerprint of the draft, without where the form happens to be looking. */
function _padmSig() {
  if (typeof adminState === 'undefined' || !adminState) return '';
  try {
    return JSON.stringify(adminState, (k, v) => (k === 'activeVariantIndex' || k === 'activeFileIndex') ? undefined : v);
  } catch (e) { return ''; }
}

function _padmSoon() {
  clearTimeout(_padmSoonTimer);
  _padmSoonTimer = setTimeout(_padmSync, 250);
}

/* Polled as well as event-driven: the form's own windows (the expanded code
   editor, pickers, Duplicate, Auto-fill expected output) write the draft
   without an input event in this window. */
function _padmSync() {
  if (!_padmEd) return;
  const sig = _padmSig();
  if (!sig || sig === _padmEd.sig) return;
  _padmEd.sig = sig;
  // The admin page marks its form dirty through listeners bound on its own
  // route (bindAdminFormListeners). Without this, closing would drop an edit
  // without asking.
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('admin-save-status', 'unsaved');
  let draft;
  try { draft = JSON.parse(sig); } catch (e) { return; }
  if (practiceApplyProgram(draft)) {
    const live = _padmEd.ov.querySelector('.padm-live');
    if (live) { live.classList.remove('is-pulse'); void live.offsetWidth; live.classList.add('is-pulse'); }
  }
}

function _padmClick(e) {
  const t = e.target;
  if (!t || !t.closest) return;
  // Back would leave for the admin list; here it closes the window.
  if (t.closest('.af-back-btn')) {
    e.preventDefault();
    e.stopPropagation();
    practiceAdminClose();
    return;
  }
  // Save would close the form with a "saved" dialog to dismiss. Here saving
  // is the way back to the attempt, so it saves and goes.
  if (t.closest('#save-all-btn')) {
    e.preventDefault();
    e.stopPropagation();
    _padmSave(true);
  }
}

/** Save the program. `close` goes back to the attempt; otherwise the form stays (Ctrl+S). */
function _padmSave(close) {
  if (!_padmEd || typeof saveAdminForm !== 'function') return false;
  _padmSync();
  const ok = saveAdminForm({ silent: true });
  if (!ok) {
    if (typeof toast === 'function') {
      toast('Not saved: the program needs a title, and every version a name and target code.', { type: 'warning' });
    }
    return false;
  }
  // The attempt moves onto the saved program, so what it writes from here on
  // (a level set on the boss bar, a description fixed in the sidebar) lands
  // in the library rather than in a copy that is about to be dropped.
  const saved = (state.challenges || []).find(c => c.id === _padmEd.id);
  if (saved) practiceApplyProgram(saved);
  _padmEd.sig = _padmSig();
  if (typeof toast === 'function') toast(close ? 'Program saved' : 'Program saved, still editing', { type: 'success', duration: 1600 });
  if (close && typeof closeAdminForm === 'function') closeAdminForm();   // the observer closes the window
  return true;
}

function _padmKey(e) {
  if (!_padmEd) return;
  // Something above the window is up -- one of the form's own dialogs
  // (unsaved changes, the full-screen code editor, a picker), or the
  // terminal, cheat sheet or a walkthrough over everything: it has the keys.
  if (document.querySelector('#dialog-modal:not(.hidden), .modal-overlay:not(.hidden), .cs-backdrop, ' +
      '.prereq-picker-overlay, .ali-folder-backdrop, #run-code-overlay, #cheat-overlay, .demo-overlay')) return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
    // In the attempt's editor, Ctrl+S is still the attempt's: it saves your code.
    if (!practiceAdminOwnsFocus()) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) _padmSave(false);
    return;
  }
  // Esc closes the window wherever the keyboard is, as it does the terminal:
  // it is the topmost thing, so it goes before anything under it.
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    practiceAdminClose();
  }
  // Everything else reaches the form untouched; the attempt's own shortcuts
  // stand down while the window has the keyboard (practice.js checks
  // practiceAdminOwnsFocus).
}

/**
 * Close the window. From its X, Back or Escape it goes through the form's
 * own unsaved-changes question; once the form has closed itself
 * (`formClosed`), the window goes and the attempt is put on the saved copy.
 */
function practiceAdminClose(formClosed) {
  if (!_padmEd) return;
  if (!formClosed) {
    if (typeof confirmCloseAdminForm === 'function' && typeof closeAdminForm === 'function') {
      confirmCloseAdminForm(closeAdminForm, typeof saveAdminForm === 'function' ? saveAdminForm : null);
    } else {
      practiceAdminClose(true);
    }
    return;
  }
  // Applied while the window's record (the files it added) still exists.
  const saved = (state.challenges || []).find(c => c.id === _padmEd.id);
  const kept = saved ? practiceApplyProgram(saved) : false;
  _padmTeardown();
  if (saved && !kept && typeof toast === 'function') {
    toast('This version is no longer in the program, so the attempt keeps what it had.', { type: 'info', duration: 5000 });
  }
  // Straight back to the code.
  const ta = document.getElementById('editor-textarea');
  if (ta) ta.focus({ preventScroll: true });
}

/** Leaving the attempt with the window open: no questions asked, nothing kept. */
function practiceAdminDrop() {
  if (_padmEd) _padmTeardown();
}

function _padmTeardown() {
  const ed = _padmEd;
  _padmEd = null;
  clearInterval(ed.timer);
  clearTimeout(_padmSoonTimer);
  ed.obs.disconnect();
  if (ed.ro) ed.ro.disconnect();
  document.removeEventListener('keydown', _padmKey, true);
  // An editor out in full screen lives outside the window; put it home first.
  if (typeof afCollapseEditor === 'function') afCollapseEditor();
  ed.ov.remove();
  if (typeof adminState !== 'undefined') adminState = null;
  window.adminIsDirty = false;
  window.saveCurrentAdminForm = null;
  window.currentAdminMode = ed.mode || 'practice';
  _padmLast = {};
  return ed;
}

/* ── The window: clear or focused, dragged, resized ─────────────── */

function _padmSetFloating(on) {
  if (!_padmEd) return;
  const { ov, win } = _padmEd;
  ov.classList.toggle('is-floating', on);
  if (!on) win.style.translate = '';   // focused means centred
  if (typeof winMemNote === 'function') winMemNote('programAdmin', ov, win);
  _padmPaintFloat();
}

function _padmPaintFloat() {
  const btn = document.getElementById('padm-float-btn');
  if (!btn || !_padmEd) return;
  const on = _padmEd.ov.classList.contains('is-floating');
  btn.title = on ? 'Focus: blur the attempt behind and centre this window'
    : 'Clear: see the attempt behind this window and keep using it';
  btn.setAttribute('aria-label', btn.title);
  btn.innerHTML = '<i data-lucide="' + (on ? 'square' : 'minus') + '"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
}

/** Dragged by the header, the way the terminal is, and remembered. */
function _padmWireDrag(win) {
  const head = win.querySelector('.padm-head');
  if (!head) return;
  let drag = null;
  head.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const [x, y] = (win.style.translate || '0px 0px').split(' ').map(parseFloat);
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: x || 0, y: y || 0, r: win.getBoundingClientRect() };
    head.setPointerCapture(e.pointerId);
    head.classList.add('is-dragging');
    e.preventDefault();
  });
  head.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = drag.r;
    // Part of the header stays on screen, so the window can always be grabbed back.
    const dx = Math.max(80 - r.right, Math.min(innerWidth - 80 - r.left, e.clientX - drag.sx));
    const dy = Math.max(-r.top, Math.min(innerHeight - 48 - r.top, e.clientY - drag.sy));
    win.style.translate = (drag.x + dx) + 'px ' + (drag.y + dy) + 'px';
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    head.classList.remove('is-dragging');
    if (_padmEd && typeof winMemNote === 'function') winMemNote('programAdmin', _padmEd.ov, win);
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

/* The corner handle (CSS resize) writes the window's width and height inline,
   so an inline size is one the user chose: that is the one remembered, and
   never a size the window only has because the screen changed. */
function _padmWatchSize(win) {
  if (typeof ResizeObserver === 'undefined' || !_padmEd) return;
  let t = 0;
  const ro = new ResizeObserver(() => {
    if (!win.style.width && !win.style.height) return;
    clearTimeout(t);
    t = setTimeout(() => {
      if (typeof winMemSet !== 'function') return;
      winMemSet('programAdmin', { w: Math.round(win.offsetWidth), h: Math.round(win.offsetHeight) });
    }, 300);
  });
  ro.observe(win);
  _padmEd.ro = ro;
}

/* ── The attempt, following the program ─────────────────────────── */

/**
 * Put the attempt on `program` -- a draft from the form or the saved copy --
 * without touching the code you have written. Returns false, and changes
 * nothing, when the version being attempted is not in it.
 */
function practiceApplyProgram(program) {
  if (!program || !document.body || document.body.dataset.route !== 'practice') return false;
  const cur = state.activeVariant;
  const variantId = (cur && cur.id) || (typeof getSessionParam === 'function' ? getSessionParam('practiceVariant') : null);
  const variant = (program.variants || []).find(v => v.id === variantId);
  if (!variant) return false;
  if (!variant.files || !variant.files.length) {
    const first = cur && cur.files && cur.files[0];
    variant.files = [{ id: (first && first.id) || generateId(), name: 'main', ext: '.c',
      starterCode: variant.starterCode || '', code: variant.code || '' }];
  }
  // A check made against other tests or requirements says nothing about these,
  // so its verdict goes with them.
  const graded = v => JSON.stringify([(v && v.tests) || [], (v && v.minRequirements) || []]);
  if (graded(cur) !== graded(variant)) _practiceCheck = null;
  state.activeChallenge = program;
  state.activeVariant = variant;

  _padmApplyFiles(variant);

  const once = (key, value, paint) => {
    if (_padmLast[key] === value) return;
    _padmLast[key] = value;
    paint();
  };
  const diff = typeof getDifficultyBadgeHTML === 'function' ? getDifficultyBadgeHTML(program) : '';
  once('title', (program.title || '') + '\n' + diff, () => {
    const el = document.getElementById('practice-program-title');
    if (el) el.innerHTML = `${escapeHTML(program.title || '')} ${diff}`;
  });
  once('version', variant.name || '', () => {
    const el = document.getElementById('practice-program-version');
    if (el) el.textContent = variant.name || '';
  });
  const desc = variant.description || program.description || '';
  once('desc', desc, () => {
    const el = document.getElementById('practice-desc');
    if (el) el.innerHTML = (typeof formatRichText === 'function' ? formatRichText(desc) : escapeHTML(desc)) || 'No description provided.';
  });
  once('samples', JSON.stringify(variant.samples || []), () => {
    if (typeof practiceRenderSamples === 'function') practiceRenderSamples();
  });
  const hints = variant.hints || [];
  if (state.sessionData) state.sessionData.hintsUsed = Math.min(state.sessionData.hintsUsed || 0, hints.length);
  once('hints', JSON.stringify(hints) + '\n' + ((state.sessionData && state.sessionData.hintsUsed) || 0), () => {
    if (typeof renderHintsBlock === 'function') {
      renderHintsBlock('practice-hints-container', hints, (state.sessionData && state.sessionData.hintsUsed) || 0, 'revealNextHint');
    }
  });

  // The boss bar: its name, its level, and (below) what it measures against.
  const name = typeof getProgramAlias === 'function' ? getProgramAlias(program) : (program.alias || program.title);
  const level = typeof getProgramLevel === 'function' ? getProgramLevel(program) : program.level;
  once('boss', (name || '') + '\n' + (level || ''), () => {
    if (typeof bossSetLevel === 'function') bossSetLevel(level);
    if (typeof bossSetName === 'function') bossSetName(name || '');   // also redraws the nameplate chip
  });
  once('cheat', String(!!program.cheatsheet), () => {
    if (typeof syncCheatsheetBtn === 'function') syncCheatsheetBtn(program);
  });
  if (typeof demoSyncButton === 'function') demoSyncButton();

  // The Tests panel: requirements, test cases, and the title it lists.
  once('tests', graded(variant) + '\n' + (program.title || '') + '\n' + String(_practiceCheck == null), () => {
    if (typeof renderPracticePanel === 'function') renderPracticePanel();
  });

  const ta = document.getElementById('editor-textarea');
  if (ta && typeof updateBossHealthBar === 'function') {
    updateBossHealthBar(typeof edFullSource === 'function' ? edFullSource(ta) : ta.value);
  }
  return true;
}

/**
 * The attempt's files against the program's. What you wrote stays; the
 * reference and starter behind each file follow the program; a locked file
 * follows its text; a file the program gains is added, and one this window
 * added goes again if the program drops it while it still holds only its
 * starter.
 */
function _padmApplyFiles(variant) {
  const files = state.userFiles;
  if (!files) return;
  const added = _padmEd ? _padmEd.added : null;
  const active = files[state.activeFileIndex];
  const seen = new Set();
  let reload = false, tabs = false;

  variant.files.forEach(vf => {
    let uf = files.find(f => f.id && f.id === vf.id);
    if (!uf) uf = files.find(f => !seen.has(f) && f.name === vf.name && f.ext === vf.ext);
    if (uf) {
      seen.add(uf);
      const wasLocked = !!uf.locked, wasText = uf.userCode;
      uf.code = vf.code || '';
      uf.starterCode = vf.starterCode || '';
      uf.locked = !!vf.locked;
      // A file this window added is the program's in every way, name included.
      if (added && added.has(uf.id) && (uf.name !== vf.name || uf.ext !== vf.ext)) {
        uf.name = vf.name;
        uf.ext = vf.ext;
        tabs = true;
      }
      // A given file is the program's to write, so it shows the program's text.
      if (uf.locked && uf.userCode !== uf.starterCode) uf.userCode = uf.starterCode;
      if (wasLocked !== uf.locked) tabs = true;
      if (uf === active && (wasLocked !== uf.locked || wasText !== uf.userCode)) reload = true;
    } else {
      const nf = Object.assign({}, vf, { userCode: vf.starterCode || '' });
      if (!nf.id) nf.id = generateId();
      files.push(nf);
      seen.add(nf);
      if (added) added.add(nf.id);
      tabs = true;
    }
  });

  if (added && added.size) {
    for (let i = files.length - 1; i > 0; i--) {
      const f = files[i];
      if (!added.has(f.id) || seen.has(f)) continue;
      if ((f.userCode || '') !== (f.starterCode || '')) continue;   // written in: yours now
      files.splice(i, 1);
      added.delete(f.id);
      tabs = true;
      if (i === state.activeFileIndex) { state.activeFileIndex = 0; reload = true; }
      else if (i < state.activeFileIndex) state.activeFileIndex--;
    }
  }

  if (reload && typeof loadPracticeFile === 'function') {
    // `restored`: the editor's text is already in its file (the input handler
    // keeps it there), and saving it now would write it over the new text.
    const keep = document.activeElement;
    loadPracticeFile(state.activeFileIndex, { restored: true });
    // Loading a file focuses the editor; typing in the form must not lose its place.
    if (keep && keep !== document.body && keep.isConnected && _padmEd && _padmEd.ov.contains(keep)) {
      keep.focus({ preventScroll: true });
    }
  } else if (tabs && typeof renderPracticeFileTabs === 'function') {
    renderPracticeFileTabs();
  }
}

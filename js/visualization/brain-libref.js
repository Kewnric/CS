/* ============================================================
   BRAIN LIBRARY LINKS
   ------------------------------------------------------------
   A Brain note can stand for one thing in a library: a program, a notebook,
   a snippet, a typing entry, a drill set or scenario, a wing entry. It is an
   ordinary note -- its text, border, colours and font are yours to change --
   carrying `ref` ({ lib, id, sub }) and a round button. What the button does
   is the note's `refMode`, switched from its right-click menu:

     play  start the attempt, through whatever opens first (the timer for a
           program, a notebook or a drill set; Try Coding for a snippet)
     goto  take you to it: its library opens at its folder and the item
           lights up for a few seconds

   Links are made from Insert > Library, which opens the picker: choose a
   library, step through its folders (or search all of it), click an item.
   ============================================================ */

/** Every library a note can link into, with how to start and find its items. */
function brainRefLibs() {
  const libs = [
    {
      key: 'coding', name: 'Coding', full: 'Coding Library', icon: 'code-2', itemIcon: 'file-code',
      color: 'var(--color-primary)', noun: 'program', scope: 'challenge',
      items: () => state.challenges || [],
      play: id => { if (typeof promptTimer === 'function') promptTimer(id); },
      reveal: id => { if (typeof browseOpenProgram === 'function') browseOpenProgram(id); return 'browse'; },
      flash: id => `.tree-node[data-node-id="${id}"] > .tree-node-row`
    },
    {
      key: 'notes', name: 'Notes', full: 'Notes Library', icon: 'book-open', itemIcon: 'book-open',
      color: 'var(--color-warning)', noun: 'notebook', scope: 'notebook',
      items: () => state.notebooks || [],
      play: id => {
        // notesStartAttempt works on the open notebook and asks for a time
        // limit in the shared timer window first.
        if (typeof notesStartAttempt !== 'function') return;
        activeNotebookId = id;
        notesStartAttempt();
      },
      reveal: id => { setSessionParam('activeNotebook', id); return 'study'; },
      flash: id => `.tree-node[data-node-id="${id}"] > .tree-node-row`
    },
    {
      key: 'snippets', name: 'Snippets', full: 'Snippet Library', icon: 'code', itemIcon: 'code',
      color: 'var(--color-accent)', noun: 'snippet', scope: 'snippet',
      items: () => state.snippets || [],
      // Try Coding's window lives on the snippets page, so the page opens
      // first and the window opens on it.
      play: id => {
        setSessionParam('activeSnippetId', id);
        _brainRefGo('snippets', () => {
          activeSnippetId = id;
          if (typeof openTryCodingModal === 'function') openTryCodingModal();
        });
      },
      reveal: id => { setSessionParam('activeSnippetId', id); return 'snippets'; },
      flash: id => `.tree-node[data-node-id="${id}"] > .tree-node-row`
    },
    {
      key: 'typing', name: 'Typing', full: 'Memorization Typing Library', icon: 'keyboard', itemIcon: 'file-text',
      color: '#e2b714', noun: 'entry',
      items: () => state.typeItems || [],
      groups: () => [
        { id: 'all', name: 'Everything', icon: 'layers', has: () => true },
        { id: 'text', name: 'Text', icon: 'file-text', has: it => it.kind !== 'code' }
      ].concat((typeof MT_LANGS !== 'undefined' ? MT_LANGS : []).map(l => (
        { id: l.key, name: l.name, icon: l.icon || 'file-code', has: it => it.kind === 'code' && it.lang === l.key }))),
      play: id => { if (typeof mtlRun === 'function') mtlRun(id); },
      reveal: id => {
        const it = (state.typeItems || []).find(x => x.id === id);
        setSessionParam('mtlView', it && it.kind === 'code' && it.lang ? it.lang : 'text');
        return 'typing';
      },
      flash: id => `.mtl-row[data-ref-id="${id}"]`
    },
    {
      key: 'language', name: 'Language', full: 'Language Library', icon: 'languages', itemIcon: 'dumbbell',
      color: '#a855f7', noun: 'drill',
      items: () => (state.langSets || []).concat(state.langScenarios || []),
      groups: () => [
        { id: 'sets', name: 'Drill sets', icon: 'dumbbell', has: it => (state.langSets || []).includes(it) },
        { id: 'scenarios', name: 'Scenarios', icon: 'swords', has: it => (state.langScenarios || []).includes(it) }
      ],
      // A drill set asks for a time limit first; a scenario starts straight away.
      play: (id, sub) => {
        if (_brainRefLangKind(id, sub) === 'scenarios') { if (typeof langStartScenario === 'function') langStartScenario(id); }
        else if (typeof langPromptTimer === 'function') langPromptTimer('set', id);
      },
      reveal: (id, sub) => {
        setSessionParam('langView', _brainRefLangKind(id, sub));
        setSessionParam('langViewArg', null);
        return 'language';
      },
      flash: id => `[data-ref-id="${id}"]`
    }
  ];
  (typeof LIBRARY_WINGS !== 'undefined' ? LIBRARY_WINGS : []).forEach(w => libs.push({
    key: 'wing:' + w.key, wing: w.key, name: String(w.name || w.key).replace(/ Library$/, ''), full: w.name,
    icon: w.icon || 'file-text', itemIcon: w.icon || 'file-text', color: w.accent || '#8b5cf6',
    noun: 'entry', scope: 'wing:' + w.key,
    items: () => (typeof wingItems === 'function' ? wingItems(w.key) : []),
    play: id => { if (typeof wingRecallStart === 'function') wingRecallStart(w.key, [id]); },
    // wingGoTo navigates by itself and opens the entry on arrival.
    reveal: id => { if (typeof wingGoTo === 'function') wingGoTo(w.key, id); return { route: w.key, navigated: true }; },
    flash: () => '#wing-detail'
  }));
  return libs;
}

function _brainRefLib(key) { return brainRefLibs().find(l => l.key === key) || null; }
function _brainRefItem(lib, id) { return lib ? (lib.items() || []).find(x => x && x.id === id) || null : null; }
function _brainRefTitle(it) { return String((it && (it.title || it.name)) || 'Untitled'); }
function _brainRefLangKind(id, sub) {
  if (sub === 'sets' || sub === 'scenarios') return sub;
  return (state.langScenarios || []).some(s => s.id === id) ? 'scenarios' : 'sets';
}

/* ── Getting somewhere, and lighting it up ──────────────────── */

/** Run `then` once the router is showing `route` and has drawn it. */
function _brainRefGo(route, then, alreadyNavigating) {
  if (!alreadyNavigating && document.body.dataset.route !== route) spaNavigate(route);
  let tries = 60;
  const check = () => {
    if (document.body.dataset.route === route) { setTimeout(() => then && then(), 120); return; }
    if (--tries > 0) setTimeout(check, 100);
  };
  setTimeout(check, 60);
}

/** Find the item on the page it was taken to, bring it into view, and make it glow. */
function _brainRefFlash(selector) {
  let tries = 40;
  const look = () => {
    const el = document.querySelector(selector);
    if (el && el.getClientRects().length) {
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('blr-flash');
      void el.offsetWidth;   // restart the animation if it is already lit
      el.classList.add('blr-flash');
      setTimeout(() => el.classList.remove('blr-flash'), 3200);
      return;
    }
    if (--tries > 0) setTimeout(look, 100);
  };
  look();
}

/** The note's button: play the item, or take you to it. */
function brainRefRun(nodeId, mode) {
  const node = brain.nodes.find(n => n.id === nodeId);
  if (!node || !node.ref) return;
  const lib = _brainRefLib(node.ref.lib);
  const it = _brainRefItem(lib, node.ref.id);
  if (typeof brainHideAllMenus === 'function') brainHideAllMenus();
  if (!it) {
    if (typeof toast === 'function') toast('That item is no longer in its library. Right-click the note to link another.', { type: 'info' });
    return;
  }
  if ((mode || node.refMode || 'play') === 'goto') {
    const went = lib.reveal(it.id, node.ref.sub);
    const route = typeof went === 'string' ? went : went && went.route;
    if (route) _brainRefGo(route, () => _brainRefFlash(lib.flash(it.id, node.ref.sub)), !!(went && went.navigated));
  } else {
    lib.play(it.id, node.ref.sub);
  }
}

/* ── The note ───────────────────────────────────────────────── */

/** Dress a rendered note as a link: its library's tag and the round button. */
function brainRefDecorate(el, node) {
  const body = el.querySelector('.viz-comment-body');
  if (!body || !node.ref) return;
  const lib = _brainRefLib(node.ref.lib);
  const it = _brainRefItem(lib, node.ref.id);
  const goto = node.refMode === 'goto';
  el.classList.add('is-libref');
  el.classList.toggle('is-libref-missing', !it);
  el.style.setProperty('--rc', lib ? lib.color : 'var(--text-tertiary)');
  const what = lib ? (lib.name + ' · ' + lib.noun) : 'Library link';
  const label = !it ? 'Missing from its library' : goto ? 'Show it in ' + (lib.full || lib.name) : 'Play it';
  body.insertAdjacentHTML('afterbegin',
    `<span class="brain-ref-tag"><i data-lucide="${escapeHTML(lib ? lib.icon : 'link-2')}"></i>${escapeHTML(it ? what : 'Missing')}</span>`);
  body.insertAdjacentHTML('beforeend',
    `<button class="brain-ref-btn${goto ? ' is-goto' : ''}" type="button" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}">
       <i data-lucide="${!it ? 'unlink' : goto ? 'locate-fixed' : 'play'}"></i>
     </button>`);
  const btn = body.querySelector(':scope > .brain-ref-btn');
  // The button is not a handle: a press on it must not start dragging the
  // note, and a double click must not open the editor.
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  btn.addEventListener('dblclick', e => e.stopPropagation());
  btn.addEventListener('click', e => { e.stopPropagation(); brainRefRun(node.id); });
}

/** Add a link note for this item, in the middle of what is on screen. */
function brainRefInsert(libKey, id, sub) {
  const lib = _brainRefLib(libKey);
  const it = _brainRefItem(lib, id);
  if (!it) return;
  if (typeof vizClosePopups === 'function') vizClosePopups();
  brainPushUndo();
  if (typeof _brainEnsureVersion === 'function') _brainEnsureVersion();
  const c = document.getElementById('viz-canvas-container');
  const r = c ? c.getBoundingClientRect() : { width: 800, height: 600 };
  const node = {
    id: 'bn_' + generateId(), color: null, commentContent: _brainRefTitle(it),
    x: Math.round((r.width / 2 - brain.pan.x) / brain.zoom - 125),
    y: Math.round((r.height / 2 - brain.pan.y) / brain.zoom - 40),
    ref: { lib: libKey, id, sub: sub || null }, refMode: 'play'
  };
  if (typeof _brainLastStyle === 'function') Object.assign(node, _brainLastStyle());
  brain.nodes.push(node);
  brain.selectedNodeId = node.id;
  brainRenderCanvas(); brainSaveCurrentVersion();
}

/** Point an existing link note at another item. Its text follows only if it was still the old title. */
function _brainRefRelink(nodeId, libKey, id, sub) {
  const node = brain.nodes.find(n => n.id === nodeId);
  const lib = _brainRefLib(libKey);
  const it = _brainRefItem(lib, id);
  if (!node || !it) return;
  brainPushUndo();
  const oldLib = node.ref && _brainRefLib(node.ref.lib);
  const oldItem = node.ref && _brainRefItem(oldLib, node.ref.id);
  if (!String(node.commentContent || '').trim() || (oldItem && node.commentContent === _brainRefTitle(oldItem))) {
    node.commentContent = _brainRefTitle(it);
  }
  node.ref = { lib: libKey, id, sub: sub || null };
  brainRenderCanvas(); brainSaveCurrentVersion();
}

/* ── Its right-click menu ───────────────────────────────────── */

/** Show the link's section of the note menu, marked with what its button does. */
function brainRefSyncCtx(node) {
  const box = document.getElementById('brain-ctx-ref');
  if (!box) return;
  const on = !!(node && node.ref);
  box.classList.toggle('hidden', !on);
  if (!on) return;
  const lib = _brainRefLib(node.ref.lib);
  const it = _brainRefItem(lib, node.ref.id);
  const mode = node.refMode === 'goto' ? 'goto' : 'play';
  const name = document.getElementById('brain-ctx-ref-name');
  if (name) name.textContent = it ? _brainRefTitle(it) : 'Missing from its library';
  const where = document.getElementById('brain-ctx-ref-where');
  if (where) where.textContent = lib ? (lib.full || lib.name) : '';
  box.style.setProperty('--rc', lib ? lib.color : 'var(--text-tertiary)');
  box.querySelectorAll('.brain-ref-mode button').forEach(b => {
    const onB = b.dataset.mode === mode;
    b.classList.toggle('is-on', onB);
    b.setAttribute('aria-checked', String(onB));
  });
  // The one-off action is always the other one.
  const other = document.getElementById('brain-ctx-ref-other');
  if (other) {
    other.dataset.mode = mode === 'play' ? 'goto' : 'play';
    other.innerHTML = mode === 'play'
      ? '<i data-lucide="locate-fixed"></i> Show in library now'
      : '<i data-lucide="play"></i> Play now';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: other });
  }
}

/** The toggle: what the note's button does. Keeps the menu open. */
function brainRefSetMode(mode) {
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node || !node.ref || (node.refMode || 'play') === mode) return;
  brainPushUndo();
  node.refMode = mode;
  brainRenderCanvas(); brainSaveCurrentVersion();
  brainRefSyncCtx(node);
}

function brainRefCtxOther() {
  const other = document.getElementById('brain-ctx-ref-other');
  if (brain.contextNodeId) brainRefRun(brain.contextNodeId, other && other.dataset.mode);
}

function brainRefCtxRelink() {
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (typeof brainHideAllMenus === 'function') brainHideAllMenus();
  if (!node || !node.ref) return;
  brainRefOpenPicker(node.ref.lib, node.id);
}

/* ── Insert > Library ───────────────────────────────────────── */

/** The library tiles at the top of the Insert menu. */
function brainRefInsertTilesHTML() {
  const libs = brainRefLibs();
  const main = libs.filter(l => !l.wing);
  const firstWing = libs.find(l => l.wing);
  const tile = (key, icon, name, color, title) =>
    `<button type="button" class="blr-tile" style="--rc:${color};" role="menuitem" onclick="brainRefOpenPicker('${key}')" title="${escapeHTML(title)}">
       <span class="blr-tile-ic"><i data-lucide="${icon}"></i></span><span class="blr-tile-name">${escapeHTML(name)}</span>
     </button>`;
  return main.map(l => tile(l.key, l.icon, l.name, l.color, 'Link something from the ' + l.full)).join('') +
    (firstWing ? tile(firstWing.key, 'boxes', 'Wings', '#8b5cf6', 'Link an entry from one of the wings') : '');
}

/* ── The picker ─────────────────────────────────────────────── */

const _blr = { lib: 'coding', folder: null, q: '', relink: null, dir: '' };

function brainRefOpenPicker(libKey, relinkNodeId) {
  if (typeof vizClosePopups === 'function') vizClosePopups();
  _blr.lib = _brainRefLib(libKey) ? libKey : 'coding';
  _blr.folder = null;
  _blr.q = '';
  _blr.relink = relinkNodeId || null;
  _blr.dir = '';
  let modal = document.getElementById('blr-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'blr-modal';
    modal.className = 'blr-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Link a library item');
    modal.addEventListener('pointerdown', e => { if (e.target === modal) brainRefClosePicker(); });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); brainRefClosePicker(); }
    });
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="blr-box">
      <div class="blr-head">
        <span class="blr-head-ic"><i data-lucide="link-2"></i></span>
        <span class="blr-head-text">
          <b>${_blr.relink ? 'Link another item' : 'Link a library item'}</b>
          <span>It becomes a note with a button that plays it or shows you where it lives.</span>
        </span>
        <button type="button" class="blr-x" onclick="brainRefClosePicker()" title="Close (Esc)" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="blr-libs" id="blr-libs" role="tablist" aria-label="Libraries"></div>
      <label class="blr-search"><i data-lucide="search"></i>
        <input id="blr-q" type="text" autocomplete="off" placeholder="Search" oninput="brainRefPickerSearch(this.value)" />
      </label>
      <div class="blr-crumbs" id="blr-crumbs"></div>
      <div class="blr-list" id="blr-list" role="listbox" aria-label="Folders and items"></div>
    </div>`;
  modal.classList.remove('hidden', 'is-closing');
  _brainRefPaint();
  const q = document.getElementById('blr-q');
  if (q) setTimeout(() => q.focus({ preventScroll: true }), 60);
}

function brainRefClosePicker() {
  const modal = document.getElementById('blr-modal');
  if (!modal || modal.classList.contains('hidden')) return;
  modal.classList.add('is-closing');
  setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('is-closing'); }, 180);
}

function brainRefPickerLib(key) {
  if (_blr.lib === key) return;
  _blr.lib = key; _blr.folder = null; _blr.dir = 'fwd';
  _brainRefPaint();
  const sel = [...document.querySelectorAll('#blr-libs .blr-lib')].find(b => b.dataset.lib === key);
  if (sel && typeof sel.scrollIntoView === 'function') sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function brainRefPickerFolder(id) {
  _blr.dir = id === null || _brainRefIsAncestor(id, _blr.folder) ? 'back' : 'fwd';
  _blr.folder = id;
  _brainRefPaint();
}

function brainRefPickerSearch(v) {
  _blr.q = String(v || '');
  _blr.dir = '';
  _brainRefPaintList();
}

function brainRefPick(id, sub) {
  const lib = _blr.lib;
  brainRefClosePicker();
  if (_blr.relink) _brainRefRelink(_blr.relink, lib, id, sub);
  else brainRefInsert(lib, id, sub);
}

/* What is inside a folder (or a group, for libraries without folders). */
function _brainRefFolders(lib, parentId) {
  if (lib.groups) return parentId === null ? lib.groups() : [];
  return typeof getChildFolders === 'function' ? getChildFolders(parentId, lib.scope) : [];
}
function _brainRefItemsIn(lib, folderId) {
  const all = lib.items() || [];
  if (lib.groups) {
    if (folderId === null) return [];
    const g = lib.groups().find(x => x.id === folderId);
    return g ? all.filter(g.has) : [];
  }
  return all.filter(it => (it.parentId || null) === folderId);
}
function _brainRefCount(lib, folderId) {
  if (lib.groups) return _brainRefItemsIn(lib, folderId).length;
  return _brainRefItemsIn(lib, folderId).length +
    _brainRefFolders(lib, folderId).reduce((n, f) => n + _brainRefCount(lib, f.id), 0);
}
function _brainRefFolderName(lib, id) {
  if (lib.groups) { const g = lib.groups().find(x => x.id === id); return g ? g.name : ''; }
  const f = (state.nodes || []).find(n => n.id === id);
  return f ? f.name || 'Untitled' : '';
}
function _brainRefPath(lib, id) {
  const out = [];
  if (lib.groups) { if (id !== null) out.push(id); return out; }
  let cur = (state.nodes || []).find(n => n.id === id);
  const seen = new Set();
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.unshift(cur.id); cur = cur.parentId ? (state.nodes || []).find(n => n.id === cur.parentId) : null; }
  return out;
}
function _brainRefIsAncestor(a, b) {
  if (a === null || b === null) return false;
  const lib = _brainRefLib(_blr.lib);
  return !!lib && _brainRefPath(lib, b).slice(0, -1).includes(a);
}
/** For a search result: which group an item belongs to, so a drill set and a scenario are told apart. */
function _brainRefSubOf(lib, it) {
  if (lib.key !== 'language') return null;
  return (state.langScenarios || []).includes(it) ? 'scenarios' : 'sets';
}

function _brainRefNameHTML(name) {
  const part = typeof adminSplitFolderName === 'function' ? adminSplitFolderName(name) : { tag: '', label: name };
  return (part.tag ? `<span class="blr-tag">${escapeHTML(part.tag)}</span>` : '') + `<span class="blr-label">${escapeHTML(part.label)}</span>`;
}

function _brainRefPaint() {
  const libs = brainRefLibs();
  const lib = _brainRefLib(_blr.lib);
  const box = document.getElementById('blr-libs');
  if (box && lib) {
    box.innerHTML = libs.map((l, i) => `
      <button type="button" class="blr-lib${l.key === lib.key ? ' is-on' : ''}" role="tab" aria-selected="${l.key === lib.key}"
              data-lib="${escapeHTML(l.key)}" style="--rc:${l.color};--i:${i};" onclick="brainRefPickerLib('${escapeHTML(l.key)}')" title="${escapeHTML(l.full || l.name)}">
        <i data-lucide="${escapeHTML(l.icon)}"></i><span>${escapeHTML(l.name)}</span><b>${(l.items() || []).length}</b>
      </button>`).join('');
  }
  const modal = document.getElementById('blr-modal');
  if (modal && lib) modal.style.setProperty('--rc', lib.color);
  const q = document.getElementById('blr-q');
  if (q) { q.value = _blr.q; q.placeholder = 'Search ' + (lib ? lib.full || lib.name : '') + '…'; }
  _brainRefPaintList();
  if (typeof lucide !== 'undefined' && modal) lucide.createIcons({ root: modal });
}

function _brainRefPaintList() {
  const lib = _brainRefLib(_blr.lib);
  const list = document.getElementById('blr-list');
  const crumbs = document.getElementById('blr-crumbs');
  if (!lib || !list) return;
  const q = _blr.q.trim().toLowerCase();
  let rows = [];
  if (q) {
    // Search the whole library, wherever things are filed.
    (lib.items() || []).filter(it => _brainRefTitle(it).toLowerCase().includes(q)).slice(0, 80).forEach(it => {
      const where = lib.groups ? (_brainRefSubOf(lib, it) === 'scenarios' ? 'Scenarios' : lib.key === 'language' ? 'Drill sets' : '')
        : _brainRefPath(lib, it.parentId || null).map(id => _brainRefFolderName(lib, id)).join(' › ') || 'Uncategorized';
      rows.push(_brainRefItemRow(lib, it, _brainRefSubOf(lib, it), where));
    });
    if (crumbs) crumbs.innerHTML = `<span class="blr-crumb is-here"><i data-lucide="search"></i> ${rows.length} match${rows.length === 1 ? '' : 'es'} in ${escapeHTML(lib.full || lib.name)}</span>`;
  } else {
    const fid = _blr.folder;
    _brainRefFolders(lib, fid).forEach(f => {
      const n = lib.groups ? _brainRefItemsIn(lib, f.id).length : _brainRefCount(lib, f.id);
      rows.push(`
        <button type="button" class="blr-row is-folder" onclick="brainRefPickerFolder('${escapeHTML(f.id)}')">
          <span class="blr-ic"><i data-lucide="${escapeHTML(f.icon || 'folder')}"></i></span>
          <span class="blr-name">${_brainRefNameHTML(f.name || 'Untitled')}</span>
          <span class="blr-count">${n}</span>
          <i data-lucide="chevron-right" class="blr-chev"></i>
        </button>`);
    });
    const sub = lib.groups ? fid : null;
    _brainRefItemsIn(lib, fid).forEach(it => rows.push(_brainRefItemRow(lib, it, sub || _brainRefSubOf(lib, it))));
    if (crumbs) {
      const trail = [`<button type="button" class="blr-crumb${fid === null ? ' is-here' : ''}" onclick="brainRefPickerFolder(null)"><i data-lucide="${escapeHTML(lib.icon)}"></i> ${escapeHTML(lib.name)}</button>`]
        .concat(_brainRefPath(lib, fid).map((id, i, a) =>
          `<i data-lucide="chevron-right" class="blr-crumb-sep"></i><button type="button" class="blr-crumb${i === a.length - 1 ? ' is-here' : ''}" onclick="brainRefPickerFolder('${escapeHTML(id)}')">${escapeHTML(_brainRefFolderName(lib, id))}</button>`));
      crumbs.innerHTML = trail.join('');
    }
  }
  list.classList.remove('is-fwd', 'is-back');
  void list.offsetWidth;
  if (_blr.dir) list.classList.add(_blr.dir === 'back' ? 'is-back' : 'is-fwd');
  list.innerHTML = rows.length
    ? rows.map((r, i) => r.replace('class="blr-row', `style="--i:${Math.min(i, 14)};" class="blr-row`)).join('')
    : `<div class="blr-empty"><i data-lucide="${q ? 'search-x' : 'inbox'}"></i>${q ? 'Nothing matches that.' : 'Nothing in here yet.'}</div>`;
  if (typeof lucide !== 'undefined') { lucide.createIcons({ root: list }); if (crumbs) lucide.createIcons({ root: crumbs }); }
}

function _brainRefItemRow(lib, it, sub, where) {
  const icon = lib.key === 'language' && sub === 'scenarios' ? 'swords' : lib.itemIcon;
  return `
    <button type="button" class="blr-row is-item" role="option" onclick="brainRefPick('${escapeHTML(it.id)}', ${sub ? `'${escapeHTML(sub)}'` : 'null'})"
            title="${escapeHTML(_brainRefTitle(it))}">
      <span class="blr-ic"><i data-lucide="${escapeHTML(icon)}"></i></span>
      <span class="blr-name"><span class="blr-label">${escapeHTML(_brainRefTitle(it))}</span>${where ? `<small>${escapeHTML(where)}</small>` : ''}</span>
      <span class="blr-add"><i data-lucide="${_blr.relink ? 'replace' : 'plus'}"></i>${_blr.relink ? 'Use' : 'Link'}</span>
    </button>`;
}

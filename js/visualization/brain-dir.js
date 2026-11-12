/* ============================================================
   BRAIN DIRECTORIES
   ------------------------------------------------------------
   A note can be a directory. Switched on from its right-click menu
   (Directory), it gets a canvas of its own, reachable only through it:
   a double-click on the note swaps the whole canvas for that one, and
   its notes can be directories too, as deep as you like. The path sits
   on the canvas's top-left corner (#brain-dir-bar): the arrow goes up
   one level (Alt+Left too), a name jumps straight to that level. The
   note is still an ordinary note -- its text is edited from its menu
   (Edit), since a double-click now opens it.

   STORAGE. Every inner canvas of a version is kept flat on the version,
   `v.dirs[dirId] = { nodes, links, pan, zoom }`; the note holds `dirId`,
   and `dir: true` while the switch is on. Not nested inside the note:
   Firestore refuses a document more than 20 maps/arrays deep and each
   level nested in its note costs three, so the sixth level down would
   have failed every cloud save (all domains: the write is one batch).
   Flat, a canvas ten levels down is as deep as one level down.

   What is on screen is always one level. brain.nodes / brain.links are
   that level's and brainSaveCurrentVersion writes them back to it
   (brainDirContainer). brain.dirPath lists the directory notes opened
   from the top, each with the undo history of the level it was opened
   from, so Ctrl+Z never reaches into a level that is not on screen.

   A deleted directory note's canvases stay in v.dirs, so Ctrl+Z brings
   the note back whole. They are dropped (brainDirPrune) when another
   canvas is opened from the pane, which also ends the undo history.
   Switching Directory off keeps the inside (`dirId` stays): switched
   back on, it is all still there.
   ============================================================ */

/** The version on screen, or null. */
function _brainDirVersion() {
  return brain.activeVersionId ? brain.versions.find(v => v.id === brain.activeVersionId) || null : null;
}

/** One inner canvas of a version; with `create`, made empty if it is missing. */
function _brainDirCanvas(v, dirId, create) {
  if (!v || !dirId) return null;
  if (!v.dirs || typeof v.dirs !== 'object') {
    if (!create) return null;
    v.dirs = {};
  }
  if (!v.dirs[dirId] && create) v.dirs[dirId] = { nodes: [], links: [] };
  return v.dirs[dirId] || null;
}

/** Where the level on screen is kept: the version itself at the top, else its directory's canvas. */
function brainDirContainer(v) {
  if (!v) return null;
  const here = brain.dirPath.length ? brain.dirPath[brain.dirPath.length - 1] : null;
  return here ? _brainDirCanvas(v, here.dirId, true) : v;
}

/** A directory's name: the first line of its note's text. */
function _brainDirName(node) {
  const line = String((node && node.commentContent) || '').split('\n')
    .map(s => s.replace(/^[\s#>*+-]+/, '').trim()).find(Boolean) || '';
  return line.length > 40 ? line.slice(0, 39) + '…' : (line || 'Untitled');
}

/** The names along the path: the version, then each directory opened, the last one on screen. */
function brainDirTrail(v) {
  const names = [v ? v.name : ''];
  brain.dirPath.forEach((f, i) => {
    const from = i === 0 ? v : _brainDirCanvas(v, brain.dirPath[i - 1].dirId);
    const note = from && (from.nodes || []).find(n => n.id === f.id);
    names.push(note ? _brainDirName(note) : 'Directory');
  });
  return names;
}

/** Notes inside a directory note; with `deep`, every level below it as well. */
function brainDirCount(node, deep) {
  const v = _brainDirVersion();
  if (!v || !node || !node.dirId) return 0;
  let total = 0;
  const seen = new Set();
  const walk = dirId => {
    if (seen.has(dirId)) return;
    seen.add(dirId);
    const c = _brainDirCanvas(v, dirId);
    (c && c.nodes || []).forEach(n => {
      total++;
      if (deep && n.dirId) walk(n.dirId);
    });
  };
  walk(node.dirId);
  return total;
}

/* ── Moving between levels ──────────────────────────────────── */

/* An open note editor belongs to the level it was opened on: save it there
   before that level goes, or its text would be looked for on the next one. */
function _brainDirSettleEditor() {
  const save = document.getElementById('viz-comment-editor-save');
  if (save && save.isConnected) save.click();
}

/** Open a directory note: the canvas becomes its own. */
function brainDirEnter(nodeId) {
  const v = _brainDirVersion();
  const node = brain.nodes.find(n => n.id === nodeId);
  if (!v || !node || !node.dir) return;
  _brainDirSettleEditor();
  brainHideAllMenus();
  if (brain.linkingFrom) brainCancelLinking();
  if (!node.dirId) node.dirId = 'bd_' + generateId();
  _brainDirCanvas(v, node.dirId, true);
  brainSaveCurrentVersion();   // the level being left, as it is now
  brain.dirPath.push({ id: node.id, dirId: node.dirId, undo: brain._undoStack });
  brain._undoStack = [];
  _brainDirShow('in');
}

/** Back to a level on the path: 0 is the version's own canvas. */
function brainDirGoTo(depth) {
  if (!(depth >= 0 && depth < brain.dirPath.length)) return;
  _brainDirSettleEditor();
  brainHideAllMenus();
  if (brain.linkingFrom) brainCancelLinking();
  brainSaveCurrentVersion();
  const frame = brain.dirPath[depth];
  brain.dirPath = brain.dirPath.slice(0, depth);
  brain._undoStack = frame.undo || [];
  // The directory just left is selected, so you can see where you came out.
  _brainDirShow('out', frame.id);
}

/** Up one level. */
function brainDirUp() {
  if (brain.dirPath.length) brainDirGoTo(brain.dirPath.length - 1);
}

/** Put the level the path now ends at on screen. */
function _brainDirShow(way, selectId) {
  const c = brainDirContainer(_brainDirVersion());
  if (!c) return;
  if (typeof vizStopTween === 'function') vizStopTween();
  // The double-click that got here was made hovering a note, and that note is
  // gone from the new level: its hover highlight would leave every note on the
  // new one dimmed until the pointer crossed another.
  if (typeof vizHoverClear === 'function') vizHoverClear();
  brain.nodes = JSON.parse(JSON.stringify(c.nodes || []));
  brain.links = JSON.parse(JSON.stringify(c.links || []));
  const fresh = !c.pan;
  brain.pan = c.pan ? { ...c.pan } : { x: 0, y: 0 };
  brain.zoom = c.zoom || 1;
  brain.selectedNodeId = selectId && brain.nodes.some(n => n.id === selectId) ? selectId : null;
  brain.contextNodeId = null;
  brain._focusedParentId = null;
  // A search typed on one level goes on lighting up matches on the next.
  brain._highlightedIds = new Set();
  if (brain.searchQuery) {
    brain.nodes.forEach(n => {
      if ((n.commentContent || '').toLowerCase().includes(brain.searchQuery)) brain._highlightedIds.add(n.id);
    });
  }
  brainClearObservers();
  brainRenderCanvas();
  _brainDirAnimate(way);
  // Never opened before (a pasted directory, say): frame what is in it.
  if (fresh && brain.nodes.length) brainCenterCanvas(true);
  setTimeout(() => brainUpdateMinimap(), 50);
}

let _brainDirAnimTimer = 0;
function _brainDirAnimate(way) {
  const c = document.getElementById('viz-canvas-container');
  if (!c || !way) return;
  c.classList.remove('brain-dir-in', 'brain-dir-out');
  void c.offsetWidth;   // restart it when levels are crossed quickly
  c.classList.add('brain-dir-' + way);
  clearTimeout(_brainDirAnimTimer);
  _brainDirAnimTimer = setTimeout(() => c.classList.remove('brain-dir-in', 'brain-dir-out'), 420);
}

/** Leaving Brain for the library map: back to the top level, quietly. Anything
 *  that saves after this must not write an inner level over the version's own. */
function brainDirLeave() {
  if (brain.dirPath.length) {
    const v = _brainDirVersion();
    brain.dirPath = [];
    if (v) {
      brain.nodes = JSON.parse(JSON.stringify(v.nodes || []));
      brain.links = JSON.parse(JSON.stringify(v.links || []));
      brain.pan = v.pan ? { ...v.pan } : { x: 0, y: 0 };
      brain.zoom = v.zoom || 1;
    }
  }
  brainDirPaint(true);
}

/* ── The switch, in the note's menu ─────────────────────────── */

function brainCtxToggleDir() {
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  const v = _brainDirVersion();
  if (!node || !v) return;
  brainPushUndo();
  brainHideAllMenus();
  if (node.dir) {
    delete node.dir;
    const n = brainDirCount(node, true);
    if (typeof toast === 'function') {
      toast(n ? `Directory off. The ${n} note${n === 1 ? '' : 's'} inside are kept: switch it back on to see them again.`
        : 'Directory off.', { type: 'info' });
    }
  } else {
    node.dir = true;
    if (!node.dirId) node.dirId = 'bd_' + generateId();
    _brainDirCanvas(v, node.dirId, true);
    if (typeof toast === 'function') toast('Directory on. Double-click the note to open its canvas.', { type: 'info' });
  }
  brainRenderCanvas();
  brainSaveCurrentVersion();
}

/** Mark the menu's Directory switch with the note's state. */
function brainDirSyncCtx(node) {
  const btn = document.getElementById('brain-ctx-dir-btn');
  if (!btn) return;
  const on = !!(node && node.dir);
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.title = on ? 'Directory is on: double-click opens its canvas. Press to switch it off'
    : 'Directory: give this note a canvas of its own';
}

/** The folder mark on a directory note's corner, with how many notes it holds. */
function brainDirBadgeHTML(node) {
  const n = brainDirCount(node);
  const what = n ? `${n} note${n === 1 ? '' : 's'} inside` : 'empty';
  return `<span class="brain-dir-badge" title="Directory · ${what} · double-click to open" aria-label="Directory, ${what}">`
    + `<i data-lucide="folder"></i>${n ? `<b>${n}</b>` : ''}</span>`;
}

/* ── Deleting one asks twice ────────────────────────────────── */

/** A note that holds a canvas (or did, and still keeps it) is not deleted on one click. */
function brainDirGuardsDelete(node) {
  return !!(node && (node.dir || brainDirCount(node) > 0));
}

function brainDirConfirmDelete(node, go) {
  if (typeof showConfirm !== 'function') { go(); return; }
  const name = _brainDirName(node);
  const n = brainDirCount(node, true);
  const nested = n > brainDirCount(node);   // some of them are in directories of their own
  const inside = `${n} note${n === 1 ? '' : 's'}`;
  const first = node.dir
    ? `“${name}” is a directory${n ? ` with ${inside} inside` : ''}. Delete it?`
    : `“${name}” still keeps ${inside} from when it was a directory. Delete it?`;
  showConfirm('Delete directory?', first, () => {
      // After the first dialog has gone, so the second reads as a new question.
      setTimeout(() => {
        showConfirm('Delete everything in it?', n
          ? `Deleting “${name}” also deletes the ${inside} inside it${nested ? ', directories within it included' : ''}. Ctrl+Z brings it all back.`
          : `Deleting “${name}” also deletes its canvas, empty for now. Ctrl+Z brings it back.`,
          go, { confirmLabel: n ? 'Delete all' : 'Delete' });
        // Its Confirm sits where the first one was. Held for a moment, so one
        // double-click cannot answer both questions.
        const ok = document.getElementById('dlg-confirm');
        if (ok) { ok.disabled = true; setTimeout(() => { ok.disabled = false; }, 600); }
      }, 160);
    }, { confirmLabel: 'Delete' });
}

/* ── Undo ───────────────────────────────────────────────────────
   A note's `dirId` is the only thing that leads to its canvases, so an undo
   never takes it away: undoing "Directory on" switches it off (like the menu
   does) and keeps whatever was put inside since. Without this the canvas was
   cut loose -- switched on again, the directory came up empty. */
function brainDirKeepIds(restored, current) {
  const had = new Map((current || []).filter(n => n && n.dirId).map(n => [n.id, n.dirId]));
  (restored || []).forEach(n => { if (n && !n.dirId && had.has(n.id)) n.dirId = had.get(n.id); });
}

/* ── Keeping the store tidy ─────────────────────────────────── */

/** Drop the canvases no note leads to any more (deleted directories). Only
 *  where no undo history could bring their note back: see brainSwitchVersion. */
function brainDirPrune(v) {
  if (!v || !v.dirs || typeof v.dirs !== 'object') return;
  const keep = new Set();
  const walk = nodes => (nodes || []).forEach(n => {
    if (!n || !n.dirId || keep.has(n.dirId)) return;
    keep.add(n.dirId);
    const c = v.dirs[n.dirId];
    if (c) walk(c.nodes);
  });
  walk(v.nodes);
  Object.keys(v.dirs).forEach(k => { if (!keep.has(k)) delete v.dirs[k]; });
  if (!Object.keys(v.dirs).length) delete v.dirs;
}

/* ── Copy and paste ─────────────────────────────────────────────
   A copied directory note carries its canvases (`dirPack`), so a paste --
   here, inside another directory, or in another version -- brings them. A
   paste gets copies under new ids: two notes never share one canvas. */

function brainDirPack(clip) {
  const v = _brainDirVersion();
  if (!v || !clip || !clip.dirId) return;
  const pack = {};
  const walk = dirId => {
    if (pack[dirId]) return;
    const c = _brainDirCanvas(v, dirId);
    if (!c) return;
    pack[dirId] = JSON.parse(JSON.stringify(c));
    (c.nodes || []).forEach(n => { if (n.dirId) walk(n.dirId); });
  };
  walk(clip.dirId);
  clip.dirPack = pack;
}

function brainDirUnpack(copy) {
  if (!copy) return;
  let pack = copy.dirPack;
  delete copy.dirPack;
  const v = _brainDirVersion();
  if (!v || !copy.dirId) return;
  if (!pack) {   // Ctrl+D, or a paste of the selected note: from this version
    brainDirPack(copy);
    pack = copy.dirPack;
    delete copy.dirPack;
  }
  const ids = new Map();
  const fresh = id => {
    if (!ids.has(id)) ids.set(id, 'bd_' + generateId());
    return ids.get(id);
  };
  Object.keys(pack || {}).forEach(old => {
    const c = pack[old];
    (c.nodes || []).forEach(n => { if (n.dirId) n.dirId = fresh(n.dirId); });
    _brainDirCanvas(v, fresh(old), true);
    v.dirs[fresh(old)] = c;
  });
  copy.dirId = fresh(copy.dirId);
  _brainDirCanvas(v, copy.dirId, true);
}

/* ── What the canvas shows about where you are ──────────────── */

/** The path bar and an empty directory's message; `leaving` hides both. */
function brainDirPaint(leaving) {
  const v = _brainDirVersion();
  if (!v && brain.dirPath.length) brain.dirPath = [];
  const depth = leaving ? 0 : brain.dirPath.length;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.toggle('brain-in-dir', depth > 0);
  _brainDirPaintEmpty(depth > 0);
  const bar = document.getElementById('brain-dir-bar');
  if (!bar) return;
  if (!bar._brainDirWired) {
    // A bar on the canvas, not part of it: a press must not pan, a double
    // click must not drop a note under it, a right-click is not the canvas's.
    bar._brainDirWired = true;
    ['pointerdown', 'dblclick', 'contextmenu'].forEach(t => bar.addEventListener(t, e => e.stopPropagation()));
  }
  if (!depth) {
    bar.classList.add('hidden');
    if (bar.dataset.key) { bar.innerHTML = ''; bar.dataset.key = ''; }
    return;
  }
  const names = brainDirTrail(v);
  bar.classList.remove('hidden');
  const key = names.join('\u0001');
  if (bar.dataset.key === key) return;
  bar.dataset.key = key;
  const last = names.length - 1;
  const crumb = i => i === last
    ? `<span class="brain-dir-crumb is-here" aria-current="location" title="${escapeHTML(names[i])}">${escapeHTML(names[i])}</span>`
    : `<button type="button" class="brain-dir-crumb" onclick="brainDirGoTo(${i})" title="Go to ${escapeHTML(names[i])}">${escapeHTML(names[i])}</button>`;
  // A deep path keeps both ends: the version, then the last two levels.
  const shown = names.length > 4 ? [0, -1, last - 1, last] : names.map((_, i) => i);
  const parts = shown.map(i => i === -1
    ? `<span class="brain-dir-more" title="${escapeHTML(names.slice(1, last - 1).join(' › '))}">…</span>`
    : crumb(i));
  const up = escapeHTML(names[last - 1]);
  bar.innerHTML = `<button type="button" class="brain-dir-back" onclick="brainDirUp()" title="Back to ${up} (Alt+←)" aria-label="Back to ${up}"><i data-lucide="arrow-left"></i></button>`
    + `<span class="brain-dir-path">${parts.join('<i data-lucide="chevron-right" class="brain-dir-sep" aria-hidden="true"></i>')}</span>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: bar });
}

/* The canvas's empty message is shared with the rest of Visualize; inside an
   empty directory it says so, and what it said before is put back after. */
function _brainDirPaintEmpty(inDir) {
  const el = document.getElementById('viz-canvas-empty');
  if (!el) return;
  const h3 = el.querySelector('h3'), p = el.querySelector('p');
  if (inDir) {
    if (!el._brainDirWas) el._brainDirWas = { h3: h3 ? h3.textContent : '', p: p ? p.textContent : '' };
    el.dataset.brainDir = '1';
    const names = brainDirTrail(_brainDirVersion());
    if (h3) h3.textContent = names[names.length - 1];
    if (p) p.textContent = 'This directory is empty. Double-click anywhere to add a note.';
  } else if (el._brainDirWas) {
    if (h3) h3.textContent = el._brainDirWas.h3;
    if (p) p.textContent = el._brainDirWas.p;
    el._brainDirWas = null;
    delete el.dataset.brainDir;
  }
}

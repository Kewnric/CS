/* ============================================================
   TREE-DND.JS — one drag-and-drop engine for every library tree
   ------------------------------------------------------------
   The Coding, Notebook and Snippet libraries and the Visualize
   sidebar each grew their own copy of this, and all four could do
   exactly one thing: reorder rows that ALREADY shared a parent.
   Dropping onto a folder, into a different folder, or onto the
   empty space below the tree silently did nothing — while the
   cursor said "move" the entire time, which is why it felt random
   rather than unimplemented.

   What a drop means here:
     folder row, middle 50%   → move INTO that folder
     folder row, top/bottom   → reorder beside it
     item row,   top/bottom   → reorder beside it
     empty space under a tree → move to the top level

   Everything that can't happen is refused visibly (dropEffect
   'none' + a struck-through row) instead of being accepted and
   then ignored.
   ============================================================ */

/* Only a drag that started in one of our trees is accepted, so a file dragged
   in from the desktop can't be mistaken for a node. */
const TREE_MIME = 'application/x-studysession-tree';
const TREE_SPRING_MS = 600;      // hover-to-open delay for a collapsed folder
const TREE_EDGE_PX = 44;         // auto-scroll band at the top/bottom of a pane
const TREE_TOUCH_HOLD_MS = 320;  // long-press before a touch drag begins

const TREE_HOSTS = {};

/**
 * @param {string} ns        'browse' | 'notes' | 'snippets' | 'viz'
 * @param {object} cfg
 *   scope     data scope for state.nodes / getItemsForScope
 *   container CSS selector for the scrolling tree container
 *   rerender  redraw the tree after a move
 *   selectNs  library-common selection namespace, for multi-drag (optional)
 *   canMove   (id, kind) => boolean (optional veto)
 */
function registerTreeHost(ns, cfg) { TREE_HOSTS[ns] = cfg; }

const TDND = {
  ns: null, ids: [], kind: null,
  row: null, zone: null,
  springId: null, springTimer: null,
  scroller: null, scrollDir: 0, scrollRAF: 0,
  touch: null
};

/* ── Model helpers ─────────────────────────────────────────── */

function treeScope(ns) { return (TREE_HOSTS[ns] || {}).scope; }

/* ── Data adapter ──────────────────────────────────────────────
   Three of the four trees read state.nodes + getItemsForScope. The Brain
   sidebar keeps its versions and folders in its own store, so rather than
   forking a second tree for it, a host may supply its own accessors and get
   the whole engine — drag, drop, ARIA, menus, spring-load, undo — unchanged.

   `ns` is threaded through everything below purely so these can be found. */
let _treeNs = null;                     // whose data we are looking at right now

function _treeData(ns) {
  const h = TREE_HOSTS[ns || _treeNs] || {};
  return h.data || null;
}

/** Run `fn` with a namespace bound, for the helpers that take only an id. */
function _treeWith(ns, fn) {
  const prev = _treeNs;
  _treeNs = ns || _treeNs;
  try { return fn(); } finally { _treeNs = prev; }
}

/* The "Uncategorized" row stands for parentId: null. It used to be a label with
   no id, no chevron and no drop wiring, so the one place items came FROM was
   the one place they could never be put back. */
const TREE_ROOT_ID = '__root__';

function treeFind(id, scope, ns) {
  if (id === TREE_ROOT_ID) {
    return { kind: 'folder', node: { id: TREE_ROOT_ID, name: 'Uncategorized', parentId: null }, pseudo: true };
  }
  const data = _treeData(ns);
  if (data) return data.find(id);
  const node = (state.nodes || []).find(n => n.id === id);
  if (node) return { kind: 'folder', node };
  const items = (typeof getItemsForScope === 'function' ? getItemsForScope(scope) : []) || [];
  const item = items.find(i => i.id === id);
  if (item) return { kind: 'item', node: item };
  const sets = (scope === 'challenge' && state.codingSets) || [];
  const set = sets.find(s => s.id === id);
  if (set) return { kind: 'set', node: set };
  return null;
}

function treeKindOf(id, scope) { const f = treeFind(id, scope); return f ? f.kind : null; }
function treeParentOf(id, scope) { const f = treeFind(id, scope); return f ? (f.node.parentId || null) : null; }

/** Is `maybeAncestor` somewhere above `id` in the folder chain? */
function treeIsAncestor(maybeAncestor, id, scope) {
  let cur = treeParentOf(id, scope);
  let hops = 0;
  while (cur && hops++ < 200) {
    if (cur === maybeAncestor) return true;
    cur = treeParentOf(cur, scope);
  }
  return false;
}

/**
 * Every child of a folder in ONE display order.
 *
 * Folders and items used to be sorted in two separate passes, so a row dragged
 * above a folder was stored above it and then still drawn below it — the move
 * looked like it had snapped back. They share an order space now; folders-first
 * survives only as the tiebreak for legacy data, where both kinds were numbered
 * from 0 independently.
 *
 * @returns {Array<{kind:'folder'|'set'|'item', node:object}>}
 */
function treeChildren(parentId, scope, ns) {
  const p = parentId || null;
  const data = _treeData(ns);
  if (data) {
    return data.folders(p).map(n => ({ kind: 'folder', node: n }))
      .concat(data.items(p).map(n => ({ kind: 'item', node: n })))
      .map((e, i) => { e.seq = i; return e; })
      .sort((a, b) => {
        const ao = typeof a.node.order === 'number' ? a.node.order : 1e9;
        const bo = typeof b.node.order === 'number' ? b.node.order : 1e9;
        if (ao !== bo) return ao - bo;
        if ((a.kind === 'folder') !== (b.kind === 'folder')) return a.kind === 'folder' ? -1 : 1;
        return a.seq - b.seq;
      });
  }
  const folders = ((typeof getChildFolders === 'function' ? getChildFolders(p, scope) : []) || [])
    .map(n => ({ kind: 'folder', node: n, bias: 0 }));
  const sets = (scope === 'challenge' && typeof getSetsInFolder === 'function')
    ? (getSetsInFolder(p) || []).map(n => ({ kind: 'set', node: n, bias: 1 })) : [];
  const items = ((typeof getItemsInFolder === 'function' ? getItemsInFolder(p, scope) : []) || [])
    .map(n => ({ kind: 'item', node: n, bias: 2 }));
  return folders.concat(sets, items).map((e, i) => { e.seq = i; return e; })
    .sort((a, b) => {
      const ao = typeof a.node.order === 'number' ? a.node.order : 1e9;
      const bo = typeof b.node.order === 'number' ? b.node.order : 1e9;
      if (ao !== bo) return ao - bo;
      if (a.bias !== b.bias) return a.bias - b.bias;
      return a.seq - b.seq;
    });
}

/* ── Moving ────────────────────────────────────────────────── */

let _treeLastMove = null;
let _treeMoveConfirmed = false;   // set while re-entering after the user says yes

/**
 * @param {string[]} ids       nodes to move, in display order
 * @param {string} ns
 * @param {string|null} newParentId
 * @param {string|null} beforeId  insert ahead of this sibling, or append
 * @returns {number} how many actually moved
 */
function treeApplyMove(ids, ns, newParentId, beforeId) {
  _treeNs = ns;
  if (newParentId === TREE_ROOT_ID) newParentId = null;
  const scope = treeScope(ns);
  const host = TREE_HOSTS[ns] || {};
  const moving = ids.filter(id => treeMoveAllowed(id, ns, newParentId));
  if (!moving.length) return 0;

  /* Changing which folder something lives in is asked about first; reordering
     inside the folder it is already in is not, because that is not a change
     you can lose track of. */
  if (host.confirmMove && !_treeMoveConfirmed && typeof showConfirm === 'function') {
    const target = newParentId || null;
    const crossing = moving.some(id => (treeParentOf(id, scope) || null) !== target);
    if (crossing) {
      const what = moving.length === 1 ? `“${treeLabelOf(moving[0], scope)}”` : `${moving.length} items`;
      const where = newParentId ? `“${treeLabelOf(newParentId, scope)}”` : 'the top level';
      showConfirm('Move?', `Move ${what} to ${where}?`, () => {
        _treeMoveConfirmed = true;
        try { treeApplyMove(ids, ns, newParentId, beforeId); } finally { _treeMoveConfirmed = false; }
      });
      return 0;
    }
  }

  // Remember where everything came from, so one Undo puts it all back. The
  // sibling ORDER of both parents is captured too: the move re-indexes them, so
  // restoring only the moved node's own order dropped it back in the right
  // folder but at the wrong position.
  const undo = moving.map(id => {
    const f = treeFind(id, scope);
    return f ? { id, parentId: f.node.parentId || null, order: f.node.order } : null;
  }).filter(Boolean);

  const oldParents = new Set(moving.map(id => treeParentOf(id, scope)));
  const touched = new Set(oldParents);
  touched.add(newParentId || null);
  const orderSnapshot = [];
  touched.forEach(pid => {
    treeChildren(pid, scope).forEach(e => orderSnapshot.push({ id: e.node.id, order: e.node.order, parentId: e.node.parentId || null }));
  });

  // Destination order: current children minus anything being moved, with the
  // dragged rows spliced in at the drop point.
  const dest = treeChildren(newParentId, scope)
    .map(e => e.node.id)
    .filter(id => moving.indexOf(id) === -1);
  let at = beforeId ? dest.indexOf(beforeId) : -1;
  if (at === -1) at = dest.length;
  dest.splice(at, 0, ...moving);
  _treeSetOrder(ns, newParentId || null, scope, dest);

  // Re-index every parent the rows left, or their orders keep the gaps.
  oldParents.forEach(pid => {
    if (pid === (newParentId || null)) return;
    const rest = treeChildren(pid, scope).map(e => e.node.id).filter(id => moving.indexOf(id) === -1);
    if (rest.length) _treeSetOrder(ns, pid || null, scope, rest);
  });

  _treeLastMove = { ns, undo, orderSnapshot };
  if (host.rerender) host.rerender();

  const label = moving.length === 1
    ? treeLabelOf(moving[0], scope)
    : moving.length + ' items';
  const where = newParentId ? treeLabelOf(newParentId, scope) : 'the top level';
  treeAnnounce(`Moved ${label} to ${where}`);
  treeToastUndo(`Moved ${label} to ${where}`);
  return moving.length;
}

function treeLabelOf(id, scope) {
  const f = treeFind(id, scope);
  if (!f) return 'item';
  return f.node.name || f.node.title || 'item';
}

function _treeSetOrder(ns, parentId, scope, ids) {
  const data = _treeData(ns);
  if (data) { data.setOrder(parentId, ids); return; }
  updateTreeOrder(parentId, scope, ids);
}

/** Nothing may enter itself, its own descendants, or a non-folder. */
function treeMoveAllowed(id, ns, newParentId) {
  const host = TREE_HOSTS[ns] || {};
  // A host that consumes drops on this target decides for itself.
  if (newParentId && host.acceptsDrop && host.acceptsDrop(newParentId, id)) return true;
  if (newParentId === TREE_ROOT_ID) newParentId = null;
  const scope = treeScope(ns);
  if (!id || id === TREE_ROOT_ID) return false;     // the pseudo-folder never moves
  if (!newParentId && !treeParentOf(id, scope)) return false;   // already there
  if (host.canMove && !host.canMove(id, treeKindOf(id, scope))) return false;
  // Target-aware veto. The General tree stacks three libraries in one pane, and
  // nothing may cross between them — a snippet cannot become a program.
  if (host.canMoveInto && !host.canMoveInto(id, newParentId)) return false;
  if (!newParentId) return true;
  if (id === newParentId) return false;
  if (treeKindOf(newParentId, scope) !== 'folder') return false;
  if (treeKindOf(id, scope) === 'folder' && treeIsAncestor(id, newParentId, scope)) return false;
  return true;
}

function treeUndoMove() {
  if (!_treeLastMove) return;
  _treeNs = _treeLastMove.ns;
  _treeUndoToast = null;
  const { ns, undo, orderSnapshot } = _treeLastMove;
  const scope = treeScope(ns);
  _treeLastMove = null;
  // Every row of both parents goes back exactly as it was.
  (orderSnapshot || []).forEach(u => {
    const f = treeFind(u.id, scope);
    if (f && !f.pseudo) { f.node.parentId = u.parentId; f.node.order = u.order; }
  });
  undo.forEach(u => {
    const f = treeFind(u.id, scope);
    if (f && !f.pseudo) { f.node.parentId = u.parentId; f.node.order = u.order; }
  });
  const host = TREE_HOSTS[ns] || {};
  // A host with its own store (Brain) must save through it — saveData() writes
  // `state`, so undoing a Brain move looked right until the next reload.
  if (host.save) host.save();
  else if (typeof saveData === 'function') saveData();
  if (host.rerender) host.rerender();
  treeAnnounce('Move undone');
}

/* ── Feedback ──────────────────────────────────────────────── */

/** Screen-reader narration for a move — the tree gives no other signal. */
function treeAnnounce(msg) {
  let live = document.getElementById('tree-live');
  if (!live) {
    live = document.createElement('div');
    live.id = 'tree-live';
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    document.body.appendChild(live);
  }
  live.textContent = msg;
}

/* Only ONE undo is held (_treeLastMove), so only one toast may offer it. Three
   moves used to leave three Undo buttons on screen, and every one of them would
   have undone the most recent move rather than the one it described. */
let _treeUndoToast = null;

function treeToastUndo(msg) {
  if (typeof toast !== 'function') return;
  if (_treeUndoToast && _treeUndoToast.dismiss) {
    try { _treeUndoToast.dismiss(); } catch (e) { /* already gone */ }
  }
  _treeUndoToast = toast(msg, {
    type: 'info',
    duration: 6000,
    action: { label: 'Undo', onClick: treeUndoMove }
  });
}

/* ── Drag lifecycle ────────────────────────────────────────── */

function treeDragStart(e, id, ns) {
  _treeNs = ns;
  const scope = treeScope(ns);
  const host = TREE_HOSTS[ns] || {};
  // Dragging one of a multi-selection moves the whole selection.
  let ids = [id];
  if (host.selectNs && typeof libSelectMode === 'function' &&
      libSelectMode(host.selectNs) && typeof libIsSelected === 'function' && libIsSelected(host.selectNs, id)) {
    const rows = document.querySelectorAll(`[data-tree-ns="${ns}"] .tree-node-row[data-node-id]`);
    ids = Array.from(rows).map(r => r.dataset.nodeId).filter(x => libIsSelected(host.selectNs, x));
    if (ids.indexOf(id) === -1) ids.push(id);
  }
  TDND.ns = ns;
  TDND.ids = ids;
  TDND.kind = treeKindOf(id, scope);
  if (e.dataTransfer) {
    try {
      e.dataTransfer.setData(TREE_MIME, JSON.stringify({ ns, ids }));
      e.dataTransfer.setData('text/plain', id);   // legacy consumers
    } catch (err) { /* older browsers */ }
    e.dataTransfer.effectAllowed = 'move';
  }
  const row = e.currentTarget || e.target;
  if (row && row.classList) row.classList.add('dragging');
  ids.forEach(x => {
    const r = document.querySelector(`[data-tree-ns="${ns}"] .tree-node-row[data-node-id="${x}"]`);
    if (r) r.classList.add('dragging');
  });
  document.body.classList.add('tree-dragging');
}

function treeDragEnd() {
  _treeClearMarks();
  _treeStopSpring();
  _treeStopScroll();
  document.body.classList.remove('tree-dragging');
  TDND.ns = null; TDND.ids = []; TDND.kind = null; TDND.row = null; TDND.zone = null;
}

function _treeClearMarks() {
  document.querySelectorAll('.tree-node-row.dragging, .tree-node-row.drag-over-top, .tree-node-row.drag-over-bottom, .tree-node-row.drag-into, .tree-node-row.drag-deny')
    .forEach(r => r.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom', 'drag-into', 'drag-deny'));
  document.querySelectorAll('.tree-root-drop.drag-into').forEach(r => r.classList.remove('drag-into'));
}

/** Which third of the row is the pointer in? Only folders offer "into". */
function _treeZone(row, clientY, isFolder) {
  const r = row.getBoundingClientRect();
  const y = clientY - r.top;
  if (!isFolder) return y < r.height / 2 ? 'before' : 'after';
  if (y < r.height * 0.25) return 'before';
  if (y > r.height * 0.75) return 'after';
  return 'into';
}

/** The row element for an id, whichever way the event reached us. */
function _treeRowEl(id, ns) {
  return document.querySelector(`[data-tree-ns="${ns}"] .tree-node-row[data-node-id="${id}"]`) ||
         document.querySelector(`.tree-node-row[data-node-id="${id}"]`);
}

function treeDragOver(e, id, ns) {
  if (!TDND.ns || TDND.ns !== ns) return;   // not one of ours
  _treeNs = ns;
  e.preventDefault();
  e.stopPropagation();
  const scope = treeScope(ns);
  const row = _treeRowEl(id, ns);
  if (!row) return;
  const isFolder = treeKindOf(id, scope) === 'folder';
  // The pseudo-folder has no siblings to sit between, so all of it means "into".
  const zone = id === TREE_ROOT_ID ? 'into' : _treeZone(row, e.clientY, isFolder);
  const parentId = zone === 'into' ? id : treeParentOf(id, scope);

  // Passing back over the row you picked up is not an error — it just isn't a
  // move. Refusing it painted the whole gesture red, because that row is under
  // the cursor the instant a drag begins.
  if (TDND.ids.indexOf(id) !== -1) {
    _treeClearHover();
    TDND.row = null; TDND.zone = null;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    _treeStopSpring();
    _treeAutoScroll(ns, e.clientY);
    return;
  }

  const legal = TDND.ids.some(d => treeMoveAllowed(d, ns, parentId));
  _treeClearHover();
  TDND.row = row; TDND.zone = zone;

  if (!legal) {
    row.classList.add('drag-deny');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    _treeStopSpring();
    return;
  }
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  row.classList.add(zone === 'into' ? 'drag-into' : zone === 'before' ? 'drag-over-top' : 'drag-over-bottom');

  // Hover a closed folder for a moment and it opens, so you can reach inside
  // without letting go first.
  if (zone === 'into' && isFolder) _treeSpring(ns, id); else _treeStopSpring();
  _treeAutoScroll(ns, e.clientY);
}

function _treeClearHover() {
  document.querySelectorAll('.tree-node-row.drag-over-top, .tree-node-row.drag-over-bottom, .tree-node-row.drag-into, .tree-node-row.drag-deny')
    .forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-into', 'drag-deny'));
}

function treeDragLeave() { _treeClearHover(); }

function treeDrop(e, id, ns) {
  if (!TDND.ns || TDND.ns !== ns) { treeDragEnd(); return; }
  _treeNs = ns;
  e.preventDefault();
  e.stopPropagation();
  const scope = treeScope(ns);
  const row = _treeRowEl(id, ns);
  if (!row) { treeDragEnd(); return; }
  const isFolder = treeKindOf(id, scope) === 'folder';
  const zone = id === TREE_ROOT_ID ? 'into' : _treeZone(row, e.clientY, isFolder);
  const ids = TDND.ids.slice();
  treeDragEnd();
  if (ids.indexOf(id) !== -1) return;      // dropped on itself

  if (zone === 'into') {
    const host = TREE_HOSTS[ns] || {};
    // Favourites is a view, not a folder — the host stars the items instead.
    if (host.onDropInto && host.onDropInto(id, ids) === true) return;
    treeApplyMove(ids, ns, id, null);
    return;
  }
  const parentId = treeParentOf(id, scope);
  const sibs = treeChildren(parentId, scope).map(x => x.node.id).filter(x => ids.indexOf(x) === -1);
  const at = sibs.indexOf(id);
  const beforeId = zone === 'before' ? id : (at === -1 ? null : sibs[at + 1] || null);
  treeApplyMove(ids, ns, parentId, beforeId);
}

/* ── Spring-loaded folders ─────────────────────────────────── */

function _treeSpring(ns, folderId) {
  if (TDND.springId === folderId) return;
  _treeStopSpring();
  TDND.springId = folderId;
  TDND.springTimer = setTimeout(() => {
    const host = TREE_HOSTS[ns] || {};
    if (host.expand) host.expand(folderId);
  }, TREE_SPRING_MS);
}

function _treeStopSpring() {
  if (TDND.springTimer) clearTimeout(TDND.springTimer);
  TDND.springTimer = null;
  TDND.springId = null;
}

/* ── Auto-scroll ───────────────────────────────────────────── */

function _treeAutoScroll(ns, clientY) {
  const host = TREE_HOSTS[ns] || {};
  const el = host.container ? document.querySelector(host.container) : null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  let dir = 0;
  if (clientY < r.top + TREE_EDGE_PX) dir = -1;
  else if (clientY > r.bottom - TREE_EDGE_PX) dir = 1;
  TDND.scroller = el;
  if (dir === TDND.scrollDir) return;
  TDND.scrollDir = dir;
  if (!dir) { _treeStopScroll(); return; }
  if (TDND.scrollRAF) return;
  const step = () => {
    if (!TDND.scrollDir || !TDND.scroller) { TDND.scrollRAF = 0; return; }
    TDND.scroller.scrollTop += TDND.scrollDir * 12;
    TDND.scrollRAF = requestAnimationFrame(step);
  };
  TDND.scrollRAF = requestAnimationFrame(step);
}

function _treeStopScroll() {
  if (TDND.scrollRAF) cancelAnimationFrame(TDND.scrollRAF);
  TDND.scrollRAF = 0; TDND.scrollDir = 0; TDND.scroller = null;
}

/* ── Touch ─────────────────────────────────────────────────────
   HTML5 drag-and-drop does not exist on touch, so the whole tree was
   immovable on a tablet. Long-press a row to pick it up, then the same zone
   rules apply under the finger. */

document.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  const row = e.target.closest && e.target.closest('.tree-node-row[data-node-id]');
  if (!row) return;
  const holder = row.closest('[data-tree-ns]');
  if (!holder) return;
  const ns = holder.dataset.treeNs;
  const id = row.dataset.nodeId;
  TDND.touch = { id, ns, row, x: e.clientX, y: e.clientY, active: false, timer: setTimeout(() => {
    TDND.touch.active = true;
    treeDragStart({ currentTarget: row, dataTransfer: null }, id, ns);
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* unsupported */ } }
  }, TREE_TOUCH_HOLD_MS) };
}, { passive: true });

document.addEventListener('pointermove', (e) => {
  const t = TDND.touch;
  if (!t) return;
  if (!t.active) {
    // Moved before the hold elapsed — that's a scroll, not a drag.
    if (Math.abs(e.clientX - t.x) > 8 || Math.abs(e.clientY - t.y) > 8) {
      clearTimeout(t.timer); TDND.touch = null;
    }
    return;
  }
  e.preventDefault();
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const row = el && el.closest && el.closest('.tree-node-row[data-node-id]');
  if (!row) { _treeClearHover(); return; }
  treeDragOver({
    preventDefault() {}, stopPropagation() {},
    currentTarget: row, clientY: e.clientY, dataTransfer: null
  }, row.dataset.nodeId, t.ns);
}, { passive: false });

document.addEventListener('pointerup', (e) => {
  const t = TDND.touch;
  if (!t) return;
  clearTimeout(t.timer);
  TDND.touch = null;
  if (!t.active) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const row = el && el.closest && el.closest('.tree-node-row[data-node-id]');
  if (row) {
    treeDrop({ preventDefault() {}, stopPropagation() {}, currentTarget: row, clientY: e.clientY }, row.dataset.nodeId, t.ns);
  } else {
    treeDragEnd();
  }
});

/* Only a TOUCH drag is torn down here.
   Starting a native HTML5 drag cancels the pointer sequence by design, so the
   browser fires pointercancel the instant any mouse drag begins. Ending the
   drag on that cleared TDND.ns before the first dragover, so treeDragOver bailed
   on its guard, never called preventDefault, and the browser concluded nothing
   was a drop target — the "not allowed" cursor over the whole tree, and no drop
   ever landed. */
document.addEventListener('pointercancel', () => {
  if (!TDND.touch) return;
  clearTimeout(TDND.touch.timer);
  TDND.touch = null;
  treeDragEnd();
});

/* ── Row attributes ────────────────────────────────────────────
   One helper so every tree emits the same drag wiring and the same ARIA. */

/**
 * @param {object} o .ns .id .kind ('folder'|'item'|'set') .level .expanded .selected
 *   .draggable pass false for a row that must not be picked up (the
 *     Uncategorized pseudo-folder). A second draggable attribute after this
 *     helper is simply ignored by the parser, so it has to be an option.
 *   .dragStart optional replacement for the ondragstart call. The Visualize
 *   sidebar needs its own, because those rows are draggable two ways at once
 *   (onto the canvas to place a node, and within the tree to reorganise) and a
 *   second ondragstart attribute would simply be ignored by the parser.
 */
function treeRowAttrs(o) {
  const isFolder = o.kind === 'folder';
  return `data-node-id="${o.id}" draggable="${o.draggable === false ? 'false' : 'true'}"` +
    ` role="treeitem" aria-level="${(o.level || 0) + 1}"` +
    (isFolder ? ` aria-expanded="${!!o.expanded}"` : '') +
    (o.selected ? ' aria-selected="true"' : '') +
    ` ondragstart="${o.dragStart || `treeDragStart(event, '${o.id}', '${o.ns}')`}"` +
    ` ondragend="treeDragEnd(event)"` +
    // Rows carry their own dragover/drop again. Relying only on the document
    // delegation meant a real drag produced one dragover and then dragend: the
    // delegated listener never got to call preventDefault, so the browser
    // decided nothing on the page was a drop target and painted the whole
    // gesture "not allowed". The delegation is still there for the gaps BETWEEN
    // rows, which is what it was added for.
    ` ondragover="treeDragOver(event, '${o.id}', '${o.ns}')"` +
    ` ondrop="treeDrop(event, '${o.id}', '${o.ns}')"`;
}

/* ── Committing a tree's markup ─────────────────────────────────────────────
   SELECTION IS NOT MARKUP. It used to be: every renderer baked `active` and
   aria-selected into the HTML string and then replaced the whole tree with
   `container.innerHTML = html` on each click. That is why selecting a row had
   no animation whatsoever. The row you clicked was not a row that changed
   state -- it was a brand new element created already active, so its
   transitions had nothing to transition FROM, and the row you left was
   destroyed outright, so it could not fade out. The CSS was correct the whole
   time and simply never got the chance to run.

   So the markup carries structure only, and selection is a class applied after.
   When a click changes nothing but which row is selected the generated string
   is identical, the DOM is left alone, and toggling the class lets the existing
   transitions play in both directions. A real structural change -- expanding a
   folder, renaming, adding -- still writes, because then the string differs.

   Keyed on the container so several trees can be live at once. WeakMap, so a
   container that goes away takes its entry with it. */
const _treeMarkup = new WeakMap();

/**
 * Write `html` into `container` only if it differs from what is already there,
 * then mark `selectedId` as the selected row.
 *
 * Returns true when the DOM was actually rebuilt, so callers can skip
 * re-running icon rendering over markup that never changed.
 */
function treeCommit(container, html, selectedId) {
  const rebuilt = _treeMarkup.get(container) !== html || !container.firstChild;
  if (rebuilt) {
    container.innerHTML = html;
    _treeMarkup.set(container, html);
  }
  treeApplySelection(container, selectedId);
  return rebuilt;
}

/**
 * Record markup as current without writing it.
 *
 * For the renderers that change the DOM by hand -- the expand toggles animate
 * in place rather than re-rendering -- so the cache keeps describing what is
 * actually on screen and the next commit can still skip the write.
 */
function treeSyncMarkup(container, html) {
  _treeMarkup.set(container, html);
}

/** The one place a tree row becomes selected. */
function treeApplySelection(container, selectedId) {
  container.querySelectorAll('.tree-node-row').forEach(row => {
    const on = selectedId != null && row.dataset.nodeId === String(selectedId);
    row.classList.toggle('active', on);
    if (on) row.setAttribute('aria-selected', 'true');
    else row.removeAttribute('aria-selected');
  });
}

/** The always-present drop target under a tree that means "top level". */
function treeRootDropHTML(ns) {
  return `<div class="tree-root-drop" data-tree-root="${ns}">
       <i data-lucide="corner-left-up" style="width:13px;height:13px;"></i> Drop here to move to the top level
     </div>`;
}

/* ── Right-click menu ──────────────────────────────────────────
   Renaming, moving and deleting a node all lived somewhere else on the page.
   The Visualize sidebar keeps its own menu (vizContentCtx) and is not wired
   to this one. */

function treeCloseMenu() {
  const m = document.getElementById('tree-ctx');
  if (m) m.remove();
  document.removeEventListener('mousedown', _treeMenuOutside, true);
  document.removeEventListener('keydown', _treeMenuKey, true);
}

function _treeMenuOutside(e) {
  const m = document.getElementById('tree-ctx');
  if (m && !m.contains(e.target)) treeCloseMenu();
}

function _treeMenuKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); treeCloseMenu(); }
}

function treeContextMenu(e, id, ns) {
  _treeNs = ns;
  e.preventDefault();
  e.stopPropagation();
  treeCloseMenu();
  const scope = treeScope(ns);
  const host = TREE_HOSTS[ns] || {};
  const found = treeFind(id, scope);
  if (!found) return;
  const isFolder = found.kind === 'folder';

  const actions = [];
  if (found.pseudo) {
    // Uncategorized is a view of parentId: null, not a node — there is nothing
    // to rename, move or delete. It can be expanded, and it can be switched to
    // show favourites instead, which is just as much a view over the data.
    //
    // `id`, not TREE_ROOT_ID: General's three library headings are pseudo rows
    // too, and hardcoding the root id made their menu report and toggle the
    // wrong row.
    actions.push({
      icon: 'chevrons-up-down',
      label: (host.isExpanded && host.isExpanded(id)) ? 'Collapse' : 'Expand',
      fn: () => { if (host.toggle) host.toggle(id); }
    });
    if (host.pseudoActions) (host.pseudoActions(id) || []).forEach(a => actions.push(a));
    if (id === TREE_ROOT_ID && host.selectNs && typeof libRootMeta === 'function') {
      actions.push({ sep: true });
      actions.push({
        icon: libRootMode(host.selectNs) === 'favorites' ? 'inbox' : 'star',
        label: libRootMeta(host.selectNs).next,
        fn: () => libCycleRootMode(host.selectNs)
      });
    }
    _treeShowMenu(e, actions);
    return;
  }
  if (host.onRename) actions.push({ icon: 'pencil', label: 'Rename', fn: () => host.onRename(id, found.kind) });
  actions.push({ icon: 'folder-input', label: 'Move to…', fn: () => treeMovePrompt(id, ns) });
  // Anything only this tree can offer (duplicate, share, pin, compare…).
  if (host.extraActions) (host.extraActions(id, found.kind) || []).forEach(a => actions.push(a));
  if (isFolder && host.onNewSubfolder) {
    actions.push({ icon: 'folder-plus', label: 'New subfolder', fn: () => host.onNewSubfolder(id) });
  }
  if (treeParentOf(id, scope)) {
    actions.push({ icon: 'corner-left-up', label: 'Move to top level', fn: () => treeApplyMove([id], ns, null, null) });
  }
  if (host.onDelete) {
    actions.push({ sep: true });
    actions.push({ icon: 'trash-2', label: 'Delete', danger: true, fn: () => host.onDelete(id, found.kind) });
  }

  _treeShowMenu(e, actions);
}

/**
 * Build and place the right-click menu.
 *
 * Placement used to be one line: clamp top to innerHeight - height - 8. That is
 * fine until the menu is taller than the viewport, at which point the clamp
 * produces a NEGATIVE top and the first rows sit above the screen, unreachable
 * -- measured at top: -177px with six rows off the top edge. The menu never
 * scrolled, so there was no way to get to them at all.
 *
 * So: measure the natural height, then pick a placement. Open downward if it
 * fits; flip above the cursor if it fits better there; if it fits on screen
 * but not beside the cursor, slide it up until it does; and only when it is
 * taller than the screen itself give it a max-height and let the list scroll.
 */
function _treeShowMenu(e, actions) {
  const menu = document.createElement('div');
  menu.id = 'tree-ctx';
  menu.className = 'tree-ctx';
  menu.setAttribute('role', 'menu');

  /* The rows live in their own scroller so the fades, which mark that there is
     more above or below, can sit still over the top of it. */
  const scroll = document.createElement('div');
  scroll.className = 'tree-ctx-scroll';
  scroll.innerHTML = actions.map((a, i) => a.sep
    ? '<div class="tree-ctx-sep"></div>'
    : `<button class="tree-ctx-item${a.danger ? ' danger' : ''}" role="menuitem" data-i="${i}">
         <i data-lucide="${a.icon}"></i><span class="tree-ctx-label">${a.label}</span>
       </button>`).join('');
  menu.appendChild(scroll);
  document.body.appendChild(menu);
  // Before measuring, not after: the height being measured has to be the height
  // the user will see.
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: menu });

  const GAP = 8;                                   // never touch the screen edge
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = menu.offsetWidth;
  const natural = menu.offsetHeight;               // layout box, so the open
                                                   // animation's scale() is not
                                                   // in the number
  const below = vh - e.clientY - GAP;
  const above = e.clientY - GAP;

  let top;
  if (natural <= below) {
    top = e.clientY;                               // the usual case
  } else if (natural <= above) {
    top = e.clientY - natural;                     // more room upward: flip it
  } else if (natural <= vh - GAP * 2) {
    /* Taller than the room on either side of the cursor, but not taller than
       the screen. Slide it up until it fits rather than scrolling: on a 360px
       viewport this is the difference between all eight rows showing and eight
       rows crammed into the 172px beside the cursor. */
    top = vh - natural - GAP;
  } else {
    // Genuinely taller than the screen. Use the whole height and scroll.
    top = GAP;
    menu.style.maxHeight = (vh - GAP * 2) + 'px';
  }
  menu.style.left = Math.max(GAP, Math.min(e.clientX, vw - w - GAP)) + 'px';
  menu.style.top = Math.max(GAP, top) + 'px';

  /* Which fade is lit. Without a scrollbar this is the only thing saying there
     is more, so it has to track the scroll rather than being set once. The 2px
     slack keeps the bottom fade from flickering on a fractional scrollHeight. */
  const syncFades = () => {
    const more = scroll.scrollHeight - scroll.clientHeight;
    menu.classList.toggle('can-up', scroll.scrollTop > 2);
    menu.classList.toggle('can-down', more > 2 && scroll.scrollTop < more - 2);
  };
  scroll.addEventListener('scroll', syncFades, { passive: true });
  syncFades();

  menu.querySelectorAll('.tree-ctx-item').forEach(btn => {
    btn.onclick = () => { const a = actions[+btn.dataset.i]; treeCloseMenu(); if (a && a.fn) a.fn(); };
    /* A tooltip only where one is earned. Labels are clipped rather than
       wrapped, so a long one needs a title to stay readable -- but putting a
       title on every row means a tooltip pops up over a menu whose labels are
       already fully visible. Ask the layout which ones actually overflow. */
    const label = btn.querySelector('.tree-ctx-label');
    if (label && label.scrollWidth > label.clientWidth + 1) btn.title = label.textContent.trim();
  });
  document.addEventListener('mousedown', _treeMenuOutside, true);
  document.addEventListener('keydown', _treeMenuKey, true);
}

/**
 * Right-click on the empty part of a tree. Hosts put their creation actions
 * here instead of stacking full-width buttons above the list.
 */
function treePaneContextMenu(e, ns) {
  const host = TREE_HOSTS[ns] || {};
  if (!host.paneActions) return;
  // A row has its own menu; only the background belongs to this one.
  if (e.target.closest && e.target.closest('.tree-node-row')) return;
  e.preventDefault();
  e.stopPropagation();
  _treeNs = ns;
  treeCloseMenu();
  const actions = host.paneActions() || [];
  if (actions.length) _treeShowMenu(e, actions);
}

/** "Move to…" — every folder in this tree, as a pickable list. */
function treeMovePrompt(id, ns) {
  _treeNs = ns;
  const scope = treeScope(ns);
  treeCloseMenu();
  const options = [{ id: '', label: 'Top level', depth: 0 }];
  (function walk(parentId, depth) {
    treeChildren(parentId, scope).forEach(e => {
      if (e.kind !== 'folder') return;
      if (e.node.id === id || treeIsAncestor(id, e.node.id, scope)) return;   // no cycles
      options.push({ id: e.node.id, label: e.node.name, depth });
      walk(e.node.id, depth + 1);
    });
  })(null, 1);

  const overlay = document.createElement('div');
  overlay.id = 'tree-move-dlg';
  overlay.className = 'modal-overlay fd-overlay';
  overlay.innerHTML = `
    <div class="modal-content fd-box" role="dialog" aria-modal="true" aria-label="Move to folder">
      <h3 class="fd-title"><i data-lucide="folder-input"></i> Move “${escapeHTML(treeLabelOf(id, scope))}” to…</h3>
      <div class="tree-move-list">
        ${options.map(o => `<button class="tree-move-opt" data-id="${o.id}" style="padding-left:${0.7 + o.depth * 0.8}rem;">
            <i data-lucide="${o.id ? 'folder' : 'corner-left-up'}" style="width:14px;height:14px;"></i> ${escapeHTML(o.label)}
          </button>`).join('')}
      </div>
      <div class="fd-actions"><button class="btn btn-secondary btn-sm" id="tree-move-cancel">Cancel</button></div>
    </div>`;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  const close = () => overlay.remove();
  overlay.querySelector('#tree-move-cancel').onclick = close;
  overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });
  overlay.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
  overlay.querySelectorAll('.tree-move-opt').forEach(btn => {
    btn.onclick = () => { close(); treeApplyMove([id], ns, btn.dataset.id || null, null); };
  });
  const first = overlay.querySelector('.tree-move-opt');
  if (first) first.focus();
}

/* ── The whole pane is a drop surface ──────────────────────────
   dragover/drop are delegated from the document rather than bound per row.
   With per-row handlers, every pixel that was NOT a row — the indent gutter to
   the left of each label, the gap between rows, the margin, the background —
   never called preventDefault, and the browser answers that with the "not
   allowed" cursor. Most of a tree pane is not a row, so dragging looked
   blocked almost everywhere.

   Anywhere inside a registered tree that isn't a row now means "the top
   level", which is also what the strip at the bottom says. */

function _treeHolder(target) {
  return target && target.closest ? target.closest('[data-tree-ns]') : null;
}

document.addEventListener('dragover', (e) => {
  if (!TDND.ns) return;
  const holder = _treeHolder(e.target);
  if (!holder || holder.dataset.treeNs !== TDND.ns) return;
  const row = e.target.closest('.tree-node-row[data-node-id]');
  if (row) { treeDragOver(e, row.dataset.nodeId, TDND.ns); return; }

  // Not on a row: offer the top level.
  e.preventDefault();
  const legal = TDND.ids.some(d => treeMoveAllowed(d, TDND.ns, null));
  if (e.dataTransfer) e.dataTransfer.dropEffect = legal ? 'move' : 'none';
  _treeClearHover();
  const strip = holder.querySelector('.tree-root-drop');
  if (strip) strip.classList.toggle('drag-into', legal);
  TDND.row = null;
  TDND.zone = 'root';
  _treeStopSpring();
  _treeAutoScroll(TDND.ns, e.clientY);
}, false);

document.addEventListener('drop', (e) => {
  if (!TDND.ns) return;
  const holder = _treeHolder(e.target);
  if (!holder || holder.dataset.treeNs !== TDND.ns) { treeDragEnd(); return; }
  const row = e.target.closest('.tree-node-row[data-node-id]');
  if (row) { treeDrop(e, row.dataset.nodeId, TDND.ns); return; }
  e.preventDefault();
  const ids = TDND.ids.slice();
  treeDragEnd();
  treeApplyMove(ids, holder.dataset.treeNs, null, null);
}, false);

/* A drag that ends anywhere else — another pane, outside the window — must not
   leave the tree stuck in its dragging state. */
document.addEventListener('dragend', () => { if (TDND.ns) treeDragEnd(); }, false);

/* Dragging out of a tree left the last hovered row still marked until the drop.
   relatedTarget is where the pointer went; outside the tree means clear. */
document.addEventListener('dragleave', (e) => {
  if (!TDND.ns) return;
  const from = _treeHolder(e.target);
  if (!from || from.dataset.treeNs !== TDND.ns) return;
  const to = e.relatedTarget && e.relatedTarget.closest ? _treeHolder(e.relatedTarget) : null;
  if (to === from) return;                 // still inside this tree
  treeDragLeave();
  const strip = from.querySelector('.tree-root-drop');
  if (strip) strip.classList.remove('drag-into');
  _treeStopSpring();
  _treeStopScroll();
}, false);


/* -- Long names ------------------------------------------------
   A name wider than the pane got an ellipsis and no way to read the rest: the
   rows carry no title attribute, so the only way to see the end of "10 -
   Functions and recursion" in a narrow tree was to drag the pane wider.

   Hovering the row scrolls its label instead. The measuring has to happen in
   JS -- how far to travel is per label -- but it happens once per hover on one
   element, not for every row on every render, which would be sixty forced
   layouts each time the tree redraws.

   The row is the trigger, not the label: the label is only part of the row's
   width, and hovering the badge or the icon is still hovering the name. */
const LABEL_SCROLL_SPEED = 55;    // px per second, whatever the name's length
const LABEL_SCROLL_LEG = 0.35;    // share of the cycle spent travelling, per leg

function _treeReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function _treeLabelStart(row) {
  const el = row.querySelector('.tree-node-label');
  // dataset.fits caches "measured, does not overflow" for the length of this
  // hover. Without it every mousemove inside the row re-reads scrollWidth,
  // which forces a layout on each one.
  if (!el || el.classList.contains('is-scrolling') || el.dataset.fits) return;

  const dist = el.scrollWidth - el.clientWidth;
  if (dist <= 1) { el.dataset.fits = '1'; return; }

  if (_treeReducedMotion()) {
    // Motion is the wrong answer here, but the name still has to be readable.
    if (!el.title) el.title = el.textContent.trim();
    el.dataset.fits = '1';
    return;
  }

  /* The text gets a wrapper to move, and only while it is moving. Idle labels
     keep the markup their renderer wrote, ellipsis and all. innerHTML rather
     than textContent because one caller (the library root heading) puts markup
     in the label. */
  const inner = document.createElement('span');
  inner.className = 'tree-label-run';
  inner.innerHTML = el.innerHTML;
  el.textContent = '';
  el.appendChild(inner);

  // A couple of pixels past the end so the last glyph clears the edge.
  const travel = Math.min(Math.max(dist / LABEL_SCROLL_SPEED, 1), 12);
  el.style.setProperty('--label-scroll-dist', -(dist + 2) + 'px');
  el.style.setProperty('--label-scroll-time', (travel / LABEL_SCROLL_LEG).toFixed(2) + 's');
  el.classList.add('is-scrolling');
}

function _treeLabelStop(row) {
  const el = row.querySelector('.tree-node-label');
  if (!el) return;
  el.classList.remove('is-scrolling');
  const inner = el.querySelector(':scope > .tree-label-run');
  if (inner) el.innerHTML = inner.innerHTML;   // put the label back as it was
  el.style.removeProperty('--label-scroll-dist');
  el.style.removeProperty('--label-scroll-time');
  // Dropped rather than kept: the pane can be resized between hovers, and a
  // stale "it fits" would leave the name unreadable with no way to retry.
  delete el.dataset.fits;
}

document.addEventListener('mouseover', (e) => {
  const row = e.target.closest && e.target.closest('.tree-node-row');
  if (row) _treeLabelStart(row);
}, true);

document.addEventListener('mouseout', (e) => {
  const row = e.target.closest && e.target.closest('.tree-node-row');
  if (!row) return;
  // mouseout also fires moving between children of the same row; that is not
  // leaving it.
  if (e.relatedTarget && row.contains(e.relatedTarget)) return;
  _treeLabelStop(row);
}, true);

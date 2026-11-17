/* ============================================================
   VIZ-SELECT.JS — The select tool, and menus that act on many
   ------------------------------------------------------------
   A toggle in the canvas toolbar's Edit tab (and V). While it is on, a
   left-drag on empty canvas draws a blue box and selects what it touches
   (Shift adds to the selection), a click on a node adds it or takes it out,
   and nodes cannot be dragged. Space + drag, the middle button or two
   fingers pan; the wheel still zooms. Esc clears the selection, a second
   Esc turns the tool off. Link and Paint modes and this one exclude each
   other.

   Both canvases: the library map keeps its selection in viz.selectedNodeIds
   (it already had Shift-click and a Shift-drag box), Brain in
   brain.selectedNodeIds. Right-clicking a node that is part of a selection
   of two or more opens the menu for all of them (the "N notes" line at its
   top says so, and the actions that only make sense for one hide);
   right-clicking a node outside it selects just that node, as in Windows
   Explorer.
   ============================================================ */

/** Space held on the canvas page: a drag pans, even with the select tool on. */
let _vizSpaceHeld = false;

function vizToggleSelectMode(force) {
  const on = typeof force === 'boolean' ? force : !viz.selectMode;
  if (on === !!viz.selectMode) return;
  viz.selectMode = on;
  if (on) {
    // One click-mode at a time: Link and Paint go off.
    if (viz.activeModule === 'brain') {
      if (brain.linkModeEnabled) brainToggleLinkMode();
      if (brain.linkingFrom) brainCancelLinking();
    } else {
      if (viz.linkModeEnabled) vizToggleLinkMode();
      if (viz.linkingFrom) vizCancelLinking();
    }
    if (viz.colorModeEnabled) vizToggleColorMode();
  }
  vizPaintSelectMode();
}

/** The button and the canvas cursor follow the switch. */
function vizPaintSelectMode() {
  const btn = document.getElementById('viz-select-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', !!viz.selectMode);
    btn.setAttribute('aria-pressed', String(!!viz.selectMode));
  }
  const c = document.getElementById('viz-canvas-container');
  if (c) c.classList.toggle('select-mode', !!viz.selectMode);
}

function _vizSpaceTarget(e) {
  if (document.body.dataset.route !== 'visualization') return false;
  const t = e.target;
  // A focused field or button keeps its own Space.
  return !(t && t.closest && t.closest('input, textarea, select, button, [contenteditable="true"]'));
}
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || !_vizSpaceTarget(e)) return;
  if (viz.selectMode) e.preventDefault();   // not a page scroll
  if (_vizSpaceHeld) return;
  _vizSpaceHeld = true;
  const c = document.getElementById('viz-canvas-container');
  if (c) c.classList.add('space-pan');
});
document.addEventListener('keyup', e => {
  if (e.code !== 'Space') return;
  _vizSpaceHeld = false;
  const c = document.getElementById('viz-canvas-container');
  if (c) c.classList.remove('space-pan');
});
window.addEventListener('blur', () => {
  _vizSpaceHeld = false;
  const c = document.getElementById('viz-canvas-container');
  if (c) c.classList.remove('space-pan');
});

/** Does this press pan rather than draw a box? Middle button, or Space held. */
function vizPanPress(e) {
  return e.button === 1 || _vizSpaceHeld;
}

/* ── Brain: the selection ──────────────────────────────────────── */

/** Mark every selected note without redrawing the canvas. */
function brainPaintSelection() {
  document.querySelectorAll('#viz-nodes-layer > .viz-node[data-node-id]').forEach(el => {
    const id = el.dataset.nodeId;
    el.classList.toggle('selected', id === brain.selectedNodeId || brain.selectedNodeIds.has(id));
    el.classList.toggle('in-group', brain.selectedNodeIds.has(id));   // the group's blue ring
  });
  vizUpdateSelectionChip();
}

/** A click with the select tool (or Shift/Ctrl): the note joins the selection or leaves it. */
function brainToggleInSelection(nodeId) {
  const set = brain.selectedNodeIds;
  // A note selected by a plain click becomes part of the group.
  if (!set.size && brain.selectedNodeId && brain.selectedNodeId !== nodeId) set.add(brain.selectedNodeId);
  if (set.has(nodeId)) set.delete(nodeId); else set.add(nodeId);
  brain.selectedNodeId = set.has(nodeId) ? nodeId : ([...set][0] || null);
  brainPaintSelection();
}

function brainClearSelection() {
  brain.selectedNodeIds.clear();
  brain.selectedNodeId = null;
  brainPaintSelection();
}

function brainSelectAll() {
  brain.selectedNodeIds = new Set(brain.nodes.map(n => n.id));
  brain.selectedNodeId = brain.nodes.length ? brain.nodes[0].id : null;
  brainPaintSelection();
}

/* The box. Sizes are read once when it starts (nothing moves while it is
   drawn), so dragging it costs one style write per frame. */
function brainMarqueeStart(e) {
  const c = document.getElementById('viz-canvas-container');
  if (!c) return;
  const r = c.getBoundingClientRect();
  const x = (e.clientX - r.left - brain.pan.x) / brain.zoom;
  const y = (e.clientY - r.top - brain.pan.y) / brain.zoom;
  const rects = [];
  document.querySelectorAll('#viz-nodes-layer > .viz-node[data-node-id]').forEach(el => {
    const n = brain.nodes.find(m => m.id === el.dataset.nodeId);
    if (n) rects.push({ id: n.id, x: n.x, y: n.y, w: el.offsetWidth, h: el.offsetHeight, el });
  });
  brain.marquee = { x0: x, y0: y, x1: x, y1: y, sx: e.clientX, sy: e.clientY, add: e.shiftKey, rects };
}

function _brainMarqueeHits(m) {
  const x = Math.min(m.x0, m.x1), y = Math.min(m.y0, m.y1);
  const w = Math.abs(m.x1 - m.x0), h = Math.abs(m.y1 - m.y0);
  return m.rects.filter(b => b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y);
}

function _brainPaintMarquee() {
  const m = brain.marquee;
  const layer = document.getElementById('viz-nodes-layer');
  let el = document.getElementById('viz-marquee');
  if (!m || !layer) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'viz-marquee';
    el.className = 'viz-marquee';
    layer.appendChild(el);
  }
  el.style.left = Math.min(m.x0, m.x1) + 'px';
  el.style.top = Math.min(m.y0, m.y1) + 'px';
  el.style.width = Math.abs(m.x1 - m.x0) + 'px';
  el.style.height = Math.abs(m.y1 - m.y0) + 'px';
  const hit = new Set(_brainMarqueeHits(m).map(b => b.id));
  m.rects.forEach(b => b.el.classList.toggle('viz-marquee-hit', hit.has(b.id)));
}

function brainMarqueeMove(e) {
  const m = brain.marquee;
  const c = document.getElementById('viz-canvas-container');
  if (!m || !c) return;
  const r = c.getBoundingClientRect();
  m.x1 = (e.clientX - r.left - brain.pan.x) / brain.zoom;
  m.y1 = (e.clientY - r.top - brain.pan.y) / brain.zoom;
  vizSchedulePaint(_brainPaintMarquee);
}

function brainMarqueeEnd(e) {
  const m = brain.marquee;
  brain.marquee = null;
  if (typeof vizCancelScheduledPaint === 'function') vizCancelScheduledPaint();
  _brainPaintMarquee();
  if (!m) return;
  m.rects.forEach(b => b.el.classList.remove('viz-marquee-hit'));
  // A press that did not move is a click on empty canvas: it clears.
  const moved = e && (Math.abs(e.clientX - m.sx) > 4 || Math.abs(e.clientY - m.sy) > 4);
  const hits = moved ? _brainMarqueeHits(m).map(b => b.id) : [];
  if (!m.add) brain.selectedNodeIds = new Set(hits);
  else hits.forEach(id => brain.selectedNodeIds.add(id));
  const first = [...brain.selectedNodeIds][0];
  brain.selectedNodeId = brain.selectedNodeIds.has(brain.selectedNodeId) ? brain.selectedNodeId : (first || null);
  brainPaintSelection();
}

/* ── Menus that act on every selected node ─────────────────────── */

/** The notes a Brain menu action applies to. */
function brainCtxTargets() {
  const id = brain.contextNodeId;
  if (id && brain.selectedNodeIds.size > 1 && brain.selectedNodeIds.has(id)) {
    return brain.nodes.filter(n => brain.selectedNodeIds.has(n.id));
  }
  const n = id && brain.nodes.find(x => x.id === id);
  return n ? [n] : [];
}

/** The nodes a library-map menu action applies to. */
function vizCtxTargets() {
  const id = viz.contextNodeId;
  if (id && viz.selectedNodeIds.size > 1 && viz.selectedNodeIds.has(id)) {
    return viz.nodes.filter(n => viz.selectedNodeIds.has(n.id));
  }
  const n = id && viz.nodes.find(x => x.id === id);
  return n ? [n] : [];
}

/**
 * Run a one-note menu action once per selected note, as ONE edit: the first
 * change banks the only undo step, and the canvas is drawn and saved once at
 * the end (brainPushUndo / brainRenderCanvas / brainSaveCurrentVersion all
 * honour brain._batch). Returns false when there is no selection to act on,
 * and the caller carries on with its single note.
 */
function brainForEachTarget(fn) {
  if (brain._batch) return false;
  const targets = brainCtxTargets();
  if (targets.length < 2) return false;
  const keep = brain.contextNodeId;
  brain._batch = true;
  brain._batchPushed = false;
  try {
    targets.forEach(n => { brain.contextNodeId = n.id; fn(n); });
  } finally {
    brain._batch = false;
    brain.contextNodeId = keep;
  }
  if (brain._batchPushed) { brainRenderCanvas(); brainSaveCurrentVersion(); }
  brain._batchPushed = false;
  return true;
}

/** Right-click: settle what the menu is for, and say so at its top. */
function brainCtxPrepare(nodeId) {
  if (brain.selectedNodeIds.size && !brain.selectedNodeIds.has(nodeId)) {
    brain.selectedNodeIds.clear();
    brain.selectedNodeId = nodeId;
    brainPaintSelection();
  }
  _vizCtxMultiLine('brain-node-ctx', 'brain-ctx-multi', brainCtxTargets().length, 'notes');
}

function vizCtxPrepare(nodeId) {
  if (viz.selectedNodeIds.size && !viz.selectedNodeIds.has(nodeId)) {
    viz.selectedNodeIds.clear();
    viz.selectedNodeId = nodeId;
    vizRenderCanvas();
    vizUpdateSelectionChip();
  }
  const n = vizCtxTargets().length;
  _vizCtxMultiLine('viz-node-ctx', 'viz-ctx-multi', n, 'nodes');
  return n;
}

function _vizCtxMultiLine(menuId, lineId, count, noun) {
  const menu = document.getElementById(menuId);
  const line = document.getElementById(lineId);
  if (menu) menu.classList.toggle('is-multi', count > 1);
  if (line) {
    line.classList.toggle('hidden', count < 2);
    if (count > 1) line.textContent = count + ' ' + noun + ' selected · changes apply to all';
  }
}

/** Delete key / menu: every selected note goes, asked about once. */
function brainDeleteTargets(targets) {
  if (!targets.length) return;
  if (targets.length === 1) { brainDeleteNode(targets[0].id); return; }
  const ids = new Set(targets.map(n => n.id));
  const go = () => {
    brainPushUndo();
    brain.nodes = brain.nodes.filter(n => !ids.has(n.id));
    brain.links = brain.links.filter(l => !ids.has(l.from) && !ids.has(l.to));
    brain.selectedNodeIds.clear();
    brain.selectedNodeId = null;
    if (brain._focusedParentId && ids.has(brain._focusedParentId)) brain._focusedParentId = null;
    brainRenderCanvas(); brainSaveCurrentVersion();
    vizUpdateSelectionChip();
  };
  const dirs = typeof brainDirGuardsDelete === 'function' ? targets.filter(n => brainDirGuardsDelete(n)).length : 0;
  if (dirs && typeof showConfirm === 'function') {
    showConfirm('Delete ' + targets.length + ' notes?',
      dirs + (dirs === 1 ? ' of them is a directory' : ' of them are directories') + '; the canvases inside go with them.', go);
  } else go();
}

function brainDeleteSelection() {
  if (brain.selectedNodeIds.size > 1) {
    brainDeleteTargets(brain.nodes.filter(n => brain.selectedNodeIds.has(n.id)));
  } else if (brain.selectedNodeId) brainDeleteNode(brain.selectedNodeId);
}

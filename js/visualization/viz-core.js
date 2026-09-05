/* ============================================================
   VIZ-CORE.JS — one definition of the visible graph, one link painter
   ------------------------------------------------------------
   Everything in here used to exist several times over, slightly differently
   each time, which is how the canvas drifted out of step with itself:

     * "What is on screen" was computed inside vizRenderCanvas and NOWHERE
       else, so with the depth filter set to "Folders only" the canvas drew 34
       nodes while the minimap drew 181, auto-layout arranged 181, and the
       force simulation ran collision against 147 cards you could not see.

     * The link repaint interleaved a write (setAttribute on a path) with a
       read (offsetWidth on the next node), 182 times per mousemove. Each read
       forces a synchronous layout of the whole node layer. Measured at 184 ms
       per drag frame — five frames a second. Reading everything first and
       writing everything after is the same work in 5.7 ms.

     * Brain has its own copy of both, with the same two problems.

   So: vizVisibleGraph() answers the first question for whichever canvas is
   open, and vizPaintLinks() answers the second for both.
   ============================================================ */

/* ── Camera limits ─────────────────────────────────────────────
   The floor was 0.2, and every layout the module produces needs less than
   that to fit — auto-populate builds a 960x13060 ribbon, auto-layout a
   30324x1202 strip. "Fit" could not fit its own default. */
const VIZ_ZOOM_MIN = 0.04;
const VIZ_ZOOM_MAX = 3;
/* Below this the cards are a few pixels tall and the text is unreadable, so
   nothing is lost by not building DOM for the ones off screen. */
const VIZ_CULL_ZOOM = 0.45;

function vizClampZoom(z) {
  return Math.min(VIZ_ZOOM_MAX, Math.max(VIZ_ZOOM_MIN, z));
}

/* ============================================================
   WHAT IS ON SCREEN
   ============================================================ */

/**
 * The graph the active canvas is actually showing, after scope, the depth
 * filter, collapsed subtrees and the local-graph focus.
 *
 * @returns {{nodes: object[], links: object[], nodeById: Map, hidden: Set}}
 */
function vizVisibleGraph() {
  if (typeof viz !== 'undefined' && viz.activeModule === 'brain') return _vizBrainGraph();

  const scopes = vizGetVisibleScopes();
  const hidden = new Set();
  const all = viz.nodes;

  // Collapsed parents hide their whole subtree.
  viz.collapsedNodeIds.forEach(cid => {
    const c = all.find(n => n.id === cid);
    if (c && scopes.includes(c.scope)) {
      vizGetAllDescendants(cid, all, viz.links).forEach(d => hidden.add(d));
    }
  });

  let nodes = all.filter(n => scopes.includes(n.scope) && !hidden.has(n.id) && vizDepthAllows(n));

  // Local graph: only the neighbourhood of one node, N hops out. This is the
  // answer to a 181-node canvas that no zoom level can make readable.
  if (viz.focusNodeId && viz.focusHops > 0 && nodes.some(n => n.id === viz.focusNodeId)) {
    const keep = vizNeighbourhood(viz.focusNodeId, viz.focusHops, nodes, viz.links);
    nodes.forEach(n => { if (!keep.has(n.id)) hidden.add(n.id); });
    nodes = nodes.filter(n => keep.has(n.id));
  }

  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const links = viz.links.filter(l => nodeById.has(l.from) && nodeById.has(l.to));
  return { nodes, links, nodeById, hidden };
}

/** The same answer for Brain: collapse and the existing subtree focus. */
function _vizBrainGraph() {
  const hidden = new Set();
  brain.nodes.forEach(n => {
    if (n.collapsed) vizGetAllDescendants(n.id, brain.nodes, brain.links).forEach(d => hidden.add(d));
  });
  let nodes = brain.nodes.filter(n => !hidden.has(n.id));
  if (brain.focusNodeId && brain.focusHops > 0 && nodes.some(n => n.id === brain.focusNodeId)) {
    const keep = vizNeighbourhood(brain.focusNodeId, brain.focusHops, nodes, brain.links);
    nodes.forEach(n => { if (!keep.has(n.id)) hidden.add(n.id); });
    nodes = nodes.filter(n => keep.has(n.id));
  }
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const links = brain.links.filter(l => nodeById.has(l.from) && nodeById.has(l.to));
  return { nodes, links, nodeById, hidden };
}

/** Every node within `hops` links of `startId`, breadth first. */
function vizNeighbourhood(startId, hops, nodes, links) {
  const present = new Set(nodes.map(n => n.id));
  const adj = new Map();
  links.forEach(l => {
    if (!present.has(l.from) || !present.has(l.to)) return;
    if (!adj.has(l.from)) adj.set(l.from, []);
    if (!adj.has(l.to)) adj.set(l.to, []);
    adj.get(l.from).push(l.to);
    adj.get(l.to).push(l.from);
  });
  const keep = new Set([startId]);
  let edge = [startId];
  for (let d = 0; d < hops; d++) {
    const next = [];
    edge.forEach(id => (adj.get(id) || []).forEach(o => {
      if (!keep.has(o)) { keep.add(o); next.push(o); }
    }));
    if (!next.length) break;
    edge = next;
  }
  return keep;
}

/* ============================================================
   GEOMETRY CACHE + THE LINK PAINTER
   ------------------------------------------------------------
   Node sizes do not change during a drag, so they are measured once when the
   drag starts and re-used for every frame after. Outside a drag the painter
   measures in one pass before it writes anything.
   ============================================================ */

const vizGeom = { sizes: null, groups: null, locks: null, graph: null, held: false };

/** Take a geometry snapshot and hold it until vizGeomRelease(). */
function vizGeomHold(g) {
  const layer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  if (!layer || !svg) return;
  vizGeom.sizes = _vizMeasure(g, layer);
  vizGeom.groups = new Map();
  vizGeom.locks = new Map();
  svg.querySelectorAll('g.viz-link-group').forEach(el => vizGeom.groups.set(el.dataset.linkId, el));
  layer.querySelectorAll('.viz-link-lock').forEach(el => vizGeom.locks.set(el.dataset.lockLinkId, el));
  vizGeom.held = true;
}

function vizGeomRelease() {
  vizGeom.sizes = null; vizGeom.groups = null; vizGeom.locks = null; vizGeom.graph = null; vizGeom.held = false;
}

/** READ PASS. Nothing in here may write to the DOM. */
function _vizMeasure(g, layer) {
  const defW = (viz.activeModule === 'brain') ? 250 : 180;
  const defH = (viz.activeModule === 'brain') ? 80 : 50;
  const sizes = new Map();
  for (const n of g.nodes) {
    const el = layer.querySelector(`.viz-node[data-node-id="${n.id}"]`);
    if (el) sizes.set(n.id, { w: el.offsetWidth, h: el.offsetHeight });
    else sizes.set(n.id, { w: n.w || (n.type === 'root' ? 160 : defW), h: n.h || (n.type === 'root' ? 60 : defH) });
  }
  return sizes;
}

/**
 * Repaint every visible link's path, and move the lock badges with them.
 *
 * The whole point of this function is the order: one read pass, then one write
 * pass, never alternating. Interleaving them is what cost 184 ms a frame.
 */
function vizPaintLinks(g) {
  const layer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  if (!layer || !svg) return;
  g = g || vizVisibleGraph();

  // ── READ ──────────────────────────────────────────────────
  const sizes = vizGeom.held && vizGeom.sizes ? vizGeom.sizes : _vizMeasure(g, layer);
  const paths = [];
  const badges = [];
  for (const l of g.links) {
    const f = g.nodeById.get(l.from), t = g.nodeById.get(l.to);
    if (!f || !t) continue;
    const fs = sizes.get(l.from), ts = sizes.get(l.to);
    if (!fs || !ts) continue;
    paths.push([l.id, vizBezierPath(f.x, f.y, fs.w, fs.h, t.x, t.y, ts.w, ts.h, l.fromSide, l.toSide)]);
    if (l.locked) {
      badges.push([l.id,
        (f.x + fs.w / 2 + t.x + ts.w / 2) / 2 - 11,
        (f.y + fs.h / 2 + t.y + ts.h / 2) / 2 - 11]);
    }
  }

  // ── WRITE ─────────────────────────────────────────────────
  const groupOf = (id) => (vizGeom.groups ? vizGeom.groups.get(id) : svg.querySelector(`g[data-link-id="${id}"]`));
  for (let i = 0; i < paths.length; i++) {
    const grp = groupOf(paths[i][0]);
    if (!grp) continue;
    const kids = grp.children;
    for (let k = 0; k < kids.length; k++) kids[k].setAttribute('d', paths[i][1]);
  }
  const lockOf = (id) => (vizGeom.locks ? vizGeom.locks.get(id) : layer.querySelector(`[data-lock-link-id="${id}"]`));
  for (let i = 0; i < badges.length; i++) {
    const el = lockOf(badges[i][0]);
    if (el) { el.style.left = badges[i][1] + 'px'; el.style.top = badges[i][2] + 'px'; }
  }
}

/* One repaint per animation frame, however many mousemoves arrive. A mouse
   reporting at 1000 Hz used to mean 1000 full repaints a second. */
let _vizPaintRaf = null;
function vizSchedulePaint(fn) {
  if (_vizPaintRaf) return;
  _vizPaintRaf = requestAnimationFrame(() => { _vizPaintRaf = null; fn(); });
}
function vizCancelScheduledPaint() {
  if (_vizPaintRaf) { cancelAnimationFrame(_vizPaintRaf); _vizPaintRaf = null; }
}

/* ============================================================
   COLOUR RULES
   ------------------------------------------------------------
   Painting nodes by hand is decoration. Colouring them by a RULE is the one
   thing the map can show that the sidebar tree cannot: where the gaps are.
   ============================================================ */

const VIZ_TINT_RULES = {
  none:     { label: 'Manual colours', icon: 'palette', hint: 'Only the colours you painted yourself' },
  progress: { label: 'Progress', icon: 'trending-up', hint: 'Not started, attempted, or solved' },
  score:    { label: 'Best score', icon: 'target', hint: 'Your highest score on each program' },
  recency:  { label: 'Last practised', icon: 'history', hint: 'How long since you last attempted it' },
  scope:    { label: 'Library', icon: 'layers', hint: 'Which library each node came from' }
};

const VIZ_TINT_LEGENDS = {
  progress: [['#22c55e', 'Solved'], ['#eab308', 'Attempted'], ['#64748b', 'Not started']],
  score:    [['#22c55e', '100%'], ['#3b82f6', '80–99'], ['#eab308', '60–79'], ['#ef4444', 'Under 60'], ['#64748b', 'No attempt']],
  recency:  [['#22c55e', 'This week'], ['#eab308', 'This month'], ['#f97316', 'Older'], ['#64748b', 'Never']],
  scope:    [['#22c55e', 'Programs'], ['#f59e0b', 'Snippets'], ['#a855f7', 'Notebooks']]
};

/** History for one program, computed once per render rather than per node. */
let _vizHistIndex = null;
function vizHistoryIndex(rebuild) {
  if (_vizHistIndex && !rebuild) return _vizHistIndex;
  const idx = new Map();
  ((typeof state !== 'undefined' && state.history) || []).forEach(h => {
    if (h.isArchived) return;
    let e = idx.get(h.challengeId);
    if (!e) { e = { n: 0, perfect: 0, best: 0, last: 0 }; idx.set(h.challengeId, e); }
    e.n++;
    if (h.score === 100) e.perfect++;
    if ((h.score || 0) > e.best) e.best = h.score || 0;
    const t = h.completedAt || h.date || h.timestamp || 0;
    if (t > e.last) e.last = t;
  });
  _vizHistIndex = idx;
  return idx;
}
function vizInvalidateHistoryIndex() { _vizHistIndex = null; }

/**
 * The colour a node should be drawn in under the current rule, or null to
 * leave it alone. A colour the user painted by hand always wins.
 */
function vizNodeTint(node) {
  const rule = viz.tintRule || 'none';
  if (rule === 'none' || node.color) return null;
  if (node.type === 'comment' || node.type === 'root') return null;

  if (rule === 'scope') {
    return { challenge: '#22c55e', snippet: '#f59e0b', notebook: '#a855f7' }[node.scope] || null;
  }
  if (node.type === 'folder') return null;
  if (node.type !== 'challenge' || !node.dataId) return null;

  const h = vizHistoryIndex().get(node.dataId);
  if (rule === 'progress') {
    if (!h) return '#64748b';
    return h.best >= 100 ? '#22c55e' : '#eab308';
  }
  if (rule === 'score') {
    if (!h) return '#64748b';
    if (h.best >= 100) return '#22c55e';
    if (h.best >= 80) return '#3b82f6';
    if (h.best >= 60) return '#eab308';
    return '#ef4444';
  }
  if (rule === 'recency') {
    if (!h || !h.last) return '#64748b';
    const days = (Date.now() - h.last) / 86400000;
    if (days <= 7) return '#22c55e';
    if (days <= 30) return '#eab308';
    return '#f97316';
  }
  return null;
}

function vizSetTintRule(rule) {
  if (!VIZ_TINT_RULES[rule]) return;
  viz.tintRule = rule;
  vizInvalidateHistoryIndex();
  vizSave();
  const popup = document.getElementById('viz-tint-popup');
  if (popup) popup.classList.add('hidden');
  vizSyncTintBtn();
  vizRenderCanvas();
}

function vizToggleTintMenu() {
  const el = document.getElementById('viz-tint-popup');
  if (el) el.classList.toggle('hidden');
}

function vizSyncTintBtn() {
  const rule = viz.tintRule || 'none';
  const btn = document.getElementById('viz-tint-btn');
  if (btn) {
    btn.classList.toggle('is-active', rule !== 'none');
    const label = 'Colour by: ' + VIZ_TINT_RULES[rule].label;
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
  document.querySelectorAll('#viz-tint-popup .viz-link-type-option').forEach(o => {
    o.classList.toggle('active', o.dataset.tint === rule);
  });
  vizPaintLegend();
}

/** The legend explains whatever the canvas is currently colour-coded by. */
function vizPaintLegend() {
  const el = document.getElementById('viz-scope-legend');
  if (!el) return;
  const rule = viz.tintRule || 'none';
  const isBrain = viz.activeModule === 'brain';
  const rows = VIZ_TINT_LEGENDS[rule];
  if (isBrain || !rows) { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); return; }
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  el.innerHTML = `<span class="viz-legend-title">${escapeHTML(VIZ_TINT_RULES[rule].label)}</span>`
    + rows.map(([hex, label]) =>
      `<span class="viz-legend-item"><i style="background:${hex}"></i> ${escapeHTML(label)}</span>`).join('');
}

/* ============================================================
   THE CAMERA
   ------------------------------------------------------------
   Fit and minimap navigation used to write pan/zoom and repaint — an instant
   cut. Easing the same move reads as travel, which is what tells you where
   you ended up relative to where you were.
   ============================================================ */

let _vizTweenRaf = null;

function vizStopTween() {
  if (_vizTweenRaf) { cancelAnimationFrame(_vizTweenRaf); _vizTweenRaf = null; }
}

function vizPrefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Ease pan/zoom to a target. Writes only transforms while it runs, so it costs
 * nothing near a full render.
 * @param {{x:number,y:number}} pan
 * @param {number} zoom
 * @param {function} [done]
 */
function vizTweenView(pan, zoom, done) {
  const isBrain = viz.activeModule === 'brain';
  const cam = isBrain ? brain : viz;
  vizStopTween();

  const from = { x: cam.pan.x, y: cam.pan.y, z: cam.zoom };
  const to = { x: pan.x, y: pan.y, z: vizClampZoom(zoom) };
  const near = Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1 && Math.abs(from.z - to.z) < 0.005;

  if (near || vizPrefersReducedMotion()) {
    cam.pan.x = to.x; cam.pan.y = to.y; cam.zoom = to.z;
    vizApplyTransform();
    if (done) done();
    return;
  }

  const dur = 280;
  const t0 = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);   // easeOutCubic
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = ease(p);
    cam.pan.x = from.x + (to.x - from.x) * e;
    cam.pan.y = from.y + (to.y - from.y) * e;
    cam.zoom = from.z + (to.z - from.z) * e;
    vizApplyTransform();
    vizUpdateZoomDisplay();
    if (p < 1) { _vizTweenRaf = requestAnimationFrame(step); }
    else { _vizTweenRaf = null; if (done) done(); }
  };
  _vizTweenRaf = requestAnimationFrame(step);
}

/** Push the current pan/zoom onto the two transformed layers. */
function vizApplyTransform() {
  const isBrain = typeof viz !== 'undefined' && viz.activeModule === 'brain';
  const cam = isBrain ? brain : viz;
  const tf = `translate(${cam.pan.x}px, ${cam.pan.y}px) scale(${cam.zoom})`;
  const layer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  if (layer) layer.style.transform = tf;
  if (svg) svg.style.transform = tf;
  const c = document.getElementById('viz-canvas-container');
  if (c) c.classList.toggle('viz-far', cam.zoom < VIZ_CULL_ZOOM);
  if (isBrain) { if (typeof brainUpdateMinimap === 'function') brainUpdateMinimap(); }
  else if (typeof vizUpdateMinimap === 'function') vizUpdateMinimap();
}

/* ============================================================
   THE MODULE REGISTRY
   ------------------------------------------------------------
   The tab strip used to be five hand-written buttons, and adding a sixth
   meant editing the template, vizSwitchModule, VIZ_HEADER_META, a labelMap,
   vizGetVisibleScopes, vizSyncModuleTools and vizDepthAllows. A module is
   really just a label, an icon and a set of library scopes.
   ============================================================ */

const VIZ_MODULES = {
  challenge: { label: 'Programs',  icon: 'code',          scopes: ['challenge'], noun: 'program',  headerIcon: 'file-code' },
  snippet:   { label: 'Snippets',  icon: 'file-text',     scopes: ['snippet'],   noun: 'snippet',  headerIcon: 'code' },
  notebook:  { label: 'Notebooks', icon: 'book',          scopes: ['notebook'],  noun: 'notebook', headerIcon: 'book-open' },
  general:   { label: 'General',   icon: 'layers',        scopes: ['challenge', 'snippet', 'notebook'], noun: 'item', headerIcon: 'layers' },
  brain:     { label: 'Brain',     icon: 'brain-circuit', scopes: [],            noun: 'version',  headerIcon: 'brain-circuit' }
};
const VIZ_MODULE_ORDER = ['challenge', 'snippet', 'notebook', 'general', 'brain'];

function vizModuleMeta(id) { return VIZ_MODULES[id] || VIZ_MODULES.challenge; }

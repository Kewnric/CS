/* ============================================================
   VIZ-CANVAS.JS — Rendering, Drag/Drop, Zooming & Layout
   ============================================================ */

/**
 * Compute an Obsidian-style bezier path between two nodes.
 * Picks exit/entry sides automatically or uses stored fromSide/toSide.
 * The curve exits perpendicular to whichever side is chosen, giving the
 * elastic "flowing" look when nodes are dragged around.
 */
function vizBezierPath(ax, ay, aw, ah, bx, by, bw, bh, fromSide, toSide) {
  // Centers
  const acx = ax + aw / 2, acy = ay + ah / 2;
  const bcx = bx + bw / 2, bcy = by + bh / 2;

  // Auto-pick sides based on relative position if not stored
  if (!fromSide || !toSide) {
    const dx = bcx - acx, dy = bcy - acy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      fromSide = dx >= 0 ? 'right' : 'left';
      toSide   = dx >= 0 ? 'left'  : 'right';
    } else {
      fromSide = dy >= 0 ? 'bottom' : 'top';
      toSide   = dy >= 0 ? 'top'    : 'bottom';
    }
  }

  // Port positions on edge of each box
  const portPos = (nx, ny, nw, nh, side) => {
    if (side === 'top')    return { x: nx + nw / 2, y: ny };
    if (side === 'bottom') return { x: nx + nw / 2, y: ny + nh };
    if (side === 'left')   return { x: nx,           y: ny + nh / 2 };
    /* right */             return { x: nx + nw,     y: ny + nh / 2 };
  };

  const p1 = portPos(ax, ay, aw, ah, fromSide);
  const p2 = portPos(bx, by, bw, bh, toSide);

  // Control point offset — perpendicular exit, proportional to distance
  const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  const bend = Math.min(Math.max(dist * 0.45, 50), 220);

  const cpOffset = (side) => {
    if (side === 'top')    return { x: 0, y: -bend };
    if (side === 'bottom') return { x: 0, y:  bend };
    if (side === 'left')   return { x: -bend, y: 0 };
    /* right */             return { x:  bend, y: 0 };
  };

  const c1 = cpOffset(fromSide);
  const c2 = cpOffset(toSide);

  return `M ${p1.x} ${p1.y} C ${p1.x + c1.x} ${p1.y + c1.y}, ${p2.x + c2.x} ${p2.y + c2.y}, ${p2.x} ${p2.y}`;
}

/** Port drag — starts a link drag from a specific side port.
 *  When link-toggle mode is ON: a port click starts/completes a link instead of dragging. */
function vizPortDragStart(e, nodeId, side) {
  if (viz.colorModeEnabled) return;
  e.stopPropagation();
  e.preventDefault();

  // ---- Link-toggle mode: treat port mousedown as a click, not a drag ----
  if (viz.linkModeEnabled || viz.linkingFrom) {
    if (viz.linkingFrom) {
      // Already linking — complete the link to this specific port side
      if (viz.portDrag) return; // don't double-fire during an actual drag
      if (viz.linkingFrom !== nodeId) {
        vizPushUndo();
        const link = vizAddLink(viz.linkingFrom, nodeId);
        if (link) {
          // Preserve the fromSide that was set when linking started
          if (viz._linkFromSide) link.fromSide = viz._linkFromSide;
          link.toSide = side;
        }
      }
      viz._linkFromSide = null;
      vizCancelLinking();
    } else {
      // Not yet linking — start from this specific port side
      viz._linkFromSide = side;
      vizStartLinking(nodeId);
    }
    return;
  }

  viz.portDrag = { fromId: nodeId, fromSide: side };
  viz.linkingFrom = nodeId;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('linking-mode');
  vizRenderCanvas();

  // Live preview of where the link would land, so the side it snaps to is
  // visible before you let go rather than after.
  function onPortDragMove(mv) {
    if (!viz.portDrag) return;
    const els = document.elementsFromPoint(mv.clientX, mv.clientY);
    const targetEl = els.find(el => el.classList && el.classList.contains('viz-node') && el.dataset.nodeId !== nodeId);
    if (!targetEl) { vizClearLinkTarget(); return; }
    const portEl = els.find(el => el.classList && el.classList.contains('viz-port') && el.dataset.side);
    const side = (portEl && targetEl.contains(portEl))
      ? portEl.dataset.side
      : vizSnapSide(targetEl, mv.clientX, mv.clientY, nodeId, targetEl.dataset.nodeId);
    vizPaintLinkTarget(targetEl, side);
  }
  document.addEventListener('pointermove', onPortDragMove, true);

  // Complete the port drag on mouseup — find if cursor is over a node
  function onPortDragUp(upEvent) {
    document.removeEventListener('pointerup', onPortDragUp, true);
    document.removeEventListener('pointercancel', onPortDragUp, true);
    document.removeEventListener('pointermove', onPortDragMove, true);
    vizClearLinkTarget();
    if (!viz.portDrag) return;

    // Find which node (if any) the cursor is over
    const els = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
    const targetEl = els.find(el => el.dataset && el.dataset.nodeId && el.dataset.nodeId !== nodeId);
    const targetNodeId = targetEl ? targetEl.dataset.nodeId : null;

    if (targetNodeId) {
      vizPushUndo();
      const link = vizAddLink(nodeId, targetNodeId);
      if (link) {
        link.fromSide = side;

        // --- Determine toSide from where the cursor actually landed ---

        // 1. Check if the cursor landed directly on a port circle of the target node
        const portEl = els.find(el =>
          el.classList && el.classList.contains('viz-port') &&
          el.dataset.nodeId === targetNodeId &&
          el.dataset.side
        );

        // Dropped on an explicit port honours it exactly; otherwise the same
        // rule the live preview drew (vizSnapSide), so what you saw while
        // dragging is what you get. This used to be a second, separate copy of
        // the geometry that only ran on release.
        const targetNodeEl = document.querySelector(`.viz-node[data-node-id="${targetNodeId}"]`);
        link.toSide = portEl
          ? portEl.dataset.side
          : (targetNodeEl ? vizSnapSide(targetNodeEl, upEvent.clientX, upEvent.clientY, nodeId, targetNodeId) : 'left');
      }
    }
    viz.portDrag = null;
    vizCancelLinking();
  }
  document.addEventListener('pointerup', onPortDragUp, true);
  document.addEventListener('pointercancel', onPortDragUp, true);
}

/**
 * Which side of `nodeEl` a link dropped at (clientX, clientY) will attach to.
 * The outer 25% band on each axis means "this edge"; the middle means "pick the
 * sensible one from the direction the link comes in". Kept in one place so the
 * live preview and the actual drop can never disagree.
 */
function vizSnapSide(nodeEl, clientX, clientY, fromId, toId) {
  const rect = nodeEl.getBoundingClientRect();
  const lx = clientX - rect.left, ly = clientY - rect.top;
  const w = rect.width, h = rect.height;
  const edge = 0.25;
  const inCenterX = lx > w * edge && lx < w * (1 - edge);
  const inCenterY = ly > h * edge && ly < h * (1 - edge);
  if (inCenterX && inCenterY) {
    const from = viz.nodes.find(n => n.id === fromId);
    const to = viz.nodes.find(n => n.id === toId);
    if (!from || !to) return 'left';
    const dx = (to.x + (to.w || 180) / 2) - (from.x + (from.w || 180) / 2);
    const dy = (to.y + (to.h || 50) / 2) - (from.y + (from.h || 50) / 2);
    return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
  }
  const dTop = ly, dBottom = h - ly, dLeft = lx, dRight = w - lx;
  const min = Math.min(dTop, dBottom, dLeft, dRight);
  return min === dTop ? 'top' : min === dBottom ? 'bottom' : min === dLeft ? 'left' : 'right';
}

/** Paint (or clear) the "this is where it will land" preview. */
function vizPaintLinkTarget(nodeEl, side) {
  document.querySelectorAll('.viz-node.viz-link-target').forEach(el => {
    if (el === nodeEl) return;
    el.classList.remove('viz-link-target');
    el.removeAttribute('data-snap-side');
    el.querySelectorAll('.viz-port-snap').forEach(p => p.classList.remove('viz-port-snap'));
  });
  if (!nodeEl) return;
  nodeEl.classList.add('viz-link-target');
  if (nodeEl.dataset.snapSide !== side) {
    nodeEl.dataset.snapSide = side;
    nodeEl.querySelectorAll('.viz-port').forEach(p => p.classList.toggle('viz-port-snap', p.dataset.side === side));
  }
}

function vizClearLinkTarget() { vizPaintLinkTarget(null); }

function vizPortCenter(nx, ny, nw, nh, side) {
  if (side === 'top')    return { x: nx + nw / 2, y: ny };
  if (side === 'bottom') return { x: nx + nw / 2, y: ny + nh };
  if (side === 'left')   return { x: nx,           y: ny + nh / 2 };
  return                        { x: nx + nw,      y: ny + nh / 2 };
}

/** Which libraries the canvas is showing. One, two or all three. */
function vizGetVisibleScopes() {
  if (viz.activeModule === 'brain') return [];
  return viz.scopes && viz.scopes.length ? viz.scopes : ['challenge'];
}

/* ── Rendering ─────────────────────────────────────────────────
   This used to be `nodesLayer.innerHTML = ''` followed by rebuilding 181
   elements, 724 ports and 1,647 event listeners — on every zoom press, every
   node click, every colour change. It is a reconcile now: an element is built
   once and afterwards only the parts that actually changed are touched.

   A node's element is rebuilt only when its SIGNATURE changes (label, icon,
   colour, fog, completion, collapse count, comment text). Position and state
   classes are cheap attribute writes and happen every time. */

const _vizNodeEls = new Map();      // nodeId -> element, for reconcile
let _vizLinkSig = '';               // when this changes the SVG groups rebuild
let _vizDefsBuilt = false;

/* Forgetting the element map is not enough on its own: the elements are still
   in the layer, and a reconcile that has forgotten them cannot remove them.
   Switching from Programs to Snippets left all 183 program cards on screen
   underneath an empty-state message. */
function _vizResetRenderCache() {
  _vizNodeEls.clear();
  _vizLinkSig = '';
  _vizDefsBuilt = false;
  vizGeomRelease();
  const layer = document.getElementById('viz-nodes-layer');
  if (layer) layer.innerHTML = '';
  const svg = document.getElementById('viz-canvas-svg');
  if (svg) svg.innerHTML = '';
}

/** Is this node greyed out because its prerequisites are unmet? */
function _vizIsFogged(node, links) {
  if (!viz.fogEnabled || node.type === 'root' || node.type === 'comment') return false;
  const reqOf = (id) => (state.categoryRequirements ? state.categoryRequirements[id] : null);
  const unmet = (req) => {
    if (!req) return false;
    if (req.requiredChallengeIds && req.requiredChallengeIds.length > 0) {
      return req.requiredChallengeIds.some(cId => !state.history.some(h => h.challengeId === cId && h.score === 100 && !h.isArchived));
    }
    if (req.reqNodeId) {
      const completed = typeof getCompletedCount === 'function' ? getCompletedCount(req.reqNodeId) : 0;
      return completed < (req.count || 1);
    }
    return false;
  };
  for (const ll of links) {
    if (ll.to !== node.id || !ll.locked) continue;
    const parentViz = viz.nodes.find(n => n.id === ll.from);
    if (parentViz && parentViz.dataId && unmet(reqOf(node.dataId || parentViz.dataId))) return true;
  }
  if (node.dataId && node.type === 'folder' && unmet(reqOf(node.dataId))) return true;
  return false;
}

const VIZ_NODE_ICONS = { root: 'server', folder: 'folder', challenge: 'code', snippet: 'file-text', notebook: 'book', comment: 'message-circle' };

/** Everything the node's markup depends on, gathered once. */
function _vizNodeInfo(node, links) {
  const fog = _vizIsFogged(node, links);
  const globe = viz.globeModeEnabled && node.type !== 'comment' && node.type !== 'root';
  let done = false, count = 0;
  if (!fog && node.type === 'challenge' && node.dataId) {
    const h = vizHistoryIndex().get(node.dataId);
    if (h && h.perfect > 0) { done = true; count = h.perfect; }
  }
  return {
    fog: fog, globe: globe, done: done, count: count,
    tint: vizNodeTint(node),
    icon: node.icon || VIZ_NODE_ICONS[node.type] || VIZ_NODE_ICONS[node.scope] || 'file'
  };
}

function _vizNodeSig(node, o) {
  return [node.label, node.type, o.icon, node.color || '', o.tint || '', o.fog ? 1 : 0, o.globe ? 1 : 0,
    o.done ? 1 : 0, o.count, node.collapsed ? (node._collapsedChildren || []).length : -1,
    node.type === 'comment' ? (node.commentContent || '') : '',
    node.userSized ? node.w + 'x' + node.h : ''].join('~|~');
}

/** The inner markup of one node. Rebuilt only when the signature changes. */
function _vizFillNode(el, node, o) {
  const label = o.fog ? '???' : escapeHTML(node.label);
  const hidden = node.collapsed ? (node._collapsedChildren || []).length : 0;
  const collapseBadge = node.collapsed
    ? `<span class="viz-collapse-badge" title="${hidden} hidden children">+${hidden}</span>` : '';

  if (node.type === 'frame') {
    // A frame is a container: its box IS the node, and the title hangs off the
    // top edge so it never covers what is inside.
    el.innerHTML = `<div class="viz-node-inner" style="width:${node.w || 520}px;height:${node.h || 340}px;"></div>
      <span class="viz-frame-title">${escapeHTML(node.label || 'Group')}</span>`;
    return;
  }

  if (node.type === 'comment') {
    const w = (node.userSized && node.w) ? `width:${node.w}px;` : 'width:250px;';
    const h = (node.userSized && node.h) ? `height:${node.h}px;` : 'height:fit-content;';
    el.innerHTML = `<div class="viz-node-inner" style="${w} ${h}">
      <div class="viz-comment-body">
        <div class="viz-comment-content">${escapeHTML(node.commentContent || 'Double click or right click to edit comment...')}</div>
      </div>
    </div>`;
    _vizWatchCommentSize(el, node);
    return;
  }

  let subtitle = '';
  if (node.type !== 'root') {
    const scopeLabels = { challenge: 'Program', snippet: 'Snippet', notebook: 'Notebook' };
    const typeLabel = node.type === 'folder' ? 'Category' : (scopeLabels[node.scope] || node.scope || '');
    subtitle = `<div class="viz-node-subtitle">${o.fog ? 'Locked' : escapeHTML(typeLabel)}${o.done && o.count > 0 ? ' · x' + o.count : ''}</div>`;
  }
  const doneBadge = o.done
    ? `<span class="viz-node-badge viz-node-badge-done" title="Completed"><i data-lucide="check" style="width:10px;height:10px;"></i></span>` : '';
  const glyph = o.fog ? 'lock' : o.icon;

  if (o.globe) {
    el.innerHTML = `
      <div class="viz-globe-circle" title="${label}">
        <i data-lucide="${glyph}"></i>
        ${o.done ? '<span class="viz-globe-badge"><i data-lucide="check" style="width:8px;height:8px;"></i></span>' : ''}
      </div>
      <div class="viz-globe-expand">
        <div class="viz-node-header"><i data-lucide="${glyph}"></i><span class="viz-node-title">${label}</span>${doneBadge}</div>
        ${subtitle}
      </div>
      ${collapseBadge}
      ${o.fog ? '<div class="viz-fog-overlay"><i data-lucide="eye-off"></i></div>' : ''}`;
  } else {
    el.innerHTML = `<div class="viz-node-inner">
      <div class="viz-node-header"><i data-lucide="${glyph}"></i><span class="viz-node-title">${label}</span>${doneBadge}</div>
      ${subtitle}
    </div>
    ${collapseBadge}
    ${o.fog ? '<div class="viz-fog-overlay"><i data-lucide="eye-off"></i><span class="viz-fog-label">???</span></div>' : ''}`;
  }

  // Ports go on after the content, since innerHTML has just cleared them.
  _vizAddPorts(el, node.id);
}

function _vizAddPorts(el, nodeId) {
  ['top', 'right', 'bottom', 'left'].forEach(side => {
    const port = document.createElement('div');
    port.className = 'viz-port';
    port.dataset.side = side;
    port.dataset.nodeId = nodeId;
    port.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      vizPortDragStart(e, nodeId, side);
    });
    el.appendChild(port);
  });
}

/** Honour a size the user actually dragged, and only that. */
function _vizWatchCommentSize(el, node) {
  setTimeout(() => {
    const inner = el.querySelector('.viz-node-inner');
    if (!inner) return;
    if (node._resizeObserver) node._resizeObserver.disconnect();
    // ResizeObserver fires once for the current size the moment it starts
    // observing. Treating that as a resize baked the first layout's height into
    // the note, which then clipped its own text as soon as it grew.
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (initial) { initial = false; return; }
      if (inner.offsetWidth > 0) { node.w = inner.offsetWidth; node.h = inner.offsetHeight; node.userSized = true; }
    });
    observer.observe(inner);
    node._resizeObserver = observer;
  }, 0);
}

/** Listeners are attached once per element, never per render. */
function _vizBindNode(el, nodeId) {
  el.addEventListener('pointerdown', (e) => vizNodeMouseDown(e, nodeId));
  el.addEventListener('click', (e) => vizNodeClick(e, nodeId));
  el.addEventListener('contextmenu', (e) => vizNodeCtx(e, nodeId));
  el.addEventListener('mouseenter', () => { if (typeof vizHoverFocus === 'function') vizHoverFocus(nodeId); });
  el.addEventListener('mouseleave', () => {
    if (typeof vizHoverClear === 'function') vizHoverClear();
    delete el.dataset.nearSide;
  });
  el.addEventListener('mousemove', (e) => {
    if (el.dataset.type === 'comment') return;
    const r = el.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    const dTop = ly, dBottom = r.height - ly, dLeft = lx, dRight = r.width - lx;
    const min = Math.min(dTop, dBottom, dLeft, dRight);
    el.dataset.nearSide = min === dTop ? 'top' : min === dBottom ? 'bottom' : min === dLeft ? 'left' : 'right';
  });
  el.addEventListener('dblclick', (e) => {
    const node = viz.nodes.find(n => n.id === nodeId);
    if (node && node.type === 'comment') { e.stopPropagation(); vizHideAllMenus(); vizOpenCommentEditor(node); }
    else vizNodeDblClick(e, nodeId);
  });
}

/* Below VIZ_CULL_ZOOM the cards are a few pixels tall and unreadable, so on a
   very large graph there is no reason to build DOM for the ones off screen.
   Left off entirely under 400 nodes: at that size the whole render is cheap
   and culling would only add a way to be wrong. */
function _vizCullSet(g) {
  if (g.nodes.length <= 400 || viz.zoom >= VIZ_CULL_ZOOM) return null;
  const c = document.getElementById('viz-canvas-container');
  if (!c) return null;
  const mx = c.offsetWidth * 0.75, my = c.offsetHeight * 0.75;
  const x0 = (-viz.pan.x - mx) / viz.zoom, y0 = (-viz.pan.y - my) / viz.zoom;
  const x1 = (-viz.pan.x + c.offsetWidth + mx) / viz.zoom;
  const y1 = (-viz.pan.y + c.offsetHeight + my) / viz.zoom;
  const keep = new Set();
  g.nodes.forEach(n => {
    const w = n.w || 200, h = n.h || 80;
    if (n.x < x1 && n.x + w > x0 && n.y < y1 && n.y + h > y0) keep.add(n.id);
  });
  return keep;
}

function vizRenderCanvas() {
  if (viz.activeModule === 'brain') { brainRenderCanvas(); return; }
  // Anything in the layer that the reconcile is not tracking belongs to another
  // module (or to Brain, which writes the same layer directly).
  const stray = document.getElementById('viz-nodes-layer');
  if (stray && stray.children.length && !_vizNodeEls.size) stray.innerHTML = '';
  const container = document.getElementById('viz-canvas-container');
  const svg = document.getElementById('viz-canvas-svg');
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const emptyState = document.getElementById('viz-canvas-empty');
  if (!container || !nodesLayer || !svg) return;

  vizPruneGhostNodes();
  vizHistoryIndex(true);

  const g = vizVisibleGraph();
  const cull = _vizCullSet(g);
  const drawn = cull ? g.nodes.filter(n => cull.has(n.id)) : g.nodes;

  vizPaintEmptyState(emptyState, g);

  nodesLayer.style.transform = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;
  svg.style.transform = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;
  container.classList.toggle('viz-far', viz.zoom < VIZ_CULL_ZOOM);
  container.classList.toggle('viz-focus-mode', !!(viz.focusNodeId && viz.focusHops > 0));

  const linkedIds = new Set();
  g.links.forEach(l => { linkedIds.add(l.from); linkedIds.add(l.to); });

  const seen = new Set();
  let rebuilt = 0;
  let entering = 0;

  drawn.forEach(node => {
    const info = _vizNodeInfo(node, g.links);
    const sig = _vizNodeSig(node, info);
    let el = _vizNodeEls.get(node.id);
    if (el && !el.isConnected) { _vizNodeEls.delete(node.id); el = null; }

    if (!el) {
      el = document.createElement('div');
      el.className = 'viz-node';
      el.dataset.nodeId = node.id;
      el.dataset.type = node.type || 'item';
      _vizBindNode(el, node.id);
      el.__sig = sig;
      _vizFillNode(el, node, info);
      nodesLayer.appendChild(el);
      _vizNodeEls.set(node.id, el);
      rebuilt++;
      if (node._isNew) {
        // Staggered by draw order rather than all in the same frame, the way
        // the subfolder grid in Browse already arrives.
        el.style.setProperty('--viz-stagger', String(Math.min(entering++, 26)));
        el.classList.add('viz-node-entering');
        delete node._isNew;
        setTimeout(() => { el.classList.remove('viz-node-entering'); el.style.removeProperty('--viz-stagger'); }, 900);
      }
    } else if (el.__sig !== sig) {
      el.__sig = sig;
      el.dataset.type = node.type || 'item';
      _vizFillNode(el, node, info);
      rebuilt++;
    }

    // Cheap per-render writes: position, state classes, data attributes.
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    if (node.scope) el.dataset.scope = node.scope; else delete el.dataset.scope;
    if (node.color) el.dataset.color = node.color; else delete el.dataset.color;
    if (info.tint) el.style.setProperty('--viz-tint', info.tint); else el.style.removeProperty('--viz-tint');
    el.classList.toggle('viz-tinted', !!info.tint);
    if (node.isDraft) el.dataset.draft = 'true'; else delete el.dataset.draft;
    if (node.type === 'comment') el.dataset.format = node.commentFormat || 'auto';

    const cl = el.classList;
    cl.toggle('selected', node.id === viz.selectedNodeId || viz.selectedNodeIds.has(node.id));
    cl.toggle('viz-globe-node', info.globe);
    cl.toggle('viz-fog-of-war', info.fog);
    cl.toggle('not-linked', !linkedIds.has(node.id) && node.type !== 'root' && node.type !== 'comment');
    cl.toggle('viz-search-match', !!(viz.searchQuery && viz.highlightedNodeIds.has(node.id)));
    cl.toggle('viz-search-dim', !!(viz.searchQuery && !viz.highlightedNodeIds.has(node.id) && node.type !== 'root'));
    seen.add(node.id);
  });

  // Anything no longer visible loses its element, and its listeners with it.
  _vizNodeEls.forEach((el, id) => {
    if (seen.has(id)) return;
    el.remove();
    _vizNodeEls.delete(id);
  });

  _vizRenderLinks(svg, nodesLayer, g, drawn);

  // Only icons inside nodes that were actually rebuilt this pass.
  if (rebuilt > 0 && typeof lucide !== 'undefined') lucide.createIcons({ root: nodesLayer });
  vizUpdateZoomDisplay();
  vizUpdateMinimap();
  vizPaintLegend();
  if (typeof vizForce !== 'undefined' && vizForce.enabled) vizForceWake();
}

/* One message used to cover three completely different situations: nothing
   placed, everything hidden by the depth filter, and nothing matching a
   search. Two of those need to say what happened and offer the way back. */
function vizPaintEmptyState(el, g) {
  if (!el) return;
  if (g.nodes.length > 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const h3 = el.querySelector('h3'), p = el.querySelector('p'), btn = el.querySelector('button');
  const scopes = vizGetVisibleScopes();
  const anyInScope = viz.nodes.some(n => scopes.includes(n.scope));
  let title, body, label, action;
  if (viz.focusNodeId && viz.focusHops > 0) {
    title = 'Nothing within range';
    body = 'The focused node has no neighbours this close. Widen the range or clear the focus.';
    label = 'Clear focus'; action = 'vizClearFocus()';
  } else if (viz.searchQuery && anyInScope) {
    title = 'No match on the canvas';
    body = 'Nothing placed here matches "' + (viz.searchQuery || '') + '".';
    label = 'Clear search'; action = 'vizClearSearch()';
  } else if (anyInScope) {
    title = 'Everything is filtered out';
    body = 'The canvas is set to show ' + (VIZ_DEPTH_META[viz.canvasDepth] || VIZ_DEPTH_META.all).label.toLowerCase() + ', and none are placed.';
    label = 'Show everything'; action = "vizSetDepth('all')";
  } else {
    title = 'Your Mindmap Canvas';
    body = 'Drag items from the left, right-click to create nodes, or double-click to add a node.';
    label = 'Auto-populate'; action = 'vizAutoPopulateForce()';
  }
  if (h3) h3.textContent = title;
  if (p) p.textContent = body;
  if (btn && btn.dataset.emptyAction !== action) {
    btn.dataset.emptyAction = action;
    btn.setAttribute('onclick', action);
    btn.innerHTML = '<i data-lucide="zap" style="width:14px;height:14px;"></i> ' + escapeHTML(label);
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: btn });
  }
}

/**
 * The SVG layer. The <g> elements are rebuilt only when the link SET changes;
 * a move just repaints the `d` attributes through vizPaintLinks.
 */
function _vizRenderLinks(svg, nodesLayer, g, drawn) {
  if (!_vizDefsBuilt) { _vizBuildDefs(svg); _vizDefsBuilt = true; }

  const drawnIds = new Set(drawn.map(n => n.id));
  const links = g.links.filter(l => drawnIds.has(l.from) && drawnIds.has(l.to));
  const sig = links.map(l => [l.id, l.color || '', l.locked ? 1 : 0, l.isCustom ? 1 : 0,
    l.arrowType || viz.defaultLinkArrowType || 'arrow', l.label || ''].join(':')).join('|')
    + '#' + (viz.linkingFrom || '');

  if (sig !== _vizLinkSig) {
    _vizLinkSig = sig;
    let out = '';
    links.forEach(link => {
      const hex = link.color ? vizColorMap(link.color) : null;
      const cls = link.locked ? 'viz-link locked' : link.isCustom ? 'viz-link custom-link' : 'viz-link';
      const baseArrowId = link.color ? 'viz-arrowhead-col-' + link.color
        : link.locked ? 'viz-arrowhead-locked'
          : link.isCustom ? 'viz-arrowhead-custom' : 'viz-arrowhead';
      const arrowType = link.arrowType || viz.defaultLinkArrowType || 'arrow';
      const markerEnd = arrowType !== 'none' ? `marker-end="url(#${baseArrowId})"` : '';
      const markerStart = arrowType === 'double-arrow' ? `marker-start="url(#${baseArrowId}-back)"` : '';
      // A label rides the path itself, so it curves and moves with the link.
      const label = link.label
        ? `<text class="viz-link-label" dy="-6"><textPath href="#vlp-${link.id}" startOffset="50%">${escapeHTML(link.label)}</textPath></text>`
        : '';
      const fresh = link._isNew ? ' viz-link-new' : '';
      delete link._isNew;
      out += `<g class="viz-link-group" data-link-id="${link.id}" oncontextmenu="vizLinkCtx(event,'${link.id}')">
        <path class="viz-link-hitbox" d=""/>
        <path id="vlp-${link.id}" class="${cls}${fresh}" d="" style="${hex ? 'stroke:' + hex + ';' : ''}" ${markerEnd} ${markerStart}/>
        ${label}
      </g>`;
    });
    if (viz.linkingFrom && g.nodeById.has(viz.linkingFrom)) {
      out += '<path id="viz-temp-link" class="viz-link custom-link" d="" style="pointer-events:none;"/>';
    }
    const defs = svg.querySelector('defs');
    svg.innerHTML = out;
    if (defs) svg.insertBefore(defs, svg.firstChild);

    // Lock badges live in the node layer so they scale with it.
    nodesLayer.querySelectorAll('.viz-link-lock').forEach(el => el.remove());
    links.filter(l => l.locked).forEach(link => {
      const lockEl = document.createElement('div');
      lockEl.className = 'viz-link-lock';
      lockEl.innerHTML = '<i data-lucide="lock"></i>';
      lockEl.dataset.lockLinkId = link.id;
      nodesLayer.appendChild(lockEl);
      if (typeof lucide !== 'undefined') lucide.createIcons({ el: lockEl });
    });
    vizGeomRelease();   // the cached <g> handles are stale
  }

  const temp = document.getElementById('viz-temp-link');
  if (temp && viz.linkingFrom) {
    const from = g.nodeById.get(viz.linkingFrom);
    if (from) {
      const el = _vizNodeEls.get(viz.linkingFrom);
      const fw = el ? el.offsetWidth : (from.type === 'root' ? 160 : 180);
      const fh = el ? el.offsetHeight : (from.type === 'root' ? 60 : 50);
      const side = viz.portDrag ? viz.portDrag.fromSide : (viz._linkFromSide || 'right');
      const p = vizPortCenter(from.x, from.y, fw, fh, side);
      temp.setAttribute('d', `M ${p.x} ${p.y} L ${p.x} ${p.y}`);
    }
  }

  vizPaintLinks({ nodes: drawn, links: links, nodeById: new Map(drawn.map(n => [n.id, n])) });
}

/* Eighteen arrowhead markers that never change were being rebuilt from a
   template string on every single render. */
function _vizBuildDefs(svg) {
  const colors = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4' };
  const fwd = (id, fill, op) => `<marker id="${id}" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${fill}" opacity="${op}"/></marker>`;
  const back = (id, fill, op) => `<marker id="${id}-back" markerWidth="8" markerHeight="6" refX="2" refY="3" orient="auto"><polygon points="8 0, 0 3, 8 6" fill="${fill}" opacity="${op}"/></marker>`;
  let html = fwd('viz-arrowhead', 'var(--text-tertiary)', 0.6) + back('viz-arrowhead', 'var(--text-tertiary)', 0.6)
    + fwd('viz-arrowhead-locked', '#f59e0b', 0.8) + back('viz-arrowhead-locked', '#f59e0b', 0.8)
    + fwd('viz-arrowhead-custom', '#f59e0b', 0.6) + back('viz-arrowhead-custom', '#f59e0b', 0.6);
  Object.keys(colors).forEach(name => {
    html += fwd('viz-arrowhead-col-' + name, colors[name], 0.9) + back('viz-arrowhead-col-' + name, colors[name], 0.9);
  });
  const old = svg.querySelector('defs');
  if (old) old.remove();
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = html;
  svg.insertBefore(defs, svg.firstChild);
}

/**
 * Repaint the link paths after a move.
 *
 * This used to be a second copy of the geometry, and it interleaved writes
 * with reads: setAttribute on a path, then offsetWidth on the next node, 182
 * times. Each read forced a synchronous layout — 184 ms per drag frame, five
 * frames a second. vizPaintLinks does the same work read-first for 5.7 ms.
 */
function vizUpdateSVGLinks() {
  vizPaintLinks(vizGeom.held && vizGeom.graph ? vizGeom.graph : null);
}

/* ── Dragging a node ──────────────────────────────────────────
   Pointer events rather than mouse events, so the canvas works with a finger
   and a stylus as well as a mouse. There was not one touch listener in the
   whole module before this: on a phone the canvas rendered and then did
   nothing at all. */

function vizNodeMouseDown(e, nodeId) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.stopPropagation();
  if (viz.linkModeEnabled || viz.linkingFrom || viz.colorModeEnabled) return;
  const node = viz.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // The bottom-right corner of a comment is its resize grip, not a drag handle.
  if (node.type === 'comment') {
    const inner = e.target.closest('.viz-node-inner');
    if (inner) {
      const rect = inner.getBoundingClientRect();
      const localX = (e.clientX - rect.left) / viz.zoom;
      const localY = (e.clientY - rect.top) / viz.zoom;
      if (localX > inner.offsetWidth - 25 && localY > inner.offsetHeight - 25) return;
    }
  }

  // Dragging any node of a multi-selection moves the whole selection.
  if (!viz.selectedNodeIds.has(nodeId) && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
    viz.selectedNodeIds.clear();
  }

  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
  // Pushed on the first actual MOVE instead (see vizNodeDrag) — selecting a
  // node banked an undo snapshot, so Ctrl+Z spent several presses rewinding
  // clicks that had changed nothing before it reached a real edit.
  viz._undoArmed = true;
  viz.draggingNode = nodeId;
  viz._hasDragged = false;
  viz._dragStartPos = { x: e.clientX, y: e.clientY };
  viz.dragOffset.x = (e.clientX - rect.left - viz.pan.x) / viz.zoom - node.x;
  viz.dragOffset.y = (e.clientY - rect.top - viz.pan.y) / viz.zoom - node.y;

  // Node sizes cannot change mid-drag, so measure once here instead of
  // re-measuring every node on every frame.
  const g = vizVisibleGraph();
  vizGeomHold(g);
  vizGeom.graph = g;
  viz._frameCargo = node.type === 'frame' ? vizFrameContents(node) : null;

  if (e.pointerId !== undefined && e.currentTarget && e.currentTarget.setPointerCapture) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
  }
  document.addEventListener('pointermove', vizNodeDrag);
  document.addEventListener('pointerup', vizNodeDragEnd);
  document.addEventListener('pointercancel', vizNodeDragEnd);
}

function vizNodeDrag(e) {
  if (!viz.draggingNode) return;
  if (!viz._hasDragged) {
    if (viz._dragStartPos && Math.abs(e.clientX - viz._dragStartPos.x) < 3 && Math.abs(e.clientY - viz._dragStartPos.y) < 3) return;
    viz._hasDragged = true;
    if (viz._undoArmed) { vizPushUndo(); viz._undoArmed = false; }
  }
  const node = viz.nodes.find(n => n.id === viz.draggingNode);
  if (!node) return;

  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };

  const prevX = node.x;
  const prevY = node.y;
  node.x = vizSnapCoord((e.clientX - rect.left - viz.pan.x) / viz.zoom - viz.dragOffset.x);
  node.y = vizSnapCoord((e.clientY - rect.top - viz.pan.y) / viz.zoom - viz.dragOffset.y);
  const dx = node.x - prevX;
  const dy = node.y - prevY;

  const nodeEl = _vizNodeEls.get(node.id);
  if (nodeEl) {
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.classList.add('dragging');
  }

  // A frame carries whatever it enclosed WHEN THE DRAG STARTED. Working it out
  // on the first move instead asked after the frame had already jumped — at
  // 0.08 zoom one 25px mouse step is 300 world px, and everything had fallen
  // outside the box by the time the question was put.
  if (node.type === 'frame' && (dx || dy) && viz._frameCargo) {
    viz._frameCargo.forEach(child => {
      child.x += dx; child.y += dy;
      const el = _vizNodeEls.get(child.id);
      if (el) { el.style.left = child.x + 'px'; el.style.top = child.y + 'px'; el.classList.add('dragging-child'); }
    });
  } else if (viz.selectedNodeIds.size > 1 && viz.selectedNodeIds.has(node.id) && (dx || dy)) {
    viz.selectedNodeIds.forEach(id => {
      if (id === node.id) return;
      const other = viz.nodes.find(n => n.id === id);
      if (!other) return;
      other.x += dx; other.y += dy;
      const el = _vizNodeEls.get(id);
      if (el) { el.style.left = other.x + 'px'; el.style.top = other.y + 'px'; el.classList.add('dragging-child'); }
    });
  } else if (viz.flowyDragEnabled && (dx !== 0 || dy !== 0)) {
    vizDragDescendants(node.id, dx, dy, new Set([node.id]));
  }

  // One repaint per animation frame, however many pointermoves arrive.
  vizSchedulePaint(() => { vizUpdateSVGLinks(); vizUpdateMinimap(); });
}

function vizNodeDragEnd() {
  vizCancelScheduledPaint();
  if (viz.draggingNode) {
    const nodeEl = _vizNodeEls.get(viz.draggingNode);
    if (nodeEl) nodeEl.classList.remove('dragging');
  }
  document.querySelectorAll('.viz-node.dragging-child').forEach(el => el.classList.remove('dragging-child'));
  viz.draggingNode = null;
  viz._undoArmed = false;
  document.removeEventListener('pointermove', vizNodeDrag);
  document.removeEventListener('pointerup', vizNodeDragEnd);
  document.removeEventListener('pointercancel', vizNodeDragEnd);
  const dragged = viz._hasDragged;
  viz._hasDragged = false;
  viz._frameCargo = null;
  vizGeom.graph = null;
  vizGeomRelease();
  if (dragged) {
    vizUpdateSVGLinks();
    vizUpdateMinimap();
    vizSave();
  }
}

function vizDragDescendants(nodeId, dx, dy, visited) {
  viz.links.filter(l => l.from === nodeId && !l.isCustom).forEach(l => {
    if (visited.has(l.to)) return;
    visited.add(l.to);
    const child = viz.nodes.find(n => n.id === l.to);
    if (!child) return;
    child.x += dx;
    child.y += dy;
    const childEl = _vizNodeEls.get(l.to);
    if (childEl) {
      childEl.style.left = child.x + 'px';
      childEl.style.top = child.y + 'px';
      childEl.classList.add('dragging-child');
    }
    vizDragDescendants(l.to, dx, dy, visited);
  });
}

function vizSidebarDragStart(e, id, type) {
  e.dataTransfer.setData('application/json', JSON.stringify({ id, type }));
}

function vizCanvasDrop(e) {
  e.preventDefault();
  const dataString = e.dataTransfer.getData('application/json');
  if (!dataString) return;

  vizPushUndo();
  try {
    const data = JSON.parse(dataString);
    // A dropped row knows its own library, whether one is selected or three.
    let scope = vizPrimaryScope();
    if (state.challenges.find(c => c.id === data.id)) scope = 'challenge';
    else if ((state.snippets || []).find(s => s.id === data.id)) scope = 'snippet';
    else if ((state.notebooks || []).find(n => n.id === data.id)) scope = 'notebook';

    const container = document.getElementById('viz-canvas-container');
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - viz.pan.x) / viz.zoom;
    const y = (e.clientY - rect.top - viz.pan.y) / viz.zoom;

    // Dropped ON a node rather than on empty canvas: connect the two. This is
    // the quickest way to say "this notebook explains that program", and the
    // General canvas exists for exactly that kind of cross-library link.
    const ontoEl = e.target.closest ? e.target.closest('.viz-node') : null;
    const onto = ontoEl ? viz.nodes.find(n => n.id === ontoEl.dataset.nodeId) : null;
    if (onto && onto.dataId !== data.id) {
      let dropped = viz.nodes.find(n => n.dataId === data.id);
      if (!dropped) {
        const pool = typeof getItemsForScope === 'function' ? getItemsForScope(scope) : [];
        const src = data.type === 'folder'
          ? (state.nodes || []).find(n => n.id === data.id)
          : pool.find(it => it.id === data.id);
        if (!src) return;
        dropped = vizAddCanvasNode(src.title || src.name || 'Untitled',
          data.type === 'folder' ? 'folder' : scope, data.id, scope,
          onto.x + 260, onto.y + 40);
      }
      vizAddLink(onto.id, dropped.id);
      vizRenderCanvas();
      vizSave();
      if (typeof toast === 'function') toast(`Linked to “${onto.label}”.`, { type: 'success' });
      return;
    }

    if (viz.nodes.find(n => n.dataId === data.id)) {
      const existing = viz.nodes.find(n => n.dataId === data.id);
      existing.x = x;
      existing.y = y;
    } else {
      if (data.type === 'folder') {
        const folder = state.nodes.find(n => n.id === data.id);
        if (folder) {
          const newNode = vizAddCanvasNode(folder.name, 'folder', data.id, scope, x, y);
          const parentId = folder.parentId || 'root';
          const parentViz = viz.nodes.find(n => n.dataId === parentId && n.scope === scope);
          if (parentViz) vizAddLink(parentViz.id, newNode.id);
        }
      } else {
        const items = typeof getItemsForScope === 'function' ? getItemsForScope(scope) : [];
        const item = items.find(it => it.id === data.id);
        if (item) {
          const newNode = vizAddCanvasNode(item.title || item.name || 'Untitled', scope, data.id, scope, x, y);
          const parentId = item.parentId || 'root';
          const parentViz = viz.nodes.find(n => n.dataId === parentId && n.scope === scope);
          if (parentViz) vizAddLink(parentViz.id, newNode.id);
        }
      }
    }
    vizRenderCanvas();
    vizSave();
  } catch (err) { console.error('Drop error:', err); }
}

function vizCanvasDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

/* ── Panning, pinching and marquee selection ──────────────────
   All pointer events. A plain drag on empty canvas pans; holding Shift (or
   Ctrl/Cmd) drags a selection box instead. Two fingers pinch to zoom. */

const _vizPointers = new Map();     // pointerId -> {x, y}
let _vizPinch = null;

function vizCanvasMouseDown(e) {
  if (viz.activeModule === 'brain') { brainCanvasMouseDown(e); return; }
  if (e.target.closest('.viz-node') || e.target.closest('.viz-minimap')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  _vizPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (_vizPointers.size === 2) { _vizStartPinch(); return; }
  if (_vizPointers.size > 2) return;

  // Clicking empty canvas while linking cancels the link.
  if (viz.linkingFrom) { vizCancelLinking(); return; }

  const container = document.getElementById('viz-canvas-container');
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    const rect = container.getBoundingClientRect();
    viz.marquee = {
      x0: (e.clientX - rect.left - viz.pan.x) / viz.zoom,
      y0: (e.clientY - rect.top - viz.pan.y) / viz.zoom,
      x1: 0, y1: 0, add: e.shiftKey
    };
    viz.marquee.x1 = viz.marquee.x0;
    viz.marquee.y1 = viz.marquee.y0;
    if (!e.shiftKey) { viz.selectedNodeIds.clear(); viz.selectedNodeId = null; }
    _vizPaintMarquee();
    return;
  }

  vizStopTween();
  viz.isPanning = true;
  viz.panStart = { x: e.clientX, y: e.clientY };
  viz.panStartOffset = { x: viz.pan.x, y: viz.pan.y };
  if (container) container.classList.add('panning');
}

function _vizStartPinch() {
  const pts = [..._vizPointers.values()];
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  _vizPinch = { dist: dist || 1, zoom: viz.zoom, cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
  viz.isPanning = false;
  const c = document.getElementById('viz-canvas-container');
  if (c) c.classList.remove('panning');
}

function vizCanvasMouseMove(e) {
  if (viz.activeModule === 'brain') { brainCanvasMouseMove(e); return; }

  if (_vizPointers.has(e.pointerId)) _vizPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (_vizPinch && _vizPointers.size >= 2) {
    const pts = [..._vizPointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const container = document.getElementById('viz-canvas-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = _vizPinch.cx - rect.left, my = _vizPinch.cy - rect.top;
    const tx = (mx - viz.pan.x) / viz.zoom, ty = (my - viz.pan.y) / viz.zoom;
    viz.zoom = vizClampZoom(_vizPinch.zoom * (dist / _vizPinch.dist));
    viz.pan.x = mx - tx * viz.zoom;
    viz.pan.y = my - ty * viz.zoom;
    vizApplyTransform();
    vizUpdateZoomDisplay();
    return;
  }

  if (viz.marquee) {
    const container = document.getElementById('viz-canvas-container');
    const rect = container.getBoundingClientRect();
    viz.marquee.x1 = (e.clientX - rect.left - viz.pan.x) / viz.zoom;
    viz.marquee.y1 = (e.clientY - rect.top - viz.pan.y) / viz.zoom;
    vizSchedulePaint(_vizPaintMarquee);
    return;
  }

  if (viz.linkingFrom) {
    const tempLink = document.getElementById('viz-temp-link');
    const container = document.getElementById('viz-canvas-container');
    if (tempLink && container) {
      const rect = container.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - viz.pan.x) / viz.zoom;
      const mouseY = (e.clientY - rect.top - viz.pan.y) / viz.zoom;
      const d = tempLink.getAttribute('d') || '';
      const mMatch = d.match(/M (\S+) (\S+)/);
      if (mMatch) {
        const fx = parseFloat(mMatch[1]), fy = parseFloat(mMatch[2]);
        const fromSide = viz.portDrag ? viz.portDrag.fromSide : null;
        const cp = vizTempLinkCP(fx, fy, mouseX, mouseY, fromSide);
        tempLink.setAttribute('d', `M ${fx} ${fy} C ${cp.c1x} ${cp.c1y}, ${cp.c2x} ${cp.c2y}, ${mouseX} ${mouseY}`);
      }
    }
  }
  if (!viz.isPanning) return;

  viz.pan.x = viz.panStartOffset.x + (e.clientX - viz.panStart.x);
  viz.pan.y = viz.panStartOffset.y + (e.clientY - viz.panStart.y);
  vizSchedulePaint(() => { vizApplyTransform(); });
}

/** The selection box, drawn in canvas coordinates so it tracks the graph. */
function _vizPaintMarquee() {
  const layer = document.getElementById('viz-nodes-layer');
  if (!layer) return;
  let box = document.getElementById('viz-marquee');
  if (!viz.marquee) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement('div');
    box.id = 'viz-marquee';
    box.className = 'viz-marquee';
    layer.appendChild(box);
  }
  const m = viz.marquee;
  const x = Math.min(m.x0, m.x1), y = Math.min(m.y0, m.y1);
  const w = Math.abs(m.x1 - m.x0), h = Math.abs(m.y1 - m.y0);
  box.style.left = x + 'px'; box.style.top = y + 'px';
  box.style.width = w + 'px'; box.style.height = h + 'px';

  // Live feedback: highlight what would be caught if you let go now.
  const g = vizVisibleGraph();
  g.nodes.forEach(n => {
    const nw = n.w || 200, nh = n.h || 60;
    const hit = n.x < x + w && n.x + nw > x && n.y < y + h && n.y + nh > y;
    const el = _vizNodeEls.get(n.id);
    if (el) el.classList.toggle('viz-marquee-hit', hit);
  });
}

function vizCanvasMouseUp(e) {
  if (viz.activeModule === 'brain') { brainCanvasMouseUp(e); return; }
  if (e && e.pointerId !== undefined) _vizPointers.delete(e.pointerId);
  if (_vizPointers.size < 2 && _vizPinch) { _vizPinch = null; vizSave(); }

  if (viz.marquee) {
    const m = viz.marquee;
    const x = Math.min(m.x0, m.x1), y = Math.min(m.y0, m.y1);
    const w = Math.abs(m.x1 - m.x0), h = Math.abs(m.y1 - m.y0);
    viz.marquee = null;
    _vizPaintMarquee();
    document.querySelectorAll('.viz-node.viz-marquee-hit').forEach(el => el.classList.remove('viz-marquee-hit'));
    if (w > 4 || h > 4) {
      const g = vizVisibleGraph();
      g.nodes.forEach(n => {
        const nw = n.w || 200, nh = n.h || 60;
        if (n.x < x + w && n.x + nw > x && n.y < y + h && n.y + nh > y) viz.selectedNodeIds.add(n.id);
      });
      if (viz.selectedNodeIds.size && !viz.selectedNodeId) viz.selectedNodeId = [...viz.selectedNodeIds][0];
      vizRenderCanvas();
      vizUpdateSelectionChip();
    }
    return;
  }

  if (viz.isPanning) {
    vizCancelScheduledPaint();
    viz.isPanning = false;
    const container = document.getElementById('viz-canvas-container');
    if (container) container.classList.remove('panning');
    vizApplyTransform();
    // Culling is keyed to the viewport, so a pan at low zoom needs a re-render
    // to bring newly-visible nodes in. Only matters on very large graphs.
    if (viz.zoom < VIZ_CULL_ZOOM && viz.nodes.length > 400) vizRenderCanvas();
    vizSave();
  }
}

/** How many nodes are selected, said out loud. */
function vizUpdateSelectionChip() {
  const el = document.getElementById('viz-selection-chip');
  if (!el) return;
  const n = viz.selectedNodeIds.size;
  el.classList.toggle('hidden', n < 2);
  if (n >= 2) el.innerHTML = `<i data-lucide="box-select" style="width:11px;height:11px;"></i> ${n} selected`
    + ` <button type="button" class="viz-chip-x" onclick="vizClearSelection()" aria-label="Clear selection">&times;</button>`;
  if (n >= 2 && typeof lucide !== 'undefined') lucide.createIcons({ el: el });
}

function vizClearSelection() {
  viz.selectedNodeIds.clear();
  vizRenderCanvas();
  vizUpdateSelectionChip();
}

function vizTempLinkCP(fx, fy, tx, ty, fromSide) {
  const dist = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2);
  const bend = Math.min(Math.max(dist * 0.45, 40), 200);
  let c1x = fx, c1y = fy;
  if (fromSide === 'right') { c1x = fx + bend; c1y = fy; }
  else if (fromSide === 'left') { c1x = fx - bend; c1y = fy; }
  else if (fromSide === 'top') { c1x = fx; c1y = fy - bend; }
  else if (fromSide === 'bottom') { c1x = fx; c1y = fy + bend; }
  else {
    const dx = tx - fx, dy = ty - fy;
    if (Math.abs(dx) >= Math.abs(dy)) { c1x = fx + (dx > 0 ? bend : -bend); c1y = fy; }
    else { c1x = fx; c1y = fy + (dy > 0 ? bend : -bend); }
  }
  const dx2 = fx - tx, dy2 = fy - ty;
  const b2 = bend * 0.8;
  let c2x = tx, c2y = ty;
  if (Math.abs(dx2) >= Math.abs(dy2)) { c2x = tx + (dx2 > 0 ? b2 : -b2); c2y = ty; }
  else { c2x = tx; c2y = ty + (dy2 > 0 ? b2 : -b2); }
  return { c1x, c1y, c2x, c2y };
}

let _vizWheelSaveTimer = null;

function vizCanvasWheel(e) {
  if (viz.activeModule === 'brain') { brainCanvasWheel(e); return; }
  e.preventDefault();
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;
  vizStopTween();

  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const targetX = (mouseX - viz.pan.x) / viz.zoom;
  const targetY = (mouseY - viz.pan.y) / viz.zoom;

  // Multiplicative zoom — uniform feel at every zoom level (like Obsidian)
  const factor = e.deltaY > 0 ? 0.92 : 1.087;
  const newZoom = vizClampZoom(viz.zoom * factor);

  viz.pan.x = mouseX - targetX * newZoom;
  viz.pan.y = mouseY - targetY * newZoom;
  viz.zoom = newZoom;

  // Transform-only update: a full vizRenderCanvas() + localStorage write per
  // wheel tick rebuilt the entire node DOM and made zooming feel janky.
  vizApplyTransform();
  vizUpdateZoomDisplay();
  clearTimeout(_vizWheelSaveTimer);
  _vizWheelSaveTimer = setTimeout(() => {
    vizSave();
    if (viz.nodes.length > 400) vizRenderCanvas();
  }, 400);
}

function vizZoomIn() { vizZoomBy(1.2); }
function vizZoomOut() { vizZoomBy(1 / 1.2); }

/** Zoom about the centre of the canvas, eased. */
function vizZoomBy(factor) {
  const c = document.getElementById('viz-canvas-container');
  const cam = viz.activeModule === 'brain' ? brain : viz;
  if (!c) { cam.zoom = vizClampZoom(cam.zoom * factor); vizApplyTransform(); return; }
  const mx = c.offsetWidth / 2, my = c.offsetHeight / 2;
  const tx = (mx - cam.pan.x) / cam.zoom, ty = (my - cam.pan.y) / cam.zoom;
  const z = vizClampZoom(cam.zoom * factor);
  vizTweenView({ x: mx - tx * z, y: my - ty * z }, z, () => {
    if (viz.activeModule === 'brain') brainSaveCurrentVersion(); else vizSave();
  });
}

function vizZoomReset() { vizCenterCanvas(); }

function vizUpdateZoomDisplay() {
  const el = document.getElementById('viz-zoom-level');
  const z = viz.activeModule === 'brain' ? brain.zoom : viz.zoom;
  if (el) el.textContent = Math.round(z * 100) + '%';
}

/**
 * Fit the visible graph on screen.
 *
 * The zoom floor used to be 0.2, and no layout this module produces fits at
 * 0.2 — auto-populate builds a 1:13 ribbon. Pressing F left most of the graph
 * off screen with no way to zoom out further. VIZ_ZOOM_MIN is 0.04 now, and
 * the layouts below aim for a shape that does not need it.
 */
function vizCenterCanvas(instant) {
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;
  const g = vizVisibleGraph();
  if (!g.nodes.length) { viz.pan = { x: 0, y: 0 }; viz.zoom = 1; vizApplyTransform(); return; }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  g.nodes.forEach(n => {
    const nw = n.w || 200, nh = n.h || 80;
    if (n.x < minX) minX = n.x;
    if (n.x + nw > maxX) maxX = n.x + nw;
    if (n.y < minY) minY = n.y;
    if (n.y + nh > maxY) maxY = n.y + nh;
  });

  const padding = 90;
  const contentWidth = (maxX - minX) + padding * 2;
  const contentHeight = (maxY - minY) + padding * 2;
  const zoom = vizClampZoom(Math.min(container.offsetWidth / contentWidth, container.offsetHeight / contentHeight, 1.2));

  const centerX = minX + (maxX - minX) / 2;
  const centerY = minY + (maxY - minY) / 2;
  const pan = { x: container.offsetWidth / 2 - centerX * zoom, y: container.offsetHeight / 2 - centerY * zoom };

  if (instant) { viz.pan = pan; viz.zoom = zoom; vizApplyTransform(); vizUpdateZoomDisplay(); }
  else vizTweenView(pan, zoom);
  vizSave();
}

/* ── Auto-layout ───────────────────────────────────────────────
   The old one put every subtree in a single row and capped leaf grids at three
   columns, which turned 181 nodes into a 30,324 x 1,202 strip — a 25:1 shape
   no zoom level can read, and the reason "Fit" could never fit.

   The fix is one idea applied at every level rather than only at the top: a
   parent's children are SHELF-PACKED into rows whose target width comes from
   the area they cover, so a node with thirty children gets a block roughly as
   wide as it is tall instead of a thirty-wide ribbon. */

const VIZ_LAY = { NW: 210, NH: 66, GX: 46, GY: 90, ROWGAP: 26, ASPECT: 1.7 };

/** Pack blocks into rows no wider than targetW. Returns rows + total size. */
function _vizShelf(blocks, targetW, gapX, gapY) {
  const rows = [];
  let row = [], rowW = 0, rowH = 0;
  blocks.forEach(b => {
    const add = row.length ? gapX + b.w : b.w;
    if (row.length && rowW + add > targetW) {
      rows.push({ items: row, w: rowW, h: rowH });
      row = []; rowW = 0; rowH = 0;
    }
    row.push(b);
    rowW += row.length > 1 ? gapX + b.w : b.w;
    rowH = Math.max(rowH, b.h);
  });
  if (row.length) rows.push({ items: row, w: rowW, h: rowH });
  const w = Math.max(...rows.map(r => r.w), 0);
  const h = rows.reduce((a, r) => a + r.h, 0) + Math.max(0, rows.length - 1) * gapY;
  return { rows, w, h };
}

function vizAutoLayout(kind) {
  const g = vizVisibleGraph();
  if (!g.nodes.length) return;
  vizPushUndo();

  const children = new Map();
  const hasParent = new Set();
  g.links.filter(l => !l.isCustom).forEach(l => {
    if (!children.has(l.from)) children.set(l.from, []);
    children.get(l.from).push(l.to);
    hasParent.add(l.to);
  });

  let roots = g.nodes.filter(n => !hasParent.has(n.id));
  if (!roots.length) roots = [g.nodes[0]];

  const done = new Set();
  const pos = new Map();

  /** Measure one subtree into a block: the node, then its packed children. */
  function measure(id) {
    if (done.has(id)) return null;
    done.add(id);
    const kids = (children.get(id) || []).map(measure).filter(Boolean);
    if (!kids.length) return { id, w: VIZ_LAY.NW, h: VIZ_LAY.NH, rows: null };

    // Target width from the area the children cover, biased to the shape of a
    // screen. sqrt(area * 1.7) is a block about 1.7 times wider than tall.
    const area = kids.reduce((a, b) => a + (b.w + VIZ_LAY.GX) * (b.h + VIZ_LAY.ROWGAP), 0);
    const targetW = Math.max(...kids.map(b => b.w), Math.sqrt(area * VIZ_LAY.ASPECT));
    const packed = _vizShelf(kids, targetW, VIZ_LAY.GX, VIZ_LAY.ROWGAP);
    return {
      id,
      w: Math.max(VIZ_LAY.NW, packed.w),
      h: VIZ_LAY.NH + VIZ_LAY.GY + packed.h,
      rows: packed.rows
    };
  }

  /** Place a measured block with its top-left corner at (x, y). */
  function place(box, x, y) {
    pos.set(box.id, { x: Math.round(x + box.w / 2 - VIZ_LAY.NW / 2), y: Math.round(y) });
    if (!box.rows) return;
    let cy = y + VIZ_LAY.NH + VIZ_LAY.GY;
    box.rows.forEach(row => {
      // Centre each row under the parent, so the tree reads as a tree.
      let cx = x + (box.w - row.w) / 2;
      row.items.forEach(b => { place(b, cx, cy); cx += b.w + VIZ_LAY.GX; });
      cy += row.h + VIZ_LAY.ROWGAP;
    });
  }

  const rootBoxes = roots.map(r => measure(r.id)).filter(Boolean);
  // Islands — anything not reachable from a root — become blocks of their own
  // rather than a row tacked on the end.
  g.nodes.forEach(n => { const b = measure(n.id); if (b) rootBoxes.push(b); });

  const area = rootBoxes.reduce((a, b) => a + (b.w + VIZ_LAY.GX) * (b.h + VIZ_LAY.GY), 0);
  const c = document.getElementById('viz-canvas-container');
  const aspect = c && c.offsetHeight ? Math.max(1, c.offsetWidth / c.offsetHeight) : VIZ_LAY.ASPECT;
  const targetW = Math.max(...rootBoxes.map(b => b.w), Math.sqrt(area * aspect));
  const top = _vizShelf(rootBoxes, targetW, VIZ_LAY.GX * 2, VIZ_LAY.GY);

  let cy = 0;
  top.rows.forEach(row => {
    let cx = 0;
    row.items.forEach(b => { place(b, cx, cy); cx += b.w + VIZ_LAY.GX * 2; });
    cy += row.h + VIZ_LAY.GY;
  });

  g.nodes.forEach(n => {
    const p = pos.get(n.id);
    if (p) { n.x = p.x; n.y = p.y; }
  });

  _vizLinkSig = '';
  vizRenderCanvas();
  vizSave();
  setTimeout(() => vizCenterCanvas(), 30);
  if (typeof toast === 'function' && kind !== 'silent') toast('Nodes arranged.', { type: 'success' });
}

/* ── Minimap ───────────────────────────────────────────────────
   It drew every node in scope, ignoring the depth filter and collapsed
   subtrees, so with "Folders only" it showed a picture of 181 nodes next to a
   canvas showing 34. And the viewport rectangle could only be clicked, never
   dragged, which is the gesture everyone tries first. */

function vizUpdateMinimap() {
  const canvas = document.getElementById('viz-minimap-canvas');
  const container = document.getElementById('viz-canvas-container');
  const viewportEl = document.getElementById('viz-minimap-viewport');
  if (!canvas || !container) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const g = vizVisibleGraph();
  const nodes = g.nodes;
  if (!nodes.length) { if (viewportEl) viewportEl.style.display = 'none'; return; }
  if (viewportEl) viewportEl.style.display = '';

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + (n.w || 200));
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + (n.h || 60));
  });
  const pad = 40;
  const worldW = Math.max(maxX - minX + pad * 2, 1);
  const worldH = Math.max(maxY - minY + pad * 2, 1);
  const scale = Math.min(W / worldW, H / worldH);
  const ox = (W - worldW * scale) / 2 - (minX - pad) * scale;
  const oy = (H - worldH * scale) / 2 - (minY - pad) * scale;

  canvas._mmScale = scale;
  canvas._mmOx = ox;
  canvas._mmOy = oy;

  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  g.links.forEach(l => {
    const fn = g.nodeById.get(l.from), tn = g.nodeById.get(l.to);
    if (!fn || !tn) return;
    ctx.moveTo(fn.x * scale + ox, fn.y * scale + oy);
    ctx.lineTo(tn.x * scale + ox, tn.y * scale + oy);
  });
  ctx.stroke();

  const typeColors = { root: '#6366f1', folder: '#06b6d4', challenge: '#22c55e', snippet: '#f59e0b', notebook: '#a855f7', comment: '#f97316' };
  nodes.forEach(n => {
    const nx = n.x * scale + ox, ny = n.y * scale + oy;
    const nw = Math.max((n.w || 150) * scale, 4), nh = Math.max((n.h || 48) * scale, 3);
    const isSelected = n.id === viz.selectedNodeId || viz.selectedNodeIds.has(n.id);
    // The minimap follows the same colour rule the canvas is using, so the two
    // pictures agree with each other.
    ctx.fillStyle = isSelected ? '#6366f1' : (vizNodeTint(n) || (n.color ? vizColorMap(n.color) : null) || typeColors[n.type] || '#64748b');
    ctx.globalAlpha = isSelected ? 1 : 0.65;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(nx, ny, Math.max(nw, 6), Math.max(nh, 4), 2);
    else ctx.rect(nx, ny, Math.max(nw, 6), Math.max(nh, 4));
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  const vx = (-viz.pan.x / viz.zoom) * scale + ox;
  const vy = (-viz.pan.y / viz.zoom) * scale + oy;
  const vw = (container.offsetWidth / viz.zoom) * scale;
  const vh = (container.offsetHeight / viz.zoom) * scale;
  if (viewportEl) {
    const clampedX = Math.max(0, Math.min(vx, W));
    const clampedY = Math.max(0, Math.min(vy, H));
    viewportEl.style.left = clampedX + 'px';
    viewportEl.style.top = clampedY + 'px';
    viewportEl.style.width = Math.max(Math.min(vw, W - clampedX), 4) + 'px';
    viewportEl.style.height = Math.max(Math.min(vh, H - clampedY), 4) + 'px';
  }
}

/** Move the view so the given minimap point is centred. */
function _vizMinimapGoto(clientX, clientY, tween) {
  const canvas = document.getElementById('viz-minimap-canvas');
  const container = document.getElementById('viz-canvas-container');
  if (!canvas || !container || canvas._mmScale === undefined) return;
  const cam = viz.activeModule === 'brain' ? brain : viz;
  const rect = canvas.getBoundingClientRect();
  const worldX = ((clientX - rect.left) - canvas._mmOx) / canvas._mmScale;
  const worldY = ((clientY - rect.top) - canvas._mmOy) / canvas._mmScale;
  const pan = { x: container.offsetWidth / 2 - worldX * cam.zoom, y: container.offsetHeight / 2 - worldY * cam.zoom };
  if (tween) vizTweenView(pan, cam.zoom);
  else { cam.pan = pan; vizApplyTransform(); }
}

function _vizMinimapSave() {
  if (viz.activeModule === 'brain') brainSaveCurrentVersion(); else vizSave();
}

function vizMinimapClick(e) {
  _vizMinimapGoto(e.clientX, e.clientY, true);
  _vizMinimapSave();
}

/** Drag the viewport rectangle around the map — the gesture everyone tries. */
function vizMinimapDragStart(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  vizStopTween();
  const move = (ev) => vizSchedulePaint(() => _vizMinimapGoto(ev.clientX, ev.clientY, false));
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    vizCancelScheduledPaint();
    _vizMinimapSave();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
  _vizMinimapGoto(e.clientX, e.clientY, false);
}

function vizCanvasDblClick(e) {
  if (viz.activeModule === 'brain') { brainCanvasDblClick(e); return; }
  if (e.target.closest('.viz-node') || e.target.closest('.viz-minimap') || e.target.closest('.viz-canvas-empty')) return;
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const x = (e.clientX - rect.left - viz.pan.x) / viz.zoom;
  const y = (e.clientY - rect.top - viz.pan.y) / viz.zoom;
  viz.contextPos = { x, y };
  vizCtxAddNode();
}

/* ── Export ────────────────────────────────────────────────────
   A map you spent an evening arranging could not leave the browser. Brain
   versions could at least be shared; the library canvases could not. */

function _vizExportSVG() {
  const g = vizVisibleGraph();
  if (!g.nodes.length) { if (typeof toast === 'function') toast('Nothing on the canvas to export.', { type: 'info' }); return null; }

  const sizes = new Map();
  g.nodes.forEach(n => {
    const el = _vizNodeEls.get(n.id);
    sizes.set(n.id, { w: (el && el.offsetWidth) || n.w || 180, h: (el && el.offsetHeight) || n.h || 50 });
  });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  g.nodes.forEach(n => {
    const s = sizes.get(n.id);
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + s.w); maxY = Math.max(maxY, n.y + s.h);
  });
  const pad = 48;
  const W = Math.ceil(maxX - minX + pad * 2), H = Math.ceil(maxY - minY + pad * 2);
  const ox = pad - minX, oy = pad - minY;

  const typeColors = { root: '#6366f1', folder: '#06b6d4', challenge: '#22c55e', snippet: '#f59e0b', notebook: '#a855f7', comment: '#f97316' };
  let body = '';
  g.links.forEach(l => {
    const f = g.nodeById.get(l.from), t = g.nodeById.get(l.to);
    const fs = sizes.get(l.from), ts = sizes.get(l.to);
    if (!f || !t) return;
    const d = vizBezierPath(f.x + ox, f.y + oy, fs.w, fs.h, t.x + ox, t.y + oy, ts.w, ts.h, l.fromSide, l.toSide);
    const stroke = l.color ? vizColorMap(l.color) : (l.locked ? '#f59e0b' : '#94a3b8');
    body += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.6" opacity="0.75"/>`;
    if (l.label) {
      const mx = (f.x + ox + fs.w / 2 + t.x + ox + ts.w / 2) / 2;
      const my = (f.y + oy + fs.h / 2 + t.y + oy + ts.h / 2) / 2;
      body += `<text x="${mx}" y="${my - 5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#64748b">${escapeHTML(l.label)}</text>`;
    }
  });
  g.nodes.forEach(n => {
    const s = sizes.get(n.id);
    const fill = vizNodeTint(n) || (n.color ? vizColorMap(n.color) : null) || typeColors[n.type] || '#64748b';
    const x = n.x + ox, y = n.y + oy;
    const text = n.type === 'comment' ? (n.commentContent || '') : (n.label || '');
    const clipped = text.length > 34 ? text.slice(0, 33) + '…' : text;
    body += `<rect x="${x}" y="${y}" width="${s.w}" height="${s.h}" rx="10" fill="#0f172a" stroke="${fill}" stroke-width="2"/>`
      + `<rect x="${x}" y="${y}" width="4" height="${s.h}" rx="2" fill="${fill}"/>`
      + `<text x="${x + 16}" y="${y + s.h / 2 + 4}" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#e2e8f0">${escapeHTML(clipped)}</text>`;
  });

  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="#0b1220"/>${body}</svg>`, W, H };
}

function _vizDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function vizExportSVG() {
  const out = _vizExportSVG();
  if (!out) return;
  const url = URL.createObjectURL(new Blob([out.svg], { type: 'image/svg+xml' }));
  _vizDownload(url, vizExportName() + '.svg');
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  if (typeof toast === 'function') toast('Canvas exported as SVG.', { type: 'success' });
}

function vizExportPNG() {
  const out = _vizExportSVG();
  if (!out) return;
  const scale = Math.min(2, Math.max(1, 2200 / Math.max(out.W, out.H)));
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = Math.round(out.W * scale);
    cv.height = Math.round(out.H * scale);
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob((blob) => {
      if (!blob) { if (typeof toast === 'function') toast('Could not render the PNG.', { type: 'error' }); return; }
      const url = URL.createObjectURL(blob);
      _vizDownload(url, vizExportName() + '.png');
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (typeof toast === 'function') toast('Canvas exported as PNG.', { type: 'success' });
    }, 'image/png');
  };
  img.onerror = () => { if (typeof toast === 'function') toast('Could not render the PNG.', { type: 'error' }); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out.svg);
}

function vizExportName() {
  const label = vizSurfaceLabel().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return 'studysession-' + label + '-' + new Date().toISOString().slice(0, 10);
}

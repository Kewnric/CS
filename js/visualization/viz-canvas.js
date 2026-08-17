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
  document.addEventListener('mousemove', onPortDragMove, true);

  // Complete the port drag on mouseup — find if cursor is over a node
  function onPortDragUp(upEvent) {
    document.removeEventListener('mouseup', onPortDragUp, true);
    document.removeEventListener('mousemove', onPortDragMove, true);
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
  document.addEventListener('mouseup', onPortDragUp, true);
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

function vizGetVisibleScopes() {
  if (viz.activeModule === 'brain') return [];
  if (viz.activeModule === 'general') return ['challenge', 'snippet', 'notebook'];
  return [viz.activeModule];
}

function vizCenterCanvas() {
  const container = document.getElementById('viz-canvas-container');
  if (!container || viz.nodes.length === 0) return;

  const scopes = vizGetVisibleScopes();
  const visibleNodes = viz.nodes.filter(n => scopes.includes(n.scope) && vizDepthAllows(n));

  if (visibleNodes.length === 0) {
    viz.pan = { x: 0, y: 0 };
    viz.zoom = 1;
    return;
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  visibleNodes.forEach(n => {
    const nw = n.w || 200;
    const nh = n.h || 80;
    if (n.x < minX) minX = n.x;
    if (n.x + nw > maxX) maxX = n.x + nw;
    if (n.y < minY) minY = n.y;
    if (n.y + nh > maxY) maxY = n.y + nh;
  });

  const padding = 150;
  const contentWidth = (maxX - minX) + (padding * 2);
  const contentHeight = (maxY - minY) + (padding * 2);

  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;

  let scaleX = containerWidth / contentWidth;
  let scaleY = containerHeight / contentHeight;
  let newZoom = Math.min(scaleX, scaleY, 1.2);
  newZoom = Math.max(newZoom, 0.2);

  viz.zoom = newZoom;

  const centerX = minX + (maxX - minX) / 2;
  const centerY = minY + (maxY - minY) / 2;

  viz.pan.x = (containerWidth / 2) - (centerX * viz.zoom);
  viz.pan.y = (containerHeight / 2) - (centerY * viz.zoom);

  vizRenderCanvas();
  vizSave();
}

function vizRenderCanvas() {
  if (viz.activeModule === 'brain') { brainRenderCanvas(); return; }
  const container = document.getElementById('viz-canvas-container');
  const svg = document.getElementById('viz-canvas-svg');
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const emptyState = document.getElementById('viz-canvas-empty');
  if (!container || !nodesLayer) return;

  vizPruneGhostNodes();

  const scopes = vizGetVisibleScopes();
  const hiddenByCollapse = new Set();
  viz.collapsedNodeIds.forEach(cid => {
    const cNode = viz.nodes.find(n => n.id === cid);
    if (cNode && scopes.includes(cNode.scope)) {
      vizGetAllDescendants(cid, viz.nodes, viz.links).forEach(d => hiddenByCollapse.add(d));
    }
  });
  const visibleNodes = viz.nodes.filter(n => scopes.includes(n.scope) && !hiddenByCollapse.has(n.id) && vizDepthAllows(n));
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleLinks = viz.links.filter(l => visibleNodeIds.has(l.from) && visibleNodeIds.has(l.to));

  if (emptyState) emptyState.classList.toggle('hidden', visibleNodes.length > 0);

  nodesLayer.style.transform = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;
  svg.style.transform = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;

  nodesLayer.innerHTML = '';
  const renderedNodeMap = new Map();
  visibleNodes.forEach(node => {
    const isLinked = visibleLinks.some(l => l.from === node.id || l.to === node.id);
    const linkedClass = (!isLinked && node.type !== 'root' && node.type !== 'comment') ? 'not-linked' : '';

    let isFogged = false;
    if (viz.fogEnabled && node.type !== 'root' && node.type !== 'comment') {
      const incomingLockedLinks = visibleLinks.filter(l => l.to === node.id && l.locked);
      if (incomingLockedLinks.length > 0) {
        for (const ll of incomingLockedLinks) {
          const parentViz = viz.nodes.find(n => n.id === ll.from);
          if (parentViz && parentViz.dataId) {
            const targetDataId = node.dataId || parentViz.dataId;
            const req = state.categoryRequirements ? state.categoryRequirements[targetDataId] : null;
            if (req) {
              if (req.requiredChallengeIds && req.requiredChallengeIds.length > 0) {
                isFogged = req.requiredChallengeIds.some(cId => !state.history.some(h => h.challengeId === cId && h.score === 100 && !h.isArchived));
              } else if (req.reqNodeId) {
                const completed = typeof getCompletedCount === 'function' ? getCompletedCount(req.reqNodeId) : 0;
                isFogged = completed < (req.count || 1);
              }
            }
          }
        }
      }
      if (!isFogged && node.dataId && node.type === 'folder') {
        const folderReq = state.categoryRequirements ? state.categoryRequirements[node.dataId] : null;
        if (folderReq) {
          if (folderReq.requiredChallengeIds && folderReq.requiredChallengeIds.length > 0) {
            isFogged = folderReq.requiredChallengeIds.some(cId => !state.history.some(h => h.challengeId === cId && h.score === 100 && !h.isArchived));
          } else if (folderReq.reqNodeId) {
            const completed = typeof getCompletedCount === 'function' ? getCompletedCount(folderReq.reqNodeId) : 0;
            isFogged = completed < (folderReq.count || 1);
          }
        }
      }
    }

    const fogClass = isFogged ? 'viz-fog-of-war' : '';

    const isGlobe = viz.globeModeEnabled && node.type !== 'comment' && node.type !== 'root';

    const el = document.createElement('div');
    el.className = `viz-node ${node.id === viz.selectedNodeId ? 'selected' : ''} ${linkedClass} ${fogClass}${isGlobe ? ' viz-globe-node' : ''}`;
    el.dataset.type = node.type || 'item';
    // On the General canvas a program, a snippet and a notebook were identical
    // rectangles — the only way to tell them apart was to read a 6px label.
    if (node.scope) el.dataset.scope = node.scope;
    if (node.color) el.dataset.color = node.color;
    if (node.isDraft) el.dataset.draft = "true";
    if (node.type === 'comment') el.dataset.format = node.commentFormat || 'auto';
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    el.dataset.nodeId = node.id;

    const iconMap = { root: 'server', folder: 'folder', challenge: 'code', snippet: 'file-text', notebook: 'book', comment: 'message-circle' };
    const icon = node.icon || iconMap[node.type] || iconMap[node.scope] || 'file';

    const displayLabel = isFogged ? '???' : escapeHTML(node.label);

    let isCompleted = false;
    let completionCount = 0;
    if (!isFogged && node.type === 'challenge' && node.dataId) {
      const attempts = (state.history || []).filter(h => h.challengeId === node.dataId && !h.isArchived);
      const perfect = attempts.filter(h => h.score === 100);
      isCompleted = perfect.length > 0;
      completionCount = perfect.length;
    }

    const isHighlighted = viz.searchQuery && viz.highlightedNodeIds.has(node.id);
    const isDimmed = viz.searchQuery && !viz.highlightedNodeIds.has(node.id) && node.type !== 'root';
    if (isHighlighted) el.classList.add('viz-search-match');
    if (isDimmed) el.classList.add('viz-search-dim');

    let subtitle = '';
    if (node.type !== 'comment' && node.type !== 'root') {
      const scopeLabels = { challenge: 'Program', snippet: 'Snippet', notebook: 'Notebook' };
      let typeLabel = node.type === 'folder' ? 'Category' : (scopeLabels[node.scope] || node.scope || '');
      const scopeText = isFogged ? 'Locked' : escapeHTML(typeLabel);
      const countText = isCompleted && completionCount > 0 ? ` · ×${completionCount}` : '';
      subtitle = `<div class="viz-node-subtitle">${scopeText}${countText}</div>`;
    }

    let collapseBadgeHTML = '';
    if (node.collapsed) {
      const collapsedCount = (node._collapsedChildren || []).length;
      collapseBadgeHTML = `<span class="viz-collapse-badge" title="${collapsedCount} hidden children">+${collapsedCount}</span>`;
    }

    if (node.type === 'comment') {
      // Only a size you actually dragged is honoured — see the observer below.
      const styleW = (node.userSized && node.w) ? `width: ${node.w}px;` : 'width: 250px;';
      const styleH = (node.userSized && node.h) ? `height: ${node.h}px;` : 'height: fit-content;';
      el.innerHTML = `<div class="viz-node-inner" style="${styleW} ${styleH}">
        <div class="viz-comment-body">
          <div class="viz-comment-content">${escapeHTML(node.commentContent || 'Double click or right click to edit comment...')}</div>
        </div>
      </div>`;

      setTimeout(() => {
        const inner = el.querySelector('.viz-node-inner');
        if (!inner) return;
        // Disconnect the previous observer — re-renders used to leak one per render
        if (node._resizeObserver) node._resizeObserver.disconnect();
        // ResizeObserver fires once for the current size as soon as it starts
        // observing. Treating that as a resize baked the first layout's height
        // into the note, which then clipped its own text as soon as it grew.
        let initial = true;
        const observer = new ResizeObserver(() => {
          if (initial) { initial = false; return; }
          if (inner.offsetWidth > 0) {
            node.w = inner.offsetWidth;
            node.h = inner.offsetHeight;
            node.userSized = true;
          }
        });
        observer.observe(inner);
        node._resizeObserver = observer;
      }, 0);
    } else if (isGlobe) {
      // Globe mode: collapsed circle with icon, expands to full card on hover
      const badgeHTML = isCompleted
        ? `<span class="viz-globe-badge"><i data-lucide="check" style="width:8px;height:8px;"></i></span>`
        : '';
      el.innerHTML = `
        <div class="viz-globe-circle" title="${displayLabel}">
          <i data-lucide="${isFogged ? 'lock' : icon}"></i>
          ${badgeHTML}
        </div>
        <div class="viz-globe-expand">
          <div class="viz-node-header">
            <i data-lucide="${isFogged ? 'lock' : icon}"></i>
            <span class="viz-node-title">${displayLabel}</span>
            ${isCompleted ? `<span class="viz-node-badge viz-node-badge-done"><i data-lucide="check" style="width:10px;height:10px;"></i></span>` : ''}
          </div>
          ${subtitle}
        </div>
        ${collapseBadgeHTML}
        ${isFogged ? '<div class="viz-fog-overlay"><i data-lucide="eye-off"></i></div>' : ''}
      `;
    } else {
      const badgeHTML = isCompleted
        ? `<span class="viz-node-badge viz-node-badge-done" title="Completed!"><i data-lucide="check" style="width:10px;height:10px;"></i></span>`
        : '';
      el.innerHTML = `<div class="viz-node-inner">
        <div class="viz-node-header">
          <i data-lucide="${isFogged ? 'lock' : icon}"></i>
          <span class="viz-node-title">${displayLabel}</span>
          ${badgeHTML}
        </div>
        ${subtitle}
      </div>
      ${collapseBadgeHTML}
      ${isFogged ? '<div class="viz-fog-overlay"><i data-lucide="eye-off"></i><span class="viz-fog-label">???</span></div>' : ''}`;
    }

    el.addEventListener('mousedown', (e) => vizNodeMouseDown(e, node.id));
    el.addEventListener('click', (e) => vizNodeClick(e, node.id));
    el.addEventListener('contextmenu', (e) => vizNodeCtx(e, node.id));
    // Obsidian-style hover focus: highlight this node + neighbors, fade the rest
    el.addEventListener('mouseenter', () => { if (typeof vizHoverFocus === 'function') vizHoverFocus(node.id); });
    el.addEventListener('mouseleave', () => { if (typeof vizHoverClear === 'function') vizHoverClear(); });
    el.addEventListener('mousemove', (e) => {
      if (node.type === 'comment') return;
      const r = el.getBoundingClientRect();
      const lx = e.clientX - r.left, ly = e.clientY - r.top;
      const w = r.width, h = r.height;
      // Distance to each edge
      const dTop = ly, dBottom = h - ly, dLeft = lx, dRight = w - lx;
      const min = Math.min(dTop, dBottom, dLeft, dRight);
      const side = min === dTop ? 'top' : min === dBottom ? 'bottom' : min === dLeft ? 'left' : 'right';
      el.dataset.nearSide = side;
    });
    el.addEventListener('mouseleave', () => { delete el.dataset.nearSide; });

    if (node.type === 'comment') {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        vizHideAllMenus();
        vizOpenCommentEditor(node);
      });
    } else {
      el.addEventListener('dblclick', (e) => vizNodeDblClick(e, node.id));
    }

    // Add connection ports (not on comment nodes — they're free-form)
    if (node.type !== 'comment') {
      ['top','right','bottom','left'].forEach(side => {
        const port = document.createElement('div');
        port.className = 'viz-port';
        port.dataset.side = side;
        port.dataset.nodeId = node.id;
        port.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          vizPortDragStart(e, node.id, side);
        });
        el.appendChild(port);
      });
    }

    // Entrance animation only for newly added nodes (flag set by addCanvasNode)
    if (node._isNew) {
      el.classList.add('viz-node-entering');
      delete node._isNew;
      setTimeout(() => el.classList.remove('viz-node-entering'), 400);
    }

    nodesLayer.appendChild(el);
    renderedNodeMap.set(node.id, el);
  });

  let svgContent = '';
  visibleLinks.forEach(link => {
    const fromNode = visibleNodes.find(n => n.id === link.from);
    const toNode = visibleNodes.find(n => n.id === link.to);
    if (!fromNode || !toNode) return;

    const fromEl = renderedNodeMap.get(link.from);
    const toEl = renderedNodeMap.get(link.to);

    const fromW = fromEl ? fromEl.offsetWidth : (fromNode.type === 'root' ? 160 : 180);
    const fromH = fromEl ? fromEl.offsetHeight : (fromNode.type === 'root' ? 60 : 50);
    const toW = toEl ? toEl.offsetWidth : (toNode.type === 'root' ? 160 : 180);
    const toH = toEl ? toEl.offsetHeight : (toNode.type === 'root' ? 60 : 50);

    const cpPath = vizBezierPath(
      fromNode.x, fromNode.y, fromW, fromH,
      toNode.x, toNode.y, toW, toH,
      link.fromSide, link.toSide
    );
    const linkColorHex = link.color ? vizColorMap(link.color) : null;
    const linkColorStyle = linkColorHex ? `stroke:${linkColorHex};` : '';
    const isLocked = link.locked;
    const isCustom = link.isCustom;
    const cls = isLocked ? 'viz-link locked' : isCustom ? 'viz-link custom-link' : 'viz-link';
    // Use a dynamic colored marker when the link has a custom color
    let baseArrowId;
    if (link.color) {
      baseArrowId = `viz-arrowhead-col-${link.color}`;
    } else if (isLocked) {
      baseArrowId = 'viz-arrowhead-locked';
    } else if (isCustom) {
      baseArrowId = 'viz-arrowhead-custom';
    } else {
      baseArrowId = 'viz-arrowhead';
    }
    const arrowType = link.arrowType || viz.defaultLinkArrowType || 'arrow';
    const markerEnd = arrowType !== 'none' ? `marker-end="url(#${baseArrowId})"` : '';
    const markerStart = arrowType === 'double-arrow' ? `marker-start="url(#${baseArrowId}-back)"` : '';
    svgContent += `<g class="viz-link-group" data-link-id="${link.id}" oncontextmenu="vizLinkCtx(event,'${link.id}')">
      <path class="viz-link-hitbox" d="${cpPath}"/>
      <path class="${cls}" d="${cpPath}" style="${linkColorStyle}" ${markerEnd} ${markerStart}/>
    </g>`;
  });

  if (viz.linkingFrom && visibleNodeIds.has(viz.linkingFrom)) {
    const fromNode = visibleNodes.find(n => n.id === viz.linkingFrom);
    const fromEl = renderedNodeMap.get(viz.linkingFrom);
    if (fromNode) {
      const fw = fromEl ? fromEl.offsetWidth : (fromNode.type === 'root' ? 160 : 180);
      const fh = fromEl ? fromEl.offsetHeight : (fromNode.type === 'root' ? 60 : 50);
      const side = viz.portDrag ? viz.portDrag.fromSide : (viz._linkFromSide || 'right');
      const port = vizPortCenter(fromNode.x, fromNode.y, fw, fh, side);
      svgContent += `<path id="viz-temp-link" class="viz-link custom-link" d="M ${port.x} ${port.y} L ${port.x} ${port.y}" style="pointer-events:none;"/>`;
    }
  }

  svg.innerHTML = svgContent;
  // Rebuild defs every render to include dynamic per-color arrowheads
  const colorArrowDefs = Object.entries({ red:'#ef4444', orange:'#f97316', yellow:'#eab308', green:'#22c55e', blue:'#3b82f6', purple:'#a855f7', pink:'#ec4899', cyan:'#06b6d4' })
    .map(([name, hex]) => `
      <marker id="viz-arrowhead-col-${name}" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${hex}" opacity="0.9"/></marker>
      <marker id="viz-arrowhead-col-${name}-back" markerWidth="8" markerHeight="6" refX="2" refY="3" orient="auto"><polygon points="8 0, 0 3, 8 6" fill="${hex}" opacity="0.9"/></marker>
    `).join('');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <marker id="viz-arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--text-tertiary)" opacity="0.6"/></marker>
    <marker id="viz-arrowhead-back" markerWidth="8" markerHeight="6" refX="2" refY="3" orient="auto"><polygon points="8 0, 0 3, 8 6" fill="var(--text-tertiary)" opacity="0.6"/></marker>
    <marker id="viz-arrowhead-locked" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#f59e0b" opacity="0.8"/></marker>
    <marker id="viz-arrowhead-locked-back" markerWidth="8" markerHeight="6" refX="2" refY="3" orient="auto"><polygon points="8 0, 0 3, 8 6" fill="#f59e0b" opacity="0.8"/></marker>
    <marker id="viz-arrowhead-custom" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#f59e0b" opacity="0.6"/></marker>
    <marker id="viz-arrowhead-custom-back" markerWidth="8" markerHeight="6" refX="2" refY="3" orient="auto"><polygon points="8 0, 0 3, 8 6" fill="#f59e0b" opacity="0.6"/></marker>
    ${colorArrowDefs}
  `;
  svg.insertBefore(defs, svg.firstChild);

  visibleLinks.filter(l => l.locked).forEach(link => {
    const fromNode = visibleNodes.find(n => n.id === link.from);
    const toNode = visibleNodes.find(n => n.id === link.to);
    if (!fromNode || !toNode) return;
    const fromEl = renderedNodeMap.get(link.from);
    const toEl = renderedNodeMap.get(link.to);
    const fromOffsetW = (fromEl ? fromEl.offsetWidth : 180) / 2;
    const toOffsetW   = (toEl   ? toEl.offsetWidth   : 180) / 2;
    const fromOffsetH = (fromEl ? fromEl.offsetHeight : 50)  / 2;
    const toOffsetH   = (toEl   ? toEl.offsetHeight   : 50)  / 2;
    const mx = (fromNode.x + fromOffsetW + toNode.x + toOffsetW) / 2 - 11;
    const my = (fromNode.y + fromOffsetH + toNode.y + toOffsetH) / 2 - 11;
    const lockEl = document.createElement('div');
    lockEl.className = 'viz-link-lock';
    lockEl.style.left = mx + 'px';
    lockEl.style.top = my + 'px';
    lockEl.innerHTML = '<i data-lucide="lock"></i>';
    lockEl.dataset.lockLinkId = link.id;
    nodesLayer.appendChild(lockEl);
  });

  lucide.createIcons({ root: container });
  vizUpdateZoomDisplay();
  vizUpdateMinimap();
  // Re-render replaces node elements — refresh the physics element cache
  if (typeof vizForce !== 'undefined' && vizForce.enabled) vizForceWake();
}

function vizUpdateSVGLinks() {
  const svg = document.getElementById('viz-canvas-svg');
  const nodesLayer = document.getElementById('viz-nodes-layer');
  if (!svg || !nodesLayer) return;
  const scopes = vizGetVisibleScopes();
  const visibleNodes = viz.nodes.filter(n => scopes.includes(n.scope));
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  viz.links.filter(l => visibleNodeIds.has(l.from) && visibleNodeIds.has(l.to)).forEach(link => {
    const fromNode = visibleNodes.find(n => n.id === link.from);
    const toNode = visibleNodes.find(n => n.id === link.to);
    if (!fromNode || !toNode) return;
    const fromEl = nodesLayer.querySelector(`[data-node-id="${link.from}"]`);
    const toEl = nodesLayer.querySelector(`[data-node-id="${link.to}"]`);
    const fw = fromEl ? fromEl.offsetWidth : (fromNode.type === 'root' ? 160 : 180);
    const fh = fromEl ? fromEl.offsetHeight : (fromNode.type === 'root' ? 60 : 50);
    const tw = toEl ? toEl.offsetWidth : (toNode.type === 'root' ? 160 : 180);
    const th = toEl ? toEl.offsetHeight : (toNode.type === 'root' ? 60 : 50);
    const cpPath = vizBezierPath(fromNode.x, fromNode.y, fw, fh, toNode.x, toNode.y, tw, th, link.fromSide, link.toSide);
    const group = svg.querySelector(`g[data-link-id="${link.id}"]`);
    if (group) group.querySelectorAll('path').forEach(p => p.setAttribute('d', cpPath));
  });

  viz.links.filter(l => l.locked && visibleNodeIds.has(l.from) && visibleNodeIds.has(l.to)).forEach(link => {
    const fromNode = visibleNodes.find(n => n.id === link.from);
    const toNode = visibleNodes.find(n => n.id === link.to);
    if (!fromNode || !toNode) return;
    const fromEl = nodesLayer.querySelector(`[data-node-id="${link.from}"]`);
    const toEl = nodesLayer.querySelector(`[data-node-id="${link.to}"]`);
    const fw = fromEl ? fromEl.offsetWidth : 180;
    const fh = fromEl ? fromEl.offsetHeight : 50;
    const tw = toEl ? toEl.offsetWidth : 180;
    const th = toEl ? toEl.offsetHeight : 50;
    const mx = (fromNode.x + fw / 2 + toNode.x + tw / 2) / 2 - 11;
    const my = (fromNode.y + fh / 2 + toNode.y + th / 2) / 2 - 11;
    const lockEl = nodesLayer.querySelector(`[data-lock-link-id="${link.id}"]`);
    if (lockEl) { lockEl.style.left = mx + 'px'; lockEl.style.top = my + 'px'; }
  });
}

function vizNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  e.stopPropagation();
  if (viz.linkModeEnabled || viz.linkingFrom || viz.colorModeEnabled) return;
  const node = viz.nodes.find(n => n.id === nodeId);
  if (!node) return;

  if (node.type === 'comment') {
    const inner = e.target.closest('.viz-node-inner');
    if (inner) {
      const rect = inner.getBoundingClientRect();
      const localX = (e.clientX - rect.left) / viz.zoom;
      const localY = (e.clientY - rect.top) / viz.zoom;
      if (localX > inner.offsetWidth - 25 && localY > inner.offsetHeight - 25) {
        return;
      }
    }
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
  document.addEventListener('mousemove', vizNodeDrag);
  document.addEventListener('mouseup', vizNodeDragEnd);
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

  const nodeEl = document.querySelector(`.viz-node[data-node-id="${node.id}"]`);
  if (nodeEl) {
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.classList.add('dragging');
  }

  if (viz.flowyDragEnabled && (dx !== 0 || dy !== 0)) vizDragDescendants(node.id, dx, dy, new Set([node.id]));
  vizUpdateSVGLinks();
  vizUpdateMinimap();
}

function vizNodeDragEnd() {
  if (viz.draggingNode) {
    const nodeEl = document.querySelector(`.viz-node[data-node-id="${viz.draggingNode}"]`);
    if (nodeEl) nodeEl.classList.remove('dragging');
  }
  document.querySelectorAll('.viz-node.dragging-child').forEach(el => el.classList.remove('dragging-child'));
  viz.draggingNode = null;
  viz._undoArmed = false;
  document.removeEventListener('mousemove', vizNodeDrag);
  document.removeEventListener('mouseup', vizNodeDragEnd);
  if (viz._hasDragged) {
    vizRenderCanvas();
    vizSave();
    vizUpdateMinimap();
  }
  viz._hasDragged = false;
}

function vizDragDescendants(nodeId, dx, dy, visited) {
  viz.links.filter(l => l.from === nodeId && !l.isCustom).forEach(l => {
    if (visited.has(l.to)) return;
    visited.add(l.to);
    const child = viz.nodes.find(n => n.id === l.to);
    if (!child) return;
    child.x += dx;
    child.y += dy;
    const childEl = document.querySelector(`.viz-node[data-node-id="${l.to}"]`);
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

/**
 * A sidebar row is draggable two ways at once: onto the canvas to place a node
 * (the application/json payload above), and within the tree to reorganise it
 * (tree-dnd.js). Both payloads ride along, and whichever surface receives the
 * drop reads the one it understands.
 */
function vizTreeDragStart(e, id, type) {
  vizSidebarDragStart(e, id, type);
  if (typeof treeDragStart === 'function') treeDragStart(e, id, 'viz');
}

function vizCanvasDrop(e) {
  e.preventDefault();
  const dataString = e.dataTransfer.getData('application/json');
  if (!dataString) return;

  vizPushUndo();
  try {
    const data = JSON.parse(dataString);
    let scope = viz.activeModule;
    if (scope === 'general') {
      if (state.challenges.find(c => c.id === data.id)) scope = 'challenge';
      else if ((state.snippets || []).find(s => s.id === data.id)) scope = 'snippet';
      else if ((state.notebooks || []).find(n => n.id === data.id)) scope = 'notebook';
      else scope = 'challenge';
    }

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

function vizCanvasMouseDown(e) {
  if (viz.activeModule === 'brain') { brainCanvasMouseDown(e); return; }
  if (e.target.closest('.viz-node') || e.button !== 0) return;
  // Clicking empty canvas while in linking mode cancels the link
  if (viz.linkingFrom) {
    vizCancelLinking();
    return;
  }
  viz.isPanning = true;
  viz.panStart = { x: e.clientX, y: e.clientY };
  viz.panStartOffset = { ...viz.pan };
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('panning');
}

function vizCanvasMouseMove(e) {
  if (viz.activeModule === 'brain') { brainCanvasMouseMove(e); return; }
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
        // Determine auto exit side from source port
        const cp = vizTempLinkCP(fx, fy, mouseX, mouseY, fromSide);
        tempLink.setAttribute('d', `M ${fx} ${fy} C ${cp.c1x} ${cp.c1y}, ${cp.c2x} ${cp.c2y}, ${mouseX} ${mouseY}`);
      }
    }
  }
  if (!viz.isPanning) return;

  viz.pan.x = viz.panStartOffset.x + (e.clientX - viz.panStart.x);
  viz.pan.y = viz.panStartOffset.y + (e.clientY - viz.panStart.y);

  const nodesLayer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  if (nodesLayer) nodesLayer.style.transform = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;
  if (svg) svg.style.transform = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;
  vizUpdateMinimap();
}

function vizTempLinkCP(fx, fy, tx, ty, fromSide) {
  const dist = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2);
  const bend = Math.min(Math.max(dist * 0.45, 40), 200);
  let c1x = fx, c1y = fy;
  if (fromSide === 'right')  { c1x = fx + bend; c1y = fy; }
  else if (fromSide === 'left')   { c1x = fx - bend; c1y = fy; }
  else if (fromSide === 'top')    { c1x = fx; c1y = fy - bend; }
  else if (fromSide === 'bottom') { c1x = fx; c1y = fy + bend; }
  else {
    // Auto: exit in direction of target
    const dx = tx - fx, dy = ty - fy;
    if (Math.abs(dx) >= Math.abs(dy)) { c1x = fx + (dx > 0 ? bend : -bend); c1y = fy; }
    else                               { c1x = fx; c1y = fy + (dy > 0 ? bend : -bend); }
  }
  // Control point 2: approach target from its direction
  const dx2 = fx - tx, dy2 = fy - ty;
  const b2 = bend * 0.8;
  let c2x = tx, c2y = ty;
  if (Math.abs(dx2) >= Math.abs(dy2)) { c2x = tx + (dx2 > 0 ? b2 : -b2); c2y = ty; }
  else                                  { c2x = tx; c2y = ty + (dy2 > 0 ? b2 : -b2); }
  return { c1x, c1y, c2x, c2y };
}

function vizCanvasMouseUp(e) {
  if (viz.activeModule === 'brain') { brainCanvasMouseUp(); return; }
  if (viz.isPanning) {
    viz.isPanning = false;
    const container = document.getElementById('viz-canvas-container');
    if (container) container.classList.remove('panning');
    vizSave();
  }
}

let _vizWheelSaveTimer = null;

function vizCanvasWheel(e) {
  if (viz.activeModule === 'brain') { brainCanvasWheel(e); return; }
  e.preventDefault();
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const targetX = (mouseX - viz.pan.x) / viz.zoom;
  const targetY = (mouseY - viz.pan.y) / viz.zoom;

  // Multiplicative zoom — uniform feel at every zoom level (like Obsidian)
  const factor = e.deltaY > 0 ? 0.92 : 1.087;
  const newZoom = Math.min(3, Math.max(0.2, viz.zoom * factor));

  viz.pan.x = mouseX - targetX * newZoom;
  viz.pan.y = mouseY - targetY * newZoom;
  viz.zoom = newZoom;

  // Transform-only update: a full vizRenderCanvas() + localStorage write per
  // wheel tick rebuilt the entire node DOM and made zooming feel janky.
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  const tf = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;
  if (nodesLayer) nodesLayer.style.transform = tf;
  if (svg) svg.style.transform = tf;
  vizUpdateZoomDisplay();
  vizUpdateMinimap();
  clearTimeout(_vizWheelSaveTimer);
  _vizWheelSaveTimer = setTimeout(() => vizSave(), 400);
}

function vizZoomIn() { viz.zoom = Math.min(3, viz.zoom + 0.15); vizRenderCanvas(); vizSave(); }
function vizZoomOut() { viz.zoom = Math.max(0.2, viz.zoom - 0.15); vizRenderCanvas(); vizSave(); }
function vizZoomReset() { viz.zoom = 1; viz.pan = { x: 0, y: 0 }; vizCenterCanvas(); }
function vizUpdateZoomDisplay() {
  const el = document.getElementById('viz-zoom-level');
  if (el) el.textContent = Math.round(viz.zoom * 100) + '%';
}

function vizAutoLayout() {
  const scopes = vizGetVisibleScopes();
  const visibleNodes = viz.nodes.filter(n => scopes.includes(n.scope));
  if (visibleNodes.length === 0) return;
  vizPushUndo();

  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const visibleLinks = viz.links.filter(l => visibleIds.has(l.from) && visibleIds.has(l.to) && !l.isCustom);
  const children = {};
  const hasParent = new Set();
  visibleLinks.forEach(l => {
    if (!children[l.from]) children[l.from] = [];
    children[l.from].push(l.to);
    hasParent.add(l.to);
  });

  let roots = visibleNodes.filter(n => !hasParent.has(n.id));
  if (roots.length === 0) roots = [visibleNodes[0]];

  const subtreeWidth = {};
  function calcWidth(nodeId, visited) {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);
    let w = 0;
    const kids = children[nodeId] || [];

    const isLeaf = (id) => (!children[id] || children[id].length === 0);
    const allLeaves = kids.length >= 3 && kids.every(isLeaf);

    if (allLeaves) {
      const cols = Math.min(3, Math.ceil(Math.sqrt(kids.length)));
      w = cols * 1.0 + (cols - 1) * 0.2;
      kids.forEach(kid => { visited.add(kid); subtreeWidth[kid] = 1.0; });
    } else {
      kids.forEach((kid, i) => {
        w += calcWidth(kid, new Set(visited));
        if (i < kids.length - 1) w += 0.4;
      });
    }

    subtreeWidth[nodeId] = Math.max(1.0, w);
    return subtreeWidth[nodeId];
  }

  roots.forEach(r => calcWidth(r.id, new Set()));

  const posMap = {};
  function assignPos(nodeId, startY, startX, visited) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const myWidth = subtreeWidth[nodeId] || 1.0;
    posMap[nodeId] = { x: startX + myWidth / 2, y: startY };

    const kids = children[nodeId] || [];
    const isLeaf = (id) => (!children[id] || children[id].length === 0);
    const allLeaves = kids.length >= 3 && kids.every(isLeaf);

    if (allLeaves) {
      const cols = Math.min(3, Math.ceil(Math.sqrt(kids.length)));
      let row = 0;
      let col = 0;
      kids.forEach(kid => {
        visited.add(kid);
        const cx = startX + col * 1.2 + 0.5;
        const cy = startY + 1 + row * 0.7;
        posMap[kid] = { x: cx, y: cy };

        col++;
        if (col >= cols) {
          col = 0;
          row++;
        }
      });
    } else {
      let currentX = startX;
      kids.forEach((kid, i) => {
        const kidWidth = subtreeWidth[kid] || 1.0;
        assignPos(kid, startY + 1, currentX, new Set(visited));
        currentX += kidWidth;
        if (i < kids.length - 1) currentX += 0.4;
      });
    }
  }

  let rootX = 0;
  roots.forEach((r, i) => {
    const w = subtreeWidth[r.id] || 1.0;
    assignPos(r.id, 0, rootX, new Set());
    rootX += w;
    if (i < roots.length - 1) rootX += 1.0;
  });

  const COL_W = 340, ROW_H = 220;
  const ORIGIN_X = 100, ORIGIN_Y = 100;

  visibleNodes.forEach(n => {
    const pos = posMap[n.id];
    if (pos) {
      n.x = ORIGIN_X + pos.x * COL_W - 170;
      n.y = ORIGIN_Y + pos.y * ROW_H;
    }
  });

  vizRenderCanvas();
  vizSave();
  setTimeout(() => vizCenterCanvas(), 50);
}

function vizUpdateMinimap() {
  const canvas = document.getElementById('viz-minimap-canvas');
  const container = document.getElementById('viz-canvas-container');
  const viewportEl = document.getElementById('viz-minimap-viewport');
  if (!canvas || !container) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const scopes = vizGetVisibleScopes();
  const nodes = viz.nodes.filter(n => scopes.includes(n.scope));
  if (nodes.length === 0) {
    if (viewportEl) { viewportEl.style.display = 'none'; }
    return;
  }
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

  // Store scale/offset for click-to-navigate
  canvas._mmScale = scale;
  canvas._mmOx = ox;
  canvas._mmOy = oy;

  const ids = new Set(nodes.map(n => n.id));
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 0.75;
  viz.links.filter(l => ids.has(l.from) && ids.has(l.to)).forEach(l => {
    const fn = nodes.find(n => n.id === l.from);
    const tn = nodes.find(n => n.id === l.to);
    if (!fn || !tn) return;
    ctx.beginPath();
    ctx.moveTo(fn.x * scale + ox, fn.y * scale + oy);
    ctx.lineTo(tn.x * scale + ox, tn.y * scale + oy);
    ctx.stroke();
  });

  nodes.forEach(n => {
    const nx = n.x * scale + ox, ny = n.y * scale + oy;
    const nw = Math.max((n.w || 150) * scale, 4), nh = Math.max((n.h || 48) * scale, 3);
    const colorMap = { root: '#6366f1', folder: '#06b6d4', challenge: '#22c55e', snippet: '#f59e0b', notebook: '#a855f7', comment: '#f97316' };
    const isSelected = n.id === viz.selectedNodeId;
    ctx.fillStyle = isSelected ? '#6366f1' : (colorMap[n.type] || '#64748b');
    ctx.globalAlpha = isSelected ? 1 : 0.65;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(nx, ny, Math.max(nw, 6), Math.max(nh, 4), 2);
    } else {
      ctx.rect(nx, ny, Math.max(nw, 6), Math.max(nh, 4));
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  const contW = container.offsetWidth, contH = container.offsetHeight;
  const vx = (-viz.pan.x / viz.zoom) * scale + ox;
  const vy = (-viz.pan.y / viz.zoom) * scale + oy;
  const vw = (contW / viz.zoom) * scale;
  const vh = (contH / viz.zoom) * scale;
  if (viewportEl) {
    // Clamp position so the rect stays inside the minimap bounds
    const clampedX = Math.max(0, Math.min(vx, W));
    const clampedY = Math.max(0, Math.min(vy, H));
    const clampedW = Math.min(vw, W - clampedX);
    const clampedH = Math.min(vh, H - clampedY);
    viewportEl.style.left = clampedX + 'px';
    viewportEl.style.top = clampedY + 'px';
    viewportEl.style.width = Math.max(clampedW, 4) + 'px';
    viewportEl.style.height = Math.max(clampedH, 4) + 'px';
  }
}

function vizMinimapClick(e) {
  if (viz.activeModule === 'brain') return;
  const canvas = document.getElementById('viz-minimap-canvas');
  const container = document.getElementById('viz-canvas-container');
  if (!canvas || !container || canvas._mmScale === undefined) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Convert minimap pixel -> world coords -> pan so clicked point centers the viewport
  const worldX = (mx - canvas._mmOx) / canvas._mmScale;
  const worldY = (my - canvas._mmOy) / canvas._mmScale;

  viz.pan.x = container.offsetWidth / 2 - worldX * viz.zoom;
  viz.pan.y = container.offsetHeight / 2 - worldY * viz.zoom;

  const nodesLayer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  if (nodesLayer) nodesLayer.style.transform = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;
  if (svg) svg.style.transform = `translate(${viz.pan.x}px, ${viz.pan.y}px) scale(${viz.zoom})`;
  vizUpdateMinimap();
  vizSave();
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

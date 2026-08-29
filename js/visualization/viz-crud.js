/* ============================================================
   VIZ-CRUD.JS — Data Modification, Graph Links & Auto-Populate
   ============================================================ */

function vizAddCanvasNode(label, type, dataId, scope, x, y) {
  const id = 'vn_' + generateId();
  const container = document.getElementById('viz-canvas-container');
  const cx = x !== undefined ? x : (container ? container.offsetWidth / 2 : 400) / viz.zoom - viz.pan.x / viz.zoom;
  const cy = y !== undefined ? y : (container ? container.offsetHeight / 2 : 300) / viz.zoom - viz.pan.y / viz.zoom;
  const node = { id, label, type: type || 'item', dataId: dataId || null, scope: scope || viz.activeModule, x: cx + (Math.random() - 0.5) * 80, y: cy + (Math.random() - 0.5) * 60, color: null, _isNew: true };
  viz.nodes.push(node);
  viz.selectedNodeId = id;
  vizRenderCanvas();
  vizSave();
  return node;
}

function vizDeleteNode(nodeId) {
  vizPushUndo();
  const node = viz.nodes.find(n => n.id === nodeId);
  if (!node) return;

  if (node.dataId === 'root' || node.type === 'root') {
    showMessage('Cannot Delete Root', 'The Root category node cannot be removed from the canvas.');
    return;
  }

  if (node.dataId) {
    // Through the shared soft-delete helpers, so deleting a node here is the
    // same act as deleting the item in its own library: the record is
    // snapshotted, its deadline travels with it, and the undo toast brings
    // both back. This used to filter `state` in place with no undo of any
    // kind, and the canvas undo button — which only restores viz.nodes and
    // viz.links — made it look recoverable when it was not.
    if (node.type === 'folder') {
      if (typeof softDeleteFolder === 'function') softDeleteFolder(node.dataId);
      else deleteNode(node.dataId);
    } else if (node.type === 'challenge' && typeof softDeleteChallenge === 'function') {
      softDeleteChallenge(node.dataId);
    } else if (node.type === 'snippet' && typeof softDeleteSnippet === 'function') {
      softDeleteSnippet(node.dataId);
    } else if (node.type === 'notebook' && typeof softDeleteNotebook === 'function') {
      softDeleteNotebook(node.dataId);
    } else {
      if (node.type !== 'folder' && typeof agDetachDeadline === 'function') {
        agDetachDeadline(node.type, node.dataId);
      }
      if (node.type === 'challenge') state.challenges = state.challenges.filter(c => c.id !== node.dataId);
      else if (node.type === 'snippet') state.snippets = state.snippets.filter(s => s.id !== node.dataId);
      else if (node.type === 'notebook') state.notebooks = state.notebooks.filter(n => n.id !== node.dataId);
    }
    saveData();
  }

  if (node.type === 'comment') {
    viz.nodes = viz.nodes.filter(n => n.id !== nodeId);
    viz.links = viz.links.filter(l => l.from !== nodeId && l.to !== nodeId);
    vizRenderCanvas();
    vizSave();
    return;
  }

  const parentLink = viz.links.find(l => l.to === nodeId && !l.isCustom);
  const parentVizId = parentLink ? parentLink.from : null;

  const childLinks = viz.links.filter(l => l.from === nodeId && !l.isCustom);
  childLinks.forEach(cl => {
    if (parentVizId) {
      viz.links.push({ id: 'vl_' + generateId(), from: parentVizId, to: cl.to, locked: false, isCustom: false });
    } else {
      const rootNode = viz.nodes.find(n => n.dataId === 'root' && n.scope === node.scope);
      if (rootNode) viz.links.push({ id: 'vl_' + generateId(), from: rootNode.id, to: cl.to, locked: false, isCustom: false });
    }
  });

  viz.collapsedNodeIds.delete(nodeId);
  viz.nodes = viz.nodes.filter(n => n.id !== nodeId);
  viz.links = viz.links.filter(l => l.from !== nodeId && l.to !== nodeId);
  if (viz.selectedNodeId === nodeId) viz.selectedNodeId = null;

  vizRenderCanvas();
  vizRenderContentPane();
  vizSave();
}

function vizEditNodeColor(nodeId, color) {
  const node = viz.nodes.find(n => n.id === nodeId);
  if (node) { node.color = color; vizRenderCanvas(); vizSave(); }
}

function vizAddChildNode(parentId) {
  const parentViz = viz.nodes.find(n => n.id === parentId);
  if (!parentViz) return;
  showInputDialog('Add Child Node', null, 'Node name', '', (label) => {
    const isParentFolder = parentViz.type === 'folder' || parentViz.type === 'root';
    const actualParentId = parentViz.dataId === 'root' ? null : (isParentFolder ? parentViz.dataId : null);

    const newId = 'n_' + generateId();
    if (parentViz.scope === 'challenge') {
      state.challenges.push({ id: newId, title: label.trim(), parentId: actualParentId, tags: [], variants: [{ id: generateId(), name: 'V1', code: '', description: '', starterCode: '', samples: [] }] });
    } else if (parentViz.scope === 'snippet') {
      state.snippets.push({ id: newId, title: label.trim(), parentId: actualParentId, tags: [] });
    } else if (parentViz.scope === 'notebook') {
      state.notebooks.push({ id: newId, title: label.trim(), parentId: actualParentId, tags: [] });
    }

    saveData();

    const child = vizAddCanvasNode(label.trim(), parentViz.scope, newId, parentViz.scope, parentViz.x + 180, parentViz.y + 60);
    vizAddLink(parentId, child.id);
    vizRenderContentPane();
    vizRenderCanvas();
    vizSave();
  });
}

function vizAddChildFolder(parentId) {
  const parentViz = viz.nodes.find(n => n.id === parentId);
  if (!parentViz) return;
  showInputDialog('Create Category', null, 'Category name', '', (label) => {
    const isParentFolder = parentViz.type === 'folder' || parentViz.type === 'root';
    const actualParentId = parentViz.dataId === 'root' ? null : (isParentFolder ? parentViz.dataId : null);

    const newId = 'n_' + generateId();
    if (typeof createNode === 'function') {
      const sn = createNode(label.trim(), 'folder', actualParentId, parentViz.scope);
      const child = vizAddCanvasNode(label.trim(), 'folder', sn.id, parentViz.scope, parentViz.x + 180, parentViz.y + 60);
      vizAddLink(parentId, child.id);
    } else {
      const child = vizAddCanvasNode(label.trim(), 'folder', newId, parentViz.scope, parentViz.x + 180, parentViz.y + 60);
      child.isDraft = true;
      vizCommitDraftNode(child, actualParentId);
      vizAddLink(parentId, child.id);
    }

    vizRenderContentPane();
    vizRenderCanvas();
    vizSave();
  });
}

function vizCommitDraftNode(node, parentId) {
  if (!node.isDraft) return;

  const newId = 'n_' + generateId();
  node.dataId = newId;
  delete node.isDraft;

  if (node.type === 'folder') {
    const sn = createNode(node.label, 'folder', parentId, node.scope);
    node.dataId = sn.id;
  } else if (node.type === 'challenge') {
    state.challenges.push({ id: newId, title: node.label, parentId: parentId, tags: [], variants: [{ id: generateId(), name: 'V1', code: '', description: '', starterCode: '', samples: [] }] });
    saveData();
  } else if (node.type === 'snippet') {
    state.snippets.push({ id: newId, title: node.label, parentId: parentId, tags: [] });
    saveData();
  } else if (node.type === 'notebook') {
    state.notebooks.push({ id: newId, title: node.label, parentId: parentId, tags: [] });
    saveData();
  }
}

function vizAddLink(fromId, toId, isCustom = false) {
  if (viz.links.find(l => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId))) return null;

  const fromNode = viz.nodes.find(n => n.id === fromId);
  const toNode = viz.nodes.find(n => n.id === toId);

  if (fromNode?.type === 'comment' || toNode?.type === 'comment') {
    const commentLink = { id: 'vl_' + generateId(), from: fromId, to: toId, locked: false, isCustom: true };
    viz.links.push(commentLink);
    vizRenderCanvas();
    vizSave();
    return commentLink;
  }

  let parentNode = null;
  let childNode = null;

  const isFolderOrRoot = (n) => ['root', 'folder'].includes(n.type);
  const getIncomingLink = (id) => viz.links.find(l => l.to === id && !l.isCustom);
  const fromHasParent = !!getIncomingLink(fromNode.id);
  const toHasParent = !!getIncomingLink(toNode.id);

  if (fromNode.dataId === 'root') { parentNode = fromNode; childNode = toNode; }
  else if (toNode.dataId === 'root') { parentNode = toNode; childNode = fromNode; }
  else if (isFolderOrRoot(fromNode) && !isFolderOrRoot(toNode)) { parentNode = fromNode; childNode = toNode; }
  else if (isFolderOrRoot(toNode) && !isFolderOrRoot(fromNode)) { parentNode = toNode; childNode = fromNode; }
  else {
    parentNode = fromNode;
    childNode = toNode;
  }

  if (parentNode && parentNode.isDraft) {
    vizCommitDraftNode(parentNode, null);
  }
  if (childNode && childNode.isDraft) {
    let actualParentId = null;
    if (['folder', 'root'].includes(parentNode.type)) {
      actualParentId = parentNode.dataId === 'root' ? null : parentNode.dataId;
    } else {
      const parentLink = viz.links.find(l => l.to === parentNode.id && viz.nodes.find(n => n.id === l.from && ['folder', 'root'].includes(n.type)));
      if (parentLink) {
        const pFolder = viz.nodes.find(n => n.id === parentLink.from);
        actualParentId = pFolder && pFolder.dataId !== 'root' ? pFolder.dataId : null;
      } else {
        if (parentNode.scope === 'challenge') {
          const ch = state.challenges.find(c => c.id === parentNode.dataId);
          actualParentId = ch ? ch.parentId : null;
        } else if (parentNode.scope === 'snippet') {
          const sn = state.snippets.find(s => s.id === parentNode.dataId);
          actualParentId = sn ? sn.parentId : null;
        } else if (parentNode.scope === 'notebook') {
          const nb = state.notebooks.find(n => n.id === parentNode.dataId);
          actualParentId = nb ? nb.parentId : null;
        }
      }
    }
    vizCommitDraftNode(childNode, actualParentId);
  }

  let finalFromId = fromId;
  let finalToId = toId;
  if (!isCustom && parentNode && childNode && parentNode.id === toId && childNode.id === fromId) {
    finalFromId = toId;
    finalToId = fromId;
  }

  if (parentNode && childNode && parentNode.dataId && childNode.dataId && ['folder', 'root'].includes(parentNode.type) && isCustom === false) {
    let parentFolderId = parentNode.dataId === 'root' ? null : parentNode.dataId;

    if (childNode.type === 'folder' && parentFolderId) {
      if (typeof isDescendantOf === 'function' && isDescendantOf(parentFolderId, childNode.dataId)) {
        showMessage('Invalid Link', 'Cannot link a folder to its own descendant — this would create a cycle.', true);
        return;
      }
    }

    viz.links = viz.links.filter(l => !(l.to === childNode.id && viz.nodes.find(n => n.id === l.from && ['folder', 'root'].includes(n.type))));

    if (childNode.type === 'folder') moveNode(childNode.dataId, parentFolderId);
    else if (['challenge', 'snippet', 'notebook'].includes(childNode.type)) moveItemToFolder(childNode.dataId, childNode.type, parentFolderId);
  }

  const newLink = { id: 'vl_' + generateId(), from: finalFromId, to: finalToId, locked: false, isCustom: isCustom, arrowType: viz.defaultLinkArrowType || 'arrow' };
  viz.links.push(newLink);

  vizRenderCanvas();
  vizSave();
  vizRenderContentPane();
  return newLink;
}

function vizDeleteLink(linkId) {
  vizPushUndo();
  const link = viz.links.find(l => l.id === linkId);
  if (!link) return;

  const fromNode = viz.nodes.find(n => n.id === link.from);
  const toNode = viz.nodes.find(n => n.id === link.to);

  if (fromNode && toNode && !link.isCustom && !link.locked) {
    let childNode = ['folder', 'root'].includes(fromNode.type) ? toNode : (['folder', 'root'].includes(toNode.type) ? fromNode : null);

    if (childNode && childNode.dataId && childNode.dataId !== 'root') {
      if (childNode.type === 'folder') moveNode(childNode.dataId, null);
      else if (['challenge', 'snippet', 'notebook'].includes(childNode.type)) moveItemToFolder(childNode.dataId, childNode.type, null);

      const rootNode = viz.nodes.find(n => n.dataId === 'root' && n.scope === childNode.scope);
      if (rootNode && fromNode.dataId !== 'root' && toNode.dataId !== 'root') {
        viz.links.push({ id: 'vl_' + generateId(), from: rootNode.id, to: childNode.id, locked: false, isCustom: false });
      }
    }
  }

  viz.links = viz.links.filter(l => l.id !== linkId);
  vizRenderCanvas();
  vizSave();
  vizRenderContentPane();
}

function vizToggleLinkLock(linkId) {
  const link = viz.links.find(l => l.id === linkId);
  if (!link) return;
  link.locked = !link.locked;

  const fromNode = viz.nodes.find(n => n.id === link.from);
  const toNode = viz.nodes.find(n => n.id === link.to);
  if (fromNode && toNode && fromNode.dataId && toNode.dataId) {
    if (!state.categoryRequirements) state.categoryRequirements = {};
    const lockedFolderId = toNode.dataId;
    if (link.locked) {
      if (typeof openPrereqPicker === 'function') {
        openPrereqPicker(lockedFolderId);
      } else {
        state.categoryRequirements[lockedFolderId] = { requiredChallengeIds: [] };
      }
    } else { delete state.categoryRequirements[lockedFolderId]; }
    saveData();
  }

  vizRenderCanvas();
  vizSave();
}

function vizStartLinking(nodeId) {
  viz.linkingFrom = nodeId;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('linking-mode');
  let hint = document.getElementById('viz-linking-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'viz-linking-hint';
    hint.className = 'viz-linking-hint';
    hint.innerHTML = '<i data-lucide="link"></i> Click another node to connect';
    container.appendChild(hint);
    lucide.createIcons({ root: hint });
  }
  hint.classList.remove('hidden');
  vizRenderCanvas();
}

function vizCancelLinking() {
  viz.linkingFrom = null;
  viz.portDrag = null;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.remove('linking-mode');
  const hint = document.getElementById('viz-linking-hint');
  if (hint) hint.classList.add('hidden');
  vizRenderCanvas();
}

/* Each library gets its own vertical band. All three used to start at x=60 and
   cascade downwards, so on the General canvas the three trees were drawn on top
   of one another — 80 nodes inside a 500×2020 ribbon that auto-fit to 32% zoom
   and could not be read. */
const VIZ_BAND_W = 1300;
const VIZ_BAND_X = { challenge: 60, snippet: 60 + VIZ_BAND_W, notebook: 60 + VIZ_BAND_W * 2 };

/**
 * @param {string[]} [only] which libraries to place. Defaults to the ones the
 *   active module shows — General no longer drags all three onto the canvas
 *   just because you opened the page.
 */
function vizAutoPopulate(only) {
  const scopes = only || (viz.activeModule === 'general' || viz.activeModule === 'brain'
    ? [] : [viz.activeModule]);
  const scopeLabels = { challenge: 'Programs', snippet: 'Snippets', notebook: 'Notebooks' };
  let dirty = false;

  scopes.forEach(scope => {
    const baseX = VIZ_BAND_X[scope] || 60;
    let maxY = 60;
    viz.nodes.filter(n => n.scope === scope).forEach(n => { if (n.y > maxY) maxY = n.y; });
    let nextY = maxY > 60 ? maxY + 100 : 60;

    let scopeNode = viz.nodes.find(n => n.dataId === 'root' && n.scope === scope);
    if (scopeNode) {
      scopeNode.type = 'root';
      scopeNode.label = scopeLabels[scope] || scope;
    } else {
      const rootFolders = state.nodes.filter(n => n.type === 'folder' && n.scope === scope && !n.parentId);
      const rootItems = (typeof getItemsForScope === 'function' ? getItemsForScope(scope) : []).filter(it => !it.parentId);
      if (rootFolders.length === 0 && rootItems.length === 0) return;

      scopeNode = { id: 'vn_' + generateId(), label: scopeLabels[scope] || scope, type: 'root', dataId: 'root', scope, x: baseX, y: nextY, color: null };
      viz.nodes.push(scopeNode);
      nextY += 120;
      dirty = true;
    }

    function syncFolderBranch(folder, parentVizId, depth) {
      let vizNode = viz.nodes.find(n => n.dataId === folder.id);
      if (!vizNode) {
        const x = baseX + depth * 260;
        vizNode = { id: 'vn_' + generateId(), label: folder.name, type: 'folder', dataId: folder.id, scope, x, y: nextY, color: null, icon: folder.icon };
        viz.nodes.push(vizNode);
        viz.links.push({ id: 'vl_' + generateId(), from: parentVizId, to: vizNode.id, locked: false });
        nextY += 80;
        dirty = true;
      }

      const items = (typeof getItemsForScope === 'function' ? getItemsForScope(scope) : []).filter(it => it.parentId === folder.id);
      items.forEach(it => {
        if (!viz.nodes.find(n => n.dataId === it.id)) {
          const itemVizId = 'vn_' + generateId();
          viz.nodes.push({ id: itemVizId, label: it.title || it.name || 'Untitled', type: scope, dataId: it.id, scope, x: vizNode.x + 240, y: nextY, color: null });
          viz.links.push({ id: 'vl_' + generateId(), from: vizNode.id, to: itemVizId, locked: false });
          nextY += 70;
          dirty = true;
        }
      });

      const childFolders = state.nodes.filter(n => n.type === 'folder' && n.scope === scope && n.parentId === folder.id);
      childFolders.forEach(cf => syncFolderBranch(cf, vizNode.id, depth + 1));
    }

    const rootFolders = state.nodes.filter(n => n.type === 'folder' && n.scope === scope && !n.parentId);
    rootFolders.forEach(f => syncFolderBranch(f, scopeNode.id, 1));

    const rootItems = (typeof getItemsForScope === 'function' ? getItemsForScope(scope) : []).filter(it => !it.parentId);
    rootItems.forEach(it => {
      if (!viz.nodes.find(n => n.dataId === it.id)) {
        const itemVizId = 'vn_' + generateId();
        viz.nodes.push({ id: itemVizId, label: it.title || it.name || 'Untitled', type: scope, dataId: it.id, scope, x: baseX + 240, y: nextY, color: null });
        viz.links.push({ id: 'vl_' + generateId(), from: scopeNode.id, to: itemVizId, locked: false });
        nextY += 70;
        dirty = true;
      }
    });
  });

  if (dirty) vizSave();
}

function vizGetAllDescendants(nodeId, nodesList, linksList) {
  const desc = new Set();
  const visited = new Set();
  function walk(id) {
    if (visited.has(id)) return;
    visited.add(id);
    linksList.filter(l => !l.isCustom && !l.isBridge && (l.from === id || l.to === id)).forEach(l => {
      const other = l.from === id ? l.to : l.from;
      if (!visited.has(other)) {
        desc.add(other);
        walk(other);
      }
    });
  }
  walk(nodeId);
  return desc;
}

function vizCollapseChildren(nodeId) {
  const node = viz.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const descIds = vizGetAllDescendants(nodeId, viz.nodes, viz.links);
  if (descIds.size === 0) return;
  vizPushUndo();
  node._collapsedChildren = [];
  descIds.forEach(cid => {
    const child = viz.nodes.find(n => n.id === cid);
    if (child) node._collapsedChildren.push({ id: cid, dx: child.x - node.x, dy: child.y - node.y });
  });
  node.collapsed = true;
  viz.collapsedNodeIds.add(nodeId);
  vizRenderCanvas();
  vizSave();
}

function vizExpandChildren(nodeId) {
  const node = viz.nodes.find(n => n.id === nodeId);
  if (!node || !node.collapsed) return;
  vizPushUndo();
  const descIds = vizGetAllDescendants(nodeId, viz.nodes, viz.links);
  if (node._collapsedChildren) {
    node._collapsedChildren.forEach(snap => {
      const child = viz.nodes.find(n => n.id === snap.id);
      if (child) { child.x = node.x + snap.dx; child.y = node.y + snap.dy; }
    });
  }
  const restoredBoxes = [];
  descIds.forEach(cid => {
    const c = viz.nodes.find(n => n.id === cid);
    if (c) restoredBoxes.push({ x: c.x, y: c.y, w: c.w || 200, h: c.h || 60 });
  });
  if (restoredBoxes.length > 0) {
    const pad = 40;
    const envX = Math.min(...restoredBoxes.map(b => b.x)) - pad;
    const envY = Math.min(...restoredBoxes.map(b => b.y)) - pad;
    const envR = Math.max(...restoredBoxes.map(b => b.x + b.w)) + pad;
    const envB = Math.max(...restoredBoxes.map(b => b.y + b.h)) + pad;
    const scopes = vizGetVisibleScopes();
    viz.nodes.forEach(n => {
      if (n.id === nodeId || descIds.has(n.id)) return;
      if (!scopes.includes(n.scope)) return;
      const nw = n.w || 200, nh = n.h || 60;
      const nx2 = n.x + nw, ny2 = n.y + nh;
      if (n.x < envR && nx2 > envX && n.y < envB && ny2 > envY) {
        const pushL = envR - n.x, pushR = nx2 - envX;
        const pushT = envB - n.y, pushB = ny2 - envY;
        const minPush = Math.min(pushL, pushR, pushT, pushB);
        if (minPush === pushL) n.x = envR + 20;
        else if (minPush === pushR) n.x = envX - nw - 20;
        else if (minPush === pushT) n.y = envB + 20;
        else n.y = envY - nh - 20;
      }
    });
  }
  node.collapsed = false;
  delete node._collapsedChildren;
  viz.collapsedNodeIds.delete(nodeId);
  vizRenderCanvas();
  vizSave();
}

function vizPruneGhostNodes() {
  const allStateIds = new Set();
  (state.nodes || []).forEach(n => allStateIds.add(n.id));
  (state.challenges || []).forEach(c => allStateIds.add(c.id));
  (state.snippets || []).forEach(s => allStateIds.add(s.id));
  (state.notebooks || []).forEach(nb => allStateIds.add(nb.id));

  let pruned = false;
  viz.nodes = viz.nodes.filter(n => {
    if (!n.dataId || n.dataId === 'root') return true;
    if (allStateIds.has(n.dataId)) return true;
    pruned = true;
    return false;
  });

  if (pruned) {
    const nodeIds = new Set(viz.nodes.map(n => n.id));
    viz.links = viz.links.filter(l => nodeIds.has(l.from) && nodeIds.has(l.to));
    vizSave();
  }
}

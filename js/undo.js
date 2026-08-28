/* ============================================================
   UNDO.JS — Global Undo Stack + Soft-Delete Trash System
   ============================================================ */

const _undoStack = [];
const UNDO_MAX = 30;
const UNDO_TOAST_MS = 6000;
let _undoToastTimer = null;

/**
 * Push a reversible action onto the undo stack.
 * @param {string} label  — human-readable description (e.g. "Delete Challenge")
 * @param {function} undo — callback that restores the previous state
 */
function pushUndo(label, undoFn) {
  _undoStack.push({ label, undo: undoFn, at: Date.now() });
  if (_undoStack.length > UNDO_MAX) _undoStack.shift();
  _showUndoToast(label);
}

/** Pop and execute the most recent undo action. Returns true if something was undone. */
function popUndo() {
  const entry = _undoStack.pop();
  if (!entry) return false;
  try {
    entry.undo();
  } catch (e) {
    console.error('[Undo] Failed:', e);
  }
  _hideUndoToast();
  return true;
}

/** Check if there's anything to undo. */
function hasUndo() { return _undoStack.length > 0; }

/** Get the label of the most recent undoable action. */
function peekUndoLabel() {
  return _undoStack.length > 0 ? _undoStack[_undoStack.length - 1].label : null;
}

/* ---------- Undo Toast ---------- */

function _showUndoToast(label) {
  _hideUndoToast();
  let toast = document.getElementById('undo-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'undo-toast';
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(100px);' +
      'background:var(--bg-elevated,#1e1e2e);color:var(--text-primary,#fff);' +
      'padding:0.625rem 1.25rem;border-radius:var(--radius-md,8px);font-size:0.8125rem;font-weight:600;' +
      'z-index:99998;box-shadow:0 4px 16px rgba(0,0,0,0.4);display:flex;align-items:center;gap:0.75rem;' +
      'transition:transform 0.3s cubic-bezier(0.4,0,0.2,1),opacity 0.3s ease;opacity:0;pointer-events:auto;' +
      'border:1px solid var(--border-primary,rgba(255,255,255,0.08));';
    document.body.appendChild(toast);
  }
  toast.innerHTML =
    '<span style="opacity:0.7;">' + escapeHTML(label) + '</span>' +
    '<button onclick="popUndo()" style="background:var(--color-primary,#6366f1);color:#fff;border:none;' +
    'padding:0.25rem 0.75rem;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.8125rem;">Undo</button>' +
    '<button onclick="_hideUndoToast()" style="background:transparent;border:none;color:var(--text-tertiary,#888);' +
    'cursor:pointer;font-size:1rem;padding:0 0.25rem;">✕</button>';

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  });

  _undoToastTimer = setTimeout(_hideUndoToast, UNDO_TOAST_MS);
}

function _hideUndoToast() {
  clearTimeout(_undoToastTimer);
  _undoToastTimer = null;
  const toast = document.getElementById('undo-toast');
  if (toast) {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    toast.style.opacity = '0';
  }
}

// Ctrl+Z global undo (only when no input/textarea is focused)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    const tag = (document.activeElement || {}).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;
    if (hasUndo()) {
      e.preventDefault();
      popUndo();
    }
  }
});

/* ============================================================
   SOFT-DELETE HELPERS — wrap common delete operations
   ============================================================ */

/** Soft-delete a challenge: removes from state, pushes undo to restore it. */
function softDeleteChallenge(id, afterDelete) {
  const item = state.challenges.find(c => c.id === id);
  if (!item) return;
  const snapshot = JSON.parse(JSON.stringify(item));
  // The deadline belongs to the item: it goes with it, and comes back with it.
  const deadline = typeof agDetachDeadline === 'function' ? agDetachDeadline('challenge', id) : null;
  state.challenges = state.challenges.filter(c => c.id !== id);
  saveData();
  if (afterDelete) afterDelete();
  pushUndo('Deleted program "' + (snapshot.title || 'Untitled') + '"', () => {
    state.challenges.push(snapshot);
    if (deadline && typeof agAttachDeadline === 'function') agAttachDeadline(deadline);
    saveData();
    if (afterDelete) afterDelete();
  });
}

/** Soft-delete a snippet. */
function softDeleteSnippet(id, afterDelete) {
  const item = (state.snippets || []).find(s => s.id === id);
  if (!item) return;
  const snapshot = JSON.parse(JSON.stringify(item));
  // The deadline belongs to the item: it goes with it, and comes back with it.
  const deadline = typeof agDetachDeadline === 'function' ? agDetachDeadline('snippet', id) : null;
  state.snippets = state.snippets.filter(s => s.id !== id);
  saveData();
  if (afterDelete) afterDelete();
  pushUndo('Deleted snippet "' + (snapshot.title || 'Untitled') + '"', () => {
    state.snippets.push(snapshot);
    if (deadline && typeof agAttachDeadline === 'function') agAttachDeadline(deadline);
    saveData();
    if (afterDelete) afterDelete();
  });
}

/** Soft-delete a notebook. */
function softDeleteNotebook(id, afterDelete) {
  const item = (state.notebooks || []).find(n => n.id === id);
  if (!item) return;
  const snapshot = JSON.parse(JSON.stringify(item));
  // The deadline belongs to the item: it goes with it, and comes back with it.
  const deadline = typeof agDetachDeadline === 'function' ? agDetachDeadline('notebook', id) : null;
  state.notebooks = state.notebooks.filter(n => n.id !== id);
  saveData();
  if (afterDelete) afterDelete();
  pushUndo('Deleted notebook "' + (snapshot.title || 'Untitled') + '"', () => {
    state.notebooks.push(snapshot);
    if (deadline && typeof agAttachDeadline === 'function') agAttachDeadline(deadline);
    saveData();
    if (afterDelete) afterDelete();
  });
}

/** Soft-delete a folder node (with undo that restores the node + re-parents children). */
function softDeleteFolder(nodeId, afterDelete) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // Snapshot the node and its children's parentIds before deleteNode modifies them
  const nodeSnapshot = JSON.parse(JSON.stringify(node));
  const childFolders = state.nodes.filter(n => n.parentId === nodeId).map(n => ({ id: n.id, parentId: n.parentId }));
  const childChallenges = state.challenges.filter(c => c.parentId === nodeId).map(c => ({ id: c.id, parentId: c.parentId }));
  const childSnippets = (state.snippets || []).filter(s => s.parentId === nodeId).map(s => ({ id: s.id, parentId: s.parentId }));
  const childNotebooks = (state.notebooks || []).filter(n => n.parentId === nodeId).map(n => ({ id: n.id, parentId: n.parentId }));
  const childSets = (state.codingSets || []).filter(s => (s.parentId || null) === nodeId).map(s => ({ id: s.id, parentId: s.parentId }));

  // Execute the actual delete (promotes children to parent)
  deleteNode(nodeId);
  if (afterDelete) afterDelete();

  pushUndo('Deleted folder "' + (nodeSnapshot.name || 'Untitled') + '"', () => {
    // Restore the folder node
    state.nodes.push(nodeSnapshot);
    // Re-parent children back under this folder
    childFolders.forEach(cf => {
      const n = state.nodes.find(x => x.id === cf.id);
      if (n) n.parentId = cf.parentId;
    });
    childChallenges.forEach(cc => {
      const c = state.challenges.find(x => x.id === cc.id);
      if (c) c.parentId = cc.parentId;
    });
    childSnippets.forEach(cs => {
      const s = (state.snippets || []).find(x => x.id === cs.id);
      if (s) s.parentId = cs.parentId;
    });
    childNotebooks.forEach(cn => {
      const nb = (state.notebooks || []).find(x => x.id === cn.id);
      if (nb) nb.parentId = cn.parentId;
    });
    childSets.forEach(cs => {
      const s = (state.codingSets || []).find(x => x.id === cs.id);
      if (s) s.parentId = cs.parentId;
    });
    saveData();
    if (afterDelete) afterDelete();
  });
}

/** Soft-delete history entries. */
function softDeleteHistory(ids, afterDelete) {
  if (!ids || ids.length === 0) return;
  const snapshots = state.history.filter(h => ids.includes(h.id)).map(h => JSON.parse(JSON.stringify(h)));
  if (snapshots.length === 0) return;
  state.history = state.history.filter(h => !ids.includes(h.id));
  saveData();
  if (afterDelete) afterDelete();
  pushUndo('Deleted ' + snapshots.length + ' history record' + (snapshots.length > 1 ? 's' : ''), () => {
    state.history.push(...snapshots);
    saveData();
    if (afterDelete) afterDelete();
  });
}

/** Soft-delete notebook history entries. */
function softDeleteNotebookHistory(ids, afterDelete) {
  if (!ids || ids.length === 0) return;
  const snapshots = (state.notebookHistory || []).filter(h => ids.includes(h.id)).map(h => JSON.parse(JSON.stringify(h)));
  if (snapshots.length === 0) return;
  state.notebookHistory = (state.notebookHistory || []).filter(h => !ids.includes(h.id));
  saveData();
  if (afterDelete) afterDelete();
  pushUndo('Deleted ' + snapshots.length + ' notebook history record' + (snapshots.length > 1 ? 's' : ''), () => {
    (state.notebookHistory || []).push(...snapshots);
    saveData();
    if (afterDelete) afterDelete();
  });
}

/* ============================================================
   VIZ-INIT.JS — Initialization and Document Event Binding
   ============================================================ */

// Module-level handles so we can remove listeners on destroy (otherwise each
// /visualization mount stacks another set of listeners and dblclick / mouseup
// fire N times after N navigations).
const _vizListeners = {
  pointermove: null,
  pointerup: null,
  click: null,
  keydown: null,
  keydownCapture: null,
  blur: null
};
let _vizResizeObserver = null;

function initVisualization() {
  // Ensure any previous bindings are cleaned up before re-binding.
  destroyVisualization();

  // Always open on the library map rather than Brain, so the pane, the
  // toolbar label and the strip agree on every route mount. Which libraries
  // are selected is restored from storage by vizLoad below.
  // Brain's canvas state is preserved in `brain.*`; this loses none of it.
  viz.activeModule = 'library';
  viz.selectedNodeIds = new Set();
  viz.focusNodeId = null;
  viz.marquee = null;
  if (typeof _vizResetRenderCache === 'function') _vizResetRenderCache();

  // Suppress cloud uploads while we hydrate state from local cache + populate
  // the canvas. None of these operations are user-initiated changes that should
  // bump the dirty flag or trigger a cloud save.
  const _withSuppress = (fn) => (typeof withCloudSaveSuppressed === 'function') ? withCloudSaveSuppressed(fn) : fn();
  _withSuppress(() => {
    loadData();
    vizLoad();
    vizAutoPopulate();
    vizRenderContentPane();
    vizRenderCanvas();
  });

  // A canvas filled for the first time gets one arrangement pass before you
  // ever see it (see vizAutoPopulate), so the first impression is a map rather
  // than a 13,000px column.
  if (viz._needsLayout) {
    viz._needsLayout = false;
    setTimeout(() => { vizAutoLayout('silent'); }, 30);
  } else {
    setTimeout(() => vizCenterCanvas(true), 50);
  }

  // Sync stateful toolbar buttons with the loaded viz state
  const fogBtn = document.getElementById('viz-fog-toggle-btn');
  if (fogBtn) {
    fogBtn.classList.add('viz-state-fog');
    fogBtn.classList.toggle('is-active', !!viz.fogEnabled);
    fogBtn.setAttribute('aria-pressed', String(!!viz.fogEnabled));
  }
  const flowBtn = document.getElementById('viz-flow-toggle-btn');
  if (flowBtn) {
    flowBtn.classList.add('viz-state-flow');
    flowBtn.classList.toggle('is-active', !!viz.flowyDragEnabled);
    flowBtn.setAttribute('aria-pressed', String(!!viz.flowyDragEnabled));
  }
  // Colour mode and its paint colour are saved now, so this is no longer the
  // dead code it was when vizSave never wrote either of them.
  const colorBtn = document.getElementById('viz-color-toggle-btn');
  if (colorBtn) {
    colorBtn.classList.add('viz-state-color');
    colorBtn.classList.toggle('is-active', !!viz.colorModeEnabled);
  }
  const cContainer = document.getElementById('viz-canvas-container');
  if (cContainer) cContainer.classList.toggle('color-paint-mode', !!viz.colorModeEnabled);
  if (viz.colorModeEnabled && typeof vizSetPaintColor === 'function') vizSetPaintColor(viz.colorPaintColor);
  const linkBtn = document.getElementById('viz-link-toggle-btn');
  if (linkBtn) linkBtn.classList.toggle('is-active', !!viz.linkModeEnabled);
  if (typeof vizSyncSnapBtn === 'function') vizSyncSnapBtn();
  const globeBtn = document.getElementById('viz-globe-toggle-btn');
  if (globeBtn) {
    globeBtn.classList.add('viz-state-globe');
    globeBtn.classList.toggle('is-active', !!viz.globeModeEnabled);
    globeBtn.setAttribute('aria-pressed', String(!!viz.globeModeEnabled));
  }
  const container2 = document.getElementById('viz-canvas-container');
  if (container2) container2.classList.toggle('globe-mode', !!viz.globeModeEnabled);
  if (typeof vizSyncDepthBtn === 'function') vizSyncDepthBtn();
  if (typeof vizApplyMinimapVisibility === 'function') vizApplyMinimapVisibility();
  if (typeof vizSyncMoreMenu === 'function') vizSyncMoreMenu();
  if (typeof vizSyncTintBtn === 'function') vizSyncTintBtn();
  if (typeof vizSyncFocusBtn === 'function') vizSyncFocusBtn();
  if (typeof vizRenderViewsMenu === 'function') vizRenderViewsMenu();
  // Restore link arrow type label
  if (viz.defaultLinkArrowType && viz.defaultLinkArrowType !== 'arrow') {
    if (typeof vizSetLinkArrowType === 'function') vizSetLinkArrowType(viz.defaultLinkArrowType);
  }

  const container = document.getElementById('viz-canvas-container');
  if (container) {
    container.addEventListener('pointerdown', vizCanvasMouseDown);
    container.addEventListener('contextmenu', vizCanvasCtx);
    container.addEventListener('wheel', vizCanvasWheel, { passive: false });
    container.addEventListener('dblclick', vizCanvasDblClick);
    container.addEventListener('dragover', vizCanvasDragOver);
    container.addEventListener('drop', vizCanvasDrop);

    /* Nothing told the canvas the pane had changed size, so dragging the
       divider or rotating a tablet left the fit and the minimap's viewport
       rectangle computed against the old geometry. */
    if (typeof ResizeObserver === 'function') {
      let t = null;
      _vizResizeObserver = new ResizeObserver(() => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (viz.activeModule === 'brain') { if (typeof brainUpdateMinimap === 'function') brainUpdateMinimap(); }
          else vizUpdateMinimap();
        }, 120);
      });
      _vizResizeObserver.observe(container);
    }
  }

  // Minimap: click to jump, drag the rectangle to scrub.
  const minimapEl = document.getElementById('viz-minimap');
  if (minimapEl) {
    minimapEl.addEventListener('click', vizMinimapClick);
    minimapEl.addEventListener('pointerdown', vizMinimapDragStart);
  }

  _vizListeners.pointermove = vizCanvasMouseMove;
  _vizListeners.pointerup = vizCanvasMouseUp;
  document.addEventListener('pointermove', _vizListeners.pointermove);
  document.addEventListener('pointerup', _vizListeners.pointerup);
  document.addEventListener('pointercancel', _vizListeners.pointerup);

  _vizListeners.click = (e) => {
    const inMenu = e.target.closest('.viz-context-menu') || e.target.closest('.viz-link-menu') ||
      e.target.closest('#brain-canvas-ctx') || e.target.closest('#brain-node-ctx') ||
      e.target.closest('#brain-link-ctx') || e.target.closest('#brain-version-ctx');
    if (!inMenu) vizHideAllMenus();
    if (!e.target.closest('.viz-toolbar-dropdown')) {
      document.getElementById('viz-link-type-popup')?.classList.add('hidden');
      if (!viz.colorModeEnabled) document.getElementById('viz-color-mode-popup')?.classList.add('hidden');
      // Brain's arrange menu was left out, so once opened it stayed open over
      // the canvas until you happened to press its button again.
      document.getElementById('brain-layout-popup')?.classList.add('hidden');
      document.getElementById('viz-depth-popup')?.classList.add('hidden');
      document.getElementById('viz-tint-popup')?.classList.add('hidden');
      document.getElementById('viz-focus-popup')?.classList.add('hidden');
      document.getElementById('viz-views-popup')?.classList.add('hidden');
      document.getElementById('viz-more-popup')?.classList.add('hidden');
    }
    if (viz.activeModule === 'brain') {
      if (brain.linkingFrom && !e.target.closest('.viz-node') && !inMenu) brainCancelLinking();
    } else {
      if (viz.linkingFrom && !e.target.closest('.viz-node') && !e.target.closest('.viz-context-menu')) vizCancelLinking();
    }
  };
  document.addEventListener('click', _vizListeners.click);

  /* Ctrl+Z needs the CAPTURE phase. undo.js registers its own global handler
     at load time, so a bubble-phase listener here runs AFTER it — both fired,
     and one press undid two things. Taking it in capture lets vizUndo decide
     whether the app-wide undo is the right one to run (it is, for a delete). */
  _vizListeners.keydownCapture = (e) => {
    if (!((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey)) return;
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();
    if (viz.activeModule === 'brain') brainUndo(); else vizUndo();
  };
  document.addEventListener('keydown', _vizListeners.keydownCapture, true);

  _vizListeners.keydown = (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
    const isBrain = viz.activeModule === 'brain';

    // Select all on the canvas.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !isBrain) {
      e.preventDefault();
      vizSelectAll();
      return;
    }
    // Ctrl+Z is handled in the capture listener above; everything else with a
    // modifier belongs to the browser or the OS.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (isBrain) {
      if (e.key === 'Escape') { brainCancelLinking(); brainHideAllMenus(); }
      if (e.key === 'Delete') { if (brain.selectedNodeId) brainDeleteNode(brain.selectedNodeId); }
      if (e.key === 'f' || e.key === 'F') { brainZoomReset(); }
      if (e.key === 'l' || e.key === 'L') { brainToggleLinkMode(); }
      if (e.key === '+' || e.key === '=') { brainZoomIn(); }
      if (e.key === '-') { brainZoomOut(); }
      if (e.key === 'p' || e.key === 'P') { vizToggleForceLayout(); }
      return;
    }
    if (e.key === 'Escape') {
      if (viz.focusNodeId) { vizClearFocus(); return; }
      if (viz.selectedNodeIds.size) { vizClearSelection(); return; }
      vizCancelLinking(); vizHideAllMenus(); vizHideNodePopup();
    }
    /* Delete only. Backspace used to do this too, and it deletes the LIBRARY
       record, not just the node on the canvas — a key people press reflexively
       when no text field is focused was wired to destroying a program. */
    if (e.key === 'Delete') { vizDeleteSelection(); }
    if (e.key === 'f' || e.key === 'F') { vizZoomReset(); }
    if (e.key === 'l' || e.key === 'L') { vizToggleLinkMode(); }
    if (e.key === '+' || e.key === '=') { vizZoomIn(); }
    if (e.key === '-') { vizZoomOut(); }
    if (e.key === 'p' || e.key === 'P') { vizToggleForceLayout(); }
    if (e.key === 'g' || e.key === 'G') { vizToggleFocusHere(); }
    if (e.key === '/') { e.preventDefault(); document.getElementById('viz-search-input')?.focus(); }
  };
  document.addEventListener('keydown', _vizListeners.keydown);

  /* Releasing the button outside the window, or alt-tabbing mid-drag, meant no
     pointerup ever arrived: the canvas stayed in panning mode, kept the
     grabbing cursor, and then panned on plain pointer movement with no button
     held. */
  _vizListeners.blur = () => {
    if (typeof brain !== 'undefined') { brain.isPanning = false; brainNodeDragEnd(); }
    viz.isPanning = false;
    viz.marquee = null;
    if (typeof _vizPaintMarquee === 'function') _vizPaintMarquee();
    vizNodeDragEnd();
    const c = document.getElementById('viz-canvas-container');
    if (c) c.classList.remove('panning');
  };
  window.addEventListener('blur', _vizListeners.blur);

  setTimeout(() => vizUpdateMinimap(), 200);

  // Restore collapsible/swap UI state
  if (typeof vizRestoreUiState === 'function') vizRestoreUiState();
}

/** Remove all document-level listeners added by initVisualization so they
 *  don't stack across SPA navigations. */
function destroyVisualization() {
  if (typeof vizForceStop === 'function') vizForceStop(true); // halt physics loop
  if (typeof vizHoverClear === 'function') vizHoverClear();
  if (typeof vizStopTween === 'function') vizStopTween();
  if (typeof vizCancelScheduledPaint === 'function') vizCancelScheduledPaint();

  if (_vizListeners.pointermove) {
    document.removeEventListener('pointermove', _vizListeners.pointermove);
    document.removeEventListener('pointerup', _vizListeners.pointerup);
    document.removeEventListener('pointercancel', _vizListeners.pointerup);
  }
  if (_vizListeners.click) document.removeEventListener('click', _vizListeners.click);
  if (_vizListeners.keydown) document.removeEventListener('keydown', _vizListeners.keydown);
  if (_vizListeners.keydownCapture) document.removeEventListener('keydown', _vizListeners.keydownCapture, true);
  if (_vizListeners.blur) window.removeEventListener('blur', _vizListeners.blur);
  _vizListeners.pointermove = _vizListeners.pointerup = _vizListeners.click = null;
  _vizListeners.keydown = _vizListeners.keydownCapture = _vizListeners.blur = null;

  if (_vizResizeObserver) { _vizResizeObserver.disconnect(); _vizResizeObserver = null; }

  /* Brain's "Saved" ticker is a 5-second setInterval and its notes each hold a
     ResizeObserver. Both helpers to stop them already existed; nothing called
     them, so the timer kept polling a chip that had been removed from the DOM
     for the rest of the session. */
  if (typeof brainStopSavedTicker === 'function') brainStopSavedTicker();
  if (typeof brainClearObservers === 'function') brainClearObservers();

  if (typeof viz !== 'undefined') {
    viz._undoStack = [];
    // Any pending debounced write must land before the route goes away.
    if (typeof vizSaveNow === 'function') vizSaveNow();
  }
  if (typeof brain !== 'undefined') brain._undoStack = [];
  if (typeof _vizResetRenderCache === 'function') _vizResetRenderCache();
  const btn = document.getElementById('viz-undo-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
}

/* ============================================================
   VIZ-INIT.JS — Initialization and Document Event Binding
   ============================================================ */

// Module-level handles so we can remove listeners on destroy (otherwise each
// /visualization mount stacks another set of listeners and dblclick / mouseup
// fire N times after N navigations).
const _vizListeners = {
  mousemove: null,
  mouseup: null,
  click: null,
  keydown: null,
  blur: null
};

function initVisualization() {
  // Ensure any previous bindings are cleaned up before re-binding.
  destroyVisualization();

  // Always start on the Programs (challenge) module so the sidebar, toolbar
  // label, and active-tab highlight are consistent on every route mount.
  // Brain canvas state is preserved in `brain.*`; resetting activeModule here
  // does not lose any brain data.
  viz.activeModule = 'challenge';

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

  setTimeout(() => vizCenterCanvas(), 50);

  // Sync stateful toolbar buttons with the loaded viz state
  const fogBtn = document.getElementById('viz-fog-toggle-btn');
  if (fogBtn) {
    fogBtn.classList.add('viz-state-fog');
    fogBtn.classList.toggle('is-active', !!viz.fogEnabled);
    fogBtn.innerHTML = viz.fogEnabled
      ? `<i data-lucide="eye" style="width:12px;height:12px;"></i> Fog`
      : `<i data-lucide="eye-off" style="width:12px;height:12px;"></i> Fog`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: fogBtn });
  }
  const flowBtn = document.getElementById('viz-flow-toggle-btn');
  if (flowBtn) {
    flowBtn.classList.add('viz-state-flow');
    flowBtn.classList.toggle('is-active', !!viz.flowyDragEnabled);
  }
  const colorBtn = document.getElementById('viz-color-toggle-btn');
  if (colorBtn) {
    colorBtn.classList.add('viz-state-color');
    colorBtn.classList.toggle('is-active', !!viz.colorModeEnabled);
  }
  const linkBtn = document.getElementById('viz-link-toggle-btn');
  if (linkBtn) linkBtn.classList.toggle('is-active', !!viz.linkModeEnabled);
  if (typeof vizSyncSnapBtn === 'function') vizSyncSnapBtn();
  const globeBtn = document.getElementById('viz-globe-toggle-btn');
  if (globeBtn) {
    globeBtn.classList.add('viz-state-globe');
    globeBtn.classList.toggle('is-active', !!viz.globeModeEnabled);
  }
  const container2 = document.getElementById('viz-canvas-container');
  if (container2) container2.classList.toggle('globe-mode', !!viz.globeModeEnabled);
  if (typeof vizSyncDepthBtn === 'function') vizSyncDepthBtn();
  // Restore link arrow type label
  if (viz.defaultLinkArrowType && viz.defaultLinkArrowType !== 'arrow') {
    if (typeof vizSetLinkArrowType === 'function') vizSetLinkArrowType(viz.defaultLinkArrowType);
  }

  const container = document.getElementById('viz-canvas-container');
  if (container) {
    container.addEventListener('mousedown', vizCanvasMouseDown);
    container.addEventListener('contextmenu', vizCanvasCtx);
    container.addEventListener('wheel', vizCanvasWheel, { passive: false });
    container.addEventListener('dblclick', vizCanvasDblClick);
    container.addEventListener('dragover', vizCanvasDragOver);
    container.addEventListener('drop', vizCanvasDrop);
  }

  // Minimap click-to-navigate
  const minimapEl = document.getElementById('viz-minimap');
  if (minimapEl) {
    minimapEl.addEventListener('click', vizMinimapClick);
  }

  _vizListeners.mousemove = vizCanvasMouseMove;
  _vizListeners.mouseup = vizCanvasMouseUp;
  document.addEventListener('mousemove', _vizListeners.mousemove);
  document.addEventListener('mouseup', _vizListeners.mouseup);

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
    }
    if (viz.activeModule === 'brain') {
      if (brain.linkingFrom && !e.target.closest('.viz-node') && !inMenu) brainCancelLinking();
    } else {
      if (viz.linkingFrom && !e.target.closest('.viz-node') && !e.target.closest('.viz-context-menu')) vizCancelLinking();
    }
  };
  document.addEventListener('click', _vizListeners.click);

  _vizListeners.keydown = (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
    const isBrain = viz.activeModule === 'brain';

    // Ctrl/Cmd+Z is ours; everything else with a modifier belongs to the
    // browser or the OS.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (isBrain) brainUndo(); else vizUndo();
      return;
    }
    // The single-letter shortcuts used to ignore modifiers completely, so
    // Ctrl+F (Find) reset the canvas zoom, Cmd+L (address bar) toggled link
    // mode, and Ctrl+= (browser zoom) zoomed the canvas as well.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (isBrain) {
      if (e.key === 'Escape') { brainCancelLinking(); brainHideAllMenus(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (brain.selectedNodeId) brainDeleteNode(brain.selectedNodeId); }
      if (e.key === 'f' || e.key === 'F') { brainZoomReset(); }
      if (e.key === 'l' || e.key === 'L') { brainToggleLinkMode(); }
      if (e.key === '+' || e.key === '=') { brainZoomIn(); }
      if (e.key === '-') { brainZoomOut(); }
      if (e.key === 'p' || e.key === 'P') { vizToggleForceLayout(); }
      return;
    }
    if (e.key === 'Escape') { vizCancelLinking(); vizHideAllMenus(); vizHideNodePopup(); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (viz.selectedNodeId) { vizDeleteNode(viz.selectedNodeId); }
    }
    if (e.key === 'f' || e.key === 'F') { vizZoomReset(); }
    if (e.key === 'l' || e.key === 'L') { vizToggleLinkMode(); }
    if (e.key === '+' || e.key === '=') { vizZoomIn(); }
    if (e.key === '-') { vizZoomOut(); }
    if (e.key === 'p' || e.key === 'P') { vizToggleForceLayout(); }
  };
  document.addEventListener('keydown', _vizListeners.keydown);

  /* Releasing the button outside the window, or alt-tabbing mid-drag, meant no
     mouseup ever arrived: the canvas stayed in panning mode, kept the grabbing
     cursor, and then panned on plain mouse movement with no button held. */
  _vizListeners.blur = () => {
    if (typeof brain !== 'undefined') { brain.isPanning = false; brainNodeDragEnd(); }
    viz.isPanning = false;
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
  if (_vizListeners.mousemove) document.removeEventListener('mousemove', _vizListeners.mousemove);
  if (_vizListeners.mouseup)   document.removeEventListener('mouseup',   _vizListeners.mouseup);
  if (_vizListeners.click)     document.removeEventListener('click',     _vizListeners.click);
  if (_vizListeners.keydown)   document.removeEventListener('keydown',   _vizListeners.keydown);
  if (_vizListeners.blur)      window.removeEventListener('blur',        _vizListeners.blur);
  _vizListeners.mousemove = _vizListeners.mouseup = _vizListeners.click = _vizListeners.keydown = _vizListeners.blur = null;
  if (typeof viz !== 'undefined') viz._undoStack = [];
  if (typeof brain !== 'undefined') brain._undoStack = [];
  const btn = document.getElementById('viz-undo-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
}

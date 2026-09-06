/* Route: visualization */

/* ── The strip ─────────────────────────────────────────────────
   Five buttons used to mix two unrelated questions: which LIBRARY you were
   looking at (Programs / Snippets / Notebooks), the union of all three
   ("General"), and a completely different surface that shares only the chrome
   (Brain). It is two controls now — a multi-select of libraries, and a switch
   to Brain — which is why General no longer needs to exist as a thing.

   They are toggle buttons rather than a tablist, because more than one can be
   on at once; a plain click selects just that library, shift-click adds. */
function vizScopeChipsHTML() {
  return VIZ_LIBRARY_SCOPES.map((sc, i) => {
    const m = VIZ_SCOPE_META[sc];
    const on = i === 0;
    return `<button class="viz-module-tab${on ? ' active' : ''}" data-scope="${sc}"
        id="viz-scope-${sc}" aria-pressed="${on}"
        title="Show ${m.label} — shift-click to add a library"
        onclick="vizScopeClick(event, '${sc}')" onkeydown="vizStripKey(event)">
        <i data-lucide="${m.icon}"></i> ${m.label}</button>`;
  }).join('')
    + '<span class="viz-scope-count hidden" id="viz-scope-count" aria-live="polite"></span>'
    + '<span class="viz-strip-sep" aria-hidden="true"></span>'
    + `<button class="viz-module-tab viz-tab-brain" data-surface="brain" aria-pressed="false"
        title="Brain — your own versioned maps, not a library"
        onclick="vizSetSurface('brain')" onkeydown="vizStripKey(event)">
        <i data-lucide="brain-circuit"></i> Brain</button>`;
}

/** Left/Right move along the strip, the way a group of buttons should. */
function vizStripKey(e) {
  const keys = { ArrowLeft: -1, ArrowRight: 1, Home: 'first', End: 'last' };
  if (!(e.key in keys)) return;
  e.preventDefault();
  const tabs = [...document.querySelectorAll('.viz-module-tab')];
  const i = tabs.indexOf(e.currentTarget);
  const step = keys[e.key];
  const next = step === 'first' ? tabs[0]
    : step === 'last' ? tabs[tabs.length - 1]
      : tabs[(i + step + tabs.length) % tabs.length];
  if (next) next.focus();
}

/** One colour swatch row, used by every context menu that offers colours. */
function vizSwatchesHTML(fn) {
  const colors = [['red', '#ef4444'], ['orange', '#f97316'], ['yellow', '#eab308'], ['green', '#22c55e'],
    ['blue', '#3b82f6'], ['purple', '#a855f7'], ['pink', '#ec4899'], ['cyan', '#06b6d4']];
  return colors.map(([name, hex]) =>
    `<div class="viz-color-swatch" data-color="${name}" style="background:${hex};" role="button" tabindex="0"
       aria-label="${name}" title="${name}" onclick="${fn}('${name}')"></div>`).join('')
    + `<div class="viz-color-swatch" data-color="" style="background:var(--border-color);" role="button" tabindex="0"
       aria-label="Default colour" onclick="${fn}(null)" title="Default"></div>`;
}

function vizTemplate() {
  return `
    <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; height: 100%;">
      <div class="viz-topbar">
        <div class="viz-topbar-left">
          <h1><i data-lucide="git-branch"></i> Visualization</h1>
          <div class="viz-module-tabs-wrapper">
            <button class="viz-tabs-toggle-btn" id="viz-tabs-toggle-btn" onclick="vizToggleModuleTabs()" title="Toggle module tabs" aria-label="Toggle module tabs">
              <i data-lucide="layout-grid"></i>
            </button>
            <div class="viz-module-tabs" id="viz-module-tabs" role="group" aria-label="Libraries to show">
              ${vizScopeChipsHTML()}
            </div>
          </div>
        </div>
        <div class="viz-topbar-actions">
          <button class="btn btn-ghost btn-sm viz-tip" onclick="vizAutoPopulateForce()" data-tip="Sync from data" title="Sync from data" aria-label="Sync from data"><i data-lucide="refresh-cw" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm viz-tip" onclick="vizAutoLayout()" data-tip="Auto-layout" title="Auto-layout" aria-label="Arrange the nodes automatically"><i data-lucide="layout" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm viz-tip" id="viz-undo-btn" onclick="vizUndo()" data-tip="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" aria-label="Undo" style="opacity:0.4;" disabled><i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm viz-tip" id="viz-snap-btn" onclick="vizToggleSnap()" data-tip="Snap to grid: off" title="Snap to grid" aria-label="Snap to grid" aria-pressed="false"><i data-lucide="grid" style="width:14px;height:14px;"></i></button>
          <button class="viz-swap-btn viz-tip" onclick="vizSwapPanes()" data-tip="Swap panes" title="Swap panes" aria-label="Swap the two panes"><i data-lucide="arrow-left-right"></i></button>
        </div>
      </div>
      <div class="viz-workspace">
        <div class="viz-content-pane">
          <!-- Same header as every library pane (pane-1-header): identity tile,
               subtitle stats, the eye/tour actions, search, and the stat chips.
               This pane is the same component and used to look nothing like it. -->
          <div class="viz-content-header pane-1-header">
            <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
                <h2 class="section-header-animated" style="margin: 0; display: flex; align-items: center;">
                  <span class="section-header-icon-wrap viz-icon-wrap">
                    <i data-lucide="git-branch" id="viz-header-icon"></i>
                    <span class="section-header-icon-ring"></span>
                  </span>
                  <span class="section-header-text">
                    <span class="section-header-title" id="viz-content-scope-label">Programs</span>
                    <span class="section-header-subtitle" id="viz-header-stats">0 items</span>
                  </span>
                </h2>
              </div>
              <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
                <button class="tutorial-trigger-btn hidden" id="brain-new-btn" onclick="brainCreateVersion(null)" title="New version" aria-label="New version">
                  <i data-lucide="plus"></i>
                </button>
                <button class="tutorial-trigger-btn" id="viz-toggle-items-btn" onclick="vizToggleTreeItems()" title="Toggle item visibility" aria-label="Toggle item visibility">
                  <i data-lucide="${localStorage.getItem('vizHideItems') === 'true' ? 'eye-off' : 'eye'}" id="viz-toggle-items-icon"></i>
                </button>
                <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour" aria-label="Show page tour">
                  <i data-lucide="graduation-cap"></i>
                </button>
              </div>
            </div>
            <div id="viz-content-breadcrumb" class="viz-content-breadcrumb"><span class="viz-breadcrumb-item" style="cursor:default;color:var(--text-primary)">Root</span></div>
            <div class="search-container search-animated" style="width: 100%;">
              <i data-lucide="search"></i>
              <input type="text" id="viz-search-input" class="search-input" placeholder="Search nodes…  ( / )" aria-label="Search nodes" oninput="vizPaneSearch(this.value)" />
              <button class="viz-search-clear hidden" id="viz-search-clear" onclick="vizClearSearch()" aria-label="Clear search"><i data-lucide="x"></i></button>
            </div>
            <div class="browse-mini-stats" id="viz-mini-stats"></div>
          </div>
          <div class="viz-content-body" id="viz-content-body"></div>
        </div>
        <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
        <div class="viz-canvas-pane">
          <div class="viz-canvas-toolbar-wrap" id="viz-canvas-toolbar-wrap">
          <!-- Seventeen unlabelled icons in one flat row, mixing view toggles,
               edit modes and navigation. Grouped now, with the three you touch
               least behind one "More" button — the same treatment brain's own
               tools already had. -->
          <div class="viz-canvas-toolbar" id="viz-canvas-toolbar" role="toolbar" aria-label="Canvas tools">
            <div class="viz-canvas-toolbar-left">
              <i data-lucide="move" style="width:13px;height:13px;color:var(--color-primary);"></i>
              <span id="viz-canvas-toolbar-label">Canvas</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <span class="brain-saved-chip" id="brain-saved-chip" aria-live="polite"></span>
              <!-- Brain-only canvas options. The grid was drawn but nothing
                   snapped to it, and a map you only wanted to read was one drag
                   from being rearranged. -->
              <span class="brain-only-tools" id="brain-only-tools">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-snap-btn" onclick="brainToggleOpt('snap')" title="Snap to grid" aria-label="Snap to grid">
                  <i data-lucide="grid-3x3" style="width:12px;height:12px;"></i>
                </button>
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-links-btn" onclick="brainToggleOpt('links')" title="Show connections" aria-label="Show connections">
                  <i data-lucide="waypoints" style="width:12px;height:12px;"></i>
                </button>
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-lock-btn" onclick="brainToggleLock()" title="Lock this version (read-only)" aria-label="Lock this version">
                  <i data-lucide="lock" style="width:12px;height:12px;"></i>
                </button>
                <div class="viz-toolbar-dropdown">
                  <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-layout-btn" onclick="brainToggleLayoutMenu()" title="Arrange nodes" aria-label="Arrange nodes" aria-haspopup="true">
                    <i data-lucide="layout-dashboard" style="width:12px;height:12px;"></i>
                    <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                  </button>
                  <div id="brain-layout-popup" class="viz-toolbar-popup hidden" role="menu">
                    <div class="viz-link-type-option" role="menuitem" onclick="brainToggleLayoutMenu();brainAutoLayout('tree')"><i data-lucide="git-branch" style="width:14px;height:14px;"></i> Tree</div>
                    <div class="viz-link-type-option" role="menuitem" onclick="brainToggleLayoutMenu();brainAutoLayout('grid')"><i data-lucide="grid-3x3" style="width:14px;height:14px;"></i> Grid</div>
                    <div class="viz-link-type-option" role="menuitem" onclick="brainToggleLayoutMenu();brainAutoLayout('radial')"><i data-lucide="circle-dot" style="width:14px;height:14px;"></i> Radial</div>
                  </div>
                </div>
              </span>

              <!-- ── View: what the canvas shows and how it is coloured ── -->
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-depth-btn" onclick="vizToggleDepthMenu()" title="Canvas shows: Folders + items" aria-label="Choose what the canvas shows" aria-haspopup="true">
                  <i data-lucide="list-tree" style="width:12px;height:12px;"></i>
                  <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                </button>
                <div id="viz-depth-popup" class="viz-toolbar-popup hidden" role="menu">
                  <div class="viz-link-type-option active" role="menuitem" data-depth="all" onclick="vizSetDepth('all')"><i data-lucide="list-tree" style="width:14px;height:14px;"></i> Folders + items</div>
                  <div class="viz-link-type-option" role="menuitem" data-depth="folders" onclick="vizSetDepth('folders')"><i data-lucide="folder-tree" style="width:14px;height:14px;"></i> Folders only</div>
                  <div class="viz-link-type-option" role="menuitem" data-depth="items" onclick="vizSetDepth('items')"><i data-lucide="file" style="width:14px;height:14px;"></i> Items only</div>
                </div>
              </div>

              <!-- Colour by a rule. Painting nodes by hand is decoration; this
                   is the one thing the map can show that the tree cannot. -->
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-tint-btn" onclick="vizToggleTintMenu()" title="Colour by: Manual colours" aria-label="Colour the nodes by a rule" aria-haspopup="true">
                  <i data-lucide="paintbrush" style="width:12px;height:12px;"></i>
                  <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                </button>
                <div id="viz-tint-popup" class="viz-toolbar-popup hidden" role="menu">
                  <div class="viz-link-type-option active" role="menuitem" data-tint="none" onclick="vizSetTintRule('none')"><i data-lucide="palette" style="width:14px;height:14px;"></i> Manual colours</div>
                  <div class="viz-link-type-option" role="menuitem" data-tint="progress" onclick="vizSetTintRule('progress')"><i data-lucide="trending-up" style="width:14px;height:14px;"></i> Progress</div>
                  <div class="viz-link-type-option" role="menuitem" data-tint="score" onclick="vizSetTintRule('score')"><i data-lucide="target" style="width:14px;height:14px;"></i> Best score</div>
                  <div class="viz-link-type-option" role="menuitem" data-tint="recency" onclick="vizSetTintRule('recency')"><i data-lucide="history" style="width:14px;height:14px;"></i> Last practised</div>
                  <div class="viz-link-type-option" role="menuitem" data-tint="scope" onclick="vizSetTintRule('scope')"><i data-lucide="layers" style="width:14px;height:14px;"></i> Library</div>
                </div>
              </div>

              <!-- Local graph. 181 nodes is not a map, it is a wall. -->
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-focus-btn" onclick="vizToggleFocusMenu()" title="Local graph (G)" aria-label="Show only nodes near the selected one" aria-haspopup="true">
                  <i data-lucide="crosshair" style="width:12px;height:12px;"></i>
                  <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                </button>
                <div id="viz-focus-popup" class="viz-toolbar-popup hidden" role="menu">
                  <div class="viz-popup-title">Show around the selected node</div>
                  <div class="viz-link-type-option active" role="menuitem" data-hops="0" onclick="vizSetFocusHops(0)"><i data-lucide="maximize" style="width:14px;height:14px;"></i> The whole graph</div>
                  <div class="viz-link-type-option" role="menuitem" data-hops="1" onclick="vizSetFocusHops(1)"><i data-lucide="dot" style="width:14px;height:14px;"></i> 1 step away</div>
                  <div class="viz-link-type-option" role="menuitem" data-hops="2" onclick="vizSetFocusHops(2)"><i data-lucide="dot" style="width:14px;height:14px;"></i> 2 steps</div>
                  <div class="viz-link-type-option" role="menuitem" data-hops="3" onclick="vizSetFocusHops(3)"><i data-lucide="dot" style="width:14px;height:14px;"></i> 3 steps</div>
                </div>
              </div>

              <!-- Saved views: a bookmark of the camera and the filters. -->
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-views-btn" onclick="vizToggleViewsMenu()" title="Saved views" aria-label="Saved views" aria-haspopup="true">
                  <i data-lucide="bookmark" style="width:12px;height:12px;"></i>
                  <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                </button>
                <div id="viz-views-popup" class="viz-toolbar-popup hidden" role="menu"></div>
              </div>

              <div class="viz-toolbar-sep"></div>

              <!-- ── Edit: the two modes that change what a click does ── -->
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-link-toggle-btn" onclick="vizToggleLinkMode()" title="Link mode (L)" aria-label="Link mode" aria-pressed="false">
                  <i data-lucide="link" style="width:12px;height:12px;"></i>
                  <span class="viz-pill-chevron" onclick="event.stopPropagation();vizToggleLinkTypeDropdown()"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                </button>
                <div id="viz-link-type-popup" class="viz-toolbar-popup hidden" role="menu">
                  <div class="viz-link-type-option active" role="menuitem" data-type="arrow" onclick="vizSetLinkArrowType('arrow')"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i> Arrow</div>
                  <div class="viz-link-type-option" role="menuitem" data-type="double-arrow" onclick="vizSetLinkArrowType('double-arrow')"><i data-lucide="arrow-left-right" style="width:14px;height:14px;"></i> Double</div>
                  <div class="viz-link-type-option" role="menuitem" data-type="none" onclick="vizSetLinkArrowType('none')"><i data-lucide="minus" style="width:14px;height:14px;"></i> None</div>
                </div>
              </div>
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-color-toggle-btn" onclick="vizToggleColorMode()" title="Paint colors" aria-label="Paint colours onto nodes" aria-pressed="false">
                  <i data-lucide="palette" style="width:12px;height:12px;"></i>
                </button>
                <div id="viz-color-mode-popup" class="viz-toolbar-popup hidden" style="min-width:140px;">
                  <div class="viz-popup-title">Paint colour</div>
                  <div class="viz-color-picker" style="flex-wrap:wrap;gap:0.3rem;padding:0;">
                    ${vizSwatchesHTML('vizSetPaintColor')}
                  </div>
                </div>
              </div>
              <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-force-toggle-btn" onclick="vizToggleForceLayout()" title="Force layout (P) — physics simulation like Obsidian's graph" aria-label="Force layout" aria-pressed="false">
                <i data-lucide="atom" style="width:12px;height:12px;"></i>
              </button>

              <div class="viz-toolbar-sep"></div>
              <div class="viz-zoom-controls">
                <button class="viz-zoom-btn" onclick="vizZoomOut()" title="Zoom out (-)" aria-label="Zoom out"><i data-lucide="minus"></i></button>
                <span class="viz-zoom-level" id="viz-zoom-level" aria-live="polite">100%</span>
                <button class="viz-zoom-btn" onclick="vizZoomIn()" title="Zoom in (+)" aria-label="Zoom in"><i data-lucide="plus"></i></button>
                <button class="viz-zoom-btn" onclick="vizZoomReset()" title="Fit (F)" aria-label="Fit the graph on screen"><i data-lucide="maximize-2"></i></button>
              </div>
              <div class="viz-toolbar-sep"></div>

              <!-- ── The rest, behind one button ── -->
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn" id="viz-more-btn" onclick="vizToggleMoreMenu()" title="More canvas options" aria-label="More canvas options" aria-haspopup="true">
                  <i data-lucide="more-horizontal"></i>
                </button>
                <div id="viz-more-popup" class="viz-toolbar-popup hidden" role="menu" style="min-width:210px;">
                  <div class="viz-popup-title">Display</div>
                  <button type="button" class="viz-link-type-option" role="menuitem" id="viz-fog-toggle-btn" onclick="vizToggleFog()" aria-pressed="false"><i data-lucide="eye-off" style="width:14px;height:14px;"></i> Fog of war</button>
                  <button type="button" class="viz-link-type-option" role="menuitem" id="viz-globe-toggle-btn" onclick="vizToggleGlobeMode()" aria-pressed="false"><i data-lucide="circle-dot" style="width:14px;height:14px;"></i> Globe mode</button>
                  <button type="button" class="viz-link-type-option" role="menuitem" id="viz-flow-toggle-btn" onclick="vizToggleFlowyDrag()" aria-pressed="false"><i data-lucide="wind" style="width:14px;height:14px;"></i> Drag children along</button>
                  <!-- The minimap could only be dismissed inside Brain, which is
                       where it is least in the way. On a phone it covers 16% of
                       the canvas. -->
                  <button type="button" class="viz-link-type-option" role="menuitem" id="viz-minimap-btn" onclick="vizToggleMinimap()" aria-pressed="true"><i data-lucide="map" style="width:14px;height:14px;"></i> Minimap</button>
                  <div class="viz-ctx-divider"></div>
                  <div class="viz-popup-title">Export</div>
                  <button type="button" class="viz-link-type-option" role="menuitem" onclick="vizExportPNG()"><i data-lucide="image" style="width:14px;height:14px;"></i> Save as PNG</button>
                  <button type="button" class="viz-link-type-option" role="menuitem" onclick="vizExportSVG()"><i data-lucide="file-code-2" style="width:14px;height:14px;"></i> Save as SVG</button>
                  <div class="viz-ctx-divider"></div>
                  <button type="button" class="viz-link-type-option" role="menuitem" onclick="vizShowShortcuts()"><i data-lucide="keyboard" style="width:14px;height:14px;"></i> Keyboard shortcuts</button>
                </div>
              </div>
              <button class="viz-zoom-btn" id="viz-toolbar-collapse-btn" onclick="vizToggleCanvasToolbar()" title="Hide toolbar" aria-label="Hide the toolbar">
                <i data-lucide="chevron-up" id="viz-toolbar-chevron"></i>
              </button>
            </div>
          </div>
          </div>
          <div class="viz-canvas-container" id="viz-canvas-container">
            <svg class="viz-canvas-svg" id="viz-canvas-svg" aria-hidden="true"></svg>
            <div class="viz-nodes-layer" id="viz-nodes-layer"></div>
            <div class="viz-canvas-empty" id="viz-canvas-empty">
              <i data-lucide="git-branch"></i>
              <h3>Your Mindmap Canvas</h3>
              <p>Drag items from the left, right-click to create nodes, or double-click to add a node.</p>
              <button class="btn btn-primary btn-sm" data-empty-action="vizAutoPopulateForce()" onclick="vizAutoPopulateForce()" style="margin-top:0.5rem; pointer-events:auto;"><i data-lucide="zap" style="width:14px;height:14px;fill:currentColor;"></i> Auto-populate</button>
            </div>

            <!-- Two small status strips: what is selected, and what the local
                 graph is currently hiding. Both were state you could get into
                 with nothing on screen saying so. -->
            <div class="viz-canvas-chips">
              <div class="viz-canvas-chip hidden" id="viz-selection-chip" aria-live="polite"></div>
              <div class="viz-canvas-chip viz-focus-bar hidden" id="viz-focus-bar" aria-live="polite"></div>
            </div>

            <!-- Minimap -->
            <div class="viz-minimap" id="viz-minimap" title="Click to jump, drag to scrub">
              <canvas id="viz-minimap-canvas" width="180" height="110"></canvas>
              <div class="viz-minimap-viewport" id="viz-minimap-viewport"></div>
            </div>
            <!-- Obsidian's four graph forces. Without these the simulation has
                 exactly one look and no way to adapt to a dense or sparse graph. -->
            <div class="viz-force-panel hidden" id="viz-force-panel"></div>
            <!-- What the colours currently mean. -->
            <div class="viz-scope-legend hidden" id="viz-scope-legend" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Interactive Node Popup -->
    <div id="viz-node-details-popup" class="viz-context-menu hidden" style="width:310px; padding:0; overflow:hidden; z-index:1000;">
      <div class="viz-popup-header">
        <div style="flex:1; min-width:0;">
          <div id="viz-popup-title" style="font-weight:700; font-size:0.9375rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
          <div id="viz-popup-type-badge" style="font-size:0.6875rem; color:var(--text-tertiary); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-top:0.15rem;"></div>
        </div>
        <div style="display:flex; gap:0.25rem; flex-shrink:0;" id="viz-popup-actions"></div>
      </div>
      <div id="viz-popup-stats" class="viz-popup-stats"></div>
      <div class="viz-prereq-block">
        <div class="viz-prereq-head"><i data-lucide="lock" style="width:12px;height:12px;"></i> Needs first</div>
        <!-- This list used to be every other node on the canvas — 146 rows in a
             160px box. It shows what is actually required, and you search to
             add one. -->
        <input type="text" id="viz-prereq-search" class="viz-prereq-search" placeholder="Search to add one…"
               aria-label="Search for a prerequisite" oninput="vizPrereqSearch(this.value)" />
        <div id="viz-popup-locks-list" class="viz-prereq-list"></div>
      </div>
    </div>

    <!-- Admin Form Overlay Modal -->
    <div id="viz-admin-modal" class="modal-overlay hidden" style="z-index:9999; backdrop-filter:blur(4px); background-color:rgba(0,0,0,0.5);">
      <div class="modal-content" style="max-width:900px; width:95%; max-height:90vh; overflow-y:auto; background:var(--bg-elevated); padding:0; position:relative; display:flex; flex-direction:column; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-color);">
          <h2 id="viz-modal-form-title" style="font-weight:800; font-size:1.25rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="edit-3" style="color:var(--color-primary);"></i> Edit Program</h2>
          <button onclick="vizCloseAdminModal()" class="btn btn-ghost" style="padding:0.25rem;" aria-label="Close"><i data-lucide="x" style="width:24px;height:24px;"></i></button>
        </div>
        <div id="viz-admin-modal-body" style="flex:1; overflow-y:auto; padding:1.5rem;"></div>
      </div>
    </div>

    <!-- Canvas Context Menu -->
    <div id="viz-canvas-ctx" class="viz-context-menu hidden" role="menu">
      <button class="viz-ctx-item" onclick="vizCtxAddNode()"><i data-lucide="plus-circle"></i> <span>Add Node</span></button>
      <button class="viz-ctx-item" onclick="vizCtxAddFolder()"><i data-lucide="folder-plus"></i> <span>Add Category</span></button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="vizCtxAddComment()"><i data-lucide="message-circle"></i> Add Comment</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="vizSelectAll()"><i data-lucide="box-select"></i> Select all</button>
      <button class="viz-ctx-item" onclick="vizAutoLayout()"><i data-lucide="layout"></i> Auto Layout</button>
    </div>

    <!-- Node Context Menu -->
    <div id="viz-node-ctx" class="viz-context-menu hidden" role="menu">
      <div class="viz-color-picker">${vizSwatchesHTML('vizCtxEditColor')}</div>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" id="viz-ctx-change-icon-btn" onclick="vizCtxChangeIcon()"><i data-lucide="image"></i> Change Icon</button>
      <button class="viz-ctx-item" onclick="vizCtxRenameNode()"><i data-lucide="pencil"></i> Rename</button>
      <button class="viz-ctx-item" onclick="vizCtxAddChild()"><i data-lucide="git-branch"></i> Add Child Node</button>
      <button class="viz-ctx-item" onclick="vizCtxAddChildFolder()"><i data-lucide="folder-plus"></i> Add Category</button>
      <button class="viz-ctx-item" onclick="vizCtxAddLink()"><i data-lucide="link"></i> Add Link</button>
      <button class="viz-ctx-item" id="viz-ctx-edit-comment-btn" style="display:none;" onclick="vizCtxEditComment()"><i data-lucide="edit-2"></i> Edit Comment</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="vizCtxFocusHere()"><i data-lucide="crosshair"></i> Show only what is near this</button>
      <button class="viz-ctx-item" id="viz-ctx-reveal-btn" onclick="vizCtxReveal()"><i data-lucide="list-tree"></i> Find in the list</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" id="viz-ctx-collapse-btn" style="display:none;" onclick="vizCtxCollapseChildren()"><i data-lucide="chevrons-up"></i> Collapse Children</button>
      <button class="viz-ctx-item" id="viz-ctx-expand-btn" style="display:none;" onclick="vizCtxExpandChildren()"><i data-lucide="chevrons-down"></i> Expand Children</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item danger" onclick="vizCtxDeleteNode()"><i data-lucide="trash-2"></i> <span id="viz-ctx-delete-label">Delete Node</span></button>
    </div>

    <!-- Link Context Menu -->
    <div id="viz-link-ctx" class="viz-link-menu hidden" role="menu">
      <div class="viz-color-picker" id="viz-link-color-picker">${vizSwatchesHTML('vizCtxEditLinkColor')}</div>
      <div class="viz-ctx-divider"></div>
      <div style="display:flex;gap:0.25rem;padding:0.25rem 0.5rem;">
        <button class="viz-ctx-item" style="flex:1;justify-content:center;padding:0.375rem;" title="Arrow" aria-label="Arrow" onclick="vizCtxSetLinkArrow('arrow')"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></button>
        <button class="viz-ctx-item" style="flex:1;justify-content:center;padding:0.375rem;" title="Double Arrow" aria-label="Double arrow" onclick="vizCtxSetLinkArrow('double-arrow')"><i data-lucide="arrow-left-right" style="width:14px;height:14px;"></i></button>
        <button class="viz-ctx-item" style="flex:1;justify-content:center;padding:0.375rem;" title="No Arrow" aria-label="No arrow" onclick="vizCtxSetLinkArrow('none')"><i data-lucide="minus" style="width:14px;height:14px;"></i></button>
      </div>
      <div class="viz-ctx-divider"></div>
      <!-- A link carried colour, an arrow and a lock but no words. "explains",
           "needs first", "harder version of" is the reason to draw one. -->
      <button class="viz-ctx-item" onclick="vizCtxLabelLink()"><i data-lucide="type"></i> <span id="viz-link-label-action">Add a label</span></button>
      <button class="viz-ctx-item" data-action="toggle-lock" onclick="vizCtxToggleLock()"><i data-lucide="lock"></i> Lock</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item danger" onclick="vizCtxDeleteLink()"><i data-lucide="trash-2"></i> Delete Link</button>
    </div>

    <!-- Brain Canvas Context Menu -->
    <div id="brain-canvas-ctx" class="viz-context-menu hidden" role="menu">
      <button class="viz-ctx-item" onclick="brainCtxAddComment()"><i data-lucide="message-circle"></i> Add Comment</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="brainAutoLayout()"><i data-lucide="layout"></i> Auto Layout</button>
      <button class="viz-ctx-item" onclick="brainCenterCanvas()"><i data-lucide="maximize-2"></i> Center View</button>
    </div>

    <!-- Brain Node Context Menu -->
    <div id="brain-node-ctx" class="viz-context-menu hidden" role="menu">
      <div class="viz-color-picker">${vizSwatchesHTML('brainCtxEditColor')}</div>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="brainCtxEditComment()"><i data-lucide="edit-2"></i> Edit Comment</button>
      <button class="viz-ctx-item" onclick="brainCtxStartLink()"><i data-lucide="link"></i> Add Link</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" id="brain-ctx-collapse-btn" style="display:none;" onclick="brainCtxCollapseChildren()"><i data-lucide="chevrons-up"></i> Collapse Children</button>
      <button class="viz-ctx-item" id="brain-ctx-expand-btn" style="display:none;" onclick="brainCtxExpandChildren()"><i data-lucide="chevrons-down"></i> Expand Children</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item danger" onclick="brainCtxDeleteNode()"><i data-lucide="trash-2"></i> Delete</button>
    </div>

    <!-- Brain Link Context Menu -->
    <div id="brain-link-ctx" class="viz-link-menu hidden" role="menu">
      <div class="viz-color-picker">${vizSwatchesHTML('brainCtxEditLinkColor')}</div>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item danger" onclick="brainCtxDeleteLink()"><i data-lucide="trash-2"></i> Delete Link</button>
    </div>

    <!-- Brain Version Context Menu -->
    <div id="brain-version-ctx" class="viz-context-menu hidden" role="menu">
      <button class="viz-ctx-item" onclick="brainCtxVersionRename()"><i data-lucide="pencil"></i> Rename</button>
      <button class="viz-ctx-item" onclick="brainCtxVersionDuplicate()"><i data-lucide="copy"></i> Duplicate</button>
      <button class="viz-ctx-item" onclick="brainCtxVersionShare()"><i data-lucide="share-2"></i> Share</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item danger" onclick="brainCtxVersionDelete()"><i data-lucide="trash-2"></i> Delete</button>
    </div>
  `;
}

function vizInit() {
  if (typeof initVisualization === 'function') initVisualization();
}
function vizDestroy() {
  if (typeof destroyVisualization === 'function') destroyVisualization();
  if (typeof viz !== 'undefined') {
    viz.selectedNodeId = null;
    viz.selectedFolderId = null;
    viz.isPanning = false;
    viz.draggingNode = null;
    viz.linkingFrom = null;
    viz.contextTarget = null;
    viz.contextLinkId = null;
    viz.popupTargetNode = null;
    viz.linkModeEnabled = false;
    viz.marquee = null;
    if (viz.selectedNodeIds) viz.selectedNodeIds.clear();
    if (viz.nodes) {
      viz.nodes.forEach(n => {
        n.isEditing = false;
        n.isResizing = false;
        if (n._resizeObserver) {
          n._resizeObserver.disconnect();
          n._resizeObserver = null;
        }
      });
    }
  }
}

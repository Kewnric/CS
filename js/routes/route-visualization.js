/* Route: visualization */

/* ── The strip ─────────────────────────────────────────────────
   Two switches: Brain, your own versioned maps, and Build Mode, the library
   map. Build Mode is a dropdown holding the libraries (Programs, Snippets,
   Notebooks): a plain click shows just that one, shift-click adds or removes
   one, so any combination can still be on at once. The button names what is
   selected. Brain comes first and is where Visualize opens. */
function vizScopeChipsHTML() {
  return `<button class="viz-module-tab viz-tab-brain" data-surface="brain" aria-pressed="false"
        title="Brain: your own versioned maps"
        onclick="vizSetSurface('brain')" onkeydown="vizStripKey(event)">
        <i data-lucide="brain-circuit"></i> Brain</button>`
    + `<button class="viz-module-tab viz-tab-build active" id="viz-build-btn" data-surface="library" aria-pressed="true"
        aria-haspopup="menu" aria-expanded="false" title="Build Mode: Programs, Snippets and Notebooks"
        onclick="vizToggleBuildMenu(event)" onkeydown="vizStripKey(event)">
        <i data-lucide="hammer"></i> Build Mode<span class="viz-build-sub" id="viz-build-sub"></span><i data-lucide="chevron-down" class="viz-build-chev"></i></button>`;
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

/** One colour swatch row, used by every context menu that offers colours.
 *  `extra` adds [name, css, label] swatches before Default. */
function vizSwatchesHTML(fn, extra) {
  // copper is the Electric Border's original colour (#dd8448). White and black
  // are in every row now; the connector menu had neither.
  const colors = [['red', '#ef4444'], ['orange', '#f97316'], ['copper', '#dd8448'], ['yellow', '#eab308'], ['green', '#22c55e'],
    ['blue', '#3b82f6'], ['purple', '#a855f7'], ['pink', '#ec4899'], ['cyan', '#06b6d4'], ['white', '#ffffff'], ['black', '#000000']];
  const more = (extra || []).filter(([name]) => !colors.some(c => c[0] === name));
  return colors.concat(more).map(([name, hex, label]) =>
    `<div class="viz-color-swatch" data-color="${name}" style="background:${hex};" role="button" tabindex="0"
       aria-label="${label || name}" title="${label || name}" onclick="${fn}('${name}')"></div>`).join('')
    // The rainbow one opens the colour wheel (viz-colorwheel.js) for any colour.
    + `<div class="viz-color-swatch viz-swatch-wheel" data-color="wheel" role="button" tabindex="0"
       aria-label="Custom colour" title="Custom colour: a wheel, a hex code or the eyedropper" onclick="vizOpenColorWheel(event, '${fn}')"></div>`
    + `<div class="viz-color-swatch" data-color="" style="background:var(--border-color);" role="button" tabindex="0"
       aria-label="Default colour" onclick="${fn}(null)" title="Default"></div>`;
}

function vizTemplate() {
  return `
    <div class="viz-page" style="flex:1; display:flex; flex-direction:column; overflow:hidden; height: 100%;">
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
      <!-- The coding attempt's fold arrows (layout.css .tb-seam / .rz-collapse):
           this one folds the topbar away, the divider's folds the first pane. -->
      <div class="tb-seam viz-tb-seam">
        <button class="rz-collapse tb-collapse" id="rz-viz-top-btn" type="button" onclick="vizToggleTopbar()" tabindex="-1" aria-hidden="true"><i data-lucide="chevron-up"></i></button>
      </div>
      <div class="viz-workspace">
        <!-- Canvas only: folds the app sidebar (vizToggleZenSidebar). -->
        <div class="resizer-divider viz-side-seam" id="viz-side-seam">
          <button class="rz-collapse" id="rz-viz-side-btn" type="button" onclick="vizToggleZenSidebar()" tabindex="-1" aria-hidden="true"><i data-lucide="chevron-left"></i></button>
        </div>
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
                <button class="tutorial-trigger-btn hidden" id="brain-new-btn" onclick="brainCreateVersion(null)" title="New Canvas" aria-label="New Canvas">
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
        <div class="resizer-divider" onmousedown="initResizerDrag(event, this)">
          <button class="rz-collapse" id="rz-viz-pane-btn" type="button" onmousedown="event.stopPropagation()" onclick="vizTogglePane()" tabindex="-1" aria-hidden="true"><i data-lucide="chevron-left"></i></button>
        </div>
        <div class="viz-canvas-pane">
          <div class="viz-canvas-toolbar-wrap" id="viz-canvas-toolbar-wrap">
          <!-- Seventeen unlabelled icons used to sit in one flat row. They are
               sorted into three categories now -- Build, View, Edit -- and only
               the open one's tools are on screen; zoom and More stay put.
               vizToolCat switches, vizToolCatSync hides an empty category. -->
          <div class="viz-canvas-toolbar" id="viz-canvas-toolbar" role="toolbar" aria-label="Canvas tools">
            <div class="viz-canvas-toolbar-left">
              <span class="vct-icon" id="viz-canvas-toolbar-icon" aria-hidden="true"><i data-lucide="git-branch"></i></span>
              <span class="vct-text" id="viz-canvas-toolbar-label"><span class="vct-eyebrow">Canvas</span><span class="vct-name">Canvas</span></span>
            </div>
            <!-- The tabs sit beside the title, so switching category never moves
                 them: only the tools on the right change width. -->
            <!-- ── Categories: the tools sorted into three, one shown at a time ── -->
            <div class="vtb-cats" role="tablist" aria-label="Tool categories" onkeydown="vizToolCatKey(event)">
              <span class="vtb-ink" aria-hidden="true"></span>
              <button type="button" class="vtb-cat" role="tab" data-cat="build" aria-selected="false" onclick="vizToolCat('build')" title="Build: snap, connections, lock, arrange and insert">
                <i data-lucide="hammer"></i><span>Build</span>
              </button>
              <button type="button" class="vtb-cat" role="tab" data-cat="view" aria-selected="false" onclick="vizToolCat('view')" title="View: what the canvas shows, colours, focus, saved views, sheet and display">
                <i data-lucide="eye"></i><span>View</span>
              </button>
              <button type="button" class="vtb-cat" role="tab" data-cat="edit" aria-selected="false" onclick="vizToolCat('edit')" title="Edit: link, paint and physics">
                <i data-lucide="pen-tool"></i><span>Edit</span>
              </button>
            </div>
            <div class="vtb-main">
              <span class="brain-saved-chip" id="brain-saved-chip" aria-live="polite"></span>

              <div class="vtb-panels">
                <!-- Build: Brain's own tools. -->
                <div class="vtb-panel" data-cat="build" role="tabpanel" aria-label="Build">
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
                  <!-- Free-standing objects: arrows, lines, a timeline, shapes, text. -->
                  <div class="viz-toolbar-dropdown">
                    <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-insert-btn" onclick="brainToggleInsertMenu()" title="Insert an object" aria-label="Insert an object" aria-haspopup="true">
                      <i data-lucide="shapes" style="width:12px;height:12px;"></i>
                      <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                    </button>
                    <div id="brain-insert-popup" class="viz-toolbar-popup hidden" role="menu" style="min-width:236px;">
                      <!-- Two categories. Library: a note that links to something
                           in a library and plays it or shows where it lives
                           (brain-libref.js). Objects: the drawings. -->
                      <div class="viz-popup-title">Library</div>
                      <div class="blr-tiles">${typeof brainRefInsertTilesHTML === 'function' ? brainRefInsertTilesHTML() : ''}</div>
                      <div class="viz-ctx-divider"></div>
                      <div class="viz-popup-title">Objects</div>
                      ${(typeof BRAIN_SHAPES !== 'undefined' ? BRAIN_SHAPES : []).map(([id, label, icon]) =>
                        `<div class="viz-link-type-option" role="menuitem" onclick="brainInsertShape('${id}')"><i data-lucide="${icon}" style="width:14px;height:14px;"></i> ${label}</div>`).join('')}
                    </div>
                  </div>
                </span>

                </div>

                <!-- View: what the canvas shows and how it looks. -->
                <div class="vtb-panel" data-cat="view" role="tabpanel" aria-label="View">
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

                <!-- ── The sheet the canvas is drawn on: one dropdown, with its
                     pattern and its colour as two child dropdowns ── -->
                <div class="viz-toolbar-dropdown">
                  <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-sheet-btn" onclick="vizToggleSheetMenu()" title="Sheet" aria-label="Sheet: pattern and colour" aria-haspopup="true">
                    <i data-lucide="grid-2x2" style="width:12px;height:12px;"></i>
                    <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                  </button>
                  <div id="viz-sheet-popup" class="viz-toolbar-popup hidden" role="menu" style="min-width:220px;">
                    <div class="viz-popup-title">Sheet</div>
                    <button type="button" class="viz-link-type-option viz-sheet-sub-toggle" id="viz-sheet-pattern-toggle" aria-haspopup="menu" aria-expanded="false" onclick="vizToggleSheetSub('pattern')"><i data-lucide="grid-2x2"></i> Pattern <span class="viz-sheet-current" id="viz-sheet-pattern-current"></span><i data-lucide="chevron-down" class="viz-ctx-sub-chev"></i></button>
                    <div class="viz-ctx-submenu hidden" id="viz-sheet-pattern-list" role="menu">
                      ${(typeof VIZ_SHEETS !== 'undefined' ? VIZ_SHEETS : []).map(([id, label]) =>
                        `<div class="viz-link-type-option" role="menuitem" data-sheet="${id}" onclick="vizSetSheet('${id}')"><span class="viz-sheet-chip" data-sheet="${id}"></span>${label}</div>`).join('')}
                    </div>
                    <button type="button" class="viz-link-type-option viz-sheet-sub-toggle" id="viz-sheet-color-toggle" aria-haspopup="menu" aria-expanded="false" onclick="vizToggleSheetSub('color')"><i data-lucide="paint-bucket"></i> Colour <span class="viz-sheet-current" id="viz-sheet-color-current"></span><i data-lucide="chevron-down" class="viz-ctx-sub-chev"></i></button>
                    <div class="viz-ctx-submenu hidden" id="viz-sheet-color-list" role="menu">
                      ${(typeof VIZ_SHEET_COLORS !== 'undefined' ? VIZ_SHEET_COLORS : []).map(([id, label, swatch]) =>
                        `<div class="viz-link-type-option" role="menuitem" data-sheet-color="${id}" onclick="vizSetSheetColor('${id}')"><span class="viz-sheet-swatch" style="background:${swatch};"></span>${label}</div>`).join('')}
                    </div>
                  </div>
                </div>

                  <!-- Display: the switches that used to hide in More. -->
                  <div class="viz-toolbar-dropdown">
                    <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-display-btn" onclick="vizToggleDisplayMenu()" title="Display: fog, globe, drag children, minimap" aria-label="Display options" aria-haspopup="true">
                      <i data-lucide="monitor" style="width:12px;height:12px;"></i>
                      <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                    </button>
                    <div id="viz-display-popup" class="viz-toolbar-popup hidden" role="menu" style="min-width:210px;">
                      <div class="viz-popup-title">Display</div>
                      <button type="button" class="viz-link-type-option" role="menuitem" id="viz-fog-toggle-btn" onclick="vizToggleFog()" aria-pressed="false"><i data-lucide="eye-off" style="width:14px;height:14px;"></i> Fog of war</button>
                      <button type="button" class="viz-link-type-option" role="menuitem" id="viz-globe-toggle-btn" onclick="vizToggleGlobeMode()" aria-pressed="false"><i data-lucide="circle-dot" style="width:14px;height:14px;"></i> Globe mode</button>
                      <button type="button" class="viz-link-type-option" role="menuitem" id="viz-flow-toggle-btn" onclick="vizToggleFlowyDrag()" aria-pressed="false"><i data-lucide="wind" style="width:14px;height:14px;"></i> Drag children along</button>
                      <!-- The minimap could only be dismissed inside Brain, which is
                           where it is least in the way. On a phone it covers 16% of
                           the canvas. -->
                      <button type="button" class="viz-link-type-option" role="menuitem" id="viz-minimap-btn" onclick="vizToggleMinimap()" aria-pressed="true"><i data-lucide="map" style="width:14px;height:14px;"></i> Minimap</button>
                    </div>
                  </div>
                </div>

                <!-- Edit: the modes that change what a click does. -->
                <div class="vtb-panel" data-cat="edit" role="tabpanel" aria-label="Edit">
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

                </div>
              </div>

              <div class="viz-toolbar-sep"></div>
              <div class="viz-zoom-controls">
                <button class="viz-zoom-btn" onclick="vizZoomOut()" title="Zoom out (-)" aria-label="Zoom out"><i data-lucide="minus"></i></button>
                <span class="viz-zoom-level" id="viz-zoom-level" aria-live="polite">100%</span>
                <button class="viz-zoom-btn" onclick="vizZoomIn()" title="Zoom in (+)" aria-label="Zoom in"><i data-lucide="plus"></i></button>
                <!-- Fit frames the graph; it used maximize-2, the usual full-screen glyph. -->
                <button class="viz-zoom-btn" onclick="vizZoomReset()" title="Fit (F)" aria-label="Fit the graph on screen"><i data-lucide="scan"></i></button>
              </div>
              <button class="viz-zoom-btn" id="viz-zen-btn" onclick="vizToggleZen()" title="Canvas only (Ctrl+\\)" aria-label="Canvas only" aria-pressed="false"><i data-lucide="expand"></i></button>
              <div class="viz-toolbar-sep"></div>

              <!-- ── Export and help, behind one button ── -->
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn" id="viz-more-btn" onclick="vizToggleMoreMenu()" title="Export and shortcuts" aria-label="Export and shortcuts" aria-haspopup="true">
                  <i data-lucide="more-horizontal"></i>
                </button>
                <div id="viz-more-popup" class="viz-toolbar-popup hidden" role="menu" style="min-width:210px;">
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
            <svg class="viz-canvas-svg viz-heads-svg" id="viz-heads-svg" aria-hidden="true"></svg>
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
      <button class="viz-ctx-item" onclick="vizCtxAddFrame()"><i data-lucide="group"></i> <span id="viz-ctx-frame-label">Add Group Frame</span></button>
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
    <div id="viz-link-ctx" class="viz-link-menu bnm-menu hidden" role="menu">
      <div class="bnm-label">Colour</div>
      <div class="viz-color-picker" id="viz-link-color-picker">${vizSwatchesHTML('vizCtxEditLinkColor')}</div>
      <div class="bnm-label">Connector</div>
      <div class="bnm-seg" role="group" aria-label="Connector type">
        <button type="button" title="Arrow" aria-label="Arrow" onclick="vizCtxSetLinkArrow('arrow')"><i data-lucide="arrow-right"></i><span>Arrow</span></button>
        <button type="button" title="Double Arrow" aria-label="Double arrow" onclick="vizCtxSetLinkArrow('double-arrow')"><i data-lucide="arrow-left-right"></i><span>Double</span></button>
        <button type="button" title="No Arrow" aria-label="No arrow" onclick="vizCtxSetLinkArrow('none')"><i data-lucide="minus"></i><span>None</span></button>
      </div>
      <!-- A link carried colour, an arrow and a lock but no words. "explains",
           "needs first", "harder version of" is the reason to draw one. -->
      <div class="bnm-actions">
        <button type="button" class="bnm-act" onclick="vizCtxLabelLink()" title="Label this link"><i data-lucide="type"></i><span id="viz-link-label-action">Add a label</span></button>
        <button type="button" class="bnm-act" data-action="toggle-lock" onclick="vizCtxToggleLock()" title="Lock or unlock"><i data-lucide="lock"></i> Lock</button>
        <button type="button" class="bnm-act danger" onclick="vizCtxDeleteLink()" title="Delete Link"><i data-lucide="trash-2"></i><span>Delete</span></button>
      </div>
    </div>

    <!-- Brain Canvas Context Menu -->
    <div id="brain-canvas-ctx" class="viz-context-menu hidden" role="menu">
      <button class="viz-ctx-item" onclick="brainCtxAddComment()"><i data-lucide="message-circle"></i> Add Comment</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="brainAutoLayout()"><i data-lucide="layout"></i> Auto Layout</button>
      <button class="viz-ctx-item" onclick="brainCenterCanvas()"><i data-lucide="maximize-2"></i> Center View</button>
    </div>

    <!-- Brain Node Context Menu -->
    <!-- The note menu, in three parts: the library link (only on a link), the
         style -- five tabs, one panel open at a time -- and the actions as one
         row. Every control keeps its id and handler; only the arrangement is
         new. It used to be fourteen rows. -->
    <div id="brain-node-ctx" class="viz-context-menu brain-note-menu hidden" role="menu">
      <!-- A library link's own controls (brain-libref.js): what its button does,
           the other action once, and pointing it at something else. -->
      <div id="brain-ctx-ref" class="brain-ctx-ref hidden">
        <div class="brain-ctx-ref-head">
          <span class="brain-ctx-ref-ic"><i data-lucide="link-2"></i></span>
          <span class="brain-ctx-ref-text"><b id="brain-ctx-ref-name">Library link</b><span id="brain-ctx-ref-where"></span></span>
          <!-- Done: dims the note like a finished card in its library. Yours to
               set; nothing marks it for you. -->
          <button type="button" class="bnm-icon brain-ref-done-btn" id="brain-ctx-ref-done" aria-pressed="false" onclick="brainRefToggleDone()" title="Mark as done" aria-label="Mark as done"><i data-lucide="check-circle-2"></i></button>
          <button type="button" class="bnm-icon" id="brain-ctx-ref-other" data-mode="goto" onclick="brainRefCtxOther()" title="Show in library now" aria-label="Show in library now"><i data-lucide="locate-fixed"></i></button>
          <button type="button" class="bnm-icon" onclick="brainRefCtxRelink()" title="Link another item…" aria-label="Link another item"><i data-lucide="replace"></i></button>
        </div>
        <div class="brain-ref-mode" role="radiogroup" aria-label="What the note's button does" title="What the note's button does">
          <button type="button" role="radio" data-mode="play" aria-checked="true" onclick="brainRefSetMode('play')" title="Start it, through its timer or setup window when it has one"><i data-lucide="play"></i> Play</button>
          <button type="button" role="radio" data-mode="goto" aria-checked="false" onclick="brainRefSetMode('goto')" title="Open its library at its folder and light it up"><i data-lucide="locate-fixed"></i> Show in library</button>
        </div>
      </div>

      <!-- Style: Personalize Color, Border Type, Text Alignment, Font Family,
           Spacing. Every colour lives in Color: one swatch row and a toggle for
           what it paints (node.textColor, node.bg, node.color, and on a link
           its button and tag). Charcoal is the original Electric Border card's
           fill. Font's Default is the border's own font. -->
      <div class="bnm-section">
        <div class="bnm-tabs" role="toolbar" aria-label="Style">
        <button type="button" class="bnm-tab" id="brain-node-colors-toggle" aria-haspopup="menu" aria-expanded="false" onclick="brainToggleNodeSub(event, 'colors')" title="Personalize Color"><i data-lucide="palette"></i><span>Color</span></button>
        <button type="button" class="bnm-tab" id="brain-node-border-toggle" aria-haspopup="menu" aria-expanded="false" onclick="brainToggleNodeSub(event, 'border')" title="Border Type"><i data-lucide="frame"></i><span>Border</span></button>
        <button type="button" class="bnm-tab" id="brain-node-align-toggle" aria-haspopup="menu" aria-expanded="false" onclick="brainToggleNodeSub(event, 'align')" title="Text Alignment"><i data-lucide="align-left"></i><span>Align</span></button>
        <button type="button" class="bnm-tab" id="brain-node-font-toggle" aria-haspopup="menu" aria-expanded="false" onclick="brainToggleNodeSub(event, 'font')" title="Font Family"><i data-lucide="type"></i><span>Font</span></button>
        <button type="button" class="bnm-tab" id="brain-node-spacing-toggle" aria-haspopup="menu" aria-expanded="false" onclick="brainToggleNodeSub(event, 'spacing')" title="Spacing"><i data-lucide="unfold-vertical"></i><span>Spacing</span></button>
        </div>
        <div class="bnm-panels">
        <div class="viz-ctx-submenu hidden" id="brain-node-colors-menu" role="menu">
          <button type="button" class="brain-color-target-btn" id="brain-color-target-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="What the colour applies to" onclick="brainToggleColorTargetList(event)"><span id="brain-color-target-label">Border Edge Color</span><i data-lucide="chevron-down"></i></button>
          <div class="brain-color-target-list hidden" id="brain-color-target-list" role="listbox">
            <div class="viz-link-type-option" role="option" data-target="text" onclick="brainSetColorTarget('text')"><i data-lucide="type"></i> Text Color</div>
            <div class="viz-link-type-option" role="option" data-target="bg" onclick="brainSetColorTarget('bg')"><i data-lucide="paint-bucket"></i> Background Color</div>
            <div class="viz-link-type-option" role="option" data-target="edge" onclick="brainSetColorTarget('edge')"><i data-lucide="square"></i> Border Edge Color</div>
            <!-- A library link's own two (brain-libref.js); hidden on other notes. -->
            <div class="viz-link-type-option brain-ref-only hidden" role="option" data-target="refbtn" onclick="brainSetColorTarget('refbtn')"><i data-lucide="play"></i> Button Color</div>
            <div class="viz-link-type-option brain-ref-only hidden" role="option" data-target="reftag" onclick="brainSetColorTarget('reftag')"><i data-lucide="tag"></i> Tag Color</div>
          </div>
          <div class="viz-color-picker" id="brain-note-swatches">${vizSwatchesHTML('brainCtxPickColor', [['white', '#ffffff'], ['softwhite', '#e2e8f0', 'soft white (the default note text)'], ['black', '#000000'], ['charcoal', 'oklch(0.185 0 0)', 'charcoal (Electric Border original)']])}</div>
        </div>
        <div class="viz-ctx-submenu hidden" id="brain-node-border-menu" role="menu">
          <div class="viz-link-type-option" role="menuitem" data-border="" onclick="brainCtxSetBorder(null)"><i data-lucide="square"></i> Default</div>
          <div class="viz-link-type-option" role="menuitem" data-border="electric" onclick="brainCtxSetBorder('electric')"><i data-lucide="zap"></i> Electric Border</div>
          <div class="viz-link-type-option" role="menuitem" data-border="medieval" onclick="brainCtxSetBorder('medieval')"><i data-lucide="castle"></i> Medieval Border</div>
          <!-- Manhua Border is a dropdown of its own: picking it makes the note
               Manhua and opens it, and its one child is Bubble Shape, which holds
               the balloons. None of it exists for any other border. -->
          <div class="viz-link-type-option brain-manhua-opt" role="menuitem" id="brain-node-manhua-toggle" data-border="manhua" aria-haspopup="menu" aria-expanded="false" onclick="brainCtxManhua(event)"><i data-lucide="message-circle"></i> Manhua Border <i data-lucide="chevron-down" class="viz-ctx-sub-chev"></i></div>
          <div class="viz-ctx-submenu hidden" id="brain-node-manhua-menu" role="menu">
            <button class="viz-ctx-item" id="brain-node-bubble-toggle" aria-haspopup="menu" aria-expanded="false" onclick="brainToggleBubbleSub(event)"><i data-lucide="message-square"></i> Bubble Shape <i data-lucide="chevron-down" class="viz-ctx-sub-chev"></i></button>
            <div class="viz-ctx-submenu hidden" id="brain-node-bubble-menu" role="menu">
              ${(typeof BRAIN_BUBBLES !== 'undefined' ? BRAIN_BUBBLES : []).map(([id, label]) =>
                `<div class="viz-link-type-option" role="menuitem" data-bubble="${id}" onclick="brainCtxSetBubble('${id}')">${label}</div>`).join('')}
            </div>
          </div>
        </div>
        <div class="viz-ctx-submenu hidden" id="brain-node-align-menu" role="menu">
          <div class="viz-link-type-option" role="menuitem" data-value="left" onclick="brainCtxSetNote('textAlign', 'left')"><i data-lucide="align-left"></i> Left</div>
          <div class="viz-link-type-option" role="menuitem" data-value="center" onclick="brainCtxSetNote('textAlign', 'center')"><i data-lucide="align-center"></i> Center</div>
          <div class="viz-link-type-option" role="menuitem" data-value="right" onclick="brainCtxSetNote('textAlign', 'right')"><i data-lucide="align-right"></i> Right</div>
        </div>
        <div class="viz-ctx-submenu hidden" id="brain-node-font-menu" role="menu">
          <div class="viz-link-type-option" role="menuitem" data-value="" onclick="brainCtxSetNote('fontFamily', null)">Default</div>
          <div class="viz-link-type-option" role="menuitem" data-value="arial" style="font-family: Arial, Helvetica, sans-serif;" onclick="brainCtxSetNote('fontFamily', 'arial')">Arial</div>
          <div class="viz-link-type-option" role="menuitem" data-value="sans" style="font-family: sans-serif;" onclick="brainCtxSetNote('fontFamily', 'sans')">Sans-serif</div>
          <div class="viz-link-type-option" role="menuitem" data-value="comic" style="font-family: var(--font-comic); text-transform: uppercase;" onclick="brainCtxSetNote('fontFamily', 'comic')">Comic (Manga)</div>
        </div>
        <div class="viz-ctx-submenu hidden" id="brain-node-spacing-menu" role="menu">
          <div class="viz-popup-title">Line Spacing</div>
          <div class="brain-spacing-row" data-prop="lineSpacing"><button type="button" data-value="1" onclick="brainCtxSetNote('lineSpacing', 1)">1.0</button><button type="button" data-value="1.15" onclick="brainCtxSetNote('lineSpacing', 1.15)">1.15</button><button type="button" data-value="1.5" onclick="brainCtxSetNote('lineSpacing', null)">1.5</button><button type="button" data-value="2" onclick="brainCtxSetNote('lineSpacing', 2)">2.0</button></div>
          <div class="viz-popup-title">Paragraph Spacing</div>
          <div class="brain-spacing-row" data-prop="paraSpacing"><button type="button" data-value="" onclick="brainCtxSetNote('paraSpacing', null)">None</button><button type="button" data-value="s" onclick="brainCtxSetNote('paraSpacing', 's')">Small</button><button type="button" data-value="m" onclick="brainCtxSetNote('paraSpacing', 'm')">Medium</button><button type="button" data-value="l" onclick="brainCtxSetNote('paraSpacing', 'l')">Large</button></div>
        </div>
        </div>
      </div>

      <!-- Actions, one row. -->
      <div class="bnm-actions">
        <button type="button" class="bnm-act" onclick="brainCtxEditComment()" title="Edit Comment"><i data-lucide="edit-2"></i><span>Edit</span></button>
        <button type="button" class="bnm-act" onclick="brainCtxStartLink()" title="Add Link"><i data-lucide="link"></i><span>Link</span></button>
        <button type="button" class="bnm-act" id="brain-ctx-check-btn" aria-pressed="false" onclick="brainCtxToggleCheck()" title="Put a check mark on this note"><i data-lucide="circle-check"></i><span>Check</span></button>
        <button type="button" class="bnm-act" id="brain-ctx-collapse-btn" style="display:none;" onclick="brainCtxCollapseChildren()" title="Collapse Children"><i data-lucide="chevrons-up"></i><span>Collapse</span></button>
        <button type="button" class="bnm-act" id="brain-ctx-expand-btn" style="display:none;" onclick="brainCtxExpandChildren()" title="Expand Children"><i data-lucide="chevrons-down"></i><span>Expand</span></button>
        <button type="button" class="bnm-act danger" onclick="brainCtxDeleteNode()" title="Delete"><i data-lucide="trash-2"></i><span>Delete</span></button>
      </div>
    </div>

    <!-- Brain Link Context Menu -->
    <!-- Brain's connector menu, laid out like the note menu: its colour, its
         three heads as one switch you can see, and Delete. -->
    <div id="brain-link-ctx" class="viz-link-menu bnm-menu hidden" role="menu">
      <div class="bnm-label">Colour</div>
      <div class="viz-color-picker">${vizSwatchesHTML('brainCtxEditLinkColor')}</div>
      <div class="bnm-label">Connector</div>
      <div class="bnm-seg" id="brain-link-type-menu" role="radiogroup" aria-label="Connector type">
        <button type="button" role="radio" data-type="arrow" aria-checked="false" onclick="brainCtxSetLinkArrow('arrow')" title="Arrow"><i data-lucide="arrow-right"></i><span>Arrow</span></button>
        <button type="button" role="radio" data-type="double-arrow" aria-checked="false" onclick="brainCtxSetLinkArrow('double-arrow')" title="Double arrow"><i data-lucide="arrow-left-right"></i><span>Double</span></button>
        <button type="button" role="radio" data-type="none" aria-checked="false" onclick="brainCtxSetLinkArrow('none')" title="No arrow"><i data-lucide="minus"></i><span>None</span></button>
      </div>
      <div class="bnm-actions">
        <button type="button" class="bnm-act danger" onclick="brainCtxDeleteLink()" title="Delete Link"><i data-lucide="trash-2"></i><span>Delete</span></button>
      </div>
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
  vizToolCatSync();
}

/* ── Tool categories ───────────────────────────────────────────
   Build is Brain's own (snap, connections, lock, arrange, insert); View is
   what the canvas shows and how (depth, colour rule, focus, saved views,
   sheet, display switches); Edit is what a click does (link, paint, physics).
   One is open at a time and remembered; a highlight slides between the tabs,
   and a tab whose tools are switched on carries a dot, so a mode left on is
   never hidden behind another tab. */
const VIZ_TOOL_CAT_KEY = 'ssp.vizToolCat';

function vizToolCat(cat, quiet) {
  const bar = document.getElementById('viz-canvas-toolbar');
  const tab = bar && bar.querySelector(`.vtb-cat[data-cat="${cat}"]`);
  if (!tab || tab.classList.contains('hidden')) return;
  if (!tab.classList.contains('is-active') && typeof vizClosePopups === 'function') vizClosePopups();
  bar.querySelectorAll('.vtb-cat').forEach(t => {
    const on = t === tab;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  bar.querySelectorAll('.vtb-panel').forEach(p => p.classList.toggle('is-active', p.dataset.cat === cat));
  _vizToolCatInk(bar);
  if (!quiet) { try { localStorage.setItem(VIZ_TOOL_CAT_KEY, cat); } catch (e) { /* private mode */ } }
}

/** The sliding highlight sits under the open tab. */
function _vizToolCatInk(bar) {
  const tab = bar.querySelector('.vtb-cat.is-active');
  const ink = bar.querySelector('.vtb-ink');
  if (!tab || !ink) return;
  ink.style.setProperty('--x', tab.offsetLeft + 'px');
  ink.style.setProperty('--w', tab.offsetWidth + 'px');
}

/** A tab whose tools have something switched on carries a dot. */
function _vizToolCatDots(bar) {
  bar.querySelectorAll('.vtb-panel').forEach(p => {
    const tab = bar.querySelector(`.vtb-cat[data-cat="${p.dataset.cat}"]`);
    const on = [...p.querySelectorAll('.viz-toolbar-pill-btn.is-active, .viz-toolbar-pill-btn.active, .viz-toolbar-pill-btn[aria-pressed="true"]')]
      .some(b => !b.closest('.hidden'));
    if (tab) tab.classList.toggle('has-on', on);
  });
}

/* Which categories have anything in them: outside Brain, Build is empty and
   its tab goes; the four library views go inside Brain. Called on every
   module switch (vizSyncModuleTools) and when the page opens. */
function vizToolCatSync() {
  const bar = document.getElementById('viz-canvas-toolbar');
  if (!bar) return;
  bar.querySelectorAll('.vtb-panel').forEach(p => {
    const tab = bar.querySelector(`.vtb-cat[data-cat="${p.dataset.cat}"]`);
    const has = [...p.querySelectorAll('.viz-toolbar-pill-btn')].some(b => !b.closest('.hidden'));
    if (tab) tab.classList.toggle('hidden', !has);
  });
  const usable = c => { const t = c && bar.querySelector(`.vtb-cat[data-cat="${c}"]`); return t && !t.classList.contains('hidden'); };
  let saved = null;
  try { saved = localStorage.getItem(VIZ_TOOL_CAT_KEY); } catch (e) { saved = null; }
  const isBrain = typeof viz !== 'undefined' && viz.activeModule === 'brain';
  const cat = [saved, isBrain ? 'build' : 'view', 'view', 'edit', 'build'].find(usable);
  if (cat) vizToolCat(cat, true);
  // Keep the highlight under its tab as the bar narrows and the labels go,
  // and the dots honest as tools switch on and off.
  if (!bar._vtbWatch) {
    bar._vtbWatch = true;
    if (typeof ResizeObserver === 'function') {
      const cats = bar.querySelector('.vtb-cats');
      if (cats) new ResizeObserver(() => _vizToolCatInk(bar)).observe(cats);
    }
    const panels = bar.querySelector('.vtb-panels');
    if (panels && typeof MutationObserver === 'function') {
      new MutationObserver(() => _vizToolCatDots(bar))
        .observe(panels, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });
    }
  }
  _vizToolCatDots(bar);
}

/** Left and right arrows move between the tabs. */
function vizToolCatKey(e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const tabs = [...e.currentTarget.querySelectorAll('.vtb-cat:not(.hidden)')];
  const i = tabs.findIndex(t => t.classList.contains('is-active'));
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  if (!next) return;
  e.preventDefault();
  vizToolCat(next.dataset.cat);
  next.focus();
}

/** View's Display menu: fog, globe, drag children, minimap. */
function vizToggleDisplayMenu() {
  if (typeof vizTogglePopup === 'function') vizTogglePopup('viz-display-popup', typeof vizSyncMoreMenu === 'function' ? vizSyncMoreMenu : null);
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

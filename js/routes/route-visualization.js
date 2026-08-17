/* Route: visualization */
function vizTemplate() {
  return `
    <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; height: 100%;">
      <div class="viz-topbar">
        <div class="viz-topbar-left">
          <h1><i data-lucide="git-branch"></i> Visualization</h1>
          <div class="viz-module-tabs-wrapper">
            <button class="viz-tabs-toggle-btn" id="viz-tabs-toggle-btn" onclick="vizToggleModuleTabs()" title="Toggle module tabs">
              <i data-lucide="layout-grid"></i>
            </button>
            <div class="viz-module-tabs" id="viz-module-tabs">
              <button class="viz-module-tab active" data-module="challenge" onclick="vizSwitchModule('challenge')"><i data-lucide="code"></i> Programs</button>
              <button class="viz-module-tab" data-module="snippet" onclick="vizSwitchModule('snippet')"><i data-lucide="file-text"></i> Snippets</button>
              <button class="viz-module-tab" data-module="notebook" onclick="vizSwitchModule('notebook')"><i data-lucide="book"></i> Notebooks</button>
              <button class="viz-module-tab" data-module="general" onclick="vizSwitchModule('general')"><i data-lucide="layers"></i> General</button>
              <button class="viz-module-tab" data-module="brain" onclick="vizSwitchModule('brain')"><i data-lucide="brain-circuit"></i> Brain</button>
            </div>
          </div>
        </div>
        <div class="viz-topbar-actions">
          <button class="btn btn-ghost btn-sm viz-tip" onclick="vizAutoPopulateForce()" data-tip="Sync from data" title="Sync from data"><i data-lucide="refresh-cw" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm viz-tip" onclick="vizAutoLayout()" data-tip="Auto-layout" title="Auto-layout"><i data-lucide="layout" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm viz-tip" id="viz-undo-btn" onclick="vizUndo()" data-tip="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" style="opacity:0.4;" disabled><i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm viz-tip" id="viz-snap-btn" onclick="vizToggleSnap()" data-tip="Snap to grid: off" title="Snap to grid" aria-pressed="false"><i data-lucide="grid" style="width:14px;height:14px;"></i></button>
          <button class="viz-swap-btn viz-tip" onclick="vizSwapPanes()" data-tip="Swap panes" title="Swap panes"><i data-lucide="arrow-left-right"></i></button>
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
                <button class="tutorial-trigger-btn hidden" id="brain-new-btn" onclick="brainCreateVersion(null)" title="New version">
                  <i data-lucide="plus"></i>
                </button>
                <button class="tutorial-trigger-btn" id="viz-toggle-items-btn" onclick="vizToggleTreeItems()" title="Toggle item visibility">
                  <i data-lucide="${localStorage.getItem('vizHideItems') === 'true' ? 'eye-off' : 'eye'}" id="viz-toggle-items-icon"></i>
                </button>
                <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour">
                  <i data-lucide="graduation-cap"></i>
                </button>
              </div>
            </div>
            <div id="viz-content-breadcrumb" class="viz-content-breadcrumb"><span class="viz-breadcrumb-item" style="cursor:default;color:var(--text-primary)">Root</span></div>
            <div class="search-container search-animated" style="width: 100%;">
              <i data-lucide="search"></i>
              <input type="text" id="viz-search-input" class="search-input" placeholder="Search nodes..." oninput="vizPaneSearch(this.value)" />
              <button class="viz-search-clear hidden" id="viz-search-clear" onclick="vizClearSearch()"><i data-lucide="x"></i></button>
            </div>
            <div class="browse-mini-stats" id="viz-mini-stats"></div>
          </div>
          <div class="viz-content-body" id="viz-content-body"></div>
        </div>
        <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
        <div class="viz-canvas-pane">
          <div class="viz-canvas-toolbar-wrap" id="viz-canvas-toolbar-wrap">
          <div class="viz-canvas-toolbar" id="viz-canvas-toolbar">
            <div class="viz-canvas-toolbar-left">
              <i data-lucide="move" style="width:13px;height:13px;color:var(--color-primary);"></i>
              <span id="viz-canvas-toolbar-label">Canvas</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span class="brain-saved-chip" id="brain-saved-chip" aria-live="polite"></span>
              <!-- Brain-only canvas options. The grid was drawn but nothing
                   snapped to it, the minimap could not be dismissed, and a map
                   you only wanted to read was one drag from being rearranged. -->
              <span class="brain-only-tools" id="brain-only-tools">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-snap-btn" onclick="brainToggleOpt('snap')" title="Snap to grid">
                  <i data-lucide="grid-3x3" style="width:12px;height:12px;"></i>
                </button>
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-links-btn" onclick="brainToggleOpt('links')" title="Show connections">
                  <i data-lucide="waypoints" style="width:12px;height:12px;"></i>
                </button>
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-minimap-btn" onclick="brainToggleOpt('minimap')" title="Show minimap">
                  <i data-lucide="map" style="width:12px;height:12px;"></i>
                </button>
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-lock-btn" onclick="brainToggleLock()" title="Lock this version (read-only)">
                  <i data-lucide="lock" style="width:12px;height:12px;"></i>
                </button>
                <div class="viz-toolbar-dropdown">
                  <button class="viz-zoom-btn viz-toolbar-pill-btn" id="brain-layout-btn" onclick="brainToggleLayoutMenu()" title="Arrange nodes">
                    <i data-lucide="layout-dashboard" style="width:12px;height:12px;"></i>
                    <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                  </button>
                  <div id="brain-layout-popup" class="viz-toolbar-popup hidden">
                    <div class="viz-link-type-option" onclick="brainToggleLayoutMenu();brainAutoLayout('tree')"><i data-lucide="git-branch" style="width:14px;height:14px;"></i> Tree</div>
                    <div class="viz-link-type-option" onclick="brainToggleLayoutMenu();brainAutoLayout('grid')"><i data-lucide="grid-3x3" style="width:14px;height:14px;"></i> Grid</div>
                    <div class="viz-link-type-option" onclick="brainToggleLayoutMenu();brainAutoLayout('radial')"><i data-lucide="circle-dot" style="width:14px;height:14px;"></i> Radial</div>
                  </div>
                </div>
              </span>
              <!-- How much of the tree the canvas draws. Auto-populate places a
                   node for every folder AND every item; "Folders only" turns a
                   dump into a readable map of the structure. -->
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-depth-btn" onclick="vizToggleDepthMenu()" title="Canvas shows: Folders + items">
                  <i data-lucide="list-tree" style="width:12px;height:12px;"></i>
                  <span class="viz-pill-chevron"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                </button>
                <div id="viz-depth-popup" class="viz-toolbar-popup hidden">
                  <div class="viz-link-type-option active" data-depth="all" onclick="vizSetDepth('all')"><i data-lucide="list-tree" style="width:14px;height:14px;"></i> Folders + items</div>
                  <div class="viz-link-type-option" data-depth="folders" onclick="vizSetDepth('folders')"><i data-lucide="folder-tree" style="width:14px;height:14px;"></i> Folders only</div>
                  <div class="viz-link-type-option" data-depth="items" onclick="vizSetDepth('items')"><i data-lucide="file" style="width:14px;height:14px;"></i> Items only</div>
                </div>
              </div>
              <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-fog-toggle-btn" onclick="vizToggleFog()" title="Fog of War">
                <i data-lucide="eye-off" style="width:12px;height:12px;"></i>
              </button>
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-link-toggle-btn" onclick="vizToggleLinkMode()" title="Link mode (L)">
                  <i data-lucide="link" style="width:12px;height:12px;"></i>
                  <span class="viz-pill-chevron" onclick="event.stopPropagation();vizToggleLinkTypeDropdown()"><i data-lucide="chevron-down" style="width:10px;height:10px;"></i></span>
                </button>
                <div id="viz-link-type-popup" class="viz-toolbar-popup hidden">
                  <div class="viz-link-type-option active" data-type="arrow" onclick="vizSetLinkArrowType('arrow')"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i> Arrow</div>
                  <div class="viz-link-type-option" data-type="double-arrow" onclick="vizSetLinkArrowType('double-arrow')"><i data-lucide="arrow-left-right" style="width:14px;height:14px;"></i> Double</div>
                  <div class="viz-link-type-option" data-type="none" onclick="vizSetLinkArrowType('none')"><i data-lucide="minus" style="width:14px;height:14px;"></i> None</div>
                </div>
              </div>
              <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-flow-toggle-btn" onclick="vizToggleFlowyDrag()" title="Flow drag">
                <i data-lucide="wind" style="width:12px;height:12px;"></i>
              </button>
              <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-globe-toggle-btn" onclick="vizToggleGlobeMode()" title="Globe mode">
                <i data-lucide="circle-dot" style="width:12px;height:12px;"></i>
              </button>
              <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-force-toggle-btn" onclick="vizToggleForceLayout()" title="Force layout (P) — physics simulation like Obsidian's graph">
                <i data-lucide="atom" style="width:12px;height:12px;"></i>
              </button>
              <div class="viz-toolbar-dropdown">
                <button class="viz-zoom-btn viz-toolbar-pill-btn" id="viz-color-toggle-btn" onclick="vizToggleColorMode()" title="Paint colors">
                  <i data-lucide="palette" style="width:12px;height:12px;"></i>
                </button>
                <div id="viz-color-mode-popup" class="viz-toolbar-popup hidden" style="min-width:140px;">
                  <div style="font-size:0.6875rem;font-weight:700;color:var(--text-tertiary);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.06em;">Paint Color</div>
                  <div class="viz-color-picker" style="flex-wrap:wrap;gap:0.3rem;padding:0;">
                    <div class="viz-color-swatch" data-color="red" style="background:#ef4444;" onclick="vizSetPaintColor('red')"></div>
                    <div class="viz-color-swatch" data-color="orange" style="background:#f97316;" onclick="vizSetPaintColor('orange')"></div>
                    <div class="viz-color-swatch" data-color="yellow" style="background:#eab308;" onclick="vizSetPaintColor('yellow')"></div>
                    <div class="viz-color-swatch" data-color="green" style="background:#22c55e;" onclick="vizSetPaintColor('green')"></div>
                    <div class="viz-color-swatch active" data-color="blue" style="background:#3b82f6;" onclick="vizSetPaintColor('blue')"></div>
                    <div class="viz-color-swatch" data-color="purple" style="background:#a855f7;" onclick="vizSetPaintColor('purple')"></div>
                    <div class="viz-color-swatch" data-color="pink" style="background:#ec4899;" onclick="vizSetPaintColor('pink')"></div>
                    <div class="viz-color-swatch" data-color="cyan" style="background:#06b6d4;" onclick="vizSetPaintColor('cyan')"></div>
                    <div class="viz-color-swatch" data-color="" style="background:var(--border-color);" onclick="vizSetPaintColor(null)" title="Clear"></div>
                  </div>
                </div>
              </div>
              <div class="viz-toolbar-sep"></div>
              <div class="viz-zoom-controls">
                <button class="viz-zoom-btn" onclick="vizZoomOut()" title="Zoom out (-)"><i data-lucide="minus"></i></button>
                <span class="viz-zoom-level" id="viz-zoom-level">100%</span>
                <button class="viz-zoom-btn" onclick="vizZoomIn()" title="Zoom in (+)"><i data-lucide="plus"></i></button>
                <button class="viz-zoom-btn" onclick="vizZoomReset()" title="Fit (F)"><i data-lucide="maximize-2"></i></button>
              </div>
              <div class="viz-toolbar-sep"></div>
              <button class="viz-zoom-btn" id="viz-toolbar-collapse-btn" onclick="vizToggleCanvasToolbar()" title="Hide toolbar">
                <i data-lucide="chevron-up" id="viz-toolbar-chevron"></i>
              </button>
            </div>
          </div>
          </div>
          <div class="viz-canvas-container" id="viz-canvas-container">
            <svg class="viz-canvas-svg" id="viz-canvas-svg"><defs>
              <marker id="viz-arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--text-tertiary)" opacity="0.6"/>
              </marker>
              <marker id="viz-arrowhead-back" markerWidth="8" markerHeight="6" refX="2" refY="3" orient="auto">
                <polygon points="8 0, 0 3, 8 6" fill="var(--text-tertiary)" opacity="0.6"/>
              </marker>
              <marker id="viz-arrowhead-locked" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" opacity="0.8"/>
              </marker>
              <marker id="viz-arrowhead-locked-back" markerWidth="8" markerHeight="6" refX="2" refY="3" orient="auto">
                <polygon points="8 0, 0 3, 8 6" fill="#f59e0b" opacity="0.8"/>
              </marker>
              <marker id="viz-arrowhead-custom" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" opacity="0.6"/>
              </marker>
              <marker id="viz-arrowhead-custom-back" markerWidth="8" markerHeight="6" refX="2" refY="3" orient="auto">
                <polygon points="8 0, 0 3, 8 6" fill="#f59e0b" opacity="0.6"/>
              </marker>
            </defs></svg>
            <div class="viz-nodes-layer" id="viz-nodes-layer"></div>
            <div class="viz-canvas-empty" id="viz-canvas-empty">
              <i data-lucide="git-branch"></i>
              <h3>Your Mindmap Canvas</h3>
              <p>Drag items from the left, right-click to create nodes, or double-click to add a node.</p>
              <button class="btn btn-primary btn-sm" onclick="vizAutoPopulateForce()" style="margin-top:0.5rem; pointer-events:auto;"><i data-lucide="zap" style="width:14px;height:14px;fill:currentColor;"></i> Auto-populate</button>
            </div>
            <!-- Minimap -->
            <div class="viz-minimap" id="viz-minimap" title="Click to navigate">
              <canvas id="viz-minimap-canvas" width="180" height="110"></canvas>
              <div class="viz-minimap-viewport" id="viz-minimap-viewport"></div>
            </div>
            <!-- Obsidian's four graph forces. Without these the simulation has
                 exactly one look and no way to adapt to a dense or sparse graph. -->
            <div class="viz-force-panel hidden" id="viz-force-panel"></div>
            <!-- Which library a node belongs to, for the General canvas where
                 all three are on screen at once. -->
            <div class="viz-scope-legend hidden" id="viz-scope-legend" aria-hidden="true">
              <span class="viz-legend-item" data-scope="challenge"><i></i> Programs</span>
              <span class="viz-legend-item" data-scope="snippet"><i></i> Snippets</span>
              <span class="viz-legend-item" data-scope="notebook"><i></i> Notebooks</span>
            </div>
            <!-- Keyboard shortcuts hint -->
            <div class="viz-shortcuts-hint" aria-hidden="true">
              <kbd>F</kbd> Fit &nbsp;<span class="viz-shortcuts-sep">|</span>&nbsp;
              <kbd>L</kbd> Link &nbsp;<span class="viz-shortcuts-sep">|</span>&nbsp;
              <kbd>Del</kbd> Delete &nbsp;<span class="viz-shortcuts-sep">|</span>&nbsp;
              <kbd>+</kbd><kbd>-</kbd> Zoom &nbsp;<span class="viz-shortcuts-sep">|</span>&nbsp;
              <kbd>Ctrl</kbd><kbd>Z</kbd> Undo
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Interactive Node Popup -->
    <div id="viz-node-details-popup" class="viz-context-menu hidden" style="width:300px; padding:0; overflow:hidden; z-index:1000;">
      <div class="viz-popup-header">
        <div style="flex:1; min-width:0;">
          <div id="viz-popup-title" style="font-weight:700; font-size:0.9375rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
          <div id="viz-popup-type-badge" style="font-size:0.6875rem; color:var(--text-tertiary); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-top:0.15rem;"></div>
        </div>
        <div style="display:flex; gap:0.25rem; flex-shrink:0;" id="viz-popup-actions"></div>
      </div>
      <div id="viz-popup-stats" class="viz-popup-stats"></div>
      <div style="padding:0.75rem; border-top:1px solid var(--border-color);">
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.25rem;"><i data-lucide="lock" style="width:12px;height:12px;"></i> Prerequisites:</div>
        <div id="viz-popup-locks-list" style="max-height:160px; overflow-y:auto; display:flex; flex-direction:column; gap:0.25rem; padding-right:0.25rem;"></div>
      </div>
    </div>

    <!-- Admin Form Overlay Modal -->
    <div id="viz-admin-modal" class="modal-overlay hidden" style="z-index:9999; backdrop-filter:blur(4px); background-color:rgba(0,0,0,0.5);">
      <div class="modal-content" style="max-width:900px; width:95%; max-height:90vh; overflow-y:auto; background:var(--bg-elevated); padding:0; position:relative; display:flex; flex-direction:column; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-color);">
          <h2 id="viz-modal-form-title" style="font-weight:800; font-size:1.25rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="edit-3" style="color:var(--color-primary);"></i> Edit Program</h2>
          <button onclick="vizCloseAdminModal()" class="btn btn-ghost" style="padding:0.25rem;"><i data-lucide="x" style="width:24px;height:24px;"></i></button>
        </div>
        <div id="viz-admin-modal-body" style="flex:1; overflow-y:auto; padding:1.5rem;"></div>
      </div>
    </div>

    <!-- Canvas Context Menu -->
    <div id="viz-canvas-ctx" class="viz-context-menu hidden">
      <button class="viz-ctx-item" onclick="vizCtxAddNode()"><i data-lucide="plus-circle"></i> <span>Add Node</span></button>
      <button class="viz-ctx-item" onclick="vizCtxAddFolder()"><i data-lucide="folder-plus"></i> <span>Add Category</span></button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="vizCtxAddComment()"><i data-lucide="message-circle"></i> Add Comment</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="vizAutoLayout()"><i data-lucide="layout"></i> Auto Layout</button>
    </div>

    <!-- Node Context Menu -->
    <div id="viz-node-ctx" class="viz-context-menu hidden">
      <div class="viz-color-picker">
        <div class="viz-color-swatch" data-color="red" style="background:#ef4444;" onclick="vizCtxEditColor('red')"></div>
        <div class="viz-color-swatch" data-color="orange" style="background:#f97316;" onclick="vizCtxEditColor('orange')"></div>
        <div class="viz-color-swatch" data-color="yellow" style="background:#eab308;" onclick="vizCtxEditColor('yellow')"></div>
        <div class="viz-color-swatch" data-color="green" style="background:#22c55e;" onclick="vizCtxEditColor('green')"></div>
        <div class="viz-color-swatch" data-color="blue" style="background:#3b82f6;" onclick="vizCtxEditColor('blue')"></div>
        <div class="viz-color-swatch" data-color="purple" style="background:#a855f7;" onclick="vizCtxEditColor('purple')"></div>
        <div class="viz-color-swatch" data-color="pink" style="background:#ec4899;" onclick="vizCtxEditColor('pink')"></div>
        <div class="viz-color-swatch" data-color="cyan" style="background:#06b6d4;" onclick="vizCtxEditColor('cyan')"></div>
        <div class="viz-color-swatch" data-color="" style="background:var(--border-color);" onclick="vizCtxEditColor(null)" title="Default"></div>
      </div>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" id="viz-ctx-change-icon-btn" onclick="vizCtxChangeIcon()"><i data-lucide="image"></i> Change Icon</button>
      <button class="viz-ctx-item" onclick="vizCtxRenameNode()"><i data-lucide="pencil"></i> Rename</button>
      <button class="viz-ctx-item" onclick="vizCtxAddChild()"><i data-lucide="git-branch"></i> Add Child Node</button>
      <button class="viz-ctx-item" onclick="vizCtxAddChildFolder()"><i data-lucide="folder-plus"></i> Add Category</button>
      <button class="viz-ctx-item" onclick="vizCtxAddLink()"><i data-lucide="link"></i> Add Link</button>
      <button class="viz-ctx-item" id="viz-ctx-edit-comment-btn" style="display:none;" onclick="vizCtxEditComment()"><i data-lucide="edit-2"></i> Edit Comment</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" id="viz-ctx-collapse-btn" style="display:none;" onclick="vizCtxCollapseChildren()"><i data-lucide="chevrons-up"></i> Collapse Children</button>
      <button class="viz-ctx-item" id="viz-ctx-expand-btn" style="display:none;" onclick="vizCtxExpandChildren()"><i data-lucide="chevrons-down"></i> Expand Children</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item danger" onclick="vizCtxDeleteNode()"><i data-lucide="trash-2"></i> Delete Node</button>
    </div>

    <!-- Link Context Menu -->
    <div id="viz-link-ctx" class="viz-link-menu hidden">
      <div class="viz-color-picker" id="viz-link-color-picker">
        <div class="viz-color-swatch" data-color="red" style="background:#ef4444;" onclick="vizCtxEditLinkColor('red')"></div>
        <div class="viz-color-swatch" data-color="orange" style="background:#f97316;" onclick="vizCtxEditLinkColor('orange')"></div>
        <div class="viz-color-swatch" data-color="yellow" style="background:#eab308;" onclick="vizCtxEditLinkColor('yellow')"></div>
        <div class="viz-color-swatch" data-color="green" style="background:#22c55e;" onclick="vizCtxEditLinkColor('green')"></div>
        <div class="viz-color-swatch" data-color="blue" style="background:#3b82f6;" onclick="vizCtxEditLinkColor('blue')"></div>
        <div class="viz-color-swatch" data-color="purple" style="background:#a855f7;" onclick="vizCtxEditLinkColor('purple')"></div>
        <div class="viz-color-swatch" data-color="pink" style="background:#ec4899;" onclick="vizCtxEditLinkColor('pink')"></div>
        <div class="viz-color-swatch" data-color="cyan" style="background:#06b6d4;" onclick="vizCtxEditLinkColor('cyan')"></div>
        <div class="viz-color-swatch" data-color="" style="background:var(--border-color);" onclick="vizCtxEditLinkColor(null)" title="Default"></div>
      </div>
      <div class="viz-ctx-divider"></div>
      <div style="display:flex;gap:0.25rem;padding:0.25rem 0.5rem;">
        <button class="viz-ctx-item" style="flex:1;justify-content:center;padding:0.375rem;" title="Arrow" onclick="vizCtxSetLinkArrow('arrow')"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></button>
        <button class="viz-ctx-item" style="flex:1;justify-content:center;padding:0.375rem;" title="Double Arrow" onclick="vizCtxSetLinkArrow('double-arrow')"><i data-lucide="arrow-left-right" style="width:14px;height:14px;"></i></button>
        <button class="viz-ctx-item" style="flex:1;justify-content:center;padding:0.375rem;" title="No Arrow" onclick="vizCtxSetLinkArrow('none')"><i data-lucide="minus" style="width:14px;height:14px;"></i></button>
      </div>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" data-action="toggle-lock" onclick="vizCtxToggleLock()"><i data-lucide="lock"></i> Lock</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item danger" onclick="vizCtxDeleteLink()"><i data-lucide="trash-2"></i> Delete Link</button>
    </div>

    <!-- Brain Canvas Context Menu -->
    <div id="brain-canvas-ctx" class="viz-context-menu hidden">
      <button class="viz-ctx-item" onclick="brainCtxAddComment()"><i data-lucide="message-circle"></i> Add Comment</button>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item" onclick="brainAutoLayout()"><i data-lucide="layout"></i> Auto Layout</button>
      <button class="viz-ctx-item" onclick="brainCenterCanvas()"><i data-lucide="maximize-2"></i> Center View</button>
    </div>

    <!-- Brain Node Context Menu -->
    <div id="brain-node-ctx" class="viz-context-menu hidden">
      <div class="viz-color-picker">
        <div class="viz-color-swatch" data-color="red" style="background:#ef4444;" onclick="brainCtxEditColor('red')"></div>
        <div class="viz-color-swatch" data-color="orange" style="background:#f97316;" onclick="brainCtxEditColor('orange')"></div>
        <div class="viz-color-swatch" data-color="yellow" style="background:#eab308;" onclick="brainCtxEditColor('yellow')"></div>
        <div class="viz-color-swatch" data-color="green" style="background:#22c55e;" onclick="brainCtxEditColor('green')"></div>
        <div class="viz-color-swatch" data-color="blue" style="background:#3b82f6;" onclick="brainCtxEditColor('blue')"></div>
        <div class="viz-color-swatch" data-color="purple" style="background:#a855f7;" onclick="brainCtxEditColor('purple')"></div>
        <div class="viz-color-swatch" data-color="pink" style="background:#ec4899;" onclick="brainCtxEditColor('pink')"></div>
        <div class="viz-color-swatch" data-color="cyan" style="background:#06b6d4;" onclick="brainCtxEditColor('cyan')"></div>
        <div class="viz-color-swatch" data-color="" style="background:var(--border-color);" onclick="brainCtxEditColor(null)" title="Default"></div>
      </div>
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
    <div id="brain-link-ctx" class="viz-link-menu hidden">
      <div class="viz-color-picker">
        <div class="viz-color-swatch" data-color="red" style="background:#ef4444;" onclick="brainCtxEditLinkColor('red')"></div>
        <div class="viz-color-swatch" data-color="orange" style="background:#f97316;" onclick="brainCtxEditLinkColor('orange')"></div>
        <div class="viz-color-swatch" data-color="yellow" style="background:#eab308;" onclick="brainCtxEditLinkColor('yellow')"></div>
        <div class="viz-color-swatch" data-color="green" style="background:#22c55e;" onclick="brainCtxEditLinkColor('green')"></div>
        <div class="viz-color-swatch" data-color="blue" style="background:#3b82f6;" onclick="brainCtxEditLinkColor('blue')"></div>
        <div class="viz-color-swatch" data-color="purple" style="background:#a855f7;" onclick="brainCtxEditLinkColor('purple')"></div>
        <div class="viz-color-swatch" data-color="pink" style="background:#ec4899;" onclick="brainCtxEditLinkColor('pink')"></div>
        <div class="viz-color-swatch" data-color="cyan" style="background:#06b6d4;" onclick="brainCtxEditLinkColor('cyan')"></div>
        <div class="viz-color-swatch" data-color="" style="background:var(--border-color);" onclick="brainCtxEditLinkColor(null)" title="Default"></div>
      </div>
      <div class="viz-ctx-divider"></div>
      <button class="viz-ctx-item danger" onclick="brainCtxDeleteLink()"><i data-lucide="trash-2"></i> Delete Link</button>
    </div>

    <!-- Brain Version Context Menu -->
    <div id="brain-version-ctx" class="viz-context-menu hidden">
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

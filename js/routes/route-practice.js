/* Route: practice */

/** Shortcut cheatsheet — collapsed by default so it stops eating the sidebar. */
function practiceShortcutsTemplate(isSet) {
  // The editor bindings work on both pages — the set sheet used to omit them.
  const rows = isSet
    ? [['Ctrl', '↵', 'Check code'], ['Ctrl', '⇧ ↵', 'Finish attempt'],
       ['Alt', '← →', 'Switch problem'], ['Ctrl', 'B', 'Boss bar'],
       ['Ctrl', 'F', 'Find'], ['Ctrl', '/', 'Comment'],
       ['Ctrl', 'D', 'Duplicate line'], ['Alt', '↑ ↓', 'Move line'],
       ['Ctrl', '\\', 'Zen mode']]
    : [['Ctrl', '↵', 'Check code'], ['Ctrl', '⇧ ↵', 'Finish attempt'],
       ['Ctrl', '⇧ R', 'Retry'], ['Ctrl', 'B', 'Boss bar'],
       ['Ctrl', 'F', 'Find'], ['Ctrl', '/', 'Comment'],
       ['Ctrl', 'D', 'Duplicate line'], ['Alt', '↑ ↓', 'Move line'],
       ['Ctrl', '\\', 'Zen mode'], ['Esc', '', 'Back']];
  // The autosave chip sits beside the toggle and yields to the expanded sheet
  // (see .practice-shortcuts[open] ~ .ed-save-state in editor.css).
  return `
    <div class="practice-footer-row">
      <details class="practice-shortcuts">
        <summary><i data-lucide="keyboard" style="width:13px;height:13px;"></i> Keyboard shortcuts</summary>
        <div class="practice-kbd-grid">
          ${rows.map(([a, b, label]) => `
            <span class="practice-kbd-row">
              <span class="practice-kbd-keys"><kbd>${a}</kbd>${b ? `<kbd>${b}</kbd>` : ''}</span>
              <em>${label}</em>
            </span>`).join('')}
        </div>
      </details>
      <span class="ed-save-state" id="ed-save-state" title="Your code is saved locally as you work"></span>
    </div>`;
}

/** Read-only mirror of the last Run Code transcript, under the editor. */
function runOutputStripTemplate() {
  const collapsed = localStorage.getItem('practiceOutputCollapsed') === '1';
  return `
    <div class="editor-output${collapsed ? ' collapsed' : ''}" id="editor-output">
      <div class="editor-output-head">
        <i data-lucide="terminal" style="width:12px;height:12px;"></i>
        <span class="editor-output-title">Last run</span>
        <span class="editor-output-status" id="editor-output-status"></span>
        <button class="ed-tool" onclick="clearRunOutput()" title="Clear"><i data-lucide="eraser"></i></button>
        <button class="ed-tool" id="editor-output-toggle" onclick="toggleRunOutput()" title="Collapse / expand">
          <i data-lucide="${collapsed ? 'chevron-up' : 'chevron-down'}"></i>
        </button>
      </div>
      <div class="editor-output-body" id="editor-output-body"></div>
    </div>`;
}

function practiceTemplate() {
  return `
    <div class="practice-layout">
      <div class="practice-topbar">
        <div class="practice-topbar-left">
          <button onclick="practiceConfirmExit()" class="btn-back-dark" id="practice-back-btn">
            <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back
          </button>
        </div>
        <div class="practice-topbar-center">
          ${bossCrystalTemplate()}
          ${bossBarTemplate()}
        </div>
        <div class="practice-topbar-right">
          <button class="btn btn-ghost practice-icon-btn" onclick="toggleBossHealthBar()" title="Toggle Boss Health Bar" id="boss-bar-toggle-btn" aria-label="Toggle Boss Health Bar">
            <i data-lucide="swords" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <button class="btn btn-ghost practice-icon-btn" onclick="openCheatsheet()" title="Cheat sheet" id="cheatsheet-toggle-btn" aria-label="Cheat sheet" style="display:none;">
            <i data-lucide="book-open" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          ${typingSfxButtonTemplate()}
          ${editorFxButtonTemplate()}
          <button class="btn btn-ghost practice-icon-btn" onclick="toggleFullscreen()" title="Full screen" id="fullscreen-toggle-btn" aria-label="Full screen" aria-pressed="false">
            <i data-lucide="maximize" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <div class="timer-display" oncontextmenu="openTimerMenu(event)" title="Right-click to change the timer">
            <i data-lucide="clock"></i><span id="practice-timer">00:00</span>
            <button class="btn-pause-timer" id="pause-timer-btn" onclick="togglePauseTimer()" title="Pause/Resume Timer">
              <i data-lucide="pause" id="pause-timer-icon" style="width:14px;height:14px;"></i>
            </button>
          </div>
          <button class="btn btn-secondary practice-action-btn" onclick="retryPractice()"><i data-lucide="rotate-ccw"></i> Retry</button>
          <button class="btn btn-secondary practice-action-btn pp-check-btn" id="pp-check-btn" onclick="ppRunAllChecks()"
                  title="Run the minimum requirements + test cases — does NOT submit">
            <i data-lucide="check-circle"></i> Check Code
          </button>
        </div>
      </div>
      <div class="practice-body">
        <div class="practice-sidebar">
          <header class="practice-prog-head">
            <h1 class="practice-program-title" id="practice-program-title"></h1>
            <span class="practice-program-version" id="practice-program-version"></span>
          </header>
          <div>
            <div class="practice-desc-head">
              <h2>Description</h2>
              <button class="practice-desc-edit" onclick="practiceEditDescription()"
                      title="Edit this description" aria-label="Edit this description">
                <i data-lucide="pencil"></i>
              </button>
            </div>
            <!-- A div, not a p: a description can hold lists and code blocks now,
                 and neither is legal inside a paragraph. -->
            <div id="practice-desc" class="practice-desc-body"></div>
          </div>
          <div id="practice-samples-container" style="display:flex; flex-direction:column; gap:1rem;"></div>
          <div id="practice-hints-container"></div>
          <div class="practice-footer">
            ${practiceShortcutsTemplate()}
          </div>
        </div>
        ${paneDividerTemplate('left')}
        <div class="practice-editor-area" style="display:flex; flex-direction:column;">
          <div class="editor-toolbar-row">
            <div class="file-tab-bar" id="practice-file-tabs"></div>
            ${editorToolbarTemplate()}
          </div>
          <div style="flex:1; position:relative; min-height:0; display:flex;">
            <div class="editor-line-numbers" id="editor-line-numbers"></div>
            <div style="flex:1; position:relative; min-height:0;">
              <pre id="editor-pre" class="editor-pre"><code id="editor-code"></code></pre>
              <textarea id="editor-textarea" spellcheck="false" class="editor-textarea" placeholder="// Start typing your code here..."></textarea>
            </div>
          </div>
          ${runOutputStripTemplate()}
        </div>
        ${paneDividerTemplate('right')}
        <aside class="practice-panel" id="practice-panel"></aside>
      </div>
    </div>
  `;
}
function practiceInit() {
  // No auto-tour here: practice is a focused (often timed) coding view, so the
  // spotlight tour highlighting the editor was intrusive (the "blue highlight").
  // Also clear any tour left over from a previous page so it can't linger.
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
  initPractice();
}
function practiceDestroy() {
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
  if (typeof _stopSavedTicker === 'function') _stopSavedTicker();
  if (typeof edCloseFind === 'function') edCloseFind();
  if (typeof closeCheatsheet === 'function') closeCheatsheet();   // it lives on <body>, not in the route
  if (typeof _timerMenuClose === 'function') _timerMenuClose();   // ditto
  if (typeof ppClearFx === 'function') ppClearFx();               // and the confetti layer
  // Flush the autosave before tearing down: Back/Esc/sidebar all leave the page
  // between the 30 s ticks, which used to drop up to half a minute of typing.
  // Skipped after a submit — that attempt is graded and its autosave cleared.
  if (typeof _practiceSubmitted !== 'undefined' && !_practiceSubmitted &&
      typeof _practiceAutoSave === 'function' && state.sessionData) {
    try { _practiceAutoSave(); } catch (e) { console.error('[Practice] Autosave on exit failed:', e); }
  }
  if (window.activeTimerInterval) {
    clearInterval(window.activeTimerInterval);
    window.activeTimerInterval = null;
  }
  if (typeof _autoSaveInterval !== 'undefined' && _autoSaveInterval) {
    clearInterval(_autoSaveInterval);
    _autoSaveInterval = null;
  }
  if (typeof _starterAnimator !== 'undefined' && _starterAnimator) {
    _starterAnimator.abort();
  }
  if (window._practiceShortcutHandler) {
    document.removeEventListener('keydown', window._practiceShortcutHandler);
    window._practiceShortcutHandler = null;
  }
  if (typeof _termClose === 'function') {
    _termClose();
  }
}
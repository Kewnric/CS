/* Route: practice-set — CodeChum-style multi-problem session */
function practiceSetTemplate() {
  return `
    <div class="practice-layout">
      <div class="practice-topbar">
        <div class="practice-topbar-left">
          <button onclick="psetExit()" class="btn-back-dark" id="pset-back-btn">
            <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back
          </button>
        </div>
        <div class="practice-topbar-center">
          ${bossCrystalTemplate()}
          ${bossBarTemplate()}
        </div>
        <div class="practice-topbar-right">
          <button class="btn btn-ghost practice-icon-btn" onclick="psetToggleBoss()" title="Toggle Boss Health Bar" id="boss-bar-toggle-btn" aria-label="Toggle Boss Health Bar">
            <i data-lucide="swords" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <button class="btn btn-ghost practice-icon-btn" onclick="openCheatsheet()" title="Cheat sheet" id="cheatsheet-toggle-btn" aria-label="Cheat sheet" style="display:none;">
            <i data-lucide="book-open" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          ${typingSfxButtonTemplate()}
          ${editorFxButtonTemplate()}
          ${ambientButtonTemplate()}
          ${ostButtonTemplate()}
          <button class="btn btn-ghost practice-icon-btn" onclick="toggleFullscreen()" title="Full screen" id="fullscreen-toggle-btn" aria-label="Full screen" aria-pressed="false">
            <i data-lucide="maximize" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <div class="timer-display" oncontextmenu="openTimerMenu(event)" title="Right-click to change the timer">
            <i data-lucide="clock"></i><span id="pset-timer">00:00</span>
            <button class="btn-pause-timer" id="pset-pause-btn" onclick="psetTogglePause()" title="Pause/Resume Timer">
              <i data-lucide="pause" id="pset-pause-icon" style="width:14px;height:14px;"></i>
            </button>
          </div>
          <button class="btn btn-secondary practice-action-btn pp-check-btn" id="pp-check-btn" onclick="ppRunAllChecks()"
                  title="Run the minimum requirements + test cases — does NOT submit">
            <i data-lucide="check-circle"></i> Check Code
          </button>
        </div>
      </div>

      <div class="practice-body">
        <div class="practice-sidebar">
          <header class="practice-prog-head">
            <h1 class="practice-program-title" id="pset-problem-title">Problem</h1>
            <span class="practice-program-version" id="pset-set-name"></span>
          </header>
          <div>
            <div class="practice-desc-head">
              <h2>Description</h2>
              <button class="practice-desc-edit" onclick="psetEditDescription()"
                      title="Edit this description" aria-label="Edit this description">
                <i data-lucide="pencil"></i>
              </button>
            </div>
            <!-- A div, not a p, for the same reason as the program screen: a
                 description can hold lists and code blocks and neither is legal
                 inside a paragraph. -->
            <div id="pset-desc" class="practice-desc-body"></div>
          </div>
          <div id="pset-samples" style="display:flex; flex-direction:column; gap:1rem;"></div>
          <div id="pset-hints-container"></div>
          <div class="practice-footer">
            ${practiceShortcutsTemplate(true)}
          </div>
        </div>
        ${paneDividerTemplate('left')}
        <div class="practice-editor-area" style="display:flex; flex-direction:column;">
          <div class="editor-toolbar-row">
            <div class="file-tab-bar" id="pset-file-label"></div>
            ${editorToolbarTemplate()}
          </div>
          <div style="flex:1; position:relative; min-height:0; display:flex;">
            <div class="editor-line-numbers" id="editor-line-numbers"></div>
            <div style="flex:1; position:relative; min-height:0;">
              <pre id="editor-pre" class="editor-pre"><code id="editor-code"></code></pre>
              <textarea id="editor-textarea" spellcheck="false" class="editor-textarea" placeholder="// Write your solution here..."></textarea>
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

function practiceSetInit() {
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
  psetInit();
}

function practiceSetDestroy() {
  psetDestroy();
  // All of these live on <body> or on a timer, not inside the route, so the
  // route being replaced does not take them with it. The program screen has
  // torn these down for a while; this one only did the confetti.
  if (typeof ppClearFx === 'function') ppClearFx();
  if (typeof _timerMenuClose === 'function') _timerMenuClose();
  if (typeof psfxWorkStop === 'function') psfxWorkStop();
  if (typeof practiceCloseDescription === 'function') practiceCloseDescription();
}

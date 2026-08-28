/* ============================================================
   ROUTE-SNIPPET-ATTEMPT.JS — the SQL practice screen
   ------------------------------------------------------------
   Deliberately the practice-set template with one region changed. The topbar,
   the boss bar, the timer, the sidebar, both pane dividers and the panel are
   the same elements in the same order with the same ids, so every control
   behaves exactly as it does in a coding attempt.

   The one difference is inside .practice-editor-area: instead of a single
   editor over the whole problem, a stack of one box per test case.
   ============================================================ */

function snippetAttemptTemplate() {
  return `
    <div class="practice-layout">
      <div class="practice-topbar">
        <div class="practice-topbar-left">
          <button onclick="sqaExit()" class="btn-back-dark" id="sqa-back-btn">
            <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back
          </button>
        </div>
        <div class="practice-topbar-center">
          ${bossCrystalTemplate()}
          ${bossBarTemplate()}
        </div>
        <div class="practice-topbar-right">
          <button class="btn btn-ghost practice-icon-btn" onclick="sqaToggleBoss()" title="Toggle Boss Health Bar" id="boss-bar-toggle-btn" aria-label="Toggle Boss Health Bar">
            <i data-lucide="swords" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <button class="btn btn-ghost practice-icon-btn" onclick="toggleFullscreen()" title="Full screen" id="fullscreen-toggle-btn" aria-label="Full screen" aria-pressed="false">
            <i data-lucide="maximize" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <div class="timer-display">
            <i data-lucide="clock"></i><span id="sqa-timer">00:00</span>
            <button class="btn-pause-timer" id="sqa-pause-btn" onclick="sqaTogglePause()" title="Pause/Resume Timer">
              <i data-lucide="pause" id="sqa-pause-icon" style="width:14px;height:14px;"></i>
            </button>
          </div>
          <button class="btn btn-secondary practice-action-btn pp-check-btn" id="pp-check-btn" onclick="ppRunAllChecks()"
                  title="Compare every answer against the reference — does NOT submit">
            <i data-lucide="check-circle"></i> Check Code
          </button>
        </div>
      </div>

      <div class="practice-body">
        <div class="practice-sidebar">
          <header class="practice-prog-head">
            <h1 class="practice-program-title" id="sqa-title">SQL Practice</h1>
            <span class="practice-program-version" id="sqa-subtitle"></span>
          </header>
          <div><h2>Description</h2><div id="sqa-desc" class="practice-desc-body"></div></div>
          <div class="practice-footer">
            ${practiceShortcutsTemplate(true)}
          </div>
        </div>
        ${paneDividerTemplate('left')}

        <div class="practice-editor-area" style="display:flex; flex-direction:column;">
          <div class="editor-toolbar-row">
            <div class="file-tab-bar" id="sqa-file-tabs"></div>
            <div class="sqa-dialect" title="The dialect these answers are written in">
              <i data-lucide="database"></i><span id="sqa-dialect-label">MySQL</span>
            </div>
          </div>

          <!-- The schema, read-only: it is reference material, not an answer. -->
          <div class="sqa-scroll hidden" id="sqa-init-view">
            <pre class="sqa-init-pre"><code id="sqa-init-code"></code></pre>
          </div>

          <!-- One box per test case. -->
          <div class="sqa-scroll" id="sqa-answers"></div>
        </div>

        ${paneDividerTemplate('right')}
        <aside class="practice-panel" id="practice-panel"></aside>
      </div>
    </div>
  `;
}

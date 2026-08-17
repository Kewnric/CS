/* Route: quests */
function questTemplate() {
  return `
    <div class="quest-board-layout">
      <!-- Status Bar -->
      <div class="system-status-bar">
        <div class="system-status-left">
          <div class="system-status-title">PLAYER STATUS</div>
          <div class="system-status-level" id="player-level-display">Lv. 1</div>
        </div>
        <div class="system-status-xp-container">
          <div class="system-xp-header">
            <span class="quest-job-label" id="player-job-display">Shadow Monarch</span>
            <span class="system-xp-text" id="player-xp-display">0 / 100 XP</span>
          </div>
          <div class="system-xp-bar-bg"><div class="system-xp-bar-fill" id="player-xp-bar" style="width:0%;"></div></div>
        </div>
        <div class="system-status-stats" id="system-status-stats">
          <div class="status-stat" id="stat-active"><i data-lucide="swords"></i><span>0</span><label>Active</label></div>
          <div class="status-stat" id="stat-pending"><i data-lucide="clock"></i><span>0</span><label>Pending</label></div>
          <div class="status-stat completed" id="stat-completed"><i data-lucide="check-circle-2"></i><span>0</span><label>Done</label></div>
          <div class="status-stat failed" id="stat-failed"><i data-lucide="skull"></i><span>0</span><label>Failed</label></div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="quest-main">
        <!-- Left Pane -->
        <main class="messenger-pane-1">
          <div class="pane-1-header" style="padding-bottom:0;">
            <div class="quest-pane-header">
              <h2 class="quest-pane-title">
                <i data-lucide="scroll-text"></i> Quest Board
              </h2>
              <div class="quest-pane-actions">
                <button class="quest-sort-btn" id="quest-sort-btn" onclick="toggleQuestSort()" title="Sort quests">
                  <i data-lucide="arrow-up-down"></i>
                </button>
                <button class="quest-new-btn" onclick="createNewQuest()" title="New Quest">
                  <i data-lucide="plus"></i>
                </button>
              </div>
            </div>
            <div class="quest-search-wrap">
              <i data-lucide="search" class="quest-search-icon"></i>
              <input type="text" id="quest-search-input" class="quest-search-input"
                placeholder="Search quests..." oninput="renderQuestList()" />
            </div>
            <div class="quest-tab-row">
              <button class="quest-tab" id="tab-active" onclick="setQuestTab('active')">
                <i data-lucide="swords"></i> Active
                <span class="quest-tab-badge" id="badge-active" style="display:none;"></span>
              </button>
              <button class="quest-tab" id="tab-pending" onclick="setQuestTab('pending')">
                <i data-lucide="clock"></i> Pending
                <span class="quest-tab-badge" id="badge-pending" style="display:none;"></span>
              </button>
              <button class="quest-tab" id="tab-completed" onclick="setQuestTab('completed')">
                <i data-lucide="check-circle-2"></i> Done
                <span class="quest-tab-badge" id="badge-completed" style="display:none;"></span>
              </button>
              <button class="quest-tab" id="tab-failed" onclick="setQuestTab('failed')">
                <i data-lucide="skull"></i> Failed
                <span class="quest-tab-badge" id="badge-failed" style="display:none;"></span>
              </button>
            </div>
          </div>
          <div class="pane-1-content" id="quest-list-container"></div>
        </main>

        <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>

        <!-- Right Pane -->
        <section class="messenger-pane-2">
          <div id="quest-details-container" style="display:flex;flex-direction:column;height:100%;overflow-y:auto;">
            <div class="quest-empty-state">
              <div class="quest-empty-icon"><i data-lucide="target"></i></div>
              <h2>SYSTEM STANDBY</h2>
              <p>Select a quest or create a new one to begin.</p>
              <button class="btn-system" onclick="createNewQuest()" style="margin-top:1.5rem;">
                <i data-lucide="plus" style="width:16px;height:16px;display:inline;vertical-align:-3px;margin-right:6px;"></i>
                NEW QUEST
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

  `;
}

function questInit() {
  if (typeof initQuestBoard === 'function') initQuestBoard();
  if (window.questHUD) window.questHUD.refresh();
}

function questDestroy() {
  if (window.questGlobalTimer) { clearInterval(window.questGlobalTimer); window.questGlobalTimer = null; }
}

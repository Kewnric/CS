/* Route: solution */
function solutionTemplate() {
  return `
    <div class="solution-layout">
      <div class="diff-topbar">
        <button id="solution-back-btn" class="btn-back-dark"><i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Editor</button>
        <div class="file-tab-bar" id="solution-file-tabs" style="border-bottom:none; background:transparent;"></div>
        <div class="diff-topbar-tools">
          <span class="diff-nav" role="group" aria-label="Move between differences">
            <button class="ed-tool" onclick="solStepDiff(-1)" title="Previous difference (p or Shift+Enter)" aria-label="Previous difference"><i data-lucide="chevron-up"></i></button>
            <span class="diff-nav-count" id="diff-nav-count">0 / 0</span>
            <button class="ed-tool" onclick="solStepDiff(1)" title="Next difference (n or Enter)" aria-label="Next difference"><i data-lucide="chevron-down"></i></button>
          </span>
          <span class="ed-tool-sep" aria-hidden="true"></span>
          <button class="ed-tool" id="diff-search-btn" onclick="solToggleSearch()" title="Search the diff (Ctrl+F)" aria-label="Search the diff"><i data-lucide="search"></i></button>
          <button class="ed-tool" id="diff-mode-toggle" onclick="toggleDiffMode()" title="Side-by-side / unified (u)" aria-label="Toggle side-by-side or unified"><i data-lucide="columns"></i></button>
          <button class="ed-tool" id="diff-filter-toggle" onclick="toggleDiffFilter()" title="Show all / differences only (f)" aria-label="Show all or differences only"><i data-lucide="filter"></i></button>
          <button class="ed-tool" id="diff-opts-btn" onclick="solToggleOptions()" title="Comparison options" aria-label="Comparison options"><i data-lucide="sliders-horizontal"></i></button>
          <button class="ed-tool" onclick="solExportDiff()" title="Export this diff as a page" aria-label="Export this diff"><i data-lucide="download"></i></button>
          <span class="ed-tool-sep" aria-hidden="true"></span>
          <div class="diff-legend">
            <span class="diff-legend-item"><span class="diff-legend-dot match"></span> Match</span>
            <span class="diff-legend-item"><span class="diff-legend-dot minor"></span> Minor Diff</span>
            <span class="diff-legend-item"><span class="diff-legend-dot wrong"></span> Wrong/Missing</span>
          </div>
        </div>
      </div>

      <div class="diff-search-bar" id="diff-search-bar" style="display:none;">
        <i data-lucide="search" class="ed-find-ic"></i>
        <input id="diff-search-input" class="ed-find-input" placeholder="Search both panels" spellcheck="false" autocomplete="off" />
        <span class="ed-find-count" id="diff-search-count">0/0</span>
        <button class="ed-tool" onclick="solSearchStep(-1)" title="Previous match"><i data-lucide="chevron-up"></i></button>
        <button class="ed-tool" onclick="solSearchStep(1)" title="Next match"><i data-lucide="chevron-down"></i></button>
        <button class="ed-tool" onclick="solToggleSearch(false)" title="Close (Esc)"><i data-lucide="x"></i></button>
      </div>

      <div class="diff-options" id="diff-options" style="display:none;"></div>

      <div class="sol-summary" id="sol-summary" style="display:none;"></div>
      <div class="sol-compare" id="sol-compare" style="display:none;"></div>
      <div id="set-question-switcher" class="set-question-switcher" style="display:none;"></div>

      <div class="diff-stage">
        <div class="diff-panels" id="diff-panels-container">
          <div class="diff-panel">
            <div class="diff-panel-header actual">
              <span id="diff-actual-title">Your Submission</span>
              <button class="btn btn-ghost btn-sm diff-copy-btn" onclick="copyMyCode()" title="Copy your code">
                <i data-lucide="copy" style="width:12px;height:12px;"></i> <span id="copy-mine-label">Copy</span>
              </button>
            </div>
            <div id="diff-actual" class="diff-panel-body"></div>
          </div>
          <div class="diff-panel">
            <div class="diff-panel-header expected">
              <span id="diff-expected-title">Correct Solution</span>
              <button class="btn btn-ghost btn-sm diff-copy-btn" onclick="copyExpectedCode()" title="Copy the reference source">
                <i data-lucide="copy" style="width:12px;height:12px;"></i> <span id="copy-btn-label">Copy</span>
              </button>
            </div>
            <div id="diff-expected" class="diff-panel-body"></div>
          </div>
        </div>
        <div class="diff-unified-panel" id="diff-unified-container" style="display:none;">
          <div class="diff-panel" style="flex:1;">
            <div class="diff-panel-header"><span style="color:#e6edf3;">Unified Diff</span></div>
            <div id="diff-unified" class="diff-panel-body"></div>
          </div>
        </div>
        <div class="diff-ruler" id="diff-ruler" title="Every difference in this file — click to jump"></div>
      </div>
    </div>
  `;
}
function solutionInit() { initSolution(); }
function solutionDestroy() { if (typeof destroySolution === 'function') destroySolution(); }

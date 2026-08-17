/* Route: notes-solution */
function notesSolutionTemplate() {
  return `
    <div style="padding: 2rem; overflow-y: auto; max-width: 900px; margin: 0 auto; width: 100%; flex: 1;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
        <button onclick="spaNavigate('study')" class="btn btn-ghost"><i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Notes Library</button>
      </div>
      <div style="text-align: center; margin-bottom: 2rem;">
        <h1 id="ns-notebook-title" style="font-size: 1.75rem; font-weight: 800;"></h1>
        <p id="ns-datetime" style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;"></p>
      </div>
      <div style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 2rem;">
        <div style="text-align: center;"><div style="font-size: 2rem; font-weight: 800; color: var(--color-primary);" id="ns-total-score">0/0</div><div style="color: var(--text-tertiary); font-size: 0.875rem;">Total Score</div></div>
        <div style="text-align: center;"><div style="font-size: 2rem; font-weight: 800; color: var(--color-success);" id="ns-accuracy">0%</div><div style="color: var(--text-tertiary); font-size: 0.875rem;">Accuracy</div></div>
      </div>
      <div class="divider" style="margin-bottom: 2rem;"></div>
      <div id="ns-sections-review"></div>
    </div>
  `;
}
function notesSolutionInit() { initNotesSolution(); }
function notesSolutionDestroy() { }

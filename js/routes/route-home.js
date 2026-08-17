/* Route: home */
function homeTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll">
        <section class="home-hero fade-in-up" style="position: relative;">
          <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour"
            style="position: absolute; top: 1rem; right: 1rem;">
            <i data-lucide="graduation-cap"></i>
          </button>
          <div class="hero-greeting" id="hero-greeting"></div>
          <div class="hero-subtitle" id="hero-subtitle"></div>
          <div class="hero-date" id="hero-date"></div>
          <div class="hero-verse" id="hero-verse"
            style="margin-top: 1rem; font-style: italic; color: var(--text-tertiary); max-width: 600px;"></div>
        </section>
        <section class="home-stats-grid stagger-children" id="home-stats"></section>
        <section class="home-two-col">
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div class="home-card" id="home-heatmap"></div>
            <div id="home-notebook-carousel"></div>
          </div>
          <div class="home-card" id="home-actions"></div>
        </section>
        <section class="home-two-col">
          <div class="home-card" id="home-srs"></div>
          <div class="home-card" id="home-activity"></div>
        </section>
      </div>
    </div>
  `;
}

function homeInit() {
  renderHomeDashboard();
  setTimeout(() => GuidedTutorial.init('dashboard'), 100);
}

function homeDestroy() {
  // No persistent intervals to clean
}

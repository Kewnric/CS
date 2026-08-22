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
          <div class="hero-verse-tools">
            <button class="hero-verse-btn" id="hero-verse-toggle" onclick="homeVerseAction()"></button>
            <button class="hero-verse-btn" onclick="homeHideVerse()" title="Hide the verse">
              <i data-lucide="eye-off"></i>
            </button>
          </div>
        </section>
        <section class="home-stats-grid stagger-children" id="home-stats"></section>
        <!-- Only present when something was left unfinished, and only until its
             countdown runs out. Sits under the stats so the numbers stay put. -->
        <section id="home-continue"></section>
        <!-- Quick Actions is a fixed list of six links, so it is sized to its
             content and the heatmap and carousel take the rest — they are the
             two things on this page that actually benefit from width. -->
        <section class="home-two-col home-two-col-wide">
          <div style="display: flex; flex-direction: column; gap: 1.5rem; min-width: 0;">
            <div class="home-card" id="home-heatmap"></div>
            <div id="home-notebook-carousel"></div>
          </div>
          <div class="home-card" id="home-actions"></div>
        </section>
        <section class="home-two-col">
          <div class="home-card" id="home-srs"></div>
          <div class="home-card" id="home-activity"></div>
        </section>
        <section class="home-two-col">
          <div class="home-card" id="home-weak"></div>
          <div class="home-card" id="home-day"></div>
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
  // The stat card cycles on a 4s interval; leaving it running would keep
  // re-rendering a pane that is no longer on screen.
  if (typeof homeStopStatCycle === 'function') homeStopStatCycle();
  if (typeof homeCloseStreakCalendar === 'function') homeCloseStreakCalendar();
  if (typeof homeCloseBadges === 'function') homeCloseBadges();
}

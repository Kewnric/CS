/* Route: notes-practice */
function notesPracticeTemplate() {
  return `
    <div class="practice-layout" style="height: 100%; border-radius: 0; border: none;">
      <div class="practice-topbar" id="np-topbar-practice">
        <div class="practice-topbar-left">
          <button onclick="spaNavigate('study')" class="btn-back-dark" id="np-back-btn"><i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back</button>
          <span id="np-notebook-title" class="practice-title-badge">Loading Notebook...</span>
        </div>
        <div class="practice-topbar-right" style="display:flex; align-items:center; gap: 1rem;">
          <button id="np-hint-btn" onclick="showHintModal()" class="tutorial-trigger-btn" title="Show Hint" style="color: silver;"><i data-lucide="lightbulb"></i></button>
          <button id="np-align-btn" onclick="toggleNpTextAlign()" class="tutorial-trigger-btn" title="Text: Centered" style="color: silver;"><i data-lucide="align-center"></i></button>
          <button id="np-flag-btn" onclick="npToggleFlag(currentSectionIdx, currentQuestionNum)" class="tutorial-trigger-btn" title="Flag for review (F)" aria-pressed="false" style="color: silver;"><i data-lucide="flag"></i></button>
          <button id="np-cheat-btn" onclick="openCheatsheet()" class="tutorial-trigger-btn" title="Cheat sheet" style="color: silver;"><i data-lucide="book-open-check"></i></button>
          <!-- Shared with the coding attempt. Both templates read their state
               from the same modules, so they need no wiring here beyond the
               ostMount/ostStop pair below: feel-panel keeps itself in step
               through feelSync, and the OST audio element lives on <body>. -->
          ${typeof feelButtonTemplate === 'function' ? feelButtonTemplate() : ''}
          ${typeof ostButtonTemplate === 'function' ? ostButtonTemplate() : ''}
          <button id="np-fullscreen-btn" onclick="toggleFullscreen()" class="tutorial-trigger-btn" title="Full screen" aria-label="Full screen" style="color: silver;"><i data-lucide="maximize"></i></button>
          <select id="theme-selector" class="form-select" onchange="changeTheme(this.value)" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto;">
            <option value="dark">Night</option><option value="light">Day</option><option value="purple">Purple</option><option value="green">Green</option>
          </select>
          <div id="np-timer-container" class="timer-display" oncontextmenu="npTimerMenu(event)" title="Right-click to change the timer"><i data-lucide="clock"></i><span id="np-timer-display">--:--</span></div>
          <button onclick="npSubmitAttempt()" class="btn-submit" id="np-submit-btn"><i data-lucide="check" style="width:16px;height:16px;"></i> Submit</button>
        </div>
      </div>
      <div class="practice-topbar np-review-topbar hidden" id="np-topbar-review">
        <div class="practice-topbar-left">
          <button onclick="exitReview()" class="btn-back-dark"><i data-lucide="arrow-left" style="width:18px;height:18px;"></i> Back to Notes Library</button>
          <span class="practice-title-badge" style="background:rgba(16,185,129,0.15); color:#10b981; border-color:rgba(16,185,129,0.3);"><i data-lucide="check-circle-2" style="width:14px;height:14px;"></i> Review Mode</span>
        </div>
        <div class="practice-topbar-right"><div id="np-review-score" style="display:flex; align-items:center; gap:0.75rem; font-weight:700; font-size:1rem;"></div></div>
      </div>
      <div class="practice-body">
        <div class="practice-sidebar" style="width: 320px; min-width: 320px;">
          <div style="margin-bottom: 1rem;"><h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="layers" style="width:18px;height:18px;color:var(--color-primary);"></i> Sections</h2></div>
          <div id="np-sections-tabs" style="display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 1.5rem;"></div>
          <div style="border-top: 1px solid #21262d; padding-top: 1rem; margin-bottom: 1rem;">
            <h3 style="font-size: 0.8125rem; font-weight: 700; color: #8b949e; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.75rem;" id="np-current-section-title">Section</h3>
            <div id="np-question-grid" class="np-grid"></div>
          </div>
          <div class="practice-footer" id="np-footer-text"><p>Keys: <kbd>1-9</kbd>/<kbd>A-E</kbd> answer &middot; <kbd>N</kbd>/<kbd>P</kbd> or arrows move &middot; <kbd>F</kbd> flag &middot; <kbd>H</kbd> hint. Right-click the timer to change it.</p></div>
        </div>
        <div class="np-question-pane" style="flex: 1; display: flex; align-items: flex-start; justify-content: center; background: #0d1117; position: relative; overflow-y: auto;">
          <div style="position: absolute; top: 1rem; left: 1.25rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-tertiary); opacity: 0.8; z-index: 1;" id="np-q-progress">0 / 0</div>
          <div style="width: 100%; max-width: 900px; padding: 2.5rem 2rem; margin: auto 0;">
            <div style="text-align: center; margin-bottom: 2.5rem; position: relative;">
              <!-- Question Image at the very top -->
              <div id="np-q-image-container" class="hidden" style="margin-top: 0; margin-bottom: 1.5rem; text-align: center; width: 100%;">
                <img id="np-q-image" src="" alt="Question Image" style="max-width: 100%; max-height: 320px; border-radius: var(--radius-md); border: 1px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.15); object-fit: contain; margin: 0 auto; display: block;" />
              </div>
              
              <!-- Question label and heading below the image -->
              <div style="margin-bottom: 0.5rem;">
                <div style="font-size: 0.6875rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;" id="np-q-label">Question 1</div>
              </div>
              <h2 style="display:none; color: var(--text-primary);" id="np-q-heading">Select your answer</h2>
              <div id="np-q-text" class="hidden" style="font-size: 1.125rem; line-height: 1.6; color: var(--text-primary); margin-top: 1rem; text-align: center; padding: 0 1rem; min-height: 2rem; word-wrap: break-word; overflow-wrap: break-word;"></div>
              <div id="np-review-status" class="hidden" style="margin-top: 1rem;"></div>

            </div>
            <div id="np-bubbles-container" style="display:flex; flex-direction:column; gap:0.75rem; align-items:center; width:100%;"></div>
            <div id="np-nav-row" style="display:flex; justify-content:space-between; margin-top:2.5rem; padding-top:1.5rem; border-top:1px solid #21262d;">
              <button id="np-btn-prev" onclick="npPrevQuestion()" class="btn btn-ghost" style="font-weight:600;"><i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Previous</button>
              <button id="np-btn-next" onclick="npNextQuestion()" class="btn btn-ghost" style="font-weight:600;">Next <i data-lucide="chevron-right" style="width:18px;height:18px;"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="np-results-overlay" class="modal-overlay hidden" style="z-index:10000;">
      <div class="modal-content modal-content-lg" style="max-width:550px; text-align:center;">
        <div id="np-results-icon" style="margin-bottom:1rem;"></div>
        <h2 id="np-results-title" class="modal-title" style="font-size:1.75rem;"></h2>
        <p id="np-results-desc" class="modal-desc"></p>
        <div id="np-results-breakdown" style="margin:1.5rem 0; text-align:left;"></div>
        <div class="modal-actions" style="flex-direction:column; gap:0.75rem;">
          <button onclick="enterReviewMode()" class="btn btn-primary" style="width:100%;"><i data-lucide="eye" style="width:18px;height:18px;"></i> Review Answers</button>
          <button onclick="spaNavigate('study')" class="btn btn-secondary" style="width:100%;">Back to Notes Library</button>
        </div>
      </div>
    </div>
  `;
}
/* ── The phone's action bar ────────────────────────────────────────────────
   On a phone the primary action moves out of the topbar and down beside
   Previous/Next, the way the coding attempt keeps Run Code and Finish attempt
   in a bar of their own. Two things go wrong when Submit stays up top: the
   topbar's controls measure wider than the screen, so it was pushed off the
   right edge entirely and the attempt could not be finished; and the one button
   that ends the session sits in the busiest strip on the page.

   Done by moving the node rather than in CSS, because the two live in different
   containers and no amount of positioning makes one a child of the other. The
   button keeps its id, its handler and its listeners -- appendChild moves it,
   it is not a copy -- so nothing else has to know this happened.

   Watched rather than read once: a phone rotating to landscape crosses the
   breakpoint, and the button has to go back where it came from. */
let _npChromeMq = null;
let _npChromeSync = null;

function npSyncMobileChrome() {
  const submit = document.getElementById('np-submit-btn');
  const navRow = document.getElementById('np-nav-row');
  const topbarRight = document.querySelector('#np-topbar-practice .practice-topbar-right');
  if (!submit || !navRow || !topbarRight) return;
  const narrow = window.matchMedia('(max-width: 640px)').matches;
  if (narrow) {
    // Last in the row, so the order reads Previous, Next, Submit.
    if (submit.parentElement !== navRow) navRow.appendChild(submit);
  } else if (submit.parentElement !== topbarRight) {
    topbarRight.appendChild(submit);
  }
}

function notesPracticeInit() {
  initNotesPracticeSession();
  // The topbar is built with the route, so the OST transport is mounted once
  // here -- the same call practiceInit makes. Without it the disc is drawn but
  // a track left playing from a previous attempt never picks back up.
  if (typeof ostMount === 'function') ostMount();
  npSyncMobileChrome();
  _npChromeMq = window.matchMedia('(max-width: 640px)');
  _npChromeSync = () => npSyncMobileChrome();
  // addEventListener on a MediaQueryList is not in older Safari; addListener is.
  if (_npChromeMq.addEventListener) _npChromeMq.addEventListener('change', _npChromeSync);
  else if (_npChromeMq.addListener) _npChromeMq.addListener(_npChromeSync);
  /* And resize, because the media-query change event is the precise signal but
     not a reliable one everywhere -- crossing the breakpoint under viewport
     emulation left the button in the bar with matchMedia already reporting
     false. npSyncMobileChrome compares against the current parent before
     touching anything, so firing it on every resize costs a boolean. */
  window.addEventListener('resize', _npChromeSync);
}
// FIX: Explicitly clear intervals referencing the correct variables to prevent memory leaks
function notesPracticeDestroy() {
  /* These three live on <body>, not in the route, so replacing the route left
     them behind: the cheat sheet stayed open over the library, the timer's
     right-click menu stayed on screen, and the OST kept playing with its only
     transport -- the topbar about to be replaced -- gone with the route. The
     coding attempt has cleared all three for a while; this one never did. */
  if (typeof closeCheatsheet === 'function') closeCheatsheet();
  if (typeof _timerMenuClose === 'function') _timerMenuClose();
  if (typeof ostStop === 'function') ostStop();
  if (typeof speechStop === 'function') speechStop();
  if (typeof timerInterval !== 'undefined' && timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (typeof gradeAdvanceTimer !== 'undefined' && gradeAdvanceTimer) { clearTimeout(gradeAdvanceTimer); gradeAdvanceTimer = null; }
  // Leaving mid-attempt keeps the draft; the keys go with the page.
  if (typeof npFlushProgress === 'function') npFlushProgress();
  if (typeof npUnbindKeys === 'function') npUnbindKeys();
  if (_npChromeMq && _npChromeSync) {
    if (_npChromeMq.removeEventListener) _npChromeMq.removeEventListener('change', _npChromeSync);
    else if (_npChromeMq.removeListener) _npChromeMq.removeListener(_npChromeSync);
  }
  if (_npChromeSync) window.removeEventListener('resize', _npChromeSync);
  _npChromeMq = null;
  _npChromeSync = null;
}

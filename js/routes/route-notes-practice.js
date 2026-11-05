/* Route: notes-practice */
function notesPracticeTemplate() {
  return `
    <div class="practice-layout np-layout" id="np-layout" style="height: 100%; border-radius: 0; border: none;">
      <div class="practice-topbar np-topbar" id="np-topbar-practice">
        <div class="practice-topbar-left np-topbar-left">
          <button onclick="spaNavigate('study')" class="btn-back-dark np-sp" id="np-back-btn"><i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back</button>
          <!-- The title takes whatever the right-hand cluster leaves. It used to
               carry .practice-title-badge, whose max-width:42% resolved against
               a parent that was itself sized to the title -- a cycle that cut a
               five-letter name to "sda...". The full name is on the tooltip. -->
          <div class="np-title-chip" id="np-title-chip">
            <span class="np-title-icon" aria-hidden="true"><i data-lucide="notebook-pen"></i></span>
            <span id="np-notebook-title" class="np-title-text">Loading notebook…</span>
            <span class="np-title-count" id="np-title-count" title="Questions answered">0 / 0</span>
          </div>
        </div>
        <div class="practice-topbar-right np-topbar-right">
          <div class="np-toolgroup" role="toolbar" aria-label="Question tools">
            <button id="np-hint-btn" onclick="showHintModal()" class="np-tb-btn np-sp" title="Show hint (H)" aria-label="Show hint"><i data-lucide="lightbulb"></i></button>
            <button id="np-shuffle-btn" onclick="npShuffleMenu(event)" class="np-tb-btn np-sp np-shuffle-btn" title="Shuffle" aria-label="Shuffle settings" aria-haspopup="dialog" aria-pressed="false"><i data-lucide="shuffle"></i></button>
            <button id="np-flag-btn" onclick="npToggleFlag(currentSectionIdx, currentQuestionNum)" class="np-tb-btn np-sp" title="Flag for review (F)" aria-label="Flag for review" aria-pressed="false"><i data-lucide="flag"></i></button>
            <button id="np-cheat-btn" onclick="openCheatsheet()" class="np-tb-btn np-sp" title="Cheat sheet" aria-label="Cheat sheet"><i data-lucide="book-open-check"></i></button>
          </div>
          <div class="np-toolgroup" role="toolbar" aria-label="Screen">
            <!-- Spatial effects: one click on, one click off. The level and the
                 rest of the display options are in the panel beside it. -->
            <button id="np-spatial-btn" onclick="npUiToggleSpatial()" class="np-tb-btn np-sp" title="Spatial effects" aria-label="Spatial effects" aria-pressed="false"><i data-lucide="rotate-3d"></i></button>
            <button id="np-display-btn" onclick="npUiTogglePanel(event)" class="np-tb-btn np-sp" title="Display settings" aria-label="Display settings" aria-haspopup="dialog" aria-expanded="false"><i data-lucide="sliders-horizontal"></i></button>
            ${typeof ostButtonTemplate === 'function' ? ostButtonTemplate() : ''}
            <button id="np-fullscreen-btn" onclick="toggleFullscreen()" class="np-tb-btn np-sp" title="Full screen" aria-label="Full screen"><i data-lucide="maximize"></i></button>
          </div>
          <div id="np-timer-container" class="timer-display" oncontextmenu="npTimerMenu(event)" title="Right-click to change the timer"><i data-lucide="clock"></i><span id="np-timer-display">--:--</span></div>
          <button onclick="npSubmitAttempt()" class="btn-submit np-sp" id="np-submit-btn"><i data-lucide="check" style="width:16px;height:16px;"></i> Submit</button>
        </div>
        <div class="np-top-rail" aria-hidden="true"><span id="np-top-rail-fill"></span></div>
      </div>
      <div class="practice-topbar np-topbar np-review-topbar hidden" id="np-topbar-review">
        <div class="practice-topbar-left">
          <button onclick="exitReview()" class="btn-back-dark"><i data-lucide="arrow-left" style="width:18px;height:18px;"></i> Back to Notes Library</button>
          <span class="practice-title-badge" style="background:rgba(16,185,129,0.15); color:#10b981; border-color:rgba(16,185,129,0.3);"><i data-lucide="check-circle-2" style="width:14px;height:14px;"></i> Review Mode</span>
        </div>
        <div class="practice-topbar-right"><div id="np-review-score" style="display:flex; align-items:center; gap:0.75rem; font-weight:700; font-size:1rem;"></div></div>
      </div>
      <div class="practice-body">
        <!-- The sidebar's four children stay in this order: mobile.css and
             layout.css address them as :first-child and :nth-child(3). -->
        <div class="practice-sidebar np-sidebar" style="width: 320px;">
          <div class="np-side-head">
            <h2><i data-lucide="layers" style="width:18px;height:18px;"></i> Sections</h2>
            <span class="np-side-sub" id="np-side-sub"></span>
          </div>
          <div id="np-sections-tabs" class="np-section-tabs"></div>
          <div class="np-grid-block">
            <h3 class="np-grid-title" id="np-current-section-title">Section</h3>
            <div id="np-question-grid" class="np-grid"></div>
            <div class="np-grid-legend" aria-hidden="true">
              <span><i class="np-lg np-lg-now"></i>Current</span>
              <span><i class="np-lg np-lg-ok"></i>Correct</span>
              <span><i class="np-lg np-lg-bad"></i>Wrong</span>
              <span><i class="np-lg np-lg-flag"></i>Flagged</span>
            </div>
          </div>
          <div class="practice-footer np-keys" id="np-footer-text">
            <div class="np-keys-title">Shortcuts</div>
            <ul class="np-keys-list">
              <li><span><kbd>1</kbd>–<kbd>9</kbd> or <kbd>A</kbd>–<kbd>E</kbd></span><em>answer</em></li>
              <li><span><kbd>↑</kbd><kbd>↓</kbd> then <kbd class="np-kbd-wide">Enter</kbd></span><em>choose, confirm</em></li>
              <li><span><kbd>←</kbd><kbd>→</kbd> or <kbd>P</kbd><kbd>N</kbd></span><em>move</em></li>
              <li class="np-keys-rclick"><span><kbd class="np-kbd-wide">Right-click</kbd></span><em>left half back, right half on</em></li>
              <li><span><kbd>F</kbd> <kbd>H</kbd></span><em>flag, hint</em></li>
            </ul>
            <p class="np-keys-note">Right-click the timer to change it.</p>
          </div>
        </div>
        <!-- The coding attempt's seam (editor.js paneDividerTemplate): drag to
             size the sidebar, or the arrow that fades in to fold it away. It
             has its own toggle so the two screens keep separate folds. -->
        <div class="resizer-divider np-divider" data-side="left" onmousedown="initResizerDrag(event, this)">
          <button class="rz-collapse" id="np-rz-btn" type="button"
                  onmousedown="event.stopPropagation()" onclick="npUiTogglePane()"
                  tabindex="-1" aria-hidden="true"><i data-lucide="chevron-left"></i></button>
        </div>
        <div class="np-question-pane" id="np-question-area">
          <div class="np-pane-inner">
            <article class="np-card np-sp-card" id="np-card">
              <header class="np-qhead">
                <div class="np-qhead-main">
                  <div class="np-q-label" id="np-q-label">Question 1</div>
                  <!-- Read aloud sits with the question it reads, not in the
                       topbar. Same switch as before: on, each question speaks
                       as it arrives and an answer speaks under the pointer. -->
                  <button id="np-voice-btn" onclick="npToggleAutoVoice()" class="np-voice-btn np-sp"
                          title="Read questions aloud" aria-label="Read questions aloud" aria-pressed="false">
                    <i data-lucide="volume-x"></i><span class="np-voice-label">Read aloud</span>
                    <span class="np-voice-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                  </button>
                </div>
                <div class="np-qhead-side">
                  <span class="np-q-progress" id="np-q-progress">0 / 0</span>
                </div>
              </header>
              <div class="np-card-meter" aria-hidden="true"><span id="np-card-meter-fill"></span></div>
              <div id="np-q-image-container" class="hidden np-q-image-wrap">
                <img id="np-q-image" src="" alt="Question image" />
              </div>
              <div id="np-q-text" class="hidden np-q-text"></div>
              <div class="np-q-instruction" id="np-q-heading">Select your answer</div>
              <div id="np-review-status" class="hidden np-review-status"></div>
              <div id="np-bubbles-container" class="np-choices"></div>
            </article>
            <div id="np-nav-row" class="np-nav-row">
              <button id="np-btn-prev" onclick="npPrevQuestion()" class="np-nav-btn np-sp"><i data-lucide="chevron-left"></i><span>Previous</span></button>
              <button id="np-btn-next" onclick="npNextQuestion()" class="np-nav-btn np-nav-btn-next np-sp"><span>Next</span><i data-lucide="chevron-right"></i></button>
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
  // Display preferences first, so the first question is drawn at the chosen
  // size rather than drawn once and then resized under the reader.
  if (typeof npUiMount === 'function') npUiMount();
  initNotesPracticeSession();
  // The topbar is built with the route, so the OST transport is mounted once
  // here -- the same call practiceInit makes. Without it the disc is drawn but
  // a track left playing from a previous attempt never picks back up.
  if (typeof ostMount === 'function') ostMount();
  if (typeof _npSyncVoiceBtn === 'function') _npSyncVoiceBtn();
  if (typeof _npPaintShuffleBtn === 'function') _npPaintShuffleBtn();
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
  if (typeof _npShuffleMenuClose === 'function') _npShuffleMenuClose();
  if (typeof npUiUnmount === 'function') npUiUnmount();
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

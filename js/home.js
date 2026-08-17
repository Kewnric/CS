/* ============================================================
   HOME.JS — Dashboard Homepage Rendering
   ============================================================ */

// Local date helper — avoids UTC timezone shift from toISOString()
const _toLocalDate = (d) => {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
};

// Init handled by SPA router (homeInit)

async function renderHomeDashboard() {
  renderHeroSection();
  renderStatsRow();
  renderHomeHeatmap();
  renderQuickActions();
  renderNotebookCarousel();
  renderHomeSRS();
  renderRecentActivity();
  const homeRoot = document.getElementById('home-view') || document.getElementById('main-content');
  lucide.createIcons(homeRoot ? { root: homeRoot } : undefined);

  // Stagger cell animations on heatmap
  document.querySelectorAll('.home-heatmap .heatmap-cell').forEach((cell, i) => {
    cell.style.animationDelay = `${Math.min(i * 2, 800)}ms`;
  });
}

const BIBLE_VERSES = [
  "I can do all things through Christ who strengthens me. — Philippians 4:13",
  "Trust in the LORD with all your heart and lean not on your own understanding. — Proverbs 3:5",
  "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future. — Jeremiah 29:11",
  "Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go. — Joshua 1:9",
  "The LORD is my shepherd, I lack nothing. — Psalm 23:1",
  "But those who hope in the LORD will renew their strength. They will soar on wings like eagles. — Isaiah 40:31",
  "Cast all your anxiety on him because he cares for you. — 1 Peter 5:7",
  "And we know that in all things God works for the good of those who love him. — Romans 8:28",
  "Let all that you do be done in love. — 1 Corinthians 16:14",
  "Your word is a lamp for my feet, a light on my path. — Psalm 119:105"
];

/* ======================== HERO ======================== */
function renderHeroSection() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 5)       greeting = 'Burning the midnight oil.';
  else if (hour < 12) greeting = 'Good morning.';
  else if (hour < 17) greeting = 'Good afternoon.';
  else if (hour < 21) greeting = 'Good evening.';
  else                greeting = 'Burning the midnight oil.';

  const subtitle = 'Welcome back Kenric and Kim.';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const greetEl = document.getElementById('hero-greeting');
  const subEl   = document.getElementById('hero-subtitle');
  const dateEl  = document.getElementById('hero-date');
  const verseEl = document.getElementById('hero-verse');

  if (dateEl) dateEl.textContent = dateStr;

  // Random Bible Verse
  let randomVerse = "";
  if (verseEl) {
    randomVerse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    // Clear it out initially for the fade-in effect
    verseEl.textContent = '';
    verseEl.classList.remove('animate-fade-in');
  }

  // MiSide typing animations
  const greetAnimator = new TextAnimator(greetEl, {
    speed: 20, blur: true, glow: false, chromatic: false, cursor: true,
    onComplete: () => {
      greetAnimator.removeCursor();
      const subAnimator = new TextAnimator(subEl, {
        speed: 15, blur: true, glow: false, chromatic: false, cursor: true,
        onComplete: () => { 
          subAnimator.removeCursor(); 
          if (verseEl && randomVerse) {
            const verseAnimator = new TextAnimator(verseEl, {
              speed: 15, blur: true, glow: false, chromatic: false, cursor: false
            });
            verseAnimator.type(randomVerse);
          }
        }
      });
      subAnimator.type(subtitle);
    }
  });
  greetAnimator.type(greeting);
}

/* ======================== STATS ======================== */
function renderStatsRow() {
  const container = document.getElementById('home-stats');
  if (!container) return;

  const totalChallenges = state.challenges.length;
  const bestScore = state.history.length > 0
    ? Math.max(...state.history.map(h => h.score))
    : 0;

  // Streak: count consecutive days with activity ending today
  const streak = calculateStreak();
  const badgeCount = (state.badges || []).length;

  container.innerHTML = `
    <div class="home-stat-card">
      <div class="stat-icon"><i data-lucide="code"></i></div>
      <div class="stat-value" id="stat-challenges">0</div>
      <div class="stat-label">Programs</div>
    </div>
    <div class="home-stat-card">
      <div class="stat-icon"><i data-lucide="target"></i></div>
      <div class="stat-value" id="stat-best" data-suffix="%">0</div>
      <div class="stat-label">Best Score</div>
    </div>
    <div class="home-stat-card">
      <div class="stat-icon"><i data-lucide="flame"></i></div>
      <div class="stat-value" id="stat-streak">0</div>
      <div class="stat-label">Day Streak</div>
    </div>
    <div class="home-stat-card">
      <div class="stat-icon"><i data-lucide="award"></i></div>
      <div class="stat-value" id="stat-badges">0</div>
      <div class="stat-label">Badges</div>
    </div>
  `;
  lucide.createIcons({ root: container });

  // Animate counters after a short delay
  setTimeout(() => {
    animateCounter(document.getElementById('stat-challenges'), totalChallenges, 900);
    animateCounter(document.getElementById('stat-best'), bestScore, 1100);
    animateCounter(document.getElementById('stat-streak'), streak, 800);
    animateCounter(document.getElementById('stat-badges'), badgeCount, 700);
  }, 400);
}

function calculateStreak() {
  if (state.history.length === 0) return 0;
  const daySet = new Set();
  state.history.forEach(h => {
    daySet.add(_toLocalDate(h.startTime));
  });
  const sorted = [...daySet].sort().reverse();
  const today = _toLocalDate(new Date());
  if (sorted[0] !== today) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev - curr) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

/* ======================== HEATMAP ======================== */
function renderHomeHeatmap() {
  const container = document.getElementById('home-heatmap');
  if (!container) return;

  const activityMap = {};
  state.history.forEach(log => {
    const d = _toLocalDate(log.startTime);
    activityMap[d] = (activityMap[d] || 0) + 1;
  });

  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setDate(today.getDate() - 364);

  const startDow = oneYearAgo.getDay();
  let cells = '';
  for (let p = 0; p < startDow; p++) {
    cells += `<div class="heatmap-cell" data-level="0" style="opacity:0;"></div>`;
  }
  for (let i = 0; i < 365; i++) {
    const d = new Date(oneYearAgo);
    d.setDate(d.getDate() + i);
    const ds = _toLocalDate(d);
    const c = activityMap[ds] || 0;
    let lv = 0;
    if (c === 1) lv = 1;
    else if (c === 2) lv = 2;
    else if (c >= 3 && c <= 4) lv = 3;
    else if (c > 4) lv = 4;
    cells += `<div class="heatmap-cell" data-level="${lv}" title="${ds}: ${c} submissions"></div>`;
  }

  container.innerHTML = `
    <div class="home-card-header"><i data-lucide="calendar"></i> Contribution Heatmap</div>
    <div class="home-heatmap" style="overflow-x:auto;">
      <div class="heatmap-grid">${cells}</div>
    </div>
  `;
}

/* ======================== QUICK ACTIONS ======================== */
function renderQuickActions() {
  const container = document.getElementById('home-actions');
  if (!container) return;

  container.innerHTML = `
    <div class="home-card-header"><i data-lucide="zap"></i> Quick Actions</div>
    <div class="home-quick-actions">
      <a href="#/library" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="library"></i></div>
        <div>
          <div class="quick-action-label">Library</div>
          <div class="quick-action-desc">All collections in one place</div>
        </div>
      </a>
      <a href="#/browse" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="layout-template"></i></div>
        <div>
          <div class="quick-action-label">Coding Library</div>
          <div class="quick-action-desc">Explore challenge programs</div>
        </div>
      </a>
      <a href="#/study" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="book-open"></i></div>
        <div>
          <div class="quick-action-label">Notes Library</div>
          <div class="quick-action-desc">Notebooks & quizzes</div>
        </div>
      </a>
      <a href="#/snippets" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="code"></i></div>
        <div>
          <div class="quick-action-label">Snippet Library</div>
          <div class="quick-action-desc">Reference & try-coding</div>
        </div>
      </a>
      <a href="#/analytics" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="bar-chart-3"></i></div>
        <div>
          <div class="quick-action-label">Analytics</div>
          <div class="quick-action-desc">View your history</div>
        </div>
      </a>
      <a href="#/admin" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="settings"></i></div>
        <div>
          <div class="quick-action-label">Admin Panel</div>
          <div class="quick-action-desc">Manage content</div>
        </div>
      </a>
    </div>
  `;
}

/* ======================== SRS (Spaced Repetition) ======================== */
function renderHomeSRS() {
  const container = document.getElementById('home-srs');
  if (!container) return;

  const due = (typeof getDueReviewItems === 'function') ? getDueReviewItems(6) : [];
  const summary = (typeof getReviewSummary === 'function') ? getReviewSummary() : { due: 0, tracked: 0, nextDue: null };

  const typeMeta = {
    challenge: { icon: 'code' },
    snippet:   { icon: 'file-code' },
    notebook:  { icon: 'book-open' }
  };

  let itemsHtml;
  if (due.length === 0) {
    let sub;
    if (summary.tracked === 0) {
      sub = 'Practice a program, snippet, or notebook to start your review schedule.';
    } else if (summary.nextDue) {
      const days = (typeof _revDaysBetween === 'function') ? _revDaysBetween(_toLocalDate(new Date()), summary.nextDue) : 0;
      sub = days <= 0 ? 'All caught up! 🎉' : `All caught up! 🎉 Next review in ${days} day${days !== 1 ? 's' : ''}.`;
    } else {
      sub = 'All caught up! 🎉';
    }
    itemsHtml = `<div style="color:var(--text-tertiary); font-size:0.8125rem; text-align:center; padding:1rem;">${sub}</div>`;
  } else {
    itemsHtml = due.map(it => {
      const meta = typeMeta[it.type] || typeMeta.challenge;
      const label = (typeof reviewDueLabel === 'function') ? reviewDueLabel(it.daysOverdue) : 'Due';
      return `
        <div class="home-srs-item" onclick="reviewNavigateTo('${it.type}','${it.id}')" title="${escapeHTML(label)} · last score ${it.lastScore}%">
          <i data-lucide="${meta.icon}" style="width:14px;height:14px;color:var(--color-warning);flex-shrink:0;margin-right:2px;"></i>
          <span class="home-srs-title">${escapeHTML(it.title || 'Untitled')}</span>
          <span class="home-srs-score">${it.lastScore}%</span>
        </div>
      `;
    }).join('');
  }

  const badge = summary.due > 0
    ? `<span style="background:var(--color-warning); color:#1a1206; font-size:0.7rem; font-weight:800; padding:1px 7px; border-radius:999px; margin-left:6px;">${summary.due}</span>`
    : '';

  container.innerHTML = `
    <div class="home-card-header" style="color:var(--color-warning);"><i data-lucide="brain"></i> Due for Review ${badge}</div>
    ${itemsHtml}
  `;
}

/* ======================== RECENT ACTIVITY ======================== */
function renderRecentActivity() {
  const container = document.getElementById('home-activity');
  if (!container) return;

  const recent = state.history.slice(0, 6);

  let itemsHtml;
  if (recent.length === 0) {
    itemsHtml = `<div style="color:var(--text-tertiary); font-size:0.8125rem; text-align:center; padding:1rem;">No activity yet. Start practicing!</div>`;
  } else {
    itemsHtml = recent.map((log, i) => {
      const ch = state.challenges.find(c => c.id === log.challengeId);
      const title = ch ? ch.title : 'Unknown';
      const dotClass = log.score >= 100 ? 'perfect' : log.score >= 50 ? 'partial' : 'low';
      const scoreClass = dotClass;
      const timeAgo = getTimeAgo(log.startTime);
      return `
        <div class="home-activity-item" style="animation-delay:${i * 0.08}s">
          <div class="activity-dot ${dotClass}"></div>
          <div class="activity-info">
            <div class="activity-title">${escapeHTML(title)}</div>
            <div class="activity-meta">${timeAgo}</div>
          </div>
          <div class="activity-score ${scoreClass}">${log.score}%</div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div class="home-card-header"><i data-lucide="activity"></i> Recent Activity</div>
    ${itemsHtml}
  `;
}

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/* ======================== CAROUSEL ======================== */
let notebookCarouselIndex = 0;
// Switchable source: 'notebooks' | 'coding' (persisted across visits)
let homeCarouselSource = sessionStorage.getItem('homeCarouselSource') || 'notebooks';

// Stable hue (0–359) derived from a string so each cover-less notebook gets a
// distinct, consistent gradient.
function _notebookHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

/** Items for the active carousel source. */
function _carouselItems() {
  return homeCarouselSource === 'coding' ? (state.challenges || []) : (state.notebooks || []);
}

window.setCarouselSource = function (src) {
  if (src === homeCarouselSource) return;
  homeCarouselSource = src;
  sessionStorage.setItem('homeCarouselSource', src);
  notebookCarouselIndex = 0;
  renderNotebookCarousel();
  const container = document.getElementById('home-notebook-carousel');
  if (container && typeof lucide !== 'undefined') lucide.createIcons({ root: container });
};

function _buildCarouselSlide(item, isCoding) {
  const hue = _notebookHue(item.title || item.id || '');
  const hasCover = !!item.coverImage;
  const bgStyle = hasCover
    ? `background-image:url('${item.coverImage}');`
    : `background-image:linear-gradient(135deg, hsl(${hue} 70% 48%) 0%, hsl(${(hue + 45) % 360} 72% 38%) 100%);`;

  if (isCoding) {
    const vCount = (item.variants || []).length;
    const logs = (state.history || []).filter(h => h.challengeId === item.id && !h.isArchived);
    const best = logs.length ? Math.max(...logs.map(l => l.score)) : null;
    return `
      <div class="carousel-slide" onclick="selectChallengeFromCarousel('${item.id}')" style="--nb-hue:${hue};">
        <div class="carousel-slide-bg ${hasCover ? 'has-cover' : 'no-cover'}" style="${bgStyle}"></div>
        ${hasCover ? '' : `<i class="carousel-slide-watermark" data-lucide="file-code" aria-hidden="true"></i>`}
        <div class="carousel-slide-scrim"></div>
        <div class="carousel-badge"><i data-lucide="code-2"></i> Program</div>
        <div class="carousel-slide-content">
          <div class="carousel-item-title">${escapeHTML(item.title)}</div>
          <div class="carousel-item-subtitle">
            <span><i data-lucide="layers"></i> ${vCount} version${vCount !== 1 ? 's' : ''}</span>
            ${best !== null ? `<span><i data-lucide="target"></i> Best ${best}%</span>` : `<span><i data-lucide="sparkles"></i> Not attempted</span>`}
          </div>
          <div class="carousel-open-cta">Open program <i data-lucide="arrow-right"></i></div>
        </div>
      </div>
    `;
  }

  const sectionCount = (item.sections || []).length;
  const questionCount = (item.sections || []).reduce((s, sec) => s + ((sec.questions || []).length || 0), 0);
  const icon = item.icon || 'book';
  return `
    <div class="carousel-slide" onclick="selectNotebookFromCarousel('${item.id}')" style="--nb-hue:${hue};">
      <div class="carousel-slide-bg ${hasCover ? 'has-cover' : 'no-cover'}" style="${bgStyle}"></div>
      ${hasCover ? '' : `<i class="carousel-slide-watermark" data-lucide="${icon}" aria-hidden="true"></i>`}
      <div class="carousel-slide-scrim"></div>
      <div class="carousel-badge"><i data-lucide="${icon}"></i> Notebook</div>
      <div class="carousel-slide-content">
        <div class="carousel-item-title">${escapeHTML(item.title)}</div>
        <div class="carousel-item-subtitle">
          <span><i data-lucide="layers"></i> ${sectionCount} section${sectionCount !== 1 ? 's' : ''}</span>
          ${questionCount ? `<span><i data-lucide="help-circle"></i> ${questionCount} question${questionCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="carousel-open-cta">Open notebook <i data-lucide="arrow-right"></i></div>
      </div>
    </div>
  `;
}

function renderNotebookCarousel() {
  const container = document.getElementById('home-notebook-carousel');
  if (!container) return;

  const isCoding = homeCarouselSource === 'coding';
  const items = _carouselItems();

  const switcherHTML = `
    <div class="carousel-source-toggle" role="group" aria-label="Carousel content">
      <button class="carousel-source-btn ${!isCoding ? 'active' : ''}" onclick="setCarouselSource('notebooks')" aria-pressed="${!isCoding}">
        <i data-lucide="book-open"></i> Notebooks
      </button>
      <button class="carousel-source-btn ${isCoding ? 'active' : ''}" onclick="setCarouselSource('coding')" aria-pressed="${isCoding}">
        <i data-lucide="code-2"></i> Coding Library
      </button>
    </div>`;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="premium-carousel-container">
        <div class="carousel-title-main">
          <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
          ${isCoding ? 'Coding Library' : 'Notebooks'}
          <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
        </div>
        ${switcherHTML}
        <div style="text-align:center;color:var(--text-tertiary);font-size:0.8125rem;padding:2rem 1rem;">
          No ${isCoding ? 'programs' : 'notebooks'} yet — create some in the Admin panel.
        </div>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }

  if (notebookCarouselIndex >= items.length) notebookCarouselIndex = 0;
  if (notebookCarouselIndex < 0) notebookCarouselIndex = items.length - 1;

  // Positioning (active/side/depth) is applied by _positionCarouselSlides()
  // so the slides persist in the DOM and CSS transitions animate the rotation.
  const slidesHTML = items.map(item => _buildCarouselSlide(item, isCoding)).join('');

  const dotsHTML = items.map((_, idx) => `
    <div class="carousel-dot ${idx === notebookCarouselIndex ? 'active' : ''}" onclick="jumpToNotebookCarousel(${idx})"></div>
  `).join('');

  container.innerHTML = `
    <div class="premium-carousel-container">
      <div class="carousel-title-main">
        <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
        ${isCoding ? 'Coding Library' : 'Notebooks'}
        <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
      </div>
      ${switcherHTML}
      <div class="carousel-viewport">
        <button class="carousel-nav-btn prev-btn" onclick="prevNotebookCarousel(event)" aria-label="Previous notebooks" title="Previous">
          <i data-lucide="chevron-left"></i>
        </button>
        <div class="carousel-track">
          ${slidesHTML}
        </div>
        <button class="carousel-nav-btn next-btn" onclick="nextNotebookCarousel(event)" aria-label="Next notebooks" title="Next">
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
      <div class="carousel-indicators">
        ${dotsHTML}
      </div>
    </div>
  `;

  // Position the (now-persistent) slides around the cylinder.
  _positionCarouselSlides();
}

/**
 * Lay the carousel slides out around a horizontal "cylinder": the active card is
 * centred and flat, neighbours rotate away with depth + fade. Because the slide
 * elements persist between navigations, changing these inline transforms lets the
 * CSS transition animate a smooth left/right rotation instead of a pop.
 */
function _positionCarouselSlides() {
  const track = document.querySelector('#home-notebook-carousel .carousel-track');
  if (!track) return;
  const slides = track.querySelectorAll('.carousel-slide');
  const n = slides.length;
  if (!n) return;

  slides.forEach((slide, idx) => {
    // Shortest-path offset so wrapping (last↔first) rotates the nearest way.
    let off = idx - notebookCarouselIndex;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    const a = Math.abs(off);

    let opacity, transform, z, isActive = false;
    if (a > 2) {
      // Off-stage: parked far to the side, fully transparent. Keep the same
      // transform function order as on-stage so the transition interpolates.
      opacity = 0;
      transform = `translateX(${off > 0 ? 150 : -150}%) translateZ(-400px) rotateY(${-Math.sign(off) * 55}deg) scale(0.6)`;
      z = 0;
    } else {
      const dir = Math.sign(off) || 0;
      const tx = off * 42;                       // horizontal spread (%)
      const tz = -a * 170;                       // push neighbours back (px)
      const ry = -dir * (a === 1 ? 34 : a === 2 ? 50 : 0); // angle toward centre (deg)
      const scale = a === 0 ? 1 : a === 1 ? 0.85 : 0.7;
      opacity = a === 0 ? 1 : a === 1 ? 0.55 : 0.28;
      transform = `translateX(${tx}%) translateZ(${tz}px) rotateY(${ry}deg) scale(${scale})`;
      z = 30 - a * 10;
      isActive = a === 0;
    }

    slide.style.opacity = opacity;
    slide.style.transform = transform;
    slide.style.zIndex = z;
    slide.style.pointerEvents = isActive ? 'auto' : 'none';
    slide.classList.toggle('active', isActive);
    slide.classList.remove('prev', 'next');
  });

  _updateCarouselDots();
}

function _updateCarouselDots() {
  document.querySelectorAll('#home-notebook-carousel .carousel-dot')
    .forEach((d, i) => d.classList.toggle('active', i === notebookCarouselIndex));
}

window.nextNotebookCarousel = function(e) {
  if (e) e.stopPropagation();
  const items = _carouselItems();
  if (!items.length) return;
  notebookCarouselIndex = (notebookCarouselIndex + 1) % items.length;
  _positionCarouselSlides();
};

window.prevNotebookCarousel = function(e) {
  if (e) e.stopPropagation();
  const items = _carouselItems();
  if (!items.length) return;
  notebookCarouselIndex = (notebookCarouselIndex - 1 + items.length) % items.length;
  _positionCarouselSlides();
};

window.jumpToNotebookCarousel = function(idx) {
  notebookCarouselIndex = idx;
  _positionCarouselSlides();
};

window.selectNotebookFromCarousel = function(id) {
  setSessionParam('activeNotebook', id);
  setSessionParam('studyTab', 'notes');
  spaNavigate('study');
};

window.selectChallengeFromCarousel = function(id) {
  setSessionParam('browseActiveProgram', id);
  spaNavigate('browse');
};


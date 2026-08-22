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

  const streak = homeStreakAllLibraries();
  const badges = typeof anBadgeState === 'function' ? anBadgeState() : [];
  const earned = badges.filter(b => b.earned).length;

  container.innerHTML = `
    <button class="home-stat-card is-cycling" id="home-stat-lib" onclick="homeCycleStatLib()"
            title="Click to switch library">
      <div class="stat-face"></div>
      <div class="stat-dots">
        ${HOME_STAT_LIBS.map((l, i) => `<span class="stat-dot${i === 0 ? ' active' : ''}"></span>`).join('')}
      </div>
    </button>
    <div class="home-stat-card" id="home-stat-best"><div class="stat-face"></div></div>
    <button class="home-stat-card is-clickable" onclick="homeOpenStreakCalendar()"
            title="See which days you practised">
      <div class="stat-icon"><i data-lucide="flame"></i></div>
      <div class="stat-value">${streak}</div>
      <div class="stat-label">Day Streak</div>
    </button>
    <button class="home-stat-card is-clickable" onclick="homeOpenBadges()"
            title="See every badge and how close you are">
      <div class="stat-icon"><i data-lucide="award"></i></div>
      <div class="stat-value">${earned}</div>
      <div class="stat-label">Badges</div>
    </button>
  `;
  lucide.createIcons({ root: container });
  homeApplyStatLib(false);
  homeStartStatCycle();
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

  // A year of weeks is wider than the card, and the scrollbar is deliberately
  // hidden, so the strip opened on the oldest week with today off the right-hand
  // edge and nothing to suggest it scrolled at all. Recent activity is the point
  // of this card, so it starts at the end.
  //
  // The card can still be laying out when this runs — scrollWidth equals
  // clientWidth and setting scrollLeft does nothing — so this retries a few
  // times and then gives up rather than polling forever. It stops as soon as
  // the strip is scrollable, and leaves it alone if the reader already moved it.
  //
  // setTimeout rather than requestAnimationFrame: a hidden tab never paints, so
  // rAF would not run at all and the dashboard would come back unscrolled.
  const strip = container.querySelector('.home-heatmap');
  if (!strip) return;
  let tries = 0;
  const toEnd = () => {
    if (!strip.isConnected || tries++ > 6) return;
    if (strip.scrollWidth > strip.clientWidth) {
      if (strip.scrollLeft === 0) strip.scrollLeft = strip.scrollWidth;
      return;
    }
    setTimeout(toEnd, 60);
  };
  setTimeout(toEnd, 0);
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
/* ── Recent activity ──────────────────────────────────────────
   This read state.history only, and looked the program up by challengeId to
   get a name — so a deleted program, or a set problem entered by hand (which
   stores challengeId: null), rendered as "Unknown", and notebook and snippet
   attempts never appeared at all since they live in their own arrays. Every
   record already carries its own title; that is what gets used now. */

/** The three histories in one shape, newest first. */
function _homeRecentEntries() {
  const out = [];

  (state.history || []).forEach(h => {
    if (h.isArchived) return;
    out.push({
      kind: 'coding', label: 'Coding', icon: 'code-2',
      title: h.challengeTitle || 'Untitled program',
      score: typeof h.score === 'number' ? h.score : 0,
      ts: h.submitTime || h.startTime || 0,
      itemId: h.challengeId || null
    });
  });

  (state.notebookHistory || []).forEach(h => {
    if (h.isArchived) return;
    // A notebook's score is not stored; it is the sum of its sections.
    let correct = 0, total = 0;
    (h.sections || []).forEach(sec => { correct += sec.correct || 0; total += sec.total || 0; });
    out.push({
      kind: 'notebook', label: 'Notebook', icon: 'book-open',
      title: h.notebookTitle || 'Untitled notebook',
      score: total ? Math.round((correct / total) * 100) : 0,
      ts: h.submitTime || 0,
      itemId: h.notebookId || null
    });
  });

  (state.snippetHistory || []).forEach(h => {
    if (h.isArchived) return;
    out.push({
      kind: 'snippet', label: 'Snippet', icon: 'file-code',
      title: h.snippetTitle || 'Untitled snippet',
      score: typeof h.score === 'number' ? h.score : 0,
      // Snippet records keep a display date and time rather than a number.
      ts: h.submitTime || Date.parse((h.date || '') + ' ' + (h.time || '')) || 0,
      itemId: h.snippetId || null
    });
  });

  return out.sort((x, y) => y.ts - x.ts);
}

/** Attempts left part-finished, read from the same keys that resume them. */
function _homeUnfinished() {
  const out = [];
  try {
    const d = JSON.parse(localStorage.getItem('ssp.practiceDraft') || 'null');
    if (d && d.challengeId && (d.files || []).some(f => (f.userCode || '').trim())) {
      out.push({ kind: 'coding', label: 'Coding', icon: 'code-2',
        title: d.title || 'Untitled program', ts: d.savedAt || 0, itemId: d.challengeId });
    }
  } catch (e) { /* nothing saved */ }
  try {
    const n = JSON.parse(localStorage.getItem('npAttemptInProgress') || 'null');
    if (n && n.notebookId) {
      out.push({ kind: 'notebook', label: 'Notebook', icon: 'book-open',
        title: n.title || 'Untitled notebook', ts: n.savedAt || 0, itemId: n.notebookId });
    }
  } catch (e) { /* nothing saved */ }
  return out;
}

/** Pick up where an unfinished attempt left off. */
window.homeResumeAttempt = function (kind, itemId) {
  if (kind === 'coding') {
    if (typeof browseResume === 'function') return browseResume(itemId);
    setSessionParam('browseActiveProgram', itemId);
    return spaNavigate('browse');
  }
  if (kind === 'notebook') {
    setSessionParam('activeNotebook', itemId);
    clearSessionParam('notebookDrill');
    return spaNavigate('notes-practice');
  }
};

/** Open that item's own history, on the analytics page that owns it. */
window.homeOpenAttemptHistory = function (kind, itemId) {
  if (!itemId) return;
  const route = kind === 'coding' ? 'analytics-coding'
    : kind === 'notebook' ? 'analytics-notes' : 'analytics-snippets';
  spaNavigate(route);
  // The route renders before its detail view exists, so this waits a beat.
  setTimeout(() => {
    const fn = kind === 'coding' ? window.showHistoryDetail
      : kind === 'notebook' ? window.showNotebookHistoryDetail : window.showSnippetHistoryDetail;
    if (typeof fn === 'function') fn(itemId);
  }, 260);
};

function renderRecentActivity() {
  const container = document.getElementById('home-activity');
  if (!container) return;

  const unfinished = _homeUnfinished();
  const done = _homeRecentEntries().slice(0, unfinished.length ? 5 : 6);

  const unfinishedHtml = unfinished.map((u, i) => `
    <div class="home-activity-item is-unfinished" style="animation-delay:${i * 0.08}s">
      <div class="activity-dot unfinished" title="Unfinished"></div>
      <div class="activity-info">
        <div class="activity-title">${escapeHTML(u.title)}</div>
        <div class="activity-meta">
          <span class="activity-kind ${u.kind}"><i data-lucide="${u.icon}"></i>${u.label}</span>
          <span>In progress${u.ts ? ' · ' + getTimeAgo(u.ts) : ''}</span>
        </div>
      </div>
      <button class="activity-action resume" onclick="homeResumeAttempt('${u.kind}','${u.itemId}')">
        <i data-lucide="play"></i> Continue
      </button>
    </div>`).join('');

  const doneHtml = done.map((e, i) => {
    const dot = e.score >= 100 ? 'perfect' : e.score >= 50 ? 'partial' : 'low';
    return `
      <div class="home-activity-item" style="animation-delay:${(unfinished.length + i) * 0.08}s">
        <div class="activity-dot ${dot}"></div>
        <div class="activity-info">
          <div class="activity-title">${escapeHTML(e.title)}</div>
          <div class="activity-meta">
            <span class="activity-kind ${e.kind}"><i data-lucide="${e.icon}"></i>${e.label}</span>
            <span>${e.ts ? getTimeAgo(e.ts) : 'Earlier'}</span>
          </div>
        </div>
        <div class="activity-score ${dot}">${e.score}%</div>
        ${e.itemId ? `<button class="activity-action" title="See this item's attempts"
          onclick="homeOpenAttemptHistory('${e.kind}','${e.itemId}')"><i data-lucide="history"></i></button>` : ''}
      </div>`;
  }).join('');

  const empty = !unfinished.length && !done.length;
  container.innerHTML = `
    <div class="home-card-header"><i data-lucide="activity"></i> Recent Activity</div>
    ${empty
      ? '<div style="color:var(--text-tertiary); font-size:0.8125rem; text-align:center; padding:1rem;">No activity yet. Start practicing!</div>'
      : unfinishedHtml + doneHtml}
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: container });
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
let homeCarouselSource = sessionStorage.getItem('homeCarouselSource') || 'coding';

// Stable hue (0–359) derived from a string so each cover-less notebook gets a
// distinct, consistent gradient.
function _notebookHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

/* The three libraries the carousel can show, in the order they are offered. */
const HOME_CAROUSEL_SOURCES = [
  { key: 'coding',    label: 'Coding Library', icon: 'code-2',    items: () => state.challenges || [] },
  { key: 'notebooks', label: 'Notebooks',      icon: 'book-open', items: () => state.notebooks || [] },
  { key: 'snippets',  label: 'Snippet Library', icon: 'file-code', items: () => state.snippets || [] }
];

function _carouselSource() {
  return HOME_CAROUSEL_SOURCES.find(x => x.key === homeCarouselSource) || HOME_CAROUSEL_SOURCES[0];
}

/** Items for the active carousel source. */
function _carouselItems() {
  return _carouselSource().items();
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

function _buildCarouselSlide(item, srcKey) {
  const hue = _notebookHue(item.title || item.id || '');
  const hasCover = !!item.coverImage;
  const bgStyle = hasCover
    ? `background-image:url('${item.coverImage}');`
    : `background-image:linear-gradient(135deg, hsl(${hue} 70% 48%) 0%, hsl(${(hue + 45) % 360} 72% 38%) 100%);`;

  if (srcKey === 'coding') {
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

  if (srcKey === 'snippets') {
    const logs = (state.snippetHistory || []).filter(h => h.snippetId === item.id && !h.isArchived);
    const best = logs.length ? Math.max(...logs.map(l => l.score || 0)) : null;
    const tagCount = (item.tags || []).length;
    const sIcon = item.icon || 'file-code';
    return `
      <div class="carousel-slide" onclick="selectSnippetFromCarousel('${item.id}')" style="--nb-hue:${hue};">
        <div class="carousel-slide-bg ${hasCover ? 'has-cover' : 'no-cover'}" style="${bgStyle}"></div>
        ${hasCover ? '' : `<i class="carousel-slide-watermark" data-lucide="${sIcon}" aria-hidden="true"></i>`}
        <div class="carousel-slide-scrim"></div>
        <div class="carousel-badge"><i data-lucide="${sIcon}"></i> Snippet</div>
        <div class="carousel-slide-content">
          <div class="carousel-item-title">${escapeHTML(item.title || 'Untitled snippet')}</div>
          <div class="carousel-item-subtitle">
            <span><i data-lucide="terminal"></i> ${escapeHTML(item.language || 'plain')}</span>
            ${best !== null
              ? `<span><i data-lucide="target"></i> Best ${best}%</span>`
              : (tagCount ? `<span><i data-lucide="tag"></i> ${tagCount} tag${tagCount !== 1 ? 's' : ''}</span>`
                          : `<span><i data-lucide="sparkles"></i> Not attempted</span>`)}
          </div>
          <div class="carousel-open-cta">Open snippet <i data-lucide="arrow-right"></i></div>
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

  const items = _carouselItems();

  const switcherHTML = `
    <div class="carousel-source-toggle" role="group" aria-label="Carousel content">
      ${HOME_CAROUSEL_SOURCES.map(src => `
      <button class="carousel-source-btn ${src.key === homeCarouselSource ? 'active' : ''}"
              onclick="setCarouselSource('${src.key}')" aria-pressed="${src.key === homeCarouselSource}">
        <i data-lucide="${src.icon}"></i> ${src.label}
      </button>`).join('')}
    </div>`;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="premium-carousel-container">
        <div class="carousel-title-main">
          <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
          ${_carouselSource().label}
          <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
        </div>
        ${switcherHTML}
        <div style="text-align:center;color:var(--text-tertiary);font-size:0.8125rem;padding:2rem 1rem;">
          No ${_carouselSource().label.toLowerCase().replace(' library', '')} yet — create some in the Admin panel.
        </div>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }

  if (notebookCarouselIndex >= items.length) notebookCarouselIndex = 0;
  if (notebookCarouselIndex < 0) notebookCarouselIndex = items.length - 1;

  // Positioning (active/side/depth) is applied by _positionCarouselSlides()
  // so the slides persist in the DOM and CSS transitions animate the rotation.
  const slidesHTML = items.map(item => _buildCarouselSlide(item, homeCarouselSource)).join('');

  const dotsHTML = items.map((_, idx) => `
    <div class="carousel-dot ${idx === notebookCarouselIndex ? 'active' : ''}" onclick="jumpToNotebookCarousel(${idx})"></div>
  `).join('');

  container.innerHTML = `
    <div class="premium-carousel-container">
      <div class="carousel-title-main">
        <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
        ${_carouselSource().label}
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

window.selectSnippetFromCarousel = function(id) {
  setSessionParam('activeSnippetId', id);
  spaNavigate('snippets');
};


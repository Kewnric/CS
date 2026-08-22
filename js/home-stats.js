/* ============================================================
   HOME-STATS.JS — the dashboard's four stat cards
   ------------------------------------------------------------
   The row was four static numbers, two of which were dead ends: the streak
   said "0" with no way to see which days it counted, and the badge count said
   "3" with no way to see which three or what was close. The first two cards
   also only ever described the coding library, so a notebook-heavy week showed
   nothing here at all.

   Now: the first card cycles through the three libraries and the second
   follows it, the streak opens a calendar, and the badges open an overview.
   ============================================================ */

/** Every day with recorded activity, across all three libraries. */
function homeActivityByDay() {
  const counts = new Map();
  const add = (ts) => {
    if (!ts) return;
    const d = _toLocalDate(ts);
    counts.set(d, (counts.get(d) || 0) + 1);
  };
  (state.history || []).forEach(h => { if (!h.isArchived) add(h.submitTime || h.startTime); });
  (state.notebookHistory || []).forEach(h => { if (!h.isArchived) add(h.submitTime); });
  (state.snippetHistory || []).forEach(h => {
    if (h.isArchived) return;
    add(h.submitTime || Date.parse((h.date || '') + ' ' + (h.time || '')) || 0);
  });
  return counts;
}

/**
 * Consecutive days ending today. This counts all three libraries, so the
 * number agrees with the calendar the card opens — the old one read the coding
 * history alone, and a week of notebooks left it sitting at zero.
 */
function homeStreakAllLibraries() {
  const days = [...homeActivityByDay().keys()].sort().reverse();
  if (!days.length) return 0;
  const today = _toLocalDate(new Date());
  if (days[0] !== today) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i - 1]) - new Date(days[i])) / 86400000;
    if (diff === 1) streak++; else break;
  }
  return streak;
}

/* ── The cycling pair ─────────────────────────────────────── */

const HOME_STAT_LIBS = [
  {
    key: 'coding', label: 'Programs', icon: 'code', accent: 'var(--color-primary)',
    count: () => (state.challenges || []).length,
    best: () => {
      const l = (state.history || []).filter(h => !h.isArchived);
      return l.length ? Math.max(...l.map(h => h.score || 0)) : 0;
    }
  },
  {
    key: 'notebooks', label: 'Notebooks', icon: 'book-open', accent: 'var(--color-warning)',
    count: () => (state.notebooks || []).length,
    best: () => {
      let best = 0;
      (state.notebookHistory || []).forEach(h => {
        if (h.isArchived) return;
        let c = 0, t = 0;
        (h.sections || []).forEach(s => { c += s.correct || 0; t += s.total || 0; });
        if (t) best = Math.max(best, Math.round((c / t) * 100));
      });
      return best;
    }
  },
  {
    key: 'snippets', label: 'Snippets', icon: 'file-code', accent: 'var(--color-accent)',
    count: () => (state.snippets || []).length,
    best: () => {
      const l = (state.snippetHistory || []).filter(h => !h.isArchived);
      return l.length ? Math.max(...l.map(h => h.score || 0)) : 0;
    }
  }
];

let _homeStatLibIdx = 0;
let _homeStatTimer = null;

/** Paint the first two cards for whichever library is showing. */
function homeApplyStatLib(animate) {
  const lib = HOME_STAT_LIBS[_homeStatLibIdx];
  const card = document.getElementById('home-stat-lib');
  const bestCard = document.getElementById('home-stat-best');
  if (!card || !bestCard) return;

  const swap = (el, html) => {
    if (!el) return;
    if (!animate) { el.innerHTML = html; return; }
    el.classList.add('is-swapping');
    setTimeout(() => { el.innerHTML = html; el.classList.remove('is-swapping'); }, 180);
  };

  swap(card.querySelector('.stat-face'), `
    <div class="stat-icon" style="color:${lib.accent};"><i data-lucide="${lib.icon}"></i></div>
    <div class="stat-value">${lib.count()}</div>
    <div class="stat-label">${lib.label}</div>`);
  swap(bestCard.querySelector('.stat-face'), `
    <div class="stat-icon" style="color:${lib.accent};"><i data-lucide="target"></i></div>
    <div class="stat-value">${lib.best()}%</div>
    <div class="stat-label">Best · ${lib.label}</div>`);

  card.style.setProperty('--stat-accent', lib.accent);
  bestCard.style.setProperty('--stat-accent', lib.accent);
  setTimeout(() => {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ el: card });
      lucide.createIcons({ el: bestCard });
    }
  }, animate ? 190 : 0);
}

/** Step to the next library. Also what the dots and a click use. */
function homeCycleStatLib(idx) {
  _homeStatLibIdx = typeof idx === 'number' ? idx : (_homeStatLibIdx + 1) % HOME_STAT_LIBS.length;
  homeApplyStatLib(true);
  document.querySelectorAll('#home-stat-lib .stat-dot').forEach((d, i) => {
    d.classList.toggle('active', i === _homeStatLibIdx);
  });
}

function homeStartStatCycle() {
  homeStopStatCycle();
  // setInterval rather than rAF: a background tab never paints, and coming
  // back to a card frozen on whichever library it started on looks broken.
  _homeStatTimer = setInterval(() => homeCycleStatLib(), 4000);
}

function homeStopStatCycle() {
  if (_homeStatTimer) { clearInterval(_homeStatTimer); _homeStatTimer = null; }
}

/* ── Streak calendar ──────────────────────────────────────── */

let _homeCalYear = null;
let _homeCalMonth = null;

window.homeOpenStreakCalendar = function () {
  const now = new Date();
  _homeCalYear = now.getFullYear();
  _homeCalMonth = now.getMonth();
  let ov = document.getElementById('home-streak-modal');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'home-streak-modal';
    ov.className = 'modal-overlay';
    document.body.appendChild(ov);
  }
  ov.classList.remove('hidden');
  homeRenderStreakCalendar();
};

window.homeCloseStreakCalendar = function () {
  const ov = document.getElementById('home-streak-modal');
  if (ov) ov.classList.add('hidden');
};

window.homeCalShift = function (deltaMonths, deltaYears) {
  _homeCalMonth += (deltaMonths || 0);
  _homeCalYear += (deltaYears || 0);
  while (_homeCalMonth < 0) { _homeCalMonth += 12; _homeCalYear--; }
  while (_homeCalMonth > 11) { _homeCalMonth -= 12; _homeCalYear++; }
  homeRenderStreakCalendar();
};

function homeRenderStreakCalendar() {
  const ov = document.getElementById('home-streak-modal');
  if (!ov) return;
  const counts = homeActivityByDay();
  const y = _homeCalYear, m = _homeCalMonth;
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = first.getDay();
  const todayKey = _toLocalDate(new Date());

  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="hcal-cell empty"></div>';
  let monthActive = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = _toLocalDate(new Date(y, m, d));
    const n = counts.get(key) || 0;
    if (n) monthActive++;
    const level = n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : 3;
    cells += `
      <div class="hcal-cell${n ? ' active lvl-' + level : ''}${key === todayKey ? ' today' : ''}"
           title="${key}: ${n} attempt${n !== 1 ? 's' : ''}">
        <span class="hcal-day">${d}</span>
        ${n ? '<i data-lucide="flame" class="hcal-flame"></i>' : ''}
      </div>`;
  }

  const monthName = first.toLocaleString(undefined, { month: 'long' });
  ov.innerHTML = `
    <div class="modal-content hcal-modal" onclick="event.stopPropagation()">
      <div class="hcal-head">
        <div>
          <h2><i data-lucide="flame"></i> Practice streak</h2>
          <p>${homeStreakAllLibraries()} day streak · ${monthActive} active day${monthActive !== 1 ? 's' : ''} this month</p>
        </div>
        <button class="btn btn-ghost" onclick="homeCloseStreakCalendar()" aria-label="Close">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="hcal-nav">
        <button class="btn btn-ghost btn-sm" onclick="homeCalShift(0,-1)" title="Previous year"><i data-lucide="chevrons-left"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="homeCalShift(-1,0)" title="Previous month"><i data-lucide="chevron-left"></i></button>
        <span class="hcal-title">${monthName} ${y}</span>
        <button class="btn btn-ghost btn-sm" onclick="homeCalShift(1,0)" title="Next month"><i data-lucide="chevron-right"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="homeCalShift(0,1)" title="Next year"><i data-lucide="chevrons-right"></i></button>
      </div>
      <div class="hcal-grid hcal-dow">
        ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="hcal-dow-cell">${d}</div>`).join('')}
      </div>
      <div class="hcal-grid">${cells}</div>
      <p class="hcal-note">Counts attempts from every library — programs, notebooks and snippets.</p>
    </div>`;
  ov.onclick = () => homeCloseStreakCalendar();
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: ov });
}

/* ── Badge overview ───────────────────────────────────────── */

window.homeOpenBadges = function () {
  let ov = document.getElementById('home-badges-modal');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'home-badges-modal';
    ov.className = 'modal-overlay';
    document.body.appendChild(ov);
  }
  ov.classList.remove('hidden');

  // anBadgeState() already computes have/goal/earned for every badge; there is
  // no second definition of them here.
  const list = typeof anBadgeState === 'function' ? anBadgeState() : [];
  const earned = list.filter(b => b.earned);
  const inProgress = list.filter(b => !b.earned && b.have > 0);
  const locked = list.filter(b => !b.earned && !b.have);

  const card = (b) => `
    <div class="hbadge ${b.earned ? 'earned' : b.have ? 'partial' : 'locked'}">
      <div class="hbadge-ic"><i data-lucide="${b.earned ? b.icon : (b.have ? b.icon : 'lock')}"></i></div>
      <div class="hbadge-body">
        <div class="hbadge-name">${escapeHTML(b.name)}</div>
        <div class="hbadge-hint">${escapeHTML(b.hint)}</div>
        <div class="hbadge-bar"><span style="width:${b.earned ? 100 : b.pct}%"></span></div>
      </div>
      <div class="hbadge-count">${b.earned ? 'Earned' : b.have + '/' + b.goal}</div>
    </div>`;

  const section = (title, arr) => arr.length
    ? `<h3 class="hbadge-section">${title} <span>${arr.length}</span></h3>
       <div class="hbadge-list">${arr.map(card).join('')}</div>` : '';

  ov.innerHTML = `
    <div class="modal-content hbadge-modal" onclick="event.stopPropagation()">
      <div class="hcal-head">
        <div>
          <h2><i data-lucide="award"></i> Badges</h2>
          <p>${earned.length} of ${list.length} earned</p>
        </div>
        <button class="btn btn-ghost" onclick="homeCloseBadges()" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      ${list.length ? section('Earned', earned) + section('In progress', inProgress) + section('Locked', locked)
        : '<p class="hcal-note">No badges are defined yet.</p>'}
    </div>`;
  ov.onclick = () => homeCloseBadges();
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: ov });
};

window.homeCloseBadges = function () {
  const ov = document.getElementById('home-badges-modal');
  if (ov) ov.classList.add('hidden');
};

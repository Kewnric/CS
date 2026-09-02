/* ============================================================
   QUEST-BOARD.JS v3 — Quest Manager: data model, CRUD, form, timers
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let questState = {
  player: {
    level: 1,
    xp: 0,
    job: 'Shadow Monarch',
    title: 'None',
    totalCompleted: 0,
    streak: 0,
    bestStreak: 0,
    /* Spend one to survive a single missed day. Earned every 7 days of streak
       and capped, so they cannot be hoarded into immunity -- the streak has to
       stay worth something or breaking it means nothing. */
    freezes: 0,
    lastDailyCompleted: null
  },
  quests: [],
  activeTab: 'active',
  activeQuestId: null,
  isEditMode: false,
  isActionMode: false,
  lastLoginDate: new Date().toDateString(),
  sortMode: 'rank',
  search: '',
  showArchived: false,
  selectMode: false,
  selection: []
};

const QUEST_MAX_FREEZES = 3;
const QUEST_RECURRING = ['daily', 'weekly', 'monthly'];
function isRecurringQuest(q) { return QUEST_RECURRING.indexOf(q && q.type) !== -1; }

/**
 * The period a recurring quest belongs to, as a string that changes exactly
 * when the quest should come back.
 *
 * Comparing against a stored key rather than against "was the last login
 * yesterday" is what makes this survive being away: a weekly quest missed for
 * a month still resets once, on the next visit, instead of needing one visit
 * per period to catch up.
 */
function questPeriodKey(type, when) {
  const dt = when || new Date();
  if (type === 'daily') return dt.toDateString();
  if (type === 'monthly') return dt.getFullYear() + '-' + (dt.getMonth() + 1);
  if (type === 'weekly') {
    // ISO-8601 week: Thursday decides which year a boundary week belongs to.
    const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
    return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  }
  return null;                      // one-off: never resets
}

// ── Helpers ───────────────────────────────────────────────────
const XP_BASE = 100;
function getXPForNextLevel(level) {
  return Math.floor(XP_BASE * Math.pow(1.5, level - 1));
}

function getRankColor(rank) {
  const map = { E: '#94a3b8', D: '#22c55e', C: '#3b82f6', B: '#a855f7', A: '#f97316', S: '#ef4444' };
  return map[rank] || map['E'];
}

// ── Data Models ───────────────────────────────────────────────
function generateObjective() {
  return {
    id: generateId(),
    text: '',
    desc: '',
    done: false,
    expanded: true,
    timer: { durationMs: 0, elapsedMs: 0, date: null },
    /* Paid when the box is ticked, not only when the whole quest lands. A
       quest worth doing over a week gave nothing until the last item, which
       is the wrong shape for the thing it is meant to encourage. */
    xp: 0,
    xpClaimed: false,
    children: []
  };
}

function generateQuest() {
  return {
    id: generateId(),
    title: '',
    description: '',
    rank: 'E',
    type: 'main',
    xpReward: 50,
    reward: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    activatedAt: null,
    completedAt: null,
    objectives: [generateObjective()],
    penalties: [],
    xpClaimed: false,
    archived: false,
    lastResetKey: null
  };
}

// ── Migration ─────────────────────────────────────────────────
function migrateQuest(q) {
  if (!q.rank) q.rank = 'E';
  if (!q.type) q.type = 'main';
  if (q.xpReward === undefined) q.xpReward = 50;
  /* The ITEMS are migrated too, not just the key they live under.

     This used to run migrateChecklist only when `objectives` was absent, so a
     quest that already had the key but held older items -- no timer object at
     all, or the old {d,h,m,s} shape -- passed through untouched and then
     crashed the renderer on item.timer.durationMs. migrateChecklist keeps a
     well-formed timer as it is, so running it every time is idempotent and
     costs one pass over a list that is a handful of entries long. */
  if (!q.objectives) {
    q.objectives = q.checklist ? migrateChecklist(q.checklist) : [generateObjective()];
    delete q.checklist;
  } else {
    q.objectives = migrateChecklist(q.objectives);
  }
  if (!q.penalties) q.penalties = [];
  if (q.lastXPAwardDate === undefined) q.lastXPAwardDate = null;
  if (q.xpClaimed === undefined) q.xpClaimed = false;
  if (q.archived === undefined) q.archived = false;
  if (q.lastResetKey === undefined) q.lastResetKey = null;
  if (!q.activatedAt) q.activatedAt = q.ongoingAt || null;
  if (q.status === 'ongoing') q.status = 'active';
  if (q.status === 'penalty') q.status = 'active';
  return q;
}

function migrateChecklist(items) {
  return items.map(item => {
    let timer = { durationMs: 0, elapsedMs: 0, date: null };
    if (item.timer) {
      if (item.timer.durationMs !== undefined) {
        timer = item.timer;
      } else {
        const ms = ((item.timer.d || 0) * 86400 + (item.timer.h || 0) * 3600 + (item.timer.m || 0) * 60 + (item.timer.s || 0)) * 1000;
        timer = { durationMs: ms, elapsedMs: 0, date: item.timer.date || null };
      }
    }
    return {
      id: item.id || generateId(),
      text: item.text || '',
      desc: item.desc || '',
      done: item.done || false,
      expanded: item.expanded !== undefined ? item.expanded : true,
      timer,
      xp: Math.max(0, Math.min(1000, parseInt(item.xp) || 0)),
      xpClaimed: !!item.xpClaimed,
      children: item.children ? migrateChecklist(item.children) : []
    };
  });
}

// ── Persistence ───────────────────────────────────────────────
function loadQuestData() {
  try {
    const raw = localStorage.getItem(getQuestStorageKey())
      || localStorage.getItem('questBoardData_v2')
      || localStorage.getItem('questBoardData');
    if (raw) {
      const data = JSON.parse(raw);
      questState.quests = (data.quests || []).map(migrateQuest);
      if (data.player) questState.player = { ...questState.player, ...data.player };
      if (data.lastLoginDate) questState.lastLoginDate = data.lastLoginDate;
    }
  } catch (e) {
    console.error('Failed to load quest data:', e);
  }
  checkDailyReset();
}

function saveQuestData() {
  try {
    questState.lastLoginDate = new Date().toDateString();
    localStorage.setItem(getQuestStorageKey(), JSON.stringify({
      quests: questState.quests,
      player: questState.player,
      lastLoginDate: questState.lastLoginDate
    }));
  } catch (e) {
    console.error('Failed to save quest data:', e);
  }
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
  if (window.questHUD) window.questHUD.refresh();
}

/**
 * Bring the streak up to date with the calendar.
 *
 * It was only ever recomputed when a daily was COMPLETED, so a player who
 * stopped for a week still saw the number they left behind. A streak that
 * survives not doing the thing is not a streak; it is a high score with the
 * wrong label, and it is the one number on this screen that is supposed to
 * cost something to keep.
 *
 * Yesterday still counts -- today's daily may not be done yet, and breaking
 * the streak at midnight rather than at the end of the day would punish
 * anyone who works in the evening.
 */
function reconcileStreak() {
  const p = questState.player;
  if (!p.streak) return false;
  if (!p.lastDailyCompleted) { p.streak = 0; return true; }
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (p.lastDailyCompleted === today || p.lastDailyCompleted === yesterday) return false;

  /* Exactly one day missed, and a freeze in hand: spend it. The freeze stands
     in for the missing day, so the run continues rather than restarting -- one
     bad day should not undo a month. Two missed days is not a bad day, it is a
     stop, and no number of freezes covers it. */
  const dayBefore = new Date(Date.now() - 2 * 86400000).toDateString();
  if (p.lastDailyCompleted === dayBefore && (p.freezes | 0) > 0) {
    p.freezes--;
    p.lastDailyCompleted = yesterday;
    return 'frozen';
  }
  p.streak = 0;
  return true;
}

function checkDailyReset() { return checkRecurringResets(); }

/**
 * Bring every recurring quest into the current period, and the streak with it.
 *
 * Replaces a check that only knew about dailies and only fired when the stored
 * login date was not today. Each quest now remembers the period it was last
 * reset FOR, so weekly and monthly work, and any of them can be away for
 * several periods and still come back exactly once.
 */
function checkRecurringResets() {
  let resetCount = 0;
  const kinds = new Set();

  questState.quests.forEach(q => {
    if (!isRecurringQuest(q)) return;
    const key = questPeriodKey(q.type);
    if (!key || q.lastResetKey === key) return;
    /* First sight of a quest that predates this field: adopt the current
       period silently rather than wiping progress that is legitimately from
       today. */
    if (!q.lastResetKey) { q.lastResetKey = key; return; }
    q.status = 'pending';
    q.activatedAt = null;
    q.completedAt = null;
    resetObjectives(q.objectives || []);
    (q.penalties || []).forEach(p => { p.triggeredAt = null; p.completedAt = null; p.multiplier = 1; });
    q.lastResetKey = key;
    resetCount++;
    kinds.add(q.type);
  });

  const streakState = reconcileStreak();
  const dayChanged = questState.lastLoginDate !== new Date().toDateString();

  if (resetCount || streakState || dayChanged) {
    saveQuestData();
    if (resetCount || streakState) {
      const what = Array.from(kinds).join(' and ') || 'recurring';
      const msg = resetCount ? ('Your ' + what + ' quests have been reset.') : '';
      const streakMsg = streakState === 'frozen'
        ? ' Streak freeze used — ' + questState.player.freezes + ' left.'
        : (streakState ? ' Streak lost.' : '');
      if (typeof showSystemOverlay === 'function') {
        showSystemOverlay(streakState === 'frozen' ? 'STREAK FROZEN' : 'RESET',
                          (msg + streakMsg).trim(), []);
      }
    }
    if (typeof renderQuestList === 'function') renderQuestList();
    if (typeof renderPlayerStatus === 'function') renderPlayerStatus();
  }
  _scheduleMidnightReset();
}

/* The board is often left open overnight. Without this the reset waited for a
   reload, so the first thing after midnight was a stale board showing
   yesterday's ticks. Scheduled to the next boundary rather than polled. */
let _questMidnightTimer = null;
function _scheduleMidnightReset() {
  clearTimeout(_questMidnightTimer);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const ms = Math.max(1000, next - now);
  // setTimeout saturates past ~24.8 days; this is always under a day.
  _questMidnightTimer = setTimeout(() => { checkRecurringResets(); }, ms);
}

function resetObjectives(items) {
  items.forEach(item => {
    item.done = false;
    item.xpClaimed = false;          // a new run can earn the same XP again
    if (item.timer) {
      item.timer.elapsedMs = 0;
      item.timer.penaltyFired = false;
    }
    if (item.children) resetObjectives(item.children);
  });
}

function _markAllDone(items) {
  items.forEach(item => {
    item.done = true;
    if (item.children) _markAllDone(item.children);
  });
}

// ── Init ──────────────────────────────────────────────────────
function initQuestBoard() {
  _ensureSystemOverlay();
  const _withSuppress = (fn) => (typeof withCloudSaveSuppressed === 'function') ? withCloudSaveSuppressed(fn) : fn();
  _withSuppress(() => {
    loadQuestData();
    renderPlayerStatus();
    setQuestTab('active');
  });
  const questRoot = document.getElementById('quest-board-root') || document.getElementById('main-content');
  if (typeof lucide !== 'undefined') lucide.createIcons(questRoot ? { root: questRoot } : undefined);
  startGlobalCountdownLoop();
  attachQuestKeyboardShortcuts();
}

function attachQuestKeyboardShortcuts() {
  document.removeEventListener('keydown', _questKeyHandler);
  document.addEventListener('keydown', _questKeyHandler);
}

function _questKeyHandler(e) {
  if (!document.getElementById('quest-details-container')) return;
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    if (questState.isEditMode) saveEditMode();
  }
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    if (questState.isEditMode) saveAndActivateQuest();
  }
  if (e.key === 'Escape') {
    if (questState.isEditMode) cancelEditMode();
  }
}

// ── Player Status ─────────────────────────────────────────────
function renderPlayerStatus() {
  const p = questState.player;
  const needed = getXPForNextLevel(p.level);

  _setText('player-level-display', `Lv. ${p.level}`);
  _setText('player-job-display', p.job);
  _setText('player-xp-display', `${p.xp} / ${needed} XP`);

  const xpBar = document.getElementById('player-xp-bar');
  if (xpBar) xpBar.style.width = `${Math.min(100, Math.max(0, (p.xp / needed) * 100))}%`;

  const active = questState.quests.filter(q => q.status === 'active').length;
  const pending = questState.quests.filter(q => q.status === 'pending').length;
  const completed = questState.quests.filter(q => q.status === 'completed').length;
  const failed = questState.quests.filter(q => q.status === 'failed').length;

  ['active', 'pending', 'completed', 'failed'].forEach(s => {
    const el = document.getElementById(`stat-${s}`);
    if (el) {
      const span = el.querySelector('span');
      if (span) span.textContent = { active, pending, completed, failed }[s];
    }
  });

  const st = document.getElementById('stat-streak');
  if (st) {
    const span = st.querySelector('span');
    if (span) span.textContent = p.streak || 0;
    st.title = 'Daily streak' + (p.bestStreak ? ' — best ' + p.bestStreak : '');
    st.classList.toggle('is-hot', (p.streak || 0) >= 3);
  }
  const fz = document.getElementById('stat-freeze');
  if (fz) {
    const span = fz.querySelector('span');
    if (span) span.textContent = p.freezes || 0;
    fz.title = (p.freezes || 0) + ' streak freeze' + ((p.freezes || 0) === 1 ? '' : 's')
             + ' — each covers one missed day. Earned every 7 days of streak.';
  }

  updateQuestTabBadges();
  const playerPanel = document.getElementById('quest-player-panel') || document.getElementById('quest-board-root');
  if (typeof lucide !== 'undefined') lucide.createIcons(playerPanel ? { root: playerPanel } : undefined);
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function updateQuestTabBadges() {
  const counts = {
    active: questState.quests.filter(q => q.status === 'active').length,
    pending: questState.quests.filter(q => q.status === 'pending').length,
    completed: questState.quests.filter(q => q.status === 'completed').length,
    failed: questState.quests.filter(q => q.status === 'failed').length
  };
  Object.entries(counts).forEach(([tab, count]) => {
    const badge = document.getElementById(`badge-${tab}`);
    if (badge) {
      badge.textContent = count || '';
      badge.style.display = count ? '' : 'none';
    }
  });
}

function addXP(amount) {
  questState.player.xp += parseInt(amount) || 0;
  let needed = getXPForNextLevel(questState.player.level);
  let leveledUp = false;
  while (questState.player.xp >= needed) {
    questState.player.xp -= needed;
    questState.player.level++;
    leveledUp = true;
    needed = getXPForNextLevel(questState.player.level);
  }
  // Negative XP (penalties): de-level until non-negative; floor at Lv.1 / 0 XP.
  while (questState.player.xp < 0 && questState.player.level > 1) {
    questState.player.level--;
    questState.player.xp += getXPForNextLevel(questState.player.level);
  }
  if (questState.player.xp < 0) questState.player.xp = 0;
  saveQuestData();
  renderPlayerStatus();
  return leveledUp;
}

// ── Sort ──────────────────────────────────────────────────────
/* ── Archive, duplicate, bulk ────────────────────────────────
   Everything here works on ids rather than on the current selection, so the
   same function serves a single quest and a multi-select. */

function setQuestArchived(id, on) {
  const q = questState.quests.find(x => x.id === id);
  if (!q) return;
  q.archived = !!on;
  saveQuestData();
  renderQuestList();
  renderQuestDetails();
}

function toggleShowArchived() {
  questState.showArchived = !questState.showArchived;
  renderQuestList();
}

/** Archive every completed quest at once -- the usual reason to archive. */
function archiveAllCompleted() {
  const todo = questState.quests.filter(q => q.status === 'completed' && !q.archived);
  if (!todo.length) {
    if (typeof toast === 'function') toast('Nothing to archive.', { type: 'info', duration: 1800 });
    return;
  }
  todo.forEach(q => { q.archived = true; });
  saveQuestData();
  renderQuestList();
  if (typeof pushUndo === 'function') {
    pushUndo('Archived ' + todo.length + ' quest' + (todo.length === 1 ? '' : 's'), () => {
      todo.forEach(q => { q.archived = false; });
      saveQuestData(); renderQuestList();
    });
  }
}

/**
 * Copy a quest, structure and all.
 *
 * Every id is regenerated -- ids address objectives for ticking and for
 * penalties, so a copy that shared them would tick two quests at once. The
 * copy starts pending and unclaimed: it is a new run, not a finished one.
 */
function duplicateQuest(id) {
  const src = questState.quests.find(x => x.id === (id || questState.activeQuestId));
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  const reid = items => (items || []).forEach(it => {
    it.id = generateId();
    it.done = false;
    it.xpClaimed = false;
    if (it.timer) it.timer.elapsedMs = 0;
    reid(it.children);
  });
  copy.id = generateId();
  copy.title = (src.title || 'Untitled') + ' (copy)';
  copy.status = 'pending';
  copy.createdAt = new Date().toISOString();
  copy.activatedAt = null;
  copy.completedAt = null;
  copy.archived = false;
  copy.xpClaimed = false;
  copy.lastXPAwardDate = null;
  copy.lastResetKey = null;
  reid(copy.objectives);
  (copy.penalties || []).forEach(pn => { pn.triggeredAt = null; pn.completedAt = null; pn.multiplier = 1; });
  questState.quests.push(copy);
  questState.activeQuestId = copy.id;
  saveQuestData();
  setQuestTab('pending');
  renderQuestDetails();
  if (typeof toast === 'function') toast('Duplicated as "' + copy.title + '"', { type: 'success', duration: 2200 });
}

/* ── Multi-select ──────────────────────────────────────────── */

function toggleQuestSelectMode() {
  questState.selectMode = !questState.selectMode;
  questState.selection = [];
  renderQuestList();
}

function toggleQuestSelected(id, ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const at = questState.selection.indexOf(id);
  if (at === -1) questState.selection.push(id); else questState.selection.splice(at, 1);
  renderQuestList();
}

function selectAllVisibleQuests() {
  const ids = Array.from(document.querySelectorAll('[data-quest-id]'))
    .map(el => el.getAttribute('data-quest-id'));
  const all = ids.every(id => questState.selection.indexOf(id) !== -1);
  questState.selection = all ? [] : ids;
  renderQuestList();
}

function bulkQuestAction(what) {
  const ids = (questState.selection || []).slice();
  if (!ids.length) return;
  const picked = questState.quests.filter(q => ids.indexOf(q.id) !== -1);

  if (what === 'delete') {
    const snapshot = JSON.parse(JSON.stringify(picked));
    showConfirm('Delete ' + ids.length + ' quest' + (ids.length === 1 ? '' : 's'),
      'This can be undone from the toast that follows.', () => {
        questState.quests = questState.quests.filter(q => ids.indexOf(q.id) === -1);
        questState.selection = [];
        saveQuestData(); renderQuestList(); renderQuestDetails();
        if (typeof pushUndo === 'function') {
          pushUndo('Deleted ' + snapshot.length + ' quests', () => {
            questState.quests = questState.quests.concat(snapshot);
            saveQuestData(); renderQuestList();
          });
        }
      });
    return;
  }

  /* Bulk complete deliberately does NOT pay XP. Reward follows doing the work
     one quest at a time; a button that hands out a level for selecting a list
     would make every other number on this screen meaningless. */
  picked.forEach(q => {
    if (what === 'archive') q.archived = true;
    else if (what === 'unarchive') q.archived = false;
    else if (what === 'complete') {
      q.status = 'completed';
      q.completedAt = new Date().toISOString();
      _markAllDone(q.objectives || []);
    } else if (what === 'pending') {
      q.status = 'pending';
      q.activatedAt = null;
      q.completedAt = null;
    }
  });
  questState.selection = [];
  saveQuestData();
  renderQuestList();
  if (typeof toast === 'function') {
    toast(picked.length + ' quest' + (picked.length === 1 ? '' : 's') + ' updated'
          + (what === 'complete' ? ' (no XP for bulk completion)' : ''),
          { type: 'info', duration: 2600 });
  }
}

function toggleQuestSort() {
  const modes = ['rank', 'newest', 'deadline'];
  const cur = modes.indexOf(questState.sortMode);
  questState.sortMode = modes[(cur + 1) % modes.length];
  const btn = document.getElementById('quest-sort-btn');
  if (btn) btn.title = `Sort: ${questState.sortMode}`;
  renderQuestList();
}

// ── Tabs ──────────────────────────────────────────────────────
function setQuestTab(tabName) {
  questState.activeTab = tabName;
  document.querySelectorAll('.quest-tab').forEach(el => el.classList.remove('active'));
  const activeTabEl = document.getElementById(`tab-${tabName}`);
  if (activeTabEl) activeTabEl.classList.add('active');
  renderQuestList();
}

// ── List Render ───────────────────────────────────────────────
function renderQuestList() {
  const container = document.getElementById('quest-list-container');
  if (!container) return;

  /* The box is rebuilt with the panel, so reading it is only right while it
     is on screen. The query lives in state and the field is refilled from it,
     which is what makes a search survive switching tabs. */
  const searchEl = document.getElementById('quest-search-input');
  if (searchEl) {
    if (document.activeElement === searchEl) questState.search = searchEl.value;
    else if (searchEl.value !== (questState.search || '')) searchEl.value = questState.search || '';
  }
  const query = String(questState.search || '').trim().toLowerCase();

  let filtered = questState.quests.filter(q => q.status === questState.activeTab);

  /* Done fills up and never empties, and an old finished quest is not a task
     any more -- it is a record. Archiving keeps it without letting it crowd
     the list, and nothing is ever deleted for you. */
  if (questState.activeTab === 'completed' && !questState.showArchived) {
    filtered = filtered.filter(q => !q.archived);
  }

  if (query) {
    filtered = filtered.filter(q =>
      (q.title || '').toLowerCase().includes(query) ||
      (q.description || '').toLowerCase().includes(query)
    );
  }

  _renderQuestBulkBar();

  const rankOrder = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5 };
  if (questState.sortMode === 'rank') {
    filtered.sort((a, b) => (rankOrder[a.rank] ?? 5) - (rankOrder[b.rank] ?? 5));
  } else if (questState.sortMode === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else if (questState.sortMode === 'deadline') {
    filtered.sort((a, b) => {
      const aD = _getQuestEarliestDeadline(a), bD = _getQuestEarliestDeadline(b);
      if (!aD && !bD) return 0;
      if (!aD) return 1;
      if (!bD) return -1;
      return aD - bD;
    });
  }

  if (filtered.length === 0) {
    const msgs = { active: 'No active quests.', pending: 'No pending quests.', completed: 'No completed quests.', failed: 'No failed quests.' };
    container.innerHTML = `<div class="quest-list-empty">
      <i data-lucide="${questState.activeTab === 'completed' ? 'check-circle-2' : questState.activeTab === 'failed' ? 'skull' : 'scroll-text'}"></i>
      <p>${query ? `No quests matching "${escapeHTML(query)}"` : msgs[questState.activeTab]}</p>
      ${questState.activeTab === 'pending' && !query ? `<button class="btn-system" style="margin-top:1rem;padding:0.5rem 1.25rem;font-size:0.8rem;" onclick="createNewQuest()">CREATE QUEST</button>` : ''}
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: container });
    updateQuestTabBadges();
    return;
  }

  let html = '';
  for (const q of filtered) {
    const isActive = q.id === questState.activeQuestId;
    const progress = _getQuestProgress(q);
    const pendingPenalties = (q.penalties || []).filter(p => !p.completedAt).length;
    const hasDeadline = _getQuestEarliestDeadline(q);

    html += `
      <div class="quest-card${isActive ? ' active' : ''}${q.archived ? ' is-archived' : ''} rank-accent-${q.rank}"
           data-quest-id="${q.id}"
           onclick="${questState.selectMode ? `toggleQuestSelected('${q.id}', event)` : `selectQuest('${q.id}')`}">
        <div class="quest-card-header">
          ${questState.selectMode ? `<span class="quest-select-box${(questState.selection||[]).indexOf(q.id) !== -1 ? ' is-on' : ''}">${(questState.selection||[]).indexOf(q.id) !== -1 ? '✓' : ''}</span>` : ''}
          <span class="rank-badge rank-${q.rank}">${q.rank}</span>
          <div class="quest-card-title">${escapeHTML(q.title) || 'Untitled Quest'}</div>
          <div class="quest-card-badges">
            ${q.type !== 'main' ? `<span class="quest-type-badge type-${q.type}">${q.type}</span>` : ''}
            ${pendingPenalties > 0 ? `<span class="quest-penalty-chip"><i data-lucide="skull" style="width:9px;height:9px;display:inline;vertical-align:-1px;"></i> ${pendingPenalties}</span>` : ''}
            ${hasDeadline ? `<span class="quest-deadline-chip" title="Has deadline"><i data-lucide="timer" style="width:10px;height:10px;display:inline;vertical-align:-1px;"></i></span>` : ''}
          </div>
        </div>
        ${q.description ? `<div class="quest-card-desc">${escapeHTML(q.description)}</div>` : ''}
        ${progress.total > 0 ? `
          <div class="quest-card-progress">
            <div class="quest-progress-bar" style="--prog:${progress.pct}%;--rank-color:${getRankColor(q.rank)};"></div>
            <span class="quest-progress-label">${progress.done}/${progress.total}</span>
          </div>
        ` : ''}
      </div>
    `;
  }
  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: container });
  updateQuestTabBadges();
}

/* The strip above the tabs. It carries two unrelated things that both only
   make sense in context: what to do with a multi-selection, and whether the
   Done tab is hiding archived quests. Neither is worth permanent chrome. */
function _renderQuestBulkBar() {
  const host = document.getElementById('quest-bulk-bar');
  if (!host) return;
  const sel = (questState.selection || []).length;
  const archivedCount = questState.quests.filter(q => q.status === 'completed' && q.archived).length;
  let html = '';

  if (questState.selectMode) {
    html += '<div class="quest-bulk-strip">'
         +  '<button class="quest-bulk-btn" onclick="selectAllVisibleQuests()">'
         +  (sel ? 'Clear' : 'Select all') + '</button>'
         +  '<span class="quest-bulk-count">' + sel + ' selected</span>';
    if (sel) {
      html += '<button class="quest-bulk-btn" onclick="bulkQuestAction(\'complete\')">Complete</button>'
           +  '<button class="quest-bulk-btn" onclick="bulkQuestAction(\'pending\')">To pending</button>'
           +  '<button class="quest-bulk-btn" onclick="bulkQuestAction(\'archive\')">Archive</button>'
           +  '<button class="quest-bulk-btn danger" onclick="bulkQuestAction(\'delete\')">Delete</button>';
    }
    html += '<button class="quest-bulk-btn" onclick="toggleQuestSelectMode()">Done</button></div>';
  }

  if (questState.activeTab === 'completed' && (archivedCount || questState.showArchived)) {
    html += '<div class="quest-bulk-strip subtle">'
         +  '<button class="quest-bulk-btn" onclick="toggleShowArchived()">'
         +  (questState.showArchived ? 'Hide' : 'Show') + ' archived (' + archivedCount + ')</button>'
         +  '<button class="quest-bulk-btn" onclick="archiveAllCompleted()">Archive all done</button>'
         +  '</div>';
  } else if (questState.activeTab === 'completed') {
    html += '<div class="quest-bulk-strip subtle">'
         +  '<button class="quest-bulk-btn" onclick="archiveAllCompleted()">Archive all done</button></div>';
  }

  host.innerHTML = html;
}

function _getQuestProgress(q) {
  let total = 0, done = 0;
  function count(items) {
    items.forEach(it => {
      if (!it.children || it.children.length === 0) { total++; if (it.done) done++; }
      else count(it.children);
    });
  }
  count(q.objectives || []);
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function _getQuestEarliestDeadline(q) {
  if (q.status !== 'active') return null;
  let earliest = null;
  function scan(items) {
    items.forEach(it => {
      if (it.timer) {
        const d = it.timer.date ? new Date(it.timer.date).getTime() : null;
        if (d && (!earliest || d < earliest)) earliest = d;
      }
      if (it.children) scan(it.children);
    });
  }
  scan(q.objectives || []);
  return earliest;
}

// ── Select / CRUD ─────────────────────────────────────────────
function selectQuest(questId) {
  questState.activeQuestId = questId;
  questState.isEditMode = false;
  questState.isActionMode = false;
  renderQuestList();
  renderQuestDetails();
}

function toggleActionMode() {
  questState.isActionMode = !questState.isActionMode;
  renderQuestDetails();
}

function createNewQuest() {
  const q = generateQuest();
  questState.quests.push(q);
  saveQuestData();
  questState.activeTab = 'pending';
  setQuestTab('pending');
  questState.activeQuestId = q.id;
  questState.isEditMode = true;
  renderQuestDetails();
  // Auto-focus title after render
  setTimeout(() => {
    const titleInput = document.getElementById('qf-title');
    if (titleInput) { titleInput.focus(); titleInput.select(); }
  }, 50);
}

function enterEditMode() {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  if (q.status === 'active') {
    showConfirm('Edit Active Quest', 'Editing will pause the quest and save elapsed time. Continue?', () => {
      pauseQuestTimers(q);
      q.status = 'pending';
      q.activatedAt = null;
      saveQuestData();
      setQuestTab('pending');
      questState.isEditMode = true;
      renderQuestDetails();
    });
  } else {
    questState.isEditMode = true;
    renderQuestDetails();
    setTimeout(() => {
      const titleInput = document.getElementById('qf-title');
      if (titleInput) { titleInput.focus(); titleInput.select(); }
    }, 50);
  }
}

function cancelEditMode() {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  // If quest is brand new (empty title), delete it
  if (!q.title.trim()) {
    questState.quests = questState.quests.filter(x => x.id !== q.id);
    questState.activeQuestId = null;
    saveQuestData();
    renderQuestList();
    renderQuestDetails();
    return;
  }
  questState.isEditMode = false;
  renderQuestDetails();
}

function saveEditMode() {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (q) {
    // Collect form values
    _collectFormValues(q);
    updateParentStatuses(q.objectives);
  }
  saveQuestData();
  questState.isEditMode = false;
  renderQuestDetails();
  renderQuestList();
}

function saveAndActivateQuest() {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  _collectFormValues(q);
  updateParentStatuses(q.objectives);
  q.status = 'active';
  q.activatedAt = new Date().toISOString();
  q.completedAt = null;
  saveQuestData();
  questState.isEditMode = false;
  setQuestTab('active');
  renderQuestDetails();
}

function _collectFormValues(q) {
  const get = id => { const el = document.getElementById(id); return el ? el.value : null; };
  const title = get('qf-title');
  const desc = get('qf-desc');
  const rank = get('qf-rank');
  const type = get('qf-type');
  const xp = get('qf-xp');
  const reward = get('qf-reward');
  if (title !== null) q.title = title.trim();
  if (desc !== null) q.description = desc.trim();
  if (rank !== null) q.rank = rank;
  if (type !== null) q.type = type;
  /* Clamped. The field took anything, so a typo of 999999 in a box next to
     50 jumped the player from Lv.1 to Lv.22 in one click and there is no way
     back down -- levels only fall to penalties, and none of them are that
     large. 10,000 is far above any real reward and still recoverable. */
  if (xp !== null) q.xpReward = Math.max(0, Math.min(10000, parseInt(xp) || 0));
  if (reward !== null) q.reward = reward.trim();
}

function deleteActiveQuest() {
  const id = questState.activeQuestId;
  const at = questState.quests.findIndex(q => q.id === id);
  if (at === -1) return;
  const snapshot = JSON.parse(JSON.stringify(questState.quests[at]));
  showConfirm('Delete Quest', 'Delete this quest? You can undo it from the toast that follows.', () => {
    questState.quests.splice(at, 1);
    questState.activeQuestId = null;
    saveQuestData();
    renderQuestList();
    renderQuestDetails();
    // A quest carries its whole checklist and timers with it, so losing one to
    // a misclick cost more than any other delete that already had an undo.
    if (typeof pushUndo === 'function') {
      pushUndo('Deleted quest "' + (snapshot.title || 'Untitled') + '"', () => {
        questState.quests.splice(Math.min(at, questState.quests.length), 0, snapshot);
        questState.activeQuestId = snapshot.id;
        saveQuestData();
        renderQuestList();
        renderQuestDetails();
      });
    }
  });
}

function updateQuestField(field, value) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (q) q[field] = value;
}

// ── Status Transitions ────────────────────────────────────────
function setQuestStatus(status) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q || q.status === status) return;

  if (status === 'active') {
    q.activatedAt = new Date().toISOString();
    q.completedAt = null;
  } else if (status === 'completed') {
    q.completedAt = new Date().toISOString();
    // Mark all objectives as done when manually completing
    _markAllDone(q.objectives || []);
    completeQuest(q);
  } else if (status === 'pending') {
    if (q.status === 'completed' || q.status === 'failed') {
      // Full restart: reset all checkboxes and timers
      resetObjectives(q.objectives || []);
      // Also reset penalty pool so they can re-trigger on the next run
      (q.penalties || []).forEach(p => {
        p.triggeredAt = null;
        p.completedAt = null;
        p.multiplier = 1;
      });
    } else {
      // Pausing from active: preserve elapsed timer progress
      pauseQuestTimers(q);
    }
    q.activatedAt = null;
    q.completedAt = null;
  } else if (status === 'failed') {
    q.completedAt = new Date().toISOString();
  }

  q.status = status;
  questState.isActionMode = false;
  saveQuestData();
  setQuestTab(status);
  renderQuestDetails();
}

function pauseQuestTimers(q) {
  if (!q.activatedAt) return;
  const elapsed = Date.now() - new Date(q.activatedAt).getTime();
  const addElapsed = (items) => {
    items.forEach(item => {
      if (item.timer && item.timer.durationMs > 0 && !item.done) {
        item.timer.elapsedMs = (item.timer.elapsedMs || 0) + elapsed;
      }
      if (item.children) addElapsed(item.children);
    });
  };
  addElapsed(q.objectives || []);
}

function completeQuest(q) {
  questState.player.totalCompleted = (questState.player.totalCompleted || 0) + 1;
  const today = new Date().toDateString();
  if (q.type === 'daily') {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (questState.player.lastDailyCompleted !== today) {
      questState.player.streak = (questState.player.lastDailyCompleted === yesterday)
        ? (questState.player.streak || 0) + 1
        : 1;
      questState.player.lastDailyCompleted = today;
      const p = questState.player;
      if (p.streak > (p.bestStreak || 0)) p.bestStreak = p.streak;
      // One freeze per full week of streak, capped.
      if (p.streak % 7 === 0 && (p.freezes | 0) < QUEST_MAX_FREEZES) p.freezes = (p.freezes | 0) + 1;
    }
  }

  // ── XP mechanics ──
  let xpAward = q.xpReward;
  const rewards = [];

  /* Anti-farm. A daily pays once per calendar day; everything else pays once,
     full stop.

     The guard only covered dailies, so a Main quest could be completed,
     restarted and completed again for its full reward every time -- measured
     at 150 XP from three passes over one 50 XP quest, which makes levelling a
     matter of clicking rather than of doing. Main, Side and Hidden quests are
     one-off tasks; finishing one twice is the same finish, not a second one. */
  if (q.type === 'daily') {
    if (q.lastXPAwardDate === today) {
      xpAward = 0;
      rewards.push('Daily XP already claimed today');
    }
  } else if (q.xpClaimed) {
    xpAward = 0;
    rewards.push('XP already claimed for this quest');
  }

  // Unresolved triggered penalties halve the reward — clear them first for full XP.
  const unresolved = (q.penalties || []).filter(p => p.triggeredAt && !p.completedAt).length;
  if (unresolved > 0 && xpAward > 0) {
    xpAward = Math.floor(xpAward / 2);
    rewards.push(`XP halved — ${unresolved} unresolved penalt${unresolved > 1 ? 'ies' : 'y'}`);
  }

  if (xpAward > 0) {
    q.lastXPAwardDate = today;
    if (q.type !== 'daily') q.xpClaimed = true;
  }
  const leveledUp = addXP(xpAward);
  rewards.unshift(`+${xpAward} XP`);
  if (q.reward) rewards.push(q.reward);
  if (questState.player.streak > 1) rewards.push(`${questState.player.streak}-Day Streak!`);
  showSystemOverlay(leveledUp ? 'LEVEL UP!' : 'QUEST COMPLETED', `You completed: ${q.title}`, rewards, leveledUp);
}

// ── Details Render ────────────────────────────────────────────
function renderQuestDetails() {
  const container = document.getElementById('quest-details-container');
  if (!container) return;
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) {
    container.innerHTML = `
      <div class="quest-empty-state">
        <div class="quest-empty-icon"><i data-lucide="target"></i></div>
        <h2>SYSTEM STANDBY</h2>
        <p>Select a quest or create a new one to begin.</p>
        <button class="btn-system" onclick="createNewQuest()" style="margin-top:1.5rem;">
          <i data-lucide="plus" style="width:16px;height:16px;display:inline;vertical-align:-3px;margin-right:6px;"></i>NEW QUEST
        </button>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: container });
    return;
  }
  container.innerHTML = questState.isEditMode ? renderEditForm(q) : renderViewLayout(q);
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: container });
}

// ── View Mode ─────────────────────────────────────────────────
function renderViewLayout(q) {
  const progress = _getQuestProgress(q);
  const rankColor = getRankColor(q.rank);
  const isActive = q.status === 'active';
  const pendingPenalties = (q.penalties || []).filter(p => !p.completedAt).length;

  const progressRing = progress.total > 0 ? `
    <div class="quest-progress-ring" style="--rank-color:${rankColor};">
      <svg viewBox="0 0 36 36">
        <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        <path class="ring-fill" stroke-dasharray="${progress.pct}, 100" style="stroke:${rankColor};" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
      </svg>
      <span class="ring-text">${progress.pct}%</span>
    </div>` : '';

  let actionBar = '';
  if (q.status === 'pending') {
    actionBar = `<div class="quest-action-bar">
      <button class="btn-system" onclick="setQuestStatus('active')" style="flex:1;">
        <i data-lucide="swords" style="width:16px;height:16px;display:inline;vertical-align:-3px;margin-right:6px;"></i>ACCEPT QUEST
      </button>
    </div>`;
  } else if (isActive) {
    actionBar = `<div class="quest-action-bar">
      <button class="btn-system ${questState.isActionMode ? 'active-mode' : ''}" onclick="toggleActionMode()" style="flex:1;"
        title="${questState.isActionMode ? 'Lock checkboxes to prevent accidental changes' : 'Unlock checkboxes to mark objectives complete'}">
        <i data-lucide="${questState.isActionMode ? 'eye-off' : 'crosshair'}" style="width:16px;height:16px;display:inline;vertical-align:-3px;margin-right:6px;"></i>
        ${questState.isActionMode ? 'LOCK OBJECTIVES' : 'ENGAGE MISSION'}
      </button>
      <button class="btn-system" onclick="setQuestStatus('pending')" style="border-color:#64748b;color:#94a3b8;padding:0.6rem 1rem;" title="Pause quest">
        <i data-lucide="pause" style="width:16px;height:16px;"></i>
      </button>
      <button class="btn-system" onclick="setQuestStatus('completed')" style="border-color:#10b981;color:#10b981;padding:0.6rem 1rem;" title="Complete quest">
        <i data-lucide="check-circle-2" style="width:16px;height:16px;"></i>
      </button>
      <button class="btn-system" onclick="setQuestStatus('failed')" style="border-color:#ef4444;color:#ef4444;padding:0.6rem 1rem;" title="Fail quest">
        <i data-lucide="skull" style="width:16px;height:16px;"></i>
      </button>
    </div>`;
  } else if (q.status === 'completed' || q.status === 'failed') {
    actionBar = `<div class="quest-action-bar">
      <button class="btn-system" onclick="setQuestStatus('pending')" style="border-color:#64748b;color:#94a3b8;flex:1;">
        <i data-lucide="rotate-ccw" style="width:16px;height:16px;display:inline;vertical-align:-3px;margin-right:6px;"></i>RESTART
      </button>
    </div>`;
  }

  return `
    <div class="quest-detail-header">
      <div class="quest-detail-meta">
        <div class="quest-detail-badges">
          <span class="rank-badge rank-${q.rank}">${q.rank}</span>
          <span class="quest-type-badge type-${q.type}">${q.type}</span>
          <span class="quest-xp-chip"><i data-lucide="zap" style="width:11px;height:11px;display:inline;vertical-align:-1px;"></i> ${q.xpReward} XP</span>
          ${pendingPenalties > 0 ? `<button class="quest-penalty-chip interactive" onclick="if(window.questPenalty)window.questPenalty.openWindow()">
            <i data-lucide="skull" style="width:10px;height:10px;display:inline;vertical-align:-1px;"></i> ${pendingPenalties} Penalty${pendingPenalties > 1 ? 's' : ''}
          </button>` : ''}
        </div>
        <h2 class="quest-detail-title">${escapeHTML(q.title) || 'Untitled Quest'}</h2>
        ${q.description ? `<p class="quest-detail-desc">${escapeHTML(q.description)}</p>` : ''}
      </div>
      <div class="quest-detail-actions">
        ${progressRing}
        <div class="quest-detail-btns">
          <button class="quest-icon-btn" onclick="enterEditMode()" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="quest-icon-btn" onclick="duplicateQuest()" title="Duplicate — a fresh copy, ids and ticks reset"><i data-lucide="copy"></i></button>
          ${q.status === 'completed' ? `<button class="quest-icon-btn" onclick="setQuestArchived('${q.id}', ${!q.archived})" title="${q.archived ? 'Unarchive' : 'Archive — keeps it, out of the Done list'}"><i data-lucide="${q.archived ? 'archive-restore' : 'archive'}"></i></button>` : ''}
          <button class="quest-icon-btn danger" onclick="deleteActiveQuest()" title="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    </div>

    <div class="quest-objectives-header">
      <h3 class="quest-section-title"><i data-lucide="list-checks"></i> OBJECTIVES</h3>
      ${isActive ? `<span class="quest-progress-text">${progress.done} / ${progress.total} complete</span>` : ''}
    </div>

    <div class="cl-tree-container" style="margin-bottom:1.5rem; flex:1; overflow-y:auto;">
      ${(q.objectives || []).length === 0
        ? `<div class="quest-no-objectives">No objectives defined.</div>`
        : renderObjectivesView(q.objectives, q)}
    </div>

    ${q.reward ? `<div class="quest-reward-row">
      <div class="system-reward-box">
        <i data-lucide="award"></i>
        <div><div class="rbox-label">REWARD</div><div class="rbox-value">${escapeHTML(q.reward)}</div></div>
      </div>
    </div>` : ''}

    ${actionBar}
  `;
}

// ── Objectives View ───────────────────────────────────────────
function renderObjectivesView(items, quest, level = 0) {
  let html = '';
  const isInteractive = quest.status === 'active';

  for (const item of items) {
    const hasChildren = item.children && item.children.length > 0;
    const isLeaf = !hasChildren;
    const canCheck = isInteractive && isLeaf && questState.isActionMode;

    const expandIcon = hasChildren
      ? `<i data-lucide="${item.expanded ? 'chevron-down' : 'chevron-right'}" class="cl-expander" onclick="event.stopPropagation();toggleExpand('${item.id}')"></i>`
      : `<span style="width:18px;display:inline-block;flex-shrink:0;"></span>`;

    let checkHTML = '';
    if (!isLeaf) {
      checkHTML = item.done
        ? `<i data-lucide="check-circle-2" style="color:#10b981;width:20px;height:20px;margin-top:2px;flex-shrink:0;filter:drop-shadow(0 0 6px rgba(16,185,129,0.8));"></i>`
        : `<i data-lucide="circle-alert" style="color:#fbbf24;width:20px;height:20px;margin-top:2px;flex-shrink:0;filter:drop-shadow(0 0 6px rgba(251,191,36,0.8));"></i>`;
    } else {
      checkHTML = `
        <label class="quest-checkbox-label ${canCheck ? 'clickable' : ''}" style="margin-top:2px;" ${canCheck ? `onclick="event.preventDefault();toggleItemDone('${item.id}')"` : ''}>
          <input type="checkbox" ${item.done ? 'checked' : ''} ${canCheck ? '' : 'disabled'} />
          <span class="quest-checkbox-custom"></span>
        </label>`;
    }

    html += `
      <div class="cl-item-row ${item.done ? 'done' : ''}">
        <div class="cl-item-main">
          ${expandIcon}
          ${checkHTML}
          <div class="cl-item-content">
            <div class="cl-item-title">${escapeHTML(item.text) || 'Unnamed Objective'}</div>
            ${item.desc ? `<div class="cl-item-desc">${escapeHTML(item.desc)}</div>` : ''}
          </div>
          ${getTimerDisplayHTML(item, quest)}
        </div>
      </div>`;

    if (hasChildren && item.expanded) {
      html += `<div class="cl-children">${renderObjectivesView(item.children, quest, level + 1)}</div>`;
    }
  }
  return html;
}

// ── Edit Form ─────────────────────────────────────────────────
function renderEditForm(q) {
  return `
    <div class="quest-edit-form">
      <div class="qef-header">
        <h2 class="quest-detail-title" style="margin:0;">${q.title ? 'EDIT QUEST' : 'NEW QUEST'}</h2>
        <div class="qef-header-actions">
          <span class="qef-shortcut-hint">Ctrl+S to save · Ctrl+Enter to save & activate</span>
          <button class="quest-icon-btn" onclick="cancelEditMode()" title="Cancel (Escape)"><i data-lucide="x"></i></button>
        </div>
      </div>

      <div class="qef-fields">
        <div class="qef-field">
          <label class="quest-meta-label" for="qf-title">Quest Title</label>
          <input type="text" id="qf-title" class="system-input qef-title-input"
            value="${escapeHTML(q.title)}" placeholder="Name this quest..."
            oninput="updateQuestField('title', this.value)"
            onkeydown="if(event.key==='Tab'||event.key==='Enter'){event.preventDefault();document.getElementById('qf-desc')?.focus();}" />
        </div>

        <div class="qef-field">
          <label class="quest-meta-label" for="qf-desc">Description</label>
          <textarea id="qf-desc" class="system-input qef-textarea"
            placeholder="Describe the mission..."
            oninput="updateQuestField('description', this.value)"
            rows="2">${escapeHTML(q.description)}</textarea>
        </div>

        <div class="qef-row">
          <div class="qef-field qef-field-sm">
            <label class="quest-meta-label" for="qf-rank">Rank</label>
            <select id="qf-rank" class="system-input" onchange="updateQuestField('rank', this.value)">
              ${['E', 'D', 'C', 'B', 'A', 'S'].map(r => `<option value="${r}" ${q.rank === r ? 'selected' : ''}>Rank ${r}</option>`).join('')}
            </select>
          </div>
          <div class="qef-field qef-field-sm">
            <label class="quest-meta-label" for="qf-type">Type</label>
            <select id="qf-type" class="system-input" onchange="updateQuestField('type', this.value)">
              <option value="main" ${q.type === 'main' ? 'selected' : ''}>Main</option>
              <option value="daily" ${q.type === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${q.type === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="monthly" ${q.type === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="side" ${q.type === 'side' ? 'selected' : ''}>Side</option>
              <option value="hidden" ${q.type === 'hidden' ? 'selected' : ''}>Hidden</option>
            </select>
          </div>
          <div class="qef-field qef-field-sm">
            <label class="quest-meta-label" for="qf-xp">XP Reward</label>
            <input type="number" id="qf-xp" class="system-input"
              value="${q.xpReward}" min="0" step="10"
              oninput="updateQuestField('xpReward', parseInt(this.value)||0)" />
          </div>
          <div class="qef-field qef-field-sm">
            <label class="quest-meta-label" for="qf-reward">Reward</label>
            <input type="text" id="qf-reward" class="system-input"
              value="${escapeHTML(q.reward)}" placeholder="Optional reward..."
              oninput="updateQuestField('reward', this.value)" />
          </div>
        </div>

        <div class="qef-field">
          <div class="quest-objectives-header" style="margin-bottom:0.5rem;">
            <h3 class="quest-section-title" style="font-size:0.75rem;"><i data-lucide="list-checks"></i> OBJECTIVES</h3>
            <button class="quest-icon-btn" onclick="addClChild(null)" title="Add objective" style="width:26px;height:26px;">
              <i data-lucide="plus"></i>
            </button>
          </div>
          <div class="cl-tree-container qef-objectives">
            ${renderObjectivesEdit(q.objectives, q)}
          </div>
        </div>

        <div class="qef-field">
          <div class="quest-objectives-header" style="margin-bottom:0.5rem;">
            <h3 class="quest-section-title" style="font-size:0.75rem;color:#ef4444;">
              <i data-lucide="skull" style="color:#ef4444;"></i> PENALTIES
            </h3>
            <button class="quest-icon-btn qef-penalty-btn" onclick="openPenaltyPicker()" title="Set penalties" style="width:auto;padding:0 0.6rem;gap:0.3rem;font-size:0.65rem;font-family:'Orbitron',sans-serif;letter-spacing:0.5px;border-color:rgba(239,68,68,0.5);color:#f87171;">
              <i data-lucide="plus" style="width:11px;height:11px;"></i> SET PENALTIES
            </button>
          </div>
          <div id="qef-penalty-list" class="qef-penalty-list">
            ${renderPenaltyList(q.penalties || [])}
          </div>
          <p class="qef-field-hint">
            If a timer expires while this quest is active, these items trigger as penalty tasks and you lose XP
            (scaled by quest rank). Clear a penalty by actually completing the item — score ≥80% on the coding
            challenge or notebook quiz — to redeem half the lost XP. Unresolved penalties halve this quest's reward.
          </p>
        </div>
      </div>

      <div class="qef-footer">
        <button class="btn-system" style="border-color:#64748b;color:#64748b;" onclick="cancelEditMode()">CANCEL</button>
        <button class="btn-system" onclick="saveEditMode()">
          <i data-lucide="save" style="width:14px;height:14px;display:inline;vertical-align:-2px;margin-right:6px;"></i>SAVE
        </button>
        <button class="btn-system" onclick="saveAndActivateQuest()" style="border-color:#22c55e;color:#22c55e;">
          <i data-lucide="swords" style="width:14px;height:14px;display:inline;vertical-align:-2px;margin-right:6px;"></i>SAVE & ACTIVATE
        </button>
      </div>
    </div>
  `;
}

// ── Objectives Edit ───────────────────────────────────────────
function renderObjectivesEdit(items, quest, level = 0) {
  let html = '';
  for (const item of items) {
    const hasChildren = item.children && item.children.length > 0;
    html += `
      <div class="cl-item-edit" data-id="${item.id}" style="padding-left:${level * 1.25}rem;">
        <div class="cl-edit-row">
          <span class="cl-drag-handle" title="Drag to reorder">
            <i data-lucide="grip-vertical" style="width:14px;height:14px;color:#475569;"></i>
          </span>
          <input type="text" class="cl-edit-input" placeholder="Objective text..."
            value="${escapeHTML(item.text)}"
            onchange="updateClItemField('${item.id}', 'text', this.value)"
            oninput="updateClItemField('${item.id}', 'text', this.value)" />
        <input type="number" class="system-input cl-xp-input" min="0" max="1000"
               value="${item.xp || 0}" title="XP for ticking this objective"
               placeholder="XP"
               onchange="updateClItemField('${item.id}', 'xp', this.value)">
          <button class="quest-icon-btn" style="width:24px;height:24px;flex-shrink:0;" onclick="addClChild('${item.id}')" title="Add sub-objective">
            <i data-lucide="plus" style="width:11px;height:11px;"></i>
          </button>
          <button class="quest-icon-btn danger" style="width:24px;height:24px;flex-shrink:0;" onclick="removeClItem('${item.id}')" title="Remove">
            <i data-lucide="x" style="width:11px;height:11px;"></i>
          </button>
        </div>
        <div class="cl-edit-extra">
          <textarea class="cl-edit-input cl-edit-desc" placeholder="Description (optional)"
            rows="1" style="resize:vertical;"
            onchange="updateClItemField('${item.id}', 'desc', this.value)"
            oninput="updateClItemField('${item.id}', 'desc', this.value)">${escapeHTML(item.desc)}</textarea>
          ${renderTimerEdit(item)}
        </div>
        ${hasChildren ? `<div class="cl-children">${renderObjectivesEdit(item.children, quest, level + 1)}</div>` : ''}
      </div>`;
  }
  return html;
}

function renderTimerEdit(item) {
  const h = item.timer.durationMs ? Math.floor(item.timer.durationMs / 3600000) : '';
  const m = item.timer.durationMs ? Math.floor((item.timer.durationMs % 3600000) / 60000) : '';
  const s = item.timer.durationMs ? Math.floor((item.timer.durationMs % 60000) / 1000) : '';
  return `<div class="cl-timer-edit">
    <i data-lucide="timer" style="width:14px;height:14px;color:#64748b;flex-shrink:0;"></i>
    <input type="number" class="cl-timer-part" placeholder="0" min="0" max="99"
      value="${h}" title="Hours"
      onchange="updateClTimer('${item.id}', 'h', parseInt(this.value)||0)" />
    <span style="color:#64748b;font-weight:700;">:</span>
    <input type="number" class="cl-timer-part" placeholder="0" min="0" max="59"
      value="${m}" title="Minutes"
      onchange="updateClTimer('${item.id}', 'm', parseInt(this.value)||0)" />
    <span style="color:#64748b;font-weight:700;">:</span>
    <input type="number" class="cl-timer-part" placeholder="0" min="0" max="59"
      value="${s}" title="Seconds"
      onchange="updateClTimer('${item.id}', 's', parseInt(this.value)||0)" />
    <input type="date" class="system-input" style="height:32px;font-size:0.72rem;padding:0 0.4rem;margin-left:0.25rem;"
      value="${item.timer.date || ''}" title="Or set a deadline date"
      onchange="updateClTimerDate('${item.id}', this.value)" />
  </div>`;
}

// ── Penalty List (in edit form) ───────────────────────────────
function renderPenaltyList(penalties) {
  if (!penalties || penalties.length === 0) {
    return `<div class="qef-penalty-empty">
      <i data-lucide="shield-off" style="width:16px;height:16px;opacity:0.4;"></i>
      No penalties set. Add items from the Coding or Notes library above.
    </div>`;
  }
  return penalties.map((p, i) => `
    <div class="qef-penalty-row">
      <span class="qef-penalty-source-badge ${p.sourceType}">${p.sourceType === 'coding' ? 'CODE' : 'NOTE'}</span>
      <span class="qef-penalty-name">${escapeHTML(p.itemName)}</span>
      <button class="quest-icon-btn danger" style="width:22px;height:22px;flex-shrink:0;"
        onclick="removePenaltyFromForm(${i})" title="Remove">
        <i data-lucide="x" style="width:10px;height:10px;"></i>
      </button>
    </div>`).join('');
}

function removePenaltyFromForm(index) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q || !q.penalties) return;
  q.penalties.splice(index, 1);
  const listEl = document.getElementById('qef-penalty-list');
  if (listEl) {
    listEl.innerHTML = renderPenaltyList(q.penalties);
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: listEl });
  }
}

// Opens the penalty picker modal from inside the edit form
function openPenaltyPicker() {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  if (!q.penalties) q.penalties = [];

  // Use questPenalty's library modal in "picker" mode
  if (window.questPenalty && window.questPenalty.openPicker) {
    window.questPenalty.openPicker(q, (selectedItems) => {
      selectedItems.forEach(item => {
        const exists = q.penalties.find(p => p.itemId === item.itemId);
        if (!exists) {
          q.penalties.push({
            id: generateId(),
            sourceType: item.sourceType,
            itemId: item.itemId,
            itemName: item.itemName,
            multiplier: 1,
            completedAt: null
          });
        }
      });
      // Refresh penalty list in form
      const listEl = document.getElementById('qef-penalty-list');
      if (listEl) {
        listEl.innerHTML = renderPenaltyList(q.penalties);
        if (typeof lucide !== 'undefined') lucide.createIcons({ el: listEl });
      }
    });
  }
}

// ── Objective helpers ─────────────────────────────────────────
function findClItem(items, id) {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findClItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeClItemRecursive(items, id) {
  const idx = items.findIndex(it => it.id === id);
  if (idx !== -1) { items.splice(idx, 1); return true; }
  for (const item of items) {
    if (item.children && removeClItemRecursive(item.children, id)) return true;
  }
  return false;
}

function updateClItemField(id, field, value) {
  if (field === 'xp') value = Math.max(0, Math.min(1000, parseInt(value) || 0));
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const item = findClItem(q.objectives, id);
  if (item) item[field] = value;
}

function updateClTimer(id, part, value) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const item = findClItem(q.objectives, id);
  if (!item) return;
  const t = item.timer;
  const curH = Math.floor(t.durationMs / 3600000);
  const curM = Math.floor((t.durationMs % 3600000) / 60000);
  const curS = Math.floor((t.durationMs % 60000) / 1000);
  const h = part === 'h' ? value : curH;
  const m = part === 'm' ? value : curM;
  const s = part === 's' ? value : curS;
  t.durationMs = (h * 3600 + m * 60 + s) * 1000;
}

function updateClTimerDate(id, value) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const item = findClItem(q.objectives, id);
  if (item) item.timer.date = value || null;
}

function addClChild(parentId) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const newItem = generateObjective();
  if (parentId === null) {
    q.objectives.push(newItem);
  } else {
    const parent = findClItem(q.objectives, parentId);
    if (parent) {
      parent.children.push(newItem);
      parent.expanded = true;
    }
  }
  renderQuestDetails();
}

function removeClItem(id) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  removeClItemRecursive(q.objectives, id);
  renderQuestDetails();
}

function toggleExpand(id) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const item = findClItem(q.objectives, id);
  if (item) { item.expanded = !item.expanded; renderQuestDetails(); }
}

function toggleItemDone(id, questId) {
  const qid = questId || questState.activeQuestId;
  const q = questState.quests.find(q => q.id === qid);
  if (!q) return;
  const item = findClItem(q.objectives, id);
  if (!item) return;
  item.done = !item.done;
  /* Paid on the tick, once per run. Unticking does not take it back: the work
     was done, and a checkbox that costs you XP to correct is a checkbox people
     stop correcting. resetObjectives clears the claim when the quest restarts. */
  if (item.done && !item.xpClaimed && (item.xp | 0) > 0 && q.status === 'active') {
    item.xpClaimed = true;
    addXP(item.xp | 0);
    if (typeof toast === 'function') toast('+' + (item.xp | 0) + ' XP — ' + (item.text || 'objective'),
                                           { type: 'success', duration: 1800 });
  }
  const allDone = updateParentStatuses(q.objectives);
  if (allDone && (q.objectives || []).length > 0 && q.status === 'active') {
    q.status = 'completed';
    q.completedAt = new Date().toISOString();
    completeQuest(q);
    questState.isActionMode = false;
    saveQuestData();
    if (typeof setQuestTab === 'function') setQuestTab('completed');
    if (typeof renderQuestDetails === 'function') renderQuestDetails();
  } else {
    saveQuestData();
    if (typeof renderQuestDetails === 'function') renderQuestDetails();
    if (typeof renderQuestList === 'function') renderQuestList();
  }
  if (window.questHUD) window.questHUD.refresh();
}
window.toggleItemDone = toggleItemDone;

function updateParentStatuses(items) {
  if (!items || items.length === 0) return true;
  let allSiblingsDone = true;
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      item.done = updateParentStatuses(item.children);
    }
    if (!item.done) allSiblingsDone = false;
  }
  return allSiblingsDone;
}

// ── Timer Display ─────────────────────────────────────────────
function getDeadlineTime(item, quest) {
  /* An objective saved before timers existed has no timer object at all, and
     three load paths reach the renderer without migrating -- signing in to
     the cloud, and importing a backup. Both crashed the whole board on
     `item.timer.durationMs`. The paths are fixed too; this is the guard that
     means the next shape change is a missing feature rather than a blank
     screen. */
  if (!item || !item.timer) return null;
  if (quest.status !== 'active' || !quest.activatedAt) return null;
  if (item.timer.date) return new Date(item.timer.date).getTime();
  if (!item.timer.durationMs) return null;
  const start = new Date(quest.activatedAt).getTime();
  return start + (item.timer.durationMs - (item.timer.elapsedMs || 0));
}

function getTimerDisplayHTML(item, quest) {
  if (!item || !item.timer) return '';
  const targetTime = getDeadlineTime(item, quest);
  if (!targetTime) {
    if (item.timer.durationMs > 0) {
      const ms = item.timer.durationMs - (item.timer.elapsedMs || 0);
      if (ms <= 0) return `<div class="system-timer-display overdue">OVERDUE</div>`;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      return `<div class="system-timer-display" style="opacity:0.5;" title="Timer paused">
        <i data-lucide="pause-circle" style="width:14px;height:14px;display:inline-block;vertical-align:-3px;margin-right:4px;"></i>
        ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}
      </div>`;
    }
    return '';
  }
  return `<div class="system-timer-display" data-countdown-target="${targetTime}" data-quest-id="${quest.id}">--:--:--</div>`;
}

// ── Penalty check helper (flag-based, prevents infinite loops) ─
function _checkAndTriggerPenalties(quest) {
  if (!quest.activatedAt) return;
  var now = Date.now();
  var anyTriggered = false;
  function scan(items) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.done) continue;
      var deadline = getDeadlineTime(item, quest);
      if (deadline && deadline <= now && item.timer && !item.timer.penaltyFired) {
        item.timer.penaltyFired = true;
        anyTriggered = true;
      }
      if (item.children) scan(item.children);
    }
  }
  scan(quest.objectives || []);
  if (anyTriggered) {
    if (window.questPenalty) {
      window.questPenalty.triggerPenalty(quest);
    } else {
      saveQuestData();
    }
  }
}

// ── Global Countdown Loop ─────────────────────────────────────
function startGlobalCountdownLoop() {
  if (window.questGlobalTimer) clearInterval(window.questGlobalTimer);
  window.questGlobalTimer = setInterval(() => {
    const displays = document.querySelectorAll('[data-countdown-target]');
    const now = Date.now();

    displays.forEach(el => {
      const targetTime = parseInt(el.getAttribute('data-countdown-target'), 10);
      const questId = el.getAttribute('data-quest-id');
      const diff = targetTime - now;
      const row = el.closest('.cl-item-row');
      const isDone = row && row.classList.contains('done');

      if (isDone) {
        if (el.textContent !== 'CLEARED') {
          el.textContent = 'CLEARED';
          el.style.color = '#10b981';
          el.style.borderColor = 'rgba(16,185,129,0.4)';
          el.classList.remove('overdue');
        }
        return;
      }

      if (diff <= 0) {
        el.textContent = 'OVERDUE';
        el.classList.add('overdue');
        const q = questState.quests.find(x => x.id === questId);
        if (q && q.status === 'active') {
          _checkAndTriggerPenalties(q);
        }
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const text = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      if (el.textContent !== text) el.textContent = text;
    });
  }, 1000);
}

// ── System Overlays ───────────────────────────────────────────
function _ensureSystemOverlay() {
  if (document.getElementById('system-overlay')) return;
  const div = document.createElement('div');
  div.id = 'system-overlay';
  div.className = 'system-overlay';
  div.innerHTML = `
    <div class="system-message-box">
      <div class="system-msg-scanlines"></div>
      <div id="system-msg-icon" class="system-msg-icon"></div>
      <div id="system-msg-title" class="system-msg-title">QUEST COMPLETED</div>
      <div id="system-msg-desc" class="system-msg-desc"></div>
      <div id="system-msg-rewards" class="system-msg-rewards"></div>
      <button class="btn-system" onclick="closeSystemOverlay()">CONFIRM</button>
    </div>`;
  document.body.appendChild(div);
}

function showSystemOverlay(title, desc, rewards, isLevelUp = false) {
  _ensureSystemOverlay();
  const overlay = document.getElementById('system-overlay');
  if (!overlay) return;
  const titleEl = document.getElementById('system-msg-title');
  const descEl = document.getElementById('system-msg-desc');
  const rewardsEl = document.getElementById('system-msg-rewards');
  const iconEl = document.getElementById('system-msg-icon');

  titleEl.textContent = title;
  isLevelUp ? titleEl.classList.add('level-up') : titleEl.classList.remove('level-up');
  descEl.textContent = desc;
  rewardsEl.innerHTML = rewards.map(r => `<div class="system-reward-item">${escapeHTML(r)}</div>`).join('');

  // Reset animations so they replay each time the overlay opens
  [iconEl, titleEl, descEl, rewardsEl, overlay.querySelector('.btn-system')].forEach(el => {
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });

  overlay.classList.add('active');
}

window.closeSystemOverlay = function () {
  const overlay = document.getElementById('system-overlay');
  if (overlay) overlay.classList.remove('active');
};

// Expose for penalty engine and HUD
window.questState = questState;
window.questAddXP = addXP;
window.saveQuestData = saveQuestData;
window.loadQuestData = loadQuestData;
window.renderQuestList = renderQuestList;
window.renderQuestDetails = renderQuestDetails;
window.showSystemOverlay = showSystemOverlay;
window.getDeadlineTime = getDeadlineTime;

// Auto-load quest data at startup so HUD works on all pages
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadQuestData);
} else {
  loadQuestData();
}

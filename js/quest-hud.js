/* ============================================================
   QUEST-HUD.JS — Persistent floating HUD singleton
   ============================================================ */

(function () {
  'use strict';

  const HUD_POS_KEY = 'questHUDPos';
  const HUD_STATE_KEY = 'questHUDState';
  const HUD_SIZE_KEY = 'questHUDSize';

  let hudEl = null;
  let _hudRO = null;
  let _questIdx = 0;
  let _dragging = false;
  let _dragMoved = false;
  let _dragOffsetX = 0;
  let _dragOffsetY = 0;
  let _dragStartX = 0;
  let _dragStartY = 0;
  let _dragJustFinished = false;

  // ── Bootstrap ─────────────────────────────────────────────
  function mount() {
    if (document.getElementById('quest-hud-root')) return;

    // Ensure quest data is loaded before first render
    if (typeof window.loadQuestData === 'function') {
      window.loadQuestData();
    }

    const root = document.createElement('div');
    root.id = 'quest-hud-root';
    document.body.appendChild(root);
    hudEl = root;

    _restorePosition();
    render();
    _bindDrag();

    window.addEventListener('resize', _clampPosition);
  }

  // ── Public API ────────────────────────────────────────────
  window.questHUD = {
    mount,
    refresh() { if (hudEl) render(); },
    show() { _setState('expanded'); },
    hide() { _setState('hidden'); },
    minimize() { _setState('minimized'); },
    openPenaltyWindow() {
      if (window.questPenalty) window.questPenalty.openWindow();
    }
  };

  // ── State ─────────────────────────────────────────────────
  function _getHUDState() {
    return localStorage.getItem(HUD_STATE_KEY) || 'minimized';
  }

  function _setState(state) {
    localStorage.setItem(HUD_STATE_KEY, state);
    render();
  }

  // ── Active quests ─────────────────────────────────────────
  function _getActiveQuests() {
    if (!window.questState) return [];
    return (window.questState.quests || []).filter(q => q.status === 'active');
  }

  function _getAllPendingPenalties() {
    if (!window.questState) return 0;
    return (window.questState.quests || []).reduce((sum, q) => {
      return sum + (q.penalties || []).filter(p => p.triggeredAt && !p.completedAt).length;
    }, 0);
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    if (!hudEl) return;
    var state = _getHUDState();
    const activeQuests = _getActiveQuests();
    const penaltyCount = _getAllPendingPenalties();

    // Auto-recover: if hidden but quests/penalties exist, show as bubble
    if (state === 'hidden' && (activeQuests.length > 0 || penaltyCount > 0)) {
      state = 'minimized';
      localStorage.setItem(HUD_STATE_KEY, state);
    }

    // Nothing to show — clear HUD
    if (activeQuests.length === 0 && penaltyCount === 0) {
      hudEl.innerHTML = '';
      return;
    }

    // Clamp quest index
    if (_questIdx >= activeQuests.length) _questIdx = Math.max(0, activeQuests.length - 1);

    if (state === 'minimized') {
      _renderBubble(activeQuests.length, penaltyCount);
    } else if (state === 'expanded') {
      _renderPanel(activeQuests, penaltyCount);
    } else {
      hudEl.innerHTML = '';
    }

    if (typeof lucide !== 'undefined') lucide.createIcons({ el: hudEl });
  }

  /* Aggregate leaf-objective completion across all active quests (for the ring). */
  function _aggregateProgress(activeQuests) {
    let total = 0, done = 0;
    function count(items) {
      (items || []).forEach(it => {
        if (!it.children || it.children.length === 0) { total++; if (it.done) done++; }
        else count(it.children);
      });
    }
    activeQuests.forEach(q => count(q.objectives));
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  /* Earliest deadline among undone objectives of active quests (ms epoch or null). */
  function _nearestDeadline(activeQuests) {
    let earliest = null;
    function scan(items, quest) {
      (items || []).forEach(it => {
        if (!it.done) {
          const d = _getDeadlineTime(it, quest);
          if (d && (!earliest || d < earliest)) earliest = d;
        }
        if (it.children) scan(it.children, quest);
      });
    }
    activeQuests.forEach(q => scan(q.objectives, q));
    return earliest;
  }

  function _renderBubble(count, penaltyCount) {
    const activeQuests = _getActiveQuests();
    const prog = _aggregateProgress(activeQuests);
    const nearest = _nearestDeadline(activeQuests);
    const msLeft = nearest ? nearest - Date.now() : null;
    const urgent = penaltyCount > 0 || (msLeft !== null && msLeft < 10 * 60 * 1000);
    const showChip = msLeft !== null && msLeft < 60 * 60 * 1000;

    const titleBits = [`${count} active quest${count !== 1 ? 's' : ''} · ${prog.done}/${prog.total} objectives`];
    if (penaltyCount > 0) titleBits.push(`${penaltyCount} penalt${penaltyCount > 1 ? 'ies' : 'y'} pending`);

    hudEl.innerHTML = `
      <div class="qhud-bubble${urgent ? ' urgent' : ''}" id="qhud-bubble-inner" title="${_esc(titleBits.join(' — '))} — click to expand">
        ${prog.total > 0 ? `
        <svg class="qhud-ring" viewBox="0 0 36 36" aria-hidden="true">
          <path class="qhud-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="qhud-ring-fill" stroke-dasharray="${prog.pct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>` : ''}
        <div class="qhud-hex">
          <i data-lucide="swords" style="width:18px;height:18px;"></i>
        </div>
        ${count > 0 ? `<span class="qhud-badge">${count}</span>` : ''}
        ${penaltyCount > 0 ? `<span class="qhud-penalty-badge">${penaltyCount}</span>` : ''}
        ${showChip ? `<span class="qhud-deadline-chip${msLeft <= 0 ? ' overdue' : ''}" ${msLeft > 0 ? `data-hud-countdown="${nearest}"` : ''}>${msLeft <= 0 ? 'OVERDUE' : '--:--:--'}</span>` : ''}
      </div>`;
    const bubble = document.getElementById('qhud-bubble-inner');
    if (bubble) {
      bubble.addEventListener('click', function () {
        if (_dragJustFinished) return;
        window.questHUD.show();
      });
    }
  }

  function _renderPanel(activeQuests, penaltyCount) {
    const q = activeQuests[_questIdx] || null;
    const canPrev = _questIdx > 0;
    const canNext = _questIdx < activeQuests.length - 1;

    let objHtml = '';
    if (q) {
      objHtml = _renderHUDObjectives(q.objectives || [], q);
    }

    hudEl.innerHTML = `
      <div class="qhud-panel" id="qhud-inner">
        <div class="qhud-scanlines"></div>
        <div class="qhud-header" id="qhud-drag-handle">
          <span class="qhud-title">
            <i data-lucide="swords" style="width:13px;height:13px;"></i>
            ACTIVE QUESTS
          </span>
          <div class="qhud-header-btns">
            <button class="qhud-btn" onclick="window.questHUD.minimize()" title="Minimize">
              <i data-lucide="minus" style="width:12px;height:12px;"></i>
            </button>
            <button class="qhud-btn" onclick="window.questHUD.hide()" title="Hide">
              <i data-lucide="x" style="width:12px;height:12px;"></i>
            </button>
          </div>
        </div>

        ${q ? `
          <div class="qhud-navigator">
            <button class="qhud-nav-btn" onclick="window.questHUD._prev()" ${!canPrev ? 'disabled' : ''}>
              <i data-lucide="chevron-left" style="width:14px;height:14px;"></i>
            </button>
            <div class="qhud-quest-info">
              <span class="qhud-quest-counter">${_questIdx + 1} / ${activeQuests.length}</span>
              <span class="qhud-quest-title">${_esc(q.title) || 'Untitled'}</span>
            </div>
            <span class="rank-badge rank-${q.rank}" style="font-size:0.6rem;width:18px;height:18px;">${q.rank}</span>
            <button class="qhud-nav-btn" onclick="window.questHUD._next()" ${!canNext ? 'disabled' : ''}>
              <i data-lucide="chevron-right" style="width:14px;height:14px;"></i>
            </button>
          </div>

          <div class="qhud-objectives">
            ${objHtml || '<div class="qhud-empty-obj">No objectives</div>'}
          </div>
        ` : '<div class="qhud-empty-obj" style="padding:1rem;">No active quests</div>'}

        ${penaltyCount > 0 ? `
          <button class="qhud-penalty-bar" onclick="window.questHUD.openPenaltyWindow()">
            <i data-lucide="skull" style="width:12px;height:12px;display:inline;vertical-align:-2px;margin-right:4px;"></i>
            ${penaltyCount} Penalt${penaltyCount > 1 ? 'ies' : 'y'} pending
          </button>
        ` : ''}
      </div>`;

    /* Restore saved panel size */
    const panel = hudEl.querySelector('.qhud-panel');
    if (panel) {
      try {
        const savedSize = JSON.parse(localStorage.getItem(HUD_SIZE_KEY) || 'null');
        if (savedSize) {
          panel.style.width = savedSize.w + 'px';
          panel.style.height = savedSize.h + 'px';
        }
      } catch {}

      /* Observe resize to persist dimensions (disconnect the previous observer
         first — re-renders used to leak one observer per refresh). */
      if (_hudRO) _hudRO.disconnect();
      _hudRO = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            try {
              localStorage.setItem(HUD_SIZE_KEY, JSON.stringify({ w: Math.round(entry.target.offsetWidth), h: Math.round(entry.target.offsetHeight) }));
            } catch {}
          }
        }
      });
      _hudRO.observe(panel);
    }
  }

  function _renderHUDObjectives(items, quest, level = 0) {
    let html = '';
    for (const item of items) {
      const hasChildren = item.children && item.children.length > 0;
      const deadline = _getDeadlineTime(item, quest);
      let timerHtml = '';

      if (deadline) {
        const diff = deadline - Date.now();
        if (diff <= 0) {
          timerHtml = `<span class="qhud-timer overdue">OVERDUE</span>`;
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          const txt = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
          timerHtml = `<span class="qhud-timer" data-hud-countdown="${deadline}" data-hud-quest="${quest.id}">${txt}</span>`;
        }
      }

      const isLeaf = !hasChildren;
      const canCheck = isLeaf && !item.done;

      html += `<div class="qhud-obj-row ${item.done ? 'done' : ''}" style="padding-left:${1.1 + level * 0.75}rem;">
        ${isLeaf ? `<span class="qhud-checkbox ${item.done ? 'checked' : ''} ${canCheck ? 'clickable' : ''}"
          ${canCheck ? `onclick="window.toggleItemDone('${item.id}','${quest.id}');"` : ''}></span>` :
          `<span class="qhud-parent-dot ${item.done ? 'done' : ''}"></span>`}
        <span class="qhud-obj-text">${_esc(item.text) || '—'}</span>
        ${timerHtml}
      </div>`;

      if (hasChildren && item.expanded) {
        html += _renderHUDObjectives(item.children, quest, level + 1);
      }
    }
    return html;
  }

  // ── Navigation ────────────────────────────────────────────
  window.questHUD._prev = function () {
    const active = _getActiveQuests();
    if (_questIdx > 0) { _questIdx--; render(); }
  };
  window.questHUD._next = function () {
    const active = _getActiveQuests();
    if (_questIdx < active.length - 1) { _questIdx++; render(); }
  };

  // ── Drag ──────────────────────────────────────────────────
  function _bindDrag() {
    document.addEventListener('mousemove', _onDragMove);
    document.addEventListener('mouseup', _onDragEnd);
    hudEl.addEventListener('mousedown', _onDragStart);
  }

  function _onDragStart(e) {
    const state = _getHUDState();
    const isBubble = state === 'minimized';
    const handle = e.target.closest('#qhud-drag-handle');
    if (!handle && !isBubble) return;
    _dragging = true;
    _dragMoved = false;
    _dragStartX = e.clientX;
    _dragStartY = e.clientY;
    const rect = hudEl.getBoundingClientRect();
    _dragOffsetX = e.clientX - rect.left;
    _dragOffsetY = e.clientY - rect.top;
    hudEl.style.transition = 'none';
    e.preventDefault();
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  }

  function _onDragMove(e) {
    if (!_dragging) return;
    const dx = e.clientX - _dragStartX;
    const dy = e.clientY - _dragStartY;
    if (!_dragMoved && Math.sqrt(dx * dx + dy * dy) < 6) return;
    _dragMoved = true;
    const x = e.clientX - _dragOffsetX;
    const y = e.clientY - _dragOffsetY;
    _applyPosition(x, y);
    e.preventDefault();
  }

  function _onDragEnd(e) {
    if (!_dragging) return;
    const wasMoved = _dragMoved;
    _dragging = false;
    _dragMoved = false;
    hudEl.style.transition = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    if (wasMoved) {
      _dragJustFinished = true;
      requestAnimationFrame(() => { _dragJustFinished = false; });
      _savePosition();
    }
  }

  function _applyPosition(x, y) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = hudEl.offsetWidth || 320;
    const h = hudEl.offsetHeight || 200;
    const cx = Math.max(0, Math.min(x, vw - w));
    const cy = Math.max(0, Math.min(y, vh - h));
    hudEl.style.left = cx + 'px';
    hudEl.style.top = cy + 'px';
    hudEl.style.right = 'auto';
    hudEl.style.bottom = 'auto';
  }

  function _savePosition() {
    const rect = hudEl.getBoundingClientRect();
    localStorage.setItem(HUD_POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
  }

  function _restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(HUD_POS_KEY) || 'null');
      if (saved) {
        hudEl.style.position = 'fixed';
        hudEl.style.left = saved.x + 'px';
        hudEl.style.top = saved.y + 'px';
        hudEl.style.right = 'auto';
        hudEl.style.bottom = 'auto';
      } else {
        // Default sits above the settings FAB (bottom-right) with room for the
        // deadline chip that can appear under the bubble.
        hudEl.style.position = 'fixed';
        hudEl.style.right = '20px';
        hudEl.style.bottom = '110px';
        hudEl.style.left = 'auto';
        hudEl.style.top = 'auto';
      }
    } catch {}
  }

  function _getSavedPositionStyle() {
    try {
      const saved = JSON.parse(localStorage.getItem(HUD_POS_KEY) || 'null');
      if (saved) return `position:fixed;left:${saved.x}px;top:${saved.y}px;z-index:8000;`;
    } catch {}
    return 'position:fixed;right:20px;bottom:80px;z-index:8000;';
  }

  function _clampPosition() {
    if (!hudEl) return;
    const rect = hudEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = hudEl.offsetWidth;
    const h = hudEl.offsetHeight;
    if (rect.right > vw || rect.bottom > vh || rect.left < 0 || rect.top < 0) {
      _applyPosition(
        Math.max(0, Math.min(rect.left, vw - w)),
        Math.max(0, Math.min(rect.top, vh - h))
      );
      _savePosition();
    }
  }

  // ── Persistent timer: update HUD displays + trigger penalties ─
  function _scanForOverdue(items, quest, now) {
    var any = false;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.done) continue;
      var deadline = _getDeadlineTime(item, quest);
      if (deadline && deadline <= now && item.timer && !item.timer.penaltyFired) {
        item.timer.penaltyFired = true;
        any = true;
      }
      if (item.children && _scanForOverdue(item.children, quest, now)) {
        any = true;
      }
    }
    return any;
  }

  setInterval(function () {
    // 1. Update HUD countdown displays
    if (hudEl) {
      var displays = hudEl.querySelectorAll('[data-hud-countdown]');
      var now = Date.now();
      displays.forEach(function (el) {
        var target = parseInt(el.getAttribute('data-hud-countdown'), 10);
        var diff = target - now;
        if (diff <= 0) {
          el.textContent = 'OVERDUE';
          el.classList.add('overdue');
          return;
        }
        var h = Math.floor(diff / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        el.textContent = h.toString().padStart(2,'0') + ':' + m.toString().padStart(2,'0') + ':' + s.toString().padStart(2,'0');
      });

      /* Keep the bubble's urgency state live as deadlines approach */
      var bubble = hudEl.querySelector('.qhud-bubble');
      if (bubble && window.questState) {
        var aq = _getActiveQuests();
        var nd = _nearestDeadline(aq);
        var urg = _getAllPendingPenalties() > 0 || (nd !== null && nd - now < 10 * 60 * 1000);
        bubble.classList.toggle('urgent', urg);
      }
    }

    // 2. Persistent penalty check — fires even when quest page is not open
    if (!window.questState) return;
    var activeQuests = (window.questState.quests || []).filter(function (q) { return q.status === 'active'; });
    if (activeQuests.length === 0) return;

    var now2 = Date.now();
    var needsRefresh = false;
    for (var i = 0; i < activeQuests.length; i++) {
      var quest = activeQuests[i];
      if (!quest.activatedAt) continue;
      if (_scanForOverdue(quest.objectives || [], quest, now2)) {
        if (window.questPenalty) window.questPenalty.triggerPenalty(quest);
        else if (typeof window.saveQuestData === 'function') window.saveQuestData();
        needsRefresh = true;
      }
    }
    if (needsRefresh) render();
  }, 1000);

  // ── Helpers ───────────────────────────────────────────────
  function _esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _getDeadlineTime(item, quest) {
    if (!item.timer) return null;
    if (quest.status !== 'active' || !quest.activatedAt) return null;
    if (item.timer.date) return new Date(item.timer.date).getTime();
    if (!item.timer.durationMs) return null;
    const start = new Date(quest.activatedAt).getTime();
    return start + (item.timer.durationMs - (item.timer.elapsedMs || 0));
  }

  // ── Auto-mount on DOMContentLoaded ────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

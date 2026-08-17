/* ============================================================
   QUEST-PENALTY.JS — Penalty engine, floating panel, picker modal
   ============================================================ */

(function () {
  'use strict';

  /* ── Floating panel state ─────────────────────────────────── */
  let _panelEl      = null;
  let _panelDrag    = false;
  let _panelMoved   = false;
  let _panelOX      = 0, _panelOY = 0;
  let _panelSX      = 0, _panelSY = 0;
  let _elapsedTimer = null;

  /* ── Picker modal state ───────────────────────────────────── */
  let _pickerCallback = null;
  let _stagedItems    = [];

  /* ── Tuning ───────────────────────────────────────────────── */
  /* XP lost per penalty when a timer expires, scaled by quest rank. */
  const PENALTY_XP_LOSS = { E: 5, D: 10, C: 15, B: 25, A: 40, S: 60 };
  /* Minimum score (%) on the coding challenge / notebook quiz that
     counts as actually clearing the penalty. */
  const PENALTY_CLEAR_SCORE = 80;

  /* ── Public API ───────────────────────────────────────────── */
  window.questPenalty = {
    triggerPenalty,
    notifyActivity,
    openWindow:   _openPenaltyPanel,
    openPicker:   openPickerForForm,
    refresh:      _renderPenaltyPanel,
    _closePanel:  _closePanel,
    _attempt:     _attemptItem,
    _markDone:    _markDone
  };

  /* ================================================================
     PENALTY TRIGGER — called when an objective timer hits 0
  ================================================================ */
  function triggerPenalty(quest) {
    _flashScreen();

    /* Trigger ALL penalties from the pre-configured pool; each trigger
       costs XP scaled by the quest's rank (stacking repeats included). */
    const lossPer = PENALTY_XP_LOSS[quest.rank] || PENALTY_XP_LOSS.E;
    let totalLoss = 0;
    const pool = (quest.penalties || []).filter(p => !p.completedAt);
    pool.forEach(p => {
      if (p.triggeredAt) {
        p.multiplier = (p.multiplier || 1) + 1;  // stack
      } else {
        p.triggeredAt = new Date().toISOString();
        p.multiplier  = 1;
      }
      p.xpLost = (p.xpLost || 0) + lossPer;
      totalLoss += lossPer;
    });

    if (totalLoss > 0 && typeof window.questAddXP === 'function') {
      window.questAddXP(-totalLoss);
    }

    if (typeof window.saveQuestData === 'function') window.saveQuestData();
    if (window.questHUD) window.questHUD.refresh();

    /* Open / update the floating penalty panel after the flash drama */
    setTimeout(() => {
      if (_getAllTriggered().length > 0) _openOrUpdatePanel();
    }, 800);
  }

  /* ================================================================
     ACTIVITY HOOK — auto-clears penalties when the user actually
     completes the penalized item (coding submit / notebook attempt).
     sourceType: 'coding' | 'notes', scorePct: 0–100.
  ================================================================ */
  function notifyActivity(sourceType, itemId, scorePct) {
    if (!window.questState) return;
    if ((scorePct || 0) < PENALTY_CLEAR_SCORE) return;

    const cleared = [];
    (window.questState.quests || []).forEach(q => {
      (q.penalties || []).forEach(p => {
        if (p.itemId === itemId && p.sourceType === sourceType && p.triggeredAt && !p.completedAt) {
          p.completedAt = new Date().toISOString();
          p.clearedBy = 'completion';
          cleared.push(p);
        }
      });
    });
    if (cleared.length === 0) return;

    /* Redeem half the XP lost — earned back by doing the work. */
    let redeemed = 0;
    cleared.forEach(p => { redeemed += Math.ceil((p.xpLost || 0) / 2); });
    if (redeemed > 0 && typeof window.questAddXP === 'function') window.questAddXP(redeemed);

    if (typeof window.saveQuestData === 'function') window.saveQuestData();
    if (window.questHUD) window.questHUD.refresh();
    _renderPenaltyPanel();

    if (typeof window.showSystemOverlay === 'function') {
      window.showSystemOverlay(
        'PENALTY CLEARED',
        `Verified completion: ${cleared[0].itemName}`,
        redeemed > 0 ? [`+${redeemed} XP redeemed`] : []
      );
    }
  }

  /* ── Screen-edge flash ────────────────────────────────────── */
  function _flashScreen() {
    const el = document.getElementById('quest-penalty-flash');
    if (!el) return;
    el.classList.remove('flash-active');
    void el.offsetWidth;
    el.classList.add('flash-active');
  }

  /* ================================================================
     FLOATING PENALTY PANEL
  ================================================================ */

  function _openPenaltyPanel() {
    if (_getAllTriggered().length === 0) return;
    _openOrUpdatePanel();
  }

  function _openOrUpdatePanel() {
    _ensurePanelEl();
    _renderPenaltyPanel();
  }

  /* Collect all triggered-but-not-completed penalties across all quests */
  function _getAllTriggered() {
    if (!window.questState) return [];
    const out = [];
    (window.questState.quests || []).forEach(q => {
      (q.penalties || [])
        .filter(p => p.triggeredAt && !p.completedAt)
        .forEach(p => out.push({
          id:         p.id,
          questId:    q.id,
          questTitle: q.title  || 'Quest',
          questRank:  q.rank   || 'E',
          sourceType: p.sourceType,
          itemId:     p.itemId,
          itemName:   p.itemName,
          multiplier: p.multiplier || 1,
          xpLost:     p.xpLost || 0,
          triggeredAt: p.triggeredAt
        }));
    });
    return out;
  }

  function _ensurePanelEl() {
    if (_panelEl) return;
    const div = document.createElement('div');
    div.id = 'qpen-panel-root';
    _restorePanelPosition(div);
    document.body.appendChild(div);
    _panelEl = div;
    _bindPanelDrag();
    _startElapsedTimer();
  }

  function _restorePanelPosition(el) {
    try {
      const saved = JSON.parse(localStorage.getItem('penPanelPos') || 'null');
      if (saved) {
        el.style.cssText = `position:fixed;left:${saved.x}px;top:${saved.y}px;z-index:7900;`;
        return;
      }
    } catch {}
    el.style.cssText = 'position:fixed;left:24px;bottom:90px;z-index:7900;';
  }

  function _renderPenaltyPanel() {
    if (!_panelEl) return;
    const triggered = _getAllTriggered();

    if (triggered.length === 0) {
      _panelEl.innerHTML = '';
      return;
    }

    _panelEl.innerHTML = `
      <div class="qpen-panel">
        <div class="qpen-scanlines"></div>
        <div class="qpen-header" id="qpen-drag-handle">
          <span class="qpen-title">
            <i data-lucide="skull" style="width:13px;height:13px;"></i>
            PENALTIES
          </span>
          <div class="qpen-header-right">
            <span class="qpen-count-pill">${triggered.length}</span>
            <button class="qpen-hdr-btn" onclick="window.questPenalty._closePanel()" title="Dismiss">
              <i data-lucide="x" style="width:11px;height:11px;"></i>
            </button>
          </div>
        </div>
        <div class="qpen-cards-list" id="qpen-cards-list">
          ${triggered.map(_renderCard).join('')}
        </div>
      </div>`;

    if (typeof lucide !== 'undefined') lucide.createIcons({ el: _panelEl });
  }

  function _renderCard(p) {
    const isCode     = p.sourceType === 'coding';
    const rankColor  = _rankColor(p.questRank);
    const elapsed    = p.triggeredAt
      ? Math.max(0, Math.floor((Date.now() - new Date(p.triggeredAt).getTime()) / 1000))
      : 0;

    return `
      <div class="qpen-card" style="border-left-color:${rankColor};">
        ${p.multiplier > 1 ? `<span class="qpen-mult-badge">×${p.multiplier}</span>` : ''}
        <div class="qpen-card-badges">
          <span class="qpen-src-badge ${isCode ? 'code' : 'note'}">
            <i data-lucide="${isCode ? 'code-2' : 'notebook'}" style="width:9px;height:9px;display:inline;vertical-align:-1px;margin-right:3px;"></i>
            ${isCode ? 'CODE' : 'NOTE'}
          </span>
          <span class="qpen-rank-badge" style="color:${rankColor};border-color:${rankColor}4D;">${p.questRank}</span>
        </div>
        <div class="qpen-card-name">${_esc(p.itemName)}</div>
        <div class="qpen-card-quest">${_esc(p.questTitle)}</div>
        <div class="qpen-card-elapsed">
          <i data-lucide="clock" style="width:9px;height:9px;display:inline;vertical-align:-1px;margin-right:4px;opacity:0.4;"></i>
          <span data-pen-triggered="${_esc(p.triggeredAt)}">${_fmtSecs(elapsed)}</span>
          <span style="color:#475569;margin-left:3px;">pending</span>
          ${p.xpLost > 0 ? `<span style="margin-left:auto;color:#f87171;font-weight:800;">−${p.xpLost} XP</span>` : ''}
        </div>
        <div class="qpen-card-actions">
          <button class="qpen-attempt-btn" onclick="window.questPenalty._attempt('${_esc(p.itemId)}','${p.sourceType}')">
            <i data-lucide="play" style="width:10px;height:10px;display:inline;vertical-align:-2px;margin-right:4px;"></i>
            ${isCode ? 'ATTEMPT' : 'OPEN'}
          </button>
          <button class="qpen-done-btn" onclick="window.questPenalty._markDone('${_esc(p.id)}','${_esc(p.questId)}')">
            <i data-lucide="check" style="width:10px;height:10px;display:inline;vertical-align:-2px;margin-right:4px;"></i>
            DONE
          </button>
        </div>
        <div class="qpen-card-hint">Score ≥${PENALTY_CLEAR_SCORE}% on this ${isCode ? 'challenge' : 'notebook'} to auto-clear & redeem ${Math.ceil(p.xpLost / 2) || ''} XP</div>
      </div>`;
  }

  /* ── Elapsed timer tick ───────────────────────────────────── */
  function _startElapsedTimer() {
    if (_elapsedTimer) return;
    _elapsedTimer = setInterval(() => {
      if (!_panelEl) return;
      _panelEl.querySelectorAll('[data-pen-triggered]').forEach(el => {
        const ts = el.getAttribute('data-pen-triggered');
        if (!ts) return;
        const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
        el.textContent = _fmtSecs(s);
      });
    }, 1000);
  }
  /* ── Actions ──────────────────────────────────────────────── */
  function _attemptItem(itemId, sourceType) {
    if (sourceType === 'coding') {
      /* Mirror vizPopupPlay() — direct practice launch */
      if (typeof promptTimer === 'function') {
        promptTimer(itemId);
      } else {
        if (typeof setSessionParam === 'function') {
          setSessionParam('practiceChallenge', itemId);
          /* Pick the first variant as default */
          var c = (typeof state !== 'undefined' && state.challenges)
            ? state.challenges.find(function (ch) { return ch.id === itemId; })
            : null;
          if (c && c.variants && c.variants.length > 0) {
            setSessionParam('practiceVariant', c.variants[0].id);
          }
          setSessionParam('timeLimit', 0);
        }
        if (typeof spaNavigate === 'function') spaNavigate('practice');
      }
    } else {
      /* Notes: mirror vizPopupPlay() — set session params and go */
      if (typeof setSessionParam === 'function') {
        setSessionParam('activeNotebook', itemId);
        setSessionParam('notebookTimeLimit', 0);
      }
      if (typeof spaNavigate === 'function') spaNavigate('notes-practice');
    }
  }

  function _markDone(penaltyId, questId) {
    if (!window.questState) return;
    const quest = (window.questState.quests || []).find(q => q.id === questId);
    if (!quest) return;
    const p = (quest.penalties || []).find(p => p.id === penaltyId);
    if (!p) return;
    p.completedAt = new Date().toISOString();
    p.clearedBy = 'manual'; // honor-system dismissal: no XP redemption
    if (typeof window.saveQuestData === 'function') window.saveQuestData();
    if (window.questHUD) window.questHUD.refresh();
    _renderPenaltyPanel();
  }

  function _closePanel() {
    if (_panelEl) _panelEl.innerHTML = '';
  }

  /* ── Panel drag ───────────────────────────────────────────── */
  function _bindPanelDrag() {
    document.addEventListener('mousemove', _onPanelMove);
    document.addEventListener('mouseup',   _onPanelUp);
    _panelEl.addEventListener('mousedown', _onPanelDown);
  }

  function _onPanelDown(e) {
    if (!e.target.closest('#qpen-drag-handle')) return;
    _panelDrag  = true;
    _panelMoved = false;
    _panelSX = e.clientX; _panelSY = e.clientY;
    const r  = _panelEl.getBoundingClientRect();
    _panelOX = e.clientX - r.left;
    _panelOY = e.clientY - r.top;
    _panelEl.style.transition = 'none';
    e.preventDefault();
  }

  function _onPanelMove(e) {
    if (!_panelDrag) return;
    if (!_panelMoved) {
      if (Math.abs(e.clientX - _panelSX) < 5 && Math.abs(e.clientY - _panelSY) < 5) return;
      _panelMoved = true;
    }
    const x = Math.max(0, Math.min(e.clientX - _panelOX, window.innerWidth  - (_panelEl.offsetWidth  || 360)));
    const y = Math.max(0, Math.min(e.clientY - _panelOY, window.innerHeight - (_panelEl.offsetHeight || 200)));
    _panelEl.style.left   = x + 'px';
    _panelEl.style.top    = y + 'px';
    _panelEl.style.right  = 'auto';
    _panelEl.style.bottom = 'auto';
  }

  function _onPanelUp() {
    if (!_panelDrag) return;
    _panelDrag = false;
    if (_panelMoved) {
      const r = _panelEl.getBoundingClientRect();
      try { localStorage.setItem('penPanelPos', JSON.stringify({ x: r.left, y: r.top })); } catch {}
    }
    _panelMoved = false;
    _panelEl.style.transition = '';
  }

  /* ================================================================
     PICKER MODAL — SET PENALTY POOL (from quest edit form)
     Everything below this line is UNCHANGED from before.
  ================================================================ */

  function openPickerForForm(quest, onConfirm) {
    _pickerCallback = onConfirm;
    _stagedItems = [];

    let existingModal = document.getElementById('quest-picker-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'quest-picker-modal';
    modal.className = 'qpm-backdrop';
    modal.innerHTML = `
      <div class="qpm-modal">
        <div class="qpm-scanlines"></div>
        <div class="qpm-header">
          <div class="qpm-title-row">
            <i data-lucide="skull" style="width:18px;height:18px;color:#ef4444;"></i>
            <h2 class="qpm-title" style="font-size:1.1rem;">SET PENALTY POOL</h2>
          </div>
          <p style="font-size:0.72rem;color:#64748b;margin:0.25rem 0 0;font-family:'JetBrains Mono',monospace;">
            Choose items from the library. If a timer expires, one of these becomes a required task.
          </p>
        </div>

        <div class="qpm-body">
          <div class="qpm-left">
            <div class="qpm-lib-tabs">
              <button class="qpm-lib-tab active" data-type="coding">
                <i data-lucide="code-2" style="width:12px;height:12px;display:inline;vertical-align:-2px;margin-right:4px;"></i>Coding Library
              </button>
              <button class="qpm-lib-tab" data-type="notes">
                <i data-lucide="notebook" style="width:12px;height:12px;display:inline;vertical-align:-2px;margin-right:4px;"></i>Notebook Library
              </button>
            </div>
            <div class="qpm-search-wrap">
              <i data-lucide="search" class="qpm-search-icon"></i>
              <input type="text" id="qpicker-search" class="qpm-search-input" placeholder="Search..." oninput="window._qpickerSearch(this.value)" />
            </div>
            <div class="qpm-lib-panel" data-type="coding" id="qpicker-coding-tree"></div>
            <div class="qpm-lib-panel" data-type="notes"  id="qpicker-notes-tree"  style="display:none;"></div>
          </div>

          <div class="qpm-right">
            <div class="qpm-staging-header">
              <i data-lucide="list-checks" style="width:13px;height:13px;color:#ef4444;"></i>
              SELECTED
            </div>
            <div class="qpm-staging-list" id="qpicker-staging-list">
              <div class="qpm-staging-empty">Pick items from the library.</div>
            </div>
          </div>
        </div>

        <div class="qpm-footer">
          <button class="qpm-dismiss-btn" onclick="window._qpickerDismiss()">CANCEL</button>
          <button class="qpm-confirm-btn" onclick="window._qpickerConfirm()">
            <i data-lucide="check" style="width:14px;height:14px;display:inline;vertical-align:-3px;margin-right:6px;"></i>
            ADD TO PENALTY POOL
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: modal });

    modal.querySelectorAll('.qpm-lib-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.qpm-lib-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.type;
        modal.querySelectorAll('.qpm-lib-panel').forEach(p => {
          p.style.display = p.dataset.type === type ? '' : 'none';
        });
        const searchEl = modal.querySelector('#qpicker-search');
        if (searchEl) searchEl.value = '';
        const panelId = type === 'coding' ? 'qpicker-coding-tree' : 'qpicker-notes-tree';
        _renderPickerTree(type, modal.querySelector('#' + panelId));
      });
    });

    _renderPickerTree('coding', modal.querySelector('#qpicker-coding-tree'));
    _renderPickerTree('notes',  modal.querySelector('#qpicker-notes-tree'));
  }

  function _renderPickerTree(type, containerEl) {
    if (!containerEl) return;
    const items = _getLibraryItems(type);
    if (!items || items.length === 0) {
      containerEl.innerHTML = `<div class="qpm-empty-lib">No ${type} library items found.</div>`;
      return;
    }

    const folders     = items.filter(i => i.type === 'folder');
    const rootFolders = folders.filter(f => !f.parentId);

    function renderFolder(folder) {
      const children  = items.filter(i => i.parentId === folder.id);
      if (!children.length) return '';
      const subFolders = children.filter(c => c.type === 'folder');
      const leafItems  = children.filter(c => c.type !== 'folder');
      return `<div class="qpm-folder">
        <div class="qpm-folder-label">
          <i data-lucide="folder" style="width:11px;height:11px;display:inline;vertical-align:-1px;margin-right:4px;color:#64748b;"></i>
          ${_esc(folder.name)}
        </div>
        <div class="qpm-folder-children">
          ${subFolders.map(renderFolder).join('')}
          ${leafItems.map(it => renderPickerItem(it, type)).join('')}
        </div>
      </div>`;
    }

    function renderPickerItem(item, srcType) {
      return `<label class="qpm-item-row">
        <input type="checkbox" class="qpm-item-check"
          data-item-id="${item.id}"
          data-item-name="${_esc(item.title || item.name)}"
          data-source-type="${srcType}"
          onchange="window._qpickerToggle(this)" />
        <span class="qpm-item-name">${_esc(item.title || item.name)}</span>
      </label>`;
    }

    const rootItems = items.filter(i => i.type !== 'folder' && !i.parentId);
    containerEl.innerHTML = rootFolders.map(renderFolder).join('') + rootItems.map(it => renderPickerItem(it, type)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: containerEl });
  }

  function _renderFilteredTree(type, containerEl, query, itemRenderer) {
    if (!containerEl) return;
    const all = _getLibraryItems(type);
    if (!all || all.length === 0) {
      containerEl.innerHTML = `<div class="qpm-empty-lib">No ${type} library items found.</div>`;
      return;
    }
    const q = query.trim().toLowerCase();
    if (!q) return;
    const leafItems = all.filter(i => i.type !== 'folder');
    const matched   = leafItems.filter(i => (i.title || i.name || '').toLowerCase().includes(q));
    if (matched.length === 0) {
      containerEl.innerHTML = `<div class="qpm-empty-lib">No results for "${_esc(query)}"</div>`;
      return;
    }
    containerEl.innerHTML = matched.map(it => itemRenderer(it, type)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: containerEl });
  }

  window._qpickerSearch = function (query) {
    const modal = document.getElementById('quest-picker-modal');
    if (!modal) return;
    const activeTab = modal.querySelector('.qpm-lib-tab.active');
    const type      = activeTab ? activeTab.dataset.type : 'coding';
    const panelId   = type === 'coding' ? 'qpicker-coding-tree' : 'qpicker-notes-tree';
    const container = modal.querySelector('#' + panelId);
    if (!query.trim()) { _renderPickerTree(type, container); return; }
    function pickerItemRenderer(item, srcType) {
      return `<label class="qpm-item-row">
        <input type="checkbox" class="qpm-item-check"
          data-item-id="${item.id}"
          data-item-name="${_esc(item.title || item.name)}"
          data-source-type="${srcType}"
          onchange="window._qpickerToggle(this)" />
        <span class="qpm-item-name">${_esc(item.title || item.name)}</span>
      </label>`;
    }
    _renderFilteredTree(type, container, query, pickerItemRenderer);
  };

  window._qpickerToggle = function (cb) {
    const itemId   = cb.dataset.itemId;
    const itemName = cb.dataset.itemName;
    const srcType  = cb.dataset.sourceType;
    if (cb.checked) {
      if (!_stagedItems.find(s => s.itemId === itemId)) {
        _stagedItems.push({ sourceType: srcType, itemId, itemName, multiplier: 1 });
      }
    } else {
      _stagedItems = _stagedItems.filter(s => s.itemId !== itemId);
    }
    const sl = document.getElementById('qpicker-staging-list');
    if (sl) {
      sl.innerHTML = _stagedItems.length === 0
        ? '<div class="qpm-staging-empty">Pick items from the library.</div>'
        : _stagedItems.map(s => `
            <div class="qpm-staged-row">
              <div class="qpm-staged-info">
                <span class="qpm-staged-name">${_esc(s.itemName)}</span>
                <span class="qpm-staged-quest" style="color:${s.sourceType==='coding'?'#38bdf8':'#a78bfa'};">${s.sourceType}</span>
              </div>
            </div>`).join('');
    }
  };

  window._qpickerConfirm = function () {
    if (_pickerCallback) _pickerCallback([..._stagedItems]);
    _pickerCallback = null;
    _stagedItems = [];
    const modal = document.getElementById('quest-picker-modal');
    if (modal) { modal.classList.add('qpm-closing'); setTimeout(() => modal.remove(), 200); }
  };

  window._qpickerDismiss = function () {
    _pickerCallback = null;
    _stagedItems = [];
    const modal = document.getElementById('quest-picker-modal');
    if (modal) { modal.classList.add('qpm-closing'); setTimeout(() => modal.remove(), 200); }
  };

  /* ── Library data reader ──────────────────────────────────── */
  function _getLibraryItems(type) {
    if (typeof state === 'undefined') return [];
    if (type === 'coding') {
      const nodes      = (state.nodes      || []).filter(n => n.scope === 'challenge');
      const challenges = (state.challenges || []).map(c => ({ id: c.id, title: c.title, type: 'challenge', parentId: c.parentId || null }));
      return [...nodes, ...challenges];
    } else {
      const nodes     = (state.nodes     || []).filter(n => n.scope === 'notebook');
      const notebooks = (state.notebooks || []).map(n => ({ id: n.id, title: n.title, name: n.title, type: 'notebook', parentId: n.parentId || null }));
      return [...nodes, ...notebooks];
    }
  }

  /* ── Shared helpers ───────────────────────────────────────── */
  function _fmtSecs(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`;
  }

  function _rankColor(rank) {
    return ({ E:'#94a3b8', D:'#22c55e', C:'#3b82f6', B:'#a855f7', A:'#f97316', S:'#ef4444' })[rank] || '#94a3b8';
  }

  function _esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ================================================================
     INJECT CSS + FLASH OVERLAY
  ================================================================ */
  function _injectFlashOverlay() {
    if (document.getElementById('quest-penalty-flash')) return;

    /* Flash element */
    const flash = document.createElement('div');
    flash.id = 'quest-penalty-flash';
    document.body.appendChild(flash);

    /* All CSS injected once */
    const style = document.createElement('style');
    style.textContent = `
      /* ── Screen-edge flash ── */
      #quest-penalty-flash {
        position: fixed; inset: 0;
        pointer-events: none; z-index: 9999; border-radius: 0;
      }
      #quest-penalty-flash.flash-active {
        animation: questPenaltyFlash 1.2s ease-out forwards;
      }
      @keyframes questPenaltyFlash {
        0%   { box-shadow: inset 0 0 0px   0px  rgba(239,68,68,0);   }
        15%  { box-shadow: inset 0 0 60px  40px rgba(239,68,68,0.7); }
        40%  { box-shadow: inset 0 0 40px  20px rgba(239,68,68,0.5); }
        100% { box-shadow: inset 0 0 0px   0px  rgba(239,68,68,0);   }
      }

      /* ================================================================
         FLOATING PENALTY PANEL
      ================================================================ */
      #qpen-panel-root { pointer-events: all; }

      .qpen-panel {
        position: relative;
        width: 360px;
        background: rgba(14, 4, 8, 0.97);
        border: 1.5px solid rgba(239, 68, 68, 0.4);
        border-radius: 6px;
        overflow: hidden;
        box-shadow:
          0 0 0 1px rgba(239,68,68,0.06) inset,
          0 0 40px rgba(239,68,68,0.12),
          0 16px 60px rgba(0,0,0,0.85);
        animation: qpenFadeIn 280ms cubic-bezier(0.34,1.56,0.64,1) forwards;
        --qpen-corner: rgba(239,68,68,0.55);
      }
      .qpen-panel::before, .qpen-panel::after {
        content: ''; position: absolute;
        width: 10px; height: 10px;
        pointer-events: none; z-index: 10;
      }
      .qpen-panel::before {
        top: 0; left: 0;
        border-top: 2px solid var(--qpen-corner);
        border-left: 2px solid var(--qpen-corner);
      }
      .qpen-panel::after {
        bottom: 0; right: 0;
        border-bottom: 2px solid var(--qpen-corner);
        border-right: 2px solid var(--qpen-corner);
      }
      @keyframes qpenFadeIn {
        from { opacity: 0; transform: translateY(10px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }

      .qpen-scanlines {
        position: absolute; inset: 0; pointer-events: none; z-index: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent, transparent 2px,
          rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px
        );
      }

      /* Header */
      .qpen-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.8rem 1rem;
        background: rgba(239,68,68,0.07);
        border-bottom: 1px solid rgba(239,68,68,0.2);
        cursor: grab; user-select: none;
        position: relative; z-index: 1;
      }
      .qpen-header:active { cursor: grabbing; }

      .qpen-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 0.65rem; font-weight: 900;
        text-transform: uppercase; letter-spacing: 2px;
        color: #ef4444;
        text-shadow: 0 0 12px rgba(239,68,68,0.45);
        display: flex; align-items: center; gap: 0.4rem;
      }

      .qpen-header-right {
        display: flex; align-items: center; gap: 0.4rem;
      }

      .qpen-count-pill {
        min-width: 20px; height: 18px; padding: 0 5px;
        background: rgba(239,68,68,0.18);
        border: 1px solid rgba(239,68,68,0.4);
        border-radius: 99px;
        font-size: 0.6rem; font-weight: 800;
        color: #f87171;
        font-family: 'JetBrains Mono', monospace;
        display: flex; align-items: center; justify-content: center;
      }

      .qpen-hdr-btn {
        width: 22px; height: 22px;
        background: transparent;
        border: 1px solid rgba(51,65,85,0.7);
        border-radius: 3px; color: #64748b;
        cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        transition: all 150ms ease-out; padding: 0;
      }
      .qpen-hdr-btn:hover {
        background: rgba(239,68,68,0.1);
        border-color: rgba(239,68,68,0.5); color: #f87171;
      }

      /* Cards list */
      .qpen-cards-list {
        max-height: 420px;
        overflow-y: auto;
        padding: 0.6rem;
        display: flex; flex-direction: column; gap: 0.5rem;
        position: relative; z-index: 1;
        scrollbar-width: thin;
        scrollbar-color: rgba(239,68,68,0.3) transparent;
      }
      .qpen-cards-list::-webkit-scrollbar { width: 3px; }
      .qpen-cards-list::-webkit-scrollbar-thumb { background: rgba(239,68,68,0.3); border-radius: 99px; }

      /* Individual penalty card */
      .qpen-card {
        position: relative;
        background: rgba(20, 6, 6, 0.85);
        border: 1px solid rgba(239,68,68,0.18);
        border-left: 3px solid #ef4444;
        border-radius: 5px;
        padding: 0.7rem 0.8rem 0.65rem;
        transition: border-color 120ms ease-out;
      }
      .qpen-card:hover { border-color: rgba(239,68,68,0.35); }

      /* Multiplier badge — top-right corner of card */
      .qpen-mult-badge {
        position: absolute;
        top: -8px; right: -8px;
        min-width: 26px; height: 26px; padding: 0 5px;
        background: #f97316;
        border: 2px solid rgba(14,4,8,0.9);
        border-radius: 99px;
        font-size: 0.65rem; font-weight: 900;
        color: #fff;
        font-family: 'JetBrains Mono', monospace;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 10px rgba(249,115,22,0.5);
        z-index: 2;
      }

      .qpen-card-badges {
        display: flex; align-items: center; gap: 0.4rem;
        margin-bottom: 0.45rem;
      }

      .qpen-src-badge {
        display: inline-flex; align-items: center;
        padding: 2px 7px;
        border-radius: 3px;
        font-size: 0.58rem; font-weight: 800;
        font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
      }
      .qpen-src-badge.code {
        color: #38bdf8; background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.3);
      }
      .qpen-src-badge.note {
        color: #a78bfa; background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.3);
      }

      .qpen-rank-badge {
        padding: 1px 6px;
        border-radius: 3px; border: 1px solid;
        font-size: 0.58rem; font-weight: 900;
        font-family: 'Orbitron', sans-serif;
      }

      .qpen-card-name {
        font-size: 0.82rem; font-weight: 700;
        color: #f1f5f9;
        font-family: 'Orbitron', sans-serif;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        margin-bottom: 0.15rem; letter-spacing: 0.2px;
      }

      .qpen-card-quest {
        font-size: 0.65rem; color: #475569;
        font-family: 'JetBrains Mono', monospace;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        margin-bottom: 0.4rem;
      }

      .qpen-card-elapsed {
        font-size: 0.68rem;
        color: #ef4444;
        font-family: 'JetBrains Mono', monospace;
        font-feature-settings: 'tnum';
        margin-bottom: 0.55rem;
        display: flex; align-items: center;
        animation: penElapsedPulse 2s ease-in-out infinite;
      }
      @keyframes penElapsedPulse {
        0%,100% { opacity: 1; }
        50% { opacity: 0.65; }
      }

      .qpen-card-actions {
        display: flex; gap: 0.4rem;
      }

      .qpen-card-hint {
        margin-top: 0.45rem;
        font-size: 0.58rem;
        color: #64748b;
        font-family: 'JetBrains Mono', monospace;
        line-height: 1.4;
      }

      .qpen-attempt-btn, .qpen-done-btn {
        flex: 1; padding: 0.4rem 0.5rem;
        border-radius: 4px; cursor: pointer;
        font-size: 0.62rem; font-weight: 800;
        text-transform: uppercase; letter-spacing: 0.8px;
        font-family: 'Orbitron', sans-serif;
        display: flex; align-items: center; justify-content: center;
        transition: all 150ms ease-out;
      }
      .qpen-attempt-btn {
        background: rgba(59,130,246,0.08);
        border: 1px solid rgba(59,130,246,0.35);
        color: #60a5fa;
      }
      .qpen-attempt-btn:hover {
        background: rgba(59,130,246,0.18);
        border-color: rgba(59,130,246,0.6);
        box-shadow: 0 0 10px rgba(59,130,246,0.15);
      }
      .qpen-done-btn {
        background: rgba(34,197,94,0.08);
        border: 1px solid rgba(34,197,94,0.35);
        color: #4ade80;
      }
      .qpen-done-btn:hover {
        background: rgba(34,197,94,0.18);
        border-color: rgba(34,197,94,0.6);
        box-shadow: 0 0 10px rgba(34,197,94,0.15);
      }

      /* ================================================================
         PICKER MODAL — SET PENALTY POOL
      ================================================================ */
      .qpm-backdrop {
        position: fixed; inset: 0;
        background: rgba(2,6,23,0.75);
        backdrop-filter: blur(6px);
        z-index: 9500;
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
        animation: qpmFadeIn 200ms ease-out forwards;
      }
      .qpm-backdrop.qpm-closing { animation: qpmFadeOut 200ms ease-in forwards; }
      @keyframes qpmFadeIn  { from { opacity:0; } to { opacity:1; } }
      @keyframes qpmFadeOut { from { opacity:1; } to { opacity:0; } }

      .qpm-modal {
        position: relative;
        background: rgba(7,12,28,0.97);
        border: 1px solid rgba(239,68,68,0.5);
        border-radius: 12px;
        width: 100%; max-width: 760px; max-height: 90vh;
        display: flex; flex-direction: column;
        overflow: hidden;
        box-shadow: 0 0 60px rgba(239,68,68,0.15), 0 20px 60px rgba(0,0,0,0.7);
        animation: qpmSlideIn 250ms cubic-bezier(0.34,1.56,0.64,1) forwards;
      }
      @keyframes qpmSlideIn {
        from { transform: translateY(20px) scale(0.97); opacity:0; }
        to   { transform: translateY(0)    scale(1);    opacity:1; }
      }

      .qpm-scanlines {
        position: absolute; inset: 0; pointer-events: none; z-index: 0;
        background: repeating-linear-gradient(0deg,
          transparent, transparent 2px,
          rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
      }

      .qpm-header {
        padding: 1.25rem 1.5rem 1rem;
        border-bottom: 1px solid rgba(239,68,68,0.3);
        flex-shrink: 0; position: relative; z-index: 1;
      }
      .qpm-title-row { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem; }
      .qpm-title {
        font-family: 'Orbitron', sans-serif; font-size: 1.3rem; font-weight: 900;
        color: #ef4444; text-shadow: 0 0 20px rgba(239,68,68,0.5);
        letter-spacing: 2px; margin: 0;
      }

      .qpm-body {
        display: flex; flex: 1; min-height: 0;
        position: relative; z-index: 1;
      }

      .qpm-left {
        flex: 1; display: flex; flex-direction: column;
        border-right: 1px solid rgba(51,65,85,0.4); min-width: 0;
      }
      .qpm-lib-tabs {
        display: flex; border-bottom: 1px solid rgba(51,65,85,0.4); flex-shrink: 0;
      }
      .qpm-lib-tab {
        flex: 1; padding: 0.5rem 0.75rem;
        background: transparent; border: none;
        border-bottom: 2px solid transparent;
        color: #64748b; font-size: 0.7rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.8px;
        cursor: pointer; font-family: 'Orbitron', sans-serif;
        transition: all 150ms ease-out; margin-bottom: -1px;
      }
      .qpm-lib-tab.active { color: #ef4444; border-bottom-color: #ef4444; }
      .qpm-lib-tab:hover:not(.active) { color: #94a3b8; }

      .qpm-search-wrap {
        position: relative; padding: 0.4rem 0.5rem;
        border-bottom: 1px solid rgba(51,65,85,0.4); flex-shrink: 0;
      }
      .qpm-search-icon {
        position: absolute; left: 1.1rem; top: 50%;
        transform: translateY(-50%);
        width: 12px; height: 12px; color: #475569; pointer-events: none;
      }
      .qpm-search-input {
        width: 100%; padding: 0.3rem 0.5rem 0.3rem 2rem;
        background: rgba(15,23,42,0.7);
        border: 1px solid rgba(51,65,85,0.5);
        border-radius: 6px; color: #cbd5e1;
        font-size: 0.72rem; font-family: 'JetBrains Mono', monospace;
        box-sizing: border-box; transition: border-color 150ms ease-out;
      }
      .qpm-search-input::placeholder { color: #475569; }
      .qpm-search-input:focus {
        outline: none; border-color: rgba(239,68,68,0.5);
        box-shadow: 0 0 0 2px rgba(239,68,68,0.08);
      }

      .qpm-lib-panel {
        flex: 1; overflow-y: auto; padding: 0.5rem;
        scrollbar-width: thin; scrollbar-color: rgba(51,65,85,0.6) transparent;
        max-height: 340px;
      }
      .qpm-lib-panel::-webkit-scrollbar { width: 3px; }
      .qpm-lib-panel::-webkit-scrollbar-thumb { background: rgba(51,65,85,0.6); border-radius: 99px; }

      .qpm-folder { margin-bottom: 4px; }
      .qpm-folder-label {
        font-size: 0.65rem; font-weight: 700; color: #64748b;
        text-transform: uppercase; letter-spacing: 0.5px;
        padding: 0.2rem 0.35rem; font-family: 'Orbitron', sans-serif;
      }
      .qpm-folder-children { padding-left: 0.75rem; border-left: 1px solid rgba(51,65,85,0.3); }

      .qpm-item-row {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.3rem 0.5rem; border-radius: 6px;
        cursor: pointer; transition: background 100ms ease-out; margin-bottom: 2px;
      }
      .qpm-item-row:hover { background: rgba(255,255,255,0.04); }

      .qpm-item-check { width:14px; height:14px; accent-color:#ef4444; cursor:pointer; flex-shrink:0; }
      .qpm-item-name {
        flex: 1; font-size: 0.77rem; color: #cbd5e1;
        font-family: 'JetBrains Mono', monospace;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      .qpm-empty-lib {
        padding: 1.5rem; text-align: center;
        font-size: 0.78rem; color: #475569; font-family: 'JetBrains Mono', monospace;
      }

      .qpm-right {
        width: 240px; flex-shrink: 0;
        display: flex; flex-direction: column;
        background: rgba(2,6,23,0.5);
      }
      .qpm-staging-header {
        display: flex; align-items: center; gap: 0.4rem;
        padding: 0.55rem 0.75rem;
        font-size: 0.65rem; font-weight: 700;
        color: #ef4444; text-transform: uppercase; letter-spacing: 1px;
        border-bottom: 1px solid rgba(51,65,85,0.4);
        font-family: 'Orbitron', sans-serif; flex-shrink: 0;
      }
      .qpm-staging-list {
        flex: 1; overflow-y: auto; padding: 0.4rem;
        scrollbar-width: thin; scrollbar-color: rgba(51,65,85,0.6) transparent;
        max-height: 340px;
      }
      .qpm-staging-list::-webkit-scrollbar { width: 3px; }
      .qpm-staging-list::-webkit-scrollbar-thumb { background: rgba(51,65,85,0.6); border-radius: 99px; }

      .qpm-staging-empty {
        padding: 1.5rem 0.75rem; text-align: center;
        font-size: 0.72rem; color: #475569;
        font-family: 'JetBrains Mono', monospace; line-height: 1.6;
      }

      .qpm-staged-row {
        display: flex; align-items: center; gap: 0.35rem;
        padding: 0.35rem 0.4rem; border-radius: 6px;
        background: rgba(239,68,68,0.07);
        border: 1px solid rgba(239,68,68,0.2); margin-bottom: 4px;
      }
      .qpm-staged-info { flex: 1; min-width: 0; }
      .qpm-staged-name {
        display: block; font-size: 0.75rem; color: #f1f5f9;
        font-family: 'JetBrains Mono', monospace;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .qpm-staged-quest {
        display: block; font-size: 0.62rem; color: #64748b;
        font-family: 'JetBrains Mono', monospace;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      .qpm-footer {
        display: flex; align-items: center; justify-content: flex-end;
        gap: 0.75rem; padding: 0.85rem 1.5rem;
        border-top: 1px solid rgba(51,65,85,0.4);
        flex-shrink: 0; position: relative; z-index: 1;
        background: rgba(7,12,28,0.8);
      }
      .qpm-dismiss-btn {
        padding: 0.5rem 1.25rem; background: transparent;
        border: 1px solid rgba(51,65,85,0.6); border-radius: 8px;
        color: #64748b; font-size: 0.75rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 1px;
        cursor: pointer; font-family: 'Orbitron', sans-serif;
        transition: all 150ms ease-out;
      }
      .qpm-dismiss-btn:hover { color: #94a3b8; border-color: #94a3b8; }
      .qpm-confirm-btn {
        padding: 0.5rem 1.5rem;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.6); border-radius: 8px;
        color: #ef4444; font-size: 0.78rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 1px;
        cursor: pointer; font-family: 'Orbitron', sans-serif;
        transition: all 150ms ease-out;
      }
      .qpm-confirm-btn:hover {
        background: rgba(239,68,68,0.2);
        box-shadow: 0 0 16px rgba(239,68,68,0.2);
      }

      @media (max-width: 600px) {
        .qpm-body { flex-direction: column; }
        .qpm-right { width:100%; max-height:180px; border-right:none; border-top:1px solid rgba(51,65,85,0.4); }
        .qpm-lib-panel { max-height: 200px; }
        .qpen-panel { width: calc(100vw - 32px); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Init ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectFlashOverlay);
  } else {
    _injectFlashOverlay();
  }
})();

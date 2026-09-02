/* ============================================================
   DIALOGS.JS — Modal / Dialog System + Focus Trap
   ============================================================ */

let _focusTrapCleanup = null;
let _previouslyFocused = null;

/** Trap Tab focus inside a modal container until released. */
function _trapFocus(modalEl) {
  _releaseFocusTrap();
  _previouslyFocused = document.activeElement;
  const focusable = () => modalEl.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const els = focusable();
    if (els.length === 0) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  modalEl.addEventListener('keydown', handler);
  _focusTrapCleanup = () => modalEl.removeEventListener('keydown', handler);
  // Auto-focus first focusable element
  requestAnimationFrame(() => {
    const els = focusable();
    if (els.length > 0) els[els.length > 1 ? els.length - 1 : 0].focus();
  });
}

function _releaseFocusTrap() {
  if (_focusTrapCleanup) { _focusTrapCleanup(); _focusTrapCleanup = null; }
  if (_previouslyFocused && typeof _previouslyFocused.focus === 'function') {
    try { _previouslyFocused.focus(); } catch (e) {}
  }
  _previouslyFocused = null;
}

// Smooth modal close with fade-out animation
function closeModalSmooth(modalEl) {
  if (!modalEl) return;
  _releaseFocusTrap();
  const content = modalEl.querySelector('.modal-content');
  modalEl.style.transition = 'opacity 0.2s ease';
  modalEl.style.opacity = '0';
  if (content) {
    content.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    content.style.transform = 'scale(0.95)';
    content.style.opacity = '0';
  }
  setTimeout(() => {
    modalEl.classList.add('hidden');
    modalEl.style.opacity = '';
    modalEl.style.transition = '';
    if (content) {
      content.style.transform = '';
      content.style.opacity = '';
      content.style.transition = '';
    }
  }, 200);
}

/** @param {string} title @param {string} message @param {boolean} [isError] */
function showMessage(title, message, isError = false) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) { alert(title + ': ' + message); return; }
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', title);
  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message;
  const iconEl = document.getElementById('dialog-icon');
  iconEl.innerHTML = isError
    ? '<i data-lucide="alert-circle" class="modal-icon-svg" style="color: var(--color-danger);"></i>'
    : '<i data-lucide="info" class="modal-icon-svg" style="color: var(--color-primary);"></i>';
  document.getElementById('dialog-actions').innerHTML = `
    <button onclick="closeModalSmooth(document.getElementById('dialog-modal'))" class="btn btn-secondary" style="flex:1;">OK</button>
  `;
  modal.classList.remove('hidden');
  _trapFocus(modal);
  if (isError) {
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.style.animation = 'none';
      void content.offsetWidth;
      content.style.animation = 'shake 0.5s ease-in-out, bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
  }
  lucide.createIcons({ root: modal });
}

/** @param {string} title @param {string} message @param {function} onConfirm */
function showConfirm(title, message, onConfirm) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) { if (confirm(title + ': ' + message)) onConfirm(); return; }
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', title);
  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message;
  document.getElementById('dialog-icon').innerHTML = '<i data-lucide="help-circle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <button id="dlg-cancel" class="btn btn-secondary" style="flex:1;">Cancel</button>
    <button id="dlg-confirm" class="btn btn-danger" style="flex:1;">Confirm</button>
  `;

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);
  document.getElementById('dlg-confirm').onclick = () => {
    closeModalSmooth(modal);
    onConfirm();
  };

  modal.classList.remove('hidden');
  _trapFocus(modal);
  lucide.createIcons({ root: modal });
}

/**
 * Two ways forward plus Cancel, where neither way is the obvious one.
 *
 * showConfirm has a single Confirm, which forces a question with two real
 * answers to be asked as two questions or to quietly pick one. Leaving an
 * attempt is exactly that: keeping the work and throwing it away are both
 * legitimate, and the app should not choose.
 *
 * @param {object} o  { title, message, primary, secondary, danger, onPrimary, onSecondary }
 *   `primary` is the safe one and is styled as such; `secondary` carries the
 *   destructive styling when `danger` is set.
 */
function showChoice(o) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    // No modal host: fall back to the browser's one question, and take the
    // SAFE branch on cancel rather than the destructive one.
    if (confirm(o.title + ': ' + o.message + '\n\nOK = ' + o.primary + ', Cancel = stay')) o.onPrimary();
    return;
  }
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', o.title);
  document.getElementById('dialog-title').innerText = o.title;
  document.getElementById('dialog-msg').innerText = o.message;
  document.getElementById('dialog-icon').innerHTML =
    '<i data-lucide="help-circle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML =
    '<button id="dlg-cancel" class="btn btn-ghost" style="flex:1;">Cancel</button>'
    + '<button id="dlg-second" class="btn ' + (o.danger ? 'btn-danger' : 'btn-secondary')
    + '" style="flex:1;">' + escapeHTML(o.secondary) + '</button>'
    + '<button id="dlg-primary" class="btn btn-primary" style="flex:1;">' + escapeHTML(o.primary) + '</button>';

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);
  document.getElementById('dlg-second').onclick = () => {
    closeModalSmooth(modal);
    if (o.onSecondary) o.onSecondary();
  };
  document.getElementById('dlg-primary').onclick = () => {
    closeModalSmooth(modal);
    if (o.onPrimary) o.onPrimary();
  };

  modal.classList.remove('hidden');
  _trapFocus(modal);
  lucide.createIcons({ root: modal });
}

function showUnsavedConfirm(onDiscard, onSave) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    if (confirm('You have unsaved changes. Discard?')) onDiscard();
    return;
  }
  document.getElementById('dialog-title').innerText = 'Unsaved Changes';
  document.getElementById('dialog-msg').innerText = 'You have unsaved modifications. What would you like to do?';
  document.getElementById('dialog-icon').innerHTML = '<i data-lucide="alert-triangle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <button id="dlg-cancel" class="btn btn-ghost" style="flex:1;">Cancel</button>
    <button id="dlg-discard" class="btn btn-danger" style="flex:1;">Discard</button>
    <button id="dlg-save" class="btn btn-primary" style="flex:1;">Save Changes</button>
  `;

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);
  document.getElementById('dlg-discard').onclick = () => {
    closeModalSmooth(modal);
    onDiscard();
  };
  document.getElementById('dlg-save').onclick = () => {
    closeModalSmooth(modal);
    onSave();
  };

  modal.classList.remove('hidden');
  lucide.createIcons({ root: modal });
}

/** Truncate program output for compact display in the result modal. */
function _rmTrunc(s, n) {
  s = String(s == null ? '' : s);
  if (s === '') return '(no output)';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function showResultModal(data) {
  const modal = document.getElementById('result-modal');
  if (!modal) return;
  const iconContainer = document.getElementById('rm-icon');
  const titleEl = document.getElementById('rm-title');
  const descEl = document.getElementById('rm-desc');
  const actionsEl = document.getElementById('rm-actions');

  if (typeof data === 'number') {
    data = { score: data, isPerfect: arguments[1], earnedBadges: arguments[2] || [] };
  }

  const { score, isPerfect, earnedBadges = [], perFileScores = [], duration = 0, linesMatched = 0, linesTotal = 0, attemptNumber = 1, prevScore = null, hintsUsed = 0 } = data;

  let badgesHTML = '';
  if (earnedBadges.length > 0) {
    badgesHTML = `
      <div class="result-badges-container">
        <div class="result-badges-title">Achievement Unlocked!</div>
        ${earnedBadges.map(b => `
          <div class="result-badge-item">
            <span class="result-badge-icon">${b.icon}</span>
            <div>
              <div class="result-badge-name">${escapeHTML(b.name)}</div>
              <div class="result-badge-desc">${escapeHTML(b.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  const deltaHTML = prevScore !== null
    ? (() => {
        const diff = score - prevScore;
        if (diff > 0) return `<span style="color:var(--color-success);">+${diff}% from last</span>`;
        if (diff < 0) return `<span style="color:var(--color-danger);">${diff}% from last</span>`;
        return `<span style="color:var(--text-tertiary);">Same as last</span>`;
      })()
    : `<span style="color:var(--text-tertiary);">First attempt</span>`;

  const hintHTML = hintsUsed > 0
    ? `<div style="color:var(--color-warning); font-size:0.75rem; margin-top:0.375rem;">-${hintsUsed * 5}% hint penalty applied (${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} used)</div>`
    : '';

  let fileBreakdownHTML = '';
  if (perFileScores.length > 1) {
    fileBreakdownHTML = `<div class="result-file-breakdown">${perFileScores.map(f => {
      const barColor = f.score === 100 ? 'var(--color-success)' : f.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
      return `<div class="result-file-row">
        <span class="result-file-name">${escapeHTML(f.name)}</span>
        <div class="result-file-bar"><div class="result-file-fill" style="width:${f.score}%; background:${barColor};"></div></div>
        <span class="result-file-pct">${f.score}%</span>
      </div>`;
    }).join('')}</div>`;
  }

  // Test-case results (when the challenge has authored tests)
  let testHTML = '';
  if (data.testResults && data.testResults.length > 0) {
    const tr = data.testResults;
    const passed = tr.filter(r => r.passed).length;
    const headColor = passed === tr.length ? 'var(--color-success)' : 'var(--color-warning)';
    testHTML = `
      <div style="margin-top:0.75rem; text-align:left; border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden;">
        <div style="display:flex; align-items:center; gap:0.4rem; padding:0.5rem 0.75rem; background:var(--bg-surface-hover); font-size:0.8125rem; font-weight:700; color:${headColor};">
          <i data-lucide="flask-conical" style="width:14px;height:14px;"></i> Tests passed: ${passed}/${tr.length}
        </div>
        <div style="display:flex; flex-direction:column; max-height:210px; overflow-y:auto;">
          ${tr.map(r => {
            const ok = r.passed;
            const color = ok ? 'var(--color-success)' : 'var(--color-danger)';
            const detail = (!ok && !r.hidden) ? `
              <div style="padding:0.1rem 0.75rem 0.6rem 1.9rem; font-family:var(--font-mono); font-size:0.7rem;">
                ${r.error ? `<div style="color:var(--color-danger); margin-bottom:0.3rem;">${escapeHTML(r.error)}</div>` : ''}
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                  <div><div style="color:var(--text-tertiary); margin-bottom:0.15rem;">Expected</div><pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:var(--bg-surface); padding:0.35rem 0.45rem; border-radius:4px; color:var(--color-success);">${escapeHTML(_rmTrunc(r.expected, 400))}</pre></div>
                  <div><div style="color:var(--text-tertiary); margin-bottom:0.15rem;">Got</div><pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:var(--bg-surface); padding:0.35rem 0.45rem; border-radius:4px; color:var(--text-secondary);">${escapeHTML(_rmTrunc(r.actual, 400))}</pre></div>
                </div>
              </div>` : '';
            return `
              <div style="display:flex; align-items:center; gap:0.45rem; padding:0.4rem 0.75rem; border-top:1px solid var(--border-color);">
                <i data-lucide="${ok ? 'check-circle-2' : 'x-circle'}" style="width:14px;height:14px;color:${color};flex-shrink:0;"></i>
                <span style="font-size:0.8125rem; color:var(--text-primary);">${escapeHTML(r.name)}</span>
                ${r.hidden ? '<span style="font-size:0.7rem; color:var(--text-tertiary); margin-left:0.25rem;">(hidden)</span>' : ''}
                <span style="margin-left:auto; font-size:0.72rem; font-weight:700; color:${color};">${ok ? 'PASS' : 'FAIL'}</span>
              </div>
              ${detail}
            `;
          }).join('')}
        </div>
      </div>`;
  }

  const statsHTML = `
    <div class="result-stats-row">
      <div class="result-stat"><span class="result-stat-value">${typeof formatTimeDisplay === 'function' ? formatTimeDisplay(duration) : duration + 's'}</span><span class="result-stat-label">Time</span></div>
      <div class="result-stat"><span class="result-stat-value">${linesMatched}/${linesTotal}</span><span class="result-stat-label">Lines</span></div>
      <div class="result-stat"><span class="result-stat-value">#${attemptNumber}</span><span class="result-stat-label">Attempt</span></div>
      <div class="result-stat"><span class="result-stat-value">${deltaHTML}</span><span class="result-stat-label">Trend</span></div>
    </div>
    ${testHTML}
    ${fileBreakdownHTML}
    ${hintHTML}
    ${badgesHTML}
  `;

  const _testsLabel = (data.testResults && data.testResults.length)
    ? `${data.testResults.filter(r => r.passed).length}/${data.testResults.length} tests`
    : '';

  if (isPerfect) {
    iconContainer.innerHTML = '<i data-lucide="check-circle-2" class="modal-icon-svg" style="color: var(--color-success);"></i>';
    titleEl.innerText = (data.scoreBasis === 'tests') ? 'All Tests Passed! 🎉' : 'Perfect Score!';
    descEl.innerHTML = statsHTML;
    actionsEl.innerHTML = `
      <button onclick="closeResultModal(); goToSolution();" class="btn btn-secondary" style="flex:1;">
        <i data-lucide="file-diff" style="width:18px;height:18px;"></i> View Solution
      </button>
      <button onclick="closeResultModal(); spaNavigate('browse');" class="btn btn-primary" style="flex:1;">Continue</button>
    `;
  } else {
    iconContainer.innerHTML = '<i data-lucide="alert-circle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';
    titleEl.innerText = (data.scoreBasis === 'tests') ? `${score}% · ${_testsLabel}` : score + '% Match';
    descEl.innerHTML = statsHTML;
    actionsEl.innerHTML = `
      <button onclick="retryPractice()" class="btn btn-secondary" style="flex:1;">
        <i data-lucide="refresh-ccw" style="width:18px;height:18px;"></i> Retry
      </button>
      <button onclick="closeResultModal(); goToSolution();" class="btn btn-primary" style="flex:1;">
        <i data-lucide="file-text" style="width:18px;height:18px;"></i> Check Solution
      </button>
    `;
  }

  modal.classList.remove('hidden');
  lucide.createIcons({ root: modal });
}

function closeResultModal() {
  const modal = document.getElementById('result-modal');
  if (modal) modal.classList.add('hidden');
}

// ── showInputDialog — replaces native prompt() ──
// onConfirm receives the trimmed non-empty string the user typed.
/** Replaces native prompt(). @param {string} title @param {string|null} message @param {string} placeholder @param {string} defaultValue @param {function(string): void} onConfirm called only with non-empty trimmed value */
function showInputDialog(title, message, placeholder, defaultValue, onConfirm) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    const result = prompt(message || title, defaultValue || '');
    if (result !== null && result.trim()) onConfirm(result.trim());
    return;
  }

  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message || '';
  document.getElementById('dialog-icon').innerHTML =
    '<i data-lucide="edit-3" class="modal-icon-svg" style="color:var(--color-primary);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.625rem;width:100%;">
      <input id="dlg-input" class="form-input"
        placeholder="${escapeHTML(placeholder || '')}"
        value="${escapeHTML(defaultValue || '')}"
        style="width:100%;" />
      <div style="display:flex;gap:0.5rem;">
        <button id="dlg-cancel" class="btn btn-secondary" style="flex:1;">Cancel</button>
        <button id="dlg-confirm" class="btn btn-primary" style="flex:1;">Confirm</button>
      </div>
    </div>
  `;

  const input = document.getElementById('dlg-input');
  const doConfirm = () => {
    const val = input.value.trim();
    if (!val) { input.focus(); return; }
    closeModalSmooth(modal);
    onConfirm(val);
  };

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);
  document.getElementById('dlg-confirm').onclick = doConfirm;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doConfirm(); });

  modal.classList.remove('hidden');
  lucide.createIcons({ root: modal });
  setTimeout(() => input.focus(), 80);
}

// ── showListPickerDialog — replaces numbered-list prompt() ──
// options = [{ label: string (HTML-safe), value: any }]
// onConfirm receives the chosen option's value, or null for "Root".
/** Replaces numbered-list prompt(). @param {string} title @param {string|null} message @param {Array<{label:string,value:*}>} options @param {function(*): void} onConfirm called with selected value (null = root) */
function showListPickerDialog(title, message, options, onConfirm) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    let opts = '0 — Root (no parent)\n';
    options.forEach((o, i) => { opts += `${i + 1} — ${o.label}\n`; });
    const choice = prompt('Choose destination:\n' + opts);
    if (choice === null) return;
    const idx = parseInt(choice);
    if (!isNaN(idx)) onConfirm(idx === 0 ? null : (options[idx - 1]?.value ?? null));
    return;
  }

  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message || '';
  document.getElementById('dialog-icon').innerHTML =
    '<i data-lucide="folder-tree" class="modal-icon-svg" style="color:var(--color-primary);"></i>';

  const allOpts = [{ label: 'Root (no parent)', value: null }, ...options];

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.625rem;width:100%;">
      <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:0.25rem;">
        ${allOpts.map((o, i) => `
          <div class="dlg-pick-item" data-idx="${i}"
            style="padding:0.5rem 0.75rem;border-radius:var(--radius-sm);cursor:pointer;
                   border:1px solid var(--border-color);font-size:0.8125rem;
                   color:var(--text-primary);display:flex;align-items:center;gap:0.5rem;"
            onmouseenter="this.style.background='var(--bg-surface-hover)'"
            onmouseleave="this.style.background=''">
            ${i === 0 ? '<i data-lucide="home" style="width:12px;height:12px;flex-shrink:0;"></i>' : '<i data-lucide="folder" style="width:12px;height:12px;flex-shrink:0;"></i>'}
            ${typeof escapeHTML === 'function' ? escapeHTML(o.label) : o.label}
          </div>
        `).join('')}
      </div>
      <button id="dlg-cancel" class="btn btn-secondary" style="width:100%;">Cancel</button>
    </div>
  `;

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);

  btnContainer.querySelectorAll('.dlg-pick-item').forEach((item) => {
    item.onclick = () => {
      const idx = parseInt(item.getAttribute('data-idx'));
      closeModalSmooth(modal);
      onConfirm(allOpts[idx] ? allOpts[idx].value : null);
    };
  });

  modal.classList.remove('hidden');
  lucide.createIcons({ root: modal });
}

// Global Modal Hooks: Close on Escape key and Click Outside
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
      closeModalSmooth(modal);
    });
  }
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
    closeModalSmooth(e.target);
  }
});

const ICON_OPTIONS = [
  { value: 'folder', label: 'Folder' },
  { value: 'book', label: 'Book' },
  { value: 'book-open', label: 'Book Open' },
  { value: 'calculator', label: 'Calculator' },
  { value: 'flask-conical', label: 'Science Flask' },
  { value: 'globe', label: 'Globe' },
  { value: 'languages', label: 'Languages' },
  { value: 'pen-tool', label: 'Pen Tool' },
  { value: 'graduation-cap', label: 'Graduation Cap' },
  { value: 'test-tube', label: 'Test Tube' },
  { value: 'microscope', label: 'Microscope' },
  { value: 'brain', label: 'Brain' },
  { value: 'sigma', label: 'Sigma / Math' },
  { value: 'library', label: 'Library' },
  { value: 'file-text', label: 'Document' },
  { value: 'code', label: 'Code' },
  { value: 'star', label: 'Star' },
  { value: 'box', label: 'Box' },
  { value: 'database', label: 'Database' },
  { value: 'cpu', label: 'CPU' }
];

let iconPickerResolve = null;

function openIconPicker(currentIcon) {
  return new Promise((resolve) => {
    iconPickerResolve = resolve;
    
    // Inject modal if not exists
    let modal = document.getElementById('icon-picker-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'icon-picker-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: left; overflow: visible;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2 class="modal-title" style="margin: 0; font-size: 1.25rem;">Select Folder Icon</h2>
            <button onclick="closeIconPicker()" style="background: none; border: none; color: var(--text-tertiary); cursor: pointer; display: flex;">
              <i data-lucide="x" style="width: 20px; height: 20px;"></i>
            </button>
          </div>
          
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Icon (Lucide)</div>
          <div class="custom-dropdown" id="icon-picker-dropdown" tabindex="0" style="position: relative; width: 100%; user-select: none;">
            <div class="custom-dropdown-selected" style="display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: border-color var(--transition-fast);">
              <div style="display: flex; align-items: center; gap: 0.75rem;" id="icon-picker-selected-content">
                <!-- Content injected via JS -->
              </div>
              <i data-lucide="chevron-down" style="width: 16px; height: 16px; color: var(--text-tertiary);"></i>
            </div>
            
            <div class="custom-dropdown-options hidden" style="position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-elevated); border: 1px solid var(--color-primary); border-radius: var(--radius-md); box-shadow: var(--shadow-xl); max-height: 280px; overflow-y: auto; z-index: 100;">
              ${ICON_OPTIONS.map(opt => `
                <div class="custom-dropdown-option" data-value="${opt.value}" onclick="selectIconOption('${opt.value}')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; transition: all 0.1s ease;">
                  <i data-lucide="${opt.value}" style="width: 18px; height: 18px; color: var(--text-tertiary);" class="opt-icon"></i>
                  <span style="font-weight: 500; font-size: 0.95rem;">${opt.label}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="modal-actions" style="margin-top: 2rem; justify-content: flex-end;">
            <button onclick="closeIconPicker()" class="btn btn-secondary" style="padding: 0.625rem 1rem;">Cancel</button>
            <button onclick="confirmIconPicker()" class="btn btn-primary" style="padding: 0.625rem 1rem;">Save Icon</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listener for dropdown toggle
      const dropdownSelected = modal.querySelector('.custom-dropdown-selected');
      const dropdownOptions = modal.querySelector('.custom-dropdown-options');
      
      dropdownSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownOptions.classList.toggle('hidden');
        if (!dropdownOptions.classList.contains('hidden')) {
          dropdownSelected.style.borderColor = 'var(--color-primary)';
          dropdownSelected.style.boxShadow = '0 0 0 2px var(--color-primary-subtle)';
        } else {
          dropdownSelected.style.borderColor = 'var(--border-color)';
          dropdownSelected.style.boxShadow = 'none';
        }
      });

      // Close dropdown when clicking outside (scoped to modal — only attached once via lazy-init)
      modal.addEventListener('click', (e) => {
        if (!modal.querySelector('.custom-dropdown').contains(e.target)) {
          dropdownOptions.classList.add('hidden');
          dropdownSelected.style.borderColor = 'var(--border-color)';
          dropdownSelected.style.boxShadow = 'none';
        }
      });
      
      // Add dynamic styles for options
      const style = document.createElement('style');
      style.innerHTML = `
        .custom-dropdown-option:hover {
          background: var(--color-primary) !important;
          color: white !important;
        }
        .custom-dropdown-option:hover .opt-icon {
          color: white !important;
        }
        .custom-dropdown-options::-webkit-scrollbar {
          width: 6px;
        }
        .custom-dropdown-options::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 4px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Reset dropdown state
    const dropdownSelected = modal.querySelector('.custom-dropdown-selected');
    const dropdownOptions = modal.querySelector('.custom-dropdown-options');
    dropdownOptions.classList.add('hidden');
    dropdownSelected.style.borderColor = 'var(--border-color)';
    dropdownSelected.style.boxShadow = 'none';

    // Set initial state
    const safeIcon = ICON_OPTIONS.find(o => o.value === currentIcon) ? currentIcon : 'folder';
    updateIconPickerSelected(safeIcon);
    modal.dataset.currentSelection = safeIcon;
    
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Focus moves into the dialog. It was left on <body>, so a keyboard user
    // had to tab through the whole page behind the modal to reach it, and
    // assistive tech announced nothing when it opened.
    const first = modal.querySelector('#icon-picker-dropdown') || modal.querySelector('button');
    if (first) setTimeout(() => first.focus(), 0);
  });
}

function selectIconOption(val) {
  const modal = document.getElementById('icon-picker-modal');
  if (modal) {
    modal.dataset.currentSelection = val;
    updateIconPickerSelected(val);
    const dropdownOptions = modal.querySelector('.custom-dropdown-options');
    const dropdownSelected = modal.querySelector('.custom-dropdown-selected');
    dropdownOptions.classList.add('hidden');
    dropdownSelected.style.borderColor = 'var(--border-color)';
    dropdownSelected.style.boxShadow = 'none';
  }
}

function updateIconPickerSelected(val) {
  const opt = ICON_OPTIONS.find(o => o.value === val) || { value: 'folder', label: 'Folder' };
  const container = document.getElementById('icon-picker-selected-content');
  if (container) {
    container.innerHTML = `
      <i data-lucide="${opt.value}" style="width: 20px; height: 20px; color: var(--color-primary);"></i>
      <span style="font-weight: 600; font-size: 1rem;">${opt.label}</span>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function closeIconPicker() {
  const modal = document.getElementById('icon-picker-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  if (iconPickerResolve) {
    iconPickerResolve(null);
    iconPickerResolve = null;
  }
}

function confirmIconPicker() {
  const modal = document.getElementById('icon-picker-modal');
  let selected = null;
  if (modal) {
    selected = modal.dataset.currentSelection;
    modal.classList.add('hidden');
  }
  if (iconPickerResolve) {
    iconPickerResolve(selected);
    iconPickerResolve = null;
  }
}

// Reusable function to render an icon dropdown inside any container
// Now uses renderCustomSelect with the rich-blur-backdrop style for visual consistency
function renderIconDropdown(containerId, currentIcon, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const safeIcon = ICON_OPTIONS.find(o => o.value === currentIcon) ? currentIcon : 'folder';
  const opts = ICON_OPTIONS.map(o => ({ value: o.value, label: o.label, icon: o.value }));
  renderCustomSelect(containerId, opts, safeIcon, (val) => { if (onChange) onChange(val); }, 'Select icon...');
}

/* ============================================================
   CUSTOM SELECT — blurred-overlay dropdown for any options
   Usage:
     renderCustomSelect(containerId, options, currentValue, onChange, placeholder, opts?)
     options: [{ value, label, icon?, badge? }]  (icon = lucide name, optional)
     opts: { searchable?: bool, clearable?: bool }
   ============================================================ */
function renderCustomSelect(containerId, options, currentValue, onChange, placeholder, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;

  opts = opts || {};
  const searchable = opts.searchable !== false && options.length > 6;
  const clearable = !!opts.clearable;

  const selected = options.find(o => o.value === currentValue) || null;

  function selectedHTML(opt) {
    if (!opt) return `<span style="color:var(--text-tertiary); font-weight:500; font-size:0.875rem;">${placeholder || 'Select...'}</span>`;
    const iconPart = opt.icon ? `<i data-lucide="${opt.icon}" style="width:15px;height:15px;color:var(--color-primary);flex-shrink:0;"></i>` : '';
    return `${iconPart}<span style="font-weight:600; font-size:0.875rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(opt.label)}</span>`;
  }

  function optionRowHTML(o, isActive) {
    const iconPart = o.icon ? `<i data-lucide="${o.icon}" style="width:15px;height:15px;color:var(--text-tertiary);" class="cs-opt-icon"></i>` : '';
    const badgePart = o.badge ? `<span style="margin-left:auto;font-size:0.625rem;font-weight:700;padding:0.125rem 0.4rem;border-radius:999px;background:var(--bg-surface-hover);color:var(--text-tertiary);">${escapeHTML(o.badge)}</span>` : '';
    return `<div class="cs-option${isActive ? ' cs-option-active' : ''}" data-value="${escapeHTML(o.value)}" role="option" aria-selected="${isActive ? 'true' : 'false'}">${iconPart}<span class="cs-opt-label">${escapeHTML(o.label)}</span>${isActive ? '<i data-lucide="check" style="width:13px;height:13px;margin-left:auto;color:var(--color-primary);"></i>' : badgePart}</div>`;
  }

  container.innerHTML = `
    <div class="cs-wrap">
      <div class="cs-trigger" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false">
        <div class="cs-selected-content">${selectedHTML(selected)}</div>
        ${clearable && selected ? `<button type="button" class="cs-clear-btn" aria-label="Clear selection" tabindex="-1"><i data-lucide="x" style="width:12px;height:12px;"></i></button>` : ''}
        <i data-lucide="chevron-down" class="cs-chevron"></i>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons({ el: container });

  const trigger = container.querySelector('.cs-trigger');
  const clearBtn = container.querySelector('.cs-clear-btn');
  let isOpen = false;
  let activeIdx = -1;
  let backdrop = null;
  let optionsEl = null;
  let listEl = null;
  let searchEl = null;

  function ensurePortal() {
    if (optionsEl) return;
    backdrop = document.createElement('div');
    backdrop.className = 'cs-backdrop cs-portal';
    backdrop.setAttribute('aria-hidden', 'true');

    optionsEl = document.createElement('div');
    optionsEl.className = 'cs-options cs-portal';
    optionsEl.setAttribute('role', 'listbox');
    optionsEl.innerHTML = `
      ${searchable ? `<div class="cs-search-wrap"><i data-lucide="search" style="width:13px;height:13px;color:var(--text-tertiary);"></i><input class="cs-search" type="text" placeholder="Search..." aria-label="Search options" /></div>` : ''}
      <div class="cs-list">${options.map(o => optionRowHTML(o, o.value === currentValue)).join('')}</div>
    `;
    document.body.appendChild(backdrop);
    document.body.appendChild(optionsEl);
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: optionsEl });
    listEl = optionsEl.querySelector('.cs-list');
    searchEl = optionsEl.querySelector('.cs-search');

    backdrop.addEventListener('click', () => closeDropdown());
    listEl.querySelectorAll('.cs-option').forEach(opt => bindOption(opt));
    if (searchEl) {
      searchEl.addEventListener('input', () => { renderList(); highlightAt(0); });
      searchEl.addEventListener('keydown', (e) => handleKey(e));
    }
    if (!searchEl) optionsEl.addEventListener('keydown', (e) => isOpen && handleKey(e));
  }

  function positionPortal() {
    if (!optionsEl) return;
    const r = trigger.getBoundingClientRect();
    const needed = Math.min(280, options.length * 36 + (searchable ? 44 : 8));
    const spaceBelow = window.innerHeight - r.bottom;
    optionsEl.style.left = r.left + 'px';
    optionsEl.style.width = r.width + 'px';
    if (spaceBelow < needed && r.top > needed) {
      optionsEl.style.top = (r.top - needed - 6) + 'px';
      optionsEl.style.maxHeight = Math.min(needed, r.top - 12) + 'px';
    } else {
      optionsEl.style.top = (r.bottom + 6) + 'px';
      optionsEl.style.maxHeight = Math.min(280, spaceBelow - 12) + 'px';
    }
  }

  function destroyPortal() {
    if (optionsEl) optionsEl.remove();
    if (backdrop) backdrop.remove();
    optionsEl = backdrop = listEl = searchEl = null;
  }

  function filteredOpts() {
    if (!searchEl || !searchEl.value.trim()) return options;
    const q = searchEl.value.trim().toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }

  function renderList() {
    if (!listEl) return;
    const list = filteredOpts();
    if (list.length === 0) {
      listEl.innerHTML = '<div class="cs-empty">No matches</div>';
      activeIdx = -1;
      return;
    }
    listEl.innerHTML = list.map(o => optionRowHTML(o, o.value === currentValue)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: listEl });
    listEl.querySelectorAll('.cs-option').forEach(opt => bindOption(opt));
    if (activeIdx >= 0 && activeIdx < list.length) highlightAt(activeIdx);
  }

  function highlightAt(idx) {
    if (!listEl) return;
    const rows = listEl.querySelectorAll('.cs-option');
    if (!rows.length) return;
    rows.forEach(r => r.classList.remove('cs-option-hover'));
    activeIdx = Math.max(0, Math.min(idx, rows.length - 1));
    const target = rows[activeIdx];
    target.classList.add('cs-option-hover');
    const rect = target.getBoundingClientRect();
    const parentRect = listEl.getBoundingClientRect();
    if (rect.top < parentRect.top) listEl.scrollTop -= (parentRect.top - rect.top);
    else if (rect.bottom > parentRect.bottom) listEl.scrollTop += (rect.bottom - parentRect.bottom);
  }

  function bindOption(opt) {
    opt.addEventListener('mouseenter', () => {
      const rows = Array.from(listEl.querySelectorAll('.cs-option'));
      const idx = rows.indexOf(opt);
      if (idx >= 0) highlightAt(idx);
    });
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      selectByValue(opt.dataset.value);
    });
  }

  function selectByValue(val) {
    const selectedOpt = options.find(o => o.value === val);
    currentValue = val;
    container.querySelector('.cs-selected-content').innerHTML = selectedHTML(selectedOpt || null);
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: container.querySelector('.cs-trigger') });
    closeDropdown();
    if (onChange) onChange(val);
  }

  function _onWinChange() { if (isOpen) positionPortal(); }
  function _onScroll() {
    if (!isOpen) return;
    // Close if trigger scrolls offscreen
    const r = trigger.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) closeDropdown();
    else positionPortal();
  }

  function openDropdown() {
    if (isOpen) return;
    isOpen = true;
    ensurePortal();
    positionPortal();
    trigger.classList.add('cs-trigger-open');
    trigger.setAttribute('aria-expanded', 'true');
    if (searchEl) {
      searchEl.value = '';
      setTimeout(() => searchEl.focus(), 30);
    }
    const list = filteredOpts();
    const selIdx = list.findIndex(o => o.value === currentValue);
    highlightAt(selIdx >= 0 ? selIdx : 0);
    window.addEventListener('resize', _onWinChange, true);
    window.addEventListener('scroll', _onScroll, true);
  }

  function closeDropdown() {
    if (!isOpen) return;
    isOpen = false;
    destroyPortal();
    trigger.classList.remove('cs-trigger-open');
    trigger.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', _onWinChange, true);
    window.removeEventListener('scroll', _onScroll, true);
  }

  trigger.addEventListener('click', (e) => {
    if (e.target.closest('.cs-clear-btn')) return;
    e.stopPropagation();
    isOpen ? closeDropdown() : openDropdown();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectByValue('');
      renderCustomSelect(containerId, options, '', onChange, placeholder, opts);
    });
  }

  function handleKey(e) {
    if (!listEl) return;
    const rows = listEl.querySelectorAll('.cs-option');
    if (e.key === 'ArrowDown') { e.preventDefault(); highlightAt(activeIdx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlightAt(activeIdx - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && rows[activeIdx]) selectByValue(rows[activeIdx].dataset.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
      trigger.focus();
    } else if (e.key === 'Home') { e.preventDefault(); highlightAt(0); }
    else if (e.key === 'End') { e.preventDefault(); highlightAt(rows.length - 1); }
  }

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen ? closeDropdown() : openDropdown(); }
    else if (e.key === 'Escape') closeDropdown();
    else if (e.key === 'ArrowDown' && !isOpen) { e.preventDefault(); openDropdown(); }
    else if (isOpen && !searchEl) handleKey(e);
  });
}

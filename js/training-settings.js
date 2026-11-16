/* ============================================================
   TRAINING-SETTINGS.JS — Settings > Training
   ------------------------------------------------------------
   One dialog for the new Coding Library sections' preferences.

   SYNCED (state.trainPrefs, saved and exported with your data):
     templatePass   the mark a template stage needs (default 95)
     mixTemplates   templates in the daily mix (default 2)
     flashPerLine   chunk flash: seconds per line on top of 2 (default 0.6)
     fgStarter      what a new Freeground tab opens with
   PER DEVICE (localStorage, like every other screen preference):
     ssp.zenDock    the zen dock on or off, fading while you type
     ssp.codexLookup  F1 / Alt+click lookup in the editors
   ============================================================ */

const TRAIN_LOOKUP_KEY = 'ssp.codexLookup';

/** Is F1 lookup on? (Per device; on unless switched off.) */
function trainLookupOn() {
  try { return localStorage.getItem(TRAIN_LOOKUP_KEY) !== '0'; } catch (e) { return true; }
}

function _trainPrefs() {
  if (!state.trainPrefs || typeof state.trainPrefs !== 'object') state.trainPrefs = {};
  return state.trainPrefs;
}

function trainSettingsClose() {
  const el = document.getElementById('train-settings');
  if (el) el.remove();
}

function trainSettingsOpen() {
  if (typeof closeSettingsModal === 'function') closeSettingsModal();
  trainSettingsClose();
  const p = _trainPrefs();
  const dock = typeof zdockPrefs === 'function' ? zdockPrefs() : { on: true, fade: true };
  const starter = typeof p.fgStarter === 'string' ? p.fgStarter : (typeof FG_DEFAULT_STARTER === 'string' ? FG_DEFAULT_STARTER : '');
  const ov = document.createElement('div');
  ov.id = 'train-settings';
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-content tset-box" role="dialog" aria-modal="true" aria-labelledby="tset-title">
      <h3 id="tset-title"><i data-lucide="target"></i> Training</h3>
      <p class="atpl-hint">The Coding Library's Training hub, templates, drills, Freeground, zen dock and Codex.</p>

      <div class="tset-group">Templates and drills</div>
      <label class="tset-row"><span><strong>Pass mark for a template stage</strong><em>How much of the target's code has to match (50 to 100).</em></span>
        <input type="number" class="form-input tset-num" id="tset-pass" min="50" max="100" value="${Number(p.templatePass) || 95}"></label>
      <label class="tset-row"><span><strong>Templates in the daily mix</strong><em>Due ones first; 1 to 5.</em></span>
        <input type="number" class="form-input tset-num" id="tset-mix" min="1" max="5" value="${Number(p.mixTemplates) || 2}"></label>
      <label class="tset-row"><span><strong>Chunk flash: seconds per line</strong><em>On top of 2 seconds to start reading; 0.2 to 2.</em></span>
        <input type="number" class="form-input tset-num" id="tset-flash" min="0.2" max="2" step="0.1" value="${Number(p.flashPerLine) || 0.6}"></label>

      <div class="tset-group">Editors</div>
      <label class="tset-row"><span><strong>Zen dock</strong><em>Run, Check and Finish at the corner while zen mode is on.</em></span>
        <input type="checkbox" class="setup-check" role="switch" id="tset-dock" ${dock.on ? 'checked' : ''}></label>
      <label class="tset-row"><span><strong>Fade the dock while typing</strong><em>It comes back after a pause, or when the pointer comes near.</em></span>
        <input type="checkbox" class="setup-check" role="switch" id="tset-fade" ${dock.fade ? 'checked' : ''}></label>
      <label class="tset-row"><span><strong>F1 looks a word up in the Codex</strong><em>Also Alt+click. Off in closed-book attempts either way.</em></span>
        <input type="checkbox" class="setup-check" role="switch" id="tset-lookup" ${trainLookupOn() ? 'checked' : ''}></label>
      <div class="tset-row tset-col"><span><strong>A new Freeground tab starts with</strong></span>
        <textarea class="form-textarea atpl-code" id="tset-starter" rows="6" spellcheck="false">${escapeHTML(starter)}</textarea>
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('tset-starter').value = FG_DEFAULT_STARTER">Back to the default</button></div>
      <div class="tset-row"><span><strong>Dock position</strong><em>Put it back in the bottom-right corner.</em></span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="trainSettingsResetDock()">Reset</button></div>

      <div class="atpl-actions">
        <button class="btn btn-primary" onclick="trainSettingsSave()"><i data-lucide="save"></i> Save</button>
        <button class="btn btn-ghost" onclick="trainSettingsClose()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) trainSettingsClose(); });
  ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); trainSettingsClose(); } });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
  const first = ov.querySelector('input');
  if (first) first.focus();
}

function trainSettingsResetDock() {
  try {
    const cur = JSON.parse(localStorage.getItem('ssp.zenDock') || '{}');
    delete cur.pos;
    localStorage.setItem('ssp.zenDock', JSON.stringify(cur));
  } catch (e) { /* private mode */ }
  if (typeof toast === 'function') toast('The dock goes back to its corner next time.', { type: 'info', duration: 1800 });
}

function trainSettingsSave() {
  const num = (id, lo, hi, def) => {
    const v = parseFloat((document.getElementById(id) || {}).value);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
  };
  const p = _trainPrefs();
  p.templatePass = Math.round(num('tset-pass', 50, 100, 95));
  p.mixTemplates = Math.round(num('tset-mix', 1, 5, 2));
  p.flashPerLine = Math.round(num('tset-flash', 0.2, 2, 0.6) * 10) / 10;
  const starter = (document.getElementById('tset-starter') || {}).value;
  if (typeof starter === 'string') p.fgStarter = starter;
  if (typeof saveData === 'function') saveData();
  try {
    const cur = JSON.parse(localStorage.getItem('ssp.zenDock') || '{}');
    cur.on = !!(document.getElementById('tset-dock') || {}).checked;
    cur.fade = !!(document.getElementById('tset-fade') || {}).checked;
    localStorage.setItem('ssp.zenDock', JSON.stringify(cur));
    localStorage.setItem(TRAIN_LOOKUP_KEY, (document.getElementById('tset-lookup') || {}).checked ? '1' : '0');
  } catch (e) { /* private mode */ }
  if (typeof zdockSync === 'function') zdockSync();
  trainSettingsClose();
  if (typeof toast === 'function') toast('Training settings saved', { type: 'success', duration: 1500 });
}

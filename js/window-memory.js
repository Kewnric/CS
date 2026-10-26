/* ============================================================
   WINDOW MEMORY -- a window opens the way the last one was left
   ============================================================
   The Brain note editor and the Run Code terminal can each be unblurred
   (the dash: the window floats and the page behind takes clicks) and dragged
   by the header. Both forgot it: every new note, every run, came back boxed
   and centred. Now each remembers whether it was floating and where it was,
   and the next one opens there. Settings has the switch (on by default);
   switching it off forgets both.

   Per device: ssp.windowMemory = { brainNote: { floating, at }, runCode: ... },
   where `at` is the window's CSS translate ("12px -40px").
   ============================================================ */

const WINMEM_KEY = 'ssp.windowMemory';
const WINMEM_OFF_KEY = 'ssp.windowMemoryOff';

function winMemOn() {
  try { return localStorage.getItem(WINMEM_OFF_KEY) !== '1'; } catch (e) { return true; }
}

function _winMemAll() {
  try { const v = JSON.parse(localStorage.getItem(WINMEM_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
}

/** How window `name` was last left, or null (never, or the switch is off). */
function winMemGet(name) {
  if (!winMemOn()) return null;
  return _winMemAll()[name] || null;
}

/** Record part of how window `name` is now: { floating } and/or { at }. */
function winMemSet(name, patch) {
  if (!winMemOn()) return;
  const all = _winMemAll();
  all[name] = Object.assign({}, all[name], patch);
  try { localStorage.setItem(WINMEM_KEY, JSON.stringify(all)); } catch (e) { /* private mode */ }
}

/* Put a window back where it was -- unless the screen has changed since and
   that would leave its header out of reach, in which case it stays centred. */
function winMemPlace(win, at) {
  if (!win || !at || !/^-?[\d.]+px -?[\d.]+px$/.test(at)) return;
  win.style.translate = at;
  const r = win.getBoundingClientRect();
  if (!r.width) return;   // not laid out (hidden): trust it
  if (r.right < 80 || r.left > innerWidth - 80 || r.top < 0 || r.top > innerHeight - 48) win.style.translate = '';
}

/** Wire a window's current state to its record: call after any change. */
function winMemNote(name, overlay, win) {
  if (!overlay || !win) return;
  winMemSet(name, { floating: overlay.classList.contains('is-floating'), at: win.style.translate || '' });
}

function toggleWindowMemory() {
  const on = !winMemOn();
  try {
    if (on) localStorage.removeItem(WINMEM_OFF_KEY);
    else { localStorage.setItem(WINMEM_OFF_KEY, '1'); localStorage.removeItem(WINMEM_KEY); }
  } catch (e) { /* private mode */ }
  winMemPaintSetting();
  if (typeof toast === 'function') {
    toast(on ? 'Windows now open the way you last left them.' : 'Windows open boxed and centred again.', { type: 'info' });
  }
}

function winMemPaintSetting() {
  const item = document.getElementById('settings-winmem-item');
  if (!item) return;
  const on = winMemOn();
  item.setAttribute('aria-pressed', String(on));
  item.classList.toggle('is-off', !on);
  const label = document.getElementById('settings-winmem-label');
  if (label) label.textContent = on ? 'Windows Remembered' : 'Windows Not Remembered';
}

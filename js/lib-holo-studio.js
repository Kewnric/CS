/* ============================================================
   LIB-HOLO-STUDIO.JS — Settings > Card Characters

   The window where each Library card gets your own picture as its
   hologram (or keeps its drawn scene). Left: the cards. Right: a live
   preview drawn by the same code as the cards (js/lib-holo-pics.js), in
   three views -- Hologram (as on the card), Clear (on a checkerboard, to
   judge the cut-out) and Crop (the whole picture, with a crop box to drag)
   -- and under it the controls: picture, crop, background removal,
   outline, size and place, look.

   Edits are drafts (_lhs.pics) until Save writes ssp.libHoloPics; Cancel,
   Esc or the X ask first when something changed. An upload is stored at
   once in the picture store (media-store.js: kept as it is, so a GIF stays
   animated); one never saved is cleaned up like any unused picture.
   ============================================================ */

let _lhs = null;
const LHS_ZOOM = 1.6;            // the preview is the real 200 x 150 hologram, drawn this much bigger
const LHS_CROP_W = 360, LHS_CROP_H = 228;
// Changing these only moves or fades what is drawn; anything else prepares the frames again.
const LHS_DRAW_ONLY = new Set(['fit.dx', 'fit.dy', 'fit.flip', 'look.opacity', 'look.speed']);

/** Every Library card that has a hologram, as the Library hub draws them (route-library.js). */
function _lhsCards() {
  const base = [
    { key: 'coding', name: 'Coding Library', cls: 'lib-card-coding', icon: 'code-2' },
    { key: 'study', name: 'Notes Library', cls: 'lib-card-notes', icon: 'book-open' },
    { key: 'snippets', name: 'Snippet Library', cls: 'lib-card-snippets', icon: 'code' },
    { key: 'typing', name: 'Memorization Typing Library', cls: 'lib-card-typing', icon: 'keyboard' },
    { key: 'cheatsheet', name: 'Cheat Sheet Library', cls: 'lib-card-cheat', icon: 'book-marked' },
    { key: 'language', name: 'Language Library', cls: 'lib-card-language', icon: 'languages' }
  ];
  const wings = typeof LIBRARY_WINGS !== 'undefined'
    ? LIBRARY_WINGS.map(w => ({ key: w.key, name: w.name, cls: 'lib-card-wing', icon: w.icon, accent: w.accent }))
    : [];
  return base.concat(wings).filter(c => typeof LIB_HOLO_SCENES === 'undefined' || LIB_HOLO_SCENES[c.key]);
}

function _lhsEsc(s) {
  return typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** A stable text of the drafts, to tell whether anything changed. */
function _lhsCanon(pics) {
  return JSON.stringify(Object.keys(pics).sort().map(k => [k, pics[k]]));
}

function _lhsCard() { return _lhs.cards.find(c => c.key === _lhs.key) || _lhs.cards[0]; }
function _lhsPic() { return _lhs.pics[_lhs.key] || null; }
function _lhsDirty() { return _lhsCanon(_lhs.pics) !== _lhs.saved; }

/* ── Opening and closing ──────────────────────────────────── */

function openCardCharacters(key) {
  closeCardCharacters(true);
  const cards = _lhsCards();
  if (!cards.length) return;
  const store = lhpStore();
  _lhs = {
    cards,
    pics: store.cards,
    saved: _lhsCanon(store.cards),
    key: key && cards.some(c => c.key === key) ? key : cards[0].key,
    view: 'holo',
    // Reduced motion (the system's, or Motion: Calm / Off) opens on a still; Play still plays it.
    playing: typeof libHoloStill === 'function' ? !libHoloStill() : true,
    padPct: 4,
    picking: false,
    busy: 0,
    player: null,
    prep: null,
    token: 0,
    timer: 0,
    tick: 0,
    info: {},        // src -> Promise<{ blob, url, frame0 }>
    urls: [],
    el: null
  };
  const ov = document.createElement('div');
  ov.id = 'lhs-window';
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-content lhs-win" role="dialog" aria-modal="true" aria-labelledby="lhs-title">
      <div class="lhs-head">
        <h2 class="modal-title lhs-title" id="lhs-title"><i data-lucide="ghost"></i> Card Characters</h2>
        <button type="button" class="lhs-master" id="lhs-master" role="switch" aria-checked="true">
          <span class="lhs-sw" aria-hidden="true"></span><span class="lhs-master-label">On</span>
        </button>
        <button type="button" class="settings-close-btn" data-act="close" aria-label="Close Card Characters"><i data-lucide="x"></i></button>
      </div>
      <p class="modal-desc lhs-desc">Hover a Library card and a character rises out of it. Give any card your own GIF or picture instead.</p>
      <div class="lhs-body">
        <nav class="lhs-cards" aria-label="Library cards"></nav>
        <div class="lhs-main">
          <div class="lhs-preview" id="lhs-preview">
            <div class="lhs-views" role="tablist" aria-label="Preview">
              <button type="button" class="lhs-view" role="tab" data-view="holo">Hologram</button>
              <button type="button" class="lhs-view" role="tab" data-view="clear">Clear</button>
              <button type="button" class="lhs-view" role="tab" data-view="crop">Crop</button>
            </div>
            <div class="lhs-viewport">
              <div class="lhs-stage-wrap"><div class="lhs-stage"></div></div>
              <div class="lhs-crop hidden"></div>
              <div class="lhs-msg hidden" role="status"></div>
              <div class="lhs-drop-hint" aria-hidden="true"><i data-lucide="image-plus"></i> Drop it to use it</div>
            </div>
            <div class="lhs-transport"></div>
          </div>
          <div class="lhs-controls"></div>
        </div>
      </div>
      <div class="lhs-foot">
        <button type="button" class="lhs-link" data-act="builtin"><i data-lucide="undo-2"></i> Use the drawn scene</button>
        <button type="button" class="lhs-link" data-act="copyall"><i data-lucide="copy"></i> Copy to all cards</button>
        <span class="lhs-spacer"></span>
        <button type="button" class="btn btn-secondary btn-sm" data-act="cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" data-act="save">Save</button>
      </div>
      <input type="file" id="lhs-file" accept="image/gif,image/png,image/apng,image/webp,image/jpeg" hidden>
    </div>`;
  document.body.appendChild(ov);
  document.body.classList.add('lhs-open');
  _lhs.el = ov;
  _lhsWire(ov);
  _lhsPaintMaster();
  _lhsSelect(_lhs.key);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
  setTimeout(() => { const b = ov.querySelector('.lhs-card.is-on'); if (b) b.focus(); }, 40);
}

/** Closes the window; asks first when there are unsaved changes, unless `force`. */
function closeCardCharacters(force) {
  if (!_lhs) { const stray = document.getElementById('lhs-window'); if (stray) stray.remove(); return; }
  if (!force && _lhsDirty()) {
    showConfirm('Discard your changes?', 'Your card pictures have changes that are not saved.', () => closeCardCharacters(true),
      { confirmLabel: 'Discard' });
    return;
  }
  const s = _lhs;
  _lhs = null;
  clearTimeout(s.timer);
  clearInterval(s.tick);
  if (s.player) s.player.destroy();
  _lhpFree(s.prep);
  s.urls.forEach(u => URL.revokeObjectURL(u));
  document.removeEventListener('paste', _lhsOnPaste, true);
  if (s.el) s.el.remove();
  document.body.classList.remove('lhs-open');
}

/* ── Events ───────────────────────────────────────────────── */

function _lhsWire(ov) {
  // Only a press that starts AND ends on the backdrop closes: a crop drag or a
  // text selection let go outside the window is not a click outside it.
  let downOnBackdrop = false;
  ov.addEventListener('pointerdown', e => { downOnBackdrop = e.target === ov; });
  ov.addEventListener('click', e => {
    if (e.target === ov) { if (downOnBackdrop) closeCardCharacters(false); return; }
    const t = e.target.closest('[data-act], .lhs-card, .lhs-view, .lhs-toggle, #lhs-master');
    if (!t || !ov.contains(t)) return;
    if (t.id === 'lhs-master') { if (typeof toggleLibHolo === 'function') toggleLibHolo(); _lhsPaintMaster(); return; }
    if (t.classList.contains('lhs-card')) { _lhsSelect(t.dataset.key); return; }
    if (t.classList.contains('lhs-view')) { _lhsSetView(t.dataset.view); return; }
    if (t.classList.contains('lhs-toggle')) {
      const pic = _lhsPic();
      if (!pic) return;
      const [a, b] = t.dataset.path.split('.');
      _lhsSet(t.dataset.path, !pic[a][b]);
      _lhsPaintControls();
      return;
    }
    _lhsAct(t.dataset.act, t);
  });
  ov.addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('lhs-scrub')) { _lhsSeek(+t.value); return; }
    if (t.id === 'lhs-pad') { _lhs.padPct = +t.value; _lhsOut(t, t.value + '%'); return; }
    if (!t.dataset.path || t.type !== 'range') return;
    const v = parseFloat(t.value);
    _lhsSet(t.dataset.path, v);
    _lhsOut(t, _lhsFmt(t.dataset.path, v));
  });
  ov.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'lhs-file') { const f = t.files && t.files[0]; t.value = ''; if (f) _lhsTake(f); return; }
    if (!t.dataset.path) return;
    if (t.type === 'color') { _lhsSet(t.dataset.path, t.value); _lhsPaintControls(); }
    else if (t.type === 'checkbox') _lhsSet(t.dataset.path, t.checked);
  });
  ov.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (_lhs && _lhs.picking) { _lhsPicking(false); return; }
    closeCardCharacters(false);
  });
  // Drop a picture anywhere on the preview.
  const pv = ov.querySelector('#lhs-preview');
  pv.addEventListener('dragover', e => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    pv.classList.add('is-drop');
  });
  pv.addEventListener('dragleave', e => { if (!pv.contains(e.relatedTarget)) pv.classList.remove('is-drop'); });
  pv.addEventListener('drop', e => {
    e.preventDefault();
    pv.classList.remove('is-drop');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) _lhsTake(f);
  });
  document.addEventListener('paste', _lhsOnPaste, true);
}

/** Ctrl+V of a picture while the window is open. */
function _lhsOnPaste(e) {
  if (!_lhs) return;
  const items = e.clipboardData ? [...e.clipboardData.items] : [];
  const it = items.find(i => i.kind === 'file' && /^image\//.test(i.type));
  if (!it) return;
  e.preventDefault();
  _lhsTake(it.getAsFile());
}

function _lhsAct(act) {
  const pic = _lhsPic();
  switch (act) {
    case 'close': closeCardCharacters(false); break;
    case 'cancel': closeCardCharacters(false); break;
    case 'save': _lhsSave(); break;
    case 'upload': _lhs.el.querySelector('#lhs-file').click(); break;
    case 'builtin':
      if (!pic) return;
      delete _lhs.pics[_lhs.key];
      _lhsSelect(_lhs.key);
      break;
    case 'copyall': _lhsCopyAll(); break;
    case 'autocrop': _lhsAutoCrop(); break;
    case 'whole': if (pic) { pic.crop = null; _lhsChanged('crop'); _lhsPaintControls(); _lhsPaintCrop(); } break;
    case 'editcrop': _lhsSetView('crop'); break;
    case 'bgauto': if (pic) { _lhsSet('bg.color', 'auto'); _lhsPaintControls(); } break;
    case 'bgpick': if (pic) _lhsPicking(!_lhs.picking); break;
    case 'olcard': if (pic) { _lhsSet('outline.color', 'card'); _lhsPaintControls(); } break;
    case 'centre': if (pic) { pic.fit.dx = 0; pic.fit.dy = 0; _lhsChanged('fit.dx'); _lhsPaintControls(); } break;
    case 'play': _lhsPlay(!_lhs.playing); break;
    case 'rise': _lhsRise(); break;
    default: break;
  }
}

/* ── Values ───────────────────────────────────────────────── */

function _lhsSet(path, v) {
  const pic = _lhsPic();
  if (!pic) return;
  const [a, b] = path.split('.');
  pic[a][b] = v;
  const clean = lhpNormalizePic(pic);
  if (clean) _lhs.pics[_lhs.key] = clean;
  _lhsChanged(path);
}

/** After a change: move or fade what is drawn, or prepare the frames again. */
function _lhsChanged(path) {
  _lhsMarkCard();
  const pic = _lhsPic();
  if (path === 'look.scan') { _lhsPaintScan(); return; }
  if (LHS_DRAW_ONLY.has(path)) {
    if (_lhs.player && _lhs.prep && pic) {
      _lhs.player.show(_lhs.prep, pic);
      if (_lhs.playing && path === 'look.speed') _lhs.player.play(pic.look.speed);
    }
    return;
  }
  _lhsPrepareSoon();
}

function _lhsFmt(path, v) {
  if (path === 'fit.scale') return Math.round(v * 100) + '%';
  if (path === 'look.speed') return (+v.toFixed(2)) + '×';
  if (path === 'look.tint' || path === 'look.opacity') return Math.round(v) + '%';
  if (path === 'outline.width' || path === 'outline.glow' || path === 'fit.dx' || path === 'fit.dy') return v + ' px';
  return String(Math.round(v));
}

function _lhsOut(input, text) {
  const out = input.parentElement && input.parentElement.querySelector('output');
  if (out) out.textContent = text;
}

/* ── Painting ─────────────────────────────────────────────── */

function _lhsPaintMaster() {
  const b = _lhs && _lhs.el.querySelector('#lhs-master');
  if (!b) return;
  const on = typeof libHoloEnabled === 'function' ? libHoloEnabled() : true;
  b.setAttribute('aria-checked', String(on));
  b.setAttribute('aria-label', on ? 'Card characters are on' : 'Card characters are off');
  b.querySelector('.lhs-master-label').textContent = on ? 'On' : 'Off';
  _lhs.el.querySelector('.lhs-win').classList.toggle('is-master-off', !on);
}

function _lhsPaintCards() {
  const nav = _lhs.el.querySelector('.lhs-cards');
  let saved = {};
  try { saved = JSON.parse(_lhs.saved).reduce((o, [k, v]) => { o[k] = v; return o; }, {}); } catch (e) { saved = {}; }
  nav.innerHTML = _lhs.cards.map(c => {
    const pic = _lhs.pics[c.key];
    const changed = JSON.stringify(pic || null) !== JSON.stringify(saved[c.key] || null);
    const thumb = pic
      ? `<img class="lhs-thumb" alt="" src="${_lhsEsc(typeof mediaSrc === 'function' ? mediaSrc(pic.src, 'thumb') : pic.src)}">`
      : `<span class="lhs-thumb lhs-thumb-icon"><i data-lucide="${_lhsEsc(c.icon)}"></i></span>`;
    return `<button type="button" class="lhs-card ${c.cls}${c.key === _lhs.key ? ' is-on' : ''}" data-key="${_lhsEsc(c.key)}"
        aria-current="${c.key === _lhs.key}"${c.accent ? ` style="--lib-accent:${_lhsEsc(c.accent)}"` : ''}>
        ${thumb}<span class="lhs-card-txt"><span class="lhs-card-name">${_lhsEsc(c.name)}</span>
        <span class="lhs-card-sub">${pic ? 'Your picture' : 'Drawn scene'}${changed ? ' · <b>changed</b>' : ''}</span></span>
      </button>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: nav });
}

/** The current card's line in the list: its picture or drawn scene, and whether it changed. */
function _lhsMarkCard() {
  const btn = _lhs.el.querySelector('.lhs-card.is-on .lhs-card-sub');
  if (!btn) return;
  let saved = null;
  try { saved = (JSON.parse(_lhs.saved).find(([k]) => k === _lhs.key) || [])[1] || null; } catch (e) { saved = null; }
  const pic = _lhsPic();
  const changed = JSON.stringify(pic || null) !== JSON.stringify(saved);
  btn.innerHTML = (pic ? 'Your picture' : 'Drawn scene') + (changed ? ' · <b>changed</b>' : '');
}

function _lhsSelect(key) {
  _lhs.key = key;
  _lhs.picking = false;
  _lhsPaintCards();
  _lhsBuildStage();
  _lhsPaintControls();
  if (!_lhsPic() && _lhs.view !== 'holo') _lhs.view = 'holo';
  _lhsSetView(_lhs.view);
  _lhsPrepareNow();
}

/** The real hologram frame, in the card's colour, with a canvas (your picture) or the drawn scene. */
function _lhsBuildStage() {
  const card = _lhsCard();
  const pic = _lhsPic();
  const stage = _lhs.el.querySelector('.lhs-stage');
  stage.className = 'lhs-stage ' + card.cls + (_lhs.playing ? ' holo-run' : '');
  stage.dataset.scene = card.key;
  stage.style.cssText = card.accent ? '--lib-accent:' + card.accent : '';
  const inner = pic ? lhpSceneHTML(card.key) : (LIB_HOLO_SCENES[card.key] ? LIB_HOLO_SCENES[card.key]() : '');
  stage.innerHTML = `<div class="lib-holo lh-${_lhsEsc(card.key)} lhs-holo" aria-hidden="true">` +
    '<div class="lib-holo-aura"></div>' +
    '<div class="lib-holo-stage"><div class="lib-holo-beam"></div><div class="lib-holo-floor"></div>' +
    `<div class="lib-holo-scene">${inner}</div><div class="lib-holo-sweep"></div></div></div>`;
  if (!pic && typeof _lhLift === 'function') stage.querySelectorAll('svg.lh-svg, svg.lhx-svg').forEach(_lhLift);
  if (_lhs.player) _lhs.player.destroy();
  _lhs.player = null;
  const canvas = stage.querySelector('.lhp-canvas');
  if (canvas) _lhs.player = lhpPlayer(canvas);
  _lhsPaintScan();
}

function _lhsPaintScan() {
  const holo = _lhs.el.querySelector('.lhs-holo');
  const pic = _lhsPic();
  if (holo) holo.classList.toggle('lhp-noscan', !!(pic && !pic.look.scan));
}

function _lhsSetView(view) {
  const pic = _lhsPic();
  if (!pic && view !== 'holo') view = 'holo';
  _lhs.view = view;
  if (view !== 'crop') _lhsPicking(false);
  const el = _lhs.el;
  el.querySelectorAll('.lhs-view').forEach(b => {
    b.setAttribute('aria-selected', String(b.dataset.view === view));
    b.disabled = !pic && b.dataset.view !== 'holo';
  });
  el.querySelector('.lhs-stage-wrap').classList.toggle('hidden', view === 'crop');
  el.querySelector('.lhs-stage-wrap').classList.toggle('is-clear', view === 'clear');
  el.querySelector('.lhs-crop').classList.toggle('hidden', view !== 'crop');
  if (view === 'crop') _lhsPaintCrop();
  _lhsPaintTransport();
}

function _lhsMsg(text, isError) {
  const m = _lhs && _lhs.el.querySelector('.lhs-msg');
  if (!m) return;
  m.textContent = text || '';
  m.classList.toggle('hidden', !text);
  m.classList.toggle('is-error', !!isError);
}

function _lhsBusy(on, text) {
  _lhs.busy = Math.max(0, _lhs.busy + (on ? 1 : -1));
  _lhs.el.querySelector('.lhs-preview').classList.toggle('is-busy', _lhs.busy > 0);
  if (on && text) _lhsMsg(text);
  if (!on && !_lhs.busy) _lhsMsg('');
}

/* ── The controls ─────────────────────────────────────────── */

function _lhsRange(path, label, min, max, step, value) {
  return `<label class="lhs-row"><span class="lhs-lbl">${label}</span>
    <input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}">
    <output>${_lhsFmt(path, value)}</output></label>`;
}
function _lhsToggle(path, on, label) {
  return `<button type="button" class="lhs-toggle" role="switch" data-path="${path}" aria-checked="${!!on}" aria-label="${_lhsEsc(label)}"><span class="lhs-sw" aria-hidden="true"></span></button>`;
}
function _lhsCheck(path, on, label) {
  return `<label class="lhs-check"><input type="checkbox" data-path="${path}"${on ? ' checked' : ''}> ${label}</label>`;
}

function _lhsPaintControls() {
  const box = _lhs.el.querySelector('.lhs-controls');
  const pic = _lhsPic();
  const card = _lhsCard();
  _lhs.el.querySelector('[data-act="builtin"]').disabled = !pic;
  _lhs.el.querySelector('[data-act="copyall"]').disabled = !pic;
  if (!pic) {
    box.innerHTML = `<div class="lhs-empty">
      <p><b>${_lhsEsc(card.name)}</b> shows its drawn scene.</p>
      <button type="button" class="btn btn-primary btn-sm" data-act="upload"><i data-lucide="upload"></i> Upload a picture</button>
      <p class="lhs-hint">Or drop one on the preview, or paste it (Ctrl+V). GIF, PNG, WebP or JPG, up to 15 MB. Animated GIFs and WebPs play.</p>
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: box });
    return;
  }
  const secs = (pic.ms / 1000).toFixed(1);
  const bgHex = pic.bg.color === 'auto' ? null : pic.bg.color;
  const olHex = pic.outline.color === 'card' ? null : pic.outline.color;
  box.innerHTML = `
    <section class="lhs-sec">
      <h3>Picture</h3>
      <div class="lhs-facts"><span class="lhs-name" title="${_lhsEsc(pic.name)}">${_lhsEsc(pic.name || 'Your picture')}</span>
        <span>${pic.w} × ${pic.h}</span>
        <span>${pic.frames > 1 ? pic.frames + ' frames · ' + secs + ' s' : 'Still'}</span>
        <span class="lhs-size" id="lhs-size"></span></div>
      ${pic.frames >= LHP_MAX_FRAMES ? '<p class="lhs-hint">Only the first ' + LHP_MAX_FRAMES + ' frames play.</p>' : ''}
      <button type="button" class="lhs-link" data-act="upload"><i data-lucide="replace"></i> Replace picture</button>
    </section>
    <section class="lhs-sec">
      <h3>Crop</h3>
      <div class="lhs-btns">
        <button type="button" class="btn btn-secondary btn-sm" data-act="autocrop"><i data-lucide="scan"></i> Auto-crop</button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="editcrop"><i data-lucide="crop"></i> Edit by hand</button>
        <button type="button" class="lhs-link" data-act="whole">Whole picture</button>
      </div>
      <label class="lhs-row"><span class="lhs-lbl">Auto-crop margin</span>
        <input type="range" id="lhs-pad" min="0" max="20" step="1" value="${_lhs.padPct}"><output>${_lhs.padPct}%</output></label>
      <p class="lhs-hint">${pic.crop ? 'Cropped to ' + pic.crop.w + ' × ' + pic.crop.h + '.' : 'Showing the whole picture.'}</p>
    </section>
    <section class="lhs-sec${pic.bg.on ? '' : ' is-off'}">
      <h3>Background removal ${_lhsToggle('bg.on', pic.bg.on, 'Background removal')}</h3>
      <p class="lhs-hint">Already cut out? Leave this off.</p>
      <div class="lhs-sub">
        <div class="lhs-row"><span class="lhs-lbl">Colour</span>
          <span class="lhs-colors">
            <button type="button" class="lhs-chip${bgHex ? '' : ' is-on'}" data-act="bgauto">Auto</button>
            <input type="color" data-path="bg.color" value="${bgHex || '#ffffff'}" aria-label="Background colour" class="${bgHex ? 'is-on' : ''}">
            <button type="button" class="lhs-chip${_lhs.picking ? ' is-on' : ''}" data-act="bgpick"><i data-lucide="pipette"></i> Pick</button>
          </span></div>
        ${_lhsRange('bg.tol', 'Tolerance', 0, 60, 1, pic.bg.tol)}
        ${_lhsRange('bg.soft', 'Soft edge', 0, 40, 1, pic.bg.soft)}
        ${_lhsCheck('bg.edges', pic.bg.edges, 'Only where it touches the edges <span class="lhs-hint">(keeps the same colour inside the character)</span>')}
      </div>
    </section>
    <section class="lhs-sec${pic.outline.on ? '' : ' is-off'}">
      <h3>Outline ${_lhsToggle('outline.on', pic.outline.on, 'Outline')}</h3>
      <div class="lhs-sub">
        <div class="lhs-row"><span class="lhs-lbl">Colour</span>
          <span class="lhs-colors">
            <button type="button" class="lhs-chip${olHex ? '' : ' is-on'}" data-act="olcard">Card colour</button>
            <input type="color" data-path="outline.color" value="${olHex || '#ffffff'}" aria-label="Outline colour" class="${olHex ? 'is-on' : ''}">
          </span></div>
        ${_lhsRange('outline.width', 'Width', 0, 8, 0.5, pic.outline.width)}
        ${_lhsRange('outline.glow', 'Glow', 0, 12, 1, pic.outline.glow)}
        <p class="lhs-hint lhs-ol-hint hidden">This picture has no see-through parts, so the outline goes round its rectangle. Turn on background removal to outline the character.</p>
      </div>
    </section>
    <section class="lhs-sec">
      <h3>Size and place</h3>
      ${_lhsRange('fit.scale', 'Size', 0.5, 1.6, 0.05, pic.fit.scale)}
      ${_lhsRange('fit.dx', 'Left / right', -100, 100, 1, pic.fit.dx)}
      ${_lhsRange('fit.dy', 'Up / down', -75, 75, 1, pic.fit.dy)}
      <div class="lhs-btns">${_lhsCheck('fit.flip', pic.fit.flip, 'Flip')}
        <button type="button" class="lhs-link" data-act="centre">Centre it</button></div>
    </section>
    <section class="lhs-sec">
      <h3>Look</h3>
      ${_lhsRange('look.tint', 'Hologram tint', 0, 100, 1, pic.look.tint)}
      ${_lhsRange('look.opacity', 'Opacity', 40, 100, 1, pic.look.opacity)}
      ${pic.frames > 1 ? _lhsRange('look.speed', 'Speed', 0.25, 2, 0.05, pic.look.speed) : ''}
      ${_lhsCheck('look.scan', pic.look.scan, 'Scanlines')}
    </section>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: box });
  _lhsPaintSize(pic);
  _lhsPaintOutlineHint(pic);
}

/** The file's size and whether it follows the account (the cloud keeps pictures up to 1 MB). */
function _lhsPaintSize(pic) {
  _lhsInfo(pic.src).then(info => {
    const el = _lhs && _lhs.el.querySelector('#lhs-size');
    if (!el || (_lhsPic() || {}).src !== pic.src) return;
    const size = info.blob.size;
    const kb = size >= 1e6 ? (size / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(size / 1000)) + ' KB';
    const online = typeof storageMode !== 'undefined' && storageMode === 'online';
    const big = size > (typeof MEDIA_CLOUD_MAX === 'number' ? MEDIA_CLOUD_MAX : 1e6);
    el.innerHTML = _lhsEsc(kb) + ' · ' + (!online ? 'On this device'
      : big ? '<span class="lhs-warn">Only on this device: over 1 MB</span>' : 'Follows your account');
  }).catch(() => {
    const el = _lhs && _lhs.el.querySelector('#lhs-size');
    if (el) el.innerHTML = '<span class="lhs-warn">Not on this device yet</span>';
  });
}

function _lhsPaintOutlineHint(pic) {
  _lhsInfo(pic.src).then(info => {
    const el = _lhs && _lhs.el.querySelector('.lhs-ol-hint');
    if (!el || (_lhsPic() || {}).src !== pic.src) return;
    const g = lhpGuessBg(info.frame0);
    el.classList.toggle('hidden', g.transparent || pic.bg.on);
  }).catch(() => {});
}

/* ── The picture behind a draft ───────────────────────────── */

/** The file, an object URL for it, and its first frame (for the colour picker). Cached per window. */
function _lhsInfo(src) {
  if (_lhs.info[src]) return _lhs.info[src];
  const s = _lhs;
  const p = (async () => {
    const blob = await lhpBlobOf(src);
    const url = URL.createObjectURL(blob);
    s.urls.push(url);
    let frame0 = null;
    await lhpDecodeEach(blob, async (im) => { frame0 = im; }, { max: 1 });
    return { blob, url, frame0 };
  })();
  p.catch(() => { if (s.info[src] === p) delete s.info[src]; });
  s.info[src] = p;
  return p;
}

/**
 * Reads every frame (up to LHP_MAX_FRAMES) for the upload facts and
 * auto-crop: size, frame count, length, the background guess, and the box
 * round what is visible -- after background removal when it is on (for a
 * new upload: on when the picture has no transparency and a flat border).
 */
async function _lhsAnalyze(blob, pic) {
  let guess = null, frame0 = null, bgOn = false, rgb = null;
  const bg = pic ? pic.bg : lhpDefaults().bg;
  const acc = lhpBoundsAcc();
  const res = await lhpDecodeEach(blob, async (im) => {
    if (!frame0) {
      frame0 = new ImageData(new Uint8ClampedArray(im.data), im.width, im.height);
      guess = lhpGuessBg(im);
      bgOn = pic ? pic.bg.on : (!guess.transparent && guess.flat && !!guess.rgb);
      rgb = bg.color !== 'auto' ? lhpHexToRgb(bg.color) : guess.rgb;
    }
    if (bgOn && rgb) {
      const copy = { data: new Uint8ClampedArray(im.data), width: im.width, height: im.height };
      lhpKey(copy, { rgb, tol: bg.tol, soft: bg.soft, edges: bg.edges });
      acc.add(copy);
    } else {
      acc.add(im);
    }
  }, { max: LHP_MAX_FRAMES });
  return { W: res.width, H: res.height, count: res.count, ms: res.ms, guess, frame0, bgOn, bounds: acc.result() };
}

/** A file the person chose, dropped or pasted: checked, read, stored, and given to the card. */
async function _lhsTake(file) {
  if (!_lhs) return;
  const s = _lhs, key = s.key;
  if (!file || !/^image\//.test(file.type || '')) { _lhsMsg('That is not a picture file. Use a GIF, PNG, WebP or JPG.', true); return; }
  if (/svg/i.test(file.type)) { _lhsMsg('SVG pictures are not supported here. Use a GIF, PNG, WebP or JPG.', true); return; }
  if (file.size > LHP_MAX_BYTES) { _lhsMsg('That file is ' + (file.size / 1e6).toFixed(1) + ' MB. The limit is 15 MB.', true); return; }
  _lhsBusy(true, 'Reading the picture…');
  try {
    const an = await _lhsAnalyze(file, null);
    let ref;
    try {
      ref = await mediaPut(file, an.W, an.H);
    } catch (e) {
      console.warn('[Card Characters] could not store the picture', e);
      _lhsBusy(false);
      _lhsMsg('This browser would not store the picture (private window, or storage full).', true);
      return;
    }
    if (_lhs !== s) return;
    const old = s.pics[key];
    const pic = lhpNormalizePic(Object.assign(lhpDefaults(), {
      src: ref, name: file.name || 'Pasted picture', type: file.type, w: an.W, h: an.H,
      frames: an.count, ms: an.ms, at: Date.now(),
      crop: an.bounds ? lhpPadBox(an.bounds, an.W, an.H, s.padPct) : null,
      bg: Object.assign(lhpDefaults().bg, { on: an.bgOn }),
      // A replacement keeps how the last picture was shown.
      outline: old ? old.outline : undefined, fit: old ? old.fit : undefined, look: old ? old.look : undefined
    }));
    s.pics[key] = pic;
    s.info[ref] = Promise.resolve({ blob: file, url: (() => { const u = URL.createObjectURL(file); s.urls.push(u); return u; })(), frame0: an.frame0 });
    _lhsBusy(false);
    if (s.key === key) _lhsSelect(key);
    else _lhsPaintCards();
    if (an.bgOn) _lhsMsg('Background removed (it was one flat colour). Turn it off under Background removal if it took too much.');
    setTimeout(() => { if (_lhs === s) _lhsMsg(''); }, 4200);
  } catch (e) {
    console.warn('[Card Characters] could not read the picture', e);
    if (_lhs === s) { _lhsBusy(false); _lhsMsg('That picture could not be read: ' + (e && e.message ? e.message : 'unknown error'), true); }
  }
}

async function _lhsAutoCrop() {
  const pic = _lhsPic();
  if (!pic) return;
  const s = _lhs, key = s.key;
  _lhsBusy(true, 'Finding the edges…');
  let note = '', bad = false;
  try {
    const info = await _lhsInfo(pic.src);
    const an = await _lhsAnalyze(info.blob, pic);
    const now = _lhs === s && s.key === key ? _lhsPic() : null;
    if (!now || now.src !== pic.src) return;
    now.crop = an.bounds ? lhpPadBox(an.bounds, an.W, an.H, s.padPct) : null;
    _lhsChanged('crop');
    _lhsPaintControls();
    if (s.view === 'crop') _lhsPaintCrop();
    if (!an.bounds) note = 'Nothing see-through to crop to. Turn on background removal first, or crop by hand.';
  } catch (e) {
    note = 'Could not read the picture to crop it.';
    bad = true;
  } finally {
    if (_lhs === s) { _lhsBusy(false); if (note) _lhsMsg(note, bad); }
  }
}

function _lhsCopyAll() {
  const pic = _lhsPic();
  if (!pic) return;
  const s = _lhs;
  const others = s.cards.filter(c => c.key !== s.key && s.pics[c.key] && s.pics[c.key].src !== pic.src);
  const go = () => {
    if (_lhs !== s) return;
    s.cards.forEach(c => { s.pics[c.key] = JSON.parse(JSON.stringify(pic)); });
    _lhsPaintCards();
    _lhsMsg('Every card now shows this picture. Save to keep it.');
  };
  if (!others.length) { go(); return; }
  showConfirm('Copy to all cards?', others.length + (others.length === 1 ? ' card has' : ' cards have') +
    ' a picture of its own. Every card will show this one instead.', go, { tone: 'primary', confirmLabel: 'Copy' });
}

function _lhsSave() {
  try {
    lhpSaveStore({ v: 1, cards: _lhs.pics });
  } catch (e) {
    console.warn('[Card Characters] save failed', e);
    _lhsMsg('Could not save: this device\'s storage is full.', true);
    return;
  }
  if (typeof _syncLibHoloRow === 'function') _syncLibHoloRow();
  if (typeof toast === 'function') toast('Card characters saved', { type: 'success', duration: 1600 });
  closeCardCharacters(true);
}

/* ── The preview ──────────────────────────────────────────── */

function _lhsPrepareSoon() {
  clearTimeout(_lhs.timer);
  _lhs.timer = setTimeout(_lhsPrepareNow, 140);
}

async function _lhsPrepareNow() {
  const s = _lhs;
  if (!s) return;
  clearTimeout(s.timer);
  const token = ++s.token;
  const pic = _lhsPic();
  const old = s.prep;
  if (!pic || !s.player) {
    s.prep = null;
    setTimeout(() => _lhpFree(old), 0);
    _lhsPaintTransport();
    return;
  }
  const stage = s.el.querySelector('.lhs-stage');
  const dpr = Math.min(3.2, Math.min(2, Math.max(1, window.devicePixelRatio || 1)) * LHS_ZOOM);
  const stale = () => _lhs !== s || s.token !== token;
  _lhsBusy(true);
  try {
    const prep = await lhpPrepare(pic, lhpCardRgb(stage), {
      dpr,
      isStale: stale,
      onFirst: (first) => { if (!stale()) s.player.show(first, _lhsPic()); }
    });
    if (stale()) { _lhpFree(prep); return; }
    s.prep = prep;
    s.player.show(prep, _lhsPic());
    if (s.playing && prep.frames.length > 1) s.player.play(_lhsPic().look.speed);
    if (old !== prep) setTimeout(() => _lhpFree(old), 0);
    _lhsPaintTransport();
  } catch (e) {
    if (e === _LHP_STALE || stale()) return;
    console.warn('[Card Characters] preview failed', e);
    _lhsMsg('This picture could not be shown: ' + (e && e.message ? e.message : 'unknown error'), true);
  } finally {
    if (_lhs === s) _lhsBusy(false);
  }
}

function _lhsPaintTransport() {
  const t = _lhs.el.querySelector('.lhs-transport');
  const n = _lhs.player && _lhs.prep ? _lhs.prep.frames.length : 0;
  const pic = _lhsPic();
  clearInterval(_lhs.tick);
  _lhs.tick = 0;
  const drawn = !pic;   // the drawn scene: only play/pause and rise
  t.innerHTML = `
    <button type="button" class="lhs-icon-btn" data-act="play" aria-label="${_lhs.playing ? 'Pause' : 'Play'}">
      <i data-lucide="${_lhs.playing ? 'pause' : 'play'}"></i></button>
    ${!drawn && n > 1 && _lhs.view !== 'crop' ? `<input type="range" class="lhs-scrub" min="0" max="${n - 1}" step="1" value="${_lhs.player.index()}" aria-label="Frame">
      <span class="lhs-frame">${_lhs.player.index() + 1} / ${n}</span>` : '<span class="lhs-spacer"></span>'}
    <button type="button" class="lhs-link" data-act="rise"${_lhs.view === 'crop' ? ' disabled' : ''}><i data-lucide="sparkles"></i> Rise again</button>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: t });
  if (!drawn && n > 1 && _lhs.playing) {
    const s = _lhs;
    s.tick = setInterval(() => {
      if (_lhs !== s || !s.player) return;
      const scrub = t.querySelector('.lhs-scrub'), lbl = t.querySelector('.lhs-frame');
      if (scrub) scrub.value = s.player.index();
      if (lbl) lbl.textContent = (s.player.index() + 1) + ' / ' + n;
    }, 120);
  }
}

function _lhsPlay(on) {
  _lhs.playing = on;
  const stage = _lhs.el.querySelector('.lhs-stage');
  stage.classList.toggle('holo-run', on);
  const pic = _lhsPic();
  if (_lhs.player) { if (on && pic) _lhs.player.play(pic.look.speed); else _lhs.player.stop(); }
  _lhsPaintTransport();
}

function _lhsSeek(i) {
  if (!_lhs.player) return;
  if (_lhs.playing) _lhsPlay(false);
  _lhs.player.seek(i);
  const lbl = _lhs.el.querySelector('.lhs-frame');
  if (lbl) lbl.textContent = (i + 1) + ' / ' + _lhs.player.frameCount();
}

/** Plays the hologram's rise out of the card again. */
function _lhsRise() {
  const holo = _lhs.el.querySelector('.lhs-holo');
  if (!holo) return;
  holo.classList.remove('is-rising');
  void holo.offsetWidth;
  holo.classList.add('is-rising');
}

/* ── Crop view and the colour picker ──────────────────────── */

function _lhsPaintCrop() {
  const box = _lhs.el.querySelector('.lhs-crop');
  const pic = _lhsPic();
  if (!pic || _lhs.view !== 'crop') return;
  const s = _lhs;
  _lhsInfo(pic.src).then(info => {
    if (_lhs !== s || _lhsPic() !== pic || s.view !== 'crop') return;
    const W = pic.w || info.frame0.width, H = pic.h || info.frame0.height;
    const k = Math.min(LHS_CROP_W / W, LHS_CROP_H / H);
    const c = pic.crop || { x: 0, y: 0, w: W, h: H };
    box.innerHTML = `<div class="lhs-crop-frame${s.picking ? ' is-picking' : ''}" style="width:${Math.round(W * k)}px;height:${Math.round(H * k)}px">
        <img class="lhs-crop-img" alt="" draggable="false" src="${_lhsEsc(info.url)}">
        <div class="lhs-crop-box">${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<span class="lhs-h lhs-h-${h}" data-h="${h}"></span>`).join('')}</div>
      </div>
      <p class="lhs-hint">${s.picking ? 'Click the background colour to remove.' : 'Drag the box to move it, its edges and corners to resize.'}</p>`;
    const frame = box.querySelector('.lhs-crop-frame');
    const cb = box.querySelector('.lhs-crop-box');
    const place = (r) => {
      cb.style.left = (r.x * k) + 'px';
      cb.style.top = (r.y * k) + 'px';
      cb.style.width = (r.w * k) + 'px';
      cb.style.height = (r.h * k) + 'px';
    };
    place(c);
    frame.addEventListener('pointerdown', e => _lhsCropDown(e, frame, cb, place, k, W, H, info));
  }).catch(() => { box.innerHTML = '<p class="lhs-hint">This picture is not on this device yet.</p>'; });
}

function _lhsCropDown(e, frame, cb, place, k, W, H, info) {
  const pic = _lhsPic();
  if (!pic || e.button !== 0) return;
  e.preventDefault();
  const rect = frame.getBoundingClientRect();
  const at = (ev) => ({ x: Math.max(0, Math.min(W, (ev.clientX - rect.left) / k)), y: Math.max(0, Math.min(H, (ev.clientY - rect.top) / k)) });
  if (_lhs.picking) {
    const p = at(e);
    const f = info.frame0;
    const px = Math.min(f.width - 1, Math.floor(p.x)), py = Math.min(f.height - 1, Math.floor(p.y));
    const i = (py * f.width + px) * 4;
    if (f.data[i + 3] < 128) { _lhsMsg('That spot is already see-through. Pick a coloured part of the background.'); return; }
    _lhsPicking(false);
    pic.bg.on = true;
    _lhsSet('bg.color', lhpRgbToHex([f.data[i], f.data[i + 1], f.data[i + 2]]));
    _lhsPaintControls();
    return;
  }
  const handle = e.target.dataset && e.target.dataset.h;
  const start = at(e);
  const c0 = Object.assign({}, pic.crop || { x: 0, y: 0, w: W, h: H });
  const inBox = e.target === cb || !!handle;
  // A press outside the box starts a new one from there.
  const mode = handle || (inBox ? 'move' : 'new');
  let r = c0;
  frame.setPointerCapture(e.pointerId);
  const MIN = Math.max(4, Math.round(8 / k));
  const move = (ev) => {
    const p = at(ev);
    const dx = p.x - start.x, dy = p.y - start.y;
    let x0 = c0.x, y0 = c0.y, x1 = c0.x + c0.w, y1 = c0.y + c0.h;
    if (mode === 'move') {
      const nx = Math.max(0, Math.min(W - c0.w, c0.x + dx)), ny = Math.max(0, Math.min(H - c0.h, c0.y + dy));
      r = { x: nx, y: ny, w: c0.w, h: c0.h };
    } else if (mode === 'new') {
      r = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
    } else {
      if (mode.includes('w')) x0 = Math.min(x1 - MIN, Math.max(0, c0.x + dx));
      if (mode.includes('e')) x1 = Math.max(x0 + MIN, Math.min(W, c0.x + c0.w + dx));
      if (mode.includes('n')) y0 = Math.min(y1 - MIN, Math.max(0, c0.y + dy));
      if (mode.includes('s')) y1 = Math.max(y0 + MIN, Math.min(H, c0.y + c0.h + dy));
      r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    place(r);
  };
  const up = () => {
    frame.removeEventListener('pointermove', move);
    frame.removeEventListener('pointerup', up);
    frame.removeEventListener('pointercancel', up);
    if (r.w < MIN || r.h < MIN) { place(c0); return; }
    const crop = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
    const whole = crop.x === 0 && crop.y === 0 && crop.w === W && crop.h === H;
    pic.crop = whole ? null : crop;
    const clean = lhpNormalizePic(pic);
    if (clean) _lhs.pics[_lhs.key] = clean;
    _lhsChanged('crop');
    _lhsPaintControls();
  };
  frame.addEventListener('pointermove', move);
  frame.addEventListener('pointerup', up);
  frame.addEventListener('pointercancel', up);
}

function _lhsPicking(on) {
  if (!_lhs) return;
  const was = _lhs.picking;
  _lhs.picking = !!on && !!_lhsPic();
  if (_lhs.picking && _lhs.view !== 'crop') { _lhsSetView('crop'); }
  else if (was !== _lhs.picking && _lhs.view === 'crop') _lhsPaintCrop();
  const chip = _lhs.el.querySelector('[data-act="bgpick"]');
  if (chip) chip.classList.toggle('is-on', _lhs.picking);
}

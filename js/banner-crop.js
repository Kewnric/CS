/* ============================================================
   BANNER-CROP.JS — place, zoom and dim a folder banner
   ============================================================
   Built in the shared #dialog-modal, the way showIconPicker is. The preview
   is a real .tree-node-row at the folder's own size, drawn with the same
   .fb-layer markup and CSS the tree uses, so what you see is what you get.

   The crop is three numbers (folder-banner.js): the focal point x/y in %
   and the zoom. Dragging moves the focal point so the picture follows the
   pointer: the picture's left edge sits at -x% of how far the zoomed,
   covering picture overhangs the box, so a move of dx is -dx/overhang.
   ============================================================ */

let _bcLive = null;   // the open window's state, or null

function _bcClampB(b) {
  const c = (v, lo, hi, d) => { v = Number(v); if (!isFinite(v)) v = d; return Math.min(hi, Math.max(lo, v)); };
  const r = v => Math.round(v * 100) / 100;
  return {
    src: b.src,
    x: r(c(b.x, 0, 100, 50)),
    y: r(c(b.y, 0, 100, 50)),
    zoom: r(c(b.zoom, 1, 4, 1)),
    dim: r(c(b.dim, 0, 0.7, 0.3)),
    tint: r(c(b.tint, 0, 1, 1))     // the selected row's cyan wash over the picture
  };
}

/* The preview layers always show the real picture, so a GIF moves here
   (no is-gif class: the tree's still/play swapping leaves them alone). */
function _bcLayer(src, extra) {
  return '<span class="fb-layer' + (extra ? ' ' + extra : '') + '" data-fb-ref="' + escapeHTML(src)
    + '" aria-hidden="true"><img class="fb-img" src="' + escapeHTML(mediaSrc(src)) + '" alt="" draggable="false"></span>';
}

/**
 * Open the crop window.
 * opts: { banner: {src,x,y,zoom,dim}, label, icon, count, rowEl, onSave(b), onCancel() }
 */
function bannerCropOpen(opts) {
  const modal = document.getElementById('dialog-modal');
  if (!modal || !opts || !opts.banner) return;
  if (_bcLive) _bcFinish(false);

  const rect = opts.rowEl ? opts.rowEl.getBoundingClientRect() : null;
  const boxW = Math.max(160, Math.round((rect && rect.width) || 300));
  const boxH = Math.max(32, Math.round((rect && rect.height) || 44));
  const icon = escapeHTML(opts.icon || 'folder');
  const label = escapeHTML(opts.label || 'Folder');
  const count = opts.count != null && opts.count !== '' ? '<span class="tree-node-badge">' + escapeHTML(String(opts.count)) + '</span>' : '';

  const st = _bcLive = { b: _bcClampB(opts.banner), opts, modal, done: false, drag: null, boxW, boxH };

  document.getElementById('dialog-title').innerText = 'Folder banner';
  document.getElementById('dialog-msg').innerText = 'Drag the picture to move it. Scroll or use Zoom to get closer.';
  document.getElementById('dialog-icon').innerHTML =
    '<i data-lucide="crop" class="modal-icon-svg" style="color:var(--color-primary);"></i>';
  document.getElementById('dialog-actions').innerHTML =
    '<div class="bc">'
    + '<div class="bc-stage">'
    +   '<div class="tree-node bc-node" data-level="0">'
    +     '<div id="bc-preview" class="tree-node-row bc-row active" style="width:' + boxW + 'px;height:' + boxH + 'px">'
    +       '<i data-lucide="chevron-right" class="tree-node-chevron"></i>'
    +       '<i data-lucide="' + icon + '" class="tree-node-icon folder-icon-color"></i>'
    +       '<span class="tree-node-label">' + label + '</span>' + count
    +     '</div>'
    +     '<div class="tree-children collapsed bc-kids"></div>'
    +   '</div>'
    + '</div>'
    + '<div class="bc-side">'
    +   '<div class="bc-seg" role="radiogroup" aria-label="Preview as">'
    +     '<button id="bc-as-sel" type="button" class="bc-seg-btn is-on" role="radio" aria-checked="true">Selected</button>'
    +     '<button id="bc-as-open" type="button" class="bc-seg-btn" role="radio" aria-checked="false">Open</button>'
    +   '</div>'
    +   '<div class="tfv-tile is-folder has-photo is-open bc-tile" style="--tfv-c:var(--color-primary, #6366f1)" aria-hidden="true">'
    +     '<span class="tfv-glyph"><span class="tfv-flap"></span><span class="tfv-tab"></span><i data-lucide="' + icon + '"></i></span>'
    +     '<span class="tfv-name">' + label + '</span>'
    +   '</div>'
    + '</div>'
    + '<label class="bc-field"><span>Zoom</span><input id="bc-zoom" type="range" min="100" max="400" step="5"><output id="bc-zoom-v"></output></label>'
    + '<label class="bc-field"><span>Dim</span><input id="bc-dim" type="range" min="0" max="70" step="1"><output id="bc-dim-v"></output></label>'
    + '<label class="bc-field" title="The cyan tint over the picture while the folder is selected. 0% turns it off.">'
    +   '<span>Highlight</span><input id="bc-tint" type="range" min="0" max="100" step="5"><output id="bc-tint-v"></output></label>'
    + '<div class="bc-foot">'
    +   '<button id="bc-auto" class="btn btn-ghost btn-sm" type="button"><i data-lucide="scan"></i> Auto</button>'
    +   '<button id="bc-swap" class="btn btn-ghost btn-sm" type="button"><i data-lucide="image-plus"></i> Change picture</button>'
    +   '<span class="bc-spacer"></span>'
    +   '<button id="dlg-cancel" class="btn btn-secondary btn-sm" type="button">Cancel</button>'
    +   '<button id="dlg-confirm" class="btn btn-primary btn-sm" type="button">Save</button>'
    + '</div>'
    + '</div>';

  _bcPaintPicture();
  _bcPaint();

  const $ = id => document.getElementById(id);
  $('bc-zoom').addEventListener('input', e => { st.b.zoom = Number(e.target.value) / 100; _bcPaint(); });
  $('bc-dim').addEventListener('input', e => { st.b.dim = Number(e.target.value) / 100; _bcPaint(); });
  $('bc-tint').addEventListener('input', e => {
    st.b.tint = Number(e.target.value) / 100;
    _bcPreviewAs('sel');   // the highlight only shows on a selected row
    _bcPaint();
  });
  $('bc-auto').onclick = () => { st.b.x = 50; st.b.y = 50; st.b.zoom = 1; _bcPaint(); };
  $('bc-swap').onclick = _bcChooseAnother;
  $('bc-as-sel').onclick = () => _bcPreviewAs('sel');
  $('bc-as-open').onclick = () => _bcPreviewAs('open');
  $('dlg-cancel').onclick = () => _bcFinish(false);
  $('dlg-confirm').onclick = () => _bcFinish(true);

  const prev = $('bc-preview');
  prev.addEventListener('pointerdown', _bcDown);
  prev.addEventListener('pointermove', _bcMove);
  prev.addEventListener('pointerup', _bcUp);
  prev.addEventListener('pointercancel', _bcUp);
  prev.addEventListener('wheel', _bcWheel, { passive: false });

  // Capture, so Escape cancels here before the page-wide handler just hides it.
  document.addEventListener('keydown', _bcKey, true);
  document.addEventListener('paste', _bcPaste);
  modal.addEventListener('click', _bcOverlayClick);

  _dlgOpen(modal, 'dialog-icons');
  modal.classList.add('dialog-banner');
  if (typeof _trapFocus === 'function') _trapFocus(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal });
  $('dlg-confirm').focus();
}

/* Put the current picture into the row and tile previews. */
function _bcPaintPicture() {
  const st = _bcLive;
  if (!st) return;
  const row = st.modal.querySelector('#bc-preview');
  const glyph = st.modal.querySelector('.bc-tile .tfv-glyph');
  // First child of each, like the tree: the layer is positioned against them.
  [row, glyph].forEach(el => { if (el) el.querySelectorAll(':scope > .fb-layer').forEach(n => n.remove()); });
  if (row) row.insertAdjacentHTML('afterbegin', _bcLayer(st.b.src));
  if (glyph) glyph.insertAdjacentHTML('afterbegin', _bcLayer(st.b.src, 'tfv-photo'));
  const img = row && row.querySelector('.fb-img');
  st.img = img;
  if (img && !img.complete) img.addEventListener('load', _bcPaint, { once: true });
}

function _bcPaint() {
  const st = _bcLive;
  if (!st) return;
  st.b = _bcClampB(st.b);
  const vars = folderBannerVars(st.b);
  st.modal.querySelectorAll('.bc .fb-layer').forEach(l => l.setAttribute('style', vars));
  const z = document.getElementById('bc-zoom'), d = document.getElementById('bc-dim');
  if (z) z.value = String(Math.round(st.b.zoom * 100));
  if (d) d.value = String(Math.round(st.b.dim * 100));
  const t = document.getElementById('bc-tint');
  if (t) t.value = String(Math.round(st.b.tint * 100));
  const zv = document.getElementById('bc-zoom-v'), dv = document.getElementById('bc-dim-v'), tv = document.getElementById('bc-tint-v');
  if (zv) zv.textContent = Math.round(st.b.zoom * 100) + '%';
  if (dv) dv.textContent = Math.round(st.b.dim * 100) + '%';
  if (tv) tv.textContent = Math.round(st.b.tint * 100) + '%';
}

function _bcPreviewAs(mode) {
  const st = _bcLive;
  if (!st) return;
  const row = document.getElementById('bc-preview');
  const kids = st.modal.querySelector('.bc-kids');
  row.classList.toggle('active', mode === 'sel');
  kids.classList.toggle('collapsed', mode === 'sel');
  ['sel', 'open'].forEach(m => {
    const btn = document.getElementById('bc-as-' + m);
    btn.classList.toggle('is-on', m === mode);
    btn.setAttribute('aria-checked', String(m === mode));
  });
}

/* How far the zoomed, covering picture overhangs the box, in px. */
function _bcOverhang() {
  const st = _bcLive;
  const info = mediaInfo(st.b.src) || {};
  const nw = (st.img && st.img.naturalWidth) || info.w || 0;
  const nh = (st.img && st.img.naturalHeight) || info.h || 0;
  const row = document.getElementById('bc-preview');
  const bw = (row && row.offsetWidth) || st.boxW, bh = (row && row.offsetHeight) || st.boxH;
  if (!nw || !nh) return { x: 0, y: 0 };
  const s = Math.max(bw / nw, bh / nh) * st.b.zoom;
  return { x: nw * s - bw, y: nh * s - bh };
}

function _bcNudge(dx, dy) {
  const st = _bcLive;
  const ov = _bcOverhang();
  // Nothing to pan along an axis: leave it where it is.
  if (ov.x >= 1) st.b.x -= dx / ov.x * 100;
  if (ov.y >= 1) st.b.y -= dy / ov.y * 100;
  _bcPaint();
}

function _bcDown(e) {
  if (e.button !== 0 || !_bcLive) return;
  _bcLive.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
  e.currentTarget.classList.add('is-dragging');
  e.preventDefault();
}
function _bcMove(e) {
  const st = _bcLive;
  if (!st || !st.drag || e.pointerId !== st.drag.id) return;
  const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
  st.drag.x = e.clientX; st.drag.y = e.clientY;
  _bcNudge(dx, dy);
}
function _bcUp(e) {
  if (!_bcLive || !_bcLive.drag) return;
  _bcLive.drag = null;
  e.currentTarget.classList.remove('is-dragging');
}
function _bcWheel(e) {
  if (!_bcLive) return;
  e.preventDefault();
  _bcLive.b.zoom += e.deltaY < 0 ? 0.1 : -0.1;
  _bcPaint();
}

function _bcKey(e) {
  const st = _bcLive;
  if (!st) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); _bcFinish(false); return; }
  const t = e.target;
  const tag = t && t.tagName;
  if (e.key === 'Enter') {
    if (tag === 'BUTTON') return;      // Enter on a button presses that button
    e.preventDefault(); _bcFinish(true); return;
  }
  if (tag === 'INPUT') return;          // the sliders keep their own arrows
  const step = 2;
  const ov = _bcOverhang();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    // An arrow moves the focal point 2%, the same as dragging that far.
    const px = (e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0) * step / 100 * ov.x;
    const py = (e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0) * step / 100 * ov.y;
    _bcNudge(px, py);
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault(); st.b.zoom += 0.1; _bcPaint();
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault(); st.b.zoom -= 0.1; _bcPaint();
  }
}

async function _bcUseFile(file) {
  const st = _bcLive;
  if (!st || !file) return;
  const ref = await folderBannerUpload(file);
  if (!ref || _bcLive !== st || st.done) return;
  st.b = { src: ref, x: 50, y: 50, zoom: 1, dim: st.b.dim, tint: st.b.tint };
  _bcPaintPicture();
  _bcPaint();
}

function _bcChooseAnother() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = FOLDER_BANNER_TYPES.join(',');
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.remove();
    if (f) _bcUseFile(f);
  });
  document.body.appendChild(input);
  input.click();
}

function _bcPaste(e) {
  if (!_bcLive || !e.clipboardData) return;
  const item = Array.from(e.clipboardData.items || []).find(i => i.kind === 'file' && /^image\//.test(i.type));
  if (!item) return;
  e.preventDefault();
  _bcUseFile(item.getAsFile());
}

function _bcOverlayClick(e) {
  if (_bcLive && e.target === _bcLive.modal) _bcFinish(false);
}

function _bcFinish(save) {
  const st = _bcLive;
  if (!st || st.done) return;
  st.done = true;
  _bcLive = null;
  document.removeEventListener('keydown', _bcKey, true);
  document.removeEventListener('paste', _bcPaste);
  st.modal.removeEventListener('click', _bcOverlayClick);
  st.modal.classList.remove('dialog-icons', 'dialog-banner');
  closeModalSmooth(st.modal);
  const b = _bcClampB(st.b);
  if (save) { if (st.opts.onSave) st.opts.onSave(b); }
  else if (st.opts.onCancel) st.opts.onCancel();
}

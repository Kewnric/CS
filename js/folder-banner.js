/* ============================================================
   FOLDER-BANNER.JS — a picture behind a folder's tree row
   ============================================================

   A folder record may carry
       banner: { src: 'media:<id>', x, y, zoom, dim }
   x/y: the focal point in % (object-position), zoom 1-4, dim 0-0.7.
   The crop is stored as those numbers, never as cut pixels, so a GIF keeps
   moving and the picture can be re-cropped without uploading it again.

   Every tree renderer drops folderBannerHTML(rec) in as the FIRST child of
   the folder's .tree-node-row. Whether it shows is pure CSS
   (css/folder-banner.css): the row is .active, or its folder is open.
   Selection is a class toggle (treeCommit) and the expand toggles act in
   place, so the fades run on real state changes and never on a rebuild.

   GIFS: a still copy of the first frame (canvas, kept in memory) is shown
   until the row is selected, or hovered while its banner is showing; then
   the real GIF plays. A hidden banner never decodes the moving picture.

   A banner whose picture is not on this device draws nothing: the row stays
   plain, never a blank or broken banner.
   ============================================================ */

(window.MEDIA_READERS = window.MEDIA_READERS || {})['folder-banner'] = true;

const _fbStills = new Map();     // media ref -> object URL of its first frame
const _fbStillJobs = new Map();  // media ref -> the pending still

function _fbClamp(v, lo, hi, dflt) {
  v = Number(v);
  if (!isFinite(v)) v = dflt;
  return Math.min(hi, Math.max(lo, v));
}
function _fbNum(v) { return String(Math.round(v * 100) / 100); }

/**
 * The CSS variables for a banner's position, zoom, dim and highlight, clamped.
 * tint (0-1) is how strongly the selected row's cyan wash shows over the
 * picture; banners saved before it existed read as 1, the full wash.
 */
function folderBannerVars(b) {
  b = b || {};
  return '--fb-x:' + _fbNum(_fbClamp(b.x, 0, 100, 50)) + '%;'
    + '--fb-y:' + _fbNum(_fbClamp(b.y, 0, 100, 50)) + '%;'
    + '--fb-z:' + _fbNum(_fbClamp(b.zoom, 1, 4, 1)) + ';'
    + '--fb-dim:' + _fbNum(_fbClamp(b.dim, 0, 0.7, 0.3)) + ';'
    + '--fb-tint:' + _fbNum(_fbClamp(b.tint, 0, 1, 1));
}

function _fbIsGif(ref) {
  const info = typeof mediaInfo === 'function' ? mediaInfo(ref) : null;
  return !!(info && /gif/i.test(info.type || ''));
}

/**
 * The layer itself. A GIF's img has no src here: folderBannerHydrate gives
 * it the still, so a blob: URL that changes on hover never enters a tree's
 * markup (treeCommit compares markup strings to decide on a rebuild).
 */
function folderBannerLayerHTML(ref, styleAttr, extraCls) {
  const gif = _fbIsGif(ref);
  const cls = 'fb-layer' + (gif ? ' is-gif' : '') + (extraCls ? ' ' + extraCls : '');
  const src = gif ? '' : ' src="' + escapeHTML(mediaSrc(ref)) + '"';
  return '<span class="' + cls + '" data-fb-ref="' + escapeHTML(ref) + '" style="' + escapeHTML(styleAttr || '')
    + '" aria-hidden="true"><img class="fb-img"' + src + ' alt="" decoding="sync" draggable="false"></span>';
}

/** A folder record's banner layer, or '' when it has none (or its picture is not here). */
function folderBannerHTML(rec) {
  const b = rec && rec.banner;
  if (!b || typeof b !== 'object' || typeof mediaIsRef !== 'function' || !mediaIsRef(b.src)) return '';
  if (typeof mediaInfo !== 'function' || !mediaInfo(b.src)) return '';
  return folderBannerLayerHTML(b.src, folderBannerVars(b));
}

/* ── GIF stills ──────────────────────────────────────────── */

function folderBannerStillCached(ref) { return _fbStills.get(ref) || null; }

/** The first frame of a stored picture, as an object URL (cached). */
function folderBannerStill(ref) {
  if (_fbStills.has(ref)) return Promise.resolve(_fbStills.get(ref));
  if (_fbStillJobs.has(ref)) return _fbStillJobs.get(ref);
  const job = (async () => {
    try {
      if (typeof mediaReady === 'function') await mediaReady();
      if (!mediaInfo(ref)) return null;
      // A fresh image that is never in the document has not started to
      // animate, so what it draws is the first frame.
      const im = new Image();
      im.src = mediaSrc(ref);
      await im.decode();
      const w0 = im.naturalWidth, h0 = im.naturalHeight;
      if (!w0 || !h0) return null;
      const k = Math.min(1, 1200 / Math.max(w0, h0));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w0 * k));
      c.height = Math.max(1, Math.round(h0 * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.85));
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      _fbStills.set(ref, url);
      return url;
    } catch (e) {
      return null;
    } finally {
      _fbStillJobs.delete(ref);
    }
  })();
  _fbStillJobs.set(ref, job);
  return job;
}

/* ── Still or playing ────────────────────────────────────── */

/** Is the layer on screen? A row's only while its folder is open or selected; a tile's whenever hovered. */
function _fbShown(host) {
  if (host.classList.contains('tfv-tile')) return true;
  if (host.classList.contains('active')) return true;
  const node = host.parentElement;
  const kids = node && node.querySelector(':scope > .tree-children');
  return !!(kids && !kids.classList.contains('collapsed'));
}

function _fbWantsPlay(layer, hover) {
  const host = layer.closest('.tree-node-row, .tfv-tile');
  if (!host) return false;
  if (host.classList.contains('active')) return true;
  const over = hover !== undefined ? hover : (host.matches(':hover') || host.matches(':focus-visible'));
  return !!over && _fbShown(host);
}

function _fbApply(layer, hover) {
  if (!layer.classList.contains('has-frame')) return;
  const ref = layer.dataset.fbRef;
  const img = layer.querySelector('.fb-img');
  if (!ref || !img) return;
  const want = _fbWantsPlay(layer, hover) ? mediaSrc(ref) : folderBannerStillCached(ref);
  if (want && img.getAttribute('src') !== want) img.setAttribute('src', want);
}

/** Play or still every GIF banner under root, from its row's state. */
function folderBannerSyncPlay(root) {
  if (!root) return;
  if (root.classList && root.classList.contains('fb-layer')) { _fbApply(root); return; }
  if (!root.querySelectorAll) return;
  root.querySelectorAll('.fb-layer.is-gif.has-frame').forEach(l => _fbApply(l));
}

/** Give each GIF banner under root its still -- synchronously when it is cached. */
function folderBannerHydrate(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('.fb-layer.is-gif:not(.has-frame)').forEach(layer => {
    const ref = layer.dataset.fbRef;
    const img = layer.querySelector('.fb-img');
    if (!ref || !img) return;
    const ready = (url) => {
      if (!url) return;
      if (!layer.classList.contains('has-frame')) {
        img.setAttribute('src', url);
        layer.classList.add('has-frame');
      }
      _fbApply(layer);
    };
    const cached = folderBannerStillCached(ref);
    if (cached) ready(cached);
    else folderBannerStill(ref).then(ready);
  });
  folderBannerSyncPlay(root);
}

/* Hover and keyboard focus start and stop the GIFs. Told explicitly rather
   than read back from :hover, which is not settled yet inside pointerout. */
function _fbHostEvent(e, on) {
  const host = e.target && e.target.closest ? e.target.closest('.tree-node-row, .tfv-tile') : null;
  if (!host) return;
  const rel = e.relatedTarget;
  if (rel && host.contains(rel)) return;
  host.querySelectorAll('.fb-layer.is-gif.has-frame').forEach(l => _fbApply(l, on));
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerover', e => _fbHostEvent(e, true));
  document.addEventListener('pointerout', e => _fbHostEvent(e, false));
  document.addEventListener('focusin', e => _fbHostEvent(e, true));
  document.addEventListener('focusout', e => _fbHostEvent(e, false));
}

/* ── Setting one: the right-click menu ───────────────────── */

const FOLDER_BANNER_MAX_BYTES = 25 * 1024 * 1024;
const FOLDER_BANNER_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function _fbWarn(msg) {
  if (typeof toast === 'function') toast(msg, { type: 'warning' });
}

/**
 * Check a chosen file and store it in the picture store. Resolves to its
 * media: reference, or null after telling the user why not. A banner never
 * keeps a data: URL in the save, so a browser that refuses the picture
 * store gets no banner rather than a 5 MB-budget one.
 */
async function folderBannerUpload(file) {
  if (!file) return null;
  if (FOLDER_BANNER_TYPES.indexOf(file.type) === -1) {
    _fbWarn('A banner has to be a PNG, JPG, GIF or WebP picture.');
    return null;
  }
  if (file.size > FOLDER_BANNER_MAX_BYTES) {
    _fbWarn('That picture is over 25 MB. Pick a smaller one for the banner.');
    return null;
  }
  let ref = null;
  try { ref = await mediaUpload(file); } catch (e) { ref = null; }
  if (!mediaIsRef(ref)) {
    _fbWarn('This browser would not store the picture, so the banner was not set.');
    return null;
  }
  return ref;
}

/** The folder's own row on screen, for the crop window's size and count. */
function _fbRowFor(id) {
  try {
    return document.querySelector('.tree-node[data-node-id="' + CSS.escape(String(id)) + '"] > .tree-node-row');
  } catch (e) { return null; }
}

function _fbOpenCrop(rec, banner, commit) {
  const row = _fbRowFor(rec.id);
  const badge = row && row.querySelector('.tree-node-badge, .tree-node-count');
  bannerCropOpen({
    banner,
    label: rec.name || '',
    icon: rec.icon || 'folder',
    count: badge ? badge.textContent.trim() : '',
    rowEl: row,
    onSave: (b) => { rec.banner = b; commit(); },
    onCancel: () => {}
  });
}

/** A file chosen for a folder: checked, stored, then the crop window. */
async function folderBannerPickFile(rec, commit, file) {
  const ref = await folderBannerUpload(file);
  if (!ref) return;
  const old = rec.banner || {};
  _fbOpenCrop(rec, {
    src: ref, x: 50, y: 50, zoom: 1,
    dim: isFinite(old.dim) ? old.dim : 0.3,
    tint: isFinite(old.tint) ? old.tint : 1
  }, commit);
}

/** Change banner…: ask for a picture file. */
function folderBannerPick(rec, commit) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = FOLDER_BANNER_TYPES.join(',');
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.remove();
    if (file) folderBannerPickFile(rec, commit, file);
  });
  document.body.appendChild(input);
  input.click();
}

/** Adjust banner…: the crop window over the picture already set. */
function folderBannerAdjust(rec, commit) {
  const b = rec && rec.banner;
  if (!b || !mediaInfo(b.src)) return;
  _fbOpenCrop(rec, { src: b.src, x: b.x, y: b.y, zoom: b.zoom, dim: b.dim, tint: b.tint }, commit);
}

function folderBannerRemove(rec, commit) {
  if (!rec) return;
  delete rec.banner;
  commit();
}

/**
 * The menu entries for one folder record. `commit` saves wherever that
 * record lives and redraws its tree.
 */
function folderBannerMenuItems(rec, commit) {
  const items = [{ icon: 'image-plus', label: 'Change banner…', fn: () => folderBannerPick(rec, commit) }];
  const b = rec && rec.banner;
  if (b) {
    if (mediaInfo(b.src)) items.push({ icon: 'crop', label: 'Adjust banner…', fn: () => folderBannerAdjust(rec, commit) });
    items.push({ icon: 'image-off', label: 'Remove banner', fn: () => folderBannerRemove(rec, commit) });
  }
  return items;
}

/* Rows drawn before the pictures were read came out plain; draw them again. */
if (typeof mediaReady === 'function') {
  mediaReady().then(() => { if (typeof treeRefreshHosts === 'function') treeRefreshHosts(); });
}

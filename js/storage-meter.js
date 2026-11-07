/* ============================================================
   STORAGE-METER.JS — how much of the browser's space the app uses
   ============================================================

   Two budgets, because the browser keeps two:

   - localStorage: everything the app saves as text — the library, your
     history, the boards, every setting. Each site gets about 5 MB of it in
     every major browser (Chrome, Edge, Firefox and Safari all stop near
     5,242,880 characters), counted in characters, not bytes. This is the one
     that can run out, so it is shown first, with what is using it.

   - Everything else — IndexedDB (the sticker pictures) and Cache Storage (the
     offline copy of the app) — shares a far larger allowance, a part of the
     disk, which navigator.storage.estimate() reports.

   Painted when Settings opens. Nothing here runs otherwise.
   ============================================================ */

const STO_LOCAL_LIMIT = 5 * 1024 * 1024;   // characters (see above)

/* Which saved keys belong to what, in words. First match wins. */
const STO_GROUPS = [
  [/\.corrupt\./, 'Old recovery copies'],
  [/^codePlatformData/, 'Library and history'],
  [/^(vizCanvasData|brainCanvasData)/, 'Visualize boards'],
  [/^questBoardData/, 'Quest Board'],
  [/^cheatsheetLibrary/, 'Cheat sheets'],
  [/(draft|inprogress)/i, 'Attempts in progress'],
  [/^ssp\.stickers/, 'Sticker placements'],
];

function _stoSize(n) {
  if (!isFinite(n) || n < 0) return '–';
  if (n < 1024) return Math.round(n) + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(n < 100 * 1024 * 1024 ? 1 : 0) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
}

function _stoEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/** Characters in localStorage, in total and by what they are, and how long it all would be unpacked. */
function _stoLocalUse() {
  const groups = new Map();
  let total = 0, unpacked = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      const v = localStorage.getItem(k) || '';
      const n = k.length + v.length;
      total += n;
      unpacked += k.length + (typeof storeOriginalLength === 'function' ? storeOriginalLength(v) : v.length);
      const g = (STO_GROUPS.find(([re]) => re.test(k)) || [null, 'Settings and other'])[1];
      groups.set(g, (groups.get(g) || 0) + n);
    }
  } catch (e) { return null; }
  return { total, unpacked, groups: Array.from(groups.entries()).sort((a, b) => b[1] - a[1]) };
}

function _stoBlock(name, used, limit, limitText, notes) {
  const pct = limit > 0 ? Math.min(100, used / limit * 100) : 0;
  const tone = pct >= 95 ? ' is-full' : pct >= 80 ? ' is-warn' : '';
  const shown = pct > 0 && pct < 1 ? '<1' : String(Math.round(pct));
  return '<span class="sto-head"><span class="sto-name">' + _stoEsc(name) + '</span>' +
      '<span class="sto-num">' + _stoSize(used) + ' / ' + limitText + '</span></span>' +
    '<span class="sto-bar' + tone + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '"' +
      ' aria-label="' + _stoEsc(name) + ': ' + shown + '% used">' +
      '<span class="sto-fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
    '<span class="sto-note">' + notes.map(_stoEsc).join(' · ') + '</span>';
}

/** Fill in the Storage row of Settings. */
async function storageMeterPaint() {
  const localBox = document.getElementById('sto-local');
  const otherBox = document.getElementById('sto-other');
  if (!localBox || !otherBox) return;

  const local = _stoLocalUse();
  if (!local) {
    localBox.innerHTML = '<span class="sto-note">This browser will not say how much it is keeping.</span>';
  } else {
    const left = Math.max(0, STO_LOCAL_LIMIT - local.total);
    const notes = [_stoSize(left) + ' left'];
    // The big saves are kept compressed (store-codec.js); say what that is worth.
    if (local.unpacked > local.total * 1.2) notes.push('compressed from ' + _stoSize(local.unpacked));
    notes.push(...local.groups.slice(0, 3).filter(g => g[1] > 0).map(g => g[0] + ' ' + _stoSize(g[1])));
    localBox.innerHTML = _stoBlock('Your data', local.total, STO_LOCAL_LIMIT, 'about 5 MB', notes);
    localBox.title = 'Your library, history, boards and settings. Browsers allow a site about 5 MB of this.\n' +
      local.groups.map(g => g[0] + ': ' + _stoSize(g[1])).join('\n');
    _stoCompressOffer(localBox, local.total);
  }

  if (!navigator.storage || !navigator.storage.estimate) {
    otherBox.innerHTML = '<span class="sto-note">Pictures and the offline copy: this browser does not report their size.</span>';
    return;
  }
  try {
    const [est, pics] = await Promise.all([
      navigator.storage.estimate(),
      typeof stkPictureBytes === 'function' ? stkPictureBytes() : Promise.resolve(0),
    ]);
    const used = est.usage || 0, quota = est.quota || 0;
    const d = est.usageDetails || {};
    const notes = [_stoSize(Math.max(0, quota - used)) + ' left'];
    if (pics) notes.push('Sticker pictures ' + _stoSize(pics));
    if (d.caches) notes.push('Offline copy ' + _stoSize(d.caches));
    otherBox.innerHTML = _stoBlock('Pictures and offline copy', used, quota, _stoSize(quota), notes);
    otherBox.title = 'Sticker pictures and the copy of the app kept for working offline. ' +
      'The browser lets this grow to a share of the disk.';
  } catch (e) {
    otherBox.innerHTML = '<span class="sto-note">Pictures and the offline copy: not available here.</span>';
  }
}

/* Saves from before compression are packed on their own a few seconds after
   the app starts. This is the same thing on demand, with the result shown --
   and, while an update is still half installed, the reason it cannot yet. */
function _stoCompressOffer(box, totalBefore) {
  const pending = typeof storeUnpackedSaves === 'function' ? storeUnpackedSaves() : [];
  if (!pending.length) return;
  const chars = pending.reduce((n, u) => n + u.chars, 0);
  const ready = pending.every(u => u.ready);
  const row = document.createElement('span');
  row.className = 'sto-act';
  row.innerHTML = '<span class="sto-act-text"></span>' +
    (ready ? '<button type="button" class="sto-act-btn">Compress now</button>' : '');
  row.querySelector('.sto-act-text').textContent = ready
    ? _stoSize(chars) + ' of this is not compressed yet.'
    : 'The update is still installing. Reload the app once more, then compress.';
  box.appendChild(row);
  const btn = row.querySelector('.sto-act-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Compressing…';
    try { await storeCompactExisting(); } catch (e) { console.error('[storage] compress failed', e); }
    await storageMeterPaint();
    const after = _stoLocalUse();
    if (after && typeof toast === 'function') {
      const smaller = after.total < totalBefore;
      toast(smaller
        ? 'Compressed. Your data now takes ' + _stoSize(after.total) + ' instead of ' + _stoSize(totalBefore) + '.'
        : 'Nothing could be compressed right now. Your data is unchanged.', { type: smaller ? 'success' : 'info' });
    }
  });
}

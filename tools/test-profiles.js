/* Unit tests for profile isolation (no browser): node tools/test-profiles.js
   js/profile-keys.js -- whose drafts and device-kept data the shared keys
   hold -- and js/stickers.js's per-profile placements and pictures: whose
   stickers are shown, switching profiles, the stickers from before profiles
   (the login page's to the device, the rest kept or deleted from the tray),
   and a picture used by two profiles. Both files share the app's global
   scope, so each runs in a vm context with what it reaches for stubbed. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failed = 0, passed = 0;
function ok(cond, name) {
  if (cond) { passed++; return; }
  failed++;
  console.log('FAIL ' + name);
}
function eq(a, b, name) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) console.log('  got      ' + JSON.stringify(a) + '\n  expected ' + JSON.stringify(b));
  ok(same, name);
}

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

/** localStorage, as a Map; `full` makes every write throw like a quota error. */
function storage(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    full: false,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { if (this.full) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}

/* ── profile-keys.js ─────────────────────────────────────── */

function keys(init) {
  const st = storage(init);
  // Quiet: the full-store case warns on purpose.
  const ctx = { console: { log: console.log, error: console.error, warn() {} }, localStorage: st };
  vm.createContext(ctx);
  vm.runInContext(JS('profile-keys.js'), ctx);
  return { ctx, st, run: (src) => vm.runInContext(src, ctx) };
}

{
  // A device from before owners: the values are Guest's, and an account entering first does not get them.
  const { ctx, st } = keys({ 'ssp.psetDrafts': '{"g":1}', anSrsState: '{"p":1}', 'ssp.motion': 'full' });
  ok(ctx.profileKeysEnter('u:A', st) === true, 'an account entering an old device swaps');
  eq(st.getItem('ssp.psetDrafts'), null, 'the account does not see Guest\'s drafts');
  eq(st.getItem('anSrsState'), null, 'nor Guest\'s review schedule');
  eq(st.getItem('ssp.motion'), 'full', 'taste is not a profile\'s: it stays');
  eq(st.getItem('ssp.profileOwner'), 'u:A', 'the keys are now the account\'s');
  eq(JSON.parse(st.getItem('ssp.profile.guest')), { 'ssp.psetDrafts': '{"g":1}', anSrsState: '{"p":1}' }, 'Guest\'s are parked');

  // The account writes its own, then Guest comes back.
  st.setItem('ssp.psetDrafts', '{"a":1}');
  ok(ctx.profileKeysEnter('guest', st), 'Guest entering swaps back');
  eq(st.getItem('ssp.psetDrafts'), '{"g":1}', 'Guest gets its own drafts back');
  eq(st.getItem('anSrsState'), '{"p":1}', 'and its review schedule');
  eq(st.getItem('ssp.profile.guest'), null, 'the parked copy is taken, not left behind');
  eq(JSON.parse(st.getItem('ssp.profile.u:A')), { 'ssp.psetDrafts': '{"a":1}' }, 'the account\'s are parked in turn');

  // The account again: its own back, Guest's parked.
  ctx.profileKeysEnter('u:A', st);
  eq(st.getItem('ssp.psetDrafts'), '{"a":1}', 'the account gets its own drafts back');
  eq(st.getItem('anSrsState'), null, 'and none of Guest\'s');

  // A second account sees neither.
  ctx.profileKeysEnter('u:B', st);
  eq([st.getItem('ssp.psetDrafts'), st.getItem('anSrsState')], [null, null], 'a second account starts with nothing');

  // B signs out: B's go, the others' stay parked.
  st.setItem('ssp.sqlAttemptDraft', '{"b":1}');
  ctx.profileKeysDrop('u:B', st);
  eq(st.getItem('ssp.sqlAttemptDraft'), null, 'signing out drops the account\'s drafts');
  eq(st.getItem('ssp.profileOwner'), '', 'and the keys are nobody\'s');
  ok(st.getItem('ssp.profile.u:A') !== null && st.getItem('ssp.profile.guest') !== null, 'other profiles\' parked drafts stay');
  ctx.profileKeysEnter('guest', st);
  eq(st.getItem('ssp.psetDrafts'), '{"g":1}', 'Guest after a sign-out gets its own');
  eq(st.getItem('ssp.sqlAttemptDraft'), null, 'and nothing of the account that left');
}

{
  // Same profile again: nothing moves.
  const { ctx, st } = keys({ 'ssp.profileOwner': 'guest', anSrsState: 'x' });
  ok(ctx.profileKeysEnter('guest', st) === false, 'the same profile again does not swap');
  eq(st.getItem('anSrsState'), 'x', 'and leaves the values');
  ok(ctx.profileKeysEnter('', st) === false, 'nobody is not a profile');
}

{
  // Parking does not fit: nothing is cleared (seen by the next profile beats lost).
  const { ctx, st } = keys({ 'ssp.profileOwner': 'guest', 'ssp.practiceDrafts': '{"big":1}' });
  st.full = true;
  ok(ctx.profileKeysEnter('u:A', st) === false, 'a full store does not swap');
  eq(st.getItem('ssp.practiceDrafts'), '{"big":1}', 'and loses nothing');
  st.full = false;
}

{
  // Signing out of an account on an old device (no owner): the values are Guest's, so they stay.
  const { ctx, st } = keys({ npAttemptInProgress: 'g' });
  ctx.profileKeysDrop('u:A', st);
  eq(st.getItem('npAttemptInProgress'), 'g', 'an old device\'s values are not dropped by a sign-out');
}

{
  // Who is in the tab.
  const { run } = keys();
  eq(run('var storageMode = "local", currentFirebaseUser = null; profileCurrentId()'), 'guest', 'Guest');
  eq(run('storageMode = "online"; currentFirebaseUser = { uid: "x1" }; profileCurrentId()'), 'u:x1', 'an account');
  eq(run('storageMode = "online"; currentFirebaseUser = null; profileCurrentId()'), '', 'cloud mode with nobody signed in');
  eq(run('storageMode = null; profileCurrentId()'), '', 'nobody yet');
}

/* ── stickers.js ─────────────────────────────────────────── */

/** stickers.js in its own context: localStorage, a picture store, and the app's mode. */
function stickers(init, records) {
  const st = storage(init);
  const db = new Map((records || []).map(r => [r.id, JSON.parse(JSON.stringify(r))]));
  const bodyClasses = new Set();
  const ctx = {
    console, localStorage: st, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    setTimeout: () => 0, clearTimeout() {},
    URL: { createObjectURL: (b) => 'blob:' + (b && b.tag), revokeObjectURL() {} },
    document: {
      addEventListener() {},
      body: { classList: { contains: (c) => bodyClasses.has(c), add: (c) => bodyClasses.add(c), remove: (c) => bodyClasses.delete(c), toggle() {} }, dataset: { route: 'home' } },
      getElementById: (id) => (id === 'storage-mode-popup' ? { id } : null),
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    window: { addEventListener() {}, removeEventListener() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(JS('profile-keys.js') + '\n' + JS('stickers.js') +
    '\nvar storageMode = null, currentFirebaseUser = null, _appBooted = false;', ctx);
  // The picture store: IndexedDB stood in for by the two functions everything goes through.
  ctx._stkAllRecords = async () => Array.from(db.values()).map(r => JSON.parse(JSON.stringify(r)));
  ctx._stkWriteRecords = async (put, del) => {
    (put || []).forEach(r => db.set(r.id, JSON.parse(JSON.stringify(r))));
    (del || []).forEach(id => db.delete(id));
  };
  const run = (src) => vm.runInContext(src, ctx);
  return { ctx, st, db, run, bodyClasses };
}

const pic = (id, owners) => (owners === undefined ? { id, blob: { tag: id }, w: 10, h: 10 } : { id, blob: { tag: id }, w: 10, h: 10, owners });
const item = (id, img, route) => ({ id, img, route: route || 'home', host: 'page', sub: '', x: 0, y: 0, w: 10, h: 10 });
const list = (...items) => JSON.stringify({ v: 1, items });

(async () => {
  {
    // Whose stickers belong on screen.
    const { run, bodyClasses } = stickers();
    eq(run('_stkWho()'), '', 'nobody before the app has started');
    bodyClasses.add('picker-open');
    eq(run('_stkWho()'), 'device', 'the login page is the device\'s');
    bodyClasses.delete('picker-open');
    eq(run('_appBooted = true; storageMode = "local"; _stkWho()'), 'guest', 'Guest');
    eq(run('storageMode = "online"; currentFirebaseUser = { uid: "A" }; _stkWho()'), 'u:A', 'an account');
  }

  {
    // Each profile reads only its own list and its own pictures; a switch empties memory first.
    const { run } = stickers(
      { 'ssp.stickers@guest': list(item('g1', 'pg')), 'ssp.stickers@u:A': list(item('a1', 'pa'), item('a2', 'pa')) },
      [pic('pg', ['guest']), pic('pa', ['u:A'])]);
    run('_appBooted = true; storageMode = "local"; _stkEnsureProfile();');
    eq(run('_stkItems.map(s => s.id)'), ['g1'], 'Guest sees only Guest\'s stickers');
    await run('_stkLoadImages()');
    eq(run('Array.from(_stkImgs.keys())'), ['pg'], 'and only Guest\'s pictures');
    run('storageMode = "online"; currentFirebaseUser = { uid: "A" }; _stkEnsureProfile();');
    eq(run('_stkItems.map(s => s.id)'), ['a1', 'a2'], 'the account sees only its own');
    eq(run('_stkImgs.size'), 0, 'Guest\'s pictures left memory with the switch');
    await run('_stkLoadImages()');
    eq(run('Array.from(_stkImgs.keys())'), ['pa'], 'the account\'s pictures, none of Guest\'s');
    run('currentFirebaseUser = { uid: "B" }; _stkEnsureProfile();');
    eq(run('_stkItems.length'), 0, 'another account sees none of them');
    await run('_stkLoadImages()');
    eq(run('_stkImgs.size'), 0, 'nor their pictures');
  }

  {
    // A change still on its timer is written to the profile it was made in, not the next one.
    const { run, st } = stickers({ 'ssp.stickers@guest': list(item('g1', 'pg')) }, [pic('pg', ['guest'])]);
    run('_appBooted = true; storageMode = "local"; _stkEnsureProfile();');
    run('_stkItems[0].x = 99; _stkSaveTimer = 1;');
    run('storageMode = "online"; currentFirebaseUser = { uid: "A" }; _stkEnsureProfile();');
    eq(JSON.parse(st.getItem('ssp.stickers@guest')).items[0].x, 99, 'Guest\'s last move landed in Guest\'s list');
    eq(st.getItem('ssp.stickers@u:A'), null, 'and nothing in the account\'s');
    run('_stkSaveNow()');
    eq(JSON.parse(st.getItem('ssp.stickers@u:A')).items, [], 'the account saves its own (empty) list');
  }

  {
    // Nobody in: nothing to save into.
    const { run, st } = stickers();
    run('_stkEnsureProfile();');
    ok(run('_stkSaveNow()') === false, 'with nobody in, nothing is saved');
    eq(Object.keys(st.dump()).filter(k => /stickers/.test(k)), [], 'and no key written');
  }

  {
    // The one shared list from before: the login page's go to the device, the rest wait.
    const { run, st, db } = stickers(
      { 'ssp.stickers': list(item('p1', 'pl', 'picker'), item('h1', 'ph'), item('h2', 'pl')) },
      [pic('pl'), pic('ph'), pic('loose')]);
    await run('_stkLegacySplit()');
    eq(JSON.parse(st.getItem('ssp.stickers@device')).items.map(s => s.id), ['p1'], 'the login page\'s sticker went to the device');
    eq(db.get('pl').owners, ['device'], 'with its picture');
    eq(JSON.parse(st.getItem('ssp.stickers')).items.map(s => s.id), ['h1', 'h2'], 'the rest wait in the old list');
    ok(!db.get('ph').owners && !db.get('loose').owners, 'their pictures are still nobody\'s');
    await run('_stkLegacyCount()');
    eq(run('_stkLegacy'), { items: 2, pics: 2 }, 'two stickers and two pictures wait');
    await run('_stkLegacySplit()');
    eq(JSON.parse(st.getItem('ssp.stickers@device')).items.length, 1, 'sorting again adds nothing twice');

    // An account keeps them.
    run('_appBooted = true; storageMode = "online"; currentFirebaseUser = { uid: "A" }; _stkEnsureProfile();');
    await run('_stkLegacyClaim()');
    eq(JSON.parse(st.getItem('ssp.stickers@u:A')).items.map(s => s.id), ['h1', 'h2'], 'the account has them now');
    eq(st.getItem('ssp.stickers'), null, 'the old list is gone');
    eq(db.get('ph').owners, ['u:A'], 'an unowned picture they use is the account\'s');
    eq(db.get('loose').owners, ['u:A'], 'and so is an unowned one no sticker uses');
    eq(db.get('pl').owners, ['device', 'u:A'], 'a picture the login page also uses is shared, not taken');
    eq(run('_stkLegacy'), null, 'nothing waits any more');
    eq(run('Array.from(_stkImgs.keys()).sort()'), ['loose', 'ph', 'pl'], 'and the account\'s tray has their pictures');

    // Guest does not get them.
    run('storageMode = "local"; currentFirebaseUser = null; _stkEnsureProfile();');
    eq(run('_stkItems.length'), 0, 'Guest does not see the stickers the account kept');

    // The account removes the shared picture: the login page keeps it.
    run('storageMode = "online"; currentFirebaseUser = { uid: "A" }; _stkEnsureProfile();');
    await run('_stkDisown(["pl"], "u:A")');
    eq(db.get('pl').owners, ['device'], 'removing a shared picture leaves it for the other profile');
    await run('_stkDisown(["ph"], "u:A")');
    ok(!db.has('ph'), 'a picture nobody else uses is deleted');
  }

  {
    // Nobody keeps them: deleting takes only the unowned pictures.
    const { run, st, db } = stickers({ 'ssp.stickers': list(item('h1', 'ph')) }, [pic('ph'), pic('mine', ['guest'])]);
    await run('_stkLegacySplit()');
    await run('_stkLegacyCount()');
    run('_appBooted = true; storageMode = "local"; _stkEnsureProfile();');
    // The confirm is the app's dialog; here it answers yes at once.
    run('var showConfirm = (t, m, go) => { globalThis.__done = go(); };');
    run('_stkLegacyAskDrop()');
    await run('__done');
    eq(st.getItem('ssp.stickers'), null, 'the old list is deleted');
    ok(!db.has('ph') && db.has('mine'), 'with its unowned pictures, not Guest\'s own');
    eq(run('_stkLegacy'), null, 'and nothing waits');
  }

  {
    // Reset Data resets this profile's stickers only.
    const { run, st, db } = stickers(
      { 'ssp.stickers@guest': list(item('g1', 'both')), 'ssp.stickers@u:A': list(item('a1', 'both'), item('a2', 'onlyA')) },
      [pic('both', ['guest', 'u:A']), pic('onlyA', ['u:A'])]);
    run('_appBooted = true; storageMode = "online"; currentFirebaseUser = { uid: "A" }; _stkEnsureProfile();');
    await run('stkResetAll()');
    eq(st.getItem('ssp.stickers@u:A'), null, 'the account\'s placements are gone');
    ok(st.getItem('ssp.stickers@guest') !== null, 'Guest\'s are not');
    eq(db.get('both').owners, ['guest'], 'a picture Guest also uses stays for Guest');
    ok(!db.has('onlyA'), 'one only the account used is deleted');
  }

  console.log((failed ? 'FAILED ' + failed + ', ' : '') + passed + ' passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

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

  /* ── Reset Data (io.js) empties the profile in the tab, no other ── */

  // Every profile's saves on one device: Guest's plain keys and the account's *_online copy.
  const DEVICE = () => ({
    codePlatformData: 'G-lib', vizCanvasData: 'G-viz', brainCanvasData: 'G-brain', cheatsheetLibrary: 'G-cheats',
    questBoardData_v3: 'G-quest', questBoardData_v2: 'G-quest2', questBoardData: 'G-quest1',
    codePlatformData_online: 'A-lib', vizCanvasData_online: 'A-viz', brainCanvasData_online: 'A-brain',
    questBoardData_online: 'A-quest', cheatsheetLibrary_online: 'A-cheats',
    'ssp.onlineOwner': 'A', 'ssp.cloudCopy': '{"v":1,"uid":"A","stamp":1,"clean":true}',
    'ssp.profile.guest': '{"anSrsState":"g"}', theme: 'dark'
  });
  const GUEST_KEYS = ['codePlatformData', 'vizCanvasData', 'brainCanvasData', 'cheatsheetLibrary',
    'questBoardData_v3', 'questBoardData_v2', 'questBoardData', 'ssp.profile.guest'];
  const ACCOUNT_KEYS = ['codePlatformData_online', 'vizCanvasData_online', 'brainCanvasData_online',
    'questBoardData_online', 'cheatsheetLibrary_online', 'ssp.onlineOwner', 'ssp.cloudCopy'];

  /** Web Storage as the browser has it: Object.keys lists the stored keys. */
  function webStorage(init) {
    const proto = {
      getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; },
      setItem(k, v) { this[k] = String(v); },
      removeItem(k) { delete this[k]; },
      clear() { Object.keys(this).forEach(k => { delete this[k]; }); },
      key(i) { const k = Object.keys(this)[i]; return k === undefined ? null : k; }
    };
    Object.defineProperty(proto, 'length', { get() { return Object.keys(this).length; } });
    return Object.assign(Object.create(proto), init || {});
  }

  /** io.js's handleDataReset with both confirms answered yes. `cloudMs`: how long the cloud save takes. */
  async function reset(o) {
    const ls = webStorage(DEVICE());
    const ss = webStorage(o.tabMode ? { storageMode: o.tabMode } : {});
    const log = [];
    const ctx = {
      console: { log: console.log, error: console.error, warn() {} },
      Promise, localStorage: ls, sessionStorage: ss,
      // The reset's own waits, a thousand times shorter.
      setTimeout: (fn, ms) => setTimeout(fn, (ms || 0) / 1000),
      window: { location: { reload: () => log.push('reload'), hash: '' } },
      storageMode: o.mode, currentFirebaseUser: o.uid ? { uid: o.uid } : null,
      state: { challenges: ['mine'] },
      viz: { nodes: ['n'] }, brain: { versions: ['v'] }, questState: { quests: ['q'] }, cs: { sheets: ['s'] },
      showConfirm: (t, m, go) => go(),
      showMessage: (t) => log.push('message:' + t),
      buildDefaultSeed: () => ({ nodes: [], challenges: [], snippets: [], notebooks: [], expandedNodes: [],
        categoryRequirements: {}, snippetProgress: {}, badges: [], notebookHistory: [], history: [], activeAttempts: {}, review: {} }),
      trainFieldsReset() {},
      saveData: () => log.push('saveData'),
      _flushSaveData: () => log.push('flush'),
      stkResetAll: () => log.push('stickers'),
      // Stands in for firebase-auth.js's: empties what the profile has in memory.
      _flushAllInMemoryDomains() { ctx.viz.nodes = []; ctx.brain.versions = []; ctx.questState.quests = []; ctx.cs.sheets = []; },
      saveToFirestore(uid) {
        log.push('cloud:' + uid + ' ' + [ctx.viz.nodes, ctx.brain.versions, ctx.questState.quests, ctx.cs.sheets].map(a => a.length).join(''));
        return new Promise(r => setTimeout(() => { log.push('cloud saved'); r(true); }, o.cloudMs || 0));
      },
      // What the picture clean-up sees: a picture is kept while any save on the device names it.
      mediaGc: () => { log.push('media sees ' + Object.keys(ls).filter(k => /^vizCanvasData/.test(k)).sort().join(',')); return Promise.resolve(); }
    };
    vm.createContext(ctx);
    vm.runInContext(JS('constants.js'), ctx);
    vm.runInContext(JS('io.js'), ctx);
    vm.runInContext('handleDataReset()', ctx);
    for (let i = 0; i < 100 && !log.includes('reload') && !log.some(l => l.startsWith('message:')); i++) await new Promise(r => setTimeout(r, 5));
    await new Promise(r => setTimeout(r, 30));
    return { ls, ss, log, ctx };
  }

  {
    // A cloud account resets: Guest's library, canvas, brain, quests and sheets are not its to delete.
    const { ls, ss, log } = await reset({ mode: 'online', tabMode: 'online', uid: 'A', cloudMs: 5 });
    const dev = DEVICE();
    GUEST_KEYS.forEach(k => eq(ls.getItem(k), dev[k], 'an account\'s reset leaves Guest\'s ' + k));
    ['vizCanvasData_online', 'brainCanvasData_online', 'questBoardData_online', 'cheatsheetLibrary_online']
      .forEach(k => eq(ls.getItem(k), null, 'the account\'s ' + k + ' is reset'));
    ok(log.includes('cloud:A 0000'), 'the cloud gets the empty canvas, brain, quests and sheets, not the old ones in memory');
    ok(log.includes('media sees vizCanvasData'), 'the picture clean-up still sees Guest\'s canvas, so Guest\'s pictures stay');
    ok(log.indexOf('cloud saved') !== -1 && log.indexOf('cloud saved') < log.indexOf('reload'), 'the reload waits for the cloud save');
    eq(ss.getItem('storageMode'), 'online', 'the tab stays in the account');
  }

  {
    // Guest resets: the account's device copy is not Guest's, and ssp.cloudCopy still vouches for it.
    const { ls, log } = await reset({ mode: 'local', tabMode: 'local' });
    const dev = DEVICE();
    ACCOUNT_KEYS.forEach(k => eq(ls.getItem(k), dev[k], 'Guest\'s reset leaves the account\'s ' + k));
    ['vizCanvasData', 'brainCanvasData', 'cheatsheetLibrary', 'questBoardData_v3', 'questBoardData_v2', 'questBoardData']
      .forEach(k => eq(ls.getItem(k), null, 'Guest\'s ' + k + ' is reset'));
    ok(!log.some(l => l.startsWith('cloud:')), 'Guest\'s reset sends nothing to any cloud');
    ok(log.includes('reload'), 'and reloads');
  }

  {
    // A tab whose saved mode disagrees with the mode it runs in would reset the wrong profile's keys: it resets nothing.
    const { ls, log } = await reset({ mode: 'online', tabMode: null, uid: 'A' });
    const dev = DEVICE();
    eq(Object.keys(ls).sort(), Object.keys(dev).sort(), 'no key is removed');
    GUEST_KEYS.concat(ACCOUNT_KEYS).forEach(k => eq(ls.getItem(k), dev[k], 'nor changed: ' + k));
    ok(!log.includes('saveData') && !log.includes('reload'), 'nothing is saved or reloaded');
    ok(log.some(l => l.startsWith('message:')), 'and the person is told');
  }

  {
    // An account with no quest board of its own never opens Guest's from before v3.
    const src = JS('quest-board.js').match(/function loadQuestData\(\) \{[\s\S]*?\n\}\n/)[0];
    const quests = (mode, init) => {
      const ctx = { console: { log() {}, error() {}, warn() {} }, localStorage: webStorage(init), sessionStorage: webStorage({ storageMode: mode }),
        questState: { quests: [], player: {} }, migrateQuest: q => q, checkDailyReset() {} };
      vm.createContext(ctx);
      vm.runInContext(JS('constants.js') + '\n' + src + '\nloadQuestData();', ctx);
      return ctx.questState.quests;
    };
    const old = { questBoardData_v2: '{"quests":["guest"]}' };
    eq(quests('online', old), [], 'an account does not get Guest\'s old board');
    eq(quests('local', old), ['guest'], 'Guest still does');
    eq(quests('online', Object.assign({ questBoardData_online: '{"quests":["a"]}' }, old)), ['a'], 'an account gets its own');
  }

  console.log((failed ? 'FAILED ' + failed + ', ' : '') + passed + ' passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

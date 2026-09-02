/* ============================================================
   CODING-STARTER.JS — the starter pack, and the switch between it
   and your own library
   ------------------------------------------------------------
   ONE LIBRARY IS LIVE AT A TIME. That is the whole point: the two must not
   mix, and the surest way to guarantee that is for the other one not to be
   there. Turning the switch parks whatever is live in state.codingStash and
   puts the other set in its place, so `state.challenges` always means "what is
   on screen" and every part of the app that reads it — the tree, the cards,
   the stats, search, practice — keeps working with no idea any of this
   happened.

   The alternative was to tag every program with an owner and filter on read,
   which would have meant touching every one of those places and leaving a
   permanent chance that one of them forgot to filter. A program that leaks
   into the wrong library is exactly the failure being designed out.

   ONLY THE CHALLENGE SCOPE MOVES. state.nodes holds folders for the snippet
   and notebook libraries and every wing as well, so the swap takes the
   challenge-scoped folders and puts the rest back untouched.

   HISTORY IS NOT SWAPPED. Attempts stay keyed by program id, so practising a
   starter program logs against a starter id and your own stats are counted
   against your own programs — countCompletedPrograms() already filters history
   through the live challenge list, so each side reports its own progress.
   ============================================================ */

const CODING_MODE_KEY = 'codingMode';   // on state, so it travels with the data

function codingLibraryMode() {
  return (typeof state !== 'undefined' && state.codingMode === 'starter') ? 'starter' : 'mine';
}

function codingLibraryIsStarter() { return codingLibraryMode() === 'starter'; }

/* ── The pack ─────────────────────────────────────────────────
   Nine programs over three folders, ordered the way the ideas build: print
   something, then read something, then decide, then repeat.

   Fixed ids, not generated ones. The pack is rebuilt from this file the first
   time it is switched on, and stable ids mean a rebuild lands on the same
   programs your history already refers to.
   ------------------------------------------------------------ */


/**
 * One program, with the boilerplate every one of them repeats.
 *
 * TWO FIELDS THAT ARE NOT THE SAME THING, and getting them the wrong way round
 * is what broke the boss bar. `starterCode` is what the editor opens with;
 * `code` is the finished program the bar measures your distance from and Check
 * Code grades against. This pack shipped with the same empty main() in both,
 * so the editor matched the target exactly on load and the bar arrived at zero
 * HP before a key was pressed.
 *
 * So: nothing to start with, and the reference is the real answer. Every one
 * of them lives in coding-starter-solutions.js, compiled and run against its
 * own tests before being put there.
 */
function _csProgram(id, folder, title, description, samples, tests) {
  const solution = (typeof CS_SOLUTIONS !== 'undefined' && CS_SOLUTIONS[id]) || '';
  return {
    id: 'starter-' + id,
    title: title,
    parentId: 'starter-folder-' + folder,
    description: description,
    createdAt: 1700000000000,        // fixed, so the pack does not reorder itself
    variants: [{
      id: 'starter-' + id + '-v1',
      name: 'C',
      description: '',
      starterCode: '',
      code: solution,
      activeFileIndex: 0,
      files: [{ id: 'starter-' + id + '-f1', name: 'main', ext: '.c',
                starterCode: '', code: solution }],
      samples: samples || [],
      tests: tests || [],
      minRequirements: []
    }]
  };
}

/* ── Keeping an installed pack current ───────────────────────
   The pack is generated fresh every time it is switched on, but once it is
   installed it becomes ordinary library data and stops tracking this file.
   Adding a folder here would never reach anyone who already had the pack --
   which is the whole problem the update below exists to solve.

   The hard part is not adding what is missing; it is knowing what NOT to
   touch. The banner promises that anything you change in the pack stays, so
   an update that overwrote everything would be a data loss dressed as a
   feature. So each program is stamped with a fingerprint of its own content
   when it ships. On update, a program whose fingerprint still matches its
   content has not been touched since it arrived and can be refreshed; one
   that no longer matches has been edited, and is left exactly as it is.

   PROGRESS IS SAFE either way. History is keyed by challenge id and lives in
   state.history, not on the challenge, so replacing the object by id keeps
   every attempt, score and streak attached to it. */

/** A cheap, stable hash of the fields the pack owns. */
function _csFingerprint(ch) {
  const v = (ch.variants && ch.variants[0]) || {};
  const parts = [
    ch.title || '', ch.description || '', ch.parentId || '',
    JSON.stringify(v.samples || []),
    JSON.stringify(v.tests || []),
    JSON.stringify((v.files || []).map(f => [f.name, f.ext, f.starterCode || '', f.code || ''])),
    v.code || ''
  ].join('\u0001');
  // djb2. Not a checksum against tampering -- just a same-or-different test.
  let h = 5381;
  for (let i = 0; i < parts.length; i++) h = ((h * 33) ^ parts.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function _csStamp(pack) {
  (pack.challenges || []).forEach(c => { c.packFp = _csFingerprint(c); });
  return pack;
}

/**
 * Merge the pack as it is written now into the pack as it was installed.
 *
 * Works whichever library is on screen: in starter mode it updates what you
 * are looking at, otherwise it updates the parked copy so the new material is
 * there the next time you switch over.
 */
function updateCodingStarterPack() {
  const inStarter = codingLibraryIsStarter();
  const target = inStarter ? _csLift() : (state.codingStash || null);
  if (!target || !(target.challenges || []).some(c => String(c.id).indexOf('starter-') === 0)) {
    if (typeof toast === 'function') {
      toast('No starter pack installed yet — switch it on and it arrives complete.',
            { type: 'info', duration: 4000 });
    }
    return;
  }

  const fresh = _csStamp(codingStarterPack());
  const haveNode = new Set((target.nodes || []).map(n => n.id));
  const byId = {};
  (target.challenges || []).forEach(c => { byId[c.id] = c; });

  let folders = 0, added = 0, refreshed = 0, kept = 0;

  fresh.nodes.forEach(n => {
    if (!haveNode.has(n.id)) { target.nodes.push(n); haveNode.add(n.id); folders++; }
  });

  fresh.challenges.forEach(f => {
    const have = byId[f.id];
    if (!have) { target.challenges.push(f); added++; return; }
    /* No stamp means it predates this mechanism. Those were installed before
       anything could edit them through the pack UI, so treat them as
       untouched rather than freezing them out of every future update. */
    const untouched = !have.packFp || have.packFp === _csFingerprint(have);
    if (!untouched) { kept++; return; }
    target.challenges[target.challenges.indexOf(have)] = f;
    refreshed++;
  });

  if (inStarter) _csPlace(target); else state.codingStash = target;
  saveData();

  if (typeof invalidateBrowseCache === 'function') invalidateBrowseCache();
  if (typeof renderBrowse === 'function') renderBrowse();
  _csSyncBtn();

  if (typeof toast === 'function') {
    if (!folders && !added && !refreshed) {
      toast(kept ? 'Already up to date. ' + kept + ' program' + (kept === 1 ? '' : 's') + ' you edited were left alone.'
                 : 'Already up to date.', { type: 'success', duration: 3200 });
    } else {
      const bits = [];
      if (added) bits.push(added + ' new program' + (added === 1 ? '' : 's'));
      if (folders) bits.push(folders + ' new folder' + (folders === 1 ? '' : 's'));
      if (refreshed) bits.push(refreshed + ' updated');
      if (kept) bits.push(kept + ' of yours kept');
      toast(bits.join(', ') + '.' + (inStarter ? '' : ' Switch to the pack to see them.'),
            { type: 'success', duration: 4500 });
    }
  }
}

function codingStarterPack() {
  const nodes = [
    { id: 'starter-folder-1', type: 'folder', name: '1 · Printing and reading', parentId: null, scope: 'challenge', order: 0 },
    { id: 'starter-folder-2', type: 'folder', name: '2 · Making decisions',     parentId: null, scope: 'challenge', order: 1 },
    { id: 'starter-folder-3', type: 'folder', name: '3 · Repeating work',       parentId: null, scope: 'challenge', order: 2 }
  ];

  const challenges = [
    _csProgram('hello', 1, 'Say hello',
      'Print the line <code>Hello, World!</code> and nothing else. Mind the comma and the exclamation mark — the checker compares your output exactly.',
      [{ title: 'Sample 1', content: 'Output:\nHello, World!' }],
      [{ name: 'prints the greeting', stdin: '', expected: 'Hello, World!' }]),

    _csProgram('echo-number', 1, 'Read a number back',
      'Read one whole number from the user and print it on its own line. This is the smallest program that has an input: get <code>scanf</code> working here and the rest of the pack is mostly variations on it.',
      [{ title: 'Sample 1', content: 'Input:\n7\nOutput:\n7' }],
      [{ name: 'echoes 7', stdin: '7\n', expected: '7' },
       { name: 'echoes a negative', stdin: '-40\n', expected: '-40' }]),

    _csProgram('add-two', 1, 'Add two numbers',
      'Read two whole numbers and print their sum on one line. Nothing else — no labels, no spaces around it.',
      [{ title: 'Sample 1', content: 'Input:\n3 4\nOutput:\n7' }],
      [{ name: 'three and four', stdin: '3 4\n', expected: '7' },
       { name: 'crossing zero', stdin: '-9 4\n', expected: '-5' }]),

    _csProgram('odd-even', 2, 'Odd or even',
      'Read a whole number. Print <code>Even</code> if it divides by two exactly, otherwise print <code>Odd</code>. Remember that zero is even.',
      [{ title: 'Sample 1', content: 'Input:\n10\nOutput:\nEven' },
       { title: 'Sample 2', content: 'Input:\n7\nOutput:\nOdd' }],
      [{ name: 'ten is even', stdin: '10\n', expected: 'Even' },
       { name: 'seven is odd', stdin: '7\n', expected: 'Odd' },
       { name: 'zero is even', stdin: '0\n', expected: 'Even' },
       { name: 'negatives too', stdin: '-3\n', expected: 'Odd' }]),

    _csProgram('largest', 2, 'The largest of three',
      'Read three whole numbers and print the largest of them. If two are tied for largest, that value is still the answer.',
      [{ title: 'Sample 1', content: 'Input:\n4 9 2\nOutput:\n9' }],
      [{ name: 'middle one wins', stdin: '4 9 2\n', expected: '9' },
       { name: 'last one wins', stdin: '1 2 3\n', expected: '3' },
       { name: 'a tie', stdin: '5 5 1\n', expected: '5' },
       { name: 'all negative', stdin: '-7 -2 -9\n', expected: '-2' }]),

    _csProgram('grade', 2, 'Turn a score into a grade',
      'Read a score from 0 to 100 and print one letter:<br>'
      + '90 and above <code>A</code>, 80 to 89 <code>B</code>, 70 to 79 <code>C</code>, '
      + '60 to 69 <code>D</code>, below 60 <code>F</code>.<br>'
      + 'The boundaries are where this one goes wrong, so test 90, 80, 70 and 60 yourself before checking.',
      [{ title: 'Sample 1', content: 'Input:\n83\nOutput:\nB' }],
      [{ name: 'a clear B', stdin: '83\n', expected: 'B' },
       { name: 'exactly 90', stdin: '90\n', expected: 'A' },
       { name: 'exactly 60', stdin: '60\n', expected: 'D' },
       { name: 'just under', stdin: '59\n', expected: 'F' },
       { name: 'full marks', stdin: '100\n', expected: 'A' }]),

    _csProgram('countdown', 3, 'Count down',
      'Read a whole number <code>n</code> and print every number from <code>n</code> down to 1, one per line. If <code>n</code> is below 1, print nothing at all.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n5\n4\n3\n2\n1' }],
      [{ name: 'from five', stdin: '5\n', expected: '5\n4\n3\n2\n1' },
       { name: 'from one', stdin: '1\n', expected: '1' },
       { name: 'nothing to count', stdin: '0\n', expected: '' }]),

    _csProgram('sum-to-n', 3, 'Add up to n',
      'Read a whole number <code>n</code> and print the total of every number from 1 to <code>n</code>. For 5 that is 1+2+3+4+5, so 15. If <code>n</code> is below 1, the total is 0.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n15' }],
      [{ name: 'up to five', stdin: '5\n', expected: '15' },
       { name: 'up to one', stdin: '1\n', expected: '1' },
       { name: 'nothing to add', stdin: '0\n', expected: '0' },
       { name: 'a bigger one', stdin: '100\n', expected: '5050' }]),

    _csProgram('times-table', 3, 'A times table',
      'Read a whole number <code>n</code> and print its table from 1 to 10, one line each, in the form <code>n x i = product</code> — for example <code>3 x 4 = 12</code>. Use a lower-case x with a space either side.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\n3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15\n3 x 6 = 18\n3 x 7 = 21\n3 x 8 = 24\n3 x 9 = 27\n3 x 10 = 30' }],
      [{ name: 'the three times table', stdin: '3\n',
         expected: '3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15\n3 x 6 = 18\n3 x 7 = 21\n3 x 8 = 24\n3 x 9 = 27\n3 x 10 = 30' },
       { name: 'zero all the way down', stdin: '0\n',
         expected: '0 x 1 = 0\n0 x 2 = 0\n0 x 3 = 0\n0 x 4 = 0\n0 x 5 = 0\n0 x 6 = 0\n0 x 7 = 0\n0 x 8 = 0\n0 x 9 = 0\n0 x 10 = 0' }])
  ];

  /* The second half lives in its own file: arrays, pointers, memory and the
     bag. Kept apart because that half is a course of its own and this one is
     the warm-up before it. */
  let allCh = challenges, allNodes = nodes;
  if (typeof codingStarterFundamentals === 'function') {
    const more = codingStarterFundamentals();
    allCh = allCh.concat(more.challenges);
    allNodes = allNodes.concat(more.nodes);
  }
  /* The list ADT coursework, which is the one part of the pack that ships with
     starter code -- see coding-starter-lists.js for why. */
  if (typeof codingStarterLists === 'function') {
    const lists = codingStarterLists();
    allCh = allCh.concat(lists.challenges);
    allNodes = allNodes.concat(lists.nodes);
  }
  return _csStamp({ challenges: allCh, nodes: allNodes, sets: [] });
}

/* ── The switch ───────────────────────────────────────────── */

/** Everything the coding library owns, lifted out of state. */
function _csLift() {
  return {
    challenges: (state.challenges || []).slice(),
    sets: (state.codingSets || []).slice(),
    nodes: (state.nodes || []).filter(n => n.scope === 'challenge')
  };
}

/** Put a lifted set back, leaving every other scope's folders alone. */
function _csPlace(set) {
  const others = (state.nodes || []).filter(n => n.scope !== 'challenge');
  state.challenges = (set && set.challenges) || [];
  state.codingSets = (set && set.sets) || [];
  state.nodes = others.concat((set && set.nodes) || []);
}

function toggleCodingLibraryMode() {
  const to = codingLibraryIsStarter() ? 'mine' : 'starter';
  const parked = state.codingStash || null;

  /* Refuse rather than guess. Going back to your own library with nothing
     parked would replace the starter pack with an empty library and look
     exactly like your programs had been deleted. */
  if (to === 'mine' && !parked) {
    if (typeof toast === 'function') {
      toast('Cannot find your library to switch back to. Nothing was changed.', { type: 'error', duration: 5000 });
    }
    return;
  }

  const live = _csLift();
  _csPlace(to === 'starter' ? (parked || codingStarterPack()) : parked);
  state.codingStash = live;
  state.codingMode = to;
  saveData();

  /* The selection refers to ids from the library that just left. */
  if (typeof clearSessionParam === 'function') {
    clearSessionParam('browseActiveNode');
    clearSessionParam('browseActiveProgram');
    clearSessionParam('browseActiveSet');
  }
  if (typeof browseActiveNodeId !== 'undefined') browseActiveNodeId = null;
  if (typeof browseActiveProgramId !== 'undefined') browseActiveProgramId = null;
  if (typeof browseActiveSetId !== 'undefined') browseActiveSetId = null;

  if (typeof invalidateBrowseCache === 'function') invalidateBrowseCache();
  if (typeof renderBrowse === 'function') renderBrowse();
  const banner = document.getElementById('browse-starter-banner');
  if (banner) {
    banner.innerHTML = codingStarterBannerTemplate();
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: banner });
  }
  _csSyncBtn();

  if (typeof toast === 'function') {
    toast(to === 'starter'
      ? 'Showing the starter pack. Your own programs are put aside, not deleted.'
      : 'Back to your own programs.',
      { type: 'info', duration: 3200 });
  }
}

function _csSyncBtn() {
  const btn = document.getElementById('browse-starter-btn');
  if (!btn) return;
  const on = codingLibraryIsStarter();
  const label = on ? 'Showing the starter pack — switch back to your programs'
                   : 'Showing your programs — switch to the starter pack';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('is-on', on);
  btn.innerHTML = '<i data-lucide="' + (on ? 'package-open' : 'package') + '"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
}

function codingStarterButtonTemplate() {
  const on = codingLibraryIsStarter();
  const label = on ? 'Showing the starter pack — switch back to your programs'
                   : 'Showing your programs — switch to the starter pack';
  return '<button class="tutorial-trigger-btn' + (on ? ' is-on' : '') + '" id="browse-starter-btn"'
       + ' onclick="toggleCodingLibraryMode()" title="' + label + '"'
       + ' aria-label="' + label + '" aria-pressed="' + on + '">'
       + '<i data-lucide="' + (on ? 'package-open' : 'package') + '"></i></button>';
}

/** A standing reminder of which library is on screen. */
function codingStarterBannerTemplate() {
  if (!codingLibraryIsStarter()) return '';
  return '<div class="cs-banner" role="status">'
       + '<i data-lucide="package-open"></i>'
       + '<span><strong>Starter pack.</strong> Your own programs are put aside and come back when you switch off. '
       + 'Anything you add or change here stays in the pack.</span>'
       + '<button type="button" class="cs-update-btn" onclick="updateCodingStarterPack()"'
       + ' title="Add anything new and refresh what you have not edited">'
       + '<i data-lucide="refresh-cw"></i> Update</button>'
       + '</div>';
}

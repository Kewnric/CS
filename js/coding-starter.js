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
/**
 * One pack program.
 *
 * @param reqs  minimum-requirement types (see MIN_REQ_DEFS in utils.js). These
 *   are what make a task about the TECHNIQUE rather than about the output: a
 *   program that asks for recursion fails an iterative answer even when every
 *   test passes. Left empty on the early folders, where any working solution
 *   is the right one.
 */
/* Requirements for the first eight folders, as a table rather than a seventh
   argument on twenty-two call sites. Deliberately modest: these folders teach
   one idea each, and a requirement should name the idea the exercise is FOR,
   not every construct that happens to appear in the reference. Anything
   claimed here is checked against that reference by tools/verify-pack.js. */
const CS_REQS = {
  'hello':        ['printf'],
  'echo-number':  ['scanf', 'printf'],
  'add-two':      ['scanf', 'printf'],

  'odd-even':     ['ifelse'],
  'largest':      ['if'],
  'grade':        ['ifelse'],

  'countdown':    ['loop'],
  'sum-to-n':     ['loop'],
  'times-table':  ['loop'],

  'arr-sum':      ['function', 'array', 'loop'],
  'arr-largest':  ['function', 'array', 'loop'],
  'arr-sentinel': ['function', 'array', 'loop'],

  'ptr-swap':     ['function', 'pointer'],
  'ptr-reverse':  ['pointer', 'loop'],
  'ptr-minmax':   ['function', 'pointer'],

  'mem-fill':     ['pointer', 'loop'],
  'mem-return':   ['function', 'pointer'],
  'mem-multiples':['function', 'pointer', 'loop'],
  'mem-pairs':    ['function', 'pointer', 'loop'],

  'struct-one':   ['scanf', 'printf'],
  'struct-team':  ['array', 'loop'],
  'poke-bag':     ['array', 'loop']
};

function _csProgram(id, folder, title, description, samples, tests, reqs) {
  reqs = reqs || CS_REQS[id] || [];
  const solution = (typeof CS_SOLUTIONS !== 'undefined' && CS_SOLUTIONS[id])
                || (typeof CS_ADV_SOLUTIONS !== 'undefined' && CS_ADV_SOLUTIONS[id])
                || (typeof CS_CORE_SOLUTIONS !== 'undefined' && CS_CORE_SOLUTIONS[id])
                || (typeof CS_PTR_SOLUTIONS !== 'undefined' && CS_PTR_SOLUTIONS[id])
                || (typeof CS_ARR_SOLUTIONS !== 'undefined' && CS_ARR_SOLUTIONS[id])
                || (typeof CS_LOOP_SOLUTIONS !== 'undefined' && CS_LOOP_SOLUTIONS[id])
                || '';
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
      minRequirements: (reqs || []).map(t => ({ id: 'starter-' + id + '-req-' + t, type: t }))
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
  if (!target || !(target.challenges || []).some(_csIsPackId)) {
    if (typeof toast === 'function') {
      toast('No starter pack installed yet — switch it on and it arrives complete.',
            { type: 'info', duration: 4000 });
    }
    return;
  }

  /* REFUSE A TARGET THAT IS NOT THE PACK.
     The old test was "does this contain at least one starter- id", which is
     true of a library of your own that has a single starter program in it for
     any reason -- an import, a shared link, or an earlier swap. Merging then
     pushed all 43 programs and 12 folders of the pack into your own library:
     reproduced, 3 programs became 45.

     The pack's invariant is that everything in it is the pack's. Anything else
     in there means we are pointed at the wrong library, and the answer to that
     is to stop, not to merge. */
  const foreign = (target.challenges || []).filter(c => !_csIsPackId(c));
  if (foreign.length) {
    if (typeof toast === 'function') {
      toast('Stopped: that library has ' + foreign.length + ' program' + (foreign.length === 1 ? '' : 's')
            + ' of your own in it, so it is not the starter pack. Nothing was changed — use Repair to separate them.',
            { type: 'error', duration: 8000 });
    }
    return;
  }

  const fresh = _csStamp(codingStarterPack());
  const haveNode = new Set((target.nodes || []).map(n => n.id));
  const byId = {};
  (target.challenges || []).forEach(c => { byId[c.id] = c; });

  let folders = 0, added = 0, refreshed = 0, kept = 0, sets = 0, restructured = 0, rehomed = 0;

  /* FOLDERS ARE REFRESHED, NOT JUST ADDED. This used to push a folder only
     when its id was new, which meant the pack could never reorganise itself:
     a library installed once kept the first layout for ever, and a rename or
     a re-parent in the pack simply never arrived. The visible result was the
     old flat folders sitting beside the new ones, teaching the same topics
     twice.

     Only the three properties the pack owns are written -- what it is called,
     where it sits and what order it comes in. Nothing about the programs
     inside is touched. */
  const nodeById = {};
  (target.nodes || []).forEach(n => { nodeById[n.id] = n; });
  fresh.nodes.forEach(n => {
    const have = nodeById[n.id];
    if (!have) { target.nodes.push(n); haveNode.add(n.id); nodeById[n.id] = n; folders++; return; }
    const moved = have.name !== n.name
               || (have.parentId || null) !== (n.parentId || null)
               || have.order !== n.order;
    if (!moved) return;
    have.name = n.name;
    have.parentId = n.parentId;
    have.order = n.order;
    restructured++;
  });

  /* A program whose folder no longer exists lands in Uncategorized, where it
     is invisible in the course it belongs to. Pack programs know where they
     go, so put back any that drifted -- including ones you have edited, since
     moving a program is not the same as overwriting it. */
  const freshParent = {};
  fresh.challenges.forEach(f => { freshParent[f.id] = f.parentId; });

  fresh.challenges.forEach(f => {
    const have = byId[f.id];
    if (!have) { target.challenges.push(f); added++; return; }
    /* No stamp means it predates this mechanism. Those were installed before
       anything could edit them through the pack UI, so treat them as
       untouched rather than freezing them out of every future update. */
    const untouched = !have.packFp || have.packFp === _csFingerprint(have);
    if (!untouched) {
      // Yours to keep -- but it still belongs in the folder the pack gives it.
      if (freshParent[f.id] && have.parentId !== freshParent[f.id]) {
        have.parentId = freshParent[f.id];
        rehomed++;
      }
      kept++;
      return;
    }
    target.challenges[target.challenges.indexOf(have)] = f;
    refreshed++;
  });

  /* Sets too. They were missed the first time round, which meant an existing
     pack could gain every new folder and still have no exams in it -- the
     merge walked nodes and challenges and simply never looked at this list.
     Matched by id like the rest; a set you have edited keeps your version. */
  target.sets = target.sets || [];
  (fresh.sets || []).forEach(fs => {
    const have = target.sets.find(s => s.id === fs.id);
    if (!have) { target.sets.push(fs); sets++; return; }
    /* A pack set is a list of pointers into the library, so refreshing one is
       safe unless the problem list itself was changed. */
    if (JSON.stringify(have.problems || []) === JSON.stringify(fs.problems || [])) return;
    if (have.userEdited) { kept++; return; }
    target.sets[target.sets.indexOf(have)] = fs;
    sets++;
  });

  if (inStarter) _csPlace(target); else state.codingStash = target;
  saveData();

  if (typeof invalidateBrowseCache === 'function') invalidateBrowseCache();
  if (typeof renderBrowse === 'function') renderBrowse();
  _csSyncBtn();

  if (typeof toast === 'function') {
    if (!folders && !added && !refreshed && !sets && !restructured && !rehomed) {
      toast(kept ? 'Already up to date. ' + kept + ' program' + (kept === 1 ? '' : 's') + ' you edited were left alone.'
                 : 'Already up to date.', { type: 'success', duration: 3200 });
    } else {
      const bits = [];
      if (added) bits.push(added + ' new program' + (added === 1 ? '' : 's'));
      if (restructured) bits.push(restructured + ' folder' + (restructured === 1 ? '' : 's') + ' reorganised');
      if (rehomed) bits.push(rehomed + ' moved into place');
      if (folders) bits.push(folders + ' new folder' + (folders === 1 ? '' : 's'));
      if (sets) bits.push(sets + ' practice set' + (sets === 1 ? '' : 's'));
      if (refreshed) bits.push(refreshed + ' updated');
      if (kept) bits.push(kept + ' of yours kept');
      toast(bits.join(', ') + '.' + (inStarter ? '' : ' Switch to the pack to see them.'),
            { type: 'success', duration: 4500 });
    }
  }
}

function codingStarterPack() {
  const nodes = [
    { id: 'starter-folder-1', type: 'folder', name: 'E · First whole programs', parentId: 'starter-folder-core', scope: 'challenge', order: 4 },
    { id: 'starter-folder-2', type: 'folder', name: '1 · Making choices',       parentId: null, scope: 'challenge', order: -9 },
    { id: 'starter-folder-3', type: 'folder', name: 'C · Harder',               parentId: 'starter-folder-lp', scope: 'challenge', order: 2 }
  ];

  const challenges = [
    _csProgram('hello', 1, 'Say hello',
      'Print the line <code>Hello, World!</code> and nothing else. Mind the comma and the exclamation mark \u2014 the checker compares your output exactly.',
      [{ title: 'Sample 1', content: 'Output:\nHello, World!' }],
      [{ name: 'prints the greeting', stdin: '', expected: 'Hello, World!' }]),

    _csProgram('echo-number', 1, 'Read a number back',
      'Ask for one whole number and print it back, labelled.<br><br>'
      + 'Prompt with exactly <code>Enter a number: </code> (with the trailing space, no newline), then print '
      + '<code>Your number is: N</code>.<br><br>'
      + 'The prompt is part of your output, so it is part of what is compared \u2014 typing it in is not enough, '
      + 'it has to be printed. Notice in the sample that the Output already contains the prompt: what you '
      + 'type never appears in your program\'s output, only what you print does.',
      [{ title: 'Sample 1', content: 'Input:\n7\nOutput:\nEnter a number: Your number is: 7' }],
      [{ name: 'echoes 7', stdin: '7\n', expected: 'Enter a number: Your number is: 7' },
       { name: 'echoes a negative', stdin: '-40\n', expected: 'Enter a number: Your number is: -40' }]),

    _csProgram('add-two', 1, 'Add two numbers',
      'Ask for two whole numbers, one at a time, and print their sum.<br><br>'
      + 'Prompts: <code>Enter the first number: </code> then <code>Enter the second number: </code>.<br>'
      + 'Answer: <code>The sum is: N</code>.',
      [{ title: 'Sample 1', content: 'Input:\n3\n4\nOutput:\nEnter the first number: Enter the second number: The sum is: 7' }],
      [{ name: 'three and four', stdin: '3\n4\n', expected: 'Enter the first number: Enter the second number: The sum is: 7' },
       { name: 'crossing zero', stdin: '-9\n4\n', expected: 'Enter the first number: Enter the second number: The sum is: -5' }]),

    _csProgram('odd-even', 2, 'Odd or even',
      'Ask for a whole number and say whether it is even or odd.<br><br>'
      + 'Prompt: <code>Enter a number: </code>. Answer: <code>N is Even</code> or <code>N is Odd</code>, '
      + 'with the number in it.<br><br>'
      + 'Remember that zero is even, and that <code>-3 % 2</code> is <code>-1</code> in C \u2014 not <code>1</code>. '
      + 'Compare against <code>0</code> and both signs behave.',
      [{ title: 'Sample 1', content: 'Input:\n10\nOutput:\nEnter a number: 10 is Even' },
       { title: 'Sample 2', content: 'Input:\n7\nOutput:\nEnter a number: 7 is Odd' }],
      [{ name: 'ten is even', stdin: '10\n', expected: 'Enter a number: 10 is Even' },
       { name: 'seven is odd', stdin: '7\n', expected: 'Enter a number: 7 is Odd' },
       { name: 'zero is even', stdin: '0\n', expected: 'Enter a number: 0 is Even' },
       { name: 'negatives too', stdin: '-3\n', expected: 'Enter a number: -3 is Odd' }]),

    _csProgram('largest', 2, 'The largest of three',
      'Ask for three whole numbers on one line and print the largest.<br><br>'
      + 'Prompt: <code>Enter three numbers: </code>. Answer: <code>The largest is: N</code>.<br><br>'
      + 'If two are tied for largest, that value is still the answer.',
      [{ title: 'Sample 1', content: 'Input:\n4 9 2\nOutput:\nEnter three numbers: The largest is: 9' }],
      [{ name: 'middle one wins', stdin: '4 9 2\n', expected: 'Enter three numbers: The largest is: 9' },
       { name: 'last one wins', stdin: '1 2 3\n', expected: 'Enter three numbers: The largest is: 3' },
       { name: 'a tie', stdin: '5 5 1\n', expected: 'Enter three numbers: The largest is: 5' },
       { name: 'all negative', stdin: '-7 -2 -9\n', expected: 'Enter three numbers: The largest is: -2' }]),

    _csProgram('grade', 2, 'Turn a score into a grade',
      'Ask for a score from 0 to 100 and print the letter grade.<br><br>'
      + 'Prompt: <code>Enter a score: </code>. Answer: <code>Your grade is: X</code>.<br><br>'
      + '90 and above <code>A</code>, 80 to 89 <code>B</code>, 70 to 79 <code>C</code>, '
      + '60 to 69 <code>D</code>, below 60 <code>F</code>.<br>'
      + 'The boundaries are where this one goes wrong, so try 90, 80, 70 and 60 yourself before checking.',
      [{ title: 'Sample 1', content: 'Input:\n83\nOutput:\nEnter a score: Your grade is: B' }],
      [{ name: 'a clear B', stdin: '83\n', expected: 'Enter a score: Your grade is: B' },
       { name: 'exactly 90', stdin: '90\n', expected: 'Enter a score: Your grade is: A' },
       { name: 'exactly 60', stdin: '60\n', expected: 'Enter a score: Your grade is: D' },
       { name: 'just under', stdin: '59\n', expected: 'Enter a score: Your grade is: F' },
       { name: 'full marks', stdin: '100\n', expected: 'Enter a score: Your grade is: A' }]),

    _csProgram('countdown', 3, 'Count down',
      'Ask for a whole number <code>n</code> and print every number from <code>n</code> down to 1, '
      + 'one per line.<br><br>'
      + 'Prompt: <code>Enter a number: </code>. If <code>n</code> is below 1, print the prompt and nothing after it.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\nEnter a number: 5\n4\n3\n2\n1' }],
      [{ name: 'from five', stdin: '5\n', expected: 'Enter a number: 5\n4\n3\n2\n1' },
       { name: 'from one', stdin: '1\n', expected: 'Enter a number: 1' },
       { name: 'nothing to count', stdin: '0\n', expected: 'Enter a number:' }]),

    _csProgram('sum-to-n', 3, 'Add up to n',
      'Ask for a whole number <code>n</code> and print the total of every number from 1 to <code>n</code>.<br><br>'
      + 'Prompt: <code>Enter a number: </code>. Answer: <code>The total is: N</code>.<br><br>'
      + 'For 5 that is 1+2+3+4+5, so 15. If <code>n</code> is below 1, the total is 0.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\nEnter a number: The total is: 15' }],
      [{ name: 'up to five', stdin: '5\n', expected: 'Enter a number: The total is: 15' },
       { name: 'up to one', stdin: '1\n', expected: 'Enter a number: The total is: 1' },
       { name: 'nothing to add', stdin: '0\n', expected: 'Enter a number: The total is: 0' },
       { name: 'a bigger one', stdin: '100\n', expected: 'Enter a number: The total is: 5050' }]),

    _csProgram('times-table', 3, 'A times table',
      'Ask for a whole number <code>n</code> and print its table from 1 to 10, one line each, '
      + 'in the form <code>n x i = product</code> \u2014 for example <code>3 x 4 = 12</code>. '
      + 'Use a lower-case x with a space either side.<br><br>'
      + 'Prompt: <code>Enter a number: </code>.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\nEnter a number: 3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15\n3 x 6 = 18\n3 x 7 = 21\n3 x 8 = 24\n3 x 9 = 27\n3 x 10 = 30' }],
      [{ name: 'the three times table', stdin: '3\n',
         expected: 'Enter a number: 3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15\n3 x 6 = 18\n3 x 7 = 21\n3 x 8 = 24\n3 x 9 = 27\n3 x 10 = 30' },
       { name: 'zero all the way down', stdin: '0\n',
         expected: 'Enter a number: 0 x 1 = 0\n0 x 2 = 0\n0 x 3 = 0\n0 x 4 = 0\n0 x 5 = 0\n0 x 6 = 0\n0 x 7 = 0\n0 x 8 = 0\n0 x 9 = 0\n0 x 10 = 0' }])
  ];

  /* The second half lives in its own file: arrays, pointers, memory and the
     bag. Kept apart because that half is a course of its own and this one is
     the warm-up before it. */
  let allCh = challenges, allNodes = nodes;
  /* Tier 0 sorts ahead of folder 1 by its negative order. It is the ground
     this file used to assume the reader already stood on. */
  if (typeof codingStarterCore === 'function') {
    const core = codingStarterCore();
    allCh = core.challenges.concat(allCh);
    allNodes = core.nodes.concat(allNodes);
  }

  /* Functions and pointers, taken apart. They sit between tier 0 and folder 1
     because folder 5 used to open on swap() with three programs to teach it. */
  if (typeof codingStarterPointers === 'function') {
    const pt = codingStarterPointers();
    allCh = pt.challenges.concat(allCh);
    allNodes = pt.nodes.concat(allNodes);
  }

  /* Arrays, including the four operations a course asks for by name. */
  if (typeof codingStarterArrays === 'function') {
    const ar = codingStarterArrays();
    allCh = ar.challenges.concat(allCh);
    allNodes = ar.nodes.concat(allNodes);
  }

  /* Loops, and the patterns that make nested ones visible. Sits between tier 0
     and functions because everything after it needs a loop. */
  if (typeof codingStarterLoops === 'function') {
    const lp = codingStarterLoops();
    allCh = lp.challenges.concat(allCh);
    allNodes = lp.nodes.concat(allNodes);
  }

  /* The handout-shaped ones: given files, one stub to fill in. They go last
     because each needs a whole tier behind it. */
  if (typeof codingStarterWorkshops === 'function') {
    const ws = codingStarterWorkshops();
    allCh = allCh.concat(ws.challenges);
    allNodes = allNodes.concat(ws.nodes);
  }
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
  /* Strings, recursion, grids and files -- the rest of a first C course, and
     the two topics the final is built on. */
  if (typeof codingStarterAdvanced === 'function') {
    const adv = codingStarterAdvanced();
    allCh = allCh.concat(adv.challenges);
    allNodes = allNodes.concat(adv.nodes);
  }

  return _csStamp({ challenges: allCh, nodes: allNodes, sets: _csExamSets(allCh) });
}

/* ── The four exams ──────────────────────────────────────────
   A practice set is a run of problems in one sitting, which is the shape an
   exam actually has -- the pressure of a paper is not any single question, it
   is not being able to stop and look one up.

   The four follow the course: Pre-Midterm is everything before structures,
   Midterm adds them, Pre-Final adds strings, recursion and grids, and Finals
   is the file work with the rest behind it. Each is built from programs that
   already exist in the pack, so a set never drifts from the folder it came
   from, and anything the pack does not have is simply not in a set. */
function _csExamSets(allCh) {
  const has = id => allCh.some(c => c.id === 'starter-' + id);
  const mk = (setId, title, description, ids) => {
    const problems = ids.filter(has).map(id => ({
      id: 'starter-set-' + setId + '-' + id,
      source: 'library',
      challengeId: 'starter-' + id,
      variantId: 'starter-' + id + '-v1'
    }));
    return { id: 'starter-set-' + setId, title, description, parentId: null, problems };
  };

  return [
    mk('premid', 'Pre-Midterm · Foundations',
       'Input, decisions, loops and arrays — everything before structures. '
       + 'Six problems in one sitting.',
       ['echo-number', 'odd-even', 'grade', 'sum-to-n', 'times-table', 'arr-sum']),

    mk('midterm', 'Midterm · Arrays, pointers, structures',
       'The midterm list: pointers by reference, dynamic memory, and structures '
       + 'as members and as arrays.',
       ['arr-largest', 'arr-sentinel', 'ptr-swap', 'ptr-minmax', 'mem-return',
        'struct-one', 'struct-team']),

    mk('prefinal', 'Pre-Final · Strings, recursion, grids',
       'Strings without the library, recursion where a loop will not be accepted, '
       + 'and two-dimensional arrays.',
       ['str-length', 'str-palindrome', 'str-wordcount', 'rec-factorial', 'rec-gcd',
        'fn-swap-ref', 'grid-rowsums', 'grid-transpose']),

    mk('finals', 'Finals · Files and everything behind them',
       'The final list: files of structures, fseek and rewind, multi-dimensional '
       + 'arrays, and a last pass over pointers and memory.',
       ['file-write-read', 'file-lines', 'file-structs', 'file-seek',
        'grid-diagonal', 'mem-pairs', 'poke-bag'])
  ];
}

/* ── Telling the two libraries apart ───────────────────────
   Every single thing the pack owns -- all 43 programs, 12 folders and 4 sets --
   has an id beginning "starter-". Nothing of yours does. That is what makes the
   two separable after they have been mixed, and it is the only test any of this
   should ever have relied on. */
function _csIsPackId(x) { return !!x && String(x.id).indexOf('starter-') === 0; }

/** The pack: not empty, and nothing in it but the pack's own programs. */
function _csLooksLikePack(lib) {
  const cs = (lib && lib.challenges) || [];
  return cs.length > 0 && cs.every(_csIsPackId);
}

/** Yours: nothing of the pack's in it. An empty library qualifies. */
function _csLooksLikeMine(lib) {
  const cs = (lib && lib.challenges) || [];
  return !cs.some(_csIsPackId);
}

/**
 * RUN TOGETHER means one library holding both kinds of program at once.
 *
 * Not the same thing as the mode flag disagreeing with the content, which is
 * what this used to test and which is harmless: a library that is cleanly the
 * pack, labelled "mine", is a wrong label on intact data. Treating the two as
 * one condition put a red "these have run together" warning over a perfectly
 * ordinary library of 43 pack programs and 0 of the reader's own, disabled the
 * pack switch, and offered a Repair that would have moved all 43 out and left
 * the screen empty.
 *
 * Only a genuine mix is dangerous, because only then can a pack update reach
 * something you wrote.
 */
function _csIsMixed(lib) { return !csLibraryIsClean(lib); }

/**
 * Make the flag agree with what is actually on screen.
 *
 * state.codingMode is bookkeeping, and it can fall out of step with the
 * content -- an import, a cloud sync, a save that did not land. When the live
 * library is cleanly one thing or the other there is no ambiguity about which
 * it is, so the flag is simply corrected rather than reported. Left alone when
 * the library is empty (nothing to read it from) or genuinely mixed (the
 * banner and Repair handle that).
 */
function _csReconcileMode() {
  if (typeof state === 'undefined' || !state) return;
  const live = _csLift();
  if (!live.challenges.length || _csIsMixed(live)) return;
  const should = _csLooksLikePack(live) ? 'starter' : 'mine';
  if (state.codingMode !== should) {
    state.codingMode = should;
    if (typeof saveData === 'function') saveData();
  }
}

/**
 * Put the two libraries back where they belong after they have been mixed or
 * swapped.
 *
 * Takes everything that exists -- what is on screen and what is parked -- and
 * sorts it by id: the pack's things go to the pack, everything else is yours.
 * Nothing is deleted by this; a program can only move from one library to the
 * other, and duplicates collapse to one.
 */
function repairCodingLibraries() {
  const live = _csLift();
  const parked = state.codingStash || { challenges: [], sets: [], nodes: [] };

  // Live first, so where the same id exists twice the copy you were looking at
  // is the one that survives.
  const mergeById = (a, b) => {
    const out = [], seen = new Set();
    (a || []).concat(b || []).forEach(x => {
      if (x && x.id != null && !seen.has(x.id)) { seen.add(x.id); out.push(x); }
    });
    return out;
  };
  const allCh = mergeById(live.challenges, parked.challenges);
  const allSets = mergeById(live.sets, parked.sets);
  const allNodes = mergeById(live.nodes, parked.nodes);

  const mine = {
    challenges: allCh.filter(c => !_csIsPackId(c)),
    sets: allSets.filter(s => !_csIsPackId(s)),
    nodes: allNodes.filter(n => !_csIsPackId(n))
  };
  const pack = {
    challenges: allCh.filter(_csIsPackId),
    sets: allSets.filter(_csIsPackId),
    nodes: allNodes.filter(_csIsPackId)
  };

  /* A program of yours that ended up inside a starter folder would follow that
     folder into the pack and be invisible in your library. Anything whose
     parent did not come with it goes to the top level, where it can be seen and
     moved, rather than nowhere. */
  const mineNodes = new Set(mine.nodes.map(x => x.id));
  let rehomed = 0;
  mine.challenges.concat(mine.sets).forEach(x => {
    if (x.parentId && !mineNodes.has(x.parentId)) { x.parentId = null; rehomed++; }
  });
  const packNodes = new Set(pack.nodes.map(x => x.id));
  pack.challenges.concat(pack.sets).forEach(x => {
    if (x.parentId && !packNodes.has(x.parentId)) x.parentId = null;
  });

  /* If everything turned out to be the pack's, then the pack IS the library on
     screen and there is nothing of yours to put back. Emptying the screen and
     filing all 43 programs away would be the literal reading of "sort them by
     which library they came from" and a terrible answer to it. */
  if (!mine.challenges.length && pack.challenges.length) {
    if (!_csPlace(pack)) return { mine: 0, pack: 0, rehomed: 0 };
    state.codingMode = 'starter';
    saveData();
    if (typeof invalidateBrowseCache === 'function') invalidateBrowseCache();
    if (typeof renderBrowse === 'function') renderBrowse();
    csRefreshBanner();
    _csSyncBtn();
    if (typeof toast === 'function') {
      toast('Nothing was mixed — every program here is from the starter pack, so the library is '
            + 'left exactly as it was.', { type: 'success', duration: 6000 });
    }
    return { mine: 0, pack: pack.challenges.length, rehomed: 0 };
  }

  _csPlace(mine);
  state.codingStash = pack.challenges.length ? pack : null;
  state.codingMode = 'mine';
  saveData();

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
  csRefreshBanner();
  _csSyncBtn();

  if (typeof toast === 'function') {
    toast('Your library: ' + mine.challenges.length + ' program' + (mine.challenges.length === 1 ? '' : 's')
          + ', ' + mine.nodes.length + ' folder' + (mine.nodes.length === 1 ? '' : 's') + '. '
          + pack.challenges.length + ' starter program' + (pack.challenges.length === 1 ? '' : 's')
          + ' put back in the pack'
          + (rehomed ? ', ' + rehomed + ' moved to your top level' : '') + '.',
          { type: 'success', duration: 7000 });
  }
  return { mine: mine.challenges.length, pack: pack.challenges.length, rehomed: rehomed };
}

/** Are the two libraries actually run together? Drives the Repair button. */
function codingLibrariesLookMixed() {
  return _csIsMixed(_csLift()) || _csIsMixed(state && state.codingStash);
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

/**
 * THE INVARIANT: a program, set or folder whose id is not the pack's may never
 * live in the pack library.
 *
 * Ownership used to be positional -- a thing belonged to whichever array it
 * happened to sit in -- so anything created while the pack was on screen became
 * part of the pack. Measured: one program added that way took a clean library
 * of 43 straight to "mixed". That is the loop where Repair cleans it, the next
 * program you add dirties it, and the warning comes back.
 *
 * Held at the two places that can break it: creation (see csCanAddHere, called
 * by the admin form, duplicate and shared-link import) and the swap below.
 */
function csLibraryIsClean(lib) {
  const cs = (lib && lib.challenges) || [];
  return !(cs.some(_csIsPackId) && cs.some(c => !_csIsPackId(c)));
}

/** Put a lifted set back, leaving every other scope's folders alone.
 *
 *  Every swap goes through here, which makes it the one place worth checking:
 *  a mixed library must never be written as though it were one of the two.
 *  Refusing costs a click; writing it costs the separation. */
function _csPlace(set) {
  if (!csLibraryIsClean(set)) {
    console.error('[CodingStarter] Refused to place a mixed library.');
    if (typeof toast === 'function') {
      toast('Stopped: that library holds both your programs and the starter pack. Nothing was changed.',
            { type: 'error', duration: 6000 });
    }
    return false;
  }
  const others = (state.nodes || []).filter(n => n.scope !== 'challenge');
  state.challenges = (set && set.challenges) || [];
  state.codingSets = (set && set.sets) || [];
  state.nodes = others.concat((set && set.nodes) || []);
  return true;
}

/**
 * May something of your own be created into the library on screen right now?
 *
 * No, while that library is the starter pack. The pack is a fixed set that this
 * file rebuilds and updates, and a program of yours sitting inside it is both
 * the thing that mixes the two and the thing an update would then have to
 * reason about. Switching is one click and puts you somewhere your work is
 * safe, so the answer is to say where it belongs rather than to file it wrongly
 * and warn about it afterwards.
 *
 * EDITING a pack program stays allowed. Its id is still the pack's, so it
 * cannot mix, and packFp already keeps your edit from being overwritten.
 *
 * @param {string} [what] noun for the message, e.g. 'program', 'folder'
 */
function csCanAddHere(what) {
  if (!codingLibraryIsStarter()) return true;
  if (typeof toast === 'function') {
    toast('You are viewing the starter pack, so a new ' + (what || 'item')
        + ' cannot be added here. Switch to your own library first — the pack button in the header.',
        { type: 'warning', duration: 6000 });
  }
  return false;
}

function toggleCodingLibraryMode() {
  // What is on screen decides which way "the other one" is, not a stale flag.
  _csReconcileMode();
  const to = codingLibraryIsStarter() ? 'mine' : 'starter';
  /* An empty personal library is a real answer, not a missing one.

     This used to refuse when nothing was parked, on the grounds that loading
     an empty library would look like the programs had been deleted. That is
     true of YOUR library, which cannot be rebuilt -- but the thing on screen
     in this branch is the pack, which is written in this file and comes back
     whole on the next press. So the switch is reversible either way, and
     refusing only left the pack showing with no way past it: the admin list
     reads the live library, so the pack was all you could reach or edit.

     Nothing parked simply means you have not made anything yet. */
  const parked = state.codingStash || { challenges: [], sets: [], nodes: [] };

  const live = _csLift();

  /* Parking overwrites the stash, so it must not happen while one library
     holds both kinds of program -- that is the case where the wrong thing ends
     up under the label "the pack" and a later update can reach your work.

     A flag that merely disagrees with the content is NOT that case. It is a
     wrong label on intact data, and _csReconcileMode above has already put it
     right, so the swap below acts on what is really there. Refusing that too
     is what left a library of 43 pack programs unable to use its own switch. */
  if (_csIsMixed(live)) {
    if (typeof toast === 'function') {
      toast('Stopped: this library holds both your programs and the starter pack, so putting it away '
            + 'would file your work under the pack. Nothing was changed — use Repair first.',
            { type: 'error', duration: 8000 });
    }
    return;
  }

  const target = to === 'starter'
    ? ((parked && parked.challenges && parked.challenges.length) ? parked : codingStarterPack())
    : parked;
  if (!_csPlace(target)) return;      // refused: nothing has been parked yet
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
  csRefreshBanner();
  _csSyncBtn();

  if (typeof toast === 'function') {
    const mineCount = (state.challenges || []).length;
    toast(to === 'starter'
      ? 'Showing the starter pack. Your own programs are put aside, not deleted.'
      : (mineCount
          ? 'Back to your own programs.'
          : 'Your library is empty. Add programs in Admin, or switch back for the starter pack.'),
      { type: 'info', duration: mineCount || to === 'starter' ? 3200 : 5000 });
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

/**
 * Repaint the banner in place.
 *
 * It used to be written once when the route rendered and once more on a
 * toggle, which was enough while it only ever said which library was on
 * screen. It now also carries the mixed-libraries warning, and that can become
 * true while the page is already open -- so it is repainted wherever the tree
 * is, or the warning would wait for a navigation to appear.
 */
function csRefreshBanner() {
  const banner = document.getElementById('browse-starter-banner');
  if (!banner) return;
  /* Put the label right before drawing it. A flag left over from an import or
     a sync would otherwise keep calling the pack "your programs" until someone
     pressed the switch -- and the switch is the thing the wrong label makes
     confusing. */
  _csReconcileMode();
  const html = codingStarterBannerTemplate();
  if (banner.innerHTML === html) return;      // nothing to do, and no icon churn
  banner.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: banner });
}

/* The shipped pack, built and fingerprinted once.
   codingStarterPack() builds ~43 programs from scratch and _csStamp hashes
   every one of them; the banner is repainted on every browse render, so doing
   that each time would be work per keystroke in the search box. Cached for
   reading only -- updateCodingStarterPack still builds its own, because the
   merge hands these objects INTO the library and must not hand out the copy
   everything else is comparing against. */
let _csFreshCache = null;
function _csFreshPack() {
  if (!_csFreshCache) _csFreshCache = _csStamp(codingStarterPack());
  return _csFreshCache;
}

/**
 * How many changes Update would actually make, without making them.
 *
 * The same three comparisons the merge runs, with one correction: the merge
 * rewrites every program you have not edited and counts each as "refreshed",
 * whether or not it differs from the shipped one, so its own counter says 43
 * for a pack that is already current. That is harmless when it is only
 * narrating a click, and useless as a test of whether the click is worth
 * offering. Here a program counts only when it is untouched AND its
 * fingerprint differs from what shipped.
 *
 * Returns 0 for a library that is not the pack; sorting that out is Repair's
 * job and the warning above already says so.
 */
function codingStarterPendingCount() {
  const target = codingLibraryIsStarter() ? _csLift() : (state.codingStash || null);
  const cs = (target && target.challenges) || [];
  if (!cs.length || !cs.some(_csIsPackId) || cs.some(c => !_csIsPackId(c))) return 0;

  const fresh = _csFreshPack();
  let count = 0;

  const haveNode = new Set((target.nodes || []).map(x => x.id));
  (fresh.nodes || []).forEach(x => { if (!haveNode.has(x.id)) count++; });

  const byId = {};
  cs.forEach(c => { byId[c.id] = c; });
  (fresh.challenges || []).forEach(f => {
    const have = byId[f.id];
    if (!have) { count++; return; }
    const untouched = !have.packFp || have.packFp === _csFingerprint(have);
    if (untouched && have.packFp !== f.packFp) count++;
  });

  (fresh.sets || []).forEach(fs => {
    const have = (target.sets || []).find(x => x.id === fs.id);
    if (!have) { count++; return; }
    if (JSON.stringify(have.problems || []) === JSON.stringify(fs.problems || [])) return;
    if (!have.userEdited) count++;
  });

  return count;
}

/** Shown when there is something to say, and otherwise not at all. */
function codingStarterBannerTemplate() {
  /* Shown in either mode when the two have run together, because that is
     exactly the state in which you cannot trust what you are looking at and
     the switch has been disabled. */
  if (typeof codingLibrariesLookMixed === 'function' && codingLibrariesLookMixed()) {
    return '<div class="cs-banner cs-banner-warn" role="alert">'
         + '<i data-lucide="alert-triangle"></i>'
         + '<span><strong>These two libraries have run together.</strong> Some starter programs are '
         + 'sitting in your library or the other way round. Nothing has been deleted — Repair sorts '
         + 'them by which library they came from and puts each one back.</span>'
         + '<button type="button" class="cs-update-btn" onclick="repairCodingLibraries()"'
         + ' title="Sort the programs back into the library each came from">'
         + '<i data-lucide="wrench"></i> Repair</button>'
         + '</div>';
  }
  /* THE STANDING REMINDER IS GONE. It said which library was on screen for as
     long as you were in it, which is a fact the switch beside it already
     carries -- that button is lit, captioned "Showing the starter pack", and
     drawn with an open-box icon. A permanent notice that repeats the control
     next to it is not information, it is furniture, and it sat above the tree
     on every render.

     What only the banner had was the Update button, so the banner now appears
     exactly when that button would do something: when the shipped pack really
     has moved on from the installed one. Up to date, there is nothing to say
     and nothing is drawn. */
  if (!codingLibraryIsStarter()) return '';
  const pending = codingStarterPendingCount();
  if (!pending) return '';
  return '<div class="cs-banner" role="status">'
       + '<i data-lucide="package-open"></i>'
       + '<span><strong>Starter pack update.</strong> ' + pending + ' item'
       + (pending === 1 ? ' is' : 's are') + ' new or changed since this pack was installed. '
       + 'Anything you have edited yourself is kept as it is.</span>'
       + '<button type="button" class="cs-update-btn" onclick="updateCodingStarterPack()"'
       + ' title="Add anything new and refresh what you have not edited">'
       + '<i data-lucide="refresh-cw"></i> Update</button>'
       + '</div>';
}

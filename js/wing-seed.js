/* ============================================================
   WING-SEED.JS — a starter pack per wing
   ------------------------------------------------------------
   A library with nothing in it cannot demonstrate what it is for. Each of the
   seven wings has a distinct shape — a museum, a rulebook, a chronology, a
   journal, a catalogue, a set of goals, a set of paths — and an empty grid
   shows none of that. The Language Library already ships a starter pack for
   exactly this reason; this is the same idea, one pack per wing.

   The entries exercise each wing's OWN fields, not just a title and a body,
   because the fields are what make the wings different from one another: a
   Collection item with no medium and no rating says nothing about what the
   Collection Library does with a medium and a rating.

   Every value below is taken from that wing's own options list rather than
   invented, and the packs deliberately spread ACROSS those options. A
   Progression pack that was all "Active" would render a grouped library
   showing one group, which is precisely the thing these libraries do that a
   flat list does not.

   NOTHING IS REPLACED. Matching is by title, so running it twice adds nothing
   and a pack can never overwrite something you wrote. Entries land in one
   folder named after the pack, so they are easy to find and easy to remove
   together once you have your own.
   ============================================================ */

const WING_SEED_FOLDER = 'Starter pack';

const WING_SEED_PACKS = {
  mindset: [
    { title: 'Slow is smooth, and smooth is fast',
      body: 'Rushing a change costs more than the change. The time saved by skipping the read-through is borrowed at a bad rate, and it is always repaid during the part you least want to be debugging.',
      data: { conviction: 'Core', replaces: 'Move fast and fix it later',
              evidence: 'Every outage I have caused was a change I made quickly and understood shallowly.' },
      tags: ['craft', 'pace'] },
    { title: 'A guess that feels obvious is still a guess',
      body: 'Confidence is not evidence. The times I have been most sure without measuring are the times I have been most wrong, and being sure made me slower to check.',
      data: { conviction: 'Settled', replaces: 'Trusting the first explanation',
              evidence: 'Reproduced before fixing, and every time it turned out to be something else.' },
      tags: ['thinking'] },
    { title: 'Name the cost out loud',
      body: 'Every shortcut is a loan. Saying who repays it and when turns a silent decision into one somebody can disagree with.',
      data: { conviction: 'Working', replaces: 'Quietly taking the shortcut' },
      tags: ['decisions'] },
    { title: 'You do not understand it until you can delete something',
      body: 'Adding code until it works can be done without understanding it. Removing code and keeping it working cannot.',
      data: { conviction: 'Testing', replaces: 'Reading until it feels familiar' },
      tags: ['craft'] }
  ],

  insights: [
    { title: 'Say who pays for it before you decide',
      body: 'A decision that costs somebody else their weekend is a different decision from one that costs you an hour, and it stops looking obvious the moment it is named.',
      data: { kind: 'Ethic', trigger: 'Any choice that saves your time by spending the time of others',
              because: 'The cost is invisible from where the decision gets made, which is exactly why it has to be said out loud.' },
      tags: ['decisions'] },
    { title: 'The measurement that surprises you is the useful one',
      body: 'A number that confirms what you assumed taught you nothing. The one that does not is where the problem actually lives.',
      data: { kind: 'Instinct', trigger: 'Reading any profiling or timing output',
              because: 'Attention drifts to the numbers that agree with you, and those are the ones with nothing left to give.' },
      tags: ['performance'] },
    { title: 'Reproduce it before you fix it',
      body: 'A fix for a bug you have not seen happen is a guess with a commit message. Reproducing costs minutes and tells you whether the fix worked.',
      data: { kind: 'Decision', trigger: 'Any bug report, however obvious it looks',
              because: 'Half of the obvious ones are a different bug in the same area, and the obvious fix hides it rather than solving it.' },
      tags: ['debugging'] },
    { title: 'A comment is not a substitute for a test',
      body: 'If the only thing stopping someone breaking it is a note asking them not to, it is not protected. A comment persuades the people who read it; a test stops everyone else.',
      data: { kind: 'Boundary', trigger: 'About to write "do not remove this"',
              because: 'The next person to touch it is in a hurry, and comments do not fail builds.' },
      tags: ['testing'] }
  ],

  remembrance: [
    { title: 'The first program that did something I did not expect',
      body: 'A loop that printed the wrong number of lines. Finding out why was the first time a computer felt like something to understand rather than something to operate.',
      data: { occurred: '', place: 'A school computer room', who: 'Just me', feeling: 'Hooked' },
      tags: ['beginnings'] },
    { title: 'Being asked to explain it without the jargon',
      body: 'I could not do it, and realised I did not understand it either. It changed how I judge whether I have finished learning something.',
      data: { occurred: '', place: 'A first job', who: 'A patient colleague', feeling: 'Embarrassed, then grateful' },
      tags: ['learning'] },
    { title: 'The outage I caused, and what happened next',
      body: 'Nobody shouted. Someone sat down and walked through it with me, and the fix went in with my name on it. It taught me more about the team than about the bug.',
      data: { occurred: '', place: 'Somewhere I was new', who: 'The whole on-call rota', feeling: 'Sick, then safe' },
      tags: ['work'] }
  ],

  diary: [
    { title: 'A quiet day that went well',
      body: 'Nothing dramatic. Finished the thing I said I would finish, which is rarer than it should be.',
      data: { entryDate: '', mood: 'Good', energy: 4, oneGoodThing: 'Finished what I planned' },
      tags: [] },
    { title: 'Stuck for most of the afternoon',
      body: 'Went round the same problem three times before admitting I did not understand the input. Reading it properly took ten minutes.',
      data: { entryDate: '', mood: 'Low', energy: 2, oneGoodThing: 'Admitted it eventually' },
      tags: ['work'] },
    { title: 'Closed the laptop on time',
      body: 'Stopped at a sensible hour and the problem was smaller in the morning. It usually is.',
      data: { entryDate: '', mood: 'Grateful', energy: 3, oneGoodThing: 'Stopped on time' },
      tags: ['rest'] },
    { title: 'Busy, but none of it was the important thing',
      body: 'Every hour accounted for and the one task that mattered untouched. Worth noticing on the day, before it becomes a week.',
      data: { entryDate: '', mood: 'Restless', energy: 3, oneGoodThing: 'Noticed it on the day' },
      tags: ['work'] }
  ],

  collection: [
    { title: 'The Pragmatic Programmer',
      body: 'The one that framed craft as a set of habits rather than a talent. Worth rereading at intervals, because different chapters land at different stages.',
      data: { medium: 'Book', creator: 'Hunt and Thomas', year: '1999', rating: 5, status: 'Finished' },
      tags: ['craft'] },
    { title: 'Crafting Interpreters',
      body: 'Building one end to end is the only thing that made parsing stop being a black box.',
      data: { medium: 'Book', creator: 'Robert Nystrom', year: '2021', rating: 5, status: 'Ongoing' },
      tags: ['languages'] },
    { title: 'Arrival',
      body: 'A film about a language changing how someone thinks, which is either a metaphor for this whole library or an accident.',
      data: { medium: 'Film', creator: 'Denis Villeneuve', year: '2016', rating: 4, status: 'Finished' },
      tags: ['stories'] },
    { title: 'Outer Wilds',
      body: 'The only game where the progression is entirely in what you understand. Nothing is unlocked but you.',
      data: { medium: 'Game', creator: 'Mobius Digital', year: '2019', rating: 5, status: 'Revisiting' },
      tags: ['stories'] },
    { title: 'Simple Made Easy',
      body: 'The distinction between simple and easy, made concrete enough to use in an argument about a design.',
      data: { medium: 'Other', creator: 'Rich Hickey', year: '2011', rating: 5, status: 'Backlog' },
      tags: ['design'] }
  ],

  progression: [
    { title: 'Read a stack trace in any language I use',
      body: 'Not memorising frameworks — being able to open an unfamiliar trace and find the line that matters without guessing.',
      data: { stage: 'Active', target: '',
              steps: [{ text: 'Read one trace a day for a fortnight', done: true },
                      { text: 'Write down what each frame meant', done: false },
                      { text: 'Do it once in a language I do not know', done: false }] },
      tags: ['debugging'] },
    { title: 'Ship something end to end, alone',
      body: 'Design, build, deploy and support it. The gaps show up in the parts nobody hands you.',
      data: { stage: 'Someday', target: '',
              steps: [{ text: 'Pick something small and real', done: false },
                      { text: 'Get it in front of one other person', done: false },
                      { text: 'Fix the first thing they hit', done: false }] },
      tags: ['projects'] },
    { title: 'Explain my work to someone outside the field',
      body: 'The test of understanding is whether it survives losing the vocabulary.',
      data: { stage: 'Paused', target: '',
              steps: [{ text: 'Write one paragraph with no jargon', done: false },
                      { text: 'Read it aloud and watch where they frown', done: false }] },
      tags: ['communication'] },
    { title: 'Stop needing the debugger for control flow',
      body: 'Reading what a function does should not require stepping through it. Stepping is for state now, not for shape.',
      data: { stage: 'Reached', target: '',
              steps: [{ text: 'Predict the path before running it', done: true },
                      { text: 'Only step in when the prediction was wrong', done: true }] },
      tags: ['debugging'] }
  ],

  roadmap: [
    { title: 'From reading code to changing it confidently',
      body: 'The gap is not syntax, it is knowing what will break. Each stage shortens the distance between making a change and knowing whether it worked.',
      data: { horizon: 'Now', goalRef: '',
              stages: [{ text: 'Run the tests before touching anything', status: 'cleared' },
                       { text: 'Make one change and predict the failure first', status: 'walking' },
                       { text: 'Refactor with the tests as the safety net', status: 'planned' },
                       { text: 'Change something with no tests, adding them as I go', status: 'planned' }] },
      tags: ['craft'] },
    { title: 'Learning a language properly, not just enough to copy',
      body: 'Enough-to-copy plateaus fast. The way out is writing the things the language is actually good at.',
      data: { horizon: 'Next', goalRef: '',
              stages: [{ text: 'Finish a tutorial without skipping the exercises', status: 'cleared' },
                       { text: 'Rewrite something I already built', status: 'walking' },
                       { text: 'Read a real codebase in it', status: 'planned' },
                       { text: 'Write something idiomatic enough to review well', status: 'planned' }] },
      tags: ['learning'] },
    { title: 'Understanding the machine under the language',
      body: 'Not to write assembly, but so that performance stops being folklore.',
      data: { horizon: 'Later', goalRef: '',
              stages: [{ text: 'Read what the compiler emits, once', status: 'planned' },
                       { text: 'Measure a cache miss on purpose', status: 'planned' },
                       { text: 'Explain a slow loop without guessing', status: 'planned' }] },
      tags: ['performance'] }
  ]
};

/** Does this wing have a pack, and how much of it is not here yet? */
function wingSeedAvailable(key) {
  const pack = WING_SEED_PACKS[key];
  if (!pack || !pack.length) return 0;
  const have = new Set(wingItems(key).map(w => (w.title || '').trim().toLowerCase()));
  return pack.filter(p => !have.has(p.title.trim().toLowerCase())).length;
}

/**
 * Add the pack, skipping anything already present by title.
 *
 * Dates are filled in relative to today rather than stored in the pack. A
 * diary seeded with three entries from whenever this file was written would
 * sort into the wrong year and read as somebody else's journal.
 *
 * @returns {{added:number, skipped:number}}
 */
function wingAddSeedPack(key) {
  const pack = WING_SEED_PACKS[key] || [];
  if (!pack.length) return { added: 0, skipped: 0 };

  const items = wingItems(key);
  const have = new Set(items.map(w => (w.title || '').trim().toLowerCase()));

  // One folder for the lot, so they can be found and removed together.
  const scope = 'wing:' + key;
  let folder = state.nodes.find(n => n.scope === scope && n.type === 'folder' && n.name === WING_SEED_FOLDER);
  if (!folder) {
    folder = { id: generateId(), name: WING_SEED_FOLDER, type: 'folder',
               parentId: null, scope: scope, order: state.nodes.length };
    state.nodes.push(folder);
  }

  const today = (typeof wingToday === 'function') ? wingToday() : '';
  let added = 0, skipped = 0;

  pack.forEach((p, i) => {
    if (have.has(p.title.trim().toLowerCase())) { skipped++; return; }
    const data = JSON.parse(JSON.stringify(p.data || {}));
    // Space the dated wings backwards from today, so a chronology has
    // something to put in order and a diary spans more than one day.
    if ('entryDate' in data && !data.entryDate) data.entryDate = _wingSeedDaysAgo(today, i);
    if ('occurred' in data && !data.occurred) data.occurred = _wingSeedDaysAgo(today, (i + 1) * 400);

    items.push({
      id: generateId(),
      title: p.title,
      body: p.body || '',
      tags: (p.tags || []).slice(),
      parentId: folder.id,
      favorite: false,
      data: data,
      // Staggered, so "recently updated" does not order them arbitrarily.
      createdAt: Date.now() - (pack.length - i) * 1000,
      updatedAt: Date.now() - (pack.length - i) * 1000
    });
    added++;
  });

  if (added) saveData();
  return { added: added, skipped: skipped };
}

function _wingSeedDaysAgo(todayStr, days) {
  if (!todayStr || typeof wingParseDate !== 'function') return todayStr || '';
  const d = wingParseDate(todayStr);
  if (!d) return todayStr;
  d.setDate(d.getDate() - days);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** The confirm-and-report wrapper both the library and its admin call. */
function wingLoadSeedPack(key, afterFn) {
  const pack = WING_SEED_PACKS[key] || [];
  const schema = (typeof wingSchema === 'function') ? wingSchema(key) : { noun: 'entry', nounPlural: 'entries' };
  const left = wingSeedAvailable(key);
  if (!pack.length) {
    if (typeof toast === 'function') toast('No starter pack for this wing.', { type: 'info' });
    return;
  }
  if (!left) {
    if (typeof toast === 'function') toast('The starter pack is already here.', { type: 'info' });
    return;
  }
  showConfirm('Add the starter pack?',
    left + ' example ' + (left === 1 ? schema.noun : schema.nounPlural)
    + ' are added to a "' + WING_SEED_FOLDER + '" folder, filled in the way this wing expects. '
    + 'Nothing you have written is changed, and anything already here by name is skipped.',
    () => {
      const r = wingAddSeedPack(key);
      if (typeof toast === 'function') {
        toast(r.added
          ? 'Added ' + r.added + ' ' + (r.added === 1 ? schema.noun : schema.nounPlural)
            + (r.skipped ? '. ' + r.skipped + ' were already there.' : '.')
          : 'Everything in the pack was already there.',
          { type: r.added ? 'success' : 'info' });
      }
      if (typeof afterFn === 'function') afterFn();
    });
}

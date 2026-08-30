/* ============================================================
   WINGS/CORE/SEED.JS — the starter-pack mechanics
   ------------------------------------------------------------
   The mechanics only. Every wing's actual examples live in that wing's own
   file beside the schema they fill in, and arrive here through
   wingSeedRegister() the same way its fields and its card do.

   That split is the point. A single file holding all seven packs meant the
   entries and the schema they had to satisfy were hundreds of lines apart in
   different files, and the first draft of those packs drifted from the schemas
   badly enough that half the values were not in the wings' option lists at
   all. Kept together, the fields are a few lines above the examples.

   A library with nothing in it cannot demonstrate what it is for, which is
   what these are for: each of the seven has a distinct shape — a museum, a
   rulebook, a chronology, a journal, a catalogue, a set of goals, a set of
   paths — and an empty grid shows none of it.

   NOTHING IS REPLACED. Matching is by title, so running it twice adds nothing
   and a pack can never overwrite your writing. Entries land in one folder
   named after the pack, easy to find and easy to remove together.
   ============================================================ */

const WING_SEED_FOLDER = 'Starter pack';

/** key -> the wing's own examples. Filled by each wing file at load. */
const WING_SEEDS = {};

/**
 * Register a wing's starter pack. Called from js/wings/<key>.js.
 * @param {string} key
 * @param {Array<{title:string, body:string, data:object, tags:string[]}>} entries
 */
function wingSeedRegister(key, entries) {
  WING_SEEDS[key] = Array.isArray(entries) ? entries : [];
}

function wingSeedPack(key) { return WING_SEEDS[key] || []; }

/** Does this wing have a pack, and how much of it is not here yet? */
function wingSeedAvailable(key) {
  const pack = wingSeedPack(key);
  if (!pack.length) return 0;
  const have = new Set(wingItems(key).map(w => (w.title || '').trim().toLowerCase()));
  return pack.filter(p => !have.has(p.title.trim().toLowerCase())).length;
}

/**
 * Add the pack, skipping anything already present by title.
 *
 * Dates are filled in relative to today rather than stored in the pack. A
 * diary seeded with entries from whenever the file was written would sort into
 * the wrong year and read as somebody else's journal.
 *
 * @returns {{added:number, skipped:number}}
 */
function wingAddSeedPack(key) {
  const pack = wingSeedPack(key);
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
  const pack = wingSeedPack(key);
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

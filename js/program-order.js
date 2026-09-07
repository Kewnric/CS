/* ============================================================
   PROGRAM-ORDER.JS — which program comes first, said out loud
   ------------------------------------------------------------
   A course is a sequence. The pack always had one — the programs are authored
   in teaching order inside each folder — but that order was implicit in an
   array, so nothing on screen said what it was and nothing protected it.

   Two things went wrong because of that.

   IT COULD BE REVERSED WITHOUT ANYONE NOTICING. "Folder order" ran through the
   library's ascending/descending control like every other sort, so one click
   turned the curriculum backwards: "Draw a box" first and "One line of text"
   last, with nothing on screen to say so. Direction is meaningful for Best
   score or Recent; for a taught sequence it only inverts it. So the direction
   control no longer applies to folder order.

   AND IT COULD NOT BE EDITED. Changing the sequence meant editing the pack
   source, so an author could not reorder their own library at all.

   The number is now explicit — stamped on every program, shown on its card,
   and adjustable. An order you can see is one you can tell is wrong.
   ============================================================ */

/** The explicit sequence number, or null when a program has none. */
function programOrder(c) {
  const n = c && c.order;
  return typeof n === 'number' && isFinite(n) ? n : null;
}

/** Everything in a folder, in the order it should be taught. */
function programsInFolder(parentId, pool) {
  const list = (pool || state.challenges || []).filter(c => c.parentId === parentId);
  return programSortByOrder(list);
}

/**
 * Sort by explicit order, keeping array position as the tiebreak.
 *
 * The fallback matters: a library that has never been numbered still reads in
 * the order it was authored, so switching this on changes nothing until
 * somebody actually numbers something.
 */
function programSortByOrder(list) {
  const at = new Map();
  list.forEach((c, i) => at.set(c.id, i));
  return list.slice().sort((a, b) => {
    const ao = programOrder(a), bo = programOrder(b);
    if (ao !== null && bo !== null) return ao - bo;
    if (ao !== null) return -1;          // numbered programs lead unnumbered ones
    if (bo !== null) return 1;
    return at.get(a.id) - at.get(b.id);
  });
}

/**
 * The number to SHOW. Explicit where there is one, otherwise the position it
 * actually occupies, so every card carries a number even before anything has
 * been numbered by hand.
 */
function programSeq(c, pool) {
  const explicit = programOrder(c);
  if (explicit !== null) return explicit;
  const sibs = programsInFolder(c.parentId, pool);
  const i = sibs.findIndex(x => x.id === c.id);
  return i === -1 ? null : i + 1;
}

/** Stamp 1…n onto a folder in the order given. */
function programRenumber(parentId, orderedIds) {
  const ids = orderedIds || programsInFolder(parentId).map(c => c.id);
  ids.forEach((id, i) => {
    const c = (state.challenges || []).find(x => x.id === id);
    if (c) c.order = i + 1;
  });
  if (typeof saveData === 'function') saveData();
  return ids.length;
}

/**
 * Move one program up or down among its siblings.
 * Numbers the whole folder first when it has never been numbered, so a single
 * nudge cannot leave one program numbered and the rest not.
 */
function programMove(id, delta) {
  const c = (state.challenges || []).find(x => x.id === id);
  if (!c) return false;
  const sibs = programsInFolder(c.parentId);
  const i = sibs.findIndex(x => x.id === id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= sibs.length) return false;
  const ids = sibs.map(x => x.id);
  ids.splice(j, 0, ids.splice(i, 1)[0]);
  programRenumber(c.parentId, ids);
  return true;
}

/* ── On the card ───────────────────────────────────────────────
   Small, in front of the title, and always present. Its job is to make the
   sequence readable at a glance — which is also what makes a reversed or
   scrambled list obvious instead of something you have to work out. */

function programSeqBadgeHTML(c, pool) {
  const n = programSeq(c, pool);
  if (n === null) return '';
  const explicit = programOrder(c) !== null;
  return '<span class="prog-seq' + (explicit ? '' : ' is-implied') + '"'
    + ' title="' + (explicit ? 'Position ' + n + ' in this folder'
                             : 'Position ' + n + ' — not numbered yet, this is where it sits')
    + '">' + n + '</span>';
}

/** The up/down pair, shown only while the folder is being reordered. */
function programMoveBtnsHTML(c) {
  return '<span class="prog-move" onclick="event.stopPropagation();">'
    + '<button class="prog-move-btn" onclick="event.stopPropagation();programMoveAndPaint(\'' + c.id + '\',-1)"'
    + ' title="Move earlier" aria-label="Move earlier"><i data-lucide="chevron-up"></i></button>'
    + '<button class="prog-move-btn" onclick="event.stopPropagation();programMoveAndPaint(\'' + c.id + '\',1)"'
    + ' title="Move later" aria-label="Move later"><i data-lucide="chevron-down"></i></button>'
    + '</span>';
}

function programMoveAndPaint(id, delta) {
  if (!programMove(id, delta)) return;
  if (typeof invalidateBrowseCache === 'function') invalidateBrowseCache();
  if (typeof renderBrowseContent === 'function') renderBrowseContent();
  else if (typeof renderBrowse === 'function') renderBrowse();
}

/* ── Reorder mode ──────────────────────────────────────────────
   A mode rather than always-on arrows: the cards are for choosing what to do
   next far more often than for rearranging, and two buttons on every card is a
   lot of furniture for the rarer job. */
const PROG_REORDER_KEY = 'browse.reorder';

function programReorderOn() {
  return typeof getLibPref === 'function' && getLibPref(PROG_REORDER_KEY, false) === true;
}

function programToggleReorder() {
  const next = !programReorderOn();
  if (typeof setLibPref === 'function') setLibPref(PROG_REORDER_KEY, next);
  if (next && typeof toast === 'function') {
    toast('Reorder mode — use the arrows on each card. Sorting is set to folder order.', { type: 'info' });
  }
  // Rearranging while sorted by score would move a program to a position the
  // list is not showing, so the mode takes the list back to the sequence.
  if (next && typeof setBrowseSort === 'function') setBrowseSort('default');
  else {
    if (typeof invalidateBrowseCache === 'function') invalidateBrowseCache();
    if (typeof renderBrowse === 'function') renderBrowse();
  }
}

/** Number the folder exactly as it is displayed right now. */
function programRenumberShown(parentId) {
  const n = programRenumber(parentId);
  if (typeof invalidateBrowseCache === 'function') invalidateBrowseCache();
  if (typeof renderBrowse === 'function') renderBrowse();
  if (typeof toast === 'function') toast('Numbered ' + n + ' program' + (n !== 1 ? 's' : '') + ' 1–' + n + '.', { type: 'success' });
}

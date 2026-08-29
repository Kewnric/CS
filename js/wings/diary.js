/* ============================================================
   WINGS/DIARY.JS — a journal
   ------------------------------------------------------------
   Dated entries grouped by month, newest first, sorted on the day they are
   ABOUT rather than the day they were last edited. Fixing a typo in an old
   entry should not move it to the top.

   The day block on the left is deliberately the loudest thing in the row: a
   journal is navigated by date, and the heading is often an afterthought.
   ============================================================ */

wingRegister('diary', {
  noun: 'entry', nounPlural: 'entries',
  layout: 'journal',
  rows: true,

  titleLabel: 'Heading',
  titlePlaceholder: 'A line for the day…',
  bodyLabel: 'The entry',
  bodyPlaceholder: 'How the day went…',

  sortKey: 'entryDate',
  groupBy: '__month',

  fields: [
    { key: 'entryDate', type: 'date', label: 'Date', def: 'today' },
    { key: 'mood', type: 'select', label: 'Mood',
      options: ['Good', 'Steady', 'Tired', 'Low', 'Restless', 'Grateful', 'Angry'], def: 'Steady' },
    { key: 'energy', type: 'rating', label: 'Energy', max: 5 },
    { key: 'oneGoodThing', type: 'text', label: 'One good thing',
      placeholder: 'Even on a bad day…' }
  ],

  card(w) {
    const d = wingParseDate(wingVal(w, 'entryDate'));
    const mood = wingVal(w, 'mood');
    const energy = parseInt(wingVal(w, 'energy'), 10) || 0;
    const good = wingVal(w, 'oneGoodThing');
    return wingShell(w, `
      <div class="wing-day">
        <span class="wing-day-num">${d ? d.getDate() : '–'}</span>
        <span class="wing-day-dow">${d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : ''}</span>
      </div>
      <div class="wing-tl-body">
        <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
        <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 180) || 'Nothing written yet.')}</p>
        <div class="wing-row-meta">
          ${mood ? wingBadge(mood, 'mood-' + wingSlug(mood)) : ''}
          ${energy ? wingStars(energy, 5) : ''}
          ${good ? `<span class="wing-good"><i data-lucide="sparkles" style="width:11px;height:11px;"></i> ${escapeHTML(good)}</span>` : ''}
        </div>
      </div>
    `, 'wing-row wing-journal');
  }
});

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

/* ── Starter pack ─────────────────────────────────────────────
   Four consecutive days with different moods, so the journal shows what a week of it looks like.

   It lives here, with the schema it fills in, rather than in one file
   holding every wing's examples: the fields these entries use are
   defined a few lines up, and a pack that drifts from its schema is the
   failure mode worth designing against.
   ------------------------------------------------------------ */
wingSeedRegister('diary', [
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
  ]);

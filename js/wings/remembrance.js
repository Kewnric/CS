/* ============================================================
   WINGS/REMEMBRANCE.JS — a chronology
   ------------------------------------------------------------
   A storybook in date order. What matters is when a thing HAPPENED, not when
   you got round to writing it down, so this sorts and groups on its own date
   field rather than on updatedAt — otherwise typing up something from 2019
   would drop it at the top of the list.

   The rail down the left is what makes consecutive entries read as one thread
   rather than a stack of cards.
   ============================================================ */

wingRegister('remembrance', {
  noun: 'memory', nounPlural: 'memories',
  layout: 'timeline',
  rows: true,

  titleLabel: 'What happened',
  titlePlaceholder: 'e.g. The night the power went out',
  bodyLabel: 'The account',
  bodyPlaceholder: 'Tell it properly. Detail is what makes it survive.',

  sortKey: 'occurred',
  groupBy: '__year',

  fields: [
    { key: 'occurred', type: 'date', label: 'When it happened', def: 'today' },
    { key: 'place', type: 'text', label: 'Where', placeholder: 'A place, or a time of life…' },
    { key: 'who', type: 'text', label: 'Who was there', placeholder: 'Comma separated…' },
    { key: 'feeling', type: 'text', label: 'What it felt like', placeholder: 'One word is enough…' }
  ],

  card(w) {
    const d = wingParseDate(wingVal(w, 'occurred'));
    const place = wingVal(w, 'place');
    const who = wingVal(w, 'who');
    const feel = wingVal(w, 'feeling');
    return wingShell(w, `
      <div class="wing-tl-rail">
        <span class="wing-tl-dot"></span>
        <span class="wing-tl-date">${d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</span>
      </div>
      <div class="wing-tl-body">
        <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
        <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 180) || 'No account written yet.')}</p>
        <div class="wing-row-meta">
          ${place ? `<span><i data-lucide="map-pin" style="width:11px;height:11px;"></i> ${escapeHTML(place)}</span>` : ''}
          ${who ? `<span><i data-lucide="users" style="width:11px;height:11px;"></i> ${escapeHTML(who)}</span>` : ''}
          ${feel ? wingBadge(feel, 'soft') : ''}
        </div>
      </div>
    `, 'wing-row wing-tl');
  }
});

/* ── Starter pack ─────────────────────────────────────────────
   Three memories, spaced years apart, so the timeline has something to put in order.

   It lives here, with the schema it fills in, rather than in one file
   holding every wing's examples: the fields these entries use are
   defined a few lines up, and a pack that drifts from its schema is the
   failure mode worth designing against.
   ------------------------------------------------------------ */
wingSeedRegister('remembrance', [
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
  ]);

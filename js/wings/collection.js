/* ============================================================
   WINGS/COLLECTION.JS — a catalogue of favourites
   ------------------------------------------------------------
   Music, anime, films, books, games. Grouped by medium so it reads as a
   catalogue rather than a pile: the question you actually arrive with is
   "what anime did I love", not "what did I add last Tuesday".

   The body is the part worth writing. A five-star rating with nothing beside
   it tells you nothing in two years; a sentence about what it did for you
   still does.
   ============================================================ */

const WING_MEDIUM_ICONS = {
  Music: 'music', Anime: 'tv', Film: 'clapperboard', Series: 'monitor-play',
  Book: 'book', Game: 'gamepad-2', Other: 'box'
};

wingRegister('collection', {
  noun: 'item', nounPlural: 'items',
  layout: 'catalogue',
  rows: false,

  titleLabel: 'Title',
  titlePlaceholder: 'What is it called…',
  bodyLabel: 'Why it is here',
  bodyPlaceholder: 'What it did for you. This is the part you will reread.',

  groupBy: 'medium',
  groupOrder: ['Music', 'Anime', 'Film', 'Series', 'Book', 'Game', 'Other'],

  fields: [
    { key: 'medium', type: 'select', label: 'Medium',
      options: ['Music', 'Anime', 'Film', 'Series', 'Book', 'Game', 'Other'], def: 'Music' },
    { key: 'creator', type: 'text', label: 'By',
      placeholder: 'Artist, studio, author, director…' },
    { key: 'year', type: 'text', label: 'Year', placeholder: 'e.g. 2024' },
    { key: 'cover', type: 'image', label: 'Cover',
      hint: 'Optional. Of the seven wings this is the one that catalogues things with covers.' },
    { key: 'rating', type: 'rating', label: 'Rating', max: 5 },
    { key: 'status', type: 'select', label: 'Status',
      options: ['Finished', 'Ongoing', 'Backlog', 'Dropped', 'Revisiting'], def: 'Finished' }
  ],

  card(w) {
    const medium = wingVal(w, 'medium') || 'Other';
    const creator = wingVal(w, 'creator');
    const year = wingVal(w, 'year');
    const status = wingVal(w, 'status');
    const rating = parseInt(wingVal(w, 'rating'), 10) || 0;
    const cover = wingVal(w, 'cover');
    return wingShell(w, `
      <div class="wing-cat-cover">
        ${cover
          ? `<img src="${escapeHTML(cover)}" alt="" loading="lazy" />`
          : (typeof libCoverFallbackHTML === 'function'
              ? libCoverFallbackHTML(w.title, WING_MEDIUM_ICONS[medium] || 'box')
              : '')}
      </div>
      <div class="wing-cat-head">
        <span class="wing-cat-icon"><i data-lucide="${WING_MEDIUM_ICONS[medium] || 'box'}"></i></span>
        <div style="min-width:0;flex:1;">
          <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
          <p class="wing-cat-by">${escapeHTML([creator, year].filter(Boolean).join(' · ') || '—')}</p>
        </div>
      </div>
      ${rating ? `<div class="wing-cat-rate">${wingStars(rating, 5)}</div>` : ''}
      <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 120) || '')}</p>
      <div class="wing-row-meta">
        ${status ? wingBadge(status, 'status-' + wingSlug(status)) : ''}
        ${(w.tags || []).slice(0, 2).map(t => libTagBadgeHTML('wing', t)).join('')}
      </div>
    `, 'card card-enhanced wing-cat');
  }
});

/* ── Starter pack ─────────────────────────────────────────────
   A book, a film, a game and a talk, because the point of this wing is that it catalogues anything.

   It lives here, with the schema it fills in, rather than in one file
   holding every wing's examples: the fields these entries use are
   defined a few lines up, and a pack that drifts from its schema is the
   failure mode worth designing against.
   ------------------------------------------------------------ */
wingSeedRegister('collection', [
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
  ]);

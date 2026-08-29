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
    return wingShell(w, `
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

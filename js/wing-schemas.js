/* ============================================================
   WING-SCHEMAS.JS — what each wing actually is
   ------------------------------------------------------------
   wing.js is one generic list library: titled entries with a body, tags and
   folders, shared by all seven wings. That got them onto the screen, but a
   diary and a goal tracker are not the same thing wearing different icons —
   a diary entry has a date and a mood, a goal has steps you tick off, a
   collection entry has a medium and a rating.

   So the engine stays and the differences live here: each wing declares its
   own vocabulary, its own extra fields and its own layout. Folders, search,
   tags, favourites and the bulk bar keep working for all seven because none
   of that is touched.

   A schema is:
     noun/nounPlural  what an entry is called, in the buttons and the header
     titleLabel       what the title field is asking for
     bodyLabel        what the body field is asking for
     layout           which renderer draws the cards and the reader
     fields[]         the extra fields, in editor order
     groupBy          field key to group the list under, or null
     groupOrder       the order those groups appear in
     sortKey          a date field to sort by instead of updatedAt

   Field types: text, textarea, date, select, rating, checklist, stages.
   ============================================================ */

const WING_SCHEMAS = {

  /* A museum of settled thinking. The title IS the mindset — one line, stated
     plainly — and everything else is the plaque beside it. */
  mindset: {
    noun: 'mindset', nounPlural: 'mindsets',
    titleLabel: 'The mindset, in one line',
    titlePlaceholder: 'e.g. Finish badly rather than plan forever',
    bodyLabel: 'How you arrived at it',
    bodyPlaceholder: 'What changed your mind. The argument, the experience, the person…',
    layout: 'museum',
    groupBy: 'conviction',
    groupOrder: ['Core', 'Settled', 'Working', 'Testing'],
    fields: [
      { key: 'conviction', type: 'select', label: 'How settled is it',
        options: ['Testing', 'Working', 'Settled', 'Core'], def: 'Testing',
        hint: 'Testing → you are trying it. Core → you would not trade it away.' },
      { key: 'replaces', type: 'text', label: 'What it replaced',
        placeholder: 'The belief this displaced…' },
      { key: 'since', type: 'date', label: 'Held since' },
      { key: 'evidence', type: 'textarea', rows: 4, label: 'Evidence it holds up',
        placeholder: 'Times it proved right. A mindset with no evidence is a slogan.' }
    ]
  },

  /* A rulebook. Every entry is a sentence you must act on, so the title is
     written as an instruction and the list reads as a numbered code. */
  insights: {
    noun: 'rule', nounPlural: 'rules',
    titleLabel: 'The rule, as an instruction',
    titlePlaceholder: 'e.g. Say the hard thing early, while it is still small',
    bodyLabel: 'The longer case',
    bodyPlaceholder: 'Where it came from, and what it costs to ignore…',
    layout: 'rulebook',
    groupBy: 'kind',
    groupOrder: ['Ethic', 'Instinct', 'Decision', 'Boundary'],
    fields: [
      { key: 'kind', type: 'select', label: 'Kind',
        options: ['Ethic', 'Instinct', 'Decision', 'Boundary'], def: 'Decision',
        hint: 'Ethic — right and wrong. Instinct — what to feel. Decision — how to choose. Boundary — what you refuse.' },
      { key: 'trigger', type: 'text', label: 'When it applies',
        placeholder: 'The situation that should bring this to mind…' },
      { key: 'because', type: 'textarea', rows: 3, label: 'Because…',
        placeholder: 'The reason, in one or two sentences. A rule you cannot justify is one you will drop.' }
    ]
  },

  /* A storybook in date order. What matters is when it happened, not when you
     typed it up, so this sorts on the event date. */
  remembrance: {
    noun: 'memory', nounPlural: 'memories',
    titleLabel: 'What happened',
    titlePlaceholder: 'e.g. The night the power went out',
    bodyLabel: 'The account',
    bodyPlaceholder: 'Tell it properly. Detail is what makes it survive.',
    layout: 'timeline',
    sortKey: 'occurred',
    groupBy: '__year',
    fields: [
      { key: 'occurred', type: 'date', label: 'When it happened', def: 'today' },
      { key: 'place', type: 'text', label: 'Where', placeholder: 'A place, or a time of life…' },
      { key: 'who', type: 'text', label: 'Who was there', placeholder: 'Comma separated…' },
      { key: 'feeling', type: 'text', label: 'What it felt like', placeholder: 'One word is enough…' }
    ]
  },

  /* A diary. Dated, moody, grouped by month, newest first. */
  diary: {
    noun: 'entry', nounPlural: 'entries',
    titleLabel: 'Heading',
    titlePlaceholder: 'A line for the day…',
    bodyLabel: 'The entry',
    bodyPlaceholder: 'How the day went…',
    layout: 'journal',
    sortKey: 'entryDate',
    groupBy: '__month',
    fields: [
      { key: 'entryDate', type: 'date', label: 'Date', def: 'today' },
      { key: 'mood', type: 'select', label: 'Mood',
        options: ['Good', 'Steady', 'Tired', 'Low', 'Restless', 'Grateful', 'Angry'], def: 'Steady' },
      { key: 'energy', type: 'rating', label: 'Energy', max: 5 },
      { key: 'oneGoodThing', type: 'text', label: 'One good thing',
        placeholder: 'Even on a bad day…' }
    ]
  },

  /* An archive of favourites — music, anime, whatever. Grouped by medium so
     it reads as a catalogue rather than a pile. */
  collection: {
    noun: 'item', nounPlural: 'items',
    titleLabel: 'Title',
    titlePlaceholder: 'What is it called…',
    bodyLabel: 'Why it is here',
    bodyPlaceholder: 'What it did for you. This is the part you will reread.',
    layout: 'catalogue',
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
    ]
  },

  /* Goals, broken into steps you can tick off from the reader. */
  progression: {
    noun: 'goal', nounPlural: 'goals',
    titleLabel: 'The goal',
    titlePlaceholder: 'e.g. Read C fluently enough to debug without help',
    bodyLabel: 'Why this one',
    bodyPlaceholder: 'What it unlocks, and what happens if you never do it…',
    layout: 'goals',
    groupBy: 'stage',
    groupOrder: ['Active', 'Paused', 'Someday', 'Reached'],
    fields: [
      { key: 'stage', type: 'select', label: 'Stage',
        options: ['Someday', 'Active', 'Paused', 'Reached'], def: 'Active' },
      { key: 'target', type: 'date', label: 'Target date' },
      { key: 'steps', type: 'checklist', label: 'Steps',
        hint: 'One per line. Tick them off from the goal itself once saved.' }
    ]
  },

  /* The path you walk to reach a goal. Stages run in order and each is
     planned, being walked, or cleared. */
  roadmap: {
    noun: 'path', nounPlural: 'paths',
    titleLabel: 'The path',
    titlePlaceholder: 'e.g. From copying code to writing it cold',
    bodyLabel: 'How you intend to walk it',
    bodyPlaceholder: 'The approach, the rules you set yourself, what you will not do…',
    layout: 'path',
    groupBy: 'horizon',
    groupOrder: ['Now', 'Next', 'Later'],
    fields: [
      { key: 'horizon', type: 'select', label: 'Horizon',
        options: ['Now', 'Next', 'Later'], def: 'Now' },
      { key: 'goalRef', type: 'goalref', label: 'Goal this serves',
        hint: 'Pick one of your Progression goals, so the path and the goal know about each other.' },
      { key: 'stages', type: 'stages', label: 'Stages',
        hint: 'One per line, in order. Click a marker to move it on: planned → walking → cleared.' }
    ]
  }
};

/** The fallback keeps an unknown wing working as the plain list it used to be. */
const WING_SCHEMA_DEFAULT = {
  noun: 'entry', nounPlural: 'entries',
  titleLabel: 'Title', titlePlaceholder: 'Give it a name…',
  bodyLabel: 'Content', bodyPlaceholder: 'Write it out…',
  layout: 'plain', fields: [], groupBy: null
};

function wingSchema(key) {
  return WING_SCHEMAS[key || _wingKey] || WING_SCHEMA_DEFAULT;
}

/* ── Values ───────────────────────────────────────────────── */

function wingVal(w, key) {
  return (w && w.data && w.data[key] !== undefined) ? w.data[key] : '';
}

const WING_STAGE_STATES = ['planned', 'walking', 'cleared'];

/** done / total / percent for a checklist or a stage list. */
function wingProgress(w) {
  const steps = wingVal(w, 'steps');
  if (Array.isArray(steps) && steps.length) {
    const done = steps.filter(s => s && s.done).length;
    return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
  }
  const stages = wingVal(w, 'stages');
  if (Array.isArray(stages) && stages.length) {
    const done = stages.filter(s => s && s.status === 'cleared').length;
    return { done, total: stages.length, pct: Math.round((done / stages.length) * 100) };
  }
  return null;
}

/* ── Date helpers ─────────────────────────────────────────── */

function wingToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/** A yyyy-mm-dd string as a LOCAL date. new Date('2026-01-05') is UTC midnight,
    which reads as the 4th once the clock is behind it. */
function wingParseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

function wingDateLabel(s, opts) {
  const d = wingParseDate(s);
  if (!d) return '';
  return d.toLocaleDateString(undefined, opts || { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The date this wing orders by — its own if it has one, else when it changed. */
function wingSortStamp(w, schema) {
  if (schema.sortKey) {
    const d = wingParseDate(wingVal(w, schema.sortKey));
    if (d) return d.getTime();
  }
  return w.updatedAt || w.createdAt || 0;
}

/* ── Grouping ─────────────────────────────────────────────── */

/**
 * Split the list into labelled groups.
 *
 * __year and __month are derived from the wing's own date field rather than a
 * stored value, which is what lets a timeline and a journal group themselves
 * without carrying a redundant field.
 */
function wingGroupList(list, schema) {
  if (!schema.groupBy) return [{ label: null, items: list }];

  const keyOf = (w) => {
    if (schema.groupBy === '__year') {
      const d = wingParseDate(wingVal(w, schema.sortKey));
      return d ? String(d.getFullYear()) : 'Undated';
    }
    if (schema.groupBy === '__month') {
      const d = wingParseDate(wingVal(w, schema.sortKey));
      return d ? d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Undated';
    }
    return wingVal(w, schema.groupBy) || 'Unsorted';
  };

  const buckets = new Map();
  list.forEach(w => {
    const k = keyOf(w);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(w);
  });

  let labels = Array.from(buckets.keys());
  if (schema.groupOrder) {
    labels.sort((a, b) => {
      const ia = schema.groupOrder.indexOf(a), ib = schema.groupOrder.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  } else if (schema.groupBy === '__year' || schema.groupBy === '__month') {
    // Newest first, with anything undated at the bottom rather than sorted
    // into 1970 by an empty date.
    labels.sort((a, b) => {
      if (a === 'Undated') return 1;
      if (b === 'Undated') return -1;
      const ta = buckets.get(a)[0], tb = buckets.get(b)[0];
      return wingSortStamp(tb, schema) - wingSortStamp(ta, schema);
    });
  } else {
    labels.sort();
  }
  return labels.map(l => ({ label: l, items: buckets.get(l) }));
}

/* ── Small pieces of chrome ───────────────────────────────── */

function wingBadge(text, cls) {
  if (!text) return '';
  return `<span class="wing-badge ${cls || ''}">${escapeHTML(String(text))}</span>`;
}

function wingStars(n, max) {
  const v = parseInt(n, 10) || 0;
  const top = max || 5;
  let out = '<span class="wing-stars" aria-label="' + v + ' out of ' + top + '">';
  for (let i = 1; i <= top; i++) {
    out += `<i data-lucide="star" style="width:13px;height:13px;${i <= v ? 'fill:currentColor;' : 'opacity:.3;'}"></i>`;
  }
  return out + '</span>';
}

function wingProgressBarHTML(p) {
  if (!p) return '';
  return `
    <div class="wing-prog" title="${p.done} of ${p.total} done">
      <div class="wing-prog-track"><div class="wing-prog-fill" style="width:${p.pct}%;"></div></div>
      <span class="wing-prog-num">${p.done}/${p.total}</span>
    </div>`;
}

/* Slug so a group label can drive a colour without a lookup table. */
function wingSlug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

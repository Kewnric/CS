/* ============================================================
   WINGS/MINDSET.JS — a museum of settled thinking
   ------------------------------------------------------------
   The title IS the mindset — one line, stated plainly — and everything else
   is the plaque beside it. That is why the card sets the title as a statement
   rather than a heading, and why the reader gives it a rule down the side and
   room to be read slowly instead of scanned.

   Grouped by how settled a mindset is, so the wall reads from the things you
   would not trade away down to the ones you are still trying out.
   ============================================================ */

wingRegister('mindset', {
  noun: 'mindset', nounPlural: 'mindsets',
  layout: 'museum',
  rows: false,

  titleLabel: 'The mindset, in one line',
  titlePlaceholder: 'e.g. Finish badly rather than plan forever',
  bodyLabel: 'How you arrived at it',
  bodyPlaceholder: 'What changed your mind. The argument, the experience, the person…',

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
  ],

  card(w) {
    const conv = wingVal(w, 'conviction') || 'Testing';
    const since = wingDateLabel(wingVal(w, 'since'), { year: 'numeric', month: 'long' });
    const replaces = wingVal(w, 'replaces');
    return wingShell(w, `
      <div class="wing-plaque-rule"></div>
      <blockquote class="wing-plaque-text">${escapeHTML(w.title || 'Untitled')}</blockquote>
      ${replaces ? `<p class="wing-plaque-replaces"><s>${escapeHTML(replaces)}</s></p>` : ''}
      <div class="wing-plaque-foot">
        ${wingBadge(conv, 'conv-' + wingSlug(conv))}
        ${since ? `<span class="wing-muted">held since ${escapeHTML(since)}</span>` : ''}
      </div>
      ${(w.tags || []).length ? `<div class="wing-tagrow">${(w.tags || []).map(t => libTagBadgeHTML('wing', t)).join('')}</div>` : ''}
    `, 'card card-enhanced wing-plaque');
  }
});

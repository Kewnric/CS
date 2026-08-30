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

/* ── Starter pack ─────────────────────────────────────────────
   Four convictions, one at each level, so the museum opens with all four walls hung.

   It lives here, with the schema it fills in, rather than in one file
   holding every wing's examples: the fields these entries use are
   defined a few lines up, and a pack that drifts from its schema is the
   failure mode worth designing against.
   ------------------------------------------------------------ */
wingSeedRegister('mindset', [
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
  ]);

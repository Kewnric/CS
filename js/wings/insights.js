/* ============================================================
   WINGS/INSIGHTS.JS — a rulebook
   ------------------------------------------------------------
   Every entry is a sentence you must act on, so the title is written as an
   instruction and the list reads as a numbered code rather than a grid of
   cards. The numbering runs continuously through the groups: a rule has one
   number in the whole book, not one per section, which is what makes "rule 12"
   a thing you can say out loud.

   Three parts to a rule, and each is set differently so they do not blur: the
   instruction itself, the situation that should bring it to mind, and the
   reason. A rule you cannot justify is one you will drop under pressure.
   ============================================================ */

wingRegister('insights', {
  noun: 'rule', nounPlural: 'rules',
  layout: 'rulebook',
  rows: true,

  titleLabel: 'The rule, as an instruction',
  titlePlaceholder: 'e.g. Say the hard thing early, while it is still small',
  bodyLabel: 'The longer case',
  bodyPlaceholder: 'Where it came from, and what it costs to ignore…',

  groupBy: 'kind',
  groupOrder: ['Ethic', 'Instinct', 'Decision', 'Boundary'],

  fields: [
    { key: 'kind', type: 'select', label: 'Kind',
      options: ['Ethic', 'Instinct', 'Decision', 'Boundary'], def: 'Decision',
      hint: 'Ethic — right and wrong. Instinct — what to feel. Decision — how to choose. Boundary — what you refuse.' },
    { key: 'trigger', type: 'text', label: 'When it applies',
      placeholder: 'The situation that should bring this to mind…' },
    { key: 'because', type: 'textarea', rows: 3, label: 'Because…',
      placeholder: 'The reason, in one or two sentences.' }
  ],

  card(w, ctx) {
    const kind = wingVal(w, 'kind') || 'Decision';
    const trig = wingVal(w, 'trigger');
    const why = wingVal(w, 'because');
    return wingShell(w, `
      <span class="wing-rule-n">${ctx && ctx.index ? ctx.index : ''}</span>
      <div class="wing-rule-body">
        <p class="wing-rule-text">${escapeHTML(w.title || 'Untitled')}</p>
        ${trig ? `<p class="wing-rule-when"><i data-lucide="target" style="width:12px;height:12px;"></i> ${escapeHTML(trig)}</p>` : ''}
        ${why ? `<p class="wing-rule-why">${escapeHTML(why)}</p>` : ''}
      </div>
      <div class="wing-rule-side">${wingBadge(kind, 'kind-' + wingSlug(kind))}</div>
    `, 'wing-row wing-rule');
  }
});

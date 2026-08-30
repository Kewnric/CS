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

/* ── Starter pack ─────────────────────────────────────────────
   One rule of each kind, so the rulebook opens with Ethic, Instinct, Decision and Boundary all present.

   It lives here, with the schema it fills in, rather than in one file
   holding every wing's examples: the fields these entries use are
   defined a few lines up, and a pack that drifts from its schema is the
   failure mode worth designing against.
   ------------------------------------------------------------ */
wingSeedRegister('insights', [
    { title: 'Say who pays for it before you decide',
      body: 'A decision that costs somebody else their weekend is a different decision from one that costs you an hour, and it stops looking obvious the moment it is named.',
      data: { kind: 'Ethic', trigger: 'Any choice that saves your time by spending the time of others',
              because: 'The cost is invisible from where the decision gets made, which is exactly why it has to be said out loud.' },
      tags: ['decisions'] },
    { title: 'The measurement that surprises you is the useful one',
      body: 'A number that confirms what you assumed taught you nothing. The one that does not is where the problem actually lives.',
      data: { kind: 'Instinct', trigger: 'Reading any profiling or timing output',
              because: 'Attention drifts to the numbers that agree with you, and those are the ones with nothing left to give.' },
      tags: ['performance'] },
    { title: 'Reproduce it before you fix it',
      body: 'A fix for a bug you have not seen happen is a guess with a commit message. Reproducing costs minutes and tells you whether the fix worked.',
      data: { kind: 'Decision', trigger: 'Any bug report, however obvious it looks',
              because: 'Half of the obvious ones are a different bug in the same area, and the obvious fix hides it rather than solving it.' },
      tags: ['debugging'] },
    { title: 'A comment is not a substitute for a test',
      body: 'If the only thing stopping someone breaking it is a note asking them not to, it is not protected. A comment persuades the people who read it; a test stops everyone else.',
      data: { kind: 'Boundary', trigger: 'About to write "do not remove this"',
              because: 'The next person to touch it is in a hurry, and comments do not fail builds.' },
      tags: ['testing'] }
  ]);

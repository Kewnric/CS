/* ============================================================
   LANG-PREVIEW.JS — looping previews for the Language Library
   ------------------------------------------------------------
   Every page in the library's second pane used to explain itself in prose:
   how to play, what counts, three numbered rules. A preview that plays the
   thing does that faster -- a little cursor taps the tiles, the sentence
   builds, Check goes green and the confetti pops, then it starts over.

   Built from YOUR content where there is some (one of your own questions,
   one of your own scenarios), so the preview is also a taste of what is in
   the library, with a stand-in only when a page has nothing yet.

   Driven by a small async script per preview rather than by CSS keyframes,
   because the steps depend on layout -- where a tile is, how many words a
   sentence has -- and keyframe percentages cannot. Each loop checks that its
   host is still in the document, so a preview stops by itself the moment
   the page is re-rendered or left; there is nothing to tear down.
   ============================================================ */

const LPV_STOP = { stop: true };

const LPV_FALLBACK = {
  arrange: { prompt: 'Say: Where are you going?', answer: 'Asa ka padulong', distractors: ['salamat', 'dili'] },
  blank: { prompt: 'Maayong ___ sa imo!', answer: 'buntag', distractors: ['gabii', 'hapon'] },
  choice: { prompt: 'How do you say “yes”?', options: ['Oo', 'Dili', 'Wala'], correctIndex: 0 },
  translate: { prompt: 'Thank you very much', answer: 'Salamat kaayo' },
  match: { pairs: [{ left: 'oo', right: 'yes' }, { left: 'dili', right: 'no' }, { left: 'salamat', right: 'thank you' }] }
};

const LPV_QUEST_FALLBACK = [
  { loc: 'market', npc: 'Vendor', line: 'Unsa imong paliton?',
    options: [{ text: 'Usa ka kilo nga bugas', correct: true }, { text: 'Maayong gabii', correct: false }, { text: 'Dili ko', correct: false }] },
  { loc: 'street', npc: 'Stranger', line: 'Asa ka padulong?',
    options: [{ text: 'Salamat', correct: false }, { text: 'Sa merkado', correct: true }, { text: 'Oo', correct: false }] }
];

function lpvReduced() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function lpvWords(s) { return String(s || '').trim().split(/\s+/).filter(Boolean); }

function lpvShuffle(a) { return typeof langShuffle === 'function' ? langShuffle(a) : a.slice(); }

/** Whether one of your questions is small enough to play in a preview. */
function lpvFits(type, it) {
  if (!it) return false;
  if (type === 'arrange') { const n = lpvWords(it.answer).length; return n >= 2 && n <= 6; }
  if (type === 'blank') return /_{2,}|\{\}/.test(it.prompt || '') && !!String(it.answer || '').trim() && String(it.prompt).length <= 60;
  if (type === 'choice') return (it.options || []).filter(o => String(o || '').trim()).length >= 2 && !!(it.options || [])[it.correctIndex];
  if (type === 'translate') return !!String(it.prompt || '').trim() && String(it.answer || '').trim().length <= 30;
  if (type === 'match') return (it.pairs || []).filter(p => p && p.left && p.right).length >= 2;
  return false;
}

/** One of your own questions of this type, or the stand-in. */
function lpvDrillSample(type) {
  let pool = [];
  try { pool = (typeof langItemsOfType === 'function' ? langItemsOfType(type) : []).map(p => p.item); } catch (e) { pool = []; }
  const fits = pool.filter(it => lpvFits(type, it)).slice(0, 12);
  const it = fits.length ? fits[Math.floor(Math.random() * fits.length)] : LPV_FALLBACK[type];
  if (!it) return null;
  // Only what the preview needs, so the data attribute stays small.
  if (type === 'choice') {
    const opts = (it.options || []).map((t, i) => ({ t: String(t || '').trim(), ok: i === it.correctIndex })).filter(o => o.t);
    const right = opts.find(o => o.ok);
    const wrong = lpvShuffle(opts.filter(o => !o.ok)).slice(0, 2);
    return { prompt: it.prompt || '', options: lpvShuffle([right].concat(wrong)) };
  }
  if (type === 'match') {
    return { pairs: (it.pairs || []).filter(p => p && p.left && p.right).slice(0, 3).map(p => ({ left: p.left, right: p.right })) };
  }
  return { prompt: it.prompt || '', answer: it.answer || '', distractors: (it.distractors || []).filter(Boolean).slice(0, 2) };
}

/** Up to three of your scenarios, as the adventure preview plays them. */
function lpvQuestSamples(onlyId) {
  let list = [];
  try { list = typeof langScenarios === 'function' ? langScenarios() : []; } catch (e) { list = []; }
  const out = [];
  lpvShuffle(list.filter(s => !onlyId || s.id === onlyId)).some(s => {
    const enc = (s.encounters || []).find(e => (e.line || '').trim()
      && (e.options || []).some(o => (o.text || '').trim() && o.correct)
      && (e.options || []).filter(o => (o.text || '').trim()).length >= 2);
    if (!enc) return false;
    const opts = enc.options.filter(o => (o.text || '').trim() && String(o.text).length <= 34);
    const right = opts.find(o => o.correct);
    if (!right) return false;
    const wrong = lpvShuffle(opts.filter(o => !o.correct)).slice(0, 2);
    out.push({
      loc: s.location || 'street',
      npc: s.npc || 'Someone',
      face: s.face || '',
      line: String(enc.line).slice(0, 70),
      options: lpvShuffle([right].concat(wrong)).map(o => ({ text: o.text, correct: !!o.correct }))
    });
    return out.length >= 3;
  });
  return out.length ? out : LPV_QUEST_FALLBACK;
}

/* ── The adventure's art as backgrounds ───────────────────────
   A scenario card shows its place and its person, and those are the run's own
   drawings. Inlined, ten cards would be ten copies of a 20 KB scene with
   clashing gradient ids; as one stylesheet of data-URI backgrounds each scene
   is decoded once and every card just names it. */

function lpvArtStyles() {
  if (document.getElementById('lpv-art-css') || typeof LANG_SCENE_ART === 'undefined') return;
  const uri = svg => 'url("data:image/svg+xml,'
    + encodeURIComponent(String(svg).replace('<svg ', "<svg xmlns='http://www.w3.org/2000/svg' ")) + '")';
  let css = '';
  Object.keys(LANG_SCENE_ART).forEach(k => { css += '.lpv-bg-' + k + '{background-image:' + uri(LANG_SCENE_ART[k]) + '}'; });
  if (typeof LANG_PORTRAITS !== 'undefined') {
    Object.keys(LANG_PORTRAITS).forEach(k => { css += '.lpv-face-' + k + '{background-image:' + uri(LANG_PORTRAITS[k]) + '}'; });
  }
  const st = document.createElement('style');
  st.id = 'lpv-art-css';
  st.textContent = css;
  document.head.appendChild(st);
}

/** Which of the six faces a character wears -- the same rule lqPortraitFor
    uses: the face picked in Admin if there is one, else the name's. */
function lpvFaceKey(name, face) {
  if (typeof LANG_PORTRAITS === 'undefined') return '';
  if (face && LANG_PORTRAITS[face]) return face;
  const keys = Object.keys(LANG_PORTRAITS).sort();
  if (!keys.length) return '';
  const raw = String(name || '').toLowerCase().trim();
  if (LANG_PORTRAITS[raw]) return raw;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
  return keys[(h >>> 0) % keys.length];
}

/* ── Markup hosts ─────────────────────────────────────────── */

/** The frame a preview plays in. The stage itself is built by the script. */
function lpvDemoHTML(kind, sample, label) {
  return `
    <div class="lpv-demo lpv-demo-${kind}" data-lpv="${kind}" data-lpv-sample="${escapeHTML(JSON.stringify(sample || null))}">
      <div class="lpv-demo-bar">
        <span class="lpv-live" aria-hidden="true"></span>
        <span>${escapeHTML(label || 'Preview')}</span>
        <span class="lpv-demo-hint">plays on a loop</span>
      </div>
      <div class="lpv-stage" aria-hidden="true"></div>
    </div>`;
}

/** The Dictionary's word card that flips between your two languages. */
function lpvWordFlipHTML(words) {
  return `
    <div class="lpv-flip" data-lpv="flip" data-lpv-sample="${escapeHTML(JSON.stringify(words || []))}" aria-hidden="true">
      <div class="lpv-flip-card">
        <div class="lpv-flip-face lpv-flip-front"></div>
        <div class="lpv-flip-face lpv-flip-back"></div>
      </div>
    </div>`;
}

/* ── The engine ───────────────────────────────────────────── */

/** Start every preview under `root` that is not already playing. */
function lpvBoot(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-lpv]').forEach(host => {
    if (host._lpvOn) return;
    host._lpvOn = true;
    const kind = host.dataset.lpv;
    const run = LPV_SCRIPTS[kind];
    if (!run) return;
    let sample = null;
    try { sample = JSON.parse(host.dataset.lpvSample || 'null'); } catch (e) { sample = null; }
    const stage = host.querySelector('.lpv-stage') || host;
    const still = lpvReduced();
    const ctx = {
      still,
      wait(ms) {
        return new Promise((resolve, reject) => {
          if (still) { resolve(); return; }
          setTimeout(() => (host.isConnected ? resolve() : reject(LPV_STOP)), ms);
        });
      }
    };
    (async () => {
      let n = 0;
      try {
        for (;;) {
          stage.classList.remove('is-out');
          await run(stage, sample, ctx, n++);
          // With reduced motion the script ran once, instantly, and its last
          // frame is the picture that stays.
          if (still) return;
          stage.classList.add('is-out');
          await ctx.wait(450);
        }
      } catch (e) {
        if (e !== LPV_STOP && typeof console !== 'undefined') console.warn('preview stopped', e);
      }
    })();
  });
}

function lpvEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

/** The pretend pointer that does the tapping. */
function lpvCursor(stage) {
  const c = lpvEl('span', 'lpv-cursor');
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8-6 1.6L10.5 19z" fill="currentColor" stroke="var(--bg-surface)" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  stage.appendChild(c);
  c.style.transform = 'translate(' + (stage.clientWidth * 0.8) + 'px, ' + (stage.clientHeight + 10) + 'px)';
  return c;
}

/** Glide the pointer to an element and tap it. */
async function lpvTap(stage, cursor, el, ctx) {
  if (!el) return;
  const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
  cursor.style.transform = 'translate(' + (r.left - s.left + r.width * 0.55) + 'px, ' + (r.top - s.top + r.height * 0.45) + 'px)';
  await ctx.wait(520);
  cursor.classList.add('is-tap');
  el.classList.add('is-press');
  await ctx.wait(140);
  cursor.classList.remove('is-tap');
  el.classList.remove('is-press');
}

/** Move a tile into its new place with a little arc, the way the drill does. */
function lpvFly(tile, into, ctx, replace) {
  const a = tile.getBoundingClientRect();
  const clone = tile.cloneNode(true);
  clone.classList.remove('is-press');
  if (replace) into.textContent = '';
  into.appendChild(clone);
  tile.classList.add('is-used');
  if (ctx.still || typeof clone.animate !== 'function') return clone;
  const b = clone.getBoundingClientRect();
  const dx = a.left - b.left, dy = a.top - b.top;
  clone.animate([
    { transform: `translate(${dx}px, ${dy}px)` },
    { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 16}px) scale(1.08)`, offset: 0.45 },
    { transform: 'none' }
  ], { duration: 380, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1.12)' });
  return clone;
}

/** Check pressed, the bar goes green, a handful of confetti. */
async function lpvVerdict(stage, cursor, ctx, text) {
  const btn = stage.querySelector('.lpv-check');
  if (btn) { btn.classList.add('is-ready'); await lpvTap(stage, cursor, btn, ctx); }
  const v = stage.querySelector('.lpv-verdict');
  if (v) {
    v.querySelector('.lpv-verdict-text').textContent = text || 'Nice!';
    v.classList.add('is-on');
  }
  stage.classList.add('is-right');
  cursor.classList.add('is-gone');
  if (!ctx.still) lpvConfetti(stage, v ? v.querySelector('.lpv-badge') : null);
}

const LPV_BITS = ['#34d399', '#22d3ee', '#a78bfa', '#fbbf24', '#f472b6', '#60a5fa'];

function lpvConfetti(stage, from) {
  const s = stage.getBoundingClientRect();
  const r = from ? from.getBoundingClientRect() : { left: s.left + s.width / 2, top: s.top + s.height / 2, width: 0, height: 0 };
  const x = r.left - s.left + r.width / 2, y = r.top - s.top + r.height / 2;
  for (let i = 0; i < 18; i++) {
    const b = lpvEl('i', 'lpv-bit');
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.style.background = LPV_BITS[i % LPV_BITS.length];
    b.style.setProperty('--dx', (Math.random() * 180 - 90).toFixed(0) + 'px');
    b.style.setProperty('--dy', (-30 - Math.random() * 90).toFixed(0) + 'px');
    b.style.setProperty('--r', (Math.random() * 540 - 270).toFixed(0) + 'deg');
    stage.appendChild(b);
    setTimeout(() => b.remove(), 1200);
  }
}

/** The pieces every drill preview shares: prompt, a body, Check, verdict. */
function lpvDrillFrame(stage, prompt) {
  stage.innerHTML = '';
  stage.classList.remove('is-right');
  const q = lpvEl('div', 'lpv-q');
  if (prompt) q.appendChild(lpvEl('div', 'lpv-prompt', prompt));
  const body = lpvEl('div', 'lpv-body');
  q.appendChild(body);
  const foot = lpvEl('div', 'lpv-foot');
  foot.appendChild(lpvEl('span', 'lpv-skip', 'Skip'));
  foot.appendChild(lpvEl('span', 'lpv-check', 'Check'));
  const verdict = lpvEl('div', 'lpv-verdict');
  verdict.innerHTML = '<span class="lpv-badge"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lpv-verdict-text"></span>';
  foot.appendChild(verdict);
  stage.appendChild(q);
  stage.appendChild(foot);
  return { q, body, foot };
}

/* ── The scripts ──────────────────────────────────────────── */

const LPV_SCRIPTS = {

  async arrange(stage, s, ctx) {
    s = s || LPV_FALLBACK.arrange;
    const words = lpvWords(s.answer);
    const { body } = lpvDrillFrame(stage, s.prompt);
    const lane = lpvEl('div', 'lpv-lane');
    const pool = lpvEl('div', 'lpv-pool');
    body.appendChild(lane);
    body.appendChild(pool);
    lpvShuffle(words.map((w, i) => ({ w, i })).concat((s.distractors || []).map(w => ({ w, i: -1 }))))
      .forEach(t => { const el = lpvEl('span', 'lpv-tile', t.w); el.dataset.i = t.i; pool.appendChild(el); });
    const cursor = lpvCursor(stage);
    await ctx.wait(700);
    for (let i = 0; i < words.length; i++) {
      const tile = pool.querySelector('.lpv-tile[data-i="' + i + '"]:not(.is-used)');
      await lpvTap(stage, cursor, tile, ctx);
      lpvFly(tile, lane, ctx);
      await ctx.wait(260);
    }
    await ctx.wait(250);
    await lpvVerdict(stage, cursor, ctx);
    await ctx.wait(2100);
  },

  async blank(stage, s, ctx) {
    s = s || LPV_FALLBACK.blank;
    const { body } = lpvDrillFrame(stage, '');
    const parts = String(s.prompt || '').split(/_{2,}|\{\}/);
    const line = lpvEl('div', 'lpv-sentence');
    line.appendChild(document.createTextNode(parts[0] || ''));
    const slot = lpvEl('span', 'lpv-slot', ' ');
    line.appendChild(slot);
    line.appendChild(document.createTextNode(parts.slice(1).join(' ')));
    const pool = lpvEl('div', 'lpv-pool');
    body.appendChild(line);
    body.appendChild(pool);
    lpvShuffle([{ w: s.answer, i: 0 }].concat((s.distractors || []).map(w => ({ w, i: -1 }))))
      .forEach(t => { const el = lpvEl('span', 'lpv-tile', t.w); el.dataset.i = t.i; pool.appendChild(el); });
    const cursor = lpvCursor(stage);
    await ctx.wait(800);
    const tile = pool.querySelector('.lpv-tile[data-i="0"]');
    await lpvTap(stage, cursor, tile, ctx);
    lpvFly(tile, slot, ctx, true);
    slot.classList.add('is-filled');
    await ctx.wait(450);
    await lpvVerdict(stage, cursor, ctx, 'Correct!');
    await ctx.wait(2100);
  },

  async choice(stage, s, ctx) {
    s = s || lpvDrillSample('choice');
    const { body } = lpvDrillFrame(stage, s.prompt);
    const list = lpvEl('div', 'lpv-options');
    body.appendChild(list);
    (s.options || []).forEach((o, i) => {
      const el = lpvEl('span', 'lpv-option');
      el.appendChild(lpvEl('b', 'lpv-option-key', String(i + 1)));
      el.appendChild(document.createTextNode(o.t));
      if (o.ok) el.dataset.ok = '1';
      list.appendChild(el);
    });
    const cursor = lpvCursor(stage);
    await ctx.wait(700);
    // A moment's hesitation over a wrong one first, the way people actually choose.
    const wrong = list.querySelector('.lpv-option:not([data-ok])');
    const right = list.querySelector('.lpv-option[data-ok]');
    if (wrong && !ctx.still) {
      const sr = stage.getBoundingClientRect(), r = wrong.getBoundingClientRect();
      cursor.style.transform = 'translate(' + (r.left - sr.left + r.width * 0.5) + 'px, ' + (r.top - sr.top + r.height * 0.5) + 'px)';
      await ctx.wait(650);
    }
    await lpvTap(stage, cursor, right, ctx);
    if (right) right.classList.add('is-picked');
    await ctx.wait(350);
    if (right) { right.classList.remove('is-picked'); right.classList.add('is-ok'); }
    await lpvVerdict(stage, cursor, ctx, 'Great job!');
    await ctx.wait(2100);
  },

  async translate(stage, s, ctx) {
    s = s || LPV_FALLBACK.translate;
    const { body } = lpvDrillFrame(stage, s.prompt);
    const box = lpvEl('div', 'lpv-input');
    const text = lpvEl('span', 'lpv-typed');
    box.appendChild(text);
    box.appendChild(lpvEl('i', 'lpv-caret'));
    body.appendChild(box);
    const cursor = lpvCursor(stage);
    await ctx.wait(600);
    await lpvTap(stage, cursor, box, ctx);
    box.classList.add('is-focus');
    cursor.classList.add('is-gone');
    const answer = String(s.answer || '');
    if (ctx.still) text.textContent = answer;
    else {
      for (let i = 0; i < answer.length; i++) {
        text.textContent = answer.slice(0, i + 1);
        await ctx.wait(60 + Math.random() * 70);
      }
    }
    cursor.classList.remove('is-gone');
    await ctx.wait(350);
    box.classList.add('is-ok');
    await lpvVerdict(stage, cursor, ctx, 'You got it!');
    await ctx.wait(2100);
  },

  async match(stage, s, ctx) {
    s = s || LPV_FALLBACK.match;
    const pairs = (s.pairs || []).slice(0, 3);
    const { body } = lpvDrillFrame(stage, 'Match the pairs');
    const grid = lpvEl('div', 'lpv-match');
    const colA = lpvEl('div', 'lpv-match-col'), colB = lpvEl('div', 'lpv-match-col');
    grid.appendChild(colA);
    grid.appendChild(colB);
    body.appendChild(grid);
    pairs.forEach((p, i) => { const el = lpvEl('span', 'lpv-card', p.left); el.dataset.i = i; colA.appendChild(el); });
    lpvShuffle(pairs.map((p, i) => ({ p, i }))).forEach(x => { const el = lpvEl('span', 'lpv-card', x.p.right); el.dataset.i = x.i; colB.appendChild(el); });
    const cursor = lpvCursor(stage);
    await ctx.wait(700);
    for (let i = 0; i < pairs.length; i++) {
      const a = colA.querySelector('[data-i="' + i + '"]');
      const b = colB.querySelector('[data-i="' + i + '"]');
      await lpvTap(stage, cursor, a, ctx);
      a.classList.add('is-picked');
      // Show the mechanic once: a wrong pair shakes and lets go.
      if (i === 0 && pairs.length > 1) {
        const wrongB = colB.querySelector('[data-i="' + (pairs.length - 1) + '"]');
        await lpvTap(stage, cursor, wrongB, ctx);
        a.classList.remove('is-picked');
        a.classList.add('is-bad'); wrongB.classList.add('is-bad');
        await ctx.wait(500);
        a.classList.remove('is-bad'); wrongB.classList.remove('is-bad');
        await lpvTap(stage, cursor, a, ctx);
        a.classList.add('is-picked');
      }
      await lpvTap(stage, cursor, b, ctx);
      a.classList.remove('is-picked');
      a.classList.add('is-ok'); b.classList.add('is-ok');
      await ctx.wait(450);
      a.classList.replace('is-ok', 'is-done'); b.classList.replace('is-ok', 'is-done');
    }
    await lpvVerdict(stage, cursor, ctx, 'All pairs found!');
    await ctx.wait(2100);
  },

  /* The adventure, in miniature: walk the street, somebody stops you, they
     speak, you pick the reply, their bar drains, your maximum grows. Its own
     pixel faces and palette, because the adventure is the one part of this
     library that is a game. */
  async quest(stage, samples, ctx, n) {
    const list = (samples && samples.length) ? samples : LPV_QUEST_FALLBACK;
    const s = list[n % list.length];
    const art = (typeof LANG_SCENE_ART !== 'undefined') ? (LANG_SCENE_ART[s.loc] || LANG_SCENE_ART.street || '') : '';
    const face = typeof lqPortraitFor === 'function' ? lqPortraitFor({ name: s.npc, face: s.face }) : '';
    const loc = typeof langLocation === 'function' ? langLocation(s.loc) : { name: s.loc };
    stage.innerHTML = `
      <div class="lpv-qs">
        <div class="lpv-qs-scene">
          <div class="lpv-qs-art">${art}</div>
          <span class="lpv-qs-tag">${escapeHTML(String(loc.name || '').toUpperCase())}</span>
          <div class="lpv-qs-npc"><span class="lpv-qs-foe"><i></i></span>${face}</div>
          <span class="lpv-qs-toast">+10 MAX STAMINA</span>
        </div>
        <div class="lpv-qs-hud">
          <span>STA</span><b class="lpv-qs-gauge is-sta"><i style="width:72%"></i></b>
          <span>PWR</span><b class="lpv-qs-gauge is-pwr"><i style="width:20%"></i></b>
          <span class="lpv-qs-cmd">RUN</span>
        </div>
        <div class="lpv-qs-box">
          <span class="lpv-qs-name">${escapeHTML(s.npc)}</span>
          <p class="lpv-qs-line"></p>
          <div class="lpv-qs-menu">${s.options.map(o =>
            `<span class="lpv-qs-mi${o.correct ? ' is-right' : ''}">${escapeHTML(o.text)}</span>`).join('')}</div>
        </div>
      </div>`;
    const root = stage.querySelector('.lpv-qs');
    const sta = stage.querySelector('.is-sta i');
    const pwr = stage.querySelector('.is-pwr i');
    const foe = stage.querySelector('.lpv-qs-foe i');
    const line = stage.querySelector('.lpv-qs-line');
    const cmd = stage.querySelector('.lpv-qs-cmd');
    // Walking: the scene pans and stamina ticks down.
    root.classList.add('is-walking');
    cmd.classList.add('is-on');
    await ctx.wait(1300);
    sta.style.width = '64%';
    root.classList.remove('is-walking');
    cmd.classList.remove('is-on');
    // Somebody steps in and speaks.
    root.classList.add('is-met');
    await ctx.wait(600);
    const said = String(s.line || '');
    if (ctx.still) line.textContent = said;
    else for (let i = 0; i < said.length; i++) { line.textContent = said.slice(0, i + 1); await ctx.wait(38); }
    await ctx.wait(500);
    // The replies, and the caret walking down to the right one.
    root.classList.add('is-asking');
    const items = Array.from(stage.querySelectorAll('.lpv-qs-mi'));
    const target = Math.max(0, items.findIndex(x => x.classList.contains('is-right')));
    for (let i = 0; i <= target; i++) {
      items.forEach((x, k) => x.classList.toggle('is-hover', k === i));
      await ctx.wait(420);
    }
    items[target].classList.add('is-chosen');
    await ctx.wait(350);
    root.classList.remove('is-asking');
    root.classList.add('is-hit');
    foe.style.width = '0%';
    pwr.style.width = '55%';
    await ctx.wait(700);
    root.classList.add('is-won');
    sta.style.width = '86%';
    await ctx.wait(1900);
  },

  /* The Dictionary's card: your word, then -- turned over -- what it means. */
  async flip(host, words, ctx, n) {
    const list = (words && words.length) ? words : [{ t: 'salamat', g: 'thank you', d: 'Gratitude.' }];
    const w = list[n % list.length];
    const front = host.querySelector('.lpv-flip-front');
    const back = host.querySelector('.lpv-flip-back');
    const card = host.querySelector('.lpv-flip-card');
    if (!front || !back || !card) throw LPV_STOP;
    card.classList.remove('is-flipped');
    front.innerHTML = `<span class="lpv-flip-lang">${escapeHTML(w.sl || '')}</span><b>${escapeHTML(w.t)}</b>${w.p ? `<em>${escapeHTML(w.p)}</em>` : ''}`;
    back.innerHTML = `<span class="lpv-flip-lang">${escapeHTML(w.rl || '')}</span><b>${escapeHTML(w.g || '—')}</b>${w.d ? `<span class="lpv-flip-def">${escapeHTML(w.d)}</span>` : ''}`;
    await ctx.wait(1900);
    card.classList.add('is-flipped');
    await ctx.wait(2600);
  }
};

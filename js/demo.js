/* ============================================================
   DEMO.JS — the walkthrough that runs before your turn
   ------------------------------------------------------------
   A program's description tells you what to write. It does not show you the
   idea working, and for a thing like pass-by-value that is the whole
   difficulty: the rule is one sentence and it is completely unconvincing until
   you watch the number fail to change.

   So each idea gets a DEMONSTRATION first — a small complete program, walked a
   line at a time, with the output filling in and the variables changing beside
   it. Read it, then it is your turn. Old console RPGs do exactly this: the
   game plays the first battle for you and narrates what it is doing.

   The lessons themselves are in demo-lessons.js. This file is the player: it
   matches a lesson to the program you are about to attempt, remembers which
   ones you have seen, and draws the thing.
   ============================================================ */

const DEMO_SEEN_KEY = 'demoSeenLessons';
const DEMO_AUTO_KEY = 'demoAutoOpen';

/* ── What you have already been shown ─────────────────────── */

function demoSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(DEMO_SEEN_KEY)) || []); }
  catch (e) { return new Set(); }
}

function demoMarkSeen(id) {
  const s = demoSeen();
  if (s.has(id)) return;
  s.add(id);
  try { localStorage.setItem(DEMO_SEEN_KEY, JSON.stringify([...s])); } catch (e) { /* quota */ }
}

function demoForget(id) {
  const s = demoSeen();
  if (id) s.delete(id); else s.clear();
  try { localStorage.setItem(DEMO_SEEN_KEY, JSON.stringify([...s])); } catch (e) { /* quota */ }
}

/** Does a walkthrough open by itself when you start a program? */
function demoAutoEnabled() { return localStorage.getItem(DEMO_AUTO_KEY) !== 'off'; }

function demoSetAuto(on) {
  try { localStorage.setItem(DEMO_AUTO_KEY, on ? 'on' : 'off'); } catch (e) { /* quota */ }
  if (typeof toast === 'function') {
    toast(on ? 'Walkthroughs will open on a new idea.' : 'Walkthroughs stay closed — open one from Show me how.',
      { type: 'info' });
  }
  demoRenderLibrary();
}

function demoAll() { return (typeof DEMO_LESSONS !== 'undefined' ? DEMO_LESSONS : []).slice().sort((a, b) => a.order - b.order); }
function demoById(id) { return demoAll().find(l => l.id === id) || null; }

/* ── Matching a lesson to a program ────────────────────────────
   A program already says what it is about: its minRequirements name the
   constructs it needs, and the folder it sits in is the tier that teaches
   them. Both are authored data, so the link costs nothing to maintain — a new
   program in "0.3 Reading input" gets the scanf walkthrough for free. */

/** Every ancestor folder id of a challenge, nearest first. */
function _demoFolderChain(challenge) {
  const out = [];
  let cur = challenge && challenge.parentId
    ? (state.nodes || []).find(n => n.id === challenge.parentId) : null;
  let guard = 0;
  while (cur && guard++ < 30) {
    out.push(cur.id);
    cur = cur.parentId ? (state.nodes || []).find(n => n.id === cur.parentId) : null;
  }
  return out;
}

/**
 * The constructs a program needs, as plain strings.
 *
 * The pack AUTHORS these as ['printf', 'scanf'] but stores them expanded into
 * {id, type} records, so reading the array straight gave a list of objects
 * that matched nothing. Both shapes are accepted here.
 */
function _demoRequirements(variant) {
  const raw = (variant && variant.minRequirements) || [];
  return raw.map(r => (typeof r === 'string' ? r : (r && (r.type || r.name || r.id)) || ''))
    .filter(Boolean);
}

/**
 * How well a lesson fits this program. 0 means it does not.
 * @returns {number}
 */
function demoScore(lesson, challenge, variant) {
  if (!lesson || !challenge) return 0;
  // An author can name one outright, and that always wins.
  if (challenge.demoId === lesson.id || (variant && variant.demoId === lesson.id)) return 1000;

  let score = 0;
  const m = lesson.match || {};
  const reqs = _demoRequirements(variant);
  const chain = _demoFolderChain(challenge);

  if (m.folders && m.folders.some(f => chain.includes(f))) score += 100;
  if (m.requires && m.requires.length) {
    const hit = m.requires.filter(r => reqs.includes(r)).length;
    // Every requirement present is a strong signal; some of them is a weak one.
    if (hit === m.requires.length) score += 60; else if (hit) score += 20;
  }
  if (m.code) {
    const ref = ((variant && variant.files) || []).map(f => f.code || '').join('\n') || (variant && variant.code) || '';
    if (ref && m.code.test(ref)) score += 30;
  }
  return score;
}

/**
 * The best lesson for this program, or null.
 * @param {object} opts .unseenOnly — for the automatic opening
 */
function demoMatchFor(challenge, variant, opts) {
  const seen = demoSeen();
  let best = null, bestScore = 0;
  demoAll().forEach(lesson => {
    if (opts && opts.unseenOnly && seen.has(lesson.id)) return;
    const s = demoScore(lesson, challenge, variant);
    // Ties break toward the earlier lesson: the course order is the teaching
    // order, so the first idea a program needs is the one to show.
    if (s > bestScore) { best = lesson; bestScore = s; }
  });
  return bestScore >= 50 ? best : null;
}

/** Called from initPractice: show the idea before the attempt, once. */
function demoMaybeAutoOpen(challenge, variant) {
  if (!demoAutoEnabled()) return;
  const lesson = demoMatchFor(challenge, variant, { unseenOnly: true });
  if (!lesson) return;
  // After the screen has settled, so it does not fight the route transition.
  setTimeout(() => demoOpen(lesson.id, { auto: true }), 650);
}

/* ============================================================
   THE PLAYER
   ============================================================ */

const demoState = { id: null, step: 0, keyHandler: null, fromLibrary: false };

function demoOpen(id, opts) {
  const lesson = demoById(id);
  if (!lesson) return;
  demoClose(true);
  demoState.id = id;
  demoState.step = 0;
  demoState.fromLibrary = !!(opts && opts.fromLibrary);

  const ov = document.createElement('div');
  ov.id = 'demo-overlay';
  ov.className = 'demo-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Walkthrough: ' + lesson.title);
  ov.innerHTML = demoShellHTML(lesson, !!(opts && opts.auto));
  document.body.appendChild(ov);
  document.body.classList.add('demo-open');

  demoState.keyHandler = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); demoClose(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); demoNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); demoPrev(); }
  };
  document.addEventListener('keydown', demoState.keyHandler, true);
  ov.addEventListener('click', (e) => { if (e.target === ov) demoClose(); });

  demoRenderStep();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
  const next = document.getElementById('demo-next');
  if (next) next.focus();
}

function demoShellHTML(lesson, auto) {
  return `
    <div class="demo-window">
      <header class="demo-head">
        <div class="demo-head-icon"><i data-lucide="${lesson.icon || 'sparkles'}"></i></div>
        <div class="demo-head-text">
          <h2>${escapeHTML(lesson.title)}</h2>
          <p>${escapeHTML(lesson.tagline || '')}</p>
        </div>
        <div class="demo-head-actions">
          ${auto ? `<button type="button" class="demo-ghost" onclick="demoSetAuto(false);demoClose();"
                title="Stop walkthroughs opening on their own">Don't show these</button>` : ''}
          <button type="button" class="demo-icon-btn" onclick="demoClose()" aria-label="Close the walkthrough">
            <i data-lucide="x"></i>
          </button>
        </div>
      </header>

      <div class="demo-body">
        <div class="demo-code-pane">
          <div class="demo-pane-label"><i data-lucide="file-code-2"></i> ${escapeHTML(lesson.file || 'demo.c')}</div>
          <pre class="demo-code" id="demo-code"></pre>
        </div>
        <div class="demo-side">
          <div class="demo-say" id="demo-say"></div>
          <div class="demo-mem" id="demo-mem"></div>
          <div class="demo-term">
            <div class="demo-pane-label"><i data-lucide="terminal"></i> Output</div>
            <pre class="demo-term-body" id="demo-term"></pre>
          </div>
        </div>
      </div>

      <footer class="demo-foot">
        <div class="demo-dots" id="demo-dots" role="tablist" aria-label="Steps"></div>
        <div class="demo-nav">
          <button type="button" class="btn btn-ghost btn-sm" id="demo-prev" onclick="demoPrev()">
            <i data-lucide="chevron-left"></i> Back
          </button>
          <span class="demo-count" id="demo-count" aria-live="polite"></span>
          <button type="button" class="btn btn-primary btn-sm" id="demo-next" onclick="demoNext()">
            Next <i data-lucide="chevron-right"></i>
          </button>
        </div>
      </footer>
    </div>`;
}

/**
 * The code, with the line this step is on lit up.
 *
 * A step may carry its own `code`, which is how a lesson shows the same
 * program with one thing changed — the missing newline, the `=` that should
 * have been `==`. Seeing the broken version beside the output it really
 * produces is worth more than a sentence warning about it.
 */
function demoCodeHTML(lesson, step) {
  const src = (step && step.code) || lesson.code || '';
  const lines = src.replace(/\t/g, '    ').split('\n');
  const hot = _demoHotLines(step);
  return lines.map((ln, i) => {
    const n = i + 1;
    const on = hot.includes(n);
    const body = typeof syntaxHighlight === 'function' ? syntaxHighlight(ln) : escapeHTML(ln);
    return `<span class="demo-line${on ? ' is-on' : ''}"><span class="demo-ln">${n}</span><span class="demo-lt">${body || '&nbsp;'}</span></span>`;
  }).join('');
}

function _demoHotLines(step) {
  if (!step) return [];
  if (Array.isArray(step.lines)) {
    if (step.lines.length === 2 && step.lines[0] <= step.lines[1]) {
      const out = [];
      for (let i = step.lines[0]; i <= step.lines[1]; i++) out.push(i);
      return out;
    }
    return step.lines;
  }
  return step.line ? [step.line] : [];
}

function demoRenderStep() {
  const lesson = demoById(demoState.id);
  if (!lesson) return;
  const steps = lesson.steps || [];
  const last = demoState.step >= steps.length;
  const step = last ? null : steps[demoState.step];

  const codeEl = document.getElementById('demo-code');
  if (codeEl) {
    codeEl.innerHTML = demoCodeHTML(lesson, step);
    const on = codeEl.querySelector('.demo-line.is-on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const sayEl = document.getElementById('demo-say');
  if (sayEl) {
    /* The last panel is the takeaway, plus whatever builds on this idea. Two
       lessons had no program that could reach them — a walkthrough only the
       shelf knows about is one nobody finds at the moment it would help. */
    const follows = (lesson.next || []).map(demoById).filter(Boolean);
    sayEl.innerHTML = last
      ? `<div class="demo-recap">
           <h3><i data-lucide="flag"></i> Your turn</h3>
           <p>${lesson.recap || ''}</p>
           ${follows.length ? `<div class="demo-next-up">
             <span class="demo-next-label">Builds on this</span>
             ${follows.map(f => `<button type="button" class="demo-next-card" onclick="demoOpen('${f.id}', {fromLibrary:${demoState.fromLibrary}})">
               <i data-lucide="${f.icon || 'sparkles'}"></i>
               <span><strong>${escapeHTML(f.title)}</strong><em>${escapeHTML(f.tagline || '')}</em></span>
               <i data-lucide="arrow-right" class="demo-next-go"></i>
             </button>`).join('')}
           </div>` : ''}
         </div>`
      : `<p>${step.say || ''}</p>`;
    sayEl.classList.remove('demo-fade');
    void sayEl.offsetWidth;          // restart the transition
    sayEl.classList.add('demo-fade');
  }

  // The memory diagram: boxes, arrows between them, and the values that move.
  demoRenderMemory(step, demoState.step > 0 ? steps[demoState.step - 1] : null);
  demoRenderTerminal(steps, demoState.step);

  const dots = document.getElementById('demo-dots');
  if (dots) {
    dots.innerHTML = steps.map((_, i) =>
      `<button type="button" class="demo-dot${i === demoState.step ? ' is-on' : ''}${i < demoState.step ? ' is-done' : ''}"
         onclick="demoGo(${i})" aria-label="Step ${i + 1}"></button>`).join('')
      + `<button type="button" class="demo-dot demo-dot-end${last ? ' is-on' : ''}" onclick="demoGo(${steps.length})" aria-label="Your turn"></button>`;
  }

  const count = document.getElementById('demo-count');
  if (count) count.textContent = last ? 'Done' : `${demoState.step + 1} / ${steps.length}`;
  const prev = document.getElementById('demo-prev');
  if (prev) prev.disabled = demoState.step === 0;
  const next = document.getElementById('demo-next');
  if (next) {
    next.innerHTML = last
      ? (demoState.fromLibrary ? 'Close <i data-lucide="check"></i>' : 'Start the program <i data-lucide="play"></i>')
      : 'Next <i data-lucide="chevron-right"></i>';
  }
  const ov = document.getElementById('demo-overlay');
  if (ov && typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
}

function demoGo(n) {
  const lesson = demoById(demoState.id);
  if (!lesson) return;
  demoState.step = Math.max(0, Math.min(n, (lesson.steps || []).length));
  demoRenderStep();
}

function demoNext() {
  const lesson = demoById(demoState.id);
  if (!lesson) return;
  if (demoState.step >= (lesson.steps || []).length) { demoClose(); return; }
  demoGo(demoState.step + 1);
}

function demoPrev() { demoGo(demoState.step - 1); }

function demoClose(silent) {
  const ov = document.getElementById('demo-overlay');
  if (demoState.keyHandler) {
    document.removeEventListener('keydown', demoState.keyHandler, true);
    demoState.keyHandler = null;
  }
  // Marked as seen however it is closed: skipping is a decision about this
  // lesson, and reopening it is one click away.
  if (!silent && demoState.id) demoMarkSeen(demoState.id);
  if (ov) ov.remove();
  document.body.classList.remove('demo-open');
  const wasLibrary = demoState.fromLibrary;
  demoState.id = null;
  demoState.step = 0;
  demoState.fromLibrary = false;
  if (!silent && wasLibrary) demoOpenLibrary();
  else if (!silent) demoSyncButton();
}

/* ============================================================
   THE LIBRARY OF WALKTHROUGHS
   ------------------------------------------------------------
   Every lesson, always reachable, so a thing you skipped in March is not lost.
   ============================================================ */

function demoOpenLibrary() {
  let ov = document.getElementById('demo-library');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'demo-library';
    ov.className = 'demo-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Walkthroughs');
    document.body.appendChild(ov);
  }
  document.body.classList.add('demo-open');
  ov.onclick = (e) => { if (e.target === ov) demoCloseLibrary(); };
  ov._key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); demoCloseLibrary(); } };
  document.addEventListener('keydown', ov._key, true);
  demoRenderLibrary();
}

function demoRenderLibrary() {
  const ov = document.getElementById('demo-library');
  if (!ov) return;
  const seen = demoSeen();
  const lessons = demoAll();
  const done = lessons.filter(l => seen.has(l.id)).length;

  const groups = {};
  lessons.forEach(l => {
    const g = l.group || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(l);
  });

  ov.innerHTML = `
    <div class="demo-window demo-window-lib">
      <header class="demo-head">
        <div class="demo-head-icon"><i data-lucide="presentation"></i></div>
        <div class="demo-head-text">
          <h2>Walkthroughs</h2>
          <p>${done} of ${lessons.length} seen — every one can be replayed.</p>
        </div>
        <div class="demo-head-actions">
          <label class="demo-switch" title="Open a walkthrough automatically the first time a program needs an idea">
            <input type="checkbox" ${demoAutoEnabled() ? 'checked' : ''} onchange="demoSetAuto(this.checked)">
            <span>Show on a new idea</span>
          </label>
          <button type="button" class="demo-icon-btn" onclick="demoCloseLibrary()" aria-label="Close">
            <i data-lucide="x"></i>
          </button>
        </div>
      </header>
      <div class="demo-lib-body">
        ${Object.keys(groups).map(g => `
          <section class="demo-lib-group">
            <h3>${escapeHTML(g)}</h3>
            <div class="demo-lib-grid">
              ${groups[g].map(l => {
                const isSeen = seen.has(l.id);
                return `
                <button type="button" class="demo-card${isSeen ? ' is-seen' : ''}" onclick="demoOpen('${l.id}', {fromLibrary:true})">
                  <span class="demo-card-icon"><i data-lucide="${l.icon || 'sparkles'}"></i></span>
                  <span class="demo-card-text">
                    <strong>${escapeHTML(l.title)}</strong>
                    <em>${escapeHTML(l.tagline || '')}</em>
                  </span>
                  <span class="demo-card-meta">
                    ${isSeen ? '<i data-lucide="check" class="demo-card-tick"></i>' : ''}
                    <span class="demo-card-steps">${(l.steps || []).length}</span>
                  </span>
                </button>`;
              }).join('')}
            </div>
          </section>`).join('')}
      </div>
      <footer class="demo-foot demo-foot-lib">
        <button type="button" class="btn btn-ghost btn-sm" onclick="demoResetSeen()">
          <i data-lucide="rotate-ccw"></i> Mark all unseen
        </button>
        <span class="demo-foot-hint">A walkthrough opens by itself the first time a program needs an idea you have not met.</span>
      </footer>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
}

function demoCloseLibrary() {
  const ov = document.getElementById('demo-library');
  if (ov) {
    if (ov._key) document.removeEventListener('keydown', ov._key, true);
    ov.remove();
  }
  document.body.classList.remove('demo-open');
  demoSyncButton();
}

function demoResetSeen() {
  demoForget();
  demoRenderLibrary();
  if (typeof toast === 'function') toast('All walkthroughs marked unseen.', { type: 'info' });
}

/* ── The button on the practice screen ─────────────────────────
   It opens THIS program's walkthrough when there is one, and the whole library
   otherwise, so the same control is never a dead end. */

function demoShowForCurrent() {
  const ch = state.activeChallenge, v = state.activeVariant;
  const lesson = ch ? demoMatchFor(ch, v) : null;
  if (lesson) demoOpen(lesson.id);
  else demoOpenLibrary();
}

/** Keep the practice button labelled with what it will actually do. */
function demoSyncButton() {
  const btn = document.getElementById('practice-demo-btn');
  if (!btn) return;
  const ch = state.activeChallenge, v = state.activeVariant;
  const lesson = ch ? demoMatchFor(ch, v) : null;
  const seen = lesson && demoSeen().has(lesson.id);
  btn.classList.toggle('has-demo', !!lesson);
  btn.classList.toggle('is-new', !!(lesson && !seen));
  const label = lesson
    ? (seen ? 'Show me how: ' + lesson.title + ' (seen)' : 'Show me how: ' + lesson.title)
    : 'Walkthroughs';
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

/* ============================================================
   THE MEMORY DIAGRAM
   ------------------------------------------------------------
   The watch used to be a row of name/value chips. That is enough for "i is 3"
   and nowhere near enough for the ideas that actually need demonstrating: a
   pointer is a box holding the location of ANOTHER box, and a row of text
   cannot show the second half of that sentence.

   So the boxes are drawn, and the relationships between them are drawn too —
   an arrow from a pointer to what it points at, and a value that visibly
   travels when it is copied. A step says:

     vars  { 'main · score': '5' }   the boxes, optionally grouped by frame
     ptrs  { p: 'score' }            draw an arrow from p's box to score's
     flow  { from: 'score', to: 'n' } animate a value moving between them

   `vars` is the old shape and still works everywhere it was already used; a
   name containing " · " is split into a frame label and a variable name, which
   upgrades the lessons that already wrote 'main · score' for free.
   ============================================================ */

/** Split 'main · score' into its frame and its name. */
function _demoSplitVar(key) {
  const i = key.indexOf(' · ');
  return i === -1 ? { frame: '', name: key } : { frame: key.slice(0, i), name: key.slice(i + 3) };
}

/** A stable DOM-safe id for a box, so arrows can find it. */
function _demoBoxId(key) {
  return 'demo-box-' + key.replace(/[^A-Za-z0-9]/g, '_');
}

/**
 * Draw the boxes for this step, and animate the difference from the last one.
 * @param {object} step
 * @param {object} prev the step before it, for the diff
 */
function demoRenderMemory(step, prev) {
  const host = document.getElementById('demo-mem');
  if (!host) return;
  const vars = (step && step.vars) || {};
  const keys = Object.keys(vars);

  if (!keys.length) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }
  host.classList.remove('hidden');

  const prevVars = (prev && prev.vars) || {};
  const ptrs = (step && step.ptrs) || {};
  // A pointer's target may be written 'score' or 'main · score'; match either.
  const findKey = (name) => keys.find(k => k === name || _demoSplitVar(k).name === name);

  const frames = [];
  keys.forEach(k => {
    const { frame, name } = _demoSplitVar(k);
    let f = frames.find(x => x.label === frame);
    if (!f) { f = { label: frame, boxes: [] }; frames.push(f); }
    const isNew = !(k in prevVars);
    const changed = !isNew && String(prevVars[k]) !== String(vars[k]);
    f.boxes.push({ key: k, name, value: String(vars[k]), isNew, changed });
  });

  host.innerHTML =
    '<svg class="demo-mem-arrows" id="demo-mem-svg" aria-hidden="true"></svg>'
    + '<div class="demo-mem-frames">'
    + frames.map(f => `
      <div class="demo-frame${f.label ? '' : ' is-bare'}">
        ${f.label ? `<span class="demo-frame-label">${escapeHTML(f.label)}</span>` : ''}
        <div class="demo-frame-boxes">
          ${f.boxes.map(b => `
            <div class="demo-box${b.isNew ? ' is-new' : ''}${b.changed ? ' is-changed' : ''}${ptrs[b.name] ? ' is-ptr' : ''}"
                 id="${_demoBoxId(b.key)}" data-var="${escapeHTML(b.name)}">
              <span class="demo-box-name">${escapeHTML(b.name)}</span>
              <span class="demo-box-val">${escapeHTML(b.value)}</span>
            </div>`).join('')}
        </div>
      </div>`).join('')
    + '</div>';

  // Anything that has just gone out of scope leaves a ghost for a moment,
  // because a variable silently disappearing is the one thing pass-by-value
  // most needs you to notice.
  const gone = Object.keys(prevVars).filter(k => !(k in vars));
  if (gone.length) _demoGhostOut(host, gone, prevVars);

  /* Arrows are measured, not guessed, so the boxes have to be laid out first —
     but NOT through requestAnimationFrame: it does not fire while the document
     is hidden, and the diagram would then have boxes and no arrows between
     them, which is the half that does not teach anything. Reading
     getBoundingClientRect forces the layout we need, right here. */
  _demoDrawArrows(host, ptrs, findKey);
  if (step && step.flow) setTimeout(() => _demoFlow(host, step.flow, findKey), 20);
}

/** An SVG arrow from each pointer's box to the box it points at. */
function _demoDrawArrows(host, ptrs, findKey) {
  const svg = document.getElementById('demo-mem-svg');
  if (!svg) return;
  const names = Object.keys(ptrs);
  const hostBox = host.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, hostBox.width)} ${Math.max(1, hostBox.height)}`);
  svg.style.width = hostBox.width + 'px';
  svg.style.height = hostBox.height + 'px';

  if (!names.length) { svg.innerHTML = ''; return; }

  let defs = `<defs><marker id="demo-arrowhead" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="currentColor"/></marker></defs>`;
  let paths = '';
  names.forEach((from, i) => {
    const fromEl = document.getElementById(_demoBoxId(findKey(from) || from));
    const toName = ptrs[from];
    const toEl = toName === null || toName === undefined
      ? null : document.getElementById(_demoBoxId(findKey(toName) || toName));
    if (!fromEl) return;

    const a = fromEl.getBoundingClientRect();
    const ax = a.left - hostBox.left + a.width / 2;
    const ay = a.top - hostBox.top;

    if (!toEl) {
      // A pointer that points at nothing. NULL is a fact worth drawing rather
      // than leaving as an absence.
      paths += `<text x="${ax}" y="${Math.max(10, ay - 6)}" class="demo-arrow-null" text-anchor="middle">NULL</text>`;
      return;
    }
    const b = toEl.getBoundingClientRect();
    const bx = b.left - hostBox.left + b.width / 2;
    const by = b.top - hostBox.top;

    // Arc over the top of the boxes: the diagram reads left to right, so a
    // line straight through the middle of it would cross whatever sits between.
    const lift = 16 + Math.min(26, Math.abs(bx - ax) * 0.14) + i * 5;
    const midY = Math.min(ay, by) - lift;
    const d = `M ${ax} ${ay - 2} C ${ax} ${midY}, ${bx} ${midY}, ${bx} ${by - 2}`;
    paths += `<path class="demo-arrow" d="${d}" marker-end="url(#demo-arrowhead)"/>`;
  });
  svg.innerHTML = defs + paths;
}

/**
 * A value visibly travelling from one box to another.
 *
 * This is the whole of pass-by-value in one gesture: you SEE the 5 leave score
 * and arrive in n, and that the thing that arrived is a second 5.
 */
function _demoFlow(host, flow, findKey) {
  if (typeof vizPrefersReducedMotion === 'function' && vizPrefersReducedMotion()) return;
  const fromEl = document.getElementById(_demoBoxId(findKey(flow.from) || flow.from));
  const toEl = document.getElementById(_demoBoxId(findKey(flow.to) || flow.to));
  if (!fromEl || !toEl) return;

  const hostBox = host.getBoundingClientRect();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();

  const chip = document.createElement('span');
  chip.className = 'demo-flow-chip';
  chip.textContent = flow.label !== undefined ? flow.label
    : (fromEl.querySelector('.demo-box-val') || {}).textContent || '';
  chip.style.left = (a.left - hostBox.left + a.width / 2) + 'px';
  chip.style.top = (a.top - hostBox.top + a.height / 2) + 'px';
  host.appendChild(chip);

  const dx = (b.left - a.left) + (b.width - a.width) / 2;
  const dy = (b.top - a.top) + (b.height - a.height) / 2;
  // One frame at the start position, then the move — a timeout rather than a
  // rAF for the same reason the arrows are drawn directly.
  setTimeout(() => {
    chip.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    chip.style.opacity = '0.15';
  }, 30);
  setTimeout(() => chip.remove(), 760);
}

/** A box that has just gone out of scope, fading where it stood. */
function _demoGhostOut(host, gone, prevVars) {
  const frames = host.querySelector('.demo-mem-frames');
  if (!frames) return;
  const wrap = document.createElement('div');
  wrap.className = 'demo-frame is-gone';
  wrap.innerHTML = '<span class="demo-frame-label">gone</span><div class="demo-frame-boxes">'
    + gone.map(k => {
      const { name } = _demoSplitVar(k);
      return `<div class="demo-box is-gone">
        <span class="demo-box-name">${escapeHTML(name)}</span>
        <span class="demo-box-val">${escapeHTML(String(prevVars[k]))}</span>
      </div>`;
    }).join('') + '</div>';
  frames.appendChild(wrap);
  setTimeout(() => wrap.remove(), 900);
}

/* ── The terminal ──────────────────────────────────────────────
   New output is marked as it arrives rather than the whole block swapping, so
   you can see WHICH line this step produced. */
function demoRenderTerminal(steps, index) {
  const termEl = document.getElementById('demo-term');
  if (!termEl) return;
  let out = '', before = '';
  for (let i = 0; i <= Math.min(index, steps.length - 1); i++) {
    if (steps[i] && steps[i].out !== undefined) { before = out; out = steps[i].out; }
  }
  if (!out) { termEl.innerHTML = '<span class="demo-term-idle">nothing yet</span>'; return; }

  const paint = (s) => escapeHTML(s).replace(/‸([^‸]*)‸/g, '<span class="demo-typed">$1</span>');
  // Only the tail is new, and only when this step actually added to it.
  const added = (before && out.startsWith(before)) ? out.slice(before.length) : '';
  termEl.innerHTML = added
    ? paint(out.slice(0, out.length - added.length)) + '<span class="demo-out-new">' + paint(added) + '</span>'
    : paint(out);
  const fresh = termEl.querySelector('.demo-out-new');
  if (fresh) setTimeout(() => fresh.classList.remove('demo-out-new'), 900);
  termEl.scrollTop = termEl.scrollHeight;
}

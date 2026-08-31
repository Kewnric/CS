/* ============================================================
   EDITOR-FX.JS — the combo animation, on the code you type
   ------------------------------------------------------------
   Letters land when you type them and are thrown away when you delete them,
   the same movement the combo chip uses.

   THE PROBLEM. You cannot animate a character inside a <textarea> — it has no
   per-character DOM at all — and the highlighted <pre> underneath it is
   rebuilt on every keystroke, so anything animating in there is destroyed
   before it finishes. Both layers are unusable for this.

   THE WAY ROUND IT. A third layer over the top holding GHOSTS: a copy of the
   character, absolutely positioned, which animates and removes itself. The
   editor never knows. A ghost outlives the re-render that follows it, and
   nothing here can affect the text.

   Positioning is the part that is usually horrible — measuring a caret in a
   textarea normally means cloning it into a mirror div and measuring that.
   Not needed here: #editor-pre already renders the same string in the same
   font at the same place, so a Range over the character in the pre gives its
   exact box. The highlighter is doing the layout work for us.

   THE LAYER LIVES INSIDE #editor-pre, which is the element that scrolls, and
   positions are stored relative to its CONTENT rather than to the viewport.
   That is what makes a ghost stay with its character: it used to sit in a
   non-scrolling wrapper with a position fixed at spawn, so scrolling during
   the 300ms it was alive left it stranded, and typing at the foot of a long
   file — which scrolls the editor as you go — could place it against a view
   that had already moved.
   ============================================================ */

const EDFX_KEY = 'ssp.editorFx';

/* Typing fast should not pile up hundreds of nodes. Past this many at once
   the oldest are dropped — a ghost is 600ms of decoration, and losing one
   under a burst of typing is invisible. */
const EDFX_MAX = 28;

/* The two animation lengths, matching css/editor-fx.css. Duplicated here only
   to bound how long a ghost may live -- see the release in _edfxSpawn. */
const EDFX_IN_MS = 340;
const EDFX_OUT_MS = 620;

/* What the editor inserts on its own when you type an opener. */
const EDFX_PAIRS = { '()': 1, '[]': 1, '{}': 1, '""': 1, "''": 1, '``': 1 };

/* ── The lean ─────────────────────────────────────────────────
   Each landing letter arrives at its own angle, and the angles walk a sine
   around zero: lean one way, come upright, lean the other, come back. A run
   of characters all tilting by the same amount reads as a mechanism running;
   a run that varies reads as handwriting.

   A sine and not a random angle per letter. Random neighbours disagree with
   each other and the line looks scattered, where a wave means any two letters
   next to each other are nearly parallel and the drift only shows across a
   word. STEPS is the period in characters -- long enough that the change is
   a drift rather than a wobble, short enough to come round within a line. */
const EDFX_TILT_MAX = 15;      // degrees at the extremes of the sweep
const EDFX_TILT_STEPS = 14;    // characters per full sweep
let _edfxTiltStep = 0;

/** The angle for the next landing letter, walking the sweep on each call. */
function _edfxNextTilt() {
  const deg = EDFX_TILT_MAX * Math.sin((2 * Math.PI * _edfxTiltStep) / EDFX_TILT_STEPS);
  _edfxTiltStep = (_edfxTiltStep + 1) % EDFX_TILT_STEPS;
  return deg;
}

/* -- Not painting the character twice ------------------------
   A ghost is the character while it is moving. The <pre> underneath is
   painting that same character all along, so a landing letter was really two
   letters: a big tilted one settling, over a small straight one that was
   already home. That is the doubling.

   So the character below is made invisible for as long as its ghost is in
   flight -- `visibility: hidden`, which keeps its box, so nothing reflows and
   the measurement the ghost was positioned from stays true. The ghost ends at
   exactly that character's size, angle, position and colour, and is removed
   in the same task that reveals it, so the swap has nothing to show.

   The <pre> is rebuilt from innerHTML on every keystroke, which throws these
   away, so they are re-applied after each repaint from the list below rather
   than trusted to survive.

   Each entry remembers WHICH character it is hiding, and a hole is only
   punched where that character still is. Between an edit and the repaint an
   offset can go stale -- and hiding the wrong character is worse than briefly
   painting one twice. */
let _edfxHoles = [];       // { off, ch } for every ghost in flight
let _edfxPrevLen = -1;

/** Has this reader asked for less motion? Then there are no ghosts at all. */
function _edfxMotionOk() {
  try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return true; }
}

/**
 * Slide the holes past an edit, so they keep pointing at their own character.
 * Same rule as the fold anchors: the caret sits at the end of what changed, so
 * the change began at `caret - delta` for an insert and at `caret` for a
 * delete, and everything at or after that moved by delta.
 */
function _edfxShiftHoles(ta) {
  const len = ta.value.length;
  const delta = _edfxPrevLen < 0 ? 0 : len - _edfxPrevLen;
  _edfxPrevLen = len;
  if (!delta || !_edfxHoles.length) return;
  const from = ta.selectionStart - Math.max(delta, 0);
  _edfxHoles.forEach(h => { if (h.off >= from) h.off += delta; });
}

/** Hide the one character at `off`, if that is still the character there. */
function _edfxPunch(code, off, ch) {
  const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let seen = 0, n;
  while ((n = walk.nextNode())) {
    const len = n.nodeValue.length;
    if (seen + len > off) {
      const local = off - seen;
      if (n.nodeValue.charAt(local) !== ch) return;      // moved; leave it alone
      try {
        const r = document.createRange();
        r.setStart(n, local);
        r.setEnd(n, local + 1);
        const span = document.createElement('span');
        span.className = 'edfx-hole';
        r.surroundContents(span);
      } catch (e) { /* the range crossed a tag; not worth forcing */ }
      return;
    }
    seen += len;
  }
}

/** Re-hide exactly the characters that have a ghost in flight, and no others. */
function _edfxApplyHoles() {
  const code = document.getElementById('editor-code');
  if (!code) return;
  code.querySelectorAll('.edfx-hole').forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
  if (!_edfxHoles.length) return;
  code.normalize();                       // one text node per run again
  _edfxHoles.forEach(h => _edfxPunch(code, h.off, h.ch));
}

let _edfxPending = null;   // the character a keydown is about to remove
let _edfxLive = [];
let _edfxComposing = false;

/** On unless it has been switched off. */
function edfxEnabled() {
  try { return localStorage.getItem(EDFX_KEY) !== '0'; } catch (e) { return true; }
}

function edfxRouteWants() {
  const r = document.body.dataset.route;
  return r === 'practice' || r === 'practice-set';
}

/** The layer the ghosts live in — inside the pre, so it scrolls with it. */
function _edfxLayer() {
  const pre = document.getElementById('editor-pre');
  if (!pre) return null;
  let layer = document.getElementById('editor-fx');
  if (!layer || layer.parentElement !== pre) {
    if (layer) layer.remove();
    layer = document.createElement('div');
    layer.id = 'editor-fx';
    layer.className = 'editor-fx';
    layer.setAttribute('aria-hidden', 'true');
    pre.appendChild(layer);
  }
  return layer;
}

/**
 * Where character `offset` sits, in pixels, relative to the ghost layer.
 *
 * Walks the pre's text nodes to find the one containing that offset, then
 * measures a Range over the single character. Returns null when the offset is
 * off the end or the pre has not caught up yet, and the caller simply skips
 * the effect — a missing flourish is not worth a thrown error.
 */
function _edfxCharBox(offset) {
  const code = document.getElementById('editor-code');
  const layer = _edfxLayer();
  if (!code || !layer) return null;

  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let seen = 0, node = null, local = 0;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length;
    if (seen + len > offset) { local = offset - seen; break; }
    seen += len;
  }
  if (!node) return null;

  try {
    const r = document.createRange();
    r.setStart(node, local);
    r.setEnd(node, Math.min(local + 1, node.nodeValue.length));
    const box = r.getBoundingClientRect();
    const pre = document.getElementById('editor-pre');
    if (!pre) return null;
    const host = pre.getBoundingClientRect();
    if (!box.width && !box.height) return null;
    /* Content coordinates, not viewport ones: the scroll offset is added back
       so the number stays true however the pane is scrolled afterwards. The
       ghost sits in the scrolling box, so it travels with the text. */
    /* The colour the highlighter gave this character, taken from the very
       span it lives in. A ghost of a keyword is the keyword's blue, a ghost
       inside a string is the string's green: the copy looks like the thing it
       is a copy of, instead of every character flashing the same white.

       Read here rather than worked out from the token type, because that
       decision has already been made -- by syntax.js, in the element under
       this Range -- and re-deriving it would be a second opinion to keep in
       step with the first. */
    const owner = node.parentElement;
    return {
      x: box.left - host.left + pre.scrollLeft,
      y: box.top - host.top + pre.scrollTop,
      h: box.height,
      color: owner ? getComputedStyle(owner).color : ''
    };
  } catch (e) {
    return null;
  }
}

function _edfxSpawn(ch, box, cls, delay, off) {
  const layer = _edfxLayer();
  if (!layer || !box) return;
  const g = document.createElement('span');
  g.className = 'edfx-ghost ' + cls;
  g.textContent = ch;
  g.style.left = box.x + 'px';
  g.style.top = box.y + 'px';
  g.style.lineHeight = box.h + 'px';
  if (delay) g.style.animationDelay = delay + 'ms';
  /* Landing wears the character's own syntax colour. Deleting keeps its amber,
     which is a signal rather than a likeness -- it says the character is being
     thrown away, and the colour it used to be is not the point. */
  if (cls === 'edfx-in') {
    if (box.color) g.style.color = box.color;
    g.style.setProperty('--tilt', _edfxNextTilt().toFixed(2) + 'deg');
  }

  if (cls === 'edfx-out') {
    // Same scatter the combo uses: outward drift, mostly downward, its own
    // spin. Seeded per ghost so a deleted word never comes apart twice alike.
    g.style.setProperty('--dx', ((Math.random() - 0.5) * 2.4).toFixed(2) + 'em');
    g.style.setProperty('--dy', (Math.random() < 0.3
      ? -(0.5 + Math.random()) : (1.1 + Math.random() * 1.6)).toFixed(2) + 'em');
    g.style.setProperty('--rot', ((Math.random() - 0.5) * 240).toFixed(0) + 'deg');
    g.style.setProperty('--sc', (0.7 + Math.random() * 0.4).toFixed(2));
  }

  layer.appendChild(g);
  _edfxLive.push(g);
  /* Only now, with a ghost actually on screen to stand in for it, is the real
     character hidden. Punching the hole first would leave the character
     invisible with nothing in its place if anything below failed. */
  if (cls === 'edfx-in' && off != null) {
    g._edfxHole = { off: off, ch: ch };
    _edfxHoles.push(g._edfxHole);
    _edfxApplyHoles();
  }
  while (_edfxLive.length > EDFX_MAX) {
    const old = _edfxLive.shift();
    if (old && old.parentElement) old.remove();
    if (old && old._edfxHole) {
      _edfxHoles = _edfxHoles.filter(h => h !== old._edfxHole);
      old._edfxHole = null;
    }
  }
  const done = () => {
    g.remove();
    _edfxLive = _edfxLive.filter(x => x !== g);
    // The ghost has finished on top of the character it was standing in for,
    // at the same size and angle and colour, so revealing it in the same task
    // that removes the ghost is a swap with nothing to see.
    if (g._edfxHole) {
      _edfxHoles = _edfxHoles.filter(h => h !== g._edfxHole);
      g._edfxHole = null;
      _edfxApplyHoles();
    }
  };
  /* Three ways to finish, because one of them is not reliable and a ghost
     that never finishes now means a character that never comes back.

     animationend is the prompt one, and it does not fire at all while the
     page is not being rendered -- a background tab, a hidden pane. The
     animation still completes on the timeline, so `finished` resolves where
     the event does not; that is the one that actually guarantees the letter
     is handed back. The timeout is the last resort for a ghost whose layer is
     torn down mid-flight, and it is now the animation's own length rather
     than a flat 1400ms: with the character underneath hidden, that was how
     long text could be missing for.

     `done` is idempotent, so whichever arrives first simply wins. */
  g.addEventListener('animationend', done, { once: true });
  const running = g.getAnimations()[0];
  if (running && running.finished) running.finished.then(done, () => {});
  setTimeout(done, (cls === 'edfx-out' ? EDFX_OUT_MS : EDFX_IN_MS) + 120);
}

/* ── Typing ───────────────────────────────────────────────────
   The real character is already on screen by the time this runs, so the
   ghost is a flourish laid over it: it lands, and the copy fades as it
   settles. The leading-letter-is-bigger look comes from the same place it
   does in the combo — each ghost starts oversized and shrinks, so whichever
   arrived last is the largest thing on screen.
   ------------------------------------------------------------ */
function edfxTyped(ta, back) {
  if (!edfxEnabled() || !edfxRouteWants() || !_edfxMotionOk()) return;
  // Before anything else: the edit that just happened moved the characters
  // the ghosts already in flight are standing in for.
  _edfxShiftHoles(ta);
  // `back` steps away from the caret, for a pair whose caret sits between the
  // two characters rather than after them.
  const at = ta.selectionStart - (back || 1);
  if (at < 0) return;
  const ch = ta.value.charAt(at);
  if (!ch || ch === '\n') return;              // a newline has nothing to draw
  /* Deferred so the highlighter has repainted before the Range measures it:
     this listener is on the capture phase and runs before the editor own one.

     setTimeout and not requestAnimationFrame, which was the first thing tried
     and is wrong. rAF is PAUSED on a hidden page, so its callbacks queue
     rather than run. Type, switch tab, come back, and the whole backlog fires
     at once, spawning a burst of ghosts positioned from text that has since
     moved. A zero timeout still runs after the current task, so the repaint is
     just as done, and it behaves the same whether or not anyone is looking. */
  setTimeout(() => {
    // The repaint threw every hole away; put back the ones still in flight.
    _edfxApplyHoles();
    const box = _edfxCharBox(at);
    if (box) _edfxSpawn(ch === ' ' ? ' ' : ch, box, 'edfx-in', 0, at);
  }, 0);
}

/* ── Deleting ─────────────────────────────────────────────────
   Measured BEFORE the delete, because afterwards the character is gone from
   the pre and there is nothing left to measure. Holding backspace spawns one
   ghost per character as the run proceeds, which comes out as the word
   coming apart from the right — the same shape as the combo's exit, just
   driven by how fast you are deleting rather than by a fixed stagger.
   ------------------------------------------------------------ */
function edfxWillDelete(ta) {
  if (!edfxEnabled() || !edfxRouteWants() || !_edfxMotionOk()) { _edfxPending = null; return; }
  if (ta.selectionStart !== ta.selectionEnd) { _edfxPending = null; return; }  // a selection, not one char
  const at = ta.selectionStart - 1;
  if (at < 0) { _edfxPending = null; return; }
  const ch = ta.value.charAt(at);
  if (!ch || ch === '\n') { _edfxPending = null; return; }
  const box = _edfxCharBox(at);
  _edfxPending = box ? { ch: ch === ' ' ? ' ' : ch, box } : null;
}

function edfxDeleted() {
  if (!_edfxPending) return;
  _edfxSpawn(_edfxPending.ch, _edfxPending.box, 'edfx-out');
  _edfxPending = null;
}

/**
 * Drop everything and forget it.
 *
 * Called when the editor goes away. Without this the live list went on
 * holding ghosts whose layer had already been destroyed with the route —
 * measured at two detached nodes after navigating away. The 1400ms sweep
 * would have released them eventually, so it was bounded rather than a true
 * leak, but holding detached DOM for a second after every visit to the
 * editor is untidy for something this cheap to get right.
 */
function edfxReset() {
  _edfxLive.forEach(g => { if (g && g.parentElement) g.remove(); });
  _edfxLive = [];
  _edfxPending = null;
  _edfxComposing = false;
  // A new file starts the sweep at level, so the first letter you type is not
  // arbitrarily mid-lean.
  _edfxTiltStep = 0;
  // Every hidden character comes back, whatever state its ghost was in.
  _edfxHoles = [];
  _edfxPrevLen = -1;
  _edfxApplyHoles();
}

/* ── Wiring ───────────────────────────────────────────────────
   One delegated pair on the document rather than a hook inside the editor's
   own handler set: the editor is attached and detached per file tab, and this
   should not have to be re-bound each time. Capture phase so a handler that
   stops propagation cannot mute it.
   ------------------------------------------------------------ */
document.addEventListener('keydown', function (e) {
  const ta = e.target;
  if (!ta || ta.id !== 'editor-textarea') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Backspace') edfxWillDelete(ta);
  else _edfxPending = null;
}, true);

document.addEventListener('compositionstart', function (e) {
  if (e.target && e.target.id === 'editor-textarea') _edfxComposing = true;
}, true);

document.addEventListener('compositionend', function (e) {
  if (e.target && e.target.id === 'editor-textarea') _edfxComposing = false;
}, true);

/* The editor is rebuilt per route, so its ghosts should not outlive it. */
new MutationObserver(() => {
  if (!document.getElementById('editor-textarea') && _edfxLive.length) edfxReset();
}).observe(document.body, { attributes: true, attributeFilter: ['data-route'] });

document.addEventListener('input', function (e) {
  const ta = e.target;
  if (!ta || ta.id !== 'editor-textarea') return;
  if (e.inputType === 'deleteContentBackward') { edfxDeleted(); return; }
  _edfxPending = null;
  // Only single characters. A paste or an autocomplete insert would spawn a
  // ghost per character of a whole block, which is a snowstorm.
  if (e.inputType && e.inputType.indexOf('insert') !== 0) return;
  /* A pair counts as one keystroke. The editor answers ( with () in a single
     two-character insert, so the blanket "longer than one character is a
     paste" rule threw away exactly the punctuation you had just typed —
     brackets and quotes were the only keys in the file that drew nothing.
     Only the character YOU pressed gets a ghost; the auto-closed partner
     appears without ceremony, because you did not type it. */
  if (e.data && e.data.length > 1) {
    if (!EDFX_PAIRS[e.data]) return;
    edfxTyped(ta, 1);
    return;
  }
  /* Not while composing. An IME fires insertCompositionText on every keystroke
     of a composition, so typing one Japanese character spawned a ghost for
     each intermediate romaji state and then another for the committed result.
     The commit arrives as insertFromComposition or insertText, which is the
     one worth drawing. */
  if (_edfxComposing || e.inputType === 'insertCompositionText') return;
  edfxTyped(ta);
}, true);

/* ── The toggle ───────────────────────────────────────────── */

function toggleEditorFx() {
  const next = !edfxEnabled();
  try { localStorage.setItem(EDFX_KEY, next ? '1' : '0'); } catch (e) { /* private mode */ }
  if (!next) {
    _edfxLive.forEach(g => g.remove());
    _edfxLive = [];
  }
  _syncEditorFxBtn();
  if (typeof toast === 'function') {
    toast(next ? 'Letter animation on' : 'Letter animation off', { type: 'info', duration: 1800 });
  }
}

function _syncEditorFxBtn() {
  const on = edfxEnabled();
  const label = on ? 'Letter animation on' : 'Letter animation off';
  const btn = document.getElementById('editor-fx-btn');
  if (!btn) return;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(on));
  btn.style.color = on ? 'var(--color-primary)' : '';
  const icon = btn.querySelector('[data-lucide], svg');
  if (typeof _setLucideIcon === 'function') _setLucideIcon(icon, on ? 'sparkles' : 'sparkle');
}

/** Sits beside the typing-sound toggle — both are the same kind of switch. */
function editorFxButtonTemplate() {
  const on = edfxEnabled();
  const label = on ? 'Letter animation on' : 'Letter animation off';
  return `
    <button class="btn btn-ghost practice-icon-btn" onclick="toggleEditorFx()"
            title="${label}" id="editor-fx-btn" aria-label="${label}" aria-pressed="${on}"
            style="${on ? 'color:var(--color-primary);' : ''}">
      <i data-lucide="${on ? 'sparkles' : 'sparkle'}" style="width:16px;height:16px;" aria-hidden="true"></i>
    </button>`;
}

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
   ============================================================ */

const EDFX_KEY = 'ssp.editorFx';

/* Typing fast should not pile up hundreds of nodes. Past this many at once
   the oldest are dropped — a ghost is 600ms of decoration, and losing one
   under a burst of typing is invisible. */
const EDFX_MAX = 28;

let _edfxPending = null;   // the character a keydown is about to remove
let _edfxLive = [];

/** On unless it has been switched off. */
function edfxEnabled() {
  try { return localStorage.getItem(EDFX_KEY) !== '0'; } catch (e) { return true; }
}

function edfxRouteWants() {
  const r = document.body.dataset.route;
  return r === 'practice' || r === 'practice-set';
}

/** The layer the ghosts live in, made once per editor mount. */
function _edfxLayer() {
  const pre = document.getElementById('editor-pre');
  if (!pre || !pre.parentElement) return null;
  let layer = document.getElementById('editor-fx');
  if (!layer || layer.parentElement !== pre.parentElement) {
    layer = document.createElement('div');
    layer.id = 'editor-fx';
    layer.className = 'editor-fx';
    layer.setAttribute('aria-hidden', 'true');
    pre.parentElement.appendChild(layer);
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
    const host = layer.getBoundingClientRect();
    if (!box.width && !box.height) return null;
    /* The token's own colour comes back with the position. We are already
       standing on the exact text node the highlighter painted, so a keyword
       ghost is keyword-coloured and a string ghost is string-coloured — the
       copy matches the character it stands for instead of being told what to
       be. */
    const owner = node.parentElement;
    const colour = owner ? getComputedStyle(owner).color : '';
    return { x: box.left - host.left, y: box.top - host.top, h: box.height, colour: colour };
  } catch (e) {
    return null;
  }
}

function _edfxSpawn(ch, box, cls, delay) {
  const layer = _edfxLayer();
  if (!layer || !box) return;
  const g = document.createElement('span');
  g.className = 'edfx-ghost ' + cls;
  g.textContent = ch;
  g.style.left = box.x + 'px';
  g.style.top = box.y + 'px';
  g.style.lineHeight = box.h + 'px';
  if (box.colour) g.style.color = box.colour;
  if (delay) g.style.animationDelay = delay + 'ms';

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
  while (_edfxLive.length > EDFX_MAX) {
    const old = _edfxLive.shift();
    if (old && old.parentElement) old.remove();
  }
  const done = () => { g.remove(); _edfxLive = _edfxLive.filter(x => x !== g); };
  g.addEventListener('animationend', done, { once: true });
  // A belt-and-braces sweep: if the layer is torn down mid-flight the
  // animationend never fires and the node would leak.
  setTimeout(done, 1400);
}

/* ── Typing ───────────────────────────────────────────────────
   The real character is already on screen by the time this runs, so the
   ghost is a flourish laid over it: it lands, and the copy fades as it
   settles. The leading-letter-is-bigger look comes from the same place it
   does in the combo — each ghost starts oversized and shrinks, so whichever
   arrived last is the largest thing on screen.
   ------------------------------------------------------------ */
function edfxTyped(ta) {
  if (!edfxEnabled() || !edfxRouteWants()) return;
  const at = ta.selectionStart - 1;
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
    const box = _edfxCharBox(at);
    if (box) _edfxSpawn(ch === ' ' ? ' ' : ch, box, 'edfx-in');
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
  if (!edfxEnabled() || !edfxRouteWants()) { _edfxPending = null; return; }
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

document.addEventListener('input', function (e) {
  const ta = e.target;
  if (!ta || ta.id !== 'editor-textarea') return;
  if (e.inputType === 'deleteContentBackward') { edfxDeleted(); return; }
  _edfxPending = null;
  // Only single characters. A paste or an autocomplete insert would spawn a
  // ghost per character of a whole block, which is a snowstorm.
  if (e.inputType && e.inputType.indexOf('insert') !== 0) return;
  if (e.data && e.data.length > 1) return;
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

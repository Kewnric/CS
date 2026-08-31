/* ============================================================
   BRACKETS.JS — highlight the pair the caret is sitting on
   ------------------------------------------------------------
   Put the caret on a `(`, `[` or `{` and both it and its partner get a
   background, so you can see at a glance which one closes which. The editor
   is a transparent <textarea> over a highlighted <pre>, and a textarea cannot
   colour one of its own characters — so, exactly like the fold badges, these
   are absolutely positioned boxes drawn inside the <pre>. Nothing here ever
   touches the text, which is what keeps a display feature from being able to
   corrupt the file.

   Brackets inside strings, char literals and comments are not code and are
   skipped on both sides: the caret on the `{` in printf("{") matches nothing,
   and a real `{` never pairs with one quoted three lines down.
   ============================================================ */

const ED_BR_OPEN = '([{';
const ED_BR_CLOSE = ')]}';

/**
 * Which characters of `text` are code — 1 — and which are inside a string,
 * char literal or comment — 0.
 *
 * A byte array rather than a scan-from-the-caret, because matching has to skip
 * quoted brackets while counting depth, and that means knowing about every
 * position between the two ends, not just the two ends.
 */
function _edCodeMask(text) {
  const n = text.length;
  const mask = new Uint8Array(n);
  let i = 0, inBlock = false, inLine = false, inStr = '';
  while (i < n) {
    const c = text[i], d = text[i + 1];
    if (inLine) { if (c === '\n') inLine = false; i++; continue; }
    if (inBlock) { if (c === '*' && d === '/') { inBlock = false; i += 2; continue; } i++; continue; }
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      // An unterminated quote ends at the newline rather than eating the rest
      // of the file — half-typed code is the normal state of an editor.
      if (c === '\n' || c === inStr) inStr = '';
      i++; continue;
    }
    if (c === '/' && d === '/') { inLine = true; i += 2; continue; }
    if (c === '/' && d === '*') { inBlock = true; i += 2; continue; }
    if (c === '"' || c === "'") { inStr = c; i++; continue; }
    mask[i] = 1;
    i++;
  }
  return mask;
}

/**
 * The bracket pair the caret is on, or null.
 *
 * The caret is a gap between characters, so it touches two of them. The one
 * it is in front of wins, then the one behind it — which is what makes typing
 * a closing bracket flash the opener it just completed.
 *
 * @returns {{open:number, close:number}|null} indices into `text`
 */
function edBracketMatch(text, caret) {
  if (!text) return null;
  const mask = _edCodeMask(text);
  const at = (i) => {
    if (i < 0 || i >= text.length || !mask[i]) return null;
    const c = text[i];
    const o = ED_BR_OPEN.indexOf(c);
    if (o >= 0) {
      const close = ED_BR_CLOSE[o];
      for (let j = i, depth = 0; j < text.length; j++) {
        if (!mask[j]) continue;
        if (text[j] === c) depth++;
        else if (text[j] === close && --depth === 0) return { open: i, close: j };
      }
      return null;
    }
    const k = ED_BR_CLOSE.indexOf(c);
    if (k >= 0) {
      const open = ED_BR_OPEN[k];
      for (let j = i, depth = 0; j >= 0; j--) {
        if (!mask[j]) continue;
        if (text[j] === c) depth++;
        else if (text[j] === open && --depth === 0) return { open: j, close: i };
      }
      return null;
    }
    return null;
  };
  return at(caret) || at(caret - 1);
}

/**
 * Draw the pair, or clear what was drawn.
 *
 * Only ever an overlay: the boxes are removed and rebuilt each time rather
 * than tracked, because the thing underneath them — the highlighted <pre> — is
 * itself rebuilt on every keystroke.
 */
function edPaintBrackets(ta, preEl) {
  const pre = preEl || document.getElementById('editor-pre');
  if (!pre) return;
  pre.querySelectorAll('.ed-bracket-hit').forEach(el => el.remove());
  if (!ta || document.activeElement !== ta) return;
  // A selection already shows its own extent; a second highlight inside it
  // reads as a second selection.
  if (ta.selectionStart !== ta.selectionEnd) return;
  // Wrapped lines break the one-row-per-line arithmetic these boxes are placed
  // with, the same way they do for the fold badges.
  if (typeof edGetWrap === 'function' && edGetWrap()) return;

  /* Matched against the COMPLETE file, not what is on screen.

     A folded block's own closing brace is parked, so in the view the `{` of a
     folded `} else {` has no partner left — and the search would run on past
     it to the next unmatched `}` it can see, which is main's, several blocks
     below. Highlighting that says the two are a pair when they are not.

     So the caret goes out to file coordinates, the match happens there, and
     the two ends come back. If either end is inside a fold it has no place on
     screen to be drawn, and nothing is highlighted rather than something
     misleading. */
  const full = (typeof edFullSource === 'function') ? edFullSource(ta) : ta.value;
  const caret = (typeof edViewOffsetToFull === 'function')
    ? edViewOffsetToFull(ta, ta.selectionStart) : ta.selectionStart;
  const hit = edBracketMatch(full, caret);
  if (!hit) return;

  const ends = (typeof edFullOffsetToView === 'function')
    ? [edFullOffsetToView(ta, hit.open), edFullOffsetToView(ta, hit.close)]
    : [hit.open, hit.close];
  if (ends.some(i => i < 0)) return;              // a partner is inside a fold

  // Both ends measured where they are actually drawn, so a bold keyword or a
  // tab earlier in the line cannot walk the box off its character.
  const rects = ends.map(edCharRect);
  if (rects.some(r => !r)) return;

  const frag = document.createDocumentFragment();
  rects.forEach(r => {
    const box = document.createElement('div');
    box.className = 'ed-bracket-hit';
    box.style.top = r.top + 'px';
    box.style.left = r.left + 'px';
    box.style.width = (r.right - r.left) + 'px';
    box.style.height = r.height + 'px';
    frag.appendChild(box);
  });
  pre.appendChild(frag);
}

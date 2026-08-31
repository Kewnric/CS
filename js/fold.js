/* ============================================================
   FOLD.JS — collapse brace blocks in the editor, VS Code style
   ------------------------------------------------------------
   The editor is a transparent <textarea> laid over a highlighted
   <pre>. A textarea cannot hide one of its own rows, so a fold here
   genuinely removes the block's text from the textarea and parks it
   in this module until you expand it again.

   That makes this file the only thing between the user and lost
   code, so two rules hold throughout:

     1. Only the VIEW ever loses text. edFullSource() always returns
        the whole file, and every consumer of the code — Run, Check,
        Finish, autosave, the boss bar — reads through it.
     2. The moment a fold's anchor stops making sense (you edited it
        away, deleted the line, pasted over it), the parked text goes
        straight back into the buffer instead of being held longer.

   Known trade-off: applying or releasing a fold assigns to
   textarea.value, which resets the browser's native undo stack for
   that field. Keeping undo alive would mean the fold itself became
   an undoable edit, and undoing an EXPAND would then delete text
   this module no longer holds a copy of. Losing undo history beats
   losing code.
   ============================================================ */

/* A fold is recorded against the COMPLETE file, never against the view:

     real  — 1-based line of the block's opening brace in the whole file
     lines — how many real lines this fold is holding
     text  — those lines, joined with newlines, no leading newline

   The view line is derived from that, because it is not stable: collapsing an
   outer block moves every inner anchor, and a folded block's closing brace is
   not on screen at all — so scanning the textarea could never match the braces
   of a block that contains a fold. Everything below scans the reconstructed
   file and maps the answer back down to a row. */
let _edFolds = {};
let _edFoldTrack = { key: null, lines: 0 };

function _edFoldKey() {
  return (typeof edMarkKey === 'function') ? edMarkKey() : '#';
}

function edFoldsFor(key) {
  const k = key || _edFoldKey();
  if (!Array.isArray(_edFolds[k])) _edFolds[k] = [];
  return _edFolds[k];
}

function _edSetFolds(list, key) {
  const k = key || _edFoldKey();
  const clean = (list || []).filter(f => f && f.lines > 0).sort((a, b) => a.real - b.real);
  if (clean.length) _edFolds[k] = clean;
  else delete _edFolds[k];
}

/** Wipe fold state for the current file — its text is about to be replaced. */
function edFoldReset(key) {
  delete _edFolds[key || _edFoldKey()];
  _edFoldTrack = { key: null, lines: 0 };
}

/** Each fold paired with the row its anchor currently occupies. */
function _edFoldRows() {
  const folds = edFoldsFor().slice().sort((a, b) => a.real - b.real);
  let hidden = 0;
  return folds.map(f => {
    const view = f.real - hidden;
    hidden += f.lines;
    return { fold: f, view: view };
  });
}

/**
 * Brace blocks worth folding, as 1-based line ranges over `text`.
 * Braces inside comments, strings and char literals don't count — a fold that
 * started at the `{` in printf("{") would swallow the rest of the function.
 * @returns {Array<{start:number,end:number}>} multi-line ranges, by start line
 */
function edFoldScan(text) {
  const lines = String(text == null ? '' : text).split('\n');
  const stack = [];
  const out = [];
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let inStr = null;
    let j = 0;
    while (j < line.length) {
      const c = line[j];
      const d = line[j + 1];
      if (inBlockComment) {
        if (c === '*' && d === '/') { inBlockComment = false; j += 2; continue; }
        j++; continue;
      }
      if (inStr) {
        if (c === '\\') { j += 2; continue; }
        if (c === inStr) inStr = null;
        j++; continue;
      }
      if (c === '/' && d === '/') break;                 // rest of the line is a comment
      if (c === '/' && d === '*') { inBlockComment = true; j += 2; continue; }
      if (c === '"' || c === "'") { inStr = c; j++; continue; }
      if (c === '{') stack.push(i + 1);
      else if (c === '}') {
        const s = stack.pop();
        if (s != null && i + 1 > s) out.push({ start: s, end: i + 1 });
      }
      j++;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The complete file: what's on screen, with every parked block put back. */
function edFullSource(textarea) {
  const ta = textarea || document.getElementById('editor-textarea');
  if (!ta) return '';
  const rows = _edFoldRows();
  if (!rows.length) return ta.value;
  const lines = ta.value.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const hit = rows.find(r => r.view === i + 1);
    if (hit) out.push.apply(out, hit.fold.text.split('\n'));
  }
  return out.join('\n');
}

/** View line to line number in the complete file. */
function edViewToReal(view) {
  let real = view;
  _edFoldRows().forEach(r => { if (r.view < view) real += r.fold.lines; });
  return real;
}

/** Line in the complete file to view line, or 0 when it is inside a fold. */
function edRealToView(real) {
  const folds = edFoldsFor().slice().sort((a, b) => a.real - b.real);
  let view = real;
  for (let i = 0; i < folds.length; i++) {
    const f = folds[i];
    if (real > f.real && real <= f.real + f.lines) return 0;   // parked
    if (f.real < real) view -= f.lines;
  }
  return view;
}

/** Rebuild the textarea from the complete file minus everything parked. */
function _edRenderView(ta, full, caretReal) {
  const lines = full.split('\n');
  const folds = edFoldsFor().slice().sort((a, b) => a.real - b.real);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    out.push(lines[i]);
    const f = folds.find(x => x.real === i + 1);
    i += f ? f.lines + 1 : 1;
  }
  _edApplyView(ta, out.join('\n'), Math.max(1, edRealToView(caretReal || 1) || 1));
}

/** Put `text` on screen, keeping the caret on a sensible line. */
function _edApplyView(ta, text, caretLine) {
  const scroll = ta.scrollTop;
  ta.value = text;
  const lines = text.split('\n');
  const line = Math.max(1, Math.min(caretLine || 1, lines.length));
  let pos = 0;
  for (let i = 0; i < line - 1; i++) pos += lines[i].length + 1;
  try { ta.setSelectionRange(pos, pos); } catch (e) { /* detached */ }
  ta.scrollTop = scroll;
  _edFoldTrack = { key: _edFoldKey(), lines: lines.length };
  _edFoldSync(ta);
}

/** Repaint everything that mirrors the textarea. */
function _edFoldSync(ta) {
  const preCode = document.getElementById('editor-code');
  if (preCode) {
    preCode.innerHTML = (typeof syntaxHighlight === 'function'
      ? syntaxHighlight(ta.value) : escapeHTML(ta.value)) + '<br/>';
  }
  if (typeof updateLineNumbers === 'function') updateLineNumbers(ta);
  // Downstream state must never see the folded view.
  const full = edFullSource(ta);
  if (typeof state !== 'undefined') state.userCode = full;
  if (typeof savePracticeFileCode === 'function' && typeof state !== 'undefined' && state.userFiles) {
    savePracticeFileCode();
  }
  if (typeof updateBossHealthBar === 'function') updateBossHealthBar(full);
}

/** Collapse the block opening on this view line, or expand it again. */
function edToggleFold(view) {
  const ta = document.getElementById('editor-textarea');
  const v = parseInt(view, 10);
  if (!ta || !(v > 0)) return;
  const full = edFullSource(ta);
  const real = edViewToReal(v);
  const open = _edFoldRows().find(r => r.view === v);

  if (open) {
    _edSetFolds(edFoldsFor().filter(f => f !== open.fold));
    _edRenderView(ta, full, real);
    return;
  }

  const range = edFoldScan(full).find(r => r.start === real);
  if (!range) return;
  const fullLines = full.split('\n');

  /* The BODY, not the body and its closing line.
     
     Parking through range.end swallowed the line the block closes on, and that
     line is not always just a brace: `}else {` both ends the if and begins the
     else. Folding the if therefore hid the else's own header, so the else
     looked folded too and its marker went with it.

     Keeping the closing line on screen is also what an editor normally does —
     you fold the inside of a block, and its last line stays to show where it
     ended. */
  const hidden = range.end - real - 1;
  if (hidden < 1) return;              // nothing between the braces to park

  // Any fold living inside this block is absorbed — its text is already part of
  // the slab being parked, so expanding the outer block expands them all.
  // Strictly inside: a fold anchored ON the closing line (the `}else {` case)
  // is not part of the slab any more and must survive.
  const kept = edFoldsFor().filter(f => !(f.real > real && f.real < range.end));
  kept.push({
    real: real,
    lines: hidden,
    text: fullLines.slice(real, range.end - 1).join('\n')
  });
  _edSetFolds(kept);
  _edRenderView(ta, full, real);
}

/** Put every parked block back. */
function edUnfoldAll() {
  const ta = document.getElementById('editor-textarea');
  if (!ta || !edFoldsFor().length) return;
  const full = edFullSource(ta);
  _edSetFolds([]);
  _edApplyView(ta, full, 1);
}

/**
 * Re-derive the view after the editor has been reloaded with the complete text
 * (file switch, restore), so a block stays collapsed across a switch.
 */
function edFoldReapply(ta) {
  const key = _edFoldKey();
  const folds = edFoldsFor(key);
  _edFoldTrack = { key: key, lines: ta.value.split('\n').length };
  if (!folds.length) return;
  // The buffer holds the whole file right now; drop any fold that no longer
  // points at a real block in it rather than hiding lines that moved.
  const ranges = edFoldScan(ta.value);
  const live = folds.filter(f => ranges.some(r => r.start === f.real && r.end === f.real + f.lines));
  _edSetFolds(live, key);
  if (!live.length) return;
  _edRenderView(ta, ta.value, 1);
}

/**
 * Called on every edit. Slides fold anchors past inserted/removed lines, and
 * hands back the text of any fold whose anchor no longer opens a block.
 */
function edFoldOnInput(ta) {
  const key = _edFoldKey();
  const lines = ta.value.split('\n');
  if (_edFoldTrack.key !== key) { _edFoldTrack = { key: key, lines: lines.length }; return; }
  const delta = lines.length - _edFoldTrack.lines;
  _edFoldTrack.lines = lines.length;

  const folds = edFoldsFor(key);
  if (!folds.length) return;

  if (delta !== 0) {
    const editView = ta.value.slice(0, ta.selectionStart).split('\n').length;
    const editReal = edViewToReal(editView);
    folds.forEach(f => { if (f.real >= editReal) f.real += delta; });
  }

  // An anchor that no longer ends in `{` has stopped describing a folded block
  // — you edited it, or it's gone. Give the text back where it stood rather
  // than holding code the user can neither see nor reach.
  const stale = _edFoldRows().filter(r => {
    const anchor = lines[r.view - 1];
    return anchor == null || !/\{$/.test(anchor.replace(/\/\/.*$/, '').trimEnd());
  }).map(r => r.fold);
  if (!stale.length) { _edSetFolds(folds); return; }

  const full = edFullSource(ta);
  _edSetFolds(folds.filter(f => stale.indexOf(f) === -1));
  _edRenderView(ta, full, 1);
}

/**
 * The collapsed-block marker and the tint behind its line. Both are overlays
 * inside #editor-pre rather than text, so nothing here can end up in the file.
 * Positioned like .ed-mark-band: the pre scrolls, and absolutely positioned
 * children scroll with it.
 */
function edFoldPaintBadges(ta) {
  const pre = document.getElementById('editor-pre');
  if (!pre) return;
  pre.querySelectorAll('.ed-fold-badge, .ed-fold-band').forEach(el => el.remove());
  const rows = _edFoldRows();
  if (!rows.length || (typeof edGetWrap === 'function' && edGetWrap())) return;

  const cs = getComputedStyle(pre);
  const lh = parseFloat(cs.lineHeight);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padLeft = parseFloat(cs.paddingLeft) || 0;
  if (!lh) return;

  // One probe, reused: the font is monospace, but tabs and wide glyphs are not,
  // so the width of the actual line text is measured rather than guessed.
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;top:0;left:0;';
  probe.style.font = cs.font;
  probe.style.letterSpacing = cs.letterSpacing;
  probe.style.tabSize = cs.tabSize;
  pre.appendChild(probe);

  const lines = ta.value.split('\n');
  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const text = lines[r.view - 1];
    if (text == null) return;
    probe.textContent = text;
    const x = probe.getBoundingClientRect().width;
    const top = padTop + (r.view - 1) * lh;

    const band = document.createElement('div');
    band.className = 'ed-fold-band';
    band.style.top = top + 'px';
    band.style.height = lh + 'px';
    frag.appendChild(band);

    const badge = document.createElement('div');
    badge.className = 'ed-fold-badge';
    badge.style.top = top + 'px';
    badge.style.left = (padLeft + x + 6) + 'px';
    badge.style.height = lh + 'px';
    badge.textContent = '⋯ }';
    badge.title = r.fold.lines + ' line' + (r.fold.lines === 1 ? '' : 's') + ' hidden — click to expand';
    badge.onclick = () => edToggleFold(r.view);
    frag.appendChild(badge);
  });
  probe.remove();
  pre.appendChild(frag);
}

/**
 * Gutter chevrons: view line to 'open' | 'folded'. Derived from the COMPLETE
 * file, so a block whose closing brace is currently hidden inside another fold
 * still offers a chevron.
 */
function edFoldMarkers(viewText) {
  const ta = document.getElementById('editor-textarea');
  const full = ta ? edFullSource(ta) : viewText;
  const map = {};
  edFoldScan(full).forEach(r => {
    // A block with nothing between its braces has no body to park, and a
    // marker that does nothing when clicked is worse than no marker.
    if (r.end - r.start - 1 < 1) return;
    const v = edRealToView(r.start);
    if (v > 0) map[v] = 'open';
  });
  _edFoldRows().forEach(r => { map[r.view] = 'folded'; });
  return map;
}

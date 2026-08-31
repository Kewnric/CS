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
    if (!hit) continue;
    out.push.apply(out, hit.fold.text.split('\n'));
    // The brace goes back on the closing line, which is then left for the loop
    // to reach normally -- it may carry a fold of its own. See _edRenderView.
    const cut = hit.fold.closeCut;
    if (cut) {
      const next = lines[i + 1];
      /* Only onto the line the brace actually came off. Deleting that line
         while the block is folded slides a stranger up into its place, and
         stapling the brace to that produces `}     return 0;` — a line nobody
         wrote, in the text that gets compiled. The brace still has to come
         back, so when its line is gone it gets one of its own. */
      if (next != null && _edCloseCut(_edUncutClose(next, cut)) === cut) {
        lines[i + 1] = _edUncutClose(next, cut);
      } else {
        out.push(cut.replace(/\s+$/, ''));
      }
    }
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

/* -- View offset <-> file offset ------------------------------
   Line numbers are not enough for anything that works in characters. Two
   things move an offset: every parked line above it, and the brace a split
   fold took off the front of its closing line.

   Bracket matching is why these exist. Run against what is on screen, the `{`
   of a folded `else {` pairs with the next unmatched `}` the view can see --
   main's, several blocks below -- because its own closing brace is parked.
   Matching has to happen in the complete file and come back out.            */

/** Offset of the start of 1-based `line` in `text`. */
function _edLineStart(text, line) {
  const lines = text.split('\n');
  let at = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) at += lines[i].length + 1;
  return at;
}

/* A split closing line has three parts, and a column lands in one of them:

       "    } else {"
        ^^^^          the indent, which stays on screen
            ^^        the brace and its gap, which are parked
              ^^^^^^  the rest, which stays but shifts left

   `keep` is the first part; `cut` is the first two together.               */

/** What a split fold took off the front of real line `real`, or ''. */
function _edCutAt(real) {
  const f = edFoldsFor().find(x => x.closeCut && x.real + x.lines + 1 === real);
  return f ? f.closeCut : '';
}

/** Offset in the view -> offset in the complete file. */
function edViewOffsetToFull(ta, off) {
  if (!edFoldsFor().length) return off;
  const before = ta.value.slice(0, off).split('\n');
  const line = edViewToReal(before.length);
  let col = before[before.length - 1].length;
  const cut = _edCutAt(line);
  // A column in the indent has not moved; everything past it shifted left by
  // whatever was parked.
  if (cut && col >= _edCloseKeep(cut).length) col += cut.length - _edCloseKeep(cut).length;
  return _edLineStart(edFullSource(ta), line) + col;
}

/** Offset in the complete file -> offset in the view, or -1 when not on screen. */
function edFullOffsetToView(ta, off) {
  if (!edFoldsFor().length) return off;
  const before = edFullSource(ta).slice(0, off).split('\n');
  const real = before.length;
  const view = edRealToView(real);
  if (view <= 0) return -1;                                  // the whole line is parked
  let col = before[before.length - 1].length;
  const cut = _edCutAt(real);
  if (cut) {
    const keep = _edCloseKeep(cut).length;
    // Between the two sits the brace itself: on this line, but not on screen.
    // Reporting a column for it would put the highlight on the space beside it.
    if (col >= keep && col < cut.length) return -1;
    if (col >= cut.length) col -= cut.length - keep;
  }
  return _edLineStart(ta.value, view) + col;
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
    if (!f) { i++; continue; }
    i += f.lines + 1;
    /* The closing line loses its brace and is then left for the loop to handle
       like any other line -- because it can be a fold anchor itself.
       `} else if (...) {` folded after the `if` above it is exactly that, and
       skipping past it here left the second fold recorded but never applied:
       its body stayed on screen while the line numbers counted it as hidden,
       so every number below it read one too high. */
    if (f.closeCut && i < lines.length) lines[i] = _edCutClose(lines[i], f.closeCut);
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

  /* The body, plus the closing brace itself — but NOT whatever shares its line.

     `}else {` is one line holding two things: the brace that ends the if, and
     the header that begins the else. The brace belongs to the block being
     folded and should go with it; the `else {` belongs to the next block and
     has to stay. So the closing line is SPLIT: its leading brace is parked
     with the body and the remainder stays on screen.

     Folding the if therefore reads

         if(x == 1){⋯
         else {

     rather than leaving a `}` behind that now closes nothing visible, or
     swallowing the whole line and taking the else's header with it. */
  if (range.end - real - 1 < 1) return;   // nothing between the braces to park

  /* How much of the closing line goes with the block.

     The brace closes what is being folded, so it belongs inside the fold and
     is drawn on the badge instead — `if (x) {⋯ }` reads as a closed block,
     while leaving a bare `}` on screen below it does not.

     Three shapes, because the rest of that line does not always belong to the
     same block:

       `}`, `};`, `} Size;`, `} while (i < 3);`
           All of it belongs to this block, so all of it goes and the badge
           shows what went: `⋯ }`, `⋯ };`, `⋯ } while (i < 3);`. The `while` of
           a do-while is the tail of the block, not the head of a new one.

       `} else {`, `} catch (e) {`
           The brace is this block's, the header after it is the next one's.
           Only the brace goes; `else {` stays as a line of its own.

       anything else ending in `{`
           An opener this module does not recognise. The line stays whole
           rather than be guessed at — hiding a block header would lose the
           user's place. */
  const closeLine = fullLines[range.end - 1] || '';
  const closeCut = _edCloseCut(closeLine) || '';
  const opensBlock = /\{\s*$/.test(closeLine.replace(/\/\/.*$/, ''));
  const swallow = !closeCut && !opensBlock;
  const hidden = range.end - real - (swallow ? 0 : 1);

  // Any fold living inside this block is absorbed — its text is already part of
  // the slab being parked, so expanding the outer block expands them all.
  // Strictly inside: a fold anchored ON the closing line (the `}else {` case)
  // is not part of the slab any more and must survive.
  const kept = edFoldsFor().filter(f => !(f.real > real && f.real < range.end));
  kept.push({
    real: real,
    lines: hidden,
    // Where the block closes, kept so a reload can tell this fold still
    // describes a real block without having to re-derive how much of the
    // closing line went with it.
    end: range.end,
    text: fullLines.slice(real, real + hidden).join('\n'),
    // The closing brace taken off the line after the parked ones, held as its
    // original text so edFullSource can put it back exactly. Empty when the
    // whole closing line went, or when none of it did.
    closeCut: closeCut,
    // What the badge draws after the ellipsis: whatever was folded away.
    tail: swallow ? closeLine.trim() : (closeCut ? '}' : '')
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
  /* The buffer holds the whole file right now; drop any fold that no longer
     points at a real block in it rather than hiding lines that moved.

     A fold parks the BODY, so its last parked line is `real + lines` and the
     block closes on the line after that. Matching r.end against
     `real + lines` — as this did while folds still swallowed the closing line
     — matched nothing, and every fold was silently dropped on a file switch
     or a restore. */
  const ranges = edFoldScan(ta.value);
  const live = folds.filter(f => ranges.some(r => r.start === f.real && r.end === f.end));
  // Re-derive the split from the text actually in the buffer, rather than
  // trusting a prefix recorded against a version of the file that may since
  // have been edited elsewhere. Only a fold that left its closing line on
  // screen has one to re-derive.
  const reLines = ta.value.split('\n');
  live.forEach(f => {
    if (f.closeCut) f.closeCut = _edCloseCut(reLines[f.real + f.lines]) || '';
  });
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
    /* Which anchors moved. The caret sits at the end of whatever just changed,
       so in the CURRENT view the change began at `caret - delta` for an insert
       and at `caret` for a deletion; every anchor at or after that point
       shifted by the same amount.

       Deliberately in view coordinates. Mapping the caret back through
       edViewToReal measured a view from AFTER the edit against the fold layout
       from before it, so the boundary landed in the wrong place: typing a new
       block above a folded one left the fold anchored on a line that had
       moved, and its parked brace went back onto whatever now sat there. */
    const caret = ta.value.slice(0, ta.selectionStart).split('\n').length;
    const from = caret - Math.max(delta, 0);
    _edFoldRows().forEach(r => {
      if (r.view >= from) { r.fold.real += delta; r.fold.end += delta; }
    });
  }

  // An anchor that no longer ends in `{` has stopped describing a folded block
  // — you edited it, or it's gone. Give the text back where it stood rather
  // than holding code the user can neither see nor reach.
  const stale = _edFoldRows().filter(r => {
    const anchor = lines[r.view - 1];
    if (anchor == null || !/\{$/.test(anchor.replace(/\/\/.*$/, '').trimEnd())) return true;
    const cut = r.fold.closeCut;
    if (!cut) return false;
    /* A split fold holds the block's `}` in this module and nowhere else, so
       the line it came off has to still be there AND still be the same shape.
       Delete that line and something else slides up into its place; put the
       brace back on that and you get `}     return 0;` — a line the user never
       wrote, in the file that gets compiled.

       Rebuilding the line and re-deriving the cut is the exact test: it passes
       while the user edits around the `else`, and fails the moment the line
       stops being the one the brace was taken from. */
    const close = lines[r.view];
    return close == null || _edCloseCut(_edUncutClose(close, cut)) !== cut;
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
/* -- The split closing line ----------------------------------
   `}else {` is one line holding two things: the brace that closes the block
   being folded, and the header of the one that follows. The brace goes with
   the fold, the header stays.

   `closeCut` is the exact original text through that brace -- indent included,
   e.g. "  }" -- because that is what has to come back verbatim. But only the
   BRACE is taken off the screen: the indent stays, so the `else` keeps sitting
   under its `if` rather than jumping to column 0.

   These two are exact inverses. Anything that changes one changes the other. */

const ED_FOLD_CONTINUE = /^(?:else|catch|finally)\b/;

/**
 * How to split a block's closing line, or null to leave it whole.
 * @returns {string|null} the exact leading text to park -- indent, brace, and
 *   any space after it, e.g. "    } " -- so it can be put back verbatim.
 */
function _edCloseCut(closeLine) {
  const line = String(closeLine == null ? '' : closeLine);
  const braceAt = line.indexOf('}');
  // The brace has to open the line. `foo(); }` is something else, and rather
  // than guess at it the line is left alone.
  if (braceAt < 0 || line.slice(0, braceAt).trim() !== '') return null;
  // Absorb the gap after the brace too, so `} else` and `}else` both leave the
  // `else` at the block's own indent instead of one column to the right of it.
  const rest = line.slice(braceAt + 1);
  const gap = rest.length - rest.replace(/^[ \t]+/, '').length;
  if (!ED_FOLD_CONTINUE.test(rest.slice(gap))) return null;
  return line.slice(0, braceAt + 1 + gap);
}

/** The indent that stays on screen when `cut` is parked. */
function _edCloseKeep(cut) { return (/^[ \t]*/.exec(cut) || [''])[0]; }

/* Exact inverses. Anything that changes one changes the other. */

/** "    } else {" -> "    else {" */
function _edCutClose(line, cut) {
  if (!cut || line.indexOf(cut) !== 0) return line;
  return _edCloseKeep(cut) + line.slice(cut.length);
}

/** "    else {" -> "    } else {" */
function _edUncutClose(line, cut) {
  if (!cut) return line;
  const keep = _edCloseKeep(cut);
  if (line.indexOf(keep) !== 0) return cut + line;
  return cut + line.slice(keep.length);
}

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

  // Line starts, so a row can be turned into an offset for edCharRect. The
  // badge used to sit at the width of a copy of the line measured in a hidden
  // span, which carried the <pre>'s font while the text is drawn inside <code>
  // in tokens of differing weight -- the two drifted apart by about a pixel per
  // column, and the badge ended up over the end of its own line.
  const lines = ta.value.split('\n');
  const starts = [];
  for (let i = 0, at = 0; i < lines.length; i++) { starts.push(at); at += lines[i].length + 1; }
  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const text = lines[r.view - 1];
    if (text == null) return;
    // The right edge of the line's last character; an empty anchor line cannot
    // happen, since an anchor is a line that ends in `{`.
    const end = text.length ? edCharRect(starts[r.view - 1] + text.length - 1) : null;
    const x = end ? end.right : padLeft;
    const top = padTop + (r.view - 1) * lh;

    const band = document.createElement('div');
    band.className = 'ed-fold-band';
    band.style.top = top + 'px';
    band.style.height = lh + 'px';
    frag.appendChild(band);

    const badge = document.createElement('div');
    badge.className = 'ed-fold-badge';
    badge.style.top = top + 'px';
    badge.style.left = (x + 6) + 'px';
    badge.style.height = lh + 'px';
    /* `⋯ }` when the fold took the closing brace with it, `⋯` when it didn't.

       Whether the brace belongs here depends on what the fold actually hid. On
       `}else {` the brace is folded away and the badge stands in for it, so
       the block reads as closed:

           if(x == 1){⋯ }
           else {

       On a closing line that is nothing but `}`, that line stays on screen
       whole — drawing a brace here too would show two closers for one block. */
    badge.textContent = r.fold.tail ? '\u22ef ' + r.fold.tail : '\u22ef';
    badge.title = r.fold.lines + ' line' + (r.fold.lines === 1 ? '' : 's') + ' hidden — click to expand';
    badge.onclick = () => edToggleFold(r.view);
    frag.appendChild(badge);
  });
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

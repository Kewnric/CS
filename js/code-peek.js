/* ============================================================
   CODE-PEEK.JS — hold Ctrl+Space to see your code against the target
   ------------------------------------------------------------
   The only way to see the reference solution used to be finishing the attempt
   and opening the review page. Holding Ctrl+Space (or the eye in the editor
   toolbar) now draws your code over the editor merged with the target, and
   letting go puts the editor back:

     - a line that matches is drawn exactly as you wrote it, so a correct
       program looks unchanged;
     - a line the target has and you do not opens up space and appears faint,
       where it belongs;
     - inside a line, what is missing appears faint in place, and what is
       different gets a red wavy underline;
     - a line of yours the target has no counterpart for is underlined whole.

   Lines are compared as C tokens, not characters: spacing and comments do
   not count as differences, so `x=5;` matches `x = 5;` and a starter's
   `// TODO` is never marked wrong. It is off in Recall mode, which exists to
   hide exactly this.

   Read-only and display-only: nothing here touches the editor, the draft or
   the boss bar.
   ============================================================ */

let _peekEl = null;

/* ── Tokens ────────────────────────────────────────────────── */

/* A number keeps the sign of its exponent (`1.5e-3` is one token); a hex
   literal has no exponent, so `0x1e-3` stays `0x1e`, `-`, `3`. */
const PEEK_TOKEN = /\s+|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|[A-Za-z_]\w*|0[xX][\da-fA-F]+\w*|\.?\d(?:[eE][+-]|[\w.])*|->|\+\+|--|<<=|>>=|<<|>>|&&|\|\||[-+*\/%&|^!=<>]=|./y;

/**
 * Every line as tokens: k is 'w' (white space), 'c' (comment) or 'x' (code).
 * Block comments are followed across lines, so the inside of one is never
 * compared as code.
 */
function peekTokenize(src) {
  let inBlock = false;
  return String(src).split('\n').map(line => {
    const toks = [];
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        const stop = end < 0 ? line.length : end + 2;
        toks.push({ t: line.slice(i, stop), k: 'c', c: i });
        if (end >= 0) inBlock = false;
        i = stop;
        continue;
      }
      if (line.startsWith('//', i)) { toks.push({ t: line.slice(i), k: 'c', c: i }); break; }
      if (line.startsWith('/*', i)) {
        const end = line.indexOf('*/', i + 2);
        const stop = end < 0 ? line.length : end + 2;
        toks.push({ t: line.slice(i, stop), k: 'c', c: i });
        if (end < 0) inBlock = true;
        i = stop;
        continue;
      }
      PEEK_TOKEN.lastIndex = i;
      const m = PEEK_TOKEN.exec(line);
      const t = m ? m[0] : line[i];
      toks.push({ t, k: /^\s+$/.test(t) ? 'w' : 'x', c: i });
      i += t.length;
    }
    return toks;
  });
}

/**
 * What a line means, for comparing: its code tokens, nothing else. A line
 * with no code is '' when it is blank and '\u0002' when it holds a comment,
 * so any comment line stands for any other (their words never count) but a
 * blank line of yours never stands in for a comment of the target's.
 */
function peekKey(toks) {
  const code = toks.filter(t => t.k === 'x');
  if (code.length) return code.map(t => t.t).join('\u0001');
  return toks.some(t => t.k === 'c') ? '\u0002' : '';
}

const peekHasCode = toks => toks.some(t => t.k === 'x');

/**
 * A `{` on a line of its own belongs to the line above it, when that line is
 * waiting for one (`if (x)`, `else`, a function's head). Both styles are the
 * same program, so for comparing the brace is moved up: the line above gets
 * a virtual `{` (v: true -- compared, never drawn) and the brace itself
 * becomes k 'b' (drawn as written, never compared). Without this, `if(x)` /
 * `{` against `if(x){` showed a faint `{` on one line and underlined the
 * other.
 */
function peekFoldBraces(lines) {
  let prev = -1;   // the last line with code
  lines.forEach((toks, i) => {
    const code = toks.filter(t => t.k === 'x');
    if (!code.length) return;
    if (code.length === 1 && code[0].t === '{' && prev >= 0) {
      const above = lines[prev].filter(t => t.k === 'x');
      const last = above[above.length - 1].t;
      if (last !== '{' && last !== '}' && last !== ';') {
        lines[prev].push({ t: '{', k: 'x', v: true, c: -1 });
        code[0].k = 'b';
        return;   // a brace line is not waiting for anything
      }
    }
    prev = i;
  });
  return lines;
}

/**
 * Missing lines drawn at YOUR indentation. The target may indent by 4 or by
 * tabs while you indent by 2; a missing line keeping the target's depth sat
 * far to the right of the lines around it.
 *
 * Returns map(ws): the leading white space of a target line, as you would
 * have written it. With nothing of yours indented yet it is left as it is.
 */
function peekIndentMap(userSrc, refSrc) {
  const unitOf = (src) => {
    let tabs = false, spaces = 0;
    peekTokenize(src).forEach(toks => {
      if (!peekHasCode(toks) || !toks.length || toks[0].k !== 'w') return;
      const ws = toks[0].t;
      if (ws.includes('\t')) { tabs = true; return; }
      if (!spaces || ws.length < spaces) spaces = ws.length;
    });
    if (tabs) return { str: '\t', spaces: spaces || 4 };
    if (spaces) return { str: ' '.repeat(spaces), spaces };
    return null;
  };
  const mine = unitOf(userSrc), theirs = unitOf(refSrc) || { str: '    ', spaces: 4 };
  if (!mine) return ws => ws;
  return (ws) => {
    const tabs = (ws.match(/\t/g) || []).length;
    const level = tabs + Math.round((ws.length - tabs) / theirs.spaces);
    return mine.str.repeat(level);
  };
}

/** Longest common subsequence of two arrays, as matched index pairs. */
function peekLCS(a, b, same) {
  const n = a.length, m = b.length;
  if (!n || !m) return [];
  if (n * m > 4000000) return [];          // far past any program here; no alignment beats a hang
  const w = m + 1;
  const dp = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = same(a[i], b[j]) ? dp[(i + 1) * w + j + 1] + 1
        : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (same(a[i], b[j])) { out.push([i, j]); i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }
  return out;
}

/**
 * How well a line of yours stands for a line of the target, by their code
 * tokens: a score in (0, 1], or -1 for "these are not the same line".
 *
 * Similarity alone was not enough. Against the 30 tokens of
 * `memmove(L->elems+i+1, L->elems+i, sizeof(Fan) * (L->count-i));` the six
 * correct ones of `memmove(L->elems)` score 0.33 and were drawn as a line of
 * their own, while one more character crossed the line and merged them. A
 * line that is the start of the target line, or shares its start and most of
 * its tokens with it, is that line being written.
 *
 * Every pure start scores the same, so between two target lines that both
 * begin like yours the earlier one wins (the merge takes a pair as soon as it
 * is on a best path).
 */
function peekPairScore(u, r) {
  const a = u.filter(t => t.k === 'x').map(t => t.t);
  const b = r.filter(t => t.k === 'x').map(t => t.t);
  if (!a.length || !b.length) return -1;          // blank or comment-only: matched whole, never merged
  let lead = 0;
  while (lead < a.length && lead < b.length && a[lead] === b[lead]) lead++;
  if (lead === a.length && b.length > a.length) return 0.9;
  const c = peekLCS(a, b, (x, y) => x === y).length;
  const dice = (2 * c) / (a.length + b.length);
  if (dice >= 0.34) return dice;
  if (lead >= 2 && c / a.length >= 0.6) return 0.34;
  return -1;
}

/* ── Merging your code with the target ─────────────────────── */

/**
 * The rows to draw, in order. Each is
 *   { kind: 'same' | 'ghost' | 'extra' | 'pair', u: your line index or -1,
 *     r: the target's line index or -1, uToks, rToks }
 */
function peekMerge(userSrc, refSrc) {
  const U = peekFoldBraces(peekTokenize(userSrc)), R = peekFoldBraces(peekTokenize(refSrc));
  const uk = U.map(peekKey), rk = R.map(peekKey);
  const matched = peekLCS(uk, rk, (a, b) => a === b);
  const rows = [];
  let ui = 0, ri = 0;

  /* Between two matched lines: what you wrote there and what the target has
     there. Lines that are close enough are paired and compared token by
     token; the rest stand alone. The pairing keeps both orders, and is chosen
     to be the most similar overall rather than the first that fits. */
  const hunk = (u0, u1, r0, r1) => {
    const us = [], rs = [];
    for (let i = u0; i < u1; i++) us.push(i);
    for (let j = r0; j < r1; j++) rs.push(j);
    const n = us.length, m = rs.length, w = m + 1;
    const sim = (i, j) => peekPairScore(U[us[i]], R[rs[j]]);
    const best = new Float64Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        const s = sim(i, j);
        best[i * w + j] = Math.max(best[(i + 1) * w + j], best[i * w + j + 1], s > 0 ? best[(i + 1) * w + j + 1] + s : -Infinity);
      }
    }
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m) {
        const s = sim(i, j);
        if (s > 0 && best[i * w + j] === best[(i + 1) * w + j + 1] + s) {
          rows.push({ kind: 'pair', u: us[i], r: rs[j], uToks: U[us[i]], rToks: R[rs[j]] });
          i++; j++;
          continue;
        }
        // Missing lines come before the line of yours that follows them.
        if (best[i * w + j + 1] >= best[(i + 1) * w + j]) { rows.push(ghostRow(rs[j])); j++; }
        else { rows.push(extraRow(us[i])); i++; }
      } else if (j < m) { rows.push(ghostRow(rs[j])); j++; }
      else { rows.push(extraRow(us[i])); i++; }
    }
  };
  /* A target line you do not have. One with nothing on it opens no row: a
     blank line the target has would only push your lines down with nothing
     to show. (rows.push(null) is dropped below.) */
  const ghostRow = (j) => rk[j] === '' ? null : { kind: 'ghost', u: -1, r: j, rToks: R[j] };
  /* A line of yours with no counterpart. Blank and comment-only lines are not
     mistakes -- a starter's "// TODO" is meant to be there -- so they are
     drawn as written. */
  const extraRow = (i) => ({ kind: peekHasCode(U[i]) ? 'extra' : 'same', u: i, r: -1, uToks: U[i] });

  for (const [a, b] of matched) {
    hunk(ui, a, ri, b);
    rows.push({ kind: 'same', u: a, r: b, uToks: U[a] });
    ui = a + 1; ri = b + 1;
  }
  hunk(ui, U.length, ri, R.length);
  return rows.filter(Boolean);
}

/* ── Drawing ───────────────────────────────────────────────── */

const peekJoin = toks => toks.map(t => t.t).join('');

function peekEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Colours for any stretch of a source, taken from highlighting the WHOLE
 * source once. Highlighting a line, or a token, on its own got colours wrong
 * that the editor gets right: a variable is only coloured once its declaration
 * is in sight, `memmove` is a call only with its `(` after it, and the middle
 * of a block comment does not look like a comment at all.
 *
 * Returns paint(line, from, to): the HTML for columns [from, to) of a line.
 */
function peekPaint(src) {
  const text = String(src);
  const lines = text.split('\n');
  const plain = (line, from, to) => peekEsc((lines[line] || '').slice(from, to));
  if (typeof syntaxHighlight !== 'function') return plain;

  // One class list per character, line by line.
  const html = syntaxHighlight(text);
  const per = [[]];
  const stack = [];
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
  const re = /<span class="([^"]*)">|<\/span>|<[^>]+>|&(amp|lt|gt|quot|#39);|[\s\S]/g;
  let m, chars = '';
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) { stack.push(m[1]); continue; }
    if (m[0] === '</span>') { stack.pop(); continue; }
    if (m[0].length > 1 && m[0][0] === '<') continue;
    const ch = m[2] ? ENT[m[2]] : m[0];
    chars += ch;
    if (ch === '\n') { per.push([]); continue; }
    per[per.length - 1].push(stack.slice());
  }
  // Something the highlighter changed: no colour beats colour in the wrong place.
  if (chars !== text) return plain;

  return (line, from, to) => {
    const src = lines[line] || '', cls = per[line] || [];
    let out = '', open = [];
    for (let i = from; i < to && i < src.length; i++) {
      const want = cls[i] || [];
      let same = 0;
      while (same < open.length && same < want.length && open[same] === want[same]) same++;
      for (let k = open.length; k > same; k--) out += '</span>';
      for (let k = same; k < want.length; k++) out += '<span class="' + want[k] + '">';
      open = want;
      out += peekEsc(src[i]);
    }
    for (let k = 0; k < open.length; k++) out += '</span>';
    return out;
  };
}

/** A whole token, or a run of tokens, painted where it sits in its line.
    A virtual token (a brace moved up for comparing) is never drawn. */
const peekPaintToks = (paint, line, toks) =>
  toks.map(t => t.v ? '' : paint(line, t.c, t.c + t.t.length)).join('');

/**
 * The code tokens of a line as compared: a bracket carries how deep it sits,
 * so your `)` closing `memmove(` meets the target's `)` closing `memmove(`,
 * not the first `)` along the line (the one after `sizeof(Fan`).
 */
function peekDepthKeys(toks, idx) {
  let depth = 0;
  return idx.map(i => {
    const t = toks[i].t;
    if (t === '(' || t === '[' || t === '{') return t + (++depth);
    if (t === ')' || t === ']' || t === '}') { const k = t + depth; depth = Math.max(0, depth - 1); return k; }
    return t;
  });
}

/**
 * How a line of yours lines up with its target line, token by token.
 *   uToR      your token index -> the target token it is
 *   rMatched  target token indexes you have
 *   wrong     your code tokens the target does not have there
 *   ghost     target code tokens you do not have yet
 */
function peekPairAlign(uToks, rToks) {
  const uc = [], rc = [];
  uToks.forEach((t, i) => { if (t.k === 'x') uc.push(i); });
  rToks.forEach((t, j) => { if (t.k === 'x') rc.push(j); });
  const pairs = peekLCS(peekDepthKeys(uToks, uc), peekDepthKeys(rToks, rc), (a, b) => a === b);
  return {
    uToR: new Map(pairs.map(([a, b]) => [uc[a], rc[b]])),
    rMatched: new Set(pairs.map(([, b]) => rc[b])),
    wrong: uc.length - pairs.length,
    ghost: rc.length - pairs.length
  };
}

/** A paired line: yours, with the target's missing pieces faint in place and
    your different pieces underlined. Your tokens are painted from your file,
    the missing ones from the target's; the spaces put between missing tokens
    are plain. */
function peekPairParts(uToks, rToks, u, r, paintU, paintR) {
  const al = peekPairAlign(uToks, rToks);
  const uToR = al.uToR, rMatched = al.rMatched;

  let html = '', rPos = 0, lastChar = '';
  const ghosts = (upTo) => {
    let piece = '', text = '';
    for (; rPos < upTo; rPos++) {
      const t = rToks[rPos];
      if (t.k !== 'x' || t.v || rMatched.has(rPos)) continue;
      const spaced = rPos > 0 && rToks[rPos - 1].k === 'w';
      if (spaced && (text || (lastChar && !/\s/.test(lastChar)))) { piece += ' '; text += ' '; }
      piece += peekPaintToks(paintR, r, [t]);
      text += t.t;
    }
    if (!text) return;
    // Spaced after, too, where the target is: "i <= n", not "i <=n".
    if (upTo < rToks.length && upTo > 0 && rToks[upTo - 1].k === 'w') { piece += ' '; text += ' '; }
    html += '<span class="cp-ghost">' + piece + '</span>';
    lastChar = text.slice(-1);
  };
  uToks.forEach((t, i) => {
    if (uToR.has(i)) {
      ghosts(uToR.get(i));
      rPos = uToR.get(i) + 1;
      html += peekPaintToks(paintU, u, [t]);
    } else if (t.v) {
      return;                                  // a moved brace: compared, not drawn
    } else if (t.k === 'x') {
      html += '<span class="cp-wrong">' + peekPaintToks(paintU, u, [t]) + '</span>';
    } else {
      html += peekPaintToks(paintU, u, [t]);
    }
    lastChar = t.t.slice(-1);
  });
  ghosts(rToks.length);
  return { html, wrong: al.wrong, ghost: al.ghost };
}

/** A line of yours the target has no counterpart for: its code underlined,
    not the indentation in front of it or a comment after it. */
function peekExtraHTML(uToks, u, paintU) {
  const first = uToks.findIndex(t => t.k === 'x');
  let last = -1;
  uToks.forEach((t, i) => { if (t.k === 'x') last = i; });
  if (first < 0) return peekPaintToks(paintU, u, uToks);
  return peekPaintToks(paintU, u, uToks.slice(0, first))
    + '<span class="cp-wrong">' + peekPaintToks(paintU, u, uToks.slice(first, last + 1)) + '</span>'
    + peekPaintToks(paintU, u, uToks.slice(last + 1));
}

/** One row's code, as HTML. A missing line is moved to your indentation. */
function peekRowCode(row, paintU, paintR, indent) {
  if (row.kind === 'ghost') {
    const t0 = row.rToks[0];
    if (indent && t0 && t0.k === 'w') return peekEsc(indent(t0.t)) + peekPaintToks(paintR, row.r, row.rToks.slice(1));
    return peekPaintToks(paintR, row.r, row.rToks);
  }
  if (row.kind === 'pair') return peekPairParts(row.uToks, row.rToks, row.u, row.r, paintU, paintR).html;
  if (row.kind === 'extra') return peekExtraHTML(row.uToks, row.u, paintU);
  return peekPaintToks(paintU, row.u, row.uToks);
}

/**
 * What the badge says, counted by line:
 *   missing     target lines with code you have not started
 *   incomplete  lines of yours that are right so far but not finished
 *   different   lines of yours with something the target does not have
 */
function peekCounts(rows) {
  const c = { missing: 0, incomplete: 0, different: 0 };
  rows.forEach(r => {
    if (r.kind === 'ghost') { if (r.rToks.some(t => t.k === 'x')) c.missing++; }
    else if (r.kind === 'extra') c.different++;
    else if (r.kind === 'pair') {
      if (peekPairAlign(r.uToks, r.rToks).wrong) c.different++;
      else c.incomplete++;
    }
  });
  return c;
}

/** The badge's words for those counts. */
function peekBadgeText(c) {
  const parts = [];
  if (c.missing) parts.push(c.missing + ' missing');
  if (c.incomplete) parts.push(c.incomplete + ' incomplete');
  if (c.different) parts.push(c.different + ' different');
  return parts.length ? parts.join(' · ') : '✓ Matches the target';
}

/** Everything the overlay draws, without the page: the rows, each row's code
    as HTML, and the counts. */
function peekRender(userSrc, refSrc) {
  const rows = peekMerge(userSrc, refSrc);
  const paintU = peekPaint(userSrc), paintR = peekPaint(refSrc);
  const indent = peekIndentMap(userSrc, refSrc);
  return { rows, codeHTML: rows.map(r => peekRowCode(r, paintU, paintR, indent)), counts: peekCounts(rows) };
}

/** The rows as HTML. The gutter shows your line number on your lines (the
    real one, as the editor's gutter does under a fold) and + on a line the
    target adds. */
function peekRowsHTML(rows, codeHTML) {
  return rows.map((r, i) => {
    let cls = 'cp-row';
    if (r.kind === 'ghost') cls += ' cp-row-ghost';
    else if (r.kind === 'pair' || r.kind === 'extra') cls += ' cp-row-diff';
    const ln = r.u >= 0 ? String(r.u + 1) : '+';
    return `<div class="${cls}"${r.u >= 0 ? ` data-u="${r.u}"` : ''}><span class="cp-ln"><span class="cp-ln-no">${ln}</span></span><span class="cp-code">${codeHTML[i] || ' '}</span></div>`;
  }).join('');
}

/* ── Showing it ────────────────────────────────────────────── */

/** On an attempt screen with an editor? */
function codePeekAvailable() {
  const route = document.body.dataset.route;
  const wants = typeof editorRouteHas === 'function' ? editorRouteHas('peek', route)
    : (route === 'practice' || route === 'practice-set');
  return wants && !!document.getElementById('editor-textarea');
}

/** Why it cannot be shown now, or '' when it can. */
function _peekBlocked() {
  if (typeof examRecallOn === 'function' && examRecallOn()) return 'Peeking at the target is off in Recall mode.';
  const f = state.userFiles && state.userFiles[state.activeFileIndex];
  if (!f || !String(f.code || '').trim()) return 'This file has no target code to compare with.';
  return '';
}

function codePeekShow() {
  if (_peekEl || !codePeekAvailable()) return;
  const why = _peekBlocked();
  if (why) { if (typeof toast === 'function') toast(why, { type: 'info', duration: 2000 }); return; }

  const ta = document.getElementById('editor-textarea');
  const gutter = document.getElementById('editor-line-numbers');
  const box = (gutter && gutter.parentElement) || ta.parentElement;
  const file = state.userFiles[state.activeFileIndex];
  const mine = ((typeof edFullSource === 'function') ? edFullSource(ta) : ta.value).replace(/\r\n/g, '\n');
  const target = String(file.code).replace(/\r\n/g, '\n');
  const view = peekRender(mine, target);
  const rows = view.rows;
  const c = view.counts;
  const ok = !c.missing && !c.incomplete && !c.different;

  /* Drawn INSIDE the editor's own box and in the metrics of the text you
     actually see (the highlight layer), so a line that matches lands exactly
     where it already was, at exactly its size -- whatever scaling or font
     setting the editor is under applies to this too. It was a fixed layer on
     the page body before, and outside the editor's box its text could come
     out a different size. */
  /* The font is read from the <code> inside the highlight layer, which is the
     text on screen; its <pre> wrapper keeps the browser's default monospace
     and measured 8% narrower. Padding comes from the <pre>, which owns it. */
  const pre = document.getElementById('editor-pre') || ta;
  const text = document.getElementById('editor-code') || pre;
  const ps = getComputedStyle(pre), ts = getComputedStyle(text);
  const cs = { paddingTop: ps.paddingTop, paddingLeft: ps.paddingLeft, fontFamily: ts.fontFamily,
               fontSize: ts.fontSize, lineHeight: ts.lineHeight, tabSize: ts.tabSize };
  /* Every setting that shapes a glyph, not only the font and its size: a
     weight, spacing or ligature setting the editor has and this layer did not
     would redraw the same text in a different shape. */
  const glyph = ['font-weight', 'font-style', 'font-stretch', 'letter-spacing', 'word-spacing',
    'font-variant-ligatures', 'font-feature-settings', 'font-kerning', 'text-rendering']
    .map(p => p + ':' + ts.getPropertyValue(p) + ';').join('');
  const wrap = typeof edGetWrap === 'function' && edGetWrap();
  const gutterW = gutter && gutter.offsetWidth ? gutter.offsetWidth : 0;
  const el = document.createElement('div');
  el.id = 'code-peek';
  el.className = 'code-peek' + (wrap ? ' cp-wrap' : '') + (gutterW ? '' : ' cp-nogutter')
    + (gutter && gutter.classList.contains('gutter-hidden') ? ' cp-ln-off' : '');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `--cp-gutter:${gutterW}px;`
    + `--cp-pad-top:${cs.paddingTop};--cp-pad-left:${cs.paddingLeft};`
    + _peekThemeVars(pre, text, gutter)
    + `font-family:${cs.fontFamily};font-size:${cs.fontSize};line-height:${cs.lineHeight};tab-size:${cs.tabSize};`
    + glyph;
  el.innerHTML = `
    <div class="cp-badge${ok ? ' cp-badge-ok' : ''}">
      ${peekBadgeText(c)}
      <span class="cp-badge-hint">release to go back</span>
    </div>
    <div class="cp-scroll"><div class="cp-rows">${peekRowsHTML(rows, view.codeHTML)}</div></div>`;
  box.appendChild(el);
  _peekEl = el;

  /* The same place on screen. The line at the top of your view is drawn at
     exactly the height it is at in the editor; lines the target adds above it
     push only what is above, never what you were looking at. */
  const scroller = el.querySelector('.cp-scroll');
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 21;
  const pad = parseFloat(cs.paddingTop) || 0;
  /* Where each line on screen starts. Without word wrap it is one row per
     line; with it a long line takes several, so the tops are measured. */
  const tops = wrap ? _peekWrappedTops(ta, pre, text) : null;
  const topOf = v => tops ? tops[v] : pad + v * lh;
  let atTop = 0;   // the view line at the top of the editor
  if (tops) { while (atTop + 1 < tops.length && tops[atTop + 1] <= ta.scrollTop + 0.5) atTop++; }
  else atTop = Math.max(0, Math.floor((ta.scrollTop - pad) / lh));
  /* The screen shows the file with folds closed; the rows are the whole file.
     A view line is found by its real number, as the gutter prints it. */
  const realOf = v => (typeof edViewToReal === 'function' ? edViewToReal(v + 1) : v + 1) - 1;
  const firstLine = realOf(atTop);
  const row = el.querySelector(`.cp-row[data-u="${firstLine}"]`)
    || [...el.querySelectorAll('.cp-row[data-u]')].find(r => Number(r.dataset.u) >= firstLine);
  if (row) {
    const atInEditor = topOf(atTop) - ta.scrollTop;   // that line's top in the editor
    scroller.scrollTop = row.offsetTop - atInEditor;
  } else {
    scroller.scrollTop = ta.scrollTop;
  }
  scroller.scrollLeft = ta.scrollLeft;

  /* Holding Ctrl turns the mouse wheel into page zoom, anywhere on the page.
     While the peek is up the wheel scrolls it instead, and never zooms. */
  _peekWheel = (e) => {
    if (!e.ctrlKey && !el.contains(e.target)) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? lh : 1;
    scroller.scrollTop += e.deltaY * k;
    scroller.scrollLeft += e.deltaX * k;
  };
  window.addEventListener('wheel', _peekWheel, { passive: false, capture: true });
}

let _peekWheel = null;

/**
 * The editor's own colours and gutter metrics, as custom properties for the
 * overlay: its background and text (it was a fixed dark grey whatever the
 * theme), and where the gutter's digits sit, so the overlay's line numbers
 * land on them.
 */
function _peekThemeVars(pre, text, gutter) {
  let bg = '';
  for (let n = pre; n && n !== document.documentElement; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c)) { bg = c; break; }
  }
  let out = (bg ? `--cp-bg:${bg};` : '') + `--cp-fg:${getComputedStyle(text).color};`;
  const no = gutter && gutter.querySelector('.line-num:not(.active) .ln-no, .line-num .ln-no');
  if (no && gutter.offsetWidth) {
    const g = gutter.getBoundingClientRect(), r = no.getBoundingClientRect();
    const ns = getComputedStyle(no), gs = getComputedStyle(gutter);
    out += `--cp-ln-left:${(r.left - g.left).toFixed(2)}px;--cp-ln-w:${r.width.toFixed(2)}px;`
      + `--cp-ln-color:${ns.color};--cp-ln-size:${ns.fontSize};--cp-ln-font:${gs.fontFamily};`
      + `--cp-ln-bg:${gs.backgroundColor && !/rgba\([^)]*,\s*0\)$/.test(gs.backgroundColor) ? gs.backgroundColor : (bg || 'transparent')};`;
  }
  return out;
}

/** With word wrap on: the top of every line on screen, measured by laying the
    editor's text out again in a hidden copy of the highlight layer. */
function _peekWrappedTops(ta, pre, text) {
  const ps = getComputedStyle(pre), ts = getComputedStyle(text);
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;'
    + `width:${pre.clientWidth}px;box-sizing:border-box;padding:${ps.padding};`
    + `font:${ts.font};letter-spacing:${ts.letterSpacing};tab-size:${ts.tabSize};line-height:${ts.lineHeight};`
    + 'white-space:pre-wrap;overflow-wrap:break-word;';
  ta.value.split('\n').forEach(line => {
    const d = document.createElement('div');
    d.textContent = line || '​';
    probe.appendChild(d);
  });
  (pre.parentElement || document.body).appendChild(probe);
  const tops = [...probe.children].map(d => d.offsetTop);
  probe.remove();
  return tops;
}

function codePeekHide() {
  if (_peekWheel) { window.removeEventListener('wheel', _peekWheel, { capture: true }); _peekWheel = null; }
  if (!_peekEl) return;
  _peekEl.remove();
  _peekEl = null;
}

/** The eye in the editor toolbar: shows while held, for mouse and touch. */
function codePeekHold(e) {
  if (e) e.preventDefault();
  codePeekShow();
  const end = () => {
    codePeekHide();
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

/* Ctrl+Space down shows it, letting go of either key hides it. Capture phase,
   so the editor never sees the chord and types a space. */
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  if (!codePeekAvailable()) return;
  e.preventDefault();
  e.stopPropagation();
  if (!e.repeat) codePeekShow();
}, true);
document.addEventListener('keyup', (e) => {
  if (_peekEl && (e.code === 'Space' || e.key === 'Control')) codePeekHide();
}, true);
// A key let go in another window would never reach us.
window.addEventListener('blur', codePeekHide);
document.addEventListener('visibilitychange', () => { if (document.hidden) codePeekHide(); });

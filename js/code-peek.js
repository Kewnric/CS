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

const PEEK_TOKEN = /\s+|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|[A-Za-z_]\w*|\.?\d[\w.]*|->|\+\+|--|<<=|>>=|<<|>>|&&|\|\||[-+*\/%&|^!=<>]=|./y;

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
        toks.push({ t: line.slice(i, stop), k: 'c' });
        if (end >= 0) inBlock = false;
        i = stop;
        continue;
      }
      if (line.startsWith('//', i)) { toks.push({ t: line.slice(i), k: 'c' }); break; }
      if (line.startsWith('/*', i)) {
        const end = line.indexOf('*/', i + 2);
        const stop = end < 0 ? line.length : end + 2;
        toks.push({ t: line.slice(i, stop), k: 'c' });
        if (end < 0) inBlock = true;
        i = stop;
        continue;
      }
      PEEK_TOKEN.lastIndex = i;
      const m = PEEK_TOKEN.exec(line);
      const t = m ? m[0] : line[i];
      toks.push({ t, k: /^\s+$/.test(t) ? 'w' : 'x' });
      i += t.length;
    }
    return toks;
  });
}

/** What a line means, for comparing: its code tokens, nothing else. */
function peekKey(toks) {
  return toks.filter(t => t.k === 'x').map(t => t.t).join('\u0001');
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

/** How alike two lines are, 0..1, by their code tokens. */
function peekSimilar(u, r) {
  const a = u.filter(t => t.k === 'x').map(t => t.t);
  const b = r.filter(t => t.k === 'x').map(t => t.t);
  if (!a.length && !b.length) return 1;
  return (2 * peekLCS(a, b, (x, y) => x === y).length) / (a.length + b.length);
}

/* ── Merging your code with the target ─────────────────────── */

/**
 * The rows to draw, in order. Each is
 *   { kind: 'same' | 'ghost' | 'extra' | 'pair', u: your line index or -1,
 *     uToks, rToks }
 */
function peekMerge(userSrc, refSrc) {
  const U = peekTokenize(userSrc), R = peekTokenize(refSrc);
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
    const sim = (i, j) => {
      const s = peekSimilar(U[us[i]], R[rs[j]]);
      return s >= 0.34 ? s : -1;
    };
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
          rows.push({ kind: 'pair', u: us[i], uToks: U[us[i]], rToks: R[rs[j]] });
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
  const ghostRow = (j) => ({ kind: 'ghost', u: -1, rToks: R[j] });
  /* A line of yours with no counterpart. Blank and comment-only lines are not
     mistakes -- a starter's "// TODO" is meant to be there -- so they are
     drawn as written. */
  const extraRow = (i) => ({ kind: uk[i] ? 'extra' : 'same', u: i, uToks: U[i] });

  for (const [a, b] of matched) {
    hunk(ui, a, ri, b);
    rows.push({ kind: 'same', u: a, uToks: U[a] });
    ui = a + 1; ri = b + 1;
  }
  hunk(ui, U.length, ri, R.length);
  return rows;
}

/* ── Drawing ───────────────────────────────────────────────── */

function peekHL(text) {
  if (!text) return '';
  return typeof syntaxHighlight === 'function' ? syntaxHighlight(text) : escapeHTML(text);
}

const peekJoin = toks => toks.map(t => t.t).join('');

/** A paired line: yours, with the target's missing pieces faint in place and
    your different pieces underlined. */
function peekPairHTML(uToks, rToks) {
  const uc = [], rc = [];
  uToks.forEach((t, i) => { if (t.k === 'x') uc.push(i); });
  rToks.forEach((t, j) => { if (t.k === 'x') rc.push(j); });
  const pairs = peekLCS(uc.map(i => uToks[i].t), rc.map(j => rToks[j].t), (a, b) => a === b);
  const uToR = new Map(pairs.map(([a, b]) => [uc[a], rc[b]]));
  const rMatched = new Set(pairs.map(([, b]) => rc[b]));

  let html = '', rPos = 0, lastChar = '';
  const ghosts = (upTo) => {
    let text = '';
    for (; rPos < upTo; rPos++) {
      const t = rToks[rPos];
      if (t.k !== 'x' || rMatched.has(rPos)) continue;
      const spaced = rPos > 0 && rToks[rPos - 1].k === 'w';
      if (spaced && (text || (lastChar && !/\s/.test(lastChar)))) text += ' ';
      text += t.t;
    }
    if (!text) return;
    // Spaced after, too, where the target is: "i <= n", not "i <=n".
    if (upTo < rToks.length && upTo > 0 && rToks[upTo - 1].k === 'w') text += ' ';
    html += '<span class="cp-ghost">' + peekHL(text) + '</span>';
    lastChar = text.slice(-1);
  };
  uToks.forEach((t, i) => {
    if (uToR.has(i)) {
      ghosts(uToR.get(i));
      rPos = uToR.get(i) + 1;
      html += peekHL(t.t);
    } else if (t.k === 'x') {
      html += '<span class="cp-wrong">' + peekHL(t.t) + '</span>';
    } else {
      html += peekHL(t.t);
    }
    lastChar = t.t.slice(-1);
  });
  ghosts(rToks.length);
  return html;
}

function peekRowsHTML(rows) {
  return rows.map(r => {
    let code, cls = 'cp-row', ln = '';
    if (r.kind === 'ghost') {
      cls += ' cp-row-ghost';
      code = peekHL(peekJoin(r.rToks)) || ' ';
      ln = '+';
    } else {
      ln = String(r.u + 1);
      if (r.kind === 'pair') { cls += ' cp-row-diff'; code = peekPairHTML(r.uToks, r.rToks); }
      else if (r.kind === 'extra') { cls += ' cp-row-diff'; code = '<span class="cp-wrong">' + peekHL(peekJoin(r.uToks)) + '</span>'; }
      else code = peekHL(peekJoin(r.uToks));
    }
    return `<div class="${cls}"${r.u >= 0 ? ` data-u="${r.u}"` : ''}><span class="cp-ln">${ln}</span><span class="cp-code">${code || ' '}</span></div>`;
  }).join('');
}

/* ── Showing it ────────────────────────────────────────────── */

/** On an attempt screen with an editor? */
function codePeekAvailable() {
  const route = document.body.dataset.route;
  return (route === 'practice' || route === 'practice-set') && !!document.getElementById('editor-textarea');
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
  const rows = peekMerge(mine, target);
  const missing = rows.filter(r => r.kind === 'ghost' && peekKey(r.rToks)).length;
  const differ = rows.filter(r => r.kind === 'pair' || r.kind === 'extra').length;

  /* Drawn in the editor's own metrics, so a line that matches lands exactly
     where it already was. Fixed and above everything (the Run Code terminal
     included), sized to the editor's box. */
  const cs = getComputedStyle(ta);
  const rect = box.getBoundingClientRect();
  const el = document.createElement('div');
  el.id = 'code-peek';
  el.className = 'code-peek' + ((typeof edGetWrap === 'function' && edGetWrap()) ? ' cp-wrap' : '');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`
    + `--cp-gutter:${gutter && gutter.offsetWidth ? gutter.offsetWidth : 0}px;`
    + `--cp-pad-top:${cs.paddingTop};--cp-pad-left:${cs.paddingLeft};`
    + `font-family:${cs.fontFamily};font-size:${cs.fontSize};line-height:${cs.lineHeight};tab-size:${cs.tabSize};`;
  el.innerHTML = `
    <div class="cp-badge${!missing && !differ ? ' cp-badge-ok' : ''}">
      ${!missing && !differ ? '✓ Matches the target'
        : (missing ? missing + ' missing' : '') + (missing && differ ? ' · ' : '') + (differ ? differ + ' different' : '')}
      <span class="cp-badge-hint">release to go back</span>
    </div>
    <div class="cp-scroll"><div class="cp-rows">${peekRowsHTML(rows)}</div></div>`;
  document.body.appendChild(el);
  _peekEl = el;

  // Start where you were looking: your top visible line stays at the top.
  const scroller = el.querySelector('.cp-scroll');
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 21;
  const pad = parseFloat(cs.paddingTop) || 0;
  const top = Math.max(0, ta.scrollTop - pad);
  const firstLine = Math.floor(top / lh);
  const row = el.querySelector(`.cp-row[data-u="${firstLine}"]`)
    || [...el.querySelectorAll('.cp-row[data-u]')].find(r => Number(r.dataset.u) >= firstLine);
  if (row) scroller.scrollTop = row.offsetTop - pad + (top % lh);
  scroller.scrollLeft = ta.scrollLeft;

  // Holding Ctrl turns the wheel into page zoom; here it scrolls the peek.
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? lh : 1;
    scroller.scrollTop += e.deltaY * k;
    scroller.scrollLeft += e.deltaX * k;
  }, { passive: false });
}

function codePeekHide() {
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

/* Ultima: the core engine and the three themes of Elements/welcome-windows-login-transitions.html
   (Ultima/library copy, lines 108-2530), copied verbatim. Loaded on demand by js/themes.js.
   Every block is an IIFE; the only global is window.G. */
/* ===== Core engine: stage, timeline context, shared effects ===== */
(() => {
const W = 960, H = 600;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const G = window.G = { W, H, name: 'Aster', themes: [] };

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
G.esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
G.el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
G.add = (p, html) => { const e = G.el(html); p.appendChild(e); return e; };
G.under = (p, html) => { const e = G.el(html); p.insertBefore(e, p.firstChild); return e; };
G.split = (text, cls = 'ch', extra) => [...String(text)].map((c, i) =>
  `<span class="${cls}" style="--i:${i}${extra ? ';' + extra(i) : ''}">${c === ' ' ? '&nbsp;' : G.esc(c)}</span>`).join('');
G.rand = (a, b) => a + Math.random() * (b - a);
G.pick = a => a[Math.floor(Math.random() * a.length)];
G.css = s => { const st = document.createElement('style'); st.textContent = s; document.head.appendChild(st); };
G.theme = t => G.themes.push(t);
G.fit = (text, max, width, k = 0.6) => Math.min(max, Math.floor(width / (Math.max(1, String(text).length) * k)));
G.initial = n => (String(n).trim()[0] || 'A').toUpperCase();
G.greet = () => { const h = new Date().getHours(); return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
G.clock = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

const I = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
G.ico = {
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.6c2 .8 3.3 2.6 4 5.4"/>'),
  bag: I('<path d="M5 8h14l-1.2 13H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  gear: I('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'),
  pin: I('<path d="M12 21s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
  gift: I('<rect x="3.5" y="9" width="17" height="11.5" rx="1"/><path d="M3.5 13h17M12 9v11.5"/><path d="M12 9C10.5 5.5 7 5 7 7.2 7 9 10 9 12 9zm0 0c1.5-3.5 5-4 5-1.8C17 9 14 9 12 9z"/>'),
  check: I('<path d="M4.5 12.5l4.8 4.8L19.5 7"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  bolt: I('<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>'),
  shield: I('<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/>'),
  star: I('<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6-4.5-4.2 6.1-.8z"/>'),
  chat: I('<path d="M4 5h16v11H9l-5 4z"/>'),
  lock: I('<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  unlock: I('<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.8"/>'),
  key: I('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>'),
  clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  chev: I('<path d="M9 5l7 7-7 7"/>'),
  play: I('<path d="M8 5.5v13l10.5-6.5z"/>'),
  replay: I('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v4.5h4.5"/>'),
  expand: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  heart: I('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>'),
  map: I('<path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>'),
  eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
};

/* ---------- Run context: everything an animation needs, all cancellable ---------- */
function makeCtx(scale, hooks = {}) {
  const ctx = { alive: true, name: G.name, _c: [], started: false };
  ctx.res = Math.min(2.5, Math.max(1, scale * DPR));
  ctx.on = f => ctx._c.push(f);
  ctx.wait = ms => new Promise(r => { const t = setTimeout(() => { if (ctx.alive) r(); }, ms); ctx._c.push(() => clearTimeout(t)); });
  ctx.raf = fn => {
    let id, t0 = null, last = null;
    const loop = t => {
      if (!ctx.alive) return;
      if (t0 === null) t0 = last = t;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (fn((t - t0) / 1000, dt) !== false) id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    ctx._c.push(() => cancelAnimationFrame(id));
  };
  ctx.every = (ms, fn) => { const t = setInterval(() => ctx.alive && fn(), ms); ctx._c.push(() => clearInterval(t)); };
  ctx.canvas = (parent, cls = '', first = false) => {
    const c = document.createElement('canvas');
    c.width = Math.round(W * ctx.res); c.height = Math.round(H * ctx.res);
    c.className = 'fx ' + cls;
    const g = c.getContext('2d'); g.setTransform(ctx.res, 0, 0, ctx.res, 0, 0);
    first ? parent.prepend(c) : parent.appendChild(c);
    g.el = c; return g;
  };
  ctx.type = async (el, text, speed = 34) => {
    el.textContent = '';
    for (const ch of text) { if (!ctx.alive) return; el.textContent += ch; await ctx.wait(speed); }
  };
  ctx.count = (el, from, to, ms, fmt = v => Math.round(v).toLocaleString('en-US')) => new Promise(r => {
    ctx.raf(t => {
      const p = Math.min(1, t * 1000 / ms), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p >= 1) { r(); return false; }
    });
  });
  ctx.step = i => hooks.step && hooks.step(i);
  ctx.kill = () => { if (!ctx.alive) return; ctx.alive = false; ctx._c.forEach(f => { try { f(); } catch (e) {} }); ctx._c = []; };
  return ctx;
}
G.makeCtx = makeCtx;

/* ---------- Stage: fixed 960x600 viewport scaled to its box ---------- */
G.makeStage = () => {
  const el = G.el('<div class="stage"><div class="vp"></div></div>');
  const st = { el, vp: el.firstChild, ctx: null, scale: 1 };
  st.fit = () => { const w = el.clientWidth || W; st.scale = w / W; st.vp.style.transform = `scale(${st.scale})`; };
  new ResizeObserver(st.fit).observe(el);
  return st;
};
G.clear = st => { if (st.ctx) { st.ctx.kill(); st.ctx = null; } st.vp.innerHTML = ''; };

G.mountWelcome = (st, theme, w) => {
  G.clear(st); st.fit();
  st.vp.className = 'vp th-' + theme.key;
  const ctx = st.ctx = makeCtx(st.scale);
  ctx.vp = st.vp; ctx.theme = theme;
  ctx.bgEl = theme.bg(st.vp, ctx);
  const L = G.add(st.vp, '<div class="layer"></div>');
  w.build(L, ctx);
  return ctx;
};

G.mountTransition = (st, theme, t, h = {}) => {
  G.clear(st); st.fit();
  st.vp.className = 'vp th-' + theme.key;
  const ctx = st.ctx = makeCtx(st.scale, h);
  ctx.vp = st.vp; ctx.theme = theme;
  ctx.bgEl = theme.bg(st.vp, ctx);
  const L = G.add(st.vp, '<div class="layer"></div>');
  const lg = theme.login(L, ctx);
  ctx.play = async () => {
    if (ctx.started || !ctx.alive) return;
    ctx.started = true; h.onStart && h.onStart();
    if (lg.btn) lg.btn.disabled = true;
    ctx.step(0);
    await t.run(L, ctx, lg);
    await ctx.wait(400);
    if (ctx.alive) h.onDone && h.onDone();
  };
  if (lg.btn) lg.btn.addEventListener('click', () => ctx.play());
  ctx.step(0);
  if (h.autoplay) ctx.wait(450).then(ctx.play);
  return ctx;
};

/* ---------- Login helper: types the name + password, presses the button ---------- */
G.loginKit = (root, ctx) => {
  const q = s => root.querySelector(s);
  const u = q('[data-u]'), p = q('[data-p]'), btn = q('[data-btn]'), stx = q('[data-status]');
  const fu = u && u.closest('[data-f]'), fp = p && p.closest('[data-f]');
  return {
    root, btn,
    async fill() {
      fu && fu.classList.add('focus');
      await ctx.type(u, ctx.name.toLowerCase().replace(/\s+/g, '.'), 62);
      await ctx.wait(160);
      fu && fu.classList.remove('focus'); fp && fp.classList.add('focus');
      p.textContent = '';
      for (let i = 0; i < 10; i++) { p.textContent += '•'; await ctx.wait(42); }
      await ctx.wait(220);
      fp && fp.classList.remove('focus');
      btn.classList.add('press'); await ctx.wait(170); btn.classList.remove('press');
    },
    status(text, state = '') { if (stx) { stx.textContent = text; stx.dataset.state = state; } },
  };
};

/* Put a welcome window on top of a main page, with a soft scrim behind it */
G.welcomeOver = (L, ctx, w, scrim = true) => {
  if (scrim) G.add(L, `<div class="layer scrim"></div>`);
  const l = G.add(L, '<div class="layer"></div>');
  w.build(l, ctx);
  return l;
};

/* ---------- Effects ---------- */
G.shake = (el, ms = 420, amp = 8) => {
  const k = [];
  for (let i = 0; i < 9; i++) { const f = 1 - i / 9; k.push({ transform: `translate(${G.rand(-amp, amp) * f}px,${G.rand(-amp, amp) * f}px)` }); }
  k.push({ transform: 'none' });
  el.animate(k, { duration: ms, easing: 'linear' });
};

G.flash = (L, bg = '#fff', inMs = 220) => {
  const e = G.add(L, `<div class="layer" style="background:${bg};pointer-events:none"></div>`);
  e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: inMs, fill: 'forwards' });
  e.out = (ms = 900) => { const a = e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards', easing: 'ease-out' }); a.onfinish = () => e.remove(); };
  return e;
};

/* Warp / hyperspace streak tunnel on canvas */
G.warp = (parent, ctx, o = {}) => {
  const g = ctx.canvas(parent, o.cls || '');
  const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, N = o.n || 360, dur = o.dur || 2.5;
  const color = o.color || (() => `hsl(${G.rand(0, 360)},100%,70%)`);
  const reset = (p, far) => { p.a = G.rand(0, Math.PI * 2); p.z = far ? G.rand(0.8, 1.3) : G.rand(0.06, 1.3); p.c = color(); p.w = G.rand(0.6, 2.2); return p; };
  const P = Array.from({ length: N }, () => reset({}, false));
  g.fillStyle = o.base || '#000'; g.fillRect(0, 0, W, H);
  ctx.raf((t, dt) => {
    const k = Math.min(1, t / dur);
    const speed = (o.v0 ?? 0.25) + (o.v1 ?? 2.4) * k * k;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = o.trail || 'rgba(0,0,0,0.32)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const p of P) {
      p.z -= dt * speed;
      if (p.z <= 0.04) { reset(p, true); continue; }
      const tail = p.z + 0.015 + speed * 0.05;
      const r1 = 60 / p.z, r0 = 60 / tail;
      const ca = Math.cos(p.a), sa = Math.sin(p.a);
      g.strokeStyle = p.c; g.globalAlpha = Math.min(1, 1.35 - p.z);
      g.lineWidth = p.w * (1.5 - p.z) * 1.6;
      g.beginPath(); g.moveTo(cx + ca * r0, cy + sa * r0); g.lineTo(cx + ca * r1, cy + sa * r1); g.stroke();
    }
    g.globalAlpha = 1;
    if (o.glow) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 60 + 420 * k * k);
      gr.addColorStop(0, o.glowColor ? o.glowColor(0.12 + 0.55 * k) : `rgba(255,255,255,${0.12 + 0.55 * k})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (!o.loop && t > dur + (o.tail || 0.6)) return false;
  });
  return g;
};

/* Clone the given layers into clipped polygon pieces (each piece sized to its own box) */
G.pieces = (L, sources, polys, cls = '') => {
  const wrap = G.add(L, `<div class="layer pieces ${cls}"></div>`);
  const snap = document.createElement('div');
  snap.className = 'snap';
  sources.forEach(s => snap.appendChild(s.cloneNode(true)));
  const list = polys.map(poly => {
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const x0 = Math.floor(Math.max(0, Math.min(...xs))), y0 = Math.floor(Math.max(0, Math.min(...ys)));
    const x1 = Math.ceil(Math.min(W, Math.max(...xs))), y1 = Math.ceil(Math.min(H, Math.max(...ys)));
    const e = document.createElement('div');
    e.className = 'piece';
    e.style.cssText = `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px;clip-path:polygon(${poly.map(p => (p[0] - x0).toFixed(1) + 'px ' + (p[1] - y0).toFixed(1) + 'px').join(',')})`;
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    e.style.transformOrigin = `${(cx - x0).toFixed(1)}px ${(cy - y0).toFixed(1)}px`;
    const s = snap.cloneNode(true); s.style.left = -x0 + 'px'; s.style.top = -y0 + 'px';
    e.appendChild(s); wrap.appendChild(e);
    return { el: e, cx, cy, poly };
  });
  sources.forEach(s => (s.style.visibility = 'hidden'));
  return { wrap, list };
};

/* Glass-style shatter of the given layers */
G.shatter = (L, sources, o = {}) => {
  const cols = o.cols || 7, rows = o.rows || 4, cw = W / cols, rh = H / rows, j = o.jitter ?? 0.36;
  const P = [];
  for (let r = 0; r <= rows; r++) {
    P[r] = [];
    for (let c = 0; c <= cols; c++) {
      let x = c * cw, y = r * rh;
      if (c > 0 && c < cols) x += G.rand(-1, 1) * cw * j;
      if (r > 0 && r < rows) y += G.rand(-1, 1) * rh * j;
      P[r][c] = [x, y];
    }
  }
  const tris = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = P[r][c], b = P[r][c + 1], cc = P[r + 1][c + 1], d = P[r + 1][c];
    if ((r + c) % 2) tris.push([a, b, cc], [a, cc, d]); else tris.push([a, b, d], [b, cc, d]);
  }
  const pc = G.pieces(L, sources, tris, 'shatter');
  pc.wrap.style.perspective = '1100px';
  const ox = o.x ?? W / 2, oy = o.y ?? H / 2;
  const svg = G.add(pc.wrap, `<svg class="cracks" viewBox="0 0 ${W} ${H}" aria-hidden="true">${tris.map(t => `<polygon points="${t.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`).join('')}</svg>`);
  return {
    wrap: pc.wrap,
    crack() {
      svg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, fill: 'forwards' });
      pc.list.forEach(p => {
        const dx = p.cx - ox, dy = p.cy - oy, d = Math.hypot(dx, dy) || 1, m = G.rand(2, 7);
        p.off = [dx / d * m, dy / d * m];
        p.el.animate([{ transform: 'none' }, { transform: `translate(${p.off[0]}px,${p.off[1]}px)` }], { duration: 160, fill: 'forwards', easing: 'ease-out' });
      });
    },
    fly(dur = 1400, force = 1) {
      svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      pc.list.forEach(p => {
        const dx = p.cx - ox, dy = p.cy - oy, d = Math.hypot(dx, dy) || 1, off = p.off || [0, 0], sp = G.rand(220, 560) * force;
        p.el.animate([
          { transform: `translate(${off[0]}px,${off[1]}px)`, opacity: 1 },
          { transform: `translate3d(${(dx / d * sp).toFixed(1)}px,${(dy / d * sp + G.rand(80, 260)).toFixed(1)}px,${G.rand(150, 640).toFixed(0)}px) rotate3d(${G.rand(-1, 1).toFixed(2)},${G.rand(-1, 1).toFixed(2)},${G.rand(-.5, .5).toFixed(2)},${G.rand(120, 420).toFixed(0)}deg)`, opacity: 0 },
        ], { duration: dur * G.rand(0.75, 1.1), delay: d * 0.5, easing: 'cubic-bezier(.35,.05,.75,1)', fill: 'forwards' });
      });
    },
  };
};

/* Glitch an element for a moment (jitter + slice) */
G.glitch = (el, ms = 900) => {
  const k = [];
  const n = Math.round(ms / 55);
  for (let i = 0; i < n; i++) {
    const a = G.rand(0, 85), b = G.rand(a + 5, 100);
    const on = Math.random() < 0.55;
    k.push({ transform: `translate(${G.rand(-14, 14).toFixed(1)}px,${G.rand(-3, 3).toFixed(1)}px)`, clipPath: on ? `inset(${a.toFixed(1)}% 0 ${(100 - b).toFixed(1)}% 0)` : 'inset(0 0 0 0)', opacity: Math.random() < 0.15 ? 0.4 : 1, easing: 'steps(1,end)' });
  }
  k.push({ transform: 'none', clipPath: 'inset(0 0 0 0)', opacity: 1 });
  return el.animate(k, { duration: ms });
};

G.css(`
.layer{position:absolute;inset:0}
.fx{position:absolute;left:0;top:0;width:960px;height:600px;pointer-events:none}
.center{position:absolute;inset:0;display:grid;place-items:center}
.scrim{background:radial-gradient(ellipse 70% 70% at 50% 50%,rgba(0,0,0,.28),rgba(0,0,0,.58));animation:k-fadef .7s ease both;pointer-events:none}
.pieces{pointer-events:none}
.piece{position:absolute;overflow:hidden;will-change:transform,opacity}
.snap{position:absolute;width:960px;height:600px}
.snap,.snap *{animation:none!important;transition:none!important}
.cracks{position:absolute;left:0;top:0;width:960px;height:600px;opacity:0;pointer-events:none}
.cracks polygon{fill:none;stroke:rgba(255,255,255,.9);stroke-width:1.3;filter:drop-shadow(0 0 3px #fff)}
.vp button{cursor:pointer}
@keyframes k-fadef{from{opacity:0}}
@keyframes k-fadeo{to{opacity:0}}
@keyframes k-upf{from{opacity:0;transform:translateY(var(--y,16px))}}
@keyframes k-leftf{from{opacity:0;transform:translateX(var(--x,-28px))}}
@keyframes k-rightf{from{opacity:0;transform:translateX(var(--x,28px))}}
@keyframes k-popf{from{opacity:0;transform:scale(var(--s,.6))}}
@keyframes k-blurf{from{opacity:0;filter:blur(var(--b,10px));transform:scale(var(--sc,1.06))}}
@keyframes k-scalex{from{transform:scaleX(0)}}
@keyframes k-scaley{from{transform:scaleY(0)}}
@keyframes k-spin{to{transform:rotate(360deg)}}
@keyframes k-blink{50%{opacity:0}}
@keyframes k-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.a-fade{animation:k-fadef var(--t,.6s) ease var(--d,0s) both}
.a-up{animation:k-upf var(--t,.7s) cubic-bezier(.2,.8,.2,1) var(--d,0s) both}
.a-left{animation:k-leftf var(--t,.7s) cubic-bezier(.2,.8,.2,1) var(--d,0s) both}
.a-right{animation:k-rightf var(--t,.7s) cubic-bezier(.2,.8,.2,1) var(--d,0s) both}
.a-pop{animation:k-popf var(--t,.55s) cubic-bezier(.3,1.5,.5,1) var(--d,0s) both}
.a-blur{animation:k-blurf var(--t,.9s) cubic-bezier(.2,.8,.2,1) var(--d,0s) both}
.stag .ch{display:inline-block;animation:k-upf .55s cubic-bezier(.2,.8,.2,1) calc(var(--d,0s) + var(--i)*var(--st,45ms)) both}
.stag-b .ch{display:inline-block;animation:k-blurf .7s ease calc(var(--d,0s) + var(--i)*var(--st,45ms)) both}
.draw{stroke-dasharray:1;stroke-dashoffset:1;animation:k-draw var(--t,1s) cubic-bezier(.6,0,.3,1) var(--d,0s) forwards}
.cur::after{content:'';display:inline-block;width:.42em;height:.9em;margin-left:3px;background:currentColor;vertical-align:-.08em;animation:k-blink 1s steps(1) infinite}
[data-f].focus [data-u]::after,[data-f].focus [data-p]::after{content:'';display:inline-block;width:2px;height:1.05em;margin-left:2px;background:var(--caret,currentColor);vertical-align:-.15em;animation:k-blink 1s steps(1) infinite}
.press{transform:scale(.95)!important;filter:brightness(1.2)}
`);
})();

/* ===== Theme 1 — Sword Art Online style (white system panels, orange accents) ===== */
(() => {
const { add, under, split, esc, rand, ico, W, H } = G;

G.css(`
.th-sao{font-family:'Exo 2',system-ui,sans-serif;color:#3c4148;--caret:#f39a1e}
.sao-bg{position:absolute;inset:0;background:radial-gradient(120% 85% at 50% 115%,#6a9cbc 0%,#2a5378 38%,#0f2238 70%,#07101c 100%);overflow:hidden}
.sao-hex{position:absolute;inset:-100px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98'%3E%3Cpath d='M28 66L0 49.5V16.5L28 0l28 16.5v33L28 66zm0 0v32' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E");background-size:56px 98px;opacity:.085;-webkit-mask-image:radial-gradient(ellipse 55% 50% at 50% 55%,#000 15%,transparent 80%);mask-image:radial-gradient(ellipse 55% 50% at 50% 55%,#000 15%,transparent 80%);animation:sao-pan 30s linear infinite}
@keyframes sao-pan{to{transform:translate(56px,98px)}}
.sao-horizon{position:absolute;left:-10%;right:-10%;bottom:-140px;height:320px;background:radial-gradient(50% 50% at 50% 50%,rgba(255,210,150,.32),transparent 70%)}
.sao-mote{position:absolute;bottom:-10px;width:var(--s);height:var(--s);border-radius:50%;background:#fff;box-shadow:0 0 6px 2px rgba(200,230,255,.7);opacity:0;animation:sao-rise var(--du) linear var(--dl) infinite}
@keyframes sao-rise{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}80%{opacity:.5}100%{transform:translate(var(--dx),-640px);opacity:0}}

.sao-panel{position:relative;background:linear-gradient(180deg,rgba(252,253,254,.97),rgba(228,232,236,.95));border-radius:4px;box-shadow:0 18px 50px rgba(0,10,30,.45),0 0 0 1px rgba(120,130,140,.35);color:#4a5058;overflow:hidden}
.sao-head{height:46px;display:flex;align-items:center;justify-content:center;gap:14px;font-weight:600;letter-spacing:.3em;font-size:13.5px;color:#6a717a;background:linear-gradient(#ffffff,#eceff2);border-bottom:1px solid #cfd4da;padding-left:.3em}
.sao-head::before,.sao-head::after{content:'';width:30px;height:1px;background:#bcc3cb}
.sao-circ{width:52px;height:52px;border-radius:50%;border:0;padding:0;background:radial-gradient(circle at 50% 35%,#fff,#e2e6ea);box-shadow:0 3px 10px rgba(0,0,0,.22),0 0 0 1px #c9ced4 inset;display:grid;place-items:center;color:#6b727b}
.sao-circ .i{width:24px;height:24px}
.sao-ok{position:relative;color:#fff;background:radial-gradient(circle at 50% 35%,#ffc56b,#f39a1e);box-shadow:0 3px 14px rgba(243,154,30,.55)}
.sao-ok::before{content:'';width:20px;height:20px;border-radius:50%;border:3px solid currentColor;box-sizing:border-box}
.sao-ok::after{content:'';position:absolute;inset:-2px;border-radius:50%;border:2px solid #ffb547;animation:sao-ping 1.8s ease-out 1.2s infinite;opacity:0}
@keyframes sao-ping{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.75);opacity:0}}
.sao-or{color:#ef8d12}

/* W1 */
.sao-w1{position:relative;width:540px}
.sao-w1-seam{position:absolute;left:50%;top:50%;height:2px;width:580px;margin-left:-290px;background:linear-gradient(90deg,transparent,#ffb84d 20%,#fff 50%,#ffb84d 80%,transparent);box-shadow:0 0 14px 3px rgba(255,170,60,.75);animation:sao-seam 1.5s cubic-bezier(.7,0,.2,1) both;z-index:3}
@keyframes sao-seam{0%{transform:scaleX(0);opacity:1}35%{transform:scaleX(1);opacity:1}62%{transform:scaleX(1) scaleY(1);opacity:1}100%{transform:scaleX(1) scaleY(.2);opacity:0}}
.sao-w1-box{animation:sao-open .7s cubic-bezier(.2,.8,.2,1) .55s both}
@keyframes sao-open{from{clip-path:inset(50% 0 50% 0)}to{clip-path:inset(0 0 0 0)}}
.sao-w1-body{padding:26px 36px 28px;text-align:center}
.sao-w1-k{font-size:14px;letter-spacing:.34em;color:#8a919a;text-transform:uppercase}
.sao-w1-name{font-size:54px;font-weight:300;color:#3b4047;margin:6px 0 10px;line-height:1.1}
.sao-w1-meta{display:flex;justify-content:center;align-items:center;gap:12px;font-size:13px;color:#7d848d;letter-spacing:.06em}
.sao-w1-meta i{width:4px;height:4px;border-radius:50%;background:#f5a623}
.sao-w1-btns{margin-top:20px;display:flex;justify-content:center}
.sao-shine{position:absolute;inset:0;background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.95) 50%,transparent 58%);background-size:260% 100%;background-position:130% 0;animation:sao-shine 1.1s ease 1.9s both;pointer-events:none}
@keyframes sao-shine{from{background-position:130% 0}to{background-position:-30% 0}}

/* W2 */
.sao-w2{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center}
.sao-rays{position:absolute;left:50%;top:50%;width:1300px;height:1300px;margin:-650px 0 0 -650px;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.09) 0deg 2.5deg,transparent 2.5deg 14deg);-webkit-mask-image:radial-gradient(circle,#000 0,transparent 52%);mask-image:radial-gradient(circle,#000 0,transparent 52%);animation:k-spin 80s linear infinite,k-fadef 2.4s ease both}
.sao-w2-small{font-size:13px;letter-spacing:.55em;color:#cfe3f2;margin-right:-.55em}
.sao-w2-big{font-size:104px;font-weight:200;letter-spacing:.3em;margin-right:-.3em;line-height:1.05;text-shadow:0 0 30px rgba(170,220,255,.55);animation:sao-spread 1.8s cubic-bezier(.2,.7,.1,1) .3s both}
@keyframes sao-spread{from{letter-spacing:1.1em;margin-right:-1.1em;opacity:0;filter:blur(14px)}}
.sao-w2-name{font-size:38px;font-weight:600;letter-spacing:.16em;margin-right:-.16em;color:#ffbb55;text-shadow:0 0 18px rgba(255,170,60,.55)}
.sao-w2-line{width:440px;height:2px;margin:18px auto 14px;background:linear-gradient(90deg,transparent,#ffb84d,#fff,#ffb84d,transparent);animation:k-scalex .9s cubic-bezier(.7,0,.2,1) 1.5s both}
.sao-w2-sub{font-size:15px;letter-spacing:.28em;color:#d9e8f3;margin-right:-.28em}
.sao-hexf{position:absolute;width:var(--s);height:calc(var(--s)*1.15);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:rgba(255,255,255,.14);animation:sao-hexf var(--du) ease-in-out var(--dl) infinite alternate}
@keyframes sao-hexf{from{transform:translateY(0) rotate(0)}to{transform:translateY(-40px) rotate(30deg)}}

/* W3 */
.sao-w3-col{position:absolute;left:226px;top:118px;display:flex;flex-direction:column;gap:16px}
.sao-orb{position:relative;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#fff,#dfe3e8);box-shadow:0 4px 14px rgba(0,0,0,.3),0 0 0 1px #c9ced4 inset;display:grid;place-items:center;color:#6b727b;animation:sao-drop .75s cubic-bezier(.3,1.45,.5,1) calc(.15s + var(--i)*.09s) both}
.sao-orb .i{width:26px;height:26px}
.sao-orb.on{background:radial-gradient(circle at 50% 35%,#ffc56b,#f39a1e);color:#fff;box-shadow:0 4px 18px rgba(243,154,30,.6)}
.sao-orb.on::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:2px solid #ffb547;animation:sao-ping 1.8s ease-out 1.2s infinite;opacity:0}
@keyframes sao-drop{from{transform:translateY(-140px);opacity:0}}
.sao-w3-link{position:absolute;left:292px;top:147px;width:50px;height:2px;background:#ffb547;box-shadow:0 0 8px #ffa726;transform-origin:left;animation:k-scalex .3s ease .78s both}
.sao-w3-p{position:absolute;left:342px;top:118px;width:400px;animation:sao-slide .6s cubic-bezier(.2,.8,.2,1) .9s both}
@keyframes sao-slide{from{clip-path:inset(0 100% 0 0);transform:translateX(-14px)}to{clip-path:inset(0 0 0 0)}}
.sao-w3-b{padding:22px 26px 20px}
.sao-w3-top{display:flex;gap:18px;align-items:center}
.sao-av{flex:none;width:78px;height:78px;border-radius:50%;display:grid;place-items:center;font-size:34px;font-weight:600;color:#fff;background:radial-gradient(circle at 50% 30%,#ffc56b,#e9850c);box-shadow:0 0 0 4px #fff,0 0 0 5px #f5a623,0 6px 16px rgba(0,0,0,.25)}
.sao-k{font-size:12px;letter-spacing:.3em;color:#8a919a;text-transform:uppercase}
.sao-w3-n{font-size:34px;font-weight:600;color:#3b4047;line-height:1.15}
.sao-w3-lv{font-size:13.5px;color:#7d848d}
.sao-hp{margin-top:18px}
.sao-hp-l{display:flex;justify-content:space-between;font-size:12px;color:#7d848d;letter-spacing:.08em;margin-bottom:6px}
.sao-hp-t{height:10px;border-radius:5px;background:#d4d9de;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.15)}
.sao-hp-t i{display:block;height:100%;background:linear-gradient(90deg,#55d35a,#9cf46a);animation:sao-bar 1.3s cubic-bezier(.3,.7,.2,1) var(--d,1.4s) both}
@keyframes sao-bar{from{width:0}}
.sao-w3-rows{margin-top:16px;border-top:1px solid #d3d8dd}
.sao-w3-rows div{display:flex;justify-content:space-between;font-size:14px;padding:9px 0;border-bottom:1px solid #e1e5e9;color:#5d646c}
.sao-w3-rows b{color:#3b4047;font-weight:600}

/* W4 */
.sao-hud{position:absolute;left:36px;top:32px;animation:k-leftf .6s cubic-bezier(.2,.8,.2,1) .2s both}
.sao-hud-row{display:flex;align-items:center;gap:10px}
.sao-hud-nm{background:rgba(255,255,255,.94);color:#444b53;font-weight:600;font-size:15px;padding:5px 22px 5px 14px;clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%);letter-spacing:.04em}
.sao-hud-bar{position:relative;width:330px;height:18px;margin-top:6px;background:rgba(8,18,30,.6);border:1px solid rgba(255,255,255,.75);transform:skewX(-22deg);box-shadow:0 0 0 1px rgba(0,0,0,.3)}
.sao-hud-bar i{position:absolute;left:2px;top:2px;bottom:2px;width:calc(100% - 4px);background:linear-gradient(#b4ff8a,#46d43c);box-shadow:0 0 10px rgba(110,255,90,.55);animation:sao-bar 1.5s cubic-bezier(.3,.7,.2,1) .6s both}
.sao-hud-num{margin-top:6px;font-size:13px;color:#fff;letter-spacing:.06em;text-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;gap:16px}
.sao-hud-num b{font-weight:600}
.sao-party{margin-top:14px;display:flex;flex-direction:column;gap:8px}
.sao-party .p{display:flex;align-items:center;gap:10px;font-size:12px;color:#e7eef5;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.sao-party .p span{width:54px}
.sao-party .t{width:180px;height:8px;background:rgba(8,18,30,.6);border:1px solid rgba(255,255,255,.6);transform:skewX(-22deg);overflow:hidden}
.sao-party .t i{display:block;height:100%;background:linear-gradient(#b4ff8a,#46d43c)}
.sao-w4-c{position:absolute;left:0;right:0;top:262px;display:flex;flex-direction:column;align-items:center;color:#fff;text-shadow:0 2px 14px rgba(0,20,40,.55)}
.sao-w4-r{display:flex;align-items:center;gap:26px}
.sao-w4-r .l{height:1px;width:200px;background:linear-gradient(90deg,transparent,#fff);animation:k-leftf .9s cubic-bezier(.2,.8,.2,1) .9s both;--x:-220px}
.sao-w4-r .r{height:1px;width:200px;background:linear-gradient(270deg,transparent,#fff);animation:k-rightf .9s cubic-bezier(.2,.8,.2,1) .9s both;--x:220px}
.sao-w4-t{font-size:42px;font-weight:300;letter-spacing:.32em;margin-right:-.32em}
.sao-w4-s{margin-top:12px;font-size:13px;letter-spacing:.42em;color:#ffcd85;margin-right:-.42em}

/* W5 */
.sao-dim{position:absolute;inset:0;background:rgba(5,12,22,.42);animation:k-fadef .4s both}
.sao-w5{position:relative;width:450px;animation:sao-pop .6s cubic-bezier(.3,1.5,.5,1) .2s both}
@keyframes sao-pop{from{transform:scale(.3);opacity:0}}
.sao-w5-ico{position:absolute;left:50%;top:-31px;margin-left:-31px;width:62px;height:62px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#fff,#e2e6ea);box-shadow:0 4px 14px rgba(0,0,0,.3),0 0 0 3px #f5a623 inset;display:grid;place-items:center;font-size:32px;font-weight:700;color:#f39a1e;z-index:2;animation:sao-pop .5s cubic-bezier(.3,1.7,.5,1) .6s both}
.sao-w5-box{padding:46px 38px 26px;text-align:center}
.sao-w5-t{font-size:22px;font-weight:600;letter-spacing:.14em;color:#4d535b}
.sao-w5-m{font-size:16px;line-height:1.65;color:#6a717a;margin:12px 0 22px}
.sao-w5-m b{color:#e0820c;font-weight:600}
.sao-w5-btns{display:flex;justify-content:center;gap:34px}

/* W6 */
.sao-w6{position:relative;width:520px;height:280px}
.sao-shd{position:absolute;background:linear-gradient(180deg,#fff 0,#eef0f3 46px,#cfd4da 46px,#cfd4da 47px,#fbfcfd 47px,#e2e6ea 100%);background-size:520px 280px;animation:sao-shd 1.15s cubic-bezier(.2,.85,.25,1) var(--dl) both}
@keyframes sao-shd{from{transform:translate(var(--tx),var(--ty)) rotate(var(--r)) scale(.5);opacity:0}}
.sao-w6-solid{position:absolute;inset:0;animation:k-fadef .35s ease 1.75s both;box-shadow:0 18px 50px rgba(0,10,30,.45),0 0 0 1px rgba(120,130,140,.35)}
.sao-w6-flash{position:absolute;inset:-6px;border-radius:6px;box-shadow:0 0 0 2px #ffb547,0 0 30px 6px rgba(255,170,60,.7);opacity:0;animation:sao-fl .9s ease 1.7s both}
@keyframes sao-fl{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
.sao-w6-b{padding:28px 36px;text-align:center}
.sao-w6-n{font-size:48px;font-weight:300;color:#3b4047;margin:4px 0 16px}
.sao-w6-st{display:flex;justify-content:center;gap:12px}
.sao-w6-st div{border:1px solid #d3d8dd;border-radius:3px;padding:8px 14px;min-width:120px;background:rgba(255,255,255,.6)}
.sao-w6-st span{display:block;font-size:11px;letter-spacing:.2em;color:#8a919a}
.sao-w6-st b{font-size:17px;color:#3b4047;font-weight:600}

/* W7 */
.sao-w7{position:relative;width:620px;height:290px}
.sao-w7-g{position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,.05));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.24);color:#fff;padding:34px 46px;animation:sao-wipe 1.3s cubic-bezier(.6,0,.3,1) .3s both}
@keyframes sao-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.sao-w7-bar{position:absolute;top:-24px;bottom:-24px;left:0;width:3px;background:#fff;box-shadow:0 0 16px 4px rgba(140,220,255,.9),0 0 60px 14px rgba(140,220,255,.35);animation:sao-scan 1.3s cubic-bezier(.6,0,.3,1) .3s both}
@keyframes sao-scan{0%{transform:translateX(0);opacity:0}6%{opacity:1}92%{opacity:1}100%{transform:translateX(620px);opacity:0}}
.sao-cn{position:absolute;width:18px;height:18px;border-color:#ffb547;border-style:solid;border-width:0}
.sao-cn.tl{left:-1px;top:-1px;border-left-width:2px;border-top-width:2px}.sao-cn.tr{right:-1px;top:-1px;border-right-width:2px;border-top-width:2px}
.sao-cn.bl{left:-1px;bottom:-1px;border-left-width:2px;border-bottom-width:2px}.sao-cn.br{right:-1px;bottom:-1px;border-right-width:2px;border-bottom-width:2px}
.sao-w7-k{font-size:12px;letter-spacing:.42em;color:#9fe0ff}
.sao-w7-t{font-size:44px;font-weight:300;margin:10px 0 22px;line-height:1.1}
.sao-w7-t b{font-weight:600;color:#ffc06a}
.sao-w7-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;border-top:1px solid rgba(255,255,255,.22);padding-top:18px}
.sao-w7-cols span{display:block;font-size:11px;letter-spacing:.24em;color:#b9d4e6}
.sao-w7-cols b{font-size:16px;font-weight:500}

/* W8 */
.sao-w8-list{position:absolute;right:38px;top:92px;display:flex;flex-direction:column;gap:12px;width:350px}
.sao-toast{position:relative;display:flex;align-items:center;gap:14px;padding:12px 16px;background:linear-gradient(180deg,rgba(252,253,254,.97),rgba(232,236,240,.95));border-radius:4px;box-shadow:0 10px 30px rgba(0,10,30,.35);overflow:hidden;animation:sao-tin .7s cubic-bezier(.2,1.25,.4,1) var(--d) both}
@keyframes sao-tin{from{transform:translateX(420px);opacity:0}}
.sao-toast .ic{width:40px;height:40px;border-radius:50%;flex:none;display:grid;place-items:center;background:#eef1f4;color:#6b727b;box-shadow:0 0 0 1px #cfd4da inset}
.sao-toast .ic .i{width:20px;height:20px}
.sao-toast .ic.o{background:#f5a623;color:#fff;box-shadow:none}
.sao-toast b{display:block;font-size:15px;color:#3f454d;font-weight:600}
.sao-toast small{font-size:12.5px;color:#7b828b}
.sao-toast time{margin-left:auto;font-size:11px;color:#9aa1aa;align-self:flex-start}
.sao-toast::after{content:'';position:absolute;left:0;bottom:0;height:2px;width:100%;background:#f5a623;transform-origin:left;animation:sao-life 6s linear calc(var(--d) + .6s) both}
@keyframes sao-life{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.sao-w8-big{position:absolute;left:56px;bottom:64px;color:#fff;text-shadow:0 2px 14px rgba(0,20,40,.5)}
.sao-w8-big .k{font-size:12px;letter-spacing:.44em;color:#cfe3f2}
.sao-w8-big .t{font-size:56px;font-weight:200;line-height:1.05;margin-top:8px}
.sao-w8-big .n{font-size:56px;font-weight:600;color:#ffbb55;line-height:1.05}

/* W9 */
.sao-w9w{position:absolute;inset:0;display:grid;place-items:center;perspective:1100px}
.sao-w9{width:540px;height:310px;transform-style:preserve-3d;animation:sao-flip 1.35s cubic-bezier(.2,.9,.25,1.12) .2s both}
@keyframes sao-flip{from{transform:rotateY(-100deg) translateZ(-260px);opacity:0}}
.sao-w9-f{position:absolute;inset:0;animation:sao-float 5s ease-in-out 1.6s infinite}
@keyframes sao-float{50%{transform:translateY(-8px)}}
.sao-w9-c{position:absolute;inset:0;border-radius:16px;overflow:hidden;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .25s ease-out;background:linear-gradient(140deg,#fdfefe 0%,#e8ecf0 60%,#d9dfe5 100%);box-shadow:0 30px 60px rgba(0,10,30,.5),0 0 0 1px rgba(255,255,255,.8) inset;padding:24px 28px;color:#4a5058}
.sao-w9-c::before{content:'';position:absolute;right:-60px;top:-60px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(245,166,35,.22),transparent 65%)}
.sao-w9-holo{position:absolute;inset:0;background:linear-gradient(115deg,transparent 25%,rgba(255,140,200,.35) 38%,rgba(120,220,255,.4) 48%,rgba(255,240,140,.35) 58%,transparent 72%);background-size:320% 100%;mix-blend-mode:multiply;opacity:.6;animation:sao-holo 2.4s ease 1.2s both;pointer-events:none}
@keyframes sao-holo{from{background-position:100% 0}to{background-position:0 0}}
.sao-w9-gl{position:absolute;inset:0;background:radial-gradient(circle at var(--gx,50%) var(--gy,30%),rgba(255,255,255,.75),transparent 45%);mix-blend-mode:soft-light;pointer-events:none}
.sao-w9-top{display:flex;justify-content:space-between;font-size:11.5px;letter-spacing:.3em;color:#8a919a;position:relative}
.sao-w9-m{display:flex;gap:22px;align-items:center;margin:24px 0 22px;position:relative}
.sao-w9-hex{flex:none;width:92px;height:104px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#ffc56b,#e9850c);display:grid;place-items:center;color:#fff;font-size:40px;font-weight:600}
.sao-w9-n{font-size:40px;font-weight:600;color:#3b4047;line-height:1.1}
.sao-w9-r{font-size:13.5px;color:#7d848d;margin-top:4px}
.sao-w9-st{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;position:relative}
.sao-w9-st div{background:rgba(255,255,255,.65);border:1px solid #d6dbe0;border-radius:8px;padding:9px 12px}
.sao-w9-st span{display:block;font-size:10.5px;letter-spacing:.2em;color:#8a919a}
.sao-w9-st b{font-size:17px;color:#3b4047}

/* W10 */
.sao-w10{width:640px;background:rgba(8,16,28,.8);border:1px solid rgba(255,255,255,.22);box-shadow:0 20px 60px rgba(0,0,0,.5);color:#d6e6f2;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:sao-w10 .7s cubic-bezier(.2,.8,.2,1) .1s both}
@keyframes sao-w10{from{clip-path:inset(0 0 100% 0);opacity:0}to{clip-path:inset(0 0 0 0)}}
.sao-w10-h{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.12);border-top:2px solid #f5a623;font-size:12px;letter-spacing:.3em;color:#a9bccb}
.sao-w10-h i{width:9px;height:9px;background:#f5a623;box-shadow:0 0 8px #f5a623}
.sao-w10-h span:last-child{margin-left:auto;letter-spacing:.1em}
.sao-w10-b{padding:18px 24px 22px;font-family:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;font-size:14.5px;line-height:1.95;min-height:232px}
.sao-w10-b .ok{color:#7dffa1}
.sao-w10-b .p{color:#f5a623}
.sao-sync{display:inline-block;width:220px;height:9px;background:rgba(255,255,255,.12);vertical-align:middle;margin:0 10px}
.sao-sync i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f5a623,#ffd27a);box-shadow:0 0 10px #f5a623;transition:width 1.1s linear}
.sao-w10-big{font-family:'Exo 2',sans-serif;font-size:34px;font-weight:300;color:#fff;margin-top:10px;line-height:1.2}
.sao-w10-big b{color:#ffbb55;font-weight:600}

/* Login */
.sao-lg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.sao-lg-k{font-size:12px;letter-spacing:.6em;color:#cfe3f2;margin:0 0 18px .6em}
.sao-lg-box{width:400px;animation:k-upf .7s cubic-bezier(.2,.8,.2,1) both}
.sao-lg-b{padding:24px 30px 22px;display:flex;flex-direction:column;gap:14px}
.sao-fld .lb{display:flex;align-items:center;gap:7px;font-size:11.5px;letter-spacing:.22em;color:#8a919a;margin-bottom:6px}
.sao-fld .lb .i{width:14px;height:14px}
.sao-fld .v{height:42px;border-radius:3px;background:#fff;box-shadow:0 0 0 1px #cfd4da inset;display:flex;align-items:center;padding:0 14px;font-size:16px;color:#3b4047;transition:box-shadow .2s}
.sao-fld.focus .v{box-shadow:0 0 0 2px #f5a623 inset,0 0 12px rgba(245,166,35,.35)}
.sao-fld [data-p]{letter-spacing:.2em}
.sao-lg-btn{margin-top:6px;height:46px;border:0;border-radius:23px;background:linear-gradient(180deg,#ffc56b,#f39a1e);color:#fff;font:600 14px 'Exo 2',sans-serif;letter-spacing:.3em;box-shadow:0 4px 14px rgba(243,154,30,.45);transition:transform .15s,filter .15s}
.sao-lg-btn:disabled{cursor:default}
.sao-lg-st{text-align:center;font-size:12.5px;color:#8a919a;letter-spacing:.08em;min-height:18px}
.sao-lg-st[data-state=busy]{color:#e0820c}
.sao-lg-st[data-state=ok]{color:#3aa34a}
.sao-back{transition:filter .6s,transform .6s,opacity .6s;filter:blur(3px);transform:scale(.94);opacity:.3}

/* Main page */
.sao-main .sky{position:absolute;inset:0;background:linear-gradient(180deg,#152b4a 0%,#2f5b88 38%,#c98a63 74%,#f2c08a 84%,#f6d3a4 100%)}
.sao-main .sun{position:absolute;left:640px;top:330px;width:240px;height:240px;margin:-120px;border-radius:50%;background:radial-gradient(circle,rgba(255,240,210,.95) 0,rgba(255,200,140,.55) 22%,rgba(255,170,100,0) 60%)}
.sao-cl{position:absolute;height:calc(var(--w)*.22);width:var(--w);border-radius:50%;background:radial-gradient(closest-side,rgba(255,215,190,.5),transparent);filter:blur(4px);animation:sao-cloud var(--du) linear var(--dl) infinite}
@keyframes sao-cloud{from{transform:translateX(-400px)}to{transform:translateX(1300px)}}
.sao-main .mtn{position:absolute;left:0;top:0;width:960px;height:600px}
.sao-mh{position:absolute;left:30px;top:26px}
.sao-mm{position:absolute;right:28px;top:24px;display:flex;flex-direction:column;align-items:center;gap:8px}
.sao-mm .mini{position:relative;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle,rgba(20,40,60,.55),rgba(10,20,35,.7));border:2px solid rgba(255,255,255,.75);box-shadow:0 4px 14px rgba(0,0,0,.35);overflow:hidden}
.sao-mm .mini::before{content:'';position:absolute;inset:0;background:conic-gradient(from 0deg,rgba(255,255,255,.18),transparent 25%);animation:k-spin 4s linear infinite}
.sao-mm .mini i{position:absolute;width:8px;height:8px;border-radius:50%;margin:-4px}
.sao-mm .mini .me{left:50%;top:50%;background:#ffb547;box-shadow:0 0 6px #ffb547}
.sao-mm .mini .p1{left:38%;top:36%;background:#7ee6ff}.sao-mm .mini .p2{left:64%;top:60%;background:#7ee6ff}
.sao-mm .tm{font-size:14px;color:#fff;letter-spacing:.12em;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.sao-mchat{position:absolute;left:30px;bottom:26px;font-size:13px;color:#fff;background:rgba(10,20,35,.45);padding:8px 14px;border-radius:3px;text-shadow:0 1px 3px rgba(0,0,0,.5)}
.sao-mchat b{color:#ffcd85;font-weight:600;margin-right:6px}
.sao-mmenu{position:absolute;right:30px;bottom:26px}

/* Transition effects */
.sao-auth{position:absolute;left:50%;top:50%;width:220px;height:220px;margin:-110px 0 0 -110px;display:grid;place-items:center;animation:sao-pop .5s cubic-bezier(.3,1.5,.5,1) both}
.sao-auth .ring{position:absolute;border-radius:50%;border:3px solid transparent}
.sao-auth .r1{inset:0;border-top-color:#ffb547;border-right-color:#ffb547;animation:k-spin 1.1s linear infinite;filter:drop-shadow(0 0 6px #ffa726)}
.sao-auth .r2{inset:18px;border-color:rgba(255,255,255,.85) transparent rgba(255,255,255,.85) transparent;animation:k-spin 1.7s linear infinite reverse}
.sao-auth .r3{inset:36px;border:1px dashed rgba(255,255,255,.55);animation:k-spin 7s linear infinite}
.sao-auth .core{width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#fff,#dfe3e8);color:#6b727b;display:grid;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.35);transition:background .3s,color .3s}
.sao-auth .core .i{width:42px;height:42px}
.sao-auth .lbl{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:20px;color:#fff;letter-spacing:.42em;font-size:13px;white-space:nowrap;padding-left:.42em}
.sao-auth.ok .r1,.sao-auth.ok .r2{border-color:#ffb547;animation:sao-okr .7s ease-out forwards}
@keyframes sao-okr{to{transform:scale(1.5);opacity:0}}
.sao-auth.ok .core{background:radial-gradient(circle at 50% 35%,#ffc56b,#f39a1e);color:#fff;animation:sao-pop .45s cubic-bezier(.3,1.7,.5,1) both}
.sao-auth.ok .lbl{color:#ffcd85}
.sao-black{background:#000;animation:k-fadef .5s ease both}
.sao-dive-t{position:absolute;left:0;right:0;top:50%;margin-top:-20px;text-align:center;color:#fff;font-size:30px;font-weight:300;letter-spacing:.7em;padding-left:.7em;text-shadow:0 0 18px #fff;animation:sao-divet 2.4s ease both}
@keyframes sao-divet{0%{opacity:0;letter-spacing:.2em}25%{opacity:1}75%{opacity:1}100%{opacity:0;letter-spacing:1.2em;filter:blur(6px)}}
.sao-prog{height:4px;border-radius:2px;background:#d4d9de;overflow:hidden}
.sao-prog i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#f39a1e,#ffd27a);transform-origin:left;animation:k-scalex 1.8s cubic-bezier(.4,0,.2,1) both}
.sao-lg-ok .sao-lg-box{box-shadow:0 0 0 2px #ffb547,0 0 40px rgba(255,170,60,.6),0 18px 50px rgba(0,10,30,.45);transition:box-shadow .4s}
.sao-lg-btn.busy{color:transparent;position:relative}
.sao-lg-btn.busy::after{content:'';position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px;border-radius:50%;border:3px solid rgba(255,255,255,.4);border-top-color:#fff;animation:k-spin .8s linear infinite}
.sao-lg-btn.done{color:transparent;position:relative}
.sao-lg-btn.done::after{content:'';position:absolute;left:50%;top:50%;width:18px;height:9px;margin:-8px 0 0 -9px;border-left:3px solid #fff;border-bottom:3px solid #fff;transform:rotate(-45deg)}
.sao-iris-ring{position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-50%);border-radius:50%;border:5px solid #ffc56b;box-shadow:0 0 30px 8px rgba(255,170,60,.65),inset 0 0 30px 8px rgba(255,170,60,.5);pointer-events:none}
.sao-cal{color:#fff}
.sao-cal-dim{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(10,22,38,.75),rgba(2,6,12,.96));animation:k-fadef .5s both}
.sao-cal-r{position:absolute;left:480px;top:300px;width:0;height:0}
.sao-cal-r i{position:absolute;border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)}
.sao-cal-r .c1{width:340px;height:340px;border:1px dashed rgba(255,255,255,.35);animation:sao-rot 14s linear infinite}
.sao-cal-r .c2{width:290px;height:290px;border:2px solid transparent;border-left-color:#ffb547;border-right-color:#ffb547;animation:sao-rot 2.4s linear infinite reverse}
.sao-cal-r .c3{width:200px;height:200px;border:1px solid rgba(255,255,255,.2)}
@keyframes sao-rot{to{transform:translate(-50%,-50%) rotate(360deg)}}
.sao-cal-r svg{position:absolute;left:-125px;top:-125px;width:250px;height:250px;transform:rotate(-90deg)}
.sao-cal-r svg circle{fill:none;stroke:#ffb547;stroke-width:4;stroke-dasharray:100;stroke-dashoffset:100;filter:drop-shadow(0 0 6px #ffa726);animation:sao-prog 2.4s cubic-bezier(.4,0,.3,1) .3s forwards;stroke-linecap:round}
@keyframes sao-prog{to{stroke-dashoffset:0}}
.sao-cal-r .pct{position:absolute;left:-100px;width:200px;top:-34px;text-align:center;font-size:52px;font-weight:300;line-height:1}
.sao-cal-r .cap{position:absolute;left:-100px;width:200px;top:26px;text-align:center;font-size:11px;letter-spacing:.4em;color:#cfe3f2;padding-left:.4em}
.sao-cal-scan{position:absolute;left:0;right:0;height:2px;top:0;background:linear-gradient(90deg,transparent,rgba(160,225,255,.9),transparent);box-shadow:0 0 14px rgba(160,225,255,.8);animation:sao-cscan 1.4s ease-in-out infinite alternate}
@keyframes sao-cscan{from{transform:translateY(40px)}to{transform:translateY(560px)}}
.sao-cal-list{position:absolute;left:60px;top:200px;display:flex;flex-direction:column;gap:12px;width:240px}
.sao-cal-list .it{display:flex;justify-content:space-between;font-size:14px;letter-spacing:.06em;border-bottom:1px solid rgba(255,255,255,.14);padding-bottom:8px;animation:k-leftf .5s ease var(--d) both}
.sao-cal-list .it b{font-size:11px;letter-spacing:.2em;color:#ffb547;font-weight:500}
.sao-cal-list .it.ok b{color:#7dffa1}
.sao-cal-t{position:absolute;left:60px;top:150px;font-size:13px;letter-spacing:.46em;color:#cfe3f2}
.sao-cal-side{position:absolute;right:60px;top:200px;width:220px;text-align:right;font-size:12.5px;line-height:2;color:#a9bccb;letter-spacing:.06em}
.sao-cal-side b{color:#fff;font-weight:500}
.sao-white{background:#fff}
.sao-mo{position:absolute;left:480px;top:300px;width:64px;height:64px;margin:-32px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#fff,#dfe3e8);box-shadow:0 4px 16px rgba(0,0,0,.35),0 0 0 1px #c9ced4 inset;display:grid;place-items:center;color:#6b727b}
.sao-mo .i{width:28px;height:28px}
.sao-mo .i{transition:opacity .15s}
.sao-mo.burst .i{opacity:0}
.sao-mo.on{background:radial-gradient(circle at 50% 35%,#ffc56b,#f39a1e);color:#fff}
`);

function motes(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<span class="sao-mote" style="left:${rand(0, 100).toFixed(1)}%;--s:${rand(2, 4.5).toFixed(1)}px;--du:${rand(8, 15).toFixed(1)}s;--dl:-${rand(0, 15).toFixed(1)}s;--dx:${rand(-60, 60).toFixed(0)}px"></span>`;
  return s;
}

function bg(vp) {
  return add(vp, `<div class="sao-bg"><div class="sao-hex"></div><div class="sao-horizon"></div>${motes(20)}</div>`);
}

function hudBar(name) {
  return `<div class="sao-hud-row"><div class="sao-hud-nm">${esc(name)}</div></div>
    <div class="sao-hud-bar"><i></i></div>`;
}

function mainPage(L, ctx) {
  const clouds = [[-40, 90, 360, 90], [200, 160, 260, 70], [520, 60, 420, 110], [700, 200, 220, 60]].map(([x, y, w, du], i) =>
    `<div class="sao-cl" style="left:${x}px;top:${y}px;--w:${w}px;--du:${du}s;--dl:-${(i * 17) % du}s"></div>`).join('');
  return under(L, `<div class="layer sao-main">
    <div class="sky"></div><div class="sun"></div>${clouds}
    <svg class="mtn" viewBox="0 0 960 600" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 420L70 382L140 404L230 336L310 396L410 322L510 390L600 344L700 400L790 340L880 386L960 352V600H0Z" fill="#41557a" opacity=".75"/>
      <path d="M0 470L110 424L210 452L330 398L450 458L560 412L680 466L800 420L960 460V600H0Z" fill="#26344f"/>
      <path d="M0 520L160 494L300 512L470 486L640 510L800 490L960 506V600H0Z" fill="#17213a"/>
      <g fill="#ffd9a0" opacity=".8"><rect x="180" y="500" width="3" height="3"/><rect x="194" y="497" width="3" height="3"/><rect x="560" y="492" width="3" height="3"/><rect x="742" y="496" width="3" height="3"/><rect x="756" y="500" width="3" height="3"/></g>
    </svg>
    <div class="sao-mh a-left" style="--d:.2s">${hudBar(ctx.name)}<div class="sao-hud-num"><span>HP <b>14,500</b>/14,500</span><span>Lv. <b>87</b></span></div></div>
    <div class="sao-mm a-fade" style="--d:.4s"><div class="mini"><i class="p1"></i><i class="p2"></i><i class="me"></i></div><div class="tm">${G.clock()}</div></div>
    <div class="sao-mchat a-up" style="--d:.6s"><b>[Plaza]</b>Raid party forming at the north gate — 21:00</div>
    <div class="sao-mmenu a-pop" style="--d:.7s"><div class="sao-circ">${ico.user}</div></div>
  </div>`);
}

function hide(m, sels) { sels.forEach(q => { const e = m.querySelector(q); e && e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); }); }

function login(L, ctx) {
  const root = add(L, `<div class="sao-lg">
    <div class="sao-lg-k a-fade" style="--d:.2s">FULL-DIVE NETWORK</div>
    <div class="sao-panel sao-lg-box">
      <div class="sao-head">ACCOUNT LOGIN</div>
      <div class="sao-lg-b">
        <div class="sao-fld" data-f><div class="lb">${ico.user}ID</div><div class="v"><b data-u></b></div></div>
        <div class="sao-fld" data-f><div class="lb">${ico.lock}PASSWORD</div><div class="v"><b data-p></b></div></div>
        <button class="sao-lg-btn" data-btn>LOG IN</button>
        <div class="sao-lg-st" data-status>Press Log in to connect</div>
      </div>
    </div></div>`);
  return G.loginKit(root, ctx);
}

/* -------------------- 10 welcome windows -------------------- */
const WL = [
{
  title: 'System Panel', tags: ['Bordered', 'Classic'],
  desc: 'An orange seam of light splits open into the white system window, the name rises letter by letter, then a shine sweeps across.',
  build(L, ctx) {
    add(L, `<div class="center"><div class="sao-w1">
      <div class="sao-w1-seam"></div>
      <div class="sao-panel sao-w1-box">
        <div class="sao-head">SYSTEM MESSAGE</div>
        <div class="sao-w1-body">
          <div class="sao-w1-k a-fade" style="--d:1s">Welcome back</div>
          <div class="sao-w1-name stag" style="--d:1.1s;--st:55ms">${split(ctx.name)}</div>
          <div class="sao-w1-meta a-fade" style="--d:1.6s"><span>Sync 100%</span><i></i><span>Server · Asia-1</span><i></i><span>Ping 12 ms</span></div>
          <div class="sao-w1-btns a-pop" style="--d:1.8s"><button class="sao-circ sao-ok" aria-label="OK"></button></div>
        </div>
        <div class="sao-shine"></div>
      </div></div></div>`);
  },
},
{
  title: 'Floating Type', tags: ['Borderless', 'Light rays'],
  desc: 'No window at all: thin type condenses out of a blur, the name glows orange and a light line draws itself beneath it.',
  build(L, ctx) {
    let hx = '';
    for (let i = 0; i < 9; i++) hx += `<i class="sao-hexf" style="left:${rand(4, 92).toFixed(0)}%;top:${rand(8, 86).toFixed(0)}%;--s:${rand(14, 34).toFixed(0)}px;--du:${rand(4, 8).toFixed(1)}s;--dl:-${rand(0, 6).toFixed(1)}s"></i>`;
    add(L, `<div class="sao-w2"><div class="sao-rays"></div>${hx}
      <div class="sao-w2-small a-fade" style="--d:.2s">— LOGIN COMPLETE —</div>
      <div class="sao-w2-big">WELCOME</div>
      <div class="sao-w2-name stag-b" style="--d:1.15s;--st:50ms">${split(ctx.name.toUpperCase())}</div>
      <div class="sao-w2-line"></div>
      <div class="sao-w2-sub a-fade" style="--d:2s">YOUR ADVENTURE RESUMES</div></div>`);
  },
},
{
  title: 'Menu Drop', tags: ['Menu', 'Profile'],
  desc: 'Round menu buttons drop in one after another with a bounce, the first one lights up and a profile panel slides out from it.',
  build(L, ctx) {
    const keys = ['user', 'users', 'bag', 'map', 'gear'];
    add(L, `<div class="layer">
      <div class="sao-w3-col">${keys.map((k, i) => `<div class="sao-orb ${i ? '' : 'on'}" style="--i:${i}">${ico[k]}</div>`).join('')}</div>
      <div class="sao-w3-link"></div>
      <div class="sao-panel sao-w3-p">
        <div class="sao-head">PROFILE</div>
        <div class="sao-w3-b">
          <div class="sao-w3-top">
            <div class="sao-av a-pop" style="--d:1.2s">${esc(G.initial(ctx.name))}</div>
            <div class="a-left" style="--d:1.25s"><div class="sao-k">Welcome back</div><div class="sao-w3-n">${esc(ctx.name)}</div><div class="sao-w3-lv">Lv. 87 · Vanguard</div></div>
          </div>
          <div class="sao-hp a-fade" style="--d:1.35s"><div class="sao-hp-l"><span>HP</span><span>14,500 / 14,500</span></div><div class="sao-hp-t"><i style="--d:1.45s"></i></div></div>
          <div class="sao-w3-rows a-fade" style="--d:1.6s"><div><span>Guild</span><b>Midnight Lotus</b></div><div><span>Gold</span><b>128,400</b></div><div><span>Last login</span><b>2 days ago</b></div></div>
        </div>
      </div></div>`);
  },
},
{
  title: 'HUD Link', tags: ['HUD', 'Borderless'],
  desc: 'The in-game HUD boots first: name tag, slanted HP bar filling green with a live counter and party bars. Then two light lines meet around the greeting.',
  build(L, ctx) {
    const root = add(L, `<div class="layer">
      <div class="sao-hud">${hudBar(ctx.name)}
        <div class="sao-hud-num"><span>HP <b class="hp">0</b>/14,500</span><span>Lv. <b>87</b></span></div>
        <div class="sao-party">
          <div class="p a-left" style="--d:1.5s"><span>Mika</span><div class="t"><i style="width:92%"></i></div></div>
          <div class="p a-left" style="--d:1.62s"><span>Toma</span><div class="t"><i style="width:78%"></i></div></div>
        </div>
      </div>
      <div class="sao-w4-c">
        <div class="sao-w4-r"><i class="l"></i><div class="sao-w4-t a-blur" style="--d:1.1s">WELCOME BACK</div><i class="r"></i></div>
        <div class="sao-w4-s a-fade" style="--d:1.7s">LINK ESTABLISHED · ${esc(ctx.name.toUpperCase())}</div>
      </div></div>`);
    ctx.wait(600).then(() => ctx.count(root.querySelector('.hp'), 0, 14500, 1500));
  },
},
{
  title: 'Alert Dialog', tags: ['Bordered', 'Compact'],
  desc: 'A compact confirm dialog bounces in over a dimmed scene, its alert badge pops on top and the OK button keeps pulsing.',
  build(L, ctx) {
    add(L, `<div class="layer"><div class="sao-dim"></div><div class="center"><div class="sao-w5">
      <div class="sao-w5-ico">!</div>
      <div class="sao-panel sao-w5-box">
        <div class="sao-w5-t a-fade" style="--d:.6s">WELCOME BACK</div>
        <div class="sao-w5-m a-fade" style="--d:.75s">Good to see you again, <b>${esc(ctx.name)}</b>.<br>Resume from your last save point?</div>
        <div class="sao-w5-btns a-up" style="--d:.9s"><button class="sao-circ sao-ok" aria-label="Yes"></button><button class="sao-circ" aria-label="No">${ico.x}</button></div>
      </div></div></div></div>`);
  },
},
{
  title: 'Polygon Assemble', tags: ['Particles', 'Bordered'],
  desc: 'A hundred polygon shards fly in from every direction and lock together into the panel, finishing with an orange edge flash.',
  build(L, ctx) {
    const PW = 520, PH = 280, C = 10, R = 5, cw = PW / C, rh = PH / R, P = [];
    for (let r = 0; r <= R; r++) { P[r] = []; for (let c = 0; c <= C; c++) { let x = c * cw, y = r * rh; if (c && c < C) x += rand(-1, 1) * cw * .3; if (r && r < R) y += rand(-1, 1) * rh * .3; P[r][c] = [x, y]; } }
    let sh = '';
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const a = P[r][c], b = P[r][c + 1], d = P[r + 1][c + 1], e = P[r + 1][c];
      const tris = (r + c) % 2 ? [[a, b, d], [a, d, e]] : [[a, b, e], [b, d, e]];
      tris.forEach(t => {
        const xs = t.map(p => p[0]), ys = t.map(p => p[1]);
        const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys)), x1 = Math.ceil(Math.max(...xs)), y1 = Math.ceil(Math.max(...ys));
        const cx = (xs[0] + xs[1] + xs[2]) / 3, cy = (ys[0] + ys[1] + ys[2]) / 3;
        const ang = Math.atan2(cy - PH / 2, cx - PW / 2) + rand(-.5, .5), dist = rand(380, 720);
        sh += `<div class="sao-shd" style="left:${x0}px;top:${y0}px;width:${x1 - x0 + 1}px;height:${y1 - y0 + 1}px;background-position:${-x0}px ${-y0}px;clip-path:polygon(${t.map(p => (p[0] - x0 + .5).toFixed(1) + 'px ' + (p[1] - y0 + .5).toFixed(1) + 'px').join(',')});transform-origin:${(cx - x0).toFixed(0)}px ${(cy - y0).toFixed(0)}px;--tx:${(Math.cos(ang) * dist).toFixed(0)}px;--ty:${(Math.sin(ang) * dist * .8).toFixed(0)}px;--r:${rand(-260, 260).toFixed(0)}deg;--dl:${rand(.1, .65).toFixed(2)}s"></div>`;
      });
    }
    add(L, `<div class="center"><div class="sao-w6">${sh}
      <div class="sao-panel sao-w6-solid">
        <div class="sao-head">WELCOME</div>
        <div class="sao-w6-b">
          <div class="sao-k a-fade" style="--d:1.9s">Character restored</div>
          <div class="sao-w6-n a-up" style="--d:2s">${esc(ctx.name)}</div>
          <div class="sao-w6-st a-up" style="--d:2.15s"><div><span>LEVEL</span><b>87</b></div><div><span>HP</span><b>14,500</b></div><div><span>STATUS</span><b class="sao-or">Online</b></div></div>
        </div></div>
      <div class="sao-w6-flash"></div></div></div>`);
  },
},
{
  title: 'Light Scan', tags: ['Glass', 'Frameless'],
  desc: 'A bright scan line sweeps left to right and leaves a frosted-glass card behind it, with orange corner brackets and a three-column readout.',
  build(L, ctx) {
    add(L, `<div class="center"><div class="sao-w7">
      <div class="sao-w7-g">
        <i class="sao-cn tl"></i><i class="sao-cn tr"></i><i class="sao-cn bl"></i><i class="sao-cn br"></i>
        <div class="sao-w7-k a-fade" style="--d:1.2s">IDENTITY CONFIRMED</div>
        <div class="sao-w7-t a-up" style="--d:1.3s">Welcome back, <b>${esc(ctx.name)}</b></div>
        <div class="sao-w7-cols">
          <div class="a-up" style="--d:1.5s"><span>LAST LOGIN</span><b>2 days ago</b></div>
          <div class="a-up" style="--d:1.6s"><span>LOCATION</span><b>Starting Town</b></div>
          <div class="a-up" style="--d:1.7s"><span>STATUS</span><b>All systems green</b></div>
        </div>
      </div>
      <div class="sao-w7-bar"></div></div></div>`);
  },
},
{
  title: 'Notification Stack', tags: ['Toasts', 'Side'],
  desc: 'Four notifications spring in from the right one by one, each with a draining timer line, while the greeting settles in the corner.',
  build(L, ctx) {
    const T = [
      ['o', 'check', 'Logged in', `Welcome back, ${esc(ctx.name)}`],
      ['', 'gift', 'Daily bonus received', '×1 Crystal · ×200 Gold'],
      ['', 'users', '3 friends online', 'Mika, Toma and Rei'],
      ['', 'mail', 'New message', 'From Guild Midnight Lotus'],
    ];
    add(L, `<div class="layer">
      <div class="sao-w8-list">${T.map((t, i) => `<div class="sao-toast" style="--d:${(.3 + i * .38).toFixed(2)}s"><div class="ic ${t[0]}">${ico[t[1]]}</div><div><b>${t[2]}</b><small>${t[3]}</small></div><time>now</time></div>`).join('')}</div>
      <div class="sao-w8-big"><div class="k a-fade" style="--d:.2s">LOGIN SUCCESSFUL</div><div class="t a-up" style="--d:.35s">Welcome back,</div><div class="n a-up" style="--d:.5s">${esc(ctx.name)}</div></div>
    </div>`);
  },
},
{
  title: 'Holo Player Card', tags: ['3D', 'Interactive'],
  desc: 'A player card flips in from edge-on in 3D, a holographic sheen runs across it, then it floats and tilts toward your cursor.',
  build(L, ctx) {
    const root = add(L, `<div class="sao-w9w"><div class="sao-w9"><div class="sao-w9-f"><div class="sao-w9-c">
      <div class="sao-w9-top"><span>PLAYER CARD</span><span>No. 0042-7781</span></div>
      <div class="sao-w9-m"><div class="sao-w9-hex">${esc(G.initial(ctx.name))}</div>
        <div><div class="sao-k sao-or">Welcome back</div><div class="sao-w9-n" style="font-size:${G.fit(ctx.name, 40, 320, .56)}px">${esc(ctx.name)}</div><div class="sao-w9-r">Lv. 87 · Vanguard · Midnight Lotus</div></div></div>
      <div class="sao-w9-st"><div><span>PLAYTIME</span><b>1,204 h</b></div><div><span>QUESTS</span><b>312</b></div><div><span>RANK</span><b>#128</b></div></div>
      <div class="sao-w9-holo"></div><div class="sao-w9-gl"></div>
    </div></div></div></div>`);
    const card = root.querySelector('.sao-w9-c');
    L.addEventListener('pointermove', e => {
      const r = L.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.setProperty('--ry', (x * 26).toFixed(1) + 'deg'); card.style.setProperty('--rx', (-y * 20).toFixed(1) + 'deg');
      card.style.setProperty('--gx', (50 + x * 100).toFixed(0) + '%'); card.style.setProperty('--gy', (50 + y * 100).toFixed(0) + '%');
    });
    L.addEventListener('pointerleave', () => { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); });
  },
},
{
  title: 'Sync Terminal', tags: ['Typewriter', 'Dark'],
  desc: 'A dark terminal types out the link-up checks, fills the sync bar to 100%, then prints the greeting with a blinking cursor.',
  build(L, ctx) {
    const root = add(L, `<div class="center"><div class="sao-w10">
      <div class="sao-w10-h"><i></i><span>NEURAL LINK</span><span>v4.2</span></div>
      <div class="sao-w10-b"></div></div></div>`);
    const b = root.querySelector('.sao-w10-b');
    (async () => {
      await ctx.wait(700);
      const lines = [['Establishing neural link', 'OK'], ['Calibrating senses · sight · sound · touch', 'OK'], ['Loading character data', 'OK']];
      for (const [t, r] of lines) {
        const d = add(b, `<div><span class="p">›</span> <span class="t"></span><span class="dt"></span> <span class="ok"></span></div>`);
        const tt = d.querySelector('.t'); tt.classList.add('cur');
        await ctx.type(tt, t, 20); tt.classList.remove('cur');
        for (let i = 0; i < 5; i++) { d.querySelector('.dt').textContent += '.'; await ctx.wait(55); }
        d.querySelector('.ok').textContent = r; await ctx.wait(120);
      }
      const s = add(b, `<div><span class="p">›</span> Sync rate<span class="sao-sync"><i></i></span><span class="pc">0%</span></div>`);
      await ctx.wait(30); s.querySelector('i').style.width = '100%';
      await ctx.count(s.querySelector('.pc'), 0, 100, 1100, v => Math.round(v) + '%');
      await ctx.wait(250);
      add(b, `<div class="sao-w10-big a-up" style="--d:0s">Welcome back, <b>${esc(ctx.name)}</b><span class="cur"></span></div>`);
    })();
  },
},
];

/* -------------------- 5 login transitions -------------------- */
const TR = [
{
  title: 'Dive Tunnel', tags: ['Warp', 'Rainbow'],
  desc: 'Spinning authentication rings turn orange on approval, then the screen drops into a rainbow light tunnel that speeds up into a white-out, and you land in the world.',
  async run(L, ctx, lg) {
    await lg.fill(); ctx.step(1);
    lg.status('Authenticating…', 'busy'); lg.root.classList.add('sao-back');
    const a = add(L, `<div class="sao-auth"><i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i><div class="core">${ico.user}</div><div class="lbl">AUTHENTICATING</div></div>`);
    await ctx.wait(2000);
    ctx.step(2); a.classList.add('ok'); a.querySelector('.lbl').textContent = 'APPROVED'; a.querySelector('.core').innerHTML = ico.check; lg.status('Approved', 'ok');
    await ctx.wait(1000);
    ctx.step(3);
    const blk = add(L, '<div class="layer sao-black"></div>');
    await ctx.wait(520);
    lg.root.remove(); a.remove();
    const tw = add(L, '<div class="layer"></div>');
    G.warp(tw, ctx, { dur: 2.6, n: 440, glow: true, v1: 2.6, color: () => `hsl(${rand(0, 360).toFixed(0)},100%,${rand(62, 80).toFixed(0)}%)` });
    add(tw, '<div class="sao-dive-t">SYNC START</div>');
    await ctx.wait(2600);
    const fl = G.flash(L, '#fff', 260);
    await ctx.wait(320);
    blk.remove(); tw.remove();
    mainPage(L, ctx); ctx.step(4);
    fl.out(1100);
    await ctx.wait(1300);
    ctx.step(5); G.welcomeOver(L, ctx, WL[0]);
    await ctx.wait(2600);
  },
},
{
  title: 'Polygon Shatter', tags: ['Shatter', '3D'],
  desc: 'The login screen cracks like glass and bursts into polygon shards that fly past the camera, revealing the world, where the welcome panel reassembles from shards.',
  async run(L, ctx, lg) {
    await lg.fill(); ctx.step(1);
    lg.status('Authenticating…', 'busy');
    add(lg.root.querySelector('.sao-lg-b'), '<div class="sao-prog"><i></i></div>');
    await ctx.wait(1900);
    ctx.step(2); lg.status('Approved — entering world', 'ok'); lg.root.classList.add('sao-lg-ok');
    await ctx.wait(900);
    ctx.step(3);
    mainPage(L, ctx);
    const sh = G.shatter(L, [ctx.bgEl, lg.root], { cols: 7, rows: 4 });
    sh.crack();
    const fl = G.flash(L, 'rgba(255,255,255,.35)', 80); fl.out(300);
    await ctx.wait(520);
    sh.fly(1500, 1.1);
    await ctx.wait(1000); ctx.step(4);
    await ctx.wait(900); sh.wrap.remove();
    ctx.step(5); G.welcomeOver(L, ctx, WL[5]);
    await ctx.wait(2800);
  },
},
{
  title: 'Iris Open', tags: ['Iris', 'Reveal'],
  desc: 'The Log in button becomes a spinner, then a check. A glowing orange ring opens from the centre like an iris and reveals the world, then a dialog pops up to greet you.',
  async run(L, ctx, lg) {
    await lg.fill(); ctx.step(1);
    lg.status('Authenticating…', 'busy'); lg.btn.classList.add('busy');
    await ctx.wait(1800);
    ctx.step(2); lg.btn.classList.remove('busy'); lg.btn.classList.add('done'); lg.status('Approved', 'ok');
    await ctx.wait(800);
    ctx.step(3);
    lg.root.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(.86)', opacity: .5, filter: 'blur(3px)' }], { duration: 1400, fill: 'forwards', easing: 'ease-in' });
    const m = add(L, '<div class="layer"></div>');
    const mp = mainPage(m, ctx);
    const ease = 'cubic-bezier(.75,0,.2,1)';
    m.animate([{ clipPath: 'circle(0px at 50% 50%)' }, { clipPath: 'circle(600px at 50% 50%)' }], { duration: 1500, easing: ease, fill: 'forwards' });
    const ring = add(L, '<div class="sao-iris-ring"></div>');
    ring.animate([{ width: '0px', height: '0px', opacity: 1 }, { width: '1200px', height: '1200px', opacity: .9, offset: .85 }, { width: '1200px', height: '1200px', opacity: 0 }], { duration: 1700, easing: ease, fill: 'forwards' });
    await ctx.wait(1300); ctx.step(4);
    await ctx.wait(700); lg.root.remove(); ring.remove();
    ctx.step(5); G.welcomeOver(L, ctx, WL[4], false);
    await ctx.wait(2200);
  },
},
{
  title: 'Sense Calibration', tags: ['HUD', 'Count-up'],
  desc: 'After approval the screen goes dark for a full-dive calibration: rotating rings, a scan line, five senses ticking to OK and the sync rate counting to 100%, then a white bloom into the world.',
  async run(L, ctx, lg) {
    await lg.fill(); ctx.step(1);
    lg.status('Authenticating…', 'busy');
    add(lg.root.querySelector('.sao-lg-b'), '<div class="sao-prog"><i></i></div>');
    await ctx.wait(1700);
    ctx.step(2); lg.status('Approved', 'ok'); lg.root.classList.add('sao-lg-ok');
    await ctx.wait(700);
    ctx.step(3);
    const senses = ['Visual', 'Auditory', 'Tactile', 'Motor control', 'Balance'];
    const cal = add(L, `<div class="layer sao-cal"><div class="sao-cal-dim"></div><div class="sao-cal-scan"></div>
      <div class="sao-cal-t a-fade" style="--d:.3s">SENSORY CALIBRATION</div>
      <div class="sao-cal-list">${senses.map((t, i) => `<div class="it" style="--d:${(.35 + i * .12).toFixed(2)}s"><span>${t}</span><b>CALIBRATING</b></div>`).join('')}</div>
      <div class="sao-cal-r a-fade" style="--d:.2s"><i class="c1"></i><i class="c2"></i><i class="c3"></i><svg viewBox="0 0 250 250"><circle cx="125" cy="125" r="112" pathLength="100"/></svg><div class="pct">0%</div><div class="cap">SYNC RATE</div></div>
      <div class="sao-cal-side a-fade" style="--d:.5s">Player <b>${esc(ctx.name)}</b><br>Brain-wave match <b>99.8%</b><br>Session <b>#7781-A</b><br>Region <b>Asia-1</b></div>
    </div>`);
    ctx.count(cal.querySelector('.pct'), 0, 100, 2500, v => Math.round(v) + '%');
    const its = cal.querySelectorAll('.it');
    await ctx.wait(700);
    for (const it of its) { it.classList.add('ok'); it.querySelector('b').textContent = 'OK'; await ctx.wait(400); }
    await ctx.wait(300);
    const fl = G.flash(L, '#fff', 500);
    await ctx.wait(600);
    cal.remove(); lg.root.remove();
    const m = mainPage(L, ctx); ctx.step(4);
    fl.out(1200);
    await ctx.wait(1300);
    hide(m, ['.sao-mh']);
    ctx.step(5); G.welcomeOver(L, ctx, WL[3], false);
    await ctx.wait(2600);
  },
},
{
  title: 'Menu Cascade', tags: ['Morph', 'Menu'],
  desc: 'The login panel folds into a line, the line rolls into a round button, it splits into five menu buttons that cascade into a column, then they burst open into the world.',
  async run(L, ctx, lg) {
    await lg.fill(); ctx.step(1);
    lg.status('Authenticating…', 'busy'); lg.btn.classList.add('busy');
    await ctx.wait(1600);
    ctx.step(2); lg.btn.classList.remove('busy'); lg.btn.classList.add('done'); lg.status('Approved', 'ok');
    await ctx.wait(700);
    ctx.step(3);
    const box = lg.root.querySelector('.sao-lg-box');
    lg.root.querySelector('.sao-lg-k').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    box.animate([{ transform: 'none', borderRadius: '4px' }, { transform: 'scaleY(.012)', borderRadius: '4px', offset: .55 }, { transform: 'scale(.16,.012)', borderRadius: '4px' }], { duration: 650, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' });
    await ctx.wait(620);
    lg.root.remove();
    const keys = ['user', 'users', 'bag', 'map', 'gear'];
    const orbs = keys.map(k => add(L, `<div class="sao-mo">${ico[k]}</div>`));
    orbs.forEach((o, i) => o.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.15)', offset: .7 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' }));
    await ctx.wait(360);
    orbs.forEach((o, i) => o.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${(i - 2) * 80}px)` }], { duration: 560, delay: i * 60, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' }));
    await ctx.wait(800);
    orbs[0].classList.add('on');
    await ctx.wait(500);
    const m = mainPage(L, ctx);
    m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, fill: 'forwards' });
    orbs.forEach((o, i) => { o.classList.add('burst'); o.animate([{ transform: `translateY(${(i - 2) * 80}px) scale(1)`, opacity: 1 }, { transform: `translateY(${(i - 2) * 80}px) scale(16)`, opacity: 0 }], { duration: 750, delay: i * 50, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }); });
    ctx.step(4);
    await ctx.wait(1300);
    orbs.forEach(o => o.remove());
    hide(m, ['.sao-mchat', '.sao-mm']);
    ctx.step(5); G.welcomeOver(L, ctx, WL[7], false);
    await ctx.wait(2600);
  },
},
];

G.theme({
  key: 'sao', title: 'Sword Art Online', sub: 'White system panels · orange accents',
  accent: '#f5a623', swatch: ['#f4f6f8', '#f5a623', '#2a5378'],
  blurbW: 'Translucent white panels, round menu buttons, slanted HP bars and orange highlights, in the style of a full-dive VR MMO.',
  blurbT: 'From the account login to the world: dive tunnel, glass shatter, iris, calibration and a menu morph.',
  bg, login, main: mainPage, welcomes: WL, transitions: TR,
});
})();

/* ===== Theme 2 — Solo Leveling style (glowing blue System windows) ===== */
(() => {
const { add, under, split, esc, rand, ico, W, H } = G;

G.css(`
.th-sl{font-family:'Chakra Petch',system-ui,sans-serif;color:#e6f4ff;--caret:#9fe1ff}
.sl-bg{position:absolute;inset:0;background:radial-gradient(90% 70% at 50% 35%,#0d2547 0%,#071428 45%,#02060e 100%);overflow:hidden}
.sl-fog{position:absolute;width:720px;height:520px;border-radius:50%;filter:blur(50px);opacity:.55;animation:sl-drift 18s ease-in-out infinite alternate}
.sl-fog.a{left:-180px;top:-140px;background:radial-gradient(circle,#1a5fb4,transparent 65%)}
.sl-fog.b{right:-220px;bottom:-220px;background:radial-gradient(circle,#4b2a9c,transparent 65%);animation-duration:23s}
@keyframes sl-drift{to{transform:translate(120px,60px) scale(1.15)}}
.sl-floor{position:absolute;left:-50%;right:-50%;bottom:-40px;height:340px;background-image:linear-gradient(rgba(80,170,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(80,170,255,.4) 1px,transparent 1px);background-size:60px 60px;transform:perspective(500px) rotateX(62deg);transform-origin:50% 100%;-webkit-mask-image:linear-gradient(to top,#000 10%,transparent 85%);mask-image:linear-gradient(to top,#000 10%,transparent 85%);opacity:.3;animation:sl-floor 3s linear infinite}
@keyframes sl-floor{to{background-position:0 60px}}
.sl-dust{position:absolute;bottom:-10px;width:var(--s);height:var(--s);border-radius:50%;background:#9fe1ff;box-shadow:0 0 8px 2px rgba(41,168,255,.8);opacity:0;animation:sl-dust var(--du) linear var(--dl) infinite}
@keyframes sl-dust{0%{transform:translate(0,0);opacity:0}20%{opacity:.85}100%{transform:translate(var(--dx),-640px);opacity:0}}
.sl-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);pointer-events:none}

.sl-win{position:relative;background:linear-gradient(180deg,rgba(14,40,78,.84),rgba(6,20,42,.88));border:1.5px solid #79cfff;box-shadow:0 0 0 1px rgba(41,168,255,.22),0 0 22px rgba(41,168,255,.55),inset 0 0 26px rgba(41,168,255,.26);color:#e8f6ff}
.sl-glow{color:#fff;text-shadow:0 0 6px rgba(140,215,255,.95),0 0 18px rgba(41,168,255,.7)}
.sl-tag{display:inline-flex;align-items:center;gap:12px;padding:6px 20px;border:1.5px solid #a6e0ff;box-shadow:0 0 12px rgba(41,168,255,.6),inset 0 0 10px rgba(41,168,255,.3);font-weight:700;letter-spacing:.22em;font-size:17px;color:#fff;text-shadow:0 0 8px #3ab0ff;background:rgba(8,28,56,.6)}
.sl-bang{width:26px;height:26px;border:1.5px solid #a6e0ff;display:grid;place-items:center;font-weight:800;font-size:16px;letter-spacing:0}
.sl-bang .i{width:16px;height:16px;stroke-width:2.6}
.sl-hl{color:#7fdcff;font-weight:700;text-shadow:0 0 10px rgba(41,168,255,.8)}
@keyframes sl-flick{0%{opacity:0}8%{opacity:.9}12%{opacity:.12}20%{opacity:1}25%{opacity:.35}34%,100%{opacity:1}}
.sl-in{animation:sl-flick .8s linear var(--d,0s) both}

/* W1 */
.sl-w1{position:relative;width:580px;height:270px}
.sl-w1 svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 6px #29a8ff);z-index:2}
.sl-w1 path{fill:none;stroke:#c8edff;stroke-width:2;stroke-dasharray:1;stroke-dashoffset:1;animation:k-draw .9s cubic-bezier(.6,0,.3,1) .15s forwards}
.sl-w1 svg{animation:k-fadeo .4s ease 1.6s forwards}
.sl-w1-box{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;animation:sl-flick .8s linear .95s both}
.sl-w1-box .sl-tag{animation:sl-flick .6s linear 1.15s both;margin-bottom:8px}
.sl-w1 p{margin:0;font-size:22px;min-height:30px;letter-spacing:.02em}
.sl-w1 .l3{font-size:14px;color:#9fd6ff;opacity:0;transition:opacity .7s;letter-spacing:.08em}
.sl-w1 .l3.show{opacity:1}

/* W2 */
.sl-w2{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.sl-w2-k{font-size:14px;letter-spacing:.5em;color:#8fd8ff;padding-left:.5em;animation:sl-flick .8s linear .1s both}
.sl-w2-t{font-family:Oxanium,sans-serif;font-weight:800;font-size:64px;letter-spacing:.16em;padding-left:.16em;margin-top:14px;color:#fff;text-shadow:0 0 10px rgba(120,200,255,.9),0 0 30px rgba(41,168,255,.6)}
.sl-w2-t .ch{display:inline-block;animation:sl-flick .9s linear calc(.35s + var(--r)) both}
.sl-w2-nw{position:relative;margin-top:10px}
.sl-w2-n{font-family:Oxanium,sans-serif;font-weight:600;letter-spacing:.1em;background:linear-gradient(90deg,#cfeeff 0 33%,#ffffff 45%,#5cc2ff 50%,#ffffff 55%,#cfeeff 67% 100%);background-size:300% 100%;background-position:0 0;-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 10px rgba(41,168,255,.75));animation:k-blurf .9s ease 1.3s both,sl-sweep 2.2s ease 1.8s both}
@keyframes sl-sweep{from{background-position:100% 0}to{background-position:0 0}}
.sl-w2-streak{position:absolute;left:50%;top:50%;width:900px;height:2px;margin:-1px 0 0 -450px;background:linear-gradient(90deg,transparent,#bfe9ff 40%,#fff 50%,#bfe9ff 60%,transparent);box-shadow:0 0 18px 3px rgba(41,168,255,.6);animation:sl-streak 1.3s ease 1.2s both;pointer-events:none}
@keyframes sl-streak{0%{transform:scaleX(0);opacity:1}55%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1.1);opacity:0}}
.sl-w2-s{margin-top:22px;font-size:17px;color:#bfe3ff;letter-spacing:.06em;min-height:24px}

/* W3 */
.sl-w3{width:540px;padding:26px 36px 22px}
.sl-w3-top{display:flex;justify-content:center;margin-bottom:16px}
.sl-w3 h3{margin:0 0 16px;text-align:center;font-family:Oxanium,sans-serif;font-size:28px;font-weight:700;letter-spacing:.08em}
.sl-w3 h3 small{font-size:14px;color:#8fd8ff;font-weight:500;letter-spacing:.1em;margin-left:8px}
.sl-w3 ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.sl-w3 li{display:flex;align-items:center;gap:12px;font-size:16.5px;padding:8px 12px;border:1px solid rgba(120,200,255,.25);background:rgba(20,60,110,.25)}
.sl-w3 li em{margin-left:auto;font-style:normal;color:#8fd8ff;font-size:14px}
.sl-ck{flex:none;width:24px;height:24px;border:1.5px solid #8fd8ff;display:grid;place-items:center;box-shadow:0 0 8px rgba(41,168,255,.5)}
.sl-ck svg{width:18px;height:18px;overflow:visible}
.sl-ck path{fill:none;stroke:#bff0ff;stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:k-draw .35s ease var(--d2) forwards;filter:drop-shadow(0 0 4px #29a8ff)}
.sl-w3-w{margin-top:16px;font-size:15px;color:#dff3ff;text-align:center;line-height:1.5}
.sl-w3-t{margin-top:10px;text-align:center;font-size:12.5px;letter-spacing:.2em;color:#7fb8de}
.sl-w3-t b{color:#fff;font-weight:600;letter-spacing:.1em}

/* W4 */
.sl-w4{width:620px;padding:22px 34px 20px}
.sl-w4-h{display:flex;justify-content:center;margin-bottom:16px}
.sl-w4-g{display:grid;grid-template-columns:1fr auto;gap:10px 24px;align-items:center}
.sl-kv{display:flex;gap:14px;font-size:15.5px;padding:3px 0}
.sl-kv span{width:62px;color:#8fd8ff;letter-spacing:.14em;font-size:12.5px;padding-top:2px}
.sl-kv b{font-weight:600}
.sl-w4-lv{text-align:center;border:1.5px solid rgba(150,215,255,.6);padding:8px 24px;box-shadow:inset 0 0 16px rgba(41,168,255,.3),0 0 10px rgba(41,168,255,.3)}
.sl-w4-lv span{display:block;font-size:12px;letter-spacing:.3em;color:#8fd8ff}
.sl-w4-lv b{font-family:Oxanium,sans-serif;font-size:54px;line-height:1;font-weight:700}
.sl-bars{margin:16px 0 14px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.sl-bar .l{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}
.sl-bar .l span{color:#8fd8ff;letter-spacing:.14em}
.sl-bar .t{height:11px;border:1px solid rgba(150,215,255,.6);padding:1px}
.sl-bar .t i{display:block;height:100%;animation:sl-barw 1.4s cubic-bezier(.3,.7,.2,1) var(--d,.9s) both}
.sl-bar.hp .t i{background:linear-gradient(90deg,#ff4d6d,#ff98aa);box-shadow:0 0 8px rgba(255,77,109,.7)}
.sl-bar.mp .t i{background:linear-gradient(90deg,#2b8fff,#8fd8ff);box-shadow:0 0 8px rgba(41,168,255,.8)}
@keyframes sl-barw{from{width:0}}
.sl-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;border-top:1px solid rgba(120,200,255,.25);padding-top:12px}
.sl-stats div{text-align:center}
.sl-stats span{display:block;font-size:12px;letter-spacing:.18em;color:#8fd8ff}
.sl-stats b{font-family:Oxanium,sans-serif;font-size:24px;font-weight:600}
.sl-w4-f{display:flex;justify-content:space-between;margin-top:14px;font-size:14.5px}
.sl-w4-f .pts{color:#ffd36a;animation:k-blink 1.2s steps(1) 2.6s infinite}

/* W5 */
.sl-w5{position:absolute;inset:0}
.sl-w5-p{position:absolute;left:50%;top:-40px;bottom:110px;width:150px;margin-left:-75px;background:linear-gradient(90deg,transparent,rgba(90,180,255,.35) 25%,rgba(225,246,255,.95) 50%,rgba(90,180,255,.35) 75%,transparent);filter:blur(3px);transform-origin:50% 100%;animation:sl-pillar 1.7s cubic-bezier(.2,.8,.2,1) .1s both}
@keyframes sl-pillar{0%{transform:scaleY(0) scaleX(.3);opacity:0}18%{transform:scaleY(1) scaleX(1.5);opacity:1}100%{transform:scaleY(1) scaleX(.35);opacity:.12}}
.sl-ring{position:absolute;left:50%;top:490px;width:200px;height:50px;margin:-25px 0 0 -100px;border-radius:50%;border:2px solid #aee6ff;box-shadow:0 0 16px #29a8ff,inset 0 0 12px #29a8ff;animation:sl-ring 1.2s cubic-bezier(.1,.7,.3,1) var(--d) both;pointer-events:none}
@keyframes sl-ring{from{transform:scale(.1);opacity:1}to{transform:scale(4.5);opacity:0}}
.sl-spk{position:absolute;left:var(--x);top:490px;width:2px;height:var(--h);background:linear-gradient(#fff,rgba(41,168,255,0));box-shadow:0 0 6px #29a8ff;animation:sl-spk var(--du) ease-out var(--d) both}
@keyframes sl-spk{from{transform:translateY(0);opacity:1}to{transform:translateY(var(--ty));opacity:0}}
.sl-w5-t{position:absolute;left:0;right:0;top:140px;text-align:center;font-family:Oxanium,sans-serif;font-weight:800;font-style:italic;font-size:96px;letter-spacing:.04em;background:linear-gradient(180deg,#ffffff 25%,#9edcff 62%,#3aa8ff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 14px rgba(41,168,255,.85));animation:sl-lvt .7s cubic-bezier(.2,.9,.3,1.25) .35s both}
@keyframes sl-lvt{from{transform:scale(2.4);opacity:0;filter:blur(12px)}}
.sl-w5-box{position:absolute;left:50%;top:320px;width:450px;margin-left:-225px;text-align:center;padding:20px 26px;animation:sl-flick .8s linear 1.1s both}
.sl-w5-box .a{font-size:21px}
.sl-w5-box .lv{margin-top:8px;font-size:15px;color:#9fd6ff;letter-spacing:.06em}
.sl-w5-box .lv b{font-family:Oxanium,sans-serif;font-size:22px;color:#fff;margin:0 4px}
.sl-w5-box .lv .nb{color:#ffd36a;display:inline-block;animation:k-popf .5s cubic-bezier(.3,1.7,.5,1) 1.9s both;--s:2}

/* W6 */
.sl-w6s{display:grid}
.sl-w6s>*{grid-area:1/1}
.sl-w6{width:580px;padding:26px 34px 24px;text-align:center}
.sl-w6 .h{display:flex;justify-content:center;margin-bottom:18px}
.sl-w6 .m{font-size:25px}
.sl-w6 .s{margin-top:12px;font-size:12.5px;color:#8fd8ff;letter-spacing:.2em}
.sl-w6::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(160,220,255,.06) 0 1px,transparent 1px 4px);pointer-events:none}
.sl-gh{background:transparent!important;box-shadow:none!important;mix-blend-mode:screen;pointer-events:none}
.sl-gh::after{display:none}
.sl-gh.r,.sl-gh.r *{color:#ff2a55!important;border-color:#ff2a55!important;text-shadow:none!important;box-shadow:none!important;background:transparent!important}
.sl-gh.c,.sl-gh.c *{color:#00f0ff!important;border-color:#00f0ff!important;text-shadow:none!important;box-shadow:none!important;background:transparent!important}
.sl-nz{position:absolute;left:0;right:0;top:var(--t);height:var(--h);background:rgba(160,230,255,.28);mix-blend-mode:screen;transform:translateX(var(--x))}

/* W7 */
.sl-w7{position:absolute;left:180px;top:170px;width:600px;height:260px}
.sl-bk{position:absolute;width:44px;height:44px;border:0 solid #9fe1ff;filter:drop-shadow(0 0 6px #29a8ff);animation:sl-bk 1s cubic-bezier(.7,0,.2,1) .2s both}
.sl-bk.tl{left:0;top:0;border-left-width:3px;border-top-width:3px;--fx:278px;--fy:108px}
.sl-bk.tr{right:0;top:0;border-right-width:3px;border-top-width:3px;--fx:-278px;--fy:108px}
.sl-bk.bl{left:0;bottom:0;border-left-width:3px;border-bottom-width:3px;--fx:278px;--fy:-108px}
.sl-bk.br{right:0;bottom:0;border-right-width:3px;border-bottom-width:3px;--fx:-278px;--fy:-108px}
@keyframes sl-bk{0%{transform:translate(var(--fx),var(--fy)) scale(.3);opacity:0}30%{transform:translate(var(--fx),var(--fy)) scale(1);opacity:1}100%{transform:none;opacity:1}}
.sl-tick{position:absolute;left:50%;width:70px;margin-left:-35px;height:2px;background:#9fe1ff;box-shadow:0 0 8px #29a8ff;animation:k-scalex .5s ease 1.05s both}
.sl-tick.t{top:-1px}.sl-tick.b{bottom:-1px}
.sl-w7-in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.sl-w7-k{font-size:14px;letter-spacing:.4em;color:#8fd8ff;padding-left:.4em}
.sl-w7-n{font-family:Oxanium,sans-serif;font-weight:700;color:#fff;text-shadow:0 0 12px rgba(120,200,255,.9),0 0 30px rgba(41,168,255,.55);letter-spacing:.12em;padding-left:.12em;margin:6px 0 8px;line-height:1.15;animation:sl-sp 1.2s cubic-bezier(.2,.8,.2,1) 1.2s both;white-space:nowrap}
@keyframes sl-sp{from{letter-spacing:.6em;padding-left:.6em;opacity:0;filter:blur(8px)}}
.sl-w7-s{font-size:16px;color:#cfeaff;letter-spacing:.06em}
.sl-w7-sw{position:absolute;left:8px;right:8px;height:1px;top:0;background:linear-gradient(90deg,transparent,#bfe9ff,transparent);box-shadow:0 0 10px #29a8ff;animation:sl-sw 1.1s ease-in-out 1.05s both}
@keyframes sl-sw{0%{transform:translateY(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(258px);opacity:0}}
.sl-w7-bgl{position:absolute;inset:0;background:radial-gradient(closest-side,rgba(41,168,255,.18),transparent);animation:k-fadef 1s ease 1s both}

/* W8 */
.sl-w8{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.sl-w8-glow{position:absolute;left:50%;top:50%;width:760px;height:320px;margin:-160px 0 0 -380px;background:radial-gradient(closest-side,rgba(90,30,180,.5),transparent);filter:blur(10px);animation:k-fadef 1.4s ease both}
.sl-w8-bg{position:absolute;left:0;right:0;top:50%;margin-top:-100px;text-align:center;font-family:Oxanium,sans-serif;font-weight:800;font-size:158px;line-height:200px;color:transparent;-webkit-text-stroke:1.5px rgba(167,120,255,.2);letter-spacing:.06em;animation:sl-awk 2.5s cubic-bezier(.2,.8,.2,1) .2s both}
@keyframes sl-awk{from{letter-spacing:.4em;opacity:0;filter:blur(10px)}}
.sl-w8-k{position:relative;font-size:13px;letter-spacing:.5em;color:#c4a6ff;padding-left:.5em;margin-bottom:12px}
.sl-mk{position:relative;overflow:hidden;padding:0 24px}
.sl-mk>div{animation:sl-rise .9s cubic-bezier(.2,.8,.2,1) var(--d) both}
@keyframes sl-rise{from{transform:translateY(110%)}}
.sl-w8-t{font-size:30px;color:#e6dcff;letter-spacing:.08em}
.sl-w8-n{font-family:Oxanium,sans-serif;font-weight:700;color:#fff;text-shadow:0 0 16px rgba(160,100,255,.95),0 0 40px rgba(110,40,220,.75);line-height:1.2;white-space:nowrap}

/* W9 */
.sl-w9{width:610px;padding:22px 32px 22px}
.sl-w9-h{display:flex;justify-content:center;margin-bottom:18px}
.sl-w9-b{display:flex;gap:30px;align-items:center}
.sl-g{position:relative;width:190px;height:190px;flex:none}
.sl-g svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.sl-g circle{fill:none;stroke-width:6}
.sl-g .bgc{stroke:rgba(120,200,255,.15)}
.sl-g .fg{stroke:#5cc2ff;stroke-dasharray:100;stroke-dashoffset:100;filter:drop-shadow(0 0 6px #29a8ff);animation:sl-gauge 2.3s cubic-bezier(.4,0,.2,1) .5s forwards}
@keyframes sl-gauge{to{stroke-dashoffset:0}}
.sl-rk{position:absolute;inset:0;display:grid;place-items:center;font-family:Oxanium,sans-serif;font-weight:800;font-size:110px;color:#fff;text-shadow:0 0 12px #29a8ff,0 0 30px #29a8ff}
.sl-rk.land{color:#ffe08a;text-shadow:0 0 14px #ffb020,0 0 40px #ff9500;animation:sl-land .6s cubic-bezier(.2,1.6,.4,1) both}
@keyframes sl-land{from{transform:scale(1.9);opacity:.3}}
.sl-g .fl{position:absolute;inset:-40px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,240,200,.95),rgba(255,180,60,.4) 50%,transparent);opacity:0;pointer-events:none}
.sl-g .fl.go{animation:sl-fl .8s ease-out both}
@keyframes sl-fl{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(1.7)}}
.sl-w9-i{flex:1;display:flex;flex-direction:column;gap:10px}
.sl-w9-i .kv{display:flex;justify-content:space-between;font-size:15px;border-bottom:1px solid rgba(120,200,255,.2);padding-bottom:7px}
.sl-w9-i .kv span{color:#8fd8ff}
.sl-w9-i .kv b{font-family:Oxanium,sans-serif;font-weight:600}
.sl-w9-i .res{margin-top:6px;font-size:16px}
.sl-w9-i .res b{color:#ffe08a;font-family:Oxanium,sans-serif;font-size:22px}
.sl-w9-f{margin-top:18px;text-align:center;font-size:17px;opacity:0;transition:opacity .7s}
.sl-w9-f.on{opacity:1}

/* W10 */
.sl-w10v{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 38%,rgba(255,20,50,.38));animation:sl-vig .9s ease-in-out infinite alternate;transition:opacity .9s}
@keyframes sl-vig{from{opacity:.35}to{opacity:1}}
.sl-w10v.off{opacity:0!important;animation:none}
.sl-w10{width:560px;padding:26px 34px 24px;text-align:center;transition:border-color .6s,box-shadow .6s,background .6s}
.sl-w10.red{border-color:#ff5a74;box-shadow:0 0 0 1px rgba(255,40,70,.25),0 0 24px rgba(255,40,70,.6),inset 0 0 26px rgba(255,40,70,.3);background:linear-gradient(180deg,rgba(70,10,24,.85),rgba(34,4,12,.88))}
.sl-w10 .sl-tag,.sl-w10 .sl-bang{transition:border-color .6s,box-shadow .6s,text-shadow .6s}
.sl-w10.red .sl-tag,.sl-w10.red .sl-bang{border-color:#ff9aa9;box-shadow:0 0 12px rgba(255,40,70,.6),inset 0 0 10px rgba(255,40,70,.3);text-shadow:0 0 8px #ff3050}
.sl-w10 .m{margin:18px 0 14px;font-size:19px;line-height:1.5;min-height:58px}
.sl-w10.red .m{color:#ffd0d8}
.sl-w10 .scan{position:relative;height:52px;border:1px solid rgba(120,200,255,.5);overflow:hidden;background:repeating-linear-gradient(90deg,rgba(80,170,255,.14) 0 2px,transparent 2px 12px);transition:border-color .6s}
.sl-w10.red .scan{border-color:rgba(255,120,140,.45);background:repeating-linear-gradient(90deg,rgba(255,80,100,.13) 0 2px,transparent 2px 12px)}
.sl-w10 .scan i{position:absolute;top:0;bottom:0;width:70px;background:linear-gradient(90deg,transparent,rgba(255,90,110,.75),transparent);animation:sl-sc .9s ease-in-out infinite alternate}
.sl-w10:not(.red) .scan i{display:none}
@keyframes sl-sc{from{left:-70px}to{left:100%}}
.sl-w10 .scan b{position:absolute;inset:0;display:grid;place-items:center;font-size:13px;letter-spacing:.3em;color:#9fe1ff;font-weight:600}
.sl-w10.red .scan b{color:#ffb3c0}

/* Seal (rune circle) */
.sl-seal{position:absolute;left:50%;top:50%;width:520px;height:520px;margin:-260px 0 0 -260px;overflow:visible;filter:drop-shadow(0 0 6px #29a8ff);pointer-events:none}
.sl-seal *{fill:none;stroke:#7fd3ff;stroke-width:1.5}
.sl-seal .thin{stroke-width:.8;opacity:.6}
.sl-seal .dash{stroke-dasharray:6 8}
.sl-seal .g1{animation:k-spin 26s linear infinite}
.sl-seal .g2{animation:k-spin 17s linear infinite reverse}
.sl-seal .g3{animation:k-spin 11s linear infinite}
.sl-seal.fast .g1{animation-duration:3s}.sl-seal.fast .g2{animation-duration:2s}.sl-seal.fast .g3{animation-duration:1.4s}

/* Login */
.sl-lg{position:absolute;inset:0;display:grid;place-items:center}
.sl-lg-box{width:430px;padding:24px 32px 22px;display:flex;flex-direction:column;gap:14px;animation:sl-flick .8s linear .1s both}
.sl-lg-h{display:flex;justify-content:center}
.sl-lg-sub{text-align:center;font-size:12.5px;letter-spacing:.24em;color:#7fb8de;margin-top:-2px}
.sl-fld span{display:block;font-size:12px;letter-spacing:.24em;color:#8fd8ff;margin-bottom:6px}
.sl-fld .v{height:42px;border:1px solid rgba(150,215,255,.45);background:rgba(4,16,34,.7);display:flex;align-items:center;padding:0 14px;font-size:16px;color:#fff;transition:border-color .2s,box-shadow .2s}
.sl-fld.focus .v{border-color:#bfe9ff;box-shadow:0 0 12px rgba(41,168,255,.6),inset 0 0 10px rgba(41,168,255,.25)}
.sl-fld [data-p]{letter-spacing:.2em}
.sl-lg-btn{margin-top:4px;height:46px;border:1.5px solid #a6e0ff;background:linear-gradient(180deg,rgba(41,168,255,.35),rgba(20,90,180,.35));color:#fff;font:700 15px 'Chakra Petch',sans-serif;letter-spacing:.4em;padding-left:.4em;box-shadow:0 0 14px rgba(41,168,255,.5),inset 0 0 12px rgba(41,168,255,.3);text-shadow:0 0 8px #3ab0ff;transition:transform .15s,filter .15s}
.sl-lg-btn:disabled{cursor:default}
.sl-lg-st{text-align:center;font-size:13px;letter-spacing:.12em;color:#7fb8de;min-height:18px}
.sl-lg-st[data-state=busy]{color:#9fe1ff}
.sl-lg-st[data-state=ok]{color:#7dffcf;text-shadow:0 0 8px rgba(80,255,200,.6)}
.sl-lg-box.scan::after{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:#bfe9ff;box-shadow:0 0 12px 2px #29a8ff;animation:sl-scanl 1.1s linear infinite}
@keyframes sl-scanl{from{transform:translateY(0)}to{transform:translateY(380px)}}
.sl-lg-box.ok{border-color:#bff0ff;box-shadow:0 0 0 1px rgba(80,255,220,.3),0 0 34px rgba(80,220,255,.8),inset 0 0 30px rgba(41,168,255,.4)}

/* Main page */
.sl-main{overflow:hidden}
.sl-m-bg{position:absolute;inset:0;background:radial-gradient(70% 60% at 72% 58%,#1a2f6b 0%,#0b1631 40%,#040913 80%)}
.sl-m-gate{position:absolute;left:640px;top:330px;width:300px;height:300px;margin:-150px;transform:scaleX(.7)}
.sl-m-gate i{position:absolute;inset:0;border-radius:50%}
.sl-m-gate i:nth-child(1){background:conic-gradient(from 0deg,#0b1a40,#3aa8ff,#7b3cff,#0b1a40,#29d6ff,#5b2bd6,#0b1a40);filter:blur(5px);opacity:.75;animation:k-spin 6s linear infinite}
.sl-m-gate i:nth-child(2){inset:34px;background:radial-gradient(closest-side,#000 40%,rgba(20,6,50,.9) 70%,transparent);}
.sl-m-gate i:nth-child(3){inset:-60px;background:radial-gradient(closest-side,rgba(80,140,255,.35),transparent);filter:blur(10px)}
.sl-m-city{position:absolute;left:0;top:0;width:960px;height:600px}
.sl-m-top{position:absolute;left:0;right:0;top:0;height:58px;display:flex;align-items:center;gap:28px;padding:0 28px;border-bottom:1px solid rgba(120,200,255,.25);background:linear-gradient(180deg,rgba(4,14,30,.9),rgba(4,14,30,.6))}
.sl-m-top .br{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.24em;font-size:14px}
.sl-m-top .br i{width:12px;height:12px;border:1.5px solid #9fe1ff;transform:rotate(45deg);box-shadow:0 0 8px #29a8ff}
.sl-m-top nav{display:flex;gap:22px;font-size:13.5px;color:#7fb8de;letter-spacing:.1em}
.sl-m-top nav .on{color:#fff;text-shadow:0 0 8px #29a8ff}
.sl-m-top .me{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:14px}
.sl-m-top .rk{width:28px;height:28px;display:grid;place-items:center;border:1.5px solid #ffd36a;color:#ffe08a;font-family:Oxanium,sans-serif;font-weight:800;box-shadow:0 0 10px rgba(255,190,60,.5)}
.sl-mp{position:absolute;padding:16px 18px}
.sl-mp h4{margin:0 0 12px;font-size:12.5px;letter-spacing:.3em;color:#8fd8ff;font-weight:600}
.sl-mp.g{left:28px;top:84px;width:400px}
.sl-mp.s{right:28px;top:84px;width:330px}
.sl-mp.q{right:28px;top:262px;width:330px}
.sl-gr{display:grid;grid-template-columns:30px 1fr auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(120,200,255,.15);font-size:14px}
.sl-gr .r{width:28px;height:28px;display:grid;place-items:center;font-family:Oxanium,sans-serif;font-weight:800;border:1.5px solid currentColor}
.sl-gr small{display:block;color:#7fb8de;font-size:12px}
.sl-gr time{font-family:Oxanium,sans-serif;color:#cfeaff;font-size:13px}
.sl-mp .row{display:flex;justify-content:space-between;font-size:13.5px;margin:6px 0}
.sl-mp .row span{color:#8fd8ff}
.sl-mp .bar{height:8px;border:1px solid rgba(150,215,255,.5);padding:1px;margin-bottom:8px}
.sl-mp .bar i{display:block;height:100%}
.sl-mp .q1{display:flex;align-items:center;gap:10px;font-size:14px;margin:6px 0}
.sl-mp .q1 .c{width:18px;height:18px;border:1.5px solid #8fd8ff;display:grid;place-items:center;color:#bff0ff}
.sl-mp .q1 .c .i{width:13px;height:13px;stroke-width:3}

/* Transition FX */
.sl-gate{position:absolute;left:480px;top:300px;width:420px;height:420px;margin:-210px;transform:scaleX(.72)}
.sl-gate>i{position:absolute;inset:0;border-radius:50%}
.sl-gate .gl{inset:-70px;background:radial-gradient(closest-side,rgba(80,160,255,.6),rgba(120,60,255,.25) 60%,transparent);filter:blur(16px);animation:sl-gp 1.4s ease-in-out infinite alternate}
@keyframes sl-gp{to{opacity:.6;transform:scale(1.06)}}
.sl-gate .s1{background:conic-gradient(from 0deg,#0b1a40,#3aa8ff,#7b3cff,#0b1a40,#29d6ff,#5b2bd6,#0b1a40);animation:k-spin 2s linear infinite;filter:blur(3px)}
.sl-gate .s2{inset:24px;background:conic-gradient(from 90deg,transparent,rgba(190,150,255,.9),transparent 30%,rgba(110,210,255,.9) 55%,transparent 72%);animation:k-spin 1.3s linear infinite reverse;filter:blur(2px);mix-blend-mode:screen}
.sl-gate .co{inset:64px;background:radial-gradient(closest-side,#000 0%,#07031a 55%,rgba(40,10,90,0) 100%)}
.sl-gate .rm{border:2px solid rgba(200,235,255,.95);box-shadow:0 0 20px #3aa8ff,0 0 44px #7b3cff,inset 0 0 22px #3aa8ff}
.sl-gate-in{animation:sl-gopen 1.1s cubic-bezier(.2,.9,.2,1.1) both}
@keyframes sl-gopen{from{transform:scaleX(.72) scale(0);opacity:0}}
.sl-gate-t{position:absolute;left:0;right:0;top:530px;text-align:center;font-size:14px;letter-spacing:.42em;color:#bfe3ff;padding-left:.42em;text-shadow:0 0 10px #29a8ff}
.sl-band{position:absolute;left:0;width:960px;height:61px;background:linear-gradient(180deg,#0b2246,#061530);border-top:1px solid rgba(120,200,255,.55);box-shadow:inset 0 0 22px rgba(41,168,255,.25);font:12px ui-monospace,Menlo,Consolas,monospace;color:rgba(160,220,255,.55);white-space:nowrap;overflow:hidden;line-height:61px}
.sl-ovr{width:500px;padding:24px 30px;text-align:center}
.sl-ovr p{margin:16px 0 0;font-size:18px;min-height:52px;line-height:1.5}
.sl-beam{position:absolute;left:50%;top:0;height:600px;width:180px;margin-left:-90px;transform-origin:50% 0;background:linear-gradient(90deg,transparent,rgba(90,180,255,.5) 25%,#ecf9ff 50%,rgba(90,180,255,.5) 75%,transparent);filter:blur(2px)}
.sl-bloom{background:radial-gradient(circle at 50% 60%,#ffffff 0,#bfe9ff 30%,#3a8fff 70%,#0a2a66 100%)}
.sl-lock-c{position:absolute;left:50%;top:50%;width:200px;margin:-50px 0 0 -100px;text-align:center}
.sl-lock-c .ic{width:64px;height:64px;margin:0 auto;border:1.5px solid #a6e0ff;display:grid;place-items:center;color:#dff3ff;box-shadow:0 0 14px rgba(41,168,255,.6),inset 0 0 12px rgba(41,168,255,.3);background:rgba(6,20,42,.8)}
.sl-lock-c .ic .i{width:32px;height:32px}
.sl-lock-c .lb{margin-top:12px;font-size:13px;letter-spacing:.4em;padding-left:.4em;color:#bfe3ff}
.sl-lock.ok .sl-seal *{stroke:#c9f1ff}
.sl-lock.ok .ic{border-color:#7dffe0;color:#7dffe0;box-shadow:0 0 22px rgba(80,255,220,.8)}
.sl-lock.ok .lb{color:#7dffe0}
.sl-seam{position:absolute;left:478px;top:0;width:4px;height:600px;background:#fff;box-shadow:0 0 20px 6px #6cc8ff,0 0 60px 20px rgba(41,168,255,.6)}
`);

function dust(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<span class="sl-dust" style="left:${rand(0, 100).toFixed(1)}%;--s:${rand(1.5, 3.5).toFixed(1)}px;--du:${rand(7, 14).toFixed(1)}s;--dl:-${rand(0, 14).toFixed(1)}s;--dx:${rand(-50, 50).toFixed(0)}px"></span>`;
  return s;
}
function bg(vp) { return add(vp, `<div class="sl-bg"><div class="sl-fog a"></div><div class="sl-fog b"></div><div class="sl-floor"></div>${dust(22)}<div class="sl-scan"></div></div>`); }

function seal(cls = '') {
  let tk = '', rn = '';
  for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180, r1 = i % 5 ? 172 : 164; tk += `<line x1="${(Math.cos(a) * r1).toFixed(1)}" y1="${(Math.sin(a) * r1).toFixed(1)}" x2="${(Math.cos(a) * 180).toFixed(1)}" y2="${(Math.sin(a) * 180).toFixed(1)}"/>`; }
  for (let i = 0; i < 24; i++) rn += `<path transform="rotate(${i * 15})" d="${i % 3 ? 'M0 -147v10M-4 -142h8' : 'M-5 -147l5 9 5-9'}"/>`;
  const tri = (r, rot) => [0, 1, 2].map(k => { const a = (rot + k * 120) * Math.PI / 180; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  return `<svg class="sl-seal ${cls}" viewBox="-200 -200 400 400" aria-hidden="true">
    <g class="g1"><circle r="188"/><circle r="182" class="thin"/>${tk}</g>
    <g class="g2"><circle r="154" class="dash"/>${rn}<circle r="128"/></g>
    <g class="g3"><polygon points="${tri(120, -90)}"/><polygon points="${tri(120, 90)}"/><circle r="62" class="thin"/></g></svg>`;
}

function city() {
  let s = '', x = -10;
  while (x < 970) { const w = rand(26, 64), h = rand(60, 190); s += `<rect x="${x.toFixed(0)}" y="${(600 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>`; x += w + rand(1, 6); }
  let l = '';
  for (let i = 0; i < 70; i++) l += `<rect x="${rand(0, 960).toFixed(0)}" y="${rand(440, 595).toFixed(0)}" width="2" height="2"/>`;
  return `<svg class="sl-m-city" viewBox="0 0 960 600" preserveAspectRatio="none" aria-hidden="true"><g fill="#030812">${s}</g><g fill="#5cc2ff" opacity=".45">${l}</g></svg>`;
}

function mainPage(L, ctx) {
  const gates = [['A', '#ff7088', 'Red Spire', 'Old Port', '00:47:12'], ['B', '#c39bff', 'Sunken Subway', 'East Harbor', '02:14:09'], ['C', '#7fd3ff', 'Glass Orchard', 'North Ward', '05:40:51']];
  return under(L, `<div class="layer sl-main">
    <div class="sl-m-bg"></div><div class="sl-m-gate"><i></i><i></i><i></i></div>${city()}
    <header class="sl-m-top a-fade" style="--d:.1s"><div class="br"><i></i>HUNTER NETWORK</div>
      <nav><span class="on">Gates</span><span>Guild</span><span>Market</span><span>Records</span></nav>
      <div class="me"><span class="rk">S</span><b>${esc(ctx.name)}</b></div></header>
    <section class="sl-win sl-mp g a-left" style="--d:.25s"><h4>ACTIVE GATES</h4>
      ${gates.map(g => `<div class="sl-gr"><span class="r" style="color:${g[1]}">${g[0]}</span><div>${g[2]}<small>${g[3]}</small></div><time>${g[4]}</time></div>`).join('')}</section>
    <section class="sl-win sl-mp s a-right" style="--d:.35s"><h4>STATUS</h4>
      <div class="row"><span>LEVEL</span><b>72</b></div>
      <div class="row"><span>HP</span><b>24,850</b></div><div class="bar"><i style="width:100%;background:linear-gradient(90deg,#ff4d6d,#ff98aa)"></i></div>
      <div class="row"><span>MP</span><b>9,120</b></div><div class="bar"><i style="width:100%;background:linear-gradient(90deg,#2b8fff,#8fd8ff)"></i></div></section>
    <section class="sl-win sl-mp q a-right" style="--d:.45s"><h4>DAILY QUEST</h4>
      <div class="q1"><span class="c">${ico.check}</span>Log in to the System</div>
      <div class="q1"><span class="c"></span>Clear one gate <em style="margin-left:auto;font-style:normal;color:#8fd8ff">0/1</em></div></section>
  </div>`);
}

function login(L, ctx) {
  const root = add(L, `<div class="sl-lg"><div class="sl-win sl-lg-box">
    <div class="sl-lg-h"><span class="sl-tag"><span class="sl-bang">!</span>SYSTEM ACCESS</span></div>
    <div class="sl-lg-sub">HUNTER NETWORK · SECURE GATE</div>
    <div class="sl-fld" data-f><span>HUNTER ID</span><div class="v"><b data-u></b></div></div>
    <div class="sl-fld" data-f><span>PASSKEY</span><div class="v"><b data-p></b></div></div>
    <button class="sl-lg-btn" data-btn>ENTER</button>
    <div class="sl-lg-st" data-status>[ Awaiting input ]</div></div></div>`);
  return G.loginKit(root, ctx);
}

const tickSvg = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg>';

/* -------------------- 10 welcome windows -------------------- */
const WL = [
{
  title: 'System Notification', tags: ['Bordered', 'Typewriter'],
  desc: 'The window outline draws itself from the top centre in both directions, the panel flickers on and the System types its message to you.',
  build(L, ctx) {
    const r = add(L, `<div class="center"><div class="sl-w1">
      <svg viewBox="0 0 580 270" preserveAspectRatio="none"><path d="M290 1H579V269H290" pathLength="1"/><path d="M290 1H1V269H290" pathLength="1"/></svg>
      <div class="sl-win sl-w1-box"><span class="sl-tag"><span class="sl-bang">!</span>NOTIFICATION</span>
        <p class="l1"></p><p class="l2"></p><p class="l3">[ All systems online. Your journey continues. ]</p></div></div></div>`);
    const l1 = r.querySelector('.l1'), l2 = r.querySelector('.l2');
    (async () => {
      await ctx.wait(1500);
      l1.classList.add('cur'); await ctx.type(l1, 'Authentication complete.', 28); l1.classList.remove('cur');
      await ctx.wait(220);
      l2.innerHTML = '<span class="a"></span><span class="sl-hl"></span>';
      l2.classList.add('cur');
      await ctx.type(l2.querySelector('.a'), 'Welcome back, Hunter ', 28);
      await ctx.type(l2.querySelector('.sl-hl'), ctx.name, 45);
      await ctx.wait(300); l2.classList.remove('cur');
      r.querySelector('.l3').classList.add('show');
    })();
  },
},
{
  title: 'System Whisper', tags: ['Borderless', 'Flicker'],
  desc: 'No window: each letter flickers on independently, a light streak slices through, the name glows in with a sweeping shine and one quiet line types out.',
  build(L, ctx) {
    const r = add(L, `<div class="sl-w2">
      <div class="sl-w2-k">[ SYSTEM ]</div>
      <div class="sl-w2-t">${split('WELCOME BACK', 'ch', () => `--r:${rand(0, .8).toFixed(2)}s`)}</div>
      <div class="sl-w2-nw"><div class="sl-w2-streak"></div><div class="sl-w2-n" style="font-size:${G.fit(ctx.name, 52, 760, .72)}px">${esc(ctx.name.toUpperCase())}</div></div>
      <div class="sl-w2-s"></div></div>`);
    const s = r.querySelector('.sl-w2-s');
    ctx.wait(2400).then(async () => { s.classList.add('cur'); await ctx.type(s, 'The System has been waiting for you.', 32); });
  },
},
{
  title: 'Log-in Reward', tags: ['Quest', 'Checklist'],
  desc: 'A quest-style window lists the log-in objectives; each row slides in and its checkbox ticks itself, with a live countdown to the daily reset.',
  build(L, ctx) {
    const rows = [['Access the System', '[1/1]'], ['Consecutive days', '[12/12]'], ['Reward: +3 Stat Points', '[Claimed]']];
    const r = add(L, `<div class="center"><div class="sl-win sl-w3 sl-in" style="--d:.1s">
      <div class="sl-w3-top sl-in" style="--d:.35s"><span class="sl-tag"><span class="sl-bang">!</span>LOG-IN REWARD</span></div>
      <h3 class="sl-glow sl-in" style="--d:.6s">Daily Log-in<small>[ Day 12 ]</small></h3>
      <ul>${rows.map((x, i) => `<li class="a-left" style="--d:${(.9 + i * .25).toFixed(2)}s"><span class="sl-ck" style="--d2:${(1.25 + i * .25).toFixed(2)}s">${tickSvg}</span><span>${x[0]}</span><em>${x[1]}</em></li>`).join('')}</ul>
      <div class="sl-w3-w sl-in" style="--d:2.05s">Welcome back, <span class="sl-hl">${esc(ctx.name)}</span>. Rewards have been added to your inventory.</div>
      <div class="sl-w3-t a-fade" style="--d:2.3s">NEXT RESET IN <b class="tm">--:--:--</b></div></div></div>`);
    const tm = r.querySelector('.tm');
    const tick = () => { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); let s = Math.max(0, Math.floor((m - n) / 1000)); tm.textContent = [s / 3600 | 0, (s % 3600) / 60 | 0, s % 60].map(v => String(v).padStart(2, '0')).join(':'); };
    tick(); ctx.every(1000, tick);
  },
},
{
  title: 'Status Window', tags: ['Stats', 'Count-up'],
  desc: 'The full status sheet: level, HP and MP count up from zero, bars fill and the five stats tally in, with unspent points blinking at the bottom.',
  build(L, ctx) {
    const st = [['STR', 184], ['AGI', 201], ['VIT', 156], ['INT', 132], ['SENSE', 170]];
    const r = add(L, `<div class="center"><div class="sl-win sl-w4 sl-in" style="--d:.1s">
      <div class="sl-w4-h sl-in" style="--d:.3s"><span class="sl-tag">STATUS</span></div>
      <div class="sl-w4-g">
        <div class="a-left" style="--d:.55s">
          <div class="sl-kv"><span>NAME</span><b>${esc(ctx.name)}</b></div>
          <div class="sl-kv"><span>CLASS</span><b>Shadow Vanguard</b></div>
          <div class="sl-kv"><span>TITLE</span><b>The One Who Returned</b></div></div>
        <div class="sl-w4-lv sl-in" style="--d:.6s"><span>LEVEL</span><b class="lv">1</b></div></div>
      <div class="sl-bars a-fade" style="--d:.8s">
        <div class="sl-bar hp"><div class="l"><span>HP</span><b class="hp">0</b></div><div class="t"><i style="--d:.9s"></i></div></div>
        <div class="sl-bar mp"><div class="l"><span>MP</span><b class="mp">0</b></div><div class="t"><i style="--d:1s"></i></div></div></div>
      <div class="sl-stats">${st.map((s, i) => `<div class="a-up" style="--d:${(1.1 + i * .08).toFixed(2)}s"><span>${s[0]}</span><b data-v="${s[1]}">0</b></div>`).join('')}</div>
      <div class="sl-w4-f a-fade" style="--d:1.8s"><span>Welcome back, <span class="sl-hl">${esc(ctx.name)}</span>.</span><span class="pts">Available points: 3</span></div>
    </div></div>`);
    const q = s => r.querySelector(s);
    ctx.wait(650).then(() => {
      ctx.count(q('.lv'), 1, 72, 1500);
      ctx.count(q('b.hp'), 0, 24850, 1500, v => Math.round(v).toLocaleString('en-US') + ' / 24,850');
      ctx.count(q('b.mp'), 0, 9120, 1500, v => Math.round(v).toLocaleString('en-US') + ' / 9,120');
    });
    ctx.wait(1150).then(() => r.querySelectorAll('[data-v]').forEach(b => ctx.count(b, 0, +b.dataset.v, 1200)));
  },
},
{
  title: 'Level Up', tags: ['Burst', 'Light pillar'],
  desc: 'A pillar of light slams down, shockwave rings and sparks burst from the ground, LEVEL UP! punches in and a window shows your log-in level gain.',
  build(L, ctx) {
    let sp = '';
    for (let i = 0; i < 26; i++) sp += `<i class="sl-spk" style="--x:${(480 + rand(-110, 110)).toFixed(0)}px;--h:${rand(20, 60).toFixed(0)}px;--ty:-${rand(160, 420).toFixed(0)}px;--du:${rand(.8, 1.6).toFixed(2)}s;--d:${rand(.3, .9).toFixed(2)}s"></i>`;
    add(L, `<div class="sl-w5"><div class="sl-w5-p"></div>
      <i class="sl-ring" style="--d:.3s"></i><i class="sl-ring" style="--d:.5s"></i><i class="sl-ring" style="--d:.75s"></i>${sp}
      <div class="sl-w5-t">LEVEL UP!</div>
      <div class="sl-win sl-w5-box"><div class="a">Welcome back, <span class="sl-hl">${esc(ctx.name)}</span></div>
        <div class="lv">Log-in streak bonus · Lv.<b>72</b>›<b class="nb">73</b></div></div></div>`);
    ctx.wait(420).then(() => G.shake(L, 450, 7));
  },
},
{
  title: 'Glitch Override', tags: ['Glitch', 'RGB split'],
  desc: 'The window bursts onto the screen as corrupted signal: sliced, jittering, with red and cyan ghosts and noise bars, then locks into a clean ACCESS GRANTED.',
  build(L, ctx) {
    const wrap = add(L, `<div class="center"><div class="sl-w6s"><div class="sl-win sl-w6">
      <div class="h"><span class="sl-tag"><span class="sl-bang">${ico.check}</span>ACCESS GRANTED</span></div>
      <div class="m">Welcome back, <span class="sl-hl">${esc(ctx.name)}</span>.</div>
      <div class="s">IDENTITY VERIFIED · RANK S · SERVER GLOBAL-01</div></div></div></div>`).querySelector('.sl-w6s');
    const win = wrap.firstElementChild;
    const r = win.cloneNode(true), c = win.cloneNode(true);
    r.classList.add('sl-gh', 'r'); c.classList.add('sl-gh', 'c'); wrap.append(r, c);
    const gk = sign => { const k = []; for (let i = 0; i < 24; i++) { const a = rand(0, 80), b = rand(a + 6, 100); k.push({ transform: `translate(${(sign * rand(4, 22)).toFixed(1)}px,${rand(-2, 2).toFixed(1)}px)`, clipPath: `inset(${a.toFixed(1)}% 0 ${(100 - b).toFixed(1)}% 0)`, opacity: Math.random() < .2 ? 0 : .9, easing: 'steps(1,end)' }); } k.push({ opacity: 0 }); return k; };
    r.animate(gk(-1), { duration: 1300, fill: 'forwards' }); c.animate(gk(1), { duration: 1300, fill: 'forwards' });
    G.glitch(win, 1300);
    const nz = add(L, '<div class="layer" style="pointer-events:none"></div>');
    let on = true;
    ctx.every(70, () => { if (!on) return; nz.innerHTML = Array.from({ length: 3 }, () => `<i class="sl-nz" style="--t:${rand(120, 480).toFixed(0)}px;--h:${rand(2, 14).toFixed(0)}px;--x:${rand(-40, 40).toFixed(0)}px"></i>`).join(''); });
    ctx.wait(1350).then(() => { on = false; nz.innerHTML = ''; r.remove(); c.remove(); ctx.every(3800, () => G.glitch(win, 260)); });
  },
},
{
  title: 'Corner Brackets', tags: ['Frameless', 'Minimal'],
  desc: 'Four corner brackets gather at the centre, then snap out to frame the space; a scan line passes and the name condenses in from wide letter spacing.',
  build(L, ctx) {
    add(L, `<div class="sl-w7"><div class="sl-w7-bgl"></div>
      <i class="sl-bk tl"></i><i class="sl-bk tr"></i><i class="sl-bk bl"></i><i class="sl-bk br"></i><i class="sl-tick t"></i><i class="sl-tick b"></i>
      <div class="sl-w7-sw"></div>
      <div class="sl-w7-in"><div class="sl-w7-k sl-in" style="--d:1s">[ PLAYER CONFIRMED ]</div>
        <div class="sl-w7-n" style="font-size:${G.fit(ctx.name, 62, 520, .86)}px">${esc(ctx.name.toUpperCase())}</div>
        <div class="sl-w7-s a-fade" style="--d:1.9s">Welcome back. The System is ready.</div></div></div>`);
  },
},
{
  title: 'Shadow Rise', tags: ['Particles', 'Dark aura'],
  desc: 'Purple-black smoke and embers rise from below on canvas, a giant outlined word looms behind and the greeting climbs up out of the dark.',
  build(L, ctx) {
    const g = ctx.canvas(L);
    const sp = init => ({ x: rand(60, 900), y: init ? rand(180, 660) : rand(620, 700), r: rand(24, 80), vy: rand(22, 60), vx: rand(-8, 8), h: G.pick([268, 276, 255, 230]), a: rand(.12, .3) });
    const P = Array.from({ length: 90 }, () => sp(true));
    const E = Array.from({ length: 50 }, () => ({ x: rand(0, 960), y: rand(0, 600), v: rand(30, 90), s: rand(1, 2.6), ph: rand(0, 6) }));
    ctx.raf((t, dt) => {
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      for (const p of P) {
        p.y -= p.vy * dt; p.x += p.vx * dt + Math.sin(t * .8 + p.r) * .3; p.r += dt * 7;
        if (p.y < -90) Object.assign(p, sp(false));
        const k = Math.max(0, Math.min(1, p.y / 600)) * Math.min(1, t * .8);
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        gr.addColorStop(0, `hsla(${p.h},70%,22%,${(p.a * k).toFixed(3)})`); gr.addColorStop(1, 'hsla(270,60%,10%,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      }
      g.globalCompositeOperation = 'lighter';
      for (const e of E) {
        e.y -= e.v * dt; e.x += Math.sin(t * 2 + e.ph) * .4; if (e.y < -10) { e.y = 610; e.x = rand(0, 960); }
        g.fillStyle = `hsla(275,100%,72%,${(.5 + .5 * Math.sin(t * 4 + e.ph)) * .8 * Math.min(1, t)})`;
        g.fillRect(e.x, e.y, e.s, e.s);
      }
      g.globalCompositeOperation = 'source-over';
    });
    add(L, `<div class="sl-w8"><div class="sl-w8-glow"></div><div class="sl-w8-bg">AWAKEN</div>
      <div class="sl-w8-k a-fade" style="--d:.8s">— THE SHADOWS ANSWER —</div>
      <div class="sl-mk"><div class="sl-w8-t" style="--d:1.1s">Welcome back,</div></div>
      <div class="sl-mk"><div class="sl-w8-n" style="--d:1.3s;font-size:${G.fit(ctx.name, 72, 820, .66)}px">${esc(ctx.name)}</div></div></div>`);
  },
},
{
  title: 'Rank Appraisal', tags: ['Evaluation', 'Impact'],
  desc: 'An evaluation window spins through the ranks E to S while the gauge fills and the readings count up, then slams down on S with a flash and a shake.',
  build(L, ctx) {
    const r = add(L, `<div class="center"><div class="sl-win sl-w9 sl-in" style="--d:.1s">
      <div class="sl-w9-h"><span class="sl-tag">HUNTER EVALUATION</span></div>
      <div class="sl-w9-b">
        <div class="sl-g"><svg viewBox="0 0 200 200"><circle class="bgc" cx="100" cy="100" r="88"/><circle class="fg" cx="100" cy="100" r="88" pathLength="100"/></svg><div class="sl-rk">E</div><div class="fl"></div></div>
        <div class="sl-w9-i">
          <div class="kv a-left" style="--d:.4s"><span>Mana response</span><b class="m1">0.0%</b></div>
          <div class="kv a-left" style="--d:.5s"><span>Physical output</span><b class="m2">0</b></div>
          <div class="kv a-left" style="--d:.6s"><span>Gates cleared</span><b class="m3">0</b></div>
          <div class="res a-fade" style="--d:.7s">Rank: <b class="rt">—</b></div></div></div>
      <div class="sl-w9-f">Welcome back, S-Rank Hunter <span class="sl-hl">${esc(ctx.name)}</span>.</div></div></div>`);
    const q = s => r.querySelector(s), win = q('.sl-w9');
    (async () => {
      await ctx.wait(500);
      ctx.count(q('.m1'), 0, 98.7, 2200, v => v.toFixed(1) + '%');
      ctx.count(q('.m2'), 0, 12840, 2200);
      ctx.count(q('.m3'), 0, 214, 2200);
      const seq = 'EDCBASEDCBASCBAS'.split('');
      for (let i = 0; i < seq.length; i++) { q('.sl-rk').textContent = seq[i]; q('.rt').textContent = seq[i]; await ctx.wait(55 + i * i * 1.1); }
      q('.sl-rk').classList.add('land'); q('.fl').classList.add('go'); G.shake(win, 450, 7);
      q('.rt').textContent = 'S'; q('.sl-w9-f').classList.add('on');
    })();
  },
},
{
  title: 'Alert → Verified', tags: ['Alert', 'Colour shift'],
  desc: 'Starts as a red warning with a pulsing vignette and a scanner sweeping your ID, then flips to calm blue once your identity checks out and greets you.',
  build(L, ctx) {
    const r = add(L, `<div class="layer"><div class="sl-w10v"></div><div class="center"><div class="sl-win sl-w10 red sl-in" style="--d:.1s">
      <div><span class="sl-tag"><span class="sl-bang">!</span><span class="ht">WARNING</span></span></div>
      <div class="m">Unverified access detected.<br>Scanning identity…</div>
      <div class="scan"><i></i><b>SCANNING</b></div></div></div></div>`);
    const q = s => r.querySelector(s), win = q('.sl-w10');
    (async () => {
      await ctx.wait(2300);
      win.classList.remove('red'); q('.sl-w10v').classList.add('off');
      win.animate([{ opacity: 1 }, { opacity: .2 }, { opacity: 1 }, { opacity: .5 }, { opacity: 1 }], { duration: 380 });
      q('.ht').textContent = 'VERIFIED'; q('.sl-bang').innerHTML = ico.check; q('.scan b').textContent = 'MATCH · 100%';
      const m = q('.m'); m.innerHTML = 'Identity confirmed.<br><span class="a"></span><span class="sl-hl"></span>';
      await ctx.wait(400);
      await ctx.type(m.querySelector('.a'), 'Welcome back, ', 30);
      await ctx.type(m.querySelector('.sl-hl'), ctx.name + '.', 45);
    })();
  },
},
];

/* -------------------- 5 login transitions -------------------- */
function spiral(parent, ctx, cx, cy) {
  const g = ctx.canvas(parent);
  const sp = p => { p.r = rand(170, 520); p.a = rand(0, 6.283); p.v = rand(.6, 1.4); p.c = G.pick(['#7fd3ff', '#3aa8ff', '#b388ff', '#ffffff']); p.s = rand(1, 2.4); return p; };
  const P = Array.from({ length: 240 }, () => sp({}));
  ctx.raf((t, dt) => {
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const p of P) {
      p.a += dt * (1.1 + 150 / p.r) * p.v; p.r -= dt * (50 + 9000 / p.r) * p.v * .5;
      if (p.r < 40) sp(p);
      g.globalAlpha = Math.min(1, (p.r - 40) / 80) * Math.min(1, t * 2);
      g.fillStyle = p.c; g.fillRect(cx + Math.cos(p.a) * p.r * .72, cy + Math.sin(p.a) * p.r, p.s, p.s);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  });
  return g;
}

function engulf(parent, ctx, inS = 1.4, hold = .6, outS = 1.7) {
  const g = ctx.canvas(parent);
  const B = [];
  for (let i = 0; i < 64; i++) { const side = i % 4, u = rand(-.05, 1.05), o = rand(-20, 90); B.push({ x: side === 0 || side === 2 ? u * W : side === 1 ? W + 30 - o : -30 + o, y: side === 1 || side === 3 ? u * H : side === 0 ? -30 + o : H + 30 - o, k: rand(.5, 1.35), ph: rand(0, 6) }); }
  const E = Array.from({ length: 70 }, () => ({ x: rand(0, 960), y: rand(200, 650), v: rand(60, 160), s: rand(1, 3) }));
  const ease = x => x * x * (3 - 2 * x);
  ctx.raf((t, dt) => {
    g.clearRect(0, 0, W, H);
    let k, lift = 0;
    if (t < inS) k = ease(t / inS); else if (t < inS + hold) k = 1; else { const u = Math.min(1, (t - inS - hold) / outS); k = 1 - ease(u); lift = u * 180; }
    const R = k * 600;
    if (R > 1) {
      const rs = B.map(b => R * b.k * (1 + .09 * Math.sin(t * 2.6 + b.ph)));
      g.globalAlpha = Math.min(1, k * 2.2);
      B.forEach((b, i) => {
        const r = rs[i], y = b.y - lift * b.k, x = b.x + Math.sin(t * 1.3 + b.ph) * 18;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(3,0,8,1)'); gr.addColorStop(.8, 'rgba(6,1,16,.98)'); gr.addColorStop(1, 'rgba(6,1,16,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      });
      g.globalCompositeOperation = 'destination-over';
      B.forEach((b, i) => {
        const r = rs[i] * 1.18, y = b.y - lift * b.k, x = b.x + Math.sin(t * 1.3 + b.ph) * 18;
        const gr = g.createRadialGradient(x, y, r * .6, x, y, r);
        gr.addColorStop(0, 'rgba(120,50,240,.32)'); gr.addColorStop(1, 'rgba(60,20,140,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      });
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    if (t > inS * .5) {
      g.globalCompositeOperation = 'lighter';
      for (const e of E) { e.y -= e.v * dt; if (e.y < -10) { e.y = 610; e.x = rand(0, 960); } g.fillStyle = `rgba(170,110,255,${(.7 * Math.min(1, k * 1.5)).toFixed(2)})`; g.fillRect(e.x, e.y, e.s, e.s); }
      g.globalCompositeOperation = 'source-over';
    }
    if (t > inS + hold + outS + .1) { g.el.remove(); return false; }
  });
}

async function authBasic(ctx, lg, ms = 1700) {
  await lg.fill(); ctx.step(1);
  lg.status('[ Verifying hunter signature… ]', 'busy');
  const box = lg.root.querySelector('.sl-lg-box'); box.classList.add('scan');
  await ctx.wait(ms);
  ctx.step(2); box.classList.remove('scan'); box.classList.add('ok'); lg.status('[ ACCESS APPROVED ]', 'ok');
  return box;
}

const TR = [
{
  title: 'Gate Warp', tags: ['Portal', 'Warp'],
  desc: 'A rune seal turns under the login window while it scans you. On approval the window flickers out, a swirling gate tears open, and the camera dives through it at warp speed into the hub.',
  async run(L, ctx, lg) {
    const sl = G.el(seal()); L.insertBefore(sl, lg.root); sl.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: .8, transform: 'scale(1)' }], { duration: 700, fill: 'forwards' });
    await authBasic(ctx, lg, 1900);
    sl.classList.add('fast');
    await ctx.wait(900);
    ctx.step(3);
    lg.root.animate([{ opacity: 1 }, { opacity: .2 }, { opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' });
    sl.animate([{ opacity: .8 }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 600, fill: 'forwards' });
    await ctx.wait(350);
    const gate = add(L, '<div class="sl-gate sl-gate-in"><i class="gl"></i><i class="s1"></i><i class="s2"></i><i class="co"></i><i class="rm"></i></div>');
    const sp = spiral(L, ctx, 480, 300);
    const gt = add(L, '<div class="sl-gate-t a-fade" style="--d:.4s">DIMENSIONAL GATE · ENTERING</div>');
    await ctx.wait(1700);
    gate.animate([{ transform: 'scaleX(.72) scale(1)' }, { transform: 'scaleX(.72) scale(9)' }], { duration: 1100, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' });
    gt.remove();
    await ctx.wait(650);
    const w = add(L, '<div class="layer"></div>');
    w.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' });
    G.warp(w, ctx, { dur: 1.7, n: 380, glow: true, v1: 2.8, color: () => G.pick(['#7fd3ff', '#3aa8ff', '#b388ff', '#ffffff', '#5b8cff']), glowColor: a => `rgba(170,215,255,${a})` });
    await ctx.wait(1650);
    const fl = G.flash(L, '#dff3ff', 220);
    await ctx.wait(260);
    gate.remove(); sp.el.remove(); w.remove(); lg.root.remove(); sl.remove();
    const m = mainPage(L, ctx); ctx.step(4);
    m.animate([{ transform: 'scale(1.08)' }, { transform: 'none' }], { duration: 1200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    fl.out(1000);
    await ctx.wait(1200);
    ctx.step(5); G.welcomeOver(L, ctx, WL[0]);
    await ctx.wait(3800);
  },
},
{
  title: 'System Override', tags: ['Glitch', 'Wipe'],
  desc: 'The screen glitches as a SYSTEM OVERRIDE window rewrites your access, then data bands slam in from alternating sides and peel away to reveal the hub.',
  async run(L, ctx, lg) {
    await authBasic(ctx, lg, 1500);
    await ctx.wait(700);
    ctx.step(3);
    G.glitch(lg.root, 900);
    const ov = add(L, `<div class="center"><div class="sl-win sl-ovr sl-in"><span class="sl-tag"><span class="sl-bang">!</span>SYSTEM OVERRIDE</span><p class="t cur"></p></div></div>`);
    const p = ov.querySelector('.t');
    await ctx.type(p, 'Rewriting access permissions…', 24);
    await ctx.wait(250);
    p.innerHTML = 'Rewriting access permissions…<br><span class="sl-hl">Player privileges granted.</span>';
    G.glitch(ov.firstElementChild, 500);
    await ctx.wait(650);
    const codes = () => Array.from({ length: 6 }, () => `SYS::0x${Math.floor(rand(4096, 65535)).toString(16).toUpperCase()} ▮▮▯ OVERRIDE`).join('&nbsp;&nbsp;&nbsp;&nbsp;');
    const bands = add(L, `<div class="layer">${Array.from({ length: 10 }, (_, i) => `<div class="sl-band" style="top:${i * 60}px;text-indent:${rand(-200, 0).toFixed(0)}px">${codes()}</div>`).join('')}</div>`);
    [...bands.children].forEach((b, i) => b.animate([{ transform: `translateX(${i % 2 ? '' : '-'}100%)` }, { transform: 'none' }], { duration: 420, delay: i * 40, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' }));
    await ctx.wait(900);
    lg.root.remove(); ov.remove();
    mainPage(L, ctx); ctx.step(4);
    [...bands.children].forEach((b, i) => b.animate([{ transform: 'none' }, { transform: `translateX(${i % 2 ? '-' : ''}100%)` }], { duration: 480, delay: 150 + i * 40, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' }));
    await ctx.wait(1200); bands.remove();
    ctx.step(5); G.welcomeOver(L, ctx, WL[2]);
    await ctx.wait(3000);
  },
},
{
  title: 'Shadow Engulf', tags: ['Smoke', 'Canvas'],
  desc: 'Living darkness creeps in from every edge with a violet rim until the screen is swallowed, then it lifts away like smoke and leaves you in the hub.',
  async run(L, ctx, lg) {
    await authBasic(ctx, lg, 1600);
    await ctx.wait(700);
    ctx.step(3);
    const fx = add(L, '<div class="layer" style="pointer-events:none"></div>');
    engulf(fx, ctx, 1.4, .6, 1.8);
    await ctx.wait(1750);
    lg.root.remove();
    mainPage(L, ctx);
    await ctx.wait(900); ctx.step(4);
    await ctx.wait(1300);
    ctx.step(5); G.welcomeOver(L, ctx, WL[7]);
    await ctx.wait(3000);
  },
},
{
  title: 'Ascension Pillar', tags: ['Impact', 'Bloom'],
  desc: 'The login window lifts away, a beam of light crashes down the centre of the screen, shockwaves roll out and a blue-white bloom carries you into the hub.',
  async run(L, ctx, lg) {
    const sl = G.el(seal()); L.insertBefore(sl, lg.root); sl.style.opacity = '.55';
    await authBasic(ctx, lg, 1600);
    await ctx.wait(700);
    ctx.step(3);
    lg.root.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-60px)', opacity: 0 }], { duration: 500, easing: 'ease-in', fill: 'forwards' });
    sl.classList.add('fast');
    await ctx.wait(450);
    const beam = add(L, '<div class="sl-beam"></div>');
    beam.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 240, easing: 'cubic-bezier(.6,0,1,.6)', fill: 'forwards' });
    await ctx.wait(240);
    G.shake(L, 520, 11);
    add(L, '<div><i class="sl-ring" style="--d:0s;top:560px"></i><i class="sl-ring" style="--d:.12s;top:560px"></i><i class="sl-ring" style="--d:.26s;top:560px"></i></div>');
    beam.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(2.6)' }], { duration: 500, fill: 'forwards', composite: 'add' });
    const bl = add(L, '<div class="layer sl-bloom"></div>');
    bl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 550, easing: 'ease-in', fill: 'forwards' });
    await ctx.wait(650);
    lg.root.remove(); beam.remove(); sl.remove();
    mainPage(L, ctx); ctx.step(4);
    bl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, easing: 'ease-out', fill: 'forwards' });
    await ctx.wait(1200); bl.remove();
    ctx.step(5); G.welcomeOver(L, ctx, WL[8]);
    await ctx.wait(3800);
  },
},
{
  title: 'Gate Lock', tags: ['Seal', 'Doors'],
  desc: 'Your credentials are fed into a three-ring rune lock that spins while it verifies, snaps into alignment on approval, then splits down the middle like a vault door.',
  async run(L, ctx, lg) {
    await lg.fill(); ctx.step(1);
    lg.status('[ Verifying hunter signature… ]', 'busy');
    lg.root.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.9)' }], { duration: 450, delay: 250, fill: 'forwards' });
    await ctx.wait(500);
    const lock = add(L, `<div class="layer sl-lock">${seal('fast')}<div class="sl-lock-c"><div class="ic">${ico.lock}</div><div class="lb">VERIFYING</div></div></div>`);
    lock.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
    await ctx.wait(1700);
    ctx.step(2);
    ['.g1', '.g2', '.g3'].forEach((s, i) => {
      const gEl = lock.querySelector(s), m = new DOMMatrix(getComputedStyle(gEl).transform);
      const ang = Math.atan2(m.b, m.a) * 180 / Math.PI, rev = i === 1;
      const target = rev ? ang - (((ang % 360) + 360) % 360) : ang + (360 - (((ang % 360) + 360) % 360));
      gEl.style.animation = 'none';
      gEl.animate([{ transform: `rotate(${ang}deg)` }, { transform: `rotate(${target}deg)` }], { duration: 700 + i * 150, easing: 'cubic-bezier(.3,1.35,.5,1)', fill: 'forwards' });
    });
    await ctx.wait(900);
    lock.classList.add('ok'); lock.querySelector('.ic').innerHTML = ico.unlock; lock.querySelector('.lb').textContent = 'UNLOCKED';
    const f = G.flash(L, 'rgba(190,235,255,.5)', 90); f.out(400);
    await ctx.wait(800);
    ctx.step(3);
    lg.root.remove();
    mainPage(L, ctx);
    const doors = G.pieces(L, [ctx.bgEl, lock], [[[0, 0], [480, 0], [480, 600], [0, 600]], [[480, 0], [960, 0], [960, 600], [480, 600]]]);
    const seam = add(L, '<div class="sl-seam"></div>');
    seam.animate([{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 250, fill: 'forwards' });
    await ctx.wait(300);
    doors.list[0].el.animate([{ transform: 'none' }, { transform: 'translateX(-500px)' }], { duration: 1100, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
    doors.list[1].el.animate([{ transform: 'none' }, { transform: 'translateX(500px)' }], { duration: 1100, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
    seam.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(30)' }], { duration: 700, delay: 100, fill: 'forwards' });
    await ctx.wait(800); ctx.step(4);
    await ctx.wait(500); doors.wrap.remove(); seam.remove();
    ctx.step(5); G.welcomeOver(L, ctx, WL[3]);
    await ctx.wait(3200);
  },
},
];

G.theme({
  key: 'sl', title: 'Solo Leveling', sub: 'Glowing blue System windows',
  accent: '#3aa8ff', swatch: ['#06142a', '#3aa8ff', '#8b5cf6'],
  blurbW: 'Translucent navy windows with electric-blue glowing borders, flickering power-on, typed System messages, quest and status sheets.',
  blurbT: 'From the Hunter Network sign-in to the hub: gate warp, override wipe, shadow engulf, light pillar and a rune vault door.',
  bg, login, main: mainPage, welcomes: WL, transitions: TR,
});
})();

/* ===== Theme 3 — Final Fantasy VII Remake style (navy glass panels, cyan + energy green) ===== */
(() => {
const { add, under, split, esc, rand, ico, W, H } = G;

G.css(`
.th-ff{font-family:'Jost',system-ui,sans-serif;color:#eaf4ff;--caret:#7fd6ff}
.ff-bg{position:absolute;inset:0;background:linear-gradient(180deg,#03070d 0%,#071523 52%,#0b2233 76%,#0b1f26 100%);overflow:hidden}
.ff-haze{position:absolute;left:-20%;right:-20%;bottom:40px;height:280px;background:radial-gradient(50% 50% at 50% 60%,rgba(70,255,190,.26),rgba(40,160,200,.10) 50%,transparent 75%);filter:blur(8px);animation:ff-br 7s ease-in-out infinite alternate}
@keyframes ff-br{to{opacity:.65;transform:scaleX(1.08)}}
.ff-city{position:absolute;left:0;top:0;width:960px;height:600px}
.ff-fog{position:absolute;left:-50%;width:200%;bottom:-20px;height:200px;background:radial-gradient(40% 60% at 30% 70%,rgba(60,120,130,.25),transparent 70%),radial-gradient(40% 60% at 75% 80%,rgba(60,120,130,.22),transparent 70%);animation:ff-fog 26s linear infinite}
@keyframes ff-fog{to{transform:translateX(25%)}}
.ff-mote{position:absolute;bottom:-10px;width:var(--s);height:var(--s);border-radius:50%;background:#8dffd6;box-shadow:0 0 8px 2px rgba(70,255,180,.65);opacity:0;animation:ff-mote var(--du) linear var(--dl) infinite}
@keyframes ff-mote{0%{transform:translate(0,0);opacity:0}20%{opacity:.85}100%{transform:translate(var(--dx),-560px);opacity:0}}
.ff-vig{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 40%,transparent 50%,rgba(0,0,0,.6))}

.ff-panel{position:relative;background:linear-gradient(100deg,rgba(22,54,88,.94) 0%,rgba(14,36,62,.9) 55%,rgba(9,24,42,.82) 100%);border:1px solid rgba(150,205,255,.34);box-shadow:0 24px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(210,240,255,.22);color:#eaf4ff}
.ff-cut{clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)}
.ff-lbl{font-size:12px;letter-spacing:.34em;color:#8fc8ec;text-transform:uppercase}
.ff-acc{color:#7fd6ff}

/* W1 */
.ff-w1{position:relative;filter:drop-shadow(0 24px 40px rgba(0,0,0,.5))}
.ff-w1-st{position:absolute;left:-260px;right:-260px;top:50%;height:150px;margin-top:-75px;background:linear-gradient(90deg,transparent,rgba(127,214,255,.10) 30%,rgba(127,214,255,.10) 70%,transparent);transform:skewY(-5deg);animation:ff-band 1.2s cubic-bezier(.2,.8,.2,1) both}
@keyframes ff-band{from{transform:skewY(-5deg) scaleX(0)}}
.ff-w1-p{width:580px;padding:30px 40px 26px;animation:ff-skew .85s cubic-bezier(.16,1,.3,1) .1s both}
@keyframes ff-skew{from{transform:translateX(-170px) skewX(-14deg);opacity:0}}
.ff-w1-ln{position:absolute;left:0;top:0;height:2px;width:100%;background:linear-gradient(90deg,#d6f1ff,#7fd6ff 40%,transparent);transform-origin:left;animation:k-scalex .9s cubic-bezier(.7,0,.2,1) .45s both}
.ff-w1-ln::after{content:'';position:absolute;top:-2px;left:0;width:60px;height:6px;border-radius:3px;background:radial-gradient(closest-side,#fff,transparent);animation:ff-dot 1.6s ease-in-out 1.2s both}
@keyframes ff-dot{from{transform:translateX(0);opacity:1}to{transform:translateX(520px);opacity:0}}
.ff-w1-n{font-size:56px;font-weight:300;letter-spacing:.02em;line-height:1.1;margin:10px 0 20px;white-space:nowrap}
.ff-w1-n .ch{display:inline-block;animation:k-rightf .6s cubic-bezier(.16,1,.3,1) calc(.7s + var(--i)*35ms) both;--x:24px}
.ff-w1-m{display:flex;gap:22px;align-items:stretch}
.ff-w1-m i{width:1px;background:rgba(150,205,255,.3)}
.ff-w1-m b{display:block;font-weight:400;font-size:17px;margin-top:4px}
.ff-w1-go{position:absolute;right:30px;bottom:24px;display:flex;align-items:center;gap:6px;font-size:14px;letter-spacing:.2em;color:#bfe6ff}
.ff-w1-go .i{width:18px;height:18px;animation:ff-nud 1.2s ease-in-out 2s infinite}
@keyframes ff-nud{50%{transform:translateX(5px)}}

/* W2 */
.ff-w2{position:absolute;inset:0}
.ff-bar{position:absolute;left:0;right:0;height:72px;background:#000;z-index:3}
.ff-bar.t{top:0;animation:ff-bt 1s cubic-bezier(.7,0,.2,1) both}.ff-bar.b{bottom:0;animation:ff-bb 1s cubic-bezier(.7,0,.2,1) both}
@keyframes ff-bt{from{transform:translateY(-100%)}}@keyframes ff-bb{from{transform:translateY(100%)}}
.ff-w2-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;animation:ff-push 10s ease-out both}
@keyframes ff-push{from{transform:scale(.95)}to{transform:scale(1.03)}}
.ff-w2-k{font-size:14px;letter-spacing:.6em;padding-left:.6em;color:#bcd9ee;animation:k-fadef 1.2s ease .6s both}
.ff-w2-nw{position:relative;margin:16px 0 18px}
.ff-w2-n{font-family:Cinzel,serif;font-weight:500;color:#f4f8ff;letter-spacing:.14em;padding-left:.14em;text-shadow:0 0 30px rgba(160,220,255,.45);animation:ff-nm 2.2s cubic-bezier(.2,.7,.1,1) .8s both;white-space:nowrap}
@keyframes ff-nm{from{letter-spacing:.7em;padding-left:.7em;opacity:0;filter:blur(12px)}}
.ff-w2-fl{position:absolute;left:50%;top:50%;width:980px;height:3px;margin:-1.5px 0 0 -490px;background:linear-gradient(90deg,transparent,rgba(120,210,255,.7) 30%,#fff 50%,rgba(120,210,255,.7) 70%,transparent);box-shadow:0 0 24px 6px rgba(100,200,255,.5);animation:ff-fl 1.8s ease 1.2s both;pointer-events:none}
@keyframes ff-fl{0%{transform:scaleX(0);opacity:0}35%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1.2) scaleY(.4);opacity:0}}
.ff-w2-s{font-family:Cinzel,serif;font-size:18px;letter-spacing:.2em;color:#a9c9df;animation:k-fadef 1.4s ease 2.4s both}

/* W3 */
.ff-w3-l{position:absolute;left:70px;top:210px}
.ff-w3-n{font-size:58px;font-weight:300;line-height:1.1;margin:10px 0 16px;white-space:nowrap}
.ff-w3-loc{display:flex;align-items:center;gap:8px;font-size:15px;color:#a9c9df}
.ff-w3-loc .i{width:16px;height:16px;color:#5cf2b8}
.ff-w3-m{position:absolute;right:70px;top:170px;width:300px;padding:14px 0;animation:k-rightf .7s cubic-bezier(.16,1,.3,1) .2s both;--x:60px}
.ff-w3-m .it{position:relative;height:52px;display:flex;align-items:center;padding-left:44px;font-size:20px;letter-spacing:.06em;color:#a9c9df;transition:color .25s;z-index:1}
.ff-w3-m .it.on{color:#fff;text-shadow:0 0 12px rgba(127,214,255,.8)}
.ff-w3-hl{position:absolute;left:0;right:0;height:52px;top:var(--y);background:linear-gradient(90deg,rgba(127,214,255,.38),rgba(127,214,255,.08) 70%,transparent);border-left:3px solid #bfe9ff;transition:top .28s cubic-bezier(.3,1.3,.5,1);animation:k-fadef .3s ease 1s both}
.ff-w3-hl::before{content:'';position:absolute;left:14px;top:50%;margin-top:-7px;border:7px solid transparent;border-left:11px solid #fff;filter:drop-shadow(0 0 6px #7fd6ff);animation:ff-nud 1s ease-in-out infinite}
.ff-w3-f{position:absolute;left:70px;right:70px;bottom:44px;display:flex;justify-content:flex-end;gap:26px;font-size:13px;color:#a9c9df;border-top:1px solid rgba(150,205,255,.25);padding-top:14px}
.ff-w3-f kbd{font:500 11px 'Jost',sans-serif;border:1px solid rgba(150,205,255,.5);padding:2px 7px;margin-right:6px;color:#fff}

/* W4 */
.ff-w4{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.ff-w4-ring{position:absolute;left:50%;top:50%;width:520px;height:520px;margin:-260px;border-radius:50%;border:1px solid rgba(92,242,184,.5);box-shadow:0 0 40px rgba(92,242,184,.35),inset 0 0 40px rgba(92,242,184,.25);animation:ff-ring 2.4s cubic-bezier(.2,.8,.2,1) 1s both}
@keyframes ff-ring{from{transform:scale(.2);opacity:1}to{transform:scale(1.25);opacity:0}}
.ff-w4-k{font-size:14px;letter-spacing:.5em;padding-left:.5em;color:#b8ffe6}
.ff-w4-n{font-family:Cinzel,serif;font-weight:500;color:#fff;text-shadow:0 0 18px rgba(92,242,184,.9),0 0 46px rgba(40,200,150,.6);margin:12px 0;white-space:nowrap}
.ff-w4-s{font-size:16px;letter-spacing:.14em;color:#cfeee4}

/* W5 */
.ff-w5{position:absolute;inset:0}
.ff-w5-sh{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,6,12,.85),rgba(2,6,12,.3) 70%,transparent);animation:k-fadef 1s ease both}
.ff-w5-num{position:absolute;left:120px;top:150px;font-size:200px;font-weight:200;line-height:1;color:transparent;-webkit-text-stroke:1.2px rgba(220,240,255,.85);animation:ff-num 1.2s cubic-bezier(.16,1,.3,1) .2s both}
@keyframes ff-num{from{transform:translateY(50px);opacity:0;filter:blur(8px)}}
.ff-w5-num::after{content:attr(data-n);position:absolute;left:0;top:0;color:rgba(127,214,255,.18);-webkit-text-stroke:0;clip-path:inset(100% 0 0 0);animation:ff-fill 1.2s ease 1.3s both}
@keyframes ff-fill{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}
.ff-w5-vl{position:absolute;left:400px;top:170px;width:1px;height:200px;background:linear-gradient(#bfe9ff,rgba(191,233,255,.2));transform-origin:top;animation:k-scaley .8s cubic-bezier(.7,0,.2,1) .7s both}
.ff-w5-tx{position:absolute;left:432px;top:186px}
.ff-w5-t{font-family:Cinzel,serif;font-size:52px;font-weight:400;line-height:1.15;margin:8px 0 14px}
.ff-w5-s{font-size:18px;color:#cfe4f3;letter-spacing:.04em}
.ff-w5-hl{position:absolute;left:120px;top:420px;width:680px;height:1px;background:linear-gradient(90deg,#bfe9ff,rgba(191,233,255,0));transform-origin:left;animation:k-scalex 1.1s cubic-bezier(.7,0,.2,1) 1.4s both}
.ff-w5-sub{position:absolute;left:120px;top:436px;font-size:13px;letter-spacing:.3em;color:#8fc8ec}

/* W6 */
.ff-w6{position:absolute;inset:0}
.ff-sl{position:absolute;left:50%;top:50%;width:1300px;height:4px;margin:-2px 0 0 -650px;background:linear-gradient(90deg,transparent,#bff4ff 20%,#fff 50%,#bff4ff 80%,transparent);box-shadow:0 0 18px 4px rgba(127,214,255,.8);animation:ff-sl .55s cubic-bezier(.7,0,.2,1) var(--d) both}
@keyframes ff-sl{0%{transform:rotate(var(--r)) scaleX(0);opacity:1}60%{transform:rotate(var(--r)) scaleX(1);opacity:1}100%{transform:rotate(var(--r)) scaleX(1) scaleY(.2);opacity:0}}
.ff-w6-fl{position:absolute;inset:0;background:#e9f9ff;opacity:0;animation:ff-wf .5s ease .62s both}
@keyframes ff-wf{0%{opacity:0}20%{opacity:.75}100%{opacity:0}}
.ff-w6-p{position:absolute;left:50%;top:50%;width:660px;height:180px;margin:-90px 0 0 -330px;transform:skewX(-16deg);background:linear-gradient(100deg,rgba(10,30,52,.95),rgba(18,52,86,.95) 50%,rgba(10,30,52,.95));border-top:2px solid #bfe9ff;border-bottom:2px solid #bfe9ff;box-shadow:0 0 30px rgba(127,214,255,.45),0 30px 60px rgba(0,0,0,.5);animation:ff-burst .6s cubic-bezier(.3,1.4,.5,1) .65s both}
@keyframes ff-burst{from{transform:skewX(-16deg) scaleX(0);opacity:0}}
.ff-w6-in{position:absolute;inset:0;transform:skewX(16deg);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.ff-w6-k{font-size:15px;font-weight:500;font-style:italic;letter-spacing:.5em;padding-left:.5em;color:#bfe9ff}
.ff-w6-n{font-weight:600;font-style:italic;text-transform:uppercase;letter-spacing:.04em;line-height:1.1;margin-top:6px;background:linear-gradient(180deg,#fff 40%,#9fdcff);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}
.ff-spk{position:absolute;left:480px;top:300px;width:46px;height:2px;margin-top:-1px;background:linear-gradient(90deg,#fff,rgba(127,214,255,0));transform-origin:0 50%;animation:ff-spk .8s cubic-bezier(.2,.8,.2,1) .66s both}
@keyframes ff-spk{from{transform:rotate(var(--a)) translateX(10px) scaleX(.3);opacity:1}to{transform:rotate(var(--a)) translateX(var(--l)) scaleX(1);opacity:0}}

/* W7 */
.ff-w7-c{position:absolute;left:280px;top:165px;width:400px;height:270px;border-radius:22px;background:linear-gradient(135deg,rgba(255,255,255,.15),rgba(255,255,255,.04));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.24);box-shadow:0 30px 70px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.3);z-index:5;padding:34px 36px;animation:ff-glass 1s cubic-bezier(.16,1,.3,1) .2s both}
@keyframes ff-glass{from{opacity:0;transform:scale(.92) translateY(20px);filter:blur(8px)}}
.ff-w7-n{font-size:46px;font-weight:300;line-height:1.1;margin:12px 0 18px;white-space:nowrap}
.ff-w7-d{height:1px;background:linear-gradient(90deg,rgba(255,255,255,.5),transparent);margin-bottom:16px}
.ff-w7-r{display:flex;gap:20px;font-size:14px;color:#cfe4f3}
.ff-w7-r b{display:block;font-size:20px;font-weight:400;color:#fff}
.ff-orb{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0,var(--c) 26%,var(--c2) 72%,#02100c 100%);box-shadow:0 0 18px var(--c),0 0 40px var(--c)}

/* W8 */
.ff-w8-t{position:absolute;left:60px;top:70px}
.ff-w8-n{font-size:54px;font-weight:300;line-height:1.1;margin-top:8px;white-space:nowrap}
.ff-w8-sw{height:2px;width:340px;margin-top:14px;background:linear-gradient(90deg,#7fd6ff,transparent);transform-origin:left;animation:k-scalex .9s cubic-bezier(.7,0,.2,1) .6s both}
.ff-w8-p{position:absolute;right:40px;bottom:46px;width:520px;padding:14px 20px 12px;animation:k-upf .7s cubic-bezier(.16,1,.3,1) .4s both;--y:40px}
.ff-w8-h,.ff-w8-r{display:grid;grid-template-columns:130px 150px 60px 1fr;align-items:center;gap:10px}
.ff-w8-h{font-size:11px;letter-spacing:.28em;color:#8fc8ec;padding-bottom:8px;border-bottom:1px solid rgba(150,205,255,.25)}
.ff-w8-r{height:46px;border-bottom:1px solid rgba(150,205,255,.12);font-size:16px}
.ff-w8-r:last-child{border-bottom:0}
.ff-w8-r .nm{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ff-w8-r .hp em{font-style:normal;font-size:20px}
.ff-w8-r .hp small{color:#8fc8ec;font-size:13px}
.ff-w8-r .mp{color:#bfe6ff}
.ff-atb{display:flex;gap:4px}
.ff-atb i{flex:1;height:8px;background:rgba(127,214,255,.15);border:1px solid rgba(127,214,255,.35);position:relative;overflow:hidden}
.ff-atb i::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#2b8fff,#7fd6ff);transform-origin:left;animation:k-scalex 1.1s linear var(--d) both;box-shadow:0 0 8px #7fd6ff}
.ff-w8-hint{position:absolute;left:60px;bottom:52px;font-size:12px;letter-spacing:.24em;color:#a9c9df;animation:k-fadef .6s ease 2.4s both,ff-blink 1.6s ease-in-out 3s infinite}
@keyframes ff-blink{50%{opacity:.3}}

/* W9 */
.ff-w9{position:absolute;inset:0}
.ff-w9-k{position:absolute;left:0;right:0;top:206px;text-align:center;font-size:12px;letter-spacing:.6em;padding-left:.6em;color:#8fc8ec}
.ff-w9-b{position:absolute;left:0;right:0;top:236px;height:128px;background:linear-gradient(90deg,rgba(8,24,40,0),rgba(14,42,70,.96) 14%,rgba(18,52,86,.96) 50%,rgba(14,42,70,.96) 86%,rgba(8,24,40,0));animation:ff-wipe .8s cubic-bezier(.7,0,.2,1) .2s both;overflow:hidden}
@keyframes ff-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.ff-w9-b::before,.ff-w9-b::after{content:'';position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#bfe9ff 20%,#bfe9ff 80%,transparent)}
.ff-w9-b::before{top:6px}.ff-w9-b::after{bottom:6px}
.ff-chev{position:absolute;top:22px;bottom:22px;width:170px;background:repeating-linear-gradient(-60deg,rgba(127,214,255,.0) 0 14px,rgba(127,214,255,.28) 14px 20px);background-size:46px 100%;animation:ff-chev 1.2s linear infinite}
.ff-chev.l{left:40px;-webkit-mask-image:linear-gradient(90deg,transparent,#000);mask-image:linear-gradient(90deg,transparent,#000)}
.ff-chev.r{right:40px;transform:scaleX(-1);-webkit-mask-image:linear-gradient(90deg,transparent,#000);mask-image:linear-gradient(90deg,transparent,#000)}
@keyframes ff-chev{to{background-position:46px 0}}
.ff-w9-tx{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:16px;white-space:nowrap;animation:k-blurf .8s cubic-bezier(.16,1,.3,1) .65s both;--sc:1.1}
.ff-w9-tx .a{font-size:30px;font-weight:300;letter-spacing:.24em;color:#cfe4f3}
.ff-w9-tx .b{font-weight:500;letter-spacing:.1em;color:#fff;text-shadow:0 0 18px rgba(127,214,255,.7)}
.ff-w9-s{position:absolute;left:0;right:0;top:384px;text-align:center;font-size:16px;color:#cfe4f3;letter-spacing:.08em}
.ff-w9-s b{color:#5cf2b8;font-weight:500}

/* W10 */
.ff-w10-em{position:absolute;left:130px;top:140px;width:320px;height:320px;overflow:visible}
.ff-w10-em .d{fill:none;stroke:#bfe9ff;stroke-width:1.4;stroke-dasharray:1;stroke-dashoffset:1;animation:k-draw var(--t,1s) cubic-bezier(.6,0,.3,1) var(--d) forwards;filter:drop-shadow(0 0 4px rgba(127,214,255,.8))}
.ff-w10-em .rot{animation:k-spin 30s linear 2.4s infinite}
.ff-w10-em .core{fill:#5cf2b8;filter:drop-shadow(0 0 10px #5cf2b8);animation:ff-core 1s ease 2.1s both}
@keyframes ff-core{from{opacity:0;transform:scale(0)}}
.ff-w10-em .fillp{fill:rgba(127,214,255,.07);stroke:none;animation:k-fadef 1s ease 2s both}
.ff-w10-tx{position:absolute;left:510px;top:220px}
.ff-w10-n{font-size:52px;font-weight:300;line-height:1.1;margin:10px 0 14px;white-space:nowrap}
.ff-w10-s{font-size:15px;color:#a9c9df;letter-spacing:.06em}
.ff-w10-s b{color:#5cf2b8;font-weight:500}

/* Login */
.ff-lg{position:absolute;inset:0;display:grid;place-items:center}
.ff-lg-box{width:400px;padding:30px 34px 24px;display:flex;flex-direction:column;gap:14px;animation:ff-skew .8s cubic-bezier(.16,1,.3,1) both}
.ff-lg-top{position:absolute;left:0;top:0;right:0;height:2px;background:linear-gradient(90deg,#d6f1ff,#7fd6ff 50%,transparent)}
.ff-lg-h{font-size:30px;font-weight:300;margin-top:-6px}
.ff-fld span{display:block;font-size:12px;letter-spacing:.24em;color:#8fc8ec;margin-bottom:4px;text-transform:uppercase}
.ff-fld .v{height:40px;border-bottom:1px solid rgba(150,205,255,.4);display:flex;align-items:center;font-size:17px;transition:border-color .2s,box-shadow .2s}
.ff-fld.focus .v{border-color:#bfe9ff;box-shadow:0 1px 0 #7fd6ff,0 8px 12px -10px rgba(127,214,255,.8)}
.ff-fld [data-p]{letter-spacing:.2em}
.ff-lg-btn{position:relative;margin-top:8px;height:48px;border:1px solid rgba(190,233,255,.7);background:linear-gradient(90deg,rgba(127,214,255,.35),rgba(127,214,255,.1));color:#fff;font:500 16px 'Jost',sans-serif;letter-spacing:.24em;display:flex;align-items:center;justify-content:center;gap:8px;clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);transition:transform .15s,filter .15s}
.ff-lg-btn .i{width:18px;height:18px}
.ff-lg-btn:disabled{cursor:default}
.ff-lg-btn.busy::after{content:'';position:absolute;left:0;bottom:0;height:2px;width:40%;background:#5cf2b8;box-shadow:0 0 8px #5cf2b8;animation:ff-load 1s ease-in-out infinite alternate}
@keyframes ff-load{from{transform:translateX(0)}to{transform:translateX(150%)}}
.ff-lg-st{font-size:13px;letter-spacing:.12em;color:#8fc8ec;text-align:center;min-height:18px}
.ff-lg-st[data-state=busy]{color:#bfe6ff}
.ff-lg-st[data-state=ok]{color:#5cf2b8}
.ff-lg-box.ok{border-color:rgba(92,242,184,.7);box-shadow:0 0 34px rgba(92,242,184,.45),0 24px 60px rgba(0,0,0,.55)}

/* Main page */
.ff-main{overflow:hidden}
.ff-m-bg{position:absolute;inset:0;background:linear-gradient(160deg,#0a1a2c 0%,#07111d 55%,#04090f 100%)}
.ff-m-sh{position:absolute;inset:-100px;background:repeating-linear-gradient(115deg,transparent 0 90px,rgba(127,214,255,.035) 90px 140px);animation:ff-shaft 18s linear infinite}
@keyframes ff-shaft{to{transform:translateX(160px)}}
.ff-m-glow{position:absolute;left:520px;top:300px;width:700px;height:500px;border-radius:50%;background:radial-gradient(closest-side,rgba(70,255,190,.16),transparent);filter:blur(10px)}
.ff-m-top{position:absolute;left:40px;right:40px;top:28px;display:flex;align-items:center;gap:22px;font-size:14px;color:#cfe4f3;letter-spacing:.08em;border-bottom:1px solid rgba(150,205,255,.22);padding-bottom:12px}
.ff-m-top .loc{display:flex;align-items:center;gap:8px;font-size:16px;color:#fff}
.ff-m-top .loc .i{width:16px;height:16px;color:#5cf2b8}
.ff-m-top .cr{margin-left:auto}
.ff-m-top b{font-weight:500;color:#fff}
.ff-m-party{position:absolute;left:40px;top:100px;display:flex;flex-direction:column;gap:12px}
.ff-pc{width:430px;height:104px;display:flex;align-items:center;gap:18px;padding:0 22px}
.ff-pc .av{flex:none;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;font-size:26px;font-weight:400;background:radial-gradient(circle at 35% 30%,#2b5f8c,#0d2238);border:1px solid rgba(190,233,255,.5);box-shadow:0 0 14px rgba(127,214,255,.3)}
.ff-pc .tx{flex:1}
.ff-pc .nm{font-size:19px}
.ff-pc .lv{font-size:12.5px;color:#8fc8ec;letter-spacing:.14em}
.ff-pc .bar{height:4px;background:rgba(127,214,255,.15);margin-top:8px}
.ff-pc .bar i{display:block;height:100%;background:linear-gradient(90deg,#5cf2b8,#b8ffe6)}
.ff-pc .hp{font-size:13px;color:#cfe4f3;margin-top:4px;display:flex;justify-content:space-between}
.ff-m-menu{position:absolute;right:40px;top:100px;width:280px;padding:10px 0}
.ff-m-menu div{height:48px;display:flex;align-items:center;padding-left:34px;font-size:18px;color:#a9c9df;letter-spacing:.04em}
.ff-m-menu div.on{color:#fff;background:linear-gradient(90deg,rgba(127,214,255,.3),transparent);border-left:3px solid #bfe9ff;padding-left:31px}
.ff-m-tk{position:absolute;left:40px;right:40px;bottom:26px;display:flex;align-items:center;gap:12px;font-size:13.5px;color:#cfe4f3;border-top:1px solid rgba(150,205,255,.22);padding-top:12px}
.ff-m-tk b{font-weight:500;font-size:11px;letter-spacing:.24em;color:#06121e;background:#5cf2b8;padding:3px 8px}

/* Transition FX */
.ff-burst{position:absolute;left:480px;top:300px;width:120px;height:120px;margin:-60px;border-radius:50%;background:radial-gradient(closest-side,#ffffff,#c8ffec 35%,#5cf2b8 60%,rgba(40,200,150,0))}
.ff-slash{position:absolute;left:480px;top:300px;width:1300px;height:5px;margin:-2.5px 0 0 -650px;background:linear-gradient(90deg,transparent,#bff4ff 20%,#fff 50%,#bff4ff 80%,transparent);box-shadow:0 0 22px 6px rgba(127,214,255,.85)}
.ff-load{position:absolute;right:44px;bottom:40px;width:300px;text-align:right}
.ff-load .k{font-size:13px;letter-spacing:.4em;color:#bfe6ff}
.ff-load .bar{height:3px;background:rgba(127,214,255,.18);margin-top:10px;overflow:hidden}
.ff-load .bar i{display:block;height:100%;background:linear-gradient(90deg,#7fd6ff,#5cf2b8);transform-origin:left;animation:k-scalex 2.6s cubic-bezier(.5,0,.5,1) both}
.ff-load .ch{display:inline-flex;gap:2px;margin-right:10px;vertical-align:-2px}
.ff-load .ch i{width:8px;height:12px;background:#7fd6ff;clip-path:polygon(0 0,40% 0,100% 50%,40% 100%,0 100%,60% 50%);animation:ff-chv 1s ease-in-out infinite;opacity:.2}
.ff-load .ch i:nth-child(2){animation-delay:.15s}.ff-load .ch i:nth-child(3){animation-delay:.3s}
@keyframes ff-chv{50%{opacity:1}}
.ff-dest{position:absolute;left:0;right:0;top:260px;text-align:center}
.ff-dest .k{font-size:12px;letter-spacing:.5em;padding-left:.5em;color:#8fc8ec}
.ff-dest .t{font-family:Cinzel,serif;font-size:40px;margin-top:10px;color:#fff;text-shadow:0 0 20px rgba(127,214,255,.5)}
.ff-hex{position:absolute;width:64px;height:74px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#7ff0d8,#2b8fff)}
.ff-hex i{position:absolute;inset:2px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#143a58,#081a2c)}
`);

function motes(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<span class="ff-mote" style="left:${rand(0, 100).toFixed(1)}%;--s:${rand(1.5, 3.5).toFixed(1)}px;--du:${rand(8, 16).toFixed(1)}s;--dl:-${rand(0, 16).toFixed(1)}s;--dx:${rand(-40, 40).toFixed(0)}px"></span>`;
  return s;
}
function city() {
  let far = '', near = '', lt = '', x = -10;
  while (x < 970) { const w = rand(26, 70), h = rand(110, 250); far += `<rect x="${x.toFixed(0)}" y="${(560 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 40).toFixed(0)}"/>`; x += w + rand(2, 10); }
  x = -10;
  while (x < 970) {
    const w = rand(30, 90), h = rand(50, 170);
    near += `<rect x="${x.toFixed(0)}" y="${(600 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>`;
    if (Math.random() < .3) near += `<rect x="${(x + w / 2).toFixed(0)}" y="${(600 - h - rand(14, 44)).toFixed(0)}" width="1.5" height="50"/>`;
    for (let k = 0, n = rand(2, 8) | 0; k < n; k++) lt += `<rect x="${(x + rand(4, w - 6)).toFixed(0)}" y="${(600 - h + rand(6, h - 10)).toFixed(0)}" width="2.5" height="2.5"/>`;
    x += w + rand(0, 6);
  }
  return `<svg class="ff-city" viewBox="0 0 960 600" preserveAspectRatio="none" aria-hidden="true"><g fill="#0d2232" opacity=".9">${far}</g><g fill="#040b13">${near}</g><g fill="#ffd690" opacity=".55">${lt}</g></svg>`;
}
function bg(vp) { return add(vp, `<div class="ff-bg"><div class="ff-haze"></div>${city()}<div class="ff-fog"></div>${motes(18)}<div class="ff-vig"></div></div>`); }

function mainPage(L, ctx) {
  const party = [[ctx.name, 48, '4,820'], ['Aria', 46, '3,960'], ['Dax', 47, '6,140']];
  return under(L, `<div class="layer ff-main"><div class="ff-m-bg"></div><div class="ff-m-sh"></div><div class="ff-m-glow"></div>
    <div class="ff-m-top a-fade" style="--d:.1s"><span class="loc">${ico.pin}Old Rail Yard</span><span>${G.clock()}</span><span class="cr">Credits <b>12,480</b></span><span>Playtime <b>214:36</b></span></div>
    <div class="ff-m-party">${party.map((p, i) => `<div class="ff-panel ff-cut ff-pc a-left" style="--d:${(.2 + i * .1).toFixed(1)}s;--x:-40px"><div class="av">${esc(G.initial(p[0]))}</div><div class="tx"><div class="nm">${esc(p[0])}</div><div class="lv">LV ${p[1]}</div><div class="bar"><i style="width:100%"></i></div><div class="hp"><span>HP</span><span>${p[2]} / ${p[2]}</span></div></div></div>`).join('')}</div>
    <div class="ff-panel ff-cut ff-m-menu a-right" style="--d:.3s;--x:40px">${['Items', 'Abilities', 'Equipment', 'Orbs', 'Config', 'Save'].map((t, i) => `<div class="${i ? '' : 'on'}">${t}</div>`).join('')}</div>
    <div class="ff-m-tk a-fade" style="--d:.5s"><b>NEWS</b>The night market in the Lower District reopens tonight.</div></div>`);
}

function login(L, ctx) {
  const root = add(L, `<div class="ff-lg"><div class="ff-panel ff-cut ff-lg-box"><div class="ff-lg-top"></div>
    <div class="ff-lbl">Sign in</div><div class="ff-lg-h">Welcome, traveller</div>
    <div class="ff-fld" data-f><span>User ID</span><div class="v"><b data-u></b></div></div>
    <div class="ff-fld" data-f><span>Password</span><div class="v"><b data-p></b></div></div>
    <button class="ff-lg-btn" data-btn>CONTINUE ${ico.chev}</button>
    <div class="ff-lg-st" data-status>Not signed in</div></div></div>`);
  return G.loginKit(root, ctx);
}

/* -------------------- 10 welcome windows -------------------- */
const WL = [
{
  title: 'Command Panel', tags: ['Bordered', 'Skew-in'],
  desc: 'A cut-corner navy panel skids in from the left and straightens up, a highlight runs along its top edge and the name slides in letter by letter.',
  build(L, ctx) {
    add(L, `<div class="center"><div class="ff-w1"><div class="ff-w1-st"></div>
      <div class="ff-panel ff-cut ff-w1-p"><div class="ff-w1-ln"></div>
        <div class="ff-lbl a-fade" style="--d:.6s">Welcome back</div>
        <div class="ff-w1-n" style="font-size:${G.fit(ctx.name, 56, 500, .5)}px">${split(ctx.name)}</div>
        <div class="ff-w1-m">
          <div class="a-up" style="--d:1.15s"><span class="ff-lbl">Last login</span><b>2 days ago</b></div><i class="a-fade" style="--d:1.2s"></i>
          <div class="a-up" style="--d:1.25s"><span class="ff-lbl">Playtime</span><b>214:36</b></div><i class="a-fade" style="--d:1.3s"></i>
          <div class="a-up" style="--d:1.35s"><span class="ff-lbl">Chapter</span><b>09</b></div></div>
        <div class="ff-w1-go a-fade" style="--d:1.8s">CONTINUE ${ico.chev}</div></div></div></div>`);
  },
},
{
  title: 'Cinematic Title', tags: ['Borderless', 'Letterbox'],
  desc: 'Letterbox bars close in like a cutscene, an anamorphic lens flare streaks across, and your name resolves in a serif title face out of a wide, blurred spread.',
  build(L, ctx) {
    add(L, `<div class="ff-w2"><div class="ff-bar t"></div><div class="ff-bar b"></div>
      <div class="ff-w2-c"><div class="ff-w2-k">WELCOME BACK</div>
        <div class="ff-w2-nw"><div class="ff-w2-fl"></div><div class="ff-w2-n" style="font-size:${G.fit(ctx.name.toUpperCase(), 72, 820, .9)}px">${esc(ctx.name.toUpperCase())}</div></div>
        <div class="ff-w2-s">Your story continues</div></div></div>`);
  },
},
{
  title: 'Menu Select', tags: ['Menu', 'Cursor'],
  desc: 'A command menu slides in on the right while the greeting settles on the left; the glowing cursor bar steps up the list and lands on Continue.',
  build(L, ctx) {
    const items = ['Continue', 'New Journey', 'Profile', 'Config'];
    const r = add(L, `<div class="layer">
      <div class="ff-w3-l"><div class="ff-lbl a-fade" style="--d:.3s">${G.greet()}</div>
        <div class="ff-w3-n a-left" style="--d:.45s;font-size:${G.fit(ctx.name, 58, 460, .5)}px">${esc(ctx.name)}</div>
        <div class="ff-w3-loc a-fade" style="--d:.8s">${ico.pin}Last save · Old Rail Yard · ${G.clock()}</div></div>
      <div class="ff-panel ff-cut ff-w3-m"><div class="ff-w3-hl" style="--y:${14 + 52 * 3}px"></div>
        ${items.map((t, i) => `<div class="it a-right" style="--d:${(.35 + i * .08).toFixed(2)}s;--x:30px">${t}</div>`).join('')}</div>
      <div class="ff-w3-f a-fade" style="--d:1.2s"><span><kbd>Enter</kbd>Select</span><span><kbd>Esc</kbd>Back</span></div></div>`);
    const hl = r.querySelector('.ff-w3-hl'), its = r.querySelectorAll('.it');
    (async () => {
      await ctx.wait(1250);
      for (let k = 2; k >= 0; k--) { hl.style.setProperty('--y', (14 + 52 * k) + 'px'); its.forEach((e, j) => e.classList.toggle('on', j === k)); await ctx.wait(280); }
    })();
  },
},
{
  title: 'Energy Stream', tags: ['Particles', 'Glow'],
  desc: 'Green-cyan energy flows across the screen in ribbons on canvas, a pulse ring expands and your name surfaces from the current with a green glow.',
  build(L, ctx) {
    const g = ctx.canvas(L);
    const P = Array.from({ length: 240 }, () => ({ x: rand(-100, 960), y: rand(0, 600), s: rand(.6, 1.8), h: rand(150, 192) }));
    ctx.raf((t, dt) => {
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (const p of P) {
        const a = Math.sin(p.y * .008 + t * .6) * .55 + Math.cos(p.x * .005 - t * .4) * .35 + (300 - p.y) * .0012;
        const v = 140 * p.s, x0 = p.x, y0 = p.y;
        p.x += Math.cos(a) * v * dt; p.y += Math.sin(a) * v * dt * .7;
        if (p.x > 980 || p.y < -20 || p.y > 620) { p.x = rand(-60, -10); p.y = rand(0, 600); continue; }
        g.strokeStyle = `hsla(${p.h},100%,62%,${(.55 * Math.min(1, t * .8)).toFixed(2)})`; g.lineWidth = p.s * 1.3;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(p.x, p.y); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    });
    add(L, `<div class="ff-w4"><div class="ff-w4-ring"></div>
      <div class="ff-w4-k a-fade" style="--d:.9s">WELCOME BACK</div>
      <div class="ff-w4-n a-blur" style="--d:1.1s;--t:1.4s;--b:16px;font-size:${G.fit(ctx.name, 68, 800, .78)}px">${esc(ctx.name)}</div>
      <div class="ff-w4-s a-fade" style="--d:1.9s">The current remembers you.</div></div>`);
  },
},
{
  title: 'Chapter Card', tags: ['Typographic', 'Editorial'],
  desc: 'A chapter-intro composition: an outlined numeral rises and fills, a hairline divider draws down, and the chapter title and greeting settle beside it.',
  build(L, ctx) {
    add(L, `<div class="ff-w5"><div class="ff-w5-sh"></div>
      <div class="ff-w5-num" data-n="01">01</div><div class="ff-w5-vl"></div>
      <div class="ff-w5-tx"><div class="ff-lbl a-fade" style="--d:.9s">Chapter</div>
        <div class="ff-w5-t a-left" style="--d:1s">Homecoming</div>
        <div class="ff-w5-s a-fade" style="--d:1.4s">Welcome back, <span class="ff-acc">${esc(ctx.name)}</span>.</div></div>
      <div class="ff-w5-hl"></div><div class="ff-w5-sub a-fade" style="--d:1.9s">LAST SAVE · OLD RAIL YARD</div></div>`);
  },
},
{
  title: 'Limit Slash', tags: ['Impact', 'Dynamic'],
  desc: 'Two blade slashes cross the screen in an X, a white impact flash and sparks burst out, and a slanted banner explodes open from the cut with the greeting.',
  build(L, ctx) {
    let sp = '';
    for (let i = 0; i < 20; i++) sp += `<i class="ff-spk" style="--a:${(i * 18 + rand(-6, 6)).toFixed(0)}deg;--l:${rand(140, 320).toFixed(0)}px"></i>`;
    add(L, `<div class="ff-w6"><i class="ff-sl" style="--r:-28deg;--d:.15s"></i><i class="ff-sl" style="--r:28deg;--d:.38s"></i><div class="ff-w6-fl"></div>${sp}
      <div class="ff-w6-p"><div class="ff-w6-in"><div class="ff-w6-k">WELCOME BACK</div><div class="ff-w6-n" style="font-size:${G.fit(ctx.name.toUpperCase(), 66, 560, .72)}px">${esc(ctx.name.toUpperCase())}</div></div></div></div>`);
    ctx.wait(650).then(() => G.shake(L, 380, 9));
  },
},
{
  title: 'Glass & Orbs', tags: ['Glass', '3D orbit'],
  desc: 'A frosted glass card blooms into focus while five glowing orbs spiral out and orbit it in 3D, passing in front of and behind the glass.',
  build(L, ctx) {
    add(L, `<div class="ff-w7-c"><div class="ff-lbl">Welcome back</div>
      <div class="ff-w7-n" style="font-size:${G.fit(ctx.name, 46, 330, .5)}px">${esc(ctx.name)}</div><div class="ff-w7-d"></div>
      <div class="ff-w7-r"><div>Level<b>48</b></div><div>Playtime<b>214 h</b></div><div>Orbs<b>5 linked</b></div></div></div>`);
    const C = [['#5cffb0', '#0f7a52'], ['#6cc8ff', '#1456a0'], ['#ff7a7a', '#8a1a24'], ['#ffe27a', '#9a7a10'], ['#c79bff', '#5a2aa0']];
    const orbs = C.map(c => add(L, `<i class="ff-orb" style="--c:${c[0]};--c2:${c[1]}"></i>`));
    ctx.raf(t => {
      const R = 1 - Math.pow(1 - Math.min(1, t / 1.4), 3);
      orbs.forEach((o, i) => {
        const a = i * 1.2566 + t * .7, s = Math.sin(a);
        const x = 480 + Math.cos(a) * 300 * R, y = 300 + s * 95 * R - Math.cos(a) * 18;
        o.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(.62 + .38 * (s + 1) / 2).toFixed(3)})`;
        o.style.zIndex = s > 0 ? 6 : 4; o.style.opacity = Math.min(1, t * 2);
      });
    });
  },
},
{
  title: 'Party HUD', tags: ['HUD', 'Battle-style'],
  desc: 'A battle-style party panel rises in the corner, HP counts up for each member and their charge gauges fill one segment at a time, while the greeting sweeps in top left.',
  build(L, ctx) {
    const pt = [[ctx.name, 4820, 312], ['Aria', 3960, 488], ['Dax', 6140, 154]];
    const r = add(L, `<div class="layer">
      <div class="ff-w8-t"><div class="ff-lbl a-fade" style="--d:.2s">Welcome back</div><div class="ff-w8-n a-left" style="--d:.3s;font-size:${G.fit(ctx.name, 54, 520, .5)}px">${esc(ctx.name)}</div><div class="ff-w8-sw"></div></div>
      <div class="ff-panel ff-cut ff-w8-p"><div class="ff-w8-h"><span>NAME</span><span>HP</span><span>MP</span><span>CHARGE</span></div>
        ${pt.map((p, i) => `<div class="ff-w8-r a-right" style="--d:${(.6 + i * .12).toFixed(2)}s"><span class="nm">${esc(p[0])}</span><span class="hp"><em data-v="${p[1]}">0</em><small> / ${p[1].toLocaleString('en-US')}</small></span><span class="mp">${p[2]}</span><span class="ff-atb"><i style="--d:${(1 + i * .25).toFixed(2)}s"></i><i style="--d:${(2.1 + i * .25).toFixed(2)}s"></i></span></div>`).join('')}</div>
      <div class="ff-w8-hint">PRESS ANY KEY TO CONTINUE</div></div>`);
    ctx.wait(800).then(() => r.querySelectorAll('[data-v]').forEach(e => ctx.count(e, 0, +e.dataset.v, 1300)));
  },
},
{
  title: 'Banner Ribbon', tags: ['Banner', 'Full-width'],
  desc: 'A full-width ribbon wipes across the middle of the screen with animated chevrons at each end, then the greeting slides in and an objective line appears beneath it.',
  build(L, ctx) {
    add(L, `<div class="ff-w9"><div class="ff-w9-k a-fade" style="--d:.6s">NOTICE</div>
      <div class="ff-w9-b"><div class="ff-chev l"></div><div class="ff-chev r"></div>
        <div class="ff-w9-tx"><span class="a">WELCOME BACK,</span><span class="b" style="font-size:${G.fit(ctx.name.toUpperCase(), 44, 380, .7)}px">${esc(ctx.name.toUpperCase())}</span></div></div>
      <div class="ff-w9-s a-up" style="--d:1.3s"><b>Objective updated</b> · Continue your journey</div></div>`);
  },
},
{
  title: 'Geometric Emblem', tags: ['Line art', 'Draw-on'],
  desc: 'Thin geometric lines draw themselves into an emblem, hexagon, diamond, circle and spokes, then the core lights up green and the greeting fades in beside it.',
  build(L, ctx) {
    const hex = (r, rot) => Array.from({ length: 6 }, (_, k) => { const a = (rot + k * 60) * Math.PI / 180; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');
    let sp = '';
    for (let k = 0; k < 6; k++) { const a = (k * 60 + 30) * Math.PI / 180; sp += `<line class="d" style="--d:${(1.2 + k * .06).toFixed(2)}s;--t:.5s" x1="${(Math.cos(a) * 92).toFixed(1)}" y1="${(Math.sin(a) * 92).toFixed(1)}" x2="${(Math.cos(a) * 128).toFixed(1)}" y2="${(Math.sin(a) * 128).toFixed(1)}" pathLength="1"/>`; }
    add(L, `<div class="layer"><svg class="ff-w10-em" viewBox="-160 -160 320 320" aria-hidden="true">
      <polygon class="fillp" points="${hex(150, -90)}"/>
      <polygon class="d" style="--d:.2s;--t:1.2s" points="${hex(150, -90)}" pathLength="1"/>
      <g class="rot"><polygon class="d" style="--d:.5s" points="${hex(128, -60)}" pathLength="1"/>${sp}</g>
      <circle class="d" style="--d:.8s" r="92" pathLength="1"/>
      <rect class="d" style="--d:1.1s" x="-52" y="-52" width="104" height="104" transform="rotate(45)" pathLength="1"/>
      <circle class="d" style="--d:1.4s;--t:.7s" r="30" pathLength="1"/>
      <circle class="core" r="11"/></svg>
      <div class="ff-w10-tx"><div class="ff-lbl a-fade" style="--d:1.6s">Welcome back</div>
        <div class="ff-w10-n a-left" style="--d:1.75s;font-size:${G.fit(ctx.name, 52, 400, .5)}px">${esc(ctx.name)}</div>
        <div class="ff-w10-s a-fade" style="--d:2.2s"><b>Sync complete</b> · All systems ready</div></div></div>`);
  },
},
];

/* -------------------- 5 login transitions -------------------- */
async function auth(ctx, lg, ms = 1700) {
  await lg.fill(); ctx.step(1);
  lg.status('Verifying…', 'busy'); lg.btn.classList.add('busy');
  await ctx.wait(ms);
  ctx.step(2); lg.btn.classList.remove('busy');
  lg.root.querySelector('.ff-lg-box').classList.add('ok'); lg.status('Signed in', 'ok');
}

function surge(parent, ctx) {
  const g = ctx.canvas(parent);
  const sp = p => { p.a = rand(0, 6.283); p.r = rand(420, 720); p.v = rand(.7, 1.3); p.s = rand(1, 2.6); p.h = rand(140, 190); return p; };
  const P = Array.from({ length: 320 }, () => sp({}));
  ctx.raf((t, dt) => {
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const p of P) {
      const r0 = p.r, a0 = p.a;
      p.r -= dt * (140 + (720 - p.r) * 1.5) * p.v * (1 + t * .6); p.a += dt * 1.3 * p.v;
      if (p.r < 24) { sp(p); continue; }
      g.strokeStyle = `hsla(${p.h},100%,64%,.85)`; g.lineWidth = p.s;
      g.beginPath(); g.moveTo(480 + Math.cos(a0) * r0, 300 + Math.sin(a0) * r0 * .7); g.lineTo(480 + Math.cos(p.a) * p.r, 300 + Math.sin(p.a) * p.r * .7); g.stroke();
    }
    const gr = g.createRadialGradient(480, 300, 0, 480, 300, 40 + t * 120);
    gr.addColorStop(0, `rgba(220,255,240,${Math.min(.9, t * .5)})`); gr.addColorStop(1, 'rgba(92,242,184,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  });
  return g;
}

function streaks(parent, ctx, dur) {
  const g = ctx.canvas(parent);
  g.fillStyle = '#03080f'; g.fillRect(0, 0, W, H);
  const P = Array.from({ length: 170 }, () => ({ x: rand(0, 1300), y: rand(0, 600), l: rand(40, 220), w: rand(.6, 2.4), c: G.pick(['#ffd690', '#7fd6ff', '#5cf2b8', '#ffffff', '#ff9f6b', '#7fd6ff']) }));
  ctx.raf((t, dt) => {
    const k = t < dur * .45 ? t / (dur * .45) : Math.max(0, (dur - t) / (dur * .55));
    const sp = 200 + 3600 * k * k;
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(3,8,15,.42)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const p of P) {
      p.x -= sp * dt;
      const len = p.l * (.2 + k * 2.4);
      if (p.x + len < 0) { p.x = 960 + rand(0, 300); p.y = rand(0, 600); }
      g.strokeStyle = p.c; g.globalAlpha = .55 + .45 * k; g.lineWidth = p.w;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + len, p.y); g.stroke();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  });
  return g;
}

function bokeh(parent, ctx) {
  const g = ctx.canvas(parent);
  const B = Array.from({ length: 28 }, () => ({ x: rand(0, 960), y: rand(0, 600), r: rand(18, 70), vx: rand(-14, 14), vy: rand(-12, -2), c: G.pick(['92,242,184', '127,214,255', '255,214,144', '127,214,255']) }));
  ctx.raf((t, dt) => {
    g.clearRect(0, 0, W, H);
    const a = .22 * Math.min(1, t * 1.4);
    for (const b of B) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      gr.addColorStop(0, `rgba(${b.c},${a * .6})`); gr.addColorStop(.82, `rgba(${b.c},${a})`); gr.addColorStop(1, `rgba(${b.c},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.283); g.fill();
    }
  });
  return g;
}

const TR = [
{
  title: 'Energy Surge', tags: ['Particles', 'Burst'],
  desc: 'On sign-in, streams of green energy spiral in from the edges toward the login card, gather into a bright core, then burst outward in a flood of light that clears to the main menu.',
  async run(L, ctx, lg) {
    await auth(ctx, lg, 1700);
    await ctx.wait(700);
    ctx.step(3);
    const fx = add(L, '<div class="layer" style="pointer-events:none"></div>');
    surge(fx, ctx);
    lg.root.animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'scale(.92)', filter: 'brightness(1.6)' }], { duration: 1500, easing: 'ease-in', fill: 'forwards' });
    await ctx.wait(1500);
    const b = add(L, '<div class="ff-burst"></div>');
    b.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(16)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards' });
    await ctx.wait(560);
    const fl = G.flash(L, '#e6fff6', 120);
    await ctx.wait(160);
    fx.remove(); b.remove(); lg.root.remove();
    mainPage(L, ctx); ctx.step(4);
    fl.out(1200);
    await ctx.wait(1300);
    ctx.step(5); G.welcomeOver(L, ctx, WL[3]);
    await ctx.wait(3000);
  },
},
{
  title: 'Cross Slash', tags: ['Slash', 'Split'],
  desc: 'A blade of light cuts diagonally across the whole screen, a flash hits, and the two halves of the login screen slide apart along the cut to reveal the main menu.',
  async run(L, ctx, lg) {
    await auth(ctx, lg, 1600);
    await ctx.wait(700);
    ctx.step(3);
    const ang = Math.atan2(600, 360) * 180 / Math.PI;
    const s = add(L, `<div class="ff-slash" style="transform:rotate(${ang}deg)"></div>`);
    s.animate([{ transform: `rotate(${ang}deg) scaleX(0)` }, { transform: `rotate(${ang}deg) scaleX(1)` }], { duration: 260, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
    await ctx.wait(260);
    mainPage(L, ctx);
    const pc = G.pieces(L, [ctx.bgEl, lg.root], [[[0, 0], [300, 0], [660, 600], [0, 600]], [[300, 0], [960, 0], [960, 600], [660, 600]]]);
    L.appendChild(s);
    const f = G.flash(L, 'rgba(230,248,255,.85)', 70); f.out(450);
    G.shake(pc.wrap, 300, 6);
    s.animate([{ opacity: 1 }, { opacity: 0, transform: `rotate(${ang}deg) scaleX(1.1) scaleY(.2)` }], { duration: 500, fill: 'forwards' });
    await ctx.wait(220);
    const n = [600 / 699.7, -360 / 699.7];
    pc.list[0].el.animate([{ transform: 'none' }, { transform: `translate(${(-n[0] * 620).toFixed(0)}px,${(-n[1] * 620 + 40).toFixed(0)}px) rotate(-6deg)` }], { duration: 1000, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' });
    pc.list[1].el.animate([{ transform: 'none' }, { transform: `translate(${(n[0] * 620).toFixed(0)}px,${(n[1] * 620 - 40).toFixed(0)}px) rotate(6deg)` }], { duration: 1000, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' });
    await ctx.wait(800); ctx.step(4);
    await ctx.wait(500); pc.wrap.remove(); s.remove();
    ctx.step(5); G.welcomeOver(L, ctx, WL[0]);
    await ctx.wait(3000);
  },
},
{
  title: 'Rail Transit', tags: ['Motion blur', 'Loading'],
  desc: 'The login card whips off to the left with motion blur, city lights streak past like a night train while a NOW LOADING gauge fills, then the main menu slides in as you pull in.',
  async run(L, ctx, lg) {
    await auth(ctx, lg, 1600);
    await ctx.wait(700);
    ctx.step(3);
    lg.root.animate([{ transform: 'none', filter: 'blur(0)', opacity: 1 }, { transform: 'translateX(-700px)', filter: 'blur(10px)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' });
    ctx.bgEl.animate([{ transform: 'none', filter: 'blur(0)' }, { transform: 'translateX(-160px)', filter: 'blur(6px)' }], { duration: 600, easing: 'ease-in', fill: 'forwards' });
    await ctx.wait(380);
    const tr = add(L, '<div class="layer"></div>');
    tr.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'forwards' });
    streaks(tr, ctx, 2.9);
    add(tr, `<div class="ff-dest a-blur" style="--d:.3s"><div class="k">NEXT STOP</div><div class="t">Main Menu</div></div>
      <div class="ff-load a-fade" style="--d:.1s"><div class="k"><span class="ch"><i></i><i></i><i></i></span>NOW LOADING</div><div class="bar"><i></i></div></div>`);
    await ctx.wait(2500);
    const m = add(L, '<div class="layer"></div>');
    mainPage(m, ctx); ctx.step(4);
    m.animate([{ transform: 'translateX(520px)', filter: 'blur(12px)', opacity: 0 }, { transform: 'none', filter: 'blur(0)', opacity: 1 }], { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
    await ctx.wait(800); tr.remove(); lg.root.remove();
    await ctx.wait(500);
    ctx.step(5); G.welcomeOver(L, ctx, WL[8]);
    await ctx.wait(3000);
  },
},
{
  title: 'Depth Focus', tags: ['Rack focus', 'Bokeh'],
  desc: 'A camera rack-focus: the login drifts back and goes soft into floating bokeh, then the main menu pulls forward out of the blur into sharp focus, and the cinematic title rolls.',
  async run(L, ctx, lg) {
    await auth(ctx, lg, 1600);
    await ctx.wait(700);
    ctx.step(3);
    const bk = add(L, '<div class="layer" style="pointer-events:none"></div>');
    bokeh(bk, ctx);
    lg.root.animate([{ transform: 'none', filter: 'blur(0)', opacity: 1 }, { transform: 'scale(.8)', filter: 'blur(14px)', opacity: 0 }], { duration: 1300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    ctx.bgEl.animate([{ filter: 'blur(0)', transform: 'none' }, { filter: 'blur(12px)', transform: 'scale(.92)' }], { duration: 1300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    await ctx.wait(1000);
    const m = add(L, '<div class="layer"></div>');
    const mp = mainPage(m, ctx);
    L.appendChild(bk);
    m.animate([{ transform: 'scale(1.2)', filter: 'blur(18px)', opacity: 0 }, { transform: 'none', filter: 'blur(0)', opacity: 1 }], { duration: 1300, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
    bk.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1600, delay: 400, fill: 'forwards' });
    await ctx.wait(900); ctx.step(4);
    await ctx.wait(1000); lg.root.remove(); bk.remove();
    mp.querySelectorAll('.ff-m-party,.ff-m-menu').forEach(e => e.animate([{ opacity: 1 }, { opacity: .12 }], { duration: 900, fill: 'forwards' }));
    ctx.step(5); G.welcomeOver(L, ctx, WL[1]);
    await ctx.wait(3500);
  },
},
{
  title: 'Hex Dissolve', tags: ['Tiles', 'Flip'],
  desc: 'Hexagonal tiles flip in from the centre outward until they cover the login, then flip away in a wave to uncover the main menu, where glowing orbs orbit the welcome card.',
  async run(L, ctx, lg) {
    await auth(ctx, lg, 1600);
    await ctx.wait(700);
    ctx.step(3);
    const wrap = add(L, '<div class="layer" style="perspective:900px;pointer-events:none"></div>');
    const tiles = [];
    for (let r = -1; r < 12; r++) for (let c = -1; c < 16; c++) {
      const x = c * 64 + (r % 2 ? 32 : 0), y = r * 55.5, d = Math.hypot(x - 480, y - 300);
      const e = add(wrap, `<div class="ff-hex" style="left:${(x - 32).toFixed(0)}px;top:${(y - 37).toFixed(0)}px"><i></i></div>`);
      e.style.opacity = '0'; tiles.push([e, d]);
    }
    tiles.forEach(([e, d]) => e.animate([{ transform: 'rotateY(90deg) scale(.5)', opacity: 0, filter: 'brightness(2)' }, { transform: 'none', opacity: 1, filter: 'brightness(1)' }], { duration: 380, delay: d * 1.05, easing: 'ease-out', fill: 'forwards' }));
    await ctx.wait(1100);
    lg.root.remove();
    mainPage(L, ctx); ctx.step(4);
    tiles.forEach(([e, d]) => e.animate([{ transform: 'none', opacity: 1 }, { transform: 'rotateY(-90deg) scale(.5)', opacity: 0 }], { duration: 380, delay: 100 + d * 1.05, easing: 'ease-in', fill: 'forwards' }));
    await ctx.wait(1200); wrap.remove();
    ctx.step(5); G.welcomeOver(L, ctx, WL[6]);
    await ctx.wait(3000);
  },
},
];

G.theme({
  key: 'ff', title: 'Final Fantasy VII Remake', sub: 'Navy glass · cyan · energy green',
  accent: '#5ce6c0', swatch: ['#0e2440', '#7fd6ff', '#5cf2b8'],
  blurbW: 'Modern JRPG menus: cut-corner navy glass panels, thin cyan highlights, cinematic serif titles and green energy over a night-time industrial city.',
  blurbT: 'From the sign-in card to the main menu: energy surge, cross slash, rail transit, depth-of-field focus pull and a hex-tile dissolve.',
  bg, login, main: mainPage, welcomes: WL, transitions: TR,
});
})();


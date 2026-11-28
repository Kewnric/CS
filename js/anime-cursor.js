/* Extracted verbatim from Cursor/Four Realms Cursors.html (<script id="engine">) by Ultima. */
/*!
 * anime-cursor.js v1.0.0 — four animated, game-inspired custom cursors. No dependencies.
 *
 *   skyblade    virtual-world duelist: crystal blade, shard trail, slash combos, lock-on brackets
 *   gatebreaker shadow hunter: violet smoke, afterimages, rift portal, EXP and level-up windows
 *   reactor     green energy core: charge ring, hold to charge, full-charge blast
 *   elementa    seven elements: stardust trail, each click casts the next element, fast pairs combine
 *
 * Quick start   <script src="anime-cursor.js" data-theme="skyblade" defer><\/script>
 * JS API        const cursor = AnimeCursor.init({ theme: 'reactor', size: 1, density: 1 });
 *               cursor.setTheme('elementa'); cursor.setSize(1.2); cursor.setDensity(0.6); cursor.destroy();
 * Per section   <section data-cursor-theme="gatebreaker"> ... </section>
 * Native zone   <div data-cursor-off> ... </div>   (system cursor inside, no effects)
 * Custom hover  <div data-cursor-hover> ... </div> (gets the hover frame like a button)
 *
 * Original artwork drawn in code. MIT licence.
 */
(function (root) {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  /* ---------- helpers ---------- */
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeBack = (t) => { const c = 1.9, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  const FONT = "'Chakra Petch','Rajdhani','Segoe UI',system-ui,-apple-system,sans-serif";

  const rgbCache = new Map();
  function rgb(hex) {
    let v = rgbCache.get(hex);
    if (!v) {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h.replace(/./g, (c) => c + c);
      const n = parseInt(h, 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache.set(hex, v);
    }
    return v;
  }
  const rgba = (hex, a) => { const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  const glowCache = new Map();
  function glowTex(hex) {
    let c = glowCache.get(hex);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(hex, 1));
    gr.addColorStop(0.2, rgba(hex, 0.7));
    gr.addColorStop(0.5, rgba(hex, 0.2));
    gr.addColorStop(1, rgba(hex, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    glowCache.set(hex, c);
    return c;
  }
  // soft glow; multiplies with the current globalAlpha
  function blob(ctx, hex, x, y, r, a) {
    if (!(a > 0) || !(r > 0)) return;
    const g0 = ctx.globalAlpha;
    ctx.globalAlpha = g0 * Math.min(1, a);
    ctx.drawImage(glowTex(hex), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = g0;
  }
  function at(ctx, e, x, y, rot, s) {
    const d = e.dpr, k = (s == null ? 1 : s) * d, c = Math.cos(rot || 0) * k, sn = Math.sin(rot || 0) * k;
    ctx.setTransform(c, sn, -sn, c, x * d, y * d);
  }
  const home = (ctx, e) => ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
  function poly(ctx, n, r, rot, radii) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (rot || 0) + (i * TAU) / n, rr = radii ? r * radii[i] : r;
      if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function star4(ctx, r, inner) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 - Math.PI / 2, rr = i % 2 ? r * inner : r;
      if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // crescent that is thin at the tail (a0) and thick near the head (a1)
  function taperArc(ctx, R, a0, a1, w) {
    const n = 22;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = lerp(a0, a1, u), hw = (Math.sin(Math.PI * Math.pow(u, 2.2)) * w) / 2;
      const px = Math.cos(a) * (R + hw), py = Math.sin(a) * (R + hw);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    for (let i = n; i >= 0; i--) {
      const u = i / n, a = lerp(a0, a1, u), hw = (Math.sin(Math.PI * Math.pow(u, 2.2)) * w) / 2;
      ctx.lineTo(Math.cos(a) * (R - hw), Math.sin(a) * (R - hw));
    }
    ctx.closePath();
  }
  function ribbon(ctx, e, col, w, maxAge, core) {
    const h = e.hist;
    if (h.length < 3) return;
    ctx.lineCap = 'round';
    for (let i = 1; i < h.length; i++) {
      const a = h[i - 1], b = h[i], age = e.t - b.t;
      if (age > maxAge) continue;
      const k = 1 - age / maxAge;
      ctx.globalAlpha = k * 0.85 * e.vis;
      ctx.strokeStyle = col;
      ctx.lineWidth = w * k * e.size;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (core) { ctx.strokeStyle = core; ctx.lineWidth = w * k * 0.35 * e.size; ctx.stroke(); }
    }
  }
  function caret(ctx, e, col) {
    at(ctx, e, e.x, e.y, 0, e.size * (0.92 + 0.08 * e.sc));
    ctx.beginPath();
    ctx.moveTo(-3.5, -11); ctx.quadraticCurveTo(0, -11, 0, -8);
    ctx.moveTo(3.5, -11); ctx.quadraticCurveTo(0, -11, 0, -8);
    ctx.lineTo(0, 8);
    ctx.quadraticCurveTo(0, 11, -3.5, 11);
    ctx.moveTo(0, 8); ctx.quadraticCurveTo(0, 11, 3.5, 11);
    ctx.lineCap = 'round';
    ctx.globalAlpha = e.vis;
    ctx.lineWidth = 3.6; ctx.strokeStyle = 'rgba(5,8,18,.7)'; ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8 * e.dpr; ctx.stroke();
    ctx.shadowBlur = 0;
  }
  function wobble(p, dt, t, e) { p.x += Math.sin(e.t * 6 + p.ph) * 12 * dt; }
  function orbit(p, dt, t) {
    p.rad += p.vrad * dt; p.ang += p.vang * dt * (1 - t);
    p.x = p.cx + Math.cos(p.ang) * p.rad; p.y = p.cy + Math.sin(p.ang) * p.rad;
  }

  /* ---------- shared particle painters ---------- */
  const D = {
    dot(ctx, p, t) {
      const r = p.size * (p.grow ? 1 + t * p.grow : 1 - t * 0.55);
      const a = (p.a == null ? 1 : p.a) * (1 - t);
      blob(ctx, p.c, p.x, p.y, r * 2.2, a);
      if (p.core) blob(ctx, '#ffffff', p.x, p.y, r * 0.9, a);
    },
    ember(ctx, p, t) {
      const f = 0.65 + 0.35 * Math.sin(p.age * 38 + p.ph);
      D.dot(ctx, p, t);
      blob(ctx, p.c2 || '#fff1c1', p.x, p.y, p.size * 0.9 * (1 - t), f * (1 - t));
    },
    shard(ctx, p, t, e) {
      at(ctx, e, p.x, p.y, p.rot, 1);
      poly(ctx, p.n, p.size * (1 - t * 0.45), 0, p.radii);
      ctx.globalAlpha = Math.pow(1 - t, 1.3);
      ctx.fillStyle = p.c; ctx.fill();
      if (p.stroke) { ctx.lineWidth = 0.8; ctx.strokeStyle = p.stroke; ctx.stroke(); }
    },
    ring(ctx, p, t) {
      const r = lerp(p.r0, p.r1, easeOut(t));
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.globalAlpha = (1 - t) * (p.a == null ? 1 : p.a);
      ctx.lineWidth = p.w * (1 - t) + 0.5; ctx.strokeStyle = p.c; ctx.stroke();
    },
    polyRing(ctx, p, t, e) {
      const r = lerp(p.r0, p.r1, easeOut(t));
      at(ctx, e, p.x, p.y, p.rot + t * (p.spin || 1.2), 1);
      poly(ctx, p.n, r);
      ctx.globalAlpha = 1 - t; ctx.lineWidth = p.w * (1 - t) + 0.5; ctx.strokeStyle = p.c; ctx.stroke();
    },
    flash(ctx, p, t) {
      blob(ctx, p.c, p.x, p.y, p.size * (0.6 + t * 0.8), (1 - t) * (p.a == null ? 0.9 : p.a));
      blob(ctx, '#ffffff', p.x, p.y, p.size * 0.4 * (1 - t), 1 - t);
    },
    pop(ctx, p, t, e) {
      const a = t < 0.12 ? t / 0.12 : t > 0.7 ? (1 - t) / 0.3 : 1;
      const s = t < 0.12 ? 0.5 + 0.5 * easeBack(t / 0.12) : 1;
      at(ctx, e, p.x, p.y - easeOut(t) * (p.rise || 20), 0, s);
      ctx.font = (p.weight || 700) + ' ' + p.fs + 'px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.globalAlpha = a;
      ctx.lineWidth = 3.5; ctx.strokeStyle = p.outline || 'rgba(6,8,20,.75)'; ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.c; ctx.fillText(p.text, 0, 0);
    },
    screen(ctx, p, t, e) {
      ctx.globalAlpha = (1 - t) * p.a; ctx.fillStyle = p.c; ctx.fillRect(0, 0, e.w, e.h);
    },
  };

  const THEMES = {};

  /* =====================================================================
     SKYBLADE — crystal one-handed sword, shard trail, slash combos
     ===================================================================== */
  const SKY = { c: '#4fd8ff', c2: '#bdf2ff', ink: '#082435' };
  function skySword(ctx, e) {
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(6, -2.4); ctx.lineTo(24.5, -2.6); ctx.lineTo(24.5, 2.6); ctx.lineTo(6, 2.4); ctx.closePath();
    const g = ctx.createLinearGradient(0, -2.6, 0, 2.6);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#dff7ff'); g.addColorStop(1, '#8fdcf3');
    ctx.shadowColor = rgba(SKY.c, 0.95); ctx.shadowBlur = 12 * e.dpr;
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = 0.9; ctx.strokeStyle = SKY.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7.5, 0); ctx.lineTo(21.5, 0); ctx.lineWidth = 0.8; ctx.strokeStyle = SKY.c; ctx.stroke();
    // swept guard
    ctx.beginPath();
    ctx.moveTo(22.6, -7.4); ctx.lineTo(25.4, -8.2); ctx.lineTo(26.6, -6); ctx.lineTo(26.6, 6); ctx.lineTo(25.4, 8.2); ctx.lineTo(22.6, 7.4); ctx.lineTo(24, 0); ctx.closePath();
    ctx.fillStyle = '#eaf6fc'; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = SKY.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25.4, -1.8); ctx.lineTo(26.4, 0); ctx.lineTo(25.4, 1.8); ctx.lineTo(24.4, 0); ctx.closePath();
    ctx.fillStyle = SKY.c; ctx.fill();
    // grip
    ctx.beginPath(); ctx.rect(26.6, -1.7, 7.4, 3.4); ctx.fillStyle = '#1d3a50'; ctx.fill(); ctx.strokeStyle = SKY.ink; ctx.stroke();
    ctx.beginPath();
    for (let x = 28; x < 34; x += 1.8) { ctx.moveTo(x, -1.7); ctx.lineTo(x + 1, 1.7); }
    ctx.strokeStyle = '#5a8aa8'; ctx.lineWidth = 0.6; ctx.stroke();
    // pommel gem
    blob(ctx, SKY.c, 36, 0, 6, 0.8);
    ctx.beginPath(); ctx.arc(36, 0, 2.3, 0, TAU); ctx.fillStyle = SKY.c; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = SKY.ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(35.3, -0.7, 0.7, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  function skySlash(ctx, p, t, e) {
    at(ctx, e, p.x, p.y, p.rot, 1);
    const a0 = -p.span / 2;
    const head = a0 + p.span * easeOut(Math.min(1, t * 2.6));
    const tail = a0 + p.span * Math.max(0, (t - 0.2) / 0.8) * 0.95;
    const fade = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
    if (head - tail < 0.02) return;
    const R = p.R * (1 + t * 0.12);
    ctx.globalAlpha = fade * 0.55; ctx.fillStyle = p.c; taperArc(ctx, R, tail, head, p.w * 2.1); ctx.fill();
    ctx.globalAlpha = fade; ctx.shadowColor = p.c; ctx.shadowBlur = 12 * e.dpr;
    ctx.fillStyle = '#ffffff'; taperArc(ctx, R, tail, head, p.w); ctx.fill();
    ctx.shadowBlur = 0;
  }
  THEMES.skyblade = {
    label: 'Skyblade', color: SKY.c, base: 1.0, hoverTilt: -0.34, swing: -18, mid: [18, 0],
    init: () => ({ combo: 0, last: -9 }),
    sprite: skySword,
    under(ctx, e) { ribbon(ctx, e, SKY.c, 3.4, 0.16, '#ffffff'); },
    trail(e, x0, y0, x1, y1, d) {
      const back = Math.atan2(y0 - y1, x0 - x1);
      e.along(x0, y0, x1, y1, d, 9, (x, y) => {
        const a = back + rnd(-0.9, 0.9), sp = rnd(20, 80);
        e.spawn({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.4, life: rnd(0.45, 0.9), size: rnd(1.8, 4.2) * e.size, n: Math.random() < 0.7 ? 3 : 4, rot: rnd(0, TAU), vr: rnd(-7, 7), c: pick([SKY.c, SKY.c2, '#ffffff']), stroke: 'rgba(8,36,53,.45)', draw: D.shard });
      });
    },
    follower(ctx, e) {
      const r = 17 * e.ringS * e.size, x = e.fx, y = e.fy, a0 = e.t * 1.5, fade = e.vis * (1 - 0.65 * e.frK);
      ctx.globalAlpha = 0.35 * fade; ctx.lineWidth = 1; ctx.strokeStyle = SKY.c;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.95 * fade; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const a = a0 + (k * TAU) / 3; ctx.beginPath(); ctx.arc(x, y, r, a, a + 0.62); ctx.stroke(); }
      ctx.lineWidth = 1; ctx.globalAlpha = 0.6 * fade;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = -a0 * 0.6 + (k * TAU) / 4;
        ctx.moveTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3));
        ctx.lineTo(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7));
      }
      ctx.stroke();
    },
    frame(ctx, e, r, k) {
      const p = Math.sin(e.t * 6) * 1.3 * k, L = Math.min(12, r.w / 3, r.h / 2.2);
      const x0 = r.x - p, y0 = r.y - p, x1 = r.x + r.w + p, y1 = r.y + r.h + p;
      ctx.globalAlpha = 0.1 * k; ctx.fillStyle = SKY.c; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = k; ctx.strokeStyle = SKY.c; ctx.lineWidth = 2; ctx.lineCap = 'square';
      ctx.shadowColor = SKY.c; ctx.shadowBlur = 8 * e.dpr;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
      ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
      ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1);
      ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L);
      ctx.stroke(); ctx.shadowBlur = 0;
    },
    click(e, x, y, st) {
      st.combo = e.t - st.last < 0.7 ? st.combo + 1 : 1;
      st.last = e.t;
      const s = e.size, o = rnd(-2.5, -1.9) + (st.combo % 2 === 0 ? Math.PI * 0.9 : 0);
      e.spawn({ x, y, rot: o, R: 40 * s, span: 2.5, w: 7 * s, life: 0.42, c: SKY.c, draw: skySlash });
      if (st.combo >= 3) e.spawn({ x, y, rot: o + Math.PI / 2, R: 33 * s, span: 2.4, w: 6 * s, life: 0.42, delay: 0.06, c: SKY.c, draw: skySlash });
      const n = Math.round(16 * e.mult);
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), sp = rnd(120, 420);
        e.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 4.2, life: rnd(0.5, 1), size: rnd(2.5, 6) * s, n: Math.random() < 0.6 ? 3 : 4, rot: rnd(0, TAU), vr: rnd(-12, 12), c: pick([SKY.c, SKY.c2, '#ffffff']), stroke: 'rgba(8,36,53,.45)', draw: D.shard });
      }
      e.spawn({ x, y, r0: 5, r1: 46 * s, w: 2.4, n: 6, rot: rnd(0, TAU), c: SKY.c, life: 0.5, draw: D.polyRing });
      e.spawn({ x, y, size: 26 * s, c: SKY.c, life: 0.24, draw: D.flash });
      if (st.combo >= 2) e.spawn({ x: x + 24 * s, y: y - 30 * s, tag: 'combo', text: st.combo + ' hits', fs: st.combo >= 5 ? 17 : 14, c: '#ffffff', outline: rgba(SKY.ink, 0.85), rise: 18, life: 0.8, draw: D.pop });
    },
  };

  /* =====================================================================
     GATEBREAKER — obsidian dagger, shadow smoke, rift portal, EXP windows
     ===================================================================== */
  const GB = { v: '#a35cff', v2: '#6d28d9', v3: '#d8b4fe', ink: '#0c0616', sys: '#4cc3ff', sys2: '#d4f1ff' };
  function gbDaggerPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -6, 20.5, -3.5); ctx.lineTo(20.5, 3.5); ctx.quadraticCurveTo(9, 3.4, 0, 0);
    ctx.closePath();
  }
  function gbDagger(ctx, e) {
    ctx.lineJoin = 'round';
    blob(ctx, GB.v, 14, 0, 26, 0.32);
    gbDaggerPath(ctx);
    const g = ctx.createLinearGradient(0, -5, 0, 4);
    g.addColorStop(0, '#4a2b7a'); g.addColorStop(0.5, '#1d0f33'); g.addColorStop(1, '#0a0513');
    ctx.shadowColor = GB.v; ctx.shadowBlur = 12 * e.dpr; ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 1; ctx.strokeStyle = GB.v; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1.6, -0.5); ctx.quadraticCurveTo(9, -4.6, 18, -2.7); ctx.lineWidth = 0.7; ctx.strokeStyle = GB.v3; ctx.stroke();
    // winged guard
    ctx.beginPath();
    ctx.moveTo(18, -7.6); ctx.lineTo(21.6, -3.2); ctx.lineTo(21.6, 3.2); ctx.lineTo(18, 7.6); ctx.lineTo(19.8, 0); ctx.closePath();
    ctx.fillStyle = '#160b28'; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = GB.v; ctx.stroke();
    // wrapped grip
    ctx.beginPath(); ctx.rect(21.6, -1.6, 6.6, 3.2); ctx.fillStyle = GB.ink; ctx.fill(); ctx.strokeStyle = '#3b2363'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath();
    for (let x = 22.6; x < 28; x += 1.6) { ctx.moveTo(x, 1.6); ctx.lineTo(x + 1, -1.6); }
    ctx.strokeStyle = GB.v2; ctx.lineWidth = 0.6; ctx.stroke();
    // ring pommel
    ctx.beginPath(); ctx.arc(30.6, 0, 2.5, 0, TAU); ctx.lineWidth = 1.4; ctx.strokeStyle = GB.v; ctx.stroke();
    blob(ctx, GB.sys, 30.6, 0, 4, 0.9);
  }
  function gbGhost(ctx, p, t, e) {
    at(ctx, e, p.x, p.y, p.rot, p.s);
    gbDaggerPath(ctx);
    ctx.globalAlpha = (1 - t) * 0.5; ctx.fillStyle = GB.v; ctx.fill();
    ctx.beginPath(); ctx.rect(20, -1.6, 9, 3.2); ctx.fill();
  }
  function gbSmoke(ctx, p, t) {
    blob(ctx, p.c, p.x, p.y, p.size * (1 + t * 1.5), p.a * (1 - t) * Math.min(1, t / 0.15));
  }
  function gbWisp(ctx, p, t) {
    const f = 0.75 + 0.25 * Math.sin(p.age * 30 + p.ph);
    blob(ctx, p.c, p.x, p.y, p.size * 2 * (1 - t * 0.7), (1 - t) * f);
    if (p.core) blob(ctx, '#ffffff', p.x, p.y, p.size * 0.7 * (1 - t), (1 - t) * 0.8);
  }
  function gbRift(ctx, p, t, e) {
    const op = t < 0.22 ? easeBack(t / 0.22) : t > 0.72 ? 1 - easeOut((t - 0.72) / 0.28) : 1;
    const w = 48 * op * p.s, h = w * 0.3;
    if (w < 0.5) return;
    blob(ctx, GB.v, p.x, p.y, w * 1.5, 0.45 * op);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, w, h, 0, 0, TAU);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, w);
    g.addColorStop(0, 'rgba(3,0,10,.97)'); g.addColorStop(0.6, 'rgba(24,6,52,.92)'); g.addColorStop(1, rgba(GB.v, 0.75));
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = GB.v; ctx.shadowBlur = 14 * e.dpr; ctx.lineWidth = 1.6; ctx.strokeStyle = GB.sys; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(GB.v3, 0.8);
    for (let k = 0; k < 2; k++) {
      const s = e.t * (k ? -4 : 5) + k * 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, w * (0.45 + k * 0.2), h * (0.45 + k * 0.2), 0, s, s + 2.1); ctx.stroke();
    }
  }
  function gbTendril(ctx, p, t, e) {
    const grow = easeOut(Math.min(1, t * 2.4)), fade = t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1, H = p.h * grow, N = 12;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      let px = p.x, py = p.y;
      for (let i = 1; i <= N; i++) {
        const u = i / N, x = p.x + Math.sin(u * 3.4 + p.ph + e.t * 5) * p.sway * u, y = p.y - H * u;
        ctx.globalAlpha = fade * (pass ? 1 : 0.6) * (1 - u * 0.35);
        ctx.lineWidth = (p.w * (1 - u) + 0.5) * (pass ? 1 : 2.4);
        ctx.strokeStyle = pass ? '#14072a' : GB.v;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
        px = x; py = y;
      }
      if (pass) { ctx.globalAlpha = 1; blob(ctx, GB.v3, px, py, 5, fade); }
    }
  }
  function gbPanel(ctx, p, t, e) {
    const sec = t * p.life, open = clamp(sec / 0.16, 0, 1), fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    const fs = p.big ? 15 : 12.5;
    ctx.font = '600 ' + fs + 'px ' + FONT;
    const tw = ctx.measureText(p.text).width, w = tw + 28, h = fs + 15, sw = Math.max(2, w * easeOut(open));
    at(ctx, e, p.x, p.y - easeOut(t) * 16, 0, p.s);
    ctx.globalAlpha = fade;
    rrect(ctx, -sw / 2, -h / 2, sw, h, 3);
    ctx.fillStyle = 'rgba(5,16,40,.88)'; ctx.fill();
    ctx.shadowColor = GB.sys; ctx.shadowBlur = 10 * e.dpr; ctx.lineWidth = 1.1; ctx.strokeStyle = GB.sys; ctx.stroke(); ctx.shadowBlur = 0;
    if (open > 0.6) {
      ctx.globalAlpha = fade * ((open - 0.6) / 0.4);
      ctx.beginPath(); ctx.moveTo(-sw / 2 + 6, -h / 2 + 3.5); ctx.lineTo(sw / 2 - 6, -h / 2 + 3.5);
      ctx.strokeStyle = rgba(GB.sys, 0.35); ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = p.big ? '#ffffff' : GB.sys2; ctx.fillText(p.text, 0, 1);
      ctx.fillStyle = GB.sys;
      const cx = sw / 2 + 3, cy = h / 2 + 3;
      ctx.fillRect(-cx, -cy, 5, 1.4); ctx.fillRect(-cx, -cy, 1.4, 5);
      ctx.fillRect(cx - 5, cy - 1.4, 5, 1.4); ctx.fillRect(cx - 1.4, cy - 5, 1.4, 5);
    }
  }
  function gbBeam(ctx, p, t) {
    const a = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88, w = 30 * (1 - t * 0.6), H = Math.min(320, p.y + 20);
    const g = ctx.createLinearGradient(0, p.y - H, 0, p.y);
    g.addColorStop(0, rgba(GB.sys, 0)); g.addColorStop(0.7, rgba(GB.sys, 0.35)); g.addColorStop(1, rgba(GB.sys2, 0.8));
    ctx.globalAlpha = a; ctx.fillStyle = g;
    ctx.fillRect(p.x - w / 2, p.y - H, w, H);
    ctx.fillRect(p.x - w / 6, p.y - H, w / 3, H);
  }
  THEMES.gatebreaker = {
    label: 'Gatebreaker', color: GB.v, base: 1.05, hoverTilt: -0.3, swing: -14, mid: [16, 0],
    init: () => ({ smoke: 0, ghost: 0, lv: 1, exp: 0, need: 320 }),
    sprite: gbDagger,
    tick(e, dt, st) {
      if (e.vis < 0.3 || e.off || e.textEl) return;
      st.smoke += dt * e.mult;
      const ca = Math.cos(e.ang), sa = Math.sin(e.ang);
      while (st.smoke > 0.05) {
        st.smoke -= 0.05;
        const d = rnd(6, 24) * e.size * e.sc;
        e.spawn({ x: e.x + ca * d + rnd(-3, 3), y: e.y + sa * d + rnd(-3, 3), vx: rnd(-8, 8), vy: -rnd(16, 42), drag: 0.5, life: rnd(0.7, 1.2), size: rnd(4.5, 8) * e.size, a: 0.38, c: pick([GB.v, GB.v2, '#7c3aed']), ph: rnd(0, TAU), upd: wobble, draw: gbSmoke });
      }
    },
    trail(e, x0, y0, x1, y1, d, st) {
      e.along(x0, y0, x1, y1, d, 7, (x, y) => e.spawn({ x: x + rnd(-4, 4), y: y + rnd(-3, 3), vx: rnd(-14, 14), vy: -rnd(25, 85), drag: 1.2, life: rnd(0.4, 0.8), size: rnd(3, 6.5) * e.size, c: Math.random() < 0.15 ? GB.sys : pick([GB.v, '#c084fc', '#8b5cf6']), core: Math.random() < 0.3, ph: rnd(0, TAU), upd: wobble, draw: gbWisp }));
      if (!e.reduced && e.speed > 650 && e.t - st.ghost > 0.04) {
        st.ghost = e.t;
        e.spawn({ x: x1, y: y1, rot: e.ang, s: e.sc * e.size, life: 0.26, draw: gbGhost });
      }
    },
    follower(ctx, e) {
      const r = 13 * e.ringS * e.size, fade = e.vis * (1 - 0.6 * e.frK);
      ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = GB.v; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = -e.t * 14;
      ctx.beginPath(); ctx.arc(e.fx, e.fy, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    },
    frame(ctx, e, r, k) {
      const fl = k < 0.8 && Math.random() < 0.25 ? 0.35 : 1;
      rrect(ctx, r.x, r.y, r.w, r.h, 4);
      ctx.globalAlpha = 0.12 * k * fl; ctx.fillStyle = GB.sys; ctx.fill();
      ctx.globalAlpha = k * fl; ctx.lineWidth = 1.2; ctx.strokeStyle = GB.sys; ctx.shadowColor = GB.sys; ctx.shadowBlur = 10 * e.dpr; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = GB.sys2;
      ctx.fillRect(r.x - 1.5, r.y - 1.5, 3, 3); ctx.fillRect(r.x + r.w - 1.5, r.y - 1.5, 3, 3);
      ctx.fillRect(r.x - 1.5, r.y + r.h - 1.5, 3, 3); ctx.fillRect(r.x + r.w - 1.5, r.y + r.h - 1.5, 3, 3);
      ctx.globalAlpha = 0.3 * k;
      ctx.fillRect(r.x + 2, r.y + ((e.t * 0.8) % 1) * r.h, r.w - 4, 1);
    },
    click(e, x, y, st) {
      const s = e.size;
      e.spawn({ x, y: y + 4, s, life: 0.95, draw: gbRift });
      const nt = Math.max(3, Math.round(6 * e.mult));
      for (let i = 0; i < nt; i++) e.spawn({ x: x + rnd(-26, 26) * s, y: y + 4 + rnd(-3, 3), h: rnd(34, 78) * s, sway: rnd(-14, 14), w: rnd(2, 3.6) * s, ph: rnd(0, TAU), life: rnd(0.6, 0.9), delay: rnd(0, 0.1), draw: gbTendril });
      for (let i = 0; i < Math.round(10 * e.mult); i++) e.spawn({ x: x + rnd(-20, 20), y, vx: rnd(-80, 80), vy: -rnd(80, 260), ay: 200, drag: 1.4, life: rnd(0.5, 0.9), size: rnd(1.8, 3.4) * s, c: pick([GB.sys, GB.v, GB.v3]), core: true, draw: D.dot });
      let gain = Math.round(rnd(60, 140));
      const crit = Math.random() < 0.2;
      if (crit) gain *= 2;
      st.exp += gain;
      let text = (crit ? 'Critical! ' : '') + '+' + gain + ' EXP', big = false;
      if (st.exp >= st.need) {
        st.exp -= st.need; st.lv++; st.need = Math.round(st.need * 1.18);
        text = 'Level up!  Lv. ' + st.lv; big = true;
        e.spawn({ x, y: y + 4, life: 1.1, draw: gbBeam });
        e.spawn({ x, y: y + 4, r0: 6, r1: 80 * s, w: 3, c: GB.sys, life: 0.7, draw: D.ring });
      }
      e.spawn({ x, y: y - 36 * s, tag: 'sys', stack: 30 * s, text, big, s, life: big ? 1.7 : 1.15, draw: gbPanel });
    },
  };

  /* =====================================================================
     REACTOR — gunmetal pointer with an energy orb, charge ring, blasts
     ===================================================================== */
  const RX = { g: '#5dff9e', g2: '#d2ffe4', mid: '#1fbf6a', ink: '#0a1115', gold: '#ffc94a' };
  function rxArrow(ctx, e, st) {
    const full = st && st.charge >= 1, oc = full ? RX.gold : RX.g;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 23); ctx.lineTo(6.2, 17.6); ctx.lineTo(10.6, 27); ctx.lineTo(14.8, 25.1); ctx.lineTo(10.4, 16); ctx.lineTo(18.2, 16); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 14, 24);
    g.addColorStop(0, '#a3b2bd'); g.addColorStop(0.45, '#4a5660'); g.addColorStop(1, '#1b2227');
    ctx.shadowColor = rgba(oc, 0.85); ctx.shadowBlur = 10 * e.dpr; ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2; ctx.strokeStyle = RX.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1.7, 4.5); ctx.lineTo(1.7, 19.5); ctx.moveTo(2.6, 3); ctx.lineTo(13.6, 14.4);
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8.6, 18.4); ctx.lineTo(11.6, 24.6); ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(oc, 0.9); ctx.stroke();
    const ox = 6.2, oy = 11.4, pulse = 1 + Math.sin(e.t * (full ? 12 : 4)) * 0.08;
    blob(ctx, oc, ox, oy, 11 * pulse, 0.55);
    ctx.beginPath(); ctx.arc(ox, oy, 4.6, 0, TAU); ctx.fillStyle = RX.ink; ctx.fill();
    const og = ctx.createRadialGradient(ox - 1.2, oy - 1.4, 0.3, ox, oy, 3.8);
    og.addColorStop(0, '#ffffff'); og.addColorStop(0.35, full ? '#ffe9a8' : RX.g2); og.addColorStop(0.7, oc); og.addColorStop(1, full ? '#a86d00' : '#0b7a42');
    ctx.beginPath(); ctx.arc(ox, oy, 3.7 * pulse, 0, TAU); ctx.fillStyle = og; ctx.fill();
  }
  function rxConverge(p, dt, t, e) {
    const k = t * t, tx = e.x + 6 * e.sc * e.size, ty = e.y + 11 * e.sc * e.size;
    p.x = lerp(p.sx, tx, k); p.y = lerp(p.sy, ty, k);
  }
  function rxPillar(ctx, p, t) {
    const a = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9, w = 36 * (1 - t * 0.7), H = Math.min(420, p.y + 40);
    const g = ctx.createLinearGradient(0, p.y - H, 0, p.y);
    g.addColorStop(0, rgba(RX.g, 0)); g.addColorStop(0.75, rgba(RX.g, 0.3)); g.addColorStop(1, rgba(RX.g2, 0.75));
    ctx.globalAlpha = a; ctx.fillStyle = g;
    ctx.fillRect(p.x - w / 2, p.y - H, w, H);
    ctx.fillRect(p.x - w / 6, p.y - H, w / 3, H);
  }
  function rxSmall(e, x, y) {
    const s = e.size;
    e.spawn({ x, y, r0: 4, r1: 48 * s, w: 3.2, c: RX.g, life: 0.5, draw: D.ring });
    e.spawn({ x, y, r0: 3, r1: 32 * s, w: 1.6, c: RX.g2, life: 0.45, delay: 0.07, draw: D.ring });
    e.spawn({ x, y, size: 24 * s, c: RX.g, life: 0.26, draw: D.flash });
    for (let i = 0; i < Math.round(14 * e.mult); i++) {
      const a = rnd(0, TAU), sp = rnd(60, 230);
      e.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: -50, drag: 3, life: rnd(0.6, 1.1), size: rnd(1.6, 3.4) * s, c: pick([RX.g, RX.g2, RX.mid]), core: true, draw: D.dot });
    }
  }
  function rxBig(e, x, y) {
    const s = e.size;
    if (!e.reduced) e.spawn({ x: 0, y: 0, c: RX.g, a: 0.14, life: 0.32, draw: D.screen });
    e.spawn({ x, y, life: 1.0, draw: rxPillar });
    [[RX.g, 140, 5, 0], [RX.gold, 100, 3.5, 0.07], [RX.g2, 62, 2, 0.14]].forEach((r) => e.spawn({ x, y, r0: 6, r1: r[1] * s, w: r[2], c: r[0], life: 0.85, delay: r[3], draw: D.ring }));
    e.spawn({ x, y, r0: 10, r1: 76 * s, w: 2, n: 8, rot: 0, spin: 2, c: RX.gold, life: 0.8, draw: D.polyRing });
    e.spawn({ x, y, size: 60 * s, c: RX.g, life: 0.4, draw: D.flash });
    for (let i = 0; i < Math.round(40 * e.mult); i++) {
      const a = rnd(0, TAU), sp = rnd(100, 440);
      e.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: -70, drag: 2.6, life: rnd(0.7, 1.4), size: rnd(1.8, 4.2) * s, c: pick([RX.g, RX.gold, RX.g2]), core: true, draw: D.dot });
    }
    e.spawn({ x, y: y - 44 * s, text: 'Full charge', fs: 16, c: RX.gold, outline: 'rgba(10,30,18,.85)', rise: 26, life: 1.2, draw: D.pop });
  }
  THEMES.reactor = {
    label: 'Reactor', color: RX.g, base: 0, hoverTilt: -0.16, downTilt: 0.06, swing: -5, mid: [9, 13.5],
    init: () => ({ charge: 0.35, fill: 0.35, held: false, conv: 0, ready: false }),
    sprite: rxArrow,
    under(ctx, e) {
      const h = e.hist, n = h.length;
      if (n < 4) return;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let s = 0; s < 2; s++) {
        ctx.beginPath();
        let started = false;
        for (let i = n - 1; i > 0; i--) {
          const p = h[i], q = h[i - 1], age = e.t - p.t;
          if (age > 0.36) break;
          const u = age / 0.36, nx = q.y - p.y, ny = p.x - q.x, L = Math.hypot(nx, ny) || 1;
          const off = Math.sin(u * 9 - e.t * 14 + s * Math.PI) * 6 * Math.min(1, u * 3) * e.size;
          const x = p.x + (nx / L) * off, y = p.y + (ny / L) * off;
          if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
        }
        ctx.globalAlpha = 0.6 * e.vis; ctx.lineWidth = s ? 1 : 1.6; ctx.strokeStyle = s ? RX.g2 : RX.g; ctx.stroke();
      }
    },
    trail(e, x0, y0, x1, y1, d, st) {
      if (st.charge < 1) st.charge = Math.min(1, st.charge + d / 2600);
      e.along(x0, y0, x1, y1, d, 8, (x, y) => e.spawn({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), vx: rnd(-14, 14), vy: rnd(-34, -6), drag: 0.9, life: rnd(0.6, 1.3), size: rnd(1.6, 3.6) * e.size, c: Math.random() < 0.07 ? RX.gold : pick([RX.g, RX.g, RX.g2, RX.mid]), core: Math.random() < 0.3, ph: rnd(0, TAU), upd: wobble, draw: D.dot }));
    },
    tick(e, dt, st) {
      if (e.down && e.t - e.downAt > 0.22 && !e.off) {
        st.held = true;
        st.charge = Math.min(1, st.charge + dt * 0.8);
        st.conv += dt * e.mult;
        while (st.conv > 0.025) {
          st.conv -= 0.025;
          const a = rnd(0, TAU), r = rnd(30, 58) * e.size, sx = e.x + Math.cos(a) * r, sy = e.y + Math.sin(a) * r;
          e.spawn({ x: sx, y: sy, sx, sy, life: rnd(0.28, 0.45), size: rnd(1.6, 3) * e.size, c: st.charge >= 1 ? RX.gold : RX.g, core: true, upd: rxConverge, draw: D.dot });
        }
      } else if (e.t - e.lastMove > 1.4) st.charge = Math.max(0, st.charge - dt * 0.04);
      if (st.charge >= 1 && !st.ready) { st.ready = true; e.spawn({ x: e.fx, y: e.fy, r0: 14, r1: 40 * e.size, w: 2.5, c: RX.gold, life: 0.5, draw: D.ring }); }
      if (st.charge < 1) st.ready = false;
      st.fill += (st.charge - st.fill) * (1 - Math.exp(-dt * 10));
    },
    follower(ctx, e, st) {
      const R = 22 * e.ringS * e.size, x = e.fx, y = e.fy, N = 12, full = st.charge >= 1, f = st.fill * N, fade = e.vis * (1 - 0.5 * e.frK);
      ctx.lineCap = 'butt'; ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = 'rgba(40,58,66,.9)';
      for (let i = 0; i < N; i++) { const a0 = -Math.PI / 2 + (i * TAU) / N + 0.07; ctx.beginPath(); ctx.arc(x, y, R, a0, a0 + TAU / N - 0.14); ctx.stroke(); }
      ctx.strokeStyle = full ? RX.gold : RX.g; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8 * e.dpr;
      ctx.globalAlpha = fade * (full ? 0.75 + 0.25 * Math.sin(e.t * 10) : 0.95);
      for (let i = 0; i < N; i++) {
        const on = clamp(f - i, 0, 1);
        if (on <= 0) break;
        const a0 = -Math.PI / 2 + (i * TAU) / N + 0.07;
        ctx.beginPath(); ctx.arc(x, y, R, a0, a0 + (TAU / N - 0.14) * on); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (full) { ctx.globalAlpha = 1; blob(ctx, RX.gold, x, y, R * 1.7, fade * (0.16 + 0.08 * Math.sin(e.t * 10))); }
    },
    frame(ctx, e, r, k) {
      rrect(ctx, r.x, r.y, r.w, r.h, 7);
      ctx.globalAlpha = 0.08 * k; ctx.fillStyle = RX.g; ctx.fill();
      ctx.globalAlpha = 0.45 * k; ctx.lineWidth = 1; ctx.strokeStyle = RX.g; ctx.stroke();
      const per = 2 * (r.w + r.h);
      ctx.setLineDash([per * 0.16, per * 0.34]); ctx.lineDashOffset = -e.t * per * 0.5;
      ctx.globalAlpha = k; ctx.lineWidth = 2.2; ctx.strokeStyle = RX.g2; ctx.shadowColor = RX.g; ctx.shadowBlur = 10 * e.dpr; ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur = 0;
    },
    click(e, x, y, st) {
      if (st.charge >= 1) { rxBig(e, x, y); st.charge = 0; st.held = false; } else rxSmall(e, x, y);
    },
    release(e, x, y, st) {
      if (st.held && st.charge >= 1) { rxBig(e, x, y); st.charge = 0; }
      st.held = false;
    },
  };

  /* =====================================================================
     ELEMENTA — gilded pointer with a floating crystal, seven elements
     ===================================================================== */
  const EL = [
    { n: 'Fire', c: '#ff6a3d', c2: '#ffd27a' },
    { n: 'Water', c: '#36b3ff', c2: '#bfe9ff' },
    { n: 'Wind', c: '#36e8b8', c2: '#d4fff2' },
    { n: 'Lightning', c: '#b57bff', c2: '#f2e8ff' },
    { n: 'Ice', c: '#8fe1ff', c2: '#ffffff' },
    { n: 'Nature', c: '#86d23a', c2: '#e6ffc2' },
    { n: 'Earth', c: '#eea53a', c2: '#ffe2a0' },
  ];
  const COMBO = ['Steam', 'Mist', 'Storm', 'Shatter', 'Rime', 'Sprout', 'Magma'];
  const GOLD = { a: '#ffd76a', b: '#fff3c4', ink: '#5a3606' };
  function elWand(ctx, e, st) {
    const E = EL[st ? st.i : 0];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.rect(9.5, -1.15, 14, 2.3);
    ctx.fillStyle = '#e8b54a'; ctx.fill(); ctx.lineWidth = 0.7; ctx.strokeStyle = GOLD.ink; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10.5, -1.2); ctx.bezierCurveTo(12.5, -7.2, 17.8, -6.6, 16.6, -3.4);
    ctx.moveTo(10.5, 1.2); ctx.bezierCurveTo(12.5, 7.2, 17.8, 6.6, 16.6, 3.4);
    ctx.lineWidth = 2.4; ctx.strokeStyle = GOLD.ink; ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = GOLD.a; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14.2, -6.4); ctx.lineTo(10.2, 0); ctx.lineTo(14.2, 6.4); ctx.closePath();
    const g = ctx.createLinearGradient(0, -6.4, 0, 6.4);
    g.addColorStop(0, '#fff7d6'); g.addColorStop(0.5, GOLD.a); g.addColorStop(1, '#c0821a');
    ctx.shadowColor = rgba(GOLD.a, 0.9); ctx.shadowBlur = 9 * e.dpr; ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 0.9; ctx.strokeStyle = GOLD.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1.8, 0); ctx.lineTo(10, 0); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
    const b = Math.sin(e.t * 3) * 0.8;
    blob(ctx, E.c, 28.5 + b, 0, 12, 0.75);
    ctx.beginPath(); ctx.moveTo(24 + b, 0); ctx.lineTo(27 + b, -3.1); ctx.lineTo(33.5 + b, 0); ctx.lineTo(27 + b, 3.1); ctx.closePath();
    const cg = ctx.createLinearGradient(24, -3.1, 33.5, 3.1);
    cg.addColorStop(0, E.c2); cg.addColorStop(1, E.c);
    ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(20,16,40,.8)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25.2 + b, 0); ctx.lineTo(27 + b, -1.8); ctx.lineTo(30 + b, -0.4); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  function elTwinkle(ctx, p, t, e) {
    const s = p.size * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
    blob(ctx, p.c, p.x, p.y, s * 2.2, 0.5 * (1 - t));
    at(ctx, e, p.x, p.y, p.rot, 1);
    star4(ctx, s, 0.28);
    ctx.globalAlpha = 1 - t * 0.6; ctx.fillStyle = p.c; ctx.fill();
  }
  function elRipple(ctx, p, t) {
    const rx = lerp(p.r0, p.r1, easeOut(t));
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, rx * 0.42, 0, 0, TAU);
    ctx.globalAlpha = 1 - t; ctx.lineWidth = p.w * (1 - t) + 0.4; ctx.strokeStyle = p.c; ctx.stroke();
  }
  function elDrop(ctx, p, t, e) {
    at(ctx, e, p.x, p.y, Math.atan2(p.vy, p.vx), 1);
    ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.7, p.size, 0, 0, TAU);
    ctx.globalAlpha = 1 - t * t; ctx.fillStyle = p.c; ctx.fill();
    ctx.beginPath(); ctx.arc(p.size * 0.5, -p.size * 0.3, p.size * 0.35, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  function elSwirl(ctx, p, t, e) {
    at(ctx, e, p.x, p.y, p.rot + t * 5.5, 1);
    const R = 8 + p.R * easeOut(t);
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, a = u * 2.3, r = R * (0.35 + 0.65 * u);
      if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.globalAlpha = 1 - t; ctx.lineWidth = 2.6 * (1 - t) + 0.4; ctx.lineCap = 'round'; ctx.strokeStyle = p.c; ctx.stroke();
  }
  function elBolt(ctx, p, t, e) {
    if (e.t - p.gen > 0.05) { p.gen = e.t; p.pts = []; for (let i = 0; i <= 6; i++) p.pts.push(i === 0 || i === 6 ? 0 : rnd(-7, 7)); }
    const L = p.len * Math.min(1, t * 6), ca = Math.cos(p.ang), sa = Math.sin(p.ang);
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const u = i / 6, j = p.pts[i], px = p.x + ca * L * u - sa * j, py = p.y + sa * L * u + ca * j;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.lineJoin = 'bevel';
    ctx.globalAlpha = (1 - t) * 0.7; ctx.lineWidth = 3.4; ctx.strokeStyle = p.c; ctx.stroke();
    ctx.globalAlpha = 1 - t; ctx.lineWidth = 1.2; ctx.strokeStyle = p.c2; ctx.stroke();
  }
  function elFlake(ctx, p, t, e) {
    const g = easeBack(Math.min(1, t * 2.8)), s = g * p.s * (t > 0.7 ? 1 + (t - 0.7) * 0.6 : 1), a = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    if (s <= 0.01) return;
    at(ctx, e, p.x, p.y, p.rot + t * 0.9, s);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ca = Math.cos((k * TAU) / 6), sa = Math.sin((k * TAU) / 6);
      const seg = (x1, y1, x2, y2) => { ctx.moveTo(x1 * ca - y1 * sa, x1 * sa + y1 * ca); ctx.lineTo(x2 * ca - y2 * sa, x2 * sa + y2 * ca); };
      seg(0, 0, 20, 0); seg(8, 0, 12.5, -4.5); seg(8, 0, 12.5, 4.5); seg(13.5, 0, 16.5, -3); seg(13.5, 0, 16.5, 3);
    }
    ctx.globalAlpha = a; ctx.lineCap = 'round';
    ctx.lineWidth = 2.6; ctx.strokeStyle = rgba(p.c, 0.6); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = p.c2; ctx.shadowColor = p.c; ctx.shadowBlur = 8 * e.dpr; ctx.stroke(); ctx.shadowBlur = 0;
    poly(ctx, 6, 3.4, Math.PI / 6); ctx.fillStyle = p.c2; ctx.fill();
  }
  function elNeedle(ctx, p, t, e) {
    at(ctx, e, p.x, p.y, Math.atan2(p.vy, p.vx), 1);
    const s = p.size * (1 - t * 0.4);
    ctx.beginPath(); ctx.moveTo(-s * 1.9, 0); ctx.lineTo(0, -s * 0.42); ctx.lineTo(s * 1.9, 0); ctx.lineTo(0, s * 0.42); ctx.closePath();
    ctx.globalAlpha = 1 - t; ctx.fillStyle = p.c2; ctx.fill(); ctx.lineWidth = 0.7; ctx.strokeStyle = p.c; ctx.stroke();
  }
  function elLeaf(ctx, p, t, e) {
    at(ctx, e, p.x, p.y, p.rot, 1);
    const s = p.size;
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.8, s, 0); ctx.quadraticCurveTo(0, s * 0.8, -s, 0);
    ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1; ctx.fillStyle = p.c; ctx.fill();
    ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(20,50,10,.6)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
  }
  function elPlate(ctx, p, t, e) {
    const s = t < 0.25 ? easeBack(t / 0.25) : 1, a = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
    if (s <= 0.01) return;
    at(ctx, e, p.x, p.y - easeOut(t) * 6, 0, s);
    poly(ctx, 6, p.size, Math.PI / 6);
    ctx.globalAlpha = a * 0.45; ctx.fillStyle = p.c; ctx.fill();
    ctx.globalAlpha = a; ctx.lineWidth = 1.4; ctx.strokeStyle = p.c2; ctx.stroke();
  }
  const EL_BURST = [
    (e, x, y, E) => { // fire
      e.spawn({ x, y, r0: 6, r1: 46 * e.size, w: 4, c: E.c, life: 0.5, draw: D.ring });
      e.spawn({ x, y, size: 34 * e.size, c: E.c, life: 0.32, draw: D.flash });
      for (let i = 0; i < Math.round(22 * e.mult); i++) e.spawn({ x: x + rnd(-8, 8), y: y + rnd(-6, 6), vx: rnd(-100, 100), vy: -rnd(40, 230), ay: -50, drag: 1.7, life: rnd(0.5, 1.1), size: rnd(2.2, 5) * e.size, c: pick([E.c, '#ff3d1f', '#ff9a3d']), c2: E.c2, ph: rnd(0, TAU), draw: D.ember });
    },
    (e, x, y, E) => { // water
      for (let k = 0; k < 3; k++) e.spawn({ x, y: y + 2, r0: 5, r1: (60 - k * 13) * e.size, w: 2.4, c: k % 2 ? E.c2 : E.c, life: 0.75, delay: k * 0.09, draw: elRipple });
      for (let i = 0; i < Math.round(16 * e.mult); i++) {
        const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(120, 280);
        e.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 720, life: rnd(0.5, 0.85), size: rnd(1.8, 3.4) * e.size, c: pick([E.c, E.c2]), draw: elDrop });
      }
    },
    (e, x, y, E) => { // wind
      for (let k = 0; k < 4; k++) e.spawn({ x, y, rot: (k * TAU) / 4 + rnd(-0.2, 0.2), R: 46 * e.size, life: 0.75, c: k % 2 ? E.c2 : E.c, draw: elSwirl });
      for (let i = 0; i < Math.round(14 * e.mult); i++) e.spawn({ x, y, cx: x, cy: y, ang: rnd(0, TAU), rad: rnd(4, 12), vrad: rnd(50, 120) * e.size, vang: rnd(5, 9), life: rnd(0.6, 1), size: rnd(1.5, 3) * e.size, c: pick([E.c, E.c2]), upd: orbit, draw: D.dot });
    },
    (e, x, y, E) => { // lightning
      e.spawn({ x, y, size: 44 * e.size, c: E.c, life: 0.24, draw: D.flash });
      const o = rnd(0, TAU);
      for (let k = 0; k < 5; k++) e.spawn({ x, y, ang: o + (k * TAU) / 5 + rnd(-0.3, 0.3), len: rnd(40, 74) * e.size, life: 0.38, gen: -1, c: E.c, c2: E.c2, draw: elBolt });
      for (let i = 0; i < Math.round(10 * e.mult); i++) {
        const a = rnd(0, TAU), sp = rnd(150, 380);
        e.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 6, life: rnd(0.25, 0.5), size: rnd(1.4, 2.6) * e.size, c: E.c2, core: true, draw: D.dot });
      }
    },
    (e, x, y, E) => { // ice
      e.spawn({ x, y, size: 30 * e.size, c: E.c, a: 0.5, life: 0.5, draw: D.flash });
      e.spawn({ x, y, rot: rnd(0, 1), s: e.size, life: 1, c: E.c, c2: E.c2, draw: elFlake });
      for (let i = 0; i < Math.round(12 * e.mult); i++) {
        const a = rnd(0, TAU), sp = rnd(90, 260);
        e.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 4, life: rnd(0.5, 0.9), size: rnd(2.5, 4.5) * e.size, c: E.c, c2: E.c2, draw: elNeedle });
      }
    },
    (e, x, y, E) => { // nature
      for (let i = 0; i < Math.round(14 * e.mult); i++) {
        const a = rnd(0, TAU), sp = rnd(70, 220);
        e.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 70, drag: 2.4, life: rnd(0.8, 1.35), size: rnd(3.5, 6) * e.size, rot: rnd(0, TAU), vr: rnd(-6, 6), c: pick([E.c, '#58b02a', '#b5ec6a']), draw: elLeaf });
      }
      for (let k = 0; k < 8; k++) {
        const a = (k * TAU) / 8;
        e.spawn({ x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, drag: 3, life: 0.8, size: 2.4 * e.size, c: E.c2, core: true, draw: D.dot });
      }
      e.spawn({ x, y, r0: 4, r1: 36 * e.size, w: 2, c: E.c, life: 0.6, draw: D.ring });
    },
    (e, x, y, E) => { // earth
      for (let k = 0; k < 6; k++) {
        const a = (k * TAU) / 6 - Math.PI / 2;
        e.spawn({ x: x + Math.cos(a) * 26 * e.size, y: y + Math.sin(a) * 26 * e.size, size: 7.5 * e.size, c: E.c, c2: E.c2, life: 0.85, delay: k * 0.035, draw: elPlate });
      }
      for (let i = 0; i < Math.round(12 * e.mult); i++) {
        const n = Math.random() < 0.5 ? 4 : 5, radii = [];
        for (let j = 0; j < n; j++) radii.push(rnd(0.65, 1.2));
        e.spawn({ x, y, vx: rnd(-170, 170), vy: -rnd(120, 330), ay: 900, life: rnd(0.6, 0.95), size: rnd(2.8, 5.6) * e.size, n, radii, rot: rnd(0, TAU), vr: rnd(-9, 9), c: pick([E.c, '#c47f1e', '#8a5a17']), stroke: 'rgba(40,24,4,.8)', draw: D.shard });
      }
      e.spawn({ x, y, size: 30 * e.size, c: E.c, a: 0.6, life: 0.3, draw: D.flash });
    },
  ];
  THEMES.elementa = {
    label: 'Elementa', color: GOLD.a, base: 0.9, hoverTilt: -0.28, swing: -12, mid: [16.5, 0],
    init: () => ({ i: 0, prev: -1, last: -9, rot: -Math.PI / 2, rotT: -Math.PI / 2 }),
    sprite: elWand,
    tick(e, dt, st) { st.rot += (st.rotT - st.rot) * (1 - Math.exp(-dt * 7)); },
    trail(e, x0, y0, x1, y1, d, st) {
      const E = EL[st.i];
      e.along(x0, y0, x1, y1, d, 10, (x, y) => e.spawn({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), vx: rnd(-12, 12), vy: rnd(4, 30), drag: 1, life: rnd(0.5, 1), size: rnd(2.2, 5) * e.size, rot: rnd(0, 0.8), vr: rnd(-1.5, 1.5), c: Math.random() < 0.38 ? E.c : pick([GOLD.a, GOLD.b, '#ffffff']), draw: elTwinkle }));
    },
    follower(ctx, e, st) {
      const R = 15 * e.ringS * e.size, fade = e.vis * (1 - 0.55 * e.frK);
      ctx.globalAlpha = 0.3 * fade; ctx.lineWidth = 0.8; ctx.strokeStyle = GOLD.a;
      ctx.beginPath(); ctx.arc(e.fx, e.fy, R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      for (let k = 0; k < 7; k++) {
        const a = st.rot + (k * TAU) / 7, x = e.fx + Math.cos(a) * R, y = e.fy + Math.sin(a) * R, on = k === st.i;
        blob(ctx, EL[k].c, x, y, on ? 9 : 4.5, fade * (on ? 1 : 0.7));
        if (on) blob(ctx, '#ffffff', x, y, 3, fade);
      }
    },
    frame(ctx, e, r, k, st) {
      const E = EL[st.i];
      rrect(ctx, r.x, r.y, r.w, r.h, 9);
      ctx.globalAlpha = 0.08 * k; ctx.fillStyle = GOLD.a; ctx.fill();
      ctx.globalAlpha = 0.9 * k; ctx.lineWidth = 1.2; ctx.strokeStyle = GOLD.a; ctx.shadowColor = rgba(GOLD.a, 0.8); ctx.shadowBlur = 8 * e.dpr; ctx.stroke(); ctx.shadowBlur = 0;
      const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
      pts.forEach((pt, i) => {
        const tw = 0.65 + 0.35 * Math.sin(e.t * 5 + i * 1.7);
        home(ctx, e); ctx.globalAlpha = 1;
        blob(ctx, E.c, pt[0], pt[1], 12 * tw * k, 0.7 * k);
        at(ctx, e, pt[0], pt[1], e.t * 0.7 + i, 1);
        star4(ctx, 6.5 * tw * k, 0.24);
        ctx.globalAlpha = k; ctx.fillStyle = E.c2; ctx.fill();
      });
    },
    click(e, x, y, st) {
      const E = EL[st.i];
      EL_BURST[st.i](e, x, y, E);
      e.spawn({ x, y: y - 28 * e.size, tag: 'el', text: E.n, fs: 12.5, c: E.c2, outline: 'rgba(10,15,46,.85)', rise: 20, life: 0.9, draw: D.pop });
      if (e.t - st.last < 1.6 && st.prev === (st.i + 6) % 7) e.spawn({ x, y: y - 50 * e.size, tag: 'elc', text: COMBO[st.prev] + '!', fs: 17, c: '#ffffff', outline: rgba(EL[st.prev].c, 0.9), rise: 24, life: 1.2, delay: 0.05, draw: D.pop });
      st.prev = st.i; st.last = e.t;
      st.i = (st.i + 1) % 7; st.rotT -= TAU / 7;
      e.spawn({ x: e.fx, y: e.fy, r0: 4, r1: 24 * e.size, w: 2, c: EL[st.i].c, life: 0.4, delay: 0.15, draw: D.ring });
    },
  };

  /* =====================================================================
     ENGINE
     ===================================================================== */
  const DEFAULTS = {
    theme: 'skyblade',
    size: 1,
    density: 1,
    zIndex: 2147483000,
    touchEffects: true,
    hideNativeCursor: true,
    respectReducedMotion: true,
    maxParticles: 700,
    frameMax: [520, 200],
    hoverSelector: 'a[href],button,[role="button"],[role="tab"],[role="menuitem"],summary,label[for],select,input[type="checkbox"],input[type="radio"],input[type="range"],input[type="submit"],input[type="button"],input[type="reset"],[data-cursor-hover]',
    textSelector: 'input:not([type]),input[type="text"],input[type="email"],input[type="search"],input[type="password"],input[type="url"],input[type="tel"],input[type="number"],textarea,[contenteditable="true"],[contenteditable=""]',
  };

  class Engine {
    constructor(opts) {
      const o = (this.o = Object.assign({}, DEFAULTS, opts || {}));
      this.reduced = !!(o.respectReducedMotion && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.fine = !window.matchMedia || matchMedia('(any-pointer: fine)').matches;
      this.size = +o.size || 1;
      this.mult = (+o.density || 1) * (this.reduced ? 0.3 : 1);
      this.max = o.maxParticles * (this.reduced ? 0.5 : 1);
      this.parts = []; this.hist = []; this.states = {}; this.acc = 0;
      this.x = this.y = this.px = this.py = this.fx = this.fy = -100;
      this.vis = 0; this.visT = 0; this.shown = false;
      this.ang = 0; this.angV = 0; this.sc = 1; this.scV = 0; this.ringS = 1;
      this.vx = 0; this.vy = 0; this.speed = 0;
      this.t = 0; this.dt = 0.016; this.down = false; this.downAt = 0; this.lastMove = 0;
      this.hoverEl = null; this.textEl = false; this.off = false; this.fr = null; this.frK = 0;
      this.manual = false;
      this.base = THEMES[o.theme] ? o.theme : 'skyblade';
      this.cur = this.base;
      this.ang = THEMES[this.cur].base || 0;
      this._frameB = this._frame.bind(this);
      this._build();
      this._bind();
      this.raf = requestAnimationFrame(this._frameB);
    }
    get theme() { return this.base; }
    _build() {
      const c = (this.cv = document.createElement('canvas'));
      c.setAttribute('aria-hidden', 'true');
      c.className = 'anime-cursor-layer';
      c.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:' + this.o.zIndex + ';';
      document.body.appendChild(c);
      this.ctx = c.getContext('2d');
      const st = (this.styleEl = document.createElement('style'));
      st.textContent = 'html.ac-hide,html.ac-hide *{cursor:none!important}html.ac-hide [data-cursor-off],html.ac-hide [data-cursor-off] *{cursor:revert!important}';
      document.head.appendChild(st);
      this._resize();
    }
    _bind() {
      this._h = {
        move: (ev) => { if (ev.pointerType === 'touch' || this.manual) return; this._setPos(ev.clientX, ev.clientY, ev.target); },
        down: (ev) => {
          if (this.manual) return;
          if (ev.pointerType === 'touch') {
            if (this.o.touchEffects) { this._resolve(ev.target); if (!this.off) this._click(ev.clientX, ev.clientY); }
            return;
          }
          if (ev.button !== 0) return;
          this._setPos(ev.clientX, ev.clientY, ev.target);
          this.press();
        },
        up: (ev) => { if (ev.pointerType === 'touch' || this.manual) return; this.release(); },
        out: (ev) => { if (!ev.relatedTarget && !this.manual) { this.visT = 0; this.release(); } },
        blur: () => { if (!this.manual) { this.visT = 0; this.release(); } },
        resize: () => this._resize(),
        scroll: () => {
          if (this._sp) return;
          this._sp = true;
          requestAnimationFrame(() => {
            this._sp = false;
            if (this.vis > 0.05) { const el = document.elementFromPoint(this.x, this.y); if (el) { this._lt = el; this._resolve(el); } }
          });
        },
        vis: () => {
          if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; }
          else if (!this.raf) { this.lastNow = 0; this.raf = requestAnimationFrame(this._frameB); }
        },
      };
      const h = this._h, P = { passive: true };
      addEventListener('pointermove', h.move, P);
      addEventListener('pointerdown', h.down, P);
      addEventListener('pointerup', h.up, P);
      addEventListener('pointercancel', h.up, P);
      document.addEventListener('mouseout', h.out, P);
      addEventListener('blur', h.blur);
      addEventListener('resize', h.resize);
      addEventListener('scroll', h.scroll, { passive: true, capture: true });
      document.addEventListener('visibilitychange', h.vis);
    }
    _resize() {
      const d = Math.min(2, window.devicePixelRatio || 1);
      this.dpr = d;
      this.w = document.documentElement.clientWidth || innerWidth;
      this.h = innerHeight;
      this.cv.width = Math.round(this.w * d);
      this.cv.height = Math.round(this.h * d);
      this.cv.style.width = this.w + 'px';
      this.cv.style.height = this.h + 'px';
    }
    _setPos(x, y, target) {
      if (!this.shown) {
        this.shown = true;
        if (this.fine && this.o.hideNativeCursor) document.documentElement.classList.add('ac-hide');
      }
      if (this.vis < 0.05 || Math.hypot(x - this.x, y - this.y) > 400) {
        this.px = this.fx = x; this.py = this.fy = y; this.hist.length = 0;
      }
      this.x = x; this.y = y; this.visT = 1; this.lastMove = this.t;
      if (target !== this._lt) { this._lt = target; this._resolve(target); }
    }
    _resolve(t) {
      if (!t || !t.closest) t = document.documentElement;
      const z = t.closest('[data-cursor-theme]');
      const zt = z && THEMES[z.getAttribute('data-cursor-theme')] ? z.getAttribute('data-cursor-theme') : null;
      this.off = !!t.closest('[data-cursor-off]');
      this.textEl = !!t.closest(this.o.textSelector);
      this.hoverEl = this.textEl ? null : t.closest(this.o.hoverSelector);
      const next = zt || this.base;
      if (next !== this.cur) this._switch(next);
    }
    _switch(name) {
      this.cur = name;
      this.hist.length = 0;
      if (this.vis > 0.3) this.spawn({ x: this.x, y: this.y, r0: 3, r1: 28 * this.size, w: 2, c: THEMES[name].color, life: 0.38, draw: D.ring });
      this.angV += 9;
    }
    _click(x, y) {
      const th = THEMES[this.cur];
      this.angV += th.swing || 0;
      this.scV -= 6;
      th.click(this, x, y, this.themeState(this.cur));
    }
    themeState(name) {
      return this.states[name] || (this.states[name] = THEMES[name].init ? THEMES[name].init() : {});
    }
    along(x0, y0, x1, y1, d, spacing, fn) {
      if (this.parts.length > this.max * 0.85) return;
      this.acc += (d * this.mult) / spacing;
      let n = 0;
      while (this.acc >= 1 && n < 14) { this.acc -= 1; n++; const u = Math.random(); fn(lerp(x0, x1, u), lerp(y0, y1, u)); }
      if (this.acc > 1) this.acc = 1;
    }
    spawn(p) {
      if (this.parts.length >= this.max) this.parts.splice(0, 1);
      if (p.tag) {
        let n = 0;
        for (const q of this.parts) {
          if (q.tag !== p.tag || q.kill) continue;
          if (p.stack) { if ((q.age - (q.delay || 0)) / q.life < 0.55) n++; } else q.kill = true;
        }
        if (p.stack) p.y -= Math.min(3, n) * p.stack;
      }
      p.age = 0;
      this.parts.push(p);
      return p;
    }
    _frameRect(dt) {
      const el = this.hoverEl;
      let tg = null;
      if (el && el.isConnected && !this.off && this.vis > 0.05) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.width <= this.o.frameMax[0] && r.height <= this.o.frameMax[1]) tg = { x: r.left - 5, y: r.top - 5, w: r.width + 10, h: r.height + 10 };
      }
      const k = 1 - Math.exp(-dt * 16);
      if (tg) {
        const f = this.fr || (this.fr = { x: this.x - 10, y: this.y - 10, w: 20, h: 20 });
        f.x += (tg.x - f.x) * k; f.y += (tg.y - f.y) * k; f.w += (tg.w - f.w) * k; f.h += (tg.h - f.h) * k;
        this.frK += (1 - this.frK) * k;
      } else {
        this.frK += (0 - this.frK) * (1 - Math.exp(-dt * 20));
        if (this.fr) {
          const f = this.fr;
          f.x += (this.x - 10 - f.x) * k; f.y += (this.y - 10 - f.y) * k; f.w += (20 - f.w) * k; f.h += (20 - f.h) * k;
          if (this.frK < 0.01) this.fr = null;
        }
      }
    }
    _frame(now) {
      this.raf = requestAnimationFrame(this._frameB);
      if (!this.lastNow) this.lastNow = now;
      let dt = (now - this.lastNow) / 1000;
      this.lastNow = now;
      if (dt > 0.05) dt = 0.05;
      if (dt <= 0) dt = 0.001;
      this.t += dt; this.dt = dt;
      const th = THEMES[this.cur], st = this.themeState(this.cur), ctx = this.ctx;

      this.vis += (this.visT - this.vis) * (1 - Math.exp(-dt * 12));
      const dx = this.x - this.px, dy = this.y - this.py, d = Math.hypot(dx, dy);
      this.vx += (dx / dt - this.vx) * 0.35;
      this.vy += (dy / dt - this.vy) * 0.35;
      this.speed = Math.hypot(this.vx, this.vy);
      if (d > 0.3) this.hist.push({ x: this.x, y: this.y, t: this.t });
      while (this.hist.length && (this.t - this.hist[0].t > 0.45 || this.hist.length > 40)) this.hist.shift();
      if (d > 0.3 && this.vis > 0.2 && !this.off && !this.textEl && th.trail) th.trail(this, this.px, this.py, this.x, this.y, d, st);
      if (th.tick) th.tick(this, dt, st);

      const fk = 1 - Math.exp(-dt * 16);
      this.fx += (this.x - this.fx) * fk; this.fy += (this.y - this.fy) * fk;
      const rt = this.down ? 0.7 : this.hoverEl ? 1.3 : 1;
      this.ringS += (rt - this.ringS) * (1 - Math.exp(-dt * 14));
      const lean = clamp(this.vx * 0.00022, -0.28, 0.28);
      const target = (th.base || 0) + (this.hoverEl ? th.hoverTilt || 0 : 0) + (this.down ? th.downTilt || 0 : 0) + lean;
      this.angV += ((target - this.ang) * 170 - this.angV * 14) * dt;
      this.ang += this.angV * dt;
      const sT = this.down ? 0.86 : this.hoverEl ? 1.1 : 1;
      this.scV += ((sT - this.sc) * 260 - this.scV * 16) * dt;
      this.sc += this.scV * dt;
      this._frameRect(dt);

      home(ctx, this);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.vis > 0.02 && !this.off && !this.reduced && th.under) { th.under(ctx, this, st); ctx.globalAlpha = 1; }

      const P = this.parts;
      let j = 0;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (p.kill) continue;
        p.age += dt;
        const a = p.age - (p.delay || 0);
        if (a < 0) { P[j++] = p; continue; }
        const t = a / p.life;
        if (t >= 1) continue;
        if (p.vx !== undefined) {
          if (p.ax) p.vx += p.ax * dt;
          if (p.ay) p.vy += p.ay * dt;
          if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; }
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        if (p.vr) p.rot += p.vr * dt;
        if (p.upd) p.upd(p, dt, t, this);
        home(ctx, this); ctx.globalAlpha = 1;
        p.draw(ctx, p, t, this);
        P[j++] = p;
      }
      P.length = j;

      home(ctx, this); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (this.fr && this.frK > 0.01 && th.frame) { th.frame(ctx, this, this.fr, this.frK, st); home(ctx, this); ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
      if (this.vis > 0.02 && !this.off) {
        if (th.follower && !this.textEl) { th.follower(ctx, this, st); home(ctx, this); ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
        if (this.textEl) caret(ctx, this, th.color);
        else { at(ctx, this, this.x, this.y, this.ang, this.sc * this.size); ctx.globalAlpha = this.vis; th.sprite(ctx, this, st); }
      }
      home(ctx, this); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      this.px = this.x; this.py = this.y;
    }

    /* public */
    setTheme(name) {
      if (!THEMES[name]) return this;
      this.base = name;
      const el = this._lt && this._lt.isConnected ? this._lt : null;
      if (el) this._resolve(el); else if (this.cur !== name) this._switch(name);
      return this;
    }
    setSize(s) { this.size = clamp(+s || 1, 0.4, 3); return this; }
    setDensity(d) { this.o.density = clamp(+d || 1, 0, 4); this.mult = this.o.density * (this.reduced ? 0.3 : 1); return this; }
    moveTo(x, y) { this._setPos(x, y, document.elementFromPoint(x, y)); return this; }
    press(x, y) {
      if (x != null) this.moveTo(x, y);
      this.down = true; this.downAt = this.t;
      if (!this.off) this._click(this.x, this.y);
      return this;
    }
    release() {
      if (!this.down) return this;
      this.down = false;
      const th = THEMES[this.cur];
      if (th.release && !this.off) th.release(this, this.x, this.y, this.themeState(this.cur));
      return this;
    }
    burst(x, y) { this._click(x == null ? this.x : x, y == null ? this.y : y); return this; }
    hide() { this.visT = 0; return this; }
    destroy() {
      cancelAnimationFrame(this.raf);
      const h = this._h;
      removeEventListener('pointermove', h.move);
      removeEventListener('pointerdown', h.down);
      removeEventListener('pointerup', h.up);
      removeEventListener('pointercancel', h.up);
      document.removeEventListener('mouseout', h.out);
      removeEventListener('blur', h.blur);
      removeEventListener('resize', h.resize);
      removeEventListener('scroll', h.scroll, true);
      document.removeEventListener('visibilitychange', h.vis);
      this.cv.remove(); this.styleEl.remove();
      document.documentElement.classList.remove('ac-hide');
      if (instance === this) instance = null;
    }
  }

  let instance = null;
  const AnimeCursor = {
    version: '1.0.0',
    themes: THEMES,
    elements: EL.map((x) => ({ name: x.n, color: x.c })),
    list: () => Object.keys(THEMES).map((k) => ({ id: k, label: THEMES[k].label, color: THEMES[k].color })),
    init(opts) {
      if (instance) instance.destroy();
      instance = new Engine(opts);
      return instance;
    },
    get current() { return instance; },
    // draw a theme's cursor large into a canvas (for galleries and pickers)
    preview(canvas, name, o) {
      o = o || {};
      const th = THEMES[name];
      if (!th || !canvas) return;
      const d = Math.min(2, window.devicePixelRatio || 1), W = canvas.clientWidth || canvas.width, H = canvas.clientHeight || canvas.height;
      canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
      const ctx = canvas.getContext('2d'), S = o.scale || Math.min(W, H) / 46;
      const c = Math.cos(th.base || 0), s = Math.sin(th.base || 0), mx = th.mid[0], my = th.mid[1];
      const ox = c * mx - s * my, oy = s * mx + c * my, k = d * S;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(c * k, s * k, -s * k, c * k, (W / 2 - ox * S) * d, (H / 2 - oy * S) * d);
      th.sprite(ctx, { dpr: k, t: o.t == null ? 0.6 : o.t, vis: 1, size: 1 }, o.state || (th.init ? th.init() : {}));
    },
  };
  root.AnimeCursor = AnimeCursor;

  // <script src="anime-cursor.js" data-theme="skyblade" data-size="1.2" data-density="0.8">
  const cs = document.currentScript;
  if (cs && cs.hasAttribute('data-theme')) {
    const go = () => {
      root.animeCursor = AnimeCursor.init({
        theme: cs.getAttribute('data-theme') || 'skyblade',
        size: parseFloat(cs.getAttribute('data-size')) || 1,
        density: parseFloat(cs.getAttribute('data-density')) || 1,
      });
    };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }
})(typeof window !== 'undefined' ? window : this);


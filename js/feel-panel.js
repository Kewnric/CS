/* ============================================================
   FEEL-PANEL.JS — one button for how the attempt screen feels
   ------------------------------------------------------------
   Typing sound, letter animation and background motion each had their own
   36px button in the topbar, and each kept its options behind that button.
   Measured, the right-hand cluster wanted 671px for nine controls and 718px
   for ten once a cheat sheet existed — six of them identical icons with no
   grouping, in a strip that also has to hold the boss bar, a timer and two
   actions.

   They are one decision: what this screen is like to sit in front of. So they
   are one button and one panel.

   ONE SECTION AT A TIME, PAGED. Stacked, the three ran to 643px of content and
   had to scroll below roughly an 830px viewport — the third sat under the fold,
   and a panel that hides its scrollbar hides that there is a third at all.
   Paged, each is short enough to read whole, the header says which of three you
   are on, and nothing is out of sight.

   IT ALSO SETTLES THE TOGGLE-VERSUS-PANEL CONFLICT. The old buttons toggled
   their effect on click while their panel opened on :hover, and the panel sits
   directly under the button you must cross to reach it. Clicking to open one
   therefore also switched the effect off. Ambient had already been moved to
   click-to-open with an Off row inside; this does the same for the other two,
   so every option including Off is a row you pick, and the button's only job
   is to open the panel.
   ============================================================ */

function _feelIsOn() {
  const sfx = typeof sfxEnabled === 'function' && sfxEnabled() &&
              (typeof sfxVolume !== 'function' || sfxVolume() > 0);
  const letters = typeof edfxEnabled === 'function' && edfxEnabled();
  const amb = typeof ambEnabled === 'function' && ambEnabled();
  return { sfx, letters, amb, any: sfx || letters || amb };
}

/** One row. Every option in this panel is one of these, Off included. */
function _feelOpt(o) {
  return '<button type="button" class="feel-opt' + (o.on ? ' is-on' : '') + '"'
       + (o.id ? ' id="' + o.id + '"' : '')
       + ' onclick="' + o.onclick + '" aria-pressed="' + !!o.on + '"'
       + ' title="' + escapeHTML(o.title || o.name) + '">'
       + '<span class="feel-opt-name">' + escapeHTML(o.name) + '</span>'
       + (o.hint ? '<span class="feel-opt-hint">' + escapeHTML(o.hint) + '</span>' : '')
       + '</button>';
}

/* ── The three pages ──────────────────────────────────────── */

/** Typing sound: volume, voice, and Off. */
function _feelSfxRows() {
  if (typeof sfxEnabled !== 'function') return '';
  const on = sfxEnabled();
  const vol = Math.round((typeof sfxVolume === 'function' ? sfxVolume() : 0.5) * 100);
  const voices = (typeof SFX_VOICE_ORDER !== 'undefined' && typeof SFX_VOICES !== 'undefined')
    ? SFX_VOICE_ORDER.map(id => _feelOpt({
        name: SFX_VOICES[id].label,
        hint: SFX_VOICES[id].hint,
        on: on && typeof sfxVoiceId === 'function' && sfxVoiceId() === id,
        onclick: "feelPickVoice('" + id + "')"
      })).join('')
    : '';
  /* The slider is left out of the re-render on input — see feelSync — because
     rebuilding the panel under a held thumb would drop the drag. */
  const slider = '<div class="feel-vol-row">'
    + '<input type="range" id="sfx-vol" class="sfx-vol-range" min="0" max="150" step="5"'
    + ' value="' + vol + '" aria-label="Typing sound volume"'
    + ' oninput="sfxSetVolume(this.value / 100)">'
    + '<span class="sfx-vol-label" id="sfx-vol-label">' + vol + '%</span></div>';
  return slider + voices + _feelOpt({
    name: 'Off', hint: 'no sound as you type', on: !on,
    title: 'Silence the typing sound',
    onclick: 'if (sfxEnabled()) toggleTypingSfx();'
  });
}

/** Letter animation: the style switches, and Off. */
function _feelLettersRows() {
  if (typeof edfxEnabled !== 'function') return '';
  const on = edfxEnabled();
  const overlay = typeof edfxOverlayMode === 'function' && edfxOverlayMode();
  const tilt = typeof edfxTiltOn === 'function' ? edfxTiltOn() : true;
  const blur = typeof edfxBlurOn === 'function' ? edfxBlurOn() : true;
  return _feelOpt({ name: 'Overlay style', hint: 'a copy over the text, both visible',
                    on: on && overlay, onclick: "feelPickLetters('overlay')",
                    title: 'Draw the letter as a copy over the text, the way it was before' })
       + _feelOpt({ name: 'No tilt', hint: 'letters land upright',
                    on: on && !tilt, onclick: "feelPickLetters('tilt')",
                    title: 'Land every letter upright, with no lean' })
       + _feelOpt({ name: 'No blur', hint: 'letters land sharp, not resolving',
                    on: on && !blur, onclick: "feelPickLetters('blur')",
                    title: 'Land every letter sharp, with no soft start' })
       + _feelOpt({ name: 'Off', hint: 'letters just appear', on: !on,
                    title: 'Stop animating letters as you type',
                    onclick: 'if (edfxEnabled()) toggleEditorFx();' });
}

/** Background motion: the themes, and Off. */
function _feelAmbRows() {
  if (typeof AMB_THEMES === 'undefined') return '';
  const on = typeof ambEnabled === 'function' && ambEnabled();
  const current = typeof ambTheme === 'function' ? ambTheme() : '';
  return AMB_THEMES.map(t => _feelOpt({
      name: t.name, hint: t.hint, on: on && t.id === current,
      onclick: "setAmbTheme('" + t.id + "')"
    })).join('')
    + _feelOpt({ name: 'Off', hint: 'no motion behind the panes', on: !on,
                 title: 'Stop the background motion entirely',
                 onclick: 'if (ambEnabled()) toggleAmbient();' })
    /* The HUD is background too -- decoration behind the work rather than a
       theme, so it belongs on this page and not on a button of its own. It is
       a switch rather than one of a set, so it sits below them. */
    + (typeof hudEnabled === 'function'
        ? _feelOpt({ name: 'HUD chrome', hint: 'frame, brackets and scan lines',
                     on: hudEnabled(), onclick: 'toggleHud()',
                     title: 'Decorative HUD over the whole window' })
        : '');
}

/* Order is the order you meet them: the sound you hear as you type, then what
   the text does, then what is behind it. */
const FEEL_PAGES = [
  { id: 'sound',   title: 'Typing sound',     rows: _feelSfxRows,
    icon: () => (typeof sfxEnabled === 'function' && sfxEnabled()) ? 'volume-2' : 'volume-x' },
  { id: 'letters', title: 'Letter animation', rows: _feelLettersRows,
    icon: () => (typeof edfxEnabled === 'function' && edfxEnabled()) ? 'sparkles' : 'sparkle' },
  { id: 'back',    title: 'Background',       rows: _feelAmbRows,
    icon: () => {
      if (typeof ambEnabled !== 'function' || !ambEnabled()) return 'square';
      const cur = typeof ambTheme === 'function' ? ambTheme() : '';
      const t = (typeof AMB_THEMES !== 'undefined') && AMB_THEMES.find(x => x.id === cur);
      return (t && t.icon) || 'sparkles';
    } }
];

/* Kept across opens on purpose. Coming back to the page you were last on is
   almost always where you want to be, and it is three pages, so nobody gets
   lost being returned to one of them. */
let _feelPage = 0;

/** Step between pages. Wraps: at three, a dead end at either edge is just a
    control that sometimes does nothing. */
function feelPageGo(delta) {
  const n = FEEL_PAGES.length;
  _feelPage = ((_feelPage + delta) % n + n) % n;
  feelSync();
}

/** Jump straight to one, from the dots. */
function feelPageSet(i) {
  if (i < 0 || i >= FEEL_PAGES.length) return;
  _feelPage = i;
  feelSync();
}

/* ── Options also switch their thing back on ──────────────────
   The same rule setAmbTheme already followed, where choosing a look says you
   want to see it. Without it the Off rows were a trapdoor: turning letters or
   sound off left their remaining rows inert, with nothing in the panel able to
   undo it. */
function feelPickLetters(which) {
  if (typeof edfxEnabled !== 'function') return;
  if (!edfxEnabled()) {
    // First click turns it on and keeps the style you already had; adjusting
    // the style is the second click, so one press never does two things.
    if (typeof toggleEditorFx === 'function') toggleEditorFx();
  } else if (which === 'overlay' && typeof toggleEditorFxOverlay === 'function') {
    toggleEditorFxOverlay();
  } else if (which === 'tilt' && typeof toggleEditorFxTilt === 'function') {
    toggleEditorFxTilt();
  } else if (which === 'blur' && typeof toggleEditorFxBlur === 'function') {
    toggleEditorFxBlur();
  }
  feelSync();
}

/* A voice names itself, so there is no ambiguity in turning the sound on and
   selecting it at once. */
function feelPickVoice(id) {
  if (typeof sfxEnabled === 'function' && !sfxEnabled() && typeof toggleTypingSfx === 'function') {
    toggleTypingSfx();
  }
  if (typeof sfxPickVoice === 'function') sfxPickVoice(id);
  feelSync();
}

/** The header is the pager: which page you are on, and the way to the next. */
function _feelHeaderHTML() {
  const page = FEEL_PAGES[_feelPage];
  const dots = FEEL_PAGES.map((p, i) =>
    '<button type="button" class="feel-dot' + (i === _feelPage ? ' is-on' : '') + '"'
    + ' onclick="feelPageSet(' + i + ')" title="' + escapeHTML(p.title) + '"'
    + ' aria-label="' + escapeHTML(p.title) + '"'
    + ' aria-current="' + (i === _feelPage) + '"></button>').join('');
  return '<div class="feel-head">'
       + '<button type="button" class="feel-nav" onclick="feelPageGo(-1)"'
       + ' title="Previous section" aria-label="Previous section">'
       + '<i data-lucide="chevron-left"></i></button>'
       + '<span class="feel-head-title"><i data-lucide="' + page.icon() + '"></i>'
       + '<span>' + escapeHTML(page.title) + '</span></span>'
       + '<button type="button" class="feel-nav" onclick="feelPageGo(1)"'
       + ' title="Next section" aria-label="Next section">'
       + '<i data-lucide="chevron-right"></i></button>'
       + '</div>'
       + '<div class="feel-dots" role="tablist" aria-label="Section">' + dots + '</div>';
}

function feelPanelBodyHTML() {
  return _feelHeaderHTML()
       + '<div class="feel-page">' + FEEL_PAGES[_feelPage].rows() + '</div>';
}

/**
 * Repaint the panel in place.
 *
 * Every option here is generated, so rather than three modules each reaching
 * for their own button and their own rows, one rebuild covers all of them.
 * The three original _sync*Btn() functions still run and now find no button;
 * they all guard with `if (!btn) return`, so they are harmless no-ops.
 */
function feelSync() {
  const pop = document.getElementById('feel-pop');
  if (!pop) return;
  /* Not while the volume slider is being dragged: replacing the input under a
     held thumb ends the drag and the value stops following the pointer. */
  if (document.activeElement && document.activeElement.id === 'sfx-vol') return;
  const scroller = pop.querySelector('.feel-scroll') || pop;
  scroller.innerHTML = feelPanelBodyHTML();
  _feelFades();
  const btn = document.getElementById('feel-btn');
  if (btn) {
    const s = _feelIsOn();
    const label = 'Feel — typing sound ' + (s.sfx ? 'on' : 'off')
                + ', letters ' + (s.letters ? 'on' : 'off')
                + ', background ' + (s.amb ? 'on' : 'off');
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.style.color = s.any ? 'var(--color-primary)' : '';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: pop });
}

/* Which edge is faded. A page should fit whole now, but a short window can
   still cut one off, and the panel hides its scrollbar. */
function _feelFades() {
  const pop = document.getElementById('feel-pop');
  const sc = pop && pop.querySelector('.feel-scroll');
  if (!pop || !sc) return;
  const more = sc.scrollHeight - sc.clientHeight;
  pop.classList.toggle('can-up', sc.scrollTop > 2);
  pop.classList.toggle('can-down', more > 2 && sc.scrollTop < more - 2);
}

/** Left and right step through the pages while the panel is open. */
function _feelKey(e) {
  const ctl = document.querySelector('.feel-control.is-open');
  if (!ctl) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); feelPageGo(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); feelPageGo(-1); }
  else if (e.key === 'Escape') {
    e.preventDefault();
    ctl.classList.remove('is-open');
    const b = document.getElementById('feel-btn');
    if (b) { b.setAttribute('aria-expanded', 'false'); b.focus({ preventScroll: true }); }
  }
}

/** Click opens it, and only opens it. Nothing is switched by the trigger. */
function toggleFeelMenu(ev) {
  if (ev) ev.stopPropagation();
  const btn = document.getElementById('feel-btn');
  const control = btn && btn.closest('.js-hold-pop');
  if (!control) return;
  const open = !control.classList.contains('is-open');
  document.querySelectorAll('.js-hold-pop.is-open').forEach(c => c.classList.remove('is-open'));
  control.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
  document.removeEventListener('keydown', _feelKey, true);
  if (open) {
    feelSync();
    document.addEventListener('keydown', _feelKey, true);
    const sc = document.querySelector('#feel-pop .feel-scroll');
    if (sc && !sc._feelBound) {
      sc._feelBound = true;
      sc.addEventListener('scroll', _feelFades, { passive: true });
    }
  }
}

function feelButtonTemplate() {
  const s = _feelIsOn();
  const label = 'Feel — typing sound ' + (s.sfx ? 'on' : 'off')
              + ', letters ' + (s.letters ? 'on' : 'off')
              + ', background ' + (s.amb ? 'on' : 'off');
  return '<div class="feel-control js-hold-pop">'
       + '<button class="btn btn-ghost practice-icon-btn" onclick="toggleFeelMenu(event)"'
       + ' title="' + escapeHTML(label) + '" id="feel-btn" aria-label="' + escapeHTML(label) + '"'
       + ' aria-haspopup="true" aria-expanded="false"'
       + (s.any ? ' style="color:var(--color-primary);"' : '') + '>'
       + '<i data-lucide="sliders-horizontal" style="width:16px;height:16px;" aria-hidden="true"></i>'
       + '</button>'
       + '<div class="feel-pop" id="feel-pop" role="group" aria-label="How this screen feels">'
       + '<div class="feel-scroll">' + feelPanelBodyHTML() + '</div></div></div>';
}

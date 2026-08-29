/* ============================================================
   TYPING-SFX-TUNER.JS — TEMPORARY. DELETE WHEN THE VOICE IS SETTLED.
   ------------------------------------------------------------
   A panel for dialling in the typing voice by ear instead of by measurement.

   Deliberately self-contained: it injects its own button, carries its own
   styles, and touches nothing else. Removing it is this file plus its one
   <script> tag in index.html, and nothing in typing-sfx.js needs unpicking.

   It writes straight into SFX_VOICE, so typing in the editor uses whatever the
   sliders currently say — no apply step. Values are held in localStorage while
   tuning so a reload does not lose the work.
   ============================================================ */

const SFXT_KEY = 'ssp.typingSfxTuning';

/* Where this has already been, for A/B. The ear is much better at "which of
   these two" than at "is this right", and these are the two wrong answers. */
const SFXT_PRESETS = {
  dark:    { pitch: 232, length: 0.090, formant: 980,  ceiling: 2600, weight: 0.35, glide: 0.82, q: 1.4, volume: 0.8 },
  squeaky: { pitch: 440, length: 0.072, formant: 1750, ceiling: 4600, weight: 0.15, glide: 0.82, q: 1.4, volume: 0.8 },
  current: { pitch: 270, length: 0.080, formant: 1600, ceiling: 4600, weight: 0.18, glide: 0.82, q: 1.4, volume: 1.2 }
};

const SFXT_FIELDS = [
  ['pitch',   'Pitch',    120,  520,   5,     'Hz', 'the fundamental — 165-255 is where a woman speaks'],
  ['formant', 'Formant',  500,  2600,  25,    'Hz', 'the bandpass centre — this is what reads as bright or dark'],
  ['ceiling', 'Ceiling',  1500, 8000,  100,   'Hz', 'lowpass above the formant; too low and it dulls everything'],
  ['weight',  'Weight',   0,    0.60,  0.01,  '',   'the octave-down sine — weight is what sounds sinister'],
  ['length',  'Length',   0.03, 0.16,  0.005, 's',  'how long one blip lasts'],
  ['glide',   'Glide',    0.60, 1.00,  0.01,  '',   'where the pitch falls to; 1.0 is a flat beep'],
  ['q',       'Formant Q', 0.5, 5.0,   0.1,   '',   'how sharp the formant is — higher is more nasal'],
  ['volume',  'Volume',   0.2,  2.5,   0.05,  '',   'output level']
];

function sfxtLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem(SFXT_KEY));
    if (saved) Object.keys(saved).forEach(k => { if (k in SFX_VOICE) SFX_VOICE[k] = saved[k]; });
  } catch (e) { /* nothing saved */ }
}

function sfxtPersist() {
  try { localStorage.setItem(SFXT_KEY, JSON.stringify(SFX_VOICE)); } catch (e) { /* full */ }
}

/** The line to screenshot. */
function sfxtReadout() {
  return SFXT_FIELDS.map(f => {
    const v = SFX_VOICE[f[0]];
    const shown = f[4] < 1 ? v.toFixed(f[4] < 0.01 ? 3 : 2) : String(Math.round(v));
    return f[1].padEnd(10) + String(shown).padStart(7) + (f[5] ? ' ' + f[5] : '');
  }).join('\n');
}

function sfxtPaint() {
  SFXT_FIELDS.forEach(f => {
    const slider = document.getElementById('sfxt-' + f[0]);
    const num = document.getElementById('sfxt-val-' + f[0]);
    if (slider) slider.value = SFX_VOICE[f[0]];
    if (num) num.textContent = (f[4] < 1 ? SFX_VOICE[f[0]].toFixed(f[4] < 0.01 ? 3 : 2)
                                         : Math.round(SFX_VOICE[f[0]])) + (f[5] ? ' ' + f[5] : '');
  });
  const out = document.getElementById('sfxt-readout');
  if (out) out.textContent = sfxtReadout();
  const js = document.getElementById('sfxt-json');
  if (js) js.textContent = JSON.stringify(SFX_VOICE);
}

function sfxtSet(field, value) {
  SFX_VOICE[field] = parseFloat(value);
  if (field === 'volume' && typeof _sfxBus !== 'undefined' && _sfxBus) _sfxBus.gain.value = SFX_VOICE.volume;
  sfxtPersist();
  sfxtPaint();
}

function sfxtPreset(name) {
  Object.assign(SFX_VOICE, SFXT_PRESETS[name]);
  if (typeof _sfxBus !== 'undefined' && _sfxBus) _sfxBus.gain.value = SFX_VOICE.volume;
  sfxtPersist();
  sfxtPaint();
  sfxtTest();
}

/** A short phrase rather than one blip — a single blip tells you very little. */
function sfxtTest() {
  const keys = ['a', 'b', 'c', ' ', 'd', 'e', 'f', 'g', 'Enter', 'Backspace'];
  keys.forEach((k, i) => setTimeout(() => {
    const v = sfxKeyVoice(k);
    sfxBlip(v[0], v[1], v[2]);
  }, i * 105));
}

function sfxtToggle() {
  const p = document.getElementById('sfxt-panel');
  if (p) { p.remove(); return; }
  sfxtOpen();
}

function sfxtOpen() {
  const wrap = document.createElement('div');
  wrap.id = 'sfxt-panel';
  wrap.innerHTML = `
    <style>
      #sfxt-panel{position:fixed;top:64px;right:16px;width:340px;z-index:9999;
        background:#14121c;border:2px solid #3d3650;border-radius:10px;
        box-shadow:0 18px 50px rgba(0,0,0,.6);color:#efeaf5;
        font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;
        max-height:calc(100vh - 90px);overflow:auto;}
      #sfxt-panel header{display:flex;align-items:center;gap:8px;padding:10px 12px;
        border-bottom:1px solid #2a2536;position:sticky;top:0;background:#14121c;z-index:2;}
      #sfxt-panel header b{flex:1;font-size:12px;letter-spacing:.06em;}
      #sfxt-panel header button{background:#2a2536;border:1px solid #3d3650;color:#efeaf5;
        border-radius:5px;padding:3px 8px;cursor:pointer;font:inherit;}
      #sfxt-panel header button:hover{background:#3d3650;}
      .sfxt-row{padding:6px 12px;border-bottom:1px solid #1d1a28;}
      .sfxt-top{display:flex;align-items:baseline;gap:6px;}
      .sfxt-top label{flex:1;color:#c9c2d8;}
      .sfxt-top output{font-weight:700;color:#7ee8e0;min-width:74px;text-align:right;}
      .sfxt-row input[type=range]{width:100%;margin:4px 0 0;accent-color:#7ee8e0;}
      .sfxt-hint{color:#7c7490;font-size:10px;line-height:1.3;margin-top:2px;}
      .sfxt-acts{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;}
      .sfxt-acts button{flex:1;min-width:74px;background:#2a2536;border:1px solid #3d3650;
        color:#efeaf5;border-radius:5px;padding:6px;cursor:pointer;font:inherit;}
      .sfxt-acts button:hover{background:#3d3650;}
      .sfxt-acts button.primary{background:#7ee8e0;color:#14121c;border-color:#7ee8e0;font-weight:700;}
      /* Pinned under the header: this is the block that gets screenshotted,
         and having to scroll a panel to read your own settings is silly. */
      #sfxt-readout{margin:0;padding:10px 12px;background:#0d0a14;
        border-bottom:1px solid #2a2536;position:sticky;top:39px;z-index:2;
        white-space:pre;font-size:13px;line-height:1.5;color:#ffd166;}
      .sfxt-acts-top{position:sticky;top:calc(39px + 143px);z-index:2;background:#14121c;
        border-bottom:1px solid #2a2536;}
      #sfxt-json{display:block;padding:8px 12px;background:#0d0a14;color:#7c7490;
        font-size:10px;word-break:break-all;border-top:1px solid #1d1a28;}
    </style>
    <header>
      <b>TYPING VOICE — TEMPORARY</b>
      <button onclick="sfxtTest()">Test</button>
      <button onclick="sfxtToggle()">✕</button>
    </header>
    <pre id="sfxt-readout"></pre>
    <div class="sfxt-acts sfxt-acts-top">
      <button onclick="sfxtPreset('dark')">A/B dark</button>
      <button onclick="sfxtPreset('squeaky')">A/B squeaky</button>
      <button onclick="sfxtPreset('current')">Reset</button>
      <button class="primary" onclick="sfxtTest()">▶ Play phrase</button>
    </div>
    ${SFXT_FIELDS.map(f => `
      <div class="sfxt-row">
        <div class="sfxt-top">
          <label for="sfxt-${f[0]}">${f[1]}</label>
          <output id="sfxt-val-${f[0]}"></output>
        </div>
        <input type="range" id="sfxt-${f[0]}" min="${f[2]}" max="${f[3]}" step="${f[4]}"
               oninput="sfxtSet('${f[0]}', this.value)">
        <div class="sfxt-hint">${f[6]}</div>
      </div>`).join('')}
    <code id="sfxt-json"></code>`;
  document.body.appendChild(wrap);
  sfxtPaint();
}

/** The button, injected rather than added to the route templates — one less
    thing to unpick when this comes out. */
function sfxtInjectButton() {
  if (!sfxRouteWantsSound()) return;
  const bar = document.querySelector('.practice-topbar-right');
  if (!bar || document.getElementById('sfxt-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'sfxt-btn';
  btn.className = 'btn btn-ghost practice-icon-btn';
  btn.title = 'Tune the typing voice (temporary)';
  btn.setAttribute('aria-label', 'Tune the typing voice');
  btn.style.color = '#ffd166';
  btn.style.fontWeight = '700';
  btn.style.fontSize = '10px';
  btn.style.letterSpacing = '.06em';
  btn.textContent = 'TUNE';
  btn.onclick = sfxtToggle;
  const anchor = document.getElementById('typing-sfx-btn');
  if (anchor && anchor.nextSibling) bar.insertBefore(btn, anchor.nextSibling);
  else bar.appendChild(btn);
}

sfxtLoad();

/* The topbar is rebuilt on every route change, so watch for it rather than
   hooking any particular init. */
new MutationObserver(() => setTimeout(sfxtInjectButton, 60))
  .observe(document.body, { attributes: true, attributeFilter: ['data-route'] });
document.addEventListener('DOMContentLoaded', () => setTimeout(sfxtInjectButton, 400));
setTimeout(sfxtInjectButton, 800);

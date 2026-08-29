/* ============================================================
   LANG-QUEST.JS — the run, and the battles along it
   ------------------------------------------------------------
   Presented the way a pixel-art visual novel is, because that is the shape
   the mode already had: a scene banner up top, a stacked menu of choices over
   it, and a dialogue box underneath that you click through.

   Everything runs off two small queues rather than a pile of view flags:

     _lq.say   — lines waiting to be read. The box shows the first, a click
                 drops it, and when the queue empties the menu appears.
     _lq.menu  — what you can do right now.

   That is the whole state machine. A turn is "push some lines, then set a
   menu", which is why the road, the encounter and the battle can share one
   renderer instead of each having their own.

   Stamina is health. A correct reply costs nothing and gives some back; a
   wrong one drains you. Beating someone raises the MAXIMUM, so a hard
   conversation buys you a longer walk.

   Backdrops and portraits are placeholders and say so.
   ============================================================ */

let _lq = null;

/* Stand-in scenery — a gradient per location, so the scene reads now and real
   art can drop into the same box later without the layout moving. */
const LQ_BACKDROPS = {
  cafeteria: { from: '#8a6fa8', mid: '#54407a', to: '#2a1f45' },
  classroom: { from: '#4d84bd', mid: '#2f5488', to: '#1a2c4d' },
  hallway:   { from: '#5f7b9c', mid: '#3a5171', to: '#1e2c40' },
  home:      { from: '#a8794c', mid: '#6b4a2e', to: '#33231a' },
  market:    { from: '#7d9c52', mid: '#4c6132', to: '#26311b' },
  street:    { from: '#5a7099', mid: '#33456b', to: '#1a2338' }
};

const LQ_AUTOSKIP_KEY = 'lang.autoskip';

function lqAutoSkip() {
  try { return localStorage.getItem(LQ_AUTOSKIP_KEY) === '1'; } catch (e) { return false; }
}

function lqToggleAutoSkip() {
  try { localStorage.setItem(LQ_AUTOSKIP_KEY, lqAutoSkip() ? '0' : '1'); } catch (e) { /* private */ }
  lqRender();
  if (lqAutoSkip()) lqScheduleAuto();
}

function langQuestTemplate() {
  return `
    <div class="lq-shell" id="lq-shell">
      <div class="lq-frame">
        <div class="lq-topline">
          <div class="lq-daytag"><span class="lq-moon">☾</span><span id="lq-daylabel">RUN</span></div>
          <div class="lq-stats" id="lq-stats"></div>
        </div>
        <div class="lq-scene" id="lq-scene"></div>
        <div class="lq-speaker" id="lq-speaker"></div>
        <div class="lq-boxwrap">
          <button class="lq-autoskip" id="lq-autoskip" type="button" onclick="lqToggleAutoSkip()">
            <span class="lq-check"></span> AUTO-SKIP
          </button>
          <div class="lq-box" id="lq-box" onclick="lqAdvance()"></div>
        </div>
      </div>
    </div>`;
}

function langQuestInit() {
  langStore();
  const mode = getSessionParam('langRunMode') || 'run';
  const scId = getSessionParam('langRunScenario');

  _lq = {
    mode, scene: 'road', location: 'street',
    stamina: LANG_RUN_STAMINA, staminaMax: LANG_RUN_STAMINA,
    power: 0, powerMax: 100,
    potions: LANG_POTIONS.map(p => Object.assign({ owned: 1 }, p)),
    steps: 0, defeated: 0, fled: 0, correct: 0, asked: 0,
    enemy: null, turn: 0, removed: [], doubleNext: false,
    say: [], menu: null, autoTimer: null,
    startTime: Date.now()
  };
  document.title = (mode === 'scenario' ? 'Scenario' : 'Free run') + ' — StudySession Pro';

  if (mode === 'scenario') {
    const sc = scId ? langFindScenario(scId) : null;
    const ready = (e) => (e.line || '').trim() && (e.options || []).some(o => (o.text || '').trim() && o.correct);
    if (!sc || !(sc.encounters || []).some(ready)) { spaNavigate('language'); return; }
    _lq.location = sc.location || 'street';
    _lq.stamina = _lq.staminaMax = sc.playerHp || LANG_RUN_STAMINA;
    _lq.power = sc.playerMana || 0;
    _lq.enemy = {
      name: sc.npc || 'Stranger', location: _lq.location,
      hp: sc.npcHp || 100, hpMax: sc.npcHp || 100,
      turns: (sc.encounters || []).filter(ready).map(e => ({
        situation: e.situation || '', line: e.line,
        options: langShuffle((e.options || []).filter(o => (o.text || '').trim())),
        damage: e.damage || 25, backlash: e.backlash || 20
      }))
    };
    _lq.scene = 'battle';
    lqSay(null, lqMeetLine(_lq.enemy));
    lqBeginTurn();
  } else {
    if (langRunBlocker()) { spaNavigate('language'); return; }
    langResetEnemyBag();   // every run deals the cast from the top
    lqSay('You', 'A whole evening, and nothing decided yet.');
    lqRoadMenu();
  }
  lqRender();
}

function langQuestDestroy() { lqClearAuto(); _lq = null; }

function lqExit() {
  if (!_lq || _lq.scene === 'over') { spaNavigate('language'); return; }
  showConfirm('Leave?', 'This run will not be saved.', () => { lqClearAuto(); _lq = null; spaNavigate('language'); });
}

/* ── The two queues ───────────────────────────────────────── */

/** "You encountered Ate Marites!" but "You encountered a stranger!" */
function lqMeetLine(enemy) {
  return enemy.common
    ? 'You encountered a {' + enemy.name + '}!'
    : 'You encountered {' + enemy.name + '}!';
}

/** Queue a line. {name} inside the text is highlighted, as an enemy name is. */
function lqSay(who, text, cls) {
  if (!_lq) return;
  _lq.say.push({ who: who || null, text: text, cls: cls || '' });
  _lq.menu = null;
}

function lqMenu(items) {
  if (!_lq) return;
  _lq.menu = items;
}

/** Click the box: drop the current line, and show the menu once they run out. */
function lqAdvance() {
  if (!_lq || !_lq.say.length) return;
  _lq.say.shift();
  if (!_lq.say.length && _lq.pending) {
    const fn = _lq.pending;
    _lq.pending = null;
    fn();
  }
  lqRender();
}

/** Run something once the queued lines have all been read. */
function lqThen(fn) { if (_lq) _lq.pending = fn; }

function lqScheduleAuto() {
  lqClearAuto();
  if (!_lq || !lqAutoSkip() || !_lq.say.length) return;
  _lq.autoTimer = setTimeout(() => { _lq && lqAdvance(); }, 1400);
}

function lqClearAuto() {
  if (_lq && _lq.autoTimer) { clearTimeout(_lq.autoTimer); _lq.autoTimer = null; }
}


/* ── The scene ────────────────────────────────────────────────
   Drawn as SVG rather than stacked CSS gradients. The gradient version came
   out as a bar chart — evenly spaced identical stripes, because that is all a
   repeating-linear-gradient can be. A skyline needs uneven heights, uneven
   gaps and windows that do not line up, and that means real shapes.

   Every location gets its own layout from a seeded generator, so a place
   looks the same each time you are there without any of it being hand-drawn,
   and the whole thing is cached per location.
   ------------------------------------------------------------ */

const _lqSceneCache = {};

/** Deterministic per location, so a place keeps its own skyline. */
function _lqRng(key) {
  let seed = 2166136261;
  for (let i = 0; i < key.length; i++) {
    seed ^= key.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return function () {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17;
    seed ^= seed << 5;  seed >>>= 0;
    return seed / 4294967296;
  };
}

/* What sits in the foreground, per location — the one thing that makes a
   cafeteria read as a cafeteria and not as another street. */
const LQ_FOREGROUND = {
  cafeteria: 'tables',
  classroom: 'desks',
  hallway:   'lockers',
  home:      'rail',
  market:    'stalls',
  street:    'lamps'
};

function lqSceneArt(loc, bd) {
  if (_lqSceneCache[loc.key]) return _lqSceneCache[loc.key];
  const rnd = _lqRng(loc.key);
  const W = 1000, H = 400, HORIZON = 250;

  // ── stars ──
  let stars = '';
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = rnd() * (HORIZON - 70);
    const r = rnd() < 0.82 ? 1.1 : 1.9;
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" opacity="${(0.25 + rnd() * 0.55).toFixed(2)}"/>`;
  }

  // ── far skyline: pale, low contrast, no windows ──
  let far = '';
  let x = -20;
  while (x < W + 20) {
    const w = 34 + rnd() * 62;
    const h = 40 + rnd() * 78;
    far += `<rect x="${x.toFixed(0)}" y="${(HORIZON - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 30).toFixed(0)}"/>`;
    x += w + rnd() * 14;
  }

  // ── near skyline: taller, darker, lit windows ──
  let near = '', windows = '';
  x = -30;
  while (x < W + 30) {
    const w = 46 + rnd() * 74;
    const h = 70 + rnd() * 132;
    const top = HORIZON - h;
    near += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 30).toFixed(0)}"/>`;
    // A roof box on some of them, so the tops are not all flat.
    if (rnd() < 0.34) {
      const rw = 10 + rnd() * 16;
      near += `<rect x="${(x + w / 2 - rw / 2).toFixed(0)}" y="${(top - 16).toFixed(0)}" width="${rw.toFixed(0)}" height="18"/>`;
    }
    // Windows on a grid, most of them dark.
    for (let wy = top + 12; wy < HORIZON - 10; wy += 17) {
      for (let wx = x + 8; wx < x + w - 10; wx += 15) {
        if (rnd() < 0.34) {
          windows += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="6" height="8" fill="#ffd98a" opacity="${(0.35 + rnd() * 0.5).toFixed(2)}"/>`;
        }
      }
    }
    x += w + 4 + rnd() * 20;
  }

  // ── foreground, per location ──
  let fg = '';
  const kind = LQ_FOREGROUND[loc.key] || 'lamps';
  if (kind === 'lamps' || kind === 'stalls') {
    for (let i = 0; i < 4; i++) {
      const lx = 80 + i * 260 + rnd() * 50;
      fg += `<rect x="${lx}" y="${HORIZON - 78}" width="5" height="118" fill="#0b0812" opacity="0.85"/>`
         +  `<circle cx="${(lx + 2.5).toFixed(0)}" cy="${HORIZON - 82}" r="9" fill="#ffd98a" opacity="0.9"/>`
         +  `<circle cx="${(lx + 2.5).toFixed(0)}" cy="${HORIZON - 82}" r="26" fill="#ffd98a" opacity="0.12"/>`;
      if (kind === 'stalls') {
        fg += `<rect x="${lx - 58}" y="${HORIZON + 6}" width="120" height="9" fill="#0b0812" opacity="0.8"/>`;
      }
    }
  } else if (kind === 'tables') {
    for (let i = 0; i < 3; i++) {
      const tx = 90 + i * 330;
      fg += `<rect x="${tx}" y="${HORIZON + 34}" width="200" height="11" fill="#0b0812" opacity="0.82"/>`
         +  `<rect x="${tx + 16}" y="${HORIZON + 45}" width="8" height="46" fill="#0b0812" opacity="0.82"/>`
         +  `<rect x="${tx + 176}" y="${HORIZON + 45}" width="8" height="46" fill="#0b0812" opacity="0.82"/>`;
    }
  } else if (kind === 'desks') {
    for (let i = 0; i < 4; i++) {
      const dx = 60 + i * 250;
      fg += `<rect x="${dx}" y="${HORIZON + 40}" width="150" height="10" fill="#0b0812" opacity="0.82"/>`
         +  `<rect x="${dx + 10}" y="${HORIZON + 50}" width="7" height="40" fill="#0b0812" opacity="0.82"/>`
         +  `<rect x="${dx + 133}" y="${HORIZON + 50}" width="7" height="40" fill="#0b0812" opacity="0.82"/>`;
    }
  } else if (kind === 'lockers') {
    for (let i = 0; i < 14; i++) {
      fg += `<rect x="${i * 74}" y="${HORIZON - 54}" width="62" height="96" fill="#0b0812" opacity="0.55"/>`
         +  `<rect x="${i * 74 + 44}" y="${HORIZON - 16}" width="8" height="3" fill="#ffd98a" opacity="0.35"/>`;
    }
  } else if (kind === 'rail') {
    fg += `<rect x="0" y="${HORIZON + 30}" width="${W}" height="7" fill="#0b0812" opacity="0.8"/>`;
    for (let i = 0; i < 18; i++) {
      fg += `<rect x="${i * 58 + 12}" y="${HORIZON + 37}" width="5" height="34" fill="#0b0812" opacity="0.8"/>`;
    }
  }

  const svg = `
    <svg class="lq-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="lqsky-${loc.key}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${bd.from}"/>
          <stop offset="62%" stop-color="${bd.mid}"/>
          <stop offset="100%" stop-color="${bd.to}"/>
        </linearGradient>
        <linearGradient id="lqground-${loc.key}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${bd.to}"/>
          <stop offset="100%" stop-color="#07050c"/>
        </linearGradient>
        <radialGradient id="lqglow-${loc.key}" cx="50%" cy="58%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="${W}" height="${H}" fill="url(#lqsky-${loc.key})"/>
      <g>${stars}</g>
      <circle cx="828" cy="66" r="30" fill="#fdf3d0" opacity="0.92"/>
      <circle cx="814" cy="58" r="27" fill="${bd.from}" opacity="0.96"/>
      <rect y="${HORIZON - 130}" width="${W}" height="${130}" fill="url(#lqglow-${loc.key})"/>

      <g fill="#0d0a16" opacity="0.42">${far}</g>
      <g fill="#0a0712" opacity="0.86">${near}</g>
      <g>${windows}</g>

      <rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#lqground-${loc.key})"/>
      <rect y="${HORIZON}" width="${W}" height="2" fill="#ffffff" opacity="0.09"/>
      <g>${fg}</g>
    </svg>`;

  _lqSceneCache[loc.key] = svg;
  return svg;
}

/* ── Render ───────────────────────────────────────────────── */

function lqRender() {
  if (!_lq) return;
  const shell = document.getElementById('lq-shell');
  const scene = document.getElementById('lq-scene');
  const stats = document.getElementById('lq-stats');
  const speaker = document.getElementById('lq-speaker');
  const box = document.getElementById('lq-box');
  const day = document.getElementById('lq-daylabel');
  const auto = document.getElementById('lq-autoskip');
  if (!scene || !box) return;

  const loc = langLocation(_lq.location);
  const bd = LQ_BACKDROPS[loc.key] || LQ_BACKDROPS.street;
  if (day) day.textContent = _lq.scene === 'battle' ? 'BATTLE' : _lq.scene === 'over' ? 'DONE' : 'RUN';
  if (auto) auto.classList.toggle('is-on', lqAutoSkip());

  if (stats) {
    // Labelled. An unlabelled "▮3" beside the stamina read as a second
    // stamina figure, which made the maximum look like it was climbing on
    // its own — it only ever rises when you beat someone, and now says so.
    const grown = _lq.staminaMax > LANG_RUN_STAMINA;
    stats.innerHTML = `
      <span class="lq-stat"><b class="lq-ico-st">⚡</b>STA ${Math.max(0, Math.round(_lq.stamina))}/${_lq.staminaMax}${
        grown ? `<em class="lq-grown" title="${_lq.staminaMax - LANG_RUN_STAMINA - _lq.defeated * LANG_RUN_STAMINA_GAIN} from clear blocks, ${_lq.defeated * LANG_RUN_STAMINA_GAIN} from conversations won">+${_lq.staminaMax - LANG_RUN_STAMINA}</em>` : ''}</span>
      <span class="lq-stat"><b class="lq-ico-pw">✦</b>PWR ${Math.round(_lq.power)}%</span>
      <span class="lq-stat"><b class="lq-ico-wk">▮</b>BLOCKS ${_lq.steps}</span>
      ${_lq.scene === 'battle' && _lq.enemy
        ? `<span class="lq-stat lq-stat-foe"><b>♥</b>${escapeHTML(lqDisplayName(_lq.enemy))} ${Math.max(0, Math.round(_lq.enemy.hp))}/${_lq.enemy.hpMax}</span>` : ''}`;
  }

  scene.innerHTML = `
    ${lqSceneArt(loc, bd)}
    <div class="lq-scenetag">${escapeHTML(loc.name.toUpperCase())}</div>
    ${_lq.scene === 'battle' && _lq.enemy ? lqFoeHTML() : ''}
    ${_lq.scene === 'battle' && !_lq.say.length && _lq.menu === null ? lqCommandBarHTML() : ''}
    ${_lq.menu && !_lq.say.length ? lqMenuHTML() : ''}
    <div class="lq-help" title="Placeholder art — backdrops and portraits are stand-ins">?</div>`;

  const line = _lq.say[0] || null;
  if (speaker) {
    const who = line && line.who;
    speaker.innerHTML = who ? `<span class="lq-name${line.cls === 'foe' ? ' is-foe' : ''}">${escapeHTML(who)}</span>` : '';
  }
  box.innerHTML = line
    ? `<p class="lq-line">${lqMarkup(line.text)}</p>${_lq.say.length ? '<span class="lq-next">▼</span>' : '<span class="lq-next">▼</span>'}`
    : (_lq.scene === 'over' ? lqSummaryHTML() : '<p class="lq-line lq-dim">…</p>');
  box.classList.toggle('is-clickable', !!line);

  if (typeof lucide !== 'undefined' && shell) lucide.createIcons({ root: shell });
  lqScheduleAuto();
}

/** {highlighted} in a line, escaped either way. */
function lqMarkup(text) {
  return escapeHTML(String(text || '')).replace(/\{([^}]*)\}/g, '<em class="lq-hl">$1</em>');
}

/** Sentence-cased for anywhere the name stands on its own. */
function lqDisplayName(e) {
  if (!e || !e.name) return 'Stranger';
  return e.common ? e.name.charAt(0).toUpperCase() + e.name.slice(1) : e.name;
}

function lqFoeHTML() {
  const pct = Math.max(0, (_lq.enemy.hp / Math.max(1, _lq.enemy.hpMax)) * 100);
  return `
    <div class="lq-foe">
      <div class="lq-foe-art">☻</div>
      <div class="lq-foe-bar"><div class="lq-foe-fill" style="width:${pct}%;"></div></div>
    </div>`;
}

function lqMenuHTML() {
  return `<div class="lq-menu">
    ${_lq.menu.map((m, i) => `
      <button class="lq-mi${m.danger ? ' is-danger' : ''}${m.off ? ' is-off' : ''}" type="button"
              ${m.off ? 'disabled' : `onclick="lqPick(${i})"`}>${escapeHTML(m.label)}</button>`).join('')}
  </div>`;
}

/* The row of square commands, with the label appearing beside the one under
   the pointer — the way the reference does it. */
function lqCommandBarHTML() {
  const cmds = lqCommands();
  return `<div class="lq-cmdbar">
    ${cmds.map((c, i) => `
      <button class="lq-cmdicon${c.off ? ' is-off' : ''}" type="button" ${c.off ? 'disabled' : `onclick="lqCmd('${c.id}')"`}
              data-label="${escapeHTML(c.label)}" title="${escapeHTML(c.label)}">
        <span>${c.glyph}</span>
      </button>`).join('')}
    <span class="lq-cmdlabel" id="lq-cmdlabel"></span>
  </div>`;
}

function lqCommands() {
  const potions = _lq.potions.reduce((n, p) => n + p.owned, 0);
  return [
    { id: 'talk',  glyph: '💬', label: 'SPEAK UP' },
    { id: 'item',  glyph: '🧃', label: 'ITEM  ×' + potions, off: !potions },
    { id: 'power', glyph: '✦', label: 'POWER  ' + Math.round(_lq.power), off: _lq.power < Math.min(...LANG_POWERUPS.map(p => p.cost)) },
    { id: 'flee',  glyph: '🏃', label: 'FLEE FROM BATTLE  −' + LQ_FLEE_COST }
  ];
}

/**
 * Run a menu item.
 *
 * The menu is NOT cleared here. It used to be, which meant any action that
 * could decline — GO HOME, then Cancel — came back to a screen with no menu
 * and no commands, and the run was over without saying so. Actions that queue
 * lines clear it themselves through lqSay, and actions that open a submenu
 * replace it; an action that changes nothing should leave it alone.
 */
function lqPick(i) {
  if (!_lq || !_lq.menu) return;
  const m = _lq.menu[i];
  if (!m || m.off) return;
  m.fn();
}

function lqCmd(id) {
  if (!_lq) return;
  if (id === 'talk') { lqReplyMenu(); lqRender(); return; }
  if (id === 'item') { lqItemMenu(); lqRender(); return; }
  if (id === 'power') { lqPowerMenu(); lqRender(); return; }
  if (id === 'flee') { lqFlee(); return; }
}

/* ── The road ─────────────────────────────────────────────── */

function lqRoadMenu() {
  const potions = _lq.potions.reduce((n, p) => n + p.owned, 0);
  lqMenu([
    { label: 'GO FOR A RUN', fn: lqStep },
    { label: 'ITEM', off: !potions, fn: () => { lqItemMenu(); lqRender(); } },
    { label: 'POWER', fn: () => { lqPowerMenu(); lqRender(); } },
    { label: 'GO HOME', danger: true, fn: () => lqGoHome() }
  ]);
}

/**
 * One leg of the walk.
 *
 * A quiet leg used to cost six stamina and print TWO lines that both said
 * nothing had happened, so walking was three clicks to accomplish nothing and
 * watch a number go down. It gets one line now, and a quiet leg can actually
 * turn something up — a bottle somebody left, or a moment to catch your
 * breath — so the stretch between encounters is worth walking rather than
 * merely survivable.
 */
function lqStep() {
  if (!_lq) return;
  _lq.steps++;
  _lq.stamina -= LANG_RUN_STEP_COST;

  if (_lq.stamina <= 0) {
    _lq.stamina = 0;
    lqSay(null, 'Your legs are done. You have nothing left to walk on.');
    lqThen(() => lqFinish('exhausted'));
    lqRender();
    return;
  }

  // Six quiet legs in a row and the next is certain, so a run cannot stall
  // into pressing the same button at nothing.
  const forced = _lq.steps - (_lq.lastEncounterStep || 0) >= 6;
  if (forced || Math.random() < LANG_ENCOUNTER_CHANCE) {
    const enemy = langRandomEnemy(_lq.location);
    if (enemy) {
      _lq.lastEncounterStep = _lq.steps;
      _lq.enemy = enemy;
      const moved = enemy.location && enemy.location !== _lq.location;
      _lq.location = enemy.location || _lq.location;
      _lq.turn = 0; _lq.removed = [];
      // Naming the place you have walked into, the way REC does when the
      // backdrop changes — otherwise the scene swaps under you unremarked.
      if (moved) lqSay(null, 'You are currently in the {' + langLocation(_lq.location).name + '}.');
      lqSay(null, lqMeetLine(enemy));
      lqThen(() => { _lq.scene = 'battle'; lqBeginTurn(); lqRender(); });
      lqRender();
      return;
    }
  }

  // Nobody turned up, so the block was pure walking — and walking is what
  // builds the capacity to walk. Flat, and every single time: a reward you
  // have to count blocks to predict is not a reward you feel.
  _lq.staminaMax += LANG_RUN_ENDURANCE_GAIN;
  lqSay(null, LANG_RUN_FLAVOUR[Math.floor(Math.random() * LANG_RUN_FLAVOUR.length)]);
  lqSay(null, 'A clear stretch. Total stamina is now {' + _lq.staminaMax + '}.');
  lqFind();
  lqThen(() => { lqRoadMenu(); lqRender(); });
  lqRender();
}

/**
 * What a quiet block can turn up. Almost always: nothing.
 *
 * This used to fire on 62% of clear blocks, and 22% of those handed back
 * stamina — which cancelled the very drain the walk is supposed to have and
 * made a 10-point flee vanish into the noise. The shape of a run is meant to
 * be plain: the total climbs, the current falls, and once in a while you find
 * something. Roughly one block in eight now, and nothing it gives ever
 * refunds the current stamina.
 */
function lqFind() {
  const roll = Math.random();
  if (roll < 0.07) {
    const p = _lq.potions[Math.floor(Math.random() * _lq.potions.length)];
    p.owned++;
    lqSay(null, 'You notice something gleaming from the corner of your eye.');
    lqSay(null, 'Someone left a {' + p.name.toLowerCase() + '} behind. You pocket it.');
  } else if (roll < 0.12 && _lq.power < _lq.powerMax) {
    const gain = Math.min(10, _lq.powerMax - _lq.power);
    _lq.power += gain;
    lqSay(null, 'You turn a phrase over in your head. (+' + gain + ' power)');
  }
}

function lqGoHome() {
  showConfirm('Go home?', 'The run ends here and the score is kept.', () => lqFinish('home'));
}

/* ── The battle ───────────────────────────────────────────── */

function lqCurrentTurn() {
  return _lq && _lq.enemy && _lq.enemy.turns[_lq.turn % _lq.enemy.turns.length];
}

/** They speak first — always. */
function lqBeginTurn() {
  const t = lqCurrentTurn();
  if (!t) return;
  if (t.situation) lqSay(null, t.situation);
  lqSay(lqDisplayName(_lq.enemy), t.line, 'foe');
  lqThen(() => { _lq.menu = null; lqRender(); });   // falls through to the command bar
}

function lqReplyMenu() {
  const t = lqCurrentTurn();
  const opts = t.options.filter(o => (o.text || '').trim());
  lqMenu(opts.map((o, i) => ({
    label: o.text,
    off: _lq.removed.indexOf(i) > -1,
    fn: () => lqReply(i)
  })).concat([{ label: 'BACK', danger: true, fn: () => { _lq.menu = null; lqRender(); } }]));
}

function lqReply(i) {
  const t = lqCurrentTurn();
  const opts = t.options.filter(o => (o.text || '').trim());
  const o = opts[i];
  if (!o) return;

  _lq.asked++;
  const best = (opts.find(x => x.correct) || {}).text || '';
  lqSay('You', o.text);

  if (o.correct) {
    _lq.correct++;
    const dmg = (t.damage || 25) * (_lq.doubleNext ? 2 : 1);
    _lq.doubleNext = false;
    _lq.enemy.hp = Math.max(0, _lq.enemy.hp - dmg);
    const heal = Math.min(10, _lq.staminaMax - _lq.stamina);
    _lq.stamina += heal;
    _lq.power = Math.min(_lq.powerMax, _lq.power + 15);
    lqSay(null, 'It lands. {' + lqDisplayName(_lq.enemy) + '} takes ' + dmg + '.'
      + (heal ? ' You catch your breath (+' + heal + ').' : ''));
    if (o.note) lqSay(null, o.note);
  } else {
    const hurt = t.backlash || 20;
    _lq.stamina = Math.max(0, _lq.stamina - hurt);
    _lq.power = Math.min(_lq.powerMax, _lq.power + 5);
    lqSay(null, 'It falls flat. You lose ' + hurt + ' stamina.');
    if (best) lqSay(null, 'Better: {' + best + '}');
    if (o.note) lqSay(null, o.note);
  }
  lqThen(lqAfterTurn);
  lqRender();
}

function lqAfterTurn() {
  if (!_lq) return;
  _lq.removed = [];
  if (_lq.stamina <= 0) { lqFinish('exhausted'); return; }

  if (_lq.enemy.hp <= 0) {
    _lq.defeated++;
    _lq.staminaMax += LANG_RUN_STAMINA_GAIN;
    _lq.stamina = Math.min(_lq.staminaMax, _lq.stamina + LANG_RUN_STAMINA_GAIN);
    lqSay(null, '{' + lqDisplayName(_lq.enemy) + '} gives up and lets you past.');
    lqSay(null, 'Maximum stamina rises to ' + _lq.staminaMax + '.');
    if (_lq.mode === 'scenario') { lqThen(() => lqFinish('won')); lqRender(); return; }
    lqThen(() => { _lq.enemy = null; _lq.scene = 'road'; lqRoadMenu(); lqRender(); });
    lqRender();
    return;
  }

  _lq.turn++;
  if (_lq.mode === 'scenario' && _lq.turn >= _lq.enemy.turns.length) { lqFinish('scene'); return; }
  lqBeginTurn();
  lqRender();
}

/* Backing out is the expensive option: it costs more than a block of walking
   and, unlike a block of walking, it buys you no endurance at all. */
const LQ_FLEE_COST = 15;

function lqFlee() {
  if (!_lq) return;
  const before = _lq.stamina;
  _lq.stamina = Math.max(0, _lq.stamina - LQ_FLEE_COST);
  _lq.fled++;
  lqSay(null, 'You slip away before it gets awkward.');
  lqSay(null, 'Backing out took it out of you. {−' + Math.round(before - _lq.stamina)
    + ' stamina}, and no ground gained.');
  if (_lq.stamina <= 0) { lqThen(() => lqFinish('exhausted')); lqRender(); return; }
  if (_lq.mode === 'scenario') { lqThen(() => lqFinish('fled')); lqRender(); return; }
  lqThen(() => { _lq.enemy = null; _lq.scene = 'road'; lqRoadMenu(); lqRender(); });
  lqRender();
}

/* ── Bag and power, as menus rather than popups ───────────── */

function lqItemMenu() {
  const back = () => { if (_lq.scene === 'battle') { _lq.menu = null; } else { lqRoadMenu(); } lqRender(); };
  lqMenu(_lq.potions.map(p => ({
    label: p.name.toUpperCase() + '  ×' + p.owned + '  (+' + p.heal + ')',
    off: !p.owned || _lq.stamina >= _lq.staminaMax,
    fn: () => lqUsePotion(p.id)
  })).concat([{ label: 'BACK', danger: true, fn: back }]));
}

function lqUsePotion(id) {
  const p = _lq.potions.find(x => x.id === id);
  if (!p || !p.owned || _lq.stamina >= _lq.staminaMax) return;
  p.owned--;
  const before = _lq.stamina;
  _lq.stamina = Math.min(_lq.staminaMax, _lq.stamina + p.heal);
  lqSay(null, 'You take the ' + p.name.toLowerCase() + '. (+' + Math.round(_lq.stamina - before) + ' stamina)');
  lqThen(() => { if (_lq.scene === 'battle') { _lq.menu = null; } else { lqRoadMenu(); } lqRender(); });
  lqRender();
}

function lqPowerMenu() {
  const back = () => { if (_lq.scene === 'battle') { _lq.menu = null; } else { lqRoadMenu(); } lqRender(); };
  lqMenu(LANG_POWERUPS.map(p => ({
    label: p.name.toUpperCase() + '  ' + p.cost,
    off: _lq.power < p.cost || (p.id === 'insight' && _lq.scene !== 'battle'),
    fn: () => lqUsePower(p.id)
  })).concat([{ label: 'BACK', danger: true, fn: back }]));
}

function lqUsePower(id) {
  const p = langPowerup(id);
  if (!p || _lq.power < p.cost) return;
  const back = () => { if (_lq.scene === 'battle') { _lq.menu = null; } else { lqRoadMenu(); } lqRender(); };

  if (id === 'insight') {
    const t = lqCurrentTurn();
    if (!t) return;
    const opts = t.options.filter(o => (o.text || '').trim());
    const wrong = opts.map((o, i) => ({ o, i })).filter(x => !x.o.correct && _lq.removed.indexOf(x.i) === -1);
    if (!wrong.length) { lqSay(null, 'Nothing left to rule out.'); lqThen(back); lqRender(); return; }
    _lq.removed.push(wrong[Math.floor(Math.random() * wrong.length)].i);
    lqSay(null, 'The phrasebook rules one answer out.');
  } else if (id === 'secondwind') {
    if (_lq.stamina >= _lq.staminaMax) { lqSay(null, 'You are not tired yet.'); lqThen(back); lqRender(); return; }
    const before = _lq.stamina;
    _lq.stamina = Math.min(_lq.staminaMax, _lq.stamina + 30);
    lqSay(null, 'Second wind. (+' + Math.round(_lq.stamina - before) + ' stamina)');
  } else if (id === 'silvertongue') {
    if (_lq.doubleNext) { lqSay(null, 'Already primed.'); lqThen(back); lqRender(); return; }
    _lq.doubleNext = true;
    lqSay(null, 'Silver tongue. Your next good reply hits twice as hard.');
  }
  _lq.power -= p.cost;
  lqThen(back);
  lqRender();
}

/* ── Ending ───────────────────────────────────────────────── */

function lqFinish(reason) {
  if (!_lq || _lq.scene === 'over') return;
  lqClearAuto();
  _lq.scene = 'over';
  _lq.reason = reason;
  _lq.say = [];
  _lq.menu = null;
  const score = _lq.asked ? Math.round((_lq.correct / _lq.asked) * 100) : 0;
  langRecordAttempt({
    kind: _lq.mode === 'scenario' ? 'scenario' : 'run',
    refId: _lq.mode === 'scenario' ? (getSessionParam('langRunScenario') || '') : 'free',
    title: _lq.mode === 'scenario' ? 'Scenario' : 'Free run',
    score, correct: _lq.correct, total: _lq.asked,
    steps: _lq.steps, defeated: _lq.defeated, fled: _lq.fled,
    staminaLeft: Math.max(0, Math.round(_lq.stamina)), staminaMax: _lq.staminaMax,
    reason, duration: Math.round((Date.now() - _lq.startTime) / 1000)
  });
  lqRender();
}

function lqSummaryHTML() {
  const score = _lq.asked ? Math.round((_lq.correct / _lq.asked) * 100) : 0;
  const head = {
    exhausted: 'YOU RAN OUT OF STAMINA',
    home: 'YOU WENT HOME',
    won: 'CONVERSATION WON',
    fled: 'YOU SLIPPED AWAY',
    scene: 'SCENE OVER'
  }[_lq.reason] || 'RUN OVER';
  return `
    <div class="lq-end">
      <div class="lq-end-head">${escapeHTML(head)}</div>
      <div class="lq-end-grid">
        <span>REPLIES</span><b>${_lq.correct}/${_lq.asked}</b>
        <span>SCORE</span><b>${score}%</b>
        <span>BLOCKS RUN</span><b>${_lq.steps}</b>
        <span>TALKED PAST</span><b>${_lq.defeated}</b>
        <span>SLIPPED AWAY</span><b>${_lq.fled}</b>
        <span>STAMINA</span><b>${Math.max(0, Math.round(_lq.stamina))}/${_lq.staminaMax}</b>
      </div>
      <div class="lq-end-actions">
        <button class="lq-mi" type="button" onclick="lqRetry()">GO AGAIN</button>
        <button class="lq-mi is-danger" type="button" onclick="spaNavigate('language')">BACK TO LIBRARY</button>
      </div>
    </div>`;
}

function lqRetry() {
  const mode = _lq ? _lq.mode : 'run';
  const id = getSessionParam('langRunScenario');
  lqClearAuto();
  _lq = null;
  setSessionParam('langRunMode', mode);
  setSessionParam('langRunScenario', id);
  langQuestInit();
}

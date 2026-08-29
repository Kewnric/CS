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
    lqSay(null, 'You encountered a {' + _lq.enemy.name + '}!');
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
        grown ? `<em class="lq-grown" title="${Math.floor(_lq.steps / LANG_RUN_ENDURANCE_EVERY) * LANG_RUN_ENDURANCE_GAIN} from blocks run, ${_lq.defeated * LANG_RUN_STAMINA_GAIN} from conversations won">+${_lq.staminaMax - LANG_RUN_STAMINA}</em>` : ''}</span>
      <span class="lq-stat"><b class="lq-ico-pw">✦</b>PWR ${Math.round(_lq.power)}%</span>
      <span class="lq-stat"><b class="lq-ico-wk">▮</b>BLOCKS ${_lq.steps}</span>
      ${_lq.scene === 'battle' && _lq.enemy
        ? `<span class="lq-stat lq-stat-foe"><b>♥</b>${escapeHTML(_lq.enemy.name)} ${Math.max(0, Math.round(_lq.enemy.hp))}/${_lq.enemy.hpMax}</span>` : ''}`;
  }

  scene.style.background =
    `linear-gradient(175deg, ${bd.from} 0%, ${bd.mid} 55%, ${bd.to} 100%)`;
  scene.innerHTML = `
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
    { id: 'item',  glyph: '🧃', label: 'ITEM', off: !potions },
    { id: 'power', glyph: '✦', label: 'POWER', off: _lq.power < Math.min(...LANG_POWERUPS.map(p => p.cost)) },
    { id: 'flee',  glyph: '🏃', label: 'FLEE FROM BATTLE' }
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

  // Endurance. The leg costs you now and pays you back as headroom: the
  // maximum rises every few blocks whether or not you meet anybody, so the
  // walk itself is progress and not just a countdown to the next encounter.
  const enduranceUp = _lq.steps % LANG_RUN_ENDURANCE_EVERY === 0;
  if (enduranceUp) _lq.staminaMax += LANG_RUN_ENDURANCE_GAIN;

  if (_lq.stamina <= 0) {
    _lq.stamina = 0;
    lqSay(null, 'Your legs are done. You have nothing left to walk on.');
    lqThen(() => lqFinish('exhausted'));
    lqRender();
    return;
  }

  if (enduranceUp) {
    lqSay(null, 'Your legs are getting used to this. Total stamina is now {'
      + _lq.staminaMax + '}.');
  }

  // Four quiet legs in a row and the next is certain, so a run cannot stall
  // into pressing the same button at nothing.
  const forced = _lq.steps - (_lq.lastEncounterStep || 0) >= 4;
  if (forced || Math.random() < LANG_ENCOUNTER_CHANCE) {
    const enemy = langRandomEnemy(_lq.location);
    if (enemy) {
      _lq.lastEncounterStep = _lq.steps;
      _lq.enemy = enemy;
      _lq.location = enemy.location || _lq.location;
      _lq.turn = 0; _lq.removed = [];
      lqSay(null, 'You encountered a {' + enemy.name + '}!');
      lqThen(() => { _lq.scene = 'battle'; lqBeginTurn(); lqRender(); });
      lqRender();
      return;
    }
  }

  lqSay(null, LANG_RUN_FLAVOUR[Math.floor(Math.random() * LANG_RUN_FLAVOUR.length)]);
  lqFind();
  lqThen(() => { lqRoadMenu(); lqRender(); });
  lqRender();
}

/** What a quiet leg can turn up. Roughly half of them give you something. */
function lqFind() {
  const roll = Math.random();
  if (roll < 0.28) {
    const p = _lq.potions[Math.floor(Math.random() * _lq.potions.length)];
    p.owned++;
    lqSay(null, 'Someone left a {' + p.name.toLowerCase() + '} on the ledge. You pocket it.');
  } else if (roll < 0.5 && _lq.stamina < _lq.staminaMax) {
    const gain = Math.min(5, _lq.staminaMax - _lq.stamina);
    _lq.stamina += gain;
    lqSay(null, 'You slow down and get your breath back. (+' + gain + ' stamina)');
  } else if (roll < 0.62 && _lq.power < _lq.powerMax) {
    const gain = Math.min(8, _lq.powerMax - _lq.power);
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
  lqSay(_lq.enemy.name, t.line, 'foe');
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
    lqSay(null, 'It lands. {' + _lq.enemy.name + '} takes ' + dmg + '.'
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
    lqSay(null, '{' + _lq.enemy.name + '} gives up and lets you past.');
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

function lqFlee() {
  if (!_lq) return;
  _lq.stamina = Math.max(0, _lq.stamina - 10);
  _lq.fled++;
  lqSay(null, 'You slip away before it gets awkward. (−10 stamina)');
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

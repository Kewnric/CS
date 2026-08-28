/* ============================================================
   LANG-QUEST.JS — the run, and the battles along it
   ------------------------------------------------------------
   Two screens that hand back and forth:

     the road   — you are somewhere, and you choose to walk on or go home.
                  Walking costs stamina and may turn up somebody.
     the battle — laid out the way a turn-based RPG is: them across from you,
                  your commands underneath. THEY SPEAK FIRST. Answer well and
                  you take nothing and get some stamina back; answer badly and
                  it drains.

   Stamina is health — there is no separate bar, because the fiction is that
   you are out walking and a bad conversation wears you down. Beating someone
   raises the MAXIMUM, so the reward for a hard talk is a longer walk next time.

   Backdrops and sprites are placeholders and say so on screen.
   ============================================================ */

let _lq = null;

/* Stand-in scenery: a gradient and an icon rather than an image, so the game
   reads correctly now and real art can drop in without the layout moving. */
const LQ_BACKDROPS = {
  cafeteria: { from: '#3b2f4a', to: '#1b1430' },
  classroom: { from: '#243b55', to: '#141e30' },
  hallway:   { from: '#2c3e50', to: '#1a252f' },
  home:      { from: '#4a3728', to: '#241a12' },
  market:    { from: '#3d4a2f', to: '#1b2413' },
  street:    { from: '#2f3a4a', to: '#151c26' }
};

function langQuestTemplate() {
  return `
    <div class="lq-shell" id="lq-shell">
      <header class="lq-top">
        <button class="btn-back-dark" onclick="lqExit()" title="Leave">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back
        </button>
        <div class="lq-title" id="lq-title"></div>
        <div class="lq-badge">PLACEHOLDER ART</div>
      </header>
      <div class="lq-hud" id="lq-hud"></div>
      <div class="lq-stage" id="lq-stage"></div>
      <div class="lq-panel" id="lq-panel"></div>
    </div>`;
}

function langQuestInit() {
  langStore();
  const mode = getSessionParam('langRunMode') || 'run';
  const scId = getSessionParam('langRunScenario');

  _lq = {
    mode,                      // run | scenario
    scene: 'road',             // road | battle | over
    location: 'street',
    stamina: LANG_RUN_STAMINA,
    staminaMax: LANG_RUN_STAMINA,
    power: 0,
    powerMax: 100,
    potions: LANG_POTIONS.map(p => Object.assign({ owned: 1 }, p)),
    steps: 0,
    defeated: 0,
    fled: 0,
    correct: 0,
    asked: 0,
    flavour: '',
    enemy: null,
    turn: 0,
    removed: [],
    doubleNext: false,
    lastPick: null,
    startTime: Date.now()
  };

  document.title = (mode === 'scenario' ? 'Scenario' : 'Free run') + ' — StudySession Pro';

  if (mode === 'scenario') {
    const sc = scId ? langFindScenario(scId) : null;
    const ready = (e) => (e.line || '').trim() && (e.options || []).some(o => (o.text || '').trim() && o.correct);
    if (!sc || !(sc.encounters || []).some(ready)) { spaNavigate('language'); return; }
    const usable = (sc.encounters || []).filter(ready);
    _lq.location = sc.location || 'street';
    _lq.stamina = _lq.staminaMax = sc.playerHp || LANG_RUN_STAMINA;
    _lq.power = sc.playerMana || 0;
    _lq.enemy = {
      name: sc.npc || 'Stranger', location: _lq.location,
      hp: sc.npcHp || 100, hpMax: sc.npcHp || 100, source: 'scenario',
      turns: usable.map(e => ({
        situation: e.situation || '', line: e.line,
        options: langShuffle((e.options || []).filter(o => (o.text || '').trim())),
        damage: e.damage || 25, backlash: e.backlash || 20
      }))
    };
    _lq.scene = 'battle';
  } else {
    if (langRunBlocker()) { spaNavigate('language'); return; }
    _lq.flavour = 'You set off. The road is ahead of you.';
  }
  lqRender();
}

function langQuestDestroy() { _lq = null; }

function lqExit() {
  if (!_lq || _lq.scene === 'over') { spaNavigate('language'); return; }
  showConfirm('Leave?', 'This run will not be saved.', () => { _lq = null; spaNavigate('language'); });
}

/* ── Render ───────────────────────────────────────────────── */

function lqRender() {
  if (!_lq) return;
  const shell = document.getElementById('lq-shell');
  const title = document.getElementById('lq-title');
  const hud = document.getElementById('lq-hud');
  const stage = document.getElementById('lq-stage');
  const panel = document.getElementById('lq-panel');
  if (!hud || !stage || !panel) return;

  const loc = langLocation(_lq.location);
  const bd = LQ_BACKDROPS[loc.key] || LQ_BACKDROPS.street;
  if (title) title.textContent = _lq.mode === 'scenario' ? 'Scenario' : 'Free run';

  hud.innerHTML = lqHudHTML();
  stage.style.background = `linear-gradient(160deg, ${bd.from} 0%, ${bd.to} 100%)`;
  stage.innerHTML = _lq.scene === 'battle' ? lqBattleStageHTML(loc) : lqRoadStageHTML(loc);
  panel.innerHTML = _lq.scene === 'over' ? lqSummaryHTML()
    : _lq.scene === 'battle' ? lqBattlePanelHTML() : lqRoadPanelHTML();

  if (typeof lucide !== 'undefined' && shell) lucide.createIcons({ root: shell });
}

function lqHudHTML() {
  const pct = (a, b) => Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100));
  const low = _lq.stamina <= _lq.staminaMax * 0.25;
  return `
    <div class="lq-meters">
      <div class="lq-meter">
        <span class="lq-meter-label"><i data-lucide="flame"></i> STAMINA</span>
        <div class="lq-meter-track"><div class="lq-meter-fill${low ? ' is-low' : ' is-hp'}" style="width:${pct(_lq.stamina, _lq.staminaMax)}%;"></div></div>
        <span class="lq-meter-num">${Math.max(0, Math.round(_lq.stamina))}/${_lq.staminaMax}</span>
      </div>
      <div class="lq-meter">
        <span class="lq-meter-label"><i data-lucide="sparkles"></i> POWER</span>
        <div class="lq-meter-track"><div class="lq-meter-fill is-mp" style="width:${pct(_lq.power, _lq.powerMax)}%;"></div></div>
        <span class="lq-meter-num">${Math.round(_lq.power)}/${_lq.powerMax}</span>
      </div>
      <div class="lq-turn">
        <span title="Legs walked"><i data-lucide="footprints"></i> ${_lq.steps}</span>
        <span title="People talked past"><i data-lucide="swords"></i> ${_lq.defeated}</span>
      </div>
    </div>`;
}

function lqRoadStageHTML(loc) {
  return `
    <div class="lq-scene-tag"><i data-lucide="${loc.icon}"></i> ${escapeHTML(loc.name)}</div>
    <div class="lq-road">
      <div class="lq-sprite lq-sprite-you lq-road-you">
        <div class="lq-sprite-art"><i data-lucide="graduation-cap"></i></div>
        <div class="lq-sprite-name">You</div>
      </div>
      <div class="lq-road-line"></div>
    </div>`;
}

/* The RPG framing: them up and across, you down and near. */
function lqBattleStageHTML(loc) {
  const e = _lq.enemy;
  const pct = Math.max(0, (e.hp / Math.max(1, e.hpMax)) * 100);
  return `
    <div class="lq-scene-tag"><i data-lucide="${loc.icon}"></i> ${escapeHTML(loc.name)}</div>
    <div class="lq-field">
      <div class="lq-side lq-side-foe">
        <div class="lq-plate">
          <div class="lq-plate-name">${escapeHTML(e.name)}</div>
          <div class="lq-bar lq-bar-npc"><div class="lq-bar-fill" style="width:${pct}%;"></div></div>
        </div>
        <div class="lq-sprite lq-sprite-npc">
          <div class="lq-sprite-art"><i data-lucide="user-round"></i></div>
        </div>
      </div>
      <div class="lq-side lq-side-you">
        <div class="lq-sprite lq-sprite-you">
          <div class="lq-sprite-art is-back"><i data-lucide="graduation-cap"></i></div>
        </div>
        <div class="lq-plate">
          <div class="lq-plate-name">You</div>
          <div class="lq-bar lq-bar-you"><div class="lq-bar-fill" style="width:${Math.max(0, (_lq.stamina / _lq.staminaMax) * 100)}%;"></div></div>
        </div>
      </div>
    </div>`;
}

/* ── The road ─────────────────────────────────────────────── */

function lqRoadPanelHTML() {
  return `
    <div class="lq-textbox">
      <p>${escapeHTML(_lq.flavour || '…')}</p>
    </div>
    <div class="lq-commands">
      <button class="lq-cmd" type="button" onclick="lqStep()">
        <i data-lucide="footprints"></i><span>RUN</span><small>−${LANG_RUN_STEP_COST} stamina</small>
      </button>
      <button class="lq-cmd" type="button" onclick="lqOpenBag()">
        <i data-lucide="briefcase"></i><span>BAG</span><small>${_lq.potions.reduce((n, p) => n + p.owned, 0)} left</small>
      </button>
      <button class="lq-cmd" type="button" onclick="lqOpenPower()">
        <i data-lucide="sparkles"></i><span>POWER</span><small>${Math.round(_lq.power)}</small>
      </button>
      <button class="lq-cmd is-end" type="button" onclick="lqGoHome()">
        <i data-lucide="home"></i><span>GO HOME</span><small>end the run</small>
      </button>
    </div>`;
}

/** One leg of the walk. */
function lqStep() {
  if (!_lq || _lq.scene !== 'road') return;
  _lq.steps++;
  _lq.stamina -= LANG_RUN_STEP_COST;
  if (_lq.stamina <= 0) { _lq.stamina = 0; lqFinish('exhausted'); return; }

  _lq.flavour = LANG_RUN_FLAVOUR[Math.floor(Math.random() * LANG_RUN_FLAVOUR.length)];

  // A pity rule: three quiet legs in a row and the next one is certain, so a
  // run cannot stall into pressing RUN at nothing.
  const forced = _lq.steps - (_lq.lastEncounterStep || 0) >= 4;
  if (forced || Math.random() < LANG_ENCOUNTER_CHANCE) {
    const enemy = langRandomEnemy();
    if (enemy) {
      _lq.lastEncounterStep = _lq.steps;
      _lq.enemy = enemy;
      _lq.location = enemy.location || _lq.location;
      _lq.turn = 0;
      _lq.removed = [];
      _lq.lastPick = null;
      _lq.scene = 'battle';
      _lq.flavour = `${enemy.name} blocks your way.`;
    }
  }
  lqRender();
}

function lqGoHome() {
  if (!_lq) return;
  showConfirm('Go home?', 'The run ends here and the score is kept.', () => lqFinish('home'));
}

/* ── The battle ───────────────────────────────────────────── */

function lqCurrentTurn() {
  return _lq && _lq.enemy && _lq.enemy.turns[_lq.turn % _lq.enemy.turns.length];
}

function lqBattlePanelHTML() {
  const t = lqCurrentTurn();
  if (!t) return '';
  if (_lq.lastPick) return lqResultHTML();

  const opts = t.options.filter(o => (o.text || '').trim());
  return `
    <div class="lq-textbox">
      ${t.situation ? `<p class="lq-sit"><i data-lucide="eye"></i> ${escapeHTML(t.situation)}</p>` : ''}
      <p class="lq-said"><strong>${escapeHTML(_lq.enemy.name)}:</strong> ${escapeHTML(t.line || '…')}</p>
    </div>
    <div class="lq-replies">
      ${opts.map((o, i) => _lq.removed.indexOf(i) > -1
        ? `<button class="lq-option is-removed" type="button" disabled><s>${escapeHTML(o.text)}</s></button>`
        : `<button class="lq-option" type="button" onclick="lqReply(${i})">${escapeHTML(o.text)}</button>`).join('')}
    </div>
    <div class="lq-commands lq-commands-battle">
      <button class="lq-cmd" type="button" onclick="lqOpenBag()">
        <i data-lucide="briefcase"></i><span>BAG</span><small>${_lq.potions.reduce((n, p) => n + p.owned, 0)} left</small>
      </button>
      <button class="lq-cmd" type="button" onclick="lqOpenPower()">
        <i data-lucide="sparkles"></i><span>POWER</span><small>${Math.round(_lq.power)}</small>
      </button>
      <button class="lq-cmd is-end" type="button" onclick="lqFlee()">
        <i data-lucide="rabbit"></i><span>RUN AWAY</span><small>−10 stamina</small>
      </button>
    </div>`;
}

function lqReply(i) {
  if (!_lq || _lq.scene !== 'battle' || _lq.lastPick) return;
  const t = lqCurrentTurn();
  const opts = t.options.filter(o => (o.text || '').trim());
  const o = opts[i];
  if (!o) return;

  _lq.asked++;
  const best = (opts.find(x => x.correct) || {}).text || '';
  let dmg = 0, heal = 0, hurt = 0;

  if (o.correct) {
    _lq.correct++;
    dmg = (t.damage || 25) * (_lq.doubleNext ? 2 : 1);
    _lq.doubleNext = false;
    _lq.enemy.hp = Math.max(0, _lq.enemy.hp - dmg);
    // A good reply costs you nothing and gives a little back — the point of
    // the mode is that saying the right thing keeps you on your feet.
    heal = Math.min(10, _lq.staminaMax - _lq.stamina);
    _lq.stamina += heal;
    _lq.power = Math.min(_lq.powerMax, _lq.power + 15);
  } else {
    hurt = t.backlash || 20;
    _lq.stamina = Math.max(0, _lq.stamina - hurt);
    _lq.power = Math.min(_lq.powerMax, _lq.power + 5);
  }

  _lq.lastPick = { ok: !!o.correct, text: o.text, note: o.note || '', dmg, heal, hurt, best };
  lqRender();
}

function lqResultHTML() {
  const p = _lq.lastPick;
  const dead = _lq.enemy.hp <= 0;
  const spent = _lq.stamina <= 0;
  return `
    <div class="lq-textbox ${p.ok ? 'is-good' : 'is-bad'}">
      <p class="lq-said"><strong>You:</strong> ${escapeHTML(p.text)}</p>
      <p class="lq-verdict">
        <i data-lucide="${p.ok ? 'check-circle-2' : 'x-circle'}"></i>
        ${p.ok
          ? `It lands — ${p.dmg} damage${p.heal ? `, and you catch your breath (+${p.heal})` : ''}.`
          : `It falls flat — you lose ${p.hurt} stamina.`}
      </p>
      ${p.note ? `<p class="lq-note">${escapeHTML(p.note)}</p>` : ''}
      ${!p.ok && p.best ? `<p class="lq-better">Better: <em>${escapeHTML(p.best)}</em></p>` : ''}
      ${dead ? `<p class="lq-win">${escapeHTML(_lq.enemy.name)} gives up. Maximum stamina +${LANG_RUN_STAMINA_GAIN}.</p>` : ''}
    </div>
    <div class="lq-commands">
      <button class="lq-cmd is-go" type="button" onclick="lqAfterTurn()">
        <i data-lucide="arrow-right"></i><span>${dead ? 'CONTINUE' : spent ? 'FINISH' : 'NEXT'}</span>
      </button>
    </div>`;
}

function lqAfterTurn() {
  if (!_lq) return;
  const dead = _lq.enemy.hp <= 0;
  _lq.lastPick = null;
  _lq.removed = [];

  if (_lq.stamina <= 0) { lqFinish('exhausted'); return; }

  if (dead) {
    _lq.defeated++;
    _lq.staminaMax += LANG_RUN_STAMINA_GAIN;
    _lq.stamina = Math.min(_lq.staminaMax, _lq.stamina + LANG_RUN_STAMINA_GAIN);
    if (_lq.mode === 'scenario') { lqFinish('won'); return; }
    _lq.enemy = null;
    _lq.scene = 'road';
    _lq.flavour = 'They let you past. The road opens up again.';
    lqRender();
    return;
  }

  _lq.turn++;
  // A scenario is a written conversation with an end; a run's opponent keeps
  // talking until one of you gives out.
  if (_lq.mode === 'scenario' && _lq.turn >= _lq.enemy.turns.length) { lqFinish('scene'); return; }
  lqRender();
}

function lqFlee() {
  if (!_lq || _lq.scene !== 'battle') return;
  _lq.stamina = Math.max(0, _lq.stamina - 10);
  _lq.fled++;
  if (_lq.stamina <= 0) { lqFinish('exhausted'); return; }
  if (_lq.mode === 'scenario') { lqFinish('fled'); return; }
  _lq.enemy = null;
  _lq.lastPick = null;
  _lq.scene = 'road';
  _lq.flavour = 'You slip away before it gets awkward.';
  lqRender();
}

/* ── Bag and power ────────────────────────────────────────── */

function lqOpenBag() {
  if (!_lq) return;
  const body = _lq.potions.map(p => `
    <button class="lq-bag-row${p.owned ? '' : ' is-off'}" type="button" ${p.owned ? `onclick="lqUsePotion('${p.id}')"` : 'disabled'}>
      <i data-lucide="${p.icon}"></i>
      <span class="lq-bag-name">${escapeHTML(p.name)}</span>
      <span class="lq-bag-desc">${escapeHTML(p.desc)}</span>
      <span class="lq-bag-count">×${p.owned}</span>
    </button>`).join('');
  langPopup('Bag', 'briefcase', body);
}

function lqUsePotion(id) {
  if (!_lq) return;
  const p = _lq.potions.find(x => x.id === id);
  if (!p || !p.owned) return;
  if (_lq.stamina >= _lq.staminaMax) {
    if (typeof toast === 'function') toast('Stamina is already full.', { type: 'info' });
    return;
  }
  p.owned--;
  _lq.stamina = Math.min(_lq.staminaMax, _lq.stamina + p.heal);
  const pop = document.getElementById('lang-popup');
  if (pop) pop.remove();
  lqRender();
  if (typeof toast === 'function') toast(`${p.name} — +${p.heal} stamina.`, { type: 'success' });
}

function lqOpenPower() {
  if (!_lq) return;
  const body = LANG_POWERUPS.map(p => {
    const can = _lq.power >= p.cost;
    return `
      <button class="lq-bag-row${can ? '' : ' is-off'}" type="button" ${can ? `onclick="lqUsePower('${p.id}')"` : 'disabled'}>
        <i data-lucide="${p.icon}"></i>
        <span class="lq-bag-name">${escapeHTML(p.name)}</span>
        <span class="lq-bag-desc">${escapeHTML(p.desc)}</span>
        <span class="lq-bag-count">${p.cost}</span>
      </button>`;
  }).join('');
  langPopup(`Power gauge — ${Math.round(_lq.power)}/${_lq.powerMax}`, 'sparkles', body);
}

function lqUsePower(id) {
  if (!_lq) return;
  const p = langPowerup(id);
  if (!p || _lq.power < p.cost) return;

  if (id === 'insight') {
    // Only usable where there is something to strike out.
    if (_lq.scene !== 'battle' || _lq.lastPick) {
      if (typeof toast === 'function') toast('Insight only helps during a question.', { type: 'info' });
      return;
    }
    const t = lqCurrentTurn();
    const opts = t.options.filter(o => (o.text || '').trim());
    const wrong = opts.map((o, i) => ({ o, i })).filter(x => !x.o.correct && _lq.removed.indexOf(x.i) === -1);
    if (!wrong.length) {
      if (typeof toast === 'function') toast('Nothing left to rule out.', { type: 'info' });
      return;
    }
    _lq.removed.push(wrong[Math.floor(Math.random() * wrong.length)].i);
  } else if (id === 'secondwind') {
    if (_lq.stamina >= _lq.staminaMax) {
      if (typeof toast === 'function') toast('Stamina is already full.', { type: 'info' });
      return;
    }
    _lq.stamina = Math.min(_lq.staminaMax, _lq.stamina + 30);
  } else if (id === 'silvertongue') {
    if (_lq.doubleNext) {
      if (typeof toast === 'function') toast('Already primed.', { type: 'info' });
      return;
    }
    _lq.doubleNext = true;
  }

  _lq.power -= p.cost;
  const pop = document.getElementById('lang-popup');
  if (pop) pop.remove();
  lqRender();
  if (typeof toast === 'function') toast(p.name + ' used.', { type: 'success' });
}

/* ── Ending ───────────────────────────────────────────────── */

function lqFinish(reason) {
  if (!_lq || _lq.scene === 'over') return;
  _lq.scene = 'over';
  _lq.reason = reason;
  const score = _lq.asked ? Math.round((_lq.correct / _lq.asked) * 100) : 0;
  langRecordAttempt({
    kind: _lq.mode === 'scenario' ? 'scenario' : 'run',
    refId: _lq.mode === 'scenario' ? (getSessionParam('langRunScenario') || '') : 'free',
    title: _lq.mode === 'scenario' ? 'Scenario' : 'Free run',
    score, correct: _lq.correct, total: _lq.asked,
    steps: _lq.steps, defeated: _lq.defeated, fled: _lq.fled,
    staminaLeft: Math.max(0, Math.round(_lq.stamina)), staminaMax: _lq.staminaMax,
    reason,
    duration: Math.round((Date.now() - _lq.startTime) / 1000)
  });
  lqRender();
}

function lqSummaryHTML() {
  const score = _lq.asked ? Math.round((_lq.correct / _lq.asked) * 100) : 0;
  const cls = score >= 80 ? 'score-perfect' : score >= 50 ? 'score-partial' : 'score-low';
  const head = {
    exhausted: 'You ran out of stamina',
    home: 'You went home',
    won: 'Conversation won',
    fled: 'You slipped away',
    scene: 'Scene over'
  }[_lq.reason] || 'Run over';
  const icon = _lq.reason === 'exhausted' ? 'battery-low' : _lq.reason === 'won' ? 'trophy' : 'home';
  return `
    <div class="lq-summary">
      <div class="lq-summary-icon ${cls}"><i data-lucide="${icon}"></i></div>
      <h2>${escapeHTML(head)}</h2>
      <div class="lq-summary-score ${cls}">${score}%</div>
      <div class="lq-summary-grid">
        <div><em>Replies right</em><strong>${_lq.correct}/${_lq.asked}</strong></div>
        <div><em>Legs walked</em><strong>${_lq.steps}</strong></div>
        <div><em>People beaten</em><strong>${_lq.defeated}</strong></div>
        <div><em>Slipped away</em><strong>${_lq.fled}</strong></div>
        <div><em>Stamina left</em><strong>${Math.max(0, Math.round(_lq.stamina))}/${_lq.staminaMax}</strong></div>
        <div><em>Max reached</em><strong>${_lq.staminaMax}</strong></div>
      </div>
      <div class="lq-summary-actions">
        <button class="btn btn-secondary btn-lg" onclick="spaNavigate('language')">Back to library</button>
        <button class="btn btn-primary btn-lg" onclick="lqRetry()">
          <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i> Go again
        </button>
      </div>
    </div>`;
}

function lqRetry() {
  const mode = _lq ? _lq.mode : 'run';
  const id = getSessionParam('langRunScenario');
  _lq = null;
  setSessionParam('langRunMode', mode);
  setSessionParam('langRunScenario', id);
  langQuestInit();
}

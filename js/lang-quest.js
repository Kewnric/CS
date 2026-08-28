/* ============================================================
   LANG-QUEST.JS — the scenario battle
   ------------------------------------------------------------
   A turn-based encounter where the weapon is what you say. Someone speaks in
   the language you are learning; you choose the reply that actually fits the
   situation. A good reply lands; a wrong one costs you.

   The battle, the scoring and the turn loop are real. The scene itself —
   locations, sprites, the inventory's contents — is deliberately placeholder
   art, as asked, so the shape is playable while the look is still open.
   ============================================================ */

let _lq = null;

/* Stand-in scenery. Each location is a gradient and an icon rather than an
   image, so the game reads correctly now and the art can drop in later
   without the layout moving. */
const LQ_BACKDROPS = {
  cafeteria: { from: '#3b2f4a', to: '#1b1430', icon: 'utensils' },
  classroom: { from: '#243b55', to: '#141e30', icon: 'presentation' },
  hallway:   { from: '#2c3e50', to: '#1a252f', icon: 'door-open' },
  home:      { from: '#4a3728', to: '#241a12', icon: 'home' },
  market:    { from: '#3d4a2f', to: '#1b2413', icon: 'shopping-basket' },
  street:    { from: '#2f3a4a', to: '#151c26', icon: 'signpost' }
};

/* Placeholder inventory. Nothing is consumable yet beyond the mana cost —
   these exist so the HUD is real and the items have somewhere to live. */
const LQ_STARTER_ITEMS = [
  { id: 'hint',    name: 'Phrasebook', icon: 'book-open', cost: 10, desc: 'Removes one wrong reply.' },
  { id: 'heal',    name: 'Snack',      icon: 'apple',     cost: 15, desc: 'Restores 20 HP.' },
  { id: 'shield',  name: 'Politeness', icon: 'shield',    cost: 12, desc: 'Blocks the next backlash.' }
];

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
      <div class="lq-stage" id="lq-stage"></div>
      <div class="lq-hud" id="lq-hud"></div>
      <div class="lq-panel" id="lq-panel"></div>
    </div>`;
}

function langQuestInit() {
  langStore();
  const id = getSessionParam('langRunScenario');
  const sc = id ? langFindScenario(id) : null;
  if (!sc || !(sc.encounters || []).length) { spaNavigate('language'); return; }

  _lq = {
    sc,
    idx: 0,
    hp: sc.playerHp || 100,
    hpMax: sc.playerHp || 100,
    mana: sc.playerMana || 30,
    manaMax: sc.playerMana || 30,
    npcHp: sc.npcHp || 100,
    npcHpMax: sc.npcHp || 100,
    items: LQ_STARTER_ITEMS.map(i => Object.assign({ owned: 1 }, i)),
    removed: [],          // options struck out by the Phrasebook
    shielded: false,
    log: [],
    correct: 0,
    startTime: Date.now(),
    phase: 'choosing',    // choosing | resolved | over
    lastPick: null
  };
  lqRender();
}

function langQuestDestroy() { _lq = null; }

function lqExit() {
  if (!_lq || _lq.phase === 'over') { spaNavigate('language'); return; }
  showConfirm('Leave the scenario?', 'This run will not be saved.', () => {
    _lq = null;
    spaNavigate('language');
  });
}

function lqCurrent() { return _lq && (_lq.sc.encounters || [])[_lq.idx]; }

/* ── Render ───────────────────────────────────────────────── */

function lqRender() {
  if (!_lq) return;
  const shell = document.getElementById('lq-shell');
  const title = document.getElementById('lq-title');
  const stage = document.getElementById('lq-stage');
  const hud = document.getElementById('lq-hud');
  const panel = document.getElementById('lq-panel');
  if (!stage || !hud || !panel) return;

  const loc = langLocation(_lq.sc.location);
  const bd = LQ_BACKDROPS[loc.key] || LQ_BACKDROPS.cafeteria;
  if (title) title.textContent = _lq.sc.title || 'Scenario';

  stage.style.background = `linear-gradient(160deg, ${bd.from} 0%, ${bd.to} 100%)`;
  stage.innerHTML = `
    <div class="lq-scene-tag"><i data-lucide="${loc.icon}"></i> ${escapeHTML(loc.name)}</div>
    <div class="lq-sprites">
      <div class="lq-sprite lq-sprite-npc">
        <div class="lq-sprite-art"><i data-lucide="user-round"></i></div>
        <div class="lq-sprite-name">${escapeHTML(_lq.sc.npc || 'Stranger')}</div>
        <div class="lq-bar lq-bar-npc"><div class="lq-bar-fill" style="width:${Math.max(0, (_lq.npcHp / _lq.npcHpMax) * 100)}%;"></div></div>
      </div>
      <div class="lq-vs">VS</div>
      <div class="lq-sprite lq-sprite-you">
        <div class="lq-sprite-art"><i data-lucide="graduation-cap"></i></div>
        <div class="lq-sprite-name">You</div>
        <div class="lq-bar lq-bar-you"><div class="lq-bar-fill" style="width:${Math.max(0, (_lq.hp / _lq.hpMax) * 100)}%;"></div></div>
      </div>
    </div>`;

  hud.innerHTML = `
    <div class="lq-meters">
      <div class="lq-meter">
        <span class="lq-meter-label"><i data-lucide="heart"></i> HP</span>
        <div class="lq-meter-track"><div class="lq-meter-fill is-hp" style="width:${Math.max(0, (_lq.hp / _lq.hpMax) * 100)}%;"></div></div>
        <span class="lq-meter-num">${Math.max(0, _lq.hp)}/${_lq.hpMax}</span>
      </div>
      <div class="lq-meter">
        <span class="lq-meter-label"><i data-lucide="sparkles"></i> MP</span>
        <div class="lq-meter-track"><div class="lq-meter-fill is-mp" style="width:${Math.max(0, (_lq.mana / _lq.manaMax) * 100)}%;"></div></div>
        <span class="lq-meter-num">${Math.max(0, _lq.mana)}/${_lq.manaMax}</span>
      </div>
      <div class="lq-turn">Turn ${_lq.idx + 1} / ${(_lq.sc.encounters || []).length}</div>
    </div>
    <div class="lq-inventory">
      ${_lq.items.map(it => `
        <button class="lq-item${_lq.mana < it.cost || !it.owned ? ' is-off' : ''}" type="button"
                onclick="lqUseItem('${it.id}')" title="${escapeHTML(it.desc)} — ${it.cost} MP">
          <i data-lucide="${it.icon}"></i>
          <span class="lq-item-name">${escapeHTML(it.name)}</span>
          <span class="lq-item-cost">${it.cost}</span>
        </button>`).join('')}
    </div>`;

  panel.innerHTML = _lq.phase === 'over' ? lqSummaryHTML() : lqEncounterHTML();
  if (typeof lucide !== 'undefined' && shell) lucide.createIcons({ root: shell });
}

function lqEncounterHTML() {
  const e = lqCurrent();
  if (!e) return '';
  const opts = (e.options || []).filter(o => (o.text || '').trim());
  return `
    <div class="lq-dialogue">
      ${e.situation ? `<div class="lq-situation"><i data-lucide="eye"></i> ${escapeHTML(e.situation)}</div>` : ''}
      <div class="lq-line">
        <span class="lq-line-who">${escapeHTML(_lq.sc.npc || 'Stranger')}</span>
        <span class="lq-line-text">${escapeHTML(e.line || '…')}</span>
      </div>
    </div>
    ${_lq.phase === 'resolved' ? lqResultHTML(e) : `
    <div class="lq-options">
      ${opts.map((o, i) => _lq.removed.indexOf(i) > -1
        ? `<button class="lq-option is-removed" type="button" disabled><s>${escapeHTML(o.text)}</s></button>`
        : `<button class="lq-option" type="button" onclick="lqAnswer(${i})">${escapeHTML(o.text)}</button>`).join('')}
    </div>`}`;
}

function lqResultHTML(e) {
  const p = _lq.lastPick;
  if (!p) return '';
  return `
    <div class="lq-result ${p.ok ? 'is-good' : 'is-bad'}">
      <div class="lq-result-head">
        <i data-lucide="${p.ok ? 'swords' : 'shield-off'}"></i>
        <strong>${p.ok ? 'It lands' : 'It falls flat'}</strong>
        <span>${p.ok ? `−${p.dmg} to ${escapeHTML(_lq.sc.npc || 'them')}` : (p.blocked ? 'blocked by Politeness' : `−${p.dmg} to you`)}</span>
      </div>
      <div class="lq-result-you">You said: <em>${escapeHTML(p.text)}</em></div>
      ${p.note ? `<div class="lq-result-note">${escapeHTML(p.note)}</div>` : ''}
      ${!p.ok && p.best ? `<div class="lq-result-best">Better: <em>${escapeHTML(p.best)}</em></div>` : ''}
      <button class="btn btn-primary btn-lg" onclick="lqNext()">
        ${_lq.idx + 1 >= (_lq.sc.encounters || []).length ? 'Finish' : 'Next turn'}
      </button>
    </div>`;
}

/* ── Turns ────────────────────────────────────────────────── */

function lqAnswer(i) {
  if (!_lq || _lq.phase !== 'choosing') return;
  const e = lqCurrent();
  const opts = (e.options || []).filter(o => (o.text || '').trim());
  const o = opts[i];
  if (!o) return;

  const best = (opts.find(x => x.correct) || {}).text || '';
  let dmg, blocked = false;
  if (o.correct) {
    dmg = e.damage || 25;
    _lq.npcHp = Math.max(0, _lq.npcHp - dmg);
    _lq.correct++;
  } else {
    dmg = e.backlash || 20;
    if (_lq.shielded) { blocked = true; dmg = 0; _lq.shielded = false; }
    _lq.hp = Math.max(0, _lq.hp - dmg);
  }

  _lq.lastPick = { ok: !!o.correct, text: o.text, note: o.note || '', dmg, blocked, best };
  _lq.log.push({ line: e.line, said: o.text, ok: !!o.correct });
  _lq.phase = 'resolved';
  lqRender();
}

function lqNext() {
  if (!_lq) return;
  const last = _lq.idx + 1 >= (_lq.sc.encounters || []).length;
  if (_lq.hp <= 0 || _lq.npcHp <= 0 || last) { lqFinish(); return; }
  _lq.idx++;
  _lq.phase = 'choosing';
  _lq.removed = [];
  _lq.lastPick = null;
  lqRender();
}

function lqUseItem(id) {
  if (!_lq || _lq.phase !== 'choosing') return;
  const it = _lq.items.find(x => x.id === id);
  if (!it || !it.owned || _lq.mana < it.cost) return;
  const e = lqCurrent();
  const opts = (e.options || []).filter(o => (o.text || '').trim());

  if (id === 'hint') {
    const wrong = opts.map((o, i) => ({ o, i })).filter(x => !x.o.correct && _lq.removed.indexOf(x.i) === -1);
    if (!wrong.length) return;   // nothing left to remove — do not charge for it
    _lq.removed.push(wrong[Math.floor(Math.random() * wrong.length)].i);
  } else if (id === 'heal') {
    if (_lq.hp >= _lq.hpMax) return;
    _lq.hp = Math.min(_lq.hpMax, _lq.hp + 20);
  } else if (id === 'shield') {
    if (_lq.shielded) return;
    _lq.shielded = true;
  }
  _lq.mana -= it.cost;
  it.owned -= 1;
  lqRender();
}

function lqFinish() {
  if (!_lq || _lq.phase === 'over') return;
  _lq.phase = 'over';
  const total = (_lq.sc.encounters || []).length;
  const score = total ? Math.round((_lq.correct / total) * 100) : 0;
  langRecordAttempt({
    kind: 'scenario', refId: _lq.sc.id, title: _lq.sc.title,
    score, correct: _lq.correct, total,
    hpLeft: _lq.hp, won: _lq.npcHp <= 0 && _lq.hp > 0,
    duration: Math.round((Date.now() - _lq.startTime) / 1000)
  });
  lqRender();
}

function lqSummaryHTML() {
  const total = (_lq.sc.encounters || []).length;
  const score = total ? Math.round((_lq.correct / total) * 100) : 0;
  const won = _lq.npcHp <= 0 && _lq.hp > 0;
  const lost = _lq.hp <= 0;
  const cls = score >= 80 ? 'score-perfect' : score >= 50 ? 'score-partial' : 'score-low';
  return `
    <div class="lq-summary">
      <div class="lq-summary-icon ${cls}"><i data-lucide="${won ? 'trophy' : lost ? 'skull' : 'flag'}"></i></div>
      <h2>${won ? 'Conversation won' : lost ? 'You ran out of nerve' : 'Scene over'}</h2>
      <div class="lq-summary-score ${cls}">${score}%</div>
      <p>${_lq.correct} of ${total} replies landed · ${Math.max(0, _lq.hp)} HP left</p>
      <div class="lq-summary-log">
        ${_lq.log.map(l => `
          <div class="lq-log-row ${l.ok ? 'is-good' : 'is-bad'}">
            <i data-lucide="${l.ok ? 'check' : 'x'}"></i>
            <span class="lq-log-said">${escapeHTML(l.said)}</span>
          </div>`).join('')}
      </div>
      <div class="lq-summary-actions">
        <button class="btn btn-secondary btn-lg" onclick="spaNavigate('language')">Back to library</button>
        <button class="btn btn-primary btn-lg" onclick="lqRetry()">
          <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i> Try again
        </button>
      </div>
    </div>`;
}

function lqRetry() {
  const id = _lq && _lq.sc ? _lq.sc.id : getSessionParam('langRunScenario');
  _lq = null;
  setSessionParam('langRunScenario', id);
  langQuestInit();
}

/* ============================================================
   ADMIN-LANGUAGE.JS — authoring for the Language Library
   ------------------------------------------------------------
   Three things to write here, on three tabs: the words, the drill sets, and
   the scenarios. All three edit a working copy and only commit on Save, so
   backing out of a half-finished entry leaves the store untouched.
   ============================================================ */

let langAdminTab = 'words';
let langWordDraft = null;
let langSetDraft = null;
let langScenarioDraft = null;

function adminLanguageTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll" id="lang-admin-root" style="padding:1.5rem 2rem 4rem;">
        <div class="admin-hub-head">
          <button onclick="spaNavigate('admin')" class="btn-back-dark" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
            <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
          </button>
          <h1 class="lib-hub-title" style="font-size:1.6rem; margin-left:0.75rem;">Language Admin</h1>
        </div>
        <div class="lang-tabs lang-tabs-admin" id="lang-admin-tabs"></div>
        <div id="lang-admin-body"></div>
      </div>
    </div>`;
}

function adminLanguageInit() {
  langStore();
  langAdminTab = getSessionParam('langAdminTab') || 'words';
  const editId = getSessionParam('langAdminEdit');
  const wordId = getSessionParam('langAdminWord');
  langWordDraft = null; langSetDraft = null; langScenarioDraft = null;

  if (langAdminTab === 'words' && wordId) {
    const w = langFindWord(wordId);
    if (w) langWordDraft = JSON.parse(JSON.stringify(langNormWord(w)));
    setSessionParam('langAdminWord', null);
  }
  if (langAdminTab === 'sets' && editId) {
    const s = langFindSet(editId);
    if (s) langSetDraft = JSON.parse(JSON.stringify(s));
  }
  if (langAdminTab === 'scenarios' && editId) {
    const s = langFindScenario(editId);
    if (s) langScenarioDraft = JSON.parse(JSON.stringify(s));
  }
  setSessionParam('langAdminEdit', null);
  renderLangAdmin();
}

function adminLanguageDestroy() {
  langWordDraft = null; langSetDraft = null; langScenarioDraft = null;
}

function langAdminSetTab(tab) {
  langAdminTab = tab;
  setSessionParam('langAdminTab', tab);
  langWordDraft = null; langSetDraft = null; langScenarioDraft = null;
  renderLangAdmin();
}

function renderLangAdmin() {
  const tabs = document.getElementById('lang-admin-tabs');
  const body = document.getElementById('lang-admin-body');
  if (!tabs || !body) return;
  tabs.innerHTML = [['words', 'Words', 'book-a'], ['sets', 'Drill sets', 'dumbbell'], ['scenarios', 'Scenarios', 'swords']]
    .map(([k, label, icon]) => `
      <button class="lang-tab${langAdminTab === k ? ' is-active' : ''}" type="button" onclick="langAdminSetTab('${k}')">
        <i data-lucide="${icon}"></i> ${label}
      </button>`).join('');

  if (langAdminTab === 'sets') body.innerHTML = langSetDraft ? langSetFormHTML() : langSetListHTML();
  else if (langAdminTab === 'scenarios') body.innerHTML = langScenarioDraft ? langScenarioFormHTML() : langScenarioListHTML();
  else body.innerHTML = langWordDraft ? langWordFormHTML() : langWordListHTML();

  const root = document.getElementById('lang-admin-root');
  if (typeof lucide !== 'undefined' && root) lucide.createIcons({ root });
}

/* ── Words ────────────────────────────────────────────────── */

function langWordListHTML() {
  const study = langStudy();
  const rows = langWords().slice()
    .sort((a, b) => langHeadword(a, study).localeCompare(langHeadword(b, study), undefined, { sensitivity: 'base' }))
    .map(w => `
      <tr>
        <td><strong>${escapeHTML(langHeadword(w, study))}</strong></td>
        <td>${LANG_CODES.map(c => (w.forms[c].term || '').trim()
              ? `<span class="lang-mini-pill">${escapeHTML(langShort(c))}</span>` : '').join('') || '<em>empty</em>'}</td>
        <td>${escapeHTML((w.forms[study] && w.forms[study].pos) || '')}</td>
        <td class="lang-admin-actions">
          <button class="btn btn-ghost btn-sm" onclick="langEditWordDraft('${w.id}')" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="langAdminDeleteWord('${w.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
  return `
    <div class="lang-admin-bar">
      <button class="btn btn-primary" onclick="langNewWordDraft()"><i data-lucide="plus" style="width:15px;height:15px;"></i> New word</button>
      <span class="lang-admin-count">${langWords().length} word${langWords().length !== 1 ? 's' : ''}</span>
    </div>
    <table class="lang-admin-table">
      <thead><tr><th>Headword</th><th>Languages</th><th>Part of speech</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4"><em>No words yet.</em></td></tr>'}</tbody>
    </table>`;
}

function langNewWordDraft() { langWordDraft = langBlankWord(); renderLangAdmin(); }

function langEditWordDraft(id) {
  const w = langFindWord(id);
  if (!w) return;
  langWordDraft = JSON.parse(JSON.stringify(langNormWord(w)));
  renderLangAdmin();
}

function langAdminDeleteWord(id) {
  const w = langFindWord(id);
  if (!w) return;
  showConfirm('Delete word?', `Delete "${langHeadword(w)}"? You can undo this.`, () => {
    langDeleteWord(id);
    renderLangAdmin();
  });
}

function langWordFormHTML() {
  const w = langWordDraft;
  return `
    <div class="af-section">
      <div class="af-section-header"><i data-lucide="book-a" class="af-section-icon"></i><span>Word entry</span></div>
      <div class="af-section-body">
        <div class="af-field">
          <label class="form-label"><i data-lucide="tag" class="af-label-icon"></i>Tags <span class="af-label-hint">(comma separated)</span></label>
          <input class="form-input" id="lang-w-tags" value="${escapeHTML((w.tags || []).join(', '))}"
                 placeholder="e.g. question words, greetings" />
        </div>
        <p class="lang-form-hint">
          Fill in whichever languages you know it in — a blank one is simply not shown.
          The library compares whichever two you have selected.
        </p>
        ${LANGS.map(l => langFormFieldsHTML(l.code, w.forms[l.code])).join('')}
      </div>
    </div>
    <div class="modal-actions" style="justify-content:flex-end; gap:0.5rem;">
      <button class="btn btn-secondary" onclick="langCancelDraft()">Cancel</button>
      <button class="btn btn-primary" onclick="langSaveWordDraft()"><i data-lucide="check" style="width:15px;height:15px;"></i> Save word</button>
    </div>`;
}

function langFormFieldsHTML(code, f) {
  f = f || langBlankForm();
  return `
    <details class="lang-form-lang"${(f.term || '').trim() ? ' open' : ''}>
      <summary>
        <span class="lang-col-code">${escapeHTML(langShort(code))}</span>
        <span>${escapeHTML(langName(code))}</span>
        ${(f.term || '').trim() ? `<span class="lang-form-preview">${escapeHTML(f.term)}</span>` : '<span class="lang-form-preview is-empty">empty</span>'}
      </summary>
      <div class="lang-form-body">
        <div class="af-row-2" style="gap:0.75rem;">
          <div class="af-field" style="flex:2;">
            <label class="form-label">Term</label>
            <input class="form-input" data-lang-field="${code}.term" value="${escapeHTML(f.term)}" placeholder="the word itself" />
          </div>
          <div class="af-field" style="flex:1;">
            <label class="form-label">Part of speech</label>
            <select class="form-select" data-lang-field="${code}.pos">
              <option value="">—</option>
              ${LANG_POS.map(p => `<option value="${p}"${f.pos === p ? ' selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="af-field">
          <label class="form-label">Definition</label>
          <textarea class="form-textarea" rows="2" data-lang-field="${code}.definition"
                    placeholder="What it means">${escapeHTML(f.definition)}</textarea>
        </div>
        <div class="af-field">
          <label class="form-label">Example sentences <span class="af-label-hint">(one per line — use " = " to add a translation)</span></label>
          <textarea class="form-textarea" rows="3" data-lang-field="${code}.examples"
                    placeholder="Kinsa ka? = Who are you?">${escapeHTML((f.examples || []).map(e => e.gloss ? e.text + ' = ' + e.gloss : e.text).join('\n'))}</textarea>
        </div>
        <div class="af-row-2" style="gap:0.75rem;">
          <div class="af-field" style="flex:1;">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" rows="2" data-lang-field="${code}.notes"
                      placeholder="Anything worth remembering">${escapeHTML(f.notes)}</textarea>
          </div>
          <div class="af-field" style="flex:1;">
            <label class="form-label">Restrictions</label>
            <textarea class="form-textarea" rows="2" data-lang-field="${code}.restrictions"
                      placeholder="When NOT to use it">${escapeHTML(f.restrictions)}</textarea>
          </div>
        </div>
      </div>
    </details>`;
}

/** Reads every data-lang-field back into the draft. */
function langCollectWordForm() {
  const w = langWordDraft;
  if (!w) return;
  const tags = document.getElementById('lang-w-tags');
  w.tags = tags ? tags.value.split(',').map(t => t.trim()).filter(Boolean) : [];
  document.querySelectorAll('[data-lang-field]').forEach(el => {
    const [code, field] = el.getAttribute('data-lang-field').split('.');
    if (!w.forms[code]) w.forms[code] = langBlankForm();
    if (field === 'examples') {
      w.forms[code].examples = el.value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const i = line.indexOf(' = ');
        return i > -1
          ? { id: generateId(), text: line.slice(0, i).trim(), gloss: line.slice(i + 3).trim() }
          : { id: generateId(), text: line, gloss: '' };
      });
    } else {
      w.forms[code][field] = el.value;
    }
  });
}

function langSaveWordDraft() {
  langCollectWordForm();
  const saved = langSaveWord(langWordDraft);
  if (!saved) {
    showMessage('Nothing to save', 'Give the word a term in at least one language first.', true);
    return;
  }
  langWordDraft = null;
  renderLangAdmin();
  if (typeof toast === 'function') toast('Word saved.', { type: 'success' });
}

function langCancelDraft() {
  langWordDraft = null; langSetDraft = null; langScenarioDraft = null;
  renderLangAdmin();
}

/* ── Drill sets ───────────────────────────────────────────── */

function langSetListHTML() {
  const rows = langSets().map(s => {
    const problems = langSetProblems(s);
    return `
      <tr>
        <td><strong>${escapeHTML(s.title || 'Untitled')}</strong></td>
        <td>${(s.items || []).length}</td>
        <td>${escapeHTML(langShort(s.lang))} → ${escapeHTML(langShort(s.refLang))}</td>
        <td>${problems.length ? `<span class="lang-warn-text" title="${escapeHTML(problems.join(' · '))}">${problems.length} issue${problems.length !== 1 ? 's' : ''}</span>` : '<span class="lang-ok-text">ready</span>'}</td>
        <td class="lang-admin-actions">
          <button class="btn btn-ghost btn-sm" onclick="langEditSetDraft('${s.id}')" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="langAdminDeleteSet('${s.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div class="lang-admin-bar">
      <button class="btn btn-primary" onclick="langNewSetDraft()"><i data-lucide="plus" style="width:15px;height:15px;"></i> New drill set</button>
      <span class="lang-admin-count">${langSets().length} set${langSets().length !== 1 ? 's' : ''}</span>
    </div>
    <table class="lang-admin-table">
      <thead><tr><th>Title</th><th>Questions</th><th>Pair</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5"><em>No sets yet.</em></td></tr>'}</tbody>
    </table>`;
}

function langNewSetDraft() { langSetDraft = langBlankSet(); renderLangAdmin(); }
function langEditSetDraft(id) {
  const s = langFindSet(id);
  if (!s) return;
  langSetDraft = JSON.parse(JSON.stringify(s));
  renderLangAdmin();
}
function langAdminDeleteSet(id) {
  const s = langFindSet(id);
  if (!s) return;
  showConfirm('Delete set?', `Delete "${s.title || 'Untitled'}"? You can undo this.`, () => { langDeleteSet(id); renderLangAdmin(); });
}

function langSetFormHTML() {
  const s = langSetDraft;
  const langSelect = (id, val) => `
    <select class="form-select" id="${id}">
      ${LANGS.map(l => `<option value="${l.code}"${val === l.code ? ' selected' : ''}>${escapeHTML(l.name)}</option>`).join('')}
    </select>`;
  return `
    <div class="af-section">
      <div class="af-section-header"><i data-lucide="dumbbell" class="af-section-icon"></i><span>Drill set</span></div>
      <div class="af-section-body">
        <div class="af-field">
          <label class="form-label">Title</label>
          <input class="form-input af-input-bold" id="lang-s-title" value="${escapeHTML(s.title)}" placeholder="e.g. Question words — round 1" />
        </div>
        <div class="af-field">
          <label class="form-label">Description</label>
          <input class="form-input" id="lang-s-desc" value="${escapeHTML(s.description)}" placeholder="Optional" />
        </div>
        <div class="af-row-2" style="gap:0.75rem;">
          <div class="af-field" style="flex:1;"><label class="form-label">Language being learned</label>${langSelect('lang-s-lang', s.lang)}</div>
          <div class="af-field" style="flex:1;"><label class="form-label">Compared against</label>${langSelect('lang-s-ref', s.refLang)}</div>
        </div>
      </div>
    </div>

    <div class="af-section">
      <div class="af-section-header"><i data-lucide="list" class="af-section-icon"></i><span>Questions (${(s.items || []).length})</span></div>
      <div class="af-section-body">
        <div class="lang-add-row">
          ${LANG_PUZZLE_TYPES.map(p => `
            <button class="lang-add-btn" type="button" onclick="langAddItem('${p.type}')" title="${escapeHTML(p.hint)}">
              <i data-lucide="${p.icon}"></i> ${escapeHTML(p.name)}
            </button>`).join('')}
        </div>
        ${(s.items || []).map((it, i) => langItemFormHTML(it, i)).join('') || '<p class="lang-form-hint">No questions yet — add one above.</p>'}
      </div>
    </div>

    <div class="modal-actions" style="justify-content:flex-end; gap:0.5rem;">
      <button class="btn btn-secondary" onclick="langCancelDraft()">Cancel</button>
      <button class="btn btn-primary" onclick="langSaveSetDraft()"><i data-lucide="check" style="width:15px;height:15px;"></i> Save set</button>
    </div>`;
}

function langItemFormHTML(it, i) {
  const meta = langPuzzleMeta(it.type);
  const common = `
    <div class="af-field">
      <label class="form-label">Prompt ${it.type === 'blank' ? '<span class="af-label-hint">(write ___ where the blank goes)</span>' : ''}</label>
      <input class="form-input" data-item="${i}.prompt" value="${escapeHTML(it.prompt)}"
             placeholder="${it.type === 'blank' ? 'Kinsa ___ ?' : 'What the learner sees'}" />
    </div>`;

  let specific = '';
  if (it.type === 'arrange' || it.type === 'translate' || it.type === 'blank') {
    specific = `
      <div class="af-field">
        <label class="form-label">${it.type === 'blank' ? 'The missing word' : 'Correct answer'}</label>
        <input class="form-input" data-item="${i}.answer" value="${escapeHTML(it.answer)}"
               placeholder="${it.type === 'arrange' ? 'The full sentence, in order' : 'The answer'}" />
      </div>
      ${it.type !== 'translate' ? `
      <div class="af-field">
        <label class="form-label">Extra tiles <span class="af-label-hint">(comma separated — wrong words to mix in)</span></label>
        <input class="form-input" data-item="${i}.distractors" value="${escapeHTML((it.distractors || []).join(', '))}" placeholder="unsa, asa, ngano" />
      </div>` : ''}`;
  } else if (it.type === 'choice') {
    const opts = (it.options && it.options.length ? it.options : ['', '', '', '']).slice(0, 4);
    specific = `
      <div class="af-field">
        <label class="form-label">Answers <span class="af-label-hint">(tick the correct one)</span></label>
        ${opts.map((o, k) => `
          <div class="lang-opt-row">
            <input type="radio" name="lang-correct-${i}" data-item="${i}.correctIndex" value="${k}" ${it.correctIndex === k ? 'checked' : ''} />
            <input class="form-input" data-item="${i}.options.${k}" value="${escapeHTML(o)}" placeholder="Answer ${k + 1}" />
          </div>`).join('')}
      </div>`;
  } else if (it.type === 'match') {
    const pairs = (it.pairs && it.pairs.length ? it.pairs : [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }]).slice(0, 6);
    specific = `
      <div class="af-field">
        <label class="form-label">Pairs</label>
        ${pairs.map((p, k) => `
          <div class="lang-opt-row">
            <input class="form-input" data-item="${i}.pairs.${k}.left" value="${escapeHTML(p.left)}" placeholder="Left ${k + 1}" />
            <span class="lang-pair-arrow"><i data-lucide="arrow-right"></i></span>
            <input class="form-input" data-item="${i}.pairs.${k}.right" value="${escapeHTML(p.right)}" placeholder="Right ${k + 1}" />
          </div>`).join('')}
      </div>`;
  }

  return `
    <div class="lang-item-card">
      <div class="lang-item-head">
        <span class="lang-item-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="lang-item-kind"><i data-lucide="${meta.icon}"></i> ${escapeHTML(meta.name)}</span>
        <div class="lang-item-tools">
          <button class="btn btn-ghost btn-sm" onclick="langMoveItem(${i}, -1)" title="Move up"><i data-lucide="chevron-up"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="langMoveItem(${i}, 1)" title="Move down"><i data-lucide="chevron-down"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="langRemoveItem(${i})" title="Remove"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      ${common}
      ${specific}
      <div class="af-field">
        <label class="form-label">Note after answering <span class="af-label-hint">(optional)</span></label>
        <input class="form-input" data-item="${i}.note" value="${escapeHTML(it.note || '')}" placeholder="Why this is the answer" />
      </div>
    </div>`;
}

/** Reads every data-item input back into the draft's items. */
function langCollectSetForm() {
  const s = langSetDraft;
  if (!s) return;
  const g = (id) => document.getElementById(id);
  if (g('lang-s-title')) s.title = g('lang-s-title').value;
  if (g('lang-s-desc')) s.description = g('lang-s-desc').value;
  if (g('lang-s-lang')) s.lang = g('lang-s-lang').value;
  if (g('lang-s-ref')) s.refLang = g('lang-s-ref').value;

  document.querySelectorAll('[data-item]').forEach(el => {
    const path = el.getAttribute('data-item').split('.');
    const idx = parseInt(path[0], 10);
    const it = s.items[idx];
    if (!it) return;
    const field = path[1];
    if (field === 'options') {
      if (!Array.isArray(it.options)) it.options = [];
      it.options[parseInt(path[2], 10)] = el.value;
    } else if (field === 'pairs') {
      if (!Array.isArray(it.pairs)) it.pairs = [];
      const k = parseInt(path[2], 10);
      it.pairs[k] = it.pairs[k] || { left: '', right: '' };
      it.pairs[k][path[3]] = el.value;
    } else if (field === 'correctIndex') {
      if (el.checked) it.correctIndex = parseInt(el.value, 10);
    } else if (field === 'distractors') {
      it.distractors = el.value.split(',').map(x => x.trim()).filter(Boolean);
    } else {
      it[field] = el.value;
    }
  });
}

function langAddItem(type) {
  langCollectSetForm();
  langSetDraft.items = langSetDraft.items || [];
  langSetDraft.items.push(langBlankItem(type));
  renderLangAdmin();
}

function langRemoveItem(i) {
  langCollectSetForm();
  langSetDraft.items.splice(i, 1);
  renderLangAdmin();
}

function langMoveItem(i, dir) {
  langCollectSetForm();
  const j = i + dir;
  const items = langSetDraft.items;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  renderLangAdmin();
}

function langSaveSetDraft() {
  langCollectSetForm();
  if (!(langSetDraft.title || '').trim()) {
    showMessage('Title required', 'Give the drill set a title first.', true);
    return;
  }
  langSaveSet(langSetDraft);
  const problems = langSetProblems(langSetDraft);
  langSetDraft = null;
  renderLangAdmin();
  if (typeof toast === 'function') {
    toast(problems.length ? `Saved — ${problems.length} thing${problems.length !== 1 ? 's' : ''} still to fix before it can run.` : 'Set saved.',
      { type: problems.length ? 'info' : 'success' });
  }
}

/* ── Scenarios ────────────────────────────────────────────── */

function langScenarioListHTML() {
  const rows = langScenarios().map(s => `
    <tr>
      <td><strong>${escapeHTML(s.title || 'Untitled')}</strong></td>
      <td>${escapeHTML(langLocation(s.location).name)}</td>
      <td>${escapeHTML(s.npc || '—')}</td>
      <td>${(s.encounters || []).length}</td>
      <td class="lang-admin-actions">
        <button class="btn btn-ghost btn-sm" onclick="langEditScenarioDraft('${s.id}')" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="langAdminDeleteScenario('${s.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`).join('');
  return `
    <div class="lang-admin-bar">
      <button class="btn btn-primary" onclick="langNewScenarioDraft()"><i data-lucide="plus" style="width:15px;height:15px;"></i> New scenario</button>
      <span class="lang-admin-count">${langScenarios().length} scenario${langScenarios().length !== 1 ? 's' : ''}</span>
    </div>
    <table class="lang-admin-table">
      <thead><tr><th>Title</th><th>Location</th><th>Opponent</th><th>Encounters</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5"><em>No scenarios yet.</em></td></tr>'}</tbody>
    </table>`;
}

function langNewScenarioDraft() { langScenarioDraft = langBlankScenario(); renderLangAdmin(); }
function langEditScenarioDraft(id) {
  const s = langFindScenario(id);
  if (!s) return;
  langScenarioDraft = JSON.parse(JSON.stringify(s));
  renderLangAdmin();
}
function langAdminDeleteScenario(id) {
  const s = langFindScenario(id);
  if (!s) return;
  showConfirm('Delete scenario?', `Delete "${s.title || 'Untitled'}"? You can undo this.`, () => { langDeleteScenario(id); renderLangAdmin(); });
}

function langScenarioFormHTML() {
  const s = langScenarioDraft;
  return `
    <div class="af-section">
      <div class="af-section-header"><i data-lucide="swords" class="af-section-icon"></i><span>Scenario</span></div>
      <div class="af-section-body">
        <div class="af-row-2" style="gap:0.75rem;">
          <div class="af-field" style="flex:2;">
            <label class="form-label">Title</label>
            <input class="form-input af-input-bold" id="lang-sc-title" value="${escapeHTML(s.title)}" placeholder="e.g. Lunch queue small talk" />
          </div>
          <div class="af-field" style="flex:1;">
            <label class="form-label">Location</label>
            <select class="form-select" id="lang-sc-loc">
              ${LANG_LOCATIONS.map(l => `<option value="${l.key}"${s.location === l.key ? ' selected' : ''}>${escapeHTML(l.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="af-row-2" style="gap:0.75rem;">
          <div class="af-field" style="flex:1;">
            <label class="form-label">Who you meet</label>
            <input class="form-input" id="lang-sc-npc" value="${escapeHTML(s.npc)}" placeholder="e.g. Ate Marites" />
          </div>
          <div class="af-field" style="flex:1;">
            <label class="form-label">Your HP</label>
            <input class="form-input" type="number" min="20" max="500" id="lang-sc-hp" value="${s.playerHp}" />
          </div>
          <div class="af-field" style="flex:1;">
            <label class="form-label">Your MP</label>
            <input class="form-input" type="number" min="0" max="200" id="lang-sc-mp" value="${s.playerMana}" />
          </div>
          <div class="af-field" style="flex:1;">
            <label class="form-label">Their HP</label>
            <input class="form-input" type="number" min="20" max="500" id="lang-sc-nhp" value="${s.npcHp}" />
          </div>
        </div>
        <p class="lang-form-hint"><i data-lucide="construction"></i> Locations render as placeholder backdrops for now — the battle itself is live.</p>
      </div>
    </div>

    <div class="af-section">
      <div class="af-section-header"><i data-lucide="messages-square" class="af-section-icon"></i><span>Encounters (${(s.encounters || []).length})</span></div>
      <div class="af-section-body">
        <button class="btn btn-secondary" onclick="langAddEncounter()"><i data-lucide="plus" style="width:14px;height:14px;"></i> Add encounter</button>
        ${(s.encounters || []).map((e, i) => langEncounterFormHTML(e, i)).join('')
          || '<p class="lang-form-hint">No encounters yet.</p>'}
      </div>
    </div>

    <div class="modal-actions" style="justify-content:flex-end; gap:0.5rem;">
      <button class="btn btn-secondary" onclick="langCancelDraft()">Cancel</button>
      <button class="btn btn-primary" onclick="langSaveScenarioDraft()"><i data-lucide="check" style="width:15px;height:15px;"></i> Save scenario</button>
    </div>`;
}

function langEncounterFormHTML(e, i) {
  const opts = (e.options && e.options.length ? e.options : [{ text: '', correct: true }, { text: '', correct: false }]).slice(0, 4);
  return `
    <div class="lang-item-card">
      <div class="lang-item-head">
        <span class="lang-item-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="lang-item-kind"><i data-lucide="message-circle"></i> Encounter</span>
        <div class="lang-item-tools">
          <button class="btn btn-ghost btn-sm" onclick="langMoveEncounter(${i}, -1)" title="Move up"><i data-lucide="chevron-up"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="langMoveEncounter(${i}, 1)" title="Move down"><i data-lucide="chevron-down"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="langRemoveEncounter(${i})" title="Remove"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="af-field">
        <label class="form-label">Situation <span class="af-label-hint">(what is going on)</span></label>
        <input class="form-input" data-enc="${i}.situation" value="${escapeHTML(e.situation)}" placeholder="They cut in front of you in the queue" />
      </div>
      <div class="af-field">
        <label class="form-label">What they say</label>
        <input class="form-input" data-enc="${i}.line" value="${escapeHTML(e.line)}" placeholder="Kinsa ka?" />
      </div>
      <div class="af-field">
        <label class="form-label">Replies <span class="af-label-hint">(tick the one that fits)</span></label>
        ${opts.map((o, k) => `
          <div class="lang-opt-row">
            <input type="radio" name="lang-enc-${i}" data-enc="${i}.correct" value="${k}" ${o.correct ? 'checked' : ''} />
            <input class="form-input" data-enc="${i}.options.${k}.text" value="${escapeHTML(o.text)}" placeholder="Reply ${k + 1}" />
            <input class="form-input lang-opt-note" data-enc="${i}.options.${k}.note" value="${escapeHTML(o.note || '')}" placeholder="Why (optional)" />
          </div>`).join('')}
      </div>
      <div class="af-row-2" style="gap:0.75rem;">
        <div class="af-field" style="flex:1;">
          <label class="form-label">Damage on a good reply</label>
          <input class="form-input" type="number" min="1" max="100" data-enc="${i}.damage" value="${e.damage}" />
        </div>
        <div class="af-field" style="flex:1;">
          <label class="form-label">Backlash on a bad one</label>
          <input class="form-input" type="number" min="0" max="100" data-enc="${i}.backlash" value="${e.backlash}" />
        </div>
      </div>
    </div>`;
}

function langCollectScenarioForm() {
  const s = langScenarioDraft;
  if (!s) return;
  const g = (id) => document.getElementById(id);
  if (g('lang-sc-title')) s.title = g('lang-sc-title').value;
  if (g('lang-sc-loc')) s.location = g('lang-sc-loc').value;
  if (g('lang-sc-npc')) s.npc = g('lang-sc-npc').value;
  if (g('lang-sc-hp')) s.playerHp = Math.max(20, parseInt(g('lang-sc-hp').value, 10) || 100);
  if (g('lang-sc-mp')) s.playerMana = Math.max(0, parseInt(g('lang-sc-mp').value, 10) || 0);
  if (g('lang-sc-nhp')) s.npcHp = Math.max(20, parseInt(g('lang-sc-nhp').value, 10) || 100);

  document.querySelectorAll('[data-enc]').forEach(el => {
    const path = el.getAttribute('data-enc').split('.');
    const idx = parseInt(path[0], 10);
    const e = s.encounters[idx];
    if (!e) return;
    if (path[1] === 'options') {
      if (!Array.isArray(e.options)) e.options = [];
      const k = parseInt(path[2], 10);
      e.options[k] = e.options[k] || { text: '', correct: false, note: '' };
      e.options[k][path[3]] = el.value;
    } else if (path[1] === 'correct') {
      if (el.checked) {
        const k = parseInt(el.value, 10);
        if (!Array.isArray(e.options)) e.options = [];
        e.options.forEach((o, oi) => { if (o) o.correct = oi === k; });
      }
    } else if (path[1] === 'damage' || path[1] === 'backlash') {
      e[path[1]] = Math.max(0, parseInt(el.value, 10) || 0);
    } else {
      e[path[1]] = el.value;
    }
  });
}

function langAddEncounter() {
  langCollectScenarioForm();
  langScenarioDraft.encounters = langScenarioDraft.encounters || [];
  langScenarioDraft.encounters.push(langBlankEncounter());
  renderLangAdmin();
}

function langRemoveEncounter(i) {
  langCollectScenarioForm();
  langScenarioDraft.encounters.splice(i, 1);
  renderLangAdmin();
}

function langMoveEncounter(i, dir) {
  langCollectScenarioForm();
  const j = i + dir;
  const list = langScenarioDraft.encounters;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  renderLangAdmin();
}

function langSaveScenarioDraft() {
  langCollectScenarioForm();
  if (!(langScenarioDraft.title || '').trim()) {
    showMessage('Title required', 'Give the scenario a title first.', true);
    return;
  }
  langSaveScenario(langScenarioDraft);
  langScenarioDraft = null;
  renderLangAdmin();
  if (typeof toast === 'function') toast('Scenario saved.', { type: 'success' });
}

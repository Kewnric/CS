/* ============================================================
   Route: codex — the C Codex
   ------------------------------------------------------------
   Categories down the left, one entry (or a category's table) on the right.
   Operators, format codes, types and escapes open as tables: the precedence
   table, every printf code, every size. Search covers names, signatures
   and descriptions.

   An entry: what it is in one sentence, a little more, an example you can
   open in Freeground (it compiles: tools/verify-codex.js), the mistakes
   people make with it, the programs and templates of yours that use it,
   related entries, your own notes, and Add to cheat sheet / Quiz me.

   The same entries open from any editor with F1 (js/codex-lookup.js).
   ============================================================ */

const _cdx = { open: null, cat: null, q: '', shut: {} };

function codexTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll cdx">
        <div class="chub-top cdx-top">
          <button onclick="spaNavigate('coding')" class="btn-back-dark chub-back">
            <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Coding Library
          </button>
          <h1 class="cdx-h1"><i data-lucide="book-open-text"></i> C Codex</h1>
          <span class="cdx-progress" id="cdx-progress"></span>
        </div>
        <div class="search-container cdx-search">
          <i data-lucide="search"></i>
          <input type="text" id="cdx-q" class="search-input" placeholder="Look up an operator, a keyword, a function, a format code…" autocomplete="off" oninput="codexOnSearch()">
          <span class="search-shortcut-hint">/</span>
        </div>
        <div class="cdx-layout">
          <nav class="cdx-nav" id="cdx-nav" aria-label="Codex"></nav>
          <section class="cdx-main" id="cdx-main" aria-live="polite"></section>
        </div>
      </div>
    </div>`;
}

function codexInit() {
  codexStore();
  const want = getSessionParam('codexOpen');
  clearSessionParam('codexOpen');
  if (want && codexFind(want)) { _cdx.open = want; _cdx.cat = null; }
  _cdx.q = '';
  codexRenderNav();
  codexRenderMain();
  _cdx.onKey = (e) => {
    if (e.key === '/' && !(typeof _shortcutInEditable === 'function' && _shortcutInEditable(e))) {
      e.preventDefault();
      const q = document.getElementById('cdx-q');
      if (q) q.focus();
    }
  };
  document.addEventListener('keydown', _cdx.onKey);
  if (typeof GuidedTutorial !== 'undefined') GuidedTutorial.init('codex');
}

function codexDestroy() {
  if (_cdx.onKey) document.removeEventListener('keydown', _cdx.onKey);
  clearTimeout(_cdx.noteTimer);
}

/** Open an entry from anywhere in the app. */
function codexOpen(id) {
  if (document.body.dataset.route === 'codex') { codexShow(id); return; }
  setSessionParam('codexOpen', id);
  spaNavigate('codex');
}

function codexShow(id) {
  _cdx.open = id; _cdx.cat = null;
  codexRenderNav();
  codexRenderMain();
  const main = document.getElementById('cdx-main');
  if (main && main.scrollIntoView) main.scrollTop = 0;
}

function codexShowCat(cat) {
  _cdx.cat = cat; _cdx.open = null;
  codexRenderNav();
  codexRenderMain();
}

function codexToggleCat(cat) {
  _cdx.shut[cat] = !_cdx.shut[cat];
  codexRenderNav();
}

function codexOnSearch() {
  _cdx.q = (document.getElementById('cdx-q') || {}).value || '';
  codexRenderNav();
}

function codexRenderNav() {
  const nav = document.getElementById('cdx-nav');
  if (!nav) return;
  const all = codexAll();
  const usage = codexUsage();
  const used = all.filter(e => (usage[e.id] || []).length).length;
  const prog = document.getElementById('cdx-progress');
  if (prog) prog.innerHTML = _libStatChip('star', `${used} / ${all.length} used in your code`);
  const item = (e) => `<button type="button" class="cdx-item${_cdx.open === e.id ? ' is-on' : ''}" onclick="codexShow('${e.id}')">
      <code>${escapeHTML(e.n)}</code>${codexStarsHTML(e.id)}</button>`;
  if (_cdx.q.trim()) {
    const hits = codexSearch(_cdx.q);
    nav.innerHTML = `<div class="cdx-results">${hits.length ? hits.slice(0, 60).map(item).join('') : '<p class="atpl-hint">Nothing matches.</p>'}</div>`;
  } else {
    nav.innerHTML = CODEX_CATS.map(c => {
      const list = all.filter(e => e.c === c.id);
      const shut = !!_cdx.shut[c.id];
      return `
        <div class="cdx-cat">
          <div class="cdx-cat-head${_cdx.cat === c.id ? ' is-on' : ''}">
            <button type="button" class="cdx-cat-fold" onclick="codexToggleCat('${c.id}')" aria-expanded="${!shut}" aria-label="${shut ? 'Open' : 'Close'} ${escapeHTML(c.name)}">
              <i data-lucide="${shut ? 'chevron-right' : 'chevron-down'}"></i></button>
            <button type="button" class="cdx-cat-name" onclick="codexShowCat('${c.id}')"><i data-lucide="${c.icon}"></i> ${escapeHTML(c.name)} <em>${list.length}</em></button>
          </div>
          ${shut ? '' : `<div class="cdx-cat-items">${list.map(item).join('')}</div>`}
        </div>`;
    }).join('');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: nav });
}

function codexRenderMain() {
  const main = document.getElementById('cdx-main');
  if (!main) return;
  if (_cdx.open) main.innerHTML = _cdxEntryHTML(codexFind(_cdx.open));
  else if (_cdx.cat) main.innerHTML = _cdxCatHTML(_cdx.cat);
  else main.innerHTML = `
    <div class="cdx-welcome">
      <i data-lucide="book-open-text"></i>
      <h2>Every piece of C the course uses, in one place.</h2>
      <p>Pick a category or search. Operators, format codes, types and escapes open as tables.</p>
      <p><kbd>F1</kbd> on a word in any editor (or <kbd>Alt</kbd>+click it) opens its entry right there, without leaving your code.</p>
      <p class="atpl-hint">An entry earns a star when you open it, a second when it shows up in a program you have passed or a template you have learned, and a third when it is in five of them.</p>
    </div>`;
  if (_cdx.open) {
    codexMarkSeen(_cdx.open);
    const note = document.getElementById('cdx-note');
    if (note) note.addEventListener('input', () => {
      clearTimeout(_cdx.noteTimer);
      _cdx.noteTimer = setTimeout(() => codexSetNote(_cdx.open, note.value), 400);
    });
  }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: main });
}

function _cdxCode(src) {
  return typeof syntaxHighlight === 'function' ? syntaxHighlight(src) : escapeHTML(src);
}

function _cdxEntryHTML(e) {
  if (!e) return '<p class="atpl-hint">That entry is not here.</p>';
  const cat = CODEX_CATS.find(c => c.id === e.c) || { name: '' };
  const used = codexUsage()[e.id] || [];
  const note = codexStore().notes[e.id] || '';
  const rel = (e.r || []).map(codexFind).filter(Boolean);
  const tpls = (state.templates || []).filter(t => tplTokens(tplCanonical(t)).indexOf(e.n) !== -1).slice(0, 6);
  return `
    <article class="cdx-entry">
      <div class="cdx-kicker"><button class="cdx-link" onclick="codexShowCat('${e.c}')">${escapeHTML(cat.name)}</button>${e.h && e.h !== cat.name ? ' · <code>#include &lt;' + escapeHTML(e.h) + '&gt;</code>' : ''}${e.size ? ' · ' + escapeHTML(e.size) + ' byte' + (e.size === '1' ? '' : 's') : ''}</div>
      <h2 class="cdx-name"><code>${escapeHTML(e.n)}</code> ${codexStarsHTML(e.id)}</h2>
      ${e.s ? `<pre class="cdx-sig"><code>${_cdxCode(e.s)}</code></pre>` : ''}
      <p class="cdx-lead">${escapeHTML(e.d)}</p>
      ${e.x ? `<p class="cdx-more">${escapeHTML(e.x)}</p>` : ''}
      ${e.ex ? `
        <div class="cdx-ex">
          <div class="cdx-ex-head"><span>Example${/\bmain\s*\(/.test(e.ex) ? '' : ' (inside main)'}</span>
            <span class="cdx-ex-actions">
              <button class="btn btn-ghost btn-sm" onclick="codexToFreeground('${e.id}')"><i data-lucide="terminal"></i> Freeground</button>
              <button class="btn btn-ghost btn-sm" onclick="codexQuiz('${e.id}')"><i data-lucide="brain-circuit"></i> Quiz me</button>
            </span></div>
          <pre class="cdx-code"><code>${_cdxCode(e.ex)}</code></pre>
          ${e.out !== null && e.out !== undefined ? `<div class="cdx-out"><span>prints</span><pre>${escapeHTML(e.out)}</pre></div>` : ''}
        </div>` : ''}
      ${(e.m || []).length ? `<h3 class="cdx-h3"><i data-lucide="alert-triangle"></i> Common mistakes</h3><ul class="cdx-mistakes">${e.m.map(m => `<li>${escapeHTML(m)}</li>`).join('')}</ul>` : ''}
      ${e.c === 'errors' ? '<p><button class="btn btn-secondary btn-sm" onclick="localStorage.setItem(\'ssp.thubTab\', \'mistakes\'); spaNavigate(\'training\')"><i data-lucide="bug"></i> See how often you make it</button></p>' : ''}
      ${rel.length ? `<h3 class="cdx-h3"><i data-lucide="link"></i> Related</h3><div class="cdx-rel">${rel.map(r => `<button class="cdx-chip" onclick="codexShow('${r.id}')"><code>${escapeHTML(r.n)}</code></button>`).join('')}</div>` : ''}
      <h3 class="cdx-h3"><i data-lucide="code-2"></i> In your code</h3>
      ${used.length ? `<p class="cdx-used">${used.slice(0, 12).map(t => escapeHTML(t)).join(' · ')}${used.length > 12 ? ' · …' : ''}</p>` : '<p class="atpl-hint">Not in a program you have passed or a template you have learned yet.</p>'}
      ${tpls.length ? `<div class="cdx-rel">${tpls.map(t => `<button class="cdx-chip" onclick="tplStartDrill('${escapeHTML(t.id)}', { back: 'codex' })"><i data-lucide="puzzle"></i> ${escapeHTML(t.title)}</button>`).join('')}</div>` : ''}
      <h3 class="cdx-h3"><i data-lucide="notebook-pen"></i> My notes</h3>
      <textarea class="form-textarea cdx-note" id="cdx-note" rows="3" placeholder="Your own words, an example of your own, what tripped you up…">${escapeHTML(note)}</textarea>
      <div class="cdx-actions">
        <button class="btn btn-secondary btn-sm" onclick="codexAddToSheet('${e.id}')"><i data-lucide="book-marked"></i> Add to cheat sheet</button>
      </div>
    </article>`;
}

function _cdxCatHTML(catId) {
  const cat = CODEX_CATS.find(c => c.id === catId);
  const list = codexAll().filter(e => e.c === catId);
  const link = (e) => `<button class="cdx-link" onclick="codexShow('${e.id}')"><code>${escapeHTML(e.n)}</code></button>`;
  let body = '';
  if (catId === 'operators') {
    const byName = {};
    list.forEach(e => { byName[e.n] = e; });
    const alias = { 'x++': '++', '++x': '++', 'x--': '--', '--x': '--', '+x': '+', '-x': '-', '*p': '*', '&x': '&' };
    body = `<p class="atpl-hint">Highest first: an operator higher up is done before one lower down. Associativity says which way a row is done when several meet.</p>
      <table class="cdx-table"><thead><tr><th>#</th><th>Operators</th><th>Associativity</th><th>What</th></tr></thead><tbody>
      ${CODEX_PRECEDENCE.map((row, i) => `<tr><td>${i + 1}</td><td>${row.ops.map(o => {
        const e = byName[alias[o] || o] || (o === 'sizeof' ? codexFind('kw-sizeof') : null);
        return e ? `<button class="cdx-link" onclick="codexShow('${e.id}')"><code>${escapeHTML(o)}</code></button>` : `<code>${escapeHTML(o)}</code>`;
      }).join(' ')}</td><td>${escapeHTML(row.assoc)}</td><td>${escapeHTML(row.what)}</td></tr>`).join('')}
      </tbody></table>`;
  } else if (catId === 'formats') {
    body = `<table class="cdx-table"><thead><tr><th>Code</th><th>What it prints or reads</th><th>Example</th><th>Prints</th></tr></thead><tbody>
      ${list.map(e => `<tr><td>${link(e)}</td><td>${escapeHTML(e.d)}</td><td><code>${escapeHTML((e.ex || '').split('\n').pop())}</code></td><td><pre>${e.out === null ? '(an address)' : escapeHTML((e.out || '').replace(/\n$/, ''))}</pre></td></tr>`).join('')}
      </tbody></table>`;
  } else if (catId === 'types') {
    body = `<p class="atpl-hint">Sizes with gcc on a 64-bit computer. The in-browser compiler is 32-bit: there long, size_t and pointers are 4 bytes.</p>
      <table class="cdx-table"><thead><tr><th>Type</th><th>Bytes</th><th>What it holds</th></tr></thead><tbody>
      ${list.map(e => `<tr><td>${link(e)}</td><td>${escapeHTML(e.size || '')}</td><td>${escapeHTML(e.d)}</td></tr>`).join('')}
      </tbody></table>`;
  } else if (catId === 'escapes') {
    body = `<table class="cdx-table"><thead><tr><th>Write</th><th>Means</th></tr></thead><tbody>
      ${list.map(e => `<tr><td>${link(e)}</td><td>${escapeHTML(e.d)}</td></tr>`).join('')}
      </tbody></table>`;
  } else {
    body = `<div class="cdx-cards">${list.map(e => `
      <button class="cdx-card" onclick="codexShow('${e.id}')">
        <span class="cdx-card-top"><code>${escapeHTML(e.n)}</code>${codexStarsHTML(e.id)}</span>
        <span class="cdx-card-d">${escapeHTML(e.d)}</span>
      </button>`).join('')}</div>`;
  }
  return `<div class="cdx-catview"><h2 class="cdx-name"><i data-lucide="${cat.icon}"></i> ${escapeHTML(cat.name)}</h2>${body}</div>`;
}

function codexToFreeground(id) {
  const e = codexFind(id);
  if (!e || !e.ex || typeof fgOpen !== 'function') return;
  fgOpen({ newTab: { name: e.n, files: [{ name: 'main', ext: '.c', code: codexProgram(e) }], from: 'codex:' + id }, back: 'codex' });
}

/** Questions made from the entry's example: blanks if it has any, else predict. */
function codexQuiz(id) {
  const src = 'codex:' + id;
  const mode = ['blanks', 'predict', 'fix'].find(m => drillDeckFrom(m, src, 1).length);
  if (!mode) { if (typeof toast === 'function') toast('This example is too short to make a question from.', { type: 'info' }); return; }
  setSessionParam('drillSourceOnce', src);
  setSessionParam('drillModeOnce', mode);
  spaNavigate('drills');
}

function codexAddToSheet(id) {
  const ok = codexToCheatSheet(id);
  if (typeof toast === 'function') toast(ok ? 'Added to the cheat sheet "C Codex notes".' : 'The cheat sheets could not be opened.', { type: ok ? 'success' : 'warning', duration: 2400 });
}

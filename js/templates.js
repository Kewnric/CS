/* ============================================================
   TEMPLATES.JS — reusable code shapes with parts that change
   ------------------------------------------------------------
   A template is a block of C you will write again and again with different
   names: a linked-list push, a binary search, a scanf loop. The parts that
   change are SLOTS, written in the body as

       ⟦name:default⟧        e.g.  struct ⟦Type:Node⟧ *⟦p:head⟧

   The same name always takes the same value. With every slot at its default
   the text is the template's CANONICAL form; with a new value set it is a
   VARIATION ("now for struct Book, key isbn").

   This file is the rules only -- no DOM -- so the drill (template-attempt),
   the admin and tools/test-templates.js all share one definition. Under Node
   it exports through module.exports.

   A template record (state.templates):
     { id, title, label, body, pool: [{ slot: value }], harness, tags,
       concepts, sourceType, sourceId, builtin, parentId, createdAt, updatedAt }
   harness (optional) = { prelude, code, stdin, expect }: the program the
   answer is compiled inside (prelude + answer + code) and the output it
   must print. Slots work in the harness too.
   ============================================================ */

const TPL_OPEN = '⟦';   // ⟦
const TPL_CLOSE = '⟧';  // ⟧
const TPL_SLOT_RE = /⟦([A-Za-z_]\w*)(?::([^⟧\n]*))?⟧/g;

const TPL_STAGES = [
  { n: 1, key: 'copy',    name: 'Copy',    hint: 'The whole template is beside the editor. Type it.' },
  { n: 2, key: 'half',    name: 'Half',    hint: 'About half the lines are gone. Fill them in.' },
  { n: 3, key: 'outline', name: 'Outline', hint: 'Only the outline is left. Write the body.' },
  { n: 4, key: 'recall',  name: 'Recall',  hint: 'Just the label. Write all of it from memory.' },
  { n: 5, key: 'vary',    name: 'Vary',    hint: 'The same shape with new names. Write it with these.' }
];

const TPL_PASS_DEFAULT = 95;
const TPL_PEEK_COST = 10;

const TPL_C_KEYWORDS = new Set(('auto break case char const continue default do double else enum extern float for goto if inline '
  + 'int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while '
  + '_Bool _Complex _Imaginary bool true false NULL main printf scanf malloc free calloc realloc sizeof strlen strcpy '
  + 'strcmp strcat fopen fclose fgets fprintf fscanf getchar putchar puts exit EOF FILE size_t').split(/\s+/));

/* Values a slot can take in a variation, chosen by the shape of its default.
   Types (int, long, double...) only change through a template's own pool,
   because a harness prints them with fixed formats. */
const TPL_POOLS = {
  title: ['Book', 'Song', 'Item', 'Order', 'Planet', 'Player', 'Car', 'Course', 'Ticket', 'Recipe', 'Movie', 'Pet'],
  lower: ['score', 'price', 'age', 'total', 'amount', 'level', 'weight', 'height', 'points', 'stock', 'rating', 'speed', 'marks', 'budget', 'qty'],
  fn: ['compute', 'process', 'measure', 'tally', 'evaluate', 'calculate', 'handle', 'scan_all', 'crunch', 'solve']
};

/** Is this text a C identifier? */
function tplIsIdent(s) { return /^[A-Za-z_]\w*$/.test(String(s || '')); }

/**
 * The slots of a body, in first-seen order. A name seen twice with two
 * different defaults keeps the first and reports the second.
 * @returns {{slots: Array<{name: string, def: string}>, errors: string[]}}
 */
function tplParse(body) {
  const text = String(body || '');
  const slots = [];
  const errors = [];
  const seen = {};
  TPL_SLOT_RE.lastIndex = 0;
  let m;
  while ((m = TPL_SLOT_RE.exec(text))) {
    const name = m[1];
    const def = m[2] === undefined ? '' : m[2];
    if (!Object.prototype.hasOwnProperty.call(seen, name)) {
      seen[name] = def;
      slots.push({ name, def });
    } else if (m[2] !== undefined && def !== seen[name]) {
      errors.push('Slot "' + name + '" has two defaults: "' + seen[name] + '" and "' + def + '". The first is used.');
    }
  }
  // A bracket that is not part of a slot is a typing slip, and would otherwise
  // end up in the code you are asked to write.
  const stray = text.replace(TPL_SLOT_RE, '');
  if (stray.indexOf(TPL_OPEN) !== -1 || stray.indexOf(TPL_CLOSE) !== -1) {
    errors.push('There is a ' + TPL_OPEN + ' or ' + TPL_CLOSE + ' that is not part of a slot.');
  }
  return { slots, errors };
}

/** Every slot's default, as a map. Defaults from `extra` texts fill in names the body lacks. */
function tplDefaults(body, extra) {
  const out = {};
  [body].concat(extra || []).forEach(t => {
    tplParse(t).slots.forEach(s => { if (!Object.prototype.hasOwnProperty.call(out, s.name)) out[s.name] = s.def; });
  });
  return out;
}

/**
 * The text with each slot replaced by its value (or its default).
 * @param {string} text
 * @param {Object<string,string>} [values]
 * @param {Object<string,string>} [defaults] defaults for slots written with no default here
 */
function tplFill(text, values, defaults) {
  const v = values || {};
  // A slot written bare (⟦Type⟧) takes the default given elsewhere in the text.
  const d = defaults || tplDefaults(text);
  return String(text || '').replace(TPL_SLOT_RE, (all, name, def) => {
    if (Object.prototype.hasOwnProperty.call(v, name)) return String(v[name]);
    if (def !== undefined) return def;
    return Object.prototype.hasOwnProperty.call(d, name) ? String(d[name]) : name;
  });
}

/** The template with every slot at its default. */
function tplCanonical(tpl) { return tplFill(tpl && tpl.body); }

/** Every text the slots appear in: body and harness. */
function _tplTexts(tpl) {
  const h = (tpl && tpl.harness) || {};
  return [tpl && tpl.body, h.prelude, h.code].filter(t => typeof t === 'string' && t);
}

/* Identifiers in the template that are not slots: a value equal to one of
   these would change what the code means. */
function _tplFixedIdents(tpl) {
  const out = new Set();
  _tplTexts(tpl).forEach(t => {
    const rest = String(t).replace(TPL_SLOT_RE, ' ').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ' ');
    (rest.match(/[A-Za-z_]\w*/g) || []).forEach(w => out.add(w));
  });
  return out;
}

/**
 * Can these values stand in for the template's slots? '' when they can,
 * otherwise the reason.
 */
function tplCheckValues(tpl, values) {
  const defs = tplDefaults(tpl && tpl.body, _tplTexts(tpl).slice(1));
  const fixed = _tplFixedIdents(tpl);
  const used = {};
  for (const name of Object.keys(defs)) {
    const val = Object.prototype.hasOwnProperty.call(values || {}, name) ? String(values[name]) : defs[name];
    if (tplIsIdent(defs[name])) {
      if (!tplIsIdent(val)) return '"' + val + '" is not a name C allows (for ' + name + ').';
      if (TPL_C_KEYWORDS.has(val) && val !== defs[name]) return '"' + val + '" is a C keyword or library name.';
      if (fixed.has(val) && val !== defs[name]) return '"' + val + '" is already used in the template.';
    }
    if (used[val] && used[val] !== name && tplIsIdent(val)) return name + ' and ' + used[val] + ' would both be "' + val + '".';
    used[val] = name;
  }
  return '';
}

/** A small seeded random generator (mulberry32): the same seed, the same sequence. */
function tplRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _tplPick(list, rnd) { return list[Math.floor(rnd() * list.length) % list.length]; }

/* A fresh value for one slot from the pool that fits its default's shape, or
   the default itself when nothing should change (types, numbers, macros). */
function _tplGenerate(name, def, rnd) {
  if (!tplIsIdent(def) || TPL_C_KEYWORDS.has(def)) return def;
  if (/^[A-Z][A-Z0-9_]+$/.test(def)) return def;                 // a macro
  if (/^fn/i.test(name)) return _tplPick(TPL_POOLS.fn, rnd);
  if (/^[A-Z]/.test(def)) return _tplPick(TPL_POOLS.title, rnd);
  return _tplPick(TPL_POOLS.lower, rnd);
}

/**
 * A variation: new values for the slots, drawn from the template's own pool
 * when it has valid sets, otherwise generated. Same seed, same variation.
 * @returns {{values: Object<string,string>, seed: number}|null} null when no
 *   valid variation exists (a template with no slots, say)
 */
function tplVariation(tpl, seed) {
  const defs = tplDefaults(tpl && tpl.body, _tplTexts(tpl).slice(1));
  const names = Object.keys(defs);
  if (!names.length) return null;
  const s = (Number(seed) >>> 0) || 1;
  const rnd = tplRng(s);
  const pool = ((tpl && tpl.pool) || []).filter(set => set && typeof set === 'object' && !tplCheckValues(tpl, set));
  if (pool.length) return { values: Object.assign({}, pool[Math.floor(rnd() * pool.length)]), seed: s };
  for (let attempt = 0; attempt < 40; attempt++) {
    const values = {};
    names.forEach(n => { values[n] = _tplGenerate(n, defs[n], rnd); });
    const changed = names.some(n => values[n] !== defs[n]);
    if (changed && !tplCheckValues(tpl, values)) return { values, seed: s };
  }
  return null;
}

/** The slots whose value differs from the default, as "Type → Book" lines. */
function tplDescribeValues(tpl, values) {
  const defs = tplDefaults(tpl && tpl.body, _tplTexts(tpl).slice(1));
  return Object.keys(defs).filter(n => values && values[n] !== undefined && values[n] !== defs[n])
    .map(n => ({ name: n, from: defs[n], to: String(values[n]) }));
}

/* ── What each stage shows ─────────────────────────────────── */

/* Lines worth blanking: code, not braces, blank lines or preprocessor. */
function _tplContentLine(line) {
  const t = line.trim();
  return !!t && !/^[{}]+;?$/.test(t) && !/^#/.test(t) && t !== '};';
}

/**
 * Stage 2: the text with about half its code lines emptied (indent kept).
 * Lines that hold a slot or a call are blanked first. Same seed, same lines.
 * @returns {{text: string, blanked: number[]}} blanked = 0-based line numbers
 */
function tplHalf(tpl, seed) {
  const body = String((tpl && tpl.body) || '');
  const lines = tplFill(body).split('\n');
  const marked = body.split('\n');
  const rnd = tplRng(seed);
  const cand = [];
  lines.forEach((l, i) => {
    if (!_tplContentLine(l)) return;
    const weight = 1 + ((marked[i] || '').indexOf(TPL_OPEN) !== -1 ? 1 : 0) + (/\w\s*\(/.test(l) ? 1 : 0);
    cand.push({ i, key: rnd() * weight });
  });
  cand.sort((a, b) => b.key - a.key);
  const take = Math.max(1, Math.ceil(cand.length / 2));
  const blanked = cand.slice(0, take).map(c => c.i).sort((a, b) => a - b);
  const out = lines.map((l, i) => blanked.indexOf(i) === -1 ? l : (l.match(/^\s*/)[0]));
  return { text: out.join('\n'), blanked };
}

/**
 * Stage 3: only the top level -- includes, signatures, struct headers and
 * their closing braces -- with one empty, indented line inside each block.
 */
function tplOutline(tpl) {
  const lines = tplFill((tpl && tpl.body) || '').split('\n');
  const out = [];
  let depth = 0;
  let holeAdded = false;
  lines.forEach(l => {
    const opens = (l.match(/\{/g) || []).length;
    const closes = (l.match(/\}/g) || []).length;
    const start = depth;
    depth = Math.max(0, depth + opens - closes);
    if (start === 0) {
      out.push(l);
      holeAdded = false;
    } else if (depth === 0) {
      if (!holeAdded) out.push('    ');
      out.push(l);
      holeAdded = false;
    } else if (!holeAdded) {
      out.push('    ');
      holeAdded = true;
    }
  });
  return out.join('\n');
}

/* ── Marking ───────────────────────────────────────────────── */

const TPL_TOKEN = /\s+|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|[A-Za-z_]\w*|\.?\d[\w.]*|->|\+\+|--|<<=|>>=|<<|>>|&&|\|\||[-+*\/%&|^!=<>]=|./y;

/** The code tokens of C source: no whitespace, no comments. */
function tplTokens(src) {
  const text = String(src || '').replace(/\/\*[\s\S]*?(\*\/|$)/g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const out = [];
  let i = 0;
  while (i < text.length) {
    TPL_TOKEN.lastIndex = i;
    const m = TPL_TOKEN.exec(text);
    const t = m ? m[0] : text[i];
    if (!/^\s+$/.test(t)) out.push(t);
    i += t.length;
  }
  return out;
}

/** Length of the longest common subsequence of two token lists. */
function _tplLcs(a, b) {
  const n = a.length, m = b.length;
  if (!n || !m) return 0;
  let prev = new Uint16Array(m + 1), cur = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : (prev[j] > cur[j - 1] ? prev[j] : cur[j - 1]);
    }
    const t = prev; prev = cur; cur = t;
    cur.fill(0);
  }
  return prev[m];
}

/**
 * How close an answer is to the target, 0-100, as C tokens: spacing, line
 * breaks and comments never count. Extra tokens cost as much as missing ones,
 * so pasting the target twice does not score 100.
 */
function tplScore(answer, target) {
  const a = tplTokens(answer), b = tplTokens(target);
  if (!b.length) return a.length ? 0 : 100;
  const common = _tplLcs(a, b);
  const score = (2 * common) / (a.length + b.length);
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

/** Output compared the way a person reads it: spaces at line ends and the
    final newlines do not count (compilers and runners differ on them). */
function tplSameOutput(got, expect) {
  const norm = (s) => String(s || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
  return norm(got) === norm(expect);
}

/** The program a harness runs: prelude, the answer, the harness's own code. */
function tplHarnessSource(tpl, answer, values) {
  const h = tpl && tpl.harness;
  if (!h || !h.code) return '';
  const defs = tplDefaults(tpl.body, _tplTexts(tpl).slice(1));
  return [tplFill(h.prelude || '', values, defs), String(answer || ''), tplFill(h.code, values, defs)].join('\n');
}

/* ── Writing templates (the admin) ─────────────────────────── */

/* Code tokens with their positions, strings, comments and slots kept whole,
   so marking a name never reaches inside a string, a comment or a slot. */
const TPL_SCAN = /⟦[^⟧\n]*⟧|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|[A-Za-z_]\w*|[\s\S]/g;

/**
 * Turn the selection [start, end) of a body into slot `name`, with the
 * selected text as its default. With `all`, every other place the same name
 * appears as code (not in a string, comment or slot) becomes the slot too.
 * @returns {{body: string, count: number, error: string}}
 */
function tplMarkSlot(body, start, end, name, all) {
  const text = String(body || '');
  const sel = text.slice(start, end);
  if (!tplIsIdent(name)) return { body: text, count: 0, error: 'A slot name must be a C name: letters, digits and _, not starting with a digit.' };
  if (!sel || /\n/.test(sel)) return { body: text, count: 0, error: 'Select some text on one line first.' };
  if (sel.indexOf(TPL_OPEN) !== -1 || sel.indexOf(TPL_CLOSE) !== -1) return { body: text, count: 0, error: 'That is already part of a slot.' };
  const existing = tplParse(text).slots.find(s => s.name === name);
  if (existing && existing.def !== sel) return { body: text, count: 0, error: 'Slot "' + name + '" already stands for "' + existing.def + '".' };
  const mark = existing ? TPL_OPEN + name + TPL_CLOSE : TPL_OPEN + name + ':' + sel + TPL_CLOSE;
  const bare = TPL_OPEN + name + TPL_CLOSE;
  if (!all || !tplIsIdent(sel)) {
    return { body: text.slice(0, start) + mark + text.slice(end), count: 1, error: '' };
  }
  let out = '', count = 0, first = true, m;
  TPL_SCAN.lastIndex = 0;
  while ((m = TPL_SCAN.exec(text))) {
    const tok = m[0];
    if (tok === sel && tplIsIdent(tok)) {
      const useDefault = first && !existing && (m.index === start || count === 0);
      out += useDefault ? mark : bare;
      if (useDefault) first = false;
      count++;
    } else {
      out += tok;
    }
  }
  // Part of a longer name was selected: there is nothing whole to match, so
  // mark just the selection.
  if (!count) return { body: text.slice(0, start) + mark + text.slice(end), count: 1, error: '' };
  return { body: out, count, error: '' };
}

/**
 * The variation pool as written in the admin: one set per line,
 * "Type=Book, field=isbn". Each set is checked against the template.
 * @returns {{sets: Array<Object>, errors: string[]}}
 */
function tplParsePool(text, tpl) {
  const sets = [], errors = [];
  String(text || '').split('\n').forEach((line, i) => {
    const l = line.trim();
    if (!l || l.startsWith('#')) return;
    const set = {};
    let bad = '';
    l.split(',').forEach(pair => {
      const p = pair.trim();
      if (!p) return;
      const at = p.indexOf('=');
      if (at < 1) { bad = 'write name=value'; return; }
      set[p.slice(0, at).trim()] = p.slice(at + 1).trim();
    });
    if (!bad && tpl) bad = tplCheckValues(tpl, set);
    if (bad) errors.push('Line ' + (i + 1) + ': ' + bad);
    else if (Object.keys(set).length) sets.push(set);
  });
  return { sets, errors };
}

/** The pool back as the admin writes it. */
function tplPoolText(pool) {
  return (pool || []).map(set => Object.keys(set).map(k => k + '=' + set[k]).join(', ')).join('\n');
}

/* The text format templates are exported in and imported from -- plain
   enough to write by hand or to ask any AI chat for. */
const TPL_SECTIONS = ['body', 'prelude', 'harness', 'stdin', 'expect'];

/** Templates as text, in the import format. */
function tplExportText(list) {
  return (list || []).map(t => {
    const lines = ['=== template', 'title: ' + (t.title || ''), 'label: ' + (t.label || '')];
    if ((t.tags || []).length) lines.push('tags: ' + t.tags.join(', '));
    if ((t.concepts || []).length) lines.push('concepts: ' + t.concepts.join(', '));
    if ((t.pool || []).length) lines.push('pool: ' + (t.pool || []).map(s => Object.keys(s).map(k => k + '=' + s[k]).join(', ')).join(' | '));
    lines.push('--- body', String(t.body || '').replace(/\n+$/, ''));
    const h = t.harness;
    if (h && h.code) {
      if (h.prelude) lines.push('--- prelude', h.prelude.replace(/\n+$/, ''));
      lines.push('--- harness', h.code.replace(/\n+$/, ''));
      if (h.stdin) lines.push('--- stdin', h.stdin.replace(/\n$/, ''));
      lines.push('--- expect', String(h.expect || '').replace(/\n$/, ''));
    }
    lines.push('=== end');
    return lines.join('\n');
  }).join('\n\n') + '\n';
}

/**
 * Read templates from the text format. Nothing is written: the admin shows
 * what was found and asks first.
 * @returns {{items: Array<Object>, errors: string[]}}
 */
function tplParseImport(text) {
  const items = [], errors = [];
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let cur = null, section = null, n = 0;
  const finish = () => {
    if (!cur) return;
    n++;
    const t = { title: cur.head.title || '', label: cur.head.label || '', body: (cur.sec.body || []).join('\n'),
      tags: (cur.head.tags || '').split(',').map(s => s.trim()).filter(Boolean),
      concepts: (cur.head.concepts || '').split(',').map(s => s.trim()).filter(Boolean), pool: [] };
    if (cur.sec.harness) {
      const block = (k) => (cur.sec[k] ? cur.sec[k].join('\n') : '');
      t.harness = { prelude: block('prelude') ? block('prelude') + '\n' : '', code: block('harness'),
        stdin: block('stdin') ? block('stdin') + '\n' : '', expect: block('expect') ? block('expect') + '\n' : '' };
    }
    if (cur.head.pool) {
      const p = tplParsePool(cur.head.pool.split('|').join('\n'), t);
      t.pool = p.sets;
      p.errors.forEach(e => errors.push('Template ' + n + ' pool: ' + e));
    }
    const parsed = tplParse(t.body);
    if (!t.title.trim()) errors.push('Template ' + n + ' has no title.');
    else if (!t.body.trim()) errors.push('"' + t.title + '" has no body.');
    else {
      parsed.errors.forEach(e => errors.push('"' + t.title + '": ' + e));
      items.push(tplNormal(t));
    }
    cur = null; section = null;
  };
  lines.forEach(line => {
    const head = /^===\s*(template|end)\s*$/i.exec(line.trim());
    if (head) {
      if (head[1].toLowerCase() === 'template') { finish(); cur = { head: {}, sec: {} }; section = null; }
      else finish();
      return;
    }
    if (!cur) return;
    const sec = /^---\s*([a-z]+)\s*$/i.exec(line.trim());
    if (sec && TPL_SECTIONS.indexOf(sec[1].toLowerCase()) !== -1) {
      section = sec[1].toLowerCase();
      cur.sec[section] = [];
      return;
    }
    if (section) { cur.sec[section].push(line); return; }
    const kv = /^([a-z]+)\s*:\s*(.*)$/i.exec(line);
    if (kv) cur.head[kv[1].toLowerCase()] = kv[2].trim();
  });
  finish();
  return { items, errors };
}

/** Instructions to paste into any AI chat, so its answer imports as it is. */
const TPL_AI_FORMAT = [
  'Write C code templates for a student to memorise, in exactly this format.',
  'Mark every name a student might change as a slot: ' + TPL_OPEN + 'name:default' + TPL_CLOSE + ' the first time,',
  'then ' + TPL_OPEN + 'name' + TPL_CLOSE + ' after that. Use the same slot name for the same thing everywhere.',
  'The harness is a main() that calls the template and prints a fixed result; expect is that exact output.',
  'Leave out the harness for code that needs files.',
  '',
  '=== template',
  'title: Sum of an array',
  'label: Add up every element of an int array and return the total.',
  'tags: arrays',
  'concepts: array, for, function',
  '--- body',
  'int ' + TPL_OPEN + 'fn:sum_array' + TPL_CLOSE + '(const int ' + TPL_OPEN + 'arr:values' + TPL_CLOSE + '[], int ' + TPL_OPEN + 'n:count' + TPL_CLOSE + ') {',
  '    int total = 0;',
  '    for (int i = 0; i < ' + TPL_OPEN + 'n' + TPL_CLOSE + '; i++) {',
  '        total += ' + TPL_OPEN + 'arr' + TPL_CLOSE + '[i];',
  '    }',
  '    return total;',
  '}',
  '--- prelude',
  '#include <stdio.h>',
  '--- harness',
  'int main(void) {',
  '    int data[] = {3, 5, 9, -2};',
  '    printf("%d\\n", ' + TPL_OPEN + 'fn' + TPL_CLOSE + '(data, 4));',
  '    return 0;',
  '}',
  '--- expect',
  '15',
  '=== end'
].join('\n');

/** A template record with every field present and of the right type. */
function tplNormal(t) {
  const o = Object.assign({}, t || {});
  const str = (x) => (typeof x === 'string' ? x : '');
  o.title = str(o.title).trim() || 'Untitled template';
  o.label = str(o.label).trim();
  o.body = str(o.body).replace(/\r\n/g, '\n');
  o.pool = Array.isArray(o.pool) ? o.pool.filter(p => p && typeof p === 'object' && !Array.isArray(p)) : [];
  o.tags = Array.isArray(o.tags) ? o.tags.map(String) : [];
  o.concepts = Array.isArray(o.concepts) ? o.concepts.map(String) : [];
  if (o.harness && typeof o.harness === 'object' && str(o.harness.code).trim()) {
    o.harness = { prelude: str(o.harness.prelude), code: str(o.harness.code), stdin: str(o.harness.stdin), expect: str(o.harness.expect) };
  } else {
    o.harness = null;
  }
  o.parentId = o.parentId || null;
  o.builtin = !!o.builtin;
  return o;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TPL_STAGES, TPL_POOLS, TPL_PASS_DEFAULT, TPL_PEEK_COST, tplParse, tplDefaults, tplFill, tplCanonical,
    tplCheckValues, tplRng, tplVariation, tplDescribeValues, tplHalf, tplOutline, tplTokens, tplScore,
    tplHarnessSource, tplSameOutput, tplNormal, tplIsIdent, tplMarkSlot, tplParsePool, tplPoolText, tplExportText,
    tplParseImport, TPL_AI_FORMAT
  };
}

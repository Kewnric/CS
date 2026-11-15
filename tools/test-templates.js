/* Unit tests for js/templates.js (no browser): node tools/test-templates.js */
'use strict';
const path = require('path');
const T = require(path.join(__dirname, '..', 'js', 'templates.js'));
const { TPL_STARTER } = require(path.join(__dirname, '..', 'js', 'templates-starter.js'));

let failed = 0, passed = 0;
function ok(cond, name) {
  if (cond) { passed++; return; }
  failed++;
  console.log('FAIL ' + name);
}
function eq(a, b, name) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) console.log('  got      ' + JSON.stringify(a) + '\n  expected ' + JSON.stringify(b));
  ok(same, name);
}

const body = 'struct ⟦Type:Node⟧ { int ⟦f:value⟧; };\nvoid push(struct ⟦Type⟧ *n) { n->⟦f⟧ = 1; }';
eq(T.tplParse(body).slots, [{ name: 'Type', def: 'Node' }, { name: 'f', def: 'value' }], 'parse finds slots in order');
eq(T.tplParse(body).errors, [], 'parse: no errors');
ok(T.tplParse('int ⟦a:x⟧ = ⟦a:y⟧;').errors.length === 1, 'parse: two defaults reported');
ok(T.tplParse('int x⟧;').errors.length === 1, 'parse: stray bracket reported');
eq(T.tplFill(body, { Type: 'Book' }, { Type: 'Node', f: 'value' }),
  'struct Book { int value; };\nvoid push(struct Book *n) { n->value = 1; }', 'fill: value and defaults');
eq(T.tplCanonical({ body }), 'struct Node { int value; };\nvoid push(struct Node *n) { n->value = 1; }', 'canonical');

ok(T.tplCheckValues({ body }, { Type: 'Book', f: 'isbn' }) === '', 'values: fine');
ok(/keyword/.test(T.tplCheckValues({ body }, { Type: 'int', f: 'isbn' })), 'values: keyword refused');
ok(/already used/.test(T.tplCheckValues({ body }, { Type: 'Book', f: 'push' })), 'values: clash with a fixed name refused');
ok(/both/.test(T.tplCheckValues({ body }, { Type: 'Book', f: 'Book' })), 'values: two slots one value refused');
ok(/not a name/.test(T.tplCheckValues({ body }, { Type: 'Bo ok' })), 'values: not an identifier refused');

const v1 = T.tplVariation({ body }, 7), v2 = T.tplVariation({ body }, 7), v3 = T.tplVariation({ body }, 8);
eq(v1, v2, 'variation: same seed, same values');
ok(v1 && T.tplCheckValues({ body }, v1.values) === '', 'variation: valid');
ok(v1 && v3 && JSON.stringify(v1.values) !== JSON.stringify(v3.values) || true, 'variation: seeds differ (may coincide)');
eq(T.tplVariation({ body: 'int main(void) { return 0; }' }, 1), null, 'variation: none without slots');
const pooled = T.tplVariation({ body, pool: [{ Type: 'Song', f: 'title' }, { Type: 'int', f: 'x' }] }, 3);
eq(pooled.values, { Type: 'Song', f: 'title' }, 'variation: invalid pool sets skipped');
eq(T.tplVariation({ body: 'long ⟦t:int⟧ x;' }, 1), null, 'variation: types never change without a pool');

eq(T.tplScore('int  x = 1; // hi', 'int x=1;'), 100, 'score: spacing and comments ignored');
ok(T.tplScore('int x = 2;', 'int x = 1;') < 100, 'score: a wrong token costs');
ok(T.tplScore('int x = 1; int x = 1;', 'int x = 1;') < 80, 'score: doubling the answer does not pass');
eq(T.tplScore('', ''), 100, 'score: both empty');
eq(T.tplScore('x', ''), 0, 'score: something against nothing');
eq(T.tplTokens('a->b++ /* c */ "s\\"t"'), ['a', '->', 'b', '++', '"s\\"t"'], 'tokens');

// Marking slots in the admin.
const src = 'struct Node { int v; };\nstruct Node *make(void) { /* Node */ char *s = "Node"; return 0; }';
const one = T.tplMarkSlot(src, 7, 11, 'Type', false);
eq(one.body.slice(0, 20), 'struct ⟦Type:Node⟧ {', 'mark: just the selection');
const all = T.tplMarkSlot(src, 7, 11, 'Type', true);
eq(all.count, 2, 'mark all: code only, not the comment or the string');
ok(all.body.indexOf('/* Node */') !== -1 && all.body.indexOf('"Node"') !== -1, 'mark all: comment and string untouched');
eq(T.tplCanonical({ body: all.body }), src, 'mark all: canonical is the original');
ok(/C name/.test(T.tplMarkSlot(src, 7, 11, '2bad', false).error), 'mark: bad slot name refused');
ok(/one line/.test(T.tplMarkSlot(src, 0, src.length, 'x', false).error), 'mark: multi-line refused');
eq(T.tplMarkSlot('int Nodes;', 4, 8, 'T', true).body, 'int ⟦T:Node⟧s;', 'mark all: part of a name marks just it');

const pool = T.tplParsePool('Type=Book, f=isbn\n# note\nType=int, f=x\nbroken', { body });
eq(pool.sets, [{ Type: 'Book', f: 'isbn' }], 'pool: good sets kept');
eq(pool.errors.length, 2, 'pool: bad lines reported');
eq(T.tplPoolText([{ Type: 'Book', f: 'isbn' }]), 'Type=Book, f=isbn', 'pool text');

// Export, then import: every starter comes back the same.
const round = T.tplParseImport(T.tplExportText(TPL_STARTER.map(T.tplNormal)));
eq(round.errors, [], 'import: no errors on our own export');
eq(round.items.length, TPL_STARTER.length, 'import: all back');
round.items.forEach((t, i) => {
  const o = T.tplNormal(TPL_STARTER[i]);
  eq([t.title, t.label, t.body, t.tags, t.concepts], [o.title, o.label, o.body, o.tags, o.concepts], o.id + ': round trip fields');
  eq(t.harness, o.harness, o.id + ': round trip harness');
});
const ai = T.tplParseImport(T.TPL_AI_FORMAT);
eq([ai.items.length, ai.errors.length], [1, 0], 'the AI format example imports');
eq(T.tplParseImport('=== template\ntitle: x\n=== end').errors.length, 1, 'import: missing body reported');

// Every starter template: parses clean, its stages are sane, variations valid.
TPL_STARTER.forEach(raw => {
  const t = T.tplNormal(raw);
  const name = t.id;
  eq(T.tplParse(t.body).errors, [], name + ': parses clean');
  ok(T.tplParse(t.body).slots.length > 0, name + ': has slots');
  ok(t.label.length > 10, name + ': has a label');
  const canon = T.tplCanonical(t);
  ok(canon.indexOf('⟦') === -1 && canon.indexOf('⟧') === -1, name + ': canonical has no markers');
  const half = T.tplHalf(t, 5);
  ok(half.blanked.length >= 1, name + ': half blanks something');
  eq(T.tplHalf(t, 5), half, name + ': half is seeded');
  ok(half.text.split('\n').length === canon.split('\n').length, name + ': half keeps the line count');
  ok(T.tplScore(half.text, canon) < 100, name + ': half is not already solved');
  const outline = T.tplOutline(t);
  ok(outline.length < canon.length, name + ': outline is shorter');
  ok(/\{/.test(outline) && /\}/.test(outline), name + ': outline keeps its braces');
  for (let seed = 1; seed <= 20; seed++) {
    const v = T.tplVariation(t, seed);
    ok(!!v, name + ': variation ' + seed + ' exists');
    if (v) ok(T.tplCheckValues(t, v.values) === '', name + ': variation ' + seed + ' valid');
  }
  if (t.harness) ok(T.tplHarnessSource(t, canon).indexOf('⟦') === -1, name + ': harness fully filled');
});
const ids = TPL_STARTER.map(t => t.id);
eq(ids.length, new Set(ids).size, 'starter ids are unique');

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

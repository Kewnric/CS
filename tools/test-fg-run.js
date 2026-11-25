/* Unit tests for js/fg-run.js and js/fg-lang-syntax.js (no browser):
     node tools/test-fg-run.js
   - the JavaScript worker's prelude, run in a vm context standing in for the
     worker: printing like Node, prompt() and its read marks, timers, errors
     with the user's own line numbers;
   - every highlighter gives back exactly the text it was given (the editor
     lays its HTML over the textarea, so one moved character moves the caret);
   - the HTML preview's page: linked .css and .js filled in, the hook first. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

const root = path.join(__dirname, '..', 'js');
const app = { console };
vm.createContext(app);
vm.runInContext(fs.readFileSync(path.join(root, 'fg-lang-syntax.js'), 'utf8'), app, { filename: 'fg-lang-syntax.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'fg-run.js'), 'utf8'), app, { filename: 'fg-run.js' });

/* ── The worker, in a vm ───────────────────────────────────── */

/** Run `src` the way fgJsRun does, with a vm context as the worker. Resolves to {out, end}. */
function runJs(src, stdin) {
  return new Promise((resolve) => {
    const prelude = '(' + app.fgJsWorkerMain.toString() + ')(' + JSON.stringify(stdin || '') + ', ';
    const preLines = (prelude.match(/\n/g) || []).length;
    const text = prelude + preLines + ', "main.js");\n' + src + '\n;self.__ssp_main_done();\n';
    let out = '';
    const listeners = {};
    const w = {
      console: { log() {} }, performance, Date, Set, Map, JSON, Math, Promise, Object, Array, String, Number, Function, Error,
      setTimeout, setInterval, clearTimeout, clearInterval,
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      postMessage(m) {
        if (m.t === 'out') out += m.s;
        if (m.t === 'end') resolve({ out, end: m });
      }
    };
    w.self = w;
    vm.createContext(w);
    try {
      vm.runInContext(text, w, { filename: 'blob:null/test' });
    } catch (e) {
      (listeners.error || []).forEach(fn => fn({ error: e, message: e && e.message, preventDefault() {} }));
    }
    setTimeout(() => resolve({ out, end: null }), 3000);
  });
}
const MARK = String.fromCharCode(1);
const clean = (s) => s.split(MARK + '1' + MARK).join('').split(MARK + '0' + MARK).join('<WAIT>');

(async () => {
  {
    const r = await runJs('console.log("hi", 42, true, null, undefined);\nconsole.log([1, 2, 3], { a: 1, b: "x" });');
    eq(r.out, 'hi 42 true null undefined\n[ 1, 2, 3 ] { a: 1, b: \'x\' }\n', 'console.log prints like Node');
    eq(r.end && r.end.code, 0, 'a clean run ends with code 0');
  }
  {
    const r = await runJs('console.log(new Map([["k", 1]]), new Set([1, 2]), [], {}, [[1, [2, [3, [4]]]]]);');
    eq(r.out, "Map(1) { 'k' => 1 } Set(2) { 1, 2 } [] {} [ [ 1, [ 2, [Array] ] ] ]\n", 'Map, Set, empty, and nesting cut at depth 3');
  }
  {
    const r = await runJs('console.log("%s has %d items", "cart", 3);\nconsole.log("%o", {x: 1});');
    eq(r.out, 'cart has 3 items\n{ x: 1 }\n', 'printf-style formats');
  }
  {
    const r = await runJs('class Dog { constructor() { this.name = "Rex"; } }\nconsole.log(new Dog(), Dog, function f() {});');
    eq(r.out, "Dog { name: 'Rex' } [class Dog] [Function: f]\n", 'class instances, classes and functions');
  }
  {
    const r = await runJs('const name = prompt("Name: ");\nconsole.log("Hi " + name);', '');
    eq(clean(r.out), 'Name: <WAIT>', 'prompt() with no input marks where it waits');
    const r2 = await runJs('const name = prompt("Name: ");\nconsole.log("Hi " + name);', 'Ana\n');
    eq(clean(r2.out), 'Name: Hi Ana\n', 'prompt() reads the line typed');
    ok(r2.out.indexOf(MARK + '1' + MARK) !== -1, 'a line read is marked for the terminal');
  }
  {
    const r = await runJs('let a = Number(prompt()), b = Number(prompt());\nconsole.log(a + b);', '2\n3\n');
    eq(clean(r.out), '5\n', 'two prompts read two lines');
  }
  {
    const r = await runJs('setTimeout(() => console.log("later"), 20);\nconsole.log("now");');
    eq(r.out, 'now\nlater\n', 'the run waits for timers');
    eq(r.end && r.end.code, 0, '... then ends');
  }
  {
    const r = await runJs('let n = 0;\nconst id = setInterval(() => { n++; if (n === 3) { clearInterval(id); console.log("done", n); } }, 5);');
    eq(r.out, 'done 3\n', 'clearInterval lets the run end');
  }
  {
    const r = await runJs('console.log("a");\nfunction boom() {\n  return missing + 1;\n}\nboom();');
    eq(r.out, 'a\n', 'output before an error is kept');
    eq(r.end && r.end.code, 1, 'an uncaught error ends with code 1');
    const e = r.end && r.end.error;
    eq(e && [e.name, e.message], ['ReferenceError', 'missing is not defined'], 'the error is described');
    eq(e && e.frames[0] && e.frames[0].line, 3, 'the error is on the user\'s line 3, not the prelude\'s');
    const text = app.fgJsErrorText(e, 'console.log("a");\nfunction boom() {\n  return missing + 1;\n}\nboom();', 'main.js');
    ok(/^main\.js:3:\d+: ReferenceError: missing is not defined/.test(text), 'the terminal text starts with file:line');
    ok(/ 3 \|   return missing \+ 1;/.test(text), 'the line is quoted');
    ok(/at boom \(main\.js:3:/.test(text) || /at main\.js:5:/.test(text), 'the calls are listed');
  }
  {
    const r = await runJs('document.title = "x";');
    const text = app.fgJsErrorText(r.end.error, 'document.title = "x";', 'main.js');
    ok(/make an HTML tab/.test(text), 'document in a JS tab points to HTML tabs');
  }
  {
    const r = await runJs('console.table([{ a: 1, b: 2 }, { a: 3, b: 4 }]);');
    ok(/┌.*┐/.test(r.out) && /│ \(index\) │/.test(r.out), 'console.table draws a table');
  }
  {
    const r = await runJs('process.stdout.write("no newline");\nprocess.exit(3);\nconsole.log("never");');
    eq([r.out, r.end && r.end.code], ['no newline', 3], 'process.stdout.write and process.exit');
  }

  /* ── Highlighters keep the text exactly ──────────────────── */
  const unhtml = (h) => h.replace(/<span class="syntax-[\w-]+">/g, '').replace(/<\/span>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const samples = {
    '.js': 'const a = `t ${x}`; // c\n/* b */ if (a < 3 && b > 1) { console.log("q\\"x", \'s\', 0x1F, 1e3, 5n); }\nclass A extends B {}\nlet r = a / 2;',
    '.css': '/* c */ body > .x:hover, #id { color: #fff; margin: 0 1.5em; content: "a{b}"; } @media (max-width: 9px) { a { b: c !important } }',
    '.html': '<!DOCTYPE html>\n<!-- note -->\n<p class="a" data-x=1 hidden>Tom &amp; Jerry <b>&lt;3</b></p>\n<style>p { color: red; }</style>\n<script>if (a < b) alert("</p>");</script>\n<img src=x.png/>',
    '.asm': 'start:  mov ax, 0b800  ; video\n        mov b[es:di], \'A\'\n        jmp >L1\nmsg db "Hi$", 0Dh, 0Ah\nL1:     int 020\n        mov dx, offset msg',
    '.txt': 'a < b & c'
  };
  Object.keys(samples).forEach(ext => {
    const src = samples[ext];
    const html = app.fgLangHighlight(ext, src);
    eq(unhtml(html), src, ext + ': painting keeps every character');
  });
  ok(/syntax-keyword">mov</.test(app.fgLangHighlight('.asm', 'mov ax, 1')), 'asm: MOV is an instruction');
  ok(/syntax-var">ax</.test(app.fgLangHighlight('.asm', 'mov ax, 1')), 'asm: AX is a register');
  ok(/syntax-control">jb</.test(app.fgLangHighlight('.asm', 'jb start')), 'asm: JB is a jump');
  ok(/syntax-comment">; hi</.test(app.fgLangHighlight('.asm', 'nop ; hi')), 'asm: ; starts a comment');
  ok(/syntax-function">start:</.test(app.fgLangHighlight('.asm', 'start:')), 'asm: a label, with its colon');
  ok(/syntax-control">if</.test(app.fgLangHighlight('.js', 'if (x) {}')), 'js: if is control flow');
  ok(/syntax-function">log</.test(app.fgLangHighlight('.js', 'console.log(1)')), 'js: a call');
  ok(/syntax-keyword">p</.test(app.fgLangHighlight('.html', '<p>x</p>')), 'html: a tag name');
  ok(/syntax-var">color</.test(app.fgLangHighlight('.html', '<style>p { color: red }</style>')), 'html: CSS inside <style>');
  ok(/syntax-string">"\/\/x"</.test(app.fgLangHighlight('.js', 'a = "//x"')), 'js: // inside a string is not a comment');
  eq(app.fgLangHighlight('.js', ''), '', 'empty code paints to nothing');

  /* ── The preview's page ──────────────────────────────────── */
  {
    const files = [
      { name: 'index.html', ext: '.html', code: '<html><head><link rel="stylesheet" href="style.css"></head><body><script src="./app.js"></script></body></html>' },
      { name: 'style.css', ext: '.css', code: 'p { color: red }' },
      { name: 'app.js', ext: '.js', code: 'console.log("</script>")' }
    ];
    const doc = app.fgPreviewDocument(files, 1, 'tok');
    ok(/<style>\np \{ color: red \}\n<\/style>/.test(doc), 'preview: the linked stylesheet is put inline');
    ok(/<script>\nconsole\.log\("<\\\/script>"\)\n<\/script>/.test(doc), 'preview: the linked script is put inline, its </script> escaped');
    ok(doc.indexOf('<head><script>(function _fgPreviewHook') !== -1 || doc.indexOf('<head><script>(') !== -1, 'preview: the console hook is first in <head>');
    ok(doc.indexOf('"tok"') !== -1, 'preview: the hook carries this preview\'s token');
    const none = app.fgPreviewDocument([{ name: 'a.css', ext: '.css', code: '' }], 0, 't');
    ok(/no \.html file/.test(none), 'preview: a tab with no page says so');
    const bare = app.fgPreviewDocument([{ name: 'index.html', ext: '.html', code: '<p>hi</p>' }], 0, 't');
    ok(/^<script>\(/.test(bare) && /<p>hi<\/p>$/.test(bare), 'preview: a fragment still gets the hook');
  }

  console.log((failed ? 'FAILED ' : 'ok ') + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();

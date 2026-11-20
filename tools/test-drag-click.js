#!/usr/bin/env node
/* ============================================================
   TEST-DRAG-CLICK.JS — a selection dragged out of a text box is not a click
   ------------------------------------------------------------
   js/utils.js stops the `click` the browser fires when a press that began in
   a text box ends outside it, so popups that close on a click outside stay
   open. This runs the real listeners from utils.js against a few stand-in
   elements and the two ways popups close: a document listener that checks
   `closest(menu)` (the Visualize timer menu) and a backdrop that checks
   `e.target === overlay`.

     node tools/test-drag-click.js .
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.resolve(process.argv[2] || '.');

/* ── Stand-in DOM: just what utils.js and the close handlers touch ── */
let ROOT = null;
function matchOne(el, sel) {
  if (sel === '[contenteditable]:not([contenteditable="false"])') return el.attrs.contenteditable !== undefined && el.attrs.contenteditable !== 'false';
  if (sel[0] === '.') return el.cls.has(sel.slice(1));
  return el.tag === sel;
}
class El {
  constructor(tag, attrs, parent) {
    this.nodeType = 1;
    this.tag = tag;
    this.attrs = attrs || {};
    this.cls = new Set(String(this.attrs.class || '').split(/\s+/).filter(Boolean));
    this.type = tag === 'input' ? (this.attrs.type || 'text') : undefined;
    this.parentElement = parent || null;
  }
  get isConnected() { let e = this; while (e.parentElement) e = e.parentElement; return e === ROOT; }
  get isContentEditable() {
    for (let e = this; e; e = e.parentElement) if (e.attrs.contenteditable !== undefined) return e.attrs.contenteditable !== 'false';
    return false;
  }
  contains(o) { for (let e = o; e; e = e.parentElement) if (e === this) return true; return false; }
  matches(sel) { return sel.split(',').some(s => matchOne(this, s.trim())); }
  closest(sel) { for (let e = this; e; e = e.parentElement) if (e.matches(sel)) return e; return null; }
}
const text = parent => ({ nodeType: 3, parentElement: parent });

const winListeners = { pointerdown: [], click: [] };
const win = {
  addEventListener(type, fn, capture) {
    if (!capture) throw new Error('utils.js must listen in the capture phase');
    (winListeners[type] = winListeners[type] || []).push(fn);
  }
};
const ctx = {
  console, window: win,
  state: { challenges: [], nodes: [] },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/utils.js'), 'utf8'), ctx, { filename: 'js/utils.js' });

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  console.log('FAIL  ' + name + (detail ? '\n      ' + detail : ''));
}
check('utils.js listens for the press and the click', winListeners.pointerdown.length === 1 && winListeners.click.length === 1);

/* The page: body > [canvas, timer menu > [input, Set button], overlay > dialog > [textarea, editor > p, slider, label > checkbox]] */
ROOT = new El('body');
const canvas = new El('div', { class: 'canvas' }, ROOT);
const menu = new El('div', { class: 'viz-context-menu' }, ROOT);
const menuInput = new El('input', {}, menu);
const menuSet = new El('button', {}, menu);
const overlay = new El('div', { class: 'overlay' }, ROOT);
const dialog = new El('div', { class: 'dialog' }, overlay);
const area = new El('textarea', {}, dialog);
const editor = new El('div', { contenteditable: 'true' }, dialog);
const para = new El('p', {}, editor);
const slider = new El('input', { type: 'range' }, dialog);
const label = new El('label', {}, dialog);
const box = new El('input', { type: 'checkbox' }, label);

let menuOpen, overlayOpen;
const closers = [
  e => { if (!e.target.closest('.viz-context-menu')) menuOpen = false; },   // viz-init.js style
  e => { if (e.target === overlay) overlayOpen = false; }                    // backdrop style
];
const reset = () => { menuOpen = true; overlayOpen = true; };

/** A press on `down` released on `up`: the click goes to the nearest element holding both. */
function press(down, up, opts) {
  const o = opts || {};
  const pd = { type: 'pointerdown', target: down, button: o.button || 0, isPrimary: true };
  winListeners.pointerdown.forEach(fn => fn(pd));
  if (o.noClick) return;
  if (o.before) o.before();
  const ev = { type: 'click', target: up, detail: o.detail == null ? 1 : o.detail, stopped: false,
    stopImmediatePropagation() { this.stopped = true; } };
  for (const fn of winListeners.click) { fn(ev); if (ev.stopped) return ev; }
  closers.forEach(fn => fn(ev));
  return ev;
}

reset(); press(menuInput, ROOT);
check('timer menu: selecting its text and letting go on the page keeps it open', menuOpen);

reset(); press(menuInput, menu);
check('timer menu: letting go on the menu itself keeps it open', menuOpen);

reset(); press(canvas, canvas);
check('timer menu: a real click outside still closes it', !menuOpen);

reset(); press(menuInput, menuInput);
check('timer menu: a click inside the box goes through', menuOpen);

reset(); press(area, overlay);
check('backdrop: a textarea selection let go on the backdrop keeps the dialog open', overlayOpen);

reset(); press(overlay, overlay);
check('backdrop: a real click on the backdrop still closes it', !overlayOpen);

reset(); press(text(para), overlay);
check('backdrop: a selection dragged out of an editable region keeps it open', overlayOpen);

reset(); press(slider, overlay);
check('backdrop: a slider dragged past the edge keeps it open', overlayOpen);

reset(); const ev = press(box, label);
check('a checkbox pressed and let go on its label is a real click', ev && !ev.stopped);

reset(); press(menuInput, ROOT, { detail: 0 });
check('a click from the keyboard or script always goes through', !menuOpen);

reset(); press(menuInput, ROOT, { button: 2 });
check('only the main button counts', !menuOpen);

reset(); press(menuInput, ROOT, { noClick: true }); press(canvas, canvas);
check('a drag let go outside the window does not swallow the next real click', !menuOpen);

reset(); press(menuInput, ROOT, { noClick: true }); press(canvas, canvas, { detail: 0 });
check('nor a keyboard click after it', !menuOpen);

reset();
const gone = new El('input', {}, menu);
press(gone, ROOT, { before: () => { gone.parentElement = null; } });
check('a box removed before the click no longer holds it back', !menuOpen);

reset(); press(menuSet, menuSet);
check('a button in the menu still gets its click', menuOpen);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

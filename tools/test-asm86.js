/* Unit tests for js/asm86.js (no browser): node tools/test-asm86.js
   The assembler's A86 rules, every instruction family, DOS and BIOS
   services, the B800h screen, and the class's own programs. */
'use strict';
const path = require('path');
const Asm86 = require(path.join(__dirname, '..', 'js', 'asm86.js'));

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

/** Assemble and run to the end, typing `keys` (a string; \r is Enter) whenever it waits. */
function run(src, keys, opts) {
  const a = Asm86.assemble(src, { fileName: 'main.asm' });
  if (!a.ok) return { asm: a, errors: a.errors.map(e => e.line + ': ' + e.msg) };
  const m = Asm86.createMachine(a.program, Object.assign({ name: 'MAIN' }, opts || {}));
  const queue = (keys || '').split('');
  let st;
  for (let guard = 0; guard < 2000; guard++) {
    st = m.run(200000);
    if (st.state === 'key') {
      if (!queue.length) break;
      const ch = queue.shift();
      m.pushKey(ch.charCodeAt(0), ch === '\r' ? 0x1C : 0);
      continue;
    }
    if (st.state === 'sleep') continue;
    if (st.state !== 'run') break;
  }
  const text = m.screenText();
  // Everything after the "C:\>MAIN" line.
  const out = text.split('\n').slice(1).join('\n');
  return { asm: a, m, st, text, out, regs: m.registers(), warnings: a.warnings };
}
const errs = (src) => { const a = Asm86.assemble(src); return a.errors.map(e => e.msg).join(' | '); };

/* ── Numbers ───────────────────────────────────────────────── */
{
  const N = Asm86.parseNumber;
  eq(N('0b800'), 0xB800, 'leading zero is hex: 0b800');
  eq(N('020'), 0x20, 'leading zero is hex: 020');
  eq(N('0110B'), 0x110B, 'A86: 0110B is hex');
  eq(N('0110xB'), 6, 'A86: 0110xB is binary');
  eq(N('110B'), 6, '110B is binary');
  eq(N('1010b'), 10, '1010b is binary');
  eq(N('0100D'), 0x100D, 'A86: 0100D is hex');
  eq(N('0100xD'), 100, 'A86: 0100xD is decimal');
  eq(N('100D'), 100, '100D is decimal');
  eq(N('4Ch'), 0x4C, '4Ch');
  eq(N('0FFh'), 255, '0FFh');
  eq(N('077Q'), 63, 'octal Q');
  eq(N('123O'), 83, 'octal O');
  eq(N('1230'), 1230, 'decimal');
  eq(N('9'), 9, 'single digit');
  eq(N('0'), 0, 'zero');
  ok(isNaN(N('4c')), '4c is not a number in A86');
  eq(N('0x1F'), 31, '0x prefix');
  ok(/write 4Ch or 04C/i.test(errs('mov ah, 4c\nint 20h')), '4c explains the leading-zero rule');
}

/* ── The class's programs (B800h) ──────────────────────────── */
{
  // From the whiteboard: one row of A's in every other cell.
  const r = run('mov es,0b800\nmov di,0\nmov al,\'A\'\nstart:\n  mov b[es:di],al\n  add di,2\n  cmp di,80\n  jb start\nint 020\n');
  eq(r.errors, undefined, 'whiteboard program assembles');
  eq(r.st.state, 'exit', 'whiteboard program exits');
  eq(r.text.split('\n')[0], 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'whiteboard: 40 A\'s across the top row (over the prompt)');
}
{
  // half2.asm from the photo: 40 A's per row, then skip the rest of the row, until DI passes 4000.
  const src = [
    'mov es, 0b800', 'mov di, 0', 'mov al, \'A\'', '', '', '',
    'startt:', '      mov cx, 0', 'start:',
    '      add cx, 1', '      cmp di, 4000', '      ja end', '      mov b[es:di], al', '      add di, 2',
    '      cmp cx, 40', '      jb start', '      cmp cx, 40', '      add di, 80', '      ja startt',
    'end:', '', '', '', 'int 020'
  ].join('\r\n');
  const r = run(src);
  eq(r.errors, undefined, 'half2 assembles (label named "end", CRLF lines)');
  eq(r.st.state, 'exit', 'half2 exits');
  const rows = r.text.split('\n');
  eq(rows.length, 25, 'half2 fills all 25 rows');
  ok(rows.every(l => l === 'A'.repeat(40)), 'half2: every row is 40 A\'s on the left half');
}

/* ── DOS output ────────────────────────────────────────────── */
{
  const r = run([
    '        jmp start',
    'msg     db \'Hello, world!\', 0Dh, 0Ah, \'$\'',
    'start:  mov ah, 9',
    '        mov dx, offset msg',
    '        int 21h',
    '        mov ah, 4Ch',
    '        int 21h'
  ].join('\n'));
  eq(r.out, 'Hello, world!', 'INT 21h AH=09h prints up to $');
  eq(r.st.exitCode, 0x24, 'AH=4Ch exits with AL, which AH=09h left as "$" (24h), as real DOS does');
}
{
  const r = run('mov dl, \'X\'\nmov ah, 2\nint 21h\nmov ax, 4C07h\nint 21h');
  eq(r.out, 'X', 'AH=02h prints DL');
  eq(r.st.exitCode, 7, 'exit code 7');
}
{
  // LF without CR makes a staircase, as on a real screen.
  const r = run('jmp s\nm db \'ab\',10,\'cd$\'\ns: lea dx, m\nmov ah,9\nint 21h\nint 20h');
  eq(r.out, 'ab\n  cd', 'a bare LF moves down without returning to column 0');
}
{
  // A tab goes to the next multiple of 8.
  const r = run('jmp s\nm db \'a\',9,\'b$\'\ns: mov dx, offset m\nmov ah, 9\nint 21h\nint 20h');
  eq(r.out, 'a       b', 'DOS expands TAB');
}
{
  // Printing digits: AAM / ADD '0', and a value in AL.
  const r = run([
    'mov al, 47', 'aam', 'add ax, 3030h', 'mov bx, ax',
    'mov dl, bh', 'mov ah, 2', 'int 21h', 'mov dl, bl', 'int 21h', 'int 20h'
  ].join('\n'));
  eq(r.out, '47', 'AAM splits 47 into 4 and 7');
}
{
  // Scrolling past row 24.
  const lines = [];
  for (let i = 0; i < 30; i++) lines.push('mov dl,\'' + String.fromCharCode(65 + (i % 26)) + '\'\nmov ah,2\nint 21h\nmov dl,13\nint 21h\nmov dl,10\nint 21h');
  const r = run(lines.join('\n') + '\nint 20h');
  const rows = r.text.split('\n');
  eq(rows[0], 'G', 'the screen scrolled: the first row now holds the 6th line');
  eq(rows[rows.length - 1], 'D', 'the last line printed is near the bottom');
}

/* ── Keyboard ──────────────────────────────────────────────── */
{
  const r = run([
    'jmp start',
    'ask db \'Name: $\'',
    'buf db 20, 0, 20 dup(?)',
    'hi db 13,10,\'Hi $\'',
    'start: mov ah,9', 'mov dx, offset ask', 'int 21h',
    'mov ah, 0Ah', 'mov dx, offset buf', 'int 21h',
    'mov ah, 9', 'mov dx, offset hi', 'int 21h',
    'mov bl, [buf+1]', 'mov bh, 0', 'mov b[buf+2+bx], \'$\'',
    'mov dx, offset buf+2', 'mov ah, 9', 'int 21h', 'int 20h'
  ].join('\n'), 'Kenric\r');
  eq(r.out, 'Name: Kenric\nHi Kenric', 'AH=0Ah reads a line; CR then CRLF prints on the next line');
}
{
  const r = run('mov ah,1\nint 21h\nmov dl,al\nmov ah,2\nint 21h\nint 20h', 'q');
  eq(r.out, 'qq', 'AH=01h echoes, then the program prints it again');
}
{
  const r = run('mov ah,8\nint 21h\nmov dl,al\nmov ah,2\nint 21h\nint 20h', 'z');
  eq(r.out, 'z', 'AH=08h does not echo');
}
{
  const r = run('mov ah,0\nint 16h\nmov dl,al\nmov ah,2\nint 21h\nint 20h', 'k');
  eq(r.out, 'k', 'INT 16h AH=00h waits for a key');
}
{
  // Backspace in buffered input.
  const r = run('jmp s\nb db 10,0,10 dup(0)\ns: mov dx,offset b\nmov ah,0Ah\nint 21h\nint 20h', 'abx\bc\r');
  eq(r.out, 'abc', 'backspace erases in AH=0Ah');
  eq(r.m.peek(Asm86.LOAD_SEG, 0x103 + 1), 3, 'AH=0Ah stores the count');
}
{
  const a = Asm86.assemble('mov ah,1\nint 21h\njmp $-4');
  const m = Asm86.createMachine(a.program);
  eq(m.run(1000).state, 'key', 'waiting for a key stops the run');
  m.pushKey(3, 0x2E);
  const st = m.run(1000);
  eq(st.state, 'exit', 'Ctrl+C ends the program');
  ok(/\^C/.test(m.screenText()), 'Ctrl+C prints ^C');
}

/* ── Arithmetic and flags ──────────────────────────────────── */
{
  const r = run([
    'mov ax, 0FFFFh', 'add ax, 1', 'mov bx, 0', 'adc bx, 0',        // carry into BX
    'mov cx, 7', 'mov dx, 0', 'mov si, 3', 'push cx',
    'mov ax, 100', 'mov cl, 7', 'div cl', 'mov di, ax',              // 100/7: AL=14 AH=2
    'pop cx', 'int 20h'
  ].join('\n'));
  eq(r.regs.BX, 1, 'ADD sets CF, ADC uses it');
  eq(r.regs.DI, (2 << 8) | 14, 'DIV r8: quotient AL, remainder AH');
}
{
  const r = run('mov ax, 1234\nmov bx, 10\nmov dx, 0\ndiv bx\nint 20h');
  eq([r.regs.AX, r.regs.DX], [123, 4], 'DIV r16');
}
{
  const r = run('mov ax, -7\ncwd\nmov bx, 2\nidiv bx\nint 20h');
  eq([r.regs.AX, r.regs.DX], [0xFFFD, 0xFFFF], 'IDIV rounds toward zero (-7/2 = -3 rem -1)');
}
{
  const r = run('mov al, 200\nmov bl, 3\nmul bl\nint 20h');
  eq(r.regs.AX, 600, 'MUL r8 into AX');
}
{
  const r = run('mov ax, 300\nmov bx, 300\nmul bx\nint 20h');
  eq([r.regs.DX, r.regs.AX], [1, 90000 - 65536], 'MUL r16 into DX:AX');
}
{
  const r = run('mov al, -3\nmov bl, 4\nimul bl\nint 20h');
  eq(r.regs.AX, 0xFFF4, 'IMUL r8 signed');
}
{
  const r = run('mov ax, 5\nmov bl, 0\ndiv bl\nint 20h');
  eq(r.st.state, 'error', 'divide by zero stops with an error');
  ok(/Divide overflow/.test(r.text), 'DOS prints Divide overflow');
}
{
  const r = run('mov al, 81h\nshl al, 1\nmov bl, 0\nadc bl, 0\nmov cl, 3\nmov dx, 1\nshl dx, cl\nmov si, 8000h\nsar si, 1\nmov di, 1\nror di, 1\nint 20h');
  eq(r.regs.BX & 0xFF, 1, 'SHL moves the top bit into CF');
  eq(r.regs.DX, 8, 'SHL by CL');
  eq(r.regs.SI, 0xC000, 'SAR keeps the sign');
  eq(r.regs.DI, 0x8000, 'ROR wraps');
}
{
  // Signed and unsigned compares.
  const r = run([
    'mov bx, 0',
    'mov al, -1', 'cmp al, 1', 'jl a1', 'jmp a2', 'a1: or bx, 1',
    'a2: cmp al, 1', 'ja a3', 'jmp a4', 'a3: or bx, 2',
    'a4: mov al, 5', 'cmp al, 5', 'jne a5', 'or bx, 4',
    'a5: int 20h'
  ].join('\n'));
  eq(r.regs.BX, 7, 'JL signed, JA unsigned, JNE/JE');
}
{
  const r = run('mov cx, 5\nmov ax, 0\nl1: add ax, cx\nloop l1\nint 20h');
  eq(r.regs.AX, 15, 'LOOP counts CX down');
}
{
  const r = run('mov al, 9\nadd al, 8\ndaa\nint 20h');
  eq(r.regs.AX & 0xFF, 0x17, 'DAA');
}

/* ── Memory, stack, procedures ─────────────────────────────── */
{
  const r = run([
    'jmp main',
    'arr dw 10, 20, 30, 40',
    'total dw 0',
    'sum proc',
    '  mov si, offset arr', '  mov cx, 4', '  xor ax, ax',
    'nx: add ax, [si]', '  add si, 2', '  loop nx',
    '  mov total, ax', '  ret',
    'sum endp',
    'main: call sum', 'mov bx, total', 'int 20h'
  ].join('\n'));
  eq(r.regs.BX, 100, 'PROC / CALL / RET, word array, variable write');
}
{
  const r = run('jmp s\nt db 1,2,3,4,5\ns: mov bx, offset t\nmov al, 3\nxlat\nmov ah, t[2]\nmov dl, [t+4]\nint 20h');
  eq(r.regs.AX, (3 << 8) | 4, 'XLAT, var[index], [var+n]');
  eq(r.regs.DX & 0xFF, 5, '[t+4]');
}
{
  const r = run('mov ax, 1234h\npush ax\npop bx\npushf\npop cx\nxchg bx, cx\nint 20h');
  eq(r.regs.CX, 0x1234, 'PUSH / POP / XCHG');
}
{
  const r = run('jmp s\nsrc db \'abc\'\ndst db 3 dup(0)\ns: cld\nmov si, offset src\nmov di, offset dst\nmov cx, 3\nrep movsb\nmov al, dst[2]\nint 20h');
  eq(r.regs.AX & 0xFF, 99, 'REP MOVSB copies');
}
{
  const r = run('jmp s\nstr db \'hello\'\ns: mov di, offset str\nmov al, \'l\'\nmov cx, 5\ncld\nrepne scasb\nmov bx, di\nint 20h');
  eq(r.regs.BX, 0x106, 'REPNE SCASB stops just after the match (str at 103h, l at 105h)');
}
{
  const r = run('mov cx, 10\nmov ax, 0\nlea bx, [bx+si+5]\nret');
  eq(r.st.state, 'exit', 'RET from the top returns to DOS through the PSP');
}
{
  // $ and EQU.
  const r = run('jmp s\nmsg db \'hello\'\nlen equ $ - msg\ns: mov cx, len\nint 20h');
  eq(r.regs.CX, 5, 'len EQU $ - msg');
}
{
  // Local labels: L1 used twice, >L1 forward.
  const r = run([
    'mov ax, 0', 'mov cx, 3',
    'L1: inc ax', 'loop L1',
    'jmp >L1',
    'mov ax, 99',
    'L1: mov bx, ax',
    'int 20h'
  ].join('\n'));
  eq(r.regs.BX, 3, 'local labels and >L1');
}

/* ── MASM-style skeleton ───────────────────────────────────── */
{
  const r = run([
    '.model small', '.stack 100h', '.data', 'msg db \'MASM ok$\'', '.code',
    'main proc', '  mov ax, @data', '  mov ds, ax', '  lea dx, msg', '  mov ah, 09h', '  int 21h',
    '  mov ax, 4c00h', '  int 21h', 'main endp', 'end main'
  ].join('\n'));
  eq(r.errors, undefined, '.model / .data / .code assembles');
  eq(r.out, 'MASM ok', 'data laid out after code; END main is the entry');
}
{
  const r = run(['code segment', 'assume cs:code, ds:code', 'org 100h', 'start: mov dx, offset m', 'mov ah, 9', 'int 21h', 'int 20h', 'm db \'seg$\'', 'code ends', 'end start'].join('\n'));
  eq(r.out, 'seg', 'SEGMENT / ASSUME / ORG / END start');
}

/* ── BIOS video ────────────────────────────────────────────── */
{
  const r = run('mov ah, 2\nmov bh, 0\nmov dh, 5\nmov dl, 10\nint 10h\nmov ah, 0Eh\nmov al, \'Z\'\nint 10h\nint 20h');
  eq(r.text.split('\n')[5], ' '.repeat(10) + 'Z', 'INT 10h set cursor + teletype');
}
{
  const r = run('mov ax, 0600h\nmov bh, 1Eh\nmov cx, 0\nmov dx, 184Fh\nint 10h\nmov ah,9\nmov al,\'*\'\nmov bl,4Fh\nmov cx,3\nint 10h\nint 20h');
  const scr = r.m.screen();
  eq(scr.text[161], 0x4F, 'INT 10h AH=09h writes the attribute (at the cursor, row 1)');
  eq(scr.text[7], 0x1E, 'AH=06h cleared with attribute 1Eh');
  eq(r.text.split('\n')[1], '***', 'AH=09h repeats CX times without moving (at the cursor, row 1)');
}
{
  const r = run('mov ax, 13h\nint 10h\nmov ax, 0A000h\nmov es, ax\nmov di, 320*10+5\nmov b[es:di], 4\nint 20h');
  const scr = r.m.screen();
  eq(scr.mode, 0x13, 'mode 13h');
  eq(scr.gfx[320 * 10 + 5], 4, 'a pixel at A000h');
}

/* ── Errors that teach ─────────────────────────────────────── */
{
  ok(/the same size/.test(errs('jmp s\nmsg db \'hi$\'\ns: mov dx, msg\nint 20h')), 'byte variable into DX is a size error');
  ok(/OFFSET msg/.test(errs('jmp s\nmsg db \'hi$\'\ns: mov dx, msg\nint 20h')), '... that suggests OFFSET');
  ok(/byte or a word/.test(errs('mov [bx], 5\nint 20h')), 'unknown size asks for B[] or W[]');
  ok(/Did you mean MOV/.test(errs('movv ax, 1\nint 20h')), 'a typo gets a suggestion');
  ok(/two memory/.test(errs('jmp s\na dw 1\nb dw 2\ns: mov a, b\nint 20h')), 'memory to memory is refused');
  ok(/only BX, BP, SI and DI/.test(errs('mov ax, [cx]\nint 20h')), '[CX] is refused');
  ok(/386 register/.test(errs('mov eax, 1\nint 20h')), '32-bit registers are refused');
  ok(/not defined/.test(errs('jmp nowhere')), 'undefined label');
  ok(/already defined/.test(errs('a: nop\na: nop\nint 20h')), 'a label defined twice');
  ok(/very first byte/.test(errs('msg db \'hi$\'\nmov ah, 9\nint 21h\nint 20h')), 'data first in a .COM file');
  ok(/does not fit in a byte/.test(errs('mov al, 300\nint 20h')), 'a byte immediate out of range');
  const w = Asm86.assemble('mov ah, 4Ch\nint 21\n').warnings.map(x => x.msg).join(' ');
  ok(/decimal 21/.test(w), 'INT 21 (decimal) gets a warning');
}
{
  const r = run('mov ax, 1\nmov bx, 2');
  eq(r.st.state, 'error', 'running off the end is an error');
  ok(/ran past its last instruction/.test(r.st.message), '... that says how to end a program');
  eq(r.st.line, 2, '... and names the last line');
}
{
  const r = run('mov ah, 3Dh\nint 21h\nint 20h');
  ok(/no files or drives/.test(r.st.message), 'file functions say they are not here');
}

/* ── A loop that never ends just keeps running ─────────────── */
{
  const a = Asm86.assemble('top: jmp top');
  const m = Asm86.createMachine(a.program);
  const st = m.run(50000);
  eq(st.state, 'run', 'an endless loop is still running after its slice');
  m.stop();
  eq(m.status().state, 'exit', 'Stop ends it');
}

/* ── Code page 437 ─────────────────────────────────────────── */
{
  eq(Asm86.CP437.length, 256, 'CP437 has 256 characters');
  eq(Asm86.CP437[0xC9], '╔', 'CP437 C9h is a box corner');
  eq(Asm86.CP437[0xDB], '█', 'CP437 DBh is a full block');
  const r = run('mov ah,2\nmov dl,0C9h\nint 21h\nmov dl,0CDh\nint 21h\nint 20h');
  eq(r.out, '╔═', 'box characters print as CP437');
}

console.log((failed ? 'FAILED ' : 'ok ') + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

/* ============================================================
   XCC-STDIO.JS — printf and scanf as gcc does them, for the offline compiler
   ------------------------------------------------------------
   xcc compiles everything this app's programs need, but its own libc does
   formatted I/O in a reduced way, and these programs are checked against
   their expected output to the character. Measured against gcc:

     printf  %.0f printed 2.500000; %e, %E, %G printed literally; a width on
             %c was ignored ("R" for %-3c); %10.3f and %-8.2f padded wrong;
             %.1f of 0.25 gave 0.3 (gcc rounds the exact tie to even: 0.2);
             %g of 0.0001 gave 1e-04; %.3g of 3.14159 gave 3.142.
     scanf   no %c at all (a menu choice read as '\0'), no %[...] or %*;
             at the end of input it returned 0 instead of EOF -- which is the
             signal the terminal's input probe watches for -- and %s at the
             end of input wrote past the buffer.

   So every offline build gets this prelude in front of the learner's code: a
   printf family and a scanf family written to the C standard and checked
   against gcc. The libc's own copies are never linked, because these define
   every public name first.

   The decimal digits of a double are the one thing that is hard in C without
   a bignum, and easy in JavaScript with BigInt, so %f/%e/%g/%a ask the host
   (XccStdio.fmtFloat) for the finished field, and %f in scanf asks it to
   parse (parseFloat is correctly rounded). Both are WebAssembly imports from
   module "ssp", answered in xcc-core.js.
   ============================================================ */
(function (root) {
  'use strict';

  const PRELUDE = String.raw`
#include <stdio.h>
#include <stdarg.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

__attribute__((import_module("ssp"), import_name("fmt_float")))
int __ssp_fmt_float(double v, int conv, int prec, int flags, int width, char *out, int cap);
__attribute__((import_module("ssp"), import_name("parse_float")))
double __ssp_parse_float(const char *s, int len);

typedef struct { FILE *fp; char *buf; size_t cap; size_t len; } __ssp_out;

static void __ssp_put(__ssp_out *o, const char *s, size_t n) {
  if (o->fp) { if (n) fwrite(s, 1, n, o->fp); }
  else if (o->buf && o->len < o->cap) {
    size_t room = o->cap - o->len;
    memcpy(o->buf + o->len, s, n < room ? n : room);
  }
  o->len += n;
}

static void __ssp_pad(__ssp_out *o, char c, int n) {
  char b[32];
  memset(b, c, sizeof(b));
  while (n > 0) { int k = n > 32 ? 32 : n; __ssp_put(o, b, k); n -= k; }
}

enum { __SSP_MINUS = 1, __SSP_PLUS = 2, __SSP_SPACE = 4, __SSP_ZERO = 8, __SSP_ALT = 16 };

static void __ssp_int(__ssp_out *o, unsigned long long mag, int neg, int base, int upper,
                      int flags, int width, int prec, int conv) {
  char digits[72];
  int nd = 0;
  const char *set = upper ? "0123456789ABCDEF" : "0123456789abcdef";
  while (mag) { digits[nd++] = set[mag % base]; mag /= base; }
  int zeros = 0;
  if (prec >= 0) { if (nd < prec) zeros = prec - nd; }
  else if (nd == 0) zeros = 1;
  char pre[3]; int np = 0;
  if (conv == 'd' || conv == 'i') {
    if (neg) pre[np++] = '-';
    else if (flags & __SSP_PLUS) pre[np++] = '+';
    else if (flags & __SSP_SPACE) pre[np++] = ' ';
  }
  if (flags & __SSP_ALT) {
    if (base == 16 && nd) { pre[np++] = '0'; pre[np++] = upper ? 'X' : 'x'; }
    else if (base == 8 && zeros == 0) zeros = 1;
  }
  int body = np + zeros + nd;
  int fill = width > body ? width - body : 0;
  if (!(flags & __SSP_MINUS) && !((flags & __SSP_ZERO) && prec < 0)) __ssp_pad(o, ' ', fill);
  __ssp_put(o, pre, np);
  if (!(flags & __SSP_MINUS) && (flags & __SSP_ZERO) && prec < 0) __ssp_pad(o, '0', fill);
  __ssp_pad(o, '0', zeros);
  for (int i = nd - 1; i >= 0; i--) __ssp_put(o, &digits[i], 1);
  if (flags & __SSP_MINUS) __ssp_pad(o, ' ', fill);
}

static void __ssp_str(__ssp_out *o, const char *s, size_t n, int flags, int width) {
  int fill = width > (int)n ? width - (int)n : 0;
  if (!(flags & __SSP_MINUS)) __ssp_pad(o, ' ', fill);
  __ssp_put(o, s, n);
  if (flags & __SSP_MINUS) __ssp_pad(o, ' ', fill);
}

static int __ssp_vformat(__ssp_out *o, const char *f, va_list ap) {
  while (*f) {
    if (*f != '%') {
      const char *s = f;
      while (*f && *f != '%') f++;
      __ssp_put(o, s, f - s);
      continue;
    }
    f++;
    int flags = 0;
    for (;; f++) {
      if (*f == '-') flags |= __SSP_MINUS;
      else if (*f == '+') flags |= __SSP_PLUS;
      else if (*f == ' ') flags |= __SSP_SPACE;
      else if (*f == '0') flags |= __SSP_ZERO;
      else if (*f == '#') flags |= __SSP_ALT;
      else break;
    }
    int width = 0;
    if (*f == '*') { width = va_arg(ap, int); if (width < 0) { flags |= __SSP_MINUS; width = -width; } f++; }
    else while (*f >= '0' && *f <= '9') width = width * 10 + (*f++ - '0');
    int prec = -1;
    if (*f == '.') {
      f++;
      if (*f == '*') { prec = va_arg(ap, int); if (prec < 0) prec = -1; f++; }
      else { prec = 0; while (*f >= '0' && *f <= '9') prec = prec * 10 + (*f++ - '0'); }
    }
    int len = 0;   /* 1 hh, 2 h, 3 l, 4 ll, 5 L, 6 j, 7 z/t */
    if (*f == 'h') { f++; len = 2; if (*f == 'h') { f++; len = 1; } }
    else if (*f == 'l') { f++; len = 3; if (*f == 'l') { f++; len = 4; } }
    else if (*f == 'L' || *f == 'q') { f++; len = 5; }
    else if (*f == 'j') { f++; len = 6; }
    else if (*f == 'z' || *f == 't') { f++; len = 7; }
    int conv = *f;
    if (!conv) break;
    f++;
    switch (conv) {
    case 'd': case 'i': {
      long long v;
      if (len == 1) v = (signed char)va_arg(ap, int);
      else if (len == 2) v = (short)va_arg(ap, int);
      else if (len == 3) v = va_arg(ap, long);
      else if (len == 4 || len == 6) v = va_arg(ap, long long);
      else if (len == 7) v = va_arg(ap, long);
      else v = va_arg(ap, int);
      unsigned long long mag = v < 0 ? 0ULL - (unsigned long long)v : (unsigned long long)v;
      __ssp_int(o, mag, v < 0, 10, 0, flags, width, prec, conv);
      break;
    }
    case 'u': case 'o': case 'x': case 'X': {
      unsigned long long v;
      if (len == 1) v = (unsigned char)va_arg(ap, unsigned int);
      else if (len == 2) v = (unsigned short)va_arg(ap, unsigned int);
      else if (len == 3) v = va_arg(ap, unsigned long);
      else if (len == 4 || len == 6) v = va_arg(ap, unsigned long long);
      else if (len == 7) v = va_arg(ap, unsigned long);
      else v = va_arg(ap, unsigned int);
      int base = conv == 'u' ? 10 : conv == 'o' ? 8 : 16;
      __ssp_int(o, v, 0, base, conv == 'X', flags, width, prec, conv);
      break;
    }
    case 'c': {
      char ch = (char)va_arg(ap, int);
      __ssp_str(o, &ch, 1, flags, width);
      break;
    }
    case 's': {
      const char *s = va_arg(ap, const char *);
      if (!s) s = (prec < 0 || prec >= 6) ? "(null)" : "";
      size_t n = 0;
      while (s[n] && (prec < 0 || (int)n < prec)) n++;
      __ssp_str(o, s, n, flags, width);
      break;
    }
    case 'p': {
      void *p = va_arg(ap, void *);
      if (!p) __ssp_str(o, "(nil)", 5, flags, width);
      else __ssp_int(o, (unsigned long long)(unsigned long)p, 0, 16, 0, flags | __SSP_ALT, width, prec, 'x');
      break;
    }
    case 'n': {
      void *p = va_arg(ap, void *);
      if (len == 1) *(signed char *)p = (signed char)o->len;
      else if (len == 2) *(short *)p = (short)o->len;
      else if (len == 3 || len == 7) *(long *)p = (long)o->len;
      else if (len == 4 || len == 6) *(long long *)p = (long long)o->len;
      else *(int *)p = (int)o->len;
      break;
    }
    case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': case 'a': case 'A': {
      double v = len == 5 ? (double)va_arg(ap, long double) : va_arg(ap, double);
      char tmp[400];
      int n = __ssp_fmt_float(v, conv, prec, flags, width, tmp, (int)sizeof(tmp));
      if (n <= (int)sizeof(tmp)) __ssp_put(o, tmp, n);
      else {
        char *big = malloc(n);
        if (big) { __ssp_fmt_float(v, conv, prec, flags, width, big, n); __ssp_put(o, big, n); free(big); }
      }
      break;
    }
    case '%':
      __ssp_put(o, "%", 1);
      break;
    default: {
      char bad[2] = { '%', (char)conv };
      __ssp_put(o, bad, 2);
      break;
    }
    }
  }
  return (int)o->len;
}

int vfprintf(FILE *fp, const char *fmt, va_list ap) {
  __ssp_out o = { fp, 0, 0, 0 };
  return __ssp_vformat(&o, fmt, ap);
}
int vprintf(const char *fmt, va_list ap) { return vfprintf(stdout, fmt, ap); }
int vsnprintf(char *out, size_t n, const char *fmt, va_list ap) {
  __ssp_out o = { 0, out, n ? n - 1 : 0, 0 };
  int r = __ssp_vformat(&o, fmt, ap);
  if (n) out[o.len < n - 1 ? o.len : n - 1] = '\0';
  return r;
}
int vsprintf(char *out, const char *fmt, va_list ap) { return vsnprintf(out, (size_t)-1 / 2, fmt, ap); }
int printf(const char *fmt, ...) { va_list ap; va_start(ap, fmt); int r = vfprintf(stdout, fmt, ap); va_end(ap); return r; }
int fprintf(FILE *fp, const char *fmt, ...) { va_list ap; va_start(ap, fmt); int r = vfprintf(fp, fmt, ap); va_end(ap); return r; }
int sprintf(char *out, const char *fmt, ...) { va_list ap; va_start(ap, fmt); int r = vsprintf(out, fmt, ap); va_end(ap); return r; }
int snprintf(char *out, size_t n, const char *fmt, ...) { va_list ap; va_start(ap, fmt); int r = vsnprintf(out, n, fmt, ap); va_end(ap); return r; }

typedef struct { FILE *fp; const char *s; int n; } __ssp_in;

static int __ssp_getc(__ssp_in *in) {
  int c;
  if (in->fp) c = fgetc(in->fp);
  else c = *in->s ? (unsigned char)*in->s++ : EOF;
  if (c != EOF) in->n++;
  return c;
}
static void __ssp_ungetc(__ssp_in *in, int c) {
  if (c == EOF) return;
  in->n--;
  if (in->fp) ungetc(c, in->fp); else in->s--;
}
/* Skip white space; returns the first other character, unread, or EOF. */
static int __ssp_skipws(__ssp_in *in) {
  int c;
  while ((c = __ssp_getc(in)) != EOF && isspace(c)) {}
  __ssp_ungetc(in, c);
  return c;
}
static int __ssp_digit(int c, int base) {
  int d = (c >= '0' && c <= '9') ? c - '0' : (c >= 'a' && c <= 'z') ? c - 'a' + 10 : (c >= 'A' && c <= 'Z') ? c - 'A' + 10 : 99;
  return d < base ? d : -1;
}

static int __ssp_vscan(__ssp_in *in, const char *f, va_list ap) {
  int assigned = 0, done = 0;
  while (*f) {
    if (isspace((unsigned char)*f)) {
      while (isspace((unsigned char)*f)) f++;
      __ssp_skipws(in);
      continue;
    }
    if (*f != '%' || f[1] == '%') {
      int want = (unsigned char)*f;
      if (*f == '%') { f++; if (__ssp_skipws(in) == EOF) goto input_fail; }
      int c = __ssp_getc(in);
      if (c == EOF) goto input_fail;
      if (c != want) { __ssp_ungetc(in, c); return assigned; }
      f++;
      continue;
    }
    f++;
    int suppress = 0;
    if (*f == '*') { suppress = 1; f++; }
    int width = 0;
    while (*f >= '0' && *f <= '9') width = width * 10 + (*f++ - '0');
    int len = 0;
    if (*f == 'h') { f++; len = 2; if (*f == 'h') { f++; len = 1; } }
    else if (*f == 'l') { f++; len = 3; if (*f == 'l') { f++; len = 4; } }
    else if (*f == 'L' || *f == 'q') { f++; len = 5; }
    else if (*f == 'j') { f++; len = 6; }
    else if (*f == 'z' || *f == 't') { f++; len = 7; }
    int conv = *f;
    if (!conv) break;
    f++;
    if (conv != 'c' && conv != '[' && conv != 'n') {
      if (__ssp_skipws(in) == EOF) goto input_fail;
    }
    switch (conv) {
    case 'n':
      if (!suppress) {
        void *p = va_arg(ap, void *);
        if (len == 1) *(signed char *)p = (signed char)in->n;
        else if (len == 2) *(short *)p = (short)in->n;
        else if (len == 3 || len == 7) *(long *)p = in->n;
        else if (len == 4 || len == 6) *(long long *)p = in->n;
        else *(int *)p = in->n;
      }
      continue;
    case 'c': {
      int w = width ? width : 1, i = 0;
      char *dst = suppress ? 0 : va_arg(ap, char *);
      for (; i < w; i++) {
        int c = __ssp_getc(in);
        if (c == EOF) break;
        if (dst) dst[i] = (char)c;
      }
      if (i == 0) goto input_fail;
      if (!suppress) assigned++;
      done = 1;
      if (i < w) goto input_fail;
      continue;
    }
    case 's': {
      char *dst = suppress ? 0 : va_arg(ap, char *);
      int i = 0;
      for (;;) {
        if (width && i >= width) break;
        int c = __ssp_getc(in);
        if (c == EOF) break;
        if (isspace(c)) { __ssp_ungetc(in, c); break; }
        if (dst) dst[i] = (char)c;
        i++;
      }
      if (i == 0) goto input_fail;
      if (dst) dst[i] = '\0';
      if (!suppress) assigned++;
      done = 1;
      continue;
    }
    case '[': {
      unsigned char set[256];
      int neg = 0;
      memset(set, 0, sizeof(set));
      if (*f == '^') { neg = 1; f++; }
      if (*f == ']') { set[']'] = 1; f++; }
      while (*f && *f != ']') {
        if (f[1] == '-' && f[2] && f[2] != ']') {
          for (int ch = (unsigned char)f[0]; ch <= (unsigned char)f[2]; ch++) set[ch] = 1;
          f += 3;
        } else set[(unsigned char)*f++] = 1;
      }
      if (*f == ']') f++;
      char *dst = suppress ? 0 : va_arg(ap, char *);
      int i = 0, c = 0;
      for (;;) {
        if (width && i >= width) break;
        c = __ssp_getc(in);
        if (c == EOF) break;
        if (!(set[c] ^ neg)) { __ssp_ungetc(in, c); break; }
        if (dst) dst[i] = (char)c;
        i++;
      }
      if (i == 0) { if (c == EOF) goto input_fail; return assigned; }
      if (dst) dst[i] = '\0';
      if (!suppress) assigned++;
      done = 1;
      continue;
    }
    case 'd': case 'i': case 'u': case 'o': case 'x': case 'X': case 'p': {
      int base = (conv == 'd' || conv == 'u') ? 10 : conv == 'o' ? 8 : conv == 'i' ? 0 : 16;
      int maxw = width ? width : 1 << 30, used = 0, neg = 0, nd = 0;
      unsigned long long v = 0;
      int c = __ssp_getc(in);
      if ((c == '-' || c == '+') && used < maxw) { neg = c == '-'; used++; c = __ssp_getc(in); }
      if (c == '0' && used < maxw && (base == 0 || base == 16)) {
        used++; nd = 1;
        int c2 = __ssp_getc(in);
        if ((c2 == 'x' || c2 == 'X') && used < maxw) { base = 16; used++; nd = 0; c = __ssp_getc(in); }
        else { if (base == 0) base = 8; c = c2; }
      }
      if (base == 0) base = 10;
      while (used < maxw && c != EOF && __ssp_digit(c, base) >= 0) {
        v = v * base + __ssp_digit(c, base);
        nd++; used++;
        c = __ssp_getc(in);
      }
      __ssp_ungetc(in, c);
      if (!nd) { if (c == EOF) goto input_fail; return assigned; }
      if (neg) v = 0ULL - v;
      if (!suppress) {
        void *p = va_arg(ap, void *);
        if (conv == 'p') *(void **)p = (void *)(unsigned long)v;
        else if (len == 1) *(char *)p = (char)v;
        else if (len == 2) *(short *)p = (short)v;
        else if (len == 3 || len == 7) *(long *)p = (long)v;
        else if (len == 4 || len == 6) *(long long *)p = (long long)v;
        else *(int *)p = (int)v;
        assigned++;
      }
      done = 1;
      continue;
    }
    case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': case 'a': case 'A': {
      char buf[160];
      int n = 0, maxw = width ? width : (int)sizeof(buf) - 1;
      if (maxw > (int)sizeof(buf) - 1) maxw = (int)sizeof(buf) - 1;
      int c = __ssp_getc(in);
      if ((c == '+' || c == '-') && n < maxw) { buf[n++] = (char)c; c = __ssp_getc(in); }
      if (c == 'i' || c == 'I' || c == 'n' || c == 'N') {
        while (c != EOF && isalpha(c) && n < maxw) { buf[n++] = (char)c; c = __ssp_getc(in); }
      } else {
        int digits = 0, hex = 0;
        if (c == '0' && n < maxw) {
          buf[n++] = '0'; digits = 1; c = __ssp_getc(in);
          if ((c == 'x' || c == 'X') && n < maxw) { hex = 1; buf[n++] = (char)c; c = __ssp_getc(in); }
        }
        while (c != EOF && n < maxw && (hex ? isxdigit(c) : isdigit(c))) { buf[n++] = (char)c; digits = 1; c = __ssp_getc(in); }
        if (c == '.' && n < maxw) {
          buf[n++] = '.'; c = __ssp_getc(in);
          while (c != EOF && n < maxw && (hex ? isxdigit(c) : isdigit(c))) { buf[n++] = (char)c; digits = 1; c = __ssp_getc(in); }
        }
        if (digits && n < maxw && (hex ? (c == 'p' || c == 'P') : (c == 'e' || c == 'E'))) {
          buf[n++] = (char)c; c = __ssp_getc(in);
          if ((c == '+' || c == '-') && n < maxw) { buf[n++] = (char)c; c = __ssp_getc(in); }
          while (c != EOF && n < maxw && isdigit(c)) { buf[n++] = (char)c; c = __ssp_getc(in); }
        }
        if (!digits) n = 0;
      }
      __ssp_ungetc(in, c);
      if (!n) { if (c == EOF) goto input_fail; return assigned; }
      double v = __ssp_parse_float(buf, n);
      if (!suppress) {
        void *p = va_arg(ap, void *);
        if (len == 5) *(long double *)p = v;
        else if (len == 3) *(double *)p = v;
        else *(float *)p = (float)v;
        assigned++;
      }
      done = 1;
      continue;
    }
    default:
      return assigned;
    }
  }
  return assigned;
input_fail:
  return done ? assigned : EOF;
}

int vfscanf(FILE *restrict fp, const char *restrict fmt, va_list ap) {
  __ssp_in in = { fp, 0, 0 };
  return __ssp_vscan(&in, fmt, ap);
}
int vsscanf(const char *restrict s, const char *restrict fmt, va_list ap) {
  __ssp_in in = { 0, s, 0 };
  return __ssp_vscan(&in, fmt, ap);
}
int vscanf(const char *restrict fmt, va_list ap) { return vfscanf(stdin, fmt, ap); }
int scanf(const char *restrict fmt, ...) { va_list ap; va_start(ap, fmt); int r = vfscanf(stdin, fmt, ap); va_end(ap); return r; }
int fscanf(FILE *restrict fp, const char *restrict fmt, ...) { va_list ap; va_start(ap, fmt); int r = vfscanf(fp, fmt, ap); va_end(ap); return r; }
int sscanf(const char *restrict s, const char *restrict fmt, ...) { va_list ap; va_start(ap, fmt); int r = vsscanf(s, fmt, ap); va_end(ap); return r; }
`;

  /* ── Exact decimal digits of a double ─────────────────────────
     A finite double is mant * 2^exp exactly, so it is the fraction N / D with
     D a power of two, and every digit of it can be worked out with BigInt.
     Rounding is to nearest with ties to even, on that exact value, which is
     what glibc does: printf("%.1f", 0.25) is 0.2 and ("%.0f", 2.5) is 2. */
  function exactFraction(v) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, v);
    const hi = dv.getUint32(0), lo = dv.getUint32(4);
    const expBits = (hi >>> 20) & 0x7ff;
    let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    let exp;
    if (expBits === 0) exp = -1074;
    else { mant |= 1n << 52n; exp = expBits - 1075; }
    return exp >= 0 ? { N: mant << BigInt(exp), D: 1n } : { N: mant, D: 1n << BigInt(-exp) };
  }

  // Round N / D to an integer, ties to even.
  function roundDiv(N, D) {
    const q = N / D, r = N % D;
    const twice = r * 2n;
    return (twice > D || (twice === D && (q & 1n) === 1n)) ? q + 1n : q;
  }

  const P10 = n => 10n ** BigInt(n);

  // Digits of v (>= 0) to p places after the point.
  function fixedDigits(v, p) {
    const { N, D } = exactFraction(v);
    const s = roundDiv(N * P10(p), D).toString().padStart(p + 1, '0');
    return p ? s.slice(0, s.length - p) + '.' + s.slice(s.length - p) : s;
  }

  // v (> 0) as d.ddd x 10^e with p digits after the point: { digits, e }.
  function expParts(v, p) {
    const { N, D } = exactFraction(v);
    let e = Math.floor(Math.log10(v));
    // Make 10^e <= N/D < 10^(e+1) exactly; log10 can be one off.
    const ge = k => (k >= 0 ? N >= D * P10(k) : N * P10(-k) >= D);
    while (!ge(e)) e--;
    while (ge(e + 1)) e++;
    const shift = p - e;
    let q = shift >= 0 ? roundDiv(N * P10(shift), D) : roundDiv(N, D * P10(-shift));
    if (q >= P10(p + 1)) { q /= 10n; e++; }   // 9.99 -> 10.0
    return { digits: q.toString(), e };
  }

  function expString(digits, e, p, upper, alt) {
    let s = digits[0];
    if (p > 0 || alt) s += '.';
    s += digits.slice(1);
    const ae = Math.abs(e);
    s += (upper ? 'E' : 'e') + (e < 0 ? '-' : '+') + (ae < 10 ? '0' + ae : String(ae));
    return s;
  }

  function hexFloat(v, prec, upper) {
    if (v === 0) return '0x0' + (prec > 0 ? '.' + '0'.repeat(prec) : '') + 'p+0';
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, v);
    const hi = dv.getUint32(0), lo = dv.getUint32(4);
    const expBits = (hi >>> 20) & 0x7ff;
    let frac = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    let lead = expBits === 0 ? 0n : 1n;
    let exp = expBits === 0 ? -1022 : expBits - 1023;
    let fracHex = frac.toString(16).padStart(13, '0');
    if (prec >= 0 && prec < 13) {
      const drop = BigInt((13 - prec) * 4);
      const full = (lead << 52n) | frac;
      let q = roundDiv(full, 1n << drop);
      lead = q >> BigInt(prec * 4);
      frac = q & ((1n << BigInt(prec * 4)) - 1n);
      fracHex = prec ? frac.toString(16).padStart(prec, '0') : '';
    } else if (prec < 0) fracHex = fracHex.replace(/0+$/, '');
    else fracHex = fracHex.padEnd(prec, '0');
    let s = '0x' + lead.toString(16) + (fracHex ? '.' + fracHex : '') + 'p' + (exp < 0 ? '-' : '+') + Math.abs(exp);
    return upper ? s.toUpperCase() : s;
  }

  const F = { MINUS: 1, PLUS: 2, SPACE: 4, ZERO: 8, ALT: 16 };

  /** One printf floating-point field, finished: sign, digits, padding. */
  function fmtFloat(v, conv, prec, flags, width) {
    const c = String.fromCharCode(conv);
    const upper = c === 'F' || c === 'E' || c === 'G' || c === 'A';
    const lc = c.toLowerCase();
    const alt = !!(flags & F.ALT);
    let sign = '';
    if (v < 0 || Object.is(v, -0)) { sign = '-'; v = -v; }
    else if (flags & F.PLUS) sign = '+';
    else if (flags & F.SPACE) sign = ' ';
    let body, finite = Number.isFinite(v);
    if (!finite) {
      body = Number.isNaN(v) ? 'nan' : 'inf';
      if (upper) body = body.toUpperCase();
    } else if (lc === 'f') {
      const p = prec < 0 ? 6 : prec;
      body = fixedDigits(v, p) + (alt && p === 0 ? '.' : '');
    } else if (lc === 'e') {
      const p = prec < 0 ? 6 : prec;
      if (v === 0) body = expString('0'.repeat(p + 1), 0, p, upper, alt);
      else { const x = expParts(v, p); body = expString(x.digits, x.e, p, upper, alt); }
    } else if (lc === 'g') {
      const P = prec < 0 ? 6 : prec === 0 ? 1 : prec;
      const x = v === 0 ? { digits: '0'.repeat(P), e: 0 } : expParts(v, P - 1);
      if (x.e < P && x.e >= -4) body = fixedDigits(v, P - 1 - x.e);
      else body = expString(x.digits, x.e, P - 1, upper, true);
      if (!alt) {
        // Trailing zeros go, and the point with them if nothing is left after it.
        let mant = body.replace(/[eE].*$/, '');
        const tail = body.slice(mant.length);
        if (mant.includes('.')) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
        body = mant + tail;
      } else if (!body.includes('.')) {
        body = body.replace(/^([^eE]*)/, '$1.');
      }
    } else {
      body = hexFloat(v, prec, upper);
    }
    const len = sign.length + body.length;
    const fill = width > len ? width - len : 0;
    if (flags & F.MINUS) return sign + body + ' '.repeat(fill);
    if ((flags & F.ZERO) && finite) {
      const pre = body.startsWith('0x') || body.startsWith('0X') ? body.slice(0, 2) : '';
      return sign + pre + '0'.repeat(fill) + body.slice(pre.length);
    }
    return ' '.repeat(fill) + sign + body;
  }

  /** strtod for scanf's %f: what the C side collected, as a double. */
  function parseFloatC(text) {
    const t = text.trim();
    const m = /^([+-]?)(.*)$/.exec(t);
    const neg = m[1] === '-';
    const r = m[2].toLowerCase();
    let v;
    if (r === 'inf' || r === 'infinity') v = Infinity;
    else if (r.startsWith('nan')) v = NaN;
    else if (r.startsWith('0x')) {
      const h = /^0x([0-9a-f]*)(?:\.([0-9a-f]*))?(?:p([+-]?\d+))?$/.exec(r);
      if (!h) v = 0;
      else {
        const digits = (h[1] || '') + (h[2] || '');
        v = digits ? parseInt(digits, 16) / Math.pow(16, (h[2] || '').length) : 0;
        if (h[3]) v *= Math.pow(2, parseInt(h[3], 10));
      }
    } else v = parseFloat(r);
    if (Number.isNaN(v) && !r.startsWith('nan')) v = 0;
    return neg ? -v : v;
  }

  const lines = PRELUDE.split('\n').length - 1;
  root.XccStdio = { PRELUDE, PRELUDE_LINES: lines, fmtFloat, parseFloatC };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.XccStdio;
})(typeof self !== 'undefined' ? self : globalThis);

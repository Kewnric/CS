/* ============================================================
   SYNTAX.JS — Advanced Syntax Highlighting Engine
   VS Code Dark+ Theme Color Parity
   ============================================================ */

function syntaxHighlight(code) {
  if (!code) return '';
  let escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Tokenization order matters — strings & comments first to avoid inner matches

  // Phase 1: Extract strings and comments into placeholders to protect them
  const tokens = [];
  let tokenIndex = 0;

  // Replace strings, comments, preprocessor directives with placeholders
  escaped = escaped.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#\s*(?:include|define|ifndef|endif|ifdef|pragma|if|else|elif|undef)\b[^\n]*/g,
    function(match) {
      const id = `__TOKEN_${tokenIndex++}__`;
      let type;

      if (match.startsWith('"') || match.startsWith("'") || match.startsWith('`')) {
        type = 'string';
      } else if (match.startsWith('//') || match.startsWith('/*')) {
        type = 'comment';
      } else if (match.startsWith('#')) {
        type = 'preproc';
      }
      tokens.push({ id, match, type });
      return id;
    }
  );

  /* Phase 1b: names the program itself introduces as TYPES.

     VS Code gives these their own colour (teal) rather than lumping them in
     with variables, and it matters more in C than it looks: `Point p` reads
     as two unrelated words until the first one is visibly a type. Collected
     from the source before anything is marked, so a declaration anywhere in
     the file colours every later use.

     Three shapes cover it: the tag in `struct/union/enum X`, the name a
     typedef ends on, and the name a `} X;` closes a definition with. */
  const userTypes = new Set();
  const rawSrc = String(code);
  let mt;
  const tagRe = /\b(?:struct|union|enum)\s+([A-Za-z_]\w*)/g;
  while ((mt = tagRe.exec(rawSrc))) userTypes.add(mt[1]);
  const tdRe = /\btypedef\b[^;{]*?([A-Za-z_]\w*)\s*;/g;
  while ((mt = tdRe.exec(rawSrc))) userTypes.add(mt[1]);
  const closeRe = /\}\s*([A-Za-z_]\w*)\s*;/g;
  while ((mt = closeRe.exec(rawSrc))) userTypes.add(mt[1]);

  const reservedSet = 'if|else|for|while|do|switch|case|return|break|continue|default|goto|int|char|float|double|void|struct|typedef|enum|sizeof|unsigned|signed|long|short|bool|string|wchar_t|size_t|FILE|const|static|extern|volatile|register|inline|mutable|explicit|virtual|override|template|typename|auto|class|public|private|protected|new|delete|this|throw|try|catch|finally|using|namespace|std|cout|cin|endl|cerr|clog|union|restrict|true|false|null|undefined|NULL|nullptr|TRUE|FALSE|EOF|let|var|function|import|export|async|await|const_cast|static_cast|dynamic_cast|reinterpret_cast|friend|operator|printf|scanf|fprintf|fscanf|sprintf|sscanf|snprintf|malloc|calloc|realloc|free|fgets|fputs|fopen|fclose|fread|fwrite|fseek|ftell|rewind|fflush|strlen|strcpy|strncpy|strcat|strncat|strcmp|strncmp|strchr|strrchr|strstr|strtok|memcpy|memset|memmove|memcmp|atoi|atof|atol|strtol|strtod|abs|labs|fabs|sqrt|pow|ceil|floor|round|log|log10|sin|cos|tan|rand|srand|time|clock|getchar|putchar|puts|gets|getline|exit|abort|atexit|system|isalpha|isdigit|isalnum|isupper|islower|toupper|tolower|isspace|qsort|bsearch';
  const reservedWords = new Set(reservedSet.split('|'));

  /* Phase 1c: the names this file DECLARES.

     Colouring every bare identifier was wrong: type `bbbbbbbD` on a line by
     itself and it came out the same blue as a real variable, so gibberish
     looked like working code. VS Code does not do that -- without a language
     server it leaves an unresolved word alone, and with one it marks it as an
     error. Neither of those is "paint it like a variable".

     So only names the file introduces get the variable colour. A declaration
     is found by its TYPE and then read to the end of the declarator list, which
     is what makes `int a, b;`, `int *p`, `int arr[MAX]`, `for (int i = 0;` and
     a parameter list all fall out of one rule instead of five.

     A name followed by `(` is skipped -- that is a call or a definition, and
     the function phases above have already coloured it. */
  const declared = new Set();
  (function collectDeclared(src) {
    const TYPE_LEAD = /\b(?:const|static|extern|volatile|register|inline|unsigned|signed|long|short|int|char|float|double|void|_Bool|bool|size_t|FILE|struct|union|enum)\b/g;
    let m;
    while ((m = TYPE_LEAD.exec(src))) {
      let i = m.index + m[0].length, depth = 0, span = '';
      while (i < src.length) {
        const ch = src[i];
        if (ch === '(') { depth++; }
        else if (ch === ')') { if (depth === 0) break; depth--; }
        else if (depth === 0 && (ch === ';' || ch === '{' || ch === '=' || ch === '\n')) break;
        span += ch;
        i++;
      }
      span.replace(/\b([A-Za-z_]\w*)\b(\s*\()?/g, function (whole, name, call) {
        if (call) return whole;                 // a call or a definition
        if (reservedWords.has(name)) return whole;
        declared.add(name);
        return whole;
      });
    }
    // Macros are names the program introduces too.
    let mm;
    const DEFINE = /^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)/gm;
    while ((mm = DEFINE.exec(src))) declared.add(mm[1]);
  })(rawSrc);

  // Phase 2: Highlight C Standard Library functions
  escaped = escaped.replace(
    /\b(printf|scanf|fprintf|fscanf|sprintf|sscanf|snprintf|vprintf|vfprintf|vsprintf|vsnprintf|malloc|calloc|realloc|free|fgets|fputs|fopen|fclose|fread|fwrite|fseek|ftell|rewind|fflush|feof|ferror|clearerr|remove|rename|tmpfile|tmpnam|strlen|strcpy|strncpy|strcat|strncat|strcmp|strncmp|strchr|strrchr|strstr|strtok|strdup|memcpy|memset|memmove|memcmp|atoi|atof|atol|strtol|strtod|strtoul|strtof|strtold|abs|labs|fabs|sqrt|pow|ceil|floor|round|log|log10|log2|sin|cos|tan|asin|acos|atan|atan2|exp|ldexp|frexp|modf|fmod|rand|srand|time|clock|difftime|mktime|localtime|gmtime|strftime|asctime|ctime|getchar|putchar|puts|gets|getline|exit|abort|atexit|system|getenv|isalpha|isdigit|isalnum|isupper|islower|toupper|tolower|isspace|ispunct|isprint|iscntrl|isxdigit|qsort|bsearch|perror|signal|raise|setjmp|longjmp|assert)\b(?=\s*\()/g,
    '\uE000$1\uE00F'
  );

  // Phase 3: Detect user-defined function calls


  escaped = escaped.replace(
    /\b([a-zA-Z_]\w*)\b(?=\s*\()/g,
    function(match, name) {
      if (reservedWords.has(name)) return match;
      return `\uE001${name}\uE00F`;
    }
  );

  // Phase 4: Data types
  escaped = escaped.replace(
    /\b(int|char|float|double|void|struct|typedef|enum|unsigned|signed|long|short|bool|string|wchar_t|size_t|FILE|union|auto)\b/g,
    '\uE002$1\uE00F'
  );

  // Phase 5: Control flow
  escaped = escaped.replace(
    /\b(if|else|for|while|do|switch|case|break|default|continue|return|goto)\b/g,
    '\uE003$1\uE00F'
  );

  // Phase 6: Language keywords
  escaped = escaped.replace(
    /\b(const|let|var|function|class|import|export|try|catch|finally|new|this|await|async|sizeof|static|extern|volatile|register|inline|mutable|explicit|virtual|override|template|typename|using|namespace|std|cout|cin|endl|cerr|clog|public|private|protected|nullptr|throw|delete|const_cast|static_cast|dynamic_cast|reinterpret_cast|friend|operator|restrict)\b/g,
    '\uE004$1\uE00F'
  );

  // Phase 7: Constants / Primitives
  escaped = escaped.replace(
    /\b(true|false|null|undefined|NULL|nullptr|TRUE|FALSE|EOF|SEEK_SET|SEEK_END|SEEK_CUR|stdin|stdout|stderr|INT_MAX|INT_MIN|CHAR_MAX|CHAR_MIN|LONG_MAX|LONG_MIN|UINT_MAX|SIZE_MAX|EXIT_SUCCESS|EXIT_FAILURE|RAND_MAX|BUFSIZ|FILENAME_MAX)\b/g,
    '\uE005$1\uE00F'
  );

  // Phase 8: Numbers
  escaped = escaped.replace(
    /* Suffixes are part of the literal: `10UL` is one number, and matching
       only the `10` left `UL` sitting outside as unstyled text. Longest
       alternatives first, or `0x1F` matches as `0` followed by `x1F`. */
    /\b(0[xX][0-9a-fA-F]+(?:[uUlL]+)?|0[bB][01]+(?:[uUlL]+)?|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?(?:[fFlLuU]+)?)\b/g,
    '\uE006$1\uE00F'
  );

  // Phase 9: Operators
  escaped = escaped.replace(
    /(-&gt;|&lt;&lt;=|&gt;&gt;=|&lt;&lt;|&gt;&gt;|&lt;=|&gt;=|==|!=|&amp;&amp;|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|&amp;=|\|=|\^=|&lt;|&gt;|=|!|\*|\/|%|&amp;|\||\^|\?|:|~|(?<![eE])[+-])/g,
    '\uE007$1\uE00F'
  );

  // Phase 10: Brackets
  escaped = escaped.replace(
    /([{}()\[\]])/g,
    '\uE008$1\uE00F'
  );

  // Phase 11: Restore tokens
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    let replacement;

    if (t.type === 'string') {
      /* Format specifiers get their own colour inside the string.

         `printf("Your: %d")` is two different things wearing one colour: the
         text being printed, and the placeholder that decides what gets printed
         there. The placeholder is the part that has to agree with the argument
         list, and the part worth being able to pick out at a glance.

         Nested inside the string's own span rather than breaking the string
         up, so it still reads as one run with the specifier lit within it.
         Flags, width, precision and length modifiers all belong to the
         specifier -- `%-5.2f` and `%ld` are each one thing -- and `%%` counts
         because a literal percent is an escape, not text. */
      /* Escapes get their own colour too, for the same reason the specifier
         does: `\n` is not the letter n, it is a newline, and a beginner
         reading a string as one flat run has no way to see that. VS Code
         colours them gold; this follows.

         Applied BEFORE the specifier pass. They cannot overlap -- an escape
         starts with a backslash and a specifier with a percent -- but doing
         escapes first means the specifier regex never has to reason about a
         backslash sitting in front of it. */
      replacement = '\uE009' + t.match
        .replace(
          /\\(?:x[0-9a-fA-F]+|[0-7]{1,3}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g,
          '\uE00E$&\uE00F'
        )
        .replace(
          /%[-+ #0']*[0-9*]*(?:\.[0-9*]+)?(?:hh|h|ll|l|L|j|z|t)?[diouxXeEfFgGaAcspn%]/g,
          '\uE00D$&\uE00F'
        ) + '\uE00F';
    } else if (t.type === 'comment') {
      replacement = `\uE00A${t.match}\uE00F`;
    } else if (t.type === 'preproc') {
      let preprocHTML = t.match;
      preprocHTML = preprocHTML.replace(
        /(&lt;[^&]*?\.h&gt;|"(?:[^"\\]|\\.)*")/g,
        '\uE00C$1\uE00F'
      );
      replacement = `\uE00B${preprocHTML}\uE00F`;
    }

    escaped = escaped.replace(t.id, replacement);
  }

  /* Phase 11b: everything still bare is an identifier.

     Before this, a C file was mostly UNCOLOURED -- keywords, calls, numbers
     and strings were lit and every variable, parameter, struct member and
     field name was plain body text. An audit of a file exercising the usual
     constructs found 45 distinct tokens with no colour at all, which is why
     the editor looked flat next to VS Code however many keywords it knew.

     It runs last, on the marked-up text, and only rewrites the stretches
     BETWEEN markers -- otherwise it would re-wrap the word inside every span
     already placed, including the ones holding strings and comments. The
     depth counter is what keeps it out of them.

     Struct members are deliberately not separated out: VS Code Dark+ gives
     members and variables the same light blue, so `p.x` wants one colour and
     splitting them would be a distinction the theme does not make. */
  escaped = (function markIdentifiers(s) {
    const OPEN = /[\uE000-\uE00E\uE010\uE011]/;
    let out = '', depth = 0, last = 0;
    const re = /[\uE000-\uE00E\uE00F\uE010\uE011]/g;
    const bare = seg => seg.replace(/\b([A-Za-z_]\w*)\b/g, function (m, name) {
      if (userTypes.has(name)) return '\uE011' + name + '\uE00F';
      /* Not declared anywhere in this file, so there is nothing to say about
         it. Left as plain text -- which is also what half-typed and misspelt
         names look like, and that is useful rather than a shortcoming. */
      if (!declared.has(name)) return m;
      return '\uE010' + name + '\uE00F';
    });
    let m;
    while ((m = re.exec(s))) {
      const seg = s.slice(last, m.index);
      out += depth === 0 ? bare(seg) : seg;
      out += m[0];
      depth += (m[0] === '\uE00F') ? -1 : 1;
      if (depth < 0) depth = 0;
      last = m.index + 1;
    }
    out += depth === 0 ? bare(s.slice(last)) : s.slice(last);
    return out;
  })(escaped);

  // Phase 12: Resolve Unicode tokens to final HTML classes
  return escaped
    .replace(/\uE000/g, '<span class="syntax-stdlib">')
    .replace(/\uE001/g, '<span class="syntax-function-call">')
    .replace(/\uE002/g, '<span class="syntax-type">')
    .replace(/\uE003/g, '<span class="syntax-control">')
    .replace(/\uE004/g, '<span class="syntax-keyword">')
    .replace(/\uE005/g, '<span class="syntax-primitive">')
    .replace(/\uE006/g, '<span class="syntax-number">')
    .replace(/\uE007/g, '<span class="syntax-operator">')
    .replace(/\uE008/g, '<span class="syntax-bracket">')
    .replace(/\uE009/g, '<span class="syntax-string">')
    .replace(/\uE00A/g, '<span class="syntax-comment">')
    .replace(/\uE00B/g, '<span class="syntax-preproc">')
    .replace(/\uE00C/g, '<span class="syntax-header">')
    .replace(/\uE00D/g, '<span class="syntax-format">')
    .replace(/\uE00E/g, '<span class="syntax-escape">')
    .replace(/\uE010/g, '<span class="syntax-var">')
    .replace(/\uE011/g, '<span class="syntax-usertype">')
    .replace(/\uE00F/g, '</span>');
}

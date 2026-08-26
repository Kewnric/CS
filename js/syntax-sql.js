/* ============================================================
   SYNTAX-SQL.JS — highlighting for the SQL practice attempt
   ------------------------------------------------------------
   syntaxHighlight() in syntax.js is C: it paints printf and struct and treats
   `--` as two minus signs. Pointing it at a SELECT left the whole statement
   plain, so SQL gets its own pass.

   It emits the same span classes the C highlighter does, so both inherit one
   set of theme colours and nothing new has to be styled:
     syntax-keyword   SELECT, FROM, WHERE …
     syntax-stdlib    COUNT, MAX, LENGTH …
     syntax-type      INT, VARCHAR …
     syntax-number / -string / -comment / -operator / -bracket
   ============================================================ */

/* Longest-first inside each alternation: without it "IN" matches the front of
   "INNER" and leaves "NER" behind as bare text. */
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'INSERT', 'UPDATE', 'DELETE', 'VALUES',
  'CREATE TABLE', 'CREATE VIEW', 'CREATE INDEX', 'CREATE DATABASE', 'CREATE',
  'ALTER TABLE', 'ALTER', 'DROP TABLE', 'DROP', 'TRUNCATE', 'REPLACE',
  'INNER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN',
  'LEFT JOIN', 'RIGHT JOIN', 'CROSS JOIN', 'FULL JOIN', 'NATURAL JOIN', 'JOIN',
  'GROUP BY', 'ORDER BY', 'PARTITION BY', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'DISTINCT', 'ON', 'AS', 'AND', 'OR', 'NOT IN', 'NOT LIKE', 'NOT NULL', 'NOT',
  'IN', 'LIKE', 'BETWEEN', 'IS NULL', 'IS', 'NULL', 'EXISTS', 'ALL', 'ANY', 'SOME',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CHECK',
  'AUTO_INCREMENT', 'CONSTRAINT', 'INDEX', 'CASCADE',
  'ASC', 'DESC', 'SET', 'INTO', 'WITH', 'RECURSIVE', 'OVER', 'USING',
  'TRUE', 'FALSE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
  'IF NOT EXISTS', 'IF EXISTS', 'IF', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'USE'
];

const SQL_FUNCTIONS = [
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'ABS', 'CEIL', 'CEILING', 'FLOOR',
  'LENGTH', 'CHAR_LENGTH', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM',
  'CONCAT', 'CONCAT_WS', 'SUBSTRING', 'SUBSTR', 'LEFT', 'RIGHT', 'REPLACE',
  'COALESCE', 'IFNULL', 'NULLIF', 'CAST', 'CONVERT',
  'NOW', 'CURDATE', 'CURTIME', 'DATE', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE',
  'DATEDIFF', 'TIMESTAMPDIFF', 'DATE_FORMAT', 'DATE_ADD', 'DATE_SUB',
  'GROUP_CONCAT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD'
];

const SQL_TYPES = [
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC',
  'FLOAT', 'DOUBLE', 'REAL', 'BOOLEAN', 'BOOL', 'BIT',
  'CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'BLOB', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'ENUM', 'JSON'
];

/* Sentinels, not tags: a later pass must not be able to match inside markup an
   earlier one already wrote. Written as escapes so the source stays ASCII. */
const _SQL_M = {
  kw: '\u0011', fn: '\u0012', ty: '\u0013',
  num: '\u0014', op: '\u0015', br: '\u0016', end: '\u0017',
  holdOpen: '\u0018', holdClose: '\u0019'
};

function _sqlAlt(list) {
  return list
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(w => w.replace(/ /g, '\\s+'))
    .join('|');
}

const _SQL_KW_RE = new RegExp('\\b(' + _sqlAlt(SQL_KEYWORDS) + ')\\b', 'gi');
const _SQL_FN_RE = new RegExp('\\b(' + _sqlAlt(SQL_FUNCTIONS) + ')\\b(?=\\s*\\()', 'gi');
const _SQL_TY_RE = new RegExp('\\b(' + _sqlAlt(SQL_TYPES) + ')\\b', 'gi');

/**
 * @param {string} code
 * @returns {string} HTML
 */
function sqlHighlight(code) {
  if (!code) return '';
  const M = _SQL_M;
  let out = String(code).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Strings and comments come out first and go back last. A keyword inside a
  // quoted value is data, not syntax, and `--` starts a comment that must not
  // then be scanned for keywords.
  const held = [];
  out = out.replace(
    /('(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.)*"|`[^`]*`)|--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\//g,
    (m) => {
      const cls = (m[0] === "'" || m[0] === '"' || m[0] === '`') ? 'syntax-string' : 'syntax-comment';
      held.push('<span class="' + cls + '">' + m + '</span>');
      return M.holdOpen + (held.length - 1) + M.holdClose;
    }
  );

  out = out.replace(_SQL_FN_RE, M.fn + '$1' + M.end);
  out = out.replace(_SQL_KW_RE, M.kw + '$1' + M.end);
  out = out.replace(_SQL_TY_RE, M.ty + '$1' + M.end);
  // A held string or comment is parked as <sentinel><index><sentinel>, and
  // that index is digits — without this the placeholder for a comment gets
  // painted as a number and the comment never comes back.
  out = out.replace(/(?<!\u0018)\b(\d+\.?\d*)\b/g, M.num + '$1' + M.end);
  out = out.replace(/(&lt;=|&gt;=|&lt;&gt;|!=|=|&lt;|&gt;|\+|\*|\/|%)/g, M.op + '$1' + M.end);
  out = out.replace(/([()])/g, M.br + '$1' + M.end);

  const swap = (ch, html) => { out = out.split(ch).join(html); };
  swap(M.kw, '<span class="syntax-keyword">');
  swap(M.fn, '<span class="syntax-stdlib">');
  swap(M.ty, '<span class="syntax-type">');
  swap(M.num, '<span class="syntax-number">');
  swap(M.op, '<span class="syntax-operator">');
  swap(M.br, '<span class="syntax-bracket">');
  swap(M.end, '</span>');

  const holdRe = new RegExp(M.holdOpen + '(\\d+)' + M.holdClose, 'g');
  return out.replace(holdRe, (m, i) => held[Number(i)]);
}

window.sqlHighlight = sqlHighlight;

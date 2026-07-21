/**
 * SFL lexer (Phase-6 §2). PURE — source string → token stream. No I/O.
 *
 * Tokens: number, percent (NN%), duration (NNd/NNm/NNy), date (@YYYY-MM-DD), string, identifier,
 * keyword, operator, punctuation; `#` line comments and whitespace are skipped. There is NO money
 * literal by design (Phase-6 §3): money enters only through typed variables/functions, so a rupee
 * is never a bare literal that could drift. Unknown input throws PAY-DSL-SYN-001 with its position;
 * an unterminated string throws PAY-DSL-SYN-004 — a lexer that guesses is worse than one that stops.
 */

export type TokenKind =
  | 'number'
  | 'percent'
  | 'duration'
  | 'date'
  | 'string'
  | 'ident'
  | 'keyword'
  | 'op'
  | 'punct'
  | 'eof';

export interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

export const KEYWORDS: ReadonlySet<string> = new Set([
  'formula', 'let', 'in', 'if', 'then', 'else', 'and', 'or', 'not', 'null', 'true', 'false',
]);

const MULTI_OPS = ['==', '!=', '<=', '>=', '??', '?.', '..', '::']; // check before single-char ':'
const SINGLE_OPS = new Set(['+', '-', '*', '/', '<', '>']);
// '=' (binding assignment) and ':' (type annotation, single) are structural punctuation.
const PUNCT = new Set(['(', ')', '[', ']', '{', '}', ',', ':', '.', '=']);

const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentStart = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isIdentPart = (c: string) => isIdentStart(c) || isDigit(c);

/** PURE — tokenize SFL source. Returns tokens ending with a single 'eof'. */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  const err = (pos: number, code: string, msg: string) => {
    throw new RangeError(`${code}: ${msg} at position ${pos}`);
  };

  while (i < n) {
    const c = src[i];

    // whitespace
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }

    // line comment
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }

    // string
    if (c === '"' || c === "'") {
      const start = i;
      const quote = c;
      i++;
      let val = '';
      while (i < n && src[i] !== quote) {
        if (src[i] === '\n') err(start, 'PAY-DSL-SYN-004', 'unterminated string');
        val += src[i++];
      }
      if (i >= n) err(start, 'PAY-DSL-SYN-004', 'unterminated string');
      i++; // closing quote
      tokens.push({ kind: 'string', value: val, pos: start });
      continue;
    }

    // date literal @YYYY-MM-DD
    if (c === '@') {
      const start = i;
      i++;
      let val = '';
      while (i < n && (isDigit(src[i]) || src[i] === '-')) val += src[i++];
      if (val.length === 0) err(start, 'PAY-DSL-SYN-001', "expected a date after '@'");
      tokens.push({ kind: 'date', value: val, pos: start });
      continue;
    }

    // number / percent / duration
    if (isDigit(c)) {
      const start = i;
      let num = '';
      while (i < n && isDigit(src[i])) num += src[i++];
      let isInt = true;
      if (i < n && src[i] === '.' && isDigit(src[i + 1] ?? '')) {
        isInt = false;
        num += src[i++]; // '.'
        while (i < n && isDigit(src[i])) num += src[i++];
      }
      // percent
      if (i < n && src[i] === '%') {
        i++;
        tokens.push({ kind: 'percent', value: num, pos: start });
        continue;
      }
      // duration NNd / NNm / NNy (integer only, unit not followed by more ident chars)
      if (isInt && i < n && (src[i] === 'd' || src[i] === 'm' || src[i] === 'y') && !isIdentPart(src[i + 1] ?? '')) {
        const unit = src[i++];
        tokens.push({ kind: 'duration', value: num + unit, pos: start });
        continue;
      }
      tokens.push({ kind: 'number', value: num, pos: start });
      continue;
    }

    // identifier / keyword
    if (isIdentStart(c)) {
      const start = i;
      let id = '';
      while (i < n && isIdentPart(src[i])) id += src[i++];
      tokens.push({ kind: KEYWORDS.has(id) ? 'keyword' : 'ident', value: id, pos: start });
      continue;
    }

    // multi-char operators (before single-char / punct)
    const two = src.slice(i, i + 2);
    if (MULTI_OPS.includes(two)) {
      tokens.push({ kind: 'op', value: two, pos: i });
      i += 2;
      continue;
    }

    // single-char operators
    if (SINGLE_OPS.has(c)) { tokens.push({ kind: 'op', value: c, pos: i }); i++; continue; }

    // punctuation
    if (PUNCT.has(c)) { tokens.push({ kind: 'punct', value: c, pos: i }); i++; continue; }

    err(i, 'PAY-DSL-SYN-001', `unexpected character '${c}'`);
  }

  tokens.push({ kind: 'eof', value: '', pos: n });
  return tokens;
}

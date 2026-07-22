/**
 * SFL parser + AST (Phase-6 §2 grammar, §6 AST). PURE — tokens → AST. Recursive descent over the
 * lexer's token stream. Throws PAY-DSL-SYN-* on a malformed expression (with position) — a bad AST
 * is worse than a rejected formula.
 *
 * Precedence (low → high): if/?? → or → and → equality → comparison → additive → multiplicative →
 * unary (- / not) → postfix (member `.`/`?.`, index `[]`, call `()`) → primary (literals, identifier,
 * `( )`, list `[ ]`, map `{ }`). The `in` membership + `..` range operators are deferred to a later
 * brick (their grammar is genuinely ambiguous with the formula-level `in`); this parser rejects a
 * stray `in`/`..` cleanly rather than mis-parse.
 */

import type { Token } from './lexer.ts';

export type LiteralType = 'number' | 'percent' | 'string' | 'date' | 'duration' | 'bool' | 'null';

export type Expr =
  | { type: 'Literal'; litType: LiteralType; value: string | number | boolean | null }
  | { type: 'Var'; name: string }
  | { type: 'Call'; callee: Expr; args: Expr[] }
  | { type: 'Member'; obj: Expr; name: string; nullSafe: boolean }
  | { type: 'Index'; obj: Expr; index: Expr }
  | { type: 'BinOp'; op: string; left: Expr; right: Expr }
  | { type: 'UnOp'; op: string; operand: Expr }
  | { type: 'If'; cond: Expr; then: Expr; else: Expr }
  | { type: 'List'; items: Expr[] }
  | { type: 'Map'; pairs: { key: string; value: Expr }[] };

export interface Binding { name: string; annotation?: string; expr: Expr; }
export interface Formula { name: string; annotation: string; bindings: Binding[]; body: Expr; }

function makeParser(tokens: Token[]) {
  let i = 0;
  const peek = () => tokens[i];
  const at = (kind: string, value?: string) => peek().kind === kind && (value === undefined || peek().value === value);
  const err = (code: string, msg: string) => { throw new RangeError(`${code}: ${msg} at position ${peek().pos}`); };
  const next = () => tokens[i++];
  const expect = (kind: string, value?: string) => {
    if (!at(kind, value)) err('PAY-DSL-SYN-002', `expected ${value ?? kind}, got '${peek().value || peek().kind}'`);
    return next();
  };

  // expression = conditional
  function expression(): Expr { return conditional(); }

  function conditional(): Expr {
    if (at('keyword', 'if')) {
      next();
      const cond = expression();
      expect('keyword', 'then');
      const thenE = expression();
      expect('keyword', 'else'); // else is MANDATORY (every expression is total, Phase-6 §4)
      const elseE = expression();
      return { type: 'If', cond, then: thenE, else: elseE };
    }
    return coalesce();
  }

  function coalesce(): Expr {
    let left = logicOr();
    while (at('op', '??')) { next(); left = { type: 'BinOp', op: '??', left, right: logicOr() }; }
    return left;
  }
  function logicOr(): Expr {
    let left = logicAnd();
    while (at('keyword', 'or')) { next(); left = { type: 'BinOp', op: 'or', left, right: logicAnd() }; }
    return left;
  }
  function logicAnd(): Expr {
    let left = equality();
    while (at('keyword', 'and')) { next(); left = { type: 'BinOp', op: 'and', left, right: equality() }; }
    return left;
  }
  function equality(): Expr {
    let left = comparison();
    while (at('op', '==') || at('op', '!=')) { const op = next().value; left = { type: 'BinOp', op, left, right: comparison() }; }
    return left;
  }
  function comparison(): Expr {
    let left = additive();
    while (at('op', '<') || at('op', '<=') || at('op', '>') || at('op', '>=')) {
      const op = next().value;
      left = { type: 'BinOp', op, left, right: additive() };
    }
    return left;
  }
  function additive(): Expr {
    let left = multiplicative();
    while (at('op', '+') || at('op', '-')) { const op = next().value; left = { type: 'BinOp', op, left, right: multiplicative() }; }
    return left;
  }
  function multiplicative(): Expr {
    let left = unary();
    while (at('op', '*') || at('op', '/')) { const op = next().value; left = { type: 'BinOp', op, left, right: unary() }; }
    return left;
  }
  function unary(): Expr {
    if (at('op', '-') || at('keyword', 'not')) { const op = next().value; return { type: 'UnOp', op, operand: unary() }; }
    return postfix();
  }
  function postfix(): Expr {
    let e = primary();
    for (;;) {
      if (at('punct', '.') || at('op', '?.')) {
        const nullSafe = next().value === '?.';
        const name = expect('ident').value;
        e = { type: 'Member', obj: e, name, nullSafe };
      } else if (at('punct', '[')) {
        next();
        const index = expression();
        expect('punct', ']');
        e = { type: 'Index', obj: e, index };
      } else if (at('punct', '(')) {
        next();
        const args: Expr[] = [];
        if (!at('punct', ')')) {
          args.push(expression());
          while (at('punct', ',')) { next(); args.push(expression()); }
        }
        expect('punct', ')');
        e = { type: 'Call', callee: e, args };
      } else break;
    }
    return e;
  }
  function primary(): Expr {
    const t = peek();
    switch (t.kind) {
      case 'number': next(); return { type: 'Literal', litType: 'number', value: Number(t.value) };
      case 'percent': next(); return { type: 'Literal', litType: 'percent', value: Number(t.value) };
      case 'string': next(); return { type: 'Literal', litType: 'string', value: t.value };
      case 'date': next(); return { type: 'Literal', litType: 'date', value: t.value };
      case 'duration': next(); return { type: 'Literal', litType: 'duration', value: t.value };
      case 'ident': next(); return { type: 'Var', name: t.value };
      case 'keyword':
        if (t.value === 'true') { next(); return { type: 'Literal', litType: 'bool', value: true }; }
        if (t.value === 'false') { next(); return { type: 'Literal', litType: 'bool', value: false }; }
        if (t.value === 'null') { next(); return { type: 'Literal', litType: 'null', value: null }; }
        return err('PAY-DSL-SYN-003', `unexpected keyword '${t.value}'`);
      case 'punct':
        if (t.value === '(') { next(); const e = expression(); expect('punct', ')'); return e; }
        if (t.value === '[') return listLit();
        if (t.value === '{') return mapLit();
        return err('PAY-DSL-SYN-003', `unexpected '${t.value}'`);
      default:
        return err('PAY-DSL-SYN-003', `unexpected '${t.value || t.kind}'`);
    }
  }
  function listLit(): Expr {
    expect('punct', '[');
    const items: Expr[] = [];
    if (!at('punct', ']')) {
      items.push(expression());
      while (at('punct', ',')) { next(); items.push(expression()); }
    }
    expect('punct', ']');
    return { type: 'List', items };
  }
  function mapLit(): Expr {
    expect('punct', '{');
    const pairs: { key: string; value: Expr }[] = [];
    if (!at('punct', '}')) {
      const pair = () => {
        const k = peek();
        if (k.kind !== 'ident' && k.kind !== 'string') err('PAY-DSL-SYN-003', 'map key must be an identifier or string');
        next();
        expect('punct', ':');
        pairs.push({ key: k.value, value: expression() });
      };
      pair();
      while (at('punct', ',')) { next(); pair(); }
    }
    expect('punct', '}');
    return { type: 'Map', pairs };
  }

  function type(): string { return expect('ident').value; }

  function formula(): Formula {
    expect('keyword', 'formula');
    const name = expect('string').value;
    expect('op', '::');
    const annotation = type();
    const bindings: Binding[] = [];
    while (at('keyword', 'let')) {
      next();
      const bname = expect('ident').value;
      let annotationB: string | undefined;
      if (at('op', '::')) { next(); annotationB = type(); }
      expect('punct', '=');
      bindings.push({ name: bname, annotation: annotationB, expr: expression() });
    }
    expect('keyword', 'in');
    const body = expression();
    return { name, annotation, bindings, body };
  }

  const expectEof = () => { if (!at('eof')) err('PAY-DSL-SYN-002', `unexpected trailing '${peek().value || peek().kind}'`); };

  return { expression, formula, expectEof };
}

/** PURE — parse a bare expression to an AST. */
export function parseExpression(tokens: Token[]): Expr {
  const p = makeParser(tokens);
  const e = p.expression();
  p.expectEof();
  return e;
}

/** PURE — parse a full `formula "…" :: Type … in …` to an AST. */
export function parseFormula(tokens: Token[]): Formula {
  const p = makeParser(tokens);
  const f = p.formula();
  p.expectEof();
  return f;
}

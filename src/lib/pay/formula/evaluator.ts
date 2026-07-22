/**
 * SFL evaluator (Phase-6 §5/§8). PURE — AST + environment → value. No I/O, no clock, no randomness;
 * short-circuit for `and`/`or`/`??`/`if`. Money is integer paise (reuses money.ts: addMinor/subMinor/
 * mulMinor/roundMinor) — a rupee is never a float. The type-safe money algebra (Phase-6 §3) is
 * enforced at runtime here (and statically by the type checker, a later brick):
 *   Money+Money→Money (same currency)     Money*number/Percentage→Money (rounded)
 *   Money-Money→Money                      Money/number→Money · Money/Money→number(ratio)
 *   Money+number → PAY-DSL-TYPE-010 (no implicit coercion — the float-class guard)
 *
 * Only whitelisted functions (passed in `env.fns`) are callable — an unknown call is PAY-DSL-SEC-060.
 * A missing variable is PAY-DSL-REF-020; divide-by-zero PAY-DSL-RUN-050; a null in a required
 * position PAY-DSL-RUN-052. Values come from the injected environment (the kernel builds it from the
 * ExecutionContext) — the evaluator itself reaches nothing external.
 */

import { addMinor, subMinor, mulMinor, roundMinor } from '../../money.ts';
import type { Expr } from './parser.ts';

export interface MoneyValue { kind: 'money'; minor: number; currency: string; }
export interface PctValue { kind: 'pct'; ratio: number; }
export type Value = unknown;

export interface EvalEnv {
  vars: Record<string, Value>;
  fns: Record<string, (...args: Value[]) => Value>;
}

export const makeMoney = (minor: number, currency: string): MoneyValue => ({ kind: 'money', minor, currency });
const isMoney = (v: Value): v is MoneyValue => !!v && typeof v === 'object' && (v as { kind?: string }).kind === 'money';
const isPct = (v: Value): v is PctValue => !!v && typeof v === 'object' && (v as { kind?: string }).kind === 'pct';
const isNum = (v: Value): v is number => typeof v === 'number';
const rangeErr = (code: string, msg: string) => { throw new RangeError(`${code}: ${msg}`); };
const asBool = (v: Value, ctx: string): boolean => {
  if (typeof v !== 'boolean') rangeErr('PAY-DSL-TYPE-013', `${ctx} requires a Boolean`);
  return v as boolean;
};
const sameCur = (a: MoneyValue, b: MoneyValue) => {
  if (a.currency !== b.currency) rangeErr('PAY-DSL-TYPE-011', `currency mismatch (${a.currency} vs ${b.currency})`);
};

function binop(op: string, l: Value, r: Value): Value {
  switch (op) {
    case '+':
      if (isMoney(l) && isMoney(r)) { sameCur(l, r); return makeMoney(addMinor(l.minor, r.minor), l.currency); }
      if (isNum(l) && isNum(r)) return l + r;
      if (isMoney(l) !== isMoney(r) && (isNum(l) || isNum(r))) rangeErr('PAY-DSL-TYPE-010', 'cannot add Money and a plain number');
      return rangeErr('PAY-DSL-TYPE-012', `'+' unsupported for these types`);
    case '-':
      if (isMoney(l) && isMoney(r)) { sameCur(l, r); return makeMoney(subMinor(l.minor, r.minor), l.currency); }
      if (isNum(l) && isNum(r)) return l - r;
      if (isMoney(l) !== isMoney(r) && (isNum(l) || isNum(r))) rangeErr('PAY-DSL-TYPE-010', 'cannot subtract Money and a plain number');
      return rangeErr('PAY-DSL-TYPE-012', `'-' unsupported for these types`);
    case '*': {
      if (isMoney(l) && isMoney(r)) return rangeErr('PAY-DSL-TYPE-012', 'cannot multiply Money by Money');
      if (isMoney(l) && isNum(r)) return makeMoney(mulMinor(l.minor, r).minor, l.currency);
      if (isNum(l) && isMoney(r)) return makeMoney(mulMinor(r.minor, l).minor, r.currency);
      if (isMoney(l) && isPct(r)) return makeMoney(mulMinor(l.minor, r.ratio).minor, l.currency);
      if (isPct(l) && isMoney(r)) return makeMoney(mulMinor(r.minor, l.ratio).minor, r.currency);
      if (isNum(l) && isPct(r)) return l * r.ratio;
      if (isPct(l) && isNum(r)) return l.ratio * r;
      if (isNum(l) && isNum(r)) return l * r;
      return rangeErr('PAY-DSL-TYPE-012', `'*' unsupported for these types`);
    }
    case '/': {
      if (isMoney(l) && isMoney(r)) { sameCur(l, r); if (r.minor === 0) rangeErr('PAY-DSL-RUN-050', 'divide by zero'); return l.minor / r.minor; }
      if (isMoney(l) && isNum(r)) { if (r === 0) rangeErr('PAY-DSL-RUN-050', 'divide by zero'); return makeMoney(roundMinor(l.minor / r), l.currency); }
      if (isNum(l) && isNum(r)) { if (r === 0) rangeErr('PAY-DSL-RUN-050', 'divide by zero'); return l / r; }
      return rangeErr('PAY-DSL-TYPE-012', `'/' unsupported for these types`);
    }
    case '==': return valuesEqual(l, r);
    case '!=': return !valuesEqual(l, r);
    case '<': case '<=': case '>': case '>=': return compare(op, l, r);
    default: return rangeErr('PAY-DSL-TYPE-012', `unknown operator '${op}'`);
  }
}

function valuesEqual(l: Value, r: Value): boolean {
  if (isMoney(l) && isMoney(r)) return l.minor === r.minor && l.currency === r.currency;
  return l === r;
}
function compare(op: string, l: Value, r: Value): boolean {
  let a: number, b: number;
  if (isMoney(l) && isMoney(r)) { sameCur(l, r); a = l.minor; b = r.minor; }
  else if (isNum(l) && isNum(r)) { a = l; b = r; }
  else return rangeErr('PAY-DSL-TYPE-012', `'${op}' needs two numbers or two Money`) as boolean;
  switch (op) { case '<': return a < b; case '<=': return a <= b; case '>': return a > b; default: return a >= b; }
}

/** PURE — evaluate an AST expression in an environment. */
export function evaluate(node: Expr, env: EvalEnv): Value {
  switch (node.type) {
    case 'Literal':
      if (node.litType === 'percent') return { kind: 'pct', ratio: (node.value as number) / 100 } as PctValue;
      if (node.litType === 'date') return { kind: 'date', iso: node.value };
      if (node.litType === 'duration') return { kind: 'dur', text: node.value };
      return node.value;
    case 'Var':
      if (!(node.name in env.vars)) return rangeErr('PAY-DSL-REF-020', `unknown variable '${node.name}'`);
      return env.vars[node.name];
    case 'UnOp': {
      const v = evaluate(node.operand, env);
      if (node.op === '-') {
        if (isMoney(v)) return makeMoney(-v.minor, v.currency);
        if (isNum(v)) return -v;
        return rangeErr('PAY-DSL-TYPE-012', 'unary - needs a number or Money');
      }
      return !asBool(v, 'not');
    }
    case 'BinOp': {
      if (node.op === 'and') { return asBool(evaluate(node.left, env), 'and') ? asBool(evaluate(node.right, env), 'and') : false; }
      if (node.op === 'or') { return asBool(evaluate(node.left, env), 'or') ? true : asBool(evaluate(node.right, env), 'or'); }
      if (node.op === '??') { const l = evaluate(node.left, env); return l !== null && l !== undefined ? l : evaluate(node.right, env); }
      return binop(node.op, evaluate(node.left, env), evaluate(node.right, env));
    }
    case 'If':
      return asBool(evaluate(node.cond, env), 'if condition') ? evaluate(node.then, env) : evaluate(node.else, env);
    case 'Member': {
      const o = evaluate(node.obj, env);
      if (o === null || o === undefined) {
        if (node.nullSafe) return null;
        return rangeErr('PAY-DSL-RUN-052', `null in required position (.${node.name})`);
      }
      if (typeof o !== 'object') return rangeErr('PAY-DSL-TYPE-012', `cannot read .${node.name} of a non-object`);
      const val = (o as Record<string, Value>)[node.name];
      return val === undefined ? null : val;
    }
    case 'Index': {
      const o = evaluate(node.obj, env);
      const idx = evaluate(node.index, env);
      if (o === null || o === undefined) return rangeErr('PAY-DSL-RUN-052', 'null in required position (index)');
      const val = (o as Record<string, Value>)[idx as string];
      return val === undefined ? null : val;
    }
    case 'Call': {
      if (node.callee.type !== 'Var') return rangeErr('PAY-DSL-SEC-060', 'only named whitelisted functions may be called');
      const fn = env.fns[node.callee.name];
      if (typeof fn !== 'function') return rangeErr('PAY-DSL-SEC-060', `unknown / non-whitelisted function '${node.callee.name}'`);
      return fn(...node.args.map((a) => evaluate(a, env)));
    }
    case 'List':
      return node.items.map((it) => evaluate(it, env));
    case 'Map': {
      const out: Record<string, Value> = {};
      for (const p of node.pairs) out[p.key] = evaluate(p.value, env);
      return out;
    }
    default:
      return rangeErr('PAY-DSL-RUN-000', `cannot evaluate node ${(node as { type?: string }).type}`);
  }
}

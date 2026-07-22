/**
 * SFL type checker (Phase-6 §3/§10). PURE. Statically infers + validates an AST's types so the
 * money-safety class is caught at COMPILE time, before evaluation: Money and a plain number never
 * mix (PAY-DSL-TYPE-010), Money*Money is rejected (PAY-DSL-TYPE-012), logical ops need Booleans
 * (PAY-DSL-TYPE-013). This is the static guard that mirrors the evaluator's runtime money algebra.
 *
 * Types not statically knowable (member/index results, dynamic values) infer as `Unknown`, which is
 * permissive (composes with anything) so the checker never raises a FALSE positive on a dynamically-
 * typed value — it only refuses a genuinely-known type violation.
 *
 * A TypeEnv supplies declared variable types + function signatures (built from the ExecutionContext
 * catalog); an undeclared variable is PAY-DSL-REF-020, an unknown function PAY-DSL-SEC-060.
 */

import type { Expr, Formula } from './parser.ts';

export type SflType =
  | 'Money' | 'Number' | 'Percentage' | 'Boolean' | 'String' | 'Date' | 'Duration' | 'List' | 'Map' | 'Null' | 'Unknown';

export interface FnSig { params: SflType[]; ret: SflType; }
export interface TypeEnv { vars: Record<string, SflType>; fns: Record<string, FnSig>; }

const err = (code: string, msg: string) => { throw new RangeError(`${code}: ${msg}`); };
const U = 'Unknown';
const unk = (t: SflType) => t === 'Unknown';
/** Unknown is compatible with anything; else exact match. */
const compatible = (a: SflType, b: SflType) => unk(a) || unk(b) || a === b;

function checkBin(op: string, l: SflType, r: SflType): SflType {
  switch (op) {
    case '+': case '-':
      if (unk(l) || unk(r)) return U;
      if (l === 'Money' && r === 'Money') return 'Money';
      if (l === 'Number' && r === 'Number') return 'Number';
      if ((l === 'Money') !== (r === 'Money') && (l === 'Number' || r === 'Number'))
        return err('PAY-DSL-TYPE-010', `cannot ${op === '+' ? 'add' : 'subtract'} Money and a plain number`);
      return err('PAY-DSL-TYPE-012', `'${op}' unsupported for ${l} and ${r}`);
    case '*':
      if (unk(l) || unk(r)) return U;
      if (l === 'Money' && r === 'Money') return err('PAY-DSL-TYPE-012', 'cannot multiply Money by Money');
      if ((l === 'Money' && (r === 'Number' || r === 'Percentage')) || ((l === 'Number' || l === 'Percentage') && r === 'Money')) return 'Money';
      if ((l === 'Number' || l === 'Percentage') && (r === 'Number' || r === 'Percentage')) return 'Number';
      return err('PAY-DSL-TYPE-012', `'*' unsupported for ${l} and ${r}`);
    case '/':
      if (unk(l) || unk(r)) return U;
      if (l === 'Money' && r === 'Money') return 'Number';
      if (l === 'Money' && r === 'Number') return 'Money';
      if (l === 'Number' && r === 'Number') return 'Number';
      return err('PAY-DSL-TYPE-012', `'/' unsupported for ${l} and ${r}`);
    case '==': case '!=':
      return 'Boolean';
    case '<': case '<=': case '>': case '>=':
      if (unk(l) || unk(r)) return 'Boolean';
      if ((l === 'Number' && r === 'Number') || (l === 'Money' && r === 'Money')) return 'Boolean';
      return err('PAY-DSL-TYPE-012', `'${op}' needs two Numbers or two Money, got ${l} and ${r}`);
    default:
      return err('PAY-DSL-TYPE-012', `unknown operator '${op}'`);
  }
}

/** PURE — infer + validate the type of an expression. */
export function checkType(node: Expr, env: TypeEnv): SflType {
  switch (node.type) {
    case 'Literal':
      switch (node.litType) {
        case 'number': return 'Number';
        case 'percent': return 'Percentage';
        case 'string': return 'String';
        case 'date': return 'Date';
        case 'duration': return 'Duration';
        case 'bool': return 'Boolean';
        case 'null': return 'Null';
        default: return U;
      }
    case 'Var':
      if (!(node.name in env.vars)) return err('PAY-DSL-REF-020', `undeclared variable '${node.name}'`);
      return env.vars[node.name];
    case 'UnOp': {
      const t = checkType(node.operand, env);
      if (node.op === '-') {
        if (unk(t) || t === 'Number' || t === 'Money') return t === U ? U : t;
        return err('PAY-DSL-TYPE-012', `unary - needs Number or Money, got ${t}`);
      }
      if (!compatible(t, 'Boolean')) return err('PAY-DSL-TYPE-013', `'not' needs a Boolean, got ${t}`);
      return 'Boolean';
    }
    case 'BinOp': {
      if (node.op === 'and' || node.op === 'or') {
        const lt = checkType(node.left, env), rt = checkType(node.right, env);
        if (!compatible(lt, 'Boolean') || !compatible(rt, 'Boolean')) return err('PAY-DSL-TYPE-013', `'${node.op}' needs Booleans, got ${lt} and ${rt}`);
        return 'Boolean';
      }
      if (node.op === '??') {
        const lt = checkType(node.left, env), rt = checkType(node.right, env);
        if (lt === 'Null') return rt;
        return unk(lt) ? U : lt;
      }
      return checkBin(node.op, checkType(node.left, env), checkType(node.right, env));
    }
    case 'If': {
      const ct = checkType(node.cond, env);
      if (!compatible(ct, 'Boolean')) return err('PAY-DSL-TYPE-013', `if-condition needs a Boolean, got ${ct}`);
      const tt = checkType(node.then, env), et = checkType(node.else, env);
      if (unk(tt)) return et;
      if (unk(et)) return tt;
      return tt === et ? tt : U;
    }
    case 'Member': checkType(node.obj, env); return U; // field types not statically tracked
    case 'Index': checkType(node.obj, env); checkType(node.index, env); return U;
    case 'Call': {
      if (node.callee.type !== 'Var') return err('PAY-DSL-SEC-060', 'only named whitelisted functions may be called');
      const calleeName = node.callee.name; // capture here (narrowing is lost inside the forEach closure)
      const sig = env.fns[calleeName];
      if (!sig) return err('PAY-DSL-SEC-060', `unknown / non-whitelisted function '${calleeName}'`);
      if (node.args.length !== sig.params.length) return err('PAY-DSL-TYPE-014', `'${calleeName}' expects ${sig.params.length} args, got ${node.args.length}`);
      node.args.forEach((a, idx) => {
        const at = checkType(a, env);
        if (!compatible(at, sig.params[idx])) err('PAY-DSL-TYPE-015', `'${calleeName}' arg ${idx + 1} expects ${sig.params[idx]}, got ${at}`);
      });
      return sig.ret;
    }
    case 'List': node.items.forEach((it) => checkType(it, env)); return 'List';
    case 'Map': node.pairs.forEach((p) => checkType(p.value, env)); return 'Map';
    default: return U;
  }
}

/** PURE — type-check a full formula: each binding adds its inferred type to a local env; then the
 *  body is checked and (if the formula declares a return type) validated against it. Returns the
 *  body type. */
export function checkFormula(formula: Formula, base: TypeEnv): SflType {
  const env: TypeEnv = { vars: { ...base.vars }, fns: base.fns };
  for (const b of formula.bindings) {
    env.vars[b.name] = checkType(b.expr, env);
  }
  const bodyType = checkType(formula.body, env);
  if (formula.annotation && formula.annotation !== 'Unknown') {
    if (!compatible(bodyType, formula.annotation as SflType)) {
      err('PAY-DSL-TYPE-016', `formula "${formula.name}" declares :: ${formula.annotation} but the body is ${bodyType}`);
    }
  }
  return bodyType;
}

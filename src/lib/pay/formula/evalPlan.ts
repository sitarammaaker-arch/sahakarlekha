/**
 * SFL plan runner (Phase-6 → Phase-8 seam). PURE. The executable counterpart of compile.ts: given a
 * CompiledFormulaSet (the topologically-ordered, type-checked catalog) and an input environment, it
 * evaluates every component IN PLAN ORDER, feeding each result into the environment so that a later
 * component sees the values of the ones it depends on. This is the first point where the whole DSL
 * produces real numbers: catalog → compile → evaluatePlan → paise.
 *
 * No I/O, no clock, no persistence — the environment (input facts + fixed components + whitelisted
 * functions) is INJECTED. The calc engine (Phase-8) builds that environment from the frozen
 * ExecutionContext; this module stays ignorant of where the inputs came from, which is what keeps
 * payroll calculation pure and replayable.
 *
 * Ordering is trusted from the plan (compile already proved it acyclic). A binding-local scope per
 * formula mirrors the type checker's sequential binding semantics exactly, so a value can never be
 * computed under a shape the checker did not validate.
 */

import { evaluate, type EvalEnv, type Value } from './evaluator.ts';
import type { Formula } from './parser.ts';
import type { CompiledFormulaSet } from './compile.ts';

/** PURE — evaluate ONE formula: its `let` bindings first (each scoped over the prior ones), then the
 *  body. Mirrors checkFormula's sequential binding order so runtime shape == checked shape. */
export function evaluateFormula(formula: Formula, env: EvalEnv): Value {
  const vars: Record<string, Value> = { ...env.vars };
  for (const b of formula.bindings) {
    vars[b.name] = evaluate(b.expr, { vars, fns: env.fns });
  }
  return evaluate(formula.body, { vars, fns: env.fns });
}

export interface PlanResult {
  /** Computed value per component code (only the components in the plan). */
  values: Record<string, Value>;
}

/**
 * PURE — run a compiled formula set against an input environment. Each component is evaluated in the
 * plan's topological order and its result is added to the environment for subsequent components, so
 * dependents (GROSS) always read already-computed dependencies (BASIC, DA, HRA). Returns the map of
 * component code → computed value.
 *
 * `inputs.vars` must supply everything the formulas reference that isn't a computed component (input
 * facts, fixed components); `inputs.fns` the whitelisted functions. A missing input surfaces as the
 * evaluator's PAY-DSL-REF-020 — the same refusal the type checker raised at compile time.
 */
export function evaluatePlan(set: CompiledFormulaSet, inputs: EvalEnv): PlanResult {
  const vars: Record<string, Value> = { ...inputs.vars };
  const values: Record<string, Value> = {};
  for (const code of set.order) {
    const cf = set.formulas[code];
    if (!cf) throw new RangeError(`PAY-DSL-RUN-053: plan references uncompiled component '${code}'`);
    const value = evaluateFormula(cf.formula, { vars, fns: inputs.fns });
    vars[code] = value; // later components in the plan can depend on this one
    values[code] = value;
  }
  return { values };
}

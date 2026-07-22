/**
 * SFL formula-catalog compiler (Phase-6 capstone). PURE. The single public entry point of the
 * formula subsystem: it takes a CATALOG of component formulas (config strings) and ties together all
 * five bricks — lexer → parser → type checker → dependency DAG — into ONE validated artifact, the
 * CompiledFormulaSet. That artifact IS the runtime ExecutionContext's `formulaPlan` slice: the
 * topological order the calc kernel evaluates components in, plus each component's parsed AST and
 * checked type.
 *
 * Everything a live payroll could get wrong about a formula is caught HERE, at config-compile time,
 * never during a run:
 *   - a syntax / parse error                          → PAY-DSL-SYN-*
 *   - a money-safety or type violation (Money + n)    → PAY-DSL-TYPE-* (static, before evaluation)
 *   - a reference to an unknown symbol                → PAY-DSL-REF-020
 *   - a call to a non-whitelisted function            → PAY-DSL-SEC-060
 *   - a dependency cycle across components (BASIC↔HRA) → PAY-DSL-DEP-CYCLE
 * Each is re-thrown WITH the offending component code so the config author sees exactly which
 * formula failed; the original PAY-DSL-* code is preserved in the message.
 *
 * Config-first: every formula declares its output type via the mandatory `:: Type` annotation, so a
 * component's type is known BEFORE its body is checked — cross-component references (HRA uses BASIC)
 * resolve regardless of definition order, and each body is validated against its own declared type.
 */

import { tokenize } from './lexer.ts';
import { parseFormula, type Formula } from './parser.ts';
import { checkFormula, type SflType, type TypeEnv } from './typeChecker.ts';
import { formulaDeps, compilePlan, type FormulaPlan } from './dag.ts';

/** One component's source formula. `code` is the component code it computes (e.g. 'HRA'). */
export interface FormulaSource {
  code: string;
  source: string;
}

export interface CompiledFormula {
  code: string;
  formula: Formula;
  /** The checked output type (equals the formula's `::` annotation). */
  type: SflType;
  /** External dependencies (other components / inputs), local bindings excluded. */
  deps: string[];
}

export interface CompiledFormulaSet {
  /** Topological execution order — component codes, dependencies before dependents. */
  order: string[];
  /** Compiled components, by code. */
  formulas: Record<string, CompiledFormula>;
  /** The dependency edges (the formulaPlan carried into the ExecutionContext). */
  plan: FormulaPlan;
}

/**
 * PURE — compile a catalog of component formulas into a validated, runnable set.
 *
 * `base` supplies the types of everything the formulas may reference that ISN'T defined by a formula
 * in this catalog: input facts (attendance.*, payLevel, …), fixed components (a flat BASIC), and the
 * whitelisted function signatures. Each catalog formula's own declared output type is layered on top
 * before any body is checked, so cross-component references resolve independent of order.
 *
 * Throws (with the offending component code) on any PAY-DSL-* violation; a cyclic catalog throws
 * PAY-DSL-DEP-CYCLE. On success every component is parsed, type-checked, and topologically ordered.
 */
export function compileFormulaCatalog(catalog: readonly FormulaSource[], base: TypeEnv): CompiledFormulaSet {
  // 1. Parse every formula first (need each declared type before checking any body).
  const parsed: { code: string; formula: Formula }[] = [];
  const seen = new Set<string>();
  for (const { code, source } of catalog) {
    if (seen.has(code)) throw new RangeError(`PAY-DSL-COMPILE: duplicate component '${code}' in catalog`);
    seen.add(code);
    let formula: Formula;
    try {
      formula = parseFormula(tokenize(source));
    } catch (e) {
      throw new RangeError(`compiling component '${code}': ${(e as Error).message}`);
    }
    parsed.push({ code, formula });
  }

  // 2. Seed a type env with every component's declared (annotated) output type, over the base env.
  const componentTypes: Record<string, SflType> = {};
  for (const { code, formula } of parsed) componentTypes[code] = (formula.annotation as SflType) ?? 'Unknown';
  const env: TypeEnv = { vars: { ...base.vars, ...componentTypes }, fns: base.fns };

  // 3. Type-check each body (validates body-vs-annotation + resolves cross-component refs) and
  //    extract its external dependencies.
  const formulas: Record<string, CompiledFormula> = {};
  const nodes: { name: string; deps: string[] }[] = [];
  for (const { code, formula } of parsed) {
    let type: SflType;
    try {
      type = checkFormula(formula, env);
    } catch (e) {
      throw new RangeError(`compiling component '${code}': ${(e as Error).message}`);
    }
    const deps = formulaDeps(formula);
    formulas[code] = { code, formula, type, deps };
    nodes.push({ name: code, deps });
  }

  // 4. Topologically order the catalog (cycle detection across components).
  const plan = compilePlan(nodes);
  return { order: plan.order, formulas, plan };
}

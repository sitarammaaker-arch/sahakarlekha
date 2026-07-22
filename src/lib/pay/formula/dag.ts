/**
 * SFL dependency DAG (Phase-6 §7). PURE. Extracts each formula's data dependencies from its AST and
 * compiles a set of formulas into a FORMULA PLAN: the topological execution order (dependencies
 * before dependents) + the persisted dependency edges. A cycle (BASIC↔HRA) is a CONFIGURATION error
 * caught here (PAY-DSL-DEP-CYCLE, with the offending path), never at runtime for a live payroll.
 *
 * This is the seam to the runtime: the compiled plan is the ExecutionContext's `formulaPlan` slice
 * (the calc kernel evaluates the components in this order). Dependencies are DATA refs (components /
 * other formulas) — a Call's callee is a whitelisted FUNCTION, not a dependency, so it is excluded.
 */

import type { Expr, Formula } from './parser.ts';

/** PURE — the data variables an expression references (a Call's callee function is NOT a dependency). */
export function extractDeps(expr: Expr): string[] {
  const out = new Set<string>();
  const walk = (n: Expr) => {
    switch (n.type) {
      case 'Var': out.add(n.name); return;
      case 'Call': n.args.forEach(walk); return; // skip the callee (a function, not a data dep)
      case 'Member': walk(n.obj); return; // the root Var is the dependency; `.name` is a field
      case 'Index': walk(n.obj); walk(n.index); return;
      case 'BinOp': walk(n.left); walk(n.right); return;
      case 'UnOp': walk(n.operand); return;
      case 'If': walk(n.cond); walk(n.then); walk(n.else); return;
      case 'List': n.items.forEach(walk); return;
      case 'Map': n.pairs.forEach((p) => walk(p.value)); return;
      case 'Literal': return;
      default: return;
    }
  };
  walk(expr);
  return [...out];
}

/** PURE — a formula's EXTERNAL dependencies: refs in its bindings + body, minus its own binding
 *  names (which are local). */
export function formulaDeps(formula: Formula): string[] {
  const local = new Set(formula.bindings.map((b) => b.name));
  const deps = new Set<string>();
  for (const b of formula.bindings) for (const d of extractDeps(b.expr)) if (!local.has(d)) deps.add(d);
  for (const d of extractDeps(formula.body)) if (!local.has(d)) deps.add(d);
  return [...deps];
}

export interface FormulaNode {
  /** The output this formula produces (e.g. a component code). */
  name: string;
  /** The data it depends on (components / other formulas / external inputs). */
  deps: string[];
}

export interface FormulaPlan {
  /** Execution order — dependencies before dependents. */
  order: string[];
  /** The dependency edges, per node (as given). */
  deps: Record<string, string[]>;
}

/**
 * PURE — compile a set of formula nodes into a plan. Deps that are not themselves nodes are external
 * INPUTS (ignored for ordering). Throws PAY-DSL-DEP-CYCLE (with the path) on a cycle — a formula
 * cannot go active with a cyclic dependency.
 */
export function compilePlan(nodes: readonly FormulaNode[]): FormulaPlan {
  const byName = new Map<string, FormulaNode>();
  for (const n of nodes) {
    if (byName.has(n.name)) throw new RangeError(`PAY-DSL-DEP-DUP: duplicate formula node '${n.name}'`);
    byName.set(n.name, n);
  }

  const state = new Map<string, 'gray' | 'black'>();
  const order: string[] = [];
  const stack: string[] = [];

  const visit = (name: string) => {
    const cur = state.get(name);
    if (cur === 'black') return;
    if (cur === 'gray') {
      const at = stack.indexOf(name);
      const path = [...stack.slice(at), name].join(' → ');
      throw new RangeError(`PAY-DSL-DEP-CYCLE: dependency cycle ${path}`);
    }
    state.set(name, 'gray');
    stack.push(name);
    const node = byName.get(name);
    if (node) for (const d of node.deps) if (byName.has(d)) visit(d); // only order over nodes; inputs skipped
    stack.pop();
    state.set(name, 'black');
    order.push(name);
  };

  for (const n of nodes) visit(n.name);

  const deps: Record<string, string[]> = {};
  for (const n of nodes) deps[n.name] = n.deps;
  return { order, deps };
}

/**
 * Payroll calc engine (Phase-8 capstone). PURE. The single entry point the (impure) server
 * orchestrator calls to compute one employee's payslip. It composes the whole pure pipeline:
 *
 *   compiled plan + facts + injected resolved inputs
 *        │
 *        ├─ runComponents ── facts→env + fixed components → evaluatePlan (topological) ─┐
 *        │                                                                              │
 *        └─ aggregatePayslip ── classify · clamp at value-use · net = earnings−deductions ┘
 *        ▼
 *      Payslip
 *
 * Everything here is a pure function of its inputs: NO I/O, NO clock, NO persistence. The orchestrator
 * does the impure work (fetch catalogs → freezeViews → build the ExecutionContext → persist the
 * result as a pay event) and hands this engine only frozen data — which is exactly what makes a run
 * reproducible: the same inputs always produce the same payslip, so a posted run can be replayed.
 *
 * Keeping this boundary means the entire calculation is unit-testable with plain objects, and the
 * only thing the server adds is the wiring — never business logic.
 */

import { runComponents, type CalcInputs } from './components.ts';
import { aggregatePayslip, type AggregateSpec, type Payslip } from './payslip.ts';
import type { CompiledFormulaSet } from '../formula/compile.ts';

export interface ComputePayslipInput {
  /** The compiled formula catalog (the ExecutionContext's formulaPlan slice). */
  plan: CompiledFormulaSet;
  /** Facts + currency + injected fixed components + whitelisted fns (see CalcInputs). */
  calc: CalcInputs;
  /** Per-component classification + optional statutory clamps (see AggregateSpec, minus currency —
   *  taken from `calc.currency` so the two can never disagree). */
  aggregate: Omit<AggregateSpec, 'currency'>;
}

/**
 * PURE — compute one payslip. Runs the compiled plan against the facts + injected inputs, then
 * aggregates the component values into an earnings/deductions/net payslip. Currency is single-sourced
 * from `calc.currency`, so component money and the payslip totals are guaranteed to share it. Any
 * refusal in the pipeline (unclassified component, missing input, money mismatch) propagates
 * unchanged — the engine never swallows a gap.
 */
export function computePayslip(input: ComputePayslipInput): Payslip {
  const { values } = runComponents(input.plan, input.calc);
  return aggregatePayslip(values, {
    currency: input.calc.currency,
    classification: input.aggregate.classification,
    clamps: input.aggregate.clamps,
  });
}

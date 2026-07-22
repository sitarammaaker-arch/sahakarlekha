/**
 * Component calc seam (Phase-8). PURE. The first point where the three payroll subsystems compose:
 * the runtime's frozen FACTS + the formula subsystem's compiled PLAN → computed component values.
 *
 *   ExecutionContext.facts ──factsToEnv──┐
 *                                        ├── EvalEnv ──evaluatePlan(formulaPlan)──► component paise
 *   resolved fixed components (injected)─┘
 *
 * Two rules kept from the spine:
 *   · Money-safety — a money-typed fact (loan recovery, YTD tax) becomes a MoneyValue, never a raw
 *     paise number, so the evaluator's typed algebra applies and Money+number still refuses. Counts
 *     (paid days, OT hours) stay Numbers.
 *   · Refuse-over-guess — facts carry no currency, so it is an explicit parameter; nothing is
 *     assumed. Fixed-component values are INJECTED (the server derives them from the frozen views);
 *     this module stays pure and ignorant of that I/O, which keeps calculation replayable.
 */

import { makeMoney, type EvalEnv, type Value } from '../formula/evaluator.ts';
import { evaluatePlan, type PlanResult } from '../formula/evalPlan.ts';
import type { CompiledFormulaSet } from '../formula/compile.ts';
import type { EcFacts } from '../runtime/execContext.ts';

/**
 * PURE — expose the frozen facts as evaluator variables a formula can reference. Money amounts are
 * lifted to MoneyValue in `currency`; counts and month-remaining stay Numbers. Shapes:
 *   attendance.{paidDays,lopDays,otHours}  ·  tax.{monthsRemaining,regime,ytd.<head>=Money}
 *   leaveBalance.<type>=Number  ·  loanRecovery=Money(total)  ·  loanRecoveries=[{loanId,amount}]
 */
export function factsToEnv(facts: EcFacts, currency: string): Record<string, Value> {
  const m = (minor: number) => makeMoney(minor, currency);

  const ytd: Record<string, Value> = {};
  for (const [head, minor] of Object.entries(facts.tax.ytdByHead)) ytd[head] = m(minor);

  const leaveBalance: Record<string, Value> = {};
  for (const l of facts.leave) leaveBalance[l.type] = l.balance;

  const loanRecoveries = facts.loan.map((x) => ({ loanId: x.loanId, amount: m(x.amountMinor) }));
  const loanTotalMinor = facts.loan.reduce((s, x) => s + x.amountMinor, 0);

  return {
    attendance: {
      paidDays: facts.attendance.paidDays,
      lopDays: facts.attendance.lopDays,
      otHours: facts.attendance.otHours,
    },
    tax: { monthsRemaining: facts.tax.monthsRemaining, regime: facts.tax.regime, ytd },
    leaveBalance,
    loanRecovery: m(loanTotalMinor),
    loanRecoveries,
  };
}

export interface CalcInputs {
  facts: EcFacts;
  /** Currency for money-typed facts + fixed components (facts carry none — explicit, no guess). */
  currency: string;
  /** Resolved fixed-component values by code (e.g. { BASIC: Money }). INJECTED — the server derives
   *  these from the frozen ruleView/configView; this module never fetches. */
  fixedComponents: Record<string, Value>;
  /** Whitelisted functions available to formulas at run time. */
  fns: EvalEnv['fns'];
}

/**
 * PURE — compute the formula components of a payslip: build the evaluator environment from the facts
 * + injected fixed components, then run the compiled plan in topological order. Returns each formula
 * component's value. A component referencing something neither in the facts nor a fixed component
 * refuses with the evaluator's PAY-DSL-REF-020 — never a silent 0.
 */
export function runComponents(set: CompiledFormulaSet, inputs: CalcInputs): PlanResult {
  const vars: Record<string, Value> = { ...factsToEnv(inputs.facts, inputs.currency), ...inputs.fixedComponents };
  return evaluatePlan(set, { vars, fns: inputs.fns });
}

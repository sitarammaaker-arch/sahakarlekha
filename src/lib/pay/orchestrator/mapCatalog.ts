/**
 * Config → calc mapping (Phase-8/9 orchestrator, PURE). Turns an employee's resolved component
 * catalog + the frozen ruleView into the calc inputs computePayslip/assembleRun consume:
 * formula sources (for the shared plan), fixed component values, classification, and clamps.
 *
 * This encodes the ratified mapping decisions (2026-07-22):
 *   · classification — component_kind → earning / deduction / info (KIND_TO_SIDE); an unknown kind
 *     refuses (PAY-MAP-701), never a silent misclassification.
 *   · value by calc_method:
 *       'formula' and 'attendance_derived' (an alias — proration is expressed AS a formula, no
 *         special engine path) → a formula source for the plan;
 *       'fixed'  → the PER-EMPLOYEE assignment_override amount (there is no structure-level default,
 *         so a 'fixed' component with no override refuses, PAY-MAP-703);
 *       'rule'   → the resolved rule value, looked up by the CONVENTION rule-key = component code
 *         (no rule_ref exists on the component); an unresolved rule refuses (PAY-MAP-704).
 *   · clamps — injected per component (the impure shell resolves rule_kind='clamp' rules); passed
 *     through unchanged.
 *
 * Refuse-over-guess throughout: a missing value, unknown kind, or currency mismatch stops the run —
 * a payroll figure is never invented. Facts (attendance/loan/tax) are NOT mapped here; they stay
 * injected into computePayslip (a later Phase-5 slice wires their source tables).
 */

import { makeMoney, type MoneyValue } from '../formula/evaluator.ts';
import type { FormulaSource } from '../formula/compile.ts';
import type { ComponentSide } from '../calc/payslip.ts';
import type { ClampBounds } from '../resolve/clamps.ts';
import type { ResolvedRule } from '../resolve/ruleResolver.ts';

/** component_kind.code → the payslip side. Ratified 2026-07-22. */
export const KIND_TO_SIDE: Readonly<Record<string, ComponentSide>> = {
  earning: 'earning',
  arrear: 'earning',
  terminal_benefit: 'earning',
  reimbursement: 'earning', // paid to the employee → adds to net (affects_gross=false, but net-relevant)
  deduction: 'deduction',
  loan_recovery: 'deduction',
  employer_contrib: 'info', // employer cost — not in the employee's net (its liability is tracked separately)
};

export type CalcMethod = 'fixed' | 'formula' | 'rule' | 'attendance_derived';

/** One component as it applies to an employee for the period — the impure shell has already picked
 *  the effective component_version and fetched any per-employee override. */
export interface ResolvedComponent {
  code: string;
  kind: string; // component_kind.code
  calcMethod: CalcMethod;
  /** formula_version.expression_text — for 'formula' + 'attendance_derived'. */
  formulaSource?: string | null;
  /** assignment_override.fixed_minor — for 'fixed'. */
  overrideFixedMinor?: number | null;
  /** assignment_override.fixed_currency — optional; must equal the run currency if set. */
  overrideCurrency?: string | null;
}

export interface MapCatalogInput {
  components: readonly ResolvedComponent[];
  /** Frozen resolved rules — for 'rule' component values, keyed by component code (convention). */
  ruleView: Record<string, ResolvedRule<unknown> | null>;
  currency: string;
  /** Per-component statutory clamps the impure shell resolved (rule_kind='clamp'); optional. */
  clamps?: Record<string, ClampBounds>;
}

export interface MappedCalcSpec {
  /** For compileFormulaCatalog — the 'formula'/'attendance_derived' components. */
  formulaSources: FormulaSource[];
  /** Injected fixed inputs — the 'fixed' (override) + 'rule' (resolved) components. */
  fixedComponents: Record<string, MoneyValue>;
  /** component_kind → earning/deduction/info for every component. */
  classification: Record<string, ComponentSide>;
  /** Per-component clamps (passed through). */
  clamps: Record<string, ClampBounds>;
}

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * PURE — map one employee's resolved component catalog to calc inputs. Throws (PAY-MAP-70x) on any
 * gap so a run is refused rather than computed from an invented figure.
 */
export function mapCatalog(input: MapCatalogInput): MappedCalcSpec {
  const formulaSources: FormulaSource[] = [];
  const fixedComponents: Record<string, MoneyValue> = {};
  const classification: Record<string, ComponentSide> = {};
  const clamps: Record<string, ClampBounds> = {};

  for (const c of input.components) {
    const side = KIND_TO_SIDE[c.kind];
    if (side === undefined) throw new RangeError(`PAY-MAP-701: component '${c.code}' has unknown kind '${c.kind}'`);
    classification[c.code] = side;

    // A per-employee FIXED override wins over the component's default behaviour — that is what makes a
    // structure per-employee: the society defines the component once, and one employee's assignment may
    // pin it to an amount of its own (a flat HRA for this person while everyone else uses the % formula).
    if (c.overrideFixedMinor != null && c.calcMethod !== 'fixed') {
      if (!isFiniteNum(c.overrideFixedMinor)) throw new RangeError(`PAY-MAP-705: component '${c.code}' amount is not a finite number`);
      if (c.overrideCurrency && c.overrideCurrency !== input.currency) {
        throw new RangeError(`PAY-MAP-706: component '${c.code}' currency ${c.overrideCurrency} ≠ run currency ${input.currency}`);
      }
      fixedComponents[c.code] = makeMoney(c.overrideFixedMinor, input.currency);
      const b0 = input.clamps?.[c.code];
      if (b0) clamps[c.code] = b0;
      continue;
    }

    switch (c.calcMethod) {
      case 'formula':
      case 'attendance_derived': // proration etc. is expressed as a formula — same engine path
        if (!c.formulaSource) throw new RangeError(`PAY-MAP-702: ${c.calcMethod} component '${c.code}' has no formula source`);
        formulaSources.push({ code: c.code, source: c.formulaSource });
        break;

      case 'fixed': {
        if (c.overrideFixedMinor == null) {
          throw new RangeError(`PAY-MAP-703: 'fixed' component '${c.code}' has no per-employee override amount`);
        }
        if (!isFiniteNum(c.overrideFixedMinor)) throw new RangeError(`PAY-MAP-705: component '${c.code}' amount is not a finite number`);
        if (c.overrideCurrency && c.overrideCurrency !== input.currency) {
          throw new RangeError(`PAY-MAP-706: component '${c.code}' currency ${c.overrideCurrency} ≠ run currency ${input.currency}`);
        }
        fixedComponents[c.code] = makeMoney(c.overrideFixedMinor, input.currency);
        break;
      }

      case 'rule': {
        const resolved = input.ruleView[c.code]; // convention: rule key = component code
        if (!resolved) throw new RangeError(`PAY-MAP-704: 'rule' component '${c.code}' has no resolved rule (key '${c.code}')`);
        if (!isFiniteNum(resolved.value)) throw new RangeError(`PAY-MAP-705: rule for '${c.code}' did not resolve to a finite amount`);
        fixedComponents[c.code] = makeMoney(resolved.value, input.currency); // rule amount is minor (paise)
        break;
      }

      default:
        throw new RangeError(`PAY-MAP-707: component '${c.code}' has unknown calc_method '${String(c.calcMethod)}'`);
    }

    const b = input.clamps?.[c.code];
    if (b) clamps[c.code] = b;
  }

  return { formulaSources, fixedComponents, classification, clamps };
}

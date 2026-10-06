/**
 * Payroll statutory engine (ECR-14 — PF / ESI / PT / TDS).
 *
 * Turns basic + allowances into the statutory deductions a society must withhold and the
 * employer contributions it owes:
 *   PF  — employee share of min(basic, wage ceiling); employer share likewise.
 *   ESI — eligible when gross ≤ the ESI limit: employee and employer shares of gross.
 *   PT / TDS(192) — passed in this slice (state-specific slabs / annual projection come later).
 * The ceiling, the limit and every rate are DATED, flagged-unverified data in lib/rules/epfEsi.ts — read by date, never
 * restated here (a second copy of a statutory number is how the two drift apart).
 *
 * Pure & deterministic → unit-tested by scripts/test-payroll-statutory.mjs.
 */

import { toMinor, toRupees, addMinor, subMinor, applyPercent } from '@/lib/money';
import { resolveStatutory, daysInMonthOf, type StatutoryParamKey, type ParamSegment } from '@/lib/rules/epfEsi';

// The PF wage ceiling, the ESI limit and the PF / ESI rates are EFFECTIVE-DATED DATA now (lib/rules/epfEsi.ts), not constants
// here — so when the law moves a row is appended instead of a number overwritten, and an older month still gets its own law.

export interface StatutoryInput {
  /**
   * The date whose law applies — the first day of the month being processed, NEVER today. REQUIRED, deliberately: a
   * defaulted date silently prices an old slip on today's law (the defect lib/rules/incomeTax.ts was written to end).
   */
  asOf: string;
  basic: number;
  allowances: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  pt?: number;            // professional tax (input)
  tds?: number;           // TDS u/s 192 (input)
  pfCeiling?: number;
  esiThreshold?: number;
  // Manual overrides (₹). null / undefined ⇒ use the auto-computed amount; a number ⇒ use it as-is.
  // The society is the authority on its own payslip — the auto rate is the default, not a cage. An
  // override wins REGARDLESS of eligibility (e.g. add ESI for an edge case the ₹21,000 gate misses).
  pfEmployeeOverride?: number | null;
  pfEmployerOverride?: number | null;
  esiEmployeeOverride?: number | null;
  esiEmployerOverride?: number | null;
}

export interface StatutoryResult {
  /** Which PF / ESI parameters are not yet verified by a person, and which no dated row covers — so a screen can say so. */
  basis: { unverified: StatutoryParamKey[]; stale: StatutoryParamKey[]; pfCeilingSegments: ParamSegment[] };
  gross: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEligible: boolean;
  esiEmployee: number;
  esiEmployer: number;
  pt: number;
  tds: number;
  totalEmployeeDeductions: number;
  employerContributions: number;
  netSalary: number;
}

export function computeStatutory(input: StatutoryInput): StatutoryResult {
  const law = resolveStatutory(input.asOf);
  const pfCeiling = input.pfCeiling ?? law.pfWageCeiling;
  const esiThreshold = input.esiThreshold ?? law.esiWageLimit;
  // T-02: every statutory figure born exact in integer paise — PF/ESI via money.applyPercent
  // (disciplined half-up), sums via addMinor/subMinor. Ceilings, thresholds, eligibility and
  // the interface are unchanged; only the rounding + accumulation moved to minor units.
  const basicMinor = toMinor(Math.max(0, Number(input.basic) || 0));
  const allowMinor = toMinor(Math.max(0, Number(input.allowances) || 0));
  const grossMinor = addMinor(basicMinor, allowMinor);

  // A manual override (if given) replaces the auto amount, in exact paise. null/undefined ⇒ auto.
  const override = (auto: number, ov?: number | null) =>
    ov == null ? auto : toMinor(Math.max(0, Number(ov) || 0));

  // PF wage. Normally ONE ceiling for the month. When the ceiling changes INSIDE the month (EPFO, 17 Sep 2026) the law
  // calculates the month in periods by days — each period on its own ceiling (EPFO FAQ Q7, Q9): wage × days/monthDays,
  // summed. A single-segment month reduces to min(basic, ceiling) exactly, so ordinary months are unchanged.
  // An explicit input.pfCeiling is the caller's own single ceiling and wins, as before.
  const segs = law.pfCeilingSegments;
  const monthDays = segs.reduce((n, g) => n + g.days, 0) || daysInMonthOf(input.asOf) || 30;
  const pfWageMinor = input.pfCeiling != null || segs.length <= 1
    ? Math.min(basicMinor, toMinor(pfCeiling))
    : Math.round(segs.reduce((sum, g) => sum + Math.min(basicMinor, toMinor(g.value)) * g.days, 0) / monthDays);
  const pfEmployeeMinor = override(input.pfApplicable ? applyPercent(pfWageMinor, law.pfEmployeeRate).minor : 0, input.pfEmployeeOverride);
  const pfEmployerMinor = override(input.pfApplicable ? applyPercent(pfWageMinor, law.pfEmployerRate).minor : 0, input.pfEmployerOverride);

  const esiEligible = !!input.esiApplicable && grossMinor > 0 && grossMinor <= toMinor(esiThreshold);
  const esiEmployeeMinor = override(esiEligible ? applyPercent(grossMinor, law.esiEmployeeRate).minor : 0, input.esiEmployeeOverride);
  const esiEmployerMinor = override(esiEligible ? applyPercent(grossMinor, law.esiEmployerRate).minor : 0, input.esiEmployerOverride);

  const ptMinor = toMinor(Math.max(0, Number(input.pt) || 0));
  const tdsMinor = toMinor(Math.max(0, Number(input.tds) || 0));

  const totalEmployeeDeductionsMinor = addMinor(pfEmployeeMinor, esiEmployeeMinor, ptMinor, tdsMinor);
  const employerContributionsMinor = addMinor(pfEmployerMinor, esiEmployerMinor);
  const netSalaryMinor = subMinor(grossMinor, totalEmployeeDeductionsMinor);

  return {
    basis: { unverified: law.unverified, stale: law.stale, pfCeilingSegments: law.pfCeilingSegments },
    gross: toRupees(grossMinor),
    pfEmployee: toRupees(pfEmployeeMinor),
    pfEmployer: toRupees(pfEmployerMinor),
    esiEligible,
    esiEmployee: toRupees(esiEmployeeMinor),
    esiEmployer: toRupees(esiEmployerMinor),
    pt: toRupees(ptMinor),
    tds: toRupees(tdsMinor),
    totalEmployeeDeductions: toRupees(totalEmployeeDeductionsMinor),
    employerContributions: toRupees(employerContributionsMinor),
    netSalary: toRupees(netSalaryMinor),
  };
}

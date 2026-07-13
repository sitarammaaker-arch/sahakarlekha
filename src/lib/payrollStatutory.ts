/**
 * Payroll statutory engine (ECR-14 — PF / ESI / PT / TDS).
 *
 * Turns basic + allowances into the statutory deductions a society must withhold and the
 * employer contributions it owes. Standard rates:
 *   PF  — employee 12% of min(basic, ₹15,000 ceiling); employer 13% (12% + 1% admin/EDLI).
 *   ESI — eligible when gross ≤ ₹21,000: employee 0.75%, employer 3.25% of gross.
 *   PT / TDS(192) — passed in this slice (state-specific slabs / annual projection come later).
 *
 * Pure & deterministic → unit-tested by scripts/test-payroll-statutory.mjs.
 */

import { toMinor, toRupees, addMinor, subMinor, applyPercent } from '@/lib/money';

export const PF_CEILING = 15000;      // EPF wage ceiling (₹/month)
export const ESI_THRESHOLD = 21000;   // ESI applies when gross ≤ this (₹/month)

export interface StatutoryInput {
  basic: number;
  allowances: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  pt?: number;            // professional tax (input)
  tds?: number;           // TDS u/s 192 (input)
  pfCeiling?: number;
  esiThreshold?: number;
}

export interface StatutoryResult {
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
  const pfCeiling = input.pfCeiling ?? PF_CEILING;
  const esiThreshold = input.esiThreshold ?? ESI_THRESHOLD;
  // T-02: every statutory figure born exact in integer paise — PF/ESI via money.applyPercent
  // (disciplined half-up), sums via addMinor/subMinor. Ceilings, thresholds, eligibility and
  // the interface are unchanged; only the rounding + accumulation moved to minor units.
  const basicMinor = toMinor(Math.max(0, Number(input.basic) || 0));
  const allowMinor = toMinor(Math.max(0, Number(input.allowances) || 0));
  const grossMinor = addMinor(basicMinor, allowMinor);

  const pfWageMinor = Math.min(basicMinor, toMinor(pfCeiling));
  const pfEmployeeMinor = input.pfApplicable ? applyPercent(pfWageMinor, 12).minor : 0;
  const pfEmployerMinor = input.pfApplicable ? applyPercent(pfWageMinor, 13).minor : 0;   // 12% + 1% admin/EDLI

  const esiEligible = !!input.esiApplicable && grossMinor > 0 && grossMinor <= toMinor(esiThreshold);
  const esiEmployeeMinor = esiEligible ? applyPercent(grossMinor, 0.75).minor : 0;
  const esiEmployerMinor = esiEligible ? applyPercent(grossMinor, 3.25).minor : 0;

  const ptMinor = toMinor(Math.max(0, Number(input.pt) || 0));
  const tdsMinor = toMinor(Math.max(0, Number(input.tds) || 0));

  const totalEmployeeDeductionsMinor = addMinor(pfEmployeeMinor, esiEmployeeMinor, ptMinor, tdsMinor);
  const employerContributionsMinor = addMinor(pfEmployerMinor, esiEmployerMinor);
  const netSalaryMinor = subMinor(grossMinor, totalEmployeeDeductionsMinor);

  return {
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

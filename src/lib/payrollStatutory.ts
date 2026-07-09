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

const r2 = (n: number) => Math.round(n * 100) / 100;

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
  const basic = Math.max(0, input.basic || 0);
  const allowances = Math.max(0, input.allowances || 0);
  const gross = r2(basic + allowances);

  const pfWage = Math.min(basic, pfCeiling);
  const pfEmployee = input.pfApplicable ? r2(0.12 * pfWage) : 0;
  const pfEmployer = input.pfApplicable ? r2(0.13 * pfWage) : 0;   // 12% + 1% admin/EDLI

  const esiEligible = !!input.esiApplicable && gross > 0 && gross <= esiThreshold;
  const esiEmployee = esiEligible ? r2(0.0075 * gross) : 0;
  const esiEmployer = esiEligible ? r2(0.0325 * gross) : 0;

  const pt = r2(Math.max(0, input.pt || 0));
  const tds = r2(Math.max(0, input.tds || 0));

  const totalEmployeeDeductions = r2(pfEmployee + esiEmployee + pt + tds);
  const employerContributions = r2(pfEmployer + esiEmployer);
  const netSalary = r2(gross - totalEmployeeDeductions);

  return { gross, pfEmployee, pfEmployer, esiEligible, esiEmployee, esiEmployer, pt, tds, totalEmployeeDeductions, employerContributions, netSalary };
}

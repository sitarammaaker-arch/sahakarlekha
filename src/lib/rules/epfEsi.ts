/**
 * PF / ESI statutory parameters as effective-dated DATA — the same discipline as lib/rules/incomeTax.ts (ADR-0008).
 *
 * WHY. The Salary page hard-coded PF_CEILING = 15000, 12% / 13% and the ESI limit 21000 with 0.75% / 3.25% (and the
 * Payroll engine seeds its own copies as editable settings). A figure that lives in code has no date, no provenance and no
 * second place to change it — so when the law moves (an EPFO wage-ceiling change has been REPORTED for 2026-09-17, see
 * below) there is nothing to append to, only a constant to overwrite, which would silently re-price every historical slip.
 * Here every parameter is a dated row: add a row, never overwrite one, and a slip for an older month still reproduces the
 * law of its own month.
 *
 * HISTORY. The first version only MOVED the numbers (no slip changed by a paisa — scripts/test-payroll-statutory.mjs proved it).
 * The EPFO wage-ceiling revision then arrived as a dated row (below), which is exactly the case this structure exists for:
 * a slip for a month before 2026-09-17 still gets ₹15,000; from that date ₹25,000.
 *
 * WHY EVERY ROW IS STILL `verified: false`:
 *   `verified: true` is a claim about a HUMAN, not about a source — somebody who has read the Act / notification text owns
 *   the figure. The rows below now carry the exact official document they were read from (file name, the passage, sha256),
 *   but no person has signed any off against the Gazette / the Act. The test enforces it: a row may be `verified: true`
 *   only if its `cite` contains a URL.
 *
 * A PART-MONTH CHANGE. The EPFO ceiling changed on 17 September 2026 — INSIDE a month. The law says September is one ECR,
 * calculated in two periods by days: up to 16.09 on the old ceiling, from 17.09 on the new one (FAQ Q7, Q9).
 * resolveMonthSegments() returns those periods; a single `asOf` cannot express them.
 *
 * PURE. The date is REQUIRED and never defaulted to today: a defaulted date is how tdsProjection applied FY 2024-25 slabs
 * in FY 2026-27 without anyone knowing.
 */

export type StatutoryParamKey =
  | 'pf.wageCeiling'      // ₹/month — PF is computed on min(wage, ceiling)
  | 'pf.employeeRate'     // % — employee share (Salary page)
  | 'pf.employerRate'     // % — employer share as the Salary page books it (12% + 1% admin/EDLI)
  | 'epf.employerRate'    // % — employer PF share as the Payroll engine splits it (EPS + EPF)
  | 'eps.rate'            // % — employer EPS (pension) share, of EPS wages
  | 'edli.rate'           // % — EDLI contribution
  | 'esi.wageLimit'       // ₹/month — ESI applies when gross ≤ this
  | 'esi.employeeRate'    // %
  | 'esi.employerRate'     // %
  | 'esi.dailyWageExempt';  // ₹/day — employee share waived at or below this average daily wage (NOT USED yet)

export interface ParamRow {
  value: number;
  /** ISO date this value takes effect (inclusive). */
  effectiveFrom: string;
  /**
   * TRUE only when a PERSON has read the Act / notification text and owns the figure. A row marked true MUST cite a URL
   * (enforced by test-epf-esi-rules.mjs). Nothing is true today.
   */
  verified: boolean;
  cite: string;
}

const CARRIED = (what: string) =>
  `CARRIED OVER from ${what}. No start date is established for this value (hence 1970-01-01, "always so far") and it is not sourced here — VERIFY against the Act / notification before relying on it.`;

/** Newest row first, per key. To change a value, ADD a row above the existing one; never edit or delete one. */
export const PARAMS: Record<StatutoryParamKey, ParamRow[]> = {
  'pf.wageCeiling': [
    { value: 25000, effectiveFrom: '2026-09-17', verified: false,
      cite: 'EPFO "Frequently Asked Questions — Revision of EPFO Statutory Wage Ceiling, from ₹15,000 to ₹25,000 per month" (the document linked from https://unifiedportal-emp.epfindia.gov.in/epfo/ , whose own page says "FAQs related to recent revision of EPFO wage ceiling from Rs. 15,000 to Rs. 25,000"). Its header table: "S.O. 5109(E) dated 17 September 2026 | Effective Date 17 September 2026 | Revised Wage Ceiling ₹25,000 per month | Earlier ₹15,000". Read 2026-10-06 from the copy the founder supplied (EPFO_Wage_Ceiling.pdf, 13 pages, sha256 12e6074fd6f031d5412a511d6598ad24d3c8f80ee062abe6eac9994bb16fd591). Applies to EPF, EPS and EDLI (Q5). A part-month is split by days at 17.09.2026 (Q7, Q9). Above the ceiling the statutory contribution is generally restricted to the ceiling unless the employee already contributes on higher wages (Q21, Q22). PF wages = Basic + DA + Retaining Allowance, not gross (Q24-Q26). NOT yet read: the Gazette text of S.O. 5109(E) itself — a person must confirm against it before this is marked verified.' },
    { value: 15000, effectiveFrom: '1970-01-01', verified: false,
      cite: CARRIED('the Salary page constant PF_CEILING (lib/payrollStatutory.ts)') + ' The EPFO FAQ above confirms it was the ceiling until 16.09.2026 ("remained unchanged at ₹15,000 since September 2014", Q4) — but no start date is entered.' },
  ],
  'pf.employeeRate': [
    { value: 12, effectiveFrom: '1970-01-01', verified: false, cite: CARRIED('the Salary page (employee PF 12% of min(basic, ceiling))') },
  ],
  'pf.employerRate': [
    { value: 13, effectiveFrom: '1970-01-01', verified: false, cite: CARRIED('the Salary page (employer PF 13% = 12% + 1% admin/EDLI)') },
  ],
  'epf.employerRate': [
    { value: 12, effectiveFrom: '1970-01-01', verified: false, cite: CARRIED('the Payroll engine seed employer_pf_rate (EPS + EPF split)') },
  ],
  'eps.rate': [
    { value: 8.33, effectiveFrom: '1970-01-01', verified: false, cite: CARRIED('the Payroll engine seed eps_rate (EPS share of EPS wages)') },
  ],
  'edli.rate': [
    { value: 0.5, effectiveFrom: '1970-01-01', verified: false, cite: CARRIED('the Payroll engine seed edli_rate') },
  ],
  'esi.wageLimit': [
    { value: 21000, effectiveFrom: '2017-01-01', verified: false,
      cite: 'ESIC coverage page https://esic.gov.in/coverage — read 2026-10-06 by an automated fetch, which quotes: "The existing wage limit for coverage under the Act, effective from 01.01.2017, is Rs.21,000/- per month (Rs.25,000/- per month in the case of Persons with Disability)." The date and figure agree with the code; a PERSON must still sign it off before it is marked verified. CONFIRMED again in ESIC "A Guide For Employers", section 1 (Coverage of Employee): "…drawing wages up to Rs. 21000/- per month (Rs.25,000/- for Persons with Disability) is covered under the Act" (file and sha256 as in esi.employeeRate; the guide is undated). Not entered: the ₹25,000 limit for persons with disability (the Salary page has no such case).' },
  ],
  'esi.employeeRate': [
    { value: 0.75, effectiveFrom: '1970-01-01', verified: false,
      cite: CARRIED('the Salary page (employee ESI 0.75% of gross)') + ' CONFIRMED in ESIC "A Guide For Employers", section 6 (ESIC Contributions): "The rate of contribution equals to 4 percent of the wages payable to an employee, out of which 3.25 percent is the employers\' share and 0.75 percent is the employees\' share." Read 2026-10-06 from the copy the founder supplied (ESI.pdf, 12 pages, sha256 f63e11d822fbefd15285a8ac5b791101b40d4ff8ebba9fa8e43893a53a8f464c) — the guide carries its own disclaimer that it "may not reflect the most current developments", and it is undated, so the start date is not entered.' },
  ],
  'esi.employerRate': [
    { value: 3.25, effectiveFrom: '1970-01-01', verified: false,
      cite: CARRIED('the Salary page (employer ESI 3.25% of gross)') + ' CONFIRMED in the same ESIC Employers\' Guide, section 6 (see esi.employeeRate for the quotation, file and sha256).' },
  ],
  'esi.dailyWageExempt': [
    // not used by any calculation yet (the Salary page has no such case) — recorded now, with its source, for the ESI component
    { value: 176, effectiveFrom: '1970-01-01', verified: false,
      cite: 'ESIC "A Guide For Employers", section 6: "Employees in receipt of a daily average wage up to Rs.176/- are exempted from payment of contribution. (No deduction of Employees\' share of contribution from employee\'s salary/wages). Employers will, however, pay their own share in respect of these employees." File and sha256 as in esi.employeeRate; undated guide, so no start date is entered. NOT USED by any calculation yet.' },
  ],
};

export interface ResolvedParam {
  value: number;
  row: ParamRow;
  /** TRUE = no row covers `asOf` (before the oldest, or an unreadable date): the NEWEST row is returned and the caller must say so. */
  stale: boolean;
  asOf: string;
}

/** PURE — the value of one parameter on `asOf`, with its provenance. Never defaults the date. */
export function resolveParam(key: StatutoryParamKey, asOf: string): ResolvedParam {
  return resolveRows(PARAMS[key], asOf);
}

/** PURE — the row of a newest-first list that is in force on `asOf` (the resolver itself, separable so it can be tested on a copy). */
export function resolveRows(rows: readonly ParamRow[], asOf: string): ResolvedParam {
  const t = Date.parse(asOf);
  if (!Number.isNaN(t)) {
    for (const r of rows) {   // newest first: the first row already in force is the one that applies
      if (t >= Date.parse(r.effectiveFrom)) return { value: r.value, row: r, stale: false, asOf };
    }
  }
  return { value: rows[0].value, row: rows[0], stale: true, asOf };
}

export interface ParamSegment {
  /** first day of the segment (YYYY-MM-DD) */
  from: string;
  /** last day of the segment, inclusive */
  to: string;
  days: number;
  value: number;
  stale: boolean;
}

/** PURE — YYYY-MM-DD of day `d` (1-based) of the month that starts on `monthStart`. */
const dayIso = (monthStart: string, d: number) => `${monthStart.slice(0, 8)}${String(d).padStart(2, '0')}`;

/** PURE — number of days in the month that starts on `monthStart` (YYYY-MM-01); NaN when unreadable. */
export function daysInMonthOf(monthStart: string): number {
  if (typeof monthStart !== 'string') return NaN;   // a missing date is not a month — never throw, the caller flags it stale
  const y = Number(monthStart.slice(0, 4)), m = Number(monthStart.slice(5, 7));
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return NaN;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * PURE — the periods of a month over which a parameter has ONE value. A month with no change inside it is a single
 * segment (so every ordinary month behaves exactly as a plain resolveParam at its first day). A month that contains an
 * effective date is split there: September 2026 → 1–16 on ₹15,000 and 17–30 on ₹25,000. An unreadable date gives one
 * stale segment of the newest row's value, never a guess about today.
 */
export function resolveMonthSegments(key: StatutoryParamKey, monthStart: string): ParamSegment[] {
  const n = daysInMonthOf(monthStart);
  if (typeof monthStart !== 'string' || !Number.isFinite(n) || !/^\d{4}-\d{2}-01$/.test(monthStart)) {
    const r = resolveRows(PARAMS[key], monthStart);
    return [{ from: monthStart, to: monthStart, days: 1, value: r.value, stale: true }];
  }
  // first days of the month on which a NEW row takes effect, strictly after the 1st
  const cuts = [...new Set(
    PARAMS[key].map((r) => r.effectiveFrom).filter((d) => d > monthStart && d <= dayIso(monthStart, n)),
  )].sort();
  const starts = [monthStart, ...cuts];
  return starts.map((from, i) => {
    const toDay = i + 1 < starts.length ? Number(starts[i + 1].slice(8, 10)) - 1 : n;
    const startDay = Number(from.slice(8, 10));
    const r = resolveRows(PARAMS[key], from);
    return { from, to: dayIso(monthStart, toDay), days: toDay - startDay + 1, value: r.value, stale: r.stale };
  });
}

export interface StatutoryBasis {
  /** the PF ceiling on the FIRST day of the month; when it changes inside the month see pfCeilingSegments */
  pfWageCeiling: number;
  /** the periods of the month, each on one PF ceiling (one segment in an ordinary month) */
  pfCeilingSegments: ParamSegment[];
  pfEmployeeRate: number;
  pfEmployerRate: number;
  esiWageLimit: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  /** keys whose row is not verified by a person — the caller should say "rates not yet verified". */
  unverified: StatutoryParamKey[];
  /** keys that no row covers on this date — the figure is on the newest row's law, and must be labelled so. */
  stale: StatutoryParamKey[];
}

/** PURE — everything the Salary page's PF / ESI computation needs on one date, plus what is unverified or stale. */
export function resolveStatutory(asOf: string): StatutoryBasis {
  const keys = Object.keys(PARAMS) as StatutoryParamKey[];
  const r = Object.fromEntries(keys.map((k) => [k, resolveParam(k, asOf)])) as Record<StatutoryParamKey, ResolvedParam>;
  const pfCeilingSegments = resolveMonthSegments('pf.wageCeiling', asOf);
  return {
    pfWageCeiling: r['pf.wageCeiling'].value,
    pfCeilingSegments,
    pfEmployeeRate: r['pf.employeeRate'].value,
    pfEmployerRate: r['pf.employerRate'].value,
    esiWageLimit: r['esi.wageLimit'].value,
    esiEmployeeRate: r['esi.employeeRate'].value,
    esiEmployerRate: r['esi.employerRate'].value,
    unverified: keys.filter((k) => !r[k].row.verified),
    // a segment can be stale even when the first day is not (it cannot today, but the two answers must agree on principle)
    stale: [...new Set([...keys.filter((k) => r[k].stale), ...(pfCeilingSegments.some((g) => g.stale) ? (['pf.wageCeiling'] as StatutoryParamKey[]) : [])])],
  };
}

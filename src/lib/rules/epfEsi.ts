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
 * WHAT THIS CHANGES: nothing a user can see. Every value below is exactly what the code already used; it has only moved to
 * where it can be dated, flagged and sourced. No slip changes by a paisa (scripts/test-payroll-statutory.mjs proves it).
 *
 * WHAT THIS DOES NOT DO — and why every row is `verified: false`:
 *   `verified: true` is a claim about a HUMAN, not about a source — somebody who has read the Act / notification text owns
 *   the figure. Nobody has, for any row here. So none is marked verified, and the values stay exactly as carried over.
 *   The test enforces it: a row may be `verified: true` only if its `cite` contains a URL.
 *
 * THE ₹25,000 PF CEILING. Web-search results listing PIB releases and a labour.gov.in PDF say the wage ceiling for
 * mandatory EPF coverage was raised from ₹15,000 to ₹25,000 w.e.f. 2026-09-17. PIB and labour.gov.in refused automated
 * access (403), so the primary text was NEVER read. A second row is therefore NOT entered: a statutory number from a
 * search snippet is the exact failure this file exists to prevent. When the notification is in hand, append
 *     { value: 25000, effectiveFrom: '2026-09-17', verified: <true only once a person has read it>, cite: '<URL + the sentence>' }
 * above the existing row — no other code changes.
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
  | 'esi.employerRate';   // %

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
    { value: 15000, effectiveFrom: '1970-01-01', verified: false,
      cite: CARRIED('the Salary page constant PF_CEILING (lib/payrollStatutory.ts)') + ' A rise to ₹25,000 from 2026-09-17 is REPORTED (PIB releases PRID 2314111 / 2313829 / 2310973 / 2311548, per search results) but the primary text was not read — not entered.' },
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
      cite: 'ESIC coverage page https://esic.gov.in/coverage — read 2026-10-06 by an automated fetch, which quotes: "The existing wage limit for coverage under the Act, effective from 01.01.2017, is Rs.21,000/- per month (Rs.25,000/- per month in the case of Persons with Disability)." The date and figure agree with the code; a PERSON must still sign it off before it is marked verified. Not entered: the ₹25,000 limit for persons with disability (the Salary page has no such case).' },
  ],
  'esi.employeeRate': [
    { value: 0.75, effectiveFrom: '1970-01-01', verified: false,
      cite: CARRIED('the Salary page (employee ESI 0.75% of gross)') + ' A search snippet describing a 2019 PIB release gives 01.07.2019 as the start of 0.75% / 3.25%; that page was not opened, so the date is not entered.' },
  ],
  'esi.employerRate': [
    { value: 3.25, effectiveFrom: '1970-01-01', verified: false, cite: CARRIED('the Salary page (employer ESI 3.25% of gross)') },
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

export interface StatutoryBasis {
  pfWageCeiling: number;
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
  return {
    pfWageCeiling: r['pf.wageCeiling'].value,
    pfEmployeeRate: r['pf.employeeRate'].value,
    pfEmployerRate: r['pf.employerRate'].value,
    esiWageLimit: r['esi.wageLimit'].value,
    esiEmployeeRate: r['esi.employeeRate'].value,
    esiEmployerRate: r['esi.employerRate'].value,
    unverified: keys.filter((k) => !r[k].row.verified),
    stale: keys.filter((k) => r[k].stale),
  };
}

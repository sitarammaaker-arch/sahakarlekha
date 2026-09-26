/**
 * Statutory appropriation / dividend limits for the page-level (legacy) path — ReserveFund and
 * ProfitDistribution — resolved from the ONE UCAS catalog (ucas.ts), so the pages and the T-20
 * engine read the same figures (RULE 2).
 *
 * Only figures checked against the Act/Rules TEXT (`verified`) are stated as law or enforced; an
 * unverified common-Act default stays guidance. Today only Haryana (s.87 + rr.72–74) is verified.
 * PURE.
 */
import { resolveJurisdiction } from '../jurisdiction';
import { ucasFigure, type UcasFigure } from './ucas';

export const ACC_RESERVE = '1201';
export const ACC_EDUCATION = '1203';
export const ACC_BAD_DEBT = '1205';

export interface StatutoryLimits {
  jurisdiction: string;
  reserveMin: UcasFigure;     // % of net profit — minimum
  badDebtMin: UcasFigure;     // % of net profit — minimum (0 = no statute)
  educationMax: UcasFigure;   // % of net profit — maximum
  dividendCap: UcasFigure;    // % p.a. of paid-up share capital — maximum
}

export function statutoryLimits(state: string | null | undefined, asOf: string): StatutoryLimits {
  const jurisdiction = resolveJurisdiction(state);
  const o = { jurisdiction, asOf };
  return {
    jurisdiction,
    reserveMin: ucasFigure('reserve_fund_min_pct', o, 25),
    badDebtMin: ucasFigure('bad_debt_fund_min_pct', o, 0),
    educationMax: ucasFigure('education_fund_pct', o, 5),
    dividendCap: ucasFigure('dividend_cap_pct', o, 15),
  };
}

/** true when at least one figure for this jurisdiction was checked against the text. */
export const hasVerifiedLimits = (l: StatutoryLimits) =>
  l.reserveMin.verified || l.badDebtMin.verified || l.educationMax.verified || l.dividendCap.verified;

export interface LimitIssue { accountId: string; hi: string; en: string; cite: string | null }

const pctStr = (n: number) => `${Math.round(n * 100) / 100}%`;

/**
 * Per-fund issues for the proposed appropriation (% of net profit per fund account). Only VERIFIED
 * figures produce issues; a fund already posted is passed as its posted %.
 */
export function appropriationIssues(l: StatutoryLimits, pctByFund: Record<string, number>): LimitIssue[] {
  const out: LimitIssue[] = [];
  const eps = 1e-6;
  const reserve = pctByFund[ACC_RESERVE] ?? 0;
  if (l.reserveMin.verified && reserve + eps < l.reserveMin.pct) {
    out.push({ accountId: ACC_RESERVE, cite: l.reserveMin.cite,
      hi: `वैधानिक संचय निधि ${pctStr(reserve)} है — कम से कम ${pctStr(l.reserveMin.pct)} ज़रूरी है।`,
      en: `Statutory Reserve Fund is ${pctStr(reserve)} — at least ${pctStr(l.reserveMin.pct)} is required.` });
  }
  const bad = pctByFund[ACC_BAD_DEBT] ?? 0;
  if (l.badDebtMin.verified && l.badDebtMin.pct > 0 && bad + eps < l.badDebtMin.pct) {
    out.push({ accountId: ACC_BAD_DEBT, cite: l.badDebtMin.cite,
      hi: `अशोध्य एवं संदिग्ध ऋण निधि ${pctStr(bad)} है — कम से कम ${pctStr(l.badDebtMin.pct)} ज़रूरी है।`,
      en: `Bad & Doubtful Debt Fund is ${pctStr(bad)} — at least ${pctStr(l.badDebtMin.pct)} is required.` });
  }
  const edu = pctByFund[ACC_EDUCATION] ?? 0;
  if (l.educationMax.verified && edu > l.educationMax.pct + eps) {
    out.push({ accountId: ACC_EDUCATION, cite: l.educationMax.cite,
      hi: `शिक्षा निधि ${pctStr(edu)} है — अधिकतम ${pctStr(l.educationMax.pct)} हो सकती है।`,
      en: `Education Fund is ${pctStr(edu)} — at most ${pctStr(l.educationMax.pct)} is allowed.` });
  }
  return out;
}

/** The dividend-rate check: ENFORCED only when the cap is verified for the jurisdiction. */
export function dividendRateIssue(l: StatutoryLimits, ratePct: number): LimitIssue | null {
  if (!l.dividendCap.verified || !(ratePct > l.dividendCap.pct + 1e-9)) return null;
  return { accountId: '1211', cite: l.dividendCap.cite,
    hi: `लाभांश दर ${pctStr(ratePct)} है — चुकता शेयर पूंजी के ${pctStr(l.dividendCap.pct)} प्रति वर्ष से अधिक नहीं हो सकती।`,
    en: `Dividend rate is ${pctStr(ratePct)} — it cannot exceed ${pctStr(l.dividendCap.pct)} p.a. of paid-up share capital.` };
}

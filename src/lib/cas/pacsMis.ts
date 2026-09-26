/**
 * NABARD "Hand Book on MIS for PACS" — the Balance-Sheet-derived returns (CAS-2b slice 1):
 *   Annexure VII   — period-wise classification of overdues
 *   Annexure XVII  — concise structure of the Balance Sheet (monthly-average figures)
 *   Annexure XVIII — financial ratios (NPA, ROA, CAR, CD)
 *
 * PURE. Every figure is read off the CAS Balance Sheet (Annexure IV) the screen already builds, so
 * MIS and the statements can never disagree (RULE 2). Definitions are the Handbook's own
 * ("Preparation of Annexure XV/XVII/XVIII" and the "Calculation of Risk weighted Assets" worksheet).
 * Figures the books cannot support honestly are returned as null with a reason — never guessed.
 */
import type { CasBalanceSheet } from './pacsCas';
import type { AccruableLoan } from '@/lib/loans/interestAccrual';
import { effectiveLoanStatus } from '@/lib/loans/interestAccrual';

const r2 = (n: number) => Math.round(n * 100) / 100;
const rowAmt = (bs: CasBalanceSheet, id: string) => bs.liabilities.concat(bs.assets).flatMap((s) => s.rows).filter((r) => r.id === id).reduce((t, r) => t + r.amount, 0);
const secTotal = (bs: CasBalanceSheet, id: string) => bs.liabilities.concat(bs.assets).find((s) => s.id === id)?.total ?? 0;

// ── Annexure XVII building blocks (Handbook §17) ─────────────────────────────────────────────
export interface MisPosition {
  /** Share capital + statutory & other reserves + undistributed profit, less accumulated loss (= "owned funds", XV Part A 10). */
  equity: number;
  borrowings: number;
  deposits: number;
  /** Balance-sheet total minus contra items and accumulated losses. */
  workingFunds: number;
  /** Gross loans & advances (before the NPA provision). */
  loans: number;
  investments: number;
}

export function misPosition(bs: CasBalanceSheet): MisPosition {
  const loss = rowAmt(bs, 'A8-11');
  const contra = secTotal(bs, 'L8');
  return {
    equity: r2(secTotal(bs, 'L1') + secTotal(bs, 'L2') + secTotal(bs, 'L3') - loss),
    borrowings: r2(secTotal(bs, 'L6')),
    deposits: r2(secTotal(bs, 'L5')),
    workingFunds: r2(bs.totalLiabilities - contra - loss),
    loans: r2(secTotal(bs, 'A5') - rowAmt(bs, 'A5b')),
    investments: r2(secTotal(bs, 'A4')),
  };
}

export const MIS_POSITION_KEYS: { key: keyof MisPosition; label: string; labelHi: string }[] = [
  { key: 'equity', label: 'Equity (Net Worth)', labelHi: 'स्वामित्व निधि (Net Worth)' },
  { key: 'borrowings', label: 'Borrowings', labelHi: 'उधार' },
  { key: 'deposits', label: 'Deposits', labelHi: 'जमाएँ' },
  { key: 'workingFunds', label: 'Working Funds', labelHi: 'कार्यशील निधि' },
  { key: 'loans', label: 'Loans and Advances', labelHi: 'ऋण एवं अग्रिम' },
  { key: 'investments', label: 'Investments', labelHi: 'निवेश' },
];

/** Average of month-end positions (the Handbook asks for monthly averages). */
export function averagePosition(monthEnds: readonly MisPosition[]): MisPosition | null {
  if (!monthEnds.length) return null;
  const avg = (k: keyof MisPosition) => r2(monthEnds.reduce((t, p) => t + p[k], 0) / monthEnds.length);
  return { equity: avg('equity'), borrowings: avg('borrowings'), deposits: avg('deposits'), workingFunds: avg('workingFunds'), loans: avg('loans'), investments: avg('investments') };
}

// ── Annexure XVIII — Capital adequacy: the Handbook's risk-weight worksheet ──────────────────
// Weights per the worksheet. Where the ledger does not hold the split the worksheet asks for, the
// HIGHER weight is used (never flatters CAR) and the choice is listed in `assumptions`.
const RISK_WEIGHTS: { rowId: string; pct: number; note?: string }[] = [
  { rowId: 'A1', pct: 0 },
  { rowId: 'A2', pct: 22.5, note: 'Bank balances: current (20%) vs savings (22.5%) split not held — 22.5% used' },
  { rowId: 'A4i', pct: 2.5 },
  { rowId: 'A4ii', pct: 102.5 },
  { rowId: 'A4iii', pct: 22.5 },
  { rowId: 'A4iv', pct: 22.5 },
  { rowId: 'A4vi', pct: 2.5 },
  { rowId: 'A4vii', pct: 22.5 },
  { rowId: 'A4viii', pct: 102.5 },
  { rowId: 'A5i', pct: 100 },
  { rowId: 'A5ii', pct: 100 },
  { rowId: 'A5xi', pct: 100, note: 'Staff loans: 20% only if covered by mortgage / superannuation — not recorded, 100% used' },
  { rowId: 'A5xii', pct: 100 },
  { rowId: 'A6', pct: 100 },
  { rowId: 'A7i', pct: 100 }, { rowId: 'A7ii', pct: 100 }, { rowId: 'A7iii', pct: 100 }, { rowId: 'A7iv', pct: 100 }, { rowId: 'A7v', pct: 100 },
  { rowId: 'A8-1a-i', pct: 100 }, { rowId: 'A8-1a-ii', pct: 100 }, { rowId: 'A8-1a-iii', pct: 100 },
  { rowId: 'A8-2', pct: 100 }, { rowId: 'A8-3', pct: 100 }, { rowId: 'A8-4', pct: 100 }, { rowId: 'A8-5', pct: 100 },
  { rowId: 'A8-6', pct: 100 }, { rowId: 'A8-7', pct: 100 }, { rowId: 'A8-8', pct: 100 },
];

export function riskWeightedAssets(bs: CasBalanceSheet): { total: number; assumptions: string[] } {
  const rows = new Map(bs.assets.flatMap((s) => s.rows).map((r) => [r.id, r.amount]));
  let total = 0;
  const assumptions: string[] = [];
  for (const w of RISK_WEIGHTS) {
    const amt = rows.get(w.rowId) ?? 0;
    if (Math.abs(amt) < 0.005) continue;
    total += (amt * w.pct) / 100;
    if (w.note) assumptions.push(w.note);
  }
  return { total: r2(total), assumptions };
}

export interface MisRatios {
  /** null: NPA classification norms for PACS are not yet in the app (awaiting the circular). */
  npaRatio: number | null;
  returnOnAssets: number | null;
  capitalAdequacy: number | null;
  creditDeposit: number | null;
  rwaAssumptions: string[];
}

const pct = (num: number, den: number) => (Math.abs(den) < 0.005 ? null : r2((num / den) * 100));

export function misRatios(bs: CasBalanceSheet, netProfit: number): MisRatios {
  const p = misPosition(bs);
  const rwa = riskWeightedAssets(bs);
  return {
    npaRatio: null,
    // "Total assets as per balance sheet minus (contra items and accumulated loss)" = working funds.
    returnOnAssets: pct(netProfit, p.workingFunds),
    capitalAdequacy: pct(p.equity, rwa.total),
    creditDeposit: pct(p.loans, p.deposits),
    rwaAssumptions: rwa.assumptions,
  };
}

// ── Annexure VII — period-wise classification of overdues ──────────────────────────────────
export const OVERDUE_BUCKETS = [
  { key: 'lt1', label: 'Less than 1 year', labelHi: '1 वर्ष से कम', maxYears: 1 },
  { key: 'y1to3', label: '1 – 3 years', labelHi: '1 – 3 वर्ष', maxYears: 3 },
  { key: 'y3to4', label: '3 – 4 years', labelHi: '3 – 4 वर्ष', maxYears: 4 },
  { key: 'y4to5', label: '4 – 5 years', labelHi: '4 – 5 वर्ष', maxYears: 5 },
  { key: 'y5to6', label: '5 – 6 years', labelHi: '5 – 6 वर्ष', maxYears: 6 },
  { key: 'gt6', label: 'More than 6 years', labelHi: '6 वर्ष से अधिक', maxYears: Infinity },
] as const;
export type OverdueBucket = (typeof OVERDUE_BUCKETS)[number]['key'];

/** Rows of the format. The app records KCC as crop loans (ST agricultural); member loans carry a term but no agri / non-agri tag, so they go to "Others" (labelled) rather than being guessed into a row. */
export const OVERDUE_ROWS = [
  { key: 'stAgri', label: 'Short Term Agricultural (KCC)', labelHi: 'अल्पकालीन कृषि (KCC)' },
  { key: 'stNonAgri', label: 'Short Term Non Agricultural', labelHi: 'अल्पकालीन गैर-कृषि' },
  { key: 'mtltAgri', label: 'Medium term / Long term Agricultural', labelHi: 'मध्यम / दीर्घकालीन कृषि' },
  { key: 'mtltConv', label: 'MT / LT (Conversion / Rephasement / Reschedulement)', labelHi: 'मध्यम / दीर्घ (परिवर्तन / पुनर्निर्धारण)' },
  { key: 'mtltNonAgri', label: 'Medium term / Long term Non Agricultural', labelHi: 'मध्यम / दीर्घकालीन गैर-कृषि' },
  { key: 'shg', label: 'SHGs', labelHi: 'स्वयं सहायता समूह (SHG)' },
  { key: 'others', label: 'Others — member loans (agri / non-agri not recorded)', labelHi: 'अन्य — सदस्य ऋण (कृषि / गैर-कृषि दर्ज नहीं)' },
] as const;
export type OverdueRow = (typeof OVERDUE_ROWS)[number]['key'];

export type OverdueTable = Record<OverdueRow | 'total', Record<OverdueBucket, number>>;

const yearsBetween = (from: string, to: string) => {
  const a = new Date(`${from}T00:00:00`), b = new Date(`${to}T00:00:00`);
  return (b.getTime() - a.getTime()) / (365.25 * 24 * 3600 * 1000);
};

export function bucketFor(dueDate: string | undefined, asOf: string): OverdueBucket {
  // Marked overdue with no due date / a due date not yet passed ⇒ youngest bucket.
  const y = dueDate && dueDate < asOf ? yearsBetween(dueDate, asOf) : 0;
  return OVERDUE_BUCKETS.find((b) => y < b.maxYears)!.key;
}

/**
 * Overdue principal outstanding, by loan type and age since the due date. "Overdue" is the ONE
 * app rule (effectiveLoanStatus): due date passed with a balance, or marked overdue.
 */
export function overdueClassification(input: { memberLoans: readonly AccruableLoan[]; kcc: readonly AccruableLoan[]; asOf: string }): OverdueTable {
  const empty = () => Object.fromEntries(OVERDUE_BUCKETS.map((b) => [b.key, 0])) as Record<OverdueBucket, number>;
  const t = Object.fromEntries([...OVERDUE_ROWS.map((r) => r.key), 'total'].map((k) => [k, empty()])) as OverdueTable;
  const add = (row: OverdueRow, l: AccruableLoan) => {
    const out = r2((Number(l.amount) || 0) - (Number(l.repaidAmount) || 0));
    if (out <= 0.005 || effectiveLoanStatus(l, input.asOf) !== 'overdue') return;
    const b = bucketFor(l.dueDate, input.asOf);
    t[row][b] = r2(t[row][b] + out);
    t.total[b] = r2(t.total[b] + out);
  };
  for (const k of input.kcc) add('stAgri', k);
  for (const l of input.memberLoans) add('others', l);
  return t;
}

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

// ── Annexure XVI — performance indicators (Handbook §16) ─────────────────────────────────────
// A "point" is either the current year (snapshot at the as-on date, flows FY-to-date) or one
// quarter (snapshot at the quarter end, flows within the quarter). Every money figure is read
// off the SAME CAS Balance Sheet / CAS P&L the statements show; counts and loan flows come from
// the subsidiary ledgers (the SAME rows the Loan / Deposit Ledger downloads show).
export interface XviFlows { nonCreditIncome: number; interestEarned: number; otherIncome: number; interestPaid: number; operatingExpenses: number }

type PlLike = { income: { rows: { id: string; amount: number }[] }[]; expenditure: { rows: { id: string; amount: number }[] }[] };

/** CAS P&L lines → the XVI income / expense heads. Handbook: non-credit = trading profit + misc income. */
export function plFlows(pl: PlLike): XviFlows {
  const inc = new Map(pl.income.flatMap((s) => s.rows).map((r) => [r.id, r.amount]));
  const exp = pl.expenditure.flatMap((s) => s.rows);
  const g = (ids: string[]) => r2(ids.reduce((t, id) => t + (inc.get(id) ?? 0), 0));
  const interestPaid = r2(exp.filter((r) => r.id.startsWith('E2')).reduce((t, r) => t + r.amount, 0));
  // Operating expenses = interest + staff + other operating costs: every expenditure line except
  // the gross loss brought in (E1), provisions (E15) and the profit balancing figure (E16).
  const operatingExpenses = r2(exp.filter((r) => !['E1', 'E15', 'E16'].includes(r.id)).reduce((t, r) => t + r.amount, 0));
  return { nonCreditIncome: g(['I1', 'I6']), interestEarned: g(['I2', 'I3i', 'I3ii']), otherIncome: g(['I4', 'I5']), interestPaid, operatingExpenses };
}
export const subtractFlows = (a: XviFlows, b: XviFlows | null): XviFlows => (b ? {
  nonCreditIncome: r2(a.nonCreditIncome - b.nonCreditIncome), interestEarned: r2(a.interestEarned - b.interestEarned), otherIncome: r2(a.otherIncome - b.otherIncome),
  interestPaid: r2(a.interestPaid - b.interestPaid), operatingExpenses: r2(a.operatingExpenses - b.operatingExpenses),
} : a);

/** Members on the rolls at a date: admitted by then, and not yet out (an exit dated after the date still counts). */
export function membersAt(members: readonly { joinDate?: string; status: string; statusChangedAt?: string; approvalStatus?: string }[], date: string): number {
  return members.filter((m) => (!m.approvalStatus || m.approvalStatus === 'approved')
    && (!m.joinDate || m.joinDate <= date)
    && (m.status === 'active' || (!!m.statusChangedAt && m.statusChangedAt.slice(0, 10) > date))).length;
}

type LoanRowLike = { date: string; disbursed: number; principalRecovered: number };
/** Principal outstanding on a Loan Ledger at a date. */
export const principalAt = (rows: readonly LoanRowLike[], date: string) =>
  r2(rows.filter((r) => r.date <= date).reduce((t, r) => t + r.disbursed - r.principalRecovered, 0));
/** Disbursed / principal recovered in (after, upto]. */
export const loanFlowsBetween = (rows: readonly LoanRowLike[], after: string | null, upto: string) => {
  const inP = rows.filter((r) => (!after || r.date > after) && r.date <= upto);
  return { issued: r2(inP.reduce((t, r) => t + r.disbursed, 0)), recovered: r2(inP.reduce((t, r) => t + r.principalRecovered, 0)) };
};
/** Deposit balance at a date = the recorded balance after the last entry on or before it. */
export const depositBalanceAt = (rows: readonly { date: string; balance: number }[], date: string) => {
  const upto = rows.filter((r) => r.date <= date);
  return upto.length ? upto[upto.length - 1].balance : 0;
};

export interface XviPoint {
  members: number; borrowers: number; depositors: number;
  memberCapital: number; deposits: number; borrowings: number; dccbBorrowings: number; totalLiabilities: number;
  loansIssued: number; recovery: number; loansOutstanding: number; totalAssets: number;
  flows: XviFlows;
  /** Average of month-end total assets over the period (null: no month ended yet). */
  avgTotalAssets: number | null;
}

/** Balance-sheet part of a point. */
export function xviBalances(bs: CasBalanceSheet) {
  const dccb = bs.liabilities.flatMap((s) => s.rows).filter((r) => r.id.startsWith('L6a')).reduce((t, r) => t + r.amount, 0);
  return {
    memberCapital: r2(secTotal(bs, 'L1')), deposits: r2(secTotal(bs, 'L5')), borrowings: r2(secTotal(bs, 'L6')), dccbBorrowings: r2(dccb),
    totalLiabilities: r2(bs.totalLiabilities), loansOutstanding: misPosition(bs).loans, totalAssets: r2(bs.totalAssets),
  };
}

export interface XviRow { key: string; label: string; labelHi: string; unit: 'no' | 'rs' | 'pct'; value: (p: XviPoint) => number | null; why?: { en: string; hi: string } }
const div = (a: number, b: number) => (Math.abs(b) < 0.005 ? null : r2(a / b));
export const XVI_ROWS: XviRow[] = [
  { key: 'members', label: 'Members', labelHi: 'सदस्य', unit: 'no', value: (p) => p.members },
  { key: 'borrowers', label: 'Borrowers', labelHi: 'उधारकर्ता', unit: 'no', value: (p) => p.borrowers },
  { key: 'depositors', label: 'Depositors', labelHi: 'जमाकर्ता', unit: 'no', value: (p) => p.depositors },
  { key: 'capital', label: 'Members Capital', labelHi: 'सदस्य पूँजी', unit: 'rs', value: (p) => p.memberCapital },
  { key: 'deposits', label: 'Deposits', labelHi: 'जमाएँ', unit: 'rs', value: (p) => p.deposits },
  { key: 'borrowings', label: 'Borrowings from DCCBs and others', labelHi: 'DCCB व अन्य से उधार', unit: 'rs', value: (p) => p.borrowings },
  { key: 'liab', label: 'Total Liabilities', labelHi: 'कुल देनदारियाँ', unit: 'rs', value: (p) => p.totalLiabilities },
  { key: 'issued', label: 'Loans issued', labelHi: 'वितरित ऋण', unit: 'rs', value: (p) => p.loansIssued },
  { key: 'recovery', label: 'Recovery (principal)', labelHi: 'वसूली (मूलधन)', unit: 'rs', value: (p) => p.recovery },
  { key: 'outstanding', label: 'Total Loans Outstanding', labelHi: 'कुल बकाया ऋण', unit: 'rs', value: (p) => p.loansOutstanding },
  { key: 'assets', label: 'Total Assets', labelHi: 'कुल परिसंपत्तियाँ', unit: 'rs', value: (p) => p.totalAssets },
  { key: 'noncredit', label: 'Income from non-credit activities (trading profit + misc. income)', labelHi: 'गैर-ऋण गतिविधियों से आय (व्यापार लाभ + विविध आय)', unit: 'rs', value: (p) => p.flows.nonCreditIncome },
  { key: 'intEarned', label: 'Interest earned (income from credit activities)', labelHi: 'अर्जित ब्याज (ऋण गतिविधियों से आय)', unit: 'rs', value: (p) => p.flows.interestEarned },
  { key: 'other', label: 'Income from other activities (rent, admission fees)', labelHi: 'अन्य गतिविधियों से आय (किराया, प्रवेश शुल्क)', unit: 'rs', value: (p) => p.flows.otherIncome },
  { key: 'intPaid', label: 'Interest paid on deposits and borrowings', labelHi: 'जमा व उधार पर चुकाया ब्याज', unit: 'rs', value: (p) => p.flows.interestPaid },
  { key: 'opex', label: 'Total Operating Expenses for the period', labelHi: 'अवधि का कुल परिचालन व्यय', unit: 'rs', value: (p) => p.flows.operatingExpenses },
  { key: 'avgDep', label: 'Average deposit per member', labelHi: 'प्रति सदस्य औसत जमा', unit: 'rs', value: (p) => div(p.deposits, p.members) },
  { key: 'avgLoan', label: 'Average loan per borrowing member', labelHi: 'प्रति उधारकर्ता सदस्य औसत ऋण', unit: 'rs', value: (p) => div(p.loansOutstanding, p.borrowers) },
  { key: 'avgDccb', label: 'Average loan repayable to DCCB per borrowing member', labelHi: 'प्रति उधारकर्ता सदस्य DCCB को देय औसत ऋण', unit: 'rs', value: (p) => div(p.dccbBorrowings, p.borrowers) },
  { key: 'pctBorrow', label: '% of borrowing members to total members', labelHi: 'कुल सदस्यों में उधारकर्ता %', unit: 'pct', value: (p) => pct(p.borrowers, p.members) },
  { key: 'pctDepBor', label: '% of depositors to borrowers', labelHi: 'उधारकर्ताओं की तुलना में जमाकर्ता %', unit: 'pct', value: (p) => pct(p.depositors, p.borrowers) },
  { key: 'loansAssets', label: 'Total loans / Total Assets', labelHi: 'कुल ऋण / कुल परिसंपत्ति', unit: 'pct', value: (p) => pct(p.loansOutstanding, p.totalAssets) },
  { key: 'depAssets', label: 'Total deposits / Total Assets', labelHi: 'कुल जमा / कुल परिसंपत्ति', unit: 'pct', value: (p) => pct(p.deposits, p.totalAssets) },
  { key: 'opexAssets', label: 'Operating expenses / average total assets', labelHi: 'परिचालन व्यय / औसत कुल परिसंपत्ति', unit: 'pct', value: (p) => (p.avgTotalAssets == null ? null : pct(p.flows.operatingExpenses, p.avgTotalAssets)) },
  { key: 'intCover', label: 'Interest earned to interest paid', labelHi: 'अर्जित ब्याज / चुकाया ब्याज', unit: 'pct', value: (p) => pct(p.flows.interestEarned, p.flows.interestPaid) },
  { key: 'odDemand', label: '% of overdues to demand', labelHi: 'माँग की तुलना में अतिदेय %', unit: 'pct', value: () => null,
    why: { en: 'needs the DCB demand (instalments falling due) — the app keeps one due date per loan, not a demand schedule', hi: 'इसके लिए DCB माँग (देय हुई किस्तें) चाहिए — ऐप में हर ऋण की एक ही देय तिथि है, माँग-सूची नहीं' } },
  { key: 'npa', label: '% of NPA to loans and advances', labelHi: 'ऋणों में NPA %', unit: 'pct', value: () => null,
    why: { en: 'PACS NPA classification periods (circular) not yet in the app', hi: 'PACS के NPA वर्गीकरण की अवधि-सीमा (circular) अभी ऐप में नहीं है' } },
];

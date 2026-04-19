/**
 * Proforma 1 (Annual Review Report — Haryana Marketing Societies) Calculator
 *
 * Aggregates ledger-posted amounts within a financial year into the
 * 24 rows of Proforma 1: Income/Expense Summary + Turnover + Investments.
 *
 * Classification is driven by tags on LedgerAccount:
 *   - p1IncomeCategory, cropCategory  → income rows (1-10)
 *   - p1ExpenseBucket                 → expense rows (12 a-f)
 *   - turnoverBucket                  → turnover rows (17 a-f)
 *
 * All amounts returned in RUPEES (not lacs) — UI layer converts.
 */
import type { Voucher, LedgerAccount, Member, SocietySettings, CropCategory, P1ExpenseBucket, TurnoverBucket } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';

export interface P1CommissionByCrop {
  wheat: number; paddy: number; sunflower: number; mustard: number;
  gram: number; bajra: number; maize: number; moong: number; other: number;
}

export interface P1ExpenseBreakdown {
  admn: number;           // a) Admn. Exp.
  office: number;         // b) Office Over Head Exp.
  marketing: number;      // c) Marketing Trading Exp.
  fertPesticide: number;  // d) Fertilizer & Pesticides Trading Exp.
  processing: number;     // e) Processing Exp on Own Units
  other: number;          // f) Other Exp., if any
}

export interface P1TurnoverBreakdown {
  procurement: number;   // a
  consumer: number;      // b
  fertilizer: number;    // c
  pesticide: number;     // d
  cattleFeed: number;    // e
  nonHafed: number;      // f
}

export interface P1Result {
  // Row 1 — Commission by crop
  commission: P1CommissionByCrop;
  commissionTotal: number;
  // Row 2
  patronageRebate: number;
  patronageOther: number;
  // Row 3 = 1 + 2
  totalIncomeCommissionPatronage: number;
  // Rows 4-10
  inputMargin: number;
  consumerSale: number;
  processingIncome: number;
  truckIncome: number;
  rentalIncome: number;
  hafedOther: number;
  nonHafedIncome: number;
  // Row 11 = 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10
  totalIncome: number;
  // Row 12
  expenses: P1ExpenseBreakdown;
  // Row 13
  totalExpenses: number;
  // Row 14
  netProfitLoss: number;
  // Row 15 — manual (from Balance Sheet)
  accumulatedProfitLoss: number;
  // Row 16 — manual Y/N
  wholesaleFertPesticide: boolean;
  // Row 17 — turnover breakdown
  turnover: P1TurnoverBreakdown;
  // Row 18 = sum of 17
  turnoverTotal: number;
  // Rows 19-24 — mostly from other modules/manual
  employeeCount: number;
  shareCapital: number;
  hafedShareInvestment: number;    // manual
  hafedFdr: number;                // manual
  otherInvestment: number;         // manual
  lossReasons: string;             // manual

  // Metadata — which accounts are classified vs unclassified
  unclassifiedIncomeAccounts: Array<{ id: string; name: string; amount: number }>;
  unclassifiedExpenseAccounts: Array<{ id: string; name: string; amount: number }>;
}

export interface P1Inputs {
  accounts: LedgerAccount[];
  vouchers: Voucher[];
  members: Member[];
  society: SocietySettings;
  fromDate: string;  // inclusive, ISO yyyy-mm-dd
  toDate: string;    // inclusive, ISO yyyy-mm-dd
  employeeCount?: number;
  // Manual override values (persisted with report)
  manualOverrides?: Partial<{
    patronageRebate: number;
    patronageOther: number;
    accumulatedProfitLoss: number;
    wholesaleFertPesticide: boolean;
    hafedShareInvestment: number;
    hafedFdr: number;
    otherInvestment: number;
    lossReasons: string;
  }>;
}

/**
 * Returns the net amount posted to an account within [from, to].
 * For income accounts: returns positive if Credit-side posted more (usual case).
 * For expense accounts: returns positive if Debit-side posted more (usual case).
 */
function accountMovement(
  accountId: string,
  vouchers: Voucher[],
  fromDate: string,
  toDate: string,
  nature: 'income' | 'expense',
): number {
  let dr = 0, cr = 0;
  vouchers.forEach(v => {
    if (v.isDeleted) return;
    if (v.date < fromDate || v.date > toDate) return;
    getVoucherLines(v).forEach(l => {
      if (l.accountId !== accountId) return;
      if (l.type === 'Dr') dr += l.amount; else cr += l.amount;
    });
  });
  return nature === 'income' ? cr - dr : dr - cr;
}

export function calculateP1(input: P1Inputs): P1Result {
  const { accounts, vouchers, members, fromDate, toDate, manualOverrides = {} } = input;

  // ── Row 1 — Commission by crop ──
  const commission: P1CommissionByCrop = {
    wheat: 0, paddy: 0, sunflower: 0, mustard: 0,
    gram: 0, bajra: 0, maize: 0, moong: 0, other: 0,
  };
  // ── Other income categories ──
  let inputMargin = 0, consumerSale = 0, processingIncome = 0;
  let truckIncome = 0, rentalIncome = 0, hafedOther = 0, nonHafedIncome = 0;

  const unclassifiedIncomeAccounts: P1Result['unclassifiedIncomeAccounts'] = [];

  const incomeAccounts = accounts.filter(a => a.type === 'income' && !a.isGroup);
  incomeAccounts.forEach(acc => {
    const amt = accountMovement(acc.id, vouchers, fromDate, toDate, 'income');
    if (amt === 0) return;
    const cat = acc.p1IncomeCategory;
    if (cat === 'commission') {
      const crop = (acc.cropCategory || 'other') as keyof P1CommissionByCrop;
      commission[crop] += amt;
    } else if (cat === 'patronageRebate') {
      // patronage rebate goes to row 2 — fall-through to manual override
    } else if (cat === 'inputMargin')      inputMargin += amt;
    else if (cat === 'consumerSale')       consumerSale += amt;
    else if (cat === 'processingIncome')   processingIncome += amt;
    else if (cat === 'truckIncome')        truckIncome += amt;
    else if (cat === 'rentalIncome')       rentalIncome += amt;
    else if (cat === 'hafedOther')         hafedOther += amt;
    else if (cat === 'nonHafedIncome')     nonHafedIncome += amt;
    else unclassifiedIncomeAccounts.push({ id: acc.id, name: acc.name, amount: amt });
  });

  const commissionTotal = Object.values(commission).reduce((a, b) => a + b, 0);

  // Patronage rebate — use manual override, else sum of tagged accounts
  const patronageFromAccounts = incomeAccounts
    .filter(a => a.p1IncomeCategory === 'patronageRebate')
    .reduce((s, a) => s + accountMovement(a.id, vouchers, fromDate, toDate, 'income'), 0);
  const patronageRebate = manualOverrides.patronageRebate ?? patronageFromAccounts;
  const patronageOther  = manualOverrides.patronageOther ?? 0;

  // Row 3
  const totalIncomeCommissionPatronage = commissionTotal + patronageRebate + patronageOther;

  // Row 11 — total income
  const totalIncome = totalIncomeCommissionPatronage + inputMargin + consumerSale
                    + processingIncome + truckIncome + rentalIncome + hafedOther + nonHafedIncome;

  // ── Row 12 — Expenses ──
  const expenses: P1ExpenseBreakdown = {
    admn: 0, office: 0, marketing: 0, fertPesticide: 0, processing: 0, other: 0,
  };
  const unclassifiedExpenseAccounts: P1Result['unclassifiedExpenseAccounts'] = [];
  const expenseAccounts = accounts.filter(a => a.type === 'expense' && !a.isGroup);
  expenseAccounts.forEach(acc => {
    const amt = accountMovement(acc.id, vouchers, fromDate, toDate, 'expense');
    if (amt === 0) return;
    const bucket = acc.p1ExpenseBucket as P1ExpenseBucket | undefined;
    if (bucket && bucket in expenses) {
      expenses[bucket] += amt;
    } else {
      unclassifiedExpenseAccounts.push({ id: acc.id, name: acc.name, amount: amt });
    }
  });
  const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);

  // Row 14
  const netProfitLoss = totalIncome - totalExpenses;

  // ── Row 17 — Turnover breakdown ──
  // Turnover is gross Sales posting (credit side of sale income/turnover accounts OR a dedicated tag).
  // We sum all accounts tagged with turnoverBucket. For income accounts: credit-side; for others treat as income.
  const turnover: P1TurnoverBreakdown = {
    procurement: 0, consumer: 0, fertilizer: 0,
    pesticide: 0, cattleFeed: 0, nonHafed: 0,
  };
  accounts.filter(a => a.turnoverBucket && !a.isGroup).forEach(acc => {
    const bucket = acc.turnoverBucket as TurnoverBucket;
    const amt = accountMovement(acc.id, vouchers, fromDate, toDate, 'income');
    turnover[bucket] += amt;
  });
  const turnoverTotal = Object.values(turnover).reduce((a, b) => a + b, 0);

  // ── Row 20 — Share Capital (sum from approved members) ──
  const shareCapital = members
    .filter(m => !m.approvalStatus || m.approvalStatus === 'approved')
    .reduce((s, m) => s + (m.shareCapital || 0), 0);

  return {
    commission,
    commissionTotal,
    patronageRebate,
    patronageOther,
    totalIncomeCommissionPatronage,
    inputMargin,
    consumerSale,
    processingIncome,
    truckIncome,
    rentalIncome,
    hafedOther,
    nonHafedIncome,
    totalIncome,
    expenses,
    totalExpenses,
    netProfitLoss,
    accumulatedProfitLoss: manualOverrides.accumulatedProfitLoss ?? 0,
    wholesaleFertPesticide: manualOverrides.wholesaleFertPesticide ?? false,
    turnover,
    turnoverTotal,
    employeeCount: input.employeeCount ?? 0,
    shareCapital,
    hafedShareInvestment: manualOverrides.hafedShareInvestment ?? 0,
    hafedFdr: manualOverrides.hafedFdr ?? 0,
    otherInvestment: manualOverrides.otherInvestment ?? 0,
    lossReasons: manualOverrides.lossReasons ?? '',
    unclassifiedIncomeAccounts,
    unclassifiedExpenseAccounts,
  };
}

export const CROP_LABELS: Record<CropCategory, string> = {
  wheat: 'Wheat / गेहूं',
  paddy: 'Paddy / धान',
  sunflower: 'Sunflower Seed / सूरजमुखी',
  mustard: 'Mustard Seed / सरसों',
  gram: 'Gram / चना',
  bajra: 'Bajra / बाजरा',
  maize: 'Maize / मक्का',
  moong: 'Moong / मूंग',
  other: 'Other / अन्य',
};

export const EXPENSE_BUCKET_LABELS: Record<P1ExpenseBucket, string> = {
  admn: 'Admn. Exp.',
  office: 'Office Over Head Exp.',
  marketing: 'Marketing Trading Exp.',
  fertPesticide: 'Fertilizer & Pesticides Trading Exp.',
  processing: 'Processing Exp on Own Units',
  other: 'Other Exp., if any',
};

export const TURNOVER_BUCKET_LABELS: Record<TurnoverBucket, string> = {
  procurement: 'Turnover from procurement',
  consumer: 'Marketing (Consumer Products)',
  fertilizer: 'Turnover from fertilizers',
  pesticide: 'Turnover from Pesticides',
  cattleFeed: 'Turnover Cattle Feed Plant',
  nonHafed: 'Turnover other than Hafed',
};

/** Format rupees into lacs (Rs. in Lacs) as required by Proforma 1. */
export const toLacs = (rs: number) => rs / 100000;
export const fmtLacs = (rs: number) => (rs / 100000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

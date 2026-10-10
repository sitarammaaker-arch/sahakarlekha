/**
 * Printable shape of the subsidiary ledgers — one table spec feeds the screen dialog, the PDF and
 * the Excel file, so all three show the same rows (RULE 2). PURE.
 * PDFs are English-only (helvetica), like every other report PDF in the app.
 */
import type { Cell } from '@/lib/exportUtils';
import type { DepositLedger, LoanLedger, StockRegister } from './subsidiaryLedgers';

export interface LedgerColumn { en: string; hi: string; num?: boolean }
export interface LedgerTable {
  title: string; titleHi: string;
  /** Account / loan / item line under the title. */
  subtitle: string;
  columns: LedgerColumn[];
  /** rowsEn for PDF/Excel; rowsHi only differs in the particulars column. */
  rowsEn: Cell[][];
  rowsHi: Cell[][];
  totals: Cell[];
  notes: { en: string; hi: string }[];
}

const q = (n: number) => Math.round(n * 1000) / 1000;

export function depositLedgerTable(l: DepositLedger, head: { accountNo: string; memberName: string; type: string }): LedgerTable {
  const base = (p: string) => (r: DepositLedger['rows'][number]): Cell[] => [r.date, p === 'hi' ? r.particularsHi : r.particulars, r.voucherNo, r.credit || null, r.debit || null, r.balance];
  return {
    title: 'Deposit Ledger', titleHi: 'जमा खाता-बही (Deposit Ledger)',
    subtitle: `${head.accountNo} · ${head.type} · ${head.memberName}`,
    columns: [{ en: 'Date', hi: 'तिथि' }, { en: 'Particulars', hi: 'विवरण' }, { en: 'Voucher', hi: 'वाउचर' },
      { en: 'Credit (deposit)', hi: 'जमा', num: true }, { en: 'Debit (withdrawal)', hi: 'निकासी', num: true }, { en: 'Balance', hi: 'शेष', num: true }],
    rowsEn: l.rows.map(base('en')), rowsHi: l.rows.map(base('hi')),
    totals: ['', 'Total', '', l.totalCredit, l.totalDebit, l.closing],
    notes: l.mismatch ? [{ en: 'The recorded running balance does not match the arithmetic of the entries — please check this account.', hi: 'दर्ज शेष और प्रविष्टियों का जोड़ मेल नहीं खाता — इस खाते की जाँच करें।' }] : [],
  };
}

export function loanLedgerTable(l: LoanLedger, head: { loanNo: string; memberName: string; kind: string; recordedOutstanding: number }): LedgerTable {
  const base = (p: string) => (r: LoanLedger['rows'][number]): Cell[] => [r.date, p === 'hi' ? r.particularsHi : r.particulars, r.voucherNo,
    r.disbursed || null, r.principalRecovered || null, r.principalBalance, r.interestCharged || null, r.interestReceived || null];
  const notes: LedgerTable['notes'] = [];
  if (l.mismatch) notes.push({
    en: `Principal recovered per the repayment vouchers (${l.totals.principalRecovered}) differs from the repaid amount recorded on the loan — outstanding on the loan record: ${head.recordedOutstanding}. A repayment may have been entered without a voucher, or a voucher cancelled.`,
    hi: `चुकौती वाउचरों के अनुसार मूल वसूली (${l.totals.principalRecovered}) ऋण पर दर्ज चुकौती से अलग है — ऋण रिकॉर्ड पर बकाया: ${head.recordedOutstanding}। हो सकता है कोई चुकौती बिना वाउचर दर्ज हुई हो या वाउचर रद्द हुआ हो।`,
  });
  return {
    title: `Loan Ledger (${head.kind})`, titleHi: `ऋण खाता-बही (${head.kind})`,
    subtitle: `${head.loanNo} · ${head.memberName}`,
    columns: [{ en: 'Date', hi: 'तिथि' }, { en: 'Particulars', hi: 'विवरण' }, { en: 'Voucher', hi: 'वाउचर' },
      { en: 'Disbursed', hi: 'ऋण दिया', num: true }, { en: 'Principal recovered', hi: 'मूल वसूली', num: true }, { en: 'Principal balance', hi: 'मूल शेष', num: true },
      { en: 'Interest charged', hi: 'ब्याज लगाया', num: true }, { en: 'Interest received', hi: 'ब्याज प्राप्त', num: true }],
    rowsEn: l.rows.map(base('en')), rowsHi: l.rows.map(base('hi')),
    totals: ['', 'Total', '', l.totals.disbursed, l.totals.principalRecovered, l.closingPrincipal, l.totals.interestCharged, l.totals.interestReceived],
    notes,
  };
}

export function stockRegisterTable(s: StockRegister, head: { itemCode: string; name: string; unit: string }): LedgerTable {
  const open: Cell[] = ['', 'Opening stock', '', null, null, s.opening, s.openingRate || null, s.openingValue || null];
  const openHi: Cell[] = ['', 'प्रारंभिक स्टॉक', '', null, null, s.opening, s.openingRate || null, s.openingValue || null];
  const base = (p: string) => (r: StockRegister['rows'][number]): Cell[] => [r.date, p === 'hi' ? r.particularsHi : r.particulars, r.reference,
    r.inward || null, r.outward || null, r.balance, r.rate || null, r.amount || null];
  return {
    title: 'Stock Register', titleHi: 'स्टॉक रजिस्टर',
    subtitle: `${head.itemCode ? `${head.itemCode} · ` : ''}${head.name} (${head.unit})`,
    columns: [{ en: 'Date', hi: 'तिथि' }, { en: 'Particulars', hi: 'विवरण' }, { en: 'Bill / Ref', hi: 'बिल / संदर्भ' },
      { en: 'Inward qty', hi: 'आवक', num: true }, { en: 'Outward qty', hi: 'जावक', num: true }, { en: 'Balance qty', hi: 'शेष मात्रा', num: true },
      { en: 'Rate', hi: 'दर', num: true }, { en: 'Amount', hi: 'राशि', num: true }],
    rowsEn: [open, ...s.rows.map(base('en'))], rowsHi: [openHi, ...s.rows.map(base('hi'))],
    // Closing rate = weighted-average cost, value = closing × that rate — the Inventory / Trading A/c figure.
    totals: ['', 'Total / Closing', '', q(s.totalIn), q(s.totalOut), s.closing, s.closingRate || null, s.closingValue || null],
    notes: s.wentNegative ? [{ en: 'The balance went below zero at some point (more issued than on hand) — closing is shown as 0, as in Inventory.', hi: 'किसी समय शेष शून्य से नीचे गया (हाथ में से ज़्यादा जावक) — अंतिम शेष Inventory की तरह 0 दिखाया गया है।' }] : [],
  };
}

/**
 * ALL items on one page (2026-10-10): the "Stock Register PDF / Excel" for every item printed one page per item —
 * 22 near-empty pages with no rate or value. This is the one-row-per-item summary (opening, in, out, closing, rate,
 * value) with a value total; each item's detailed register is still its own export. Rows come from stockRegister,
 * so every figure equals that item's register and the Inventory / Trading closing value (RULE 2).
 */
export function stockSummaryTable(items: readonly { itemCode: string; name: string; unit: string; register: StockRegister }[], unitText: (u: string) => string = (u) => u): LedgerTable {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const row = (it: (typeof items)[number]): Cell[] => [it.itemCode || '', it.name, unitText(it.unit),
    it.register.opening, it.register.openingValue || null, q(it.register.totalIn) || null, q(it.register.totalOut) || null,
    it.register.closing, it.register.closingRate || null, it.register.closingValue || null];
  const rows = items.map(row);
  const sum = (f: (r: StockRegister) => number) => r2(items.reduce((t, it) => t + f(it.register), 0));
  return {
    title: 'Stock Register (Summary)', titleHi: 'स्टॉक रजिस्टर (सार)',
    subtitle: `${items.length} items`,
    columns: [{ en: 'Code', hi: 'कोड' }, { en: 'Item', hi: 'वस्तु' }, { en: 'Unit', hi: 'इकाई' },
      { en: 'Opening qty', hi: 'प्रारंभिक मात्रा', num: true }, { en: 'Opening value', hi: 'प्रारंभिक मूल्य', num: true },
      { en: 'Inward qty', hi: 'आवक', num: true }, { en: 'Outward qty', hi: 'जावक', num: true },
      { en: 'Closing qty', hi: 'अंतिम मात्रा', num: true }, { en: 'Rate (avg cost)', hi: 'दर (औसत लागत)', num: true },
      { en: 'Closing value', hi: 'अंतिम मूल्य', num: true }],
    rowsEn: rows, rowsHi: rows,
    totals: ['', 'Total', '', null, sum((r) => r.openingValue), null, null, null, null, sum((r) => r.closingValue)],
    notes: [],
  };
}

/** Many tables → one flat sheet with a leading key column (all accounts / loans / items in one file). */
export function flattenTables(tables: readonly LedgerTable[], keyHeader: string): { headers: string[]; rows: Cell[][] } {
  if (!tables.length) return { headers: [keyHeader], rows: [] };
  const headers = [keyHeader, ...tables[0].columns.map((c) => c.en)];
  const rows: Cell[][] = [];
  for (const t of tables) {
    for (const r of t.rowsEn) rows.push([t.subtitle, ...r]);
    rows.push([t.subtitle, ...t.totals]);
  }
  return { headers, rows };
}

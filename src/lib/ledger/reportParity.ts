/**
 * Per-REPORT parity (T-09 / ADR-0001, runbook §2c). PURE.
 *
 * `ledgerParity` proves the journal reproduces the TRIAL BALANCE — it says nothing about whether a
 * cash book, member ledger or Receipts & Payments projection is faithful (a bug there moves rows, not
 * net balances, so the TB gate would happily let it through). Each of those reads therefore gets its
 * OWN gate: project the report from the journal, compare it ROW-BY-ROW with the report computed from
 * the vouchers, and serve the ledger one only on an exact match. On any diff the caller falls back to
 * the voucher compute — so a flipped tenant can never be shown a number that the vouchers don't agree
 * with, and the diffs are what the ops parity check reports.
 *
 * Money is compared with a half-paisa epsilon: both sides accumulate in exact minor units and convert
 * to rupees at the last step, so an equal report is bit-equal — the epsilon only guards float display.
 */
import type { BankBookEntry, CashBookEntry, MemberLedgerEntry, ReceiptsPaymentsData, ReceiptsPaymentsItem } from '@/types';

/** One field that differs between the journal-projected report and the voucher-computed one. */
export interface ReportDiff {
  /** where it differs — e.g. `row[3].runningBalance`, `receipts[1102].amount`, `closingCash`. */
  field: string;
  ledger: string | number;
  vouchers: string | number;
}

export interface ReportParityResult {
  matches: boolean;
  diffs: ReportDiff[];
}

/** One line of the pre-flight: does the journal reproduce this report for the current tenant? */
export interface LedgerParityReport {
  /** 'trialBalance' | 'cashBook' | 'bankBook:<id>' | 'memberLedger' | 'receiptsPayments' */
  report: string;
  matches: boolean;
  /** human context — e.g. '3 of 120 members differ', '412 accounts checked'. */
  detail?: string;
  diffs: ReportDiff[];
}

/** The T-09 pre-flight for one tenant: every read that has a ledger path, checked against the
 *  vouchers. A tenant is only safe to flip (`ledgerReadsEnabled`) once `allMatch` is true. */
export interface LedgerParitySnapshot {
  journalEvents: number;
  /** is this tenant already flipped? (the reads below are then served FROM the journal) */
  cutOver: boolean;
  reports: LedgerParityReport[];
  allMatch: boolean;
}

/** Half a paisa — below any real difference, above float-display noise. */
const EPS = 0.005;
/** Diffs are a diagnostic, not a dump: enough to identify the break, cheap on a hot read path. */
const MAX_DIFFS = 10;

const sameMoney = (a: number, b: number) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < EPS;

/** Collects diffs and short-circuits once MAX_DIFFS is reached. */
class DiffBag {
  readonly diffs: ReportDiff[] = [];
  get full() { return this.diffs.length >= MAX_DIFFS; }
  text(field: string, ledger: string, vouchers: string) {
    if (!this.full && (ledger ?? '') !== (vouchers ?? '')) this.diffs.push({ field, ledger, vouchers });
  }
  money(field: string, ledger: number, vouchers: number) {
    if (!this.full && !sameMoney(ledger, vouchers)) this.diffs.push({ field, ledger, vouchers });
  }
  result(): ReportParityResult { return { matches: this.diffs.length === 0, diffs: this.diffs }; }
}

/** The row shape shared by the cash and bank books (only `type`'s vocabulary differs). */
type BookRow = { id: string; date: string; voucherNo: string; particulars: string; type: string; amount: number; runningBalance: number };

function bookParity(ledger: readonly BookRow[], vouchers: readonly BookRow[], label: string): ReportParityResult {
  const bag = new DiffBag();
  if (ledger.length !== vouchers.length) bag.text(`${label}.rowCount`, String(ledger.length), String(vouchers.length));
  const n = Math.min(ledger.length, vouchers.length);
  for (let i = 0; i < n && !bag.full; i++) {
    const l = ledger[i], v = vouchers[i];
    bag.text(`${label}[${i}].id`, l.id, v.id);
    bag.text(`${label}[${i}].date`, l.date, v.date);
    bag.text(`${label}[${i}].voucherNo`, l.voucherNo, v.voucherNo);
    bag.text(`${label}[${i}].particulars`, l.particulars, v.particulars);
    bag.text(`${label}[${i}].type`, l.type, v.type);
    bag.money(`${label}[${i}].amount`, l.amount, v.amount);
    bag.money(`${label}[${i}].runningBalance`, l.runningBalance, v.runningBalance);
  }
  return bag.result();
}

/** PURE — does the journal's Cash Book equal the voucher-computed one, row for row? */
export function cashBookParity(ledger: readonly CashBookEntry[], vouchers: readonly CashBookEntry[]): ReportParityResult {
  return bookParity(ledger, vouchers, 'cashBook');
}

/** PURE — does the journal's Bank Book equal the voucher-computed one, row for row? */
export function bankBookParity(ledger: readonly BankBookEntry[], vouchers: readonly BankBookEntry[]): ReportParityResult {
  return bookParity(ledger, vouchers, 'bankBook');
}

/** PURE — does the journal's member share-capital ledger equal the voucher-computed one? */
export function memberLedgerParity(ledger: readonly MemberLedgerEntry[], vouchers: readonly MemberLedgerEntry[]): ReportParityResult {
  const bag = new DiffBag();
  if (ledger.length !== vouchers.length) bag.text('memberLedger.rowCount', String(ledger.length), String(vouchers.length));
  const n = Math.min(ledger.length, vouchers.length);
  for (let i = 0; i < n && !bag.full; i++) {
    const l = ledger[i], v = vouchers[i];
    bag.text(`memberLedger[${i}].id`, l.id, v.id);
    bag.text(`memberLedger[${i}].date`, l.date, v.date);
    bag.text(`memberLedger[${i}].voucherNo`, l.voucherNo, v.voucherNo);
    bag.text(`memberLedger[${i}].particulars`, l.particulars, v.particulars);
    bag.money(`memberLedger[${i}].credit`, l.credit, v.credit);
    bag.money(`memberLedger[${i}].debit`, l.debit, v.debit);
    bag.money(`memberLedger[${i}].balance`, l.balance, v.balance);
  }
  return bag.result();
}

/** R&P line items are an unordered set keyed by account — compare as maps, not as arrays. */
function itemsParity(bag: DiffBag, side: 'receipts' | 'payments', ledger: readonly ReceiptsPaymentsItem[], vouchers: readonly ReceiptsPaymentsItem[]) {
  const byId = (items: readonly ReceiptsPaymentsItem[]) => new Map(items.map((i) => [i.accountId, i]));
  const L = byId(ledger), V = byId(vouchers);
  for (const id of new Set([...L.keys(), ...V.keys()])) {
    if (bag.full) return;
    const l = L.get(id), v = V.get(id);
    if (!l || !v) { bag.text(`${side}[${id}]`, l ? 'present' : 'missing', v ? 'present' : 'missing'); continue; }
    bag.money(`${side}[${id}].amount`, l.amount, v.amount);
    bag.text(`${side}[${id}].nature`, l.nature, v.nature);
    bag.text(`${side}[${id}].glType`, l.glType ?? '', v.glType ?? '');
    bag.text(`${side}[${id}].accountName`, l.accountName, v.accountName);
  }
}

/** PURE — does the journal's Receipts & Payments account equal the voucher-computed one? Opening and
 *  closing cash/bank plus every receipt and payment line, keyed by account. */
export function receiptsPaymentsParity(ledger: ReceiptsPaymentsData, vouchers: ReceiptsPaymentsData): ReportParityResult {
  const bag = new DiffBag();
  bag.money('openingCash', ledger.openingCash, vouchers.openingCash);
  bag.money('openingBank', ledger.openingBank, vouchers.openingBank);
  bag.money('closingCash', ledger.closingCash, vouchers.closingCash);
  bag.money('closingBank', ledger.closingBank, vouchers.closingBank);
  itemsParity(bag, 'receipts', ledger.receipts, vouchers.receipts);
  itemsParity(bag, 'payments', ledger.payments, vouchers.payments);
  return bag.result();
}

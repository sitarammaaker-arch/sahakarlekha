/**
 * Housing — member maintenance statement (PURE). Builds a chronological demand/receipt ledger
 * with a running outstanding balance from a member's bills and the collection vouchers linked to
 * them (refType 'maintenance.receipt', refId = bill.id). NO React / Supabase / side effects.
 *
 * The result ties to the member's receivable sub-ledger: demands Dr it, receipts Cr it, so
 * `outstanding` === Σ(bill.amount − bill.paidAmount) === the account balance (L2 formula parity).
 */
import type { MaintenanceBill, Voucher } from '@/types';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface StatementRow {
  date: string;
  kind: 'demand' | 'receipt';
  ref: string;            // billNo (demand) or voucherNo (receipt)
  particulars: string;
  debit: number;          // demand raised
  credit: number;         // receipt collected
  balance: number;        // running outstanding after this row
  billId?: string;
}

export interface MemberStatement {
  rows: StatementRow[];
  totalDemanded: number;
  totalReceived: number;
  outstanding: number;
}

/**
 * @param bills    the member's own (already-filtered) maintenance bills
 * @param vouchers all vouchers (receipts are matched to these bills by refType + refId)
 */
export function buildMemberStatement(bills: MaintenanceBill[], vouchers: Voucher[]): MemberStatement {
  const activeBills = bills.filter(b => !b.isDeleted);
  const billIds = new Set(activeBills.map(b => b.id));

  const raw: Omit<StatementRow, 'balance'>[] = [];
  for (const b of activeBills) {
    raw.push({ date: b.date, kind: 'demand', ref: b.billNo, particulars: `Maintenance ${b.period}${b.flatNo ? ` · ${b.flatNo}` : ''}`, debit: round2(b.amount), credit: 0, billId: b.id });
  }
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    if (v.refType !== 'maintenance.receipt' || !v.refId || !billIds.has(v.refId)) continue;
    raw.push({ date: v.date, kind: 'receipt', ref: v.voucherNo, particulars: v.narration || 'Receipt', debit: 0, credit: round2(v.amount), billId: v.refId });
  }
  // Chronological; a same-day demand is shown before its receipt.
  raw.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'demand' ? -1 : 1));

  let bal = 0;
  const rows: StatementRow[] = raw.map(r => { bal = round2(bal + r.debit - r.credit); return { ...r, balance: bal }; });
  const totalDemanded = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalReceived = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, totalDemanded, totalReceived, outstanding: round2(totalDemanded - totalReceived) };
}

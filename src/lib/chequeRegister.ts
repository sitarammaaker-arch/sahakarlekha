// Cheque Issue / Cheque Collection registers — HAFED Accounts Manual 1976, paras 4.6–4.8, Proformas IV/1 and IV/2.
// Drawn from the vouchers themselves: a voucher with a cheque / DD no. (migration 205) that credits a bank ledger is
// an ISSUED cheque, one that debits a bank ledger is a RECEIVED one. The party is the voucher's other side, the bank
// is its bank ledger, and the date of realisation is the bank-reconciliation clearedDate. Nothing is stored twice.
//
// Pure: no React, no Supabase.
import type { LedgerAccount, Voucher } from '@/types';
import { voucherPostings } from '@/lib/godownShortage';

export interface ChequeRow {
  serial: number;
  voucherId: string;
  voucherNo: string;
  date: string;            // voucher date (issued / received)
  chequeNo: string;
  chequeDate?: string;
  party: string;           // drawn in favour of / received from
  bankAccountId: string;
  bankName: string;        // bank the cheque was drawn on / deposited in (the society's bank ledger)
  amount: number;
  cleared: boolean;
  clearedDate?: string;    // presented / realised (bank reconciliation)
  daysPending?: number;    // not cleared: days since the voucher date (as at `today`)
}

export interface ChequeRegister {
  issued: ChequeRow[];
  received: ChequeRow[];
  totals: {
    issued: { count: number; amount: number; pendingCount: number; pendingAmount: number };
    received: { count: number; amount: number; pendingCount: number; pendingAmount: number };
  };
  /** Bank vouchers in the period with no cheque no. (paid / received by bank without one being entered). */
  bankVouchersWithoutCheque: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A voucher that is in the books: not cancelled, not waiting for or refused approval. */
const inBooks = (v: Voucher) => !v.isDeleted && v.approvalStatus !== 'pending' && v.approvalStatus !== 'rejected';

export function buildChequeRegister(input: {
  vouchers: readonly Voucher[];
  accounts: readonly LedgerAccount[];
  bankIds: readonly string[];
  from?: string;
  to?: string;
  bankId?: string;     // only this bank ledger
  today: string;
  hi?: boolean;
}): ChequeRegister {
  const { from, to, hi } = input;
  const banks = new Set(input.bankIds);
  const name = (id: string) => { const a = input.accounts.find(x => x.id === id); return a ? (hi && a.nameHi ? a.nameHi : a.name) : id; };
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const t = Date.parse(input.today);
  const issued: Omit<ChequeRow, 'serial'>[] = [];
  const received: Omit<ChequeRow, 'serial'>[] = [];
  let withoutCheque = 0;

  for (const v of input.vouchers) {
    if (!inBooks(v) || !inRange(v.date)) continue;
    const legs = voucherPostings(v);
    const bankLegs = legs.filter(l => banks.has(l.accountId) && (!input.bankId || l.accountId === input.bankId));
    if (!bankLegs.length) continue;
    const no = (v.chequeNo || '').trim();
    if (!no) { withoutCheque++; continue; }
    // One row per bank ledger and direction on the voucher (a bank-to-bank transfer appears in both registers).
    const byBank = new Map<string, { dr: number; cr: number }>();
    for (const l of bankLegs) {
      const b = byBank.get(l.accountId) ?? { dr: 0, cr: 0 };
      b.dr += l.dr; b.cr += l.cr;
      byBank.set(l.accountId, b);
    }
    for (const [bankAccountId, b] of byBank) {
      for (const side of ['cr', 'dr'] as const) {
        const amt = r2(side === 'cr' ? b.cr - Math.min(b.cr, b.dr) : b.dr - Math.min(b.cr, b.dr));
        if (!(amt > 0)) continue;
        // The party: the other side of this leg — non-bank accounts first, else the other bank.
        const opposite = legs.filter(l => (side === 'cr' ? l.dr > 0 : l.cr > 0) && l.accountId !== bankAccountId);
        const nonBank = opposite.filter(l => !banks.has(l.accountId));
        const partyIds = [...new Set((nonBank.length ? nonBank : opposite).map(l => l.accountId))];
        const row: Omit<ChequeRow, 'serial'> = {
          voucherId: v.id, voucherNo: v.voucherNo, date: v.date, chequeNo: no, chequeDate: v.chequeDate || undefined,
          party: partyIds.map(name).join(', ') || '—', bankAccountId, bankName: name(bankAccountId), amount: amt,
          cleared: !!v.isCleared, clearedDate: v.isCleared ? (v.clearedDate || undefined) : undefined,
          daysPending: v.isCleared ? undefined : Math.max(0, Math.floor((t - Date.parse(v.date)) / 86_400_000)),
        };
        (side === 'cr' ? issued : received).push(row);
      }
    }
  }

  const finish = (rows: Omit<ChequeRow, 'serial'>[]): ChequeRow[] =>
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo) || a.chequeNo.localeCompare(b.chequeNo))
      .map((r, i) => ({ ...r, serial: i + 1 }));
  const tot = (rows: ChequeRow[]) => ({
    count: rows.length,
    amount: r2(rows.reduce((s, r) => s + r.amount, 0)),
    pendingCount: rows.filter(r => !r.cleared).length,
    pendingAmount: r2(rows.filter(r => !r.cleared).reduce((s, r) => s + r.amount, 0)),
  });
  const iss = finish(issued);
  const rec = finish(received);
  return { issued: iss, received: rec, totals: { issued: tot(iss), received: tot(rec) }, bankVouchersWithoutCheque: withoutCheque };
}

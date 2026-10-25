/**
 * Marketing E2 — Kachi Aarat (commission agent in the mandi) ↔ ledger reconciliation. PURE.
 *
 * The Kachi Aarat register records each mandi transaction and the dami (commission) earned, but it
 * posts nothing — the dami reaches the books through the society's own vouchers to its dami income
 * ledger (4201 in the marketing chart). The two can drift. This compares, for one financial year, the
 * register's dami with the net credit on the dami ledger and shows the difference — it does NOT post.
 * Tested by scripts/test-marketing.mjs.
 */
import { toMinor, toRupees, addMinor, subMinor } from '@/lib/money';
import { getVoucherLines } from '@/lib/voucherUtils';
import type { Voucher } from '@/types';

/** The dami income ledger: template id 4201 when it is a non-group income ledger, else one named "dami". */
export function damiLedgerId(accounts: ReadonlyArray<{ id: string; name: string; nameHi?: string; type: string; isGroup?: boolean }>): string | null {
  const byId = accounts.find(a => a.id === '4201' && !a.isGroup && a.type === 'income');
  if (byId) return byId.id;
  return accounts.find(a => !a.isGroup && a.type === 'income' && /dami|दामी/i.test(`${a.name} ${a.nameHi || ''}`))?.id ?? null;
}

/** Last day of the financial year that starts on `fyStart` (YYYY-MM-DD). */
export function fyEndOf(fyStart: string): string {
  const [y, m, d] = fyStart.split('-').map(Number);
  const end = new Date(Date.UTC(y + 1, m - 1, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

export interface DamiReconciliation { register: number; ledger: number; difference: number }

/**
 * Register dami (live entries of that FY) vs the dami ledger's net CREDIT on live vouchers dated within
 * the FY. difference = register − ledger (positive: dami recorded in the register but not yet booked).
 */
export function reconcileDami(
  entries: ReadonlyArray<{ fyStartDate: string; damiEarned?: number; isDeleted?: boolean }>,
  vouchers: ReadonlyArray<Voucher>,
  ledgerId: string | null,
  fyStart: string,
): DamiReconciliation {
  const register = toRupees(entries.filter(e => !e.isDeleted && e.fyStartDate === fyStart).reduce((m, e) => addMinor(m, toMinor(Number(e.damiEarned) || 0)), 0));
  let ledgerMinor = 0;
  if (ledgerId) {
    const end = fyEndOf(fyStart);
    for (const v of vouchers) {
      if (v.isDeleted || v.approvalStatus === 'rejected' || !v.date || v.date < fyStart || v.date > end) continue;
      for (const l of getVoucherLines(v)) if (l.accountId === ledgerId) ledgerMinor = addMinor(ledgerMinor, l.type === 'Cr' ? toMinor(Number(l.amount) || 0) : -toMinor(Number(l.amount) || 0));
    }
  }
  const ledger = toRupees(ledgerMinor);
  return { register, ledger, difference: toRupees(subMinor(toMinor(register), ledgerMinor)) };
}

/**
 * Voucher rebuild engine (journal-first-write slice 2 — T-09 acceptance).
 *
 * PURE. Reconstructs the current-effective `vouchers`-table rows from the event journal alone —
 * proving the table is a DERIVABLE PROJECTION of the journal, not the authoritative store. This is
 * the prerequisite for the write inversion (slice 3): once the table can be rebuilt from the
 * journal, a table-write failure becomes recoverable (the journal is the truth), so the RULE-1
 * optimistic-rollback on the voucher path can retire (the acceptance).
 *
 * Uses the ONE resolution formula (resolveCurrentVouchers, RULE 2): skips cancelled aggregates,
 * takes the latest reposted (edited) event else the posted one, and reads the full row from the
 * enriched payload (slice 1 added branchId + createdBy, so the row is complete). Legs (integer
 * paise, T-02) map back to VoucherLine rupees; the legacy single Dr/Cr fields are the first Dr / Cr
 * leg. Deterministic line ids (`<voucherId>-L<i>`) — no crypto, so the rebuild is reproducible.
 *
 * NOT wired into any live path (dormant): the write inversion + per-tenant flip are later slices,
 * gated behind the T-09 soak (R3).
 */
import { toRupees } from '../money';
import type { LedgerEvent } from './event';
import { resolveCurrentVouchers, type CurrentVoucher } from './aggregateState';
import type { Voucher, VoucherLine, VoucherType } from '@/types';

const VOUCHER_TYPES: readonly VoucherType[] = ['receipt', 'payment', 'journal', 'contra', 'purchase', 'sale', 'debit_note', 'credit_note'];
const asType = (t: string): VoucherType => (VOUCHER_TYPES as readonly string[]).includes(t) ? (t as VoucherType) : 'journal';

/** PURE — one reconstructed Voucher row from a resolved current-voucher. */
export function voucherFromCurrent(cv: CurrentVoucher): Voucher {
  const lines: VoucherLine[] = cv.legs.map((l, i) => ({
    id: `${cv.id}-L${i}`,
    accountId: l.accountId,
    type: l.drCr,
    amount: toRupees(l.amountMinor),
  }));
  const firstDr = cv.legs.find((l) => l.drCr === 'Dr');
  const firstCr = cv.legs.find((l) => l.drCr === 'Cr');
  const v: Voucher = {
    id: cv.id,
    voucherNo: cv.voucherNo,
    type: asType(cv.type),
    date: cv.date,
    debitAccountId: firstDr?.accountId ?? '',
    creditAccountId: firstCr?.accountId ?? '',
    amount: cv.amount,
    narration: cv.narration,
    createdAt: cv.createdAt,
    createdBy: cv.createdBy,
    ...(lines.length ? { lines } : {}),
    ...(cv.memberId ? { memberId: cv.memberId } : {}),
    ...(cv.branchId ? { branchId: cv.branchId } : {}),   // '' = Head Office / unbranched
  };
  return v;
}

/**
 * PURE — reconstruct every current-effective voucher row from the journal. Cancelled aggregates are
 * absent (they net to nothing and carry no live row), edited ones reflect their latest legs. The
 * result is the set of `vouchers`-table rows the journal implies — for the rebuild/reconcile that
 * makes the table a best-effort projection.
 */
export function vouchersFromJournal(events: readonly LedgerEvent[]): Voucher[] {
  return resolveCurrentVouchers(events).map(voucherFromCurrent);
}

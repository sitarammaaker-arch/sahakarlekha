/**
 * H / RULE 3 — a voucher that a module document owns (a dairy settlement, a maintenance bill, a worker
 * advance, …) must be cancelled THROUGH that document, never alone from the voucher screen: cancelling
 * only the voucher left the document live (in its register, in its balances) while the ledger dropped
 * it — found in prod for returns and share transfers. Each domain context registers an owner check
 * with DataContext; cancelVoucher consults them unless the module itself asks (viaParent).
 *
 * A voucher whose document is already gone (an orphan) is NOT owned, so it stays cancellable for
 * cleanup. PURE — no React, no Supabase.
 */

export interface OwnerGroup {
  /** Hindi label shown to the user, e.g. 'दूध भुगतान (Settlement)'. */
  label: string;
  docs: readonly unknown[];
}

const LINK_KEY = /voucherid$/i;
const LINK_LIST_KEY = /voucherids$/i;

function isLive(doc: Record<string, unknown>): boolean {
  if (doc.isDeleted === true) return false;
  const status = typeof doc.status === 'string' ? doc.status.toLowerCase() : '';
  return status !== 'cancelled' && status !== 'deleted';
}

/** True when this document links to the voucher through any `…VoucherId` / `…VoucherIds` field. */
export function docLinksVoucher(doc: unknown, voucherId: string): boolean {
  if (!doc || typeof doc !== 'object' || !voucherId) return false;
  for (const [k, v] of Object.entries(doc as Record<string, unknown>)) {
    if (LINK_KEY.test(k) && v === voucherId) return true;
    if (LINK_LIST_KEY.test(k) && Array.isArray(v) && v.includes(voucherId)) return true;
  }
  return false;
}

/** The label of the first group holding a LIVE document that links to the voucher, or null. */
export function findVoucherOwner(groups: readonly OwnerGroup[], voucherId: string): string | null {
  for (const g of groups) {
    for (const d of g.docs) {
      if (d && typeof d === 'object' && isLive(d as Record<string, unknown>) && docLinksVoucher(d, voucherId)) return g.label;
    }
  }
  return null;
}

export type VoucherOwnerCheck = (voucherId: string) => string | null;

/**
 * Cash / bank bills of a party — for the party's ledger statement (founder 2026-10-09, option 1).
 *
 * A sale paid in cash or by bank posts Dr Cash/Bank / Cr Sales (a purchase: Dr Purchases / Cr Cash/Bank) —
 * the party's own ledger is never touched, which is correct double entry (and Tally's default). So the
 * customer's statement did not show the bill at all. These bills are listed BELOW the statement as a
 * memo: they do not change the party's balance. PURE.
 */
export interface DirectBill {
  id: string;
  kind: 'sale' | 'purchase';
  no: string;
  date: string;
  amount: number;
  mode: 'cash' | 'bank';
}

interface PartyLike { id: string; accountId?: string }
interface SaleLike { id: string; saleNo: string; date: string; grandTotal: number; paymentMode: string; customerId?: string; isDeleted?: boolean; branchId?: string }
interface PurchaseLike { id: string; purchaseNo: string; date: string; grandTotal: number; paymentMode: string; supplierId?: string; isDeleted?: boolean; branchId?: string }

export function directBillsForAccount(
  accountId: string,
  data: { customers: PartyLike[]; suppliers: PartyLike[]; sales: SaleLike[]; purchases: PurchaseLike[] },
  opts: { from?: string; to?: string; inScope?: (branchId?: string) => boolean } = {},
): DirectBill[] {
  if (!accountId) return [];
  const inRange = (d: string) => (!opts.from || d >= opts.from) && (!opts.to || d <= opts.to);
  const scope = opts.inScope ?? (() => true);
  const custIds = new Set(data.customers.filter((c) => c.accountId === accountId).map((c) => c.id));
  const supIds = new Set(data.suppliers.filter((s) => s.accountId === accountId).map((s) => s.id));
  const out: DirectBill[] = [];
  for (const s of data.sales) {
    if (s.isDeleted || !s.customerId || !custIds.has(s.customerId) || s.paymentMode === 'credit') continue;
    if (!inRange(s.date) || !scope(s.branchId)) continue;
    out.push({ id: s.id, kind: 'sale', no: s.saleNo, date: s.date, amount: Number(s.grandTotal) || 0, mode: s.paymentMode === 'bank' ? 'bank' : 'cash' });
  }
  for (const p of data.purchases) {
    if (p.isDeleted || !p.supplierId || !supIds.has(p.supplierId) || p.paymentMode === 'credit') continue;
    if (!inRange(p.date) || !scope(p.branchId)) continue;
    out.push({ id: p.id, kind: 'purchase', no: p.purchaseNo, date: p.date, amount: Number(p.grandTotal) || 0, mode: p.paymentMode === 'bank' ? 'bank' : 'cash' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no, undefined, { numeric: true }));
}

/** Cash already received from this customer on `date` (for the s.186 same-day test), excluding `exceptSaleId`. */
export function sameDayCashFromCustomer(sales: SaleLike[], customerId: string | undefined, date: string, exceptSaleId?: string): number {
  if (!customerId) return 0;
  return sales
    .filter((s) => !s.isDeleted && s.customerId === customerId && s.date === date && s.paymentMode === 'cash' && s.id !== exceptSaleId)
    .reduce((t, s) => t + (Number(s.grandTotal) || 0), 0);
}

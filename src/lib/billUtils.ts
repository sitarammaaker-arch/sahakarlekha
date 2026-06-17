import type { Sale, Voucher } from '@/types';

/**
 * Bill-wise settlement helpers (Tally-style "Against Reference").
 *
 * A credit sale (paymentMode === 'credit') creates a receivable on the customer.
 * A bill-receipt voucher carries `billAllocations` — how much of that receipt is
 * applied to each sale bill. Every bill's "received" amount is DERIVED by summing
 * allocations across all ACTIVE (non-deleted) vouchers — so there is ONE source of
 * truth (RULE 2/5): deleting or editing a receipt automatically updates bill
 * balances, no separate stored field can drift.
 */

/** itemId(saleId) -> total amount received against that bill (active receipts only). */
export function getBillReceivedMap(vouchers: Voucher[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const v of vouchers) {
    if (v.isDeleted || !v.billAllocations) continue;
    for (const a of v.billAllocations) {
      map[a.saleId] = (map[a.saleId] || 0) + (a.amount || 0);
    }
  }
  return map;
}

export interface BillStatus {
  total: number;
  received: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid';
}

/** Settlement status of a single credit bill, given how much has been received. */
export function getBillStatus(sale: Sale, received: number): BillStatus {
  const total = sale.grandTotal ?? sale.netAmount ?? 0;
  const rec = Math.min(Math.max(received, 0), total);
  const balance = +(total - rec).toFixed(2);
  const status: BillStatus['status'] =
    received <= 0.01 ? 'unpaid' : (balance <= 0.01 ? 'paid' : 'partial');
  return { total, received: rec, balance, status };
}

/** Whether a sale is a credit "bill" that can be settled (vs a cash/bank sale). */
export function isCreditBill(sale: Sale): boolean {
  return sale.paymentMode === 'credit';
}

/** Open (outstanding) bills for a customer — credit sales with balance > 0, oldest first. */
export function getOpenBills(
  sales: Sale[],
  vouchers: Voucher[],
  customerId: string,
): { sale: Sale; balance: number }[] {
  const rec = getBillReceivedMap(vouchers);
  return sales
    .filter(s => s.customerId === customerId && isCreditBill(s))
    .map(s => ({ sale: s, balance: getBillStatus(s, rec[s.id] || 0).balance }))
    .filter(x => x.balance > 0.01)
    .sort((a, b) => (a.sale.date || '').localeCompare(b.sale.date || ''));
}

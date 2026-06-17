import type { Sale, Purchase, Voucher, BillAllocation, BillMethod } from '@/types';

/**
 * Bill-wise settlement helpers (Tally-style "Bill-wise Details").
 *
 * A credit sale (paymentMode === 'credit') creates a receivable on the customer; a
 * credit purchase creates a payable on the supplier. A bill-receipt / bill-payment
 * voucher carries `billAllocations` — how much of that money is applied to each bill
 * (method 'against'), or held unallocated (method 'advance' / 'on-account').
 *
 * Every bill's settled amount is DERIVED by summing 'against' allocations across all
 * ACTIVE (non-deleted) vouchers — ONE source of truth (RULE 2/5): deleting or editing a
 * receipt/payment automatically updates bill balances; no stored field can drift.
 */

// ── Allocation field accessors (back-compat: legacy receipts used saleId/saleNo) ──
export function allocBillId(a: BillAllocation): string | undefined {
  return a.billId ?? a.saleId;
}
export function allocBillNo(a: BillAllocation): string {
  return a.billNo ?? a.saleNo ?? '';
}
export function allocMethod(a: BillAllocation): BillMethod {
  return a.method ?? 'against';
}

/** billId → total amount settled against that bill ('against' allocations, active vouchers). */
export function getBillSettledMap(vouchers: Voucher[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const v of vouchers) {
    if (v.isDeleted || !v.billAllocations) continue;
    for (const a of v.billAllocations) {
      if (allocMethod(a) !== 'against') continue;
      const id = allocBillId(a);
      if (!id) continue;
      map[id] = (map[id] || 0) + (a.amount || 0);
    }
  }
  return map;
}
/** Back-compat alias (sales side already imports this name). */
export const getBillReceivedMap = getBillSettledMap;

export interface BillStatus {
  total: number;
  received: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid';
}

/** Settlement status given a bill total and how much has been settled. */
export function getBillStatusFor(total: number, settled: number): BillStatus {
  const rec = Math.min(Math.max(settled, 0), total);
  const balance = +(total - rec).toFixed(2);
  const status: BillStatus['status'] =
    settled <= 0.01 ? 'unpaid' : (balance <= 0.01 ? 'paid' : 'partial');
  return { total, received: rec, balance, status };
}

/** Sale-based wrapper (back-compat: SaleRegister + ReceivePayment call getBillStatus(sale, received)). */
export function getBillStatus(sale: Sale, received: number): BillStatus {
  return getBillStatusFor(sale.grandTotal ?? sale.netAmount ?? 0, received);
}

export function isCreditBill(sale: Sale): boolean {
  return sale.paymentMode === 'credit';
}
export function isCreditPurchase(p: Purchase): boolean {
  return p.paymentMode === 'credit';
}

/** Open (outstanding) sale bills for a customer — credit sales with balance > 0, oldest first. */
export function getOpenBills(
  sales: Sale[],
  vouchers: Voucher[],
  customerId: string,
): { sale: Sale; balance: number }[] {
  const settled = getBillSettledMap(vouchers);
  return sales
    .filter(s => s.customerId === customerId && isCreditBill(s))
    .map(s => ({ sale: s, balance: getBillStatus(s, settled[s.id] || 0).balance }))
    .filter(x => x.balance > 0.01)
    .sort((a, b) => (a.sale.date || '').localeCompare(b.sale.date || ''));
}

/** Open (outstanding) purchase bills for a supplier — credit purchases with balance > 0, oldest first. */
export function getOpenPurchaseBills(
  purchases: Purchase[],
  vouchers: Voucher[],
  supplierId: string,
): { purchase: Purchase; balance: number }[] {
  const settled = getBillSettledMap(vouchers);
  return purchases
    .filter(p => p.supplierId === supplierId && isCreditPurchase(p))
    .map(p => ({ purchase: p, balance: getBillStatusFor(p.grandTotal ?? p.netAmount ?? 0, settled[p.id] || 0).balance }))
    .filter(x => x.balance > 0.01)
    .sort((a, b) => (a.purchase.date || '').localeCompare(b.purchase.date || ''));
}

/**
 * Unallocated advance / on-account credit a party holds — sum of 'advance'+'on-account'
 * allocations on active vouchers tagged to that party.
 */
export function getPartyUnallocated(
  vouchers: Voucher[],
  refType: 'bill-receipt' | 'bill-payment',
  partyId: string,
): number {
  let sum = 0;
  for (const v of vouchers) {
    if (v.isDeleted || v.refType !== refType || v.refId !== partyId || !v.billAllocations) continue;
    for (const a of v.billAllocations) {
      const m = allocMethod(a);
      if (m === 'advance' || m === 'on-account') sum += a.amount || 0;
    }
  }
  return +sum.toFixed(2);
}

// ── Ageing analysis (Bills Outstanding by age) ──────────────────────────────────
export interface AgeBuckets {
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90plus: number;
  total: number;
}

/** Age a list of open items (by bill date) into standard buckets as of a given date. */
export function bucketByAge(items: { date: string; balance: number }[], asOf: string): AgeBuckets {
  const b: AgeBuckets = { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0 };
  const asOfMs = new Date((asOf || '1970-01-01') + 'T00:00:00').getTime();
  for (const it of items) {
    const dms = new Date((it.date || asOf) + 'T00:00:00').getTime();
    const days = Math.floor((asOfMs - dms) / 86400000);
    if (days <= 30) b.b0_30 += it.balance;
    else if (days <= 60) b.b31_60 += it.balance;
    else if (days <= 90) b.b61_90 += it.balance;
    else b.b90plus += it.balance;
    b.total += it.balance;
  }
  return b;
}

/** Days a bill has been outstanding as of a given date (for the ageing report). */
export function ageInDays(billDate: string, asOf: string): number {
  const asOfMs = new Date((asOf || '1970-01-01') + 'T00:00:00').getTime();
  const dms = new Date((billDate || asOf) + 'T00:00:00').getTime();
  return Math.max(0, Math.floor((asOfMs - dms) / 86400000));
}

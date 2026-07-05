/**
 * Consumer C-PO — purchase-order helpers (pure, tested). PO/GRN are tracking documents;
 * on goods receipt the received lines become a real Purchase (invoice) via addPurchase.
 */
import type { PurchaseOrderItem, PurchaseItem } from '@/types';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Line amount from qty × rate (rounded). */
export const lineAmount = (qty: number, rate: number): number => round2((qty || 0) * (rate || 0));

/** Ordered total of a PO = Σ item.amount. */
export const poTotal = (items: ReadonlyArray<PurchaseOrderItem>): number =>
  round2(items.reduce((s, i) => s + (i.amount || 0), 0));

/** Received total (uses receivedQty, falling back to ordered qty) × rate. */
export const poReceivedTotal = (items: ReadonlyArray<PurchaseOrderItem>): number =>
  round2(items.reduce((s, i) => s + lineAmount(i.receivedQty ?? i.qty, i.rate), 0));

/**
 * Convert a PO's lines to Purchase (invoice) lines at goods receipt — one line per item
 * with receivedQty > 0, valued at the PO rate. Skips zero-received lines.
 */
export function poToPurchaseItems(items: ReadonlyArray<PurchaseOrderItem>): PurchaseItem[] {
  return items
    .map(i => {
      const qty = i.receivedQty ?? i.qty;
      return { itemId: i.itemId, itemName: i.itemName, unit: i.unit, qty, rate: i.rate, amount: lineAmount(qty, i.rate) };
    })
    .filter(i => i.qty > 0);
}

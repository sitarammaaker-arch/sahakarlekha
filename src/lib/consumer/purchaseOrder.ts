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

/**
 * ECR-21 Phase 2 — Purchase (invoice) lines valued at the SUPPLIER'S BILLED rate
 * (per item, defaulting to the PO rate). Qty = receivedQty; zero-received dropped.
 * This lets the invoice differ from the PO so the 3-way match sees a real price variance.
 */
export function poToBilledItems(
  items: ReadonlyArray<PurchaseOrderItem>,
  billedRate?: Record<string, number>,
): PurchaseItem[] {
  return items
    .map(i => {
      const qty = i.receivedQty ?? i.qty;
      const rate = billedRate?.[i.itemId] ?? i.rate;
      return { itemId: i.itemId, itemName: i.itemName, unit: i.unit, qty, rate, amount: lineAmount(qty, rate) };
    })
    .filter(i => i.qty > 0);
}

export interface GrnInvoice {
  items: PurchaseItem[];
  netAmount: number;
  cgstPct: number; sgstPct: number; igstPct: number;
  cgstAmount: number; sgstAmount: number; igstAmount: number;
  taxAmount: number;
  grandTotal: number;
}

/**
 * ECR-21 Phase 2 — the supplier-invoice figures for a goods receipt: lines at the
 * billed rate + a GST split. Intra-state → CGST + SGST (each gstPct/2); inter-state
 * → IGST (full gstPct). GST is charged on the billed net amount.
 */
export function buildGrnInvoice(
  items: ReadonlyArray<PurchaseOrderItem>,
  opts: { billedRate?: Record<string, number>; gstPct?: number; interState?: boolean } = {},
): GrnInvoice {
  const invoiceItems = poToBilledItems(items, opts.billedRate);
  const netAmount = round2(invoiceItems.reduce((s, i) => s + i.amount, 0));
  const gst = Math.max(0, opts.gstPct ?? 0);
  const interState = !!opts.interState;
  const cgstPct = interState ? 0 : round2(gst / 2);
  const sgstPct = interState ? 0 : round2(gst / 2);
  const igstPct = interState ? gst : 0;
  const cgstAmount = round2(netAmount * cgstPct / 100);
  const sgstAmount = round2(netAmount * sgstPct / 100);
  const igstAmount = round2(netAmount * igstPct / 100);
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const grandTotal = round2(netAmount + taxAmount);
  return { items: invoiceItems, netAmount, cgstPct, sgstPct, igstPct, cgstAmount, sgstAmount, igstAmount, taxAmount, grandTotal };
}

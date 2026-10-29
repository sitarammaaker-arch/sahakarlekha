/**
 * Marketing Transport domain — entity contracts (types only, no logic).
 * Transport of procured produce / trading goods: transporters (master) and trips (T2).
 */
import type { BaseEntity } from '@/lib/procurement';
import { toMinor, toRupees, addMinor, subMinor } from '@/lib/money';

export interface Transporter extends BaseEntity {
  name: string;
  nameHi?: string;
  vehicleNo?: string;
  phone?: string;
  ratePerQtl?: number;     // default freight rate ₹/qtl (optional; overridable per trip in T2)
  /** E2 (migration 141): the transporter's own payable ledger (a creditor) — freight is credited here. */
  ledgerAccountId?: string;
}

// ── E2: hired-truck trips ─────────────────────────────────────────────────────────────────────────
// Freight is POSTED when the trip is recorded — Dr the freight expense ledger / Cr the transporter's
// payable ledger — and the trip row owns that voucher. Payments are plain vouchers (refType
// hired.trip.payment, refId = trip); paid / outstanding are derived from them. Pure helpers below are
// tested by scripts/test-marketing.mjs.
export const HIRED_TRIP_REF_TYPE = 'hired.trip';
export const HIRED_TRIP_PAYMENT_REF_TYPE = 'hired.trip.payment';

export interface HiredTrip extends BaseEntity {
  tripNo: string;
  date: string;
  transporterId: string;
  dispatchId?: string;
  vehicleNo?: string;
  fromPlace?: string;
  toPlace?: string;
  qty?: number;
  rate?: number;
  freight: number;
  expenseAccountId: string;
  payableAccountId: string;
  voucherId?: string;
  note?: string;
  isDeleted?: boolean;
}

/** Freight = quantity × ₹/qtl when both are given, else the lump sum entered. Paise-exact. */
export function tripFreight(qty: number | undefined, rate: number | undefined, lump?: number): number {
  const q = Number(qty), r = Number(rate);
  if (q > 0 && r > 0) return toRupees(toMinor(q * r));
  return toRupees(toMinor(Number(lump) || 0));
}

/**
 * Trip-form fields a chosen D3 dispatch supplies: the quantity carried (dispatched, not the agency's
 * accepted qty — freight is paid on what the truck moved), its destination, vehicle and transporter.
 * Only fields the dispatch actually has are returned, so anything typed by hand survives.
 */
export function tripPrefillFromDispatch(d: { dispatchedQty?: number; destination?: string; vehicleNo?: string; transporterId?: string }): { qty?: string; toPlace?: string; vehicleNo?: string; transporterId?: string } {
  const out: { qty?: string; toPlace?: string; vehicleNo?: string; transporterId?: string } = {};
  if (Number(d.dispatchedQty) > 0) out.qty = String(d.dispatchedQty);
  if (d.destination?.trim()) out.toPlace = d.destination.trim();
  if (d.vehicleNo?.trim()) out.vehicleNo = d.vehicleNo.trim();
  if (d.transporterId) out.transporterId = d.transporterId;
  return out;
}

/** Paid / outstanding for one trip from its payment vouchers. */
export function tripBalance(trip: Pick<HiredTrip, 'id' | 'freight'>, payments: ReadonlyArray<{ refId?: string; amount: number }>): { paid: number; outstanding: number } {
  const paid = payments.filter(p => p.refId === trip.id).reduce((m, p) => addMinor(m, toMinor(Number(p.amount) || 0)), 0);
  return { paid: toRupees(paid), outstanding: toRupees(subMinor(toMinor(trip.freight), paid)) };
}

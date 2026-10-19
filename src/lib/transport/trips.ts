/**
 * Transport operations — trip / collection / vehicle-expense posting math and document-expiry status. PURE:
 * no React, no Supabase, no storage. TransportOpsContext turns these legs into ONE voucher per document via
 * useData().addVoucher; the voucher is the money authority, the document the vehicle tag.
 *
 * GST: OFF in slice 1. Whether GST on freight is charged by the society (forward charge) or paid by the
 * customer (reverse charge), and at which rate, depends on a GTA's option and the customer's category —
 * the app has no SOURCED rule for that yet (statutory values need the notification text, not a statement).
 * A trip therefore posts no GST line; the page says so.
 */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface Leg { accountId: string; type: 'Dr' | 'Cr'; amount: number }

export interface TripCharges { freight: number; loading?: number; detention?: number }

/** Receivable for a trip: freight + loading + detention (₹, 2 dp). */
export const tripAmount = (c: TripCharges): number =>
  round2((Number(c.freight) || 0) + (Number(c.loading) || 0) + (Number(c.detention) || 0));

/** Why a trip cannot be posted, or null. Hindi first (RULE 7). */
export function validateTripCharges(c: TripCharges): string | null {
  const parts = [c.freight, c.loading ?? 0, c.detention ?? 0].map(Number);
  if (parts.some(x => !Number.isFinite(x) || x < 0)) return 'राशि ऋण (negative) नहीं हो सकती।';
  if (!(Number(c.freight) > 0)) return 'भाड़ा (freight) 0 से अधिक होना चाहिए।';
  return null;
}

/**
 * The trip voucher's legs: Dr customer receivable for the total; Cr freight / loading / detention income,
 * one line per non-zero component. Loading / detention fall back to the freight ledger when the society has
 * no separate head (never silently dropped — the total always balances). [] when invalid.
 */
export function tripLegs(
  customerAccountId: string,
  c: TripCharges,
  ids: { freight: string; loading?: string | null; detention?: string | null },
): Leg[] {
  if (!customerAccountId || !ids.freight || validateTripCharges(c)) return [];
  const byAcc = new Map<string, number>();
  const add = (acc: string, amt: number) => { if (amt > 0) byAcc.set(acc, round2((byAcc.get(acc) || 0) + amt)); };
  add(ids.freight, round2(Number(c.freight) || 0));
  add(ids.loading || ids.freight, round2(Number(c.loading) || 0));
  add(ids.detention || ids.freight, round2(Number(c.detention) || 0));
  const total = tripAmount(c);
  return [{ accountId: customerAccountId, type: 'Dr', amount: total }, ...[...byAcc].map(([accountId, amount]) => ({ accountId, type: 'Cr' as const, amount }))];
}

/**
 * Collection against a trip (partial allowed): Dr cash/bank for the net, Dr TDS receivable for any TDS the
 * customer withheld, Cr customer for the gross. Returns an error (Hindi) or the legs.
 */
export function collectionLegs(input: {
  outstanding: number; amount: number; tds?: number;
  cashOrBankAccountId: string; customerAccountId: string; tdsAccountId?: string | null;
}): { error: string } | { legs: Leg[]; netCash: number; tds: number } {
  const amount = round2(Number(input.amount) || 0);
  const tds = round2(Number(input.tds) || 0);
  if (!(amount > 0)) return { error: 'वसूली राशि 0 से अधिक होनी चाहिए।' };
  if (amount > round2(input.outstanding) + 0.005) return { error: `वसूली ₹${amount} बकाया ₹${round2(input.outstanding)} से अधिक नहीं हो सकती।` };
  if (tds < 0 || tds > amount + 0.005) return { error: 'TDS 0 से कम या वसूली-राशि से अधिक नहीं हो सकता।' };
  if (tds > 0 && !input.tdsAccountId) return { error: 'TDS प्राप्य खाता (3307) chart में नहीं है — TDS खाली छोड़ें या पहले खाता बनाएँ।' };
  const netCash = round2(amount - tds);
  const legs: Leg[] = [
    ...(netCash > 0 ? [{ accountId: input.cashOrBankAccountId, type: 'Dr' as const, amount: netCash }] : []),
    ...(tds > 0 && input.tdsAccountId ? [{ accountId: input.tdsAccountId, type: 'Dr' as const, amount: tds }] : []),
    { accountId: input.customerAccountId, type: 'Cr', amount },
  ];
  return { legs, netCash, tds };
}

/** Status after a collection. */
export function tripStatus(amount: number, paid: number): 'unpaid' | 'partial' | 'paid' {
  return paid >= amount - 0.005 ? 'paid' : paid > 0.005 ? 'partial' : 'unpaid';
}

/** Vehicle expense: Dr expense head / Cr cash-bank. [] when invalid. */
export function expenseLegs(expenseAccountId: string, cashOrBankAccountId: string, amount: number): Leg[] {
  const a = round2(Number(amount) || 0);
  if (!expenseAccountId || !cashOrBankAccountId || !(a > 0)) return [];
  return [{ accountId: expenseAccountId, type: 'Dr', amount: a }, { accountId: cashOrBankAccountId, type: 'Cr', amount: a }];
}

/** Next document number in a `PREFIX/0001` series (client-side, like Labour's DB/ and ADV/ series). */
export function nextDocNo(prefix: string, existing: ReadonlyArray<string | undefined>): string {
  const re = new RegExp(`^${prefix}/(\\d+)$`);
  const max = existing.reduce((m, no) => { const x = no?.match(re); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0);
  return `${prefix}/${String(max + 1).padStart(4, '0')}`;
}

// ── Document expiry (insurance / permit / fitness / PUC) — the Insurance page's rule ─────────────────
export const EXPIRY_WARN_DAYS = 30;
export type ExpiryState = 'none' | 'expired' | 'soon' | 'ok';

/** Whole days from `today` to `date` (both YYYY-MM-DD); null when no date. */
export const daysTo = (date: string | undefined, today: string): number | null =>
  date ? Math.floor((Date.parse(date) - Date.parse(today)) / 86400000) : null;

export function expiryState(date: string | undefined, today: string): { state: ExpiryState; days: number | null } {
  const d = daysTo(date, today);
  if (d === null || Number.isNaN(d)) return { state: 'none', days: null };
  if (d < 0) return { state: 'expired', days: d };
  if (d <= EXPIRY_WARN_DAYS) return { state: 'soon', days: d };
  return { state: 'ok', days: d };
}

/**
 * RULE 3 — every voucher a deleted trip takes with it: its own voucher, then each collection receipt
 * (the trip's linked list ∪ any live voucher pointing back at it by refType/refId, so none is missed).
 */
export function tripCascadeVoucherIds(
  trip: { id: string; voucherId?: string; collectionVoucherIds?: string[] },
  vouchers: ReadonlyArray<{ id: string; isDeleted?: boolean; refType?: string; refId?: string }>,
  collectionRef: string,
): { tripVoucherId: string | null; collectionIds: string[] } {
  const live = new Set(vouchers.filter(v => !v.isDeleted).map(v => v.id));
  const coll = new Set<string>();
  for (const id of trip.collectionVoucherIds || []) if (live.has(id)) coll.add(id);
  for (const v of vouchers) if (!v.isDeleted && v.refType === collectionRef && v.refId === trip.id) coll.add(v.id);
  return { tripVoucherId: trip.voucherId && live.has(trip.voucherId) ? trip.voucherId : null, collectionIds: [...coll] };
}

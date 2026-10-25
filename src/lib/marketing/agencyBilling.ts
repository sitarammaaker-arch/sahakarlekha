/**
 * Marketing D3 — agency side of MSP procurement: dispatch (lifting) with shortage, the agency bill
 * (MSP + incidentals), receipt ↔ bill matching and the season-end reconciliation. PURE (no React /
 * Supabase); MarketingDataContext and the pages call these. Tested by scripts/test-marketing.mjs.
 *
 * Founder 2026-10-25:
 *  • shortage is POSTED — Dr the society's chosen shortage ledger / Cr the agency receivable, at the
 *    dispatched lots' average MSP rate (the agency pays that much less);
 *  • the agency bill's incidentals are POSTED on approval — Dr agency receivable / Cr each line's
 *    ledger. The MSP part of the bill is NOT posted again (it was booked when each lot was posted).
 * No rate is hard-coded: every incidental line's rate and ledger is the society's own entry.
 */
import { toMinor, toRupees, addMinor, subMinor } from '@/lib/money';

export const DISPATCH_SHORTAGE_REF_TYPE = 'procurement.dispatch.shortage';
export const AGENCY_BILL_REF_TYPE = 'procurement.agency.bill';

export interface ProcurementDispatch {
  id: string;
  dispatchNo: string;
  date: string;                 // YYYY-MM-DD
  agencyId: string;
  lotIds: string[];
  vehicleNo?: string;
  transporterId?: string;
  destination?: string;
  dispatchedQty: number;        // quintals (Σ lot quantity)
  dispatchedValue: number;      // rupees (Σ lot procurement value)
  bags?: number;
  acceptedQty?: number;         // quintals the agency accepted
  acceptedDate?: string;
  shortageQty?: number;
  shortageValue?: number;
  shortageAccountId?: string;
  shortageVoucherId?: string;
  status: 'dispatched' | 'accepted';
  note?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type IncidentalUnit = 'perQtl' | 'percent' | 'fixed';
export interface AgencyBillLine { id: string; label: string; unit: IncidentalUnit; rate: number; amount: number; accountId: string }

export interface AgencyBill {
  id: string;
  billNo: string;
  date: string;
  agencyId: string;
  dispatchIds: string[];
  qty: number;                  // accepted quintals billed
  mspValue: number;             // accepted MSP value (already in the receivable — shown, not posted)
  lines: AgencyBillLine[];      // incidentals (posted on approval)
  incidentalTotal: number;
  total: number;                // mspValue + incidentalTotal — what the agency owes on this bill
  voucherId?: string;
  status: 'draft' | 'approved';
  note?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

const sum = (xs: number[]) => toRupees(xs.reduce((m, x) => addMinor(m, toMinor(Number(x) || 0)), 0));

/** Totals of the lots going out on one truck: quantity, value, bags and the average MSP rate. */
export function dispatchTotals(lots: ReadonlyArray<{ quantity?: { value?: number }; value: number; bags?: number }>): { qty: number; value: number; bags: number; rate: number } {
  const qty = Math.round(lots.reduce((t, l) => t + (Number(l.quantity?.value) || 0), 0) * 1000) / 1000;
  const value = sum(lots.map(l => l.value));
  const bags = lots.reduce((t, l) => t + (Number(l.bags) || 0), 0);
  return { qty, value, bags, rate: qty > 0 ? value / qty : 0 };
}

/**
 * Shortage when the agency accepts less than was sent: quantity and its value at the dispatch's
 * average MSP rate (paise-exact). Accepting MORE than was sent, or a negative figure, is invalid (null).
 */
export function shortageOf(dispatchedQty: number, dispatchedValue: number, acceptedQty: number): { qty: number; value: number } | null {
  const d = Number(dispatchedQty), a = Number(acceptedQty);
  if (!Number.isFinite(a) || a < 0 || a > d + 1e-9) return null;
  const qty = Math.round((d - a) * 1000) / 1000;
  if (qty <= 0) return { qty: 0, value: 0 };
  return { qty, value: d > 0 ? toRupees(toMinor((qty / d) * dispatchedValue)) : 0 };
}

/** One incidental line: ₹ per quintal, % of the MSP value, or a fixed amount. */
export function incidentalAmount(unit: IncidentalUnit, rate: number, base: { qty: number; value: number }): number {
  const r = Number(rate) || 0;
  if (r <= 0) return 0;
  return toRupees(toMinor(unit === 'perQtl' ? r * base.qty : unit === 'percent' ? (r / 100) * base.value : r));
}

/** What a bill covers: the ACCEPTED quantity / value of its dispatches (shortage already removed). */
export function billBase(dispatches: ReadonlyArray<Pick<ProcurementDispatch, 'dispatchedQty' | 'dispatchedValue' | 'acceptedQty' | 'shortageValue'>>): { qty: number; value: number } {
  const qty = Math.round(dispatches.reduce((t, d) => t + (Number(d.acceptedQty ?? d.dispatchedQty) || 0), 0) * 1000) / 1000;
  const value = toRupees(dispatches.reduce((m, d) => addMinor(m, subMinor(toMinor(d.dispatchedValue), toMinor(d.shortageValue || 0))), 0));
  return { qty, value };
}

export const billTotals = (mspValue: number, lines: ReadonlyArray<{ amount: number }>) => {
  const incidentalTotal = sum(lines.map(l => l.amount));
  return { incidentalTotal, total: toRupees(addMinor(toMinor(mspValue), toMinor(incidentalTotal))) };
};

/**
 * Receipt ↔ bill matching, per agency, oldest bill first (FIFO): each approved bill shows how much of
 * it the agency's receipts have covered. Receipts beyond all bills are "unapplied" (an advance, or
 * money for lots not yet billed).
 */
export function matchReceiptsToBills(
  bills: ReadonlyArray<Pick<AgencyBill, 'id' | 'agencyId' | 'date' | 'billNo' | 'total' | 'status' | 'isDeleted'>>,
  receipts: ReadonlyArray<{ agencyId?: string; amount: number }>,
): { byBill: Record<string, { billed: number; received: number; outstanding: number }>; unapplied: Record<string, number> } {
  const byBill: Record<string, { billed: number; received: number; outstanding: number }> = {};
  const unapplied: Record<string, number> = {};
  const agencies = new Set(bills.filter(b => !b.isDeleted && b.status === 'approved').map(b => b.agencyId));
  for (const r of receipts) if (r.agencyId) agencies.add(r.agencyId);
  for (const ag of agencies) {
    let pool = receipts.filter(r => r.agencyId === ag).reduce((m, r) => addMinor(m, toMinor(Number(r.amount) || 0)), 0);
    const mine = bills.filter(b => b.agencyId === ag && !b.isDeleted && b.status === 'approved')
      .slice().sort((a, b) => (a.date === b.date ? (a.billNo < b.billNo ? -1 : 1) : a.date < b.date ? -1 : 1));
    for (const b of mine) {
      const billed = toMinor(b.total);
      const take = Math.max(0, Math.min(pool, billed));
      pool -= take;
      byBill[b.id] = { billed: toRupees(billed), received: toRupees(take), outstanding: toRupees(billed - take) };
    }
    unapplied[ag] = toRupees(Math.max(0, pool));
  }
  return { byBill, unapplied };
}

/** Next document number: PREFIX/0001 … (max + 1 over the existing numbers). */
export function nextDocNo(prefix: string, existing: ReadonlyArray<string | undefined>): string {
  const re = new RegExp(`^${prefix}/(\\d+)$`);
  const max = existing.reduce((m, n) => { const x = n ? re.exec(n) : null; return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `${prefix}/${String(max + 1).padStart(4, '0')}`;
}

// ── Season-end reconciliation ─────────────────────────────────────────────────────────────────────
export interface SeasonReconRow {
  seasonId: string;
  lots: number;
  qty: number;              // posted, non-cancelled, non-rejected lots
  value: number;
  dispatchedQty: number;
  acceptedQty: number;
  shortageQty: number;
  shortageValue: number;
  undispatchedQty: number;  // posted but not yet sent to the agency
  billedValue: number;      // MSP value on approved bills
  unbilledValue: number;    // accepted but not yet billed
  incidentals: number;
}

export function seasonReconciliation(
  lots: ReadonlyArray<{ id: string; seasonId: string; quantity?: { value?: number }; value: number }>,
  dispatches: ReadonlyArray<ProcurementDispatch>,
  bills: ReadonlyArray<AgencyBill>,
): SeasonReconRow[] {
  const liveD = dispatches.filter(d => !d.isDeleted);
  const liveB = bills.filter(b => !b.isDeleted && b.status === 'approved');
  const dispatchOfLot = new Map<string, ProcurementDispatch>();
  for (const d of liveD) for (const id of d.lotIds) dispatchOfLot.set(id, d);
  const billOfDispatch = new Map<string, AgencyBill>();
  for (const b of liveB) for (const id of b.dispatchIds) billOfDispatch.set(id, b);
  const rows = new Map<string, SeasonReconRow>();
  for (const l of lots) {
    const r = rows.get(l.seasonId) ?? { seasonId: l.seasonId, lots: 0, qty: 0, value: 0, dispatchedQty: 0, acceptedQty: 0, shortageQty: 0, shortageValue: 0, undispatchedQty: 0, billedValue: 0, unbilledValue: 0, incidentals: 0 };
    const q = Number(l.quantity?.value) || 0;
    r.lots += 1; r.qty += q; r.value = toRupees(addMinor(toMinor(r.value), toMinor(l.value)));
    const d = dispatchOfLot.get(l.id);
    if (!d) r.undispatchedQty += q;
    rows.set(l.seasonId, r);
  }
  // Dispatch-level figures go to the season of the dispatch's first lot.
  const seasonOfLot = new Map(lots.map(l => [l.id, l.seasonId]));
  for (const d of liveD) {
    const s = d.lotIds.map(id => seasonOfLot.get(id)).find(Boolean);
    const r = s ? rows.get(s) : undefined;
    if (!r) continue;
    r.dispatchedQty += d.dispatchedQty;
    if (d.status === 'accepted') {
      r.acceptedQty += Number(d.acceptedQty) || 0;
      r.shortageQty += Number(d.shortageQty) || 0;
      r.shortageValue = toRupees(addMinor(toMinor(r.shortageValue), toMinor(d.shortageValue || 0)));
      const accepted = toRupees(subMinor(toMinor(d.dispatchedValue), toMinor(d.shortageValue || 0)));
      const b = billOfDispatch.get(d.id);
      if (b) r.billedValue = toRupees(addMinor(toMinor(r.billedValue), toMinor(accepted)));
      else r.unbilledValue = toRupees(addMinor(toMinor(r.unbilledValue), toMinor(accepted)));
    }
  }
  for (const b of liveB) {
    const s = b.dispatchIds.map(id => liveD.find(d => d.id === id)?.lotIds.map(x => seasonOfLot.get(x)).find(Boolean)).find(Boolean);
    const r = s ? rows.get(s) : undefined;
    if (r) r.incidentals = toRupees(addMinor(toMinor(r.incidentals), toMinor(b.incidentalTotal)));
  }
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return [...rows.values()].map(r => ({ ...r, qty: r3(r.qty), dispatchedQty: r3(r.dispatchedQty), acceptedQty: r3(r.acceptedQty), shortageQty: r3(r.shortageQty), undispatchedQty: r3(r.undispatchedQty) }));
}

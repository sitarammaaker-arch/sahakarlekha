/**
 * Marketing M4 — procurement register builders (pure, no side effects).
 * Aggregations only; label resolution + the farmer↔settlement chain join stay in the page.
 */
import type { ProcurementLot, FarmerSettlement } from '@/lib/procurement';
import { localDateOf } from '@/lib/procurement/agentFlow';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const lotValue = (l: ProcurementLot) => r2((l.quantity?.value || 0) * (l.mspRate?.amount || 0));

export interface ProcRegRow {
  lotId: string;
  date: string;            // yyyy-mm-dd
  farmerId: string;
  cropId: string;
  varietyId?: string;
  seasonId?: string;
  centreId?: string;
  qty: number;
  rate: number;
  value: number;
  status: string;
}
export interface ProcurementRegister {
  rows: ProcRegRow[];
  totalQty: number;
  totalValue: number;
  count: number;
}

/**
 * Batch A: the lots a register COUNTS — posted to the ledger and not rejected at quality. A lot that was
 * only entered (or was rejected) is not a procurement yet; counting it overstated quantity and value.
 */
export function countableLots<L extends Pick<ProcurementLot, 'id' | 'cancelledAt'>>(lots: ReadonlyArray<L>, postedLotIds: ReadonlySet<string>, rejectedLotIds: ReadonlySet<string>): L[] {
  // Batch B: a cancelled lot's posting is reversed — it is not a procurement either.
  return lots.filter(l => postedLotIds.has(l.id) && !rejectedLotIds.has(l.id) && !l.cancelledAt);
}

/** All lots in [from,to] (inclusive, by LOCAL createdAt date), newest first, with per-lot value + totals.
 *  statusOf labels each row (the lot's stage); without it the stored operationalStatus is shown. */
export function buildProcurementRegister(lots: ReadonlyArray<ProcurementLot>, from?: string, to?: string, statusOf?: (l: ProcurementLot) => string): ProcurementRegister {
  const rows: ProcRegRow[] = lots
    .map(l => ({ l, date: l.lotDate || localDateOf(l.createdAt) || '' }))   // batch B: the business date when set
    .filter(({ date }) => (!from || date >= from) && (!to || date <= to))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map(({ l, date }) => ({
      lotId: l.id, date, farmerId: l.farmerId, cropId: l.cropId, varietyId: l.varietyId,
      seasonId: l.seasonId, centreId: l.centreId,
      qty: l.quantity?.value || 0, rate: l.mspRate?.amount || 0, value: lotValue(l),
      status: statusOf ? statusOf(l) : l.operationalStatus,
    }));
  return {
    rows,
    totalQty: r2(rows.reduce((s, x) => s + x.qty, 0)),
    totalValue: r2(rows.reduce((s, x) => s + x.value, 0)),
    count: rows.length,
  };
}

export interface CommodityRow { cropId: string; qty: number; value: number; lots: number; }
/** Per-crop totals across all lots (qty, procurement value, lot count), highest value first. */
export function buildCommoditySummary(lots: ReadonlyArray<ProcurementLot>): CommodityRow[] {
  const map = new Map<string, CommodityRow>();
  for (const l of lots) {
    const cur = map.get(l.cropId) || { cropId: l.cropId, qty: 0, value: 0, lots: 0 };
    cur.qty = r2(cur.qty + (l.quantity?.value || 0));
    cur.value = r2(cur.value + lotValue(l));
    cur.lots += 1;
    map.set(l.cropId, cur);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export interface SettlementTotals { gross: number; deductions: number; net: number; paid: number; outstanding: number; count: number; }
/** Sum gross / deductions / net / paid / outstanding across APPROVED, live settlements — a draft's Net
 *  Payable is not owed yet, so counting it inflated the outstanding. */
export function settlementTotals(settlements: ReadonlyArray<FarmerSettlement>): SettlementTotals {
  const live = settlements.filter(s => !s.isDeleted && s.status === 'approved');
  const gross = r2(live.reduce((s, x) => s + (x.gross?.amount || 0), 0));
  const deductions = r2(live.reduce((s, x) => s + (x.deductionLines || []).reduce((a, l) => a + (l.amount?.amount || 0), 0), 0));
  const net = r2(live.reduce((s, x) => s + (x.netPayable?.amount || 0), 0));
  const paid = r2(live.reduce((s, x) => s + (x.amountPaid?.amount || 0), 0));
  return { gross, deductions, net, paid, outstanding: r2(net - paid), count: live.length };
}

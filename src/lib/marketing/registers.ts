/**
 * Marketing M4 — procurement register builders (pure, no side effects).
 * Aggregations only; label resolution + the farmer↔settlement chain join stay in the page.
 */
import type { ProcurementLot, FarmerSettlement } from '@/lib/procurement';

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

/** All lots in [from,to] (inclusive, by createdAt date), newest first, with per-lot value + totals. */
export function buildProcurementRegister(lots: ReadonlyArray<ProcurementLot>, from?: string, to?: string): ProcurementRegister {
  const rows: ProcRegRow[] = lots
    .map(l => ({ l, date: (l.createdAt || '').slice(0, 10) }))
    .filter(({ date }) => (!from || date >= from) && (!to || date <= to))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map(({ l, date }) => ({
      lotId: l.id, date, farmerId: l.farmerId, cropId: l.cropId, varietyId: l.varietyId,
      seasonId: l.seasonId, centreId: l.centreId,
      qty: l.quantity?.value || 0, rate: l.mspRate?.amount || 0, value: lotValue(l),
      status: l.operationalStatus,
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
/** Sum gross / deductions / net / paid / outstanding across a list of (live) settlements. */
export function settlementTotals(settlements: ReadonlyArray<FarmerSettlement>): SettlementTotals {
  const live = settlements.filter(s => !s.isDeleted);
  const gross = r2(live.reduce((s, x) => s + (x.gross?.amount || 0), 0));
  const deductions = r2(live.reduce((s, x) => s + (x.deductionLines || []).reduce((a, l) => a + (l.amount?.amount || 0), 0), 0));
  const net = r2(live.reduce((s, x) => s + (x.netPayable?.amount || 0), 0));
  const paid = r2(live.reduce((s, x) => s + (x.amountPaid?.amount || 0), 0));
  return { gross, deductions, net, paid, outstanding: r2(net - paid), count: live.length };
}

/**
 * Vehicle-wise profit (वाहन-वार लाभ). PURE.
 *
 * THE VEHICLE TAG. A voucher belongs to a vehicle through the transport DOCUMENT that owns it — not through
 * a voucher column:
 *   refType 'transport.trip'    + refId = trip id     → trip.vehicleId
 *   refType 'transport.expense' + refId = expense id  → expense.vehicleId
 *   a depreciation / disposal voucher of the Asset Register row a vehicle links to (asset.voucherIds)
 * costCentreId (the activity, CM-PACS) and workOrderId (labour) are left alone, so the same voucher can
 * still carry an activity tag. No posting RPC change was needed: post_voucher stores refType/refId.
 *
 * RULE 2: amounts come from the VOUCHER LINES (the same lines the ledger and Trial Balance read), never
 * from the document copy. The caller passes the counted, branch-scoped voucher set, exactly as the
 * Activity I&E page does. Income = Cr − Dr on income ledgers, cost = Dr − Cr on expense ledgers, paise.
 *
 * What no document tags — a diesel bill entered as a plain payment voucher, freight booked by hand —
 * cannot be put on a vehicle. It is reported as "unallocated" (transport heads only), never guessed.
 */
import type { Asset, LedgerAccount, TransportTrip, TransportVehicle, Voucher, VehicleExpense } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';

export const TRIP_REF = 'transport.trip';
export const TRIP_COLLECTION_REF = 'transport.trip.collection';
export const EXPENSE_REF = 'transport.expense';

const paise = (x: number) => Math.round((Number(x) || 0) * 100);

export interface VehicleProfitRow {
  vehicleId: string;
  regNo: string;
  trips: number;
  /** income lines of tagged vouchers, paise */
  income: number;
  /** running cost (expense documents), paise */
  runningCost: number;
  /** depreciation / disposal result from the linked asset, paise (expense − income on those vouchers) */
  depreciation: number;
  net: number;
  /** expense ledger → paise, running cost only */
  costByAccount: Record<string, number>;
}

export interface VehicleProfitResult {
  rows: VehicleProfitRow[];
  totals: { trips: number; income: number; runningCost: number; depreciation: number; net: number };
  /** transport income / cost in the window that no transport document tags to a vehicle */
  unallocatedIncome: number;
  unallocatedCost: number;
}

export function computeVehicleProfit(input: {
  vouchers: readonly Voucher[];
  accounts: readonly Pick<LedgerAccount, 'id' | 'type'>[];
  vehicles: readonly TransportVehicle[];
  trips: readonly TransportTrip[];
  expenses: readonly VehicleExpense[];
  assets?: readonly Pick<Asset, 'id' | 'voucherIds'>[];
  /** resolved transport income / expense ledgers (for the unallocated lines) */
  transportIncomeIds: readonly string[];
  transportExpenseIds: readonly string[];
  from?: string;
  to?: string;
}): VehicleProfitResult {
  const accType = new Map(input.accounts.map(a => [a.id, a.type]));
  const tripVehicle = new Map(input.trips.map(t => [t.id, t.vehicleId]));
  const expenseVehicle = new Map(input.expenses.map(e => [e.id, e.vehicleId]));
  // The document's own voucherId is the same link seen from the other side (it also covers a voucher whose
  // refType/refId overlay was lost on the legacy two-step save path).
  const docVoucher = new Map<string, { vehicleId: string; kind: 'trip' | 'expense' }>();
  for (const t of input.trips) if (t.voucherId) docVoucher.set(t.voucherId, { vehicleId: t.vehicleId, kind: 'trip' });
  for (const e of input.expenses) if (e.voucherId) docVoucher.set(e.voucherId, { vehicleId: e.vehicleId, kind: 'expense' });
  const assetVehicle = new Map<string, string>();
  for (const veh of input.vehicles) {
    if (!veh.assetId) continue;
    const asset = (input.assets || []).find(a => a.id === veh.assetId);
    for (const vid of asset?.voucherIds || []) assetVehicle.set(vid, veh.id);
  }
  const incomeIds = new Set(input.transportIncomeIds);
  const expenseIds = new Set(input.transportExpenseIds);

  const rows = new Map<string, VehicleProfitRow>();
  for (const veh of input.vehicles) {
    if (veh.isDeleted) continue;
    rows.set(veh.id, { vehicleId: veh.id, regNo: veh.regNo, trips: 0, income: 0, runningCost: 0, depreciation: 0, net: 0, costByAccount: {} });
  }
  let unallocatedIncome = 0;
  let unallocatedCost = 0;

  for (const v of input.vouchers) {
    if (v.isDeleted) continue;
    if (input.from && v.date < input.from) continue;
    if (input.to && v.date > input.to) continue;
    let vehicleId: string | undefined;
    let kind: 'trip' | 'expense' | 'asset' | null = null;
    if (v.refType === TRIP_REF && v.refId && tripVehicle.has(v.refId)) { vehicleId = tripVehicle.get(v.refId); kind = 'trip'; }
    else if (v.refType === EXPENSE_REF && v.refId && expenseVehicle.has(v.refId)) { vehicleId = expenseVehicle.get(v.refId); kind = 'expense'; }
    else if (docVoucher.has(v.id)) { ({ vehicleId, kind } = docVoucher.get(v.id)!); }
    else if (assetVehicle.has(v.id)) { vehicleId = assetVehicle.get(v.id); kind = 'asset'; }
    const row = vehicleId ? rows.get(vehicleId) : undefined;

    for (const l of getVoucherLines(v)) {
      const t = accType.get(l.accountId);
      if (t !== 'income' && t !== 'expense') continue;
      const amt = paise(l.amount);
      if (!amt) continue;
      const inc = t === 'income' ? (l.type === 'Cr' ? amt : -amt) : 0;
      const exp = t === 'expense' ? (l.type === 'Dr' ? amt : -amt) : 0;
      if (!row) {
        if (incomeIds.has(l.accountId)) unallocatedIncome += inc;
        if (expenseIds.has(l.accountId)) unallocatedCost += exp;
        continue;
      }
      if (kind === 'asset') { row.depreciation += exp - inc; continue; }
      row.income += inc;
      if (exp) {
        row.runningCost += exp;
        row.costByAccount[l.accountId] = (row.costByAccount[l.accountId] ?? 0) + exp;
      }
    }
    if (row && kind === 'trip') row.trips += 1;
  }

  const out = [...rows.values()].map(r => ({ ...r, net: r.income - r.runningCost - r.depreciation }));
  out.sort((a, b) => b.net - a.net || a.regNo.localeCompare(b.regNo));
  const totals = out.reduce((s, r) => ({
    trips: s.trips + r.trips, income: s.income + r.income, runningCost: s.runningCost + r.runningCost,
    depreciation: s.depreciation + r.depreciation, net: s.net + r.net,
  }), { trips: 0, income: 0, runningCost: 0, depreciation: 0, net: 0 });
  return { rows: out, totals, unallocatedIncome, unallocatedCost };
}

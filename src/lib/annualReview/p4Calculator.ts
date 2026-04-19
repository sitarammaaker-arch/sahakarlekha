/**
 * Proforma 4 — Patronage Rebate quantities.
 *
 * Sums stock movements (within FY) by P4 category:
 *   sales of DAP/Urea/Other-fert      → "SOLD" columns
 *   purchases of Wheat/Barley/Gram/.. → "PROCURED" columns
 *
 * All quantities normalized to MT (metric tonnes).
 * Conversion: 1 MT = 1000 kg = 10 quintal; bag/piece/liter/other treated as zero
 * (user must tag with proper unit for P4 aggregation to work).
 */
import type { StockItem, StockMovement, P4StockCategory } from '@/types';

export interface P4Totals {
  // Sold (fertilizer)
  dap: number;
  urea: number;
  otherFert: number;
  // Procured (crops)
  wheatProc: number;
  barleyProc: number;
  gramProc: number;
  paddyProc: number;
  mustardProc: number;
  sunflowerProc: number;
  otherProc: number;
}

export interface P4Result {
  society: string;
  totals: P4Totals;           // in MT
  untaggedItems: StockItem[];  // stock items that had movements but no p4Category
}

/** Convert any stock unit → MT (metric tonnes). */
export function qtyToMT(qty: number, unit?: string): number {
  if (!qty || !isFinite(qty)) return 0;
  const u = (unit || '').toLowerCase();
  if (u === 'kg')       return qty / 1000;
  if (u === 'quintal')  return qty / 10;
  if (u === 'mt' || u === 'tonne' || u === 'ton') return qty;
  // Items in bag/piece/liter/other cannot be meaningfully reported in MT
  return 0;
}

export interface P4Inputs {
  stockItems: StockItem[];
  movements: StockMovement[];
  fromDate: string;  // inclusive ISO
  toDate: string;    // inclusive ISO
  societyName: string;
}

export function calculateP4(input: P4Inputs): P4Result {
  const { stockItems, movements, fromDate, toDate, societyName } = input;

  // Build id → item lookup
  const itemById = new Map<string, StockItem>();
  stockItems.forEach(it => itemById.set(it.id, it));

  // Classify movement target: 'sold' | 'procured' | null
  const mvTarget = (cat?: P4StockCategory): 'sold' | 'procured' | null => {
    if (!cat) return null;
    if (cat === 'dap' || cat === 'urea' || cat === 'otherFert') return 'sold';
    return 'procured';
  };

  const totals: P4Totals = {
    dap: 0, urea: 0, otherFert: 0,
    wheatProc: 0, barleyProc: 0, gramProc: 0,
    paddyProc: 0, mustardProc: 0, sunflowerProc: 0, otherProc: 0,
  };

  const untaggedIds = new Set<string>();

  for (const mv of movements) {
    if (!mv.date || mv.date < fromDate || mv.date > toDate) continue;
    const item = itemById.get(mv.itemId);
    if (!item) continue;
    const cat = item.p4Category;
    const target = mvTarget(cat);
    if (!cat || !target) {
      // only warn about items with significant movement (purchase or sale)
      if (mv.type === 'purchase' || mv.type === 'sale') untaggedIds.add(mv.itemId);
      continue;
    }
    // Only count the right direction: sales for fertilizer, purchases for crops
    if (target === 'sold'     && mv.type !== 'sale')     continue;
    if (target === 'procured' && mv.type !== 'purchase') continue;

    const mt = qtyToMT(Math.abs(mv.qty), item.unit);
    totals[cat] += mt;
  }

  const untaggedItems = Array.from(untaggedIds)
    .map(id => itemById.get(id))
    .filter((x): x is StockItem => !!x);

  return { society: societyName, totals, untaggedItems };
}

export const P4_CATEGORY_LABELS: Record<P4StockCategory, string> = {
  dap:            'DAP sold',
  urea:           'Urea sold',
  otherFert:      'Other Fertilizer sold',
  wheatProc:      'Wheat procured',
  barleyProc:     'Barley procured',
  gramProc:       'Gram procured',
  paddyProc:      'Paddy procured',
  mustardProc:    'Mustard procured',
  sunflowerProc:  'Sunflower procured',
  otherProc:      'Other procurement',
};

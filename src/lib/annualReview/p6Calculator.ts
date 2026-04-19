/**
 * Proforma 6 — Detail of Assets (Working / Non-Working)
 * Groups assets by P6 category: Godown, Land/Plots, Shop/Building, Trucks, Other (F&F)
 * Columns: Original cost, WDV, Market Value, Condition (Serviceable/Unserviceable)
 */
import type { Asset, P6AssetCategory, SocietySettings } from '@/types';
import { calcDepForFY, DEP_ACCOUNTS, parseFY } from '@/lib/depreciation';

export interface P6AssetRow {
  id: string;
  name: string;
  capacityMT: number;      // 0 if not a godown
  originalCost: number;
  wdv: number;             // written-down value as of current FY end
  marketValue: number;
  condition: 'serviceable' | 'unserviceable' | 'unknown';
  remarks: string;
}

export interface P6CategoryGroup {
  category: P6AssetCategory;
  label: string;
  rows: P6AssetRow[];
  totalOriginal: number;
  totalWdv: number;
  totalMarket: number;
  totalCapacity: number;   // only meaningful for godown
}

export interface P6Result {
  groups: P6CategoryGroup[];
  grandTotalOriginal: number;
  grandTotalWdv: number;
  grandTotalMarket: number;
  serviceableCount: number;
  unserviceableCount: number;
  untagged: Asset[];   // assets without p6Category — user must classify
}

const CATEGORY_LABELS: Record<P6AssetCategory, string> = {
  godown: 'Godown',
  land:   'Land / Plots',
  shop:   'Shop / Building',
  truck:  'Trucks',
  other:  'Other Fixed Assets (F&F)',
};

const CATEGORY_ORDER: P6AssetCategory[] = ['godown', 'land', 'shop', 'truck', 'other'];

/**
 * Compute WDV for an asset as of the current FY end — sum of dep posted up to FY
 * then subtract from cost. Uses existing depreciation helper.
 */
function calcWdv(asset: Asset, currentFY: string): number {
  if (asset.status === 'disposed') return 0;
  if (!asset.depreciationRate || !DEP_ACCOUNTS[asset.category]) return asset.cost;

  const fyParsed = parseFY(currentFY);
  if (!fyParsed) return asset.cost;
  const endYear = parseInt(fyParsed.end.slice(0, 4), 10);        // calendar year of FY end
  const purchaseYear = new Date(asset.purchaseDate).getFullYear();
  const assetStartYear = purchaseYear < 4 ? purchaseYear : (new Date(asset.purchaseDate).getMonth() < 3 ? purchaseYear - 1 : purchaseYear);
  let accumulated = 0;
  for (let y = assetStartYear; y < endYear; y++) {
    const fy = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
    accumulated += calcDepForFY(asset, fy, accumulated);
  }
  return Math.max(asset.residualValue || 0, asset.cost - accumulated);
}

export function calculateP6(assets: Asset[], society: SocietySettings): P6Result {
  const active = assets.filter(a => a.status === 'active');
  const untagged = active.filter(a => !a.p6Category);

  const groups: P6CategoryGroup[] = CATEGORY_ORDER.map(cat => {
    const items = active.filter(a => a.p6Category === cat);
    const rows: P6AssetRow[] = items.map(a => ({
      id: a.id,
      name: a.name + (a.location ? ` (${a.location})` : ''),
      capacityMT: a.capacityMT || 0,
      originalCost: a.cost || 0,
      wdv: calcWdv(a, society.financialYear),
      marketValue: a.marketValue || 0,
      condition: (a.condition || 'unknown') as 'serviceable' | 'unserviceable' | 'unknown',
      remarks: a.description || '',
    }));
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      rows,
      totalOriginal: rows.reduce((s, r) => s + r.originalCost, 0),
      totalWdv: rows.reduce((s, r) => s + r.wdv, 0),
      totalMarket: rows.reduce((s, r) => s + r.marketValue, 0),
      totalCapacity: rows.reduce((s, r) => s + r.capacityMT, 0),
    };
  });

  const grandTotalOriginal = groups.reduce((s, g) => s + g.totalOriginal, 0);
  const grandTotalWdv      = groups.reduce((s, g) => s + g.totalWdv, 0);
  const grandTotalMarket   = groups.reduce((s, g) => s + g.totalMarket, 0);

  const all = groups.flatMap(g => g.rows);
  const serviceableCount   = all.filter(r => r.condition === 'serviceable').length;
  const unserviceableCount = all.filter(r => r.condition === 'unserviceable').length;

  return {
    groups, grandTotalOriginal, grandTotalWdv, grandTotalMarket,
    serviceableCount, unserviceableCount, untagged,
  };
}

export { CATEGORY_LABELS as P6_CATEGORY_LABELS };

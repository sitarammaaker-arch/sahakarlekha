/**
 * Audit Schedules (State format) — tie every schedule to the Balance Sheet / Trading A/c.
 *
 * The schedule DEFINITIONS (stateAuditFormats.ts) list well-known account ids per line; their totals
 * used a different scope (a subtype / parent group), so a schedule could print lines that did not add
 * up to its total, drop accounts the list did not name (Rania: Hafed Marketing Division, closing
 * stock), and rebuild its own Trading A/c. This post-processor keeps the definitions and makes the
 * FIGURES come from the SAME sources as the statements (RULE 2):
 *
 *  • Schedules I–VII read the Balance Sheet's own leaves (balanceSheetLeaves — sign-reclassified,
 *    closing stock by the one closing-stock rule). Every leaf lands in exactly ONE schedule; a leaf
 *    no line names gets its own line (by account name). Each total = the sum of its lines, and
 *    I+II+III+VII = total liabilities, IV+V+VI = total assets — reported as `ties`.
 *  • VIII / IX list every income / expense ledger (a leftover gets its own line); total = the sum.
 *  • X is the app's Trading A/c: opening stock, sales (net of returns), purchases, direct expenses,
 *    closing stock, gross profit — lines that foot — then net profit.
 * PURE.
 */
import type { AccountBalance, LedgerAccount } from '@/types';
import type { ResolvedLineItem, ResolvedSchedule, ScheduleLineItem } from './stateAuditFormats';
import type { BalanceSheetLeaves } from './balanceSheetLeaves';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface TieInput {
  accounts: readonly LedgerAccount[];
  leaves: BalanceSheetLeaves;
  /** All income / expense leaves of the trial balance. */
  trialBalance: readonly AccountBalance[];
  trading: { totalSales: number; totalOpeningStock: number; totalPurchases: number; totalDirectExp: number; totalClosingStock: number; grossProfit: number } | null;
  netProfit: number;
  previousYearBalances: Record<string, number>;
}
export interface TieResult { schedules: ResolvedSchedule[]; ties: { liabilities: number; assets: number; bsLiabilities: number; bsAssets: number; ok: boolean } }

type Side = 'liab' | 'asset' | 'income' | 'expense';
const LIAB_SCHEDULES: Record<string, (a: LedgerAccount, under: (g: string) => boolean) => boolean> = {
  'sch-I': (_a, under) => under('1100'),
  'sch-II': (_a, under) => under('1200'),
  'sch-III': (_a, under) => under('2300'),
};
const ASSET_SCHEDULES: Record<string, (a: LedgerAccount, under: (g: string) => boolean) => boolean> = {
  'sch-IV': (a, under) => under('3100') || a.subtype === 'fixed_asset' || a.subtype === 'accumulated_dep',
  'sch-V': (a, under) => under('3200') || a.subtype === 'investment',
};
const TIED = new Set(['sch-I', 'sch-II', 'sch-III', 'sch-IV', 'sch-V', 'sch-VI', 'sch-VII', 'sch-VIII', 'sch-IX']);
const LIAB_REST = 'sch-VII';
const ASSET_REST = 'sch-VI';

export function tieSchedules(resolved: readonly ResolvedSchedule[], input: TieInput): TieResult {
  const byId = new Map(input.accounts.map((a) => [a.id, a]));
  const ancestors = (a: LedgerAccount) => {
    const out: string[] = [];
    let p = a.parentId, guard = 0;
    while (p && guard++ < 20) { out.push(p); p = byId.get(p)?.parentId; }
    return out;
  };
  const underOf = (a: LedgerAccount) => { const anc = ancestors(a); return (g: string) => anc.includes(g); };

  // Which schedule each Balance Sheet leaf belongs to — exactly one.
  const home = (b: AccountBalance, side: 'liab' | 'asset'): string => {
    const under = underOf(b.account);
    const table = side === 'liab' ? LIAB_SCHEDULES : ASSET_SCHEDULES;
    for (const [sch, test] of Object.entries(table)) if (test(b.account, under)) return sch;
    return side === 'liab' ? LIAB_REST : ASSET_REST;
  };
  const scoped = new Map<string, { b: AccountBalance; side: Side }[]>();
  const put = (sch: string, b: AccountBalance, side: Side) => scoped.set(sch, [...(scoped.get(sch) ?? []), { b, side }]);
  for (const b of input.leaves.capLiabLeaves) put(home(b, 'liab'), b, 'liab');
  for (const b of input.leaves.assetLeaves) put(home(b, 'asset'), b, 'asset');
  for (const b of input.trialBalance) {
    if (b.account.isGroup || Math.abs(b.netBalance) < 0.005) continue;
    if (b.account.type === 'income') put('sch-VIII', b, 'income');
    else if (b.account.type === 'expense') put('sch-IX', b, 'expense');
  }
  const amt = (x: { b: AccountBalance; side: Side }) => (x.side === 'liab' || x.side === 'income' ? -x.b.netBalance : x.b.netBalance);

  const matches = (li: ScheduleLineItem, a: LedgerAccount): boolean => {
    const s = li.source;
    if (s.kind === 'account') return s.accountIds.includes(a.id);
    if (s.kind === 'parentGroup') return s.parentIds.some((g) => a.parentId === g || underOf(a)(g));
    if (s.kind === 'subtype') return s.subtypes.includes(a.subtype || '');
    return false;
  };
  const py = (ids: string[]) => ids.reduce((t, id) => t + (input.previousYearBalances[id] ?? 0), 0);

  const retie = (sch: ResolvedSchedule): ResolvedSchedule => {
    // Every Balance Sheet / P&L schedule is re-tied — an EMPTY one too (its computed lines, e.g. the
    // current-year surplus in II, still make up its total).
    if (!TIED.has(sch.id)) return sch;
    const pool = scoped.get(sch.id) ?? [];
    const used = new Set<string>();
    const lines: ResolvedLineItem[] = [];
    for (const li of sch.items) {
      if (li.isTotal) continue;
      if (li.source.kind === 'computed' || li.source.kind === 'members' || li.source.kind === 'assetDepreciation') { lines.push(li); continue; }
      const hits = pool.filter((x) => !used.has(x.b.account.id) && matches(li, x.b.account));
      hits.forEach((x) => used.add(x.b.account.id));
      lines.push({ ...li, currentYear: r2(hits.reduce((t, x) => t + amt(x), 0)) });
    }
    // A ledger no line names: its own line, so nothing on the Balance Sheet is left out.
    for (const x of pool) {
      if (used.has(x.b.account.id)) continue;
      lines.push({ id: `${sch.id}-x-${x.b.account.id}`, label: x.b.account.name, labelHi: x.b.account.nameHi || x.b.account.name, source: { kind: 'account', accountIds: [x.b.account.id] }, indent: 0,
        currentYear: r2(amt(x)), previousYear: py([x.b.account.id]) });
    }
    if (sch.id === ASSET_REST && Math.abs(input.leaves.unpostedStock) > 0.005) {
      lines.push({ id: 'VI-stock', label: 'Closing Stock', labelHi: 'समापन माल', source: { kind: 'computed', key: 'closingStock' }, indent: 0, currentYear: r2(input.leaves.unpostedStock), previousYear: 0 });
    }
    const total = sch.items.find((i) => i.isTotal);
    const sum = r2(lines.reduce((t, l) => t + l.currentYear, 0));
    const pySum = r2(lines.reduce((t, l) => t + l.previousYear, 0));
    return { ...sch, items: total ? [...lines, { ...total, currentYear: sum, previousYear: pySum }] : lines };
  };

  const tradingSchedule = (sch: ResolvedSchedule): ResolvedSchedule => {
    const t = input.trading;
    if (!t) return sch;
    const base = sch.items.find((i) => i.id === 'X-1') ?? sch.items[0];
    const mk = (id: string, label: string, labelHi: string, v: number, bold = false): ResolvedLineItem =>
      ({ ...base, id, label, labelHi, source: { kind: 'computed', key: id }, indent: 0, bold, isTotal: false, note: undefined, currentYear: r2(v), previousYear: 0 });
    const np = sch.items.find((i) => i.isTotal);
    return { ...sch, items: [
      mk('X-open', 'Opening Stock', 'प्रारंभिक माल', t.totalOpeningStock),
      mk('X-1', 'Total Sales (net of returns)', 'कुल बिक्री (वापसी घटाकर)', t.totalSales),
      mk('X-2', 'Total Purchases', 'कुल क्रय', t.totalPurchases),
      mk('X-dexp', 'Direct Expenses', 'प्रत्यक्ष व्यय', t.totalDirectExp),
      mk('X-close', 'Closing Stock', 'समापन माल', t.totalClosingStock),
      mk('X-3', 'Gross Profit / (Loss)', 'सकल लाभ / (हानि)', t.grossProfit, true),
      ...(np ? [{ ...np, currentYear: r2(input.netProfit) }] : []),
    ] };
  };

  const schedules = resolved.map((s) => (s.id === 'sch-X' ? tradingSchedule(s) : retie(s)));
  const totalOf = (id: string) => schedules.find((s) => s.id === id)?.items.find((i) => i.isTotal)?.currentYear ?? 0;
  const liabilities = r2(['sch-I', 'sch-II', 'sch-III', 'sch-VII'].reduce((t, id) => t + totalOf(id), 0));
  const assets = r2(['sch-IV', 'sch-V', 'sch-VI'].reduce((t, id) => t + totalOf(id), 0));
  const bsLiabilities = r2(input.leaves.totalLiabilities), bsAssets = r2(input.leaves.totalAssets);
  return { schedules, ties: { liabilities, assets, bsLiabilities, bsAssets, ok: Math.abs(liabilities - bsLiabilities) < 0.01 && Math.abs(assets - bsAssets) < 0.01 } };
}

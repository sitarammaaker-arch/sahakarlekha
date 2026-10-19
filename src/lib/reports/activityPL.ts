/**
 * Activity-wise Income & Expenditure (CM-PACS: "गतिविधि-वार हिसाब").
 *
 * A voucher is tagged with ONE business activity through the existing accounting dimension
 * `Voucher.costCentreId` (= `act:<activity>`; never affects Dr/Cr). This report splits the
 * income / expense legs of the counted vouchers by that tag; untagged vouchers fall in
 * "Unallocated / common". PURE.
 *
 * RULE 2: the caller passes the SAME voucher set and FY window the Trial Balance / P&L use
 * (counted + branch-scoped, fyStart..asOn). Column nets therefore sum to the voucher-based
 * surplus. The P&L can differ from it only by what no voucher carries (Trading closing /
 * opening stock) — the page shows that difference as its own unallocated line.
 */
import type { LedgerAccount, SocietyType, Voucher } from '@/types';
import type { Activity, ActivityDef } from '@/lib/navigation/activities';
import { ACTIVITY_CATALOG, ACTIVITY_CODES } from '@/lib/navigation/activities';
import { inferActivities } from '@/lib/navigation/activityInference';
import { getVoucherLines } from '@/lib/voucherUtils';

export const ACTIVITY_TAG_PREFIX = 'act:';
export const UNALLOCATED = '__unallocated__';

export const activityTag = (a: Activity): string => `${ACTIVITY_TAG_PREFIX}${a}`;

/** costCentreId → activity, or null for no / unknown / non-activity tags. */
export function activityOfTag(costCentreId: string | null | undefined): Activity | null {
  if (!costCentreId || !costCentreId.startsWith(ACTIVITY_TAG_PREFIX)) return null;
  const code = costCentreId.slice(ACTIVITY_TAG_PREFIX.length);
  return ACTIVITY_CODES.has(code as Activity) ? (code as Activity) : null;
}

/**
 * The activities a voucher can be tagged with. `primary` = the society's declared activities, else those
 * inferred from its type; `others` = the rest of the catalog. Tagging is a reporting dimension only (it never
 * changes a module or an entitlement), so a CM-PACS can tag CSC / godown / input-shop vouchers even though its
 * type template does not infer them. Catalog order in both lists.
 */
export function activityChoices(declared: readonly Activity[], societyType: SocietyType | undefined): { primary: ActivityDef[]; others: ActivityDef[] } {
  const pick = new Set<Activity>(declared.length ? declared : inferActivities(societyType ?? 'other'));
  return {
    primary: ACTIVITY_CATALOG.filter(a => pick.has(a.code)),
    others: ACTIVITY_CATALOG.filter(a => !pick.has(a.code)),
  };
}

export interface ActivityPLRow {
  accountId: string;
  name: string;
  nameHi?: string;
  kind: 'income' | 'expense';
  /** column key (activity code or UNALLOCATED) → amount in paise (income Cr−Dr, expense Dr−Cr) */
  byColumn: Record<string, number>;
  total: number;
}

export interface ActivityPLResult {
  /** activity codes that carry at least one amount, in catalog order, then UNALLOCATED if used */
  columns: string[];
  rows: ActivityPLRow[];
  income: Record<string, number>;
  expense: Record<string, number>;
  /** income − expense per column, paise */
  net: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
}

const paise = (x: number) => Math.round((Number(x) || 0) * 100);

export function computeActivityPL(input: {
  vouchers: readonly Voucher[];
  accounts: readonly LedgerAccount[];
  from?: string;   // inclusive, YYYY-MM-DD
  to?: string;     // inclusive
}): ActivityPLResult {
  const acc = new Map(input.accounts.map(a => [a.id, a]));
  const rows = new Map<string, ActivityPLRow>();
  const used = new Set<string>();

  for (const v of input.vouchers) {
    if (input.from && v.date < input.from) continue;
    if (input.to && v.date > input.to) continue;
    const col = activityOfTag(v.costCentreId) ?? UNALLOCATED;
    for (const l of getVoucherLines(v)) {
      const a = acc.get(l.accountId);
      if (!a || (a.type !== 'income' && a.type !== 'expense')) continue;
      const amt = paise(l.amount);
      if (!amt) continue;
      const signed = a.type === 'income' ? (l.type === 'Cr' ? amt : -amt) : (l.type === 'Dr' ? amt : -amt);
      let row = rows.get(a.id);
      if (!row) {
        row = { accountId: a.id, name: a.name, nameHi: a.nameHi, kind: a.type, byColumn: {}, total: 0 };
        rows.set(a.id, row);
      }
      row.byColumn[col] = (row.byColumn[col] ?? 0) + signed;
      row.total += signed;
      used.add(col);
    }
  }

  const columns = [
    ...ACTIVITY_CATALOG.map(a => a.code as string).filter(c => used.has(c)),
    ...(used.has(UNALLOCATED) ? [UNALLOCATED] : []),
  ];
  const income: Record<string, number> = {};
  const expense: Record<string, number> = {};
  const net: Record<string, number> = {};
  for (const c of columns) { income[c] = 0; expense[c] = 0; }
  const sorted = [...rows.values()]
    .filter(r => Object.values(r.byColumn).some(x => x !== 0))
    .sort((a, b) => (a.kind === b.kind ? a.accountId.localeCompare(b.accountId) : a.kind === 'income' ? -1 : 1));
  for (const r of sorted) {
    for (const c of columns) {
      const x = r.byColumn[c] ?? 0;
      if (r.kind === 'income') income[c] += x; else expense[c] += x;
    }
  }
  for (const c of columns) net[c] = income[c] - expense[c];
  const totalIncome = columns.reduce((s, c) => s + income[c], 0);
  const totalExpense = columns.reduce((s, c) => s + expense[c], 0);
  return { columns, rows: sorted, income, expense, net, totalIncome, totalExpense, totalNet: totalIncome - totalExpense };
}

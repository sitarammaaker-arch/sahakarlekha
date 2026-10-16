/**
 * Group Schedule / समूह अनुसूची (2026-10-16) — the party-wise list the cooperative audit attaches to the Balance Sheet
 * for every head ("LIST OF SUNDRY CREDITORS AS ON 31-03-2026").
 *
 * NO new balance logic (RULE 2): every figure is a ledger row of getTrialBalance(asOn) — opening = the brought-forward
 * balance at the FY start, debit / credit = the FY start .. as-on movements, closing = the TB net balance. So a
 * schedule's totals are, by construction, the Trial Balance's totals for the same group (`trialBalanceGroupTotals`
 * reads them through the TB's own groupWithSubtotals for the tie-out shown on the page).
 *
 *  • one section for the group's own ledgers, then one per immediate sub-group (with its subtotal); a deeper
 *    sub-group appears inside its section as a sub-heading carrying its subtotal (not summed again);
 *  • a ledger is hidden only when opening, debit, credit AND closing are all zero;
 *  • every amount keeps its own side (signed: Dr +, Cr −), so a Dr party in a creditor group shows Dr; totals give
 *    gross Dr, gross Cr and the net for opening and closing.
 * PURE.
 */
import type { AccountBalance, LedgerAccount } from '@/types';
import { groupWithSubtotals } from '@/lib/reports/groupSubtotals';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ZERO = 0.005;

export interface ScheduleTotals {
  opening: number;          // net, Dr + / Cr −
  openingDr: number;        // gross Dr of the ledgers' openings
  openingCr: number;        // gross Cr (positive)
  debit: number;
  credit: number;
  closing: number;          // net, Dr + / Cr −
  closingDr: number;
  closingCr: number;
}
export interface ScheduleRow {
  kind: 'ledger' | 'subhead';
  serial?: number;          // ledgers only, restarts per section
  accountId: string;
  nameEn: string;
  nameHi: string;
  depth: number;            // 0 = directly in the section
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}
export interface ScheduleSection { id: string; titleEn: string; titleHi: string; rows: ScheduleRow[]; total: ScheduleTotals }
export interface GroupSchedule { groupId: string; titleEn: string; titleHi: string; sections: ScheduleSection[]; grand: ScheduleTotals; ledgerCount: number }

const emptyTotals = (): ScheduleTotals => ({ opening: 0, openingDr: 0, openingCr: 0, debit: 0, credit: 0, closing: 0, closingDr: 0, closingCr: 0 });
const addRow = (t: ScheduleTotals, r: ScheduleRow) => {
  t.opening += r.opening; t.debit += r.debit; t.credit += r.credit; t.closing += r.closing;
  if (r.opening > 0) t.openingDr += r.opening; else t.openingCr -= r.opening;
  if (r.closing > 0) t.closingDr += r.closing; else t.closingCr -= r.closing;
};
const addTotals = (t: ScheduleTotals, s: ScheduleTotals) => { for (const k of Object.keys(t) as (keyof ScheduleTotals)[]) t[k] += s[k]; };
const round = (t: ScheduleTotals): ScheduleTotals => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, r2(v) || 0])) as unknown as ScheduleTotals;

export function buildGroupSchedule(trialBalance: readonly AccountBalance[], accounts: readonly LedgerAccount[], groupId: string): GroupSchedule {
  const group = accounts.find((a) => a.id === groupId);
  const byParent = new Map<string, AccountBalance[]>();
  for (const b of trialBalance) {
    if (b.account.isGroup && !b.postedToGroup) continue;
    const p = b.account.parentId;
    if (!p) continue;
    byParent.set(p, [...(byParent.get(p) ?? []), b]);
  }
  const subGroups = (pid: string) => accounts.filter((a) => a.isGroup && a.parentId === pid);
  const toRow = (b: AccountBalance, depth: number): ScheduleRow => ({
    kind: 'ledger', accountId: b.account.id, nameEn: b.account.name, nameHi: b.account.nameHi || '', depth,
    opening: r2((b.openingDebit || 0) - (b.openingCredit || 0)), debit: r2(b.transactionDebit || 0), credit: r2(b.transactionCredit || 0), closing: r2(b.netBalance || 0),
  });
  const visible = (r: ScheduleRow) => Math.abs(r.opening) >= ZERO || Math.abs(r.debit) >= ZERO || Math.abs(r.credit) >= ZERO || Math.abs(r.closing) >= ZERO;
  const byName = (x: AccountBalance, y: AccountBalance) => x.account.name.localeCompare(y.account.name, 'en', { sensitivity: 'base' });

  // Ledgers of a group (sorted by name), then each deeper sub-group as a sub-heading + its own rows; totals of leaves.
  const collect = (pid: string, depth: number, total: ScheduleTotals): ScheduleRow[] => {
    const out: ScheduleRow[] = [];
    for (const b of [...(byParent.get(pid) ?? [])].sort(byName)) {
      const r = toRow(b, depth);
      if (!visible(r)) continue;
      addRow(total, r); out.push(r);
    }
    for (const g of subGroups(pid)) {
      const sub = emptyTotals();
      const rows = collect(g.id, depth + 1, sub);
      if (!rows.some((x) => x.kind === 'ledger')) continue;
      const s = round(sub);
      out.push({ kind: 'subhead', accountId: g.id, nameEn: g.name, nameHi: g.nameHi || '', depth, opening: s.opening, debit: s.debit, credit: s.credit, closing: s.closing });
      out.push(...rows);
      addTotals(total, sub);
    }
    return out;
  };
  const number = (rows: ScheduleRow[]) => { let n = 0; for (const r of rows) if (r.kind === 'ledger') r.serial = ++n; return rows; };

  const sections: ScheduleSection[] = [];
  const directTotal = emptyTotals();
  const direct: ScheduleRow[] = [];
  for (const b of [...(byParent.get(groupId) ?? [])].sort(byName)) {
    const r = toRow(b, 0);
    if (visible(r)) { addRow(directTotal, r); direct.push(r); }
  }
  if (direct.length) sections.push({ id: groupId, titleEn: group?.name ?? groupId, titleHi: group?.nameHi || group?.name || groupId, rows: number(direct), total: round(directTotal) });
  for (const g of subGroups(groupId)) {
    const t = emptyTotals();
    const rows = collect(g.id, 0, t);
    if (!rows.some((x) => x.kind === 'ledger')) continue;
    sections.push({ id: g.id, titleEn: g.name, titleHi: g.nameHi || g.name, rows: number(rows), total: round(t) });
  }
  if (direct.length && sections.length > 1) { sections[0].titleEn += ' — direct ledgers'; sections[0].titleHi += ' — सीधे खाते'; }
  const grand = emptyTotals();
  for (const s of sections) addTotals(grand, s.total);
  return {
    groupId, titleEn: group?.name ?? groupId, titleHi: group?.nameHi || group?.name || groupId,
    sections, grand: round(grand), ledgerCount: sections.reduce((n, s) => n + s.rows.filter((r) => r.kind === 'ledger').length, 0),
  };
}

/** The Balance Sheet heads — the groups directly under the asset / liability / equity roots (the same heads the
 *  Balance Sheet prints), plus any other root-level balance-sheet group. Chart order. */
export function balanceSheetHeads(accounts: readonly LedgerAccount[]): LedgerAccount[] {
  const bsType = (t: string) => t === 'asset' || t === 'liability' || t === 'equity';
  const roots = new Set(accounts.filter((a) => a.isGroup && !a.parentId && bsType(a.type)).map((a) => a.id));
  const std = new Set(['1000', '2000', '3000']);
  return accounts.filter((a) => a.isGroup && bsType(a.type) && ((a.parentId && roots.has(a.parentId)) || (!a.parentId && !std.has(a.id))));
}

/** Every Balance Sheet head that has at least one ledger to list ("सारी schedules एक साथ"). */
export function allBalanceSheetSchedules(trialBalance: readonly AccountBalance[], accounts: readonly LedgerAccount[]): GroupSchedule[] {
  return balanceSheetHeads(accounts).map((h) => buildGroupSchedule(trialBalance, accounts, h.id)).filter((s) => s.ledgerCount > 0);
}

/** The Trial Balance's OWN subtotal for a group (through the TB page's groupWithSubtotals) — the tie-out reference. */
export function trialBalanceGroupTotals(trialBalance: readonly AccountBalance[], accounts: readonly LedgerAccount[], groupId: string): { opening: number; debit: number; credit: number; closing: number } | null {
  const lines = trialBalance.filter((b) => !b.account.isGroup || b.postedToGroup).map((b) => ({
    name: b.account.name, amount: b.netBalance, parentId: b.account.parentId,
    vals: [(b.openingDebit || 0) - (b.openingCredit || 0), b.transactionDebit || 0, b.transactionCredit || 0],
  }));
  const rows = groupWithSubtotals(lines, accounts, []);
  const g = rows.find((r) => r.kind === 'group' && r.groupId === groupId);
  if (!g) return null;
  return { opening: r2(g.vals?.[0] ?? 0), debit: r2(g.vals?.[1] ?? 0), credit: r2(g.vals?.[2] ?? 0), closing: r2(g.amount) };
}

/** Flat rows for Excel / CSV — the same rows the screen and PDF print. */
export const SCHEDULE_HEADERS = ['क्रम / Sr', 'नाम (English)', 'नाम (हिंदी)', 'Opening', 'Opening Dr/Cr', 'Debit', 'Credit', 'Closing', 'Closing Dr/Cr'];
const side = (n: number) => (n > ZERO ? 'Dr' : n < -ZERO ? 'Cr' : '');
export function scheduleSheetRows(s: GroupSchedule): (string | number)[][] {
  const out: (string | number)[][] = [];
  const amt = (n: number) => (Math.abs(n) >= ZERO ? r2(Math.abs(n)) : '');
  const line = (label: string, labelHi: string, t: Pick<ScheduleTotals, 'opening' | 'debit' | 'credit' | 'closing'>, serial: string | number = '') =>
    [serial, label, labelHi, amt(t.opening), side(t.opening), amt(t.debit), amt(t.credit), amt(t.closing), side(t.closing)];
  for (const sec of s.sections) {
    out.push(['', sec.titleEn.toUpperCase(), sec.titleHi, '', '', '', '', '', '']);
    for (const r of sec.rows) {
      const pad = '  '.repeat(r.depth);
      out.push(r.kind === 'subhead' ? line(`${pad}${r.nameEn} (sub-total)`, `${pad}${r.nameHi} (उप-योग)`, r) : line(`${pad}${r.nameEn}`, `${pad}${r.nameHi}`, r, r.serial ?? ''));
    }
    out.push(line(`Total — ${sec.titleEn}`, `योग — ${sec.titleHi}`, sec.total));
  }
  const g = s.grand;
  out.push(line(`GRAND TOTAL — ${s.titleEn}`, `कुल योग — ${s.titleHi}`, g));
  out.push(['', 'Gross Dr / Gross Cr (Opening)', 'कुल Dr / कुल Cr (Opening)', r2(g.openingDr), 'Dr', '', '', r2(g.openingCr), 'Cr']);
  out.push(['', 'Gross Dr / Gross Cr (Closing)', 'कुल Dr / कुल Cr (Closing)', r2(g.closingDr), 'Dr', '', '', r2(g.closingCr), 'Cr']);
  return out;
}

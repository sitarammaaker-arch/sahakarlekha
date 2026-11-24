/**
 * Member / non-member turnover (सदस्य / गैर-सदस्य कारोबार).
 *
 * WHY: a co-operative's income-tax deduction for marketing its members' produce and for supplying agricultural
 * inputs to its members (Income-tax Act 2025 s.149, formerly 1961 Act s.80P(2)(a)(iii)/(iv)) depends on whether the
 * other side of each purchase / sale was a member. The HAFED Accounts Manual (1976, para 10.1 and heads 31.10/31.11,
 * 32.02–32.05) keeps member and non-member business apart for exactly this reason. This report gives the split; it
 * does not compute the deduction.
 *
 * WHAT IT COUNTS:
 *   - a bill is a member's when it carries memberId (sale: sales.memberId; purchase: purchases.memberId, mig 202);
 *   - nominal and associate members are a column of their own — the Act does not define "member", so the
 *     auditor decides, not the app;
 *   - the value is the TAXABLE value (after the bill discount, before GST), spread over the bill's item lines in
 *     exact paise (allocateMinor) and grouped by each item's sales / purchase account (RULE 4 routing, same
 *     fallback 4101 / 5101 as the posting);
 *   - returns are subtracted in the class of their original bill (a sales return's own memberId wins if set);
 *   - soft-deleted bills and returns are left out (RULE 5). Dates are inclusive, ISO strings.
 *
 * PURE → unit-tested by scripts/test-member-turnover.mjs.
 */
import { allocateMinor, toMinor, toRupees } from '@/lib/money';

export type TurnoverClass = 'member' | 'nominal' | 'nonMember';

interface LineLike { itemId: string; amount: number }
interface BillLike { id: string; date: string; items: LineLike[]; netAmount: number; memberId?: string; isDeleted?: boolean }
interface SaleReturnLike { date: string; originalSaleId: string; items: LineLike[]; netAmount: number; memberId?: string; isDeleted?: boolean }
interface PurchaseReturnLike { date: string; originalPurchaseId: string; items: LineLike[]; netAmount: number; isDeleted?: boolean }
interface MemberLike { id: string; memberType?: string }
interface ItemLike { id: string; salesAccountId?: string; purchaseAccountId?: string }
interface AccountLike { id: string; name: string; nameHi?: string }

export interface TurnoverRow {
  accountId: string;
  accountName: string;
  accountNameHi?: string;
  member: number;
  nominal: number;
  nonMember: number;
  total: number;
}

export interface TurnoverSide {
  rows: TurnoverRow[];
  totals: { member: number; nominal: number; nonMember: number; total: number };
  bills: { member: number; nominal: number; nonMember: number };
}

export interface MemberTurnover {
  sales: TurnoverSide;
  purchases: TurnoverSide;
  /** Bills whose memberId names no member row (deleted long ago). Counted as members — the tag is the evidence. */
  unmatchedMemberBills: number;
}

export interface MemberTurnoverInput {
  sales: readonly BillLike[];
  purchases: readonly BillLike[];
  salesReturns?: readonly SaleReturnLike[];
  purchaseReturns?: readonly PurchaseReturnLike[];
  members: readonly MemberLike[];
  stockItems: readonly ItemLike[];
  accounts: readonly AccountLike[];
  from?: string;
  to?: string;
}

/** The class of a bill's other side. No memberId = non-member. */
export function classifyMember(memberId: string | undefined, members: readonly MemberLike[]): { cls: TurnoverClass; unmatched: boolean } {
  if (!memberId) return { cls: 'nonMember', unmatched: false };
  const m = members.find(x => x.id === memberId);
  if (!m) return { cls: 'member', unmatched: true };
  return { cls: m.memberType === 'nominal' || m.memberType === 'associate' ? 'nominal' : 'member', unmatched: false };
}

/** A bill's taxable value split across its lines by line amount, in exact paise; grouped by account. */
function valueByAccount(items: readonly LineLike[], netAmount: number, accountOf: (itemId: string) => string): Map<string, number> {
  const out = new Map<string, number>();
  if (!items.length) return out;
  const parts = allocateMinor(toMinor(Number(netAmount) || 0), items.map(i => Number(i.amount) || 0));
  items.forEach((it, i) => {
    const acc = accountOf(it.itemId);
    out.set(acc, (out.get(acc) ?? 0) + parts[i]);
  });
  return out;
}

const inWindow = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date <= to);

export function buildMemberTurnover(input: MemberTurnoverInput): MemberTurnover {
  const { members, stockItems, accounts, from, to } = input;
  const itemById = new Map(stockItems.map(s => [s.id, s]));
  const saleAcc = (itemId: string) => itemById.get(itemId)?.salesAccountId || '4101';
  const purAcc = (itemId: string) => itemById.get(itemId)?.purchaseAccountId || '5101';
  let unmatched = 0;

  const side = () => ({ minor: new Map<string, Record<TurnoverClass, number>>(), bills: { member: 0, nominal: 0, nonMember: 0 } });
  const add = (s: ReturnType<typeof side>, byAcc: Map<string, number>, cls: TurnoverClass, sign: 1 | -1) => {
    byAcc.forEach((minor, acc) => {
      const cell = s.minor.get(acc) ?? { member: 0, nominal: 0, nonMember: 0 };
      cell[cls] += sign * minor;
      s.minor.set(acc, cell);
    });
  };

  const salesSide = side();
  const saleById = new Map(input.sales.map(s => [s.id, s]));
  for (const s of input.sales) {
    if (s.isDeleted || !inWindow(s.date, from, to)) continue;
    const c = classifyMember(s.memberId, members);
    if (c.unmatched) unmatched++;
    salesSide.bills[c.cls]++;
    add(salesSide, valueByAccount(s.items, s.netAmount, saleAcc), c.cls, 1);
  }
  for (const r of input.salesReturns ?? []) {
    if (r.isDeleted || !inWindow(r.date, from, to)) continue;
    const c = classifyMember(r.memberId || saleById.get(r.originalSaleId)?.memberId, members);
    add(salesSide, valueByAccount(r.items, r.netAmount, saleAcc), c.cls, -1);
  }

  const purSide = side();
  const purById = new Map(input.purchases.map(p => [p.id, p]));
  for (const p of input.purchases) {
    if (p.isDeleted || !inWindow(p.date, from, to)) continue;
    const c = classifyMember(p.memberId, members);
    if (c.unmatched) unmatched++;
    purSide.bills[c.cls]++;
    add(purSide, valueByAccount(p.items, p.netAmount, purAcc), c.cls, 1);
  }
  for (const r of input.purchaseReturns ?? []) {
    if (r.isDeleted || !inWindow(r.date, from, to)) continue;
    const c = classifyMember(purById.get(r.originalPurchaseId)?.memberId, members);
    add(purSide, valueByAccount(r.items, r.netAmount, purAcc), c.cls, -1);
  }

  const finish = (s: ReturnType<typeof side>): TurnoverSide => {
    const tot = { member: 0, nominal: 0, nonMember: 0 };
    const rows: TurnoverRow[] = [...s.minor.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([accountId, cell]) => {
        tot.member += cell.member; tot.nominal += cell.nominal; tot.nonMember += cell.nonMember;
        const acc = accounts.find(a => a.id === accountId);
        return {
          accountId,
          accountName: acc?.name ?? accountId,
          accountNameHi: acc?.nameHi,
          member: toRupees(cell.member),
          nominal: toRupees(cell.nominal),
          nonMember: toRupees(cell.nonMember),
          total: toRupees(cell.member + cell.nominal + cell.nonMember),
        };
      });
    return {
      rows,
      totals: { member: toRupees(tot.member), nominal: toRupees(tot.nominal), nonMember: toRupees(tot.nonMember), total: toRupees(tot.member + tot.nominal + tot.nonMember) },
      bills: s.bills,
    };
  };

  return { sales: finish(salesSide), purchases: finish(purSide), unmatchedMemberBills: unmatched };
}

/** Share of the total that is members' (regular members only), 0–100, one decimal. 0 when there is no turnover. */
export function memberSharePct(t: TurnoverSide['totals']): number {
  return t.total > 0 ? Math.round((t.member / t.total) * 1000) / 10 : 0;
}

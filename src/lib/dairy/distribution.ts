/**
 * Dairy year-end distribution (pure, tested) — patronage bonus & dividend computation + legs.
 *
 * Bonus (patronage): per member, base = accepted milk litres (per_litre) or value (per_value) in
 * [from,to]; amount = base × rate. Dividend: per member, base = paid-up share capital; amount =
 * base × rate% / 100. The approval voucher is one appropriation entry — Dr distribution equity /
 * Cr payable, for the total (∑ lines). Balanced; [] if total ≤ 0 or an account is missing.
 */
import type { MilkEntry, DairyDistributionLine, DairyBonusBasis } from '@/types';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Patronage bonus lines from accepted milk in the window. rate = ₹/litre or fraction of value. */
export function computeBonusLines(
  entries: ReadonlyArray<MilkEntry>,
  from: string,
  to: string,
  basis: DairyBonusBasis,
  rate: number,
): DairyDistributionLine[] {
  const agg = new Map<string, { name: string; base: number }>();
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    if (e.qualityDecision === 'rejected') continue;
    const add = basis === 'per_value' ? (e.amount || 0) : (e.qty || 0);
    const cur = agg.get(e.memberId) || { name: e.memberName, base: 0 };
    cur.base += add;
    agg.set(e.memberId, cur);
  }
  return [...agg.entries()]
    .map(([memberId, v]) => ({ memberId, memberName: v.name, base: round2(v.base), amount: round2(v.base * (rate || 0)) }))
    .filter(l => l.amount > 0)
    .sort((a, b) => a.memberName.localeCompare(b.memberName));
}

/** Dividend lines from paid-up share capital. ratePct = % of share capital. */
export function computeDividendLines(
  members: ReadonlyArray<{ id: string; name: string; shareCapital?: number; status?: string }>,
  ratePct: number,
): DairyDistributionLine[] {
  return members
    .map(m => ({ memberId: m.id, memberName: m.name, base: round2(m.shareCapital || 0), amount: round2((m.shareCapital || 0) * (ratePct || 0) / 100) }))
    .filter(l => l.amount > 0)
    .sort((a, b) => a.memberName.localeCompare(b.memberName));
}

export const distributionTotal = (lines: ReadonlyArray<DairyDistributionLine>): number =>
  round2(lines.reduce((s, l) => s + (l.amount || 0), 0));

export interface DistributionLeg { accountId: string; type: 'Dr' | 'Cr'; amount: number; }
/** One appropriation entry: Dr distribution equity / Cr payable, for the total. [] if invalid. */
export function distributionLegs(total: number, distributionAccountId: string, payableAccountId: string): DistributionLeg[] {
  const t = round2(total);
  if (!(t > 0) || !distributionAccountId || !payableAccountId) return [];
  return [
    { accountId: distributionAccountId, type: 'Dr', amount: t },
    { accountId: payableAccountId, type: 'Cr', amount: t },
  ];
}

export const distributionOutstanding = (total: number, amountPaid: number): number =>
  round2(Math.max(0, total - (amountPaid || 0)));

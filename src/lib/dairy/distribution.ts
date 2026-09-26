/**
 * Dairy year-end distribution (pure, tested) — patronage bonus & dividend computation + legs.
 *
 * Bonus (patronage): per member, base = accepted milk litres (per_litre) or value (per_value) in
 * [from,to]; amount = base × rate. Dividend: per member, base = paid-up share capital; amount =
 * base × rate% / 100. The approval voucher is one appropriation entry — Dr distribution equity /
 * Cr payable, for the total (∑ lines). Balanced; [] if total ≤ 0 or an account is missing.
 *
 * Only the dairy BASIS (milk) lives here; lines, total, legs and outstanding come from the shared
 * member distribution engine (lib/distribution/engine.ts), same as consumer.
 */
import type { MilkEntry, DairyDistributionLine, DairyBonusBasis } from '@/types';
import { round2, activeMembers, linesFromBases, linesTotal, appropriationLegs, outstandingOf, type DistributionLeg as EngineLeg } from '../distribution/engine';

export { round2 };

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
  // The bonus is computed on the UNROUNDED milk base (displayed base is rounded).
  return linesFromBases(
    [...agg.entries()].map(([memberId, v]) => ({ memberId, memberName: v.name, base: v.base })),
    (base) => base * (rate || 0),
  );
}

/** Dividend lines from paid-up share capital of ACTIVE members. ratePct = % of share capital. */
export function computeDividendLines(
  members: ReadonlyArray<{ id: string; name: string; shareCapital?: number; status?: string }>,
  ratePct: number,
): DairyDistributionLine[] {
  // Exclude inactive/exited members; dividend on the UNROUNDED capital (as before).
  return linesFromBases(
    activeMembers(members).map((m) => ({ memberId: m.id, memberName: m.name, base: m.shareCapital || 0 })),
    (base) => base * (ratePct || 0) / 100,
  );
}

export const distributionTotal = (lines: ReadonlyArray<DairyDistributionLine>): number => linesTotal(lines);

export type DistributionLeg = EngineLeg;
/** One appropriation entry: Dr distribution equity / Cr payable, for the total. [] if invalid. */
export const distributionLegs = (total: number, distributionAccountId: string, payableAccountId: string): DistributionLeg[] =>
  appropriationLegs(total, distributionAccountId, payableAccountId);

export const distributionOutstanding = (total: number, amountPaid: number): number => outstandingOf(total, amountPaid);

/**
 * Consumer C4 — year-end patronage rebate (pure, tested).
 *
 * A cooperative store returns surplus to members in proportion to their PATRONAGE (purchases),
 * not their shares. Per active member, base = Σ their sale values (any tender) in [from,to];
 * amount = base × ratePct/100. The approval voucher is one appropriation entry —
 * Dr patronage-distribution (equity) / Cr member-rebate-payable — for the total.
 *
 * Only the consumer BASIS (net purchases) lives here; lines, total, legs and outstanding come from
 * the shared member distribution engine (lib/distribution/engine.ts), same as dairy.
 */
import type { PatronageLine } from '@/types';
import { round2, activeMembers, linesFromBases, linesTotal, appropriationLegs, outstandingOf, type DistributionLeg } from '../distribution/engine';

export { round2 };

const saleValue = (s: { grandTotal?: number; netAmount?: number }): number =>
  typeof s.grandTotal === 'number' && s.grandTotal > 0 ? s.grandTotal : (s.netAmount || 0);

/** Per-active-member rebate on NET purchases (sales − returns) in [from,to]. ratePct = %. */
export function computePatronageLines(
  sales: ReadonlyArray<{ memberId?: string; grandTotal?: number; netAmount?: number; date: string }>,
  members: ReadonlyArray<{ id: string; name: string; status?: string }>,
  args: { from: string; to: string; ratePct: number },
  returns: ReadonlyArray<{ memberId?: string; grandTotal?: number; date: string; isDeleted?: boolean }> = [],
): PatronageLine[] {
  const purchase = new Map<string, number>();
  for (const s of sales) {
    if (!s.memberId) continue;
    if (s.date < args.from || s.date > args.to) continue;
    purchase.set(s.memberId, (purchase.get(s.memberId) || 0) + saleValue(s));
  }
  // Returns reduce turnover so a member is not rebated on goods they returned.
  for (const r of returns) {
    if (!r.memberId || r.isDeleted) continue;
    if (r.date < args.from || r.date > args.to) continue;
    purchase.set(r.memberId, (purchase.get(r.memberId) || 0) - (r.grandTotal || 0));
  }
  // The rebate is computed on the ROUNDED net purchase (members on the rolls only).
  return linesFromBases(
    activeMembers(members).map((m) => ({ memberId: m.id, memberName: m.name, base: round2(Math.max(0, purchase.get(m.id) || 0)) })),
    (base) => base * (args.ratePct || 0) / 100,
  );
}

/** Dividend lines: ratePct% of paid-up share capital of ACTIVE members (on the rounded capital). */
export function computeDividendLines(
  members: ReadonlyArray<{ id: string; name: string; shareCapital?: number; status?: string }>,
  ratePct: number,
): PatronageLine[] {
  return linesFromBases(
    activeMembers(members).map((m) => ({ memberId: m.id, memberName: m.name, base: round2(m.shareCapital || 0) })),
    (base) => base * (ratePct || 0) / 100,
  );
}

export const patronageTotal = (lines: ReadonlyArray<PatronageLine>): number => linesTotal(lines);

export type PatronageLeg = DistributionLeg;
/** One appropriation entry: Dr patronage distribution / Cr member rebate payable. [] if invalid. */
export const patronageLegs = (total: number, distributionAccountId: string, payableAccountId: string): PatronageLeg[] =>
  appropriationLegs(total, distributionAccountId, payableAccountId);

export const patronageOutstanding = (total: number, amountPaid: number): number => outstandingOf(total, amountPaid);

/**
 * Consumer C4 — year-end patronage rebate (pure, tested).
 *
 * A cooperative store returns surplus to members in proportion to their PATRONAGE (purchases),
 * not their shares. Per active member, base = Σ their sale values (any tender) in [from,to];
 * amount = base × ratePct/100. The approval voucher is one appropriation entry —
 * Dr patronage-distribution (equity) / Cr member-rebate-payable — for the total. Mirrors the
 * Dairy distribution shapes but keyed off SALES (turnover), and stays self-contained (no
 * cross-import from the dairy domain).
 */
import type { PatronageLine } from '@/types';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const saleValue = (s: { grandTotal?: number; netAmount?: number }): number =>
  typeof s.grandTotal === 'number' && s.grandTotal > 0 ? s.grandTotal : (s.netAmount || 0);

/** Per-active-member rebate on purchases in [from,to]. ratePct = % of purchase value. */
export function computePatronageLines(
  sales: ReadonlyArray<{ memberId?: string; grandTotal?: number; netAmount?: number; date: string }>,
  members: ReadonlyArray<{ id: string; name: string; status?: string }>,
  args: { from: string; to: string; ratePct: number },
): PatronageLine[] {
  const purchase = new Map<string, number>();
  for (const s of sales) {
    if (!s.memberId) continue;
    if (s.date < args.from || s.date > args.to) continue;
    purchase.set(s.memberId, (purchase.get(s.memberId) || 0) + saleValue(s));
  }
  return members
    .filter(m => !(m.status && m.status !== 'active'))   // members on the rolls only
    .map(m => {
      const base = round2(purchase.get(m.id) || 0);
      return { memberId: m.id, memberName: m.name, base, amount: round2(base * (args.ratePct || 0) / 100) };
    })
    .filter(l => l.amount > 0)
    .sort((a, b) => a.memberName.localeCompare(b.memberName));
}

/** Dividend lines: ratePct% of paid-up share capital of ACTIVE members. */
export function computeDividendLines(
  members: ReadonlyArray<{ id: string; name: string; shareCapital?: number; status?: string }>,
  ratePct: number,
): PatronageLine[] {
  return members
    .filter(m => !(m.status && m.status !== 'active'))
    .map(m => {
      const base = round2(m.shareCapital || 0);
      return { memberId: m.id, memberName: m.name, base, amount: round2(base * (ratePct || 0) / 100) };
    })
    .filter(l => l.amount > 0)
    .sort((a, b) => a.memberName.localeCompare(b.memberName));
}

export const patronageTotal = (lines: ReadonlyArray<PatronageLine>): number =>
  round2(lines.reduce((s, l) => s + (l.amount || 0), 0));

export interface PatronageLeg { accountId: string; type: 'Dr' | 'Cr'; amount: number; }
/** One appropriation entry: Dr patronage distribution / Cr member rebate payable. [] if invalid. */
export function patronageLegs(total: number, distributionAccountId: string, payableAccountId: string): PatronageLeg[] {
  const t = round2(total);
  if (!(t > 0) || !distributionAccountId || !payableAccountId) return [];
  return [
    { accountId: distributionAccountId, type: 'Dr', amount: t },
    { accountId: payableAccountId, type: 'Cr', amount: t },
  ];
}

export const patronageOutstanding = (total: number, amountPaid: number): number =>
  round2(Math.max(0, total - (amountPaid || 0)));

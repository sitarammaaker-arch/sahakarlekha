/**
 * Member distribution engine — ONE engine for every year-end distribution to members
 * (patronage rebate, patronage bonus, dividend), whatever the society type. PURE.
 *
 *   base per member (purchases, milk, share capital, …)  ×  rate  =  that member's line
 *
 * Each vertical only supplies its BASIS (consumer: net purchases; dairy: milk litres / value;
 * all: paid-up share capital) — the line shape, rounding, ordering, total, approval legs and
 * outstanding are defined once here. Consumer (lib/consumer/patronage.ts) and dairy
 * (lib/dairy/distribution.ts) delegate to it; the general Profit Distribution and future bases
 * (PACS interest rebate, labour wages) will too. Behaviour is byte-identical to the two engines it
 * replaces (test:distribution-engine pins that against verbatim copies).
 */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface DistributionLine { memberId: string; memberName: string; base: number; amount: number }
export interface MemberBase { memberId: string; memberName: string; base: number }
export interface DistributionLeg { accountId: string; type: 'Dr' | 'Cr'; amount: number }

/** Members on the rolls: no status, or 'active' (resigned / expelled / deceased / inactive excluded). */
export function activeMembers<M extends { status?: string }>(members: ReadonlyArray<M>): M[] {
  return members.filter((m) => !(m.status && m.status !== 'active'));
}

/**
 * Lines from per-member bases: base = round2(raw), amount = round2(amountOf(raw)); zero lines
 * dropped; sorted by member name. The caller decides whether `raw` is pre-rounded — the two
 * original engines differed there, and each keeps its own choice.
 */
export function linesFromBases(bases: Iterable<MemberBase>, amountOf: (rawBase: number) => number): DistributionLine[] {
  const out: DistributionLine[] = [];
  for (const b of bases) out.push({ memberId: b.memberId, memberName: b.memberName, base: round2(b.base), amount: round2(amountOf(b.base)) });
  return out.filter((l) => l.amount > 0).sort((a, b) => a.memberName.localeCompare(b.memberName));
}

export const linesTotal = (lines: ReadonlyArray<{ amount: number }>): number =>
  round2(lines.reduce((s, l) => s + (l.amount || 0), 0));

/** One appropriation entry for the total: Dr distribution (equity) / Cr payable. [] if invalid. */
export function appropriationLegs(total: number, distributionAccountId: string, payableAccountId: string): DistributionLeg[] {
  const t = round2(total);
  if (!(t > 0) || !distributionAccountId || !payableAccountId) return [];
  return [
    { accountId: distributionAccountId, type: 'Dr', amount: t },
    { accountId: payableAccountId, type: 'Cr', amount: t },
  ];
}

export const outstandingOf = (total: number, amountPaid: number): number =>
  round2(Math.max(0, total - (amountPaid || 0)));

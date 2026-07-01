/**
 * Housing — maintenance bill computation (PURE). Turns a flat + the society charge-head
 * schedule into per-head bill lines, and those lines into balanced double-entry demand legs.
 * NO React / Supabase / storage / side effects — so it is unit-testable and the same math
 * runs in the bill-run and in any preview/PDF. The demand posts Dr <member receivable> for the
 * total and Cr each head's OWN target account (income → I&E, fund → 1202/1204 corpus directly,
 * pass-through → liability), which is how the "direct to fund" policy is realised.
 */
import type { HousingFlat, HousingChargeHead, MaintenanceBillLine } from '@/types';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Amount (₹) for one head on one flat. A per-flat override REPLACES the schedule amount;
 * override 0 means the head does not apply to this flat (e.g. no parking). Negatives clamp to 0.
 */
export function chargeHeadAmount(head: HousingChargeHead, flat: HousingFlat): number {
  const override = flat.chargeOverrides ? flat.chargeOverrides[head.id] : undefined;
  if (override !== undefined && override !== null) return round2(Math.max(0, override));
  const base = head.basis === 'per_sqft' ? head.rate * (flat.area || 0) : head.rate;
  return round2(Math.max(0, base || 0));
}

/** Active, non-deleted heads (schedule order) turned into positive bill lines for one flat. */
export function computeBillLines(flat: HousingFlat, heads: HousingChargeHead[]): MaintenanceBillLine[] {
  return heads
    .filter(h => !h.isDeleted && h.isActive !== false)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(h => ({ chargeHeadId: h.id, name: h.nameEn || h.nameHi, accountId: h.accountId, isFund: !!h.isFund, amount: chargeHeadAmount(h, flat) }))
    .filter(l => l.amount > 0);
}

/** Total (₹) of a set of bill lines. */
export const billTotal = (lines: MaintenanceBillLine[]): number =>
  round2(lines.reduce((s, l) => s + l.amount, 0));

/**
 * Balanced demand legs: Dr <receivable> for the total, Cr each distinct target account (grouped).
 * Returns [] for a zero/empty bill so the caller skips posting. ∑Dr === ∑Cr by construction.
 */
export function demandLegs(
  receivableAccountId: string,
  lines: MaintenanceBillLine[],
): { accountId: string; type: 'Dr' | 'Cr'; amount: number }[] {
  const total = billTotal(lines);
  if (total <= 0) return [];
  const byAcc = new Map<string, number>();
  for (const l of lines) byAcc.set(l.accountId, round2((byAcc.get(l.accountId) || 0) + l.amount));
  const legs: { accountId: string; type: 'Dr' | 'Cr'; amount: number }[] = [
    { accountId: receivableAccountId, type: 'Dr', amount: total },
  ];
  for (const [accountId, amount] of byAcc) legs.push({ accountId, type: 'Cr', amount });
  return legs;
}

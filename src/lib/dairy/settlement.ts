/**
 * Dairy farmer settlement (pure, tested) — periodic per-member cycle math.
 *
 * gross   = Σ the member's ACCEPTED milk amount in [from,to] (rejected entries excluded).
 * net     = gross − Σ deduction amounts (recoveries).
 * legs    = the balanced compound voucher posted at approval:
 *             Dr milk-cost (gross) / Cr payable (net, if >0) / Cr each recovery account.
 * No React / Supabase / storage — data in, data out.
 */
import type { MilkEntry, DairyDeductionLine } from '@/types';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Σ the member's accepted milk value over the cycle (rejected entries excluded; deleted ignored). */
export function computeGross(entries: ReadonlyArray<MilkEntry>, memberId: string, from: string, to: string): number {
  let g = 0;
  for (const e of entries) {
    if (e.memberId !== memberId) continue;
    if (e.date < from || e.date > to) continue;
    if (e.qualityDecision === 'rejected') continue;
    g += e.amount || 0;
  }
  return round2(g);
}

export const sumDeductions = (lines: ReadonlyArray<DairyDeductionLine>): number =>
  round2(lines.reduce((s, l) => s + (l.amount || 0), 0));

export const netPayable = (gross: number, lines: ReadonlyArray<DairyDeductionLine>): number =>
  round2(gross - sumDeductions(lines));

export const outstanding = (net: number, amountPaid: number): number =>
  round2(Math.max(0, net - (amountPaid || 0)));

export interface SettlementLeg { accountId: string; type: 'Dr' | 'Cr'; amount: number; }

/**
 * Balanced compound legs for the approval voucher. Dr milk cost = gross; Cr payable = net (only
 * if > 0); Cr each recovery account = its amount. ∑Dr = ∑Cr = gross. Returns [] if gross ≤ 0 or
 * a deduction has no account (caller must not post an unbalanced/unresolved voucher).
 */
export function settlementLegs(
  gross: number,
  lines: ReadonlyArray<DairyDeductionLine>,
  milkCostAccountId: string,
  payableAccountId: string,
): SettlementLeg[] {
  const g = round2(gross);
  if (!(g > 0) || !milkCostAccountId || !payableAccountId) return [];
  if (lines.some(l => !l.accountId || !(l.amount > 0))) return [];
  const net = netPayable(g, lines);
  if (net < -0.005) return [];                       // deductions exceed gross — invalid
  const legs: SettlementLeg[] = [{ accountId: milkCostAccountId, type: 'Dr', amount: g }];
  if (net > 0.005) legs.push({ accountId: payableAccountId, type: 'Cr', amount: net });
  for (const l of lines) legs.push({ accountId: l.accountId, type: 'Cr', amount: round2(l.amount) });
  return legs;
}

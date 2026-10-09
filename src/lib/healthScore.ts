/**
 * Dashboard health score (0–100) — rules re-set 2026-10-09 (founder: "go with your suggestion").
 *
 * Only facts the books can PROVE count, each one a check the user can act on:
 *   • Balance Sheet tallies                         25
 *   • share capital: member register = ledger       20
 *   • fixed assets: asset register = ledger         15
 *   • no overdue loan                               20   (n/a when the society has no loans)
 *   • no pending audit objection                    20   (n/a when there are none)
 * A check that does not apply is left out of BOTH earned and max, so it neither helps nor hurts.
 *
 * Deliberately NOT scored (they stay as advisories): the reserve-fund appropriation (optional, year-end,
 * % varies by state / bye-laws), the "10× owned funds" loan ceiling (not from any Act — bye-law dependent),
 * and closing stock (it was a hard-coded pass worth free points).
 */
export interface HealthInputs {
  bsTallied: boolean;
  shareReconciled: boolean;
  /** Is there any share capital at all (register or ledger)? */
  shareApplies: boolean;
  assetReconciled: boolean;
  /** Is there any fixed asset at all (register or ledger)? */
  assetApplies: boolean;
  loanCount: number;
  overdueLoans: number;
  objectionCount: number;
  pendingObjections: number;
}

export interface HealthCheck { key: 'bs' | 'share' | 'asset' | 'overdue' | 'objections'; points: number; applies: boolean; ok: boolean }

export function healthChecks(i: HealthInputs): HealthCheck[] {
  return [
    { key: 'bs', points: 25, applies: true, ok: i.bsTallied },
    { key: 'share', points: 20, applies: i.shareApplies, ok: i.shareReconciled },
    { key: 'asset', points: 15, applies: i.assetApplies, ok: i.assetReconciled },
    { key: 'overdue', points: 20, applies: i.loanCount > 0, ok: i.overdueLoans === 0 },
    { key: 'objections', points: 20, applies: i.objectionCount > 0, ok: i.pendingObjections === 0 },
  ];
}

export function healthScore(i: HealthInputs): number {
  let earned = 0, max = 0;
  for (const c of healthChecks(i)) {
    if (!c.applies) continue;
    max += c.points;
    if (c.ok) earned += c.points;
  }
  return max > 0 ? Math.round((earned / max) * 100) : 100;
}

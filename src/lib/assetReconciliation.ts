/**
 * Asset-register control-vs-subsidiary reconciliation (ECR-05, asset side).
 *
 * Fixed-asset cost lives in two places that must agree:
 *   • SUBSIDIARY — Σ asset.cost in the Asset Register (per-asset).
 *   • CONTROL    — the fixed-asset ledger accounts' gross-cost balance (from vouchers).
 * The Balance Sheet reads the control; the register drives depreciation/disposal. If they
 * drift, the register and the audited books disagree on the asset base.
 *
 * This module DETECTS drift only (it changes nothing about how assets are stored or posted).
 * Mirrors the proven share-capital reconciliation. Pure → unit-tested by
 * scripts/test-asset-reconciliation.mjs.
 */
import type { Asset } from '@/types';

/**
 * Σ gross cost of the assets actually carried in the fixed-asset ledger: live (not archived)
 * and not disposed — disposal credits the asset's cost out of the ledger, so a disposed
 * asset must not be counted on the register side either.
 */
export function sumActiveAssetCost(
  assets: Pick<Asset, 'cost' | 'isDeleted' | 'disposalDate'>[],
): number {
  return (assets || [])
    .filter((a) => !a.isDeleted && !a.disposalDate)
    .reduce((sum, a) => sum + (a.cost || 0), 0);
}

export interface AssetReconciliation {
  registerTotal: number;    // Σ asset.cost (live, non-disposed)
  controlBalance: number;   // Σ fixed-asset ledger accounts (Dr, gross cost)
  difference: number;       // registerTotal − controlBalance (signed, 2dp)
  reconciled: boolean;      // |difference| < ₹1 (rounding tolerance)
}

/** Compare register cost against the fixed-asset ledger control. < ₹1 tolerance matches the codebase convention. */
export function reconcileAssetRegister(registerTotal: number, controlBalance: number): AssetReconciliation {
  const difference = +(registerTotal - controlBalance).toFixed(2);
  return {
    registerTotal: +registerTotal.toFixed(2),
    controlBalance: +controlBalance.toFixed(2),
    difference,
    reconciled: Math.abs(difference) < 1,
  };
}

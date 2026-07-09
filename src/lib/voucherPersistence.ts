/**
 * Voucher overlay-persistence classification (P0 #6 / ECR-04).
 *
 * RULE 1's two-step write upserts base columns first (transactional, rolls back on
 * failure), then patches "overlay" columns in a best-effort second .update(). That
 * second patch is allowed to fail for users who haven't run the latest migration.
 *
 * The bug ECR-04 fixes: the second patch lumped CRITICAL control/audit overlays
 * (approvalStatus / editHistory / …) together with cosmetic ones, and a failure only
 * raised a mild toast. Since P0 #1/#5 made approvalStatus gate the ledger, silently
 * losing it on refresh is a correctness bug. This module splits the two buckets and
 * decides the failure toast so a critical loss is LOUD and actionable — never silent.
 *
 * Pure & deterministic → unit-tested by scripts/test-voucher-persistence.mjs.
 */

/** Overlays whose loss corrupts the ledger / audit trail — a failed patch must be loud. */
export const CRITICAL_OVERLAY_KEYS = [
  'approvalStatus', 'approvalRemarks', 'approvedBy', 'approvedAt', 'editHistory',
] as const;

/** Cosmetic / routing overlays — a failed patch keeps the existing mild warning. */
export const OPTIONAL_OVERLAY_KEYS = [
  'lines', 'refType', 'refId', 'isCleared', 'clearedDate', 'groupId',
  'billAllocations', 'workOrderId', 'costCentreId', 'branchId',
] as const;

export interface VoucherExtrasSplit {
  critical: Record<string, unknown>;
  optional: Record<string, unknown>;
  hasCritical: boolean;
}

/**
 * Split a voucher's overlay columns into critical vs optional buckets.
 * Present-only: an `undefined` value is omitted (matches the original inline build,
 * so we never overwrite a stored column with null).
 */
export function splitVoucherExtras(v: Record<string, unknown>): VoucherExtrasSplit {
  const pick = (keys: readonly string[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (v[k] !== undefined) out[k] = v[k];
    return out;
  };
  const critical = pick(CRITICAL_OVERLAY_KEYS);
  const optional = pick(OPTIONAL_OVERLAY_KEYS);
  return { critical, optional, hasCritical: Object.keys(critical).length > 0 };
}

export interface ExtrasToast {
  title: string;
  description: string;
  variant: 'destructive' | 'default';
  duration: number;
}

/**
 * Decide the toast shown when the overlay patch fails after its retry.
 * Critical bucket present → LOUD destructive (control/audit data didn't reach the cloud);
 * cosmetic-only → the pre-existing mild warning (unchanged UX).
 */
export function extrasFailureToast(hasCritical: boolean, message: string): ExtrasToast {
  if (hasCritical) {
    return {
      title: '❌ Approval/audit data cloud par save NAHI hua',
      description: `Voucher to save ho gaya, par approval-status / edit-history cloud tak nahi pahunchi: ${message}. Latest supabase-tables.sql migration chalayein — warna refresh par yeh data lose ho sakta hai.`,
      variant: 'destructive',
      duration: 14000,
    };
  }
  return {
    title: '⚠️ Voucher saved partially',
    description: `Base voucher saved to cloud, but extras (lines/refs) failed: ${message}. Run latest supabase-tables.sql migration.`,
    variant: 'default',
    duration: 8000,
  };
}

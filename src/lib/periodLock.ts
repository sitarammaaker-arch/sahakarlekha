/**
 * Period lock / back-dating prevention (ECR-07, P1 #7) — the pure predicate, extracted from
 * DataContext so it is unit-testable in isolation. A date ON or BEFORE the society's periodLockDate
 * falls in a closed period. PURE — no React, no Supabase; the tenant's lock date is passed in.
 */

/** True when `entityDate` is on or before `periodLockDate` (a closed period). Absent lock or date ⇒ false. */
export function isPeriodLocked(entityDate: string | undefined, periodLockDate: string | undefined): boolean {
  return !!periodLockDate && !!entityDate && entityDate <= periodLockDate;
}

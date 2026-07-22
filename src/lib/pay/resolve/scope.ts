/**
 * Scope resolution (Phase-7 §3/§8). PURE. The org-hierarchy dimension the platform rules engine
 * (rules/engine.ts) does NOT have: it resolves effective-dating + jurisdiction + `when`-specificity;
 * this adds the 9-level org scope (global → … → employee) so payroll config/rules/policies can be
 * scoped to an org, branch, department, cadre, designation or a single employee.
 *
 * Selection law (Phase-7 §8): narrower SCOPE wins, then more-recent effectiveFrom, then higher
 * version. A genuine tie (two distinct candidates equally specific/recent/versioned) is a CATALOG
 * DEFECT — surfaced (thrown), never silently arbitrated. Nothing applicable → null (the caller
 * refuses for a mandatory key; falls back to a default otherwise). Statutory floor/ceiling clamps
 * are applied AFTER selection (a later brick), so "most-specific-wins" and "the legal minimum is
 * inviolable" coexist without contradiction.
 */

export type ScopeLevel =
  | 'global'
  | 'country'
  | 'state'
  | 'org_type'
  | 'org'
  | 'branch'
  | 'department'
  | 'cadre'
  | 'designation'
  | 'employee';

/** Broad → narrow. Index is the specificity rank (global = 0 … employee = 9). */
export const SCOPE_LEVELS: readonly ScopeLevel[] = [
  'global', 'country', 'state', 'org_type', 'org', 'branch', 'department', 'cadre', 'designation', 'employee',
];

/** Specificity rank of a scope level; higher = narrower = wins. */
export function scopeSpecificity(level: ScopeLevel): number {
  const i = SCOPE_LEVELS.indexOf(level);
  if (i < 0) throw new RangeError(`scope: unknown level ${level}`);
  return i;
}

/** The ancestor-or-self placement of an employee — which scope refs a candidate may target. */
export interface PlacementChain {
  orgType?: string | null;
  orgId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  cadreId?: string | null;
  designationId?: string | null;
  employeeId: string;
}

export interface ScopeDescriptor {
  level: ScopeLevel;
  /** The entity at that level. Null/absent for global/country/state (keyed by jurisdiction, not a ref). */
  refId?: string | null;
}

/**
 * PURE — does a scope apply to an ancestor-or-self of the employee? global/country/state always
 * apply from the org-hierarchy view (jurisdiction filtering is the engine's separate concern);
 * ref-bearing levels apply iff their refId equals the employee's placement at that level.
 */
export function scopeApplies(scope: ScopeDescriptor, chain: PlacementChain): boolean {
  switch (scope.level) {
    case 'global':
    case 'country':
    case 'state':
      return true;
    case 'org_type': return !!scope.refId && scope.refId === chain.orgType;
    case 'org': return !!scope.refId && scope.refId === chain.orgId;
    case 'branch': return !!scope.refId && scope.refId === chain.branchId;
    case 'department': return !!scope.refId && scope.refId === chain.departmentId;
    case 'cadre': return !!scope.refId && scope.refId === chain.cadreId;
    case 'designation': return !!scope.refId && scope.refId === chain.designationId;
    case 'employee': return !!scope.refId && scope.refId === chain.employeeId;
    default: return false;
  }
}

export interface ScopedCandidate {
  scope: ScopeDescriptor;
  /** ISO date the candidate applies from. */
  effectiveFrom: string;
  version?: number;
}

/**
 * PURE — select the most-specific applicable candidate at `asOf`, or null. Filters to
 * scope-applicable + effective (effectiveFrom <= asOf), then ranks by
 * (scopeSpecificity DESC, effectiveFrom DESC, version DESC). A tie at the top (two distinct
 * candidates with the same specificity/effectiveFrom/version) throws PAY-CMP-CONFLICT.
 */
export function selectMostSpecific<C extends ScopedCandidate>(
  candidates: readonly C[],
  chain: PlacementChain,
  asOf: string,
): C | null {
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(asOfMs)) throw new RangeError('scope: asOf is not a valid ISO date');

  const scored = candidates
    .filter((c) => scopeApplies(c.scope, chain))
    .map((c) => ({ c, ms: Date.parse(c.effectiveFrom), spec: scopeSpecificity(c.scope.level), ver: c.version ?? 0 }))
    .filter((s) => !Number.isNaN(s.ms) && s.ms <= asOfMs);

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.spec - a.spec || b.ms - a.ms || b.ver - a.ver);
  const top = scored[0];
  const ties = scored.filter((s) => s.spec === top.spec && s.ms === top.ms && s.ver === top.ver);
  if (ties.length > 1) {
    throw new RangeError(
      `PAY-CMP-CONFLICT: ${ties.length} candidates tie at scope=${top.c.scope.level} effectiveFrom=${top.c.effectiveFrom} version=${top.ver} — catalog defect`,
    );
  }
  return top.c;
}

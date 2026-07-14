/**
 * Multi-branch scoping (ECR-17 Phase 1).
 *
 * A society can have multiple branches. Transactions carry a `branchId`; reports
 * are viewed either for one branch or CONSOLIDATED ("all"). Legacy records with no
 * branchId map to the Head Office, so adopting branches never hides old data.
 * Pure & deterministic → unit-tested by scripts/test-branch-scope.mjs.
 */
export const ALL_BRANCHES = 'all';

export interface HasBranch { branchId?: string }

/** True when a record's branch is within the active scope. */
export function matchesBranch(branchId: string | undefined, activeBranchId: string, headOfficeId?: string): boolean {
  if (!activeBranchId || activeBranchId === ALL_BRANCHES) return true; // consolidated
  const effective = branchId || headOfficeId || '';                    // unbranched → head office
  return effective === activeBranchId;
}

/** Filter records to the active branch ('all' = no filter, consolidated). */
export function filterByBranch<T extends HasBranch>(records: T[], activeBranchId: string, headOfficeId?: string): T[] {
  if (!activeBranchId || activeBranchId === ALL_BRANCHES) return records;
  return records.filter(r => matchesBranch(r.branchId, activeBranchId, headOfficeId));
}

/** The branch to stamp on a NEW record: the active one, or the Head Office when viewing "all". */
export function branchToStamp(activeBranchId: string, headOfficeId?: string): string | undefined {
  return activeBranchId && activeBranchId !== ALL_BRANCHES ? activeBranchId : headOfficeId;
}

/**
 * Should SOCIETY-LEVEL (unbranched) values be included in the active scope? Account opening
 * balances and physical stock carry no branchId, so they follow the same rule as an unbranched
 * voucher: they belong to the Head Office. Without this, every branch's Trial Balance carried
 * 100% of the society's openings — each branch "balanced" (openings are two-sided) yet the sum
 * of the branch statements double-counted them against the consolidated one.
 */
export function unbranchedInScope(activeBranchId: string, headOfficeId?: string): boolean {
  return matchesBranch(undefined, activeBranchId, headOfficeId);
}

/**
 * ECR-17 Phase 4b (RBAC): the active branch a user is allowed to view. A
 * branch-restricted user (restrictedBranchId set) can NEVER leave their home
 * branch — any requested switch collapses to it. Unrestricted → honour the request.
 */
export function resolveActiveBranch(restrictedBranchId: string | undefined, requestedId: string): string {
  return restrictedBranchId || requestedId;
}

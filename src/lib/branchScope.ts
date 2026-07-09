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

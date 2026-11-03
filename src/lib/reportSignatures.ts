/**
 * Which signature lines a society's REPORTS carry. It is the society admin's choice, not a rule of the app:
 * all three, any two, one, or none at all (signatories.reportRoles, set on the Board of Directors page).
 *
 *   undefined → never chosen → all lines, exactly as before this setting existed
 *   []        → no signature block on any report
 *
 * Only the three named posts can be picked. Any other line on a report (Auditor, Election Officer, Treasurer,
 * Authorised Signatory) stays while the block is on and goes when the block is off.
 *
 * Bound once from the society by <ExportContextBinder/>, like reportBranding. PURE module state, dependency-free.
 * NOT for documents that are signed to be valid (notices, bills, receipts, letters, blank forms): those use
 * addDocumentSignatureBlock and ignore this setting.
 */
export type SignatoryRole = 'accountant' | 'secretary' | 'president';

export const SIGNATORY_ROLES: readonly SignatoryRole[] = ['accountant', 'secretary', 'president'];

let reportRoles: readonly SignatoryRole[] | undefined;

export function setReportSignatureRoles(roles: readonly SignatoryRole[] | undefined): void {
  reportRoles = roles;
}

export function getReportSignatureRoles(): readonly SignatoryRole[] | undefined {
  return reportRoles;
}

/** PURE — the post a printed English label stands for; null for a line the admin cannot pick. */
export function signatoryRoleOf(label: string): SignatoryRole | null {
  if (/accountant/i.test(label)) return 'accountant';
  if (/^\s*(secretary|manager)/i.test(label)) return 'secretary';
  if (/^\s*(president|chairman)/i.test(label)) return 'president';
  return null;
}

/** PURE — the lines that stay, with each one's name kept beside it. */
export function selectSignatures(
  labels: readonly string[],
  names: readonly string[] | undefined,
  roles: readonly SignatoryRole[] | undefined,
): { labels: string[]; names?: string[] } {
  if (!roles) return { labels: [...labels], names: names ? [...names] : undefined };
  if (roles.length === 0) return { labels: [] };
  const keep = labels.map((label) => {
    const role = signatoryRoleOf(label);
    return role === null || roles.includes(role);
  });
  return {
    labels: labels.filter((_, i) => keep[i]),
    names: names ? names.filter((_, i) => keep[i]) : undefined,
  };
}

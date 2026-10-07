/**
 * Screen-only accounts — PURE.
 *
 * The load path merges ACCOUNTS_TO_ADD into LOCAL state only and never writes (RM-01). A society whose
 * database already holds every one of them (new / reset societies are seeded with the full chart; migration
 * 114 fixed the existing ones) has nothing to report. If one is ever missing again — a chart edited by
 * hand, a restore from an old backup, a new ACCOUNTS_TO_ADD entry shipped without a migration — the screen
 * and the database silently disagree, and the first voucher on that account is refused by the server
 * (post_voucher:account_not_found). This turns that silent state into one row in error_log.
 *
 * Reporting is NOT a write to accounting data (error_log is the audit-P0 sink). Once per society per page
 * load: `seen` is the caller's per-page Set.
 */
export interface LocalOnlyReport {
  source: 'chart-local-only';
  message: string;
  context: { societyId: string; count: number; ids: string[] };
}

export function localOnlyAccountsReport(
  societyId: string,
  added: ReadonlyArray<{ id: string }>,
  seen: Set<string>,
): LocalOnlyReport | null {
  if (added.length === 0 || seen.has(societyId)) return null;
  seen.add(societyId);
  return {
    source: 'chart-local-only',
    message: `${added.length} account(s) are shown on screen but are not in the database — vouchers on them will be refused`,
    context: { societyId, count: added.length, ids: added.slice(0, 40).map(a => a.id) },
  };
}

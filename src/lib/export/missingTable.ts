/**
 * PURE — is this PostgREST/Postgres message "that table does not exist (yet)"? Names the table, so an
 * unrelated error never matches. Dependency-free: shared by the export source, the restore writer and
 * (as a hand copy, kept in step by scripts/test-scheduled-backup-optional.mjs) the scheduled-backup
 * Edge Function.
 */
export function isMissingTableError(message: string | null | undefined, table: string): boolean {
  const m = (message || '').toLowerCase();
  const t = table.toLowerCase();
  return m.includes(t) && (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find'));
}

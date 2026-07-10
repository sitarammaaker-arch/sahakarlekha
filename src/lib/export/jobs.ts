/**
 * Export History (T-15).
 *
 * The compliance surface: "who took the member list, and when" (gap EXP-05). Under the
 * DPDP Act that question must always be answerable, and until T-02/T-14 it was not.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * DELIBERATE DEVIATION: no `export_jobs` table.
 *
 * ROADMAP-DATA-PORTABILITY T-15 creates one. It should not exist yet.
 *
 * Every `export` audit row already carries who (actor_name / email / role), what
 * (entities, format, mode, rowCount, filters), when (created_at), and the artifact hash
 * and byte size — see buildExportAuditEvent in lib/auditLog.ts. An `export_jobs` table
 * would duplicate all of it and add three columns — `status`, `artifact_path`,
 * `expires_at` — that are meaningless until server-side jobs exist (T-27, gated on
 * decision D1). A table whose distinguishing columns are always null is speculation.
 *
 * The schema-drift gate (T-12) also prices this honestly: adding a table means declaring
 * it in the registry, which means touching platform.ts and the registry test. Paying that
 * for a table nobody reads is the wrong trade. `export_jobs` lands with T-27, alongside
 * backup_runs and restore_runs, when its columns mean something.
 *
 * audit_log is `sidecar`: WORM, INSERT + SELECT only. Reading it for a UI is exactly what
 * its SELECT policy is for.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * ISOLATION WARNING. audit_log's SELECT policy is `using (true)` — one of 35 such
 * policies in the schema. It does NOT isolate tenants. The `.eq('society_id', ...)`
 * filter below is the ONLY thing scoping this query to one society. Other tables use
 * `society_id::text in (select current_user_society_ids())`; audit_log should too.
 * Do not remove that filter.
 */
import { supabase } from '@/lib/supabase';

/** One row of the history table, already shaped for display. */
export interface ExportHistoryEntry {
  id: string;
  exportId: string;
  at: string;                       // ISO timestamp
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  entities: string[];
  format: string;
  mode: string;
  rowCount: number;
  filters: Record<string, unknown> | null;
  artifactSha256: string | null;
  byteSize: number | null;
}

/** The raw audit_log row, as Supabase returns it. */
export interface AuditLogRow {
  id?: string;
  entity_id?: string | null;
  created_at?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  after?: unknown;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * PURE — turn one audit row into a history entry.
 *
 * Every field is defensive. These rows are WORM: they were written by whatever version
 * of the app was deployed that day, and older ones may predate fields added later. A
 * history page that throws on a two-year-old row is a history page nobody can audit with.
 */
export function toExportHistoryEntry(row: AuditLogRow): ExportHistoryEntry {
  const after = asRecord(row.after);
  const entities = Array.isArray(after.entities) ? after.entities.map(String) : [];
  const rowCount = typeof after.rowCount === 'number' ? after.rowCount : 0;

  return {
    id: String(row.id ?? ''),
    exportId: String(row.entity_id ?? ''),
    at: String(row.created_at ?? ''),
    actorName: row.actor_name ?? null,
    actorEmail: row.actor_email ?? null,
    actorRole: row.actor_role ?? null,
    entities,
    format: typeof after.format === 'string' ? after.format : 'unknown',
    mode: typeof after.mode === 'string' ? after.mode : 'unknown',
    rowCount,
    filters: after.filters ? asRecord(after.filters) : null,
    artifactSha256: typeof after.artifactSha256 === 'string' ? after.artifactSha256 : null,
    byteSize: typeof after.byteSize === 'number' ? after.byteSize : null,
  };
}

/** PURE — one-line description of what was taken. Hindi-first (RULE 7). */
export function describeExport(entry: ExportHistoryEntry, hi = true): string {
  const what = entry.entities.length === 0
    ? (hi ? 'अज्ञात' : 'unknown')
    : entry.entities.length <= 2
      ? entry.entities.join(', ')
      : `${entry.entities.slice(0, 2).join(', ')} +${entry.entities.length - 2}`;
  const rows = hi ? `${entry.rowCount} पंक्तियाँ` : `${entry.rowCount} rows`;
  return `${what} · ${entry.format.toUpperCase()} · ${rows}`;
}

/**
 * PURE — was any personal data possibly included?
 *
 * A redacted export masked its PII columns; anything else may have carried names,
 * phones, PAN or Aadhaar. This is the flag an auditor scans the list for, so it is
 * computed from the recorded mode rather than guessed from the entity names.
 */
export function mayContainPii(entry: ExportHistoryEntry): boolean {
  return entry.mode !== 'redacted';
}

/**
 * Read the export history for one society, newest first.
 *
 * The society_id filter is load-bearing — see the ISOLATION WARNING above.
 * Returns `{ entries, error }` rather than throwing: an unreadable history must not take
 * the page down, but it must not silently render as "no exports" either.
 */
export async function listExportHistory(
  societyId: string,
  limit = 100,
): Promise<{ entries: ExportHistoryEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, entity_id, created_at, actor_name, actor_email, actor_role, after')
    .eq('society_id', societyId)      // the only tenant isolation on this table
    .eq('action', 'export')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { entries: [], error: error.message };
  return { entries: (data ?? []).map(toExportHistoryEntry), error: null };
}

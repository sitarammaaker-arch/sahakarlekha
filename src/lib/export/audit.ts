/**
 * Export audit adapter (T-14).
 *
 * Bridges the Export Registry's vocabulary to the BLOCKING custody contract landed in
 * T-02 (lib/auditLog.ts). It exists so that exactly one function in the export subsystem
 * knows how an export becomes an audit row — and so that function is impossible to
 * confuse with `logAudit`.
 *
 * TWO CONTRACTS, OPPOSITE FAILURE MODES (see the header of lib/auditLog.ts):
 *
 *   logAudit        business mutations. Fire-and-forget. A logging outage must NEVER
 *                   stop a society from saving a voucher.
 *   recordExport    data custody. Awaited, and THROWS. The caller must abort and
 *                   deliver no bytes.
 *
 * Reusing `logAudit` here would swallow the error and silently reopen gap EXP-05, where
 * a full member-PII download leaves no trace at all. scripts/test-export-generator.mjs
 * fails if the throw is removed.
 *
 * `buildExportId` and `buildExportAuditInput` are pure and unit-tested. `recordExport`
 * is the only side-effecting function.
 */
import { logExportAudit, type AuditContext, type ExportAuditInput } from '@/lib/auditLog';

/** Everything `recordExport` needs beyond the request itself. */
export type ExportAuditContext = AuditContext;

/** What was taken. Mirrors ExportAuditInput minus the id, which we mint. */
export interface ExportDescription {
  entities: string[];
  format: 'csv' | 'xlsx' | 'pdf' | 'json' | 'zip';
  mode: 'standard' | 'full' | 'redacted' | 'statutory';
  rowCount: number;
  filters?: Record<string, unknown>;
  /** Set once the artifact exists and is hashed (T-23). Absent for inline exports. */
  artifactSha256?: string;
  byteSize?: number;
}

/**
 * PURE — a stable id for one export.
 *
 * `now` and `nonce` are injected rather than read from the clock and RNG, so the id is
 * deterministic under test. Callers in the app pass neither.
 */
export function buildExportId(
  description: Pick<ExportDescription, 'entities' | 'format'>,
  now: string = new Date().toISOString(),
  nonce: string = Math.random().toString(36).slice(2, 8),
): string {
  const scope = description.entities.length === 1 ? description.entities[0] : `${description.entities.length}-entities`;
  const stamp = now.replace(/[-:.]/g, '').slice(0, 15);   // 20260710T083012
  return `exp-${scope}-${description.format}-${stamp}-${nonce}`;
}

/** PURE — shape the audit input. Deterministic given (description, exportId). */
export function buildExportAuditInput(
  description: ExportDescription,
  exportId: string,
): ExportAuditInput {
  return {
    exportId,
    entities: description.entities,
    format: description.format,
    mode: description.mode,
    rowCount: description.rowCount,
    filters: description.filters,
    artifactSha256: description.artifactSha256,
    byteSize: description.byteSize,
  };
}

/**
 * BLOCKING. Writes the audit row and THROWS (AuditWriteError) if it cannot.
 *
 * Call this BEFORE delivering any bytes. Let the throw propagate: the whole point is
 * that an export which cannot be recorded does not happen.
 *
 * Returns the export id, so the caller can stamp it on the artifact.
 */
export async function recordExport(
  description: ExportDescription,
  ctx: ExportAuditContext,
  exportId: string = buildExportId(description),
): Promise<string> {
  await logExportAudit(buildExportAuditInput(description, exportId), ctx);
  return exportId;
}

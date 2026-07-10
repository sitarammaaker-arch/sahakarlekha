/**
 * Registry-driven export generator (T-14).
 *
 * The first consumer of the Export Registry. One code path turns any entity descriptor
 * into CSV, XLSX or JSON. Pages stop assembling `headers[]` / `rows[][]` by hand.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE ORDER MATTERS, AND IT IS NOT NEGOTIABLE:
 *
 *     authorize  →  project  →  AWAIT the audit write  →  deliver bytes
 *
 * `recordExport` throws on failure and the throw is NOT caught here. If the audit row
 * cannot be written, the caller never reaches `triggerDownload` and the user gets
 * nothing. An untraced bulk extraction of member PII is worse than a failed one — under
 * the DPDP Act, "who took the member list, and when" must always be answerable (gap
 * EXP-05). This is the exact inverse of `logAudit`, which must never block a voucher save.
 *
 * Do not "improve" this by moving the audit write after the download, or by wrapping it
 * in a try/catch. scripts/test-export-generator.mjs fails if you do.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * AUTHORIZATION IS ENFORCED HERE, not only in the UI (blueprint §8.4). A page that
 * forgets to hide a button, or a future API route, still cannot extract an entity the
 * caller's role or capabilities do not reach.
 *
 * Pure functions (`authorizeExport`, `selectColumns`, `filterRows`, `projectRows`,
 * `redactValue`) are unit-tested by scripts/test-export-generator.mjs. `exportEntity` is
 * the only DOM-touching function.
 */
import type { Capability, Role } from '@/lib/navigation/capabilities';
import type { ColumnDescriptor, EntityDescriptor, ExportFormat } from './registry.types';
import { roleAtLeast } from './registry.types';
import { getEntity } from './registry';
import { recordExport, type ExportAuditContext } from './audit';
import {
  downloadCSV, downloadExcelSingle, downloadJSON,
  type Cell, type ExportMeta,
} from '@/lib/exportUtils';

/** What the user asked for (blueprint §4.3). */
export type ExportMode = 'standard' | 'full' | 'redacted' | 'statutory';

/** The value substituted for every masked cell. Same marker lib/auditLog.ts uses. */
export const REDACTED = '***';

/** Tabular formats only. PDF stays with lib/pdf.ts — it is a presentation artifact. */
export type TabularFormat = Extract<ExportFormat, 'csv' | 'xlsx' | 'json'>;

export interface ExportRequest {
  entityKey: string;
  format: TabularFormat;
  mode: ExportMode;
  /** Explicit column keys. Required for `statutory`; optional override otherwise. */
  columns?: string[];
  /** Include soft-deleted rows. Implied by `full`. */
  includeDeleted?: boolean;
  /** Recorded in the audit row and the XLSX README. */
  filters?: Record<string, unknown>;
  /** Without extension. Defaults to the entity key. */
  filenameBase?: string;
}

export interface ExportPrincipal {
  role: Role;
  /** Resolved ACTIVE capabilities, as the nav engine computes them. */
  capabilities: readonly Capability[];
}

/** A row as it arrives from Supabase / DataContext. */
export type SourceRow = Record<string, unknown>;

// ─── Authorization ───────────────────────────────────────────────────────────────────

/**
 * Not a discriminated union: this repo compiles with `strict: false`, so TypeScript will
 * not narrow `{ ok: true } | { ok: false; reason: string }` on `!authz.ok`. A flat shape
 * costs a little type safety and buys code that actually compiles here.
 */
export interface AuthzResult {
  ok: boolean;
  /** Present only when `ok` is false. Safe to show the user; names no data. */
  reason?: string;
}

/**
 * PURE — may this principal export this entity, in this format?
 *
 * Fails closed on every branch. `formats: []` (the `exclude` custody class: secrets,
 * credentials, cross-tenant registries) makes an entity unreachable here, whatever the
 * caller's role.
 */
export function authorizeExport(
  entity: EntityDescriptor,
  principal: ExportPrincipal,
  format: TabularFormat,
): AuthzResult {
  if (entity.backupPolicy === 'exclude') {
    return { ok: false, reason: `"${entity.key}" is excluded from every export path` };
  }
  if (!entity.formats.includes(format)) {
    return { ok: false, reason: `"${entity.key}" does not support ${format} export` };
  }
  if (!roleAtLeast(principal.role, entity.minRole)) {
    return { ok: false, reason: `"${entity.key}" requires role ${entity.minRole}` };
  }
  if (entity.capability && !principal.capabilities.includes(entity.capability)) {
    return { ok: false, reason: `"${entity.key}" requires the ${entity.capability} capability` };
  }
  return { ok: true };
}

// ─── Column selection ────────────────────────────────────────────────────────────────

/**
 * PURE — which columns, in which order.
 *
 *   standard   default-visible columns
 *   full       every column
 *   redacted   default-visible columns, PII values masked (see projectRows)
 *   statutory  EXACTLY the columns the caller names, in that order — a register's legal
 *              format is frozen, so it may never drift with `defaultVisible`
 *
 * An explicit `columns` list overrides the mode's default set, and is REQUIRED for
 * `statutory`. Unknown column keys throw rather than being silently dropped: a statutory
 * register missing a column is a compliance failure, not a formatting quirk.
 */
export function selectColumns(
  entity: EntityDescriptor,
  mode: ExportMode,
  columns?: string[],
): ColumnDescriptor[] {
  if (mode === 'statutory' && (!columns || columns.length === 0)) {
    throw new Error(`statutory export of "${entity.key}" must name its columns explicitly`);
  }
  if (columns && columns.length > 0) {
    const byKey = new Map(entity.columns.map(c => [c.key, c]));
    return columns.map(k => {
      const col = byKey.get(k);
      if (!col) throw new Error(`"${entity.key}" has no column "${k}"`);
      return col;
    });
  }
  if (mode === 'full') return entity.columns;
  return entity.columns.filter(c => c.defaultVisible);
}

// ─── Rows ────────────────────────────────────────────────────────────────────────────

/**
 * PURE — RULE 5. Soft-deleted rows are excluded unless asked for. `full` implies
 * inclusion: an auditor needs cancelled vouchers, and hiding them from the mode whose
 * whole purpose is completeness would be a silent omission.
 */
export function filterRows(
  entity: EntityDescriptor,
  rows: readonly SourceRow[],
  mode: ExportMode,
  includeDeleted = false,
): SourceRow[] {
  const field = entity.softDeleteField;
  if (!field) return [...rows];
  if (mode === 'full' || includeDeleted) return [...rows];
  return rows.filter(r => !r[field]);
}

/** PURE — mask one value if the mode and the column's PII class say so. */
export function redactValue(value: unknown, column: ColumnDescriptor, mode: ExportMode): unknown {
  if (mode !== 'redacted') return value;
  if (column.piiClass === 'none') return value;
  if (value === null || value === undefined || value === '') return value;
  return REDACTED;
}

/** Cells are what CSV/XLSX accept; anything structured is serialized. */
function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return JSON.stringify(value);
}

/** PURE — project source rows onto the chosen columns, applying redaction. */
export function projectRows(
  rows: readonly SourceRow[],
  columns: readonly ColumnDescriptor[],
  mode: ExportMode,
): Cell[][] {
  return rows.map(row => columns.map(col => toCell(redactValue(row[col.key], col, mode))));
}

/** PURE — the same projection as objects, for JSON export. */
export function projectObjects(
  rows: readonly SourceRow[],
  columns: readonly ColumnDescriptor[],
  mode: ExportMode,
): Record<string, unknown>[] {
  return rows.map(row => {
    const out: Record<string, unknown> = {};
    for (const col of columns) out[col.key] = redactValue(row[col.key], col, mode);
    return out;
  });
}

/** PURE — Hindi-first headers (RULE 7). */
export function headersFor(columns: readonly ColumnDescriptor[], language: 'hi' | 'en'): string[] {
  return columns.map(c => (language === 'hi' ? c.headerHi : c.header));
}

// ─── The one export path ─────────────────────────────────────────────────────────────

export interface ExportEnvironment extends ExportAuditContext {
  principal: ExportPrincipal;
  language: 'hi' | 'en';
  /** Provenance stamped on the XLSX README sheet. */
  meta?: ExportMeta;
}

export class ExportDeniedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ExportDeniedError';
  }
}

/**
 * Authorize, project, RECORD, then deliver. The audit write is awaited and its failure
 * propagates — no bytes reach the user without a trail.
 *
 * Returns the number of rows exported.
 */
export async function exportEntity(
  rows: readonly SourceRow[],
  request: ExportRequest,
  env: ExportEnvironment,
): Promise<number> {
  const entity = getEntity(request.entityKey);
  if (!entity) throw new ExportDeniedError(`unknown entity "${request.entityKey}"`);

  const authz = authorizeExport(entity, env.principal, request.format);
  if (!authz.ok) throw new ExportDeniedError(authz.reason);

  const columns = selectColumns(entity, request.mode, request.columns);
  const kept = filterRows(entity, rows, request.mode, request.includeDeleted);

  // STEP 1 — the trail. Awaited. Throws on failure. Nothing below runs if it does.
  await recordExport(
    {
      entities: [entity.key],
      format: request.format,
      mode: request.mode,
      rowCount: kept.length,
      filters: request.filters,
    },
    env,
  );

  // STEP 2 — only now do bytes leave.
  const filename = request.filenameBase ?? entity.key;
  if (request.format === 'json') {
    downloadJSON(projectObjects(kept, columns, request.mode), filename, env.meta);
  } else {
    const headers = headersFor(columns, env.language);
    const body = projectRows(kept, columns, request.mode);
    if (request.format === 'csv') downloadCSV(headers, body, filename);
    else downloadExcelSingle(headers, body, filename, entity.label.slice(0, 31), env.meta);
  }

  return kept.length;
}

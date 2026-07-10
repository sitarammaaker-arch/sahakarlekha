/**
 * The one export runner (T-18).
 *
 * Fetch → refuse if truncated → authorize, audit, deliver. Every export in the app goes
 * through this function: the Export Center's button, the per-page buttons, and whatever
 * calls it next. Nothing else assembles this sequence.
 *
 * WHY IT EXISTS. T-16b's page and T-18's per-page button both need the same three steps
 * in the same order, with the same refusals. Copying fifteen lines into each caller is
 * how the original 59 bespoke export sites came to be — which is what this workstream is
 * unwinding. One runner, one place to get the order wrong, one place to test it.
 *
 * IT RETURNS AN OUTCOME, IT DOES NOT THROW.
 *
 * Callers are UI. They need to tell the four failures apart, because each one deserves a
 * different sentence to the user:
 *
 *   'read-failed'   the database refused. Show the error.
 *   'too-large'     more rows than an inline browser export can hold. Say how many, and
 *                   do NOT hand over a partial file that looks complete.
 *   'denied'        role, capability or custody policy says no. The reason names no data.
 *   'audit-failed'  the trail could not be written, so no bytes left. This is the DPDP
 *                   guarantee working, not a bug.
 *
 * The one thing a caller may not do is treat any of these as "exported zero rows".
 */
import type { EntityDescriptor } from './registry.types';
import { fetchEntityRows } from './source';
import {
  exportEntity, ExportDeniedError,
  type ExportEnvironment, type ExportRequest,
} from './generator';
import { AuditWriteError } from '@/lib/auditLog';

export type ExportOutcome =
  | { status: 'exported'; rowCount: number }
  | { status: 'read-failed'; message: string }
  | { status: 'too-large'; fetched: number }
  | { status: 'denied'; message: string }
  | { status: 'audit-failed'; message: string }
  | { status: 'failed'; message: string };

export interface RunOptions {
  /** Injected in tests. */
  fetchRows?: typeof fetchEntityRows;
  runExport?: typeof exportEntity;
}

/**
 * Run one export end to end.
 *
 * The truncation check sits BEFORE the export, not after: a partial file that looks
 * complete is the same class of bug as a backup that cannot restore. We would rather
 * hand the user nothing and say why.
 */
export async function runEntityExport(
  entity: EntityDescriptor,
  societyId: string,
  request: ExportRequest,
  env: ExportEnvironment,
  options: RunOptions = {},
): Promise<ExportOutcome> {
  const fetchRows = options.fetchRows ?? fetchEntityRows;
  const runExport = options.runExport ?? exportEntity;

  let rows, truncated, fetched, error;
  try {
    ({ rows, truncated, fetched, error } = await fetchRows(entity, societyId));
  } catch (e) {
    // assertReadable throws for `exclude` / `global` entities. That is a denial, not a
    // read failure: the rows were never going to leave.
    return { status: 'denied', message: e instanceof Error ? e.message : String(e) };
  }

  if (error) return { status: 'read-failed', message: error };
  if (truncated) return { status: 'too-large', fetched };

  try {
    const rowCount = await runExport(rows, request, env);
    return { status: 'exported', rowCount };
  } catch (e) {
    if (e instanceof ExportDeniedError) return { status: 'denied', message: e.message };
    if (e instanceof AuditWriteError) return { status: 'audit-failed', message: e.message };
    return { status: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
}

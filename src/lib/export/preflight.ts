/**
 * Export preflight (T-17 / gap EXP-11).
 *
 * Ask the database HOW MANY rows there are before reading any of them.
 *
 * WHY. Every export in this app materializes the whole dataset in memory and writes it
 * in one pass — `[headers, ...rows].map(...)`. There is no chunking, no streaming, no
 * row cap. A society with a large voucher table freezes the tab. T-16a made the row
 * source report truncation honestly; this makes the user see it BEFORE they wait.
 *
 * `select('*', { count: 'exact', head: true })` returns the count with NO rows — the
 * whole point. If this ever regresses to fetching rows to count them, the preflight has
 * become the problem it exists to prevent. scripts/test-export-preflight.mjs pins it.
 *
 * THE SIZE FIGURE IS AN ESTIMATE AND IS LABELLED AS ONE. It is a rough upper bound from
 * row × column counts, not a measurement. Showing "~2.3 MB" and delivering 1.8 MB is
 * fine; silently freezing the browser is not.
 *
 * The cap itself lives in source.ts (DEFAULT_MAX_ROWS). One number, one home.
 */
import { supabase } from '@/lib/supabase';
import type { EntityDescriptor, ExportFormat } from './registry.types';
import { assertReadable, DEFAULT_MAX_ROWS } from './source';

/** Rough average serialized width of one cell, in bytes, including the delimiter. */
const AVG_CELL_BYTES = 14;

/** Multipliers relative to CSV. XLSX is zipped XML; JSON repeats every key per row. */
const FORMAT_WEIGHT: Record<string, number> = {
  csv: 1,
  xlsx: 0.5,
  json: 2.2,
};

export interface PreflightResult {
  rowCount: number;
  /** Rough upper bound. Never presented without an "approximately" qualifier. */
  estimatedBytes: number;
  /** False when the table holds more rows than an inline browser export may hold. */
  canExportInline: boolean;
  /** Present only when `canExportInline` is false. Safe to show the user. */
  reason?: string;
}

/** PURE — a rough upper bound on the artifact size. */
export function estimateBytes(rowCount: number, columnCount: number, format: ExportFormat): number {
  const weight = FORMAT_WEIGHT[format] ?? 1;
  return Math.round(rowCount * columnCount * AVG_CELL_BYTES * weight);
}

/** PURE — human-readable size. Binary units, one decimal, no false precision. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * PURE — may this export run inline, in the browser?
 *
 * A table holding EXACTLY `maxRows` rows is fine. Refusing it would be a false alarm,
 * the same boundary `fetchEntityRows` gets right when it probes one row past the cap.
 */
export function assessExport(args: {
  rowCount: number;
  columnCount: number;
  format: ExportFormat;
  maxRows?: number;
}): PreflightResult {
  const maxRows = args.maxRows ?? DEFAULT_MAX_ROWS;
  const estimatedBytes = estimateBytes(args.rowCount, args.columnCount, args.format);

  if (args.rowCount > maxRows) {
    return {
      rowCount: args.rowCount,
      estimatedBytes,
      canExportInline: false,
      reason: `${args.rowCount.toLocaleString('en-IN')} rows exceeds the inline limit of ${maxRows.toLocaleString('en-IN')}`,
    };
  }
  return { rowCount: args.rowCount, estimatedBytes, canExportInline: true };
}

export interface CountOptions {
  /** Injected in tests. Production always uses the real client. */
  client?: typeof supabase;
}

/**
 * Count the rows of one entity for one society, WITHOUT reading them.
 *
 * `head: true` means PostgREST returns the count in a header and no body. Soft-deleted
 * rows are counted: the count is an upper bound on what any mode could export, and a
 * preflight that under-counts is worse than one that over-counts.
 */
export async function countEntityRows(
  entity: EntityDescriptor,
  societyId: string,
  options: CountOptions = {},
): Promise<{ count: number; error: string | null }> {
  assertReadable(entity);
  const client = options.client ?? supabase;

  const { count, error } = await client
    .from(entity.table)
    .select('*', { count: 'exact', head: true })   // head: no rows come back
    .eq('society_id', societyId);                  // the only tenant boundary on 35 tables

  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}

/** Count, then judge. The one call the Export Center makes before enabling its button. */
export async function preflightExport(
  entity: EntityDescriptor,
  societyId: string,
  columnCount: number,
  format: ExportFormat,
  options: CountOptions = {},
): Promise<{ result: PreflightResult | null; error: string | null }> {
  const { count, error } = await countEntityRows(entity, societyId, options);
  if (error) return { result: null, error };
  return { result: assessExport({ rowCount: count, columnCount, format }), error: null };
}

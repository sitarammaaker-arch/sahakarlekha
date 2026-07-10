/**
 * Registry-driven row source (T-16a).
 *
 * One function reads the rows for ANY of the 93 declared entities. Without it the Export
 * Center would need a hand-written mapping from entity to DataContext field, and most
 * entities are not in DataContext at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * NO SILENT CAPS (blueprint P7).
 *
 * DataContext's `fetchAllPaged` stops after 200 pages and says nothing — 200,000 rows in,
 * the caller gets a short list that looks complete. For a UI that is a bug; for an export
 * it is data loss with a success toast, which is the exact failure this whole workstream
 * exists to kill.
 *
 * So this function returns `{ rows, truncated, fetched }`. When `truncated` is true the
 * caller MUST refuse to export, or say so loudly. It never quietly returns fewer rows
 * than the table holds.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * ORDERING. Five entities have no `id` column (the two procurement counters,
 * tds_challan_links, guide_certificates, user_mfa). Paging needs a stable, unique order,
 * so we order by the entity's declared `naturalKey` — which is unique per society by
 * definition. Ordering by a non-unique column would silently skip and repeat rows across
 * page boundaries.
 *
 * ISOLATION. `.eq('society_id', ...)` is applied on every read. 35 of the schema's
 * policies are `using (true)`, so for those tables this filter is the only tenant
 * boundary. Do not remove it.
 *
 * `exclude` entities are refused here as well as in the generator. Defence in depth: a
 * future caller that forgets `authorizeExport` still cannot read user_mfa.
 */
import { supabase } from '@/lib/supabase';
import type { EntityDescriptor } from './registry.types';
import type { SourceRow } from './generator';

/** Supabase's per-request row ceiling. Matches DataContext. */
export const PAGE_SIZE = 1000;

/** Above this, an inline browser export is refused and a server job is required (T-17). */
export const DEFAULT_MAX_ROWS = 50_000;

export interface FetchResult {
  rows: SourceRow[];
  /** True when the table holds more rows than `maxRows`. The caller must not pretend otherwise. */
  truncated: boolean;
  /** How many rows were actually read. */
  fetched: number;
  error: string | null;
}

export class EntityNotReadableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityNotReadableError';
  }
}

export interface FetchOptions {
  maxRows?: number;
  /** Injected in tests. Production always uses the real client. */
  client?: typeof supabase;
}

/**
 * PURE — the columns PostgREST should order by, so paging is stable.
 * Falls back to nothing only if an entity declares no natural key, which validateRegistry
 * already forbids.
 */
export function orderColumns(entity: EntityDescriptor): string[] {
  return entity.naturalKey.length > 0 ? [...entity.naturalKey] : [];
}

/** PURE — may this entity be read at all? Mirrors authorizeExport's custody check. */
export function assertReadable(entity: EntityDescriptor): void {
  if (entity.backupPolicy === 'exclude') {
    throw new EntityNotReadableError(`"${entity.key}" is excluded — its rows never leave the database`);
  }
  if (entity.scope === 'global') {
    throw new EntityNotReadableError(`"${entity.key}" is global reference data, not society data`);
  }
}

/**
 * Read every row of one entity for one society, newest page first is NOT assumed —
 * rows come back in natural-key order so paging cannot skip or repeat.
 *
 * Soft-deleted rows are NOT filtered here. `filterRows` in the generator owns RULE 5,
 * because whether they are wanted depends on the export mode, and the mode is not this
 * function's business.
 */
export async function fetchEntityRows(
  entity: EntityDescriptor,
  societyId: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  assertReadable(entity);

  const client = options.client ?? supabase;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const order = orderColumns(entity);

  const rows: SourceRow[] = [];
  let from = 0;

  for (;;) {
    const remaining = maxRows - rows.length;

    if (remaining <= 0) {
      // We have filled the cap. Is there anything past it? Ask for exactly one row at
      // offset `maxRows`. A table holding EXACTLY maxRows rows is complete, not
      // truncated — reporting it as truncated would refuse a perfectly valid export.
      const probe = await readPage(client, entity.table, societyId, order, maxRows, maxRows);
      if (probe.error) return { rows, truncated: true, fetched: rows.length, error: probe.error };
      return { rows, truncated: probe.data.length > 0, fetched: rows.length, error: null };
    }

    const size = Math.min(PAGE_SIZE, remaining);
    const page = await readPage(client, entity.table, societyId, order, from, from + size - 1);
    if (page.error) return { rows, truncated: false, fetched: rows.length, error: page.error };

    rows.push(...page.data);
    if (page.data.length < size) {
      return { rows, truncated: false, fetched: rows.length, error: null };
    }
    from += size;
  }
}

async function readPage(
  client: typeof supabase,
  table: string,
  societyId: string,
  order: string[],
  from: number,
  to: number,
): Promise<{ data: SourceRow[]; error: string | null }> {
  // order BEFORE range: the ordering decides which rows a range refers to.
  let q = client
    .from(table)
    .select('*')
    .eq('society_id', societyId);  // the only tenant boundary on 35 of the schema's tables
  for (const col of order) q = q.order(col);

  const { data, error } = await q.range(from, to);
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as SourceRow[], error: null };
}

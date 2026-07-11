/**
 * Restore row writer (T-33 wiring / gap EXP-01).
 *
 * The real `applyWrites` the commit saga drives — the code that actually rewrites a
 * society's books. It is split so that the DANGEROUS part is PURE and fully testable:
 *
 *   planEntityWrites  (PURE)  — decides, per entity + mode, exactly which rows to insert,
 *                               upsert, and DELETE. No I/O. Every branch is unit-tested.
 *   applyEntityWrites (thin)  — executes that plan against an injected client, chunked,
 *                               and ALWAYS scoped to one society. Throws on any error.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY society_id SCOPING IS LOAD-BEARING, NOT DEFENSIVE
 *
 * 35 of the schema's RLS policies are `using (true)` — they do NOT isolate tenants. On
 * those tables the `.eq('society_id', …)` filter is the ONLY thing standing between a
 * restore and another society's data. A Replace restore DELETES orphan rows; a delete that
 * forgot the society scope would reach across tenants and destroy books that were never
 * being restored. So EVERY delete here carries the society filter, and the executor refuses
 * to run one that would not. This is tested directly.
 *
 * THE THREE MODES
 *   fresh    the society is empty (the saga blocks otherwise). Insert every archived row.
 *   merge    keep what is there. Insert only rows whose natural key is ABSENT live; existing
 *            rows — including ones that differ — are left untouched.
 *   replace  the archive wins. Upsert every archived row (overwriting by primary key), and
 *            DELETE the orphans: live rows whose natural key the archive does not carry.
 *
 * voucher_entries is NEVER written here. The saga already excludes it (it is replayed), and
 * this refuses it too — a number must have one source (RULE 2).
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import type { EntityDescriptor } from '../export/registry.types';
import type { RestoreMode } from './diff';
import { keyOf, type Row } from './naturalKeys';

const CHUNK = 500;                 // matches DataContext's voucher_entries batching
const VOUCHER_ENTRY_KEY = 'voucher_entry';

export interface EntityWritePlan {
  /** Rows to insert (Fresh, and Merge's new rows). Insert fails loudly on a PK collision. */
  insert: Row[];
  /** Rows to upsert, overwriting by primary key (Replace). */
  upsert: Row[];
  /** Orphans to delete, as natural-key field→value maps. Replace only. Each is society-scoped. */
  deleteKeys: Record<string, unknown>[];
}

export class RestoreWriteError extends Error {
  readonly table: string;
  constructor(table: string, message: string) {
    super(`${table}: ${message}`);
    this.name = 'RestoreWriteError';
    this.table = table;
  }
}

/**
 * PURE — decide what a restore would write for one entity, in one mode.
 *
 * `currentRows` is what the society holds today (the same rows the dry run read). The plan
 * is computed by natural key, exactly as the diff is, so the writer and the operator's
 * preview cannot disagree.
 */
export function planEntityWrites(
  entity: EntityDescriptor,
  archiveRows: readonly Row[],
  currentRows: readonly Row[],
  mode: RestoreMode,
): EntityWritePlan {
  if (entity.key === VOUCHER_ENTRY_KEY) {
    // Defense in depth: the saga never routes this here, but a caller must not either.
    throw new RestoreWriteError(entity.table, 'voucher_entries are replayed, never written from the archive');
  }

  const keyOfRow = (r: Row) => keyOf(entity, r);

  if (mode === 'fresh') {
    return { insert: [...archiveRows], upsert: [], deleteKeys: [] };
  }

  if (mode === 'merge') {
    const liveKeys = new Set<string>();
    for (const r of currentRows) { const k = keyOfRow(r); if (k !== null) liveKeys.add(k); }
    // Insert only rows the society does not already have. Existing rows are kept as-is.
    const insert = archiveRows.filter(r => { const k = keyOfRow(r); return k !== null && !liveKeys.has(k); });
    return { insert, upsert: [], deleteKeys: [] };
  }

  // replace — the archive is authoritative.
  const archiveKeys = new Set<string>();
  for (const r of archiveRows) { const k = keyOfRow(r); if (k !== null) archiveKeys.add(k); }

  const deleteKeys: Record<string, unknown>[] = [];
  for (const r of currentRows) {
    const k = keyOfRow(r);
    if (k === null) continue;                 // keyless live rows are never touched (diff flags them)
    if (!archiveKeys.has(k)) {
      const km: Record<string, unknown> = {};
      for (const f of entity.naturalKey) km[f] = r[f];
      deleteKeys.push(km);
    }
  }
  return { insert: [], upsert: [...archiveRows], deleteKeys };
}

// ─── The injected client: exactly the surface the executor needs ──────────────────────

export interface WriteDeleteBuilder {
  eq(column: string, value: unknown): WriteDeleteBuilder;
  in(column: string, values: unknown[]): Promise<{ error: { message: string } | null }>;
  match(criteria: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
}
export interface WriteTable {
  insert(rows: Row[]): Promise<{ error: { message: string } | null }>;
  upsert(rows: Row[]): Promise<{ error: { message: string } | null }>;
  delete(): WriteDeleteBuilder;
}
export interface WriteClient {
  from(table: string): WriteTable;
}

const chunked = <T>(rows: readonly T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
};

/** Stamp society_id onto every row — the tenant column the whole schema is scoped by. */
const stamped = (rows: readonly Row[], societyId: string): Row[] =>
  rows.map(r => ({ ...r, society_id: societyId }));

/**
 * Execute a plan against the database. Throws RestoreWriteError on the first failure, so the
 * saga stops and reports how far it got (there is no transaction to unwind).
 *
 * Order within an entity: DELETE orphans first, then upsert/insert. On Replace, deleting an
 * orphan before writing avoids a natural-key clash if a new row reuses a freed code.
 */
export async function applyEntityWrites(
  entity: EntityDescriptor,
  plan: EntityWritePlan,
  client: WriteClient,
  societyId: string,
): Promise<{ written: number }> {
  if (!societyId) throw new RestoreWriteError(entity.table, 'refusing to write without a society id — that is the only tenant boundary');

  // 1. Deletes (Replace orphans). ALWAYS society-scoped.
  if (plan.deleteKeys.length) {
    const single = entity.naturalKey.length === 1 ? entity.naturalKey[0] : null;
    if (single) {
      // Batch by the single key column, scoped to this society.
      const values = plan.deleteKeys.map(k => k[single]);
      for (const batch of chunked(values)) {
        const { error } = await client.from(entity.table).delete().eq('society_id', societyId).in(single, batch);
        if (error) throw new RestoreWriteError(entity.table, `orphan delete failed — ${error.message}`);
      }
    } else {
      // Composite key: match every key field AND the society, per row.
      for (const km of plan.deleteKeys) {
        const { error } = await client.from(entity.table).delete().eq('society_id', societyId).match({ ...km, society_id: societyId });
        if (error) throw new RestoreWriteError(entity.table, `orphan delete failed — ${error.message}`);
      }
    }
  }

  // 2. Upserts (Replace) and inserts (Fresh / Merge). Chunked; society stamped.
  let written = 0;
  for (const batch of chunked(stamped(plan.upsert, societyId))) {
    const { error } = await client.from(entity.table).upsert(batch);
    if (error) throw new RestoreWriteError(entity.table, `upsert failed — ${error.message}`);
    written += batch.length;
  }
  for (const batch of chunked(stamped(plan.insert, societyId))) {
    const { error } = await client.from(entity.table).insert(batch);
    if (error) throw new RestoreWriteError(entity.table, `insert failed — ${error.message}`);
    written += batch.length;
  }

  return { written };
}

/**
 * Build the `applyWrites` the commit saga expects, closing over the client, the society, and
 * the current rows the dry run already read. The saga passes (entity, archiveRows, mode);
 * this looks up that entity's live rows to plan Merge/Replace correctly.
 */
export function makeRestoreWriter(
  client: WriteClient,
  societyId: string,
  currentRowsByKey: Record<string, readonly Row[]>,
) {
  return async (entity: EntityDescriptor, archiveRows: readonly Row[], mode: RestoreMode): Promise<{ written: number }> => {
    const plan = planEntityWrites(entity, archiveRows, currentRowsByKey[entity.key] ?? [], mode);
    return applyEntityWrites(entity, plan, client, societyId);
  };
}

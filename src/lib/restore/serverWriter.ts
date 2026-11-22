/**
 * Restore through the SERVER, in one transaction (migration 178 · audit NEW-01 / NEW-02 / BKP-01, 2026-11-17).
 *
 * The browser used to execute the restore plan itself, table by table. For a posting-service society the
 * database refuses direct browser writes to vouchers / voucher_entries / ledger_events (trigger 105), so a
 * restore stopped half-way; and nothing rebuilt voucher_entries, voucher_lines or the journal.
 *
 * Now the browser still PLANS every write with the same tested planner (rowWriter.planEntityWrites, run by the
 * commit saga), but against a RECORDING client: nothing reaches the database while the saga runs. The recorded
 * operations are uploaded in chunks (restore_stage) and applied by restore_commit in one transaction, which
 * also rebuilds the derived rows and the journal. Either the whole restore lands, or none of it.
 *
 * Pure parts (recording, chunking, revived-voucher re-keying) are unit-tested by scripts/test-restore-server.mjs.
 */
import type { Row } from './naturalKeys';
import type { WriteClient, WriteTable, WriteDeleteBuilder } from './rowWriter';

export type RestoreOp =
  | { table: string; kind: 'insert' | 'upsert'; rows: Row[] }
  | { table: string; kind: 'delete'; keys: Record<string, unknown>[] };

const ok = { error: null };

/**
 * A WriteClient that records instead of writing. `missingTables` answers like the database would for a table
 * that does not exist (member_identity before migration 106), so the PII routing keeps its legacy fallback.
 */
export function makeRecordingClient(opts: { missingTables?: ReadonlySet<string> } = {}): { client: WriteClient; ops: RestoreOp[] } {
  const ops: RestoreOp[] = [];
  const missing = opts.missingTables ?? new Set<string>();
  const missingErr = (t: string) => ({ error: { message: `relation "public.${t}" does not exist` } });
  const client: WriteClient = {
    from(table: string): WriteTable {
      return {
        async insert(rows: Row[]) {
          if (missing.has(table)) return missingErr(table);
          ops.push({ table, kind: 'insert', rows: rows.map(r => ({ ...r })) });
          return ok;
        },
        async upsert(rows: Row[]) {
          if (missing.has(table)) return missingErr(table);
          ops.push({ table, kind: 'upsert', rows: rows.map(r => ({ ...r })) });
          return ok;
        },
        delete(): WriteDeleteBuilder {
          const scope: Record<string, unknown> = {};
          const builder: WriteDeleteBuilder = {
            eq(column: string, value: unknown) { scope[column] = value; return builder; },
            async in(column: string, values: unknown[]) {
              if (missing.has(table)) return missingErr(table);
              ops.push({ table, kind: 'delete', keys: values.map(v => ({ [column]: v })) });
              return ok;
            },
            async match(criteria: Record<string, unknown>) {
              if (missing.has(table)) return missingErr(table);
              const { society_id: _s, ...key } = { ...scope, ...criteria };
              ops.push({ table, kind: 'delete', keys: [key] });
              return ok;
            },
          };
          return builder;
        },
      };
    },
  };
  return { client, ops };
}

/** Split the operations into upload chunks of at most ~`maxBytes` of JSON each (one op may be split by rows). */
export function chunkOps(ops: readonly RestoreOp[], maxBytes = 1_500_000): RestoreOp[][] {
  const chunks: RestoreOp[][] = [];
  let cur: RestoreOp[] = [];
  let size = 0;
  const push = (op: RestoreOp) => {
    const s = JSON.stringify(op).length;
    if (cur.length && size + s > maxBytes) { chunks.push(cur); cur = []; size = 0; }
    cur.push(op); size += s;
  };
  for (const op of ops) {
    const list = op.kind === 'delete' ? op.keys : op.rows;
    if (JSON.stringify(op).length <= maxBytes || list.length <= 1) { push(op); continue; }
    // Split a large op by rows, keeping order.
    let part: unknown[] = [];
    let partSize = 0;
    for (const item of list) {
      const s = JSON.stringify(item).length + 1;
      if (part.length && partSize + s > maxBytes) {
        push(op.kind === 'delete' ? { ...op, keys: part as Record<string, unknown>[] } : { ...op, rows: part as Row[] });
        part = []; partSize = 0;
      }
      part.push(item); partSize += s;
    }
    if (part.length) push(op.kind === 'delete' ? { ...op, keys: part as Record<string, unknown>[] } : { ...op, rows: part as Row[] });
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/**
 * Vouchers cancelled AFTER the backup cannot come back under the same id: the journal treats a cancel as final
 * (a cancelled aggregate is never current again). Such a voucher is restored under a NEW id, and every reference
 * to the old id in the archive (sales.voucherId, gstVoucherIds, accrualVoucherId, refId, …) is re-pointed.
 * The server renames the old cancelled row's number so the restored voucher keeps the original number.
 *
 * PURE. A revived voucher = an archive voucher that is live, whose id is a CANCELLED voucher today.
 */
export function rekeyRevivedVouchers(
  archiveRows: Record<string, readonly Row[]>,
  archivedEntries: readonly Row[],
  currentVouchers: readonly Row[],
  newId: () => string,
): { archiveRows: Record<string, readonly Row[]>; archivedEntries: Row[]; revived: Record<string, string> } {
  const cancelledNow = new Set(currentVouchers.filter(v => v.isDeleted === true).map(v => String(v.id)));
  const revived: Record<string, string> = {};
  for (const v of archiveRows['voucher'] ?? []) {
    const id = String(v.id ?? '');
    if (id && v.isDeleted !== true && cancelledNow.has(id)) revived[id] = newId();
  }
  if (Object.keys(revived).length === 0) return { archiveRows, archivedEntries: [...archivedEntries], revived };
  const swap = (value: unknown): unknown => {
    if (typeof value === 'string') return Object.prototype.hasOwnProperty.call(revived, value) ? revived[value] : value;
    if (Array.isArray(value)) return value.map(swap);
    if (value && typeof value === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(value as Record<string, unknown>)) o[k] = swap(x);
      return o;
    }
    return value;
  };
  const out: Record<string, readonly Row[]> = {};
  for (const [key, rows] of Object.entries(archiveRows)) out[key] = rows.map(r => swap(r) as Row);
  // An archived entry's own id is built from its voucher's id ('<voucherId>-<lineId>', buildVoucherEntries), so it
  // follows the voucher too — else the replay assertion would compare 'NEW-L1' with 'OLD-L1' and refuse.
  const entries = archivedEntries.map(r => {
    const e = swap(r) as Row;
    const oldVid = String(r.voucherId ?? '');
    const id = typeof r.id === 'string' ? r.id : '';
    if (oldVid && revived[oldVid] && id.startsWith(`${oldVid}-`)) e.id = `${revived[oldVid]}${id.slice(oldVid.length)}`;
    return e;
  });
  return { archiveRows: out, archivedEntries: entries, revived };
}

export interface RestoreRpc {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface ServerCommitResult {
  status: 'committed';
  rowsWritten: number; rowsDeleted: number; vouchersCancelled: number; accountsKept: number; entries: number;
  /** 201: members a voucher or loan still names — marked deleted instead of removed (absent before migration 201). */
  membersKept?: number;
  voucherLinesReposted: number; journal: { posted: number; reposted: number; cancelled: number };
}

/** Upload the plan and apply it in one server transaction. THROWS with the server's message on any refusal. */
export async function stageAndCommit(
  rpc: RestoreRpc,
  ops: readonly RestoreOp[],
  opts: { mode: string; manifestHash: string; revived: Record<string, string>; runId: string },
): Promise<ServerCommitResult> {
  const chunks = chunkOps(ops);
  if (chunks.length === 0) chunks.push([]);
  for (let i = 0; i < chunks.length; i++) {
    const { error } = await rpc.rpc('restore_stage', { p_run: opts.runId, p_seq: i + 1, p_ops: chunks[i] });
    if (error) throw new Error(error.message);
  }
  const { data, error } = await rpc.rpc('restore_commit', {
    p_run: opts.runId, p_chunks: chunks.length, p_mode: opts.mode, p_manifest_hash: opts.manifestHash, p_revived: opts.revived,
  });
  if (error) throw new Error(error.message);
  return data as ServerCommitResult;
}

/** The server's Hindi reason (text after "restore:<code> — "), else the raw message. */
export function restoreErrorMessage(raw: string): string {
  const m = /restore:[a-z_]+ — ([^\n]+)/.exec(raw || '');
  return m ? m[1] : raw;
}

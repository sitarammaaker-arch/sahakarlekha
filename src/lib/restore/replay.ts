/**
 * Replay assertion for `voucher_entries` (T-33 / gap EXP-03).
 *
 * PURE. No Supabase, no DOM, no clock.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY A RESTORE REGENERATES THIS TABLE INSTEAD OF INSERTING IT
 *
 * `voucher_entries` is DERIVED. Every row is produced by the posting rule from a voucher's
 * Dr/Cr legs. It is the registry's only `replay` entity, and the reason is RULE 2: a number
 * must have one source. Insert the archived rows and the ledger has two — the vouchers, and
 * a year-old copy of what the posting rule used to say about them. Fix a posting bug, and
 * every restored society keeps the bug forever.
 *
 * So a restore inserts the vouchers, runs `buildVoucherEntries` over them, and writes the
 * result. The archived rows are never written. They are used for exactly one thing:
 *
 * THE ASSERTION. If regenerating the entries does not reproduce what the backup recorded,
 * something changed between the backup and now — the posting rule, the voucher data, or the
 * archive. Any of those means the restored books will not agree with the books that were
 * backed up, and the restore must roll back and name the vouchers that disagree.
 *
 * A DISAGREEMENT IS NOT ALWAYS A BUG, AND THIS MODULE DOES NOT DECIDE
 *
 * A deliberate posting-rule fix also makes the replay disagree. That is correct and
 * expected — and it is a human's call, not a function's. `compareReplay` reports; the saga
 * in `commit.ts` refuses. Nobody here silently accepts a difference in the ledger.
 *
 * WHAT IS COMPARED, AND WHAT IS DELIBERATELY NOT
 *
 * Only the fields the posting rule produces (REPLAY_FIELDS). A row read back from Postgres
 * also carries `society_id` (the tenant column, a duplicate of `societyId`) and whatever
 * storage columns the table has grown. Those are not the posting rule's output; comparing
 * them would make every archive disagree with every build.
 *
 * The cost of that choice, stated plainly: a wrong `society_id` on a `voucher_entries` row
 * would NOT be caught here. It is caught where it belongs — `fetchEntityRows` filters every
 * read by `society_id`, and 35 of the schema's RLS policies are `using (true)`, so that
 * filter is the tenant boundary.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import type { Voucher, VoucherEntry } from '@/types';
import { buildVoucherEntries } from '../voucherUtils';
import type { Row } from './naturalKeys';

/**
 * The posting rule's output. `narration`, `workOrderId` and `costCentreId` are optional and
 * are compared as absent-equals-null, exactly as `diff.ts` does.
 */
export const REPLAY_FIELDS: readonly string[] = Object.freeze([
  'id', 'voucherId', 'accountId', 'dr', 'cr', 'narration', 'societyId', 'workOrderId', 'costCentreId',
]);

export interface EntryDisagreement {
  /** The `voucher_entries.id`, which encodes `${voucherId}-${lineId}`. */
  id: string;
  voucherId: string;
  field: string;
  replayed: string;
  archived: string;
}

export interface ReplayVerdict {
  ok: boolean;
  /** Rows the replay produced that the archive does not have. */
  unexpected: string[];
  /** Rows the archive has that the replay did not produce. */
  missing: string[];
  /** Rows both have, that differ. Every differing field, not just the first. */
  disagreements: EntryDisagreement[];
  /**
   * The vouchers implicated, deduplicated and sorted. This is what an operator is shown:
   * "these 3 vouchers do not replay" is actionable; "417 entry rows differ" is not.
   */
  vouchers: string[];
  replayedCount: number;
  archivedCount: number;
}

/**
 * PURE — normalize one field for comparison.
 *
 * `dr` and `cr` are numeric in Postgres and may come back as strings (`"1500.00"`), while
 * the posting rule produces numbers. Comparing them as JSON would report every single row
 * as a disagreement. They are compared as numbers; everything else as JSON, where absent
 * and null are the same fact.
 */
function encodeField(field: string, value: unknown): string {
  if (field === 'dr' || field === 'cr') {
    const n = value === null || value === undefined || value === '' ? 0 : Number(value);
    return Number.isNaN(n) ? `NaN(${JSON.stringify(value)})` : String(n);
  }
  return value === undefined ? 'null' : JSON.stringify(value) ?? 'null';
}

/**
 * PURE — regenerate the entries for a set of vouchers, through the SAME posting rule the
 * app posts with.
 *
 * SOFT-DELETED VOUCHERS PRODUCE NO ENTRIES. `cancelVoucher` deletes a voucher's rows from
 * `voucher_entries`; a cancelled voucher has legs but no ledger effect. Replaying entries
 * for one would resurrect a reversed transaction into the Trial Balance (RULE 5).
 */
export function replayEntries(vouchers: readonly Voucher[], societyId: string): VoucherEntry[] {
  const out: VoucherEntry[] = [];
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    out.push(...buildVoucherEntries(v, societyId));
  }
  return out;
}

/**
 * PURE — does the replay reproduce the archive?
 *
 * Matched by `id`, which the posting rule derives from `${voucherId}-${lineId}`. Two rows
 * with the same id in either side is not handled here: `diff.ts` blocks duplicate natural
 * keys before a restore ever reaches this point.
 */
export function compareReplay(
  replayed: readonly VoucherEntry[],
  archived: readonly Row[],
): ReplayVerdict {
  const replayedById = new Map(replayed.map(e => [e.id, e as unknown as Row]));
  const archivedById = new Map(archived.map(e => [String(e.id), e]));

  const unexpected: string[] = [];
  const missing: string[] = [];
  const disagreements: EntryDisagreement[] = [];
  const vouchers = new Set<string>();

  /** The voucher an entry belongs to. Falls back to the id's prefix if the column is absent. */
  const voucherOf = (row: Row, id: string): string =>
    (row?.voucherId as string) ?? id.split('-').slice(0, -1).join('-') ?? id;

  for (const [id, row] of replayedById) {
    if (!archivedById.has(id)) {
      unexpected.push(id);
      vouchers.add(voucherOf(row, id));
    }
  }
  for (const [id, row] of archivedById) {
    if (!replayedById.has(id)) {
      missing.push(id);
      vouchers.add(voucherOf(row, id));
    }
  }

  for (const [id, replayedRow] of replayedById) {
    const archivedRow = archivedById.get(id);
    if (!archivedRow) continue;
    for (const field of REPLAY_FIELDS) {
      const a = encodeField(field, replayedRow[field]);
      const b = encodeField(field, archivedRow[field]);
      if (a !== b) {
        disagreements.push({ id, voucherId: voucherOf(replayedRow, id), field, replayed: a, archived: b });
        vouchers.add(voucherOf(replayedRow, id));
      }
    }
  }

  return {
    ok: unexpected.length === 0 && missing.length === 0 && disagreements.length === 0,
    unexpected: unexpected.sort(),
    missing: missing.sort(),
    disagreements,
    vouchers: [...vouchers].sort(),
    replayedCount: replayed.length,
    archivedCount: archived.length,
  };
}

/** PURE — one line for the operator. Hindi first (RULE 7). */
export function summarizeReplay(verdict: ReplayVerdict, hi = true): string {
  if (verdict.ok) {
    return hi
      ? `${verdict.replayedCount} लेखा-प्रविष्टियाँ दोबारा बनीं और बैकअप से हूबहू मिलीं।`
      : `${verdict.replayedCount} ledger entries were regenerated and match the backup exactly.`;
  }
  const n = verdict.vouchers.length;
  return hi
    ? `${n} वाउचर दोबारा बनाने पर बैकअप से नहीं मिले। restore रोक दिया गया।`
    : `${n} voucher(s) did not reproduce the backup's ledger entries. The restore was stopped.`;
}

/**
 * Rebuild parity — the PRE-FLIGHT for the journal-first WRITE flip (T-09 acceptance, slice 7).
 *
 * PURE. Before a tenant is flipped to `journalFirstWrites`, we must prove the journal can reproduce
 * its live `vouchers` table exactly — because after the flip the table is a best-effort PROJECTION
 * and a table-write failure is recovered by rebuilding from the journal (vouchersFromJournal, slice
 * 2). If the rebuild does not match the table today, the flip would risk losing real vouchers. This
 * mirrors how ledgerParity gated the T-09 READ flip.
 *
 * It compares ONLY the JOURNAL-OWNED field set — the fields voucherFromCurrent reconstructs from the
 * event payload (voucherNo/type/date/amount/narration/createdBy/memberId/branchId + the posting
 * lines). Table-only operational fields the journal never carries (refType/refId, editHistory,
 * approval state, per-line salesAccountId) are OUT of scope by design: the journal owns the
 * accounting truth, the table keeps the operational linkage, and the write-flip only makes the
 * accounting core a projection. A diff in an owned field is a real blocker; the two structural
 * categories (a live voucher the journal cannot rebuild, or a rebuilt voucher with no live row)
 * are the hard blockers the flip must clear first.
 *
 * NOT wired into any live path (dormant). Consumed by an ops pre-flight (check-rebuild-parity) and,
 * later, an in-app readiness card — both read-only. The flip itself stays behind the T-09 soak (R3).
 */
import type { Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor } from '@/lib/money';
import type { LedgerEvent } from './event';
import { vouchersFromJournal } from './voucherRebuild';

/** One owned-field mismatch between the live table row and its journal rebuild. */
export interface RebuildFieldDiff {
  field: string;
  table: unknown;
  journal: unknown;
}

export interface VoucherRebuildDiff {
  voucherId: string;
  voucherNo: string;
  /**
   * - `missing-in-journal`  — a LIVE (non-deleted) table voucher the journal cannot rebuild (e.g. a
   *   pre-T-06 voucher never seeded). A hard blocker: after the flip this row has no journal backing.
   * - `extra-in-journal`    — the journal rebuilds a voucher with no live table row (a cancelled row
   *   that did not net out, or a stale event). A hard blocker: the projection would resurrect it.
   * - `field-mismatch`      — matched ids whose owned fields differ (see `fields`).
   */
  kind: 'missing-in-journal' | 'extra-in-journal' | 'field-mismatch';
  fields?: RebuildFieldDiff[];
}

export interface RebuildParityResult {
  matches: boolean;
  /** live (non-deleted) table vouchers compared. */
  activeCount: number;
  /** vouchers the journal rebuilt. */
  rebuiltCount: number;
  diffs: VoucherRebuildDiff[];
}

/** Canonical posting signature (paise), order-independent — compares WHAT posts, not synthetic ids. */
function postingSignature(v: Voucher): string {
  return getVoucherLines(v)
    .map((l) => `${l.accountId}:${l.type}:${toMinor(l.amount)}`)
    .sort()
    .join('|');
}

const str = (x: unknown): string => (x == null ? '' : String(x));

/** The journal-owned fields, compared exactly (amount + lines in integer paise, never floats). */
function ownedDiffs(table: Voucher, journal: Voucher): RebuildFieldDiff[] {
  const out: RebuildFieldDiff[] = [];
  const push = (field: string, a: unknown, b: unknown) => { if (a !== b) out.push({ field, table: a, journal: b }); };
  push('voucherNo', str(table.voucherNo), str(journal.voucherNo));
  push('type', str(table.type), str(journal.type));
  push('date', str(table.date), str(journal.date));
  push('amount', toMinor(table.amount || 0), toMinor(journal.amount || 0));
  push('narration', str(table.narration), str(journal.narration));
  push('createdBy', str(table.createdBy), str(journal.createdBy));
  push('memberId', str(table.memberId), str(journal.memberId));
  push('branchId', str(table.branchId), str(journal.branchId));   // '' = Head Office
  push('lines', postingSignature(table), postingSignature(journal));
  return out;
}

/**
 * PURE — compare the journal's rebuild against the live `vouchers` table. `matches` is true only when
 * every live voucher rebuilds to an identical owned-field set and the journal produces no extra rows.
 * Deleted table rows are excluded (the journal nets cancelled vouchers to absent). Deterministic.
 */
export function rebuildParity(events: readonly LedgerEvent[], tableVouchers: readonly Voucher[]): RebuildParityResult {
  const active = tableVouchers.filter((v) => !v.isDeleted);
  const rebuilt = vouchersFromJournal(events);
  const rebuiltById = new Map(rebuilt.map((v) => [v.id, v]));
  const activeIds = new Set(active.map((v) => v.id));
  const diffs: VoucherRebuildDiff[] = [];

  for (const v of active) {
    const j = rebuiltById.get(v.id);
    if (!j) { diffs.push({ voucherId: v.id, voucherNo: v.voucherNo, kind: 'missing-in-journal' }); continue; }
    const fields = ownedDiffs(v, j);
    if (fields.length) diffs.push({ voucherId: v.id, voucherNo: v.voucherNo, kind: 'field-mismatch', fields });
  }
  for (const j of rebuilt) {
    if (!activeIds.has(j.id)) diffs.push({ voucherId: j.id, voucherNo: j.voucherNo, kind: 'extra-in-journal' });
  }

  return { matches: diffs.length === 0, activeCount: active.length, rebuiltCount: rebuilt.length, diffs };
}

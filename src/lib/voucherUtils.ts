import type { Voucher, VoucherEntry, VoucherLine } from '@/types';

/**
 * Returns the voucher lines array.
 * For new multi-line vouchers: returns v.lines
 * For legacy single-entry vouchers: synthesizes [{Dr}, {Cr}] from debitAccountId/creditAccountId
 */
export function getVoucherLines(v: Voucher): VoucherLine[] {
  if (v.lines && v.lines.length > 0) return v.lines;
  // Legacy synthesis
  const lines: VoucherLine[] = [];
  if (v.debitAccountId && v.amount > 0) {
    lines.push({ id: `${v.id}-dr`, accountId: v.debitAccountId, type: 'Dr', amount: v.amount });
  }
  if (v.creditAccountId && v.amount > 0) {
    lines.push({ id: `${v.id}-cr`, accountId: v.creditAccountId, type: 'Cr', amount: v.amount });
  }
  return lines;
}

/**
 * PURE — the posting rule. One `voucher_entries` row per Dr/Cr leg of a voucher.
 *
 * THIS IS THE ONLY IMPLEMENTATION, AND THAT IS THE POINT.
 *
 * `voucher_entries` is the one collection the registry marks `replay`: a backup exports it
 * as a checksum, and a restore REGENERATES it rather than inserting the archived rows.
 * Regenerating means running this function again — the same function DataContext runs when
 * a voucher is saved (`syncEntries`).
 *
 * It used to be a closure inside DataContext, which meant a restore could only replay by
 * reimplementing it. Two implementations of one posting rule is the RULE 2 failure exactly:
 * a replay assertion comparing rows built by copy A against rows built by copy B proves
 * that A and B agree, and nothing whatsoever about the ledger the society actually posts.
 * If this function is wrong, the assertion must FAIL — so both callers must share it.
 *
 * `societyId` is threaded in rather than read from context, so this stays callable from a
 * restore, a test, and a node script.
 */
export function buildVoucherEntries(v: Voucher, societyId: string): VoucherEntry[] {
  return getVoucherLines(v).map(l => ({
    id: `${v.id}-${l.id}`,
    voucherId: v.id,
    accountId: l.accountId,
    dr: l.type === 'Dr' ? l.amount : 0,
    cr: l.type === 'Cr' ? l.amount : 0,
    narration: l.narration,
    societyId,
    // Denormalize the optional dimension only when present — keeps non-labour entries
    // byte-identical and safe even before the columns are migrated.
    ...(v.workOrderId !== undefined ? { workOrderId: v.workOrderId } : {}),
    ...(v.costCentreId !== undefined ? { costCentreId: v.costCentreId } : {}),
  }));
}

export function voucherDrTotal(v: Voucher): number {
  return getVoucherLines(v).filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
}

export function voucherCrTotal(v: Voucher): number {
  return getVoucherLines(v).filter(l => l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
}

export function isMultiLine(v: Voucher): boolean {
  return !!(v.lines && v.lines.length > 2);
}

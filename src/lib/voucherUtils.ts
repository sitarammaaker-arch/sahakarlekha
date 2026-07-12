import type { Voucher, VoucherEntry, VoucherLine } from '@/types';
import { toMinor, toRupees, subMinor, addMinor, allocateMinor } from '@/lib/money';

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

/**
 * PURE — the RULE 4 split, born exact (T-02). Apportions a sale/purchase NET amount
 * (grandTotal − tax) across ledger accounts in exact integer paise, so the per-account
 * lines sum to EXACTLY the net and the voucher balances BY CONSTRUCTION — instead of each
 * account being rounded independently (which drifts by paise and is why the balance check
 * carries a 1-paisa tolerance). `entries` carry each item's resolved account + value weight;
 * weights are grouped by account (first-seen order) and allocated largest-remainder.
 * Returns one { accountId, amount } per distinct account with amount > 0.
 *
 * This is the ONE split rule — addSale, updateSale and the load-repair rebuild all call it,
 * so a repaired voucher is byte-identical to a freshly-posted one (RULE 2).
 */
export function splitNetByAccount(
  entries: { accountId: string; weight: number }[],
  grandTotal: number,
  taxAmount: number,
  tdsAmount = 0,
): { accountId: string; amount: number }[] {
  // net = grandTotal − tax, plus TDS for a PURCHASE: its goods value adds back the TDS the
  // supplier payable already deducted, so Dr(net)+ITC === Cr(grandTotal)+TDS. tds defaults 0,
  // so sale callers (grandTotal − tax) are unchanged.
  const netMinor = addMinor(subMinor(toMinor(Number(grandTotal) || 0), toMinor(Number(taxAmount) || 0)), toMinor(Number(tdsAmount) || 0));
  if (netMinor <= 0 || entries.length === 0) return [];
  const order: string[] = [];
  const weightByAcc = new Map<string, number>();
  for (const e of entries) {
    if (!weightByAcc.has(e.accountId)) order.push(e.accountId);
    const w = Number.isFinite(e.weight) && e.weight > 0 ? e.weight : 0;
    weightByAcc.set(e.accountId, (weightByAcc.get(e.accountId) || 0) + w);
  }
  const alloc = allocateMinor(netMinor, order.map((acc) => weightByAcc.get(acc) || 0));
  const out: { accountId: string; amount: number }[] = [];
  order.forEach((acc, i) => { if (alloc[i] > 0) out.push({ accountId: acc, amount: toRupees(alloc[i]) }); });
  return out;
}

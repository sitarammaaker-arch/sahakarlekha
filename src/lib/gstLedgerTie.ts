/**
 * GST report ↔ ledger tie (audit RPT-01, 2026-11-17). PURE; unit-tested by scripts/test-gst-ledger-tie.mjs.
 *
 * GST Summary / GSTR-1 / GSTR-3B are built from sale, purchase and return ROWS. Output tax posted without a sale row
 * — housing maintenance bills, transport freight, a manual journal — sits in the ledger but never reaches those
 * returns; the same for input credit claimed by a journal. A return filed from the report then under-declares.
 *
 * This finds, for the period, every live posted voucher that RAISES output tax (net credit on an output-GST ledger)
 * or CLAIMS input credit (net debit on an input-GST ledger) and is NOT one of the vouchers of a sale / purchase /
 * return row the report already counts. Settlement vouchers (Dr output / Cr input, Dr output / Cr bank) lower the
 * output side and are not supplies, so they never appear. The page shows the total and the list, so the clerk adds
 * them to the return by hand (or records them as a sale) BEFORE filing.
 */
import { GST_COMBINED_ID, GST_HEAD_ID, RCM_PAYABLE_ID } from './accounting/gstLedgers';

export interface TieLine { accountId: string; type: 'Dr' | 'Cr'; amount: number }
export interface TieVoucher {
  id: string; voucherNo?: string; date: string; narration?: string; isDeleted?: boolean; approvalStatus?: string;
  lines: TieLine[];
}
export interface GstTieRow { voucherId: string; voucherNo: string; date: string; narration: string; amount: number }
export interface GstLedgerTie {
  /** Output tax raised by vouchers the report does not count (₹). */
  outputNotInReport: number;
  /** Input credit claimed by vouchers the report does not count (₹). */
  inputNotInReport: number;
  outputRows: GstTieRow[];
  inputRows: GstTieRow[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Output- and input-GST ledger ids of a chart: the combined ledgers, the head-wise ones, and any ledger named as such. */
export function gstLedgerIds(accounts: ReadonlyArray<{ id: string; name: string; type: string; isGroup?: boolean }>): { output: Set<string>; input: Set<string> } {
  const output = new Set<string>([GST_COMBINED_ID.output, ...Object.values(GST_HEAD_ID.output)]);
  const input = new Set<string>([GST_COMBINED_ID.input, ...Object.values(GST_HEAD_ID.input)]);
  for (const a of accounts) {
    if (a.isGroup || a.id === RCM_PAYABLE_ID) continue;   // reverse charge is not output tax (CGST Act s.2(82))
    if (a.type === 'liability' && /\boutput\b.*\b(c|s|i|u)?gst\b|\b(c|s|i|u)?gst\b.*\b(output|payable)\b/i.test(a.name) && !/\brcm\b|reverse charge|\btds\b|\btcs\b/i.test(a.name)) output.add(a.id);
    if (a.type === 'asset' && /\binput\b.*\b(c|s|i|u)?gst\b|\b(c|s|i|u)?gst\b.*\b(input|itc|credit)\b/i.test(a.name) && !/\btds\b|\btcs\b/i.test(a.name)) input.add(a.id);
  }
  return { output, input };
}

export function gstLedgerTie(
  vouchers: readonly TieVoucher[],
  ids: { output: ReadonlySet<string>; input: ReadonlySet<string> },
  /** Ids of every voucher the report already counts (sales / purchases / returns and their GST journals). */
  countedVoucherIds: ReadonlySet<string>,
  from: string,
  to: string,
): GstLedgerTie {
  const outputRows: GstTieRow[] = [];
  const inputRows: GstTieRow[] = [];
  for (const v of vouchers) {
    if (v.isDeleted || v.approvalStatus === 'pending' || v.approvalStatus === 'rejected') continue;
    const d = (v.date || '').slice(0, 10);
    if (d < from || d > to || countedVoucherIds.has(v.id)) continue;
    let outNet = 0, inNet = 0;   // paise: output Cr − Dr, input Dr − Cr
    for (const l of v.lines || []) {
      const p = Math.round((Number(l.amount) || 0) * 100);
      if (ids.output.has(l.accountId)) outNet += l.type === 'Cr' ? p : -p;
      if (ids.input.has(l.accountId)) inNet += l.type === 'Dr' ? p : -p;
    }
    const row = (paise: number): GstTieRow => ({ voucherId: v.id, voucherNo: v.voucherNo || v.id, date: d, narration: v.narration || '', amount: paise / 100 });
    if (outNet > 0) outputRows.push(row(outNet));
    if (inNet > 0) inputRows.push(row(inNet));
  }
  const byDate = (a: GstTieRow, b: GstTieRow) => a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo);
  outputRows.sort(byDate); inputRows.sort(byDate);
  return {
    outputNotInReport: r2(outputRows.reduce((s, r) => s + r.amount, 0)),
    inputNotInReport: r2(inputRows.reduce((s, r) => s + r.amount, 0)),
    outputRows, inputRows,
  };
}

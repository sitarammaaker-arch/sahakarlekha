/**
 * TDS Register ↔ TDS Payable ledger tie (audit RPT-04, 2026-11-17). PURE; unit-tested by scripts/test-tds-ledger-tie.mjs.
 *
 * The register lists TDS from purchases, salary slips and rows typed in by hand; the ledger's TDS Payable head is
 * credited by vouchers. They drifted both ways:
 *   • a row typed into the register posts NO voucher — the register shows TDS the ledger never owed;
 *   • a journal crediting TDS Payable makes NO register row — the ledger owes TDS that 26Q never reports.
 * This lists both, for the quarter, so the clerk fixes them before 26Q / 24Q.
 */
export interface TdsTieLine { accountId: string; type: 'Dr' | 'Cr'; amount: number }
export interface TdsTieVoucher {
  id: string; voucherNo?: string; date: string; narration?: string; isDeleted?: boolean; approvalStatus?: string;
  lines: TdsTieLine[];
}
export interface TdsTieRow { id: string; label: string; date: string; amount: number }
export interface TdsLedgerTie {
  /** TDS credited to the payable head by vouchers no register row stands for (₹). */
  ledgerNotInRegister: number;
  ledgerRows: TdsTieRow[];
  /** Register rows typed in by hand — they post nothing to the ledger (₹). */
  registerNotInLedger: number;
  registerRows: TdsTieRow[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function tdsLedgerTie(
  vouchers: readonly TdsTieVoucher[],
  tdsPayableId: string | null | undefined,
  /** Vouchers a register row stands for: purchase vouchers + their tax journals, salary accrual vouchers. */
  countedVoucherIds: ReadonlySet<string>,
  /** Register rows typed in by hand (no voucher behind them), already limited to the quarter. */
  manualRows: ReadonlyArray<{ id: string; deducteeName: string; date: string; tdsAmount: number }>,
  from: string,
  to: string,
): TdsLedgerTie {
  const ledgerRows: TdsTieRow[] = [];
  if (tdsPayableId) {
    for (const v of vouchers) {
      if (v.isDeleted || v.approvalStatus === 'pending' || v.approvalStatus === 'rejected') continue;
      const d = (v.date || '').slice(0, 10);
      if (d < from || d > to || countedVoucherIds.has(v.id)) continue;
      let net = 0;   // paise, Cr − Dr on the TDS payable head
      for (const l of v.lines || []) {
        if (l.accountId !== tdsPayableId) continue;
        const p = Math.round((Number(l.amount) || 0) * 100);
        net += l.type === 'Cr' ? p : -p;
      }
      // Only vouchers that RAISE the liability; a challan payment (Dr TDS Payable / Cr Bank) is a deposit, not a deduction.
      if (net > 0) ledgerRows.push({ id: v.id, label: `${v.voucherNo || v.id}${v.narration ? ` · ${v.narration.slice(0, 60)}` : ''}`, date: d, amount: net / 100 });
    }
  }
  const registerRows: TdsTieRow[] = manualRows
    .filter((e) => (Number(e.tdsAmount) || 0) > 0)
    .map((e) => ({ id: e.id, label: e.deducteeName, date: (e.date || '').slice(0, 10), amount: r2(Number(e.tdsAmount) || 0) }));
  const byDate = (a: TdsTieRow, b: TdsTieRow) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label);
  ledgerRows.sort(byDate); registerRows.sort(byDate);
  return {
    ledgerNotInRegister: r2(ledgerRows.reduce((s, r) => s + r.amount, 0)), ledgerRows,
    registerNotInLedger: r2(registerRows.reduce((s, r) => s + r.amount, 0)), registerRows,
  };
}

/** The quarter's date range for a financial year label 'YYYY-YY' and 'Q1'..'Q4'. */
export function quarterRange(fy: string, quarter: string): { from: string; to: string } {
  const y = parseInt((fy || '').slice(0, 4), 10);
  switch (quarter) {
    case 'Q1': return { from: `${y}-04-01`, to: `${y}-06-30` };
    case 'Q2': return { from: `${y}-07-01`, to: `${y}-09-30` };
    case 'Q3': return { from: `${y}-10-01`, to: `${y}-12-31` };
    default: return { from: `${y + 1}-01-01`, to: `${y + 1}-03-31` };
  }
}

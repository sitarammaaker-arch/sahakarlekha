/**
 * Unified statutory reconciliation (ECR-14, bounded slice).
 *
 * The app computes PF/ESI in two separate places: salaried employees (SalaryRecord
 * in DataContext) and daily-wage labour (muster → LabourDataContext.computePfEsi).
 * This is a READ-ONLY combined view for a period — it does NOT merge the two write
 * paths (that stays deferred). Pure & tested by
 * scripts/test-statutory-reconciliation.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface StatutoryLine {
  gross: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
}
export interface ReconRow extends StatutoryLine {
  source: 'salaried' | 'labour';
  count: number; // employees / workers contributing
}
export interface StatutoryTotals extends StatutoryLine {
  pfTotal: number;  // employee + employer PF (the challan figure)
  esiTotal: number; // employee + employer ESI
  count: number;
}
export interface StatutoryReconciliation {
  rows: ReconRow[];
  totals: StatutoryTotals;
}

/** Combine per-source statutory rows into a grand total. */
export function reconcileStatutory(rows: ReconRow[]): StatutoryReconciliation {
  const sum = (k: keyof StatutoryLine) => r2(rows.reduce((s, r) => s + (r[k] || 0), 0));
  const pfEmployee = sum('pfEmployee'), pfEmployer = sum('pfEmployer');
  const esiEmployee = sum('esiEmployee'), esiEmployer = sum('esiEmployer');
  return {
    rows,
    totals: {
      gross: sum('gross'),
      pfEmployee, pfEmployer, esiEmployee, esiEmployer,
      pfTotal: r2(pfEmployee + pfEmployer),
      esiTotal: r2(esiEmployee + esiEmployer),
      count: rows.reduce((s, r) => s + (r.count || 0), 0),
    },
  };
}

/** Build the salaried row from that period's SalaryRecords. */
export function salariedRow(records: Array<{ basicSalary?: number; allowances?: number; pfEmployee?: number; pfEmployer?: number; esiEmployee?: number; esiEmployer?: number }>): ReconRow {
  const s = (f: 'pfEmployee' | 'pfEmployer' | 'esiEmployee' | 'esiEmployer') => records.reduce((a, r) => a + (r[f] || 0), 0);
  return {
    source: 'salaried',
    count: records.length,
    gross: r2(records.reduce((a, r) => a + ((r.basicSalary || 0) + (r.allowances || 0)), 0)),
    pfEmployee: r2(s('pfEmployee')), pfEmployer: r2(s('pfEmployer')),
    esiEmployee: r2(s('esiEmployee')), esiEmployer: r2(s('esiEmployer')),
  };
}

/** Build the labour row from LabourDataContext.computePfEsi() output. */
export function labourRow(comp: { grossWages?: number; epfEmployee?: number; epfEmployer?: number; esiEmployee?: number; esiEmployer?: number }, workerCount: number): ReconRow {
  return {
    source: 'labour',
    count: workerCount,
    gross: r2(comp.grossWages || 0),
    pfEmployee: r2(comp.epfEmployee || 0), pfEmployer: r2(comp.epfEmployer || 0),
    esiEmployee: r2(comp.esiEmployee || 0), esiEmployer: r2(comp.esiEmployer || 0),
  };
}

/**
 * Slip ↔ ledger check (2026-11-11). The figures above come from the slips alone, so a slip whose accrual
 * voucher was lost (refused, cancelled, edited elsewhere) would still look fine here. For every slip of the
 * period this compares what the slip says with what its OWN accrual voucher actually credits:
 *   EPF payable 2203 = employee + employer PF,  ESI payable 2204 = employee + employer ESI.
 * A slip without an accrual voucher is reported only when it carries PF/ESI (older net-only slips book the
 * expense at payment, by design). Amounts are compared to the paisa. PURE.
 */
export const ACC_EPF_PAYABLE = '2203';
export const ACC_ESI_PAYABLE = '2204';

export interface SlipForLedgerCheck {
  id: string; slipNo?: string; accrualVoucherId?: string;
  pfEmployee?: number; pfEmployer?: number; esiEmployee?: number; esiEmployer?: number;
}
export interface VoucherForLedgerCheck {
  id: string; isDeleted?: boolean; voucherNo?: string;
  lines?: Array<{ accountId: string; type: 'Dr' | 'Cr'; amount: number }>;
}
export type SlipLedgerIssue =
  | { kind: 'no_voucher'; slipId: string; slipNo?: string }
  | { kind: 'voucher_cancelled'; slipId: string; slipNo?: string; voucherNo?: string }
  | { kind: 'pf_mismatch' | 'esi_mismatch'; slipId: string; slipNo?: string; voucherNo?: string; slip: number; ledger: number };

const paise = (n: number) => Math.round((n || 0) * 100);

export function checkSlipsAgainstLedger(slips: SlipForLedgerCheck[], vouchers: VoucherForLedgerCheck[]): SlipLedgerIssue[] {
  const byId = new Map(vouchers.map((v) => [v.id, v]));
  const out: SlipLedgerIssue[] = [];
  for (const s of slips) {
    const pf = paise((s.pfEmployee || 0) + (s.pfEmployer || 0));
    const esi = paise((s.esiEmployee || 0) + (s.esiEmployer || 0));
    if (!s.accrualVoucherId) {
      if (pf + esi > 0) out.push({ kind: 'no_voucher', slipId: s.id, slipNo: s.slipNo });
      continue;
    }
    const v = byId.get(s.accrualVoucherId);
    if (!v) { out.push({ kind: 'no_voucher', slipId: s.id, slipNo: s.slipNo }); continue; }
    if (v.isDeleted) { out.push({ kind: 'voucher_cancelled', slipId: s.id, slipNo: s.slipNo, voucherNo: v.voucherNo }); continue; }
    const cr = (acc: string) => (v.lines || []).filter((l) => l.accountId === acc).reduce((a, l) => a + (l.type === 'Cr' ? paise(l.amount) : -paise(l.amount)), 0);
    const lpf = cr(ACC_EPF_PAYABLE), lesi = cr(ACC_ESI_PAYABLE);
    if (lpf !== pf) out.push({ kind: 'pf_mismatch', slipId: s.id, slipNo: s.slipNo, voucherNo: v.voucherNo, slip: pf / 100, ledger: lpf / 100 });
    if (lesi !== esi) out.push({ kind: 'esi_mismatch', slipId: s.id, slipNo: s.slipNo, voucherNo: v.voucherNo, slip: esi / 100, ledger: lesi / 100 });
  }
  return out;
}
